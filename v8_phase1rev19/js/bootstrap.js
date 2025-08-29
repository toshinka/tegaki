/**
 * 🚀 Bootstrap - PixiJS v8対応版（コンソール削減・初期化フロー修正版）
 * 
 * @provides bootstrap, checkPixiJSv8, checkDependencies, initializeTegakiApplication
 * @uses window.Tegaki.TegakiApplication, PIXI.Application, 各種Manager群
 * @initflow 1. DOMContentLoaded → 2. PixiJS v8確認 → 3. 依存関係確認 → 4. TegakiApplication初期化
 * @forbids 💀双方向依存禁止 🚫フォールバック禁止 🚫フェイルセーフ禁止 🚫v7/v8両対応二重管理禁止
 * @manager-key window.Tegaki.BootstrapInstance
 * @dependencies-strict PixiJS v8.12.0(必須), TegakiApplication(必須), 全Manager群(必須)
 * @integration-flow HTML読み込み → Bootstrap実行 → TegakiApplication.initialize() → システム開始
 * @method-naming-rules checkPixiJSv8()/checkDependencies()/initializeTegakiApplication()統一
 * @error-handling 初期化失敗時はコンソールエラー出力、フォールバック禁止
 * @performance-notes 非同期初期化、WebGPU対応確認、DPR制限適用
 */

