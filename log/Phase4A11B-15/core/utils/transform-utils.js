/**
 * 行列が有効か（壊れていないか）をチェックする関数
 * @param {mat4} m - チェック対象の行列
 * @returns {boolean}
 */
export function isValidMatrix(m) {
  // Step 2: `modelMatrix` が壊れていないかのチェック関数 (修正版)
  if (!m || m.length !== 16) {
    return false;
  }
  // Float32Array にも確実に対応できるforループでチェックします
  for (let i = 0; i < 16; i++) {
    if (!Number.isFinite(m[i])) {
      return false;
    }
  }
  return true;
}

/**
 * ワールド座標（画面上の座標）をレイヤーのローカル座標に変換する
 * @param {number} worldX - ワールドX座標
 * @param {number} worldY - ワールドY座標
 * @param {mat4} modelMatrix - レイヤーのモデル行列
 * @returns {{x: number, y: number}} ローカル座標
 */
export function transformWorldToLocal(worldX, worldY, modelMatrix) {
  // Step 3: transformWorldToLocal の安全実装
  const invMatrix = glMatrix.mat4.create();
  glMatrix.mat4.invert(invMatrix, modelMatrix); // 逆行列を計算

  const worldPos = glMatrix.vec4.fromValues(worldX, worldY, 0, 1);
  const localPos = glMatrix.vec4.create();

  glMatrix.vec4.transformMat4(localPos, worldPos, invMatrix); // 逆行列を使って座標を変換

  console.log('[座標変換] World:', worldX, worldY, '→ Local:', localPos[0], localPos[1]);

  return { x: localPos[0], y: localPos[1] };
}