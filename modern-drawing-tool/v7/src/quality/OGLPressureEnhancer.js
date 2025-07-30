// Phase2: OGL統一筆圧処理専門ファイル (封印化対象・不可触)
import * as math from 'mathjs';

export class OGLPressureEnhancer {
    constructor(oglEngine) {
        this.engine = oglEngine;
        this.setupPressureSystem();
        this.setupPressureCurves();
        this.setupPressureFiltering();
        this.setupPressureAdaptation();
    }
    
    // 筆圧システム基盤初期化
    setupPressureSystem() {
        // 筆圧感度設定
        this.pressureSensitivity = 0.5;
        this.pressureMin = 0.1;
        this.pressureMax = 1.0;
        this.pressureDeadzone = 0.05;
        
        // 筆圧応答カーブ設定
        this.pressureCurve = 'natural'; // linear, quadratic, cubic, natural, custom
        this.pressurePower = 2.0;
        this.pressureGamma = 1.0;
        
        // フィルタリング設定
        this.pressureSmoothing = 0.3;
        this.pressureStabilization = true;
        this.pressureAdaptive = true;
        
        // 履歴管理
        this.pressureHistory = [];
        this.pressureHistorySize = 10;
        this.pressureBuffer = [];
        
        // 統計情報
        this.pressureStats = {
            min: 1.0,
            max: 0.0,
            average: 0.5,
            variance: 0.0
        };
    }
    
    // 筆圧カーブシステム初期化
    setupPressureCurves() {
        // プリセットカーブ定義
        this.pressureCurves = {
            linear: (p) => p,
            quadratic: (p) => p * p,
            cubic: (p) => p * p * p,
            natural: (p) => this.naturalPressureCurve(p),
            smooth: (p) => this.smoothPressureCurve(p),
            sharp: (p) => this.sharpPressureCurve(p),
            soft: (p) => this.softPressureCurve(p),
            custom: (p) => this.customPressureCurve(p)
        };
        
        // カスタムカーブポイント
        this.customCurvePoints = [
            { input: 0.0, output: 0.0 },
            { input: 0.25, output: 0.1 },
            { input: 0.5, output: 0.4 },
            { input: 0.75, output: 0.7 },
            { input: 1.0, output: 1.0 }
        ];
        
        // ベジェカーブ制御点
        this.bezierControlPoints = [
            { x: 0, y: 0 },
            { x: 0.25, y: 0.1 },
            { x: 0.75, y: 0.9 },
            { x: 1, y: 1 }
        ];
    }
    
    // 筆圧フィルタリングシステム初期化
    setupPressureFiltering() {
        // ノイズ除去フィルター
        this.noiseFilter = {
            enabled: true,
            threshold: 0.02,
            windowSize: 5
        };
        
        // スムージングフィルター
        this.smoothingFilter = {
            enabled: true,
            factor: 0.3,
            method: 'exponential' // exponential, gaussian, moving_average
        };
        
        // スタビライゼーションフィルター
        this.stabilizationFilter = {
            enabled: true,
            strength: 0.5,
            adaptiveThreshold: 0.1
        };
        
        // 予測フィルター
        this.predictionFilter = {
            enabled: false,
            lookahead: 3,
            confidence: 0.8
        };
    }
    
    // 適応的筆圧システム初期化
    setupPressureAdaptation() {
        // ユーザー特性学習
        this.userAdaptation = {
            enabled: true,
            learningRate: 0.01,
            adaptationPeriod: 100, // ストローク数
            personalizedCurve: null
        };
        
        // デバイス特性適応
        this.deviceAdaptation = {
            enabled: true,
            deviceType: this.detectPressureDevice(),
            calibration: this.getDeviceCalibration(),
            compensation: true
        };
        
        // 環境適応
        this.environmentAdaptation = {
            enabled: true,
            temperatureCompensation: false,
            humidityCompensation: false,
            noiseLevel: this.measureNoiseLevel()
        };
    }
    
