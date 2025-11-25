#version 300 es
/**
 * render.frag.glsl - WebGL2 Phase 1
 * 
 * 【責務】
 * - ポリゴンの色付け
 * - Phase 1: 単色塗りつぶし
 * - Phase 2以降: MSDF距離場テクスチャ参照
 */

precision highp float;

// Vertex shaderから受け取るデータ
in vec2 v_texCoord;
in vec2 v_position;

// Uniform
uniform vec4 u_color;        // ブラシカラー（RGBA）
uniform sampler2D u_msdfTex; // MSDF距離場テクスチャ（Phase 2以降）
uniform float u_useTexture;  // 0.0=単色, 1.0=テクスチャ使用

// 出力
out vec4 fragColor;

void main() {
  // Phase 1: 単色塗りつぶし
  if (u_useTexture < 0.5) {
    fragColor = u_color;
    return;
  }
  
  // Phase 2以降: MSDF距離場参照
  vec4 msdfSample = texture(u_msdfTex, v_texCoord);
  float dist = msdfSample.r; // 距離場値
  
  // 距離場 → アルファ値変換
  float alpha = smoothstep(0.4, 0.6, dist);
  
  fragColor = vec4(u_color.rgb, u_color.a * alpha);
}