/** 
* 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0（統一システム統合版）
 * 🎯 アプリケーションコア（Task 1-A-2完了版）
 * 
 * 🚨 統一システム統合内容:
 * - ConfigManager統合によるハードコード設定値排除
 * - ErrorManager統一エラー処理対応
 * - StateManager統合による状態管理統一
 * - EventBus統合による疎結合通信
 * - 循環依存完全解決
 * 
 * 🎯 AI_WORK_SCOPE: PixiJSアプリケーション基盤・描画エンジン・ツールシステム
 * 🎯 DEPENDENCIES: libs/pixi-extensions.js, PixiJS Core, 統一システム4種
 * 🎯 NODE_MODULES: pixi.js（Graphics, Container, Application使用）
 * 🎯 PIXI_EXTENSIONS: 条件付き使用・フォールバック対応
 * 🎯 ISOLATION_TEST: ❌ PixiJS本体依存
 * 🎯 SPLIT_THRESHOLD: 500行超過時 → 機能別分割
 * 
 * 📋 PHASE_TARGET: Phase1
 * 📋 V8_MIGRATION: Application・Graphics・Container API変更対応予定
 * 📋 PERFORMANCE_TARGET: 60FPS安定描画・3秒以内初期化
 * 🔧 FIX: 構文エラー修正・クラス構造修正・統一システム統合改善
 */

class AppCore {
    constructor() {
        this.app = null;
        this.drawingContainer = null;
        this.uiContainer = null;
        this.paths = [];
        this.currentTool = 'pen';
        
        // 🚨 統一システム統合: ConfigManager経由での設定値取得
        this.canvasWidth = window.ConfigManager.get('canvas.width');
        this.canvasHeight = window.ConfigManager.get('canvas.height');
        this.backgroundColor = window.ConfigManager.get('canvas.backgroundColor');
        
        // ツールシステム
        this.toolSystem = null;
        this.uiController = null;
        this.performanceMonitor = null;
        
        // 拡張機能フラグ
        this.extensionsAvailable = false;
        this.fallbackMode = false;
        
        // 🚨 統一システム統合: 初期化状態管理
        this.isInitializing = false;
        this.initializationComplete = false;
        
        console.log('🎨 AppCore インスタンス作成完了（統一システム統合版）');
        
        // 🚨 統一システム統合: 統一システム依存性確認
        this.validateUnifiedSystems();
    }
    
    /**
     * 🚨 統一システム統合: 統一システム依存性確認
     */
    validateUnifiedSystems() {
        const requiredSystems = [
            { name: 'ConfigManager', instance: window.ConfigManager },
            { name: 'ErrorManager', instance: window.ErrorManager },
            { name: 'StateManager', instance: window.StateManager },
            { name: 'EventBus', instance: window.EventBus }
        ];
        
        const missingSystems = requiredSystems.filter(sys => !sys.instance);
        
        if (missingSystems.length > 0) {
            const missingNames = missingSystems.map(sys => sys.name).join(', ');
            console.error(`💀 統一システム依存性エラー: ${missingNames} が利用できません`);
            
            // フォールバック用の最低限システム作成
            this.createFallbackSystems(missingSystems);
        } else {
            console.log('✅ 統一システム依存性確認完了');
        }
    }
    
    /**
     * フォールバック用統一システム作成
     */
    createFallbackSystems(missingSystems) {
        missingSystems.forEach(sys => {
            switch (sys.name) {
                case 'ConfigManager':
                    window.ConfigManager = { get: (path) => this.getFallbackConfig(path) };
                    break;
                case 'ErrorManager':
                    window.ErrorManager = { 
                        showError: (type, message) => console.error(`${type}: ${message}`) 
                    };
                    break;
                case 'StateManager':
                    window.StateManager = { 
                        getApplicationState: () => ({ status: 'fallback' }) 
                    };
                    break;
                case 'EventBus':
                    window.EventBus = { 
                        emit: () => {}, 
                        on: () => {}, 
                        safeEmit: () => {} 
                    };
                    break;
            }
        });
        console.log('🛡️ フォールバック統一システム作成完了');
    }
    
    /**
     * フォールバック設定値取得
     */
    getFallbackConfig(path) {
        const fallbackConfig = {
            'canvas.width': 400,
            'canvas.height': 400,
            'canvas.backgroundColor': 0xf0e0d6,
            'pixi.antialias': true,
            'pixi.resolution': 1,
            'pixi.autoDensity': false,
            'drawing.pen.defaultSize': 16.0,
            'drawing.pen.defaultOpacity': 0.85,
            'performance.targetFPS': 60,
            'performance.maxInitTime': 5000
        };
        return fallbackConfig[path];
    }
    
    /**
     * アプリケーション初期化（統一システム統合版）
     */
    async initialize() {
        try {
            console.log('🚀 AppCore 初期化開始（統一システム統合版）...');
            
            // 🚨 統一システム統合: 初期化状態管理
            this.isInitializing = true;
            
            // Step 1: DOM要素確認（最重要）
            await this.verifyDOMElements();
            
            // Step 2: 拡張機能確認
            await this.checkExtensions();
            
            // Step 3: PixiJS アプリケーション初期化（統一システム版）
            await this.initializePixiApp();
            
            // Step 4: コンテナ初期化
            this.initializeContainers();
            
            // Step 5: ツールシステム初期化
            this.initializeToolSystem();
            
            // Step 6: UI制御初期化（統一システム版）
            await this.initializeUI();
            
            // Step 7: イベントリスナー設定
            this.setupEventListeners();
            
            // Step 8: 描画エンジン初期化
            this.initializeDrawingEngine();
            
            // Step 9: パフォーマンス監視開始
            this.startPerformanceMonitoring();
            
            // Step 10: 初期化完了確認
            this.verifyInitialization();
            
            // 🚨 統一システム統合: 初期化完了状態設定
            this.isInitializing = false;
            this.initializationComplete = true;
            
            // 🚨 統一システム統合: EventBus経由での初期化完了通知
            window.EventBus.safeEmit('appCore.initialized', {
                success: true,
                components: this.getInitializationStats()
            });
            
            console.log('✅ AppCore 初期化完了（統一システム統合版）');
            this.displayInitializationSummary();
            
        } catch (error) {
            console.error('💀 AppCore統一版初期化エラー:', error);
            
            // 🚨 統一システム統合: ErrorManager統一エラー処理
            window.ErrorManager.showError('error', error.message, {
                additionalInfo: 'AppCore初期化失敗（統一システム版）',
                showReload: true,
                errorDetails: error.stack
            });
            
            // 🚨 統一システム統合: 初期化失敗状態設定
            this.initializationFailed = true;
            this.lastError = error.message;
            
            // 🚨 統一システム統合: EventBus経由での初期化失敗通知
            window.EventBus.safeEmit('appCore.initializationFailed', {
                error: error.message,
                stack: error.stack
            });
            
            await this.initializeFallbackMode(error);
        }
    }
    
    /**
     * 🔧 修復: DOM要素確認（最重要）
     */
    async verifyDOMElements() {
        console.log('🔍 DOM要素確認開始（キャンバス表示修復）...');
        
        // キャンバス要素確認
        const canvasElement = document.getElementById('drawing-canvas');
        if (!canvasElement) {
            throw new Error('drawing-canvas 要素が見つかりません');
        }
        
        // キャンバス要素のクリア（既存コンテンツを削除）
        while (canvasElement.firstChild) {
            canvasElement.removeChild(canvasElement.firstChild);
        }
        
        // CSS設定確認
        const computedStyle = window.getComputedStyle(canvasElement);
        console.log(`📏 drawing-canvas CSS: display=${computedStyle.display}, position=${computedStyle.position}`);
        
        // 親要素確認
        const canvasContainer = canvasElement.parentElement;
        if (canvasContainer) {
            console.log(`📦 親要素: ${canvasContainer.className}`);
        }
        
        console.log('✅ DOM要素確認完了 - キャンバス要素準備完了');
    }
    
