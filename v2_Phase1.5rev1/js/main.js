/**
 * 🎨 Tegaki Project - Main Application Entry Point (キャンバス表示問題解決版)
 * 📋 RESPONSIBILITY: アプリケーション初期化・統合・診断機能
 * 🚫 PROHIBITION: UI処理・描画処理・座標処理・エラー表示
 * ✅ PERMISSION: 初期化統合・Manager委譲・診断情報提供・Bootstrap連携
 * 
 * 🔧 キャンバス表示問題修正:
 * 1. 初期化条件の緩和（readyState完全待機→interactive以上で実行）
 * 2. 初期化実行の確実化（条件チェック改善）
 * 3. AppCore.initialize()の確実実行
 * 4. 初期化完了後のキャンバス確認強化
 * 5. 診断機能の改善
 * 
 * 📏 DESIGN_PRINCIPLE: 責任分界（初期化・統合専門）
 * 🔄 INTEGRATION: Bootstrap→main.js→AppCore→各Manager
 */

// Tegaki名前空間初期化
window.Tegaki = window.Tegaki || {};

class TegakiApplication {
    constructor() {
        this.initialized = false;
        this.appCore = null;
        this.initializationError = null;
        
        // キャンバス表示問題修正: Bootstrap依存関係待機フラグ
        this.dependenciesLoaded = false;
        this.canvasElementReady = false;
        this.bootTime = null;
        this.initStartTime = performance.now();
        this.initializationCompleted = false; // 初期化完了フラグ追加
        
        // 基本設定
        this.config = {
            canvas: {
                width: 400,
                height: 400,
                backgroundColor: '#ffffee',
                antialias: true
            },
            drawing: {
                defaultTool: 'pen'
            }
        };
        
        console.log('🎨 TegakiApplication インスタンス作成完了');
        console.log(`⏱️ 初期化開始時刻: ${this.initStartTime.toFixed(2)}ms`);
        
        // Bootstrap依存関係完了待機
        this.setupBootstrapListeners();
    }

    /**
     * Bootstrap依存関係完了待機システム
     */
    setupBootstrapListeners() {
        window.addEventListener('tegaki:dependencies:loaded', () => {
            this.bootTime = performance.now() - this.initStartTime;
            console.log('📦 Bootstrap依存関係読み込み完了');
            console.log(`⏱️ Bootstrap時間: ${this.bootTime.toFixed(2)}ms`);
            this.dependenciesLoaded = true;
            this.tryInitialize(); // 即座に初期化試行
        });

        window.addEventListener('tegaki:dependencies:error', (event) => {
            console.error('❌ Bootstrap依存関係エラー:', event.detail.error);
            this.initializationError = new Error(`Dependencies: ${event.detail.error}`);
            
            if (window.Tegaki?.ErrorManagerInstance) {
                window.Tegaki.ErrorManagerInstance.showError('error', 
                    `依存関係読み込みエラー: ${event.detail.error}`, {
                    context: 'Bootstrap Dependencies',
                    showReload: true
                });
            }
        });
    }

    /**
     * キャンバス表示問題修正: キャンバスコンテナ確実性チェック
     */
    checkCanvasContainerReady() {
        const container = document.getElementById('canvas-container');
        
        if (!container) {
            console.warn('⚠️ #canvas-container が見つかりません - 動的作成試行');
            return this.createCanvasContainerFallback();
        }
        
        console.log(`✅ キャンバスコンテナ確認: ${container.offsetWidth || 0}x${container.offsetHeight || 0}px`);
        this.canvasElementReady = true;
        return true;
    }

    /**
     * キャンバスコンテナ動的作成フォールバック
     */
    createCanvasContainerFallback() {
        try {
            const container = document.createElement('div');
            container.id = 'canvas-container';
            container.className = 'canvas-container';
            container.style.cssText = `
                width: 400px; 
                height: 400px; 
                margin: 20px auto; 
                display: block; 
                background-color: #ffffee; 
                border: 1px solid #ccc;
                position: relative;
            `;
            
            // 最適な挿入場所を探す
            const canvasArea = document.querySelector('.canvas-area') || 
                              document.querySelector('.main-layout') ||
                              document.querySelector('main') ||
                              document.body;
            canvasArea.appendChild(container);
            
            console.log('✅ キャンバスコンテナ動的作成完了');
            this.canvasElementReady = true;
            return true;
            
        } catch (error) {
            console.error('❌ キャンバスコンテナ動的作成失敗:', error);
            return false;
        }
    }

