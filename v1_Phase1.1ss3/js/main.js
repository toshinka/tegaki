/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 🎯 AI_WORK_SCOPE: アプリケーション初期化・統合エントリーポイント
 * 🎯 DEPENDENCIES: js/app-core.js, js/managers/*
 * 🎯 NODE_MODULES: pixi.js@^7.4.3（CDN経由）
 * 🎯 PIXI_EXTENSIONS: 基本機能のみ
 * 🎯 ISOLATION_TEST: ❌ 全体統括のため
 * 🎯 SPLIT_THRESHOLD: 150行（超過時分割検討）
 * 📋 PHASE_TARGET: Phase1
 * 📋 V8_MIGRATION: Application.init() 対応予定
 * 🚨 PURE_JAVASCRIPT: ES6モジュール禁止 - グローバル変数使用
 */

/**
 * メインアプリケーションクラス
 * 元HTMLのFutabaDrawingToolを分割構造で再実装
 * DRY原則: 共通初期化処理の統合
 * SOLID原則: 単一責任 - アプリケーション統括のみ
 */
class FutabaDrawingTool {
    constructor() {
        this.version = 'v1.0-Phase1.1';
        this.isInitialized = false;
        this.startTime = performance.now();
        
        // 主要コンポーネント
        this.appCore = null;
        this.canvasManager = null;
        this.toolManager = null;
        this.uiManager = null;
        this.performanceMonitor = null;
        
        console.log('🎨 アプリケーション初期化 Phase1版');
    }
    
    /**
     * アプリケーション初期化
     * 元HTMLのinitメソッドを分割構造で再実装
     */
    async init() {
        try {
            console.log('🔧 Phase1.1 分割構造での初期化開始');
            
            // Step 1: 拡張ライブラリ初期化
            await this.initializeExtensions();
            
            // Step 2: AppCore初期化
            await this.initializeAppCore();
            
            // Step 3: キャンバス管理システム初期化  
            await this.initializeCanvasManager();
            
            // Step 4: ツール管理システム初期化
            await this.initializeToolManager();
            
            // Step 5: UI管理システム初期化
            await this.initializeUIManager();
            
            // Step 6: イベントハンドリング設定
            this.setupEventHandlers();
            
            // Step 7: パフォーマンス監視開始
            this.startPerformanceMonitoring();
            
            // Step 8: 初期状態設定
            this.setupInitialState();
            
            this.isInitialized = true;
            const initTime = performance.now() - this.startTime;
            
            console.log('✅ Phase1.1 初期化完了！');
            console.log(`⏱️ 初期化時間: ${initTime.toFixed(2)}ms`);
            
        } catch (error) {
            console.error('❌ 初期化失敗:', error);
            this.showErrorMessage(error);
            throw error;
        }
    }
    
    /**
     * 拡張ライブラリ初期化
     * pixi-extensions.js の機能を統合
     */
    async initializeExtensions() {
        if (typeof window.PIXIExtensions !== 'undefined') {
            const extensions = new window.PIXIExtensions();
            await extensions.initialize();
            
            // 互換性チェック
            const issues = extensions.checkCompatibility();
            if (issues.length > 0) {
                console.warn('⚠️ 互換性の問題:', issues);
            }
        } else {
            console.warn('⚠️ PIXIExtensions未ロード - 基本機能のみ使用');
        }
    }
    
    /**
     * AppCore初期化
     */
    async initializeAppCore() {
        if (typeof window.AppCore !== 'undefined') {
            this.appCore = new window.AppCore();
            await this.appCore.init();
            console.log('✅ AppCore初期化完了');
        } else {
            // フォールバック: 直接PixiJS初期化
            console.warn('⚠️ AppCore未ロード - 直接初期化');
            await this.initializePixiDirectly();
        }
    }
    
    /**
     * 直接PixiJS初期化（フォールバック）
     */
    async initializePixiDirectly() {
        const canvasContainer = document.getElementById('drawing-canvas');
        if (!canvasContainer) {
            throw new Error('キャンバスコンテナが見つかりません');
        }
        
        // PixiJS Application作成
        this.pixiApp = new PIXI.Application({
            width: 400,
            height: 400,
            backgroundColor: 0xffffff,
            antialias: true,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true
        });
        
        // キャンバス追加
        canvasContainer.appendChild(this.pixiApp.view);
        
        // インタラクティブ設定
        this.pixiApp.stage.interactive = true;
        this.pixiApp.stage.hitArea = new PIXI.Rectangle(0, 0, 400, 400);
        
        console.log('✅ PixiJS直接初期化完了');
    }
    
