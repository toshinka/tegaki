/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v0.7
 * ツール・機能群 - tools-features.js
 */

// ==== Tool System ====
class ToolSystem {
    constructor() {
        this.currentTool = 'pen';
        this.brushSize = 16.0;
        this.brushColor = 0x800000;
        this.opacity = 0.85;
        this.pressure = 0.5;
        this.smoothing = 0.3;
        this.isDrawing = false;
        this.currentPath = null;
        this.lastPoint = null;
    }
    
    setTool(tool) {
        this.currentTool = tool;
        console.log(`ツール切り替え: ${tool}`);
    }
    
    setBrushSize(size) {
        this.brushSize = Math.max(0.1, Math.min(100, Math.round(size * 10) / 10));
    }
    
    setOpacity(opacity) {
        this.opacity = Math.max(0, Math.min(1, Math.round(opacity * 1000) / 1000));
    }
    
    setPressure(pressure) {
        this.pressure = Math.max(0, Math.min(1, Math.round(pressure * 1000) / 1000));
    }
    
    setSmoothing(smoothing) {
        this.smoothing = Math.max(0, Math.min(1, Math.round(smoothing * 1000) / 1000));
    }
    
    startDrawing(engine, x, y) {
        this.isDrawing = true;
        this.lastPoint = { x, y };
        this.currentPath = engine.createPath(x, y, this.brushSize, this.brushColor, this.opacity, this.currentTool);
    }
    
    continueDrawing(engine, x, y) {
        if (!this.isDrawing || !this.currentPath) return;
        
        engine.drawLine(this.currentPath, x, y);
        this.lastPoint = { x, y };
    }
    
    stopDrawing() {
        if (this.currentPath) {
            this.currentPath.isComplete = true;
        }
        this.isDrawing = false;
        this.currentPath = null;
        this.lastPoint = null;
    }
}

// ==== Performance Monitor ====
class PerformanceMonitor {
    constructor() {
        this.frameCount = 0;
        this.lastTime = performance.now();
        this.isRunning = false;
    }
    
    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        
        const update = () => {
            if (!this.isRunning) return;
            
            this.frameCount++;
            const currentTime = performance.now();
            
            if (currentTime - this.lastTime >= 1000) {
                const fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastTime));
                const fpsElement = document.getElementById('fps');
                if (fpsElement) {
                    fpsElement.textContent = fps;
                }
                
                this.frameCount = 0;
                this.lastTime = currentTime;
            }
            
            requestAnimationFrame(update);
        };
        
        update();
    }
    
    stop() {
        this.isRunning = false;
    }
}

// ==== Shortcut Manager (将来機能用) ====
class ShortcutManager {
    constructor(toolSystem, uiController) {
        this.toolSystem = toolSystem;
        this.uiController = uiController;
        this.shortcuts = new Map();
    }
    
    init() {
        console.log('Shortcut system initialized (placeholder)');
        
        // 基本ショートカット例
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch(e.key) {
                    case 'z':
                        e.preventDefault();
                        console.log('Undo shortcut triggered');
                        break;
                    case 'y':
                        e.preventDefault();
                        console.log('Redo shortcut triggered');
                        break;
                }
            }
            
            // ツール切り替えショートカット
            switch(e.key) {
                case 'b': // Brush/Pen
                    this.uiController.setTool('pen');
                    break;
                case 'e': // Eraser
                    this.uiController.setTool('eraser');
                    break;
            }
        });
    }
}

// ==== Layer System (将来機能用) ====
class LayerSystem {
    constructor(drawingEngine) {
        this.drawingEngine = drawingEngine;
        this.layers = [];
        this.activeLayer = null;
    }
    
    init() {
        console.log('Layer system initialized (placeholder)');
    }
    
    createLayer(name = 'Layer') {
        console.log(`Creating layer: ${name}`);
        return null;
    }
    
    deleteLayer(layerId) {
        console.log(`Deleting layer: ${layerId}`);
    }
    
    setActiveLayer(layerId) {
        console.log(`Setting active layer: ${layerId}`);
    }
}

// ==== Main Application ====
class FutabaDrawingTool {
    constructor() {
        this.engine = new DrawingEngine(400, 400);
        this.toolSystem = new ToolSystem();
        this.ui = new UIController(this.toolSystem);
        this.monitor = new PerformanceMonitor();
        this.shortcuts = new ShortcutManager(this.toolSystem, this.ui);
        this.layers = new LayerSystem(this.engine);
        this.isInitialized = false;
    }
    
    async init() {
        try {
            console.log('🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v0.7 初期化開始');
            
            // 依存関係チェック
            if (typeof PIXI === 'undefined') {
                throw new Error('PIXI.js が読み込まれていません');
            }
            
            if (!this.engine || !this.toolSystem || !this.ui) {
                throw new Error('必要なクラスが初期化されていません');
            }
            
            // 各コンポーネントの初期化
            await this.engine.init();
            this.ui.init();
            this.shortcuts.init();
            this.layers.init();
            
            // イベントハンドラーの設定
            this.setupCanvasEvents();
            this.setupResizeHandlers();
            
            // パフォーマンスモニター開始
            this.monitor.start();
            
            // 初期状態の更新
            this.updateCanvasInfo();
            
            this.isInitialized = true;
            
            console.log('✅ 初期化完了 - v0.7 分割版:');
            console.log('  📁 core-engine.js: 描画エンジン基盤');
            console.log('  📁 ui-system.js: UI管理システム');
            console.log('  📁 tools-features.js: ツール・機能群');
            console.log('  🎯 64サイズプリセット削除・6項目均等配置');
            console.log('  🎨 プリセット色統一 (#800000)');
            console.log('  📊 アクティブプリセット動的リサイズ (0.5-20px)');
            console.log('  🔢 リアルタイム数値更新機能');
            
        } catch (error) {
            console.error('❌ 初期化エラー:', error);
            this.showError(`初期化エラー: ${error.message}`);
            throw error;
        }
    }
    
