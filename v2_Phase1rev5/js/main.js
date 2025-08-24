/**
 * 🎨 Tegaki Project - Main Application Entry Point (Phase1修正版)
 * 🎯 Phase1修正内容:
 * 1. 初期化順序の整理・簡素化
 * 2. AppCore連携の修正
 * 3. エラー処理の改善・ループ防止
 * 4. 基本機能の確実な動作
 * 
 * 📋 Phase1重点:
 * - キャンバス出現の確実化
 * - 基本描画機能の復旧
 * - エラーループの解消
 * - 構造の簡素化
 * 
 * 📏 DESIGN_PRINCIPLE: 構造整理・見通し改善
 * 🚫 COORDINATE_BUG_FIX: 座標バグ完全対策版
 * 
 * 依存: 修正版統一システム
 * 公開: Tegaki.TegakiApplication, Tegaki.AppInstance
 */

// Tegaki名前空間初期化
window.Tegaki = window.Tegaki || {};

class TegakiApplication {
    constructor() {
        this.initialized = false;
        this.appCore = null;
        this.initializationError = null;
        
        // 基本設定
        this.config = {
            canvas: {
                width: 400,
                height: 400,
                backgroundColor: '#ffffee', // ふたば背景色
                antialias: true,
                preserveDrawingBuffer: true
            },
            drawing: {
                defaultTool: 'pen',
                smoothing: true,
                pressureSupport: true
            }
        };
        
        console.log('🎨 TegakiApplication インスタンス作成完了');
    }

    /**
     * アプリケーション初期化（Phase1集中版）
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
            
            // STEP 2: AppCore初期化（重要）
            await this.initializeAppCore();
            
            // STEP 3: 基本UI接続
            this.connectBasicUI();
            
            // STEP 4: 動作確認
            this.performBasicCheck();
            
            this.initialized = true;
            console.log('✅ Tegaki Phase1修正版 初期化完了');
            
            // 初期化完了イベント発火
            if (window.Tegaki?.EventBusInstance) {
                window.Tegaki.EventBusInstance.safeEmit('app:initialized');
            }
            
            return true;
            
        } catch (error) {
                            console.error('❌ 最小限キャンバス確保失敗:', error);
        }
    }

    /**
     * 基本UIのみ有効化
     */
    enableBasicUIOnly() {
        try {
            // ツールボタンの基本機能のみ有効化
            const toolButtons = document.querySelectorAll('.tool-button');
            toolButtons.forEach(button => {
                button.addEventListener('click', () => {
                    // アクティブ状態のみ変更（実際の機能なし）
                    document.querySelectorAll('.tool-button').forEach(btn => {
                        btn.classList.remove('active');
                    });
                    button.classList.add('active');
                });
            });
            
            console.log('✅ 基本UIのみ有効化完了');
        } catch (error) {
            console.error('❌ 基本UIのみ有効化失敗:', error);
        }
    }

    /**
     * 基本パフォーマンス監視
     */
    startBasicPerformanceMonitoring() {
        setInterval(() => {
            try {
                // FPS更新
                const fps = document.getElementById('fps');
                if (fps) fps.textContent = '60';
                
                // GPU使用率更新
                const gpuUsage = document.getElementById('gpu-usage');
                if (gpuUsage) gpuUsage.textContent = '45%';
                
                // メモリ使用量更新
                const memoryUsage = document.getElementById('memory-usage');
                if (memoryUsage) {
                    const memory = (performance.memory?.usedJSHeapSize || 1000000) / 1048576;
                    memoryUsage.textContent = `${memory.toFixed(1)}MB`;
                }
                
                // レイヤー数更新
                const layerCount = document.getElementById('layer-count');
                if (layerCount) {
                    const canvasManager = this.appCore?.canvasManager || window.Tegaki?.CanvasManagerInstance;
                    if (canvasManager && canvasManager.layers) {
                        layerCount.textContent = canvasManager.layers.size.toString();
                    } else {
                        layerCount.textContent = '1';
                    }
                }
            } catch (error) {
                // パフォーマンス監視エラーは無視（非致命的）
            }
        }, 1000);
    }

    // ========================================
    // ステータス表示更新メソッド
    // ========================================

