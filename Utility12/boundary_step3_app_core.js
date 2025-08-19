/**
 * 🎯 Phase1.2-STEP3: PixiJS統合境界システム・app-core.js拡張
 * 🎨 ふたば☆お絵描きツール - PixiJS境界イベント統合
 * 
 * 🎯 SCOPE: PixiJS Application境界イベント・ヒットエリア拡張
 * 🎯 DEPENDENCIES: app-core.js, BoundaryEventHandler, 統一システム
 * 🎯 UNIFIED: ConfigManager, ErrorManager, EventBus, StateManager
 * 🎯 ISOLATION: 既存PixiJS機能非回帰・境界処理独立性
 * 📋 PHASE: Phase1.2-STEP3
 */

// ==========================================
// 🎯 AppCore境界システム統合拡張
// ==========================================

/**
 * AppCoreクラスに追加する境界システム統合メソッド群
 * 既存のAppCoreコンストラクターまたは初期化メソッドに追加
 */

/**
 * 境界システム統合初期化（AppCore.initialize()内に追加）
 */
function initializeBoundarySystemIntegration() {
    console.log('🎯 AppCore境界システム統合初期化...');
    
    try {
        // 統一システム依存確認
        this.validateBoundarySystemDependencies();
        
        // 境界統合設定取得
        this.boundaryIntegration = this.getBoundaryIntegrationConfig();
        
        // 拡張PixiJSヒットエリア設定
        this.setupExpandedPixiHitArea();
        
        // PixiJS境界イベント統合
        this.setupPixiBoundaryEvents();
        
        // EventBus境界イベント連携
        this.setupBoundaryEventBusIntegration();
        
        // 座標変換システム拡張
        this.initializeBoundaryCoordinateSystem();
        
        // デバッグモード設定
        if (this.boundaryIntegration.debugging) {
            this.enableBoundaryDebugMode();
        }
        
        console.log('✅ AppCore境界システム統合初期化完了');
        
        // EventBus完了通知
        if (window.EventBus) {
            window.EventBus.safeEmit('appcore.boundary.initialized', {
                timestamp: Date.now(),
                hitAreaExpanded: true,
                coordinateSystemReady: true
            });
        }
        
        return true;
        
    } catch (error) {
        const errorMsg = `AppCore境界システム統合エラー: ${error.message}`;
        
        if (window.ErrorManager) {
            window.ErrorManager.showError('boundary-system', errorMsg, { 
                component: 'AppCore', 
                error: error.message 
            });
        } else {
            console.error(errorMsg);
        }
        
        return false;
    }
}

/**
 * 統一システム依存関係検証
 */
function validateBoundarySystemDependencies() {
    const required = ['ConfigManager', 'ErrorManager', 'EventBus', 'StateManager'];
    const missing = required.filter(sys => !window[sys]);
    
    if (missing.length > 0) {
        throw new Error(`AppCore境界統合: 統一システム依存不足: ${missing.join(', ')}`);
    }
    
    // PixiJS依存確認
    if (typeof PIXI === 'undefined') {
        throw new Error('PixiJS が利用できません');
    }
    
    if (!this.app || !this.app.stage) {
        throw new Error('PixiJS Applicationまたはstageが初期化されていません');
    }
    
    console.log('✅ AppCore境界システム依存関係確認完了');
}

/**
 * 境界統合設定取得
 */
function getBoundaryIntegrationConfig() {
    const config = {
        enabled: window.ConfigManager?.get('appcore.boundary.enabled') ?? true,
        hitAreaMargin: window.ConfigManager?.get('canvas.boundary.margin') ?? 20,
        coordinateTransform: window.ConfigManager?.get('appcore.boundary.coordinateTransform') ?? true,
        eventIntegration: window.ConfigManager?.get('appcore.boundary.eventIntegration') ?? true,
        debugging: window.ConfigManager?.get('appcore.boundary.debugging') ?? false,
        performanceMode: window.ConfigManager?.get('appcore.boundary.performanceMode') ?? 'balanced' // low, balanced, high
    };
    
    // デフォルト設定確保
    if (window.ConfigManager && !window.ConfigManager.get('appcore.boundary')) {
        window.ConfigManager.set('appcore.boundary', {
            enabled: true,
            coordinateTransform: true,
            eventIntegration: true,
            debugging: false,
            performanceMode: 'balanced'
        });
    }
    
    return config;
}

// ==========================================
// 🎯 PixiJS拡張ヒットエリア・イベントシステム
// ==========================================

/**
 * 拡張PixiJSヒットエリア設定
 */
