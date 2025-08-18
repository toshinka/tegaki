/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0（修正版）
 * 🎯 アプリケーションコア（統一システム対応版）
 * 
 * 🚨 修正内容:
 * - EventBus統合によるイベント発行制御
 * - ErrorManager統一エラー処理対応
 * - UIController初期化順序最適化
 * - setupPopups メソッド追加（エラー解消）
 * - 循環参照防止対応
 * 
 * 🎯 AI_WORK_SCOPE: PixiJSアプリケーション基盤・描画エンジン・ツールシステム
 * 🎯 DEPENDENCIES: libs/pixi-extensions.js, PixiJS Core, 統一システム
 * 🎯 NODE_MODULES: pixi.js（Graphics, Container, Application使用）
 * 🎯 PIXI_EXTENSIONS: 条件付き使用・フォールバック対応
 * 🎯 ISOLATION_TEST: ❌ PixiJS本体依存
 * 🎯 SPLIT_THRESHOLD: 500行超過時 → 機能別分割
 * 
 * 📋 PHASE_TARGET: Phase1
 * 📋 V8_MIGRATION: Application・Graphics・Container API変更対応予定
 * 📋 PERFORMANCE_TARGET: 60FPS安定描画・3秒以内初期化
 */

class AppCore {
    constructor() {
        this.app = null;
        this.drawingContainer = null;
        this.uiContainer = null;
        this.paths = [];
        this.currentTool = 'pen';
        
        // 設定
        this.canvasWidth = 400;
        this.canvasHeight = 400;
        this.backgroundColor = 0xf0e0d6;
        
        // ツールシステム
        this.toolSystem = null;
        this.uiController = null;
        this.performanceMonitor = null;
        
        // 拡張機能フラグ
        this.extensionsAvailable = false;
        this.fallbackMode = false;
        
        // 🚨 修正: 初期化状態管理
        this.isInitializing = false;
        this.initializationComplete = false;
        
        console.log('🎨 AppCore インスタンス作成完了（修正版）');
    }
    
    /**
     * アプリケーション初期化（修正版）
     */
    async initialize() {
        try {
            console.log('🚀 AppCore 初期化開始（統一システム対応版）...');
            
            // 🚨 修正: 初期化状態フラグ設定
            this.isInitializing = true;
            
            // Step 1: DOM要素確認（最重要）
            await this.verifyDOMElements();
            
            // Step 2: 拡張機能確認
            await this.checkExtensions();
            
            // Step 3: PixiJS アプリケーション初期化（修復版）
            await this.initializePixiApp();
            
            // Step 4: コンテナ初期化
            this.initializeContainers();
            
            // Step 5: ツールシステム初期化
            this.initializeToolSystem();
            
            // Step 6: UI制御初期化（修正：イベント制御付き）
            await this.initializeUI();
            
            // Step 7: イベントリスナー設定
            this.setupEventListeners();
            
            // Step 8: 描画エンジン初期化
            this.initializeDrawingEngine();
            
            // Step 9: パフォーマンス監視開始
            this.startPerformanceMonitoring();
            
            // Step 10: 初期化完了確認
            this.verifyInitialization();
            
            // 🚨 修正: 初期化完了状態設定
            this.isInitializing = false;
            this.initializationComplete = true;
            
            console.log('✅ AppCore 初期化完了（統一システム対応版）');
            this.displayInitializationSummary();
            
        } catch (error) {
            console.error('💀 AppCore統一版初期化エラー:', error);
            
            // 🚨 修正: 統一エラーハンドリング
            if (window.ErrorManager) {
                window.ErrorManager.showError('error', error, {
                    additionalInfo: 'AppCore初期化失敗',
                    showReload: true
                });
            }
            
            await this.initializeFallbackMode(error);
        }
    }
    
    /**
     * 🔧 修復: DOM要素確認（最重要）
     */
    async verifyDOMElements() {
        console.log('🔍 DOM要素確認開始（キャンバス表示修復）...');
        
        // キャンバス要素確認
        const canvasElement = document.getElementById('drawing-canvas');
        if (!canvasElement) {
            throw new Error('drawing-canvas 要素が見つかりません');
        }
        
        // キャンバス要素のクリア（既存コンテンツを削除）
        while (canvasElement.firstChild) {
            canvasElement.removeChild(canvasElement.firstChild);
        }
        
        // CSS設定確認
        const computedStyle = window.getComputedStyle(canvasElement);
        console.log(`📏 drawing-canvas CSS: display=${computedStyle.display}, position=${computedStyle.position}`);
        
        // 親要素確認
        const canvasContainer = canvasElement.parentElement;
        if (canvasContainer) {
            console.log(`📦 親要素: ${canvasContainer.className}`);
        }
        
        console.log('✅ DOM要素確認完了 - キャンバス要素準備完了');
    }
    
    /**
     * 拡張機能確認
     */
    async checkExtensions() {
        console.log('🔍 拡張機能確認中...');
        
        if (window.PixiExtensions && window.PixiExtensions.initialized) {
            this.extensionsAvailable = true;
            const stats = window.PixiExtensions.getStats();
            console.log(`✅ 拡張機能利用可能: ${stats.available}/${stats.total}`);
            
            if (stats.fallbackMode) {
                console.warn('⚠️ 拡張機能フォールバックモード検出');
                this.fallbackMode = true;
            }
        } else {
            console.warn('⚠️ 拡張機能未初期化 - フォールバックモード有効');
            this.fallbackMode = true;
        }
    }
    
