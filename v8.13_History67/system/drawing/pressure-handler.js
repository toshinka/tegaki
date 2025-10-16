/**
 * PressureHandler v2.1 - 設定適用機能追加版
 * 変更点:
 * - pressureCorrection プロパティ追加
 * - setCorrectedPressure() による設定適用メソッド追加
 * - DrawingEngineから設定を受け取れるように改修
 */

class PressureHandler {
  constructor() {
    this.lastPressure = 0.5;
    this.pressureHistory = [];
    this.maxHistorySize = 3;
    
    // Phase 12: 傾き対応
    this.tiltX = 0;
    this.tiltY = 0;
    
    // 🆕 筆圧補正係数（DrawingEngineから設定される）
    this.pressureCorrection = 1.0;
    
    // 速度ベースのフォールバック用
    this.lastPoint = null;
    this.lastTimestamp = null;
    this.velocityHistory = [];
    this.maxVelocityHistory = 5;
  }
  
  /**
   * 🆕 筆圧補正係数を設定
   * @param {number} value - 0.1～3.0
   */
  setPressureCorrection(value) {
    this.pressureCorrection = Math.max(0.1, Math.min(3.0, value));
  }

  /**
   * Phase 12: PixiJS FederatedPointerEvent から圧力取得
   * @param {FederatedPointerEvent|PointerEvent|number} event
   * @returns {number} 0.0-1.0（生の筆圧値）
   */
  getPressure(event) {
    // 数値が直接渡された場合
    if (typeof event === 'number') {
      return this.normalizePressure(event);
    }
    
    let pressure = 0.5;
    
    // Phase 12: FederatedPointerEvent の場合
    if (event && event.nativeEvent) {
      const native = event.nativeEvent;
      if (typeof native.pressure === 'number' && !Number.isNaN(native.pressure) && native.pressure > 0) {
        pressure = native.pressure;
      } else if (native.pressure === 0) {
        // Phase 12: 圧力が0の場合は前回値を使用（ペンが離れた瞬間の対策）
        pressure = this.lastPressure;
      }
    }
    // 通常の PointerEvent の場合
    else if (event && typeof event.pressure === 'number' && !Number.isNaN(event.pressure)) {
      if (event.pressure > 0) {
        pressure = event.pressure;
      } else if (event.pressure === 0) {
        pressure = this.lastPressure;
      }
    }
    
    // 履歴に追加してスムージング
    this.pressureHistory.push(pressure);
    if (this.pressureHistory.length > this.maxHistorySize) {
      this.pressureHistory.shift();
    }
    
    const smoothed = this.pressureHistory.reduce((a, b) => a + b, 0) / this.pressureHistory.length;
    this.lastPressure = smoothed;
    
    return smoothed;
  }
  
  /**
   * 🆕 補正済み筆圧を取得（BrushSettingsのカーブ適用後を想定）
   * ※ 実際のカーブ適用はBrushSettings側で行う
   * ※ ここでは単純な係数のみ適用
   * @param {FederatedPointerEvent|PointerEvent|number} event
   * @returns {number} 0.0-1.0（補正済み筆圧）
   */
  getCorrectedPressure(event) {
    const rawPressure = this.getPressure(event);
    const corrected = rawPressure * this.pressureCorrection;
    return Math.max(0.0, Math.min(1.0, corrected));
  }

  /**
   * Phase 12: 傾き情報取得
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
    this.lastPressure = 0.5;
    this.pressureHistory = [];
    this.tiltX = 0;
    this.tiltY = 0;
    this.lastPoint = null;
    this.lastTimestamp = null;
    this.velocityHistory = [];
  }
  
  /**
   * 🆕 デバッグ情報取得
   */
  getDebugInfo() {
    return {
      pressureCorrection: this.pressureCorrection,
      lastPressure: this.lastPressure,
      historySize: this.pressureHistory.length,
      tilt: { x: this.tiltX, y: this.tiltY }
    };
  }
}

// グローバル登録
if (typeof window.TegakiDrawing === 'undefined') {
  window.TegakiDrawing = {};
}
window.TegakiDrawing.PressureHandler = PressureHandler;

console.log('✅ pressure-handler.js v2.1 (設定適用機能追加版) loaded');
console.log('   - setPressureCorrection() 追加');
console.log('   - getCorrectedPressure() 追加');
console.log('   - DrawingEngineからの設定受け取り対応');