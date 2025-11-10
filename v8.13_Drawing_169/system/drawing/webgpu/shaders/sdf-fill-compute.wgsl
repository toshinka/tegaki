// ================================================================================
// SDF FloodFill Compute Shader - Phase 1
// ================================================================================
// 役割: SDF距離場を用いた閉領域塗りつぶしマスク生成
// 処理: クリック位置のdistance値を基準に、閾値以内のピクセルを塗る
// ================================================================================

struct FloodFillParams {
    seedDistance: f32,      // クリック位置の距離値
    threshold: f32,         // 塗りつぶし閾値
    width: u32,            // キャンバス幅
    height: u32,           // キャンバス高さ
}

@group(0) @binding(0) var<storage, read> sdfField: array<f32>;
@group(0) @binding(1) var<storage, read_write> maskOutput: array<u32>;
@group(0) @binding(2) var<uniform> params: FloodFillParams;

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    // 範囲外チェック
    if (id.x >= params.width || id.y >= params.height) {
        return;
    }

    let idx = id.y * params.width + id.x;
    let distance = sdfField[idx];
    
    // 種点のdistanceとの差が閾値以内なら塗る
    let distDiff = abs(distance - params.seedDistance);
    
    if (distDiff < params.threshold) {
        maskOutput[idx] = 1u;
    } else {
        maskOutput[idx] = 0u;
    }
}