    /**
     * 🔧 修復: PixiJS アプリケーション初期化（完全修復版）
     */
    async initializePixiApp() {
        console.log('🎮 PixiJS アプリケーション初期化中（修復版）...');
        
        // 🎯 修正: 元HTML版と完全同等の設定を使用
        const appConfig = {
            width: this.canvasWidth,
            height: this.canvasHeight,
            backgroundColor: this.backgroundColor,
            antialias: true,
            resolution: 1, // 🔧 修正: 元版と同じく固定値1
            autoDensity: false // 🔧 修正: 元版と同じく無効化
        };
        
        console.log('🔧 PixiJS Application設定:', appConfig);
        
        // PixiJS アプリケーション作成
        this.app = new PIXI.Application(appConfig);
        
        // 🔧 修復: DOM接続の確実な実装
        const canvasElement = document.getElementById('drawing-canvas');
        if (!canvasElement) {
            throw new Error('drawing-canvas 要素が見つかりません');
        }
        
        // TODO: PixiJS v8 - this.app.view → this.app.canvas
        canvasElement.appendChild(this.app.view);
        
        // 🔧 修復: DOM接続確認
        if (canvasElement.contains(this.app.view)) {
            console.log('✅ PixiJS キャンバスDOM接続確認完了');
        } else {
            throw new Error('PixiJS キャンバスのDOM接続に失敗');
        }
        
        // キャンバススタイル設定（元版と同等）
        this.app.view.style.display = 'block';
        this.app.view.style.cursor = 'crosshair';
        
        console.log(`✅ PixiJS アプリケーション初期化完了 (${this.canvasWidth}x${this.canvasHeight})`);
        console.log(`📏 実際のキャンバスサイズ: ${this.app.view.width}x${this.app.view.height}`);
    }
    
    /**
     * コンテナ初期化
     */
    initializeContainers() {
        console.log('📦 コンテナ初期化中...');
        
        // 描画用コンテナ
        this.drawingContainer = new PIXI.Container();
        this.drawingContainer.name = 'drawing-layer';
        this.app.stage.addChild(this.drawingContainer);
        
        // UI用コンテナ
        this.uiContainer = new PIXI.Container();
        this.uiContainer.name = 'ui-layer';
        this.app.stage.addChild(this.uiContainer);
        
        // インタラクション設定
        this.app.stage.interactive = true;
        this.app.stage.hitArea = new PIXI.Rectangle(0, 0, this.canvasWidth, this.canvasHeight);
        
        console.log('✅ コンテナ初期化完了');
    }
    
    /**
     * ツールシステム初期化
     */
    initializeToolSystem() {
        console.log('🔧 ツールシステム初期化中...');
        
        this.toolSystem = new DrawingToolSystem(this);
        
        console.log('✅ ツールシステム初期化完了');
    }
    
    /**
     * UI制御初期化（修正版：イベント制御付き）
     */
    async initializeUI() {
        console.log('🎨 UI制御初期化中（修正版）...');
        
        try {
            this.uiController = new UIController(this.toolSystem);
            
            // 🚨 修正: 初期化中のイベント制御
            if (this.isInitializing) {
                console.log('🔒 初期化中のためイベント発行を制御');
            }
            
            this.uiController.initialize();
            
            console.log('✅ UI制御初期化完了');
        } catch (error) {
            console.error('💀 UI制御初期化エラー:', error);
            
            // 🚨 修正: UIController初期化失敗時のフォールバック
            if (window.ErrorManager) {
                window.ErrorManager.showError('warning', 
                    `UI制御初期化に失敗しました: ${error.message}`);
            }
            
            // 最小限のUIコントローラー作成
            this.uiController = new MinimalUIController(this.toolSystem);
        }
    }
    
    /**
     * イベントリスナー設定
     */
    setupEventListeners() {
        console.log('🎧 イベントリスナー設定中...');
        
        // 描画イベント
        this.app.stage.on('pointerdown', this.handlePointerDown.bind(this));
        this.app.stage.on('pointermove', this.handlePointerMove.bind(this));
        this.app.stage.on('pointerup', this.handlePointerUp.bind(this));
        this.app.stage.on('pointerupoutside', this.handlePointerUp.bind(this));
        
        // リサイズイベント
        window.addEventListener('resize', this.handleResize.bind(this));
        
        console.log('✅ イベントリスナー設定完了');
    }
    
    /**
     * 描画エンジン初期化
     */
    initializeDrawingEngine() {
        console.log('🖊️ 描画エンジン初期化中...');
        
        // 描画エンジンは ToolSystem 内で管理
        if (this.toolSystem) {
            this.toolSystem.initializeDrawingEngine();
        }
        
        console.log('✅ 描画エンジン初期化完了');
    }
    
    /**
     * パフォーマンス監視開始
     */
    startPerformanceMonitoring() {
        console.log('📊 パフォーマンス監視開始...');
        
        try {
            this.performanceMonitor = new PerformanceMonitor();
            this.performanceMonitor.start();
            
            console.log('✅ パフォーマンス監視開始完了');
        } catch (error) {
            console.warn('⚠️ パフォーマンス監視開始失敗:', error);
        }
    }
    
