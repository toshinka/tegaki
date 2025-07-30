import { mat4, vec4 } from 'gl-matrix';

/**
 * 行列が有効か（壊れていないか）をチェックする関数
 * @param {mat4} m - チェック対象の行列
 * @returns {boolean}
 */
export function isValidMatrix(m) {
  if (!m || m.length !== 16) return false;
  for (let i = 0; i < 16; i++) {
    if (!Number.isFinite(m[i])) return false;
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
  
  return { x: localPos[0], y: localPos[1] };
}


/**
 * Converts a PointerEvent's client coordinates to canvas-local coordinates.
 * @param {PointerEvent} e The pointer event.
 * @param {HTMLCanvasElement} canvas The canvas element.
 * @param {object} viewTransform The current viewport transform.
 * @returns {{x: number, y: number}}
 */
export function getCanvasCoordinates(e, canvas, viewTransform) {
    const rect = canvas.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    x *= scaleX;
    y *= scaleY;

    if (viewTransform) {
        if (viewTransform.flipX === -1) x = canvas.width - x;
        if (viewTransform.flipY === -1) y = canvas.height - y;
    }
    
    return { x, y };
}

/**
 * Converts a HEX color string to an RGBA object.
 * @param {string} hex The HEX color string (e.g., '#RRGGBB').
 * @returns {{r: number, g: number, b: number, a: number}}
 */
export function hexToRgba(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16), a: 255 } : { r: 0, g: 0, b: 0, a: 255 };
}