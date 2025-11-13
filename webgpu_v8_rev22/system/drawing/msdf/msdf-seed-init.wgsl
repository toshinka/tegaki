/**
 * ================================================================================
 * msdf-seed-init.wgsl - MSDF Seed初期化 Compute Shader
 * ================================================================================
 * 
 * 📁 親ファイル依存:
 *   - msdf-pipeline-manager.js (Compute Pass実行)
 *   - gpu-stroke-processor.js (EdgeBuffer生成元)
 * 
 * 📄 子ファイル依存: なし
 * 
 * 責務:
 *   - EdgeBufferからエッジ端点・中点をSeedとしてテクスチャへ書き込み
 *   - 各Seedに最近接EdgeId記録
 *   - デバッグコード完全削除（赤四角の原因）
 * 
 * EdgeBuffer構造:
 *   [x0, y0, x1, y1, edgeId, channelId, insideFlag, padding]
 * 
 * SeedTexture Format: rgba32float
 *   - r,g: Seed座標 (x,y)
 *   - b: EdgeId
 *   - a: 距離二乗（初期値=0.0）
 * ================================================================================
 */

// EdgeBuffer構造体
struct Edge {
  x0: f32,
  y0: f32,
  x1: f32,
  y1: f32,
  edgeId: f32,
  channelId: f32,
  insideFlag: f32,
  padding: f32
}

// Uniform
struct SeedUniforms {
  canvasWidth: f32,
  canvasHeight: f32,
  edgeCount: u32,
  padding: f32
}

@group(0) @binding(0) var<storage, read> edges: array<Edge>;
@group(0) @binding(1) var seedTex: texture_storage_2d<rgba32float, write>;
@group(0) @binding(2) var<uniform> uSeed: SeedUniforms;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let edgeIdx = gid.x;
  if (edgeIdx >= uSeed.edgeCount) {
    return;
  }

  let edge = edges[edgeIdx];
  
  // エッジ端点を整数座標に変換
  let p0 = vec2<i32>(i32(edge.x0), i32(edge.y0));
  let p1 = vec2<i32>(i32(edge.x1), i32(edge.y1));
  
  // 中点計算
  let mid = vec2<i32>(
    i32((edge.x0 + edge.x1) * 0.5),
    i32((edge.y0 + edge.y1) * 0.5)
  );

  // キャンバス範囲チェック
  let maxX = i32(uSeed.canvasWidth);
  let maxY = i32(uSeed.canvasHeight);

  // Seed書き込み関数（範囲チェック付き）
  fn writeSeed(pos: vec2<i32>, seedPos: vec2<f32>, edgeId: f32) {
    if (pos.x >= 0 && pos.x < maxX && pos.y >= 0 && pos.y < maxY) {
      // SeedData: (seedX, seedY, edgeId, distanceSq=0.0)
      textureStore(seedTex, pos, vec4<f32>(seedPos.x, seedPos.y, edgeId, 0.0));
    }
  }

  // 端点p0をSeedとして書き込み
  writeSeed(p0, vec2<f32>(edge.x0, edge.y0), edge.edgeId);

  // 端点p1をSeedとして書き込み
  writeSeed(p1, vec2<f32>(edge.x1, edge.y1), edge.edgeId);

  // 中点をSeedとして書き込み
  writeSeed(mid, vec2<f32>(f32(mid.x), f32(mid.y)), edge.edgeId);

  // エッジ上の追加Seed（精度向上用: 4分割点）
  let q1 = vec2<i32>(
    i32(edge.x0 * 0.75 + edge.x1 * 0.25),
    i32(edge.y0 * 0.75 + edge.y1 * 0.25)
  );
  let q3 = vec2<i32>(
    i32(edge.x0 * 0.25 + edge.x1 * 0.75),
    i32(edge.y0 * 0.25 + edge.y1 * 0.75)
  );

  writeSeed(q1, vec2<f32>(f32(q1.x), f32(q1.y)), edge.edgeId);
  writeSeed(q3, vec2<f32>(f32(q3.x), f32(q3.y)), edge.edgeId);
}