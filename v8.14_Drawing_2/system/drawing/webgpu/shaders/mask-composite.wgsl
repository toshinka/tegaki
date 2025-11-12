// ================================================================================
// system/drawing/webgpu/shaders/mask-composite.wgsl
// Phase 2: マスク合成 Compute Shader
// ================================================================================
//
// 【責務】
// - 2つのマスクテクスチャを合成
// - ペン（加算）、消しゴム（減算）、ブラシ（乗算）対応
//
// 【合成モード】
// - add: maskA + maskB（ペン）
// - subtract: maskA - maskB（消しゴム）
// - multiply: maskA * maskB（ブラシ）
//
// ================================================================================

struct Uniforms {
    width: u32,
    height: u32,
    mode: u32,      // 0=add, 1=subtract, 2=multiply
    padding: u32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var maskA: texture_2d<f32>;
@group(0) @binding(2) var maskB: texture_2d<f32>;
@group(0) @binding(3) var outputMask: texture_storage_2d<r32float, write>;

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) global_id: vec3u) {
    let x = global_id.x;
    let y = global_id.y;
    
    // 範囲外チェック
    if (x >= uniforms.width || y >= uniforms.height) {
        return;
    }
    
    let coord = vec2i(i32(x), i32(y));
    
    let valueA = textureLoad(maskA, coord, 0).r;
    let valueB = textureLoad(maskB, coord, 0).r;
    
    var result = 0.0;
    
    // 合成モード
    switch (uniforms.mode) {
        case 0u: {
            // add: ペン（加算）
            result = clamp(valueA + valueB, 0.0, 1.0);
        }
        case 1u: {
            // subtract: 消しゴム（減算）
            result = clamp(valueA - valueB, 0.0, 1.0);
        }
        case 2u: {
            // multiply: ブラシ（乗算）
            result = valueA * valueB;
        }
        default: {
            result = valueA;
        }
    }
    
    textureStore(outputMask, coord, vec4f(result, 0.0, 0.0, 0.0));
}