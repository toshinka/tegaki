/**
 * ============================================================================
 * ファイル名: system/drawing/stroke-recorder.js
 * 責務: ストローク（座標、筆圧、時間）の記録を担当する
 * 依存: なし（PressureHandlerはオプション）
 * 被依存: brush-core.js, core-engine.js等
 * 公開API: StrokeRecorder
 * イベント発火: なし
 * イベント受信: なし
 * グローバル登録: window.StrokeRecorder
 * 実装状態: ♻️移植
 * ============================================================================
 */

export class StrokeRecorder {
    constructor(pressureHandler = null, cameraSystem = null) {
        this.pressureHandler = pressureHandler;
        this.cameraSystem = cameraSystem;
        
        this.currentPoints = [];
        this.isRecording = false;
        this.startTime = 0;
    }
    
    startStroke(localX, localY, rawPressure) {
        this.currentPoints = [];
        this.isRecording = true;
        this.startTime = Date.now();
        
        this.addPoint(localX, localY, rawPressure);
    }
    
    addPoint(localX, localY, rawPressure) {
        if (!this.isRecording) {
            return null;
        }
        
        let pressure = rawPressure;
        if (this.pressureHandler) {
            // [修正] メソッド名が getCalibratedPressure だったのを正しく呼び出す。
            pressure = this.pressureHandler.getCalibratedPressure(rawPressure);

            // [修正] 距離ベースのフィルタを適用してスムージングを効かせる。
            if (this.currentPoints.length > 0) {
                const prev = this.currentPoints[this.currentPoints.length - 1];
                // 変数名が間違っていたのを修正 (x, y -> localX, localY)
                const distance = Math.hypot(localX - prev.x, localY - prev.y);
                pressure = this.pressureHandler.applyDistanceFilter(pressure, prev.pressure, distance);
            }
            this.pressureHandler.updatePreviousPressure(pressure);
        }
        
        const point = {
            x: localX,
            y: localY,
            pressure: pressure, // processedPressure ではなく pressure を使用
            time: Date.now() - this.startTime
        };
        
        this.currentPoints.push(point);
        return point;
    }
    
    endStroke() {
        if (!this.isRecording) {
            return { points: [], isSingleDot: false };
        }
        
        const strokeData = {
            points: [...this.currentPoints],
            isSingleDot: this.currentPoints.length === 1,
            duration: Date.now() - this.startTime
        };
        
        this.currentPoints = [];
        this.isRecording = false;
        this.startTime = 0;
        
        return strokeData;
    }
    
    getCurrentPoints() {
        return [...this.currentPoints];
    }

    getCurrentStats() {
        return this._summarizePoints(this.currentPoints);
    }

    _summarizePoints(points) {
        const count = points.length;
        let distance = 0;
        let pressureDeltaTotal = 0;
        let maxDistance = 0;
        let maxPressureDelta = 0;
        let minPressure = count ? points[0].pressure : null;
        let maxPressure = count ? points[0].pressure : null;

        for (let i = 1; i < count; i++) {
            const prev = points[i - 1];
            const current = points[i];
            const segmentDistance = Math.hypot(current.x - prev.x, current.y - prev.y);
            const pressureDelta = Math.abs((current.pressure ?? 0) - (prev.pressure ?? 0));
            distance += segmentDistance;
            pressureDeltaTotal += pressureDelta;
            maxDistance = Math.max(maxDistance, segmentDistance);
            maxPressureDelta = Math.max(maxPressureDelta, pressureDelta);
            minPressure = Math.min(minPressure, current.pressure ?? 0);
            maxPressure = Math.max(maxPressure, current.pressure ?? 0);
        }

        return {
            count,
            distance: Number(distance.toFixed(3)),
            maxDistance: Number(maxDistance.toFixed(3)),
            pressure: {
                min: minPressure === null ? null : Number(minPressure.toFixed(4)),
                max: maxPressure === null ? null : Number(maxPressure.toFixed(4)),
                deltaTotal: Number(pressureDeltaTotal.toFixed(4)),
                maxDelta: Number(maxPressureDelta.toFixed(4))
            }
        };
    }
    
    isActive() {
        return this.isRecording;
    }
    
    cancel() {
        this.currentPoints = [];
        this.isRecording = false;
        this.startTime = 0;
    }
}

// 下位互換性のためにグローバルに登録
window.StrokeRecorder = StrokeRecorder;
