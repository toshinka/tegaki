/**
 * stroke-recorder.js
 * ストローク座標収集・パスデータ管理
 * Version: 1.0.0
 * 
 * 【責務】
 * - 描画中の座標収集
 * - パスデータ構造の生成・管理
 * - 距離判定（間引き処理）
 * - パスIDの生成
 */

(function(global) {
  'use strict';

  class StrokeRecorder {
    constructor() {
      this.pathIdCounter = 0;
      this.minDistance = 1.0; // 間引き閾値（ピクセル）
    }

    /**
     * 新規パス開始
     * @param {Object} initialPoint - { x, y, pressure }
     * @param {number} color - 色（PIXI形式）
     * @param {number} size - ブラシサイズ
     * @param {number} opacity - 不透明度
     * @param {string} tool - ツール種別（'pen' | 'eraser'）
     * @param {Object} strokeOptions - Perfect Freehandオプション
     * @returns {Object} pathData
     */
    startNewPath(initialPoint, color, size, opacity, tool, strokeOptions) {
      const pathData = {
        id: this.generatePathId(),
        points: [{ ...initialPoint }],
        color: color,
        size: size,
        opacity: opacity,
        tool: tool || 'pen',
        isComplete: false,
        strokeOptions: { ...strokeOptions },
        originalSize: size,
        scaleAtDrawTime: 1.0
      };

      return pathData;
    }

    /**
     * ポイント追加（距離判定あり）
     * @param {Object} pathData - パスデータ
     * @param {Object} point - { x, y, pressure }
     */
    addPoint(pathData, point) {
      if (!pathData || !pathData.points) return;

      const lastPoint = pathData.points[pathData.points.length - 1];
      
      // 距離判定
      if (this._calculateDistance(lastPoint, point) >= this.minDistance) {
        pathData.points.push({ ...point });
      }
    }

    /**
     * パス完了処理
     * @param {Object} pathData
     */
    finalizePath(pathData) {
      if (pathData) {
        pathData.isComplete = true;
      }
    }

    /**
     * ユニークなパスID生成
     */
    generatePathId() {
      return `stroke_${Date.now()}_${this.pathIdCounter++}`;
    }

    /**
     * パスデータのディープコピー（History用）
     * @param {Object} pathData
     * @returns {Object}
     */
    clonePathData(pathData) {
      return {
        id: pathData.id,
        points: pathData.points.map(p => ({ ...p })),
        color: pathData.color,
        size: pathData.size,
        opacity: pathData.opacity,
        tool: pathData.tool,
        isComplete: pathData.isComplete,
        strokeOptions: { ...pathData.strokeOptions },
        originalSize: pathData.originalSize,
        scaleAtDrawTime: pathData.scaleAtDrawTime
      };
    }

    /**
     * 2点間の距離計算
     */
    _calculateDistance(p1, p2) {
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      return Math.sqrt(dx * dx + dy * dy);
    }
  }

  // グローバル登録
  if (!global.TegakiDrawing) {
    global.TegakiDrawing = {};
  }
  global.TegakiDrawing.StrokeRecorder = StrokeRecorder;

})(window);