function setupExpandedPixiHitArea() {
    if (!this.boundaryIntegration.enabled || !this.app?.stage) {
        console.warn('⚠️ PixiJS境界統合が無効またはstageが利用できません');
        return false;
    }
    
    try {
        const margin = this.boundaryIntegration.hitAreaMargin;
        const canvas = this.app.view || this.app.canvas;
        const canvasWidth = canvas?.width || this.width || 800;
        const canvasHeight = canvas?.height || this.height || 600;
        
        // 拡張ヒットエリア作成（マージン付き）
        this.expandedHitArea = new PIXI.Rectangle(
            -margin,
            -margin,
            canvasWidth + margin * 2,
            canvasHeight + margin * 2
        );
        
        // Stage設定適用
        this.app.stage.hitArea = this.expandedHitArea;
        this.app.stage.interactive = true;
        
        // Stage境界プロパティ記録
        this.stageBoundary = {
            original: new PIXI.Rectangle(0, 0, canvasWidth, canvasHeight),
            expanded: this.expandedHitArea,
            margin,
            lastUpdate: Date.now()
        };
        
        console.log(`📏 PixiJS拡張ヒットエリア設定完了: ${canvasWidth}×${canvasHeight} + マージン${margin}px`);
        
        // StateManager状態更新
        if (window.StateManager) {
            window.StateManager.updateState('pixijs.boundary', {
                hitAreaExpanded: true,
                margin,
                dimensions: { width: canvasWidth, height: canvasHeight }
            });
        }
        
        return true;
        
    } catch (error) {
        console.error('❌ PixiJS拡張ヒットエリア設定エラー:', error);
        return false;
    }
}

/**
 * PixiJS境界イベント設定
 */
function setupPixiBoundaryEvents() {
    if (!this.app?.stage || !this.boundaryIntegration.eventIntegration) {
        return false;
    }
    
    try {
        // PixiJS Stageイベントリスナー設定
        this.app.stage.on('pointerdown', this.handlePixiBoundaryPointerDown.bind(this));
        this.app.stage.on('pointermove', this.handlePixiBoundaryPointerMove.bind(this));
        this.app.stage.on('pointerup', this.handlePixiBoundaryPointerUp.bind(this));
        this.app.stage.on('pointercancel', this.handlePixiBoundaryPointerCancel.bind(this));
        
        // Stageイベント統合状態
        this.pixiBoundaryEvents = {
            enabled: true,
            listeners: ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'],
            setupTime: Date.now()
        };
        
        console.log('📡 PixiJS境界イベントリスナー設定完了');
        
        return true;
        
    } catch (error) {
        console.error('❌ PixiJS境界イベント設定エラー:', error);
        return false;
    }
}

/**
 * EventBus境界イベント連携設定
 */
function setupBoundaryEventBusIntegration() {
    if (!window.EventBus || !this.boundaryIntegration.eventIntegration) {
        return false;
    }
    
    try {
        // EventBus境界イベント監視
        window.EventBus.on('boundary.cross.in', this.handleBoundaryCrossInIntegration.bind(this));
        window.EventBus.on('boundary.outside.start', this.handleBoundaryOutsideStart.bind(this));
        window.EventBus.on('canvas.boundary.initialized', this.handleCanvasBoundaryInitialized.bind(this));
        
        console.log('📡 EventBus境界イベント連携設定完了');
        
        return true;
        
    } catch (error) {
        console.error('❌ EventBus境界イベント連携エラー:', error);
        return false;
    }
}

/**
 * 境界座標変換システム初期化
 */
function initializeBoundaryCoordinateSystem() {
    if (!this.boundaryIntegration.coordinateTransform) {
        return false;
    }
    
    try {
        // 座標変換マトリックス
        this.boundaryCoordinateSystem = {
            enabled: true,
            canvasToPixi: this.createCanvasToPixiTransform(),
            pixiToCanvas: this.createPixiToCanvasTransform(),
            globalToPixi: this.createGlobalToPixiTransform(),
            pixiToGlobal: this.createPixiToGlobalTransform()
        };
        
        console.log('🎯 境界座標変換システム初期化完了');
        
        return true;
        
    } catch (error) {
        console.error('❌ 境界座標変換システム初期化エラー:', error);
        return false;
    }
}

// ==========================================
// 🎯 PixiJSイベントハンドラー群
// ==========================================

/**
 * PixiJS境界PointerDownハンドラー
 */
