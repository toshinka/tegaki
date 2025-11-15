/**
 * ================================================================================
 * stroke-recorder.js Phase 3: 補間強化完全版
 * ================================================================================
 * 
 * 📁 親ファイル依存:
 *   - drawing-engine.js (Local座標取得元)
 *   - pressure-handler.js (筆圧データ) [オプション]
 *   - config.js (BRUSH_SETTINGS)
 * 
 * 📄 子ファイル使用先:
 *   - brush-core.js (startStroke/updateStroke/endStroke呼び出し)
 *   - gpu-stroke-processor.js
 * 
 * 【Phase 3改修内容】
 * ✅ 補間閾値 5px → 2px（より滑らか）
 * ✅ Catmull-Rom spline補間追加（オプション）
 * ✅ 既存機能完全継承
 * 
 * 責務:
 *   - Local座標ポイントの記録（座標変換は一切行わない）
 *   - 高精度ポイント補間による滑らか化
 *   - pressure/tilt/twist データ保持
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

            // ✅ Phase 3: 補間強化
            this.interpolationThreshold = 2.0; // 5px → 2px
            this.maxInterpolationPoints = 10;
            this.useSplineInterpolation = false; // Catmull-Rom

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
         * ✅ Phase 3: 高精度補間
         */
        addPoint(localX, localY, pressure = 0.5, tiltX = 0, tiltY = 0) {
            if (!this.isRecording) {
                return;
            }

            const now = performance.now();

            if (this.points.length > 0) {
                const lastPoint = this.points[this.points.length - 1];
                const dx = localX - lastPoint.x;
                const dy = localY - lastPoint.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance > this.interpolationThreshold) {
                    if (this.useSplineInterpolation && this.points.length >= 2) {
                        this._addSplineInterpolation(lastPoint, localX, localY, pressure, tiltX, tiltY, now, distance);
                    } else {
                        this._addLinearInterpolation(lastPoint, localX, localY, pressure, tiltX, tiltY, now, distance);
                    }
                }
            }

            this._addPointDirect(localX, localY, pressure, tiltX, tiltY, now);
        }

        /**
         * ✅ Phase 3: 線形補間
         */
        _addLinearInterpolation(lastPoint, x, y, pressure, tiltX, tiltY, timestamp, distance) {
            const numInterpolations = Math.min(
                Math.floor(distance / this.interpolationThreshold),
                this.maxInterpolationPoints
            );

            const dx = x - lastPoint.x;
            const dy = y - lastPoint.y;
            const dPressure = pressure - lastPoint.pressure;
            const dTiltX = tiltX - lastPoint.tiltX;
            const dTiltY = tiltY - lastPoint.tiltY;

            for (let i = 1; i <= numInterpolations; i++) {
                const t = i / (numInterpolations + 1);
                const interpX = lastPoint.x + dx * t;
                const interpY = lastPoint.y + dy * t;
                const interpPressure = lastPoint.pressure + dPressure * t;
                const interpTiltX = lastPoint.tiltX + dTiltX * t;
                const interpTiltY = lastPoint.tiltY + dTiltY * t;

                this._addPointDirect(interpX, interpY, interpPressure, interpTiltX, interpTiltY, timestamp);
            }
        }

        /**
         * ✅ Phase 3: Catmull-Rom spline補間（オプション）
         */
        _addSplineInterpolation(lastPoint, x, y, pressure, tiltX, tiltY, timestamp, distance) {
            const p0 = this.points[this.points.length - 2];
            const p1 = lastPoint;
            const p2 = { x, y, pressure, tiltX, tiltY };
            
            // 次のポイント推定（現在の方向を延長）
            const p3 = {
                x: p2.x + (p2.x - p1.x),
                y: p2.y + (p2.y - p1.y),
                pressure: p2.pressure,
                tiltX: p2.tiltX,
                tiltY: p2.tiltY
            };

            const numInterpolations = Math.min(
                Math.floor(distance / this.interpolationThreshold),
                this.maxInterpolationPoints
            );

            for (let i = 1; i <= numInterpolations; i++) {
                const t = i / (numInterpolations + 1);
                
                const interpX = this._catmullRom(t, p0.x, p1.x, p2.x, p3.x);
                const interpY = this._catmullRom(t, p0.y, p1.y, p2.y, p3.y);
                const interpPressure = this._catmullRom(t, p0.pressure, p1.pressure, p2.pressure, p3.pressure);
                const interpTiltX = this._catmullRom(t, p0.tiltX, p1.tiltX, p2.tiltX, p3.tiltX);
                const interpTiltY = this._catmullRom(t, p0.tiltY, p1.tiltY, p2.tiltY, p3.tiltY);

                this._addPointDirect(interpX, interpY, interpPressure, interpTiltX, interpTiltY, timestamp);
            }
        }

        /**
         * ✅ Phase 3: Catmull-Rom補間式
         */
        _catmullRom(t, p0, p1, p2, p3) {
            const t2 = t * t;
            const t3 = t2 * t;
            
            return 0.5 * (
                (2 * p1) +
                (-p0 + p2) * t +
                (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
                (-p0 + 3 * p1 - 3 * p2 + p3) * t3
            );
        }

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

    console.log('✅ stroke-recorder.js Phase 3完全版 loaded');
    console.log('   ✅ 補間閾値: 2px（5px→2px）');
    console.log('   ✅ Catmull-Rom spline対応');

})();