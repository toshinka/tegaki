/*
 * ===================================================================================
 * Toshinka Tegaki Tool - WebGL Engine
 * Version: 3.2.0 (Non-Destructive Transforms)
 *
 * - 修正：
 * - 1. 頂点シェーダーの改修:
 * -   レイヤー合成用シェーダー(vsCompositor)に、変形行列を受け取る
 * -   `u_transformMatrix` uniform を追加。
 * -   GPU上で直接レイヤーの頂点座標を変形するように変更。
 *
 * - 2. 描画ロジックの改修:
 * -   `compositeLayers`内で、各レイヤーの変形行列をシェーダーに渡し、
 * -   GPUによるリアルタイムな非破壊変形描画を実現。
 *
 * - 3. 不要なメソッドの削除:
 * -   CPUベースの変形処理 `getTransformedImageData` を削除。
 * ===================================================================================
 */
import { DrawingEngine } from './drawing-engine.js';

export class WebGLEngine extends DrawingEngine {
    constructor(canvas) { /* ...変更なし... */ }

    _initShaderPrograms() {
        // ★★★★★ 修正箇所: 頂点シェーダーに行列を適用 ★★★★★
        const vsCompositor = `
            attribute vec4 a_position;
            attribute vec2 a_texCoord;
            
            // 各レイヤーの変形情報を受け取る行列
            uniform mat4 u_transformMatrix;

            varying vec2 v_texCoord;
            void main() {
                // 行列を使って頂点座標を変形する
                gl_Position = u_transformMatrix * a_position;
                v_texCoord = a_texCoord;
            }`;
        
        const fsCompositor = `
            precision highp float;
            varying vec2 v_texCoord;
            uniform sampler2D u_image;
            uniform float u_opacity;
            uniform vec2 u_source_resolution;
            uniform float u_sharpness;

            void main() {
                // テクスチャ座標が 0.0 ~ 1.0 の範囲外なら描画しない (変形ではみ出た部分)
                if (v_texCoord.x < 0.0 || v_texCoord.x > 1.0 || v_texCoord.y < 0.0 || v_texCoord.y > 1.0) {
                    discard;
                }
            
                vec2 texel_size = 1.0 / u_source_resolution;
                vec4 color_smooth = vec4(0.0);
                color_smooth += texture2D(u_image, v_texCoord + texel_size * vec2(-0.5, -0.5));
                color_smooth += texture2D(u_image, v_texCoord + texel_size * vec2( 0.5, -0.5));
                color_smooth += texture2D(u_image, v_texCoord + texel_size * vec2( 0.5,  0.5));
                color_smooth += texture2D(u_image, v_texCoord + texel_size * vec2(-0.5,  0.5));
                color_smooth *= 0.25;

                vec4 color_original = texture2D(u_image, v_texCoord);
                vec4 final_color = mix(color_smooth, color_original, u_sharpness);

                gl_FragColor = vec4(final_color.rgb, final_color.a * u_opacity);
            }`;
        /* ... ブラシ用シェーダーなどは変更なし ... */
    }
    
    _initBuffers() {
        const gl = this.gl;
        this.positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        // ★★★ 修正: レイヤーを描画する四角形をテクスチャサイズに合わせる ★★★
        const positions = [ 0, this.height, 0, 0, this.width, this.height, this.width, 0 ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

        this.texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        const texCoords = [ 0.0, 1.0, 0.0, 0.0, 1.0, 1.0, 1.0, 0.0 ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);
        
        this.brushPositionBuffer = gl.createBuffer();
        /* ...以降変更なし... */
    }

    _createProgram(vsSource, fsSource) { 
        /* ...ロケータ部分を修正... */
        // ... (省略) ...
        const program = gl.createProgram(); 
        // ... (省略) ...
        program.locations = {}; 
        const locs = (p) => { 
            /* ...既存のロケーション取得... */
            // ★★★ 新しいuniformのロケーションを追加 ★★★
            p.locations.u_transformMatrix = gl.getUniformLocation(p, 'u_transformMatrix');
        }; 
        locs(program); 
        return program; 
    }
    
    /* ... 既存のメソッド ... */

    // ★★★ 不要になったgetTransformedImageDataを削除 ★★★

    // ★★★★★ 修正箇所: レイヤー合成時に行列をシェーダーに渡す ★★★★★
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
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        // ★★★ 座標はvec2として渡す ★★★
        gl.vertexAttribPointer(program.locations.a_position, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(program.locations.a_position);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.vertexAttribPointer(program.locations.a_texCoord, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(program.locations.a_texCoord);
        
        for (const layer of layers) {
            if (!layer.visible || layer.opacity === 0 || !this.layerTextures.has(layer)) continue;

            this._setBlendMode(layer.blendMode);

            // ★★★ 各レイヤーの変形行列をシェーダーに送る ★★★
            gl.uniformMatrix4fv(program.locations.u_transformMatrix, false, layer.transformMatrix);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.layerTextures.get(layer));
            
            gl.uniform2f(program.locations.u_source_resolution, this.superWidth, this.superHeight);
            gl.uniform1i(program.locations.u_image, 0);
            gl.uniform1f(program.locations.u_opacity, layer.opacity / 100.0);
            gl.uniform1f(program.locations.u_sharpness, 0.0);
            
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
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.vertexAttribPointer(program.locations.a_position, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(program.locations.a_position);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.vertexAttribPointer(program.locations.a_texCoord, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(program.locations.a_texCoord);
        
        // ★★★ 画面への最終描画では、変形は行わないので単位行列を送る ★★★
        gl.uniformMatrix4fv(program.locations.u_transformMatrix, false, glMatrix.mat4.create());

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.superCompositeTexture);
        gl.uniform2f(program.locations.u_source_resolution, this.superWidth, this.superHeight);
        gl.uniform1i(program.locations.u_image, 0);
        gl.uniform1f(program.locations.u_opacity, 1.0);
        gl.uniform1f(program.locations.u_sharpness, 0.5);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        gl.disableVertexAttribArray(program.locations.a_position);
        gl.disableVertexAttribArray(program.locations.a_texCoord);
    }
    /* ... syncDirtyRectToImageData など、他のメソッドは変更なし ... */
}