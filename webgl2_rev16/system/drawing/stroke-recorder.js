/**
 * ============================================================
 * stroke-recorder.js - Phase 6.5: ポイント補間実装
 * ============================================================
 * 【親依存】
 *   - pressure-handler.js (筆圧処理)
 *   - camera-system.js (座標系)
 * 
 * 【子依存】
 *   - drawing-engine.js
 *   - brush-core.js
 * 
 * 【Phase 6.5改修内容】
 * ✅ 距離ベース自動補間（カエルの卵防止）
 * ✅ 筆圧線形補間
 * ✅ 傾きデータプロパティ追加（将来Phase用）
 * ✅ 補間閾値設定対応（config.js）
 * ============================================================
 */

(function() {
    'use strict';

    class StrokeRecorder {
        constructor(pressureHandler = null, cameraSystem = null) {
            this.pressureHandler = pressureHandler;
            this.cameraSystem = cameraSystem;
            
            this.currentPoints = [];
            this.isRecording = false;
            this.startTime = 0;
            
            // 🔧 Phase 6.5: 補間設定
            this._getInterpolationConfig();
        }
        
        _getInterpolationConfig() {
            const config = window.TEGAKI_CONFIG?.drawing?.interpolation;
            
            this.interpolationEnabled = config?.enabled !== false; // デフォルト有効
            this.interpolationThreshold = config?.threshold || 5.0; // ピクセル
            this.interpolationMaxSteps = config?.maxSteps || 10; // 最大分割数
        }
        
        /**
         * 🔧 Phase 6.5: 2点間の距離計算
         */
        _calculateDistance(p1, p2) {
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            return Math.sqrt(dx * dx + dy * dy);
        }
        
        /**
         * 🔧 Phase 6.5: 線形補間
         * @param {Object} p1 - 始点
         * @param {Object} p2 - 終点
         * @param {number} t - 補間係数 (0.0 ~ 1.0)
         */
        _interpolatePoint(p1, p2, t) {
            return {
                x: p1.x + (p2.x - p1.x) * t,
                y: p1.y + (p2.y - p1.y) * t,
                pressure: p1.pressure + (p2.pressure - p1.pressure) * t,
                time: p1.time + (p2.time - p1.time) * t,
                // 将来Phase用プロパティ
                tiltX: (p1.tiltX !== undefined && p2.tiltX !== undefined) 
                    ? p1.tiltX + (p2.tiltX - p1.tiltX) * t 
                    : undefined,
                tiltY: (p1.tiltY !== undefined && p2.tiltY !== undefined) 
                    ? p1.tiltY + (p2.tiltY - p1.tiltY) * t 
                    : undefined,
                twist: (p1.twist !== undefined && p2.twist !== undefined) 
                    ? p1.twist + (p2.twist - p1.twist) * t 
                    : undefined
            };
        }
        
        /**
         * 🔧 Phase 6.5: 補間ポイント生成
         * 2点間の距離が閾値を超える場合、中間点を自動生成
         */
        _generateInterpolatedPoints(p1, p2) {
            const distance = this._calculateDistance(p1, p2);
            
            // 閾値以下なら補間不要
            if (distance <= this.interpolationThreshold) {
                return [];
            }
            
            // 必要な分割数を計算
            const steps = Math.min(
                Math.ceil(distance / this.interpolationThreshold),
                this.interpolationMaxSteps
            );
            
            const interpolated = [];
            for (let i = 1; i < steps; i++) {
                const t = i / steps;
                interpolated.push(this._interpolatePoint(p1, p2, t));
            }
            
            return interpolated;
        }
        
        startStroke(localX, localY, rawPressure, tiltX, tiltY, twist) {
            this.currentPoints = [];
            this.isRecording = true;
            this.startTime = Date.now();
            
            // 設定を再読み込み（動的変更対応）
            this._getInterpolationConfig();
            
            this.addPoint(localX, localY, rawPressure, tiltX, tiltY, twist);
        }
        
        addPoint(localX, localY, rawPressure, tiltX, tiltY, twist) {
            if (!this.isRecording) {
                return;
            }
            
            // 筆圧処理
            let processedPressure = rawPressure;
            if (this.pressureHandler && this.pressureHandler.processPressure) {
                processedPressure = this.pressureHandler.processPressure(rawPressure);
            }
            
            const point = {
                x: localX,
                y: localY,
                pressure: processedPressure,
                time: Date.now() - this.startTime,
                // 🔧 Phase 6.5: 傾きデータ保持（将来Phase用）
                tiltX: tiltX,
                tiltY: tiltY,
                twist: twist
            };
            
            // 🔧 Phase 6.5: 補間処理
            if (this.interpolationEnabled && this.currentPoints.length > 0) {
                const lastPoint = this.currentPoints[this.currentPoints.length - 1];
                const interpolated = this._generateInterpolatedPoints(lastPoint, point);
                
                // 補間ポイントを追加
                interpolated.forEach(p => this.currentPoints.push(p));
            }
            
            this.currentPoints.push(point);
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
        
        isActive() {
            return this.isRecording;
        }
        
        cancel() {
            this.currentPoints = [];
            this.isRecording = false;
            this.startTime = 0;
        }
    }

    window.StrokeRecorder = StrokeRecorder;

    console.log('✅ stroke-recorder.js Phase 6.5 loaded');
    console.log('   ✅ 距離ベース自動補間実装');
    console.log('   ✅ 筆圧線形補間対応');
    console.log('   ✅ 傾きデータ保持（将来Phase用）');
    console.log('   ⚙️ 補間閾値: 5.0px (config.js変更可能)');

})();