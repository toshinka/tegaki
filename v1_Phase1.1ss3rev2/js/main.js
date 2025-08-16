/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 🎯 AI_WORK_SCOPE: アプリケーション初期化・統合エントリーポイント
 * 🔧 修正内容: 座標変換・背景色・描画機能修正
 * 🚨 PURE_JAVASCRIPT: ES6モジュール禁止 - グローバル変数使用
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
     */
    async initializeExtensions() {
        if (typeof window.PIXIExtensions !== 'undefined') {
            const extensions = new window.PIXIExtensions();
            await extensions.initialize();
            
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
            console.warn('⚠️ AppCore未ロード - 直接初期化');
            await this.initializePixiDirectly();
        }
    }
    
    /**
     * 直接PixiJS初期化（フォールバック）
     * 🔧 修正: ふたば風背景色・座標系修正
     */
    async initializePixiDirectly() {
        const canvasContainer = document.getElementById('drawing-canvas');
        if (!canvasContainer) {
            throw new Error('キャンバスコンテナが見つかりません');
        }
        
        // PixiJS Application作成 - ふたば風背景色
        this.pixiApp = new PIXI.Application({
            width: 400,
            height: 400,
            backgroundColor: 0xf0e0d6, // ふたば風背景色 #f0e0d6
            antialias: true,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true
        });
        
        // キャンバス追加
        canvasContainer.appendChild(this.pixiApp.view);
        
        // インタラクティブ設定
        this.pixiApp.stage.interactive = true;
        this.pixiApp.stage.hitArea = new PIXI.Rectangle(0, 0, 400, 400);
        
        console.log('✅ PixiJS直接初期化完了（ふたば風背景色）');
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
            console.warn('⚠️ CanvasManager未ロード - 基本管理使用');
            this.canvasManager = {
                app: this.pixiApp,
                
                // 🔧 修正: 正しい座標変換
                getLocalPointerPosition: (event) => {
                    const rect = this.pixiApp.view.getBoundingClientRect();
                    const scaleX = this.pixiApp.view.width / rect.width;
                    const scaleY = this.pixiApp.view.height / rect.height;
                    
                    return {
                        x: (event.clientX - rect.left) * scaleX,
                        y: (event.clientY - rect.top) * scaleY
                    };
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
            console.warn('⚠️ ToolManager未ロード - 基本描画使用');
            this.setupBasicDrawing();
        }
    }
    
    /**
     * 基本描画機能設定（フォールバック）
     * 🔧 修正: 描画座標とスタイル修正
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
                console.log(`🖊️ 描画開始: (${x}, ${y})`);
                this.toolManager.isDrawing = true;
                this.toolManager.lastPoint = { x, y };
                
                // グラフィックオブジェクト作成
                const graphics = new PIXI.Graphics();
                graphics.lineStyle({
                    width: this.toolManager.globalSettings.size,
                    color: this.toolManager.globalSettings.color,
                    alpha: this.toolManager.globalSettings.opacity,
                    cap: PIXI.LINE_CAP.ROUND,
                    join: PIXI.LINE_JOIN.ROUND
                });
                
                // 開始点に移動（線は引かない）
                graphics.moveTo(x, y);
                
                this.toolManager.currentPath = graphics;
                this.canvasManager.app.stage.addChild(graphics);
            },
            
            continueDrawing: (x, y) => {
                if (this.toolManager.isDrawing && this.toolManager.currentPath && this.toolManager.lastPoint) {
                    // 前回の点から現在の点へ線を引く
                    this.toolManager.currentPath.lineTo(x, y);
                    this.toolManager.lastPoint = { x, y };
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
        
        this.setupToolButtons();
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
    }
    
    /**
     * ポップアップイベント設定
     */
    setupPopupEvents() {
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
                document.getElementById('canvas-width').value = width;
                document.getElementById('canvas-height').value = height;
            });
        });
    }
    
    /**
     * イベントハンドリング設定
     * 🔧 修正: 正しいマウス座標取得
     */
    setupEventHandlers() {
        const app = this.canvasManager.app;
        if (!app) {
            console.warn('⚠️ キャンバスアプリケーション未初期化');
            return;
        }
        
        const canvas = app.view;
        
        // マウスイベント（デスクトップ）
        canvas.addEventListener('mousedown', (event) => {
            if (this.uiManager.activePopup) return;
            
            const point = this.canvasManager.getLocalPointerPosition(event);
            console.log(`👆 マウスダウン: (${point.x}, ${point.y})`);
            this.toolManager.startDrawing(point.x, point.y);
        });
        
        canvas.addEventListener('mousemove', (event) => {
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
        });
        
        canvas.addEventListener('mouseup', () => {
            console.log('👆 マウスアップ');
            this.toolManager.stopDrawing();
            this.resetPressureMonitor();
        });
        
        canvas.addEventListener('mouseleave', () => {
            console.log('👆 マウス離脱');
            this.toolManager.stopDrawing();
            this.resetPressureMonitor();
        });
        
        // タッチイベント（モバイル）
        canvas.addEventListener('touchstart', (event) => {
            event.preventDefault();
            if (this.uiManager.activePopup) return;
            
            const touch = event.touches[0];
            const point = this.canvasManager.getLocalPointerPosition(touch);
            this.toolManager.startDrawing(point.x, point.y);
        });
        
        canvas.addEventListener('touchmove', (event) => {
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
        });
        
        canvas.addEventListener('touchend', (event) => {
            event.preventDefault();
            this.toolManager.stopDrawing();
            this.resetPressureMonitor();
        });
        
        console.log('✅ イベントハンドリング設定完了（マウス・タッチ両対応）');
    }
    
    /**
     * キャンバスリサイズ適用
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
     * 初期状態設定
     */
    setupInitialState() {
        this.setActiveTool('pen', document.getElementById('pen-tool'));
        this.updateCanvasInfo();
        
        const currentColor = document.getElementById('current-color');
        if (currentColor) {
            currentColor.textContent = '#800000';
        }
    }
    
    /**
     * 座標表示更新
     */
    updateCoordinateDisplay(x, y) {
        const coordinatesElement = document.getElementById('coordinates');
        if (coordinatesElement) {
            coordinatesElement.textContent = `x: ${Math.round(x)}, y: ${Math.round(y)}`;
        }
    }
    
    /**
     * 筆圧モニター更新
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
     * 筆圧モニターリセット
     */
    resetPressureMonitor() {
        const pressureElement = document.getElementById('pressure-monitor');
        if (pressureElement) {
            pressureElement.textContent = '0.0%';
        }
    }
    
    /**
     * キャンバス情報更新
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
        
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 5000);
    }
    
    /**
     * アプリケーション状態取得
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
 */
window.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0');
        console.log('📋 Phase1.1: 座標・背景色修正版');
        console.log('🚀 起動開始...');
        
        window.futabaDrawingTool = new FutabaDrawingTool();
        await window.futabaDrawingTool.init();
        
        console.log('🎉 アプリケーション起動完了！');
        
    } catch (error) {
        console.error('❌ アプリケーション起動失敗:', error);
        
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