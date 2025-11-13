/**
 * ================================================================================
 * msdf-encode.wgsl - MSDF Distance Encoding Compute Shader
 * ================================================================================
 * 📁 Parents: msdf-pipeline-manager.js, gpu-stroke-processor.js
 * 📄 Children: なし
 * 
 * 責務:
 *   - 各ピクセルから最近接Edgeへの距離計算
 *   - 点-線分間距離の正確な計算
 *   - R/G/Bチャンネルに異なるEdge距離を記録
 * 
 * ⚠️ CRITICAL: @binding は必ず 0, 1, 2, 3 の連番にすること
 * ================================================================================
 */

struct Edge {
  x0: f32,
  y0: f32,
  x1: f32,
  y1: f32,
  edgeId: f32,
  channelId: f32,
  insideFlag: f32,
  padding: f32
}

struct EncodeUniforms {
  canvasWidth: f32,
  canvasHeight: f32,
  edgeCount: u32,
  distanceScale: f32
}

@group(0) @binding(0) var seedTex: texture_2d<f32>;
@group(0) @binding(1) var<storage, read> edges: array<Edge>;
@group(0) @binding(2) var msdfTex: texture_storage_2d<rgba16float, write>;
@group(0) @binding(3) var<uniform> uEncode: EncodeUniforms;

fn distanceToSegment(p: vec2<f32>, a: vec2<f32>, b: vec2<f32>) -> f32 {
  let pa = p - a;
  let ba = b - a;
  let h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  let nearest = a + ba * h;
  return length(p - nearest);
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let pos = vec2<i32>(i32(gid.x), i32(gid.y));
  let maxPos = vec2<i32>(i32(uEncode.canvasWidth), i32(uEncode.canvasHeight));

  if (pos.x >= maxPos.x || pos.y >= maxPos.y) {
    return;
  }

  let pixelPos = vec2<f32>(f32(pos.x), f32(pos.y));
  let seedData = textureLoad(seedTex, pos, 0);
  let edgeId = i32(seedData.b);

  if (edgeId < 0 || u32(edgeId) >= uEncode.edgeCount) {
    let maxDist = 1e10;
    textureStore(msdfTex, pos, vec4<f32>(maxDist, maxDist, maxDist, 0.0));
    return;
  }

  let edge = edges[edgeId];
  let p0 = vec2<f32>(edge.x0, edge.y0);
  let p1 = vec2<f32>(edge.x1, edge.y1);

  var distance = distanceToSegment(pixelPos, p0, p1);
  distance = distance * edge.insideFlag;
  distance = distance * uEncode.distanceScale;

  var rgb = vec3<f32>(1e10, 1e10, 1e10);
  let channelIdx = i32(edge.channelId);

  if (channelIdx == 0) {
    rgb.r = distance;
  } else if (channelIdx == 1) {
    rgb.g = distance;
  } else if (channelIdx == 2) {
    rgb.b = distance;
  }

  textureStore(msdfTex, pos, vec4<f32>(rgb.r, rgb.g, rgb.b, 0.0));
}