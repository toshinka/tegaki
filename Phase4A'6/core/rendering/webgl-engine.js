/*
 * ===================================================================================
 * Toshinka Tegaki Tool - WebGL Engine
 * Version: 2.2.0 (Phase 4A'6 Performance Patch)
 *
 * - 修正：
 * - パフォーマンス改善：drawCircle実行時のリアルタイムなピクセルデータ同期を廃止。
 * これにより描画遅延が解消され、滑らかな線が描けるようになります。
 * - 追加：
 * - syncDirtyRectToImageDataメソッドを追加。描画ストローク完了後、
 * このメソッドでUndo用のピクセルデータを一度だけ同期します。
 * ===================================================================================
 */
import { DrawingEngine } from './drawing-engine.js';

export class WebGLEngine extends DrawingEngine {
    constructor(canvas) {
        super(canvas);
        this.gl = null;
        
        // シェーダープログラムを管理するオブジェクト
        this.programs = {
            compositor: null, // レイヤー合成用
            brush: null       // ブラシ描画用
        };

        // 頂点バッファ
        this.positionBuffer = null;
        this.texCoordBuffer = null;

        // レイヤー合成用FBO
        this.compositeTexture = null;
        this.compositeFBO = null;

        // 各レイヤーのテクスチャとFBOを管理
        this.layerTextures = new Map();
        this.layerFBOs = new Map();

        // 描画品質設定（CPU描画ロジックは残しつつ、当面は未使用）
        this.drawingQuality = {
            enableSubpixel: true,
            antialiasThreshold: 2.0,
            minDrawSteps: 1,
            maxDrawSteps: 100
        };
        
        // 従来の変形処理用オフスクリーンCanvas（getTransformedImageDataで使用）
        this.transformOffscreenCanvas = document.createElement('canvas');
        this.transformOffscreenCtx = this.transformOffscreenCanvas.getContext('2d');

        // --- WebGL初期化 ---
        try {
            this.gl = canvas.getContext('webgl', { preserveDrawingBuffer: true, premultipliedAlpha: true }) || canvas.getContext('experimental-webgl', { preserveDrawingBuffer: true, premultipliedAlpha: true });
            if (!this.gl) throw new Error('WebGL is not supported in this browser.');
        } catch (e) {
            console.error("WebGL Engine initialization failed:", e);
            return;
        }

        const gl = this.gl;
        gl.clearColor(0.0, 0.0, 0.0, 0.0);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        // --- シェーダーのコンパイルとリンク ---
        this._initShaderPrograms();
        if (!this.programs.compositor || !this.programs.brush) {
            console.error("Failed to create all required WebGL programs.");
            return;
        }

        // --- 頂点バッファの作成 ---
        this._initBuffers();

        // --- レイヤー合成用FBOのセットアップ ---
        this._setupCompositingBuffer();

        console.log("WebGL Engine (v2.2.0 PerfPatch) initialized successfully.");
    }

    // --- 初期化ヘルパーメソッド ---

    _initShaderPrograms() {
        const vsCompositor = `
            attribute vec4 a_position;
            attribute vec2 a_texCoord;
            varying vec2 v_texCoord;
            void main() {
                gl_Position = a_position;
                v_texCoord = a_texCoord;
            }`;
        const fsCompositor = `
            precision mediump float;
            varying vec2 v_texCoord;
            uniform sampler2D u_image;
            uniform float u_opacity;
            void main() {
                vec4 texColor = texture2D(u_image, v_texCoord);
                gl_FragColor = vec4(texColor.rgb, texColor.a) * u_opacity;
            }`;

        // ブラシ描画用シェーダー
        const vsBrush = `
            attribute vec4 a_position;
            varying vec2 v_pos;
            void main() {
                gl_Position = a_position;
                v_pos = a_position.xy;
            }`;
        const fsBrush = `
            precision mediump float;
            varying vec2 v_pos;
            uniform vec2 u_resolution;
            uniform vec2 u_center;
            uniform float u_radius;
            uniform vec4 u_color;
            uniform bool u_is_eraser;

            void main() {
                vec2 coord = (v_pos * 0.5 + 0.5) * u_resolution;
                float dist = distance(coord, u_center);
                float radius_aa = u_radius + 0.5;
                float alpha = 1.0 - smoothstep(u_radius - 0.5, radius_aa, dist);

                if (alpha < 0.01) {
                    discard;
                }

                if (u_is_eraser) {
                    // 消しゴムの場合、アルファを0にする（ブレンドで合成）
                    gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
                } else {
                    gl_FragColor = vec4(u_color.rgb, u_color.a * alpha);
                }
            }`;
        
        this.programs.compositor = this._createProgram(vsCompositor, fsCompositor);
        this.programs.brush = this._createProgram(vsBrush, fsBrush);
    }
    
    _initBuffers() {
        const gl = this.gl;
        this.positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        const positions = [ -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0, -1.0 ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

        this.texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        const texCoords = [ 0.0, 1.0, 0.0, 0.0, 1.0, 1.0, 1.0, 0.0 ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);
    }

    // --- WebGL コアメソッド ---
    _compileShader(source, type) { const gl = this.gl; const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader); if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { console.error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader)); gl.deleteShader(shader); return null; } return shader; }
    _createProgram(vsSource, fsSource) { const gl = this.gl; const vs = this._compileShader(vsSource, gl.VERTEX_SHADER); const fs = this._compileShader(fsSource, gl.FRAGMENT_SHADER); if (!vs || !fs) return null; const program = gl.createProgram(); gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program); if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { console.error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(program)); gl.deleteProgram(program); return null; } program.locations = {}; const locs = (p) => { p.locations.a_position = gl.getAttribLocation(p, 'a_position'); p.locations.a_texCoord = gl.getAttribLocation(p, 'a_texCoord'); p.locations.u_image = gl.getUniformLocation(p, 'u_image'); p.locations.u_opacity = gl.getUniformLocation(p, 'u_opacity'); p.locations.u_resolution = gl.getUniformLocation(p, 'u_resolution'); p.locations.u_center = gl.getUniformLocation(p, 'u_center'); p.locations.u_radius = gl.getUniformLocation(p, 'u_radius'); p.locations.u_color = gl.getUniformLocation(p, 'u_color'); p.locations.u_is_eraser = gl.getUniformLocation(p, 'u_is_eraser'); }; locs(program); return program; }
    static isSupported() { try { const canvas = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))); } catch (e) { return false; } }

    // --- テクスチャ・FBO管理 ---
    _createOrUpdateTextureFromImageData(imageData, layer) {
        const gl = this.gl;
        let texture = this.layerTextures.get(layer);
        if (!texture) {
            texture = gl.createTexture();
            this.layerTextures.set(layer, texture);
        }

        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); // ImageDataはY反転不要
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageData);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);

        // このテクスチャを描画先とするFBOも作成/更新
        this._setupLayerFBO(layer, texture);
        return texture;
    }

    _setupLayerFBO(layer, texture) {
        const gl = this.gl;
        let fbo = this.layerFBOs.get(layer);
        if (!fbo) {
            fbo = gl.createFramebuffer();
            this.layerFBOs.set(layer, fbo);
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
            console.error('Layer FBO not complete for layer:', layer.name);
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    _setupCompositingBuffer() { const gl = this.gl; const width = this.canvas.width; const height = this.canvas.height; if (this.compositeFBO) gl.deleteFramebuffer(this.compositeFBO); if (this.compositeTexture) gl.deleteTexture(this.compositeTexture); this.compositeTexture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.compositeTexture); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); this.compositeFBO = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, this.compositeFBO); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.compositeTexture, 0); if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) { console.error('Compositing Framebuffer not complete'); } gl.bindFramebuffer(gl.FRAMEBUFFER, null); }
    
    _setBlendMode(blendMode, isEraser = false) {
        const gl = this.gl;
        if (isEraser) {
            gl.blendFuncSeparate(gl.ZERO, gl.ONE, gl.ZERO, gl.ONE_MINUS_SRC_ALPHA);
            return;
        }

        gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        switch (blendMode) {
            case 'multiply':
                gl.blendFuncSeparate(gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
                break;
            case 'screen':
                gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_COLOR, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
                break;
            case 'add':
                gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ONE, gl.ONE);
                break;
            default: // normal
                gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
                break;
        }
    }

    // ### 描画メソッド (GPU実装) ###
    
    drawCircle(imageData, centerX, centerY, radius, color, isEraser, layer) {
        if (!this.gl || !this.programs.brush) return;
        const gl = this.gl;
        const program = this.programs.brush;
        
        const targetFBO = this.layerFBOs.get(layer);
        if (!targetFBO) {
            console.warn("Target FBO for drawing not found for layer:", layer.name);
            return;
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, targetFBO);
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        
        gl.useProgram(program);
        this._setBlendMode('normal', isEraser);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.vertexAttribPointer(program.locations.a_position, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(program.locations.a_position);
        
        gl.uniform2f(program.locations.u_resolution, this.canvas.width, this.canvas.height);
        gl.uniform2f(program.locations.u_center, centerX, this.canvas.height - centerY); // WebGLは左下が原点
        gl.uniform1f(program.locations.u_radius, radius);
        gl.uniform4f(program.locations.u_color, color.r / 255, color.g / 255, color.b / 255, color.a / 255);
        gl.uniform1i(program.locations.u_is_eraser, isEraser);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        // ★★★ 修正点 ★★★
        // 描画中のリアルタイム同期はパフォーマンスを著しく低下させるため削除。
        // ストローク完了後にsyncDirtyRectToImageDataを呼ぶ方式に変更。
    }
    
    drawLine(imageData, x0, y0, x1, y1, size, color, isEraser, p0 = 1.0, p1 = 1.0, calculatePressureSize, layer) {
        if (!isFinite(x0) || !isFinite(y0) || !isFinite(x1) || !isFinite(y1)) return;
        const distance = Math.hypot(x1 - x0, y1 - y0);
        if (distance > Math.hypot(this.canvas.width, this.canvas.height) * 2) return;

        const baseSteps = Math.max(1, Math.ceil(distance / Math.max(0.5, size / 8)));
        const steps = Math.min(100, baseSteps);

        for (let i = 0; i <= steps; i++) {
            const t = steps > 0 ? i / steps : 0;
            const x = x0 + (x1 - x0) * t;
            const y = y0 + (y1 - y0) * t;
            const pressure = p0 + (p1 - p0) * t;
            const adjustedSize = calculatePressureSize(size, pressure);
            this.drawCircle(imageData, x, y, adjustedSize / 2, color, isEraser, layer);
        }
    }

    fill(imageData, color) { const data = imageData.data; for (let i = 0; i < data.length; i += 4) { data[i] = color.r; data[i + 1] = color.g; data[i + 2] = color.b; data[i + 3] = color.a; } }
    clear(imageData) { imageData.data.fill(0); }
    getTransformedImageData(sourceImageData, transform) { const sw = sourceImageData.width; const sh = sourceImageData.height; const tempCanvas = this.transformOffscreenCanvas; const tempCtx = this.transformOffscreenCtx; tempCanvas.width = sw; tempCanvas.height = sh; const sourceCanvas = document.createElement('canvas'); sourceCanvas.width = sw; sourceCanvas.height = sh; sourceCanvas.getContext('2d').putImageData(sourceImageData, 0, 0); tempCtx.clearRect(0, 0, sw, sh); tempCtx.save(); tempCtx.translate(transform.x, transform.y); tempCtx.translate(sw / 2, sh / 2); tempCtx.rotate(transform.rotation * Math.PI / 180); tempCtx.scale(transform.scale * transform.flipX, transform.scale * transform.flipY); tempCtx.translate(-sw / 2, -sh / 2); tempCtx.drawImage(sourceCanvas, 0, 0); tempCtx.restore(); return tempCtx.getImageData(0, 0, sw, sh); }

    // --- レイヤー合成と画面表示 (変更あり) ---

    compositeLayers(layers, compositionData, dirtyRect) {
        if (!this.gl || !this.programs.compositor || !this.compositeFBO) return;
        const gl = this.gl;
        const program = this.programs.compositor;

        // --- テクスチャとFBOの更新 ---
        const currentLayerSet = new Set(layers);
        for (const layer of layers) {
             this._createOrUpdateTextureFromImageData(layer.imageData, layer);
        }
        for (const layer of this.layerTextures.keys()) {
            if (!currentLayerSet.has(layer)) {
                gl.deleteTexture(this.layerTextures.get(layer));
                gl.deleteFramebuffer(this.layerFBOs.get(layer));
                this.layerTextures.delete(layer);
                this.layerFBOs.delete(layer);
            }
        }

        // --- 合成描画 ---
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.compositeFBO);
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(program);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.vertexAttribPointer(program.locations.a_position, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(program.locations.a_position);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.vertexAttribPointer(program.locations.a_texCoord, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(program.locations.a_texCoord);

        for (const layer of layers) {
            if (!layer.visible || layer.opacity === 0 || !this.layerTextures.has(layer)) continue;
            
            this._setBlendMode(layer.blendMode);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.layerTextures.get(layer));
            gl.uniform1i(program.locations.u_image, 0);
            gl.uniform1f(program.locations.u_opacity, layer.opacity / 100.0);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.disableVertexAttribArray(program.locations.a_position);
        gl.disableVertexAttribArray(program.locations.a_texCoord);
    }
    
    renderToDisplay(compositionData, dirtyRect) {
        if (!this.gl || !this.programs.compositor || !this.compositeTexture) return;
        const gl = this.gl;
        const program = this.programs.compositor;
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clear(gl.COLOR_BUFFER_BIT); // 画面をクリア

        gl.useProgram(program);
        this._setBlendMode('normal');

        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.vertexAttribPointer(program.locations.a_position, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(program.locations.a_position);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.vertexAttribPointer(program.locations.a_texCoord, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(program.locations.a_texCoord);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.compositeTexture);
        gl.uniform1i(program.locations.u_image, 0);
        gl.uniform1f(program.locations.u_opacity, 1.0);
        
        // Y軸を反転させるためにテクスチャ座標を調整
        const texCoords = [ 0.0, 0.0, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0 ]; // Yを反転
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        // テクスチャ座標を元に戻す
        const originalTexCoords = [ 0.0, 1.0, 0.0, 0.0, 1.0, 1.0, 1.0, 0.0 ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(originalTexCoords), gl.STATIC_DRAW);
        
        gl.disableVertexAttribArray(program.locations.a_position);
        gl.disableVertexAttribArray(program.locations.a_texCoord);
    }

    /**
     * ★★★ 追加したメソッド ★★★
     * 描画ストローク完了後、Undo履歴保存のためにGPUテクスチャから
     * CPU側のImageDataへピクセルデータを同期する。
     * @param {Layer} layer 対象レイヤー
     * @param {object} dirtyRect 同期する矩形領域 {minX, minY, maxX, maxY}
     */
    syncDirtyRectToImageData(layer, dirtyRect) {
        const gl = this.gl;
        const fbo = this.layerFBOs.get(layer);
        if (!fbo || dirtyRect.minX > dirtyRect.maxX) return;

        const x = Math.max(0, Math.floor(dirtyRect.minX));
        const y = Math.max(0, Math.floor(dirtyRect.minY));
        const width = Math.min(this.canvas.width, Math.ceil(dirtyRect.maxX)) - x;
        const height = Math.min(this.canvas.height, Math.ceil(dirtyRect.maxY)) - y;

        if (width <= 0 || height <= 0) return;

        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        const buffer = new Uint8Array(width * height * 4);
        // gl.readPixelsのyは左下原点なので、ImageDataのy(左上原点)から変換する
        const readY = this.canvas.height - (y + height);
        gl.readPixels(x, readY, width, height, gl.RGBA, gl.UNSIGNED_BYTE, buffer);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        // GPUから読み出したデータは上下が逆なので、CPU側(ImageData)に書き込む際に反転させる
        const targetImageData = layer.imageData;
        const targetData = targetImageData.data;
        const canvasWidth = targetImageData.width;

        for (let row = 0; row < height; row++) {
            const destY = y + row;
            if (destY < 0 || destY >= canvasWidth) continue;

            const sourceOffset = (height - 1 - row) * width * 4;
            const destOffset = destY * canvasWidth * 4 + x * 4;
            
            const rowData = buffer.subarray(sourceOffset, sourceOffset + width * 4);
            targetData.set(rowData, destOffset);
        }
    }
}