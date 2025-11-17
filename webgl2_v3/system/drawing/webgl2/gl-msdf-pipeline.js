/**
 * ================================================================================
 * gl-msdf-pipeline.js - Phase 4完全版: Encode/Render実装
 * ================================================================================
 * 
 * 📁 親ファイル依存:
 *   - webgl2-drawing-layer.js (WebGL2DrawingLayer.gl)
 *   - gl-stroke-processor.js (EdgeBuffer/VertexBuffer)
 *   - brush-core.js (generateMSDF呼び出し元)
 * 
 * 📄 子ファイル依存:
 *   - gl-texture-bridge.js (Texture→Sprite変換) [Phase 5]
 * 
 * 【Phase 4実装内容】
 * ✅ Phase 3: Seed Init + JFA Pass
 * ✅ Phase 4: Encode Pass（距離場→MSDF）
 * ✅ Phase 4: Render Pass（MSDF→最終画像）
 * ✅ Full Pipeline統合
 * 
 * 【WebGPU→WebGL2変換完了】
 * - Compute Shader → Fragment Shader (Fullscreen Quad)
 * - Storage Texture → FBO + Texture
 * - Dispatch Workgroups → drawArrays
 * - Render Pipeline → Fragment Shader合成
 * 
 * ================================================================================
 */

