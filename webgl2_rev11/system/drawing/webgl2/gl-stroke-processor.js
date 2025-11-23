/**
 * GL Stroke Processor - Phase 3.6B 完全独自リボン版
 * 
 * 【責務】
 * - Perfect-Freehand完全不使用
 * - 独自オフセット曲線生成
 * - 筆圧ベースの入り抜き処理
 * - Earcut三角形分割
 * - WebGL2頂点バッファ作成
 * 
 * 【親依存】
 * - Earcut (window.earcut)
 * - config.js (基本設定のみ)
 * 
 * 【子依存】
 * - stroke-renderer.js
 * - webgl2-drawing-layer.js
 * 
 * 【Phase 3.6B 改修内容】
 * ✅ Perfect-Freehand完全バイパス
 * ✅ 独自オフセット曲線生成（法線計算）
 * ✅ 筆圧による自然な入り抜き
 * ✅ ラウンドキャップ処理
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
                // Earcut確認
                if (typeof window.earcut === 'undefined') {
                    console.error('[GLStrokeProcessor] Earcut not loaded');
                    return false;
                }

                this.initialized = true;
                console.log('[GLStrokeProcessor] ✅ Phase 3.6B Initialized');
                console.log('   🔥 Perfect-Freehand完全不使用');
                console.log('   🎨 独自リボン生成実装');
                
                return true;

            } catch (error) {
                console.error('[GLStrokeProcessor] Initialization error:', error);
                return false;
            }
        }

        /**
         * ストロークポイントからポリゴン頂点バッファ生成
         * Phase 3.6B: 完全独自リボン実装
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
                // 座標を正規化
                const normalizedPoints = points.map(p => ({
                    x: p.x !== undefined ? p.x : (p.localX || 0),
                    y: p.y !== undefined ? p.y : (p.localY || 0),
                    pressure: p.pressure !== undefined ? p.pressure : 0.5
                }));

                // 🎨 独自リボン生成
                const polygon = this._generateRibbon(normalizedPoints, baseSize);

                if (!polygon || polygon.length < 6) {
                    console.warn('[GLStrokeProcessor] Ribbon generation failed');
                    return null;
                }

                // バウンディングボックス計算
                const bounds = this._calculateBoundsFromPolygon(polygon);

                // Earcut三角形分割
                const indices = window.earcut(polygon);

                if (!indices || indices.length === 0) {
                    console.warn('[GLStrokeProcessor] Triangulation failed');
                    return null;
                }

                // 頂点バッファ作成
                const vertexCount = indices.length;
                const buffer = new Float32Array(vertexCount * 2);

                for (let i = 0; i < indices.length; i++) {
                    const idx = indices[i];
                    buffer[i * 2] = polygon[idx * 2];
                    buffer[i * 2 + 1] = polygon[idx * 2 + 1];
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
         * Phase 3.6B: 独自リボン生成（修正版）
         * 
         * @param {Array} points - 正規化されたポイント
         * @param {number} baseSize - 基本サイズ
         * @returns {Array} 平坦化されたポリゴン座標 [x1, y1, x2, y2, ...]
         */
        _generateRibbon(points, baseSize) {
            const leftEdge = [];
            const rightEdge = [];

            // 各ポイントに対してオフセット計算
            for (let i = 0; i < points.length; i++) {
                const p = points[i];
                // 🔧 最小筆圧を保証（マウス対応）
                const pressure = Math.max(0.1, p.pressure);
                const radius = (baseSize / 2) * pressure;

                // 法線ベクトル計算
                const normal = this._calculateNormal(points, i);

                // 左右エッジ座標
                leftEdge.push({
                    x: p.x + normal.x * radius,
                    y: p.y + normal.y * radius
                });

                rightEdge.push({
                    x: p.x - normal.x * radius,
                    y: p.y - normal.y * radius
                });
            }

            // 🔧 始点と終点が近い場合（閉じた図形）の検出
            const isClosedShape = this._isClosedShape(points);

            // ポリゴン組み立て
            const polygon = [];

            if (isClosedShape) {
                // 🎨 閉じた図形の場合：キャップなし
                // 左エッジ
                for (const p of leftEdge) {
                    polygon.push(p.x, p.y);
                }

                // 右エッジ（逆順）
                for (let i = rightEdge.length - 1; i >= 0; i--) {
                    polygon.push(rightEdge[i].x, rightEdge[i].y);
                }
            } else {
                // 🎨 開いた線の場合：キャップあり
                const startPressure = Math.max(0.1, points[0].pressure);
                const endPressure = Math.max(0.1, points[points.length - 1].pressure);

                // 始点のラウンドキャップ
                const startCap = this._generateRoundCap(
                    points[0],
                    leftEdge[0],
                    rightEdge[0],
                    (baseSize / 2) * startPressure,
                    8
                );

                // 終点のラウンドキャップ
                const endCap = this._generateRoundCap(
                    points[points.length - 1],
                    rightEdge[rightEdge.length - 1],
                    leftEdge[leftEdge.length - 1],
                    (baseSize / 2) * endPressure,
                    8
                );

                // 始点キャップ
                for (const p of startCap) {
                    polygon.push(p.x, p.y);
                }

                // 左エッジ
                for (const p of leftEdge) {
                    polygon.push(p.x, p.y);
                }

                // 終点キャップ
                for (const p of endCap) {
                    polygon.push(p.x, p.y);
                }

                // 右エッジ（逆順）
                for (let i = rightEdge.length - 1; i >= 0; i--) {
                    polygon.push(rightEdge[i].x, rightEdge[i].y);
                }
            }

            return polygon;
        }

        /**
         * 閉じた図形かどうかを判定
         * 
         * @param {Array} points - ポイント配列
         * @returns {boolean}
         */
        _isClosedShape(points) {
            if (points.length < 4) return false;

            const start = points[0];
            const end = points[points.length - 1];
            
            // 始点と終点の距離
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // 距離が基本サイズの2倍以下なら閉じた図形とみなす
            return distance < 20; // 固定閾値（調整可能）
        }

        /**
         * 法線ベクトル計算
         * 
         * @param {Array} points - ポイント配列
         * @param {number} index - 現在のインデックス
         * @returns {object} {x, y} 正規化された法線ベクトル
         */
        _calculateNormal(points, index) {
            let dx = 0, dy = 0;

            if (index === 0 && points.length > 1) {
                // 最初のポイント: 次のポイントへの方向
                dx = points[1].x - points[0].x;
                dy = points[1].y - points[0].y;
            } else if (index === points.length - 1) {
                // 最後のポイント: 前のポイントからの方向
                dx = points[index].x - points[index - 1].x;
                dy = points[index].y - points[index - 1].y;
            } else {
                // 中間ポイント: 前後の平均方向
                dx = points[index + 1].x - points[index - 1].x;
                dy = points[index + 1].y - points[index - 1].y;
            }

            // 長さを計算
            const length = Math.sqrt(dx * dx + dy * dy) || 1;

            // 90度回転して正規化（法線ベクトル）
            return {
                x: -dy / length,
                y: dx / length
            };
        }

        /**
         * ラウンドキャップ生成
         * 
         * @param {object} center - 中心点
         * @param {object} start - 開始エッジ点
         * @param {object} end - 終了エッジ点
         * @param {number} radius - 半径
         * @param {number} segments - セグメント数
         * @returns {Array} キャップポイント配列
         */
        _generateRoundCap(center, start, end, radius, segments) {
            const cap = [];

            // 開始角度と終了角度を計算
            const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
            const endAngle = Math.atan2(end.y - center.y, end.x - center.x);

            // 角度差を計算（反時計回り）
            let angleDiff = endAngle - startAngle;
            if (angleDiff < 0) angleDiff += Math.PI * 2;
            if (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

            // セグメントごとにポイント生成
            for (let i = 0; i <= segments; i++) {
                const t = i / segments;
                const angle = startAngle + angleDiff * t;
                
                cap.push({
                    x: center.x + Math.cos(angle) * radius,
                    y: center.y + Math.sin(angle) * radius
                });
            }

            return cap;
        }

        /**
         * ポリゴンからバウンディングボックス計算
         */
        _calculateBoundsFromPolygon(polygon) {
            const bounds = {
                minX: Infinity,
                minY: Infinity,
                maxX: -Infinity,
                maxY: -Infinity
            };

            for (let i = 0; i < polygon.length; i += 2) {
                bounds.minX = Math.min(bounds.minX, polygon[i]);
                bounds.minY = Math.min(bounds.minY, polygon[i + 1]);
                bounds.maxX = Math.max(bounds.maxX, polygon[i]);
                bounds.maxY = Math.max(bounds.maxY, polygon[i + 1]);
            }

            return bounds;
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

    console.log('✅ gl-stroke-processor.js Phase 3.6B loaded');
    console.log('   🔥 Perfect-Freehand完全不使用');
    console.log('   🎨 独自リボン生成（オフセット曲線）');
    console.log('   ✅ 筆圧による自然な入り抜き');
    console.log('   ✅ ラウンドキャップ実装');

})();