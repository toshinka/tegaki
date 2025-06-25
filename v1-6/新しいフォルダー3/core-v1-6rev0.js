// Toshinka Tegaki Tool core.js v2.0 (ImageData-based engine)

// --- Utility Functions ---
function hexToRgba(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
        a: 255
    } : { r: 0, g: 0, b: 0, a: 255 };
}

// --- Layer Class (ImageData-based) ---
class Layer {
    constructor(name, width, height) {
        this.name = name;
        this.visible = true;
        this.imageData = new ImageData(width, height);
    }

    clear() {
        this.imageData.data.fill(0);
    }

    fill(hexColor) {
        const color = hexToRgba(hexColor);
        const data = this.imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            data[i] = color.r;
            data[i + 1] = color.g;
            data[i + 2] = color.b;
            data[i + 3] = color.a;
        }
    }
}

// --- CanvasManager (ImageData-based) ---
class CanvasManager {
    constructor(app) {
        this.app = app;

        // Display Canvas
        this.displayCanvas = document.getElementById('drawingCanvas');
        this.displayCtx = this.displayCanvas.getContext('2d', { willReadFrequently: true });
        this.canvasArea = document.getElementById('canvas-area');
        this.canvasContainer = document.getElementById('canvas-container');
        this.width = this.displayCanvas.width;
        this.height = this.displayCanvas.height;

        // Offscreen canvas for rendering layers correctly
        this.offscreenCanvas = document.createElement('canvas');
        this.offscreenCanvas.width = this.width;
        this.offscreenCanvas.height = this.height;
        this.offscreenCtx = this.offscreenCanvas.getContext('2d');


        // Drawing State
        this.isDrawing = false;
        this.isPanning = false;
        this.isLayerTransforming = false;
        this.isSpaceDown = false;
        this.isVDown = false;
        this.isShiftDown = false;
        this.isScalingRotatingLayer = false;
        this.isScalingRotatingCanvas = false;

        // Settings
        this.currentTool = 'pen';
        this.currentColor = '#800000';
        this.currentSize = 1;

        // Coordinates & History
        this.lastPoint = null;
        this.history = [];
        this.historyIndex = -1;

        // Transform related
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.canvasStartX = 0;
        this.canvasStartY = 0;
        this.transform = { scale: 1, rotation: 0, flipX: 1, flipY: 1, left: 0, top: 0 };

        // Layer transform (currently not supported with ImageData, but keeping structure)
        this.layerTransform = { translateX: 0, translateY: 0, scale: 1, rotation: 0, flipX: 1, flipY: 1 };


        // Event binding
        this.bindEvents();
    }

    bindEvents() {
        this.canvasArea.addEventListener('pointerdown', this.onPointerDown.bind(this));
        document.addEventListener('pointermove', this.onPointerMove.bind(this));
        document.addEventListener('pointerup', this.onPointerUp.bind(this));
        this.canvasArea.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
        document.addEventListener('contextmenu', e => e.preventDefault());
        this.canvasArea.addEventListener('mousedown', e => { if (e.button !== 0) e.preventDefault(); });

        document.getElementById('saveMergedButton')?.addEventListener('click', () => this.exportMergedImage());
    }

    // --- Core Rendering ---
    renderAllLayers() {
        this.displayCtx.clearRect(0, 0, this.width, this.height);
        this.app.layerManager.layers.forEach(layer => {
            if (layer.visible) {
                // Use an offscreen canvas to draw ImageData, which correctly handles transparency when drawn to the main canvas.
                this.offscreenCtx.putImageData(layer.imageData, 0, 0);
                this.displayCtx.drawImage(this.offscreenCanvas, 0, 0);
            }
        });
    }

    // --- Drawing Primitives on ImageData ---
    _setPixel(imageData, x, y, color) {
        x = Math.floor(x);
        y = Math.floor(y);
        if (x < 0 || x >= imageData.width || y < 0 || y >= imageData.height) return;
        const index = (y * imageData.width + x) * 4;
        imageData.data[index] = color.r;
        imageData.data[index + 1] = color.g;
        imageData.data[index + 2] = color.b;
        imageData.data[index + 3] = color.a;
    }

