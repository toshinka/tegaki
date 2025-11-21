/**
 * ================================================================================
 * gl-msdf-pipeline.js - Phase 3.2アスペクト比保持改善版
 * ================================================================================
 * 
 * 📁 親依存:
 *   - webgl2-drawing-layer.js (WebGL2DrawingLayer.gl, createFBO, deleteFBO)
 *   - gl-stroke-processor.js (EdgeBuffer/VertexBuffer: 7 floats/vertex)
 * 
 * 📄 子依存:
 *   - brush-core.js (generateMSDF呼び出し元)
 *   - gl-texture-bridge.js (生成されたTextureを受け取る)
 * 
 * 🔧 Phase 3.2改修内容:
 *   🔧 テクスチャサイズ計算でアスペクト比を厳密保持
 *   🔧 2の累乗丸めによるストローク変形を防止
 *   ✅ Phase 2.0の全機能を完全継承
 * 
 * 責務:
 *   - MSDF距離場生成（JFA: Jump Flooding Algorithm）
 *   - Seed初期化 → JFA実行 → エンコード → レンダリング
 *   - WebGLTexture出力（動的サイズ・アスペクト比保持）
 * 
 * ================================================================================
 */

(function() {
  'use strict';

  class GLMSDFPipeline {
    constructor() {
      this.gl = null;
      this.initialized = false;
      
      this.seedInitProgram = null;
      this.jfaProgram = null;
      this.encodeProgram = null;
      this.renderProgram = null;
      
      this.quadVBO = null;
      
      this.minTextureSize = 64;
      this.maxTextureSize = 4096;
    }

    /**
     * 初期化
     * @param {WebGL2RenderingContext} gl - WebGL2コンテキスト
     */
    async initialize(gl) {
      if (this.initialized) return;
      
      this.gl = gl;
      
      this._createFullscreenQuad();
      
      await this._createSeedInitProgram();
      await this._createJFAProgram();
      await this._createEncodeProgram();
      await this._createRenderProgram();
      
      this.initialized = true;
    }

    /**
     * フルスクリーンクアッド生成
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
     * シェーダープログラム生成
     * @private
     */
    _createShaderProgram(vertexSource, fragmentSource, label = 'Shader') {
      const gl = this.gl;
      
      const vertexShader = gl.createShader(gl.VERTEX_SHADER);
      gl.shaderSource(vertexShader, vertexSource);
      gl.compileShader(vertexShader);
      
      if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        console.error(`[${label}] Vertex shader error:`, gl.getShaderInfoLog(vertexShader));
        return null;
      }
      
      const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
      gl.shaderSource(fragmentShader, fragmentSource);
      gl.compileShader(fragmentShader);
      
      if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        console.error(`[${label}] Fragment shader error:`, gl.getShaderInfoLog(fragmentShader));
        return null;
      }
      
      const program = gl.createProgram();
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error(`[${label}] Link error:`, gl.getProgramInfoLog(program));
        return null;
      }
      
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      
      return program;
    }

    /**
     * Seed初期化プログラム生成
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
     * JFAプログラム生成
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
     * エンコードプログラム生成
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
            fragColor = vec4(1.0, 1.0, 1.0, 1.0);
            return;
          }
          
          vec2 pixelPos = vTexCoord * uTexSize;
          vec2 seedPos = seed.xy;
          float dist = length(pixelPos - seedPos);
          float normalizedDist = dist / (max(uTexSize.x, uTexSize.y) * 0.5);
          normalizedDist = clamp(normalizedDist, 0.0, 1.0);
          
          fragColor = vec4(normalizedDist, normalizedDist, normalizedDist, 1.0);
        }
      `;
      
      this.encodeProgram = this._createShaderProgram(vertexShader, fragmentShader, 'Encode Pass');
    }

    /**
     * レンダリングプログラム生成
     * Phase 1.9の座標変換を継承
     * @private
     */
    async _createRenderProgram() {
      const vertexShader = `#version 300 es
        precision highp float;
        
        layout(location = 0) in vec2 aPosition;
        layout(location = 1) in vec2 aTexCoord;
        layout(location = 2) in vec3 aReserved;
        
        uniform vec2 uBoundsMin;
        uniform vec2 uBoundsSize;
        
        out vec2 vTexCoord;
        
        void main() {
          vec2 boundsRelative = aPosition - uBoundsMin;
          vec2 normalized = boundsRelative / uBoundsSize;
          vec2 clipSpace = normalized * 2.0 - 1.0;
          clipSpace.y = -clipSpace.y;
          
          gl_Position = vec4(clipSpace, 0.0, 1.0);
          vTexCoord = normalized;
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
          float alpha = smoothstep(0.4, 0.6, dist);
          
          fragColor = vec4(uBrushColor.rgb, alpha * uOpacity);
        }
      `;
      
      this.renderProgram = this._createShaderProgram(vertexShader, fragmentShader, 'Render Pass');
    }

    /**
     * 🔧 Phase 3.2: テクスチャサイズ計算（アスペクト比厳密保持）
     * @param {Object} bounds - バウンディングボックス
     * @returns {{width: number, height: number}}
     */
    _calculateTextureSize(bounds) {
      if (!bounds || !bounds.width || !bounds.height) {
        return { width: this.minTextureSize, height: this.minTextureSize };
      }

      let width = Math.ceil(bounds.width);
      let height = Math.ceil(bounds.height);

      // 元のアスペクト比を記録
      const originalAspectRatio = width / height;

      // 範囲制限（2の累乗前）
      width = Math.max(this.minTextureSize, Math.min(width, this.maxTextureSize));
      height = Math.max(this.minTextureSize, Math.min(height, this.maxTextureSize));

      // 2の累乗に丸める
      const pow2Width = Math.pow(2, Math.ceil(Math.log2(width)));
      const pow2Height = Math.pow(2, Math.ceil(Math.log2(height)));

      // 🔧 Phase 3.2: アスペクト比保持補正
      const pow2AspectRatio = pow2Width / pow2Height;
      const aspectDiff = Math.abs(pow2AspectRatio - originalAspectRatio);

      // アスペクト比の差が10%以上の場合は補正
      if (aspectDiff > 0.1) {
        if (originalAspectRatio > pow2AspectRatio) {
          // 横長の場合: widthを調整
          const correctedWidth = Math.pow(2, Math.ceil(Math.log2(pow2Height * originalAspectRatio)));
          if (correctedWidth <= this.maxTextureSize) {
            return { width: correctedWidth, height: pow2Height };
          }
        } else {
          // 縦長の場合: heightを調整
          const correctedHeight = Math.pow(2, Math.ceil(Math.log2(pow2Width / originalAspectRatio)));
          if (correctedHeight <= this.maxTextureSize) {
            return { width: pow2Width, height: correctedHeight };
          }
        }
      }

      // 補正不要または補正後も最大サイズを超える場合は2の累乗値をそのまま使用
      return { width: pow2Width, height: pow2Height };
    }

    /**
     * PingPong FBO生成
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
     * Seedテクスチャクリア
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
     * フルスクリーンクアッド描画
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
     * ストローク描画（7 floats/vertex）
     * @private
     */
    _drawStroke(program, vbo, vertexCount, bounds) {
      const gl = this.gl;
      
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      
      const stride = 7 * 4;
      
      const aPosition = gl.getAttribLocation(program, 'aPosition');
      if (aPosition >= 0) {
        gl.enableVertexAttribArray(aPosition);
        gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, stride, 0);
      }
      
      const aTexCoord = gl.getAttribLocation(program, 'aTexCoord');
      if (aTexCoord >= 0) {
        gl.enableVertexAttribArray(aTexCoord);
        gl.vertexAttribPointer(aTexCoord, 2, gl.FLOAT, false, stride, 8);
      }
      
      const aReserved = gl.getAttribLocation(program, 'aReserved');
      if (aReserved >= 0) {
        gl.enableVertexAttribArray(aReserved);
        gl.vertexAttribPointer(aReserved, 3, gl.FLOAT, false, stride, 16);
      }
      
      const uBoundsMin = gl.getUniformLocation(program, 'uBoundsMin');
      if (uBoundsMin && bounds) {
        gl.uniform2f(uBoundsMin, bounds.minX, bounds.minY);
      }
      
      const uBoundsSize = gl.getUniformLocation(program, 'uBoundsSize');
      if (uBoundsSize && bounds) {
        gl.uniform2f(uBoundsSize, bounds.width, bounds.height);
      }
      
      gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
      
      if (aPosition >= 0) gl.disableVertexAttribArray(aPosition);
      if (aTexCoord >= 0) gl.disableVertexAttribArray(aTexCoord);
      if (aReserved >= 0) gl.disableVertexAttribArray(aReserved);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }

    /**
     * Seed初期化パス
     */
    seedInitPass(edgeBuffer, seedFBO, width, height, edgeCount) {
      const gl = this.gl;
      if (!this.seedInitProgram) return false;
      
      gl.bindFramebuffer(gl.FRAMEBUFFER, seedFBO.fbo);
      gl.viewport(0, 0, width, height);
      gl.useProgram(this.seedInitProgram);
      this._drawFullscreenQuad(this.seedInitProgram);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return true;
    }

    /**
     * JFAパス（1回）
     */
    jfaPass(srcTexture, dstFBO, width, height, step) {
      const gl = this.gl;
      if (!this.jfaProgram) return false;
      
      gl.bindFramebuffer(gl.FRAMEBUFFER, dstFBO.fbo);
      gl.viewport(0, 0, width, height);
      gl.useProgram(this.jfaProgram);
      
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
     * JFA実行（複数パス）
     */
    executeJFA(seedTexture, width, height) {
      const pingPong = this.createPingPongFBO(width, height);
      if (!pingPong) return null;
      
      let src = seedTexture;
      let dst = pingPong.a;
      
      const iterations = Math.ceil(Math.log2(Math.max(width, height)));
      
      for (let i = iterations - 1; i >= 0; i--) {
        const step = Math.pow(2, i);
        this.jfaPass(src, dst, width, height, step);
        [src, dst] = [dst.texture, dst];
        dst = (dst === pingPong.a) ? pingPong.b : pingPong.a;
      }
      
      return { resultTexture: src, tempFBO: pingPong };
    }

    /**
     * エンコードパス
     */
    encodePass(jfaTexture, msdfFBO, width, height) {
      const gl = this.gl;
      if (!this.encodeProgram) return false;
      
      gl.bindFramebuffer(gl.FRAMEBUFFER, msdfFBO.fbo);
      gl.viewport(0, 0, width, height);
      gl.useProgram(this.encodeProgram);
      
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
     * レンダリングパス
     */
    renderPass(msdfTexture, outputFBO, width, height, settings = {}, vertexBuffer = null, vertexCount = 0, bounds = null) {
      const gl = this.gl;
      if (!this.renderProgram) return false;
      
      gl.bindFramebuffer(gl.FRAMEBUFFER, outputFBO.fbo);
      gl.viewport(0, 0, width, height);
      
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      
      gl.useProgram(this.renderProgram);
      
      const uMSDFTexLoc = gl.getUniformLocation(this.renderProgram, 'uMSDFTex');
      const uBrushColorLoc = gl.getUniformLocation(this.renderProgram, 'uBrushColor');
      const uOpacityLoc = gl.getUniformLocation(this.renderProgram, 'uOpacity');
      
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, msdfTexture);
      gl.uniform1i(uMSDFTexLoc, 0);
      
      const color = this._parseColor(settings.color || '#800000');
      gl.uniform4f(uBrushColorLoc, color.r, color.g, color.b, 1.0);
      
      const opacity = settings.opacity !== undefined ? settings.opacity : 1.0;
      gl.uniform1f(uOpacityLoc, opacity);
      
      if (vertexBuffer && vertexCount > 0 && bounds) {
        this._drawStroke(this.renderProgram, vertexBuffer, vertexCount, bounds);
      } else {
        this._drawFullscreenQuad(this.renderProgram);
      }
      
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.bindTexture(gl.TEXTURE_2D, null);
      return true;
    }

    /**
     * カラー文字列パース
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
     * MSDF生成（メイン処理）
     * 🔧 Phase 3.2: アスペクト比保持テクスチャサイズ対応
     * 
     * @returns {Object|null} { texture: WebGLTexture, width: number, height: number }
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
      
      const textureSize = this._calculateTextureSize(bounds);
      const width = textureSize.width;
      const height = textureSize.height;
      
      try {
        const seedFBO = window.WebGL2DrawingLayer.createFBO(width, height, { float: true });
        if (!seedFBO) return null;
        
        this.clearSeedTexture(seedFBO, width, height);
        this.seedInitPass(edgeBufferData, seedFBO, width, height, edgeCount);
        
        const jfaResult = this.executeJFA(seedFBO.texture, width, height);
        if (!jfaResult) {
          window.WebGL2DrawingLayer.deleteFBO(seedFBO);
          return null;
        }
        
        const msdfFBO = window.WebGL2DrawingLayer.createFBO(width, height, { float: false });
        if (!msdfFBO) return null;
        this.encodePass(jfaResult.resultTexture, msdfFBO, width, height);
        
        const outputFBO = window.WebGL2DrawingLayer.createFBO(width, height, { float: false });
        if (!outputFBO) return null;
        
        this.renderPass(msdfFBO.texture, outputFBO, width, height, settings, vertexBufferData, vertexCount, bounds);
        
        window.WebGL2DrawingLayer.deleteFBO(seedFBO);
        if (jfaResult.tempFBO) {
          window.WebGL2DrawingLayer.deleteFBO(jfaResult.tempFBO.a);
          window.WebGL2DrawingLayer.deleteFBO(jfaResult.tempFBO.b);
        }
        window.WebGL2DrawingLayer.deleteFBO(msdfFBO);
        
        return {
          texture: outputFBO.texture,
          width: width,
          height: height
        };
        
      } catch (error) {
        console.error('[GLMSDFPipeline] Error:', error);
        return null;
      }
    }

    /**
     * 破棄
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

  window.GLMSDFPipeline = new GLMSDFPipeline();
  console.log('✅ gl-msdf-pipeline.js Phase 3.2 アスペクト比保持改善版 loaded');
  console.log('   🔧 テクスチャサイズ計算でアスペクト比を厳密保持');
  console.log('   🔧 2の累乗丸めによるストローク変形を防止');

})();