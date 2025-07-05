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
 * 行列のコピーを作成します。
 * @param {mat4} matrix - コピー元の行列
 * @returns {mat4} コピーされた新しい行列
 */
export function clone(matrix) {
  return mat4.clone(matrix);
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
 * 2Dベクトルに行列を適用して変換します。
 * @param {vec2} out - 結果を格納するベクトル
 * @param {vec2} v - 変換するベクトル
 * @param {mat4} m - 適用する行列
 * @returns {vec2} 変換後のベクトル
 */
export function transformVec2(out, v, m) {
    const x = v[0], y = v[1];
    const w = m[3] * x + m[7] * y + m[15] || 1.0;
    out[0] = (m[0] * x + m[4] * y + m[12]) / w;
    out[1] = (m[1] * x + m[5] * y + m[13]) / w;
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
    matrix[12] = x;
    matrix[13] = y;
}

/**
 * 指定した位置から始まるように行列を再設定します。
 * @param {mat4} matrix - 操作対象の行列
 * @param {number} x - X座標
 * @param {number} y - Y座標
 */
export function resetToTranslation(matrix, x, y) {
    mat4.fromTranslation(matrix, [x, y, 0]);
}

// ==================================================================
// ▼▼▼ Phase4A9で追加 ▼▼▼
// ==================================================================

/**
 * ワールド座標（描画領域全体の座標）を、特定の行列（レイヤー）のローカル座標に変換します。
 * ペン描画位置をレイヤーの移動や回転に追従させるために使用します。
 * @param {number} worldX - ワールド座標X
 * @param {number} worldY - ワールド座標Y
 * @param {mat4} modelMatrix - 変換元となるレイヤーのモデル行列
 * @returns {vec2 | null} ローカル座標[x, y]、または変換失敗時にnull
 */
export function transformWorldToLocal(worldX, worldY, modelMatrix) {
    const invMatrix = mat4.create();
    if (!mat4.invert(invMatrix, modelMatrix)) {
        // 逆行列が計算できない場合（スケールが0など）、変換は不可能
        return null;
    }
    const worldPos = [worldX, worldY, 0, 1];
    const localPos = vec4.create();
    vec4.transformMat4(localPos, worldPos, invMatrix);
    return [localPos[0], localPos[1]];
}