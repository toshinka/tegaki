/**
 * ================================================================================
 * system/drawing/brush-core.js
 * Phase 2完全版: MSDF完全描画実装
 * ================================================================================
 * 
 * 【責務】
 * - ストローク管理（開始・更新・完了）
 * - StrokeRecorder/StrokeRenderer連携
 * - History登録（統一窓口）
 * - MSDF Pipeline呼び出し（Phase 1: デフォルト有効化）
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
 * 【Phase 2改修】
 * ✅ MSDF完全描画実装
 * ✅ Sprite生成・レイヤー追加
 * ✅ History統合
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

        // StrokeRenderer初期化完了まで待機
        if (this.strokeRenderer.initialize) {
          await this.strokeRenderer.initialize();
        }

        // MSDF Pipeline参照（初期化完了後に取得）
        this.gpuStrokeProcessor = window.gpuStrokeProcessor;
        this.msdfPipelineManager = window.msdfPipelineManager;
        this.textureBridge = window.WebGPUTextureBridge;

        // MSDF利用可能性チェック
        this.msdfAvailable = !!(
          this.gpuStrokeProcessor?.initialized &&
          this.msdfPipelineManager?.initialized
        );

        if (this.msdfAvailable) {
          console.log('✅ [BrushCore] MSDF Pipeline有効');
        } else {
          console.log('🔧 [BrushCore] Legacy Mode有効');
        }

        this.initialized = true;
        console.log('✅ [BrushCore] Phase 1初期化完了');
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

      // Preview更新（Legacy使用）
      const polygon = this.strokeRecorder.getPolygon();
      if (!polygon || polygon.length < 6) return;

      if (this.previewSprite) {
        this.previewSprite.destroy({ children: true });
        this.previewSprite = null;
      }

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

      if (this.previewSprite) {
        this.previewSprite.destroy({ children: true });
        this.previewSprite = null;
      }

      const strokeData = this.strokeRecorder.endStroke();
      
      if (!strokeData || !strokeData.polygon || strokeData.polygon.length < 6) {
        this.isDrawing = false;
        return;
      }

      // MSDF Pipelineが利用可能ならMSDF、それ以外はLegacy
      if (this.msdfAvailable) {
        await this._finalizeMSDFStroke(strokeData, activeLayer);
      } else {
        await this._finalizeLegacyStroke(strokeData, activeLayer);
      }

      this.isDrawing = false;
      this.currentStroke = null;
    }

    /**
     * ✅ MSDF新フロー（Phase 2: 完全描画実装）
     */
    async _finalizeMSDFStroke(strokeData, activeLayer) {
      try {
        const points = strokeData.points;

        // 1. EdgeBuffer作成
        const edgeBuffer = this.gpuStrokeProcessor.createEdgeBuffer(points);

        // 2. GPU転送
        const gpuBuffer = this.gpuStrokeProcessor.uploadToGPU(edgeBuffer);

        // 3. Bounds計算
        const bounds = this._calculatePointsBounds(points);

        // 4. MSDF生成（Phase 2: 完全描画）
        const renderTexture = this.msdfPipelineManager.generateMSDF(
          gpuBuffer,
          bounds,
          null
        );

        // 5. Sprite生成
        const width = Math.ceil(bounds.maxX - bounds.minX);
        const height = Math.ceil(bounds.maxY - bounds.minY);
        
        const sprite = await this.textureBridge.createSpriteFromGPUTexture(
          renderTexture,
          width,
          height
        );

        // 6. Sprite位置調整
        sprite.x = bounds.minX;
        sprite.y = bounds.minY;

        // 7. レイヤーに追加（container確認）
        let container = activeLayer.container;
        if (!container) {
          // Fallback: layer自体をcontainerとして使用
          if (activeLayer.children !== undefined) {
            container = activeLayer;
          } else if (activeLayer.sprite) {
            container = activeLayer.sprite;
          } else {
            throw new Error('Cannot find valid container for layer');
          }
        }
        
        container.addChild(sprite);

        // 8. PathData登録
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

        // 9. History登録
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
                  const layerContainer = layer.container || layer;
                  layerContainer.addChild(pathData.sprite);
                }
              }
            }
          });
        }

        // 10. イベント発行
        const eventBus = window.eventBus || window.EventBus?.getInstance?.();
        if (eventBus) {
          const emit = eventBus.emit || eventBus.dispatchEvent;
          if (emit) {
            emit.call(eventBus, 'layer:path-added', {
              layerId: activeLayer.id,
              pathId: pathData.id
            });

            emit.call(eventBus, 'thumbnail:layer-updated', {
              layerId: activeLayer.id
            });
          }
        }

        // GPU リソース破棄
        gpuBuffer.destroy();
        renderTexture.destroy();

        console.log('✅ [BrushCore] MSDF Phase 2完了: 完全描画');

      } catch (error) {
        console.error('❌ [BrushCore] MSDF新フロー失敗:', error);
        await this._finalizeLegacyStroke(strokeData, activeLayer);
      }
    }

    /**
     * ✅ Legacy旧フロー
     */
    async _finalizeLegacyStroke(strokeData, activeLayer) {
      try {
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

  console.log('✅ brush-core.js Phase 2完全版 loaded');
  console.log('   ✅ MSDF完全描画実装');

})();