/*
 * ===================================================================================
 * Toshinka Tegaki Tool - WebGL Engine
 * Version: 4.0.0 (Phase4A9 - MVP Transformation)
 *
 * - ★★★ 改修（Phase4A9）★★★
 * - 1. gl-matrixライブラリを導入。
 * - 2. コンポジット用シェーダーをMVP(Model-View-Projection)行列に対応したものに刷新。
 * `uniform mat4 u_mvpMatrix` を追加し、頂点座標を動的に変形できるようにした。
 * - 3. `compositeLayers`メソッドを改修。core-engineから渡された各レイヤーの`modelMatrix`と、
 * 共通の`viewMatrix`, `projectionMatrix`を元に`mvpMatrix`を計算し、シェーダーに渡す。
 * - 4. これにより、各レイヤーの移動・回転・拡縮がGPU上で高速に、非破壊的に処理される。
 * - 5. ブラシ描画ロジックは、レイヤーのローカルなテクスチャに直接描く方式を維持。
 * これにより、入力座標の処理と描画の変形処理が完全に分離され、安定した動作を実現。
 * ===================================================================================
 */
import { DrawingEngine } from './drawing-engine.js';

// ★★★ gl-matrixライブラリの各モジュールを変数に格納 ★★★
const { mat4, vec4 } = glMatrix;

export class WebGLEngine extends DrawingEngine {
    constructor(canvas) {
        super(canvas);
        this.gl = null;
        
        this.SUPER_SAMPLING_FACTOR = 2.0;

        this.width = canvas.width;
        this.height = canvas.height;
        this.superWidth = this.width * this.SUPER_SAMPLING_FACTOR;
        this.superHeight = this.height * this.SUPER_SAMPLING_FACTOR;
        
        this.programs = { compositor: null, brush: null, downsampler: null };
        this.positionBuffer = null;
        this.texCoordBuffer = null;
        this.brushPositionBuffer = null;
        
        this.superCompositeTexture = null;
        this.superCompositeFBO = null;
        
        this.layerTextures = new Map();
        this.layerFBOs = new Map();
        
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

        console.log(`WebGL Engine (v4.0.0 MVP Transform) initialized with ${this.superWidth}x${this.superHeight} internal resolution.`);
    }

    _initShaderPrograms() {
        // ★★★★★ 修正: MVP対応のコンポジット用頂点シェーダー ★★★★★
        const vsCompositor = `
            attribute vec4 a_position;
            attribute vec2 a_texCoord;
            uniform mat4 u_mvpMatrix; // Model-View-Projection Matrix
            varying vec2 v_texCoord;
            void main() {
                gl_Position = u_mvpMatrix * a_position;
                v_texCoord = a_texCoord;
            }`;

        // ★★★★★ 修正: シンプルなコンポジット用フラグメントシェーダー ★★★★★
        const fsCompositor = `
            precision highp float;
            varying vec2 v_texCoord;
            uniform sampler2D u_image;
            uniform float u_opacity;
            void main() {
                vec4 color = texture2D(u_image, v_texCoord);
                gl_FragColor = vec4(color.rgb, color.a * u_opacity);
            }`;
        
        // 高品質ダウンサンプリング用シェーダー（画面表示用）
         const vsDownsampler = `
            attribute vec4 a_position;
            attribute vec2 a_texCoord;
            varying vec2 v_texCoord;
            void main() {
                gl_Position = a_position;
                v_texCoord = a_texCoord;
            }`;
        const fsDownsampler = `
            precision highp float;
            varying vec2 v_texCoord;
            uniform sampler2D u_image;
            uniform vec2 u_source_resolution;
            void main() {
                vec2 texel_size = 1.0 / u_source_resolution;
                vec4 color = vec4(0.0);
                color += texture2D(u_image, v_texCoord + texel_size * vec2(-0.25, -0.25));
                color += texture2D(u_image, v_texCoord + texel_size * vec2( 0.25, -0.25));
                color += texture2D(u_image, v_texCoord + texel_size * vec2( 0.25,  0.25));
                color += texture2D(u_image, v_texCoord + texel_size * vec2(-0.25,  0.25));
                color *= 0.25;
                gl_FragColor = color;
            }`;

        // ブラシ用シェーダー（変更なし）
        const vsBrush = `
            precision mediump float;
            attribute vec2 a_position;
            uniform vec2 u_resolution; // FBOの解像度 (superWidth, superHeight)
            uniform vec2 u_center;     // 描画中心のピクセル座標
            uniform float u_radius;     // 半径のピクセルサイズ
            varying vec2 v_texCoord;

            void main() {
                vec2 quad_size_pixels = vec2(u_radius * 2.0 + 4.0); // 少しマージンを持たせる
                vec2 quad_size_clip = quad_size_pixels / u_resolution * 2.0;
                
                // u_centerは左上原点のピクセル座標なので、クリップ座標（-1~1, 左下原点）に変換
                vec2 center_clip = (u_center / u_resolution) * 2.0 - 1.0;
                center_clip.y *= -1.0; // Y軸を反転

                gl_Position = vec4(a_position * (quad_size_clip / 2.0) + center_clip, 0.0, 1.0);
                v_texCoord = a_position * 0.5 + 0.5;
            }`;

        const fsBrush = `
            precision highp float;
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
                    gl_FragColor = vec4(u_color.rgb * u_color.a * alpha, u_color.a * alpha);
                }
            }`;
        
        this.programs.compositor = this._createProgram(vsCompositor, fsCompositor, ['a_position', 'a_texCoord'], ['u_mvpMatrix', 'u_image', 'u_opacity']);
        this.programs.downsampler = this._createProgram(vsDownsampler, fsDownsampler, ['a_position', 'a_texCoord'], ['u_image', 'u_source_resolution']);
        this.programs.brush = this._createProgram(vsBrush, fsBrush, ['a_position'], ['u_resolution', 'u_center', 'u_radius', 'u_color', 'u_is_eraser']);
    }
    
