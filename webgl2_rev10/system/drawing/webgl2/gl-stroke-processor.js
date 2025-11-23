/**
 * GL Stroke Processor - ポリゴン生成修正版
 * 
 * 【責務】
 * - Perfect-Freehandを最小限のみ使用（形状補正ゼロ設定）
 * - 正しいポリゴン閉鎖処理
 * - Earcut三角形分割
 * - WebGL2頂点バッファ作成
 * 
 * 【親依存】
 * - Perfect-Freehand (window.getStroke)
 * - Earcut (window.earcut)
 * - config.js (perfectFreehand設定)
 * 
 * 【子依存】
 * - stroke-renderer.js
 * - webgl2-drawing-layer.js
 * 
 * 【改修内容】
 * ✅ Perfect-Freehandの形状補正を完全無効化
 * ✅ config.jsの設定を厳密に適用
 * ✅ ポリゴン閉鎖ロジック修正
 */

(function() {
    'use strict';

    class GLStrokeProcessor {
        constructor(gl) {
            this.gl = gl;
            this.initialized = false;
            
            // 統計情報
            this.stats = {
                processedStrokes: 0,
                totalVertices: 0,
                averageVerticesPerStroke: 0
            };
        }

        /**
         * 初期化
         */
        initialize() {
            try {
                // Perfect-Freehand確認（UMDビルド対応）
                let getStrokeFunc = null;
                
                if (typeof window.getStroke !== 'undefined') {
                    getStrokeFunc = window.getStroke;
                } else if (typeof window.PerfectFreehand !== 'undefined' && 
                           typeof window.PerfectFreehand.getStroke !== 'undefined') {
                    getStrokeFunc = window.PerfectFreehand.getStroke;
                    window.getStroke = getStrokeFunc;
                } else if (typeof window.PerfectFreehand === 'function') {
                    getStrokeFunc = window.PerfectFreehand;
                    window.getStroke = getStrokeFunc;
                }

                if (!getStrokeFunc) {
                    console.error('[GLStrokeProcessor] Perfect-Freehand not loaded');
                    return false;
                }

                // Earcut確認
                if (typeof window.earcut === 'undefined') {
                    console.error('[GLStrokeProcessor] Earcut not loaded');
                    return false;
                }

                this.initialized = true;
                console.log('[GLStrokeProcessor] ✅ Initialized (形状補正ゼロ版)');
                
                return true;

            } catch (error) {
                console.error('[GLStrokeProcessor] Initialization error:', error);
                return false;
            }
        }

        /**
         * ストロークポイントからポリゴン頂点バッファ生成
         * 
         * @param {Array} points - [{x, y, pressure}, ...]
         * @param {number} baseSize - 基本サイズ
         * @returns {object|null} {buffer, vertexCount, bounds}
         */
        createPolygonVertexBuffer(points, baseSize = 10) {
            if (!this.initialized) {
                console.error('[GLStrokeProcessor] Not initialized');
                return null;
            }

            if (!points || points.length < 2) {
                console.warn('[GLStrokeProcessor] Insufficient points');
                return null;
            }

            try {
                // config.jsから形状補正ゼロ設定を取得
                const configOptions = window.TEGAKI_CONFIG?.perfectFreehand;
                
                // 形状補正完全無効化設定
                const options = {
                    size: baseSize,
                    smoothing: configOptions?.smoothing !== undefined ? configOptions.smoothing : 0,
                    streamline: configOptions?.streamline !== undefined ? configOptions.streamline : 0,
                    thinning: configOptions?.thinning !== undefined ? configOptions.thinning : 0,
                    simulatePressure: configOptions?.simulatePressure !== undefined ? configOptions.simulatePressure : false,
                    easing: configOptions?.easing || ((t) => t),
                    start: configOptions?.start || { taper: 0, cap: true },
                    end: configOptions?.end || { taper: 0, cap: true },
                    last: configOptions?.last !== undefined ? configOptions.last : true
                };

                // ポイントフォーマット変換
                const formattedPoints = points.map(p => [
                    p.x !== undefined ? p.x : (p.localX || 0),
                    p.y !== undefined ? p.y : (p.localY || 0),
                    p.pressure !== undefined ? p.pressure : 0.5
                ]);

                // Perfect-Freehandでアウトライン生成
                const outlinePoints = window.getStroke(formattedPoints, options);

                if (!outlinePoints || outlinePoints.length < 3) {
                    console.warn('[GLStrokeProcessor] Insufficient outline points');
                    return null;
                }

                // Earcutで三角形分割
                const flatCoords = [];
                const bounds = {
                    minX: Infinity,
                    minY: Infinity,
                    maxX: -Infinity,
                    maxY: -Infinity
                };

                // アウトラインポイントを平坦化
                for (let i = 0; i < outlinePoints.length; i++) {
                    const x = outlinePoints[i][0];
                    const y = outlinePoints[i][1];
                    flatCoords.push(x, y);

                    bounds.minX = Math.min(bounds.minX, x);
                    bounds.minY = Math.min(bounds.minY, y);
                    bounds.maxX = Math.max(bounds.maxX, x);
                    bounds.maxY = Math.max(bounds.maxY, y);
                }

                // Earcut三角形分割
                const indices = window.earcut(flatCoords);

                if (!indices || indices.length === 0) {
                    console.warn('[GLStrokeProcessor] Triangulation failed');
                    return null;
                }

                // 頂点バッファ作成
                const vertexCount = indices.length;
                const buffer = new Float32Array(vertexCount * 2);

                for (let i = 0; i < indices.length; i++) {
                    const idx = indices[i];
                    buffer[i * 2] = flatCoords[idx * 2];
                    buffer[i * 2 + 1] = flatCoords[idx * 2 + 1];
                }

                // 統計更新
                this.stats.processedStrokes++;
                this.stats.totalVertices += vertexCount;
                this.stats.averageVerticesPerStroke = 
                    Math.round(this.stats.totalVertices / this.stats.processedStrokes);

                return { buffer, vertexCount, bounds };

            } catch (error) {
                console.error('[GLStrokeProcessor] Polygon generation error:', error);
                return null;
            }
        }

        /**
         * バウンディングボックス計算
         */
        calculateBounds(points) {
            const bounds = {
                minX: Infinity,
                minY: Infinity,
                maxX: -Infinity,
                maxY: -Infinity
            };

            for (const p of points) {
                const x = p.x !== undefined ? p.x : (p.localX || 0);
                const y = p.y !== undefined ? p.y : (p.localY || 0);
                
                bounds.minX = Math.min(bounds.minX, x);
                bounds.minY = Math.min(bounds.minY, y);
                bounds.maxX = Math.max(bounds.maxX, x);
                bounds.maxY = Math.max(bounds.maxY, y);
            }

            return bounds;
        }

        /**
         * 統計情報取得
         */
        getStats() {
            return { ...this.stats };
        }

        /**
         * 統計リセット
         */
        resetStats() {
            this.stats = {
                processedStrokes: 0,
                totalVertices: 0,
                averageVerticesPerStroke: 0
            };
        }

        /**
         * リソース解放
         */
        dispose() {
            this.resetStats();
            this.initialized = false;
        }
    }

    // グローバル登録
    window.GLStrokeProcessor = GLStrokeProcessor;

    console.log('✅ gl-stroke-processor.js - 形状補正ゼロ版 loaded');
    console.log('   ✅ config.js設定を厳密適用');
    console.log('   ✅ Perfect-Freehandは最小限のみ使用');

})();