/*
 * ===================================================================================
 * Toshinka Tegaki Tool - WebGL Engine
 * Version: 1.0.0 (Phase 4A-4: Blending and Transform Fixes)
 *
 * ・WebGLでのレイヤーブレンドモード（通常, 乗算, 加算, スクリーン）に対応しました。
 * ・レイヤー変形が移動も含めて正しくImageDataに適用されるようにバグを修正しました。
 * ・シェーダーロジックを簡化し、ブレンドはWebGLの標準機能(blendFunc)で行います。
 * ===================================================================================
 */
import { DrawingEngine } from './drawing-engine.js';

export class WebGLEngine extends DrawingEngine {
    constructor(canvas) {
        super(canvas);
        this.gl = null;
        this.program = null;
        this.positionBuffer = null;
        this.texCoordBuffer = null;
        this.compositeTexture = null;
        this.compositeFBO = null;

        this.layerTextures = new Map();

        this.drawingQuality = {
            enableSubpixel: true,
            antialiasThreshold: 2.0,
            minDrawSteps: 1,
            maxDrawSteps: 100
        };

        this.transformOffscreenCanvas = document.createElement('canvas');
        this.transformOffscreenCtx = this.transformOffscreenCanvas.getContext('2d');


        try {
            this.gl = canvas.getContext('webgl', { preserveDrawingBuffer: true, premultipliedAlpha: true }) || canvas.getContext('experimental-webgl', { preserveDrawingBuffer: true, premultipliedAlpha: true });
            if (!this.gl) {
                throw new Error('WebGL is not supported in this browser.');
            }
        } catch (e) {
            console.error("WebGL Engine initialization failed:", e);
            return;
        }

        const gl = this.gl;

        gl.clearColor(0.0, 0.0, 0.0, 0.0);
        gl.enable(gl.BLEND);
        // ★★★ 事前乗算アルファのブレンド設定をデフォルトに ★★★
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); 

        // ★★★ シェーダーを簡化 ★★★
        // 変形はImageDataに焼き込まれ、ブレンドはblendFuncで制御するため、シェーダーはシンプルになる
        const vsSource = `
            attribute vec4 a_position;
            attribute vec2 a_texCoord;
            varying vec2 v_texCoord;
            void main() {
                gl_Position = a_position;
                v_texCoord = a_texCoord;
            }
        `;

        const fsSource = `
            precision mediump float;
            varying vec2 v_texCoord;
            uniform sampler2D u_image;
            uniform float u_opacity;
            void main() {
                vec4 texColor = texture2D(u_image, v_texCoord);
                // 事前乗算済みアルファとして出力
                gl_FragColor = vec4(texColor.rgb * texColor.a, texColor.a) * u_opacity;
            }
        `;

        const vertexShader = this._compileShader(vsSource, gl.VERTEX_SHADER);
        const fragmentShader = this._compileShader(fsSource, gl.FRAGMENT_SHADER);
        this.program = this._createProgram(vertexShader, fragmentShader);

        if (!this.program) {
            console.error("Failed to create WebGL program.");
            return;
        }

        gl.useProgram(this.program);

        this.positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        const positions = [ -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0, -1.0 ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

        this.texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        // ★ Y軸反転は gl.UNPACK_FLIP_Y_WEBGL で行うので、テクスチャ座標は標準のまま
        const texCoords = [ 0.0, 1.0, 0.0, 0.0, 1.0, 1.0, 1.0, 0.0 ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);

        this.a_position_loc = gl.getAttribLocation(this.program, "a_position");
        this.a_texCoord_loc = gl.getAttribLocation(this.program, "a_texCoord");
        this.u_image_loc = gl.getUniformLocation(this.program, "u_image");
        this.u_opacity_loc = gl.getUniformLocation(this.program, "u_opacity");

        this._setupCompositingBuffer();
        console.log("WebGL Engine (v1.0.0) initialized successfully.");
    }

