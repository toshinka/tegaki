/**
 * ================================================================================
 * webgl2-drawing-layer.js - WebGL2 Drawing Layer
 * ================================================================================
 * 
 * 📁 親ファイル依存:
 *   - index.html (<canvas id="webgpu-canvas"> を流用)
 *   - config.js (TEGAKI_CONFIG.canvas)
 * 
 * 📄 子ファイル使用先:
 *   - core-initializer.js (initialize/getCanvas/getGL呼び出し)
 *   - drawing-engine.js (getCanvas呼び出し)
 *   - gl-stroke-processor.js (getGL呼び出し)
 *   - gl-msdf-pipeline.js (getGL呼び出し)
 *   - gl-texture-bridge.js (getGL呼び出し)
 * 
 * 【責務】
 * - WebGL2 context取得・管理
 * - Canvas要素管理
 * - FBO生成・削除
 * - Extension確認
 * 
 * 【WebGPU→WebGL2移行対応】
 * - WebGPUDrawingLayerインターフェース互換維持
 * - getDevice()→getGL()
 * - getFormat()→'rgba8'固定
 * 
 * ================================================================================
 */

(function() {
  'use strict';

  class WebGL2DrawingLayer {
    constructor() {
      this.canvas = null;
      this.gl = null;
      this.initialized = false;
      this.extensions = {};
      this.capabilities = {
        maxTextureSize: 0,
        floatTextures: false,
        floatTextureLinear: false,
        colorBufferFloat: false
      };
    }

    async initialize() {
      if (this.initialized) {
        return true;
      }

      try {
        this.canvas = document.getElementById('webgpu-canvas');
        if (!this.canvas) {
          throw new Error('[WebGL2] Canvas #webgpu-canvas not found');
        }

        this.gl = this.canvas.getContext('webgl2', {
          alpha: true,
          antialias: false,
          depth: false,
          stencil: false,
          preserveDrawingBuffer: false,
          premultipliedAlpha: true,
          powerPreference: 'high-performance'
        });

        if (!this.gl) {
          throw new Error('[WebGL2] Failed to get WebGL2 context');
        }

        this._setupExtensions();
        this._checkCapabilities();
        this._setupCanvas();

        this.initialized = true;
        return true;

      } catch (error) {
        console.error('[WebGL2] Initialization failed:', error);
        this.initialized = false;
        return false;
      }
    }

    _setupExtensions() {
      const gl = this.gl;
      
      this.extensions.colorBufferFloat = gl.getExtension('EXT_color_buffer_float');
      this.extensions.textureFloatLinear = gl.getExtension('OES_texture_float_linear');
      this.extensions.textureHalfFloatLinear = gl.getExtension('OES_texture_half_float_linear');
    }

    _checkCapabilities() {
      const gl = this.gl;
      
      this.capabilities.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      this.capabilities.floatTextures = !!this.extensions.colorBufferFloat;
      this.capabilities.floatTextureLinear = !!this.extensions.textureFloatLinear;
      this.capabilities.colorBufferFloat = !!this.extensions.colorBufferFloat;
    }

    _setupCanvas() {
      const config = window.TEGAKI_CONFIG;
      const width = config?.canvas?.width || 1920;
      const height = config?.canvas?.height || 1080;

      this.canvas.width = width;
      this.canvas.height = height;

      this.gl.viewport(0, 0, width, height);
    }

    createFBO(width, height, options = {}) {
      const gl = this.gl;
      
      const internalFormat = options.float 
        ? (this.capabilities.floatTextures ? gl.RGBA32F : gl.RGBA16F)
        : gl.RGBA8;
      const format = gl.RGBA;
      const type = options.float
        ? (this.capabilities.floatTextures ? gl.FLOAT : gl.HALF_FLOAT)
        : gl.UNSIGNED_BYTE;

      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format, type, null);
      
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

      const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      if (status !== gl.FRAMEBUFFER_COMPLETE) {
        throw new Error(`[WebGL2] FBO incomplete: ${status}`);
      }

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.bindTexture(gl.TEXTURE_2D, null);

      return { fbo, texture, width, height, format: internalFormat };
    }

    deleteFBO(fboObj) {
      if (!fboObj) return;
      
      const gl = this.gl;
      
      if (fboObj.fbo) {
        gl.deleteFramebuffer(fboObj.fbo);
      }
      if (fboObj.texture) {
        gl.deleteTexture(fboObj.texture);
      }
    }

    getCanvas() {
      if (!this.canvas) {
        throw new Error('[WebGL2] Canvas not initialized');
      }
      return this.canvas;
    }

    getGL() {
      if (!this.gl) {
        throw new Error('[WebGL2] GL context not initialized');
      }
      return this.gl;
    }

    getFormat() {
      return 'rgba8';
    }

    getSampleCount() {
      return 1;
    }

    isInitialized() {
      return this.initialized && this.gl !== null;
    }

    getCapabilities() {
      return { ...this.capabilities };
    }

    destroy() {
      if (this.gl) {
        const loseContext = this.gl.getExtension('WEBGL_lose_context');
        if (loseContext) {
          loseContext.loseContext();
        }
      }
      this.gl = null;
      this.canvas = null;
      this.initialized = false;
    }
  }

  window.WebGL2DrawingLayer = new WebGL2DrawingLayer();

})();