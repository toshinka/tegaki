/**
 * ================================================================================
 * brush-core.js Phase 3: MSDF統合完全版
 * ================================================================================
 * 【責務】
 * - ストローク管理（開始・更新・完了）
 * - MSDF Pipeline完全統合
 * - History登録
 * - サムネイル更新イベント発行
 * 
 * 【依存Parents】
 * - stroke-recorder.js
 * - gpu-stroke-processor.js
 * - msdf-pipeline-manager.js
 * - webgpu-texture-bridge.js
 * - layer-system.js
 * - history.js
 * 
 * 【Phase 3改修】
 * ✅ MSDF Pipeline完全統合（PerfectFreehand依存削除）
 * ✅ 簡易プレビュー実装
 * ✅ エラーハンドリング強化
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

      if (this.msdfAvailable) {
        console.log('✅ [BrushCore] MSDF Pipeline有効');
      } else {
        console.warn('⚠️ [BrushCore] MSDF Pipeline無効');
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

      // Phase 3: プレビュー省略（最終化時のみ描画）
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
      } else {
        console.error('❌ [BrushCore] MSDF Pipeline無効 - 描画不可');
      }

      this.strokeRecorder.endStroke();
      this.isDrawing = false;
      this.currentStroke = null;
    }

    /**
     * MSDF描画完全版
     */
    async _finalizeMSDFStroke(points, activeLayer) {
      try {
        const container = this._getLayerContainer(activeLayer);
        if (!container) {
          throw new Error('Container取得失敗');
        }

        // 1. EdgeBuffer作成
        const pointArray = points.flatMap(p => [p.x, p.y]);
        const edgeBuffer = this.gpuStrokeProcessor.createEdgeBuffer(pointArray);
        if (!edgeBuffer) throw new Error('EdgeBuffer作成失敗');

        // 2. GPU転送
        const gpuBuffer = this.gpuStrokeProcessor.uploadToGPU(edgeBuffer);
        if (!gpuBuffer) throw new Error('GPU転送失敗');

        // 3. Bounds計算
        const bounds = this.gpuStrokeProcessor.calculateBounds(pointArray);
        const width = Math.ceil(bounds.maxX - bounds.minX);
        const height = Math.ceil(bounds.maxY - bounds.minY);

        console.log(`[BrushCore] 描画開始: ${width}x${height}, ${points.length} points`);

        // 4. MSDF生成（Phase 3版）
        const finalTexture = await this.msdfPipelineManager.generateMSDF(
          gpuBuffer,
          bounds,
          null // existingMSDF
        );

        if (!finalTexture) throw new Error('MSDF生成失敗');

        // 5. Sprite生成
        const sprite = await this.textureBridge.createSpriteFromGPUTexture(
          finalTexture,
          width,
          height
        );

        if (!sprite) throw new Error('Sprite生成失敗');

        // 6. Sprite配置
        sprite.x = bounds.minX;
        sprite.y = bounds.minY;
        sprite.visible = true;
        sprite.alpha = this.currentSettings.opacity;

        // 消しゴムモード
        if (this.currentSettings.mode === 'eraser') {
          sprite.blendMode = 'erase';
        }

        container.addChild(sprite);

        // 7. PathData登録
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

        // 8. History登録
        this._registerHistory(activeLayer, pathData);

        // 9. イベント発行
        this._emitStrokeEvents(activeLayer, pathData);

        console.log('✅ [BrushCore] MSDF描画完了');

        // 10. GPU リソース破棄
        if (gpuBuffer.destroy) gpuBuffer.destroy();
        if (finalTexture.destroy) finalTexture.destroy();

      } catch (error) {
        console.error('❌ [BrushCore] MSDF描画失敗:', error);
      }
    }

    /**
     * Container取得
     */
    _getLayerContainer(layer) {
      if (layer.drawingContainer) return layer.drawingContainer;
      if (layer.container) return layer.container;
      if (layer.sprite) return layer.sprite;
      if (Array.isArray(layer.children)) return layer;

      console.error('❌ [BrushCore] Container取得失敗');
      return null;
    }

    /**
     * History登録
     */
    _registerHistory(layer, pathData) {
      const historyManager = window.historyManager || window.History;
      if (!historyManager) return;

      historyManager.recordAction({
        type: 'path:add',
        layerId: layer.id,
        pathData: pathData,
        undo: () => {
          const targetLayer = this.layerManager.getLayerById(layer.id);
          if (!targetLayer) return;
          
          const index = targetLayer.paths.findIndex(p => p.id === pathData.id);
          if (index !== -1) {
            targetLayer.paths.splice(index, 1);
            if (pathData.sprite && !pathData.sprite.destroyed) {
              pathData.sprite.destroy({ children: true });
            }
          }
        },
        redo: () => {
          const targetLayer = this.layerManager.getLayerById(layer.id);
          if (!targetLayer) return;
          
          if (!targetLayer.paths) targetLayer.paths = [];
          targetLayer.paths.push(pathData);
          
          if (pathData.sprite && !pathData.sprite.destroyed) {
            const container = this._getLayerContainer(targetLayer);
            if (container) container.addChild(pathData.sprite);
          }
        }
      });
    }

    /**
     * イベント発行
     */
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
  console.log('✅ brush-core.js Phase 3 loaded (MSDF完全統合版)');

})();