/**
 * PressureHandler - 筆圧補正専用クラス (Phase 1: tilt/twist対応版)
 * 
 * 責務: 生筆圧値(rawPressure)をベースライン補正した補正筆圧値に変換
 *       + Pointer Events API完全活用（tiltX, tiltY, twist）
 * 
 * 動作仕様:
 * - ストローク開始時の初期N点からベースライン(無負荷時の圧力)を算出
 * - 補正式: (raw - baseline) / (1 - baseline)
 * - ベースライン算出中は pressure = 0 を返す
 * - tiltX/Y, twistデータを保持し、将来の高度な筆圧表現に備える
 */

class PressureHandler {
    constructor() {
        this.baseline = 0;
        this.baselineSamples = [];
        this.BASELINE_SAMPLE_COUNT = 5;
        this.isCalibrated = false;
        
        this.tiltX = 0;
        this.tiltY = 0;
        this.twist = 0;
    }

    startStroke() {
        this.baseline = 0;
        this.baselineSamples = [];
        this.isCalibrated = false;
    }

    updateTiltData(event) {
        this.tiltX = event.tiltX || 0;
        this.tiltY = event.tiltY || 0;
        this.twist = event.twist || 0;
    }

    getCalibratedPressure(rawPressure) {
        if (!this.isCalibrated) {
            this.baselineSamples.push(rawPressure);

            if (this.baselineSamples.length >= this.BASELINE_SAMPLE_COUNT) {
                this.baseline = Math.min(...this.baselineSamples);
                this.isCalibrated = true;
            } else {
                return 0;
            }
        }

        if (this.baseline >= 1.0) {
            return rawPressure;
        }

        const calibrated = (rawPressure - this.baseline) / (1.0 - this.baseline);
        return Math.max(0, Math.min(1, calibrated));
    }

    getTiltData() {
        return {
            tiltX: this.tiltX,
            tiltY: this.tiltY,
            twist: this.twist
        };
    }

    getBaseline() {
        return this.baseline;
    }

    isReady() {
        return this.isCalibrated;
    }
}

window.TegakiPressureHandler = PressureHandler;
console.log('✅ pressure-handler.js (グローバル登録版) loaded');