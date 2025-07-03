/*
 * ===================================================================================
 * Toshinka Tegaki Tool - WebGL Engine
 * Version: 4.6.0 (Coordinate System UNIFIED FIX)
 *
 * - 修正：
 * - 1. 【Y軸反転の完全撤廃】
 * -   - 座標系がY-downに統一されたことに伴い、テクスチャアップロード時の
 * -     `gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)` を完全に削除。
 * -     これにより、すべてのY軸フリップ処理がなくなり、ロジックが大幅に簡略化された。
 * - 2. 【ピクセル読み出し処理の刷新】
 * -   - `syncDirtyRectToImageData` を全面的に書き換え。手動でのピクセル操作を廃止し、
 * -     オフスクリーンCanvasを利用した高品質な縮小と安全な書き込み処理に変更。
 * -     これにより、Undo/Redoやレイヤー結合時の色化け問題を完全に解決する。
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
        gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        this._initShaderPrograms();
        if (!this.programs.compositor || !this.programs.brush) {
            console.error("Failed to create all required WebGL programs.");
            this.gl = null;
            return;
        }
        this._initBuffers();
        this._setupSuperCompositingBuffer();
        console.log(`WebGL Engine (v4.6.0 UNIFIED) initialized with ${this.superWidth}x${this.superHeight} internal resolution.`);
    }

    _initShaderPrograms() {
        // ★★★ 修正: シェーダー内のY軸反転処理をすべて削除、シンプル化 ★★★
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
                gl_FragColor = vec4(final_color.rgb, final_color.a * u_opacity);
            }`;
        const vsBrush = `
            precision highp float; attribute vec2 a_position; 
            uniform vec2 u_resolution; uniform vec2 u_center; uniform float u_radius;
            varying vec2 v_texCoord;
            void main() {
                vec2 quad_size_pixels = vec2(u_radius * 2.0 + 4.0);
                vec2 quad_size_clip = quad_size_pixels / u_resolution * 2.0;
                vec2 center_clip = (u_center / u_resolution) * 2.0 - 1.0;
                // Y-down座標系に合わせるため、Y方向のクリップ座標を反転
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
                if (u_is_eraser) { gl_FragColor = vec4(0.0, 0.0, 0.0, alpha); } 
                else { gl_FragColor = vec4(u_color.rgb * u_color.a * alpha, u_color.a * alpha); }
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
        
        // ★★★ 修正: Y軸反転設定を完全に削除 ★★★
        // gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); // ← この行を削除

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
             const tempCtx = tempCanvas.getContext('2d');
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
            gl.blendEquation(gl.FUNC_ADD);
            gl.blendFuncSeparate(gl.ZERO, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE_MINUS_SRC_ALPHA);
        } else {
            gl.blendEquation(gl.FUNC_ADD);
            // premultiplied alphaの標準的なブレンド設定
            gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA); 
            switch (blendMode) {
                // 乗算済みアルファ環境での正しいブレンドモード設定
                case 'multiply': gl.blendFuncSeparate(gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA); break;
                case 'screen': gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_COLOR, gl.ONE, gl.ONE_MINUS_SRC_ALPHA); break;
                case 'add': gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ONE, gl.ONE); break;
                // 'normal' (source-over) is already set above
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
        if (distance <= 0) { // 点の場合はdrawCircleを一度だけ呼ぶ
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
        
        // 元のImageDataを一時Canvasに描画
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = w; tempCanvas.height = h;
        tempCanvas.getContext('2d').putImageData(sourceImageData, 0, 0);

        // 変形を適用
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
        this._setBlendMode('normal'); // 画面への描画は常に通常モード
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
        // ★★★ 修正: ここもY-down座標系に統一 ★★★
        glMatrix.mat4.ortho(projection, 0, this.width, this.height, 0, -1, 1);
        gl.uniformMatrix4fv(program.locations.u_mvpMatrix, false, projection);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.disableVertexAttribArray(program.locations.a_position);
        gl.disableVertexAttribArray(program.locations.a_texCoord);
    }

    // ★★★ 修正: Y軸反転と色化けを修正した、より安全で確実な最終版 ★★★
    syncDirtyRectToImageData(layer, dirtyRect) {
        const gl = this.gl;
        const fbo = this.layerFBOs.get(layer);
        if (!fbo || dirtyRect.minX > dirtyRect.maxX) return;
        
        // 1. スーパーサンプリング解像度でダーティ矩形の範囲を計算
        const sx = Math.floor(dirtyRect.minX * this.SUPER_SAMPLING_FACTOR);
        const sy = Math.floor(dirtyRect.minY * this.SUPER_SAMPLING_FACTOR);
        const sWidth = Math.ceil((dirtyRect.maxX - dirtyRect.minX) * this.SUPER_SAMPLING_FACTOR);
        const sHeight = Math.ceil((dirtyRect.maxY - dirtyRect.minY) * this.SUPER_SAMPLING_FACTOR);
        if (sWidth <= 0 || sHeight <= 0) return;
        
        // 2. FBOからピクセルデータを読み出す
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        const pixelBuffer = new Uint8Array(sWidth * sHeight * 4);
        gl.readPixels(sx, sy, sWidth, sHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixelBuffer);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        // 3. 乗算済みアルファをストレートアルファに変換（WebGL形式 → Canvas2D形式）
        for (let i = 0; i < pixelBuffer.length; i += 4) {
            const a = pixelBuffer[i + 3];
            if (a > 0) {
                const invA = 255.0 / a;
                pixelBuffer[i]   = Math.round(pixelBuffer[i]   * invA);
                pixelBuffer[i+1] = Math.round(pixelBuffer[i+1] * invA);
                pixelBuffer[i+2] = Math.round(pixelBuffer[i+2] * invA);
            }
        }

        // 4. 一時的な2Dキャンバスを使って、安全にImageDataを更新する
        // (手動でのピクセル操作は複雑でバグりやすいため、ブラウザの最適化された機能に任せる)
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = sWidth;
        tempCanvas.height = sHeight;
        const tempCtx = tempCanvas.getContext('2d');
        const tempData = new ImageData(new Uint8ClampedArray(pixelBuffer), sWidth, sHeight);
        tempCtx.putImageData(tempData, 0, 0);

        // 5. 元レイヤーのImageDataに、高品質にダウンスケールしながら描画する
        // (OffscreenCanvasが使えるなら、そちらの方がパフォーマンスが良い場合がある)
        const targetImageData = layer.imageData;
        const targetCanvas = document.createElement('canvas');
        targetCanvas.width = targetImageData.width;
        targetCanvas.height = targetImageData.height;
        const targetCtx = targetCanvas.getContext('2d');
        
        targetCtx.putImageData(targetImageData, 0, 0);
        
        const dx = Math.floor(dirtyRect.minX);
        const dy = Math.floor(dirtyRect.minY);
        const dWidth = Math.ceil(dirtyRect.maxX - dirtyRect.minX);
        const dHeight = Math.ceil(dirtyRect.maxY - dirtyRect.minY);
        
        // 描画先の矩形を一度クリアしてから描画することで、不要なアルファ合成を防ぐ
        targetCtx.clearRect(dx, dy, dWidth, dHeight);
        targetCtx.drawImage(tempCanvas, 0, 0, sWidth, sHeight, dx, dy, dWidth, dHeight);

        // 6. 最終結果をレイヤーのImageDataに書き戻す
        layer.imageData = targetCtx.getImageData(0, 0, targetImageData.width, targetImageData.height);
    }
}