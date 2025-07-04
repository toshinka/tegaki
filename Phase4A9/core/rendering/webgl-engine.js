/*
 * ===================================================================================
 * Toshinka Tegaki Tool - WebGL Engine
 * Version: 3.1.0 (Phase4A9: MVP Rendering & Brush Transform)
 *
 * - 修正：
 * - 1. MVP行列ベースのレンダリングパイプラインを構築:
 * -   `compositeLayers` は `core-engine` から `viewMatrix` と `projectionMatrix` を受け取り、
 * -   各レイヤーの `modelMatrix` と合成して `MVP行列` を生成し、シェーダーに渡す方式に変更。
 * -   これにより、描画と座標管理が完全に分離された。
 *
 * - 2. ブラシ描画の座標変換を実装:
 * -   `drawBrush` はワールド座標でストローク情報を受け取るように変更。
 * -   内部で対象レイヤーの `modelMatrix` の逆行列を使い、ワールド座標をレイヤーの
 * -   ローカル座標（テクスチャ座標）に変換してからFBOに描画するロジックを実装。
 * -   これにより、レイヤーが移動・回転・拡縮しても、正しい位置に描画される。
 *
 * - 3. シェーダーの統一と単純化:
 * -   レイヤー合成とブラシ描画前のテクスチャ準備に、共通のMVP対応シェーダーを使用するように整理。
 * ===================================================================================
 */
import { DrawingEngine } from './drawing-engine.js';
import { mat4, vec4 } from 'gl-matrix';

// Helper to create and compile a shader
function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

// Helper to create a shader program
function createProgram(gl, vsSource, fsSource) {
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    if (!vertexShader || !fragmentShader) return null;

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(program));
        return null;
    }
    return program;
}

export class WebGLEngine extends DrawingEngine {
    constructor(canvas) {
        super(canvas);
        this.gl = canvas.getContext('webgl', { preserveDrawingBuffer: true, premultipliedAlpha: false });
        if (!this.gl) {
            throw new Error('WebGL not supported');
        }

        const gl = this.gl;
        gl.enable(gl.BLEND);
        gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.clearColor(0.0, 0.0, 0.0, 0.0);
        
        this.SUPER_SAMPLING_FACTOR = 1.5;

        this.layerTextures = new Map();
        this.framebuffers = {};

        this._initBuffers();
        this._initShaders();
        this._initFramebuffers(canvas.width, canvas.height);
    }

    static isSupported() {
        try {
            const canvas = document.createElement('canvas');
            return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
        } catch (e) {
            return false;
        }
    }

    _initBuffers() {
        const gl = this.gl;
        // ユニットクワッド (-0.5 to 0.5) と UV (0 to 1)
        const positions = new Float32Array([
            -0.5, -0.5, 0.0, 0.0,
             0.5, -0.5, 1.0, 0.0,
            -0.5,  0.5, 0.0, 1.0,
             0.5,  0.5, 1.0, 1.0,
        ]);
        this.quadBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    }

