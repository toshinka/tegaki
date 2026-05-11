// ============================================================================
// msdf-render.wgsl
// WebGPU MSDF - Render Fragment Shader
// ============================================================================
// 【責務】
// - median(r,g,b) → smoothstep → alpha
// - Final Render出力
// ============================================================================

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
}

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var output: VertexOutput;
  
  // Fullscreen quad
  let pos = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>( 1.0,  1.0)
  );
  
  let uv = array<vec2<f32>, 6>(
    vec2<f32>(0.0, 1.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(0.0, 0.0),
    vec2<f32>(0.0, 0.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(1.0, 0.0)
  );
  
  output.position = vec4<f32>(pos[vertexIndex], 0.0, 1.0);
  output.uv = uv[vertexIndex];
  
  return output;
}

@group(0) @binding(0) var msdfSampler: sampler;
@group(0) @binding(1) var msdfTex: texture_2d<f32>;
@group(0) @binding(2) var<uniform> uThreshold: f32;
@group(0) @binding(3) var<uniform> uRange: f32;
@group(0) @binding(4) var<uniform> uColor: vec4<f32>;

fn median(r: f32, g: f32, b: f32) -> f32 {
  return max(min(r, g), min(max(r, g), b));
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  let ms = textureSample(msdfTex, msdfSampler, input.uv);
  let d = median(ms.r, ms.g, ms.b);
  let alpha = smoothstep(uThreshold - uRange, uThreshold + uRange, d);
  
  return vec4<f32>(uColor.rgb, uColor.a * alpha);
}