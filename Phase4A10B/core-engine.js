/*
 * ===================================================================================
 * Toshinka Tegaki Tool - Core Engine
 * Version: 3.6.0 (Coordinate & Color Fix)
 *
 * - 修正：
 * - 1. 【座標系の完全統一】
 * -   - WebGL側のY-down座標系への統一に伴い、レイヤー変形行列の計算もY-downに修正。
 * -     updateLayerMatrix内の射影行列を、Y軸が下向きになるように変更した。
 * -     これにより、レイヤー変形と描画の座標系が完全に一致し、ズレが解消される。
 * - 2. 【画像エクスポート時の色化け修正】
 * -   - WebGLのreadPixelsから取得した乗算済みアルファのピクセルを、
 * -     通常アルファに変換する際の計算を、値が飽和しない安全な方式に変更。
 * -     これにより、エクスポートした画像が赤くなる問題を解消した。
 * ===================================================================================
 */

// --- Module Imports ---
import { TopBarManager, LayerUIManager } from './ui/ui-manager.js';
import { ShortcutManager } from './ui/shortcut-manager.js';
import { BucketTool } from './tools/toolset.js';
import { RenderingBridge } from './core/rendering/rendering-bridge.js';

// --- Core Logic Classes ---

function hexToRgba(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
        a: 255
    } : { r: 0, g: 0, b: 0, a: 255 };
}

class Layer {
    constructor(name, width, height) {
        this.name = name;
        this.visible = true;
        this.opacity = 100;
        this.blendMode = 'normal';
        this.imageData = new ImageData(width, height);
        this.transform = { x: 0, y: 0, scale: 1, rotation: 0, flipX: 1, flipY: 1 };
        this.modelMatrix = glMatrix.mat4.create();
        this.mvpMatrix = glMatrix.mat4.create();
        this.gpuDirty = true;
    }
    clear() { this.imageData.data.fill(0); this.gpuDirty = true; }
    fill(hexColor) {
        const color = hexToRgba(hexColor);
        const data = this.imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            data[i] = color.r; data[i + 1] = color.g; data[i + 2] = color.b; data[i + 3] = color.a;
        }
        this.gpuDirty = true;
    }
}

class CanvasManager {
    constructor(app) {
        this.app = app;
        this.displayCanvas = document.getElementById('drawingCanvas'); 
        this.displayCtx = this.displayCanvas.getContext('2d', { willReadFrequently: true });
        this.canvasArea = document.getElementById('canvas-area');
        this.canvasContainer = document.getElementById('canvas-container');
        this.width = this.displayCanvas.width;
        this.height = this.displayCanvas.height;
        this.renderingBridge = new RenderingBridge(this.displayCanvas);
        this.compositionData = new ImageData(this.width, this.height);
        this.isDrawing = false; this.isPanning = false; this.isSpaceDown = false;
        this.isVDown = false; this.isShiftDown = false;
        this.isLayerTransforming = false;
        this.transformTargetLayer = null;
        this.originalLayerTransform = null;
        this.transformMode = 'move'; this.transformStartX = 0; this.transformStartY = 0;
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
        this.canvasArea.addEventListener('pointerdown', this.onPointerDown.bind(this));
        document.addEventListener('pointermove', this.onPointerMove.bind(this));
        document.addEventListener('pointerup', this.onPointerUp.bind(this));
        this.canvasArea.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
        document.addEventListener('contextmenu', e => e.preventDefault());
        document.getElementById('saveMergedButton')?.addEventListener('click', () => this.exportMergedImage());
    }

    onPointerDown(e) {
        if (e.button !== 0) return;
        const canvasCoords = this.getCanvasCoordinates(e);
        if (this.isVDown) { this.startLayerTransform(e); e.preventDefault(); return; }
        if (this.isSpaceDown) {
            this.dragStartX = e.clientX; this.dragStartY = e.clientY; this.isPanning = true;
            this.canvasStartX = this.viewTransform.left; this.canvasStartY = this.viewTransform.top;
            e.preventDefault(); return;
        }
        if (!canvasCoords) return;
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer || !activeLayer.visible) return;
        
        const layerCoords = this.convertCanvasToLayerCoords(canvasCoords, activeLayer);
        if (!layerCoords) return;