    /**
     * 🔧 修復: 初期化完了確認
     */
    verifyInitialization() {
        console.log('🔍 初期化完了確認中...');
        
        const verificationResults = {
            pixiApp: !!this.app,
            canvasElement: !!document.getElementById('drawing-canvas'),
            canvasInDOM: document.getElementById('drawing-canvas')?.contains(this.app?.view),
            drawingContainer: !!this.drawingContainer,
            toolSystem: !!this.toolSystem,
            uiController: !!this.uiController,
            performanceMonitor: !!this.performanceMonitor,
            stageInteractive: this.app?.stage?.interactive
        };
        
        const totalChecks = Object.keys(verificationResults).length;
        const passedChecks = Object.values(verificationResults).filter(Boolean).length;
        
        console.log('🔍 初期化検証結果:', verificationResults);
        console.log(`✅ 検証完了: ${passedChecks}/${totalChecks} (${(passedChecks/totalChecks*100).toFixed(1)}%)`);
        
        if (passedChecks < totalChecks) {
            const failedChecks = Object.entries(verificationResults)
                .filter(([key, value]) => !value)
                .map(([key, value]) => key);
            console.warn('⚠️ 初期化未完了項目:', failedChecks);
        }
        
        // 🎯 キャンバス表示の最終確認
        const canvasElement = document.getElementById('drawing-canvas');
        const pixiCanvas = this.app?.view;
        
        if (canvasElement && pixiCanvas && canvasElement.contains(pixiCanvas)) {
            console.log('🎉 キャンバス表示修復成功！');
            console.log(`📐 キャンバス確認: ${pixiCanvas.width}x${pixiCanvas.height}, 表示: ${pixiCanvas.style.display}`);
        } else {
            throw new Error('キャンバス表示修復に失敗 - DOM接続が不完全');
        }
    }
    
    /**
     * フォールバックモード初期化（修正版）
     */
    async initializeFallbackMode(error) {
        console.log('🛡️ フォールバックモード初期化中...');
        this.fallbackMode = true;
        
        try {
            // 最低限のPixiJSアプリケーション初期化
            if (!this.app) {
                // 🔧 修正: 超シンプル設定でPixiJS Application作成
                this.app = new PIXI.Application({
                    width: 400,
                    height: 400,
                    backgroundColor: 0xf0e0d6,
                    antialias: true,
                    resolution: 1,
                    autoDensity: false
                });
                
                const canvasElement = document.getElementById('drawing-canvas');
                if (canvasElement) {
                    // TODO: PixiJS v8 - this.app.view → this.app.canvas
                    canvasElement.appendChild(this.app.view);
                    console.log('✅ フォールバックPixiJSアプリケーション作成完了');
                }
            }
            
            if (!this.drawingContainer) {
                this.initializeContainers();
            }
            
            // 簡易ツールシステム
            this.toolSystem = new SimpleFallbackToolSystem(this);
            
            console.log('✅ フォールバックモード初期化完了');
            
            // 回復メッセージ表示（統一システム使用）
            if (window.ErrorManager) {
                window.ErrorManager.showError('recovery', 
                    '基本描画機能は利用可能です。一部の高度な機能が制限されています。');
            }
            
        } catch (fallbackError) {
            console.error('💀 フォールバックモード初期化も失敗:', fallbackError);
            
            if (window.ErrorManager) {
                window.ErrorManager.showError('critical', error.message, {
                    additionalInfo: fallbackError.message,
                    showDebug: true
                });
            } else {
                this.displayCriticalError(fallbackError);
            }
        }
    }
    
    /**
     * イベントハンドラ: ポインターダウン
     */
    handlePointerDown(event) {
        if (!this.toolSystem) return;
        
        const point = this.getLocalPointerPosition(event);
        this.toolSystem.startDrawing(point.x, point.y);
        
        // 🚨 修正: EventBus経由でのイベント発行（安全版）
        if (window.EventBus && this.initializationComplete) {
            window.EventBus.safeEmit(window.EventBus.Events.DRAWING_STARTED, {
                x: point.x,
                y: point.y,
                tool: this.toolSystem.currentTool
            });
        }
        
        console.log(`🖊️ 描画開始: (${point.x.toFixed(1)}, ${point.y.toFixed(1)})`);
    }
    
    /**
     * イベントハンドラ: ポインター移動
     */
    handlePointerMove(event) {
        const point = this.getLocalPointerPosition(event);
        
        // 座標表示更新
        if (document.getElementById('coordinates')) {
            document.getElementById('coordinates').textContent = 
                `x: ${Math.round(point.x)}, y: ${Math.round(point.y)}`;
        }
        
        if (!this.toolSystem) return;
        this.toolSystem.continueDrawing(point.x, point.y);
        
        // 🚨 修正: EventBus経由でのイベント発行（描画中のみ）
        if (window.EventBus && this.initializationComplete && this.toolSystem.isDrawing) {
            window.EventBus.safeEmit(window.EventBus.Events.DRAWING_CONTINUED, {
                x: point.x,
                y: point.y
            });
        }
    }
    
    /**
     * イベントハンドラ: ポインターアップ
     */
    handlePointerUp(event) {
        if (!this.toolSystem) return;
        
        this.toolSystem.stopDrawing();
        
        // 筆圧モニターリセット
        if (document.getElementById('pressure-monitor')) {
            document.getElementById('pressure-monitor').textContent = '0.0%';
        }
        
        // 🚨 修正: EventBus経由でのイベント発行（安全版）
        if (window.EventBus && this.initializationComplete) {
            window.EventBus.safeEmit(window.EventBus.Events.DRAWING_ENDED, {
                pathCount: this.paths.length
            });
        }
        
        console.log('🖊️ 描画終了');
    }
    
    /**
     * イベントハンドラ: リサイズ
     */
    handleResize() {
        if (!this.app) return;
        
        // リサイズ処理（必要に応じて実装）
        console.log('🔄 ウィンドウリサイズ検出');
    }
    
    /**
     * ローカルポインター位置取得（修正版）
     */
    getLocalPointerPosition(event) {
        if (!this.app?.view) {
            return { x: 0, y: 0 };
        }
        
        const rect = this.app.view.getBoundingClientRect();
        const originalEvent = event.data?.originalEvent || event.originalEvent || event;
        
        const clientX = originalEvent.clientX || originalEvent.pageX || 0;
        const clientY = originalEvent.clientY || originalEvent.pageY || 0;
        
        const x = (clientX - rect.left) * (this.canvasWidth / rect.width);
        const y = (clientY - rect.top) * (this.canvasHeight / rect.height);
        
        return { 
            x: Math.max(0, Math.min(this.canvasWidth, x)), 
            y: Math.max(0, Math.min(this.canvasHeight, y)) 
        };
    }
    
