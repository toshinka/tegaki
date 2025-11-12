/**
 * ================================================================================
 * polygon-generator.js - Phase 1完全修正版
 * ================================================================================
 * 
 * 【責務】
 * PerfectFreehandを使用した滑らかなポリゴン生成
 * 
 * 【依存Parents】
 * - libs/perfect-freehand-1.2.0.min.js (UMD形式)
 * 
 * 【依存Children】
 * - stroke-recorder.js (ポリゴン生成要求)
 * 
 * 【修正内容】
 * ✅ PerfectFreehand.default.getStroke()の正しい参照
 * ✅ フォールバック削除（エラー時は空配列返却）
 * ✅ 設定の最適化（リニアで滑らかなストローク）
 * 
 * ================================================================================
 */

(function() {
    'use strict';

    /**
     * ポリゴンジェネレーター
     * PerfectFreehandでストロークポイント配列からポリゴンを生成
     */
    class PolygonGenerator {
        constructor() {
            this.perfectFreehand = null;
            this.initialize();
        }

        /**
         * PerfectFreehand初期化
         */
        initialize() {
            // UMD形式: globalThis.PerfectFreehand.default が実体
            if (typeof PerfectFreehand !== 'undefined') {
                this.perfectFreehand = PerfectFreehand.default || PerfectFreehand;
                console.log('✅ [PolygonGenerator] PerfectFreehand initialized');
            } else {
                console.error('❌ [PolygonGenerator] PerfectFreehand not found');
            }
        }

        /**
         * ポリゴン生成
         * @param {Array} points - [{x, y, pressure}]
         * @param {Object} options - 生成オプション
         * @returns {Array} polygon - [[x,y], [x,y], ...]
         */
        generate(points, options = {}) {
            if (!this.perfectFreehand) {
                console.error('[PolygonGenerator] PerfectFreehand not available');
                return [];
            }

            if (!points || points.length === 0) {
                return [];
            }

            try {
                // PerfectFreehand用にフォーマット変換
                const pfPoints = points.map(p => [p.x, p.y, p.pressure || 0.5]);

                // 設定の統合
                const settings = this._getSettings(options);

                // ポリゴン生成（正しい参照）
                const polygon = this.perfectFreehand.getStroke 
                    ? this.perfectFreehand.getStroke(pfPoints, settings)
                    : this.perfectFreehand(pfPoints, settings);

                return this._validatePolygon(polygon);

            } catch (error) {
                console.error('[PolygonGenerator] Generation failed:', error);
                return [];
            }
        }

        /**
         * PerfectFreehand設定取得
         * @private
         */
        _getSettings(options) {
            const config = window.TEGAKI_CONFIG?.perfectFreehand || {};
            
            return {
                // サイズ（ブラシサイズベース）
                size: options.size || config.size || 16,
                
                // テーパリング（リニアな描画のため最小化）
                thinning: options.thinning ?? config.thinning ?? 0.2,
                
                // スムージング（滑らかさ）
                smoothing: options.smoothing ?? config.smoothing ?? 0.5,
                
                // ストリームライン（遅延補正）
                streamline: options.streamline ?? config.streamline ?? 0.3,
                
                // イージング（線形）
                easing: options.easing || config.easing || (t => t),
                
                // 筆圧シミュレーション無効（外部で管理）
                simulatePressure: false,
                
                // 始点・終点の処理
                start: {
                    taper: options.startTaper ?? config.start?.taper ?? 0,
                    cap: options.startCap ?? config.start?.cap ?? true
                },
                end: {
                    taper: options.endTaper ?? config.end?.taper ?? 0,
                    cap: options.endCap ?? config.end?.cap ?? true
                },
                
                // 最後の点を保持
                last: options.last ?? config.last ?? true
            };
        }

        /**
         * ポリゴン検証
         * @private
         */
        _validatePolygon(polygon) {
            if (!Array.isArray(polygon) || polygon.length < 3) {
                return [];
            }

            // 各点が[x, y]形式か確認
            const valid = polygon.every(p => 
                Array.isArray(p) && 
                p.length === 2 && 
                typeof p[0] === 'number' && 
                typeof p[1] === 'number'
            );

            return valid ? polygon : [];
        }
    }

    // グローバル公開
    window.PolygonGenerator = new PolygonGenerator();

    console.log('✅ polygon-generator.js Phase 1完全修正版 loaded');
    console.log('   ✓ PerfectFreehand正しい参照');
    console.log('   ✓ リニア設定最適化');
    console.log('   ✓ フォールバック削除');

})();