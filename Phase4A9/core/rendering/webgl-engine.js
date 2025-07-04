/*
 * ===================================================================================
 * Toshinka Tegaki Tool - WebGL Engine
 * Version: 3.0.0 (Super-Sampling & Quality Revamp)
 *
 * - 修正：
 * - 1. スーパーサンプリングの描画フローを抜本的に改善:
 * -   AI提案の「レンダー・トゥ・テクスチャ」方式を全面的に採用。
 * -   中間合成用のフレームバッファ(compositeFBO)を高解像度(スーパーサンプリング)で作成するように変更。
 * -   これにより、高解像度レイヤーを高解像度のまま合成し、画質劣化を完全に防ぐ。
 *
 * - 2. 高品質なダウンサンプリングの実装:
 * -   全レイヤーの合成が完了した高解像度のテクスチャを、画面表示用のキャンバスへ
 * -   描画する最後のステップ(renderToDisplay)で、高品質なシェーダーを用いて一気に縮小。
 * -   これにより、ジャギを抑えつつ鮮明なスーパーサンプリング描画を実現。
 * -   「キャンバスが4倍サイズになる」問題を解決し、見た目のサイズはそのままに内部的な高画質化を達成。
 * ===================================================================================
 */
import { DrawingEngine } from './drawing-engine.js';
import { mat4 } from 'gl-matrix'; // gl-matrixライブラリをインポート

// ヘルパー関数: シェーダーをロード
function loadShader(gl, type, source) {
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

// ヘルパー関数: シェーダープログラムを作成
function createProgram(gl, vsSource, fsSource) {
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);
    if (!vertexShader || !fragmentShader) return null;

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
    }
    return program;
}

// シェーダープログラムを初期化し、uniformsとattribsをバインドする関数
function initShaderProgram(gl, vsSource, fsSource) {
  const program = createProgram(gl, vsSource, fsSource);
  if (!program) return null;

  program.attribs = {
    a_position: gl.getAttribLocation(program, "a_position"),
    a_texCoord: gl.getAttribLocation(program, "a_texCoord"),
  };
  program.uniforms = {
    u_mvpMatrix: gl.getUniformLocation(program, "u_mvpMatrix"),
    u_texture: gl.getUniformLocation(program, "u_texture"),
    u_opacity: gl.getUniformLocation(program, "u_opacity"), // compositorシェーダー用
    u_source_resolution: gl.getUniformLocation(program, "u_source_resolution"), // compositorシェーダー用
    u_resolution: gl.getUniformLocation(program, "u_resolution"), // brushシェーダー用
    u_center: gl.getUniformLocation(program, "u_center"),       // brushシェーダー用
    u_radius: gl.getUniformLocation(program, "u_radius"),       // brushシェーダー用
    u_color: gl.getUniformLocation(program, "u_color"),         // brushシェーダー用
    u_is_eraser: gl.getUniformLocation(program, "u_is_eraser"), // brushシェーダー用
    u_transform_matrix: gl.getUniformLocation(program, "u_transform_matrix"), // transformシェーダー用
  };
  return program;
}

export class WebGLEngine extends DrawingEngine {
    constructor(canvas) {
        super(canvas);
        this.gl = null;
        
        // ★★★ スーパーサンプリング係数 ★★★
        this.SUPER_SAMPLING_FACTOR = 2; // 2倍の解像度で内部描画 (例: 1000x1000 -> 2000x2000)

        try {
            this.gl = canvas.getContext('webgl', { preserveDrawingBuffer: true, premultipliedAlpha: true, antialias: false }) || canvas.getContext('experimental-webgl', { preserveDrawingBuffer: true, premultipliedAlpha: true, antialias: false });
            if (!this.gl) throw new Error('WebGL is not supported in this browser.');
        } catch (e) {
            console.error("WebGL context creation failed:", e);
            throw e;
        }

        const gl = this.gl;
        gl.clearColor(0.0, 0.0, 0.0, 0.0); // 透明な黒でクリア
        gl.enable(gl.BLEND); // アルファブレンディングを有効に
        // 通常のアルファブレンディング設定 (premultiplied alpha)
        gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        this.programs = {};
        this.buffers = {};
        this.textures = new Map(); // レイヤーIDとWebGLTextureをマッピング
        this.framebuffers = {};

        this._initBuffers();
        this._initShaderPrograms();
        this._initFramebuffers(canvas.width, canvas.height);
    }

