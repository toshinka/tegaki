import { StrokeRenderer } from './DrawingEngine.js';
import { mat4 } from 'gl-matrix';
import * as twgl from 'twgl.js';
// ---⬇️ ここから変更 ⬇️ ---
import { toolStore } from '../features/tools/ToolStore.js';
// --- ⬆️ ここまで変更 ⬆️ ---

/**
 * [クラス責務] WebGLRenderer.js
 * 目的：DrawingEngineの仕様に基づき、WebGL APIを使用して具体的な描画処理をすべて担当する。
 * 主な役割は、シェーダー管理、テクスチャ操作、オフスクリーンレンダリング（FBO）、そして最終的な描画命令の発行。
 * (変更後クラス名: LayerRendererGL)
 */
// 変更: WebGLRenderer extends DrawingEngine -> LayerRendererGL extends StrokeRenderer
export class LayerRendererGL extends StrokeRenderer { 
    constructor(canvas) {
        super(canvas);
        // 変更：指示書に基づき、WebGLエラーチェックを徹底
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
        
        this.projectionMatrix = null;
        this.programs = { compositor: null, brush: null, line: null }; // 追加: lineプログラム
        this.positionBuffer = null;
        this.texCoordBuffer = null;
        this.brushPositionBuffer = null;
        
        this.superCompositeTexture = null;
        this.superCompositeFBO = null;
        
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
            this.gl = null; // Mark as uninitialized
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
    
    // 変更：指示書に基づき、WebGLエラーチェック用のヘルパー関数を定義
    _checkGLError(operation) {
        if(!this.gl) return;
        const error = this.gl.getError();
        if (error !== this.gl.NO_ERROR) {
            let errorMsg = "Unknown error";
            switch(error) {
                case this.gl.INVALID_ENUM: errorMsg = "INVALID_ENUM"; break;
                case this.gl.INVALID_VALUE: errorMsg = "INVALID_VALUE"; break;
                case this.gl.INVALID_OPERATION: errorMsg = "INVALID_OPERATION"; break;
                case this.gl.INVALID_FRAMEBUFFER_OPERATION: errorMsg = "INVALID_FRAMEBUFFER_OPERATION"; break;
                case this.gl.OUT_OF_MEMORY: errorMsg = "OUT_OF_MEMORY"; break;
                case this.gl.CONTEXT_LOST_WEBGL: errorMsg = "CONTEXT_LOST_WEBGL"; break;
            }
            console.error(`❌ WebGL ERROR: ${errorMsg} at [${operation}]`);
        }
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
        const vsCompositor = `
            attribute vec2 a_position; attribute vec2 a_texCoord;
            uniform mat4 u_mvpMatrix; varying vec2 v_texCoord;
            void main() { gl_Position = u_mvpMatrix * vec4(a_position, 0.0, 1.0); v_texCoord = a_texCoord; }`;
        const fsCompositor = `
            precision highp float; varying vec2 v_texCoord;
            uniform sampler2D u_image; uniform float u_opacity;
            void main() { vec4 color = texture2D(u_image, v_texCoord); gl_FragColor = vec4(color.rgb, color.a * u_opacity); }`;
        const vsBrush = `
            precision highp float; attribute vec2 a_position;
            uniform mat4 u_mvpMatrix;
            void main() { gl_Position = u_mvpMatrix * vec4(a_position, 0.0, 1.0); }`;
        const fsBrush = `
            precision highp float;
            uniform vec4 u_color; uniform bool u_is_eraser;
            void main() {
                float dist = distance(gl_PointCoord, vec2(0.5));
                float alpha = 1.0 - smoothstep(0.48, 0.5, dist);
                if (alpha < 0.01) discard;
                if (u_is_eraser) {
                    gl_FragColor = vec4(0.0, 0.0, 0.0, alpha); 
                } else {
                    gl_FragColor = vec4(u_color.rgb, u_color.a * alpha);
                }
            }`;
            
        // 追加: 線画用のシェーダー
        const vsLine = `
            attribute vec2 a_position;
            uniform mat4 u_mvpMatrix;
            void main() { gl_Position = u_mvpMatrix * vec4(a_position, 0.0, 1.0); }`;
        const fsLine = `
            precision highp float;
            uniform vec4 u_color;
            uniform bool u_is_eraser;
            void main() {
                if (u_is_eraser) {
                    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
                } else {
                    gl_FragColor = u_color;
                }
            }`;
        
        this.programs.compositor = twgl.createProgramInfo(this.gl, [vsCompositor, fsCompositor]);
        this._checkGLError('createProgramInfo compositor');
        this.programs.brush = twgl.createProgramInfo(this.gl, [vsBrush, fsBrush]);
        this._checkGLError('createProgramInfo brush');
        this.programs.line = twgl.createProgramInfo(this.gl, [vsLine, fsLine]);
        this._checkGLError('createProgramInfo line');
    }
    
    _initBuffers() {
        const gl = this.gl;
        const positions = [0, 0, 0, this.superHeight, this.superWidth, 0, this.superWidth, this.superHeight];
        const texCoords = [0.0, 1.0, 0.0, 0.0, 1.0, 1.0, 1.0, 0.0];
        
        this.positionBuffer = twgl.createBufferInfoFromArrays(gl, { a_position: { numComponents: 2, data: positions } });
        this._checkGLError('_initBuffers positionBuffer');
        this.texCoordBuffer = twgl.createBufferInfoFromArrays(gl, { a_texCoord: { numComponents: 2, data: texCoords } });
        this._checkGLError('_initBuffers texCoordBuffer');
        
        this.brushPositionBuffer = null;
    }

    _createOrUpdateLayerTexture(layer) {
        // ... (unchanged) ...
        const gl = this.gl;
        if (!this.layerFBOs.has(layer)) {
            const attachments = [{ format: gl.RGBA, type: gl.UNSIGNED_BYTE, min: gl.LINEAR, mag: gl.LINEAR, wrap: gl.CLAMP_TO_EDGE }];
            const fbo = twgl.createFramebufferInfo(gl, attachments, this.superWidth, this.superHeight);
            this._checkGLError(`_createOrUpdateLayerTexture createFramebufferInfo for layer ${layer.id}`);
            this.layerFBOs.set(layer, fbo);
            this.layerTextures.set(layer, fbo.attachments[0]);
        }

        const sourceImageData = layer.transformStage || layer.imageData;
        if (layer.gpuDirty && sourceImageData) {
            const texture = this.layerTextures.get(layer);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            this._checkGLError(`_createOrUpdateLayerTexture bindTexture for layer ${layer.id}`);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
            this._checkGLError(`_createOrUpdateLayerTexture pixelStorei UNPACK_FLIP_Y_WEBGL true`);
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, sourceImageData);
            this._checkGLError(`_createOrUpdateLayerTexture texSubImage2D for layer ${layer.id}`);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
            this._checkGLError(`_createOrUpdateLayerTexture pixelStorei UNPACK_FLIP_Y_WEBGL false`);
            gl.bindTexture(gl.TEXTURE_2D, null);
            this._checkGLError(`_createOrUpdateLayerTexture unbindTexture for layer ${layer.id}`);
            layer.gpuDirty = false;
        }
    }
    
