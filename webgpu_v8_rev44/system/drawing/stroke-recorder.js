/**
 * stroke-recorder.js - ポイント補間追加完全版
 * Stroke Point Recording System
 * 
 * 📁 親依存:
 *   - drawing-engine.js (Local座標取得元)
 *   - pressure-handler.js (筆圧データ) [オプション]
 *   - config.js (BRUSH_SETTINGS)
 * 
 * 📄 子依存:
 *   - brush-core.js (startStroke/updateStroke/endStroke呼び出し)
 *   - gpu-stroke-processor.js
 * 
 * 【ポイント補間追加】
 * ✅ addPoint()で前回ポイントとの距離チェック
 * ✅ 閾値(5px)超過時に線形補間ポイント自動挿入
 * ✅ 曲線の滑らかさ向上
 * 
 * 責務:
 *   - Local座標ポイントの記録（座標変換は一切行わない）
 *   - ポイント間補間による滑らか化
 *   - pressure/tilt/twist データ保持
 *   - PerfectFreehand互換形式提供
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

            // ✅ 補間設定
            this.interpolationThreshold = 5.0; // px
            this.maxInterpolationPoints = 10;

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
         * ✅ ポイント補間追加版
         */
        addPoint(localX, localY, pressure = 0.5, tiltX = 0, tiltY = 0) {
            if (!this.isRecording) {
                return;
            }

            const now = performance.now();

            // ✅ 補間処理
            if (this.points.length > 0) {
                const lastPoint = this.points[this.points.length - 1];
                const dx = localX - lastPoint.x;
                const dy = localY - lastPoint.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                // 距離が閾値を超える場合、補間ポイントを挿入
                if (distance > this.interpolationThreshold) {
                    const numInterpolations = Math.min(
                        Math.floor(distance / this.interpolationThreshold),
                        this.maxInterpolationPoints
                    );

                    for (let i = 1; i <= numInterpolations; i++) {
                        const t = i / (numInterpolations + 1);
                        const interpX = lastPoint.x + dx * t;
                        const interpY = lastPoint.y + dy * t;
                        const interpPressure = lastPoint.pressure + (pressure - lastPoint.pressure) * t;
                        const interpTiltX = lastPoint.tiltX + (tiltX - lastPoint.tiltX) * t;
                        const interpTiltY = lastPoint.tiltY + (tiltY - lastPoint.tiltY) * t;

                        this._addPointDirect(interpX, interpY, interpPressure, interpTiltX, interpTiltY, now);
                    }
                }
            }

            // 実際のポイント追加
            this._addPointDirect(localX, localY, pressure, tiltX, tiltY, now);
        }

        /**
         * ✅ 内部ポイント追加（補間処理なし）
         */
        _addPointDirect(localX, localY, pressure, tiltX, tiltY, timestamp) {
            const timeDelta = timestamp - this.lastPointTime;

            const point = {
                x: localX,
                y: localY,
                pressure: Math.max(0.01, Math.min(1.0, pressure)),

                tiltX: tiltX,
                tiltY: tiltY,
                timestamp: timestamp,
                timeDelta: timeDelta,

                edgeId: this.points.length,
                channelId: this.points.length % 3
            };

            this.points.push(point);
            this.lastPointTime = timestamp;
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

    console.log('✅ stroke-recorder.js ポイント補間追加完全版 loaded');
    console.log('   ✅ 5px閾値で自動補間');
    console.log('   ✅ 曲線の滑らかさ向上');

})();