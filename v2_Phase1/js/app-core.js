/**
 * 🎨 AppCore (Phase1完全修復版)
 * 🎯 PHASE1修復内容:
 * 1. CanvasManager初期化引数統一修復
 * 2. CoordinateManager座標統合完全修復  
 * 3. ErrorManager + PopupManager統合修復
 * 4. EventBus safeEmit完全活用
 * 5. 初期化順序最適化
 * 
 * 🔧 キャンバス出現修復: CanvasManager.initialize(options)形式
 * 📐 座標バグ修復: 0,0直線問題完全解消
 * 🚨 ポップアップ修復: ErrorManager-PopupManager統合
 * 
 * 📋 参考定義:
 * - 手順書: Phase 1: 緊急修復（基本動作復旧）
 * - ルールブック: 1.1 責務分離の絶対原則
 * - シンボル辞典: 統一システムAPI群
 */

// Tegaki名前空間初期化
window.Tegaki = window.Tegaki || {};

class AppCore {
    constructor() {
        // 統一システム依存性確認
        this.validateUnifiedSystems();
        this.initializeConfig();
        
        // 基本プロパティ
        this.app = null;
        this.drawingContainer = null;
        this.uiContainer = null;
        
        // 🔧 PHASE1修復: 管理システム参照
        this.coordinateManager = null;
        this.canvasManager = null;
        this.toolManager = null;
        this.boundaryManager = null;
        this.uiManager = null;
        this.popupManager = null; // 新追加
        
        // 状態管理
        this.isInitializing = false;
        this.initializationComplete = false;
        this.initializationFailed = false;
        
        // 🔧 PHASE1修復: 初期化進捗管理
        this.initializationProgress = {
            phase1: false, // 基盤システム
            phase2: false, // Manager初期化
            phase3: false, // 統合・イベント設定
            phase4: false  // 完了処理
        };
        
        console.log('🎨 AppCore (Phase1修復版) インスタンス作成完了');
    }
    
    /**
     * 統一システム依存性確認（強化版）
     */
    validateUnifiedSystems() {
        const required = ['ConfigManager', 'ErrorManager', 'StateManager', 'EventBus'];
        const missing = required.filter(sys => !window[sys]);
        
        if (missing.length > 0) {
            throw new Error(`AppCore: 統一システム依存性エラー: ${missing.join(', ')}`);
        }
        
        console.log('✅ AppCore: 統一システム依存性確認完了');
    }
    
    /**
     * 設定初期化（修復版）
     */
    initializeConfig() {
        try {
            const canvasConfig = window.ConfigManager.getCanvasConfig();
            this.canvasWidth = canvasConfig.width;
            this.canvasHeight = canvasConfig.height;
            this.backgroundColor = canvasConfig.backgroundColor;
            
            // 境界描画設定
            this.boundaryConfig = window.ConfigManager.get('canvas.boundary') || {
                enabled: true,
                margin: 20,
                trackingEnabled: true
            };
            
            console.log('✅ AppCore: 設定初期化完了');
            
        } catch (error) {
            console.warn('⚠️ AppCore: 設定初期化で問題発生、フォールバック使用:', error.message);
            
            // フォールバック設定
            this.canvasWidth = 400;
            this.canvasHeight = 400;
            this.backgroundColor = 0xf0e0d6;
            this.boundaryConfig = { enabled: true, margin: 20, trackingEnabled: true };
        }
    }
    
    /**
     * 🔧 PHASE1修復: 完全修復版初期化メソッド
     * アプリケーション初期化（async修正版・Phase1修復統合）
     */
    async initialize() {
        try {
            console.log('🚀 AppCore (Phase1修復版) 初期化開始...');
            this.isInitializing = true;
            
            // Phase 1: 基盤システム初期化（修復版）
            await this.initializeBasicSystems();
            this.initializationProgress.phase1 = true;
            
            // Phase 2: Manager初期化（完全修復版）
            await this.initializeManagersWithCompletefix();
            this.initializationProgress.phase2 = true;
            
            // Phase 3: 統合・イベント設定（修復版）
            await this.initializeIntegrationAndEvents();
            this.initializationProgress.phase3 = true;
            
            // Phase 4: 完了処理（修復版）
            await this.completeInitializationWithFix();
            this.initializationProgress.phase4 = true;
            
            console.log('✅ AppCore (Phase1修復版) 初期化完了');
            
        } catch (error) {
            console.error('❌ AppCore 初期化失敗:', error);
            await this.handleInitializationError(error);
        }
    }
    
    /**
     * 🔧 PHASE1修復: 基盤システム初期化（修復版）
     */
    async initializeBasicSystems() {
        console.log('🔧 基盤システム初期化（修復版）...');
        
        try {
            // DOM確認
            await this.verifyDOMElements();
            
            // PixiJSアプリケーション初期化
            await this.initializePixiApp();
            
            // コンテナ初期化
            this.initializeContainers();
            
            // 🔧 修復1: CoordinateManager初期化（最優先）
            this.initializeCoordinateManager();
            
            console.log('✅ 基盤システム初期化完了（修復版）');
            
        } catch (error) {
            console.error('❌ 基盤システム初期化エラー:', error);
            throw error;
        }
    }
    