    _setupSuperCompositingBuffer() {
        // ... (unchanged) ...
        const gl = this.gl;
        const attachments = [{ format: gl.RGBA, min: gl.LINEAR, mag: gl.LINEAR, wrap: gl.CLAMP_TO_EDGE }];
        const fbo = twgl.createFramebufferInfo(gl, attachments, this.superWidth, this.superHeight);
        this._checkGLError('_setupSuperCompositingBuffer createFramebufferInfo');
        this.superCompositeFBO = fbo;
        this.superCompositeTexture = fbo.attachments[0];
    }
    
    _setBlendMode(blendMode, isEraser = false) {
        // ... (unchanged) ...
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
                default: // 'normal'
                    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA); 
                    break;
            }
        }
        this._checkGLError(`_setBlendMode ${blendMode} eraser:${isEraser}`);
    }

    drawCircle(centerX, centerY, radius, color, isEraser, layer) {
        // ---⬇️ ここから変更 ⬇️ ---
        let finalColor = color;
        if (!finalColor) {
            // 指示書に基づき、mainColorがnullの場合のフォールバック処理を追加
            const state = toolStore.getState();
            const hex = state.mainColor || '#800000'; // fallback
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            finalColor = { r, g, b, a: 1.0 };
        }
        // --- ⬆️ ここまで変更 ⬆️ ---

        if (!this.gl) return;
        const gl = this.gl;
        
        this._createOrUpdateLayerTexture(layer);
        const targetFBO = this.layerFBOs.get(layer);
        if (!targetFBO) {
            console.error("❌ LayerRendererGL.drawCircle: Target FBO not found for layer.", layer);
            return;
        }

        twgl.bindFramebufferInfo(gl, targetFBO);
        this._checkGLError('drawCircle bindFramebufferInfo');
        
        gl.useProgram(this.programs.brush.program);
        this._checkGLError('drawCircle useProgram');

        this._setBlendMode('normal', isEraser);

        const modelMatrix = mat4.create();
        const mvpMatrix = mat4.create();
        mat4.multiply(mvpMatrix, this.projectionMatrix, modelMatrix);
        
        const modelMatrixCircle = mat4.create();
        mat4.translate(modelMatrixCircle, modelMatrixCircle, [centerX, centerY, 0]);
        mat4.scale(modelMatrixCircle, modelMatrixCircle, [radius, radius, 1]); 
        mat4.multiply(mvpMatrix, this.projectionMatrix, modelMatrixCircle);

        if (!this.brushPositionBuffer) {
             const brushPositions = [ -1, 1, -1, -1, 1, 1, 1, -1 ];
             this.brushPositionBuffer = twgl.createBufferInfoFromArrays(gl, { a_position: { numComponents: 2, data: brushPositions } });
             this._checkGLError('drawCircle create brushPositionBuffer');
        }
        
        const fsBrushSimple = `
            precision highp float;
            varying vec2 v_texCoord; 
            uniform vec4 u_color;
            uniform bool u_is_eraser;
            void main() {
                float dist = distance(v_texCoord, vec2(0.5));
                if (dist > 0.5) discard;
                float alpha = 1.0 - smoothstep(0.45, 0.5, dist);
                if (u_is_eraser) {
                    gl_FragColor = vec4(0.0, 0.0, 0.0, alpha);
                } else {
                    gl_FragColor = vec4(u_color.rgb, u_color.a * alpha);
                }
            }`;
        const vsBrushSimple = `
            attribute vec2 a_position;
            uniform mat4 u_mvpMatrix;
            varying vec2 v_texCoord;
            void main() {
                gl_Position = u_mvpMatrix * vec4(a_position, 0.0, 1.0);
                v_texCoord = a_position * 0.5 + 0.5;
            }`;

        if(!this.programs.brush.simple) {
            this.programs.brush = twgl.createProgramInfo(gl, [vsBrushSimple, fsBrushSimple]);
            this.programs.brush.simple = true;
            this._checkGLError('drawCircle re-create brush program');
        }
        
        gl.useProgram(this.programs.brush.program);
        twgl.setBuffersAndAttributes(gl, this.programs.brush, this.brushPositionBuffer);
        this._checkGLError('drawCircle setBuffersAndAttributes');
        twgl.setUniforms(this.programs.brush, {
            u_mvpMatrix: mvpMatrix,
            // ---⬇️ ここから変更 ⬇️ ---
            u_color: [finalColor.r / 255, finalColor.g / 255, finalColor.b / 255, finalColor.a],
            // --- ⬆️ ここまで変更 ⬆️ ---
            u_is_eraser: isEraser,
        });
        this._checkGLError('drawCircle setUniforms (simple)');

        twgl.drawBufferInfo(gl, this.brushPositionBuffer, gl.TRIANGLE_STRIP);
        this._checkGLError('drawCircle drawBufferInfo');
        
        twgl.bindFramebufferInfo(gl, null);
        this._checkGLError('drawCircle unbindFramebufferInfo');
    }
    
    drawLine(x0, y0, x1, y1, size, color, isEraser, p0, p1, calculatePressureSize, layer) {
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
            this.drawCircle(x, y, adjustedSize, color, isEraser, layer);
        }
    }

    /**
     * [関数責務] 指示書に基づき、単一の線分を gl.LINE_STRIP を使って描画する。
     */
    drawLineSegment(x0, y0, x1, y1, size, color, isEraser, layer) {
        // ---⬇️ ここから変更 ⬇️ ---
        let finalColor = color;
        if (!finalColor) {
            // 指示書に基づき、mainColorがnullの場合のフォールバック処理を追加
            const state = toolStore.getState();
            const hex = state.mainColor || '#800000'; // fallback
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            finalColor = { r, g, b, a: 1.0 };
        }
        // --- ⬆️ ここまで変更 ⬆️ ---

        if (!this.gl) return;
        const gl = this.gl;

        this._createOrUpdateLayerTexture(layer);
        const targetFBO = this.layerFBOs.get(layer);
        if (!targetFBO) {
            console.warn("⚠️ LayerRendererGL.drawLineSegment: Target FBO not found for layer.", layer);
            return;
        }

        if (!this.programs.line) {
            console.warn("⚠️ LayerRendererGL.drawLineSegment: Line shader program not initialized.");
            return;
        }

        twgl.bindFramebufferInfo(gl, targetFBO);
        this._checkGLError('drawLineSegment bindFramebufferInfo');

        gl.useProgram(this.programs.line.program);
        this._checkGLError('drawLineSegment useProgram');

        this._setBlendMode(layer.blendMode, isEraser);

        const lineVertices = [x0, y0, x1, y1];
        const bufferInfo = twgl.createBufferInfoFromArrays(gl, {
            a_position: { numComponents: 2, data: lineVertices }
        });
        twgl.setBuffersAndAttributes(gl, this.programs.line, bufferInfo);
        this._checkGLError('drawLineSegment setBuffersAndAttributes');

        const mvpMatrix = mat4.create();
        mat4.multiply(mvpMatrix, this.projectionMatrix, this.identityMatrix);

        twgl.setUniforms(this.programs.line, {
            u_mvpMatrix: mvpMatrix,
            // ---⬇️ ここから変更 ⬇️ ---
            u_color: [finalColor.r / 255, finalColor.g / 255, finalColor.b / 255, finalColor.a],
            // --- ⬆️ ここまで変更 ⬆️ ---
            u_is_eraser: isEraser,
        });
        this._checkGLError('drawLineSegment setUniforms');
        
        gl.lineWidth(Math.max(1, size));
        this._checkGLError('drawLineSegment lineWidth');

        twgl.drawBufferInfo(gl, bufferInfo, gl.LINE_STRIP);
        this._checkGLError('drawLineSegment drawBufferInfo');

        twgl.bindFramebufferInfo(gl, null);
        this._checkGLError('drawLineSegment unbindFramebufferInfo');
    }

    getTransformedImageData(layer) {
        // ... (unchanged) ...
        return layer.imageData;
    }

    compositeLayers(layers, dirtyRect) {
        // ... (unchanged) ...
        if (!this.gl) return;
        const gl = this.gl;
        layers.forEach(layer => this._createOrUpdateLayerTexture(layer));
        
        twgl.bindFramebufferInfo(gl, this.superCompositeFBO);
        this._checkGLError('compositeLayers bindFramebufferInfo');
        gl.viewport(0, 0, this.superWidth, this.superHeight);
        this._checkGLError('compositeLayers viewport');
        gl.clear(gl.COLOR_BUFFER_BIT);
        this._checkGLError('compositeLayers clear');

        gl.useProgram(this.programs.compositor.program);
        this._checkGLError('compositeLayers useProgram');
        
        const bufferInfo = twgl.createBufferInfoFromArrays(gl, {
           a_position: this.positionBuffer.attribs.a_position,
           a_texCoord: this.texCoordBuffer.attribs.a_texCoord
        });
        this._checkGLError('compositeLayers create combined buffer');
        twgl.setBuffersAndAttributes(gl, this.programs.compositor, bufferInfo);
        this._checkGLError('compositeLayers setBuffersAndAttributes');
        
        for (const layer of layers) {
            if (!layer.visible || layer.opacity === 0 || !this.layerTextures.has(layer)) continue;
            
            const mvpMatrix = mat4.create();
            mat4.multiply(mvpMatrix, this.projectionMatrix, layer.modelMatrix);
            this._setBlendMode(layer.blendMode);

            twgl.setUniforms(this.programs.compositor, {
                u_mvpMatrix: mvpMatrix,
                u_image: this.layerTextures.get(layer),
                u_opacity: layer.opacity / 100.0
            });
            this._checkGLError(`compositeLayers setUniforms for layer ${layer.id}`);
            twgl.drawBufferInfo(gl, bufferInfo, gl.TRIANGLE_STRIP);
            this._checkGLError(`compositeLayers drawBufferInfo for layer ${layer.id}`);
        }
        
        twgl.bindFramebufferInfo(gl, null);
        this._checkGLError('compositeLayers unbindFramebufferInfo');
    }
    
    renderToDisplay(dirtyRect) {
        // ... (unchanged) ...
        if (!this.gl) return;
        const gl = this.gl;
        twgl.bindFramebufferInfo(gl, null);
        this._checkGLError('renderToDisplay bindFramebufferInfo (null)');
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        this._checkGLError('renderToDisplay viewport');
        gl.clear(gl.COLOR_BUFFER_BIT); 
        this._checkGLError('renderToDisplay clear');
        
        this._setBlendMode('normal');
        gl.useProgram(this.programs.compositor.program);
        this._checkGLError('renderToDisplay useProgram');

        const mvpMatrix = mat4.create();
        const screenProjection = mat4.create();
        mat4.ortho(screenProjection, 0, this.width, this.height, 0, -1, 1);
        mat4.multiply(mvpMatrix, screenProjection, this.identityMatrix);
        
        const bufferInfo = twgl.createBufferInfoFromArrays(gl, {
           a_position: { numComponents: 2, data: [0, 0, 0, this.height, this.width, 0, this.width, this.height] },
           a_texCoord: { numComponents: 2, data: [0.0, 1.0, 0.0, 0.0, 1.0, 1.0, 1.0, 0.0] }
        });
        this._checkGLError('renderToDisplay create buffer');

        twgl.setBuffersAndAttributes(gl, this.programs.compositor, bufferInfo);
        this._checkGLError('renderToDisplay setBuffersAndAttributes');
        twgl.setUniforms(this.programs.compositor, {
            u_mvpMatrix: mvpMatrix,
            u_image: this.superCompositeTexture,
            u_opacity: 1.0,
        });
        this._checkGLError('renderToDisplay setUniforms');
        
        twgl.drawBufferInfo(gl, bufferInfo, gl.TRIANGLE_STRIP);
        this._checkGLError('renderToDisplay drawBufferInfo');
    }

    syncDirtyRectToImageData(layer, dirtyRect) {
        // ... (unchanged) ...
        if (!this.gl) return;
        const gl = this.gl;
        const fboInfo = this.layerFBOs.get(layer);
        if (!fboInfo || !dirtyRect || dirtyRect.minX > dirtyRect.maxX) return;
        
        const sx = Math.floor(dirtyRect.minX);
        const sy = Math.floor(dirtyRect.minY);
        const sWidth = Math.ceil(dirtyRect.maxX - sx);
        const sHeight = Math.ceil(dirtyRect.maxY - sy);
        if (sWidth <= 0 || sHeight <= 0) return;

        twgl.bindFramebufferInfo(gl, fboInfo);
        this._checkGLError('syncDirtyRectToImageData bindFramebufferInfo');
        const superBuffer = new Uint8Array(sWidth * sHeight * 4);
        
        const readY = this.superHeight - (sy + sHeight);
        gl.readPixels(sx, readY, sWidth, sHeight, gl.RGBA, gl.UNSIGNED_BYTE, superBuffer);
        this._checkGLError('syncDirtyRectToImageData readPixels');
        twgl.bindFramebufferInfo(gl, null);
        this._checkGLError('syncDirtyRectToImageData unbindFramebufferInfo');
        
        const targetImageData = layer.imageData;
    }
}