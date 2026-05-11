/**
 * ================================================================================
 * wgsl-loader.js Phase 2+3完全版 - Bresenham + Quad Expansion統合
 * ================================================================================
 * 📁 Parents: index.html
 * 📄 Children: msdf-pipeline-manager.js
 * 
 * 責務: 全WGSLシェーダーコードをwindowオブジェクトへ登録
 * 
 * 🔧 Phase 2改修:
 *   - msdf-seed-init.wgsl: Bresenham Line Algorithm実装
 *   - 5点書き込み削除 → 線分ラスタライズに変更
 * 
 * 🔧 Phase 3追加:
 *   - msdf-quad-expansion.wgsl: Polygon Vertex Shader登録
 * ================================================================================
 */

(function() {
  'use strict';

  // msdf-seed-init.wgsl (Phase 2: Bresenham実装)
  window.MSDF_SEED_INIT_WGSL = `
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

struct SeedUniforms {
  canvasWidth: f32,
  canvasHeight: f32,
  edgeCount: u32,
  padding: f32
}

@group(0) @binding(0) var<storage, read> edges: array<Edge>;
@group(0) @binding(1) var seedTex: texture_storage_2d<rgba32float, write>;
@group(0) @binding(2) var<uniform> uSeed: SeedUniforms;

fn writeSeed(pos: vec2<i32>, seedPos: vec2<f32>, edgeId: f32, maxPos: vec2<i32>) {
  if (pos.x >= 0 && pos.x < maxPos.x && pos.y >= 0 && pos.y < maxPos.y) {
    textureStore(seedTex, pos, vec4<f32>(seedPos.x, seedPos.y, edgeId, 0.0));
  }
}

fn rasterizeLine(p0: vec2<i32>, p1: vec2<i32>, edgeId: f32, maxPos: vec2<i32>) {
  var x0 = p0.x;
  var y0 = p0.y;
  let x1 = p1.x;
  let y1 = p1.y;

  let dx = abs(x1 - x0);
  let dy = abs(y1 - y0);
  
  let sx = select(-1, 1, x0 < x1);
  let sy = select(-1, 1, y0 < y1);
  
  var err = dx - dy;

  loop {
    let seedPos = vec2<f32>(f32(x0), f32(y0));
    writeSeed(vec2<i32>(x0, y0), seedPos, edgeId, maxPos);

    if (x0 == x1 && y0 == y1) {
      break;
    }

    let e2 = 2 * err;
    
    if (e2 > -dy) {
      err = err - dy;
      x0 = x0 + sx;
    }
    
    if (e2 < dx) {
      err = err + dx;
      y0 = y0 + sy;
    }
  }
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let edgeIdx = gid.x;
  if (edgeIdx >= uSeed.edgeCount) {
    return;
  }

  let edge = edges[edgeIdx];
  let maxPos = vec2<i32>(i32(uSeed.canvasWidth), i32(uSeed.canvasHeight));
  
  let p0 = vec2<i32>(i32(edge.x0), i32(edge.y0));
  let p1 = vec2<i32>(i32(edge.x1), i32(edge.y1));

  rasterizeLine(p0, p1, edge.edgeId, maxPos);
}
`;

  // msdf-jfa-pass.wgsl
  window.MSDF_JFA_PASS_WGSL = `
struct JFAUniforms {
  step: u32,
  width: u32,
  height: u32,
  padding: u32
}

@group(0) @binding(0) var srcTex: texture_2d<f32>;
@group(0) @binding(1) var dstTex: texture_storage_2d<rgba32float, write>;
@group(0) @binding(2) var<uniform> uJFA: JFAUniforms;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let pos = vec2<i32>(i32(gid.x), i32(gid.y));
  let maxPos = vec2<i32>(i32(uJFA.width), i32(uJFA.height));

  if (pos.x >= maxPos.x || pos.y >= maxPos.y) {
    return;
  }

  let step = i32(uJFA.step);
  let currentPos = vec2<f32>(f32(pos.x), f32(pos.y));
  
  var bestSeed = textureLoad(srcTex, pos, 0);
  var bestDistSq = 1e10;

  if (bestSeed.b >= 0.0) {
    let seedPos = bestSeed.xy;
    let delta = currentPos - seedPos;
    bestDistSq = dot(delta, delta);
  }

  let offsets = array<vec2<i32>, 8>(
    vec2<i32>(-step, -step),
    vec2<i32>(0, -step),
    vec2<i32>(step, -step),
    vec2<i32>(-step, 0),
    vec2<i32>(step, 0),
    vec2<i32>(-step, step),
    vec2<i32>(0, step),
    vec2<i32>(step, step)
  );

  for (var i = 0; i < 8; i = i + 1) {
    let samplePos = pos + offsets[i];
    
    if (samplePos.x < 0 || samplePos.x >= maxPos.x ||
        samplePos.y < 0 || samplePos.y >= maxPos.y) {
      continue;
    }

    let neighborSeed = textureLoad(srcTex, samplePos, 0);
    
    if (neighborSeed.b < 0.0) {
      continue;
    }

    let seedPos = neighborSeed.xy;
    let delta = currentPos - seedPos;
    let distSq = dot(delta, delta);

    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestSeed = vec4<f32>(seedPos.x, seedPos.y, neighborSeed.b, distSq);
    }
  }

  textureStore(dstTex, pos, bestSeed);
}
`;

  // msdf-encode.wgsl
  window.MSDF_ENCODE_WGSL = `
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
  let lenSq = dot(ba, ba);
  
  if (lenSq < 0.0001) {
    return length(pa);
  }
  
  let h = clamp(dot(pa, ba) / lenSq, 0.0, 1.0);
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

  let pixelPos = vec2<f32>(f32(pos.x) + 0.5, f32(pos.y) + 0.5);

  let seedData = textureLoad(seedTex, pos, 0);
  let nearestEdgeId = i32(seedData.b);

  var distances = vec3<f32>(1000.0, 1000.0, 1000.0);
  
  let searchRange = 3;
  var startEdge = max(0, nearestEdgeId - searchRange);
  var endEdge = min(i32(uEncode.edgeCount), nearestEdgeId + searchRange + 1);
  
  if (nearestEdgeId < 0) {
    startEdge = 0;
    endEdge = i32(uEncode.edgeCount);
  }
  
  for (var i = startEdge; i < endEdge; i = i + 1) {
    let edge = edges[i];
    let p0 = vec2<f32>(edge.x0, edge.y0);
    let p1 = vec2<f32>(edge.x1, edge.y1);
    
    var dist = distanceToSegment(pixelPos, p0, p1);
    dist = dist * edge.insideFlag * uEncode.distanceScale;
    
    let channelIdx = i32(edge.channelId);
    
    if (channelIdx == 0 && abs(dist) < abs(distances.r)) {
      distances.r = dist;
    } else if (channelIdx == 1 && abs(dist) < abs(distances.g)) {
      distances.g = dist;
    } else if (channelIdx == 2 && abs(dist) < abs(distances.b)) {
      distances.b = dist;
    }
  }

  textureStore(msdfTex, pos, vec4<f32>(distances.r, distances.g, distances.b, 0.0));
}
`;

  // msdf-quad-expansion.wgsl (Phase 3追加)
  window.MSDF_QUAD_EXPANSION_WGSL = `
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

  let tangent0 = normalize(in.curr - in.prev);
  let tangent1 = normalize(in.next - in.curr);
  let tangent = normalize(tangent0 + tangent1);

  let normal = vec2<f32>(-tangent.y, tangent.x);

  let offset = normal * in.side * uQuad.halfWidth;

  let worldPos = in.curr + offset;

  let ndcX = (worldPos.x / uQuad.canvasWidth) * 2.0 - 1.0;
  let ndcY = 1.0 - (worldPos.y / uQuad.canvasHeight) * 2.0;

  out.position = vec4<f32>(ndcX, ndcY, 0.0, 1.0);
  out.uv = vec2<f32>((in.side + 1.0) * 0.5, 0.5);

  return out;
}
`;

  // msdf-render.wgsl
  window.MSDF_RENDER_WGSL = `
struct RenderUniforms {
  threshold: f32,
  range: f32,
  opacity: f32,
  padding: f32
}

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>
}

@group(1) @binding(0) var msdfSampler: sampler;
@group(1) @binding(1) var msdfTex: texture_2d<f32>;
@group(1) @binding(2) var<uniform> uRender: RenderUniforms;
@group(1) @binding(3) var<uniform> uColor: vec4<f32>;

fn median(r: f32, g: f32, b: f32) -> f32 {
  return max(min(r, g), min(max(r, g), b));
}

@fragment
fn main(input: VertexOutput) -> @location(0) vec4<f32> {
  let msdf = textureSample(msdfTex, msdfSampler, input.uv);
  let distance = median(msdf.r, msdf.g, msdf.b);
  let edgeMin = uRender.threshold - uRender.range;
  let edgeMax = uRender.threshold + uRender.range;
  let alpha = smoothstep(edgeMin, edgeMax, distance);
  let finalAlpha = alpha * uRender.opacity * uColor.a;
  return vec4<f32>(uColor.rgb, finalAlpha);
}

@vertex
fn vertMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var output: VertexOutput;
  let x = f32((vertexIndex & 1u) << 1u) - 1.0;
  let y = f32((vertexIndex & 2u)) - 1.0;
  output.position = vec4<f32>(x, -y, 0.0, 1.0);
  output.uv = vec2<f32>((x + 1.0) * 0.5, (1.0 - y) * 0.5);
  return output;
}
`;

  console.log('✅ wgsl-loader.js Phase 2+3完全版 loaded');
  console.log('   🔧 Phase 2: Bresenham Line Algorithm実装');
  console.log('   🔧 Phase 3: msdf-quad-expansion.wgsl登録');

})();