    /**
     * 🔧 PHASE1修復: CoordinateManager初期化（独立・強化版）
     */
    initializeCoordinateManager() {
        console.log('📐 CoordinateManager初期化開始（修復版）...');
        
        try {
            if (window.CoordinateManager) {
                this.coordinateManager = new window.CoordinateManager();
                
                // キャンバスサイズ情報を設定
                if (typeof this.coordinateManager.updateCanvasSize === 'function') {
                    this.coordinateManager.updateCanvasSize(this.canvasWidth, this.canvasHeight);
                }
                
                console.log('✅ CoordinateManager初期化完了（修復版）');
                
                // 座標統合設定確認
                const integrationStatus = this.coordinateManager.getIntegrationStatus?.() || {};
                console.log('📐 座標統合設定確認:', integrationStatus);
                
            } else {
                console.warn('⚠️ CoordinateManager利用不可（オプション）');
                this.coordinateManager = null;
            }
            
        } catch (error) {
            console.error('❌ CoordinateManager初期化失敗:', error);
            window.ErrorManager?.showError('warning', `CoordinateManager初期化エラー: ${error.message}`, {
                context: 'AppCore.initializeCoordinateManager'
            });
            this.coordinateManager = null;
        }
    }
    
    /**
     * 🔧 PHASE1修復: Manager初期化（完全修復版）
     */
    async initializeManagersWithCompletefix() {
        console.log('🔧 Manager統合初期化（完全修復版）...');
        
        try {
            // Step 1: CanvasManager初期化（修復版引数統一）
            await this.initializeCanvasManagerFixed();
            
            // Step 2: PopupManager初期化（新追加）
            await this.initializePopupManager();
            
            // Step 3: ErrorManager-PopupManager統合（修復重点）
            await this.integrateErrorManagerWithPopup();
            
            // Step 4: ToolManager初期化（CoordinateManager統合）
            await this.initializeToolManager();
            
            // Step 5: BoundaryManager初期化（引数統一）
            await this.initializeBoundaryManager();
            
            // Step 6: UIManager初期化
            await this.initializeUIManager();
            
            console.log('✅ Manager統合初期化完了（完全修復版）');
            
        } catch (error) {
            console.error('❌ Manager初期化エラー:', error);
            throw error;
        }
    }
    
    /**
     * 🔧 PHASE1修復: CanvasManager初期化（修復版・引数統一）
     */
    async initializeCanvasManagerFixed() {
        try {
            console.log('🎨 CanvasManager初期化（修復版）...');
            
            // CanvasManagerクラス取得
            const CanvasManagerCtor = window.CanvasManager || 
                                     (window.Tegaki && window.Tegaki.CanvasManager);

            if (!CanvasManagerCtor) {
                throw new Error('CanvasManagerクラスが利用できません');
            }

            // canvasElement取得
            const canvasElement = this.app?.view || 
                                 document.getElementById('drawing-canvas') ||
                                 document.querySelector('canvas');

            if (!canvasElement) {
                throw new Error('canvasElement を取得できませんでした');
            }

            // 🔧 修復: CanvasManager初期化（引数統一）
            this.canvasManager = new CanvasManagerCtor();
            
            // 🔧 修復: initialize(options)形式で呼び出し
            const initSuccess = await this.canvasManager.initialize({
                appCore: this,
                canvasElement: canvasElement,
                config: {
                    backgroundColor: this.backgroundColor,
                    antialias: true
                }
            });

            if (!initSuccess) {
                throw new Error('CanvasManager初期化が失敗しました');
            }

            // 座標統合確認
            if (this.canvasManager.getCoordinateIntegrationState) {
                const integrationState = this.canvasManager.getCoordinateIntegrationState();
                console.log('🎨 CanvasManager座標統合状態:', integrationState);
            }

            console.log('✅ CanvasManager初期化完了（修復版）');

        } catch (error) {
            console.error('❌ CanvasManager初期化エラー:', error);
            window.ErrorManager?.showError('error', `CanvasManager初期化エラー: ${error.message}`, {
                context: 'AppCore.initializeCanvasManagerFixed',
                showReload: true
            });
            this.canvasManager = null;
        }
    }

    /**
     * 🆕 PHASE1修復: PopupManager初期化
     */
    async initializePopupManager() {
        try {
            console.log('🖼️ PopupManager初期化...');
            
            if (window.PopupManager) {
                this.popupManager = new window.PopupManager();
                await this.popupManager.initialize();
                
                console.log('✅ PopupManager初期化完了');
            } else {
                console.warn('⚠️ PopupManager利用不可');
                this.popupManager = null;
            }
            
        } catch (error) {
            console.error('❌ PopupManager初期化エラー:', error);
            window.ErrorManager?.showError('warning', `PopupManager初期化エラー: ${error.message}`, {
                context: 'AppCore.initializePopupManager'
            });
            this.popupManager = null;
        }
    }

    /**
     * 🔧 PHASE1修復: ErrorManager-PopupManager統合（修復重点）
     */
    async integrateErrorManagerWithPopup() {
        try {
            console.log('🚨 ErrorManager-PopupManager統合...');
            
            if (window.ErrorManager && this.popupManager) {
                // ErrorManagerのPopupManager統合を初期化
                const integrationSuccess = window.ErrorManager.initializePopupIntegration(this.popupManager);
                
                if (integrationSuccess) {
                    console.log('✅ ErrorManager-PopupManager統合完了');
                    
                    // 統合テスト（オプション）
                    if (window.location.search.includes('debug=true')) {
                        setTimeout(() => {
                            window.ErrorManager.showWarning('統合テスト: ポップアップ表示確認', {
                                context: 'AppCore.integrateErrorManagerWithPopup',
                                additionalInfo: 'これはテストメッセージです'
                            });
                        }, 1000);
                    }
                } else {
                    console.warn('⚠️ ErrorManager-PopupManager統合に問題が発生');
                }
            } else {
                console.warn('⚠️ ErrorManager または PopupManager が利用不可 - 統合をスキップ');
            }
            
        } catch (error) {
            console.error('❌ ErrorManager-PopupManager統合エラー:', error);
            // この統合は致命的でないため、エラーを記録するのみ
        }
    }

