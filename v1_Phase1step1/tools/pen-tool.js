/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール - 境界越え描画統合
 * 
 * 🎯 SCOPE: キャンバス外から内への描画開始対応
 * 🎯 DEPENDENCIES: PenTool, BoundaryEventHandler, 統一システム
 * 🎯 UNIFIED: ConfigManager, ErrorManager, EventBus, StateManager
 * 🎯 ISOLATION: 既存描画機能の非回帰・境界処理独立性
 * 📋 PHASE: Phase1.2-STEP2
 */

// ==========================================
// 🎯 PenTool境界越え対応拡張メソッド群
// ==========================================

/**
 * PenToolクラスに追加するメソッド群
 * 既存のPenToolコンストラクターに以下を追加
 */

// PenToolコンストラクター内に追加する境界システム初期化
function initializeBoundarySupport() {
    console.log('🎯 PenTool境界越えサポート初期化...');
    
    try {
        // 境界描画設定
        this.boundaryDrawing = {
            enabled: this.configManager?.get('tools.pen.boundary.enabled') ?? true,
            continuousDrawing: this.configManager?.get('tools.pen.boundary.continuousDrawing') ?? true,
            pressureInterpolation: this.configManager?.get('tools.pen.boundary.pressureInterpolation') ?? true,
            smoothingEnabled: this.configManager?.get('tools.pen.boundary.smoothingEnabled') ?? true,
            debugMode: this.configManager?.get('tools.pen.boundary.debugging') ?? false
        };
        
        // 境界描画状態
        this.boundaryState = {
            isFromBoundary: false,
            outsideStartTime: null,
            crossInTime: null,
            interpolatedStart: null,
            boundarySession: null
        };
        
        // 境界描画統計
        this.boundaryStats = {
            crossInEvents: 0,
            successfulStarts: 0,
            errors: 0,
            averageDelay: 0,
            totalBoundaryStrokes: 0
        };
        
        // ConfigManager境界設定デフォルト値設定
        this.ensureBoundaryConfig();
        
        // EventBus境界イベント監視
        this.setupBoundaryEventListeners();
        
        console.log('✅ PenTool境界越えサポート初期化完了');
        
        return true;
        
    } catch (error) {
        this.safeError(`境界サポート初期化エラー: ${error.message}`, 'warning');
        return false;
    }
}

/**
 * 境界設定デフォルト値確保
 */
function ensureBoundaryConfig() {
    if (!this.configManager) return;
    
    // デフォルト境界設定
    const defaultBoundaryConfig = {
        enabled: true,
        continuousDrawing: true,
        pressureInterpolation: true,
        smoothingEnabled: true,
        debugging: false,
        interpolationMethod: 'linear', // linear, spline, bezier
        startPointAdjustment: true,
        pressureBlending: 0.8
    };
    
    // ConfigManager設定確保
    if (!this.configManager.get('tools.pen.boundary')) {
        this.configManager.set('tools.pen.boundary', defaultBoundaryConfig);
    }
    
    console.log('⚙️ 境界描画設定確保完了');
}

/**
 * 境界イベントリスナー設定
 */
function setupBoundaryEventListeners() {
    if (!this.eventBus) return;
    
    // 境界越えイベント監視
    this.eventBus.on('boundary.cross.in', (data) => {
        this.handleBoundaryCrossInEvent(data);
    });
    
    // 境界追跡状態変更
    this.eventBus.on('boundary.tracking.state', (data) => {
        this.handleBoundaryTrackingState(data);
    });
    
    // キャンバス境界初期化完了
    this.eventBus.on('canvas.boundary.initialized', (data) => {
        console.log('📡 PenTool: キャンバス境界システム初期化完了通知受信');
        this.boundaryDrawing.systemReady = true;
    });
    
    console.log('📡 境界イベントリスナー設定完了');
}

// ==========================================
// 🎯 境界越え描画処理メイン
// ==========================================

/**
 * 境界越え描画開始処理（BoundaryEventHandlerから直接呼び出し）
 */
