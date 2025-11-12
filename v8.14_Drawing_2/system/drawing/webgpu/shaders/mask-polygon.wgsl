// ================================================================================
// system/drawing/webgpu/shaders/mask-polygon.wgsl
// Phase 2: ポリゴン→マスク変換 Compute Shader
// ================================================================================
//
// 【責務】
// - ポリゴン配列からマスクテクスチャ生成
// - Ray Casting による内外判定
// - マスク値書込（0.0~1.0）
//
// 【アルゴリズム】
// Ray Casting Algorithm:
//   点Pからx軸方向に半直線を引き、ポリゴン辺との交差回数を数える
//   奇数回 → 内側、偶数回 → 外側
//
// ================================================================================

struct Uniforms {
    width: u32,
    height: u32,
    polygonCount: u32,
    padding: u32,
};

struct Polygon {
    points: array<vec2f, 256>,  // 最大256点
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> polygon: Polygon;
@group(0) @binding(2) var maskTexture: texture_storage_2d<r32float, write>;

// Ray Casting: 点が線分と交差するか判定
fn rayIntersectsSegment(point: vec2f, v1: vec2f, v2: vec2f) -> bool {
    // 水平線チェック
    if (v1.y == v2.y) {
        return false;
    }
    
    // Y範囲外
    if (point.y < min(v1.y, v2.y) || point.y >= max(v1.y, v2.y)) {
        return false;
    }
    
    // X座標計算
    let x = v1.x + (point.y - v1.y) / (v2.y - v1.y) * (v2.x - v1.x);
    
    // 右側にあれば交差
    return x > point.x;
}

// ポリゴン内外判定
fn isInsidePolygon(point: vec2f, count: u32) -> bool {
    var intersections = 0u;
    
    for (var i = 0u; i < count; i = i + 1u) {
        let j = (i + 1u) % count;
        let v1 = polygon.points[i];
        let v2 = polygon.points[j];
        
        if (rayIntersectsSegment(point, v1, v2)) {
            intersections = intersections + 1u;
        }
    }
    
    // 奇数回交差 = 内側
    return (intersections % 2u) == 1u;
}

// アンチエイリアス: エッジからの距離計算（簡易版）
fn distanceToEdge(point: vec2f, count: u32) -> f32 {
    var minDist = 999999.0;
    
    for (var i = 0u; i < count; i = i + 1u) {
        let j = (i + 1u) % count;
        let v1 = polygon.points[i];
        let v2 = polygon.points[j];
        
        // 点から線分への最短距離
        let edge = v2 - v1;
        let toPoint = point - v1;
        let edgeLen = length(edge);
        
        if (edgeLen < 0.001) {
            continue;
        }
        
        let t = clamp(dot(toPoint, edge) / (edgeLen * edgeLen), 0.0, 1.0);
        let projection = v1 + edge * t;
        let dist = distance(point, projection);
        
        minDist = min(minDist, dist);
    }
    
    return minDist;
}

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) global_id: vec3u) {
    let x = global_id.x;
    let y = global_id.y;
    
    // 範囲外チェック
    if (x >= uniforms.width || y >= uniforms.height) {
        return;
    }
    
    let point = vec2f(f32(x), f32(y));
    let count = uniforms.polygonCount;
    
    var maskValue = 0.0;
    
    if (isInsidePolygon(point, count)) {
        // 内側: エッジからの距離でアンチエイリアス
        let dist = distanceToEdge(point, count);
        
        if (dist < 1.0) {
            // エッジ付近: 滑らかに1.0へ
            maskValue = smoothstep(0.0, 1.0, dist);
        } else {
            // 完全に内側
            maskValue = 1.0;
        }
    } else {
        // 外側: エッジ付近のみ半透明
        let dist = distanceToEdge(point, count);
        
        if (dist < 1.0) {
            maskValue = 1.0 - smoothstep(0.0, 1.0, dist);
        }
    }
    
    textureStore(maskTexture, vec2i(i32(x), i32(y)), vec4f(maskValue, 0.0, 0.0, 0.0));
}