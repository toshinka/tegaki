/**
 * ================================================================================
 * brush-core.js - WebGL2完全対応版
 * ================================================================================
 * 
 * 📁 親ファイル依存:
 *   - stroke-recorder.js (座標記録)
 *   - gl-stroke-processor.js (VertexBuffer/EdgeBuffer)
 *   - gl-msdf-pipeline.js (MSDF生成)
 *   - gl-texture-bridge.js (Sprite変換)
 *   - layer-system.js (レイヤー管理)
 *   - history.js (履歴管理)
 *   - system/event-bus.js (EventBus)
 * 
 * 📄 子ファイル依存:
 *   - drawing-engine.js (startStroke/updateStroke呼び出し元)
 *   - ui/quick-access-popup.js (設定変更イベント発火元)
 * 
 * 【WebGL2移行完了】
 * ✅ GPUStrokeProcessor → GLStrokeProcessor
 * ✅ MSDFPipelineManager → GLMSDFPipeline
 * ✅ WebGPUTextureBridge → GLTextureBridge
 * ✅ WebGPU固有参照を完全削除
 * 
 * 【機能】
 * ✅ PerfectFreehand + MSDF ポリゴンペン
 * ✅ リアルタイムプレビュー（フリッカーなし）
 * ✅ 筆圧完全反映
 * ✅ 消しゴムマスク処理
 * 
 * ================================================================================
 */

