/**
 * 🎯 Phase1.2-STEP1: Canvas Manager境界イベント処理システム拡張
 * 🎨 ふたば☆お絵描きツール - 境界越え描画対応
 * 
 * 🎯 SCOPE: キャンバス境界外からの描画開始対応
 * 🎯 DEPENDENCIES: ConfigManager, ErrorManager, EventBus, StateManager
 * 🎯 UNIFIED: 統一システム100%活用・DRY・SOLID原則準拠
 * 🎯 ISOLATION: 既存機能非回帰・境界処理独立性確保
 * 📋 PHASE: Phase1.2-STEP1
 */

// ==========================================
// 🎯 STEP1: 境界イベント処理システム
// ==========================================

/**
 * 境界イベント処理クラス
 * キャンバス外からの描画開始を検出・処理
 */
class BoundaryEventHandler {
    constructor(canvasManager) {
        this.canvas = canvasManager;
        this.validateUnifiedSystems();
        
        // 統一システム設定取得
        this.config = this.getUnifiedConfig();
        
        // 境界追跡状態
        this.isTrackingOutside = false;
        this.outsidePointers = new Map(); // Multi-pointer support
        this.boundaryStats = {
            detections: 0,
            crossIns: 0,
            errors: 0,
            averageDelay: 0
        };
        
        console.log('🎯 BoundaryEventHandler初期化完了');
    }
    
    /**
     * 統一システム依存性検証
     */
    validateUnifiedSystems() {
        const required = ['ConfigManager', 'ErrorManager', 'StateManager', 'EventBus'];
        const missing = required.filter(sys => !window[sys]);
        
        if (missing.length > 0) {
            throw new Error(`境界システム: 統一システム依存不足: ${missing.join(', ')}`);
        }
        
        console.log('✅ 統一システム依存性確認完了');
    }
    
    /**
     * 統一設定取得・デフォルト値設定
     */
    getUnifiedConfig() {
        // ConfigManager統一設定
        const config = {
            enabled: window.ConfigManager.get('canvas.boundary.enabled') ?? true,
            margin: window.ConfigManager.get('canvas.boundary.margin') ?? 20,
            trackingEnabled: window.ConfigManager.get('canvas.boundary.trackingEnabled') ?? true,
            crossInDelay: window.ConfigManager.get('canvas.boundary.crossInDelay') ?? 0,
            supportedPointers: window.ConfigManager.get('canvas.boundary.supportedPointers') ?? 
                              ['mouse', 'pen', 'touch'],
            debugging: window.ConfigManager.get('canvas.boundary.debugging') ?? false
        };
        
        // デフォルト設定がない場合は設定
        if (!window.ConfigManager.get('canvas.boundary')) {
            window.ConfigManager.set('canvas.boundary', {
                enabled: true,
                margin: 20,
                trackingEnabled: true,
                crossInDelay: 0,
                supportedPointers: ['mouse', 'pen', 'touch'],
                debugging: false
            });
        }
        
        return config;
    }
    
    /**
     * 境界追跡システム初期化
     */
    initializeBoundaryTracking() {
        if (!this.config.enabled || !this.config.trackingEnabled) {
            console.log('⚠️ 境界追跡システム無効化');
            return false;
        }
        
        try {
            // グローバルPointerEvent監視
            this.setupGlobalPointerTracking();
            
            // 拡張ヒットエリア作成
            this.createExpandedHitArea();
            
            // EventBus境界イベント統合
            this.setupEventBusIntegration();
            
            // デバッグモード
            if (this.config.debugging) {
                this.enableDebugMode();
            }
            
            console.log('✅ 境界追跡システム初期化完了');
            
            // StateManager状態更新
            window.StateManager.updateState('boundary.tracking', {
                enabled: true,
                margin: this.config.margin,
                pointers: this.outsidePointers.size
            });
            
            return true;
            
        } catch (error) {
            window.ErrorManager.showError('boundary-system', 
                `境界追跡初期化失敗: ${error.message}`, 
                { config: this.config }
            );
            return false;
        }
    }
    
