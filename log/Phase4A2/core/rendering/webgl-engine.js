/*
 * ===================================================================================
 * Toshinka Tegaki Tool - WebGL Engine (Renderer Implementation)
 * Version: 0.3.0 (Phase 4A-3)
 *
 * レイヤーテクスチャを画面に描画する機能を実装しました。
 * シェーダーを用いて、フレームバッファ上でレイヤーを順番に合成し、
 * 最終結果をキャンバスに表示します。
 * ===================================================================================
 */
import { DrawingEngine } from './drawing-engine.js';

// --- シェーダーコード ---
// 頂点シェーダー：ポリゴンの頂点を正しい位置に配置する
const vertexShaderSource = `
    attribute vec4 a_position;
    attribute vec2 a_texCoord;
    varying vec2 v_texCoord;
    void main() {
        gl_Position = a_position;
        v_texCoord = a_texCoord;
    }
`;

// フラグメントシェーダー：ピクセルごとの色を決定する
const fragmentShaderSource = `
    precision mediump float;
    varying vec2 v_texCoord;
    uniform sampler2D u_texture;
    uniform float u_opacity;
    void main() {
        vec4 textureColor = texture2D(u_texture, v_texCoord);
        // 事前乗算済みアルファを考慮したブレンド計算
        gl_FragColor = vec4(textureColor.rgb * u_opacity, textureColor.a * u_opacity);
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

        // ★変更: 合成用にフレームバッファを2つ用意（ピンポンレンダリング用）
        this.fbos = []; 

        this.layerTextures = new Map();

        try {
            this.gl = canvas.getContext('webgl', { premultipliedAlpha: false });
            if (!this.gl) throw new Error('WebGL is not supported in this browser.');
        } catch (e) {
            console.error("WebGL Engine initialization failed:", e);
            return;
        }

        // 初期化処理
        this._initShaders();
        this._initBuffers();
        this._initFramebuffers();

        // WebGLの基本設定
        this.gl.disable(this.gl.DEPTH_TEST);
        this.gl.enable(this.gl.BLEND);
        // ★変更: 事前乗算済みアルファ用のブレンド関数
        this.gl.blendFunc(this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA);
    }

    /**
     * WebGLが利用可能か事前にチェックするための静的メソッド
     */
    static isSupported() {
        try {
            const canvas = document.createElement('canvas');
            return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
        } catch (e) {
            return false;
        }
    }

    // --- 初期化ヘルパーメソッド群 ---

    /**
     * シェーダーをコンパイルし、プログラムをリンクする
     */
    _initShaders() {
        const gl = this.gl;
        const vertexShader = this._createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
        const fragmentShader = this._createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
        this.program = this._createProgram(gl, vertexShader, fragmentShader);
        
        // シェーダー内の変数（attribute/uniform）の場所を取得して保持
        this.locations.position = gl.getAttribLocation(this.program, 'a_position');
        this.locations.texCoord = gl.getAttribLocation(this.program, 'a_texCoord');
        this.locations.texture = gl.getUniformLocation(this.program, 'u_texture');
        this.locations.opacity = gl.getUniformLocation(this.program, 'u_opacity');
    }

    /**
     * 画面全体を覆う四角形の頂点バッファを作成
     */
    _initBuffers() {
        const gl = this.gl;
        // 頂点座標 (-1 to 1のクリップ空間)
        this.positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            -1, -1,  1, -1,  -1, 1,
            -1, 1,   1, -1,   1, 1,
        ]), gl.STATIC_DRAW);

        // テクスチャ座標 (0 to 1)
        this.texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            0, 0,  1, 0,  0, 1,
            0, 1,  1, 0,  1, 1,
        ]), gl.STATIC_DRAW);
    }

    /**
     * レイヤー合成用のフレームバッファとテクスチャを作成
     */
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

            this.fbos.push({ fbo, texture });
        }
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    
    // --- DrawingEngineのインターフェース実装 ---

    clear(imageData) {
        if (!this.gl) return;
        
        // WebGLの表示をクリア
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        this.gl.clearColor(0.0, 0.0, 0.0, 0.0); // 透明でクリア
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);

        // CPU側のデータもクリア
        if (imageData) {
            imageData.data.fill(0);
        }
        
        // 管理しているテクスチャをすべて破棄
        this.layerTextures.forEach(texture => this.gl.deleteTexture(texture));
        this.layerTextures.clear();
        console.log("WebGL textures cleared.");
    }
    
    /**
     * レイヤーのImageDataからWebGLテクスチャを作成または更新する
     * @param {ImageData} imageData - レイヤーの画像データ
     * @param {WebGLTexture} [texture] - (オプション) 更新対象の既存テクスチャ
     * @returns {WebGLTexture} 作成または更新されたテクスチャ
     */
    _createOrUpdateTextureFromImageData(imageData, texture) {
        const gl = this.gl;
        if (!texture) {
            texture = gl.createTexture();
        }
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); // Y軸は反転させない
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageData);
        this._setTextureParams(gl);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return texture;
    }

    /**
     * ★処理を更新: レイヤーをテクスチャに変換し、フレームバッファ上で合成する
     */
    compositeLayers(layers, compositionData, dirtyRect) {
        if (!this.gl || layers.length === 0) return;

        const gl = this.gl;
        const visibleLayers = layers.filter(layer => layer.visible && layer.opacity > 0);
        if (visibleLayers.length === 0) {
            // 表示するものがなければ最終結果を透明にする
            this.finalComposition = null;
            return;
        }

        // 表示レイヤーのテクスチャを準備・更新
        for (const layer of visibleLayers) {
            const existingTexture = this.layerTextures.get(layer);
            const newTexture = this._createOrUpdateTextureFromImageData(layer.imageData, existingTexture);
            if (!existingTexture) {
                this.layerTextures.set(layer, newTexture);
            }
        }

        // --- レイヤー合成処理（ピンポンレンダリング） ---
        gl.useProgram(this.program);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        // 頂点バッファをシェーダーに接続
        this._bindVertexBuffers();

        let sourceIndex = 0;
        let destIndex = 1;

        // 1. 最初のレイヤーを描画
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos[destIndex].fbo);
        gl.clearColor(0, 0, 0, 0); // 作業用FBOをクリア
        gl.clear(gl.COLOR_BUFFER_BIT);
        this._drawLayer(visibleLayers[0]);
        
        // 2. 2枚目以降のレイヤーを重ねて描画
        for (let i = 1; i < visibleLayers.length; i++) {
            // FBOを交換
            [sourceIndex, destIndex] = [destIndex, sourceIndex];
            
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos[destIndex].fbo);
            
            // 下のレイヤー（ここまでの合成結果）を描画
            this._drawTexture(this.fbos[sourceIndex].texture, 1.0);
            
            // 上のレイヤーをブレンドして描画
            this._drawLayer(visibleLayers[i]);
        }

        // 最終的な合成結果を保持
        this.finalComposition = this.fbos[destIndex].texture;

        // スクリーンへの描画準備
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    /**
     * ★新規追加: 合成結果をディスプレイに表示する
     */
    renderToDisplay(compositionData, dirtyRect) {
        if (!this.gl || !this.finalComposition) {
            // 描画するものがない場合は画面をクリア
            this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
            this.gl.clearColor(0.0, 0.0, 0.0, 0.0);
            this.gl.clear(this.gl.COLOR_BUFFER_BIT);
            return;
        };

        const gl = this.gl;
        gl.clearColor(0.1, 0.1, 0.1, 1.0); // 背景色（キャンバスエリアの色）
        gl.clear(gl.COLOR_BUFFER_BIT);
        
        this._bindVertexBuffers();
        this._drawTexture(this.finalComposition, 1.0);
        
        // compositionDataに結果を書き戻す (※低速な処理なので注意)
        // gl.readPixels(0, 0, gl.canvas.width, gl.canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, compositionData.data);
    }
    
    // --- 内部ヘルパーメソッド ---

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

        gl.enableVertexAttribArray(this.locations.texCoord);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.vertexAttribPointer(this.locations.texCoord, 2, gl.FLOAT, false, 0, 0);
    }
    
    _drawLayer(layer) {
        const texture = this.layerTextures.get(layer);
        const opacity = (layer.opacity ?? 100) / 100;
        if (texture) {
            // TODO: ここでブレンドモードに応じた処理を追加する
            this.gl.blendFunc(this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA); // 現状はNormal固定
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

    // ▼▼▼ 以下はまだ未実装のメソッド群です ▼▼▼
    drawCircle(imageData, centerX, centerY, radius, color, isEraser) {}
    drawLine(imageData, x0, y0, x1, y1, size, color, isEraser, p0, p1, calculatePressureSize) {}
    fill(imageData, color) {}
    getTransformedImageData(sourceImageData, transform) { return sourceImageData; }
}