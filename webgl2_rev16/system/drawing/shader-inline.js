/**
 * ============================================================
 * shader-inline.js - Phase 6: GLSLシェーダーインライン化
 * ============================================================
 * 
 * 【責務】
 * - file:// プロトコル対応（外部ファイル読み込み不可のため）
 * - MSDF生成用GLSLシェーダーを JavaScript 内に格納
 * - gl-msdf-pipeline.js から参照
 * 
 * 【親依存】なし
 * 【子依存】gl-msdf-pipeline.js
 * 
 * 【Phase 6 内容】
 * ✅ seed-init.frag.glsl インライン化
 * ✅ jfa-pass.frag.glsl インライン化
 * ✅ encode.frag.glsl インライン化
 * ✅ render.vert.glsl インライン化
 * ✅ render.frag.glsl インライン化
 * ============================================================
 */

(function() {
    'use strict';

    window.GLSLShaders = {
        /**
         * Seed Initialization Fragment Shader
         * ポリゴンの内外を判定し、初期距離フィールドを生成
         */
        seedInit: `#version 300 es
precision highp float;

in vec2 vUV;
out vec4 fragColor;

uniform sampler2D uPolygonTexture;
uniform vec2 uResolution;

void main() {
    vec4 polygonSample = texture(uPolygonTexture, vUV);
    
    // ポリゴン内部の場合
    if (polygonSample.a > 0.5) {
        // 内部: 自身の座標を格納（距離0）
        fragColor = vec4(vUV, 0.0, 1.0);
    } else {
        // 外部: 無限大を表す値
        fragColor = vec4(-1.0, -1.0, 1e10, 0.0);
    }
}
`,

        /**
         * Jump Flooding Algorithm Pass
         * 距離フィールドを伝播させる
         */
        jfaPass: `#version 300 es
precision highp float;

in vec2 vUV;
out vec4 fragColor;

uniform sampler2D uDistanceField;
uniform vec2 uResolution;
uniform float uStepSize;

void main() {
    vec2 pixelSize = 1.0 / uResolution;
    vec4 bestSeed = texture(uDistanceField, vUV);
    float bestDist = bestSeed.z;
    
    // 周囲8方向 + 中心をサンプリング
    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            vec2 offset = vec2(float(x), float(y)) * uStepSize * pixelSize;
            vec2 sampleUV = vUV + offset;
            
            // 境界チェック
            if (sampleUV.x < 0.0 || sampleUV.x > 1.0 || 
                sampleUV.y < 0.0 || sampleUV.y > 1.0) {
                continue;
            }
            
            vec4 seed = texture(uDistanceField, sampleUV);
            
            // 有効なシードの場合
            if (seed.x >= 0.0) {
                vec2 seedPos = seed.xy;
                float dist = distance(vUV, seedPos);
                
                if (dist < bestDist) {
                    bestDist = dist;
                    bestSeed = vec4(seedPos, dist, 1.0);
                }
            }
        }
    }
    
    fragColor = bestSeed;
}
`,

        /**
         * Distance Field Encoding
         * 距離フィールドをMSDF形式にエンコード
         */
        encode: `#version 300 es
precision highp float;

in vec2 vUV;
out vec4 fragColor;

uniform sampler2D uDistanceField;
uniform sampler2D uPolygonTexture;
uniform float uRange;

void main() {
    vec4 df = texture(uDistanceField, vUV);
    vec4 polygon = texture(uPolygonTexture, vUV);
    
    float distance = df.z;
    
    // 内外判定
    bool inside = polygon.a > 0.5;
    
    // 符号付き距離に変換
    float signedDist = inside ? -distance : distance;
    
    // 正規化（0.0～1.0）
    float normalized = (signedDist / uRange) * 0.5 + 0.5;
    normalized = clamp(normalized, 0.0, 1.0);
    
    fragColor = vec4(normalized, normalized, normalized, 1.0);
}
`,

        /**
         * Vertex Shader (共通)
         * フルスクリーンクアッドを生成
         */
        renderVert: `#version 300 es
precision highp float;

in vec2 aPosition;
out vec2 vUV;

void main() {
    vUV = aPosition * 0.5 + 0.5;
    gl_Position = vec4(aPosition, 0.0, 1.0);
}
`,

        /**
         * Fragment Shader (最終レンダリング)
         * MSDFテクスチャからアンチエイリアス描画
         */
        renderFrag: `#version 300 es
precision highp float;

in vec2 vUV;
out vec4 fragColor;

uniform sampler2D uMSDF;
uniform vec3 uColor;
uniform float uOpacity;
uniform float uThreshold;
uniform float uSmoothness;

float median(float r, float g, float b) {
    return max(min(r, g), min(max(r, g), b));
}

void main() {
    vec3 msdf = texture(uMSDF, vUV).rgb;
    float dist = median(msdf.r, msdf.g, msdf.b);
    
    // アンチエイリアス計算
    float pixelDist = (dist - uThreshold) / fwidth(dist);
    float alpha = clamp(pixelDist + 0.5, 0.0, 1.0);
    
    // スムーズネス適用
    alpha = smoothstep(0.5 - uSmoothness, 0.5 + uSmoothness, alpha);
    
    fragColor = vec4(uColor, alpha * uOpacity);
}
`
    };

    console.log('✅ shader-inline.js Phase 6 loaded');
    console.log('   ✅ GLSL シェーダー インライン化完了');
    console.log('   ✅ file:// プロトコル対応');
    console.log('   ✅ MSDF パイプライン準備完了');

})();