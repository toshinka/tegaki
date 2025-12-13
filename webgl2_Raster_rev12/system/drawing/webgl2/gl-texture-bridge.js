/**
 * ============================================================================
 * ファイル名: system/drawing/webgl2/gl-texture-bridge.js
 * Phase: B-Emergency-3
 * 責務: 描画Canvas → PixiJS Texture 転送
 * 依存: なし
 * 親依存: webgl2-drawing-layer.js
 * 子依存: raster-layer.js
 * 公開API: initialize(), transferLayerToPixi()
 * イベント発火: layer:texture-updated
 * イベント受信: なし
 * グローバル登録: window.GLTextureBridge
 * 実装状態: 🚨 Phase B-Emergency-3 - Canvas経由転送実装
 * 
 * 変更内容:
 *   🚨 BE-3: Canvas経由転送実装
 *   🚨 BE-3: transferLayerToPixi() メインAPI
 *   🚨 BE-3: Y軸反転対応
 *   ✅ パフォーマンス測定機能追加
 * ============================================================================
 */

(function() {
  'use strict';

  /**
   * GL-Texture転送ブリッジ（Canvas経由）
   * 
   * 責務:
   * - 描画Canvas（WebGL2）からPixiJS Textureへの転送
   * - FBO → Canvas2D → PixiJS Texture のパイプライン
   * - Y軸反転処理
   * - パフォーマンス測定
   */
  class GLTextureBridge {
    constructor() {
      // 描画Canvas
      this.drawingCanvas = null;

      // PixiJSアプリケーション
      this.pixiApp = null;

      // 一時Canvas キャッシュ
      this.tempCanvases = new Map();

      // PixiJS Texture キャッシュ
      this.layerTextureCache = new Map();

      // パフォーマンス測定
      this.performanceMetrics = {
        transferCount: 0,
        totalTime: 0,
        averageTime: 0,
        lastTransferTime: 0
      };

      // 初期化状態
      this.initialized = false;
    }

    // ============================================================================
    // 初期化
    // ============================================================================

    /**
     * 初期化
     * 
     * @param {HTMLCanvasElement} drawingCanvas - 描画Canvas
     * @param {PIXI.Application} pixiApp - PixiJSアプリケーション
     */
    initialize(drawingCanvas, pixiApp) {
      console.log('[GLTextureBridge] 🚀 Initializing (Canvas transfer mode)...');

      this.drawingCanvas = drawingCanvas;
      this.pixiApp = pixiApp;
      this.initialized = true;

      console.log('[GLTextureBridge] ✅ Initialized');
      console.log('  Drawing Canvas:', drawingCanvas);
      console.log('  Transfer mode: Canvas-based');
    }

    // ============================================================================
    // メイン転送API
    // ============================================================================

    /**
     * レイヤーをPixiJSに転送
     * 
     * @param {string} layerId - レイヤーID
     * @returns {Promise<PIXI.Texture>} 転送されたTexture
     */
    async transferLayerToPixi(layerId) {
      if (!this.initialized) {
        throw new Error('[GLTextureBridge] ❌ Not initialized');
      }

      const startTime = performance.now();

      try {
        console.log('[GLTextureBridge] 🔄 Transferring layer:', layerId);

        // Step 1: 一時Canvas取得
        const tempCanvas = this._getOrCreateTempCanvas(layerId);

        // Step 2: FBO → Canvas転送
        await this._renderFBOToCanvas(layerId, tempCanvas);

        // Step 3: PixiJS Texture生成/更新
        const pixiTexture = this._createOrUpdatePixiTexture(layerId, tempCanvas);

        // Step 4: EventBus通知
        this._notifyTextureUpdate(layerId, pixiTexture);

        // パフォーマンス記録
        const duration = performance.now() - startTime;
        this._recordPerformance(duration);

        console.log('[GLTextureBridge] ✅ Layer transferred:', layerId);
        console.log(`  Transfer time: ${duration.toFixed(2)}ms`);

        return pixiTexture;

      } catch (error) {
        console.error('[GLTextureBridge] ❌ Transfer failed:', error);
        throw error;
      }
    }

    // ============================================================================
    // プライベートメソッド - Canvas管理
    // ============================================================================

    /**
     * 一時Canvas取得または生成
     */
    _getOrCreateTempCanvas(layerId) {
      let canvas = this.tempCanvases.get(layerId);
      
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.width = this.drawingCanvas.width;
        canvas.height = this.drawingCanvas.height;
        this.tempCanvases.set(layerId, canvas);
        
        console.log(`[GLTextureBridge] 📐 Created temp canvas for ${layerId}`);
      }

      return canvas;
    }

    // ============================================================================
    // プライベートメソッド - FBO転送
    // ============================================================================

    /**
     * FBOからCanvasへ転送
     * 
     * @param {string} layerId - レイヤーID
     * @param {HTMLCanvasElement} targetCanvas - 転送先Canvas
     */
    async _renderFBOToCanvas(layerId, targetCanvas) {
      const gl = window.GLContext.gl;
      const rasterLayer = window.rasterLayer;

      if (!gl || !rasterLayer) {
        throw new Error('[GLTextureBridge] ❌ GL context or RasterLayer not found');
      }

      // レイヤーデータ取得
      const layerData = rasterLayer.layers.get(layerId);
      if (!layerData) {
        throw new Error(`[GLTextureBridge] ❌ Layer not found: ${layerId}`);
      }

      const { fbo, width, height } = layerData;

      // FBOバインド
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

      // ピクセルデータ読み取り
      const pixels = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

      // バインド解除
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);

      // Y軸反転してCanvasに描画
      this._writePixelsToCanvas(pixels, width, height, targetCanvas);
    }

    /**
     * ピクセルデータをCanvasに書き込み（Y軸反転）
     * 
     * @param {Uint8Array} pixels - ピクセルデータ
     * @param {number} width - 幅
     * @param {number} height - 高さ
     * @param {HTMLCanvasElement} canvas - 転送先Canvas
     */
    _writePixelsToCanvas(pixels, width, height, canvas) {
      const ctx = canvas.getContext('2d', { willReadFrequently: false });

      // Y軸反転処理
      const flippedPixels = new Uint8ClampedArray(width * height * 4);
      
      for (let y = 0; y < height; y++) {
        const sourceRow = (height - 1 - y) * width * 4;
        const targetRow = y * width * 4;
        
        for (let x = 0; x < width * 4; x++) {
          flippedPixels[targetRow + x] = pixels[sourceRow + x];
        }
      }

      // ImageData生成
      const imageData = new ImageData(flippedPixels, width, height);

      // Canvas描画
      ctx.putImageData(imageData, 0, 0);
    }

    // ============================================================================
    // プライベートメソッド - PixiJS Texture管理
    // ============================================================================

    /**
     * PixiJS Texture生成または更新
     * 
     * @param {string} layerId - レイヤーID
     * @param {HTMLCanvasElement} sourceCanvas - ソースCanvas
     * @returns {PIXI.Texture} PixiJS Texture
     */
    _createOrUpdatePixiTexture(layerId, sourceCanvas) {
      let texture = this.layerTextureCache.get(layerId);

      if (!texture) {
        // 新規Texture生成
        texture = PIXI.Texture.from(sourceCanvas, {
          scaleMode: PIXI.SCALE_MODES.LINEAR,
          mipmap: PIXI.MIPMAP_MODES.OFF
        });

        this.layerTextureCache.set(layerId, texture);

        console.log(`[GLTextureBridge] 🆕 Created new texture for ${layerId}`);
      } else {
        // 既存Texture更新
        texture.update();

        console.log(`[GLTextureBridge] 🔄 Updated texture for ${layerId}`);
      }

      return texture;
    }

    // ============================================================================
    // プライベートメソッド - イベント通知
    // ============================================================================

    /**
     * Texture更新イベント発火
     * 
     * @param {string} layerId - レイヤーID
     * @param {PIXI.Texture} texture - 更新されたTexture
     */
    _notifyTextureUpdate(layerId, texture) {
      if (window.EventBus) {
        window.EventBus.emit('layer:texture-updated', {
          layerId: layerId,
          texture: texture
        });
      }
    }

    // ============================================================================
    // プライベートメソッド - パフォーマンス測定
    // ============================================================================

    /**
     * パフォーマンス記録
     * 
     * @param {number} duration - 転送時間（ミリ秒）
     */
    _recordPerformance(duration) {
      this.performanceMetrics.transferCount++;
      this.performanceMetrics.totalTime += duration;
      this.performanceMetrics.lastTransferTime = duration;
      this.performanceMetrics.averageTime = 
        this.performanceMetrics.totalTime / this.performanceMetrics.transferCount;
    }

    // ============================================================================
    // パブリックユーティリティ
    // ============================================================================

    /**
     * パフォーマンスメトリクス取得
     * 
     * @returns {Object} パフォーマンスデータ
     */
    getPerformanceMetrics() {
      return {
        ...this.performanceMetrics,
        averageTime: this.performanceMetrics.averageTime.toFixed(2) + 'ms',
        lastTransferTime: this.performanceMetrics.lastTransferTime.toFixed(2) + 'ms'
      };
    }

    /**
     * パフォーマンスメトリクスリセット
     */
    resetPerformanceMetrics() {
      this.performanceMetrics = {
        transferCount: 0,
        totalTime: 0,
        averageTime: 0,
        lastTransferTime: 0
      };

      console.log('[GLTextureBridge] 📊 Performance metrics reset');
    }

    /**
     * Textureキャッシュクリア
     * 
     * @param {string} layerId - レイヤーID（省略時は全クリア）
     */
    clearTextureCache(layerId = null) {
      if (layerId) {
        const texture = this.layerTextureCache.get(layerId);
        if (texture) {
          texture.destroy(true);
          this.layerTextureCache.delete(layerId);
          console.log(`[GLTextureBridge] 🗑️ Cleared texture cache: ${layerId}`);
        }
      } else {
        // 全Textureクリア
        for (const [id, texture] of this.layerTextureCache.entries()) {
          texture.destroy(true);
        }
        this.layerTextureCache.clear();
        console.log('[GLTextureBridge] 🗑️ Cleared all texture cache');
      }
    }

    /**
     * 一時Canvasクリア
     * 
     * @param {string} layerId - レイヤーID（省略時は全クリア）
     */
    clearTempCanvas(layerId = null) {
      if (layerId) {
        this.tempCanvases.delete(layerId);
      } else {
        this.tempCanvases.clear();
      }

      console.log('[GLTextureBridge] 🗑️ Cleared temp canvas');
    }

    /**
     * クリーンアップ
     */
    dispose() {
      console.log('[GLTextureBridge] 🧹 Disposing...');

      // Textureキャッシュクリア
      this.clearTextureCache();

      // 一時Canvasクリア
      this.clearTempCanvas();

      // 参照クリア
      this.drawingCanvas = null;
      this.pixiApp = null;
      this.initialized = false;

      console.log('[GLTextureBridge] ✅ Disposed');
    }
  }

  // グローバル登録
  window.GLTextureBridge = GLTextureBridge;

  console.log('✅ gl-texture-bridge.js Phase B-Emergency-3 loaded');
  console.log('   🚨 BE-3: Canvas経由転送実装');
  console.log('   🚨 BE-3: transferLayerToPixi() メインAPI');
  console.log('   🚨 BE-3: Y軸反転対応');
  console.log('   ✅ パフォーマンス測定機能追加');

})();