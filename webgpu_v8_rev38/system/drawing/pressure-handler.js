/**
 * ================================================================================
 * pressure-handler.js Phase 1改修版（元ファイル完全継承）
 * ================================================================================
 * 
 * 📁 親ファイル依存: なし（独立モジュール）
 * 
 * 📄 子ファイル使用先:
 *   - system/drawing/stroke-recorder.js
 *   - system/drawing/drawing-engine.js
 *   - system/drawing/brush-core.js
 * 
 * 【責務】
 * - 生筆圧値(rawPressure)をベースライン補正
 * - Pointer Events API完全活用（tiltX, tiltY, twist）
 * - 距離ベース適応フィルタ（短距離→即座反映、長距離→スムージング）
 * 
 * 【Phase 1改修内容】
 * 🔧 L42-49: ベースライン未確定時にraw値を返す（0.5固定を削除）
 * 🔧 L36: マウスはpressure=0に統一
 * 
 * ================================================================================
 */

(function() {
    'use strict';

    class PressureHandler {
        constructor() {
            this.baseline = 0;
            this.baselineSamples = [];
            this.BASELINE_SAMPLE_COUNT = 5;
            this.isCalibrated = false;
            
            this.tiltX = 0;
            this.tiltY = 0;
            this.twist = 0;
            
            this.previousPressure = 0;
            this.enableDistanceFilter = true;
        }

        startStroke() {
            this.baseline = 0;
            this.baselineSamples = [];
            this.isCalibrated = false;
            this.previousPressure = 0;
        }

        updateTiltData(event) {
            this.tiltX = event.tiltX || 0;
            this.tiltY = event.tiltY || 0;
            this.twist = event.twist || 0;
        }

        /**
         * 🔧 Phase 1改修: 筆圧補正（ベースライン未確定時はraw値を返す）
         * @param {number} rawPressure - 0.0 ~ 1.0
         * @param {string} pointerType - 'pen' or 'mouse'
         * @returns {number} 補正筆圧値 (0.0 ~ 1.0)
         */
        getCalibratedPressure(rawPressure, pointerType = 'pen') {
            // 🔧 Phase 1改修: マウスは常に0
            if (pointerType !== 'pen') {
                return 0;
            }

            // 🔧 Phase 1改修: ベースライン算出中はraw値を返す（0.5固定を削除）
            if (!this.isCalibrated) {
                this.baselineSamples.push(rawPressure);

                if (this.baselineSamples.length >= this.BASELINE_SAMPLE_COUNT) {
                    this.baseline = Math.min(...this.baselineSamples);
                    this.isCalibrated = true;
                } else {
                    // ✅ 0.5固定を削除、raw値をそのまま返す
                    return rawPressure;
                }
            }

            // ベースライン補正
            if (this.baseline >= 1.0) {
                return rawPressure;
            }

            const calibrated = (rawPressure - this.baseline) / (1.0 - this.baseline);
            
            return Math.max(0, Math.min(1, calibrated));
        }

        /**
         * 距離ベース適応フィルタ
         */
        applyDistanceFilter(currentPressure, prevPressure, distance) {
            if (!this.enableDistanceFilter) {
                return currentPressure;
            }

            const alpha = this._calculateAlpha(distance);
            const filtered = prevPressure * (1 - alpha) + currentPressure * alpha;
            
            return filtered;
        }

        _calculateAlpha(distance) {
            if (distance < 5) return 0.9;
            if (distance > 20) return 0.3;
            return 0.9 - ((distance - 5) / 15) * 0.6;
        }

        setDistanceFilterEnabled(enabled) {
            this.enableDistanceFilter = enabled;
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

        updatePreviousPressure(pressure) {
            this.previousPressure = pressure;
        }

        getPreviousPressure() {
            return this.previousPressure;
        }
    }

    window.PressureHandler = PressureHandler;

})();

console.log('✅ pressure-handler.js Phase 1 loaded');
console.log('   🔧 ベースライン未確定時にraw値返却（0.5固定削除）');