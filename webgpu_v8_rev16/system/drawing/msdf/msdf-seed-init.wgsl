// ============================================================================
// msdf-seed-init.wgsl
// WebGPU MSDF - Seed初期化 Compute Shader
// ============================================================================
// 【責務】
// - EdgeBuffer端点・中点をseedTextureへ書き込み
// - 各SeedにedgeId記録
// ============================================================================

struct EdgeData {
  x0: f32,
  y0: f32,
  x1: f32,
  y1: f32,
  edgeId: f32,
  channelId: f32,
  insideFlag: f32,
  padding: f32,
}

@group(0) @binding(0) var<storage, read> edges: array<EdgeData>;
@group(0) @binding(1) var seedTex: texture_storage_2d<rgba32float, write>;
@group(0) @binding(2) var<uniform> uEdgeCount: u32;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) globalId: vec3<u32>) {
  let edgeIdx = globalId.x;
  
  if (edgeIdx >= uEdgeCount) {
    return;
  }

  let edge = edges[edgeIdx];
  
  // 端点0
  let p0 = vec2<i32>(i32(edge.x0), i32(edge.y0));
  if (p0.x >= 0 && p0.y >= 0) {
    textureStore(seedTex, p0, vec4<f32>(edge.x0, edge.y0, edge.edgeId, 0.0));
  }
  
  // 端点1
  let p1 = vec2<i32>(i32(edge.x1), i32(edge.y1));
  if (p1.x >= 0 && p1.y >= 0) {
    textureStore(seedTex, p1, vec4<f32>(edge.x1, edge.y1, edge.edgeId, 0.0));
  }
  
  // 中点
  let midX = (edge.x0 + edge.x1) * 0.5;
  let midY = (edge.y0 + edge.y1) * 0.5;
  let pMid = vec2<i32>(i32(midX), i32(midY));
  if (pMid.x >= 0 && pMid.y >= 0) {
    textureStore(seedTex, pMid, vec4<f32>(midX, midY, edge.edgeId, 0.0));
  }
}