function handlePixiBoundaryPointerDown(pixiEvent) {
    if (!this.boundaryIntegration.enabled) return;
    
    try {
        // PixiJS座標を取得
        const localPoint = pixiEvent.data.getLocalPosition(this.app.stage);
        
        // 境界内判定
        const isInsideBoundary = this.isPointInsideBoundary(localPoint.x, localPoint.y);
        
        // 境界情報をイベントに追加
        pixiEvent.boundaryInfo = {
            insideBoundary: isInsideBoundary,
            localPosition: { x: localPoint.x, y: localPoint.y },
            margin: this.boundaryIntegration.hitAreaMargin,
            timestamp: performance.now()
        };
        
        // EventBus通知
        if (window.EventBus) {
            window.EventBus.safeEmit('pixijs.boundary.pointerdown', {
                pixiEvent: pixiEvent,
                boundaryInfo: pixiEvent.boundaryInfo
            });
        }
        
        if (this.boundaryIntegration.debugging) {
            console.log('🎯 PixiJS境界PointerDown:', pixiEvent.boundaryInfo);
        }
        
    } catch (error) {
        console.error('❌ PixiJS境界PointerDownエラー:', error);
    }
}

/**
 * PixiJS境界PointerMoveハンドラー
 */
function handlePixiBoundaryPointerMove(pixiEvent) {
    if (!this.boundaryIntegration.enabled) return;
    
    try {
        const localPoint = pixiEvent.data.getLocalPosition(this.app.stage);
        const isInsideBoundary = this.isPointInsideBoundary(localPoint.x, localPoint.y);
        
        // 境界越え検出
        const previousBoundaryState = pixiEvent.data.boundaryState || { insideBoundary: true };
        
        if (!previousBoundaryState.insideBoundary && isInsideBoundary) {
            // 境界外→内への移動検出
            this.handlePixiBoundaryCrossIn(pixiEvent, localPoint);
        } else if (previousBoundaryState.insideBoundary && !isInsideBoundary) {
            // 境界内→外への移動検出
            this.handlePixiBoundaryCrossOut(pixiEvent, localPoint);
        }
        
        // 境界状態更新
        pixiEvent.data.boundaryState = {
            insideBoundary: isInsideBoundary,
            lastPosition: { x: localPoint.x, y: localPoint.y },
            timestamp: performance.now()
        };
        
    } catch (error) {
        console.error('❌ PixiJS境界PointerMoveエラー:', error);
    }
}

/**
 * PixiJS境界PointerUpハンドラー
 */
function handlePixiBoundaryPointerUp(pixiEvent) {
    if (!this.boundaryIntegration.enabled) return;
    
    try {
        // 境界状態クリーンアップ
        if (pixiEvent.data.boundaryState) {
            delete pixiEvent.data.boundaryState;
        }
        
        // EventBus通知
        if (window.EventBus) {
            window.EventBus.safeEmit('pixijs.boundary.pointerup', {
                pointerId: pixiEvent.data.pointerId,
                timestamp: performance.now()
            });
        }
        
    } catch (error) {
        console.error('❌ PixiJS境界PointerUpエラー:', error);
    }
}

/**
 * PixiJS境界PointerCancelハンドラー
 */
function handlePixiBoundaryPointerCancel(pixiEvent) {
    if (!this.boundaryIntegration.enabled) return;
    
    try {
        // 境界状態クリーンアップ
        if (pixiEvent.data.boundaryState) {
            delete pixiEvent.data.boundaryState;
        }
        
        console.log('🗑️ PixiJS境界PointerCancel:', pixiEvent.data.pointerId);
        
    } catch (error) {
        console.error('❌ PixiJS境界PointerCancelエラー:', error);
    }
}

/**
 * PixiJS境界越えイン処理
 */
function handlePixiBoundaryCrossIn(pixiEvent, localPoint) {
    try {
        // グローバル座標変換
        const globalPoint = this.app.stage.toGlobal(localPoint);
        
        // 境界越えデータ作成
        const crossInData = {
            tool: null, // 後でToolManagerが設定
            position: { x: localPoint.x, y: localPoint.y },
            globalPosition: { x: globalPoint.x, y: globalPoint.y },
            pressure: pixiEvent.data.pressure || 0.5,
            pointerId: pixiEvent.data.pointerId,
            pointerType: pixiEvent.data.pointerType || 'mouse',
            timestamp: performance.now(),
            source: 'pixijs-stage'
        };
        
        // EventBus境界越え通知
        if (window.EventBus) {
            window.EventBus.safeEmit('pixijs.boundary.cross.in', crossInData);
        }
        
        if (this.boundaryIntegration.debugging) {
            console.log('🎯 PixiJS境界越えイン検出:', crossInData);
        }
        
    } catch (error) {
        console.error('❌ PixiJS境界越えイン処理エラー:', error);
    }
}

/**
 * PixiJS境界越えアウト処理
 */
