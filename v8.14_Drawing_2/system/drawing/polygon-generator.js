/**
 * ================================================================================
 * system/drawing/polygon-generator.js - PerfectFreehand統合ポリゴン生成
 * ================================================================================
 * 
 * 【Phase 1 新規作成】
 * ✅ PerfectFreehand統合
 * ✅ ポリゴン生成パイプライン
 * ✅ 設定バリデーション
 * 
 * 【依存関係 - Parents】
 *   - libs/perfect-freehand-1.2.0.min.js (グローバル PerfectFreehand)
 *   - config.js (TEGAKI_CONFIG.perfectFreehand)
 * 
 * 【依存関係 - Children】
 *   - stroke-recorder.js (ポリゴン生成要求)
 * 
 * 【責務】
 *   - PerfectFreehand呼び出し
 *   - ポイント配列のフォーマット変換
 *   - ポリゴンバリデーション
 * ================================================================================
 */

(function() {
    'use strict';

    class PolygonGenerator {
        constructor() {
            this.defaultOptions = null;
            this._initialized = false;
        }

        initialize() {
            if (this._initialized) {
                console.warn('[PolygonGenerator] Already initialized');
                return;
            }

            if (typeof PerfectFreehand === 'undefined') {
                throw new Error('[PolygonGenerator] PerfectFreehand library not loaded');
            }

            const config = window.TEGAKI_CONFIG?.perfectFreehand;
            
            this.defaultOptions = {
                size: config?.size || 16,
                thinning: config?.thinning || 0.5,
                smoothing: config?.smoothing || 0.5,
                streamline: config?.streamline || 0.5,
                easing: config?.easing || (t => t),
                simulatePressure: config?.simulatePressure || false,
                start: config?.start || { taper: 0, cap: true },
                end: config?.end || { taper: 0, cap: true },
                last: false
            };

            this._initialized = true;
            console.log('✅ [PolygonGenerator] Initialized with PerfectFreehand');
        }

        /**
         * ポリゴン生成（メインAPI）
         * @param {Array} points - [{x, y, pressure}, ...]
         * @param {Object} options - PerfectFreehand設定（オプション）
         * @returns {Array} ポリゴン座標配列 [[x,y], [x,y], ...]
         */
        generate(points, options = null) {
            if (!this._initialized) {
                this.initialize();
            }

            if (!points || points.length === 0) {
                console.warn('[PolygonGenerator] Empty points array');
                return [];
            }

            // 単一点の場合
            if (points.length === 1) {
                const p = points[0];
                return this._generateCirclePolygon(p.x, p.y, this.defaultOptions.size / 2);
            }

            try {
                // フォーマット変換: {x, y, pressure} → [x, y, pressure]
                const formattedPoints = this._formatPoints(points);
                
                // PerfectFreehand設定
                const pfOptions = this._mergeOptions(options);
                
                // PerfectFreehand呼び出し
                const polygon = this._callPerfectFreehand(formattedPoints, pfOptions);
                
                // バリデーション
                if (!this._validatePolygon(polygon)) {
                    console.warn('[PolygonGenerator] Invalid polygon generated, using fallback');
                    return this._generateFallbackPolygon(points);
                }

                return polygon;

            } catch (error) {
                console.error('[PolygonGenerator] Generation failed:', error);
                return this._generateFallbackPolygon(points);
            }
        }

        /**
         * ポイント配列フォーマット変換
         * {x, y, pressure} → [x, y, pressure]
         */
        _formatPoints(points) {
            return points.map(p => [
                p.x,
                p.y,
                p.pressure !== undefined ? p.pressure : 0.5
            ]);
        }

        /**
         * PerfectFreehand設定マージ
         */
        _mergeOptions(userOptions) {
            if (!userOptions) {
                return { ...this.defaultOptions };
            }

            return {
                ...this.defaultOptions,
                ...userOptions
            };
        }

        /**
         * PerfectFreehand呼び出し
         */
        _callPerfectFreehand(formattedPoints, options) {
            // getStroke は [[x,y], [x,y], ...] を返す
            const polygon = PerfectFreehand.getStroke(formattedPoints, options);
            return polygon;
        }

        /**
         * ポリゴンバリデーション
         */
        _validatePolygon(polygon) {
            if (!Array.isArray(polygon)) {
                return false;
            }

            if (polygon.length < 3) {
                return false;
            }

            // 全ての点が [x, y] 形式か確認
            for (const point of polygon) {
                if (!Array.isArray(point) || point.length < 2) {
                    return false;
                }
                if (typeof point[0] !== 'number' || typeof point[1] !== 'number') {
                    return false;
                }
                if (!isFinite(point[0]) || !isFinite(point[1])) {
                    return false;
                }
            }

            return true;
        }

        /**
         * 円形ポリゴン生成（単一点用）
         */
        _generateCirclePolygon(x, y, radius, segments = 16) {
            const polygon = [];
            for (let i = 0; i < segments; i++) {
                const angle = (i / segments) * Math.PI * 2;
                polygon.push([
                    x + Math.cos(angle) * radius,
                    y + Math.sin(angle) * radius
                ]);
            }
            return polygon;
        }

        /**
         * フォールバック：直線ポリゴン生成
         */
        _generateFallbackPolygon(points) {
            if (points.length === 0) {
                return [];
            }

            if (points.length === 1) {
                return this._generateCirclePolygon(
                    points[0].x,
                    points[0].y,
                    this.defaultOptions.size / 2
                );
            }

            // 簡易的な太線ポリゴン生成
            const halfSize = this.defaultOptions.size / 2;
            const polygon = [];

            for (let i = 0; i < points.length - 1; i++) {
                const p1 = points[i];
                const p2 = points[i + 1];
                
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const len = Math.sqrt(dx * dx + dy * dy);
                
                if (len === 0) continue;
                
                const nx = -dy / len * halfSize;
                const ny = dx / len * halfSize;
                
                polygon.push([p1.x + nx, p1.y + ny]);
            }

            // 反対側も追加（逆順）
            for (let i = points.length - 1; i >= 0; i--) {
                const p = points[i];
                const idx = i === 0 ? 1 : i;
                const p2 = points[idx - 1];
                
                const dx = p.x - p2.x;
                const dy = p.y - p2.y;
                const len = Math.sqrt(dx * dx + dy * dy);
                
                if (len === 0) continue;
                
                const nx = -dy / len * halfSize;
                const ny = dx / len * halfSize;
                
                polygon.push([p.x - nx, p.y - ny]);
            }

            return polygon;
        }

        /**
         * デバッグ用：設定取得
         */
        getDefaultOptions() {
            return { ...this.defaultOptions };
        }
    }

    window.PolygonGenerator = new PolygonGenerator();

    console.log('✅ polygon-generator.js loaded');
    console.log('   ✓ PerfectFreehand統合');
    console.log('   ✓ ポリゴン生成パイプライン');

})();