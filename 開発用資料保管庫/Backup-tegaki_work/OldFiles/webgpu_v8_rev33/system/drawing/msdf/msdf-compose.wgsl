// ============================================================================
// msdf-compose.wgsl
// WebGPU MSDF - Compose Compute Shader
// ============================================================================
// 【責務】
// - 前フレームMSDF + 新ストロークMSDF合成
// - Pen: min(prev, new) [距離の最小値]
// - Eraser: max(prev, new) [距離の最大値]
// ============================================================================

@group(0) @binding(0) var prevMSDF: texture_2d<f32>;
@group(0) @binding(1) var newMSDF: texture_2d<f32>;
@group(0) @binding(2) var<uniform> uMode: u32; // 0=pen, 1=eraser
@group(0) @binding(3) var outTex: texture_storage_2d<rgba16float, write>;
@group(0) @binding(4) var<uniform> uTexSize: vec2<u32>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) globalId: vec3<u32>) {
  let coord = vec2<i32>(i32(globalId.x), i32(globalId.y));
  
  if (coord.x >= i32(uTexSize.x) || coord.y >= i32(uTexSize.y)) {
    return;
  }

  let prev = textureLoad(prevMSDF, coord, 0);
  let new = textureLoad(newMSDF, coord, 0);
  
  var result: vec4<f32>;
  
  if (uMode == 0u) {
    // Pen mode: min()
    result = min(prev, new);
  } else {
    // Eraser mode: max()
    result = max(prev, new);
  }
  
  textureStore(outTex, coord, result);
}