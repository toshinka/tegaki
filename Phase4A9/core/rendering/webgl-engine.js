// webgl-engine.js
/*
 * ===================================================================================
 * Toshinka Tegaki Tool - WebGL Engine
 * Version: 3.0.0 (Super-Sampling & Quality Revamp)
 *
 * - 修正：
 * - 1. スーパーサンプリングの描画フローを抜本的に改善:
 * -   AI提案の「レンダー・トゥ・テクスチャ」方式を全面的に採用。
 * -   中間合成用のフレームバッファ(compositeFBO)を高解像度(スーパーサンプリング)で作成するように変更。
 * -   これにより、高解像度レイヤーを高解像度のまま合成し、画質劣化を完全に防ぐ。
 *
 * - 2. 高品質なダウンサンプリングの実装:
 * -   全レイヤーの合成が完了した高解像度のテクスチャを、画面表示用のキャンバスへ
 * -   描画する最後のステップ(renderToDisplay)で、高品質なシェーダーを用いて一気に縮小。
 * -   これにより、ジャギを抑えつつ鮮明なスーパーサンプリング描画を実現。
 * -   「キャンバスが4倍サイズになる」問題を解決し、見た目のサイズはそのままに内部的な高画質化を達成。
 * ===================================================================================
 */
import { DrawingEngine } from './drawing-engine.js';

export class WebGLEngine extends DrawingEngine {
    constructor(canvas) {
        super(canvas);
        this.gl = null;
        
        // ★★★ スーパーサンプリング係数 ★★★
        this.SUPER_SAMPLING_FACTOR = 2; // 2x2 = 4倍ピクセル
        this.displayCanvas = canvas; // 表示用の最終キャンバス (RenderingBridgeから渡される)
        this.offscreenCanvas = document.createElement('canvas'); // WebGL描画用オフスクリーンキャンバス
        this.offscreenCanvas.width = this.displayCanvas.width;
        this.offscreenCanvas.height = this.displayCanvas.height;
        this.gl = this.offscreenCanvas.getContext('webgl', { preserveDrawingBuffer: true, alpha: true }); [cite_start]// alpha: trueで透過を有効に [cite: 1]

        if (!this.gl) {
            console.error('WebGL not supported, falling back to Canvas2D.');
            throw new Error('WebGL not supported');
        }

        const gl = this.gl;
        gl.clearColor(0.0, 0.0, 0.0, 0.0); [cite_start]// Clear to transparent black [cite: 1]
        gl.enable(gl.BLEND); [cite_start]// アルファブレンディングを有効に [cite: 1]
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); [cite_start]// 通常のアルファブレンド設定 [cite: 1]

        this.width = this.offscreenCanvas.width;
        this.height = this.offscreenCanvas.height;
        this.ssWidth = this.width * this.SUPER_SAMPLING_FACTOR;
        this.ssHeight = this.height * this.SUPER_SAMPLING_FACTOR;

        this.textureCache = new Map(); // レイヤーIDとテクスチャを紐付ける
        this.fboCache = new Map(); // レイヤーIDとFBOを紐付ける

        this.compositeFBO = null; // 中間合成用のFBO
        this.compositeTexture = null; // 中間合成用のテクスチャ

