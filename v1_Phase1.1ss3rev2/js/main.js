/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 🎯 AI_WORK_SCOPE: アプリケーション初期化・統合エントリーポイント
 * 🔧 修正内容: screen未定義エラー対応・初期化安全性強化
 * 🚨 PURE_JAVASCRIPT: ES6モジュール禁止 - グローバル変数使用
 */

class FutabaDrawingTool {
    constructor() {
        this.version = 'v1.0-Phase1.1-ErrorFixed';
        this.isInitialized = false;
        this.startTime = performance.now();
        
        // 主要コンポーネント
        this.appCore = null;
        this.canvasManager = null;
        this.toolManager = null;
        this.uiManager = null;
        this.performanceMonitor = null;
        
        // 🔧 初期化状態管理強化
        this.pixiAppInitialized = false;
        this.safetyMode = false;
        
        console.log('✅ 基本描画システム設定完了（安全性強化版）');
    }
    
    /**
     * UI管理システム初期化
     */
    async initializeUIManager() {
        if (typeof window.UIController !== 'undefined') {
            try {
                this.uiManager = new window.UIController(this.toolManager);
                this.uiManager.init();
                console.log('✅ UIManager初期化完了');
            } catch (error) {
                console.warn('⚠️ UIManager初期化エラー - 基本UI使用:', error);
                this.setupBasicUI();
            }
        } else {
            console.warn('⚠️ UIManager未ロード - 基本UI使用');
            this.setupBasicUI();
        }
    }
    
    /**
     * 基本UI機能設定（フォールバック）
     */
    setupBasicUI() {
        this.uiManager = {
            activePopup: null,
            
            closeAllPopups: () => {
                try {
                    const popups = document.querySelectorAll('.popup-panel');
                    popups.forEach(popup => {
                        popup.style.display = 'none';
                    });
                    this.uiManager.activePopup = null;
                } catch (error) {
                    console.warn('⚠️ ポップアップ閉じるエラー:', error);
                }
            },
            
            showPopup: (popupId) => {
                try {
                    this.uiManager.closeAllPopups();
                    const popup = document.getElementById(popupId);
                    if (popup) {
                        popup.style.display = 'block';
                        this.uiManager.activePopup = popupId;
                    }
                } catch (error) {
                    console.warn('⚠️ ポップアップ表示エラー:', error);
                }
            }
        };
        
        this.setupToolButtons();
        this.setupPopupEvents();
    }
    
    /**
     * ツールボタン設定
     */
    setupToolButtons() {
        try {
            const penTool = document.getElementById('pen-tool');
            const eraserTool = document.getElementById('eraser-tool');
            
            if (penTool) {
                penTool.addEventListener('click', () => {
                    this.setActiveTool('pen', penTool);
                    this.uiManager.showPopup('pen-settings');
                });
            }
            
            if (eraserTool) {
                eraserTool.addEventListener('click', () => {
                    this.setActiveTool('eraser', eraserTool);
                    this.uiManager.closeAllPopups();
                });
            }
            
            const resizeTool = document.getElementById('resize-tool');
            if (resizeTool) {
                resizeTool.addEventListener('click', () => {
                    this.uiManager.showPopup('resize-settings');
                });
            }
        } catch (error) {
            console.warn('⚠️ ツールボタン設定エラー:', error);
        }
    }
    
    /**
     * アクティブツール設定
     */
    setActiveTool(tool, element) {
        try {
            document.querySelectorAll('.tool-button').forEach(btn => {
                btn.classList.remove('active');
            });
            
            if (element) {
                element.classList.add('active');
            }
            
            this.toolManager.setTool(tool);
            
            const toolNames = {
                pen: 'ベクターペン',
                eraser: '消しゴム'
            };
            const currentToolElement = document.getElementById('current-tool');
            if (currentToolElement) {
                currentToolElement.textContent = toolNames[tool] || tool;
            }
        } catch (error) {
            console.warn('⚠️ アクティブツール設定エラー:', error);
        }
    }
    
