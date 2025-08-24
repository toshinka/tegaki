/**
 * 🎨 Tegaki Project - Main Application Entry Point (REV系・キャンバス表示問題解決版)
 * 🔧 REV系追加修正:
 * 1. Bootstrap依存関係完了待機システム
 * 2. キャンバスコンテナDOM確実性保証
 * 3. CanvasManager初期化引数修正
 * 4. エラー処理完全委譲システム
 */

// Tegaki名前空間初期化（既存）
window.Tegaki = window.Tegaki || {};

class TegakiApplication {
    constructor() {
        this.initialized = false;
        this.appCore = null;
        this.initializationError = null;
        
        // REV系: Bootstrap依存関係待機フラグ
        this.dependenciesLoaded = false;
        this.canvasElementReady = false;
        
        // 基本設定（既存）
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
        
        // REV系: Bootstrap依存関係完了待機
        this.setupBootstrapListeners();
    }

    /**
     * REV系: Bootstrap依存関係完了待機システム
     */
    setupBootstrapListeners() {
        window.addEventListener('tegaki:dependencies:loaded', () => {
            console.log('📦 Bootstrap依存関係読み込み完了');
            this.dependenciesLoaded = true;
            this.tryInitialize();
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
     * REV系: キャンバスコンテナ確実性チェック
     */
    checkCanvasContainerReady() {
        const container = document.getElementById('canvas-container');
        
        if (!container) {
            console.error('❌ #canvas-container が見つかりません');
            return false;
        }
        
        // DOM要素の基本プロパティ確認
        if (!container.offsetWidth || !container.offsetHeight) {
            console.warn('⚠️ キャンバスコンテナのサイズが0です');
            return false;
        }
        
        console.log(`✅ キャンバスコンテナ確認: ${container.offsetWidth}x${container.offsetHeight}px`);
        this.canvasElementReady = true;
        return true;
    }

    /**
     * REV系: 初期化条件確認・実行システム
     */
    async tryInitialize() {
        if (this.initialized) return;
        
        console.log('🔍 初期化条件確認中...');
        console.log(`  - 依存関係: ${this.dependenciesLoaded}`);
        console.log(`  - DOM準備: ${document.readyState}`);
        console.log(`  - キャンバス要素: ${this.checkCanvasContainerReady()}`);
        
        if (this.dependenciesLoaded && 
            document.readyState === 'complete' && 
            this.canvasElementReady) {
            
            console.log('✅ 全初期化条件満足 - 初期化開始');
            await this.initialize();
        } else {
            console.log('⏳ 初期化条件未満足 - 待機継続');
        }
    }

    /**
     * アプリケーション初期化（REV系・委譲専門版）
     */
    async initialize() {
        try {
            console.log('🎨 Tegaki REV系 初期化開始...');

            if (this.initialized) {
                console.warn('⚠️ TegakiApplication already initialized');
                return true;
            }

            // STEP 1: 初期化レジストリ実行
            this.executeInitializationRegistry();
            
            // STEP 2: AppCore初期化委譲
            await this.initializeAppCore();
            
            // STEP 3: 基本状態設定
            this.initialized = true;
            console.log('✅ Tegaki REV系 初期化完了');
            
            // 初期化完了イベント発火（ErrorManager経由での通知）
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
            
            return true;
            
        } catch (error) {
            console.error('❌ Tegaki初期化エラー:', error);
            this.initializationError = error;
            
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
     * REV系: AppCore初期化委譲（キャンバス表示問題修正版）
     */
    async initializeAppCore() {
        console.log('🎯 AppCore初期化中...');

        try {
            // REV系: キャンバスコンテナ確実取得
            const canvasContainer = document.getElementById('canvas-container');
            if (!canvasContainer) {
                throw new Error('キャンバスコンテナ#canvas-containerが見つかりません');
            }

            // AppCore取得または作成（既存）
            if (window.Tegaki?.AppCoreInstance) {
                this.appCore = window.Tegaki.AppCoreInstance;
            } else if (window.Tegaki?.AppCore) {
                this.appCore = new window.Tegaki.AppCore();
                window.Tegaki.AppCoreInstance = this.appCore;
            } else if (window.AppCore) {
                this.appCore = new window.AppCore();
                window.Tegaki.AppCoreInstance = this.appCore;
            } else {
                throw new Error('AppCoreが利用できません');
            }

            // REV系: CanvasManager初期化時の確実なDOM要素渡し
            if (this.appCore.canvasManager) {
                console.log('🔧 CanvasManager初期化（キャンバス表示問題修正版）');
                
                const initSuccess = await this.appCore.canvasManager.initialize({
                    appCore: this.appCore,
                    canvasElement: canvasContainer,  // 確実なDOM要素渡し
                    config: {
                        configManager: window.Tegaki.ConfigManagerInstance
                    }
                });
                
                if (!initSuccess) {
                    throw new Error('CanvasManager初期化失敗');
                }
                
                console.log('✅ CanvasManager初期化完了 - キャンバス表示確認');
                
                // キャンバス表示確認
                const canvas = canvasContainer.querySelector('canvas');
                if (canvas) {
                    console.log('🎨 キャンバス要素確認成功:', {
                        width: canvas.width,
                        height: canvas.height,
                        style: canvas.style.cssText
                    });
                } else {
                    console.warn('⚠️ キャンバス要素が見つかりませんが継続します');
                }
            }

            // AppCore初期化実行（既存）
            const success = await this.appCore.initialize();
            
            if (!success) {
                throw new Error('AppCore初期化がfalseを返しました');
            }
            
            console.log('✅ AppCore初期化完了');
            
        } catch (error) {
            console.error('❌ AppCore初期化エラー:', error);
            throw error; // 上位に再スロー
        }
    }

    /**
     * アプリケーション状態取得
     */
    getApplicationStatus() {
        return {
            version: 'Phase1.5-REV',
            initialized: this.initialized,
            dependenciesLoaded: this.dependenciesLoaded,
            canvasElementReady: this.canvasElementReady,
            appCore: this.appCore ? {
                initialized: this.appCore.initialized,
                managers: this.appCore.getManagerStatus ? this.appCore.getManagerStatus() : null
            } : null,
            initializationError: this.initializationError,
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
            initialized: this.initialized,
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
            if (!window.PIXI) issues.push('PIXI.js not available');
            if (!document.querySelector('canvas')) issues.push('Canvas element not present');
            
            // AppCoreチェック
            if (!this.appCore) {
                issues.push('AppCore not available');
            } else if (!this.appCore.initialized) {
                warnings.push('AppCore not initialized');
            }
            
            return {
                healthy: issues.length === 0,
                functional: issues.length === 0 && warnings.length < 3,
                issues,
                warnings,
                score: Math.max(0, 100 - (issues.length * 30) - (warnings.length * 10))
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
}

// Tegaki名前空間にクラス登録
window.Tegaki.TegakiApplication = TegakiApplication;

/**
 * REV系: DOM完了待機＋Bootstrap連携初期化システム
 */
document.addEventListener("DOMContentLoaded", function() {
    console.log('📋 DOMContentLoaded - REV系初期化開始');
    
    // アプリケーション作成
    const app = new window.Tegaki.TegakiApplication();
    window.Tegaki.AppInstance = app;
    
    // REV系: window load完了待機
    window.addEventListener('load', () => {
        console.log('📋 Window Load完了');
        app.tryInitialize();
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

// ========================================
// グローバル診断関数（委譲専門・最小限）
// ========================================

/**
 * 座標統合診断関数（委譲版）
 */
window.checkCoordinateIntegration = function() {
    console.log('🔍 座標統合診断開始...');
    
    const app = window.Tegaki?.AppInstance;
    if (!app) {
        console.warn('⚠️ アプリインスタンスが見つかりません');
        return { error: 'App instance not found' };
    }
    
    const state = app.getCoordinateIntegrationState();
    console.log('📊 座標統合状態:', state);
    
    // AppCore経由での詳細診断（委譲）
    if (app.appCore?.getCoordinateIntegrationState) {
        const appCoreState = app.appCore.getCoordinateIntegrationState();
        console.log('📊 AppCore座標統合状態:', appCoreState);
    }
    
    // CanvasManager経由での詳細診断（委譲）
    if (app.appCore?.canvasManager?.getCoordinateIntegrationState) {
        const canvasState = app.appCore.canvasManager.getCoordinateIntegrationState();
        console.log('📊 CanvasManager座標統合状態:', canvasState);
    }
    
    // 統合度スコア算出
    const totalChecks = Object.keys(state).length;
    const passedChecks = Object.values(state).filter(v => v === true || v !== null).length;
    const integrationScore = (passedChecks / totalChecks) * 100;
    
    console.log(`📈 統合度スコア: ${integrationScore.toFixed(1)}%`);
    
    if (integrationScore >= 80) {
        console.log('✅ 座標統合良好');
    } else if (integrationScore >= 60) {
        console.warn('⚠️ 座標統合に軽微な課題 - 基本動作可能');
    } else {
        console.warn('⚠️ 座標統合に重要な課題 - 動作確認推奨');
    }
    
    return { state, integrationScore };
};

/**
 * アプリケーション診断関数（委譲版）
 */
window.checkTegakiHealth = function() {
    console.log('🔍 Tegaki健全性診断開始...');
    
    const app = window.Tegaki?.AppInstance;
    if (!app) {
        console.error('❌ アプリインスタンスが見つかりません');
        return { healthy: false, error: 'App instance not found' };
    }
    
    const health = app.healthCheck();
    const status = app.getApplicationStatus();
    
    console.log('🏥 健全性チェック結果:', health);
    console.log('📊 アプリケーション状態:', status);
    
    if (health.healthy) {
        console.log('✅ Tegakiアプリケーション健全');
    } else if (health.functional) {
        console.warn('⚠️ 軽微な問題がありますが機能的です');
    } else {
        console.error('❌ 重要な問題があります');
    }
    
    return { health, status };
};

/**
 * REV系統合デバッグ関数
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
    console.log('  - AppCore初期化:', !!window.Tegaki?.AppCoreInstance?.initialized);
    console.log('  - CanvasManager:', !!window.Tegaki?.CanvasManagerInstance?.initialized);
    
    // 3. キャンバス表示確認
    console.log('3️⃣ キャンバス表示:');
    const container = document.getElementById('canvas-container');
    const canvas = container?.querySelector('canvas');
    console.log('  - コンテナサイズ:', container ? `${container.offsetWidth}x${container.offsetHeight}` : 'なし');
    console.log('  - キャンバス要素:', !!canvas);
    console.log('  - キャンバスサイズ:', canvas ? `${canvas.width}x${canvas.height}` : 'なし');
    
    // 4. 統一システム確認
    console.log('4️⃣ 統一システム:');
    const systems = ['ConfigManagerInstance', 'ErrorManagerInstance', 'StateManagerInstance', 'EventBusInstance'];
    systems.forEach(system => {
        console.log(`  - ${system}:`, !!window.Tegaki?.[system]);
    });
    
    // 5. 問題診断
    const issues = [];
    if (!window.Tegaki?.AppInstance?.dependenciesLoaded) issues.push('依存関係未完了');
    if (!document.getElementById('canvas-container')) issues.push('キャンバスコンテナなし');
    if (!canvas) issues.push('キャンバス要素なし');
    if (!window.Tegaki?.CanvasManagerInstance?.initialized) issues.push('CanvasManager未初期化');
    
    console.log('5️⃣ 問題診断:', issues.length > 0 ? issues : '問題なし');
    
    return {
        healthy: issues.length === 0,
        issues,
        canvasVisible: !!canvas,
        systemReady: !!window.Tegaki?.AppInstance?.initialized
    };
};

console.log('🎨 Tegaki Main (REV系・責任分界・キャンバス表示問題修正版) Loaded');