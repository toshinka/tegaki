/**
 * ================================================================================
 * brush-core.js Phase 3.8 - MSDF統合完全版
 * ================================================================================
 * 
 * 【依存Parents】
 * - stroke-recorder.js (座標記録)
 * - gpu-stroke-processor.js (EdgeBuffer生成)
 * - msdf-pipeline-manager.js (MSDF生成)
 * - webgpu-texture-bridge.js (Sprite変換)
 * - layer-system.js (レイヤー管理)
 * - history.js (履歴管理)
 * 
 * 【依存Children】
 * - drawing-engine.js (startStroke/updateStroke呼び出し元)
 * 
 * 【Phase 3.8改修】
 * ✅ MSDF Pipeline完全統合
 * ✅ デバッグログ最小化（クリーン化）
 * ✅ エラーハンドリング強化
 * ✅ History登録の直接参照実装
 * 
 * 【座標系】
 * - 入力: Local座標（drawing-engineから変換済み）
 * - 処理: Local座標をそのまま使用
 * - 出力: StrokeRecorderへLocal座標を渡す
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

      // 必須コンポーネント
      this.strokeRecorder = window.strokeRecorder || window.StrokeRecorder;
      this.layerManager = window.layerManager || window.layerSystem;

      if (!this.strokeRecorder) {
        console.error('❌ [BrushCore] strokeRecorder not found');
        throw new Error('strokeRecorder not found');
      }
      if (!this.layerManager) {
        console.error('❌ [BrushCore] layerManager not found');
        throw new Error('layerManager not found');
      }

      // MSDF Pipeline コンポーネント
      this.gpuStrokeProcessor = window.GPUStrokeProcessor;
      this.msdfPipelineManager = window.MSDFPipelineManager;
      this.textureBridge = window.WebGPUTextureBridge;

      this.msdfAvailable = !!(
        this.gpuStrokeProcessor &&
        this.msdfPipelineManager &&
        this.textureBridge
      );

      if (!this.msdfAvailable) {
        console.error('❌ [BrushCore] MSDF Pipeline not available');
        return;
      }

      this.initialized = true;
      console.log('✅ [BrushCore] Phase 3.8初期化完了 (MSDF統合版)');
    }

    /**
     * ストローク開始
     * @param {number} localX - Local X座標
     * @param {number} localY - Local Y座標
     * @param {number} pressure - 筆圧 (0.0-1.0)
     */
    startStroke(localX, localY, pressure = 0.5) {
      if (!this.initialized || this.isDrawing) return;

      const activeLayer = this.layerManager.getActiveLayer();
      if (!activeLayer) {
        console.warn('[BrushCore] No active layer');
        return;
      }

      this.strokeRecorder.startStroke(localX, localY, pressure);
      
      this.isDrawing = true;
      this.currentStroke = {
        layerId: activeLayer.id,
        startTime: Date.now()
      };
    }

    /**
     * ストローク更新
     * @param {number} localX - Local X座標
     * @param {number} localY - Local Y座標
     * @param {number} pressure - 筆圧 (0.0-1.0)
     */
    async updateStroke(localX, localY, pressure = 0.5) {
      if (!this.initialized || !this.isDrawing) return;
      this.strokeRecorder.addPoint(localX, localY, pressure);
    }

    /**
     * ストローク終了
     */
    async finalizeStroke() {
      if (!this.initialized || !this.isDrawing) return;

      const activeLayer = this.layerManager.getActiveLayer();
      
      if (!activeLayer) {
        console.warn('[BrushCore] Active layer lost during stroke');
        this.isDrawing = false;
        return;
      }

      // プレビューSprite削除
      if (this.previewSprite) {
        this.previewSprite.destroy({ children: true });
        this.previewSprite = null;
      }

      // 記録ポイント取得
      const points = this.strokeRecorder.getRawPoints();
      
      if (!points || points.length < 2) {
        this.strokeRecorder.endStroke();
        this.isDrawing = false;
        return;
      }

      // MSDF描画実行
      if (this.msdfAvailable) {
        await this._finalizeMSDFStroke(points, activeLayer);
      }

      this.strokeRecorder.endStroke();
      this.isDrawing = false;
      this.currentStroke = null;
    }

    /**
     * MSDF Pipeline経由での描画
     * @private
     */
    async _finalizeMSDFStroke(points, activeLayer) {
      try {
        // 1. コンテナ取得
        const container = this._getLayerContainer(activeLayer);
        if (!container) {
          throw new Error('Container取得失敗');
        }

        // 2. EdgeBuffer生成（points配列をそのまま渡す）
        const edgeBuffer = this.gpuStrokeProcessor.createEdgeBuffer(points);
        if (!edgeBuffer) {
          throw new Error('EdgeBuffer作成失敗');
        }

        // 3. GPU転送
        const gpuBuffer = this.gpuStrokeProcessor.uploadToGPU(edgeBuffer);
        if (!gpuBuffer) {
          throw new Error('GPU転送失敗');
        }

        // 4. Bounds計算
        const bounds = this.gpuStrokeProcessor.calculateBounds(points);
        const width = Math.ceil(bounds.maxX - bounds.minX);
        const height = Math.ceil(bounds.maxY - bounds.minY);

        if (width <= 0 || height <= 0) {
          console.warn('[BrushCore] Invalid bounds:', bounds);
          return;
        }

        // 5. ブラシ設定準備（消しゴム対応）
        const brushSettings = {
          mode: this.currentSettings.mode,
          color: this.currentSettings.color,
          opacity: this.currentSettings.opacity
        };

        // 6. MSDF生成
        const finalTexture = await this.msdfPipelineManager.generateMSDF(
          gpuBuffer,
          bounds,
          null,
          brushSettings
        );

        if (!finalTexture) {
          throw new Error('MSDF生成失敗');
        }

        // 6. Sprite生成
        const sprite = await this.textureBridge.createSpriteFromGPUTexture(
          finalTexture,
          width,
          height
        );

        if (!sprite) {
          throw new Error('Sprite生成失敗');
        }

        // 7. Sprite設定
        sprite.x = bounds.minX;
        sprite.y = bounds.minY;
        sprite.visible = true;
        sprite.alpha = this.currentSettings.opacity;

        // 消しゴムモード
        if (this.currentSettings.mode === 'eraser') {
          sprite.blendMode = 'erase';
        }

        // 8. レイヤーに追加
        container.addChild(sprite);

        // 9. PathData作成
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

        // 10. History登録
        this._registerHistory(activeLayer, pathData, container);

        // 11. イベント発行
        this._emitStrokeEvents(activeLayer, pathData);

        // 12. GPUリソース解放
        if (gpuBuffer.destroy) gpuBuffer.destroy();
        if (finalTexture.destroy) finalTexture.destroy();

      } catch (error) {
        console.error('❌ [BrushCore] MSDF描画失敗:', error);
      }
    }

    /**
     * レイヤーコンテナ取得
     * @private
     */
    _getLayerContainer(layer) {
      if (layer.drawingContainer) return layer.drawingContainer;
      if (layer.container) return layer.container;
      if (layer.sprite) return layer.sprite;
      if (Array.isArray(layer.children)) return layer;
      
      console.warn('[BrushCore] No valid container found for layer:', layer.id);
      return null;
    }

    /**
     * History登録
     * @private
     */
    _registerHistory(activeLayer, pathData, container) {
      const historyManager = window.History;
      if (!historyManager || !historyManager.push) return;

      // Layer参照をクロージャでキャプチャ
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

    /**
     * イベント発行
     * @private
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

    /**
     * 設定更新
     */
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

    /**
     * ストロークキャンセル
     */
    cancelStroke() {
      if (this.previewSprite) {
        this.previewSprite.destroy({ children: true });
        this.previewSprite = null;
      }
      
      this.strokeRecorder.reset();
      this.isDrawing = false;
      this.currentStroke = null;
    }

    /**
     * 破棄
     */
    destroy() {
      if (this.previewSprite) {
        this.previewSprite.destroy({ children: true });
      }
      this.initialized = false;
    }
  }

  // グローバルシングルトン
  window.BrushCore = new BrushCore();

  console.log('✅ brush-core.js Phase 3.8 loaded');
  console.log('   📊 MSDF Pipeline完全統合');
  console.log('   📊 デバッグログクリーン化');

})();