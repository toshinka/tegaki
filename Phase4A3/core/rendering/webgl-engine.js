/*
 * ===================================================================================
 * Toshinka Tegaki Tool - WebGL Engine (Full Rendering Pipeline with Canvas2D Drawing Logic)
 * Version: 0.4.0 (Phase 4A-5: Drawing & Transform Logic Implementation)
 *
 * レイヤーのImageDataをWebGLテクスチャに変換し、それを合成して画面に表示する
 * 完全な描画パイプラインを実装しました。
 * Canvas2DのImageData直接操作による描画ロジックを移植し、
 * getTransformedImageDataも実装しました。
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

        // ★新規追加: 描画品質設定 (Canvas2DEngineから移植)
        this.drawingQuality = {
            enableSubpixel: true,
            antialiasThreshold: 2.0,
            minDrawSteps: 1,
            maxDrawSteps: 100
        };

        // ★新規追加: 変形用の一時的なオフスクリーンキャンバス (getTransformedImageData用)
        this.transformOffscreenCanvas = document.createElement('canvas');
        this.transformOffscreenCtx = this.transformOffscreenCanvas.getContext('2d');


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
    renderToDisplay(compositionData, dirtyRect) { // ImageDataとcompositionDataはCanvas2D向けでWebGLでは無視
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
    
    // --- ImageDataへの直接描画 (Canvas2DEngineから移植) ---

    drawCircle(imageData, centerX, centerY, radius, color, isEraser) {
        const quality = this.drawingQuality;
        const useSubpixel = quality.enableSubpixel && radius >= 0.5;
        if (radius < 0.8) {
            this._drawSinglePixel(imageData, centerX, centerY, color, isEraser, radius);
            return;
        }
        const rCeil = Math.ceil(radius + 1);
        for (let y = -rCeil; y <= rCeil; y++) {
            for (let x = -rCeil; x <= rCeil; x++) {
                const distance = Math.hypot(x, y);
                if (distance <= radius + 0.5) {
                    const finalX = centerX + x;
                    const finalY = centerY + y;
                    let alpha = this._calculatePixelAlpha(distance, radius, useSubpixel);
                    if (alpha > 0.01) {
                        if (isEraser) {
                            this._erasePixel(imageData, finalX, finalY, alpha);
                        } else {
                            const finalColor = { ...color, a: Math.floor(color.a * alpha) };
                            this._blendPixel(imageData, finalX, finalY, finalColor);
                        }
                    }
                }
            }
        }
    }

    drawLine(imageData, x0, y0, x1, y1, size, color, isEraser, pressure0 = 1.0, pressure1 = 1.0, calculatePressureSize) {
        if (!isFinite(x0) || !isFinite(y0) || !isFinite(x1) || !isFinite(y1)) return;
        const distance = Math.hypot(x1 - x0, y1 - y0);
        if (distance > Math.hypot(this.canvas.width, this.canvas.height) * 2) return;

        const quality = this.drawingQuality;
        const baseSteps = Math.max(quality.minDrawSteps, Math.ceil(distance / Math.max(0.5, size / 8)));
        const steps = Math.min(quality.maxDrawSteps, baseSteps);

        for (let i = 0; i <= steps; i++) {
            const t = steps > 0 ? i / steps : 0;
            const x = x0 + (x1 - x0) * t;
            const y = y0 + (y1 - y0) * t;
            const pressure = pressure0 + (pressure1 - pressure0) * t;
            const adjustedSize = calculatePressureSize(size, pressure);
            this.drawCircle(imageData, x, y, adjustedSize / 2, color, isEraser);
        }
    }

    fill(imageData, color) {
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            data[i] = color.r;
            data[i + 1] = color.g;
            data[i + 2] = color.b;
            data[i + 3] = color.a;
        }
    }

    clear(imageData) {
        imageData.data.fill(0);
    }
    
    // ★★★ getTransformedImageDataの実装 (Canvas2DEngineのロジックをベースにWebGLEngineで利用) ★★★
    getTransformedImageData(sourceImageData, transform) {
        const sw = sourceImageData.width;
        const sh = sourceImageData.height;
        
        // オフスクリーンキャンバスのサイズをImageDataに合わせる
        this.transformOffscreenCanvas.width = sw;
        this.transformOffscreenCanvas.height = sh;
        const ctx = this.transformOffscreenCtx;

        // 一旦オフスクリーンキャンバスに元のImageDataを描画
        ctx.clearRect(0, 0, sw, sh);
        ctx.putImageData(sourceImageData, 0, 0);

        // 新しいImageDataを生成（透明で初期化）
        const destImageData = new ImageData(sw, sh);

        // CanvasのTransform APIを使って変換を適用
        ctx.save();
        ctx.clearRect(0, 0, sw, sh); // クリア
        
        // 変換の中心をキャンバスの中心に設定
        const cx = sw / 2;
        const cy = sh / 2;
        ctx.translate(cx, cy);

        // スケール、回転、フリップ
        ctx.scale(transform.flipX || 1, transform.flipY || 1);
        ctx.rotate(-transform.rotation * Math.PI / 180); // 回転は時計回りのため-を付与
        ctx.scale(transform.scale, transform.scale);
        
        // 移動
        ctx.translate(-cx + transform.x, -cy + transform.y);
        
        // 元の画像を新しい変換で描画
        ctx.drawImage(this.transformOffscreenCanvas, 0, 0);

        // 変換後のImageDataを取得
        const transformedData = ctx.getImageData(0, 0, sw, sh);
        ctx.restore(); // 変換を元に戻す

        // 取得したImageDataを返す
        return transformedData;
    }


    // --- プライベートヘルパーメソッド (Canvas2DEngineから移植) ---

    _drawSinglePixel(imageData, x, y, color, isEraser, intensity = 1.0) {
        const alpha = Math.min(1.0, intensity);
        if (isEraser) {
            this._erasePixel(imageData, x, y, alpha);
        } else {
            const finalColor = { ...color, a: Math.floor(color.a * alpha) };
            this._blendPixel(imageData, x, y, finalColor);
        }
    }

    _calculatePixelAlpha(distance, radius, useSubpixel) {
        if (distance <= radius - 0.5) { return 1.0; }
        if (!useSubpixel) { return distance <= radius ? 1.0 : 0.0; }
        if (distance <= radius) {
            const fadeStart = Math.max(0, radius - 1.0);
            const fadeRange = radius - fadeStart;
            if (fadeRange > 0) {
                const fadeRatio = (distance - fadeStart) / fadeRange;
                return Math.max(0, 1.0 - fadeRatio);
            }
            return 1.0;
        }
        if (distance <= radius + 0.5) {
            return Math.max(0, 1.0 - (distance - radius) * 2.0);
        }
        return 0.0;
    }

    _blendPixel(imageData, x, y, color) {
        try {
            x = Math.floor(x);
            y = Math.floor(y);
            if (x < 0 || x >= imageData.width || y < 0 || y >= imageData.height) return;
            if (!imageData.data || !color) return;
            const index = (y * imageData.width + x) * 4;
            const data = imageData.data;
            if (index < 0 || index >= data.length - 3) return;

            const topAlpha = color.a / 255;
            if (topAlpha <= 0) return;
            if (topAlpha >= 1) {
                data[index] = color.r;
                data[index + 1] = color.g;
                data[index + 2] = color.b;
                data[index + 3] = color.a;
                return;
            }

            const bottomAlpha = data[index + 3] / 255;
            const outAlpha = topAlpha + bottomAlpha * (1 - topAlpha);
            if (outAlpha > 0) {
                data[index]     = (color.r * topAlpha + data[index]     * bottomAlpha * (1 - topAlpha)) / outAlpha;
                data[index + 1] = (color.g * topAlpha + data[index + 1] * bottomAlpha * (1 - topAlpha)) / outAlpha;
                data[index + 2] = (color.b * topAlpha + data[index + 2] * bottomAlpha * (1 - topAlpha)) / outAlpha;
                data[index + 3] = outAlpha * 255;
            }
        } catch (error) {
            console.warn('ピクセル描画エラー:', { x, y, error });
        }
    }

    _erasePixel(imageData, x, y, strength) {
        x = Math.floor(x);
        y = Math.floor(y);
        if (x < 0 || x >= imageData.width || y < 0 || y >= imageData.height) return;
        const index = (y * imageData.width + x) * 4;
        const currentAlpha = imageData.data[index + 3];
        imageData.data[index + 3] = Math.max(0, currentAlpha * (1 - strength));
    }
}