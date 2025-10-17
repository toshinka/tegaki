/**
 * StrokeRecorder v2.0 - Simplify.js統合版
 * 変更点:
 * - finalizePath()でSimplify.js座標最適化を実行
 * - simplifyTolerance設定の管理
 * - 最適化前後のポイント数比較機能
 * - メモリ効率の大幅向上
 */

class StrokeRecorder {
  constructor() {
    this.pathIdCounter = 0;
    
    // Simplify.js設定
    this.simplifyTolerance = 1.0;      // 許容誤差（1.0 = デフォルト）
    this.simplifyHighQuality = true;   // 高品質モード
    this.enableSimplify = true;        // Simplify有効化フラグ
    
    // 🆕 Phase 4: 高密度サンプリング設定
    this.minDistance = 0.5;            // 最小記録距離（1.0→0.5に低減）
    this.maxPoints = 10000;            // ポイント数上限
    this.enableDynamicThreshold = true; // ズーム対応動的閾値
  }

  /**
   * 🆕 Simplify設定の更新
   * @param {number} tolerance - 許容誤差 (0.1～5.0)
   * @param {boolean} highQuality - 高品質モード
   */
  setSimplifySettings(tolerance, highQuality = true) {
    this.simplifyTolerance = Math.max(0.1, Math.min(5.0, tolerance));
    this.simplifyHighQuality = highQuality;
  }

  /**
   * 🆕 Simplify有効/無効切替
   * @param {boolean} enabled
   */
  setSimplifyEnabled(enabled) {
    this.enableSimplify = enabled;
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
      originalSize: size,
      scaleAtDrawTime: 1.0,
      // 🆕 最適化統計
      pointsBeforeSimplify: 0,
      pointsAfterSimplify: 0,
      simplifyReduction: 0
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
   * パス完了処理（Simplify.js統合）
   * @param {Object} pathData
   */
  finalizePath(pathData) {
    if (!pathData) return;
    
    // 最適化前のポイント数を記録
    pathData.pointsBeforeSimplify = pathData.points.length;
    
    // Simplify.js が利用可能かつ有効な場合、座標最適化を実行
    if (this.enableSimplify && typeof simplify !== 'undefined' && pathData.points.length > 2) {
      try {
        // Simplify.js用の座標形式に変換 [{ x, y, pressure }] → [{ x, y }]
        const pointsForSimplify = pathData.points.map(p => ({ x: p.x, y: p.y }));
        
        // Simplify実行
        const simplified = simplify(pointsForSimplify, this.simplifyTolerance, this.simplifyHighQuality);
        
        // 筆圧情報を補間しながら結果を再構築
        const simplifiedWithPressure = this.interpolatePressure(pathData.points, simplified);
        
        // 最適化後のポイントで置き換え
        pathData.points = simplifiedWithPressure;
        pathData.pointsAfterSimplify = simplifiedWithPressure.length;
        
        // 削減率を計算（パーセント）
        if (pathData.pointsBeforeSimplify > 0) {
          pathData.simplifyReduction = 
            ((pathData.pointsBeforeSimplify - pathData.pointsAfterSimplify) / pathData.pointsBeforeSimplify * 100).toFixed(1);
        }
        
      } catch (error) {
        // Simplifyエラー時は元のポイントをそのまま使用
        pathData.pointsAfterSimplify = pathData.points.length;
        pathData.simplifyReduction = 0;
      }
    } else {
      // Simplify無効時
      pathData.pointsAfterSimplify = pathData.points.length;
      pathData.simplifyReduction = 0;
    }
    
    pathData.isComplete = true;
  }

  /**
   * 🆕 Simplify後の座標に筆圧を補間
   * @param {Array} originalPoints - 元の座標（筆圧付き）
   * @param {Array} simplifiedPoints - 最適化後の座標（筆圧なし）
   * @returns {Array} 筆圧補間済み座標
   */
  interpolatePressure(originalPoints, simplifiedPoints) {
    if (!simplifiedPoints || simplifiedPoints.length === 0) {
      return originalPoints;
    }
    
    const result = [];
    
    for (const simplePoint of simplifiedPoints) {
      // 最も近い元の座標を探す
      let nearestPoint = originalPoints[0];
      let minDistance = this.getDistance(simplePoint, originalPoints[0]);
      
      for (const origPoint of originalPoints) {
        const dist = this.getDistance(simplePoint, origPoint);
        if (dist < minDistance) {
          minDistance = dist;
          nearestPoint = origPoint;
        }
      }
      
      // 筆圧情報をコピー
      result.push({
        x: simplePoint.x,
        y: simplePoint.y,
        pressure: nearestPoint.pressure || 0.5
      });
    }
    
    return result;
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
      graphics: null,
      // 🆕 最適化統計もコピー
      pointsBeforeSimplify: pathData.pointsBeforeSimplify || 0,
      pointsAfterSimplify: pathData.pointsAfterSimplify || 0,
      simplifyReduction: pathData.simplifyReduction || 0
    };
  }

  /**
   * 🆕 デバッグ情報取得
   */
  getDebugInfo() {
    return {
      simplifyEnabled: this.enableSimplify,
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