    _erasePixel(imageData, x, y) {
        x = Math.floor(x);
        y = Math.floor(y);
        if (x < 0 || x >= imageData.width || y < 0 || y >= imageData.height) return;
        const index = (y * imageData.width + x) * 4;
        imageData.data[index + 3] = 0; // Set alpha to 0
    }

    _drawCircle(imageData, centerX, centerY, radius, color, isEraser) {
        const r = Math.ceil(radius);
        for (let y = -r; y <= r; y++) {
            for (let x = -r; x <= r; x++) {
                if (x * x + y * y <= radius * radius) {
                    if (isEraser) {
                        this._erasePixel(imageData, centerX + x, centerY + y);
                    } else {
                        this._setPixel(imageData, centerX + x, centerY + y, color);
                    }
                }
            }
        }
    }

    _drawLine(imageData, x0, y0, x1, y1, size, color, isEraser) {
        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;

        while (true) {
            this._drawCircle(imageData, x0, y0, size / 2, color, isEraser);
            if (Math.abs(x0 - x1) < 1 && Math.abs(y0 - y1) < 1) break;
            const e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy;
                x0 += sx;
            }
            if (e2 < dx) {
                err += dx;
                y0 += sy;
            }
        }
    }

    _fill(imageData, startX, startY, color) {
        startX = Math.floor(startX);
        startY = Math.floor(startY);

        const width = imageData.width;
        const height = imageData.height;
        const data = imageData.data;

        const getPixel = (x, y) => {
            if (x < 0 || x >= width || y < 0 || y >= height) return [-1, -1, -1, -1];
            const i = (y * width + x) * 4;
            return [data[i], data[i+1], data[i+2], data[i+3]];
        };

        const startColor = getPixel(startX, startY);
        if (startColor[0] === color.r && startColor[1] === color.g && startColor[2] === color.b && startColor[3] === color.a) {
            return; // Clicked on same color
        }

        const stack = [[startX, startY]];
        while (stack.length) {
            const [x, y] = stack.pop();
            const currentColor = getPixel(x, y);

            if (currentColor[0] === startColor[0] && currentColor[1] === startColor[1] &&
                currentColor[2] === startColor[2] && currentColor[3] === startColor[3]) {
                
                const i = (y * width + x) * 4;
                data[i] = color.r;
                data[i + 1] = color.g;
                data[i + 2] = color.b;
                data[i + 3] = color.a;
                
                if (x > 0) stack.push([x - 1, y]);
                if (x < width - 1) stack.push([x + 1, y]);
                if (y > 0) stack.push([x, y - 1]);
                if (y < height - 1) stack.push([x, y + 1]);
            }
        }
    }


    // --- Event Handlers ---
    onPointerDown(e) {
        if (e.button !== 0) return;

        if (this.isSpaceDown) {
             this.dragStartX = e.clientX;
             this.dragStartY = e.clientY;
             this.isPanning = true;
             this.canvasStartX = this.transform.left;
             this.canvasStartY = this.transform.top;
             e.preventDefault();
             return;
        }

        const coords = this.getCanvasCoordinates(e);
        if (!coords) return;
        
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer || !activeLayer.visible) return;

        if (this.currentTool === 'bucket') {
            this._fill(activeLayer.imageData, coords.x, coords.y, hexToRgba(this.currentColor));
            this.renderAllLayers();
            this.saveState();
            return;
        }
        
        this.isDrawing = true;
        this.lastPoint = coords;

        const pressure = e.pressure === 0 ? 1.0 : e.pressure || 1.0;
        const size = this.currentSize * pressure;
        
        this._drawCircle(
            activeLayer.imageData, 
            coords.x, coords.y, 
            size / 2, 
            hexToRgba(this.currentColor), 
            this.currentTool === 'eraser'
        );

        this.renderAllLayers();
        try { document.documentElement.setPointerCapture(e.pointerId); } catch (err) {}
    }

    onPointerMove(e) {
        if (this.isPanning) {
            const dx = e.clientX - this.dragStartX;
            const dy = e.clientY - this.dragStartY;
            this.transform.left = this.canvasStartX + dx;
            this.transform.top = this.canvasStartY + dy;
            this.applyTransform();
            return;
        }

        if (!this.isDrawing) return;

        const coords = this.getCanvasCoordinates(e);
        if (!coords) return;
        
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer || !activeLayer.visible) return;

        const pressure = e.pressure === 0 ? 1.0 : e.pressure || 1.0;
        const size = this.currentSize * pressure;

        this._drawLine(
            activeLayer.imageData,
            this.lastPoint.x, this.lastPoint.y,
            coords.x, coords.y,
            size,
            hexToRgba(this.currentColor),
            this.currentTool === 'eraser'
        );

        this.lastPoint = coords;
        this.renderAllLayers();
    }

    onPointerUp(e) {
        if (e.button !== 0) return;
        
        if (this.isDrawing) {
            this.isDrawing = false;
            this.lastPoint = null;
            this.saveState();
        }
        
        this.isPanning = false;

        try {
            if (document.documentElement.hasPointerCapture(e.pointerId)) {
                document.documentElement.releasePointerCapture(e.pointerId);
            }
        } catch (err) {}
    }

    // --- History (Undo/Redo) ---
    saveState() {
        const state = {
            layers: this.app.layerManager.layers.map(layer => ({
                name: layer.name,
                visible: layer.visible,
                imageData: new ImageData(
                    new Uint8ClampedArray(layer.imageData.data),
                    layer.imageData.width,
                    layer.imageData.height
                )
            })),
            activeLayerIndex: this.app.layerManager.activeLayerIndex
        };

        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        this.history.push(state);
        this.historyIndex++;
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

    restoreState(state) {
        this.app.layerManager.layers = state.layers.map(layerData => {
            const layer = new Layer(layerData.name, layerData.imageData.width, layerData.imageData.height);
            layer.visible = layerData.visible;
            layer.imageData.data.set(layerData.imageData.data);
            return layer;
        });
        
        this.app.layerManager.switchLayer(state.activeLayerIndex); // This re-renders UI
        this.renderAllLayers();
    }

    // --- Tooling & View ---
    setCurrentTool(tool) { this.currentTool = tool; this.updateCursor(); }
    setCurrentColor(color) { this.currentColor = color; }
    setCurrentSize(size) { this.currentSize = size; }

    clearCanvas() {
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (activeLayer) {
            activeLayer.clear();
            if (this.app.layerManager.activeLayerIndex === 0) {
                activeLayer.fill('#f0e0d6');
            }
            this.renderAllLayers();
            this.saveState();
        }
    }
    
    clearAllLayers() {
        this.app.layerManager.layers.forEach((layer, index) => {
            layer.clear();
            if (index === 0) {
                layer.fill('#f0e0d6');
            }
        });
        this.renderAllLayers();
        this.saveState();
    }

    exportMergedImage() {
        const mergedCanvas = document.createElement('canvas');
        mergedCanvas.width = this.width;
        mergedCanvas.height = this.height;
        const mergedCtx = mergedCanvas.getContext('2d');

        this.app.layerManager.layers.forEach(layer => {
            if(layer.visible){
                this.offscreenCtx.putImageData(layer.imageData, 0, 0);
                mergedCtx.drawImage(this.offscreenCanvas, 0, 0);
            }
        });

        const dataURL = mergedCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = 'merged_image.png';
        link.click();
    }
    
    // --- Canvas Transform Logic (Preserved from v1.6) ---
    getCanvasCoordinates(e) {
        const containerRect = this.canvasContainer.getBoundingClientRect();
        const centerX = containerRect.left + containerRect.width / 2;
        const centerY = containerRect.top + containerRect.height / 2;
        let mouseX = e.clientX - centerX;
        let mouseY = e.clientY - centerY;
        const rad = -this.transform.rotation * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        let unrotatedX = mouseX * cos - mouseY * sin;
        let unrotatedY = mouseX * sin + mouseY * cos;
        let scaleX = this.transform.scale * this.transform.flipX;
        let scaleY = this.transform.scale * this.transform.flipY;
        const unscaledX = unrotatedX / scaleX;
        const unscaledY = unrotatedY / scaleY;
        const canvasX = unscaledX + this.width / 2;
        const canvasY = unscaledY + this.height / 2;
        return { x: canvasX, y: canvasY };
    }
    
    updateCursor() {
        let cursor = 'crosshair';
        if (this.isSpaceDown) cursor = 'grab';
        if (this.isVDown) cursor = 'move';
        this.canvasArea.style.cursor = cursor;
    }

    applyTransform() {
        const t = this.transform;
        this.canvasContainer.style.transform = `
            translate(${t.left}px, ${t.top}px)
            scale(${t.scale * t.flipX}, ${t.scale * t.flipY})
            rotate(${t.rotation}deg)
        `;
    }

    flipHorizontal() {
        this.transform.flipX *= -1;
        this.applyTransform();
    }

    flipVertical() {
        this.transform.flipY *= -1;
        this.applyTransform();
    }

    zoom(factor) {
        this.transform.scale = Math.max(0.1, Math.min(this.transform.scale * factor, 10));
        this.applyTransform();
    }

    rotate(degrees) {
        this.transform.rotation = (this.transform.rotation + degrees) % 360;
        this.applyTransform();
    }

    resetView() {
        this.transform = { scale: 1, rotation: 0, flipX: 1, flipY: 1, left: 0, top: 0 };
        this.applyTransform();
    }

    handleWheel(e) {
        e.preventDefault();
        // Preserving the existing wheel logic for view manipulation
        if (e.shiftKey) {
          const degrees = -e.deltaY * 0.2;
          this.rotate(degrees);
        } else {
            const zoomFactor = e.deltaY > 0 ? 1 / 1.05 : 1.05;
            this.zoom(zoomFactor);
        }
    }
}

