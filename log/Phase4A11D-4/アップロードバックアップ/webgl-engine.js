/*
 * ===================================================================================
 * Toshinka Tegaki Tool - WebGL Engine
 * Version: 4.9.1 (Phase 4A11D-4)
 *
 * - 変更点 (Phase 4A11D-4):
 * - 「📘 Phase 4A11D-4 指示書」に基づき、ペン描画ロジックを刷新。
 * - Paper.jsを導入し、描画中のマウス座標から滑らかなベジエ曲線を生成。
 * - 描画中にリアルタイムで補間されたパスを描画し、滑らかな描き心地を実現。
 * - 描画開始時にレイヤー状態をバックアップ。
 * - 描画中はバックアップから復元し、最新のパス全体を描画する方式に変更。
 * - 描画終了時にバックアップを破棄し、描画内容をレイヤーに確定。
 * - ペンツールは`gl.LINE_STRIP`で連続した線として描画。
 * - 消しゴムツールは従来通り円の連続描画方式を維持。
 * ===================================================================================
 */
import { DrawingEngine } from './drawing-engine.js';

const mat4 = window.glMatrix.mat4;
const twgl = window.twgl;

export class WebGLEngine extends DrawingEngine {
    constructor(canvas) {
        super(canvas);
        this.gl = null;
        
        this.SUPER_SAMPLING_FACTOR = 2.0;

        this.width = canvas.width;
        this.height = canvas.height;
        this.superWidth = this.width * this.SUPER_SAMPLING_FACTOR;
        this.superHeight = this.height * this.SUPER_SAMPLING_FACTOR;
        
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

        this.lineProgramInfo = null;
        
        // --- ▼▼▼ Phase 4A11D-4 追加 ▼▼▼ ---
        // Paper.js関連のプロパティ
        this.paperScope = new window.paper.PaperScope();
        this.paperScope.setup(document.createElement('canvas')); // レンダリングには使わないが初期化に必要
        this.currentPenPath = null;
        this.preStrokeLayerTexture = null; // 描画前のレイヤー状態を保存するテクスチャ
        this.drawingLayer = null; // 現在描画中のレイヤーを追跡
        // --- ▲▲▲ Phase 4A11D-4 追加 ▲▲▲ ---

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

        this._initProjectionMatrix();

        this._initShaderPrograms();
        if (!this.programs.compositor || !this.programs.brush) {
            console.error("シェーダープログラムの初期化に失敗したため、WebGLエンジンのセットアップを中断します。");
            this.gl = null;
            return;
        }

        this._initBuffers();
        this._setupSuperCompositingBuffer();
        
        this._initLineDrawingResources();

        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.clearColor(0.0, 0.0, 0.0, 0.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        
        console.log(`WebGL Engine (v4.9.1 Phase4A11D-4) initialized with ${this.superWidth}x${this.superHeight} internal resolution.`);
    }

    _initLineDrawingResources() {
        if (!twgl || !this.gl) {
            console.warn("twgl.js is not loaded or WebGL context is not available. Skipping line drawing resource initialization.");
            return;
        }
        const gl = this.gl;

        const vs = `
            attribute vec2 a_position;
            uniform mat4 u_mvpMatrix;
            void main() {
                gl_Position = u_mvpMatrix * vec4(a_position, 0.0, 1.0);
            }`;
        const fs = `
            precision highp float;
            uniform vec4 u_color;
            void main() {
                gl_FragColor = u_color;
            }`;

        this.lineProgramInfo = twgl.createProgramInfo(gl, [vs, fs]);
        if (this.lineProgramInfo) {
            console.log("✅ twgl.js line drawing resources initialized successfully.");
        } else {
            console.error("❌ Failed to create program info for line drawing.");
        }
    }
    
    drawTestLine(x0, y0, x1, y1, color = [1, 1, 1, 1]) {
        if (!this.lineProgramInfo) {
            console.error("Line drawing resources are not initialized.");
            return;
        }
        const gl = this.gl;

        const sx0 = x0 * this.SUPER_SAMPLING_FACTOR;
        const sy0 = y0 * this.SUPER_SAMPLING_FACTOR;
        const sx1 = x1 * this.SUPER_SAMPLING_FACTOR;
        const sy1 = y1 * this.SUPER_SAMPLING_FACTOR;
        
        const arrays = {
            a_position: {
                numComponents: 2,
                data: [sx0, sy0, sx1, sy1],
            },
        };
        const bufferInfo = twgl.createBufferInfoFromArrays(gl, arrays);

        gl.useProgram(this.lineProgramInfo.program);
        const uniforms = {
            u_mvpMatrix: this.projectionMatrix,
            u_color: color,
        };
        twgl.setUniforms(this.lineProgramInfo, uniforms);
        
        twgl.setBuffersAndAttributes(gl, this.lineProgramInfo, bufferInfo);
        twgl.drawBufferInfo(gl, bufferInfo, gl.LINES);
    }

    _initProjectionMatrix() {
        this.projectionMatrix = mat4.create();
        mat4.ortho(this.projectionMatrix, 0, this.superWidth, this.superHeight, 0, -1, 1);
    }

    _initShaderPrograms() {
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

            void main() {
                vec4 color = texture2D(u_image, v_texCoord);
                gl_FragColor = vec4(color.rgb, color.a * u_opacity);
            }`;

        const vsBrush = `
            precision highp float;
            attribute vec2 a_position;
            uniform mat4 u_mvpMatrix;
            varying vec2 v_texCoord;

            void main() {
                gl_Position = u_mvpMatrix * vec4(a_position, 0.0, 1.0);
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
        const positions = [
            0, 0,
            0, this.superHeight,
            this.superWidth, 0,
            this.superWidth, this.superHeight
        ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

        this.texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        const texCoords = [
            0.0, 1.0,
            0.0, 0.0,
            1.0, 1.0,
            1.0, 0.0
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
            p.locations.u_radius = gl.getUniformLocation(p, 'u_radius');
            p.locations.u_color = gl.getUniformLocation(p, 'u_color');
            p.locations.u_is_eraser = gl.getUniformLocation(p, 'u_is_eraser');
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
            
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

            const fbo = gl.createFramebuffer();
            this.layerFBOs.set(layer, fbo);
            gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        }
        
        const sourceImageData = layer.transformStage || layer.imageData;
        
        if (layer.gpuDirty && sourceImageData) {
            const sourceData = sourceImageData.data;
            const sourceWidth = sourceImageData.width;
            
            const destImageData = new ImageData(this.superWidth, this.superHeight);
            const destData = destImageData.data;
            const factor = this.SUPER_SAMPLING_FACTOR;

            for (let y = 0; y < this.superHeight; y++) {
                for (let x = 0; x < this.superWidth; x++) {
                    const sx = Math.floor(x / factor);
                    const sy = Math.floor(y / factor);

                    const sourceIndex = (sy * sourceWidth + sx) * 4;
                    const destIndex = (y * this.superWidth + x) * 4;

                    destData[destIndex]     = sourceData[sourceIndex];
                    destData[destIndex + 1] = sourceData[sourceIndex + 1];
                    destData[destIndex + 2] = sourceData[sourceIndex + 2];
                    destData[destIndex + 3] = sourceData[sourceIndex + 3];
                }
            }
            
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, destImageData);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
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
        
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        
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
                    gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA); 
                    break;
            }
        }
    }

