/**
 * 🎯 Phase1.2-STEP3修正版: AppCore境界システム統合
 * 🎨 ふたば☆お絵描きツール - PixiJS統合境界システム
 * 
 * 🎯 修正点: 初期化順序・依存関係エラー解決
 * 🎯 UNIFIED: ConfigManager, ErrorManager, EventBus, StateManager
 * 🎯 ISOLATION: 既存機能非回帰・境界処理独立性
 * 📋 PHASE: Phase1.2-STEP3修正版
 */

/**
 * AppCoreクラス - PixiJSアプリケーション管理
 */
class AppCore {
    constructor() {
        // 基本プロパティ初期化
        this.app = null;
        this.width = 800;
        this.height = 600;
        this.isInitialized = false;
        
        // 境界システム関連（初期化前は無効状態）
        this.boundaryIntegration = null;
        this.boundarySystemReady = false;
        this.expandedHitArea = null;
        this.stageBoundary = null;
        this.pixiBoundaryEvents = null;
        this.boundaryCoordinateSystem = null;
        
        // デバッグ関連
        this.boundaryDebugGraphics = null;
        this.boundaryDebugLogging = false;
        
        console.log('📦 AppCore: コンストラクター完了 (境界システムは初期化後に設定)');
    }

    /**
     * PixiJSアプリケーション初期化
     */
    async initialize(options = {}) {
        try {
            console.log('🚀 AppCore: 初期化開始...');
            
            // オプション設定
            this.width = options.width || 800;
            this.height = options.height || 600;
            
            // PixiJSアプリケーション作成
            await this.createPixiApplication(options);
            
            // 基本設定
            this.setupBasicConfiguration();
            
            // 描画ステージ初期化
            this.initializeDrawingStage();
            
            // 🎯 統一システム確認後に境界システム初期化
            this.initializeBoundarySystemSafely();
            
            // 初期化完了
            this.isInitialized = true;
            
            console.log('✅ AppCore: 初期化完了');
            
            // EventBus通知（統一システムが利用可能な場合のみ）
            this.safeEmitEvent('appcore.initialized', {
                width: this.width,
                height: this.height,
                boundarySupport: this.boundarySystemReady
            });
            
            return true;
            
        } catch (error) {
            const errorMsg = `AppCore初期化エラー: ${error.message}`;
            console.error('❌', errorMsg);
            
            // ErrorManager利用可能時のみエラー表示
            this.safeShowError('appcore-init', errorMsg, { 
                error: error.message,
                stack: error.stack 
            });
            
            return false;
        }
    }

    /**
     * PixiJSアプリケーション作成
     */
    async createPixiApplication(options) {
        const pixiOptions = {
            width: this.width,
            height: this.height,
            backgroundColor: options.backgroundColor || 0xFFFFFF,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true,
            antialias: true,
            preserveDrawingBuffer: true
        };
        
        this.app = new PIXI.Application(pixiOptions);
        await this.app.init(pixiOptions);
        
        console.log(`📱 PixiJS Application作成: ${this.width}x${this.height}`);
    }

    /**
     * 基本設定
     */
    setupBasicConfiguration() {
        if (!this.app?.stage) {
            throw new Error('PixiJS Stageが利用できません');
        }
        
        // Stage基本設定
        this.app.stage.eventMode = 'static';
        this.app.stage.hitArea = new PIXI.Rectangle(0, 0, this.width, this.height);
        this.app.stage.interactive = true;
        
        console.log('⚙️ AppCore: 基本設定完了');
    }

    /**
     * 描画ステージ初期化
     */
    initializeDrawingStage() {
        // メイン描画コンテナ作成
        this.drawingContainer = new PIXI.Container();
        this.app.stage.addChild(this.drawingContainer);
        
        // UI層コンテナ
        this.uiContainer = new PIXI.Container();
        this.app.stage.addChild(this.uiContainer);
        
        console.log('🎨 描画ステージ初期化完了');
    }

    // ==========================================
    // 🎯 境界システム統合（STEP3修正版）
    // ==========================================

