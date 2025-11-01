// msdf-fragment-shader.glsl - MSDF Fragment Shader
// Phase 4-B-2: RGB 3チャンネルからmedian()計算

precision highp float;

varying vec2 vTextureCoord;
varying vec4 vColor;

uniform sampler2D uSampler;
uniform float uThreshold;
uniform float uSmoothness;

// MSDF median関数（3チャンネルから中央値を取得）
float median(float r, float g, float b) {
    return max(min(r, g), min(max(r, g), b));
}

void main(void) {
    // RGB 3チャンネルをサンプリング
    vec3 msdf = texture2D(uSampler, vTextureCoord).rgb;
    
    // median距離を計算
    float sd = median(msdf.r, msdf.g, msdf.b);
    
    // スムーズなアルファ値を計算
    float alpha = smoothstep(uThreshold - uSmoothness, 
                             uThreshold + uSmoothness, 
                             sd);
    
    // 最終色（カラー × アルファ）
    gl_FragColor = vec4(vColor.rgb, vColor.a * alpha);
}