function handleBoundaryCrossIn(x, y, pointerEvent) {
    if (!this.isActive || !this.boundaryDrawing.enabled) {
        return false;
    }
    
    const startTime = performance.now();
    
    try {
        console.log(`🎯 PenTool境界越え描画開始: (${x.toFixed(2)}, ${y.toFixed(2)})`);
        
        // 境界描画セッション開始
        this.startBoundaryDrawingSession(x, y, pointerEvent, startTime);
        
        // 筆圧取得・補間
        const pressure = this.getBoundaryPressure(pointerEvent);
        
        // 境界越え専用描画開始
        const success = this.startBoundaryDrawing(x, y, pressure, startTime);
        
        if (success) {
            // 統計更新
            this.boundaryStats.crossInEvents++;
            this.boundaryStats.successfulStarts++;
            
            // EventBus通知
            this.emitEvent('BOUNDARY_DRAWING_STARTED', {
                tool: this.name,
                position: { x, y },
                pressure,
                fromBoundary: true,
                sessionId: this.boundaryState.boundarySession?.id,
                delay: startTime - (this.boundaryState.outsideStartTime || startTime)
            });
            
            console.log(`✅ 境界越え描画開始成功: セッション${this.boundaryState.boundarySession?.id}`);
        }
        
        return success;
        
    } catch (error) {
        this.boundaryStats.errors++;
        this.safeError(`境界越え描画エラー: ${error.message}`, 'warning');
        
        // ErrorManager統一エラー処理
        if (this.errorManager) {
            this.errorManager.showError('boundary-drawing', 
                `境界越え描画開始失敗: ${error.message}`, 
                { tool: this.name, position: { x, y }, pointerEvent }
            );
        }
        
        return false;
    }
}

/**
 * 境界描画セッション開始
 */
function startBoundaryDrawingSession(x, y, pointerEvent, startTime) {
    // 境界セッション情報
    this.boundaryState.boundarySession = {
        id: this.generateBoundarySessionId(),
        startTime,
        crossInPosition: { x, y },
        pointerType: pointerEvent.pointerType || 'mouse',
        pointerId: pointerEvent.pointerId,
        originalPressure: pointerEvent.pressure || 0.5,
        outsideOrigin: null // 後で設定
    };
    
    this.boundaryState.isFromBoundary = true;
    this.boundaryState.crossInTime = startTime;
    
    if (this.boundaryDrawing.debugMode) {
        console.log('🔍 境界描画セッション開始:', this.boundaryState.boundarySession);
    }
}

/**
 * 境界越え描画開始（通常startDrawingのバイパス版）
 */
function startBoundaryDrawing(x, y, pressure, timestamp) {
    if (!this.toolManager?.appCore) {
        this.safeError('AppCore未初期化 - 境界描画', 'warning');
        return false;
    }
    
    try {
        // 通常描画状態設定（境界チェックをバイパス）
        this.isDrawing = true;
        
        // 境界専用描画セッション作成
        this.drawingSession = {
            id: this.generateSessionId(),
            startTime: timestamp,
            points: [],
            totalDistance: 0,
            averagePressure: pressure,
            smoothedPoints: [],
            fromBoundary: true,
            boundarySessionId: this.boundaryState.boundarySession?.id
        };
        
        // 筆圧システム初期化（境界対応）
        this.initializeBoundaryPressureSystem(pressure, timestamp);
        
        // 境界補正された開始点
        const adjustedPoint = this.adjustBoundaryStartPoint(x, y, pressure, timestamp);
        
        // 点バッファ初期化
        this.strokeSmoothing.pointBuffer = [adjustedPoint];
        
        // 高度なパス作成（境界対応）
        this.currentPath = this.createBoundaryPath(adjustedPoint.x, adjustedPoint.y, adjustedPoint.pressure);
        
        // メモリ管理記録
        if (this.memoryManager) {
            this.memoryManager.recordAction('BOUNDARY_DRAW_START', {
                tool: this.name,
                startPoint: adjustedPoint,
                sessionId: this.drawingSession.id,
                boundarySessionId: this.boundaryState.boundarySession?.id
            });
        }
        
        console.log(`🎯 境界越え描画開始完了: セッション${this.drawingSession.id}`);
        
        return true;
        
    } catch (error) {
        this.safeError(`境界描画開始エラー: ${error.message}`, 'error');
        this.isDrawing = false;
        return false;
    }
}

/**
 * 境界筆圧システム初期化
 */
