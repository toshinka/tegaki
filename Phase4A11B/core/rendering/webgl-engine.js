/*
 * ===================================================================================
 * Toshinka Tegaki Tool - WebGL Engine
 * Version: 4.3.0 (Phase 4A11B - Model Matrix Integration)
 *
 * - 変更点 (Phase 4A11B):
 * - 📜 Phase4A11B 初期指示書に基づき、レイヤーのmodelMatrixをWebGL表示に正しく反映するよう改修。
 * - 1. 座標系の統一:
 * - これまで-1から1のクリップスペースで扱っていた頂点座標を、キャンバスのピクセル座標系で扱うように変更。
 * - これにより、core-engineで計算されるピクセル単位のmodelMatrix（移動行列）を直接、正しく適用できるようになった。
 * - 2. 投影行列 (Projection Matrix) の導入:
 * - ピクセル座標系を最終的にWebGLのクリップスペースに変換するため、正投影行列を導入。
 * - レイヤー合成時: `最終的な行列 = 投影行列 * レイヤーのモデル行列` として計算し、シェーダーに渡す。
 * - 3. 頂点バッファの更新:
 * - レイヤーを描画する矩形（クアッド）の頂点データを、クリップスペースからスーパーサンプリング解像度のピクセル座標に変更。
 * - 4. 描画関数の更新:
 * - compositeLayers: 各レイヤーのmodelMatrixを投影行列と掛け合わせてからシェーダーに送るように変更。
 * - renderToDisplay: 最終表示用のテクスチャを描画する際も、同様に投影行列を適用するように修正。
 * ===================================================================================
 */
import { DrawingEngine } from './drawing-engine.js';

// glMatrixライブラリの参照を追加
const mat4 = window.glMatrix.mat4;

export class WebGLEngine extends DrawingEngine {
    constructor(canvas) {
        super(canvas);
        this.gl = null;
        
        this.SUPER_SAMPLING_FACTOR = 2.0;

        this.width = canvas.width;
        this.height = canvas.height;
        this.superWidth = this.width * this.SUPER_SAMPLING_FACTOR;
        this.superHeight = this.height * this.SUPER_SAMPLING_FACTOR;
        
        // ✨(修正) 座標系変換の要となる投影行列をプロパティとして保持
        this.projectionMatrix = null;

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
        
        this.identityMatrix = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);

        try {
            this.gl = canvas.getContext('webgl', { preserveDrawingBuffer: true, premultipliedAlpha: true, antialias: false }) || canvas.getContext('experimental-webgl', { preserveDrawingBuffer: true, premultipliedAlpha: true, antialias: false });
            if (!this.gl) {
                alert('お使いのブラウザはWebGLをサポートしていません。別のブラウザをお試しください。');
                console.error('WebGLコンテキストの取得に失敗しました。');
                return;
            }
        } catch (e) {
            console.error("WebGL Engine initialization failed:", e);
            alert('WebGLの初期化中に予期せぬエラーが発生しました。');
            return;
        }

        const gl = this.gl;
        
        gl.enable(gl.BLEND);
        gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        // ✨(修正) 投影行列をここで初期化
        this._initProjectionMatrix();

        this._initShaderPrograms();
        if (!this.programs.compositor || !this.programs.brush) {
            console.error("シェーダープログラムの初期化に失敗したため、WebGLエンジンのセットアップを中断します。");
            this.gl = null;
            return;
        }

        this._initBuffers();
        this._setupSuperCompositingBuffer();

        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.clearColor(0.0, 0.0, 0.0, 0.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        console.log(`WebGL Engine (v4.3.0 Phase4A11B) initialized with ${this.superWidth}x${this.superHeight} internal resolution.`);
    }

    // ✨(新設) 正投影行列を生成する関数
    _initProjectionMatrix() {
        this.projectionMatrix = mat4.create();
        // WebGLのFBOはY軸が上向きなので、(left, right, bottom, top)の順で指定する
        mat4.ortho(this.projectionMatrix, 0, this.superWidth, 0, this.superHeight, -1, 1);
    }