        this._resetDirtyRect();
        if (this.currentTool === 'bucket') {
            this.app.bucketTool.fill(activeLayer.imageData, layerCoords.x, layerCoords.y, hexToRgba(this.currentColor));
            activeLayer.gpuDirty = true;
            this.renderAllLayers();
            this.saveState();
            return;
        }
        this.isDrawing = true;
        this.pressureHistory = [e.pressure > 0 ? e.pressure : 0.5];
        this.lastPoint = { ...layerCoords, pressure: this.pressureHistory[0] };
        const size = this.calculatePressureSize(this.currentSize, this.lastPoint.pressure);
        this._updateDirtyRect(layerCoords.x, layerCoords.y, size);
        this.renderingBridge.drawCircle(
            layerCoords.x, layerCoords.y, size / 2, 
            hexToRgba(this.currentColor), this.currentTool === 'eraser',
            activeLayer
        );
        this._requestRender();
        document.documentElement.setPointerCapture(e.pointerId);
    }
    
    onPointerMove(e) {
        if (this.isLayerTransforming) {
            const dx = e.clientX - this.transformStartX; const dy = e.clientY - this.transformStartY;
            const t = this.transformTargetLayer.transform; const ot = this.originalLayerTransform;
            if (this.transformMode === 'move') {
                t.x = ot.x + dx / this.viewTransform.scale;
                t.y = ot.y + dy / this.viewTransform.scale;
            } else {
                t.rotation = ot.rotation + dx * 0.5;
                const scaleFactor = 1 - dy * 0.005; t.scale = Math.max(0.1, ot.scale * scaleFactor);
            }
            this.applyLayerTransformPreview(); return;
        }
        if (this.isPanning) {
            const dx = e.clientX - this.dragStartX; const dy = e.clientY - this.dragStartY;
            this.viewTransform.left = this.canvasStartX + dx; this.viewTransform.top = this.canvasStartY + dy;
            this.applyViewTransform(); return;
        }
        if (!this.isDrawing) return;
        const canvasCoords = this.getCanvasCoordinates(e);
        if (!canvasCoords) { this.lastPoint = null; return; }
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer || !activeLayer.visible) return;

        const layerCoords = this.convertCanvasToLayerCoords(canvasCoords, activeLayer);
        if (!layerCoords) { this.lastPoint = null; return; }
        
        if (!this.lastPoint) { 
            this.pressureHistory = [e.pressure > 0 ? e.pressure : 0.5];
            this.lastPoint = { ...layerCoords, pressure: e.pressure > 0 ? e.pressure : 0.5 }; 
            return;
        }
        const currentPressure = e.pressure > 0 ? e.pressure : 0.5;
        this.pressureHistory.push(currentPressure);
        if (this.pressureHistory.length > this.maxPressureHistory) { this.pressureHistory.shift(); }
        const lastSize = this.calculatePressureSize(this.currentSize, this.lastPoint.pressure);
        const currentSize = this.calculatePressureSize(this.currentSize, currentPressure);
        this._updateDirtyRect(this.lastPoint.x, this.lastPoint.y, lastSize);
        this._updateDirtyRect(layerCoords.x, layerCoords.y, currentSize);
        this.renderingBridge.drawLine(
            this.lastPoint.x, this.lastPoint.y, layerCoords.x, layerCoords.y,
            this.currentSize, hexToRgba(this.currentColor), this.currentTool === 'eraser',
            this.lastPoint.pressure, currentPressure, 
            this.calculatePressureSize.bind(this),
            activeLayer
        );
        this.lastPoint = { ...layerCoords, pressure: currentPressure };
        this._requestRender();
    }
    
    onPointerUp(e) {
        if (this.isLayerTransforming) { this.commitLayerTransform(); }
        if (this.isDrawing) {
            this.isDrawing = false;
            if (this.animationFrameId) { cancelAnimationFrame(this.animationFrameId); this.animationFrameId = null; }
            this._renderDirty();
            const activeLayer = this.app.layerManager.getCurrentLayer();
            if (activeLayer) { this.renderingBridge.syncDirtyRectToImageData(activeLayer, this.dirtyRect); }
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
    
    _resetDirtyRect() { this.dirtyRect = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }; }

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
            if (range > 0.1) { finalPressure = (finalPressure - minHist) / range; }
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
            let x = (e.clientX - rect.left) * (this.width / rect.width);
            let y = (e.clientY - rect.top) * (this.height / rect.height);
            if (this.viewTransform.flipX === -1) { x = this.width - x; }
            if (this.viewTransform.flipY === -1) { y = this.height - y; }
            return { x: x, y: y };
        } catch (error) { console.warn('座標変換エラー:', error); return null; }
    }

    convertCanvasToLayerCoords(canvasCoords, layer) {
        if (!layer) return canvasCoords;

        const invModelMatrix = glMatrix.mat4.create();
        glMatrix.mat4.invert(invModelMatrix, layer.modelMatrix);

        const point = [canvasCoords.x, canvasCoords.y, 0];
        const transformedPoint = glMatrix.vec3.create();
        glMatrix.vec3.transformMat4(transformedPoint, point, invModelMatrix);
        
        const [x, y] = transformedPoint;
        
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return null;
        }
        return { x, y };
    }

    updateLayerMatrix(layer) {
        const t = layer.transform;
        const model = layer.modelMatrix;
        const mvp = layer.mvpMatrix;
        
        glMatrix.mat4.identity(model);
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        const angle = t.rotation * Math.PI / 180;
        const sx = t.scale * t.flipX;
        const sy = t.scale * t.flipY;

        glMatrix.mat4.translate(model, model, [t.x, t.y, 0]);
        glMatrix.mat4.translate(model, model, [centerX, centerY, 0]);
        glMatrix.mat4.rotateZ(model, model, angle);
        glMatrix.mat4.scale(model, model, [sx, sy, 1]);
        glMatrix.mat4.translate(model, model, [-centerX, -centerY, 0]);

        const projection = glMatrix.mat4.create();
        // Y軸が下向きのY-down座標系（左上原点）で統一
        glMatrix.mat4.ortho(projection, 0, this.width, this.height, 0, -1, 1);
        
        glMatrix.mat4.multiply(mvp, projection, model);
    }

    startLayerTransform(e = null) {
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer || this.app.layerManager.layers.indexOf(activeLayer) === 0) return;
        this.isLayerTransforming = true;
        this.transformTargetLayer = activeLayer;
        this.originalLayerTransform = { ...this.transformTargetLayer.transform };
        if (e) {
            this.transformMode = this.isShiftDown ? 'rotate_scale' : 'move';
            this.transformStartX = e.clientX;
            this.transformStartY = e.clientY;
        }
    }
    
    applyLayerTransformPreview() {
        if (!this.transformTargetLayer) return;
        this.updateLayerMatrix(this.transformTargetLayer);
        this.renderAllLayers();
    }

    commitLayerTransform() {
        if (!this.isLayerTransforming) return;
        if (this.transformTargetLayer) {
            this.transformTargetLayer.gpuDirty = true;
        }
        this.isLayerTransforming = false;
        this.transformTargetLayer = null;
        this.originalLayerTransform = null;
        this.renderAllLayers();
        this.saveState();
    }

    saveState() {
        if(this.isLayerTransforming) return;
        const state = {
            layers: this.app.layerManager.layers.map(layer => ({
                name: layer.name, visible: layer.visible, opacity: layer.opacity,
                blendMode: layer.blendMode,
                imageData: new ImageData( new Uint8ClampedArray(layer.imageData.data), layer.imageData.width, layer.imageData.height ),
                transform: { ...layer.transform } 
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
            if (layerData.transform) { layer.transform = { ...layerData.transform }; }
            this.updateLayerMatrix(layer);
            layer.gpuDirty = true;
            return layer;
        });
        this.app.layerManager.switchLayer(state.activeLayerIndex);
        this.renderAllLayers();
    }

    undo() { if (this.historyIndex > 0) { this.historyIndex--; this.restoreState(this.history[this.historyIndex]); } }
    redo() { if (this.historyIndex < this.history.length - 1) { this.historyIndex++; this.restoreState(this.history[this.historyIndex]); } }
    setCurrentTool(tool) { this.currentTool = tool; this.updateCursor(); }
    setCurrentColor(color) { this.currentColor = color; }
    setCurrentSize(size) { this.currentSize = size; }
    clearCanvas() {
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (activeLayer) {
            activeLayer.clear();
            if (this.app.layerManager.activeLayerIndex === 0) { activeLayer.fill('#f0e0d6'); }
            this.renderAllLayers();
            this.saveState();
        }
    }

    exportMergedImage() {
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = this.width; exportCanvas.height = this.height;
        const exportCtx = exportCanvas.getContext('2d');
        const fullRect = { minX: 0, minY: 0, maxX: this.width, maxY: this.height };
        this.renderingBridge.compositeLayers(this.app.layerManager.layers, this.compositionData, fullRect);
        const gl = this.renderingBridge.engines['webgl']?.gl;
        if (gl && this.renderingBridge.currentEngineType === 'webgl') {
             const pixels = new Uint8Array(this.width * this.height * 4);
             this.renderingBridge.renderToDisplay(null, fullRect);
             gl.readPixels(0, 0, this.width, this.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

             // 乗算済みアルファから通常アルファへの安全な変換
             for (let i = 0; i < pixels.length; i += 4) {
                const a = pixels[i + 3];
                if (a > 0 && a < 255) {
                    const factor = 255.0 / a;
                    pixels[i]   = Math.min(255, Math.round(pixels[i]   * factor));
                    pixels[i+1] = Math.min(255, Math.round(pixels[i+1] * factor));
                    pixels[i+2] = Math.min(255, Math.round(pixels[i+2] * factor));
                }
             }

             // Y軸反転処理：WebGL(左下原点)とCanvas2D(左上原点)の違いを吸収
             const correctedPixels = new Uint8ClampedArray(this.width * this.height * 4);
             for (let y = 0; y < this.height; y++) {
                 const s = y * this.width * 4;
                 const d = (this.height - 1 - y) * this.width * 4;
                 correctedPixels.set(pixels.subarray(s, s + this.width * 4), d);
             }
             const finalImageData = new ImageData(correctedPixels, this.width, this.height);
             exportCtx.putImageData(finalImageData, 0, 0);
        } else { 
            exportCtx.putImageData(this.compositionData, 0, 0); 
        }
        const dataURL = exportCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = dataURL; link.download = 'merged_image.png'; link.click();
    }
    updateCursor() { let cursor = 'crosshair'; if (this.isVDown) cursor = 'move'; if (this.isSpaceDown) cursor = 'grab'; if (this.currentTool === 'eraser') cursor = 'cell'; if (this.currentTool === 'bucket') cursor = 'copy'; this.canvasArea.style.cursor = cursor; }
    applyViewTransform() { const t = this.viewTransform; this.canvasContainer.style.transform = `translate(${t.left}px, ${t.top}px) scale(${t.scale * t.flipX}, ${t.scale * t.flipY}) rotate(${t.rotation}deg)`; }
    flipHorizontal() { this.viewTransform.flipX *= -1; this.applyViewTransform(); }
    flipVertical() { this.viewTransform.flipY *= -1; this.applyViewTransform(); }
    zoom(factor) { this.viewTransform.scale = Math.max(0.1, this.viewTransform.scale * factor); this.applyViewTransform(); }
    rotate(degrees) { this.viewTransform.rotation = (this.viewTransform.rotation + degrees) % 360; this.applyViewTransform(); }
    resetView() { this.viewTransform = { scale: 1, rotation: 0, flipX: 1, flipY: 1, left: 0, top: 0 }; this.applyViewTransform(); }
    handleWheel(e) { e.preventDefault(); if (e.shiftKey) { this.rotate(-e.deltaY * 0.2); } else { this.zoom(e.deltaY > 0 ? 1 / 1.05 : 1.05); } }
}

class LayerManager { 
    constructor(app) { this.app = app; this.layers = []; this.activeLayerIndex = -1; this.width = 344; this.height = 135; this.mergeCanvas = document.createElement('canvas'); this.mergeCanvas.width = this.width; this.mergeCanvas.height = this.height; this.mergeCtx = this.mergeCanvas.getContext('2d'); } 
    setupInitialLayers() { const bgLayer = new Layer('背景', this.width, this.height); bgLayer.fill('#f0e0d6'); this.app.canvasManager.updateLayerMatrix(bgLayer); this.layers.push(bgLayer); const drawingLayer = new Layer('レイヤー 1', this.width, this.height); this.app.canvasManager.updateLayerMatrix(drawingLayer); this.layers.push(drawingLayer); this.switchLayer(1); this.app.canvasManager.renderAllLayers(); this.app.canvasManager.saveState(); } 
    addLayer() { if (this.layers.length >= 99) return; const insertIndex = this.activeLayerIndex + 1; const newLayer = new Layer(`レイヤー ${this.layers.length + 1}`, this.width, this.height); this.app.canvasManager.updateLayerMatrix(newLayer); this.layers.splice(insertIndex, 0, newLayer); this.renameLayers(); this.switchLayer(insertIndex); this.app.canvasManager.saveState(); } 
    deleteActiveLayer() { if (this.activeLayerIndex === 0 || this.layers.length <= 1) return; this.layers.splice(this.activeLayerIndex, 1); const newActiveIndex = Math.min(this.layers.length - 1, this.activeLayerIndex); this.renameLayers(); this.switchLayer(newActiveIndex); this.app.canvasManager.renderAllLayers(); this.app.canvasManager.saveState(); } 
    renameLayers() { this.layers.forEach((layer, index) => { if (index > 0) layer.name = `レイヤー ${index}`; }); } 
    switchLayer(index) { if (index < 0 || index >= this.layers.length) return; this.activeLayerIndex = index; if (this.app.layerUIManager) { this.app.layerUIManager.renderLayers(); } } 
    getCurrentLayer() { return this.layers[this.activeLayerIndex] || null; } 
    duplicateActiveLayer() { const activeLayer = this.getCurrentLayer(); if (!activeLayer) return; const newLayer = new Layer(`${activeLayer.name}のコピー`, this.width, this.height); newLayer.imageData.data.set(activeLayer.imageData.data); newLayer.visible = activeLayer.visible; newLayer.opacity = activeLayer.opacity; newLayer.blendMode = activeLayer.blendMode; newLayer.transform = {...activeLayer.transform}; this.app.canvasManager.updateLayerMatrix(newLayer); newLayer.gpuDirty = true; const insertIndex = this.activeLayerIndex + 1; this.layers.splice(insertIndex, 0, newLayer); this.renameLayers(); this.switchLayer(insertIndex); this.app.canvasManager.saveState(); } 
    mergeDownActiveLayer() {
        if (this.activeLayerIndex <= 0) return;
        console.warn("下のレイヤーと結合は、変形をピクセルに焼き付けます。");
        const topLayer = this.layers[this.activeLayerIndex];
        const bottomLayer = this.layers[this.activeLayerIndex - 1];

        const bridge = this.app.canvasManager.renderingBridge;
        const transformedTopImageData = bridge.getTransformedImageData(topLayer);
        const transformedBottomImageData = bridge.getTransformedImageData(bottomLayer);
        
        const tempCtx = this.mergeCtx;
        tempCtx.clearRect(0, 0, this.width, this.height);
        tempCtx.putImageData(transformedBottomImageData, 0, 0);
        tempCtx.globalAlpha = topLayer.opacity / 100;
        tempCtx.globalCompositeOperation = topLayer.blendMode;
        
        const topLayerCanvas = document.createElement('canvas');
        topLayerCanvas.width = this.width; topLayerCanvas.height = this.height;
        topLayerCanvas.getContext('2d').putImageData(transformedTopImageData, 0, 0);
        tempCtx.drawImage(topLayerCanvas, 0, 0);
        
        bottomLayer.imageData = tempCtx.getImageData(0, 0, this.width, this.height);
        bottomLayer.transform = { x: 0, y: 0, scale: 1, rotation: 0, flipX: 1, flipY: 1 };
        this.app.canvasManager.updateLayerMatrix(bottomLayer);
        bottomLayer.gpuDirty = true;
        
        this.layers.splice(this.activeLayerIndex, 1);
        this.switchLayer(this.activeLayerIndex - 1);
        this.app.canvasManager.renderAllLayers();
        this.app.canvasManager.saveState();
    } 
}
class PenSettingsManager { constructor(app) { this.app = app; this.currentSize = 1; this.sizes = Array.from(document.querySelectorAll('.size-btn')).map(btn => parseInt(btn.dataset.size)); this.currentSizeIndex = this.sizes.indexOf(this.currentSize); this.bindEvents(); this.updateSizeButtonVisuals(); } bindEvents() { document.querySelectorAll('.size-btn').forEach(btn => btn.addEventListener('click', () => this.setSize(parseInt(btn.dataset.size)))); } setSize(size) { this.currentSize = size; this.currentSizeIndex = this.sizes.indexOf(this.currentSize); document.querySelectorAll('.size-btn').forEach(btn => btn.classList.remove('active')); document.querySelector(`[data-size="${size}"]`)?.classList.add('active'); this.app.canvasManager.setCurrentSize(this.currentSize); this.updateSizeButtonVisuals(); } changeSize(increase) { let newIndex = this.currentSizeIndex + (increase ? 1 : -1); newIndex = Math.max(0, Math.min(newIndex, this.sizes.length - 1)); this.setSize(this.sizes[newIndex]); } updateSizeButtonVisuals() { document.querySelectorAll('.size-btn').forEach(btn => { const size = parseInt(btn.dataset.size); btn.querySelector('.size-dot').style.width = `${Math.min(size, 16)}px`; btn.querySelector('.size-dot').style.height = `${Math.min(size, 16)}px`; btn.querySelector('.size-number').textContent = size; }); } }
class ColorManager { constructor(app) { this.app = app; this.mainColor = '#800000'; this.subColor = '#f0e0d6'; this.colors = Array.from(document.querySelectorAll('.color-btn')).map(btn => btn.dataset.color); this.currentColorIndex = this.colors.indexOf(this.mainColor); this.mainColorDisplay = document.getElementById('main-color-display'); this.subColorDisplay = document.getElementById('sub-color-display'); this.bindEvents(); this.updateColorDisplays(); document.querySelector(`[data-color="${this.mainColor}"]`)?.classList.add('active'); } bindEvents() { document.querySelectorAll('.color-btn').forEach(btn => btn.addEventListener('click', (e) => this.setColor(e.currentTarget.dataset.color))); document.querySelector('.color-mode-display').addEventListener('click', () => this.swapColors()); } setColor(color) { this.mainColor = color; this.currentColorIndex = this.colors.indexOf(this.mainColor); document.querySelectorAll('.color-btn').forEach(btn => btn.classList.remove('active')); document.querySelector(`[data-color="${color}"]`)?.classList.add('active'); this.updateColorDisplays(); this.app.canvasManager.setCurrentColor(this.mainColor); } updateColorDisplays() { this.mainColorDisplay.style.backgroundColor = this.mainColor; this.subColorDisplay.style.backgroundColor = this.subColor; } swapColors() { [this.mainColor, this.subColor] = [this.subColor, this.mainColor]; this.updateColorDisplays(); this.setColor(this.mainColor); } resetColors() { this.setColor('#800000'); this.subColor = '#f0e0d6'; this.updateColorDisplays(); } changeColor(increase) { let newIndex = this.currentColorIndex + (increase ? 1 : -1); newIndex = (newIndex + this.colors.length) % this.colors.length; this.setColor(this.colors[newIndex]); } }
class ToolManager { constructor(app) { this.app = app; this.currentTool = 'pen'; this.bindEvents(); } bindEvents() { document.getElementById('pen-tool').addEventListener('click', () => this.setTool('pen')); document.getElementById('eraser-tool').addEventListener('click', () => this.setTool('eraser')); document.getElementById('bucket-tool').addEventListener('click', () => this.setTool('bucket')); document.getElementById('move-tool').addEventListener('click', () => this.setTool('move')); } setTool(tool) { this.currentTool = tool; document.querySelectorAll('.left-toolbar .tool-btn').forEach(btn => btn.classList.remove('active')); document.getElementById(tool + '-tool')?.classList.add('active'); this.app.canvasManager.setCurrentTool(tool); } }

class ToshinkaTegakiTool {
    constructor() { this.initManagers(); }
    initManagers() {
        this.canvasManager = new CanvasManager(this);
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
        window.toshinkaTegakiInitialized = true;
        window.toshinkaTegakiTool = new ToshinkaTegakiTool();
    }
});