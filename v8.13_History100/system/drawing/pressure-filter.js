/**
 * PressureFilter v1.0 - Phase 4: 距離ベース適応フィルタ
 * 
 * 目的:
 * - 短距離（< 5px）: 筆圧変化を即時反映（極小点保護）
 * - 長距離（> 20px）: 低パスフィルタで安定化
 * - 中間距離: 線形補間
 * 
 * 実装仕様:
 * - フィルタ係数αを距離に応じて動的調整
 * - 出力 = prevPressure * (1-α) + currentPressure * α
 * - ストローク毎にリセット
 */

class PressureFilter {
  constructor() {
    // フィルタ係数の範囲設定
    this.minAlpha = 0.3;  // 長距離時（低パスフィルタ）
    this.maxAlpha = 0.9;  // 短距離時（即時反映）
    
    // 距離閾値
    this.shortDistanceThreshold = 5.0;  // 5px未満：即時反映
    this.longDistanceThreshold = 20.0;  // 20px超：低パスフィルタ
    
    // 前回の圧力値
    this.prevPressure = 0.5;
    
    // デバッグ用統計
    this.totalApplications = 0;
    this.avgAlpha = 0.0;
  }

  /**
   * 距離ベース適応フィルタ適用
   * @param {number} currentPressure - 現在の筆圧（0.0-1.0）
   * @param {number} prevPressure - 前回の筆圧（0.0-1.0）
   * @param {number} distance - 前サンプルとの2D距離（px）
   * @returns {number} フィルタ適用後の筆圧
   */
  apply(currentPressure, prevPressure, distance) {
    // フィルタ係数αを距離に応じて計算
    const alpha = this.getAlpha(distance);
    
    // 低パスフィルタ適用
    const filtered = prevPressure * (1 - alpha) + currentPressure * alpha;
    
    // 統計更新
    this.totalApplications++;
    this.avgAlpha = (this.avgAlpha * (this.totalApplications - 1) + alpha) / this.totalApplications;
    
    // 前回値を更新
    this.prevPressure = filtered;
    
    return Math.max(0.0, Math.min(1.0, filtered));
  }

  /**
   * 距離に応じたフィルタ係数αを計算
   * @param {number} distance - 2D距離（px）
   * @returns {number} α (0.0-1.0)
   */
  getAlpha(distance) {
    if (distance < this.shortDistanceThreshold) {
      // 短距離: 即時反映（α = maxAlpha = 0.9）
      return this.maxAlpha;
    } else if (distance > this.longDistanceThreshold) {
      // 長距離: 低パスフィルタ（α = minAlpha = 0.3）
      return this.minAlpha;
    } else {
      // 中間距離: 線形補間
      const t = (distance - this.shortDistanceThreshold) / 
                (this.longDistanceThreshold - this.shortDistanceThreshold);
      return this.maxAlpha - t * (this.maxAlpha - this.minAlpha);
    }
  }

  /**
   * フィルタ係数範囲を設定
   * @param {number} minAlpha - 最小係数（長距離時）
   * @param {number} maxAlpha - 最大係数（短距離時）
   */
  setAlphaRange(minAlpha, maxAlpha) {
    this.minAlpha = Math.max(0.1, Math.min(0.9, minAlpha));
    this.maxAlpha = Math.max(0.1, Math.min(1.0, maxAlpha));
    
    // minAlpha < maxAlphaを保証
    if (this.minAlpha >= this.maxAlpha) {
      this.minAlpha = this.maxAlpha - 0.1;
    }
  }

  /**
   * 距離閾値を設定
   * @param {number} shortThreshold - 短距離閾値（px）
   * @param {number} longThreshold - 長距離閾値（px）
   */
  setDistanceThresholds(shortThreshold, longThreshold) {
    this.shortDistanceThreshold = Math.max(0.5, shortThreshold);
    this.longDistanceThreshold = Math.max(this.shortDistanceThreshold + 1, longThreshold);
  }

  /**
   * ストローク開始時のリセット
   * @param {number} initialPressure - 初期筆圧（デフォルト0.5）
   */
  reset(initialPressure = 0.5) {
    this.prevPressure = initialPressure;
    this.totalApplications = 0;
    this.avgAlpha = 0.0;
  }

  /**
   * デバッグ情報取得
   */
  getDebugInfo() {
    return {
      minAlpha: this.minAlpha,
      maxAlpha: this.maxAlpha,
      shortDistanceThreshold: this.shortDistanceThreshold,
      longDistanceThreshold: this.longDistanceThreshold,
      prevPressure: this.prevPressure,
      totalApplications: this.totalApplications,
      avgAlpha: this.avgAlpha.toFixed(3)
    };
  }
}

// グローバル登録
if (typeof window.TegakiDrawing === 'undefined') {
  window.TegakiDrawing = {};
}
window.TegakiDrawing.PressureFilter = PressureFilter;