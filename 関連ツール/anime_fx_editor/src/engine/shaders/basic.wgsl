/**
 * @file basic.wgsl
 * @description 基本的な画像描画用のシェーダープログラム (WebGPU Shading Language)。
 * 3D対応（深度、Z軸移動）を見据えて、MVP(Model-View-Projection)行列を受け取れる構造にします。
 */

struct CameraUniform {
    viewProjection: mat4x4<f32>,
};

@group(0) @binding(0) var<uniform> camera: CameraUniform;

struct ModelUniform {
    transform: mat4x4<f32>,
    opacity: f32,
};

@group(1) @binding(0) var<uniform> model: ModelUniform;
@group(1) @binding(1) var mySampler: sampler;
@group(1) @binding(2) var myTexture: texture_2d<f32>;

struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) uv: vec2<f32>,
};

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
    @location(1) opacity: f32,
};

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    // 将来の3D空間配置のためにMVP行列を乗算する
    out.position = camera.viewProjection * model.transform * vec4<f32>(in.position, 1.0);
    out.uv = in.uv;
    out.opacity = model.opacity;
    return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    var color = textureSample(myTexture, mySampler, in.uv);
    // 透明度を適用
    return vec4<f32>(color.rgb, color.a * in.opacity);
}
