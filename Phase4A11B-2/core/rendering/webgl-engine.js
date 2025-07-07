/*
 * ===================================================================================
 * Toshinka Tegaki Tool - WebGL Engine
 * Version: 4.4.0 (Phase 4A11B-4 - Y-Axis Unification)
 *
 * - 変更点 (Phase 4A11B-4):
 * - 📜 Phase4A11B-4 統合指示書に基づき、Y軸の座標系を完全に「Y軸下向き」に統一。
 * - 1. 投影行列 (Projection Matrix) の修正:
 * - mat4.ortho() の top と bottom を入れ替え、WebGLの座標系をCanvas 2Dと同じ「Y軸下向き」に変更。
 * - これにより、レイヤー移動時のY軸反転問題を根本的に解決。
 * - 2. 頂点バッファの修正:
 * - Y軸下向きの座標系に合わせて、クアッド（四角形）の頂点座標を再定義。
 * - 3. 手動Y軸反転の削除:
 * - 座標系が統一されたため、drawCircle() 内で行っていた手動のY軸反転処理を完全に削除。
 * - これにより、レイヤー移動後の描画ズレ問題を解消。
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
        
        // ✨ 座標系変換の要となる投影行列をプロパティとして保持
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

        // ✨ 投影行列をここで初期化
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

        console.log(`WebGL Engine (v4.4.0 Phase4A11B-4) initialized with ${this.superWidth}x${this.superHeight} internal resolution.`);
    }

    /**
     * ✅ Step 1: 射影行列のY軸の向きを修正
     * Y軸が下向き (bottom: superHeight, top: 0) になるように引数を入れ替える
     */
    _initProjectionMatrix() {
        this.projectionMatrix = mat4.create();
        mat4.ortho(this.projectionMatrix, 0, this.superWidth, this.superHeight, 0, -1, 1);
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
                
                // Y軸の向きが統一されたため、クリップスペースへの変換もシンプルになる
                vec2 center_clip = (u_center / u_resolution) * 2.0 - 1.0;
                // WebGLのクリップスペースはY軸が上向きなので、Y座標を反転させる
                // center_clip.y *= -1.0; // Phase 4A11B-4: Y軸統一のため不要

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
    
    /**
     * ✅ Step 2: 頂点バッファの座標定義をY軸下向きルールに合わせる
     */
    _initBuffers() {
        const gl = this.gl;
        this.positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);

        // Y軸が下向き (Y=0が上、Y=superHeightが下) の定義に修正
        const positions = [
            0, 0,                               // Top-Left
            0, this.superHeight,                // Bottom-Left
            this.superWidth, 0,                 // Top-Right
            this.superWidth, this.superHeight   // Bottom-Right
        ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

        this.texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        // 上記の頂点順序 (TL, BL, TR, BR) に合わせたテクスチャ座標
        // UNPACK_FLIP_Y_WEBGL: true のため、Y=1.0 がテクスチャの上に対応
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

    static isSupported() {
        try {
            const canvas = document.createElement('canvas');
            return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
        } catch (e) {
            return false;
        }
    }

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
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); // ImageDataのY軸は上から下、WebGLテクスチャのY軸は下から上なので反転
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, tempCanvas);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); // 元に戻す
            layer.gpuDirty = false;
        }
        return texture;
    }

    _setupSuperCompositingBuffer() {
        const gl = this.gl;
        // 最終的な合成結果を一時的に描画するためのテクスチャとFBO
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
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    _drawLayerToFBO(layer, targetFBO, clear = false) {
        const gl = this.gl;
        if (!gl || !layer || !layer.visible) return;

        const layerTexture = this._createOrUpdateLayerTexture(layer);
        if (!layerTexture) return;

        gl.bindFramebuffer(gl.FRAMEBUFFER, targetFBO);
        gl.viewport(0, 0, this.superWidth, this.superHeight);

        if (clear) {
            gl.clearColor(0.0, 0.0, 0.0, 0.0);
            gl.clear(gl.COLOR_BUFFER_BIT);
        }

        gl.useProgram(this.programs.compositor);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, layerTexture);
        gl.uniform1i(this.programs.compositor.locations.u_image, 0);
        gl.uniform1f(this.programs.compositor.locations.u_opacity, layer.opacity / 100.0);
        gl.uniform2f(this.programs.compositor.locations.u_source_resolution, layer.imageData.width, layer.imageData.height); // 元画像の解像度を渡す

        // MVP行列の計算: 投影行列 * モデル行列
        const mvpMatrix = mat4.create();
        mat4.multiply(mvpMatrix, this.projectionMatrix, layer.modelMatrix);
        gl.uniformMatrix4fv(this.programs.compositor.locations.u_mvpMatrix, false, mvpMatrix);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.vertexAttribPointer(this.programs.compositor.locations.a_position, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.programs.compositor.locations.a_position);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.vertexAttribPointer(this.programs.compositor.locations.a_texCoord, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.programs.compositor.locations.a_texCoord);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        gl.disableVertexAttribArray(this.programs.compositor.locations.a_position);
        gl.disableVertexAttribArray(this.programs.compositor.locations.a_texCoord);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    
    drawCircle(x, y, radius, color, isEraser, layer) {
        const gl = this.gl;
        if (!gl || !layer || !layer.visible) return;

        const layerFBO = this.layerFBOs.get(layer);
        if (!layerFBO) return;

        gl.bindFramebuffer(gl.FRAMEBUFFER, layerFBO);
        gl.viewport(0, 0, this.superWidth, this.superHeight);

        gl.useProgram(this.programs.brush);
        
        gl.uniform2f(this.programs.brush.locations.u_resolution, this.superWidth, this.superHeight);
        gl.uniform2f(this.programs.brush.locations.u_center, x * this.SUPER_SAMPLING_FACTOR, y * this.SUPER_SAMPLING_FACTOR);
        gl.uniform1f(this.programs.brush.locations.u_radius, radius * this.SUPER_SAMPLING_FACTOR);
        gl.uniform4f(this.programs.brush.locations.u_color, color.r / 255, color.g / 255, color.b / 255, color.a / 255);
        gl.uniform1i(this.programs.brush.locations.u_is_eraser, isEraser);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.brushPositionBuffer);
        gl.vertexAttribPointer(this.programs.brush.locations.a_position, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.programs.brush.locations.a_position);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        gl.disableVertexAttribArray(this.programs.brush.locations.a_position);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        
        layer.gpuDirty = true;
    }

    drawLine(x1, y1, x2, y2, baseSize, color, isEraser, pressure1, pressure2, calculatePressureSize, layer) {
        const gl = this.gl;
        if (!gl || !layer || !layer.visible) return;

        const layerFBO = this.layerFBOs.get(layer);
        if (!layerFBO) return;

        gl.bindFramebuffer(gl.FRAMEBUFFER, layerFBO);
        gl.viewport(0, 0, this.superWidth, this.superHeight);
        gl.useProgram(this.programs.brush);

        const dist = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
        if (dist === 0) {
            this.drawCircle(x1, y1, calculatePressureSize(baseSize, pressure1) / 2, color, isEraser, layer);
            return;
        }

        const segments = Math.max(2, Math.ceil(dist / (baseSize / 4))); // 線の滑らかさを調整
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const currentX = x1 + (x2 - x1) * t;
            const currentY = y1 + (y2 - y1) * t;
            const currentPressure = pressure1 + (pressure2 - pressure1) * t;
            const currentRadius = calculatePressureSize(baseSize, currentPressure) / 2;
            this.drawCircle(currentX, currentY, currentRadius, color, isEraser, layer);
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        layer.gpuDirty = true;
    }

    compositeLayers(layers, targetImageData, dirtyRect) {
        const gl = this.gl;
        if (!gl) return;

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.superCompositeFBO);
        gl.viewport(0, 0, this.superWidth, this.superHeight);
        gl.clearColor(0.0, 0.0, 0.0, 0.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // 各レイヤーを順番に合成
        for (const layer of layers) {
            if (layer.visible) {
                this._drawLayerToFBO(layer, this.superCompositeFBO, false); // クリアしない
            }
        }

        // FBOからImageDataに読み出す
        const sMinX = Math.floor(dirtyRect.minX * this.SUPER_SAMPLING_FACTOR);
        const sMinY = Math.floor(dirtyRect.minY * this.SUPER_SAMPLING_FACTOR);
        const sMaxX = Math.ceil(dirtyRect.maxX * this.SUPER_SAMPLING_FACTOR);
        const sMaxY = Math.ceil(dirtyRect.maxY * this.SUPER_SAMPLING_FACTOR);

        const sWidth = sMaxX - sMinX;
        const sHeight = sMaxY - sMinY;

        if (sWidth <= 0 || sHeight <= 0) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            return;
        }

        // WebGLから直接ImageDataに読み出す
        // readPixelsの範囲を指定
        gl.readBuffer(gl.COLOR_ATTACHMENT0);
        const superBuffer = new Uint8Array(sWidth * sHeight * 4);
        gl.readPixels(sMinX, sMinY, sWidth, sHeight, gl.RGBA, gl.UNSIGNED_BYTE, superBuffer);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        const targetData = targetImageData.data;
        const factor = this.SUPER_SAMPLING_FACTOR;
        
        for (let y = 0; y < (dirtyRect.maxY - dirtyRect.minY); y++) {
            for (let x = 0; x < (dirtyRect.maxX - dirtyRect.minX); x++) {
                const targetX = Math.floor(dirtyRect.minX) + x;
                const targetY = Math.floor(dirtyRect.minY) + y;
                if (targetX >= targetImageData.width || targetY >= targetImageData.height) continue;
                
                // readPixelsで読み取ったデータはYが下から上なので、ImageData(Yが上から下)に書き込むために反転する
                const sourceX = Math.round(x * factor);
                const sourceY = sHeight - 1 - Math.round(y * factor); // Y軸反転

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

    renderToDisplay(imageData, dirtyRect) {
        const gl = this.gl;
        if (!gl) return;

        // DisplayCanvasの2Dコンテキストを使用
        this.transformOffscreenCanvas.width = imageData.width;
        this.transformOffscreenCanvas.height = imageData.height;
        this.transformOffscreenCtx.putImageData(imageData, 0, 0);

        const displayCtx = this.canvas.getContext('2d');
        if (displayCtx) {
            displayCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            displayCtx.drawImage(
                this.transformOffscreenCanvas,
                dirtyRect.minX, dirtyRect.minY,
                dirtyRect.maxX - dirtyRect.minX, dirtyRect.maxY - dirtyRect.minY,
                dirtyRect.minX, dirtyRect.minY,
                dirtyRect.maxX - dirtyRect.minX, dirtyRect.maxY - dirtyRect.minY
            );
        }
    }

    // 必要に応じて、ImageDataをWebGLテクスチャに同期する関数
    syncDirtyRectToImageData(layer, dirtyRect) {
        const gl = this.gl;
        if (!gl || !layer) return;

        const layerFBO = this.layerFBOs.get(layer);
        if (!layerFBO) return;

        const sMinX = Math.floor(dirtyRect.minX * this.SUPER_SAMPLING_FACTOR);
        const sMinY = Math.floor(dirtyRect.minY * this.SUPER_SAMPLING_FACTOR);
        const sMaxX = Math.ceil(dirtyRect.maxX * this.SUPER_SAMPLING_FACTOR);
        const sMaxY = Math.ceil(dirtyRect.maxY * this.SUPER_SAMPLING_FACTOR);

        const sWidth = sMaxX - sMinX;
        const sHeight = sMaxY - sMinY;

        if (sWidth <= 0 || sHeight <= 0) return;

        gl.bindFramebuffer(gl.FRAMEBUFFER, layerFBO);
        gl.readBuffer(gl.COLOR_ATTACHMENT0);
        const superBuffer = new Uint8Array(sWidth * sHeight * 4);
        gl.readPixels(sMinX, sMinY, sWidth, sHeight, gl.RGBA, gl.UNSIGNED_BYTE, superBuffer);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        const targetImageData = layer.imageData;
        const targetData = targetImageData.data;
        const factor = this.SUPER_SAMPLING_FACTOR;
        
        for (let y = 0; y < (dirtyRect.maxY - dirtyRect.minY); y++) {
            for (let x = 0; x < (dirtyRect.maxX - dirtyRect.minX); x++) {
                const targetX = Math.floor(dirtyRect.minX) + x;
                const targetY = Math.floor(dirtyRect.minY) + y;
                if (targetX >= targetImageData.width || targetY >= targetImageData.height) continue;
                
                // readPixelsで読み取ったデータはYが下から上なので、ImageData(Yが上から下)に書き込むために反転する
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