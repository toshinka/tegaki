// ================================================================================
// system/drawing/webgpu/shaders/sdf-mask-composite.wgsl
// Phase 3: SDF + マスク合成 Fragment Shader
// ================================================================================
//
// 【責務】
// - SDFテクスチャとマスクテクスチャを合成
// - ペン（加算）、消しゴム（減算）モード対応
// - 滑らかな境界表現
//
// ================================================================================

struct Uniforms {
    mode: u32,           // 0=pen(add), 1=eraser(subtract)
    radius: f32,
    hardness: f32,
    opacity: f32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var sdfTexture: texture_2d<f32>;
@group(0) @binding(2) var maskTexture: texture_2d<f32>;
@group(0) @binding(3) var sdfSampler: sampler;

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) uv: vec2f,
};

@fragment
fn main(input: VertexOutput) -> @location(0) vec4f {
    let sdfValue = textureSample(sdfTexture, sdfSampler, input.uv).r;
    let maskValue = textureSample(maskTexture, sdfSampler, input.uv).r;
    
    // SDF距離をアルファ値に変換
    let dist = sdfValue * 2.0 - 1.0;  // 0~1 → -1~1
    let edge = uniforms.radius * (1.0 - uniforms.hardness);
    let alpha = smoothstep(uniforms.radius, uniforms.radius - edge, abs(dist));
    
    var finalAlpha = 0.0;
    
    if (uniforms.mode == 0u) {
        // ペンモード: マスクに加算
        finalAlpha = clamp(maskValue + alpha * uniforms.opacity, 0.0, 1.0);
    } else {
        // 消しゴムモード: マスクから減算
        finalAlpha = clamp(maskValue - alpha * uniforms.opacity, 0.0, 1.0);
    }
    
    return vec4f(finalAlpha, 0.0, 0.0, finalAlpha);
}

@vertex
fn vertexMain(@location(0) position: vec2f, @location(1) uv: vec2f) -> VertexOutput {
    var output: VertexOutput;
    output.position = vec4f(position, 0.0, 1.0);
    output.uv = uv;
    return output;
}