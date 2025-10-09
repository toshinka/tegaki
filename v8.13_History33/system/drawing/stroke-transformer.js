/**
 * stroke-transformer.js
 * レイヤー変形対応
 * Version: 1.0.0
 * 
 * 【責務】
 * - レイヤー変形時のストローク座標変換
 * - PIXI.Matrixを使った座標変換
 * - 変形の適用判定
 */

(function(global) {
  'use strict';

  class StrokeTransformer {
    constructor(config = {}) {
      this.config = config;
    }

    /**
     * レイヤー変形をパスに適用
     * @param {Object} pathData - ストロークデータ
     * @param {Object} transform - レイヤー変形データ
     * @param {number} canvasWidth
     * @param {number} canvasHeight
     * @returns {PIXI.Graphics} 変形後のGraphics
     */
    applyTransformToPath(pathData, transform, canvasWidth, canvasHeight) {
      if (!this.isTransformNonDefault(transform)) {
        // 変形なし：そのまま再構築
        return this._rebuildGraphics(pathData);
      }

      // 変形行列生成
      const matrix = this.createTransformMatrix(transform, canvasWidth, canvasHeight);
      
      // 逆行列で座標変換
      const invMatrix = matrix.clone().invert();
      
      // 変形後の座標配列生成
      const transformedPoints = pathData.points.map(p => {
        const point = new PIXI.Point(p.x, p.y);
        const transformed = invMatrix.apply(point);
        return {
          x: transformed.x,
          y: transformed.y,
          pressure: p.pressure
        };
      });

      // 変形後のパスデータ生成
      const transformedPath = {
        ...pathData,
        points: transformedPoints
      };

      return this._rebuildGraphics(transformedPath);
    }

    /**
     * 変形が初期値かチェック
     */
    isTransformNonDefault(transform) {
      if (!transform) return false;
      return transform.x !== 0 || transform.y !== 0 ||
             transform.rotation !== 0 || transform.scale !== 1.0 ||
             transform.flipH !== false || transform.flipV !== false;
    }

    /**
     * 変形用のMatrix生成
     */
    createTransformMatrix(transform, canvasWidth, canvasHeight) {
      const matrix = new PIXI.Matrix();
      const centerX = canvasWidth / 2;
      const centerY = canvasHeight / 2;

      // 中心を原点に移動
      matrix.translate(-centerX, -centerY);

      // スケール・反転
      const scaleX = transform.scale * (transform.flipH ? -1 : 1);
      const scaleY = transform.scale * (transform.flipV ? -1 : 1);
      matrix.scale(scaleX, scaleY);

      // 回転
      matrix.rotate(transform.rotation);

      // 移動
      matrix.translate(centerX + transform.x, centerY + transform.y);

      return matrix;
    }

    /**
     * Graphicsを再構築（内部処理）
     */
    _rebuildGraphics(pathData) {
      if (!global.TegakiDrawing || !global.TegakiDrawing.StrokeRenderer) {
        return new PIXI.Graphics();
      }

      const renderer = new global.TegakiDrawing.StrokeRenderer();
      return renderer.rebuildPathGraphics(pathData);
    }
  }

  // グローバル登録
  if (!global.TegakiDrawing) {
    global.TegakiDrawing = {};
  }
  global.TegakiDrawing.StrokeTransformer = StrokeTransformer;

})(window);