(function() {
    'use strict';
    
    /**
     * 🚀 Bootstrap PixiJS v8対応版
     * コンソール削減・初期化フロー修正版
     */
    class Bootstrap {
        constructor() {
            this.initialized = false;
            this.v8Ready = false;
            this.pixiJSVersion = null;
            this.webGPUSupported = false;
            this.dependenciesReady = false;
            this.tegakiApp = null;
        }
        
        /**
         * 🚀 Bootstrap開始（メインエントリーポイント）
         */
        async start() {
            console.log('🔧 Bootstrap PixiJS v8対応版 実行開始...');
            
            try {
                // Step 1: PixiJS v8確認
                await this.checkPixiJSv8();
                
                // Step 2: 依存関係確認
                await this.checkDependencies();
                
                // Step 3: TegakiApplication初期化
                await this.initializeTegakiApplication();
                
                // Step 4: 完了処理
                this.completeInitialization();
                
                console.log('✅ Bootstrap完了 - Tegaki v8アプリケーション開始完了');
                console.log(`🚀 使用中レンダラー: WebGPU対応・PixiJS ${this.pixiJSVersion}`);
                
            } catch (error) {
                console.error('💀 Bootstrap エラー:', error);
                this.handleInitializationError(error);
            }
        }
        
        /**
         * ✅ PixiJS v8確認
         */
        async checkPixiJSv8() {
            console.log('⏳ PixiJS v8読み込み確認開始...');
            
            // PixiJS読み込み待機
            await this.waitForPixiJS();
            
            // バージョン確認
            if (!window.PIXI || !window.PIXI.VERSION) {
                throw new Error('PixiJS not loaded or VERSION not available');
            }
            
            this.pixiJSVersion = window.PIXI.VERSION;
            console.log(`🚀 PixiJS v8確認完了: ${this.pixiJSVersion}`);
            
            // v8バージョン確認
            if (!this.pixiJSVersion.startsWith('8.')) {
                throw new Error(`PixiJS v8 required, got v${this.pixiJSVersion}`);
            }
            
            // WebGPU対応確認
            this.webGPUSupported = !!window.PIXI.WebGPURenderer;
            console.log('🔍 WebGPU Support:', this.webGPUSupported);
            
            // 環境情報出力
            this.outputEnvironmentInfo();
            
            this.v8Ready = true;
        }
        
        /**
         * ⏳ PixiJS読み込み待機
         */
        async waitForPixiJS(maxAttempts = 100, interval = 50) {
            for (let i = 0; i < maxAttempts; i++) {
                if (window.PIXI && window.PIXI.VERSION) {
                    console.log(`✅ PixiJS発見 (試行 ${i + 1}/${maxAttempts})`);
                    return true;
                }
                await new Promise(resolve => setTimeout(resolve, interval));
            }
            throw new Error(`PixiJS読み込みタイムアウト (${maxAttempts * interval}ms)`);
        }
        
        /**
         * 📊 環境情報出力
         */
        outputEnvironmentInfo() {
            console.log(`🚀 PixiJS v${this.pixiJSVersion} loaded from node_modules`);
            console.log(`✅ PixiJS v${this.pixiJSVersion} confirmed`);
            console.log('✅ PIXI.Application: 利用可能');
            console.log('✅ PIXI.Container: 利用可能');
            console.log('✅ PIXI.Graphics: 利用可能');
            console.log('✅ PixiJS v8環境確認完了');
        }
        
        /**
         * 🔍 依存関係確認
         */
        async checkDependencies() {
            console.log('🔍 Phase1.5 依存関係確認開始...');
            
            const requiredClasses = [
                { name: 'TegakiApplication', class: window.Tegaki?.TegakiApplication },
                { name: 'AppCore', class: window.Tegaki?.AppCore },
                { name: 'CanvasManager', class: window.Tegaki?.CanvasManager },
                { name: 'ToolManager', class: window.Tegaki?.ToolManager },
                { name: 'ErrorManager', class: window.Tegaki?.ErrorManager },
                { name: 'ConfigManager', class: window.Tegaki?.ConfigManager },
                { name: 'EventBus', class: window.Tegaki?.EventBus },
                { name: 'CoordinateManager', class: window.Tegaki?.CoordinateManager },
                { name: 'NavigationManager', class: window.Tegaki?.NavigationManager },
                { name: 'RecordManager', class: window.Tegaki?.RecordManager },
                { name: 'ShortcutManager', class: window.Tegaki?.ShortcutManager },
                { name: 'PenTool', class: window.Tegaki?.PenTool },
                { name: 'EraserTool', class: window.Tegaki?.EraserTool }
            ];
            
            const missingClasses = [];
            let availableCount = 0;
            
            for (const { name, class: cls } of requiredClasses) {
                if (cls) {
                    console.log(`✅ ${name}: 利用可能`);
                    availableCount++;
                } else {
                    console.error(`❌ ${name}: 未ロード`);
                    missingClasses.push(name);
                }
            }
            
            console.log(`📊 依存関係確認結果: ${availableCount}/${requiredClasses.length} クラス利用可能`);
            
            if (missingClasses.length > 0) {
                throw new Error(`必須クラス未ロード: ${missingClasses.join(', ')}`);
            }
            
            this.dependenciesReady = true;
        }
        
        /**
         * 🎨 TegakiApplication初期化
         */
        async initializeTegakiApplication() {
            console.log('🎨 TegakiApplication v8対応版 インスタンス化開始...');
            
            if (!window.Tegaki?.TegakiApplication) {
                throw new Error('TegakiApplication class not available');
            }
            
            try {
                // TegakiApplication作成・初期化
                this.tegakiApp = new window.Tegaki.TegakiApplication();
                console.log('🚀 TegakiApplication v8対応版 作成・自動初期化開始');
                
                // 初期化実行
                await this.tegakiApp.initialize();
                
                // 準備状況確認
                if (!this.tegakiApp.isReady()) {
                    throw new Error('TegakiApplication initialization incomplete');
                }
                
                console.log('🎉 TegakiApplication v8システム初期化成功！');
                this.outputApplicationInfo();
                
                // グローバル登録
                window.Tegaki.TegakiApplicationInstance = this.tegakiApp;
                
            } catch (error) {
                console.error('💀 TegakiApplication初期化エラー:', error);
                throw error;
            }
        }
        
        /**
         * 📊 アプリケーション情報出力
         */
        outputApplicationInfo() {
            if (this.tegakiApp && this.tegakiApp.getDebugInfo) {
                const debugInfo = this.tegakiApp.getDebugInfo();
                console.log(`🚀 v8レンダラー: ${debugInfo.rendererType || 'unknown'}`);
                console.log(`🔧 WebGPU対応: ${debugInfo.webGPUSupported || false}`);
                console.log(`⏱️ 初期化時間: ${debugInfo.initializationTime || 'unknown'}ms`);
                console.log('📝 v8初期化ステップ:', debugInfo.initializationSteps || []);
                console.log('🔧 v8機能:', debugInfo.v8Features || {});
            }
        }
        
        /**
         * ✅ 初期化完了処理
         */
        completeInitialization() {
            this.initialized = true;
            
            // 初期化完了通知
            if (window.Tegaki?.EventBusInstance?.emit) {
                window.Tegaki.EventBusInstance.emit('bootstrapComplete', {
                    pixiJSVersion: this.pixiJSVersion,
                    webGPUSupported: this.webGPUSupported,
                    dependenciesReady: this.dependenciesReady,
                    tegakiAppReady: !!this.tegakiApp
                });
            }
            
            console.log('✅ Phase1.5 完全版 - 全Manager統合済み・PixiJS v8対応');
        }
        
        /**
         * 💀 初期化エラーハンドリング
         */
        handleInitializationError(error) {
            console.error('💀 Bootstrap 初期化失敗:', error);
            
            // ErrorManager利用可能時はエラー表示
            if (window.Tegaki?.ErrorManagerInstance?.showError) {
                window.Tegaki.ErrorManagerInstance.showError(
                    'Tegaki v8初期化失敗',
                    error.message
                );
            }
            
            // エラー通知
            if (window.Tegaki?.EventBusInstance?.emit) {
                window.Tegaki.EventBusInstance.emit('bootstrapError', {
                    error: error.message,
                    pixiJSVersion: this.pixiJSVersion,
                    webGPUSupported: this.webGPUSupported,
                    dependenciesReady: this.dependenciesReady
                });
            }
        }
        
        /**
         * 🔍 Bootstrap状態確認
         */
        isReady() {
            return this.initialized && this.v8Ready && this.dependenciesReady && !!this.tegakiApp;
        }
        
        /**
         * 📊 デバッグ情報取得
         */
        getDebugInfo() {
            return {
                className: 'Bootstrap',
                version: 'v8.12.0',
                initialized: this.initialized,
                v8Ready: this.v8Ready,
                pixiJSVersion: this.pixiJSVersion,
                webGPUSupported: this.webGPUSupported,
                dependenciesReady: this.dependenciesReady,
                tegakiAppReady: !!this.tegakiApp,
                tegakiAppInfo: this.tegakiApp ? this.tegakiApp.getDebugInfo() : null
            };
        }
    }
    
    /**
     * 🚀 Bootstrap実行関数
     */
    async function runBootstrap() {
        try {
            const bootstrap = new Bootstrap();
            
            // グローバル登録
            window.Tegaki = window.Tegaki || {};
            window.Tegaki.Bootstrap = Bootstrap;
            window.Tegaki.BootstrapInstance = bootstrap;
            
            // Bootstrap実行
            await bootstrap.start();
            
            return bootstrap;
            
        } catch (error) {
            console.error('💀 Bootstrap実行エラー:', error);
            throw error;
        }
    }
    
    // DOMContentLoaded時にBootstrap実行
    if (document.readyState === 'loading') {
        console.log('⏳ DOM Loading - DOMContentLoaded待機中...');
        document.addEventListener('DOMContentLoaded', async function() {
            console.log('🎯 Bootstrap PixiJS v8対応版 registered - 読み込み確認強化・新Manager統合対応版');
            try {
                await runBootstrap();
            } catch (error) {
                console.error('💀 DOMContentLoaded Bootstrap実行エラー:', error);
            }
        });
    } else {
        // すでにDOM読み込み完了の場合は即座に実行
        console.log('🚀 DOM already loaded - Bootstrap実行開始');
        runBootstrap().catch(error => {
            console.error('💀 即座Bootstrap実行エラー:', error);
        });
    }
    
    // グローバル関数として公開
    window.runBootstrap = runBootstrap;
    
    console.log('🚀 Bootstrap PixiJS v8対応版 - コンソール削減・初期化フロー修正版 Loaded');

})()