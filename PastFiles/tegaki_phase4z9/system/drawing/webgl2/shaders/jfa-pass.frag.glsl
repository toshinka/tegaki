#version 300 es
/**
 * jfa-pass.frag.glsl - MSDF Pipeline Phase 2
 * 
 * 【責務】
 * - Jump Flooding Algorithm (JFA) の反復パス
 * - 各ピクセルから最近接エッジへの距離を伝播
 */

precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_inputTex;  // 前回のJFA結果
uniform vec2 u_resolution;
uniform float u_stepSize;      // ジャンプ距離（解像度/2^n）

out vec4 fragColor;

void main() {
  vec2 pixelCoord = v_texCoord * u_resolution;
  vec2 bestSeed = texture(u_inputTex, v_texCoord).xy;
  float bestDist = length(pixelCoord - bestSeed);
  
  // 9近傍探索
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 offset = vec2(float(x), float(y)) * u_stepSize;
      vec2 sampleUV = (pixelCoord + offset) / u_resolution;
      
      // テクスチャ範囲外チェック
      if (sampleUV.x < 0.0 || sampleUV.x > 1.0 || 
          sampleUV.y < 0.0 || sampleUV.y > 1.0) continue;
      
      vec4 sample = texture(u_inputTex, sampleUV);
      
      // 無効シードスキップ
      if (sample.a < 0.5) continue;
      
      vec2 seedCoord = sample.xy;
      float dist = length(pixelCoord - seedCoord);
      
      if (dist < bestDist) {
        bestDist = dist;
        bestSeed = seedCoord;
      }
    }
  }
  
  fragColor = vec4(bestSeed, 0.0, 1.0);
}