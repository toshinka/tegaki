/**
 * StrokeRenderer v1.0
 * Perfect Freehand描画実行
 */

class StrokeRenderer {
  constructor(config) {
    this.config = config || {};
  }

  /**
   * Perfect Freehandでストローク描画
   * @param {Array} points - [{ x, y, pressure }]
   * @param {Object} strokeOptions - Perfect Freehand設定
   * @param {PIXI.Graphics} graphics - 描画先
   */
  renderStroke(points, strokeOptions, graphics) {
    if (!points || points.length === 0 || !graphics) return;

    // Perfect Freehand が利用可能かチェック
    if (typeof getStroke === 'undefined') {
      this.renderStrokeWithCircles(points, strokeOptions.size || 8, 0x000000, 1.0, graphics);
      return;
    }

    try {
      // Perfect Freehandでアウトライン生成
      const outlinePoints = getStroke(points, strokeOptions);
      
      if (!outlinePoints || outlinePoints.length === 0) {
        this.renderStrokeWithCircles(points, strokeOptions.size || 8, 0x000000, 1.0, graphics);
        return;
      }

      // PIXI.Graphics描画
      graphics.clear();
      graphics.poly(outlinePoints);
      graphics.fill({ color: strokeOptions.color || 0x000000, alpha: strokeOptions.alpha || 1.0 });
      
    } catch (error) {
      console.warn('Perfect Freehand描画エラー:', error);
      this.renderStrokeWithCircles(points, strokeOptions.size || 8, 0x000000, 1.0, graphics);
    }
  }

  /**
   * フォールバック描画 (円の連続)
   * @param {Array} points
   * @param {number} size
   * @param {number} color
   * @param {number} opacity
   * @param {PIXI.Graphics} graphics
   */
  renderStrokeWithCircles(points, size, color, opacity, graphics) {
    if (!points || points.length === 0 || !graphics) return;

    graphics.clear();
    const radius = size / 2;

    for (const pt of points) {
      graphics.circle(pt.x, pt.y, radius);
      graphics.fill({ color: color, alpha: opacity });
    }
  }

  /**
   * パスデータからGraphicsを再構築 (Undo/Redo用)
   * @param {Object} pathData
   * @returns {PIXI.Graphics}
   */
  rebuildPathGraphics(pathData) {
    const graphics = new PIXI.Graphics();

    if (!pathData || !pathData.points || pathData.points.length === 0) {
      return graphics;
    }

    // strokeOptionsが存在し、Perfect Freehandが使える場合
    if (pathData.strokeOptions && typeof getStroke !== 'undefined') {
      const options = {
        ...pathData.strokeOptions,
        size: pathData.size,
        color: pathData.color,
        alpha: pathData.opacity
      };
      
      this.renderStroke(pathData.points, options, graphics);
    } else {
      // フォールバック
      this.renderStrokeWithCircles(
        pathData.points,
        pathData.size,
        pathData.color,
        pathData.opacity,
        graphics
      );
    }

    return graphics;
  }

  /**
   * ズーム対応の線幅計算 (Phase 2用)
   * @param {number} baseSize - 基本サイズ
   * @param {number} cameraScale - カメラスケール
   * @returns {number}
   */
  getScaledSize(baseSize, cameraScale) {
    if (!cameraScale || cameraScale <= 0) return baseSize;
    return baseSize / cameraScale;
  }
}

// グローバル登録
if (typeof window.TegakiDrawing === 'undefined') {
  window.TegakiDrawing = {};
}
window.TegakiDrawing.StrokeRenderer = StrokeRenderer;