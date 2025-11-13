/**
 * ================================================================================
 * system/drawing/brush-core.js
 * Phase 7-FIX5: init()エイリアス完全対応版
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
 * ================================================================================
 */

(function() {
  'use strict';

  class BrushCore {
    constructor() {
      // Core Components
      this.strokeRecorder = null;
      this.strokeRenderer = null;
      this.layerManager = null;
      this.historyManager = null;
      
      // State
      this.isDrawing = false;
      this.currentStroke = null;
      this.previewSprite = null;
      
      // Settings
      this.currentSettings = {
        mode: 'pen',
        color: '#800000',
        size: 3,
        opacity: 1.0
      };
      
      this.initialized = false;
    }

    /**
     * 初期化（init/initializeエイリアス両対応）
     */
    async init() {
      return await this.initialize();
    }

    async initialize() {
      if (this.initialized) {
        console.warn('[BrushCore] Already initialized');
        return;
      }

      // 依存コンポーネント取得
      this.strokeRecorder = window.strokeRecorder;
      this.strokeRenderer = window.strokeRenderer;
      this.layerManager = window.layerManager;
      this.historyManager = window.historyManager;

      // 必須コンポーネントチェック
      if (!this.strokeRecorder) {
        console.error('❌ [BrushCore] strokeRecorder not found');
        return;
      }

      if (!this.strokeRenderer) {
        console.error('❌ [BrushCore] strokeRenderer not found');
        return;
      }

      if (!this.layerManager) {
        console.error('❌ [BrushCore] layerManager not found');
        return;
      }

      if (!this.historyManager) {
        console.error('❌ [BrushCore] historyManager not found');
        return;
      }

      // StrokeRenderer初期化
      if (this.strokeRenderer.initialize) {
        await this.strokeRenderer.initialize();
      }

      this.initialized = true;
      console.log('✅ brush-core.js Phase 7-FIX5 loaded');
      console.log('   🔧 init()エイリアス完全対応');
      console.log('   🔧 getMode()/setMode()実装');
    }

    /**
     * ストローク開始
     */
    startStroke(localX, localY, pressure = 0.5) {
      if (!this.initialized) {
        console.error('❌ [BrushCore] Not initialized');
        return;
      }

      if (this.isDrawing) {
        console.warn('[BrushCore] Already drawing');
        return;
      }

      // アクティブレイヤー取得
      const activeLayer = this.layerManager.getActiveLayer();
      if (!activeLayer) {
        console.warn('[BrushCore] No active layer');
        return;
      }

      // ストローク開始
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

      // ポイント追加
      this.strokeRecorder.addPoint(localX, localY, pressure);

      // Preview描画
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
        console.warn('[BrushCore] No active layer');
        this.isDrawing = false;
        return;
      }

      // Preview削除
      if (this.previewSprite) {
        this.previewSprite.destroy({ children: true });
        this.previewSprite = null;
      }

      // StrokeData取得
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
          // Path登録
          const pathData = {
            id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'stroke',
            polygon: strokeData.polygon,
            settings: { ...this.currentSettings },
            sprite: sprite,
            bounds: this._calculateBounds(strokeData.polygon)
          };

          // レイヤーに追加
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
                  if (pathData.sprite) {
                    pathData.sprite.destroy({ children: true });
                  }
                }
              }
            },
            redo: () => {
              const layer = this.layerManager.getLayerById(activeLayer.id);
              if (layer) {
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

          // イベント発行
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

    /**
     * 設定更新
     */
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

    /**
     * 設定取得
     */
    getSettings() {
      return { ...this.currentSettings };
    }

    /**
     * モード取得（core-runtime.js互換）
     */
    getMode() {
      return this.currentSettings.mode;
    }

    /**
     * モード設定（core-engine.js互換）
     */
    setMode(mode) {
      if (mode === 'pen' || mode === 'eraser') {
        this.currentSettings.mode = mode;
      }
    }

    /**
     * 描画中か確認
     */
    getIsDrawing() {
      return this.isDrawing;
    }

    /**
     * Bounds計算
     */
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

    /**
     * クリーンアップ
     */
    destroy() {
      if (this.previewSprite) {
        this.previewSprite.destroy({ children: true });
      }
      this.initialized = false;
    }
  }

  // Global登録
  window.BrushCore = new BrushCore();

})();