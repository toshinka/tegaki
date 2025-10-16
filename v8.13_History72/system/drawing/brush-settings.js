/**
 * BrushSettings v4.0 - スムージングモード管理追加版
 * 変更点:
 * - Catmull-Rom Spline用のスムージングモード管理
 * - スプライン詳細設定の管理
 * - EventBus連携強化
 */

class BrushSettings {
  constructor(config, eventBus) {
    this.config = config || {};
    this.eventBus = eventBus;

    // 基本ブラシ設定
    this.size = this.config.pen?.size || 8;
    this.color = 0x000000;
    this.opacity = this.config.pen?.opacity || 1.0;

    // Perfect Freehand設定
    // 🆕 Phase 4: thinningを0.7に引き上げ（フェザータッチをより細く）
    this.thinning = 0.7;
    this.smoothing = this.config.userSettings?.smoothing || 0.5;
    this.streamline = 0.5;
    this.simulatePressure = true;
    
    // 筆圧・線補正設定
    this.pressureCorrection = this.config.userSettings?.pressureCorrection || 1.0;
    this.pressureCurve = this.config.userSettings?.pressureCurve || 'linear';
    
    // Simplify.js設定
    this.simplifyTolerance = this.config.userSettings?.simplifyTolerance || 1.0;
    this.simplifyEnabled = this.config.userSettings?.simplifyEnabled !== false;
    
    // 🆕 Catmull-Rom Spline設定
    this.smoothingMode = this.config.userSettings?.smoothingMode || 'medium';
    this.splineTension = this.config.userSettings?.splineTension || 0.5;
    this.splineSegments = this.config.userSettings?.splineSegments || 8;
    
    // EventBusで設定変更を購読
    this.subscribeToSettingsChanges();
  }

  /**
   * 設定変更イベントの購読
   */
  subscribeToSettingsChanges() {
    if (!this.eventBus) return;
    
    this.eventBus.on('settings:pressure-correction', ({ value }) => {
      this.setPressureCorrection(value);
    });
    
    this.eventBus.on('settings:smoothing', ({ value }) => {
      this.setSmoothing(value);
    });
    
    this.eventBus.on('settings:pressure-curve', ({ curve }) => {
      this.setPressureCurve(curve);
    });
    
    this.eventBus.on('settings:simplify-tolerance', ({ value }) => {
      this.setSimplifyTolerance(value);
    });
    
    this.eventBus.on('settings:simplify-enabled', ({ enabled }) => {
      this.setSimplifyEnabled(enabled);
    });
    
    // 🆕 Splineスムージングイベント
    this.eventBus.on('settings:smoothing-mode', ({ mode }) => {
      this.setSmoothingMode(mode);
    });
    
    this.eventBus.on('settings:spline-tension', ({ value }) => {
      this.setSplineTension(value);
    });
    
    this.eventBus.on('settings:spline-segments', ({ value }) => {
      this.setSplineSegments(value);
    });
  }

  /**
   * 筆圧補正の設定
   * @param {number} value - 0.1～3.0
   */
  setPressureCorrection(value) {
    const clamped = Math.max(0.1, Math.min(3.0, value));
    this.pressureCorrection = clamped;
    
    if (this.eventBus) {
      this.eventBus.emit('brush:pressure-correction-changed', { value: clamped });
    }
  }

  /**
   * 線補正（スムーズ度）の設定
   * @param {number} value - 0.0～1.0
   */
  setSmoothing(value) {
    const clamped = Math.max(0.0, Math.min(1.0, value));
    this.smoothing = clamped;
    
    if (this.eventBus) {
      this.eventBus.emit('brush:smoothing-changed', { value: clamped });
    }
  }

  /**
   * 筆圧カーブの設定
   * @param {string} curve - 'linear' | 'ease-in' | 'ease-out'
   */
  setPressureCurve(curve) {
    if (!['linear', 'ease-in', 'ease-out'].includes(curve)) {
      curve = 'linear';
    }
    
    this.pressureCurve = curve;
    
    if (this.eventBus) {
      this.eventBus.emit('brush:pressure-curve-changed', { curve });
    }
  }

