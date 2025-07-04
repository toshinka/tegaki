/*
 * ===================================================================================
 * Toshinka Tegaki Tool - WebGL Engine
 * Version: 3.1.0 (Phase 4A9: WebGL Layer Movement)
 *
 * - 修正：
 * - 1. レイヤー合成にMVP (Model-View-Projection) 行列を導入。
 * -   各レイヤーは自身のmodelMatrixを持ち、cameraのviewMatrixとprojectionMatrixと結合して描画。
 * - 2. ブラシ描画にPV (Projection-View) 行列を導入。
 * -   ブラシ描画はレイヤーのmodelMatrixの影響を受けず、カメラ移動のみに追従。
 * - 3. レイヤーへの直接描画のためのFBO管理を強化。
 * -   compositeFBOは全レイヤー合成用、各layerFBOは個々のレイヤーへのブラシ描画用。
 * - 4. アルファブレンド設定を事前乗算アルファに対応するgl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)に変更。
 * ===================================================================================
 */
import { DrawingEngine } from './drawing-engine.js';

// Assume gl-matrix is loaded globally

export class WebGLEngine extends DrawingEngine {
    constructor(canvas) {
        super(canvas);
        this.gl = null;
        
        this.SUPER_SAMPLING_FACTOR = 2.0;

        this.width = canvas.width;
        this.height = canvas.height;
        this.superWidth = this.width * this.SUPER_SAMPLING_FACTOR;
        this.superHeight = this.height * this.SUPER_SAMPLING_FACTOR;
        
        // Added 'display' program for final output
        this.programs = { compositor: null, brush: null, display: null }; 
        this.positionBuffer = null;
        this.texCoordBuffer = null;
        this.brushPositionBuffer = null; // Buffer for drawing brush quads
        
        this.superCompositeTexture = null;
        this.superCompositeFBO = null; // FBO for combining all layers at super-resolution
        
        this.layerTextures = new Map(); // Stores WebGL texture for each Layer object
        this.layerFBOs = new Map();     // Stores WebGL FBO for each Layer object (for direct drawing)

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
        // Alpha blending for pre-multiplied alpha. Crucial for correct transparency.
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); 

        this._initShaderPrograms();
        if (!this.programs.compositor || !this.programs.brush || !this.programs.display) {
            console.error("Failed to create all required WebGL programs.");
            this.gl = null;
            return;
        }

        this._initBuffers();
        this._setupSuperCompositingBuffer(); // This is the FBO where all layers are composed at super resolution

