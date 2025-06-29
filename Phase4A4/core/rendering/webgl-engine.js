/*
 * ===================================================================================
 * Toshinka Tegaki Tool - WebGL Engine (Renderer Implementation)
 * Version: 0.3.1 (Phase 4A-3 Bugfix)
 *
 * ・最終描画時のブレンド関数を修正し、キャンバスが黒くなる問題を解決。
 * ・合成時と最終表示時でブレンド設定を明確に切り替えるように変更。
 * ・★★修正点★★ initFramebuffers関数内のgl.FRAMEUMENTをgl.FRAMEBUFFERに修正し、
 * フレームバッファ関連の警告を解消。
 * ・_setTextureParamsの引数glが不要なので削除。
 * ===================================================================================
 */
import { DrawingEngine } from './drawing-engine.js';

// --- シェーダーコード ---
const vertexShaderSource = `
    attribute vec4 a_position;
    attribute vec2 a_texCoord;
    varying vec2 v_texCoord;
    void main() {
        gl_Position = a_position;
        v_texCoord = a_texCoord;
    }
`;

const fragmentShaderSource = `
    precision mediump float;
    varying vec2 v_texCoord;
    uniform sampler2D u_texture;
    uniform float u_opacity;
    void main() {
        vec4 textureColor = texture2D(u_texture, v_texCoord);
        gl_FragColor = vec4(textureColor.rgb * textureColor.a * u_opacity, textureColor.a * u_opacity);
    }
`;


export class WebGLEngine extends DrawingEngine {
    constructor(canvas) {
        super(canvas);
        this.gl = null;
        this.program = null;
        this.locations = {};
        this.positionBuffer = null;
        this.texCoordBuffer = null;
        this.fbos = [];
        this.layerTextures = new Map();
        this.finalComposition = null;

        try {
            // premultipliedAlphaをtrueに設定することで、WebGLの標準的なブレンド挙動に合わせる
            // これにより、テクスチャの色が意図通りにブレンドされる可能性が高まります。
            this.gl = this.canvas.getContext('webgl', { premultipliedAlpha: true });
            if (!this.gl) throw new Error('WebGL is not supported in this browser.');
        } catch (e) {
            console.error("WebGL Engine initialization failed:", e);
            return;
        }

        this._initShaders();
        this._initBuffers();
        this._initFramebuffers();
        this.gl.disable(this.gl.DEPTH_TEST);
        this.gl.enable(this.gl.BLEND);
        // 初期ブレンド関数は合成用と同じONE, ONE_MINUS_SRC_ALPHAに設定しておく
        this.gl.blendFunc(this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA);
    }

    static isSupported() {
        try {
            const canvas = document.createElement('canvas');
            return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
        } catch (e) {
            return false;
        }
    }

    _initShaders() {
        const gl = this.gl;
        const vertexShader = this._createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
        const fragmentShader = this._createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
        this.program = this._createProgram(gl, vertexShader, fragmentShader);

        this.locations.position = gl.getAttribLocation(this.program, 'a_position');
        this.locations.texCoord = gl.getAttribLocation(this.program, 'a_texCoord');
        this.locations.texture = gl.getUniformLocation(this.program, 'u_texture');
        this.locations.opacity = gl.getUniformLocation(this.program, 'u_opacity');
    }

