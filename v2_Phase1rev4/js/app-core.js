/**
 * 🎨 AppCore (Phase1基本機能集中版 - スリム化)
 * 🎯 PHASE1修復内容:
 * 1. キャンバス出現の確実化
 * 2. 基本動作復旧に集中
 * 3. フォールバック肥大化の排除
 * 4. 構造の見通し改善
 * 
 * 🔧 スリム化方針:
 * - 不要なフォールバック処理削除
 * - 基本動作に必要な機能のみ実装
 * - Phase2準備機能は最小限に抑制
 * - エラー処理の簡素化
 * 
 * 📋 参考定義:
 * - 手順書: Phase 1: 緊急修復（基本動作復旧）
 * - ルールブック: 1.1 責務分離の絶対原則
 * - 指示: フォールバック肥大化防止・構造整理
 */

// Tegaki名前空間初期化
window.Tegaki = window.Tegaki || {};

class AppCore {
    constructor() {
        // 統一システム依存性
        this.configManager = null;
        this.errorManager = null;
        this.stateManager = null;
        this.eventBus = null;
        
        this.initializeUnifiedSystemReferences();
        this.initializeConfig();
        
        // 基本プロパティ
        this.app = null;
        this.drawingContainer = null;
        this.uiContainer = null;
        
        // 管理システム参照
        this.coordinateManager = null;
        this.canvasManager = null;
        this.toolManager = null;
        this.boundaryManager = null;
        this.uiManager = null;
        this.popupManager = null;
        
        // 状態管理
        this.isInitializing = false;
        this.initializationComplete = false;
        this.initializationFailed = false;
        
        console.log('🎨 AppCore (スリム化版) インスタンス作成完了');
    }
    
    /**
     * 統一システム参照初期化
     */
    initializeUnifiedSystemReferences() {
        this.configManager = window.Tegaki?.ConfigManagerInstance || window.ConfigManager || null;
        this.errorManager = window.Tegaki?.ErrorManagerInstance || window.ErrorManager || null;
        this.stateManager = window.Tegaki?.StateManagerInstance || window.StateManager || null;
        this.eventBus = window.Tegaki?.EventBusInstance || window.EventBus || null;
        
        const availableSystems = [];
        if (this.configManager) availableSystems.push('ConfigManager');
        if (this.errorManager) availableSystems.push('ErrorManager');
        if (this.stateManager) availableSystems.push('StateManager');
        if (this.eventBus) availableSystems.push('EventBus');
        
        console.log('🔧 統一システム参照:', availableSystems.join(', '));
    }
    
    /**
     * 設定初期化（ConfigManager統合）
     */
    initializeConfig() {
        try {
            if (this.configManager && typeof this.configManager.getCanvasConfig === 'function') {
                const canvasConfig = this.configManager.getCanvasConfig();
                this.canvasWidth = canvasConfig.width;
                this.canvasHeight = canvasConfig.height;
                this.backgroundColor = canvasConfig.backgroundColor;
                
                console.log('✅ ConfigManager設定初期化完了');
            } else {
                // 基本フォールバック設定のみ
                this.canvasWidth = 400;
                this.canvasHeight = 400;
                this.backgroundColor = 0xf0e0d6;
                
                console.warn('⚠️ ConfigManager未利用 - フォールバック設定使用');
            }
        } catch (error) {
            console.warn('⚠️ 設定初期化エラー:', error.message);
            // 最小限のフォールバック設定
            this.canvasWidth = 400;
            this.canvasHeight = 400;
            this.backgroundColor = 0xf0e0d6;
        }
    }
    
    /**
     * アプリケーション初期化（基本機能集中版）
     */
    async initialize() {
        try {
            console.log('🚀 AppCore (スリム化版) 初期化開始...');
            this.isInitializing = true;
            
            // Phase 1: 基盤システム初期化
            await this.initializeBasicSystems();
            
            // Phase 2: Manager初期化（重要なもののみ）
            await this.initializeEssentialManagers();
            
            // Phase 3: 統合・完了処理
            await this.completeInitialization();
            
            console.log('✅ AppCore (スリム化版) 初理化完了');
            
        } catch (error) {
            console.error('❌ AppCore 初期化失敗:', error);
            await this.handleInitializationError(error);
        }
    }
    
