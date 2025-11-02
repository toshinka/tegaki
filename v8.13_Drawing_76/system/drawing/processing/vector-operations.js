/**
 * VectorOperations - ベクター幾何演算ユーティリティ (Phase 0)
 * 
 * 役割: ストローク消去に必要な幾何学計算を提供
 * 依存: なし（純粋な数学関数）
 * 座標系: ワールド座標で統一
 */

(function() {
    'use strict';

    class VectorOperations {
        /**
         * 点と線分間の距離を計算
         * @param {Object} point - {x, y}
         * @param {Object} segStart - 線分開始点 {x, y}
         * @param {Object} segEnd - 線分終了点 {x, y}
         * @returns {number} 距離
         */
        static pointToSegmentDistance(point, segStart, segEnd) {
            const x = point.x, y = point.y;
            const x1 = segStart.x, y1 = segStart.y;
            const x2 = segEnd.x, y2 = segEnd.y;

            const dx = x2 - x1;
            const dy = y2 - y1;
            const lenSq = dx * dx + dy * dy;

            if (lenSq === 0) {
                return Math.hypot(x - x1, y - y1);
            }

            let t = ((x - x1) * dx + (y - y1) * dy) / lenSq;
            t = Math.max(0, Math.min(1, t));

            const projX = x1 + t * dx;
            const projY = y1 + t * dy;

            return Math.hypot(x - projX, y - projY);
        }

        /**
         * 円とストローク（ポイント列）の交差判定
         * @param {Object} center - 円の中心 {x, y}
         * @param {number} radius - 円の半径
         * @param {Array} points - ストロークのポイント配列 [{x, y, ...}, ...]
         * @returns {boolean} 交差有無
         */
        static testCircleStrokeIntersection(center, radius, points) {
            if (!Array.isArray(points) || points.length === 0) {
                return false;
            }

            // 単独点の場合
            if (points.length === 1) {
                const dx = points[0].x - center.x;
                const dy = points[0].y - center.y;
                return Math.sqrt(dx * dx + dy * dy) <= radius;
            }

            // 複数点の場合：各線分に対して判定
            for (let i = 0; i < points.length - 1; i++) {
                const dist = this.pointToSegmentDistance(
                    center,
                    points[i],
                    points[i + 1]
                );
                if (dist <= radius) {
                    return true;
                }
            }

            return false;
        }

        /**
         * ストロークを円で分割
         * 円との交差領域を除去し、残りの部分を複数のセグメントに分割
         * 
         * @param {Array} points - ストロークのポイント配列 [{x, y, ...}, ...]
         * @param {Object} center - 消しゴム中心 {x, y}
         * @param {number} radius - 消しゴム半径
         * @param {number} minLength - セグメントの最小ポイント数
         * @returns {Array} 分割されたセグメント配列 [[point, point, ...], ...]
         */
        static splitStrokeByCircle(points, center, radius, minLength = 2) {
            if (!Array.isArray(points) || points.length === 0) {
                return [];
            }

            // 単独点: 円に含まれるかチェック
            if (points.length === 1) {
                const dx = points[0].x - center.x;
                const dy = points[0].y - center.y;
                if (Math.sqrt(dx * dx + dy * dy) <= radius) {
                    return []; // 消去
                }
                return [points];
            }

            const segments = [];
            let currentSegment = [];

            for (let i = 0; i < points.length; i++) {
                const p = points[i];
                const dx = p.x - center.x;
                const dy = p.y - center.y;
                const distToCenter = Math.sqrt(dx * dx + dy * dy);
                const isInside = distToCenter <= radius;

                if (!isInside) {
                    // 円外: セグメントに追加
                    currentSegment.push(p);
                } else {
                    // 円内: セグメント境界
                    if (currentSegment.length >= minLength) {
                        segments.push(currentSegment);
                    }
                    currentSegment = [];
                }
            }

            // 最後のセグメントを追加
            if (currentSegment.length >= minLength) {
                segments.push(currentSegment);
            }

            return segments;
        }

        /**
         * ストロークの総長を計算
         * @param {Array} points - ストロークのポイント配列 [{x, y}, ...]
         * @returns {number} 総距離
         */
        static calculateStrokeLength(points) {
            if (!Array.isArray(points) || points.length < 2) {
                return 0;
            }

            let totalLength = 0;
            for (let i = 1; i < points.length; i++) {
                const dx = points[i].x - points[i - 1].x;
                const dy = points[i].y - points[i - 1].y;
                totalLength += Math.sqrt(dx * dx + dy * dy);
            }

            return totalLength;
        }

        /**
         * 線分と円の交点を計算
         * @param {Object} segStart - 線分開始点 {x, y}
         * @param {Object} segEnd - 線分終了点 {x, y}
         * @param {Object} center - 円の中心 {x, y}
         * @param {number} radius - 円の半径
         * @returns {Array} 交点配列 [{x, y}, ...] (0, 1, または2個)
         */
        static lineSegmentCircleIntersection(segStart, segEnd, center, radius) {
            const x1 = segStart.x, y1 = segStart.y;
            const x2 = segEnd.x, y2 = segEnd.y;
            const cx = center.x, cy = center.y;

            const dx = x2 - x1;
            const dy = y2 - y1;
            const fx = x1 - cx;
            const fy = y1 - cy;

            const a = dx * dx + dy * dy;
            const b = 2 * (fx * dx + fy * dy);
            const c = (fx * fx + fy * fy) - (radius * radius);

            const discriminant = b * b - 4 * a * c;

            if (discriminant < 0 || a === 0) {
                return [];
            }

            const sqrtDisc = Math.sqrt(discriminant);
            const t1 = (-b - sqrtDisc) / (2 * a);
            const t2 = (-b + sqrtDisc) / (2 * a);

            const intersections = [];

            if (t1 >= 0 && t1 <= 1) {
                intersections.push({
                    x: x1 + t1 * dx,
                    y: y1 + t1 * dy
                });
            }

            if (t2 >= 0 && t2 <= 1 && Math.abs(t2 - t1) > 1e-6) {
                intersections.push({
                    x: x1 + t2 * dx,
                    y: y1 + t2 * dy
                });
            }

            return intersections;
        }

        /**
         * 点と点の距離
         * @param {Object} p1 - {x, y}
         * @param {Object} p2 - {x, y}
         * @returns {number} 距離
         */
        static distance(p1, p2) {
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            return Math.sqrt(dx * dx + dy * dy);
        }

        /**
         * バウンディングボックスの交差判定
         * @param {Object} box1 - {x, y, width, height}
         * @param {Object} box2 - {x, y, width, height}
         * @returns {boolean} 交差有無
         */
        static boxIntersect(box1, box2) {
            return (
                box1.x < box2.x + box2.width &&
                box1.x + box1.width > box2.x &&
                box1.y < box2.y + box2.height &&
                box1.y + box1.height > box2.y
            );
        }
    }

    window.TegakiDrawing = window.TegakiDrawing || {};
    window.TegakiDrawing.VectorOperations = VectorOperations;

})();