// Toshinka Tegaki Tool core.js v1.6 rev5 (ImageData-based)
// 改修担当: Gemini

// --- 【追加】行列計算ユーティリティ ---
// 座標計算を正確に行うために再導入
function invertMatrix(m) {
    const det = m[0] * m[3] - m[2] * m[1];
    if (det === 0) return null;
    const invDet = 1 / det;
    return [
        m[3] * invDet, -m[1] * invDet,
        -m[2] * invDet, m[0] * invDet,
        (m[2] * m[5] - m[3] * m[4]) * invDet,
        (m[1] * m[4] - m[0] * m[5]) * invDet
    ];
}
function applyMatrix(m, x, y) {
    return {
        x: m[0] * x + m[2] * y + m[4],
        y: m[1] * x + m[3] * y + m[5],
    };
}
function hexToRgba(hex) {
    const bigint = parseInt(hex.slice(1), 16);
    return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255, a: 255 };
}

// --- CanvasManager ---
class CanvasManager {
    constructor(app) {
        this.app = app;
        this.canvas = document.getElementById('drawingCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.tempCompositeCanvas = document.createElement('canvas');
        this.tempCompositeCanvas.width = this.canvas.width;
        this.tempCompositeCanvas.height = this.canvas.height;
        this.tempCompositeCtx = this.tempCompositeCanvas.getContext('2d');
        this.canvasArea = document.getElementById('canvas-area');
        this.canvasContainer = document.getElementById('canvas-container');

        this.isDrawing = false;
        this.isPanning = false;
        this.isLayerTransforming = false;
        this.isSpaceDown = false;
        this.isVDown = false;
        this.isShiftDown = false;
        this.isScalingRotatingLayer = false;
        this.isScalingRotatingCanvas = false;

        this.currentTool = 'pen';
        this.currentColor = '#800000';
        this.currentSize = 1;

        this.points = [];
        this.lastRenderedPointIndex = 0;
        this.animationFrameId = null;

        this.history = [];
        this.historyIndex = -1;

        this.dragStartX = 0;
        this.dragStartY = 0;
        this.canvasStartX = 0;
        this.canvasStartY = 0;

        this.moveLayerStartX = 0;
        this.moveLayerStartY = 0;
        this.moveLayerOriginalImageData = null;
        this.layerTransform = { translateX: 0, translateY: 0, scale: 1, rotation: 0, flipX: 1, flipY: 1 };
        this.originalLayerTransform = {};

        this.transform = { scale: 1, rotation: 0, flipX: 1, flipY: 1, left: 0, top: 0 };
        this.originalCanvasTransform = {};

        this.wheelTimeout = null;
        this.lastWheelTime = 0;
        this.wheelThrottle = 50;

        this.createAndDrawFrame();
        this.bindEvents();
    }
    
    renderAllLayers() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        for (const layer of this.app.layerManager.layers) {
            if (layer.visible) {
                this.tempCompositeCtx.putImageData(layer.imageData, 0, 0);
                this.ctx.drawImage(this.tempCompositeCanvas, 0, 0);
            }
        }
    }
    
    putPixel(layer, x, y, color, isEraser = false) {
        x = Math.floor(x);
        y = Math.floor(y);
        if (x < 0 || x >= layer.imageData.width || y < 0 || y >= layer.imageData.height) return;
        const index = (y * layer.imageData.width + x) * 4;
        const data = layer.imageData.data;
        if (isEraser) {
            data[index + 3] = 0;
        } else {
            data[index] = color.r;
            data[index + 1] = color.g;
            data[index + 2] = color.b;
            data[index + 3] = color.a;
        }
    }