    static isSupported() {
        try {
            const canvas = document.createElement('canvas');
            return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
        } catch (e) {
            return false;
        }
    }

    _initBuffers() {
        const gl = this.gl;

        // 描画用の四角形（XY座標とUV座標）
        const positions = [
            -0.5, -0.5,  0.0, 1.0, // bottom-left
             0.5, -0.5,  1.0, 1.0, // bottom-right
            -0.5,  0.5,  0.0, 0.0, // top-left
             0.5,  0.5,  1.0, 0.0  // top-right
        ];
        
        this.buffers.quad = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.quad);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

        // インデックスバッファ (2つの三角形で四角形を構成)
        const indices = [
            0, 1, 2, // First triangle
            1, 3, 2  // Second triangle
        ];
        this.buffers.indices = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.indices);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
    }

    _initShaderPrograms() {
        const gl = this.gl;

        // ★★★ 頂点シェーダー ★★★
        const vsMain = `
            attribute vec2 a_position;
            attribute vec2 a_texCoord;

            uniform mat4 u_mvpMatrix;

            varying vec2 v_texCoord;

            void main() {
              gl_Position = u_mvpMatrix * vec4(a_position, 0.0, 1.0);
              v_texCoord = a_texCoord;
            }
        `;

        // ★★★ フラグメントシェーダー (compositor用) ★★★
        const fsCompositor = `
            precision highp float;
            varying vec2 v_texCoord;
            uniform sampler2D u_texture;
            uniform float u_opacity;
            uniform vec2 u_source_resolution; // ソーステクスチャのサイズ (高解像度)

            void main() {
                // ハードウェアの線形補間(ぼやけがち)に頼らず、手動でのバイリニアフィルタリングで
                // ジャギを抑えつつ鮮明な描画を実現する。
                // 中心から+-0.25 texelの4点をサンプリングして平均
                vec2 texel_size = 1.0 / u_source_resolution;
                vec4 color = vec4(0.0);
                
                color += texture2D(u_texture, v_texCoord + texel_size * vec2(-0.25, -0.25));
                color += texture2D(u_texture, v_texCoord + texel_size * vec2( 0.25, -0.25));
                color += texture2D(u_texture, v_texCoord + texel_size * vec2( 0.25,  0.25));
                color += texture2D(u_texture, v_texCoord + texel_size * vec2(-0.25,  0.25));
                color *= 0.25; // 平均

                gl_FragColor = vec4(color.rgb, color.a * u_opacity);
            }
        `;

        // ★★★ ブラシ描画用シェーダー (vsBrushはシンプルな四角形描画) ★★★
        const vsBrush = `
            precision mediump float;
            attribute vec2 a_position;
            uniform vec2 u_resolution; // キャンバスのピクセル解像度
            uniform vec2 u_center;     // ブラシの中心座標 (ピクセル単位)
            uniform float u_radius;    // ブラシの半径 (ピクセル単位)
            
            void main() {
                // a_positionは(-0.5,-0.5)から(0.5,0.5)の四角形
                // これをブラシのサイズと位置に合わせてスケール・平行移動
                vec2 quad_size_pixels = vec2(u_radius * 2.0); // ブラシの直径が四角形のサイズ
                vec2 scaled_position = a_position * quad_size_pixels;
                vec2 final_pixel_pos = u_center + scaled_position;

                // ピクセル座標からNDC (-1 to 1) に変換
                vec2 ndc_pos = (final_pixel_pos / u_resolution) * 2.0 - 1.0;
                
                // WebGLのY軸は通常上向きなので反転 (必要に応じて)
                gl_Position = vec4(ndc_pos.x, ndc_pos.y, 0.0, 1.0);
            }
        `;

        const fsBrush = `
            precision highp float;
            uniform float u_radius;
            uniform vec4 u_color;
            uniform bool u_is_eraser;

            void main() {
                // gl_PointCoordは、gl_PointSizeで描画された点内の座標 (0.0～1.0)
                // gl_PointCoordの中心は(0.5, 0.5)
                // このシェーダーは四角形描画用なのでgl_PointCoordは使わない。
                // 代わりにフラグメントの正規化座標 (0-1) を中心からの距離に変換する
                vec2 frag_coord_normalized = gl_FragCoord.xy / u_radius; // TODO: u_resolutionを使うべき
                
                // 中心からの距離 (0.0-0.5)
                float dist = length(gl_FragCoord.xy - u_center) / u_radius;

                // アンチエイリアス処理 (smoothstep関数で滑らかなエッジを作成)
                // 0.5は円の半径に対応する正規化された距離
                float alpha = 1.0 - smoothstep(0.5 - fwidth(dist), 0.5 + fwidth(dist), dist);

                if (alpha < 0.01) { // ほぼ透明なピクセルは描画しない
                    discard;
                }

                if (u_is_eraser) {
                    gl_FragColor = vec4(0.0, 0.0, 0.0, alpha); // 消しゴムは透明にする
                } else {
                    gl_FragColor = vec4(u_color.rgb, u_color.a * alpha);
                }
            }
        `;

        // initShaderProgram関数を使用してプログラムを作成
        this.programs.compositor = initShaderProgram(gl, vsMain, fsCompositor);
        this.programs.brush = initShaderProgram(gl, vsBrush, fsBrush);
    }

    _initFramebuffers(width, height) {
        const gl = this.gl;
        const s_width = width * this.SUPER_SAMPLING_FACTOR;
        const s_height = height * this.SUPER_SAMPLING_FACTOR;

        // 合成用FBO (スーパーサンプリング解像度)
        this.framebuffers.composite = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers.composite);

        this.framebuffers.composite.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.framebuffers.composite.texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, s_width, s_height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.framebuffers.composite.texture, 0);

        // レイヤー描画用の一時FBO (スーパーサンプリング解像度)
        this.framebuffers.layerBuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers.layerBuffer);

        this.framebuffers.layerBuffer.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.framebuffers.layerBuffer.texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, s_width, s_height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.framebuffers.layerBuffer.texture, 0);

        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    updateLayerTexture(layer) {
        const gl = this.gl;
        let texture = this.textures.get(layer.name);
        if (!texture) {
            texture = gl.createTexture();
            this.textures.set(layer.name, texture);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        } else {
            gl.bindTexture(gl.TEXTURE_2D, texture);
        }
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); // ImageDataはY軸が反転しているため
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, layer.imageData);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    }

    drawBrush(layer, strokePoints, brushSettings, camera) {
        const gl = this.gl;
        const program = this.programs.brush;
        gl.useProgram(program);

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers.layerBuffer);
        gl.viewport(0, 0, this.canvas.width * this.SUPER_SAMPLING_FACTOR, this.canvas.height * this.SUPER_SAMPLING_FACTOR);
        
        // 既存のレイヤー内容をフレームバッファに描画
        this._renderLayerContentToBuffer(layer);

        // ブラシ描画の設定
        gl.uniform2f(program.uniforms.u_resolution, this.canvas.width, this.canvas.height);
        gl.uniform4fv(program.uniforms.u_color, brushSettings.color);
        gl.uniform1f(program.uniforms.u_radius, brushSettings.radius);
        gl.uniform1i(program.uniforms.u_is_eraser, brushSettings.isEraser ? 1 : 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.quad);
        gl.vertexAttribPointer(program.attribs.a_position, 2, gl.FLOAT, false, 4 * Float32Array.BYTES_PER_ELEMENT, 0); // XY座標
        gl.enableVertexAttribArray(program.attribs.a_position);

        // ストロークポイントごとにブラシを描画
        strokePoints.forEach(p => {
            // カメラ変換を考慮したブラシの中心座標
            const worldX = (p.x - this.canvas.width / 2) / camera.scale + camera.x;
            const worldY = (p.y - this.canvas.height / 2) / camera.scale + camera.y;

            gl.uniform2f(program.uniforms.u_center, worldX, worldY);
            gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
        });
        
        gl.disableVertexAttribArray(program.attribs.a_position);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        // 描画結果をレイヤーのImageDataに書き戻す
        this._readFramebufferToLayerImageData(layer);
    }

    _renderLayerContentToBuffer(layer) {
        const gl = this.gl;
        const program = this.programs.compositor; // レイヤーテクスチャを描画するプログラム

        gl.useProgram(program);
        gl.clear(gl.COLOR_BUFFER_BIT); // レイヤーバッファをクリア

        const texture = this.textures.get(layer.name);
        if (!texture) {
            // テクスチャがない場合は空のImageDataをアップロードして描画
            const emptyImageData = new ImageData(layer.imageData.width, layer.imageData.height);
            this.updateLayerTexture({ name: layer.name, imageData: emptyImageData });
            gl.bindTexture(gl.TEXTURE_2D, this.textures.get(layer.name));
        } else {
            gl.bindTexture(gl.TEXTURE_2D, texture);
        }

        gl.activeTexture(gl.TEXTURE0);
        gl.uniform1i(program.uniforms.u_texture, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.quad);
        gl.vertexAttribPointer(program.attribs.a_position, 2, gl.FLOAT, false, 4 * Float32Array.BYTES_PER_ELEMENT, 0);
        gl.enableVertexAttribArray(program.attribs.a_position);
        gl.vertexAttribPointer(program.attribs.a_texCoord, 2, gl.FLOAT, false, 4 * Float32Array.BYTES_PER_ELEMENT, 2 * Float32Array.BYTES_PER_ELEMENT);
        gl.enableVertexAttribArray(program.attribs.a_texCoord);

        // レイヤー自身のmodelMatrixを適用
        gl.uniformMatrix4fv(program.uniforms.u_mvpMatrix, false, layer.modelMatrix); // modelMatrixを直接渡す

        gl.uniform1f(program.uniforms.u_opacity, 1.0); // opacityはここでは1.0で、合成時に調整
        gl.uniform2f(program.uniforms.u_source_resolution, layer.imageData.width, layer.imageData.height);

        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

        gl.disableVertexAttribArray(program.attribs.a_position);
        gl.disableVertexAttribArray(program.attribs.a_texCoord);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    _readFramebufferToLayerImageData(layer) {
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers.layerBuffer);
        
        const superWidth = layer.imageData.width * this.SUPER_SAMPLING_FACTOR;
        const superHeight = layer.imageData.height * this.SUPER_SAMPLING_FACTOR;
        const pixels = new Uint8Array(superWidth * superHeight * 4);
        gl.readPixels(0, 0, superWidth, superHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        // WebGLから読み込んだピクセルデータをImageDataに変換
        const tempCtx = document.createElement('canvas').getContext('2d');
        const tempImageData = tempCtx.createImageData(superWidth, superHeight);
        tempImageData.data.set(pixels);

        // スーパーサンプリングされたImageDataを通常のImageDataにダウンサンプリング
        const finalImageData = layer.imageData; // 既存のImageDataオブジェクトを再利用
        const sourceCanvas = document.createElement('canvas');
        sourceCanvas.width = superWidth;
        sourceCanvas.height = superHeight;
        const sourceCtx = sourceCanvas.getContext('2d');
        sourceCtx.putImageData(tempImageData, 0, 0);

        // drawImageでリサイズすることでブラウザの高品質なスケーリングを利用
        tempCtx.clearRect(0, 0, finalImageData.width, finalImageData.height); // tempCtxをクリア
        tempCtx.drawImage(sourceCanvas, 0, 0, finalImageData.width, finalImageData.height);
        const downsampledData = tempCtx.getImageData(0, 0, finalImageData.width, finalImageData.height);
        finalImageData.data.set(downsampledData.data);

        // 更新されたImageDataを再びテクスチャとしてWebGLにアップロード
        this.updateLayerTexture(layer);
    }

    compositeLayers(layers, displayWidth, displayHeight, camera) {
        const gl = this.gl;
        const program = this.programs.compositor;
        gl.useProgram(program);

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers.composite);
        gl.viewport(0, 0, displayWidth * this.SUPER_SAMPLING_FACTOR, displayHeight * this.SUPER_SAMPLING_FACTOR);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.activeTexture(gl.TEXTURE0);
        gl.uniform1i(program.uniforms.u_texture, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.quad);
        gl.vertexAttribPointer(program.attribs.a_position, 2, gl.FLOAT, false, 4 * Float32Array.BYTES_PER_ELEMENT, 0);
        gl.enableVertexAttribArray(program.attribs.a_position);
        gl.vertexAttribPointer(program.attribs.a_texCoord, 2, gl.FLOAT, false, 4 * Float32Array.BYTES_PER_ELEMENT, 2 * Float32Array.BYTES_PER_ELEMENT);
        gl.enableVertexAttribArray(program.attribs.a_texCoord);

        const projectionMatrix = mat4.create();
        mat4.ortho(projectionMatrix, 0, displayWidth, displayHeight, 0, -1, 1); // Y軸反転のためbottomとtopを入れ替え
        
        const viewMatrix = mat4.create();
        mat4.translate(viewMatrix, viewMatrix, [-camera.x * camera.scale + displayWidth / 2, -camera.y * camera.scale + displayHeight / 2, 0]);
        mat4.scale(viewMatrix, viewMatrix, [camera.scale, camera.scale, 1]);

        layers.forEach(layer => {
            if (!layer.visible) return;

            const layerTexture = this.textures.get(layer.name);
            if (!layerTexture) {
                console.warn(`Texture for layer ${layer.name} not found.`);
                return;
            }
            gl.bindTexture(gl.TEXTURE_2D, layerTexture);

            // MVP行列を計算: projection × view × model
            const mvpMatrix = mat4.create();
            mat4.multiply(mvpMatrix, projectionMatrix, viewMatrix);
            mat4.multiply(mvpMatrix, mvpMatrix, layer.modelMatrix);

            gl.uniformMatrix4fv(program.uniforms.u_mvpMatrix, false, mvpMatrix);
            gl.uniform1f(program.uniforms.u_opacity, layer.opacity / 100);
            gl.uniform2f(program.uniforms.u_source_resolution, layer.imageData.width, layer.imageData.height);

            gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
        });

        gl.disableVertexAttribArray(program.attribs.a_position);
        gl.disableVertexAttribArray(program.attribs.a_texCoord);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null); // ディスプレイへ描画するためにバインドを解除

        // 最終結果をディスプレイキャンバスに描画
        this.renderToDisplay(this.framebuffers.composite.texture, displayWidth, displayHeight);
    }

    renderToDisplay(texture, displayWidth, displayHeight) {
        const gl = this.gl;
        const program = this.programs.compositor; // 同じcompositorシェーダーを使用
        gl.useProgram(program);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null); // デフォルトのフレームバッファ（画面）に描画
        gl.viewport(0, 0, displayWidth, displayHeight); // 画面解像度にビューポートを設定
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(program.uniforms.u_texture, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.quad);
        gl.vertexAttribPointer(program.attribs.a_position, 2, gl.FLOAT, false, 4 * Float32Array.BYTES_PER_ELEMENT, 0);
        gl.enableVertexAttribArray(program.attribs.a_position);
        gl.vertexAttribPointer(program.attribs.a_texCoord, 2, gl.FLOAT, false, 4 * Float32Array.BYTES_PER_ELEMENT, 2 * Float32Array.BYTES_PER_ELEMENT);
        gl.enableVertexAttribArray(program.attribs.a_texCoord);

        // ディスプレイへの描画用MVP行列 (NDC空間にフィット)
        const mvpMatrix = mat4.create();
        // モデル行列を単位行列に設定（四角形がNDC空間全体を埋めるように）
        mat4.identity(mvpMatrix); 
        // 描画先が画面全体なので、投影行列も正射影でNDC空間に合わせる
        mat4.ortho(mvpMatrix, -1, 1, -1, 1, -1, 1); // 画面いっぱいに描画するため

        gl.uniformMatrix4fv(program.uniforms.u_mvpMatrix, false, mvpMatrix);
        gl.uniform1f(program.uniforms.u_opacity, 1.0); // 最終表示なので常に不透明
        gl.uniform2f(program.uniforms.u_source_resolution, displayWidth * this.SUPER_SAMPLING_FACTOR, displayHeight * this.SUPER_SAMPLING_FACTOR); // 元の解像度を伝える

        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

        gl.disableVertexAttribArray(program.attribs.a_position);
        gl.disableVertexAttribArray(program.attribs.a_texCoord);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    getCurrentFrameBufferData(width, height) {
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers.composite); // 合成結果のFBOから読み込み
        const superWidth = width * this.SUPER_SAMPLING_FACTOR;
        const superHeight = height * this.SUPER_SAMPLING_FACTOR;
        const pixels = new Uint8Array(superWidth * superHeight * 4);
        gl.readPixels(0, 0, superWidth, superHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        // WebGLのY軸反転を考慮してImageDataを作成
        const imageData = new ImageData(width, height);
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = superWidth;
        tempCanvas.height = superHeight;
        const tempCtx = tempCanvas.getContext('2d');
        const tempImageData = tempCtx.createImageData(superWidth, superHeight);
        tempImageData.data.set(pixels);
        tempCtx.putImageData(tempImageData, 0, 0);

        // 高品質なダウンサンプリング
        const finalCtx = document.createElement('canvas').getContext('2d');
        finalCtx.drawImage(tempCanvas, 0, 0, width, height);
        const finalData = finalCtx.getImageData(0, 0, width, height);
        imageData.data.set(finalData.data);
        
        return imageData;
    }
}