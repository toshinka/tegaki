// core/utils/transform-utils.js

// HTMLでgl-matrix-min.jsがグローバルに読み込まれている前提
const { mat4, vec2, vec4 } = glMatrix;

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
 * 行列を別の行列にコピーします。
 * @param {mat4} out - 結果を格納する行列
 * @param {mat4} a - コピー元の行列
 * @returns {mat4} コピーされた行列
 */
export function copy(out, a) {
  return mat4.copy(out, a);
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
 * 行列の逆行列を計算します。
 * @param {mat4} out - 結果を格納する行列
 * @param {mat4} a - 逆行列を計算する元の行列
 * @returns {mat4} 逆行列
 */
export function invert(out, a) {
    return mat4.invert(out, a);
}

/**
 * 2Dベクトルに行列を適用して変換します。
 * @param {vec2} out - 結果を格納するベクトル
 * @param {vec2} v - 変換するベクトル
 * @param {mat4} m - 適用する行列
 * @returns {vec2} 変換後のベクトル
 */
export function transformVec2(out, v, m) {
    // vec2.transformMat4 は gl-matrix v2.x 系では直接存在しないため、
    // vec4に変換してtransformし、その後wで除算してvec2に戻す
    const x = v[0], y = v[1];
    const w = m[3] * x + m[7] * y + m[11] * 0 + m[15] || 1.0; // Z成分は0と仮定
    out[0] = (m[0] * x + m[4] * y + m[8] * 0 + m[12]) / w;
    out[1] = (m[1] * x + m[5] * y + m[9] * 0 + m[13]) / w;
    return out;
}


/**
 * modelMatrixから平行移動量を取得します。
 * @param {mat4} matrix - 対象の行列
 * @returns {{x: number, y: number}} 平行移動量
 */
export function getTranslation(matrix) {
    return { x: matrix[12], y: matrix[13] };
}

/**
 * modelMatrixの平行移動量を直接設定します。
 * この関数は既存の回転やスケールを保持します。
 * @param {mat4} matrix - 対象の行列
 * @param {number} x - 新しいX座標
 * @param {number} y - 新しいY座標
 */
export function setTranslation(matrix, x, y) {
    // 既存の行列の回転・スケール成分を保持しつつ、平行移動成分だけを変更
    matrix[12] = x;
    matrix[13] = y;
}

/**
 * 角度をラジアンに変換します。
 * @param {number} degrees - 角度
 * @returns {number} ラジアン
 */
export function degToRad(degrees) {
    return degrees * Math.PI / 180;
}

/**
 * ラジアンを角度に変換します。
 * @param {number} radians - ラジアン
 * @returns {number} 角度
 */
export function radToDeg(radians) {
    return radians * 180 / Math.PI;
}