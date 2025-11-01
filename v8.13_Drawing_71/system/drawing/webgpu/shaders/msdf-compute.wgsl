// msdf-compute.wgsl - MSDF距離場生成 Compute Shader
// Phase 4-B-4: RGB 3チャンネル距離場（オプション実装）

struct MSDFParams {
    width: u32,
    height: u32,
    maxDistance: f32,
    pointCount: u32,
}

@group(0) @binding(0) var<storage, read> strokePoints: array<vec2f>;
@group(0) @binding(1) var<storage, read_write> msdfOutput: array<vec4f>;
@group(0) @binding(2) var<uniform> params: MSDFParams;

// 最近接3エッジを検出
struct EdgeDistances {
    d1: f32,
    d2: f32,
    d3: f32,
}

fn findNearestEdges(pixel: vec2f, pointCount: u32) -> EdgeDistances {
    var distances = array<f32, 3>(999999.0, 999999.0, 999999.0);
    
    for (var i = 0u; i < pointCount; i++) {
        let point = strokePoints[i];
        let dist = distance(pixel, point);
        
        // 3つの最小距離を保持
        if (dist < distances[0]) {
            distances[2] = distances[1];
            distances[1] = distances[0];
            distances[0] = dist;
        } else if (dist < distances[1]) {
            distances[2] = distances[1];
            distances[1] = dist;
        } else if (dist < distances[2]) {
            distances[2] = dist;
        }
    }
    
    return EdgeDistances(distances[0], distances[1], distances[2]);
}

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) id: vec3u) {
    if (id.x >= params.width || id.y >= params.height) {
        return;
    }

    let pixel = vec2f(f32(id.x), f32(id.y));
    
    // 3つの最近接エッジ距離を取得
    let edges = findNearestEdges(pixel, params.pointCount);
    
    // RGB各チャンネルに正規化距離を格納
    let r = clamp(edges.d1 / params.maxDistance, 0.0, 1.0);
    let g = clamp(edges.d2 / params.maxDistance, 0.0, 1.0);
    let b = clamp(edges.d3 / params.maxDistance, 0.0, 1.0);
    
    let idx = id.y * params.width + id.x;
    msdfOutput[idx] = vec4f(r, g, b, 1.0);
}