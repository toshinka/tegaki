/**
 * ================================================================================
 * system/drawing/brush-core.js
 * Phase 2.1: Container取得修正 - Sprite可視化確実化
 * ================================================================================
 * 
 * 【責務】
 * - ストローク管理（開始・更新・完了）
 * - StrokeRecorder/StrokeRenderer連携
 * - History登録（統一窓口）
 * - MSDF Pipeline呼び出し
 * 
 * 【依存Parents】
 * - stroke-recorder.js (window.strokeRecorder)
 * - stroke-renderer.js (window.strokeRenderer)
 * - gpu-stroke-processor.js (window.gpuStrokeProcessor)
 * - msdf-pipeline-manager.js (window.msdfPipelineManager)
 * - webgpu-texture-bridge.js (window.WebGPUTextureBridge)
 * - layer-system.js (window.layerManager)
 * - history.js (window.historyManager)
 * 
 * 【依存Children】
 * - drawing-engine.js
 * 
 * 【Phase 2.1改修】
 * ✅ Container取得ロジック簡潔化
 * ✅ Sprite追加確実化
 * ✅ エラーハンドリング強化
 * 
 * ================================================================================
 */

(function() {
  'use strict';

  class BrushCore {
    constructor() {
      this.strokeRecorder = null;
      this.strokeRenderer = null;
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
      this.initializationPromise = null;
      this.msdfAvailable = false;
    }

    async init() {
      return await this.initialize();
    }

    async initialize() {
      if (this.initialized) return;
      if (this.initializationPromise) return this.initializationPromise;

      this.initializationPromise = (async () => {
        this.strokeRecorder = window.strokeRecorder;
        this.strokeRenderer = window.strokeRenderer;
        this.layerManager = window.layerManager;

        if (!this.strokeRecorder) {
          throw new Error('strokeRecorder not found');
        }
        if (!this.strokeRenderer) {
          throw new Error('strokeRenderer not found');
        }
        if (!this.layerManager) {
          throw new Error('layerManager not found');
        }

        if (this.strokeRenderer.initialize) {
          await this.strokeRenderer.initialize();
        }

        this.gpuStrokeProcessor = window.gpuStrokeProcessor;
        this.msdfPipelineManager = window.msdfPipelineManager;
        this.textureBridge = window.WebGPUTextureBridge;

        this.msdfAvailable = !!(
          this.gpuStrokeProcessor?.initialized &&
          this.msdfPipelineManager?.initialized
        );

        if (this.msdfAvailable) {
          console.log('✅ [BrushCore] MSDF Pipeline有効');
        }

        this.initialized = true;
      })();

      return this.initializationPromise;
    }

    startStroke(localX, localY, pressure = 0.5) {
      if (!this.initialized) return;
      if (this.isDrawing) return;

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

      const activeLayer = this.layerManager.getActiveLayer();
      if (!activeLayer) return;

      const points = this.strokeRecorder.getRawPoints();
      if (points.length < 2) return;

      // PerfectFreehand互換形式取得
      const pfPoints = this.strokeRecorder.getPointsForPerfectFreehand();
      
      // perfect-freehandライブラリの確認
      if (!window.getStroke) {
        return;
      }

      const polygon = window.getStroke(pfPoints, {
        size: this.currentSettings.size * 2,
        thinning: 0,
        smoothing: 0,
        streamline: 0,
        simulatePressure: false,
        last: false
      });

      if (!polygon || polygon.length < 6) return;

      if (this.previewSprite) {
        this.previewSprite.destroy({ children: true });
        this.previewSprite = null;
      }

      try {
        const flatPolygon = polygon.flat();
        this.previewSprite = await this.strokeRenderer.renderPreview(
          flatPolygon,
          this.currentSettings,
          activeLayer.container
        );
      } catch (error) {
        console.error('❌ [BrushCore] Preview render failed:', error);
      }
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
        await this._finalizeLegacyStroke(points, activeLayer);
      }

      this.strokeRecorder.endStroke();
      this.isDrawing = false;
      this.currentStroke = null;
    }

    /**
     * ✅ MSDF Phase 2.1: Container取得修正版
     */
    async _finalizeMSDFStroke(points, activeLayer) {
      try {
        // 1. Container取得（簡潔化）
        const container = this._getLayerContainer(activeLayer);
        if (!container) {
          throw new Error('Cannot find valid container for layer');
        }

        // 2. EdgeBuffer作成
        const edgeBuffer = this.gpuStrokeProcessor.createEdgeBuffer(points);

        // 3. GPU転送
        const gpuBuffer = this.gpuStrokeProcessor.uploadToGPU(edgeBuffer);

        // 4. Bounds計算
        const bounds = this._calculatePointsBounds(points);
        const width = Math.ceil(bounds.maxX - bounds.minX);
        const height = Math.ceil(bounds.maxY - bounds.minY);

        // 5. MSDF生成
        const renderTexture = this.msdfPipelineManager.generateMSDF(
          gpuBuffer,
          bounds,
          null
        );

        // 6. Sprite生成
        const sprite = await this.textureBridge.createSpriteFromGPUTexture(
          renderTexture,
          width,
          height
        );

        // 7. Sprite配置
        sprite.x = bounds.minX;
        sprite.y = bounds.minY;
        sprite.visible = true;
        sprite.alpha = this.currentSettings.opacity;

        // 8. Container追加
        container.addChild(sprite);

        // 9. PathData登録
        const pathData = {
          id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'stroke_msdf',
          points: points,
          settings: { ...this.currentSettings },
          sprite: sprite,
          bounds: bounds
        };

        if (!activeLayer.paths) {
          activeLayer.paths = [];
        }
        activeLayer.paths.push(pathData);

        // 10. History登録
        this._registerHistory(activeLayer, pathData);

        // 11. イベント発行
        this._emitStrokeEvents(activeLayer, pathData);

        // 12. GPU リソース破棄
        gpuBuffer.destroy();
        renderTexture.destroy();

      } catch (error) {
        console.error('❌ [BrushCore] MSDF描画失敗:', error);
        await this._finalizeLegacyStroke(points, activeLayer);
      }
    }

    /**
     * ✅ Container取得ヘルパー（簡潔化）
     */
    _getLayerContainer(layer) {
      // 優先順: container → children存在 → sprite
      if (layer.container) {
        return layer.container;
      }
      
      if (layer.children !== undefined && Array.isArray(layer.children)) {
        return layer;
      }
      
      if (layer.sprite) {
        return layer.sprite;
      }

      console.error('❌ [BrushCore] No valid container found:', {
        hasContainer: !!layer.container,
        hasChildren: layer.children !== undefined,
        hasSprite: !!layer.sprite,
        layerKeys: Object.keys(layer)
      });

      return null;
    }

    /**
     * ✅ Legacy描画フロー
     */
    async _finalizeLegacyStroke(points, activeLayer) {
      try {
        const container = this._getLayerContainer(activeLayer);
        if (!container) {
          throw new Error('Cannot find valid container for layer');
        }

        // PerfectFreehand変換
        const pfPoints = points.map(p => [p.x, p.y, p.pressure]);
        
        if (!window.getStroke) {
          throw new Error('PerfectFreehand (getStroke) not available');
        }

        const polygon = window.getStroke(pfPoints, {
          size: this.currentSettings.size * 2,
          thinning: 0,
          smoothing: 0,
          streamline: 0,
          simulatePressure: false,
          last: true
        });

        if (!polygon || polygon.length < 6) {
          return;
        }

        const flatPolygon = polygon.flat();
        
        const sprite = await this.strokeRenderer.renderFinalStroke(
          { polygon: flatPolygon, points: points },
          this.currentSettings,
          container
        );

        if (!sprite) {
          throw new Error('Failed to create sprite');
        }

        const pathData = {
          id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'stroke',
          polygon: flatPolygon,
          points: points,
          settings: { ...this.currentSettings },
          sprite: sprite,
          bounds: this._calculateBounds(flatPolygon)
        };

        if (!activeLayer.paths) {
          activeLayer.paths = [];
        }
        activeLayer.paths.push(pathData);

        this._registerHistory(activeLayer, pathData);
        this._emitStrokeEvents(activeLayer, pathData);

      } catch (error) {
        console.error('❌ [BrushCore] Legacy描画失敗:', error);
      }
    }

    /**
     * History登録ヘルパー
     */
    _registerHistory(layer, pathData) {
      const historyManager = window.historyManager;
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
            if (container) {
              container.addChild(pathData.sprite);
            }
          }
        }
      });
    }

    /**
     * イベント発行ヘルパー
     */
    _emitStrokeEvents(layer, pathData) {
      const eventBus = window.eventBus || window.EventBus?.getInstance?.();
      if (!eventBus) return;

      const emit = eventBus.emit || eventBus.dispatchEvent;
      if (!emit) return;

      emit.call(eventBus, 'layer:path-added', {
        layerId: layer.id,
        pathId: pathData.id
      });

      emit.call(eventBus, 'thumbnail:layer-updated', {
        layerId: layer.id
      });
    }

    _calculatePointsBounds(points) {
      let minX = Infinity, minY = Infinity;
      let maxX = -Infinity, maxY = -Infinity;

      for (const point of points) {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      }

      return { minX, minY, maxX, maxY };
    }

    _calculateBounds(polygon) {
      let minX = Infinity, minY = Infinity;
      let maxX = -Infinity, maxY = -Infinity;

      for (let i = 0; i < polygon.length; i += 2) {
        const x = polygon[i];
        const y = polygon[i + 1];
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }

      return { minX, minY, maxX, maxY };
    }

    updateSettings(settings) {
      if (settings.mode !== undefined) {
        this.currentSettings.mode = settings.mode;
      }
      if (settings.color !== undefined) {
        this.currentSettings.color = settings.color;
      }
      if (settings.size !== undefined) {
        this.currentSettings.size = settings.size;
      }
      if (settings.opacity !== undefined) {
        this.currentSettings.opacity = settings.opacity;
      }
    }

    getSettings() {
      return { ...this.currentSettings };
    }

    getMode() {
      return this.currentSettings.mode;
    }

    setMode(mode) {
      if (mode === 'pen' || mode === 'eraser' || mode === 'fill') {
        this.currentSettings.mode = mode;
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

  console.log('✅ brush-core.js Phase 2.1 loaded - Container取得修正版');

})();