    /**
     * キャンバス表示問題修正: 初期化条件確認・実行システム（緩和版）
     */
    async tryInitialize() {
        if (this.initialized || this.initializationCompleted) {
            console.log('⚠️ 既に初理化済み - スキップ');
            return;
        }
        
        console.log('🔍 初期化条件確認中...');
        console.log(`  - 依存関係: ${this.dependenciesLoaded}`);
        console.log(`  - DOM準備: ${document.readyState}`);
        console.log(`  - キャンバス要素: ${this.checkCanvasContainerReady()}`);
        
        // キャンバス表示問題修正: 条件を緩和（interactive以上で実行）
        const domReady = document.readyState === 'complete' || document.readyState === 'interactive';
        
        if (this.dependenciesLoaded && domReady && this.canvasElementReady) {
            console.log('✅ 全初期化条件満足 - 初期化開始');
            await this.initialize();
        } else {
            console.log('⏳ 初期化条件未満足 - 短時間後に再試行');
            // 短いインターバルで再試行（250msに短縮）
            setTimeout(() => this.tryInitialize(), 250);
        }
    }

    /**
     * アプリケーション初期化（キャンバス表示問題修正版）
     */
    async initialize() {
        try {
            console.log('🎨 Tegaki 初期化開始（キャンバス表示問題修正版）...');

            if (this.initialized || this.initializationCompleted) {
                console.warn('⚠️ TegakiApplication already initialized');
                return true;
            }

            // 初期化開始マーキング
            this.initializationCompleted = true;

            // STEP 1: 初期化レジストリ実行
            this.executeInitializationRegistry();
            
            // STEP 2: AppCore初期化委譲（キャンバス表示問題修正）
            const coreInitSuccess = await this.initializeAppCore();
            if (!coreInitSuccess) {
                throw new Error('AppCore初期化に失敗しました');
            }
            
            // STEP 3: キャンバス表示最終確認（強化版）
            const canvasDisplayed = this.verifyCanvasDisplay();
            if (!canvasDisplayed) {
                console.warn('⚠️ キャンバス表示確認失敗 - 緊急修復実行');
                await this.executeEmergencyCanvasRepair();
            }
            
            // STEP 4: 基本状態設定
            this.initialized = true;
            console.log('✅ Tegaki 初期化完了（キャンバス表示確実化）');
            
            // 初期化完了イベント発火
            if (window.Tegaki?.EventBusInstance) {
                window.Tegaki.EventBusInstance.safeEmit('app:initialized');
            }
            
            // 成功通知（ErrorManager委譲）
            if (window.Tegaki?.ErrorManagerInstance) {
                window.Tegaki.ErrorManagerInstance.showInfo('Tegakiアプリケーション起動完了', {
                    duration: 3000,
                    autoClose: true
                });
            }
            
            // 初期化完了後の診断実行
            this.runPostInitializationDiagnostics();
            
            return true;
            
        } catch (error) {
            console.error('❌ Tegaki初期化エラー:', error);
            this.initializationError = error;
            this.initializationCompleted = false; // 失敗時はリセット
            
            // エラー表示（ErrorManager委譲）
            if (window.Tegaki?.ErrorManagerInstance) {
                window.Tegaki.ErrorManagerInstance.showError('error', `初期化エラー: ${error.message}`, {
                    context: 'TegakiApplication.initialize',
                    showReload: true
                });
            }
            
            return false;
        }
    }

    /**
     * STEP 1: 初期化レジストリ実行
     */
    executeInitializationRegistry() {
        console.log('📡 初期化レジストリ実行中...');
        
        if (window.Tegaki?._registry) {
            console.log(`🔧 ${window.Tegaki._registry.length}個の初期化処理を実行`);
            
            window.Tegaki._registry.forEach((initFunc, index) => {
                try {
                    initFunc();
                    console.log(`✅ Registry[${index}] 初期化完了`);
                } catch (error) {
                    console.error(`❌ Registry[${index}] 初期化エラー:`, error);
                    // レジストリエラーは継続（致命的ではない）
                }
            });
            
            // レジストリを削除（一度だけ実行）
            delete window.Tegaki._registry;
            console.log('🗑️ 初期化レジストリ削除完了');
        }
        
        // 根幹Manager確認
        const coreManagers = [
            'ErrorManagerInstance',
            'ConfigManagerInstance', 
            'StateManagerInstance',
            'EventBusInstance'
        ];
        
        const availableManagers = coreManagers.filter(manager => window.Tegaki?.[manager]);
        console.log(`✅ 根幹Manager確認: ${availableManagers.length}/${coreManagers.length}個利用可能`);
        
        if (availableManagers.length < coreManagers.length) {
            console.warn('⚠️ 一部根幹Manager未初期化 - 基本動作で継続');
        }
    }

