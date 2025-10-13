/**
 * StrokeTransformer v1.0
 * レイヤー変形対応
 */

class StrokeTransformer {
  constructor(config) {
    this.config = config || {};
  }

  /**
   * レイヤー変形をパスに適用
   * @param {Object} path - パスデータ
   * @param {Object} transform - レイヤー変形 { x, y, rotation, scale }
   * @param {number} canvasWidth
   * @param {number} canvasHeight
   * @returns {PIXI.Graphics}
   */
  applyTransformToPath(path, transform, canvasWidth, canvasHeight) {
    if (!path || !path.graphics) return null;

    // 変形が初期値の場合はそのまま返す
    if (this.isTransformNonDefault(transform)) {
      return path.graphics;
    }

    // 変形行列作成
    const matrix = this.createTransformMatrix(transform, canvasWidth, canvasHeight);

    // 新しいGraphicsを作成して変形適用
    const transformedGraphics = path.graphics.clone();
    transformedGraphics.setFromMatrix(matrix);

    return transformedGraphics;
  }

  /**
   * 変形が初期値かチェック
   * @param {Object} transform
   * @returns {boolean}
   */
  isTransformNonDefault(transform) {
    if (!transform) return true;

    return (
      transform.x === 0 &&
      transform.y === 0 &&
      transform.rotation === 0 &&
      transform.scale === 1
    );
  }

  /**
   * 変形用のMatrix生成
   * @param {Object} transform
   * @param {number} canvasWidth
   * @param {number} canvasHeight
   * @returns {PIXI.Matrix}
   */
  createTransformMatrix(transform, canvasWidth, canvasHeight) {
    const matrix = new PIXI.Matrix();

    // 中心点
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;

    // 変形適用: 平行移動 → 回転 → スケール
    matrix.translate(-centerX, -centerY);
    matrix.rotate(transform.rotation);
    matrix.scale(transform.scale, transform.scale);
    matrix.translate(centerX + transform.x, centerY + transform.y);

    return matrix;
  }
}

// グローバル登録
if (typeof window.TegakiDrawing === 'undefined') {
  window.TegakiDrawing = {};
}
window.TegakiDrawing.StrokeTransformer = StrokeTransformer;