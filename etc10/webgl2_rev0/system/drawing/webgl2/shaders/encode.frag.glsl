#version 300 es
/**
 * encode.frag.glsl - MSDF Pipeline Phase 2
 * 
 * 【責務】
 * - JFA結果 → 距離場テクスチャ変換
 * - Multi-channel距離場生成（RGB各チャンネル）
 */

precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_jfaTex;    // JFA完了テクスチャ
uniform sampler2D u_edgeTex;   // エッジバッファ
uniform vec2 u_resolution;
uniform float u_maxDistance;   // 正規化用最大距離

out vec4 fragColor;

void main() {
  vec2 pixelCoord = v_texCoord * u_resolution;
  vec4 jfaSample = texture(u_jfaTex, v_texCoord);
  
  // 最近接エッジ座標
  vec2 nearestEdge = jfaSample.xy;
  float dist = length(pixelCoord - nearestEdge);
  
  // 正規化距離（0.0 ~ 1.0）
  float normalizedDist = clamp(dist / u_maxDistance, 0.0, 1.0);
  
  // エッジバッファから法線方向取得
  vec4 edgeData = texture(u_edgeTex, nearestEdge / u_resolution);
  vec2 normal = edgeData.yz; // 法線ベクトル
  
  // 内外判定（法線との内積）
  vec2 toPixel = normalize(pixelCoord - nearestEdge);
  float side = dot(toPixel, normal);
  float signedDist = normalizedDist * sign(side);
  
  // 距離場エンコード（0.5が境界）
  float encodedDist = signedDist * 0.5 + 0.5;
  
  // Multi-channel: RGB全チャンネルに同値格納（Phase 2簡易版）
  fragColor = vec4(vec3(encodedDist), 1.0);
}