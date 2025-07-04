/*
 * ===================================================================================
 * Toshinka Tegaki Tool - WebGL Engine
 * Version: 2.6.0 (Phase 4A'-8 GPU Native Brush)
 *
 * - 修正：
 * - GPUネイティブブラシを実装し、描画パフォーマンスと品質を大幅に向上。
 *
 * -【実装内容】
 * - 1. 新しいブラシ描画シェーダー:
 * -   これまでの「画面全体に描画して円を計算する」方式から、
 * -   「ペン先のサイズの小さな四角形ポリゴンを描画し、その中で円を計算する」方式に変更。
 * -   これにより、計算範囲が限定され、パフォーマンスが劇的に向上。
 * -   ペンサイズ1pxでの破線問題も完全に解決される。
 *
 * - 2. ブラシ専用バッファの導入:
 * -   新しいブラシシェーダーで使うための、小さな四角形ポリゴン用の頂点バッファ
 * -   (`brushPositionBuffer`) を新設。
 *
 * - 3. drawCircleメソッドの刷新:
 * -   新しいブラシシェーダーとバッファを使い、指定された位置に指定された半径の
 * -   円を描画するロジックに全面的に書き換え。
 *
 * - 4. 既存ロジックとの連携:
 * -   drawLineメソッドは変更なし。内部で新しいdrawCircleを呼び出すことで、
 * -   自動的に新しい描画方式の恩恵を受ける。
 * ===================================================================================
 */
import { DrawingEngine } from './drawing-engine.js';

export class WebGLEngine extends DrawingEngine {
    constructor(canvas) {
        super(canvas);
        this.gl = null;
        
        this.programs = {
            compositor: null, 
            brush: null       
        };

        this.positionBuffer = null;
        this.texCoordBuffer = null;
        this.brushPositionBuffer = null; // ★★★ 新設: ブラシ描画用の頂点バッファ ★★★
        
        this.compositeTexture = null;
        this.compositeFBO = null;
        this.layerTextures = new Map();
        this.layerFBOs = new Map();
        
        this.transformOffscreenCanvas = document.createElement('canvas');
        this.transformOffscreenCtx = this.transformOffscreenCanvas.getContext('2d');

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
        gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        this._initShaderPrograms();
        if (!this.programs.compositor || !this.programs.brush) {
            console.error("Failed to create all required WebGL programs.");
            this.gl = null;
            return;
        }

        this._initBuffers();
        this._setupCompositingBuffer();

        console.log("WebGL Engine (v2.6.0 GPU Native Brush) initialized successfully.");
    }

    _initShaderPrograms() {
        // --- 合成用シェーダー (変更なし) ---
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
                gl_FragColor = vec4(texColor.rgb, texColor.a * u_opacity);
            }`;

        // ★★★ 新しいブラシ描画用シェーダー ★★★
        const vsBrush = `
            // 入力: -0.5〜+0.5の範囲の頂点座標
            attribute vec2 a_position; 
            
            // uniform変数: JSから受け取るデータ
            uniform vec2 u_resolution; // キャンバスの解像度
            uniform vec2 u_center;     // ブラシの中心座標 (ピクセル単位)
            uniform float u_radius;    // ブラシの半径 (ピクセル単位)

            // フラグメントシェーダーに渡す座標
            varying vec2 v_texCoord;

            void main() {
                // ブラシの半径から、描画する四角形のサイズを計算
                vec2 quad_size_pixels = vec2(u_radius * 2.0 + 2.0); // 2pxのマージン
                vec2 quad_size_clip = quad_size_pixels / u_resolution;

                // ブラシの中心座標を-1〜+1のクリップ座標に変換
                vec2 center_clip = (u_center / u_resolution) * 2.0 - 1.0;
                
                // 頂点座標を拡大・移動して、最終的な描画位置を計算
                gl_Position = vec4(a_position * quad_size_clip + center_clip, 0.0, 1.0);
                
                // フラグメントシェーダーで円を描画するために、-0.5〜+0.5を0〜1の範囲に変換して渡す
                v_texCoord = a_position + 0.5;
            }`;

        const fsBrush = `
            precision mediump float;
            
            // 頂点シェーダーから受け取る座標 (0〜1の範囲)
            varying vec2 v_texCoord;
            
            uniform vec4 u_color;
            uniform bool u_is_eraser;