    /**
     * ポップアップイベント設定
     */
    setupPopupEvents() {
        try {
            const applyResize = document.getElementById('apply-resize');
            const applyResizeCenter = document.getElementById('apply-resize-center');
            
            if (applyResize) {
                applyResize.addEventListener('click', () => {
                    this.applyCanvasResize(false);
                });
            }
            
            if (applyResizeCenter) {
                applyResizeCenter.addEventListener('click', () => {
                    this.applyCanvasResize(true);
                });
            }
            
            const resizeButtons = document.querySelectorAll('.resize-button[data-size]');
            resizeButtons.forEach(button => {
                button.addEventListener('click', (e) => {
                    const [width, height] = e.target.getAttribute('data-size').split(',');
                    const widthInput = document.getElementById('canvas-width');
                    const heightInput = document.getElementById('canvas-height');
                    
                    if (widthInput) widthInput.value = width;
                    if (heightInput) heightInput.value = height;
                });
            });
        } catch (error) {
            console.warn('⚠️ ポップアップイベント設定エラー:', error);
        }
    }
    
    /**
     * イベントハンドリング設定
     * 🔧 修正: 安全なマウス座標取得・エラーハンドリング強化
     */
    setupEventHandlers() {
        try {
            const app = this.canvasManager.app;
            if (!app || !app.view) {
                console.warn('⚠️ キャンバスアプリケーション未初期化 - イベント設定スキップ');
                return;
            }
            
            const canvas = app.view;
            
            // マウスイベント（デスクトップ）
            canvas.addEventListener('mousedown', (event) => {
                try {
                    if (this.uiManager.activePopup) return;
                    
                    const point = this.canvasManager.getLocalPointerPosition(event);
                    console.log(`👆 マウスダウン: (${point.x}, ${point.y})`);
                    this.toolManager.startDrawing(point.x, point.y);
                } catch (error) {
                    console.warn('⚠️ マウスダウンイベントエラー:', error);
                }
            });
            
            canvas.addEventListener('mousemove', (event) => {
                try {
                    const point = this.canvasManager.getLocalPointerPosition(event);
                    
                    // 座標表示更新
                    this.updateCoordinateDisplay(point.x, point.y);
                    
                    // 筆圧モニター更新
                    if (this.toolManager.isDrawing) {
                        this.updatePressureMonitor();
                    }
                    
                    // 描画継続
                    if (!this.uiManager.activePopup) {
                        this.toolManager.continueDrawing(point.x, point.y);
                    }
                } catch (error) {
                    console.warn('⚠️ マウス移動イベントエラー:', error);
                }
            });
            
            canvas.addEventListener('mouseup', () => {
                try {
                    console.log('👆 マウスアップ');
                    this.toolManager.stopDrawing();
                    this.resetPressureMonitor();
                } catch (error) {
                    console.warn('⚠️ マウスアップイベントエラー:', error);
                }
            });
            
            canvas.addEventListener('mouseleave', () => {
                try {
                    console.log('👆 マウス離脱');
                    this.toolManager.stopDrawing();
                    this.resetPressureMonitor();
                } catch (error) {
                    console.warn('⚠️ マウス離脱イベントエラー:', error);
                }
            });
            
            // タッチイベント（モバイル）
            canvas.addEventListener('touchstart', (event) => {
                try {
                    event.preventDefault();
                    if (this.uiManager.activePopup) return;
                    
                    const touch = event.touches[0];
                    const point = this.canvasManager.getLocalPointerPosition(touch);
                    this.toolManager.startDrawing(point.x, point.y);
                } catch (error) {
                    console.warn('⚠️ タッチスタートイベントエラー:', error);
                }
            });
            
            canvas.addEventListener('touchmove', (event) => {
                try {
                    event.preventDefault();
                    const touch = event.touches[0];
                    const point = this.canvasManager.getLocalPointerPosition(touch);
                    
                    this.updateCoordinateDisplay(point.x, point.y);
                    
                    if (this.toolManager.isDrawing) {
                        this.updatePressureMonitor();
                    }
                    
                    if (!this.uiManager.activePopup) {
                        this.toolManager.continueDrawing(point.x, point.y);
                    }
                } catch (error) {
                    console.warn('⚠️ タッチ移動イベントエラー:', error);
                }
            });
            
            canvas.addEventListener('touchend', (event) => {
                try {
                    event.preventDefault();
                    this.toolManager.stopDrawing();
                    this.resetPressureMonitor();
                } catch (error) {
                    console.warn('⚠️ タッチエンドイベントエラー:', error);
                }
            });
            
            console.log('✅ イベントハンドリング設定完了（安全性強化版）');
            
        } catch (error) {
            console.error('❌ イベントハンドリング設定エラー:', error);
        }
    }
    
