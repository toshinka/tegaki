/**
 * BrushSettings v1.0
 * ブラシ設定管理
 */

class BrushSettings {
  constructor(config, eventBus) {
    this.config = config || {};
    this.eventBus = eventBus;

    // ブラシ設定
    this.size = 8;
    this.color = 0x000000;
    this.opacity = 1.0;

    // Perfect Freehand設定
    this.thinning = 0.5;
    this.smoothing = 0.5;
    this.streamline = 0.5;
    this.simulatePressure = true;
  }

  /**
   * ブラシサイズ取得
   * @returns {number}
   */
  getBrushSize() {
    return this.size;
  }

  /**
   * ブラシサイズ設定
   * @param {number} size
   */
  setBrushSize(size) {
    size = Math.max(0.1, Math.min(100, size));
    this.size = size;
    
    if (this.eventBus) {
      this.eventBus.emit('brushSizeChanged', { size });
    }
  }

  /**
   * ブラシ色取得
   * @returns {number}
   */
  getBrushColor() {
    return this.color;
  }

  /**
   * ブラシ色設定
   * @param {number} color
   */
  setBrushColor(color) {
    this.color = color;
    
    if (this.eventBus) {
      this.eventBus.emit('brushColorChanged', { color });
    }
  }

  /**
   * 不透明度取得
   * @returns {number}
   */
  getBrushOpacity() {
    return this.opacity;
  }

  /**
   * 不透明度設定
   * @param {number} opacity
   */
  setBrushOpacity(opacity) {
    opacity = Math.max(0.0, Math.min(1.0, opacity));
    this.opacity = opacity;
    
    if (this.eventBus) {
      this.eventBus.emit('brushOpacityChanged', { opacity });
    }
  }

  /**
   * Perfect Freehand用のstrokeOptions生成
   * @returns {Object}
   */
  getStrokeOptions() {
    return {
      size: this.size,
      thinning: this.thinning,
      smoothing: this.smoothing,
      streamline: this.streamline,
      easing: (t) => t,
      simulatePressure: this.simulatePressure,
      color: this.color,
      alpha: this.opacity
    };
  }

  /**
   * strokeOptionsの部分更新
   * @param {Object} overrides
   */
  updateStrokeOptions(overrides) {
    if (!overrides) return;
    
    if (overrides.size !== undefined) this.size = overrides.size;
    if (overrides.thinning !== undefined) this.thinning = overrides.thinning;
    if (overrides.smoothing !== undefined) this.smoothing = overrides.smoothing;
    if (overrides.streamline !== undefined) this.streamline = overrides.streamline;
    if (overrides.simulatePressure !== undefined) this.simulatePressure = overrides.simulatePressure;
  }
}

// グローバル登録
if (typeof window.TegakiDrawing === 'undefined') {
  window.TegakiDrawing = {};
}
window.TegakiDrawing.BrushSettings = BrushSettings;