function handlePixiBoundaryCrossOut(pixiEvent, localPoint) {
    try {
        const crossOutData = {
            position: { x: localPoint.x, y: localPoint.y },
            pointerId: pixiEvent.data.pointerId,
            timestamp: performance.now(),
            source: 'pixijs-stage'
        };
        
        // EventBus境界越えアウト通知
        if (window.EventBus) {
            window.EventBus.safeEmit('pixijs.boundary.cross.out', crossOutData);
        }
        
        if (this.boundaryIntegration.debugging) {
            console.log('🎯 PixiJS境界越えアウト検出:', crossOutData);
        }
        
    } catch (error) {
        console.error('❌ PixiJS境界越えアウト処理エラー:', error);
    }
}

// ==========================================
// 🎯 EventBus統合イベントハンドラー
// ==========================================

/**
 * EventBus境界越えイン統合処理
 */
function handleBoundaryCrossInIntegration(data) {
    if (!this.boundaryIntegration.eventIntegration) return;
    
    try {
        // PixiJS座標系に変換
        const pixiPoint = this.convertToPixiCoordinate(data.position.x, data.position.y);
        
        // 現在のツール取得
        const currentTool = this.toolManager?.currentTool || 
                           window.toolManager?.currentTool;
        
        if (currentTool && typeof currentTool.handleBoundaryCrossIn === 'function') {
            // ツールに境界越え通知
            currentTool.handleBoundaryCrossIn(pixiPoint.x, pixiPoint.y, {
                pressure: data.pressure,
                pointerId: data.pointerId,
                pointerType: data.pointerType || 'mouse',
                timestamp: data.timestamp,
                fromPixiJS: true
            });
        }
        
        if (this.boundaryIntegration.debugging) {
            console.log('📡 AppCore EventBus境界越えイン統合:', {
                original: data.position,
                pixi: pixiPoint,
                tool: currentTool?.name
            });
        }
        
    } catch (error) {
        console.error('❌ EventBus境界越えイン統合エラー:', error);
    }
}

/**
 * EventBus境界外開始処理
 */
function handleBoundaryOutsideStart(data) {
    if (!this.boundaryIntegration.eventIntegration) return;
    
    try {
        // AppCore状態更新
        if (window.StateManager) {
            window.StateManager.updateState('appcore.boundary.tracking', {
                active: true,
                pointerId: data.pointer.id,
                pointerType: data.pointer.type,
                timestamp: Date.now()
            });
        }
        
        if (this.boundaryIntegration.debugging) {
            console.log('📡 AppCore境界外開始通知:', data.pointer);
        }
        
    } catch (error) {
        console.error('❌ EventBus境界外開始処理エラー:', error);
    }
}

/**
 * Canvas境界システム初期化完了処理
 */
function handleCanvasBoundaryInitialized(data) {
    try {
        console.log('📡 AppCore: Canvas境界システム初期化完了通知受信');
        
        // AppCore境界統合準備完了
        this.boundarySystemReady = true;
        
        // StateManager状態更新
        if (window.StateManager) {
            window.StateManager.updateState('appcore.boundary.system', {
                ready: true,
                canvasIntegrated: true,
                timestamp: Date.now()
            });
        }
        
    } catch (error) {
        console.error('❌ Canvas境界初期化完了処理エラー:', error);
    }
}

// ==========================================
// 🎯 座標変換システム
// ==========================================

/**
 * キャンバス→PixiJS座標変換
 */
function createCanvasToPixiTransform() {
    return (canvasX, canvasY) => {
        try {
            // 基本的にはキャンバス座標とPixi座標は同じ
            // ただし、将来的なスケール・オフセット対応
            return {
                x: canvasX,
                y: canvasY
            };
        } catch (error) {
            console.error('❌ キャンバス→PixiJS座標変換エラー:', error);
            return { x: canvasX, y: canvasY };
        }
    };
}

/**
 * PixiJS→キャンバス座標変換
 */
function createPixiToCanvasTransform() {
    return (pixiX, pixiY) => {
        try {
            return {
                x: pixiX,
                y: pixiY
            };
        } catch (error) {
            console.error('❌ PixiJS→キャンバス座標変換エラー:', error);
            return { x: pixiX, y: pixiY };
        }
    };
}

/**
 * グローバル→PixiJS座標変換
 */
function createGlobalToPixiTransform() {
    return (globalX, globalY) => {
        try {
            const canvas = this.app?.view || this.app?.canvas;
            if (!canvas) {
                throw new Error('キャンバス要素が見つかりません');
            }
            
            const rect = canvas.getBoundingClientRect();
            const canvasX = globalX - rect.left;
            const canvasY = globalY - rect.top;
            
            // キャンバス→PixiJS座標変換
            return this.boundaryCoordinateSystem.canvasToPixi(canvasX, canvasY);
            
        } catch (error) {
            console.error('❌ グローバル→PixiJS座標変換エラー:', error);
            return { x: globalX, y: globalY };
        }
    };
}