    drawCircle(layer, cx, cy, radius, color, isEraser) {
        const r2 = radius * radius;
        for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
            for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
                const dx = x - cx;
                const dy = y - cy;
                if (dx * dx + dy * dy <= r2) {
                    this.putPixel(layer, x, y, color, isEraser);
                }
            }
        }
    }

    renderSmoothedLine(isFinal) {
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer || !this.points) return;
        
        const isEraser = this.currentTool === 'eraser';
        const colorRgba = isEraser ? null : hexToRgba(this.currentColor);
        
        const limit = isFinal ? this.points.length : this.points.length - 1;
        
        while (this.lastRenderedPointIndex < limit) {
            let p1, p2;
            if (this.lastRenderedPointIndex === 0) {
                 if (this.points.length === 1) { // 1点クリックの場合
                    p1 = this.points[0];
                    p2 = this.points[0];
                 } else {
                    p1 = this.points[0];
                    p2 = this.points[1];
                 }
            } else {
                p1 = this.points[this.lastRenderedPointIndex];
                p2 = this.points[this.lastRenderedPointIndex + 1];
            }
            if(!p2) p2 = p1;


            const dist = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
            const steps = Math.max(1, Math.ceil(dist));
            
            for (let i = 0; i < steps; i++) {
                const t = i / steps;
                const x = p1.x + (p2.x - p1.x) * t;
                const y = p1.y + (p2.y - p1.y) * t;
                const pressure = p1.pressure + (p2.pressure - p1.pressure) * t;
                const radius = Math.max(0.1, (this.currentSize * pressure) / 2);
                this.drawCircle(activeLayer, x, y, radius, colorRgba, isEraser);
            }
            
            if (this.lastRenderedPointIndex === 0 && this.points.length === 1) break;
            this.lastRenderedPointIndex++;
        }

        this.renderAllLayers();
    }

    onPointerDown(e) {
        if (e.button !== 0) return;
        if (this.isLayerTransforming) { this.commitLayerTransform(); }
        if (this.isVDown) {
            if (!this.isLayerTransforming) { this.startLayerTransform(); }
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
            if (this.isShiftDown) {
                this.isScalingRotatingLayer = true;
                this.originalLayerTransform = { ...this.layerTransform };
            } else {
                this.isScalingRotatingLayer = false;
                const coords = this.getCanvasCoordinates(e);
                this.moveLayerStartX = coords.x - this.layerTransform.translateX;
                this.moveLayerStartY = coords.y - this.layerTransform.translateY;
            }
            e.preventDefault();
            return;
        }
        if (this.isSpaceDown) {
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
            if (this.isShiftDown) {
                this.isScalingRotatingCanvas = true;
                this.originalCanvasTransform = { ...this.transform };
            } else {
                this.canvasStartX = this.transform.left;
                this.canvasStartY = this.transform.top;
                this.isPanning = true;
            }
            e.preventDefault();
            return;
        }
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer || this.app.layerManager.activeLayerIndex === 0) return;
        const coords = this.getCanvasCoordinates(e);
        if (this.currentTool === 'bucket') {
            this.fill(Math.floor(coords.x), Math.floor(coords.y), this.currentColor);
        } else {
            this.isDrawing = true;
            this.points = [];
            this.lastRenderedPointIndex = 0;
            this.points.push({ x: coords.x, y: coords.y, pressure: e.pressure === 0 ? 1.0 : e.pressure || 1.0 });
            this.renderSmoothedLine(true); // 点を打つ
            this.startSmoothDrawing();
        }
        try { document.documentElement.setPointerCapture(e.pointerId); } catch (err) {}
    }

    onPointerMove(e) {
        if (!e.buttons) return;
        if (this.isScalingRotatingCanvas) {
            const dx = e.clientX - this.dragStartX;
            const dy = e.clientY - this.dragStartY;
            this.transform.scale = Math.max(0.1, this.originalCanvasTransform.scale * (1 - dy * 0.005));
            this.transform.rotation = this.originalCanvasTransform.rotation + (dx * 0.5);
            this.applyTransform();
            return;
        }
        if (this.isPanning) {
            const dx = e.clientX - this.dragStartX;
            const dy = e.clientY - this.dragStartY;
            this.transform.left = this.canvasStartX + dx;
            this.transform.top = this.canvasStartY + dy;
            this.applyTransform();
            return;
        }
        if (this.isLayerTransforming) {
            if (this.isScalingRotatingLayer) {
                const dx = e.clientX - this.dragStartX;
                const dy = e.clientY - this.dragStartY;
                this.layerTransform.scale = Math.max(0.01, this.originalLayerTransform.scale * (1 - dy * 0.005));
                this.layerTransform.rotation = this.originalLayerTransform.rotation + (dx * 0.5 * Math.PI / 180);
            } else {
                const coords = this.getCanvasCoordinates(e);
                this.layerTransform.translateX = Math.round(coords.x - this.moveLayerStartX);
                this.layerTransform.translateY = Math.round(coords.y - this.moveLayerStartY);
            }
            this.applyLayerTransformPreview();
            return;
        }
        if (this.isDrawing) {
            const currentCoords = this.getCanvasCoordinates(e);
            this.points.push({ x: currentCoords.x, y: currentCoords.y, pressure: e.pressure === 0 ? 1.0 : e.pressure || 1.0 });
        }
    }
    
    onPointerUp(e) {
        if (e.button !== 0) return;
        try { if (document.documentElement.hasPointerCapture(e.pointerId)) { document.documentElement.releasePointerCapture(e.pointerId); } } catch (err) {}
        if (this.isDrawing) {
            this.isDrawing = false;
            this.stopSmoothDrawing();
            this.renderSmoothedLine(true);
            this.saveState();
            this.points = [];
        }
        if (this.isScalingRotatingLayer) this.isScalingRotatingLayer = false;
        if (this.isScalingRotatingCanvas) this.isScalingRotatingCanvas = false;
        if (this.isPanning) this.isPanning = false;
    }

    startSmoothDrawing() {
        this.lastRenderedPointIndex = 0;
        if (!this.animationFrameId) {
            this.animationFrameId = requestAnimationFrame(this.smoothDrawLoop.bind(this));
        }
    }
    stopSmoothDrawing() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }
    smoothDrawLoop() {
        if (this.isDrawing) {
            this.renderSmoothedLine(false);
            this.animationFrameId = requestAnimationFrame(this.smoothDrawLoop.bind(this));
        }
    }
    
    saveState() {
        const snapshot = this.app.layerManager.layers.map(layer => ({ name: layer.name, visible: layer.visible, imageData: this.app.layerManager.cloneImageData(layer.imageData) }));
        if (this.historyIndex < this.history.length - 1) { this.history = this.history.slice(0, this.historyIndex + 1); }
        this.history.push({ layers: snapshot, activeLayerIndex: this.app.layerManager.activeLayerIndex });
        this.historyIndex++;
    }
    undo() { if (this.historyIndex > 0) { this.historyIndex--; this.restoreState(this.history[this.historyIndex]); } }
    redo() { if (this.historyIndex < this.history.length - 1) { this.historyIndex++; this.restoreState(this.history[this.historyIndex]); } }
    restoreState(state) {
        this.app.layerManager.layers = state.layers.map(d => ({ name: d.name, visible: d.visible, imageData: this.app.layerManager.cloneImageData(d.imageData) }));
        this.app.layerManager.switchLayer(state.activeLayerIndex);
        this.renderAllLayers();
    }

    exportMergedImage() {
        const mergedCanvas = document.createElement('canvas');
        mergedCanvas.width = this.canvas.width;
        mergedCanvas.height = this.canvas.height;
        const mergedCtx = mergedCanvas.getContext('2d');
        this.app.layerManager.layers.forEach(layer => { if(layer.visible) { const t = document.createElement('canvas'); t.width = this.canvas.width; t.height = this.canvas.height; t.getContext('2d').putImageData(layer.imageData, 0, 0); mergedCtx.drawImage(t, 0, 0); } });
        const link = document.createElement('a');
        link.href = mergedCanvas.toDataURL('image/png');
        link.download = 'merged_image.png';
        link.click();
    }

    clearCanvas() {
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (activeLayer && this.app.layerManager.activeLayerIndex > 0) {
            activeLayer.imageData = new ImageData(activeLayer.imageData.width, activeLayer.imageData.height);
            this.renderAllLayers();
            this.saveState();
        }
    }

    clearAllLayers() {
        if (!confirm('すべてのレイヤーを消去しますか？\nこの操作は元に戻すのが難しい場合があります。')) return;
        this.app.layerManager.layers.forEach((layer, index) => {
            if (index === 0) { this.app.layerManager.fillImageData(layer.imageData, {r: 240, g: 224, b: 214, a: 255}); }
            else { layer.imageData = new ImageData(layer.imageData.width, layer.imageData.height); }
        });
        this.renderAllLayers();
        this.saveState();
    }
    
    fill(startX, startY, fillColor) {
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer || this.app.layerManager.activeLayerIndex === 0) return;
        const imageData = activeLayer.imageData;
        const { width, height, data } = imageData;
        const targetColor = hexToRgba(fillColor);
        const startIdx = (startY * width + startX) * 4;
        const startColor = [data[startIdx], data[startIdx+1], data[startIdx+2], data[startIdx+3]];
        if (startColor[0] === targetColor.r && startColor[1] === targetColor.g && startColor[2] === targetColor.b && startColor[3] === targetColor.a) return;
        const stack = [[startX, startY]];
        while (stack.length) {
            const [x, y] = stack.pop();
            if (x < 0 || x >= width || y < 0 || y >= height) continue;
            const idx = (y * width + x) * 4;
            if (data[idx] === startColor[0] && data[idx+1] === startColor[1] && data[idx+2] === startColor[2] && data[idx+3] === startColor[3]) {
                data[idx] = targetColor.r; data[idx+1] = targetColor.g; data[idx+2] = targetColor.b; data[idx+3] = targetColor.a;
                stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
            }
        }
        this.renderAllLayers();
        this.saveState();
    }

    startLayerTransform() {
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (this.isLayerTransforming || !activeLayer || this.app.layerManager.activeLayerIndex === 0) return;
        this.isLayerTransforming = true;
        this.moveLayerOriginalImageData = this.app.layerManager.cloneImageData(activeLayer.imageData);
        activeLayer.imageData = new ImageData(activeLayer.imageData.width, activeLayer.imageData.height);
        this.layerTransform = { translateX: 0, translateY: 0, scale: 1, rotation: 0, flipX: 1, flipY: 1 };
        this.renderAllLayers();
    }

    applyLayerTransformPreview() {
        if (!this.isLayerTransforming || !this.moveLayerOriginalImageData) return;
        this.renderAllLayers();
        const tempCanvas = this.tempCompositeCanvas;
        const tempCtx = this.tempCompositeCtx;
        tempCtx.clearRect(0,0,tempCanvas.width, tempCanvas.height);
        tempCtx.putImageData(this.moveLayerOriginalImageData, 0, 0);
        this.ctx.save();
        this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
        this.ctx.translate(this.layerTransform.translateX, this.layerTransform.translateY);
        this.ctx.rotate(this.layerTransform.rotation);
        this.ctx.scale(this.layerTransform.scale * this.layerTransform.flipX, this.layerTransform.scale * this.layerTransform.flipY);
        this.ctx.translate(-this.canvas.width / 2, -this.canvas.height / 2);
        this.ctx.drawImage(tempCanvas, 0, 0);
        this.ctx.restore();
    }
    
    commitLayerTransform() {
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!this.isLayerTransforming || !activeLayer) return;
        const tempCanvas = this.tempCompositeCanvas;
        const tempCtx = this.tempCompositeCtx;
        tempCtx.clearRect(0,0,tempCanvas.width, tempCanvas.height);
        tempCtx.save();
        tempCtx.translate(this.canvas.width / 2, this.canvas.height / 2);
        tempCtx.translate(this.layerTransform.translateX, this.layerTransform.translateY);
        tempCtx.rotate(this.layerTransform.rotation);
        tempCtx.scale(this.layerTransform.scale * this.layerTransform.flipX, this.layerTransform.scale * this.layerTransform.flipY);
        tempCtx.translate(-this.canvas.width / 2, -this.canvas.height / 2);
        const sourceCanvas = document.createElement('canvas');
        sourceCanvas.width = this.canvas.width;
        sourceCanvas.height = this.canvas.height;
        sourceCanvas.getContext('2d').putImageData(this.moveLayerOriginalImageData, 0, 0);
        tempCtx.drawImage(sourceCanvas, 0, 0);
        tempCtx.restore();
        activeLayer.imageData = tempCtx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        this.isLayerTransforming = false;
        this.moveLayerOriginalImageData = null;
        this.renderAllLayers();
        this.saveState();
    }
    
    bindEvents() {
        this.canvasArea.addEventListener('pointerdown', this.onPointerDown.bind(this));
        document.addEventListener('pointermove', this.onPointerMove.bind(this));
        document.addEventListener('pointerup', this.onPointerUp.bind(this));
        this.canvasArea.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
        document.addEventListener('contextmenu', e => e.preventDefault());
        this.canvasArea.addEventListener('mousedown', e => { if (e.button !== 0) e.preventDefault(); });
        const saveBtn = document.getElementById('saveMergedButton');
        if (saveBtn) { saveBtn.addEventListener('click', () => this.exportMergedImage()); }
    }
    setCurrentTool(tool) { this.currentTool = tool; this.updateCursor(); }
    setCurrentColor(color) { this.currentColor = color; }
    setCurrentSize(size) { this.currentSize = size; }
    
    /**
     * 【修正】反転・回転・拡縮に対応した正確な座標計算
     */
    getCanvasCoordinates(e) {
        const container = this.canvasContainer;
        const style = window.getComputedStyle(container);
        const transform = style.transform;

        let matrix = [1, 0, 0, 1, 0, 0];
        if (transform && transform !== 'none') {
            const matrixValues = transform.match(/matrix\((.+)\)/)[1].split(', ').map(parseFloat);
            matrix = matrixValues;
        }

        const parentRect = container.parentElement.getBoundingClientRect();
        const mouseX = e.clientX - parentRect.left;
        const mouseY = e.clientY - parentRect.top;

        const invMatrix = invertMatrix(matrix);
        if (!invMatrix) return { x: mouseX, y: mouseY };

        return applyMatrix(invMatrix, mouseX, mouseY);
    }
    
    updateCursor() {
        const cursor = this.isSpaceDown ? 'grab' : (this.isVDown ? 'move' : 'crosshair');
        this.canvasArea.style.cursor = cursor;
        this.canvas.style.cursor = cursor;
    }
    
    applyTransform() {
        this.canvasContainer.style.transform = `translate(${this.transform.left}px, ${this.transform.top}px) scale(${this.transform.scale * this.transform.flipX}, ${this.transform.scale * this.transform.flipY}) rotate(${this.transform.rotation}deg)`;
    }

    flipHorizontal() { this.transform.flipX *= -1; this.applyTransform(); }
    flipVertical() { this.transform.flipY *= -1; this.applyTransform(); }
    zoom(factor) { this.transform.scale = Math.max(0.1, Math.min(this.transform.scale * factor, 10)); this.applyTransform(); }
    rotate(degrees) { this.transform.rotation = (this.transform.rotation + degrees) % 360; this.applyTransform(); }
    resetView() { this.transform = { scale: 1, rotation: 0, flipX: 1, flipY: 1, left: 0, top: 0 }; this.applyTransform(); }
    
    handleWheel(e) {
        e.preventDefault();
        const now = Date.now();
        if (now - this.lastWheelTime < this.wheelThrottle) return;
        this.lastWheelTime = now;
        let deltaY = Math.max(-30, Math.min(30, e.deltaY));
        if (this.isVDown) {
            if (!this.isLayerTransforming) this.startLayerTransform();
            if (e.shiftKey) { this.layerTransform.rotation += (deltaY > 0 ? -5 : 5) * Math.PI / 180; }
            else { this.layerTransform.scale *= (deltaY > 0 ? 0.95 : 1.05); }
            this.applyLayerTransformPreview();
        } else {
            if (e.shiftKey) { this.rotate(-deltaY * 0.2); }
            else { this.zoom(deltaY > 0 ? 1 / 1.05 : 1.05); }
        }
    }

    createAndDrawFrame() {
        const frameCanvas = document.createElement('canvas');
        frameCanvas.width = 364; frameCanvas.height = 145;
        frameCanvas.style.cssText = 'position: absolute; left: -10px; top: -5px; z-index: -1; pointer-events: none;';
        this.canvasContainer.insertBefore(frameCanvas, this.canvas);
        const frameCtx = frameCanvas.getContext('2d');
        frameCtx.fillStyle = '#ffffff'; frameCtx.strokeStyle = '#cccccc'; frameCtx.lineWidth = 1;
        frameCtx.beginPath();
        if (frameCtx.roundRect) { frameCtx.roundRect(0.5, 0.5, 363, 144, 8); }
        else { frameCtx.rect(0.5, 0.5, 363, 144); }
        frameCtx.fill(); frameCtx.stroke();
    }
}

