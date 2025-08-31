/**
 * 📄 FILE: js/app-core.js
 * 📌 RESPONSIBILITY: PixiJS v8統合基盤システム・Manager群統一初期化・システム制御
 * ChangeLog: 2025-09-01 <Step1 Fix - configure existence check, simplified logging, prevent circular ref>
 * 
 * @provides
 *   - AppCore（クラス）
 *   - createV8Application(): PIXI.Application
 *   - createCanvasV8(width, height): PIXI.Application
 *   - getCanvasElement(): HTMLCanvasElement
 *   - initializeV8Managers(): void
 *   - verifyManagerReady(): boolean
 *   - startV8System(): void
 *   - isV8Ready(): boolean
 *   - emitAppReady(): void
 *
 * @uses
 *   - PIXI.Application（PixiJS v8 コアAPI）
 *   - window.Tegaki.CanvasManager
 *   - window.Tegaki.ToolManager
 *   - window.Tegaki.CoordinateManager
 *   - window.Tegaki.NavigationManager
 *   - window.Tegaki.RecordManager
 *   - window.Tegaki.ConfigManager
 *   - window.Tegaki.EventBusInstance
 *
 * @initflow
 *   1. createV8Application() → PixiJS Application生成
 *   2. createCanvasV8() → Canvas作成
 *   3. initializeV8Managers() → Manager群初期化
 *   4. startV8System() → システム開始
 *   5. emitAppReady() → UI初期化開始
 *
 * @forbids
 *   💀 双方向依存禁止
 *   🚫 フォールバック禁止
 *   🚫 架空メソッド呼び出し禁止
 *   🚫 Circular JSON reference禁止
 *   🚫 過度な冗長化禁止
 */

