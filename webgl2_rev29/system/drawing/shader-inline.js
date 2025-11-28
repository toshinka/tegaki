/**
 * ============================================================
 * shader-inline.js - Phase B-7: ペン傾き対応版
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
 * - gl-stroke-processor.js (stride=5)
 * 
 * 【Phase B-7改修内容】
 * ✅ render.vert.glsl 傾き属性追加
 *    - aReserved (vec3) = [pressure, tiltX, tiltY]
 *    - vPressure, vTilt 出力
 * ✅ render.frag.glsl 傾きベース描画
 *    - 傾き大きさによる閾値調整
 *    - 筆圧反映
 * ✅ Phase A-3全機能継承
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
         * Phase B-7: Render Vertex Shader - ペン傾き対応版
         * 
         * 【改修内容】
         * ✅ aReserved (vec3) 追加 = [pressure, tiltX, tiltY]
         * ✅ vPressure, vTilt 出力
         */
        renderVert: `#version 300 es
precision highp float;

layout(location = 0) in vec2 aPosition;
layout(location = 1) in vec2 aTexCoord;
layout(location = 2) in vec3 aReserved;  // [pressure, tiltX, tiltY]

out vec2 vTexCoord;
out float vPressure;
out vec2 vTilt;

void main() {
    vTexCoord = aTexCoord;
    vPressure = aReserved.x;
    vTilt = aReserved.yz;
    
    gl_Position = vec4(aPosition, 0.0, 1.0);
}`,

        /**
         * Phase B-7: Render Fragment Shader - ペン傾き対応版
         * 
         * 【改修内容】
         * ✅ vTilt, vPressure 入力
         * ✅ 傾き大きさによる閾値調整
         * ✅ 筆圧反映
         * ✅ Phase A-3 アンチエイリアス継承
         */
        renderFrag: `#version 300 es
precision highp float;

in vec2 vTexCoord;
in float vPressure;
in vec2 vTilt;

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
    vec4 msdf = texture(uMSDF, vTexCoord);
    float dist = median(msdf.rgb);
    
    // Phase A-3: fwidth()によるピクセル適応アンチエイリアス
    float pixelDist = fwidth(vTexCoord.x) * uRange;
    
    // Phase B-7: 傾きベース閾値調整
    // 傾きが大きいほど線が細くなる効果
    float tiltMagnitude = length(vTilt);
    float threshold = 0.5 - (tiltMagnitude * 0.1);
    
    // アンチエイリアス適用
    float alpha = smoothstep(
        threshold - pixelDist,
        threshold + pixelDist,
        dist
    );
    
    // Phase B-7: 筆圧反映
    alpha *= vPressure;
    
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
                version: 'Phase B-7',
                protocol: 'file:// compatible',
                shaderCount: 5,
                shaders: [
                    'seedInit',
                    'jfaPass',
                    'encode',
                    'renderVert (tilt support)',
                    'renderFrag (tilt + AA)'
                ],
                features: [
                    'fwidth() pixel-adaptive AA',
                    'MSDF median() function',
                    'uRange uniform support',
                    'Pen tilt width modulation',
                    'Pressure reflection'
                ]
            };
        }
    };

    // 妥当性チェック
    if (window.GLSLShaders.validate()) {
        console.log('✅ shader-inline.js Phase B-7 loaded (ペン傾き対応版)');
        console.log('   ✅ renderVert: aReserved [pressure, tiltX, tiltY] 追加');
        console.log('   ✅ renderFrag: 傾きベース閾値調整実装');
        console.log('   ✅ renderFrag: 筆圧反映実装');
        console.log('   ✅ Phase A-3全機能継承');
    } else {
        console.error('❌ shader-inline.js Phase B-7: Validation failed');
    }

})();