// --- LayerManager ---
class LayerManager {
    constructor(app) { this.app = app; this.layers = []; this.activeLayerIndex = -1; }
    setupInitialLayers() {
        const width = 344; const height = 135;
        const bgImageData = new ImageData(width, height);
        this.fillImageData(bgImageData, {r: 240, g: 224, b: 214, a: 255});
        this.layers.push({ name: '背景', imageData: bgImageData, visible: true });
        this.layers.push({ name: 'レイヤー 1', imageData: new ImageData(width, height), visible: true });
        this.switchLayer(1);
    }
    addLayer() {
        if (this.layers.length >= 99) return;
        const newImageData = new ImageData(344, 135);
        const insertIndex = this.activeLayerIndex + 1;
        this.layers.splice(insertIndex, 0, { name: '新規レイヤー', imageData: newImageData, visible: true });
        this.renameLayers();
        this.switchLayer(insertIndex);
        this.app.canvasManager.saveState();
    }
    deleteActiveLayer() {
        if (this.activeLayerIndex <= 0) return;
        this.layers.splice(this.activeLayerIndex, 1);
        this.renameLayers();
        this.switchLayer(Math.max(1, this.activeLayerIndex - 1));
        this.app.canvasManager.saveState();
    }
    duplicateActiveLayer() {
        const activeLayer = this.getCurrentLayer();
        if (!activeLayer || this.activeLayerIndex === 0) return;
        const newImageData = this.cloneImageData(activeLayer.imageData);
        const insertIndex = this.activeLayerIndex + 1;
        this.layers.splice(insertIndex, 0, { name: 'コピー', imageData: newImageData, visible: true });
        this.renameLayers();
        this.switchLayer(insertIndex);
        this.app.canvasManager.saveState();
    }
    mergeDownActiveLayer() {
        if (this.activeLayerIndex <= 0) return;
        const topLayer = this.getCurrentLayer();
        const bottomLayer = this.layers[this.activeLayerIndex - 1];
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 344; tempCanvas.height = 135;
        const ctx = tempCanvas.getContext('2d');
        ctx.putImageData(bottomLayer.imageData, 0, 0);
        ctx.drawImage( (() => { const c = document.createElement('canvas'); c.width=344; c.height=135; c.getContext('2d').putImageData(topLayer.imageData,0,0); return c; })(), 0, 0);
        bottomLayer.imageData = ctx.getImageData(0, 0, 344, 135);
        this.layers.splice(this.activeLayerIndex, 1);
        this.renameLayers();
        this.switchLayer(this.activeLayerIndex - 1);
        this.app.canvasManager.renderAllLayers();
        this.app.canvasManager.saveState();
    }
    switchLayer(index) {
        if (index < 0 || index >= this.layers.length) return;
        this.activeLayerIndex = index;
        if (this.app.layerUIManager) { this.app.layerUIManager.renderLayers(); }
        this.app.canvasManager.renderAllLayers();
    }
    cloneImageData(imageData) { return new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height); }
    fillImageData(imageData, color) { const data = imageData.data; for (let i = 0; i < data.length; i += 4) { data[i] = color.r; data[i+1] = color.g; data[i+2] = color.b; data[i+3] = color.a; } }
    renameLayers() { this.layers.forEach((layer, index) => { layer.name = (index === 0) ? '背景' : `レイヤー ${index}`; }); }
    getCurrentLayer() { return this.layers[this.activeLayerIndex] || null; }
}

