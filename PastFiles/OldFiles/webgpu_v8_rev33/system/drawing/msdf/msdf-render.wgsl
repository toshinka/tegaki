/**
 * ================================================================================
 * msdf-render.wgsl - MSDF Rendering Fragment Shader
 * ================================================================================
 * 
 * 📁 親ファイル依存:
 *   - msdf-pipeline-manager.js (Render Pass実行)
 *   - webgpu-drawing-layer.js (RenderPipeline管理)
 * 
 * 📄 子ファイル依存: なし
 * 
 * 責務:
 *   - MSDFテクスチャからmedian距離取得
 *   - smoothstepでアンチエイリアス付きアルファ計算
 *   - ブラシカラー合成
 * 
 * 最適化:
 *   - threshold/range調整でエッジ品質向上
 *   - ベクター的な滑らかさ実現
 * ================================================================================
 */

struct RenderUniforms {
  threshold: f32,      // 距離閾値（通常0.5）
  range: f32,          // Smoothstep範囲（エッジ幅制御）
  opacity: f32,        // 不透明度
  padding: f32
}

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>
}

@group(0) @binding(0) var msdfSampler: sampler;
@group(0) @binding(1) var msdfTex: texture_2d<f32>;
@group(0) @binding(2) var<uniform> uRender: RenderUniforms;
@group(0) @binding(3) var<uniform> uColor: vec4<f32>;

// Median計算（3値の中央値）
fn median(r: f32, g: f32, b: f32) -> f32 {
  return max(min(r, g), min(max(r, g), b));
}

@fragment
fn main(input: VertexOutput) -> @location(0) vec4<f32> {
  // MSDFサンプリング
  let msdf = textureSample(msdfTex, msdfSampler, input.uv);
  
  // Median距離取得
  let distance = median(msdf.r, msdf.g, msdf.b);

  // Smoothstepでアンチエイリアスアルファ計算
  // threshold: エッジ中心位置
  // range: エッジのぼかし幅（小さいほどシャープ）
  let edgeMin = uRender.threshold - uRender.range;
  let edgeMax = uRender.threshold + uRender.range;
  let alpha = smoothstep(edgeMin, edgeMax, distance);

  // 最終カラー合成
  let finalAlpha = alpha * uRender.opacity * uColor.a;
  return vec4<f32>(uColor.rgb, finalAlpha);
}

// Vertex Shader（フルスクリーンクワッド用）
@vertex
fn vertMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var output: VertexOutput;
  
  // フルスクリーンクワッド頂点生成
  let x = f32((vertexIndex & 1u) << 1u) - 1.0;
  let y = f32((vertexIndex & 2u)) - 1.0;
  
  output.position = vec4<f32>(x, -y, 0.0, 1.0);
  output.uv = vec2<f32>((x + 1.0) * 0.5, (1.0 - y) * 0.5);
  
  return output;
}