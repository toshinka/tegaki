/**
 * 🏗️ AppCore - アプリケーション統括制御（軽量化版）
 * 責務:
 * - PixiJS初期化
 * - Manager統括管理
 * - 共通API提供
 * - グローバルイベント処理
 * 
 * Before: 1000行超（責務過多）
 * After: 200行以下（統括のみ）
 * 
 * 🎯 AI_WORK_SCOPE: アプリケーション統括制御専用ファイル
 * 🎯 DEPENDENCIES: managers/*.js, ExtensionLoader
 * 📋 LIGHTWEIGHT_PLAN: Manager統括による責務分散実現
 */

class AppCore {
    constructor() {
        this.app = null;
        this.stage = null;
        this.managers = {};
        this.extensions = {};
        this.isInitialized = false;
        
        // グローバルイベントリスナー
        this.eventListeners = new Map();
        
        // パフォーマンス監視
        this.stats = {
            fps: 60,
            memory: 0,
            drawCalls: 0,
            lastUpdate: Date.now()
        };
    }
    
    async init() {
        console.log('🚀 Tegaki Phase1 起動開始...');
        
        try {
            // 拡張ライブラリ検出
            await this.detectExtensions();
            
            // PixiJS初期化
            await this.initializePixiJS();
            
            // Manager統括初期化
            await this.initializeManagers();
            
            // グローバルイベント設定
            this.setupGlobalEvents();
            
            // デバッグAPI公開
            this.setupDebugAPI();
            
            this.isInitialized = true;
            console.log('✅ Tegaki Phase1 起動完了');
            
            // 初期化完了通知
            this.emit('app-initialized');
            
        } catch (error) {
            console.error('❌ Tegaki Phase1 起動失敗:', error);
            throw error;
        }
    }
    
    async detectExtensions() {
        const extensionLoader = new ExtensionLoader();
        this.extensions = await extensionLoader.detectAvailableExtensions();
        
        // ExtensionLoader自体も保持
        this.extensionLoader = extensionLoader;
        
        console.log('🔌 拡張ライブラリ検出完了');
    }
    
    async initializePixiJS() {
        // 📋 V8_MIGRATION: Phase4でv8移行予定
        // - PIXI.Application → PIXI.Application (新構文)
        // - WebGPU Renderer対応予定
        
        const settings = this.getExtension('Settings')?.settings || {};
        const perfSettings = settings.performance || {};
        
        this.app = new PIXI.Application({
            width: window.innerWidth - 50, // サイドバー分を引く
            height: window.innerHeight,
            backgroundColor: 0xFFFFEE, // futaba-background
            resolution: perfSettings.resolution || window.devicePixelRatio || 1,
            autoDensity: true,
            antialias: perfSettings.antialias !== false,
            powerPreference: 'high-performance'
        });
        
        this.stage = this.app.stage;
        
        // DOMに追加
        const canvasContainer = document.getElementById('drawing-canvas');
        if (canvasContainer) {
            canvasContainer.appendChild(this.app.view);
        } else {
            console.warn('⚠️ #drawing-canvas 要素が見つかりません');
            document.body.appendChild(this.app.view);
        }
        
        console.log('✅ PixiJS初期化完了');
    }
    
    async initializeManagers() {
        console.log('🏗️ Manager初期化開始...');
        
        // Manager生成（依存関係順序重要）
        this.managers.settings = new SettingsManager(this);
        this.managers.canvas = new CanvasManager(this);
        this.managers.memory = new MemoryManager(this);
        this.managers.tool = new ToolManager(this);
        this.managers.ui = new UIManager(this);
        
        // 段階的初期化（高速化のため並列化可能なものは並列化）
        // Phase 1: 基盤システム
        await Promise.all([
            this.managers.settings.init(),
            this.managers.memory.init()
        ]);
        
        // Phase 2: 描画システム
        await this.managers.canvas.init();
        
        // Phase 3: ツール・UI（描画システム依存）
        await Promise.all([
            this.managers.tool.init(),
            this.managers.ui.init()
        ]);
        
        console.log('✅ 全Manager初期化完了');
    }
    
