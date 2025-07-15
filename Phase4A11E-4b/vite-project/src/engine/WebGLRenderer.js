import { StrokeRenderer } from './DrawingEngine.js';
import { mat4 } from 'gl-matrix';
import * as twgl from 'twgl.js';

/**
 * [クラス責務] WebGLRenderer.js
 * 目的：DrawingEngineの仕様に基づき、WebGL APIを使用して具体的な描画処理をすべて担当する。
 */
export class LayerRendererGL extends StrokeRenderer { 
    constructor(canvas) {
        super(canvas);
        try {
            this.gl = canvas.getContext("webgl2", { antialias: false, preserveDrawingBuffer: true, alpha: true });
        } catch (e) {
            console.error("❌ LayerRendererGL: Failed to get WebGL2 context, falling back to WebGL1.", e);
            try {
                this.gl = canvas.getContext("webgl", { antialias: false, preserveDrawingBuffer: true, alpha: true });
            } catch (e2) {
                console.error("❌ LayerRendererGL: Failed to get WebGL1 context.", e2);
            }
        }

        if (!this.gl) {
            console.error("❌ LayerRendererGL: WebGL is not supported or failed to get context.");
            return;
        }
        
        this._checkGLError('constructor start');
        this.SUPER_SAMPLING_FACTOR = 2.0;
        this.width = canvas.width;
        this.height = canvas.height;
        this.superWidth = this.width * this.SUPER_SAMPLING_FACTOR;
        this.superHeight = this.height * this.SUPER_SAMPLING_FACTOR;
        
        this.programs = { compositor: null, brush: null, line: null }; // 変更：lineプログラムを追加
        this.layerTextures = new Map();
        this.layerFBOs = new Map();
        this.identityMatrix = mat4.create();

        const gl = this.gl;
        gl.enable(gl.BLEND);
        this._checkGLError('gl.enable(BLEND)');
        gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        this._checkGLError('gl.blendFuncSeparate');

        this._initProjectionMatrix();
        this._initShaderPrograms();

        if (!this.programs.compositor || !this.programs.brush || !this.programs.line) {
            console.error("❌ Shader program initialization failed. Aborting LayerRendererGL setup.");
            this.gl = null;
            return;
        }

        this._initBuffers();
        this._setupSuperCompositingBuffer();

        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        this._checkGLError('gl.viewport');
        gl.clearColor(0.0, 0.0, 0.0, 0.0);
        this._checkGLError('gl.clearColor');
        gl.clear(gl.COLOR_BUFFER_BIT);
        this._checkGLError('gl.clear');
        
        console.log(`✅ LayerRendererGL initialized with ${this.superWidth}x${this.superHeight} internal resolution.`);
    }
    
    _checkGLError(operation) {
        // ... (unchanged)
    }

    isInitialized() {
        return !!this.gl;
    }

    _initProjectionMatrix() {
        this.projectionMatrix = mat4.create();
        mat4.ortho(this.projectionMatrix, 0, this.superWidth, this.superHeight, 0, -1, 1);
        this._checkGLError('_initProjectionMatrix');
    }

    _initShaderPrograms() {
        // 既存のコンポジット用シェーダー
        const vsCompositor = `attribute vec2 a_position; attribute vec2 a_texCoord; uniform mat4 u_mvpMatrix; varying vec2 v_texCoord; void main() { gl_Position = u_mvpMatrix * vec4(a_position, 0.0, 1.0); v_texCoord = a_texCoord; }`;
        const fsCompositor = `precision highp float; varying vec2 v_texCoord; uniform sampler2D u_image; uniform float u_opacity; void main() { vec4 color = texture2D(u_image, v_texCoord); gl_FragColor = vec4(color.rgb, color.a * u_opacity); }`;
        this.programs.compositor = twgl.createProgramInfo(this.gl, [vsCompositor, fsCompositor]);
        this._checkGLError('createProgramInfo compositor');

        // 既存のブラシ（円描画）用シェーダー
        const vsBrush = `attribute vec2 a_position; uniform mat4 u_mvpMatrix; varying vec2 v_texCoord; void main() { gl_Position = u_mvpMatrix * vec4(a_position, 0.0, 1.0); v_texCoord = a_position * 0.5 + 0.5; }`;
        const fsBrush = `precision highp float; varying vec2 v_texCoord; uniform vec4 u_color; uniform bool u_is_eraser; void main() { float dist = distance(v_texCoord, vec2(0.5)); if (dist > 0.5) discard; float alpha = 1.0 - smoothstep(0.45, 0.5, dist); if (u_is_eraser) { gl_FragColor = vec4(0.0, 0.0, 0.0, alpha); } else { gl_FragColor = vec4(u_color.rgb, u_color.a * alpha); } }`;
        this.programs.brush = twgl.createProgramInfo(this.gl, [vsBrush, fsBrush]);
        this._checkGLError('createProgramInfo brush');
        
        // 変更：LINE_STRIP描画用のシンプルなシェーダー
        const vsLine = `precision highp float; attribute vec2 a_position; uniform mat4 u_mvpMatrix; void main() { gl_Position = u_mvpMatrix * vec4(a_position, 0.0, 1.0); }`;
        const fsLine = `precision highp float; uniform vec4 u_color; void main() { gl_FragColor = u_color; }`;
        this.programs.line = twgl.createProgramInfo(this.gl, [vsLine, fsLine]);
        this._checkGLError('createProgramInfo line');
    }
    