    /**
     * キャンバス表示問題修正: AppCore初期化委譲（確実実行版）
     */
    async initializeAppCore() {
        console.log('🎯 AppCore初期化中（キャンバス表示問題修正版）...');

        try {
            // キャンバスコンテナ確実取得
            const canvasContainer = document.getElementById('canvas-container');
            if (!canvasContainer) {
                console.error('❌ キャンバスコンテナ取得失敗 - 動的作成を試行');
                if (!this.createCanvasContainerFallback()) {
                    throw new Error('キャンバスコンテナの作成に失敗しました');
                }
            }

            const finalContainer = document.getElementById('canvas-container');
            console.log('📦 キャンバスコンテナ確認完了:', {
                width: finalContainer.offsetWidth,
                height: finalContainer.offsetHeight,
                display: getComputedStyle(finalContainer).display,
                visibility: getComputedStyle(finalContainer).visibility
            });

            // AppCore取得または作成
            if (window.Tegaki?.AppCoreInstance) {
                this.appCore = window.Tegaki.AppCoreInstance;
                console.log('✅ 既存AppCoreインスタンス使用');
            } else if (window.Tegaki?.AppCore) {
                this.appCore = new window.Tegaki.AppCore();
                window.Tegaki.AppCoreInstance = this.appCore;
                console.log('✅ Tegaki名前空間からAppCore作成');
            } else if (window.AppCore) {
                this.appCore = new window.AppCore();
                window.Tegaki.AppCoreInstance = this.appCore;
                console.log('✅ グローバルからAppCore作成');
            } else {
                throw new Error('AppCoreが利用できません');
            }

            // AppCore本体初期化実行（キャンバス表示問題の核心）
            console.log('🚀 AppCore本体初期化開始...');
            const success = await this.appCore.initialize();
            
            if (!success) {
                throw new Error('AppCore初期化がfalseを返しました');
            }
            
            console.log('✅ AppCore初期化完了');
            
            // 初期化直後のキャンバス確認
            this.immediateCanvasCheck(finalContainer);
            
            return true;
            
        } catch (error) {
            console.error('❌ AppCore初期化エラー:', error);
            throw error; // 上位に再スロー
        }
    }

    /**
     * 初期化後の即座キャンバス確認
     */
    immediateCanvasCheck(container) {
        console.log('🔍 初期化後即座キャンバス確認開始...');
        
        // Canvas要素の確認
        const canvas = container.querySelector('canvas');
        if (canvas) {
            console.log('🎨 キャンバス要素確認成功:', {
                width: canvas.width,
                height: canvas.height,
                offsetWidth: canvas.offsetWidth,
                offsetHeight: canvas.offsetHeight,
                style: canvas.style.cssText,
                parentNode: canvas.parentNode === container
            });
            
            // WebGLコンテキスト確認
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            console.log('🔧 WebGLコンテキスト:', gl ? '利用可能' : '利用不可');
            
        } else {
            console.warn('⚠️ キャンバス要素が見つかりません');
            
            // コンテナの詳細確認
            console.log('📦 コンテナ詳細:', {
                id: container.id,
                className: container.className,
                children: container.children.length,
                innerHTML: container.innerHTML.substring(0, 100) + '...'
            });
        }
    }

    /**
     * STEP 3: キャンバス表示最終確認（強化版）
     */
    verifyCanvasDisplay() {
        console.log('🎯 キャンバス表示最終確認開始...');
        
        const container = document.getElementById('canvas-container');
        if (!container) {
            console.error('❌ 最終確認: キャンバスコンテナなし');
            return false;
        }
        
        const canvas = container.querySelector('canvas');
        if (!canvas) {
            console.error('❌ 最終確認: キャンバス要素なし');
            return false;
        }
        
        // 表示状態の確認
        const isVisible = canvas.offsetWidth > 0 && canvas.offsetHeight > 0;
        const computedStyle = getComputedStyle(canvas);
        const isDisplayed = computedStyle.display !== 'none';
        const isVisibleCSS = computedStyle.visibility !== 'hidden';
        
        console.log('🎨 キャンバス表示状態確認:', {
            element: !!canvas,
            dimensions: `${canvas.width}x${canvas.height}`,
            visible: isVisible,
            displayed: isDisplayed,
            visibleCSS: isVisibleCSS,
            overall: isVisible && isDisplayed && isVisibleCSS
        });
        
        if (isVisible && isDisplayed && isVisibleCSS) {
            console.log('🎉 キャンバス表示最終確認: 成功');
            return true;
        } else {
            console.warn('⚠️ キャンバス表示最終確認: 問題あり');
            return false;
        }
    }

