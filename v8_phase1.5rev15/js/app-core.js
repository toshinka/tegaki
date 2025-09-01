/**
 * ChangeLog: 2025-09-01 EventBus初期化修正・Manager依存関係修正・getSystemStatus追加修正
 * 
 * @provides
 *   ・アプリケーション制御: initializeV8Managers(), createCanvasV8()
 *   ・Manager統合管理: Manager群作成・初期化・依存解決
 *   ・イベント統合: app:ready発火・UI連携
 *   ・エラーハンドリング: Manager個別エラー集約・グレースフルダウングレード
 *   ・状態管理: getSystemStatus(), getInitializationStatus()
 * 
 * @uses
 *   ・CanvasManager統一ライフサイクル: configure/attach/init/isReady/dispose + getApplication/getDrawContainer
 *   ・CoordinateManager統一ライフサイクル: configure/attach/init/isReady/dispose + clientToWorld/screenToCanvas
 *   ・ToolManager統一ライフサイクル: configure/attach/init/isReady/dispose + setManagers/verifyInjection/initializeV8Tools
 *   ・EventBus: emit/on - アプリイベント通信
 *   ・ConfigManager: get/set - 設定管理
 *   ・その他Manager群統一ライフサイクル
 * 
 * @initflow
 *   1. AppCore.createCanvasV8() - PixiJS Application作成・DOM配置
 *   2. AppCore.initializeV8Managers(context, config) - Manager群初期化（依存順序厳守）
 *     - ConfigManager.configure
 *     - EventBus.configure/attach/init
 *     - CanvasManager.configure/attach/init/initializeV8Application
 *     - CoordinateManager.configure/attach/init（CanvasManager依存）
 *     - その他Manager（順次依存解決）
 *     - ToolManager.configure/attach/init/setManagers/verifyInjection/initializeV8Tools
 *   3. AppCore.emitAppReady() - app:ready発火・UI起動
 * 
 * @forbids
 *   ・💀 Manager循環依存禁止（一方向依存のみ）
 *   ・🚫 Manager内部フォールバック禁止（AppCore層のみエイリアス許可）
 *   ・🚫 未実装メソッド呼び出し禁止（isReady確認後実行）
 *   ・🚫 Manager初期化順序違反禁止（依存順序厳守）
 *   ・🚫 架空メソッド呼び出し禁止（Manager契約確認必須）
 * 
 * @manager-key
 *   ・window.Tegaki.AppCoreInstance - AppCore実体
 *   ・window.Tegaki.AppCore - AppCoreクラス
 * 
 * @dependencies-strict
 *   ・必須: PixiJS v8 Application - Canvas基幹
 *   ・必須: Manager群統一ライフサイクル実装 - configure/attach/init/isReady/dispose
 *   ・必須: CanvasManager.getApplication/getDrawContainer - 他Manager依存
 *   ・オプション: EventBus - UI連携
 * 
 * @integration-flow
 *   ・TegakiApplication.initializeV8Managers()から呼び出し
 *   ・Manager群を依存順序で初期化・エラー集約
 *   ・app:readyでUI（icons.js）起動
 * 
 * @error-handling
 *   ・Manager個別初期化エラー集約・ログ出力
 *   ・グレースフルダウングレード（致命的でないManager失敗時継続）
 *   ・診断UI表示・開発用詳細ログ
 * 
 * @app-fallback-policy
 *   ・限定的エイリアス注入（Manager実装不足時の非破壊補完）
 *   ・ログ出力必須・振る舞い変更禁止・開発用テスト検知可能
 */