    // メイン筆圧処理エントリーポイント
    processPressure(rawPressure, context = {}) {
        // 基本正規化
        let pressure = this.normalizePressure(rawPressure);
        
        // フィルタリング適用
        pressure = this.applyPressureFiltering(pressure, context);
        
        // カーブ適用
        pressure = this.applyPressureCurve(pressure);
        
        // 適応的調整
        pressure = this.applyAdaptiveAdjustment(pressure, context);
        
        // 履歴更新
        this.updatePressureHistory(pressure);
        
        // 統計更新
        this.updatePressureStats(pressure);
        
        return pressure;
    }
    
    // 筆圧正規化
    normalizePressure(rawPressure) {
        // デバイス固有の補正
        let pressure = this.applyDeviceCompensation(rawPressure);
        
        // デッドゾーン適用
        if (pressure < this.pressureDeadzone) {
            pressure = 0;
        }
        
        // 範囲正規化
        pressure = math.max(0, math.min(1, pressure));
        
        // 感度調整
        pressure = this.applySensitivityAdjustment(pressure);
        
        return pressure;
    }
    
    // 筆圧フィルタリング適用
    applyPressureFiltering(pressure, context) {
        let filteredPressure = pressure;
        
        // ノイズ除去
        if (this.noiseFilter.enabled) {
            filteredPressure = this.applyNoiseFilter(filteredPressure);
        }
        
        // スムージング
        if (this.smoothingFilter.enabled) {
            filteredPressure = this.applySmoothingFilter(filteredPressure, context);
        }
        
        // スタビライゼーション
        if (this.stabilizationFilter.enabled) {
            filteredPressure = this.applyStabilizationFilter(filteredPressure, context);
        }
        
        // 予測フィルター
        if (this.predictionFilter.enabled) {
            filteredPressure = this.applyPredictionFilter(filteredPressure, context);
        }
        
        return filteredPressure;
    }
    
    // 筆圧カーブ適用
    applyPressureCurve(pressure) {
        const curveFunction = this.pressureCurves[this.pressureCurve];
        if (!curveFunction) {
            console.warn(`Unknown pressure curve: ${this.pressureCurve}`);
            return pressure;
        }
        
        return curveFunction(pressure);
    }
    
    // 自然な筆圧カーブ (S字カーブ)
    naturalPressureCurve(pressure) {
        // シグモイド関数ベースの自然なカーブ
        const k = 6; // 急峻さ
        const sigmoid = 1 / (1 + Math.exp(-k * (pressure - 0.5)));
        
        // 0-1の範囲に正規化
        return (sigmoid - 0.5 / (1 + Math.exp(k * 0.5))) / 
               (0.5 / (1 + Math.exp(-k * 0.5)) - 0.5 / (1 + Math.exp(k * 0.5)));
    }
    
    // スムーズ筆圧カーブ
    smoothPressureCurve(pressure) {
        // 3次ベジェカーブを使用したスムーズな応答
        const t = pressure;
        const p0 = 0, p1 = 0.1, p2 = 0.8, p3 = 1;
        
        const oneMinusT = 1 - t;
        return oneMinusT * oneMinusT * oneMinusT * p0 +
               3 * oneMinusT * oneMinusT * t * p1 +
               3 * oneMinusT * t * t * p2 +
               t * t * t * p3;
    }
    
    // シャープ筆圧カーブ
    sharpPressureCurve(pressure) {
        // 指数関数による鋭い応答
        const sharpness = 3;
        return Math.pow(pressure, sharpness);
    }
    
    // ソフト筆圧カーブ
    softPressureCurve(pressure) {
        // 逆指数関数による柔らかい応答
        const softness = 0.5;
        return Math.pow(pressure, softness);
    }
    
