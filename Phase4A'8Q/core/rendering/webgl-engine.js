/*
 * ===================================================================================
 * Toshinka Tegaki Tool - WebGL Engine
 * Version: 4.0.0 (Layer Transform with modelMatrix - Phase4A9)
 *
 * - 改修：
 * - 1. レイヤーごとのモデル行列(modelMatrix)に対応:
 * -   各レイヤーが持つ modelMatrix を uniform 変数としてシェーダーに渡し、
 * -   GPU上で直接、レイヤーの移動・回転・拡縮を適用するように変更。
 * -   これにより、画質劣化のない非破壊的なレイヤー変形を実現。
 *
 * - 2. Y軸反転処理のシェーダーへの集約:
 * -   指示書に基づき、座標系のY軸反転をすべて頂点シェーダー内で行うように統一。
 * -   JS側で `superHeight - y` のような計算を行っていた箇所を削除し、
 * -   座標系の混乱に起因する描画ズレのリスクを根本的に解消。
 *
 * - 3. 破壊的変形処理の廃止:
 * -   非破壊変形の導入に伴い、ピクセルを直接書き換えていた高負荷な
 * -   `getTransformedImageData` メソッドを廃止し、コードをシンプル化。
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
        
        // ★★★ Phase4A9 改修: 正投影行列をプロパティとして保持 ★★★
        this.projectionMatrix = glMatrix.mat4.create();
        
        this.programs = { compositor: null, brush: null };
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
        
        // ★★★ Phase4A9 改修: 正投影行列を初期化 ★★★
        // Y軸が下向き（HTMLの座標系と同じ）になるように設定
        glMatrix.mat4.ortho(this.projectionMatrix, 0, this.superWidth, this.superHeight, 0, -1, 1);

        console.log(`WebGL Engine (v4.0.0 Layer Transform) initialized with ${this.superWidth}x${this.superHeight} internal resolution.`);
    }

    _initShaderPrograms() {
        // ★★★★★ Phase4A9 改修: レイヤー変形とY軸反転を行う頂点シェーダー ★★★★★
        const vsCompositor = `
            attribute vec4 a_position; // 描画する四角形の頂点座標
            attribute vec2 a_texCoord; // テクスチャ座標
            
            // modelMatrix(レイヤー変形)とprojectionMatrix(投影)を乗算済みの行列
            uniform mat4 u_mvpMatrix; 
            
            varying vec2 v_texCoord;
            void main() {
                // モデル変形と投影を適用して頂点の最終位置を決定
                gl_Position = u_mvpMatrix * a_position;
                
                // テクスチャ座標はそのままフラグメントシェーダーへ渡す
                // Y軸反転は行列で行うため、ここでは何もしない
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

        // ★★★★★ Phase4A9 改修: ブラシ描画用の頂点シェーダーもY軸反転に対応 ★★★★★
        const vsBrush = `
            precision mediump float;
            attribute vec2 a_position; 
            
            uniform mat4 u_projectionMatrix; // ブラシ描画も全体の投影に合わせる
            uniform vec2 u_center;
            uniform float u_radius;
            varying vec2 v_texCoord;

            void main() {
                // ブラシの四角形をピクセル単位で定義
                vec2 quad_pos = a_position * (u_radius * 2.0 + 2.0) + u_center;
                
                // 投影行列を適用してクリップ座標に変換
                gl_Position = u_projectionMatrix * vec4(quad_pos, 0.0, 1.0);
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
        // ★★★ Phase4A9 改修: レイヤーの頂点バッファをピクセル単位に変更 ★★★
        // レイヤーはそれぞれ原点(0,0)を持つサイズ可変のオブジェクトとして扱う
        this.positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        const positions = [
            0.0, 0.0, // 左上
            this.width, 0.0, // 右上
            0.0, this.height, // 左下
            this.width, this.height, // 右下
        ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

        this.texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        // テクスチャ座標は 0.0-1.0 のまま
        const texCoords = [ 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 1.0, 1.0 ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);
        
        this.brushPositionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.brushPositionBuffer);
        // ブラシの頂点は-0.5~0.5の単位四角形
        const brushPositions = [ -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5 ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(brushPositions), gl.STATIC_DRAW);
    }

    _compileShader(source, type) { const gl = this.gl; const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader); if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { console.error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader)); gl.deleteShader(shader); return null; } return shader; }
    _createProgram(vsSource, fsSource) { const gl = this.gl; const vs = this._compileShader(vsSource, gl.VERTEX_SHADER); const fs = this._compileShader(fsSource, gl.FRAGMENT_SHADER); if (!vs || !fs) return null; const program = gl.createProgram(); gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program); if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { console.error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(program)); gl.deleteProgram(program); return null; } program.locations = {}; const locs = (p) => { p.locations.a_position = gl.getAttribLocation(p, 'a_position'); p.locations.a_texCoord = gl.getAttribLocation(p, 'a_texCoord'); p.locations.u_image = gl.getUniformLocation(p, 'u_image'); p.locations.u_opacity = gl.getUniformLocation(p, 'u_opacity'); p.locations.u_center = gl.getUniformLocation(p, 'u_center'); p.locations.u_radius = gl.getUniformLocation(p, 'u_radius'); p.locations.u_color = gl.getUniformLocation(p, 'u_color'); p.locations.u_is_eraser = gl.getUniformLocation(p, 'u_is_eraser'); p.locations.u_mvpMatrix = gl.getUniformLocation(p, 'u_mvpMatrix'); p.locations.u_projectionMatrix = gl.getUniformLocation(p, 'u_projectionMatrix'); }; locs(program); return program; }
    static isSupported() { try { const canvas = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))); } catch (e) { return false; } }

    _createOrUpdateLayerTexture(layer) {
        const gl = this.gl;
        let texture = this.layerTextures.get(layer);
        let fbo = this.layerFBOs.get(layer);

        const targetWidth = this.width; // テクスチャ自体のサイズは不変
        const targetHeight = this.height;

        if (!texture) {
            texture = gl.createTexture();
            this.layerTextures.set(layer, texture);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, targetWidth, targetHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
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
                 gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, layer.imageData);
            }
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        }

        if (layer.gpuDirty) {
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, layer.imageData);
            gl.bindTexture(gl.TEXTURE_2D, null);
            layer.gpuDirty = false;
        }
    }
    
    _setupSuperCompositingBuffer() {
        // この関数はスーパーサンプリング用の中間バッファを作成します。
        // レイヤー変形とは直接関係ないため、処理は変更しません。
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
        if (!targetFBO) return;

        gl.bindFramebuffer(gl.FRAMEBUFFER, targetFBO);
        gl.viewport(0, 0, this.width, this.height);
        
        gl.enable(gl.SCISSOR_TEST);
        gl.scissor(0, 0, this.width, this.height);
        
        gl.useProgram(program);
        this._setBlendMode('normal', isEraser);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.brushPositionBuffer);
        gl.vertexAttribPointer(program.locations.a_position, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(program.locations.a_position);
        
        // ★★★ Phase4A9 修正: Y軸反転処理を削除し、シェーダーに任せる ★★★
        const projectionMatrixForBrush = glMatrix.mat4.create();
        glMatrix.mat4.ortho(projectionMatrixForBrush, 0, this.width, this.height, 0, -1, 1);

        gl.uniformMatrix4fv(program.locations.u_projectionMatrix, false, projectionMatrixForBrush);
        gl.uniform2f(program.locations.u_center, centerX, centerY); // Y座標をそのまま渡す
        gl.uniform1f(program.locations.u_radius, radius);
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

    // ★★★ Phase4A9 廃止: 非破壊変形に移行するため不要に ★★★
    // getTransformedImageData() {}

    compositeLayers(layers, compositionData, dirtyRect) {
        if (!this.gl || !this.programs.compositor || !this.superCompositeFBO) return;
        const gl = this.gl;
        const program = this.programs.compositor;

        for (const layer of layers) {
            this._createOrUpdateLayerTexture(layer);
        }
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.superCompositeFBO);
        gl.viewport(0, 0, this.superWidth, this.superHeight);
        gl.enable(gl.SCISSOR_TEST);
        gl.scissor(0, 0, this.superWidth, this.superHeight);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(program);
        
        // ★★★ Phase4A9 改修: 頂点バッファのセットアップ ★★★
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.vertexAttribPointer(program.locations.a_position, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(program.locations.a_position);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.vertexAttribPointer(program.locations.a_texCoord, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(program.locations.a_texCoord);
        
        for (const layer of layers) {
            if (!layer.visible || layer.opacity === 0 || !this.layerTextures.has(layer) || !layer.modelMatrix) continue;

            this._setBlendMode(layer.blendMode);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.layerTextures.get(layer));
            
            // ★★★ Phase4A9 改修: MVP行列を計算してシェーダーに送信 ★★★
            const mvpMatrix = glMatrix.mat4.create();
            // 投影行列とモデル行列を掛け合わせる
            glMatrix.mat4.multiply(mvpMatrix, this.projectionMatrix, layer.modelMatrix);
            
            const u_mvpMatrixLoc = program.locations.u_mvpMatrix;
            if (u_mvpMatrixLoc) {
                gl.uniformMatrix4fv(u_mvpMatrixLoc, false, mvpMatrix);
            }

            gl.uniform1i(program.locations.u_image, 0);
            gl.uniform1f(program.locations.u_opacity, layer.opacity / 100.0);
            
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }

        gl.disable(gl.SCISSOR_TEST);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.disableVertexAttribArray(program.locations.a_position);
        gl.disableVertexAttribArray(program.locations.a_texCoord);
    }
    
    renderToDisplay(compositionData, dirtyRect) {
        if (!this.gl || !this.superCompositeTexture) return;
        const gl = this.gl;
        const program = this.programs.compositor;

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        this._setBlendMode('normal');

        gl.useProgram(program);

        // ★★★ Phase4A9 改修: 画面表示用の頂点設定 ★★★
        // 画面全体に描画するための-1~1のクリップ座標を直接使う
        const screenPosBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, screenPosBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,1, 1,1, -1,-1, 1,-1]), gl.STATIC_DRAW);
        gl.vertexAttribPointer(program.locations.a_position, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(program.locations.a_position);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.vertexAttribPointer(program.locations.a_texCoord, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(program.locations.a_texCoord);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.superCompositeTexture);

        // ★★★ Phase4A9 改修: 画面表示では単位行列を使用（変形は既に適用済み） ★★★
        const mvpMatrix = glMatrix.mat4.create(); // 単位行列
        gl.uniformMatrix4fv(program.locations.u_mvpMatrix, false, mvpMatrix);
        
        gl.uniform1i(program.locations.u_image, 0);
        gl.uniform1f(program.locations.u_opacity, 1.0);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        
        gl.deleteBuffer(screenPosBuffer);
        gl.disableVertexAttribArray(program.locations.a_position);
        gl.disableVertexAttribArray(program.locations.a_texCoord);
    }

    syncDirtyRectToImageData(layer, dirtyRect) {
        const gl = this.gl;
        const fbo = this.layerFBOs.get(layer);
        if (!fbo || dirtyRect.minX > dirtyRect.maxX) return;

        // ★★★ Phase4A9 修正: スーパーサンプリングではなく等倍で読み出す ★★★
        const sx = Math.floor(dirtyRect.minX);
        const sy = Math.floor(dirtyRect.minY);
        const sWidth = Math.ceil(dirtyRect.maxX - dirtyRect.minX);
        const sHeight = Math.ceil(dirtyRect.maxY - dirtyRect.minY);

        if (sWidth <= 0 || sHeight <= 0) return;

        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        const buffer = new Uint8Array(sWidth * sHeight * 4);
        
        // ★★★ Phase4A9 修正: Y軸反転がシェーダーで行われたので、JSでの反転計算は不要 ★★★
        gl.readPixels(sx, sy, sWidth, sHeight, gl.RGBA, gl.UNSIGNED_BYTE, buffer);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        const targetImageData = layer.imageData;
        const targetData = targetImageData.data;
        
        // 読み取ったバッファをImageDataに書き戻す
        for (let y = 0; y < sHeight; y++) {
            for (let x = 0; x < sWidth; x++) {
                const targetX = sx + x;
                const targetY = sy + y;
                if (targetX >= targetImageData.width || targetY >= targetImageData.height) continue;
                
                const sourceIndex = (y * sWidth + x) * 4;
                const targetIndex = (targetY * targetImageData.width + targetX) * 4;

                targetData[targetIndex]     = buffer[sourceIndex];
                targetData[targetIndex + 1] = buffer[sourceIndex + 1];
                targetData[targetIndex + 2] = buffer[sourceIndex + 2];
                targetData[targetIndex + 3] = buffer[sourceIndex + 3];
            }
        }
    }
}