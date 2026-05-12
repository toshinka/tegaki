/**
 * ============================================================================
 * ファイル名: system/drawing/webgl2/webgl2-drawing-layer.js
 * 責務: WebGL2コンテキストの初期化・管理、シェーダー・FBOの生成を担当する
 * 依存: なし
 * 被依存: gl-stroke-processor.js, gl-msdf-pipeline.js, gl-texture-bridge.js等
 * 公開API: WebGL2DrawingLayer, webglContext
 * イベント発火: なし
 * イベント受信: なし
 * グローバル登録: window.WebGLContext, window.WebGL2DrawingLayer
 * 実装状態: ♻️移植
 * ============================================================================
 */

export class WebGL2DrawingLayer {
    constructor() {
        this.canvas = null;
        this.gl = null;
        this.initialized = false;
        this.extensions = {};
        this.maxTextureSize = 0;
        this.programs = {}; // シェーダープログラムキャッシュ
        this.shaders = {};  // シェーダーキャッシュ
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
            console.error('[WebGL2DrawingLayer] ❌ Canvas not found');
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
            console.error('[WebGL2DrawingLayer] ❌ WebGL2 not supported');
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
            canvasSize: `${this.canvas.width}x${this.canvas.height}`,
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
            console.warn('[WebGL2DrawingLayer] ⚠️ EXT_color_buffer_float not available');
        }

        // Float texture linear filtering
        this.extensions.textureFloatLinear = gl.getExtension('OES_texture_float_linear');
        
        // Half float support
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
            console.error(`[WebGL2DrawingLayer] ❌ ${typeName} Shader compile error:`, info);
            console.error('Shader source:', source);
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
            console.error(`[WebGL2DrawingLayer] ❌ Program "${name}" shader creation failed`);
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
            console.error(`[WebGL2DrawingLayer] ❌ Program "${name}" link error:`, info);
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
     * @param {boolean} options.float - Float textureを使用
     * @param {boolean} options.halfFloat - Half float textureを使用
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
            console.error('[WebGL2DrawingLayer] ❌ FBO incomplete:', status);
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
     * @param {Object} fboObj - createFBOの戻り値
     */
    deleteFBO(fboObj) {
        if (!fboObj) return;
        
        const gl = this.gl;
        if (fboObj.fbo) gl.deleteFramebuffer(fboObj.fbo);
        if (fboObj.texture) gl.deleteTexture(fboObj.texture);
    }

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

    deleteProgram(name) {
        if (this.programs[name]) {
            this.gl.deleteProgram(this.programs[name]);
            delete this.programs[name];
        }
    }

    cleanup() {
        const gl = this.gl;
        
        Object.keys(this.programs).forEach(name => {
            gl.deleteProgram(this.programs[name]);
        });
        this.programs = {};
        
        console.log('[WebGL2DrawingLayer] 🧹 Cleanup completed');
    }

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

export const webglContext = new WebGL2DrawingLayer();

// 下位互換性のためにグローバルに登録
window.WebGLContext = webglContext;
window.WebGL2DrawingLayer = webglContext;