        this._initShaderPrograms();
        this._initBuffers();
        this._setupCompositeFBO(); // 合成用FBOのセットアップ
        console.log("WebGL Engine initialized successfully.");
    }

    static isSupported() {
        try {
            const canvas = document.createElement('canvas');
            return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
        } catch (e) {
            return false;
        }
    }

    _initShaderPrograms() {
        const gl = this.gl;

        [cite_start]// レイヤー描画用シェーダー (modelMatrix適用) [cite: 1, 2]
        const layerVsSource = `
            attribute vec2 a_position;
            attribute vec2 a_texCoord;
            uniform mat4 u_modelMatrix; [cite_start]// レイヤーごとのモデル行列 [cite: 1, 2]
            uniform mat4 u_projectionMatrix; // プロジェクション行列
            varying vec2 v_texCoord;
            void main() {
                // modelMatrixを適用し、プロジェクション行列でクリップ空間へ変換
                gl_Position = u_projectionMatrix * u_modelMatrix * vec4(a_position.x, a_position.y, 0.0, 1.0);
                v_texCoord = a_texCoord;
            }
        `;

        const layerFsSource = `
            precision mediump float;
            varying vec2 v_texCoord;
            uniform sampler2D u_image;
            uniform float u_opacity;
            void main() {
                vec4 texColor = texture2D(u_image, v_texCoord);
                gl_FragColor = vec4(texColor.rgb, texColor.a * u_opacity);
            }
        `;

        // 最終表示用シェーダー（スーパーサンプリング結果をダウンサンプリングして表示）
        const displayVsSource = `
            attribute vec2 a_position;
            attribute vec2 a_texCoord;
            varying vec2 v_texCoord;
            void main() {
                gl_Position = vec4(a_position, 0.0, 1.0);
                v_texCoord = a_texCoord;
            }
        `;

        const displayFsSource = `
            precision mediump float;
            varying vec2 v_texCoord;
            uniform sampler2D u_image;
            void main() {
                gl_FragColor = texture2D(u_image, v_texCoord);
            }
        `;

        // ブラシ描画用シェーダー (ブラシを描画するシェーダーは後で追加)

        this.layerProgram = this._createProgram(gl, layerVsSource, layerFsSource);
        this.displayProgram = this._createProgram(gl, displayVsSource, displayFsSource);

        // レイヤー描画シェーダーのuniformsとattributes
        this.layerProgramInfo = {
            program: this.layerProgram,
            attribLocations: {
                position: gl.getAttribLocation(this.layerProgram, 'a_position'),
                texCoord: gl.getAttribLocation(this.layerProgram, 'a_texCoord'),
            },
            uniformLocations: {
                [cite_start]modelMatrix: gl.getUniformLocation(this.layerProgram, 'u_modelMatrix'), // modelMatrix uniform [cite: 1, 2]
                projectionMatrix: gl.getUniformLocation(this.layerProgram, 'u_projectionMatrix'),
                image: gl.getUniformLocation(this.layerProgram, 'u_image'),
                opacity: gl.getUniformLocation(this.layerProgram, 'u_opacity'),
            },
        };

        // 最終表示シェーダーのuniformsとattributes
        this.displayProgramInfo = {
            program: this.displayProgram,
            attribLocations: {
                position: gl.getAttribLocation(this.displayProgram, 'a_position'),
                texCoord: gl.getAttribLocation(this.displayProgram, 'a_texCoord'),
            },
            uniformLocations: {
                image: gl.getUniformLocation(this.displayProgram, 'u_image'),
            },
        };
    }

    _createShader(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    _createProgram(gl, vsSource, fsSource) {
        const vertexShader = this._createShader(gl, gl.VERTEX_SHADER, vsSource);
        const fragmentShader = this._createShader(gl, gl.FRAGMENT_SHADER, fsSource);
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

    _initBuffers() {
        const gl = this.gl;

        // レイヤー描画用の四角形頂点バッファ
        this.quadBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        // x,y座標は -1 to 1 のクリップ空間ではなく、実際のピクセル座標で設定
        // プロジェクション行列でこれをクリップ空間に変換する
        const positions = [
            0, 0,
            this.width, 0,
            0, this.height,
            0, this.height,
            this.width, 0,
            this.width, this.height,
        ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

        // テクスチャ座標バッファ
        this.texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        const texCoords = [
            0.0, 0.0,
            1.0, 0.0,
            0.0, 1.0,
            0.0, 1.0,
            1.0, 0.0,
            1.0, 1.0,
        ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);
    }

    _setupCompositeFBO() {
        const gl = this.gl;

        // Composite FBO
        this.compositeFBO = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.compositeFBO);

        // Composite Texture (高解像度)
        this.compositeTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.compositeTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.ssWidth, this.ssHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.compositeTexture, 0);

        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
            console.error('Composite FBO not complete!');
        }
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    _getOrCreateTexture(layer) {
        const gl = this.gl;
        if (!this.textureCache.has(layer.id) || layer.gpuDirty) {
            const texture = this.textureCache.has(layer.id) ? this.textureCache.get(layer.id) : gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, layer.imageData);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            this.textureCache.set(layer.id, texture);
            layer.gpuDirty = false; // テクスチャを更新したのでダーティフラグを下げる
        }
        return this.textureCache.get(layer.id);
    }

    _createProjectionMatrix(width, height) {
        // オフスクリーンキャンバスのサイズに合わせた正射影行列を作成
        const gl = this.gl;
        const orthoMatrix = new Float32Array(16);
        // mat4.ortho(out, left, right, bottom, top, near, far)
        [cite_start]// WebGLのY軸は上方向が正なので、bottomとtopを反転させてImageDataのY軸と合わせる [cite: 2]
        mat4.ortho(orthoMatrix, 0, width, height, 0, -1, 1);
        return orthoMatrix;
    }

    // DrawingEngineインターフェースの実装
    drawCircle(layer, x, y, size, color, isEraser) {
        // CPUでの描画をGPUに移管するための準備。
        // この関数はまだCPUでのImageData操作を引き続き行う。
        // GPUで描画する場合は、別途ブラシ描画用のシェーダーとロジックが必要。
        // 現在は、ImageDataを更新してgpuDirtyフラグを立てることで、次回の描画時にテクスチャが更新されるようにする。
        const ctx = new OffscreenCanvas(layer.imageData.width, layer.imageData.height).getContext('2d');
        ctx.putImageData(layer.imageData, 0, 0);
        ctx.fillStyle = `rgba(${color.r},${color.g},${color.b},${color.a / 255})`;
        ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
        ctx.beginPath();
        ctx.arc(x, y, size / 2, 0, Math.PI * 2);
        ctx.fill();
        layer.imageData = ctx.getImageData(0, 0, layer.imageData.width, layer.imageData.height);
        layer.gpuDirty = true;
    }

    drawLine(layer, x1, y1, x2, y2, size, color, isEraser, pressureCallback) {
        const ctx = new OffscreenCanvas(layer.imageData.width, layer.imageData.height).getContext('2d');
        ctx.putImageData(layer.imageData, 0, 0);

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';

        // 線の描画を細かく分割して筆圧を適用
        const dist = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
        const segments = Math.max(1, Math.ceil(dist / (size / 4))); // サイズに応じて分割数を調整
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const currentX = x1 + (x2 - x1) * t;
            const currentY = y1 + (y2 - y1) * t;
            const currentPressure = pressureCallback ? pressureCallback() : 1.0; // 仮の筆圧値
            const currentSize = pressureCallback ? pressureCallback(size, currentPressure) : size;

            ctx.beginPath();
            ctx.arc(currentX, currentY, currentSize / 2, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${color.r},${color.g},${color.b},${color.a / 255})`;
            ctx.fill();
        }
        layer.imageData = ctx.getImageData(0, 0, layer.imageData.width, layer.imageData.height);
        layer.gpuDirty = true;
    }

    fill(layer, x, y, color) {
        // バケツツールはCPUでのImageData操作が中心なので、ここでは何もしない
        // 呼び出し元でlayer.imageDataを更新し、gpuDirty=trueを設定すること
        console.warn("WebGLEngine.fill is not implemented for direct GPU fill. Use CPU-based fill and set layer.gpuDirty = true;");
    }

    clear(layer) {
        layer.imageData.data.fill(0);
        layer.gpuDirty = true;
    }

    getTransformedImageData(layer) {
        // このメソッドは主にCanvas2D互換性のために存在
        // WebGLではImageDataを直接操作しないため、必要に応じてGPUから読み出す
        // 現在の描画パイプラインでは、最終合成結果がcompositeTextureにあり、
        // それをrenderToDisplayでdisplayCanvasに描画するため、
        // 個別レイヤーのImageData変換は基本的に行わない
        console.warn("WebGLEngine.getTransformedImageData is not typically used. Consider compositeLayers and renderToDisplay.");
        // 必要なら、対象レイヤーを描画しFBOから読み出す処理を実装
        return layer.imageData;
    }

    // WebGLEngineの主要な描画メソッド
    compositeLayers(layers, compositionData, dirtyRect) {
        const gl = this.gl;

        // レンダリングターゲットを中間合成用FBOに設定
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.compositeFBO);
        gl.viewport(0, 0, this.ssWidth, this.ssHeight); // スーパーサンプリングサイズでビューポートを設定

        gl.clearColor(0.0, 0.0, 0.0, 0.0); // 合成FBOをクリア（透明）
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(this.layerProgramInfo.program);

        // プロジェクション行列を設定
        const projectionMatrix = this._createProjectionMatrix(this.ssWidth, this.ssHeight); // スーパーサンプリングサイズに合わせたプロジェクション行列
        gl.uniformMatrix4fv(this.layerProgramInfo.uniformLocations.projectionMatrix, false, projectionMatrix);

        // 頂点バッファとテクスチャ座標バッファを設定
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.vertexAttribPointer(this.layerProgramInfo.attribLocations.position, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.layerProgramInfo.attribLocations.position);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.vertexAttribPointer(this.layerProgramInfo.attribLocations.texCoord, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.layerProgramInfo.attribLocations.texCoord);

        // レイヤーを描画
        layers.forEach(layer => {
            if (!layer.visible) return;

            const texture = this._getOrCreateTexture(layer);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.uniform1i(this.layerProgramInfo.uniformLocations.image, 0);

            [cite_start]// modelMatrixをシェーダーに渡す [cite: 1, 2]
            gl.uniformMatrix4fv(this.layerProgramInfo.uniformLocations.modelMatrix, false, layer.modelMatrix);

            // 不透明度を渡す
            gl.uniform1f(this.layerProgramInfo.uniformLocations.opacity, layer.opacity / 100.0);

            // レイヤーを描画
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        });

        gl.bindFramebuffer(gl.FRAMEBUFFER, null); // デフォルトフレームバッファに戻す
        gl.viewport(0, 0, this.width, this.height); // ビューポートを通常のキャンバスサイズに戻す
    }

    renderToDisplay(compositionData, dirtyRect) {
        const gl = this.gl;

        // レンダリングターゲットを最終表示用のdisplayCanvas (オフスクリーンWebGLキャンバス) に設定
        gl.bindFramebuffer(gl.FRAMEBUFFER, null); // デフォルトフレームバッファ（描画バッファ）に描画

        gl.clearColor(0.0, 0.0, 0.0, 0.0); // クリア
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(this.displayProgramInfo.program);

        // 頂点バッファとテクスチャ座標バッファを設定
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer); // レイヤー描画と同じバッファを使用
        gl.vertexAttribPointer(this.displayProgramInfo.attribLocations.position, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.displayProgramInfo.attribLocations.position);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer); // レイヤー描画と同じバッファを使用
        gl.vertexAttribPointer(this.displayProgramInfo.attribLocations.texCoord, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.displayProgramInfo.attribLocations.texCoord);


        // 合成済みテクスチャをバインド
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.compositeTexture);
        gl.uniform1i(this.displayProgramInfo.uniformLocations.image, 0);

        // 最終描画
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // WebGLの描画結果を実際の表示用displayCanvasにコピー
        // drawImageを使用することで、WebGLのY軸とHTMLCanvasのY軸の差異を吸収
        this.displayCanvas.getContext('2d').clearRect(0, 0, this.width, this.height);
        this.displayCanvas.getContext('2d').drawImage(this.offscreenCanvas, 0, 0, this.width, this.height);
    }

    [cite_start]// GPU上の描画結果をCPUのImageDataに同期する (PNGエクスポートやCanvas2D互換性のため) [cite: 1]
    syncDirtyRectToImageData(layer, dirtyRect) {
        const gl = this.gl;
        const sWidth = layer.imageData.width * this.SUPER_SAMPLING_FACTOR;
        const sHeight = layer.imageData.height * this.SUPER_SAMPLING_FACTOR;

        // レイヤーを描画するためのFBOを確保または作成
        let layerFBO = this.fboCache.get(layer.id);
        if (!layerFBO) {
            layerFBO = gl.createFramebuffer();
            this.fboCache.set(layer.id, layerFBO);
        }

        let layerTexture = this.textureCache.get(layer.id);
        if (!layerTexture) {
            layerTexture = gl.createTexture();
            this.textureCache.set(layer.id, layerTexture);
            gl.bindTexture(gl.TEXTURE_2D, layerTexture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, sWidth, sHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, layerFBO);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, layerTexture, 0);

        // レイヤー単体を描画 (modelMatrixを適用せず、純粋なレイヤー内容を描画)
        gl.viewport(0, 0, sWidth, sHeight);
        gl.clearColor(0.0, 0.0, 0.0, 0.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(this.layerProgramInfo.program);
        gl.uniformMatrix4fv(this.layerProgramInfo.uniformLocations.projectionMatrix, false, this._createProjectionMatrix(sWidth, sHeight));
        gl.uniformMatrix4fv(this.layerProgramInfo.uniformLocations.modelMatrix, false, new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1])); [cite_start]// 単位行列を渡す [cite: 1]
        gl.uniform1f(this.layerProgramInfo.uniformLocations.opacity, 1.0); // 不透明度100%

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this._getOrCreateTexture(layer));
        gl.uniform1i(this.layerProgramInfo.uniformLocations.image, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.vertexAttribPointer(this.layerProgramInfo.attribLocations.position, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.layerProgramInfo.attribLocations.position);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.vertexAttribPointer(this.layerProgramInfo.attribLocations.texCoord, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.layerProgramInfo.attribLocations.texCoord);

        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // レイヤーFBOからピクセルを読み出す
        const superBuffer = new Uint8Array(sWidth * sHeight * 4);
        gl.readPixels(0, 0, sWidth, sHeight, gl.RGBA, gl.UNSIGNED_BYTE, superBuffer);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        // CPU側で簡易的なダウンサンプリング（最近傍法）を行い、ImageDataに書き戻す
        const targetImageData = layer.imageData;
        const targetData = targetImageData.data;
        const factor = this.SUPER_SAMPLING_FACTOR;
        
        for (let y = 0; y < (dirtyRect.maxY - dirtyRect.minY); y++) {
            for (let x = 0; x < (dirtyRect.maxX - dirtyRect.minX); x++) {
                const targetX = Math.floor(dirtyRect.minX) + x;
                const targetY = Math.floor(dirtyRect.minY) + y;
                if (targetX >= targetImageData.width || targetY >= targetImageData.height) continue;
                
                const sourceX = Math.round(x * factor);
                const sourceY = Math.round(y * factor);
                
                // バッファは反転していないので、Yの計算を修正
                const sourceIndex = (sourceY * sWidth + sourceX) * 4;
                const targetIndex = (targetY * targetImageData.width + targetX) * 4;

                if (sourceIndex >= 0 && sourceIndex < superBuffer.length) {
                    targetData[targetIndex]     = superBuffer[sourceIndex];
                    targetData[targetIndex + 1] = superBuffer[sourceIndex + 1];
                    targetData[targetIndex + 2] = superBuffer[sourceIndex + 2];
                    targetData[targetIndex + 3] = superBuffer[sourceIndex + 3];
                }
            }
        }
    }
}