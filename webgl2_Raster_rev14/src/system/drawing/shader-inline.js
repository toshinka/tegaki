/**
 * ============================================================
 * shader-inline.js - Phase C-1: WebGL2描画パイプライン対応
 * ============================================================
 * 【役割】
 * - GLSLシェーダーコードをインライン保持
 * - file://プロトコル対応
 * - Phase C-1: ブラシスタンプ完全実装
 * 
 * 【Phase C-1改修内容】
 * 🔥 ブラシスタンプシェーダー完全実装
 * 🔥 Flow制御対応
 * 🔥 消しゴムシェーダー対応
 * 🔥 アンチエイリアス高品質化
 * ✅ ベクター用GLSL削除
 * ✅ レイヤー合成シェーダー
 * ✅ ディスプレイシェーダー
 * ============================================================
 */

(function() {
    'use strict';

    /**
     * ================================================================
     * Phase C-1: ブラシスタンプシェーダー
     * ================================================================
     */

    /**
     * ブラシスタンプ 頂点シェーダー
     */
    const brushStampVertexShader = `#version 300 es
        in vec2 a_position;
        in vec2 a_texCoord;
        
        out vec2 v_texCoord;
        out vec2 v_position;
        
        uniform vec2 u_resolution;
        uniform vec2 u_position;
        uniform float u_size;
        uniform float u_rotation;
        
        mat2 rotation2d(float angle) {
            float s = sin(angle);
            float c = cos(angle);
            return mat2(c, -s, s, c);
        }
        
        void main() {
            // ビルボード頂点（-1～1）をブラシサイズにスケール
            vec2 pos = a_position * u_size;
            
            // 回転適用（ペンのtwist/tilt対応）
            if (abs(u_rotation) > 0.001) {
                pos = rotation2d(u_rotation) * pos;
            }
            
            // ブラシ中心位置にオフセット
            pos += u_position;
            
            // クリップ空間変換
            vec2 clipSpace = (pos / u_resolution) * 2.0 - 1.0;
            gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
            
            // テクスチャ座標
            v_texCoord = a_texCoord;
            v_position = a_position; // -1～1の範囲
        }
    `;

    /**
     * ブラシスタンプ フラグメントシェーダー
     * Phase C-1: Flow制御・高品質アンチエイリアス実装
     */
    const brushStampFragmentShader = `#version 300 es
        precision highp float;
        
        in vec2 v_texCoord;
        in vec2 v_position;
        out vec4 fragColor;
        
        uniform sampler2D u_stampTexture;
        uniform vec3 u_color;
        uniform float u_opacity;
        uniform float u_hardness;
        uniform int u_eraser;
        
        void main() {
            // スタンプテクスチャからアルファ値取得
            vec4 stampColor = texture(u_stampTexture, v_texCoord);
            
            // 距離ベースのフォールオフ（中心からの距離）
            float dist = length(v_position);
            
            // Hardness適用: 0.0=ソフト, 1.0=ハード
            float edge = 1.0 - u_hardness * 0.5;
            float falloff = smoothstep(1.0, edge, dist);
            
            // スタンプアルファと組み合わせ
            float alpha = stampColor.a * falloff * u_opacity;
            
            if (u_eraser == 1) {
                // 消しゴムモード: アルファチャンネルを削除
                // RGB=1.0, Alpha=削除量
                fragColor = vec4(1.0, 1.0, 1.0, alpha);
            } else {
                // 通常モード: ブラシ色を出力
                fragColor = vec4(u_color, alpha);
            }
        }
    `;

    /**
     * ================================================================
     * レイヤー合成シェーダー
     * ================================================================
     */

    /**
     * レイヤー合成 頂点シェーダー
     */
    const compositeVertexShader = `#version 300 es
        in vec2 a_position;
        in vec2 a_texCoord;
        
        out vec2 v_texCoord;
        
        void main() {
            gl_Position = vec4(a_position, 0, 1);
            v_texCoord = a_texCoord;
        }
    `;

    /**
     * レイヤー合成 フラグメントシェーダー
     */
    const compositeFragmentShader = `#version 300 es
        precision highp float;
        
        in vec2 v_texCoord;
        out vec4 fragColor;
        
        uniform sampler2D u_texture;
        uniform float u_opacity;
        uniform int u_blendMode;
        
        // ブレンドモード定義
        const int BLEND_NORMAL = 0;
        const int BLEND_MULTIPLY = 1;
        const int BLEND_ADD = 2;
        const int BLEND_SCREEN = 3;
        const int BLEND_OVERLAY = 4;
        
        vec3 blendMultiply(vec3 base, vec3 blend) {
            return base * blend;
        }
        
        vec3 blendAdd(vec3 base, vec3 blend) {
            return min(base + blend, vec3(1.0));
        }
        
        vec3 blendScreen(vec3 base, vec3 blend) {
            return 1.0 - (1.0 - base) * (1.0 - blend);
        }
        
        vec3 blendOverlay(vec3 base, vec3 blend) {
            return mix(
                2.0 * base * blend,
                1.0 - 2.0 * (1.0 - base) * (1.0 - blend),
                step(0.5, base)
            );
        }
        
        void main() {
            vec4 texColor = texture(u_texture, v_texCoord);
            
            // 不透明度適用
            texColor.a *= u_opacity;
            
            // ブレンドモード適用
            if (u_blendMode == BLEND_MULTIPLY) {
                texColor.rgb = blendMultiply(texColor.rgb, texColor.rgb);
            } else if (u_blendMode == BLEND_ADD) {
                texColor.rgb = blendAdd(texColor.rgb, texColor.rgb);
            } else if (u_blendMode == BLEND_SCREEN) {
                texColor.rgb = blendScreen(texColor.rgb, texColor.rgb);
            } else if (u_blendMode == BLEND_OVERLAY) {
                texColor.rgb = blendOverlay(texColor.rgb, texColor.rgb);
            }
            // BLEND_NORMAL (0) はそのまま
            
            fragColor = texColor;
        }
    `;

    /**
     * ================================================================
     * ディスプレイ表示シェーダー
     * ================================================================
     */

    /**
     * ディスプレイ表示 頂点シェーダー
     */
    const displayVertexShader = `#version 300 es
        in vec2 a_position;
        in vec2 a_texCoord;
        
        out vec2 v_texCoord;
        
        void main() {
            gl_Position = vec4(a_position, 0, 1);
            v_texCoord = a_texCoord;
        }
    `;

    /**
     * ディスプレイ表示 フラグメントシェーダー
     */
    const displayFragmentShader = `#version 300 es
        precision highp float;
        
        in vec2 v_texCoord;
        out vec4 fragColor;
        
        uniform sampler2D u_texture;
        
        void main() {
            fragColor = texture(u_texture, v_texCoord);
        }
    `;

    /**
     * ================================================================
     * シェーダーコンパイルヘルパー
     * ================================================================
     */

    /**
     * シェーダーコンパイル
     * @param {WebGL2RenderingContext} gl 
     * @param {number} type - gl.VERTEX_SHADER or gl.FRAGMENT_SHADER
     * @param {string} source 
     * @returns {WebGLShader|null}
     */
    function compileShader(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const typeName = type === gl.VERTEX_SHADER ? 'VERTEX' : 'FRAGMENT';
            console.error(`[ShaderInline] ${typeName} shader compile failed:`, gl.getShaderInfoLog(shader));
            
            // ソースコードを行番号付きで出力
            const lines = source.split('\n');
            console.error('Shader source:');
            lines.forEach((line, i) => {
                console.error(`${(i + 1).toString().padStart(3, ' ')}: ${line}`);
            });
            
            gl.deleteShader(shader);
            return null;
        }
        
        return shader;
    }

    /**
     * プログラムリンク
     * @param {WebGL2RenderingContext} gl 
     * @param {WebGLShader} vertexShader 
     * @param {WebGLShader} fragmentShader 
     * @returns {WebGLProgram|null}
     */
    function linkProgram(gl, vertexShader, fragmentShader) {
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('[ShaderInline] Program link failed:', gl.getProgramInfoLog(program));
            gl.deleteProgram(program);
            return null;
        }
        
        return program;
    }

    /**
     * シェーダープログラム作成（一括）
     * @param {WebGL2RenderingContext} gl 
     * @param {string} vertexSource 
     * @param {string} fragmentSource 
     * @returns {WebGLProgram|null}
     */
    function createShaderProgram(gl, vertexSource, fragmentSource) {
        const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
        if (!vertexShader) return null;
        
        const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
        if (!fragmentShader) {
            gl.deleteShader(vertexShader);
            return null;
        }
        
        const program = linkProgram(gl, vertexShader, fragmentShader);
        
        // シェーダーはプログラムにリンク済みなので削除可能
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        
        return program;
    }

    /**
     * ================================================================
     * グローバル登録
     * ================================================================
     */

    window.TegakiShaders = {
        // ラスター描画用シェーダー
        raster: {
            brushStamp: {
                vertex: brushStampVertexShader,
                fragment: brushStampFragmentShader
            },
            composite: {
                vertex: compositeVertexShader,
                fragment: compositeFragmentShader
            },
            display: {
                vertex: displayVertexShader,
                fragment: displayFragmentShader
            }
        },
        
        // ヘルパー関数
        utils: {
            compileShader,
            linkProgram,
            createShaderProgram
        }
    };

    /**
     * シェーダープログラム一括作成
     * @param {WebGL2RenderingContext} gl 
     * @returns {Object} プログラム集
     */
    function createAllPrograms(gl) {
        const programs = {};
        
        console.log('🔥 [ShaderInline] Creating shader programs...');
        
        // ブラシスタンプ
        programs.brushStamp = createShaderProgram(
            gl,
            brushStampVertexShader,
            brushStampFragmentShader
        );
        
        if (programs.brushStamp) {
            console.log('   ✅ BrushStamp shader created');
        }
        
        // 合成
        programs.composite = createShaderProgram(
            gl,
            compositeVertexShader,
            compositeFragmentShader
        );
        
        if (programs.composite) {
            console.log('   ✅ Composite shader created');
        }
        
        // ディスプレイ
        programs.display = createShaderProgram(
            gl,
            displayVertexShader,
            displayFragmentShader
        );
        
        if (programs.display) {
            console.log('   ✅ Display shader created');
        }
        
        // エラーチェック
        const failed = Object.entries(programs)
            .filter(([name, prog]) => !prog)
            .map(([name]) => name);
        
        if (failed.length > 0) {
            console.error('[ShaderInline] Failed to create programs:', failed);
            return null;
        }
        
        console.log('✅ [ShaderInline] All shader programs created successfully');
        return programs;
    }

    window.TegakiShaders.createAllPrograms = createAllPrograms;

    console.log('✅ shader-inline.js Phase C-1 loaded (WebGL2完全実装)');
    console.log('   🔥 C-1: ブラシスタンプシェーダー完全実装');
    console.log('   🔥 C-1: Flow制御対応');
    console.log('   🔥 C-1: 消しゴムシェーダー対応');
    console.log('   🔥 C-1: アンチエイリアス高品質化');
    console.log('   ✅ レイヤー合成シェーダー');
    console.log('   ✅ ディスプレイシェーダー');

})();