    /**
     * 境界システム安全初期化（統一システム確認後実行）
     */
    initializeBoundarySystemSafely() {
        try {
            console.log('🎯 AppCore: 境界システム安全初期化開始...');
            
            // 統一システム利用可能性確認
            const unifiedAvailable = this.checkUnifiedSystemAvailability();
            
            if (unifiedAvailable.allAvailable) {
                // 統一システム完全利用版
                console.log('✅ 統一システム利用可能 - 完全境界統合実行');
                this.initializeBoundarySystemIntegration();
            } else {
                // フォールバック版（基本機能のみ）
                console.log('⚠️ 統一システム一部利用不可 - 基本境界機能のみ初期化');
                console.log('未利用システム:', unifiedAvailable.missing);
                this.initializeBasicBoundarySystem();
            }
            
        } catch (error) {
            console.warn('⚠️ 境界システム初期化スキップ:', error.message);
            // 境界システムなしでも動作継続
        }
    }

    /**
     * 統一システム利用可能性確認
     */
    checkUnifiedSystemAvailability() {
        const systems = {
            ConfigManager: !!window.ConfigManager,
            ErrorManager: !!window.ErrorManager,
            EventBus: !!window.EventBus,
            StateManager: !!window.StateManager
        };
        
        const missing = Object.entries(systems)
            .filter(([name, available]) => !available)
            .map(([name]) => name);
        
        return {
            systems,
            allAvailable: missing.length === 0,
            missing,
            partiallyAvailable: missing.length < 4
        };
    }

    /**
     * 完全境界システム統合初期化（統一システム利用）
     */
    initializeBoundarySystemIntegration() {
        try {
            console.log('🎯 AppCore: 完全境界システム統合初期化...');
            
            // 境界統合設定取得
            this.boundaryIntegration = this.getBoundaryIntegrationConfig();
            
            if (!this.boundaryIntegration.enabled) {
                console.log('⚠️ 境界システム無効化設定のためスキップ');
                return false;
            }
            
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
            
            this.boundarySystemReady = true;
            
            console.log('✅ AppCore: 完全境界システム統合完了');
            
            // EventBus完了通知
            this.safeEmitEvent('appcore.boundary.initialized', {
                timestamp: Date.now(),
                hitAreaExpanded: !!this.expandedHitArea,
                coordinateSystemReady: !!this.boundaryCoordinateSystem?.enabled,
                debugMode: this.boundaryIntegration.debugging
            });
            
            return true;
            
        } catch (error) {
            console.error('❌ 完全境界システム統合エラー:', error);
            
            this.safeShowError('boundary-system-integration', 
                `境界システム統合エラー: ${error.message}`, 
                { component: 'AppCore', integration: 'full' }
            );
            
            // フォールバックに切り替え
            this.initializeBasicBoundarySystem();
            return false;
        }
    }

    /**
     * 基本境界システム初期化（統一システムなし対応）
     */
    initializeBasicBoundarySystem() {
        try {
            console.log('🎯 AppCore: 基本境界システム初期化...');
            
            // 基本設定（ハードコーデッド）
            this.boundaryIntegration = {
                enabled: true,
                hitAreaMargin: 20,
                coordinateTransform: true,
                eventIntegration: false, // EventBusなし
                debugging: false,
                performanceMode: 'balanced'
            };
            
            // 基本拡張ヒットエリア
            this.setupBasicExpandedHitArea();
            
            // 基本境界イベント
            this.setupBasicBoundaryEvents();
            
            this.boundarySystemReady = true;
            
            console.log('✅ AppCore: 基本境界システム初期化完了');
            
            return true;
            
        } catch (error) {
            console.error('❌ 基本境界システム初期化エラー:', error);
            return false;
        }
    }