    /**
     * 拡張機能確認
     */
    async checkExtensions() {
        console.log('🔍 拡張機能確認中...');
        
        if (window.PixiExtensions && window.PixiExtensions.initialized) {
            this.extensionsAvailable = true;
            const stats = window.PixiExtensions.getStats();
            console.log(`✅ 拡張機能利用可能: ${stats.available}/${stats.total}`);
            
            if (stats.fallbackMode) {
                console.warn('⚠️ 拡張機能フォールバックモード検出');
                this.fallbackMode = true;
            }
        } else {
            console.warn('⚠️ 拡張機能未初期化 - フォールバックモード有効');
            this.fallbackMode = true;
        }
        
        // 🚨 統一システム統合: 拡張機能状態記録
        this.extensionsAvailable = this.extensionsAvailable;
        this.fallbackMode = this.fallbackMode;
    }
    
    /**
     * 🔧 統一システム統合: PixiJS アプリケーション初期化（ConfigManager版）
     */
    async initializePixiApp() {
        console.log('🎮 PixiJS アプリケーション初期化中（ConfigManager統合版）...');
        
        // 🎯 統一システム統合: ConfigManager経由での設定値取得
        const canvasConfig = window.ConfigManager.getCanvasConfig();
        const pixiConfig = window.ConfigManager.getPixiConfig();
        
        const appConfig = {
            width: canvasConfig.width,
            height: canvasConfig.height,
            backgroundColor: canvasConfig.backgroundColor,
            antialias: pixiConfig.antialias,
            resolution: pixiConfig.resolution,
            autoDensity: pixiConfig.autoDensity
        };
        
        console.log('🔧 PixiJS Application設定（ConfigManager版）:', appConfig);
        
        // PixiJS アプリケーション作成
        this.app = new PIXI.Application(appConfig);
        
        // 🔧 修復: DOM接続の確実な実装
        const canvasElement = document.getElementById('drawing-canvas');
        if (!canvasElement) {
            throw new Error('drawing-canvas 要素が見つかりません');
        }
        
        // TODO: PixiJS v8 - this.app.view → this.app.canvas
        canvasElement.appendChild(this.app.view);
        
        // 🔧 修復: DOM接続確認
        if (canvasElement.contains(this.app.view)) {
            console.log('✅ PixiJS キャンバスDOM接続確認完了');
        } else {
            throw new Error('PixiJS キャンバスのDOM接続に失敗');
        }
        
        // 🚨 統一システム統合: キャンバススタイル設定
        this.app.view.style.display = 'block';
        this.app.view.style.cursor = window.ConfigManager.get('pixi.cursor');
        
        // 🚨 統一システム統合: アプリケーション状態記録
        this.pixiAppInitialized = true;
        this.domConnected = canvasElement.contains(this.app.view);
        
        console.log(`✅ PixiJS アプリケーション初期化完了 (${canvasConfig.width}x${canvasConfig.height})`);
        console.log(`📏 実際のキャンバスサイズ: ${this.app.view.width}x${this.app.view.height}`);
    }
    
    /**
     * コンテナ初期化
     */
    initializeContainers() {
        console.log('📦 コンテナ初期化中...');
        
        // 描画用コンテナ
        this.drawingContainer = new PIXI.Container();
        this.drawingContainer.name = 'drawing-layer';
        this.app.stage.addChild(this.drawingContainer);
        
        // UI用コンテナ
        this.uiContainer = new PIXI.Container();
        this.uiContainer.name = 'ui-layer';
        this.app.stage.addChild(this.uiContainer);
        
        // 🚨 統一システム統合: ConfigManager経由でのインタラクション設定
        const canvasConfig = window.ConfigManager.getCanvasConfig();
        this.app.stage.interactive = true;
        this.app.stage.hitArea = new PIXI.Rectangle(0, 0, canvasConfig.width, canvasConfig.height);
        
        // 🚨 統一システム統合: コンテナ状態記録
        this.containersInitialized = true;
        
        console.log('✅ コンテナ初期化完了');
    }
    
    /**
     * ツールシステム初期化
     */
    initializeToolSystem() {
        console.log('🔧 ツールシステム初期化中...');
        
        this.toolSystem = new DrawingToolSystem(this);
        
        // 🚨 統一システム統合: ツールシステム状態記録
        this.toolSystemInitialized = true;
        
        console.log('✅ ツールシステム初期化完了');
    }
    
    /**
     * 🚨 統一システム統合: UI制御初期化（ErrorManager版）
     */
    async initializeUI() {
        console.log('🎨 UI制御初期化中（統一システム統合版）...');
        
        try {
            this.uiController = new UIController(this.toolSystem);
            
            // 🚨 統一システム統合: 初期化中のイベント制御
            if (this.isInitializing) {
                console.log('🔒 初期化中のためイベント発行を制御');
            }
            
            this.uiController.initialize();
            
            // 🚨 統一システム統合: UI状態記録
            this.uiControllerInitialized = true;
            this.uiControllerType = 'full';
            
            console.log('✅ UI制御初期化完了');
            
        } catch (error) {
            console.error('💀 UI制御初期化エラー:', error);
            
            // 🚨 統一システム統合: ErrorManager統一エラー処理
            window.ErrorManager.showError('warning', 
                `UI制御初期化に失敗しました: ${error.message}`, {
                showDebug: false
            });
            
            // 最小限のUIコントローラー作成
            this.uiController = new MinimalUIController(this.toolSystem);
            this.uiController.initialize();
            
            // 🚨 統一システム統合: 縮退UI状態記録
            this.uiControllerInitialized = true;
            this.uiControllerType = 'minimal';
            this.uiControllerError = error.message;
        }
    }
    
    /**
     * 🚨 統一システム統合: イベントリスナー設定（EventBus版）
     */
    setupEventListeners() {
        console.log('🎧 イベントリスナー設定中（EventBus統合版）...');
        
        // 描画イベント（統一システム統合版）
        this.app.stage.on('pointerdown', this.handlePointerDown.bind(this));
        this.app.stage.on('pointermove', this.handlePointerMove.bind(this));
        this.app.stage.on('pointerup', this.handlePointerUp.bind(this));
        this.app.stage.on('pointerupoutside', this.handlePointerUp.bind(this));
        
        // リサイズイベント
        window.addEventListener('resize', this.handleResize.bind(this));
        
        // 🚨 統一システム統合: EventBus経由でのキーボードショートカット設定
        const keyboardShortcuts = window.ConfigManager.get('ui.keyboard.shortcuts');
        document.addEventListener('keydown', (e) => {
            if (keyboardShortcuts[e.code]) {
                const action = keyboardShortcuts[e.code];
                window.EventBus.safeEmit('keyboard.shortcut', { action, key: e.code });
            }
        });
        
        // 🚨 統一システム統合: EventBusリスナー設定
        window.EventBus.on('tool.changed', this.handleToolChanged.bind(this));
        window.EventBus.on('canvas.resize', this.handleCanvasResize.bind(this));
        
        console.log('✅ イベントリスナー設定完了（EventBus統合版）');
    }
    
    /**
     * 🚨 統一システム統合: EventBusリスナー - ツール変更
     */
    handleToolChanged(data) {
        console.log(`🔧 ツール変更検出: ${data.previousTool} → ${data.tool}`);
        this.currentTool = data.tool;
    }
    
