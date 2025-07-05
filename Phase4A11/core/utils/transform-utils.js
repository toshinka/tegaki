// core/utils/transform-utils.js

// HTMLでgl-matrix-min.jsがグローバルに読み込まれている前提
const { mat4 } = glMatrix;

/**
 * 単位行列（初期状態）を生成します。
 * @returns {mat4} 新しい単位行列
 */
export function create() {
  return mat4.create();
}

/**
 * 行列をリセット（単位行列に戻す）します。
 * @param {mat4} matrix - リセットする行列
 */
export function reset(matrix) {
  mat4.identity(matrix);
}

/**
 * 平行移動を適用します。
 * @param {mat4} matrix - 適用先の行列
 * @param {number} dx - X軸の移動量
 * @param {number} dy - Y軸の移動量
 */
export function translate(matrix, dx, dy) {
  mat4.translate(matrix, matrix, [dx, dy, 0]);
}

/**
 * 回転を適用（ラジアン）します。
 * @param {mat4} matrix - 適用先の行列
 * @param {number} angleRad - 回転量（ラジアン）
 */
export function rotate(matrix, angleRad) {
  mat4.rotateZ(matrix, matrix, angleRad);
}

/**
 * 拡大縮小を適用します。
 * @param {mat4} matrix - 適用先の行列
 * @param {number} sx - X軸の拡大率
 * @param {number} sy - Y軸の拡大率
 */
export function scale(matrix, sx, sy) {
  mat4.scale(matrix, matrix, [sx, sy, 1]);
}

/**
 * modelMatrixから平行移動量を取得します。
 * @param {mat4} matrix - 対象の行列
 * @returns {{x: number, y: number}} 平行移動量
 */
export function getTranslation(matrix) {
    return { x: matrix[12], y: matrix[13] };
}