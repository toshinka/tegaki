/**
 * ================================================================================
 * brush-core.js Phase 3 リアルタイムプレビュー対応版
 * ================================================================================
 * 
 * 【依存Parents】
 * - stroke-recorder.js (座標記録)
 * - gpu-stroke-processor.js (VertexBuffer/EdgeBuffer)
 * - msdf-pipeline-manager.js (MSDF生成)
 * - webgpu-texture-bridge.js (Sprite変換)
 * - layer-system.js (レイヤー管理)
 * - history.js (履歴管理)
 * - coordinate-system.js (座標変換)
 * 
 * 【依存Children】
 * - drawing-engine.js (startStroke/updateStroke呼び出し元)
 * 
 * 【Phase 3改修】
 * 🔧 リアルタイムプレビュー実装（updateStroke時に仮描画）
 * 🔧 座標変換正規化（Bounds原点オフセット適用）
 * 🔧 消しゴム可視化（赤色半透明プレビュー）
 * 🗑️ 過剰ログ削除
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
      this.coordinateSystem = null;
      
      this.isDrawing = false;
      this.currentStroke = null;
      this.previewSprite = null;
      this.previewContainer = null;
      
      this.currentSettings = {
        mode: 'pen',
        color: '#800000',
        size: 3,
        opacity: 1.0
      };
      
      this.initialized = false;
      this.msdfAvailable = false;
      this.lastPreviewTime = 0;
      this.previewThrottle = 50;
    }

    async init() {
      return await this.initialize();
    }

    async initialize() {
      if (this.initialized) return;

      this.strokeRecorder = window.strokeRecorder || window.StrokeRecorder;
      this.layerManager = window.layerManager || window.layerSystem;
      this.coordinateSystem = window.CoordinateSystem;

      if (!this.strokeRecorder) {
        throw new Error('[BrushCore] strokeRecorder not found');
      }
      if (!this.layerManager) {
        throw new Error('[BrushCore] layerManager not found');
      }

      this.gpuStrokeProcessor = window.GPUStrokeProcessor;
      this.msdfPipelineManager = window.MSDFPipelineManager;
      this.textureBridge = window.WebGPUTextureBridge;

      this.msdfAvailable = !!(
        this.gpuStrokeProcessor &&
        this.msdfPipelineManager &&
        this.textureBridge
      );

      if (!this.msdfAvailable) {
        console.error('[BrushCore] MSDF Pipeline not available');
        return;
      }

      this.initialized = true;
    }

    startStroke(localX, localY, pressure = 0.5) {
      if (!this.initialized || this.isDrawing) return;

      const activeLayer = this.layerManager.getActiveLayer();
      if (!activeLayer) return;

      this.strokeRecorder.startStroke(localX, localY, pressure);
      
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

      const now = Date.now();
      if (now - this.lastPreviewTime < this.previewThrottle) return;
      this.lastPreviewTime = now;

      const points = this.strokeRecorder.getRawPoints();
      if (!points || points.length < 2) return;

      await this._updatePreview(points);
    }

    async _updatePreview(points) {
      if (!this.previewContainer) return;

      if (this.previewSprite) {
        this.previewSprite.destroy({ children: true });
        this.previewSprite = null;
      }

      try {
        const vertexResult = this.gpuStrokeProcessor.createPolygonVertexBuffer(points);
        if (!vertexResult || !vertexResult.buffer) return;

        const edgeResult = this.gpuStrokeProcessor.createEdgeBuffer(points);
        if (!edgeResult || !edgeResult.buffer) return;

        const uploadVertex = this.gpuStrokeProcessor.uploadToGPU(vertexResult.buffer, 'vertex', 7 * 4);
        const uploadEdge = this.gpuStrokeProcessor.uploadToGPU(edgeResult.buffer, 'storage', 8 * 4);

        const bounds = this.gpuStrokeProcessor.calculateBounds(points);
        const width = Math.ceil(bounds.maxX - bounds.minX);
        const height = Math.ceil(bounds.maxY - bounds.minY);

        if (width <= 0 || height <= 0) return;

        const previewSettings = {
          mode: this.currentSettings.mode,
          color: this.currentSettings.mode === 'eraser' ? '#ff0000' : this.currentSettings.color,
          opacity: this.currentSettings.mode === 'eraser' ? 0.3 : this.currentSettings.opacity * 0.5,
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

        if (!finalTexture) return;

        const sprite = await this.textureBridge.createSpriteFromGPUTexture(
          finalTexture,
          width,
          height
        );

        if (!sprite) return;

        sprite.x = bounds.minX;
        sprite.y = bounds.minY;
        sprite.alpha = previewSettings.opacity;

        this.previewContainer.addChild(sprite);
        this.previewSprite = sprite;

        if (uploadEdge.gpuBuffer?.destroy) uploadEdge.gpuBuffer.destroy();
        if (uploadVertex.gpuBuffer?.destroy) uploadVertex.gpuBuffer.destroy();
        if (finalTexture?.destroy) finalTexture.destroy();

      } catch (error) {
        console.error('[BrushCore] Preview failed:', error);
      }
    }

    async finalizeStroke() {
      if (!this.initialized || !this.isDrawing) return;

      const activeLayer = this.layerManager.getActiveLayer();
      
      if (!activeLayer) {
        this._cleanupPreview();
        this.isDrawing = false;
        return;
      }

      this._cleanupPreview();

      const points = this.strokeRecorder.getRawPoints();
      
      if (!points || points.length < 2) {
        this.strokeRecorder.endStroke();
        this.isDrawing = false;
        return;
      }

      if (this.msdfAvailable) {
        await this._finalizeMSDFStroke(points, activeLayer);
      }

      this.strokeRecorder.endStroke();
      this.isDrawing = false;
      this.currentStroke = null;
    }

    async _finalizeMSDFStroke(points, activeLayer) {
      try {
        const container = this._getLayerContainer(activeLayer);
        if (!container) {
          throw new Error('Container取得失敗');
        }

        let vertexBuffer = null;
        let vertexCount = 0;
        let gpuVertexBuffer = null;

        const vertexResult = this.gpuStrokeProcessor.createPolygonVertexBuffer(points);
        if (vertexResult && vertexResult.buffer) {
          vertexBuffer = vertexResult.buffer;
          vertexCount = vertexResult.vertexCount;
          
          const uploadResult = this.gpuStrokeProcessor.uploadToGPU(vertexBuffer, 'vertex', 7 * 4);
          gpuVertexBuffer = uploadResult.gpuBuffer;
        }

        const edgeResult = this.gpuStrokeProcessor.createEdgeBuffer(points);
        if (!edgeResult || !edgeResult.buffer) {
          throw new Error('EdgeBuffer作成失敗');
        }

        const uploadResult = this.gpuStrokeProcessor.uploadToGPU(edgeResult.buffer, 'storage', 8 * 4);
        const gpuEdgeBuffer = uploadResult.gpuBuffer;
        const edgeCount = edgeResult.edgeCount;

        if (!gpuEdgeBuffer || edgeCount === 0) {
          throw new Error('GPU転送失敗 or edgeCount=0');
        }

        const bounds = this.gpuStrokeProcessor.calculateBounds(points);
        const width = Math.ceil(bounds.maxX - bounds.minX);
        const height = Math.ceil(bounds.maxY - bounds.minY);

        if (width <= 0 || height <= 0) {
          return;
        }

        const brushSettings = {
          mode: this.currentSettings.mode,
          color: this.currentSettings.color,
          opacity: this.currentSettings.opacity,
          size: this.currentSettings.size
        };

        const finalTexture = await this.msdfPipelineManager.generateMSDF(
          gpuEdgeBuffer,
          bounds,
          null,
          brushSettings,
          gpuVertexBuffer,
          vertexCount,
          edgeCount
        );

        if (!finalTexture) {
          throw new Error('MSDF生成失敗');
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

        if (gpuEdgeBuffer && gpuEdgeBuffer.destroy) gpuEdgeBuffer.destroy();
        if (gpuVertexBuffer && gpuVertexBuffer.destroy) gpuVertexBuffer.destroy();
        if (finalTexture && finalTexture.destroy) finalTexture.destroy();

      } catch (error) {
        console.error('[BrushCore] MSDF描画失敗:', error);
      }
    }

    _ensurePreviewContainer(activeLayer) {
      const container = this._getLayerContainer(activeLayer);
      if (!container) return;

      if (!this.previewContainer) {
        this.previewContainer = new PIXI.Container();
        this.previewContainer.name = 'preview_container';
        container.addChild(this.previewContainer);
      }
    }

    _cleanupPreview() {
      if (this.previewSprite) {
        this.previewSprite.destroy({ children: true });
        this.previewSprite = null;
      }

      if (this.previewContainer) {
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
      if (!historyManager || !historyManager.push) return;

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
      const eventBus = window.TegakiEventBus || window.eventBus;
      if (!eventBus || !eventBus.emit) return;

      eventBus.emit('layer:path-added', {
        layerId: layer.id,
        pathId: pathData.id,
        sprite: pathData.sprite
      });

      eventBus.emit('layer:transform-updated', {
        layerId: layer.id,
        immediate: true
      });

      eventBus.emit('layer:panel-update-requested', {
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
        
        const eventBus = window.TegakiEventBus;
        if (eventBus && eventBus.emit) {
          eventBus.emit('brush:mode-changed', { mode });
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
    }

    destroy() {
      this._cleanupPreview();
      this.initialized = false;
    }
  }

  window.BrushCore = new BrushCore();

})();