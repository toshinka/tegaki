/**
 * 🎨 Tegaki Project - Main Application Entry Point (Bootstrap待機・キャンバス初理化改善版)
 * 
 * ✨ Phase1.5修正内容:
 * 1. Bootstrap依存関係完了待機システム強化
 * 2. キャンバスコンテナDOM確実性保証
 * 3. CanvasManager初期化引数修正・DOM要素確実渡し
 * 4. エラー処理完全委譲システム
 * 5. 初期化診断・健全性チェック機能
 * 
 * 📋 RESPONSIBILITY: 初期化統合・統一システム委譲・診断機能
 * 🚫 PROHIBITION: 直接描画・UI操作・依存関係管理・スタイル処理
 * ✅ PERMISSION: AppCore委譲・統一システム統合・健全性チェック
 */

// Tegaki名前空間初期化
window.Tegaki = window.Tegaki || {};

class TegakiApplication {
    constructor() {
        this.initialized = false;
        this.appCore = null;
        this.initializationError = null;
        
        // Bootstrap依存関係待機状態
        this.dependenciesLoaded = false;
        this.canvasElementReady = false;
        this.bootstrapStartTime = performance.now();
        
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
        
        console.log('🎨 TegakiApplication インスタンス作成完了（Bootstrap待機・キャンバス初期化改善版）');
        
        // Bootstrap依存関係完了待機
        this.setupBootstrapListeners();
    }