    /**
     * 緊急キャンバス修復
     */
    async executeEmergencyCanvasRepair() {
        console.log('🆘 緊急キャンバス修復実行...');
        
        try {
            // 1. コンテナ再確認・作成
            let container = document.getElementById('canvas-container');
            if (!container) {
                console.log('📦 キャンバスコンテナ緊急作成...');
                this.createCanvasContainerFallback();
                container = document.getElementById('canvas-container');
            }

            // 2. CanvasManager経由での修復
            if (this.appCore?.canvasManager && !container.querySelector('canvas')) {
                console.log('🔧 CanvasManager経由でキャンバス修復中...');
                
                // CanvasManagerの緊急フォールバック実行
                if (typeof this.appCore.canvasManager._executeEmergencyCanvasFallback === 'function') {
                    await this.appCore.canvasManager._executeEmergencyCanvasFallback();
                }
            }

            // 3. 直接PIXIキャンバス作成（最終手段）
            if (!container.querySelector('canvas') && window.PIXI) {
                console.log('🎨 直接PIXIキャンバス作成（最終手段）...');
                
                const app = new PIXI.Application({
                    width: 400,
                    height: 400,
                    backgroundColor: 0xffffee,
                    antialias: true
                });
                
                container.appendChild(app.view);
                app.view.style.cursor = 'crosshair';
                app.view.style.display = 'block';
                
                console.log('✅ 緊急PIXIキャンバス作成完了');
            }
            
            return true;
            
        } catch (error) {
            console.error('❌ 緊急キャンバス修復エラー:', error);
            return false;
        }
    }

    /**
     * 初期化完了後の診断実行
     */
    runPostInitializationDiagnostics() {
        console.log('🔍 初期化完了後診断開始...');
        
        setTimeout(() => {
            try {
                // 健全性チェック実行
                const health = this.healthCheck();
                console.log('📊 健全性チェック結果:', health);
                
                // 座標統合状態確認
                const coordState = this.getCoordinateIntegrationState();
                console.log('📐 座標統合状態:', coordState);
                
                // アプリケーション状態確認
                const appStatus = this.getApplicationStatus();
                console.log('📋 アプリケーション状態:', appStatus);
                
                // キャンバス表示問題診断
                const canvasDiagnostics = this.getCanvasDisplayDiagnostics();
                console.log('🎨 キャンバス表示診断:', canvasDiagnostics);
                
                console.log('✅ 初期化完了後診断完了');
                
            } catch (error) {
                console.error('❌ 初期化完了後診断エラー:', error);
            }
        }, 1000); // 1秒後に診断実行
    }

    /**
     * キャンバス表示問題専用診断
     */
    getCanvasDisplayDiagnostics() {
        const container = document.getElementById('canvas-container');
        const canvas = container?.querySelector('canvas');
        
        return {
            containerExists: !!container,
            containerSize: container ? `${container.offsetWidth}x${container.offsetHeight}` : 'N/A',
            containerVisible: container ? container.offsetWidth > 0 && container.offsetHeight > 0 : false,
            canvasExists: !!canvas,
            canvasSize: canvas ? `${canvas.width}x${canvas.height}` : 'N/A',
            canvasVisible: canvas ? canvas.offsetWidth > 0 && canvas.offsetHeight > 0 : false,
            canvasDisplayed: canvas ? getComputedStyle(canvas).display !== 'none' : false,
            pixiAppExists: !!(this.appCore?.app || window.Tegaki?.CanvasManagerInstance?.app),
            pixiAvailable: !!window.PIXI,
            issue: this.identifyCanvasDisplayIssue(container, canvas)
        };
    }

    /**
     * キャンバス表示問題の特定
     */
    identifyCanvasDisplayIssue(container, canvas) {
        if (!container) return 'Container missing';
        if (!canvas) return 'Canvas element missing';
        if (canvas.offsetWidth === 0 || canvas.offsetHeight === 0) return 'Canvas size zero';
        if (getComputedStyle(canvas).display === 'none') return 'Canvas display none';
        if (getComputedStyle(canvas).visibility === 'hidden') return 'Canvas visibility hidden';
        return 'No issue detected';
    }