    /**
     * 🔧 PHASE1修復: ToolManager初期化（CoordinateManager統合）
     */
    async initializeToolManager() {
        try {
            console.log('🔧 ToolManager初期化（CoordinateManager統合版）...');
            
            if (window.ToolManager) {
                this.toolManager = new window.ToolManager({ appCore: this });
                
                // 基本初期化
                await this.toolManager.initialize();
                
                // CoordinateManager統合
                if (this.coordinateManager && 
                    typeof this.toolManager.initializeCoordinateManagerIntegration === 'function') {
                    this.toolManager.initializeCoordinateManagerIntegration(this.coordinateManager);
                    console.log('✅ ToolManager: CoordinateManager統合完了');
                } else {
                    console.warn('⚠️ ToolManager: CoordinateManager統合をスキップ');
                }
                
                console.log('✅ ToolManager初期化完了');
                
            } else {
                console.warn('⚠️ ToolManager利用不可');
                this.toolManager = null;
            }
            
        } catch (error) {
            console.error('❌ ToolManager初期化エラー:', error);
            window.ErrorManager?.showError('warning', `ToolManager初期化エラー: ${error.message}`, {
                context: 'AppCore.initializeToolManager'
            });
            this.toolManager = null;
        }
    }

    /**
     * 🔧 PHASE1修復: BoundaryManager初期化（引数統一）
     */
    async initializeBoundaryManager() {
        try {
            console.log('🎯 BoundaryManager初期化（引数統一版）...');
            
            if (window.BoundaryManager) {
                this.boundaryManager = new window.BoundaryManager();
                
                // canvasElementを確実に取得
                const canvasElement = this.app?.view || this.canvasManager?.app?.view;
                
                if (canvasElement) {
                    await this.boundaryManager.initialize(canvasElement, this.coordinateManager);
                    console.log('✅ BoundaryManager初期化完了');
                } else {
                    console.warn('⚠️ canvasElement未取得 - BoundaryManager初期化をスキップ');
                    this.boundaryManager = null;
                }
                
            } else {
                console.warn('⚠️ BoundaryManager利用不可');
                this.boundaryManager = null;
            }
            
        } catch (error) {
            console.error('❌ BoundaryManager初期化エラー:', error);
            window.ErrorManager?.showError('warning', `BoundaryManager初期化エラー: ${error.message}`, {
                context: 'AppCore.initializeBoundaryManager'
            });
            this.boundaryManager = null;
        }
    }

    /**
     * 🔧 PHASE1修復: UIManager初期化
     */
    async initializeUIManager() {
        try {
            console.log('🎪 UIManager初期化...');
            
            if (window.UIManager) {
                this.uiManager = new window.UIManager(this);
                await this.uiManager.init();
                console.log('✅ UIManager初期化完了');
            } else {
                console.warn('⚠️ UIManager利用不可');
                this.uiManager = null;
            }
            
        } catch (error) {
            console.error('❌ UIManager初期化エラー:', error);
            window.ErrorManager?.showError('warning', `UIManager初期化エラー: ${error.message}`, {
                context: 'AppCore.initializeUIManager'
            });
            this.uiManager = null;
        }
    }

    /**
     * 🔧 PHASE1修復: 統合・イベント設定
     */
    async initializeIntegrationAndEvents() {
        console.log('🔄 統合・イベント設定（修復版）...');
        
        try {
            // イベントリスナー設定（CanvasManager統合対応）
            this.setupEventListeners();
            
            // PixiJS境界システム統合
            this.initializePixiBoundarySystem();
            
            // 初期化検証
            this.verifyInitialization();
            
            console.log('✅ 統合・イベント設定完了');
            
        } catch (error) {
            console.error('❌ 統合・イベント設定エラー:', error);
            throw error;
        }
    }

    /**
     * 🔧 PHASE1修復: 完了処理
     */
    async completeInitializationWithFix() {
        try {
            this.isInitializing = false;
            this.initializationComplete = true;
            
            // EventBus safeEmit活用
            if (window.EventBus?.safeEmit) {
                window.EventBus.safeEmit('appCore.initialized', {
                    success: true,
                    components: this.getInitializationStats(),
                    progress: this.initializationProgress,
                    coordinateManagerIntegrated: !!this.coordinateManager,
                    canvasManagerIntegrated: !!this.canvasManager,
                    popupManagerIntegrated: !!this.popupManager,
                    timestamp: Date.now()
                });
            }
            
            // 座標統合診断の自動実行（デバッグモード時）
            if (typeof window.checkCoordinateIntegration === 'function' && 
                window.location.search.includes('debug=true')) {
                setTimeout(() => {
                    console.log('🔍 座標統合自動診断実行中...');
                    window.checkCoordinateIntegration();
                }, 1000);
            }
            
            console.log('🎉 AppCore (Phase1修復版) 初期化完全完了');
            
        } catch (error) {
            console.error('❌ 完了処理エラー:', error);
            throw error;
        }
    }

    /**
     * DOM要素確認（修復版）
     */
    async verifyDOMElements() {
        const canvasElement = document.getElementById('drawing-canvas');
        if (!canvasElement) {
            throw new Error('drawing-canvas 要素が見つかりません');
        }
        
        // キャンバス要素クリア
        while (canvasElement.firstChild) {
            canvasElement.removeChild(canvasElement.firstChild);
        }
        
        console.log('✅ DOM要素確認完了');
    }