  /**
   * Simplify許容誤差の設定
   * @param {number} value - 0.1～5.0
   */
  setSimplifyTolerance(value) {
    const clamped = Math.max(0.1, Math.min(5.0, value));
    this.simplifyTolerance = clamped;
    
    if (this.eventBus) {
      this.eventBus.emit('brush:simplify-tolerance-changed', { value: clamped });
    }
  }

  /**
   * Simplify有効/無効の切替
   * @param {boolean} enabled
   */
  setSimplifyEnabled(enabled) {
    this.simplifyEnabled = !!enabled;
    
    if (this.eventBus) {
      this.eventBus.emit('brush:simplify-enabled-changed', { enabled: this.simplifyEnabled });
    }
  }

  /**
   * 🆕 スムージングモードの設定
   * @param {string} mode - 'none' | 'light' | 'medium' | 'strong'
   */
  setSmoothingMode(mode) {
    const validModes = ['none', 'light', 'medium', 'strong'];
    if (!validModes.includes(mode)) {
      mode = 'medium';
    }
    
    this.smoothingMode = mode;
    
    if (this.eventBus) {
      this.eventBus.emit('brush:smoothing-mode-changed', { mode });
    }
  }

  /**
   * 🆕 スプライン張力の設定
   * @param {number} value - 0.0～1.0
   */
  setSplineTension(value) {
    const clamped = Math.max(0.0, Math.min(1.0, value));
    this.splineTension = clamped;
    
    if (this.eventBus) {
      this.eventBus.emit('brush:spline-tension-changed', { value: clamped });
    }
  }

  /**
   * 🆕 スプラインセグメント数の設定
   * @param {number} value - 2～20
   */
  setSplineSegments(value) {
    const clamped = Math.max(2, Math.min(20, Math.floor(value)));
    this.splineSegments = clamped;
    
    if (this.eventBus) {
      this.eventBus.emit('brush:spline-segments-changed', { value: clamped });
    }
  }

  /**
   * 筆圧カーブの適用
   * @param {number} rawPressure - 0.0～1.0
   * @returns {number} カーブ適用後の筆圧
   */
  applyPressureCurve(rawPressure) {
    const normalized = Math.max(0.0, Math.min(1.0, rawPressure));
    
    switch (this.pressureCurve) {
      case 'linear':
        return normalized;
      
      case 'ease-in':
        // 軽い筆圧でも太くなりやすい（二乗）
        return normalized * normalized;
      
      case 'ease-out':
        // 🆕 Phase 4: より強いカーブでフェザータッチを細く
        // 三乗カーブで低圧力時により細い線に
        return Math.pow(normalized, 3);
      
      default:
        return normalized;
    }
  }

  /**
   * 筆圧補正を適用
   * @param {number} pressure - 0.0～1.0
   * @returns {number} 補正後の筆圧
   */
  applyPressureCorrection(pressure) {
    // カーブ適用 → 補正係数適用
    const curved = this.applyPressureCurve(pressure);
    const corrected = curved * this.pressureCorrection;
    
    // 0.0～1.0に収める
    return Math.max(0.0, Math.min(1.0, corrected));
  }

  // ===== 既存メソッド =====

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

  /**
   * 現在の設定を取得
   * @returns {Object}
   */
  getCurrentSettings() {
    return {
      size: this.size,
      color: this.color,
      opacity: this.opacity,
      pressureCorrection: this.pressureCorrection,
      smoothing: this.smoothing,
      pressureCurve: this.pressureCurve,
      simplifyTolerance: this.simplifyTolerance,
      simplifyEnabled: this.simplifyEnabled,
      // 🆕 Spline設定
      smoothingMode: this.smoothingMode,
      splineTension: this.splineTension,
      splineSegments: this.splineSegments
    };
  }
}

// グローバル登録
if (typeof window.TegakiDrawing === 'undefined') {
  window.TegakiDrawing = {};
}
window.TegakiDrawing.BrushSettings = BrushSettings;