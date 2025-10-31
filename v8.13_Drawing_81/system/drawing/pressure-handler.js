/**
 * PressureHandler - 筆圧補正専用クラス (Phase 3: 距離ベース適応フィルタ追加版)
 * Phase 2対応: グローバルインスタンス公開
 * 
 * 責務: 生筆圧値(rawPressure)をベースライン補正した補正筆圧値に変換
 *       + Pointer Events API完全活用（tiltX, tiltY, twist）
 *       + 距離ベース適応フィルタ（Phase 3追加）
 */

(function() {
    'use strict';

    class PressureHandler {
        constructor() {
            this.baseline = 0;
            this.baselineSamples = [];
            this.BASELINE_SAMPLE_COUNT = 5; // 初期5点でベースライン算出
            this.isCalibrated = false;
            
            // Pointer Events API拡張データ
            this.tiltX = 0;
            this.tiltY = 0;
            this.twist = 0;
            
            // Phase 3: 距離ベース適応フィルタ
            this.previousPressure = 0;
            this.enableDistanceFilter = true;
        }

        /**
         * ストローク開始 - ベースライン状態をリセット
         */
        startStroke() {
            this.baseline = 0;
            this.baselineSamples = [];
            this.isCalibrated = false;
            this.previousPressure = 0;
            
            // tiltデータはリセットしない（ストローク中継続使用）
        }

        /**
         * PointerEventからtilt/twistデータを更新
         * @param {PointerEvent} event - pointer event
         */
        updateTiltData(event) {
            this.tiltX = event.tiltX || 0;
            this.tiltY = event.tiltY || 0;
            this.twist = event.twist || 0;
        }

        /**
         * 生筆圧を補正筆圧に変換
         * @param {number} rawPressure - 0.0 ~ 1.0 の生筆圧値
         * @returns {number} 補正された筆圧値 (0.0 ~ 1.0)
         */
        getCalibratedPressure(rawPressure) {
            // ベースライン算出中
            if (!this.isCalibrated) {
                this.baselineSamples.push(rawPressure);

                if (this.baselineSamples.length >= this.BASELINE_SAMPLE_COUNT) {
                    // 最小値をベースラインとする（無負荷時の圧力）
                    this.baseline = Math.min(...this.baselineSamples);
                    this.isCalibrated = true;
                } else {
                    // 算出中は0を返す
                    return 0;
                }
            }

            // ベースライン補正
            if (this.baseline >= 1.0) {
                // 異常値の場合は生値をそのまま返す
                return rawPressure;
            }

            const calibrated = (rawPressure - this.baseline) / (1.0 - this.baseline);
            
            // 0.0 ~ 1.0 にクランプ
            return Math.max(0, Math.min(1, calibrated));
        }

        /**
         * Phase 3: 距離ベース適応フィルタを適用
         * @param {number} currentPressure - 現在の筆圧値
         * @param {number} prevPressure - 前回の筆圧値
         * @param {number} distance - 前回からの移動距離(px)
         * @returns {number} フィルタ適用後の筆圧値
         */
        applyDistanceFilter(currentPressure, prevPressure, distance) {
            if (!this.enableDistanceFilter) {
                return currentPressure;
            }

            // alpha値を距離に応じて動的計算
            const alpha = this._calculateAlpha(distance);
            
            // EMA (Exponential Moving Average) フィルタ
            const filtered = prevPressure * (1 - alpha) + currentPressure * alpha;
            
            return filtered;
        }

        /**
         * Phase 3: 距離に応じたalpha値計算
         * @private
         * @param {number} distance - 移動距離(px)
         * @returns {number} alpha値 (0.0 ~ 1.0)
         */
        _calculateAlpha(distance) {
            // 短距離（< 5px）→ alpha=0.9（即座反映）
            // 長距離（> 20px）→ alpha=0.3（スムージング強）
            
            if (distance < 5) {
                return 0.9;
            }
            
            if (distance > 20) {
                return 0.3;
            }
            
            // 5px ~ 20px の範囲で線形補間
            // alpha = 0.9 - ((distance - 5) / 15) * 0.6
            return 0.9 - ((distance - 5) / 15) * 0.6;
        }

        /**
         * Phase 3: 距離ベースフィルタの有効/無効設定
         * @param {boolean} enabled - true=有効, false=無効
         */
        setDistanceFilterEnabled(enabled) {
            this.enableDistanceFilter = enabled;
        }

        /**
         * tilt/twistデータを取得
         * @returns {Object} {tiltX, tiltY, twist}
         */
        getTiltData() {
            return {
                tiltX: this.tiltX,
                tiltY: this.tiltY,
                twist: this.twist
            };
        }

        /**
         * 現在のベースライン値を取得（デバッグ用）
         */
        getBaseline() {
            return this.baseline;
        }

        /**
         * キャリブレーション完了状態を取得
         */
        isReady() {
            return this.isCalibrated;
        }

        /**
         * Phase 3: 前回の筆圧値を更新
         * @param {number} pressure - 筆圧値
         */
        updatePreviousPressure(pressure) {
            this.previousPressure = pressure;
        }

        /**
         * Phase 3: 前回の筆圧値を取得
         */
        getPreviousPressure() {
            return this.previousPressure;
        }
    }

    // ★★★ Phase 2: グローバルインスタンス公開 ★★★
    window.PressureHandler = PressureHandler;
    window.pressureHandler = new PressureHandler();

    console.log('✅ system/drawing/pressure-handler.js (Phase 2対応版) loaded');
    console.log('   - window.PressureHandler (クラス)');
    console.log('   - window.pressureHandler (インスタンス)');

})();