// Phase2: OGL統一数学計算専門ファイル (封印化対象・不可触)
import * as math from 'mathjs';

export class OGLMathEnhancer {
    constructor(oglEngine) {
        this.engine = oglEngine;
        this.setupMathConstants();
        this.setupBezierCalculation();
        this.setupInterpolationSystems();
    }
    
    // 数学定数・設定
    setupMathConstants() {
        this.BEZIER_PRECISION = 0.1;
        this.SMOOTH_THRESHOLD = 0.5;
        this.CURVE_TENSION = 0.5;
        this.INTERPOLATION_STEPS = 10;
        
        // mathjs設定
        this.mathConfig = {
            precision: 64,
            predictable: true
        };
        
        // 数値計算用の閾値
        this.EPSILON = 1e-10;
        this.MAX_ITERATIONS = 100;
    }
    
    // OGL統一ベジェ曲線計算システム (Bezier.js完全代替)
    setupBezierCalculation() {
        this.bezierCache = new Map();
        this.controlPointsBuffer = [];
    }
    
    // 補間システム初期化
    setupInterpolationSystems() {
        this.interpolationMethods = {
            linear: this.linearInterpolation.bind(this),
            quadratic: this.quadraticInterpolation.bind(this),
            cubic: this.cubicInterpolation.bind(this),
            catmullRom: this.catmullRomInterpolation.bind(this),
            bezier: this.bezierInterpolation.bind(this)
        };
    }
    
    // OGL統一ベジェスムージング (mathjs活用・Bezier.js完全排除)
    applySmoothingToPoints(points, smoothingFactor = 0.5) {
        if (!points || points.length < 3) return points;
        
        const smoothedPoints = [points[0]]; // 最初の点は保持
        
        for (let i = 1; i < points.length - 1; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            const next = points[i + 1];
            
            // mathjs matrix計算でベジェ補間
            const controlMatrix = math.matrix([
                [prev.x, prev.y],
                [curr.x, curr.y],
                [next.x, next.y]
            ]);
            
            // ベジェ重み計算
            const weights = math.matrix([
                0.25 * smoothingFactor,
                0.5,
                0.25 * smoothingFactor
            ]);
            
            // 行列積で補間点計算
            const result = math.multiply(math.transpose(controlMatrix), weights);
            const resultArray = result.toArray();
            
            const smoothed = {
                x: resultArray[0],
                y: resultArray[1],
                pressure: curr.pressure,
                timestamp: curr.timestamp
            };
            
            smoothedPoints.push(smoothed);
        }
        
        if (points.length > 1) {
            smoothedPoints.push(points[points.length - 1]); // 最後の点は保持
        }
        
        return smoothedPoints;
    }
    
    // 高精度ベジェ曲線生成 (mathjs完全活用)
    generateBezierCurve(controlPoints, resolution = 50) {
        if (controlPoints.length < 4) return controlPoints;
        
        const cacheKey = this.generateCacheKey(controlPoints, resolution);
        if (this.bezierCache.has(cacheKey)) {
            return this.bezierCache.get(cacheKey);
        }
        
        const curve = [];
        const n = controlPoints.length - 1;
        
        for (let t = 0; t <= 1; t += 1 / resolution) {
            let x = 0, y = 0, pressure = 0;
            
            for (let i = 0; i <= n; i++) {
                const binomial = this.calculateBinomialCoefficient(n, i);
                const bernstein = binomial * Math.pow(1 - t, n - i) * Math.pow(t, i);
                
                x += bernstein * controlPoints[i].x;
                y += bernstein * controlPoints[i].y;
                pressure += bernstein * controlPoints[i].pressure;
            }
            
            curve.push({ x, y, pressure, t });
        }
        
        this.bezierCache.set(cacheKey, curve);
        return curve;
    }
    
    // 二項係数計算 (mathjs活用)
    calculateBinomialCoefficient(n, k) {
        if (k > n) return 0;
        if (k === 0 || k === n) return 1;
        
        // mathjs factorial使用
        const nFactorial = math.factorial(n);
        const kFactorial = math.factorial(k);
        const nkFactorial = math.factorial(n - k);
        
        return math.divide(nFactorial, math.multiply(kFactorial, nkFactorial));
    }
    
    // キャッシュキー生成
    generateCacheKey(points, resolution) {
        const hash = points.reduce((acc, point, index) => {
            return acc + `${index}:${point.x.toFixed(2)},${point.y.toFixed(2)};`;
        }, '');
        return `${hash}_${resolution}`;
    }
    
    // 線形補間
    linearInterpolation(p1, p2, t) {
        return {
            x: p1.x + t * (p2.x - p1.x),
            y: p1.y + t * (p2.y - p1.y),
            pressure: p1.pressure + t * (p2.pressure - p1.pressure)
        };
    }
    
