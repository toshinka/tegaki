// OGLMathEnhancer.js - 数学処理修正版（線品質・補間アルゴリズム強化）
export class OGLMathEnhancer {
    constructor(oglEngine) {
        this.engine = oglEngine;
        this.setupMathConstants();
        this.setupInterpolationCache();
        this.setupVectorUtils();
    }
    
    // 数学定数・設定
    setupMathConstants() {
        this.EPSILON = 1e-6;
        this.PI2 = Math.PI * 2;
        this.DEG_TO_RAD = Math.PI / 180;
        this.RAD_TO_DEG = 180 / Math.PI;
        
        // 🔧 修正: 線品質改善のための定数
        this.interpolation = {
            BEZIER_PRECISION: 0.01,      // ベジェ曲線精度
            CATMULL_ROM_TENSION: 0.5,    // Catmull-Rom張力
            ADAPTIVE_THRESHOLD: 2.0,     // 適応的補間閾値
            MIN_SEGMENT_LENGTH: 0.8,     // 最小セグメント長
            MAX_SEGMENT_LENGTH: 8.0,     // 最大セグメント長
            VELOCITY_DAMPING: 0.85       // 速度減衰係数
        };
        
        // 🆕 液タブ対応定数
        this.tabletConstants = {
            PRESSURE_CURVE_POWER: 1.2,   // 筆圧カーブ指数
            TILT_INFLUENCE: 0.3,         // チルト影響係数
            VELOCITY_SENSITIVITY: 0.15,  // 速度感度
            DISTANCE_THRESHOLD: 5.0      // 距離閾値
        };
    }
    
    // 補間キャッシュシステム（パフォーマンス最適化）
    setupInterpolationCache() {
        this.cache = {
            bezierPoints: new Map(),
            distances: new Map(),
            normals: new Map(),
            maxSize: 100
        };
    }
    