    /**
     * PixiJSアプリケーション初期化（修復版）
     */
    async initializePixiApp() {
        try {
            const canvasConfig = window.ConfigManager.getCanvasConfig();
            const pixiConfig = window.ConfigManager.getPixiConfig();
            
            this.app = new PIXI.Application({
                width: canvasConfig.width,
                height: canvasConfig.height,
                backgroundColor: canvasConfig.backgroundColor,
                antialias: pixiConfig.antialias,
                resolution: pixiConfig.resolution || window.devicePixelRatio || 1
            });
            
            const canvasElement = document.getElementById('drawing-canvas');
            canvasElement.appendChild(this.app.view);
            
            // キャンバス要素の基本設定
            this.app.view.style.cursor = pixiConfig.cursor || 'crosshair';
            this.app.view.style.touchAction = 'none'; // タッチスクロール防止
            
            console.log('✅ PixiJSアプリケーション初期化完了');
            
        } catch (error) {
            console.error('❌ PixiJSアプリケーション初期化失敗:', error);
            throw error;
        }
    }

    /**
     * コンテナ初期化（修復版）
     */
    initializeContainers() {
        try {
            // 描画レイヤー
            this.drawingContainer = new PIXI.Container();
            this.drawingContainer.name = 'drawing-layer';
            this.app.stage.addChild(this.drawingContainer);
            
            // UIレイヤー
            this.uiContainer = new PIXI.Container();
            this.uiContainer.name = 'ui-layer';
            this.app.stage.addChild(this.uiContainer);
            
            // ステージのインタラクティブ設定
            this.app.stage.interactive = true;
            this.app.stage.hitArea = new PIXI.Rectangle(0, 0, this.canvasWidth, this.canvasHeight);
            
            console.log('✅ コンテナ初期化完了');
            
        } catch (error) {
            console.error('❌ コンテナ初期化失敗:', error);
            throw error;
        }
    }

    /**
     * 🔧 PHASE1修復: イベントリスナー設定（CanvasManager統合対応）
     */
    setupEventListeners() {
        try {
            console.log('🎯 イベントリスナー設定（CanvasManager統合対応）...');
            
            // 🔧 修復: CanvasManager統合対応
            if (this.canvasManager && this.canvasManager.initialized) {
                console.log('🎨 描画イベントはCanvasManagerに委譲済み（初期化確認済み）');
                // CanvasManagerが既にsetupEventHandlers()で設定済み
            } else {
                console.warn('⚠️ CanvasManager未初期化 - フォールバックイベント処理');
                // フォールバック: AppCoreで直接処理
                this.setupFallbackEventHandlers();
            }
            
            // ウィンドウイベント（AppCore管理）
            window.addEventListener('resize', this.handleResize.bind(this));
            
            // EventBus統合イベント
            if (window.EventBus?.on) {
                window.EventBus.on('boundary.cross.in', this.handleBoundaryCrossIn.bind(this));
                window.EventBus.on('tool.changed', this.handleToolChanged.bind(this));
            }
            
            console.log('✅ イベントリスナー設定完了（CanvasManager統合対応）');
            
        } catch (error) {
            console.error('❌ イベントリスナー設定エラー:', error);
            window.ErrorManager?.showError('warning', `イベントリスナー設定エラー: ${error.message}`, {
                context: 'AppCore.setupEventListeners'
            });
        }
    }

    /**
     * フォールバックイベントハンドラー設定
     */
    setupFallbackEventHandlers() {
        console.log('🔧 フォールバックイベント処理設定...');
        
        try {
            this.app.stage.on('pointerdown', this.handlePointerDown.bind(this));
            this.app.stage.on('pointermove', this.handlePointerMove.bind(this));
            this.app.stage.on('pointerup', this.handlePointerUp.bind(this));
            this.app.stage.on('pointerupoutside', this.handlePointerUp.bind(this));
            
            console.log('✅ フォールバックイベント処理設定完了');
        } catch (error) {
            console.error('❌ フォールバックイベント処理設定エラー:', error);
        }
    }

    /**
     * PixiJS境界システム統合初期化（座標統合修正版）
     */
    initializePixiBoundarySystem() {
        if (!this.app || !this.boundaryManager) {
            console.warn('⚠️ PixiJS境界システム統合スキップ（依存関係不足）');
            return;
        }
        
        try {
            console.log('🎯 PixiJS境界システム統合初期化中...');
            
            // 境界マージン設定（座標統合対応）
            const margin = this.boundaryManager.boundaryMargin || 20;
            let adjustedMargin = margin;
            
            if (this.coordinateManager && typeof this.coordinateManager.applyPrecision === 'function') {
                adjustedMargin = this.coordinateManager.applyPrecision(margin);
            }
            
            // 拡張ヒットエリア設定
            this.app.stage.hitArea = new PIXI.Rectangle(
                -adjustedMargin,
                -adjustedMargin,
                this.canvasWidth + adjustedMargin * 2,
                this.canvasHeight + adjustedMargin * 2
            );
            
            // インタラクティブ強化
            this.app.stage.interactive = true;
            this.app.stage.interactiveChildren = true;
            
            console.log('✅ PixiJS境界システム統合完了');
            
        } catch (error) {
            console.error('❌ PixiJS境界システム統合エラー:', error);
            window.ErrorManager?.showError('warning', `境界システム統合エラー: ${error.message}`, {
                context: 'AppCore.initializePixiBoundarySystem'
            });
        }
    }

