// Modified content for core-engine.js with null checks for event listeners
/*
 * ===================================================================================
 * Toshinka Tegaki Tool - Core Engine
 * Version: 2.9.1 (Phase 4A11-Pre - Error Handling for UI Elements)
 *
 * - 修正：
 * - Consoleエラー `Uncaught TypeError: Cannot read properties of null (reading 'addEventListener')`
 * を修正するため、UI要素の取得時にnullチェックを追加。
 * - これにより、HTML要素が存在しない場合でもスクリプトの実行が中断されず、
 * よりロバストな動作を実現。
 * - 「Phase 4A11A〜G WebGLレイヤー移動 安定化フェーズ 再設計指示書」に基づき、
 * Phase 4A11-Pre の改修は維持。
 * ===================================================================================
 */

// --- Module Imports ---
import { TopBarManager, LayerUIManager } from './ui/ui-manager.js';
import { ShortcutManager } from './ui/shortcut-manager.js';
import { BucketTool } from './tools/toolset.js';
import { RenderingBridge } from './core/rendering/rendering-bridge.js';
import { Layer, LayerManager } from './layer-manager/layer-manager.js';

// --- Core Logic Classes ---

class CanvasManager {
    constructor(app) {
        this.app = app;
        this.displayCanvas = document.getElementById('drawingCanvas'); 
        // nullチェックを追加
        if (!this.displayCanvas) {
            console.error('Error: #drawingCanvas not found. Canvas operations will not work.');
            return; // キャンバスがない場合はこれ以上初期化しない
        }
        this.displayCtx = this.displayCanvas.getContext('2d', { willReadFrequently: true });
        this.canvasArea = document.getElementById('canvas-area');
        this.canvasContainer = document.getElementById('canvas-container');
        this.width = this.displayCanvas.width;
        this.height = this.displayCanvas.height;

        this.renderingBridge = new RenderingBridge(this.displayCanvas);

        this.compositionData = new ImageData(this.width, this.height);
        this.isDrawing = false; this.isPanning = false; this.isSpaceDown = false;
        
        this.isVDown = false; this.isShiftDown = false;
        
        this.currentTool = 'pen';
        this.currentColor = '#800000'; this.currentSize = 1; this.lastPoint = null;
        
        this.pressureSettings = {
            sensitivity: 0.8, minPressure: 0.1, maxPressure: 1.0, curve: 0.7,
            minSizeRatio: 0.3, dynamicRange: true
        };
        this.pressureHistory = [];
        this.maxPressureHistory = 5;

        this.history = []; this.historyIndex = -1;

        this.dirtyRect = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
        this.animationFrameId = null;

        this.dragStartX = 0; this.dragStartY = 0; this.canvasStartX = 0; this.canvasStartY = 0;
        this.viewTransform = { scale: 1, rotation: 0, flipX: 1, flipY: 1, left: 0, top: 0 };
        
        this.bindEvents();
    }
    
    bindEvents() {
        if (this.canvasArea) {
            this.canvasArea.addEventListener('pointerdown', this.onPointerDown.bind(this));
        }
        document.addEventListener('pointermove', this.onPointerMove.bind(this));
        document.addEventListener('pointerup', this.onPointerUp.bind(this));
        if (this.canvasArea) { // canvasAreaにイベントリスナーを追加する前に存在確認
            this.canvasArea.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
        }
        document.addEventListener('contextmenu', e => e.preventDefault());
        document.getElementById('saveMergedButton')?.addEventListener('click', () => this.exportMergedImage());
    }

    onPointerDown(e) {
        if (e.button !== 0) return;
        
        if (this.isSpaceDown) {
            this.dragStartX = e.clientX; this.dragStartY = e.clientY; this.isPanning = true;
            this.canvasStartX = this.viewTransform.left; this.canvasStartY = this.viewTransform.top;
            e.preventDefault(); return;
        }
        
        const coords = this.getCanvasCoordinates(e);
        if (!coords) return;
        
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer || !activeLayer.visible) return;

        this._resetDirtyRect();
        
        if (this.currentTool === 'bucket') {
            this.app.bucketTool.fill(activeLayer.imageData, coords.x, coords.y, this.currentColor);
            activeLayer.gpuDirty = true;
            this.renderAllLayers();
            this.saveState();
            return;
        }

