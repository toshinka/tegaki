// core/utils/transform-utils.js

// HTMLでgl-matrix-min.jsがグローバルに読み込まれている前提
const { mat4, vec3, vec4 } = glMatrix;

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
 * 逆行列を計算します。マウス座標からローカル座標への変換などに使用します。
 * @param {mat4} out - 結果を格納する行列
 * @param {mat4} matrix - 逆行列を計算する行列
 * @returns {mat4|null} 逆行列、または計算できなかった場合はnull
 */
export function invert(out, matrix) {
  return mat4.invert(out, matrix);
}

/**
 * ワールド座標（ピクセル単位）を行列の逆変換を適用してローカル座標に変換します。
 * @param {vec2} out - 結果を格納するベクトル
 * @param {vec2} v - 変換するワールド座標ベクトル [x, y]
 * @param {mat4} m - 適用する行列
 * @returns {vec2} 変換後のローカル座標ベクトル
 */
export function transformWorldToLocal(out, v, m) {
    const invM = mat4.create();
    if (!invert(invM, m)) {
        // 逆行列が計算できない場合（スケールが0など）は元の座標を返す
        out[0] = v[0];
        out[1] = v[1];
        return out;
    }

    const inVec = vec4.fromValues(v[0], v[1], 0, 1);
    const outVec = vec4.create();
    vec4.transformMat4(outVec, inVec, invM);

    out[0] = outVec[0];
    out[1] = outVec[1];
    return out;
}

/**
 * modelMatrixから平行移動量を取得します。
 * @param {mat4} matrix - 対象の行列
 * @returns {vec3} 平行移動量 [x, y, z]
 */
export function getTranslation(matrix) {
    const out = vec3.create();
    return mat4.getTranslation(out, matrix);
}

/**
 * modelMatrixの平行移動量を差分で更新します。
 * @param {mat4} matrix - 対象の行列
 * @param {number} newX - 新しい目標X座標
 * @param {number} newY - 新しい目標Y座標
 */
export function updateTranslation(matrix, newX, newY) {
    const currentTranslation = getTranslation(matrix);
    const dx = newX - currentTranslation[0];
    const dy = newY - currentTranslation[1];
    translate(matrix, dx, dy);
}