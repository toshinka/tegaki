/**
 * PressureHandler - 筆圧補正専用クラス
 * 
 * 責務: 生筆圧値(rawPressure)をベースライン補正した補正筆圧値に変換
 * 
 * 動作仕様:
 * - ストローク開始時の初期N点からベースライン(無負荷時の圧力)を算出
 * - 補正式: (raw - baseline) / (1 - baseline)
 * - ベースライン算出中は pressure = 0 を返す
 */

class PressureHandler {
    constructor() {
        this.baseline = 0;
        this.baselineSamples = [];
        this.BASELINE_SAMPLE_COUNT = 5; // 初期5点でベースライン算出
        this.isCalibrated = false;
    }

    /**
     * ストローク開始 - ベースライン状態をリセット
     */
    startStroke() {
        this.baseline = 0;
        this.baselineSamples = [];
        this.isCalibrated = false;
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
}