function initializeBoundaryPressureSystem(pressure, timestamp) {
    // 筆圧サンプル初期化（境界補間用）
    this.pressureSystem.lastPressure = pressure;
    this.pressureSystem.samples = [{
        pressure,
        timestamp,
        velocity: 0,
        fromBoundary: true
    }];
    
    // 境界筆圧補間設定
    if (this.boundaryDrawing.pressureInterpolation) {
        this.pressureSystem.boundaryInterpolation = {
            enabled: true,
            startPressure: pressure,
            blendFactor: this.configManager?.get('tools.pen.boundary.pressureBlending') || 0.8
        };
    }
}

/**
 * 境界開始点調整
 */
function adjustBoundaryStartPoint(x, y, pressure, timestamp) {
    let adjustedPoint = { x, y, pressure, timestamp };
    
    // 境界開始点調整が有効な場合
    if (this.boundaryDrawing.continuousDrawing && 
        this.configManager?.get('tools.pen.boundary.startPointAdjustment')) {
        
        // キャンバスエッジからの距離計算
        const canvasRect = this.getCanvasRect();
        if (canvasRect) {
            const edgeDistance = this.calculateEdgeDistance(x, y, canvasRect);
            
            // エッジ近くの場合、若干内側に調整
            if (edgeDistance < 5) {
                const adjustment = this.calculateBoundaryAdjustment(x, y, canvasRect);
                adjustedPoint.x += adjustment.x;
                adjustedPoint.y += adjustment.y;
                
                if (this.boundaryDrawing.debugMode) {
                    console.log(`🔧 境界開始点調整: (${x}, ${y}) → (${adjustedPoint.x}, ${adjustedPoint.y})`);
                }
            }
        }
    }
    
    return adjustedPoint;
}

/**
 * 境界対応パス作成
 */
function createBoundaryPath(x, y, pressure) {
    const pathId = this.generatePathId();
    const size = this.calculateEffectiveSize(pressure);
    
    const path = {
        id: pathId,
        tool: this.name,
        version: this.version,
        startTime: performance.now(),
        points: [{ x, y, pressure, size, timestamp: performance.now(), fromBoundary: true }],
        settings: { ...this.settings },
        graphics: null,
        optimized: false,
        metadata: {
            sessionId: this.drawingSession?.id,
            boundarySessionId: this.boundaryState.boundarySession?.id,
            unifiedSystems: true,
            gpuAccelerated: this.gpuAcceleration.enabled,
            fromBoundary: true,
            boundaryMethod: 'direct-cross-in'
        }
    };
    
    // 境界対応グラフィクス作成
    path.graphics = this.createBoundaryPixiGraphics(path);
    
    if (this.toolManager.appCore.drawingContainer) {
        this.toolManager.appCore.drawingContainer.addChild(path.graphics);
        this.toolManager.appCore.paths.push(path);
    }
    
    return path;
}

/**
 * 境界対応PixiJSグラフィクス作成
 */
function createBoundaryPixiGraphics(path) {
    const graphics = new PIXI.Graphics();
    
    const color = this.settings.color;
    const alpha = this.settings.opacity;
    
    // 境界描画用の線スタイル（若干異なる設定）
    graphics.lineStyle({
        width: this.settings.baseSize,
        color: color,
        alpha: alpha * 0.95, // 境界描画は若干透明度調整
        cap: PIXI.LINE_CAP.ROUND,
        join: PIXI.LINE_JOIN.ROUND
    });
    
    // 境界描画専用フィルター（有効な場合）
    if (this.settings.edgeSmoothing && graphics.filters) {
        graphics.filters = [this.createBoundarySmoothingFilter()];
    }
    
    // デバッグモード：境界描画の視覚的区別
    if (this.boundaryDrawing.debugMode) {
        graphics.tint = 0xFF9999; // 薄赤色でデバッグ表示
    }
    
    return graphics;
}

/**
 * 境界スムージングフィルター作成
 */
function createBoundarySmoothingFilter() {
    const blurFilter = new PIXI.BlurFilter();
    blurFilter.blur = this.edgeSmoothing.radius * 0.8; // 境界描画は若干弱めのスムージング
    blurFilter.quality = 4;
    return blurFilter;
}

// ==========================================
// 🎯 境界イベント処理・統合
// ==========================================

/**
 * EventBus境界越えイベント処理
 */
