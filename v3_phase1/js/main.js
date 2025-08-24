/**
 * 🎨 Tegaki Simple Main - 骨太構造・キャンバス確実表示版
 * 📋 RESPONSIBILITY: アプリケーション生成・キャンバス作成・基本初期化のみ
 * 🚫 PROHIBITION: 段階的初期化・診断機能・複雑な条件分岐・エラー隠蔽
 * ✅ PERMISSION: 直接的キャンバス作成・PixiJS初期化・Manager委譲・例外throw
 * 
 * 📏 DESIGN_PRINCIPLE: 単純・直線的・素人でも読める
 * 🔄 INTEGRATION: Constructor内で全初期化完了
 */

// Tegaki名前空間初期化
window.Tegaki = window.Tegaki || {};

/**
 * Tegakiアプリケーション - シンプル版
 * 「キャンバスが出ない」問題を根本解決
 */
class TegakiApplication {
    constructor() {
        console.log('🎨 TegakiApplication 開始 - シンプル版');
        
        this.initialized = false;
        
        // Step 1: キャンバス作成（最優先）
        this.createCanvas();
        
        // Step 2: 基本Manager初期化
        this.initializeManagers();
        
        // Step 3: ツール初期化
        this.initializeTools();
        
        // Step 4: UI連携
        this.setupUI();
        
        this.initialized = true;
        console.log('✅ TegakiApplication 初期化完了');
        
        // 成功通知
        this.showSuccessMessage();
    }
    
    /**
     * Step 1: キャンバス作成（エラー隠蔽禁止）
     * ここが「キャンバスが出ない」問題の核心
     */
    createCanvas() {
        console.log('🎨 キャンバス作成開始...');
        
        // DOM要素取得（失敗時は即例外）
        const container = document.getElementById('canvas-container');
        if (!container) {
            throw new Error('Canvas container #canvas-container not found in DOM');
        }
        
        console.log('📦 キャンバスコンテナ確認:', {
            width: container.offsetWidth,
            height: container.offsetHeight,
            display: getComputedStyle(container).display
        });
        
        // PixiJS Application作成（失敗時は即例外）
        if (!window.PIXI) {
            throw new Error('PIXI.js not loaded');
        }
        
        this.pixiApp = new PIXI.Application({
            width: 400,
            height: 400,
            backgroundColor: 0xffffee, // #ffffee
            antialias: true,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true
        });
        
        // コンテナにキャンバス追加（失敗時は即例外）
        container.appendChild(this.pixiApp.view);
        
        // 即座に表示確認
        const canvas = this.pixiApp.view;
        console.log('🎨 キャンバス作成完了:', {
            element: !!canvas,
            width: canvas.width,
            height: canvas.height,
            offsetWidth: canvas.offsetWidth,
            offsetHeight: canvas.offsetHeight,
            visible: canvas.offsetWidth > 0 && canvas.offsetHeight > 0
        });
        
        if (!(canvas.offsetWidth > 0 && canvas.offsetHeight > 0)) {
            throw new Error('Canvas created but not visible');
        }
        
        console.log('✅ キャンバス表示確認完了');
        
        // 描画テスト（動作確認）
        this.drawTestGraphics();
    }
    
    /**
     * 描画テスト（キャンバス動作確認）
     */
    drawTestGraphics() {
        console.log('🔧 描画テスト開始...');
        
        // テスト用Graphics作成
        const testGraphics = new PIXI.Graphics();
        
        // 背景
        testGraphics.beginFill(0xffffee);
        testGraphics.drawRect(0, 0, 400, 400);
        testGraphics.endFill();
        
        // 中央に赤い円
        testGraphics.beginFill(0x800000);
        testGraphics.drawCircle(200, 200, 50);
        testGraphics.endFill();
        
        // テキスト
        const testText = new PIXI.Text('Tegaki Ready!', {
            fontFamily: 'Arial',
            fontSize: 24,
            fill: 0x000000,
            align: 'center'
        });
        testText.x = 200;
        testText.y = 300;
        testText.anchor.set(0.5);
        
        // ステージに追加
        this.pixiApp.stage.addChild(testGraphics);
        this.pixiApp.stage.addChild(testText);
        
        console.log('✅ 描画テスト完了');
    }
    
    /**
     * Step 2: 基本Manager初期化
     */
    initializeManagers() {
        console.log('🔧 Manager初期化開始...');
        
        // CanvasManager作成・初期化
        if (window.Tegaki?.CanvasManager) {
            this.canvasManager = new window.Tegaki.CanvasManager();
            
            // PixiJS Applicationを渡す
            this.canvasManager.setPixiApp(this.pixiApp);
            
            window.Tegaki.CanvasManagerInstance = this.canvasManager;
            console.log('✅ CanvasManager初期化完了');
        } else {
            console.warn('⚠️ CanvasManager not available');
        }
        
        // ToolManager作成・初期化
        if (window.Tegaki?.ToolManager) {
            this.toolManager = new window.Tegaki.ToolManager();
            
            // CanvasManagerを渡す
            if (this.canvasManager) {
                this.toolManager.setCanvasManager(this.canvasManager);
            }
            
            window.Tegaki.ToolManagerInstance = this.toolManager;
            console.log('✅ ToolManager初期化完了');
        } else {
            console.warn('⚠️ ToolManager not available');
        }
        
        console.log('✅ Manager初期化完了');
    }
    
    /**
     * Step 3: ツール初期化
     */
    initializeTools() {
        console.log('🖊️ ツール初期化開始...');
        
        if (this.toolManager) {
            // デフォルトツール設定
            this.toolManager.selectTool('pen');
            console.log('✅ デフォルトツール(pen)設定完了');
        }
        
        console.log('✅ ツール初期化完了');
    }
    
