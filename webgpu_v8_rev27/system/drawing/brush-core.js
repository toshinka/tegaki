/**
 * ================================================================================
 * brush-core.js Phase 3 完全統合版 - VertexBuffer対応
 * ================================================================================
 * 
 * 【依存Parents】
 * - stroke-recorder.js (座標記録)
 * - gpu-stroke-processor.js (VertexBuffer/EdgeBuffer生成)
 * - msdf-pipeline-manager.js (MSDF生成)
 * - webgpu-texture-bridge.js (Sprite変換)
 * - layer-system.js (レイヤー管理)
 * - history.js (履歴管理)
 * 
 * 【依存Children】
 * - drawing-engine.js (startStroke/updateStroke呼び出し元)
 * 
 * 【Phase 3改修完了】
 * ✅ VertexBuffer生成対応
 * ✅ EdgeBuffer Fallback維持
 * ✅ 過剰ログ削除
 * ✅ DRY原則遵守
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
      
      this.isDrawing = false;
      this.currentStroke = null;
      this.previewSprite = null;
      
      this.currentSettings = {
        mode: 'pen',
        color: '#800000',
        size: 3,
        opacity: 1.0
      };
      
      this.initialized = false;
      this.msdfAvailable = false;
    }

    async init() {
      return await this.initialize();
    }

    async initialize() {
      if (this.initialized) return;

      this.strokeRecorder = window.strokeRecorder || window.StrokeRecorder;
      this.layerManager = window.layerManager || window.layerSystem;

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
    }

    async updateStroke(localX, localY, pressure = 0.5) {
      if (!this.initialized || !this.isDrawing) return;
      this.strokeRecorder.addPoint(localX, localY, pressure);
    }

    async finalizeStroke() {
      if (!this.initialized || !this.isDrawing) return;

      const activeLayer = this.layerManager.getActiveLayer();
      
      if (!activeLayer) {
        this.isDrawing = false;
        return;
      }

      if (this.previewSprite) {
        this.previewSprite.destroy({ children: true });
        this.previewSprite = null;
      }

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

    /**
     * MSDF描画（Phase 3: VertexBuffer優先）
     * @private
     */
    async _finalizeMSDFStroke(points, activeLayer) {
      try {
        const container = this._getLayerContainer(activeLayer);
        if (!container) {
          throw new Error('Container取得失敗');
        }

        // Phase 3: VertexBuffer生成試行
        let vertexBuffer = null;
        let vertexCount = 0;
        let gpuVertexBuffer = null;

        const vertexResult = this.gpuStrokeProcessor.createPolygonVertexBuffer(points);
        if (vertexResult && vertexResult.buffer) {
          vertexBuffer = vertexResult.buffer;
          vertexCount = vertexResult.vertexCount;
          
          // GPU転送（VERTEX usage）
          gpuVertexBuffer = this.gpuStrokeProcessor.uploadToGPU(vertexBuffer, 'vertex');
        }

        // EdgeBuffer生成（Seed初期化用）
        const edgeBuffer = this.gpuStrokeProcessor.createEdgeBuffer(points);
        if (!edgeBuffer) {
          throw new Error('EdgeBuffer作成失敗');
        }

        const gpuEdgeBuffer = this.gpuStrokeProcessor.uploadToGPU(edgeBuffer, 'storage');
        if (!gpuEdgeBuffer) {
          throw new Error('GPU転送失敗');
        }

        // Bounds計算
        const bounds = this.gpuStrokeProcessor.calculateBounds(points);
        const width = Math.ceil(bounds.maxX - bounds.minX);
        const height = Math.ceil(bounds.maxY - bounds.minY);

        if (width <= 0 || height <= 0) {
          return;
        }

        // ブラシ設定
        const brushSettings = {
          mode: this.currentSettings.mode,
          color: this.currentSettings.color,
          opacity: this.currentSettings.opacity,
          size: this.currentSettings.size
        };

        // MSDF生成（Phase 3: VertexBuffer渡す）
        const finalTexture = await this.msdfPipelineManager.generateMSDF(
          gpuEdgeBuffer,
          bounds,
          null,
          brushSettings,
          gpuVertexBuffer,
          vertexCount
        );

        if (!finalTexture) {
          throw new Error('MSDF生成失敗');
        }

        // Sprite生成
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

        if (this.currentSettings.mode === 'eraser') {
          sprite.blendMode = 'erase';
        }

        container.addChild(sprite);

        // PathData作成
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

        // History登録
        this._registerHistory(activeLayer, pathData, container);

        // イベント発行
        this._emitStrokeEvents(activeLayer, pathData);

        // GPUリソース解放
        if (gpuEdgeBuffer && gpuEdgeBuffer.destroy) gpuEdgeBuffer.destroy();
        if (gpuVertexBuffer && gpuVertexBuffer.destroy) gpuVertexBuffer.destroy();
        if (finalTexture && finalTexture.destroy) finalTexture.destroy();

      } catch (error) {
        console.error('[BrushCore] MSDF描画失敗:', error);
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
      if (this.previewSprite) {
        this.previewSprite.destroy({ children: true });
        this.previewSprite = null;
      }
      
      this.strokeRecorder.reset();
      this.isDrawing = false;
      this.currentStroke = null;
    }

    destroy() {
      if (this.previewSprite) {
        this.previewSprite.destroy({ children: true });
      }
      this.initialized = false;
    }
  }

  window.BrushCore = new BrushCore();

})();