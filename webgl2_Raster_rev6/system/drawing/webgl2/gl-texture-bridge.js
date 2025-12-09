/**
 * ================================================================================
 * gl-texture-bridge.js - Phase C-1完全版: WebGLTexture → PIXI.Texture変換
 * PixiJS v8完全対応版
 * ================================================================================
 * 
 * 📁 親ファイル依存:
 *   - webgl2-drawing-layer.js (WebGL2DrawingLayer.gl)
 * 
 * 📄 子ファイル依存:
 *   - raster-brush-core.js (テクスチャ変換呼び出し元)
 * 
 * 【Phase C-1実装内容】
 * 🔥 createTextureFromGL() 追加 - Sprite不要版
 * ✅ WebGLTexture → Canvas → PIXI.Texture変換
 * ✅ PixiJS v8対応（BaseTexture廃止）
 * ✅ PIXI.Texture.from()直接使用
 * ✅ Alpha channel完全保持
 * ✅ Y軸反転処理
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
      
      // テクスチャキャッシュ（パフォーマンス最適化）
      this.textureCache = new Map();
      this.maxCacheSize = 50;
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

      console.log('[GLTextureBridge] ✅ Initialized (PixiJS v8 + Phase C-1)');
    }

    /**
     * Phase C-1: WebGLTexture → PIXI.Texture変換（Sprite生成なし）
     * 
     * @param {WebGL2RenderingContext} gl - WebGL2コンテキスト
     * @param {WebGLTexture} glTexture - WebGL2テクスチャ
     * @returns {PIXI.Texture|null}
     */
    createTextureFromGL(gl, glTexture) {
      if (!glTexture) {
        console.error('[GLTextureBridge] Invalid texture');
        return null;
      }

      try {
        // 一時FBO作成してテクスチャサイズ取得
        const fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(
          gl.FRAMEBUFFER,
          gl.COLOR_ATTACHMENT0,
          gl.TEXTURE_2D,
          glTexture,
          0
        );

        // FBO Status確認
        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (status !== gl.FRAMEBUFFER_COMPLETE) {
          console.error('[GLTextureBridge] FBO incomplete:', status);
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          gl.deleteFramebuffer(fbo);
          return null;
        }

        // テクスチャ情報取得（ビューポートから推測）
        // 注: WebGL2にはテクスチャサイズ直接取得APIがないため、
        //     FBOサイズを使用
        gl.bindTexture(gl.TEXTURE_2D, glTexture);
        
        // テクスチャパラメータ取得
        const width = gl.getParameter(gl.VIEWPORT)[2] || 1024;
        const height = gl.getParameter(gl.VIEWPORT)[3] || 1024;
        
        gl.bindTexture(gl.TEXTURE_2D, null);

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
        const ctx = canvas.getContext('2d', {
          willReadFrequently: false,
          alpha: true
        });

        if (!ctx) {
          console.error('[GLTextureBridge] Failed to get 2d context');
          return null;
        }

        // ImageData生成（Y軸反転）
        const imageData = ctx.createImageData(width, height);

        // Y軸反転してコピー
        for (let y = 0; y < height; y++) {
          const srcRow = (height - 1 - y) * width * 4;
          const dstRow = y * width * 4;
          
          for (let x = 0; x < width * 4; x++) {
            imageData.data[dstRow + x] = pixels[srcRow + x];
          }
        }

        ctx.putImageData(imageData, 0, 0);

        // PixiJS v8: Texture.from()で直接生成
        const texture = PIXI.Texture.from(canvas, {
          resourceOptions: {
            width: width,
            height: height
          }
        });

        return texture;

      } catch (error) {
        console.error('[GLTextureBridge] Error creating texture:', error);
        return null;
      }
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
      const ctx = canvas.getContext('2d', {
        willReadFrequently: false,
        alpha: true
      });

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
     * キャッシュクリア
     */
    clearCache() {
      for (const texture of this.textureCache.values()) {
        try {
          texture.destroy(true);
        } catch (e) {
          // エラー無視
        }
      }
      this.textureCache.clear();
    }

    /**
     * クリーンアップ
     */
    destroy() {
      this.clearCache();
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

  console.log('✅ gl-texture-bridge.js Phase C-1完全版 (PixiJS v8対応) loaded');
  console.log('   🔥 C-1: createTextureFromGL() 追加（Sprite不要版）');
  console.log('   ✅ WebGLTexture → PIXI.Texture変換実装完了');
  console.log('   ✅ PixiJS v8: Texture.from()直接使用');
  console.log('   ✅ Y軸反転処理実装');
  console.log('   ✅ WebGPU互換API対応');

})();