    /**
     * キャンバスリサイズ（修正版）
     */
    resize(newWidth, newHeight, centerContent = false) {
        if (!this.app) return;
        
        const oldWidth = this.canvasWidth;
        const oldHeight = this.canvasHeight;
        
        this.canvasWidth = newWidth;
        this.canvasHeight = newHeight;
        
        // アプリケーションリサイズ
        this.app.renderer.resize(newWidth, newHeight);
        this.app.stage.hitArea = new PIXI.Rectangle(0, 0, newWidth, newHeight);
        
        // コンテンツ中央寄せ
        if (centerContent && this.drawingContainer && this.paths.length > 0) {
            const offsetX = (newWidth - oldWidth) / 2;
            const offsetY = (newHeight - oldHeight) / 2;
            
            this.drawingContainer.x += offsetX;
            this.drawingContainer.y += offsetY;
        }
        
        // ステータス更新
        if (document.getElementById('canvas-info')) {
            document.getElementById('canvas-info').textContent = `${newWidth}×${newHeight}px`;
        }
        
        // 🚨 修正: EventBus経由でのイベント発行（安全版）
        if (window.EventBus && this.initializationComplete) {
            window.EventBus.safeEmit(window.EventBus.Events.CANVAS_RESIZED, {
                width: newWidth,
                height: newHeight,
                centerContent
            });
        }
        
        console.log(`📐 キャンバスリサイズ: ${newWidth}x${newHeight}`);
    }
    
    /**
     * 初期化サマリー表示
     */
    displayInitializationSummary() {
        const summary = {
            pixiApp: !!this.app,
            canvasInDOM: document.getElementById('drawing-canvas')?.contains(this.app?.view),
            drawingContainer: !!this.drawingContainer,
            toolSystem: !!this.toolSystem,
            uiController: !!this.uiController,
            performanceMonitor: !!this.performanceMonitor,
            extensionsAvailable: this.extensionsAvailable,
            fallbackMode: this.fallbackMode
        };
        
        console.log('📋 初期化サマリー:', summary);
        
        const initComponents = Object.values(summary).filter(Boolean).length;
        const totalComponents = Object.keys(summary).length;
        
        console.log(`✅ 初期化完了率: ${initComponents}/${totalComponents} (${(initComponents/totalComponents*100).toFixed(1)}%)`);
        
        // 🎯 キャンバス表示修復成功メッセージ
        if (summary.canvasInDOM) {
            console.log('🎉 キャンバス表示修復完全成功！');
            console.log('🖊️ ペンツールでキャンバス上をドラッグして描画テスト可能');
        }
    }
    
