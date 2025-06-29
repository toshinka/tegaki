/*
 * ===================================================================================
 * Toshinka Tegaki Tool - WebGL Engine (Phase 4A-3: Drawing & Compositing)
 * Version: 0.3.4 (Bug Fix: gl is not defined in constructor)
 *
 * レイヤーのImageDataをWebGLテクスチャに変換し、管理する機能に加え、
 * 以下の機能を追加しました:
 * ・レイヤーの合成と画面への描画
 * ・ペン（円、線）のWebGLによる描画
 *
 * 【今回修正】
 * ・コンストラクタ内のgl.blendFuncでの`gl`未定義エラーを修正。
 * ===================================================================================
 */
import { DrawingEngine } from './drawing-engine.js';

export class WebGLEngine extends DrawingEngine {
    constructor(canvas) {
        super(canvas);
        this.gl = null;

        console.log("WebGL Engine: Canvas element passed:", canvas);
        console.log("WebGL Engine: Canvas width (from element):", canvas.width);
        console.log("WebGL Engine: Canvas height (from element):", canvas.height);

        this.width = canvas.width;
        this.height = canvas.height;
        console.log("WebGL Engine: Stored width:", this.width);
        console.log("WebGL Engine: Stored height:", this.height);

        this.layerTextures = new Map(); // Map<Layer, WebGLTexture>
        this.framebuffers = new Map();  // Map<Layer, WebGLFramebuffer>
        this.currentLayerTexture = null; // 現在描画中のレイヤーのテクスチャ

        // 合成結果を保持するテクスチャとFBO
        this.compositeTexture = null;
        this.compositeFramebuffer = null;

        // ペン描画用の一時的なFBOとテクスチャ
        this.penDrawFramebuffer = null;
        this.penDrawTexture = null;

        try {
            this.gl = canvas.getContext('webgl', { preserveDrawingBuffer: true }) || canvas.getContext('experimental-webgl', { preserveDrawingBuffer: true });
            if (!this.gl) {
                throw new Error('WebGL is not supported in this browser.');
            }
            this.gl.clearColor(0.0, 0.0, 0.0, 0.0); // 透明でクリア
            this.gl.enable(this.gl.BLEND);
            // ★ここを修正しました！ gl => this.gl
            this.gl.blendFunc(this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA); // 通常のアルファブレンド

            this._initShaders();
            this._initBuffers();
            this._initCompositeResources(); // 合成用リソースの初期化
            this._initPenDrawResources(); // ペン描画用リソースの初期化

            console.log("WebGL Engine initialized successfully.");
            // 初期化後のcompositeTextureの状態を確認
            console.log("Initial compositeTexture:", this.compositeTexture);
            console.log("Is initial compositeTexture a WebGLTexture?", this.gl.isTexture(this.compositeTexture));

        } catch (e) {
            console.error("WebGL Engine initialization failed:", e);
            // エラー時はWebGLコンテキストをnullに設定し、isSupportedでfalseを返す
            this.gl = null;
            return;
        }
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
     * 各種シェーダープログラムの初期化
     */
    _initShaders() {
        const gl = this.gl;

        // ======================================================
        // 1. テクスチャ描画用シェーダー (レイヤー表示・合成用)
        // ======================================================
        const textureVertexShaderSource = `
            attribute vec4 a_position;
            attribute vec2 a_texCoord;
            varying vec2 v_texCoord;
            void main() {
                gl_Position = a_position;
                v_texCoord = a_texCoord;
            }
        `;
        const textureFragmentShaderSource = `
            precision mediump float;
            varying vec2 v_texCoord;
            uniform sampler2D u_image;
            uniform float u_opacity;

            void main() {
                vec4 texColor = texture2D(u_image, v_texCoord);
                gl_FragColor = vec4(texColor.rgb, texColor.a * u_opacity);
            }
        `;
        this.textureProgram = this._createProgram(textureVertexShaderSource, textureFragmentShaderSource);
        this.textureProgram.positionLocation = gl.getAttribLocation(this.textureProgram, "a_position");
        this.textureProgram.texCoordLocation = gl.getAttribLocation(this.textureProgram, "a_texCoord");
        this.textureProgram.imageLocation = gl.getUniformLocation(this.textureProgram, "u_image");
        this.textureProgram.opacityLocation = gl.getUniformLocation(this.textureProgram, "u_opacity");

        // ======================================================
        // 2. 円描画用シェーダー (ペン・消しゴム用)
        // ======================================================
        const circleVertexShaderSource = `
            attribute vec2 a_position;
            uniform vec2 u_resolution;
            uniform vec2 u_center;
            uniform float u_radius;
            void main() {
                vec2 zeroToOne = a_position / u_resolution;
                vec2 zeroToTwo = zeroToOne * 2.0;
                vec2 clipSpace = zeroToTwo - 1.0;
                gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
            }
        `;
        const circleFragmentShaderSource = `
            precision mediump float;
            uniform vec2 u_resolution;
            uniform vec2 u_center;
            uniform float u_radius;
            uniform vec4 u_color; // RGBA
            uniform bool u_isEraser;

            void main() {
                vec2 coord = gl_FragCoord.xy;
                float dist = distance(coord, u_center);
                float alpha = 1.0 - smoothstep(u_radius - 0.5, u_radius + 0.5, dist);

                if (u_isEraser) {
                    // 消しゴムの場合、ターゲットのアルファ値を減衰させる
                    gl_FragColor = vec4(u_color.rgb, u_color.a * alpha); // 色情報は無視し、アルファのみ
                } else {
                    // ペンの場合、指定された色とアルファで描画
                    gl_FragColor = vec4(u_color.rgb, u_color.a * alpha);
                }
            }
        `;
        this.circleProgram = this._createProgram(circleVertexShaderSource, circleFragmentShaderSource);
        this.circleProgram.positionLocation = gl.getAttribLocation(this.circleProgram, "a_position");
        this.circleProgram.resolutionLocation = gl.getUniformLocation(this.circleProgram, "u_resolution");
        this.circleProgram.centerLocation = gl.getUniformLocation(this.circleProgram, "u_center");
        this.circleProgram.radiusLocation = gl.getUniformLocation(this.circleProgram, "u_radius");
        this.circleProgram.colorLocation = gl.getUniformLocation(this.circleProgram, "u_color");
        this.circleProgram.isEraserLocation = gl.getUniformLocation(this.circleProgram, "u_isEraser");

        // ======================================================
        // 3. 線描画用シェーダー (ペン・消しゴム用) - 円を複数描画する方式
        // ======================================================
        // 線の描画は、複数の円をつなぎ合わせる方式で簡易的に実装します。
        // より高度な線描画はgeometry shaderなどが必要ですが、WebGL1では利用できないため。
        // このシェーダーは、基本的にはcircleProgramと同じものを使用します。
        // drawLineメソッド内で、中心座標を連続的に更新してdrawCircleを呼び出す形になります。
        // 複雑な描画（アンチエイリアシングされた線など）には、別途専用のシェーダー検討が必要。

        // ======================================================
        // 4. ブレンドモード用シェーダー (ここでは単純なアルファブレンド)
        // ======================================================
        // 現時点ではgl.blendFuncで対応するため、専用シェーダーは不要。
        // 将来的に複雑なブレンドモード（乗算、スクリーンなど）を実装する際に必要になります。
    }

    /**
     * 頂点バッファとテクスチャ座標バッファの初期化
     */
    _initBuffers() {
        const gl = this.gl;

        // 矩形を描画するための頂点データ (クリップ空間座標)
        this.positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            -1, -1,
             1, -1,
            -1,  1,
            -1,  1,
             1, -1,
             1,  1,
        ]), gl.STATIC_DRAW);

        // テクスチャ座標 (0.0 から 1.0)
        this.texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            0, 0,
            1, 0,
            0, 1,
            0, 1,
            1, 0,
            1, 1,
        ]), gl.STATIC_DRAW);
    }

    /**
     * 合成結果を保持するためのテクスチャとフレームバッファを初期化
     */
    _initCompositeResources() {
        const gl = this.gl;

        // 合成結果用テクスチャ
        this.compositeTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.compositeTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.width, this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        // 合成結果用フレームバッファ
        this.compositeFramebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.compositeFramebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.compositeTexture, 0);

        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    /**
     * ペン描画用の一時的なFBOとテクスチャを初期化
     */
    _initPenDrawResources() {
        const gl = this.gl;
        this.penDrawTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.penDrawTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.width, this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        this.penDrawFramebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.penDrawFramebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.penDrawTexture, 0);

        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    /**
     * シェーダーを作成
     * @param {string} type - 'vertex' or 'fragment'
     * @param {string} source - シェーダーソースコード
     * @returns {WebGLShader}
     */
    _createShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type === 'vertex' ? gl.VERTEX_SHADER : gl.FRAGMENT_SHADER);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    /**
     * シェーダープログラムを作成
     * @param {string} vertexSource
     * @param {string} fragmentSource
     * @returns {WebGLProgram}
     */
    _createProgram(vertexSource, fragmentSource) {
        const gl = this.gl;
        const vertexShader = this._createShader('vertex', vertexSource);
        const fragmentShader = this._createShader('fragment', fragmentSource);

        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Program linking error:', gl.getProgramInfoLog(program));
            gl.deleteProgram(program);
            return null;
        }
        return program;
    }

    /**
     * ImageDataからWebGLテクスチャを作成または更新
     * @param {ImageData} imageData
     * @param {WebGLTexture} [textureToUpdate=null] 既存のテクスチャを更新する場合
     * @returns {WebGLTexture}
     */
    _createOrUpdateTextureFromImageData(imageData, textureToUpdate = null) {
        const gl = this.gl;
        const texture = textureToUpdate || gl.createTexture();

        gl.bindTexture(gl.TEXTURE_2D, texture);

        // テクスチャパラメータを設定
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        // ImageDataをテクスチャに転送
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageData);

        gl.bindTexture(gl.TEXTURE_2D, null); // バインド解除
        return texture;
    }

    /**
     * 特定のレイヤーのテクスチャとフレームバッファを取得または作成
     * @param {Layer} layer
     * @returns {{texture: WebGLTexture, framebuffer: WebGLFramebuffer}}
     */
    _getOrCreateLayerResources(layer) {
        const gl = this.gl;
        let texture = this.layerTextures.get(layer);
        let framebuffer = this.framebuffers.get(layer);

        if (!texture) {
            texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.width, this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            this.layerTextures.set(layer, texture);
        }

        if (!framebuffer) {
            framebuffer = gl.createFramebuffer();
            gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
            this.framebuffers.set(layer, framebuffer);
        }

        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return { texture, framebuffer };
    }

    /**
     * WebGLで円を描画
     * @param {ImageData} imageData - 描画対象のImageData (WebGLでは内部テクスチャに対応)
     * @param {number} centerX
     * @param {number} centerY
     * @param {number} radius
     * @param {object} color - {r, g, b, a}
     * @param {boolean} isEraser
     */
    drawCircle(imageData, centerX, centerY, radius, color, isEraser) {
        const gl = this.gl;
        if (!gl || !this.circleProgram) {
            console.warn("WebGL not initialized or circle program missing.");
            return;
        }

        // 描画対象のImageDataに対応するテクスチャとFBOを取得 (ここではimageDataをキーとしてLayerを紐づける必要がある)
        // ここでは簡易的に、現在のactiveLayerのテクスチャに描画することを想定
        // 実際にはImageDataのLayerオブジェクトから対応するテクスチャを探し出す必要がある
        const layer = imageData.layer; // 仮定: imageDataオブジェクトにlayerプロパティがある
        if (!layer) {
            console.error("Layer not found for ImageData in WebGL drawCircle.");
            return;
        }
        const { texture: targetTexture, framebuffer: targetFBO } = this._getOrCreateLayerResources(layer);

        gl.bindFramebuffer(gl.FRAMEBUFFER, targetFBO); // 描画ターゲットをレイヤーのFBOに設定
        gl.viewport(0, 0, this.width, this.height); // ビューポートをキャンバスサイズに設定

        gl.useProgram(this.circleProgram);

        // 頂点バッファを設定
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.enableVertexAttribArray(this.circleProgram.positionLocation);
        gl.vertexAttribPointer(this.circleProgram.positionLocation, 2, gl.FLOAT, false, 0, 0);

        // Uniform変数を設定
        gl.uniform2f(this.circleProgram.resolutionLocation, this.width, this.height);
        gl.uniform2f(this.circleProgram.centerLocation, centerX, centerY);
        gl.uniform1f(this.circleProgram.radiusLocation, radius);
        gl.uniform4f(this.circleProgram.colorLocation, color.r / 255, color.g / 255, color.b / 255, color.a / 255);
        gl.uniform1i(this.circleProgram.isEraserLocation, isEraser ? 1 : 0);

        // ブレンド設定を消しゴムモードに合わせて調整
        if (isEraser) {
            // 消しゴムの場合、ターゲットのアルファを減衰させるためのブレンド設定
            gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_ALPHA);
        } else {
            // ペンの場合、通常のアルファブレンド
            gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        }

        // 描画
        gl.drawArrays(gl.TRIANGLES, 0, 6); // 矩形を描画することで円の範囲をカバー

        gl.bindFramebuffer(gl.FRAMEBUFFER, null); // 描画ターゲットをデフォルトに戻す
        gl.useProgram(null);
        // ブレンド設定を元に戻す（次回の描画に備えて）
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }

    /**
     * WebGLで線を描画 (複数の円をつなぎ合わせる方式)
     * @param {ImageData} imageData
     * @param {number} x0
     * @param {number} y0
     * @param {number} x1
     * @param {number} y1
     * @param {number} size
     * @param {object} color - {r, g, b, a}
     * @param {boolean} isEraser
     * @param {object} [p0=null] - 筆圧情報 (previous point)
     * @param {object} [p1=null] - 筆圧情報 (current point)
     */
    drawLine(imageData, x0, y0, x1, y1, size, color, isEraser, p0, p1) {
        // 筆圧に応じた太さの計算
        const startRadius = (p0 && p0.pressure !== undefined) ? size * (0.5 + p0.pressure * 0.5) / 2 : size / 2;
        const endRadius = (p1 && p1.pressure !== undefined) ? size * (0.5 + p1.pressure * 0.5) / 2 : size / 2;

        const dist = Math.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2);
        if (dist === 0) {
            this.drawCircle(imageData, x0, y0, startRadius, color, isEraser);
            return;
        }

        const numSteps = Math.max(1, Math.ceil(dist / (size / 4))); // 太さに応じてステップ数を増やす
        for (let i = 0; i <= numSteps; i++) {
            const t = i / numSteps;
            const currentX = x0 + (x1 - x0) * t;
            const currentY = y0 + (y1 - y0) * t;
            const currentRadius = startRadius + (endRadius - startRadius) * t;
            this.drawCircle(imageData, currentX, currentY, currentRadius, color, isEraser);
        }
    }

    /**
     * 画像データをクリア (WebGLではテクスチャをクリア)
     * @param {ImageData} imageData
     */
    clear(imageData) {
        const gl = this.gl;
        const layer = imageData.layer; // 仮定: imageDataオブジェクトにlayerプロパティがある
        if (!layer) {
            console.error("Layer not found for ImageData in WebGL clear.");
            return;
        }
        const { framebuffer: targetFBO } = this._getOrCreateLayerResources(layer);

        gl.bindFramebuffer(gl.FRAMEBUFFER, targetFBO);
        gl.viewport(0, 0, this.width, this.height);
        gl.clearColor(0.0, 0.0, 0.0, 0.0); // 透明でクリア
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    /**
     * WebGLでレイヤー群を合成
     * @param {Array<Layer>} layers - レイヤーの配列
     * @param {object} compositionData - 合成に必要な追加データ (例: dirtyRect)
     * @param {object} [dirtyRect=null] - 更新範囲 (現時点では無視)
     */
    compositeLayers(layers, compositionData, dirtyRect) {
        const gl = this.gl;
        if (!gl || !this.textureProgram || !this.compositeFramebuffer || !this.compositeTexture) {
            console.warn("WebGL not initialized or resources missing for compositing.");
            return;
        }

        console.log(`Compositing ${layers.length} layers for WebGL...`);

        // 合成ターゲットをcompositeFramebufferに設定
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.compositeFramebuffer);
        gl.viewport(0, 0, this.width, this.height);
        gl.clearColor(0.0, 0.0, 0.0, 0.0); // 合成前にクリア
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(this.textureProgram);

        // 頂点とテクスチャ座標バッファを設定
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.enableVertexAttribArray(this.textureProgram.positionLocation);
        gl.vertexAttribPointer(this.textureProgram.positionLocation, 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.enableVertexAttribArray(this.textureProgram.texCoordLocation);
        gl.vertexAttribPointer(this.textureProgram.texCoordLocation, 2, gl.FLOAT, false, 0, 0);

        gl.activeTexture(gl.TEXTURE0); // テクスチャユニット0をアクティブに
        gl.uniform1i(this.textureProgram.imageLocation, 0); // uniformにテクスチャユニット0を設定

        // レイヤーを順番に合成
        for (const layer of layers) {
            if (!layer.visible || layer.opacity === 0) continue;

            // ImageDataが更新されている可能性があるため、テクスチャを更新
            const { texture: layerTexture } = this._getOrCreateLayerResources(layer);
            this._createOrUpdateTextureFromImageData(layer.imageData, layerTexture);

            gl.bindTexture(gl.TEXTURE_2D, layerTexture);
            gl.uniform1f(this.textureProgram.opacityLocation, layer.opacity / 100.0); // 不透明度をuniformに設定

            // ここでブレンドモードを切り替えるロジックが必要（現在は通常のアルファブレンドのみ）
            // 将来的に `layer.blendMode` に応じて gl.blendFunc を変更するか、
            // 別途ブレンドシェーダーを用意して切り替える。
            gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); // 通常のアルファブレンド

            gl.drawArrays(gl.TRIANGLES, 0, 6); // 矩形を描画してレイヤーテクスチャを合成
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null); // 描画ターゲットをデフォルトに戻す
        gl.useProgram(null);
    }

    /**
     * 合成された画像を画面にレンダリングする
     * @param {*} [anyArgs] - core-engine.jsから渡される可能性のある任意の引数。ここでは無視。
     */
    renderToDisplay(...anyArgs) { // 引数をanyArgsとして受け取り、使わない
        const gl = this.gl;
        if (!gl || !this.textureProgram) {
            console.warn("WebGL not initialized or texture program missing for display.");
            return;
        }

        console.log("renderToDisplay called.");
        console.log("Received arguments (ignored for WebGL rendering):", anyArgs);
        console.log("Composite texture:", this.compositeTexture);
        if (this.compositeTexture) {
            console.log("Is compositeTexture a WebGLTexture (gl.isTexture)?", gl.isTexture(this.compositeTexture));
        } else {
            console.log("compositeTexture is null or undefined.");
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null); // 画面に直接描画
        gl.viewport(0, 0, this.width, this.height);
        gl.clearColor(0.0, 0.0, 0.0, 0.0); // 画面を透明でクリア
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(this.textureProgram);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.enableVertexAttribArray(this.textureProgram.positionLocation);
        gl.vertexAttribPointer(this.textureProgram.positionLocation, 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.enableVertexAttribArray(this.textureProgram.texCoordLocation);
        gl.vertexAttribPointer(this.textureProgram.texCoordLocation, 2, gl.FLOAT, false, 0, 0);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.compositeTexture);
        gl.uniform1i(this.textureProgram.imageLocation, 0);
        gl.uniform1f(this.textureProgram.opacityLocation, 1.0); // 画面表示時は不透明度100%

        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); // 通常のアルファブレンドで描画

        gl.drawArrays(gl.TRIANGLES, 0, 6); // 画面全体に描画

        gl.useProgram(null);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    /**
     * 未実装のDrawingEngineメソッド
     * 現在はWebGLでの直接操作を前提としないため、エラーをスロー。
     * 必要に応じて実装を検討。
     */
    fill(imageData, color) { throw new Error("Method 'fill()' must be implemented in WebGLEngine."); }
    getTransformedImageData(sourceImageData, transform) { throw new Error("Method 'getTransformedImageData()' must be implemented in WebGLEngine."); }
}