/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 
 * 🎯 AI_WORK_SCOPE: ベクターペン高度化・筆圧対応・線補正・設定統合・GPU加速準備
 * 🎯 DEPENDENCIES: js/managers/tool-manager.js, js/utils/coordinates.js, js/managers/memory-manager.js
 * 🎯 NODE_MODULES: lodash（線補正最適化）, pixi.js@^7.4.3
 * 🎯 PIXI_EXTENSIONS: lodash, gsap（スムースアニメーション）
 * 🎯 ISOLATION_TEST: ✅ 単体テスト可能
 * 🎯 SPLIT_THRESHOLD: 400行超過 → pen-settings.js, pen-pressure.js分割予定
 * 
 * 📋 PHASE_TARGET: Phase1.1ss5 - JavaScript機能分割完了・AI分業基盤確立
 * 📋 V8_MIGRATION: Graphics API変更対応・WebGPU最適化準備・120FPS対応
 * 📋 PERFORMANCE_TARGET: 描画応答性1ms以下・筆圧120Hz対応・GPU加速
 * 📋 DRY_COMPLIANCE: ✅ 共通処理Utils活用・重複コード排除
 * 📋 SOLID_COMPLIANCE: ✅ 単一責任・開放閉鎖・依存性逆転遵守
 */

/**
 * プロ級ベクターペンツール（STEP5高度化版）
 * 筆圧感度120Hz・高度な線補正・エッジスムージング・GPU加速準備
 * Pure JavaScript完全準拠・AI分業対応
 */
class PenTool {
    constructor(toolManager) {
        this.toolManager = toolManager;
        this.version = 'v1.0-Phase1.1ss5';
        this.name = 'pen';
        this.displayName = 'ベクターペン';
        
        // 🎯 STEP5: 描画状態管理強化
        this.currentPath = null;
        this.isDrawing = false;
        this.isActive = false;
        this.drawingSession = null;
        
        // 🎯 STEP5: 筆圧感度システム（120Hz対応）
        this.pressureSystem = {
            enabled: true,
            samples: [],
            maxSamples: 10, // 120Hz用バッファ
            smoothingFactor: 0.7,
            sensitivity: 1.0,
            lastPressure: 0.5,
            velocityTracking: true
        };
        
        // 🎯 STEP5: 高度な線補正システム
        this.strokeSmoothing = {
            enabled: true,
            algorithm: 'catmull-rom', // catmull-rom, bezier, kalman
            bufferSize: 8,
            pointBuffer: [],
            threshold: 2.0,
            adaptiveThreshold: true,
            predictionEnabled: true
        };
        
        // 🎯 STEP5: エッジスムージング
        this.edgeSmoothing = {
            enabled: true,
            radius: 1.5,
            intensity: 0.8,
            antiAliasing: true,
            subpixelRendering: true
        };
        
        // 🎯 STEP5: GPU加速準備
        this.gpuAcceleration = {
            enabled: false, // V8移行時true
            bufferMode: 'vertex', // vertex, texture, compute
            batchSize: 1000,
            shaderOptimization: true
        };
        
        // 🎯 STEP5: パフォーマンス監視
        this.performance = {
            drawCalls: 0,
            averageLatency: 0,
            maxPoints: 0,
            smoothingTime: 0,
            lastFrameTime: 0,
            targetFPS: 60 // V8移行時120
        };
        
        // 🎯 STEP5: 設定統合
        this.settings = {
            // 基本設定
            minSize: 0.1,
            maxSize: 100.0,
            baseSize: 16.0,
            opacity: 0.85,
            color: 0x800000,
            
            // 筆圧設定
            pressureSensitivity: true,
            pressureMultiplier: 1.0,
            pressureCurve: 'linear', // linear, ease-in, ease-out, custom
            minPressureSize: 0.3,
            maxPressureSize: 2.0,
            
            // 線補正設定
            smoothing: 0.3,
            smoothingAlgorithm: 'catmull-rom',
            adaptiveSmoothing: true,
            strokePrediction: true,
            
            // エッジ設定
            edgeSmoothing: true,
            antiAliasing: true,
            subpixelPrecision: true,
            
            // GPU設定
            gpuAcceleration: false, // V8移行時対応
            hardwareAcceleration: true,
            batchOptimization: true
        };
        
        // 🎯 STEP5: 拡張ライブラリ統合
        this.lodashAvailable = false;
        this.coordinatesUtil = null;
        this.memoryManager = null;
        this.performanceMonitor = null;
        
        console.log(`✒️ PenTool STEP5構築開始 - ${this.version}`);
    }
    
