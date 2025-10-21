/**
 * StrokeRecorder - ストローク座標記録専用クラス
 * 
 * 責務: ポインターイベントから座標・筆圧・時刻を記録
 * 
 * 座標系: レイヤーローカル座標（camera-system経由で変換済み）
 * 
 * データフロー:
 * PointerEvent(screen座標) → camera-system変換 → StrokeRecorder記録 → StrokeData出力
 */

class StrokeRecorder {
    constructor(pressureHandler, cameraSystem) {
        this.pressureHandler = pressureHandler;
        this.cameraSystem = cameraSystem;
        this.points = [];
        this.isRecording = false;
    }

    /**
     * ストローク記録開始
     * @param {number} screenX - スクリーン座標X
     * @param {number} screenY - スクリーン座標Y
     * @param {number} rawPressure - 生筆圧値
     */
    startStroke(screenX, screenY, rawPressure) {
        this.points = [];
        this.isRecording = true;
        
        // 圧力ハンドラー初期化
        this.pressureHandler.startStroke();
        
        // 初回ポイント追加
        this.addPoint(screenX, screenY, rawPressure);
    }

    /**
     * ポイント追加
     * @param {number} screenX - スクリーン座標X
     * @param {number} screenY - スクリーン座標Y
     * @param {number} rawPressure - 生筆圧値
     */
    addPoint(screenX, screenY, rawPressure) {
        if (!this.isRecording) return;

        // スクリーン座標 → レイヤーローカル座標変換
        const localPoint = this.cameraSystem.screenToLayer(screenX, screenY);
        
        // 筆圧補正
        const pressure = this.pressureHandler.getCalibratedPressure(rawPressure);

        this.points.push({
            x: localPoint.x,
            y: localPoint.y,
            pressure: pressure,
            time: performance.now()
        });
    }

    /**
     * ストローク記録終了
     * @returns {Object} strokeData - { points, isSingleDot }
     */
    endStroke() {
        this.isRecording = false;

        // 単独点判定
        const isSingleDot = this.points.length <= 2 && this.getTotalDistance() < 2;

        return {
            points: [...this.points],
            isSingleDot: isSingleDot
        };
    }

    /**
     * 現在記録中のポイント配列を取得（プレビュー用）
     */
    getCurrentPoints() {
        return [...this.points];
    }

    /**
     * ストローク総距離を計算
     * @returns {number} 総移動距離(px)
     */
    getTotalDistance() {
        if (this.points.length < 2) return 0;

        let totalDistance = 0;
        for (let i = 1; i < this.points.length; i++) {
            const dx = this.points[i].x - this.points[i - 1].x;
            const dy = this.points[i].y - this.points[i - 1].y;
            totalDistance += Math.sqrt(dx * dx + dy * dy);
        }
        return totalDistance;
    }

    /**
     * ポイント数を取得
     */
    getPointCount() {
        return this.points.length;
    }

    /**
     * 記録中かどうか
     */
    isActive() {
        return this.isRecording;
    }
}