    /**
     * 境界統合設定取得（ConfigManager利用）
     */
    getBoundaryIntegrationConfig() {
        if (!window.ConfigManager) {
            // フォールバック設定
            return {
                enabled: true,
                hitAreaMargin: 20,
                coordinateTransform: true,
                eventIntegration: false,
                debugging: false,
                performanceMode: 'balanced'
            };
        }
        
        const config = {
            enabled: window.ConfigManager.get('appcore.boundary.enabled') ?? true,
            hitAreaMargin: window.ConfigManager.get('canvas.boundary.margin') ?? 20,
            coordinateTransform: window.ConfigManager.get('appcore.boundary.coordinateTransform') ?? true,
            eventIntegration: window.ConfigManager.get('appcore.boundary.eventIntegration') ?? true,
            debugging: window.ConfigManager.get('appcore.boundary.debugging') ?? false,
            performanceMode: window.ConfigManager.get('appcore.boundary.performanceMode') ?? 'balanced'
        };
        
        // デフォルト設定確保
        if (!window.ConfigManager.get('appcore.boundary')) {
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
    // 🎯 拡張PixiJSヒットエリア・イベントシステム
    // ==========================================

    /**
     * 拡張PixiJSヒットエリア設定（完全版）
     */
    setupExpandedPixiHitArea() {
        if (!this.boundaryIntegration.enabled || !this.app?.stage) {
            console.warn('⚠️ PixiJS境界統合が無効またはstageが利用できません');
            return false;
        }
        
        try {
            const margin = this.boundaryIntegration.hitAreaMargin;
            
            // 拡張ヒットエリア作成（マージン付き）
            this.expandedHitArea = new PIXI.Rectangle(
                -margin,
                -margin,
                this.width + margin * 2,
                this.height + margin * 2
            );
            
            // Stage設定適用
            this.app.stage.hitArea = this.expandedHitArea;
            this.app.stage.interactive = true;
            
            // Stage境界プロパティ記録
            this.stageBoundary = {
                original: new PIXI.Rectangle(0, 0, this.width, this.height),
                expanded: this.expandedHitArea,
                margin,
                lastUpdate: Date.now()
            };
            
            console.log(`📏 PixiJS拡張ヒットエリア設定完了: ${this.width}×${this.height} + マージン${margin}px`);
            
            // StateManager状態更新
            this.safeUpdateState('pixijs.boundary', {
                hitAreaExpanded: true,
                margin,
                dimensions: { width: this.width, height: this.height }
            });
            
            return true;
            
        } catch (error) {
            console.error('❌ PixiJS拡張ヒットエリア設定エラー:', error);
            return false;
        }
    }

    /**
     * 基本拡張ヒットエリア設定（統一システムなし）
     */
    setupBasicExpandedHitArea() {
        if (!this.app?.stage) {
            return false;
        }
        
        try {
            const margin = 20; // ハードコーデッド
            
            this.expandedHitArea = new PIXI.Rectangle(
                -margin,
                -margin,
                this.width + margin * 2,
                this.height + margin * 2
            );
            
            this.app.stage.hitArea = this.expandedHitArea;
            this.app.stage.interactive = true;
            
            this.stageBoundary = {
                original: new PIXI.Rectangle(0, 0, this.width, this.height),
                expanded: this.expandedHitArea,
                margin,
                lastUpdate: Date.now()
            };
            
            console.log(`📏 基本拡張ヒットエリア設定: ${this.width}×${this.height} + ${margin}px`);
            
            return true;
            
        } catch (error) {
            console.error('❌ 基本拡張ヒットエリア設定エラー:', error);
            return false;
        }
    }

    /**
     * PixiJS境界イベント設定（完全版）
     */
    setupPixiBoundaryEvents() {
        if (!this.app?.stage || !this.boundaryIntegration.eventIntegration) {
            console.log('⚠️ PixiJS境界イベント統合スキップ (EventBus統合無効)');
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
     * 基本境界イベント設定（統一システムなし）
     */
    setupBasicBoundaryEvents() {
        if (!this.app?.stage) {
            return false;
        }
        
        try {
            // 基本的なPointerEventのみ
            this.app.stage.on('pointerdown', (event) => {
                this.handleBasicPointerDown(event);
            });
            
            this.app.stage.on('pointermove', (event) => {
                this.handleBasicPointerMove(event);
            });
            
            console.log('📡 基本境界イベント設定完了');
            
            return true;
            
        } catch (error) {
            console.error('❌ 基本境界イベント設定エラー:', error);
            return false;
        }
    }

    /**
     * EventBus境界イベント連携設定
     */
    setupBoundaryEventBusIntegration() {
        if (!window.EventBus || !this.boundaryIntegration.eventIntegration) {
            console.log('⚠️ EventBus境界イベント連携スキップ');
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
    initializeBoundaryCoordinateSystem() {
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
    handlePixiBoundaryPointerDown(pixiEvent) {
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
            this.safeEmitEvent('pixijs.boundary.pointerdown', {
                pixiEvent: pixiEvent,
                boundaryInfo: pixiEvent.boundaryInfo
            });
            
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
    handlePixiBoundaryPointerMove(pixiEvent) {
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
    handlePixiBoundaryPointerUp(pixiEvent) {
        if (!this.boundaryIntegration.enabled) return;
        
        try {
            // 境界状態クリーンアップ
            if (pixiEvent.data.boundaryState) {
                delete pixiEvent.data.boundaryState;
            }
            
            // EventBus通知
            this.safeEmitEvent('pixijs.boundary.pointerup', {
                pointerId: pixiEvent.data.pointerId,
                timestamp: performance.now()
            });
            
        } catch (error) {
            console.error('❌ PixiJS境界PointerUpエラー:', error);
        }
    }

    /**
     * PixiJS境界PointerCancelハンドラー
     */
    handlePixiBoundaryPointerCancel(pixiEvent) {
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
     * 基本PointerDownハンドラー（統一システムなし）
     */
    handleBasicPointerDown(pixiEvent) {
        try {
            const localPoint = pixiEvent.data.getLocalPosition(this.app.stage);
            
            console.log('🎯 基本PointerDown:', {
                x: localPoint.x.toFixed(2),
                y: localPoint.y.toFixed(2),
                pointerId: pixiEvent.data.pointerId
            });
            
        } catch (error) {
            console.error('❌ 基本PointerDownエラー:', error);
        }
    }

    /**
     * 基本PointerMoveハンドラー（統一システムなし）
     */
    handleBasicPointerMove(pixiEvent) {
        try {
            const localPoint = pixiEvent.data.getLocalPosition(this.app.stage);
            const isInside = this.isPointInsideBoundary(localPoint.x, localPoint.y);
            
            // デバッグ出力（頻度制限）
            if (Math.random() < 0.01) { // 1%の確率で出力
                console.log('🎯 基本PointerMove:', {
                    inside: isInside,
                    x: localPoint.x.toFixed(2),
                    y: localPoint.y.toFixed(2)
                });
            }
            
        } catch (error) {
            console.error('❌ 基本PointerMoveエラー:', error);
        }
    }

    /**
     * PixiJS境界越えイン処理
     */
    handlePixiBoundaryCrossIn(pixiEvent, localPoint) {
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
            this.safeEmitEvent('pixijs.boundary.cross.in', crossInData);
            
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
    handlePixiBoundaryCrossOut(pixiEvent, localPoint) {
        try {
            const crossOutData = {
                position: { x: localPoint.x, y: localPoint.y },
                pointerId: pixiEvent.data.pointerId,
                timestamp: performance.now(),
                source: 'pixijs-stage'
            };
            
            // EventBus境界越えアウト通知
            this.safeEmitEvent('pixijs.boundary.cross.out', crossOutData);
            
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
    handleBoundaryCrossInIntegration(data) {
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
    handleBoundaryOutsideStart(data) {
        if (!this.boundaryIntegration.eventIntegration) return;
        
        try {
            // AppCore状態更新
            this.safeUpdateState('appcore.boundary.tracking', {
                active: true,
                pointerId: data.pointer.id,
                pointerType: data.pointer.type,
                timestamp: Date.now()
            });
            
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
    handleCanvasBoundaryInitialized(data) {
        try {
            console.log('📡 AppCore: Canvas境界システム初期化完了通知受信');
            
            // AppCore境界統合準備完了
            this.boundarySystemReady = true;
            
            // StateManager状態更新
            this.safeUpdateState('appcore.boundary.system', {
                ready: true,
                canvasIntegrated: true,
                timestamp: Date.now()
            });
            
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
    createCanvasToPixiTransform() {
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
    createPixiToCanvasTransform() {
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
    createGlobalToPixiTransform() {
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
    createPixiToGlobalTransform() {
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
    convertToPixiCoordinate(x, y) {
        if (this.boundaryCoordinateSystem?.canvasToPixi) {
            return this.boundaryCoordinateSystem.canvasToPixi(x, y);
        }
        return { x, y };
    }

    convertToGlobalCoordinate(pixiX, pixiY) {
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
    isPointInsideBoundary(x, y) {
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
     * リサイズ処理
     */
    resize(newWidth, newHeight) {
        try {
            console.log(`📏 AppCore: リサイズ ${newWidth}×${newHeight}`);
            
            // 基本リサイズ
            this.width = newWidth;
            this.height = newHeight;
            
            if (this.app) {
                this.app.renderer.resize(newWidth, newHeight);
            }
            
            // 境界システム更新
            this.updateBoundaryHitAreaOnResize(newWidth, newHeight);
            
            // EventBus通知
            this.safeEmitEvent('appcore.resized', {
                width: newWidth,
                height: newHeight,
                timestamp: Date.now()
            });
            
            console.log('✅ AppCore: リサイズ完了');
            
        } catch (error) {
            console.error('❌ AppCore: リサイズエラー:', error);
        }
    }

    /**
     * 拡張ヒットエリア更新（リサイズ対応）
     */
    updateBoundaryHitAreaOnResize(newWidth, newHeight) {
        if (!this.boundaryIntegration?.enabled || !this.app?.stage) {
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
            
            // デバッグ可視化更新
            if (this.boundaryDebugGraphics) {
                this.app.stage.removeChild(this.boundaryDebugGraphics);
                this.createBoundaryDebugVisualizer();
            }
            
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
    enableBoundaryDebugMode() {
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
    createBoundaryDebugVisualizer() {
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
    runBoundarySystemDiagnosis() {
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
    getBoundarySystemStats() {
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
    // 🎯 統一システム安全呼び出しヘルパー
    // ==========================================

    /**
     * EventBus安全emit
     */
    safeEmitEvent(eventName, data) {
        try {
            if (window.EventBus && typeof window.EventBus.safeEmit === 'function') {
                window.EventBus.safeEmit(eventName, data);
            }
        } catch (error) {
            console.warn(`⚠️ EventBus emit失敗: ${eventName}`, error);
        }
    }

    /**
     * ErrorManager安全エラー表示
     */
    safeShowError(type, message, data) {
        try {
            if (window.ErrorManager && typeof window.ErrorManager.showError === 'function') {
                window.ErrorManager.showError(type, message, data);
            } else {
                console.error(`❌ ${type}: ${message}`, data);
            }
        } catch (error) {
            console.error(`❌ ${type}: ${message}`, data, error);
        }
    }

    /**
     * StateManager安全状態更新
     */
    safeUpdateState(key, value) {
        try {
            if (window.StateManager && typeof window.StateManager.updateState === 'function') {
                window.StateManager.updateState(key, value);
            }
        } catch (error) {
            console.warn(`⚠️ StateManager更新失敗: ${key}`, error);
        }
    }

    /**
     * DOM要素取得
     */
    getCanvas() {
        return this.app?.view || this.app?.canvas || null;
    }

    /**
     * 初期化状態確認
     */
    isReady() {
        return this.isInitialized && !!this.app;
    }

    /**
     * 境界システム状態確認
     */
    isBoundarySystemReady() {
        return this.boundarySystemReady && !!this.boundaryIntegration;
    }

    /**
     * AppCore破棄処理
     */
    destroy() {
        try {
            console.log('🗑️ AppCore: 破棄処理開始...');
            
            // デバッグ可視化削除
            if (this.boundaryDebugGraphics) {
                this.app.stage.removeChild(this.boundaryDebugGraphics);
                this.boundaryDebugGraphics.destroy();
                this.boundaryDebugGraphics = null;
            }
            
            // EventBusリスナー削除
            if (window.EventBus) {
                window.EventBus.off('boundary.cross.in', this.handleBoundaryCrossInIntegration);
                window.EventBus.off('boundary.outside.start', this.handleBoundaryOutsideStart);
                window.EventBus.off('canvas.boundary.initialized', this.handleCanvasBoundaryInitialized);
            }
            
            // PixiJSアプリケーション破棄
            if (this.app) {
                this.app.destroy(true);
                this.app = null;
            }
            
            // 境界システムクリーンアップ
            this.boundaryIntegration = null;
            this.boundarySystemReady = false;
            this.expandedHitArea = null;
            this.stageBoundary = null;
            this.pixiBoundaryEvents = null;
            this.boundaryCoordinateSystem = null;
            
            this.isInitialized = false;
            
            console.log('✅ AppCore: 破棄処理完了');
            
        } catch (error) {
            console.error('❌ AppCore破棄エラー:', error);
        }
    }
}

// ==========================================
// 🎯 グローバル診断・テストコマンド
// ==========================================

/**
 * AppCore境界システム診断コマンド
 */
if (typeof window !== 'undefined') {
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
                        appCore.boundaryDebugGraphics.destroy();
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

    /**
     * 境界システム統合テスト実行
     */
    window.testAppCoreBoundaryIntegration = async function() {
        console.group('🧪 AppCore境界システム統合テスト実行');
        
        const tests = [
            {
                name: 'AppCore初期化確認',
                test: () => {
                    const appCore = window.appCore || window.futabaDrawingTool?.appCore;
                    return appCore?.isReady();
                }
            },
            {
                name: '境界システム初期化確認',
                test: () => {
                    const appCore = window.appCore || window.futabaDrawingTool?.appCore;
                    return appCore?.isBoundarySystemReady();
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
                name: 'Stage境界設定',
                test: () => {
                    const appCore = window.appCore || window.futabaDrawingTool?.appCore;
                    return !!appCore?.stageBoundary?.expanded;
                }
            },
            {
                name: '座標変換システム',
                test: () => {
                    const appCore = window.appCore || window.futabaDrawingTool?.appCore;
                    return !!appCore?.boundaryCoordinateSystem?.enabled;
                }
            },
            {
                name: '統一システム統合',
                test: () => {
                    return !!(window.ConfigManager && window.ErrorManager && 
                             window.EventBus && window.StateManager);
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
        console.log(`📊 AppCore統合テスト結果: ${passCount}/${tests.length} パス`);
        
        if (success) {
            console.log('✅ AppCore境界システム統合完全成功');
        } else {
            console.warn('⚠️ 一部テスト失敗 - 実装確認が必要');
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
}

console.log('🎯 AppCore境界システム統合STEP3修正版実装完了');
console.log('✅ 修正項目:');
console.log('  - 初期化順序修正: 統一システム確認後境界システム初期化');
console.log('  - 安全呼び出し: safeEmitEvent, safeShowError, safeUpdateState');
console.log('  - フォールバック対応: 基本境界システム（統一システムなし対応）');
console.log('  - エラーハンドリング強化: 境界システム初期化失敗時の継続動作');
console.log('  - 診断・テストコマンド: window.diagnoseAppCoreBoundary等');

/**
 * 📋 AppCore STEP3修正版 統合方法:
 * 
 * 1. 既存のapp-core.jsファイルを置き換え
 * 2. main.jsでの初期化:
 *    const appCore = new AppCore();
 *    await appCore.initialize({ width: 800, height: 600 });
 * 
 * 3. テスト実行:
 *    window.testAppCoreBoundaryIntegration();
 *    window.diagnoseAppCoreBoundary();
 * 
 * 🎯 主な修正点:
 * - initializeBoundarySystemSafely(): 統一システム確認後初期化
 * - checkUnifiedSystemAvailability(): 依存関係安全確認
 * - フォールバック境界システム: 統一システムなしでも動作
 * - 安全ヘルパー: safeEmitEvent等でエラー耐性向上
 */