// --- LayerManager (ImageData-based) ---
class LayerManager {
    constructor(app) {
        this.app = app;
        this.layers = [];
        this.activeLayerIndex = -1;
        this.width = 344; // Default canvas size
        this.height = 135; // Default canvas size
    }

    setupInitialLayers() {
        const bgLayer = new Layer('背景', this.width, this.height);
        bgLayer.fill('#f0e0d6');
        this.layers.push(bgLayer);

        const drawingLayer = new Layer('レイヤー 1', this.width, this.height);
        this.layers.push(drawingLayer);

        this.switchLayer(1);
        this.app.canvasManager.renderAllLayers();
        this.app.canvasManager.saveState();
    }
    
    addLayer() {
        if (this.layers.length >= 99) {
            alert("レイヤー数の上限に達しました。");
            return;
        }
        const insertIndex = this.activeLayerIndex + 1;
        const newLayer = new Layer(`レイヤー ${this.layers.length + 1}`, this.width, this.height);
        this.layers.splice(insertIndex, 0, newLayer);
        this.renameLayers();
        this.switchLayer(insertIndex);
        this.app.canvasManager.saveState();
    }
    
    deleteActiveLayer() {
        if (this.activeLayerIndex === 0) {
            alert('背景レイヤーは削除できません。');
            return;
        }
        if (this.layers.length <= 1) return;

        this.layers.splice(this.activeLayerIndex, 1);
        const newActiveIndex = Math.min(this.layers.length - 1, this.activeLayerIndex);
        this.renameLayers();
        this.switchLayer(newActiveIndex);
        this.app.canvasManager.renderAllLayers();
        this.app.canvasManager.saveState();
    }