/**
 * PixiJS→グローバル座標変換
 */
function createPixiToGlobalTransform() {
    return (pixiX, pixiY) => {
        try {
            const canvas = this.app?.view || this.app?.canvas;
            if (!canvas) {
                throw new Error('キャンバス要素が見つかりません');
            }
            
            const rect = canvas.getBoundingClientRect();
            const canvasCoord = this.boundaryCoordinateSystem.pixiToCanvas(pixiX, pixiY);
            
            return {
                x: canvasCoord.x + rect.left,
                y: canvasCoord.y + rect.top
            };
            
        } catch (error) {
            console.error('❌ PixiJS→グローバル座標変換エラー:', error);
            return { x: pixiX, y: pixiY };
        }
    };
}

/**
 * 座標変換ヘルパー
 */
function convertToPixiCoordinate(x, y) {
    if (this.boundaryCoordinateSystem?.canvasToPixi) {
        return this.boundaryCoordinateSystem.canvasToPixi(x, y);
    }
    return { x, y };
}

function convertToGlobalCoordinate(pixiX, pixiY) {
    if (this.boundaryCoordinateSystem?.pixiToGlobal) {
        return this.boundaryCoordinateSystem.pixiToGlobal(pixiX, pixiY);
    }
    return { x: pixiX, y: pixiY };
}

// ==========================================
// 🎯 境界判定・ユーティリティ
// ==========================================

/**
 * 点が境界内かチェック
 */
function isPointInsideBoundary(x, y) {
    if (!this.stageBoundary?.original) {
        return true; // フォールバック
    }
    
    const boundary = this.stageBoundary.original;
    
    return x >= boundary.x && 
           x <= boundary.x + boundary.width && 
           y >= boundary.y && 
           y <= boundary.y + boundary.height;
}

/**
 * 拡張ヒットエリア更新（リサイズ対応）
 */
function updateBoundaryHitAreaOnResize(newWidth, newHeight) {
    if (!this.boundaryIntegration.enabled || !this.app?.stage) {
        return false;
    }
    
    try {
        const margin = this.boundaryIntegration.hitAreaMargin;
        
        // 新しい拡張ヒットエリア
        this.expandedHitArea = new PIXI.Rectangle(
            -margin,
            -margin,
            newWidth + margin * 2,
            newHeight + margin * 2
        );
        
        // Stage更新
        this.app.stage.hitArea = this.expandedHitArea;
        
        // 境界情報更新
        this.stageBoundary = {
            original: new PIXI.Rectangle(0, 0, newWidth, newHeight),
            expanded: this.expandedHitArea,
            margin,
            lastUpdate: Date.now()
        };
        
        console.log(`📏 境界ヒットエリア更新: ${newWidth}×${newHeight} + マージン${margin}px`);
        
        return true;
        
    } catch (error) {
        console.error('❌ 境界ヒットエリア更新エラー:', error);
        return false;
    }
}

// ==========================================
// 🎯 デバッグ・診断システム
// ==========================================

/**
 * 境界デバッグモード有効化
 */
function enableBoundaryDebugMode() {
    if (!this.app?.stage) return;
    
    try {
        // デバッグ境界表示
        this.createBoundaryDebugVisualizer();
        
        // 詳細ログ有効化
        this.boundaryDebugLogging = true;
        
        console.log('🔍 AppCore境界デバッグモード有効');
        
    } catch (error) {
        console.error('❌ 境界デバッグモード有効化エラー:', error);
    }
}

/**
 * 境界デバッグ可視化
 */
function createBoundaryDebugVisualizer() {
    if (!this.app?.stage || !this.stageBoundary) return;
    
    try {
        // デバッググラフィクス作成
        const debugGraphics = new PIXI.Graphics();
        
        // 元のキャンバス境界（青線）
        debugGraphics.lineStyle(2, 0x0066CC, 0.8);
        const original = this.stageBoundary.original;
        debugGraphics.drawRect(original.x, original.y, original.width, original.height);
        
        // 拡張境界（赤線）
        debugGraphics.lineStyle(2, 0xFF0000, 0.5);
        const expanded = this.stageBoundary.expanded;
        debugGraphics.drawRect(expanded.x, expanded.y, expanded.width, expanded.height);
        
        // マージンエリア（半透明塗りつぶし）
        debugGraphics.beginFill(0x00FF00, 0.1);
        debugGraphics.drawRect(expanded.x, expanded.y, expanded.width, expanded.height);
        debugGraphics.endFill();
        
        // Stageに追加
        this.app.stage.addChild(debugGraphics);
        this.boundaryDebugGraphics = debugGraphics;
        
        console.log('🎯 境界デバッグ可視化作成完了');
        
    } catch (error) {
        console.error('❌ 境界デバッグ可視化エラー:', error);
    }
}