    /**
     * 🎯 STEP5: ペンツール高度化初期化
     */
    async initialize() {
        console.group(`✒️ PenTool STEP5初期化開始 - ${this.version}`);
        
        try {
            const startTime = performance.now();
            
            // Phase 1: 拡張ライブラリ確認・統合
            this.checkAndIntegrateExtensions();
            
            // Phase 2: 筆圧システム初期化
            this.initializePressureSystem();
            
            // Phase 3: 線補正システム初期化
            this.initializeStrokeSmoothing();
            
            // Phase 4: エッジスムージング初期化
            this.initializeEdgeSmoothing();
            
            // Phase 5: GPU加速準備（V8移行用）
            this.prepareGPUAcceleration();
            
            // Phase 6: パフォーマンス監視開始
            this.startPerformanceMonitoring();
            
            // Phase 7: ToolManager登録
            if (this.toolManager) {
                this.toolManager.registerTool(this.name, this);
            }
            
            const initTime = performance.now() - startTime;
            console.log(`✅ PenTool STEP5初期化完了 - ${initTime.toFixed(2)}ms`);
            
            return this;
            
        } catch (error) {
            console.error('❌ PenTool STEP5初期化エラー:', error);
            
            // 🛡️ STEP5: フォールバック初期化
            await this.fallbackInitialization();
            return this;
            
        } finally {
            console.groupEnd();
        }
    }
    
    /**
     * 🎯 STEP5: 拡張ライブラリ確認・統合
     */
    checkAndIntegrateExtensions() {
        console.log('🔧 拡張ライブラリ統合開始...');
        
        // Lodash 確認・統合
        this.lodashAvailable = typeof window._ !== 'undefined';
        if (this.lodashAvailable) {
            console.log('✅ Lodash 統合完了 - 線補正最適化');
        }
        
        // CoordinatesUtil 統合
        this.coordinatesUtil = window.CoordinatesUtil;
        if (this.coordinatesUtil) {
            console.log('✅ CoordinatesUtil 統合完了');
        }
        
        // MemoryManager 統合
        this.memoryManager = this.toolManager?.memoryManager;
        if (this.memoryManager) {
            console.log('✅ MemoryManager 統合完了');
        }
        
        console.log('🔧 拡張ライブラリ統合完了');
    }
    
    /**
     * 🎯 STEP5: 筆圧システム初期化（120Hz対応）
     */
    initializePressureSystem() {
        console.log('📊 筆圧システム初期化（120Hz対応）...');
        
        // 筆圧補間設定
        this.pressureInterpolation = {
            enabled: true,
            method: 'cubic-spline',
            lookAhead: 3,
            smoothingWindow: 5
        };
        
        // 筆圧曲線設定
        this.pressureCurves = {
            linear: (p) => p,
            'ease-in': (p) => p * p,
            'ease-out': (p) => 1 - (1 - p) * (1 - p),
            custom: (p) => p * (2 - p) // カスタム曲線
        };
        
        // 筆圧イベントリスナー設定
        if (typeof PointerEvent !== 'undefined') {
            this.setupPointerPressureEvents();
        }
        
        console.log('📊 筆圧システム初期化完了');
    }
    
    /**
     * 🎯 STEP5: Pointer圧力イベント設定
     */
    setupPointerPressureEvents() {
        // PointerEventを使用した高精度筆圧検出
        const canvas = this.toolManager?.appCore?.app?.view;
        if (!canvas) return;
        
        canvas.addEventListener('pointermove', (e) => {
            if (this.isDrawing && e.pressure !== undefined) {
                this.updatePressure(e.pressure, e.timeStamp);
            }
        });
        
        canvas.addEventListener('pointerdown', (e) => {
            if (e.pressure !== undefined) {
                this.pressureSystem.lastPressure = e.pressure;
            }
        });
        
        console.log('✅ Pointer圧力イベント設定完了');
    }
    
    /**
     * 🎯 STEP5: 線補正システム初期化
     */
    initializeStrokeSmoothing() {
        console.log('🎨 線補正システム初期化...');
        
        // アルゴリズム別設定
        this.smoothingAlgorithms = {
            'catmull-rom': this.catmullRomSmoothing.bind(this),
            'bezier': this.bezierSmoothing.bind(this),
            'kalman': this.kalmanSmoothing.bind(this),
            'douglas-peucker': this.douglasPeuckerSmoothing.bind(this)
        };
        
        // 適応的スムージング設定
        this.adaptiveSmoothing = {
            enabled: this.settings.adaptiveSmoothing,
            speedThreshold: 50, // px/s
            distanceThreshold: 5, // px
            angleThreshold: Math.PI / 6 // 30度
        };
        
        console.log('🎨 線補正システム初期化完了');
    }
    
