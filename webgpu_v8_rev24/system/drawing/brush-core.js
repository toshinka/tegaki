/**
 * ================================================================================
 * brush-core.js Phase 3.6完全動作版
 * ================================================================================
 * 📁 Parents: stroke-recorder.js, gpu-stroke-processor.js, msdf-pipeline-manager.js,
 *             webgpu-texture-bridge.js, layer-system.js, history.js
 * 📄 Children: drawing-engine.js
 * 
 * 🔧 Phase 3.6修正:
 *   - window.layerManager使用確定
 *   - getLayerById存在確認 + 代替手段実装
 *   - History登録をlayer参照で直接実装
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

      this.strokeRecorder = window.strokeRecorder;
      this.layerManager = window.layerManager;

      if (!this.strokeRecorder) throw new Error('strokeRecorder not found');
      if (!this.layerManager) throw new Error('layerManager not found');

      this.gpuStrokeProcessor = window.GPUStrokeProcessor;
      this.msdfPipelineManager = window.MSDFPipelineManager;
      this.textureBridge = window.WebGPUTextureBridge;

      this.msdfAvailable = !!(
        this.gpuStrokeProcessor &&
        this.msdfPipelineManager &&
        this.textureBridge
      );

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

    async _finalizeMSDFStroke(points, activeLayer) {
      try {
        const container = this._getLayerContainer(activeLayer);
        if (!container) throw new Error('Container取得失敗');

        const pointArray = points.flatMap(p => [p.x, p.y]);
        const edgeBuffer = this.gpuStrokeProcessor.createEdgeBuffer(pointArray);
        if (!edgeBuffer) throw new Error('EdgeBuffer作成失敗');

        const gpuBuffer = this.gpuStrokeProcessor.uploadToGPU(edgeBuffer);
        if (!gpuBuffer) throw new Error('GPU転送失敗');

        const bounds = this.gpuStrokeProcessor.calculateBounds(pointArray);
        const width = Math.ceil(bounds.maxX - bounds.minX);
        const height = Math.ceil(bounds.maxY - bounds.minY);

        const finalTexture = await this.msdfPipelineManager.generateMSDF(
          gpuBuffer,
          bounds,
          null
        );

        if (!finalTexture) throw new Error('MSDF生成失敗');

        const sprite = await this.textureBridge.createSpriteFromGPUTexture(
          finalTexture,
          width,
          height
        );

        if (!sprite) throw new Error('Sprite生成失敗');

        sprite.x = bounds.minX;
        sprite.y = bounds.minY;
        sprite.visible = true;
        sprite.alpha = this.currentSettings.opacity;

        if (this.currentSettings.mode === 'eraser') {
          sprite.blendMode = 'erase';
        }

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

        if (gpuBuffer.destroy) gpuBuffer.destroy();
        if (finalTexture.destroy) finalTexture.destroy();

      } catch (error) {
        console.error('❌ [BrushCore] MSDF描画失敗:', error);
      }
    }

    _getLayerContainer(layer) {
      if (layer.drawingContainer) return layer.drawingContainer;
      if (layer.container) return layer.container;
      if (layer.sprite) return layer.sprite;
      if (Array.isArray(layer.children)) return layer;
      return null;
    }

    /**
     * History登録
     * 🔧 Phase 3.6: layer参照を直接使用（getLayerById不使用）
     */
    _registerHistory(activeLayer, pathData, container) {
      const historyManager = window.History;
      if (!historyManager || !historyManager.push) return;

      // 🔧 activeLayer参照をクロージャでキャプチャ
      const layerRef = activeLayer;
      const containerRef = container;

      historyManager.push({
        name: 'path:add',
        do: () => {
          // 🔧 直接layer参照を使用
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
  console.log('✅ brush-core.js Phase 3.6 loaded');

})();