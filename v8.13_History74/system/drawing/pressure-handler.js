/**
 * PressureHandler v4.0 - フェザータッチ強化版
 * 変更点:
 * - 超低圧力時の極細線対応（0.0-0.1の範囲を大幅に細く）
 * - 筆圧カーブの最適化（低圧力時の感度向上）
 * - 初期タッチの最小サイズ設定
 * - より滑らかな筆圧遷移
 */

class PressureHandler {
  constructor() {
    this.lastPressure = 0.0;
    this.pressureHistory = [];
    this.maxHistorySize = 5;
    
    // 傾き対応
    this.tiltX = 0;
    this.tiltY = 0;
    
    // twist（ペン回転角）対応
    this.twist = 0;
    
    // 筆圧補正係数（DrawingEngineから設定される）
    this.pressureCorrection = 1.0;
    
    // 🆕 フェザータッチ設定
    this.minPressureThreshold = 0.0;  // 最小閾値（0から感知）
    this.featherTouchMultiplier = 0.3; // 低圧力時の倍率（0-0.15範囲を極細に）
    this.featherTouchRange = 0.15;     // フェザータッチと判定する圧力範囲
    
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
   * 🆕 フェザータッチ設定
   * @param {Object} config
   * @param {number} config.multiplier - 低圧力時の倍率 (0.1～1.0)
   * @param {number} config.range - フェザータッチ範囲 (0.05～0.3)
   */
  setFeatherTouchConfig(config) {
    if (config.multiplier !== undefined) {
      this.featherTouchMultiplier = Math.max(0.1, Math.min(1.0, config.multiplier));
    }
    if (config.range !== undefined) {
      this.featherTouchRange = Math.max(0.05, Math.min(0.3, config.range));
    }
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
    
    let pressure = 0.0;
    
    // FederatedPointerEvent の場合
    if (event && event.nativeEvent) {
      const native = event.nativeEvent;
      if (typeof native.pressure === 'number' && !Number.isNaN(native.pressure)) {
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
   * 🆕 フェザータッチカーブ適用
   * 低圧力時に極端に細くし、中圧力以上は通常カーブ
   * @param {number} rawPressure - 0.0～1.0
   * @returns {number} カーブ適用後の筆圧
   */
  applyFeatherTouchCurve(rawPressure) {
    if (rawPressure <= this.featherTouchRange) {
      // フェザータッチ範囲：指数カーブで極細に
      // 0.0 -> 0.0, 0.15 -> 0.045程度にマッピング
      const normalizedInRange = rawPressure / this.featherTouchRange;
      const curved = Math.pow(normalizedInRange, 2.5); // 2.5乗カーブ
      return curved * this.featherTouchRange * this.featherTouchMultiplier;
    } else {
      // 通常範囲：より滑らかな遷移
      const normalizedAboveRange = (rawPressure - this.featherTouchRange) / (1.0 - this.featherTouchRange);
      const curved = Math.pow(normalizedAboveRange, 1.5); // 1.5乗カーブ
      const baseValue = this.featherTouchRange * this.featherTouchMultiplier;
      return baseValue + curved * (1.0 - baseValue);
    }
  }
  
  /**
   * 補正済み筆圧を取得（BrushSettingsのカーブ適用後を想定）
   * @param {FederatedPointerEvent|PointerEvent|number} event
   * @returns {number} 0.0-1.0（補正済み筆圧）
   */
  getCorrectedPressure(event) {
    const rawPressure = this.getPressure(event);
    
    // 🆕 フェザータッチカーブ適用
    const featherCurved = this.applyFeatherTouchCurve(rawPressure);
    
    // 補正係数適用
    const corrected = featherCurved * this.pressureCorrection;
    
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
   * twist（ペン回転角）情報取得
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
   * 全ポインタ情報を一括取得（パフォーマンス最適化用）
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
      twist: this.twist,
      featherTouch: {
        multiplier: this.featherTouchMultiplier,
        range: this.featherTouchRange
      }
    };
  }
}

// グローバル登録
if (typeof window.TegakiDrawing === 'undefined') {
  window.TegakiDrawing = {};
}
window.TegakiDrawing.PressureHandler = PressureHandler;