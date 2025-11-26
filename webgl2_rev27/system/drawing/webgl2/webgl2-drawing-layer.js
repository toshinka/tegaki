/**
 * ================================================================================
 * WebGL2 Drawing Layer - Phase 3.6 独自実装完全対応版
 * ================================================================================
 * 
 * 【責務】
 * - WebGL2 context初期化・管理
 * - Shader/Program作成・管理
 * - FBO（FrameBuffer Object）生成・削除
 * - Extension確認・取得
 * - GLStrokeProcessor統合
 * 
 * 【親依存】
 * - core-initializer.js (initializeWebGL2から呼び出し)
 * 
 * 【子依存】
 * - gl-stroke-processor.js (独自リボン生成実装)
 * - gl-msdf-pipeline.js
 * - gl-texture-bridge.js
 * - gl-mask-layer.js
 * 
 * 【グローバル登録】
 * ✅ window.WebGLContext (Singleton)
 * ✅ window.WebGL2DrawingLayer (エイリアス)
 * 
 * 【Phase 3.6 改修内容】
 * ✅ Perfect-Freehand完全削除（依存ゼロ）
 * ✅ 独自リボン生成のみ使用
 * ✅ 不要なログ削減
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
      this.programs = {};
      this.shaders = {};
      this.glStrokeProcessor = null;
    }

    /**
     * WebGL2コンテキスト初期化
     * @param {HTMLCanvasElement} [canvas] - Canvas要素（オプション）
     * @returns {Promise<boolean>} 成功時true
     */
    async initialize(canvas) {
      if (this.initialized) {
        console.warn('[WebGL2] Already initialized');
        return true;
      }

      try {
        // Canvas取得ロジック
        if (canvas) {
          this.canvas = canvas;
        } else {
          // 優先順位: webgl2-canvas > webgpu-canvas > 最初のcanvas
          this.canvas = document.getElementById('webgl2-canvas') || 
                        document.getElementById('webgpu-canvas') ||
                        document.querySelector('canvas');
        }
        
        if (!this.canvas) {
          console.error('[WebGL2] ❌ Canvas not found');
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
          console.error('[WebGL2] ❌ WebGL2 not supported');
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
        
        console.log('[WebGL2] ✅ Initialized', {
          canvasSize: `${this.canvas.width}x${this.canvas.height}`,
          maxTextureSize: this.maxTextureSize
        });

        // GLStrokeProcessor初期化
        this._initializeGLStrokeProcessor();

        return true;

      } catch (error) {
        console.error('[WebGL2] Initialization error:', error);
        return false;
      }
    }

    /**
     * GLStrokeProcessor初期化（独自実装版）
     * @private
     */
    _initializeGLStrokeProcessor() {
      try {
        if (typeof window.GLStrokeProcessor === 'undefined') {
          console.warn('[WebGL2] GLStrokeProcessor not loaded');
          return;
        }

        // Earcut必須チェック
        if (typeof window.earcut === 'undefined') {
          console.error('[WebGL2] Earcut not loaded - required for triangulation');
          return;
        }

        // GLStrokeProcessorインスタンス生成
        this.glStrokeProcessor = new window.GLStrokeProcessor(this.gl);
        
        if (this.glStrokeProcessor.initialize()) {
          console.log('[WebGL2] ✅ GLStrokeProcessor ready (独自リボン生成)');
          
          // デバッグAPI登録
          if (window.TegakiDebug) {
            window.TegakiDebug.glStroke = this.glStrokeProcessor;
          }
        } else {
          console.error('[WebGL2] GLStrokeProcessor initialization failed');
          this.glStrokeProcessor = null;
        }

      } catch (error) {
        console.error('[WebGL2] GLStrokeProcessor error:', error);
        this.glStrokeProcessor = null;
      }
    }

    /**
     * Extension確認・取得
     * @private
     */
    _checkExtensions() {
      const gl = this.gl;
      
      this.extensions.colorBufferFloat = gl.getExtension('EXT_color_buffer_float');
      this.extensions.textureFloatLinear = gl.getExtension('OES_texture_float_linear');
      this.extensions.colorBufferHalfFloat = gl.getExtension('EXT_color_buffer_half_float');
    }

    /**
     * Shader作成
     * @param {number} type - gl.VERTEX_SHADER または gl.FRAGMENT_SHADER
     * @param {string} source - GLSLソースコード
     * @returns {WebGLShader|null}
     */
    createShader(type, source) {
      const gl = this.gl;
      const shader = gl.createShader(type);
      
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const info = gl.getShaderInfoLog(shader);
        const typeName = type === gl.VERTEX_SHADER ? 'VERTEX' : 'FRAGMENT';
        console.error(`[WebGL2] ❌ ${typeName} Shader compile error:`, info);
        gl.deleteShader(shader);
        return null;
      }
      
      return shader;
    }

    /**
     * Programリンク
     * @param {string} vertexSource - Vertex Shader GLSL
     * @param {string} fragmentSource - Fragment Shader GLSL
     * @param {string} [name] - デバッグ用名前
     * @returns {WebGLProgram|null}
     */
    createProgram(vertexSource, fragmentSource, name = 'unnamed') {
      const gl = this.gl;
      
      const vertexShader = this.createShader(gl.VERTEX_SHADER, vertexSource);
      const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, fragmentSource);
      
      if (!vertexShader || !fragmentShader) {
        console.error(`[WebGL2] ❌ Program "${name}" shader creation failed`);
        if (vertexShader) gl.deleteShader(vertexShader);
        if (fragmentShader) gl.deleteShader(fragmentShader);
        return null;
      }
      
      const program = gl.createProgram();
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const info = gl.getProgramInfoLog(program);
        console.error(`[WebGL2] ❌ Program "${name}" link error:`, info);
        gl.deleteProgram(program);
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        return null;
      }
      
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      
      if (name !== 'unnamed') {
        this.programs[name] = program;
      }
      
      return program;
    }

    /**
     * FBO生成
     * @param {number} width - 幅
     * @param {number} height - 高さ
     * @param {Object} options - オプション
     * @returns {Object|null} {fbo, texture, width, height}
     */
    createFBO(width, height, options = {}) {
      const gl = this.gl;
      
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      
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
      
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      
      const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      if (status !== gl.FRAMEBUFFER_COMPLETE) {
        console.error('[WebGL2] ❌ FBO incomplete:', status);
        this.deleteFBO({ fbo, texture });
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return null;
      }
      
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.bindTexture(gl.TEXTURE_2D, null);
      
      return { fbo, texture, width, height };
    }

    /**
     * FBO削除
     */
    deleteFBO(fboObj) {
      if (!fboObj) return;
      const gl = this.gl;
      if (fboObj.fbo) gl.deleteFramebuffer(fboObj.fbo);
      if (fboObj.texture) gl.deleteTexture(fboObj.texture);
    }

    /**
     * Texture生成
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

    /**
     * Program削除
     */
    deleteProgram(name) {
      if (this.programs[name]) {
        this.gl.deleteProgram(this.programs[name]);
        delete this.programs[name];
      }
    }

    /**
     * 統計情報取得
     */
    getStats() {
      if (this.glStrokeProcessor) {
        return this.glStrokeProcessor.stats;
      }
      return {
        processedStrokes: 0,
        totalVertices: 0,
        averageVerticesPerStroke: 0
      };
    }

    /**
     * 全リソース削除
     */
    cleanup() {
      const gl = this.gl;
      
      Object.keys(this.programs).forEach(name => {
        gl.deleteProgram(this.programs[name]);
      });
      this.programs = {};
      
      if (this.glStrokeProcessor) {
        this.glStrokeProcessor.dispose();
        this.glStrokeProcessor = null;
      }
      
      console.log('[WebGL2] 🧹 Cleanup completed');
    }

    // ========== API: 互換性メソッド ==========

    getCanvas() {
      return this.canvas;
    }

    getGL() {
      return this.gl;
    }

    getFormat() {
      return 'rgba8';
    }

    isInitialized() {
      return this.initialized;
    }

    getMaxTextureSize() {
      return this.maxTextureSize;
    }

    getProgram(name) {
      return this.programs[name];
    }
  }

  // ========== Singleton登録 ==========
  
  const instance = new WebGL2DrawingLayer();
  window.WebGLContext = instance;
  window.WebGL2DrawingLayer = instance;

  console.log('✅ webgl2-drawing-layer.js Phase 3.6 loaded');
  console.log('   ✅ 独自リボン生成実装（Perfect-Freehand完全不使用）');

})();