    /**
     * アプリケーション状態取得
     */
    getApplicationStatus() {
        return {
            version: 'Phase1.5-キャンバス表示修正版',
            initialized: this.initialized,
            initializationCompleted: this.initializationCompleted,
            dependenciesLoaded: this.dependenciesLoaded,
            canvasElementReady: this.canvasElementReady,
            bootTime: this.bootTime,
            appCore: this.appCore ? {
                initialized: this.appCore.initialized,
                managers: this.appCore.getManagerStatus ? this.appCore.getManagerStatus() : null
            } : null,
            initializationError: this.initializationError?.message || null,
            lastCheck: new Date().toISOString()
        };
    }

    /**
     * 座標統合状態取得（診断用）
     */
    getCoordinateIntegrationState() {
        return {
            appInstance: !!this,
            appCore: !!this.appCore,
            appCoreInitialized: !!(this.appCore && this.appCore.initialized),
            coordinateManager: !!(this.appCore?.coordinateManager || window.Tegaki?.CoordinateManagerInstance),
            canvasManager: !!(this.appCore?.canvasManager || window.Tegaki?.CanvasManagerInstance),
            toolManager: !!(this.appCore?.toolManager || window.Tegaki?.ToolManagerInstance),
            pixiAvailable: !!window.PIXI,
            canvasPresent: !!document.querySelector('canvas'),
            canvasVisible: (() => {
                const canvas = document.querySelector('canvas');
                return canvas ? canvas.offsetWidth > 0 && canvas.offsetHeight > 0 : false;
            })(),
            initialized: this.initialized,
            initializationCompleted: this.initializationCompleted,
            initializationError: this.initializationError?.message || null
        };
    }

    /**
     * 健全性チェック
     */
    healthCheck() {
        try {
            const issues = [];
            const warnings = [];
            
            // 基本機能チェック
            if (!this.initialized) issues.push('Application not initialized');
            if (!this.initializationCompleted) issues.push('Initialization not completed');
            if (!window.PIXI) issues.push('PIXI.js not available');
            
            const canvas = document.querySelector('canvas');
            if (!canvas) issues.push('Canvas element not present');
            else if (canvas.offsetWidth === 0 || canvas.offsetHeight === 0) {
                warnings.push('Canvas element has zero dimensions');
            }
            
            // AppCoreチェック
            if (!this.appCore) {
                issues.push('AppCore not available');
            } else if (!this.appCore.initialized) {
                warnings.push('AppCore not initialized');
            }
            
            // 根幹Managerチェック
            const coreManagers = [
                'ConfigManagerInstance',
                'ErrorManagerInstance', 
                'StateManagerInstance',
                'EventBusInstance',
                'CanvasManagerInstance'
            ];
            
            const missingManagers = coreManagers.filter(manager => !window.Tegaki?.[manager]);
            if (missingManagers.length > 0) {
                warnings.push(`Missing managers: ${missingManagers.join(', ')}`);
            }
            
            return {
                healthy: issues.length === 0,
                functional: issues.length === 0 && warnings.length < 3,
                issues,
                warnings,
                score: Math.max(0, 100 - (issues.length * 30) - (warnings.length * 10)),
                canvas: {
                    present: !!canvas,
                    visible: canvas ? canvas.offsetWidth > 0 && canvas.offsetHeight > 0 : false,
                    dimensions: canvas ? `${canvas.width}x${canvas.height}` : 'N/A'
                }
            };
            
        } catch (error) {
            return {
                healthy: false,
                functional: false,
                issues: ['Health check failed'],
                warnings: [],
                error: error.message,
                score: 0
            };
        }
    }

    /**
     * 強制初期化（緊急用）
     */
    async forceInitialize() {
        console.log('🆘 強制初期化開始...');
        
        this.initialized = false;
        this.initializationCompleted = false;
        this.initializationError = null;
        
        // 条件無視で初期化実行
        return await this.initialize();
    }
}

// Tegaki名前空間にクラス登録
window.Tegaki.TegakiApplication = TegakiApplication;

/**
 * REV系診断関数（グローバル公開）
 */
