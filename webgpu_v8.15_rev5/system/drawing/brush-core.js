/**
 * ================================================================================
 * system/drawing/brush-core.js
 * Phase 8: 初期化タイミング修正版
 * ================================================================================
 * 
 * 【責務】
 * - ストローク管理（開始・更新・完了）
 * - StrokeRecorder/StrokeRenderer連携
 * - History登録（統一窓口）
 * 
 * 【依存Parents】
 * - stroke-recorder.js (window.StrokeRecorder)
 * - stroke-renderer.js (window.strokeRenderer)
 * - layer-system.js (window.layerManager)
 * - history.js (window.historyManager)
 * 
 * 【依存Children】
 * - drawing-engine.js
 * 
 * 【Phase 8改修】
 * - historyManager遅延取得対応
 * - 初期化完了まで描画ブロック
 * 
 * ================================================================================
 */

(function() {
  'use strict';

  class BrushCore {
    constructor() {
      this.strokeRecorder = null;
      this.strokeRenderer = null;
      this.layerManager = null;
      this.historyManager = null;
      
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
    }

    /**
     * 初期化（init/initializeエイリアス対応）
     */
    async init() {
      return await this.initialize();
    }

    async initialize() {
      if (this.initialized) {
        return;
      }

      if (this.initializationPromise) {
        return this.initializationPromise;
      }

      this.initializationPromise = (async () => {
        // 必須コンポーネント取得
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

        // StrokeRenderer初期化待機
        if (this.strokeRenderer.initialize) {
          await this.strokeRenderer.initialize();
        }

        // historyManager遅延取得（初期化完了待ち）
        let retries = 0;
        while (!this.historyManager && retries < 50) {
          this.historyManager = window.historyManager;
          if (!this.historyManager) {
            await new Promise(resolve => setTimeout(resolve, 100));
            retries++;
          }
        }

        if (!this.historyManager) {
          throw new Error('historyManager not found after retries');
        }

        this.initialized = true;
        console.log('✅ brush-core.js Phase 8 loaded');
        console.log('   🔧 初期化タイミング修正');
        console.log('   🔧 historyManager遅延取得対応');
      })();

      return this.initializationPromise;
    }

    /**
     * ストローク開始
     */
    startStroke(localX, localY, pressure = 0.5) {
      if (!this.initialized) {
        console.warn('[BrushCore] Not initialized - initialization in progress');
        return;
      }

      if (this.isDrawing) {
        return;
      }

      const activeLayer = this.layerManager.getActiveLayer();
      if (!activeLayer) {
        return;
      }

      this.strokeRecorder.startStroke();
      this.strokeRecorder.addPoint(localX, localY, pressure);
      
      this.isDrawing = true;
      this.currentStroke = {
        layerId: activeLayer.id,
        startTime: Date.now()
      };
    }

    /**
     * ストローク更新
     */
    async updateStroke(localX, localY, pressure = 0.5) {
      if (!this.isDrawing) {
        return;
      }

      this.strokeRecorder.addPoint(localX, localY, pressure);

      const activeLayer = this.layerManager.getActiveLayer();
      if (!activeLayer) {
        return;
      }

      const polygon = this.strokeRecorder.getPolygon();
      if (!polygon || polygon.length < 6) {
        return;
      }

      // 既存Preview削除
      if (this.previewSprite) {
        this.previewSprite.destroy({ children: true });
        this.previewSprite = null;
      }

      // 新規Preview描画
      try {
        this.previewSprite = await this.strokeRenderer.renderPreview(
          polygon,
          this.currentSettings,
          activeLayer.container
        );
      } catch (error) {
        console.error('❌ [BrushCore] Preview render failed:', error);
      }
    }

    /**
     * ストローク完了
     */
    async finalizeStroke() {
      if (!this.isDrawing) {
        return;
      }

      const activeLayer = this.layerManager.getActiveLayer();
      if (!activeLayer) {
        this.isDrawing = false;
        return;
      }

      // Preview削除
      if (this.previewSprite) {
        this.previewSprite.destroy({ children: true });
        this.previewSprite = null;
      }

      const strokeData = this.strokeRecorder.endStroke();
      
      if (!strokeData || !strokeData.polygon || strokeData.polygon.length < 6) {
        this.isDrawing = false;
        return;
      }

      try {
        // Final描画
        const sprite = await this.strokeRenderer.renderFinalStroke(
          strokeData,
          this.currentSettings,
          activeLayer.container
        );

        if (sprite) {
          const pathData = {
            id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'stroke',
            polygon: strokeData.polygon,
            settings: { ...this.currentSettings },
            sprite: sprite,
            bounds: this._calculateBounds(strokeData.polygon)
          };

          if (!activeLayer.paths) {
            activeLayer.paths = [];
          }
          activeLayer.paths.push(pathData);

          // History登録
          this.historyManager.recordAction({
            type: 'path:add',
            layerId: activeLayer.id,
            pathData: pathData,
            undo: () => {
              const layer = this.layerManager.getLayerById(activeLayer.id);
              if (layer) {
                const index = layer.paths.findIndex(p => p.id === pathData.id);
                if (index !== -1) {
                  layer.paths.splice(index, 1);
                  if (pathData.sprite && !pathData.sprite.destroyed) {
                    pathData.sprite.destroy({ children: true });
                  }
                }
              }
            },
            redo: () => {
              const layer = this.layerManager.getLayerById(activeLayer.id);
              if (layer) {
                if (!layer.paths) layer.paths = [];
                layer.paths.push(pathData);
                if (pathData.sprite && !pathData.sprite.destroyed) {
                  layer.container.addChild(pathData.sprite);
                } else {
                  this.strokeRenderer.renderFinalStroke(
                    strokeData,
                    this.currentSettings,
                    layer.container
                  ).then(newSprite => {
                    pathData.sprite = newSprite;
                  });
                }
              }
            }
          });

          window.eventBus.emit('layer:path-added', {
            layerId: activeLayer.id,
            pathId: pathData.id
          });

          window.eventBus.emit('thumbnail:layer-updated', {
            layerId: activeLayer.id
          });
        }

      } catch (error) {
        console.error('❌ [BrushCore] Final stroke render failed:', error);
      }

      this.isDrawing = false;
      this.currentStroke = null;
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
      if (mode === 'pen' || mode === 'eraser') {
        this.currentSettings.mode = mode;
      }
    }

    getIsDrawing() {
      return this.isDrawing;
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

    destroy() {
      if (this.previewSprite) {
        this.previewSprite.destroy({ children: true });
      }
      this.initialized = false;
    }
  }

  window.BrushCore = new BrushCore();

})();