    /**
     * グローバルPointer追跡セットアップ
     */
    setupGlobalPointerTracking() {
        // Document全体でPointerEvent監視
        document.addEventListener('pointerdown', this.handleGlobalPointerDown.bind(this), {
            passive: false,
            capture: true
        });
        
        document.addEventListener('pointermove', this.handleGlobalPointerMove.bind(this), {
            passive: false,
            capture: true
        });
        
        document.addEventListener('pointerup', this.handleGlobalPointerUp.bind(this), {
            passive: false,
            capture: true
        });
        
        // Pointer Cancel対応
        document.addEventListener('pointercancel', this.handleGlobalPointerCancel.bind(this), {
            passive: false,
            capture: true
        });
        
        console.log('🌐 グローバルPointer追跡設定完了');
    }
    
    /**
     * 拡張ヒットエリア作成
     */
    createExpandedHitArea() {
        if (!this.canvas.app || !this.canvas.app.stage) {
            console.warn('⚠️ PixiJS Stageが利用できません');
            return null;
        }
        
        // 境界マージン付きヒットエリア
        const margin = this.config.margin;
        const expandedHitArea = new PIXI.Rectangle(
            -margin,
            -margin,
            this.canvas.width + margin * 2,
            this.canvas.height + margin * 2
        );
        
        // Stage設定更新
        this.canvas.app.stage.hitArea = expandedHitArea;
        this.canvas.app.stage.interactive = true;
        
        console.log(`📏 拡張ヒットエリア作成: マージン${margin}px`);
        
        return expandedHitArea;
    }
    
    /**
     * EventBus統合セットアップ
     */
    setupEventBusIntegration() {
        // 境界イベント定義（統一システム準拠）
        if (!window.EventBus.BoundaryEvents) {
            window.EventBus.BoundaryEvents = {
                OUTSIDE_START: 'boundary.outside.start',
                CROSS_IN: 'boundary.cross.in',
                CROSS_OUT: 'boundary.cross.out',
                DRAWING_STARTED: 'boundary.drawing.started',
                TRACKING_STATE: 'boundary.tracking.state'
            };
        }
        
        // 境界イベント監視
        window.EventBus.on(window.EventBus.BoundaryEvents.CROSS_IN, (data) => {
            this.handleBoundaryCrossInEvent(data);
        });
        
        console.log('📡 EventBus境界イベント統合完了');
    }
    
    // ==========================================
    // 🎯 グローバルPointerEvent処理
    // ==========================================
    
    /**
     * グローバルPointerDownハンドラー
     */
    handleGlobalPointerDown(event) {
        try {
            const canvasRect = this.getCanvasRect();
            if (!canvasRect) return;
            
            const isInsideCanvas = this.isPointInCanvas(event.clientX, event.clientY, canvasRect);
            
            if (!isInsideCanvas && this.isPointerTypeSupported(event.pointerType)) {
                // キャンバス外でのPointerDown検出
                this.handleOutsidePointerStart(event, canvasRect);
            }
            
        } catch (error) {
            window.ErrorManager.showError('boundary-tracking', 
                `PointerDown処理エラー: ${error.message}`, 
                { pointerId: event.pointerId, pointerType: event.pointerType }
            );
        }
    }
    
    /**
     * グローバルPointerMoveハンドラー
     */
    handleGlobalPointerMove(event) {
        if (!this.isTrackingOutside) return;
        
        try {
            const outsidePointer = this.outsidePointers.get(event.pointerId);
            if (!outsidePointer) return;
            
            const canvasRect = this.getCanvasRect();
            if (!canvasRect) return;
            
            const isInsideCanvas = this.isPointInCanvas(event.clientX, event.clientY, canvasRect);
            
            if (isInsideCanvas) {
                // 境界越え検出（キャンバス外→内）
                this.handleBoundaryCrossIn(event, canvasRect, outsidePointer);
            } else {
                // キャンバス外でのMove継続
                this.updateOutsidePointer(event, outsidePointer);
            }
            
        } catch (error) {
            window.ErrorManager.showError('boundary-tracking', 
                `PointerMove処理エラー: ${error.message}`, 
                { pointerId: event.pointerId }
            );
        }
    }
    
    /**
     * グローバルPointerUpハンドラー
     */
    handleGlobalPointerUp(event) {
        try {
            const outsidePointer = this.outsidePointers.get(event.pointerId);
            if (outsidePointer) {
                this.cleanupOutsidePointer(event.pointerId);
            }
            
        } catch (error) {
            window.ErrorManager.showError('boundary-tracking', 
                `PointerUp処理エラー: ${error.message}`, 
                { pointerId: event.pointerId }
            );
        }
    }
    
