/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵かきツール - ツールシステム
 * AIが把握しやすい描画ツール・UI管理専用モジュール
 */

// === DrawingTools: 描画ツール制御 ===
class DrawingTools {
    constructor(drawingEngine, layerSystem) {
        this.engine = drawingEngine;
        this.layers = layerSystem;
        this.currentTool = 'pen';
        this.brushSize = 16.0;
        this.brushColor = 0x800000;
        this.opacity = 0.85;
        this.drawing = { active: false, path: null, lastPoint: null };
    }
    
    selectTool(tool) {
        this.currentTool = tool;
    }
    
    setBrushSize(size) {
        this.brushSize = Math.max(0.1, Math.min(100, Math.round(size * 10) / 10));
    }
    
    setOpacity(opacity) {
        this.opacity = Math.max(0, Math.min(1, Math.round(opacity * 1000) / 1000));
    }
    
    startDrawing(x, y, isPanning) {
        if (isPanning) return false;
        
        const activeLayer = this.layers.getActiveLayer();
        if (!activeLayer || activeLayer.visible !== "open") {
            return false;
        }
        
        this.drawing.active = true;
        this.drawing.lastPoint = { x, y };
        
        const color = this.currentTool === 'eraser' ? 0xf0e0d6 : this.brushColor;
        const alpha = this.currentTool === 'eraser' ? 1.0 : this.opacity;
        
        this.drawing.path = this.engine.createPath(x, y, this.brushSize, color, alpha);
        return true;
    }
    
    continueDrawing(x, y, isPanning) {
        if (!this.drawing.active || !this.drawing.path || isPanning) return;
        
        this.engine.extendPath(this.drawing.path, x, y);
        this.drawing.lastPoint = { x, y };
    }
    
    stopDrawing() {
        if (this.drawing.path) {
            this.drawing.path.isComplete = true;
        }
        this.drawing = { active: false, path: null, lastPoint: null };
    }
}

// === UIController: ユーザーインターフェース制御 ===
class UIController {
    constructor(drawingTools, drawingEngine, layerSystem) {
        this.tools = drawingTools;
        this.engine = drawingEngine;
        this.layers = layerSystem;
        this.activePopup = null;
        this.sliders = new Map();
        this.dragState = { active: false, offset: { x: 0, y: 0 } };
    }
    
    initialize() {
        this.setupToolButtons();
        this.setupPopups();
        this.setupSliders();
        this.setupResize();
        this.updateCanvasInfo();
        this.activateTool('pen');
    }
    
    // === ツールボタン制御 ===
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
        