    /**
     * キャンバス管理システム初期化
     */
    async initializeCanvasManager() {
        if (typeof window.CanvasManager !== 'undefined') {
            this.canvasManager = new window.CanvasManager();
            await this.canvasManager.init('drawing-canvas');
            console.log('✅ CanvasManager初期化完了');
        } else {
            // フォールバック: 基本キャンバス管理
            console.warn('⚠️ CanvasManager未ロード - 基本管理使用');
            this.canvasManager = {
                app: this.pixiApp,
                getLocalPointerPosition: (event) => {
                    return event.data.global;
                },
                getCanvasState: () => ({
                    width: this.pixiApp.screen.width,
                    height: this.pixiApp.screen.height
                }),
                resize: (width, height, center) => {
                    this.pixiApp.renderer.resize(width, height);
                    this.pixiApp.stage.hitArea = new PIXI.Rectangle(0, 0, width, height);
                }
            };
        }
    }
    
    /**
     * ツール管理システム初期化
     */
    async initializeToolManager() {
        if (typeof window.ToolManager !== 'undefined') {
            this.toolManager = new window.ToolManager();
            this.toolManager.init(this.canvasManager);
            
            // 個別ツール登録
            if (typeof window.PenTool !== 'undefined') {
                const penTool = new window.PenTool(this.toolManager);
                penTool.init();
            }
            
            if (typeof window.EraserTool !== 'undefined') {
                const eraserTool = new window.EraserTool(this.toolManager);
                eraserTool.init();
            }
            
            console.log('✅ ToolManager初期化完了');
        } else {
            // フォールバック: 基本描画機能
            console.warn('⚠️ ToolManager未ロード - 基本描画使用');
            this.setupBasicDrawing();
        }
    }
    
    /**
     * 基本描画機能設定（フォールバック）
     */
    setupBasicDrawing() {
        this.toolManager = {
            currentTool: 'pen',
            isDrawing: false,
            globalSettings: {
                size: 16,
                opacity: 0.85,
                pressure: 0.5,
                color: 0x800000
            },
            currentPath: null,
            
            setTool: (tool) => {
                this.toolManager.currentTool = tool;
            },
            
            startDrawing: (x, y) => {
                this.toolManager.isDrawing = true;
                const graphics = new PIXI.Graphics();
                graphics.lineStyle({
                    width: this.toolManager.globalSettings.size,
                    color: this.toolManager.globalSettings.color,
                    alpha: this.toolManager.globalSettings.opacity
                });
                graphics.moveTo(x, y);
                this.toolManager.currentPath = graphics;
                this.canvasManager.app.stage.addChild(graphics);
            },
            
            continueDrawing: (x, y) => {
                if (this.toolManager.isDrawing && this.toolManager.currentPath) {
                    this.toolManager.currentPath.lineTo(x, y);
                }
            },
            
            stopDrawing: () => {
                this.toolManager.isDrawing = false;
                this.toolManager.currentPath = null;
            },
            
            getDrawingState: () => ({
                tool: this.toolManager.currentTool,
                isDrawing: this.toolManager.isDrawing
            })
        };
    }
    
    /**
     * UI管理システム初期化
     */
    async initializeUIManager() {
        if (typeof window.UIController !== 'undefined') {
            this.uiManager = new window.UIController(this.toolManager);
            this.uiManager.init();
            console.log('✅ UIManager初期化完了');
        } else {
            // フォールバック: 基本UI機能
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
                const popups = document.querySelectorAll('.popup-panel');
                popups.forEach(popup => {
                    popup.style.display = 'none';
                });
                this.uiManager.activePopup = null;
            },
            
            showPopup: (popupId) => {
                this.uiManager.closeAllPopups();
                const popup = document.getElementById(popupId);
                if (popup) {
                    popup.style.display = 'block';
                    this.uiManager.activePopup = popupId;
                }
            }
        };
        
