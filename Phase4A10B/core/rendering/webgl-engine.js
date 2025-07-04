/*
 * ===================================================================================
 * Toshinka Tegaki Tool - WebGL Engine
 * Version: 6.0.1 (COLOR & COORDINATE FIX)
 *
 * - 主な修正：
 * - 1. 【色の扱いを統一】(赤化問題の解決)
 * -   - `_createOrUpdateLayerTexture`で`gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)`
 * -     を追加。ImageDataをテクスチャに変換する際に、WebGLに「事前乗算済みアルファ」へ
 * -     変換させることで、後続のブレンド処理が正しく行われるようにする。
 *
 * - 2. 【座標系の役割分担の維持】
 * -   - `core-engine.js`がY-down(左上原点)で座標を渡すようになったため、このエンジン内で
 * -     Y-up(左下原点)に変換する処理は非常に重要。
 * -   - ブラシ描画シェーダー内の `center_clip.y *= -1.0;` は維持。
 * -   - テクスチャ更新時の `gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)` も維持。
 * ===================================================================================
 */
import { DrawingEngine } from './drawing-engine.js';

export class WebGLEngine extends DrawingEngine {
    constructor(canvas) {
        super(canvas);
        this.gl = null;
        this.SUPER_SAMPLING_FACTOR = 2.0;
        this.width = canvas.width;
        this.height = canvas.height;
        this.superWidth = this.width * this.SUPER_SAMPLING_FACTOR;
        this.superHeight = this.height * this.SUPER_SAMPLING_FACTOR;
        this.programs = { compositor: null, brush: null };
        this.positionBuffer = null;
        this.texCoordBuffer = null;
        this.brushPositionBuffer = null;
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
        // ★修正★ 事前乗算済みアルファを扱うための標準的なブレンド関数に設定
        gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        this._initShaderPrograms();
        if (!this.programs.compositor || !this.programs.brush) {
            console.error("Failed to create all required WebGL programs.");
            this.gl = null;
            return;
        }
        this._initBuffers();
        this._setupSuperCompositingBuffer();
        console.log(`WebGL Engine (v6.0.1 COLOR & COORD FIX) initialized with ${this.superWidth}x${this.superHeight} internal resolution.`);
    }

    _initShaderPrograms() {
        const vsCompositor = `
            attribute vec4 a_position; 
            attribute vec2 a_texCoord;
            uniform mat4 u_mvpMatrix; 
            varying vec2 v_texCoord;
            void main() { 
                gl_Position = u_mvpMatrix * a_position;
                v_texCoord = a_texCoord; 
            }`;
        const fsCompositor = `
            precision highp float; varying vec2 v_texCoord;
            uniform sampler2D u_image; uniform float u_opacity;
            uniform vec2 u_source_resolution; uniform float u_sharpness;
            void main() {
                vec2 texel_size = 1.0 / u_source_resolution;
                vec4 color_smooth = vec4(0.0);
                color_smooth += texture2D(u_image, v_texCoord + texel_size * vec2(-0.5, -0.5));
                color_smooth += texture2D(u_image, v_texCoord + texel_size * vec2( 0.5, -0.5));
                color_smooth += texture2D(u_image, v_texCoord + texel_size * vec2( 0.5,  0.5));
                color_smooth += texture2D(u_image, v_texCoord + texel_size * vec2(-0.5,  0.5));
                color_smooth *= 0.25;
                vec4 color_original = texture2D(u_image, v_texCoord);
                vec4 final_color = mix(color_smooth, color_original, u_sharpness);
                // ★修正★ テクスチャは事前乗算済みなので、opacityをかけるだけでOK
                gl_FragColor = final_color * u_opacity;
            }`;

        // ブラシ描画用のシェーダー (core-engineから渡されるY-down座標をY-upに変換する)
        const vsBrush = `
            precision highp float; attribute vec2 a_position; 
            uniform vec2 u_resolution; uniform vec2 u_center; uniform float u_radius;
            varying vec2 v_texCoord;
            void main() {
                vec2 quad_size_pixels = vec2(u_radius * 2.0 + 4.0);
                vec2 quad_size_clip = quad_size_pixels / u_resolution * 2.0;
                
                vec2 center_clip = (u_center / u_resolution) * 2.0 - 1.0;
                
                // Y-down(左上原点)で渡された座標を、WebGLのクリップスペース(Y-up)に変換するために必須
                center_clip.y *= -1.0; 

                gl_Position = vec4(a_position * quad_size_clip + center_clip, 0.0, 1.0);
                v_texCoord = a_position + 0.5;
            }`;
        const fsBrush = `
            precision highp float; varying vec2 v_texCoord;
            uniform float u_radius; uniform vec4 u_color; uniform bool u_is_eraser;
            void main() {
                float dist = distance(v_texCoord, vec2(0.5));
                float pixel_in_uv = 1.0 / (max(u_radius, 0.5) * 2.0);
                float alpha = 1.0 - smoothstep(0.5 - pixel_in_uv, 0.5, dist);
                if (alpha < 0.01) { discard; }
                if (u_is_eraser) { 
                    gl_FragColor = vec4(0.0, 0.0, 0.0, alpha); // 消しゴムは黒のアルファとして出力
                } else { 
                    // ★修正★ 色とアルファを乗算した「事前乗算済みアルファ」で出力。ブレンド処理と一致させる。
                    gl_FragColor = vec4(u_color.rgb * u_color.a, u_color.a) * alpha; 
                }
            }`;
        this.programs.compositor = this._createProgram(vsCompositor, fsCompositor);
        this.programs.brush = this._createProgram(vsBrush, fsBrush);
    }
    
