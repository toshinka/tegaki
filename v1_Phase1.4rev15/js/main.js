/**
 * 🎯 FutabaDrawingTool - メインアプリケーション
 * 📏 DESIGN_PRINCIPLE: 正しい初期化順序・責務分離・座標統合
 * 🔧 INITIALIZATION_ORDER: AppCore → CanvasManager → BoundaryManager → ToolManager
 * 🚫 LEFT_TOP_BUG_FIXED: 左上直線バグ対策統合済み
 * 
 * @version 1.0-Phase1.4-initialization-order-fixed
 * @author Tegaki Development Team
 * @since Phase1.0
 */

class FutabaDrawingTool {
    constructor() {
        // コアシステム
        this.appCore = null;
        this.canvasManager = null;
        this.coordinateManager = null;
        
        // マネージャー系
        this.toolManager = null;
        this.uiManager = null;
        this.boundaryManager = null;
        this.memoryManager = null;
        this.settingsManager = null;
        
        // 初期化状態
        this.initializationState = {
            configManager: false,
            errorManager: false,
            stateManager: false,
            eventBus: false,
            coordinateManager: false,
            canvasManager: false,
            boundaryManager: false,
            toolManager: false,
            uiManager: false,
            appCore: false
        };
        
        console.log('🎯 FutabaDrawingTool 初期化開始 - v1.0-Phase1.4-initialization-order-fixed');
    }

    /**
     * アプリケーション初期化
     * 🔧 INITIALIZATION_ORDER_FIX: 正しい順序で初期化実行
     * @returns {Promise<boolean>} 初期化成功可否
     */
    async initialize() {
        try {
            console.log('🚀 FutabaDrawingTool 初期化開始');

            // STEP 1: 基盤システム確認
            if (!this.verifyFoundationSystems()) {
                throw new Error('基盤システム確認失敗');
            }

            // STEP 2: 座標・境界システム初期化
            if (!await this.initializeCoordinateSystems()) {
                throw new Error('座標・境界システム初期化失敗');
            }

            // STEP 3: Manager統合初期化（正しい順序で）
            if (!await this.initializeManagersWithCoordinateIntegration()) {
                throw new Error('Manager統合初期化失敗');
            }

            // STEP 4: AppCore初期化
            if (!await this.initializeAppCore()) {
                throw new Error('AppCore初期化失敗');
            }

            // STEP 5: 最終統合確認
            if (!this.performFinalIntegrationCheck()) {
                console.warn('⚠️ 最終統合確認で問題を検出しましたが、続行します');
            }

            console.log('🎉 FutabaDrawingTool 初期化完了');
            console.log('📊 初期化状態:', this.initializationState);

            return true;

        } catch (error) {
            console.error('❌ FutabaDrawingTool 初期化エラー:', error);
            window.ErrorManager?.showErrorMessage('アプリケーション初期化失敗', error.message);
            return false;
        }
    }

    /**
     * 基盤システム確認
     * @returns {boolean} 確認成功可否
     */
    verifyFoundationSystems() {
        try {
            console.log('🔍 基盤システム確認開始');

            // 必須基盤システム確認
            const requiredSystems = [
                'ConfigManager',
                'ErrorManager', 
                'StateManager',
                'EventBus'
            ];

            for (const system of requiredSystems) {
                if (!window[system]) {
                    throw new Error(`${system} が見つかりません`);
                }
                this.initializationState[system.toLowerCase()] = true;
                console.log(`✅ ${system} 確認完了`);
            }

            console.log('✅ 基盤システム確認完了');
            return true;

        } catch (error) {
            console.error('❌ 基盤システム確認エラー:', error);
            return false;
        }
    }

    /**
     * 座標・境界システム初期化（✅ 修正版）
     * @returns {Promise<boolean>} 初期化成功可否
     */
    async initializeCoordinateSystems() {
        try {
            console.log('📏 座標・境界システム初期化開始');

            // CoordinateManager初期化
            if (window.CoordinateManager) {
                this.coordinateManager = new window.CoordinateManager();
                
                // ✅ 修正: initialize() メソッドは存在しないため、代わりに updateCanvasSize を使用
                // CoordinateManagerは constructor で自動的に初期化されるため、
                // 必要に応じてキャンバスサイズを設定するのみ
                if (typeof this.coordinateManager.updateCanvasSize === 'function') {
                    const canvasConfig = window.ConfigManager?.getCanvasConfig() || { width: 400, height: 400 };
                    this.coordinateManager.updateCanvasSize(canvasConfig.width, canvasConfig.height);
                }
                
                this.initializationState.coordinateManager = true;
                console.log('✅ CoordinateManager初期化完了');
            } else {
                console.warn('⚠️ CoordinateManager クラス未登録');
            }

            console.log('✅ 座標・境界システム初期化完了');
            return true;

        } catch (error) {
            console.error('❌ 座標・境界システム初期化エラー:', error);
            return false;
        }
    }

