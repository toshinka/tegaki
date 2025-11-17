/**
 * ================================================================================
 * WebGL2 Drawing Layer - Phase 1
 * ================================================================================
 * 
 * 【責務】
 * - WebGL2 context初期化・管理
 * - FBO（FrameBuffer Object）生成・削除
 * - Extension確認・取得
 * 
 * 【親子依存関係】
 * 親: core-initializer.js (initializeWebGL2から呼び出し)
 * 子: なし（最下層GPU抽象化レイヤー）
 * 
 * 【WebGPU互換API】
 * - getCanvas() : WebGPUDrawingLayer.getCanvas()互換
 * - getGL() : WebGPUDrawingLayer.getDevice()互換
 * - isInitialized() : 初期化状態確認
 * 
 * 【グローバル登録】
 * window.WebGL2DrawingLayer (Singleton)
 */

(function() {
  'use strict';

  class WebGL2DrawingLayer {
    constructor() {
      this.canvas = null;
      this.gl = null;
      this.initialized = false;
      this.extensions = {};
      this.maxTextureSize = 0;
    }

    /**
     * WebGL2コンテキスト初期化
     * @returns {Promise<boolean>} 成功時true
     */
    async initialize() {
      if (this.initialized) {
        console.warn('[WebGL2DrawingLayer] Already initialized');
        return true;
      }

      // Canvas取得（webgl2-canvas優先、なければwebgpu-canvas流用）
      this.canvas = document.getElementById('webgl2-canvas') || 
                    document.getElementById('webgpu-canvas');
      
      if (!this.canvas) {
        console.error('[WebGL2DrawingLayer] Canvas not found');
        return false;
      }

      // WebGL2コンテキスト取得
      const contextOptions = {
        alpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: true,
        preserveDrawingBuffer: false,
        powerPreference: 'high-performance'
      };

      this.gl = this.canvas.getContext('webgl2', contextOptions);
      
      if (!this.gl) {
        console.error('[WebGL2DrawingLayer] WebGL2 not supported');
        return false;
      }

      // Extension確認
      this._checkExtensions();

      // 基本設定
      const gl = this.gl;
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      // 最大テクスチャサイズ取得
      this.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);

      this.initialized = true;
      console.log('[WebGL2DrawingLayer] ✅ Initialized', {
        maxTextureSize: this.maxTextureSize,
        extensions: Object.keys(this.extensions)
      });

      return true;
    }

    /**
     * Extension確認・取得
     * @private
     */
    _checkExtensions() {
      const gl = this.gl;
      
      // Float texture support (MSDF用)
      this.extensions.colorBufferFloat = gl.getExtension('EXT_color_buffer_float');
      if (!this.extensions.colorBufferFloat) {
        console.warn('[WebGL2DrawingLayer] EXT_color_buffer_float not available');
      }

      // Float texture linear filtering
      this.extensions.textureFloatLinear = gl.getExtension('OES_texture_float_linear');
      
      // Half float support
      this.extensions.colorBufferHalfFloat = gl.getExtension('EXT_color_buffer_half_float');
    }

    /**
     * FBO生成
     * @param {number} width - 幅
     * @param {number} height - 高さ
     * @param {Object} options - オプション
     * @param {boolean} options.float - Float textureを使用
     * @param {boolean} options.halfFloat - Half float textureを使用
     * @returns {Object} {fbo, texture, width, height}
     */
    createFBO(width, height, options = {}) {
      const gl = this.gl;
      
      // Texture生成
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      
      // Format決定
      let internalFormat, format, type;
      
      if (options.float && this.extensions.colorBufferFloat) {
        internalFormat = gl.RGBA32F;
        format = gl.RGBA;
        type = gl.FLOAT;
      } else if (options.halfFloat && this.extensions.colorBufferHalfFloat) {
        internalFormat = gl.RGBA16F;
        format = gl.RGBA;
        type = gl.HALF_FLOAT;
      } else {
        internalFormat = gl.RGBA8;
        format = gl.RGBA;
        type = gl.UNSIGNED_BYTE;
      }
      
      gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format, type, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      
      // FBO生成
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      
      // Status確認
      const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      if (status !== gl.FRAMEBUFFER_COMPLETE) {
        console.error('[WebGL2DrawingLayer] FBO incomplete:', status);
        this.deleteFBO({ fbo, texture });
        return null;
      }
      
      // Unbind
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.bindTexture(gl.TEXTURE_2D, null);
      
      return { fbo, texture, width, height };
    }

    /**
     * FBO削除
     * @param {Object} fboObj - createFBOの戻り値
     */
    deleteFBO(fboObj) {
      if (!fboObj) return;
      
      const gl = this.gl;
      if (fboObj.fbo) gl.deleteFramebuffer(fboObj.fbo);
      if (fboObj.texture) gl.deleteTexture(fboObj.texture);
    }

    /**
     * Texture生成（FBO不要の場合）
     * @param {number} width - 幅
     * @param {number} height - 高さ
     * @param {Object} options - オプション
     * @returns {WebGLTexture}
     */
    createTexture(width, height, options = {}) {
      const gl = this.gl;
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      
      let internalFormat = options.float ? gl.RGBA32F : gl.RGBA8;
      let format = gl.RGBA;
      let type = options.float ? gl.FLOAT : gl.UNSIGNED_BYTE;
      
      gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format, type, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      
      gl.bindTexture(gl.TEXTURE_2D, null);
      return texture;
    }

    // ========== WebGPU互換API ==========

    getCanvas() {
      return this.canvas;
    }

    getGL() {
      return this.gl;
    }

    getFormat() {
      return 'rgba8'; // WebGPU互換用
    }

    isInitialized() {
      return this.initialized;
    }

    getMaxTextureSize() {
      return this.maxTextureSize;
    }
  }

  // Singleton登録
  window.WebGL2DrawingLayer = new WebGL2DrawingLayer();

  console.log('✅ webgl2-drawing-layer.js Phase 1 loaded');

})();