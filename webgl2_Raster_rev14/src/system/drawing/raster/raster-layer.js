/**
 * ============================================================================
 * ファイル名: system/drawing/raster/raster-layer.js
 * 責務: WebGL2フレームバッファベースেরレイヤー管理（外部GLコンテキスト使用版）
 * Phase: C-0.1 WebGL2コンテキスト統合修正版
 * ============================================================================
 */

(function() {
  'use strict';

  class RasterLayer {
    constructor() {
      this.gl = null;
      this.initialized = false;
      this.layerFramebuffers = new Map();
      this.layerTextures = new Map();
      this.canvasWidth = 400;
      this.canvasHeight = 400;
      this.autoCreateFBO = true;
      this.enableOptimization = true;
      this.savedGLState = null;
    }

    initialize(gl, width, height, options = {}) {
      if (this.initialized) return true;
      try {
        if (!gl) throw new Error('WebGL2 context not provided');
        this.gl = gl;
        this.canvasWidth = width || window.TEGAKI_CONFIG?.canvas?.width || 400;
        this.canvasHeight = height || window.TEGAKI_CONFIG?.canvas?.height || 400;
        if (options.autoCreateFBO !== undefined) this.autoCreateFBO = options.autoCreateFBO;
        if (options.enableOptimization !== undefined) this.enableOptimization = options.enableOptimization;
        this._applyOptimizationSettings();
        this.initialized = true;
        console.log('[RasterLayer] ✅ Initialized', { width: this.canvasWidth, height: this.canvasHeight });
        return true;
      } catch (error) {
        console.error('[RasterLayer] ❌ Initialization failed:', error);
        return false;
      }
    }

    _applyOptimizationSettings() {
      if (!this.enableOptimization || !this.gl) return;
      const gl = this.gl;
      this.defaultTextureParams = {
        minFilter: gl.LINEAR,
        magFilter: gl.LINEAR,
        wrapS: gl.CLAMP_TO_EDGE,
        wrapT: gl.CLAMP_TO_EDGE
      };
    }

    createLayer(layerId) {
      if (!this.initialized) return null;
      if (this.layerFramebuffers.has(layerId)) return {
        fbo: this.layerFramebuffers.get(layerId),
        texture: this.layerTextures.get(layerId)
      };
      const gl = this.gl;
      try {
        this._saveGLState();
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.canvasWidth, this.canvasHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        const fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        this._restoreGLState();
        this.layerFramebuffers.set(layerId, fbo);
        this.layerTextures.set(layerId, texture);
        return { fbo, texture };
      } catch (error) {
        console.error(`[RasterLayer] ❌ Failed to create layer ${layerId}:`, error);
        this._restoreGLState();
        return null;
      }
    }

    bindFramebuffer(layerId) {
      if (!this.gl) return false;
      const fbo = this.getFramebuffer(layerId);
      if (!fbo) {
        if (this.autoCreateFBO) {
          const newLayer = this.createLayer(layerId);
          if (newLayer) {
            this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, newLayer.fbo);
            this.gl.viewport(0, 0, this.canvasWidth, this.canvasHeight);
            return true;
          }
        }
        return false;
      }
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, fbo);
      this.gl.viewport(0, 0, this.canvasWidth, this.canvasHeight);
      return true;
    }

    getFramebuffer(layerId) { return this.layerFramebuffers.get(layerId) || null; }
    getTexture(layerId) { return this.layerTextures.get(layerId) || null; }

    _saveGLState() {
      const gl = this.gl;
      this.savedGLState = {
        viewport: gl.getParameter(gl.VIEWPORT),
        blend: gl.getParameter(gl.BLEND),
        framebuffer: gl.getParameter(gl.FRAMEBUFFER_BINDING),
        texture: gl.getParameter(gl.TEXTURE_BINDING_2D)
      };
    }

    _restoreGLState() {
      if (!this.savedGLState) return;
      const gl = this.gl;
      const s = this.savedGLState;
      if (s.viewport) gl.viewport(s.viewport[0], s.viewport[1], s.viewport[2], s.viewport[3]);
      if (s.blend) gl.enable(gl.BLEND); else gl.disable(gl.BLEND);
      gl.bindFramebuffer(gl.FRAMEBUFFER, s.framebuffer);
      gl.bindTexture(gl.TEXTURE_2D, s.texture);
      this.savedGLState = null;
    }
  }

  // Global registration
  if (!window.RasterLayer) {
    const instance = new RasterLayer();
    window.RasterLayer = instance;
    window.rasterLayer = instance;
    console.log('[RasterLayer] ✅ Global instance registered');
  }
})();
