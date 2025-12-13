/**
 * ============================================================================
 * gl-texture-bridge.js - Phase B-Emergency-3
 * ============================================================================
 * 責務: 描画Canvas → PixiJS Texture転送
 * 変更内容:
 *   ✅ Canvas経由転送方式実装
 *   ✅ transferLayerToPixi() 新規実装
 *   ❌ 双方向変換削除（片方向転送のみ）
 * 
 * 親依存: webgl2-drawing-layer.js
 * 子依存: なし
 * グローバル: window.GLTextureBridge, window.glTextureBridge
 * ============================================================================
 */

class GLTextureBridge {
  constructor() {
    this.drawingCanvas = null;
    this.pixiApp = null;
    this.gl = null;
    
    // Textureキャッシュ
    this.layerTextureCache = new Map();
    
    // 一時Canvas（レイヤーごと）
    this.tempCanvases = new Map();
    
    // パフォーマンス測定
    this.transferStats = {
      count: 0,
      totalTime: 0,
      lastTime: 0
    };
  }

  /**
   * 初期化
   * @param {HTMLCanvasElement} drawingCanvas - 描画Canvas
   * @param {PIXI.Application} pixiApp - PixiJSアプリ
   */
  initialize(drawingCanvas, pixiApp) {
    console.log('[GLTextureBridge] 🚀 Initializing (Canvas transfer mode)...');

    this.drawingCanvas = drawingCanvas;
    this.pixiApp = pixiApp;
    this.gl = drawingCanvas.getContext('webgl2');

    if (!this.gl) {
      throw new Error('[GLTextureBridge] ❌ Failed to get GL context');
    }

    console.log('[GLTextureBridge] ✅ Initialized');
    console.log('   Drawing canvas:', drawingCanvas);
    console.log('   PixiJS app:', pixiApp);
    console.log('   Transfer mode: Canvas-based');
  }

  /**
   * レイヤーをPixiJSに転送（メインメソッド）
   * @param {string} layerId - レイヤーID
   * @returns {PIXI.Texture}
   */
  transferLayerToPixi(layerId) {
    const startTime = performance.now();
    
    console.log('[GLTextureBridge] 🔄 Transferring layer:', layerId);

    try {
      // 1. 一時Canvasを取得/生成
      const tempCanvas = this._getOrCreateTempCanvas(layerId);

      // 2. WebGL2 FBO → 一時Canvas
      this._renderFBOToCanvas(layerId, tempCanvas);

      // 3. Canvas → PixiJS Texture
      const pixiTexture = this._canvasToPixiTexture(layerId, tempCanvas);

      // 4. EventBus経由で通知
      window.EventBus.emit('layer:texture-updated', {
        layerId,
        texture: pixiTexture
      });

      // パフォーマンス記録
      const duration = performance.now() - startTime;
      this._recordTransferTime(duration);

      console.log('[GLTextureBridge] ✅ Transfer completed:', duration.toFixed(2), 'ms');

      return pixiTexture;

    } catch (error) {
      console.error('[GLTextureBridge] ❌ Transfer failed:', error);
      throw error;
    }
  }

  /**
   * 一時Canvas取得/生成
   */
  _getOrCreateTempCanvas(layerId) {
    let canvas = this.tempCanvases.get(layerId);
    
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.width = this.drawingCanvas.width;
      canvas.height = this.drawingCanvas.height;
      this.tempCanvases.set(layerId, canvas);
      
      console.log('[GLTextureBridge] 🆕 Temp canvas created:', layerId);
    }