    /**
     * 基盤システム初期化
     */
    async initializeBasicSystems() {
        console.log('🔧 基盤システム初期化...');
        
        try {
            // DOM確認
            await this.verifyDOMElements();
            
            // PixiJSアプリケーション初期化
            await this.initializePixiApp();
            
            // コンテナ初期化
            this.initializeContainers();
            
            // CoordinateManager初期化（重要）
            this.initializeCoordinateManager();
            
            console.log('✅ 基盤システム初期化完了');
        } catch (error) {
            console.error('❌ 基盤システム初期化エラー:', error);
            throw error;
        }
    }
    
    /**
     * CoordinateManager初期化
     */
    initializeCoordinateManager() {
        console.log('📐 CoordinateManager初期化...');
        
        try {
            const CoordinateManagerCtor = window.Tegaki?.CoordinateManager || window.CoordinateManager;
            
            if (CoordinateManagerCtor) {
                this.coordinateManager = window.Tegaki?.CoordinateManagerInstance || 
                                         window.CoordinateManagerInstance ||
                                         new CoordinateManagerCtor();
                
                // キャンバスサイズ設定
                if (typeof this.coordinateManager.updateCanvasSize === 'function') {
                    this.coordinateManager.updateCanvasSize(this.canvasWidth, this.canvasHeight);
                }
                
                console.log('✅ CoordinateManager初期化完了');
            } else {
                console.warn('⚠️ CoordinateManager利用不可');
                this.coordinateManager = null;
            }
        } catch (error) {
            console.error('❌ CoordinateManager初期化失敗:', error);
            this.coordinateManager = null;
        }
    }
    
    /**
     * 重要なManager初期化のみ
     */
    async initializeEssentialManagers() {
        console.log('🔧 重要Manager初期化...');
        
        try {
            // CanvasManager初期化（最重要）
            await this.initializeCanvasManager();
            
            // ToolManager初期化
            await this.initializeToolManager();
            
            // PopupManager初理化（エラー表示用）
            await this.initializePopupManager();
            
            // ErrorManager統合（簡素版）
            await this.integrateErrorManager();
            
            console.log('✅ 重要Manager初期化完了');
        } catch (error) {
            console.error('❌ Manager初期化エラー:', error);
            throw error;
        }
    }
    
    /**
     * CanvasManager初期化（AppCore提供確実版）
     */
    async initializeCanvasManager() {
        try {
            console.log('🎨 CanvasManager初期化...');
            
            const CanvasManagerCtor = window.Tegaki?.CanvasManager || window.CanvasManager;

            if (!CanvasManagerCtor) {
                throw new Error('CanvasManagerクラスが利用できません');
            }

            // canvasElement取得
            const canvasElement = this.app?.view || 
                                 document.getElementById('drawing-canvas') ||
                                 document.querySelector('canvas');

            if (!canvasElement) {
                throw new Error('canvasElement を取得できませんでした');
            }

            // CanvasManager初期化
            this.canvasManager = new CanvasManagerCtor();
            
            const initSuccess = await this.canvasManager.initialize({
                appCore: this, // AppCore確実提供
                canvasElement: canvasElement,
                config: {
                    backgroundColor: this.backgroundColor,
                    antialias: true,
                    configManager: this.configManager, // ConfigManager統合
                    width: this.canvasWidth,
                    height: this.canvasHeight
                }
            });

            if (!initSuccess) {
                throw new Error('CanvasManager初期化が失敗しました');
            }

            console.log('✅ CanvasManager初期化完了');

        } catch (error) {
            console.error('❌ CanvasManager初期化エラー:', error);
            if (this.errorManager?.showError) {
                this.errorManager.showError('error', `CanvasManager初期化エラー: ${error.message}`);
            }
            this.canvasManager = null;
        }
    }

    /**
     * ToolManager初期化（基本版）
     */
    async initializeToolManager() {
        try {
            console.log('🔧 ToolManager初期化...');
            
            const ToolManagerCtor = window.Tegaki?.ToolManager || window.ToolManager;
            
            if (ToolManagerCtor) {
                this.toolManager = new ToolManagerCtor({ appCore: this });
                await this.toolManager.initialize();
                
                // CoordinateManager統合
                if (this.coordinateManager && 
                    typeof this.toolManager.initializeCoordinateManagerIntegration === 'function') {
                    this.toolManager.initializeCoordinateManagerIntegration(this.coordinateManager);
                }
                
                console.log('✅ ToolManager初期化完了');
            } else {
                console.warn('⚠️ ToolManager利用不可');
                this.toolManager = null;
            }
        } catch (error) {
            console.error('❌ ToolManager初期化エラー:', error);
            this.toolManager = null;
        }
    }

