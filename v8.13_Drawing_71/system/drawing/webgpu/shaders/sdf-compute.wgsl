// sdf-compute.wgsl - SDF距離場生成 Compute Shader
// Phase 4-A-2: WebGPU Compute ShaderによるSDF生成

struct SDFParams {
    width: u32,
    height: u32,
    maxDistance: f32,
    pointCount: u32,
}

@group(0) @binding(0) var<storage, read> strokePoints: array<vec2f>;
@group(0) @binding(1) var<storage, read_write> sdfOutput: array<f32>;
@group(0) @binding(2) var<uniform> params: SDFParams;

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) id: vec3u) {
    // 範囲外チェック
    if (id.x >= params.width || id.y >= params.height) {
        return;
    }

    let pixelCoord = vec2f(f32(id.x), f32(id.y));
    var minDist = 999999.0;

    // 全ストロークポイントとの最短距離を計算
    for (var i = 0u; i < params.pointCount; i++) {
        let strokePoint = strokePoints[i];
        let dist = distance(pixelCoord, strokePoint);
        minDist = min(minDist, dist);
    }

    // 正規化 [0, 1]
    let normalized = clamp(minDist / params.maxDistance, 0.0, 1.0);

    // 出力バッファに書き込み
    let idx = id.y * params.width + id.x;
    sdfOutput[idx] = normalized;
}