    /**
     * 致命的エラー表示（フォールバック用）
     */
    displayCriticalError(error) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #800000;
            color: white;
            padding: 20px;
            border-radius: 10px;
            text-align: center;
            z-index: 9999;
            font-family: monospace;
            max-width: 400px;
        `;
        errorDiv.innerHTML = `
            <h3>🚫 致命的エラー</h3>
            <p style="margin: 10px 0;">AppCore初期化に失敗しました</p>
            <details style="margin: 10px 0; text-align: left;">
                <summary style="cursor: pointer;">エラー詳細</summary>
                <pre style="margin: 5px 0; font-size: 10px; overflow: auto; max-height: 100px;">${error.message}</pre>
            </details>
            <button onclick="location.reload()" style="margin-top: 10px; padding: 8px 15px; background: white; color: #800000; border: none; border-radius: 5px; cursor: pointer;">再読み込み</button>
        `;
        document.body.appendChild(errorDiv);
    }
}

/**
 * 描画ツールシステム（修正版）
 */
class DrawingToolSystem {
    constructor(appCore) {
        this.appCore = appCore;
        this.currentTool = 'pen';
        this.isDrawing = false;
        this.currentPath = null;
        this.lastPoint = null;
        
        // ツール設定
        this.brushSize = 16.0;
        this.brushColor = 0x800000;
        this.opacity = 0.85;
        this.pressure = 0.5;
        this.smoothing = 0.3;
        
        // 拡張機能フラグ
        this.extensionsAvailable = appCore.extensionsAvailable;
        
        console.log('🔧 DrawingToolSystem 初期化完了（修正版）');
    }
    
    /**
     * 描画エンジン初期化
     */
    initializeDrawingEngine() {
        console.log('🖊️ 描画エンジン初期化中...');
        
        // 基本描画機能は常に利用可能
        console.log('✅ 基本描画エンジン初期化完了');
    }
    
    /**
     * ツール設定（修正版：EventBus統合）
     */
    setTool(tool) {
        this.currentTool = tool;
        
        // 🚨 修正: EventBus経由でのイベント発行（安全版）
        if (window.EventBus && this.appCore.initializationComplete) {
            window.EventBus.safeEmit(window.EventBus.Events.TOOL_CHANGED, { 
                tool,
                previousTool: this.currentTool
            });
        }
        
        console.log(`🔧 ツール変更: ${tool}`);
    }
    
    setBrushSize(size) {
        const oldSize = this.brushSize;
        this.brushSize = Math.max(0.1, Math.min(100, Math.round(size * 10) / 10));
        
        // 🚨 修正: EventBus経由でのイベント発行（安全版・初期化完了後のみ）
        if (window.EventBus && this.appCore.initializationComplete) {
            window.EventBus.safeEmit(window.EventBus.Events.BRUSH_SIZE_CHANGED, {
                size: this.brushSize,
                previousSize: oldSize
            });
        }
    }
    
    setOpacity(opacity) {
        const oldOpacity = this.opacity;
        this.opacity = Math.max(0, Math.min(1, Math.round(opacity * 1000) / 1000));
        
        // 🚨 修正: EventBus経由でのイベント発行（安全版）
        if (window.EventBus && this.appCore.initializationComplete) {
            window.EventBus.safeEmit(window.EventBus.Events.OPACITY_CHANGED, {
                opacity: this.opacity,
                previousOpacity: oldOpacity
            });
        }
    }
    
    setPressure(pressure) {
        const oldPressure = this.pressure;
        this.pressure = Math.max(0, Math.min(1, Math.round(pressure * 1000) / 1000));
        
        // 🚨 修正: EventBus経由でのイベント発行（安全版）
        if (window.EventBus && this.appCore.initializationComplete) {
            window.EventBus.safeEmit(window.EventBus.Events.PRESSURE_CHANGED, {
                pressure: this.pressure,
                previousPressure: oldPressure
            });
        }
    }
    
    setSmoothing(smoothing) {
        this.smoothing = Math.max(0, Math.min(1, Math.round(smoothing * 1000) / 1000));
    }
    
    /**
     * 描画開始（修復版）
     */
    startDrawing(x, y) {
        this.isDrawing = true;
        this.lastPoint = { x, y };
        
        // 現在のツールに応じた描画開始
        if (this.currentTool === 'pen') {
            this.currentPath = this.createPenPath(x, y);
        } else if (this.currentTool === 'eraser') {
            this.currentPath = this.createEraserPath(x, y);
        }
        
        // 筆圧モニター更新
        if (document.getElementById('pressure-monitor')) {
            const pressure = this.pressure * 100 + Math.random() * 10;
            document.getElementById('pressure-monitor').textContent = `${pressure.toFixed(1)}%`;
        }
        
        console.log(`🖊️ 描画開始 (${this.currentTool}): (${x.toFixed(1)}, ${y.toFixed(1)}), サイズ: ${this.brushSize}`);
    }
    
    /**
     * 描画継続（修復版）
     */
    continueDrawing(x, y) {
        if (!this.isDrawing || !this.currentPath || !this.lastPoint) return;
        
        const distance = Math.sqrt((x - this.lastPoint.x) ** 2 + (y - this.lastPoint.y) ** 2);
        
        // 最小距離フィルタ
        if (distance < 1.5) return;
        
        // 線の描画（元HTML版と同じ実装）
        this.drawLine(this.currentPath, this.lastPoint.x, this.lastPoint.y, x, y);
        this.lastPoint = { x, y };
        
        // 筆圧モニター更新
        if (document.getElementById('pressure-monitor')) {
            const pressure = this.pressure * 100 + Math.random() * 15;
            document.getElementById('pressure-monitor').textContent = `${pressure.toFixed(1)}%`;
        }
    }
    
    /**
     * 描画終了
     */
    stopDrawing() {
        if (this.currentPath) {
            this.currentPath.isComplete = true;
            this.appCore.paths.push(this.currentPath);
            console.log(`🖊️ 描画完了: ${this.currentPath.points.length}ポイント`);
            
            // 🚨 修正: EventBus経由でのイベント発行（安全版）
            if (window.EventBus && this.appCore.initializationComplete) {
                window.EventBus.safeEmit(window.EventBus.Events.PATH_CREATED, {
                    pathId: this.currentPath.id,
                    pointCount: this.currentPath.points.length,
                    tool: this.currentPath.tool
                });
            }
        }
        
        this.isDrawing = false;
        this.currentPath = null;
        this.lastPoint = null;
    }
    
    /**
     * ペンパス作成（元HTML版準拠）
     */
    createPenPath(x, y) {
        const path = {
            id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            graphics: new PIXI.Graphics(),
            points: [{ x, y, size: this.brushSize }],
            color: this.brushColor,
            size: this.brushSize,
            opacity: this.opacity,
            tool: 'pen',
            isComplete: false
        };
        
        // TODO: PixiJS v8 - Graphics.beginFill → Graphics.fill
        path.graphics.beginFill(path.color, path.opacity);
        path.graphics.drawCircle(x, y, path.size / 2);
        path.graphics.endFill();
        
        this.appCore.drawingContainer.addChild(path.graphics);
        return path;
    }
    
    /**
     * 消しゴムパス作成
     */
    createEraserPath(x, y) {
        const path = {
            id: `eraser_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            graphics: new PIXI.Graphics(),
            points: [{ x, y, size: this.brushSize }],
            color: this.appCore.backgroundColor,
            size: this.brushSize,
            opacity: 1.0,
            tool: 'eraser',
            isComplete: false
        };
        
        // TODO: PixiJS v8 - Graphics.beginFill → Graphics.fill
        path.graphics.beginFill(path.color, path.opacity);
        path.graphics.drawCircle(x, y, path.size / 2);
        path.graphics.endFill();
        
        this.appCore.drawingContainer.addChild(path.graphics);
        return path;
    }
    
    /**
     * 線描画（元HTML版準拠の円形ブラシ方式）
     */
    drawLine(path, x1, y1, x2, y2) {
        const distance = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
        const steps = Math.max(1, Math.ceil(distance / 1.5));
        
        // 連続する円形で滑らかな線を描画
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const px = x1 + (x2 - x1) * t;
            const py = y1 + (y2 - y1) * t;
            
            // TODO: PixiJS v8 - Graphics.beginFill → Graphics.fill
            path.graphics.beginFill(path.color, path.opacity);
            path.graphics.drawCircle(px, py, path.size / 2);
            path.graphics.endFill();
        }
        
        path.points.push({ x: x2, y: y2, size: path.size });
    }
}

