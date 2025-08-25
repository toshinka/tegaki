/**
 * 🎯 TegakiApplication - メインアプリケーション・UI連携専任
 * 📋 RESPONSIBILITY: メインアプリケーション・UI連携・イベント設定・キャンバス作成
 * 🚫 PROHIBITION: Manager作成・描画処理・エラー処理
 * ✅ PERMISSION: AppCore作成・UI連携・イベント設定・PixiJS Application作成
 * 
 * 📏 DESIGN_PRINCIPLE: UIアプリケーション専門・AppCore統合・イベント処理
 * 🔄 INTEGRATION: AppCore + PixiJS + DOM UI の統合管理
 */

// if (!window.XXX) ガードで多重定義を防ぐ
if (!window.Tegaki) {
    window.Tegaki = {};
}

if (!window.Tegaki.TegakiApplication) {
    /**
     * TegakiApplication - メインアプリケーション
     * AppCoreを使ってManager統合・UI連携・イベント処理を行う
     */
    class TegakiApplication {
        constructor() {
            console.log('🎯 TegakiApplication 作成・自動初期化開始');
            
            this.initialized = false;
            this.pixiApp = null;
            this.appCore = null;
            
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
         * 初期化（AppCore→Canvas→UI の順）
         */
        async initialize() {
            try {
                console.log('🚀 TegakiApplication 初期化開始');
                
                // 1. AppCore初期化
                await this.initializeAppCore();
                
                // 2. PixiJS Application作成・DOM配置
                this.createCanvas();
                
                // 3. UI設定（イベント・アイコン・ボタン）
                this.setupUI();
                
                // 4. アプリケーション開始
                this.appCore.start();
                
                this.initialized = true;
                this.showSuccessMessage();
                
                console.log('✅ TegakiApplication 初期化完了');
                
            } catch (error) {
                console.error('❌ TegakiApplication 初期化エラー:', error);
                throw error;
            }
        }
        
        /**
         * AppCore初期化
         */
        async initializeAppCore() {
            if (!window.Tegaki.AppCore) {
                throw new Error('AppCore class not available');
            }
            
            this.appCore = new window.Tegaki.AppCore();
            await this.appCore.initialize();
            
            console.log('✅ AppCore初期化完了');
        }
        
        /**
         * PixiJS Application作成・DOM配置
         */
        createCanvas() {
            if (!window.PIXI) {
                throw new Error('PixiJS not loaded');
            }
            
            const config = window.Tegaki.ConfigManagerInstance.getCanvasConfig();
            
            // PixiJS Application作成
            this.pixiApp = new PIXI.Application({
                width: config.width,
                height: config.height,
                backgroundColor: config.backgroundColor,
                antialias: true,
                resolution: window.devicePixelRatio || 1
            });
            
            // DOM配置
            const container = document.getElementById('canvas-container');
            if (!container) {
                throw new Error('Canvas container not found');
            }
            container.appendChild(this.pixiApp.view);
            
            // AppCoreにPixiApp設定
            this.appCore.setPixiApp(this.pixiApp);
            
            console.log('✅ PixiJS Canvas作成・配置完了');
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
         * キャンバスイベント設定
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
            
            // タッチ操作のデフォルト無効化
            canvas.addEventListener('touchstart', (e) => e.preventDefault());
            canvas.addEventListener('touchmove', (e) => e.preventDefault());
            canvas.addEventListener('touchend', (e) => e.preventDefault());
            
            console.log('✅ キャンバスイベント設定完了');
        }
        
        /**
         * ツールボタンイベント設定
         */
        setupToolButtons() {
            // ツールボタンイベント設定
            document.getElementById('pen-tool')?.addEventListener('click', () => this.selectTool('pen'));
            document.getElementById('eraser-tool')?.addEventListener('click', () => this.selectTool('eraser'));
            
            console.log('✅ ツールボタンイベント設定完了');
        }
        
        /**
         * アイコン設定（重要：icons.js活用）
         */
        setupIcons() {
            try {
                if (window.Tegaki?.TegakiIcons) {
                    window.Tegaki.TegakiIcons.replaceAllToolIcons();
                    console.log('✅ アイコン適用完了');
                } else {
                    console.warn('⚠️ TegakiIcons not available');
                }
            } catch (error) {
                console.error('❌ アイコン設定エラー:', error);
                // アイコンエラーでアプリ停止させない
            }
        }
        
        /**
         * ツール選択・UI更新
         */
        selectTool(toolName) {
            const success = this.appCore?.getToolManager()?.selectTool(toolName);
            if (success) {
                this.updateToolButtons(toolName);
                this.updateStatusDisplay();
                console.log(`🎯 ツール選択: ${toolName}`);
            } else {
                console.warn(`⚠️ ツール選択失敗: ${toolName}`);
            }
        }
        
        /**
         * ツールボタンUI更新
         */
        updateToolButtons(activeToolName) {
            // 全ボタンのactiveクラス削除
            document.querySelectorAll('.tool-button').forEach(button => {
                button.classList.remove('active');
            });
            
            // アクティブボタンにactiveクラス追加
            const activeButton = document.getElementById(`${activeToolName}-tool`);
            if (activeButton) {
                activeButton.classList.add('active');
            }
        }
        
        /**
         * ステータス表示更新
         */
        updateStatusDisplay() {
            const toolManager = this.appCore?.getToolManager();
            if (toolManager) {
                const currentToolName = toolManager.getCurrentToolName();
                const toolElement = document.getElementById('current-tool');
                if (toolElement) {
                    const toolNames = {
                        pen: 'ベクターペン',
                        eraser: '消しゴム'
                    };
                    toolElement.textContent = toolNames[currentToolName] || currentToolName;
                }
            }
        }
        
        /**
         * ポインターイベント処理
         */
        handlePointerDown(e) {
            const rect = this.pixiApp.view.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // 座標表示更新
            this.updateCoordinates(x, y);
            
            // ツールに転送
            this.appCore?.getToolManager()?.handlePointerDown(x, y, e);
        }
        
        handlePointerMove(e) {
            const rect = this.pixiApp.view.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // 座標表示更新
            this.updateCoordinates(x, y);
            
            // ツールに転送
            this.appCore?.getToolManager()?.handlePointerMove(x, y, e);
        }
        
        handlePointerUp(e) {
            const rect = this.pixiApp.view.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // ツールに転送
            this.appCore?.getToolManager()?.handlePointerUp(x, y, e);
        }
        
        /**
         * 座標表示更新
         */
        updateCoordinates(x, y) {
            const coordElement = document.getElementById('coordinates');
            if (coordElement) {
                coordElement.textContent = `x: ${Math.round(x)}, y: ${Math.round(y)}`;
            }
        }
        
        /**
         * 成功メッセージ表示
         */
        showSuccessMessage() {
            if (window.Tegaki?.ErrorManagerInstance) {
                window.Tegaki.ErrorManagerInstance.showInfo(
                    'Tegakiアプリケーション起動完了！',
                    { context: 'TegakiApplication.showSuccessMessage' }
                );
            }
        }
        
        /**
         * デバッグ情報取得
         */
        getDebugInfo() {
            return {
                initialized: this.initialized,
                hasPixiApp: !!this.pixiApp,
                hasAppCore: !!this.appCore,
                appCoreReady: this.appCore?.isReady() || false,
                canvasSize: this.pixiApp ? {
                    width: this.pixiApp.screen.width,
                    height: this.pixiApp.screen.height
                } : null
            };
        }
    }
    
    // Tegaki名前空間に登録
    window.Tegaki.TegakiApplication = TegakiApplication;
    
    console.log('🎯 TegakiApplication Loaded');
} else {
    console.log('⚠️ TegakiApplication already defined - skipping redefinition');
}

console.log('🎯 app-core.js loaded - TegakiApplication定義完了');