    // カスタム筆圧カーブ
    customPressureCurve(pressure) {
        if (this.customCurvePoints.length < 2) return pressure;
        
        // 線形補間でカスタムカーブを評価
        for (let i = 0; i < this.customCurvePoints.length - 1; i++) {
            const p1 = this.customCurvePoints[i];
            const p2 = this.customCurvePoints[i + 1];
            
            if (pressure >= p1.input && pressure <= p2.input) {
                const t = (pressure - p1.input) / (p2.input - p1.input);
                return p1.output + t * (p2.output - p1.output);
            }
        }
        
        // 範囲外の場合は最寄りの値を返す
        if (pressure < this.customCurvePoints[0].input) {
            return this.customCurvePoints[0].output;
        }
        return this.customCurvePoints[this.customCurvePoints.length - 1].output;
    }
    
    // ノイズフィルター適用
    applyNoiseFilter(pressure) {
        this.pressureBuffer.push(pressure);
        
        if (this.pressureBuffer.length > this.noiseFilter.windowSize) {
            this.pressureBuffer.shift();
        }
        
        if (this.pressureBuffer.length < 3) return pressure;
        
        // 中央値フィルター
        const sorted = [...this.pressureBuffer].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        
        // 閾値チェック
        if (Math.abs(pressure - median) > this.noiseFilter.threshold) {
            return median;
        }
        
        return pressure;
    }
    
    // スムージングフィルター適用
    applySmoothingFilter(pressure, context) {
        if (this.pressureHistory.length === 0) {
            return pressure;
        }
        
        const lastPressure = this.pressureHistory[this.pressureHistory.length - 1];
        
        switch (this.smoothingFilter.method) {
            case 'exponential':
                return this.exponentialSmoothing(pressure, lastPressure);
            case 'gaussian':
                return this.gaussianSmoothing(pressure);
            case 'moving_average':
                return this.movingAverageSmoothing(pressure);
            default:
                return this.exponentialSmoothing(pressure, lastPressure);
        }
    }
    
    // 指数スムージング
    exponentialSmoothing(currentPressure, lastPressure) {
        const alpha = 1 - this.smoothingFilter.factor;
        return alpha * currentPressure + (1 - alpha) * lastPressure;
    }
    
    // ガウシアンスムージング
    gaussianSmoothing(pressure) {
        if (this.pressureHistory.length < 3) return pressure;
        
        const weights = [0.25, 0.5, 0.25];
        const historyLength = Math.min(3, this.pressureHistory.length);
        
        let smoothedPressure = 0;
        let totalWeight = 0;
        
        for (let i = 0; i < historyLength; i++) {
            const weight = weights[i];
            const historyPressure = this.pressureHistory[this.pressureHistory.length - historyLength + i];
            smoothedPressure += historyPressure * weight;
            totalWeight += weight;
        }
        
        smoothedPressure += pressure * weights[historyLength];
        totalWeight += weights[historyLength];
        
        return smoothedPressure / totalWeight;
    }
    
    // 移動平均スムージング
    movingAverageSmoothing(pressure) {
        const windowSize = Math.min(5, this.pressureHistory.length + 1);
        let sum = pressure;
        
        for (let i = 0; i < windowSize - 1; i++) {
            const index = this.pressureHistory.length - 1 - i;
            if (index >= 0) {
                sum += this.pressureHistory[index];
            }
        }
        
        return sum / windowSize;
    }
    
    // スタビライゼーションフィルター適用
    applyStabilizationFilter(pressure, context) {
        if (this.pressureHistory.length < 2) return pressure;
        
        const recentPressures = this.pressureHistory.slice(-3);
        const variance = this.calculateVariance(recentPressures);
        
        // 高い変動がある場合にスタビライゼーションを適用
        if (variance > this.stabilizationFilter.adaptiveThreshold) {
            const average = recentPressures.reduce((sum, p) => sum + p, 0) / recentPressures.length;
            const stabilizationFactor = this.stabilizationFilter.strength;
            
            return pressure * (1 - stabilizationFactor) + average * stabilizationFactor;
        }
        
        return pressure;
    }
    
