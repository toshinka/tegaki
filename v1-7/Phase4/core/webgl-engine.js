/*
 * ===================================================================================
 * Toshinka Tegaki Tool - WebGL Composition Engine
 * Version: 2.0 (Phase 4 Architecture)
 *
 * レイヤーの合成処理を専門に担当するWebGLエンジン。
 * 各レイヤーのImageDataをテクスチャとしてGPUに送り、シェーダーを用いて高速に合成する。
 * ===================================================================================
 */
import { DrawingEngine } from './rendering-bridge.js';

// --- シェーダー定義 ---
const V_SHADER_SOURCE = `
    attribute vec2 a_position;
    varying vec2 v_texCoord;
    void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_position * 0.5 + 0.5;
        // WebGLのテクスチャ座標系(左下原点)とCanvasの座標系(左上原点)を合わせる
        v_texCoord.y = 1.0 - v_texCoord.y;
    }
`;

const F_SHADER_SOURCE = `
    precision mediump float;
    varying vec2 v_texCoord;
    uniform sampler2D u_baseTexture;    // ベースとなるテクスチャ（下のレイヤー）
    uniform sampler2D u_activeTexture;  // 合成するテクスチャ（上のレイヤー）
    uniform int u_blendMode;            // ブレンドモード

    // 基本的なアルファブレンディング (source-over)
    vec4 blend_source_over(vec4 base, vec4 active) {
        return active + base * (1.0 - active.a);
    }

    // 乗算 (multiply)
    vec4 blend_multiply(vec4 base, vec4 active) {
        vec3 color = active.rgb * base.rgb;
        float alpha = active.a + base.a * (1.0 - active.a);
        return vec4(color, alpha);
    }

    void main() {
        vec4 baseColor = texture2D(u_baseTexture, v_texCoord);
        vec4 activeColor = texture2D(u_activeTexture, v_texCoord);

        if (u_blendMode == 1) { // 1: multiply
            gl_FragColor = blend_multiply(baseColor, activeColor);
        } else { // 0: source-over (normal)
            gl_FragColor = blend_source_over(baseColor, activeColor);
        }
    }
`;

export class WebGLEngine extends DrawingEngine {
    constructor(canvas, width, height) {
        super(canvas, width, height);
        this.gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!this.gl) {
            console.error("WebGL is not supported.");
            throw new Error("WebGL is not supported on this browser.");
        }
        this.width = width;
        this.height = height;

        this.program = this._createProgram(V_SHADER_SOURCE, F_SHADER_SOURCE);
        this.gl.useProgram(this.program);

        this.locations = {
            position: this.gl.getAttribLocation(this.program, 'a_position'),
            baseTexture: this.gl.getUniformLocation(this.program, 'u_baseTexture'),
            activeTexture: this.gl.getUniformLocation(this.program, 'u_activeTexture'),
            blendMode: this.gl.getUniformLocation(this.program, 'u_blendMode'),
        };