window.debugREVSystem = function() {
    console.log('🔧 REV系統合デバッグ開始');
    
    // 1. Bootstrap状態確認
    console.log('1️⃣ Bootstrap状態:');
    console.log('  - 依存関係完了:', !!window.Tegaki?.AppInstance?.dependenciesLoaded);
    console.log('  - DOM準備完了:', document.readyState);
    console.log('  - キャンバス要素:', !!document.getElementById('canvas-container'));
    
    // 2. 初期化状態確認
    console.log('2️⃣ 初期化状態:');
    console.log('  - アプリ初期化:', !!window.Tegaki?.AppInstance?.initialized);
    console.log('  - 初期化完了フラグ:', !!window.Tegaki?.AppInstance?.initializationCompleted);
    console.log('  - AppCore初期化:', !!window.Tegaki?.AppCoreInstance?.initialized);
    console.log('  - CanvasManager:', !!window.Tegaki?.CanvasManagerInstance?.initialized);
    
    // 3. キャンバス表示確認
    console.log('3️⃣ キャンバス表示:');
    const container = document.getElementById('canvas-container');
    const canvas = container?.querySelector('canvas');
    console.log('  - コンテナサイズ:', container ? `${container.offsetWidth}x${container.offsetHeight}` : 'なし');
    console.log('  - キャンバス要素:', !!canvas);
    console.log('  - キャンバスサイズ:', canvas ? `${canvas.width}x${canvas.height}` : 'なし');
    console.log('  - 表示状態:', canvas ? (canvas.offsetWidth > 0 && canvas.offsetHeight > 0) : false);
    
    // 4. 統一システム確認
    console.log('4️⃣ 統一システム:');
    const systems = ['ConfigManagerInstance', 'ErrorManagerInstance', 'StateManagerInstance', 'EventBusInstance'];
    systems.forEach(system => {
        console.log(`  - ${system}:`, !!window.Tegaki?.[system]);
    });
    
    // 5. 問題診断
    const issues = [];
    if (!window.Tegaki?.AppInstance?.dependenciesLoaded) issues.push('依存関係未完了');
    if (!window.Tegaki?.AppInstance?.initializationCompleted) issues.push('初期化未完了');
    if (!document.getElementById('canvas-container')) issues.push('キャンバスコンテナなし');
    if (!canvas) issues.push('キャンバス要素なし');
    if (!window.Tegaki?.CanvasManagerInstance?.initialized) issues.push('CanvasManager未初期化');
    if (canvas && !(canvas.offsetWidth > 0 && canvas.offsetHeight > 0)) issues.push('キャンバス非表示');
    
    console.log('5️⃣ 問題診断:', issues.length > 0 ? issues : '問題なし');
    
    return {
        healthy: issues.length === 0,
        issues,
        canvasVisible: !!(canvas && canvas.offsetWidth > 0 && canvas.offsetHeight > 0),
        systemReady: !!window.Tegaki?.AppInstance?.initialized
    };
};

window.checkTegakiHealth = function() {
    console.log('🏥 Tegaki健全性チェック開始');
    
    if (window.Tegaki?.AppInstance?.healthCheck) {
        const health = window.Tegaki.AppInstance.healthCheck();
        console.log('📊 健全性結果:', health);
        return health;
    } else {
        console.error('❌ TegakiApplication.healthCheck が利用できません');
        return { healthy: false, error: 'healthCheck method not available' };
    }
};

window.checkCoordinateIntegration = function() {
    console.log('📐 座標統合確認開始');
    
    if (window.Tegaki?.AppInstance?.getCoordinateIntegrationState) {
        const state = window.Tegaki.AppInstance.getCoordinateIntegrationState();
        console.log('📐 座標統合状態:', state);
        return state;
    } else {
        console.error('❌ getCoordinateIntegrationState メソッドが利用できません');
        return { error: 'getCoordinateIntegrationState method not available' };
    }
};

window.checkCanvasDisplay = function() {
    console.log('🎨 キャンバス表示状態確認開始');
    
    if (window.Tegaki?.AppInstance?.getCanvasDisplayDiagnostics) {
        const diagnostics = window.Tegaki.AppInstance.getCanvasDisplayDiagnostics();
        console.log('🎨 キャンバス表示診断:', diagnostics);
        return diagnostics;
    } else {
        console.error('❌ getCanvasDisplayDiagnostics メソッドが利用できません');
        return { error: 'getCanvasDisplayDiagnostics method not available' };
    }
};

