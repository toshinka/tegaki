/**
 * StrokeRecorder v3.0 - Phase 3: 短距離クリック（単独点）対応
 * 変更点:
 * - pointerup時のクリック判定ロジック追加
 * - 単独点フラグ管理（isSinglePoint）
 * - 距離計算を活用した短距離判定
 */

class StrokeRecorder {
  constructor() {
    this.pathIdCounter = 0;
    
    // Simplify.js設定
    this.simplifyTolerance = 1.0;
    this.simplifyHighQuality = true;
    this.enableSimplify = true;
    
    // Phase 4: 高密度サンプリング設定
    this.minDistance = 0.5;
    this.maxPoints = 10000;
    this.enableDynamicThreshold = true;
    
    // 🆕 Phase 3: クリック判定設定
    this.clickDistanceThreshold = 2.0; // 2px未満なら単独点
    this.clickSampleThreshold = 2;     // サンプル数2以下なら単独点
  }

  setSimplifySettings(tolerance, highQuality = true) {
    this.simplifyTolerance = Math.max(0.1, Math.min(5.0, tolerance));
    this.simplifyHighQuality = highQuality;
  }

  setSimplifyEnabled(enabled) {
    this.enableSimplify = enabled;
  }

  /**
   * 🆕 Phase 3: クリック判定設定の更新
   * @param {number} distanceThreshold - 距離閾値（px）
   * @param {number} sampleThreshold - サンプル数閾値
   */
  setClickThresholds(distanceThreshold, sampleThreshold) {
    this.clickDistanceThreshold = Math.max(0.5, distanceThreshold);
    this.clickSampleThreshold = Math.max(1, sampleThreshold);
  }

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
      pointsBeforeSimplify: 0,
      pointsAfterSimplify: 0,
      simplifyReduction: 0,
      // 🆕 Phase 3: 単独点フラグ
      isSinglePoint: false,
      totalDistance: 0
    };
    
    return pathData;
  }

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
    
    // 🆕 Phase 3: 総移動距離を記録
    pathData.totalDistance = (pathData.totalDistance || 0) + distance;
  }

  /**
   * 🔥 Phase 3: パス完了処理（クリック判定統合）
   * @param {Object} pathData
   */
  finalizePath(pathData) {
    if (!pathData) return;
    
    // 🆕 Phase 3: クリック判定
    const isClick = this.detectSinglePoint(pathData);
    pathData.isSinglePoint = isClick;
    
    // 単独点の場合はSimplifyをスキップ
    if (isClick) {
      pathData.pointsBeforeSimplify = pathData.points.length;
      pathData.pointsAfterSimplify = pathData.points.length;
      pathData.simplifyReduction = 0;
      pathData.isComplete = true;
      return;
    }
    
    // 通常のストローク処理
    pathData.pointsBeforeSimplify = pathData.points.length;
    
    if (this.enableSimplify && typeof simplify !== 'undefined' && pathData.points.length > 2) {
      try {
        const pointsForSimplify = pathData.points.map(p => ({ x: p.x, y: p.y }));
        const simplified = simplify(pointsForSimplify, this.simplifyTolerance, this.simplifyHighQuality);
        const simplifiedWithPressure = this.interpolatePressure(pathData.points, simplified);
        
        pathData.points = simplifiedWithPressure;
        pathData.pointsAfterSimplify = simplifiedWithPressure.length;
        
        if (pathData.pointsBeforeSimplify > 0) {
          pathData.simplifyReduction = 
            ((pathData.pointsBeforeSimplify - pathData.pointsAfterSimplify) / pathData.pointsBeforeSimplify * 100).toFixed(1);
        }
        
      } catch (error) {
        pathData.pointsAfterSimplify = pathData.points.length;
        pathData.simplifyReduction = 0;
      }
    } else {
      pathData.pointsAfterSimplify = pathData.points.length;
      pathData.simplifyReduction = 0;
    }
    
    pathData.isComplete = true;
  }

  /**
   * 🆕 Phase 3: 単独点判定ロジック
   * @param {Object} pathData
   * @returns {boolean} true = 単独点（クリック）, false = 通常ストローク
   */
  detectSinglePoint(pathData) {
    if (!pathData || !pathData.points || pathData.points.length === 0) {
      return false;
    }
    
    // 条件1: サンプル数が閾値以下
    const sampleCheck = pathData.points.length <= this.clickSampleThreshold;
    
    // 条件2: 総移動距離が閾値未満
    const distanceCheck = (pathData.totalDistance || 0) < this.clickDistanceThreshold;
    
    // 両方満たす場合のみ単独点と判定
    return sampleCheck && distanceCheck;
  }

  interpolatePressure(originalPoints, simplifiedPoints) {
    if (!simplifiedPoints || simplifiedPoints.length === 0) {
      return originalPoints;
    }
    
    const result = [];
    
    for (const simplePoint of simplifiedPoints) {
      let nearestPoint = originalPoints[0];
      let minDistance = this.getDistance(simplePoint, originalPoints[0]);
      
      for (const origPoint of originalPoints) {
        const dist = this.getDistance(simplePoint, origPoint);
        if (dist < minDistance) {
          minDistance = dist;
          nearestPoint = origPoint;
        }
      }
      
      result.push({
        x: simplePoint.x,
        y: simplePoint.y,
        pressure: nearestPoint.pressure || 0.5
      });
    }
    
    return result;
  }

  generatePathId() {
    return `path_${Date.now()}_${this.pathIdCounter++}`;
  }

  getDistance(p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

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
      pointsBeforeSimplify: pathData.pointsBeforeSimplify || 0,
      pointsAfterSimplify: pathData.pointsAfterSimplify || 0,
      simplifyReduction: pathData.simplifyReduction || 0,
      // 🆕 Phase 3: 単独点情報もコピー
      isSinglePoint: pathData.isSinglePoint || false,
      totalDistance: pathData.totalDistance || 0
    };
  }

  getDebugInfo() {
    return {
      simplifyEnabled: this.enableSimplify,
      tolerance: this.simplifyTolerance,
      highQuality: this.simplifyHighQuality,
      // 🆕 Phase 3: クリック判定設定
      clickDistanceThreshold: this.clickDistanceThreshold,
      clickSampleThreshold: this.clickSampleThreshold
    };
  }
}

// グローバル登録
if (typeof window.TegakiDrawing === 'undefined') {
  window.TegakiDrawing = {};
}
window.TegakiDrawing.StrokeRecorder = StrokeRecorder;