    _initShaders() {
        const gl = this.gl;

        // 汎用頂点シェーダー (MVP)
        const vsSource = `
            attribute vec2 a_position;
            attribute vec2 a_texCoord;
            uniform mat4 u_mvpMatrix;
            varying vec2 v_texCoord;
            void main() {
                gl_Position = u_mvpMatrix * vec4(a_position, 0.0, 1.0);
                v_texCoord = a_texCoord;
            }
        `;

        // テクスチャ描画フラグメントシェーダー
        const fsTextureSource = `
            precision mediump float;
            varying vec2 v_texCoord;
            uniform sampler2D u_texture;
            uniform float u_opacity;
            void main() {
                vec4 color = texture2D(u_texture, v_texCoord);
                gl_FragColor = vec4(color.rgb, color.a * u_opacity);
            }
        `;

        // ブラシ描画フラグメントシェーダー
        const fsBrushSource = `
            precision highp float;
            uniform vec4 u_color;
            uniform float u_hardness;
            varying vec2 v_texCoord;
            void main() {
                float dist = distance(v_texCoord, vec2(0.5));
                float alpha = smoothstep(0.5, 0.5 * u_hardness, dist);
                gl_FragColor = vec4(u_color.rgb, u_color.a * alpha);
            }
        `;

        this.programs = {
            texture: createProgram(gl, vsSource, fsTextureSource),
            brush: createProgram(gl, vsSource, fsBrushSource),
        };
        
        this.programs.texture.locations = {
            a_position: gl.getAttribLocation(this.programs.texture, 'a_position'),
            a_texCoord: gl.getAttribLocation(this.programs.texture, 'a_texCoord'),
            u_mvpMatrix: gl.getUniformLocation(this.programs.texture, 'u_mvpMatrix'),
            u_texture: gl.getUniformLocation(this.programs.texture, 'u_texture'),
            u_opacity: gl.getUniformLocation(this.programs.texture, 'u_opacity'),
        };
        
        this.programs.brush.locations = {
            a_position: gl.getAttribLocation(this.programs.brush, 'a_position'),
            a_texCoord: gl.getAttribLocation(this.programs.brush, 'a_texCoord'),
            u_mvpMatrix: gl.getUniformLocation(this.programs.brush, 'u_mvpMatrix'),
            u_color: gl.getUniformLocation(this.programs.brush, 'u_color'),
            u_hardness: gl.getUniformLocation(this.programs.brush, 'u_hardness'),
        };
    }

    _createFramebuffer(width, height) {
        const gl = this.gl;
        const fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        
        return { fbo, texture };
    }

    _initFramebuffers(width, height) {
        const s_width = width * this.SUPER_SAMPLING_FACTOR;
        const s_height = height * this.SUPER_SAMPLING_FACTOR;
        
        // 描画処理中の一時バッファとして使用
        this.framebuffers.ping = this._createFramebuffer(s_width, s_height);
        this.framebuffers.pong = this._createFramebuffer(s_width, s_height);
    }