        this._setupBuffers();
        this._setupFBOs();
    }
    
    // --- Public API ---

    /**
     * レイヤー群をGPU上で合成し、最終結果をキャンバスに描画します。
     * @param {Layer[]} layers - 表示対象の全レイヤー
     */
    compositeAndRender(layers) {
        const visibleLayers = layers.filter(l => l.visible);
        if (visibleLayers.length === 0) {
            this.gl.clearColor(1.0, 1.0, 1.0, 1.0);
            this.gl.clear(this.gl.COLOR_BUFFER_BIT);
            return;
        }

        // 1. 最初の可視レイヤーをFBO_Aに直接描画
        const baseLayer = visibleLayers[0];
        this._drawLayerToFBO(this.fbos[0], baseLayer.imageData);

        // 2. ピンポンレンダリングでレイヤーを重ねていく
        let readFBOIndex = 0;
        for (let i = 1; i < visibleLayers.length; i++) {
            const activeLayer = visibleLayers[i];
            const writeFBOIndex = 1 - readFBOIndex;

            this._blend(
                this.textures[readFBOIndex],    // 下のレイヤー(テクスチャ)
                activeLayer.imageData,          // 上のレイヤー(ImageData)
                this.fbos[writeFBOIndex],       // 描画先FBO
                activeLayer.blendMode
            );
            readFBOIndex = writeFBOIndex;
        }

        // 3. 最終結果を画面に描画
        this._drawTextureToCanvas(this.textures[readFBOIndex]);
    }
    
    exportToDataURL() {
        // 現在のキャンバスの状態をそのまま返す（compositeAndRenderが実行済み前提）
        return this.gl.canvas.toDataURL();
    }


    // --- Private Helper Methods ---

    _setupBuffers() {
        const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
        const buffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);
        this.gl.enableVertexAttribArray(this.locations.position);
        this.gl.vertexAttribPointer(this.locations.position, 2, this.gl.FLOAT, false, 0, 0);
    }

    _setupFBOs() {
        this.textures = [this._createTexture(), this._createTexture()];
        this.fbos = [this._createFBO(this.textures[0]), this._createFBO(this.textures[1])];
    }
    
    _createTexture(imageData = null) {
        const texture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
        if (imageData) {
            this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, imageData);
        } else {
            this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.width, this.height, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, null);
        }
        return texture;
    }
    
    _updateTexture(texture, imageData) {
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, imageData);
    }

    _createFBO(texture) {
        const fbo = this.gl.createFramebuffer();
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, fbo);
        this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, texture, 0);
        return fbo;
    }

    _blend(baseTexture, activeLayerData, targetFBO, blendMode) {
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, targetFBO);
        this.gl.viewport(0, 0, this.width, this.height);

        const activeTexture = this._createTexture(activeLayerData);

        this.gl.uniform1i(this.locations.baseTexture, 0);
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, baseTexture);

        this.gl.uniform1i(this.locations.activeTexture, 1);
        this.gl.activeTexture(this.gl.TEXTURE1);
        this.gl.bindTexture(this.gl.TEXTURE_2D, activeTexture);

        const blendModeId = (blendMode === 'multiply') ? 1 : 0;
        this.gl.uniform1i(this.locations.blendMode, blendModeId);

        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);

        // 作成したアクティブテクスチャは使い終わったら削除
        this.gl.deleteTexture(activeTexture);
    }
    
    _drawLayerToFBO(fbo, imageData) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.width;
        tempCanvas.height = this.height;
        tempCanvas.getContext('2d').putImageData(imageData, 0, 0);

        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, fbo);
        const fboTexture = this._createTexture(tempCanvas);
        this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, fboTexture, 0);
        this.gl.deleteTexture(fboTexture); // FBOにアタッチしたのでテクスチャオブジェクトは不要
    }

    _drawTextureToCanvas(texture) {
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null); // 描画先をキャンバスに戻す
        this.gl.viewport(0, 0, this.width, this.height);

        const tempTexture = this._createTexture(); // ダミーのactiveTexture
        this.gl.uniform1i(this.locations.baseTexture, 0);
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);

        this.gl.uniform1i(this.locations.activeTexture, 1);
        this.gl.activeTexture(this.gl.TEXTURE1);
        this.gl.bindTexture(this.gl.TEXTURE_2D, tempTexture);
        
        // 通常描画（ブレンドなし）として扱うため、ベースカラーをそのまま出力するシェーダーが望ましいが、
        // ここでは透明な黒とブレンドすることで、実質的にベーステクスチャをそのまま描画する
        this.gl.uniform1i(this.locations.blendMode, 0); 
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
        this.gl.deleteTexture(tempTexture);
    }

    _createProgram(vs, fs) {
        const program = this.gl.createProgram();
        const vShader = this._createShader(this.gl.VERTEX_SHADER, vs);
        const fShader = this._createShader(this.gl.FRAGMENT_SHADER, fs);
        this.gl.attachShader(program, vShader);
        this.gl.attachShader(program, fShader);
        this.gl.linkProgram(program);
        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            console.error("Program Link Error:", this.gl.getProgramInfoLog(program));
        }
        return program;
    }

    _createShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            console.error("Shader Compile Error:", this.gl.getShaderInfoLog(shader));
        }
        return shader;
    }
}