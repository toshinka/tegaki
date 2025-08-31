/**
 * 🎯 TegakiApplication - Phase1.5 CoordinateManager統合・AppCore連携修正版
 * 📋 RESPONSIBILITY: メインアプリケーション・UI連携・イベント設定・キャンバス作成・座標管理統合
 * 🚫 PROHIBITION: Manager作成・描画処理・エラー処理・直接座標変換
 * ✅ PERMISSION: AppCore作成・UI連携・イベント設定・PixiJS Application作成・CoordinateManager活用
 * 
 * 📏 DESIGN_PRINCIPLE: UIアプリケーション専門・AppCore統合・座標管理統合・キャンバス外描画対応
 * 🔄 INTEGRATION: AppCore + PixiJS + DOM UI + CoordinateManager の統合管理
 * 🎯 FEATURE: キャンバス外描画・正確な座標変換・Phase1.5基盤確立
 * 🔧 FIX: AppCore連携修正・IconRenderer修正・イベント処理修正
 */

// if (!window.XXX) ガードで多重定義を防ぐ
if (!window.Tegaki) {
    window.Tegaki = {};
}

if (!window.Tegaki.TegakiApplication) {
    /**
     * TegakiApplication - Phase1.5 CoordinateManager統合・AppCore連携修正版
     * AppCoreを使ってManager統合・UI連携・座標管理統合を行う
     */
    class TegakiApplication {
        constructor() {
            console.log('🎯 TegakiApplication Phase1.5 作成・CoordinateManager統合・自動初期化開始');
            
            this.initialized = false;
            this.pixiApp = null;
            this.appCore = null;
            this.coordinateManager = null;  // 🆕 Phase1.5: 座標管理追加
            
            // 自動初期化実行
            this.initialize().catch(error => {
                console.error('💀 TegakiApplication 初期化失敗:', error);
                if (window.Tegaki?.ErrorManagerInstance) {
                    window.Tegaki.ErrorManagerInstance.showCritical(
                        `TegakiApplication初期化失敗: ${error.message}`,
                        { context: 'TegakiApplication.constructor' }
                    );
                }
                throw error;
            });
        }
        
        /**
         * 初期化（Phase1.5版：CoordinateManager統合）
         */
        async initialize() {
            try {
                console.log('🚀 TegakiApplication Phase1.5 初期化開始');
                
                // 🆕 0. CoordinateManager初期化（最優先）
                this.initializeCoordinateManager();
                
                // 1. AppCore初期化（CanvasManagerのみ作成）
                await this.initializeAppCore();
                
                // 2. PixiJS Application作成・CanvasManagerに設定
                this.createCanvas();
                
                // 🆕 3. CoordinateManagerにCanvas要素設定（重要）
                this.setupCoordinateManager();
                
                // 4. ToolManager初期化（PixiJS設定後に実行）
                await this.initializeToolManager();
                
                // 5. UI設定（イベント・アイコン・ボタン）
                this.setupUI();
                
                // 6. アプリケーション開始
                this.appCore.start();
                
                this.initialized = true;
                this.showSuccessMessage();
                
                console.log('✅ TegakiApplication Phase1.5 初期化完了 - CoordinateManager統合済み');
                
            } catch (error) {
                console.error('❌ TegakiApplication 初期化エラー:', error);
                throw error;
            }
        }
        
        /**
         * 🆕 CoordinateManager初期化
         */
        initializeCoordinateManager() {
            if (!window.Tegaki.CoordinateManager) {
                throw new Error('CoordinateManager class not available');
            }
            
            this.coordinateManager = new window.Tegaki.CoordinateManager();
            console.log('✅ CoordinateManager初期化完了');
        }
        
        /**
         * AppCore初期化（CanvasManagerのみ）
         */
        async initializeAppCore() {
            if (!window.Tegaki.AppCore) {
                throw new Error('AppCore class not available');
            }
            
            this.appCore = new window.Tegaki.AppCore();
            
            // CanvasManagerのみ初期化（ToolManagerは後で）
            await this.appCore.initializeCanvasManager();
            
            console.log('✅ AppCore初期化完了（CanvasManagerのみ）');
        }
        
        /**
         * PixiJS Application作成・DOM配置（Phase1.5版：座標ズレ防止強化）
         */
        createCanvas() {
            if (!window.PIXI) {
                throw new Error('PixiJS not loaded');
            }
            
            const config = window.Tegaki.ConfigManagerInstance.getCanvasConfig();
            
            // 🔧 PixiJS Application作成（Phase1.5最適化）
            this.pixiApp = new PIXI.Application({
                width: config.width,
                height: config.height,
                backgroundColor: 0x000000,    // 黒（後で透明化）
                backgroundAlpha: 0,           // 完全透明
                antialias: true,
                resolution: 1,                // 🔧 固定解像度で座標ズレ防止
                autoDensity: false            // 🔧 自動密度調整無効化
            });
            
            // 🎨 DOM配置（Canvas要素に座標ズレ防止スタイル適用・Phase1.5強化）
            const container = document.getElementById('canvas-container');
            if (!container) {
                throw new Error('Canvas container not found');
            }
            
            // 🔧 Canvas要素のスタイル設定（Phase1.5完全最適化）
            const canvasElement = this.pixiApp.view;
            canvasElement.style.width = config.width + 'px';
            canvasElement.style.height = config.height + 'px';
            canvasElement.style.border = 'none';              // 枠なし
            canvasElement.style.borderRadius = '0';           // 角丸なし
            canvasElement.style.backgroundColor = 'transparent'; // 背景透明
            canvasElement.style.cursor = 'crosshair';
            canvasElement.style.display = 'block';
            canvasElement.style.position = 'relative';        // 🔧 相対配置で座標基準明確化
            canvasElement.style.left = '0';                   // 🔧 左オフセット0
            canvasElement.style.top = '0';                    // 🔧 上オフセット0
            canvasElement.style.margin = '0';                 // 🔧 マージン0
            canvasElement.style.padding = '0';                // 🔧 パディング0
            canvasElement.style.transform = 'none';           // 🔧 トランスフォーム無効化
            canvasElement.style.boxSizing = 'content-box';    // 🆕 ボックスサイズ明確化
            canvasElement.style.outline = 'none';             // 🆕 アウトライン無効化
            
            container.appendChild(canvasElement);
            
            // AppCoreのCanvasManagerにPixiApp設定
            this.appCore.setPixiApp(this.pixiApp);
            
            console.log('✅ PixiJS Canvas作成・配置・CanvasManager設定完了（Phase1.5座標ズレ防止強化版）');
            console.log(`📏 Canvas設定: ${config.width}x${config.height}px, resolution=1, autoDensity=false`);
        }
        
        /**
         * 🆕 CoordinateManagerにCanvas要素設定
         */
        setupCoordinateManager() {
            if (!this.coordinateManager || !this.pixiApp?.view) {
                throw new Error('CoordinateManager or Canvas not ready');
            }
            
            // CoordinateManagerにCanvas要素設定
            this.coordinateManager.setCanvasElement(this.pixiApp.view);
            
            console.log('✅ CoordinateManager - Canvas要素設定完了');
        }
        
        /**
         * ToolManager初期化（PixiJS設定後）
         */
        async initializeToolManager() {
            // PixiJS設定後にToolManager初期化
            await this.appCore.initializeToolManager();
            
            console.log('✅ ToolManager初期化完了（PixiJS設定後）');
        }
        
        /**
         * UI設定（イベント・アイコン・ボタン）
         */
        setupUI() {
            this.setupCanvasEvents();
            this.setupToolButtons();
            this.setupIcons();  // 重要：アイコン適用
            this.updateStatusDisplay();
            
            console.log('✅ UI設定完了');
        }
        
        /**
         * キャンバスイベント設定（Phase1.5版）
         */
        setupCanvasEvents() {
            if (!this.pixiApp?.view) {
                throw new Error('Canvas view not available');
            }
            
            const canvas = this.pixiApp.view;
            
            // 🔧 ポインターイベント設定（Phase1.5 CoordinateManager統合）
            canvas.addEventListener('pointerdown', (e) => this.handlePointerDown(e));
            canvas.addEventListener('pointermove', (e) => this.handlePointerMove(e));
            canvas.addEventListener('pointerup', (e) => this.handlePointerUp(e));
            
            // 🔧 マウス座標表示（Phase1.5 CoordinateManager対応）
            canvas.addEventListener('pointermove', (e) => this.updateCoordinateDisplay(e));
            
            // 🔧 コンテキストメニュー無効化
            canvas.addEventListener('contextmenu', (e) => e.preventDefault());
            
            console.log('✅ Canvasイベント設定完了（Phase1.5 CoordinateManager統合版）');
        }
        
        /**
         * 🆕 ポインターダウン処理（CoordinateManager統合版）
         */
        handlePointerDown(event) {
            if (!this.appCore) return;
            
            // 🆕 CoordinateManager使用の座標変換
            const coords = this.getCanvasCoordinates(event);
            
            if (coords === null) {
                // 描画許可エリア外：何もしない
                console.log('🚫 描画許可エリア外のため描画スキップ');
                return;
            }
            
            // 🔧 修正：ToolManager経由でイベント処理
            const toolManager = this.appCore.getToolManager();
            if (toolManager) {
                toolManager.handlePointerDown(coords.x, coords.y, event);
            }
        }
        
        /**
         * 🆕 ポインタームーブ処理（CoordinateManager統合版）
         */
        handlePointerMove(event) {
            if (!this.appCore) return;
            
            // 🆕 CoordinateManager使用の座標変換
            const coords = this.getCanvasCoordinates(event);
            
            if (coords === null) {
                // 描画許可エリア外でも座標表示は継続
                this.updateCoordinateDisplay(event, true);
                return;
            }
            
            // 🔧 修正：ToolManager経由でイベント処理
            const toolManager = this.appCore.getToolManager();
            if (toolManager) {
                toolManager.handlePointerMove(coords.x, coords.y, event);
            }
        }
        
        /**
         * 🆕 ポインターアップ処理（CoordinateManager統合版）
         */
        handlePointerUp(event) {
            if (!this.appCore) return;
            
            // 🆕 CoordinateManager使用の座標変換
            const coords = this.getCanvasCoordinates(event);
            
            // 座標が無効でもアップイベントは処理（描画終了のため）
            const finalX = coords ? coords.x : -1;
            const finalY = coords ? coords.y : -1;
            
            // 🔧 修正：ToolManager経由でイベント処理
            const toolManager = this.appCore.getToolManager();
            if (toolManager) {
                toolManager.handlePointerUp(finalX, finalY, event);
            }
        }
        
        /**
         * 🆕 Canvas座標取得（CoordinateManager統合・Phase1.5版）
         */
        getCanvasCoordinates(event) {
            if (!this.coordinateManager) {
                console.warn('⚠️ CoordinateManager not available');
                return null;
            }
            
            // CoordinateManagerで座標変換
            const result = this.coordinateManager.screenToCanvas(event.clientX, event.clientY);
            
            if (!result.isValid) {
                console.warn('⚠️ 座標変換失敗');
                return null;
            }
            
            // キャンバス外でも描画許可エリア内なら描画可能
            if (result.canDraw) {
                return {
                    x: result.x,
                    y: result.y,
                    isInsideCanvas: result.isInsideCanvas,
                    isExtended: !result.isInsideCanvas && result.isInExtendedArea
                };
            } else {
                // 描画許可エリア外
                return null;
            }
        }
        
        /**
         * 🆕 座標表示更新（CoordinateManager対応版）
         */
        updateCoordinateDisplay(event, isOutOfBounds = false) {
            const coordElement = document.getElementById('coordinates');
            if (!coordElement) return;
            
            if (isOutOfBounds) {
                coordElement.textContent = 'x: ---, y: ---';
                return;
            }
            
            const coords = this.getCanvasCoordinates(event);
            if (coords) {
                const status = coords.isExtended ? ' (外)' : '';
                coordElement.textContent = `x: ${Math.round(coords.x)}, y: ${Math.round(coords.y)}${status}`;
            } else {
                coordElement.textContent = 'x: ---, y: ---';
            }
        }
        
        /**
         * ツールボタン設定
         */
        setupToolButtons() {
            // ペンツールボタン
            const penButton = document.getElementById('pen-tool');
            if (penButton) {
                penButton.addEventListener('click', () => {
                    this.selectTool('pen');
                });
            }
            
            // 消しゴムツールボタン
            const eraserButton = document.getElementById('eraser-tool');
            if (eraserButton) {
                eraserButton.addEventListener('click', () => {
                    this.selectTool('eraser');
                });
            }
            
            // レイヤーボタン（Phase2準備）
            const layersButton = document.getElementById('layers-tool');
            if (layersButton) {
                layersButton.addEventListener('click', () => {
                    this.toggleLayerPanel();
                });
            }
            
            console.log('✅ ツールボタン設定完了');
        }
        
        /**
         * 🔧 修正：アイコン設定（正しいTegakiIcons呼び出し）
         */
        setupIcons() {
            try {
                if (window.Tegaki?.TegakiIcons) {
                    // 🔧 修正：正しいメソッド呼び出し
                    window.Tegaki.TegakiIcons.replaceAllToolIcons();
                    console.log('✅ アイコン設定完了（TegakiIcons.replaceAllToolIcons）');
                } else if (window.TegakiIcons) {
                    // 🔧 追加：グローバルTegakiIconsの場合
                    window.TegakiIcons.replaceAllToolIcons();
                    console.log('✅ アイコン設定完了（グローバルTegakiIcons）');
                } else {
                    console.warn('⚠️ TegakiIcons not available - アイコンは後で表示されます');
                }
            } catch (error) {
                console.error('❌ アイコン設定エラー:', error);
                // アイコンエラーでアプリ停止させない
                console.warn('⚠️ アイコン設定をスキップして続行します');
            }
        }
        
        /**
         * 🔧 修正：ステータス表示更新（AppCore連携修正）
         */
        updateStatusDisplay() {
            // キャンバス情報表示
            const canvasInfo = document.getElementById('canvas-info');
            if (canvasInfo && this.pixiApp) {
                const width = this.pixiApp.screen.width;
                const height = this.pixiApp.screen.height;
                canvasInfo.textContent = `${width}×${height}px`;
            }
            
            // 🔧 修正：現在ツール表示（ToolManager経由で取得）
            const currentTool = document.getElementById('current-tool');
            if (currentTool) {
                const toolManager = this.appCore?.getToolManager();
                if (toolManager && toolManager.getCurrentToolName) {
                    const toolName = toolManager.getCurrentToolName();
                    const toolDisplayNames = {
                        pen: 'ベクターペン',
                        eraser: '消しゴム'
                    };
                    currentTool.textContent = toolDisplayNames[toolName] || toolName || 'ベクターペン';
                } else {
                    currentTool.textContent = 'ベクターペン';
                }
            }
            
            // 🔧 修正：現在色表示（設定から取得）
            const currentColor = document.getElementById('current-color');
            if (currentColor) {
                // デフォルト色表示（ツール設定から取得は将来実装）
                currentColor.textContent = '#800000';
            }
        }
        
        /**
         * ツール選択（Phase1.5版）
         */
        selectTool(toolName) {
            if (!this.appCore) {
                console.warn('⚠️ AppCore not ready');
                return;
            }
            
            // 🔧 修正：AppCore経由でツール選択（selectToolメソッド使用）
            const success = this.appCore.selectTool(toolName);
            
            if (success) {
                // UI更新
                this.updateToolButtons(toolName);
                this.updateStatusDisplay();
                
                console.log(`🔧 ツール選択完了: ${toolName}`);
            } else {
                console.warn(`⚠️ ツール選択失敗: ${toolName}`);
                
                if (window.Tegaki?.ErrorManagerInstance) {
                    window.Tegaki.ErrorManagerInstance.showWarning(
                        `ツール "${toolName}" が選択できませんでした`,
                        { context: 'TegakiApplication.selectTool' }
                    );
                }
            }
        }
        
        /**
         * ツールボタン表示更新
         */
        updateToolButtons(selectedTool) {
            // 全てのツールボタンからactiveクラスを削除
            const toolButtons = document.querySelectorAll('.tool-button');
            toolButtons.forEach(button => button.classList.remove('active'));
            
            // 選択されたツールボタンにactiveクラスを追加
            const toolButtonMap = {
                'pen': 'pen-tool',
                'eraser': 'eraser-tool'
            };
            
            const buttonId = toolButtonMap[selectedTool];
            if (buttonId) {
                const button = document.getElementById(buttonId);
                if (button) {
                    button.classList.add('active');
                }
            }
        }
        
        /**
         * レイヤーパネル切り替え（Phase2準備）
         */
        toggleLayerPanel() {
            console.log('🎨 レイヤーパネル切り替え（Phase2で実装予定）');
            
            if (window.Tegaki?.ErrorManagerInstance) {
                window.Tegaki.ErrorManagerInstance.showInfo(
                    'レイヤー機能はPhase2で実装予定です',
                    { context: 'TegakiApplication.toggleLayerPanel' }
                );
            }
        }
        
        /**
         * 成功メッセージ表示
         */
        showSuccessMessage() {
            console.log('🎉 TegakiApplication Phase1.5 初期化成功！');
            console.log('📏 CoordinateManager統合完了 - キャンバス外描画対応');
            console.log('🎯 Phase1.5基盤確立 - NavigationManager・RecordManager準備完了');
            
            // 成功通知（UI）
            if (window.Tegaki?.ErrorManagerInstance) {
                window.Tegaki.ErrorManagerInstance.showInfo(
                    'Phase1.5基盤初期化完了 - CoordinateManager統合・キャンバス外描画対応完了',
                    { 
                        context: 'TegakiApplication.initialize'
                    }
                );
            }
        }
        
        /**
         * Phase1.5機能テスト（デバッグ用）
         */
        testPhase15Features() {
            console.log('🧪 Phase1.5機能テスト開始');
            
            const testResults = {
                coordinateManager: !!this.coordinateManager,
                canvasTransform: false,
                extendedDrawArea: false,
                coordinateConversion: false,
                toolManager: false
            };
            
            // CoordinateManager機能テスト
            if (this.coordinateManager) {
                try {
                    // 座標変換テスト
                    const testCoord = this.coordinateManager.screenToCanvas(100, 100);
                    testResults.coordinateConversion = testCoord.isValid;
                    
                    // 拡張描画エリアテスト
                    const extendedArea = this.coordinateManager.getExtendedDrawArea();
                    testResults.extendedDrawArea = extendedArea.margin === 20;
                    
                    // 変形機能テスト（基本）
                    const transform = this.coordinateManager.getCanvasTransform();
                    testResults.canvasTransform = transform !== null;
                    
                } catch (error) {
                    console.error('❌ CoordinateManager機能テストエラー:', error);
                }
            }
            
            // ToolManager機能テスト
            if (this.appCore) {
                const toolManager = this.appCore.getToolManager();
                testResults.toolManager = !!toolManager && toolManager.isReady?.();
            }
            
            console.log('🧪 Phase1.5機能テスト結果:', testResults);
            return testResults;
        }
        
        /**
         * Phase1.5デバッグ情報取得
         */
        getPhase15DebugInfo() {
            return {
                // 基本状態
                initialized: this.initialized,
                pixiAppReady: !!this.pixiApp,
                appCoreReady: !!this.appCore,
                coordinateManagerReady: !!this.coordinateManager,
                
                // CoordinateManager情報
                coordinateManager: this.coordinateManager ? 
                    this.coordinateManager.getDebugInfo() : null,
                
                // Canvas情報
                canvas: this.pixiApp ? {
                    width: this.pixiApp.screen.width,
                    height: this.pixiApp.screen.height,
                    resolution: this.pixiApp.renderer.resolution,
                    backgroundColor: this.pixiApp.renderer.backgroundColor
                } : null,
                
                // AppCore情報
                appCore: this.appCore ? {
                    canvasManagerReady: this.appCore.getCanvasManager?.() !== null,
                    toolManagerReady: this.appCore.getToolManager?.() !== null,
                    isReady: this.appCore.isReady?.() || false
                } : null,
                
                // ToolManager情報
                toolManager: (() => {
                    const toolManager = this.appCore?.getToolManager();
                    return toolManager ? {
                        ready: toolManager.isReady?.() || false,
                        currentTool: toolManager.getCurrentToolName?.() || 'unknown'
                    } : null;
                })(),
                
                // UI情報
                ui: {
                    canvasContainer: !!document.getElementById('canvas-container'),
                    toolButtons: document.querySelectorAll('.tool-button').length,
                    statusPanel: !!document.querySelector('.status-panel')
                },
                
                // Phase情報
                phase: {
                    current: '1.5',
                    features: {
                        coordinateManager: !!this.coordinateManager,
                        extendedDrawArea: true,
                        canvasEvents: true,
                        toolButtons: true
                    },
                    nextPhase: {
                        target: '1.5-Navigation',
                        requiredComponents: [
                            'NavigationManager',
                            'RecordManager', 
                            'ShortcutManager'
                        ]
                    }
                }
            };
        }
    }
    
    // Tegaki名前空間に登録
    window.Tegaki.TegakiApplication = TegakiApplication;
}

console.log('🎯 TegakiApplication Phase1.5 CoordinateManager統合・AppCore連携修正版 Loaded');
console.log('📏 キャンバス外描画対応・座標変換統合・Phase1.5基盤確立・AppCore連携修正完了');
console.log('🚀 app-core.js loaded - Phase1.5基盤・CoordinateManager統合・UI連携・AppCore修正完成');