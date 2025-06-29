/*
 * ===================================================================================
 * Toshinka Tegaki Tool - WebGL Engine (Renderer Implementation)
 * Version: 0.3.2 (Phase 4A-4 Bugfix - Color & Blending)
 *
 * ・最終描画時のブレンド関数を修正し、キャンバスが黒くなる問題を解決。
 * ・合成時と最終表示時でブレンド設定を明確に切り替えるように変更。
 * ・★★不透明度とブレンド設定をストレートアルファに統一★★
 * ・★★フラグメントシェーダーでのカラー計算を修正★★
 * ・★★drawCircle/drawLineでの色適用ロジックを強化★★
 * ===================================================================================
 */
import { DrawingEngine } from './drawing-engine.js';

// hexToRgba関数をWebGL Engine内でも利用可能にする (core-engine.jsからコピー)
function hexToRgba(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
        a: 255
    } : { r: 0, g: 0, b: 0, a: 255 };
}

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
        // ★修正: ストレートアルファ用にカラー計算を変更 (textureColor.rgbを直接使用)
        // ここでのtextureColor.a * u_opacity は、最終的なアルファ値を決定します。
        gl_FragColor = vec4(textureColor.rgb, textureColor.a * u_opacity); 
    }
`;


export class WebGLEngine extends DrawingEngine {
    constructor(canvas) {
        super(canvas);
        this.gl = null;
        this.program = null;
        this.canvas = canvas; // Ensure canvas property is set
        this.layerTextures = new Map(); // 各レイヤーに対応するテクスチャを保持
        this.framebuffer = null; // レイヤー合成用フレームバッファ
        this.currentActiveLayer = null; // updateTextureで利用するため、現在の描画対象レイヤーを追跡

        this._initGL();
        this._compileShaders();
        this._initBuffers();
        this._setupTextureRendering();

        // 描画モードの初期設定 (ストレートアルファに統一)
        this.gl.clearColor(0.0, 0.0, 0.0, 0.0); // 透明な黒でクリア
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA); // ★修正: ストレートアルファ
    }

    static isSupported() {
        try {
            const canvas = document.createElement('canvas');
            return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
        } catch (e) {
            return false;
        }
    }

    _initGL() {
        this.gl = this.canvas.getContext('webgl', { alpha: true });
        if (!this.gl) {
            throw new Error('WebGL not supported or context lost.');
        }
    }

    _compileShaders() {
        const gl = this.gl;
        const vertexShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vertexShader, vertexShaderSource);
        gl.compileShader(vertexShader);
        if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
            console.error('Vertex shader compilation failed:', gl.getShaderInfoLog(vertexShader));
            throw new Error('Vertex shader compilation failed.');
        }

        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragmentShader, fragmentShaderSource);
        gl.compileShader(fragmentShader);
        if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
            console.error('Fragment shader compilation failed:', gl.getShaderInfoLog(fragmentShader));
            throw new Error('Fragment shader compilation failed.');
        }

        this.program = gl.createProgram();
        gl.attachShader(this.program, vertexShader);
        gl.attachShader(this.program, fragmentShader);
        gl.linkProgram(this.program);
        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
            console.error('Shader program linking failed:', gl.getProgramInfoLog(this.program));
            throw new Error('Shader program linking failed.');
        }

        gl.useProgram(this.program);
        this.locations = {
            position: gl.getAttribLocation(this.program, 'a_position'),
            texCoord: gl.getAttribLocation(this.program, 'a_texCoord'),
            texture: gl.getUniformLocation(this.program, 'u_texture'),
            opacity: gl.getUniformLocation(this.program, 'u_opacity')
        };
    }

    _initBuffers() {
        const gl = this.gl;

        // Quad for drawing textures
        const positions = [
            -1, -1, // bottom-left
             1, -1, // bottom-right
            -1,  1, // top-left
            -1,  1, // top-left
             1, -1, // bottom-right
             1,  1  // top-right
        ];
        this.positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

        const texCoords = [
            0, 1, // bottom-left
            1, 1, // bottom-right
            0, 0, // top-left
            0, 0, // top-left
            1, 1, // bottom-right
            1, 0  // top-right
        ];
        this.texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);

        // Framebuffer for offscreen rendering (layer compositing)
        this.framebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);

        this.compositeTexture = gl.createTexture();
        this._setupTexture(this.compositeTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.canvas.width, this.canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.compositeTexture, 0);

        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    _setupTextureRendering() {
        const gl = this.gl;
        gl.vertexAttribPointer(this.locations.position, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.locations.position);
        gl.vertexAttribPointer(this.locations.texCoord, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.locations.texCoord);
    }

    _setupTexture(texture) {
        const gl = this.gl;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
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
            // TODO: ブレンドモードに応じた処理を追加
            // ★修正: ストレートアルファ
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

        this._bindVertexBuffers(); // Ensure buffers are bound before drawing

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    // imageDataに直接描画するメソッド群 (Canvas2Dライクな描画をエミュレート)
    // WebGLでは、ImageDataをテクスチャとして扱い、GPUで描画を行う
    // 現時点では、imageDataをCPU側で操作し、その結果をテクスチャにアップロードする方式
    drawCircle(imageData, centerX, centerY, radius, color, isEraser) {
        // CPU側でImageDataを操作して描画
        // ★修正: colorがhexToRgbaで変換されたオブジェクトか、直接RGBA値を持つかを確認
        const rgbaColor = typeof color === 'string' ? hexToRgba(color) : color;

        const r = rgbaColor.r;
        const g = rgbaColor.g;
        const b = rgbaColor.b;
        const a = rgbaColor.a;

        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;

        // 簡単な円描画の例 (アンチエイリアシングなし)
        const radiusSq = radius * radius;
        for (let y = Math.max(0, Math.floor(centerY - radius)); y <= Math.min(height - 1, Math.ceil(centerY + radius)); y++) {
            for (let x = Math.max(0, Math.floor(centerX - radius)); x <= Math.min(width - 1, Math.ceil(centerX + radius)); x++) {
                const distSq = (x - centerX) * (x - centerX) + (y - centerY) * (y - centerY);
                if (distSq <= radiusSq) {
                    const i = (y * width + x) * 4;
                    if (isEraser) {
                        data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 0; // 透明
                    } else {
                        data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = a;
                    }
                }
            }
        }
        // 変更されたImageDataを対応するテクスチャにアップロード
        this.updateTexture(imageData, 0, 0, width, height);
    }

    drawLine(imageData, x0, y0, x1, y1, size, color, isEraser, p0, p1, calculatePressureSize) {
        // CPU側でImageDataを操作して描画
        // ★修正: colorがhexToRgbaで変換されたオブジェクトか、直接RGBA値を持つかを確認
        const rgbaColor = typeof color === 'string' ? hexToRgba(color) : color;

        const r = rgbaColor.r;
        const g = rgbaColor.g;
        const b = rgbaColor.b;
        const a = rgbaColor.a;

        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;

        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = (x0 < x1) ? 1 : -1;
        const sy = (y0 < y1) ? 1 : -1;
        let err = dx - dy;

        let currentX = x0;
        let currentY = y0;

        const drawPixel = (px, py, currentSize) => {
            const pixelRadius = currentSize / 2;
            const pixelRadiusSq = pixelRadius * pixelRadius;

            for (let y = Math.max(0, Math.floor(py - pixelRadius)); y <= Math.min(height - 1, Math.ceil(py + pixelRadius)); y++) {
                for (let x = Math.max(0, Math.floor(px - pixelRadius)); x <= Math.min(width - 1, Math.ceil(px + pixelRadius)); x++) {
                    const distSq = (x - px) * (x - px) + (y - py) * (y - py);
                    if (distSq <= pixelRadiusSq) {
                        const i = (y * width + x) * 4;
                        if (isEraser) {
                            data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 0; // 透明
                        } else {
                            data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = a;
                        }
                    }
                }
            }
        };

        while (true) {
            const t = (Math.sqrt(Math.pow(currentX - x0, 2) + Math.pow(currentY - y0, 2))) / (Math.sqrt(Math.pow(x1 - x0, 2) + Math.pow(y1 - y0, 2)));
            const currentPressure = p0 + (p1 - p0) * t;
            const currentSize = calculatePressureSize(size, currentPressure);
            drawPixel(currentX, currentY, currentSize);

            if (currentX === x1 && currentY === y1) break;
            const e2 = 2 * err;
            if (e2 > -dy) { err -= dy; currentX += sx; }
            if (e2 < dx) { err += dx; currentY += sy; }
        }
        // 変更されたImageDataを対応するテクスチャにアップロード
        this.updateTexture(imageData, 0, 0, width, height);
    }

    fill(imageData, color) {
        // このメソッドはバケツツール用。CanvasManagerのbucketTool.fillが直接ImageDataを操作しているため、
        // WebGLEngine側では特に描画処理は不要。ImageDataが変更されたらテクスチャを更新するのみ。
        const gl = this.gl;
        // ★修正: currentActiveLayerが設定されていることを確認
        if (!this.currentActiveLayer) {
            console.warn("WebGL fill: currentActiveLayer is not set. Cannot update texture.");
            return;
        }
        gl.bindTexture(gl.TEXTURE_2D, this.layerTextures.get(this.currentActiveLayer)); // activeLayerのテクスチャをバインド
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageData);
    }

    clear(imageData) {
        // imageDataの内容をクリア
        imageData.data.fill(0);
        // テクスチャを更新
        this.updateTexture(imageData, 0, 0, imageData.width, imageData.height);
    }

    // ImageDataをWebGLテクスチャに更新するヘルパー
    updateTexture(imageData, x, y, width, height) {
        const gl = this.gl;
        // ★修正: currentActiveLayerが設定されていることを確認
        if (!this.currentActiveLayer) {
            console.warn("WebGL updateTexture: currentActiveLayer is not set. Cannot update texture.");
            return;
        }
        let texture = this.layerTextures.get(this.currentActiveLayer); // 現在アクティブなレイヤーのテクスチャを取得
        if (!texture) {
            texture = gl.createTexture();
            this._setupTexture(texture);
            this.layerTextures.set(this.currentActiveLayer, texture);
        }
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, width, height, gl.RGBA, gl.UNSIGNED_BYTE, imageData.data);
    }

    getTransformedImageData(sourceImageData, transform) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = sourceImageData.width;
        tempCanvas.height = sourceImageData.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        tempCtx.putImageData(sourceImageData, 0, 0);

        const transformedCanvas = document.createElement('canvas');
        transformedCanvas.width = sourceImageData.width;
        transformedCanvas.height = sourceImageData.height;
        const transformedCtx = transformedCanvas.getContext('2d');

        transformedCtx.translate(transformedCanvas.width / 2, transformedCanvas.height / 2);
        transformedCtx.rotate(transform.rotation * Math.PI / 180);
        transformedCtx.scale(transform.scale * transform.flipX, transform.scale * transform.flipY);
        transformedCtx.translate(-transformedCanvas.width / 2 + transform.x, -transformedCanvas.height / 2 + transform.y);

        transformedCtx.drawImage(tempCanvas, 0, 0);
        
        return transformedCtx.getImageData(0, 0, transformedCanvas.width, transformedCanvas.height);
    }

    compositeLayers(layers, compositionData, dirtyRect) {
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer); // フレームバッファに描画
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);

        // フレームバッファをクリア (透明な黒)
        gl.clearColor(0.0, 0.0, 0.0, 0.0); // レイヤー合成時のクリアカラー
        gl.clear(gl.COLOR_BUFFER_BIT);

        // 各レイヤーを合成
        layers.forEach(layer => {
            if (layer.visible) {
                // ★追加: 現在描画しているレイヤーを追跡 (updateTextureで使用)
                this.currentActiveLayer = layer; 
                this._drawLayer(layer); // ここで各レイヤーのテクスチャを描画
            }
        });

        // フレームバッファの内容をcompositionDataに読み戻す
        // TODO: dirtyRectを考慮した読み込みに修正
        gl.readPixels(0, 0, this.canvas.width, this.canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, compositionData.data);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null); // デフォルトフレームバッファに戻す
    }

    renderToDisplay(compositionData, dirtyRect) {
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, null); // デフォルトのキャンバスに描画

        // 表示用のクリアカラー（最終的なキャンバスの背景色）
        gl.clearColor(0.0, 0.0, 0.0, 0.0); // 背景を透明にクリア
        gl.clear(gl.COLOR_BUFFER_BIT);

        // compositionDataをテクスチャに変換して描画
        if (!this.finalTexture) {
            this.finalTexture = gl.createTexture();
            this._setupTexture(this.finalTexture);
        }
        gl.bindTexture(gl.TEXTURE_2D, this.finalTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, compositionData);
        
        // 最終表示時のブレンド設定 (ストレートアルファに統一)
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); // ★修正: ストレートアルファ

        this._drawTexture(this.finalTexture, 1.0); // 合成結果を不透明度1.0で描画
    }
}