    /**
     * 【Phase 4A11D-4 改修箇所】
     * ペンツール使用時（isEraser=false）の初回呼び出し（mousedown時）に、
     * Paper.jsでのパス記録を開始し、描画前のレイヤー状態をバックアップします。
     * 消しゴムの場合は、従来通りの円描画ロジックを実行します。
     */
    drawCircle(centerX, centerY, radius, color, isEraser, layer) {
        if (!this.gl) return;

        // --- Paper.js ペン描画開始処理 ---
        if (!isEraser && !this.currentPenPath) {
            this.drawingLayer = layer;
            this._backupLayerState(layer); // 描画前の状態をバックアップ

            this.paperScope.activate();
            this.currentPenPath = new this.paperScope.Path();
            this.currentPenPath.add(new this.paperScope.Point(centerX, centerY));
            
            // ペンの最初の点はdrawLineで描画されるため、ここでは円を描画しない
            return;
        }

        // --- 従来の消しゴム用 円描画処理 ---
        if (!this.programs.brush) return;
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
        
        const superX = centerX;
        const superY = centerY;
        const superRadius = radius; 
        
        const modelMatrix = mat4.create();
        mat4.scale(modelMatrix, modelMatrix, [superRadius * 2.0 + 2.0, superRadius * 2.0 + 2.0, 1.0]);
        mat4.translate(modelMatrix, modelMatrix, [superX / (superRadius * 2.0 + 2.0), superY / (superRadius * 2.0 + 2.0), 0]);

        const mvpMatrix = mat4.create();
        mat4.multiply(mvpMatrix, this.projectionMatrix, modelMatrix);

        gl.uniformMatrix4fv(program.locations.u_mvpMatrix, false, mvpMatrix);
        
        gl.uniform1f(program.locations.u_radius, superRadius);
        gl.uniform4f(program.locations.u_color, color.r / 255, color.g / 255, color.b / 255, color.a / 255);
        gl.uniform1i(program.locations.u_is_eraser, isEraser);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    
    /**
     * 【Phase 4A11D-4 改修箇所】
     * ペンツールの場合、Paper.jsで座標を補間し、滑らかな線を描画します。
     * 1. 描画前のレイヤー状態に復元
     * 2. Paper.jsでパスを更新・平滑化
     * 3. 平滑化されたパス全体を`gl.LINE_STRIP`でレイヤーに描画
     * 消しゴムの場合は、従来通り円の連続描画を維持します。
     */
    drawLine(x0, y0, x1, y1, size, color, isEraser, p0, p1, calculatePressureSize, layer) {
        if (!isFinite(x0) || !isFinite(y0) || !isFinite(x1) || !isFinite(y1)) return;

        // --- 消しゴムツール（従来通り）---
        if (isEraser) {
            const distance = Math.hypot(x1 - x0, y1 - y0);
            if (distance > this.superWidth * 2) return;

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
            return;
        }

        // --- ペンツール（Paper.jsによる曲線描画）---
        if (!this.lineProgramInfo || !this.gl || !this.currentPenPath) {
             console.warn("drawLine(pen) called outside of a valid drawing sequence.");
            return;
        }

        const gl = this.gl;

        // 1. 描画前のレイヤー状態を復元
        this._restoreLayerState(layer);
        
        // 2. Paper.jsのパスに点を追加し、平滑化
        this.currentPenPath.add(new this.paperScope.Point(x1, y1));
        this.currentPenPath.smooth({ type: 'catmull-rom', factor: 0.5 });
        
        const segments = this.currentPenPath.segments;
        if (segments.length < 2) return;
        
        // 3. パスの全頂点データを取得し、LINE_STRIPで描画
        const points = segments.flatMap(seg => [seg.point.x, seg.point.y]);
        
        const targetFBO = this.layerFBOs.get(layer);
        gl.bindFramebuffer(gl.FRAMEBUFFER, targetFBO);
        gl.viewport(0, 0, this.superWidth, this.superHeight);
        this._setBlendMode('normal');
        gl.lineWidth(size * this.SUPER_SAMPLING_FACTOR);

        const arrays = { a_position: { numComponents: 2, data: points } };
        const bufferInfo = twgl.createBufferInfoFromArrays(gl, arrays);

        gl.useProgram(this.lineProgramInfo.program);
        const uniforms = {
            u_mvpMatrix: this.projectionMatrix,
            u_color: [color.r / 255, color.g / 255, color.b / 255, color.a / 255],
        };
        twgl.setUniforms(this.lineProgramInfo, uniforms);
        
        twgl.setBuffersAndAttributes(gl, this.lineProgramInfo, bufferInfo);
        twgl.drawBufferInfo(gl, bufferInfo, gl.LINE_STRIP); // 連続した線として描画

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    fill(imageData, color) { /* ... 変更なし ... */ }
    clear(imageData) { /* ... 変更なし ... */ }

    getTransformedImageData(layer) {
        if (!this.gl || !this.programs.compositor || !layer) {
            console.error("getTransformedImageData: WebGLコンテキスト、シェーダー、またはレイヤーが無効です。");
            return null;
        }
        const gl = this.gl;
        const program = this.programs.compositor;

        this._createOrUpdateLayerTexture(layer);
        const sourceTexture = this.layerTextures.get(layer);
        if (!sourceTexture) {
            console.warn('⚠ getTransformedImageData: ソーステクスチャが見つかりません。');
            return null;
        }

        const tempFBO = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, tempFBO);

        const tempTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tempTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.superWidth, this.superHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tempTexture, 0);

        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
            console.error('getTransformedImageData: フレームバッファの準備に失敗しました。');
            gl.deleteTexture(tempTexture);
            gl.deleteFramebuffer(tempFBO);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            return null;
        }
        
