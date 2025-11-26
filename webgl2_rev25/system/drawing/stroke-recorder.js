/**
 * ============================================================
 * stroke-recorder.js - Phase 7: 速度適応補間実装
 * ============================================================
 * 【親依存】
 *   - pressure-handler.js (筆圧処理)
 *   - camera-system.js (座標系)
 * 
 * 【子依存】
 *   - drawing-engine.js
 *   - brush-core.js
 * 
 * 【Phase 7改修内容】
 * ✅ 速度適応補間（高速ストローク時の自動細分化）
 * ✅ 補間閾値最適化（5.0px → 2.5px）
 * ✅ ペン入力時のカエルの卵完全対策
 * ✅ Phase 6.5全機能継承
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
            
            // Phase 7: 速度履歴（適応補間用）
            this.speedHistory = [];
            
            // 補間設定読み込み
            this._getInterpolationConfig();
        }
        
        _getInterpolationConfig() {
            const config = window.TEGAKI_CONFIG?.drawing?.interpolation;
            
            this.interpolationEnabled = config?.enabled !== false;
            this.interpolationThreshold = config?.threshold || 2.5; // Phase 7: デフォルト2.5px
            this.interpolationMaxSteps = config?.maxSteps || 15;    // Phase 7: デフォルト15
            this.adaptiveSpeed = config?.adaptiveSpeed !== false;   // Phase 7: 速度適応
        }
        
        /**
         * Phase 6.5: 2点間の距離計算
         */
        _calculateDistance(p1, p2) {
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            return Math.sqrt(dx * dx + dy * dy);
        }
        
        /**
         * Phase 7: 速度計算
         * @param {Object} p1 - 始点
         * @param {Object} p2 - 終点
         * @returns {number} - ピクセル/ms
         */
        _calculateSpeed(p1, p2) {
            const distance = this._calculateDistance(p1, p2);
            const timeDelta = p2.time - p1.time;
            
            if (timeDelta === 0) return 0;
            return distance / timeDelta;
        }
        
        /**
         * Phase 7: 速度適応閾値計算
         * 高速ストローク時はより細かく補間
         */
        _getAdaptiveThreshold(speed) {
            if (!this.adaptiveSpeed) {
                return this.interpolationThreshold;
            }
            
            // 速度閾値（ピクセル/ms）
            const SLOW_SPEED = 0.5;   // 低速
            const FAST_SPEED = 3.0;   // 高速
            
            // 低速: 通常閾値
            if (speed < SLOW_SPEED) {
                return this.interpolationThreshold;
            }
            
            // 高速: 閾値を50%に削減（より細かく補間）
            if (speed > FAST_SPEED) {
                return this.interpolationThreshold * 0.5;
            }
            
            // 中速: 線形補間
            const t = (speed - SLOW_SPEED) / (FAST_SPEED - SLOW_SPEED);
            return this.interpolationThreshold * (1.0 - t * 0.5);
        }
        
        /**
         * Phase 6.5: 線形補間（Phase 7で傾きデータ継承）
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
         * Phase 7: 速度適応補間ポイント生成
         * 2点間の距離が閾値を超える場合、速度に応じて中間点を生成
         */
        _generateInterpolatedPoints(p1, p2) {
            const distance = this._calculateDistance(p1, p2);
            const speed = this._calculateSpeed(p1, p2);
            
            // Phase 7: 速度適応閾値取得
            const threshold = this._getAdaptiveThreshold(speed);
            
            // 閾値以下なら補間不要
            if (distance <= threshold) {
                return [];
            }
            
            // 必要な分割数を計算
            const steps = Math.min(
                Math.ceil(distance / threshold),
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
            
            // Phase 7: 速度履歴リセット
            this.speedHistory = [];
            
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
                // Phase 6.5: 傾きデータ保持（将来Phase用）
                tiltX: tiltX,
                tiltY: tiltY,
                twist: twist
            };
            
            // Phase 7: 補間処理（速度適応）
            if (this.interpolationEnabled && this.currentPoints.length > 0) {
                const lastPoint = this.currentPoints[this.currentPoints.length - 1];
                const interpolated = this._generateInterpolatedPoints(lastPoint, point);
                
                // Phase 7: 速度履歴記録
                if (this.adaptiveSpeed) {
                    const speed = this._calculateSpeed(lastPoint, point);
                    this.speedHistory.push(speed);
                    
                    // 履歴は最新10件のみ保持
                    if (this.speedHistory.length > 10) {
                        this.speedHistory.shift();
                    }
                }
                
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
            this.speedHistory = [];
            
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
            this.speedHistory = [];
        }
        
        /**
         * Phase 7: 統計情報取得（デバッグ用）
         */
        getStats() {
            if (!this.isRecording) {
                return null;
            }
            
            const avgSpeed = this.speedHistory.length > 0
                ? this.speedHistory.reduce((a, b) => a + b, 0) / this.speedHistory.length
                : 0;
            
            return {
                pointCount: this.currentPoints.length,
                duration: Date.now() - this.startTime,
                averageSpeed: avgSpeed.toFixed(2),
                speedHistory: [...this.speedHistory]
            };
        }
    }

    window.StrokeRecorder = StrokeRecorder;

    console.log('✅ stroke-recorder.js Phase 7 loaded');
    console.log('   ✅ 速度適応補間実装（高速ストローク対応）');
    console.log('   ✅ 補間閾値: 2.5px（Phase 6.5: 5.0px → 最適化）');
    console.log('   ✅ 最大分割数: 15（Phase 6.5: 10 → 増加）');
    console.log('   ✅ ペン入力カエルの卵完全対策');
    console.log('   ⚙️ 速度履歴記録・適応処理実装');

})();