    /**
     * 🔧 PHASE1修復: ポインターダウンハンドラー（座標統合修正版）
     */
    handlePointerDown(event) {
        // CanvasManagerが処理済みの場合は何もしない
        if (this.canvasManager) {
            return;
        }
        
        // フォールバック処理
        if (!this.toolManager) {
            console.warn('⚠️ ToolManager が利用できません');
            return;
        }
        
        try {
            // 🔧 修復: CoordinateManager経由での座標処理
            let coords;
            
            if (this.coordinateManager && typeof this.coordinateManager.extractPointerCoordinates === 'function') {
                coords = this.coordinateManager.extractPointerCoordinates(
                    event.data.originalEvent, 
                    this.app.view.getBoundingClientRect(), 
                    this.app
                );
            } else {
                // フォールバック処理（座標バグ修正済み）
                const rect = this.app.view.getBoundingClientRect();
                const originalEvent = event.data.originalEvent;
                coords = {
                    canvas: {
                        x: originalEvent.clientX - rect.left,
                        y: originalEvent.clientY - rect.top
                    },
                    pressure: originalEvent.pressure || 0.5
                };
                console.warn('⚠️ CoordinateManager未利用 - フォールバック座標処理');
            }
            
            if (coords && this.toolManager.startDrawing) {
                this.toolManager.startDrawing(coords.canvas.x, coords.canvas.y, coords.pressure);
                
                if (window.EventBus?.safeEmit) {
                    window.EventBus.safeEmit('drawing.started', {
                        position: coords.canvas,
                        pressure: coords.pressure,
                        tool: this.toolManager.getCurrentTool() || 'unknown',
                        coordinateManagerUsed: !!this.coordinateManager
                    });
                }
            }
            
        } catch (error) {
            console.error('❌ ポインターダウン処理エラー:', error);
            window.ErrorManager?.showError('warning', `ポインターダウンエラー: ${error.message}`, {
                context: 'AppCore.handlePointerDown'
            });
        }
    }

    /**
     * 🔧 PHASE1修復: ポインター移動ハンドラー（座標統合修正版）
     */
    handlePointerMove(event) {
        // CanvasManagerが処理済みの場合は座標表示のみ更新
        if (this.canvasManager) {
            try {
                let coords;
                if (this.coordinateManager && typeof this.coordinateManager.extractPointerCoordinates === 'function') {
                    coords = this.coordinateManager.extractPointerCoordinates(
                        event.data.originalEvent, 
                        this.app.view.getBoundingClientRect()
                    );
                } else {
                    const rect = this.app.view.getBoundingClientRect();
                    const originalEvent = event.data.originalEvent;
                    coords = {
                        canvas: {
                            x: originalEvent.clientX - rect.left,
                            y: originalEvent.clientY - rect.top
                        }
                    };
                }
                this.updateCoordinateDisplay(coords.canvas);
            } catch (error) {
                console.warn('⚠️ 座標表示更新エラー:', error.message);
            }
            return;
        }
        
        // フォールバック処理
        try {
            let coords;
            
            if (this.coordinateManager && typeof this.coordinateManager.extractPointerCoordinates === 'function') {
                coords = this.coordinateManager.extractPointerCoordinates(
                    event.data.originalEvent, 
                    this.app.view.getBoundingClientRect()
                );
            } else {
                // フォールバック処理
                const rect = this.app.view.getBoundingClientRect();
                const originalEvent = event.data.originalEvent;
                coords = {
                    canvas: {
                        x: originalEvent.clientX - rect.left,
                        y: originalEvent.clientY - rect.top
                    },
                    pressure: originalEvent.pressure || 0.5
                };
            }
            
            if (coords) {
                // 座標表示更新
                this.updateCoordinateDisplay(coords.canvas);
                
                // ツール描画継続
                if (this.toolManager && this.toolManager.continueDrawing) {
                    this.toolManager.continueDrawing(coords.canvas.x, coords.canvas.y, coords.pressure);
                }
            }
            
        } catch (error) {
            console.warn('⚠️ ポインター移動処理エラー:', error.message);
        }
    }

    /**
     * ポインターアップハンドラー（修復版）
     */
    handlePointerUp(event) {
        // CanvasManagerが処理済みの場合は何もしない
        if (this.canvasManager) {
            return;
        }
        
        // フォールバック: ToolManager直接処理
        if (!this.toolManager) return;
        
        try {
            if (this.toolManager.stopDrawing) {
                this.toolManager.stopDrawing();
            }
            
            if (window.EventBus?.safeEmit) {
                window.EventBus.safeEmit('drawing.ended', {
                    timestamp: Date.now()
                });
            }
            
        } catch (error) {
            console.error('❌ ポインターアップ処理エラー:', error);
            window.ErrorManager?.showError('warning', `ポインターアップエラー: ${error.message}`, {
                context: 'AppCore.handlePointerUp'
            });
        }
    }

    /**
     * 座標表示更新（修復版）
     */
    updateCoordinateDisplay(canvasCoords) {
        try {
            const coordinatesElement = document.getElementById('coordinates');
            if (coordinatesElement) {
                coordinatesElement.textContent = `x: ${Math.round(canvasCoords.x)}, y: ${Math.round(canvasCoords.y)}`;
            }
        } catch (error) {
            // 座標表示エラーは致命的ではないため、ログのみ
            console.warn('⚠️ 座標表示更新エラー:', error.message);
        }
    }

    /**
     * リサイズハンドラー（座標統合修正版・CanvasManager委譲）
     */
    handleResize() {
        if (!this.app) return;
        
        console.log('🔄 ウィンドウリサイズ検出');
        
        try {
            // CanvasManagerに委譲
            if (this.canvasManager && typeof this.canvasManager.resize === 'function') {
                this.canvasManager.resize(this.canvasWidth, this.canvasHeight);
            }
            
            // CoordinateManagerにリサイズ通知
            if (this.coordinateManager && typeof this.coordinateManager.updateCanvasSize === 'function') {
                this.coordinateManager.updateCanvasSize(this.canvasWidth, this.canvasHeight);
            }
            
            if (window.EventBus?.safeEmit) {
                window.EventBus.safeEmit('window.resized', {
                    width: this.canvasWidth,
                    height: this.canvasHeight,
                    coordinateManagerUpdated: !!this.coordinateManager,
                    canvasManagerUpdated: !!this.canvasManager,
                    timestamp: Date.now()
                });
            }
            
        } catch (error) {
            console.error('❌ リサイズ処理エラー:', error);
            window.ErrorManager?.showError('warning', `リサイズエラー: ${error.message}`, {
                context: 'AppCore.handleResize'
            });
        }
    }