    duplicateActiveLayer() {
        const activeLayer = this.getCurrentLayer();
        if (!activeLayer) return;
        
        const newLayer = new Layer(`${activeLayer.name}のコピー`, this.width, this.height);
        newLayer.imageData.data.set(activeLayer.imageData.data); // Deep copy
        newLayer.visible = activeLayer.visible;
        
        const insertIndex = this.activeLayerIndex + 1;
        this.layers.splice(insertIndex, 0, newLayer);
        
        this.renameLayers();
        this.switchLayer(insertIndex);
        this.app.canvasManager.saveState();
    }

    mergeDownActiveLayer() {
        if (this.activeLayerIndex <= 0) return;

        const topLayer = this.layers[this.activeLayerIndex];
        const bottomLayer = this.layers[this.activeLayerIndex - 1];

        const topData = topLayer.imageData.data;
        const bottomData = bottomLayer.imageData.data;

        for (let i = 0; i < topData.length; i += 4) {
            const topAlpha = topData[i + 3] / 255;
            if (topAlpha === 0) continue;

            const bottomAlpha = bottomData[i + 3] / 255;
            const outAlpha = topAlpha + bottomAlpha * (1 - topAlpha);

            if (outAlpha > 0) {
                bottomData[i] = (topData[i] * topAlpha + bottomData[i] * bottomAlpha * (1 - topAlpha)) / outAlpha;
                bottomData[i + 1] = (topData[i + 1] * topAlpha + bottomData[i + 1] * bottomAlpha * (1 - topAlpha)) / outAlpha;
                bottomData[i + 2] = (topData[i + 2] * topAlpha + bottomData[i + 2] * bottomAlpha * (1 - topAlpha)) / outAlpha;
                bottomData[i + 3] = outAlpha * 255;
            }
        }

        this.layers.splice(this.activeLayerIndex, 1);
        this.switchLayer(this.activeLayerIndex - 1);
        this.app.canvasManager.renderAllLayers();
        this.app.canvasManager.saveState();
    }

