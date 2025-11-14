/**
 * ================================================================================
 * wgsl-loader.js - WGSL Shader統合ローダー (Phase 2完全版)
 * ================================================================================
 * 📁 Parents: index.html
 * 📄 Children: msdf-pipeline-manager.js
 * 
 * 責務:
 *   - 全てのWGSLシェーダーコードをwindowオブジェクトへ登録
 * 
 * 🔧 Phase 2修正:
 *   - msdf-encode.wgsl: seedTex未使用問題の修正
 *   - @binding(0)を確実に使用するよう変更
 * ================================================================================
 */

(function() {
  'use strict';

  // msdf-seed-init.wgsl
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

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let edgeIdx = gid.x;
  if (edgeIdx >= uSeed.edgeCount) {
    return;
  }

  let edge = edges[edgeIdx];
  let maxX = i32(uSeed.canvasWidth);
  let maxY = i32(uSeed.canvasHeight);
  
  let p0 = vec2<i32>(i32(edge.x0), i32(edge.y0));
  let p1 = vec2<i32>(i32(edge.x1), i32(edge.y1));
  let mid = vec2<i32>(
    i32((edge.x0 + edge.x1) * 0.5),
    i32((edge.y0 + edge.y1) * 0.5)
  );
  let q1 = vec2<i32>(
    i32(edge.x0 * 0.75 + edge.x1 * 0.25),
    i32(edge.y0 * 0.75 + edge.y1 * 0.25)
  );
  let q3 = vec2<i32>(
    i32(edge.x0 * 0.25 + edge.x1 * 0.75),
    i32(edge.y0 * 0.25 + edge.y1 * 0.75)
  );

  if (p0.x >= 0 && p0.x < maxX && p0.y >= 0 && p0.y < maxY) {
    textureStore(seedTex, p0, vec4<f32>(edge.x0, edge.y0, edge.edgeId, 0.0));
  }
  
  if (p1.x >= 0 && p1.x < maxX && p1.y >= 0 && p1.y < maxY) {
    textureStore(seedTex, p1, vec4<f32>(edge.x1, edge.y1, edge.edgeId, 0.0));
  }
  
  if (mid.x >= 0 && mid.x < maxX && mid.y >= 0 && mid.y < maxY) {
    textureStore(seedTex, mid, vec4<f32>(f32(mid.x), f32(mid.y), edge.edgeId, 0.0));
  }
  
  if (q1.x >= 0 && q1.x < maxX && q1.y >= 0 && q1.y < maxY) {
    textureStore(seedTex, q1, vec4<f32>(f32(q1.x), f32(q1.y), edge.edgeId, 0.0));
  }
  
  if (q3.x >= 0 && q3.x < maxX && q3.y >= 0 && q3.y < maxY) {
    textureStore(seedTex, q3, vec4<f32>(f32(q3.x), f32(q3.y), edge.edgeId, 0.0));
  }
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

  // msdf-encode.wgsl (🔧 seedTex参照方式に変更)
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

  // 🔧 seedTexから最近接EdgeIdを取得（binding 0を確実に使用）
  let seedData = textureLoad(seedTex, pos, 0);
  let nearestEdgeId = i32(seedData.b);

  // 各チャンネルの距離を計算
  var distances = vec3<f32>(1000.0, 1000.0, 1000.0);
  
  // 最近接エッジ周辺のみを高精度計算
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

@group(0) @binding(0) var msdfSampler: sampler;
@group(0) @binding(1) var msdfTex: texture_2d<f32>;
@group(0) @binding(2) var<uniform> uRender: RenderUniforms;
@group(0) @binding(3) var<uniform> uColor: vec4<f32>;

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

  console.log('✅ wgsl-loader.js Phase 2完全版 loaded');
  console.log('   🔧 msdf-encode: seedTex参照追加（binding 0使用保証）');

})();