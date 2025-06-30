/*
 * ===================================================================================
 * Toshinka Tegaki Tool - WebGL Engine
 * Version: 2.3.0 (Coordinate System Unification)
 *
 * - 修正：
 * - 描画が上下反転する問題を根本的に解決するため、座標系の扱い方を統一。
 * -
 * -【基本方針】
 * - 1. JavaScript/ImageData側：Y軸は「下向き」が標準（左上が原点）。
 * - 2. WebGL/シェーダー側：Y軸は「上向き」が標準（左下が原点）。
 * - この差異を吸収する処理を、一貫したルールで適用します。
 *
 * -【具体的な修正】
 * - 1. テクスチャアップロード時 (_createOrUpdateTextureFromImageData):
 * -   `UNPACK_FLIP_Y_WEBGL` は常に `false` に設定。ImageDataをそのまま（Y軸下向き）GPUへ転送します。
 *
 * - 2. ブラシ描画時 (drawCircle, drawLine):
 * -   マウス座標（Y軸下向き）をシェーダーに渡す際、`canvas.height - y` でWebGL座標（Y軸上向き）に変換します。
 * これが「CPU座標からGPU座標への唯一の変換点」となります。
 *
 * - 3. レイヤー合成時 (compositeLayers):
 * -   中間バッファへの描画のため、標準のテクスチャ座標（反転なし）を使用します。
 *
 * - 4. 最終画面表示時 (renderToDisplay):
 * -   Y軸下向きで作成されたテクスチャを正しく表示するため、この描画の時だけテクスチャ座標のYを反転させます。
 *
 * - 5. GPUデータ読み戻し時 (syncDirtyRectToImageData):
 * -   `readPixels` はWebGL座標（Y軸上向き）で読み出すため、ImageData（Y軸下向き）に書き戻す際に手動で上下反転させます。（既存のロジックを維持）
 *
 * - この一貫したアプローチにより、混乱なく安定した描画を実現します。
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
        // 標準的なアルファブレンディングに設定
        gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        this._initShaderPrograms();
        if (!this.programs.compositor || !this.programs.brush) {
            console.error("Failed to create all required WebGL programs.");
            this.gl = null; // エラー発生時はエンジンを無効化
            return;
        }

        this._initBuffers();
        this._setupCompositingBuffer();

        console.log("WebGL Engine (v2.3.0 Coordinate System Unification) initialized successfully.");
    }

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
            
            void main() {
                // クリップ座標(-1 ~ +1)からピクセル座標に変換
                vec2 coord = (v_pos * 0.5 + 0.5) * u_resolution;
                float dist = distance(coord, u_center);
                // アンチエイリアシングのための1ピクセルの縁
                float edge = 1.0;
                float alpha = 1.0 - smoothstep(u_radius - edge, u_radius, dist);

                if (alpha < 0.01) {
                    discard;
                }
                
                // pre-multiplied alphaを考慮した色出力
                gl_FragColor = vec4(u_color.rgb * alpha, alpha);
            }`;
        
        this.programs.compositor = this._createProgram(vsCompositor, fsCompositor);
        this.programs.brush = this._createProgram(vsBrush, fsBrush);
    }
    
    _initBuffers() {
        const gl = this.gl;
        // 画面全体を覆う四角形の頂点座標
        this.positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        const positions = [ -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0, -1.0 ]; // 左上、左下、右上、右下 (TRIANGLE_STRIP)
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

        // 標準的なテクスチャ座標 (Y軸は下向き)
        this.texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        const texCoords = [ 
            0.0, 0.0,  // 左上
            0.0, 1.0,  // 左下
            1.0, 0.0,  // 右上
            1.0, 1.0   // 右下
        ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);
    }

    _compileShader(source, type) { const gl = this.gl; const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader); if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { console.error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader)); gl.deleteShader(shader); return null; } return shader; }
    _createProgram(vsSource, fsSource) { const gl = this.gl; const vs = this._compileShader(vsSource, gl.VERTEX_SHADER); const fs = this._compileShader(fsSource, gl.FRAGMENT_SHADER); if (!vs || !fs) return null; const program = gl.createProgram(); gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program); if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { console.error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(program)); gl.deleteProgram(program); return null; } program.locations = {}; const locs = (p) => { p.locations.a_position = gl.getAttribLocation(p, 'a_position'); p.locations.a_texCoord = gl.getAttribLocation(p, 'a_texCoord'); p.locations.u_image = gl.getUniformLocation(p, 'u_image'); p.locations.u_opacity = gl.getUniformLocation(p, 'u_opacity'); p.locations.u_resolution = gl.getUniformLocation(p, 'u_resolution'); p.locations.u_center = gl.getUniformLocation(p, 'u_center'); p.locations.u_radius = gl.getUniformLocation(p, 'u_radius'); p.locations.u_color = gl.getUniformLocation(p, 'u_color');}; locs(program); return program; }
    static isSupported() { try { const canvas = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))); } catch (e) { return false; } }

    _createOrUpdateTextureFromImageData(imageData, layer) {
        const gl = this.gl;
        let texture = this.layerTextures.get(layer);
        if (!texture) {
            texture = gl.createTexture();
            this.layerTextures.set(layer, texture);
        }

        gl.bindTexture(gl.TEXTURE_2D, texture);
        
        // ★ 方針1 ★ ImageDataをそのまま(Y軸下向き)の状態でアップロード
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);

        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageData);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
        
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

    _setupCompositingBuffer() { const gl = this.gl; const width = this.canvas.width; const height = this.canvas.height; if (this.compositeFBO) gl.deleteFramebuffer(this.compositeFBO); if (this.compositeTexture) gl.deleteTexture(this.compositeTexture); this.compositeTexture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.compositeTexture); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); this.compositeFBO = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, this.compositeFBO); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.compositeTexture, 0); if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) { console.error('Compositing Framebuffer not complete'); } gl.bindFramebuffer(gl.FRAMEBUFFER, null); }
    
    _setBlendMode(blendMode, isEraser = false) {
        const gl = this.gl;
        if (isEraser) {
            // 消しゴム: 書き込む色のアルファ値を0にする
            gl.blendFuncSeparate(gl.ZERO, gl.ONE, gl.ZERO, gl.ONE_MINUS_SRC_ALPHA);
        } else {
             // pre-multiplied alphaを正しく扱うためのブレンド関数
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

    drawCircle(imageData, centerX, centerY, radius, color, isEraser, layer) {
        if (!this.gl || !this.programs.brush) return;
        const gl = this.gl;
        const program = this.programs.brush;
        
        const targetFBO = this.layerFBOs.get(layer);
        if (!targetFBO) {
            this._createOrUpdateTextureFromImageData(layer.imageData, layer);
            // 再帰呼び出しで再試行
            this.drawCircle(imageData, centerX, centerY, radius, color, isEraser, layer); 
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
        
        // ★ 方針2 ★ マウス座標(Y下向き)をWebGL座標(Y上向き)に変換
        const webglY = this.canvas.height - centerY;
        gl.uniform2f(program.locations.u_center, centerX, webglY);
        gl.uniform1f(program.locations.u_radius, radius);
        
        if (isEraser) {
            // 消しゴムの場合は、ブレンドでアルファを0にするため、色は問わない
             gl.uniform4f(program.locations.u_color, 0.0, 0.0, 0.0, 0.0);
        } else {
             gl.uniform4f(program.locations.u_color, color.r / 255, color.g / 255, color.b / 255, color.a / 255);
        }

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    
    drawLine(imageData, x0, y0, x1, y1, size, color, isEraser, p0 = 1.0, p1 = 1.0, calculatePressureSize, layer) {
        if (!isFinite(x0) || !isFinite(y0) || !isFinite(x1) || !isFinite(y1)) return;
        const distance = Math.hypot(x1 - x0, y1 - y0);
        if (distance > Math.hypot(this.canvas.width, this.canvas.height) * 2) return;

        // 線の距離に応じて、描画する円の数を調整
        const steps = Math.max(1, Math.ceil(distance));

        for (let i = 0; i <= steps; i++) {
            const t = steps > 0 ? i / steps : 0;
            const x = x0 + (x1 - x0) * t;
            const y = y0 + (y1 - y0) * t;
            const pressure = p0 + (p1 - p0) * t;
            const adjustedSize = calculatePressureSize(size, pressure);
            this.drawCircle(imageData, x, y, adjustedSize / 2, color, isEraser, layer);
        }
    }

    fill(imageData, color) { const data = imageData.data; for (let i = 0; i < data.length; i += 4) { data[i] = color.r; data[i + 1] = color.g; data[i + 2] = color.b; data[i + 3] = color.a; } imageData.gpuDirty = true; }
    clear(imageData) { imageData.data.fill(0); imageData.gpuDirty = true; }
    getTransformedImageData(sourceImageData, transform) { const sw = sourceImageData.width; const sh = sourceImageData.height; const tempCanvas = this.transformOffscreenCanvas; const tempCtx = this.transformOffscreenCtx; tempCanvas.width = sw; tempCanvas.height = sh; const sourceCanvas = document.createElement('canvas'); sourceCanvas.width = sw; sourceCanvas.height = sh; sourceCanvas.getContext('2d').putImageData(sourceImageData, 0, 0); tempCtx.clearRect(0, 0, sw, sh); tempCtx.save(); tempCtx.translate(transform.x, transform.y); tempCtx.translate(sw / 2, sh / 2); tempCtx.rotate(transform.rotation * Math.PI / 180); tempCtx.scale(transform.scale * transform.flipX, transform.scale * transform.flipY); tempCtx.translate(-sw / 2, -sh / 2); tempCtx.drawImage(sourceCanvas, 0, 0); tempCtx.restore(); return tempCtx.getImageData(0, 0, sw, sh); }

    compositeLayers(layers, compositionData, dirtyRect) {
        if (!this.gl || !this.programs.compositor || !this.compositeFBO) return;
        const gl = this.gl;
        const program = this.programs.compositor;

        // レイヤーテクスチャの更新とクリーンアップ
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

        // 合成用フレームバッファに描画
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.compositeFBO);
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(program);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.vertexAttribPointer(program.locations.a_position, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(program.locations.a_position);
        
        // ★ 方針3 ★ 合成時は標準のテクスチャ座標を使用
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
        
        // 画面（デフォルトフレームバッファ）に描画
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

        // ★ 方針4 ★ 最終表示の時だけテクスチャ座標を上下反転させる
        const flippedTexCoords = [ 
            0.0, 1.0,  // 左上 -> Tex(0,1)
            0.0, 0.0,  // 左下 -> Tex(0,0)
            1.0, 1.0,  // 右上 -> Tex(1,1)
            1.0, 0.0   // 右下 -> Tex(1,0)
        ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(flippedTexCoords), gl.DYNAMIC_DRAW);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.compositeTexture);
        gl.uniform1i(program.locations.u_image, 0);
        gl.uniform1f(program.locations.u_opacity, 1.0);
        
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        
        // 後続処理のためにテクスチャ座標バッファを標準に戻す
        const originalTexCoords = [0.0, 0.0, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(originalTexCoords), gl.DYNAMIC_DRAW);

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
        
        // ★ 方針5 ★ FBOから読み出す際は、WebGL座標(Y上向き)に合わせる
        const readY = this.canvas.height - (y + height);
        gl.readPixels(x, readY, width, height, gl.RGBA, gl.UNSIGNED_BYTE, buffer);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        const targetImageData = layer.imageData;
        const targetData = targetImageData.data;
        const canvasWidth = targetImageData.width;
        
        // ★ 方針5 ★ 読み出したデータ(Y上向き)をImageData(Y下向き)に反転させながら書き込む
        for (let row = 0; row < height; row++) {
            const destY = y + row;
            if (destY < 0 || destY >= targetImageData.height) continue;

            const sourceRowIndex = height - 1 - row; // 上下反転
            const sourceOffset = sourceRowIndex * width * 4;
            const destOffset = destY * canvasWidth * 4 + x * 4;
            
            const rowData = buffer.subarray(sourceOffset, sourceOffset + width * 4);
            targetData.set(rowData, destOffset);
        }
    }
}
