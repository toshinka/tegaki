/**
 * PressureHandler v3.0 - ゼロ荷重対応 + twist検出
 * 変更点:
 * - ゼロ荷重からのリニアな筆圧応答（最小閾値撤廃）
 * - twist（ペン回転角）検出追加
 * - 重み付き移動平均によるスムージング強化
 * - 筆圧履歴サイズ拡大（3→5）
 */

class PressureHandler {
  constructor() {
    this.lastPressure = 0.0; // ゼロ荷重対応: デフォルトを0.5→0.0に変更
    this.pressureHistory = [];
    this.maxHistorySize = 5; // 3→5に拡大（より滑らかに）
    
    // 傾き対応
    this.tiltX = 0;
    this.tiltY = 0;
    
    // 🆕 twist（ペン回転角）対応
    this.twist = 0;
    
    // 筆圧補正係数（DrawingEngineから設定される）
    this.pressureCorrection = 1.0;
    
    // 速度ベースのフォールバック用
    this.lastPoint = null;
    this.lastTimestamp = null;
    this.velocityHistory = [];
    this.maxVelocityHistory = 5;
  }
  
  /**
   * 筆圧補正係数を設定
   * @param {number} value - 0.1～3.0
   */
  setPressureCorrection(value) {
    this.pressureCorrection = Math.max(0.1, Math.min(3.0, value));
  }

  /**
   * PixiJS FederatedPointerEvent から圧力取得
   * @param {FederatedPointerEvent|PointerEvent|number} event
   * @returns {number} 0.0-1.0（生の筆圧値）
   */
  getPressure(event) {
    // 数値が直接渡された場合
    if (typeof event === 'number') {
      return this.normalizePressure(event);
    }
    
    let pressure = 0.0; // ゼロ荷重対応: デフォルトを0.5→0.0に変更
    
    // FederatedPointerEvent の場合
    if (event && event.nativeEvent) {
      const native = event.nativeEvent;
      if (typeof native.pressure === 'number' && !Number.isNaN(native.pressure)) {
        // ゼロ荷重対応: pressure === 0 も有効な値として扱う
        pressure = native.pressure;
      }
    }
    // 通常の PointerEvent の場合
    else if (event && typeof event.pressure === 'number' && !Number.isNaN(event.pressure)) {
      pressure = event.pressure;
    }
    
    // 履歴に追加して重み付き移動平均
    this.pressureHistory.push(pressure);
    if (this.pressureHistory.length > this.maxHistorySize) {
      this.pressureHistory.shift();
    }
    
    const smoothed = this.getWeightedAverage(this.pressureHistory);
    this.lastPressure = smoothed;
    
    return smoothed;
  }
  
  /**
   * 重み付き移動平均（最新の値を重視）
   * @param {Array<number>} values
   * @returns {number}
   */
  getWeightedAverage(values) {
    if (values.length === 0) return 0.0;
    if (values.length === 1) return values[0];
    
    // 重み: [1, 2, 3, 4, 5] のように最新ほど重くする
    let weightedSum = 0;
    let weightTotal = 0;
    
    for (let i = 0; i < values.length; i++) {
      const weight = i + 1; // 最新の値ほど重みが大きい
      weightedSum += values[i] * weight;
      weightTotal += weight;
    }
    
    return weightedSum / weightTotal;
  }
  
  /**
   * 補正済み筆圧を取得（BrushSettingsのカーブ適用後を想定）
   * @param {FederatedPointerEvent|PointerEvent|number} event
   * @returns {number} 0.0-1.0（補正済み筆圧）
   */
  getCorrectedPressure(event) {
    const rawPressure = this.getPressure(event);
    const corrected = rawPressure * this.pressureCorrection;
    return Math.max(0.0, Math.min(1.0, corrected));
  }

