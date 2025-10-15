/**
 * StrokeRecorder v2.0 - Simplify.js統合版
 * 🔥 新機能:
 * - ストローク座標の自動最適化
 * - 拡張ポインター情報の記録（tilt, twist）
 * - データサイズ削減
 */

class StrokeRecorder {
  constructor(config) {
    this.config = config || {};
    this.simplifyTolerance = config?.simplify?.tolerance || 1.0; // 最適化の強度
    this.simplifyHighQuality = config?.simplify?.highQuality !== false; // デフォルトtrue
  }

  /**
   * 新規パス開始
   * @param {Object} startPoint - { x, y, pressure }
   * @param {number} color
   * @param {number} size
   * @param {number} opacity
   * @param {string} tool
   * @param {Object} strokeOptions - Perfect Freehand設定
   * @returns {Object}
   */
  startNewPath(startPoint, color, size, opacity, tool, strokeOptions) {
    return {
      points: [{ ...startPoint }],
      color,
      size,
      opacity,
      tool,
      strokeOptions: { ...strokeOptions },
      graphics: null,
      isFinalized: false,
      // 🔥 Phase 1: 拡張情報
      extendedData: {
        hasTilt: false,
        hasTwist: false,
        originalPointCount: 0,
        simplifiedPointCount: 0,
        compressionRatio: 1.0
      }
    };
  }

  /**
   * 座標追加
   * @param {Object} path
   * @param {Object} point - { x, y, pressure, tiltX?, tiltY?, twist? }
   */
  addPoint(path, point) {
    if (!path || path.isFinalized) return;

    // 🔥 Phase 1: 拡張情報の記録
    const extendedPoint = { ...point };
    
    // 傾き情報がある場合
    if (point.tiltX !== undefined || point.tiltY !== undefined) {
      path.extendedData.hasTilt = true;
    }
    
    // 回転情報がある場合
    if (point.twist !== undefined) {
      path.extendedData.hasTwist = true;
    }

    path.points.push(extendedPoint);
  }

  /**
   * 🔥 Phase 1 新機能: Simplify.jsでストローク最適化
   * @param {Array} points
   * @param {number} tolerance
   * @param {boolean} highQuality
   * @returns {Array}
   */
  simplifyPoints(points, tolerance, highQuality) {
    if (!points || points.length < 3) return points;

    // Simplify.jsが利用可能かチェック
    if (typeof simplify === 'undefined') {
      console.warn('Simplify.js not loaded, skipping optimization');
      return points;
    }

    try {
      // Simplify.js用の形式に変換 [{x, y}, ...]
      const simplePoints = points.map(p => ({ x: p.x, y: p.y }));
      
      // 最適化実行
      const simplified = simplify(simplePoints, tolerance, highQuality);
      
      // 拡張情報（pressure, tilt等）を補間して復元
      return this._interpolateExtendedData(points, simplified);
      
    } catch (error) {
      console.warn('Simplify.js error:', error);
      return points;
    }
  }

  /**
   * 🔥 Phase 1: 最適化後の拡張データ補間
   * @private
   * @param {Array} original - 元の座標配列
   * @param {Array} simplified - 最適化後の座標配列
   * @returns {Array}
   */
  _interpolateExtendedData(original, simplified) {
    if (!simplified || simplified.length === 0) return original;

    const result = [];

    for (let i = 0; i < simplified.length; i++) {
      const target = simplified[i];
      
      // 元の配列から最も近い点を探す
      let closestIndex = 0;
      let minDist = Infinity;
      
      for (let j = 0; j < original.length; j++) {
        const dx = original[j].x - target.x;
        const dy = original[j].y - target.y;
        const dist = dx * dx + dy * dy;
        
        if (dist < minDist) {
          minDist = dist;
          closestIndex = j;
        }
      }

      // 拡張情報をコピー
      const extendedPoint = {
        x: target.x,
        y: target.y,
        pressure: original[closestIndex].pressure || 0.5
      };

      // tilt情報があればコピー
      if (original[closestIndex].tiltX !== undefined) {
        extendedPoint.tiltX = original[closestIndex].tiltX;
        extendedPoint.tiltY = original[closestIndex].tiltY;
      }

      // twist情報があればコピー
      if (original[closestIndex].twist !== undefined) {
        extendedPoint.twist = original[closestIndex].twist;
      }

      result.push(extendedPoint);
    }

    return result;
  }

  /**
   * パス確定（最適化含む）
   * @param {Object} path
   */
  finalizePath(path) {
    if (!path || path.isFinalized) return;

    // 🔥 Phase 1: 元の座標数を記録
    path.extendedData.originalPointCount = path.points.length;

    // 🔥 Phase 1: ストローク最適化
    if (path.points.length >= 3) {
      const optimized = this.simplifyPoints(
        path.points,
        this.simplifyTolerance,
        this.simplifyHighQuality
      );

      if (optimized && optimized.length > 0) {
        path.points = optimized;
        path.extendedData.simplifiedPointCount = optimized.length;
        path.extendedData.compressionRatio = 
          path.extendedData.simplifiedPointCount / path.extendedData.originalPointCount;

        console.log(
          `📊 Stroke optimized: ${path.extendedData.originalPointCount} → ` +
          `${path.extendedData.simplifiedPointCount} points ` +
          `(${(path.extendedData.compressionRatio * 100).toFixed(1)}%)`
        );
      }
    }

    path.isFinalized = true;
  }

  /**
   * 設定変更
   * @param {Object} options
   */
  setOptions(options) {
    if (options.tolerance !== undefined) {
      this.simplifyTolerance = options.tolerance;
    }
    if (options.highQuality !== undefined) {
      this.simplifyHighQuality = options.highQuality;
    }
  }

  /**
   * 現在の設定取得
   * @returns {Object}
   */
  getOptions() {
    return {
      tolerance: this.simplifyTolerance,
      highQuality: this.simplifyHighQuality
    };
  }
}

// グローバル登録
if (typeof window.TegakiDrawing === 'undefined') {
  window.TegakiDrawing = {};
}
window.TegakiDrawing.StrokeRecorder = StrokeRecorder;

console.log('✅ stroke-recorder.js v2.0 (Simplify.js統合版) loaded');
console.log('   - 🔥 自動ストローク最適化');
console.log('   - 🔥 拡張ポインター情報記録');
console.log('   - 🔥 データサイズ削減');