    // ベクトルユーティリティ
    setupVectorUtils() {
        this.vec2 = {
            create: (x = 0, y = 0) => ({ x, y }),
            distance: (a, b) => Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2),
            normalize: (v) => {
                const len = Math.sqrt(v.x * v.x + v.y * v.y);
                return len > this.EPSILON ? { x: v.x / len, y: v.y / len } : { x: 0, y: 0 };
            },
            dot: (a, b) => a.x * b.x + a.y * b.y,
            lerp: (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }),
            perpendicular: (v) => ({ x: -v.y, y: v.x })
        };
    }
    
    // 🔧 修正: 高品質Catmull-Rom補間（モール化防止の核心）
    catmullRomInterpolation(points, segments = 10) {
        if (points.length < 2) return points;
        if (points.length === 2) return this.linearInterpolation(points[0], points[1], segments);
        
        const result = [points[0]];
        const tension = this.interpolation.CATMULL_ROM_TENSION;
        
        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[Math.max(0, i - 1)];
            const p1 = points[i];
            const p2 = points[i + 1];
            const p3 = points[Math.min(points.length - 1, i + 2)];
            
            // 🔧 修正: 適応的セグメント数（距離ベース）
            const distance = this.vec2.distance(p1, p2);
            const adaptiveSegments = Math.max(2, Math.min(segments, 
                Math.floor(distance / this.interpolation.MIN_SEGMENT_LENGTH)));
            
            for (let t = 1; t <= adaptiveSegments; t++) {
                const u = t / adaptiveSegments;
                const u2 = u * u;
                const u3 = u2 * u;
                
                // Catmull-Rom基底関数
                const b0 = -tension * u3 + 2 * tension * u2 - tension * u;
                const b1 = (2 - tension) * u3 + (tension - 3) * u2 + 1;
                const b2 = (tension - 2) * u3 + (3 - 2 * tension) * u2 + tension * u;
                const b3 = tension * u3 - tension * u2;
                
                const point = {
                    x: b0 * p0.x + b1 * p1.x + b2 * p2.x + b3 * p3.x,
                    y: b0 * p0.y + b1 * p1.y + b2 * p2.y + b3 * p3.y,
                    pressure: this.interpolatePressure(p1.pressure, p2.pressure, u),
                    timestamp: p1.timestamp + (p2.timestamp - p1.timestamp) * u
                };
                
                result.push(point);
            }
        }
        
        return result;
    }
    
    // 🔧 修正: 適応的ベジェ補間（毛虫化防止）
    adaptiveBezierInterpolation(p1, p2, controlStrength = 0.3) {
        const distance = this.vec2.distance(p1, p2);
        
        // 🔧 修正: 距離が短い場合は線形補間
        if (distance < this.interpolation.MIN_SEGMENT_LENGTH) {
            return [p2];
        }
        
        // キャッシュ確認
        const cacheKey = `${p1.x},${p1.y}-${p2.x},${p2.y}-${controlStrength}`;
        if (this.cache.bezierPoints.has(cacheKey)) {
            return this.cache.bezierPoints.get(cacheKey);
        }
        
        // 制御点計算
        const midPoint = this.vec2.lerp(p1, p2, 0.5);
        const direction = this.vec2.normalize({ x: p2.x - p1.x, y: p2.y - p1.y });
        const perpendicular = this.vec2.perpendicular(direction);
        
        // 🔧 修正: 制御点の配置を速度ベースで調整
        const controlOffset = distance * controlStrength * 0.25; // より控えめに
        const control1 = {
            x: p1.x + direction.x * distance * 0.25 + perpendicular.x * controlOffset,
            y: p1.y + direction.y * distance * 0.25 + perpendicular.y * controlOffset
        };
        const control2 = {
            x: p2.x - direction.x * distance * 0.25 - perpendicular.x * controlOffset,
            y: p2.y - direction.y * distance * 0.25 - perpendicular.y * controlOffset
        };
        
        // 🔧 修正: 適応的分割数
        const segments = Math.max(2, Math.min(8, Math.floor(distance / 3)));
        const result = [];
        
        for (let i = 1; i <= segments; i++) {
            const t = i / segments;
            const point = this.cubicBezier(p1, control1, control2, p2, t);
            point.pressure = this.interpolatePressure(p1.pressure, p2.pressure, t);
            point.timestamp = p1.timestamp + (p2.timestamp - p1.timestamp) * t;
            result.push(point);
        }
        
        // キャッシュ保存
        if (this.cache.bezierPoints.size < this.cache.maxSize) {
            this.cache.bezierPoints.set(cacheKey, result);
        }
        
        return result;
    }
    
    // 3次ベジェ曲線計算
    cubicBezier(p0, p1, p2, p3, t) {
        const u = 1 - t;
        const u2 = u * u;
        const u3 = u2 * u;
        const t2 = t * t;
        const t3 = t2 * t;
        
        return {
            x: u3 * p0.x + 3 * u2 * t * p1.x + 3 * u * t2 * p2.x + t3 * p3.x,
            y: u3 * p0.y + 3 * u2 * t * p1.y + 3 * u * t2 * p2.y + t3 * p3.y
        };
    }
    
    // 線形補間（短距離用）
    linearInterpolation(p1, p2, segments = 2) {
        const result = [];
        for (let i = 1; i <= segments; i++) {
            const t = i / segments;
            result.push({
                x: p1.x + (p2.x - p1.x) * t,
                y: p1.y + (p2.y - p1.y) * t,
                pressure: this.interpolatePressure(p1.pressure, p2.pressure, t),
                timestamp: p1.timestamp + (p2.timestamp - p1.timestamp) * t
            });
        }
        return result;
    }
    
    // 🔧 修正: 高品質筆圧補間
    interpolatePressure(p1, p2, t) {
        // より自然な筆圧変化のための3次補間
        const smoothT = this.smoothStep(t);
        return p1 + (p2 - p1) * smoothT;
    }
    
    // スムーズステップ関数
    smoothStep(t) {
        return t * t * (3 - 2 * t);
    }
    
    // 🆕 速度ベース補間選択（適応的アルゴリズム）
    selectOptimalInterpolation(p1, p2, velocity = 0) {
        const distance = this.vec2.distance(p1, p2);
        
        // 🔧 修正: 速度と距離に基づく最適補間選択
        if (distance < this.interpolation.MIN_SEGMENT_LENGTH) {
            return 'none'; //補間不要
        } else if (distance > this.interpolation.MAX_SEGMENT_LENGTH) {
            if (velocity > this.interpolation.ADAPTIVE_THRESHOLD) {
                return 'linear'; // 高速時は線形補間
            } else {
                return 'catmull'; // 低速時はCatmull-Rom
            }
        } else if (velocity < 0.5) {
            return 'bezier'; // 極低速時はベジェ
        } else {
            return 'linear'; // デフォルトは線形
        }
    }
    
    // 🆕 液タブ対応筆圧計算
    calculateTabletPressureResponse(pressure, velocity = 0, tilt = null) {
        // 基本筆圧カーブ
        const basePressure = Math.pow(
            Math.max(0.05, Math.min(1.0, pressure)), 
            this.tabletConstants.PRESSURE_CURVE_POWER
        );
        
        // 速度補正
        const velocityFactor = 1.0 - (velocity * this.tabletConstants.VELOCITY_SENSITIVITY);
        const velocityAdjusted = basePressure * Math.max(0.3, velocityFactor);
        
        // チルト補正（利用可能な場合）
        if (tilt && (tilt.x !== undefined || tilt.y !== undefined)) {
            const tiltMagnitude = Math.sqrt((tilt.x || 0) ** 2 + (tilt.y || 0) ** 2);
            const tiltFactor = 1.0 + (tiltMagnitude * this.tabletConstants.TILT_INFLUENCE);
            return velocityAdjusted * tiltFactor;
        }
        
        return velocityAdjusted;
    }
    
    // 🔧 修正: 高品質線分簡素化（Douglas-Peucker改良版）
    simplifyPath(points, tolerance = 1.0) {
        if (points.length <= 2) return points;
        
        const simplified = this.douglasPeuckerSimplify(points, tolerance);
        
        // 🔧 修正: 最小点数保証（品質維持）
        if (simplified.length < Math.max(2, points.length * 0.3)) {
            return this.adaptiveSimplify(points, tolerance * 0.5);
        }
        
        return simplified;
    }
    
            // Douglas-Peucker アルゴリズム
    douglasPeuckerSimplify(points, tolerance) {
        if (points.length <= 2) return points;
        
        let maxDistance = 0;
        let maxIndex = 0;
        const start = points[0];
        const end = points[points.length - 1];
        
        // 最も遠い点を見つける
        for (let i = 1; i < points.length - 1; i++) {
            const distance = this.pointToLineDistance(points[i], start, end);
            if (distance > maxDistance) {
                maxDistance = distance;
                maxIndex = i;
            }
        }
        
        // 許容値を超える場合は分割して再帰
        if (maxDistance > tolerance) {
            const left = this.douglasPeuckerSimplify(points.slice(0, maxIndex + 1), tolerance);
            const right = this.douglasPeuckerSimplify(points.slice(maxIndex), tolerance);
            return left.slice(0, -1).concat(right);
        }
        
        return [start, end];
    }
    
    // 適応的簡素化（フォールバック）
    adaptiveSimplify(points, tolerance) {
        const result = [points[0]];
        let lastPoint = points[0];
        
        for (let i = 1; i < points.length; i++) {
            const currentPoint = points[i];
            const distance = this.vec2.distance(lastPoint, currentPoint);
            
            if (distance > tolerance || i === points.length - 1) {
                result.push(currentPoint);
                lastPoint = currentPoint;
            }
        }
        
        return result;
    }
    
    // 点から線分への距離計算
    pointToLineDistance(point, lineStart, lineEnd) {
        const dx = lineEnd.x - lineStart.x;
        const dy = lineEnd.y - lineStart.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length < this.EPSILON) {
            return this.vec2.distance(point, lineStart);
        }
        
        const t = Math.max(0, Math.min(1, ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (length * length)));
        const projection = {
            x: lineStart.x + t * dx,
            y: lineStart.y + t * dy
        };
        
        return this.vec2.distance(point, projection);
    }
    
    // 🆕 速度平滑化（液タブ対応）
    smoothVelocity(velocityHistory, smoothingFactor = 0.7) {
        if (velocityHistory.length === 0) return 0;
        if (velocityHistory.length === 1) return velocityHistory[0];
        
        let smoothed = velocityHistory[0];
        for (let i = 1; i < velocityHistory.length; i++) {
            smoothed = smoothed * smoothingFactor + velocityHistory[i] * (1 - smoothingFactor);
        }
        
        return smoothed;
    }
    
    // 🔧 修正: 角度ベース法線計算（品質向上）
    calculateSegmentNormals(p1, p2, p3 = null) {
        let direction;
        
        if (p3) {
            // 3点を使った滑らかな法線計算
            const d1 = this.vec2.normalize({ x: p2.x - p1.x, y: p2.y - p1.y });
            const d2 = this.vec2.normalize({ x: p3.x - p2.x, y: p3.y - p2.y });
            direction = this.vec2.normalize({ x: d1.x + d2.x, y: d1.y + d2.y });
        } else {
            // 2点の法線
            direction = this.vec2.normalize({ x: p2.x - p1.x, y: p2.y - p1.y });
        }
        
        return this.vec2.perpendicular(direction);
    }
    
    // 🆕 曲率計算（品質評価用）
    calculateCurvature(p1, p2, p3) {
        const a = this.vec2.distance(p1, p2);
        const b = this.vec2.distance(p2, p3);
        const c = this.vec2.distance(p1, p3);
        
        if (a < this.EPSILON || b < this.EPSILON || c < this.EPSILON) return 0;
        
        // 三角形の面積から曲率を計算
        const s = (a + b + c) / 2;
        const area = Math.sqrt(Math.max(0, s * (s - a) * (s - b) * (s - c)));
        
        return (4 * area) / (a * b * c);
    }
    
    // 🔧 修正: 筆圧レスポンス関数（自然なカーブ）
    calculatePressureResponse(pressure, penSize = 1.0, sensitivity = 0.5) {
        const normalizedPressure = Math.max(0.1, Math.min(1.0, pressure));
        
        // より自然な筆圧カーブ（S字カーブ）
        const sCurve = this.smoothStep(normalizedPressure);
        const curve = Math.pow(sCurve, 0.8);
        
        return penSize * (0.3 + curve * sensitivity * 1.4);
    }
    
    // 🆕 ストローク品質評価
    evaluateStrokeQuality(points) {
        if (points.length < 3) return { score: 1.0, issues: [] };
        
        const issues = [];
        let totalCurvature = 0;
        let maxVelocityChange = 0;
        let densityVariation = 0;
        
        // 曲率とバリエーション分析
        for (let i = 1; i < points.length - 1; i++) {
            const curvature = this.calculateCurvature(points[i - 1], points[i], points[i + 1]);
            totalCurvature += curvature;
            
            if (curvature > 0.5) {
                issues.push(`High curvature at point ${i}`);
            }
        }
        
        // 密度バリエーション分析
        const distances = [];
        for (let i = 1; i < points.length; i++) {
            distances.push(this.vec2.distance(points[i - 1], points[i]));
        }
        
        const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
        densityVariation = distances.reduce((max, d) => Math.max(max, Math.abs(d - avgDistance)), 0) / avgDistance;
        
        if (densityVariation > 2.0) {
            issues.push('High density variation (potential segmented appearance)');
        }
        
        // 品質スコア計算
        const curvatureScore = Math.max(0, 1 - totalCurvature / points.length);
        const densityScore = Math.max(0, 1 - densityVariation / 3);
        const overallScore = (curvatureScore + densityScore) / 2;
        
        return {
            score: overallScore,
            issues: issues,
            avgCurvature: totalCurvature / (points.length - 2),
            densityVariation: densityVariation
        };
    }
    
    // 🆕 最適化レコメンデーション
    getOptimizationRecommendations(strokeQuality) {
        const recommendations = [];
        
        if (strokeQuality.avgCurvature > 0.3) {
            recommendations.push({
                parameter: 'smoothingFactor',
                adjustment: 'increase',
                reason: 'High curvature detected'
            });
        }
        
        if (strokeQuality.densityVariation > 1.5) {
            recommendations.push({
                parameter: 'minDistance',
                adjustment: 'increase',
                reason: 'High density variation'
            });
        }
        
        return recommendations;
    }
    
    // キャッシュクリア
    clearCache() {
        Object.values(this.cache).forEach(cache => {
            if (cache instanceof Map) cache.clear();
        });
    }
    
    // 統計情報取得
    getCacheStats() {
        return {
            bezierPoints: this.cache.bezierPoints.size,
            distances: this.cache.distances.size,
            normals: this.cache.normals.size,
            maxSize: this.cache.maxSize
        };
    }
    
    // 🆕 パフォーマンス最適化
    optimizeForPerformance(pointCount) {
        // 点数に基づく動的最適化
        if (pointCount > 1000) {
            this.interpolation.ADAPTIVE_THRESHOLD *= 1.5;
            this.interpolation.MIN_SEGMENT_LENGTH *= 1.2;
        } else if (pointCount < 100) {
            this.interpolation.ADAPTIVE_THRESHOLD *= 0.8;
            this.interpolation.MIN_SEGMENT_LENGTH *= 0.9;
        }
    }
    
    // デバッグ情報
    getDebugInfo() {
        return {
            constants: { ...this.interpolation },
            tabletConstants: { ...this.tabletConstants },
            cacheStats: this.getCacheStats()
        };
    }
}