/**
 * ================================================================================
 * GL Texture Bridge - Phase 5
 * ================================================================================
 * 
 * 【責務】
 * - WebGLTexture → PIXI.Sprite変換
 * - GPU→CPU読み取り（デバッグ用）
 * 
 * 【親子依存関係】
 * 親: brush-core.js
 * 子: 
 *   - window.WebGL2DrawingLayer
 *   - PIXI (PixiJS v8)
 * 
 * 【WebGPU互換API】
 * - createSpriteFromGLTexture() : webgpu-texture-bridge.js互換
 * 
 * 【グローバル登録】
 * window.GLTextureBridge (Singleton)
 */

(function() {
  'use strict';

  class GLTextureBridge {
    constructor() {
      this.gl = null;
    }

    initialize() {
      if (!window.WebGL2DrawingLayer || !window.WebGL2DrawingLayer.isInitialized()) {
        console.error('[GLTextureBridge] WebGL2DrawingLayer not initialized');
        return false;
      }
      
      this.gl = window.WebGL2DrawingLayer.getGL();
      return true;
    }

    /**
     * WebGLTexture → PIXI.Sprite変換
     * @param {WebGLTexture} glTexture - WebGL texture
     * @param {number} width - テクスチャ幅
     * @param {number} height - テクスチャ高さ
     * @param {Object} options - オプション
     * @returns {PIXI.Sprite}
     */
    createSpriteFromGLTexture(glTexture, width, height, options = {}) {
      if (!glTexture || !width || !height) {
        console.error('[GLTextureBridge] Invalid parameters');
        return null;
      }

      if (!window.PIXI) {
        console.error('[GLTextureBridge] PIXI not loaded');
        return null;
      }

      try {
        // WebGLTexture→Canvas変換（GPU→CPU読み取り）
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        
        // FBO経由で読み取り
        const pixels = this._readTexturePixels(glTexture, width, height);
        
        if (!pixels) {
          console.error('[GLTextureBridge] Failed to read texture');
          return null;
        }
        
        // ImageData生成
        const imageData = new ImageData(new Uint8ClampedArray(pixels), width, height);
        ctx.putImageData(imageData, 0, 0);
        
        // PIXI.Texture生成
        const baseTexture = PIXI.BaseTexture.from(canvas, {
          scaleMode: PIXI.SCALE_MODES.LINEAR,
          mipmap: PIXI.MIPMAP_MODES.OFF
        });
        
        const texture = new PIXI.Texture(baseTexture);
        
        // Sprite生成
        const sprite = new PIXI.Sprite(texture);
        sprite.anchor.set(0.5);
        
        // オプション適用
        if (options.x !== undefined) sprite.x = options.x;
        if (options.y !== undefined) sprite.y = options.y;
        if (options.alpha !== undefined) sprite.alpha = options.alpha;
        
        return sprite;
        
      } catch (error) {
        console.error('[GLTextureBridge] Sprite creation failed:', error);
        return null;
      }
    }

    /**
     * WebGLTextureからピクセルデータ読み取り
     * @private
     * @param {WebGLTexture} texture - WebGL texture
     * @param {number} width - 幅
     * @param {number} height - 高さ
     * @returns {Uint8Array}
     */
    _readTexturePixels(texture, width, height) {
      if (!this.gl) return null;
      
      const gl = this.gl;
      
      // 一時FBO生成
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      
      // Status確認
      const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      if (status !== gl.FRAMEBUFFER_COMPLETE) {
        console.error('[GLTextureBridge] FBO incomplete:', status);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.deleteFramebuffer(fbo);
        return null;
      }
      
      // ReadPixels
      const pixels = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      
      // Cleanup
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.deleteFramebuffer(fbo);
      
      // Y軸反転（WebGL座標系→Canvas座標系）
      return this._flipPixelsY(pixels, width, height);
    }

    /**
     * ピクセル配列のY軸反転
     * @private
     */
    _flipPixelsY(pixels, width, height) {
      const flipped = new Uint8Array(pixels.length);
      const rowSize = width * 4;
      
      for (let y = 0; y < height; y++) {
        const srcOffset = y * rowSize;
        const dstOffset = (height - 1 - y) * rowSize;
        flipped.set(pixels.subarray(srcOffset, srcOffset + rowSize), dstOffset);
      }
      
      return flipped;
    }

    /**
     * デバッグ用: Textureをcanvasに描画
     * @param {WebGLTexture} texture
     * @param {number} width
     * @param {number} height
     */
    debugVisualize(texture, width, height) {
      const pixels = this._readTexturePixels(texture, width, height);
      if (!pixels) return;
      
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.style.border = '2px solid #800000';
      canvas.style.position = 'fixed';
      canvas.style.top = '10px';
      canvas.style.right = '10px';
      canvas.style.zIndex = '10000';
      
      const ctx = canvas.getContext('2d');
      const imageData = new ImageData(new Uint8ClampedArray(pixels), width, height);
      ctx.putImageData(imageData, 0, 0);
      
      document.body.appendChild(canvas);
      
      console.log('[GLTextureBridge] Debug canvas added');
    }
  }

  // Singleton登録
  window.GLTextureBridge = new GLTextureBridge();

  console.log('✅ gl-texture-bridge.js Phase 5 loaded');

})();