function handleBoundaryCrossInEvent(data) {
    if (!this.isActive || data.tool !== this) {
        return;
    }
    
    // 境界越えイベントデータ記録
    this.boundaryState.outsideStartTime = data.outsideStart ? Date.now() - data.delay : null;
    
    if (this.boundaryState.boundarySession) {
        this.boundaryState.boundarySession.outsideOrigin = data.outsideStart;
        this.boundaryState.boundarySession.delay = data.delay || 0;
    }
    
    // 統計更新
    const delay = data.delay || 0;
    this.updateBoundaryDelayStats(delay);
    
    console.log(`📡 PenTool境界越えEventBusイベント処理: 遅延${delay.toFixed(1)}ms`);
}

/**
 * 境界追跡状態変更処理
 */
function handleBoundaryTrackingState(data) {
    if (data.active && !this.boundaryState.trackingActive) {
        // 境界追跡開始
        this.boundaryState.trackingActive = true;
        
        if (this.boundaryDrawing.debugMode) {
            console.log('🔍 PenTool: 境界追跡開始');
        }
    } else if (!data.active && this.boundaryState.trackingActive) {
        // 境界追跡終了
        this.boundaryState.trackingActive = false;
        this.cleanupBoundaryState();
        
        if (this.boundaryDrawing.debugMode) {
            console.log('🔍 PenTool: 境界追跡終了');
        }
    }
}

/**
 * 境界状態クリーンアップ
 */
function cleanupBoundaryState() {
    this.boundaryState.isFromBoundary = false;
    this.boundaryState.outsideStartTime = null;
    this.boundaryState.crossInTime = null;
    this.boundaryState.interpolatedStart = null;
    this.boundaryState.boundarySession = null;
    
    // 筆圧システム境界モードリセット
    if (this.pressureSystem.boundaryInterpolation) {
        this.pressureSystem.boundaryInterpolation.enabled = false;
    }
}

// ==========================================
// 🎯 境界特化ユーティリティ
// ==========================================

/**
 * 境界筆圧取得・補間
 */
function getBoundaryPressure(pointerEvent) {
    let pressure = pointerEvent.pressure || 0.5;
    
    // 境界筆圧補間（有効な場合）
    if (this.boundaryDrawing.pressureInterpolation) {
        const method = this.configManager?.get('tools.pen.boundary.interpolationMethod') || 'linear';
        pressure = this.interpolateBoundaryPressure(pressure, method);
    }
    
    return Math.max(0.1, Math.min(1.0, pressure));
}

/**
 * 境界筆圧補間
 */
function interpolateBoundaryPressure(pressure, method) {
    const blendFactor = this.configManager?.get('tools.pen.boundary.pressureBlending') || 0.8;
    const lastPressure = this.pressureSystem.lastPressure;
    
    switch (method) {
        case 'linear':
            return lastPressure * blendFactor + pressure * (1 - blendFactor);
        
        case 'spline':
            // 簡易スプライン補間
            const smoothFactor = 0.6;
            return lastPressure + (pressure - lastPressure) * smoothFactor;
        
        case 'bezier':
            // ベジエ風補間
            const t = 0.7;
            return lastPressure * (1 - t) * (1 - t) + 2 * (1 - t) * t * pressure + t * t * pressure;
        
        default:
            return pressure;
    }
}

/**
 * キャンバス領域取得（境界処理用）
 */
function getCanvasRect() {
    if (this.toolManager?.appCore?.app?.view) {
        return this.toolManager.appCore.app.view.getBoundingClientRect();
    }
    
    // フォールバック：canvasManager経由
    if (window.canvasManager?.canvasElement) {
        return window.canvasManager.canvasElement.getBoundingClientRect();
    }
    
    return null;
}

/**
 * エッジ距離計算
 */
function calculateEdgeDistance(x, y, canvasRect) {
    const distanceToLeft = x - canvasRect.left;
    const distanceToRight = canvasRect.right - x;
    const distanceToTop = y - canvasRect.top;
    const distanceToBottom = canvasRect.bottom - y;
    
    return Math.min(distanceToLeft, distanceToRight, distanceToTop, distanceToBottom);
}

/**
 * 境界調整計算
 */