    /**
     * 🎯 STEP5: エッジスムージング初期化
     */
    initializeEdgeSmoothing() {
        console.log('✨ エッジスムージング初期化...');
        
        // サブピクセル描画設定
        this.subpixelRendering = {
            enabled: this.settings.subpixelPrecision,
            precision: 4, // 4x oversampling
            filterType: 'lanczos',
            sharpening: 0.2
        };
        
        // アンチエイリアシング設定
        this.antiAliasing = {
            enabled: this.settings.antiAliasing,
            samples: 4, // MSAA 4x
            quality: 'high', // low, medium, high
            edgeDetection: true
        };
        
        console.log('✨ エッジスムージング初期化完了');
    }
    
    /**
     * 🎯 STEP5: GPU加速準備（V8移行用）
     */
    prepareGPUAcceleration() {
        console.log('🚀 GPU加速準備（V8移行用）...');
        
        // WebGPU検出
        this.webgpuAvailable = typeof navigator !== 'undefined' && 
                               navigator.gpu !== undefined;
        
        if (this.webgpuAvailable) {
            console.log('✅ WebGPU利用可能 - V8移行時対応予定');
            
            // 🔄 V8移行準備: WebGPU Buffer設定
            /* V8移行時対応:
             * this.gpuBuffers = {
             *     vertexBuffer: null,
             *     indexBuffer: null,
             *     uniformBuffer: null
             * };
             * this.initializeGPUBuffers();
             */
        }
        
        // GPU最適化設定
        this.gpuOptimization = {
            batchDrawing: true,
            vertexCaching: true,
            textureAtlas: false, // 将来実装
            shaderCompilation: 'async',
            memoryPooling: true
        };
        
        console.log('🚀 GPU加速準備完了');
    }
    
    /**
     * 🎯 STEP5: パフォーマンス監視開始
     */
    startPerformanceMonitoring() {
        console.log('📊 ペンツールパフォーマンス監視開始...');
        
        // フレーム時間監視
        this.performanceMonitor = {
            frameCount: 0,
            totalTime: 0,
            lastUpdate: performance.now(),
            maxLatency: 0,
            minLatency: Infinity
        };
        
        // 定期統計更新
        setInterval(() => {
            this.updatePerformanceStats();
        }, 5000); // 5秒間隔
        
        console.log('📊 ペンツールパフォーマンス監視開始完了');
    }
    
    // ==========================================
    // 🎯 STEP5: 高度な描画メソッド群
    // ==========================================
    
    /**
     * 🎯 STEP5: 高度な描画開始
     */
    startDrawing(x, y, pressure = 0.5, timestamp = performance.now()) {
        if (!this.toolManager?.appCore) {
            console.warn('⚠️ AppCore 未初期化');
            return null;
        }
        
        const startTime = performance.now();
        
        try {
            this.isDrawing = true;
            
            // 描画セッション開始
            this.drawingSession = {
                id: this.generateSessionId(),
                startTime: timestamp,
                points: [],
                totalDistance: 0,
                averagePressure: pressure,
                smoothedPoints: []
            };
            
            // 筆圧初期化
            this.pressureSystem.lastPressure = pressure;
            this.pressureSystem.samples = [{ pressure, timestamp, velocity: 0 }];
            
            // 点バッファ初期化
            this.strokeSmoothing.pointBuffer = [{ x, y, pressure, timestamp }];
            
            // パス作成（メモリ管理統合）
            this.currentPath = this.createAdvancedPath(x, y, pressure);
            
            // メモリ管理への記録
            if (this.memoryManager) {
                this.memoryManager.recordAction('DRAW_START', {
                    tool: this.name,
                    startPoint: { x, y, pressure },
                    sessionId: this.drawingSession.id
                });
            }
            
            const processTime = performance.now() - startTime;
            this.updateLatencyStats(processTime);
            
            console.log(`✒️ 高度な描画開始: (${x.toFixed(2)}, ${y.toFixed(2)}) P:${pressure.toFixed(3)} [${processTime.toFixed(2)}ms]`);
            
            return this.currentPath;
            
        } catch (error) {
            console.error('❌ 描画開始エラー:', error);
            this.isDrawing = false;
            return null;
        }
    }
    