    /**
     * Step 4: UI連携
     */
    setupUI() {
        console.log('🖥️ UI連携開始...');
        
        // 基本イベント設定
        this.setupCanvasEvents();
        
        // ツールボタン設定
        this.setupToolButtons();
        
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
        
        console.log('✅ キャンバスイベント設定完了');
    }
    
    /**
     * ツールボタン設定
     */
    setupToolButtons() {
        // ペンツールボタン
        const penButton = document.getElementById('pen-tool');
        if (penButton) {
            penButton.addEventListener('click', () => {
                if (this.toolManager) {
                    this.toolManager.selectTool('pen');
                    this.updateActiveButton(penButton);
                }
            });
        }
        
        // 消しゴムツールボタン
        const eraserButton = document.getElementById('eraser-tool');
        if (eraserButton) {
            eraserButton.addEventListener('click', () => {
                if (this.toolManager) {
                    this.toolManager.selectTool('eraser');
                    this.updateActiveButton(eraserButton);
                }
            });
        }
        
        console.log('✅ ツールボタン設定完了');
    }
    
    /**
     * アクティブボタン更新
     */
    updateActiveButton(activeButton) {
        // 全ボタンのactiveクラス削除
        document.querySelectorAll('.tool-button').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // 選択ボタンにactiveクラス追加
        activeButton.classList.add('active');
    }
    
    /**
     * ポインターイベントハンドリング
     */
    handlePointerDown(event) {
        if (this.toolManager) {
            const coords = this.getCanvasCoordinates(event);
            this.toolManager.handlePointerDown(coords.x, coords.y, event);
        }
    }
    
    handlePointerMove(event) {
        if (this.toolManager) {
            const coords = this.getCanvasCoordinates(event);
            this.toolManager.handlePointerMove(coords.x, coords.y, event);
        }
    }
    
    handlePointerUp(event) {
        if (this.toolManager) {
            const coords = this.getCanvasCoordinates(event);
            this.toolManager.handlePointerUp(coords.x, coords.y, event);
        }
    }
    
    /**
     * キャンバス座標取得
     */
    getCanvasCoordinates(event) {
        const canvas = this.pixiApp.view;
        const rect = canvas.getBoundingClientRect();
        
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
    }
    
    /**
     * 成功通知表示
     */
    showSuccessMessage() {
        // ErrorManager経由での通知（利用可能な場合）
        if (window.Tegaki?.ErrorManagerInstance) {
            window.Tegaki.ErrorManagerInstance.showInfo('Tegaki初期化完了 - キャンバス表示成功', {
                duration: 3000,
                autoClose: true
            });
        } else {
            // ErrorManager未使用時は単純なconsole出力
            console.log('🎉 Tegaki初期化完了 - キャンバス表示成功');
        }
    }
    
    /**
     * 強制クリーンアップ（ページ離脱時）
     */
    destroy() {
        if (this.pixiApp) {
            this.pixiApp.destroy(true, true);
            this.pixiApp = null;
        }
        
        this.initialized = false;
        console.log('🧹 TegakiApplication クリーンアップ完了');
    }
    
    /**
     * デバッグ情報取得
     */
    getDebugInfo() {
        return {
            initialized: this.initialized,
            canvasVisible: this.pixiApp ? !!this.pixiApp.view.offsetWidth : false,
            canvasSize: this.pixiApp ? {
                width: this.pixiApp.view.width,
                height: this.pixiApp.view.height
            } : null,
            managersReady: {
                canvas: !!this.canvasManager,
                tool: !!this.toolManager
            },
            pixiReady: !!this.pixiApp
        };
    }
}

// Tegaki名前空間にクラス登録
window.Tegaki.TegakiApplication = TegakiApplication;

/**
 * デバッグ関数（シンプル版）
 */
window.checkTegaki = function() {
    console.log('🔍 Tegaki状態確認');
    
    if (window.Tegaki?.AppInstance) {
        const debug = window.Tegaki.AppInstance.getDebugInfo();
        console.log('📊 デバッグ情報:', debug);
        return debug;
    } else {
        console.error('❌ TegakiApplication instance not found');
        return { error: 'TegakiApplication instance not found' };
    }
};

/**
 * 緊急修復関数（シンプル版）
 */
window.emergencyFix = function() {
    console.log('🆘 緊急修復開始');
    
    try {
        // 既存インスタンス破棄
        if (window.Tegaki?.AppInstance?.destroy) {
            window.Tegaki.AppInstance.destroy();
        }
        
        // 新規インスタンス作成
        const app = new window.Tegaki.TegakiApplication();
        window.Tegaki.AppInstance = app;
        
        console.log('✅ 緊急修復完了');
        return true;
        
    } catch (error) {
        console.error('❌ 緊急修復失敗:', error);
        return false;
    }
};

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
        console.error('🆘 Global Error:', event.error || event.message);
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
        console.error('🆘 Unhandled Promise:', event.reason);
    }
});

/**
 * ページ離脱時のクリーンアップ
 */
window.addEventListener('beforeunload', () => {
    if (window.Tegaki?.AppInstance?.destroy) {
        window.Tegaki.AppInstance.destroy();
    }
});

console.log('🎨 Tegaki Simple Main Loaded');
console.log('✨ 特徴: 直線的初期化・キャンバス確実表示・エラー隠蔽禁止');
console.log('🔧 デバッグ: window.checkTegaki(), window.emergencyFix()');