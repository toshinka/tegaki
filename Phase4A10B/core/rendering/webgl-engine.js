/*
 * ===================================================================================
 * Toshinka Tegaki Tool - WebGL Engine
 * Version: 4.7.0 (Coordinate System FINAL FIX)
 *
 * - 修正：
 * - 1. 【ブラシシェーダーの座標系を統一】
 * -   - 前回の修正で唯一残ってしまっていた、ブラシ用頂点シェーダー内の
 * -     Y軸反転処理 (`center_clip.y *= -1.0;`) を完全に削除。
 * -   - これにより、レイヤー合成とブラシ描画を含む、すべてのWebGL処理が
 * -     ブラウザ標準の「Y-down（左上原点）」座標系に完全に統一された。
 * -     レイヤー移動・変形・描画時の上下反転と座標ズレがこれで完全に解消される。
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
        console.log(`WebGL Engine (v4.7.0 FINAL FIX) initialized with ${this.superWidth}x${this.superHeight} internal resolution.`);
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
                gl_FragColor = vec4(final_color.rgb, final_color.a * u_opacity);
            }`;

        // ★★★ 修正: ブラシ描画シェーダーのY軸反転処理を完全に削除 ★★★
        const vsBrush = `
            precision highp float; attribute vec2 a_position; 
            uniform vec2 u_resolution; uniform vec2 u_center; uniform float u_radius;
            varying vec2 v_texCoord;
            void main() {
                vec2 quad_size_pixels = vec2(u_radius * 2.0 + 4.0);
                vec2 quad_size_clip = quad_size_pixels / u_resolution * 2.0;
                
                // Y-down座標系（左上原点）を、-1.0〜+1.0のクリップスペースに正規化する
                vec2 center_clip = (u_center / u_resolution) * 2.0 - 1.0;
                
                // Y軸の反転は不要！ 全ての座標系がY-downに統一されたため。
                // center_clip.y *= -1.0; // ← この行を削除したことが最重要！

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
        const positions = [
            0, 0,
            w, 0,
            0, h,
            0, h,
            w, 0,
            w, h,
        ];
        this.positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

        const texCoords = [
            0, 0,
            1, 0,
            0, 1,
            0, 1,
            1, 0,
            1, 1,
        ];
        this.texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);

        this.brushPositionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.brushPositionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            -0.5, 0.5,
            -0.5, -0.5,
            0.5, 0.5,
            0.5, -0.5,
        ]), gl.STATIC_DRAW);
    }

    _compileShader(source, type) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader compile error:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    _createProgram(vsSource, fsSource) {
        const gl = this.gl;
        const program = gl.createProgram();
        const vertexShader = this._compileShader(vsSource, gl.VERTEX_SHADER);
        const fragmentShader = this._compileShader(fsSource, gl.FRAGMENT_SHADER);
        if (!vertexShader || !fragmentShader) return null;
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Program link error:', gl.getProgramInfoLog(program));
            gl.deleteProgram(program);
            return null;
        }
        return program;
    }

    _setupSuperCompositingBuffer() {
        const gl = this.gl;
        // Create a texture to render to
        this.superCompositeTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.superCompositeTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.superWidth, this.superHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        // Create a framebuffer and attach the texture
        this.superCompositeFBO = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.superCompositeFBO);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.superCompositeTexture, 0);

        // Check if the framebuffer is complete
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
            console.error("Framebuffer not complete!");
        }

        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    _updateLayerTexture(layer) {
        const gl = this.gl;
        let texture = this.layerTextures.get(layer.name);
        if (!texture) {
            texture = gl.createTexture();
            this.layerTextures.set(layer.name, texture);
        }

        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, layer.imageData);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    _renderLayerToFBO(layer, targetFBO) {
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, targetFBO);
        gl.viewport(0, 0, this.superWidth, this.superHeight);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(this.programs.compositor);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.layerTextures.get(layer.name));
        gl.uniform1i(gl.getUniformLocation(this.programs.compositor, 'u_image'), 0);
        gl.uniform1f(gl.getUniformLocation(this.programs.compositor, 'u_opacity'), layer.opacity / 100.0);
        gl.uniform2f(gl.getUniformLocation(this.programs.compositor, 'u_source_resolution'), layer.imageData.width, layer.imageData.height);
        gl.uniform1f(gl.getUniformLocation(this.programs.compositor, 'u_sharpness'), 1.0); // Adjust as needed

        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        const positionLocation = gl.getAttribLocation(this.programs.compositor, 'a_position');
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        const texCoordLocation = gl.getAttribLocation(this.programs.compositor, 'a_texCoord');
        gl.enableVertexAttribArray(texCoordLocation);
        gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

        // Apply layer transform matrix
        const mvpMatrixLocation = gl.getUniformLocation(this.programs.compositor, 'u_mvpMatrix');
        gl.uniformMatrix4fv(mvpMatrixLocation, false, layer.mvpMatrix);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }
    
    // --- DrawingEngineのインターフェース実装 ---
    drawCircle(centerX, centerY, radius, color, isEraser, layer) {
        const gl = this.gl;
        if (!gl) return;

        // Ensure layer has a texture and FBO
        let layerFBO = this.layerFBOs.get(layer.name);
        if (!layerFBO) {
            layerFBO = gl.createFramebuffer();
            gl.bindFramebuffer(gl.FRAMEBUFFER, layerFBO);
            let layerTexture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, layerTexture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.superWidth, this.superHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, layerTexture, 0);
            this.layerFBOs.set(layer.name, layerFBO);
            this.layerTextures.set(layer.name, layerTexture);
            gl.bindTexture(gl.TEXTURE_2D, null);
        } else {
            gl.bindFramebuffer(gl.FRAMEBUFFER, layerFBO);
        }
        
        gl.viewport(0, 0, this.superWidth, this.superHeight);
        gl.useProgram(this.programs.brush);

        const resolutionLocation = gl.getUniformLocation(this.programs.brush, 'u_resolution');
        gl.uniform2f(resolutionLocation, this.superWidth, this.superHeight);

        const centerLocation = gl.getUniformLocation(this.programs.brush, 'u_center');
        const brushX = centerX * this.SUPER_SAMPLING_FACTOR;
        const brushY = centerY * this.SUPER_SAMPLING_FACTOR; // Y-down already, no flip needed
        gl.uniform2f(centerLocation, brushX, brushY);

        const radiusLocation = gl.getUniformLocation(this.programs.brush, 'u_radius');
        gl.uniform1f(radiusLocation, radius * this.SUPER_SAMPLING_FACTOR);

        const colorLocation = gl.getUniformLocation(this.programs.brush, 'u_color');
        // Convert RGBA (0-255) to RGBA (0.0-1.0) and apply premultiplied alpha for drawing
        const r = color.r / 255.0;
        const g = color.g / 255.0;
        const b = color.b / 255.0;
        const a = color.a / 255.0;
        gl.uniform4f(colorLocation, r * a, g * a, b * a, a); // Premultiply color components

        const isEraserLocation = gl.getUniformLocation(this.programs.brush, 'u_is_eraser');
        gl.uniform1i(isEraserLocation, isEraser ? 1 : 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.brushPositionBuffer);
        const positionLocation = gl.getAttribLocation(this.programs.brush, 'a_position');
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null); // Unbind FBO
        layer.gpuDirty = true;
    }

    drawLine(x0, y0, x1, y1, size, color, isEraser, p0, p1, calculatePressureSize, layer) {
        // Simple line drawing by drawing multiple circles,
        // more sophisticated implementations might use line shaders.
        const gl = this.gl;
        if (!gl) return;

        let layerFBO = this.layerFBOs.get(layer.name);
        if (!layerFBO) {
            // If FBO doesn't exist, create it (similar to drawCircle)
            layerFBO = gl.createFramebuffer();
            gl.bindFramebuffer(gl.FRAMEBUFFER, layerFBO);
            let layerTexture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, layerTexture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.superWidth, this.superHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, layerTexture, 0);
            this.layerFBOs.set(layer.name, layerFBO);
            this.layerTextures.set(layer.name, layerTexture);
            gl.bindTexture(gl.TEXTURE_2D, null);
        } else {
            gl.bindFramebuffer(gl.FRAMEBUFFER, layerFBO);
        }

        gl.viewport(0, 0, this.superWidth, this.superHeight);
        gl.useProgram(this.programs.brush);

        const resolutionLocation = gl.getUniformLocation(this.programs.brush, 'u_resolution');
        gl.uniform2f(resolutionLocation, this.superWidth, this.superHeight);

        const radiusLocation = gl.getUniformLocation(this.programs.brush, 'u_radius');
        const colorLocation = gl.getUniformLocation(this.programs.brush, 'u_color');
        const isEraserLocation = gl.getUniformLocation(this.programs.brush, 'u_is_eraser');
        gl.uniform1i(isEraserLocation, isEraser ? 1 : 0);

        // Convert RGBA (0-255) to RGBA (0.0-1.0) and apply premultiplied alpha for drawing
        const r = color.r / 255.0;
        const g = color.g / 255.0;
        const b = color.b / 255.0;
        const a = color.a / 255.0;
        gl.uniform4f(colorLocation, r * a, g * a, b * a, a); // Premultiply color components


        gl.bindBuffer(gl.ARRAY_BUFFER, this.brushPositionBuffer);
        const positionLocation = gl.getAttribLocation(this.programs.brush, 'a_position');
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

        const dist = Math.sqrt(Math.pow(x1 - x0, 2) + Math.pow(y1 - y0, 2));
        const segments = Math.max(2, Math.ceil(dist / (size * 0.5))); // Draw more circles for longer lines

        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const currentX = x0 + (x1 - x0) * t;
            const currentY = y0 + (y1 - y0) * t;
            const currentPressure = p0 + (p1 - p0) * t;
            const currentRadius = calculatePressureSize(size, currentPressure) / 2;

            gl.uniform1f(radiusLocation, currentRadius * this.SUPER_SAMPLING_FACTOR);
            gl.uniform2f(gl.getUniformLocation(this.programs.brush, 'u_center'), currentX * this.SUPER_SAMPLING_FACTOR, currentY * this.SUPER_SAMPLING_FACTOR);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null); // Unbind FBO
        layer.gpuDirty = true;
    }

    fill(imageData, color) { throw new Error("Method 'fill()' must be implemented."); }
    clear(imageData) { throw new Error("Method 'clear()' must be implemented."); }
    
    getTransformedImageData(sourceImageData, transform) {
        const gl = this.gl;
        if (!gl) return sourceImageData;

        this.transformOffscreenCanvas.width = sourceImageData.width;
        this.transformOffscreenCanvas.height = sourceImageData.height;
        this.transformOffscreenCtx.clearRect(0, 0, this.transformOffscreenCanvas.width, this.transformOffscreenCanvas.height);
        this.transformOffscreenCtx.putImageData(sourceImageData, 0, 0);

        // Create a temporary texture from the sourceImageData
        const tempTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tempTexture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); // ImageData is already Y-down
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.transformOffscreenCanvas);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        // Create a temporary FBO to render the transformed image to
        const tempFBO = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, tempFBO);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tempTexture, 0);

        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
            console.error("Temporary Framebuffer not complete!");
            gl.deleteTexture(tempTexture);
            gl.deleteFramebuffer(tempFBO);
            return sourceImageData;
        }

        gl.viewport(0, 0, sourceImageData.width, sourceImageData.height);
        gl.useProgram(this.programs.compositor);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tempTexture);
        gl.uniform1i(gl.getUniformLocation(this.programs.compositor, 'u_image'), 0);
        gl.uniform1f(gl.getUniformLocation(this.programs.compositor, 'u_opacity'), 1.0);
        gl.uniform2f(gl.getUniformLocation(this.programs.compositor, 'u_source_resolution'), sourceImageData.width, sourceImageData.height);
        gl.uniform1f(gl.getUniformLocation(this.programs.compositor, 'u_sharpness'), 1.0);

        // Create a matrix for the transformation
        const matrix = glMatrix.mat4.create();
        glMatrix.mat4.identity(matrix);
        // Translate to origin, scale, rotate, translate back
        glMatrix.mat4.translate(matrix, matrix, [sourceImageData.width / 2, sourceImageData.height / 2, 0]);
        glMatrix.mat4.rotateZ(matrix, matrix, glMatrix.glMatrix.toRadian(transform.rotation));
        glMatrix.mat4.scale(matrix, matrix, [transform.scale * transform.flipX, transform.scale * transform.flipY, 1]);
        glMatrix.mat4.translate(matrix, matrix, [-sourceImageData.width / 2, -sourceImageData.height / 2, 0]);
        glMatrix.mat4.translate(matrix, matrix, [transform.x, transform.y, 0]);

        // Orthographic projection for 2D
        const orthoMatrix = glMatrix.mat4.create();
        glMatrix.mat4.ortho(orthoMatrix, 0, sourceImageData.width, sourceImageData.height, 0, -1, 1); // Y-down projection

        const finalMatrix = glMatrix.mat4.create();
        glMatrix.mat4.multiply(finalMatrix, orthoMatrix, matrix);

        gl.uniformMatrix4fv(gl.getUniformLocation(this.programs.compositor, 'u_mvpMatrix'), false, finalMatrix);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        const positionLocation = gl.getAttribLocation(this.programs.compositor, 'a_position');
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        const texCoordLocation = gl.getAttribLocation(this.programs.compositor, 'a_texCoord');
        gl.enableVertexAttribArray(texCoordLocation);
        gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // Read pixels back from the FBO
        const pixels = new Uint8Array(sourceImageData.width * sourceImageData.height * 4);
        gl.readPixels(0, 0, sourceImageData.width, sourceImageData.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

        // Clean up
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.deleteTexture(tempTexture);
        gl.deleteFramebuffer(tempFBO);

        return new ImageData(new Uint8ClampedArray(pixels), sourceImageData.width, sourceImageData.height);
    }
    
    compositeLayers(layers, compositionData, dirtyRect) {
        const gl = this.gl;
        if (!gl) return;

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.superCompositeFBO);
        gl.viewport(0, 0, this.superWidth, this.superHeight);
        gl.clear(gl.COLOR_BUFFER_BIT);

        layers.forEach(layer => {
            if (!layer.visible || layer.opacity === 0) return;

            // If the layer is dirty, render its content to its FBO first
            if (layer.gpuDirty) {
                this._renderLayerToFBO(layer, this.layerFBOs.get(layer.name));
                layer.gpuDirty = false;
            }

            gl.useProgram(this.programs.compositor);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.layerTextures.get(layer.name));
            gl.uniform1i(gl.getUniformLocation(this.programs.compositor, 'u_image'), 0);
            gl.uniform1f(gl.getUniformLocation(this.programs.compositor, 'u_opacity'), layer.opacity / 100.0);
            gl.uniform2f(gl.getUniformLocation(this.programs.compositor, 'u_source_resolution'), this.superWidth, this.superHeight); // Use super resolution for compositing
            gl.uniform1f(gl.getUniformLocation(this.programs.compositor, 'u_sharpness'), 1.0);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
            const positionLocation = gl.getAttribLocation(this.programs.compositor, 'a_position');
            gl.enableVertexAttribArray(positionLocation);
            gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
            const texCoordLocation = gl.getAttribLocation(this.programs.compositor, 'a_texCoord');
            gl.enableVertexAttribArray(texCoordLocation);
            gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

            gl.uniformMatrix4fv(gl.getUniformLocation(this.programs.compositor, 'u_mvpMatrix'), false, layer.mvpMatrix);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            gl.bindTexture(gl.TEXTURE_2D, null);
        });

        // Read back the relevant portion of the super-sampled composite image
        const sx = Math.floor(dirtyRect.minX * this.SUPER_SAMPLING_FACTOR);
        const sy = Math.floor(dirtyRect.minY * this.SUPER_SAMPLING_FACTOR);
        const sWidth = Math.ceil((dirtyRect.maxX - dirtyRect.minX) * this.SUPER_SAMPLING_FACTOR);
        const sHeight = Math.ceil((dirtyRect.maxY - dirtyRect.minY) * this.SUPER_SAMPLING_FACTOR);
        
        if (sWidth <= 0 || sHeight <= 0) return;
        
        // 2. FBOからピクセルデータを読み出し
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.superCompositeFBO);
        const pixelBuffer = new Uint8Array(sWidth * sHeight * 4);
        
        // WebGLの内部描画はY-downに統一されているため、gl.readPixelsのy座標のみ調整し、
        // 後続のY軸反転ループは削除する。
        const webglY = this.superHeight - sy - sHeight;
        gl.readPixels(sx, webglY, sWidth, sHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixelBuffer);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        // 3. Canvas2DへのputImageData用にImageDataを作成
        // pixelBufferは既に適切な順序（Y-down）で、premultiplied alpha形式になっている想定。
        // 以前のY軸反転処理と乗算済みアルファ解除のロジックは、
        // 全ての座標系がY-downに統一され、かつWebGLコンテキストがpremultipliedAlpha: trueで初期化されているため不要。
        // これらが画像の色のズレや上下反転の原因となっていた。
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = sWidth;
        tempCanvas.height = sHeight;
        const tempCtx = tempCanvas.getContext('2d');
        const tempData = new ImageData(new Uint8ClampedArray(pixelBuffer), sWidth, sHeight);
        tempCtx.putImageData(tempData, 0, 0);

        const targetImageData = compositionData; // compositionDataを直接更新する
        const targetCanvas = document.createElement('canvas');
        targetCanvas.width = targetImageData.width;
        targetCanvas.height = targetImageData.height;
        const targetCtx = targetCanvas.getContext('2d');
        
        targetCtx.putImageData(targetImageData, 0, 0);
        
        const dx = Math.floor(dirtyRect.minX);
        const dy = Math.floor(dirtyRect.minY);
        const dWidth = Math.ceil(dirtyRect.maxX - dirtyRect.minX);
        const dHeight = Math.ceil(dirtyRect.maxY - dirtyRect.minY);
        
        // Render the super-sampled dirty rectangle onto the targetCanvas (at normal resolution)
        targetCtx.clearRect(dx, dy, dWidth, dHeight);
        targetCtx.drawImage(tempCanvas, 0, 0, sWidth, sHeight, dx, dy, dWidth, dHeight);

        // Copy the updated pixels back to targetImageData
        const updatedImageData = targetCtx.getImageData(dx, dy, dWidth, dHeight);
        for (let y = 0; y < dHeight; y++) {
            for (let x = 0; x < dWidth; x++) {
                const targetIdx = ((dy + y) * targetImageData.width + (dx + x)) * 4;
                const sourceIdx = (y * dWidth + x) * 4;
                targetImageData.data[targetIdx] = updatedImageData.data[sourceIdx];
                targetImageData.data[targetIdx + 1] = updatedImageData.data[sourceIdx + 1];
                targetImageData.data[targetIdx + 2] = updatedImageData.data[sourceIdx + 2];
                targetImageData.data[targetIdx + 3] = updatedImageData.data[sourceIdx + 3];
            }
        }
    }

    renderToDisplay(compositionData) {
        const displayCtx = this.canvas.getContext('2d');
        displayCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        displayCtx.putImageData(compositionData, 0, 0);
    }

    syncDirtyRectToImageData(layer, dirtyRect) {
        const gl = this.gl;
        if (!gl || !this.layerFBOs.has(layer.name)) return;

        const fbo = this.layerFBOs.get(layer.name);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

        const sx = Math.floor(dirtyRect.minX * this.SUPER_SAMPLING_FACTOR);
        const sy = Math.floor(dirtyRect.minY * this.SUPER_SAMPLING_FACTOR);
        const sWidth = Math.ceil((dirtyRect.maxX - dirtyRect.minX) * this.SUPER_SAMPLING_FACTOR);
        const sHeight = Math.ceil((dirtyRect.maxY - dirtyRect.minY) * this.SUPER_SAMPLING_FACTOR);

        if (sWidth <= 0 || sHeight <= 0) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            return;
        }

        const pixelBuffer = new Uint8Array(sWidth * sHeight * 4);
        const webglY = this.superHeight - sy - sHeight; // Y-down adjustment for gl.readPixels
        gl.readPixels(sx, webglY, sWidth, sHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixelBuffer);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        // No Y-flip or unpremultiply needed here either.
        // The pixelBuffer should be directly usable for ImageData.

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = sWidth;
        tempCanvas.height = sHeight;
        const tempCtx = tempCanvas.getContext('2d');
        const tempData = new ImageData(new Uint8ClampedArray(pixelBuffer), sWidth, sHeight);
        tempCtx.putImageData(tempData, 0, 0);

        const dx = Math.floor(dirtyRect.minX);
        const dy = Math.floor(dirtyRect.minY);
        const dWidth = Math.ceil(dirtyRect.maxX - dirtyRect.minX);
        const dHeight = Math.ceil(dirtyRect.maxY - dirtyRect.minY);

        const layerCanvas = document.createElement('canvas');
        layerCanvas.width = layer.imageData.width;
        layerCanvas.height = layer.imageData.height;
        const layerCtx = layerCanvas.getContext('2d');
        layerCtx.putImageData(layer.imageData, 0, 0); // Start with current layer imageData

        // Draw the super-sampled dirty rectangle back to the layerCanvas
        layerCtx.clearRect(dx, dy, dWidth, dHeight);
        layerCtx.drawImage(tempCanvas, 0, 0, sWidth, sHeight, dx, dy, dWidth, dHeight);

        // Update the layer's imageData with the new pixels
        const updatedImageData = layerCtx.getImageData(dx, dy, dWidth, dHeight);
        for (let y = 0; y < dHeight; y++) {
            for (let x = 0; x < dWidth; x++) {
                const targetIdx = ((dy + y) * layer.imageData.width + (dx + x)) * 4;
                const sourceIdx = (y * dWidth + x) * 4;
                layer.imageData.data[targetIdx] = updatedImageData.data[sourceIdx];
                layer.imageData.data[targetIdx + 1] = updatedImageData.data[sourceIdx + 1];
                layer.imageData.data[targetIdx + 2] = updatedImageData.data[sourceIdx + 2];
                layer.imageData.data[targetIdx + 3] = updatedImageData.data[sourceIdx + 3];
            }
        }
    }
}