    setupCanvasEvents() {
        if (!this.engine.app || !this.engine.app.stage) {
            console.error('Canvas events setup failed: engine not ready');
            return;
        }
        
        this.engine.app.stage.on('pointerdown', (event) => {
            if (this.ui.activePopup) return;
            
            try {
                const point = this.engine.getLocalPointerPosition(event);
                this.toolSystem.startDrawing(this.engine, point.x, point.y);
            } catch (error) {
                console.warn('Pointer down error:', error);
            }
        });
        
        this.engine.app.stage.on('pointermove', (event) => {
            try {
                const point = this.engine.getLocalPointerPosition(event);
                
                // 座標表示更新
                this.ui.updateCoordinates(point.x, point.y);
                
                // 筆圧モニター更新（簡易実装）
                if (this.toolSystem.isDrawing) {
                    const pressure = Math.min(100, this.toolSystem.pressure * 100 + Math.random() * 20);
                    this.ui.updatePressureMonitor(pressure);
                }
                
                // 描画続行
                if (!this.ui.activePopup) {
                    this.toolSystem.continueDrawing(this.engine, point.x, point.y);
                }
            } catch (error) {
                console.warn('Pointer move error:', error);
            }
        });
        
        this.engine.app.stage.on('pointerup', () => {
            this.toolSystem.stopDrawing();
            this.ui.resetPressureMonitor();
        });
        
        this.engine.app.stage.on('pointerupoutside', () => {
            this.toolSystem.stopDrawing();
            this.ui.resetPressureMonitor();
        });
        
        console.log('✅ Canvas events setup complete');
    }
    
    setupResizeHandlers() {
        const applyBtn = document.getElementById('apply-resize');
        const applyCenterBtn = document.getElementById('apply-resize-center');
        
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                this.applyResize(false);
            });
        }
        
        if (applyCenterBtn) {
            applyCenterBtn.addEventListener('click', () => {
                this.applyResize(true);
            });
        }
        
        console.log('✅ Resize handlers setup complete');
    }
    
    applyResize(centerContent) {
        try {
            const widthInput = document.getElementById('canvas-width');
            const heightInput = document.getElementById('canvas-height');
            
            if (!widthInput || !heightInput) {
                console.warn('リサイズ入力要素が見つかりません');
                return;
            }
            
            const width = parseInt(widthInput.value);
            const height = parseInt(heightInput.value);
            
            if (isNaN(width) || isNaN(height) || width < 100 || height < 100) {
                console.warn('無効なサイズが指定されました');
                return;
            }
            
            this.engine.resize(width, height, centerContent);
            this.updateCanvasInfo();
            this.ui.closeAllPopups();
            
            console.log(`Canvas resized to ${width}x${height}px`);
        } catch (error) {
            console.error('Resize error:', error);
        }
    }
    
    updateCanvasInfo() {
        this.ui.updateCanvasInfo(this.engine.width, this.engine.height);
    }
    
    showError(message) {
        // 簡易エラー表示
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ff4444;
            color: white;
            padding: 12px;
            border-radius: 4px;
            z-index: 9999;
            font-family: monospace;
        `;
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 5000);
    }
    
    // 将来機能用メソッド
    enableAdvancedFeatures() {
        console.log('Advanced features placeholder');
    }
    
    // デバッグ用メソッド
    getStatus() {
        return {
            initialized: this.isInitialized,
            engine: this.engine.getStats(),
            tool: this.toolSystem.currentTool,
            drawing: this.toolSystem.isDrawing
        };
    }
}

// ==== Bootstrap ====
window.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('🚀 DOMContentLoaded - Starting application...');
        
        // 必要なライブラリの存在確認
        if (typeof PIXI === 'undefined') {
            throw new Error('PIXI.js が読み込まれていません。CDNの読み込みを確認してください。');
        }
        
        // 必要なクラスの存在確認
        if (typeof DrawingEngine === 'undefined') {
            throw new Error('DrawingEngine クラスが見つかりません。core-engine.js の読み込みを確認してください。');
        }
        
        if (typeof UIController === 'undefined') {
            throw new Error('UIController クラスが見つかりません。ui-system.js の読み込みを確認してください。');
        }
        
        // アプリケーション初期化
        window.futabaDrawingTool = new FutabaDrawingTool();
        await window.futabaDrawingTool.init();
        
        console.log('🎉 Application ready!');
        
    } catch (error) {
        console.error('❌ 起動エラー:', error);
        
        // エラーメッセージをページに表示
        const errorDiv = document.createElement('div');
        errorDiv.innerHTML = `
            <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                        background: #ffebee; border: 2px solid #f44336; border-radius: 8px; 
                        padding: 20px; max-width: 500px; z-index: 10000; font-family: monospace;">
                <h3 style="color: #f44336; margin: 0 0 10px 0;">起動エラー</h3>
                <p style="margin: 0; color: #333;">${error.message}</p>
                <p style="margin: 10px 0 0 0; font-size: 12px; color: #666;">
                    コンソール（F12）で詳細を確認してください。
                </p>
            </div>
        `;
        document.body.appendChild(errorDiv);
    }
});

// グローバル公開
if (typeof window !== 'undefined') {
    window.ToolSystem = ToolSystem;
    window.PerformanceMonitor = PerformanceMonitor;
    window.ShortcutManager = ShortcutManager;
    window.LayerSystem = LayerSystem;
    window.FutabaDrawingTool = FutabaDrawingTool;
}