        this.isDrawing = true;
        this.pressureHistory = [e.pressure > 0 ? e.pressure : 0.5];
        this.lastPoint = { ...coords, pressure: this.pressureHistory[0] };
        
        const size = this.calculatePressureSize(this.currentSize, this.lastPoint.pressure);
        
        this._updateDirtyRect(coords.x, coords.y, size);
        
        this.renderingBridge.drawCircle(
            coords.x, coords.y, size / 2, 
            this.currentColor, this.currentTool === 'eraser',
            activeLayer
        );
        
        this._requestRender();
        document.documentElement.setPointerCapture(e.pointerId);
    }
    
    onPointerMove(e) {
        if (this.isPanning) {
            const dx = e.clientX - this.dragStartX; const dy = e.clientY - this.dragStartY;
            this.viewTransform.left = this.canvasStartX + dx; this.viewTransform.top = this.canvasStartY + dy;
            this.applyViewTransform(); return;
        }

        if (!this.isDrawing) return;
        const coords = this.getCanvasCoordinates(e);
        if (!coords) { this.lastPoint = null; return; }
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer || !activeLayer.visible) return;
        if (!this.lastPoint) { 
            this.pressureHistory = [e.pressure > 0 ? e.pressure : 0.5];
            this.lastPoint = { ...coords, pressure: e.pressure > 0 ? e.pressure : 0.5 }; 
            return;
        }

        const currentPressure = e.pressure > 0 ? e.pressure : 0.5;
        this.pressureHistory.push(currentPressure);
        if (this.pressureHistory.length > this.maxPressureHistory) {
            this.pressureHistory.shift();
        }
        
        const lastSize = this.calculatePressureSize(this.currentSize, this.lastPoint.pressure);
        const currentSize = this.calculatePressureSize(this.currentSize, currentPressure);
        this._updateDirtyRect(this.lastPoint.x, this.lastPoint.y, lastSize);
        this._updateDirtyRect(coords.x, coords.y, currentSize);

        this.renderingBridge.drawLine(
            this.lastPoint.x, this.lastPoint.y, coords.x, coords.y,
            this.currentSize, this.currentColor, this.currentTool === 'eraser',
            this.lastPoint.pressure, currentPressure, 
            this.calculatePressureSize.bind(this),
            activeLayer
        );
        
        this.lastPoint = { ...coords, pressure: currentPressure };
        this._requestRender();
    }
    
    onPointerUp(e) {
        if (this.isDrawing) {
            this.isDrawing = false;
            
            if (this.animationFrameId) {
                cancelAnimationFrame(this.animationFrameId);
                this.animationFrameId = null;
            }
            
            this._renderDirty();

            const activeLayer = this.app.layerManager.getCurrentLayer();
            if (activeLayer) {
                this.renderingBridge.syncDirtyRectToImageData(activeLayer, this.dirtyRect);
            }
            
            this.lastPoint = null;
            this.saveState();
        }

        this.isPanning = false;
        if (document.documentElement.hasPointerCapture(e.pointerId)) {
            document.documentElement.releasePointerCapture(e.pointerId);
        }
    }

    _renderDirty() {
        const rect = this.dirtyRect;
        if (rect.minX > rect.maxX) return;
        this.renderingBridge.compositeLayers(this.app.layerManager.layers, this.compositionData, rect);
        this.renderingBridge.renderToDisplay(this.compositionData, rect);
    }

    renderAllLayers() {
        this.dirtyRect = { minX: 0, minY: 0, maxX: this.width, maxY: this.height };
        this._requestRender();
    }

    _requestRender() {
        if (!this.animationFrameId) {
            this.animationFrameId = requestAnimationFrame(() => {
                this._renderDirty();
                this.animationFrameId = null;
            });
        }
    }

    _updateDirtyRect(x, y, radius) {
        const margin = Math.ceil(radius) + 2;
        this.dirtyRect.minX = Math.min(this.dirtyRect.minX, x - margin);
        this.dirtyRect.minY = Math.min(this.dirtyRect.minY, y - margin);
        this.dirtyRect.maxX = Math.max(this.dirtyRect.maxX, x + margin);
        this.dirtyRect.maxY = Math.max(this.dirtyRect.maxY, y + margin);
    }
    
    _resetDirtyRect() {
        this.dirtyRect = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    }

    calculatePressureSize(baseSizeInput, pressure) {
        const baseSize = Math.max(0.1, baseSizeInput);
        let normalizedPressure = Math.max(0, Math.min(1, pressure || 0));
        
        const tempHistory = [...this.pressureHistory, normalizedPressure];
        if (tempHistory.length > this.maxPressureHistory) tempHistory.shift();
        const smoothedPressure = tempHistory.reduce((sum, p) => sum + p, 0) / tempHistory.length;

        let finalPressure = smoothedPressure;

        const historyLength = this.pressureHistory.length;
        if (this.isDrawing && historyLength <= this.maxPressureHistory) {
            const dampingFactor = historyLength / this.maxPressureHistory;
            const initialDamping = 0.2 + Math.pow(dampingFactor, 3) * 0.8;
            finalPressure *= initialDamping;
        }

        if (this.pressureSettings.dynamicRange) {
            const minHist = Math.min(...tempHistory, finalPressure);
            const maxHist = Math.max(...tempHistory, finalPressure);
            const range = maxHist - minHist;
            if (range > 0.1) {
                finalPressure = (finalPressure - minHist) / range;
            }
        }
        
        const curve = this.pressureSettings.curve;
        const curvedPressure = Math.pow(finalPressure, curve);
        
        const minSize = baseSize * this.pressureSettings.minSizeRatio;
        const maxSize = baseSize;
        const finalSize = minSize + (maxSize - minSize) * curvedPressure;
        
        return Math.max(0.1, finalSize);
    }

    getCanvasCoordinates(e) {
        try {
            const rect = this.displayCanvas.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return null;
            let x = e.clientX - rect.left;
            let y = e.clientY - rect.top;
            x = x * (this.width / rect.width);
            y = y * (this.height / rect.height);
            if (this.viewTransform.flipX === -1) { x = this.width - x; }
            if (this.viewTransform.flipY === -1) { y = this.height - y; }
            if (x < 0 || x >= this.width || y < 0 || y >= this.height) { return null; }
            return { x: x, y: y };
        } catch (error) {
            console.warn('座標変換エラー:', error);
            return null;
        }
    }

    saveState() {
        const state = {
            layers: this.app.layerManager.layers.map(layer => ({
                name: layer.name,
                visible: layer.visible,
                opacity: layer.opacity,
                blendMode: layer.blendMode,
                imageData: new ImageData(
                    new Uint8ClampedArray(layer.imageData.data),
                    layer.imageData.width,
                    layer.imageData.height
                ),
                modelMatrix: new Float32Array(layer.modelMatrix)
            })),
            activeLayerIndex: this.app.layerManager.activeLayerIndex
        };
        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push(state);
        this.historyIndex++;
    }

    restoreState(state) {
        this.app.layerManager.layers = state.layers.map(layerData => {
            const layer = new Layer(layerData.name, layerData.imageData.width, layerData.imageData.height);
            layer.visible = layerData.visible;
            layer.opacity = layerData.opacity ?? 100;
            layer.blendMode = layerData.blendMode ?? 'normal';
            layer.imageData.data.set(layerData.imageData.data);
            if (layerData.modelMatrix) {
                layer.modelMatrix = Array.from(layerData.modelMatrix); 
            }
            layer.gpuDirty = true;
            return layer;
        });
        this.app.layerManager.switchLayer(state.activeLayerIndex);
        this.renderAllLayers();
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.restoreState(this.history[this.historyIndex]);
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.restoreState(this.history[this.historyIndex]);
        }
    }

    applyViewTransform() {
        const transform = this.viewTransform;
        if (this.canvasContainer) { // nullチェックを追加
            this.canvasContainer.style.transform = `
                translateX(${transform.left}px) translateY(${transform.top}px)
                scaleX(${transform.scale * transform.flipX})
                scaleY(${transform.scale * transform.flipY})
                rotate(${transform.rotation}deg)
            `;
        }
        this.renderAllLayers();
    }

    resetView() {
        this.viewTransform = { scale: 1, rotation: 0, flipX: 1, flipY: 1, left: 0, top: 0 };
        this.applyViewTransform();
    }

    zoom(factor, centerX, centerY) {
        const newScale = Math.max(0.1, this.viewTransform.scale * factor);
    
        if (!this.displayCanvas) return; // displayCanvasがnullの場合の早期リターン

        const currentRect = this.displayCanvas.getBoundingClientRect();
        const canvasX = (centerX - currentRect.left) / currentRect.width * this.width;
        const canvasY = (centerY - currentRect.top) / currentRect.height * this.height;
    
        const oldScale = this.viewTransform.scale;
        const oldLeft = this.viewTransform.left;
        const oldTop = this.viewTransform.top;
    
        const newLeft = oldLeft - (canvasX * (newScale - oldScale));
        const newTop = oldTop - (canvasY * (newScale - oldScale));
    
        this.viewTransform.scale = newScale;
        this.viewTransform.left = newLeft;
        this.viewTransform.top = newTop;
    
        this.applyViewTransform();
    }
    
    handleWheel(e) {
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) {
            const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
            this.zoom(zoomFactor, e.clientX, e.clientY);
        } else if (e.shiftKey) {
            this.viewTransform.left -= e.deltaY;
            this.applyViewTransform();
        } else {
            this.viewTransform.top -= e.deltaY;
            this.applyViewTransform();
        }
    }

    exportMergedImage() {
        if (!this.width || !this.height) { // widthまたはheightが未定義の場合のチェック
            console.error('Canvas dimensions are not set. Cannot export image.');
            return;
        }

        const mergedCanvas = document.createElement('canvas');
        mergedCanvas.width = this.width;
        mergedCanvas.height = this.height;
        const mergedCtx = mergedCanvas.getContext('2d');
        
        const imageData = new ImageData(this.width, this.height);
        this.renderingBridge.compositeLayers(this.app.layerManager.layers, imageData, { minX: 0, minY: 0, maxX: this.width, maxY: this.height });
        mergedCtx.putImageData(imageData, 0, 0);

        const link = document.createElement('a');
        link.href = mergedCanvas.toDataURL('image/png');
        link.download = 'merged_drawing.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    setCurrentTool(tool) {
        this.currentTool = tool;
    }
}