    renameLayers() {
        this.layers.forEach((layer, index) => {
            layer.name = index === 0 ? '背景' : `レイヤー ${index}`;
        });
    }

    switchLayer(index) {
        if (index < 0 || index >= this.layers.length) return;
        this.activeLayerIndex = index;
        if (this.app.layerUIManager) {
            this.app.layerUIManager.renderLayers();
        }
    }

    getCurrentLayer() {
        if (this.activeLayerIndex >= 0 && this.activeLayerIndex < this.layers.length) {
            return this.layers[this.activeLayerIndex];
        }
        return null;
    }
}

// --- Other Managers (Unchanged functionality) ---
class PenSettingsManager {
    constructor(app) {
        this.app = app;
        this.currentSize = 1;
        this.sizes = Array.from(document.querySelectorAll('.size-btn')).map(btn => parseInt(btn.dataset.size));
        this.currentSizeIndex = this.sizes.indexOf(this.currentSize);
        this.bindEvents();
        this.updateSizeButtonVisuals();
    }
    bindEvents() {
        document.querySelectorAll('.size-btn').forEach(btn => {
            btn.addEventListener('click', () => this.setSize(parseInt(btn.dataset.size)));
        });
    }
    setSize(size) {
        this.currentSize = size;
        this.currentSizeIndex = this.sizes.indexOf(this.currentSize);
        document.querySelectorAll('.size-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-size="${size}"]`)?.classList.add('active');
        this.app.canvasManager.setCurrentSize(this.currentSize);
        this.updateSizeButtonVisuals();
    }
    changeSize(increase) {
        let newIndex = this.currentSizeIndex + (increase ? 1 : -1);
        newIndex = Math.max(0, Math.min(newIndex, this.sizes.length - 1));
        this.setSize(this.sizes[newIndex]);
    }
    updateSizeButtonVisuals() {
        document.querySelectorAll('.size-btn').forEach(btn => {
            const size = parseInt(btn.dataset.size);
            btn.querySelector('.size-dot').style.width = `${Math.min(size, 16)}px`;
            btn.querySelector('.size-dot').style.height = `${Math.min(size, 16)}px`;
            btn.querySelector('.size-number').textContent = size;
        });
    }
}

class ColorManager {
    constructor(app) {
        this.app = app;
        this.mainColor = '#800000';
        this.subColor = '#f0e0d6';
        this.colors = Array.from(document.querySelectorAll('.color-btn')).map(btn => btn.dataset.color);
        this.currentColorIndex = this.colors.indexOf(this.mainColor);
        this.mainColorDisplay = document.getElementById('main-color-display');
        this.subColorDisplay = document.getElementById('sub-color-display');
        this.bindEvents();
        this.updateColorDisplays();
        document.querySelector(`[data-color="${this.mainColor}"]`)?.classList.add('active');
    }
    bindEvents() {
        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.setColor(e.currentTarget.dataset.color));
        });
        document.querySelector('.color-mode-display').addEventListener('click', () => this.swapColors());
    }
    setColor(color) {
        this.mainColor = color;
        this.currentColorIndex = this.colors.indexOf(this.mainColor);
        document.querySelectorAll('.color-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-color="${color}"]`)?.classList.add('active');
        this.updateColorDisplays();
        this.app.canvasManager.setCurrentColor(this.mainColor);
    }
    updateColorDisplays() {
        this.mainColorDisplay.style.backgroundColor = this.mainColor;
        this.subColorDisplay.style.backgroundColor = this.subColor;
    }
    swapColors() {
        [this.mainColor, this.subColor] = [this.subColor, this.mainColor];
        this.updateColorDisplays();
        this.setColor(this.mainColor);
    }
    resetColors() {
        this.setColor('#800000');
        this.subColor = '#f0e0d6';
        this.updateColorDisplays();
    }
    changeColor(increase) {
        let newIndex = this.currentColorIndex + (increase ? 1 : -1);
        newIndex = (newIndex + this.colors.length) % this.colors.length;
        this.setColor(this.colors[newIndex]);
    }
}

