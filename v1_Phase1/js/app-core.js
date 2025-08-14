/**
 * 🎯 AI_WORK_SCOPE: PixiJS基盤システム・Manager統括・描画エンジン初期化
 * 🎯 DEPENDENCIES: main.js, library-manager.js
 * 🎯 CDN_USAGE: PIXI, pixi-viewport（オプション）
 * 🎯 ISOLATION_TEST: ✅ 単体テスト可能
 * 🎯 SPLIT_THRESHOLD: 300行以下維持
 * 
 * 📋 PHASE_TARGET: Phase1
 * 📋 V8_MIGRATION: V8Compatibility経由での初期化準備
 * 📋 PERFORMANCE_TARGET: 高速描画基盤・60FPS安定動作
 */

export class AppCore {
    constructor() {
        this.app = null;
        this.viewport = null;
        this.drawingContainer = null;
        this.managers = new Map();
        this.isInitialized = false;
        this.canvasSize = { width: 400, height: 400 };
        
        // 現在の描画状態
        this.currentPath = null;
        this.paths = [];
        this.isDrawing = false;
        
        // ふたば色設定
        this.backgroundColor = 0xf0e0d6; // ふたばクリーム色
    }

    async init() {
        console.log('🎨 AppCore初期化開始');
        
        try {
            // PixiJS Application初期化
            await this.initializePixiApplication();
            
            // 描画コンテナセットアップ
            this.setupDrawingContainer();
            
            // Viewport統合（利用可能な場合）
            await this.setupViewport();
            
            // Manager初期化
            await this.initializeManagers();
            
            // イベントハンドラー設定
            this.setupEventHandlers();
            
            // 初期化完了
            this.completeInitialization();
            
            console.log('✅ AppCore初期化完了');
            return this.app;
            
        } catch (error) {
            console.error('❌ AppCore初期化エラー:', error);
            throw error;
        }
    }

    async initializePixiApplication() {
        console.log('🖼️ PixiJS Application初期化中...');
        
        // v7互換モード（Phase4でv8対応）
        this.app = new PIXI.Application({
            width: this.canvasSize.width,
            height: this.canvasSize.height,
            backgroundColor: this.backgroundColor,
            antialias: true,
            resolution: 1, // デバイス解像度固定
            autoDensity: false // 拡大防止
        });

        // キャンバスをDOMに追加
        const canvasContainer = document.getElementById('drawing-canvas');
        if (canvasContainer) {
            canvasContainer.appendChild(this.app.view);
        } else {
            throw new Error('drawing-canvasコンテナが見つかりません');
        }
        
        console.log('✅ PixiJS Application初期化完了');
    }

    setupDrawingContainer() {
        console.log('🎨 描画コンテナセットアップ中...');
        
        // メイン描画コンテナ
        this.drawingContainer = new PIXI.Container();
        this.app.stage.addChild(this.drawingContainer);
        
        // インタラクション設定
        this.app.stage.interactive = true;
        this.app.stage.hitArea = new PIXI.Rectangle(0, 0, this.canvasSize.width, this.canvasSize.height);
        
        console.log('✅ 描画コンテナセットアップ完了');
    }

    async setupViewport() {
        // pixi-viewport利用可能な場合のみ統合
        if (window.Viewport) {
            console.log('🌐 pixi-viewport統合中...');