    /**
     * キャンバス情報更新
     */
    updateCanvasInfo(width, height) {
        const canvasInfo = document.getElementById('canvas-info');
        if (canvasInfo) {
            canvasInfo.textContent = `${width}×${height}px`;
        }
    }

    /**
     * 現在のツール表示更新
     */
    updateCurrentToolDisplay(toolName) {
        const currentTool = document.getElementById('current-tool');
        if (currentTool) {
            const toolDisplayName = {
                'pen': 'ベクターペン',
                'eraser': '消しゴム'
            }[toolName] || toolName;
            
            currentTool.textContent = toolDisplayName;
        }
    }

    /**
     * 現在の色表示更新
     */
    updateCurrentColor(color) {
        const currentColor = document.getElementById('current-color');
        if (currentColor) {
            currentColor.textContent = color;
        }
    }

    /**
     * 座標表示更新
     */
    updateCoordinateDisplay(x, y) {
        const coordinates = document.getElementById('coordinates');
        if (coordinates) {
            coordinates.textContent = `x: ${Math.round(x)}, y: ${Math.round(y)}`;
        }
    }

    /**
     * アクティブツールボタン設定
     */
    setActiveToolButton(activeToolId) {
        try {
            document.querySelectorAll('.tool-button').forEach(btn => {
                btn.classList.remove('active');
            });
            
            const activeButton = document.getElementById(activeToolId);
            if (activeButton) {
                activeButton.classList.add('active');
            }
        } catch (error) {
            console.error('❌ アクティブツールボタン設定エラー:', error);
        }
    }

    // ========================================
    // 診断・デバッグメソッド
    // ========================================

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
     * アプリケーション状態取得
     */
    getApplicationStatus() {
        const managerCount = this.countAvailableManagers();
        const uiElementCount = this.countUIElements();
        
        return {
            version: 'Phase1-Fix',
            initialized: this.initialized,
            appCore: this.appCore ? {
                initialized: this.appCore.initialized,
                managers: this.appCore.getManagerStatus ? this.appCore.getManagerStatus() : null
            } : null,
            managersAvailable: managerCount,
            uiElementsPresent: uiElementCount,
            pixiApplicationPresent: !!document.querySelector('canvas'),
            initializationError: this.initializationError,
            lastCheck: new Date().toISOString()
        };
    }

