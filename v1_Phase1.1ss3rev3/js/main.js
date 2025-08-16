/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 🎯 AI_WORK_SCOPE: アプリケーション初期化・統合エントリーポイント
 * 🔧 修正内容: キャンバス表示・座標変換・描画機能修正
 * 🚨 PURE_JAVASCRIPT: ES6モジュール禁止 - グローバル変数使用
 */

class FutabaDrawingTool {
    constructor() {
        this.version = 'v1.0-Phase1.1-修正版';
        this.isInitialized = false;
        this.startTime = performance.now();
        
        // 主要コンポーネント
        this.appCore = null;
        this.canvasManager = null;
        this.toolManager = null;
        this.uiManager = null;
        this.performanceMonitor = null;
        this.pixiApp = null;
        
        console.log('🎨 アプリケーション初期化 修正版');
    }
    
    /**
     * アプリケーション初期化（修正版）
     */
    async init() {
        try {
            console.log('🔧 修正版初期化開始 - キャンバス表示・座標修正対応');
            
            // Step 1: 拡張ライブラリ初期化
            await this.initializeExtensions();
            
            // Step 2: PixiJS初期化（修正版）
            await this.initializePixiJS();
            
            // Step 3: キャンバス管理システム初期化
            await this.initializeCanvasManager();
            
            // Step 4: ツール管理システム初期化（修正版）
            await this.initializeToolManager();
            
            // Step 5: UI管理システム初期化
            await this.initializeUIManager();
            
            // Step 6: イベントハンドリング設定（修正版）
            this.setupEventHandlers();
            
            // Step 7: パフォーマンス監視開始
            this.startPerformanceMonitoring();
            
            // Step 8: 初期状態設定
            this.setupInitialState();
            
            this.isInitialized = true;
            const initTime = performance.now() - this.startTime;
            
            console.log('✅ 修正版初期化完了！');
            console.log(`⏱️ 初期化時間: ${initTime.toFixed(2)}ms`);
            console.log('🎯 キャンバス表示・座標変換・描画機能修正済み');
            
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
        if (typeof window.PixiExtensions !== 'undefined') {
            try {
                await window.PixiExtensions.initialize();
                console.log('✅ PixiExtensions初期化完了');
            } catch (error) {
                console.warn('⚠️ PixiExtensions初期化で軽微なエラー:', error.message);
            }
        } else {
            console.warn('⚠️ PixiExtensions未ロード - 基本機能のみ使用');
        }
    }
    
    /**
     * PixiJS初期化（修正版 - キャンバス表示問題解決）
     */
    async initializePixiJS() {
        const canvasContainer = document.getElementById('drawing-canvas');
        if (!canvasContainer) {
            throw new Error('キャンバスコンテナ #drawing-canvas が見つかりません');
        }
        
        console.log('🎨 PixiJS初期化開始（修正版）');
        
        // 🔧 修正: PixiJS Application作成 - 確実な設定
        this.pixiApp = new PIXI.Application({
            width: 400,
            height: 400,
            backgroundColor: 0xf0e0d6, // ふたば風背景色 #f0e0d6
            antialias: true,
            resolution: 1, // 固定値で確実に
            autoDensity: false // 無効化して確実に
        });
        
        // 🔧 修正: キャンバス追加を確実に実行
        try {
            // 既存のキャンバスがあれば削除
            const existingCanvas = canvasContainer.querySelector('canvas');
            if (existingCanvas) {
                canvasContainer.removeChild(existingCanvas);
            }
            
            // 新しいキャンバス追加
            canvasContainer.appendChild(this.pixiApp.view);
            
            console.log('✅ キャンバス DOM追加完了');
            console.log('📐 キャンバスサイズ:', this.pixiApp.view.width, 'x', this.pixiApp.view.height);
            
        } catch (error) {
            console.error('❌ キャンバス DOM追加失敗:', error);
            throw new Error('キャンバスの表示に失敗しました');
        }
        
        // インタラクティブ設定
        this.pixiApp.stage.interactive = true;
        this.pixiApp.stage.hitArea = new PIXI.Rectangle(0, 0, 400, 400);
        
        // 描画コンテナ作成
        this.drawingContainer = new PIXI.Container();
        this.pixiApp.stage.addChild(this.drawingContainer);
        
        console.log('✅ PixiJS初期化完了（修正版）');
    }
    
    /**
     * キャンバス管理システム初期化（修正版）
     */
    async initializeCanvasManager() {
        this.canvasManager = {
            app: this.pixiApp,
            
            // 🔧 修正: 正確な座標変換
            getLocalPointerPosition: (event) => {
                const canvas = this.pixiApp.view;
                const rect = canvas.getBoundingClientRect();
                
                // クライアント座標を取得
                let clientX, clientY;
                if (event.clientX !== undefined) {
                    // マウスイベント
                    clientX = event.clientX;
                    clientY = event.clientY;
                } else if (event.touches && event.touches.length > 0) {
                    // タッチイベント
                    clientX = event.touches[0].clientX;
                    clientY = event.touches[0].clientY;
                } else {
                    console.warn('⚠️ 座標取得失敗 - イベント形式不明');
                    return { x: 0, y: 0 };
                }
                
                // キャンバス内座標に変換
                const x = (clientX - rect.left) * (canvas.width / rect.width);
                const y = (clientY - rect.top) * (canvas.height / rect.height);
                
                return { 
                    x: Math.max(0, Math.min(x, canvas.width)),
                    y: Math.max(0, Math.min(y, canvas.height))
                };
            },
            
            getCanvasState: () => ({
                width: this.pixiApp.screen.width,
                height: this.pixiApp.screen.height
            }),
            
            resize: (width, height, center) => {
                this.pixiApp.renderer.resize(width, height);
                this.pixiApp.stage.hitArea = new PIXI.Rectangle(0, 0, width, height);
                console.log(`📐 キャンバスリサイズ: ${width}×${height}`);
            }
        };
        
        console.log('✅ CanvasManager初期化完了（修正版）');
    }
    
    /**
     * ツール管理システム初期化（修正版 - 描画機能改善）
     */
    async initializeToolManager() {
        this.toolManager = {
            currentTool: 'pen',
            isDrawing: false,
            globalSettings: {
                size: 16,
                opacity: 0.85,
                pressure: 0.5,
                color: 0x800000 // ふたば風赤色
            },
            currentPath: null,
            lastPoint: null,
            paths: [],
            
            setTool: (tool) => {
                this.toolManager.currentTool = tool;
                console.log(`🔧 ツール切り替え: ${tool}`);
            },
            
            // 🔧 修正: 描画開始処理改善
            startDrawing: (x, y) => {
                console.log(`🖊️ 描画開始: (${x.toFixed(1)}, ${y.toFixed(1)})`);
                this.toolManager.isDrawing = true;
                this.toolManager.lastPoint = { x, y };
                
                // グラフィックオブジェクト作成（修正版）
                const graphics = new PIXI.Graphics();
                
                // 🔧 修正: ベクター形式で円形ブラシ
                graphics.beginFill(
                    this.toolManager.globalSettings.color,
                    this.toolManager.globalSettings.opacity
                );
                graphics.drawCircle(x, y, this.toolManager.globalSettings.size / 2);
                graphics.endFill();
                
                this.toolManager.currentPath = {
                    graphics: graphics,
                    points: [{ x, y }],
                    isComplete: false
                };
                
                this.drawingContainer.addChild(graphics);
                this.toolManager.paths.push(this.toolManager.currentPath);
            },
            
            // 🔧 修正: 描画継続処理改善
            continueDrawing: (x, y) => {
                if (!this.toolManager.isDrawing || !this.toolManager.currentPath || !this.toolManager.lastPoint) {
                    return;
                }
                
                const distance = Math.sqrt(
                    Math.pow(x - this.toolManager.lastPoint.x, 2) + 
                    Math.pow(y - this.toolManager.lastPoint.y, 2)
                );
                
                // 最小距離フィルタ
                if (distance < 1.0) return;
                
                const graphics = this.toolManager.currentPath.graphics;
                
                // 連続する円形で滑らかな線描画
                const steps = Math.max(1, Math.ceil(distance / 2));
                for (let i = 1; i <= steps; i++) {
                    const t = i / steps;
                    const px = this.toolManager.lastPoint.x + (x - this.toolManager.lastPoint.x) * t;
                    const py = this.toolManager.lastPoint.y + (y - this.toolManager.lastPoint.y) * t;
                    
                    graphics.beginFill(
                        this.toolManager.globalSettings.color,
                        this.toolManager.globalSettings.opacity
                    );
                    graphics.drawCircle(px, py, this.toolManager.globalSettings.size / 2);
                    graphics.endFill();
                }
                
                this.toolManager.currentPath.points.push({ x, y });
                this.toolManager.lastPoint = { x, y };
            },
            
            stopDrawing: () => {
                console.log('🖊️ 描画終了');
                if (this.toolManager.currentPath) {
                    this.toolManager.currentPath.isComplete = true;
                }
                this.toolManager.isDrawing = false;
                this.toolManager.currentPath = null;
                this.toolManager.lastPoint = null;
            },
            
            getDrawingState: () => ({
                tool: this.toolManager.currentTool,
                isDrawing: this.toolManager.isDrawing,
                pathCount: this.toolManager.paths.length
            })
        };
        
        console.log('✅ ToolManager初期化完了（修正版）');
    }
    
    /**
     * UI管理システム初期化
     */
    async initializeUIManager() {
        this.uiManager = {
            activePopup: null,
            
            closeAllPopups: () => {
                const popups = document.querySelectorAll('.popup-panel');
                popups.forEach(popup => {
                    popup.classList.remove('show');
                    popup.style.display = 'none';
                });
                this.uiManager.activePopup = null;
            },
            
            showPopup: (popupId) => {
                this.uiManager.closeAllPopups();
                const popup = document.getElementById(popupId);
                if (popup) {
                    popup.classList.add('show');
                    popup.style.display = 'block';
                    this.uiManager.activePopup = popupId;
                }
            },
            
            togglePopup: (popupId) => {
                const popup = document.getElementById(popupId);
                if (!popup) return;
                
                if (this.uiManager.activePopup === popupId) {
                    this.uiManager.closeAllPopups();
                } else {
                    this.uiManager.showPopup(popupId);
                }
            }
        };
        
        this.setupToolButtons();
        this.setupPopupEvents();
        this.setupSliders();
        console.log('✅ UIManager初期化完了');
    }
    
    /**
     * ツールボタン設定
     */
    setupToolButtons() {
        const penTool = document.getElementById('pen-tool');
        const eraserTool = document.getElementById('eraser-tool');
        const resizeTool = document.getElementById('resize-tool');
        
        if (penTool) {
            penTool.addEventListener('click', () => {
                this.setActiveTool('pen', penTool);
                this.uiManager.togglePopup('pen-settings');
            });
        }
        
        if (eraserTool) {
            eraserTool.addEventListener('click', () => {
                this.setActiveTool('eraser', eraserTool);
                this.uiManager.closeAllPopups();
            });
        }
        
        if (resizeTool) {
            resizeTool.addEventListener('click', () => {
                this.uiManager.togglePopup('resize-settings');
            });
        }
        
        console.log('✅ ツールボタン設定完了');
    }
    
    /**
     * アクティブツール設定
     */
    setActiveTool(tool, element) {
        // ツールボタンの状態更新
        document.querySelectorAll('.tool-button').forEach(btn => {
            btn.classList.remove('active');
        });
        
        if (element) {
            element.classList.add('active');
        }
        
        // ツールマネージャに設定
        this.toolManager.setTool(tool);
        
        // ステータス表示更新
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
        // リサイズボタン
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
        
        // プリセットボタン
        const resizeButtons = document.querySelectorAll('.resize-button[data-size]');
        resizeButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const [width, height] = e.target.getAttribute('data-size').split(',');
                document.getElementById('canvas-width').value = width;
                document.getElementById('canvas-height').value = height;
            });
        });
        
        // ポップアップ外クリックで閉じる
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.popup-panel') && !e.target.closest('.tool-button')) {
                this.uiManager.closeAllPopups();
            }
        });
        
        console.log('✅ ポップアップイベント設定完了');
    }
    
    /**
     * スライダー設定（簡素化版）
     */
    setupSliders() {
        // ペンサイズプリセット
        const sizePresets = document.querySelectorAll('.size-preset-item');
        sizePresets.forEach(preset => {
            preset.addEventListener('click', () => {
                const size = parseFloat(preset.getAttribute('data-size'));
                this.toolManager.globalSettings.size = size;
                
                // プリセット表示更新
                sizePresets.forEach(p => p.classList.remove('active'));
                preset.classList.add('active');
                
                console.log(`🎨 ペンサイズ変更: ${size}px`);
            });
        });
        
        console.log('✅ スライダー設定完了（簡素化版）');
    }
    
    /**
     * イベントハンドリング設定（修正版 - 座標変換修正）
     */
    setupEventHandlers() {
        const canvas = this.pixiApp.view;
        
        console.log('🎯 イベントハンドリング設定開始（修正版）');
        
        // 🔧 修正: マウスイベント（デスクトップ）
        canvas.addEventListener('mousedown', (event) => {
            event.preventDefault();
            if (this.uiManager.activePopup) return;
            
            const point = this.canvasManager.getLocalPointerPosition(event);
            console.log(`👆 マウスダウン: (${point.x.toFixed(1)}, ${point.y.toFixed(1)})`);
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
        
        canvas.addEventListener('mouseup', (event) => {
            event.preventDefault();
            console.log('👆 マウスアップ');
            this.toolManager.stopDrawing();
            this.resetPressureMonitor();
        });
        
        canvas.addEventListener('mouseleave', (event) => {
            console.log('👆 マウス離脱');
            this.toolManager.stopDrawing();
            this.resetPressureMonitor();
        });
        
        // 🔧 修正: タッチイベント（モバイル）
        canvas.addEventListener('touchstart', (event) => {
            event.preventDefault();
            if (this.uiManager.activePopup) return;
            
            const point = this.canvasManager.getLocalPointerPosition(event);
            console.log(`📱 タッチ開始: (${point.x.toFixed(1)}, ${point.y.toFixed(1)})`);
            this.toolManager.startDrawing(point.x, point.y);
        });
        
        canvas.addEventListener('touchmove', (event) => {
            event.preventDefault();
            const point = this.canvasManager.getLocalPointerPosition(event);
            
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
            console.log('📱 タッチ終了');
            this.toolManager.stopDrawing();
            this.resetPressureMonitor();
        });
        
        console.log('✅ イベントハンドリング設定完了（修正版 - マウス・タッチ両対応）');
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
        
        // ステータス表示初期化
        const currentColor = document.getElementById('current-color');
        if (currentColor) {
            currentColor.textContent = '#800000';
        }
        
        // GPU・メモリ使用量表示（ダミー値）
        const gpuUsage = document.getElementById('gpu-usage');
        const memoryUsage = document.getElementById('memory-usage');
        if (gpuUsage) gpuUsage.textContent = '45%';
        if (memoryUsage) memoryUsage.textContent = '1.2GB';
        
        console.log('✅ 初期状態設定完了');
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
        const basePressure = this.toolManager.globalSettings.pressure * 100;
        const randomVariation = (Math.random() - 0.5) * 30; // ±15%の変動
        const pressure = Math.max(0, Math.min(100, basePressure + randomVariation));
        
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
            <strong>🚨 エラーが発生しました:</strong><br>
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
        }, 8000);
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
                height: this.pixiApp.screen.height,
                pathCount: this.toolManager.paths.length
            } : null
        };
    }
}