    // 予測フィルター適用
    applyPredictionFilter(pressure, context) {
        if (this.pressureHistory.length < this.predictionFilter.lookahead) {
            return pressure;
        }
        
        // 簡単な線形予測
        const recentPressures = this.pressureHistory.slice(-this.predictionFilter.lookahead);
        const trend = this.calculateTrend(recentPressures);
        
        const predictedPressure = pressure + trend * this.predictionFilter.confidence;
        return math.max(0, math.min(1, predictedPressure));
    }
    
    // 適応的調整適用
    applyAdaptiveAdjustment(pressure, context) {
        let adjustedPressure = pressure;
        
        // ユーザー適応
        if (this.userAdaptation.enabled && this.userAdaptation.personalizedCurve) {
            adjustedPressure = this.applyPersonalizedCurve(adjustedPressure);
        }
        
        // デバイス適応
        if (this.deviceAdaptation.enabled) {
            adjustedPressure = this.applyDeviceAdaptation(adjustedPressure);
        }
        
        // 環境適応
        if (this.environmentAdaptation.enabled) {
            adjustedPressure = this.applyEnvironmentAdaptation(adjustedPressure);
        }
        
        return adjustedPressure;
    }
    
    // デバイス補正適用
    applyDeviceCompensation(rawPressure) {
        const calibration = this.deviceAdaptation.calibration;
        
        // キャリブレーション適用
        let compensated = rawPressure * calibration.scale + calibration.offset;
        
        // デバイス固有の非線形補正
        if (calibration.nonlinearCorrection) {
            compensated = this.applyNonlinearCorrection(compensated, calibration);
        }
        
        return compensated;
    }
    
    // 感度調整適用
    applySensitivityAdjustment(pressure) {
        // ガンマ補正による感度調整
        const gamma = 1.0 / (this.pressureSensitivity * 2.0 + 0.5);
        return Math.pow(pressure, gamma);
    }
    
    // パーソナライズドカーブ適用
    applyPersonalizedCurve(pressure) {
        if (!this.userAdaptation.personalizedCurve) return pressure;
        
        // 学習済みの個人カーブを適用
        return this.evaluatePersonalizedCurve(pressure);
    }
    
    // デバイス適応適用
    applyDeviceAdaptation(pressure) {
        const deviceType = this.deviceAdaptation.deviceType;
        
        switch (deviceType) {
            case 'wacom':
                return this.applyWacomAdaptation(pressure);
            case 'apple_pencil':
                return this.applyApplePencilAdaptation(pressure);
            case 'surface_pen':
                return this.applySurfacePenAdaptation(pressure);
            case 'generic':
            default:
                return this.applyGenericAdaptation(pressure);
        }
    }
    
    // 環境適応適用
    applyEnvironmentAdaptation(pressure) {
        let adapted = pressure;
        
        // ノイズレベル補正
        if (this.environmentAdaptation.noiseLevel > 0.1) {
            adapted = this.applyNoiseLevelCompensation(adapted);
        }
        
        // 温度補正（将来の拡張用）
        if (this.environmentAdaptation.temperatureCompensation) {
            adapted = this.applyTemperatureCompensation(adapted);
        }
        
        return adapted;
    }
    
    // 筆圧履歴更新
    updatePressureHistory(pressure) {
        this.pressureHistory.push(pressure);
        
        if (this.pressureHistory.length > this.pressureHistorySize) {
            this.pressureHistory.shift();
        }
    }
    
    // 筆圧統計更新
    updatePressureStats(pressure) {
        this.pressureStats.min = Math.min(this.pressureStats.min, pressure);
        this.pressureStats.max = Math.max(this.pressureStats.max, pressure);
        
        // 移動平均による平均値更新
        const alpha = 0.1;
        this.pressureStats.average = this.pressureStats.average * (1 - alpha) + pressure * alpha;
        
        // 分散計算
        if (this.pressureHistory.length > 1) {
            this.pressureStats.variance = this.calculateVariance(this.pressureHistory);
        }
    }
    
