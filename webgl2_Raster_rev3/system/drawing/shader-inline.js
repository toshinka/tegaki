/**
 * ============================================================
 * shader-inline.js - Phase 4.1: ラスター対応版
 * ============================================================
 * 【役割】
 * - GLSLシェーダーコードをインライン保持
 * - file://プロトコル対応
 * - ラスター描画用シェーダー定義
 * 
 * 【Phase 4.1改修内容】
 * ✅ ベクター用GLSL削除（SDF, JFA, MSDF関連）
 * ✅ ラスター用GLSL追加
 * ✅ ブラシスタンプシェーダー
 * ✅ 合成シェーダー
 * ============================================================
 */

(function() {
    'use strict';

    /**
     * ================================================================
     * ラスター描画用シェーダー
     * ================================================================
     */

    /**
     * ブラシスタンプ 頂点シェーダー
     */
    const brushStampVertexShader = `#version 300 es
        in vec2 a_position;
        in vec2 a_texCoord;
        
        out vec2 v_texCoord;
        
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
            // スタンプサイズ適用
            vec2 pos = a_position * u_size;
            
            // 回転適用（ペンのtwist対応）
            if (abs(u_rotation) > 0.001) {
                pos = rotation2d(u_rotation) * pos;
            }
            
            // 位置オフセット
            pos += u_position;
            
            // クリップ空間変換
            vec2 clipSpace = (pos / u_resolution) * 2.0 - 1.0;
            gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
            
            v_texCoord = a_texCoord;
        }
    `;

    /**
     * ブラシスタンプ フラグメントシェーダー
     */
    const brushStampFragmentShader = `#version 300 es
        precision highp float;
        
        in vec2 v_texCoord;
        out vec4 fragColor;
        
        uniform vec4 u_color;
        uniform float u_hardness;
        uniform float u_opacity;
        uniform bool u_antialiasing;
        
        void main() {
            // UV座標を中心基準に変換 (-1.0 ～ 1.0)
            vec2 centered = v_texCoord * 2.0 - 1.0;
            float dist = length(centered);
            
            float alpha;
            
            if (u_antialiasing) {
                // アンチエイリアス付き円
                float edge = 1.0 - u_hardness * 0.3;
                alpha = smoothstep(1.0, edge, dist);
            } else {
                // ハードエッジ円
                alpha = dist <= 1.0 ? 1.0 : 0.0;
            }
            
            // 不透明度適用
            alpha *= u_opacity;
            
            fragColor = vec4(u_color.rgb, u_color.a * alpha);
        }
    `;

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
            
            // ブレンドモード適用（将来実装）
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
        
        // ブラシスタンプ
        programs.brushStamp = createShaderProgram(
            gl,
            brushStampVertexShader,
            brushStampFragmentShader
        );
        
        // 合成
        programs.composite = createShaderProgram(
            gl,
            compositeVertexShader,
            compositeFragmentShader
        );
        
        // ディスプレイ
        programs.display = createShaderProgram(
            gl,
            displayVertexShader,
            displayFragmentShader
        );
        
        // エラーチェック
        const failed = Object.entries(programs)
            .filter(([name, prog]) => !prog)
            .map(([name]) => name);
        
        if (failed.length > 0) {
            console.error('[ShaderInline] Failed to create programs:', failed);
            return null;
        }
        
        console.log('✅ [ShaderInline] All shader programs created');
        return programs;
    }

    window.TegakiShaders.createAllPrograms = createAllPrograms;

    console.log('✅ shader-inline.js Phase 4.1 loaded (ラスター対応版)');
    console.log('   ✅ ベクター用GLSL削除');
    console.log('   ✅ ラスター用GLSL追加');
    console.log('   ✅ 3種類のシェーダーセット定義');
    console.log('   - brushStamp: ブラシスタンプ描画');
    console.log('   - composite: レイヤー合成');
    console.log('   - display: 画面表示');

})();