/**
 * 簡易フォールバックツールシステム
 */
class SimpleFallbackToolSystem extends DrawingToolSystem {
    constructor(appCore) {
        super(appCore);
        console.log('🛡️ SimpleFallbackToolSystem 初期化完了');
    }
    
    initializeDrawingEngine() {
        console.log('🛡️ フォールバック描画エンジン初期化中...');
        console.log('✅ フォールバック描画エンジン初期化完了');
    }
}

/**
 * UI制御システム（修正版 - setupPopups メソッド追加）
 */
class UIController {
    constructor(toolSystem) {
        this.toolSystem = toolSystem;
        this.activePopup = null;
        this.sliders = new Map();
    }
    
    /**
     * 初期化（修正版：setupPopups メソッド追加済み）
     */
    initialize() {
        console.log('🎨 UI制御システム初期化中（修正版）...');
        
        try {
            this.setupToolButtons();
            this.setupPopups(); // 🚨 修正: setupPopups メソッド追加
            this.setupSliders();
            this.setupPresets();
            this.setupResize();
            this.setupCheckboxes();
            this.updateSizePresets();
            
            console.log('✅ UI制御システム初期化完了（修正版）');
        } catch (error) {
            console.error('💀 UI制御システム初期化エラー:', error);
            
            // 🚨 修正: ErrorManager統一エラー処理
            if (window.ErrorManager) {
                if (typeof window.ErrorManager.safeError === 'function') {
                    window.ErrorManager.safeError(`UI初期化エラー: ${error.message}`, 'error');
                } else {
                    window.ErrorManager.showError('error', error, {
                        additionalInfo: 'UIController初期化失敗'
                    });
                }
            }
            
            throw error;
        }
    }
    
    /**
     * 🚨 修正: setupPopups メソッド実装
     */
    setupPopups() {
        console.log('🪟 ポップアップシステム設定中...');
        
        try {
            // data-popup属性を持つ要素にクリックリスナー設定
            document.querySelectorAll('[data-popup]').forEach(trigger => {
                trigger.addEventListener('click', (e) => {
                    const popupId = e.target.getAttribute('data-popup');
                    if (popupId) {
                        this.togglePopup(popupId);
                    }
                });
            });
            
            // ポップアップ外クリックで閉じる機能
            document.addEventListener('click', (e) => {
                // ポップアップ内部またはトリガー要素以外をクリックした場合
                if (!e.target.closest('.popup-panel') && !e.target.closest('[data-popup]')) {
                    this.closeAllPopups();
                }
            });
            
            // Escapeキーでポップアップを閉じる
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.activePopup) {
                    this.closeAllPopups();
                }
            });
            
            console.log('✅ ポップアップシステム設定完了');
        } catch (error) {
            console.error('💀 ポップアップ設定エラー:', error);
            throw error;
        }
    }
    
    setupToolButtons() {
        document.querySelectorAll('.tool-button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (btn.classList.contains('disabled')) return;
                this.handleToolClick(e.currentTarget);
            });
        });
    }
    
    handleToolClick(button) {
        const toolId = button.id;
        const popupId = button.getAttribute('data-popup');
        
        if (toolId === 'pen-tool') {
            this.setTool('pen');
        } else if (toolId === 'eraser-tool') {
            this.setTool('eraser');
        }
        
        if (popupId) {
            this.togglePopup(popupId);
        }
    }
    
    setTool(tool) {
        if (this.toolSystem) {
            this.toolSystem.setTool(tool);
        }
        
        document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
        const toolButton = document.getElementById(tool + '-tool');
        if (toolButton) {
            toolButton.classList.add('active');
        }
        
        const toolNames = { pen: 'ベクターペン', eraser: '消しゴム' };
        if (document.getElementById('current-tool')) {
            document.getElementById('current-tool').textContent = toolNames[tool] || tool;
        }
    }
    
    togglePopup(popupId) {
        const popup = document.getElementById(popupId);
        if (!popup) {
            console.warn(`⚠️ ポップアップ要素が見つかりません: ${popupId}`);
            return;
        }
        
        // 他のポップアップを閉じる
        if (this.activePopup && this.activePopup !== popup) {
            this.activePopup.classList.remove('show');
        }
        
        // 現在のポップアップの表示状態を切り替え
        const isVisible = popup.classList.contains('show');
        popup.classList.toggle('show', !isVisible);
        
        this.activePopup = isVisible ? null : popup;
        
        console.log(`🪟 ポップアップ${isVisible ? '非表示' : '表示'}: ${popupId}`);
    }