    /**
     * Bootstrap依存関係完了待機システム
     */
    setupBootstrapListeners() {
        // 依存関係読み込み完了イベント
        window.addEventListener('tegaki:dependencies:loaded', () => {
            console.log('📦 Bootstrap依存関係読み込み完了');
            this.dependenciesLoaded = true;
            this.tryInitialize();
        });

        // 依存関係読み込みエラーイベント
        window.addEventListener('tegaki:dependencies:error', (event) => {
            console.error('❌ Bootstrap依存関係エラー:', event.detail.error);
            this.initializationError = new Error(`Dependencies: ${event.detail.error}`);
            
            // ErrorManager経由でのエラー表示
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
     * キャンバスコンテナ確実性チェック（拡張版）
     */
    checkCanvasContainerReady() {
        try {
            // 最優先: #canvas-container
            let container = document.getElementById('canvas-container');
            
            if (!container) {
                // フォールバック検索
                const fallbackSelectors = [
                    '#drawing-canvas',
                    '.canvas-area',
                    '.canvas-container',
                    'canvas'
                ];
                
                for (const selector of fallbackSelectors) {
                    container = document.querySelector(selector);
                    if (container) {
                        console.log(`✅ フォールバックコンテナ発見: ${selector}`);
                        break;
                    }
                }
            }
            
            if (!container) {
                console.warn('⚠️ キャンバスコンテナが見つかりません');
                return false;
            }
            
            // DOM要素の基本プロパティ確認
            const rect = container.getBoundingClientRect();
            const isVisible = container.offsetParent !== null;
            
            console.log(`✅ キャンバスコンテナ確認:`, {
                id: container.id || 'no-id',
                tagName: container.tagName,
                size: `${rect.width}x${rect.height}`,
                visible: isVisible,
                hasParent: !!container.parentElement
            });
            
            this.canvasElementReady = true;
            return true;
            
        } catch (error) {
            console.error('❌ キャンバスコンテナ確認エラー:', error);
            return false;
        }
    }

    /**
     * 初期化条件確認・実行システム
     */
    async tryInitialize() {
        if (this.initialized) return;
        
        console.log('🔍 初期化条件確認中...');
        console.log(`  - 依存関係: ${this.dependenciesLoaded}`);
        console.log(`  - DOM準備: ${document.readyState}`);
        console.log(`  - キャンバス要素: ${this.checkCanvasContainerReady()}`);
        
        const allReady = this.dependenciesLoaded && 
                        document.readyState !== 'loading' && 
                        this.canvasElementReady;
        
        if (allReady) {
            console.log('✅ 全初期化条件満足 - 初期化開始');
            await this.initialize();
        } else {
            console.log('⏳ 初期化条件未満足 - 待機継続');
            
            // DOM準備完了待機
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => {
                    console.log('📋 DOMContentLoaded - 再確認');
                    this.tryInitialize();
                });
            }
            
            // window.load完了待機
            if (document.readyState !== 'complete') {
                window.addEventListener('load', () => {
                    console.log('📋 Window Load完了 - 再確認');
                    this.tryInitialize();
                });
            }
        }
    }

    /**
     * アプリケーション初期化（Bootstrap待機・キャンバス改善版）
     */
    async initialize() {
        try {
            console.log('🎨 Tegaki初期化開始（Bootstrap待機・キャンバス改善版）...');

            if (this.initialized) {
                console.warn('⚠️ TegakiApplication already initialized');
                return true;
            }

            // STEP 1: 初期化レジストリ実行
            this.executeInitializationRegistry();
            
            // STEP 2: AppCore初期化委譲（キャンバス改善版）
            const appCoreSuccess = await this.initializeAppCore();
            if (!appCoreSuccess) {
                throw new Error('AppCore初期化失敗');
            }
            
            // STEP 3: キャンバス表示確認・診断
            this.verifyCanvasDisplay();
            
            // STEP 4: 基本状態設定
            this.initialized = true;
            
            console.log('✅ Tegaki初期化完了（Bootstrap待機・キャンバス改善版）');
            
            // 初期化完了イベント発火
            if (window.Tegaki?.EventBusInstance) {
                window.Tegaki.EventBusInstance.safeEmit('app:initialized', {
                    initializationTime: performance.now() - this.bootstrapStartTime,
                    canvasVisible: !!document.querySelector('canvas'),
                    managersReady: this.getManagerStatus()
                });
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
     * STEP 1: 初理化レジストリ実行
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
     * STEP 2: AppCore初期化委譲（キャンバス表示問題修正版）
     */
    async initializeAppCore() {
        console.log('🎯 AppCore初期化中...');

        try {
            // AppCore取得または作成
            if (window.Tegaki?.AppCoreInstance) {
                this.appCore = window.Tegaki.AppCoreInstance;
                console.log('✅ 既存AppCoreInstance使用');
            } else if (window.Tegaki?.AppCore) {
                this.appCore = new window.Tegaki.AppCore();
                window.Tegaki.AppCoreInstance = this.appCore;
                console.log('✅ 新規AppCoreInstance作成');
            } else if (window.AppCore) {
                this.appCore = new window.AppCore();
                window.Tegaki.AppCoreInstance = this.appCore;
                console.log('✅ グローバルAppCore使用');
            } else {
                throw new Error('AppCoreが利用できません');
            }

            // AppCore初期化実行
            const success = await this.appCore.initialize();
            
            if (!success) {
                throw new Error('AppCore初期化がfalseを返しました');
            }
            
            console.log('✅ AppCore初期化完了');
            
            // CanvasManager初期化状態確認（重要）
            await this.verifyCanvasManagerInitialization();
            
            return true;
            
        } catch (error) {
            console.error('❌ AppCore初期化エラー:', error);
            throw error;
        }
    }

    /**
     * CanvasManager初期化状態確認（キャンバス表示問題対策）
     */
    async verifyCanvasManagerInitialization() {
        try {
            const canvasManager = this.appCore?.canvasManager || window.Tegaki?.CanvasManagerInstance;
            
            if (!canvasManager) {
                console.warn('⚠️ CanvasManager未取得');
                return false;
            }
            
            if (!canvasManager.initialized) {
                console.warn('⚠️ CanvasManager未初期化 - 手動初期化実行');
                
                // キャンバス要素を確実に取得
                const canvasElement = document.getElementById('canvas-container') ||
                                     document.querySelector('.canvas-area') ||
                                     document.querySelector('canvas');
                
                if (canvasElement) {
                    const initSuccess = await canvasManager.initialize({
                        appCore: this.appCore,
                        canvasElement: canvasElement,
                        config: {
                            configManager: window.Tegaki?.ConfigManagerInstance
                        }
                    });
                    
                    if (initSuccess) {
                        console.log('✅ CanvasManager手動初期化成功');
                    } else {
                        console.error('❌ CanvasManager手動初期化失敗');
                    }
                } else {
                    console.error('❌ キャンバス要素が見つかりません');
                }
            } else {
                console.log('✅ CanvasManager初期化済み');
            }
            
            return true;
            
        } catch (error) {
            console.error('❌ CanvasManager初期化確認エラー:', error);
            return false;
        }
    }

    /**
     * STEP 3: キャンバス表示確認・診断
     */
    verifyCanvasDisplay() {
        try {
            console.log('🎨 キャンバス表示確認・診断実行...');
            
            // DOM要素確認
            const container = document.getElementById('canvas-container') ||
                             document.querySelector('.canvas-area');
            const canvas = document.querySelector('canvas');
            
            console.log('📋 キャンバス要素確認:', {
                container: !!container,
                canvas: !!canvas,
                containerId: container?.id || 'no-id',
                canvasSize: canvas ? `${canvas.width}x${canvas.height}` : 'none'
            });
            
            // CanvasManager状態確認
            const canvasManager = this.appCore?.canvasManager || window.Tegaki?.CanvasManagerInstance;
            if (canvasManager) {
                const diagnostic = canvasManager.getDiagnosticInfo();
                console.log('📊 CanvasManager診断:', diagnostic);
                
                if (diagnostic.canvasVisible) {
                    console.log('✅ キャンバス表示確認成功');
                } else {
                    console.warn('⚠️ キャンバス非表示状態');
                }
            }
            
        } catch (error) {
            console.error('❌ キャンバス表示確認エラー:', error);
        }
    }

    /**
     * Manager状態取得
     */
    getManagerStatus() {
        return {
            configManager: !!window.Tegaki?.ConfigManagerInstance,
            errorManager: !!window.Tegaki?.ErrorManagerInstance,
            stateManager: !!window.Tegaki?.StateManagerInstance,
            eventBus: !!window.Tegaki?.EventBusInstance,
            coordinateManager: !!window.Tegaki?.CoordinateManagerInstance,
            canvasManager: !!window.Tegaki?.CanvasManagerInstance,
            toolManager: !!window.Tegaki?.ToolManagerInstance,
            uiManager: !!window.Tegaki?.UIManagerInstance,
            appCore: !!this.appCore,
            appCoreInitialized: !!this.appCore?.initialized
        };
    }

    /**
     * アプリケーション状態取得
     */
    getApplicationStatus() {
        return {
            version: 'Phase1.5-Bootstrap待機・キャンバス改善版',
            initialized: this.initialized,
            dependenciesLoaded: this.dependenciesLoaded,
            canvasElementReady: this.canvasElementReady,
            appCore: this.appCore ? {
                initialized: this.appCore.initialized,
                managers: this.appCore.getManagerStatus ? this.appCore.getManagerStatus() : null
            } : null,
            initializationError: this.initializationError,
            bootstrapTime: performance.now() - this.bootstrapStartTime,
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
            canvasManagerInitialized: !!(this.appCore?.canvasManager?.initialized || window.Tegaki?.CanvasManagerInstance?.initialized),
            toolManager: !!(this.appCore?.toolManager || window.Tegaki?.ToolManagerInstance),
            pixiAvailable: !!window.PIXI,
            canvasPresent: !!document.querySelector('canvas'),
            canvasVisible: this.checkCanvasVisibility(),
            initialized: this.initialized,
            initializationError: this.initializationError?.message || null
        };
    }

    /**
     * キャンバス可視性確認
     */
    checkCanvasVisibility() {
        try {
            const canvas = document.querySelector('canvas');
            if (!canvas) return false;
            
            const rect = canvas.getBoundingClientRect();
            const style = getComputedStyle(canvas);
            
            return rect.width > 0 && 
                   rect.height > 0 && 
                   style.display !== 'none' && 
                   style.visibility !== 'hidden' && 
                   parseFloat(style.opacity) > 0;
        } catch (error) {
            return false;
        }
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
            if (!this.dependenciesLoaded) issues.push('Dependencies not loaded');
            
            const canvas = document.querySelector('canvas');
            if (!canvas) {
                issues.push('Canvas element not present');
            } else if (!this.checkCanvasVisibility()) {
                warnings.push('Canvas not visible');
            }
            
            // AppCoreチェック
            if (!this.appCore) {
                issues.push('AppCore not available');
            } else if (!this.appCore.initialized) {
                warnings.push('AppCore not initialized');
            }
            
            // ManagerCheckチェック
            const managers = this.getManagerStatus();
            const coreManagers = ['configManager', 'errorManager', 'stateManager', 'eventBus'];
            const missingCore = coreManagers.filter(m => !managers[m]);
            if (missingCore.length > 0) {
                warnings.push(`Missing core managers: ${missingCore.join(', ')}`);
            }
            
            return {
                healthy: issues.length === 0,
                functional: issues.length === 0 && warnings.length < 3,
                issues,
                warnings,
                canvasVisible: this.checkCanvasVisibility(),
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
 * DOM準備完了時の初期化システム（Bootstrap連携）
 */
document.addEventListener("DOMContentLoaded", function() {
    console.log('📋 DOMContentLoaded - Bootstrap連携初期化開始');
    
    // TegakiApplication作成
    const app = new window.Tegaki.TegakiApplication();
    window.Tegaki.AppInstance = app;
    
    // Bootstrap依存関係完了待機（自動的に開始）
    console.log('⏳ Bootstrap依存関係完了待機中...');
});

/**
 * window.load完了時の補完チェック
 */
window.addEventListener('load', () => {
    console.log('📋 Window Load完了 - 補完チェック実行');
    
    if (window.Tegaki?.AppInstance && !window.Tegaki.AppInstance.initialized) {
        console.log('🔄 Window Load時点で未初期化 - 再試行');
        window.Tegaki.AppInstance.tryInitialize();
    }
});

/**
 * ページ離脱時のクリーンアップ
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
// 診断・デバッグAPI（グローバル公開）
// ========================================

/**
 * Tegaki全体健全性チェック
 */
window.checkTegakiHealth = function() {
    console.log('🔍 Tegaki全体健全性チェック開始');
    
    const app = window.Tegaki?.AppInstance;
    if (!app) {
        console.error('❌ TegakiApplication未初期化');
        return {
            healthy: false,
            error: 'TegakiApplication not found'
        };
    }
    
    const health = app.healthCheck();
    console.log('📊 健全性チェック結果:', health);
    
    if (health.healthy) {
        console.log('✅ Tegakiシステム健全');
    } else if (health.functional) {
        console.log('⚠️ Tegakiシステム機能的（軽微な問題あり）');
    } else {
        console.log('❌ Tegakiシステム問題あり');
    }
    
    return health;
};

/**
 * 座標統合状態チェック
 */
window.checkCoordinateIntegration = function() {
    console.log('🔍 座標統合状態チェック開始');
    
    const app = window.Tegaki?.AppInstance;
    if (!app) {
        console.error('❌ TegakiApplication未初期化');
        return { error: 'TegakiApplication not found' };
    }
    
    const integration = app.getCoordinateIntegrationState();
    console.log('📊 座標統合状態:', integration);
    
    const score = Object.values(integration).filter(v => v === true).length;
    const total = Object.values(integration).length - 1; // error除く
    const percentage = (score / total * 100).toFixed(1);
    
    console.log(`📈 座標統合完成度: ${percentage}%`);
    
    if (percentage >= 80) {
        console.log('✅ 座標統合良好');
    } else {
        console.log('⚠️ 座標統合に課題あり');
    }
    
    return { ...integration, score: percentage };
};

/**
 * Phase2移行準備度チェック
 */
window.checkPhase2Readiness = function() {
    console.log('🔍 Phase2移行準備度チェック開始');
    
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
        
        // Bootstrap・初期化システム
        bootstrapSystem: !!(
            window.Tegaki?.AppInstance?.dependenciesLoaded &&
            window.Tegaki?.AppInstance?.initialized
        ),
        
        // キャンバス表示確認
        canvasVisible: !!(
            document.querySelector('canvas') &&
            window.Tegaki?.AppInstance?.checkCanvasVisibility()
        )
    };
    
    const score = Object.values(checkList).filter(v => v === true).length;
    const percentage = (score / Object.keys(checkList).length * 100);
    
    console.log('📊 Phase2移行準備度:', `${percentage.toFixed(1)}%`);
    console.log('📋 詳細チェック:', checkList);
    
    if (percentage >= 95) {
        console.log('✅ Phase2移行準備完了');
    } else if (percentage >= 80) {
        console.log('⚠️ Phase2移行準備概ね完了（軽微な課題あり）');
    } else {
        console.log('❌ Phase2移行準備未完了（重要な課題あり）');
    }
    
    return { score: percentage, checkList, ready: percentage >= 95 };
};

/**
 * REV系統合デバッグ
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
    const canvas = container?.querySelector('canvas') || document.querySelector('canvas');
    console.log('  - コンテナサイズ:', container ? `${container.offsetWidth}x${container.offsetHeight}` : 'なし');
    console.log('  - キャンバス要素:', !!canvas);
    console.log('  - キャンバスサイズ:', canvas ? `${canvas.width}x${canvas.height}` : 'なし');
    console.log('  - 表示状態:', window.Tegaki?.AppInstance?.checkCanvasVisibility() || false);
    
    // 4. 統一システム確認
    console.log('4️⃣ 統一システム:');
    const systems = ['ConfigManagerInstance', 'ErrorManagerInstance', 'StateManagerInstance', 'EventBusInstance'];
    systems.forEach(system => {
        console.log(`  - ${system}:`, !!window.Tegaki?.[system]);
    });
    
    // 5. CSS統合確認
    console.log('5️⃣ CSS統合確認:');
    const cssVars = getComputedStyle(document.documentElement);
    console.log('  - CSS変数:', cssVars.getPropertyValue('--futaba-bg') || '未定義');
    console.log('  - キャンバスクラス:', container?.className || 'クラスなし');
    
    // 6. 問題診断
    const issues = [];
    if (!window.Tegaki?.AppInstance?.dependenciesLoaded) issues.push('依存関係未完了');
    if (!document.getElementById('canvas-container')) issues.push('キャンバスコンテナなし');
    if (!canvas) issues.push('キャンバス要素なし');
    if (!window.Tegaki?.CanvasManagerInstance?.initialized) issues.push('CanvasManager未初期化');
    if (!cssVars.getPropertyValue('--futaba-bg')) issues.push('CSS変数未適用');
    if (!window.Tegaki?.AppInstance?.checkCanvasVisibility()) issues.push('キャンバス非表示');
    
    console.log('6️⃣ 問題診断:', issues.length > 0 ? issues : '問題なし');
    
    return {
        healthy: issues.length === 0,
        issues,
        canvasVisible: !!canvas && (window.Tegaki?.AppInstance?.checkCanvasVisibility() || false),
        systemReady: !!window.Tegaki?.AppInstance?.initialized,
        cssIntegrated: !!cssVars.getPropertyValue('--futaba-bg')
    };
};

console.log('🎨 Tegaki Main (Bootstrap待機・キャンバス初期化改善版) Loaded');
console.log('✨ 修正完了: Bootstrap依存関係待機・DOM要素確実化・キャンバス表示確認');
console.log('🚀 Phase1.5目標: キャンバス100%表示・初期化信頼性・診断機能完備');
console.log('🔧 診断コマンド: window.checkTegakiHealth(), window.debugREVSystem()');