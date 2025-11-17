/**
 * ================================================================================
 * GL MSDF Pipeline - Phase 3-4統合
 * ================================================================================
 * 
 * 【責務】
 * - MSDF（Multi-channel Signed Distance Field）生成
 * - JFA（Jump Flooding Algorithm）実装
 * - Seed Init / Encode / Render Pass
 * 
 * 【親子依存関係】
 * 親: brush-core.js
 * 子: window.WebGL2DrawingLayer
 * 
 * 【処理フロー】
 * 1. Clear Seed Texture
 * 2. Seed Init Pass（ポリゴンラスタライズ）
 * 3. JFA Iterations（Ping-pong）
 * 4. Encode Pass（Distance field生成）
 * 5. Render Pass（最終合成）
 * 
 * 【グローバル登録】
 * window.GLMSDFPipeline (Singleton)
 */

(function() {
  'use strict';

  // ========== GLSL Shaders ==========

  const VERTEX_SHADER_FULLSCREEN = `#version 300 es
    precision highp float;
    
    const vec2 positions[3] = vec2[3](
      vec2(-1.0, -1.0),
      vec2(3.0, -1.0),
      vec2(-1.0, 3.0)
    );
    
    out vec2 vUV;
    
    void main() {
      vec2 pos = positions[gl_VertexID];
      gl_Position = vec4(pos, 0.0, 1.0);
      vUV = pos * 0.5 + 0.5;
    }
  `;

  const FRAGMENT_SHADER_SEED_INIT = `#version 300 es
    precision highp float;
    
    in vec2 vUV;
    out vec4 fragColor;
    
    void main() {
      // Seed初期化: ポリゴン内部ピクセルに座標を書き込む
      fragColor = vec4(gl_FragCoord.xy, 0.0, 1.0);
    }
  `;

  const FRAGMENT_SHADER_JFA_PASS = `#version 300 es
    precision highp float;
    
    uniform sampler2D uSrcTex;
    uniform float uStep;
    uniform vec2 uTexSize;
    
    in vec2 vUV;
    out vec4 fragColor;
    
    void main() {
      vec4 bestSeed = texture(uSrcTex, vUV);
      float bestDistSq = 1e10;
      
      // 有効なSeed確認
      if (bestSeed.a > 0.5) {
        vec2 diff = gl_FragCoord.xy - bestSeed.xy;
        bestDistSq = dot(diff, diff);
      }
      
      // 8方向サンプリング
      vec2 offsets[8];
      offsets[0] = vec2(-1.0, -1.0);
      offsets[1] = vec2(0.0, -1.0);
      offsets[2] = vec2(1.0, -1.0);
      offsets[3] = vec2(-1.0, 0.0);
      offsets[4] = vec2(1.0, 0.0);
      offsets[5] = vec2(-1.0, 1.0);
      offsets[6] = vec2(0.0, 1.0);
      offsets[7] = vec2(1.0, 1.0);
      
      for (int i = 0; i < 8; i++) {
        vec2 offset = offsets[i] * uStep / uTexSize;
        vec4 neighbor = texture(uSrcTex, vUV + offset);
        
        if (neighbor.a > 0.5) {
          vec2 diff = gl_FragCoord.xy - neighbor.xy;
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

  const FRAGMENT_SHADER_ENCODE = `#version 300 es
    precision highp float;
    
    uniform sampler2D uJFAResult;
    uniform vec2 uTexSize;
    
    in vec2 vUV;
    out vec4 fragColor;
    
    void main() {
      vec4 seed = texture(uJFAResult, vUV);
      
      float dist = 1.0;
      if (seed.a > 0.5) {
        vec2 diff = gl_FragCoord.xy - seed.xy;
        dist = length(diff) / max(uTexSize.x, uTexSize.y);
      }
      
      // 正規化距離（0.0-1.0）
      fragColor = vec4(dist, dist, dist, 1.0);
    }
  `;

  const VERTEX_SHADER_POLYGON = `#version 300 es
    precision highp float;
    
    in vec2 aPosition;
    uniform vec2 uTexSize;
    
    void main() {
      vec2 pos = (aPosition / uTexSize) * 2.0 - 1.0;
      gl_Position = vec4(pos, 0.0, 1.0);
    }
  `;

  const FRAGMENT_SHADER_RENDER = `#version 300 es
    precision highp float;
    
    uniform sampler2D uMSDFTex;
    uniform vec4 uBrushColor;
    uniform float uOpacity;
    
    in vec2 vUV;
    out vec4 fragColor;
    
    void main() {
      float dist = texture(uMSDFTex, vUV).r;
      
      // Anti-aliasing
      float alpha = smoothstep(0.4, 0.6, 1.0 - dist);
      
      fragColor = vec4(uBrushColor.rgb, alpha * uOpacity);
    }
  `;

  // ========== Class Definition ==========

  class GLMSDFPipeline {
    constructor() {
      this.gl = null;
      this.programs = {};
      this.initialized = false;
    }

    initialize() {
      if (this.initialized) return true;

      if (!window.WebGL2DrawingLayer || !window.WebGL2DrawingLayer.isInitialized()) {
        console.error('[GLMSDFPipeline] WebGL2DrawingLayer not initialized');
        return false;
      }

      this.gl = window.WebGL2DrawingLayer.getGL();
      
      // Program生成
      this.programs.seedInit = this._createProgram(VERTEX_SHADER_FULLSCREEN, FRAGMENT_SHADER_SEED_INIT);
      this.programs.jfaPass = this._createProgram(VERTEX_SHADER_FULLSCREEN, FRAGMENT_SHADER_JFA_PASS);
      this.programs.encode = this._createProgram(VERTEX_SHADER_FULLSCREEN, FRAGMENT_SHADER_ENCODE);
      this.programs.polygon = this._createProgram(VERTEX_SHADER_POLYGON, FRAGMENT_SHADER_SEED_INIT);
      this.programs.render = this._createProgram(VERTEX_SHADER_FULLSCREEN, FRAGMENT_SHADER_RENDER);

      if (!this.programs.seedInit || !this.programs.jfaPass || !this.programs.encode || !this.programs.render) {
        console.error('[GLMSDFPipeline] Program compilation failed');
        return false;
      }

      this.initialized = true;
      console.log('[GLMSDFPipeline] ✅ Initialized');
      return true;
    }

    /**
     * MSDF生成メイン処理
     * @param {Object} vertexData - {buffer, vertexCount, bounds}
     * @param {Object} edgeData - {buffer, edgeCount, bounds}
     * @param {Object} settings - {color, opacity, size}
     * @returns {WebGLTexture} 最終MSDF texture
     */
    async generateMSDF(vertexData, edgeData, settings) {
      if (!this.initialized) {
        console.error('[GLMSDFPipeline] Not initialized');
        return null;
      }

      const gl = this.gl;
      const bounds = vertexData.bounds;
      
      // Texture size決定（bounds + padding）
      const padding = Math.ceil(settings.size * 2);
      const width = Math.ceil(bounds.width + padding * 2);
      const height = Math.ceil(bounds.height + padding * 2);

      // 1. Seed texture生成
      const seedFBO = window.WebGL2DrawingLayer.createFBO(width, height, { float: true });
      if (!seedFBO) {
        console.error('[GLMSDFPipeline] Seed FBO creation failed');
        return null;
      }

      // 2. Clear seed
      this._clearSeedTexture(seedFBO);

      // 3. Seed init（ポリゴンラスタライズ）
      this._seedInitPass(vertexData, seedFBO, bounds, padding);

      // 4. JFA iterations
      const jfaResult = this._executeJFA(seedFBO.texture, width, height);
      if (!jfaResult) {
        window.WebGL2DrawingLayer.deleteFBO(seedFBO);
        return null;
      }

      // 5. Encode pass
      const encodeFBO = window.WebGL2DrawingLayer.createFBO(width, height);
      this._encodePass(jfaResult, encodeFBO, width, height);

      // 6. Render pass（最終合成）
      const finalFBO = window.WebGL2DrawingLayer.createFBO(width, height);
      this._renderPass(encodeFBO.texture, finalFBO, settings);

      // Cleanup
      window.WebGL2DrawingLayer.deleteFBO(seedFBO);
      window.WebGL2DrawingLayer.deleteFBO(jfaResult.fbo);
      window.WebGL2DrawingLayer.deleteFBO(encodeFBO);

      return finalFBO.texture;
    }

    // ========== Internal Methods ==========

    _clearSeedTexture(fbo) {
      const gl = this.gl;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.fbo);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    _seedInitPass(vertexData, seedFBO, bounds, padding) {
      const gl = this.gl;
      
      // VBO作成
      const vbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      
      // 座標をTexture空間に変換（bounds + padding考慮）
      const transformedVertices = new Float32Array(vertexData.buffer.length);
      for (let i = 0; i < vertexData.buffer.length; i += 2) {
        transformedVertices[i + 0] = vertexData.buffer[i + 0] - bounds.minX + padding;
        transformedVertices[i + 1] = vertexData.buffer[i + 1] - bounds.minY + padding;
      }
      
      gl.bufferData(gl.ARRAY_BUFFER, transformedVertices, gl.STATIC_DRAW);

      // Render
      gl.bindFramebuffer(gl.FRAMEBUFFER, seedFBO.fbo);
      gl.viewport(0, 0, seedFBO.width, seedFBO.height);
      
      const program = this.programs.polygon;
      gl.useProgram(program);
      
      const aPosition = gl.getAttribLocation(program, 'aPosition');
      gl.enableVertexAttribArray(aPosition);
      gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);
      
      const uTexSize = gl.getUniformLocation(program, 'uTexSize');
      gl.uniform2f(uTexSize, seedFBO.width, seedFBO.height);
      
      gl.drawArrays(gl.TRIANGLES, 0, vertexData.vertexCount);
      
      gl.disableVertexAttribArray(aPosition);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.deleteBuffer(vbo);
    }

    _executeJFA(seedTexture, width, height) {
      const gl = this.gl;
      
      // Ping-pong FBO
      const fboA = window.WebGL2DrawingLayer.createFBO(width, height, { float: true });
      const fboB = window.WebGL2DrawingLayer.createFBO(width, height, { float: true });
      
      if (!fboA || !fboB) return null;

      // 初期コピー（seed → fboA）
      this._copyTexture(seedTexture, fboA, width, height);

      let srcFBO = fboA;
      let dstFBO = fboB;

      // JFA iterations
      const iterations = Math.ceil(Math.log2(Math.max(width, height)));
      const program = this.programs.jfaPass;
      
      for (let i = iterations - 1; i >= 0; i--) {
        const step = Math.pow(2, i);
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, dstFBO.fbo);
        gl.viewport(0, 0, width, height);
        gl.useProgram(program);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, srcFBO.texture);
        gl.uniform1i(gl.getUniformLocation(program, 'uSrcTex'), 0);
        gl.uniform1f(gl.getUniformLocation(program, 'uStep'), step);
        gl.uniform2f(gl.getUniformLocation(program, 'uTexSize'), width, height);
        
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        
        // Swap
        [srcFBO, dstFBO] = [dstFBO, srcFBO];
      }

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      
      // 不要なFBO削除
      if (srcFBO === fboB) {
        window.WebGL2DrawingLayer.deleteFBO(fboA);
        return fboB;
      } else {
        window.WebGL2DrawingLayer.deleteFBO(fboB);
        return fboA;
      }
    }

    _encodePass(jfaTexture, dstFBO, width, height) {
      const gl = this.gl;
      const program = this.programs.encode;
      
      gl.bindFramebuffer(gl.FRAMEBUFFER, dstFBO.fbo);
      gl.viewport(0, 0, width, height);
      gl.useProgram(program);
      
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, jfaTexture);
      gl.uniform1i(gl.getUniformLocation(program, 'uJFAResult'), 0);
      gl.uniform2f(gl.getUniformLocation(program, 'uTexSize'), width, height);
      
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    _renderPass(msdfTexture, dstFBO, settings) {
      const gl = this.gl;
      const program = this.programs.render;
      
      gl.bindFramebuffer(gl.FRAMEBUFFER, dstFBO.fbo);
      gl.viewport(0, 0, dstFBO.width, dstFBO.height);
      gl.useProgram(program);
      
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, msdfTexture);
      gl.uniform1i(gl.getUniformLocation(program, 'uMSDFTex'), 0);
      
      const color = settings.color || [0.5, 0.1, 0.1, 1.0];
      gl.uniform4f(gl.getUniformLocation(program, 'uBrushColor'), ...color);
      gl.uniform1f(gl.getUniformLocation(program, 'uOpacity'), settings.opacity || 1.0);
      
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    _copyTexture(srcTexture, dstFBO, width, height) {
      const gl = this.gl;
      gl.bindFramebuffer(gl.FRAMEBUFFER, dstFBO.fbo);
      gl.viewport(0, 0, width, height);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, srcTexture);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    _createProgram(vertexSrc, fragmentSrc) {
      const gl = this.gl;
      
      const vs = this._compileShader(gl.VERTEX_SHADER, vertexSrc);
      const fs = this._compileShader(gl.FRAGMENT_SHADER, fragmentSrc);
      
      if (!vs || !fs) return null;
      
      const program = gl.createProgram();
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('[GLMSDFPipeline] Program link error:', gl.getProgramInfoLog(program));
        return null;
      }
      
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      
      return program;
    }

    _compileShader(type, source) {
      const gl = this.gl;
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('[GLMSDFPipeline] Shader compile error:', gl.getShaderInfoLog(shader));
        return null;
      }
      
      return shader;
    }
  }

  // Singleton登録
  window.GLMSDFPipeline = new GLMSDFPipeline();

  console.log('✅ gl-msdf-pipeline.js Phase 3-4統合版 loaded');

})();