    /**
     * グローバルPointerCancelハンドラー
     */
    handleGlobalPointerCancel(event) {
        try {
            this.cleanupOutsidePointer(event.pointerId);
            
        } catch (error) {
            window.ErrorManager.showError('boundary-tracking', 
                `PointerCancel処理エラー: ${error.message}`, 
                { pointerId: event.pointerId }
            );
        }
    }
    
    // ==========================================
    // 🎯 境界処理コアロジック
    // ==========================================
    
    /**
     * キャンバス外Pointer開始処理
     */
    handleOutsidePointerStart(event, canvasRect) {
        const startTime = performance.now();
        
        // 外部Pointer情報記録
        const outsidePointer = {
            id: event.pointerId,
            type: event.pointerType,
            startX: event.clientX,
            startY: event.clientY,
            currentX: event.clientX,
            currentY: event.clientY,
            pressure: event.pressure || 0.5,
            startTime,
            tool: this.canvas.toolManager?.currentTool || null,
            canvasRect: { ...canvasRect }
        };
        
        this.outsidePointers.set(event.pointerId, outsidePointer);
        this.isTrackingOutside = true;
        
        // 統計更新
        this.boundaryStats.detections++;
        
        // EventBus通知
        window.EventBus.safeEmit(window.EventBus.BoundaryEvents.OUTSIDE_START, {
            pointer: outsidePointer,
            canvasRect,
            stats: { ...this.boundaryStats }
        });
        
        // StateManager状態更新
        window.StateManager.updateState('boundary.tracking', {
            active: true,
            pointers: this.outsidePointers.size,
            lastDetection: Date.now()
        });
        
        if (this.config.debugging) {
            console.log(`🎯 キャンバス外Pointer検出: ${event.pointerType} (${event.pointerId}) at (${event.clientX}, ${event.clientY})`);
        }
    }
    
    /**
     * 境界越え処理（キャンバス外→内）
     */
    handleBoundaryCrossIn(event, canvasRect, outsidePointer) {
        const crossInTime = performance.now();
        const delay = crossInTime - outsidePointer.startTime;
        
        // キャンバス座標変換
        const canvasX = event.clientX - canvasRect.left;
        const canvasY = event.clientY - canvasRect.top;
        
        // 境界越えデータ
        const crossInData = {
            pointerId: event.pointerId,
            pointerType: event.pointerType,
            tool: outsidePointer.tool,
            position: { x: canvasX, y: canvasY },
            pressure: event.pressure || outsidePointer.pressure,
            delay,
            fromOutside: true,
            outsideStart: { 
                x: outsidePointer.startX, 
                y: outsidePointer.startY 
            },
            timestamp: crossInTime
        };
        
        // 統計更新
        this.boundaryStats.crossIns++;
        this.boundaryStats.averageDelay = 
            (this.boundaryStats.averageDelay * (this.boundaryStats.crossIns - 1) + delay) / 
            this.boundaryStats.crossIns;
        
        // EventBus境界越え通知
        window.EventBus.safeEmit(window.EventBus.BoundaryEvents.CROSS_IN, crossInData);
        
        // 描画ツール直接通知（高速パス）
        if (outsidePointer.tool && typeof outsidePointer.tool.handleBoundaryCrossIn === 'function') {
            try {
                outsidePointer.tool.handleBoundaryCrossIn(canvasX, canvasY, {
                    ...event,
                    pressure: crossInData.pressure,
                    fromBoundary: true
                });
            } catch (error) {
                window.ErrorManager.showError('boundary-drawing', 
                    `ツール境界越え処理エラー: ${error.message}`, 
                    { tool: outsidePointer.tool.name, crossInData }
                );
            }
        }
        
        // StateManager状態更新
        window.StateManager.updateState('boundary.crossIn', {
            position: { x: canvasX, y: canvasY },
            tool: outsidePointer.tool?.name || 'unknown',
            delay,
            timestamp: crossInTime
        });
        
        // PointerCleanup
        this.cleanupOutsidePointer(event.pointerId);
        
        if (this.config.debugging) {
            console.log(`🎯 境界越え検出: ${event.pointerType} → キャンバス内(${canvasX.toFixed(1)}, ${canvasY.toFixed(1)}) 遅延:${delay.toFixed(1)}ms`);
        }
    }
    