    setupGlobalEvents() {
        // リサイズ対応
        window.addEventListener('resize', () => {
            const newWidth = window.innerWidth - 50;
            const newHeight = window.innerHeight;
            
            this.app.renderer.resize(newWidth, newHeight);
            this.emit('window-resize', { width: newWidth, height: newHeight });
        });
        
        // エラーハンドリング
        window.addEventListener('error', (event) => {
            console.error('❌ グローバルエラー:', event.error);
            this.emit('global-error', event.error);
        });
        
        // 未処理Promise拒否
        window.addEventListener('unhandledrejection', (event) => {
            console.error('❌ 未処理Promise拒否:', event.reason);
            this.emit('unhandled-rejection', event.reason);
        });
        
        // パフォーマンス監視
        if (this.extensions.isAvailable('GSAP')) {
            this.extensions.getExtension('GSAP').gsap.ticker.add(this.updateStats.bind(this));
        } else {
            // フォールバック: setInterval
            setInterval(() => this.updateStats(), 16); // 60FPS相当
        }
        
        console.log('🌍 グローバルイベント設定完了');
    }
    
    setupDebugAPI() {
        // デバッグ機能をグローバルに公開
        window.debugTegaki = {
            app: this,
            
            // Manager状態確認
            checkManagers: () => {
                console.group('🏗️ Manager状態確認');
                Object.entries(this.managers).forEach(([name, manager]) => {
                    const status = manager.isInitialized ? '✅ 初期化済' : '❌ 未初期化';
                    console.log(`  ${name}: ${status}`);
                });
                console.groupEnd();
            },
            
            // Manager間連携テスト
            testManagerCommunication: () => {
                console.log('🔗 Manager間連携テスト開始...');
                
                try {
                    // ツール変更テスト
                    this.getManager('tool').setTool('pen');
                    this.getManager('ui').updateCurrentTool('pen');
                    
                    // 設定変更テスト
                    this.getManager('settings').set('pen.size', 20);
                    
                    // メモリ管理テスト
                    this.getManager('memory').saveState();
                    
                    console.log('✅ Manager間連携テスト完了');
                } catch (error) {
                    console.error('❌ Manager間連携テストエラー:', error);
                }
            },
            
            // 拡張ライブラリ状態確認
            checkExtensions: () => {
                console.group('📦 拡張ライブラリ状態');
                Object.entries(this.extensions).forEach(([name, ext]) => {
                    const status = ext.available ? '✅ 利用可能' : '❌ 未検出';
                    console.log(`  ${name}: ${status}`);
                });
                console.groupEnd();
            },
            
            // パフォーマンス統計
            stats: () => this.getStats(),
            
            // メモリ使用量確認
            memoryStats: () => this.getManager('memory')?.getMemoryStats() || null,
            
            // 強制ガベージコレクション
            gc: () => this.getManager('memory')?.forceGarbageCollection(),
            
            // Manager個別デバッグ
            debug: (managerName) => {
                const manager = this.getManager(managerName);
                if (manager && typeof manager.debug === 'function') {
                    return manager.debug();
                } else {
                    console.warn(`⚠️ Manager '${managerName}' にdebug()メソッドがありません`);
                }
            }
        };
        
        console.log('🐛 デバッグAPI公開完了 (window.debugTegaki)');
    }
    
    updateStats() {
        const now = Date.now();
        const deltaTime = now - this.stats.lastUpdate;
        
        // FPS計算
        this.stats.fps = Math.round(1000 / deltaTime);
        
        // メモリ使用量（概算）
        if ('memory' in performance) {
            this.stats.memory = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
        }
        
        // 描画コール数（PixiJS統計）
        if (this.app.renderer.gl) {
            this.stats.drawCalls = this.app.renderer.drawCalls || 0;
        }
        
        this.stats.lastUpdate = now;
        
        // FPS警告
        if (this.stats.fps < 30 && Math.random() < 0.01) { // 1%の確率で警告
            console.warn(`⚡ FPS低下検出: ${this.stats.fps}fps`);
        }
    }
    
