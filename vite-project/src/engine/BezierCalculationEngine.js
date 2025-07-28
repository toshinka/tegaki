// src/engine/BezierCalculationEngine.js

export class BezierCalculationEngine {
    constructor() {
        this.config = {
            smoothing: 0.5,
            minDistance: 2,
            maxDistance: 50,
            baseWidth: 2,
            pressureSensitivity: 1.0
        };
        this.currentStroke = [];
        this.lastPoint = null;
    }

    setToolConfig(config) {
        this.config = { ...this.config, ...config };
    }

    // 新しい点を追加し、軌跡データを計算
    addPoint(x, y, pressure = 1.0) {
        const point = { 
            x, 
            y, 
            pressure: Math.max(0.1, Math.min(1.0, pressure)), // 筆圧を0.1-1.0に正規化
            timestamp: Date.now() 
        };

        // 最初の点の場合
        if (this.currentStroke.length === 0) {
            this.currentStroke.push(point);
            this.lastPoint = point;
            return null; // まだ描画データなし
        }

        // 距離チェック
        const distance = this.calculateDistance(this.lastPoint, point);
        if (distance < this.config.minDistance) {
            return null; // 点が近すぎる場合はスキップ
        }

        this.currentStroke.push(point);
        this.lastPoint = point;

        // 2点以上で軌跡セグメントを計算
        if (this.currentStroke.length >= 2) {
            return this.calculateSegment();
        }

        return null;
    }

    // 軌跡セグメントを計算
    calculateSegment() {
        if (this.currentStroke.length < 2) return null;

        try {
            const optimizedPoints = this.optimizePoints(this.currentStroke);
            const smoothPath = this.generateSmoothPath(optimizedPoints);
            const widths = this.calculateWidths(optimizedPoints);

            // 描画エンジンに渡すための純粋なデータオブジェクト
            return {
                points: smoothPath,
                controlPoints: this.generateControlPoints(smoothPath),
                widths: widths,
                timestamp: Date.now(),
                toolType: 'bezier'
            };
        } catch (error) {
            console.error('Failed to calculate segment:', error);
            return null;
        }
    }

    // 最終的な軌跡を完成させる
    finalizePath() {
        if (this.currentStroke.length === 0) return null;

        try {
            const finalPath = this.calculateSegment();
            this.currentStroke = []; // ストロークをリセット
            this.lastPoint = null;
            return finalPath;
        } catch (error) {
            console.error('Failed to finalize path:', error);
            this.currentStroke = [];
            this.lastPoint = null;
            return null;
        }
    }

    // 点の最適化・単純化
    optimizePoints(points) {
        if (points.length <= 2) return [...points];

        const optimized = [points[0]]; // 最初の点は必ず含める
        
        for (let i = 1; i < points.length - 1; i++) {
            const prev = points[i - 1];
            const current = points[i];
            const next = points[i + 1];
            
            // 角度変化をチェック
            const angle1 = Math.atan2(current.y - prev.y, current.x - prev.x);
            const angle2 = Math.atan2(next.y - current.y, next.x - current.x);
            const angleDiff = Math.abs(angle2 - angle1);
            
            // 角度変化が小さい場合は点を間引く
            if (angleDiff > 0.1) {
                optimized.push(current);
            }
        }
        
        optimized.push(points[points.length - 1]); // 最後の点は必ず含める
        return optimized;
    }

    // 滑らかな軌跡を生成
    generateSmoothPath(points) {
        if (points.length <= 2) return [...points];

        const smoothPath = [];
        
        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[Math.max(0, i - 1)];
            const p1 = points[i];
            const p2 = points[i + 1];
            const p3 = points[Math.min(points.length - 1, i + 2)];
            
            // Catmull-Rom スプライン補間
            const segments = this.interpolateCatmullRom(p0, p1, p2, p3, 10);
            smoothPath.push(...segments);
        }
        
        return smoothPath;
    }

    // Catmull-Rom スプライン補間
    interpolateCatmullRom(p0, p1, p2, p3, numSegments) {
        const segments = [];
        
        for (let i = 0; i <= numSegments; i++) {
            const t = i / numSegments;
            const t2 = t * t;
            const t3 = t2 * t;
            
            const x = 0.5 * (
                (2 * p1.x) +
                (-p0.x + p2.x) * t +
                (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
                (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
            );
            
            const y = 0.5 * (
                (2 * p1.y) +
                (-p0.y + p2.y) * t +
                (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
                (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
            );
            
            // 筆圧も補間
            const pressure = p1.pressure + (p2.pressure - p1.pressure) * t;
            
            segments.push({ x, y, pressure });
        }
        
        return segments;
    }

    // 制御点を生成（ベジエ曲線用）
    generateControlPoints(points) {
        if (points.length < 3) return [];

        const controlPoints = [];
        
        for (let i = 1; i < points.length - 1; i++) {
            const prev = points[i - 1];
            const current = points[i];
            const next = points[i + 1];
            
            // 制御点を計算
            const cp1x = current.x - (next.x - prev.x) * this.config.smoothing * 0.25;
            const cp1y = current.y - (next.y - prev.y) * this.config.smoothing * 0.25;
            const cp2x = current.x + (next.x - prev.x) * this.config.smoothing * 0.25;
            const cp2y = current.y + (next.y - prev.y) * this.config.smoothing * 0.25;
            
            controlPoints.push({
                cp1: { x: cp1x, y: cp1y },
                cp2: { x: cp2x, y: cp2y }
            });
        }
        
        return controlPoints;
    }

    // 筆圧に基づく線幅計算
    calculateWidths(points) {
        return points.map(point => {
            const basePressure = point.pressure || 1.0;
            const pressureEffect = Math.pow(basePressure, this.config.pressureSensitivity);
            return Math.max(0.5, pressureEffect * this.config.baseWidth);
        });
    }

    // 2点間の距離を計算
    calculateDistance(p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // 現在の設定を取得
    getConfig() {
        return { ...this.config };
    }

    // ストロークをリセット
    reset() {
        this.currentStroke = [];
        this.lastPoint = null;
    }

    // 現在のストローク情報を取得
    getCurrentStrokeInfo() {
        return {
            pointCount: this.currentStroke.length,
            lastPoint: this.lastPoint ? { ...this.lastPoint } : null
        };
    }
}