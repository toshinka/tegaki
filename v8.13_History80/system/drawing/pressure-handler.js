/**
 * PressureHandler v5.0 - 超細開始点対応版
 * 変更点:
 * - 初期接触時の筆圧を強制的に極小値から開始
 * - 0-0.2範囲で6乗カーブ適用（超細線）
 * - 履歴スムージングを初期接触時のみオフ
 * - ライバルツールに匹敵する感度を実現
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
    
    // 筆圧補正係数
    this.pressureCorrection = 1.0;
    
    // 🆕 超細開始点設定
    this.initialTouchThreshold = 0.2;  // 初期接触閾値
    this.initialTouchMultiplier = 0.05; // 初期接触時の倍率（超細）
    this.ultraLowPressurePower = 6;    // 超低圧力カーブの指数
    
    // 🆕 ストローク開始フラグ
    this.isFirstTouch = true;
    this.touchStartTimestamp = 0;
    this.touchGracePeriod = 100; // 最初の100ms間は特別処理
    
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
   * 🆕 ストローク開始（描画開始時に呼ぶ）
   */
  startStroke() {
    this.isFirstTouch = true;
    this.touchStartTimestamp = Date.now();
    this.pressureHistory = [];
    this.lastPressure = 0.0;
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
    
    // 🆕 初期接触時の特別処理
    const now = Date.now();
    const isInGracePeriod = (now - this.touchStartTimestamp) < this.touchGracePeriod;
    
    if (this.isFirstTouch && pressure < this.initialTouchThreshold) {
      // 超低圧力時は6乗カーブで極小化
      const normalizedLow = pressure / this.initialTouchThreshold;
      pressure = Math.pow(normalizedLow, this.ultraLowPressurePower) * this.initialTouchThreshold * this.initialTouchMultiplier;
      
      // 最初の接触後もグレースピリオド内は特別処理継続
      if (!isInGracePeriod) {
        this.isFirstTouch = false;
      }
    } else {
      this.isFirstTouch = false;
    }
    
    // 履歴に追加（初期接触時はスムージング弱め）
    this.pressureHistory.push(pressure);
    if (this.pressureHistory.length > this.maxHistorySize) {
      this.pressureHistory.shift();
    }
    
    // 🆕 初期接触時はスムージングをスキップ
    const smoothed = isInGracePeriod ? pressure : this.getWeightedAverage(this.pressureHistory);
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
      const weight = i + 1;
      weightedSum += values[i] * weight;
      weightTotal += weight;
    }
    
    return weightedSum / weightTotal;
  }
  
  /**
   * 🆕 超細フェザータッチカーブ適用
   * ライバルツールに匹敵する感度を実現
   * @param {number} rawPressure - 0.0～1.0
   * @returns {number} カーブ適用後の筆圧
   */
  applyUltraFeatherCurve(rawPressure) {
    // 3段階のカーブで自然な遷移
    if (rawPressure <= 0.1) {
      // 極低圧力域（0.0-0.1）: 8乗カーブで1ピクセル級の細さ
      const normalized = rawPressure / 0.1;
      return Math.pow(normalized, 8) * 0.01; // 最大でも0.01
    } else if (rawPressure <= 0.3) {
      // 低圧力域（0.1-0.3）: 4乗カーブで滑らかに太く
      const normalized = (rawPressure - 0.1) / 0.2;
      return 0.01 + Math.pow(normalized, 4) * 0.09; // 0.01-0.1
    } else {
      // 通常域（0.3-1.0）: 2乗カーブで自然に
      const normalized = (rawPressure - 0.3) / 0.7;
      return 0.1 + Math.pow(normalized, 2) * 0.9; // 0.1-1.0
    }
  }
  
  /**
   * 補正済み筆圧を取得
   * @param {FederatedPointerEvent|PointerEvent|number} event
   * @returns {number} 0.0-1.0（補正済み筆圧）
   */
  getCorrectedPressure(event) {
    const rawPressure = this.getPressure(event);
    
    // 🆕 超細カーブ適用
    const ultraCurved = this.applyUltraFeatherCurve(rawPressure);
    
    // 補正係数適用
    const corrected = ultraCurved * this.pressureCorrection;
    
    return Math.max(0.0, Math.min(1.0, corrected));
  }

  /**
   * 傾き情報取得
   * @param {FederatedPointerEvent|PointerEvent} event
   * @returns {{tiltX: number, tiltY: number}}
   */
  getTilt(event) {
    if (!event) return { tiltX: 0, tiltY: 0 };
    
    if (event.nativeEvent) {
      const native = event.nativeEvent;
      this.tiltX = native.tiltX || 0;
      this.tiltY = native.tiltY || 0;
    } else {
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
    
    if (event.nativeEvent) {
      const native = event.nativeEvent;
      this.twist = native.twist || 0;
    } else {
      this.twist = event.twist || 0;
    }
    
    return this.twist;
  }

  /**
   * 全ポインタ情報を一括取得
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

    this.velocityHistory.push(velocity);
    if (this.velocityHistory.length > this.maxVelocityHistory) {
      this.velocityHistory.shift();
    }

    const avgVelocity = this.velocityHistory.reduce((sum, v) => sum + v, 0) / this.velocityHistory.length;
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
    this.isFirstTouch = true;
    this.touchStartTimestamp = 0;
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
      ultraFeather: {
        initialThreshold: this.initialTouchThreshold,
        initialMultiplier: this.initialTouchMultiplier,
        ultraLowPower: this.ultraLowPressurePower
      },
      isFirstTouch: this.isFirstTouch
    };
  }
}

// グローバル登録
if (typeof window.TegakiDrawing === 'undefined') {
  window.TegakiDrawing = {};
}
window.TegakiDrawing.PressureHandler = PressureHandler;