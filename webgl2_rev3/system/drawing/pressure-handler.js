/**
 * ============================================================
 * pressure-handler.js
 * ============================================================
 * 親ファイル: drawing-engine.js
 * 依存ファイル:
 *   - system/settings-manager.js
 * ============================================================
 * 筆圧処理 - ポインタ圧力の正規化と補正
 * 【改修内容】
 * - pressureCurve廃止
 * - minPressureSize対応（0-1.0: 最小サイズ比率）
 * - pressureSensitivity対応（0.1-3.0: 感度倍率）
 * - 滑らかな筆圧カーブ実装
 * ============================================================
 */

(function () {
  "use strict";

  const settingsManager = window.settingsManager;

  /**
   * 筆圧ハンドラークラス
   */
  class PressureHandler {
    constructor() {
      this.lastPressure = 0.5;
      this.pressureHistory = [];
      this.historySize = 3;
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
      const minPressureSize = settingsManager.get("minPressureSize") || 0.0;
      const pressureSensitivity = settingsManager.get("pressureSensitivity") || 1.0;

      // 感度適用（指数カーブ）
      pressure = this.applySensitivity(pressure, pressureSensitivity);

      // 最小値適用（線形補間）
      pressure = minPressureSize + pressure * (1.0 - minPressureSize);

      // 履歴記録
      this.pressureHistory.push(pressure);
      if (this.pressureHistory.length > this.historySize) {
        this.pressureHistory.shift();
      }

      // 平滑化
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
      // 値が無効な場合は前回値を使用
      if (
        pressure === null ||
        pressure === undefined ||
        isNaN(pressure) ||
        pressure < 0
      ) {
        return this.lastPressure;
      }

      // 0.0〜1.0にクランプ
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
      return {
        lastPressure: this.lastPressure,
        historySize: this.pressureHistory.length,
        minPressureSize: settingsManager.get("minPressureSize") || 0.0,
        pressureSensitivity: settingsManager.get("pressureSensitivity") || 1.0
      };
    }
  }

  window.PressureHandler = PressureHandler;
})();