    /**
     * Manager統合初期化（正しい順序保証）
     * 🔧 INITIALIZATION_ORDER_FIX: CanvasManager → BoundaryManager → ToolManagerの順序
     * @returns {Promise<boolean>} 初期化成功可否
     */
    async initializeManagersWithCoordinateIntegration() {
        try {
            console.log('🔄 Manager統合初期化（座標統合対応）');

            // STEP 1: CanvasManager初期化（最優先）
            if (window.CanvasManager) {
                this.canvasManager = new window.CanvasManager();
                
                // CanvasManagerの初期化メソッドを確認して呼び出し
                if (typeof this.canvasManager.initialize === 'function') {
                    await this.canvasManager.initialize();
                } else if (typeof this.canvasManager.init === 'function') {
                    await this.canvasManager.init();
                } else {
                    console.warn('⚠️ CanvasManager: 初期化メソッドが見つかりません（続行）');
                }
                
                this.initializationState.canvasManager = true;
                console.log('✅ CanvasManager初期化完了');
            } else {
                throw new Error('CanvasManager クラス未登録');
            }

            // STEP 2: BoundaryManager初期化（CanvasManager依存）
            if (window.BoundaryManager && this.canvasManager) {
                this.boundaryManager = new window.BoundaryManager();
                
                // canvasElementの取得を試行
                let canvasElement = null;
                
                if (typeof this.canvasManager.getCanvasElement === 'function') {
                    canvasElement = this.canvasManager.getCanvasElement();
                }
                
                // fallback: DOMから取得
                if (!canvasElement) {
                    canvasElement = document.getElementById('drawing-canvas')?.querySelector('canvas');
                }
                
                if (canvasElement) {
                    await this.boundaryManager.initialize(canvasElement, this.coordinateManager);
                    this.initializationState.boundaryManager = true;
                    console.log('✅ BoundaryManager初期化完了');
                } else {
                    console.warn('⚠️ canvasElement取得失敗 - BoundaryManager基本機能のみ提供');
                }
            } else {
                console.warn('⚠️ BoundaryManager: canvasElementまたはCoordinateManager未提供 - 基本機能のみ提供');
            }

            // STEP 3: MemoryManager・SettingsManager初期化
            if (window.MemoryManager) {
                this.memoryManager = new window.MemoryManager();
                
                if (typeof this.memoryManager.initialize === 'function') {
                    await this.memoryManager.initialize();
                } else if (typeof this.memoryManager.init === 'function') {
                    await this.memoryManager.init();
                }
                
                console.log('✅ MemoryManager初期化完了');
            }

            if (window.SettingsManager) {
                this.settingsManager = new window.SettingsManager();
                
                if (typeof this.settingsManager.initialize === 'function') {
                    await this.settingsManager.initialize();
                } else if (typeof this.settingsManager.init === 'function') {
                    await this.settingsManager.init();
                }
                
                console.log('✅ SettingsManager初期化完了');
            }

            // STEP 4: ToolManager初期化（CanvasManager接続）
            if (window.ToolManager) {
                this.toolManager = new window.ToolManager();
                
                // ToolManagerの初期化
                if (typeof this.toolManager.initialize === 'function') {
                    await this.toolManager.initialize();
                } else if (typeof this.toolManager.init === 'function') {
                    await this.toolManager.init();
                } else {
                    console.warn('⚠️ ToolManager: 初期化メソッドが見つかりません（続行）');
                }
                
                // CanvasManager接続
                if (this.canvasManager && typeof this.toolManager.setCanvasManager === 'function') {
                    this.toolManager.setCanvasManager(this.canvasManager);
                    console.log('🔗 ToolManager: CanvasManager統合完了');
                } else {
                    console.warn('⚠️ ToolManager: CanvasManager未提供');
                }
                
                // CoordinateManager接続
                if (this.coordinateManager && typeof this.toolManager.setCoordinateManager === 'function') {
                    this.toolManager.setCoordinateManager(this.coordinateManager);
                    console.log('🔗 ToolManager: CoordinateManager統合完了');
                } else {
                    console.warn('⚠️ ToolManager: CoordinateManager統合をスキップ（メソッドまたはCoordinateManagerが見つかりません）');
                }
                
                this.initializationState.toolManager = true;
                console.log('✅ ToolManager統合初期化完了');
            } else {
                console.warn('⚠️ ToolManager クラス未登録');
            }

            // STEP 5: UIManager初期化
            if (window.UIManager) {
                this.uiManager = new window.UIManager();
                
                // UIManagerの初期化
                if (typeof this.uiManager.initialize === 'function') {
                    await this.uiManager.initialize();
                } else if (typeof this.uiManager.init === 'function') {
                    await this.uiManager.init();
                } else {
                    console.warn('⚠️ UIManager: 初期化メソッドが見つかりません（続行）');
                }
                
                this.initializationState.uiManager = true;
                console.log('✅ UIManager初期化完了');
            } else {
                console.warn('⚠️ UIManager クラス未登録');
            }

            console.log('🎉 全Manager統合初期化完了');
            return true;

        } catch (error) {
            console.error('❌ Manager統合初期化エラー:', error);
            window.ErrorManager?.showErrorMessage('Manager統合初期化失敗', error.message);
            return false;
        }
    }