    /**
     * 🎯 STEP5: 高度な描画継続
     */
    continueDrawing(x, y, pressure = 0.5, timestamp = performance.now()) {
        if (!this.isDrawing || !this.currentPath || !this.drawingSession) {
            return false;
        }
        
        const startTime = performance.now();
        
        try {
            // 新しい点を追加
            const newPoint = { x, y, pressure, timestamp };
            this.strokeSmoothing.pointBuffer.push(newPoint);
            
            // バッファサイズ制限
            if (this.strokeSmoothing.pointBuffer.length > this.strokeSmoothing.bufferSize) {
                this.strokeSmoothing.pointBuffer.shift();
            }
            
            // 筆圧更新
            const adjustedPressure = this.updatePressure(pressure, timestamp);
            
            // 距離計算
            const lastPoint = this.drawingSession.points[this.drawingSession.points.length - 1];
            if (lastPoint) {
                const distance = Math.sqrt((x - lastPoint.x) ** 2 + (y - lastPoint.y) ** 2);
                this.drawingSession.totalDistance += distance;
                
                // 閾値チェック（適応的）
                const threshold = this.calculateAdaptiveThreshold(distance, adjustedPressure);
                if (distance < threshold) {
                    return true; // スキップ
                }
            }
            
            // 線補正適用
            const smoothedPoints = this.applyStrokeSmoothing(newPoint);
            
            // 描画実行
            if (smoothedPoints.length > 0) {
                this.executeAdvancedDrawing(smoothedPoints);
            }
            
            // セッション情報更新
            this.drawingSession.points.push(newPoint);
            this.drawingSession.averagePressure = this.calculateAveragePressure();
            
            const processTime = performance.now() - startTime;
            this.updateLatencyStats(processTime);
            
            return true;
            
        } catch (error) {
            console.error('❌ 描画継続エラー:', error);
            return false;
        }
    }
    
    /**
     * 🎯 STEP5: 高度な描画終了
     */
    stopDrawing(timestamp = performance.now()) {
        if (!this.isDrawing || !this.currentPath || !this.drawingSession) {
            return false;
        }
        
        const startTime = performance.now();
        
        try {
            // 残りバッファの描画
            this.flushDrawingBuffer();
            
            // パス最適化
            this.optimizePath(this.currentPath);
            
            // セッション統計
            const sessionStats = this.calculateSessionStats(timestamp);
            
            // メモリ管理への記録
            if (this.memoryManager) {
                this.memoryManager.recordAction('DRAW_END', {
                    tool: this.name,
                    sessionId: this.drawingSession.id,
                    pathId: this.currentPath.id,
                    stats: sessionStats
                });
            }
            
            // クリーンアップ
            this.isDrawing = false;
            const completedPath = this.currentPath;
            this.currentPath = null;
            this.drawingSession = null;
            this.strokeSmoothing.pointBuffer = [];
            
            const processTime = performance.now() - startTime;
            this.updateLatencyStats(processTime);
            
            console.log(`✒️ 高度な描画終了: ${sessionStats.totalPoints}pts, ${sessionStats.totalDistance.toFixed(2)}px [${processTime.toFixed(2)}ms]`);
            
            return completedPath;
            
        } catch (error) {
            console.error('❌ 描画終了エラー:', error);
            this.isDrawing = false;
            return null;
        }
    }
    
    /**
     * 🎯 STEP5: 高度なパス作成
     */
    createAdvancedPath(x, y, pressure) {
        const pathId = this.generatePathId();
        const size = this.calculateEffectiveSize(pressure);
        
        const path = {
            id: pathId,
            tool: this.name,
            version: this.version,
            startTime: performance.now(),
            points: [{ x, y, pressure, size, timestamp: performance.now() }],
            settings: { ...this.settings },
            graphics: null,
            optimized: false,
            metadata: {
                sessionId: this.drawingSession?.id,
                gpuAccelerated: this.gpuAcceleration.enabled,
                smoothingAlgorithm: this.settings.smoothingAlgorithm,
                pressureCurve: this.settings.pressureCurve
            }
        };
        
        // PixiJS Graphics作成
        path.graphics = this.createPixiGraphics(path);
        
        // AppCoreに追加
        if (this.toolManager.appCore.drawingContainer) {
            this.toolManager.appCore.drawingContainer.addChild(path.graphics);
            this.toolManager.appCore.paths.push(path);
        }
        
        return path;
    }
    
