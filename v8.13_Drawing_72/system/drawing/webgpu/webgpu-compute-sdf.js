// ================================================================================
// MSDF Compute Shader - WebGPU Multi-channel Signed Distance Field
// ================================================================================
// Phase 4-B-4: RGB 3チャンネルでエッジ距離を並列計算
// 入力: ストロークポイント配列
// 出力: RGBA (R,G,B: 距離場, A: エッジ品質)
// ================================================================================

struct SDFParams {
    width: u32,
    height: u32,
    pointCount: u32,
    maxDistance: f32,
    range: f32,
    _padding: vec3<f32>
}

struct EdgeInfo {
    distance: f32,
    normalX: f32,
    normalY: f32,
    _padding: f32
}

@group(0) @binding(0) var<storage, read> strokePoints: array<vec2<f32>>;
@group(0) @binding(1) var<storage, read_write> msdfOutput: array<vec4<f32>>;
@group(0) @binding(2) var<uniform> params: SDFParams;

// ================================================================================
// エッジまでの距離計算
// ================================================================================

fn getEdgeDistance(pixel: vec2<f32>, p1: vec2<f32>, p2: vec2<f32>) -> EdgeInfo {
    let edge = p2 - p1;
    let edgeLen = length(edge);
    
    if (edgeLen < 0.001) {
        let dist = distance(pixel, p1);
        let dir = normalize(pixel - p1);
        return EdgeInfo(dist, dir.x, dir.y, 0.0);
    }
    
    let t = clamp(dot(pixel - p1, edge) / (edgeLen * edgeLen), 0.0, 1.0);
    let closestPoint = p1 + t * edge;
    let dist = distance(pixel, closestPoint);
    let normal = normalize(pixel - closestPoint);
    
    return EdgeInfo(dist, normal.x, normal.y, 0.0);
}

// ================================================================================
// 最も近い3つのエッジを検出
// ================================================================================

fn findNearestEdges(pixel: vec2<f32>) -> array<EdgeInfo, 3> {
    var edges: array<EdgeInfo, 3>;
    
    // 初期化
    for (var i = 0u; i < 3u; i++) {
        edges[i] = EdgeInfo(999999.0, 0.0, 0.0, 0.0);
    }
    
    // 全エッジを走査
    for (var i = 0u; i < params.pointCount - 1u; i++) {
        let p1 = strokePoints[i];
        let p2 = strokePoints[i + 1u];
        let edgeInfo = getEdgeDistance(pixel, p1, p2);
        
        // 距離でソート（上位3つを保持）
        if (edgeInfo.distance < edges[0].distance) {
            edges[2] = edges[1];
            edges[1] = edges[0];
            edges[0] = edgeInfo;
        } else if (edgeInfo.distance < edges[1].distance) {
            edges[2] = edges[1];
            edges[1] = edgeInfo;
        } else if (edgeInfo.distance < edges[2].distance) {
            edges[2] = edgeInfo;
        }
    }
    
    return edges;
}

// ================================================================================
// エッジ品質計算（角度の一貫性）
// ================================================================================

fn calculateEdgeQuality(edges: array<EdgeInfo, 3>) -> f32 {
    let normal0 = vec2<f32>(edges[0].normalX, edges[0].normalY);
    let normal1 = vec2<f32>(edges[1].normalX, edges[1].normalY);
    let normal2 = vec2<f32>(edges[2].normalX, edges[2].normalY);
    
    // 法線ベクトルの内積（角度差）
    let dot01 = dot(normal0, normal1);
    let dot12 = dot(normal1, normal2);
    let dot02 = dot(normal0, normal2);
    
    // 角度の一貫性スコア（-1.0 ~ 1.0）
    let consistency = (dot01 + dot12 + dot02) / 3.0;
    
    // 一貫性が低い（角・交差部）ほど高品質が必要
    return 1.0 - abs(consistency);
}

// ================================================================================
// メイン計算
// ================================================================================

@compute @workgroup_size(8, 8, 1)
fn computeMSDF(@builtin(global_invocation_id) id: vec3<u32>) {
    if (id.x >= params.width || id.y >= params.height) {
        return;
    }
    
    let pixel = vec2<f32>(f32(id.x), f32(id.y));
    let edges = findNearestEdges(pixel);
    
    // RGB各チャンネルに距離を正規化して格納
    let r = clamp(edges[0].distance / params.maxDistance, 0.0, 1.0);
    let g = clamp(edges[1].distance / params.maxDistance, 0.0, 1.0);
    let b = clamp(edges[2].distance / params.maxDistance, 0.0, 1.0);
    
    // エッジ品質計算（アルファチャンネル）
    let quality = calculateEdgeQuality(edges);
    
    // 結果を出力
    let idx = id.y * params.width + id.x;
    msdfOutput[idx] = vec4<f32>(r, g, b, quality);
}