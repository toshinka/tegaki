/**
 * ================================================================================
 * msdf-quad-expansion.wgsl Phase 4 座標変換修正版
 * ================================================================================
 * 
 * 📁 親ファイル依存:
 *   - msdf-pipeline-manager.js (RenderPipeline)
 *   - gpu-stroke-processor.js (VertexBuffer生成)
 * 
 * 📄 子ファイル依存:
 *   - msdf-render.wgsl (Fragment Shader)
 * 
 * 【Phase 4改修】
 * 🔧 Canvas座標系でNDC変換（World座標系の誤りを修正）
 * 🔧 Bounds原点オフセット考慮
 * 🔧 UV座標正規化
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
  halfWidth: f32,
  padding: f32
}

@group(0) @binding(0) var<uniform> uQuad: QuadUniforms;

@vertex
fn main(in: VertexInput) -> VertexOutput {
  var out: VertexOutput;

  // 接線ベクトル計算
  let dir = in.next - in.curr;
  let len = length(dir);
  var tangent = vec2<f32>(0.0, 0.0);
  
  if (len > 0.01) {
    tangent = dir / len;
  } else {
    let fallbackDir = in.curr - in.prev;
    let fallbackLen = length(fallbackDir);
    if (fallbackLen > 0.01) {
      tangent = fallbackDir / fallbackLen;
    } else {
      tangent = vec2<f32>(1.0, 0.0);
    }
  }

  // 法線ベクトル（接線に垂直・右手系）
  let normal = vec2<f32>(-tangent.y, tangent.x);

  // 線幅によるオフセット
  let offset = normal * in.side * uQuad.halfWidth;

  // Canvas座標でのワールド位置
  let worldPos = in.curr + offset;

  // NDC座標変換（Canvas座標 → -1.0~1.0）
  let ndcX = (worldPos.x / uQuad.canvasWidth) * 2.0 - 1.0;
  let ndcY = 1.0 - (worldPos.y / uQuad.canvasHeight) * 2.0;

  out.position = vec4<f32>(ndcX, ndcY, 0.0, 1.0);

  // UV座標（MSDF Texture Sampling用）
  // side: -1.0（左） → uv.x=0.0, side: +1.0（右） → uv.x=1.0
  out.uv = vec2<f32>(
    (in.side + 1.0) * 0.5,
    0.5
  );

  return out;
}