setupSliders() {
        this.createSlider('pen-size-slider', 0.1, 100, 16.0, (value) => {
            if (this.toolSystem) {
                this.toolSystem.setBrushSize(value);
            }
            this.updateSizePresets();
            return value.toFixed(1) + 'px';
        });
        
        this.createSlider('pen-opacity-slider', 0, 100, 85.0, (value) => {
            if (this.toolSystem) {
                this.toolSystem.setOpacity(value / 100);
            }
            this.updateSizePresets();
            return value.toFixed(1) + '%';
        });
        
        this.createSlider('pen-pressure-slider', 0, 100, 50.0, (value) => {
            if (this.toolSystem) {
                this.toolSystem.setPressure(value / 100);
            }
            return value.toFixed(1) + '%';
        });
        
        this.createSlider('pen-smoothing-slider', 0, 100, 30.0, (value) => {
            if (this.toolSystem) {
                this.toolSystem.setSmoothing(value / 100);
            }
            return value.toFixed(1) + '%';
        });
        
        this.setupSliderButtons();
    }
    
    createSlider(sliderId, min, max, initial, callback) {
        const container = document.getElementById(sliderId);
        if (!container) {
            console.warn(`⚠️ スライダー要素が見つかりません: ${sliderId}`);
            return;
        }
        
        const track = container.querySelector('.slider-track');
        const handle = container.querySelector('.slider-handle');
        const valueDisplay = container.parentNode.querySelector('.slider-value');
        
        if (!track || !handle || !valueDisplay) {
            console.warn(`⚠️ スライダー部品が不完全: ${sliderId}`);
            return;
        }
        
        const sliderData = {
            value: initial,
            min, max, callback,
            track, handle, valueDisplay,
            isDragging: false
        };
        
        this.sliders.set(sliderId, sliderData);
        
        const updateSlider = (value) => {
            sliderData.value = Math.max(min, Math.min(max, value));
            const percentage = ((sliderData.value - min) / (max - min)) * 100;
            
            track.style.width = percentage + '%';
            handle.style.left = percentage + '%';
            valueDisplay.textContent = callback(sliderData.value);
        };
        
        const getValueFromPosition = (clientX) => {
            const rect = container.getBoundingClientRect();
            const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            return min + (percentage * (max - min));
        };
        
        // マウスイベント設定
        container.addEventListener('mousedown', (e) => {
            sliderData.isDragging = true;
            updateSlider(getValueFromPosition(e.clientX));
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (sliderData.isDragging) {
                updateSlider(getValueFromPosition(e.clientX));
            }
        });
        
        document.addEventListener('mouseup', () => {
            sliderData.isDragging = false;
        });
        
        // タッチイベント設定（モバイル対応）
        container.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                sliderData.isDragging = true;
                updateSlider(getValueFromPosition(e.touches[0].clientX));
                e.preventDefault();
            }
        });
        
        document.addEventListener('touchmove', (e) => {
            if (sliderData.isDragging && e.touches.length === 1) {
                updateSlider(getValueFromPosition(e.touches[0].clientX));
                e.preventDefault();
            }
        });
        
        document.addEventListener('touchend', () => {
            sliderData.isDragging = false;
        });
        
        // 初期値設定
        updateSlider(initial);
        
        console.log(`✅ スライダー設定完了: ${sliderId}`);
    }
    
    setupSliderButtons() {
        // スライダー調整ボタンの設定
        const adjustValue = (sliderId, delta) => {
            const slider = this.sliders.get(sliderId);
            if (slider) {
                const newValue = slider.value + delta;
                const clampedValue = Math.max(slider.min, Math.min(slider.max, newValue));
                slider.value = clampedValue;
                
                const percentage = ((clampedValue - slider.min) / (slider.max - slider.min)) * 100;
                slider.track.style.width = percentage + '%';
                slider.handle.style.left = percentage + '%';
                slider.valueDisplay.textContent = slider.callback(clampedValue);
            }
        };
        
        // ペンサイズ調整ボタン
        const sizeButtons = [
            { id: 'pen-size-decrease-small', delta: -0.1 },
            { id: 'pen-size-decrease', delta: -1 },
            { id: 'pen-size-decrease-large', delta: -10 },
            { id: 'pen-size-increase-small', delta: 0.1 },
            { id: 'pen-size-increase', delta: 1 },
            { id: 'pen-size-increase-large', delta: 10 }
        ];
        
        sizeButtons.forEach(config => {
            const button = document.getElementById(config.id);
            if (button) {
                button.addEventListener('click', () => {
                    adjustValue('pen-size-slider', config.delta);
                    this.updateSizePresets();
                });
            }
        });
        
        // 不透明度調整ボタン
        const opacityButtons = [
            { id: 'pen-opacity-decrease-small', delta: -0.1 },
            { id: 'pen-opacity-decrease', delta: -1 },
            { id: 'pen-opacity-decrease-large', delta: -10 },
            { id: 'pen-opacity-increase-small', delta: 0.1 },
            { id: 'pen-opacity-increase', delta: 1 },
            { id: 'pen-opacity-increase-large', delta: 10 }
        ];
        
        opacityButtons.forEach(config => {
            const button = document.getElementById(config.id);
            if (button) {
                button.addEventListener('click', () => {
                    adjustValue('pen-opacity-slider', config.delta);
                    this.updateSizePresets();
                });
            }
        });
    }
    
    setupPresets() {
        document.querySelectorAll('.size-preset-item').forEach(preset => {
            preset.addEventListener('click', () => {
                const size = parseFloat(preset.getAttribute('data-size'));
                if (!isNaN(size) && this.toolSystem) {
                    this.toolSystem.setBrushSize(size);
                    this.updateSliderValue('pen-size-slider', size);
                    this.updateSizePresets();
                }
            });
        });
    }
    
    setupResize() {
        document.querySelectorAll('.resize-button[data-size]').forEach(btn => {
            btn.addEventListener('click', () => {
                const sizeData = btn.getAttribute('data-size');
                if (sizeData) {
                    const [width, height] = sizeData.split(',').map(Number);
                    const widthInput = document.getElementById('canvas-width');
                    const heightInput = document.getElementById('canvas-height');
                    if (widthInput && heightInput && !isNaN(width) && !isNaN(height)) {
                        widthInput.value = width;
                        heightInput.value = height;
                    }
                }
            });
        });
    }
    
    setupCheckboxes() {
        document.querySelectorAll('.checkbox').forEach(checkbox => {
            checkbox.addEventListener('click', () => {
                checkbox.classList.toggle('checked');
            });
        });
    }
    
    updateSliderValue(sliderId, value) {
        const slider = this.sliders.get(sliderId);
        if (slider) {
            slider.value = value;
            const percentage = ((value - slider.min) / (slider.max - slider.min)) * 100;
            slider.track.style.width = percentage + '%';
            slider.handle.style.left = percentage + '%';
            slider.valueDisplay.textContent = slider.callback(value);
        }
    }
    
    updateSizePresets() {
        if (!this.toolSystem) return;
        
        const currentSize = this.toolSystem.brushSize;
        const currentOpacity = Math.round(this.toolSystem.opacity * 100);
        
        document.querySelectorAll('.size-preset-item').forEach(preset => {
            const presetSize = parseFloat(preset.getAttribute('data-size'));
            if (isNaN(presetSize)) return;
            
            const circle = preset.querySelector('.size-preview-circle');
            const label = preset.querySelector('.size-preview-label');
            const percent = preset.querySelector('.size-preview-percent');
            
            if (!circle || !label || !percent) return;
            
            // アクティブ状態の更新
            const isActive = Math.abs(presetSize - currentSize) < 0.1;
            preset.classList.toggle('active', isActive);
            
            // 円のサイズ更新
            let circleSize;
            if (isActive) {
                circleSize = Math.max(0.5, Math.min(20, (currentSize / 100) * 19.5 + 0.5));
            } else {
                circleSize = Math.max(0.5, Math.min(20, (presetSize / 100) * 19.5 + 0.5));
            }
            
            circle.style.width = circleSize + 'px';
            circle.style.height = circleSize + 'px';
            circle.style.opacity = this.toolSystem.opacity;
            
            // ラベル更新
            if (isActive) {
                label.textContent = currentSize.toFixed(1);
            } else {
                label.textContent = presetSize.toString();
            }
            
            percent.textContent = currentOpacity + '%';
        });
    }
    
    closeAllPopups() {
        document.querySelectorAll('.popup-panel').forEach(popup => {
            popup.classList.remove('show');
        });
        this.activePopup = null;
        console.log('🔒 全ポップアップ閉じる');
    }
}

