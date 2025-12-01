/**
 * ============================================================
 * pressure-handler.js - v2.4.2 筆圧カーブ完全修正版
 * ============================================================
 * 親ファイル: drawing-engine.js, brush-core.js
 * 依存ファイル:
 *   - system/settings-manager.js
 * ============================================================
 * 筆圧処理 - ポインタ圧力の正規化と補正
 * 【v2.4.2 改修内容】
 * ✅ 平滑化アルゴリズム修正（正しい移動平均）
 * ✅ minPressureSize実装修正（1%-100%の範囲）
 * ✅ 筆圧感度カーブ修正
 * ============================================================
 */

(function () {
  "use strict";

  /**
   * 筆圧ハンドラークラス
   */
  class PressureHandler {
    constructor() {
      this.lastPressure = 0.5;
      this.pressureHistory = [];
      this.historySize = 3;
      
      this.settingsManager = null;
      this._initSettingsManager();
    }
    
    /**
     * SettingsManager初期化
     */
    _initSettingsManager() {
      if (window.TegakiSettingsManager) {
        if (typeof window.TegakiSettingsManager.get === 'function') {
          this.settingsManager = window.TegakiSettingsManager;
        }
        else if (typeof window.TegakiSettingsManager === 'function') {
          this.settingsManager = new window.TegakiSettingsManager(
            window.TegakiEventBus,
            window.TEGAKI_CONFIG
          );
        }
      }
      
      if (!this.settingsManager) {
        console.warn('[PressureHandler] settingsManager not available, using defaults');
      }
    }

    /**
     * 生の筆圧値を正規化・補正
     * @param {number} rawPressure - 生の筆圧値（0.0〜1.0）
     * @returns {number} 補正後の筆圧値（0.0〜1.0）
     */
    process(rawPressure) {
      // 筆圧値の検証
      let pressure = this.validatePressure(rawPressure);

      // 設定取得
      let minPressureSize = 0.0;
      let pressureSensitivity = 1.0;
      
      if (this.settingsManager && typeof this.settingsManager.get === 'function') {
        minPressureSize = this.settingsManager.get("minPressureSize");
        pressureSensitivity = this.settingsManager.get("pressureSensitivity");
        
        if (minPressureSize === undefined) minPressureSize = 0.0;
        if (pressureSensitivity === undefined) pressureSensitivity = 1.0;
      }

      // 1. 感度適用（指数カーブ）
      pressure = this.applySensitivity(pressure, pressureSensitivity);

      // 2. 最小値適用（1%〜100%の範囲にマップ）
      // minPressureSize=0.0 → 1%〜100%
      // minPressureSize=1.0 → 100%固定
      const minRatio = 0.01 + minPressureSize * 0.99; // 0.01〜1.0
      pressure = minRatio + pressure * (1.0 - minRatio);

      // 3. 平滑化（移動平均）
      this.pressureHistory.push(pressure);
      if (this.pressureHistory.length > this.historySize) {
        this.pressureHistory.shift();
      }
      
      const smoothed = this.smoothPressure();
      
      this.lastPressure = smoothed;
      return smoothed;
    }

    /**
     * 筆圧値の検証
     * @param {number} pressure - 生の筆圧値
     * @returns {number} 検証済み筆圧値
     */
    validatePressure(pressure) {
      if (
        pressure === null ||
        pressure === undefined ||
        isNaN(pressure) ||
        pressure < 0
      ) {
        return this.lastPressure;
      }

      return Math.max(0.0, Math.min(1.0, pressure));
    }

    /**
     * 筆圧感度適用（指数カーブ）
     * @param {number} pressure - 入力筆圧（0.0〜1.0）
     * @param {number} sensitivity - 感度倍率（0.1〜3.0）
     * @returns {number} 補正後筆圧
     */
    applySensitivity(pressure, sensitivity) {
      // sensitivity = 1.0で線形
      // sensitivity > 1.0で軽い筆圧で早く最大到達
      // sensitivity < 1.0で強い筆圧が必要

      if (sensitivity === 1.0) {
        return pressure;
      }

      // 指数カーブ適用
      const exponent = 1.0 / sensitivity;
      return Math.pow(pressure, exponent);
    }

    /**
     * 筆圧平滑化（移動平均）
     * @returns {number} 平滑化済み筆圧
     */
    smoothPressure() {
      if (this.pressureHistory.length === 0) {
        return this.lastPressure;
      }

      const sum = this.pressureHistory.reduce((acc, p) => acc + p, 0);
      return sum / this.pressureHistory.length;
    }

    /**
     * 履歴クリア（ストローク開始時）
     */
    reset() {
      this.pressureHistory = [];
      this.lastPressure = 0.5;
    }

    /**
     * デバッグ情報取得
     * @returns {Object} 現在の状態
     */
    getDebugInfo() {
      let minPressureSize = 0.0;
      let pressureSensitivity = 1.0;
      
      if (this.settingsManager && typeof this.settingsManager.get === 'function') {
        minPressureSize = this.settingsManager.get("minPressureSize") || 0.0;
        pressureSensitivity = this.settingsManager.get("pressureSensitivity") || 1.0;
      }
      
      return {
        lastPressure: this.lastPressure,
        historySize: this.pressureHistory.length,
        minPressureSize: minPressureSize,
        pressureSensitivity: pressureSensitivity,
        hasSettingsManager: !!this.settingsManager
      };
    }
  }

  window.PressureHandler = PressureHandler;
  
  console.log('✅ pressure-handler.js v2.4.2 loaded (筆圧カーブ完全修正版)');
  console.log('   ✅ 最小筆圧サイズ: 1%-100%の範囲実装');
  console.log('   ✅ 平滑化アルゴリズム修正');
})();