    /**
     * キャンバスリサイズ適用
     */
    applyCanvasResize(centerContent) {
        try {
            const widthInput = document.getElementById('canvas-width');
            const heightInput = document.getElementById('canvas-height');
            
            if (!widthInput || !heightInput) {
                console.warn('⚠️ リサイズ入力要素が見つかりません');
                return;
            }
            
            const width = parseInt(widthInput.value);
            const height = parseInt(heightInput.value);
            
            if (width && height && width > 0 && height > 0) {
                this.canvasManager.resize(width, height, centerContent);
                this.updateCanvasInfo();
                this.uiManager.closeAllPopups();
                console.log(`✅ キャンバスリサイズ: ${width}×${height}px (中央寄せ: ${centerContent})`);
            }
        } catch (error) {
            console.warn('⚠️ キャンバスリサイズエラー:', error);
        }
    }
    
    /**
     * パフォーマンス監視開始
     */
    startPerformanceMonitoring() {
        this.performanceMonitor = {
            frameCount: 0,
            lastTime: performance.now()
        };
        
        const updatePerformance = () => {
            this.performanceMonitor.frameCount++;
            const currentTime = performance.now();
            
            if (currentTime - this.performanceMonitor.lastTime >= 1000) {
                const fps = Math.round((this.performanceMonitor.frameCount * 1000) / 
                    (currentTime - this.performanceMonitor.lastTime));
                
                const fpsElement = document.getElementById('fps');
                if (fpsElement) {
                    fpsElement.textContent = fps;
                }
                
                this.performanceMonitor.frameCount = 0;
                this.performanceMonitor.lastTime = currentTime;
            }
            
            requestAnimationFrame(updatePerformance);
        };
        
        updatePerformance();
        console.log('✅ パフォーマンス監視開始');
    }
    
    /**
     * 初期状態設定（🔧 安全性確認付き）
     */
    setupInitialStateSafely() {
        try {
            this.setActiveTool('pen', document.getElementById('pen-tool'));
            this.updateCanvasInfo();
            
            const currentColor = document.getElementById('current-color');
            if (currentColor) {
                currentColor.textContent = '#800000';
            }
            
            console.log('✅ 初期状態設定完了');
        } catch (error) {
            console.warn('⚠️ 初期状態設定エラー:', error);
        }
    }
    
    /**
     * 座標表示更新
     */
    updateCoordinateDisplay(x, y) {
        try {
            const coordinatesElement = document.getElementById('coordinates');
            if (coordinatesElement) {
                coordinatesElement.textContent = `x: ${Math.round(x)}, y: ${Math.round(y)}`;
            }
        } catch (error) {
            // 座標表示は非クリティカル - サイレントに処理
        }
    }
    
    /**
     * 筆圧モニター更新
     */
    updatePressureMonitor() {
        try {
            const pressure = Math.min(100, 
                this.toolManager.globalSettings.pressure * 100 + Math.random() * 20);
            const pressureElement = document.getElementById('pressure-monitor');
            if (pressureElement) {
                pressureElement.textContent = pressure.toFixed(1) + '%';
            }
        } catch (error) {
            // 筆圧表示は非クリティカル - サイレントに処理
        }
    }
    