/**
 * AppCore境界システム診断
 */
function runBoundarySystemDiagnosis() {
    console.group('🔍 AppCore境界システム診断');
    
    const diagnosis = {
        configuration: {
            enabled: this.boundaryIntegration?.enabled || false,
            hitAreaMargin: this.boundaryIntegration?.hitAreaMargin || 0,
            coordinateTransform: this.boundaryIntegration?.coordinateTransform || false,
            eventIntegration: this.boundaryIntegration?.eventIntegration || false,
            debugging: this.boundaryIntegration?.debugging || false,
            performanceMode: this.boundaryIntegration?.performanceMode || 'unknown'
        },
        runtime: {
            boundarySystemReady: this.boundarySystemReady || false,
            pixiAppInitialized: !!(this.app && this.app.stage),
            hitAreaExpanded: !!this.expandedHitArea,
            stageInteractive: this.app?.stage?.interactive || false,
            eventListenersSetup: !!this.pixiBoundaryEvents?.enabled
        },
        boundary: {
            originalDimensions: this.stageBoundary?.original ? {
                width: this.stageBoundary.original.width,
                height: this.stageBoundary.original.height
            } : null,
            expandedDimensions: this.expandedHitArea ? {
                width: this.expandedHitArea.width,
                height: this.expandedHitArea.height,
                margin: this.stageBoundary?.margin || 0
            } : null,
            lastUpdate: this.stageBoundary?.lastUpdate || null
        },
        integration: {
            configManager: !!window.ConfigManager,
            errorManager: !!window.ErrorManager,
            eventBus: !!window.EventBus,
            stateManager: !!window.StateManager,
            toolManager: !!this.toolManager,
            coordinateSystem: !!this.boundaryCoordinateSystem?.enabled
        },
        performance: {
            debugMode: this.boundaryDebugLogging || false,
            debugVisualization: !!this.boundaryDebugGraphics
        }
    };
    
    console.log('📊 診断結果:', diagnosis);
    
    // 問題検出
    const issues = [];
    
    if (!diagnosis.configuration.enabled) {
        issues.push('境界システムが無効化されています');
    }
    
    if (!diagnosis.runtime.pixiAppInitialized) {
        issues.push('PixiJS Applicationが初期化されていません');
    }
    
    if (!diagnosis.runtime.hitAreaExpanded) {
        issues.push('拡張ヒットエリアが設定されていません');
    }
    
    if (!diagnosis.integration.eventBus) {
        issues.push('EventBus統合が不完全です');
    }
    
    if (!diagnosis.runtime.stageInteractive) {
        issues.push('PixiJS Stageがインタラクティブではありません');
    }
    
    if (issues.length > 0) {
        console.warn('⚠️ 検出された問題:', issues);
    } else {
        console.log('✅ AppCore境界システム正常動作中');
    }
    
    console.groupEnd();
    
    return diagnosis;
}

/**
 * 境界システム統計取得
 */
function getBoundarySystemStats() {
    return {
        system: {
            initialized: !!this.boundaryIntegration,
            ready: this.boundarySystemReady || false,
            lastUpdate: this.stageBoundary?.lastUpdate || null
        },
        configuration: { ...(this.boundaryIntegration || {}) },
        hitArea: {
            original: this.stageBoundary?.original || null,
            expanded: this.expandedHitArea || null,
            margin: this.stageBoundary?.margin || 0
        },
        events: {
            pixijsListeners: this.pixiBoundaryEvents?.listeners || [],
            eventBusIntegrated: !!window.EventBus
        },
        coordinates: {
            systemEnabled: !!this.boundaryCoordinateSystem?.enabled,
            transformsAvailable: !!(this.boundaryCoordinateSystem?.canvasToPixi)
        }
    };
}

// ==========================================
// 🎯 AppCore統合メソッド・設定
// ==========================================

/**
 * AppCoreクラスに境界システム統合
 * 既存のAppCoreクラスのコンストラクターまたは初期化メソッドに追加
 */