    /**
     * PopupManager初期化
     */
    async initializePopupManager() {
        try {
            console.log('🖼️ PopupManager初期化...');
            
            const PopupManagerCtor = window.Tegaki?.PopupManager || window.PopupManager;
            
            if (PopupManagerCtor) {
                this.popupManager = new PopupManagerCtor();
                await this.popupManager.initialize();
                console.log('✅ PopupManager初期化完了');
            } else {
                console.warn('⚠️ PopupManager利用不可');
                this.popupManager = null;
            }
        } catch (error) {
            console.error('❌ PopupManager初期化エラー:', error);
            this.popupManager = null;
        }
    }

    /**
     * ErrorManager統合（簡素版）
     */
    async integrateErrorManager() {
        try {
            if (this.errorManager && this.popupManager) {
                // ErrorManagerのPopupManager統合
                if (typeof this.errorManager.initializePopupIntegration === 'function') {
                    const integrationSuccess = this.errorManager.initializePopupIntegration(this.popupManager);
                    if (integrationSuccess) {
                        console.log('✅ ErrorManager-PopupManager統合完了');
                    }
                }
            }
        } catch (error) {
            console.warn('⚠️ ErrorManager統合エラー:', error);
        }
    }
    
    /**
     * 統合・完了処理
     */
    async completeInitialization() {
        try {
            // イベントリスナー設定
            this.setupEventListeners();
            
            // 初期化検証
            this.verifyInitialization();
            
            this.isInitializing = false;
            this.initializationComplete = true;
            
            // EventBus通知
            if (this.eventBus?.safeEmit) {
                this.eventBus.safeEmit('appCore.initialized', {
                    success: true,
                    components: this.getInitializationStats(),
                    timestamp: Date.now()
                });
            }
            
            console.log('🎉 AppCore初期化完全完了');
        } catch (error) {
            console.error('❌ 完了処理エラー:', error);
            throw error;
        }
    }

    /**
     * DOM要素確認
     */
    async verifyDOMElements() {
        const canvasElement = document.getElementById('drawing-canvas');
        if (!canvasElement) {
            throw new Error('drawing-canvas 要素が見つかりません');
        }
        
        // キャンバス要素クリア
        while (canvasElement.firstChild) {
            canvasElement.removeChild(canvasElement.firstChild);
        }
        
        console.log('✅ DOM要素確認完了');
    }

    /**
     * PixiJSアプリケーション初期化
     */
    async initializePixiApp() {
        try {
            let canvasConfig;
            
            if (this.configManager && typeof this.configManager.getCanvasConfig === 'function') {
                canvasConfig = this.configManager.getCanvasConfig();
            } else {
                canvasConfig = {
                    width: this.canvasWidth,
                    height: this.canvasHeight,
                    backgroundColor: this.backgroundColor
                };
            }
            
            this.app = new PIXI.Application({
                width: canvasConfig.width,
                height: canvasConfig.height,
                backgroundColor: canvasConfig.backgroundColor,
                antialias: true,
                resolution: window.devicePixelRatio || 1
            });
            
            const canvasElement = document.getElementById('drawing-canvas');
            canvasElement.appendChild(this.app.view);
            
            // キャンバス要素の基本設定
            this.app.view.style.cursor = 'crosshair';
            this.app.view.style.touchAction = 'none';
            
            console.log('✅ PixiJSアプリケーション初期化完了');
        } catch (error) {
            console.error('❌ PixiJSアプリケーション初期化失敗:', error);
            throw error;
        }
    }

    /**
     * コンテナ初期化
     */
    initializeContainers() {
        try {
            // 描画レイヤー
            this.drawingContainer = new PIXI.Container();
            this.drawingContainer.name = 'drawing-layer';
            this.app.stage.addChild(this.drawingContainer);
            
            // UIレイヤー
            this.uiContainer = new PIXI.Container();
            this.uiContainer.name = 'ui-layer';
            this.app.stage.addChild(this.uiContainer);
            
            // ステージのインタラクティブ設定
            this.app.stage.interactive = true;
            this.app.stage.hitArea = new PIXI.Rectangle(0, 0, this.canvasWidth, this.canvasHeight);
            
            console.log('✅ コンテナ初期化完了');
        } catch (error) {
            console.error('❌ コンテナ初期化失敗:', error);
            throw error;
        }
    }

