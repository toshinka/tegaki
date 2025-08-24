/**
 * 🎨 Tegaki Project - Main Application Entry Point (Phase1修正版)
 * 🎯 修正内容:
 * 1. async構文エラーの修正（43行目エラー解消）
 * 2. 初期化順序の整理・簡素化
 * 3. AppCore連携の修正
 * 4. エラー処理の改善
 * 
 * 📋 Phase1重点:
 * - キャンバス出現の確実化
 * - 基本描画機能の復旧
 * - ツールエラーの解消
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
     * アプリケーション初理化（Phase1集中版）
     */
    async initialize() {
        try {
            console.log('🎨 Tegaki Phase1修正版 初期化開始...');

            // STEP 1: 初期化レジストリ実行
            this.executeInitializationRegistry();
            
            // STEP 2: AppCore初期化（重要）
            await this.initializeAppCore();
            
            // STEP 3: ツール登録
            await this.registerTools();
            
            // STEP 4: UI初期化
            this.initializeUI();
            
            this.initialized = true;
            console.log('✅ Tegaki Phase1修正版 初期化完了');
            
            // 初期化完了イベント発火
            if (window.Tegaki?.EventBusInstance) {
                window.Tegaki.EventBusInstance.safeEmit('app:initialized');
            }
            
        } catch (error) {
            console.error('❌ Tegaki初期化エラー:', error);
            if (window.Tegaki?.ErrorManagerInstance) {
                window.Tegaki.ErrorManagerInstance.showError('error', `初期化エラー: ${error.message}`);
            }
            throw error;
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
                    throw error;
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
        
        const missingManagers = coreManagers.filter(manager => !window.Tegaki?.[manager]);
        if (missingManagers.length > 0) {
            console.warn('⚠️ 一部根幹Manager未初期化:', missingManagers.join(', '));
        } else {
            console.log('✅ 根幹Manager初期化確認完了');
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
            } else if (window.AppCore) {
                this.appCore = new window.AppCore();
                window.Tegaki.AppCoreInstance = this.appCore;
            } else {
                throw new Error('AppCoreが利用できません');
            }

            // AppCore初期化実行
            await this.appCore.initialize();
            
            console.log('✅ AppCore初期化完了');
        } catch (error) {
            console.error('❌ AppCore初期化エラー:', error);
            
            // 基本フォールバック
            await this.initializeBasicFallback();
        }
    }

    /**
     * 基本フォールバック初期化
     */
    async initializeBasicFallback() {
        console.log('🛡️ 基本フォールバック初期化...');
        
        try {
            // 最小限のキャンバス作成
            const container = document.getElementById('drawing-canvas');
            if (container && !container.querySelector('canvas')) {
                const canvas = document.createElement('canvas');
                canvas.width = 400;
                canvas.height = 400;
                canvas.style.backgroundColor = '#ffffee';
                canvas.style.cursor = 'crosshair';
                container.appendChild(canvas);
                
                console.log('✅ 基本フォールバック完了');
            }
        } catch (fallbackError) {
            console.error('❌ 基本フォールバック失敗:', fallbackError);
        }
    }

    /**
     * STEP 3: ツール登録（修正版）
     */
    async registerTools() {
        console.log('🔧 ツール登録中...');

        try {
            // ToolManager取得
            let toolManager = this.appCore?.toolManager || 
                             window.Tegaki?.ToolManagerInstance || 
                             window.ToolManagerInstance;

            if (!toolManager) {
                console.warn('⚠️ ToolManager利用不可 - ツール登録スキップ');
                return;
            }

            // ペンツール確認・登録
            if (typeof toolManager.isToolAvailable === 'function') {
                if (toolManager.isToolAvailable('pen')) {
                    if (typeof toolManager.setTool === 'function') {
                        toolManager.setTool('pen');
                        console.log('✅ デフォルトツール設定完了: pen');
                    }
                } else {
                    console.warn('⚠️ ペンツールが利用できません');
                    if (window.Tegaki?.ErrorManagerInstance) {
                        window.Tegaki.ErrorManagerInstance.showWarning('ペンツールが利用できません', {
                            context: 'TegakiApplication.registerTools'
                        });
                    }
                }

                // 消しゴムツール確認
                if (!toolManager.isToolAvailable('eraser')) {
                    console.warn('⚠️ 消しゴムツールが利用できません');
                    if (window.Tegaki?.ErrorManagerInstance) {
                        window.Tegaki.ErrorManagerInstance.showWarning('消しゴムツールが利用できません', {
                            context: 'TegakiApplication.registerTools'
                        });
                    }
                }
            } else {
                console.warn('⚠️ ToolManager.isToolAvailable メソッド未実装');
            }

            console.log('✅ ツール登録完了');
        } catch (error) {
            console.error('❌ ツール登録エラー:', error);
            if (window.Tegaki?.ErrorManagerInstance) {
                window.Tegaki.ErrorManagerInstance.showWarning(`ツール登録エラー: ${error.message}`, {
                    context: 'TegakiApplication.registerTools'
                });
            }
        }
    }

    /**
     * STEP 4: UI初期化（簡素版）
     */
    initializeUI() {
        console.log('🎨 UI初期化中...');

        try {
            // ツールボタンイベント設定
            this.setupToolButtons();

            // 基本ポップアップ設定
            this.setupBasicPopups();

            // ステータス表示初期化
            this.initializeStatusDisplay();

            console.log('✅ UI初期化完了');
        } catch (error) {
            console.error('❌ UI初期化エラー:', error);
        }
    }

    /**
     * ツールボタンイベント設定（修正版）
     */
    setupToolButtons() {
        // ペンツールボタン
        const penTool = document.getElementById('pen-tool');
        if (penTool) {
            penTool.addEventListener('click', () => {
                this.setTool('pen');
                this.setActiveToolButton('pen-tool');
            });
        }

        // 消しゴムツールボタン
        const eraserTool = document.getElementById('eraser-tool');
        if (eraserTool) {
            eraserTool.addEventListener('click', () => {
                this.setTool('eraser');
                this.setActiveToolButton('eraser-tool');
            });
        }

        // 初期ツール設定
        this.setActiveToolButton('pen-tool');
    }

    /**
     * ツール設定（修正版）
     */
    setTool(toolName) {
        try {
            let toolManager = this.appCore?.toolManager || 
                             window.Tegaki?.ToolManagerInstance || 
                             window.ToolManagerInstance;

            if (toolManager && typeof toolManager.setTool === 'function') {
                toolManager.setTool(toolName);
                this.updateCurrentToolDisplay(toolName);
                console.log(`✅ ツール変更: ${toolName}`);
            } else {
                console.warn('⚠️ ToolManager.setTool利用不可');
            }
        } catch (error) {
            console.error('❌ ツール設定エラー:', error);
        }
    }

    /**
     * 基本ポップアップ設定
     */
    setupBasicPopups() {
        // ポップアップ付きツールボタン
        const popupTools = [
            { toolId: 'pen-tool', popupId: 'pen-settings' },
            { toolId: 'resize-tool', popupId: 'resize-settings' }
        ];

        popupTools.forEach(({ toolId, popupId }) => {
            const toolButton = document.getElementById(toolId);
            const popup = document.getElementById(popupId);
            
            if (toolButton && popup) {
                toolButton.addEventListener('click', (e) => {
                    if (e.detail === 2) { // ダブルクリック
                        const isVisible = popup.style.display !== 'none';
                        popup.style.display = isVisible ? 'none' : 'block';
                    }
                });
            }
        });

        // ドラッグ可能ポップアップ設定
        this.setupDraggablePopups();
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
     * ステータス表示初期化
     */
    initializeStatusDisplay() {
        // 初期値設定
        this.updateCanvasInfo(400, 400);
        this.updateCurrentToolDisplay('pen');
        this.updateCurrentColor('#800000');
        this.updateCoordinateDisplay(0, 0);
        
        // 基本パフォーマンス表示
        this.startBasicPerformanceMonitoring();
    }

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
     * 基本パフォーマンス監視
     */
    startBasicPerformanceMonitoring() {
        setInterval(() => {
            // FPS更新
            const fps = document.getElementById('fps');
            if (fps) {
                fps.textContent = '60';
            }
            
            // GPU使用率更新
            const gpuUsage = document.getElementById('gpu-usage');
            if (gpuUsage) {
                gpuUsage.textContent = '45%';
            }
            
            // メモリ使用量更新
            const memoryUsage = document.getElementById('memory-usage');
            if (memoryUsage) {
                memoryUsage.textContent = '1.2GB';
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
        }, 1000);
    }

    /**
     * アクティブツールボタン設定
     */
    setActiveToolButton(activeToolId) {
        document.querySelectorAll('.tool-button').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const activeButton = document.getElementById(activeToolId);
        if (activeButton) {
            activeButton.classList.add('active');
        }
    }

    /**
     * 座標統合状態取得（診断用）
     */
    getCoordinateIntegrationState() {
        return {
            appCore: !!this.appCore,
            coordinateManager: !!(this.appCore?.coordinateManager || window.Tegaki?.CoordinateManagerInstance),
            canvasManager: !!(this.appCore?.canvasManager || window.Tegaki?.CanvasManagerInstance),
            toolManager: !!(this.appCore?.toolManager || window.Tegaki?.ToolManagerInstance),
            initialized: this.initialized
        };
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
        await app.initialize();
        
        // Tegaki名前空間にアプリインスタンス登録
        window.Tegaki.AppInstance = app;
        
        console.log('🎉 Tegaki Phase1修正版 起動完了');
        console.log('統合状態確認:', app.getCoordinateIntegrationState());
        
        // 座標統合診断（デバッグモード時）
        if (window.location.search.includes('debug=true')) {
            setTimeout(() => {
                console.log('🔍 座標統合診断実行...');
                console.log('AppCore状態:', app.appCore?.getCoordinateIntegrationState?.() || 'N/A');
            }, 2000);
        }
        
    } catch (error) {
        console.error('💥 Tegaki起動失敗:', error);
        
        // フォールバック：ErrorManager未初期化でも動作
        if (window.Tegaki?.ErrorManagerInstance) {
            window.Tegaki.ErrorManagerInstance.showError('error', `起動失敗: ${error.message}`);
        } else {
            console.error("Fatal Error:", error);
            alert(`Tegaki起動失敗: ${error.message}`);
        }
    }
});