function integrateBoundarySystemToAppCore() {
    // 境界システム初期化
    this.initializeBoundarySystemIntegration = initializeBoundarySystemIntegration.bind(this);
    this.validateBoundarySystemDependencies = validateBoundarySystemDependencies.bind(this);
    this.getBoundaryIntegrationConfig = getBoundaryIntegrationConfig.bind(this);
    
    // PixiJS境界設定
    this.setupExpandedPixiHitArea = setupExpandedPixiHitArea.bind(this);
    this.setupPixiBoundaryEvents = setupPixiBoundaryEvents.bind(this);
    this.setupBoundaryEventBusIntegration = setupBoundaryEventBusIntegration.bind(this);
    this.initializeBoundaryCoordinateSystem = initializeBoundaryCoordinateSystem.bind(this);
    
    // PixiJSイベントハンドラー
    this.handlePixiBoundaryPointerDown = handlePixiBoundaryPointerDown.bind(this);
    this.handlePixiBoundaryPointerMove = handlePixiBoundaryPointerMove.bind(this);
    this.handlePixiBoundaryPointerUp = handlePixiBoundaryPointerUp.bind(this);
    this.handlePixiBoundaryPointerCancel = handlePixiBoundaryPointerCancel.bind(this);
    this.handlePixiBoundaryCrossIn = handlePixiBoundaryCrossIn.bind(this);
    this.handlePixiBoundaryCrossOut = handlePixiBoundaryCrossOut.bind(this);
    
    // EventBus統合ハンドラー
    this.handleBoundaryCrossInIntegration = handleBoundaryCrossInIntegration.bind(this);
    this.handleBoundaryOutsideStart = handleBoundaryOutsideStart.bind(this);
    this.handleCanvasBoundaryInitialized = handleCanvasBoundaryInitialized.bind(this);
    
    // 座標変換システム
    this.createCanvasToPixiTransform = createCanvasToPixiTransform.bind(this);
    this.createPixiToCanvasTransform = createPixiToCanvasTransform.bind(this);
    this.createGlobalToPixiTransform = createGlobalToPixiTransform.bind(this);
    this.createPixiToGlobalTransform = createPixiToGlobalTransform.bind(this);
    this.convertToPixiCoordinate = convertToPixiCoordinate.bind(this);
    this.convertToGlobalCoordinate = convertToGlobalCoordinate.bind(this);
    
    // ユーティリティ
    this.isPointInsideBoundary = isPointInsideBoundary.bind(this);
    this.updateBoundaryHitAreaOnResize = updateBoundaryHitAreaOnResize.bind(this);
    
    // デバッグ・診断
    this.enableBoundaryDebugMode = enableBoundaryDebugMode.bind(this);
    this.createBoundaryDebugVisualizer = createBoundaryDebugVisualizer.bind(this);
    this.runBoundarySystemDiagnosis = runBoundarySystemDiagnosis.bind(this);
    this.getBoundarySystemStats = getBoundarySystemStats.bind(this);
    
    // 境界システム初期化実行
    this.initializeBoundarySystemIntegration();
}

/**
 * AppCoreリサイズ時に境界システム更新
 */
function updateBoundaryOnAppCoreResize(newWidth, newHeight) {
    if (this.updateBoundaryHitAreaOnResize) {
        this.updateBoundaryHitAreaOnResize(newWidth, newHeight);
        
        // デバッグ可視化更新
        if (this.boundaryDebugGraphics) {
            this.app.stage.removeChild(this.boundaryDebugGraphics);
            this.createBoundaryDebugVisualizer();
        }
        
        console.log('📏 AppCore境界システム: リサイズ対応完了');
    }
}

// ==========================================
// 🎯 グローバル診断コマンド
// ==========================================

/**
 * AppCore境界システム診断コマンド
 */
window.diagnoseAppCoreBoundary = function() {
    const appCore = window.appCore || 
                   window.futabaDrawingTool?.appCore ||
                   window.canvasManager?.toolManager?.appCore;
    
    if (!appCore || typeof appCore.runBoundarySystemDiagnosis !== 'function') {
        return {
            error: 'AppCore境界システムが利用できません',
            appCore: !!appCore,
            boundarySupport: !!appCore?.runBoundarySystemDiagnosis
        };
    }
    
    return appCore.runBoundarySystemDiagnosis();
};

/**
 * AppCore境界統計取得コマンド
 */
window.getAppCoreBoundaryStats = function() {
    const appCore = window.appCore || 
                   window.futabaDrawingTool?.appCore ||
                   window.canvasManager?.toolManager?.appCore;
    
    if (!appCore || typeof appCore.getBoundarySystemStats !== 'function') {
        return { error: 'AppCore境界統計が利用できません' };
    }
    
    return appCore.getBoundarySystemStats();
};

/**
 * 境界デバッグモード切り替えコマンド
 */