    /**
     * イベントリスナー設定（CanvasManager委譲版）
     */
    setupEventListeners() {
        try {
            console.log('🎯 イベントリスナー設定...');
            
            // CanvasManagerが初期化済みの場合、描画イベントは委譲済み
            if (this.canvasManager && this.canvasManager.initialized) {
                console.log('🎨 描画イベントはCanvasManagerに委譲済み');
            } else {
                console.warn('⚠️ CanvasManager未初期化 - 基本イベント設定のみ');
                // 最小限のフォールバック
                this.app.stage.on('pointerdown', this.handlePointerDown.bind(this));
                this.app.stage.on('pointermove', this.handlePointerMove.bind(this));
                this.app.stage.on('pointerup', this.handlePointerUp.bind(this));
            }
            
            // ウィンドウイベント
            window.addEventListener('resize', this.handleResize.bind(this));
            
            console.log('✅ イベントリスナー設定完了');
        } catch (error) {
            console.error('❌ イベントリスナー設定エラー:', error);
        }
    }

    /**
     * ポインターダウンハンドラー（最小限フォールバック）
     */
    handlePointerDown(event) {
        if (!this.toolManager) {
            console.warn('⚠️ ToolManager が利用できません');
            return;
        }
        
        try {
            let coords;
            
            if (this.coordinateManager && typeof this.coordinateManager.extractPointerCoordinates === 'function') {
                coords = this.coordinateManager.extractPointerCoordinates(
                    event.data.originalEvent, 
                    this.app.view.getBoundingClientRect(), 
                    this.app
                );
            } else {
                // 基本座標処理
                const rect = this.app.view.getBoundingClientRect();
                const originalEvent = event.data.originalEvent;
                coords = {
                    canvas: {
                        x: originalEvent.clientX - rect.left,
                        y: originalEvent.clientY - rect.top
                    },
                    pressure: originalEvent.pressure || 0.5
                };
            }
            
            if (coords && this.toolManager.startDrawing) {
                this.toolManager.startDrawing(coords.canvas.x, coords.canvas.y, coords.pressure);
            }
        } catch (error) {
            console.error('❌ ポインターダウン処理エラー:', error);
        }
    }

    /**
     * ポインター移動ハンドラー（最小限フォールバック）
     */
    handlePointerMove(event) {
        try {
            let coords;
            
            if (this.coordinateManager && typeof this.coordinateManager.extractPointerCoordinates === 'function') {
                coords = this.coordinateManager.extractPointerCoordinates(
                    event.data.originalEvent, 
                    this.app.view.getBoundingClientRect()
                );
            } else {
                const rect = this.app.view.getBoundingClientRect();
                const originalEvent = event.data.originalEvent;
                coords = {
                    canvas: {
                        x: originalEvent.clientX - rect.left,
                        y: originalEvent.clientY - rect.top
                    },
                    pressure: originalEvent.pressure || 0.5
                };
            }
            
            if (coords) {
                // 座標表示更新
                this.updateCoordinateDisplay(coords.canvas);
                
                // ツール描画継続
                if (this.toolManager && this.toolManager.continueDrawing) {
                    this.toolManager.continueDrawing(coords.canvas.x, coords.canvas.y, coords.pressure);
                }
            }
        } catch (error) {
            console.warn('⚠️ ポインター移動処理エラー:', error.message);
        }
    }

    /**
     * ポインターアップハンドラー（最小限フォールバック）
     */
    handlePointerUp(event) {
        if (!this.toolManager) return;
        
        try {
            if (this.toolManager.stopDrawing) {
                this.toolManager.stopDrawing();
            }
        } catch (error) {
            console.error('❌ ポインターアップ処理エラー:', error);
        }
    }

    /**
     * 座標表示更新
     */
    updateCoordinateDisplay(canvasCoords) {
        try {
            const coordinatesElement = document.getElementById('coordinates');
            if (coordinatesElement) {
                coordinatesElement.textContent = `x: ${Math.round(canvasCoords.x)}, y: ${Math.round(canvasCoords.y)}`;
            }
        } catch (error) {
            // 座標表示エラーは致命的ではない
        }
    }

    /**
     * リサイズハンドラー
     */
    handleResize() {
        if (!this.app) return;
        
        try {
            // CanvasManagerに委譲
            if (this.canvasManager && typeof this.canvasManager.resize === 'function') {
                this.canvasManager.resize(this.canvasWidth, this.canvasHeight);
            }
            
            // CoordinateManagerに通知
            if (this.coordinateManager && typeof this.coordinateManager.updateCanvasSize === 'function') {
                this.coordinateManager.updateCanvasSize(this.canvasWidth, this.canvasHeight);
            }
        } catch (error) {
            console.error('❌ リサイズ処理エラー:', error);
        }
    }