    _initBuffers() {
        const gl = this.gl;
        const positions = [0, 0, 0, this.superHeight, this.superWidth, 0, this.superWidth, this.superHeight];
        const texCoords = [0.0, 1.0, 0.0, 0.0, 1.0, 1.0, 1.0, 0.0];
        
        this.positionBuffer = twgl.createBufferInfoFromArrays(gl, { a_position: { numComponents: 2, data: positions } });
        this.texCoordBuffer = twgl.createBufferInfoFromArrays(gl, { a_texCoord: { numComponents: 2, data: texCoords } });
        
        // ブラシ用の固定バッファ
        const brushPositions = [ -1, 1, -1, -1, 1, 1, 1, -1 ];
        this.brushPositionBuffer = twgl.createBufferInfoFromArrays(gl, { a_position: { numComponents: 2, data: brushPositions } });
    }

    _createOrUpdateLayerTexture(layer) {
        // ... (unchanged)
    }
    
    _setupSuperCompositingBuffer() {
        // ... (unchanged)
    }
    
    _setBlendMode(blendMode, isEraser = false) {
        const gl = this.gl;
        if (isEraser) {
            gl.blendEquation(gl.FUNC_ADD);
            // 消しゴムはテクスチャのアルファ値を消す
            gl.blendFuncSeparate(gl.ZERO, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE_MINUS_SRC_ALPHA);
        } else {
            gl.blendEquation(gl.FUNC_ADD);
            switch (blendMode) {
                case 'multiply': 
                    gl.blendFuncSeparate(gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA); 
                    break;
                default: // 'normal'
                    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA); 
                    break;
            }
        }
        this._checkGLError(`_setBlendMode ${blendMode} eraser:${isEraser}`);
    }

    drawCircle(centerX, centerY, radius, color, isEraser, layer) {
        if (!this.gl) return;
        const gl = this.gl;
        
        this._createOrUpdateLayerTexture(layer);
        const targetFBO = this.layerFBOs.get(layer);
        if (!targetFBO) return;

        twgl.bindFramebufferInfo(gl, targetFBO);
        gl.useProgram(this.programs.brush.program);
        this._setBlendMode('normal', isEraser);

        const modelMatrix = mat4.create();
        mat4.translate(modelMatrix, modelMatrix, [centerX, centerY, 0]);
        mat4.scale(modelMatrix, modelMatrix, [radius, radius, 1]);
        const mvpMatrix = mat4.create();
        mat4.multiply(mvpMatrix, this.projectionMatrix, modelMatrix);
        
        twgl.setBuffersAndAttributes(gl, this.programs.brush, this.brushPositionBuffer);
        twgl.setUniforms(this.programs.brush, {
            u_mvpMatrix: mvpMatrix,
            u_color: [color.r / 255, color.g / 255, color.b / 255, color.a],
            u_is_eraser: isEraser,
        });

        twgl.drawBufferInfo(gl, this.brushPositionBuffer, gl.TRIANGLE_STRIP);
        twgl.bindFramebufferInfo(gl, null);
    }
    
    // 変更：新しいストローク描画メソッド
    drawStroke(points, size, color, isEraser, layer) {
        if (!this.gl || !points || points.length === 0) return;
        const gl = this.gl;

        // 点が1つの場合（クリック時）は高品質な円を描画
        if (points.length / 2 === 1) {
            this.drawCircle(points[0], points[1], size / 2, color, isEraser, layer);
            return;
        }

        // 2点以上の場合、LINE_STRIPで線を描画
        this._createOrUpdateLayerTexture(layer);
        const targetFBO = this.layerFBOs.get(layer);
        if (!targetFBO) return;

        twgl.bindFramebufferInfo(gl, targetFBO);
        
        const programInfo = this.programs.line;
        gl.useProgram(programInfo.program);
        this._setBlendMode('normal', isEraser);

        const mvpMatrix = mat4.create();
        mat4.multiply(mvpMatrix, this.projectionMatrix, this.identityMatrix);

        twgl.setUniforms(programInfo, {
            u_mvpMatrix: mvpMatrix,
            u_color: [color.r / 255, color.g / 255, color.b / 255, color.a],
        });

        const bufferInfo = twgl.createBufferInfoFromArrays(gl, {
            a_position: { numComponents: 2, data: new Float32Array(points) }
        });
        twgl.setBuffersAndAttributes(gl, programInfo, bufferInfo);

        // 指示書に基づくデバッグログ
        console.log(`[WebGLRenderer] Drawing mode: LINE_STRIP, Vertices: ${points.length / 2}, Size: ${size}`, points);
        
        // gl.lineWidthは多くの環境で1.0より大きくできないが、念のため設定
        gl.lineWidth(size);
        twgl.drawBufferInfo(gl, bufferInfo, gl.LINE_STRIP);

        twgl.bindFramebufferInfo(gl, null);
    }

    drawLine(x0, y0, x1, y1, size, color, isEraser, p0, p1, calculatePressureSize, layer) {
        // このメソッドは円を連続描画する旧方式。drawStrokeに移行したが互換性のため残す。
        if (!isFinite(x0) || !isFinite(y0) || !isFinite(x1) || !isFinite(y1)) return;
        const distance = Math.hypot(x1 - x0, y1 - y0);
        if (distance > this.superWidth * 2) return;

        const stepSize = Math.max(1.0, size / 3.0);
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

    getTransformedImageData(layer) {
        // ... (unchanged)
        return layer.imageData;
    }

    compositeLayers(layers, dirtyRect) {
        // ... (unchanged)
    }
    
    renderToDisplay(dirtyRect) {
        // ... (unchanged)
    }

    syncDirtyRectToImageData(layer, dirtyRect) {
        // ... (unchanged)
    }
}