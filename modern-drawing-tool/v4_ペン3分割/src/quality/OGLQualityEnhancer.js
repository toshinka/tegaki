// Phase 1.5A: OGL統一描画品質向上統合ファイル
export class OGLQualityEnhancer {
    constructor(oglEngine) {
        this.engine = oglEngine;
        this.setupQualityFeatures();
    }
    
    // OGL品質向上機能初期化
    setupQualityFeatures() {
        this.setupAntialiasing();
        this.setupSmoothingSettings();
        this.setupPressureCalculation();
    }
    
    // OGLアンチエイリアシング設定
    setupAntialiasing() {
        // WebGLContextの設定を拡張
        if (this.engine.gl) {
            this.engine.gl.enable(this.engine.gl.BLEND);
            this.engine.gl.blendFunc(this.engine.gl.SRC_ALPHA, this.engine.gl.ONE_MINUS_SRC_ALPHA);
        }
    }
    
    // スムージング設定強化
    setupSmoothingSettings() {
        this.smoothingFactor = 0.5;
        this.minDistance = 1.0;
        this.maxDistance = 10.0;
    }
    
    // 筆圧計算設定
    setupPressureCalculation() {
        this.pressureCurve = 'linear'; // linear, quadratic, cubic
        this.pressureMin = 0.1;
        this.pressureMax = 1.0;
    }
    
    // OGL統一ベジェスムージング（基本実装）
    applySmoothingToPoints(points) {
        if (!this.engine.smoothing || points.length < 3) {
            return points;
        }
        
        const smoothedPoints = [points[0]]; // 最初の点は保持
        
        for (let i = 1; i < points.length - 1; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            const next = points[i + 1];
            
            // 簡易ベジェ補間
            const smoothed = {
                x: prev.x * 0.25 + curr.x * 0.5 + next.x * 0.25,
                y: prev.y * 0.25 + curr.y * 0.5 + next.y * 0.25,
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
    
    // OGL動的筆圧レスポンス強化
    enhancePressureResponse(pressure, baseSize) {
        const normalizedPressure = Math.max(this.pressureMin, Math.min(this.pressureMax, pressure));
        
        switch (this.pressureCurve) {
            case 'quadratic':
                return baseSize * (normalizedPressure * normalizedPressure);
            case 'cubic':
                return baseSize * (normalizedPressure * normalizedPressure * normalizedPressure);
            default: // linear
                return baseSize * normalizedPressure;
        }
    }
    
    // OGL線品質向上処理
    enhanceStrokeQuality(stroke) {
        if (!stroke || !stroke.points) return stroke;
        
        // スムージング適用
        stroke.points = this.applySmoothingToPoints(stroke.points);
        
        // 筆圧レスポンス強化
        stroke.points = stroke.points.map(point => ({
            ...point,
            enhancedSize: this.enhancePressureResponse(point.pressure, stroke.baseSize)
        }));
        
        return stroke;
    }
    
    // 品質設定更新
    updateQualitySettings(settings) {
        if (settings.smoothingFactor !== undefined) {
            this.smoothingFactor = Math.max(0, Math.min(1, settings.smoothingFactor));
        }
        
        if (settings.pressureCurve !== undefined) {
            this.pressureCurve = settings.pressureCurve;
        }
        
        if (settings.antialiasing !== undefined) {
            this.setupAntialiasing();
        }
    }
    
    // OGL統一色ブレンドモード基盤
    setupBlendMode(mode = 'normal') {
        if (!this.engine.gl) return;
        
        const gl = this.engine.gl;
        
        switch (mode) {
            case 'multiply':
                gl.blendFunc(gl.DST_COLOR, gl.ZERO);
                break;
            case 'screen':
                gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR);
                break;
            case 'overlay':
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
                break;
            default: // normal
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
                break;
        }
    }
    
    // パフォーマンス最適化
    optimizeRendering() {
        // 基本的な最適化設定
        if (this.engine.gl) {
            this.engine.gl.enable(this.engine.gl.CULL_FACE);
            this.engine.gl.enable(this.engine.gl.DEPTH_TEST);
        }
    }
}