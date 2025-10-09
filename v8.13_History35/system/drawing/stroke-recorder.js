/**
 * StrokeRecorder v1.0
 * 座標収集・パスデータ管理
 */

class StrokeRecorder {
  constructor() {
    this.pathIdCounter = 0;
  }

  /**
   * 新規パス開始
   * @param {Object} initialPoint - { x, y, pressure }
   * @param {number} color - 色 (0xRRGGBB)
   * @param {number} size - ブラシサイズ
   * @param {number} opacity - 不透明度 (0.0-1.0)
   * @param {string} tool - 'pen' | 'eraser'
   * @param {Object} strokeOptions - Perfect Freehand設定
   * @returns {Object} pathData
   */
  startNewPath(initialPoint, color, size, opacity, tool, strokeOptions) {
    const pathData = {
      id: this.generatePathId(),
      points: [{ ...initialPoint }],
      color: color,
      size: size,
      opacity: opacity,
      tool: tool,
      isComplete: false,
      strokeOptions: { ...strokeOptions },
      graphics: null,
      originalSize: size,        // Phase 2: 元のブラシサイズ
      scaleAtDrawTime: 1.0       // Phase 2: 描画時のズーム率（後で上書き）
    };
    
    return pathData;
  }

  /**
   * ポイント追加
   * @param {Object} pathData
   * @param {Object} point - { x, y, pressure }
   */
  addPoint(pathData, point) {
    if (!pathData || !point) return;
    
    const lastPoint = pathData.points[pathData.points.length - 1];
    const distance = this.getDistance(lastPoint, point);
    
    // 間引き処理: 最小距離未満なら追加しない
    const minDistance = 1.0;
    if (distance < minDistance) {
      return;
    }
    
    pathData.points.push({ ...point });
  }

  /**
   * パス完了処理
   * @param {Object} pathData
   */
  finalizePath(pathData) {
    if (!pathData) return;
    pathData.isComplete = true;
  }

  /**
   * パスID生成
   * @returns {string}
   */
  generatePathId() {
    return `path_${Date.now()}_${this.pathIdCounter++}`;
  }

  /**
   * 2点間の距離計算
   * @param {Object} p1 - { x, y }
   * @param {Object} p2 - { x, y }
   * @returns {number}
   */
  getDistance(p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * パスデータのディープコピー (History用)
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
      graphics: null // Graphicsは再構築する
    };
  }
}

// グローバル登録
if (typeof window.TegakiDrawing === 'undefined') {
  window.TegakiDrawing = {};
}
window.TegakiDrawing.StrokeRecorder = StrokeRecorder;