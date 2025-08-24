/**
 * 🎨 Tegaki Project - Main Application Entry Point (Phase1修正版・完全版)
 * 🎯 Phase1修正内容:
 * 1. 集約と委譲のみに徹底（DRY/SOLID準拠）
 * 2. ErrorManagerへの完全委譲
 * 3. 冗長なフェイルセーフ・UI処理の削除
 * 4. main.jsの責務純化
 * 
 * 📋 main.js責務定義:
 * - 初期化レジストリ実行と順序制御
 * - AppCore初期化の委譲
 * - グローバルエラーハンドラ登録（ErrorManagerへの委譲のみ）
 * - アプリインスタンス管理
 * 
 * 🚫 main.jsから削除した責務:
 * - UI表示・操作（UIManagerへ）
 * - エラー分類・表示（ErrorManagerへ）
 * - 重複ロジック・フェイルセーフUI（冗長排除）
 * 
 * 📏 DESIGN_PRINCIPLE: 単一責任・委譲専門
 * 🎯 TEGAKI_NAMESPACE: Tegaki名前空間統一対応済み
 * 
 * 依存: ErrorManager（委譲先）
 * 公開: Tegaki.TegakiApplication, Tegaki.AppInstance
 */

// Tegaki名前空間初期化
window.Tegaki = window.Tegaki || {};

class TegakiApplication {
    constructor() {
        this.initialized = false;
        this.appCore = null;
        this.initializationError = null;
        
        // 基本設定（Phase1最小限）
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
    }

    /**
     * アプリケーション初期化（Phase1・委譲専門版）
     */
    async initialize() {
        try {
            console.log('🎨 Tegaki Phase1修正版 初期化開始...');

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
            console.log('✅ Tegaki Phase1修正版 初期化完了');
            
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
     * STEP 2: AppCore初期化委譲
     */
    async initializeAppCore() {
        console.log('🎯 AppCore初期化中...');

        try {
            // AppCore取得または作成
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

            // AppCore初期化実行
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
            version: 'Phase1-Fix',
            initialized: this.initialized,
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
 * DOM読み込み完了後の統合初期化（委譲専門版）
 */
document.addEventListener("DOMContentLoaded", async function() {
    try {
        console.log('📋 DOMContentLoaded - Tegaki Phase1修正版 起動開始');
        
        // アプリケーション統合初期化
        const app = new window.Tegaki.TegakiApplication();
        const success = await app.initialize();
        
        // Tegaki名前空間にアプリインスタンス登録
        window.Tegaki.AppInstance = app;
        
        if (success) {
            console.log('🎉 Tegaki Phase1修正版 起動完了');
        } else {
            console.warn('⚠️ Tegaki起動は完了しましたが、一部機能で問題があります');
        }
        
        // デバッグモード時の詳細情報表示
        if (window.location.search.includes('debug=true')) {
            setTimeout(() => {
                console.log('🔍 統合状態確認:', app.getCoordinateIntegrationState());
                console.log('🏥 Health Check:', app.healthCheck());
            }, 2000);
        }
        
    } catch (error) {
        console.error('💥 Tegaki起動失敗:', error);
        
        // ErrorManager委譲（利用可能な場合のみ）
        if (window.Tegaki?.ErrorManagerInstance) {
            window.Tegaki.ErrorManagerInstance.showError('error', 
                `Tegaki起動失敗: ${error.message}`, {
                context: 'main.js DOMContentLoaded',
                showReload: true
            });
        } else {
            // ErrorManager未利用時の最小限通知
            console.error("Fatal Error - ErrorManager not available:", error);
        }
    }
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

console.log('🎨 Tegaki Main (Phase1修正版・DRY/SOLID準拠) Loaded');
console.log('✨ main.js責務純化完了: 集約と委譲のみ・冗長フェイルセーフ排除');
console.log('🔧 自動起動（DOMContentLoaded後）');
console.log('🔍 診断関数: checkCoordinateIntegration(), checkTegakiHealth()');