class ToolManager {
    constructor(app) {
        this.app = app;
        this.currentTool = 'pen';
        this.bindEvents();
    }
    bindEvents() {
        document.getElementById('pen-tool').addEventListener('click', () => this.setTool('pen'));
        document.getElementById('eraser-tool').addEventListener('click', () => this.setTool('eraser'));
        document.getElementById('bucket-tool').addEventListener('click', () => this.setTool('bucket'));
        document.getElementById('move-tool').addEventListener('click', () => this.setTool('move'));
    }
    setTool(tool) {
        this.currentTool = tool;
        document.querySelectorAll('.left-toolbar .tool-btn').forEach(btn => btn.classList.remove('active'));
        const toolButton = document.getElementById(tool + '-tool');
        if(toolButton) toolButton.classList.add('active');
        this.app.canvasManager.setCurrentTool(tool);
    }
}

// --- Main Application Class ---
class ToshinkaTegakiTool {
    constructor() {
        this.initManagers();
    }
    initManagers() {
        this.canvasManager = new CanvasManager(this);
        this.layerManager = new LayerManager(this);
        this.penSettingsManager = new PenSettingsManager(this);
        this.toolManager = new ToolManager(this);
        this.colorManager = new ColorManager(this);
        
        // Initialization sequence
        this.layerManager.setupInitialLayers();
        this.toolManager.setTool('pen');
        this.penSettingsManager.setSize(1);
        this.colorManager.setColor(this.colorManager.mainColor);
    }
}

// --- Global Initializer ---
window.addEventListener('DOMContentLoaded', () => {
    if (!window.toshinkaTegakiInitialized) {
        window.toshinkaTegakiInitialized = true;
        window.toshinkaTegakiTool = new ToshinkaTegakiTool();
    }
});