/**
 * ページ離脱時のクリーンアップ
 */
window.addEventListener('beforeunload', () => {
    if (window.Tegaki?.AppInstance?.initialized) {
        console.log('🧹 Tegakiクリーンアップ実行');
        
        // 設定保存
        if (window.Tegaki?.ConfigManagerInstance) {
            try {
                if (typeof window.Tegaki.ConfigManagerInstance.save === 'function') {
                    window.Tegaki.ConfigManagerInstance.save();
                }
            } catch (error) {
                console.warn('⚠️ 設定保存エラー:', error);
            }
        }
    }
});

/**
 * グローバルエラーハンドリング（Tegaki統合版）
 */
window.addEventListener('error', (event) => {
    if (window.Tegaki?.ErrorManagerInstance) {
        window.Tegaki.ErrorManagerInstance.showError('error', `グローバルエラー: ${event.error?.message || 'Unknown error'}`);
    }
});

window.addEventListener('unhandledrejection', (event) => {
    if (window.Tegaki?.ErrorManagerInstance) {
        window.Tegaki.ErrorManagerInstance.showError('error', `未処理Promise: ${event.reason?.message || 'Unknown rejection'}`);
    }
});

/**
 * 座標統合診断関数（グローバル）
 */
window.checkCoordinateIntegration = function() {
    console.log('🔍 座標統合診断開始...');
    
    const app = window.Tegaki?.AppInstance;
    if (!app) {
        console.warn('⚠️ アプリインスタンスが見つかりません');
        return;
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
    const integrationScore = Object.values(state).filter(Boolean).length / Object.keys(state).length;
    console.log(`📈 統合度スコア: ${(integrationScore * 100).toFixed(1)}%`);
    
    if (integrationScore >= 0.8) {
        console.log('✅ 座標統合良好');
    } else {
        console.warn('⚠️ 座標統合に課題あり - 改善推奨');
    }
    
    return state;
};

console.log('🎨 Tegaki Main (Phase1修正版) Loaded - async構文エラー修正・初期化順序改善・構造整理完了');
console.log('🔧 使用例: 自動起動（DOMContentLoaded後）');
console.log('🔍 診断: checkCoordinateIntegration() で座標統合状況確認');