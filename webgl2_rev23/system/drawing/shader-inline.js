/**
 * ============================================================
 * shader-inline.js - Phase A-3: アンチエイリアス改善版
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
 * 【Phase A-3改修内容】
 * ✅ render.frag.glsl アンチエイリアス改善
 * ✅ fwidth() を使用したピクセル適応AA
 * ✅ median() 関数追加（MSDF対応）
 * ✅ uRange uniform 追加
 * ✅ Phase 7全機能継承
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
        outColor = vec4(v_texCoord, 0.0, 1.0);
    } else {
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
    
    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            vec2 offset = vec2(float(x), float(y)) * stepSize;
            vec2 neighborCoord = v_texCoord + offset;
            
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
    
    float signedDist = (alpha > 0.5) ? -dist : dist;
    
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
         * Phase A-3: Render Fragment Shader - アンチエイリアス改善版
         * 
         * 【改善内容】
         * ✅ fwidth() によるピクセル適応アンチエイリアス
         * ✅ median() 関数追加（MSDF対応）
         * ✅ uRange uniform 追加
         * ✅ 筆圧ベース閾値調整（Phase B後に実装予定）
         */
        renderFrag: `#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 outColor;

uniform sampler2D uMSDF;
uniform vec3 uColor;
uniform float uOpacity;
uniform float uRange;

/**
 * MSDF median関数
 * 3チャンネルから中央値を取得
 */
float median(vec3 v) {
    return max(min(v.r, v.g), min(max(v.r, v.g), v.b));
}

void main() {
    // MSDFサンプリング
    vec4 msdf = texture(uMSDF, v_texCoord);
    float dist = median(msdf.rgb);
    
    // Phase A-3: fwidth()によるピクセル適応アンチエイリアス
    // スクリーン空間での微分を計算し、適切なぼかし幅を決定
    float pixelDist = fwidth(v_texCoord.x) * uRange;
    
    // アンチエイリアス適用
    float alpha = smoothstep(0.5 - pixelDist, 0.5 + pixelDist, dist);
    
    // Phase B: 筆圧ベース閾値調整（将来実装）
    // float threshold = 0.5 - (v_pressure - 0.5) * 0.1;
    // float alpha = smoothstep(threshold - pixelDist, threshold + pixelDist, dist);
    
    // 最終カラー出力
    outColor = vec4(uColor, alpha * uOpacity);
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
                version: 'Phase A-3',
                protocol: 'file:// compatible',
                shaderCount: 5,
                shaders: [
                    'seedInit',
                    'jfaPass',
                    'encode',
                    'renderVert',
                    'renderFrag (AA improved)'
                ],
                features: [
                    'fwidth() pixel-adaptive AA',
                    'MSDF median() function',
                    'uRange uniform support',
                    'Phase B ready (tilt support)'
                ]
            };
        }
    };

    // 妥当性チェック
    if (window.GLSLShaders.validate()) {
        console.log('✅ shader-inline.js Phase A-3 loaded');
        console.log('   ✅ render.frag.glsl アンチエイリアス改善');
        console.log('   ✅ fwidth() ピクセル適応AA実装');
        console.log('   ✅ median() 関数追加（MSDF対応）');
        console.log('   ✅ Phase 7全機能継承');
        console.log('   📊 シェーダー数:', window.GLSLShaders.getInfo().shaderCount);
    } else {
        console.error('❌ shader-inline.js Phase A-3: Validation failed');
    }

})();