    /**
     * 🚨 統一システム統合: EventBusリスナー - キャンバスリサイズ
     */
    handleCanvasResize(data) {
        console.log(`📐 キャンバスリサイズ検出: ${data.width}x${data.height}`);
        this.resize(data.width, data.height, data.centerContent);
    }
    
    /**
     * 描画エンジン初期化
     */
    initializeDrawingEngine() {
        console.log('🖊️ 描画エンジン初期化中...');
        
        // 描画エンジンは ToolSystem 内で管理
        if (this.toolSystem) {
            this.toolSystem.initializeDrawingEngine();
        }
        
        console.log('✅ 描画エンジン初期化完了');
    }
    
    /**
     * 🚨 統一システム統合: パフォーマンス監視開始（ConfigManager版）
     */
    startPerformanceMonitoring() {
        console.log('📊 パフォーマンス監視開始...');
        
        try {
            // 🚨 統一システム統合: ConfigManager経由でのパフォーマンス設定取得
            const performanceConfig = window.ConfigManager.getPerformanceConfig();
            this.performanceMonitor = new PerformanceMonitor(performanceConfig);
            this.performanceMonitor.start();
            
            // 🚨 統一システム統合: パフォーマンス監視状態記録
            this.performanceMonitorInitialized = true;
            this.performanceTargetFPS = performanceConfig.targetFPS;
            
            console.log('✅ パフォーマンス監視開始完了');
        } catch (error) {
            console.warn('⚠️ パフォーマンス監視開始失敗:', error);
            
            // 🚨 統一システム統合: ErrorManager警告表示
            window.ErrorManager.showError('warning', 
                `パフォーマンス監視の開始に失敗しました: ${error.message}`, {
                showDebug: false
            });
        }
    }
    
    /**
     * 🔧 統一システム統合: 初期化完了確認（StateManager版）
     */
    verifyInitialization() {
        console.log('🔍 初期化完了確認中（統一システム統合版）...');
        
        const verificationResults = {
            pixiApp: !!this.app,
            canvasElement: !!document.getElementById('drawing-canvas'),
            canvasInDOM: document.getElementById('drawing-canvas')?.contains(this.app?.view),
            drawingContainer: !!this.drawingContainer,
            toolSystem: !!this.toolSystem,
            uiController: !!this.uiController,
            performanceMonitor: !!this.performanceMonitor,
            stageInteractive: this.app?.stage?.interactive,
            unifiedSystems: this.verifyUnifiedSystems()
        };
        
        const totalChecks = Object.keys(verificationResults).length;
        const passedChecks = Object.values(verificationResults).filter(Boolean).length;
        
        console.log('🔍 初期化検証結果:', verificationResults);
        console.log(`✅ 検証完了: ${passedChecks}/${totalChecks} (${(passedChecks/totalChecks*100).toFixed(1)}%)`);
        
        // 🚨 統一システム統合: 検証結果記録
        this.initializationVerification = {
            results: verificationResults,
            passedChecks,
            totalChecks,
            successRate: (passedChecks/totalChecks*100).toFixed(1)
        };
        
        if (passedChecks < totalChecks) {
            const failedChecks = Object.entries(verificationResults)
                .filter(([key, value]) => !value)
                .map(([key, value]) => key);
            console.warn('⚠️ 初期化未完了項目:', failedChecks);
            
            // 🚨 統一システム統合: ErrorManager警告表示
            window.ErrorManager.showError('warning', 
                `初期化未完了項目があります: ${failedChecks.join(', ')}`, {
                showDebug: true
            });
        }
        
        // 🎯 キャンバス表示の最終確認
        const canvasElement = document.getElementById('drawing-canvas');
        const pixiCanvas = this.app?.view;
        
        if (canvasElement && pixiCanvas && canvasElement.contains(pixiCanvas)) {
            console.log('🎉 キャンバス表示修復成功！');
            console.log(`📐 キャンバス確認: ${pixiCanvas.width}x${pixiCanvas.height}, 表示: ${pixiCanvas.style.display}`);
        } else {
            throw new Error('キャンバス表示修復に失敗 - DOM接続が不完全');
        }
    }
    
    /**
     * 🚨 統一システム統合: 統一システム検証
     */
    verifyUnifiedSystems() {
        const systems = ['ConfigManager', 'ErrorManager', 'StateManager', 'EventBus'];
        return systems.every(system => !!window[system]);
    }
    
    /**
     * 🚨 統一システム統合: 初期化統計取得
     */
    getInitializationStats() {
        return {
            pixiApp: !!this.app,
            drawingContainer: !!this.drawingContainer,
            toolSystem: !!this.toolSystem,
            uiController: !!this.uiController,
            performanceMonitor: !!this.performanceMonitor,
            extensionsAvailable: this.extensionsAvailable,
            fallbackMode: this.fallbackMode,
            unifiedSystemsActive: this.verifyUnifiedSystems()
        };
    }
    
    /**
     * 🚨 統一システム統合: フォールバックモード初期化（統一システム版）
     */
    async initializeFallbackMode(error) {
        console.log('🛡️ フォールバックモード初期化中（統一システム版）...');
        this.fallbackMode = true;
        
        // 🚨 統一システム統合: フォールバック状態記録
        this.fallbackModeActive = true;
        this.fallbackReason = error.message;
        
        try {
            // 最低限のPixiJSアプリケーション初期化
            if (!this.app) {
                // 🔧 統一システム統合: ConfigManager経由での最小設定取得
                const fallbackConfig = {
                    width: window.ConfigManager.get('canvas.width') || 400,
                    height: window.ConfigManager.get('canvas.height') || 400,
                    backgroundColor: window.ConfigManager.get('canvas.backgroundColor') || 0xf0e0d6,
                    antialias: window.ConfigManager.get('pixi.antialias') || true,
                    resolution: window.ConfigManager.get('pixi.resolution') || 1,
                    autoDensity: window.ConfigManager.get('pixi.autoDensity') || false
                };
                
                this.app = new PIXI.Application(fallbackConfig);
                
                const canvasElement = document.getElementById('drawing-canvas');
                if (canvasElement) {
                    // TODO: PixiJS v8 - this.app.view → this.app.canvas
                    canvasElement.appendChild(this.app.view);
                    console.log('✅ フォールバックPixiJSアプリケーション作成完了');
                }
            }
            
            if (!this.drawingContainer) {
                this.initializeContainers();
            }
            
            // 簡易ツールシステム
            this.toolSystem = new SimpleFallbackToolSystem(this);
            
            console.log('✅ フォールバックモード初期化完了');
            
            // 🚨 統一システム統合: ErrorManager回復メッセージ表示
            window.ErrorManager.showError('recovery', 
                '基本描画機能は利用可能です。一部の高度な機能が制限されています。', {
                showDebug: false,
                additionalInfo: 'フォールバックモードで動作中'
            });
            
            // 🚨 統一システム統合: EventBus経由でのフォールバック通知
            window.EventBus.safeEmit('appCore.fallbackMode', {
                reason: error.message,
                fallbackSystems: ['SimpleFallbackToolSystem']
            });
            
        } catch (fallbackError) {
            console.error('💀 フォールバックモード初期化も失敗:', fallbackError);
            
            // 🚨 統一システム統合: ErrorManager致命的エラー表示
            window.ErrorManager.showError('critical', error.message, {
                additionalInfo: fallbackError.message,
                showDebug: true,
                showReload: true
            });
        }
    }
    
    /**
     * 🚨 統一システム統合: イベントハンドラ: ポインターダウン（EventBus版）
     */
    handlePointerDown(event) {
        if (!this.toolSystem) return;
        
        const point = this.getLocalPointerPosition(event);
        this.toolSystem.startDrawing(point.x, point.y);
        
        // 🚨 統一システム統合: EventBus経由でのイベント発行（安全版）
        if (this.initializationComplete) {
            window.EventBus.safeEmit('drawing.started', {
                x: point.x,
                y: point.y,
                tool: this.toolSystem.currentTool,
                timestamp: Date.now()
            });
        }
        
        console.log(`🖊️ 描画開始: (${point.x.toFixed(1)}, ${point.y.toFixed(1)})`);
    }
    