// --- 他マネージャー ---
class PenSettingsManager {
    constructor(app) { this.app = app; this.currentSize = 1; this.sizes = [1, 3, 5, 10, 30]; this.currentSizeIndex = 0; this.bindEvents(); this.updateSizeButtonVisuals(); }
    bindEvents() { document.querySelectorAll('.size-btn').forEach(btn => btn.addEventListener('click', () => this.setSize(parseInt(btn.dataset.size)))); }
    setSize(size) { this.currentSize = size; this.currentSizeIndex = this.sizes.indexOf(size); document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active')); document.querySelector(`[data-size="${size}"]`)?.classList.add('active'); this.app.canvasManager.setCurrentSize(size); }
    changeSize(increase) { let newIndex = Math.max(0, Math.min(this.currentSizeIndex + (increase ? 1 : -1), this.sizes.length - 1)); this.setSize(this.sizes[newIndex]); }
    updateSizeButtonVisuals() { document.querySelectorAll('.size-btn').forEach(btn => { const size = parseInt(btn.dataset.size); btn.querySelector('.size-dot').style.width = `${Math.min(size,16)}px`; btn.querySelector('.size-dot').style.height = `${Math.min(size,16)}px`; btn.querySelector('.size-number').textContent = size; }); }
}
class ColorManager {
    constructor(app) { this.app = app; this.mainColor = '#800000'; this.subColor = '#f0e0d6'; this.colors = Array.from(document.querySelectorAll('.color-btn')).map(btn => btn.dataset.color); this.currentColorIndex = this.colors.indexOf(this.mainColor); this.mainColorDisplay = document.getElementById('main-color-display'); this.subColorDisplay = document.getElementById('sub-color-display'); this.bindEvents(); this.updateColorDisplays(); document.querySelector(`[data-color="${this.mainColor}"]`)?.classList.add('active'); }
    bindEvents() { document.querySelectorAll('.color-btn').forEach(btn => btn.addEventListener('click', e => this.setColor(e.currentTarget.dataset.color))); document.querySelector('.color-mode-display').addEventListener('click', () => this.swapColors()); }
    setColor(color) { this.mainColor = color; this.currentColorIndex = this.colors.indexOf(color); document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active')); document.querySelector(`[data-color="${color}"]`)?.classList.add('active'); this.updateColorDisplays(); this.app.canvasManager.setCurrentColor(color); }
    updateColorDisplays() { this.mainColorDisplay.style.backgroundColor = this.mainColor; this.subColorDisplay.style.backgroundColor = this.subColor; }
    swapColors() { [this.mainColor, this.subColor] = [this.subColor, this.mainColor]; this.updateColorDisplays(); this.setColor(this.mainColor); }
    resetColors() { this.setColor('#800000'); this.app.canvasManager.setCurrentColor('#800000'); }
    changeColor(increase) { let newIndex = (this.currentColorIndex + (increase ? 1 : -1) + this.colors.length) % this.colors.length; this.setColor(this.colors[newIndex]); }
}
class ToolManager {
    constructor(app) { this.app = app; this.currentTool = 'pen'; this.bindEvents(); }
    bindEvents() { document.querySelectorAll('.tool-btn[id$="-tool"]').forEach(btn => btn.addEventListener('click', () => this.setTool(btn.id.replace('-tool', '')))); }
    setTool(tool) { if (!['pen', 'eraser', 'bucket', 'move'].includes(tool)) return; this.currentTool = tool; document.querySelectorAll('.tools .tool-btn').forEach(b => b.classList.remove('active')); document.getElementById(tool + '-tool')?.classList.add('active'); this.app.canvasManager.setCurrentTool(tool); }
}

// --- メインアプリケーションクラス ---
class ToshinkaTegakiTool {
    constructor() {
        this.canvasManager = new CanvasManager(this);
        this.layerManager = new LayerManager(this);
        this.penSettingsManager = new PenSettingsManager(this);
        this.toolManager = new ToolManager(this);
        this.colorManager = new ColorManager(this);
        this.layerUIManager = null;

        this.layerManager.setupInitialLayers();
        this.toolManager.setTool('pen');
        this.penSettingsManager.setSize(1);
        this.colorManager.setColor(this.colorManager.mainColor);
        
        this.canvasManager.renderAllLayers();
        this.canvasManager.saveState();
    }
}

// --- アプリケーションの起動 ---
window.addEventListener('DOMContentLoaded', () => {
    if (!window.toshinkaTegakiInitialized) {
        window.toshinkaTegakiInitialized = true;
        window.toshinkaTegakiTool = new ToshinkaTegakiTool();
    }
});