        if (toolId === 'pen-tool') {
            this.activateTool('pen');
            this.togglePopup('pen-settings');
        } else if (toolId === 'eraser-tool') {
            this.activateTool('eraser');
            this.closeAllPopups();
        } else if (toolId === 'resize-tool') {
            this.togglePopup('resize-settings');
        } else if (toolId === 'layer-tool') {
            this.toggleLayerPanel();
        }
    }
    
    activateTool(tool) {
        this.tools.selectTool(tool);
        
        document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
        const toolBtn = document.getElementById(tool + '-tool');
        if (toolBtn) toolBtn.classList.add('active');
        
        const toolNames = { pen: 'ベクターペン', eraser: '消しゴム' };
        const toolElement = document.getElementById('current-tool');
        if (toolElement) {
            toolElement.textContent = toolNames[tool] || tool;
        }
        
        const canvas = this.engine.app.canvas;
        canvas.style.cursor = tool === 'eraser' ? 'cell' : 'crosshair';
    }
    
    toggleLayerPanel() {
        // レイヤーパネルは常にONのため、ここでは何もしない
        // 将来的に設定アイコンで制御予定
    }
    
    // === ポップアップ制御 ===
    togglePopup(popupId) {
        const popup = document.getElementById(popupId);
        if (!popup) return;
        
        if (this.activePopup && this.activePopup !== popup) {
            this.activePopup.classList.remove('show');
        }
        
        const isVisible = popup.classList.contains('show');
        popup.classList.toggle('show', !isVisible);
        this.activePopup = isVisible ? null : popup;
    }
    
    setupPopups() {
        document.querySelectorAll('.popup-panel').forEach(popup => {
            const title = popup.querySelector('.popup-title');
            if (title) {
                title.style.cursor = 'move';
                title.addEventListener('mousedown', (e) => this.startDrag(e, popup));
            }
        });
        
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.popup-panel') && 
                !e.target.closest('.tool-button') &&
                !e.target.closest('.layer-panel') &&
                !e.target.closest('.layer-popup')) {
                this.closeAllPopups();
            }
        });
        
        document.addEventListener('mousemove', (e) => this.onDrag(e));
        document.addEventListener('mouseup', () => this.stopDrag());
    }
    
    startDrag(e, popup) {
        this.dragState.active = popup;
        const rect = popup.getBoundingClientRect();
        this.dragState.offset.x = e.clientX - rect.left;
        this.dragState.offset.y = e.clientY - rect.top;
        e.preventDefault();
    }
    
    onDrag(e) {
        if (!this.dragState.active) return;
        
        const x = Math.max(0, Math.min(e.clientX - this.dragState.offset.x, 
            window.innerWidth - this.dragState.active.offsetWidth));
        const y = Math.max(0, Math.min(e.clientY - this.dragState.offset.y, 
            window.innerHeight - this.dragState.active.offsetHeight));
        
        this.dragState.active.style.left = x + 'px';
        this.dragState.active.style.top = y + 'px';
    }
    
    stopDrag() {
        this.dragState.active = false;
    }
    
    closeAllPopups() {
        document.querySelectorAll('.popup-panel').forEach(popup => {
            popup.classList.remove('show');
        });
        this.activePopup = null;
    }
    
    // === スライダー制御 ===
    setupSliders() {
        this.createSlider('pen-size-slider', 0.1, 100, 16.0, (value) => {
            this.tools.setBrushSize(value);
            return value.toFixed(1) + 'px';
        });
        
        this.createSlider('pen-opacity-slider', 0, 100, 85.0, (value) => {
            this.tools.setOpacity(value / 100);
            return value.toFixed(1) + '%';
        });
    }
    
    createSlider(sliderId, min, max, initial, callback) {
        const container = document.getElementById(sliderId);
        if (!container) return;
        
        const track = container.querySelector('.slider-track');
        const handle = container.querySelector('.slider-handle');
        const valueDisplay = container.parentNode.querySelector('.slider-value');
        
        if (!track || !handle || !valueDisplay) return;
        
        const slider = {
            value: initial, min, max, callback, track, handle, valueDisplay, dragging: false
        };
        
        this.sliders.set(sliderId, slider);
        
        const update = (value) => {
            slider.value = Math.max(min, Math.min(max, value));
            const percentage = ((slider.value - min) / (max - min)) * 100;
            
            track.style.width = percentage + '%';
            handle.style.left = percentage + '%';
            valueDisplay.textContent = callback(slider.value);
        };
        
        const getValue = (clientX) => {
            const rect = container.getBoundingClientRect();
            const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            return min + (percentage * (max - min));
        };
        
        container.addEventListener('mousedown', (e) => {
            slider.dragging = true;
            update(getValue(e.clientX));
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (slider.dragging) update(getValue(e.clientX));
        });
        
        document.addEventListener('mouseup', () => {
            slider.dragging = false;
        });
        
        update(initial);
    }
    
    // === リサイズ制御 ===
    setupResize() {
        const applyButton = document.getElementById('apply-resize');
        if (applyButton) {
            applyButton.addEventListener('click', () => this.applyResize());
        }
    }
    
    applyResize() {
        const widthInput = document.getElementById('canvas-width');
        const heightInput = document.getElementById('canvas-height');
        
        if (widthInput && heightInput) {
            const width = parseInt(widthInput.value);
            const height = parseInt(heightInput.value);
            
            if (width >= 100 && width <= 4096 && height >= 100 && height <= 4096) {
                this.engine.resize(width, height);
                this.updateCanvasInfo();
                this.closeAllPopups();
            }
        }
    }
    
    // === ステータス更新 ===
    updateCanvasInfo() {
        const element = document.getElementById('canvas-info');
        if (element && window.APP_CONFIG && window.APP_CONFIG.canvas) {
            element.textContent = `${window.APP_CONFIG.canvas.width}×${window.APP_CONFIG.canvas.height}px`;
        }
    }
    
    updateCoordinates(x, y) {
        const element = document.getElementById('coordinates');
        if (element) {
            element.textContent = `x: ${Math.round(x)}, y: ${Math.round(y)}`;
        }
    }
}

// === ToolsIntegrator: 統合システム ===
class ToolsIntegrator {
    static initialize() {
        if (!window.futabaApp) {
            console.error('❌ futaba_main.html not loaded');
            return;
        }
        
        if (!window.FutabaLayers) {
            console.error('❌ futaba_layers.js not loaded');
            return;
        }
        
        const app = window.futabaApp;
        const engine = app.engine;
        const layerSystem = app.layerSystem;
        
        if (!layerSystem) {
            console.error('❌ LayerSystem not found');
            return;
        }
        
        // ツール・UI システム初期化
        const drawingTools = new DrawingTools(engine, layerSystem);
        const uiController = new UIController(drawingTools, engine, layerSystem);
        
        uiController.initialize();
        
        // AppController に接続
        app.setTools(drawingTools, uiController);
        
        console.log('✅ Tools system initialized successfully');
        console.log('🎮 Controls:');
        console.log('  🖊️ Pen Tool: Click pen icon');
        console.log('  🧹 Eraser Tool: Click eraser icon');
        console.log('  📐 Resize: Click scaling icon');
        console.log('  🎨 Layers: Always visible panel on right');
        console.log('  📱 Layer Actions: Right-click on layer item');
        console.log('  💫 Layer Swipe: Swipe left/right to delete');
        console.log('  👁️ Visibility: Click eye icon (3 states)');
        console.log('  ➕ Add Layer: Click + icon');
        console.log('  🏠 Reset View: Home key');
        console.log('  🖱️ Pan Canvas: Hold Space + drag');
        console.log('  ⌨️ Arrow Pan: Space + arrow keys');
    }
}

// === 自動初期化 ===
function initializeToolsSystem() {
    // レイヤーシステムが準備されるまで待機
    const checkAndInit = () => {
        if (window.futabaApp && window.futabaApp.layerSystem) {
            ToolsIntegrator.initialize();
        } else {
            setTimeout(checkAndInit, 10);
        }
    };
    
    checkAndInit();
}

// === 初期化実行 ===
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeToolsSystem);
} else {
    setTimeout(initializeToolsSystem, 10);
}

// === グローバル公開 ===
if (typeof window !== 'undefined') {
    window.FutabaTools = {
        DrawingTools,
        UIController,
        ToolsIntegrator,
        version: '8.0.8-ai-refactored'
    };
}