    /**
     * 🚨 統一システム統合: イベントハンドラ: ポインター移動（EventBus版）
     */
    handlePointerMove(event) {
        const point = this.getLocalPointerPosition(event);
        
        // 座標表示更新
        if (document.getElementById('coordinates')) {
            document.getElementById('coordinates').textContent = 
                `x: ${Math.round(point.x)}, y: ${Math.round(point.y)}`;
        }
        
        if (!this.toolSystem) return;
        this.toolSystem.continueDrawing(point.x, point.y);
        
        // 🚨 統一システム統合: EventBus経由でのイベント発行（描画中のみ）
        if (this.initializationComplete && this.toolSystem.isDrawing) {
            window.EventBus.safeEmit('drawing.continued', {
                x: point.x,
                y: point.y,
                timestamp: Date.now()
            });
        }
    }
    
    /**
     * 🚨 統一システム統合: イベントハンドラ: ポインターアップ（EventBus版）
     */
    handlePointerUp(event) {
        if (!this.toolSystem) return;
        
        this.toolSystem.stopDrawing();
        
        // 筆圧モニターリセット
        if (document.getElementById('pressure-monitor')) {
            document.getElementById('pressure-monitor').textContent = '0.0%';
        }
        
        // 🚨 統一システム統合: EventBus経由でのイベント発行（安全版）
        if (this.initializationComplete) {
            window.EventBus.safeEmit('drawing.ended', {
                pathCount: this.paths.length,
                timestamp: Date.now()
            });
        }
        
        console.log('🖊️ 描画終了');
    }
    
    /**
     * イベントハンドラ: リサイズ
     */
    handleResize() {
        if (!this.app) return;
        
        // リサイズ処理（必要に応じて実装）
        console.log('🔄 ウィンドウリサイズ検出');
        
        // 🚨 統一システム統合: EventBus経由でのリサイズ通知
        if (this.initializationComplete) {
            window.EventBus.safeEmit('window.resized', {
                timestamp: Date.now()
            });
        }
    }
    
    /**
     * ローカルポインター位置取得（修正版）
     */
    getLocalPointerPosition(event) {
        if (!this.app?.view) {
            return { x: 0, y: 0 };
        }
        
        const rect = this.app.view.getBoundingClientRect();
        const originalEvent = event.data?.originalEvent || event.originalEvent || event;
        
        const clientX = originalEvent.clientX || originalEvent.pageX || 0;
        const clientY = originalEvent.clientY || originalEvent.pageY || 0;
        
        const x = (clientX - rect.left) * (this.canvasWidth / rect.width);
        const y = (clientY - rect.top) * (this.canvasHeight / rect.height);
        
        return { 
            x: Math.max(0, Math.min(this.canvasWidth, x)), 
            y: Math.max(0, Math.min(this.canvasHeight, y)) 
        };
    }
    
    /**
     * 🚨 統一システム統合: キャンバスリサイズ（ConfigManager・EventBus版）
     */
    resize(newWidth, newHeight, centerContent = false) {
        if (!this.app) return;
        
        const oldWidth = this.canvasWidth;
        const oldHeight = this.canvasHeight;
        
        // 🚨 統一システム統合: ConfigManager経由での設定値妥当性確認
        const canvasConfig = window.ConfigManager.getCanvasConfig();
        const validWidth = Math.max(canvasConfig.minWidth, Math.min(canvasConfig.maxWidth, newWidth));
        const validHeight = Math.max(canvasConfig.minHeight, Math.min(canvasConfig.maxHeight, newHeight));
        
        if (validWidth !== newWidth || validHeight !== newHeight) {
            // 🚨 統一システム統合: ErrorManager警告表示
            window.ErrorManager.showError('warning', 
                `キャンバスサイズが制限範囲外です。${validWidth}x${validHeight}に調整されました。`, {
                showDebug: false
            });
        }
        
        this.canvasWidth = validWidth;
        this.canvasHeight = validHeight;
        
        // アプリケーションリサイズ
        this.app.renderer.resize(validWidth, validHeight);
        this.app.stage.hitArea = new PIXI.Rectangle(0, 0, validWidth, validHeight);
        
        // コンテンツ中央寄せ
        if (centerContent && this.drawingContainer && this.paths.length > 0) {
            const offsetX = (validWidth - oldWidth) / 2;
            const offsetY = (validHeight - oldHeight) / 2;
            
            this.drawingContainer.x += offsetX;
            this.drawingContainer.y += offsetY;
        }
        
        // ステータス更新
        if (document.getElementById('canvas-info')) {
            document.getElementById('canvas-info').textContent = `${validWidth}×${validHeight}px`;
        }
        
        // 🚨 統一システム統合: 新サイズ記録
        this.canvasSize = {
            width: validWidth,
            height: validHeight,
            previousWidth: oldWidth,
            previousHeight: oldHeight
        };
        
        // 🚨 統一システム統合: EventBus経由でのイベント発行（安全版）
        if (this.initializationComplete) {
            window.EventBus.safeEmit('canvas.resized', {
                width: validWidth,
                height: validHeight,
                previousWidth: oldWidth,
                previousHeight: oldHeight,
                centerContent,
                timestamp: Date.now()
            });
        }
        
        console.log(`📐 キャンバスリサイズ: ${validWidth}x${validHeight}`);
    }
    
    /**
     * 🚨 統一システム統合: 初期化サマリー表示（StateManager版）
     */
    displayInitializationSummary() {
        const summary = this.getInitializationStats();
        
        console.log('📋 初期化サマリー（統一システム統合版）:', summary);
        
        const initComponents = Object.values(summary).filter(Boolean).length;
        const totalComponents = Object.keys(summary).length;
        
        console.log(`✅ 初期化完了率: ${initComponents}/${totalComponents} (${(initComponents/totalComponents*100).toFixed(1)}%)`);
        
        // 🚨 統一システム統合: サマリー記録
        this.initializationSummary = {
            summary,
            completionRate: (initComponents/totalComponents*100).toFixed(1),
            timestamp: Date.now()
        };
        
        // 🎯 キャンバス表示修復成功メッセージ
        if (summary.pixiApp && document.getElementById('drawing-canvas')?.contains(this.app?.view)) {
            console.log('🎉 キャンバス表示修復完全成功！（統一システム統合版）');
            console.log('🖊️ ペンツールでキャンバス上をドラッグして描画テスト可能');
            
            // 🚨 統一システム統合: EventBus経由での成功通知
            window.EventBus.safeEmit('canvas.displaySuccess', {
                width: this.canvasWidth,
                height: this.canvasHeight,
                unifiedSystems: this.verifyUnifiedSystems()
            });
        }
    }
}