    _compileShader(source, type) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    _createProgram(vs, fs) {
        const gl = this.gl;
        const program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(program));
            gl.deleteProgram(program);
            return null;
        }
        return program;
    }

    static isSupported() {
        try {
            const canvas = document.createElement('canvas');
            return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
        } catch (e) {
            return false;
        }
    }

    _createOrUpdateTextureFromImageData(imageData, existingTexture = null) {
        const gl = this.gl;
        const texture = existingTexture || gl.createTexture();

        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        // ★ 事前乗算アルファはシェーダーで行うので、ここではfalseに設定
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageData);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        gl.bindTexture(gl.TEXTURE_2D, null);

        return texture;
    }

    _setupCompositingBuffer() {
        const gl = this.gl;
        const width = this.canvas.width;
        const height = this.canvas.height;

        if (this.compositeFBO) gl.deleteFramebuffer(this.compositeFBO);
        if (this.compositeTexture) gl.deleteTexture(this.compositeTexture);

        this.compositeTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.compositeTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        this.compositeFBO = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.compositeFBO);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.compositeTexture, 0);

        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
            console.error('Framebuffer not complete');
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    
    // ★★★ 新規追加: ブレンドモードを設定するヘルパー関数 ★★★
    _setBlendMode(blendMode) {
        const gl = this.gl;
        
        // デフォルトは通常（アルファ）ブレンド
        gl.blendEquation(gl.FUNC_ADD);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        switch (blendMode) {
            case 'multiply': // 乗算
                gl.blendFunc(gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA);
                break;
            case 'screen': // スクリーン
                gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR);
                break;
            case 'add': // 加算・発光
                gl.blendFunc(gl.ONE, gl.ONE);
                break;
            // 'normal' やその他の場合はデフォルト設定が使われる
        }
    }

    compositeLayers(layers, compositionData, dirtyRect) {
        if (!this.gl || !this.program || !this.compositeFBO) return;

        const gl = this.gl;

        const currentLayerNames = new Set(layers.map(l => l.name));
        for (const layer of layers) {
            const existingTexture = this.layerTextures.get(layer);
            const texture = this._createOrUpdateTextureFromImageData(layer.imageData, existingTexture);
            this.layerTextures.set(layer, texture);
        }

        for (const [layer, texture] of this.layerTextures.entries()) {
            if (!currentLayerNames.has(layer.name)) {
                gl.deleteTexture(texture);
                this.layerTextures.delete(layer);
            }
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.compositeFBO);
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(this.program);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.vertexAttribPointer(this.a_position_loc, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.a_position_loc);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.vertexAttribPointer(this.a_texCoord_loc, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.a_texCoord_loc);

        for (const layer of layers) {
            if (!layer.visible || layer.opacity === 0 || !this.layerTextures.has(layer)) continue;

            // ★★★ ブレンドモードを設定 ★★★
            this._setBlendMode(layer.blendMode);

            const texture = this.layerTextures.get(layer);
            
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.uniform1i(this.u_image_loc, 0);
            gl.uniform1f(this.u_opacity_loc, layer.opacity / 100.0); 

            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.disableVertexAttribArray(this.a_position_loc);
        gl.disableVertexAttribArray(this.a_texCoord_loc);
    }

    renderToDisplay(compositionData, dirtyRect) {
        if (!this.gl || !this.program || !this.compositeTexture) return;
        const gl = this.gl;

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(this.program);
        
        // ★ 表示時は常に通常のアルファブレンドに戻す
        this._setBlendMode('normal');

        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.vertexAttribPointer(this.a_position_loc, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.a_position_loc);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.vertexAttribPointer(this.a_texCoord_loc, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.a_texCoord_loc);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.compositeTexture);
        gl.uniform1i(this.u_image_loc, 0);
        gl.uniform1f(this.u_opacity_loc, 1.0);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        gl.disableVertexAttribArray(this.a_position_loc);
        gl.disableVertexAttribArray(this.a_texCoord_loc);
    }
    
    // --- ImageDataへの直接描画 (変更なし) ---
    drawCircle(imageData, ...args) { super.drawCircle(imageData, ...args); }
    drawLine(imageData, ...args) { super.drawLine(imageData, ...args); }
    fill(imageData, ...args) { super.fill(imageData, ...args); }
    clear(imageData, ...args) { super.clear(imageData, ...args); }

    // ★★★修正: 移動・回転・拡縮すべてを2Dキャンバスで適用する★★★
    getTransformedImageData(sourceImageData, transform) {
        const sw = sourceImageData.width;
        const sh = sourceImageData.height;
        
        const tempCanvas = this.transformOffscreenCanvas;
        const tempCtx = this.transformOffscreenCtx;
        tempCanvas.width = sw;
        tempCanvas.height = sh;

        const sourceCanvas = document.createElement('canvas');
        sourceCanvas.width = sw;
        sourceCanvas.height = sh;
        sourceCanvas.getContext('2d').putImageData(sourceImageData, 0, 0);

        tempCtx.clearRect(0, 0, sw, sh);
        tempCtx.save();
        
        tempCtx.translate(transform.x, transform.y);
        tempCtx.translate(sw / 2, sh / 2);
        tempCtx.rotate(transform.rotation * Math.PI / 180);
        tempCtx.scale(transform.scale * transform.flipX, transform.scale * transform.flipY);
        tempCtx.translate(-sw / 2, -sh / 2);

        tempCtx.drawImage(sourceCanvas, 0, 0);
        
        tempCtx.restore();

        return tempCtx.getImageData(0, 0, sw, sh);
    }

    // --- プライベートヘルパーメソッド (変更なし) ---
    _drawSinglePixel(...args) { super._drawSinglePixel(...args); }
    _calculatePixelAlpha(...args) { return super._calculatePixelAlpha(...args); }
    _blendPixel(...args) { super._blendPixel(...args); }
    _erasePixel(...args) { super._erasePixel(...args); }
}