    // 統計計算ユーティリティ
    calculateVariance(values) {
        if (values.length < 2) return 0;
        
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const squaredDifferences = values.map(val => Math.pow(val - mean, 2));
        return squaredDifferences.reduce((sum, val) => sum + val, 0) / values.length;
    }
    
    calculateTrend(values) {
        if (values.length < 2) return 0;
        
        const n = values.length;
        const x = Array.from({ length: n }, (_, i) => i);
        const y = values;
        
        const sumX = x.reduce((sum, val) => sum + val, 0);
        const sumY = y.reduce((sum, val) => sum + val, 0);
        const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
        const sumXX = x.reduce((sum, val) => sum + val * val, 0);
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        return slope;
    }
    
    // デバイス検出
    detectPressureDevice() {
        // ユーザーエージェントやAPI情報からデバイスタイプを推定
        const userAgent = navigator.userAgent.toLowerCase();
        
        if (userAgent.includes('ipad') || userAgent.includes('iphone')) {
            return 'apple_pencil';
        } else if (userAgent.includes('surface')) {
            return 'surface_pen';
        } else if (navigator.maxTouchPoints > 1) {
            return 'generic_touch';
        } else {
            return 'generic';
        }
    }
    
    // デバイスキャリブレーション取得
    getDeviceCalibration() {
        const deviceType = this.deviceAdaptation.deviceType;
        
        const calibrations = {
            wacom: { scale: 1.0, offset: 0.0, nonlinearCorrection: false },
            apple_pencil: { scale: 1.1, offset: -0.05, nonlinearCorrection: true },
            surface_pen: { scale: 0.9, offset: 0.1, nonlinearCorrection: true },
            generic: { scale: 1.0, offset: 0.0, nonlinearCorrection: false }
        };
        
        return calibrations[deviceType] || calibrations.generic;
    }
    
    // ノイズレベル測定
    measureNoiseLevel() {
        // 簡単な実装（実際の環境では過去の入力データから推定）
        return Math.random() * 0.1; // 0-10%のノイズレベル
    }
    
    // デバイス固有適応メソッド
    applyWacomAdaptation(pressure) {
        // Wacom特有の応答特性を考慮
        return Math.pow(pressure, 0.9);
    }
    
    applyApplePencilAdaptation(pressure) {
        // Apple Pencil特有の応答特性を考慮
        const adjusted = pressure * 1.1 - 0.05;
        return Math.max(0, Math.min(1, adjusted));
    }
    
    applySurfacePenAdaptation(pressure) {
        // Surface Pen特有の応答特性を考慮
        const adjusted = pressure * 0.9 + 0.1;
        return Math.max(0, Math.min(1, adjusted));
    }
    
    applyGenericAdaptation(pressure) {
        // 汎用デバイス用の基本的な適応
        return pressure;
    }
    
    // 非線形補正適用
    applyNonlinearCorrection(pressure, calibration) {
        // デバイス固有の非線形特性を補正
        // 実装例：2次関数による補正
        return pressure + calibration.quadraticFactor * pressure * pressure;
    }
    
    // ノイズレベル補正
    applyNoiseLevelCompensation(pressure) {
        // 高ノイズ環境での筆圧補正
        const noiseThreshold = 0.02;
        if (Math.abs(pressure - this.pressureStats.average) < noiseThreshold) {
            return this.pressureStats.average;
        }
        return pressure;
    }
    
    // 温度補正（将来実装用プレースホルダー）
    applyTemperatureCompensation(pressure) {
        // 温度による筆圧センサー特性変化の補正
        return pressure;
    }
    
