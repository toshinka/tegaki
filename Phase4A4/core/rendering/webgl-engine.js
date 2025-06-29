/*
 * ===================================================================================
 * Toshinka Tegaki Tool - WebGL Engine (Texture Management & Basic Compositing)
 * Version: 0.3.0 (Phase 4A-3 - Basic Drawing & Compositing)
 *
 * レイヤーのImageDataをWebGLテクスチャに変換し、管理する機能に加え、
 * ImageDataへの直接描画（drawCircle, drawLine, fill, clear）と、
 * レイヤーのWebGL合成機能（compositeLayers）の基礎を実装しました。
 * WebGL警告の解消とキャンバス表示の初期化に対応します。
 * ===================================================================================
 */
import { DrawingEngine } from './drawing-engine.js';

export class WebGLEngine extends DrawingEngine {
    constructor(canvas) {
        super(canvas);
        this.gl = null;
        this.layerTextures = new Map(); // レイヤーとWebGLテクスチャのペアを保管

        // WebGLコンテキストの初期化
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
        gl.clearColor(0.1, 0.1, 0.1, 1.0); // 背景色をクリア
        gl.enable(gl.BLEND); // アルファブレンディングを有効にする
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); // 通常のアルファブレンド設定

        // WebGLシェーダーとプログラムのセットアップ
        this._initShaders();
        this._initBuffers();