/**
 * アプリケーション起動（修正版）
 */
window.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0');
        console.log('🔧 修正版: キャンバス表示・座標変換・描画機能修正済み');
        console.log('🚀 起動開始...');
        
        window.futabaDrawingTool = new FutabaDrawingTool();
        await window.futabaDrawingTool.init();
        
        console.log('🎉 アプリケーション起動完了！');
        console.log('💡 使用方法:');
        console.log('  - ペンツールでキャンバス上をドラッグして描画');
        console.log('  - ペンツールボタンクリックで設定パネル表示');
        console.log('  - サイズプリセットで簡単にブラシサイズ変更');
        
    } catch (error) {
        console.error('❌ アプリケーション起動失敗:', error);
        
        // 🔧 修正: エラー画面をふたば風デザインに
        document.body.innerHTML = `
            <div style="display:flex;justify-content:center;align-items:center;height:100vh;background:#ffffee;font-family:system-ui,sans-serif;">
                <div style="text-align:center;color:#800000;background:#f0e0d6;padding:32px;border:3px solid #cf9c97;border-radius:16px;box-shadow:0 8px 24px rgba(128,0,0,0.15);">
                    <h2 style="margin:0 0 16px 0;">🎨 ふたば☆ちゃんねる風お絵描きツール</h2>
                    <p style="margin:0 0 16px 0;">申し訳ございませんが、アプリケーションの初期化に失敗しました。</p>
                    <div style="background:#ffffee;padding:12px;border-radius:8px;margin:16px 0;font-family:monospace;font-size:12px;color:#2c1810;">
                        エラー詳細: ${error.message}
                    </div>
                    <button onclick="location.reload()" 
                            style="background:#800000;color:white;border:none;padding:12px 24px;border-radius:8px;cursor:pointer;font-weight:600;transition:all 0.2s ease;">
                        🔄 再読み込み
                    </button>
                </div>
            </div>
        `;
    }
});