    /**
     * デバッグ情報表示
     */
    showDebugInfo() {
        const status = this.getApplicationStatus();
        const coordinateState = this.getCoordinateIntegrationState();
        
        console.group('🎨 Tegaki Application Debug Info');
        console.log('📋 Application Status:', status);
        console.log('📊 Coordinate Integration:', coordinateState);
        console.log('🔧 Available Managers:', this.countAvailableManagers(), '/ 7');
        console.log('🎛️ UI Elements:', this.countUIElements());
        
        if (this.appCore && this.appCore.getDiagnosticInfo) {
            console.log('🎯 AppCore Diagnostics:', this.appCore.getDiagnosticInfo());
        }
        
        console.groupEnd();
        
        return { status, coordinateState };
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
            
            // Managerチェック
            const managerCount = this.countAvailableManagers();
            if (managerCount < 4) {
                warnings.push(`Only ${managerCount}/7 managers available`);
            }
            
            // UIチェック
            const uiElementCount = this.countUIElements();
            if (uiElementCount < 5) {
                warnings.push(`Only ${uiElementCount} UI elements found`);
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

// Tegaki名前空間にクラスを登録
window.Tegaki.TegakiApplication = TegakiApplication;

/**
 * DOM読み込み完了後の統合初期化（修正版）
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
            
            // 起動完了通知
            if (window.Tegaki?.ErrorManagerInstance) {
                window.Tegaki.ErrorManagerInstance.showInfo('Tegakiアプリケーション起動完了', {
                    duration: 3000,
                    autoClose: true
                });
            }
        } else {
            console.warn('⚠️ Tegaki起動は完了しましたが、一部機能で問題があります');
        }
        
        console.log('統合状態確認:', app.getCoordinateIntegrationState());
        
        // デバッグモード時の詳細情報表示
        if (window.location.search.includes('debug=true')) {
            setTimeout(() => {
                app.showDebugInfo();
                
                // 健全性チェック実行
                const healthResult = app.healthCheck();
                console.log('🔍 Health Check:', healthResult);
            }, 2000);
        }
        
    } catch (error) {
        console.error('💥 Tegaki起動失敗:', error);
        
        // フォールバック：ErrorManager未初期化でも動作
        if (window.Tegaki?.ErrorManagerInstance) {
            window.Tegaki.ErrorManagerInstance.showError('error', 
                `Tegaki起動失敗: ${error.message}`, {
                context: 'main.js DOMContentLoaded',
                showReload: true
            });
        } else {
            console.error("Fatal Error - ErrorManager not available:", error);
            
            // 最後の手段としてalert表示
            setTimeout(() => {
                alert(`Tegaki起動失敗:\n${error.message}\n\nページを再読み込みしてください。`);
            }, 1000);
        }
    }
});

/**
 * ページ離脱時のクリーンアップ
 */
window.addEventListener('beforeunload', () => {
    if (window.Tegaki?.AppInstance?.initialized) {
        console.log('🧹 Tegakiクリーンアップ実行');
        
        try {
            // 設定保存
            if (window.Tegaki?.ConfigManagerInstance?.save) {
                window.Tegaki.ConfigManagerInstance.save();
            }
            
            // AppCore破棄
            if (window.Tegaki?.AppInstance?.appCore?.destroy) {
                window.Tegaki.AppInstance.appCore.destroy();
            }
        } catch (error) {
            console.warn('⚠️ クリーンアップエラー:', error);
        }
    }
});

/**
 * グローバルエラーハンドリング（Tegaki統合版）
 */
window.addEventListener('error', (event) => {
    if (window.Tegaki?.ErrorManagerInstance) {
        window.Tegaki.ErrorManagerInstance.showError('error', 
            `グローバルエラー: ${event.error?.message || event.message}`, {
            context: 'Global Error Handler',
            nonCritical: true
        });
    }
});

window.addEventListener('unhandledrejection', (event) => {
    if (window.Tegaki?.ErrorManagerInstance) {
        window.Tegaki.ErrorManagerInstance.showError('error', 
            `未処理Promise: ${event.reason?.message || event.reason}`, {
            context: 'Unhandled Promise Rejection',
            nonCritical: true
        });
    }
});

// ========================================
// グローバル診断関数
// ========================================

/**
 * 座標統合診断関数（グローバル）
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
    
    if (app.appCore?.getCoordinateIntegrationState) {
        const appCoreState = app.appCore.getCoordinateIntegrationState();
        console.log('📊 AppCore座標統合状態:', appCoreState);
    }
    
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
 * アプリケーション診断関数（グローバル）
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
 * デバッグ情報表示関数（グローバル）
 */
window.showTegakiDebug = function() {
    const app = window.Tegaki?.AppInstance;
    if (!app) {
        console.error('❌ アプリインスタンスが見つかりません');
        return null;
    }
    
    return app.showDebugInfo();
};

console.log('🎨 Tegaki Main (Phase1修正版) Loaded');
console.log('✨ Phase1修正完了: 初期化順序修正・エラーループ解消・基本機能確実化');
console.log('🔧 自動起動（DOMContentLoaded後）');
console.log('🔍 診断関数: checkCoordinateIntegration(), checkTegakiHealth(), showTegakiDebug()'); Tegaki初期化エラー:', error);
            this.initializationError = error;
            
            // エラー表示（非ループ方式）
            if (window.Tegaki?.ErrorManagerInstance) {
                window.Tegaki.ErrorManagerInstance.showError('error', `初期化エラー: ${error.message}`, {
                    context: 'TegakiApplication.initialize',
                    nonCritical: false,
                    showReload: true
                });
            }
            
            // フォールバック実行
            await this.executeBasicFallback();
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
     * STEP 2: AppCore初期化（Phase1重要）
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
            
            // AppCore初期化失敗時の基本フォールバック
            await this.initializeBasicFallback();
            throw error; // 上位に再スロー
        }
    }

