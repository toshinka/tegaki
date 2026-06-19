/**
 * polygon-generator.js - Phase 1-FIX: PerfectFreehand統合（呼び出し修正版）
 * 
 * 【責務】
 * - PerfectFreehandライブラリのラッパー
 * - ポイント配列からポリゴン生成
 * - 遅延初期化対応
 * 
 * 【依存Parents】
 * - libs/perfect-freehand-1.2.0.min.js (globalThis.PerfectFreehand)
 * - config.js (TEGAKI_CONFIG.perfectFreehand)
 * 
 * 【依存Children】
 * - stroke-recorder.js (generate呼び出し)
 * 
 * 【修正内容】
 * 🔧 getStroke() → PerfectFreehand() 直接呼び出しに変更
 * 🔧 UMD形式のデフォルトエクスポートに対応
 */

(function() {
    'use strict';

    class PolygonGenerator {
        constructor() {
            this.initialized = false;
            this.enabled = false;
            this.getStroke = null;
        }

        /**
         * 初期化（遅延実行）
         */
        _doInitialize() {
            if (this.initialized) return;

            // PerfectFreehand読み込み確認
            if (typeof globalThis.PerfectFreehand !== 'function') {
                console.error('❌ [PolygonGenerator] PerfectFreehand not loaded');
                this.enabled = false;
                this.initialized = true;
                return;
            }

            // UMD形式: PerfectFreehand自体が関数
            this.getStroke = globalThis.PerfectFreehand;
            this.enabled = true;
            this.initialized = true;

            console.log('✅ [PolygonGenerator] PerfectFreehand initialized (UMD default export)');
        }

        /**
         * ポリゴン生成
         * @param {Array<{x, y, pressure}>} points - ストロークポイント
         * @param {Object} options - オプション設定
         * @returns {Float32Array} ポリゴン座標 [x1,y1, x2,y2, ...]
         */
        generate(points, options = {}) {
            if (!this.initialized) {
                this._doInitialize();
            }

            if (!this.enabled || !this.getStroke) {
                return this._createFallbackPolygon(points);
            }

            // 設定マージ
            const config = window.TEGAKI_CONFIG?.perfectFreehand || {};
            const settings = {
                size: options.size || config.size || 16,
                thinning: config.thinning ?? 0,
                smoothing: config.smoothing ?? 0,
                streamline: config.streamline ?? 0,
                easing: t => t,
                simulatePressure: false,
                start: { taper: 0, cap: true },
                end: { taper: 0, cap: true },
                last: points.length < 3
            };

            try {
                // PerfectFreehand形式: [x, y, pressure]
                const inputPoints = points.map(p => [p.x, p.y, p.pressure || 0.5]);

                // 🔧 修正: getStroke()ではなく、getStroke自体を呼び出し
                const stroke = this.getStroke(inputPoints, settings);

                if (!stroke || stroke.length < 3) {
                    console.warn('⚠️ [PolygonGenerator] Invalid polygon, using fallback');
                    return this._createFallbackPolygon(points);
                }

                // ポリゴン座標をFloat32Arrayに変換
                const polygon = new Float32Array(stroke.length * 2);
                for (let i = 0; i < stroke.length; i++) {
                    polygon[i * 2] = stroke[i][0];
                    polygon[i * 2 + 1] = stroke[i][1];
                }

                return polygon;

            } catch (error) {
                console.error('❌ [PolygonGenerator] Generation failed:', error);
                return this._createFallbackPolygon(points);
            }
        }

        /**
         * フォールバックポリゴン生成（円形）
         */
        _createFallbackPolygon(points) {
            const config = window.TEGAKI_CONFIG?.perfectFreehand || {};
            const radius = (config.size || 16) / 2;
            const segments = 16;

            const polygon = new Float32Array(segments * 2);
            const center = points[0] || { x: 0, y: 0 };

            for (let i = 0; i < segments; i++) {
                const angle = (i / segments) * Math.PI * 2;
                polygon[i * 2] = center.x + Math.cos(angle) * radius;
                polygon[i * 2 + 1] = center.y + Math.sin(angle) * radius;
            }

            return polygon;
        }
    }

    // グローバル公開
    window.PolygonGenerator = new PolygonGenerator();

})();