setupSliderButtons() {
        // 🚨 統一システム統合: ConfigManager経由でのスライダー精度設定取得
        const precision = this.uiConfig.slider.precision;
        
        // スライダー調整ボタンの設定
        const adjustValue = (sliderId, delta) => {
            const slider = this.sliders.get(sliderId);
            if (slider) {
                const newValue = slider.value + delta;
                const clampedValue = Math.max(slider.min, Math.min(slider.max, newValue));
                slider.value = clampedValue;
                
                const percentage = ((clampedValue - slider.min) / (slider.max - slider.min)) * 100;
                slider.track.style.width = percentage + '%';
                slider.handle.style.left = percentage + '%';
                slider.valueDisplay.textContent = slider.callback(clampedValue);
            }
        };
        
        // ペンサイズ調整ボタン
        const sizeButtons = [
            { id: 'pen-size-decrease-small', delta: -0.1 },
            { id: 'pen-size-decrease', delta: -1 },
            { id: 'pen-size-decrease-large', delta: -10 },
            { id: 'pen-size-increase-small', delta: 0.1 },
            { id: 'pen-size-increase', delta: 1 },
            { id: 'pen-size-increase-large', delta: 10 }
        ];
        
        sizeButtons.forEach(config => {
            const button = document.getElementById(config.id);
            if (button) {
                button.addEventListener('click', () => {
                    adjustValue('pen-size-slider', config.delta);
                    this.updateSizePresets();
                });
            }
        });
        
        // 不透明度調整ボタン
        const opacityButtons = [
            { id: 'pen-opacity-decrease-small', delta: -0.1 },
            { id: 'pen-opacity-decrease', delta: -1 },
            { id: 'pen-opacity-decrease-large', delta: -10 },
            { id: 'pen-opacity-increase-small', delta: 0.1 },
            { id: 'pen-opacity-increase', delta: 1 },
            { id: 'pen-opacity-increase-large', delta: 10 }
        ];
        
        opacityButtons.forEach(config => {
            const button = document.getElementById(config.id);
            if (button) {
                button.addEventListener('click', () => {
                    adjustValue('pen-opacity-slider', config.delta);
                    this.updateSizePresets();
                });
            }
        });
    }
    
    setupPresets() {
        document.querySelectorAll('.size-preset-item').forEach(preset => {
            preset.addEventListener('click', () => {
                const size = parseFloat(preset.getAttribute('data-size'));
                if (!isNaN(size) && this.toolSystem) {
                    this.toolSystem.setBrushSize(size);
                    this.updateSliderValue('pen-size-slider', size);
                    this.updateSizePresets();
                }
            });
        });
    }
    
    setupResize() {
        document.querySelectorAll('.resize-button[data-size]').forEach(btn => {
            btn.addEventListener('click', () => {
                const sizeData = btn.getAttribute('data-size');
                if (sizeData) {
                    const [width, height] = sizeData.split(',').map(Number);
                    const widthInput = document.getElementById('canvas-width');
                    const heightInput = document.getElementById('canvas-height');
                    if (widthInput && heightInput && !isNaN(width) && !isNaN(height)) {
                        widthInput.value = width;
                        heightInput.value = height;
                    }
                }
            });
        });
    }
    
    setupCheckboxes() {
        document.querySelectorAll('.checkbox').forEach(checkbox => {
            checkbox.addEventListener('click', () => {
                checkbox.classList.toggle('checked');
            });
        });
    }
    
    updateSliderValue(sliderId, value) {
        const slider = this.sliders.get(sliderId);
        if (slider) {
            slider.value = value;
            const percentage = ((value - slider.min) / (slider.max - slider.min)) * 100;
            slider.track.style.width = percentage + '%';
            slider.handle.style.left = percentage + '%';
            slider.valueDisplay.textContent = slider.callback(value);
        }
    }
    
    updateSizePresets() {
        if (!this.toolSystem) return;
        
        const currentSize = this.toolSystem.brushSize;
        const currentOpacity = Math.round(this.toolSystem.opacity * 100);
        
        document.querySelectorAll('.size-preset-item').forEach(preset => {
            const presetSize = parseFloat(preset.getAttribute('data-size'));
            if (isNaN(presetSize)) return;
            
            const circle = preset.querySelector('.size-preview-circle');
            const label = preset.querySelector('.size-preview-label');
            const percent = preset.querySelector('.size-preview-percent');
            
            if (!circle || !label || !percent) return;
            
            // アクティブ状態の更新
            const isActive = Math.abs(presetSize - currentSize) < 0.1;
            preset.classList.toggle('active', isActive);
            
            // 円のサイズ更新
            let circleSize;
            if (isActive) {
                circleSize = Math.max(0.5, Math.min(20, (currentSize / 100) * 19.5 + 0.5));
            } else {
                circleSize = Math.max(0.5, Math.min(20, (presetSize / 100) * 19.5 + 0.5));
            }
            
            circle.style.width = circleSize + 'px';
            circle.style.height = circleSize + 'px';
            circle.style.opacity = this.toolSystem.opacity;
            
            // ラベル更新
            if (isActive) {
                label.textContent = currentSize.toFixed(1);
            } else {
                label.textContent = presetSize.toString();
            }
            
            percent.textContent = currentOpacity + '%';
        });
    }
    
    closeAllPopups() {
        document.querySelectorAll('.popup-panel').forEach(popup => {
            popup.classList.remove('show');
        });
        this.activePopup = null;
        
        // 🚨 統一システム統合: EventBus経由でのポップアップ全閉じ通知
        window.EventBus.safeEmit('ui.allPopupsClosed', {
            timestamp: Date.now()
        });
        
        console.log('🔒 全ポップアップ閉じる（統一システム版）');
    }
}

/**
 * 🚨 統一システム統合: 最小限UIコントローラー（統一システム版）
 */
class MinimalUIController {
    constructor(toolSystem) {
        this.toolSystem = toolSystem;
        this.activePopup = null;
        console.log('🛡️ MinimalUIController 初期化完了（統一システム統合版）');
    }
    
    initialize() {
        console.log('🛡️ 最小限UI制御初期化中（統一システム版）...');
        
        try {
            // 最低限のツールボタン設定のみ
            document.querySelectorAll('.tool-button').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    if (btn.id === 'pen-tool' && this.toolSystem) {
                        this.toolSystem.setTool('pen');
                        this.updateToolStatus('pen');
                    } else if (btn.id === 'eraser-tool' && this.toolSystem) {
                        this.toolSystem.setTool('eraser');
                        this.updateToolStatus('eraser');
                    }
                });
            });
            
            console.log('✅ 最小限UI制御初期化完了（統一システム版）');
            
        } catch (error) {
            console.error('💀 最小限UI制御初期化エラー:', error);
            
            // 🚨 統一システム統合: ErrorManager警告表示
            window.ErrorManager.showError('warning', 
                `最小限UI制御初期化に失敗しました: ${error.message}`, {
                showDebug: false
            });
        }
    }
    
    updateToolStatus(tool) {
        // ツールボタンのアクティブ状態更新
        document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
        const toolButton = document.getElementById(tool + '-tool');
        if (toolButton) {
            toolButton.classList.add('active');
        }
        
        // ツール名表示更新
        const toolNames = { pen: 'ベクターペン', eraser: '消しゴム' };
        const currentToolElement = document.getElementById('current-tool');
        if (currentToolElement) {
            currentToolElement.textContent = toolNames[tool] || tool;
        }
        
        // 🚨 統一システム統合: EventBus経由でのツール状態更新通知
        window.EventBus.safeEmit('ui.toolStatusUpdated', {
            tool,
            timestamp: Date.now()
        });
    }
    
    closeAllPopups() {
        document.querySelectorAll('.popup-panel').forEach(popup => {
            popup.classList.remove('show');
        });
        this.activePopup = null;
        console.log('🔒 全ポップアップ閉じる（最小限・統一システム版）');
    }
}

/**
 * 🚨 統一システム統合: パフォーマンス監視システム（ConfigManager版）
 */
class PerformanceMonitor {
    constructor(performanceConfig = null) {
        // 🚨 統一システム統合: ConfigManager経由での設定取得
        this.config = performanceConfig || window.ConfigManager.getPerformanceConfig();
        
        this.frameCount = 0;
        this.lastTime = performance.now();
        this.isRunning = false;
        this.metrics = {
            currentFPS: 0,
            averageFPS: 0,
            minFPS: Infinity,
            maxFPS: 0,
            frameCount: 0
        };
        this.updateCallbacks = new Set();
    }
    
