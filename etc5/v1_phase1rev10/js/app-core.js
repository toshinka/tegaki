/**
 * 🎯 TegakiApplication - 座標ズレ問題完全解決版
 * 📋 RESPONSIBILITY: メインアプリケーション・UI連携・イベント設定・キャンバス作成
 * 🚫 PROHIBITION: Manager作成・描画処理・エラー処理
 * ✅ PERMISSION: AppCore作成・UI連携・イベント設定・PixiJS Application作成
 * 
 * 📏 DESIGN_PRINCIPLE: UIアプリケーション専門・AppCore統合・イベント処理
 * 🔄 INTEGRATION: AppCore + PixiJS + DOM UI の統合管理
 * 🔧 FIX: 座標変換ロジック完全修正・正確なCanvas内座標計算
 */

// if (!window.XXX) ガードで多重定義を防ぐ
if (!window.Tegaki) {
    window.Tegaki = {};
}

if (!window.Tegaki.TegakiApplication) {
    /**
     * TegakiApplication - 座標ズレ問題完全解決版
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
         * 初期化（修正版：正しい順序での初期化）
         */
        async initialize() {
            try {
                console.log('🚀 TegakiApplication 初期化開始');
                
                // 1. AppCore初期化（CanvasManagerのみ作成）
                await this.initializeAppCore();
                
                // 2. PixiJS Application作成・CanvasManagerに設定
                this.createCanvas();
                
                // 3. ToolManager初期化（PixiJS設定後に実行）
                await this.initializeToolManager();
                
                // 4. UI設定（イベント・アイコン・ボタン）
                this.setupUI();
                
                // 5. アプリケーション開始
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
         * PixiJS Application作成・DOM配置（修正版：座標ズレ防止）
         */
        createCanvas() {
            if (!window.PIXI) {
                throw new Error('PixiJS not loaded');
            }
            
            const config = window.Tegaki.ConfigManagerInstance.getCanvasConfig();
            
            // 🔧 PixiJS Application作成（devicePixelRatio対応無効化）
            this.pixiApp = new PIXI.Application({
                width: config.width,
                height: config.height,
                backgroundColor: 0x000000,    // 黒（後で透明化）
                backgroundAlpha: 0,           // 完全透明
                antialias: true,
                resolution: 1,                // 🔧 修正: 固定解像度で座標ズレ防止
                autoDensity: false            // 🔧 修正: 自動密度調整無効化
            });
            
            // 🎨 DOM配置（Canvas要素に座標ズレ防止スタイル適用）
            const container = document.getElementById('canvas-container');
            if (!container) {
                throw new Error('Canvas container not found');
            }
            
            // 🔧 Canvas要素のスタイル設定（座標ズレ完全防止）
            const canvasElement = this.pixiApp.view;
            canvasElement.style.width = config.width + 'px';
            canvasElement.style.height = config.height + 'px';
            canvasElement.style.border = 'none';              // 枠なし
            canvasElement.style.borderRadius = '0';           // 角丸なし
            canvasElement.style.backgroundColor = 'transparent'; // 背景透明
            canvasElement.style.cursor = 'crosshair';
            canvasElement.style.display = 'block';
            canvasElement.style.position = 'relative';        // 🔧 修正: 相対配置で座標基準明確化
            canvasElement.style.left = '0';                   // 🔧 修正: 左オフセット0
            canvasElement.style.top = '0';                    // 🔧 修正: 上オフセット0
            canvasElement.style.margin = '0';                 // 🔧 修正: マージン0
            canvasElement.style.padding = '0';                // 🔧 修正: パディング0
            canvasElement.style.transform = 'none';           // 🔧 修正: トランスフォーム無効化
            
            container.appendChild(canvasElement);
            
            // AppCoreのCanvasManagerにPixiApp設定
            this.appCore.setPixiApp(this.pixiApp);
            
            console.log('✅ PixiJS Canvas作成・配置・CanvasManager設定完了（座標ズレ防止版）');
            console.log(`📏 Canvas設定: ${config.width}x${config.height}px, resolution=1, autoDensity=false`);
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
         * キャンバスイベント設定（修正版）
         */
        setupCanvasEvents() {
            if (!this.pixiApp?.view) {
                throw new Error('Canvas view not available');
            }
            
            const canvas = this.pixiApp.view;
            
            // 🔧 ポインターイベント設定（座標変換修正）
            canvas.addEventListener('pointerdown', (e) => this.handlePointerDown(e));
            canvas.addEventListener('pointermove', (e) => this.handlePointerMove(e));
            canvas.addEventListener('pointerup', (e) => this.handlePointerUp(e));
            
            // タッチ操作のデフォルト無効化
            canvas.addEventListener('touchstart', (e) => e.preventDefault());
            canvas.addEventListener('touchmove', (e) => e.preventDefault());
            canvas.addEventListener('touchend', (e) => e.preventDefault());
            
            // コンテキストメニュー無効化
            canvas.addEventListener('contextmenu', (e) => e.preventDefault());
            
            // 🔧 修正: ポインターキャプチャー有効化（精密な追跡）
            canvas.addEventListener('pointerdown', (e) => {
                canvas.setPointerCapture(e.pointerId);
            });
            
            canvas.addEventListener('pointerup', (e) => {
                canvas.releasePointerCapture(e.pointerId);
            });
            
            console.log('✅ キャンバスイベント設定完了（ポインターキャプチャー有効）');
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
                    console.log('✅ アイコン適用完了（TegakiIcons.replaceAllToolIcons実行済み）');
                } else {
                    console.warn('⚠️ TegakiIcons not available - アイコン適用スキップ');
                }
            } catch (error) {
                console.error('❌ アイコン設定エラー:', error);
                // アイコンエラーでアプリ停止させない
                if (window.Tegaki?.ErrorManagerInstance) {
                    window.Tegaki.ErrorManagerInstance.showWarning(
                        `アイコン設定エラー: ${error.message}`,
                        { context: 'TegakiApplication.setupIcons' }
                    );
                }
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
                if (window.Tegaki?.ErrorManagerInstance) {
                    window.Tegaki.ErrorManagerInstance.showWarning(
                        `ツール選択失敗: ${toolName}`,
                        { context: 'TegakiApplication.selectTool' }
                    );
                }
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
         * ポインターイベント処理（座標変換完全修正版）
         * 🔧 座標計算を根本的に修正・デバッグ情報充実
         */
        handlePointerDown(e) {
            const coords = this.getCanvasCoordinates(e);
            
            console.log('🖱️ PointerDown:', {
                original: { clientX: e.clientX, clientY: e.clientY },
                converted: { x: coords.x, y: coords.y }
            });
            
            // 座標表示更新
            this.updateCoordinates(coords.x, coords.y);
            
            // ツールに転送
            this.appCore?.getToolManager()?.handlePointerDown(coords.x, coords.y, e);
        }
        
        handlePointerMove(e) {
            const coords = this.getCanvasCoordinates(e);
            
            // 座標表示更新（move時は静的に）
            this.updateCoordinates(coords.x, coords.y);
            
            // ツールに転送
            this.appCore?.getToolManager()?.handlePointerMove(coords.x, coords.y, e);
        }
        
        handlePointerUp(e) {
            const coords = this.getCanvasCoordinates(e);
            
            console.log('🖱️ PointerUp:', {
                original: { clientX: e.clientX, clientY: e.clientY },
                converted: { x: coords.x, y: coords.y }
            });
            
            // ツールに転送
            this.appCore?.getToolManager()?.handlePointerUp(coords.x, coords.y, e);
        }
        
        /**
         * 🔧 Canvas座標取得（根本的完全修正版）
         * DOM座標からCanvas内部座標に正確に変換・複雑な変換を排除
         */
        getCanvasCoordinates(e) {
            const canvas = this.pixiApp.view;
            const rect = canvas.getBoundingClientRect();
            
            // 🔧 完全修正: 最もシンプルな座標変換
            // 複雑なスケール変換・デバイス解像度対応を全て排除
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // 🔧 境界チェック（Canvas外座標のクランプ）
            const clampedX = Math.max(0, Math.min(x, rect.width));
            const clampedY = Math.max(0, Math.min(y, rect.height));
            
            // 🔧 デバッグ情報（座標ズレ検証用）
            const isDebugPosition = (x < 50 && y < 50) || Math.abs(x - clampedX) > 0.1 || Math.abs(y - clampedY) > 0.1;
            
            if (isDebugPosition) {
                console.log('🔧 座標変換デバッグ:', {
                    event: { clientX: e.clientX, clientY: e.clientY },
                    boundingRect: { 
                        left: rect.left, 
                        top: rect.top, 
                        width: rect.width, 
                        height: rect.height 
                    },
                    calculated: { x, y },
                    clamped: { x: clampedX, y: clampedY },
                    canvasSize: { 
                        internal: `${this.pixiApp.renderer.width}x${this.pixiApp.renderer.height}`,
                        dom: `${rect.width}x${rect.height}`
                    },
                    pixiSettings: {
                        resolution: this.pixiApp.renderer.resolution,
                        autoDensity: this.pixiApp.renderer.options.autoDensity
                    }
                });
            }
            
            return { x: clampedX, y: clampedY };
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
                    'Tegaki座標ズレ問題解決版 起動完了！',
                    { context: 'TegakiApplication.showSuccessMessage' }
                );
            }
        }
        
        /**
         * デバッグ情報取得（拡張版）
         */
        getDebugInfo() {
            const canvasElement = this.pixiApp?.view;
            const rect = canvasElement?.getBoundingClientRect();
            
            return {
                initialized: this.initialized,
                hasPixiApp: !!this.pixiApp,
                hasAppCore: !!this.appCore,
                appCoreReady: this.appCore?.isReady() || false,
                canvasSize: this.pixiApp ? {
                    internal: {
                        width: this.pixiApp.renderer.width,
                        height: this.pixiApp.renderer.height
                    },
                    dom: rect ? {
                        width: rect.width,
                        height: rect.height
                    } : null
                } : null,
                pixiConfig: this.pixiApp ? {
                    resolution: this.pixiApp.renderer.resolution,
                    autoDensity: this.pixiApp.renderer.options.autoDensity,
                    backgroundColor: this.pixiApp.renderer.backgroundColor,
                    backgroundAlpha: this.pixiApp.renderer.backgroundAlpha
                } : null,
                coordinateTransform: {
                    method: 'simplified',
                    description: 'clientX/Y - boundingRect.left/top (no scaling)',
                    issues_fixed: ['devicePixelRatio removed', 'autoDensity disabled', 'transform removed']
                }
            };
        }
    }
    
    // Tegaki名前空間に登録
    window.Tegaki.TegakiApplication = TegakiApplication;
    
    console.log('🎯 TegakiApplication Loaded（座標ズレ問題完全解決版）');
} else {
    console.log('⚠️ TegakiApplication already defined - skipping redefinition');
}

console.log('🎯 app-core.js loaded - TegakiApplication定義完了（座標ズレ問題完全解決版）');