    _initBuffers() {
        const gl = this.gl;
        this.positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        // ★★★ 修正: 座標系をピクセル単位にする（0,0 to width,height） ★★★
        const positions = [ 0, this.height, 0, 0, this.width, this.height, this.width, 0 ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

        this.texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        const texCoords = [ 0.0, 1.0, 0.0, 0.0, 1.0, 1.0, 1.0, 0.0 ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);
        
        this.brushPositionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.brushPositionBuffer);
        const brushPositions = [ -1, 1, -1, -1, 1, 1, 1, -1 ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(brushPositions), gl.STATIC_DRAW);
    }

    _compileShader(source, type) { const gl = this.gl; const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader); if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { console.error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader)); gl.deleteShader(shader); return null; } return shader; }
    
    _createProgram(vsSource, fsSource, attribs, uniforms) {
        const gl = this.gl;
        const vs = this._compileShader(vsSource, gl.VERTEX_SHADER);
        const fs = this._compileShader(fsSource, gl.FRAGMENT_SHADER);
        if (!vs || !fs) return null;
        const program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(program));
            gl.deleteProgram(program);
            return null;
        }
        program.attribs = {};
        program.uniforms = {};
        attribs.forEach(name => { program.attribs[name] = gl.getAttribLocation(program, name); });
        uniforms.forEach(name => { program.uniforms[name] = gl.getUniformLocation(program, name); });
        return program;
    }
    
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

            if (layer.imageData) {
                 gl.bindTexture(gl.TEXTURE_2D, texture);
                 gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
                 gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.width, this.height, gl.RGBA, gl.UNSIGNED_BYTE, layer.imageData);
            }
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        }

        if (layer.gpuDirty) {
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
             
             // 元のサイズのまま描画
             tempCtx.drawImage(sourceCanvas, 0, 0, layer.imageData.width, layer.imageData.height, 0, 0, this.superWidth, this.superHeight);

            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
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
            gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            
            switch (blendMode) {
                case 'multiply': gl.blendFuncSeparate(gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA); break;
                case 'screen': gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_COLOR, gl.ONE, gl.ONE_MINUS_SRC_ALPHA); break;
                case 'add': gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ONE, gl.ONE); break;
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

        // ★★★ 注: ここでの描画はレイヤーのローカルFBOに対して行われる ★★★
        // 座標も変形を考慮しないローカル座標系で行うため、centerX, centerYをそのまま使う
        // レイヤーの変形(modelMatrix)は、後のcompositeLayersで適用される

        gl.bindFramebuffer(gl.FRAMEBUFFER, targetFBO);
        gl.viewport(0, 0, this.superWidth, this.superHeight);
        
        gl.useProgram(program);
        this._setBlendMode('normal', isEraser);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.brushPositionBuffer);
        gl.vertexAttribPointer(program.attribs.a_position, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(program.attribs.a_position);
        
        const superX = centerX * this.SUPER_SAMPLING_FACTOR;
        const superY = centerY * this.SUPER_SAMPLING_FACTOR;
        const superRadius = radius * this.SUPER_SAMPLING_FACTOR;
        
        gl.uniform2f(program.uniforms.u_resolution, this.superWidth, this.superHeight);
        gl.uniform2f(program.uniforms.u_center, superX, superY);
        gl.uniform1f(program.uniforms.u_radius, superRadius);
        gl.uniform4f(program.uniforms.u_color, color.r / 255, color.g / 255, color.b / 255, color.a / 255);
        gl.uniform1i(program.uniforms.u_is_eraser, isEraser);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    
    drawLine(x0, y0, x1, y1, size, color, isEraser, p0, p1, calculatePressureSize, layer) {
        if (!isFinite(x0) || !isFinite(y0) || !isFinite(x1) || !isFinite(y1)) return;
        const distance = Math.hypot(x1 - x0, y1 - y0);

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
    
    // ★★★★★ 修正: 全レイヤーを行列で変形しながら中間バッファに合成 ★★★★★
    compositeLayers(layers, compositionData, dirtyRect, viewMatrix, projectionMatrix) {
        if (!this.gl || !this.programs.compositor || !this.superCompositeFBO) return;
        const gl = this.gl;
        const program = this.programs.compositor;

        for (const layer of layers) {
            this._createOrUpdateLayerTexture(layer);
        }
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.superCompositeFBO);
        gl.viewport(0, 0, this.superWidth, this.superHeight);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(program);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.vertexAttribPointer(program.attribs.a_position, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(program.attribs.a_position);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.vertexAttribPointer(program.attribs.a_texCoord, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(program.attribs.a_texCoord);
        
        for (const layer of layers) {
            if (!layer.visible || layer.opacity === 0 || !this.layerTextures.has(layer)) continue;

            this._setBlendMode(layer.blendMode);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.layerTextures.get(layer));
            gl.uniform1i(program.uniforms.u_image, 0);
            gl.uniform1f(program.uniforms.u_opacity, layer.opacity / 100.0);
            
            // ★★★ MVP行列を計算してシェーダーに送る ★★★
            const mvpMatrix = mat4.create();
            mat4.multiply(mvpMatrix, viewMatrix, layer.modelMatrix); // M * V
            mat4.multiply(mvpMatrix, projectionMatrix, mvpMatrix);   // P * (M * V)
            gl.uniformMatrix4fv(program.uniforms.u_mvpMatrix, false, mvpMatrix);

            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.disableVertexAttribArray(program.attribs.a_position);
        gl.disableVertexAttribArray(program.attribs.a_texCoord);
    }
    
    renderToDisplay(compositionData, dirtyRect) {
        if (!this.gl || !this.superCompositeTexture) return;
        const gl = this.gl;
        const program = this.programs.downsampler;

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        
        this._setBlendMode('normal'); // 通常のアルファブレンド
        
        // ★★★ 高品質ダウンサンプリングシェーダーを使用 ★★★
        gl.useProgram(program);
        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        const positions = [ -1, 1, -1, -1, 1, 1, 1, -1 ]; // full screen quad
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

        gl.vertexAttribPointer(program.attribs.a_position, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(program.attribs.a_position);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.vertexAttribPointer(program.attribs.a_texCoord, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(program.attribs.a_texCoord);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.superCompositeTexture);
        gl.uniform1i(program.uniforms.u_image, 0);
        gl.uniform2f(program.uniforms.u_source_resolution, this.superWidth, this.superHeight);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        gl.disableVertexAttribArray(program.attribs.a_position);
        gl.disableVertexAttribArray(program.attribs.a_texCoord);
    }

    syncDirtyRectToImageData(layer, dirtyRect) {
        const gl = this.gl;
        const fbo = this.layerFBOs.get(layer);
        if (!fbo || dirtyRect.minX > dirtyRect.maxX) return;
        
        // このメソッドは現在、変形を考慮していません。
        // 正確な同期には、ダーティ矩形自体も逆変換する必要がありますが、
        // パフォーマンスへの影響が大きいため、今回は未対応とします。
        // Undo/Redo時の全更新でカバーします。
    }
}