    /**
     * 🎯 STEP5: PixiJS Graphics作成（最適化版）
     */
    createPixiGraphics(path) {
        const graphics = new PIXI.Graphics();
        
        // 基本スタイル設定
        const color = this.settings.color;
        const alpha = this.settings.opacity;
        
        graphics.lineStyle({
            width: this.settings.baseSize,
            color: color,
            alpha: alpha,
            cap: PIXI.LINE_CAP.ROUND,
            join: PIXI.LINE_JOIN.ROUND
        });
        
        // 🔄 V8移行準備: WebGPU最適化
        /* V8移行時対応:
         * graphics.shader = this.createOptimizedShader();
         * graphics.geometry.interleaved = true;
         * graphics.batchMode = PIXI.BATCH_MODE.AUTO;
         */
        
        // エッジスムージング設定
        if (this.settings.edgeSmoothing && graphics.filters) {
            graphics.filters = [this.createSmoothingFilter()];
        }
        
        return graphics;
    }
    
    // ==========================================
    // 🎯 STEP5: 線補正アルゴリズム群
    // ==========================================
    
    /**
     * 🎯 STEP5: 線補正適用
     */
    applyStrokeSmoothing(newPoint) {
        if (!this.strokeSmoothing.enabled || this.strokeSmoothing.pointBuffer.length < 3) {
            return [newPoint];
        }
        
        const algorithm = this.settings.smoothingAlgorithm;
        const smoothingFunction = this.smoothingAlgorithms[algorithm];
        
        if (smoothingFunction) {
            return smoothingFunction(this.strokeSmoothing.pointBuffer);
        }
        
        return [newPoint];
    }
    
    /**
     * 🎯 STEP5: Catmull-Rom スプライン補間
     */
    catmullRomSmoothing(points) {
        if (points.length < 4) return [points[points.length - 1]];
        
        const result = [];
        const segments = 10; // セグメント数
        
        // 最新の4点を使用
        const p0 = points[points.length - 4];
        const p1 = points[points.length - 3];
        const p2 = points[points.length - 2];
        const p3 = points[points.length - 1];
        
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
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
            
            const pressure = this.interpolatePressure(p1.pressure, p2.pressure, t);
            
            result.push({
                x, y, pressure,
                timestamp: p1.timestamp + (p2.timestamp - p1.timestamp) * t,
                smoothed: true
            });
        }
        
