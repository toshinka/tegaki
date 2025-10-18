/**
 * BrushSettings v6.1 - 超確実登録版
 * 変更点:
 * - 複数の場所にグローバル登録（TegakiDrawing, window, globalThis）
 * - 読み込み確認ログ追加
 */

(function() {
  'use strict';

  class BrushSettings {
    constructor(config, eventBus) {
      this.config = config || {};
      this.eventBus = eventBus;

      this.size = this.config.pen?.size || 8;
      this.color = 0x000000;
      this.opacity = this.config.pen?.opacity || 1.0;

      this.thinning = 0.95;
      this.smoothing = this.config.userSettings?.smoothing || 0.5;
      this.streamline = 0.5;
      this.simulatePressure = true;
      
      this.taperStart = 0;
      this.taperEnd = 0;
      
      this.capStart = true;
      this.capEnd = true;
      
      this.minSize = 0.1;
      
      this.pressureCorrection = this.config.userSettings?.pressureCorrection || 1.0;
      this.pressureCurve = this.config.userSettings?.pressureCurve || 'linear';
      
      this.simplifyTolerance = this.config.userSettings?.simplifyTolerance || 1.0;
      this.simplifyEnabled = this.config.userSettings?.simplifyEnabled !== false;
      
      this.smoothingMode = this.config.userSettings?.smoothingMode || 'medium';
      this.splineTension = this.config.userSettings?.splineTension || 0.5;
      this.splineSegments = this.config.userSettings?.splineSegments || 8;
      
      this.subscribeToSettingsChanges();
    }

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
      
      this.eventBus.on('settings:smoothing-mode', ({ mode }) => {
        this.setSmoothingMode(mode);
      });
      
      this.eventBus.on('settings:spline-tension', ({ value }) => {
        this.setSplineTension(value);
      });
      
      this.eventBus.on('settings:spline-segments', ({ value }) => {
        this.setSplineSegments(value);
      });
      
      this.eventBus.on('settings:min-size', ({ value }) => {
        this.setMinSize(value);
      });
    }

    setPressureCorrection(value) {
      const clamped = Math.max(0.1, Math.min(3.0, value));
      this.pressureCorrection = clamped;
      
      if (this.eventBus) {
        this.eventBus.emit('brush:pressure-correction-changed', { value: clamped });
      }
    }

    setSmoothing(value) {
      const clamped = Math.max(0.0, Math.min(1.0, value));
      this.smoothing = clamped;
      
      if (this.eventBus) {
        this.eventBus.emit('brush:smoothing-changed', { value: clamped });
      }
    }

    setPressureCurve(curve) {
      if (!['linear', 'ease-in', 'ease-out'].includes(curve)) {
        curve = 'linear';
      }
      
      this.pressureCurve = curve;
      
      if (this.eventBus) {
        this.eventBus.emit('brush:pressure-curve-changed', { curve });
      }
    }

    setSimplifyTolerance(value) {
      const clamped = Math.max(0.1, Math.min(5.0, value));
      this.simplifyTolerance = clamped;
      
      if (this.eventBus) {
        this.eventBus.emit('brush:simplify-tolerance-changed', { value: clamped });
      }
    }

    setSimplifyEnabled(enabled) {
      this.simplifyEnabled = !!enabled;
      
      if (this.eventBus) {
        this.eventBus.emit('brush:simplify-enabled-changed', { enabled: this.simplifyEnabled });
      }
    }

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

    setSplineTension(value) {
      const clamped = Math.max(0.0, Math.min(1.0, value));
      this.splineTension = clamped;
      
      if (this.eventBus) {
        this.eventBus.emit('brush:spline-tension-changed', { value: clamped });
      }
    }

    setSplineSegments(value) {
      const clamped = Math.max(2, Math.min(20, Math.floor(value)));
      this.splineSegments = clamped;
      
      if (this.eventBus) {
        this.eventBus.emit('brush:spline-segments-changed', { value: clamped });
      }
    }

    setMinSize(value) {
      const clamped = Math.max(0.05, Math.min(2.0, value));
      this.minSize = clamped;
      
      if (this.eventBus) {
        this.eventBus.emit('brush:min-size-changed', { value: clamped });
      }
    }

    applyPressureCurve(rawPressure) {
      const normalized = Math.max(0.0, Math.min(1.0, rawPressure));
      
      switch (this.pressureCurve) {
        case 'linear':
          return normalized;
        
        case 'ease-in':
          return normalized * normalized;
        
        case 'ease-out':
          return Math.pow(normalized, 5);
        
        default:
          return normalized;
      }
    }

    applyPressureCorrection(pressure) {
      const curved = this.applyPressureCurve(pressure);
      const corrected = curved * this.pressureCorrection;
      return Math.max(0.0, Math.min(1.0, corrected));
    }

    getBrushSize() {
      return this.size;
    }

    setBrushSize(size) {
      size = Math.max(0.1, Math.min(100, size));
      this.size = size;
      
      if (this.eventBus) {
        this.eventBus.emit('brushSizeChanged', { size });
      }
    }

    getBrushColor() {
      return this.color;
    }

    setBrushColor(color) {
      this.color = color;
      
      if (this.eventBus) {
        this.eventBus.emit('brushColorChanged', { color });
      }
    }

    getBrushOpacity() {
      return this.opacity;
    }

    setBrushOpacity(opacity) {
      opacity = Math.max(0.0, Math.min(1.0, opacity));
      this.opacity = opacity;
      
      if (this.eventBus) {
        this.eventBus.emit('brushOpacityChanged', { opacity });
      }
    }

    getStrokeOptions(isFirst = false, isLast = false) {
      return {
        size: this.size,
        thinning: this.thinning,
        smoothing: this.smoothing,
        streamline: this.streamline,
        easing: (t) => t,
        simulatePressure: this.simulatePressure,
        start: {
          taper: this.taperStart,
          cap: this.capStart
        },
        end: {
          taper: this.taperEnd,
          cap: this.capEnd
        },
        last: isLast,
        color: this.color,
        alpha: this.opacity
      };
    }

    updateStrokeOptions(overrides) {
      if (!overrides) return;
      
      if (overrides.size !== undefined) this.size = overrides.size;
      if (overrides.thinning !== undefined) this.thinning = overrides.thinning;
      if (overrides.smoothing !== undefined) this.smoothing = overrides.smoothing;
      if (overrides.streamline !== undefined) this.streamline = overrides.streamline;
      if (overrides.simulatePressure !== undefined) this.simulatePressure = overrides.simulatePressure;
      if (overrides.taperStart !== undefined) this.taperStart = overrides.taperStart;
      if (overrides.taperEnd !== undefined) this.taperEnd = overrides.taperEnd;
    }

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
        smoothingMode: this.smoothingMode,
        splineTension: this.splineTension,
        splineSegments: this.splineSegments,
        thinning: this.thinning,
        minSize: this.minSize,
        taperStart: this.taperStart,
        taperEnd: this.taperEnd
      };
    }
  }

  // 🔥 超確実グローバル登録（3箇所）
  console.log('🔧 [BrushSettings] Starting registration...');
  
  // 1. window.TegakiDrawing名前空間
  if (typeof window.TegakiDrawing === 'undefined') {
    window.TegakiDrawing = {};
    console.log('✅ [BrushSettings] Created window.TegakiDrawing namespace');
  }
  window.TegakiDrawing.BrushSettings = BrushSettings;
  
  // 2. window直下（フォールバック用）
  window.BrushSettings = BrushSettings;
  
  // 3. globalThis（厳密モード対応）
  if (typeof globalThis !== 'undefined') {
    globalThis.BrushSettings = BrushSettings;
  }
  
  // 登録確認ログ
  console.log('✅ [BrushSettings] Registered successfully:');
  console.log('   - window.TegakiDrawing.BrushSettings:', !!window.TegakiDrawing?.BrushSettings);
  console.log('   - window.BrushSettings:', !!window.BrushSettings);
  console.log('   - globalThis.BrushSettings:', typeof globalThis !== 'undefined' && !!globalThis.BrushSettings);
  
  console.log('✅ brush-settings.js loaded completely');

})();