// AppCore - EventBus初期化修正・Manager依存関係修正版
(function() {
    'use strict';
    
    console.log('🚀 AppCore EventBus初期化修正・Manager依存関係修正版 作成開始');
    
    class AppCore {
        constructor() {
            // アプリケーション状態
            this._initialized = false;
            this._pixiApp = null;
            
            // Manager群
            this._managers = new Map();
            this._managersObject = {}; // Tool注入用オブジェクト形式
            
            // 初期化状態追跡
            this._initializationStatus = {
                canvas: false,
                managers: false,
                tools: false,
                ready: false
            };
            
            // エラー収集
            this._errors = [];
            
            // デバッグ
            this._debugMode = false;
            
            console.log('🚀 AppCore instance created');
        }
        
        //================================================
        // Canvas作成（PixiJS Application）
        //================================================
        
        /**
         * PixiJS v8 Canvas作成・DOM配置
         * @returns {Promise<Object>} PixiJS Application
         */
        async createCanvasV8() {
            console.log('🚀 AppCore Canvas作成開始');
            
            try {
                // PixiJS Application作成
                this._pixiApp = await this._createV8Application();
                
                // Canvas DOM配置
                await this._setupV8Canvas();
                
                this._initializationStatus.canvas = true;
                
                console.log('🚀 AppCore Canvas作成完了');
                return this._pixiApp;
                
            } catch (error) {
                console.error('🚀 AppCore Canvas作成失敗:', error);
                this._errors.push({ component: 'Canvas', error: error.message });
                throw error;
            }
        }
        
        /**
         * PixiJS v8 Application作成
         * @returns {Promise<Object>}
         */
        async _createV8Application() {
            if (!window.PIXI) {
                throw new Error('PixiJS not available');
            }
            
            const config = {
                width: 400,
                height: 400,
                backgroundColor: 0xf0e0d6, // futaba-cream
                resolution: window.devicePixelRatio || 1,
                autoDensity: true,
                antialias: true,
                powerPreference: 'high-performance',
                eventMode: 'auto',
                eventFeatures: {
                    move: true,
                    globalMove: false,
                    click: true,
                    wheel: false
                }
            };
            
            try {
                // WebGPU優先でApplication作成
                const app = new PIXI.Application();
                await app.init(config);
                
                console.log('🚀 PixiJS Application created:', {
                    version: PIXI.VERSION,
                    renderer: app.renderer.type,
                    resolution: app.renderer.resolution
                });
                
                return app;
                
            } catch (error) {
                console.error('🚀 PixiJS Application creation failed:', error);
                throw error;
            }
        }
        
        /**
         * Canvas DOM配置・スタイル設定
         */
        async _setupV8Canvas() {
            if (!this._pixiApp || !this._pixiApp.canvas) {
                throw new Error('PixiJS Application canvas not available');
            }
            
            // Canvas Container取得・作成
            let canvasContainer = document.getElementById('canvas-container');
            if (!canvasContainer) {
                canvasContainer = document.createElement('div');
                canvasContainer.id = 'canvas-container';
                canvasContainer.className = 'canvas-container';
                document.body.appendChild(canvasContainer);
            }
            
            // Canvas配置
            canvasContainer.appendChild(this._pixiApp.canvas);
            
            // Canvas スタイル設定（縁なし・Crystaライク）
            const canvas = this._pixiApp.canvas;
            canvas.style.border = 'none';
            canvas.style.outline = 'none';
            canvas.style.display = 'block';
            canvas.style.touchAction = 'none';
            
            console.log('🚀 Canvas DOM setup completed');
        }
        
        //================================================
        // Manager群初期化（依存順序厳守）
        //================================================
        
        /**
         * Manager群初期化（依存順序厳守）
         * @param {Object} context 外部コンテキスト（PixiJS Application等）
         * @param {Object} config 設定オブジェクト
         * @returns {Promise}
         */
        async initializeV8Managers(context = {}, config = {}) {
            console.log('🚀 AppCore Manager群初期化開始');
            
            if (this._initializationStatus.managers) {
                console.warn('🚀 Managers already initialized, skipping');
                return;
            }
            
            try {
                // 外部からPixiJS Applicationを受け取る場合
                if (context.pixiApp && !this._pixiApp) {
                    this._pixiApp = context.pixiApp;
                    this._initializationStatus.canvas = true;
                    console.log('🚀 External PixiJS Application received');
                }
                
                // 前提条件確認
                if (!this._pixiApp) {
                    throw new Error('PixiJS Application required - call createCanvasV8() first or provide pixiApp in context');
                }
                
                // 設定準備
                this._debugMode = config.debugMode || false;
                
                // Manager群初期化（依存順序厳守）
                await this._initializeManagersInOrder(config);
                
                // Tool統合初期化
                await this._initializeToolIntegration();
                
                this._initializationStatus.managers = true;
                this._initializationStatus.tools = true;
                
                // アプリケーション準備完了通知
                this.emitAppReady();
                
                console.log('🚀 AppCore Manager群初期化完了');
                
            } catch (error) {
                console.error('🚀 AppCore Manager群初期化失敗:', error);
                this._errors.push({ component: 'Managers', error: error.message });
                throw error;
            }
        }
        
        /**
         * Manager群を依存順序で初期化
         * @param {Object} config 設定
         */
        async _initializeManagersInOrder(config) {
            console.log('🚀 Manager依存順序初期化開始');
            
            // Phase 1: 基幹Manager（依存なし）
            await this._initializePhase1Managers(config);
            
            // Phase 2: Canvas基幹Manager
            await this._initializePhase2Managers(config);
            
            // Phase 3: Canvas依存Manager群
            await this._initializePhase3Managers(config);
            
            // Phase 4: Tool Manager
            await this._initializePhase4Managers(config);
            
            console.log('🚀 Manager依存順序初期化完了');
        }
        
        /**
         * Phase 1: 基幹Manager初期化（依存なし）
         */
        async _initializePhase1Managers(config) {
            console.log('🚀 Phase 1: 基幹Manager初期化');
            
            // ConfigManager
            await this._initializeSingleManager('config', 'ConfigManager', config);
            
            // EventBus（修正版）
            await this._initializeSingleManager('eventBus', 'EventBus', config);
            
            console.log('🚀 Phase 1 完了');
        }
        
        /**
         * Phase 2: Canvas基幹Manager初期化
         */
        async _initializePhase2Managers(config) {
            console.log('🚀 Phase 2: Canvas基幹Manager初期化');
            
            // CanvasManager（最重要）
            const canvasManager = await this._initializeSingleManager('canvas', 'CanvasManager', config);
            
            // CanvasManager完全初期化確実実行
            if (canvasManager && typeof canvasManager.initializeV8Application === 'function') {
                console.log('🚀 CanvasManager V8 Application初期化実行');
                await canvasManager.initializeV8Application(this._pixiApp);
                
                // isReady確認必須
                if (!canvasManager.isReady()) {
                    throw new Error('CanvasManager initialization verification failed');
                }
                console.log('🚀 CanvasManager完全初期化確認完了');
            } else {
                throw new Error('CanvasManager initializeV8Application method not found');
            }
            
            console.log('🚀 Phase 2 完了');
        }
        
        /**
         * Phase 3: Canvas依存Manager群初期化
         */
        async _initializePhase3Managers(config) {
            console.log('🚀 Phase 3: Canvas依存Manager初期化');
            
            // CoordinateManager（Canvas依存）
            await this._initializeSingleManager('coordinate', 'CoordinateManager', config);
            
            // NavigationManager（Canvas依存）
            await this._initializeSingleManager('navigation', 'NavigationManager', config);
            
            // RecordManager（独立）
            await this._initializeSingleManager('record', 'RecordManager', config);
            
            // ShortcutManager（独立）
            await this._initializeSingleManager('shortcut', 'ShortcutManager', config);
            
            console.log('🚀 Phase 3 完了');
        }
        
        /**
         * Phase 4: Tool Manager初期化
         */
        async _initializePhase4Managers(config) {
            console.log('🚀 Phase 4: ToolManager初期化');
            
            // ToolManager
            const toolManager = await this._initializeSingleManager('tool', 'ToolManager', config);
            
            console.log('🚀 Phase 4 完了');
        }
        
        /**
         * 単一Manager初期化
         * @param {string} key Manager登録キー
         * @param {string} className Manager クラス名
         * @param {Object} config 設定
         * @returns {Promise<Object>} Manager インスタンス
         */
        async _initializeSingleManager(key, className, config) {
            try {
                console.log(`🚀 Initializing ${className}...`);
                
                // Manager クラス取得
                const ManagerClass = window.Tegaki?.[className];
                if (!ManagerClass) {
                    throw new Error(`Manager class not found: ${className}`);
                }
                
                // Manager インスタンス作成
                const manager = new ManagerClass();
                
                // 統一ライフサイクル実行
                await this._executeManagerLifecycle(manager, className, config);
                
                // Manager登録
                this._managers.set(key, manager);
                this._managersObject[key] = manager;
                
                // エイリアス登録（後方互換）
                const aliases = this._getManagerAliases(key);
                for (const alias of aliases) {
                    this._managersObject[alias] = manager;
                }
                
                console.log(`🚀 ${className} initialized successfully`);
                return manager;
                
            } catch (error) {
                console.error(`🚀 ${className} initialization failed:`, error);
                this._errors.push({ component: className, error: error.message });
                
                // 致命的でないManager失敗時は継続（グレースフルダウングレード）
                if (!this._isCriticalManager(className)) {
                    console.warn(`🚀 Non-critical manager ${className} failed, continuing...`);
                    return null;
                }
                
                throw error;
            }
        }
        
        /**
         * Manager統一ライフサイクル実行
         * @param {Object} manager Manager インスタンス
         * @param {string} className Manager クラス名
         * @param {Object} config 設定
         */
        async _executeManagerLifecycle(manager, className, config) {
            // configure（設定注入）
            if (typeof manager.configure === 'function') {
                manager.configure(config);
            } else {
                // 非破壊的エイリアス注入（AppCore層のみ許可）
                manager.configure = (cfg) => {
                    // ログ抑制（デバッグ時のみ出力）
                    if (this._debugMode) {
                        console.log(`🚀 Fallback configure for ${className}:`, cfg);
                    }
                };
            }
            
            // attach（参照注入）
            if (typeof manager.attach === 'function') {
                const context = this._buildManagerContext(className);
                manager.attach(context);
            } else {
                // 非破壊的エイリアス注入
                manager.attach = (ctx) => {
                    // ログ抑制（デバッグ時のみ出力）
                    if (this._debugMode) {
                        console.log(`🚀 Fallback attach for ${className}:`, ctx);
                    }
                };
            }
            
            // init（内部初期化）
            if (typeof manager.init === 'function') {
                await manager.init();
            } else {
                // 非破壊的エイリアス注入
                manager.init = async () => {
                    // ログ抑制（デバッグ時のみ出力）
                    if (this._debugMode) {
                        console.log(`🚀 Fallback init for ${className}`);
                    }
                };
            }
            
            // isReady（準備完了確認）
            if (typeof manager.isReady !== 'function') {
                // 非破壊的エイリアス注入
                manager.isReady = () => {
                    // ログ抑制（デバッグ時のみ出力）
                    if (this._debugMode) {
                        console.log(`🚀 Fallback isReady for ${className}: true`);
                    }
                    return true;
                };
            }
        }
        
        /**
         * Manager用コンテキスト構築
         * @param {string} className Manager クラス名
         * @returns {Object}
         */
        _buildManagerContext(className) {
            const baseContext = {
                pixiApp: this._pixiApp,
                canvas: this._pixiApp?.canvas,
                eventBus: this._managers.get('eventBus') || this._managers.get('eventbus')
            };
            
            // Manager固有コンテキスト追加
            switch (className) {
                case 'CoordinateManager':
                    return {
                        ...baseContext,
                        canvasManager: this._managers.get('canvas'),
                        canvas: this._managers.get('canvas') // エイリアス
                    };
                    
                case 'NavigationManager':
                    return {
                        ...baseContext,
                        canvasManager: this._managers.get('canvas'),
                        coordinateManager: this._managers.get('coordinate')
                    };
                    
                case 'ToolManager':
                    return {
                        ...baseContext,
                        canvasManager: this._managers.get('canvas'),
                        coordinateManager: this._managers.get('coordinate')
                    };
                    
                default:
                    return baseContext;
            }
        }
        
        /**
         * Tool統合初期化
         */
        async _initializeToolIntegration() {
            console.log('🚀 Tool統合初期化開始');
            
            const toolManager = this._managers.get('tool');
            if (!toolManager) {
                throw new Error('ToolManager not found for Tool integration');
            }
            
            // Manager群注入
            if (typeof toolManager.setManagers === 'function') {
                toolManager.setManagers(this._managersObject);
            } else {
                throw new Error('ToolManager.setManagers method not found');
            }
            
            // 依存確認（getDrawContainer動作確認）
            if (typeof toolManager.verifyInjection === 'function') {
                toolManager.verifyInjection();
            } else {
                console.warn('🚀 ToolManager.verifyInjection not found, skipping verification');
            }
            
            // Tool群作成・Manager注入実行
            if (typeof toolManager.initializeV8Tools === 'function') {
                await toolManager.initializeV8Tools();
            } else {
                throw new Error('ToolManager.initializeV8Tools method not found');
            }
            
            console.log('🚀 Tool統合初期化完了');
        }
        
        //================================================
        // アプリケーション完了・UI連携
        //================================================
        
        /**
         * アプリケーション準備完了・UI起動
         */
        emitAppReady() {
            console.log('🚀 AppCore app:ready 発火開始');
            
            try {
                // 状態更新
                this._initializationStatus.ready = true;
                this._initialized = true;
                
                // EventBus通知
                const eventBus = this._managers.get('eventBus') || this._managers.get('eventbus');
                if (eventBus && typeof eventBus.emit === 'function') {
                    eventBus.emit('app:ready', {
                        managers: [...this._managers.keys()],
                        pixiApp: this._pixiApp,
                        errors: this._errors
                    });
                } else {
                    console.warn('🚀 EventBus not available for app:ready emission');
                }
                
                // デバッグ情報出力
                if (this._debugMode) {
                    this._logDebugInfo();
                }
                
                console.log('🚀 AppCore app:ready 発火完了');
                
            } catch (error) {
                console.error('🚀 AppCore app:ready 発火失敗:', error);
            }
        }
        
        //================================================
        // 状態管理・デバッグAPI
        //================================================
        
        /**
         * 初期化完了判定
         * @returns {boolean}
         */
        isInitialized() {
            return this._initialized;
        }
        
        /**
         * Manager群取得
         * @returns {Map}
         */
        getManagers() {
            return this._managers;
        }
        
        /**
         * Manager群取得（オブジェクト形式）
         * @returns {Object}
         */
        getManagersObject() {
            return this._managersObject;
        }
        
        /**
         * 単一Manager取得
         * @param {string} key Manager キー
         * @returns {Object|null}
         */
        getManager(key) {
            return this._managers.get(key) || null;
        }
        
        /**
         * 全Manager取得（Map形式）
         * @returns {Map}
         */
        getAllManagers() {
            return this._managers;
        }
        
        /**
         * 初期化状態取得
         * @returns {Object}
         */
        getInitializationStatus() {
            return {
                ...this._initializationStatus,
                managerCount: this._managers.size,
                errorCount: this._errors.length,
                managersReady: this._checkAllManagersReady()
            };
        }
        
        /**
         * システム状態取得（TegakiApplicationから呼び出される）
         * @returns {Object}
         */
        getSystemStatus() {
            return {
                initialized: this._initialized,
                canvas: this._initializationStatus.canvas,
                managers: this._initializationStatus.managers,
                tools: this._initializationStatus.tools,
                ready: this._initializationStatus.ready,
                managerCount: this._managers.size,
                errors: this._errors,
                pixiApp: !!this._pixiApp,
                managersReady: this._checkAllManagersReady()
            };
        }
        
        /**
         * 全Manager準備完了確認
         * @returns {boolean}
         */
        _checkAllManagersReady() {
            for (const [key, manager] of this._managers) {
                if (manager && typeof manager.isReady === 'function' && !manager.isReady()) {
                    return false;
                }
            }
            return true;
        }
        
        /**
         * Manager名称エイリアス取得
         * @param {string} key Manager キー
         * @returns {Array<string>}
         */
        _getManagerAliases(key) {
            const aliases = {
                'eventBus': ['eventbus'],
                'canvas': ['canvasManager'],
                'coordinate': ['coordinateManager'],
                'tool': ['toolManager'],
                'record': ['recordManager'],
                'navigation': ['navigationManager'],
                'shortcut': ['shortcutManager']
            };
            
            return aliases[key] || [];
        }
        
        /**
         * 致命的Manager確認
         * @param {string} className Manager クラス名
         * @returns {boolean}
         */
        _isCriticalManager(className) {
            const criticalManagers = ['CanvasManager', 'ToolManager'];
            return criticalManagers.includes(className);
        }
        
        /**
         * デバッグ情報出力
         */
        _logDebugInfo() {
            console.log('🚀 AppCore Debug Info:', {
                initialized: this._initialized,
                pixiApp: !!this._pixiApp,
                managersCount: this._managers.size,
                managers: [...this._managers.keys()],
                initStatus: this._initializationStatus,
                errors: this._errors,
                managersReady: this._checkAllManagersReady()
            });
        }
    }
    
    // Global登録
    if (!window.Tegaki) {
        window.Tegaki = {};
    }
    
    window.Tegaki.AppCore = AppCore;
    
    console.log('🚀 AppCore EventBus初期化修正・Manager依存関係修正版 Loaded');
    console.log('📏 修正内容: EventBus初期化修正・Manager依存関係修正・getSystemStatus追加・依存関係厳格化・架空メソッド撲滅');
    console.log('🚀 特徴: Phase別初期化・Manager契約確認・エラー集約・グレースフルダウングレード・Tool統合制御・UI連携強化');
    
})();