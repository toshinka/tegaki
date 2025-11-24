/**
 * ============================================================
 * shader-inline.js - Phase 7: GLSLインライン化完全版
 * ============================================================
 * 【責務】
 * - file://プロトコルでGLSLファイル読み込みが不可のため、
 *   シェーダーコードをJavaScript内に文字列化してインライン保持
 * - SDF/MSDFパイプライン用シェーダー提供
 * 
 * 【親依存】
 * - なし（最上位シェーダー定義ファイル）
 * 
 * 【子依存】
 * - gl-msdf-pipeline.js
 * - gl-mask-layer.js
 * - sdf-brush-shader.js（将来Phase用）
 * 
 * 【Phase 7改修内容】
 * ✅ seed-init.frag.glsl インライン化
 * ✅ jfa-pass.frag.glsl インライン化
 * ✅ encode.frag.glsl インライン化
 * ✅ render.vert.glsl インライン化
 * ✅ render.frag.glsl インライン化
 * ✅ file://プロトコル完全対応
 * ============================================================
 */

(function() {
    'use strict';

    /**
     * GLSL Shaders Collection
     * WebGL2 (GLSL ES 3.00) 準拠
     */
    window.GLSLShaders = {
        /**
         * Seed Initialization Fragment Shader
         * SDF生成の初期化パス
         */
        seedInit: `#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 outColor;

uniform sampler2D u_texture;

void main() {
    vec4 texel = texture(u_texture, v_texCoord);
    float alpha = texel.a;
    
    if (alpha > 0.5) {
        // 内側: 座標を記録
        outColor = vec4(v_texCoord, 0.0, 1.0);
    } else {
        // 外側: 無効値
        outColor = vec4(-1.0, -1.0, 0.0, 0.0);
    }
}`,

        /**
         * Jump Flooding Algorithm Pass Fragment Shader
         * 距離場計算の反復パス
         */
        jfaPass: `#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 outColor;

uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_step;

void main() {
    vec2 bestSeed = texture(u_texture, v_texCoord).xy;
    float bestDist = 1e10;
    
    if (bestSeed.x >= 0.0) {
        bestDist = distance(v_texCoord, bestSeed);
    }
    
    float stepSize = u_step / u_resolution.x;
    
    // 3x3近傍を探索
    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            vec2 offset = vec2(float(x), float(y)) * stepSize;
            vec2 neighborCoord = v_texCoord + offset;
            
            // テクスチャ範囲外チェック
            if (neighborCoord.x < 0.0 || neighborCoord.x > 1.0 ||
                neighborCoord.y < 0.0 || neighborCoord.y > 1.0) {
                continue;
            }
            
            vec2 neighborSeed = texture(u_texture, neighborCoord).xy;
            
            if (neighborSeed.x >= 0.0) {
                float dist = distance(v_texCoord, neighborSeed);
                if (dist < bestDist) {
                    bestDist = dist;
                    bestSeed = neighborSeed;
                }
            }
        }
    }
    
    outColor = vec4(bestSeed, 0.0, 1.0);
}`,

        /**
         * Distance Encoding Fragment Shader
         * 距離場をSDF形式にエンコード
         */
        encode: `#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 outColor;

uniform sampler2D u_texture;
uniform sampler2D u_original;
uniform float u_range;

void main() {
    vec2 seed = texture(u_texture, v_texCoord).xy;
    float alpha = texture(u_original, v_texCoord).a;
    
    float dist;
    if (seed.x >= 0.0) {
        dist = distance(v_texCoord, seed);
    } else {
        dist = 1.0;
    }
    
    // 符号付き距離場
    // 内側: 負、外側: 正
    float signedDist = (alpha > 0.5) ? -dist : dist;
    
    // 正規化: [-range, range] → [0, 1]
    float normalized = (signedDist + u_range) / (2.0 * u_range);
    normalized = clamp(normalized, 0.0, 1.0);
    
    outColor = vec4(normalized, normalized, normalized, 1.0);
}`,

        /**
         * Render Vertex Shader
         * フルスクリーンクアッド描画用
         */
        renderVert: `#version 300 es
in vec2 a_position;
in vec2 a_texCoord;

out vec2 v_texCoord;

void main() {
    v_texCoord = a_texCoord;
    gl_Position = vec4(a_position, 0.0, 1.0);
}`,

        /**
         * Render Fragment Shader
         * SDF/MSDFテクスチャの描画
         */
        renderFrag: `#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 outColor;

uniform sampler2D u_texture;
uniform vec4 u_color;
uniform float u_threshold;
uniform float u_smoothness;

void main() {
    float dist = texture(u_texture, v_texCoord).r;
    
    // SDFアンチエイリアシング
    float alpha = smoothstep(
        u_threshold - u_smoothness,
        u_threshold + u_smoothness,
        dist
    );
    
    outColor = vec4(u_color.rgb, u_color.a * alpha);
}`,

        /**
         * シェーダー妥当性チェック
         */
        validate() {
            const shaders = [
                'seedInit',
                'jfaPass',
                'encode',
                'renderVert',
                'renderFrag'
            ];
            
            const missing = shaders.filter(name => {
                return !this[name] || typeof this[name] !== 'string';
            });
            
            if (missing.length > 0) {
                console.error('[GLSLShaders] Missing shaders:', missing);
                return false;
            }
            
            return true;
        },
        
        /**
         * シェーダー情報取得
         */
        getInfo() {
            return {
                version: 'Phase 7',
                protocol: 'file:// compatible',
                shaderCount: 5,
                shaders: [
                    'seedInit',
                    'jfaPass',
                    'encode',
                    'renderVert',
                    'renderFrag'
                ]
            };
        }
    };

    // 妥当性チェック
    if (window.GLSLShaders.validate()) {
        console.log('✅ shader-inline.js Phase 7 loaded');
        console.log('   ✅ GLSL シェーダー インライン化完了');
        console.log('   ✅ file:// プロトコル完全対応');
        console.log('   ✅ SDF/MSDF パイプライン対応');
        console.log('   📊 シェーダー数:', window.GLSLShaders.getInfo().shaderCount);
    } else {
        console.error('❌ shader-inline.js Phase 7: Validation failed');
    }

})();