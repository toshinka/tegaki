/**
 * 🏗️ AppCore - アプリケーション統括制御（緊急修正版）
 * 責務:
 * - PixiJS初期化
 * - Manager統括管理
 * - 共通API提供
 * - グローバルイベント処理
 * 
 * 🚨 緊急修正内容:
 * - ExtensionLoader安全な参照
 * - エラーハンドリング強化
 * - フォールバック処理追加
 * - Manager初期化の安全化
 */

class AppCore {
    constructor() {
        this.app = null;
        this.stage = null;
        this.managers = {};
        this.extensions = {};
        this.isInitialized = false;
        this.initializationError = null;
    }
    
    async init() {
        console.log('🚀 Tegaki Phase1 起動開始（緊急修正版）...');
        
        try {
            // 拡張ライブラリ検出（安全化）
            await this.detectExtensions();
            
            // PixiJS初期化
            await this.initializePixiJS();
            
            // Manager統括初期化（安全化）
            await this.initializeManagers();
            
            // グローバルイベント設定
            this.setupGlobalEvents();
            
            this.isInitialized = true;
            console.log('✅ Tegaki Phase1 起動完了（緊急修正版）');
            
            // デバッグ機能追加
            this.setupDebugAPI();
            
        } catch (error) {
            console.error('❌ Tegaki Phase1 起動失敗:', error);
            this.initializationError = error;
            
            // 部分的でも動作するようフォールバック試行
            await this.initializeFallbackMode();
            throw error;
        }
    }
    
    async detectExtensions() {
        try {
            // ExtensionLoaderの安全な参照
            if (typeof ExtensionLoader === 'undefined') {
                console.warn('⚠️ ExtensionLoader未定義: フォールバック使用');
                this.extensions = this.createFallbackExtensions();
                return;
            }
            
            const loader = new ExtensionLoader();
            this.extensions = await loader.detectAvailableExtensions();
            
            // isAvailableメソッドを追加（後方互換性）
            if (!this.extensions.isAvailable) {
                this.extensions.isAvailable = (name) => {
                    return this.extensions[name]?.available || false;
                };
            }
            
        } catch (error) {
            console.error('❌ Extension検出失敗:', error);
            this.extensions = this.createFallbackExtensions();
        }
    }
    
    createFallbackExtensions() {
        console.log('🔄 フォールバック拡張機能セット作成...');
        return {
            PIXI: { available: typeof PIXI !== 'undefined' },
            UI: { available: false },
            Viewport: { available: false },
            Filters: { available: false },
            SVG: { available: false },
            GSAP: { available: false },
            Lodash: { available: false },
            Hammer: { available: false },
            isAvailable: (name) => {
                return this.extensions[name]?.available || false;
            }
        };
    }
    
    async initializePixiJS() {
        try {
            // PIXI基本チェック
            if (typeof PIXI === 'undefined') {
                throw new Error('PixiJS が読み込まれていません。CDNを確認してください。');
            }
            
            this.app = new PIXI.Application({
                width: window.innerWidth,
                height: window.innerHeight,
                backgroundColor: 0xFFFFFF,
                resolution: window.devicePixelRatio || 1,
                autoDensity: true,
                antialias: true
            });
            
            this.stage = this.app.stage;
            
            // DOM追加の安全化
            const appElement = document.getElementById('app');
            if (appElement) {
                appElement.appendChild(this.app.view);
            } else {
                console.warn('⚠️ #app要素が見つかりません。bodyに追加します。');
                document.body.appendChild(this.app.view);
            }
            
            console.log('✅ PixiJS初期化完了');
            
        } catch (error) {
            console.error('❌ PixiJS初期化失敗:', error);
            throw error;
        }
    }
    
    async initializeManagers() {
        try {
            console.log('🏗️ Manager初期化開始...');
            
            // Manager生成（依存関係順序・安全化）
            const managerConfigs = [
                { name: 'settings', class: 'SettingsManager' },
                { name: 'canvas', class: 'CanvasManager' },
                { name: 'memory', class: 'MemoryManager' },
                { name: 'tool', class: 'ToolManager' },
                { name: 'ui', class: 'UIManager' }
            ];
            
            // Manager作成（安全化）
            for (const config of managerConfigs) {
                try {
                    if (typeof window[config.class] !== 'undefined') {
                        this.managers[config.name] = new window[config.class](this);
                        console.log(`✅ ${config.name}Manager作成完了`);
                    } else {
                        console.warn(`⚠️ ${config.class}が見つかりません。スキップします。`);
                    }
                } catch (error) {
                    console.error(`❌ ${config.name}Manager作成失敗:`, error);
                }
            }
            
            // Manager初期化（並列・安全化）
            const initPromises = Object.entries(this.managers).map(async ([name, manager]) => {
                try {
                    if (manager && typeof manager.init === 'function') {
                        await manager.init();
                        console.log(`✅ ${name}Manager初期化完了`);
                    } else {
                        console.warn(`⚠️ ${name}Manager: init()メソッドがありません`);
                    }
                } catch (error) {
                    console.error(`❌ ${name}Manager初期化失敗:`, error);
                    // 個別のManager初期化失敗は全体の失敗にしない
                }
            });
            
            await Promise.all(initPromises);
            console.log('🏗️ Manager初期化処理完了');
            
        } catch (error) {
            console.error('❌ Manager初期化失敗:', error);
            // Manager初期化失敗でも基本機能は動作させる
        }
    }
    