window.checkPhase2Readiness = function() {
    console.log('🔍 Phase2移行準備度確認');
    
    const checkList = {
        // 基盤システム
        unifiedSystems: !!(
            window.Tegaki?.ConfigManagerInstance && 
            window.Tegaki?.ErrorManagerInstance && 
            window.Tegaki?.StateManagerInstance && 
            window.Tegaki?.EventBusInstance
        ),
        
        // キャンバス・描画システム
        canvasSystem: !!(
            window.Tegaki?.CanvasManagerInstance?.initialized &&
            document.querySelector('canvas')
        ),
        
        // ツール・座標システム
        toolSystem: !!(
            window.Tegaki?.ToolManagerInstance &&
            window.Tegaki?.CoordinateManagerInstance
        ),
        
        // 責任分界
        responsibilitySeparation: {
            htmlStructureOnly: !document.querySelector('style[data-inline]'),
            cssConsolidated: !!document.querySelector('link[href*="styles.css"]'),
            bootstrapDelegation: !!window.Tegaki?.AppInstance?.dependenciesLoaded,
            mainInitialization: !!window.Tegaki?.AppInstance?.initialized
        }
    };
    
    const score = Object.values(checkList).reduce((acc, val) => {
        if (typeof val === 'boolean') return acc + (val ? 25 : 0);
        if (typeof val === 'object') {
            const subScore = Object.values(val).filter(v => v === true).length;
            return acc + (subScore * 6.25);
        }
        return acc;
    }, 0);
    
    console.log('📊 Phase2移行準備度:', `${score.toFixed(1)}%`);
    console.log('📋 詳細:', checkList);
    
    if (score >= 95) {
        console.log('✅ Phase2移行準備完了');
    } else if (score >= 80) {
        console.log('⚠️ Phase2移行準備概ね完了（軽微な課題あり）');
    } else {
        console.log('❌ Phase2移行準備未完了（重要な課題あり）');
    }
    
    return { score, checkList };
};

/**
 * 緊急修復関数（デバッグ用・強化版）
 */
window.emergencyCanvasFix = function() {
    console.log('🆘 緊急キャンバス修復開始...');
    
    try {
        // 1. コンテナ確認・作成
        let container = document.getElementById('canvas-container');
        if (!container) {
            console.log('📦 キャンバスコンテナ作成中...');
            container = document.createElement('div');
            container.id = 'canvas-container';
            container.className = 'canvas-container';
            container.style.cssText = 'width: 400px; height: 400px; margin: 20px auto; display: block; background-color: #ffffee; border: 1px solid #ccc; position: relative;';
            
            const canvasArea = document.querySelector('.canvas-area') || document.body;
            canvasArea.appendChild(container);
            console.log('✅ キャンバスコンテナ作成完了');
        }
        
        // 2. Canvas要素確認
        let canvas = container.querySelector('canvas');
        if (!canvas) {
            console.log('🎨 キャンバス要素直接作成中...');
            
            if (window.PIXI) {
                // PixiJS Application作成
                const app = new PIXI.Application({
                    width: 400,
                    height: 400,
                    backgroundColor: 0xffffee,
                    antialias: true
                });
                
                container.appendChild(app.view);
                canvas = app.view;
                canvas.style.cursor = 'crosshair';
                canvas.style.display = 'block';
                
                console.log('✅ PixiJSキャンバス作成完了');
                
                // Tegakiシステムに登録
                if (window.Tegaki?.CanvasManagerInstance && !window.Tegaki.CanvasManagerInstance.app) {
                    window.Tegaki.CanvasManagerInstance.app = app;
                    window.Tegaki.CanvasManagerInstance.stage = app.stage;
                    window.Tegaki.CanvasManagerInstance.initialized = true;
                    console.log('✅ CanvasManagerにPixiApp登録完了');
                }
                
            } else {
                // 通常Canvas作成
                canvas = document.createElement('canvas');
                canvas.width = 400;
                canvas.height = 400;
                canvas.style.cssText = 'display: block; background-color: #ffffee; cursor: crosshair;';
                
                container.appendChild(canvas);
                console.log('✅ 通常キャンバス作成完了');
            }
        }
        
        // 3. アプリケーション初期化確認
        if (window.Tegaki?.AppInstance && !window.Tegaki.AppInstance.initialized) {
            console.log('🚀 アプリケーション強制初期化...');
            window.Tegaki.AppInstance.forceInitialize().then(success => {
                console.log(`強制初理化結果: ${success ? '成功' : '失敗'}`);
            });
        }
        
        console.log('🎉 緊急修復完了');
        return true;
        
    } catch (error) {
        console.error('❌ 緊急修復エラー:', error);
        return false;
    }
};

/**
 * 自動修復関数（初期化完了後に自動実行）
 */