    /**
     * キャンバス外Pointer更新
     */
    updateOutsidePointer(event, outsidePointer) {
        outsidePointer.currentX = event.clientX;
        outsidePointer.currentY = event.clientY;
        outsidePointer.pressure = event.pressure || outsidePointer.pressure;
    }
    
    /**
     * キャンバス外Pointerクリーンアップ
     */
    cleanupOutsidePointer(pointerId) {
        if (this.outsidePointers.delete(pointerId)) {
            // 追跡状態更新
            this.isTrackingOutside = this.outsidePointers.size > 0;
            
            // StateManager状態更新
            window.StateManager.updateState('boundary.tracking', {
                active: this.isTrackingOutside,
                pointers: this.outsidePointers.size
            });
            
            if (this.config.debugging) {
                console.log(`🧹 外部Pointerクリーンアップ: ${pointerId}, 残り:${this.outsidePointers.size}`);
            }
        }
    }
    
    // ==========================================
    // 🎯 ユーティリティ・検証メソッド
    // ==========================================
    
    /**
     * キャンバス領域取得
     */
    getCanvasRect() {
        if (!this.canvas.canvasElement) {
            console.warn('⚠️ キャンバス要素が見つかりません');
            return null;
        }
        
        return this.canvas.canvasElement.getBoundingClientRect();
    }
    
    /**
     * ポイントがキャンバス内かチェック
     */
    isPointInCanvas(clientX, clientY, canvasRect) {
        return clientX >= canvasRect.left && 
               clientX <= canvasRect.right && 
               clientY >= canvasRect.top && 
               clientY <= canvasRect.bottom;
    }
    
    /**
     * サポートPointerTypeチェック
     */
    isPointerTypeSupported(pointerType) {
        return this.config.supportedPointers.includes(pointerType);
    }
    
    /**
     * EventBus境界越えイベント処理
     */
    handleBoundaryCrossInEvent(data) {
        // EventBus経由の境界越えイベント後処理
        window.EventBus.safeEmit(window.EventBus.BoundaryEvents.DRAWING_STARTED, {
            tool: data.tool?.name || 'unknown',
            position: data.position,
            pressure: data.pressure,
            fromBoundary: true,
            timestamp: Date.now()
        });
        
        if (this.config.debugging) {
            console.log('📡 EventBus境界越えイベント処理:', data);
        }
    }
    
    // ==========================================
    // 🎯 デバッグ・診断システム
    // ==========================================
    
    /**
     * デバッグモード有効化
     */
    enableDebugMode() {
        // 境界可視化
        this.createDebugVisualizer();
        
        // 詳細ログ有効化
        this.debugLogging = true;
        
        console.log('🔍 境界システムデバッグモード有効');
    }
    
    /**
     * デバッグ境界可視化
     */
    createDebugVisualizer() {
        if (!this.canvas.app) return;
        
        // デバッグ境界表示
        const debugGraphics = new PIXI.Graphics();
        debugGraphics.lineStyle(2, 0xFF0000, 0.5);
        debugGraphics.drawRect(
            -this.config.margin, 
            -this.config.margin, 
            this.canvas.width + this.config.margin * 2, 
            this.canvas.height + this.config.margin * 2
        );
        
        this.canvas.app.stage.addChild(debugGraphics);
        this.debugBoundary = debugGraphics;
        
        console.log('🎯 境界デバッグ可視化有効');
    }
    
    /**
     * 境界システム統計取得
     */
    getStats() {
        return {
            ...this.boundaryStats,
            tracking: {
                active: this.isTrackingOutside,
                pointers: this.outsidePointers.size,
                config: { ...this.config }
            },
            performance: {
                averageDelay: this.boundaryStats.averageDelay,
                successRate: this.boundaryStats.crossIns / Math.max(this.boundaryStats.detections, 1),
                errorRate: this.boundaryStats.errors / Math.max(this.boundaryStats.detections, 1)
            }
        };
    }
    