        gl.viewport(0, 0, this.superWidth, this.superHeight);
        gl.clearColor(0.0, 0.0, 0.0, 0.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(program);
        this._setBlendMode('normal');

        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.enableVertexAttribArray(program.locations.a_position);
        gl.vertexAttribPointer(program.locations.a_position, 2, gl.FLOAT, false, 0, 0);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.enableVertexAttribArray(program.locations.a_texCoord);
        gl.vertexAttribPointer(program.locations.a_texCoord, 2, gl.FLOAT, false, 0, 0);

        const mvpMatrix = mat4.create();
        mat4.multiply(mvpMatrix, this.projectionMatrix, layer.modelMatrix);
        gl.uniformMatrix4fv(program.locations.u_mvpMatrix, false, mvpMatrix);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
        gl.uniform1i(program.locations.u_image, 0);
        gl.uniform1f(program.locations.u_opacity, 1.0);
        
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
 
        gl.finish();

        const width = this.superWidth;
        const height = this.superHeight;

        if (width <= 0 || height <= 0 || isNaN(width) || isNaN(height)) {
            console.error(`❌ getTransformedImageData: 不正な読み出しサイズです。 width: ${width}, height: ${height}`);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.deleteTexture(tempTexture);
            gl.deleteFramebuffer(tempFBO);
            return null;
        }

        const pixelBuffer = new Uint8Array(width * height * 4);
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixelBuffer);
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.deleteTexture(tempTexture);
        gl.deleteFramebuffer(tempFBO);
        