    return canvas;
  }

  /**
   * WebGL2 FBO → Canvas 転送
   */
  _renderFBOToCanvas(layerId, targetCanvas) {
    const gl = this.gl;
    const width = targetCanvas.width;
    const height = targetCanvas.height;

    // RasterLayerからFBO取得
    const layerData = window.rasterLayer.layers.get(layerId);
    if (!layerData) {
      throw new Error('[GLTextureBridge] Layer not found: ' + layerId);
    }

    const fbo = layerData.fbo;

    // FBOにバインド
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

    // ピクセルデータ読み取り
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    // FBO unbind
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // Canvas 2Dコンテキストに描画
    const ctx = targetCanvas.getContext('2d');
    
    // ImageData作成（Y軸反転考慮）
    const imageData = ctx.createImageData(width, height);
    
    // Y軸反転しながらコピー
    for (let y = 0; y < height; y++) {
      const srcRow = (height - 1 - y) * width * 4;
      const dstRow = y * width * 4;
      
      for (let x = 0; x < width * 4; x++) {
        imageData.data[dstRow + x] = pixels[srcRow + x];
      }
    }

    // Canvas に描画
    ctx.putImageData(imageData, 0, 0);
  }

  /**
   * Canvas → PixiJS Texture 変換
   */
  _canvasToPixiTexture(layerId, canvas) {
    // キャッシュ確認
    let pixiTexture = this.layerTextureCache.get(layerId);

    if (!pixiTexture) {
      // 新規Texture作成
      const baseTexture = PIXI.BaseTexture.from(canvas, {
        scaleMode: PIXI.SCALE_MODES.LINEAR,
        resolution: 1
      });

      pixiTexture = new PIXI.Texture(baseTexture);
      this.layerTextureCache.set(layerId, pixiTexture);

      console.log('[GLTextureBridge] 🆕 PixiJS Texture created:', layerId);

    } else {
      // 既存Textureを更新
      pixiTexture.baseTexture.resource.source = canvas;
      pixiTexture.baseTexture.update();

      console.log('[GLTextureBridge] 🔄 PixiJS Texture updated:', layerId);
    }

    return pixiTexture;
  }

  /**
   * 転送時間記録
   */
  _recordTransferTime(duration) {
    this.transferStats.count++;
    this.transferStats.totalTime += duration;
    this.transferStats.lastTime = duration;
  }

  /**
   * パフォーマンス統計取得
   */
  getTransferStats() {
    const avg = this.transferStats.count > 0
      ? this.transferStats.totalTime / this.transferStats.count
      : 0;

    return {
      count: this.transferStats.count,
      averageTime: avg.toFixed(2) + 'ms',
      lastTime: this.transferStats.lastTime.toFixed(2) + 'ms',
      totalTime: this.transferStats.totalTime.toFixed(2) + 'ms'
    };
  }

  /**
   * キャッシュクリア
   */
  clearCache(layerId = null) {
    if (layerId) {
      // 特定レイヤーのみクリア
      const texture = this.layerTextureCache.get(layerId);
      if (texture) {
        texture.destroy(true);
        this.layerTextureCache.delete(layerId);
      }

      this.tempCanvases.delete(layerId);

      console.log('[GLTextureBridge] 🗑️ Cache cleared:', layerId);

    } else {
      // 全キャッシュクリア
      for (const texture of this.layerTextureCache.values()) {
        texture.destroy(true);
      }

      this.layerTextureCache.clear();
      this.tempCanvases.clear();

      console.log('[GLTextureBridge] 🗑️ All cache cleared');
    }
  }

  /**
   * デバッグ情報取得
   */
  getDebugInfo() {
    return {
      cacheSize: this.layerTextureCache.size,
      tempCanvasCount: this.tempCanvases.size,
      stats: this.getTransferStats()
    };
  }

  /**
   * リソース解放
   */
  dispose() {
    this.clearCache();
    this.drawingCanvas = null;
    this.pixiApp = null;
    this.gl = null;

    console.log('[GLTextureBridge] ✅ Disposed');
  }
}

// ============================================================================
// グローバル登録
// ============================================================================
window.GLTextureBridge = GLTextureBridge;
window.glTextureBridge = new GLTextureBridge();

console.log('✅ gl-texture-bridge.js Phase B-Emergency-3 loaded');
console.log('   🚨 BE-3: Canvas経由転送実装');
console.log('   🚨 BE-3: transferLayerToPixi() メインAPI');
console.log('   🚨 BE-3: Y軸反転対応');
console.log('   ✅ パフォーマンス測定機能追加');