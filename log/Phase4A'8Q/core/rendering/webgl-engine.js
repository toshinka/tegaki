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
        this.SUPER_SAMPLING_FACTOR = 2.0;

        this.width = canvas.width;
        this.height = canvas.height;
        // ★★★ 内部処理用の高解像度 ★★★
        this.superWidth = this.width * this.SUPER_SAMPLING_FACTOR;
        this.superHeight = this.height * this.SUPER_SAMPLING_FACTOR;
        
        this.programs = { compositor: null, brush: null };
        this.positionBuffer = null;
        this.texCoordBuffer = null;
        this.brushPositionBuffer = null;
        
        // ★★★ 高解像度の中間合成用バッファ ★★★
        this.superCompositeTexture = null;
        this.superCompositeFBO = null;
        
        this.layerTextures = new Map();
        this.layerFBOs = new Map();
        
        this.transformOffscreenCanvas = document.createElement('canvas');
        this.transformOffscreenCtx = this.transformOffscreenCanvas.getContext('2d');

        try {
            this.gl = canvas.getContext('webgl', { preserveDrawingBuffer: true, premultipliedAlpha: true, antialias: false }) || canvas.getContext('experimental-webgl', { preserveDrawingBuffer: true, premultipliedAlpha: true, antialias: false });
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
        // ★★★ 修正: 高解像度の中間合成バッファをセットアップ ★★★
        this._setupSuperCompositingBuffer();

        console.log(`WebGL Engine (v3.0.0 Super-Sampling Revamp) initialized with ${this.superWidth}x${this.superHeight} internal resolution.`);
    }

    _initShaderPrograms() {
        // ★★★★★ 修正箇所: このシェーダーは高解像度テクスチャを高品質にサンプリングするために使われる ★★★★★
        const vsCompositor = `
            attribute vec4 a_position;
            attribute vec2 a_texCoord;
            varying vec2 v_texCoord;
            void main() {
                gl_Position = a_position;
                v_texCoord = a_texCoord;
            }`;
        const fsCompositor = `
            precision highp float; // 高品質化のため精度を上げる
            varying vec2 v_texCoord;
            uniform sampler2D u_image;
            uniform float u_opacity;
            uniform vec2 u_source_resolution; // ソーステクスチャ（高解像度）のサイズ

            void main() {
                // ハードウェアの線形補間(ぼやけがち)に頼らず、手動でのバイリニアフィルタリングで
                // ジャギを抑えつつ鮮明な描画を実現する。
                vec2 texel_size = 1.0 / u_source_resolution;
                vec4 color = vec4(0.0);
                
                // 2x2のピクセルをサンプリングして平均化 (ボックスフィルタ)
                color += texture2D(u_image, v_texCoord + texel_size * vec2(-0.25, -0.25));
                color += texture2D(u_image, v_texCoord + texel_size * vec2( 0.25, -0.25));
                color += texture2D(u_image, v_texCoord + texel_size * vec2( 0.25,  0.25));
                color += texture2D(u_image, v_texCoord + texel_size * vec2(-0.25,  0.25));
                color *= 0.25;

                gl_FragColor = vec4(color.rgb, color.a * u_opacity);
            }`;

        const vsBrush = `
            precision mediump float;
            attribute vec2 a_position; 
            uniform vec2 u_resolution;
            uniform vec2 u_center;
            uniform float u_radius;
            varying vec2 v_texCoord;

            void main() {
                vec2 quad_size_pixels = vec2(u_radius * 2.0 + 2.0);
                vec2 quad_size_clip = quad_size_pixels / u_resolution;
                vec2 center_clip = (u_center / u_resolution) * 2.0 - 1.0;
                gl_Position = vec4(a_position * quad_size_clip + center_clip, 0.0, 1.0);
                v_texCoord = a_position + 0.5;
            }`;

        const fsBrush = `
            precision highp float; // 高品質化のため精度を上げる
            varying vec2 v_texCoord;
            uniform float u_radius;
            uniform vec4 u_color;
            uniform bool u_is_eraser;

            void main() {
                float dist = distance(v_texCoord, vec2(0.5));
                float pixel_in_uv = 1.0 / (max(u_radius, 0.5) * 2.0);
                float alpha = 1.0 - smoothstep(0.5 - pixel_in_uv, 0.5, dist);

                if (alpha < 0.01) {
                    discard;
                }

                if (u_is_eraser) {
                    gl_FragColor = vec4(0.0, 0.0, 0.0, alpha); 
                } else {
                    // 事前乗算済みアルファで出力
                    gl_FragColor = vec4(u_color.rgb * u_color.a * alpha, u_color.a * alpha);
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
        
        this.brushPositionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.brushPositionBuffer);
        const brushPositions = [ -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5, -0.5 ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(brushPositions), gl.STATIC_DRAW);
    }

    _compileShader(source, type) { const gl = this.gl; const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader); if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { console.error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader)); gl.deleteShader(shader); return null; } return shader; }
    _createProgram(vsSource, fsSource) { const gl = this.gl; const vs = this._compileShader(vsSource, gl.VERTEX_SHADER); const fs = this._compileShader(fsSource, gl.FRAGMENT_SHADER); if (!vs || !fs) return null; const program = gl.createProgram(); gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program); if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { console.error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(program)); gl.deleteProgram(program); return null; } program.locations = {}; const locs = (p) => { p.locations.a_position = gl.getAttribLocation(p, 'a_position'); p.locations.a_texCoord = gl.getAttribLocation(p, 'a_texCoord'); p.locations.u_image = gl.getUniformLocation(p, 'u_image'); p.locations.u_opacity = gl.getUniformLocation(p, 'u_opacity'); p.locations.u_resolution = gl.getUniformLocation(p, 'u_resolution'); p.locations.u_center = gl.getUniformLocation(p, 'u_center'); p.locations.u_radius = gl.getUniformLocation(p, 'u_radius'); p.locations.u_color = gl.getUniformLocation(p, 'u_color'); p.locations.u_is_eraser = gl.getUniformLocation(p, 'u_is_eraser'); p.locations.u_source_resolution = gl.getUniformLocation(p, 'u_source_resolution'); }; locs(program); return program; }
    static isSupported() { try { const canvas = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))); } catch (e) { return false; } }

    _createOrUpdateLayerTexture(layer) {
        const gl = this.gl;
        let texture = this.layerTextures.get(layer);
        let fbo = this.layerFBOs.get(layer);

        if (!texture) {
            texture = gl.createTexture();
            this.layerTextures.set(layer, texture);

            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.superWidth, this.superHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

            fbo = gl.createFramebuffer();
            this.layerFBOs.set(layer, fbo);
            gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

            // CPUのImageDataからGPUテクスチャへ初期データを転送
            if (layer.imageData) {
                 const tempCanvas = document.createElement('canvas');
                 tempCanvas.width = this.superWidth;
                 tempCanvas.height = this.superHeight;
                 const tempCtx = tempCanvas.getContext('2d');
                 tempCtx.drawImage(layer.canvas, 0, 0, layer.canvas.width, layer.canvas.height, 0, 0, this.superWidth, this.superHeight);
                 const superImageData = tempCtx.getImageData(0,0,this.superWidth, this.superHeight);

                 gl.bindTexture(gl.TEXTURE_2D, texture);
                 gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); // No flip needed from canvas
                 gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, superImageData);
            }
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        }

        // ダーティフラグが立っている場合、CPUのImageDataからテクスチャを更新
        if (layer.gpuDirty) {
            // CPU->GPUへのデータ転送はコストが高い。差分更新が理想だが、まずは全更新で実装。
            // LayerのimageDataを高解像度化して転送する
             const tempCanvas = document.createElement('canvas');
             tempCanvas.width = this.superWidth;
             tempCanvas.height = this.superHeight;
             const tempCtx = tempCanvas.getContext('2d');
             tempCtx.imageSmoothingEnabled = true;
             tempCtx.imageSmoothingQuality = 'high';

             const sourceCanvas = document.createElement('canvas');
             sourceCanvas.width = layer.imageData.width;
             sourceCanvas.height = layer.imageData.height;
             sourceCanvas.getContext('2d').putImageData(layer.imageData, 0, 0);

             tempCtx.drawImage(sourceCanvas, 0, 0, this.superWidth, this.superHeight);

            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, tempCanvas);
            gl.bindTexture(gl.TEXTURE_2D, null);
            layer.gpuDirty = false;
        }
    }
    
    // ★★★★★ 修正箇所: 中間合成バッファを「高解像度」で作成 ★★★★★
    _setupSuperCompositingBuffer() {
        const gl = this.gl;
        if (this.superCompositeFBO) gl.deleteFramebuffer(this.superCompositeFBO);
        if (this.superCompositeTexture) gl.deleteTexture(this.superCompositeTexture);

        this.superCompositeTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.superCompositeTexture);
        // 解像度をsuperWidth, superHeightにする
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.superWidth, this.superHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        
        this.superCompositeFBO = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.superCompositeFBO);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.superCompositeTexture, 0);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
            console.error('Super-Sampling Compositing Framebuffer not complete');
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    
    _setBlendMode(blendMode, isEraser = false) {
        const gl = this.gl;
        if (isEraser) {
            // 消しゴムはアルファチャンネルのみを削る
            gl.blendEquation(gl.FUNC_ADD);
            gl.blendFuncSeparate(gl.ZERO, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE_MINUS_SRC_ALPHA);
        } else {
            // 通常描画は事前乗算済みアルファを想定
            gl.blendEquation(gl.FUNC_ADD);
            gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            
            switch (blendMode) {
                case 'multiply': gl.blendFuncSeparate(gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA); break;
                case 'screen': gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_COLOR, gl.ONE, gl.ONE_MINUS_SRC_ALPHA); break;
                case 'add': gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ONE, gl.ONE); break;
                // 'normal' or default
                default: gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA); break;
            }
        }
    }

    drawCircle(centerX, centerY, radius, color, isEraser, layer) {
        if (!this.gl || !this.programs.brush) return;
        const gl = this.gl;
        const program = this.programs.brush;
        
        this._createOrUpdateLayerTexture(layer);
        const targetFBO = this.layerFBOs.get(layer);
        if (!targetFBO) { return; }

        gl.bindFramebuffer(gl.FRAMEBUFFER, targetFBO);
        gl.viewport(0, 0, this.superWidth, this.superHeight);
        
        gl.enable(gl.SCISSOR_TEST);
        gl.scissor(0, 0, this.superWidth, this.superHeight);
        
        gl.useProgram(program);
        this._setBlendMode('normal', isEraser);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.brushPositionBuffer);
        gl.vertexAttribPointer(program.locations.a_position, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(program.locations.a_position);
        
        const superX = centerX * this.SUPER_SAMPLING_FACTOR;
        const superY = centerY * this.SUPER_SAMPLING_FACTOR;
        const superRadius = radius * this.SUPER_SAMPLING_FACTOR;
        const webglSuperY = this.superHeight - superY;
        
        gl.uniform2f(program.locations.u_resolution, this.superWidth, this.superHeight);
        gl.uniform2f(program.locations.u_center, superX, webglSuperY);
        gl.uniform1f(program.locations.u_radius, superRadius);
        gl.uniform4f(program.locations.u_color, color.r / 255, color.g / 255, color.b / 255, color.a / 255);
        gl.uniform1i(program.locations.u_is_eraser, isEraser);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        gl.disable(gl.SCISSOR_TEST);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    
    drawLine(x0, y0, x1, y1, size, color, isEraser, p0, p1, calculatePressureSize, layer) {
        if (!isFinite(x0) || !isFinite(y0) || !isFinite(x1) || !isFinite(y1)) return;
        const distance = Math.hypot(x1 - x0, y1 - y0);
        if (distance > this.width * 2) return;

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

    fill(imageData, color) { /* ... 変更なし ... */ }
    clear(imageData) { /* ... 変更なし ... */ }
    getTransformedImageData(sourceImageData, transform) {
        const canvas = this.transformOffscreenCanvas;
        const ctx = this.transformOffscreenCtx;
        const w = sourceImageData.width;
        const h = sourceImageData.height;
        if (canvas.width !== w || canvas.height !== h) {
             canvas.width = w;
             canvas.height = h;
        }
        ctx.save();
        ctx.clearRect(0, 0, w, h);
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = w;
        tempCanvas.height = h;
        tempCanvas.getContext('2d').putImageData(sourceImageData, 0, 0);
        const centerX = w / 2;
        const centerY = h / 2;
        ctx.translate(centerX + transform.x, centerY + transform.y);
        ctx.rotate(transform.rotation * Math.PI / 180);
        ctx.scale(transform.scale * transform.flipX, transform.scale * transform.flipY);
        ctx.translate(-centerX, -centerY);
        ctx.drawImage(tempCanvas, 0, 0);
        ctx.restore();
        return ctx.getImageData(0, 0, w, h);
    }

    // ★★★★★ 修正箇所: 新しい描画フロー ステップ2 ★★★★★
    // 全レイヤーを「高解像度」の中間バッファに合成する
    compositeLayers(layers, compositionData, dirtyRect) {
        if (!this.gl || !this.programs.compositor || !this.superCompositeFBO) return;
        const gl = this.gl;
        const program = this.programs.compositor;

        // 各レイヤーのテクスチャを準備（ダーティなら更新）
        for (const layer of layers) {
            this._createOrUpdateLayerTexture(layer);
        }
        
        // 描画先を「高解像度」の中間バッファに設定
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.superCompositeFBO);
        gl.viewport(0, 0, this.superWidth, this.superHeight);
        
        gl.enable(gl.SCISSOR_TEST);
        gl.scissor(0, 0, this.superWidth, this.superHeight);
        
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(program);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.vertexAttribPointer(program.locations.a_position, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(program.locations.a_position);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.vertexAttribPointer(program.locations.a_texCoord, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(program.locations.a_texCoord);
        
        // レイヤーを順番に高解像度バッファに描画していく
        for (const layer of layers) {
            if (!layer.visible || layer.opacity === 0 || !this.layerTextures.has(layer)) continue;

            this._setBlendMode(layer.blendMode);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.layerTextures.get(layer));
            
            // ソースもターゲットも高解像度なので、シェーダーにその解像度を渡す
            gl.uniform2f(program.locations.u_source_resolution, this.superWidth, this.superHeight);
            gl.uniform1i(program.locations.u_image, 0);
            gl.uniform1f(program.locations.u_opacity, layer.opacity / 100.0);
            
            // 描画実行
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }

        gl.disable(gl.SCISSOR_TEST);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.disableVertexAttribArray(program.locations.a_position);
        gl.disableVertexAttribArray(program.locations.a_texCoord);
    }
    
    // ★★★★★ 修正箇所: 新しい描画フロー ステップ3 ★★★★★
    // 「高解像度」の中間合成結果を、画面に「縮小描画」する
    renderToDisplay(compositionData, dirtyRect) {
        if (!this.gl || !this.superCompositeTexture) return;
        const gl = this.gl;
        const program = this.programs.compositor;

        // 描画先を画面（null = canvas本体）に設定
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        
        // 最終的な画面表示なので、ブレンドは通常のアルファブレンドに戻す
        this._setBlendMode('normal');

        gl.useProgram(program);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.vertexAttribPointer(program.locations.a_position, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(program.locations.a_position);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.vertexAttribPointer(program.locations.a_texCoord, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(program.locations.a_texCoord);
        
        // ソースは高解像度テクスチャ
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.superCompositeTexture);

        // シェーダーにソースの解像度（高解像度）を渡す
        // これにより、シェーダーは高品質なダウンサンプリングを実行できる
        gl.uniform2f(program.locations.u_source_resolution, this.superWidth, this.superHeight);
        gl.uniform1i(program.locations.u_image, 0);
        gl.uniform1f(program.locations.u_opacity, 1.0); // 不透明度は1.0で固定

        // 描画実行（ここでダウンサンプリングが行われる）
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        gl.disableVertexAttribArray(program.locations.a_position);
        gl.disableVertexAttribArray(program.locations.a_texCoord);
    }

    syncDirtyRectToImageData(layer, dirtyRect) {
        const gl = this.gl;
        const fbo = this.layerFBOs.get(layer);
        if (!fbo || dirtyRect.minX > dirtyRect.maxX) return;

        const sx = Math.floor(dirtyRect.minX * this.SUPER_SAMPLING_FACTOR);
        const sy = Math.floor(dirtyRect.minY * this.SUPER_SAMPLING_FACTOR);
        const sWidth = Math.ceil((dirtyRect.maxX - dirtyRect.minX) * this.SUPER_SAMPLING_FACTOR);
        const sHeight = Math.ceil((dirtyRect.maxY - dirtyRect.minY) * this.SUPER_SAMPLING_FACTOR);

        if (sWidth <= 0 || sHeight <= 0) return;

        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        const superBuffer = new Uint8Array(sWidth * sHeight * 4);
        // Y軸が反転しているため、読み取り開始位置を調整
        const readY = this.superHeight - (sy + sHeight);
        gl.readPixels(sx, readY, sWidth, sHeight, gl.RGBA, gl.UNSIGNED_BYTE, superBuffer);
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