function calculateBoundaryAdjustment(x, y, canvasRect) {
    const margin = 3; // 内側への調整量
    let adjustX = 0, adjustY = 0;
    
    // 各エッジでの調整
    if (x - canvasRect.left < margin) {
        adjustX = margin - (x - canvasRect.left);
    } else if (canvasRect.right - x < margin) {
        adjustX = -(margin - (canvasRect.right - x));
    }
    
    if (y - canvasRect.top < margin) {
        adjustY = margin - (y - canvasRect.top);
    } else if (canvasRect.bottom - y < margin) {
        adjustY = -(margin - (canvasRect.bottom - y));
    }
    
    return { x: adjustX, y: adjustY };
}

/**
 * 境界遅延統計更新
 */
function updateBoundaryDelayStats(delay) {
    const stats = this.boundaryStats;
    
    if (stats.crossInEvents === 0) {
        stats.averageDelay = delay;
    } else {
        stats.averageDelay = (stats.averageDelay * stats.crossInEvents + delay) / (stats.crossInEvents + 1);
    }
}

/**
 * 境界セッションID生成
 */
function generateBoundarySessionId() {
    return `boundary_pen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ==========================================
// 🎯 既存メソッドのオーバーライド・拡張
// ==========================================

/**
 * continueDrawing拡張（境界継続描画対応）
 */
function enhancedContinueDrawing(x, y, pressure = 0.5, timestamp = performance.now()) {
    // 境界描画中の特別処理
    if (this.boundaryState.isFromBoundary && this.isDrawing) {
        return this.continueBoundaryDrawing(x, y, pressure, timestamp);
    }
    
    // 通常のcontinueDrawing処理
    return this.originalContinueDrawing ? 
           this.originalContinueDrawing(x, y, pressure, timestamp) :
           this.continueDrawing(x, y, pressure, timestamp);
}

/**
 * 境界継続描画
 */
function continueBoundaryDrawing(x, y, pressure, timestamp) {
    if (!this.isDrawing || !this.currentPath || !this.drawingSession) {
        return false;
    }
    
    try {
        // 境界筆圧補間適用
        const adjustedPressure = this.getBoundaryPressure({ pressure });
        
        // 通常の継続描画処理
        const result = this.continueDrawing(x, y, adjustedPressure, timestamp);
        
        // 境界描画統計更新
        if (result) {
            this.boundaryStats.totalBoundaryStrokes++;
        }
        
        return result;
        
    } catch (error) {
        this.safeError(`境界継続描画エラー: ${error.message}`, 'warning');
        return false;
    }
}

/**
 * stopDrawing拡張（境界終了処理対応）
 */
function enhancedStopDrawing(timestamp = performance.now()) {
    // 境界描画終了の特別処理
    if (this.boundaryState.isFromBoundary && this.isDrawing) {
        const result = this.stopBoundaryDrawing(timestamp);
        this.cleanupBoundaryState();
        return result;
    }
    
    // 通常のstopDrawing処理
    return this.originalStopDrawing ? 
           this.originalStopDrawing(timestamp) :
           this.stopDrawing(timestamp);
}

/**
 * 境界描画終了
 */
function stopBoundaryDrawing(timestamp) {
    try {
        // 境界セッション統計
        const boundaryStats = this.calculateBoundarySessionStats(timestamp);
        
        // 通常の描画終了処理
        const result = this.stopDrawing(timestamp);
        
        if (result) {
            // 境界描画完了イベント
            this.emitEvent('BOUNDARY_DRAWING_ENDED', {
                tool: this.name,
                sessionId: this.drawingSession?.id,
                boundarySessionId: this.boundaryState.boundarySession?.id,
                pathId: result.id,
                stats: boundaryStats
            });
            
            console.log(`🎯 境界描画終了: ${boundaryStats.totalPoints}pts, 遅延:${boundaryStats.initialDelay.toFixed(1)}ms`);
        }
        
        return result;
        
    } catch (error) {
        this.safeError(`境界描画終了エラー: ${error.message}`, 'error');
        return null;
    }
}

/**
 * 境界セッション統計計算
 */
function calculateBoundarySessionStats(endTime) {
    const baseStats = this.calculateSessionStats ? this.calculateSessionStats(endTime) : {};
    
    return {
        ...baseStats,
        fromBoundary: true,
        boundarySessionId: this.boundaryState.boundarySession?.id,
        initialDelay: this.boundaryState.boundarySession?.delay || 0,
        crossInPosition: this.boundaryState.boundarySession?.crossInPosition,
        pointerType: this.boundaryState.boundarySession?.pointerType,
        boundaryMethod: 'direct-cross-in'
    };
}

// ==========================================
// 🎯 境界システム診断・デバッグ
// ==========================================

/**
 * 境界描画システム診断
 */
function runBoundaryDiagnosis() {
    console.group('🔍 PenTool境界描画システム診断');
    
    const diagnosis = {
        configuration: {
            enabled: this.boundaryDrawing.enabled,
            continuousDrawing: this.boundaryDrawing.continuousDrawing,
            pressureInterpolation: this.boundaryDrawing.pressureInterpolation,
            smoothingEnabled: this.boundaryDrawing.smoothingEnabled,
            debugMode: this.boundaryDrawing.debugMode
        },
        runtime: {
            isActive: this.isActive,
            systemReady: this.boundaryDrawing.systemReady,
            isFromBoundary: this.boundaryState.isFromBoundary,
            trackingActive: this.boundaryState.trackingActive,
            currentSession: this.boundaryState.boundarySession?.id || null
        },
        statistics: { ...this.boundaryStats },
        integration: {
            configManager: !!this.configManager,
            errorManager: !!this.errorManager,
            eventBus: !!this.eventBus,
            toolManager: !!this.toolManager,
            canvasManager: !!window.canvasManager
        }
    };
    
    console.log('📊 診断結果:', diagnosis);
    
    // 問題検出
    const issues = [];
    
    if (!diagnosis.configuration.enabled) {
        issues.push('境界描画機能が無効化されています');
    }
    
    if (!diagnosis.integration.eventBus) {
        issues.push('EventBus統合が不完全です');
    }
    
    if (!diagnosis.runtime.systemReady) {
        issues.push('境界システムの準備が未完了です');
    }
    
    if (diagnosis.statistics.errors > diagnosis.statistics.successfulStarts * 0.1) {
        issues.push('エラー率が高すぎます（10%超）');
    }
    
    if (issues.length > 0) {
        console.warn('⚠️ 検出された問題:', issues);
    } else {
        console.log('✅ 境界描画システム正常動作中');
    }
    
    console.groupEnd();
    
    return diagnosis;
}

/**
 * 境界描画統計取得
 */
function getBoundaryStats() {
    return {
        ...this.boundaryStats,
        configuration: { ...this.boundaryDrawing },
        currentState: { ...this.boundaryState },
        performance: {
            averageDelay: this.boundaryStats.averageDelay,
            successRate: this.boundaryStats.successfulStarts / Math.max(this.boundaryStats.crossInEvents, 1),
            errorRate: this.boundaryStats.errors / Math.max(this.boundaryStats.crossInEvents, 1)
        }
    };
}

// ==========================================
// 🎯 PenTool統合メソッド・初期化ガイド
// ==========================================

/**
 * PenToolクラスに境界システム統合
 * 既存のPenToolクラスのコンストラクター最後に追加
 */
function integrateBoundarySystem() {
    // 境界システム初期化
    this.initializeBoundarySupport = initializeBoundarySupport.bind(this);
    this.ensureBoundaryConfig = ensureBoundaryConfig.bind(this);
    this.setupBoundaryEventListeners = setupBoundaryEventListeners.bind(this);
    
    // 境界描画メソッド
    this.handleBoundaryCrossIn = handleBoundaryCrossIn.bind(this);
    this.startBoundaryDrawingSession = startBoundaryDrawingSession.bind(this);
    this.startBoundaryDrawing = startBoundaryDrawing.bind(this);
    this.initializeBoundaryPressureSystem = initializeBoundaryPressureSystem.bind(this);
    this.adjustBoundaryStartPoint = adjustBoundaryStartPoint.bind(this);
    this.createBoundaryPath = createBoundaryPath.bind(this);
    this.createBoundaryPixiGraphics = createBoundaryPixiGraphics.bind(this);
    this.createBoundarySmoothingFilter = createBoundarySmoothingFilter.bind(this);
    
    // イベント処理
    this.handleBoundaryCrossInEvent = handleBoundaryCrossInEvent.bind(this);
    this.handleBoundaryTrackingState = handleBoundaryTrackingState.bind(this);
    this.cleanupBoundaryState = cleanupBoundaryState.bind(this);
    
    // ユーティリティ
    this.getBoundaryPressure = getBoundaryPressure.bind(this);
    this.interpolateBoundaryPressure = interpolateBoundaryPressure.bind(this);
    this.getCanvasRect = getCanvasRect.bind(this);
    this.calculateEdgeDistance = calculateEdgeDistance.bind(this);
    this.calculateBoundaryAdjustment = calculateBoundaryAdjustment.bind(this);
    this.updateBoundaryDelayStats = updateBoundaryDelayStats.bind(this);
    this.generateBoundarySessionId = generateBoundarySessionId.bind(this);
    
    // 拡張メソッド
    this.enhancedContinueDrawing = enhancedContinueDrawing.bind(this);
    this.continueBoundaryDrawing = continueBoundaryDrawing.bind(this);
    this.enhancedStopDrawing = enhancedStopDrawing.bind(this);
    this.stopBoundaryDrawing = stopBoundaryDrawing.bind(this);
    this.calculateBoundarySessionStats = calculateBoundarySessionStats.bind(this);
    
    // 診断・デバッグ
    this.runBoundaryDiagnosis = runBoundaryDiagnosis.bind(this);
    this.getBoundaryStats = getBoundaryStats.bind(this);
    
    // 境界システム初期化実行
    this.initializeBoundarySupport();
}

/**
 * 既存メソッドのバックアップ・オーバーライド
 */
function setupMethodOverrides() {
    // 既存メソッドバックアップ
    this.originalContinueDrawing = this.continueDrawing;
    this.originalStopDrawing = this.stopDrawing;
    
    // 境界対応版で置換
    this.continueDrawing = this.enhancedContinueDrawing;
    this.stopDrawing = this.enhancedStopDrawing;
}

// ==========================================
// 🎯 グローバル診断コマンド
// ==========================================

/**
 * PenTool境界描画診断コマンド
 */
window.diagnosePenBoundaryDrawing = function() {
    const penTool = window.toolManager?.tools?.pen || 
                   window.futabaDrawingTool?.toolManager?.tools?.pen;
    
    if (!penTool || typeof penTool.runBoundaryDiagnosis !== 'function') {
        return {
            error: 'PenTool境界システムが利用できません',
            penTool: !!penTool,
            boundarySupport: !!penTool?.runBoundaryDiagnosis
        };
    }
    
    return penTool.runBoundaryDiagnosis();
};

/**
 * PenTool境界統計取得コマンド
 */
window.getPenBoundaryStats = function() {
    const penTool = window.toolManager?.tools?.pen || 
                   window.futabaDrawingTool?.toolManager?.tools?.pen;
    
    if (!penTool || typeof penTool.getBoundaryStats !== 'function') {
        return { error: 'PenTool境界統計が利用できません' };
    }
    
    return penTool.getBoundaryStats();
};

// ==========================================
// 🎯 実装完了ログ・統合ガイド
// ==========================================

console.log('🎯 Phase1.2-STEP2 PenTool境界越え描画対応実装完了');
console.log('✅ 実装項目:');
console.log('  - 境界越え描画開始: handleBoundaryCrossIn');
console.log('  - 境界描画セッション管理: startBoundaryDrawing');
console.log('  - 境界筆圧補間システム: interpolateBoundaryPressure');
console.log('  - 境界対応PixiJSグラフィクス: createBoundaryPixiGraphics');
console.log('  - EventBus境界イベント統合: handleBoundaryCrossInEvent');
console.log('  - 既存メソッド拡張: enhancedContinueDrawing/StopDrawing');
console.log('  - 統一システム100%統合: Config/Error/State/EventBus');
console.log('  - 診断・デバッグシステム: runBoundaryDiagnosis');

/**
 * 📋 PenToolへの統合方法:
 * 
 * // PenToolクラスのコンストラクター最後に追加:
 * integrateBoundarySystem.call(this);
 * setupMethodOverrides.call(this);
 * 
 * // initialize()メソッド内で境界システム初期化:
 * this.initializeBoundarySupport();
 * 
 * 使用例:
 * // BoundaryEventHandlerから直接呼び出される
 * penTool.handleBoundaryCrossIn(canvasX, canvasY, pointerEvent);
 * 
 * // 診断実行
 * window.diagnosePenBoundaryDrawing();
 * window.getPenBoundaryStats();
 */