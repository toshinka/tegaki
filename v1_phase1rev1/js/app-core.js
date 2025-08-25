/**
 * 🎯 AppCore + TegakiApplication - 計画書準拠版
 * 📋 RESPONSIBILITY: TegakiApplicationクラス定義とAppCoreクラス定義
 * 🚫 PROHIBITION: 複雑な段階制御・診断機能・エラー処理
 * ✅ PERMISSION: クラス定義・インスタンス登録・例外throw
 * 
 * 📏 DESIGN_PRINCIPLE: 単純・直線的・責任分離
 * 🔄 INTEGRATION: bootstrap.jsからTegakiApplicationが呼び出される
 */

// if (!window.XXX) ガードで多重定義を防ぐ
if (!window.TegakiApplication) {
    // Tegaki名前空間初期化
    window.Tegaki = window.Tegaki || {};
    
    /**
     * TegakiApplication - メインアプリケーションクラス
     * app-core.js で定義（計画書準拠）
     */
    class TegakiApplication {
        constructor() {
            console.log('🎨 TegakiApplication 開始 - app-core.js版');
            
            this.initialized = false;
            this.pixiApp = null;
            this.appCore = null;
            
            // 初期化実行
            this.initialize();
        }
        
        /**
         * 基本初期化
         */
        async initialize() {
            console.log('🔧 TegakiApplication 初期化開始...');
            
            // Step 1: AppCore初期化
            await this.initializeAppCore();
            
            // Step 2: キャンバス作成
            this.createCanvas();
            
            // Step 3: UI連携
            this.setupUI();
            
            this.initialized = true;
            console.log('✅ TegakiApplication 初期化完了');
            
            // 成功通知
            this.showSuccessMessage();
        }
        
        /**
         * AppCore初期化
         */
        async initializeAppCore() {
            console.log('🔧 AppCore初期化開始...');
            
            if (!window.AppCore) {
                throw new Error('AppCore class not available');
            }
            
            this.appCore = new window.AppCore();
            await this.appCore.initialize();
            
            console.log('✅ AppCore初期化完了');
        }
        
        /**
         * キャンバス作成
         */
        createCanvas() {
            console.log('🎨 キャンバス作成開始...');
            
            // DOM要素取得
            const container = document.getElementById('canvas-container');
            if (!container) {
                throw new Error('Canvas container #canvas-container not found');
            }
            
            // PixiJS Application作成
            if (!window.PIXI) {
                throw new Error('PIXI.js not loaded');
            }
            
            // 設定取得
            const config = window.Tegaki?.ConfigManagerInstance || null;
            const canvasConfig = config ? config.getCanvasConfig() : {
                width: 400,
                height: 400,
                backgroundColor: '#f0e0d6'
            };
            
            this.pixiApp = new PIXI.Application({
                width: canvasConfig.width,
                height: canvasConfig.height,
                backgroundColor: 0xf0e0d6, // futaba-cream
                antialias: true,
                resolution: window.devicePixelRatio || 1,
                autoDensity: true
            });
            
            // コンテナにキャンバス追加
            container.appendChild(this.pixiApp.view);
            
            // AppCoreにPixiApp設定
            if (this.appCore) {
                this.appCore.setPixiApp(this.pixiApp);
            }
            
            console.log('✅ キャンバス作成完了');
            
            // 描画テスト
            this.drawTestGraphics();
        }
        
        /**
         * 描画テスト
         */
        drawTestGraphics() {
            console.log('🔧 描画テスト開始...');
            
            // テスト用Graphics作成
            const testGraphics = new PIXI.Graphics();
            
            // 背景
            testGraphics.beginFill(0xf0e0d6);
            testGraphics.drawRect(0, 0, 400, 400);
            testGraphics.endFill();
            
            // 中央に円
            testGraphics.beginFill(0x800000);
            testGraphics.drawCircle(200, 200, 30);
            testGraphics.endFill();
            
            // テキスト
            const testText = new PIXI.Text('🎨 Tegaki Ready!', {
                fontFamily: 'Arial, sans-serif',
                fontSize: 18,
                fill: 0x800000,
                align: 'center'
            });
            testText.x = 200;
            testText.y = 260;
            testText.anchor.set(0.5);
            
            // ステージに追加
            this.pixiApp.stage.addChild(testGraphics);
            this.pixiApp.stage.addChild(testText);
            
            console.log('✅ 描画テスト完了');
        }
        
        /**
         * UI連携
         */
        setupUI() {
            console.log('🖥️ UI連携開始...');
            
            // 基本イベント設定
            this.setupCanvasEvents();
            
            // ツールボタン設定
            this.setupToolButtons();
            
            // ステータス表示更新
            this.updateStatusDisplay();
            
            console.log('✅ UI連携完了');
        }
        
        /**
         * キャンバスイベント設定
         */
        setupCanvasEvents() {
            const canvas = this.pixiApp.view;
            
            // ポインターイベント
            canvas.addEventListener('pointerdown', (e) => this.handlePointerDown(e));
            canvas.addEventListener('pointermove', (e) => this.handlePointerMove(e));
            canvas.addEventListener('pointerup', (e) => this.handlePointerUp(e));
        }
        
        /**
         * ツールボタン設定
         */
        setupToolButtons() {
            // ペンツール
            const penButton = document.getElementById('pen-tool');
            if (penButton) {
                penButton.addEventListener('click', () => this.selectTool('pen'));
            }
            
            // 消しゴムツール
            const eraserButton = document.getElementById('eraser-tool');
            if (eraserButton) {
                eraserButton.addEventListener('click', () => this.selectTool('eraser'));
            }
        }
        
        /**
         * ツール選択
         */
        selectTool(toolName) {
            if (this.appCore?.toolManager) {
                this.appCore.toolManager.selectTool(toolName);
                this.updateToolButtons(toolName);
                console.log(`✅ ツール選択: ${toolName}`);
            }
        }
        
        /**
         * ツールボタン更新
         */
        updateToolButtons(activeToolName) {
            // 全ボタンのactiveクラス削除
            document.querySelectorAll('.tool-button').forEach(button => {
                button.classList.remove('active');
            });
            
            // アクティブツールにactiveクラス追加
            const activeButton = document.getElementById(`${activeToolName}-tool`);
            if (activeButton) {
                activeButton.classList.add('active');
            }
        }
        
        /**
         * ステータス表示更新
         */
        updateStatusDisplay() {
            // 現在のツール表示更新
            const currentToolSpan = document.getElementById('current-tool');
            if (currentToolSpan && this.appCore?.toolManager) {
                const toolName = this.appCore.toolManager.getCurrentToolName();
                currentToolSpan.textContent = toolName === 'pen' ? 'ベクターペン' : '消しゴム';
            }
        }
        
        /**
         * ポインターイベント処理
         */
        handlePointerDown(e) {
            const rect = this.pixiApp.view.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            if (this.appCore?.toolManager) {
                this.appCore.toolManager.handlePointerDown(x, y, e);
            }
        }
        
        handlePointerMove(e) {
            const rect = this.pixiApp.view.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // 座標表示更新
            const coordSpan = document.getElementById('coordinates');
            if (coordSpan) {
                coordSpan.textContent = `x: ${Math.round(x)}, y: ${Math.round(y)}`;
            }
            
            if (this.appCore?.toolManager) {
                this.appCore.toolManager.handlePointerMove(x, y, e);
            }
        }
        
        handlePointerUp(e) {
            const rect = this.pixiApp.view.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            if (this.appCore?.toolManager) {
                this.appCore.toolManager.handlePointerUp(x, y, e);
            }
        }
        
        /**
         * 成功通知表示
         */
        showSuccessMessage() {
            console.log('🎉 Tegaki アプリケーション起動完了!');
            
            if (window.Tegaki?.ErrorManagerInstance) {
                window.Tegaki.ErrorManagerInstance.showInfo('🎨 Tegaki 起動完了!', {
                    duration: 3000
                });
            }
        }
    }
    
    // window.TegakiApplication に一意に登録
    window.TegakiApplication = TegakiApplication;
    
    // Tegaki名前空間にも登録
    window.Tegaki.TegakiApplication = TegakiApplication;
    
    console.log('✅ TegakiApplication クラス定義完了 - app-core.js');
}

// AppCore クラスは main.js で定義されることを想定していたが、
// 計画書により app-core.js では定義しない
// （main.js で AppCore を定義する）

console.log('🎯 app-core.js loaded - TegakiApplication定義完了');