    // 二次補間
    quadraticInterpolation(p1, p2, p3, t) {
        const oneMinusT = 1 - t;
        const tSquared = t * t;
        const oneMinusTSquared = oneMinusT * oneMinusT;
        
        return {
            x: oneMinusTSquared * p1.x + 2 * oneMinusT * t * p2.x + tSquared * p3.x,
            y: oneMinusTSquared * p1.y + 2 * oneMinusT * t * p2.y + tSquared * p3.y,
            pressure: oneMinusTSquared * p1.pressure + 2 * oneMinusT * t * p2.pressure + tSquared * p3.pressure
        };
    }
    
    // 三次補間 (mathjs matrix活用)
    cubicInterpolation(p1, p2, p3, p4, t) {
        // Hermite basis matrix
        const hermiteMatrix = math.matrix([
            [2, -2, 1, 1],
            [-3, 3, -2, -1],
            [0, 0, 1, 0],
            [1, 0, 0, 0]
        ]);
        
        const tVector = math.matrix([t * t * t, t * t, t, 1]);
        const pointMatrix = math.matrix([
            [p1.x, p1.y, p1.pressure],
            [p4.x, p4.y, p4.pressure],
            [(p2.x - p1.x), (p2.y - p1.y), (p2.pressure - p1.pressure)],
            [(p4.x - p3.x), (p4.y - p3.y), (p4.pressure - p3.pressure)]
        ]);
        
        const result = math.multiply(math.multiply(tVector, hermiteMatrix), pointMatrix);
        const resultArray = result.toArray();
        
        return {
            x: resultArray[0],
            y: resultArray[1],
            pressure: resultArray[2]
        };
    }
    
    // Catmull-Rom補間
    catmullRomInterpolation(p0, p1, p2, p3, t) {
        const t2 = t * t;
        const t3 = t2 * t;
        
        // Catmull-Rom係数
        const c0 = -0.5 * t3 + t2 - 0.5 * t;
        const c1 = 1.5 * t3 - 2.5 * t2 + 1;
        const c2 = -1.5 * t3 + 2 * t2 + 0.5 * t;
        const c3 = 0.5 * t3 - 0.5 * t2;
        
        return {
            x: c0 * p0.x + c1 * p1.x + c2 * p2.x + c3 * p3.x,
            y: c0 * p0.y + c1 * p1.y + c2 * p2.y + c3 * p3.y,
            pressure: c0 * p0.pressure + c1 * p1.pressure + c2 * p2.pressure + c3 * p3.pressure
        };
    }
    
    // ベジェ補間 (3次ベジェ)
    bezierInterpolation(p1, cp1, cp2, p2, t) {
        const oneMinusT = 1 - t;
        const oneMinusTCubed = oneMinusT * oneMinusT * oneMinusT;
        const oneMinusTSquared = oneMinusT * oneMinusT;
        const tSquared = t * t;
        const tCubed = tSquared * t;
        
        return {
            x: oneMinusTCubed * p1.x + 3 * oneMinusTSquared * t * cp1.x + 
               3 * oneMinusT * tSquared * cp2.x + tCubed * p2.x,
            y: oneMinusTCubed * p1.y + 3 * oneMinusTSquared * t * cp1.y + 
               3 * oneMinusT * tSquared * cp2.y + tCubed * p2.y,
            pressure: oneMinusTCubed * p1.pressure + 3 * oneMinusTSquared * t * cp1.pressure + 
                     3 * oneMinusT * tSquared * cp2.pressure + tCubed * p2.pressure
        };
    }
    
    // 距離計算 (最適化済み)
    calculateDistance(p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    // 角度計算
    calculateAngle(p1, p2) {
        return Math.atan2(p2.y - p1.y, p2.x - p1.x);
    }
    
    // 法線ベクトル計算
    calculateNormal(p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length === 0) return { x: 0, y: 1 };
        
        return {
            x: -dy / length,
            y: dx / length
        };
    }
    
    // 曲率計算 (3点から)
    calculateCurvature(p1, p2, p3) {
        const area = 0.5 * Math.abs(
            (p2.x - p1.x) * (p3.y - p1.y) - (p3.x - p1.x) * (p2.y - p1.y)
        );
        
        const a = this.calculateDistance(p1, p2);
        const b = this.calculateDistance(p2, p3);
        const c = this.calculateDistance(p1, p3);
        
        if (a === 0 || b === 0 || c === 0) return 0;
        
        return 4 * area / (a * b * c);
    }
    
