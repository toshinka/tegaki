/**
 * ================================================================================
 * polygon-generator.js Phase 1完全版 - UMD形式対応
 * ================================================================================
 * 
 * 📁 依存Parents:
 *   - libs/perfect-freehand-1.2.0.min.js (UMD: globalThis.PerfectFreehand)
 *   - config.js (TEGAKI_CONFIG.perfectFreehand)
 *   - brush-settings.js (現在のブラシサイズ取得)
 * 
 * 📄 依存Children:
 *   - stroke-recorder.js (generate()呼出)
 * 
 * 🔧 Phase 1改修:
 *   - UMD形式対応（getStrkeがデフォルトエクスポート）
 *   - 遅延初期化
 *   - PerfectFreehand安全な参照
 * ================================================================================
 */

(function() {
    'use strict';

    class PolygonGenerator {
        constructor() {
            this.config = window.TEGAKI_CONFIG?.perfectFreehand || {};
            this.enabled = false;
            this.getStroke = null;
            this.initialized = false;
            
            // 即座に初期化を試みるが、失敗しても続行
            this._tryInitialize();
        }

        /**
         * 初期化を試みる（失敗しても続行）
         * @private
         */
        _tryInitialize() {
            try {
                this._doInitialize();
            } catch (error) {
                console.warn('[PolygonGenerator] Initial initialization failed, will retry on generate()');
            }
        }

        /**
         * 実際の初期化処理（UMD形式対応）
         * @private
         */
        _doInitialize() {
            // PerfectFreehand取得（複数パターン対応）
            const PerfectFreehand = 
                (typeof globalThis !== 'undefined' && globalThis.PerfectFreehand) ||
                (typeof window !== 'undefined' && window.PerfectFreehand) ||
                null;
            
            if (!PerfectFreehand) {
                throw new Error('PerfectFreehand not found');
            }
            
            // UMD形式の判定
            // パターン1: PerfectFreehand自体がgetStroke関数
            // パターン2: PerfectFreehand.getStrkeが関数
            // パターン3: PerfectFreehand.defaultがgetStroke関数
            
            if (typeof PerfectFreehand === 'function') {
                // UMDデフォルトエクスポート: PerfectFreehand自体がgetStroke
                this.getStroke = PerfectFreehand.bind(null);
                console.log('✅ [PolygonGenerator] PerfectFreehand initialized (UMD default export)');
            } else if (typeof PerfectFreehand.getStroke === 'function') {
                // 名前付きエクスポート
                this.getStroke = PerfectFreehand.getStroke.bind(PerfectFreehand);
                console.log('✅ [PolygonGenerator] PerfectFreehand initialized (named export)');
            } else if (typeof PerfectFreehand.default === 'function') {
                // ES Moduleデフォルトエクスポート
                this.getStroke = PerfectFreehand.default.bind(PerfectFreehand);
                console.log('✅ [PolygonGenerator] PerfectFreehand initialized (ES Module default)');
            } else {
                throw new Error('PerfectFreehand.getStroke is not a function');
            }
            
            this.enabled = this.config.enabled !== false;
            this.initialized = true;
        }

        /**
         * 初期化状態を確認し、必要なら再初期化
         * @private
         */
        _ensureInitialized() {
            if (this.initialized && this.getStroke) {
                return true;
            }
            
            try {
                this._doInitialize();
                return true;
            } catch (error) {
                console.error('❌ [PolygonGenerator] Initialization failed:', error.message);
                return false;
            }
        }

        /**
         * ポイント配列からポリゴン生成
         * @param {Array} points - [{x, y, pressure}]
         * @param {Object} options - オプション設定
         * @returns {Array} - [x, y, x, y, ...] flat polygon array
         */
        generate(points, options = {}) {
            // 初期化確認（遅延初期化）
            if (!this._ensureInitialized()) {
                console.warn('[PolygonGenerator] Not initialized, using fallback');
                return this._fallbackPolygon(points);
            }
            
            if (!this.enabled || !points || points.length === 0) {
                return this._fallbackPolygon(points);
            }

            try {
                // ブラシサイズを動的取得
                const brushSize = this._getCurrentBrushSize();
                
                // PerfectFreehand設定構築
                const settings = this._buildSettings(brushSize, options);
                
                // ポイントフォーマット変換
                const formattedPoints = this._formatPoints(points);
                
                // PerfectFreehand実行
                const polygon = this.getStroke(formattedPoints, settings);
                
                // 検証
                if (!this._validatePolygon(polygon)) {
                    console.warn('⚠️ [PolygonGenerator] Invalid polygon, using fallback');
                    return this._fallbackPolygon(points);
                }
                
                return polygon;
                
            } catch (error) {
                console.error('❌ [PolygonGenerator] Generation failed:', error);
                return this._fallbackPolygon(points);
            }
        }

        /**
         * 現在のブラシサイズを取得
         * @returns {number}
         * @private
         */
        _getCurrentBrushSize() {
            // brush-settings.js から取得を試みる
            if (window.brushSettings && typeof window.brushSettings.getSize === 'function') {
                return window.brushSettings.getSize();
            }
            
            // フォールバック: config.jsのデフォルト値
            return this.config.size || 16;
        }

        /**
         * PerfectFreehand設定構築
         * @param {number} brushSize - ブラシサイズ
         * @param {Object} options - 追加オプション
         * @returns {Object}
         * @private
         */
        _buildSettings(brushSize, options) {
            const baseSettings = {
                // ブラシサイズ（動的）
                size: brushSize,
                
                // リニア設定（config.jsから）
                thinning: this.config.thinning ?? 0,
                smoothing: this.config.smoothing ?? 0,
                streamline: this.config.streamline ?? 0,
                
                // 圧力設定
                simulatePressure: this.config.simulatePressure ?? false,
                
                // イージング
                easing: this.config.easing || (t => t),
                
                // 始点・終点
                start: this.config.start || { taper: 0, cap: true },
                end: this.config.end || { taper: 0, cap: true }
            };
            
            // オプションでオーバーライド
            return { ...baseSettings, ...options };
        }

        /**
         * ポイントフォーマット変換
         * @param {Array} points - [{x, y, pressure}]
         * @returns {Array} - [[x, y, pressure], ...]
         * @private
         */
        _formatPoints(points) {
            return points.map(p => [
                p.x,
                p.y,
                p.pressure !== undefined ? p.pressure : 0.5
            ]);
        }

        /**
         * ポリゴン検証
         * @param {Array} polygon
         * @returns {boolean}
         * @private
         */
        _validatePolygon(polygon) {
            if (!Array.isArray(polygon)) return false;
            if (polygon.length < 6) return false; // 最小3点（x,y × 3）
            if (polygon.length % 2 !== 0) return false; // 偶数個必須
            if (polygon.some(v => !isFinite(v))) return false; // NaN/Infinity除外
            return true;
        }

        /**
         * フォールバックポリゴン生成
         * @param {Array} points
         * @returns {Array}
         * @private
         */
        _fallbackPolygon(points) {
            if (!points || points.length === 0) {
                return [];
            }
            
            // シンプルな円形ポリゴン生成
            const firstPoint = points[0];
            const radius = 8;
            const segments = 16;
            const polygon = [];
            
            for (let i = 0; i < segments; i++) {
                const angle = (i / segments) * Math.PI * 2;
                polygon.push(
                    firstPoint.x + Math.cos(angle) * radius,
                    firstPoint.y + Math.sin(angle) * radius
                );
            }
            
            return polygon;
        }
    }

    // シングルトンインスタンス作成
    window.PolygonGenerator = new PolygonGenerator();

    console.log('✅ polygon-generator.js Phase 1完全版 loaded');
    console.log('   ✓ UMD形式対応');
    console.log('   ✓ 遅延初期化対応');

})();
