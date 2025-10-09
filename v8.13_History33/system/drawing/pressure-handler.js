/**
 * brush-settings.js
 * ブラシ設定管理
 * Version: 1.0.0
 * 
 * 【責務】
 * - ブラシサイズ・色・不透明度の管理
 * - Perfect Freehand strokeOptionsの生成
 * - 設定変更時のバリデーション
 * - EventBus連携
 */

(function(global) {
  'use strict';

  class BrushSettings {
    constructor(config = {}, eventBus = null) {
      this.config = config;
      this.eventBus = eventBus;

      // デフォルト設定
      this.settings = {
        size: config.defaultBrushSize || 4,
        color: config.defaultBrushColor || 0x000000,
        opacity: config.defaultBrushOpacity || 1.0,
        thinning: 0.5,
        smoothing: 0.5,
        streamline: 0.5,
        simulatePressure: true
      };
    }

    /**
     * ブラシサイズ取得
     */
    getBrushSize() {
      return this.settings.size;
    }

    /**
     * ブラシサイズ設定
     * @param {number} size - 0.1-100
     */
    setBrushSize(size) {
      const clamped = Math.max(0.1, Math.min(100, size));
      this.settings.size = clamped;
      
      if (this.eventBus) {
        this.eventBus.emit('brush:size-changed', { size: clamped });
      }
    }

    /**
     * ブラシ色取得
     */
    getBrushColor() {
      return this.settings.color;
    }

    /**
     * ブラシ色設定
     * @param {number} color - PIXI形式（0xRRGGBB）
     */
    setBrushColor(color) {
      this.settings.color = color;
      
      if (this.eventBus) {
        this.eventBus.emit('brush:color-changed', { color });
      }
    }

    /**
     * 不透明度取得
     */
    getBrushOpacity() {
      return this.settings.opacity;
    }

    /**
     * 不透明度設定
     * @param {number} opacity - 0.0-1.0
     */
    setBrushOpacity(opacity) {
      const clamped = Math.max(0.0, Math.min(1.0, opacity));
      this.settings.opacity = clamped;
      
      if (this.eventBus) {
        this.eventBus.emit('brush:opacity-changed', { opacity: clamped });
      }
    }

    /**
     * Perfect Freehand用のstrokeOptions生成
     */
    getStrokeOptions() {
      return {
        size: this.settings.size,
        color: this.settings.color,
        opacity: this.settings.opacity,
        thinning: this.settings.thinning,
        smoothing: this.settings.smoothing,
        streamline: this.settings.streamline,
        simulatePressure: this.settings.simulatePressure
      };
    }

    /**
     * strokeOptionsの部分上書き
     * @param {Object} overrides - 上書きする設定
     */
    updateStrokeOptions(overrides) {
      Object.assign(this.settings, overrides);
      
      if (this.eventBus) {
        this.eventBus.emit('brush:settings-changed', this.settings);
      }
    }

    /**
     * 全設定取得
     */
    getAllSettings() {
      return { ...this.settings };
    }
  }

  // グローバル登録
  if (!global.TegakiDrawing) {
    global.TegakiDrawing = {};
  }
  global.TegakiDrawing.BrushSettings = BrushSettings;

})(window);