/**
 * GL Stroke Processor - Phase 3 完全版
 * 
 * 【責務】
 * - Perfect-Freehandポリゴン生成
 * - Earcut三角形分割
 * - WebGL2頂点バッファ作成
 * - 統計カウント管理
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
 * 【Phase 3 改修内容】
 * ✅ 統計カウント修正
 * ✅ config.js設定参照改善
 * ✅ エラーハンドリング強化
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
                // Perfect-Freehand確認
                if (typeof window.getStroke === 'undefined') {
                    console.error('[GLStrokeProcessor] Perfect-Freehand not loaded');
                    return false;
                }

                // Earcut確認
                if (typeof window.earcut === 'undefined') {
                    console.error('[GLStrokeProcessor] Earcut not loaded');
                    return false;
                }

                this.initialized = true;
                return true;

            } catch (error) {
                console.error('[GLStrokeProcessor] Initialization error:', error);
                return false;
            }
        }

        /**
         * ストロークポイントからポリゴン頂点バッファ生成
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
                // config.js設定取得
                const config = window.TEGAKI_CONFIG?.perfectFreehand || {
                    size: baseSize,
                    thinning: 0.5,
                    smoothing: 0.05,
                    streamline: 0.05,
                    simulatePressure: false,
                    last: true,
                    start: { taper: 0, cap: true },
                    end: { taper: 0, cap: true }
                };

                // ポイントフォーマット変換
                const formattedPoints = points.map(p => [
                    p.x !== undefined ? p.x : (p.localX || 0),
                    p.y !== undefined ? p.y : (p.localY || 0),
                    p.pressure !== undefined ? p.pressure : 0.5
                ]);

                // Perfect-Freehandでポリゴン生成
                const outlinePoints = window.getStroke(formattedPoints, {
                    ...config,
                    size: baseSize
                });

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

                for (let i = 0; i < outlinePoints.length; i++) {
                    const x = outlinePoints[i][0];
                    const y = outlinePoints[i][1];
                    flatCoords.push(x, y);

                    bounds.minX = Math.min(bounds.minX, x);
                    bounds.minY = Math.min(bounds.minY, y);
                    bounds.maxX = Math.max(bounds.maxX, x);
                    bounds.maxY = Math.max(bounds.maxY, y);
                }

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

    console.log(' ✅ gl-stroke-processor.js Phase 3 完全版 loaded');
    console.log('    ✅ Perfect-Freehand統合');
    console.log('    ✅ Earcut三角形分割');
    console.log('    ✅ 統計カウント修正');

})();