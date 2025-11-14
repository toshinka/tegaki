/**
 * ================================================================================
 * msdf-quad-expansion.wgsl Phase 3 新規作成 - Polygon Quad展開 Vertex Shader
 * ================================================================================
 * 
 * 📁 親ファイル依存:
 *   - msdf-pipeline-manager.js (RenderPipeline)
 *   - gpu-stroke-processor.js (VertexBuffer生成)
 * 
 * 📄 子ファイル依存:
 *   - msdf-render.wgsl (Fragment Shader)
 * 
 * 【Phase 3実装】
 * ✅ prev/curr/next頂点から接線・法線計算
 * ✅ side属性で左右オフセット
 * ✅ 線幅動的制御（Uniform経由）
 * ✅ NDC座標変換
 * 
 * VertexBuffer構造:
 *   [prev.x, prev.y, curr.x, curr.y, next.x, next.y, side]
 *   stride: 7 floats = 28 bytes
 * 
 * ================================================================================
 */

struct VertexInput {
  @location(0) prev: vec2<f32>,
  @location(1) curr: vec2<f32>,
  @location(2) next: vec2<f32>,
  @location(3) side: f32
}

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>
}

struct QuadUniforms {
  canvasWidth: f32,
  canvasHeight: f32,
  halfWidth: f32,    // 線幅の半分
  padding: f32
}

@group(0) @binding(0) var<uniform> uQuad: QuadUniforms;

@vertex
fn main(in: VertexInput) -> VertexOutput {
  var out: VertexOutput;

  // 接線ベクトル計算（2つの方向の平均）
  let tangent0 = normalize(in.curr - in.prev);
  let tangent1 = normalize(in.next - in.curr);
  let tangent = normalize(tangent0 + tangent1);

  // 法線ベクトル（接線に垂直）
  let normal = vec2<f32>(-tangent.y, tangent.x);

  // 線幅によるオフセット
  let offset = normal * in.side * uQuad.halfWidth;

  // ワールド座標計算
  let worldPos = in.curr + offset;

  // NDC座標変換（-1.0 ~ 1.0）
  let ndcX = (worldPos.x / uQuad.canvasWidth) * 2.0 - 1.0;
  let ndcY = 1.0 - (worldPos.y / uQuad.canvasHeight) * 2.0;

  out.position = vec4<f32>(ndcX, ndcY, 0.0, 1.0);

  // UV座標（side: -1=左, +1=右）
  out.uv = vec2<f32>((in.side + 1.0) * 0.5, 0.5);

  return out;
}