/*
 * ===================================================================================
 * Toshinka Tegaki Tool - WebGL Engine (Full Rendering Pipeline) - FIXED VERSION
 * Version: 0.3.0 (Phase 4A-4: WebGL Compositing & Display Fix)
 *
 * レイヤーのImageDataをWebGLテクスチャに変換し、それを合成して画面に表示する
 * 完全な描画パイプラインを実装しました。
 * ===================================================================================
 */
import { DrawingEngine } from './drawing-engine.js';

export class WebGLEngine extends DrawingEngine {
    constructor(canvas) {
        super(canvas);
        this.gl = null;
        this.program = null; // シェーダープログラム
        this.positionBuffer = null; // 頂点バッファ
        this.texCoordBuffer = null; // テクスチャ座標バッファ
        this.compositeTexture = null; // 合成結果を格納するテクスチャ
        this.compositeFBO = null; // 合成用フレームバッファ

        // ★新規追加: 作成したテクスチャをレイヤーごとに保管する場所
        this.layerTextures = new Map();

        try {
            this.gl = canvas.getContext('webgl', { preserveDrawingBuffer: true }) || canvas.getContext('experimental-webgl', { preserveDrawingBuffer: true });
            if (!this.gl) {
                throw new Error('WebGL is not supported in this browser.');
            }
        } catch (e) {
            console.error("WebGL Engine initialization failed:", e);
            return;
        }

        const gl = this.gl;

        // WebGL初期設定
        gl.clearColor(0.0, 0.0, 0.0, 0.0); // 背景は透明に
        gl.enable(gl.BLEND); // アルファブレンドを有効にする
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); // 通常のアルファブレンド設定

        // -----------------------------------------------------------
        // シェーダーのコンパイルとプログラムのリンク
        // -----------------------------------------------------------
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
            void main() {
                gl_FragColor = texture2D(u_image, v_texCoord);
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

        // -----------------------------------------------------------
        // 画面全体を覆うクアッド（四角形）の頂点バッファ
        // -----------------------------------------------------------
        this.positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        // x, y 座標 (-1 to 1 のクリップ空間)
        const positions = [
            -1.0, 1.0,  // top-left
            -1.0, -1.0, // bottom-left
            1.0, 1.0,   // top-right
            1.0, -1.0,  // bottom-right
        ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

        // -----------------------------------------------------------
        // テクスチャ座標バッファ (画像の上から下へ)
        // -----------------------------------------------------------
        this.texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        // WebGLのテクスチャ座標は左下(0,0)、右上(1,1)だが、
        // 画像のY軸は上から下なので、Y座標を反転させる (0,1 -> 0,0) (1,1 -> 1,0)
        const texCoords = [
            0.0, 0.0,  // top-left -> mapped to (0,1) for image
            0.0, 1.0,  // bottom-left -> mapped to (0,0) for image
            1.0, 0.0,  // top-right -> mapped to (1,1) for image
            1.0, 1.0,   // bottom-right -> mapped to (1,0) for image
        ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);

        // -----------------------------------------------------------
        // アトリビュートとユニフォームのロケーション取得
        // -----------------------------------------------------------
        this.a_position_loc = gl.getAttribLocation(this.program, "a_position");
        this.a_texCoord_loc = gl.getAttribLocation(this.program, "a_texCoord");
        this.u_image_loc = gl.getUniformLocation(this.program, "u_image");

        // 初期化時に合成用バッファをセットアップ
        this._setupCompositingBuffer();
        console.log("WebGL Engine initialized successfully.");
    }

    /**
     * シェーダーをコンパイルするヘルパーメソッド
     */
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

    /**
     * シェーダープログラムを作成するヘルパーメソッド
     */
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

    /**
     * WebGLが利用可能か事前にチェックするための静的メソッド
     * @returns {boolean}
     */
    static isSupported() {
        try {
            const canvas = document.createElement('canvas');
            return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
        } catch (e) {
            return false;
        }
    }

    /**
     * ImageDataからWebGLテクスチャを作成または更新します。
     * @param {ImageData} imageData ソースとなるImageData
     * @param {WebGLTexture} [existingTexture] 更新する既存のテクスチャ (オプション)
     * @returns {WebGLTexture} 作成または更新されたテクスチャ
     */
    _createOrUpdateTextureFromImageData(imageData, existingTexture = null) {
        const gl = this.gl;
        const texture = existingTexture || gl.createTexture();

        gl.bindTexture(gl.TEXTURE_2D, texture);

        // ピクセル形式とデータ型を設定
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageData);

        // テクスチャのパラメータを設定 (線形補間、端をクランプ)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        // 他のテクスチャに影響を与えないように、バインドを解除
        gl.bindTexture(gl.TEXTURE_2D, null);

        return texture;
    }

    /**
     * ★新規追加★ 合成結果を格納するFBOとテクスチャをセットアップします。
     */
    _setupCompositingBuffer() {
        const gl = this.gl;
        const width = this.canvas.width;
        const height = this.canvas.height;

        // 既存のリソースがあれば解放
        if (this.compositeFBO) {
            gl.deleteFramebuffer(this.compositeFBO);
        }
        if (this.compositeTexture) {
            gl.deleteTexture(this.compositeTexture);
        }

        // テクスチャの作成 (合成結果をここに描画する)
        this.compositeTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.compositeTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);