    /**
     * AppCore初期化
     * @returns {Promise<boolean>} 初期化成功可否
     */
    async initializeAppCore() {
        try {
            console.log('⚡ AppCore初期化開始');

            if (!window.AppCore) {
                throw new Error('AppCore クラス未登録');
            }

            // AppCore作成・初期化
            this.appCore = new window.AppCore();
            
            // 必要なManagerを接続
            if (this.canvasManager) {
                this.appCore.canvasManager = this.canvasManager;
            }
            
            if (this.toolManager) {
                this.appCore.toolManager = this.toolManager;
            }
            
            if (this.coordinateManager) {
                this.appCore.coordinateManager = this.coordinateManager;
            }

            if (this.boundaryManager) {
                this.appCore.boundaryManager = this.boundaryManager;
            }

            // AppCore初期化実行
            const initResult = await this.appCore.initialize();
            if (initResult) {
                this.initializationState.appCore = true;
                console.log('✅ AppCore初期化完了');
                return true;
            } else {
                throw new Error('AppCore初期化が失敗しました');
            }

        } catch (error) {
            console.error('❌ AppCore初期化エラー:', error);
            return false;
        }
    }

    /**
     * 最終統合確認
     * @returns {boolean} 統合確認成功可否
     */
    performFinalIntegrationCheck() {
        try {
            console.log('🔍 最終統合確認開始');

            const issues = [];

            // CanvasManager統合確認
            if (!this.canvasManager) {
                issues.push('CanvasManager未初期化');
            }

            // ToolManager統合確認
            if (!this.toolManager) {
                issues.push('ToolManager未初期化');
            } else {
                // ToolManagerの状態確認メソッドが存在する場合のみ呼び出し
                if (typeof this.toolManager.getToolState === 'function') {
                    const toolState = this.toolManager.getToolState();
                    if (!toolState.canvasManagerConnected) {
                        issues.push('ToolManager: CanvasManager未接続');
                    }
                    if (!toolState.coordinateManagerConnected) {
                        issues.push('ToolManager: CoordinateManager未接続');
                    }
                } else {
                    console.warn('⚠️ ToolManager.getToolState() メソッドが見つかりません');
                }
            }

            // AppCore統合確認
            if (!this.appCore) {
                issues.push('AppCore未初期化');
            }

            // 結果出力
            if (issues.length === 0) {
                console.log('✅ 最終統合確認: 問題なし');
                return true;
            } else {
                console.warn('⚠️ 最終統合確認: 以下の問題を検出');
                issues.forEach(issue => console.warn(`  - ${issue}`));
                return false;
            }

        } catch (error) {
            console.error('❌ 最終統合確認エラー:', error);
            return false;
        }
    }

    /**
     * 座標統合確認（デバッグ用）
     * @returns {Object} 座標統合状態
     */
    checkCoordinateIntegration() {
        console.log('🔍 座標統合確認');

        const integrationStatus = {
            coordinateManager: !!this.coordinateManager,
            canvasManager: !!this.canvasManager,
            toolManager: !!this.toolManager,
            toolManagerCanvasConnected: false,
            toolManagerCoordinateConnected: false,
            appCore: !!this.appCore
        };

        // ToolManager接続状態詳細確認
        if (this.toolManager && typeof this.toolManager.getToolState === 'function') {
            try {
                const toolState = this.toolManager.getToolState();
                integrationStatus.toolManagerCanvasConnected = toolState.canvasManagerConnected || false;
                integrationStatus.toolManagerCoordinateConnected = toolState.coordinateManagerConnected || false;
            } catch (error) {
                console.warn('⚠️ ToolManager状態取得エラー:', error.message);
            }
        }

        // 統合完了判定
        const isFullyIntegrated = integrationStatus.coordinateManager && 
                                 integrationStatus.canvasManager && 
                                 integrationStatus.toolManager && 
                                 integrationStatus.toolManagerCanvasConnected && 
                                 integrationStatus.toolManagerCoordinateConnected;

        const recommendations = [];

        if (isFullyIntegrated) {
            console.log('✅ 座標統合完了');
        } else {
            console.warn('⚠️ 座標統合未完了 - 修正が必要');
            
            if (!integrationStatus.coordinateManager) {
                recommendations.push('CoordinateManager を初期化してください');
            }
            if (!integrationStatus.canvasManager) {
                recommendations.push('CanvasManager を初期化してください');
            }
            if (!integrationStatus.toolManagerCanvasConnected) {
                recommendations.push('ToolManager に CanvasManager を接続してください');
            }
            
            if (recommendations.length > 0) {
                console.log('💡 推奨事項:', recommendations);
            }
        }

        return {
            status: integrationStatus,
            isFullyIntegrated,
            recommendations
        };
    }