  /**
   * 傾き情報取得
   * @param {FederatedPointerEvent|PointerEvent} event
   * @returns {{tiltX: number, tiltY: number}}
   */
  getTilt(event) {
    if (!event) return { tiltX: 0, tiltY: 0 };
    
    // FederatedPointerEvent の場合
    if (event.nativeEvent) {
      const native = event.nativeEvent;
      this.tiltX = native.tiltX || 0;
      this.tiltY = native.tiltY || 0;
    }
    // 通常の PointerEvent の場合
    else {
      this.tiltX = event.tiltX || 0;
      this.tiltY = event.tiltY || 0;
    }
    
    return { tiltX: this.tiltX, tiltY: this.tiltY };
  }

  /**
   * 🆕 twist（ペン回転角）情報取得
   * @param {FederatedPointerEvent|PointerEvent} event
   * @returns {number} 0-359度
   */
  getTwist(event) {
    if (!event) return 0;
    
    // FederatedPointerEvent の場合
    if (event.nativeEvent) {
      const native = event.nativeEvent;
      this.twist = native.twist || 0;
    }
    // 通常の PointerEvent の場合
    else {
      this.twist = event.twist || 0;
    }
    
    return this.twist;
  }

  /**
   * 🆕 全ポインタ情報を一括取得（パフォーマンス最適化用）
   * @param {FederatedPointerEvent|PointerEvent} event
   * @returns {{pressure: number, tiltX: number, tiltY: number, twist: number}}
   */
  getAllPointerData(event) {
    const pressure = this.getPressure(event);
    const tilt = this.getTilt(event);
    const twist = this.getTwist(event);
    
    return {
      pressure: pressure,
      tiltX: tilt.tiltX,
      tiltY: tilt.tiltY,
      twist: twist
    };
  }

  /**
   * 速度から筆圧推定（フォールバック用）
   * @param {number} x
   * @param {number} y
   * @param {number} timestamp
   * @returns {number}
   */
  estimatePressureFromVelocity(x, y, timestamp) {
    if (!this.lastPoint || !this.lastTimestamp) {
      this.lastPoint = { x, y };
      this.lastTimestamp = timestamp;
      return 0.5;
    }

    const deltaTime = timestamp - this.lastTimestamp;
    if (deltaTime <= 0) return 0.5;

    const dx = x - this.lastPoint.x;
    const dy = y - this.lastPoint.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const velocity = distance / deltaTime;

    // 速度履歴に追加
    this.velocityHistory.push(velocity);
    if (this.velocityHistory.length > this.maxVelocityHistory) {
      this.velocityHistory.shift();
    }

    // 移動平均
    const avgVelocity = this.velocityHistory.reduce((sum, v) => sum + v, 0) / this.velocityHistory.length;

    // 速度が速い → 筆圧低い (0.3-0.7の範囲)
    const pressure = Math.max(0.3, Math.min(0.7, 1 - avgVelocity / 2.0));

    this.lastPoint = { x, y };
    this.lastTimestamp = timestamp;

    return pressure;
  }

  /**
   * 筆圧正規化
   * @param {number} rawPressure
   * @returns {number} 0.0-1.0
   */
  normalizePressure(rawPressure) {
    return Math.max(0.0, Math.min(1.0, rawPressure));
  }

  /**
   * 状態リセット (描画終了時)
   */
  reset() {
    this.lastPressure = 0.0;
    this.pressureHistory = [];
    this.tiltX = 0;
    this.tiltY = 0;
    this.twist = 0;
    this.lastPoint = null;
    this.lastTimestamp = null;
    this.velocityHistory = [];
  }
  
  /**
   * デバッグ情報取得
   */
  getDebugInfo() {
    return {
      pressureCorrection: this.pressureCorrection,
      lastPressure: this.lastPressure,
      historySize: this.pressureHistory.length,
      tilt: { x: this.tiltX, y: this.tiltY },
      twist: this.twist
    };
  }
}

// グローバル登録
if (typeof window.TegakiDrawing === 'undefined') {
  window.TegakiDrawing = {};
}
window.TegakiDrawing.PressureHandler = PressureHandler;