    /**
     * 筆圧モニターリセット
     */
    resetPressureMonitor() {
        try {
            const pressureElement = document.getElementById('pressure-monitor');
            if (pressureElement) {
                pressureElement.textContent = '0.0%';
            }
        } catch (error) {
            // 筆圧表示は非クリティカル - サイレントに処理
        }
    }
    
    /**
     * キャンバス情報更新（🔧 安全性強化版）
     */
    updateCanvasInfo() {
        try {
            const state = this.canvasManager.getCanvasState();
            const canvasInfo = document.getElementById('canvas-info');
            if (canvasInfo && state) {
                canvasInfo.textContent = `${state.width}×${state.height}px`;
            }
        } catch (error) {
            console.warn('⚠️ キャンバス情報更新エラー:', error);
        }
    }
    
    /**
     * 初期化エラーハンドリング（🔧 新規追加）
     */
    handleInitializationError(error) {
        console.error('💥 致命的初期化エラー:', error);
        
        // エラー表示UI作成
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #800000;
            color: white;
            padding: 32px;
            border-radius: 16px;
            box-shadow: 0 8px 32px rgba(128, 0, 0, 0.5);
            z-index: 10000;
            max-width: 500px;
            font-family: 'system-ui', sans-serif;
            text-align: center;
        `;
        
        errorDiv.innerHTML = `
            <h2 style="margin-bottom: 16px;">🎨 初期化エラー</h2>
            <p style="margin-bottom: 16px;">アプリケーションの初期化に失敗しました。</p>
            <p style="font-family: monospace; font-size: 12px; color: #ffcccb; margin-bottom: 24px;">
                ${error.message || error}
            </p>
            <div style="display: flex; gap: 8px; justify-content: center;">
                <button onclick="location.reload()" 
                        style="background: rgba(255,255,255,0.2); border: 1px solid white; color: white; padding: 8px 16px; border-radius: 8px; cursor: pointer;">
                    再読み込み
                </button>
                <button onclick="this.parentNode.parentNode.remove()" 
                        style="background: transparent; border: 1px solid white; color: white; padding: 8px 16px; border-radius: 8px; cursor: pointer;">
                    閉じる
                </button>
            </div>
        `;
        
        document.body.appendChild(errorDiv);
    }
    
    /**
     * アプリケーション状態取得
     */
    getAppState() {
        return {
            version: this.version,
            isInitialized: this.isInitialized,
            safetyMode: this.safetyMode,
            pixiAppInitialized: this.pixiAppInitialized,
            canvasState: this.canvasManager?.getCanvasState(),
            toolState: this.toolManager?.getDrawingState(),
            performanceInfo: this.pixiApp ? {
                fps: this.performanceMonitor?.frameCount || 0,
                width: this.pixiApp.screen?.width || 400,
                height: this.pixiApp.screen?.height || 400
            } : null
        };
    }
    
    /**
     * デバッグ情報出力（🔧 新規追加）
     */
    debugInfo() {
        const state = this.getAppState();
        console.group('🎨 FutabaDrawingTool デバッグ情報（エラー修正版）');
        console.log('📊 アプリケーション状態:', state);
        console.log('🔧 PixiJS状態:', {
            defined: typeof PIXI !== 'undefined',
            version: PIXI?.VERSION || 'undefined',
            app: !!this.pixiApp,
            screen: !!this.pixiApp?.screen,
            view: !!this.pixiApp?.view
        });
        console.log('🛡️ 安全機能:', {
            safetyMode: this.safetyMode,
            pixiAppInitialized: this.pixiAppInitialized,
            errorHandling: true
        });
        console.groupEnd();
        
        return state;
    }
}

/**
 * アプリケーション起動（🔧 エラーハンドリング強化版）
 */
window.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0');
        console.log('📋 Phase1.1: エラー修正版（screen未定義対応）');
        console.log('🚀 起動開始...');
        
        // 🔧 ライブラリ確認
        console.log('🔍 重要ライブラリ確認:');
        console.log('  PIXI:', typeof PIXI !== 'undefined' ? '✅' : '❌');
        console.log('  PixiExtensions:', typeof window.PixiExtensions !== 'undefined' ? '✅' : '❌');
        console.log('  AppCore:', typeof window.AppCore !== 'undefined' ? '✅' : '❌');
        
        window.futabaDrawingTool = new FutabaDrawingTool();
        await window.futabaDrawingTool.init();
        
        console.log('🎉 アプリケーション起動完了！');
        console.log('💡 デバッグ情報: window.futabaDrawingTool.debugInfo()');
        
    } catch (error) {
        console.error('❌ アプリケーション起動失敗:', error);
        
        // 🔧 簡易フォールバック表示
        document.body.innerHTML = `
            <div style="display:flex;justify-content:center;align-items:center;height:100vh;background:#ffffee;font-family:system-ui;">
                <div style="text-align:center;color:#800000;background:#f0e0d6;padding:40px;border:2px solid #aa5a56;border-radius:16px;max-width:600px;">
                    <h2>🎨 ふたば☆ちゃんねる風お絵描きツール</h2>
                    <p style="margin: 16px 0;">申し訳ございませんが、アプリケーションの起動に失敗しました。</p>
                    <details style="margin: 16px 0; text-align: left;">
                        <summary style="cursor: pointer; color: #666;">エラー詳細</summary>
                        <pre style="font-family:monospace;font-size:12px;color:#666;margin:8px 0;background:#fff;padding:8px;border-radius:4px;overflow:auto;">${error.stack || error.message || error}</pre>
                    </details>
                    <div style="display: flex; gap: 8px; justify-content: center; margin-top: 24px;">
                        <button onclick="location.reload()" 
                                style="background:#800000;color:white;border:none;padding:12px 24px;border-radius:8px;cursor:pointer;font-weight:600;">
                            再読み込み
                        </button>
                        <button onclick="console.log('Error Details:', ${JSON.stringify(error.message)})" 
                                style="background:transparent;color:#800000;border:2px solid #800000;padding:10px 22px;border-radius:8px;cursor:pointer;font-weight:600;">
                            コンソール確認
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
});🎨 アプリケーション初期化 Phase1版（エラー修正版）');
    }
    
    /**
     * アプリケーション初期化（🔧 安全性強化版）
     */
    async init() {
        try {
            console.log('🔧 Phase1.1 分割構造での初期化開始（エラー修正版）');
            
            // Step 1: 拡張ライブラリ初期化（エラートレラント）
            await this.initializeExtensionsSafely();
            
            // Step 2: AppCore初期化（エラートレラント）
            await this.initializeAppCoreSafely();
            
            // Step 3: キャンバス管理システム初期化（安全性強化）
            await this.initializeCanvasManagerSafely();
            
            // Step 4: ツール管理システム初期化
            await this.initializeToolManager();
            
            // Step 5: UI管理システム初期化
            await this.initializeUIManager();
            
            // Step 6: イベントハンドリング設定
            this.setupEventHandlers();
            
            // Step 7: パフォーマンス監視開始
            this.startPerformanceMonitoring();
            
            // Step 8: 初期状態設定（安全性確認付き）
            this.setupInitialStateSafely();
            
            this.isInitialized = true;
            const initTime = performance.now() - this.startTime;
            
            console.log('✅ Phase1.1 初期化完了（エラー修正版）！');
            console.log(`⏱️ 初期化時間: ${initTime.toFixed(2)}ms`);
            console.log(`🛡️ セーフティモード: ${this.safetyMode ? '有効' : '無効'}`);
            
        } catch (error) {
            console.error('❌ 初期化失敗:', error);
            this.handleInitializationError(error);
            throw error;
        }
    }
    
    /**
     * 拡張ライブラリ初期化（🔧 エラートレラント版）
     */
    async initializeExtensionsSafely() {
        try {
            if (typeof window.PixiExtensions !== 'undefined') {
                await window.PixiExtensions.initialize();
                console.log('✅ PixiExtensions初期化完了');
            } else {
                console.warn('⚠️ PixiExtensions未ロード - 基本機能のみ使用');
                this.safetyMode = true;
            }
        } catch (error) {
            console.warn('⚠️ PixiExtensions初期化エラー - 基本機能で継続:', error);
            this.safetyMode = true;
        }
    }
    
    /**
     * AppCore初期化（🔧 エラートレラント版）
     */
    async initializeAppCoreSafely() {
        try {
            if (typeof window.AppCore !== 'undefined') {
                this.appCore = new window.AppCore();
                await this.appCore.init();
                console.log('✅ AppCore初期化完了');
            } else {
                console.warn('⚠️ AppCore未ロード - 直接初期化');
                await this.initializePixiSafely();
            }
        } catch (error) {
            console.warn('⚠️ AppCore初期化エラー - 直接初期化で継続:', error);
            await this.initializePixiSafely();
        }
    }
    
    /**
     * PixiJS直接初期化（🔧 安全性強化版）
     */
    async initializePixiSafely() {
        const canvasContainer = document.getElementById('drawing-canvas');
        if (!canvasContainer) {
            throw new Error('キャンバスコンテナが見つかりません');
        }
        
        try {
            // 🔧 PixiJS存在確認
            if (typeof PIXI === 'undefined') {
                throw new Error('PIXI ライブラリが読み込まれていません');
            }
            
            // PixiJS Application作成
            console.log('🔧 PixiJS Application作成中...');
            this.pixiApp = new PIXI.Application({
                width: 400,
                height: 400,
                backgroundColor: 0xf0e0d6, // ふたば風背景色
                antialias: true,
                resolution: window.devicePixelRatio || 1,
                autoDensity: true
            });
            
            // 🔧 重要: 初期化完了を待つ
            if (this.pixiApp.loader && this.pixiApp.loader.loading) {
                await new Promise(resolve => this.pixiApp.loader.onComplete.add(resolve));
            }
            
            // 🔧 screen プロパティ確認
            if (!this.pixiApp.screen) {
                console.warn('⚠️ PIXI screen プロパティが未初期化 - フォールバック作成');
                // フォールバック screen オブジェクト作成
                this.pixiApp.screen = {
                    width: 400,
                    height: 400,
                    x: 0,
                    y: 0
                };
            }
            
            // キャンバス追加
            canvasContainer.appendChild(this.pixiApp.view);
            
            // インタラクティブ設定
            this.pixiApp.stage.interactive = true;
            this.pixiApp.stage.hitArea = new PIXI.Rectangle(0, 0, 400, 400);
            
            this.pixiAppInitialized = true;
            console.log('✅ PixiJS安全初期化完了');
            console.log('📊 PixiJS状態:', {
                width: this.pixiApp.screen.width,
                height: this.pixiApp.screen.height,
                view: !!this.pixiApp.view,
                stage: !!this.pixiApp.stage
            });
            
        } catch (error) {
            console.error('❌ PixiJS初期化エラー:', error);
            // 🔧 完全フォールバック: Canvas要素作成
            await this.createFallbackCanvas(canvasContainer);
        }
    }
    
    /**
     * フォールバック Canvas作成（🔧 緊急対応）
     */
    async createFallbackCanvas(container) {
        console.warn('🆘 PixiJS初期化失敗 - Canvas フォールバック作成中...');
        
        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 400;
        canvas.style.backgroundColor = '#f0e0d6';
        canvas.style.border = '2px solid #aa5a56';
        canvas.style.borderRadius = '8px';
        
        container.appendChild(canvas);
        
        // 簡易PixiApp代替オブジェクト
        this.pixiApp = {
            view: canvas,
            screen: { width: 400, height: 400, x: 0, y: 0 },
            stage: { 
                interactive: true,
                hitArea: { x: 0, y: 0, width: 400, height: 400 },
                addChild: () => console.warn('⚠️ フォールバックモード: addChild無効'),
                removeChild: () => console.warn('⚠️ フォールバックモード: removeChild無効')
            }
        };
        
        this.safetyMode = true;
        this.pixiAppInitialized = true;
        console.log('✅ Canvas フォールバック作成完了');
    }
    
    /**
     * キャンバス管理システム初期化（🔧 安全性強化版）
     */
    async initializeCanvasManagerSafely() {
        if (typeof window.CanvasManager !== 'undefined') {
            try {
                this.canvasManager = new window.CanvasManager();
                await this.canvasManager.init('drawing-canvas');
                console.log('✅ CanvasManager初期化完了');
            } catch (error) {
                console.warn('⚠️ CanvasManager初期化エラー - 基本管理使用:', error);
                this.createSafeCanvasManager();
            }
        } else {
            console.warn('⚠️ CanvasManager未ロード - 基本管理使用');
            this.createSafeCanvasManager();
        }
    }
    
    /**
     * 安全なキャンバス管理システム作成（🔧 エラー対応版）
     */
    createSafeCanvasManager() {
        this.canvasManager = {
            app: this.pixiApp,
            
            // 🔧 修正: 安全なポインター座標取得
            getLocalPointerPosition: (event) => {
                try {
                    if (!this.pixiApp || !this.pixiApp.view) {
                        console.warn('⚠️ PixiApp未初期化 - デフォルト座標返却');
                        return { x: 0, y: 0 };
                    }
                    
                    const rect = this.pixiApp.view.getBoundingClientRect();
                    const scaleX = this.pixiApp.view.width / rect.width;
                    const scaleY = this.pixiApp.view.height / rect.height;
                    
                    const clientX = event.clientX || event.touches?.[0]?.clientX || 0;
                    const clientY = event.clientY || event.touches?.[0]?.clientY || 0;
                    
                    return {
                        x: (clientX - rect.left) * scaleX,
                        y: (clientY - rect.top) * scaleY
                    };
                } catch (error) {
                    console.warn('⚠️ 座標取得エラー:', error);
                    return { x: 0, y: 0 };
                }
            },
            
            // 🔧 修正: 安全なキャンバス状態取得
            getCanvasState: () => {
                try {
                    if (!this.pixiApp || !this.pixiApp.screen) {
                        console.warn('⚠️ PixiJS未初期化 - デフォルト値使用');
                        return { width: 400, height: 400 };
                    }
                    return {
                        width: this.pixiApp.screen.width || 400,
                        height: this.pixiApp.screen.height || 400
                    };
                } catch (error) {
                    console.warn('⚠️ キャンバス状態取得エラー:', error);
                    return { width: 400, height: 400 };
                }
            },
            
            // 🔧 修正: 安全なリサイズ処理
            resize: (width, height, center) => {
                try {
                    if (!this.pixiApp) {
                        console.warn('⚠️ PixiJS未初期化 - リサイズスキップ');
                        return;
                    }
                    
                    if (this.pixiApp.renderer && this.pixiApp.renderer.resize) {
                        this.pixiApp.renderer.resize(width, height);
                    }
                    
                    if (this.pixiApp.stage && this.pixiApp.stage.hitArea) {
                        this.pixiApp.stage.hitArea = new PIXI.Rectangle(0, 0, width, height);
                    }
                    
                    // screen更新
                    if (this.pixiApp.screen) {
                        this.pixiApp.screen.width = width;
                        this.pixiApp.screen.height = height;
                    }
                    
                } catch (error) {
                    console.warn('⚠️ リサイズエラー:', error);
                }
            }
        };
        
        console.log('✅ 安全なキャンバス管理システム作成完了');
    }
    
    /**
     * ツール管理システム初期化
     */
    async initializeToolManager() {
        if (typeof window.ToolManager !== 'undefined') {
            try {
                this.toolManager = new window.ToolManager();
                this.toolManager.init(this.canvasManager);
                
                // 個別ツール初期化
                if (typeof window.PenTool !== 'undefined') {
                    const penTool = new window.PenTool(this.toolManager);
                    penTool.init();
                }
                
                if (typeof window.EraserTool !== 'undefined') {
                    const eraserTool = new window.EraserTool(this.toolManager);
                    eraserTool.init();
                }
                
                console.log('✅ ToolManager初期化完了');
            } catch (error) {
                console.warn('⚠️ ToolManager初期化エラー - 基本描画使用:', error);
                this.setupBasicDrawing();
            }
        } else {
            console.warn('⚠️ ToolManager未ロード - 基本描画使用');
            this.setupBasicDrawing();
        }
    }
    
    /**
     * 基本描画機能設定（フォールバック）
     * 🔧 修正: 安全性強化・エラーハンドリング追加
     */
    setupBasicDrawing() {
        this.toolManager = {
            currentTool: 'pen',
            isDrawing: false,
            globalSettings: {
                size: 16,
                opacity: 0.85,
                pressure: 0.5,
                color: 0x800000 // ふたば風赤色 #800000
            },
            currentPath: null,
            lastPoint: null,
            
            setTool: (tool) => {
                this.toolManager.currentTool = tool;
                console.log(`🔧 ツール切り替え: ${tool}`);
            },
            
            startDrawing: (x, y) => {
                try {
                    console.log(`🖊️ 描画開始: (${x}, ${y})`);
                    this.toolManager.isDrawing = true;
                    this.toolManager.lastPoint = { x, y };
                    
                    // 🔧 SafetyMode確認
                    if (this.safetyMode) {
                        console.warn('⚠️ セーフティモード: 描画機能制限');
                        return;
                    }
                    
                    // PixiJS Graphics使用可能か確認
                    if (!PIXI || !PIXI.Graphics) {
                        console.warn('⚠️ PIXI.Graphics未利用 - Canvas描画に切り替え');
                        return;
                    }
                    
                    // グラフィックオブジェクト作成
                    const graphics = new PIXI.Graphics();
                    graphics.lineStyle({
                        width: this.toolManager.globalSettings.size,
                        color: this.toolManager.globalSettings.color,
                        alpha: this.toolManager.globalSettings.opacity,
                        cap: PIXI.LINE_CAP.ROUND,
                        join: PIXI.LINE_JOIN.ROUND
                    });
                    
                    // 開始点に移動
                    graphics.moveTo(x, y);
                    
                    this.toolManager.currentPath = graphics;
                    
                    // ステージに追加
                    if (this.canvasManager.app && this.canvasManager.app.stage) {
                        this.canvasManager.app.stage.addChild(graphics);
                    }
                    
                } catch (error) {
                    console.warn('⚠️ 描画開始エラー:', error);
                    this.toolManager.isDrawing = false;
                }
            },
            
            continueDrawing: (x, y) => {
                try {
                    if (this.toolManager.isDrawing && 
                        this.toolManager.currentPath && 
                        this.toolManager.lastPoint) {
                        
                        if (this.safetyMode) return;
                        
                        // 前回の点から現在の点へ線を引く
                        this.toolManager.currentPath.lineTo(x, y);
                        this.toolManager.lastPoint = { x, y };
                    }
                } catch (error) {
                    console.warn('⚠️ 描画継続エラー:', error);
                }
            },
            
            stopDrawing: () => {
                console.log('🖊️ 描画終了');
                this.toolManager.isDrawing = false;
                this.toolManager.currentPath = null;
                this.toolManager.lastPoint = null;
            },
            
            getDrawingState: () => ({
                tool: this.toolManager.currentTool,
                isDrawing: this.toolManager.isDrawing,
                safetyMode: this.safetyMode
            })
        };
        
        console.log('