    // スプライン補間による点密度最適化
    optimizePointDensity(points, targetDensity = 2.0) {
        if (points.length < 2) return points;
        
        const optimizedPoints = [points[0]];
        let currentDistance = 0;
        
        for (let i = 1; i < points.length; i++) {
            const distance = this.calculateDistance(points[i - 1], points[i]);
            currentDistance += distance;
            
            if (currentDistance >= targetDensity) {
                optimizedPoints.push(points[i]);
                currentDistance = 0;
            }
        }
        
        // 最後の点を必ず追加
        if (optimizedPoints[optimizedPoints.length - 1] !== points[points.length - 1]) {
            optimizedPoints.push(points[points.length - 1]);
        }
        
        return optimizedPoints;
    }
    
    // 手ブレ補正計算
    calculateStabilization(points, stabilizationStrength = 0.5) {
        if (points.length < 3) return points;
        
        const stabilized = [points[0]];
        
        for (let i = 1; i < points.length - 1; i++) {
            const current = points[i];
            const smoothed = this.applySmoothingToPoints(
                [points[i - 1], current, points[i + 1]], 
                stabilizationStrength
            )[1];
            
            stabilized.push(smoothed);
        }
        
        stabilized.push(points[points.length - 1]);
        return stabilized;
    }
    
    // ガウシアンスムージング
    applyGaussianSmoothing(points, sigma = 1.0) {
        if (points.length < 3) return points;
        
        const kernelSize = Math.ceil(3 * sigma);
        const kernel = this.generateGaussianKernel(kernelSize, sigma);
        const smoothed = [];
        
        for (let i = 0; i < points.length; i++) {
            let x = 0, y = 0, pressure = 0, totalWeight = 0;
            
            for (let j = -kernelSize; j <= kernelSize; j++) {
                const index = i + j;
                if (index >= 0 && index < points.length) {
                    const weight = kernel[j + kernelSize];
                    x += points[index].x * weight;
                    y += points[index].y * weight;
                    pressure += points[index].pressure * weight;
                    totalWeight += weight;
                }
            }
            
            smoothed.push({
                x: x / totalWeight,
                y: y / totalWeight,
                pressure: pressure / totalWeight,
                timestamp: points[i].timestamp
            });
        }
        
        return smoothed;
    }
    
    // ガウシアンカーネル生成
    generateGaussianKernel(size, sigma) {
        const kernel = [];
        const factor = 1 / (Math.sqrt(2 * Math.PI) * sigma);
        
        for (let i = -size; i <= size; i++) {
            const exponent = -(i * i) / (2 * sigma * sigma);
            kernel.push(factor * Math.exp(exponent));
        }
        
        return kernel;
    }
    
    // 速度計算
    calculateVelocity(points) {
        if (points.length < 2) return [];
        
        const velocities = [];
        
        for (let i = 1; i < points.length; i++) {
            const distance = this.calculateDistance(points[i - 1], points[i]);
            const timeDelta = (points[i].timestamp - points[i - 1].timestamp) || 16; // fallback to 60fps
            const velocity = distance / timeDelta * 1000; // pixels per second
            
            velocities.push(velocity);
        }
        
        return velocities;
    }
    
    // 加速度計算
    calculateAcceleration(velocities) {
        if (velocities.length < 2) return [];
        
        const accelerations = [];
        
        for (let i = 1; i < velocities.length; i++) {
            const acceleration = velocities[i] - velocities[i - 1];
            accelerations.push(acceleration);
        }
        
        return accelerations;
    }
    
    // 統計計算 (mathjs活用)
    calculateStatistics(values) {
        if (!values || values.length === 0) return null;
        
        const valuesMatrix = math.matrix(values);
        
        return {
            mean: math.mean(valuesMatrix),
            median: math.median(valuesMatrix),
            std: math.std(valuesMatrix),
            min: math.min(valuesMatrix),
            max: math.max(valuesMatrix),
            range: math.max(valuesMatrix) - math.min(valuesMatrix)
        };
    }
    
    // キャッシュクリア
    clearCache() {
        this.bezierCache.clear();
        this.controlPointsBuffer = [];
    }
    
    // 数学設定更新
    updateMathSettings(settings) {
        if (settings.bezierPrecision !== undefined) {
            this.BEZIER_PRECISION = Math.max(0.01, Math.min(1, settings.bezierPrecision));
        }
        
        if (settings.smoothThreshold !== undefined) {
            this.SMOOTH_THRESHOLD = Math.max(0, Math.min(1, settings.smoothThreshold));
        }
        
        if (settings.curveTension !== undefined) {
            this.CURVE_TENSION = Math.max(0, Math.min(1, settings.curveTension));
        }
        
        if (settings.interpolationSteps !== undefined) {
            this.INTERPOLATION_STEPS = Math.max(5, Math.min(100, settings.interpolationSteps));
        }
    }
}