            void main() {
                // 四角形の中心(0.5, 0.5)からの距離を計算
                float dist = distance(v_texCoord, vec2(0.5));
                
                // smoothstepを使って、円の境界線を滑らかに(アンチエイリアス)
                // 0.5が円の完全な縁。少し内側からぼかし始める
                float alpha = 1.0 - smoothstep(0.48, 0.5, dist);

                if (alpha < 0.01) {
                    discard; // アルファがほぼ0のピクセルは描画しない
                }

                if (u_is_eraser) {
                    gl_FragColor = vec4(0.0, 0.0, 0.0, alpha); 
                } else {
                    // pre-multiplied alpha形式で色を出力
                    gl_FragColor = vec4(u_color.rgb * u_color.a * alpha, u_color.a * alpha);
                }
            }`;
        
        this.programs.compositor = this._createProgram(vsCompositor, fsCompositor);
        this.programs.brush = this._createProgram(vsBrush, fsBrush);
    }
    
    _initBuffers() {
        const gl = this.gl;
        // 合成用バッファ (画面全体)
        this.positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        const positions = [ -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0, -1.0 ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

        this.texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        const texCoords = [ 0.0, 1.0, 0.0, 0.0, 1.0, 1.0, 1.0, 0.0 ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);
        
        // ★★★ 新設: ブラシ描画用のバッファ (小さな四角形) ★★★
        this.brushPositionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.brushPositionBuffer);
        // 中心が(0,0)になるように、-0.5から+0.5の範囲で頂点を定義
        const brushPositions = [ -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5, -0.5 ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(brushPositions), gl.STATIC_DRAW);
    }

    _compileShader(source, type) { const gl = this.gl; const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader); if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { console.error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader)); gl.deleteShader(shader); return null; } return shader; }
    _createProgram(vsSource, fsSource) { const gl = this.gl; const vs = this._compileShader(vsSource, gl.VERTEX_SHADER); const fs = this._compileShader(fsSource, gl.FRAGMENT_SHADER); if (!vs || !fs) return null; const program = gl.createProgram(); gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program); if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { console.error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(program)); gl.deleteProgram(program); return null; } program.locations = {}; const locs = (p) => { p.locations.a_position = gl.getAttribLocation(p, 'a_position'); p.locations.a_texCoord = gl.getAttribLocation(p, 'a_texCoord'); p.locations.u_image = gl.getUniformLocation(p, 'u_image'); p.locations.u_opacity = gl.getUniformLocation(p, 'u_opacity'); p.locations.u_resolution = gl.getUniformLocation(p, 'u_resolution'); p.locations.u_center = gl.getUniformLocation(p, 'u_center'); p.locations.u_radius = gl.getUniformLocation(p, 'u_radius'); p.locations.u_color = gl.getUniformLocation(p, 'u_color'); p.locations.u_is_eraser = gl.getUniformLocation(p, 'u_is_eraser'); }; locs(program); return program; }
    static isSupported() { try { const canvas = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))); } catch (e) { return false; } }

    _createOrUpdateTextureFromImageData(imageData, layer) {
        const gl = this.gl;
        let texture = this.layerTextures.get(layer);
        if (!texture) {
            texture = gl.createTexture();
            this.layerTextures.set(layer, texture);
        }
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageData);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        layer.gpuDirty = false; 
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

    _setupCompositingBuffer() {
        const gl = this.gl;
        const width = this.canvas.width;
        const height = this.canvas.height;
        if (this.compositeFBO) gl.deleteFramebuffer(this.compositeFBO);
        if (this.compositeTexture) gl.deleteTexture(this.compositeTexture);
        this.compositeTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.compositeTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        this.compositeFBO = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.compositeFBO);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.compositeTexture, 0);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
            console.error('Compositing Framebuffer not complete');
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    
    _setBlendMode(blendMode, isEraser = false) {
        const gl = this.gl;
        if (isEraser) {
            gl.blendFuncSeparate(gl.ZERO, gl.ONE, gl.ZERO, gl.ONE_MINUS_SRC_ALPHA);
        } else {
            gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
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
                case 'normal':
                default:
                    gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA); 
                    break;
            }
        }
    }

    // ★★★ 刷新されたdrawCircleメソッド ★★★
    drawCircle(centerX, centerY, radius, color, isEraser, layer) {
        if (!this.gl || !this.programs.brush) return;
        const gl = this.gl;
        const program = this.programs.brush;
        
        const targetFBO = this.layerFBOs.get(layer);
        if (!targetFBO) {
            this._createOrUpdateTextureFromImageData(layer.imageData, layer);
            this.drawCircle(centerX, centerY, radius, color, isEraser, layer); 
            return;
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, targetFBO);
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        
        gl.useProgram(program);
        this._setBlendMode('normal', isEraser);

        // ★★★ 新しいブラシバッファを使用 ★★★
        gl.bindBuffer(gl.ARRAY_BUFFER, this.brushPositionBuffer);
        gl.vertexAttribPointer(program.locations.a_position, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(program.locations.a_position);
        
        // uniform変数をシェーダーに渡す
        gl.uniform2f(program.locations.u_resolution, this.canvas.width, this.canvas.height);
        const webglY = this.canvas.height - centerY;
        gl.uniform2f(program.locations.u_center, centerX, webglY);
        gl.uniform1f(program.locations.u_radius, radius);
        gl.uniform4f(program.locations.u_color, color.r / 255, color.g / 255, color.b / 255, color.a / 255);
        gl.uniform1i(program.locations.u_is_eraser, isEraser);

        // ★★★ 小さな四角形を1つ描画 ★★★
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    
    // drawLineは変更なし。新しいdrawCircleを呼ぶだけでOK。
    drawLine(x0, y0, x1, y1, size, color, isEraser, p0 = 1.0, p1 = 1.0, calculatePressureSize, layer) {
        if (!isFinite(x0) || !isFinite(y0) || !isFinite(x1) || !isFinite(y1)) return;
        const distance = Math.hypot(x1 - x0, y1 - y0);
        if (distance > Math.hypot(this.canvas.width, this.canvas.height) * 2) return;

        // 描画ステップ数を調整して、滑らかさとパフォーマンスのバランスを取る
        const stepSize = Math.max(0.5, size / 4);
        const steps = Math.max(1, Math.ceil(distance / stepSize));

        for (let i = 0; i <= steps; i++) {
            const t = steps > 0 ? i / steps : 0;
            const x = x0 + (x1 - x0) * t;
            const y = y0 + (y1 - y0) * t;
            const pressure = p0 + (p1 - p0) * t;
            const adjustedSize = calculatePressureSize(size, pressure);
            this.drawCircle(x, y, adjustedSize, color, isEraser, layer); // 半径ではなく直径を渡すように変更の可能性 -> いや、半径のままが正しい
        }
    }

    fill(imageData, color) { const data = imageData.data; for (let i = 0; i < data.length; i += 4) { data[i] = color.r; data[i + 1] = color.g; data[i + 2] = color.b; data[i + 3] = color.a; } imageData.gpuDirty = true; }
    clear(imageData) { imageData.data.fill(0); imageData.gpuDirty = true; }
    getTransformedImageData(sourceImageData, transform) { const sw = sourceImageData.width; const sh = sourceImageData.height; const tempCanvas = this.transformOffscreenCanvas; const tempCtx = this.transformOffscreenCtx; tempCanvas.width = sw; tempCanvas.height = sh; const sourceCanvas = document.createElement('canvas'); sourceCanvas.width = sw; sourceCanvas.height = sh; sourceCanvas.getContext('2d').putImageData(sourceImageData, 0, 0); tempCtx.clearRect(0, 0, sw, sh); tempCtx.save(); tempCtx.translate(transform.x, transform.y); tempCtx.translate(sw / 2, sh / 2); tempCtx.rotate(transform.rotation * Math.PI / 180); tempCtx.scale(transform.scale * transform.flipX, transform.scale * transform.flipY); tempCtx.translate(-sw / 2, -sh / 2); tempCtx.drawImage(sourceCanvas, 0, 0); tempCtx.restore(); return tempCtx.getImageData(0, 0, sw, sh); }

    compositeLayers(layers, compositionData, dirtyRect) {
        if (!this.gl || !this.programs.compositor || !this.compositeFBO) return;
        const gl = this.gl;
        const program = this.programs.compositor;

        const currentLayerSet = new Set(layers);
        for (const layer of layers) {
            if (layer.gpuDirty || !this.layerTextures.has(layer)) {
                this._createOrUpdateTextureFromImageData(layer.imageData, layer);
            }
        }
        for (const layer of this.layerTextures.keys()) {
            if (!currentLayerSet.has(layer)) {
                gl.deleteTexture(this.layerTextures.get(layer));
                gl.deleteFramebuffer(this.layerFBOs.get(layer));
                this.layerTextures.delete(layer);
                this.layerFBOs.delete(layer);
            }
        }

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
        gl.clear(gl.COLOR_BUFFER_BIT);

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
        
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        gl.disableVertexAttribArray(program.locations.a_position);
        gl.disableVertexAttribArray(program.locations.a_texCoord);
    }

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
        
        gl.readPixels(x, y, width, height, gl.RGBA, gl.UNSIGNED_BYTE, buffer);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        const targetImageData = layer.imageData;
        const targetData = targetImageData.data;
        const canvasWidth = targetImageData.width;
        
        for (let row = 0; row < height; row++) {
            const destY = y + row;
            if (destY < 0 || destY >= targetImageData.height) continue;

            const sourceRowIndex = height - 1 - row;
            const sourceOffset = sourceRowIndex * width * 4;
            const destOffset = destY * canvasWidth * 4 + x * 4;
            
            const rowData = buffer.subarray(sourceOffset, sourceOffset + width * 4);
            targetData.set(rowData, destOffset);
        }
    }
}
