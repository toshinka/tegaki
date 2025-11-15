/**
 * ================================================================================
 * brush-core.js リアルタイムプレビュー強制表示版
 * ================================================================================
 * 
 * 【緊急修正】
 * ✅ renderPreview() を pointermove 毎に即座実行
 * ✅ throttle 削除 - 60fps Master Loop に依存
 * ✅ プレビューコンテナの永続化
 * ✅ エラーログ追加
 * 
 * ================================================================================
 */

(function() {
  'use strict';

  class BrushCore {
    constructor() {
      this.strokeRecorder = null;
      this.gpuStrokeProcessor = null;
      this.msdfPipelineManager = null;
      this.textureBridge = null;
      this.layerManager = null;
      this.webgpuMaskLayer = null;
      this.eventBus = null;
      
      this.isDrawing = false;
      this.currentStroke = null;
      this.previewSprite = null;
      this.previewContainer = null;
      
      const config = window.TEGAKI_CONFIG;
      this.currentSettings = {
        mode: 'pen',
        color: config?.brush?.defaultColor || '#800000',
        size: config?.brush?.penSize || 10,
        opacity: config?.brush?.opacity || 1.0
      };
      
      this.initialized = false;
      this.msdfAvailable = false;
      
      // ✅ プレビューロック初期化
      this.isPreviewUpdating = false;
    }

    async init() {
      return await this.initialize();
    }

    async initialize() {
      if (this.initialized) return;

      this.strokeRecorder = window.strokeRecorder || window.StrokeRecorder;
      this.layerManager = window.layerManager || window.layerSystem;
      this.eventBus = window.TegakiEventBus || window.eventBus;

      if (!this.strokeRecorder) {
        throw new Error('[BrushCore] strokeRecorder not found');
      }
      if (!this.layerManager) {
        throw new Error('[BrushCore] layerManager not found');
      }

      this.gpuStrokeProcessor = window.GPUStrokeProcessor;
      this.msdfPipelineManager = window.MSDFPipelineManager;
      this.textureBridge = window.WebGPUTextureBridge;
      this.webgpuMaskLayer = window.webgpuMaskLayer;

      this.msdfAvailable = !!(
        this.gpuStrokeProcessor &&
        this.msdfPipelineManager &&
        this.textureBridge
      );

      if (!this.msdfAvailable) {
        console.error('[BrushCore] MSDF Pipeline not available');
        return;
      }

      this._setupEventListeners();
      this.initialized = true;
      this.isPreviewUpdating = false;
    }

    _setupEventListeners() {
      if (!this.eventBus) return;

      this.eventBus.on('brush:size-changed', ({ size }) => {
        if (typeof size === 'number' && size > 0) {
          this.currentSettings.size = size;
        }
      });

      this.eventBus.on('brush:opacity-changed', ({ opacity }) => {
        if (typeof opacity === 'number' && opacity >= 0 && opacity <= 1) {
          this.currentSettings.opacity = opacity;
        }
      });

      this.eventBus.on('brush:color-changed', ({ color }) => {
        if (typeof color === 'number') {
          const hex = color.toString(16).padStart(6, '0');
          this.currentSettings.color = '#' + hex;
        } else if (typeof color === 'string') {
          this.currentSettings.color = color;
        }
      });

      this.eventBus.on('tool:changed', ({ tool }) => {
        if (['pen', 'eraser', 'fill'].includes(tool)) {
          this.setMode(tool);
        }
      });
    }

    startStroke(localX, localY, pressure = 0.5) {
      if (!this.initialized || this.isDrawing) return;

      const activeLayer = this.layerManager.getActiveLayer();
      if (!activeLayer) return;

      const historyManager = window.History;
      if (historyManager?.beginAction) {
        const actionType = this.currentSettings.mode === 'eraser' ? 'erase' : 'stroke';
        historyManager.beginAction(actionType, {
          layerId: activeLayer.id,
          brushSize: this.currentSettings.size,
          color: this.currentSettings.color
        });
      }

      this.strokeRecorder.startStroke(localX, localY, pressure);
      
      if (this.gpuStrokeProcessor?.resetStream) {
        this.gpuStrokeProcessor.resetStream();
      }

      if (this.currentSettings.mode === 'eraser' && this.webgpuMaskLayer?.startErase) {
        this.webgpuMaskLayer.startErase();
      }
      
      this.isDrawing = true;
      this.currentStroke = {
        layerId: activeLayer.id,
        startTime: Date.now()
      };
      
      this._ensurePreviewContainer(activeLayer);
    }

    async updateStroke(localX, localY, pressure = 0.5) {
      if (!this.initialized || !this.isDrawing) return;
      
      this.strokeRecorder.addPoint(localX, localY, pressure);
      
      const historyManager = window.History;
      if (historyManager?.addPoint) {
        historyManager.addPoint(localX, localY, pressure);
      }

      if (this.currentSettings.mode === 'pen') {
        if (this.gpuStrokeProcessor?.appendPointToStream) {
          this.gpuStrokeProcessor.appendPointToStream(
            localX,
            localY,
            pressure,
            this.currentSettings.size
          );
        }
      }

      if (this.currentSettings.mode === 'eraser') {
        if (this.webgpuMaskLayer?.eraseAppendPoint) {
          const eraserRadius = this.currentSettings.size * Math.max(0.1, pressure) / 2;
          this.webgpuMaskLayer.eraseAppendPoint(localX, localY, eraserRadius);
        }
      }
    }

    /**
     * ✅ 緊急修正: throttle削除、即座実行
     */
    async renderPreview() {
      if (!this.initialized || !this.isDrawing) return;
      
      // ✅ 既に処理中なら新規リクエストをスキップ
      if (this.isPreviewUpdating) return;

      const points = this.strokeRecorder.getRawPoints();
      if (!points || points.length < 2) return;

      const activeLayer = this.layerManager.getActiveLayer();
      if (!activeLayer) return;
      
      this._ensurePreviewContainer(activeLayer);
      
      await this._updatePreview(points);
    }

    async _updatePreview(points) {
      if (!this.previewContainer || this.previewContainer.destroyed) {
        console.warn('[BrushCore] Preview container destroyed');
        return;
      }

      // ✅ ロック取得
      this.isPreviewUpdating = true;

      // 既存プレビュー削除
      if (this.previewSprite && !this.previewSprite.destroyed) {
        this.previewContainer.removeChild(this.previewSprite);
        this.previewSprite.destroy({ children: true });
        this.previewSprite = null;
      }

      try {
        const vertexResult = this.gpuStrokeProcessor.createPolygonVertexBuffer(
          points,
          this.currentSettings.size
        );
        if (!vertexResult?.buffer) {
          console.error('[BrushCore] VertexBuffer creation failed');
          return;
        }

        const edgeResult = this.gpuStrokeProcessor.createEdgeBuffer(
          points,
          this.currentSettings.size
        );
        if (!edgeResult?.buffer) {
          console.error('[BrushCore] EdgeBuffer creation failed');
          return;
        }

        const uploadVertex = this.gpuStrokeProcessor.uploadToGPU(vertexResult.buffer, 'vertex', 7 * 4);
        const uploadEdge = this.gpuStrokeProcessor.uploadToGPU(edgeResult.buffer, 'storage', 8 * 4);

        const bounds = this.gpuStrokeProcessor.calculateBounds(points);
        const width = Math.ceil(bounds.maxX - bounds.minX);
        const height = Math.ceil(bounds.maxY - bounds.minY);

        if (width <= 0 || height <= 0) {
          console.error('[BrushCore] Invalid bounds:', bounds);
          return;
        }

        const previewSettings = {
          mode: this.currentSettings.mode,
          color: this.currentSettings.mode === 'eraser' ? '#ff0000' : this.currentSettings.color,
          opacity: this.currentSettings.mode === 'eraser' ? 0.3 : this.currentSettings.opacity * 0.7,
          size: this.currentSettings.size
        };

        const finalTexture = await this.msdfPipelineManager.generateMSDF(
          uploadEdge.gpuBuffer,
          bounds,
          null,
          previewSettings,
          uploadVertex.gpuBuffer,
          vertexResult.vertexCount,
          edgeResult.edgeCount
        );

        if (!finalTexture) {
          console.error('[BrushCore] MSDF generation failed');
          uploadEdge.gpuBuffer?.destroy();
          uploadVertex.gpuBuffer?.destroy();
          return;
        }

        const sprite = await this.textureBridge.createSpriteFromGPUTexture(
          finalTexture,
          width,
          height
        );

        if (!sprite) {
          console.error('[BrushCore] Sprite creation failed');
          uploadEdge.gpuBuffer?.destroy();
          uploadVertex.gpuBuffer?.destroy();
          finalTexture?.destroy();
          return;
        }

        if (!this.previewContainer || this.previewContainer.destroyed) {
          console.error('[BrushCore] Preview container destroyed during async operation');
          sprite.destroy({ children: true });
          uploadEdge.gpuBuffer?.destroy();
          uploadVertex.gpuBuffer?.destroy();
          finalTexture?.destroy();
          return;
        }

        sprite.x = bounds.minX;
        sprite.y = bounds.minY;
        sprite.alpha = previewSettings.opacity;

        this.previewContainer.addChild(sprite);
        this.previewSprite = sprite;

        uploadEdge.gpuBuffer?.destroy();
        uploadVertex.gpuBuffer?.destroy();
        finalTexture?.destroy();

      } catch (error) {
        console.error('[BrushCore] Preview failed:', error);
      } finally {
        // ✅ ロック解放
        this.isPreviewUpdating = false;
      }
    }

    async finalizeStroke() {
      if (!this.initialized || !this.isDrawing) return;

      const activeLayer = this.layerManager.getActiveLayer();
      
      if (!activeLayer) {
        this._cleanupPreview();
        this.isDrawing = false;
        
        const historyManager = window.History;
        if (historyManager?.endAction) {
          historyManager.endAction();
        }
        return;
      }

      this._cleanupPreview();

      const points = this.strokeRecorder.getRawPoints();
      
      if (!points || points.length < 2) {
        this.strokeRecorder.endStroke();
        this.isDrawing = false;
        
        const historyManager = window.History;
        if (historyManager?.endAction) {
          historyManager.endAction();
        }
        return;
      }

      if (this.currentSettings.mode === 'pen' && this.gpuStrokeProcessor?.finalizeStroke) {
        this.gpuStrokeProcessor.finalizeStroke();
      }

      if (this.currentSettings.mode === 'eraser' && this.webgpuMaskLayer?.finalizeErase) {
        this.webgpuMaskLayer.finalizeErase();
      }

      if (this.msdfAvailable) {
        await this._finalizeMSDFStroke(points, activeLayer);
      }

      this.strokeRecorder.endStroke();
      this.isDrawing = false;
      this.currentStroke = null;

      const historyManager = window.History;
      if (historyManager?.endAction) {
        historyManager.endAction();
      }
    }

    async _finalizeMSDFStroke(points, activeLayer) {
      try {
        const container = this._getLayerContainer(activeLayer);
        if (!container) {
          throw new Error('Container取得失敗');
        }

        const vertexResult = this.gpuStrokeProcessor.createPolygonVertexBuffer(
          points,
          this.currentSettings.size
        );
        if (!vertexResult?.buffer) {
          throw new Error('VertexBuffer作成失敗');
        }

        const edgeResult = this.gpuStrokeProcessor.createEdgeBuffer(
          points,
          this.currentSettings.size
        );
        if (!edgeResult?.buffer) {
          throw new Error('EdgeBuffer作成失敗');
        }

        const uploadVertex = this.gpuStrokeProcessor.uploadToGPU(vertexResult.buffer, 'vertex', 7 * 4);
        const uploadEdge = this.gpuStrokeProcessor.uploadToGPU(edgeResult.buffer, 'storage', 8 * 4);

        const bounds = this.gpuStrokeProcessor.calculateBounds(points);
        const width = Math.ceil(bounds.maxX - bounds.minX);
        const height = Math.ceil(bounds.maxY - bounds.minY);

        if (width <= 0 || height <= 0) return;

        const brushSettings = {
          mode: this.currentSettings.mode,
          color: this.currentSettings.color,
          opacity: this.currentSettings.opacity,
          size: this.currentSettings.size
        };

        const finalTexture = await this.msdfPipelineManager.generateMSDF(
          uploadEdge.gpuBuffer,
          bounds,
          null,
          brushSettings,
          uploadVertex.gpuBuffer,
          vertexResult.vertexCount,
          edgeResult.edgeCount
        );

        if (!finalTexture) {
          throw new Error('MSDF生成失敗');
        }

        if (this.currentSettings.mode === 'eraser') {
          await this._applyEraserMask(activeLayer, bounds);
          
          uploadEdge.gpuBuffer?.destroy();
          uploadVertex.gpuBuffer?.destroy();
          finalTexture?.destroy();
          
          this._emitStrokeEvents(activeLayer, null);
          return;
        }

        const sprite = await this.textureBridge.createSpriteFromGPUTexture(
          finalTexture,
          width,
          height
        );

        if (!sprite) {
          throw new Error('Sprite生成失敗');
        }

        sprite.x = bounds.minX;
        sprite.y = bounds.minY;
        sprite.visible = true;
        sprite.alpha = this.currentSettings.opacity;

        container.addChild(sprite);

        const pathData = {
          id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'stroke_msdf',
          points: points,
          settings: { ...this.currentSettings },
          sprite: sprite,
          bounds: bounds
        };

        if (!activeLayer.paths) activeLayer.paths = [];
        activeLayer.paths.push(pathData);

        this._registerHistory(activeLayer, pathData, container);
        this._emitStrokeEvents(activeLayer, pathData);

        uploadEdge.gpuBuffer?.destroy();
        uploadVertex.gpuBuffer?.destroy();
        finalTexture?.destroy();

      } catch (error) {
        console.error('[BrushCore] MSDF描画失敗:', error);
      }
    }

    async _applyEraserMask(activeLayer, bounds) {
      const container = this._getLayerContainer(activeLayer);
      if (!container?.children) return;

      const eraserPoints = this.strokeRecorder.getRawPoints();
      if (!eraserPoints || eraserPoints.length < 2) return;

      const segmentSize = 5;
      const segments = [];
      
      for (let i = 0; i < eraserPoints.length; i += segmentSize) {
        const segmentPoints = eraserPoints.slice(i, i + segmentSize + 1);
        if (segmentPoints.length < 2) continue;
        
        const segmentBounds = this._calculateSegmentBounds(segmentPoints);
        segments.push(segmentBounds);
      }

      for (const child of container.children) {
        if (!(child instanceof PIXI.Sprite)) continue;

        const spriteBounds = {
          minX: child.x,
          minY: child.y,
          maxX: child.x + child.width,
          maxY: child.y + child.height
        };

        let totalIntersectArea = 0;
        const spriteArea = (spriteBounds.maxX - spriteBounds.minX) * 
                          (spriteBounds.maxY - spriteBounds.minY);

        for (const segmentBounds of segments) {
          const intersectArea = this._calculateIntersectArea(spriteBounds, segmentBounds);
          totalIntersectArea += intersectArea;
        }
        
        if (totalIntersectArea > 0) {
          const intersectRatio = Math.min(1.0, totalIntersectArea / spriteArea);
          child.alpha = Math.max(0, child.alpha - (0.8 * intersectRatio));
          
          if (child.alpha <= 0.01) {
            child.visible = false;
            child.destroy({ children: true });
          }
        }
      }
    }

    _calculateSegmentBounds(points) {
      let minX = Infinity, minY = Infinity;
      let maxX = -Infinity, maxY = -Infinity;

      for (const point of points) {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      }

      const eraserRadius = this.currentSettings.size / 2;
      return {
        minX: minX - eraserRadius,
        minY: minY - eraserRadius,
        maxX: maxX + eraserRadius,
        maxY: maxY + eraserRadius
      };
    }

    _calculateIntersectArea(a, b) {
      const intersectMinX = Math.max(a.minX, b.minX);
      const intersectMinY = Math.max(a.minY, b.minY);
      const intersectMaxX = Math.min(a.maxX, b.maxX);
      const intersectMaxY = Math.min(a.maxY, b.maxY);

      if (intersectMinX >= intersectMaxX || intersectMinY >= intersectMaxY) {
        return 0;
      }

      return (intersectMaxX - intersectMinX) * (intersectMaxY - intersectMinY);
    }

    _ensurePreviewContainer(activeLayer) {
      const container = this._getLayerContainer(activeLayer);
      if (!container) return;

      if (this.previewContainer && this.previewContainer.destroyed) {
        this.previewContainer = null;
      }

      if (!this.previewContainer) {
        this.previewContainer = new PIXI.Container();
        this.previewContainer.name = 'preview_container';
        container.addChild(this.previewContainer);
      }
    }

    _cleanupPreview() {
      if (this.previewSprite && !this.previewSprite.destroyed) {
        this.previewSprite.destroy({ children: true });
        this.previewSprite = null;
      }

      if (this.previewContainer && !this.previewContainer.destroyed) {
        this.previewContainer.destroy({ children: true });
        this.previewContainer = null;
      }
    }

    _getLayerContainer(layer) {
      if (layer.drawingContainer) return layer.drawingContainer;
      if (layer.container) return layer.container;
      if (layer.sprite) return layer.sprite;
      if (Array.isArray(layer.children)) return layer;
      return null;
    }

    _registerHistory(activeLayer, pathData, container) {
      const historyManager = window.History;
      if (!historyManager?.push) return;

      const layerRef = activeLayer;
      const containerRef = container;

      historyManager.push({
        name: 'path:add',
        do: () => {
          if (!layerRef.paths) layerRef.paths = [];
          
          const exists = layerRef.paths.some(p => p.id === pathData.id);
          if (!exists) {
            layerRef.paths.push(pathData);
          }
          
          if (pathData.sprite && !pathData.sprite.destroyed && containerRef) {
            if (!pathData.sprite.parent) {
              containerRef.addChild(pathData.sprite);
            }
          }
        },
        undo: () => {
          const index = layerRef.paths.findIndex(p => p.id === pathData.id);
          if (index !== -1) {
            layerRef.paths.splice(index, 1);
            if (pathData.sprite && !pathData.sprite.destroyed) {
              pathData.sprite.destroy({ children: true });
            }
          }
        },
        meta: {
          type: 'path:add',
          layerId: layerRef.id,
          pathId: pathData.id
        }
      });
    }

    _emitStrokeEvents(layer, pathData) {
      if (!this.eventBus?.emit) return;

      if (pathData) {
        this.eventBus.emit('layer:path-added', {
          layerId: layer.id,
          pathId: pathData.id,
          sprite: pathData.sprite
        });
      }

      this.eventBus.emit('layer:transform-updated', {
        layerId: layer.id,
        immediate: true
      });

      this.eventBus.emit('layer:panel-update-requested', {
        layerId: layer.id
      });
    }

    updateSettings(settings) {
      if (settings.mode !== undefined) this.currentSettings.mode = settings.mode;
      if (settings.color !== undefined) this.currentSettings.color = settings.color;
      if (settings.size !== undefined) this.currentSettings.size = settings.size;
      if (settings.opacity !== undefined) this.currentSettings.opacity = settings.opacity;
    }

    getSettings() {
      return { ...this.currentSettings };
    }

    getMode() {
      return this.currentSettings.mode;
    }

    setMode(mode) {
      if (['pen', 'eraser', 'fill'].includes(mode)) {
        this.currentSettings.mode = mode;
        
        if (this.eventBus?.emit) {
          this.eventBus.emit('brush:mode-changed', { mode });
        }
      }
    }

    isActive() {
      return this.isDrawing;
    }

    getIsDrawing() {
      return this.isDrawing;
    }

    cancelStroke() {
      this._cleanupPreview();
      this.strokeRecorder.reset();
      this.isDrawing = false;
      this.currentStroke = null;

      const historyManager = window.History;
      if (historyManager?.endAction) {
        historyManager.endAction();
      }
    }

    destroy() {
      this._cleanupPreview();
      this.initialized = false;
    }
  }

  window.BrushCore = new BrushCore();

  console.log('✅ brush-core.js フリッカー完全解消版 loaded');
  console.log('   ✅ 非同期ロック機構追加');
  console.log('   ✅ プレビュー多重生成防止');

})();