    _initShaderPrograms() {
        // シェーダー自体は変更なし。受け取る行列(u_mvpMatrix)の意味合いが変わるだけ。
        const vsCompositor = `
            attribute vec2 a_position;
            attribute vec2 a_texCoord;
            uniform mat4 u_mvpMatrix;
            varying vec2 v_texCoord;

            void main() {
                gl_Position = u_mvpMatrix * vec4(a_position, 0.0, 1.0);
                v_texCoord = a_texCoord;
            }`;

        const fsCompositor = `
            precision highp float;
            varying vec2 v_texCoord;
            uniform sampler2D u_image;
            uniform float u_opacity;
            uniform vec2 u_source_resolution;

            void main() {
                vec2 texel_size = 1.0 / u_source_resolution;
                vec4 color = vec4(0.0);
                
                color += texture2D(u_image, v_texCoord + texel_size * vec2(-0.25, -0.25));
                color += texture2D(u_image, v_texCoord + texel_size * vec2( 0.25, -0.25));
                color += texture2D(u_image, v_texCoord + texel_size * vec2( 0.25,  0.25));
                color += texture2D(u_image, v_texCoord + texel_size * vec2(-0.25,  0.25));
                color *= 0.25;

                gl_FragColor = vec4(color.rgb, color.a * u_opacity);
            }`;

        const vsBrush = `
            precision highp float;
            attribute vec2 a_position; 
            uniform vec2 u_resolution;
            uniform vec2 u_center;
            uniform float u_radius;
            varying vec2 v_texCoord;

            void main() {
                vec2 quad_size_pixels = vec2(u_radius * 2.0 + 2.0);
                vec2 quad_size_clip = quad_size_pixels / u_resolution;
                vec2 center_clip = (u_center / u_resolution) * 2.0 - 1.0;
                
                vec4 final_pos = vec4(a_position * quad_size_clip + center_clip, 0.0, 1.0);
                gl_Position = final_pos;

                v_texCoord = a_position + 0.5;
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
        
        this.programs.compositor = this._createProgram(vsCompositor, fsCompositor);
        this.programs.brush = this._createProgram(vsBrush, fsBrush);
    }
    
    _initBuffers() {
        const gl = this.gl;
        this.positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);

        // ✨(修正) 頂点座標をクリップスペース(-1~1)からピクセル座標(0~superWidth/Height)に変更
        // テクスチャ座標の順序と合わせるため、(TL, BL, TR, BR)の順で定義
        const positions = [
            0, this.superHeight,                // Top-Left
            0, 0,                               // Bottom-Left
            this.superWidth, this.superHeight,  // Top-Right
            this.superWidth, 0                  // Bottom-Right
        ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

        this.texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        // ✨(修正) 上記の頂点順序(TL, BL, TR, BR)に合わせたテクスチャ座標
        // Y軸はテクスチャアップロード時に反転(FLIP_Y)されるため、(0,1)がテクスチャの下側(描画の上側)に対応
        const texCoords = [
            0.0, 1.0, // Top-Left
            0.0, 0.0, // Bottom-Left
            1.0, 1.0, // Top-Right
            1.0, 0.0  // Bottom-Right
        ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);
        
        this.brushPositionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.brushPositionBuffer);
        const brushPositions = [ -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5, -0.5 ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(brushPositions), gl.STATIC_DRAW);
    }

    _compileShader(source, type) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const info = gl.getShaderInfoLog(shader);
            console.error(`シェーダーコンパイルエラー (${type === gl.VERTEX_SHADER ? 'Vertex' : 'Fragment'}):`, info);
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    _createProgram(vsSource, fsSource) {
        const gl = this.gl;
        const vs = this._compileShader(vsSource, gl.VERTEX_SHADER);
        const fs = this._compileShader(fsSource, gl.FRAGMENT_SHADER);
        if (!vs || !fs) return null;

        const program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const info = gl.getProgramInfoLog(program);
            console.error('プログラムリンクエラー:', info);
            gl.deleteProgram(program);
            return null;
        }
        
        program.locations = {};
        const locs = (p) => {
            p.locations.a_position = gl.getAttribLocation(p, 'a_position');
            p.locations.a_texCoord = gl.getAttribLocation(p, 'a_texCoord');
            p.locations.u_image = gl.getUniformLocation(p, 'u_image');
            p.locations.u_opacity = gl.getUniformLocation(p, 'u_opacity');
            p.locations.u_resolution = gl.getUniformLocation(p, 'u_resolution');
            p.locations.u_center = gl.getUniformLocation(p, 'u_center');
            p.locations.u_radius = gl.getUniformLocation(p, 'u_radius');
            p.locations.u_color = gl.getUniformLocation(p, 'u_color');
            p.locations.u_is_eraser = gl.getUniformLocation(p, 'u_is_eraser');
            p.locations.u_source_resolution = gl.getUniformLocation(p, 'u_source_resolution');
            p.locations.u_mvpMatrix = gl.getUniformLocation(p, 'u_mvpMatrix');
        };
        locs(program);
        
        return program;
    }

    static isSupported() { try { const canvas = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))); } catch (e) { return false; } }

    _createOrUpdateLayerTexture(layer) {
        const gl = this.gl;
        let texture = this.layerTextures.get(layer);

        if (!texture) {
            texture = gl.createTexture();
            this.layerTextures.set(layer, texture);

            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.superWidth, this.superHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

            const fbo = gl.createFramebuffer();
            this.layerFBOs.set(layer, fbo);
            gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        }

        if (layer.gpuDirty && layer.imageData) {
             const sourceCanvas = document.createElement('canvas');
             sourceCanvas.width = layer.imageData.width;
             sourceCanvas.height = layer.imageData.height;
             sourceCanvas.getContext('2d').putImageData(layer.imageData, 0, 0);

             const tempCanvas = document.createElement('canvas');
             tempCanvas.width = this.superWidth;
             tempCanvas.height = this.superHeight;
             const tempCtx = tempCanvas.getContext('2d');
             tempCtx.imageSmoothingEnabled = true;
             tempCtx.imageSmoothingQuality = 'high';
             tempCtx.drawImage(sourceCanvas, 0, 0, this.superWidth, this.superHeight);

            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
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
                case 'multiply': 
                    gl.blendFuncSeparate(gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA); 
                    break;
                case 'screen': 
                    gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_COLOR, gl.ONE, gl.ONE_MINUS_SRC_ALPHA); 
                    break;
                case 'add':
                    gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ONE, gl.ONE); 
                    break;
                default: 
                    gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA); 
                    break;
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
        
        gl.useProgram(program);
        this._setBlendMode('normal', isEraser);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.brushPositionBuffer);
        gl.enableVertexAttribArray(program.locations.a_position);
        gl.vertexAttribPointer(program.locations.a_position, 2, gl.FLOAT, false, 0, 0);
        
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
        // ... 変更なし ...
        return null;
    }

    compositeLayers(layers, compositionData, dirtyRect) {
        if (!this.gl || !this.programs.compositor || !this.superCompositeFBO) return;
        const gl = this.gl;
        const program = this.programs.compositor;

        for (const layer of layers) {
            this._createOrUpdateLayerTexture(layer);
        }
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.superCompositeFBO);
        gl.viewport(0, 0, this.superWidth, this.superHeight);
        
        gl.clearColor(0.0, 0.0, 0.0, 0.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(program);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.enableVertexAttribArray(program.locations.a_position);
        gl.vertexAttribPointer(program.locations.a_position, 2, gl.FLOAT, false, 0, 0);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.enableVertexAttribArray(program.locations.a_texCoord);
        gl.vertexAttribPointer(program.locations.a_texCoord, 2, gl.FLOAT, false, 0, 0);
        
        for (const layer of layers) {
            if (!layer.visible || layer.opacity === 0 || !this.layerTextures.has(layer)) continue;

            if (!layer.modelMatrix) {
                console.warn('Skipping layer draw: missing modelMatrix.');
                continue;
            }

            // ✨(修正) ここが最重要ポイント！
            // 投影行列とレイヤーのモデル行列を掛け合わせて、最終的な変換行列(mvpMatrix)を作成する
            const mvpMatrix = mat4.create();
            mat4.multiply(mvpMatrix, this.projectionMatrix, layer.modelMatrix);
            gl.uniformMatrix4fv(program.locations.u_mvpMatrix, false, mvpMatrix);

            this._setBlendMode(layer.blendMode);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.layerTextures.get(layer));
            
            gl.uniform2f(program.locations.u_source_resolution, this.superWidth, this.superHeight);
            gl.uniform1i(program.locations.u_image, 0);
            gl.uniform1f(program.locations.u_opacity, layer.opacity / 100.0);
            
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    
    renderToDisplay(compositionData, dirtyRect) {
        if (!this.gl || !this.superCompositeTexture) return;
        const gl = this.gl;
        const program = this.programs.compositor;

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        
        gl.clearColor(0.0, 0.0, 0.0, 0.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        
        this._setBlendMode('normal');

        gl.useProgram(program);

        // ✨(修正) 最終表示時も投影行列を適用する
        // モデル行列は単位行列なので、最終的なテクスチャをそのまま画面全体に描画する
        const mvpMatrix = mat4.create();
        mat4.multiply(mvpMatrix, this.projectionMatrix, this.identityMatrix);
        gl.uniformMatrix4fv(program.locations.u_mvpMatrix, false, mvpMatrix);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.enableVertexAttribArray(program.locations.a_position);
        gl.vertexAttribPointer(program.locations.a_position, 2, gl.FLOAT, false, 0, 0);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.enableVertexAttribArray(program.locations.a_texCoord);
        gl.vertexAttribPointer(program.locations.a_texCoord, 2, gl.FLOAT, false, 0, 0);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.superCompositeTexture);

        gl.uniform2f(program.locations.u_source_resolution, this.superWidth, this.superHeight);
        gl.uniform1i(program.locations.u_image, 0);
        gl.uniform1f(program.locations.u_opacity, 1.0);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
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
        const readY = sy;
        gl.readPixels(sx, readY, sWidth, sHeight, gl.RGBA, gl.UNSIGNED_BYTE, superBuffer);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        const targetImageData = layer.imageData;
        const targetData = targetImageData.data;
        const factor = this.SUPER_SAMPLING_FACTOR;
        
        for (let y = 0; y < (dirtyRect.maxY - dirtyRect.minY); y++) {
            for (let x = 0; x < (dirtyRect.maxX - dirtyRect.minX); x++) {
                const targetX = Math.floor(dirtyRect.minX) + x;
                const targetY = Math.floor(dirtyRect.minY) + y;
                if (targetX >= targetImageData.width || targetY >= targetImageData.height) continue;
                
                const sourceX = Math.round(x * factor);
                const sourceY = sHeight - 1 - Math.round(y * factor);
                
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