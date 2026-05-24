#version 300 es
/**
 * seed-init.frag.glsl - MSDF Pipeline Phase 2
 * 
 * 【責務】
 * - Jump Flooding Algorithm (JFA) のシード初期化
 * - エッジピクセルに最近接エッジIDを設定
 */

precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_edgeTex;  // エッジバッファテクスチャ
uniform vec2 u_resolution;

out vec4 fragColor;

void main() {
  vec2 pixelCoord = v_texCoord * u_resolution;
  
  // エッジバッファから最近接エッジ検索
  vec4 edgeData = texture(u_edgeTex, v_texCoord);
  
  // エッジIDをRGチャンネルにエンコード
  float edgeId = edgeData.r;
  float isEdge = step(0.5, edgeData.a); // エッジピクセル判定
  
  if (isEdge > 0.5) {
    // エッジピクセル: 座標+IDを格納
    fragColor = vec4(pixelCoord, edgeId, 1.0);
  } else {
    // 非エッジピクセル: 無効値
    fragColor = vec4(-1.0, -1.0, -1.0, 0.0);
  }
}