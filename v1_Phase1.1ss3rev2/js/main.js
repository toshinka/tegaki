/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 🎯 AI_WORK_SCOPE: アプリケーション初期化・統合エントリーポイント
 * 🔧 修正内容: 座標変換問題修正・警告メッセージ整理・描画精度向上
 * 🚨 PURE_JAVASCRIPT: ES6モジュール禁止 - グローバル変数使用
 * 
 * v1.1ss3rev3 修正内容:
 * - 座標0.0から線が引かれる問題を修正
 * - PixiJSネイティブイベントを使用した正確な座標取得
 * - 警告メッセージの整理とレベル調整
 * - 元ファイルと同等の描画精度を実現
 */

class FutabaDrawingTool {
    constructor() {
        this.version = 'v1.1ss3rev3-coordinate-fix';
        this.isInitialized = false;
        this.startTime = performance.now();
        
        // 主要コンポーネント
        this.appCore = null;
        this.canvasManager = null;
        this.toolManager = null;
        this.uiManager = null;
        this.performanceMonitor = null;
        
        console.log('🎨 アプリケーション初期化 Phase1版 (座標修正版)');
    }
    
    /**
     * アプリケーション初期化
     */
    async init() {
        try {
            console.log('🔧 Phase1.1ss3rev3 分割構造での初期化開始');
            
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
            
            console.log('✅ Phase1.1ss3rev3 初期化完了！');
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
                console.info('💡 拡張機能の互換性情報:', issues);
            }
            console.log('✅ PIXIExtensions 初期化完了');
        } else {
            console.info('💡 PIXIExtensions フォールバック: 基本機能で動作中');
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
            console.info('💡 AppCore フォールバック: 直接初期化で動作中');
            await this.initializePixiDirectly();
        }
    }
    
    /**
     * 直接PixiJS初期化（フォールバック）
     * 🔧 修正: ふたば風背景色・座標系修正・正確な設定
     */
    async initializePixiDirectly() {
        const canvasContainer = document.getElementById('drawing-canvas');
        if (!canvasContainer) {
            throw new Error('キャンバスコンテナが見つかりません');
        }
        
        // PixiJS Application作成 - 元ファイルと同じ設定
        this.pixiApp = new PIXI.Application({
            width: 400,
            height: 400,
            backgroundColor: 0xf0e0d6, // ふたば風背景色 #f0e0d6
            antialias: true,
            resolution: 1, // 🔧 修正: 元ファイルと同じく固定値
            autoDensity: false // 🔧 修正: 元ファイルと同じく無効化
        });
        
        // キャンバス追加
        canvasContainer.appendChild(this.pixiApp.view);
        
        // 🔧 修正: PixiJSネイティブのインタラクティブ設定
        this.pixiApp.stage.interactive = true;
        this.pixiApp.stage.hitArea = new PIXI.Rectangle(0, 0, 400, 400);
        
        console.log('✅ PixiJS直接初期化完了（座標修正・ふたば風背景色）');
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
            console.info('💡 CanvasManager フォールバック: 基本管理で動作中');
            this.canvasManager = {
                app: this.pixiApp,
                
                // 🔧 修正: PixiJSネイティブの座標取得を使用
                getLocalPointerPosition: (event) => {
                    // PixiJSのeventから直接座標取得（最も正確な方法）
                    if (event.data && event.data.getLocalPosition) {
                        const point = event.data.getLocalPosition(this.pixiApp.stage);
                        return { x: point.x, y: point.y };
                    }
                    
                    // フォールバック: DOM座標から変換（元ファイルと同じロジック）
                    const rect = this.pixiApp.view.getBoundingClientRect();
                    const x = (event.clientX - rect.left) * (this.pixiApp.view.width / rect.width);
                    const y = (event.clientY - rect.top) * (this.pixiApp.view.height / rect.height);
                    return { x, y };
                },
                
                // 🔧 修正: DOM座標変換専用メソッド（マウス・タッチ用）
                getDOMPointerPosition: (event) => {
                    const rect = this.pixiApp.view.getBoundingClientRect();
                    const x = (event.clientX - rect.left) * (this.pixiApp.view.width / rect.width);
                    const y = (event.clientY - rect.top) * (this.pixiApp.view.height / rect.height);
                    return { x, y };
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
            console.info('💡 ToolManager フォールバック: 基本描画で動作中');
            this.setupBasicDrawing();
        }
    }
    
    /**
     * 基本描画機能設定（フォールバック）
     * 🔧 修正: 元ファイルと同じ円形ブラシ描画ロジックを適用
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
            
            // 🔧 修正: 元ファイルと同じ円形ブラシ描画方式
            startDrawing: (x, y) => {
                console.log(`🖊️ 描画開始: (${Math.round(x)}, ${Math.round(y)})`);
                this.toolManager.isDrawing = true;
                this.toolManager.lastPoint = { x, y };
                
                // 🔧 修正: 元ファイルと同じGraphics作成方式
                const graphics = new PIXI.Graphics();
                
                // 円形ブラシで開始点を描画（元ファイルの方式）
                const color = this.toolManager.currentTool === 'eraser' ? 0xf0e0d6 : this.toolManager.globalSettings.color;
                const opacity = this.toolManager.currentTool === 'eraser' ? 1.0 : this.toolManager.globalSettings.opacity;
                
                graphics.beginFill(color, opacity);
                graphics.drawCircle(x, y, this.toolManager.globalSettings.size / 2);
                graphics.endFill();
                
                this.toolManager.currentPath = graphics;
                this.canvasManager.app.stage.addChild(graphics);
            },
            
            // 🔧 修正: 元ファイルと同じ連続円形描画方式
            continueDrawing: (x, y) => {
                if (this.toolManager.isDrawing && this.toolManager.currentPath && this.toolManager.lastPoint) {
                    const lastPoint = this.toolManager.lastPoint;
                    const distance = Math.sqrt((x - lastPoint.x) ** 2 + (y - lastPoint.y) ** 2);
                    
                    // 最小距離フィルタ（元ファイルと同じ）
                    if (distance < 1.5) return;
                    
                    // 連続する円形で滑らかな線を描画（元ファイルの方式）
                    const steps = Math.max(1, Math.ceil(distance / 1.5));
                    const color = this.toolManager.currentTool === 'eraser' ? 0xf0e0d6 : this.toolManager.globalSettings.color;
                    const opacity = this.toolManager.currentTool === 'eraser' ? 1.0 : this.toolManager.globalSettings.opacity;
                    
                    for (let i = 1; i <= steps; i++) {
                        const t = i / steps;
                        const px = lastPoint.x + (x - lastPoint.x) * t;
                        const py = lastPoint.y + (y - lastPoint.y) * t;
                        
                        this.toolManager.currentPath.beginFill(color, opacity);
                        this.toolManager.currentPath.drawCircle(px, py, this.toolManager.globalSettings.size / 2);
                        this.toolManager.currentPath.endFill();
                    }
                    
                    this.toolManager.lastPoint = { x, y };
                }
            },
            
            stopDrawing: () => {
                console.log('🖊️ 描画終了');
                if (this.toolManager.currentPath) {
                    // パスが完成したことをマーク
                    this.toolManager.currentPath.isComplete = true;
                }
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
            console.info('💡 UIManager フォールバック: 基本UIで動作中');
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
     * 🔧 修正: PixiJSネイティブイベント使用 + DOM座標対応の二重構造
     */
    setupEventHandlers() {
        const app = this.canvasManager.app;
        if (!app) {
            console.warn('⚠️ キャンバスアプリケーション未初期化');
            return;
        }
        
        // 🔧 修正: PixiJSネイティブイベント（メイン）
        app.stage.on('pointerdown', (event) => {
            if (this.uiManager.activePopup) return;
            
            const point = this.canvasManager.getLocalPointerPosition(event);
            console.log(`👆 PixiJS PointerDown: (${Math.round(point.x)}, ${Math.round(point.y)})`);
            this.toolManager.startDrawing(point.x, point.y);
        });
        
        app.stage.on('pointermove', (event) => {
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
        
        app.stage.on('pointerup', () => {
            console.log('👆 PixiJS PointerUp');
            this.toolManager.stopDrawing();
            this.resetPressureMonitor();
        });
        
        app.stage.on('pointerupoutside', () => {
            console.log('👆 PixiJS PointerUpOutside');
            this.toolManager.stopDrawing();
            this.resetPressureMonitor();
        });
        
        // 🔧 追加: DOM座標用の補助イベント（フォールバック・デバッグ用）
        const canvas = app.view;
        
        // マウス座標表示更新（DOM座標版）
        canvas.addEventListener('mousemove', (event) => {
            const point = this.canvasManager.getDOMPointerPosition(event);
            // DOMイベントでは座標表示のみ更新（描画はPixiJSイベントで処理）
            this.updateCoordinateDisplay(point.x, point.y);
        });
        
        // タッチイベント（モバイル対応）
        canvas.addEventListener('touchstart', (event) => {
            event.preventDefault();
            if (this.uiManager.activePopup) return;
            
            const touch = event.touches[0];
            const point = this.canvasManager.getDOMPointerPosition(touch);
            this.toolManager.startDrawing(point.x, point.y);
        });
        
        canvas.addEventListener('touchmove', (event) => {
            event.preventDefault();
            const touch = event.touches[0];
            const point = this.canvasManager.getDOMPointerPosition(touch);
            
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
        
        console.log('✅ イベントハンドリング設定完了（PixiJSネイティブ + DOM併用・座標修正版）');
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
        console.log('🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.1ss3rev3');
        console.log('📋 Phase1.1: 座標問題修正・警告整理版');
        console.log('🔧 修正内容: PixiJSネイティブイベント使用・円形ブラシ描画・精度向上');
        console.log('🚀 起動開始...');
        
        window.futabaDrawingTool = new FutabaDrawingTool();
        await window.futabaDrawingTool.init();
        
        console.log('🎉 アプリケーション起動完了！');
        console.log('✅ 座標0.0問題修正済み - クリック位置から正確な描画開始');
        console.log('✅ 警告メッセージ整理済み - フォールバック機能が正常動作');
        
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