    /**
     * 境界越え処理（修復版）
     */
    handleBoundaryCrossIn(data) {
        // CanvasManagerに委譲
        if (this.canvasManager && typeof this.canvasManager.handleBoundaryCrossIn === 'function') {
            this.canvasManager.handleBoundaryCrossIn(data);
            return;
        }
        
        // フォールバック: ToolManager直接処理
        if (!this.toolManager) {
            console.warn('⚠️ ToolManager が利用できません');
            return;
        }
        
        try {
            const currentTool = this.toolManager.getCurrentTool();
            const currentToolInstance = this.toolManager.registeredTools?.get(currentTool);
            
            if (currentToolInstance && typeof currentToolInstance.handleBoundaryCrossIn === 'function') {
                currentToolInstance.handleBoundaryCrossIn(
                    data.position.x, 
                    data.position.y, 
                    {
                        pressure: data.pressure,
                        pointerId: data.pointerId,
                        originalEvent: data.originalEvent,
                        pointerType: data.pointerType
                    }
                );
            }
            
            console.log(`🎯 境界越え描画開始: (${data.position.x.toFixed(1)}, ${data.position.y.toFixed(1)})`);
            
        } catch (error) {
            console.error('❌ 境界越え処理エラー:', error);
            window.ErrorManager?.showError('warning', `境界越え描画エラー: ${error.message}`, {
                context: 'AppCore.handleBoundaryCrossIn'
            });
        }
    }

    /**
     * ツール変更ハンドラー（修復版）
     */
    handleToolChanged(data) {
        console.log(`🔧 ツール変更: ${data.previousTool || '不明'} → ${data.tool || '不明'}`);
    }

    /**
     * 初期化エラー処理（修復版）
     */
    async handleInitializationError(error) {
        console.error('💀 AppCore初期化エラー:', error);
        
        this.initializationFailed = true;
        this.isInitializing = false;
        
        if (window.ErrorManager?.showCriticalError) {
            window.ErrorManager.showCriticalError(`AppCore初期化失敗: ${error.message}`, {
                context: 'AppCore.initialize',
                additionalInfo: 'アプリケーション初期化エラー',
                showReload: true
            });
        }
        
        // フォールバックモード試行
        await this.initializeFallbackMode(error);
    }

    /**
     * 初期化検証（座標統合修正版・CanvasManager対応）
     */
    verifyInitialization() {
        const verification = {
            pixiApp: !!this.app,
            drawingContainer: !!this.drawingContainer,
            coordinateManager: !!this.coordinateManager,
            canvasManager: !!this.canvasManager,
            popupManager: !!this.popupManager,
            toolManager: !!this.toolManager,
            boundaryManager: !!this.boundaryManager,
            uiManager: !!this.uiManager
        };
        
        const passCount = Object.values(verification).filter(Boolean).length;
        const totalCount = Object.keys(verification).length;
        
        console.log(`✅ 初期化検証: ${passCount}/${totalCount} (${(passCount/totalCount*100).toFixed(1)}%)`);
        
        // 座標統合確認
        if (this.coordinateManager && typeof this.coordinateManager.getIntegrationStatus === 'function') {
            const integrationStatus = this.coordinateManager.getIntegrationStatus();
            console.log('📐 座標統合状態:', integrationStatus);
        }
        
        // CanvasManager統合確認
        if (this.canvasManager && typeof this.canvasManager.getCoordinateIntegrationState === 'function') {
            const canvasIntegrationState = this.canvasManager.getCoordinateIntegrationState();
            console.log('🎨 CanvasManager座標統合状態:', canvasIntegrationState);
        }
        
        if (passCount < 3) { // 最低限PixiJS, DrawingContainer, 1つのManagerがあれば動作可能
            const failed = Object.entries(verification)
                .filter(([key, value]) => !value)
                .map(([key]) => key);
            
            console.warn('⚠️ 初期化未完了:', failed.join(', '));
            
            if (window.ErrorManager?.showWarning) {
                window.ErrorManager.showWarning(`初期化未完了: ${failed.join(', ')}`, {
                    context: 'AppCore.verifyInitialization'
                });
            }
        }
    }

