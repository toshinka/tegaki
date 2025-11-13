// ============================================================================
// msdf-encode.wgsl
// WebGPU MSDF - MSDF Encode Compute Shader
// ============================================================================
// 【責務】
// - seedTextureから最近接EdgeId取得
// - Edgeへの最短距離計算（点-線分距離）
// - insideFlagで符号適用
// - channelIdに応じてr/g/bへ書き込み
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

@group(0) @binding(0) var seedTex: texture_2d<f32>;
@group(0) @binding(1) var<storage, read> edges: array<EdgeData>;
@group(0) @binding(2) var msdfTex: texture_storage_2d<rgba16float, write>;
@group(0) @binding(3) var<uniform> uTexSize: vec2<u32>;

// 点と線分の距離計算
fn pointToSegmentDistance(p: vec2<f32>, a: vec2<f32>, b: vec2<f32>) -> f32 {
  let pa = p - a;
  let ba = b - a;
  let h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  let diff = pa - ba * h;
  return length(diff);
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) globalId: vec3<u32>) {
  let coord = vec2<i32>(i32(globalId.x), i32(globalId.y));
  
  if (coord.x >= i32(uTexSize.x) || coord.y >= i32(uTexSize.y)) {
    return;
  }

  let seed = textureLoad(seedTex, coord, 0);
  let edgeId = i32(seed.z);
  
  if (edgeId < 0) {
    // Seed未設定
    textureStore(msdfTex, coord, vec4<f32>(1e10, 1e10, 1e10, 0.0));
    return;
  }

  let edge = edges[edgeId];
  let p = vec2<f32>(f32(coord.x), f32(coord.y));
  let a = vec2<f32>(edge.x0, edge.y0);
  let b = vec2<f32>(edge.x1, edge.y1);
  
  let dist = pointToSegmentDistance(p, a, b);
  let signedDist = dist * edge.insideFlag;
  
  // channelIdに応じて書き込み
  var msdf = vec4<f32>(1e10, 1e10, 1e10, 0.0);
  let channel = i32(edge.channelId);
  
  if (channel == 0) {
    msdf.r = signedDist;
  } else if (channel == 1) {
    msdf.g = signedDist;
  } else if (channel == 2) {
    msdf.b = signedDist;
  }
  
  textureStore(msdfTex, coord, msdf);
}