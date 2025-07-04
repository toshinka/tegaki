// core/utils/transform-utils.js
import { mat4 } from 'gl-matrix';

/**
 * 単位行列（初期状態）を生成
 */
export function create() {
  return mat4.create();
}

/**
 * 行列をリセット（単位行列に戻す）
 */
export function reset(matrix) {
  mat4.identity(matrix);
}

/**
 * 平行移動を適用
 */
export function translate(matrix, dx, dy) {
  mat4.translate(matrix, matrix, [dx, dy, 0]);
}

/**
 * 回転を適用（ラジアン）
 */
export function rotate(matrix, angleRad) {
  mat4.rotateZ(matrix, matrix, angleRad);
}

/**
 * 拡大縮小を適用
 */
export function scale(matrix, sx, sy) {
  mat4.scale(matrix, matrix, [sx, sy, 1]);
}

/**
 * 行列のコピー
 */
export function clone(matrix) {
  return mat4.clone(matrix);
}

/**
 * 線形補間（アニメーション用）
 */
export function interpolate(out, from, to, t) {
  for (let i = 0; i < 16; i++) {
    out[i] = from[i] * (1 - t) + to[i] * t;
  }
}

/**
 * 逆行列を計算（マウス座標→ローカル座標変換などに使用）
 */
export function invert(out, matrix) {
  return mat4.invert(out, matrix);
}