/**
 * ============================================================================
 * ファイル名: system/drawing/webgl2/gl-texture-bridge.js
 * Phase: B-Emergency-3
 * 責務: 描画Canvas → PixiJS Texture 転送
 * ============================================================================
 */

(function() {
  'use strict';

  class GLTextureBridge {
    constructor() {
      this.drawingCanvas = null;
      this.pixiApp = null;
      this.tempCanvases = new Map();
      this.layerTextureCache = new Map();
      this.performanceMetrics = { transferCount: 0, totalTime: 0, averageTime: 0, lastTransferTime: 0 };
      this.initialized = false;
    }

    initialize(drawingCanvas, pixiApp) {
      console.log('[GLTextureBridge] 🚀 Initializing...');
      this.drawingCanvas = drawingCanvas;
      this.pixiApp = pixiApp;
      this.initialized = true;
      console.log('[GLTextureBridge] ✅ Initialized');
    }

    async transferLayerToPixi(layerId) {
      if (!this.initialized) throw new Error('[GLTextureBridge] ❌ Not initialized');
      const startTime = performance.now();
      try {
        const tempCanvas = this._getOrCreateTempCanvas(layerId);
        await this._renderFBOToCanvas(layerId, tempCanvas);
        const pixiTexture = this._createOrUpdatePixiTexture(layerId, tempCanvas);
        this._notifyTextureUpdate(layerId, pixiTexture);
        this._recordPerformance(performance.now() - startTime);
        return pixiTexture;
      } catch (error) {
        console.error('[GLTextureBridge] ❌ Transfer failed:', error);
        throw error;
      }
    }

    _getOrCreateTempCanvas(layerId) {
      let canvas = this.tempCanvases.get(layerId);
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.width = this.drawingCanvas.width;
        canvas.height = this.drawingCanvas.height;
        this.tempCanvases.set(layerId, canvas);
      }
      return canvas;
    }

    async _renderFBOToCanvas(layerId, targetCanvas) {
      const gl = window.GLContext?.gl;
      const rl = window.rasterLayer || window.RasterLayer;
      if (!gl || !rl) throw new Error('[GLTextureBridge] ❌ GL context or RasterLayer not found');
      const fbo = rl.getFramebuffer(layerId);
      if (!fbo) throw new Error(`[GLTextureBridge] ❌ FBO not found: ${layerId}`);
      const w = rl.canvasWidth;
      const h = rl.canvasHeight;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      const pixels = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      this._writePixelsToCanvas(pixels, w, h, targetCanvas);
    }

    _writePixelsToCanvas(pixels, width, height, canvas) {
      const ctx = canvas.getContext('2d');
      const flipped = new Uint8ClampedArray(width * height * 4);
      for (let y = 0; y < height; y++) {
        const src = (height - 1 - y) * width * 4;
        const dst = y * width * 4;
        for (let x = 0; x < width * 4; x++) flipped[dst + x] = pixels[src + x];
      }
      ctx.putImageData(new ImageData(flipped, width, height), 0, 0);
    }

    _createOrUpdatePixiTexture(layerId, sourceCanvas) {
      let texture = this.layerTextureCache.get(layerId);
      if (!texture) {
        texture = PIXI.Texture.from(sourceCanvas);
        this.layerTextureCache.set(layerId, texture);
      } else {
        texture.source.update();
      }
      return texture;
    }

    _notifyTextureUpdate(layerId, texture) {
      window.EventBus?.emit('layer:texture-updated', { layerId, texture });
    }

    _recordPerformance(duration) {
      const m = this.performanceMetrics;
      m.transferCount++;
      m.totalTime += duration;
      m.lastTransferTime = duration;
      m.averageTime = m.totalTime / m.transferCount;
    }

    getPerformanceMetrics() { return this.performanceMetrics; }
  }

  if (!window.glTextureBridge) {
    const instance = new GLTextureBridge();
    window.GLTextureBridge = instance;
    window.glTextureBridge = instance;
    console.log('[GLTextureBridge] ✅ Global instance registered');
  }
})();
