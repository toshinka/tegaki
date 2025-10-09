/**
 * PressureHandler v1.0
 * 筆圧検知・疑似筆圧算出
 */

class PressureHandler {
  constructor() {
    this.lastPoint = null;
    this.lastTimestamp = null;
    this.velocityHistory = [];
    this.maxVelocityHistory = 5;
  }

  /**
   * 筆圧取得 (実筆圧 or 疑似筆圧)
   * @param {PointerEvent|number} pointerEventOrPressure
   * @returns {number} 0.0-1.0
   */
  getPressure(pointerEventOrPressure) {
    // 数値が直接渡された場合
    if (typeof pointerEventOrPressure === 'number') {
      return this.normalizePressure(pointerEventOrPressure);
    }

    // PointerEventの場合
    const event = pointerEventOrPressure;
    if (!event) return 0.5;

    // 実筆圧が有効な場合
    if (event.pressure > 0 && event.pressure < 1) {
      return this.normalizePressure(event.pressure);
    }

    // 疑似筆圧算出 (速度ベース)
    return this.estimatePressureFromVelocity(event.clientX, event.clientY, event.timeStamp);
  }

  /**
   * 速度から筆圧推定
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
    this.lastPoint = null;
    this.lastTimestamp = null;
    this.velocityHistory = [];
  }
}

// グローバル登録
if (typeof window.TegakiDrawing === 'undefined') {
  window.TegakiDrawing = {};
}
window.TegakiDrawing.PressureHandler = PressureHandler;