    _initBuffers() {
        const gl = this.gl;
        const w = this.width, h = this.height;
        const positions = [ 0, 0,  w, 0,  0, h,  0, h,  w, 0,  w, h ];
        this.positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
        const texCoords = [ 0, 0,  1, 0,  0, 1,  0, 1,  1, 0,  1, 1 ];
        this.texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);
        this.brushPositionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.brushPositionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([ -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5, -0.5 ]), gl.STATIC_DRAW);
    }

    _compileShader(source, type) { const gl = this.gl; const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader); if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { console.error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader)); gl.deleteShader(shader); return null; } return shader; }
    _createProgram(vsSource, fsSource) { const gl = this.gl; const vs = this._compileShader(vsSource, gl.VERTEX_SHADER); const fs = this._compileShader(fsSource, gl.FRAGMENT_SHADER); if (!vs || !fs) return null; const program = gl.createProgram(); gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program); if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { console.error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(program)); gl.deleteProgram(program); return null; } program.locations = {}; const locs = (p) => { p.locations.a_position = gl.getAttribLocation(p, 'a_position'); p.locations.a_texCoord = gl.getAttribLocation(p, 'a_texCoord'); p.locations.u_image = gl.getUniformLocation(p, 'u_image'); p.locations.u_opacity = gl.getUniformLocation(p, 'u_opacity'); p.locations.u_resolution = gl.getUniformLocation(p, 'u_resolution'); p.locations.u_center = gl.getUniformLocation(p, 'u_center'); p.locations.u_radius = gl.getUniformLocation(p, 'u_radius'); p.locations.u_color = gl.getUniformLocation(p, 'u_color'); p.locations.u_is_eraser = gl.getUniformLocation(p, 'u_is_eraser'); p.locations.u_source_resolution = gl.getUniformLocation(p, 'u_source_resolution'); p.locations.u_sharpness = gl.getUniformLocation(p, 'u_sharpness'); p.locations.u_mvpMatrix = gl.getUniformLocation(p, 'u_mvpMatrix'); }; locs(program); return program; }
    static isSupported() { try { const canvas = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))); } catch (e) { return false; } }

    _createOrUpdateLayerTexture(layer) {
        const gl = this.gl;
        let texture = this.layerTextures.get(layer);
        let fbo = this.layerFBOs.get(layer);
        
        // ★修正★ ここから2つの重要な設定を行います。
        // 1. ImageData(左上原点)をWebGLのテクスチャ(左下原点)に正しくマッピングするため、Y軸を反転させます。
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        // 2. ImageData(非乗算アルファ)を、WebGLでの合成に適した「事前乗算済みアルファ」に自動変換させます。これが赤化を防ぎます。
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);

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
            if (layer.imageData) {
                 const tempCanvas = document.createElement('canvas');
                 tempCanvas.width = this.superWidth; tempCanvas.height = this.superHeight;
                 const tempCtx = tempCanvas.getContext('2d');
                 const sourceCanvas = document.createElement('canvas');
                 sourceCanvas.width = layer.imageData.width; sourceCanvas.height = layer.imageData.height;
                 sourceCanvas.getContext('2d').putImageData(layer.imageData, 0, 0);
                 tempCtx.drawImage(sourceCanvas, 0, 0, this.superWidth, this.superHeight);
                 gl.bindTexture(gl.TEXTURE_2D, texture);
                 gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tempCanvas);
            }
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        }
        if (layer.gpuDirty) {
             const tempCanvas = document.createElement('canvas');
             tempCanvas.width = this.superWidth; tempCanvas.height = this.superHeight;
             const tempCtx = tempCtx.canvas.getContext('2d');
             tempCtx.imageSmoothingEnabled = true; tempCtx.imageSmoothingQuality = 'high';
             const sourceCanvas = document.createElement('canvas');
             sourceCanvas.width = layer.imageData.width; sourceCanvas.height = layer.imageData.height;
             sourceCanvas.getContext('2d').putImageData(layer.imageData, 0, 0);
             tempCtx.drawImage(sourceCanvas, 0, 0, this.superWidth, this.superHeight);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, tempCanvas);
            gl.bindTexture(gl.TEXTURE_2D, null);
            layer.gpuDirty = false;
        }
        
        // 設定を元に戻す
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    }
    
    _setupSuperCompositingBuffer() {
        const gl = this.gl;
        if (this.superCompositeFBO) gl.deleteFramebuffer(this.superCompositeFBO);
        if (this.superCompositeTexture) gl.deleteTexture(this.superCompositeTexture);
        this.superCompositeTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.superCompositeTexture);
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
            // 消しゴムは、描画先のアルファチャンネルのみを減算する
            gl.blendEquation(gl.FUNC_REVERSE_SUBTRACT); // Dst - Src
            gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ZERO, gl.ONE_MINUS_SRC_ALPHA);
        } else {
            gl.blendEquation(gl.FUNC_ADD); // Src + Dst
             // デフォルトは事前乗算アルファ用の加算合成 (Src*1 + Dst*(1-SrcA))
            gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA); 
            switch (blendMode) {
                case 'multiply': 
                    // 乗算 (Dst*Src + Dst*(1-SrcA)) = Dst * (Src + 1 - SrcA)
                    gl.blendFuncSeparate(gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA); 
                    break;
                case 'screen': 
                    // スクリーン (Src + Dst - Src*Dst) => (Src*1 + Dst*(1-Src))
                     gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_COLOR, gl.ONE, gl.ONE_MINUS_SRC_ALPHA); 
                    break;
                case 'add': // 加算 (リニア覆い焼き)
                     gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ONE, gl.ONE); 
                    break;
            }
        }
    }

    drawCircle(centerX, centerY, radius, color, isEraser, layer) {
        if (!this.gl || !this.programs.brush) return;
        const gl = this.gl; const program = this.programs.brush;
        this._createOrUpdateLayerTexture(layer);
        const targetFBO = this.layerFBOs.get(layer);
        if (!targetFBO) { return; }
        gl.bindFramebuffer(gl.FRAMEBUFFER, targetFBO);
        gl.viewport(0, 0, this.superWidth, this.superHeight);
        
        gl.useProgram(program);
        this._setBlendMode('normal', isEraser);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.brushPositionBuffer);
        gl.vertexAttribPointer(program.locations.a_position, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(program.locations.a_position);
        
        const superX = centerX * this.SUPER_SAMPLING_FACTOR;
        const superY = centerY * this.SUPER_SAMPLING_FACTOR;
        const superRadius = radius * this.SUPER_SAMPLING_FACTOR;
        
        gl.uniform2f(program.locations.u_resolution, this.superWidth, this.superHeight);
        gl.uniform2f(program.locations.u_center, superX, superY);
        gl.uniform1f(program.locations.u_radius, superRadius);
        gl.uniform4f(program.locations.u_color, color.r / 255, color.g / 255, color.b / 255, color.a / 255);
        gl.uniform1i(program.locations.u_is_eraser, isEraser);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    
    drawLine(x0, y0, x1, y1, size, color, isEraser, p0, p1, calculatePressureSize, layer) {
        if (!isFinite(x0) || !isFinite(y0) || !isFinite(x1) || !isFinite(y1)) return;
        const distance = Math.hypot(x1 - x0, y1 - y0);
        if (distance <= 0) {
            const adjustedSize = calculatePressureSize(size, p1);
            this.drawCircle(x1, y1, adjustedSize / 2, color, isEraser, layer);
            return;
        }

        const stepSize = Math.max(0.5, size / 4);
        const steps = Math.max(1, Math.ceil(distance / stepSize));
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = x0 + (x1 - x0) * t;
            const y = y0 + (y1 - y0) * t;
            const pressure = p0 + (p1 - p0) * t;
            const adjustedSize = calculatePressureSize(size, pressure);
            this.drawCircle(x, y, adjustedSize / 2, color, isEraser, layer);
        }
    }

    fill(imageData, color) { /* ... */ }
    clear(imageData) { /* ... */ }
    
    getTransformedImageData(layer) {
        const sourceImageData = layer.imageData;
        const transform = layer.transform;
        const canvas = this.transformOffscreenCanvas; const ctx = this.transformOffscreenCtx;
        const w = sourceImageData.width; const h = sourceImageData.height;
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
        
        ctx.save();
        ctx.clearRect(0, 0, w, h);
        
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = w; tempCanvas.height = h;
        tempCanvas.getContext('2d').putImageData(sourceImageData, 0, 0);

        const centerX = w / 2; const centerY = h / 2;
        ctx.translate(centerX + transform.x, centerY + transform.y);
        ctx.rotate(transform.rotation * Math.PI / 180);
        ctx.scale(transform.scale * transform.flipX, transform.scale * transform.flipY);
        ctx.translate(-centerX, -centerY);
        
        ctx.drawImage(tempCanvas, 0, 0);
        ctx.restore();
        
        return ctx.getImageData(0, 0, w, h);
    }

    compositeLayers(layers, compositionData, dirtyRect) {
        if (!this.gl || !this.programs.compositor || !this.superCompositeFBO) return;
        const gl = this.gl; const program = this.programs.compositor;
        for (const layer of layers) { this._createOrUpdateLayerTexture(layer); }
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.superCompositeFBO);
        gl.viewport(0, 0, this.superWidth, this.superHeight);
        
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
            gl.uniform2f(program.locations.u_source_resolution, this.superWidth, this.superHeight);
            gl.uniform1i(program.locations.u_image, 0);
            gl.uniform1f(program.locations.u_opacity, layer.opacity / 100.0);
            gl.uniform1f(program.locations.u_sharpness, 0.0);
            gl.uniformMatrix4fv(program.locations.u_mvpMatrix, false, layer.mvpMatrix);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        }
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.disableVertexAttribArray(program.locations.a_position);
        gl.disableVertexAttribArray(program.locations.a_texCoord);
    }
    
    renderToDisplay(compositionData, dirtyRect) {
        if (!this.gl || !this.superCompositeTexture) return;
        const gl = this.gl; const program = this.programs.compositor;
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        this._setBlendMode('normal');
        gl.useProgram(program);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.vertexAttribPointer(program.locations.a_position, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(program.locations.a_position);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.vertexAttribPointer(program.locations.a_texCoord, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(program.locations.a_texCoord);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.superCompositeTexture);
        gl.uniform2f(program.locations.u_source_resolution, this.superWidth, this.superHeight);
        gl.uniform1i(program.locations.u_image, 0);
        gl.uniform1f(program.locations.u_opacity, 1.0);
        gl.uniform1f(program.locations.u_sharpness, 0.7);
        
        const projection = glMatrix.mat4.create();
        glMatrix.mat4.ortho(projection, 0, this.width, this.height, 0, -1, 1);
        gl.uniformMatrix4fv(program.locations.u_mvpMatrix, false, projection);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
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
        const pixelBuffer = new Uint8Array(sWidth * sHeight * 4);
        gl.readPixels(sx, sy, sWidth, sHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixelBuffer);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        // ★修正★
        // ここでも、読みだした「事前乗算済みアルファ」を「非乗算」に戻します。
        // これにより、ImageDataとして正しく状態を保存できます。
        for (let i = 0; i < pixelBuffer.length; i += 4) {
            const a = pixelBuffer[i + 3];
            if (a > 0) { // アルファが0より大きいピクセルだけを処理
                const factor = 255.0 / a;
                pixelBuffer[i]   = Math.min(255, Math.round(pixelBuffer[i]   * factor));
                pixelBuffer[i+1] = Math.min(255, Math.round(pixelBuffer[i+1] * factor));
                pixelBuffer[i+2] = Math.min(255, Math.round(pixelBuffer[i+2] * factor));
            }
        }

        // 読みだしたデータはY-upなので、上下反転させてから2D Canvasで処理します。
        const flippedBuffer = new Uint8ClampedArray(sWidth * sHeight * 4);
        for (let y = 0; y < sHeight; y++) {
            const srcRowIndex = y;
            const destRowIndex = sHeight - 1 - y;
            const srcOffset = srcRowIndex * sWidth * 4;
            const destOffset = destRowIndex * sWidth * 4;
            flippedBuffer.set(pixelBuffer.subarray(srcOffset, srcOffset + sWidth * 4), destOffset);
        }
        
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = sWidth;
        tempCanvas.height = sHeight;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.putImageData(new ImageData(flippedBuffer, sWidth, sHeight), 0, 0);

        const targetImageData = layer.imageData;
        const targetCtx = document.createElement('canvas').getContext('2d');
        targetCtx.canvas.width = targetImageData.width;
        targetCtx.canvas.height = targetImageData.height;
        targetCtx.putImageData(targetImageData, 0, 0);

        const dx = Math.floor(dirtyRect.minX);
        const dy = Math.floor(dirtyRect.minY);
        const dWidth = Math.ceil(dirtyRect.maxX - dirtyRect.minX);
        const dHeight = Math.ceil(dirtyRect.maxY - dirtyRect.minY);
        
        targetCtx.clearRect(dx, dy, dWidth, dHeight);
        targetCtx.drawImage(tempCanvas, dx, dy, dWidth, dHeight);

        layer.imageData = targetCtx.getImageData(0, 0, targetImageData.width, targetImageData.height);
    }
}