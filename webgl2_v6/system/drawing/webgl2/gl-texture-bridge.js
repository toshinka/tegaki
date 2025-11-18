/**
 * ================================================================================
 * gl-texture-bridge.js - Phase 5完全版: WebGLTexture → PIXI.Sprite変換
 * PixiJS v8完全対応版（定数問題解決）
 * ================================================================================
 * 
 * 📁 親ファイル依存:
 *   - webgl2-drawing-layer.js (WebGL2DrawingLayer.gl)
 *   - gl-msdf-pipeline.js (WebGLTexture出力元)
 * 
 * 📄 子ファイル依存:
 *   - brush-core.js (createSpriteFromGLTexture呼び出し元)
 * 
 * 【Phase 5実装内容】
 * ✅ WebGLTexture → Canvas → PIXI.Sprite変換
 * ✅ PixiJS v8対応（BaseTexture廃止、定数変更対応）
 * ✅ PIXI.Texture.from()直接使用（オプション最小化）
 * ✅ Alpha channel完全保持
 * 
 * 【WebGPU互換API】
 * createSpriteFromGPUTexture() → createSpriteFromGLTexture()に内部変換
 * 
 * ================================================================================
 */

(function() {
  'use strict';

  class GLTextureBridge {
    constructor() {
      this.gl = null;
      this.initialized = false;
      this.pixiApp = null;
    }

    /**
     * 初期化
     * @param {WebGL2RenderingContext} gl - WebGL2コンテキスト
     * @param {PIXI.Application} pixiApp - PixiJSアプリケーション
     */
    async initialize(gl, pixiApp) {
      if (this.initialized) {
        console.warn('[GLTextureBridge] Already initialized');
        return;
      }

      this.gl = gl;
      this.pixiApp = pixiApp;
      this.initialized = true;

      console.log('[GLTextureBridge] ✅ Initialized (PixiJS v8)');
    }

    /**
     * WebGLTexture → PIXI.Sprite変換
     * 
     * @param {WebGLTexture} glTexture - WebGL2テクスチャ
     * @param {number} width - テクスチャ幅
     * @param {number} height - テクスチャ高さ
     * @returns {Promise<PIXI.Sprite|null>}
     */
    async createSpriteFromGLTexture(glTexture, width, height) {
      if (!this.initialized) {
        console.error('[GLTextureBridge] Not initialized');
        return null;
      }

      if (!glTexture) {
        console.error('[GLTextureBridge] Invalid texture');
        return null;
      }

      if (!width || !height || width <= 0 || height <= 0) {
        console.error('[GLTextureBridge] Invalid dimensions:', { width, height });
        return null;
      }

      try {
        // WebGLTexture → Canvas変換
        const canvas = await this._glTextureToCanvas(glTexture, width, height);
        if (!canvas) {
          console.error('[GLTextureBridge] Failed to convert texture to canvas');
          return null;
        }

        // PixiJS v8: Texture.from()で直接生成
        // オプションなし（デフォルト設定を使用）
        const texture = PIXI.Texture.from(canvas);

        // PIXI.Sprite生成
        const sprite = new PIXI.Sprite(texture);
        sprite.anchor.set(0, 0);

        return sprite;

      } catch (error) {
        console.error('[GLTextureBridge] Error creating sprite:', error);
        return null;
      }
    }

    /**
     * WebGLTexture → Canvas変換（readPixels使用）
     * @private
     * @param {WebGLTexture} glTexture - WebGL2テクスチャ
     * @param {number} width - 幅
     * @param {number} height - 高さ
     * @returns {Promise<HTMLCanvasElement|null>}
     */
    async _glTextureToCanvas(glTexture, width, height) {
      const gl = this.gl;

      // 一時FBO作成
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        glTexture,
        0
      );

      // Status確認
      const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      if (status !== gl.FRAMEBUFFER_COMPLETE) {
        console.error('[GLTextureBridge] FBO incomplete for readPixels:', status);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.deleteFramebuffer(fbo);
        return null;
      }

      // Pixel data読み取り
      const pixels = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

      // Unbind & cleanup
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.deleteFramebuffer(fbo);

      // Canvas生成
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        console.error('[GLTextureBridge] Failed to get 2d context');
        return null;
      }

      // ImageData生成（Y軸反転が必要）
      const imageData = ctx.createImageData(width, height);

      // Y軸反転してコピー（WebGLの原点は左下、Canvasは左上）
      for (let y = 0; y < height; y++) {
        const srcRow = (height - 1 - y) * width * 4;
        const dstRow = y * width * 4;
        
        for (let x = 0; x < width * 4; x++) {
          imageData.data[dstRow + x] = pixels[srcRow + x];
        }
      }

      ctx.putImageData(imageData, 0, 0);

      return canvas;
    }

    /**
     * WebGPU互換API: createSpriteFromGPUTexture
     * 内部でcreateSpriteFromGLTextureに委譲
     * 
     * @param {WebGLTexture} texture - WebGL2テクスチャ（引数名はGPU互換）
     * @param {number} width - テクスチャ幅
     * @param {number} height - テクスチャ高さ
     * @returns {Promise<PIXI.Sprite|null>}
     */
    async createSpriteFromGPUTexture(texture, width, height) {
      console.log('[GLTextureBridge] WebGPU互換API呼び出し → GL実装に委譲');
      return this.createSpriteFromGLTexture(texture, width, height);
    }

    /**
     * クリーンアップ
     */
    destroy() {
      this.gl = null;
      this.pixiApp = null;
      this.initialized = false;
    }
  }

  // Singleton登録
  const instance = new GLTextureBridge();
  window.GLTextureBridge = instance;

  // WebGPU互換用エイリアス
  window.WebGPUTextureBridge = instance;

  console.log('✅ gl-texture-bridge.js Phase 5完全版 (PixiJS v8対応) loaded');
  console.log('   ✅ WebGLTexture → PIXI.Sprite変換実装完了');
  console.log('   ✅ PixiJS v8: Texture.from()直接使用（定数問題解決）');
  console.log('   ✅ WebGPU互換API (createSpriteFromGPUTexture) 対応');

})();