    start() {
        if (this.isRunning) return;
        
        console.log('📊 パフォーマンス監視開始（統一システム統合版）');
        this.isRunning = true;
        
        const update = () => {
            if (!this.isRunning) return;
            
            this.frameCount++;
            this.metrics.frameCount++;
            const currentTime = performance.now();
            
            // 🚨 統一システム統合: ConfigManager経由での更新間隔取得
            if (currentTime - this.lastTime >= this.config.updateInterval) {
                const fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastTime));
                
                this.metrics.currentFPS = fps;
                this.metrics.averageFPS = Math.round((this.metrics.averageFPS + fps) / 2);
                this.metrics.minFPS = Math.min(this.metrics.minFPS, fps);
                this.metrics.maxFPS = Math.max(this.metrics.maxFPS, fps);
                
                // FPS表示更新
                const fpsElement = document.getElementById('fps');
                if (fpsElement) {
                    fpsElement.textContent = fps;
                }
                
                // 🚨 統一システム統合: ConfigManager経由での目標FPS取得
                if (fps < this.config.targetFPS / 2) {
                    console.warn(`⚠️ 低FPS検出: ${fps}fps (目標: ${this.config.targetFPS}fps)`);
                }
                
                // 🚨 統一システム統合: EventBus経由でのFPS更新通知
                window.EventBus.safeEmit('performance.fpsUpdated', {
                    fps,
                    averageFPS: this.metrics.averageFPS,
                    timestamp: Date.now()
                });
                
                // 更新コールバック実行
                this.updateCallbacks.forEach(callback => {
                    try {
                        callback(this.metrics);
                    } catch (error) {
                        console.error('パフォーマンス監視コールバックエラー:', error);
                    }
                });
                
                this.frameCount = 0;
                this.lastTime = currentTime;
            }
            
            requestAnimationFrame(update);
        };
        
        update();
    }
    
    stop() {
        console.log('📊 パフォーマンス監視停止（統一システム版）');
        this.isRunning = false;
        
        // 🚨 統一システム統合: EventBus経由での監視停止通知
        window.EventBus.safeEmit('performance.monitoringStopped', {
            finalMetrics: this.metrics,
            timestamp: Date.now()
        });
    }
    
    getStats() {
        return {
            isRunning: this.isRunning,
            metrics: { ...this.metrics },
            config: { ...this.config },
            lastTime: this.lastTime,
            frameCount: this.frameCount,
            updateCallbacks: this.updateCallbacks.size
        };
    }
    
    addUpdateCallback(callback) {
        this.updateCallbacks.add(callback);
    }
    
    removeUpdateCallback(callback) {
        this.updateCallbacks.delete(callback);
    }
}

// グローバル登録
if (typeof window !== 'undefined') {
    window.AppCore = AppCore;
    window.DrawingToolSystem = DrawingToolSystem;
    window.SimpleFallbackToolSystem = SimpleFallbackToolSystem;
    window.UIController = UIController;
    window.MinimalUIController = MinimalUIController;
    window.PerformanceMonitor = PerformanceMonitor;
    
    console.log('🎨 AppCore関連クラス グローバル登録完了（統一システム統合版）');
    console.log('🛡️ フォールバック機能・循環参照防止機能追加済み');
    console.log('🚨 統一システム統合完了: ConfigManager・ErrorManager・EventBus統合済み');
    console.log('✅ Task 1-A-2完了: StateManager.set削除・内部状態管理移行完了');
    console.log('🔧 構文エラー修正・クラス構造修正・統一システム統合改善完了');
}/**
 * 🚨 統一システム統合: 描画ツールシステム（ConfigManager・EventBus版）
 */
class DrawingToolSystem {
    constructor(appCore) {
        this.appCore = appCore;
        this.currentTool = 'pen';
        this.isDrawing = false;
        this.currentPath = null;
        this.lastPoint = null;
    }
    
    /**
     * 🚨 統一システム統合: ペンパス作成（ConfigManager版）
     */
    createPenPath(x, y) {
        const path = {
            id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            graphics: new PIXI.Graphics(),
            points: [{ x, y, size: this.brushSize }],
            color: this.brushColor,
            size: this.brushSize,
            opacity: this.opacity,
            tool: 'pen',
            isComplete: false
        };
        
        // TODO: PixiJS v8 - Graphics.beginFill → Graphics.fill
        path.graphics.beginFill(path.color, path.opacity);
        path.graphics.drawCircle(x, y, path.size / 2);
        path.graphics.endFill();
        
        this.appCore.drawingContainer.addChild(path.graphics);
        return path;
    }
    