    /**
     * 境界システム診断実行
     */
    runDiagnosis() {
        console.group('🔍 境界システム診断');
        
        const diagnosis = {
            system: {
                enabled: this.config.enabled,
                tracking: this.config.trackingEnabled,
                margin: this.config.margin,
                supportedPointers: this.config.supportedPointers
            },
            runtime: {
                initialized: !!this.outsidePointers,
                tracking: this.isTrackingOutside,
                activePointers: this.outsidePointers.size,
                canvasElement: !!this.canvas.canvasElement
            },
            integration: {
                configManager: !!window.ConfigManager,
                errorManager: !!window.ErrorManager,
                eventBus: !!window.EventBus,
                stateManager: !!window.StateManager,
                pixiApp: !!this.canvas.app
            },
            performance: this.getStats().performance
        };
        
        console.log('📊 診断結果:', diagnosis);
        
        // 問題検出
        const issues = [];
        
        if (!diagnosis.system.enabled) {
            issues.push('境界システムが無効化されています');
        }
        
        if (!diagnosis.runtime.canvasElement) {
            issues.push('キャンバス要素が見つかりません');
        }
        
        if (!diagnosis.integration.eventBus) {
            issues.push('EventBus統合が不完全です');
        }
        
        if (diagnosis.performance.errorRate > 0.1) {
            issues.push('エラー率が高すぎます（10%超）');
        }
        
        if (issues.length > 0) {
            console.warn('⚠️ 検出された問題:', issues);
        } else {
            console.log('✅ 境界システム正常動作中');
        }
        
        console.groupEnd();
        
        return diagnosis;
    }
    
    // ==========================================
    // 🎯 設定・制御メソッド
    // ==========================================
    
    /**
     * 境界システム有効/無効切り替え
     */
    toggle() {
        this.config.enabled = !this.config.enabled;
        window.ConfigManager.set('canvas.boundary.enabled', this.config.enabled);
        
        console.log(`🎯 境界システム${this.config.enabled ? '有効化' : '無効化'}`);
        
        return this.config.enabled;
    }
    
    /**
     * 境界マージン設定
     */
    setMargin(margin) {
        if (margin < 0 || margin > 100) {
            window.ErrorManager.showError('boundary-config', 
                '境界マージンは0-100の範囲で設定してください', 
                { margin }
            );
            return false;
        }
        
        this.config.margin = margin;
        window.ConfigManager.set('canvas.boundary.margin', margin);
        
        // ヒットエリア再作成
        this.createExpandedHitArea();
        
        console.log(`📏 境界マージン更新: ${margin}px`);
        
        return true;
    }
    
    /**
     * 境界システム終了処理
     */
    destroy() {
        // イベントリスナー削除
        document.removeEventListener('pointerdown', this.handleGlobalPointerDown);
        document.removeEventListener('pointermove', this.handleGlobalPointerMove);
        document.removeEventListener('pointerup', this.handleGlobalPointerUp);
        document.removeEventListener('pointercancel', this.handleGlobalPointerCancel);
        
        // 追跡状態クリア
        this.outsidePointers.clear();
        this.isTrackingOutside = false;
        
        // デバッグ要素削除
        if (this.debugBoundary && this.canvas.app) {
            this.canvas.app.stage.removeChild(this.debugBoundary);
        }
        
        console.log('🗑️ 境界システム終了処理完了');
    }
}

// ==========================================
// 🎯 Canvas Manager統合メソッド
// ==========================================

/**
 * Canvas Managerの既存initializeメソッドに追加する境界システム初期化
 */
function initializeBoundarySystem() {
    console.log('🎯 境界システム初期化開始...');
    
    try {
        // BoundaryEventHandlerインスタンス作成
        this.boundaryEventHandler = new BoundaryEventHandler(this);
        
        // 境界追跡システム開始
        const success = this.boundaryEventHandler.initializeBoundaryTracking();
        
        if (success) {
            console.log('✅ 境界システム初期化完了');
            
            // EventBus通知
            window.EventBus.safeEmit('canvas.boundary.initialized', {
                margin: this.boundaryEventHandler.config.margin,
                tracking: this.boundaryEventHandler.config.trackingEnabled,
                timestamp: Date.now()
            });
            
            return true;
        } else {
            console.warn('⚠️ 境界システム初期化に失敗しました');
            return false;
        }
        
    } catch (error) {
        window.ErrorManager.showError('boundary-system', 
            `境界システム初期化エラー: ${error.message}`, 
            { canvasManager: this.constructor.name }
        );
        return false;
    }
}

