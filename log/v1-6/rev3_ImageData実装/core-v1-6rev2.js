// Toshinka Tegaki Tool core.js v2.1 (Quality & Performance Update)

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
        this.isSpaceDown = false;
        this.isVDown = false; // Kept for shortcut manager compatibility
        this.isShiftDown = false;

        // Settings
        this.currentTool = 'pen';
        this.currentColor = '#800000';
        this.currentSize = 1;

        // Coordinates & History
        this.lastPoint = null;
        this.history = [];
        this.historyIndex = -1;

        // --- REV5: Performance Optimization ---
        this.dirtyRect = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
        this.animationFrameId = null;


        // Transform related
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.canvasStartX = 0;
        this.canvasStartY = 0;
        this.transform = { scale: 1, rotation: 0, flipX: 1, flipY: 1, left: 0, top: 0 };

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

    // --- Core Rendering with Dirty Rect Optimization ---
    renderAllLayers() {
        this.displayCtx.clearRect(0, 0, this.width, this.height);
        this.app.layerManager.layers.forEach(layer => {
            if (layer.visible) {
                this.offscreenCtx.putImageData(layer.imageData, 0, 0);
                this.displayCtx.drawImage(this.offscreenCanvas, 0, 0);
            }
        });
    }

    _renderDirty() {
        const rect = this.dirtyRect;
        if (rect.minX > rect.maxX) return; // No changes

        const margin = 3; // Margin for brush anti-aliasing
        const x = Math.max(0, Math.floor(rect.minX - margin));
        const y = Math.max(0, Math.floor(rect.minY - margin));
        const w = Math.min(this.width, Math.ceil(rect.maxX + margin)) - x;
        const h = Math.min(this.height, Math.ceil(rect.maxY + margin)) - y;

        if (w <= 0 || h <= 0) {
            this._resetDirtyRect();
            return;
        }

        try {
            // Rerender only the dirty region by clipping
            this.displayCtx.save();
            this.displayCtx.beginPath();
            this.displayCtx.rect(x, y, w, h);
            this.displayCtx.clip();
            this.renderAllLayers(); // Rerender all layers within the clipped region
            this.displayCtx.restore();
        } catch(e) {
            console.error("Dirty rendering failed, falling back to full render.", e);
            this.renderAllLayers();
        } finally {
            this._resetDirtyRect();
        }
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
        this.dirtyRect.minX = Math.min(this.dirtyRect.minX, x - radius);
        this.dirtyRect.minY = Math.min(this.dirtyRect.minY, y - radius);
        this.dirtyRect.maxX = Math.max(this.dirtyRect.maxX, x + radius);
        this.dirtyRect.maxY = Math.max(this.dirtyRect.maxY, y + radius);
    }

    _resetDirtyRect() {
        this.dirtyRect = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    }


    // --- Drawing Primitives on ImageData ---
    _blendPixel(imageData, x, y, color) {
        x = Math.floor(x);
        y = Math.floor(y);
        if (x < 0 || x >= imageData.width || y < 0 || y >= imageData.height) return;

        const index = (y * imageData.width + x) * 4;
        const data = imageData.data;

        const topAlpha = color.a / 255;
        if (topAlpha === 1) { // Opaque color, just overwrite
            data[index] = color.r;
            data[index + 1] = color.g;
            data[index + 2] = color.b;
            data[index + 3] = color.a;
            return;
        }

        const bottomAlpha = data[index + 3] / 255;
        const outAlpha = topAlpha + bottomAlpha * (1 - topAlpha);
        if (outAlpha === 0) return;

        data[index] = (color.r * topAlpha + data[index] * bottomAlpha * (1 - topAlpha)) / outAlpha;
        data[index+1] = (color.g * topAlpha + data[index+1] * bottomAlpha * (1 - topAlpha)) / outAlpha;
        data[index+2] = (color.b * topAlpha + data[index+2] * bottomAlpha * (1 - topAlpha)) / outAlpha;
        data[index+3] = outAlpha * 255;
    }

    _erasePixel(imageData, x, y, strength) {
        x = Math.floor(x);
        y = Math.floor(y);
        if (x < 0 || x >= imageData.width || y < 0 || y >= imageData.height) return;
        const index = (y * imageData.width + x) * 4;
        imageData.data[index + 3] = Math.max(0, imageData.data[index+3] * (1 - strength));
    }

    _drawCircle(imageData, centerX, centerY, radius, color, isEraser) {
        const rCeil = Math.ceil(radius);
        this._updateDirtyRect(centerX, centerY, rCeil);

        for (let y = -rCeil; y <= rCeil; y++) {
            for (let x = -rCeil; x <= rCeil; x++) {
                const distance = Math.sqrt(x * x + y * y);
                if (distance <= radius) {
                    const finalX = centerX + x;
                    const finalY = centerY + y;

                    // Anti-aliasing
                    const alphaMultiplier = Math.max(0, 1 - Math.max(0, distance - radius + 1));

                    if (isEraser) {
                        this._erasePixel(imageData, finalX, finalY, alphaMultiplier);
                    } else {
                        const finalColor = { ...color, a: Math.floor(color.a * alphaMultiplier) };
                        this._blendPixel(imageData, finalX, finalY, finalColor);
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

    _fill(imageData, startX, startY, color, tolerance = 2) {
        startX = Math.floor(startX);
        startY = Math.floor(startY);

        const width = imageData.width;
        const height = imageData.height;
        const data = imageData.data;

        const isColorSimilar = (c1_idx, c2) => {
            const dr = data[c1_idx] - c2[0];
            const dg = data[c1_idx + 1] - c2[1];
            const db = data[c1_idx + 2] - c2[2];
            const da = data[c1_idx + 3] - c2[3];
            return dr*dr + dg*dg + db*db + da*da <= tolerance * tolerance;
        };

        const getPixelIndex = (x, y) => (y * width + x) * 4;
        const startIdx = getPixelIndex(startX, startY);
        const startColor = [data[startIdx], data[startIdx+1], data[startIdx+2], data[startIdx+3]];
        
        if (isColorSimilar(startIdx, [color.r, color.g, color.b, color.a])) return;

        const stack = [[startX, startY]];
        const visited = new Set();
        visited.add(`${startX},${startY}`);
        
        this._resetDirtyRect();

        while (stack.length) {
            const [x, y] = stack.pop();
            const idx = getPixelIndex(x, y);

            if (isColorSimilar(idx, startColor)) {
                data[idx] = color.r;
                data[idx + 1] = color.g;
                data[idx + 2] = color.b;
                data[idx + 3] = color.a;
                this._updateDirtyRect(x,y,1);

                [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].forEach(([nx, ny]) => {
                    if (nx >= 0 && nx < width && ny >= 0 && ny < height && !visited.has(`${nx},${ny}`)) {
                        stack.push([nx, ny]);
                        visited.add(`${nx},${ny}`);
                    }
                });
            }
        }
    }


    // --- Event Handlers ---
    onPointerDown(e) {
        if (e.button !== 0) return;
        try {
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
                this.renderAllLayers(); // Fill requires a full immediate render
                this.saveState();
                return;
            }
            
            this.isDrawing = true;
            this.lastPoint = coords;

            // Improved pressure curve
            const pressure = e.pressure === 0 ? 1.0 : e.pressure || 1.0;
            const adjustedPressure = Math.pow(pressure, 0.7);
            const size = this.currentSize * adjustedPressure;
            
            this._drawCircle(
                activeLayer.imageData, 
                coords.x, coords.y, 
                size / 2, 
                hexToRgba(this.currentColor), 
                this.currentTool === 'eraser'
            );

            this._requestRender();
            document.documentElement.setPointerCapture(e.pointerId);
        } catch (err) {
            console.error("Error on PointerDown:", err);
            this.isDrawing = false;
        }
    }

    onPointerMove(e) {
        try {
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

            // Improved pressure curve
            const pressure = e.pressure === 0 ? 1.0 : e.pressure || 1.0;
            const adjustedPressure = Math.pow(pressure, 0.7);
            const size = this.currentSize * adjustedPressure;

            this._drawLine(
                activeLayer.imageData,
                this.lastPoint.x, this.lastPoint.y,
                coords.x, coords.y,
                size,
                hexToRgba(this.currentColor),
                this.currentTool === 'eraser'
            );

            this.lastPoint = coords;
            this._requestRender();
        } catch (err) {
            console.error("Error on PointerMove:", err);
            this.isDrawing = false;
        }
    }

    onPointerUp(e) {
        if (e.button !== 0) return;
        try {
            if (this.isDrawing) {
                this.isDrawing = false;
                
                // Final render to ensure everything is drawn
                if (this.animationFrameId) {
                    cancelAnimationFrame(this.animationFrameId);
                    this.animationFrameId = null;
                }
                this._renderDirty(); 

                this.lastPoint = null;
                this.saveState();
            }
            
            this.isPanning = false;
            document.documentElement.releasePointerCapture(e.pointerId);
        } catch (err) {
            console.error("Error on PointerUp:", err);
            if (document.documentElement.hasPointerCapture(e.pointerId)) {
                document.documentElement.releasePointerCapture(e.pointerId);
            }
        }
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

        this.history = this.history.slice(0, this.historyIndex + 1);
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
        
        this.app.layerManager.switchLayer(state.activeLayerIndex);
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

    flipHorizontal() { this.transform.flipX *= -1; this.applyTransform(); }
    flipVertical() { this.transform.flipY *= -1; this.applyTransform(); }
    zoom(factor) { this.transform.scale = Math.max(0.1, this.transform.scale * factor); this.applyTransform(); }
    rotate(degrees) { this.transform.rotation = (this.transform.rotation + degrees) % 360; this.applyTransform(); }
    resetView() { this.transform = { scale: 1, rotation: 0, flipX: 1, flipY: 1, left: 0, top: 0 }; this.applyTransform(); }

    handleWheel(e) {
        e.preventDefault();
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
        this.width = 344;
        this.height = 135;
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
        if (this.layers.length >= 99) { alert("レイヤー数の上限に達しました。"); return; }
        const insertIndex = this.activeLayerIndex + 1;
        const newLayer = new Layer(`レイヤー ${this.layers.length + 1}`, this.width, this.height);
        this.layers.splice(insertIndex, 0, newLayer);
        this.renameLayers();
        this.switchLayer(insertIndex);
        this.app.canvasManager.saveState();
    }
    
    deleteActiveLayer() {
        if (this.activeLayerIndex === 0) { alert('背景レイヤーは削除できません。'); return; }
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
        newLayer.imageData.data.set(activeLayer.imageData.data);
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
                bottomData[i+1] = (topData[i+1] * topAlpha + bottomData[i+1] * bottomAlpha * (1 - topAlpha)) / outAlpha;
                bottomData[i+2] = (topData[i+2] * topAlpha + bottomData[i+2] * bottomAlpha * (1 - topAlpha)) / outAlpha;
                bottomData[i + 3] = outAlpha * 255;
            }
        }
        this.layers.splice(this.activeLayerIndex, 1);
        this.switchLayer(this.activeLayerIndex - 1);
        this.app.canvasManager.renderAllLayers();
        this.app.canvasManager.saveState();
    }

    renameLayers() {
        this.layers.forEach((layer, index) => { layer.name = index === 0 ? '背景' : `レイヤー ${index}`; });
    }

    switchLayer(index) {
        if (index < 0 || index >= this.layers.length) return;
        this.activeLayerIndex = index;
        if (this.app.layerUIManager) {
            this.app.layerUIManager.renderLayers();
        }
    }

    getCurrentLayer() {
        return this.layers[this.activeLayerIndex] || null;
    }
}

// --- Other Managers (Unchanged functionality) ---
class PenSettingsManager {
    constructor(app) {
        this.app = app; this.currentSize = 1;
        this.sizes = Array.from(document.querySelectorAll('.size-btn')).map(btn => parseInt(btn.dataset.size));
        this.currentSizeIndex = this.sizes.indexOf(this.currentSize);
        this.bindEvents(); this.updateSizeButtonVisuals();
    }
    bindEvents() { document.querySelectorAll('.size-btn').forEach(btn => btn.addEventListener('click', () => this.setSize(parseInt(btn.dataset.size)))); }
    setSize(size) {
        this.currentSize = size; this.currentSizeIndex = this.sizes.indexOf(this.currentSize);
        document.querySelectorAll('.size-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-size="${size}"]`)?.classList.add('active');
        this.app.canvasManager.setCurrentSize(this.currentSize); this.updateSizeButtonVisuals();
    }
    changeSize(increase) { let newIndex = this.currentSizeIndex + (increase ? 1 : -1); newIndex = Math.max(0, Math.min(newIndex, this.sizes.length - 1)); this.setSize(this.sizes[newIndex]); }
    updateSizeButtonVisuals() { document.querySelectorAll('.size-btn').forEach(btn => { const size = parseInt(btn.dataset.size); btn.querySelector('.size-dot').style.width = `${Math.min(size, 16)}px`; btn.querySelector('.size-dot').style.height = `${Math.min(size, 16)}px`; btn.querySelector('.size-number').textContent = size; }); }
}
class ColorManager {
    constructor(app) {
        this.app = app; this.mainColor = '#800000'; this.subColor = '#f0e0d6';
        this.colors = Array.from(document.querySelectorAll('.color-btn')).map(btn => btn.dataset.color);
        this.currentColorIndex = this.colors.indexOf(this.mainColor); this.mainColorDisplay = document.getElementById('main-color-display'); this.subColorDisplay = document.getElementById('sub-color-display');
        this.bindEvents(); this.updateColorDisplays(); document.querySelector(`[data-color="${this.mainColor}"]`)?.classList.add('active');
    }
    bindEvents() { document.querySelectorAll('.color-btn').forEach(btn => btn.addEventListener('click', (e) => this.setColor(e.currentTarget.dataset.color))); document.querySelector('.color-mode-display').addEventListener('click', () => this.swapColors()); }
    setColor(color) {
        this.mainColor = color; this.currentColorIndex = this.colors.indexOf(this.mainColor);
        document.querySelectorAll('.color-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-color="${color}"]`)?.classList.add('active');
        this.updateColorDisplays(); this.app.canvasManager.setCurrentColor(this.mainColor);
    }
    updateColorDisplays() { this.mainColorDisplay.style.backgroundColor = this.mainColor; this.subColorDisplay.style.backgroundColor = this.subColor; }
    swapColors() { [this.mainColor, this.subColor] = [this.subColor, this.mainColor]; this.updateColorDisplays(); this.setColor(this.mainColor); }
    resetColors() { this.setColor('#800000'); this.subColor = '#f0e0d6'; this.updateColorDisplays(); }
    changeColor(increase) { let newIndex = this.currentColorIndex + (increase ? 1 : -1); newIndex = (newIndex + this.colors.length) % this.colors.length; this.setColor(this.colors[newIndex]); }
}
class ToolManager {
    constructor(app) {
        this.app = app; this.currentTool = 'pen';
        this.bindEvents();
    }
    bindEvents() { document.getElementById('pen-tool').addEventListener('click', () => this.setTool('pen')); document.getElementById('eraser-tool').addEventListener('click', () => this.setTool('eraser')); document.getElementById('bucket-tool').addEventListener('click', () => this.setTool('bucket')); document.getElementById('move-tool').addEventListener('click', () => this.app.canvasManager.updateCursor()); }
    setTool(tool) {
        this.currentTool = tool; document.querySelectorAll('.left-toolbar .tool-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(tool + '-tool')?.classList.add('active');
        this.app.canvasManager.setCurrentTool(tool);
    }
}

// --- Main Application Class ---
class ToshinkaTegakiTool {
    constructor() { this.initManagers(); }
    initManagers() {
        this.canvasManager = new CanvasManager(this);
        this.layerManager = new LayerManager(this);
        this.penSettingsManager = new PenSettingsManager(this);
        this.toolManager = new ToolManager(this);
        this.colorManager = new ColorManager(this);
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