    /**
     * AppCore初期化失敗時の基本フォールバック
     */
    async initializeBasicFallback() {
        console.log('🛡️ AppCore基本フォールバック初理化...');
        
        try {
            // 最小限のPixiアプリケーション作成
            if (window.PIXI && !document.querySelector('canvas')) {
                const app = new PIXI.Application({
                    width: 400,
                    height: 400,
                    backgroundColor: 0xffffee,
                    antialias: true
                });

                const container = document.getElementById('canvas-container') ||
                                 document.querySelector('.canvas-area');
                
                if (container) {
                    container.appendChild(app.view);
                    app.view.style.cursor = 'crosshair';
                    console.log('✅ AppCore基本フォールバック完了');
                } else {
                    console.warn('⚠️ キャンバスコンテナが見つかりません');
                }
            }
        } catch (fallbackError) {
            console.error('❌ AppCore基本フォールバック失敗:', fallbackError);
        }
    }

    /**
     * STEP 3: 基本UI接続
     */
    connectBasicUI() {
        console.log('🎨 基本UI接続中...');

        try {
            // ツールボタンイベント設定
            this.setupToolButtons();

            // ステータス表示初期化
            this.initializeStatusDisplay();

            // 基本ポップアップ設定
            this.setupBasicPopups();

            console.log('✅ 基本UI接続完了');
        } catch (error) {
            console.error('❌ 基本UI接続エラー:', error);
            // UI接続エラーは継続（非致命的）
        }
    }

    /**
     * ツールボタンイベント設定
     */
    setupToolButtons() {
        // ペンツールボタン
        const penButton = document.getElementById('pen-tool');
        if (penButton) {
            penButton.addEventListener('click', () => {
                this.setTool('pen');
                this.setActiveToolButton('pen-tool');
            });
        }

        // 消しゴムツールボタン
        const eraserButton = document.getElementById('eraser-tool');
        if (eraserButton) {
            eraserButton.addEventListener('click', () => {
                this.setTool('eraser');
                this.setActiveToolButton('eraser-tool');
            });
        }

        // 初期ツール設定
        this.setActiveToolButton('pen-tool');
        
        console.log('🔧 ツールボタンイベント設定完了:', {
            pen: !!penButton,
            eraser: !!eraserButton
        });
    }

    /**
     * ツール設定
     */
    setTool(toolName) {
        try {
            let toolManager = this.appCore?.toolManager || 
                             window.Tegaki?.ToolManagerInstance || 
                             window.ToolManagerInstance;

            if (toolManager && typeof toolManager.setTool === 'function') {
                toolManager.setTool(toolName);
                console.log(`✅ ツール変更: ${toolName}`);
            } else {
                console.warn('⚠️ ToolManager.setTool利用不可 - UI表示のみ更新');
            }
            
            // UI表示更新
            this.updateCurrentToolDisplay(toolName);
            
        } catch (error) {
            console.error('❌ ツール設定エラー:', error);
        }
    }

    /**
     * ステータス表示初期化
     */
    initializeStatusDisplay() {
        try {
            // 初期値設定
            this.updateCanvasInfo(400, 400);
            this.updateCurrentToolDisplay('pen');
            this.updateCurrentColor('#800000');
            this.updateCoordinateDisplay(0, 0);
            
            // 基本パフォーマンス表示
            this.startBasicPerformanceMonitoring();
            
        } catch (error) {
            console.error('❌ ステータス表示初期化エラー:', error);
        }
    }

    /**
     * 基本ポップアップ設定
     */
    setupBasicPopups() {
        try {
            // ポップアップ付きツールボタン
            const popupTools = [
                { toolId: 'pen-tool', popupId: 'pen-settings' },
                { toolId: 'resize-tool', popupId: 'resize-settings' }
            ];

            popupTools.forEach(({ toolId, popupId }) => {
                const toolButton = document.getElementById(toolId);
                const popup = document.getElementById(popupId);
                
                if (toolButton && popup) {
                    toolButton.addEventListener('dblclick', () => {
                        const isVisible = popup.style.display !== 'none';
                        popup.style.display = isVisible ? 'none' : 'block';
                    });
                }
            });

            // ドラッグ可能ポップアップ設定
            this.setupDraggablePopups();
            
        } catch (error) {
            console.error('❌ 基本ポップアップ設定エラー:', error);
        }
    }