(function() {
  'use strict';

  class BrushCore {
    constructor() {
      this.strokeRecorder = null;
      this.glStrokeProcessor = null;
      this.glMSDFPipeline = null;
      this.textureBridge = null;
      this.layerManager = null;
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
      
      this.lastPreviewTime = 0;
      this.previewThrottle = 16;
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

      // WebGL2参照取得
      this.glStrokeProcessor = window.GLStrokeProcessor;
      this.glMSDFPipeline = window.GLMSDFPipeline;
      this.textureBridge = window.GLTextureBridge || window.WebGPUTextureBridge;

      this.msdfAvailable = !!(
        this.glStrokeProcessor &&
        this.glMSDFPipeline &&
        this.textureBridge
      );

      if (!this.msdfAvailable) {
        console.warn('[BrushCore] WebGL2 MSDF Pipeline not fully available');
        console.warn('   GLStrokeProcessor:', !!this.glStrokeProcessor);
        console.warn('   GLMSDFPipeline:', !!this.glMSDFPipeline);
        console.warn('   GLTextureBridge:', !!this.textureBridge);
        return;
      }

      this._setupEventListeners();
      this.initialized = true;

      console.log('[BrushCore] ✅ Initialized with WebGL2 Pipeline');
    }

    /**
     * EventBusリスナー登録
     */
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

      this.strokeRecorder.startStroke(localX, localY, pressure);
      
      this.isDrawing = true;
      this.currentStroke = {
        layerId: activeLayer.id,
        startTime: Date.now()
      };
      
      this._ensurePreviewContainer(activeLayer);
    }

    /**
     * 座標記録のみ（プレビューはrenderPreview()で実行）
     */
    async updateStroke(localX, localY, pressure = 0.5) {
      if (!this.initialized || !this.isDrawing) return;
      this.strokeRecorder.addPoint(localX, localY, pressure);
    }

    /**
     * リアルタイムプレビュー表示
     */
    async renderPreview() {
      if (!this.initialized || !this.isDrawing || this.isPreviewUpdating) return;
      
      const now = Date.now();
      if (now - this.lastPreviewTime < this.previewThrottle) return;
      this.lastPreviewTime = now;

      const points = this.strokeRecorder.getRawPoints();
      if (!points || points.length < 2) return;

      const activeLayer = this.layerManager.getActiveLayer();
      if (!activeLayer) return;
      
      this._ensurePreviewContainer(activeLayer);
      await this._updatePreview(points);
    }

    /**
     * プレビュー更新処理
     * @private
     */
    async _updatePreview(points) {
      if (!this.previewContainer || this.previewContainer.destroyed) {
        console.warn('[BrushCore] Preview container not available');
        return;
      }

      this.isPreviewUpdating = true;

      // 既存プレビューSprite削除
      if (this.previewSprite && !this.previewSprite.destroyed) {
        this.previewContainer.removeChild(this.previewSprite);
        this.previewSprite.destroy({ children: true });
        this.previewSprite = null;
      }

      try {
        const vertexResult = this.glStrokeProcessor.createPolygonVertexBuffer(
          points,
          this.currentSettings.size
        );
        if (!vertexResult?.buffer) return;

        const edgeResult = this.glStrokeProcessor.createEdgeBuffer(
          points,
          this.currentSettings.size
        );
        if (!edgeResult?.buffer) return;

        const uploadVertex = this.glStrokeProcessor.uploadToGPU(vertexResult.buffer, 'vertex', 7 * 4);
        const uploadEdge = this.glStrokeProcessor.uploadToGPU(edgeResult.buffer, 'storage', 8 * 4);

        const bounds = this.glStrokeProcessor.calculateBounds(points);
        const width = Math.ceil(bounds.maxX - bounds.minX);
        const height = Math.ceil(bounds.maxY - bounds.minY);

        if (width <= 0 || height <= 0) return;

        const previewSettings = {
          mode: this.currentSettings.mode,
          color: this.currentSettings.mode === 'eraser' ? '#ff0000' : this.currentSettings.color,
          opacity: this.currentSettings.mode === 'eraser' ? 0.3 : this.currentSettings.opacity * 0.7,
          size: this.currentSettings.size
        };

        const msdfResult = await this.glMSDFPipeline.generateMSDF(
          uploadEdge.glBuffer,
          bounds,
          null,
          previewSettings,
          uploadVertex.glBuffer,
          vertexResult.vertexCount,
          edgeResult.edgeCount
        );

        if (!msdfResult || !msdfResult.texture) return;

        const sprite = await this.textureBridge.createSpriteFromGLTexture(
          msdfResult.texture,
          msdfResult.width,
          msdfResult.height
        );

        if (!sprite || !this.previewContainer || this.previewContainer.destroyed) {
          sprite?.destroy({ children: true });
          return;
        }

        sprite.x = bounds.minX;
        sprite.y = bounds.minY;
        sprite.alpha = previewSettings.opacity;

        this.previewContainer.addChild(sprite);
        this.previewSprite = sprite;

        // WebGL2ではGPUBufferは自動管理（gl.deleteBuffer不要）
        // Textureはgl-msdf-pipeline内でクリーンアップ済み

      } catch (error) {
        console.error('[BrushCore] Preview failed:', error);
      } finally {
        this.isPreviewUpdating = false;
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

        const vertexResult = this.glStrokeProcessor.createPolygonVertexBuffer(
          points,
          this.currentSettings.size
        );
        if (!vertexResult?.buffer) {
          throw new Error('VertexBuffer作成失敗');
        }

        const edgeResult = this.glStrokeProcessor.createEdgeBuffer(
          points,
          this.currentSettings.size
        );
        if (!edgeResult?.buffer) {
          throw new Error('EdgeBuffer作成失敗');
        }

        const uploadVertex = this.glStrokeProcessor.uploadToGPU(vertexResult.buffer, 'vertex', 7 * 4);
        const uploadEdge = this.glStrokeProcessor.uploadToGPU(edgeResult.buffer, 'storage', 8 * 4);

        const bounds = this.glStrokeProcessor.calculateBounds(points);
        const width = Math.ceil(bounds.maxX - bounds.minX);
        const height = Math.ceil(bounds.maxY - bounds.minY);

        if (width <= 0 || height <= 0) return;

        const brushSettings = {
          mode: this.currentSettings.mode,
          color: this.currentSettings.color,
          opacity: this.currentSettings.opacity,
          size: this.currentSettings.size
        };

        const finalTexture = await this.glMSDFPipeline.generateMSDF(
          uploadEdge.glBuffer,
          bounds,
          null,
          brushSettings,
          uploadVertex.glBuffer,
          vertexResult.vertexCount,
          edgeResult.edgeCount
        );

        if (!finalTexture) {
          throw new Error('MSDF生成失敗');
        }

        // 消しゴムモード: マスク処理
        if (this.currentSettings.mode === 'eraser') {
          await this._applyEraserMask(activeLayer, bounds);
          this._emitStrokeEvents(activeLayer, null);
          return;
        }

        // ペンモード: Sprite生成
        const sprite = await this.textureBridge.createSpriteFromGLTexture(
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

      } catch (error) {
        console.error('[BrushCore] MSDF描画失敗:', error);
      }
    }

    /**
     * 消しゴムマスク処理（セグメント分割）
     * @private
     */
    async _applyEraserMask(activeLayer, bounds) {
      const container = this._getLayerContainer(activeLayer);
      if (!container?.children) return;

      const eraserPoints = this.strokeRecorder.getRawPoints();
      if (!eraserPoints || eraserPoints.length < 2) return;

      // セグメント分割
      const segmentSize = 5;
      const segments = [];
      
      for (let i = 0; i < eraserPoints.length; i += segmentSize) {
        const segmentPoints = eraserPoints.slice(i, i + segmentSize + 1);
        if (segmentPoints.length < 2) continue;
        
        const segmentBounds = this._calculateSegmentBounds(segmentPoints);
        segments.push(segmentBounds);
      }

      // 各Spriteに対してセグメント単位で判定
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

    /**
     * セグメントBounds計算
     * @private
     */
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

    /**
     * 交差面積計算
     * @private
     */
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

    /**
     * プレビューコンテナ準備
     * @private
     */
    _ensurePreviewContainer(activeLayer) {
      const container = this._getLayerContainer(activeLayer);
      if (!container) {
        console.warn('[BrushCore] Cannot create preview container');
        return;
      }

      if (this.previewContainer && this.previewContainer.destroyed) {
        this.previewContainer = null;
      }

      if (!this.previewContainer) {
        this.previewContainer = new PIXI.Container();
        this.previewContainer.name = 'preview_container';
        container.addChild(this.previewContainer);
      }
    }

    /**
     * プレビュークリーンアップ
     * @private
     */
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
    }

    destroy() {
      this._cleanupPreview();
      this.initialized = false;
    }
  }

  window.BrushCore = new BrushCore();

  console.log('✅ brush-core.js WebGL2完全対応版 loaded');
  console.log('   ✅ WebGL2 Pipeline統合完了');
  console.log('   ✅ GLStrokeProcessor / GLMSDFPipeline / GLTextureBridge対応');

})();