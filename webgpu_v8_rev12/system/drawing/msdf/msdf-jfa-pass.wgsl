// ============================================================================
// msdf-jfa-pass.wgsl
// WebGPU MSDF - Jump Flood Algorithm Compute Shader
// ============================================================================
// 【責務】
// - Ping-Pong TextureでSeed伝播
// - 距離二乗で最小Seedを選択
// ============================================================================

@group(0) @binding(0) var srcTex: texture_2d<f32>;
@group(0) @binding(1) var dstTex: texture_storage_2d<rgba32float, write>;
@group(0) @binding(2) var<uniform> uStep: u32;
@group(0) @binding(3) var<uniform> uTexSize: vec2<u32>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) globalId: vec3<u32>) {
  let coord = vec2<i32>(i32(globalId.x), i32(globalId.y));
  
  if (coord.x >= i32(uTexSize.x) || coord.y >= i32(uTexSize.y)) {
    return;
  }

  let step = i32(uStep);
  let currentSeed = textureLoad(srcTex, coord, 0);
  
  var bestSeed = currentSeed;
  var bestDist = 1e10;
  
  // 自座標からの距離
  if (currentSeed.z >= 0.0) {
    let dx = f32(coord.x) - currentSeed.x;
    let dy = f32(coord.y) - currentSeed.y;
    bestDist = dx * dx + dy * dy;
  }
  
  // 8方向サンプル
  for (var dy = -1; dy <= 1; dy++) {
    for (var dx = -1; dx <= 1; dx++) {
      if (dx == 0 && dy == 0) {
        continue;
      }
      
      let sampleCoord = coord + vec2<i32>(dx * step, dy * step);
      
      if (sampleCoord.x < 0 || sampleCoord.x >= i32(uTexSize.x) ||
          sampleCoord.y < 0 || sampleCoord.y >= i32(uTexSize.y)) {
        continue;
      }
      
      let seed = textureLoad(srcTex, sampleCoord, 0);
      
      if (seed.z >= 0.0) {
        let sdx = f32(coord.x) - seed.x;
        let sdy = f32(coord.y) - seed.y;
        let dist = sdx * sdx + sdy * sdy;
        
        if (dist < bestDist) {
          bestDist = dist;
          bestSeed = seed;
        }
      }
    }
  }
  
  // 距離二乗をalphaチャンネルに記録
  bestSeed.w = bestDist;
  textureStore(dstTex, coord, bestSeed);
}