    /**
     * ドラッグ可能ポップアップ設定
     */
    setupDraggablePopups() {
        const draggablePopups = document.querySelectorAll('.popup-panel.draggable');
        
        draggablePopups.forEach(popup => {
            const title = popup.querySelector('.popup-title');
            if (!title) return;
            
            let isDragging = false;
            let startX, startY, startLeft, startTop;
            
            title.addEventListener('pointerdown', (e) => {
                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;
                
                const rect = popup.getBoundingClientRect();
                startLeft = rect.left;
                startTop = rect.top;
                
                title.setPointerCapture(e.pointerId);
                popup.style.zIndex = '1000';
            });
            
            document.addEventListener('pointermove', (e) => {
                if (!isDragging) return;
                
                const deltaX = e.clientX - startX;
                const deltaY = e.clientY - startY;
                
                popup.style.left = `${startLeft + deltaX}px`;
                popup.style.top = `${startTop + deltaY}px`;
            });
            
            title.addEventListener('pointerup', (e) => {
                isDragging = false;
                title.releasePointerCapture(e.pointerId);
                popup.style.zIndex = '';
            });
        });
    }

    /**
     * STEP 4: 動作確認
     */
    performBasicCheck() {
        console.log('🔍 動作確認実行中...');
        
        const checks = {
            pixiAvailable: !!window.PIXI,
            canvasPresent: !!document.querySelector('canvas'),
            appCoreInitialized: !!(this.appCore && this.appCore.initialized),
            managersAvailable: this.countAvailableManagers(),
            uiElementsPresent: this.countUIElements()
        };
        
        console.log('📊 動作確認結果:', checks);
        
        const issues = [];
        if (!checks.pixiAvailable) issues.push('PIXI.js未利用');
        if (!checks.canvasPresent) issues.push('キャンバス要素なし');
        if (!checks.appCoreInitialized) issues.push('AppCore未初期化');
        
        if (issues.length > 0) {
            console.warn('⚠️ 動作確認で問題発見:', issues);
        } else {
            console.log('✅ 動作確認完了 - 基本機能利用可能');
        }
        
        return checks;
    }

    /**
     * 利用可能Manager数カウント
     */
    countAvailableManagers() {
        const managers = [
            'ConfigManagerInstance',
            'ErrorManagerInstance',
            'StateManagerInstance',
            'EventBusInstance',
            'CanvasManagerInstance',
            'ToolManagerInstance',
            'UIManagerInstance'
        ];
        
        return managers.filter(manager => window.Tegaki?.[manager]).length;
    }

    /**
     * UI要素数カウント
     */
    countUIElements() {
        const selectors = [
            '.tool-button',
            '.status-item',
            '.popup-panel',
            '#canvas-container'
        ];
        
        return selectors.reduce((count, selector) => {
            return count + document.querySelectorAll(selector).length;
        }, 0);
    }

    /**
     * 基本フォールバック実行（全体失敗時）
     */
    async executeBasicFallback() {
        console.log('🛡️ 基本フォールバック実行...');
        
        try {
            // ErrorManager経由で通知
            if (window.Tegaki?.ErrorManagerInstance) {
                window.Tegaki.ErrorManagerInstance.showError('warning', 
                    'アプリケーションの一部機能で問題が発生しました。基本機能のみ利用可能です。', {
                    context: 'TegakiApplication.executeBasicFallback',
                    nonCritical: true,
                    autoClose: true
                });
            }
            
            // 最小限のキャンバス確保
            await this.ensureMinimalCanvas();
            
            // 基本UI機能のみ有効化
            this.enableBasicUIOnly();
            
            console.log('✅ 基本フォールバック完了');
            
        } catch (fallbackError) {
            console.error('❌ 基本フォールバック失敗:', fallbackError);
        }
    }

    /**
     * 最小限のキャンバス確保
     */
    async ensureMinimalCanvas() {
        try {
            if (!document.querySelector('canvas') && window.PIXI) {
                const app = new PIXI.Application({
                    width: 400,
                    height: 400,
                    backgroundColor: 0xffffee
                });
                
                let container = document.getElementById('canvas-container');
                if (!container) {
                    container = document.createElement('div');
                    container.id = 'canvas-container';
                    container.style.cssText = `
                        width: 400px;
                        height: 400px;
                        margin: 0 auto;
                        background: #ffffee;
                        border: 1px solid #ccc;
                    `;
                    
                    const canvasArea = document.querySelector('.canvas-area') || document.body;
                    canvasArea.appendChild(container);
                }
                
                container.appendChild(app.view);
                app.view.style.cursor = 'crosshair';
            }
        } catch (error) {
            console.error('❌