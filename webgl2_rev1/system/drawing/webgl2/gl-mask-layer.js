/**
 * ================================================================================
 * gl-mask-layer.js - Phase 6完全版: 消しゴムマスク処理
 * ================================================================================
 * 
 * 📁 親ファイル依存:
 *   - webgl2-drawing-layer.js (WebGL2DrawingLayer.gl)
 *   - brush-core.js (_applyEraserMask呼び出し元)
 * 
 * 📄 子ファイル依存:
 *   - なし（最下層GPU処理）
 * 
 * 【Phase 6実装内容】
 * ✅ 消しゴムマスクFBO管理
 * ✅ Circle mask rendering（Fragment shader）
 * ✅ Additive blend対応
 * ✅ Mask texture取得API
 * ✅ Compose Pass統合準備
 * 
 * 【機能】
 * - 消しゴムストローク→マスクテクスチャ変換
 * - ポリゴンペン描画結果へのマスク適用
 * - Soft edge対応（smoothstep）
 * 
 * ================================================================================
 */

(function() {
  'use strict';

  class GLMaskLayer {
    constructor() {
      this.gl = null;
      this.initialized = false;
      
      this.maskFBO = null;
      this.width = 0;
      this.height = 0;
      
      this.circleMaskProgram = null;
      this.composeProgram = null;
      this.quadVBO = null;
    }

    /**
     * 初期化
     * @param {number} width - マスクテクスチャ幅
     * @param {number} height - マスクテクスチャ高さ
     * @returns {Promise<boolean>}
     */
    async initialize(width, height) {
      if (this.initialized) {
        console.warn('[GLMaskLayer] Already initialized');
        return true;
      }

      if (!window.WebGL2DrawingLayer?.isInitialized()) {
        console.error('[GLMaskLayer] WebGL2DrawingLayer not initialized');
        return false;
      }

      this.gl = window.WebGL2DrawingLayer.getGL();
      this.width = width;
      this.height = height;

      // Mask FBO作成
      this.maskFBO = window.WebGL2DrawingLayer.createFBO(width, height, { float: false });
      if (!this.maskFBO) {
        console.error('[GLMaskLayer] Failed to create mask FBO');
        return false;
      }

      // Shader初期化
      this._createFullscreenQuad();
      await this._createCircleMaskProgram();
      await this._createComposeProgram();

      // マスククリア
      this.clearMask();

      this.initialized = true;
      console.log('[GLMaskLayer] ✅ Initialized', { width, height });
      return true;
    }

    /**
     * Fullscreen Quad VBO生成
     * @private
     */
    _createFullscreenQuad() {
      const gl = this.gl;
      
      const vertices = new Float32Array([
        -1.0, -1.0,  0.0, 0.0,
         1.0, -1.0,  1.0, 0.0,
        -1.0,  1.0,  0.0, 1.0,
         1.0,  1.0,  1.0, 1.0
      ]);
      
      this.quadVBO = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVBO);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }

    /**
     * Shader Program生成ヘルパー
     * @private
     */
    _createShaderProgram(vertexSource, fragmentSource, label = 'Shader') {
      const gl = this.gl;
      
      const vertexShader = gl.createShader(gl.VERTEX_SHADER);
      gl.shaderSource(vertexShader, vertexSource);
      gl.compileShader(vertexShader);
      
      if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        console.error(`[${label}] Vertex shader compile error:`, gl.getShaderInfoLog(vertexShader));
        return null;
      }
      
      const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
      gl.shaderSource(fragmentShader, fragmentSource);
      gl.compileShader(fragmentShader);
      
      if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        console.error(`[${label}] Fragment shader compile error:`, gl.getShaderInfoLog(fragmentShader));
        return null;
      }
      
      const program = gl.createProgram();
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error(`[${label}] Program link error:`, gl.getProgramInfoLog(program));
        return null;
      }
      
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      
      return program;
    }

    /**
     * Circle Mask Shader作成
     * @private
     */
    async _createCircleMaskProgram() {
      const vertexShader = `#version 300 es
        precision highp float;
        in vec2 aPosition;
        in vec2 aTexCoord;
        out vec2 vTexCoord;
        
        void main() {
          gl_Position = vec4(aPosition, 0.0, 1.0);
          vTexCoord = aTexCoord;
        }
      `;
      
      const fragmentShader = `#version 300 es
        precision highp float;
        uniform vec2 uCenter;        // 円の中心座標（ピクセル座標）
        uniform float uRadius;       // 円の半径（ピクセル）
        uniform vec2 uTexSize;       // テクスチャサイズ
        uniform float uSoftness;     // エッジのソフトネス
        
        in vec2 vTexCoord;
        out vec4 fragColor;
        
        void main() {
          vec2 pixelPos = vTexCoord * uTexSize;
          float dist = length(pixelPos - uCenter);
          
          // ソフトエッジ適用
          float softRadius = uRadius * (1.0 - uSoftness);
          float alpha = 1.0 - smoothstep(softRadius, uRadius, dist);
          
          // 既存マスク値に加算（Additive blend）
          fragColor = vec4(alpha, alpha, alpha, alpha);
        }
      `;
      
      this.circleMaskProgram = this._createShaderProgram(
        vertexShader, 
        fragmentShader, 
        'Circle Mask'
      );
    }

    /**
     * Compose Shader作成（ペン描画結果へのマスク適用）
     * @private
     */
    async _createComposeProgram() {
      const vertexShader = `#version 300 es
        precision highp float;
        in vec2 aPosition;
        in vec2 aTexCoord;
        out vec2 vTexCoord;
        
        void main() {
          gl_Position = vec4(aPosition, 0.0, 1.0);
          vTexCoord = aTexCoord;
        }
      `;
      
      const fragmentShader = `#version 300 es
        precision highp float;
        uniform sampler2D uSourceTex;  // ペン描画結果
        uniform sampler2D uMaskTex;    // マスクテクスチャ
        
        in vec2 vTexCoord;
        out vec4 fragColor;
        
        void main() {
          vec4 source = texture(uSourceTex, vTexCoord);
          float mask = texture(uMaskTex, vTexCoord).r;
          
          // マスク値でalpha減算
          float maskedAlpha = source.a * (1.0 - mask);
          fragColor = vec4(source.rgb, maskedAlpha);
        }
      `;
      
      this.composeProgram = this._createShaderProgram(
        vertexShader, 
        fragmentShader, 
        'Compose'
      );
    }

    /**
     * Fullscreen Quad描画
     * @private
     */
    _drawFullscreenQuad(program) {
      const gl = this.gl;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVBO);
      
      const aPosition = gl.getAttribLocation(program, 'aPosition');
      const aTexCoord = gl.getAttribLocation(program, 'aTexCoord');
      
      if (aPosition >= 0) {
        gl.enableVertexAttribArray(aPosition);
        gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 16, 0);
      }
      
      if (aTexCoord >= 0) {
        gl.enableVertexAttribArray(aTexCoord);
        gl.vertexAttribPointer(aTexCoord, 2, gl.FLOAT, false, 16, 8);
      }
      
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      
      if (aPosition >= 0) gl.disableVertexAttribArray(aPosition);
      if (aTexCoord >= 0) gl.disableVertexAttribArray(aTexCoord);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }

    /**
     * マスククリア
     */
    clearMask() {
      if (!this.maskFBO) return;
      
      const gl = this.gl;
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.maskFBO.fbo);
      gl.viewport(0, 0, this.width, this.height);
      gl.clearColor(0.0, 0.0, 0.0, 0.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    /**
     * Circle Mask描画
     * @param {number} x - 中心X座標（ピクセル）
     * @param {number} y - 中心Y座標（ピクセル）
     * @param {number} radius - 半径（ピクセル）
     * @param {number} softness - ソフトネス（0.0-1.0）
     */
    renderCircleMask(x, y, radius, softness = 0.2) {
      if (!this.initialized || !this.circleMaskProgram) {
        console.warn('[GLMaskLayer] Not initialized');
        return;
      }
      
      const gl = this.gl;
      
      // FBO bind
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.maskFBO.fbo);
      gl.viewport(0, 0, this.width, this.height);
      
      // Additive blend設定
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      
      // Shader使用
      gl.useProgram(this.circleMaskProgram);
      
      // Uniform設定
      const uCenterLoc = gl.getUniformLocation(this.circleMaskProgram, 'uCenter');
      const uRadiusLoc = gl.getUniformLocation(this.circleMaskProgram, 'uRadius');
      const uTexSizeLoc = gl.getUniformLocation(this.circleMaskProgram, 'uTexSize');
      const uSoftnessLoc = gl.getUniformLocation(this.circleMaskProgram, 'uSoftness');
      
      gl.uniform2f(uCenterLoc, x, y);
      gl.uniform1f(uRadiusLoc, radius);
      gl.uniform2f(uTexSizeLoc, this.width, this.height);
      gl.uniform1f(uSoftnessLoc, softness);
      
      // 描画
      this._drawFullscreenQuad(this.circleMaskProgram);
      
      // Cleanup
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.disable(gl.BLEND);
    }

    /**
     * ストロークからマスク生成
     * @param {Array} points - ストロークポイント配列
     * @param {number} brushSize - ブラシサイズ
     */
    renderStrokeMask(points, brushSize) {
      if (!points || points.length < 1) return;
      
      // 既存マスククリア
      this.clearMask();
      
      const radius = brushSize / 2;
      const softness = 0.3;
      
      // 各ポイントにCircle Mask描画
      for (const point of points) {
        this.renderCircleMask(point.x, point.y, radius, softness);
      }
      
      // ポイント間を補間
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i];
        const p1 = points[i + 1];
        
        const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
        const steps = Math.ceil(dist / (radius * 0.5));
        
        for (let j = 1; j < steps; j++) {
          const t = j / steps;
          const x = p0.x + (p1.x - p0.x) * t;
          const y = p0.y + (p1.y - p0.y) * t;
          this.renderCircleMask(x, y, radius, softness);
        }
      }
    }

    /**
     * Mask適用（Compose Pass）
     * @param {WebGLTexture} sourceTexture - ペン描画結果
     * @param {Object} outputFBO - 出力先FBO
     * @returns {boolean} 成功時true
     */
    applyMask(sourceTexture, outputFBO) {
      if (!this.initialized || !this.composeProgram) {
        console.warn('[GLMaskLayer] Not initialized');
        return false;
      }
      
      const gl = this.gl;
      
      // Output FBO bind
      gl.bindFramebuffer(gl.FRAMEBUFFER, outputFBO.fbo);
      gl.viewport(0, 0, outputFBO.width, outputFBO.height);
      
      // Blendモード設定
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      
      // Shader使用
      gl.useProgram(this.composeProgram);
      
      // Texture bind
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
      const uSourceTexLoc = gl.getUniformLocation(this.composeProgram, 'uSourceTex');
      gl.uniform1i(uSourceTexLoc, 0);
      
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.maskFBO.texture);
      const uMaskTexLoc = gl.getUniformLocation(this.composeProgram, 'uMaskTex');
      gl.uniform1i(uMaskTexLoc, 1);
      
      // 描画
      this._drawFullscreenQuad(this.composeProgram);
      
      // Cleanup
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, null);
      
      return true;
    }

    /**
     * Mask Texture取得
     * @returns {WebGLTexture|null}
     */
    getMaskTexture() {
      return this.maskFBO?.texture || null;
    }

    /**
     * サイズ変更
     * @param {number} width - 新しい幅
     * @param {number} height - 新しい高さ
     */
    resize(width, height) {
      if (!this.initialized) return;
      
      // 既存FBO削除
      if (this.maskFBO) {
        window.WebGL2DrawingLayer.deleteFBO(this.maskFBO);
      }
      
      // 新しいFBO作成
      this.width = width;
      this.height = height;
      this.maskFBO = window.WebGL2DrawingLayer.createFBO(width, height, { float: false });
      
      if (this.maskFBO) {
        this.clearMask();
      }
    }

    /**
     * クリーンアップ
     */
    destroy() {
      const gl = this.gl;
      
      if (this.maskFBO) {
        window.WebGL2DrawingLayer.deleteFBO(this.maskFBO);
        this.maskFBO = null;
      }
      
      if (this.quadVBO) {
        gl.deleteBuffer(this.quadVBO);
        this.quadVBO = null;
      }
      
      if (this.circleMaskProgram) {
        gl.deleteProgram(this.circleMaskProgram);
        this.circleMaskProgram = null;
      }
      
      if (this.composeProgram) {
        gl.deleteProgram(this.composeProgram);
        this.composeProgram = null;
      }
      
      this.initialized = false;
      this.gl = null;
    }
  }

  // Singleton登録
  window.GLMaskLayer = new GLMaskLayer();

  console.log('✅ gl-mask-layer.js Phase 6完全版 loaded');
  console.log('   ✅ Circle mask rendering実装');
  console.log('   ✅ Additive blend対応');
  console.log('   ✅ Compose Pass統合準備完了');

})();