    /**
     * 初期化統計取得（座標統合修正版・PopupManager対応）
     */
    getInitializationStats() {
        const stats = {
            pixiApp: !!this.app,
            drawingContainer: !!this.drawingContainer,
            coordinateManager: !!this.coordinateManager,
            canvasManager: !!this.canvasManager,
            popupManager: !!this.popupManager,
            toolManager: !!this.toolManager,
            boundaryManager: !!this.boundaryManager,
            uiManager: !!this.uiManager,
            initializationComplete: this.initializationComplete,
            initializationFailed: this.initializationFailed,
            progress: this.initializationProgress
        };
        
        // 座標統合状態を追加
        if (this.coordinateManager && typeof this.coordinateManager.getIntegrationStatus === 'function') {
            const integrationStatus = this.coordinateManager.getIntegrationStatus();
            stats.coordinateIntegration = {
                enabled: integrationStatus.managerCentralization,
                duplicateElimination: integrationStatus.duplicateElimination,
                performanceOptimized: integrationStatus.performanceOptimized,
                bugPrevention: integrationStatus.bugPreventionActive
            };
        }
        
        // CanvasManager統合状態を追加
        if (this.canvasManager && typeof this.canvasManager.getCoordinateIntegrationState === 'function') {
            const canvasIntegrationState = this.canvasManager.getCoordinateIntegrationState();
            stats.canvasManagerIntegration = {
                coordinateManagerAvailable: canvasIntegrationState.coordinateManagerAvailable,
                integrationEnabled: canvasIntegrationState.integrationEnabled,
                duplicateElimination: canvasIntegrationState.duplicateElimination
            };
        }
        
        // PopupManager統合状態を追加
        if (this.popupManager && typeof this.popupManager.getStats === 'function') {
            const popupStats = this.popupManager.getStats();
            stats.popupManagerIntegration = {
                available: true,
                totalPopups: popupStats.total,
                visiblePopups: popupStats.visible,
                errorIntegration: !!(window.ErrorManager && window.ErrorManager.popupManager)
            };
        }
        
        return stats;
    }

    /**
     * 🆕 座標統合状態取得（外部アクセス用・全統合対応）
     */
    getCoordinateIntegrationState() {
        return {
            coordinateManagerAvailable: !!this.coordinateManager,
            boundaryManagerIntegrated: !!(this.boundaryManager && this.boundaryManager.coordinateManager),
            toolManagerIntegrated: !!(this.toolManager && this.toolManager.coordinateManager),
            canvasManagerIntegrated: !!(this.canvasManager && this.canvasManager.coordinateManager),
            coordinateManagerState: this.coordinateManager ? 
                (typeof this.coordinateManager.getCoordinateState === 'function' ? 
                 this.coordinateManager.getCoordinateState() : 'available') : null,
            canvasManagerState: this.canvasManager ?
                (typeof this.canvasManager.getCoordinateIntegrationState === 'function' ? 
                 this.canvasManager.getCoordinateIntegrationState() : 'available') : null,
            appCoreState: this.getInitializationStats(),
            phase2Ready: !!(this.coordinateManager && 
                           this.boundaryManager?.coordinateManager && 
                           this.toolManager?.coordinateManager &&
                           this.canvasManager?.coordinateManager)
        };
    }

    /**
     * フォールバックモード初期化（修復版）
     */
    async initializeFallbackMode(originalError) {
        console.log('🛡️ フォールバックモード初期化中...');
        
        try {
            // 最低限のPixiJSアプリケーション作成
            if (!this.app) {
                const fallbackConfig = {
                    width: window.ConfigManager?.get('canvas.width') || 400,
                    height: window.ConfigManager?.get('canvas.height') || 400,
                    backgroundColor: window.ConfigManager?.get('canvas.backgroundColor') || 0xf0e0d6
                };
                
                this.app = new PIXI.Application(fallbackConfig);
                const canvasElement = document.getElementById('drawing-canvas');
                if (canvasElement) {
                    canvasElement.appendChild(this.app.view);
                }
            }
            
            // 最低限のコンテナ作成
            if (!this.drawingContainer) {
                this.initializeContainers();
            }
            
            if (window.ErrorManager?.showError) {
                window.ErrorManager.showError('recovery', '基本描画機能は利用可能です', {
                    context: 'AppCore.initializeFallbackMode',
                    additionalInfo: 'フォールバックモードで動作中'
                });
            }
            
            console.log('✅ フォールバックモード初期化完了');
            
        } catch (fallbackError) {
            console.error('💀 フォールバックモード初期化失敗:', fallbackError);
            if (window.ErrorManager?.showCriticalError) {
                window.ErrorManager.showCriticalError(`フォールバック失敗: ${originalError.message}`, {
                    context: 'AppCore.initializeFallbackMode',
                    additionalInfo: `フォールバックエラー: ${fallbackError.message}`,
                    showReload: true
                });
            }
        }
    }