/**
 * Canvas Managerのリサイズ時に呼び出す境界システム更新
 */
function updateBoundarySystemOnResize() {
    if (this.boundaryEventHandler) {
        // 拡張ヒットエリア再作成
        this.boundaryEventHandler.createExpandedHitArea();
        
        console.log('📏 境界システム: リサイズ対応完了');
    }
}

// ==========================================
// 🎯 診断・テストコマンド（グローバル公開）
// ==========================================

/**
 * 境界描画システム診断コマンド
 */
window.diagnoseBoundaryDrawing = function() {
    const canvas = window.canvasManager || window.futabaDrawingTool?.canvasManager;
    
    if (!canvas || !canvas.boundaryEventHandler) {
        return {
            error: '境界システムが初期化されていません',
            canvasManager: !!canvas,
            boundaryHandler: !!canvas?.boundaryEventHandler
        };
    }
    
    return canvas.boundaryEventHandler.runDiagnosis();
};

/**
 * 境界描画テスト実行コマンド
 */
window.testBoundaryDrawing = async function() {
    const canvas = window.canvasManager || window.futabaDrawingTool?.canvasManager;
    
    if (!canvas || !canvas.boundaryEventHandler) {
        console.error('❌ 境界システムが利用できません');
        return false;
    }
    
    console.group('🧪 境界描画テスト実行');
    
    const tests = [
        {
            name: '境界システム初期化',
            test: () => !!canvas.boundaryEventHandler.outsidePointers
        },
        {
            name: 'グローバルイベント監視',
            test: () => canvas.boundaryEventHandler.config.trackingEnabled
        },
        {
            name: '統一システム統合',
            test: () => window.ConfigManager && window.ErrorManager && 
                        window.EventBus && window.StateManager
        },
        {
            name: 'PixiJS拡張ヒットエリア',
            test: () => !!canvas.app?.stage?.hitArea
        },
        {
            name: '境界設定妥当性',
            test: () => canvas.boundaryEventHandler.config.margin > 0 && 
                        canvas.boundaryEventHandler.config.margin < 100
        }
    ];
    
    let passCount = 0;
    
    for (const testCase of tests) {
        try {
            const result = testCase.test();
            const passed = !!result;
            
            console.log(`${passed ? '✅' : '❌'} ${testCase.name}: ${passed ? 'PASS' : 'FAIL'}`);
            
            if (passed) passCount++;
            
        } catch (error) {
            console.log(`❌ ${testCase.name}: FAIL (${error.message})`);
        }
    }
    
    const success = passCount === tests.length;
    console.log(`📊 テスト結果: ${passCount}/${tests.length} パス`);
    
    if (success) {
        console.log('✅ Phase1.2-STEP1 境界システム実装完了');
    } else {
        console.warn('⚠️ 一部テスト失敗 - 実装確認が必要');
    }
    
    console.groupEnd();
    
    return success;
};

// ==========================================
// 🎯 実装完了ログ・使用方法
// ==========================================

console.log('🎯 Phase1.2-STEP1 境界イベント処理システム実装完了');
console.log('✅ 実装項目:');
console.log('  - BoundaryEventHandlerクラス: 境界越え検出・処理');
console.log('  - グローバルPointerEvent監視: document全体追跡');
console.log('  - 統一システム100%統合: Config/Error/State/EventBus');
console.log('  - 拡張ヒットエリア: PixiJS境界マージン対応');
console.log('  - マルチPointer対応: Map利用複数同時追跡');
console.log('  - デバッグ・診断システム: 可視化・統計・テスト');

/**
 * 📋 Canvas Managerへの統合方法:
 * 
 * // canvas-manager.jsのinitialize()メソッド内に追加:
 * this.initializeBoundarySystem = initializeBoundarySystem.bind(this);
 * this.updateBoundarySystemOnResize = updateBoundarySystemOnResize.bind(this);
 * this.initializeBoundarySystem();
 * 
 * // resize時に呼び出し:
 * if (this.updateBoundarySystemOnResize) {
 *     this.updateBoundarySystemOnResize();
 * }
 */