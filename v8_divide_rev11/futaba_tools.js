/**
 * ふたば☆ちゃんねる風ベクターお絵かきツール v8rev9
 * ツール・UI統合システム - 描画ツール制御・設定UI・リサイズ機能
 */

// DrawingTools: ペン・消しゴムツール制御
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
    }
    
    setBrushSize(size) {
        this.brushSize = Math.max(0.1, Math.min(100, Math.round(size * 10) / 10));
    }
    
    setOpacity(opacity) {
        this.opacity = Math.max(0, Math.min(1, Math.round(opacity * 1000) / 1000));
    }
    
    startDrawing(x, y) {
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
    
    continueDrawing(x, y) {
        if (!this.drawing.active || !this.drawing.path) return;
        
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

// InterfaceManager: ツールボタン・設定UI制御
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
        this.setupToolButtons();
        this.setupPopups();
        this.setupSliders();
        this.setupResize();
        this.activateTool('pen');
        this.updateCanvasInfo();
    }
    
    setupToolButtons() {
        document.querySelectorAll('.tool-button').forEach(btn => {
            btn.addEventListener('click', (e) => {
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
    
    setupPopups() {
        this.createToolPopups();
        
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
    
    createToolPopups() {
        const body = document.body;
        
        // ペン設定ポップアップ
        const penPopup = document.createElement('div');
        penPopup.className = 'popup-panel';
        penPopup.id = 'pen-settings';
        penPopup.style.left = '60px';
        penPopup.style.top = '100px';
        penPopup.innerHTML = `
            <div class="popup-title">ベクターペンツール設定</div>
            
            <div class="setting-group">
                <div class="setting-label">サイズ</div>
                <div class="slider-container">
                    <div class="slider" id="pen-size-slider">
                        <div class="slider-track" id="pen-size-track"></div>
                        <div class="slider-handle" id="pen-size-handle"></div>
                    </div>
                    <div class="slider-value" id="pen-size-value">16.0px</div>
                </div>
            </div>
            
            <div class="setting-group">
                <div class="setting-label">不透明度</div>
                <div class="slider-container">
                    <div class="slider" id="pen-opacity-slider">
                        <div class="slider-track" id="pen-opacity-track"></div>
                        <div class="slider-handle" id="pen-opacity-handle"></div>
                    </div>
                    <div class="slider-value" id="pen-opacity-value">85.0%</div>
                </div>
            </div>
        `;
        
        // リサイズポップアップ
        const resizePopup = document.createElement('div');
        resizePopup.className = 'popup-panel';
        resizePopup.id = 'resize-settings';
        resizePopup.style.left = '60px';
        resizePopup.style.top = '150px';
        resizePopup.innerHTML = `
            <div class="popup-title">キャンバスリサイズ</div>
            
            <div class="setting-group">
                <div class="setting-label">キャンバスサイズ</div>
                <div class="size-input-group">
                    <input type="number" class="size-input" id="canvas-width" min="100" max="4096" value="400">
                    <div class="size-multiply">×</div>
                    <input type="number" class="size-input" id="canvas-height" min="100" max="4096" value="400">
                </div>
            </div>
            
            <div class="setting-group">
                <div class="action-button primary" id="apply-resize">適用</div>
            </div>
        `;
        
        body.appendChild(penPopup);
        body.appendChild(resizePopup);
        
        this.addPopupStyles();
    }
    
    addPopupStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .popup-panel {
                position: fixed;
                background: var(--futaba-cream);
                border: 2px solid var(--futaba-maroon);
                border-radius: 16px;
                box-shadow: 0 12px 32px rgba(128, 0, 0, 0.3);
                padding: 20px;
                z-index: 2000;
                backdrop-filter: blur(12px);
                display: none;
                user-select: none;
                min-width: 280px;
            }
            
            .popup-panel.show {
                display: block;
                animation: fadeIn 0.3s ease-out;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; transform: scale(0.9); }
                to   { opacity: 1; transform: scale(1); }
            }
            
            .popup-panel .popup-title {
                font-size: 16px;
                font-weight: 600;
                color: var(--futaba-maroon);
                margin-bottom: 16px;
                text-align: center;
                border-bottom: 2px solid var(--futaba-light-medium);
                padding-bottom: 8px;
            }
            
            .popup-panel .setting-group {
                margin-bottom: 16px;
            }
            
            .popup-panel .setting-label {
                font-size: 14px;
                color: var(--text-primary);
                margin-bottom: 8px;
                font-weight: 500;
            }
            
            .popup-panel .slider-container {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 8px;
            }
            
            .popup-panel .slider {
                flex: 1;
                height: 6px;
                background: var(--futaba-light-medium);
                border-radius: 3px;
                position: relative;
                cursor: pointer;
            }
            
            .popup-panel .slider-track {
                height: 100%;
                background: var(--futaba-maroon);
                border-radius: 3px;
                transition: width 0.1s ease;
            }
            
            .popup-panel .slider-handle {
                width: 16px;
                height: 16px;
                background: var(--futaba-maroon);
                border: 2px solid var(--futaba-background);
                border-radius: 50%;
                position: absolute;
                top: 50%;
                transform: translate(-50%, -50%);
                cursor: grab;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            }
            
            .popup-panel .slider-handle:active {
                cursor: grabbing;
                transform: translate(-50%, -50%) scale(1.2);
            }
            
            .popup-panel .slider-value {
                font-size: 12px;
                color: var(--text-secondary);
                font-family: monospace;
                min-width: 50px;
                text-align: right;
            }
            
            .size-input-group {
                display: flex;
                gap: 10px;
                align-items: center;
                margin-bottom: 16px;
            }
            
            .size-input {
                flex: 1;
                padding: 8px 12px;
                border: 2px solid var(--futaba-light-medium);
                border-radius: 6px;
                background: var(--futaba-background);
                font-family: monospace;
                font-size: 14px;
                text-align: center;
            }
            
            .size-input:focus {
                outline: none;
                border-color: var(--futaba-maroon);
            }
            
            .size-multiply {
                color: var(--futaba-maroon);
                font-weight: bold;
                font-size: 16px;
            }
            
            .popup-panel .action-button {
                padding: 10px 16px;
                border: 2px solid var(--futaba-maroon);
                border-radius: 8px;
                background: var(--futaba-background);
                color: var(--futaba-maroon);
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
                text-align: center;
                width: 100%;
            }
            
            .popup-panel .action-button:hover {
                background: var(--futaba-maroon);
                color: var(--text-inverse);
            }
            
            .popup-panel .action-button.primary {
                background: var(--futaba-maroon);
                color: var(--text-inverse);
            }
            
            .popup-panel .action-button.primary:hover {
                background: var(--futaba-light-maroon);
            }
        `;
        document.head.appendChild(style);
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
                
                // 背景レイヤーの塗りつぶしサイズも更新
                if (this.layers && this.layers.layers.has(0)) {
                    const backgroundLayer = this.layers.layers.get(0);
                    const fillPath = backgroundLayer.paths.find(p => p.isBackgroundFill);
                    if (fillPath) {
                        fillPath.graphics.clear();
                        fillPath.graphics.rect(0, 0, width, height);
                        fillPath.graphics.fill(0xf0e0d6);
                    }
                }
            }
        }
    }
    
    updateCanvasInfo() {
        const element = document.getElementById('canvas-info');
        if (element && window.CONFIG && window.CONFIG.canvas) {
            element.textContent = `${window.CONFIG.canvas.width}×${window.CONFIG.canvas.height}px`;
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

// 統合初期化システム - レイヤーシステム完了後に実行
window.initializeToolsAfterLayers = function(layerManager, layerUI) {
    console.log('ツールシステム初期化開始');
    
    if (!window.futabaApp) {
        console.error('Main app not found');
        return;
    }
    
    const app = window.futabaApp;
    const engine = app.engine;
    
    if (!engine || !engine.app) {
        console.error('Drawing engine not ready');
        return;
    }
    
    // ツールシステム初期化
    const drawingTools = new DrawingTools(engine, layerManager);
    const interfaceManager = new InterfaceManager(drawingTools, engine, layerManager);
    
    console.log('ツールインスタンス作成完了');
    
    // UI初期化
    interfaceManager.initialize();
    console.log('InterfaceManager初期化完了');
    
    // AppController に接続
    app.setTools(drawingTools, interfaceManager, layerManager);
    console.log('AppController接続完了');
    
    // グローバルエクスポート
    window.FutabaTools = {
        DrawingTools,
        InterfaceManager,
        drawingTools,
        interfaceManager,
        version: '8.0.9-complete'
    };
    
    console.log('ツールシステム初期化完了');
};

// フォールバック初期化（レイヤーシステムがない場合）
const fallbackInitialize = () => {
    if (window.pendingLayerManager && window.pendingLayerUI) {
        console.log('待機中のレイヤー情報でツール初期化');
        window.initializeToolsAfterLayers(window.pendingLayerManager, window.pendingLayerUI);
        window.pendingLayerManager = null;
        window.pendingLayerUI = null;
    } else if (window.futabaApp && !window.FutabaLayers) {
        console.log('レイヤーシステムなしでツール初期化');
        const mockLayerManager = { 
            getActiveLayer: () => ({ visible: "open" }),
            layers: new Map()
        };
        window.initializeToolsAfterLayers(mockLayerManager, null);
    }
};

// 自動初期化タイマー
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(fallbackInitialize, 600);
    });
} else {
    setTimeout(fallbackInitialize, 600);
}