    /**
     * 🚨 統一システム統合: 消しゴムパス作成（ConfigManager版）
     */
    createEraserPath(x, y) {
        const eraserConfig = window.ConfigManager.getDrawingConfig('eraser');
        
        const path = {
            id: `eraser_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            graphics: new PIXI.Graphics(),
            points: [{ x, y, size: this.brushSize }],
            color: this.appCore.backgroundColor,
            size: this.brushSize,
            opacity: eraserConfig.opacity,
            tool: 'eraser',
            isComplete: false
        };
        
        // TODO: PixiJS v8 - Graphics.beginFill → Graphics.fill
        path.graphics.beginFill(path.color, path.opacity);
        path.graphics.drawCircle(x, y, path.size / 2);
        path.graphics.endFill();
        
        this.appCore.drawingContainer.addChild(path.graphics);
        return path;
    }
    
    /**
     * 線描画（元HTML版準拠の円形ブラシ方式）
     */
    drawLine(path, x1, y1, x2, y2) {
        const distance = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
        const steps = Math.max(1, Math.ceil(distance / 1.5));
        
        // 連続する円形で滑らかな線を描画
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const px = x1 + (x2 - x1) * t;
            const py = y1 + (y2 - y1) * t;
            
            // TODO: PixiJS v8 - Graphics.beginFill → Graphics.fill
            path.graphics.beginFill(path.color, path.opacity);
            path.graphics.drawCircle(px, py, path.size / 2);
            path.graphics.endFill();
        }
        
        path.points.push({ x: x2, y: y2, size: path.size });
    }
}

/**
 * 🚨 統一システム統合: 簡易フォールバックツールシステム（統一システム版）
 */
class SimpleFallbackToolSystem extends DrawingToolSystem {
    constructor(appCore) {
        super(appCore);
        console.log('🛡️ SimpleFallbackToolSystem 初期化完了（統一システム統合版）');
        
        // 🚨 統一システム統合: フォールバックツール状態記録
        this.fallbackMode = true;
    }
    
    initializeDrawingEngine() {
        console.log('🛡️ フォールバック描画エンジン初期化中...');
        console.log('✅ フォールバック描画エンジン初期化完了');
        
        // 🚨 統一システム統合: 状態記録
        this.drawingEngineInitialized = true;
        this.fallbackModeActive = true;
    }
}

/**
 * 🚨 統一システム統合: UI制御システム（統一システム版）
 */
class UIController {
    constructor(toolSystem) {
        this.toolSystem = toolSystem;
        this.activePopup = null;
        this.sliders = new Map();
        
        // 🚨 統一システム統合: ConfigManager経由でのUI設定取得
        this.uiConfig = window.ConfigManager.getUIConfig();
    }
    
    /**
     * 🚨 統一システム統合: 初期化（ErrorManager版）
     */
    initialize() {
        console.log('🎨 UI制御システム初期化中（統一システム統合版）...');
        
        try {
            this.setupToolButtons();
            this.setupPopups();
            this.setupSliders();
            this.setupPresets();
            this.setupResize();
            this.setupCheckboxes();
            this.updateSizePresets();
            
            // 🚨 統一システム統合: UI初期化状態記録
            this.initialized = true;
            this.slidersCount = this.sliders.size;
            
            console.log('✅ UI制御システム初期化完了（統一システム統合版）');
            
        } catch (error) {
            console.error('💀 UI制御システム初期化エラー:', error);
            
            // 🚨 統一システム統合: ErrorManager統一エラー処理
            window.ErrorManager.showError('error', error.message, {
                additionalInfo: 'UIController初期化失敗（統一システム版）',
                showDebug: true
            });
            
            throw error;
        }
    }
    
    /**
     * 🚨 統一システム統合: ポップアップシステム設定（EventBus版）
     */
    setupPopups() {
        console.log('🪟 ポップアップシステム設定中（EventBus統合版）...');
        
        try {
            // data-popup属性を持つ要素にクリックリスナー設定
            document.querySelectorAll('[data-popup]').forEach(trigger => {
                trigger.addEventListener('click', (e) => {
                    const popupId = e.target.getAttribute('data-popup');
                    if (popupId) {
                        this.togglePopup(popupId);
                    }
                });
            });
            
            // ポップアップ外クリックで閉じる機能
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.popup-panel') && !e.target.closest('[data-popup]')) {
                    this.closeAllPopups();
                }
            });
            
            // 🚨 統一システム統合: ConfigManager経由でのキーボードショートカット設定
            const shortcuts = this.uiConfig.keyboard.shortcuts;
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.activePopup) {
                    this.closeAllPopups();
                    
                    // 🚨 統一システム統合: EventBus経由でのショートカット通知
                    window.EventBus.safeEmit('keyboard.shortcutUsed', {
                        key: 'Escape',
                        action: 'closePopups'
                    });
                }
            });
            
            console.log('✅ ポップアップシステム設定完了（EventBus統合版）');
            
        } catch (error) {
            console.error('💀 ポップアップ設定エラー:', error);
            
            // 🚨 統一システム統合: ErrorManager警告表示
            window.ErrorManager.showError('warning', 
                `ポップアップシステム設定に失敗しました: ${error.message}`, {
                showDebug: false
            });
            
            throw error;
        }
    }
    
    setupToolButtons() {
        document.querySelectorAll('.tool-button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (btn.classList.contains('disabled')) return;
                this.handleToolClick(e.currentTarget);
            });
        });
    }
    
    /**
     * 🚨 統一システム統合: ツールクリック処理（EventBus版）
     */
    handleToolClick(button) {
        const toolId = button.id;
        const popupId = button.getAttribute('data-popup');
        
        if (toolId === 'pen-tool') {
            this.setTool('pen');
        } else if (toolId === 'eraser-tool') {
            this.setTool('eraser');
        }
        
        if (popupId) {
            this.togglePopup(popupId);
        }
        
        // 🚨 統一システム統合: EventBus経由でのツールクリック通知
        window.EventBus.safeEmit('ui.toolButtonClicked', {
            toolId,
            popupId,
            timestamp: Date.now()
        });
    }
    
    setTool(tool) {
        if (this.toolSystem) {
            this.toolSystem.setTool(tool);
        }
        
        document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
        const toolButton = document.getElementById(tool + '-tool');
        if (toolButton) {
            toolButton.classList.add('active');
        }
        
        const toolNames = { pen: 'ベクターペン', eraser: '消しゴム' };
        if (document.getElementById('current-tool')) {
            document.getElementById('current-tool').textContent = toolNames[tool] || tool;
        }
    }
    
    /**
     * 🚨 統一システム統合: ポップアップ切り替え（EventBus版）
     */
    togglePopup(popupId) {
        const popup = document.getElementById(popupId);
        if (!popup) {
            console.warn(`⚠️ ポップアップ要素が見つかりません: ${popupId}`);
            
            // 🚨 統一システム統合: ErrorManager警告表示
            window.ErrorManager.showError('warning', 
                `ポップアップ要素が見つかりません: ${popupId}`, {
                showDebug: false
            });
            return;
        }
        
        // 他のポップアップを閉じる
        if (this.activePopup && this.activePopup !== popup) {
            this.activePopup.classList.remove('show');
        }
        
        // 現在のポップアップの表示状態を切り替え
        const isVisible = popup.classList.contains('show');
        popup.classList.toggle('show', !isVisible);
        
        this.activePopup = isVisible ? null : popup;
        
        // 🚨 統一システム統合: EventBus経由でのポップアップ状態変更通知
        window.EventBus.safeEmit('ui.popupToggled', {
            popupId,
            visible: !isVisible,
            timestamp: Date.now()
        });
        
        console.log(`🪟 ポップアップ${isVisible ? '非表示' : '表示'}: ${popupId}`);
    }

    setupSliders() {
        this.createSlider('pen-size-slider', 0.1, 100, 16.0, (value) => {
            if (this.toolSystem) {
                this.toolSystem.setBrushSize(value);
            }
            this.updateSizePresets();
            return value.toFixed(1) + 'px';
        });
        
        this.createSlider('pen-opacity-slider', 0, 100, 85.0, (value) => {
            if (this.toolSystem) {
                this.toolSystem.setOpacity(value / 100);
            }
            this.updateSizePresets();
            return value.toFixed(1) + '%';
        });
        
        this.createSlider('pen-pressure-slider', 0, 100, 50.0, (value) => {
            if (this.toolSystem) {
                this.toolSystem.setPressure(value / 100);
            }
            return value.toFixed(1) + '%';
        });
        
        this.createSlider('pen-smoothing-slider', 0, 100, 30.0, (value) => {
            if (this.toolSystem) {
                this.toolSystem.setSmoothing(value / 100);
            }
            return value.toFixed(1) + '%';
        });
        
        this.setupSliderButtons();
    }
    
    createSlider(sliderId, min, max, initial, callback) {
        const container = document.getElementById(sliderId);
        if (!container) {
            console.warn(`⚠️ スライダー要素が見つかりません: ${sliderId}`);
            return;
        }
        
        const track = container.querySelector('.slider-track');
        const handle = container.querySelector('.slider-handle');
        const valueDisplay = container.parentNode.querySelector('.slider-value');
        
        if (!track || !handle || !valueDisplay) {
            console.warn(`⚠️ スライダー部品が不完全: ${sliderId}`);
            return;
        }
        
        // 🚨 統一システム統合: ConfigManager経由でのスライダー設定取得
        const sliderConfig = this.uiConfig.slider;
        
        const sliderData = {
            value: initial,
            min, max, callback,
            track, handle, valueDisplay,
            isDragging: false,
            updateThrottle: sliderConfig.updateThrottle
        };
        
        this.sliders.set(sliderId, sliderData);
        
        const updateSlider = (value) => {
            sliderData.value = Math.max(min, Math.min(max, value));
            const percentage = ((sliderData.value - min) / (max - min)) * 100;
            
            track.style.width = percentage + '%';
            handle.style.left = percentage + '%';
            valueDisplay.textContent = callback(sliderData.value);
        };
        
        const getValueFromPosition = (clientX) => {
            const rect = container.getBoundingClientRect();
            const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            return min + (percentage * (max - min));
        };
        
        // マウスイベント設定
        container.addEventListener('mousedown', (e) => {
            sliderData.isDragging = true;
            updateSlider(getValueFromPosition(e.clientX));
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (sliderData.isDragging) {
                updateSlider(getValueFromPosition(e.clientX));
            }
        });
        
        document.addEventListener('mouseup', () => {
            sliderData.isDragging = false;
        });
        
        // タッチイベント設定（モバイル対応）
        container.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                sliderData.isDragging = true;
                updateSlider(getValueFromPosition(e.touches[0].clientX));
                e.preventDefault();
            }
        });
        
        document.addEventListener('touchmove', (e) => {
            if (sliderData.isDragging && e.touches.length === 1) {
                updateSlider(getValueFromPosition(e.touches[0].clientX));
                e.preventDefault();
            }
        });
        
        document.addEventListener('touchend', () => {
            sliderData.isDragging = false;
        });
        
        // 初期値設定
        updateSlider(initial);
        
        console.log(`✅ スライダー設定完了: ${sliderId}`);
    }.lastPoint = null;
        
        // 🚨 統一システム統合: ConfigManager経由でのツール設定取得
        const penConfig = window.ConfigManager.getDrawingConfig('pen');
        this.brushSize = penConfig.defaultSize;
        this.brushColor = penConfig.defaultColor;
        this.opacity = penConfig.defaultOpacity;
        this.pressure = penConfig.defaultPressure;
        this.smoothing = penConfig.defaultSmoothing;
        this.minDistance = penConfig.minDistance;
        
        // 拡張機能フラグ
        this.extensionsAvailable = appCore.extensionsAvailable;
        
        console.log('🔧 DrawingToolSystem 初期化完了（統一システム統合版）');
        
        // 🚨 統一システム統合: ツールシステム状態記録
        this.initialized = true;
    }
    
    /**
     * 描画エンジン初期化
     */
    initializeDrawingEngine() {
        console.log('🖊️ 描画エンジン初期化中...');
        
        // 基本描画機能は常に利用可能
        console.log('✅ 基本描画エンジン初期化完了');
        
        // 🚨 統一システム統合: 描画エンジン状態記録
        this.drawingEngineInitialized = true;
    }
    
    /**
     * 🚨 統一システム統合: ツール設定（EventBus・ConfigManager版）
     */
    setTool(tool) {
        const previousTool = this.currentTool;
        this.currentTool = tool;
        
        // 🚨 統一システム統合: ツール状態更新
        this.previousTool = previousTool;
        
        // 🚨 統一システム統合: EventBus経由でのイベント発行（安全版）
        if (this.appCore.initializationComplete) {
            window.EventBus.safeEmit('tool.changed', { 
                tool,
                previousTool,
                timestamp: Date.now()
            });
        }
        
        console.log(`🔧 ツール変更: ${previousTool} → ${tool}`);
    }
    
    /**
     * 🚨 統一システム統合: ブラシサイズ設定（ConfigManager・EventBus版）
     */
    setBrushSize(size) {
        const penConfig = window.ConfigManager.getDrawingConfig('pen');
        const oldSize = this.brushSize;
        
        // 🚨 統一システム統合: ConfigManager経由での妥当性確認
        this.brushSize = Math.max(penConfig.minSize, Math.min(penConfig.maxSize, Math.round(size * 10) / 10));
        
        // 🚨 統一システム統合: ブラシサイズ更新
        this.previousBrushSize = oldSize;
        
        // 🚨 統一システム統合: EventBus経由でのイベント発行（初期化完了後のみ）
        if (this.appCore.initializationComplete) {
            window.EventBus.safeEmit('brush.sizeChanged', {
                size: this.brushSize,
                previousSize: oldSize,
                timestamp: Date.now()
            });
        }
    }
    
    /**
     * 🚨 統一システム統合: 不透明度設定（EventBus版）
     */
    setOpacity(opacity) {
        const oldOpacity = this.opacity;
        this.opacity = Math.max(0, Math.min(1, Math.round(opacity * 1000) / 1000));
        
        // 🚨 統一システム統合: 不透明度更新
        this.previousOpacity = oldOpacity;
        
        // 🚨 統一システム統合: EventBus経由でのイベント発行（安全版）
        if (this.appCore.initializationComplete) {
            window.EventBus.safeEmit('brush.opacityChanged', {
                opacity: this.opacity,
                previousOpacity: oldOpacity,
                timestamp: Date.now()
            });
        }
    }
    
    /**
     * 🚨 統一システム統合: 筆圧設定（EventBus版）
     */
    setPressure(pressure) {
        const oldPressure = this.pressure;
        this.pressure = Math.max(0, Math.min(1, Math.round(pressure * 1000) / 1000));
        
        // 🚨 統一システム統合: 筆圧更新
        this.previousPressure = oldPressure;
        
        // 🚨 統一システム統合: EventBus経由でのイベント発行（安全版）
        if (this.appCore.initializationComplete) {
            window.EventBus.safeEmit('brush.pressureChanged', {
                pressure: this.pressure,
                previousPressure: oldPressure,
                timestamp: Date.now()
            });
        }
    }
    
    /**
     * スムージング設定
     */
    setSmoothing(smoothing) {
        this.smoothing = Math.max(0, Math.min(1, Math.round(smoothing * 1000) / 1000));
        
        // 🚨 統一システム統合: スムージング更新
        this.previousSmoothing = this.smoothing;
    }
    
    /**
     * 🚨 統一システム統合: 描画開始（ConfigManager版）
     */
    startDrawing(x, y) {
        this.isDrawing = true;
        this.lastPoint = { x, y };
        
        // 現在のツールに応じた描画開始
        if (this.currentTool === 'pen') {
            this.currentPath = this.createPenPath(x, y);
        } else if (this.currentTool === 'eraser') {
            this.currentPath = this.createEraserPath(x, y);
        }
        
        // 筆圧モニター更新
        if (document.getElementById('pressure-monitor')) {
            const pressure = this.pressure * 100 + Math.random() * 10;
            document.getElementById('pressure-monitor').textContent = `${pressure.toFixed(1)}%`;
        }
        
        // 🚨 統一システム統合: 描画状態更新
        this.drawingStarted = true;
        this.currentPathId = this.currentPath?.id;
        
        console.log(`🖊️ 描画開始 (${this.currentTool}): (${x.toFixed(1)}, ${y.toFixed(1)}), サイズ: ${this.brushSize}`);
    }
    
    /**
     * 🚨 統一システム統合: 描画継続（ConfigManager版）
     */
    continueDrawing(x, y) {
        if (!this.isDrawing || !this.currentPath || !this.lastPoint) return;
        
        const distance = Math.sqrt((x - this.lastPoint.x) ** 2 + (y - this.lastPoint.y) ** 2);
        
        // 🚨 統一システム統合: ConfigManager経由での最小距離フィルタ
        if (distance < this.minDistance) return;
        
        // 線の描画（元HTML版と同じ実装）
        this.drawLine(this.currentPath, this.lastPoint.x, this.lastPoint.y, x, y);
        this.lastPoint = { x, y };
        
        // 筆圧モニター更新
        if (document.getElementById('pressure-monitor')) {
            const pressure = this.pressure * 100 + Math.random() * 15;
            document.getElementById('pressure-monitor').textContent = `${pressure.toFixed(1)}%`;
        }
    }

    /**
     * 🚨 統一システム統合: 描画終了（EventBus版）
     */
    stopDrawing() {
        if (this.currentPath) {
            this.currentPath.isComplete = true;
            this.appCore.paths.push(this.currentPath);
            
            // 🚨 統一システム統合: EventBus経由でのパス作成通知（安全版）
            if (this.appCore.initializationComplete) {
                window.EventBus.safeEmit('path.created', {
                    pathId: this.currentPath.id,
                    pointCount: this.currentPath.points.length,
                    tool: this.currentPath.tool,
                    timestamp: Date.now()
                });
            }
            
            console.log(`🖊️ 描画完了: ${this.currentPath.points.length}ポイント`);
        }
        
        // 🚨 統一システム統合: 描画状態更新
        this.drawingStarted = false;
        this.currentPathId = null;
        this.totalPaths = this.appCore.paths.length;
        
        this.isDrawing = false;
        this.currentPath = null;
        this/**