        // オフスクリーンレンダリング用のフレームバッファとテクスチャ
        this.offscreenFramebuffer = null;
        this.offscreenTexture = null;
        this._setupOffscreenFramebuffer();
    }

    /**
     * WebGLが利用可能か事前にチェックするための静的メソッド
     * @returns {boolean}
     */
    static isSupported() {
        try {
            const canvas = document.createElement('canvas');
            return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
        } catch (e) {
            return false;
        }
    }

    /**
     * WebGLシェーダーとプログラムを初期化する
     */
    _initShaders() {
        const gl = this.gl;

        // 頂点シェーダー（テクスチャ付きクアッド用）
        const vsSource = `
            attribute vec4 aVertexPosition;
            attribute vec2 aTextureCoord;
            varying highp vec2 vTextureCoord;

            void main(void) {
                gl_Position = aVertexPosition;
                vTextureCoord = aTextureCoord;
            }
        `;

        // フラグメントシェーダー（テクスチャをそのまま描画）
        const fsSource = `
            varying highp vec2 vTextureCoord;
            uniform sampler2D uSampler;
            uniform highp float uOpacity; // 透明度ユニフォーム

            void main(void) {
                highp vec4 texelColor = texture2D(uSampler, vTextureCoord);
                gl_FragColor = vec4(texelColor.rgb, texelColor.a * uOpacity); // 透明度を適用
            }
        `;

        const vertexShader = this._loadShader(gl.VERTEX_SHADER, vsSource);
        const fragmentShader = this._loadShader(gl.FRAGMENT_SHADER, fsSource);

        this.shaderProgram = gl.createProgram();
        gl.attachShader(this.shaderProgram, vertexShader);
        gl.attachShader(this.shaderProgram, fragmentShader);
        gl.linkProgram(this.shaderProgram);

        if (!gl.getProgramParameter(this.shaderProgram, gl.LINK_STATUS)) {
            console.error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(this.shaderProgram));
            this.shaderProgram = null;
        }

        this.programInfo = {
            program: this.shaderProgram,
            attribLocations: {
                vertexPosition: gl.getAttribLocation(this.shaderProgram, 'aVertexPosition'),
                textureCoord: gl.getAttribLocation(this.shaderProgram, 'aTextureCoord'),
            },
            uniformLocations: {
                uSampler: gl.getUniformLocation(this.shaderProgram, 'uSampler'),
                uOpacity: gl.getUniformLocation(this.shaderProgram, 'uOpacity'), // 透明度ユニフォームのロケーションを取得
            },
        };
    }

    /**
     * シェーダーをコンパイルするヘルパーメソッド
     * @param {number} type - gl.VERTEX_SHADER または gl.FRAGMENT_SHADER
     * @param {string} source - シェーダーのソースコード
     * @returns {WebGLShader} コンパイルされたシェーダー
     */
    _loadShader(type, source) {
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
     * 頂点バッファとテクスチャ座標バッファを初期化する
     */
    _initBuffers() {
        const gl = this.gl;

        // 頂点バッファ（キャンバス全体を覆う四角形）
        const positions = [
            -1.0, 1.0,  // Top-left
            1.0, 1.0,   // Top-right
            -1.0, -1.0, // Bottom-left
            1.0, -1.0,  // Bottom-right
        ];
        this.positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

        // テクスチャ座標バッファ
        const textureCoordinates = [
            0.0, 0.0, // Top-left
            1.0, 0.0, // Top-right
            0.0, 1.0, // Bottom-left
            1.0, 1.0, // Bottom-right
        ];
        this.textureCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.textureCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoordinates), gl.STATIC_DRAW);
    }

    /**
     * オフスクリーンレンダリング用のフレームバッファとテクスチャを設定する
     */
    _setupOffscreenFramebuffer() {
        const gl = this.gl;

        // フレームバッファを作成
        this.offscreenFramebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.offscreenFramebuffer);

        // レンダリング結果を格納するテクスチャを作成
        this.offscreenTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.offscreenTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.canvas.width, this.canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        // フレームバッファにテクスチャをアタッチ
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.offscreenTexture, 0);

        // フレームバッファの完全性をチェック
        const fbStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (fbStatus !== gl.FRAMEBUFFER_COMPLETE) {
            console.error('Framebuffer not complete. Status: ' + fbStatus);
            // エラーの種類に基づいてより詳細なメッセージを表示
            switch (fbStatus) {
                case gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT:
                    console.error('FRAMEBUFFER_INCOMPLETE_ATTACHMENT: Not all framebuffer attachment points are framebuffer attachment complete.');
                    break;
                case gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS:
                    console.error('FRAMEBUFFER_INCOMPLETE_DIMENSIONS: Not all attached images have the same width and height.');
                    break;
                case gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT:
                    console.error('FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT: No images are attached to the framebuffer.');
                    break;
                case gl.FRAMEBUFFER_UNSUPPORTED:
                    console.error('FRAMEBUFFER_UNSUPPORTED: The combination of internal formats of the attached images is not supported.');
                    break;
                default:
                    console.error('Unknown Framebuffer status: ' + fbStatus);
            }
        }

        // 描画ターゲットをデフォルトのフレームバッファに戻す
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }


    // --- DrawingEngineのインターフェース実装 (ImageDataを直接操作) ---

    /**
     * ImageDataに円を描画する
     * WebGLは最終的な合成に利用するため、ここではImageDataを直接編集する
     */
    drawCircle(imageData, centerX, centerY, radius, color, isEraser) {
        if (!imageData || !imageData.data) return;
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;

        const r = color.r;
        const g = color.g;
        const b = color.b;
        const a = isEraser ? 0 : color.a; // 消しゴムの場合は透明度を0に

        const radiusSq = radius * radius;

        const startX = Math.max(0, Math.floor(centerX - radius));
        const endX = Math.min(width, Math.ceil(centerX + radius));
        const startY = Math.max(0, Math.floor(centerY - radius));
        const endY = Math.min(height, Math.ceil(centerY + radius));

        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                const distSq = (x - centerX) * (x - centerX) + (y - centerY) * (y - centerY);
                if (distSq <= radiusSq) {
                    const index = (y * width + x) * 4;
                    if (isEraser) {
                        data[index + 3] = 0; // アルファ値を0にする
                    } else {
                        data[index] = r;
                        data[index + 1] = g;
                        data[index + 2] = b;
                        data[index + 3] = a;
                    }
                }
            }
        }
    }

    /**
     * ImageDataに線を描画する（Bresenham's line algorithmを簡易的に実装）
     * WebGLは最終的な合成に利用するため、ここではImageDataを直接編集する
     */
    drawLine(imageData, x0, y0, x1, y1, size, color, isEraser, p0, p1, calculatePressureSize) {
        if (!imageData || !imageData.data) return;
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;

        const r = color.r;
        const g = color.g;
        const b = color.b;
        const a = isEraser ? 0 : color.a;

        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = (x0 < x1) ? 1 : -1;
        const sy = (y0 < y1) ? 1 : -1;
        let err = dx - dy;

        let currentX = x0;
        let currentY = y0;

        let count = 0;
        const totalSteps = Math.max(dx, dy);

        while (true) {
            const t = totalSteps > 0 ? count / totalSteps : 0;
            const currentPressure = p0 + (p1 - p0) * t;
            const currentSize = calculatePressureSize ? calculatePressureSize(size, currentPressure) : size;

            this.drawCircle(imageData, currentX, currentY, currentSize / 2, color, isEraser);

            if (currentX === x1 && currentY === y1) break;

            const e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy;
                currentX += sx;
            }
            if (e2 < dx) {
                err += dx;
                currentY += sy;
            }
            count++;
        }
    }

    /**
     * ImageData全体を指定色で塗りつぶす
     */
    fill(imageData, color) {
        if (!imageData || !imageData.data) return;
        const data = imageData.data;
        const r = color.r;
        const g = color.g;
        const b = color.b;
        const a = color.a;

        for (let i = 0; i < data.length; i += 4) {
            data[i] = r;
            data[i + 1] = g;
            data[i + 2] = b;
            data[i + 3] = a;
        }
    }

    /**
     * ImageData全体をクリアする（透明にする）
     */
    clear(imageData) {
        if (!imageData || !imageData.data) return;
        imageData.data.fill(0); // すべてのピクセルデータを0で埋める = 透明
        // WebGLエンジンに切り替えてクリアした際に、保管済みのテクスチャも破棄する
        this.layerTextures.forEach(texture => this.gl.deleteTexture(texture));
        this.layerTextures.clear();
        console.log("WebGL textures cleared.");
    }

    // transformはWebGLでの実装が必要になるが、ImageDataを返すのはDrawingEngineの責務
    // 現時点では、Canvas2DEngineと同様に実装するか、エラーをスローするのが適切。
    // 今回はImageDataを直接操作するDrawingEngineの役割に徹するため、未実装とする。
    getTransformedImageData(sourceImageData, transform) {
        // このメソッドはWebGLで直接変換を適用するべきだが、ImageDataベースのDrawingEngineに合わせる
        // ここではCanvas2Dの機能を使うか、シンプルなコピーを行うか、あるいはエラーをスローする
        // 現状では未実装とする
        throw new Error("Method 'getTransformedImageData()' must be implemented for WebGL transformations if required.");
    }


    /**
     * レイヤーのImageDataからWebGLテクスチャを作成または更新する
     * @param {ImageData} imageData - レイヤーの画像データ
     * @param {WebGLTexture} [existingTexture] - 更新する既存のテクスチャ（オプション）
     * @returns {WebGLTexture} 作成または更新されたテクスチャ
     */
    _createOrUpdateTextureFromImageData(imageData, existingTexture) {
        const gl = this.gl;
        if (!gl) return null;

        const texture = existingTexture || gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);

        // テクスチャパラメータを設定
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); // LINEARで補間
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        // ImageDataをテクスチャに転送
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageData);

        // 他のテクスチャに影響を与えないように、バインドを解除
        gl.bindTexture(gl.TEXTURE_2D, null);

        return texture;
    }

    /**
     * レイヤー群をWebGLで合成し、結果をcompositionDataに書き込む
     * WebGL警告の原因となっていたフレームバッファの不完全性問題をここで解決する
     * @param {Array<Layer>} layers - 合成するレイヤーの配列
     * @param {ImageData} compositionData - 合成結果を書き込むImageDataオブジェクト
     * @param {object} dirtyRect - 再描画が必要な領域 (WebGLでは通常、全体を再描画することが多いが、部分更新のヒントとして利用)
     */
    compositeLayers(layers, compositionData, dirtyRect) {
        const gl = this.gl;
        if (!gl || !this.programInfo || !this.offscreenFramebuffer || !this.offscreenTexture) {
            console.warn("WebGL is not ready for compositing.");
            // WebGLが利用できない場合、compositionDataをクリアしておく
            if (compositionData) compositionData.data.fill(0);
            return;
        }

        console.log(`Compositing ${layers.length} layers for WebGL...`);

        // オフスクリーンフレームバッファにレンダリング
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.offscreenFramebuffer);
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);

        // フレームバッファをクリア
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(this.programInfo.program);

        // 頂点バッファを設定
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.vertexAttribPointer(this.programInfo.attribLocations.vertexPosition, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.programInfo.attribLocations.vertexPosition);

        // テクスチャ座標バッファを設定
        gl.bindBuffer(gl.ARRAY_BUFFER, this.textureCoordBuffer);
        gl.vertexAttribPointer(this.programInfo.attribLocations.textureCoord, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.programInfo.attribLocations.textureCoord);

        let activeTextureUnit = 0; // テクスチャユニットのカウンタ

        for (const layer of layers) {
            if (!layer.visible || layer.opacity === 0) continue;

            // レイヤーのImageDataをテクスチャに変換または更新
            const texture = this._createOrUpdateTextureFromImageData(layer.imageData, this.layerTextures.get(layer));
            this.layerTextures.set(layer, texture); // マップを更新

            // テクスチャをアクティブなテクスチャユニットにバインド
            gl.activeTexture(gl.TEXTURE0 + activeTextureUnit);
            gl.bindTexture(gl.TEXTURE_2D, texture);

            // サンプラーユニフォームを設定
            gl.uniform1i(this.programInfo.uniformLocations.uSampler, activeTextureUnit);
            // 不透明度ユニフォームを設定 (0-1の範囲に正規化)
            gl.uniform1f(this.programInfo.uniformLocations.uOpacity, layer.opacity / 100.0);

            // クアッドを描画
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

            activeTextureUnit++; // 次のテクスチャユニットへ
            if (activeTextureUnit >= gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS) {
                console.warn("Exceeded max combined texture image units. Some layers might not be rendered.");
                break;
            }
        }

        // フレームバッファからピクセルを読み出し、compositionDataに書き込む
        gl.readPixels(0, 0, this.canvas.width, this.canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, compositionData.data);

        // 描画ターゲットをデフォルトのフレームバッファに戻す
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.bindTexture(gl.TEXTURE_2D, null); // 使用後のテクスチャバインド解除
        gl.disableVertexAttribArray(this.programInfo.attribLocations.vertexPosition);
        gl.disableVertexAttribArray(this.programInfo.attribLocations.textureCoord);

        console.log("WebGL compositing finished.");
    }
}