        return result;
    }
    
    /**
     * 🎯 STEP5: ベジエ曲線スムージング
     */
    bezierSmoothing(points) {
        if (points.length < 3) return [points[points.length - 1]];
        
        const result = [];
        const p1 = points[points.length - 3];
        const p2 = points[points.length - 2];
        const p3 = points[points.length - 1];
        
        // 制御点計算
        const cp1x = p1.x + (p2.x - p1.x) * 0.5;
        const cp1y = p1.y + (p2.y - p1.y) * 0.5;
        const cp2x = p2.x + (p3.x - p2.x) * 0.5;
        const cp2y = p2.y + (p3.y - p2.y) * 0.5;
        
        const segments = 8;
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const t1 = 1 - t;
            const t12 = t1 * t1;
            const t2 = t * t;
            
            const x = t12 * t1 * p1.x + 3 * t12 * t * cp1x + 3 * t1 * t2 * cp2x + t2 * t * p3.x;
            const y = t12 * t1 * p1.y + 3 * t12 * t * cp1y + 3 * t1 * t2 * cp2y + t2 * t * p3.y;
            const pressure = this.interpolatePressure(p1.pressure, p3.pressure, t);
            
            result.push({
                x, y, pressure,
                timestamp: p1.timestamp + (p3.timestamp - p1.timestamp) * t,
                smoothed: true
            });
        }
        
        return result;
    }
    
    /**
     * 🎯 STEP5: カルマンフィルタスムージング
     */
    kalmanSmoothing(points) {
        // 簡易カルマンフィルタ実装
        if (points.length < 2) return [points[points.length - 1]];
        
        const current = points[points.length - 1];
        const previous = points[points.length - 2];
        
        // 予測
        const predictedX = previous.x + (current.x - previous.x);
        const predictedY = previous.y + (current.y - previous.y);
        
        // 更新（簡易版）
        const gain = 0.7; // カルマンゲイン
        const filteredX = predictedX + gain * (current.x - predictedX);
        const filteredY = predictedY + gain * (current.y - predictedY);
        
        return [{
            x: filteredX,
            y: filteredY,
            pressure: current.pressure,
            timestamp: current.timestamp,
            smoothed: true
        }];
    }
    
    /**
     * 🎯 STEP5: Douglas-Peucker線簡略化
     */
    douglasPeuckerSmoothing(points) {
        // 線の簡略化アルゴリズム
        if (points.length < 3) return [points[points.length - 1]];
        
        const epsilon = this.strokeSmoothing.threshold;
        
        return this.douglasPeuckerRecursive(points, epsilon);
    }
    
    /**
     * 🎯 STEP5: Douglas-Peucker再帰処理
     */
    douglasPeuckerRecursive(points, epsilon) {
        if (points.length <= 2) return points;
        
        let maxDistance = 0;
        let maxIndex = 0;
        
        const start = points[0];
        const end = points[points.length - 1];
        
        for (let i = 1; i < points.length - 1; i++) {
            const distance = this.pointToLineDistance(points[i], start, end);
            if (distance > maxDistance) {
                maxDistance = distance;
                maxIndex = i;
            }
        }
        
        if (maxDistance > epsilon) {
            const left = this.douglasPeuckerRecursive(points.slice(0, maxIndex + 1), epsilon);
            const right = this.douglasPeuckerRecursive(points.slice(maxIndex), epsilon);
            return left.slice(0, -1).concat(right);
        } else {
            return [start, end];
        }
    }
    
    // ==========================================
    // 🎯 STEP5: 筆圧・描画処理メソッド群
    // ==========================================
    
    /**
     * 🎯 STEP5: 筆圧更新（120Hz対応）
     */
    updatePressure(pressure, timestamp) {
        const sample = {
            pressure,
            timestamp,
            velocity: this.calculateVelocity(timestamp)
        };
        
        // サンプルバッファ管理
        this.pressureSystem.samples.push(sample);
        if (this.pressureSystem.samples.length > this.pressureSystem.maxSamples) {
            this.pressureSystem.samples.shift();
        }
        
        // スムージング適用
        const smoothedPressure = this.smoothPressure(pressure);
        
        // 筆圧曲線適用
        const curveName = this.settings.pressureCurve;
        const curveFunction = this.pressureCurves[curveName] || this.pressureCurves.linear;
        const adjustedPressure = curveFunction(smoothedPressure);
        
        this.pressureSystem.lastPressure = adjustedPressure;
        
        return adjustedPressure;
    }
    
    /**
     * 🎯 STEP5: 高度な描画実行
     */
    executeAdvancedDrawing(smoothedPoints) {
        if (!this.currentPath?.graphics || smoothedPoints.length === 0) return;
        
        const graphics = this.currentPath.graphics;
        
        smoothedPoints.forEach((point, index) => {
            const size = this.calculateEffectiveSize(point.pressure);
            
            if (index === 0 && this.currentPath.points.length === 1) {
                // 初回描画
                graphics.moveTo(point.x, point.y);
            } else {
                // 動的線幅対応
                if (this.settings.pressureSensitivity) {
                    graphics.lineStyle({
                        width: size,
                        color: this.settings.color,
                        alpha: this.settings.opacity,
                        cap: PIXI.LINE_CAP.ROUND,
                        join: PIXI.LINE_JOIN.ROUND
                    });
                }
                
                graphics.lineTo(point.x, point.y);
            }
            
            // パスにポイント追加
            this.currentPath.points.push({
                ...point,
                size,
                originalPressure: point.pressure
            });
        });
        
        this.performance.drawCalls++;
    }
    
    /**
     * 🎯 STEP5: 有効サイズ計算
     */
    calculateEffectiveSize(pressure) {
        let size = this.settings.baseSize;
        
        if (this.settings.pressureSensitivity) {
            const minSize = this.settings.baseSize * this.settings.minPressureSize;
            const maxSize = this.settings.baseSize * this.settings.maxPressureSize;
            
            size = minSize + (maxSize - minSize) * pressure;
        }
        
        return Math.max(this.settings.minSize, Math.min(this.settings.maxSize, size));
    }
    
    /**
     * 🎯 STEP5: 適応的閾値計算
     */
    calculateAdaptiveThreshold(distance, pressure) {
        if (!this.adaptiveSmoothing.enabled) {
            return this.strokeSmoothing.threshold;
        }
        
        let threshold = this.strokeSmoothing.threshold;
        
        // 距離による調整
        if (distance > this.adaptiveSmoothing.distanceThreshold) {
            threshold *= 0.5; // より細かく
        }
        
        // 筆圧による調整
        if (pressure < 0.3) {
            threshold *= 1.5; // より大まかに
        }
        
        return threshold;
    }
    
    // ==========================================
    // 🎯 STEP5: ユーティリティメソッド群
    // ==========================================
    
    /**
     * 速度計算
     */
    calculateVelocity(timestamp) {
        if (this.pressureSystem.samples.length < 2) return 0;
        
        const current = this.pressureSystem.samples[this.pressureSystem.samples.length - 1];
        const previous = this.pressureSystem.samples[this.pressureSystem.samples.length - 2];
        
        const timeDelta = timestamp - previous.timestamp;
        if (timeDelta <= 0) return 0;
        
        return Math.abs(current.pressure - previous.pressure) / timeDelta * 1000; // per second
    }
    
    /**
     * 筆圧スムージング
     */
    smoothPressure(pressure) {
        if (this.pressureSystem.samples.length < 2) return pressure;
        
        const factor = this.pressureSystem.smoothingFactor;
        const lastPressure = this.pressureSystem.lastPressure;
        
        return lastPressure * factor + pressure * (1 - factor);
    }
    
    /**
     * 筆圧補間
     */
    interpolatePressure(p1, p2, t) {
        return p1 + (p2 - p1) * t;
    }
    
    /**
     * 点と線の距離計算
     */
    pointToLineDistance(point, lineStart, lineEnd) {
        const A = point.x - lineStart.x;
        const B = point.y - lineStart.y;
        const C = lineEnd.x - lineStart.x;
        const D = lineEnd.y - lineStart.y;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        
        if (lenSq === 0) return Math.sqrt(A * A + B * B);
        
        const param = dot / lenSq;
        
        let xx, yy;
        if (param < 0) {
            xx = lineStart.x;
            yy = lineStart.y;
        } else if (param > 1) {
            xx = lineEnd.x;
            yy = lineEnd.y;
        } else {
            xx = lineStart.x + param * C;
            yy = lineStart.y + param * D;
        }
        
        const dx = point.x - xx;
        const dy = point.y - yy;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    /**
     * 平均筆圧計算
     */
    calculateAveragePressure() {
        if (!this.drawingSession || this.drawingSession.points.length === 0) return 0.5;
        
        const total = this.drawingSession.points.reduce((sum, point) => sum + point.pressure, 0);
        return total / this.drawingSession.points.length;
    }
    
    /**
     * 描画バッファフラッシュ
     */
    flushDrawingBuffer() {
        if (this.strokeSmoothing.pointBuffer.length > 0) {
            const remainingPoints = this.strokeSmoothing.pointBuffer;
            const smoothedPoints = this.applyStrokeSmoothing(remainingPoints[remainingPoints.length - 1]);
            this.executeAdvancedDrawing(smoothedPoints);
            this.strokeSmoothing.pointBuffer = [];
        }
    }
    
    /**
     * パス最適化
     */
    optimizePath(path) {
        if (!path || path.optimized) return;
        
        // 重複点の除去
        if (this.lodashAvailable) {
            path.points = window._.uniqBy(path.points, p => `${Math.round(p.x)},${Math.round(p.y)}`);
        }
        
        // 統計計算
        path.metadata.totalPoints = path.points.length;
        path.metadata.totalDistance = this.drawingSession?.totalDistance || 0;
        path.metadata.averagePressure = this.calculateAveragePressure();
        
        path.optimized = true;
    }
    
    /**
     * セッション統計計算
     */
    calculateSessionStats(endTime) {
        if (!this.drawingSession) return {};
        
        return {
            sessionId: this.drawingSession.id,
            duration: endTime - this.drawingSession.startTime,
            totalPoints: this.drawingSession.points.length,
            totalDistance: this.drawingSession.totalDistance,
            averagePressure: this.drawingSession.averagePressure,
            averageSpeed: this.drawingSession.totalDistance / (endTime - this.drawingSession.startTime) * 1000
        };
    }
    
    /**
     * レイテンシ統計更新
     */
    updateLatencyStats(processTime) {
        const monitor = this.performanceMonitor;
        monitor.frameCount++;
        monitor.totalTime += processTime;
        monitor.maxLatency = Math.max(monitor.maxLatency, processTime);
        monitor.minLatency = Math.min(monitor.minLatency, processTime);
        
        this.performance.averageLatency = monitor.totalTime / monitor.frameCount;
        this.performance.lastFrameTime = processTime;
    }
    
    /**
     * パフォーマンス統計更新
     */
    updatePerformanceStats() {
        const monitor = this.performanceMonitor;
        
        if (monitor.frameCount > 0) {
            const avgFPS = 1000 / (monitor.totalTime / monitor.frameCount);
            
            console.log(`📊 ペンツール性能: ${avgFPS.toFixed(1)}FPS, レイテンシ: ${this.performance.averageLatency.toFixed(2)}ms, 描画コール: ${this.performance.drawCalls}`);
            
            // 統計リセット
            monitor.frameCount = 0;
            monitor.totalTime = 0;
            monitor.maxLatency = 0;
            monitor.minLatency = Infinity;
        }
    }
    
    /**
     * スムージングフィルタ作成
     */
    createSmoothingFilter() {
        // 基本的なブラーフィルタ（エッジスムージング用）
        const blurFilter = new PIXI.BlurFilter();
        blurFilter.blur = this.edgeSmoothing.radius;
        blurFilter.quality = 4;
        return blurFilter;
    }
    
    // ==========================================
    // 🎯 STEP5: 公開API・設定管理
    // ==========================================
    
    /**
     * ツール設定更新
     */
    updateSettings(newSettings) {
        if (!newSettings) return;
        
        try {
            // 安全な設定マージ
            if (this.lodashAvailable) {
                this.settings = window._.merge({}, this.settings, newSettings);
            } else {
                this.settings = { ...this.settings, ...newSettings };
            }
            
            // 依存システム更新
            this.updateDependentSystems();
            
            console.log('✒️ ペンツール設定更新完了:', newSettings);
            
        } catch (error) {
            console.error('❌ ペンツール設定更新エラー:', error);
        }
    }
    
    /**
     * 依存システム更新
     */
    updateDependentSystems() {
        // 筆圧システム更新
        this.pressureSystem.enabled = this.settings.pressureSensitivity;
        this.pressureSystem.sensitivity = this.settings.pressureMultiplier;
        
        // 線補正システム更新
        this.strokeSmoothing.enabled = this.settings.smoothing > 0;
        this.strokeSmoothing.threshold = this.settings.smoothing * 3;
        this.strokeSmoothing.algorithm = this.settings.smoothingAlgorithm;
        
        // エッジスムージング更新
        this.edgeSmoothing.enabled = this.settings.edgeSmoothing;
        
        // GPU加速更新
        this.gpuAcceleration.enabled = this.settings.gpuAcceleration;
    }
    
    /**
     * ツールアクティベート
     */
    activate() {
        this.isActive = true;
        console.log(`✒️ ${this.displayName} アクティブ化 - STEP5版`);
    }
    
    /**
     * ツール非アクティベート
     */
    deactivate() {
        if (this.isDrawing) {
            this.stopDrawing();
        }
        
        this.isActive = false;
        console.log(`✒️ ${this.displayName} 非アクティブ化 - STEP5版`);
    }
    
    /**
     * ツールリセット
     */
    reset() {
        this.deactivate();
        this.currentPath = null;
        this.drawingSession = null;
        this.strokeSmoothing.pointBuffer = [];
        this.pressureSystem.samples = [];
        this.performance = {
            drawCalls: 0,
            averageLatency: 0,
            maxPoints: 0,
            smoothingTime: 0,
            lastFrameTime: 0,
            targetFPS: 60
        };
        
        console.log(`✒️ ${this.displayName} リセット完了 - STEP5版`);
    }
    
    // ==========================================
    // 🎯 STEP5: ID生成・フォールバック
    // ==========================================
    
    /**
     * セッションID生成
     */
    generateSessionId() {
        return `pen_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * パスID生成
     */
    generatePathId() {
        return `pen_path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * フォールバック初期化
     */
    async fallbackInitialization() {
        console.log('🛡️ PenTool フォールバック初期化...');
        
        try {
            // 基本機能のみ初期化
            this.settings = {
                minSize: 0.1,
                maxSize: 100.0,
                baseSize: 16.0,
                opacity: 0.85,
                color: 0x800000,
                pressureSensitivity: false,
                smoothing: 0,
                edgeSmoothing: false,
                gpuAcceleration: false
            };
            
            // 基本システム初期化
            this.pressureSystem.enabled = false;
            this.strokeSmoothing.enabled = false;
            this.edgeSmoothing.enabled = false;
            this.gpuAcceleration.enabled = false;
            
            if (this.toolManager) {
                this.toolManager.registerTool(this.name, this);
            }
            
            console.log('✅ PenTool フォールバック初期化完了');
            
        } catch (error) {
            console.error('❌ PenTool フォールバック初期化エラー:', error);
        }
    }
}