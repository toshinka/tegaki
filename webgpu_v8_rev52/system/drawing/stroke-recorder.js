/**
 * ================================================================================
 * stroke-recorder.js Phase C-0: 補間削除・点列記録専用化
 * ================================================================================
 * 
 * 📁 親ファイル依存:
 *   - drawing-engine.js (Local座標取得元)
 *   - pressure-handler.js (筆圧データ) [オプション]
 * 
 * 📄 子ファイル使用先:
 *   - brush-core.js (startStroke/updateStroke/endStroke呼び出し)
 *   - gpu-stroke-processor.js (点列提供)
 * 
 * 【Phase C-0改修内容】
 * 🔥 補間処理完全削除（PerfectFreehandに委譲）
 * 🔥 点列記録のみに特化（座標変換・補間禁止）
 * ✅ pressure/tilt/twistデータ保持
 * ✅ PerfectFreehand互換形式提供
 * 
 * 責務:
 *   - Local座標ポイントの記録（変換・補間一切行わない）
 *   - タイムスタンプ・筆圧データ保持
 *   - PerfectFreehand互換形式提供
 * 
 * ================================================================================
 */

(function() {
    'use strict';

    if (window.strokeRecorder && window.strokeRecorder.initialized) {
        console.warn('[StrokeRecorder] Already loaded and initialized - skipping');
        return;
    }

    class StrokeRecorder {
        constructor(pressureHandler = null, cameraSystem = null) {
            this.pressureHandler = pressureHandler || null;
            this.cameraSystem = cameraSystem || null;

            this.points = [];
            this.isRecording = false;
            this.strokeStartTime = 0;
            this.lastPointTime = 0;

            this.currentMode = 'pen';
            this.currentColor = null;
            this.currentSize = null;

            this.windingData = null;

            this.totalPoints = 0;
            this.totalStrokes = 0;

            this.initialized = true;
        }

        initialize() {
            if (this.initialized) {
                return;
            }

            if (!this.pressureHandler && window.pressureHandler) {
                this.pressureHandler = window.pressureHandler;
            }

            if (!this.cameraSystem && window.cameraSystem) {
                this.cameraSystem = window.cameraSystem;
            }

            this.initialized = true;
        }

        startStroke(localX, localY, pressure = 0.5, options = {}) {
            this.points = [];
            this.isRecording = true;
            this.strokeStartTime = performance.now();
            this.lastPointTime = this.strokeStartTime;
            this.windingData = null;

            this.currentMode = options.mode || 'pen';
            this.currentColor = options.color || null;
            this.currentSize = options.size || null;

            this.addPoint(localX, localY, pressure, 0, 0);

            this.totalStrokes++;
        }

        /**
         * 🔥 Phase C-0: 補間削除・点列記録のみ
         */
        addPoint(localX, localY, pressure = 0.5, tiltX = 0, tiltY = 0) {
            if (!this.isRecording) {
                return;
            }

            const now = performance.now();
            const timeDelta = now - this.lastPointTime;

            const point = {
                x: localX,
                y: localY,
                pressure: Math.max(0.01, Math.min(1.0, pressure)),

                tiltX: tiltX,
                tiltY: tiltY,
                timestamp: now,
                timeDelta: timeDelta,

                edgeId: this.points.length,
                channelId: this.points.length % 3
            };

            this.points.push(point);
            this.lastPointTime = now;
            this.totalPoints++;
        }

        endStroke() {
            if (!this.isRecording) {
                return null;
            }

            this.isRecording = false;

            const strokeData = {
                points: this.points,
                windingData: this.windingData,

                mode: this.currentMode,
                color: this.currentColor,
                size: this.currentSize,

                duration: performance.now() - this.strokeStartTime,
                pointCount: this.points.length,
                avgTimeDelta: this._calculateAvgTimeDelta()
            };

            return strokeData;
        }

        _calculateAvgTimeDelta() {
            if (this.points.length <= 1) return 0;

            const totalDelta = this.points.reduce((sum, p) => sum + (p.timeDelta || 0), 0);
            return totalDelta / (this.points.length - 1);
        }

        getPointsForPerfectFreehand() {
            return this.points.map(p => [p.x, p.y, p.pressure]);
        }

        getPointsForGPU() {
            return {
                points: this.points,
                mode: this.currentMode,
                windingData: this.windingData
            };
        }

        getRawPoints() {
            return this.points;
        }

        calculateWinding() {
            if (this.points.length < 3) {
                return null;
            }

            const edgeCount = this.points.length - 1;
            const insideFlags = new Float32Array(edgeCount);
            insideFlags.fill(1.0);

            return {
                insideFlags: insideFlags,
                edgeCount: edgeCount,
                isClosed: false
            };
        }

        getStrokeInfo() {
            return {
                isRecording: this.isRecording,
                pointCount: this.points.length,
                duration: this.isRecording
                    ? (performance.now() - this.strokeStartTime)
                    : 0,
                mode: this.currentMode,
                totalStrokes: this.totalStrokes,
                totalPoints: this.totalPoints
            };
        }

        getStats() {
            return {
                totalStrokes: this.totalStrokes,
                totalPoints: this.totalPoints,
                avgPointsPerStroke: this.totalStrokes > 0
                    ? Math.floor(this.totalPoints / this.totalStrokes)
                    : 0
            };
        }

        reset() {
            this.points = [];
            this.isRecording = false;
            this.windingData = null;
            this.currentMode = 'pen';
            this.currentColor = null;
            this.currentSize = null;
        }

        fullReset() {
            this.reset();
            this.totalPoints = 0;
            this.totalStrokes = 0;
        }

        destroy() {
            this.fullReset();
            this.initialized = false;
            this.pressureHandler = null;
            this.cameraSystem = null;
        }
    }

    window.StrokeRecorder = StrokeRecorder;

    if (!window.strokeRecorder) {
        window.strokeRecorder = new StrokeRecorder();
    }

    console.log('✅ stroke-recorder.js Phase C-0 loaded');

})();