    /**
     * アプリケーション状態取得
     * @returns {Object} 現在の状態
     */
    getApplicationState() {
        return {
            version: '1.0-Phase1.4-initialization-order-fixed',
            initializationState: { ...this.initializationState },
            managers: {
                appCore: !!this.appCore,
                canvasManager: !!this.canvasManager,
                toolManager: !!this.toolManager,
                coordinateManager: !!this.coordinateManager,
                boundaryManager: !!this.boundaryManager,
                uiManager: !!this.uiManager,
                memoryManager: !!this.memoryManager,
                settingsManager: !!this.settingsManager
            },
            coordinateIntegration: this.checkCoordinateIntegration()
        };
    }

    /**
     * アプリケーション破棄
     */
    async dispose() {
        try {
            console.log('🗑️ FutabaDrawingTool破棄開始');

            // 各Managerの破棄（逆順）
            if (this.appCore && typeof this.appCore.destroy === 'function') {
                this.appCore.destroy();
            }

            if (this.uiManager && typeof this.uiManager.dispose === 'function') {
                await this.uiManager.dispose();
            } else if (this.uiManager && typeof this.uiManager.destroy === 'function') {
                this.uiManager.destroy();
            }

            if (this.toolManager && typeof this.toolManager.dispose === 'function') {
                await this.toolManager.dispose();
            } else if (this.toolManager && typeof this.toolManager.destroy === 'function') {
                this.toolManager.destroy();
            }

            if (this.boundaryManager && typeof this.boundaryManager.dispose === 'function') {
                await this.boundaryManager.dispose();
            } else if (this.boundaryManager && typeof this.boundaryManager.destroy === 'function') {
                this.boundaryManager.destroy();
            }

            if (this.canvasManager && typeof this.canvasManager.dispose === 'function') {
                await this.canvasManager.dispose();
            } else if (this.canvasManager && typeof this.canvasManager.destroy === 'function') {
                this.canvasManager.destroy();
            }

            if (this.coordinateManager && typeof this.coordinateManager.destroy === 'function') {
                this.coordinateManager.destroy();
            }

            // 参照クリア
            this.appCore = null;
            this.canvasManager = null;
            this.toolManager = null;
            this.coordinateManager = null;
            this.boundaryManager = null;
            this.uiManager = null;
            this.memoryManager = null;
            this.settingsManager = null;

            console.log('🗑️ FutabaDrawingTool破棄完了');

        } catch (error) {
            console.error('❌ FutabaDrawingTool破棄エラー:', error);
        }
    }
}

// アプリケーション実行部分
(async () => {
    try {
        // グローバルインスタンス作成
        window.futabaDrawingTool = new FutabaDrawingTool();
        
        // アプリケーション初期化
        const success = await window.futabaDrawingTool.initialize();
        
        if (success) {
            console.log('🎉 FutabaDrawingTool 起動成功');
            
            // デバッグ用グローバル関数登録
            window.checkCoordinateIntegration = () => {
                return window.futabaDrawingTool.checkCoordinateIntegration();
            };
            
            window.getApplicationState = () => {
                return window.futabaDrawingTool.getApplicationState();
            };
            
            console.log('🔧 デバッグ関数登録完了: checkCoordinateIntegration(), getApplicationState()');
            
        } else {
            console.error('❌ FutabaDrawingTool 起動失敗');
            window.ErrorManager?.showErrorMessage('アプリケーション起動失敗', 'アプリケーションの初期化に失敗しました。');
        }

    } catch (error) {
        console.error('❌ FutabaDrawingTool 起動時エラー:', error);
        window.ErrorManager?.showErrorMessage('アプリケーション起動エラー', error.message);
    }
})();

// 初期化完了通知
console.log('🎯 main.js v1.0-Phase1.4-initialization-order-fixed 読み込み完了');