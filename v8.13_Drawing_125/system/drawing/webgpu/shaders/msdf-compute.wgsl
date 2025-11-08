// msdf-compute.wgsl - Multi-channel SDF Compute Shader
// Phase 4-B-4: RGB 3チャンネル距離場生成（完全版）

struct MSDFParams {
    width: u32,
    height: u32,
    pointCount: u32,
    maxDistance: f32,
    range: f32,
    padding: vec3<f32>,
}

@group(0) @binding(0) var<storage, read> strokePoints: array<vec2f>;
@group(0) @binding(1) var<storage, read_write> msdfOutput: array<vec4f>;
@group(0) @binding(2) var<uniform> params: MSDFParams;

// エッジセグメントから最近接点を計算
fn closestPointOnSegment(p: vec2f, a: vec2f, b: vec2f) -> vec2f {
    let ab = b - a;
    let ap = p - a;
    let t = clamp(dot(ap, ab) / dot(ab, ab), 0.0, 1.0);
    return a + t * ab;
}

// 符号付き距離を計算（内側=負、外側=正）
fn signedDistance(p: vec2f, segStart: vec2f, segEnd: vec2f) -> f32 {
    let closest = closestPointOnSegment(p, segStart, segEnd);
    let dist = distance(p, closest);
    
    // 外積で内外判定
    let edge = segEnd - segStart;
    let toPoint = p - segStart;
    let cross = edge.x * toPoint.y - edge.y * toPoint.x;
    
    return select(dist, -dist, cross < 0.0);
}

// 最近接3エッジを検出してRGB距離を計算
fn computeMultiChannelDistance(pixel: vec2f) -> vec3f {
    let pointCount = params.pointCount;
    
    if (pointCount < 2u) {
        return vec3f(1.0);
    }
    
    var distances = array<f32, 3>(999999.0, 999999.0, 999999.0);
    var signs = array<f32, 3>(1.0, 1.0, 1.0);
    
    // 全セグメントをスキャンして最近接3つを保持
    for (var i = 0u; i < pointCount - 1u; i++) {
        let segStart = strokePoints[i];
        let segEnd = strokePoints[i + 1u];
        
        let signedDist = signedDistance(pixel, segStart, segEnd);
        let absDist = abs(signedDist);
        
        // 3つの最小距離を更新
        if (absDist < abs(distances[0])) {
            distances[2] = distances[1];
            signs[2] = signs[1];
            distances[1] = distances[0];
            signs[1] = signs[0];
            distances[0] = signedDist;
            signs[0] = select(1.0, -1.0, signedDist < 0.0);
        } else if (absDist < abs(distances[1])) {
            distances[2] = distances[1];
            signs[2] = signs[1];
            distances[1] = signedDist;
            signs[1] = select(1.0, -1.0, signedDist < 0.0);
        } else if (absDist < abs(distances[2])) {
            distances[2] = signedDist;
            signs[2] = select(1.0, -1.0, signedDist < 0.0);
        }
    }
    
    // range パラメータで正規化（0.5を中心に）
    let r = 0.5 + (distances[0] / params.range);
    let g = 0.5 + (distances[1] / params.range);
    let b = 0.5 + (distances[2] / params.range);
    
    return clamp(vec3f(r, g, b), vec3f(0.0), vec3f(1.0));
}

@compute @workgroup_size(8, 8, 1)
fn computeMSDF(@builtin(global_invocation_id) id: vec3u) {
    if (id.x >= params.width || id.y >= params.height) {
        return;
    }

    let pixel = vec2f(f32(id.x), f32(id.y));
    
    // RGB 3チャンネル距離計算
    let msdf = computeMultiChannelDistance(pixel);
    
    let idx = id.y * params.width + id.x;
    msdfOutput[idx] = vec4f(msdf, 1.0);
}