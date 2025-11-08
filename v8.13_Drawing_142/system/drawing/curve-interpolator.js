/**
 * CurveInterpolator - Catmull-Rom補間専用クラス (Phase 3)
 * 
 * 責務: ストローク座標配列を滑らかな曲線に補間
 * 
 * アルゴリズム: Catmull-Rom スプライン補間
 * - 各区間をN個の中間点で補間
 * - 筆圧も線形補間
 * - tiltデータも補間（将来の高度な筆圧表現用）
 * 
 * 使用方法:
 * const smoothPoints = CurveInterpolator.catmullRom(rawPoints, 0.5);
 */

class CurveInterpolator {
    /**
     * Catmull-Rom スプライン補間
     * @param {Array} points - 入力座標配列 [{x, y, pressure, tiltX?, tiltY?, twist?}, ...]
     * @param {number} tension - 張力 (0.0 = 緩い, 1.0 = 硬い) デフォルト 0.5
     * @param {number} segmentPoints - 各区間の補間点数 デフォルト 10
     * @returns {Array} 補間された座標配列
     */
    static catmullRom(points, tension = 0.5, segmentPoints = 10) {
        // 2点未満は補間不要
        if (points.length < 2) return points;
        
        // 単独点は補間不要
        if (points.length === 1) return points;
        
        const result = [];
        
        // 各区間を補間
        for (let i = 0; i < points.length - 1; i++) {
            // 制御点を取得（境界処理）
            const p0 = points[Math.max(0, i - 1)];
            const p1 = points[i];
            const p2 = points[i + 1];
            const p3 = points[Math.min(points.length - 1, i + 2)];
            
            // 区間内を補間
            for (let t = 0; t < segmentPoints; t++) {
                const s = t / segmentPoints;
                const interpolated = this._interpolatePoint(p0, p1, p2, p3, s, tension);
                result.push(interpolated);
            }
        }
        
        // 最終点を追加
        result.push(points[points.length - 1]);
        
        return result;
    }

    /**
     * 単一点の補間計算
     * @private
     */
    static _interpolatePoint(p0, p1, p2, p3, t, tension) {
        const t2 = t * t;
        const t3 = t2 * t;
        
        // X座標の補間
        const v0x = (p2.x - p0.x) * tension;
        const v1x = (p3.x - p1.x) * tension;
        
        const x = (2 * p1.x - 2 * p2.x + v0x + v1x) * t3 +
                  (-3 * p1.x + 3 * p2.x - 2 * v0x - v1x) * t2 +
                  v0x * t + p1.x;
        
        // Y座標の補間
        const v0y = (p2.y - p0.y) * tension;
        const v1y = (p3.y - p1.y) * tension;
        
        const y = (2 * p1.y - 2 * p2.y + v0y + v1y) * t3 +
                  (-3 * p1.y + 3 * p2.y - 2 * v0y - v1y) * t2 +
                  v0y * t + p1.y;
        
        // 筆圧の線形補間
        const pressure = p1.pressure + (p2.pressure - p1.pressure) * t;
        
        // tiltデータの線形補間（存在する場合）
        const result = { x, y, pressure };
        
        if (p1.tiltX !== undefined && p2.tiltX !== undefined) {
            result.tiltX = p1.tiltX + (p2.tiltX - p1.tiltX) * t;
        }
        
        if (p1.tiltY !== undefined && p2.tiltY !== undefined) {
            result.tiltY = p1.tiltY + (p2.tiltY - p1.tiltY) * t;
        }
        
        if (p1.twist !== undefined && p2.twist !== undefined) {
            result.twist = p1.twist + (p2.twist - p1.twist) * t;
        }
        
        return result;
    }

    /**
     * 適応的サンプリング（距離ベース）
     * @param {Array} points - 入力座標配列
     * @param {number} maxDistance - 最大距離 デフォルト 5px
     * @returns {Array} サンプリングされた座標配列
     */
    static adaptiveSample(points, maxDistance = 5) {
        if (points.length < 2) return points;
        
        const result = [points[0]];
        
        for (let i = 1; i < points.length; i++) {
            const prev = result[result.length - 1];
            const curr = points[i];
            
            // ユークリッド距離計算
            const dist = Math.sqrt(
                (curr.x - prev.x) ** 2 + 
                (curr.y - prev.y) ** 2
            );
            
            // 距離が閾値を超える場合、中間点を補間
            if (dist > maxDistance) {
                const steps = Math.ceil(dist / maxDistance);
                
                for (let j = 1; j < steps; j++) {
                    const t = j / steps;
                    
                    const interpolated = {
                        x: prev.x + (curr.x - prev.x) * t,
                        y: prev.y + (curr.y - prev.y) * t,
                        pressure: prev.pressure + (curr.pressure - prev.pressure) * t
                    };
                    
                    // tiltデータも補間
                    if (prev.tiltX !== undefined && curr.tiltX !== undefined) {
                        interpolated.tiltX = prev.tiltX + (curr.tiltX - prev.tiltX) * t;
                    }
                    if (prev.tiltY !== undefined && curr.tiltY !== undefined) {
                        interpolated.tiltY = prev.tiltY + (curr.tiltY - prev.tiltY) * t;
                    }
                    if (prev.twist !== undefined && curr.twist !== undefined) {
                        interpolated.twist = prev.twist + (curr.twist - prev.twist) * t;
                    }
                    
                    result.push(interpolated);
                }
            }
            
            result.push(curr);
        }
        
        return result;
    }

    /**
     * ストロークの総距離を計算（デバッグ用）
     * @param {Array} points - 座標配列
     * @returns {number} 総距離(px)
     */
    static getTotalDistance(points) {
        if (points.length < 2) return 0;
        
        let totalDistance = 0;
        for (let i = 1; i < points.length; i++) {
            const dx = points[i].x - points[i - 1].x;
            const dy = points[i].y - points[i - 1].y;
            totalDistance += Math.sqrt(dx * dx + dy * dy);
        }
        return totalDistance;
    }

    /**
     * ストロークの境界ボックスを計算（デバッグ用）
     * @param {Array} points - 座標配列
     * @returns {Object} {minX, minY, maxX, maxY, width, height}
     */
    static getBounds(points) {
        if (points.length === 0) {
            return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
        }
        
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        
        for (const point of points) {
            minX = Math.min(minX, point.x);
            minY = Math.min(minY, point.y);
            maxX = Math.max(maxX, point.x);
            maxY = Math.max(maxY, point.y);
        }
        
        return {
            minX,
            minY,
            maxX,
            maxY,
            width: maxX - minX,
            height: maxY - minY
        };
    }
}

// グローバル登録
window.CurveInterpolator = CurveInterpolator;

console.log('✅ curve-interpolator.js (Phase 3) loaded');
console.log('   - Catmull-Rom スプライン補間');
console.log('   - 適応的サンプリング対応');
console.log('   - tiltX/Y/twist データ補間対応');