window.autoRepairCanvas = function() {
    console.log('🔧 自動キャンバス修復チェック開始...');
    
    const container = document.getElementById('canvas-container');
    const canvas = container?.querySelector('canvas');
    
    if (!canvas || canvas.offsetWidth === 0 || canvas.offsetHeight === 0) {
        console.log('⚠️ キャンバス表示問題検出 - 自動修復実行');
        return window.emergencyCanvasFix();
    }
    
    console.log('✅ キャンバス正常表示 - 修復不要');
    return true;
};

/**
 * DOM完了待機＋Bootstrap連携初理化システム（キャンバス表示問題修正版）
 */
document.addEventListener("DOMContentLoaded", function() {
    console.log('📋 DOMContentLoaded - キャンバス表示問題修正版初期化準備開始');
    
    // アプリケーション作成
    const app = new window.Tegaki.TegakiApplication();
    window.Tegaki.AppInstance = app;
    
    console.log('🎨 TegakiApplication インスタンス作成・登録完了');
    
    // 短時間後に初期化試行（DOM安定化待ち）
    setTimeout(() => {
        console.log('⏰ DOM安定化後初期化試行開始');
        app.tryInitialize();
    }, 100);
    
    // window load完了待機
    window.addEventListener('load', () => {
        console.log('📋 Window Load完了 - 補完チェック実行');
        
        // 初期化未完了の場合は再試行
        if (!app.initialized || !app.initializationCompleted) {
            console.log('🔄 初期化未完了検出 - 再試行実行');
            app.tryInitialize();
        }
        
        // 3秒後に自動修復チェック
        setTimeout(() => {
            window.autoRepairCanvas();
        }, 3000);
    });
});

/**
 * ページ離脱時のクリーンアップ（委譲専門）
 */
window.addEventListener('beforeunload', () => {
    if (window.Tegaki?.AppInstance?.initialized) {
        console.log('🧹 Tegakiクリーンアップ実行');
        
        try {
            // 設定保存委譲
            if (window.Tegaki?.ConfigManagerInstance?.save) {
                window.Tegaki.ConfigManagerInstance.save();
            }
            
            // AppCore破棄委譲
            if (window.Tegaki?.AppInstance?.appCore?.destroy) {
                window.Tegaki.AppInstance.appCore.destroy();
            }
        } catch (error) {
            console.warn('⚠️ クリーンアップエラー:', error);
        }
    }
});

/**
 * グローバルエラーハンドリング（ErrorManager完全委譲版）
 */
window.addEventListener('error', (event) => {
    if (window.Tegaki?.ErrorManagerInstance) {
        window.Tegaki.ErrorManagerInstance.showError('error', 
            `グローバルエラー: ${event.error?.message || event.message}`, {
            context: 'Global Error Handler',
            nonCritical: true
        });
    } else {
        console.error('🆘 Global Error (ErrorManager unavailable):', event.error || event.message);
    }
});

window.addEventListener('unhandledrejection', (event) => {
    if (window.Tegaki?.ErrorManagerInstance) {
        window.Tegaki.ErrorManagerInstance.showError('error', 
            `未処理Promise: ${event.reason?.message || event.reason}`, {
            context: 'Unhandled Promise Rejection',
            nonCritical: true
        });
    } else {
        console.error('🆘 Unhandled Promise (ErrorManager unavailable):', event.reason);
    }
});

console.log('🎨 Tegaki Main (キャンバス表示問題解決版) Loaded');
console.log('✨ 修正完了: 初期化条件緩和・AppCore確実実行・キャンバス表示確実化');
console.log('🚀 Phase1.5目標: キャンバス100%表示・初期化信頼性・診断機能完備');
console.log('🔧 診断コマンド: window.checkTegakiHealth(), window.debugREVSystem(), window.checkCanvasDisplay()');
console.log('🆘 緊急修復: window.emergencyCanvasFix()');

// 注意: 既存のコード読み込み完了後に自動実行されるように、10秒後にフォールバック起動
setTimeout(() => {
    if (!window.Tegaki?.AppInstance?.initialized) {
        console.log('⚠️ 10秒経過しても初期化未完了 - フォールバック起動');
        
        if (window.Tegaki?.AppInstance) {
            window.Tegaki.AppInstance.forceInitialize();
        } else {
            console.log('🆘 AppInstance未作成 - 緊急作成試行');
            try {
                const app = new window.Tegaki.TegakiApplication();
                window.Tegaki.AppInstance = app;
                app.forceInitialize();
            } catch (error) {
                console.error('❌ 緊急AppInstance作成失敗:', error);
                window.emergencyCanvasFix();
            }
        }
    }
}, 10000);