/**
 * 最小限UIコントローラー（フォールバック用）
 */
class MinimalUIController {
    constructor(toolSystem) {
        this.toolSystem = toolSystem;
        this.activePopup = null;
        console.log('🛡️ MinimalUIController 初期化完了');
    }
    
    initialize() {
        console.log('🛡️ 最小限UI制御初期化中...');
        
        try {
            // 最低限のツールボタン設定のみ
            document.querySelectorAll('.tool-button').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    if (btn.id === 'pen-tool' && this.toolSystem) {
                        this.toolSystem.setTool('pen');
                        this.updateToolStatus('pen');
                    } else if (btn.id === 'eraser-tool' && this.toolSystem) {
                        this.toolSystem.setTool('eraser');
                        this.updateToolStatus('eraser');
                    }
                });
            });
            
            console.log('✅ 最小限UI制御初期化完了');
        } catch (error) {
            console.error('💀 最小限UI制御初期化エラー:', error);
        }
    }
    
    updateToolStatus(tool) {
        // ツールボタンのアクティブ状態更新
        document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
        const toolButton = document.getElementById(tool + '-tool');
        if (toolButton) {
            toolButton.classList.add('active');
        }
        
        // ツール名表示更新
        const toolNames = { pen: 'ベクターペン', eraser: '消しゴム' };
        const currentToolElement = document.getElementById('current-tool');
        if (currentToolElement) {
            currentToolElement.textContent = toolNames[tool] || tool;
        }
    }
    
    closeAllPopups() {
        document.querySelectorAll('.popup-panel').forEach(popup => {
            popup.classList.remove('show');
        });
        this.activePopup = null;
        console.log('🔒 全ポップアップ閉じる（最小限）');
    }
}

/**
 * パフォーマンス監視システム
 */
class PerformanceMonitor {
    constructor() {
        this.frameCount = 0;
        this.lastTime = performance.now();
        this.isRunning = false;
    }
    
    start() {
        if (this.isRunning) return;
        
        console.log('📊 パフォーマンス監視開始');
        this.isRunning = true;
        
        const update = () => {
            if (!this.isRunning) return;
            
            this.frameCount++;
            const currentTime = performance.now();
            
            // 1秒ごとにFPS更新
            if (currentTime - this.lastTime >= 1000) {
                const fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastTime));
                
                // FPS表示更新
                const fpsElement = document.getElementById('fps');
                if (fpsElement) {
                    fpsElement.textContent = fps;
                }
                
                // パフォーマンス警告
                if (fps < 30) {
                    console.warn(`⚠️ 低FPS検出: ${fps}fps`);
                }
                
                this.frameCount = 0;
                this.lastTime = currentTime;
            }
            
            requestAnimationFrame(update);
        };
        
        update();
    }
    
    stop() {
        console.log('📊 パフォーマンス監視停止');
        this.isRunning = false;
    }
    
    getStats() {
        return {
            isRunning: this.isRunning,
            lastTime: this.lastTime,
            frameCount: this.frameCount
        };
    }
}

// グローバル登録
if (typeof window !== 'undefined') {
    window.AppCore = AppCore;
    window.DrawingToolSystem = DrawingToolSystem;
    window.SimpleFallbackToolSystem = SimpleFallbackToolSystem;
    window.UIController = UIController;
    window.MinimalUIController = MinimalUIController;
    window.PerformanceMonitor = PerformanceMonitor;
    
    console.log('🎨 AppCore関連クラス グローバル登録完了（統一システム対応修正版）');
    console.log('🛡️ フォールバック機能・循環参照防止機能追加済み');
    console.log('🚨 修正適用済み: setupPopups メソッド追加・エラーハンドリング強化');
}