        const destWidth = this.width;
        const destHeight = this.height;
        const destImageData = new ImageData(destWidth, destHeight);
        const destData = destImageData.data;
        const factor = this.SUPER_SAMPLING_FACTOR;

        for (let y = 0; y < destHeight; y++) {
            for (let x = 0; x < destWidth; x++) {
                const sx = Math.floor(x * factor);
                const sy = Math.floor(y * factor);

                const sourceY_flipped = height - 1 - sy;
                const sourceIndex = (sourceY_flipped * width + sx) * 4;
                const destIndex = (y * destWidth + x) * 4;

                destData[destIndex]     = pixelBuffer[sourceIndex];
                destData[destIndex + 1] = pixelBuffer[sourceIndex + 1];
                destData[destIndex + 2] = pixelBuffer[sourceIndex + 2];
                destData[destIndex + 3] = pixelBuffer[sourceIndex + 3];
            }
        }
        
        return destImageData;
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
            
            const mvpMatrix = mat4.create();
            mat4.multiply(mvpMatrix, this.projectionMatrix, layer.modelMatrix);
            gl.uniformMatrix4fv(program.locations.u_mvpMatrix, false, mvpMatrix);

            this._setBlendMode(layer.blendMode);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.layerTextures.get(layer));
            
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

        gl.uniform1i(program.locations.u_image, 0);
        gl.uniform1f(program.locations.u_opacity, 1.0);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    /**
     * 【Phase 4A11D-4 改修箇所】
     * ペン描画終了時に呼び出され、Paper.js関連の state やバックアップをクリーンアップします。
     * この処理は、本来のピクセルデータ同期処理の前に行われます。
     */
    syncDirtyRectToImageData(layer, dirtyRect) {
        // --- Paper.js ペン描画終了処理 ---
        if (this.currentPenPath && this.drawingLayer === layer) {
            this._cleanupBackupState(); // バックアップテクスチャを解放
            this.currentPenPath.remove();
            this.currentPenPath = null;
            this.drawingLayer = null;
        }

        // --- 従来のピクセルデータ同期処理 ---
        const gl = this.gl;
        const fbo = this.layerFBOs.get(layer);
        if (!fbo || dirtyRect.minX > dirtyRect.maxX) return;
        
        const sx = Math.floor(dirtyRect.minX);
        const sy = Math.floor(dirtyRect.minY);
        const sWidth = Math.ceil(dirtyRect.maxX - dirtyRect.minX);
        const sHeight = Math.ceil(dirtyRect.maxY - dirtyRect.minY);

        if (sWidth <= 0 || sHeight <= 0) return;

        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        const superBuffer = new Uint8Array(sWidth * sHeight * 4);
        
        const readY = this.superHeight - sy - sHeight;
        gl.readPixels(sx, readY, sWidth, sHeight, gl.RGBA, gl.UNSIGNED_BYTE, superBuffer);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        const targetImageData = layer.imageData;
        const targetData = targetImageData.data;
        const factor = this.SUPER_SAMPLING_FACTOR;
        
        const dx_min = Math.floor(dirtyRect.minX / factor);
        const dy_min = Math.floor(dirtyRect.minY / factor);
        const dx_max = Math.ceil(dirtyRect.maxX / factor);
        const dy_max = Math.ceil(dirtyRect.maxY / factor);

        for (let y = dy_min; y < dy_max; y++) {
            for (let x = dx_min; x < dx_max; x++) {
                if (x >= targetImageData.width || y >= targetImageData.height) continue;
                
                const sourceX = Math.floor((x - dx_min) * factor);
                const sourceY = Math.floor((y - dy_min) * factor);
                
                const sourceIndex = ((sHeight - 1 - sourceY) * sWidth + sourceX) * 4;
                const targetIndex = (y * targetImageData.width + x) * 4;

                if (sourceIndex >= 0 && sourceIndex + 3 < superBuffer.length) {
                    targetData[targetIndex]     = superBuffer[sourceIndex];
                    targetData[targetIndex + 1] = superBuffer[sourceIndex + 1];
                    targetData[targetIndex + 2] = superBuffer[sourceIndex + 2];
                    targetData[targetIndex + 3] = superBuffer[sourceIndex + 3];
                }
            }
        }
        layer.gpuDirty = false;
    }

    // --- ▼▼▼ Phase 4A11D-4 追加: ヘルパーメソッド群 ▼▼▼ ---

    /**
     * 指定されたレイヤーの現在のテクスチャ状態を、一時的なバックアップテクスチャにコピーします。
     * @param {Layer} layer バックアップするレイヤー
     */
    _backupLayerState(layer) {
        const gl = this.gl;
        const sourceTexture = this.layerTextures.get(layer);
        if (!sourceTexture) return;

        // バックアップ用テクスチャを準備
        if (!this.preStrokeLayerTexture) {
            this.preStrokeLayerTexture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, this.preStrokeLayerTexture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.superWidth, this.superHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        }

        // FBO経由でテクスチャをコピー
        const tempFBO = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, tempFBO);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.preStrokeLayerTexture, 0);
        
        gl.bindTexture(gl.TEXTURE_2D, sourceTexture); // コピー元をバインド
        gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, this.superWidth, this.superHeight);
        
        // クリーンアップ
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.deleteFramebuffer(tempFBO);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    /**
     * バックアップしておいたテクスチャの内容を、指定したレイヤーのFBOに描き戻します。
     * @param {Layer} layer 復元対象のレイヤー
     */
    _restoreLayerState(layer) {
        if (!this.preStrokeLayerTexture) return;

        const gl = this.gl;
        const program = this.programs.compositor;
        const targetFBO = this.layerFBOs.get(layer);
        if (!targetFBO) return;
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, targetFBO);
        gl.viewport(0, 0, this.superWidth, this.superHeight);
        
        // ブレンドを無効化し、完全な上書きコピーを行う
        gl.disable(gl.BLEND);

        gl.useProgram(program);

        gl.uniformMatrix4fv(program.locations.u_mvpMatrix, false, this.projectionMatrix);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.vertexAttribPointer(program.locations.a_position, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(program.locations.a_position);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.vertexAttribPointer(program.locations.a_texCoord, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(program.locations.a_texCoord);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.preStrokeLayerTexture);
        gl.uniform1i(program.locations.u_image, 0);
        gl.uniform1f(program.locations.u_opacity, 1.0);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        // 通常の状態に戻す
        gl.enable(gl.BLEND);
        this._setBlendMode('normal'); // 通常のブレンドモードに戻す
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    /**
     * 使用したバックアップテクスチャをメモリから解放します。
     */
    _cleanupBackupState() {
        if (this.preStrokeLayerTexture) {
            this.gl.deleteTexture(this.preStrokeLayerTexture);
            this.preStrokeLayerTexture = null;
        }
    }
    // --- ▲▲▲ Phase 4A11D-4 追加: ヘルパーメソッド群 ▲▲▲ ---
}