/**
 * StrokeRecorder - ストローク座標記録専用クラス (Phase 1: 座標変換修正版)
 * 
 * 責務: ポインターイベントから座標・筆圧・時刻を記録
 *       + tiltX/Y, twistデータの取得と記録
 * 
 * 座標系: レイヤーローカル座標（camera-system.screenToLayer()で直接取得）
 * 
 * 修正: cameraSystem.screenToLayer()の戻り値が既にレイヤーローカル座標のため
 *      二重変換を削除
 */

class StrokeRecorder {
    constructor(pressureHandler, cameraSystem) {
        this.pressureHandler = pressureHandler;
        this.cameraSystem = cameraSystem;
        this.points = [];
        this.isRecording = false;
    }

    /**
     * ストローク記録開始（PointerEvent対応）
     * @param {PointerEvent} event - ポインターイベント
     */
    startStrokeFromEvent(event) {
        this.points = [];
        this.isRecording = true;
        
        // tilt/twistデータを更新
        this.pressureHandler.updateTiltData(event);
        
        // 圧力ハンドラー初期化
        this.pressureHandler.startStroke();
        
        // 初回ポイント追加
        const pressure = event.pressure || 0.5;
        this.addPointFromEvent(event, pressure);
    }

    /**
     * ストローク記録開始（レガシー互換）
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
     * PointerEventからポイント追加
     * @param {PointerEvent} event - ポインターイベント
     * @param {number} rawPressure - 生筆圧値
     */
    addPointFromEvent(event, rawPressure) {
        if (!this.isRecording) return;

        // tilt/twistデータを更新
        this.pressureHandler.updateTiltData(event);

        // スクリーン座標 → レイヤーローカル座標（cameraSystem内で変換済み）
        const layerLocalPoint = this.cameraSystem.screenToLayer(event.clientX, event.clientY);
        
        // 筆圧補正
        const pressure = this.pressureHandler.getCalibratedPressure(rawPressure);

        // tiltデータも記録（将来の高度な筆圧表現用）
        const tiltData = this.pressureHandler.getTiltData();

        this.points.push({
            x: layerLocalPoint.x,
            y: layerLocalPoint.y,
            pressure: pressure,
            time: performance.now(),
            tiltX: tiltData.tiltX,
            tiltY: tiltData.tiltY,
            twist: tiltData.twist
        });
    }

    /**
     * ポイント追加（レガシー互換）
     * @param {number} screenX - スクリーン座標X
     * @param {number} screenY - スクリーン座標Y
     * @param {number} rawPressure - 生筆圧値
     */
    addPoint(screenX, screenY, rawPressure) {
        if (!this.isRecording) return;

        // スクリーン座標 → レイヤーローカル座標
        const layerLocalPoint = this.cameraSystem.screenToLayer(screenX, screenY);
        
        // 筆圧補正
        const pressure = this.pressureHandler.getCalibratedPressure(rawPressure);

        this.points.push({
            x: layerLocalPoint.x,
            y: layerLocalPoint.y,
            pressure: pressure,
            time: performance.now(),
            tiltX: 0,
            tiltY: 0,
            twist: 0
        });
    }

    /**
     * ストローク記録終了
     * @returns {Object} strokeData - { points, isSingleDot }
     */
    endStroke() {
        this.isRecording = false;

        // 単独点判定（移動距離 < 2px, サンプル数 <= 2）
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