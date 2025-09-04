/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵かきツール v8rev7
 * PixiJS v8 対応版 - ツール機能群
 * 分割構成: futaba_main.html (基盤) + futaba_tools.js (ツール群)
 */

// ==== DrawingTools: Tool Management ====
class DrawingTools {
    constructor(drawingEngine, layerManager) {
        this.engine = drawingEngine;
        this.layers = layerManager;
        this.currentTool = 'pen';
        this.brushSize = 16.0;
        this.brushColor = 0x800000;
        this.opacity = 0.85;
        this.drawing = { active: false, path: null, lastPoint: null };
    }
    
    selectTool(tool) {
        this.currentTool = tool;
        log(`🔧 Tool selected: ${tool}`);
    }
    
    setBrushSize(size) {
        this.brushSize = Math.max(0.1, Math.min(100, Math.round(size * 10) / 10));
    }
    
    setOpacity(opacity) {
        this.opacity = Math.max(0, Math.min(1, Math.round(opacity * 1000) / 1000));
    }
    
    startDrawing(x, y, isPanning) {
        if (isPanning) return false;
        
        this.drawing.active = true;
        this.drawing.lastPoint = { x, y };
        
        const color = this.currentTool === 'eraser' ? 0xf0e0d6 : this.brushColor;
        const alpha = this.currentTool === 'eraser' ? 1.0 : this.opacity;
        
        this.drawing.path = this.engine.createPath(x, y, this.brushSize, color, alpha);
        log(`🎨 Drawing started at (${Math.round(x)}, ${Math.round(y)})`);
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
            log('🎨 Drawing completed');
        }
        this.drawing = { active: false, path: null, lastPoint: null };
    }
}

// ==== InterfaceManager: UI Control ====
class InterfaceManager {
    constructor(drawingTools, drawingEngine, layerManager) {
        this.tools = drawingTools;
        this.engine = drawingEngine;
        this.layers = layerManager;
        this.activePopup = null;
        this.sliders = new Map();
        this.dragState = { active: false, offset: { x: 0, y: 0 } };
    }
    
    initialize() {
        log('🚂 InterfaceManager: Initializing UI');
        this.layers.ui = this;
        this.setupToolButtons();
        this.setupPopups();
        this.setupSliders();
        this.setupResize();
        this.setupLayerControls();
        this.updateCanvasInfo();
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
        const panel = document.getElementById('layer-panel');
        if (!panel) return;
        
        panel.classList.toggle('hidden');
        
        const button = document.getElementById('layer-tool');
        if (button) {
            button.classList.toggle('active', !panel.classList.contains('hidden'));
        }
        
        log(`🎯 Layer panel: ${panel.classList.contains('hidden') ? 'hidden' : 'visible'}`);
    }
    
    setupLayerControls() {
        const addLayerBtn = document.getElementById('add-layer-btn');
        const duplicateLayerBtn = document.getElementById('duplicate-layer-btn');
        
        if (addLayerBtn) {
            addLayerBtn.addEventListener('click', () => {
                const newLayer = this.layers.createLayer();
                this.layers.setActiveLayer(newLayer.id);
            });
        }
        
        if (duplicateLayerBtn) {
            duplicateLayerBtn.addEventListener('click', () => {
                if (this.layers.activeLayerId !== null) {
                    this.layers.duplicateLayer(this.layers.activeLayerId);
                }
            });
        }
    }
    
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
                !e.target.closest('.layer-panel')) {
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
    
    updateCanvasInfo() {
        const element = document.getElementById('canvas-info');
        if (element) {
            element.textContent = `${APP_CONFIG.canvas.width}×${APP_CONFIG.canvas.height}px`;
        }
    }
    
    updateCoordinates(x, y) {
        const element = document.getElementById('coordinates');
        if (element) {
            element.textContent = `x: ${Math.round(x)}, y: ${Math.round(y)}`;
        }
    }
    
    closeAllPopups() {
        document.querySelectorAll('.popup-panel').forEach(popup => {
            popup.classList.remove('show');
        });
        this.activePopup = null;
    }
}

// ==== Tools Initialization ====
window.addEventListener('DOMContentLoaded', () => {
    // Wait for main app to be ready
    const waitForApp = () => {
        if (!window.futabaApp || !window.futabaApp.engine || !window.futabaApp.layerManager) {
            setTimeout(waitForApp, 50);
            return;
        }
        
        try {
            // Initialize tools
            const tools = new DrawingTools(window.futabaApp.engine, window.futabaApp.layerManager);
            const ui = new InterfaceManager(tools, window.futabaApp.engine, window.futabaApp.layerManager);
            
            // Connect to main app
            window.futabaApp.setTools(tools, ui);
            
            // Initialize UI
            ui.initialize();
            
            console.log('🎨 Futaba Drawing Tool v8rev7 - Ready!');
            console.log('📋 Split Architecture Summary:');
            console.log('  🏗️ futaba_main.html: Base system (Engine, Layers, Position, Monitor)');
            console.log('  🔧 futaba_tools.js: Tool system (Drawing, Interface)');
            console.log('  ✅ PIXI Container-based layer management');
            console.log('  🎯 Layer panel with visibility toggle');
            console.log('  📋 Layer creation, duplication, deletion');
            console.log('  🗃️ Background layer protection');
            console.log('  🎨 Active layer drawing system');
            console.log('  📊 Status display with current layer');
            console.log('  🎪 Adobe Fresco-style right panel UI');
            console.log('  🖊️ Pen pressure support for canvas panning');
            console.log('  🔄 Layer drag-and-drop reordering');
            console.log('');
            console.log('🎮 Controls:');
            console.log('  📱 Space + Drag: Canvas movement');
            console.log('  ⌨️  Space + Arrow Keys: Fine movement (±10px)');
            console.log('  🏠  Home: Reset position');
            console.log('  🎯 Layer Tool: Toggle layer panel');
            
        } catch (error) {
            console.error('💥 Tools initialization failed:', error);
        }
    };
    
    waitForApp();
});