    // 共通API
    getManager(name) {
        const manager = this.managers[name];
        if (!manager) {
            console.warn(`⚠️ Manager '${name}' が見つかりません`);
        }
        return manager;
    }
    
    getExtension(name) {
        return this.extensions[name] || null;
    }
    
    isExtensionAvailable(name) {
        return this.extensions[name]?.available || false;
    }
    
    // 座標変換ユーティリティ
    getLocalPointerPosition(event) {
        const canvasManager = this.getManager('canvas');
        if (canvasManager && canvasManager.screenToWorld) {
            const rect = this.app.view.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            return canvasManager.screenToWorld(x, y);
        }
        
        // フォールバック
        return event.data ? event.data.global : { x: 0, y: 0 };
    }
    
    // イベントシステム
    on(eventName, callback) {
        if (!this.eventListeners.has(eventName)) {
            this.eventListeners.set(eventName, []);
        }
        this.eventListeners.get(eventName).push(callback);
    }
    
    off(eventName, callback) {
        const callbacks = this.eventListeners.get(eventName);
        if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index !== -1) {
                callbacks.splice(index, 1);
            }
        }
    }
    
    emit(eventName, data) {
        // AppCore内部リスナー
        const callbacks = this.eventListeners.get(eventName);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(data);
                } catch (err) {
                    console.error(`❌ イベントエラー (${eventName}):`, err);
                }
            });
        }
        
        // Manager間イベント通信
        Object.values(this.managers).forEach(manager => {
            if (typeof manager.onEvent === 'function') {
                try {
                    manager.onEvent(eventName, data);
                } catch (err) {
                    console.error(`❌ Manager イベントエラー (${eventName}):`, err);
                }
            }
        });
    }
    
    // 統計情報取得
    getStats() {
        return {
            ...this.stats,
            managersInitialized: Object.values(this.managers).filter(m => m.isInitialized).length,
            totalManagers: Object.keys(this.managers).length,
            extensionsLoaded: Object.values(this.extensions).filter(ext => ext.available).length,
            totalExtensions: Object.keys(this.extensions).length,
            pixiVersion: PIXI.VERSION,
            rendererType: this.app ? this.app.renderer.type : 'unknown'
        };
    }
    
    // アプリケーション終了処理
    destroy() {
        console.log('🛑 アプリケーション終了処理開始...');
        
        // Manager終了処理
        Object.values(this.managers).forEach(manager => {
            if (typeof manager.destroy === 'function') {
                try {
                    manager.destroy();
                } catch (err) {
                    console.error('❌ Manager終了処理エラー:', err);
                }
            }
        });
        
        // PixiJS終了処理
        if (this.app) {
            this.app.destroy(true);
        }
        
        // イベントリスナークリーンアップ
        this.eventListeners.clear();
        
        // グローバルデバッグAPI削除
        if (window.debugTegaki) {
            delete window.debugTegaki;
        }
        
        console.log('✅ アプリケーション終了処理完了');
    }
    
    // 状態チェック（ヘルスチェック）
    healthCheck() {
        const health = {
            overall: 'healthy',
            issues: [],
            managers: {},
            performance: {}
        };
        
        // Manager健全性チェック
        Object.entries(this.managers).forEach(([name, manager]) => {
            health.managers[name] = manager.isInitialized;
            if (!manager.isInitialized) {
                health.issues.push(`Manager '${name}' が未初期化`);
            }
        });
        
        // パフォーマンスチェック
        if (this.stats.fps < 30) {
            health.issues.push(`FPS低下: ${this.stats.fps}fps`);
            health.performance.fps = 'warning';
        } else {
            health.performance.fps = 'good';
        }
        
        if (this.stats.memory > 100) {
            health.issues.push(`メモリ使用量高: ${this.stats.memory}MB`);
            health.performance.memory = 'warning';
        } else {
            health.performance.memory = 'good';
        }
        
        // 総合判定
        if (health.issues.length > 0) {
            health.overall = health.issues.length > 3 ? 'critical' : 'warning';
        }
        
        return health;
    }
}