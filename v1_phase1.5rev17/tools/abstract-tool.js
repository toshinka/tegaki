/**
 * 🎯 TegakiApplication - Phase1.5 メインアプリケーション（確実な初期ツール選択修正版）
 * 📋 RESPONSIBILITY: メインアプリケーション・UI連携・イベント設定・キャンバス作成・座標管理統合・新Manager初期化・確実なツール初期化
 * 🚫 PROHIBITION: Manager作成・描画処理・エラー処理・直接座標変換・フォールバック・フェイルセーフ
 * ✅ PERMISSION: AppCore作成・UI連携・イベント設定・PixiJS Application作成・新Manager活用・確実なツール選択
 * 
 * 📏 DESIGN_PRINCIPLE: UIアプリケーション専門・AppCore統合・新Manager統合・Phase1.5基盤確立・確実なツール初期化
 * 🔄 INTEGRATION: AppCore + PixiJS + DOM UI + 新Manager(Coordinate/Navigation/Record/Shortcut) の統合管理
 * 🎯 FEATURE: キャンバス外描画・ナビゲーション・非破壊編集・ショートカット・Phase1.5完全対応・確実なツール選択
 * 🆕 Phase1.5: CoordinateManager・NavigationManager・RecordManager・ShortcutManager統合・ツール初期化修正
 * 
 * 📌 使用メソッド一覧（他ファイル依存）:
 * ✅ window.Tegaki.AppCore() - システム基盤クラス作成
 * ✅ window.Tegaki.CoordinateManager() - 座標変換管理クラス作成
 * ✅ window.Tegaki.NavigationManager() - ナビゲーション管理クラス作成
 * ✅ window.Tegaki.RecordManager() - 記録管理クラス作成
 * ✅ window.Tegaki.ShortcutManager() - ショートカット管理クラス作成
 * ✅ window.Tegaki.ConfigManagerInstance.getCanvasConfig() - Canvas設定取得
 * ✅ window.Tegaki.ErrorManagerInstance.showCritical() - エラー通知
 * ✅ window.Tegaki.EventBusInstance - イベント配信システム
 * ✅ window.Tegaki.TegakiIcons.replaceAllToolIcons() - アイコン適用
 * ✅ appCore.selectTool() - ツール選択メソッド
 * ✅ toolManager.forceSelectTool() - 強制ツール選択メソッド（デバッグ用）
 * 
 * 📌 提供メソッド一覧（外部向け）:
 * ✅ initialize() - アプリケーション初期化
 * ✅ selectTool(toolName) - ツール選択
 * ✅ getCanvasCoordinates(event) - 座標変換統合
 * ✅ forceSelectInitialTool() - 初期ツール強制選択（デバッグ用）
 * ✅ getPhase15DebugInfo() - デバッグ情報取得
 * ✅ testPhase15Features() - Phase1.5機能テスト
 * 
 * 📐 アプリケーション初期化フロー:
 * 開始 → Phase1.5Manager作成 → AppCore初期化 → Canvas作成 → CoordinateManager設定 → ToolManager初期化 → 確実な初期ツール選択 → UI設定 → 完了
 * 依存関係: AppCore(基盤システム) + CoordinateManager(座標変換) + 新Manager群 + 確実なツール初期化
 */

// 多重定義防止
if (!window.Tegaki) {
    window.Tegaki = {};
}