window.toggleAppCoreBoundaryDebug = function() {
    const appCore = window.appCore || 
                   window.futabaDrawingTool?.appCore ||
                   window.canvasManager?.toolManager?.appCore;
    
    if (!appCore) {
        return { error: 'AppCoreが利用できません' };
    }
    
    try {
        if (appCore.boundaryIntegration) {
            appCore.boundaryIntegration.debugging = !appCore.boundaryIntegration.debugging;
            
            if (appCore.boundaryIntegration.debugging) {
                appCore.enableBoundaryDebugMode();
            } else {
                // デバッグモード無効化
                if (appCore.boundaryDebugGraphics) {
                    appCore.app.stage.removeChild(appCore.boundaryDebugGraphics);
                    appCore.boundaryDebugGraphics = null;
                }
                appCore.boundaryDebugLogging = false;
            }
            
            console.log(`🔍 AppCore境界デバッグモード: ${appCore.boundaryIntegration.debugging ? '有効' : '無効'}`);
            
            return { 
                debugging: appCore.boundaryIntegration.debugging,
                visualization: !!appCore.boundaryDebugGraphics
            };
        }
        
        return { error: '境界システムが初期化されていません' };
        
    } catch (error) {
        return { error: `デバッグモード切り替えエラー: ${error.message}` };
    }
};

// ==========================================
// 🎯 統合テストコマンド
// ==========================================

/**
 * 境界システム統合テスト実行
 */
window.testBoundarySystemIntegration = async function() {
    console.group('🧪 境界システム統合テスト実行');
    
    const tests = [
        {
            name: 'AppCore境界システム初期化',
            test: () => {
                const appCore = window.appCore || window.futabaDrawingTool?.appCore;
                return appCore?.boundaryIntegration?.enabled || false;
            }
        },
        {
            name: 'PixiJS拡張ヒットエリア',
            test: () => {
                const appCore = window.appCore || window.futabaDrawingTool?.appCore;
                return !!appCore?.expandedHitArea;
            }
        },
        {
            name: 'EventBus境界イベント統合',
            test: () => {
                return !!window.EventBus?.BoundaryEvents;
            }
        },
        {
            name: 'Canvas Manager境界システム',
            test: () => {
                const canvas = window.canvasManager;
                return !!canvas?.boundaryEventHandler;
            }
        },
        {
            name: 'PenTool境界対応',
            test: () => {
                const penTool = window.toolManager?.tools?.pen;
                return typeof penTool?.handleBoundaryCrossIn === 'function';
            }
        },
        {
            name: '統一システム統合',
            test: () => {
                return !!(window.ConfigManager && window.ErrorManager && 
                         window.EventBus && window.StateManager);
            }
        },
        {
            name: '座標変換システム',
            test: () => {
                const appCore = window.appCore || window.futabaDrawingTool?.appCore;
                return !!appCore?.boundaryCoordinateSystem?.enabled;
            }
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
    console.log(`📊 統合テスト結果: ${passCount}/${tests.length} パス`);
    
    if (success) {
        console.log('✅ Phase1.2境界システム統合完全成功');
    } else {
        console.warn('⚠️ 一部統合テスト失敗 - 実装確認が必要');
    }
    
    console.groupEnd();
    
    return {
        success,
        passCount,
        totalTests: tests.length,
        details: tests.map((test, index) => ({
            name: test.name,
            passed: passCount > index
        }))
    };
};

// ==========================================
// 🎯 実装完了ログ・統合ガイド
// ==========================================

console.log('🎯 Phase1.2-STEP3 AppCore境界システム統合実装完了');
console.log('✅ 実装項目:');
console.log('  - PixiJS拡張ヒットエリア: setupExpandedPixiHitArea');
console.log('  - PixiJS境界イベント統合: handlePixiBoundaryPointer*');
console.log('  - EventBus境界イベント連携: handleBoundaryCrossInIntegration');
console.log('  - 座標変換システム: boundaryCoordinateSystem');
console.log('  - 境界判定システム: isPointInsideBoundary');
console.log('  - デバッグ可視化: createBoundaryDebugVisualizer');
console.log('  - 統一システム100%統合: Config/Error/State/EventBus');
console.log('  - リサイズ対応: updateBoundaryHitAreaOnResize');

/**
 * 📋 AppCoreへの統合方法:
 * 
 * // AppCoreクラスのコンストラクターまたは初期化メソッド最後に追加:
 * integrateBoundarySystemToAppCore.call(this);
 * 
 * // AppCoreリサイズ時に呼び出し:
 * if (this.updateBoundaryOnAppCoreResize) {
 *     this.updateBoundaryOnAppCoreResize(newWidth, newHeight);
 * }
 * 
 * 使用例:
 * // 診断実行
 * window.diagnoseAppCoreBoundary();
 * window.getAppCoreBoundaryStats();
 * window.toggleAppCoreBoundaryDebug();
 * 
 * // 統合テスト実行
 * window.testBoundarySystemIntegration();
 */