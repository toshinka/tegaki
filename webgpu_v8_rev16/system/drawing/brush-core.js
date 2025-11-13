/**
 * ================================================================================
 * system/drawing/brush-core.js
 * Phase 1: MSDF新旧フロー併存版
 * ================================================================================
 * 
 * 【責務】
 * - ストローク管理（開始・更新・完了）
 * - StrokeRecorder/StrokeRenderer連携
 * - History登録（統一窓口）
 * - MSDF Pipeline呼び出し (Phase 1: デバッグモード)
 * 
 * 【依存Parents】
 * - stroke-recorder.js (window.strokeRecorder)
 * - stroke-renderer.js (window.strokeRenderer) [Legacy]
 * - gpu-stroke-processor.js (window.gpuStrokeProcessor) [新規]
 * - msdf-pipeline-manager.js (window.msdfPipelineManager) [新規]
 * - webgpu-texture-bridge.js (window.WebGPUTextureBridge) [新規]
 * - layer-system.js (window.layerManager)
 * - history.js (window.historyManager)
 * 
 * 【依存Children】
 * - drawing-engine.js
 * 
 * 【Phase 1改修】
 * ✅ MSDF新フロー追加（デバッグモード）
 * ✅ Legacy旧フロー併存維持
 * ✅ window.useMSDFPipeline フラグで切り替え
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

      // Phase 1: デバッグフラグ
      this.useMSDFPipeline = false; // グローバルフラグで切り替え可能
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

        // MSDF Pipeline参照（Phase 1）
        this.gpuStrokeProcessor = window.gpuStrokeProcessor;
        this.msdfPipelineManager = window.msdfPipelineManager;
        this.textureBridge = window.WebGPUTextureBridge;

        if (!this.strokeRecorder) {
          throw new Error('strokeRecorder not found');
        }

        if (!this.strokeRenderer) {
          throw new Error('strokeRenderer not found');
        }

        if (!this.layerManager) {
          throw new Error('layerManager not found');
        }

        // MSDF Pipeline状態確認
        if (this.gpuStrokeProcessor && this.msdfPipelineManager) {
          console.log('✅ [BrushCore] MSDF Pipeline利用可能');
          console.log('   🔧 window.useMSDFPipeline = true で新フロー有効化');
        } else {
          console.warn('⚠️ [BrushCore] MSDF Pipeline未初期化 - Legacy使用');
        }

        // StrokeRenderer初期化完了まで待機
        if (this.strokeRenderer.initialize) {
          await this.strokeRenderer.initialize();
        }

        this.initialized = true;
        console.log('✅ [BrushCore] Phase 1初期化完了（新旧併存）');
      })();

      return this.initializationPromise;
    }

    startStroke(localX, localY, pressure = 0.5) {
      if (!this.initialized) return;
      if (this.isDrawing) return;

      const activeLayer = this.layerManager.getActiveLayer();
      if (!activeLayer) return;

      this.strokeRecorder.startStroke();
      this.strokeRecorder.addPoint(localX, localY, pressure);
      
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

      // Preview更新（Legacy使用 - Phase 4でMSDF対応）
      const polygon = this.strokeRecorder.getPolygon();
      if (!polygon || polygon.length < 6) return;

      // 既存Preview削除
      if (this.previewSprite) {
        this.previewSprite.destroy({ children: true });
        this.previewSprite = null;
      }

      // 新規Preview描画（Legacy）
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

    async finalizeStroke() {
      if (!this.initialized || !this.isDrawing) return;

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

      // ✅ Phase 1: フラグによる新旧フロー切り替え
      const useMSDF = this.useMSDFPipeline || window.useMSDFPipeline;

      if (useMSDF && this._canUseMSDFPipeline()) {
        console.log('🚀 [BrushCore] MSDF新フロー実行');
        await this._finalizeMSDFStroke(strokeData, activeLayer);
      } else {
        console.log('🔧 [BrushCore] Legacy旧フロー実行');
        await this._finalizeLegacyStroke(strokeData, activeLayer);
      }

      this.isDrawing = false;
      this.currentStroke = null;
    }

    /**
     * ✅ MSDF Pipeline利用可能性チェック
     */
    _canUseMSDFPipeline() {
      return this.gpuStrokeProcessor && 
             this.msdfPipelineManager && 
             this.textureBridge;
    }

    /**
     * ✅ MSDF新フロー（Phase 1: Seed初期化のみ）
     */
    async _finalizeMSDFStroke(strokeData, activeLayer) {
      try {
        const points = strokeData.points; // [{x, y, pressure}, ...]

        // 1. EdgeBuffer作成
        const edgeBuffer = this.gpuStrokeProcessor.createEdgeBuffer(points);
        console.log('   ✓ EdgeBuffer作成完了');

        // 2. GPU転送
        const gpuBuffer = this.gpuStrokeProcessor.uploadToGPU(edgeBuffer);
        console.log('   ✓ GPU転送完了');

        // 3. Bounds計算
        const bounds = this._calculatePointsBounds(points);
        console.log('   ✓ Bounds:', bounds);

        // 4. MSDF生成（Phase 1: Seed初期化のみ）
        const seedTexture = this.msdfPipelineManager.generateMSDF(
          gpuBuffer,
          bounds,
          null
        );
        console.log('   ✓ Seed Texture生成完了');

        // Phase 1ではここまで（可視化用）
        console.log('✅ [BrushCore] MSDF Phase 1完了: Seed初期化のみ');
        console.log('   ⏳ Phase 2: JFA/Encode実装後に描画実行');

        // GPU Buffer破棄
        gpuBuffer.destroy();

      } catch (error) {
        console.error('❌ [BrushCore] MSDF新フロー失敗:', error);
        console.log('   🔄 Legacyフローへフォールバック');
        await this._finalizeLegacyStroke(strokeData, activeLayer);
      }
    }

    /**
     * ✅ Legacy旧フロー（既存実装維持）
     */
    async _finalizeLegacyStroke(strokeData, activeLayer) {
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
          const historyManager = window.historyManager;
          if (historyManager) {
            historyManager.recordAction({
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
          }

          window.eventBus.emit('layer:path-added', {
            layerId: activeLayer.id,
            pathId: pathData.id
          });

          window.eventBus.emit('thumbnail:layer-updated', {
            layerId: activeLayer.id
          });
        }

      } catch (error) {
        console.error('❌ [BrushCore] Legacy final stroke render failed:', error);
      }
    }

    /**
     * Points配列からBounds計算
     */
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

    /**
     * Polygon配列からBounds計算（Legacy用）
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

    destroy() {
      if (this.previewSprite) {
        this.previewSprite.destroy({ children: true });
      }
      this.initialized = false;
    }
  }

  window.BrushCore = new BrushCore();

  console.log('✅ brush-core.js Phase 1: 新旧フロー併存版 loaded');
  console.log('   ✓ Legacy旧フロー維持');
  console.log('   ✓ MSDF新フロー追加（デバッグモード）');
  console.log('   🔧 window.useMSDFPipeline = true で新フロー有効化');

})();