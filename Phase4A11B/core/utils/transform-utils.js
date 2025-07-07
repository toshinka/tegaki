/**
 * ===================================================================================
 * Toshinka Tegaki Tool - Transform Utilities
 * Version: 1.1.0 (Phase 4A11B-3 Y-Axis Fix)
 *
 * - 変更点 (Phase 4A11B-3):
 * - 📜 Phase4A11B-3 指示書に基づき、Y軸のズレ問題を最終的に修正。
 * - 1. Y軸反転処理の完全な削除:
 * - `transformWorldToLocal` 関数から、いかなるY軸反転ロジックも削除。 
 * WebGL側の `projectionMatrix` で座標系が統一されたため、このレイヤーでの反転は不要かつ有害。
 * - 2. ロジックの集約:
 * - core-engine.js内にあった同名関数をこちらに集約し、唯一の信頼できる変換ソースとした。
 * ===================================================================================
 */

// gl-matrixライブラリがグローバルスコープ (window.glMatrix) に読み込まれていることを前提とします。
const mat4 = window.glMatrix.mat4;
const vec4 = window.glMatrix.vec4;

/**
 * 行列が有効か（壊れていないか）をチェックする関数
 * @param {mat4} m - チェック対象の行列
 * @returns {boolean}
 */
export function isValidMatrix(m) {
  return m && m.length === 16 && Array.from(m).every(Number.isFinite);
}

/**
 * ワールド座標（画面上の座標）をレイヤーのローカル座標に変換する
 * @param {number} worldX - ワールドX座標
 * @param {number} worldY - ワールドY座標
 * @param {mat4} modelMatrix - レイヤーのモデル行列
 * @returns {{x: number, y: number}} ローカル座標
 */
export function transformWorldToLocal(worldX, worldY, modelMatrix) {
  // ✅ 指示書Step3 に基づく安全な実装 
  const invMatrix = mat4.create();
  // 行列の反転が失敗した場合は、警告を出して変換前の座標を返すフォールバック
  if (!mat4.invert(invMatrix, modelMatrix)) {
    console.warn("⚠️ transformWorldToLocal: Matrix inversion failed. Using world coordinates as fallback.");
    return { x: worldX, y: worldY };
  }

  const worldPos = vec4.fromValues(worldX, worldY, 0, 1);
  const localPos = vec4.create();

  vec4.transformMat4(localPos, worldPos, invMatrix); // 逆行列を使って座標を変換

  // ✅ 指示書Step3 に基づき、Y座標を反転せずにそのまま返す 
  return { x: localPos[0], y: localPos[1] };
}