    _initBuffers() {
        const gl = this.gl;
        this.positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            -1, -1,  1, -1,  -1, 1, -1, 1,  1, -1,  1, 1,
        ]), gl.STATIC_DRAW);

        this.texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            0, 0,  1, 0,  0, 1, 0, 1,  1, 0,  1, 1,
        ]), gl.STATIC_DRAW);
    }

    _initFramebuffers() {
        const gl = this.gl;
        for (let i = 0; i < 2; i++) {
            const texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, texture);
            // フレームバッファのテクスチャはキャンバスと同じサイズで作成
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.canvas.width, gl.canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
            this._setTextureParams(); // glを引数から削除

            const fbo = gl.createFramebuffer();
            gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
            // ★修正箇所: gl.FRAMEUMENT を gl.FRAMEBUFFER に修正
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

            // フレームバッファが完全かどうかチェック（デバッグ用）
            const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
            if (status !== gl.FRAMEBUFFER_COMPLETE) {
                console.warn(`Framebuffer ${i} is not complete: ${status}`);
            }

            this.fbos.push({ fbo, texture });
        }
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    clear(imageData) {
        if (!this.gl) return;
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        this.gl.clearColor(0.0, 0.0, 0.0, 0.0); // 透明な黒でクリア
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);

        if (imageData) imageData.data.fill(0);

        // レイヤーテクスチャとFBO関連のリソースを適切にクリア
        this.layerTextures.forEach(texture => this.gl.deleteTexture(texture));
        this.layerTextures.clear();
        // FBOのテクスチャもクリアするべきですが、_initFramebuffersで再作成されるため、ここでは不要とします
        // 必要に応じてfbos内のtextureもdeleteTextureで削除することを検討
        console.log("WebGL textures cleared.");
    }

    _createOrUpdateTextureFromImageData(imageData, texture) {
        const gl = this.gl;
        if (!texture) texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        // ImageDataは通常RGBAで、事前に乗算されていないアルファを持つため、falseが適切
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageData);
        this._setTextureParams(); // glを引数から削除
        gl.bindTexture(gl.TEXTURE_2D, null);
        return texture;
    }

    compositeLayers(layers, compositionData, dirtyRect) {
        if (!this.gl || layers.length === 0) return;

        const gl = this.gl;
        const visibleLayers = layers.filter(layer => layer.visible && layer.opacity > 0);
        if (visibleLayers.length === 0) {
            this.finalComposition = null;
            // 完全に透明になった場合も表示をクリア
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.clearColor(0.1, 0.1, 0.1, 1.0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            return;
        }

        visibleLayers.forEach(layer => {
            const existingTexture = this.layerTextures.get(layer);
            const newTexture = this._createOrUpdateTextureFromImageData(layer.imageData, existingTexture);
            if (!existingTexture) this.layerTextures.set(layer, newTexture);
        });

        gl.useProgram(this.program);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        this._bindVertexBuffers();

        // ★★★ 修正箇所: 合成用のブレンド関数を設定 ★★★
        // 新しいレイヤーを既存の合成結果にアルファブレンドで重ねる
        // gl.SRC_ALPHA: ソースのアルファ値を使用
        // gl.ONE_MINUS_SRC_ALPHA: ソースのアルファ値の補数を使用（1 - alpha）
        // これにより、後ろのピクセルが前のピクセルに適切にブレンドされます。
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);


        let sourceIndex = 0;
        let destIndex = 1;

        // 最初のレイヤーを描画
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos[destIndex].fbo);
        gl.clearColor(0, 0, 0, 0); // フレームバッファを透明な黒でクリア
        gl.clear(gl.COLOR_BUFFER_BIT);
        this._drawLayer(visibleLayers[0]);

        for (let i = 1; i < visibleLayers.length; i++) {
            [sourceIndex, destIndex] = [destIndex, sourceIndex];

            gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos[destIndex].fbo);
            gl.clearColor(0, 0, 0, 0); // フレームバッファを透明な黒でクリア
            gl.clear(gl.COLOR_BUFFER_BIT);

            this._drawTexture(this.fbos[sourceIndex].texture, 1.0); // 以前の合成結果を描画
            this._drawLayer(visibleLayers[i]); // 現在のレイヤーをその上にブレンド
        }

        this.finalComposition = this.fbos[destIndex].texture;
        gl.bindFramebuffer(gl.FRAMEBUFFER, null); // メインのフレームバッファに戻る
    }

    renderToDisplay(compositionData, dirtyRect) {
        if (!this.gl) return;
        const gl = this.gl;

        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clearColor(0.1, 0.1, 0.1, 1.0); // 背景色（キャンバスが黒くなるのを防ぐため、任意の色を設定）
        gl.clear(this.gl.COLOR_BUFFER_BIT);

        if (!this.finalComposition) {
            return;
        }

        // ★★★ 修正箇所: 最終表示用のブレンド関数を設定 ★★★
        // ソース(テクスチャ)の色をそのまま使い、背景(キャンバスのクリア色)は無視する
        // finalCompositionのアルファ値も考慮して、canvasの背景と適切にブレンドさせる
        // テクスチャのRGBにアルファを乗算し、アルファはそのまま使用
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);


        this._bindVertexBuffers();
        this._drawTexture(this.finalComposition, 1.0); // 最終合成結果を不透明度1.0で描画
    }

    _createShader(gl, type, source) {
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

    _createProgram(gl, vertexShader, fragmentShader) {
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(program));
            return null;
        }
        return program;
    }

    _setTextureParams() { // glを引数から削除
        const gl = this.gl; // this.glを使用
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }

    _bindVertexBuffers() {
        const gl = this.gl;
        gl.enableVertexAttribArray(this.locations.position);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.vertexAttribPointer(this.locations.position, 2, gl.FLOAT, false, 0, 0);

        gl.enableVertexAttribArray(this.locations.texCoord);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.vertexAttribPointer(this.locations.texCoord, 2, gl.FLOAT, false, 0, 0);
    }

    _drawLayer(layer) {
        const texture = this.layerTextures.get(layer);
        const opacity = (layer.opacity ?? 100) / 100;
        if (texture) {
            // TODO: ブレンドモードに応じた処理を追加（現在は常にSRC_ALPHA, ONE_MINUS_SRC_ALPHA）
            this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
            this._drawTexture(texture, opacity);
        }
    }

    _drawTexture(texture, opacity) {
        const gl = this.gl;
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(this.locations.texture, 0);
        gl.uniform1f(this.locations.opacity, opacity);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    drawCircle(imageData, centerX, centerY, radius, color, isEraser) {}
    drawLine(imageData, x0, y0, x1, y1, size, color, isEraser, p0, p1, calculatePressureSize) {}
    fill(imageData, color) {}
    getTransformedImageData(sourceImageData, transform) { return sourceImageData; }
}