class PenSettingsManager {
    constructor(app) {
        this.app = app;
        this.setupEventListeners();
    }
    setupEventListeners() {
        const penSizeSlider = document.getElementById('pen-size-slider');
        if (penSizeSlider) {
            penSizeSlider.addEventListener('input', (e) => {
                this.setSize(parseInt(e.target.value));
            });
        } else { console.warn('Element #pen-size-slider not found.'); }

        const penPressureToggle = document.getElementById('pen-pressure-toggle');
        if (penPressureToggle) {
            penPressureToggle.addEventListener('change', (e) => {
                this.setPressureSensitivity(e.target.checked);
            });
        } else { console.warn('Element #pen-pressure-toggle not found.'); }

        const pressureSensitivitySlider = document.getElementById('pressure-sensitivity-slider');
        if (pressureSensitivitySlider) {
            pressureSensitivitySlider.addEventListener('input', (e) => {
                this.setSensitivity(parseFloat(e.target.value));
            });
        } else { console.warn('Element #pressure-sensitivity-slider not found.'); }

        const minSizeRatioSlider = document.getElementById('min-size-ratio-slider');
        if (minSizeRatioSlider) {
            minSizeRatioSlider.addEventListener('input', (e) => {
                this.setMinSizeRatio(parseFloat(e.target.value));
            });
        } else { console.warn('Element #min-size-ratio-slider not found.'); }

        const pressureCurveSlider = document.getElementById('pressure-curve-slider');
        if (pressureCurveSlider) {
            pressureCurveSlider.addEventListener('input', (e) => {
                this.setCurve(parseFloat(e.target.value));
            });
        } else { console.warn('Element #pressure-curve-slider not found.'); }
    }
    setSize(size) {
        this.app.canvasManager.currentSize = size;
        const penSizeValue = document.getElementById('pen-size-value');
        if (penSizeValue) { // nullチェックを追加
            penSizeValue.textContent = size;
        }
    }
    setPressureSensitivity(enabled) {
        this.app.canvasManager.pressureSettings.dynamicRange = enabled;
        const pressureSettingsGroup = document.getElementById('pressure-settings-group');
        if (pressureSettingsGroup) { // nullチェックを追加
            pressureSettingsGroup.style.display = enabled ? 'block' : 'none';
        }
        this.app.canvasManager.renderAllLayers(); 
    }
    setSensitivity(sensitivity) {
        this.app.canvasManager.pressureSettings.sensitivity = sensitivity;
    }
    setMinSizeRatio(ratio) {
        this.app.canvasManager.pressureSettings.minSizeRatio = ratio;
    }
    setCurve(curve) {
        this.app.canvasManager.pressureSettings.curve = curve;
    }
}

