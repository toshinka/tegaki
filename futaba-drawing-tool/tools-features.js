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
    }
    
    start() {
        const update = () => {
            this.frameCount++;
            const currentTime = performance.now();
            
            if (currentTime - this.lastTime >= 1000) {
                const fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastTime));
                document.getElementById('fps').textContent = fps;
                
                this.frameCount = 0;
                this.lastTime = currentTime;
            }
            
            requestAnimationFrame(update);
        };
        
        update();
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
        // 将来実装: キーボードショートカット
        console.log('Shortcut system initialized (placeholder)');
        
        // 基本ショートカット例
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch(e.key) {
                    case 'z':
                        e.preventDefault();
                        // Undo機能（将来実装）
                        console.log('Undo shortcut triggered');
                        break;
                    case 'y':
                        e.preventDefault();
                        // Redo機能（将来実装）
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
        // 将来実装: レイヤー機能
        console.log('Layer system initialized (placeholder)');
    }
    
    createLayer(name = 'Layer') {
        // 将来実装
        console.log(`Creating layer: ${name}`);
        return null;
    }
    
    deleteLayer(layerId) {
        // 将来実装
        console.log(`Deleting layer: ${layerId}`);
    }
    
    setActiveLayer(layerId) {
        // 将来実装
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
    }
    
    async init() {
        console.log('🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v0.7 初期化開始');
        
        await this.engine.init();
        this.ui.init();
        this.shortcuts.init();
        this.layers.init();
        this.setupCanvasEvents();
        this.setupResizeHandlers();
        this.monitor.start();
        this.updateCanvasInfo();
        
        console.log('✅ 初期化完了 - v0.7 分割版:');
        console.log('  📁 core-engine.js: 描画エンジン基盤');
        console.log('  📁 ui-system.js: UI管理システム');
        console.log('  📁 tools-features.js: ツール・機能群');
        console.log('  🎯 64サイズプリセット削除・6項目均等配置');
        console.log('  🎨 プリセット色統一 (#800000)');
        console.log('  📊 アクティブプリセット動的リサイズ (0.5-20px)');
        console.log('  🔢 リアルタイム数値更新機能');
    }
    
    setupCanvasEvents() {
        this.engine.app.stage.on('pointerdown', (event) => {
            if (this.ui.activePopup) return;
            
            const point = this.engine.getLocalPointerPosition(event);
            this.toolSystem.startDrawing(this.engine, point.x, point.y);
        });
        
        this.engine.app.stage.on('pointermove', (event) => {
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
        });
        
        this.engine.app.stage.on('pointerup', () => {
            this.toolSystem.stopDrawing();
            this.ui.resetPressureMonitor();
        });
        
        this.engine.app.stage.on('pointerupoutside', () => {
            this.toolSystem.stopDrawing();
            this.ui.resetPressureMonitor();
        });
    }
    
    setupResizeHandlers() {
        document.getElementById('apply-resize').addEventListener('click', () => {
            this.applyResize(false);
        });
        
        document.getElementById('apply-resize-center').addEventListener('click', () => {
            this.applyResize(true);
        });
    }
    
    applyResize(centerContent) {
        const width = parseInt(document.getElementById('canvas-width').value);
        const height = parseInt(document.getElementById('canvas-height').value);
        this.engine.resize(width, height, centerContent);
        this.updateCanvasInfo();
        this.ui.closeAllPopups();
    }
    
    updateCanvasInfo() {
        this.ui.updateCanvasInfo(this.engine.width, this.engine.height);
    }
    
    // 将来機能用メソッド
    enableAdvancedFeatures() {
        // 将来実装: 高度な機能の有効化
        console.log('Advanced features placeholder');
    }
}

// ==== Bootstrap ====
window.addEventListener('DOMContentLoaded', async () => {
    try {
        window.futabaDrawingTool = new FutabaDrawingTool();
        await window.futabaDrawingTool.init();
        
    } catch (error) {
        console.error('❌ 起動エラー:', error);
    }
});

// グローバル公開
window.ToolSystem = ToolSystem;
window.PerformanceMonitor = PerformanceMonitor;
window.ShortcutManager = ShortcutManager;
window.LayerSystem = LayerSystem;
window.FutabaDrawingTool = FutabaDrawingTool;