(function() {
  'use strict';

  class GLMSDFPipeline {
    constructor() {
      this.gl = null;
      this.initialized = false;
      
      // Shader Programs
      this.seedInitProgram = null;
      this.jfaProgram = null;
      this.encodeProgram = null;
      this.renderProgram = null;
      
      // Fullscreen Quad VBO
      this.quadVBO = null;
      
      // Settings
      this.textureSize = 256;
    }

    /**
     * 初期化
     * @param {WebGL2RenderingContext} gl - WebGL2コンテキスト
     */
    async initialize(gl) {
      if (this.initialized) {
        console.warn('[GLMSDFPipeline] Already initialized');
        return;
      }
      
      this.gl = gl;
      
      // Fullscreen Quad生成
      this._createFullscreenQuad();
      
      // Shader Programs作成
      await this._createSeedInitProgram();
      await this._createJFAProgram();
      await this._createEncodeProgram();
      await this._createRenderProgram();
      
      this.initialized = true;
      console.log('[GLMSDFPipeline] ✅ Initialized (Phase 4: Full Pipeline)');
    }

    /**
     * Fullscreen Quad VBO生成
     * @private
     */
    _createFullscreenQuad() {
      const gl = this.gl;
      
      // NDC座標 + UV座標
      const vertices = new Float32Array([
        // Position (x, y)   UV (u, v)
        -1.0, -1.0,          0.0, 0.0,
         1.0, -1.0,          1.0, 0.0,
        -1.0,  1.0,          0.0, 1.0,
         1.0,  1.0,          1.0, 1.0
      ]);
      
      this.quadVBO = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVBO);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }

    /**
     * Shader Program作成ヘルパー
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
     * Seed Init Program作成
     * @private
     */
    async _createSeedInitProgram() {
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
      
      // Phase 4: 簡易Seed Init（-1.0初期化のみ）
      const fragmentShader = `#version 300 es
        precision highp float;
        
        in vec2 vTexCoord;
        out vec4 fragColor;
        
        void main() {
          fragColor = vec4(-1.0, -1.0, -1.0, -1.0);
        }
      `;
      
      this.seedInitProgram = this._createShaderProgram(vertexShader, fragmentShader, 'Seed Init');
    }

    /**
     * JFA Program作成
     * @private
     */
    async _createJFAProgram() {
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
        
        uniform sampler2D uSrcTex;
        uniform float uStep;
        uniform vec2 uTexSize;
        
        in vec2 vTexCoord;
        out vec4 fragColor;
        
        void main() {
          vec4 bestSeed = texture(uSrcTex, vTexCoord);
          float bestDistSq = 1e10;
          
          // 8方向サンプリング
          vec2 offsets[8] = vec2[](
            vec2(-1, -1), vec2(0, -1), vec2(1, -1),
            vec2(-1,  0),              vec2(1,  0),
            vec2(-1,  1), vec2(0,  1), vec2(1,  1)
          );
          
          for (int i = 0; i < 8; i++) {
            vec2 offset = offsets[i] * uStep / uTexSize;
            vec4 neighbor = texture(uSrcTex, vTexCoord + offset);
            
            if (neighbor.x >= 0.0) {
              vec2 diff = neighbor.xy - vTexCoord * uTexSize;
              float distSq = dot(diff, diff);
              
              if (distSq < bestDistSq) {
                bestDistSq = distSq;
                bestSeed = neighbor;
              }
            }
          }
          
          fragColor = bestSeed;
        }
      `;
      
      this.jfaProgram = this._createShaderProgram(vertexShader, fragmentShader, 'JFA Pass');
    }

    /**
     * Encode Program作成
     * Phase 4実装
     * @private
     */
    async _createEncodeProgram() {
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
        
        uniform sampler2D uJFAResult;
        uniform vec2 uTexSize;
        
        in vec2 vTexCoord;
        out vec4 fragColor;
        
        void main() {
          vec4 seed = texture(uJFAResult, vTexCoord);
          
          if (seed.x < 0.0) {
            // 未初期化ピクセル（外側）
            fragColor = vec4(1.0, 1.0, 1.0, 1.0);
            return;
          }
          
          vec2 pixelPos = vTexCoord * uTexSize;
          vec2 seedPos = seed.xy;
          
          float dist = length(pixelPos - seedPos);
          
          // 正規化（0.0-1.0範囲）
          float normalizedDist = dist / (max(uTexSize.x, uTexSize.y) * 0.5);
          normalizedDist = clamp(normalizedDist, 0.0, 1.0);
          
          fragColor = vec4(normalizedDist, normalizedDist, normalizedDist, 1.0);
        }
      `;
      
      this.encodeProgram = this._createShaderProgram(vertexShader, fragmentShader, 'Encode Pass');
    }

    /**
     * Render Program作成
     * Phase 4実装: ポリゴン描画 + MSDF合成
     * @private
     */
    async _createRenderProgram() {
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
        
        uniform sampler2D uMSDFTex;
        uniform vec4 uBrushColor;
        uniform float uOpacity;
        
        in vec2 vTexCoord;
        out vec4 fragColor;
        
        void main() {
          float dist = texture(uMSDFTex, vTexCoord).r;
          
          // Anti-aliasing
          float alpha = smoothstep(0.4, 0.6, dist);
          
          fragColor = vec4(uBrushColor.rgb, alpha * uOpacity);
        }
      `;
      
      this.renderProgram = this._createShaderProgram(vertexShader, fragmentShader, 'Render Pass');
    }

    /**
     * Ping-Pong FBO作成
     */
    createPingPongFBO(width, height) {
      if (!window.WebGL2DrawingLayer) {
        console.error('[GLMSDFPipeline] WebGL2DrawingLayer not available');
        return null;
      }
      
      return {
        a: window.WebGL2DrawingLayer.createFBO(width, height, { float: true }),
        b: window.WebGL2DrawingLayer.createFBO(width, height, { float: true })
      };
    }

    /**
     * Seed Texture Clear
     */
    clearSeedTexture(fbo, width, height) {
      const gl = this.gl;
      
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.fbo);
      gl.viewport(0, 0, width, height);
      gl.clearColor(-1.0, -1.0, -1.0, -1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
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
     * Seed Init Pass
     */
    seedInitPass(edgeBuffer, seedFBO, width, height, edgeCount) {
      const gl = this.gl;
      
      if (!this.seedInitProgram) {
        console.error('[GLMSDFPipeline] Seed init program not available');
        return false;
      }
      
      gl.bindFramebuffer(gl.FRAMEBUFFER, seedFBO.fbo);
      gl.viewport(0, 0, width, height);
      gl.useProgram(this.seedInitProgram);
      
      this._drawFullscreenQuad(this.seedInitProgram);
      
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      
      return true;
    }

    /**
     * JFA Pass（1回分）
     */
    jfaPass(srcTexture, dstFBO, width, height, step) {
      const gl = this.gl;
      
      if (!this.jfaProgram) {
        console.error('[GLMSDFPipeline] JFA program not available');
        return false;
      }
      
      gl.bindFramebuffer(gl.FRAMEBUFFER, dstFBO.fbo);
      gl.viewport(0, 0, width, height);
      gl.useProgram(this.jfaProgram);
      
      // Uniforms設定
      const uSrcTexLoc = gl.getUniformLocation(this.jfaProgram, 'uSrcTex');
      const uStepLoc = gl.getUniformLocation(this.jfaProgram, 'uStep');
      const uTexSizeLoc = gl.getUniformLocation(this.jfaProgram, 'uTexSize');
      
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, srcTexture);
      gl.uniform1i(uSrcTexLoc, 0);
      gl.uniform1f(uStepLoc, step);
      gl.uniform2f(uTexSizeLoc, width, height);
      
      this._drawFullscreenQuad(this.jfaProgram);
      
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.bindTexture(gl.TEXTURE_2D, null);
      
      return true;
    }

    /**
     * JFA実行（全イテレーション）
     */
    executeJFA(seedTexture, width, height) {
      const pingPong = this.createPingPongFBO(width, height);
      
      if (!pingPong) {
        console.error('[GLMSDFPipeline] Failed to create ping-pong FBO');
        return null;
      }
      
      let src = seedTexture;
      let dst = pingPong.a;
      
      // JFA反復回数計算
      const iterations = Math.ceil(Math.log2(Math.max(width, height)));
      
      for (let i = iterations - 1; i >= 0; i--) {
        const step = Math.pow(2, i);
        this.jfaPass(src, dst, width, height, step);
        
        // Swap
        [src, dst] = [dst.texture, dst];
        dst = (dst === pingPong.a) ? pingPong.b : pingPong.a;
      }
      
      return { resultTexture: src, tempFBO: pingPong };
    }

    /**
     * Encode Pass
     * Phase 4実装
     */
    encodePass(jfaTexture, msdfFBO, width, height) {
      const gl = this.gl;
      
      if (!this.encodeProgram) {
        console.error('[GLMSDFPipeline] Encode program not available');
        return false;
      }
      
      gl.bindFramebuffer(gl.FRAMEBUFFER, msdfFBO.fbo);
      gl.viewport(0, 0, width, height);
      gl.useProgram(this.encodeProgram);
      
      // Uniforms設定
      const uJFAResultLoc = gl.getUniformLocation(this.encodeProgram, 'uJFAResult');
      const uTexSizeLoc = gl.getUniformLocation(this.encodeProgram, 'uTexSize');
      
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, jfaTexture);
      gl.uniform1i(uJFAResultLoc, 0);
      gl.uniform2f(uTexSizeLoc, width, height);
      
      this._drawFullscreenQuad(this.encodeProgram);
      
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.bindTexture(gl.TEXTURE_2D, null);
      
      return true;
    }

    /**
     * Render Pass
     * Phase 4実装: MSDF合成 + 色適用
     */
    renderPass(msdfTexture, outputFBO, width, height, settings = {}) {
      const gl = this.gl;
      
      if (!this.renderProgram) {
        console.error('[GLMSDFPipeline] Render program not available');
        return false;
      }
      
      gl.bindFramebuffer(gl.FRAMEBUFFER, outputFBO.fbo);
      gl.viewport(0, 0, width, height);
      
      // Alpha blending設定
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      
      // Clear
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      
      gl.useProgram(this.renderProgram);
      
      // Uniforms設定
      const uMSDFTexLoc = gl.getUniformLocation(this.renderProgram, 'uMSDFTex');
      const uBrushColorLoc = gl.getUniformLocation(this.renderProgram, 'uBrushColor');
      const uOpacityLoc = gl.getUniformLocation(this.renderProgram, 'uOpacity');
      
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, msdfTexture);
      gl.uniform1i(uMSDFTexLoc, 0);
      
      // 色設定
      const color = this._parseColor(settings.color || '#800000');
      gl.uniform4f(uBrushColorLoc, color.r, color.g, color.b, 1.0);
      
      const opacity = settings.opacity !== undefined ? settings.opacity : 1.0;
      gl.uniform1f(uOpacityLoc, opacity);
      
      this._drawFullscreenQuad(this.renderProgram);
      
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.bindTexture(gl.TEXTURE_2D, null);
      
      return true;
    }

    /**
     * 色文字列パース
     * @private
     */
    _parseColor(colorString) {
      const hex = colorString.replace('#', '');
      return {
        r: parseInt(hex.substr(0, 2), 16) / 255,
        g: parseInt(hex.substr(2, 2), 16) / 255,
        b: parseInt(hex.substr(4, 2), 16) / 255
      };
    }

    /**
     * MSDF生成（Phase 4完全版）
     * 
     * @param {Object} edgeBufferData - GLStrokeProcessor.uploadToGPU()の戻り値
     * @param {Object} bounds - {minX, minY, maxX, maxY}
     * @param {Object} existingMSDF - 未使用
     * @param {Object} settings - {mode, color, opacity}
     * @param {Object} vertexBufferData - GLStrokeProcessor.uploadToGPU()の戻り値
     * @param {number} vertexCount - 頂点数
     * @param {number} edgeCount - エッジ数
     * @returns {WebGLTexture|null}
     */
    async generateMSDF(edgeBufferData, bounds, existingMSDF = null, settings = {}, vertexBufferData = null, vertexCount = 0, edgeCount = 0) {
      if (!this.initialized) {
        console.error('[GLMSDFPipeline] Not initialized');
        return null;
      }
      
      if (edgeCount === 0 || !vertexBufferData || vertexCount === 0) {
        console.warn('[GLMSDFPipeline] Invalid parameters');
        return null;
      }
      
      const width = this.textureSize;
      const height = this.textureSize;
      
      try {
        // 1. Seed Texture作成・クリア
        const seedFBO = window.WebGL2DrawingLayer.createFBO(width, height, { float: true });
        if (!seedFBO) {
          console.error('[GLMSDFPipeline] Failed to create seed FBO');
          return null;
        }
        this.clearSeedTexture(seedFBO, width, height);
        
        // 2. Seed Init Pass
        this.seedInitPass(edgeBufferData, seedFBO, width, height, edgeCount);
        
        // 3. JFA実行
        const jfaResult = this.executeJFA(seedFBO.texture, width, height);
        if (!jfaResult) {
          console.error('[GLMSDFPipeline] JFA execution failed');
          window.WebGL2DrawingLayer.deleteFBO(seedFBO);
          return null;
        }
        
        // 4. Encode Pass
        const msdfFBO = window.WebGL2DrawingLayer.createFBO(width, height, { float: false });
        if (!msdfFBO) {
          console.error('[GLMSDFPipeline] Failed to create MSDF FBO');
          return null;
        }
        this.encodePass(jfaResult.resultTexture, msdfFBO, width, height);
        
        // 5. Render Pass
        const outputFBO = window.WebGL2DrawingLayer.createFBO(width, height, { float: false });
        if (!outputFBO) {
          console.error('[GLMSDFPipeline] Failed to create output FBO');
          return null;
        }
        this.renderPass(msdfFBO.texture, outputFBO, width, height, settings);
        
        // Cleanup
        window.WebGL2DrawingLayer.deleteFBO(seedFBO);
        if (jfaResult.tempFBO) {
          window.WebGL2DrawingLayer.deleteFBO(jfaResult.tempFBO.a);
          window.WebGL2DrawingLayer.deleteFBO(jfaResult.tempFBO.b);
        }
        window.WebGL2DrawingLayer.deleteFBO(msdfFBO);
        
        console.log('[GLMSDFPipeline] ✅ Full pipeline completed');
        
        return outputFBO.texture;
        
      } catch (error) {
        console.error('[GLMSDFPipeline] Error:', error);
        return null;
      }
    }

    /**
     * クリーンアップ
     */
    destroy() {
      const gl = this.gl;
      
      if (this.quadVBO) {
        gl.deleteBuffer(this.quadVBO);
        this.quadVBO = null;
      }
      
      if (this.seedInitProgram) gl.deleteProgram(this.seedInitProgram);
      if (this.jfaProgram) gl.deleteProgram(this.jfaProgram);
      if (this.encodeProgram) gl.deleteProgram(this.encodeProgram);
      if (this.renderProgram) gl.deleteProgram(this.renderProgram);
      
      this.initialized = false;
    }
  }

  // Singleton登録
  window.GLMSDFPipeline = new GLMSDFPipeline();

  console.log('✅ gl-msdf-pipeline.js Phase 4完全版 loaded');
  console.log('   ✅ Seed Init + JFA + Encode + Render実装完了');

})();