    /**
     * 🆕 Phase1修復完了診断
     */
    runPhase1DiagnosticCheck() {
        try {
            console.log('🔍 Phase1修復完了診断開始...');
            
            const diagnostic = {
                // 基本システム
                pixiApp: {
                    initialized: !!this.app,
                    canvasAttached: !!(this.app && document.contains(this.app.view)),
                    containers: !!this.drawingContainer && !!this.uiContainer
                },
                
                // 座標系修復確認
                coordinateSystem: {
                    managerAvailable: !!this.coordinateManager,
                    integrationEnabled: this.coordinateManager && 
                                       typeof this.coordinateManager.getIntegrationStatus === 'function' &&
                                       this.coordinateManager.getIntegrationStatus().managerCentralization,
                    bugPreventionActive: this.coordinateManager &&
                                        typeof this.coordinateManager.getIntegrationStatus === 'function' &&
                                        this.coordinateManager.getIntegrationStatus().bugPreventionActive,
                    testResult: this.coordinateManager && 
                               typeof this.coordinateManager.runCoordinateTest === 'function' ?
                               this.coordinateManager.runCoordinateTest() : null
                },
                
                // キャンバス修復確認
                canvasSystem: {
                    managerAvailable: !!this.canvasManager,
                    initialized: !!(this.canvasManager && this.canvasManager.initialized),
                    coordinateIntegrated: !!(this.canvasManager && this.canvasManager.coordinateManager),
                    layerCount: this.canvasManager && this.canvasManager.layers ? 
                               this.canvasManager.layers.size : 0
                },
                
                // ポップアップ修復確認
                popupSystem: {
                    managerAvailable: !!this.popupManager,
                    errorIntegration: !!(window.ErrorManager && window.ErrorManager.popupManager),
                    popupCount: this.popupManager && typeof this.popupManager.getStats === 'function' ?
                               this.popupManager.getStats().total : 0
                },
                
                // 統合状態
                integration: {
                    initializationProgress: this.initializationProgress,
                    allPhases: Object.values(this.initializationProgress).every(phase => phase),
                    errorHandling: !!(window.ErrorManager && typeof window.ErrorManager.showError === 'function'),
                    eventBus: !!(window.EventBus && typeof window.EventBus.safeEmit === 'function')
                }
            };
            
            // 診断結果評価
            const issues = [];
            const recommendations = [];
            
            if (!diagnostic.pixiApp.initialized) {
                issues.push('PixiJSアプリケーション未初期化');
                recommendations.push('AppCore.initialize()を実行してください');
            }
            
            if (!diagnostic.coordinateSystem.managerAvailable) {
                issues.push('CoordinateManager未利用');
                recommendations.push('座標バグ防止のためCoordinateManagerを有効化してください');
            }
            
            if (!diagnostic.canvasSystem.initialized) {
                issues.push('CanvasManager未初期化');
                recommendations.push('キャンバス表示のためCanvasManagerを初期化してください');
            }
            
            if (!diagnostic.popupSystem.errorIntegration) {
                issues.push('ErrorManager-PopupManager統合未完了');
                recommendations.push('ポップアップエラー表示のため統合を完了してください');
            }
            
            if (!diagnostic.integration.allPhases) {
                issues.push('初期化未完了');
                recommendations.push('全初期化フェーズを完了してください');
            }
            
            const healthy = issues.length === 0;
            
            const result = {
                healthy,
                issues,
                recommendations,
                diagnostic,
                timestamp: Date.now(),
                phase1Status: healthy ? 'COMPLETED' : 'INCOMPLETE'
            };
            
            console.log('📊 Phase1修復診断結果:', result);
            
            if (healthy) {
                console.log('🎉 Phase1修復完了 - 基本動作復旧成功');
            } else {
                console.warn('⚠️ Phase1修復未完了 - 残課題あり:', issues);
            }
            
            return result;
            
        } catch (error) {
            console.error('❌ Phase1診断エラー:', error);
            return {
                healthy: false,
                issues: ['診断実行エラー'],
                recommendations: ['診断システムを確認してください'],
                error: error.message,
                timestamp: Date.now()
            };
        }
    }

    /**
     * システム破棄（座標統合修正版・全Manager対応）
     */
    destroy() {
        try {
            console.log('🎨 AppCore 破棄開始（全Manager対応）...');
            
            // PopupManager破棄
            if (this.popupManager && typeof this.popupManager.cleanup === 'function') {
                this.popupManager.cleanup();
                this.popupManager = null;
            }
            
            // ErrorManager PopupManager統合解除
            if (window.ErrorManager && typeof window.ErrorManager.destroy === 'function') {
                window.ErrorManager.destroy();
            }
            
            // CanvasManager破棄
            if (this.canvasManager && typeof this.canvasManager.destroy === 'function') {
                this.canvasManager.destroy();
                this.canvasManager = null;
            }
            
            // 境界管理システム破棄
            if (this.boundaryManager && typeof this.boundaryManager.destroy === 'function') {
                this.boundaryManager.destroy();
                this.boundaryManager = null;
            }
            
            // ツールマネージャー破棄
            if (this.toolManager && typeof this.toolManager.destroy === 'function') {
                this.toolManager.destroy();
                this.toolManager = null;
            }
            
            // UIマネージャー破棄
            if (this.uiManager && typeof this.uiManager.destroy === 'function') {
                this.uiManager.destroy();
                this.uiManager = null;
            }
            
            // CoordinateManager破棄
            if (this.coordinateManager && typeof this.coordinateManager.destroy === 'function') {
                this.coordinateManager.destroy();
                this.coordinateManager = null;
            }
            
            // PixiJSアプリケーション破棄
            if (this.app) {
                this.app.destroy(true);
                this.app = null;
            }
            
            // プロパティクリア
            this.drawingContainer = null;
            this.uiContainer = null;
            this.initializationComplete = false;
            this.initializationFailed = false;
            
            console.log('🎨 AppCore 破棄完了（Phase1修復版）');
            
        } catch (error) {
            console.error('❌ AppCore破棄エラー:', error);
            if (window.ErrorManager?.showError) {
                window.ErrorManager.showError('warning', `AppCore破棄エラー: ${error.message}`, {
                    context: 'AppCore.destroy',
                    additionalInfo: 'AppCore破棄処理'
                });
            }
        }
    }
}

// Tegaki名前空間に登録
window.Tegaki.AppCore = AppCore;

// 初期化レジストリ方式
window.Tegaki._registry = window.Tegaki._registry || [];
window.Tegaki._registry.push(() => {
    window.Tegaki.AppCoreInstance = new AppCore();
    console.log('🎨 Tegaki.AppCoreInstance registered');
});

// グローバル登録（下位互換）
if (typeof window !== 'undefined') {
    window.AppCore = AppCore;
}

// 🔄 PixiJS v8対応準備コメント
// - PIXI.Application API基本継続
// - Manager統合パターンはv8でも有効
// - 座標系統合はv8でも継続利用可能

console.log('🎨 AppCore (Phase1完全修復版) Loaded - キャンバス出現・座標統合・ポップアップ修復完了');
console.log('💡 Phase1修復内容: CanvasManager初期化・CoordinateManager統合・ErrorManager-PopupManager統合');
console.log('🔧 使用例: const appCore = new AppCore(); await appCore.initialize();');
console.log('🔍 診断: appCore.runPhase1DiagnosticCheck() で修復状況確認');