        // ツールボタンイベント設定
        this.setupToolButtons();
        
        // ポップアップイベント設定
        this.setupPopupEvents();
    }
    
    /**
     * ツールボタン設定
     */
    setupToolButtons() {
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
        
        // リサイズツール
        const resizeTool = document.getElementById('resize-tool');
        if (resizeTool) {
            resizeTool.addEventListener('click', () => {
                this.uiManager.showPopup('resize-settings');
            });
        }
    }
    
    /**
     * アクティブツール設定
     */
    setActiveTool(tool, element) {
        // 全ツールボタンの active クラス削除
        document.querySelectorAll('.tool-button').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // 選択ツールに active クラス追加
        if (element) {
            element.classList.add('active');
        }
        
        // ツール設定
        this.toolManager.setTool(tool);
        
        // ツール名表示更新
        const toolNames = {
            pen: 'ベクターペン',
            eraser: '消しゴム'
        };
        document.getElementById('current-tool').textContent = toolNames[tool] || tool;
    }
    
    /**
     * ポップアップイベント設定
     */
    setupPopupEvents() {
        // リサイズ適用ボタン
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
        
        // リサイズプリセット
        const resizeButtons = document.querySelectorAll('.resize-button[data-size]');
        resizeButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const [width, height] = e.target.getAttribute('data-size').split(',');
                document.getElementById('canvas-width').value = width;
                document.getElementById('canvas-height').value = height;
            });
        });
    }
    
    /**
     * イベントハンドリング設定
     * 元HTMLのsetupCanvasEventsを統合
     */
    setupEventHandlers() {
        const app = this.canvasManager.app;
        if (!app) {
            console.warn('⚠️ キャンバスアプリケーション未初期化');
            return;
        }
        
        // PointerDown: 描画開始
        app.stage.on('pointerdown', (event) => {
            if (this.uiManager.activePopup) return; // ポップアップ表示中は無視
            
            const point = this.canvasManager.getLocalPointerPosition(event);
            this.toolManager.startDrawing(point.x, point.y);
        });
        
        // PointerMove: 描画継続・座標更新
        app.stage.on('pointermove', (event) => {
            const point = this.canvasManager.getLocalPointerPosition(event);
            
            // 座標表示更新（元HTML機能維持）
            this.updateCoordinateDisplay(point.x, point.y);
            
            // 筆圧モニター更新
            if (this.toolManager.isDrawing) {
                this.updatePressureMonitor();
            }
            
            // 描画継続
            if (!this.uiManager.activePopup) {
                this.toolManager.continueDrawing(point.x, point.y);
            }
        });
        
        // PointerUp: 描画終了
        app.stage.on('pointerup', () => {
            this.toolManager.stopDrawing();
            this.resetPressureMonitor();
        });
        
        // PointerUpOutside: キャンバス外での描画終了
        app.stage.on('pointerupoutside', () => {
            this.toolManager.stopDrawing();
            this.resetPressureMonitor();
        });
        
        console.log('✅ イベントハンドリング設定完了');
    }
    
    /**
     * キャンバスリサイズ適用（元HTML機能）
     * @param {boolean} centerContent - 中央寄せフラグ
     */
    applyCanvasResize(centerContent) {
        const width = parseInt(document.getElementById('canvas-width').value);
        const height = parseInt(document.getElementById('canvas-height').value);
        
        if (width && height && width > 0 && height > 0) {
            this.canvasManager.resize(width, height, centerContent);
            this.updateCanvasInfo();
            this.uiManager.closeAllPopups();
            console.log(`✅ キャンバスリサイズ: ${width}×${height}px (中央寄せ: ${centerContent})`);
        }
    }
    
    /**
     * パフォーマンス監視開始（元HTML機能統合）
     */
    startPerformanceMonitoring() {
        // 元HTMLのPerformanceMonitorクラス機能を統合
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
     * 初期状態設定（元HTML機能維持）
     */
    setupInitialState() {
        // 初期ツール設定
        this.setActiveTool('pen', document.getElementById('pen-tool'));
        
        // 初期キャンバス情報更新
        this.updateCanvasInfo();
        
        // 初期色設定表示
        const currentColor = document.getElementById('current-color');
        if (currentColor) {
            currentColor.textContent = '#800000';
        }
    }
    
    /**
     * 座標表示更新（元HTML機能）
     * @param {number} x - X座標
     * @param {number} y - Y座標
     */
    updateCoordinateDisplay(x, y) {
        const coordinatesElement = document.getElementById('coordinates');
        if (coordinatesElement) {
            coordinatesElement.textContent = `x: ${Math.round(x)}, y: ${Math.round(y)}`;
        }
    }
    
    /**
     * 筆圧モニター更新（元HTML機能）
     */
    updatePressureMonitor() {
        const pressure = Math.min(100, 
            this.toolManager.globalSettings.pressure * 100 + Math.random() * 20);
        const pressureElement = document.getElementById('pressure-monitor');
        if (pressureElement) {
            pressureElement.textContent = pressure.toFixed(1) + '%';
        }
    }
    
    /**
     * 筆圧モニターリセット（元HTML機能）
     */
    resetPressureMonitor() {
        const pressureElement = document.getElementById('pressure-monitor');
        if (pressureElement) {
            pressureElement.textContent = '0.0%';
        }
    }
    
    /**
     * キャンバス情報更新（元HTML機能）
     */
    updateCanvasInfo() {
        const state = this.canvasManager.getCanvasState();
        const canvasInfo = document.getElementById('canvas-info');
        if (canvasInfo && state) {
            canvasInfo.textContent = `${state.width}×${state.height}px`;
        }
    }
    
    /**
     * エラーメッセージ表示
     * @param {Error} error - エラーオブジェクト
     */
    showErrorMessage(error) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #800000;
            color: white;
            padding: 16px;
            border-radius: 8px;
            box-shadow: 0 4px 16px rgba(128, 0, 0, 0.3);
            z-index: 9999;
            max-width: 400px;
            font-family: monospace;
            font-size: 12px;
        `;
        
        errorDiv.innerHTML = `
            <strong>エラーが発生しました:</strong><br>
            ${error.message || error}
            <br><br>
            <button onclick="this.parentNode.remove()" 
                    style="background:rgba(255,255,255,0.2);border:none;color:white;padding:4px 8px;border-radius:4px;cursor:pointer;">
                閉じる
            </button>
        `;
        
        document.body.appendChild(errorDiv);
        
        // 5秒後自動削除
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 5000);
    }
    
    /**
     * アプリケーション状態取得（デバッグ用）
     */
    getAppState() {
        return {
            version: this.version,
            isInitialized: this.isInitialized,
            canvasState: this.canvasManager?.getCanvasState(),
            toolState: this.toolManager?.getDrawingState(),
            performanceInfo: this.pixiApp ? {
                fps: this.performanceMonitor?.frameCount || 0,
                width: this.pixiApp.screen.width,
                height: this.pixiApp.screen.height
            } : null
        };
    }
}

/**
 * アプリケーション起動
 * 元HTMLのDOMContentLoadedイベント統合
 */
window.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0');
        console.log('📋 Phase1.1: 分割再構成版（Pure JavaScript）');
        console.log('🚀 起動開始...');
        
        // グローバル変数として保存（元HTML同様）
        window.futabaDrawingTool = new FutabaDrawingTool();
        await window.futabaDrawingTool.init();
        
        console.log('🎉 アプリケーション起動完了！');
        
    } catch (error) {
        console.error('❌ アプリケーション起動失敗:', error);
        
        // フォールバック表示（ふたば風デザイン維持）
        document.body.innerHTML = `
            <div style="display:flex;justify-content:center;align-items:center;height:100vh;background:#ffffee;">
                <div style="text-align:center;color:#800000;background:#f0e0d6;padding:32px;border:2px solid #aa5a56;border-radius:16px;">
                    <h2>🎨 ふたば☆ちゃんねる風お絵描きツール</h2>
                    <p>申し訳ございませんが、アプリケーションの初期化に失敗しました。</p>
                    <p style="font-family:monospace;font-size:12px;color:#666;margin:16px 0;">${error.message}</p>
                    <button onclick="location.reload()" 
                            style="background:#800000;color:white;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;">
                        再読み込み
                    </button>
                </div>
            </div>
        `;
    }
});