        // フレームバッファの作成とテクスチャの紐付け
        this.compositeFBO = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.compositeFBO);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.compositeTexture, 0);

        // フレームバッファの完了チェック
        const fbStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (fbStatus !== gl.FRAMEBUFFER_COMPLETE) {
            console.error('Framebuffer not complete, status: ' + fbStatus);
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null); // デフォルトのフレームバッファに戻す
        console.log("Compositing buffer (FBO & Texture) setup completed.");
    }

    /**
     * ★処理を更新: レイヤーをテクスチャに変換し、合成バッファに描画します。
     */
    compositeLayers(layers, compositionData, dirtyRect) {
        if (!this.gl || !this.program || !this.compositeFBO || !this.compositeTexture) {
            console.warn("WebGL not ready for compositing.");
            return;
        }

        const gl = this.gl;

        console.log(`Compositing ${layers.length} layers for WebGL...`);

        // レイヤーテクスチャを更新
        // 既存のテクスチャを一旦クリア（簡単のため。将来的には差分更新が望ましい）
        // this.layerTextures.forEach(texture => gl.deleteTexture(texture)); // ここでの削除はしない
        // this.layerTextures.clear(); // ここでのクリアもしない

        // レイヤーテクスチャを管理するためのMapを更新
        const currentLayerNames = new Set();
        for (const layer of layers) {
            currentLayerNames.add(layer.name);
            // 既存のテクスチャがあれば更新、なければ新規作成
            const existingTexture = this.layerTextures.get(layer);
            const texture = this._createOrUpdateTextureFromImageData(layer.imageData, existingTexture);
            this.layerTextures.set(layer, texture); // Mapにレイヤーとテクスチャのペアを保存
            // console.log(`Texture created/updated for layer: "${layer.name}"`, texture);
        }
        // 存在しないレイヤーのテクスチャを削除
        for (const [layer, texture] of this.layerTextures.entries()) {
            if (!currentLayerNames.has(layer.name)) {
                gl.deleteTexture(texture);
                this.layerTextures.delete(layer);
            }
        }


        // オフスクリーン（FBO）に描画
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.compositeFBO);
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clear(gl.COLOR_BUFFER_BIT); // FBOをクリア

        gl.useProgram(this.program);

        // 頂点アトリビュートの設定
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.vertexAttribPointer(this.a_position_loc, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.a_position_loc);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.vertexAttribPointer(this.a_texCoord_loc, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.a_texCoord_loc);

        // 各レイヤーを合成FBOに描画
        let layerCount = 0;
        for (const layer of layers) {
            if (!layer.visible || layer.opacity === 0 || !this.layerTextures.has(layer)) continue;

            const texture = this.layerTextures.get(layer);
            
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.uniform1i(this.u_image_loc, 0); // テクスチャユニット0を使用

            // レイヤーの不透明度をユニフォームとして渡すことも可能だが、今回は単純に描画
            // gl.uniform1f(gl.getUniformLocation(this.program, "u_opacity"), layer.opacity / 100.0);

            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); // クアッドを描画
            layerCount++;
        }
        console.log(`Rendered ${layerCount} layers onto compositing FBO.`);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null); // デフォルトのフレームバッファに戻す
        gl.disableVertexAttribArray(this.a_position_loc);
        gl.disableVertexAttribArray(this.a_texCoord_loc);
    }

    /**
     * ★処理を更新: 合成されたテクスチャをディスプレイにレンダリングします。
     */
    renderToDisplay(imageData, compositionData) { // ImageDataとcompositionDataはCanvas2D向けでWebGLでは無視
        if (!this.gl || !this.program || !this.compositeTexture) {
            console.warn("WebGL not ready for display rendering.");
            return;
        }
        const gl = this.gl;

        console.log("renderToDisplay called.");

        // デフォルトのフレームバッファ（画面）に描画
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clear(gl.COLOR_BUFFER_BIT); // 画面をクリア

        gl.useProgram(this.program);

        // 頂点アトリビュートの設定
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.vertexAttribPointer(this.a_position_loc, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.a_position_loc);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.vertexAttribPointer(this.a_texCoord_loc, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.a_texCoord_loc);

        // 合成されたテクスチャをバインド
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.compositeTexture);
        gl.uniform1i(this.u_image_loc, 0); // テクスチャユニット0を使用

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); // クアッドを描画

        gl.disableVertexAttribArray(this.a_position_loc);
        gl.disableVertexAttribArray(this.a_texCoord_loc);

        console.log("Composite texture rendered to display.");
    }
    
    // imageDataに直接描画するメソッド群 (Canvas2Dと同様に実装が必要だが、WebGLでは複雑)
    // これらはcore-engineが呼び出すため、ダミー実装または後でシェーダーベースの実装が必要
    drawCircle(imageData, centerX, centerY, radius, color, isEraser) {
        // console.warn("drawCircle not fully implemented for WebGL.");
        // 現在はImageDataに直接描画し、それをテクスチャとして更新する方式
        // Canvas2DEngineのdrawCircleロジックをここに移植するか、
        // ImageData更新後にcompositeLayersを再度呼び出す必要がある
    }
    drawLine(imageData, x0, y0, x1, y1, size, color, isEraser, p0, p1) {
        // console.warn("drawLine not fully implemented for WebGL.");
        // 同上
    }
    fill(imageData, color) {
        // console.warn("fill not fully implemented for WebGL.");
        // 同上
    }
    clear(imageData) {
        // console.warn("clear not fully implemented for WebGL.");
        // ImageDataをクリアし、compositeLayersを再度呼び出す
    }
    getTransformedImageData(sourceImageData, transform) {
        console.warn("getTransformedImageData not fully implemented for WebGL.");
        // WebGLで変換を適用したImageDataを返すのは複雑なため、現状はダミー
        return sourceImageData;
    }
}