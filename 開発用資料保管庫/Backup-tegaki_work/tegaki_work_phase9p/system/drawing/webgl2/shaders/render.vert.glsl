/**
 * render.vert.glsl - WebGL2 Phase 1
 * 
 * 【責務】
 * - gl-stroke-processor.jsから受け取った頂点データを処理
 * - 7 floats/vertex レイアウトに対応
 * - 解像度・オフセット変換
 * 
 * 【頂点属性レイアウト】
 * layout(location = 0) in vec2 a_position;  // [0-1]
 * layout(location = 1) in vec2 a_texCoord;  // [2-3]
 * layout(location = 2) in vec3 a_reserved;  // [4-6]
 */

precision highp float;

// 頂点属性（gl-stroke-processor.jsの7 floats/vertexに対応）
layout(location = 0) in vec2 a_position;
layout(location = 1) in vec2 a_texCoord;
layout(location = 2) in vec3 a_reserved;

// Uniform（JavaScript側から設定）
uniform vec2 u_resolution;   // キャンバス解像度
uniform vec2 u_offset;       // バウンディングボックスオフセット
uniform float u_scale;       // ズームスケール

// Fragment shaderへ渡すデータ
out vec2 v_texCoord;
out vec2 v_position;

void main() {
  // ローカル座標 → NDC座標変換（-1.0 ~ 1.0）
  vec2 position = a_position + u_offset;
  vec2 clipSpace = (position / u_resolution) * 2.0 - 1.0;
  
  // Y軸反転（WebGLは下が-1.0、上が1.0）
  clipSpace.y = -clipSpace.y;
  
  gl_Position = vec4(clipSpace * u_scale, 0.0, 1.0);
  
  // Fragment shaderへデータ転送
  v_texCoord = a_texCoord;
  v_position = a_position;
}