(function() {
    'use strict';

    /**
     * AppCore - Step1修正版（configure存在チェック・ログ簡素化・循環参照防止）
     */
    class AppCore {
        constructor() {
            // 基本状態
            this.pixiApp = null;
            this.canvasManager = null;
            this.toolManager = null;
            
            // Manager登録
            this.managers = new Map();
            
            // システム状態
            this.v8Ready = false;
            this.systemStarted = false;
            this.canvasElementReady = false;
            this.isInitialized = false; // 二重初期化防止フラグ
        }

        // ========================================
        // Canvas作成
        // ========================================
        
        /**
         * Canvas生成
         */
        async createCanvasV8(width = 400, height = 400) {
            try {
                const app = await this.createV8Application(width, height);
                
                if (!app || !app.canvas) {
                    throw new Error('Canvas creation failed');
                }
                
                this.canvasElementReady = true;
                return app;
                
            } catch (error) {
                console.error('💀 Canvas作成エラー:', error.message);
                throw error;
            }
        }
        
        /**
         * Canvas要素取得
         */
        getCanvasElement() {
            if (!this.pixiApp || !this.pixiApp.canvas) {
                throw new Error('Canvas not available');
            }
            return this.pixiApp.canvas;
        }

        /**
         * PixiJS Application作成
         */
        async createV8Application(width = 400, height = 400) {
            try {
                if (!window.PIXI) {
                    throw new Error('PixiJS not loaded');
                }
                
                // WebGPU警告抑制
                const originalWarn = console.warn;
                console.warn = function(message, ...args) {
                    if (typeof message === 'string' && 
                        message.includes('powerPreference option is currently ignored')) {
                        return;
                    }
                    originalWarn.call(console, message, ...args);
                };
                
                try {
                    this.pixiApp = new PIXI.Application();
                    await this.pixiApp.init({
                        width: 400,
                        height: 400,
                        backgroundColor: 0xf0e0d6,
                        resolution: Math.min(window.devicePixelRatio || 1, 2.0),
                        autoDensity: true
                    });
                    
                    if (this.pixiApp.canvas) {
                        this.pixiApp.canvas.style.width = '400px';
                        this.pixiApp.canvas.style.height = '400px';
                    }
                    
                } finally {
                    console.warn = originalWarn;
                }
                
                return this.pixiApp;
                
            } catch (error) {
                console.error('💀 PixiJS Application作成エラー:', error.message);
                throw error;
            }
        }

        // ========================================
        // Manager初期化（Step1修正版）
        // ========================================
        
        /**
         * Manager群初期化（二重初期化防止付き）
         */
        async initializeV8Managers() {
            // 二重初期化防止
            if (this.isInitialized) {
                console.log('⚠️ Manager群は既に初期化済み - 処理をスキップ');
                return;
            }
            
            if (!this.pixiApp || !this.canvasElementReady) {
                throw new Error('Canvas not ready');
            }
            
            try {
                console.log('🚀 Manager群初期化開始');
                
                // Step 1: CanvasManager
                this.canvasManager = new window.Tegaki.CanvasManager();
                this.canvasManager.configure({ canvas: { width: 400, height: 400 } });
                this.canvasManager.attach({ pixiApp: this.pixiApp });
                await this.canvasManager.init();
                
                if (!this.canvasManager.isReady()) {
                    throw new Error('CanvasManager初期化失敗');
                }
                
                this.registerManager('canvas', this.canvasManager);
                console.log('✅ CanvasManager初期化完了');
                
                // Step 2: その他のManager
                await this.initializeOtherManagers();
                
                // Step 3: CoordinateManager
                await this.initializeCoordinateManager();
                
                // Step 4: ToolManager
                await this.initializeToolManager();
                
                this.isInitialized = true;
                console.log('✅ Manager群初期化完了');
                
            } catch (error) {
                console.error('💀 Manager初期化エラー:', error.message);
                throw error;
            }
        }

        /**
         * その他Manager初期化（configure存在チェック付き）
         */
        async initializeOtherManagers() {
            try {
                // RecordManager
                const recordManager = new window.Tegaki.RecordManager();
                if (typeof recordManager.configure === 'function') {
                    recordManager.configure({});
                }
                recordManager.attach({});
                await recordManager.init();
                this.registerManager('record', recordManager);
                
                // ConfigManager（既存インスタンス使用）
                const configManager = window.Tegaki.ConfigManagerInstance || new window.Tegaki.ConfigManager();
                if (typeof configManager.configure === 'function') {
                    configManager.configure({});
                }
                if (typeof configManager.attach === 'function') {
                    configManager.attach({});
                }
                if (typeof configManager.init === 'function') {
                    await configManager.init();
                }
                this.registerManager('config', configManager);
                
                // EventBus（既存インスタンス使用）
                if (window.Tegaki.EventBusInstance) {
                    this.registerManager('eventbus', window.Tegaki.EventBusInstance);
                }
                
                // ErrorManager（既存インスタンス使用）
                if (window.Tegaki.ErrorManagerInstance) {
                    this.registerManager('error', window.Tegaki.ErrorManagerInstance);
                }
                
                // NavigationManager
                const navigationManager = new window.Tegaki.NavigationManager();
                this.registerManager('navigation', navigationManager);
                
                // ShortcutManager
                if (window.Tegaki.ShortcutManager) {
                    const shortcutManager = new window.Tegaki.ShortcutManager();
                    this.registerManager('shortcut', shortcutManager);
                }
                
                console.log('✅ その他Manager初期化完了');
                
            } catch (error) {
                console.error('💀 その他Manager初期化エラー:', error.message);
                throw error;
            }
        }

        /**
         * CoordinateManager初期化
         */
        async initializeCoordinateManager() {
            try {
                const coordinateManager = new window.Tegaki.CoordinateManager();
                coordinateManager.configure({ coordinate: { dpr: 2.0 } });
                coordinateManager.attach({ canvasManager: this.canvasManager });
                await coordinateManager.init();
                
                if (typeof coordinateManager.setCanvasManager === 'function') {
                    await coordinateManager.setCanvasManager(this.canvasManager);
                }
                
                if (!coordinateManager.isReady()) {
                    throw new Error('CoordinateManager初期化失敗');
                }
                
                this.registerManager('coordinate', coordinateManager);
                console.log('✅ CoordinateManager初期化完了');
                
            } catch (error) {
                console.error('💀 CoordinateManager初期化エラー:', error.message);
                throw error;
            }
        }

        /**
         * ToolManager初期化
         */
        async initializeToolManager() {
            try {
                this.toolManager = new window.Tegaki.ToolManager(this.canvasManager);
                this.registerManager('tool', this.toolManager);
                
                // Manager注入
                this.toolManager.setManagers(this.managers);
                
                // Tool初期化
                await this.toolManager.initializeV8Tools();
                
                if (!this.toolManager.isReady()) {
                    throw new Error('ToolManager初期化失敗');
                }
                
                console.log('✅ ToolManager初期化完了');
                
            } catch (error) {
                console.error('💀 ToolManager初期化エラー:', error.message);
                throw error;
            }
        }

        /**
         * Manager登録
         */
        registerManager(key, instance) {
            this.managers.set(key, instance);
            
            // グローバル登録
            const managerKey = `${key.charAt(0).toUpperCase() + key.slice(1)}ManagerInstance`;
            window.Tegaki[managerKey] = instance;
        }

        /**
         * Manager準備状況確認（簡潔版・循環参照防止）
         */
        verifyManagerReady() {
            const managerInfo = {};
            
            for (const [key, manager] of this.managers) {
                try {
                    managerInfo[key] = {
                        className: manager.constructor.name,
                        isReady: typeof manager.isReady === 'function' ? manager.isReady() : 'unknown',
                        hasInit: typeof manager.init === 'function',
                        hasConfigure: typeof manager.configure === 'function'
                    };
                } catch (error) {
                    managerInfo[key] = {
                        error: error.message
                    };
                }
            }
            
            console.log('📋 Manager準備状況:', managerInfo);
            return managerInfo;
        }

        // ========================================
        // システム開始
        // ========================================
        
        /**
         * システム開始
         */
        async startV8System() {
            if (!this.canvasManager || !this.toolManager) {
                throw new Error('Managers not ready');
            }
            
            try {
                // アイコン表示
                await this.initializeSidebarIcons();
                
                // 初期ツール設定
                this.setDefaultTool();
                
                this.systemStarted = true;
                this.v8Ready = true;
                
                // app:ready イベント発火
                this.emitAppReady();
                
                console.log('🚀 AppCore v8システム開始完了');
                
            } catch (error) {
                console.error('💀 システム開始エラー:', error.message);
                throw error;
            }
        }

        /**
         * サイドバーアイコン初期化
         */
        async initializeSidebarIcons() {
            try {
                if (window.Tegaki?.TegakiIcons?.replaceAllToolIcons) {
                    window.Tegaki.TegakiIcons.replaceAllToolIcons();
                    this.setupToolButtonEvents();
                }
            } catch (error) {
                console.warn('⚠️ アイコン初期化失敗:', error.message);
            }
        }

        /**
         * ツールボタンイベント設定
         */
        setupToolButtonEvents() {
            const toolButtons = {
                'pen-tool': 'pen',
                'eraser-tool': 'eraser'
            };
            
            Object.entries(toolButtons).forEach(([buttonId, toolName]) => {
                const button = document.getElementById(buttonId);
                if (button) {
                    button.addEventListener('click', () => {
                        this.switchTool(toolName);
                    });
                }
            });
        }

        /**
         * 初期ツール設定
         */
        setDefaultTool() {
            try {
                if (this.toolManager && this.toolManager.isReady()) {
                    this.toolManager.setActiveTool('pen');
                }
            } catch (error) {
                console.warn('⚠️ 初期ツール設定失敗:', error.message);
            }
        }

        /**
         * ツール切り替え
         */
        switchTool(toolName) {
            if (this.toolManager && this.toolManager.isReady()) {
                try {
                    this.toolManager.setActiveTool(toolName);
                } catch (error) {
                    console.error(`💀 ツール切り替え失敗: ${toolName}`, error.message);
                }
            }
        }

        /**
         * app:ready イベント発火
         */
        emitAppReady() {
            if (window.Tegaki?.EventBusInstance?.emit) {
                window.Tegaki.EventBusInstance.emit('app:ready', {
                    timestamp: Date.now(),
                    version: 'v8-phase1.5-step1-fix',
                    managers: Array.from(this.managers.keys())
                });
                console.log('✅ app:ready イベント発火');
            }
        }

        // ========================================
        // 状態確認
        // ========================================
        
        /**
         * システム準備状況確認
         */
        isV8Ready() {
            return this.v8Ready && 
                   this.systemStarted && 
                   this.pixiApp && 
                   this.canvasManager && 
                   this.toolManager &&
                   this.canvasElementReady;
        }

        /**
         * Manager取得
         */
        getManagerInstance(key) {
            return this.managers.get(key);
        }

        /**
         * デバッグ情報取得（循環参照対応）
         */
        getV8DebugInfo() {
            return {
                version: 'v8-step1-fix',
                systemStatus: {
                    v8Ready: this.v8Ready,
                    systemStarted: this.systemStarted,
                    canvasElementReady: this.canvasElementReady,
                    isInitialized: this.isInitialized
                },
                managers: {
                    count: this.managers.size,
                    registered: Array.from(this.managers.keys()),
                    canvasReady: this.canvasManager ? this.canvasManager.isReady() : false,
                    toolReady: this.toolManager ? this.toolManager.isReady() : false
                },
                pixiInfo: {
                    version: window.PIXI ? window.PIXI.VERSION : 'not loaded',
                    appExists: !!this.pixiApp,
                    canvasExists: !!this.pixiApp?.canvas
                }
            };
        }
    }

    // グローバル登録
    if (!window.Tegaki) {
        window.Tegaki = {};
    }
    window.Tegaki.AppCore = AppCore;
    
    console.log('✅ AppCore v8 Step1修正版 Loaded - configure存在チェック・ログ簡素化・循環参照防止');

})();