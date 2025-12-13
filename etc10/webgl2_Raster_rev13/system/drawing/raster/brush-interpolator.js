/**
 * ================================================================
 * brush-interpolator.js - Phase 2.3: ブラシ補間システム
 * ================================================================
 * 【役割】
 * - ストロークポイント間の補間
 * - 距離ベース補間
 * - 速度適応補間
 * - 筆圧・傾き補間
 * 
 * 【親依存】
 * - config.js (補間設定)
 * 
 * 【子依存】
 * - raster-brush-core.js
 * ================================================================
 */

(function() {
    'use strict';

    class BrushInterpolator {
        constructor() {
            this.config = null;
        }

        /**
         * 初期化
         */
        initialize() {
            this.config = window.TEGAKI_CONFIG?.drawing?.interpolation || {
                enabled: true,
                threshold: 2.5,
                maxSteps: 15,
                adaptiveSpeed: true
            };
            
            console.log('✅ [BrushInterpolator] Initialized');
        }

        /**
         * 2点間を補間
         * @param {Object} p1 - 開始点 {localX, localY, pressure, tiltX, tiltY, twist, time}
         * @param {Object} p2 - 終了点
         * @param {Object} settings - ブラシ設定
         * @returns {Array<Object>} 補間ポイント配列
         */
        interpolate(p1, p2, settings = {}) {
            if (!this.config.enabled) {
                return [];
            }

            const dx = p2.localX - p1.localX;
            const dy = p2.localY - p1.localY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // 閾値未満なら補間不要
            if (distance < this.config.threshold) {
                return [];
            }
            
            // ステップ数計算
            let steps = this.calculateSteps(distance, p1, p2, settings);
            
            if (steps <= 0) {
                return [];
            }
            
            // 補間ポイント生成
            const points = [];
            for (let i = 1; i <= steps; i++) {
                const t = i / (steps + 1);
                points.push(this._interpolatePoint(p1, p2, t));
            }
            
            return points;
        }

        /**
         * ステップ数計算
         * @param {number} distance - 2点間距離
         * @param {Object} p1 - 開始点
         * @param {Object} p2 - 終了点
         * @param {Object} settings - ブラシ設定
         * @returns {number} ステップ数
         */
        calculateSteps(distance, p1, p2, settings) {
            // 基本ステップ数（距離ベース）
            let steps = Math.floor(distance / this.config.threshold);
            
            // 速度適応補間
            if (this.config.adaptiveSpeed && p1.time && p2.time) {
                const timeDelta = p2.time - p1.time;
                
                if (timeDelta > 0) {
                    const speed = distance / timeDelta; // px/ms
                    
                    // 高速時はステップ数を増やす
                    if (speed > 2.0) {
                        const speedFactor = Math.min(speed / 2.0, 2.0);
                        steps = Math.floor(steps * speedFactor);
                    }
                }
            }
            
            // ブラシサイズに応じた調整
            if (settings.size) {
                const sizeFactor = Math.max(0.5, Math.min(2.0, settings.size / 10));
                steps = Math.floor(steps * sizeFactor);
            }
            
            // 最大ステップ数制限
            steps = Math.min(steps, this.config.maxSteps);
            
            return steps;
        }

        /**
         * 単一ポイント補間
         * @param {Object} p1 - 開始点
         * @param {Object} p2 - 終了点
         * @param {number} t - 補間係数 (0.0～1.0)
         * @returns {Object} 補間ポイント
         */
        _interpolatePoint(p1, p2, t) {
            return {
                localX: this._lerp(p1.localX, p2.localX, t),
                localY: this._lerp(p1.localY, p2.localY, t),
                pressure: this._lerp(p1.pressure, p2.pressure, t),
                tiltX: this._lerp(p1.tiltX || 0, p2.tiltX || 0, t),
                tiltY: this._lerp(p1.tiltY || 0, p2.tiltY || 0, t),
                twist: this._lerp(p1.twist || 0, p2.twist || 0, t),
                time: p1.time ? this._lerp(p1.time, p2.time || p1.time, t) : undefined
            };
        }

        /**
         * 線形補間
         */
        _lerp(a, b, t) {
            return a + (b - a) * t;
        }

        /**
         * イージング補間（オプション）
         * @param {Object} p1 
         * @param {Object} p2 
         * @param {number} t 
         * @param {string} easing - 'linear', 'ease-in', 'ease-out', 'ease-in-out'
         * @returns {Object}
         */
        interpolateWithEasing(p1, p2, t, easing = 'linear') {
            let easedT = t;
            
            switch (easing) {
                case 'ease-in':
                    easedT = t * t;
                    break;
                case 'ease-out':
                    easedT = t * (2 - t);
                    break;
                case 'ease-in-out':
                    easedT = t < 0.5 
                        ? 2 * t * t 
                        : -1 + (4 - 2 * t) * t;
                    break;
                default:
                    easedT = t;
            }
            
            return this._interpolatePoint(p1, p2, easedT);
        }

        /**
         * ベジェ曲線補間（高度な補間用・将来実装）
         * @param {Array<Object>} controlPoints - 制御点配列
         * @param {number} steps - 分割数
         * @returns {Array<Object>}
         */
        interpolateBezier(controlPoints, steps) {
            // ベジェ曲線実装は将来追加
            console.warn('[BrushInterpolator] Bezier interpolation not implemented yet');
            return [];
        }

        /**
         * Catmull-Rom スプライン補間（将来実装）
         * @param {Array<Object>} points - ポイント配列
         * @param {number} tension - 張力 (0.0～1.0)
         * @returns {Array<Object>}
         */
        interpolateCatmullRom(points, tension = 0.5) {
            // Catmull-Rom実装は将来追加
            console.warn('[BrushInterpolator] Catmull-Rom interpolation not implemented yet');
            return [];
        }
    }

    // グローバル公開
    window.BrushInterpolator = new BrushInterpolator();
    
    // 自動初期化
    if (window.TEGAKI_CONFIG) {
        window.BrushInterpolator.initialize();
    }
    
    console.log('✅ brush-interpolator.js loaded');

})();