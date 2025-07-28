// src/engine/BezierCalculationEngine.js

export class BezierCalculationEngine {
    constructor() {
        this.config = {
            smoothing: 0.5,
            minDistance: 1,  // より小さい値に変更
            maxDistance: 50,
            baseWidth: 2,
            pressureSensitivity: 1.0
        };
        this.currentStroke = [];
        this.lastPoint = null;
        this.totalDistance = 0;
    }

    setToolConfig(config) {
        this.config = { ...this.config, ...config };
        console.log('Tool config updated:', this.config);
    }

    // 新しい点を追加し、軌跡データを計算
    addPoint(x, y, pressure = 1.0) {
        const point = { 
            x, 
            y, 
            pressure: Math.max(0.1, Math.min(1.0, pressure)), 
            timestamp: Date.now() 
        };

        // 最初の点の場合
        if (this.currentStroke.length === 0) {
            this.currentStroke.push(point);
            this.lastPoint = point;
            this.totalDistance = 0;
            
            // 最初の点でも小さな線分を描画するために、同じ点を少しずらして追加
            const startSegment = {
                points: [point, { ...point, x: point.x + 0.1, y: point.y + 0.1 }],
                controlPoints: [],
                widths: [this.calculateWidth(point.pressure), this.calculateWidth(point.pressure)],
                timestamp: Date.now(),
                toolType: 'bezier'
            };
            return startSegment;
        }

        // 距離チェック（より緩和）
        const distance = this.calculateDistance(this.lastPoint, point);
        this.totalDistance += distance;
        
        // 最小距離チェックを緩和
        if (distance < this.config.minDistance && this.currentStroke.length > 1) {
            return null;
        }

        this.currentStroke.push(point);
        this.lastPoint = point;

        // 2点以上で軌跡セグメントを計算
        return this.calculateSegment();
    }

    // 軌跡セグメントを計算（リアルタイム描画用）
    calculateSegment() {
        if (this.currentStroke.length < 2) return null;

        try {
            // 最新の数点のみを使用してセグメントを生成
            const recentPoints = this.currentStroke.slice(-4); // 最新4点を使用
            const smoothPath = this.generateSmoothPath(recentPoints);
            const widths = this.calculateWidths(smoothPath);

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
            // 全体のストロークを使用して最終パスを生成
            const optimizedPoints = this.optimizePoints(this.currentStroke);
            const smoothPath = this.generateSmoothPath(optimizedPoints);
            const widths = this.calculateWidths(smoothPath);

            const finalPath = {
                points: smoothPath,
                controlPoints: this.generateControlPoints(smoothPath),
                widths: widths,
                timestamp: Date.now(),
                toolType: 'bezier'
            };
            
            this.reset();
            return finalPath;
        } catch (error) {
            console.error('Failed to finalize path:', error);
            this.reset();
            return null;
        }
    }

    // 点の最適化・単純化（改善版）
    optimizePoints(points) {
        if (points.length <= 2) return [...points];

        const optimized = [points[0]];
        
        for (let i = 1; i < points.length - 1; i++) {
            const prev = points[i - 1];
            const current = points[i];
            const next = points[i + 1];
            
            // 距離チェック
            const dist1 = this.calculateDistance(prev, current);
            const dist2 = this.calculateDistance(current, next);
            
            // 角度変化をチェック
            const angle1 = Math.atan2(current.y - prev.y, current.x - prev.x);
            const angle2 = Math.atan2(next.y - current.y, next.x - current.x);
            const angleDiff = Math.abs(angle2 - angle1);
            
            // より寛容な条件で点を保持
            if (angleDiff > 0.05 || dist1 > 3 || dist2 > 3) {
                optimized.push(current);
            }
        }
        
        optimized.push(points[points.length - 1]);
        return optimized;
    }

    // 滑らかな軌跡を生成（改善版）
    generateSmoothPath(points) {
        if (points.length <= 2) return [...points];

        const smoothPath = [points[0]]; // 最初の点を追加
        
        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[Math.max(0, i - 1)];
            const p1 = points[i];
            const p2 = points[i + 1];
            const p3 = points[Math.min(points.length - 1, i + 2)];
            
            // セグメント数を動的に調整
            const distance = this.calculateDistance(p1, p2);
            const segments = Math.max(2, Math.min(8, Math.floor(distance / 3)));
            
            // Catmull-Rom スプライン補間
            const interpolated = this.interpolateCatmullRom(p0, p1, p2, p3, segments);
            
            // 最初の点以外を追加（重複を避ける）
            smoothPath.push(...interpolated.slice(1));
        }
        
        return smoothPath;
    }

    // Catmull-Rom スプライン補間（改善版）
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
            
            // 筆圧も線形補間
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
            
            // より滑らかな制御点を計算
            const cp1x = current.x - (next.x - prev.x) * this.config.smoothing * 0.2;
            const cp1y = current.y - (next.y - prev.y) * this.config.smoothing * 0.2;
            const cp2x = current.x + (next.x - prev.x) * this.config.smoothing * 0.2;
            const cp2y = current.y + (next.y - prev.y) * this.config.smoothing * 0.2;
            
            controlPoints.push({
                cp1: { x: cp1x, y: cp1y },
                cp2: { x: cp2x, y: cp2y }
            });
        }
        
        return controlPoints;
    }

    // 筆圧に基づく線幅計算（改善版）
    calculateWidths(points) {
        return points.map((point, index) => {
            const basePressure = point.pressure || 1.0;
            
            // 筆圧効果を強調
            const pressureEffect = Math.pow(basePressure, this.config.pressureSensitivity);
            
            // 線の開始と終了で細くする効果
            const tapering = this.calculateTapering(index, points.length);
            
            return Math.max(0.5, pressureEffect * this.config.baseWidth * tapering);
        });
    }

    // 単一の点の線幅を計算
    calculateWidth(pressure) {
        const basePressure = pressure || 1.0;
        const pressureEffect = Math.pow(basePressure, this.config.pressureSensitivity);
        return Math.max(0.5, pressureEffect * this.config.baseWidth);
    }

    // テーパリング効果を計算
    calculateTapering(index, totalPoints) {
        if (totalPoints <= 3) return 1.0;
        
        const startTaper = 3; // 開始部分のテーパリング範囲
        const endTaper = 3;   // 終了部分のテーパリング範囲
        
        let taper = 1.0;
        
        // 開始部分のテーパリング
        if (index < startTaper) {
            taper = Math.min(taper, (index + 1) / startTaper);
        }
        
        // 終了部分のテーパリング
        if (index >= totalPoints - endTaper) {
            const fromEnd = totalPoints - index;
            taper = Math.min(taper, fromEnd / endTaper);
        }
        
        return Math.max(0.3, taper); // 最小値を設定
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
        this.totalDistance = 0;
    }

    // 現在のストローク情報を取得
    getCurrentStrokeInfo() {
        return {
            pointCount: this.currentStroke.length,
            totalDistance: this.totalDistance,
            lastPoint: this.lastPoint ? { ...this.lastPoint } : null
        };
    }
}