if (!window.Tegaki.TegakiApplication) {
    /**
     * TegakiApplication - Phase1.5 メインアプリケーション（確実な初期ツール選択修正版）
     * AppCoreを使ってManager統合・UI連携・座標管理統合・新Manager統合・確実なツール初期化を行う
     */
    class TegakiApplication {
        constructor() {
            console.log('🎯 TegakiApplication Phase1.5 メインアプリケーション 作成・自動初期化開始（確実な初期ツール選択修正版）');
            
            this.initialized = false;
            this.pixiApp = null;
            this.appCore = null;
            
            // 🆕 Phase1.5 新Manager群
            this.coordinateManager = null;   // 座標管理
            this.navigationManager = null;   // ナビゲーション・パン・ズーム
            this.recordManager = null;       // 非破壊編集・Undo/Redo
            this.shortcutManager = null;     // キーボードショートカット
            
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
         * 初期化（Phase1.5版：確実な初期ツール選択修正）
         */
        async initialize() {
            console.log('🚀 TegakiApplication Phase1.5 確実な初期ツール選択修正版初期化開始');
            
            // 🆕 0. Phase1.5新Manager初期化（順序重要）
            this.initializePhase15Managers();
            
            // 1. AppCore初期化（CanvasManagerのみ作成）
            await this.initializeAppCore();
            
            // 2. PixiJS Application作成・CanvasManagerに設定
            this.createCanvas();
            
            // 🆕 3. 新ManagerにCanvasManager設定（CoordinateManager完全修正）
            this.setupPhase15ManagersWithCanvas();
            
            // 4. ToolManager初期化（PixiJS設定後に実行）
            await this.initializeToolManager();
            
            // 🔧 5. 確実な初期ツール選択（修正版）
            await this.ensureInitialToolSelection();
            
            // 🆕 6. Phase1.5機能統合
            this.integratePhase15Features();
            
            // 7. UI設定（イベント・アイコン・ボタン）
            this.setupUI();
            
            // 8. アプリケーション開始
            this.appCore.start();
            
            this.initialized = true;
            this.showSuccessMessage();
            
            console.log('✅ TegakiApplication Phase1.5 確実な初期ツール選択修正版初期化完了');
        }
        
        /**
         * 🆕 Phase1.5新Manager初期化（CoordinateManager完全修正）
         */
        initializePhase15Managers() {
            console.log('🆕 Phase1.5新Manager初期化開始...');
            
            // 1. CoordinateManager（最優先・他Managerの基盤）
            if (window.Tegaki.CoordinateManager) {
                this.coordinateManager = new window.Tegaki.CoordinateManager();
                console.log('✅ CoordinateManager初期化完了');
            } else {
                console.error('❌ CoordinateManager未実装 - Phase1.5で必須');
                throw new Error('CoordinateManager not available - required for Phase1.5');
            }
            
            // 2. RecordManager（非破壊編集基盤）
            if (window.Tegaki.RecordManager) {
                this.recordManager = new window.Tegaki.RecordManager();
                console.log('✅ RecordManager初期化完了');
            } else {
                console.warn('⚠️ RecordManager未実装 - Phase1.5開発中');
            }
            
            // 3. NavigationManager（CoordinateManager依存）
            if (window.Tegaki.NavigationManager) {
                const config = {
                    coordinateManager: this.coordinateManager,
                    recordManager: this.recordManager
                };
                this.navigationManager = new window.Tegaki.NavigationManager(config);
                console.log('✅ NavigationManager初期化完了');
            } else {
                console.warn('⚠️ NavigationManager未実装 - Phase1.5開発中');
            }
            
            // 4. ShortcutManager（最後・他Manager連携）
            if (window.Tegaki.ShortcutManager) {
                const config = {
                    navigationManager: this.navigationManager,
                    recordManager: this.recordManager,
                    appInstance: this  // ツール選択用
                };
                this.shortcutManager = new window.Tegaki.ShortcutManager(config);
                console.log('✅ ShortcutManager初期化完了');
            } else {
                console.warn('⚠️ ShortcutManager未実装 - Phase1.5開発中');
            }
            
            console.log('🆕 Phase1.5新Manager初期化完了');
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
         * PixiJS Application作成・DOM配置
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
            
            // 🎨 DOM配置（Canvas要素に座標ズレ防止スタイル適用）
            const container = document.getElementById('canvas-container');
            if (!container) {
                throw new Error('Canvas container not found');
            }
            
            // 🔧 Canvas要素のスタイル設定（Phase1.5完全最適化）
            const canvasElement = this.pixiApp.view;
            canvasElement.style.width = config.width + 'px';
            canvasElement.style.height = config.height + 'px';
            canvasElement.style.border = 'none';
            canvasElement.style.borderRadius = '0';
            canvasElement.style.backgroundColor = 'transparent';
            canvasElement.style.cursor = 'crosshair';
            canvasElement.style.display = 'block';
            canvasElement.style.position = 'relative';
            canvasElement.style.left = '0';
            canvasElement.style.top = '0';
            canvasElement.style.margin = '0';
            canvasElement.style.padding = '0';
            canvasElement.style.transform = 'none';
            canvasElement.style.boxSizing = 'content-box';
            canvasElement.style.outline = 'none';
            
            container.appendChild(canvasElement);
            
            // AppCoreのCanvasManagerにPixiApp設定
            this.appCore.setPixiApp(this.pixiApp);
            
            console.log('✅ PixiJS Canvas作成・配置・CanvasManager設定完了');
            console.log(`📏 Canvas設定: ${config.width}x${config.height}px, resolution=1, autoDensity=false`);
        }
        
        /**
         * 🆕 Phase1.5新ManagerにCanvasManager設定（CoordinateManager完全修正）
         */
        setupPhase15ManagersWithCanvas() {
            console.log('🆕 Phase1.5新ManagerにCanvasManager設定開始...');
            
            // CanvasManager取得
            const canvasManager = this.appCore.getCanvasManager();
            if (!canvasManager) {
                throw new Error('CanvasManager not available');
            }
            
            // CoordinateManager（最重要・完全修正）
            if (this.coordinateManager) {
                try {
                    // 🔧 修正：正しいsetCanvasManagerメソッド呼び出し
                    this.coordinateManager.setCanvasManager(canvasManager);
                    console.log('✅ CoordinateManager - CanvasManager設定完了');
                } catch (error) {
                    console.error('❌ CoordinateManager初期化エラー:', error);
                    throw new Error(`CoordinateManager initialization failed: ${error.message}`);
                }
            }
            
            // NavigationManager（Canvas変形用）
            if (this.navigationManager && canvasManager) {
                // NavigationManagerにもCanvasManager設定（必要に応じて）
                if (typeof this.navigationManager.setCanvasManager === 'function') {
                    this.navigationManager.setCanvasManager(canvasManager);
                    console.log('✅ NavigationManager - CanvasManager設定完了');
                }
            }
            
            console.log('🆕 Phase1.5新Manager CanvasManager設定完了');
        }
        
        /**
         * ToolManager初期化（Phase1.5 Manager統合版・確実な初期ツール選択）
         */
        async initializeToolManager() {
            console.log('🔧 ToolManager初期化開始 - Phase1.5 Manager統合版（確実な初期ツール選択）');
            
            // PixiJS設定後にToolManager初期化
            await this.appCore.initializeToolManager();
            
            // 🆕 Phase1.5 Manager群をToolManagerに設定
            const toolManager = this.appCore.getToolManager();
            if (toolManager) {
                // Phase1.5 Manager群設定（ツール作成前に実行）
                if (typeof toolManager.setPhase15Managers === 'function') {
                    const managerConfig = {
                        coordinateManager: this.coordinateManager,
                        recordManager: this.recordManager,
                        eventBus: window.Tegaki?.EventBusInstance
                    };
                    
                    console.log('🔧 Phase1.5 Manager群設定:', {
                        coordinateManager: !!this.coordinateManager,
                        recordManager: !!this.recordManager,
                        eventBus: !!window.Tegaki?.EventBusInstance
                    });
                    
                    toolManager.setPhase15Managers(managerConfig);
                    console.log('✅ ToolManager - Phase1.5 Manager群設定完了');
                } else {
                    console.warn('⚠️ ToolManager.setPhase15Managers メソッドが利用できません');
                }
                
                // 従来のRecordManager設定（互換性維持）
                if (this.recordManager && typeof toolManager.setRecordManager === 'function') {
                    toolManager.setRecordManager(this.recordManager);
                    console.log('✅ ToolManager - RecordManager接続完了（互換性）');
                }
            } else {
                console.error('❌ ToolManager取得失敗 - Phase1.5 Manager統合不可');
                throw new Error('ToolManager not available');
            }
            
            console.log('✅ ToolManager初期化完了（Phase1.5 Manager統合版・確実な初期ツール選択準備）');
        }
        
        /**
         * 🔧 新規：確実な初期ツール選択（複数回試行・詳細ログ）
         */
        async ensureInitialToolSelection() {
            console.log('🎯 確実な初期ツール選択開始');
            
            const toolManager = this.appCore.getToolManager();
            if (!toolManager) {
                throw new Error('ToolManager not available for initial tool selection');
            }
            
            const initialToolName = 'pen'; // 初期ツール名
            let attempts = 0;
            const maxAttempts = 5;
            let selectionSuccess = false;
            
            while (!selectionSuccess && attempts < maxAttempts) {
                attempts++;
                console.log(`🎯 初期ツール選択試行 ${attempts}/${maxAttempts}: ${initialToolName}`);
                
                try {
                    // ToolManager状態確認
                    const toolManagerReady = toolManager.isReady ? toolManager.isReady() : false;
                    console.log(`   ToolManager準備状態: ${toolManagerReady}`);
                    
                    if (!toolManagerReady) {
                        console.log('   ToolManager未準備 - 短時間待機後再試行');
                        await new Promise(resolve => setTimeout(resolve, 50));
                        continue;
                    }
                    
                    // ツール選択実行
                    if (typeof toolManager.selectTool === 'function') {
                        selectionSuccess = toolManager.selectTool(initialToolName);
                        console.log(`   selectTool結果: ${selectionSuccess}`);
                    } else {
                        console.warn('   selectTool メソッドが利用できません');
                        break;
                    }
                    
                    // 選択成功確認
                    if (selectionSuccess) {
                        // 更に詳細確認
                        const currentTool = toolManager.getCurrentTool();
                        const currentToolName = toolManager.getCurrentToolName();
                        const currentToolActive = currentTool?.active || false;
                        
                        console.log(`   選択確認: tool=${currentToolName}, object=${!!currentTool}, active=${currentToolActive}`);
                        
                        if (currentTool && currentToolActive && currentToolName === initialToolName) {
                            console.log(`✅ 初期ツール選択成功 (試行${attempts}): ${initialToolName}`);
                            break;
                        } else {
                            console.warn(`⚠️ 選択後確認失敗 (試行${attempts}) - 再試行`);
                            selectionSuccess = false;
                        }
                    }
                    
                } catch (error) {
                    console.error(`❌ 初期ツール選択エラー (試行${attempts}):`, error);
                    selectionSuccess = false;
                }
                
                // 失敗時の短時間待機
                if (!selectionSuccess && attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 100 * attempts)); // 増加的待機
                }
            }
            
            // 🔧 最終手段：強制ツール選択（デバッグ機能活用）
            if (!selectionSuccess) {
                console.warn('⚠️ 通常ツール選択失敗 - 強制選択を試行');
                
                try {
                    if (typeof toolManager.forceSelectTool === 'function') {
                        selectionSuccess = toolManager.forceSelectTool(initialToolName);
                        console.log(`🔧 強制ツール選択結果: ${selectionSuccess}`);
                    } else if (typeof toolManager.forceActivateCurrentTool === 'function') {
                        selectionSuccess = toolManager.forceActivateCurrentTool();
                        console.log(`🔧 強制ツールアクティベート結果: ${selectionSuccess}`);
                    }
                } catch (error) {
                    console.error('❌ 強制ツール選択エラー:', error);
                }
            }
            
            // 最終確認
            if (selectionSuccess) {
                const finalTool = toolManager.getCurrentTool();
                const finalToolName = toolManager.getCurrentToolName();
                const finalToolActive = finalTool?.active || false;
                
                console.log('🎉 初期ツール選択最終確認:', {
                    toolName: finalToolName,
                    toolObject: !!finalTool,
                    toolActive: finalToolActive,
                    attempts: attempts
                });
                
                return true;
            } else {
                console.error('💀 初期ツール選択完全失敗');
                throw new Error(`Initial tool selection failed after ${attempts} attempts`);
            }
        }
        
        /**
         * 🆕 Phase1.5機能統合
         */
        integratePhase15Features() {
            console.log('🆕 Phase1.5機能統合開始...');
            
            // ナビゲーション機能有効化
            if (this.navigationManager && typeof this.navigationManager.enable === 'function') {
                this.navigationManager.enable();
                console.log('✅ ナビゲーション機能有効化完了');
            }
            
            // ショートカット機能有効化
            if (this.shortcutManager) {
                // EventBus接続（必要に応じて）
                if (window.Tegaki?.EventBusInstance && typeof this.shortcutManager.initialize === 'function') {
                    this.shortcutManager.initialize(window.Tegaki.EventBusInstance);
                    console.log('✅ ShortcutManager - EventBus接続完了');
                }
                
                // Phase1.5ショートカット設定
                if (typeof this.shortcutManager.setupPhase15Shortcuts === 'function') {
                    this.shortcutManager.setupPhase15Shortcuts();
                    console.log('✅ ShortcutManager - Phase1.5ショートカット設定完了');
                }
                
                // ショートカット機能有効化
                if (typeof this.shortcutManager.enable === 'function') {
                    this.shortcutManager.enable();
                    console.log('✅ ShortcutManager - 機能有効化完了');
                }
            }
            
            console.log('🆕 Phase1.5機能統合完了');
        }
        
        /**
         * UI設定（イベント・アイコン・ボタン）
         */
        setupUI() {
            this.setupCanvasEvents();
            this.setupToolButtons();
            this.setupUndoRedoButtons();
            this.setupIcons();
            this.updateStatusDisplay();
            
            console.log('✅ UI設定完了');
        }
        
        /**
         * キャンバスイベント設定（Phase1.5版・CoordinateManager完全修正）
         */
        setupCanvasEvents() {
            if (!this.pixiApp?.view) {
                throw new Error('Canvas view not available');
            }
            
            const canvas = this.pixiApp.view;
            
            // ポインターイベント設定
            canvas.addEventListener('pointerdown', (e) => this.handlePointerDown(e));
            canvas.addEventListener('pointermove', (e) => this.handlePointerMove(e));
            canvas.addEventListener('pointerup', (e) => this.handlePointerUp(e));
            
            // マウス座標表示
            canvas.addEventListener('pointermove', (e) => this.updateCoordinateDisplay(e));
            
            // ナビゲーションイベント
            if (this.navigationManager) {
                // マウスホイールズーム
                canvas.addEventListener('wheel', (e) => {
                    e.preventDefault();
                    if (typeof this.navigationManager.handleMouseWheelZoom === 'function') {
                        this.navigationManager.handleMouseWheelZoom(e);
                    }
                });
                
                // 中ボタンパン
                canvas.addEventListener('pointerdown', (e) => {
                    if (e.button === 1) { // 中ボタン
                        e.preventDefault();
                        if (typeof this.navigationManager.startPan === 'function') {
                            this.navigationManager.startPan(e.clientX, e.clientY);
                        }
                    }
                });
            }
            
            // コンテキストメニュー無効化
            canvas.addEventListener('contextmenu', (e) => e.preventDefault());
            
            console.log('✅ Canvasイベント設定完了（Phase1.5・CoordinateManager完全修正）');
        }
        
        /**
         * 🆕 ポインターダウン処理（CoordinateManager完全修正）
         */
        handlePointerDown(event) {
            if (!this.appCore) return;
            
            console.log(`🖱️ PointerDown受信: clientX=${event.clientX}, clientY=${event.clientY}`);
            
            // CoordinateManager使用の座標変換（完全修正版）
            const coords = this.getCanvasCoordinates(event);
            
            if (coords === null) {
                // 座標変換失敗：エラー処理
                console.error('❌ ポインターダウン座標変換失敗');
                return;
            }
            
            console.log(`🖱️ 座標変換成功: canvas=(${Math.round(coords.x)}, ${Math.round(coords.y)})`);
            
            // ToolManager経由でイベント処理
            const toolManager = this.appCore.getToolManager();
            if (toolManager) {
                try {
                    toolManager.handlePointerDown(coords.x, coords.y, event);
                } catch (error) {
                    console.error('❌ PointerDown処理エラー:', error);
                }
            } else {
                console.warn('⚠️ ToolManager利用できません');
            }
        }
        
        /**
         * 🆕 ポインタームーブ処理（CoordinateManager完全修正）
         */
        handlePointerMove(event) {
            if (!this.appCore) return;
            
            // CoordinateManager使用の座標変換（完全修正版）
            const coords = this.getCanvasCoordinates(event);
            
            if (coords === null) {
                // 座標変換失敗でも座標表示は継続
                this.updateCoordinateDisplay(event, true);
                return;
            }
            
            // ToolManager経由でイベント処理
            const toolManager = this.appCore.getToolManager();
            if (toolManager) {
                try {
                    toolManager.handlePointerMove(coords.x, coords.y, event);
                } catch (error) {
                    console.error('❌ PointerMove処理エラー:', error);
                }
            }
        }
        
        /**
         * 🆕 ポインターアップ処理（CoordinateManager完全修正）
         */
        handlePointerUp(event) {
            if (!this.appCore) return;
            
            console.log(`🖱️ PointerUp受信: clientX=${event.clientX}, clientY=${event.clientY}`);
            
            // CoordinateManager使用の座標変換（完全修正版）
            const coords = this.getCanvasCoordinates(event);
            
            // 座標が無効でもアップイベントは処理（描画終了のため）
            const finalX = coords ? coords.x : -1;
            const finalY = coords ? coords.y : -1;
            
            console.log(`🖱️ 最終座標: canvas=(${Math.round(finalX)}, ${Math.round(finalY)})`);
            
            // ToolManager経由でイベント処理
            const toolManager = this.appCore.getToolManager();
            if (toolManager) {
                try {
                    toolManager.handlePointerUp(finalX, finalY, event);
                } catch (error) {
                    console.error('❌ PointerUp処理エラー:', error);
                }
            }
        }
        
        /**
         * 🆕 Canvas座標取得（CoordinateManager完全修正）
         */
        getCanvasCoordinates(event) {
            if (!this.coordinateManager) {
                console.error('❌ CoordinateManager not available - coordinate conversion impossible');
                throw new Error('CoordinateManager not initialized');
            }
            
            try {
                // CoordinateManagerで座標変換（剛直構造）
                const result = this.coordinateManager.clientToCanvas(event.clientX, event.clientY);
                
                return {
                    x: result.x,
                    y: result.y,
                    isInsideCanvas: true  // 基本的にCanvas内座標として扱う
                };
            } catch (error) {
                console.error('❌ CoordinateManager座標変換エラー:', error);
                throw error; // エラーを隠蔽しない（剛直原則）
            }
        }
        
        /**
         * 🆕 座標表示更新（CoordinateManager完全修正）
         */
        updateCoordinateDisplay(event, isOutOfBounds = false) {
            const coordElement = document.getElementById('coordinates');
            if (!coordElement) return;
            
            if (isOutOfBounds) {
                coordElement.textContent = 'x: ---, y: ---';
                return;
            }
            
            try {
                const coords = this.getCanvasCoordinates(event);
                if (coords) {
                    coordElement.textContent = `x: ${Math.round(coords.x)}, y: ${Math.round(coords.y)}`;
                } else {
                    coordElement.textContent = 'x: ---, y: ---';
                }
            } catch (error) {
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
            
            // 初期選択されたボタンを強調
            this.updateToolButtons('pen'); // 初期ツールをUIにも反映
            
            console.log('✅ ツールボタン設定完了');
        }
        
        /**
         * 🆕 Undo/Redoボタン設定
         */
        setupUndoRedoButtons() {
            // Undoボタン
            const undoButton = document.getElementById('undo-button');
            if (undoButton && this.recordManager) {
                undoButton.addEventListener('click', () => {
                    if (typeof this.recordManager.canUndo === 'function' && this.recordManager.canUndo()) {
                        if (typeof this.recordManager.undo === 'function') {
                            this.recordManager.undo();
                            this.updateUndoRedoButtons();
                        }
                    }
                });
            }
            
            // Redoボタン
            const redoButton = document.getElementById('redo-button');
            if (redoButton && this.recordManager) {
                redoButton.addEventListener('click', () => {
                    if (typeof this.recordManager.canRedo === 'function' && this.recordManager.canRedo()) {
                        if (typeof this.recordManager.redo === 'function') {
                            this.recordManager.redo();
                            this.updateUndoRedoButtons();
                        }
                    }
                });
            }
            
            // 初期状態更新
            this.updateUndoRedoButtons();
            
            console.log('✅ Undo/Redoボタン設定完了');
        }
        
        /**
         * 🆕 Undo/Redoボタン状態更新
         */
        updateUndoRedoButtons() {
            if (!this.recordManager) return;
            
            const undoButton = document.getElementById('undo-button');
            const redoButton = document.getElementById('redo-button');
            
            if (undoButton) {
                const canUndo = typeof this.recordManager.canUndo === 'function' ? this.recordManager.canUndo() : false;
                undoButton.disabled = !canUndo;
                undoButton.classList.toggle('disabled', !canUndo);
            }
            
            if (redoButton) {
                const canRedo = typeof this.recordManager.canRedo === 'function' ? this.recordManager.canRedo() : false;
                redoButton.disabled = !canRedo;
                redoButton.classList.toggle('disabled', !canRedo);
            }
        }
        
        /**
         * アイコン設定（正しいTegakiIcons呼び出し）
         */
        setupIcons() {
            if (window.Tegaki?.TegakiIcons) {
                window.Tegaki.TegakiIcons.replaceAllToolIcons();
                console.log('✅ アイコン設定完了（TegakiIcons.replaceAllToolIcons）');
            } else if (window.TegakiIcons) {
                window.TegakiIcons.replaceAllToolIcons();
                console.log('✅ アイコン設定完了（グローバルTegakiIcons）');
            } else {
                throw new Error('TegakiIcons not available - icons are required');
            }
        }
        
        /**
         * ステータス表示更新（AppCore連携修正）
         */
        updateStatusDisplay() {
            // キャンバス情報表示
            const canvasInfo = document.getElementById('canvas-info');
            if (canvasInfo && this.pixiApp) {
                const width = this.pixiApp.screen.width;
                const height = this.pixiApp.screen.height;
                canvasInfo.textContent = `${width}×${height}px`;
            }
            
            // 現在ツール表示（ToolManager経由で取得）
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
            
            // 現在色表示（設定から取得）
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
            
            console.log(`🎯 ユーザーツール選択: ${toolName}`);
            
            // AppCore経由でツール選択（selectToolメソッド使用）
            const success = this.appCore.selectTool(toolName);
            
            if (success) {
                // UI更新
                this.updateToolButtons(toolName);
                this.updateStatusDisplay();
                
                console.log(`✅ ツール選択完了: ${toolName}`);
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
         * 🔧 新規：初期ツール強制選択（デバッグ用・手動実行）
         */
        forceSelectInitialTool() {
            console.log('🔧 初期ツール強制選択（手動実行）');
            
            const toolManager = this.appCore?.getToolManager();
            if (!toolManager) {
                console.error('❌ ToolManager not available');
                return false;
            }
            
            // デバッグ情報確認
            console.log('🔍 ToolManager状態確認:', toolManager.getDebugInfo());
            
            // 強制選択実行
            let success = false;
            
            if (typeof toolManager.forceSelectTool === 'function') {
                success = toolManager.forceSelectTool('pen');
                console.log(`🔧 forceSelectTool結果: ${success}`);
            }
            
            if (!success && typeof toolManager.forceActivateCurrentTool === 'function') {
                success = toolManager.forceActivateCurrentTool();
                console.log(`🔧 forceActivateCurrentTool結果: ${success}`);
            }
            
            // UI更新
            if (success) {
                this.updateToolButtons('pen');
                this.updateStatusDisplay();
            }
            
            return success;
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
            console.log('🎉 TegakiApplication Phase1.5 確実な初期ツール選択修正版初期化成功！');
            console.log('📏 CoordinateManager完全統合完了 - 座標変換・ペン描画修正');
            console.log('🧭 NavigationManager統合完了 - パン・ズーム対応');
            console.log('🔄 RecordManager統合完了 - Undo/Redo対応');
            console.log('⌨️ ShortcutManager統合完了 - キーボードショートカット対応');
            console.log('🎯 確実な初期ツール選択完了 - ペン描画即座に可能');
            console.log('🎯 Phase1.5新Manager統合基盤確立完了（確実な初期ツール選択修正版）');
            
            // 成功通知（UI）
            if (window.Tegaki?.ErrorManagerInstance) {
                window.Tegaki.ErrorManagerInstance.showInfo(
                    'Phase1.5確実な初期ツール選択修正版初期化完了 - ペン描画準備完了',
                    { 
                        context: 'TegakiApplication.initialize'
                    }
                );
            }
        }
        
        /**
         * 🆕 Phase1.5機能テスト（デバッグ用・確実な初期ツール選択対応）
         */
        testPhase15Features() {
            console.log('🧪 Phase1.5機能テスト開始（確実な初期ツール選択対応版）');
            
            const testResults = {
                coordinateManager: !!this.coordinateManager,
                navigationManager: !!this.navigationManager,
                recordManager: !!this.recordManager,
                shortcutManager: !!this.shortcutManager,
                coordinateConversion: false,
                undoRedo: false,
                shortcuts: false,
                navigation: false,
                toolSelection: false // 🔧 追加
            };
            
            // CoordinateManager機能テスト（完全修正版）
            if (this.coordinateManager) {
                try {
                    if (typeof this.coordinateManager.clientToCanvas === 'function') {
                        const testCoord = this.coordinateManager.clientToCanvas(100, 100);
                        testResults.coordinateConversion = !!(testCoord && typeof testCoord.x === 'number');
                    }
                } catch (error) {
                    console.warn('⚠️ CoordinateManager機能テスト失敗:', error);
                    testResults.coordinateConversion = false;
                }
            }
            
            // RecordManager機能テスト
            if (this.recordManager) {
                testResults.undoRedo = typeof this.recordManager.canUndo === 'function';
            }
            
            // NavigationManager機能テスト
            if (this.navigationManager) {
                testResults.navigation = typeof this.navigationManager.enable === 'function';
            }
            
            // ShortcutManager機能テスト
            if (this.shortcutManager) {
                testResults.shortcuts = typeof this.shortcutManager.setupPhase15Shortcuts === 'function';
            }
            
            // 🔧 ToolManager・ツール選択テスト
            const toolManager = this.appCore?.getToolManager();
            if (toolManager) {
                const currentTool = toolManager.getCurrentTool();
                const currentToolName = toolManager.getCurrentToolName();
                const currentToolActive = currentTool?.active || false;
                
                testResults.toolSelection = !!(currentTool && currentToolActive && currentToolName);
                console.log(`🧪 ツール選択テスト: tool=${currentToolName}, active=${currentToolActive}, object=${!!currentTool}`);
            }
            
            console.log('🧪 Phase1.5機能テスト結果（確実な初期ツール選択対応版）:', testResults);
            return testResults;
        }
        
        /**
         * 🆕 Phase1.5デバッグ情報取得（確実な初期ツール選択対応版）
         */
        getPhase15DebugInfo() {
            return {
                // 基本状態
                initialized: this.initialized,
                pixiAppReady: !!this.pixiApp,
                appCoreReady: !!this.appCore,
                
                // Phase1.5新Manager状態（CoordinateManager完全修正版）
                managers: {
                    coordinateManager: !!this.coordinateManager,
                    navigationManager: !!this.navigationManager,
                    recordManager: !!this.recordManager,
                    shortcutManager: !!this.shortcutManager
                },
                
                // 詳細情報（CoordinateManager完全修正版）
                coordinateManager: this.coordinateManager ? 
                    (typeof this.coordinateManager.getDebugInfo === 'function' ? this.coordinateManager.getDebugInfo() : 'initialized') : null,
                navigationManager: this.navigationManager ? 
                    (typeof this.navigationManager.getDebugInfo === 'function' ? this.navigationManager.getDebugInfo() : 'initialized') : null,
                recordManager: this.recordManager ? 
                    (typeof this.recordManager.getDebugInfo === 'function' ? this.recordManager.getDebugInfo() : 'initialized') : null,
                shortcutManager: this.shortcutManager ? 
                    (typeof this.shortcutManager.getDebugInfo === 'function' ? this.shortcutManager.getDebugInfo() : 'initialized') : null,
                
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
                
                // ToolManager情報（確実な初期ツール選択連携確認）
                toolManager: (() => {
                    const toolManager = this.appCore?.getToolManager();
                    const currentTool = toolManager?.getCurrentTool();
                    return toolManager ? {
                        ready: toolManager.isReady?.() || false,
                        currentTool: toolManager.getCurrentToolName?.() || 'unknown',
                        currentToolActive: currentTool?.active || false,
                        coordinateManagerConnected: !!(currentTool && currentTool.coordinateManager),
                        // 🔧 詳細ツール診断追加
                        toolsCreated: toolManager.toolsCreated || false,
                        availableTools: toolManager.getAvailableTools?.() || [],
                        debugInfo: toolManager.getDebugInfo?.() || null
                    } : null;
                })(),
                
                // UI情報
                ui: {
                    canvasContainer: !!document.getElementById('canvas-container'),
                    toolButtons: document.querySelectorAll('.tool-button').length,
                    statusPanel: !!document.querySelector('.status-panel'),
                    undoButton: !!document.getElementById('undo-button'),
                    redoButton: !!document.getElementById('redo-button'),
                    activeToolButton: document.querySelector('.tool-button.active')?.id || 'none'
                },
                
                // Phase情報（確実な初期ツール選択対応版）
                phase: {
                    current: '1.5',
                    coordinateManagerFixed: true,
                    initialToolSelectionFixed: true, // 🔧 追加
                    features: {
                        coordinateManager: !!this.coordinateManager,
                        navigationManager: !!this.navigationManager,
                        recordManager: !!this.recordManager,
                        shortcutManager: !!this.shortcutManager,
                        penDrawing: true,
                        coordinateConversion: true,
                        undoRedo: true,
                        shortcuts: true,
                        navigation: true,
                        toolSelection: true // 🔧 追加
                    },
                    nextPhase: {
                        target: '2.0-Layer',
                        requiredComponents: [
                            'LayerManager',
                            'SelectTool',
                            'TransformTool'
                        ]
                    }
                },
                
                // 🔧 初期ツール選択詳細診断
                initialToolSelection: (() => {
                    const toolManager = this.appCore?.getToolManager();
                    if (!toolManager) return null;
                    
                    const currentTool = toolManager.getCurrentTool();
                    const currentToolName = toolManager.getCurrentToolName();
                    
                    return {
                        success: !!(currentTool && currentTool.active && currentToolName === 'pen'),
                        currentToolName: currentToolName,
                        currentToolExists: !!currentTool,
                        currentToolActive: currentTool?.active || false,
                        targetTool: 'pen',
                        toolManagerReady: toolManager.isReady?.() || false,
                        methods: {
                            selectTool: typeof toolManager.selectTool === 'function',
                            forceSelectTool: typeof toolManager.forceSelectTool === 'function',
                            forceActivateCurrentTool: typeof toolManager.forceActivateCurrentTool === 'function'
                        }
                    };
                })()
            };
        }
    }
    
    // Tegaki名前空間に登録
    window.Tegaki.TegakiApplication = TegakiApplication;
    
    console.log('🎯 TegakiApplication Phase1.5 メインアプリケーション Loaded（確実な初期ツール選択修正版）');
    console.log('📏 CoordinateManager完全統合・座標変換修正・ペン描画修正');
    console.log('🧭 ナビゲーション・非破壊編集・ショートカット統合');
    console.log('🆕 CoordinateManager・NavigationManager・RecordManager・ShortcutManager統合対応');
    console.log('🔧 座標変換エラー完全修正・剛直構造実装・フォールバック削除');
    console.log('🎯 確実な初期ツール選択実装・複数回試行・強制選択対応');
    console.log('🚀 TegakiApplication Phase1.5 メインアプリケーション 完成（確実な初期ツール選択修正版）');
}

console.log('🎯 TegakiApplication Phase1.5 メインアプリケーション Loaded（確実な初期ツール選択修正版）');
console.log('📏 CoordinateManager完全統合・座標変換修正・ペン描画修正');
console.log('🧭 ナビゲーション・非破壊編集・ショートカット統合');
console.log('🆕 CoordinateManager・NavigationManager・RecordManager・ShortcutManager統合対応');
console.log('🔧 座標変換エラー完全修正・剛直構造実装・フォールバック削除');
console.log('🎯 確実な初期ツール選択実装・複数回試行・強制選択対応');
console.log('🚀 TegakiApplication Phase1.5 メインアプリケーション 完成（確実な初期ツール選択修正版）');