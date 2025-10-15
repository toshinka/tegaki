/**
 * PressureHandler v2.0 - Pointer Events API完全対応版
 * 🔥 新機能:
 * - tiltX, tiltY (ペンの傾き) 対応
 * - twist (ペンの回転) 対応
 * - pointerType 判定強化
 * - デバイス特性の自動検出
 */

class PressureHandler {
  constructor() {
    this.lastPoint = null;
    this.lastTimestamp = null;
    this.velocityHistory = [];
    this.maxVelocityHistory = 5;
    
    // 🔥 Phase 1: 拡張プロパティ
    this.hasPressureSupport = false;
    this.hasTiltSupport = false;
    this.hasTwistSupport = false;
    this.deviceType = 'unknown'; // 'pen', 'touch', 'mouse'
    
    this._detectCapabilities();
  }

  /**
   * デバイス機能の検出
   * @private
   */
  _detectCapabilities() {
    // 初回のPointerEventで検出されるため、ここでは初期化のみ
    console.log('🖊️ PressureHandler initialized - waiting for first pointer event');
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

    // 🔥 Phase 1: デバイスタイプ検出
    if (event.pointerType) {
      this.deviceType = event.pointerType;
    }

    // 🔥 圧力センサーの検出
    if (typeof event.pressure === 'number' && !Number.isNaN(event.pressure)) {
      this.hasPressureSupport = true;
      return this.normalizePressure(event.pressure);
    }

    // 🔥 フォールバック: 速度ベースの疑似筆圧
    return this.estimatePressureFromVelocity(event.clientX, event.clientY, event.timeStamp);
  }

  /**
   * 🔥 Phase 1 新機能: ペンの傾き取得
   * @param {PointerEvent} event
   * @returns {{tiltX: number, tiltY: number}} -90〜90度
   */
  getTilt(event) {
    if (!event) return { tiltX: 0, tiltY: 0 };

    const tiltX = typeof event.tiltX === 'number' && !Number.isNaN(event.tiltX) ? event.tiltX : 0;
    const tiltY = typeof event.tiltY === 'number' && !Number.isNaN(event.tiltY) ? event.tiltY : 0;

    // 傾きサポート検出
    if (tiltX !== 0 || tiltY !== 0) {
      this.hasTiltSupport = true;
    }

    return { tiltX, tiltY };
  }

  /**
   * 🔥 Phase 1 新機能: ペンの回転取得
   * @param {PointerEvent} event
   * @returns {number} 0〜359度
   */
  getTwist(event) {
    if (!event) return 0;

    const twist = typeof event.twist === 'number' && !Number.isNaN(event.twist) ? event.twist : 0;

    // 回転サポート検出
    if (twist !== 0) {
      this.hasTwistSupport = true;
    }

    return twist;
  }

  /**
   * 🔥 Phase 1 新機能: 完全なポインター情報取得
   * @param {PointerEvent} event
   * @returns {Object}
   */
  getFullPointerData(event) {
    if (!event) {
      return {
        pressure: 0.5,
        tiltX: 0,
        tiltY: 0,
        twist: 0,
        pointerType: this.deviceType,
        hasRealPressure: false,
        hasTilt: false,
        hasTwist: false
      };
    }

    const pressure = this.getPressure(event);
    const tilt = this.getTilt(event);
    const twist = this.getTwist(event);

    return {
      pressure,
      tiltX: tilt.tiltX,
      tiltY: tilt.tiltY,
      twist,
      pointerType: event.pointerType || 'unknown',
      hasRealPressure: this.hasPressureSupport,
      hasTilt: this.hasTiltSupport,
      hasTwist: this.hasTwistSupport
    };
  }

  /**
   * 🔥 Phase 1 新機能: 傾きから太さを計算
   * ペンを寝かせると太くなる（書道風）
   * @param {number} tiltX
   * @param {number} tiltY
   * @param {number} baseSize
   * @returns {number}
   */
  getSizeFromTilt(tiltX, tiltY, baseSize) {
    // 傾きの絶対値（0-90度）
    const tiltMagnitude = Math.sqrt(tiltX * tiltX + tiltY * tiltY);
    
    // 傾きが大きいほど太くなる（最大1.5倍）
    const tiltFactor = 1.0 + (tiltMagnitude / 90) * 0.5;
    
    return baseSize * tiltFactor;
  }

  /**
   * 🔥 Phase 1 新機能: 傾きから不透明度を計算
   * ペンを立てると濃く、寝かせると薄く
   * @param {number} tiltX
   * @param {number} tiltY
   * @param {number} baseOpacity
   * @returns {number}
   */
  getOpacityFromTilt(tiltX, tiltY, baseOpacity) {
    const tiltMagnitude = Math.sqrt(tiltX * tiltX + tiltY * tiltY);
    
    // 傾きが大きいほど薄くなる（最小0.7倍）
    const tiltFactor = 1.0 - (tiltMagnitude / 90) * 0.3;
    
    return baseOpacity * tiltFactor;
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
   * デバイス機能レポート
   * @returns {Object}
   */
  getCapabilities() {
    return {
      deviceType: this.deviceType,
      hasPressure: this.hasPressureSupport,
      hasTilt: this.hasTiltSupport,
      hasTwist: this.hasTwistSupport
    };
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

console.log('✅ pressure-handler.js v2.0 (Pointer Events API完全対応) loaded');
console.log('   - 🔥 tiltX/Y (傾き) 対応');
console.log('   - 🔥 twist (回転) 対応');
console.log('   - 🔥 デバイス機能自動検出');