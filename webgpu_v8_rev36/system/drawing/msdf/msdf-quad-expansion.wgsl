/**
 * ================================================================================
 * msdf-quad-expansion.wgsl Phase 5完全修正版
 * ================================================================================
 * 
 * 📁 親ファイル依存:
 *   - msdf-pipeline-manager.js (RenderPipeline, QuadUniforms作成)
 *   - gpu-stroke-processor.js (VertexBuffer生成・Bounds原点正規化)
 * 
 * 📄 子ファイル依存:
 *   - msdf-render.wgsl (Fragment Shader)
 * 
 * 【Phase 5改修】
 * 🔧 Bounds幅/高さでNDC変換（Canvas幅の誤りを修正）
 * 🔧 QuadUniforms: canvasWidth/Height → boundsWidth/Height
 * 🔧 入力座標はBounds原点基準（gpu-stroke-processorで正規化済み）
 * 🔧 NDC変換: (0,0)～(boundsWidth,boundsHeight) → (-1,-1)～(1,1)
 * 
 * VertexBuffer構造:
 *   [prev.x, prev.y, curr.x, curr.y, next.x, next.y, side]
 *   stride: 7 floats = 28 bytes
 *   座標: Bounds原点基準（minXが0、minYが0）
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
  boundsWidth: f32,   // Bounds幅（Canvas幅ではない）
  boundsHeight: f32,  // Bounds高さ
  halfWidth: f32,     // 線幅の半分
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
    // 次点が無効な場合は前点から算出
    let fallbackDir = in.curr - in.prev;
    let fallbackLen = length(fallbackDir);
    if (fallbackLen > 0.01) {
      tangent = fallbackDir / fallbackLen;
    } else {
      // それでも無効ならデフォルト
      tangent = vec2<f32>(1.0, 0.0);
    }
  }

  // 法線ベクトル（接線に垂直・右手系）
  let normal = vec2<f32>(-tangent.y, tangent.x);

  // 線幅によるオフセット（side: -1.0=左, +1.0=右）
  let offset = normal * in.side * uQuad.halfWidth;

  // Bounds基準の座標にオフセット適用
  let worldPos = in.curr + offset;

  // NDC座標変換（Bounds座標 → -1.0~1.0）
  // (0, 0) → (-1, 1)
  // (boundsWidth, boundsHeight) → (1, -1)
  let ndcX = (worldPos.x / uQuad.boundsWidth) * 2.0 - 1.0;
  let ndcY = 1.0 - (worldPos.y / uQuad.boundsHeight) * 2.0;

  out.position = vec4<f32>(ndcX, ndcY, 0.0, 1.0);

  // UV座標（MSDF Texture Sampling用）
  // side: -1.0 → uv.x=0.0 (左端)
  // side: +1.0 → uv.x=1.0 (右端)
  out.uv = vec2<f32>(
    (in.side + 1.0) * 0.5,
    0.5
  );

  return out;
}