import { mat4 } from 'gl-matrix';

export function createTransform() {
  return mat4.create();
}

export function move(matrix, dx, dy) {
  mat4.translate(matrix, matrix, [dx, dy, 0]);
}

export function rotate(matrix, angleRad) {
  mat4.rotateZ(matrix, matrix, angleRad);
}

export function scale(matrix, sx, sy) {
  mat4.scale(matrix, matrix, [sx, sy, 1]);
}

export function interpolate(out, from, to, t) {
  for (let i = 0; i < 16; i++) {
    out[i] = from[i] * (1 - t) + to[i] * t;
  }
}