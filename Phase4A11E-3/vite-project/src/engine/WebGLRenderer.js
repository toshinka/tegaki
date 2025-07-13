// [モジュール責務] WebGLRenderer.js
// 目的：DrawingEngineの仕様に基づき、WebGL APIを使用して具体的な描画処理をすべて担当する。
// 主な役割は、シェーダープログラムの管理、頂点バッファやテクスチャの生成と操作、
// フレームバッファ（FBO）を用いたオフスクリーンレンダリング、そして最終的な画面への描画命令（draw call）の発行。
// アプリケーションの他モジュールから直接呼び出されることは想定せず、RenderingBridgeを介して利用される。

import { DrawingEngine } from './DrawingEngine.js';
import { mat4 } from 'gl-matrix';
import * as twgl from 'twgl.js';

export default class WebGLRenderer extends DrawingEngine {
    /**
     * [関数責務] constructor: WebGLエンジンを初期化する。
     * @param {WebGLRenderingContext} gl - WebGLレンダリングコンテキスト
     * @param {HTMLCanvasElement} canvas - 描画対象のcanvas要素
     */
    constructor(gl, canvas) {
        super(canvas);
        this.gl = gl;
        
        this.SUPER_SAMPLING_FACTOR = 2.0;

        this.width = canvas.width;
        this.height = canvas.height;
        this.superWidth = this.width * this.SUPER_SAMPLING_FACTOR;
        this.superHeight = this.height * this.SUPER_SAMPLING_FACTOR;
        
        this.projectionMatrix = null;
        this.programs = { compositor: null, brush: null };
        this.positionBuffer = null;
        this.texCoordBuffer = null;
        this.brushPositionBuffer = null;
        
        this.superCompositeTexture = null;
        this.superCompositeFBO = null;
        
        this.layerTextures = new Map();
        this.layerFBOs = new Map();
        
        this.identityMatrix = mat4.create();
        this.lineProgramInfo = null;

        gl.enable(gl.BLEND);
        gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        this._initProjectionMatrix();
        this._initShaderPrograms();
        if (!this.programs.compositor || !this.programs.brush) {
            console.error("シェーダープログラムの初期化に失敗したため、WebGLレンダラーのセットアップを中断します。");
            this.gl = null;
            return;
        }

        this._initBuffers();
        this._setupSuperCompositingBuffer();
        this._initLineDrawingResources();

        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.clearColor(0.0, 0.0, 0.0, 0.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        
        console.log(`✅ WebGLRenderer initialized with ${this.superWidth}x${this.superHeight} internal resolution.`);
    }

    /**
     * [関数責務] _initLineDrawingResources: デバッグ用の直線を描画するためのシェーダーとプログラム情報を初期化する。
     * @private
     */
    _initLineDrawingResources() {
        const gl = this.gl;
        const vs = `
            attribute vec2 a_position;
            uniform mat4 u_mvpMatrix;
            void main() { gl_Position = u_mvpMatrix * vec4(a_position, 0.0, 1.0); }`;
        const fs = `
            precision highp float;
            uniform vec4 u_color;
            void main() { gl_FragColor = u_color; }`;

        this.lineProgramInfo = twgl.createProgramInfo(gl, [vs, fs]);
        if (!this.lineProgramInfo) {
            console.error("❌ Failed to create program info for line drawing.");
        }
    }
    
    /**
     * [関数責務] drawTestLine: デバッグ目的で、指定された座標間に単一の直線を描画する。
     * @param {number} x0 - 開始X座標
     * @param {number} y0 - 開始Y座標
     * @param {number} x1 - 終了X座標
     * @param {number} y1 - 終了Y座標
     * @param {Array<number>} [color=[1, 1, 1, 1]] - RGBA形式の色配列
     */
    drawTestLine(x0, y0, x1, y1, color = [1, 1, 1, 1]) {
        // ✅ 指示書: ログを挿入
        console.log("➡️ WebGLRenderer.drawTestLine: 描画開始");
        if (!this.lineProgramInfo) return;
        const gl = this.gl;
        const sx0 = x0 * this.SUPER_SAMPLING_FACTOR;
        const sy0 = y0 * this.SUPER_SAMPLING_FACTOR;
        const sx1 = x1 * this.SUPER_SAMPLING_FACTOR;
        const sy1 = y1 * this.SUPER_SAMPLING_FACTOR;
        
        const arrays = { a_position: { numComponents: 2, data: [sx0, sy0, sx1, sy1] } };
        const bufferInfo = twgl.createBufferInfoFromArrays(gl, arrays);

        gl.useProgram(this.lineProgramInfo.program);
        const uniforms = { u_mvpMatrix: this.projectionMatrix, u_color: color };
        twgl.setUniforms(this.lineProgramInfo, uniforms);
        twgl.setBuffersAndAttributes(gl, this.lineProgramInfo, bufferInfo);
        twgl.drawBufferInfo(gl, bufferInfo, gl.LINES);
    }

    /**
     * [関数責務] _initProjectionMatrix: WebGLの座標系をピクセルベースに変換するための正射影行列を生成・初期化する。
     * @private
     */
    _initProjectionMatrix() {
        this.projectionMatrix = mat4.create();
        mat4.ortho(this.projectionMatrix, 0, this.superWidth, this.superHeight, 0, -1, 1);
    }

    /**
     * [関数責務] _initShaderPrograms: ブラシ描画とレイヤー合成に使用するWebGLシェーダープログラムをコンパイルし、準備する。
     * @private
     */
    _initShaderPrograms() {
        const vsCompositor = `
            attribute vec2 a_position; attribute vec2 a_texCoord;
            uniform mat4 u_mvpMatrix; varying vec2 v_texCoord;
            void main() { gl_Position = u_mvpMatrix * vec4(a_position, 0.0, 1.0); v_texCoord = a_texCoord; }`;
        const fsCompositor = `
            precision highp float; varying vec2 v_texCoord;
            uniform sampler2D u_image; uniform float u_opacity;
            void main() { vec4 color = texture2D(u_image, v_texCoord); gl_FragColor = vec4(color.rgb, color.a * u_opacity); }`;
        const vsBrush = `
            precision highp float; attribute vec2 a_position;
            uniform mat4 u_mvpMatrix; varying vec2 v_texCoord;
            void main() { gl_Position = u_mvpMatrix * vec4(a_position, 0.0, 1.0); v_texCoord = a_position + 0.5; }`;
        const fsBrush = `
            precision highp float; varying vec2 v_texCoord;
            uniform float u_radius; uniform vec4 u_color; uniform bool u_is_eraser;
            void main() {
                float dist = distance(v_texCoord, vec2(0.5));
                float pixel_in_uv = 1.0 / (max(u_radius, 0.5) * 2.0);
                float alpha = 1.0 - smoothstep(0.5 - pixel_in_uv, 0.5, dist);
                if (alpha < 0.01) discard;
                if (u_is_eraser) gl_FragColor = vec4(0.0, 0.0, 0.0, alpha); 
                else gl_FragColor = vec4(u_color.rgb * u_color.a * alpha, u_color.a * alpha);
            }`;
        
        this.programs.compositor = twgl.createProgramInfo(this.gl, [vsCompositor, fsCompositor]);
        this.programs.brush = twgl.createProgramInfo(this.gl, [vsBrush, fsBrush]);
    }
    
    /**
     * [関数責務] _initBuffers: 描画で使用する基本的な形状（全面矩形など）の頂点バッファを生成し、VRAMにアップロードする。
     * @private
     */
    _initBuffers() {
        const gl = this.gl;
        const positions = [0, 0, 0, this.superHeight, this.superWidth, 0, this.superWidth, this.superHeight];
        const texCoords = [0.0, 1.0, 0.0, 0.0, 1.0, 1.0, 1.0, 0.0];
        const brushPositions = [ -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5, -0.5 ];

        this.positionBuffer = twgl.createBufferInfoFromArrays(gl, { a_position: { numComponents: 2, data: positions } });
        this.texCoordBuffer = twgl.createBufferInfoFromArrays(gl, { a_texCoord: { numComponents: 2, data: texCoords } });
        this.brushPositionBuffer = twgl.createBufferInfoFromArrays(gl, { a_position: { numComponents: 2, data: brushPositions } });
    }

    /**
     * [関数責務] isSupported: WebGLが現在のブラウザで利用可能か静的にチェックする。
     * @returns {boolean} WebGLがサポートされていればtrueを返す。
     */
    static isSupported() { try { const canvas = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))); } catch (e) { return false; } }

    /**
     * [関数責務] _createOrUpdateLayerTexture: 各レイヤーに対応するWebGLテクスチャとフレームバッファ（FBO）を生成・管理する。
     * レイヤーの画像データ（ImageData）が更新されている場合（gpuDirty=true）、その内容をGPU上のテクスチャにアップロードする。
     * @private
     * @param {object} layer - 対象となるレイヤーオブジェクト
     */
    _createOrUpdateLayerTexture(layer) {
        const gl = this.gl;
        if (!this.layerFBOs.has(layer)) {
            const attachments = [{ format: gl.RGBA, type: gl.UNSIGNED_BYTE, min: gl.NEAREST, mag: gl.NEAREST, wrap: gl.CLAMP_TO_EDGE }];
            const fbo = twgl.createFramebufferInfo(gl, attachments, this.superWidth, this.superHeight);
            this.layerFBOs.set(layer, fbo);
            this.layerTextures.set(layer, fbo.attachments[0]);
        }

        const sourceImageData = layer.transformStage || layer.imageData;
        if (layer.gpuDirty && sourceImageData) {
            const texture = this.layerTextures.get(layer);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
            // 【修正】存在しない twgl.setTextureFromImageData を、正しい gl.texSubImage2D に変更
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, sourceImageData);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
            gl.bindTexture(gl.TEXTURE_2D, null);
            layer.gpuDirty = false;
        }
    }
    
    /**
     * [関数責務] _setupSuperCompositingBuffer: 全レイヤーを合成するための中間バッファ（スーパーサンプリング用のFBOとテクスチャ）をセットアップする。
     * @private
     */
    _setupSuperCompositingBuffer() {
        const gl = this.gl;
        const attachments = [{ format: gl.RGBA, min: gl.NEAREST, mag: gl.NEAREST, wrap: gl.CLAMP_TO_EDGE }];
        const fbo = twgl.createFramebufferInfo(gl, attachments, this.superWidth, this.superHeight);
        this.superCompositeFBO = fbo;
        this.superCompositeTexture = fbo.attachments[0];
    }
    
    /**
     * [関数責務] _setBlendMode: レイヤーのブレンドモードや消しゴムの状態に応じて、WebGLのブレンド関数（合成方法）を設定する。
     * @private
     * @param {string} blendMode - 'normal', 'multiply' などのブレンドモード名
     * @param {boolean} [isEraser=false] - 消しゴムモードかどうか
     */
    _setBlendMode(blendMode, isEraser = false) {
        const gl = this.gl;
        if (isEraser) {
            gl.blendEquation(gl.FUNC_ADD);
            gl.blendFuncSeparate(gl.ZERO, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE_MINUS_SRC_ALPHA);
        } else {
            gl.blendEquation(gl.FUNC_ADD);
            switch (blendMode) {
                case 'multiply': gl.blendFuncSeparate(gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA); break;
                case 'screen': gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_COLOR, gl.ONE, gl.ONE_MINUS_SRC_ALPHA); break;
                case 'add': gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ONE, gl.ONE); break;
                default: gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA); break;
            }
        }
    }

    /**
     * [関数責務] drawCircle: 座標・サイズ・色からGPUで円を描画する命令を出す。
     * @param {number} centerX - 描画中心X座標
     * @param {number} centerY - 描画中心Y座標
     * @param {number} radius - 半径
     * @param {object} color - RGBA構造を持つ色オブジェクト
     * @param {boolean} isEraser - 消しゴムとして動作するかどうか
     * @param {object} layer - 描画対象のレイヤー
     */
    drawCircle(centerX, centerY, radius, color, isEraser, layer) {
        if (!this.gl) return;
        const gl = this.gl;
        
        this._createOrUpdateLayerTexture(layer);
        const targetFBO = this.layerFBOs.get(layer);
        if (!targetFBO) {
            console.error("❌ WebGLRenderer.drawCircle: 描画対象のFBOが見つかりません。", layer);
            return;
        }

        // ✅ 描画経路の可視化
        console.log(`➡️ WebGLRenderer.drawCircle: 実行中 (x:${centerX.toFixed(1)}, y:${centerY.toFixed(1)}, r:${radius.toFixed(1)}, isEraser:${isEraser})`);

        twgl.bindFramebufferInfo(gl, targetFBO);
        gl.useProgram(this.programs.brush.program);
        this._setBlendMode('normal', isEraser);

        const modelMatrix = mat4.create();
        mat4.translate(modelMatrix, modelMatrix, [centerX, centerY, 0]);
        mat4.scale(modelMatrix, modelMatrix, [radius * 2, radius * 2, 1]);
        
        const mvpMatrix = mat4.create();
        mat4.multiply(mvpMatrix, this.projectionMatrix, modelMatrix);

        twgl.setBuffersAndAttributes(gl, this.programs.brush, this.brushPositionBuffer);
        twgl.setUniforms(this.programs.brush, {
            u_mvpMatrix: mvpMatrix,
            u_radius: radius,
            u_color: [color.r / 255, color.g / 255, color.b / 255, color.a / 255],
            u_is_eraser: isEraser,
        });
        twgl.drawBufferInfo(gl, this.brushPositionBuffer, gl.TRIANGLE_STRIP);
        twgl.bindFramebufferInfo(gl, null);
    }
    
    /**
     * [関数責務] drawLine: 2点間の直線を、細かい円（drawCircle）の連続で描画（補間）する。
     * @param {number} x0 - 開始点のX座標
     * @param {number} y0 - 開始点のY座標
     * @param {number} x1 - 終了点のX座標
     * @param {number} y1 - 終了点のY座標
     * @param {number} size - ブラシの基本サイズ
     * @param {object} color - RGBA構造を持つ色オブジェクト
     * @param {boolean} isEraser - 消しゴムモードか
     * @param {number} p0 - 開始点の筆圧
     * @param {number} p1 - 終了点の筆圧
     * @param {function} calculatePressureSize - 筆圧から実際の描画サイズを計算する関数
     * @param {object} layer - 描画対象のレイヤー
     */
    drawLine(x0, y0, x1, y1, size, color, isEraser, p0, p1, calculatePressureSize, layer) {
        if (!isFinite(x0) || !isFinite(y0) || !isFinite(x1) || !isFinite(y1)) return;
        const distance = Math.hypot(x1 - x0, y1 - y0);
        if (distance > this.superWidth * 2) return;

        // ✅ 描画経路の可視化
        console.log(`➡️ WebGLRenderer.drawLine: 実行中 (x0:${x0.toFixed(1)}, y0:${y0.toFixed(1)} -> x1:${x1.toFixed(1)}, y1:${y1.toFixed(1)})`);

        const stepSize = Math.max(0.5, size / 4);
        const steps = Math.max(1, Math.ceil(distance / stepSize));

        for (let i = 0; i <= steps; i++) {
            const t = steps > 0 ? i / steps : 0;
            const x = x0 + (x1 - x0) * t;
            const y = y0 + (y1 - y0) * t;
            const pressure = p0 + (p1 - p0) * t;
            const adjustedSize = calculatePressureSize(size, pressure);
            this.drawCircle(x, y, adjustedSize / 2, color, isEraser, layer);
        }
    }

    /**
     * [関数責務] getTransformedImageData: GPU上でレイヤーの変形（移動・回転など）を行い、その結果をCPUが扱えるImageDataとして読み出す。
     * @param {object} layer - 変形を適用するレイヤー
     * @returns {ImageData | null} 変形後のImageData、または失敗時にnull
     */
    getTransformedImageData(layer) {
        if (!this.gl || !layer) return null;
        const gl = this.gl;
        this._createOrUpdateLayerTexture(layer);
        const sourceTexture = this.layerTextures.get(layer);
        if (!sourceTexture) return null;
        
        const tempFBO = twgl.createFramebufferInfo(gl, [{ format: gl.RGBA }], this.superWidth, this.superHeight);
        twgl.bindFramebufferInfo(gl, tempFBO);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(this.programs.compositor.program);
        this._setBlendMode('normal');

        const mvpMatrix = mat4.create();
        mat4.multiply(mvpMatrix, this.projectionMatrix, layer.modelMatrix);

        twgl.setBuffersAndAttributes(gl, this.programs.compositor, this.positionBuffer);
        twgl.setUniforms(this.programs.compositor, {
            u_mvpMatrix: mvpMatrix,
            u_image: sourceTexture,
            u_opacity: 1.0,
        });
        twgl.drawBufferInfo(gl, this.positionBuffer, gl.TRIANGLE_STRIP);
 
        gl.finish();

        const pixelBuffer = new Uint8Array(this.superWidth * this.superHeight * 4);
        gl.readPixels(0, 0, this.superWidth, this.superHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixelBuffer);
        
        twgl.bindFramebufferInfo(gl, null);
        gl.deleteTexture(tempFBO.attachments[0]);
        gl.deleteFramebuffer(tempFBO.framebuffer);
        
        // Down-sampling
        const destImageData = new ImageData(this.width, this.height);
        const destData = destImageData.data;
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const sx = Math.floor(x * this.SUPER_SAMPLING_FACTOR);
                const sy = Math.floor(y * this.SUPER_SAMPLING_FACTOR);
                const sourceY_flipped = this.superHeight - 1 - sy;
                const sourceIndex = (sourceY_flipped * this.superWidth + sx) * 4;
                const destIndex = (y * this.width + x) * 4;
                destData[destIndex]     = pixelBuffer[sourceIndex];
                destData[destIndex + 1] = pixelBuffer[sourceIndex + 1];
                destData[destIndex + 2] = pixelBuffer[sourceIndex + 2];
                destData[destIndex + 3] = pixelBuffer[sourceIndex + 3];
            }
        }
        return destImageData;
    }

    /**
     * [関数責務] compositeLayers: 表示状態にある全レイヤーを、それぞれのブレンドモードと不透明度を考慮して1枚の画像に合成する。
     * 合成結果は、画面表示用の中間フレームバッファ（superCompositeFBO）に描画される。
     * @param {Array<object>} layers - すべてのレイヤーオブジェクトの配列
     * @param {object | null} compositionData - （未使用）合成に関する追加データ
     * @param {object | null} dirtyRect - （未使用）再描画が必要な領域
     */
    compositeLayers(layers, compositionData, dirtyRect) {
        if (!this.gl) return;
        // ✅ 指示書: ログを挿入
        console.log("➡️ WebGLRenderer.compositeLayers: 呼び出し");
        const gl = this.gl;
        layers.forEach(layer => this._createOrUpdateLayerTexture(layer));
        
        twgl.bindFramebufferInfo(gl, this.superCompositeFBO);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(this.programs.compositor.program);
        twgl.setBuffersAndAttributes(gl, this.programs.compositor, this.positionBuffer);
        
        for (const layer of layers) {
            if (!layer.visible || layer.opacity === 0 || !this.layerTextures.has(layer)) continue;
            
            const mvpMatrix = mat4.create();
            mat4.multiply(mvpMatrix, this.projectionMatrix, layer.modelMatrix);
            this._setBlendMode(layer.blendMode);

            twgl.setUniforms(this.programs.compositor, {
                u_mvpMatrix: mvpMatrix,
                u_image: this.layerTextures.get(layer),
                u_opacity: layer.opacity / 100.0
            });
            twgl.drawBufferInfo(gl, this.positionBuffer, gl.TRIANGLE_STRIP);
        }
        
        // ✅ 指示書: テスト描画命令を赤線に変更
        this.drawTestLine(20, 20, 300, 100, [1, 0, 0, 1]); // 赤線
        
        twgl.bindFramebufferInfo(gl, null);
    }
    
    /**
     * [関数責務] renderToDisplay: `compositeLayers`で作成された合成済みテクスチャを、最終的に画面（デフォルトフレームバッファ）に描画する。
     * @param {object | null} compositionData - （未使用）表示に関する追加データ
     * @param {object | null} dirtyRect - （未使用）再描画が必要な領域
     */
    renderToDisplay(compositionData, dirtyRect) {
        if (!this.gl) return;
        const gl = this.gl;
        twgl.bindFramebufferInfo(gl, null);
        gl.clear(gl.COLOR_BUFFER_BIT);
        
        this._setBlendMode('normal');
        gl.useProgram(this.programs.compositor.program);

        const mvpMatrix = mat4.create();
        mat4.multiply(mvpMatrix, this.projectionMatrix, this.identityMatrix);
        
        twgl.setBuffersAndAttributes(gl, this.programs.compositor, this.positionBuffer);
        twgl.setUniforms(this.programs.compositor, {
            u_mvpMatrix: mvpMatrix,
            u_image: this.superCompositeTexture,
            u_opacity: 1.0,
        });
        twgl.drawBufferInfo(gl, this.positionBuffer, gl.TRIANGLE_STRIP);
    }

    /**
     * [関数責務] syncDirtyRectToImageData: GPU上の特定レイヤーのFBOから、指定されたダーティ矩形領域のピクセルデータを読み出し、
     * CPU側のレイヤーのImageDataに書き戻す。これにより、GPUでの描画結果を永続化する。
     * @param {object} layer - 同期対象のレイヤー
     * @param {object} dirtyRect - GPUから読み出す領域（minX, minY, maxX, maxY）
     */
    syncDirtyRectToImageData(layer, dirtyRect) {
        const gl = this.gl;
        const fboInfo = this.layerFBOs.get(layer);
        if (!fboInfo || dirtyRect.minX > dirtyRect.maxX) return;
        
        const sx = Math.floor(dirtyRect.minX);
        const sy = Math.floor(dirtyRect.minY);
        const sWidth = Math.ceil(dirtyRect.maxX - sx);
        const sHeight = Math.ceil(dirtyRect.maxY - sy);
        if (sWidth <= 0 || sHeight <= 0) return;

        twgl.bindFramebufferInfo(gl, fboInfo);
        const superBuffer = new Uint8Array(sWidth * sHeight * 4);
        const readY = this.superHeight - sy - sHeight;
        gl.readPixels(sx, readY, sWidth, sHeight, gl.RGBA, gl.UNSIGNED_BYTE, superBuffer);
        twgl.bindFramebufferInfo(gl, null);

        const targetImageData = layer.imageData;
        const targetData = targetImageData.data;
        const factor = this.SUPER_SAMPLING_FACTOR;
        
        const dx_min = Math.floor(sx / factor);
        const dy_min = Math.floor(sy / factor);
        const dx_max = Math.ceil((sx + sWidth) / factor);
        const dy_max = Math.ceil((sy + sHeight) / factor);

        for (let y = dy_min; y < dy_max; y++) {
            for (let x = dx_min; x < dx_max; x++) {
                if (x >= targetImageData.width || y >= targetImageData.height) continue;
                
                const sourceX = Math.floor((x - dx_min) * factor);
                const sourceY = Math.floor((y - dy_min) * factor);
                const sourceIndex = ((sHeight - 1 - sourceY) * sWidth + sourceX) * 4;
                const targetIndex = (y * targetImageData.width + x) * 4;

                if (sourceIndex >= 0 && sourceIndex + 3 < superBuffer.length) {
                    targetData[targetIndex] = superBuffer[sourceIndex];
                    targetData[targetIndex + 1] = superBuffer[sourceIndex + 1];
                    targetData[targetIndex + 2] = superBuffer[sourceIndex + 2];
                    targetData[targetIndex + 3] = superBuffer[sourceIndex + 3];
                }
            }
        }
    }
}