class ColorManager {
    constructor(app) {
        this.app = app;
        this.mainColor = '#000000';
        this.subColor = '#FFFFFF';
        this.setupEventListeners();
    }
    setupEventListeners() {
        const mainColorPicker = document.getElementById('main-color-picker');
        if (mainColorPicker) {
            mainColorPicker.addEventListener('input', (e) => {
                this.setMainColor(e.target.value);
            });
        } else { console.warn('Element #main-color-picker not found.'); }

        const subColorPicker = document.getElementById('sub-color-picker');
        if (subColorPicker) {
            subColorPicker.addEventListener('input', (e) => {
                this.setSubColor(e.target.value);
            });
        } else { console.warn('Element #sub-color-picker not found.'); }

        const swapColorsBtn = document.getElementById('swap-colors-btn');
        if (swapColorsBtn) {
            swapColorsBtn.addEventListener('click', () => {
                this.swapColors();
            });
        } else { console.warn('Element #swap-colors-btn not found.'); }
    }
    setMainColor(color) {
        this.mainColor = color;
        this.setColor(color);
        const mainColorPicker = document.getElementById('main-color-picker');
        if (mainColorPicker) { // nullチェックを追加
            mainColorPicker.value = color;
        }
    }
    setSubColor(color) {
        this.subColor = color;
        const subColorPicker = document.getElementById('sub-color-picker');
        if (subColorPicker) { // nullチェックを追加
            subColorPicker.value = color;
        }
    }
    setColor(color) {
        this.app.canvasManager.currentColor = color;
    }
    swapColors() {
        const temp = this.mainColor;
        this.setMainColor(this.subColor);
        this.setSubColor(temp);
    }
}

