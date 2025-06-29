/*
 * ===================================================================================
 * Toshinka Tegaki Tool - WebGL Engine (Comprehensive Fixes for Display and Features)
 * Version: 0.5.0 (Phase 4A-7: Y-Flip, Blending, Full Transform, Anti-aliasing)
 *
 * WebGL表示のY軸反転、ブレンドアーティファクトを修正し、
 * レイヤー変形プレビューを完全に再実装しました。
 * Canvas2DのImageData直接操作による描画ロジックは維持しています。
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

        this.layerTextures = new Map();

        this.drawingQuality = {
            enableSubpixel: true,
            antialiasThreshold: 2.0,
            minDrawSteps: 1,
            maxDrawSteps: 100
        };

        // ★再追加: 変形用の一時的なオフスクリーンキャンバス (getTransformedImageData用)
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
        // ★★★修正: 事前乗算アルファのブレンド設定に変更 (UNPACK_PREMULTIPLY_ALPHA_WEBGLと併用) ★★★
        // これにより、Canvas2Dの描画結果がより正確にブレンドされることが期待されます。
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); 

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

        // ★修正: opacityをシェーダーで扱うようにuniformを追加
        const fsSource = `
            precision mediump float;
            varying vec2 v_texCoord;
            uniform sampler2D u_image;
            uniform float u_opacity; // ★新規追加: 不透明度ユニフォーム

            void main() {
                vec4 texColor = texture2D(u_image, v_texCoord);
                // テクスチャの色に不透明度を適用
                gl_FragColor = vec4(texColor.rgb, texColor.a * u_opacity);
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
        // ★修正: Y軸反転を`gl.UNPACK_FLIP_Y_WEBGL`で行うため、テクスチャ座標は標準的なものに戻す ★
        // WebGLのテクスチャ座標は左下(0,0)、右上(1,1)が基準
        // クアッドの頂点順序: top-left, bottom-left, top-right, bottom-right
        this.texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        const texCoords = [
            0.0, 1.0,  // top-left of quad corresponds to (0,1) of texture (top-left of texture when Y is flipped)
            0.0, 0.0,  // bottom-left of quad corresponds to (0,0) of texture (bottom-left of texture when Y is flipped)
            1.0, 1.0,   // top-right of quad corresponds to (1,1) of texture (top-right of texture when Y is flipped)
            1.0, 0.0,  // bottom-right of quad corresponds to (1,0) of texture (bottom-right of texture when Y is flipped)
        ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);

        // -----------------------------------------------------------
        // アトリビュートとユニフォームのロケーション取得
        // -----------------------------------------------------------
        this.a_position_loc = gl.getAttribLocation(this.program, "a_position");
        this.a_texCoord_loc = gl.getAttribLocation(this.program, "a_texCoord");
        this.u_image_loc = gl.getUniformLocation(this.program, "u_image");
        this.u_opacity_loc = gl.getUniformLocation(this.program, "u_opacity"); // ★新規追加: 不透明度ユニフォームのロケーション

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

        // ★★★重要修正: ImageDataをWebGLテクスチャにアップロードする際にY軸を反転させる★★★
        // これにより、ImageDataの上下方向がWebGLのテクスチャ座標系と一致します。
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        // ★★★修正: ImageDataを事前乗算アルファとしてアップロードする★★★
        // blendFunc(ONE, ONE_MINUS_SRC_ALPHA) と合わせるため
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);


        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageData);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        gl.bindTexture(gl.TEXTURE_2D, null);

        return texture;
    }

    /**
     * 合成結果を格納するFBOとテクスチャをセットアップします。
     */
    _setupCompositingBuffer() {
        const gl = this.gl;
        const width = this.canvas.width;
        const height = this.canvas.height;

        if (this.compositeFBO) {
            gl.deleteFramebuffer(this.compositeFBO);
        }
        if (this.compositeTexture) {
            gl.deleteTexture(this.compositeTexture);
        }

        this.compositeTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.compositeTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);

        this.compositeFBO = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.compositeFBO);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.compositeTexture, 0);

        const fbStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (fbStatus !== gl.FRAMEBUFFER_COMPLETE) {
            console.error('Framebuffer not complete, status: ' + fbStatus);
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        console.log("Compositing buffer (FBO & Texture) setup completed.");
    }

    /**
     * レイヤーをテクスチャに変換し、合成バッファに描画します。
     */
    compositeLayers(layers, compositionData, dirtyRect) {
        if (!this.gl || !this.program || !this.compositeFBO || !this.compositeTexture) {
            console.warn("WebGL not ready for compositing.");
            return;
        }

        const gl = this.gl;

        console.log(`Compositing ${layers.length} layers for WebGL...`);

        const currentLayerNames = new Set();
        for (const layer of layers) {
            currentLayerNames.add(layer.name);
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
        gl.clear(gl.COLOR_BUFFER_BIT); // FBOをクリア

        gl.useProgram(this.program);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.vertexAttribPointer(this.a_position_loc, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.a_position_loc);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.vertexAttribPointer(this.a_texCoord_loc, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.a_texCoord_loc);

        let layerCount = 0;
        for (const layer of layers) {
            if (!layer.visible || layer.opacity === 0 || !this.layerTextures.has(layer)) continue;

            const texture = this.layerTextures.get(layer);
            
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.uniform1i(this.u_image_loc, 0);
            // ★新規追加: レイヤーの不透明度をユニフォームとして渡す
            gl.uniform1f(this.u_opacity_loc, layer.opacity / 100.0); 

            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            layerCount++;
        }
        console.log(`Rendered ${layerCount} layers onto compositing FBO.`);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.disableVertexAttribArray(this.a_position_loc);
        gl.disableVertexAttribArray(this.a_texCoord_loc);
    }

    /**
     * 合成されたテクスチャをディスプレイにレンダリングします。
     */
    renderToDisplay(compositionData, dirtyRect) { // ImageDataとcompositionDataはCanvas2D向けでWebGLでは無視
        if (!this.gl || !this.program || !this.compositeTexture) {
            console.warn("WebGL not ready for display rendering.");
            return;
        }
        const gl = this.gl;

        console.log("renderToDisplay called.");

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(this.program);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.vertexAttribPointer(this.a_position_loc, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.a_position_loc);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.vertexAttribPointer(this.a_texCoord_loc, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.a_texCoord_loc);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.compositeTexture);
        gl.uniform1i(this.u_image_loc, 0);
        gl.uniform1f(this.u_opacity_loc, 1.0); // 最終表示は不透明度100%

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        gl.disableVertexAttribArray(this.a_position_loc);
        gl.disableVertexAttribArray(this.a_texCoord_loc);

        console.log("Composite texture rendered to display.");
    }
    
    // --- ImageDataへの直接描画 (Canvas2DEngineから移植) ---
    // これらのメソッドはCPUでImageDataを操作し、その結果がcompositeLayersでWebGLテクスチャに再アップロードされることを前提としています。

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

        // CanvasのTransform APIを使って変換を適用
        ctx.save();
        ctx.clearRect(0, 0, sw, sh); // 変換前のキャンバスをクリア
        
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
            // ImageDataのアルファは非事前乗算であるため、ブレンド前に事前乗算する
            // WebGLの UNPACK_PREMULTIPLY_ALPHA_WEBGL が true の場合、GPUが自動で行うため、
            // ここでの手動事前乗算は不要。
            // ここではImageDataの内容をCPU側で準備するだけなので、通常通りRGB値を設定し、
            // アルファもそのまま設定します。WebGLアップロード時に自動で処理されます。
            
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