    /**
     * 初期化エラー処理（簡素版）
     */
    async handleInitializationError(error) {
        console.error('💀 AppCore初期化エラー:', error);
        
        this.initializationFailed = true;
        this.isInitializing = false;
        
        if (this.errorManager?.showCriticalError) {
            this.errorManager.showCriticalError(`AppCore初期化失敗: ${error.message}`, {
                context: 'AppCore.initialize',
                showReload: true
            });
        }
        
        // 最小限フォールバックモード
        await this.initializeMinimalFallback(error);
    }

    /**
     * 初期化検証（簡素版）
     */
    verifyInitialization() {
        const verification = {
            pixiApp: !!this.app,
            drawingContainer: !!this.drawingContainer,
            coordinateManager: !!this.coordinateManager,
            canvasManager: !!this.canvasManager,
            toolManager: !!this.toolManager
        };
        
        const passCount = Object.values(verification).filter(Boolean).length;
        const totalCount = Object.keys(verification).length;
        
        console.log(`✅ 初期化検証: ${passCount}/${totalCount} (${(passCount/totalCount*100).toFixed(1)}%)`);
        
        if (passCount < 3) {
            const failed = Object.entries(verification)
                .filter(([key, value]) => !value)
                .map(([key]) => key);
            
            console.warn('⚠️ 初期化未完了:', failed.join(', '));
        }
    }

    /**
     * 初期化統計取得
     */
    getInitializationStats() {
        return {
            pixiApp: !!this.app,
            drawingContainer: !!this.drawingContainer,
            coordinateManager: !!this.coordinateManager,
            canvasManager: !!this.canvasManager,
            toolManager: !!this.toolManager,
            popupManager: !!this.popupManager,
            initializationComplete: this.initializationComplete,
            initializationFailed: this.initializationFailed,
            unifiedSystems: {
                configManager: !!this.configManager,
                errorManager: !!this.errorManager,
                stateManager: !!this.stateManager,
                eventBus: !!this.eventBus
            }
        };
    }

    /**
     * 最小限フォールバックモード
     */
    async initializeMinimalFallback(originalError) {
        console.log('🛡️ 最小限フォールバックモード...');
        
        try {
            // PixiJSアプリケーションが未作成の場合のみ作成
            if (!this.app) {
                this.app = new PIXI.Application({
                    width: 400,
                    height: 400,
                    backgroundColor: 0xf0e0d6
                });
                
                const canvasElement = document.getElementById('drawing-canvas');
                if (canvasElement) {
                    canvasElement.appendChild(this.app.view);
                }
            }
            
            // 基本コンテナ作成
            if (!this.drawingContainer) {
                this.initializeContainers();
            }
            
            console.log('✅ 最小限フォールバック完了');
        } catch (fallbackError) {
            console.error('💀 フォールバックモード失敗:', fallbackError);
        }
    }

    /**
     * システム破棄
     */
    destroy() {
        try {
            console.log('🎨 AppCore 破棄開始...');
            
            // Manager破棄
            if (this.canvasManager && typeof this.canvasManager.destroy === 'function') {
                this.canvasManager.destroy();
                this.canvasManager = null;
            }
            
            if (this.toolManager && typeof this.toolManager.destroy === 'function') {
                this.toolManager.destroy();
                this.toolManager = null;
            }
            
            if (this.coordinateManager && typeof this.coordinateManager.destroy === 'function') {
                this.coordinateManager.destroy();
                this.coordinateManager = null;
            }
            
            // PixiJSアプリケーション破棄
            if (this.app) {
                this.app.destroy(true);
                this.app = null;
            }
            
            // プロパティクリア
            this.drawingContainer = null;
            this.uiContainer = null;
            this.initializationComplete = false;
            this.initializationFailed = false;
            
            console.log('🎨 AppCore 破棄完了');
        } catch (error) {
            console.error('❌ AppCore破棄エラー:', error);
        }
    }
}

// Tegaki名前空間に登録
window.Tegaki.AppCore = AppCore;

// 初期化レジストリ方式
window.Tegaki._registry = window.Tegaki._registry || [];
window.Tegaki._registry.push(() => {
    window.Tegaki.AppCoreInstance = new AppCore();
    console.log('🎨 Tegaki.AppCoreInstance registered');
});

// グローバル登録（下位互換）
if (typeof window !== 'undefined') {
    window.AppCore = AppCore;
}

console.log('🎨 AppCore (スリム化版) Loaded - 基本機能集中・フォールバック肥大化排除');
console.log('🎯 Phase1重点: キャンバス出現・基本動作復旧・構造見通し改善');
console.log('🔧 使用例: const appCore = new AppCore(); await appCore.initialize();');