    async initializeFallbackMode() {
        console.log('🔄 フォールバックモード初期化...');
        try {
            // 最小限のPixiJS初期化のみ
            if (!this.app && typeof PIXI !== 'undefined') {
                await this.initializePixiJS();
            }
            console.log('✅ フォールバックモード初期化完了');
        } catch (error) {
            console.error('❌ フォールバックモード初期化失敗:', error);
        }
    }
    
    setupGlobalEvents() {
        try {
            // リサイズ対応
            window.addEventListener('resize', () => {
                try {
                    if (this.app && this.app.renderer) {
                        this.app.renderer.resize(window.innerWidth, window.innerHeight);
                    }
                    
                    const canvasManager = this.getManager('canvas');
                    if (canvasManager && typeof canvasManager.handleResize === 'function') {
                        canvasManager.handleResize();
                    }
                } catch (error) {
                    console.error('❌ リサイズ処理エラー:', error);
                }
            });
            
            // エラーハンドリング
            window.addEventListener('error', (err) => {
                console.error('❌ アプリケーションエラー:', err);
            });
            
            // パフォーマンス監視（オプション）
            if (this.extensions.isAvailable('GSAP')) {
                try {
                    this.extensions.GSAP.gsap.ticker.add(this.updatePerformanceStats.bind(this));
                } catch (error) {
                    console.warn('⚠️ パフォーマンス監視設定失敗:', error);
                }
            }
            
            console.log('✅ グローバルイベント設定完了');
            
        } catch (error) {
            console.error('❌ グローバルイベント設定失敗:', error);
        }
    }
    
    setupDebugAPI() {
        try {
            // デバッグ機能をグローバルに公開
            window.debugTegaki = {
                app: this,
                checkManagers: () => {
                    console.log('🏗️ Manager状態:');
                    Object.entries(this.managers).forEach(([name, manager]) => {
                        const status = manager && manager.isInitialized ? '✅' : '❌';
                        console.log(`  ${name}: ${status}`);
                    });
                },
                testManagerCommunication: () => {
                    try {
                        const toolManager = this.getManager('tool');
                        const uiManager = this.getManager('ui');
                        
                        if (toolManager && typeof toolManager.setTool === 'function') {
                            toolManager.setTool('pen');
                        }
                        
                        if (uiManager && typeof uiManager.updateCurrentTool === 'function') {
                            uiManager.updateCurrentTool('pen');
                        }
                        
                        console.log('✅ Manager間連携テスト完了');
                    } catch (error) {
                        console.error('❌ Manager間連携テスト失敗:', error);
                    }
                },
                stats: () => this.getStats(),
                extensions: () => this.extensions
            };
            
            console.log('🔍 デバッグAPI設定完了 - window.debugTegaki利用可能');
        } catch (error) {
            console.error('❌ デバッグAPI設定失敗:', error);
        }
    }
    
    // 共通API（安全化）
    getManager(name) {
        const manager = this.managers[name];
        if (!manager) {
            console.warn(`⚠️ Manager '${name}' が見つかりません`);
        }
        return manager;
    }
    
    getLocalPointerPosition(event) {
        try {
            const canvas = this.getManager('canvas');
            if (canvas && canvas.viewport) {
                return canvas.viewport.toLocal(event.data.global);
            }
            return event.data.global;
        } catch (error) {
            console.error('❌ ポインター位置取得エラー:', error);
            return { x: 0, y: 0 };
        }
    }
    
    emit(eventName, data) {
        try {
            // Manager間イベント通信
            Object.values(this.managers).forEach(manager => {
                if (manager && typeof manager.onEvent === 'function') {
                    try {
                        manager.onEvent(eventName, data);
                    } catch (error) {
                        console.error(`❌ Manager onEvent エラー (${eventName}):`, error);
                    }
                }
            });
        } catch (error) {
            console.error('❌ イベント配信エラー:', error);
        }
    }
    
    getStats() {
        try {
            const managerCount = Object.keys(this.managers).length;
            const initializedManagerCount = Object.values(this.managers)
                .filter(m => m && m.isInitialized).length;
            
            return {
                fps: this.app ? this.app.ticker.FPS.toFixed(1) : 0,
                managers: managerCount,
                initializedManagers: initializedManagerCount,
                extensions: Object.keys(this.extensions).length,
                loadedExtensions: Object.values(this.extensions)
                    .filter(ext => ext && ext.available).length,
                isInitialized: this.isInitialized,
                hasError: !!this.initializationError
            };
        } catch (error) {
            console.error('❌ 統計取得エラー:', error);
            return { error: error.message };
        }
    }
    
    updatePerformanceStats() {
        try {
            if (this.app && this.app.ticker) {
                const fps = this.app.ticker.FPS;
                if (fps < 30) {
                    console.warn(`⚠️ FPS低下: ${fps.toFixed(1)}`);
                }
            }
        } catch (error) {
            console.error('❌ パフォーマンス統計更新エラー:', error);
        }
    }
    
    // 緊急診断機能
    diagnose() {
        console.group('🔍 AppCore 診断情報');
        
        try {
            console.log('基本情報:', {
                initialized: this.isInitialized,
                hasError: !!this.initializationError,
                pixiLoaded: typeof PIXI !== 'undefined',
                appCreated: !!this.app
            });
            
            console.log('Manager状態:');
            Object.entries(this.managers).forEach(([name, manager]) => {
                console.log(`  ${name}:`, {
                    exists: !!manager,
                    initialized: manager && manager.isInitialized,
                    hasInit: manager && typeof manager.init === 'function'
                });
            });
            
            console.log('拡張機能状態:', this.extensions);
            
            if (this.initializationError) {
                console.error('初期化エラー:', this.initializationError);
            }
            
        } catch (error) {
            console.error('診断実行エラー:', error);
        }
        
        console.groupEnd();
    }
}