    // 外部API - 筆圧設定更新
    updatePressureSettings(settings) {
        if (settings.sensitivity !== undefined) {
            this.pressureSensitivity = Math.max(0, Math.min(1, settings.sensitivity));
        }
        
        if (settings.curve !== undefined && this.pressureCurves[settings.curve]) {
            this.pressureCurve = settings.curve;
        }
        
        if (settings.smoothing !== undefined) {
            this.pressureSmoothing = Math.max(0, Math.min(1, settings.smoothing));
            this.smoothingFilter.factor = this.pressureSmoothing;
        }
        
        if (settings.stabilization !== undefined) {
            this.pressureStabilization = settings.stabilization;
            this.stabilizationFilter.enabled = settings.stabilization;
        }
        
        if (settings.adaptive !== undefined) {
            this.pressureAdaptive = settings.adaptive;
            this.userAdaptation.enabled = settings.adaptive;
        }
    }
    
    // カスタムカーブ設定
    setCustomCurve(points) {
        if (Array.isArray(points) && points.length >= 2) {
            this.customCurvePoints = points.sort((a, b) => a.input - b.input);
        }
    }
    
    // ベジェカーブ設定
    setBezierCurve(controlPoints) {
        if (Array.isArray(controlPoints) && controlPoints.length === 4) {
            this.bezierControlPoints = controlPoints;
        }
    }
    
    // 筆圧統計取得
    getPressureStats() {
        return { ...this.pressureStats };
    }
    
    // 筆圧履歴取得
    getPressureHistory() {
        return [...this.pressureHistory];
    }
    
    // リセット・クリア
    resetPressureStats() {
        this.pressureStats = {
            min: 1.0,
            max: 0.0,
            average: 0.5,
            variance: 0.0
        };
    }
    
    clearPressureHistory() {
        this.pressureHistory = [];
        this.pressureBuffer = [];
    }
    
    // キャリブレーション実行
    startPressureCalibration() {
        this.calibrationMode = true;
        this.calibrationData = [];
        console.log('Pressure calibration started. Please draw with varying pressure levels.');
    }
    
    finishPressureCalibration() {
        if (this.calibrationData && this.calibrationData.length > 0) {
            this.analyzePressureCalibration();
            this.calibrationMode = false;
            console.log('Pressure calibration completed.');
        }
    }
    
    analyzePressureCalibration() {
        // キャリブレーションデータから個人カーブを生成
        if (this.calibrationData.length < 10) return;
        
        // 統計分析
        const sortedData = this.calibrationData.sort((a, b) => a.input - b.input);
        
        // パーソナライズドカーブ生成
        this.userAdaptation.personalizedCurve = this.generatePersonalizedCurve(sortedData);
    }
    
    generatePersonalizedCurve(calibrationData) {
        // 簡単な実装（実際にはより高度な機械学習アルゴリズムを使用）
        const curvePoints = [];
        const buckets = 10;
        
        for (let i = 0; i < buckets; i++) {
            const input = i / (buckets - 1);
            const relevantData = calibrationData.filter(d => 
                Math.abs(d.input - input) < 0.1
            );
            
            if (relevantData.length > 0) {
                const avgOutput = relevantData.reduce((sum, d) => sum + d.output, 0) / relevantData.length;
                curvePoints.push({ input, output: avgOutput });
            } else {
                curvePoints.push({ input, output: input });
            }
        }
        
        return curvePoints;
    }
    
    evaluatePersonalizedCurve(pressure) {
        if (!this.userAdaptation.personalizedCurve) return pressure;
        
        const curve = this.userAdaptation.personalizedCurve;
        
        // 線形補間でカーブを評価
        for (let i = 0; i < curve.length - 1; i++) {
            const p1 = curve[i];
            const p2 = curve[i + 1];
            
            if (pressure >= p1.input && pressure <= p2.input) {
                const t = (pressure - p1.input) / (p2.input - p1.input);
                return p1.output + t * (p2.output - p1.output);
            }
        }
        
        // 範囲外の場合
        if (pressure < curve[0].input) return curve[0].output;
        return curve[curve.length - 1].output;
    }
}