    updateLayerTexture(layer) {
        const gl = this.gl;
        let texture = this.layerTextures.get(layer.name);
        if (!texture) {
            texture = gl.createTexture();
            this.layerTextures.set(layer.name, texture);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, layer.imageData.width, layer.imageData.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, layer.imageData);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        } else {
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, layer.imageData);
        }
        gl.bindTexture(gl.TEXTURE_2D, null);
    }
    
    drawBrush(layer, strokePoints, brushSettings) {
        const gl = this.gl;
        const s_width = layer.imageData.width * this.SUPER_SAMPLING_FACTOR;
        const s_height = layer.imageData.height * this.SUPER_SAMPLING_FACTOR;

        // 1. 現在のレイヤーテクスチャをpingバッファに描画
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers.ping.fbo);
        gl.viewport(0, 0, s_width, s_height);
        gl.clear(gl.COLOR_BUFFER_BIT);

        const program = this.programs.texture;
        gl.useProgram(program);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.vertexAttribPointer(program.locations.a_position, 2, gl.FLOAT, false, 16, 0);
        gl.enableVertexAttribArray(program.locations.a_position);
        gl.vertexAttribPointer(program.locations.a_texCoord, 2, gl.FLOAT, false, 16, 8);
        gl.enableVertexAttribArray(program.locations.a_texCoord);

        const mvp = mat4.create();
        mat4.ortho(mvp, -0.5, 0.5, -0.5, 0.5, -1, 1); // FBO全体に描画するための単純な行列
        gl.uniformMatrix4fv(program.locations.u_mvpMatrix, false, mvp);
        gl.uniform1f(program.locations.u_opacity, 1.0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.layerTextures.get(layer.name));
        gl.uniform1i(program.locations.u_texture, 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        // 2. ブラシを描画
        const brushProgram = this.programs.brush;
        gl.useProgram(brushProgram);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); // 加算ブレンドで描画

        gl.uniform4fv(brushProgram.locations.u_color, brushSettings.color);
        gl.uniform1f(brushProgram.locations.u_hardness, 1.0 - brushSettings.hardness);

        const invModelMatrix = mat4.create();
        mat4.invert(invModelMatrix, layer.modelMatrix);

        strokePoints.forEach(p => {
            const brushMvp = mat4.create();
            const worldPos = vec4.fromValues(p.x, p.y, 0, 1);
            const localPos = vec4.create();
            vec4.transformMat4(localPos, worldPos, invModelMatrix);

            const brushModel = mat4.create();
            mat4.translate(brushModel, brushModel, [localPos[0], localPos[1], 0]);
            
            // ワールド単位の半径をローカル単位に変換
            const scale = Math.hypot(layer.modelMatrix[0], layer.modelMatrix[1]);
            const localRadius = brushSettings.radius / scale;
            mat4.scale(brushModel, brushModel, [localRadius, localRadius, 1]);

            mat4.ortho(brushMvp, -layer.imageData.width/2, layer.imageData.width/2, -layer.imageData.height/2, layer.imageData.height/2, -1, 1);
            mat4.multiply(brushMvp, brushMvp, brushModel);
            
            gl.uniformMatrix4fv(brushProgram.locations.u_mvpMatrix, false, brushMvp);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        });
        
        gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA); // ブレンドモードを戻す

        // 3. 結果をimageDataに読み戻す
        const pixels = new Uint8Array(s_width * s_height * 4);
        gl.readPixels(0, 0, s_width, s_height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        
        // 4. ダウンサンプリングして元のImageDataに書き込む (簡単のため簡易実装)
        // 本来は高品質なダウンサンプリングシェーダーを使うべき
        for(let y = 0; y < layer.imageData.height; y++) {
            for(let x = 0; x < layer.imageData.width; x++) {
                const sx = Math.floor(x * this.SUPER_SAMPLING_FACTOR);
                const sy = Math.floor(y * this.SUPER_SAMPLING_FACTOR);
                const s_idx = (sy * s_width + sx) * 4;
                const idx = (y * layer.imageData.width + x) * 4;
                layer.imageData.data[idx] = pixels[s_idx];
                layer.imageData.data[idx+1] = pixels[s_idx+1];
                layer.imageData.data[idx+2] = pixels[s_idx+2];
                layer.imageData.data[idx+3] = pixels[s_idx+3];
            }
        }
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    compositeLayers(layers, displayWidth, displayHeight, viewMatrix, projectionMatrix) {
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, displayWidth, displayHeight);
        gl.clear(gl.COLOR_BUFFER_BIT);

        const program = this.programs.texture;
        gl.useProgram(program);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.vertexAttribPointer(program.locations.a_position, 2, gl.FLOAT, false, 16, 0);
        gl.enableVertexAttribArray(program.locations.a_position);
        gl.vertexAttribPointer(program.locations.a_texCoord, 2, gl.FLOAT, false, 16, 8);
        gl.enableVertexAttribArray(program.locations.a_texCoord);

        const pvMatrix = mat4.create();
        mat4.multiply(pvMatrix, projectionMatrix, viewMatrix);

        layers.forEach(layer => {
            if (!layer.visible) return;
            const layerTexture = this.layerTextures.get(layer.name);
            if (!layerTexture) return;

            const mvpMatrix = mat4.create();
            mat4.multiply(mvpMatrix, pvMatrix, layer.modelMatrix);

            gl.uniformMatrix4fv(program.locations.u_mvpMatrix, false, mvpMatrix);
            gl.uniform1f(program.locations.u_opacity, layer.opacity / 100.0);
            
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, layerTexture);
            gl.uniform1i(program.locations.u_texture, 0);

            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        });
    }
}