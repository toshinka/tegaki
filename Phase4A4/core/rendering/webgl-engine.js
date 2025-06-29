/*
 * ===================================================================================
 * Toshinka Tegaki Tool - WebGL Engine (Renderer Implementation)
 * Version: 0.3.2 (Phase 4A-4 Pen/Eraser Implementation)
 *
 * ・最終描画時のブレンド関数を修正し、キャンバスが黒くなる問題を解決。
 * ・合成時と最終表示時でブレンド設定を明確に切り替えるように変更。
 * ・initFramebuffers関数内のgl.FRAMEUMENTをgl.FRAMEBUFFERに修正し、
 * フレームバッファ関連の警告を解消。
 * ・_setTextureParamsの引数glが不要なので削除。
 * ・★★新規機能★★ drawLineとdrawCircleメソッドにWebGL描画ロジックを追加。
 * ・★★新規機能★★ ペンと消しゴム機能の基本的な実装を追加。
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
    uniform vec4 u_color; // ★追加: 描画色ユニフォーム
    uniform bool u_isDrawingShape; // ★追加: 図形描画中かどうかのフラグ

    void main() {
        if (u_isDrawingShape) {
            // 図形描画時はテクスチャではなくu_colorを使う
            // u_color.a * u_opacity は、u_colorにu_opacityを適用した最終的なアルファ
            gl_FragColor = vec4(u_color.rgb * u_color.a * u_opacity, u_color.a * u_opacity);
        } else {
            // テクスチャ描画時は通常通りテクスチャ色を使う
            vec4 textureColor = texture2D(u_texture, v_texCoord);
            gl_FragColor = vec4(textureColor.rgb * textureColor.a * u_opacity, textureColor.a * u_opacity);
        }
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

        // ★追加: 描画用のVBO (頂点バッファオブジェクト)
        this.shapePositionBuffer = null;

        try {
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
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA); // 初期ブレンド設定
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
        this.locations.color = gl.getUniformLocation(this.program, 'u_color'); // ★追加
        this.locations.isDrawingShape = gl.getUniformLocation(this.program, 'u_isDrawingShape'); // ★追加
    }

    _initBuffers() {
        const gl = this.gl;
        // 描画四角形用のバッファ
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

        // ★追加: 描画シェイプ（点、線、円）用のバッファ
        this.shapePositionBuffer = gl.createBuffer();
    }

    _initFramebuffers() {
        const gl = this.gl;
        for (let i = 0; i < 2; i++) {
            const texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.canvas.width, gl.canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
            this._setTextureParams();

            const fbo = gl.createFramebuffer();
            gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

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
        this.gl.clearColor(0.0, 0.0, 0.0, 0.0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);

        if (imageData) imageData.data.fill(0);

        this.layerTextures.forEach(texture => this.gl.deleteTexture(texture));
        this.layerTextures.clear();
        console.log("WebGL textures cleared.");
    }

    _createOrUpdateTextureFromImageData(imageData, texture) {
        const gl = this.gl;
        if (!texture) texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageData);
        this._setTextureParams();
        gl.bindTexture(gl.TEXTURE_2D, null);
        return texture;
    }

    compositeLayers(layers, compositionData, dirtyRect) {
        if (!this.gl || layers.length === 0) return;

        const gl = this.gl;
        const visibleLayers = layers.filter(layer => layer.visible && layer.opacity > 0);
        if (visibleLayers.length === 0) {
            this.finalComposition = null;
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

        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.uniform1i(this.locations.isDrawingShape, 0); // 図形描画ではないことをシェーダーに伝える

        let sourceIndex = 0;
        let destIndex = 1;

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos[destIndex].fbo);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        this._drawLayer(visibleLayers[0]);

        for (let i = 1; i < visibleLayers.length; i++) {
            [sourceIndex, destIndex] = [destIndex, sourceIndex];

            gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos[destIndex].fbo);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);

            this._drawTexture(this.fbos[sourceIndex].texture, 1.0);
            this._drawLayer(visibleLayers[i]);
        }

        this.finalComposition = this.fbos[destIndex].texture;
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    renderToDisplay(compositionData, dirtyRect) {
        if (!this.gl) return;
        const gl = this.gl;

        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clearColor(0.1, 0.1, 0.1, 1.0);
        gl.clear(this.gl.COLOR_BUFFER_BIT);

        if (!this.finalComposition) {
            return;
        }

        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.uniform1i(this.locations.isDrawingShape, 0); // 図形描画ではないことをシェーダーに伝える

        this._bindVertexBuffers();
        this._drawTexture(this.finalComposition, 1.0);
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

    _setTextureParams() {
        const gl = this.gl;
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

        // テクスチャ座標バッファは通常描画時にのみ必要なので、ここではバインドしない
        // gl.enableVertexAttribArray(this.locations.texCoord);
        // gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        // gl.vertexAttribPointer(this.locations.texCoord, 2, gl.FLOAT, false, 0, 0);
    }

    _drawLayer(layer) {
        const texture = this.layerTextures.get(layer);
        const opacity = (layer.opacity ?? 100) / 100;
        if (texture) {
            this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
            this.gl.uniform1i(this.locations.isDrawingShape, 0); // テクスチャ描画
            this._drawTexture(texture, opacity);
        }
    }

    _drawTexture(texture, opacity) {
        const gl = this.gl;
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(this.locations.texture, 0);
        gl.uniform1f(this.locations.opacity, opacity);

        // ここでテクスチャ座標バッファをバインド
        gl.enableVertexAttribArray(this.locations.texCoord);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.vertexAttribPointer(this.locations.texCoord, 2, gl.FLOAT, false, 0, 0);

        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // 描画後、テクスチャ座標バッファのバインドを解除（次の描画に影響を与えないように）
        gl.disableVertexAttribArray(this.locations.texCoord);
    }

    // ★★★ここから追加・変更★★★

    // ヘルパー関数: 色をRGBAのFloat配列に変換
    _hexToRgbaFloat(hexColor, alpha = 1.0) {
        const r = parseInt(hexColor.slice(1, 3), 16) / 255.0;
        const g = parseInt(hexColor.slice(3, 5), 16) / 255.0;
        const b = parseInt(hexColor.slice(5, 7), 16) / 255.0;
        return [r, g, b, alpha];
    }

    // 描画ターゲットのフレームバッファを現在のレイヤーのテクスチャに設定するヘルパー
    _bindLayerFramebuffer(imageData) {
        const gl = this.gl;
        // imageDataに対応するテクスチャを取得または作成
        let layerTexture = this.layerTextures.get(imageData);
        if (!layerTexture) {
            layerTexture = this._createOrUpdateTextureFromImageData(imageData, null);
            this.layerTextures.set(imageData, layerTexture);
        }

        // フレームバッファを確保
        // TODO: FBOが足りなくなる可能性を考慮し、適切に管理する必要がある
        if (this.fbos.length === 0) {
            this._initFramebuffers(); // FBOがない場合は初期化し直す
        }

        const targetFbo = this.fbos[0].fbo; // 最初のFBOを使用
        const targetTexture = this.fbos[0].texture; // 最初のFBOのテクスチャ

        // 描画するimageDataのピクセルデータをFBOのテクスチャにコピーする
        gl.bindTexture(gl.TEXTURE_2D, targetTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageData);
        this._setTextureParams();
        gl.bindTexture(gl.TEXTURE_2D, null);

        // FBOを現在の描画ターゲットとしてバインド
        gl.bindFramebuffer(gl.FRAMEBUFFER, targetFbo);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        return { fbo: targetFbo, texture: targetTexture };
    }

    // フレームバッファからImageDataにピクセルデータを読み込むヘルパー
    _readPixelsToImageData(fboTexture, imageData) {
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos[0].fbo); // 描画に使ったFBOをバインド
        gl.readPixels(0, 0, imageData.width, imageData.height, gl.RGBA, gl.UNSIGNED_BYTE, imageData.data);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null); // メインフレームバッファに戻す

        // Y軸反転が必要な場合がある (WebGLの座標系とImageDataの座標系の違い)
        // 今回のシェーダーではgl_PositionのY軸を反転させているため、通常は不要
        // もし画像が上下逆さまになる場合は、ここでImageDataを反転させるロジックを追加
    }

    // Pen Tool / Eraser Tool の描画ロジック
    // drawLine(imageData, x0, y0, x1, y1, size, color, isEraser, p0, p1, calculatePressureSize)
    drawLine(imageData, x0, y0, x1, y1, size, color, isEraser, p0, p1, calculatePressureSize) {
        if (!this.gl) return;
        const gl = this.gl;

        const { fbo, texture } = this._bindLayerFramebuffer(imageData); // レイヤーのImageDataをFBOにロード

        gl.useProgram(this.program);
        gl.uniform1i(this.locations.isDrawingShape, 1); // 図形描画中であることをシェーダーに伝える

        // 色の設定 (消しゴムの場合は透明)
        const rgbaColor = isEraser ? [0.0, 0.0, 0.0, 0.0] : this._hexToRgbaFloat(color, 1.0);
        gl.uniform4fv(this.locations.color, rgbaColor);

        // ブレンド関数の設定
        if (isEraser) {
            // 消しゴムの場合: 描画する色のアルファ値をゼロにし、SRC_ALPHA_SATURATE で既存の色を消す
            // gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_ALPHA); // これだと完全には消えないことがある
            gl.blendFunc(gl.ONE, gl.ZERO); // これだと完全に上書きになるので、透明色を上書きするイメージ
            // 完全に消す場合は、別途消しゴム用のシェーダーやFBOを使った処理が必要になる
            // 今回は単純に透明な色を描画することで「消す」効果を出す
        } else {
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        }

        // 線の太さに応じた点の半径を計算
        const radius = size / 2.0;

        // 線を多数の円で近似して描画する (パフォーマンスを考慮し、より高度な描画は後回し)
        // 描画する点の数を増やして滑らかにする
        const numSegments = Math.ceil(Math.sqrt((x1 - x0)**2 + (y1 - y0)**2) / 2); // 2ピクセルごとに点を打つ
        for (let i = 0; i <= numSegments; i++) {
            const t = numSegments === 0 ? 0.0 : i / numSegments;
            const currentX = x0 + (x1 - x0) * t;
            const currentY = y0 + (y1 - y0) * t;
            // 筆圧計算のロジックをここで適用（もしcalculatePressureSizeが提供されていれば）
            let currentRadius = radius;
            if (calculatePressureSize && p0 !== undefined && p1 !== undefined) {
                const pressure = p0 + (p1 - p0) * t;
                currentRadius = calculatePressureSize(pressure, size) / 2.0;
            }
            this.drawCircle(imageData, currentX, currentY, currentRadius, color, isEraser, true); // drawLineから呼ばれたことを示すフラグ
        }

        // 描画結果をimageDataに読み戻す
        this._readPixelsToImageData(texture, imageData);
    }

    // Circle Tool の描画ロジック
    // drawCircle(imageData, centerX, centerY, radius, color, isEraser)
    // isInternalCall: drawLineから呼ばれる場合の内部フラグ
    drawCircle(imageData, centerX, centerY, radius, color, isEraser, isInternalCall = false) {
        if (!this.gl) return;
        const gl = this.gl;

        // drawLineから呼ばれた場合は_bindLayerFramebufferを再度呼び出さない
        if (!isInternalCall) {
            this._bindLayerFramebuffer(imageData);
        }

        gl.useProgram(this.program);
        gl.uniform1i(this.locations.isDrawingShape, 1); // 図形描画中であることをシェーダーに伝える

        const rgbaColor = isEraser ? [0.0, 0.0, 0.0, 0.0] : this._hexToRgbaFloat(color, 1.0);
        gl.uniform4fv(this.locations.color, rgbaColor);

        if (isEraser) {
            gl.blendFunc(gl.ONE, gl.ZERO); // 透明色で上書き
        } else {
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        }

        // 円を近似するための頂点データを生成
        const numSegments = 30; // 円を構成する三角形の数
        const positions = [];
        positions.push(centerX, centerY); // 中心点

        for (let i = 0; i <= numSegments; i++) {
            const angle = (i / numSegments) * Math.PI * 2;
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);
            positions.push(x, y);
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, this.shapePositionBuffer);
        // Canvas座標からWebGLのクリップ空間座標へ変換
        const glPositions = new Float32Array(positions.map((coord, index) => {
            if (index % 2 === 0) { // X座標
                return (coord / gl.canvas.width) * 2 - 1;
            } else { // Y座標
                return (1 - (coord / gl.canvas.height)) * 2 - 1; // Y軸は反転
            }
        }));

        gl.bufferData(gl.ARRAY_BUFFER, glPositions, gl.STATIC_DRAW);

        gl.enableVertexAttribArray(this.locations.position);
        gl.vertexAttribPointer(this.locations.position, 2, gl.FLOAT, false, 0, 0);

        // 図形描画時はテクスチャ座標は使わないので無効化
        gl.disableVertexAttribArray(this.locations.texCoord);

        gl.drawArrays(gl.TRIANGLE_FAN, 0, glPositions.length / 2); // 中心点と周囲の点で三角形ファンを形成

        // drawLineから呼ばれた場合以外は、描画結果をimageDataに読み戻す
        if (!isInternalCall) {
            this._readPixelsToImageData(this.fbos[0].texture, imageData);
        }
    }


    fill(imageData, color) {
        if (!this.gl) return;
        const gl = this.gl;

        const { fbo, texture } = this._bindLayerFramebuffer(imageData);

        gl.useProgram(this.program);
        gl.uniform1i(this.locations.isDrawingShape, 1); // 図形描画中であることをシェーダーに伝える

        const rgbaColor = this._hexToRgbaFloat(color, 1.0);
        gl.uniform4fv(this.locations.color, rgbaColor);

        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); // 通常のブレンド

        // 画面全体を覆う四角形を描画
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer); // 描画四角形用のバッファ
        gl.enableVertexAttribArray(this.locations.position);
        gl.vertexAttribPointer(this.locations.position, 2, gl.FLOAT, false, 0, 0);

        gl.disableVertexAttribArray(this.locations.texCoord); // テクスチャ座標は使わない

        gl.drawArrays(gl.TRIANGLES, 0, 6); // 画面全体に描画

        this._readPixelsToImageData(texture, imageData);
    }

    getTransformedImageData(sourceImageData, transform) { return sourceImageData; } // 現状では未実装
}