        console.log(`WebGL Engine (v3.1.0 WebGL Layer Movement) initialized with ${this.superWidth}x${this.superHeight} internal resolution.`);
    }

    _initShaderPrograms() {
        const gl = this.gl;

        // --- Compositor Shader (for combining layers with MVP) ---
        // This shader applies the MVP matrix to draw each layer.
        const vsCompositor = `
            attribute vec4 a_position;
            attribute vec2 a_texCoord;
            uniform mat4 u_mvpMatrix; // Model-View-Projection matrix
            varying vec2 v_texCoord;
            void main() {
                gl_Position = u_mvpMatrix * a_position;
                v_texCoord = a_texCoord;
            }`;
        const fsCompositor = `
            precision mediump float;
            varying vec2 v_texCoord;
            uniform sampler2D u_image;
            uniform float u_opacity;
            void main() {
                vec4 texColor = texture2D(u_image, v_texCoord);
                // Apply opacity to pre-multiplied alpha color
                gl_FragColor = vec4(texColor.rgb, texColor.a * u_opacity);
            }`;
        this.programs.compositor = this._createProgram(vsCompositor, fsCompositor);
        this.programs.compositor.uniformLocations = {
            mvpMatrix: gl.getUniformLocation(this.programs.compositor, 'u_mvpMatrix'),
            image: gl.getUniformLocation(this.programs.compositor, 'u_image'),
            opacity: gl.getUniformLocation(this.programs.compositor, 'u_opacity'),
        };

        // --- Brush Shader (for drawing strokes) ---
        // This shader draws a circle/brush stroke. It uses the PV matrix
        // to render in world coordinates, unaffected by layer's model matrix.
        const vsBrush = `
            attribute vec2 a_position; 
            uniform mat4 u_pvMatrix; // Projection-View matrix
            uniform vec2 u_center;   // World coordinates of brush center
            uniform float u_radius;  // Brush radius in world units
            varying vec2 v_texCoord;

            void main() {
                // Generate a quad around the brush center, scaled by radius
                // a_position is a unit quad (-1 to 1)
                vec2 pos = a_position * u_radius + u_center; 
                gl_Position = u_pvMatrix * vec4(pos, 0.0, 1.0);
                v_texCoord = a_position * 0.5 + 0.5; // Map from [-1, 1] to [0, 1] for brush texture lookup (if any)
            }`;

        const fsBrush = `
            precision highp float;
            varying vec2 v_texCoord;
            uniform float u_radius;
            uniform vec4 u_color; // Color (pre-multiplied alpha expected)
            uniform bool u_is_eraser;

            void main() {
                // Calculate distance from center (0.5, 0.5) for circular brush shape
                float dist = distance(v_texCoord, vec2(0.5));
                // Smoothly fade out alpha towards the edge (anti-aliasing)
                float alpha = 1.0 - smoothstep(0.4, 0.5, dist); // Softer edge
                
                if (alpha < 0.01) { // Discard very transparent fragments
                    discard;
                }
                if (u_is_eraser) {
                    // For erasing, output transparent black. The blending function
                    // (gl.ONE, gl.ONE_MINUS_SRC_ALPHA) will correctly clear pixels.
                    gl_FragColor = vec4(0.0, 0.0, 0.0, alpha); 
                } else {
                    // Output pre-multiplied alpha color
                    gl_FragColor = vec4(u_color.rgb * u_color.a * alpha, u_color.a * alpha);
                }
            }`;
        this.programs.brush = this._createProgram(vsBrush, fsBrush);
        this.programs.brush.uniformLocations = {
            pvMatrix: gl.getUniformLocation(this.programs.brush, 'u_pvMatrix'),
            center: gl.getUniformLocation(this.programs.brush, 'u_center'),
            radius: gl.getUniformLocation(this.programs.brush, 'u_radius'),
            color: gl.getUniformLocation(this.programs.brush, 'u_color'),
            isEraser: gl.getUniformLocation(this.programs.brush, 'u_is_eraser'),
        };

        // --- Display Shader (for downsampling super-composite to display) ---
        // This shader is used for the final render from the high-resolution composite FBO to the low-resolution display canvas.
        const vsDisplay = `
            attribute vec4 a_position;
            attribute vec2 a_texCoord;
            varying vec2 v_texCoord;
            void main() {
                gl_Position = a_position; // Render full screen quad (NDC)
                v_texCoord = a_texCoord;
            }`;
        const fsDisplay = `
            precision highp float;
            varying vec2 v_texCoord;
            uniform sampler2D u_image;
            uniform float u_opacity; // Kept for consistency, usually 1.0 for final display
            uniform vec2 u_source_resolution; // Size of the super-sampled composite texture

            void main() {
                // Manual bilinear filtering/box filter for high-quality downsampling
                vec2 texel_size = 1.0 / u_source_resolution;
                vec4 color = vec4(0.0);
                
                // Sample 4 neighboring texels and average them
                color += texture2D(u_image, v_texCoord + texel_size * vec2(-0.25, -0.25));
                color += texture2D(u_image, v_texCoord + texel_size * vec2( 0.25, -0.25));
                color += texture2D(u_image, v_texCoord + texel_size * vec2( 0.25,  0.25));
                color += texture2D(u_image, v_texCoord + texel_size * vec2(-0.25,  0.25));
                color *= 0.25; // Average the colors

                gl_FragColor = vec4(color.rgb, color.a * u_opacity);
            }`;
        this.programs.display = this._createProgram(vsDisplay, fsDisplay);
        this.programs.display.uniformLocations = {
            image: gl.getUniformLocation(this.programs.display, 'u_image'),
            opacity: gl.getUniformLocation(this.programs.display, 'u_opacity'),
            source_resolution: gl.getUniformLocation(this.programs.display, 'u_source_resolution'),
        };
    }

    _initBuffers() {
        const gl = this.gl;

        // Quad for drawing textures (layers, composite) - Full screen quad in NDC
        this.positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        const positions = [
            -1.0, 1.0,  // Top-left
            -1.0, -1.0, // Bottom-left
            1.0, 1.0,   // Top-right
            1.0, -1.0   // Bottom-right
        ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

        this.texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        const texCoords = [
            0.0, 1.0, // Top-left (V-inverted for texture)
            0.0, 0.0, // Bottom-left
            1.0, 1.0, // Top-right
            1.0, 0.0  // Bottom-right
        ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);

        // Quad for brush drawing - a unit quad that will be scaled and translated by the shader
        this.brushPositionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.brushPositionBuffer);
        const brushPositions = [
            -1.0, -1.0, // Bottom-left
            1.0, -1.0,  // Bottom-right
            -1.0, 1.0,  // Top-left
            1.0, 1.0    // Top-right
        ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(brushPositions), gl.STATIC_DRAW);
    }

    _createShader(type, source) {
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
        const vertexShader = this._createShader(gl.VERTEX_SHADER, vsSource);
        const fragmentShader = this._createShader(gl.FRAGMENT_SHADER, fsSource);
        if (!vertexShader || !fragmentShader) return null;

        const program = gl.createProgram();
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

        this.superCompositeFBO = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.superCompositeFBO);

        this.superCompositeTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.superCompositeTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.superWidth, this.superHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.superCompositeTexture, 0);

        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
            console.error("Super-sampling FBO not complete!");
            this.gl = null; // Invalidate GL context if FBO setup fails
            return;
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    // Get or create texture for a layer, updating it if dirty
    _getLayerTexture(layer) {
        const gl = this.gl;
        let texture = this.layerTextures.get(layer);
        if (!texture) {
            texture = gl.createTexture();
            this.layerTextures.set(layer, texture);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, layer.imageData.width, layer.imageData.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, layer.imageData.data);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        } else if (layer.gpuDirty) {
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, layer.imageData.width, layer.imageData.height, gl.RGBA, gl.UNSIGNED_BYTE, layer.imageData.data);
            layer.gpuDirty = false;
        }
        return texture;
    }

    // Get or create FBO for a layer to enable direct drawing onto its texture
    _getLayerFBO(layer) {
        const gl = this.gl;
        let fbo = this.layerFBOs.get(layer);
        if (!fbo) {
            fbo = gl.createFramebuffer();
            this.layerFBOs.set(layer, fbo);
            gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
            const texture = this._getLayerTexture(layer); // Ensure texture exists
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
            if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
                console.error("Layer FBO not complete for", layer.name);
                return null;
            }
            gl.bindFramebuffer(gl.FRAMEBUFFER, null); // Unbind immediately
        }
        return fbo;
    }

    // Bind the super-sampling composite FBO as the current render target
    bindSuperCompositeFramebuffer() {
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.superCompositeFBO);
        gl.viewport(0, 0, this.superWidth, this.superHeight);
    }

    // Unbind the super-sampling composite FBO, restoring default framebuffer (screen)
    unbindSuperCompositeFramebuffer() {
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, this.width, this.height);
    }

    // Composite a single layer onto the currently bound FBO (which is superCompositeFBO)
    compositeLayer(layer, mvpMatrix) {
        const gl = this.gl;
        gl.useProgram(this.programs.compositor);

        gl.uniformMatrix4fv(this.programs.compositor.uniformLocations.mvpMatrix, false, mvpMatrix);
        gl.uniform1f(this.programs.compositor.uniformLocations.opacity, layer.opacity / 100.0);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this._getLayerTexture(layer));
        gl.uniform1i(this.programs.compositor.uniformLocations.image, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        const positionLocation = gl.getAttribLocation(this.programs.compositor, 'a_position');
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        const texCoordLocation = gl.getAttribLocation(this.programs.compositor, 'a_texCoord');
        gl.enableVertexAttribArray(texCoordLocation);
        gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    // Renders the super-sampled composite texture to the display canvas
    renderToDisplay() {
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, null); // Draw to screen
        gl.viewport(0, 0, this.width, this.height); // Set viewport to display resolution
        gl.clearColor(0.0, 0.0, 0.0, 0.0); // Clear with transparent
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(this.programs.display);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.superCompositeTexture); // Use the super-sampled composite
        gl.uniform1i(this.programs.display.uniformLocations.image, 0);
        gl.uniform1f(this.programs.display.uniformLocations.opacity, 1.0); // Full opacity for final display
        gl.uniform2f(this.programs.display.uniformLocations.source_resolution, this.superWidth, this.superHeight);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        const positionLocation = gl.getAttribLocation(this.programs.display, 'a_position');
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        const texCoordLocation = gl.getAttribLocation(this.programs.display, 'a_texCoord');
        gl.enableVertexAttribArray(texCoordLocation);
        gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    // Draws a circle (brush stroke) directly to a target layer's FBO using the PV matrix
    drawCircle(x, y, radius, color, isEraser, targetLayer, projectionMatrix, viewMatrix) {
        const gl = this.gl;
        const layerFBO = this._getLayerFBO(targetLayer);
        if (!layerFBO) {
            console.error("Failed to get FBO for target layer:", targetLayer.name);
            return;
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, layerFBO);
        // Set viewport to the layer's actual pixel dimensions
        gl.viewport(0, 0, targetLayer.imageData.width, targetLayer.imageData.height);

        gl.useProgram(this.programs.brush);

        // Calculate Projection * View matrix for the brush
        const pvMatrix = mat4.create();
        mat4.multiply(pvMatrix, projectionMatrix, viewMatrix);

        gl.uniformMatrix4fv(this.programs.brush.uniformLocations.pvMatrix, false, pvMatrix);
        gl.uniform2f(this.programs.brush.uniformLocations.center, x, y);
        gl.uniform1f(this.programs.brush.uniformLocations.radius, radius);
        gl.uniform4f(this.programs.brush.uniformLocations.color, color.r / 255, color.g / 255, color.b / 255, color.a / 255);
        gl.uniform1i(this.programs.brush.uniformLocations.isEraser, isEraser);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.brushPositionBuffer);
        const positionLocation = gl.getAttribLocation(this.programs.brush, 'a_position');
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        targetLayer.gpuDirty = true; // Mark layer's texture as dirty
        // Framebuffer will be unbound by the next compositeLayers call or at end of frame
    }

    // Draws a line (series of circles) directly to a target layer's FBO using the PV matrix
    drawLine(x1, y1, r1, x2, y2, r2, color, isEraser, targetLayer, projectionMatrix, viewMatrix) {
        const gl = this.gl;
        const layerFBO = this._getLayerFBO(targetLayer);
        if (!layerFBO) {
            console.error("Failed to get FBO for target layer:", targetLayer.name);
            return;
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, layerFBO);
        gl.viewport(0, 0, targetLayer.imageData.width, targetLayer.imageData.height);
        
        gl.useProgram(this.programs.brush);

        const pvMatrix = mat4.create();
        mat4.multiply(pvMatrix, projectionMatrix, viewMatrix);

        gl.uniformMatrix4fv(this.programs.brush.uniformLocations.pvMatrix, false, pvMatrix);
        gl.uniform4f(this.programs.brush.uniformLocations.color, color.r / 255, color.g / 255, color.b / 255, color.a / 255);
        gl.uniform1i(this.programs.brush.uniformLocations.isEraser, isEraser);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.brushPositionBuffer);
        const positionLocation = gl.getAttribLocation(this.programs.brush, 'a_position');
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

        // Interpolate points for line drawing
        const distance = Math.sqrt((x2 - x1)**2 + (y2 - y1)**2);
        // Draw enough segments to make the line smooth, typically a segment every ~2 pixels
        const numSegments = Math.max(1, Math.ceil(distance / 2)); 

        for (let i = 0; i <= numSegments; i++) {
            const t = i / numSegments;
            const currentX = x1 + (x2 - x1) * t;
            const currentY = y1 + (y2 - y1) * t;
            const currentR = r1 + (r2 - r1) * t;

            gl.uniform2f(this.programs.brush.uniformLocations.center, currentX, currentY);
            gl.uniform1f(this.programs.brush.uniformLocations.radius, currentR);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }

        targetLayer.gpuDirty = true;
    }
}