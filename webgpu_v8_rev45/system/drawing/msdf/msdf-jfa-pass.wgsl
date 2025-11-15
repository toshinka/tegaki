/**
 * ================================================================================
 * msdf-jfa-pass.wgsl - Jump Flood Algorithm Compute Shader
 * ================================================================================
 * 
 * 📁 親ファイル依存:
 *   - msdf-pipeline-manager.js (Ping-Pong反復実行)
 * 
 * 📄 子ファイル依存: なし
 * 
 * 責務:
 *   - Seedテクスチャの距離場を8方向伝播で拡散
 *   - Ping-Pongテクスチャで反復（log2(max(w,h))回）
 *   - 各ピクセルに最近接Seedを記録
 * 
 * SeedTexture Format: rgba32float
 *   - r,g: Seed座標 (x,y)
 *   - b: EdgeId
 *   - a: 距離二乗
 * ================================================================================
 */

struct JFAUniforms {
  step: u32,
  width: u32,
  height: u32,
  padding: u32
}

@group(0) @binding(0) var srcTex: texture_2d<f32>;
@group(0) @binding(1) var dstTex: texture_storage_2d<rgba32float, write>;
@group(0) @binding(2) var<uniform> uJFA: JFAUniforms;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let pos = vec2<i32>(i32(gid.x), i32(gid.y));
  let maxPos = vec2<i32>(i32(uJFA.width), i32(uJFA.height));

  if (pos.x >= maxPos.x || pos.y >= maxPos.y) {
    return;
  }

  let step = i32(uJFA.step);
  let currentPos = vec2<f32>(f32(pos.x), f32(pos.y));
  
  // 現在の最近接Seed
  var bestSeed = textureLoad(srcTex, pos, 0);
  var bestDistSq = 1e10;

  // 既存Seedがある場合は距離計算
  if (bestSeed.b >= 0.0) {
    let seedPos = bestSeed.xy;
    let delta = currentPos - seedPos;
    bestDistSq = dot(delta, delta);
  }

  // 8方向サンプリング
  let offsets = array<vec2<i32>, 8>(
    vec2<i32>(-step, -step), // 左上
    vec2<i32>(0, -step),     // 上
    vec2<i32>(step, -step),  // 右上
    vec2<i32>(-step, 0),     // 左
    vec2<i32>(step, 0),      // 右
    vec2<i32>(-step, step),  // 左下
    vec2<i32>(0, step),      // 下
    vec2<i32>(step, step)    // 右下
  );

  for (var i = 0; i < 8; i = i + 1) {
    let samplePos = pos + offsets[i];
    
    // 範囲チェック
    if (samplePos.x < 0 || samplePos.x >= maxPos.x ||
        samplePos.y < 0 || samplePos.y >= maxPos.y) {
      continue;
    }

    let neighborSeed = textureLoad(srcTex, samplePos, 0);
    
    // Seedが存在しない場合はスキップ
    if (neighborSeed.b < 0.0) {
      continue;
    }

    // Seed位置からの距離計算
    let seedPos = neighborSeed.xy;
    let delta = currentPos - seedPos;
    let distSq = dot(delta, delta);

    // より近いSeedを採用
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestSeed = vec4<f32>(seedPos.x, seedPos.y, neighborSeed.b, distSq);
    }
  }

  // 結果書き込み
  textureStore(dstTex, pos, bestSeed);
}