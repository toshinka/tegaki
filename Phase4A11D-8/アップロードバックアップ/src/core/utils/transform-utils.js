// src/core/utils/transform-utils.js
import { mat4, vec4 } from 'gl-matrix';

/**
 * 行列が有効か（壊れていないか）をチェックする関数
 * @param {mat4} m - チェック対象の行列
 * @returns {boolean}
 */
export function isValidMatrix(m) {
  if (!m || m.length !== 16) {
    return false;
  }
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
  const invMatrix = mat4.create();
  mat4.invert(invMatrix, modelMatrix);

  const worldPos = vec4.fromValues(worldX, worldY, 0, 1);
  const localPos = vec4.create();

  vec4.transformMat4(localPos, worldPos, invMatrix);

  if (window.location.hash === '#debug') {
    console.log('[座標変換] World:', worldX, worldY, '→ Local:', localPos[0], localPos[1]);
  }

  return { x: localPos[0], y: localPos[1] };
}