class ToolManager {
    constructor(app) {
        this.app = app;
        this.setupEventListeners();
    }
    setupEventListeners() {
        const penTool = document.getElementById('pen-tool');
        if (penTool) {
            penTool.addEventListener('click', () => this.setTool('pen'));
        } else { console.warn('Element #pen-tool not found.'); }

        const eraserTool = document.getElementById('eraser-tool');
        if (eraserTool) {
            eraserTool.addEventListener('click', () => this.setTool('eraser'));
        } else { console.warn('Element #eraser-tool not found.'); }

        const bucketTool = document.getElementById('bucket-tool');
        if (bucketTool) {
            bucketTool.addEventListener('click', () => this.setTool('bucket'));
        } else { console.warn('Element #bucket-tool not found.'); }

        const moveTool = document.getElementById('move-tool');
        if (moveTool) {
            moveTool.addEventListener('click', () => this.setTool('move'));
        } else { console.warn('Element #move-tool not found.'); }
    }
    setTool(tool) {
        this.currentTool = tool;
        document.querySelectorAll('.left-toolbar .tool-btn').forEach(btn => btn.classList.remove('active'));
        const toolElement = document.getElementById(tool + '-tool');
        if (toolElement) { // nullチェックを追加
            toolElement.classList.add('active');
        }
        this.app.canvasManager.setCurrentTool(tool);
    }
}

class ToshinkaTegakiTool {
    constructor() {
        this.initManagers();
    }
    initManagers() {
        this.canvasManager = new CanvasManager(this);
        // CanvasManagerの初期化が失敗した場合（例: #drawingCanvasが見つからない）、それ以降の処理は無意味になる可能性がある
        if (!this.canvasManager || !this.canvasManager.displayCanvas) {
            console.error("CanvasManager failed to initialize. Aborting further manager initializations.");
            return;
        }

        this.layerManager = new LayerManager(this);
        this.penSettingsManager = new PenSettingsManager(this);
        this.colorManager = new ColorManager(this);
        this.toolManager = new ToolManager(this);
        this.topBarManager = new TopBarManager(this);
        this.shortcutManager = new ShortcutManager(this);
        this.layerUIManager = new LayerUIManager(this);
        this.bucketTool = new BucketTool(this);
        this.shortcutManager.initialize();
        this.layerManager.setupInitialLayers();
        this.toolManager.setTool('pen');
        this.penSettingsManager.setSize(1);
        this.colorManager.setColor(this.colorManager.mainColor);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    if (!window.toshinkaTegakiInitialized) {
        window.toshinkaTegaki = new ToshinkaTegakiTool();
        window.toshinkaTegakiInitialized = true;
    }
});