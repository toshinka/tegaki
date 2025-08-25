/**
 * 🎨 Tegaki Main - 骨太構造・キャンバス確実表示版
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
        this.pixiApp = null;
        this.appCore = null;
        
        // Step 1: AppCore初期化
        this.initializeAppCore();
        
        // Step 2: キャンバス作成（最優先）
        this.createCanvas();
        
        // Step 3: UI連携
        this.setupUI();
        
        this.initialized = true;
        console.log('✅ TegakiApplication 初期化完了');
        
        // 成功通知
        this.showSuccessMessage();
    }
    
    /**
     * Step 1: AppCore初期化
     */
    async initializeAppCore() {
        console.log('🔧 AppCore初期化開始...');
        
        if (!window.Tegaki?.AppCore) {
            throw new Error('AppCore class not available');
        }
        
        this.appCore = new window.Tegaki.AppCore();
        await this.appCore.initialize();
        
        console.log('✅ AppCore初期化完了');
    }
    
    /**
     * Step 2: キャンバス作成（エラー隠蔽禁止）
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
        
        // 設定取得
        const config = window.Tegaki.ConfigManagerInstance || null;
        const canvasConfig = config ? config.getCanvasConfig() : {
            width: 400,
            height: 400,
            backgroundColor: '#f0e0d6' // futaba-cream
        };
        
        this.pixiApp = new PIXI.Application({
            width: canvasConfig.width,
            height: canvasConfig.height,
            backgroundColor: 0xf0e0d6, // futaba-cream: #f0e0d6
            antialias: true,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true
        });
        
        // コンテナにキャンバス追加（失敗時は即例外）
        container.appendChild(this.pixiApp.view);
        
        // AppCoreにPixiApp設定
        if (this.appCore) {
            this.appCore.setPixiApp(this.pixiApp);
        }
        
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
        
        // 背景（futaba-cream色）
        testGraphics.beginFill(0xf0e0d6);
        testGraphics.drawRect(0, 0, 400, 400);
        testGraphics.endFill();
        
        // 中央にふたば風赤い円
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
     * Step 3: UI連携
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
        canvas.addEventListener('pointerup', (e)