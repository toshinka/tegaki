/*
 * ===================================================================================
 * Toshinka Tegaki Tool - Core Engine
 * Version: 3.0.1 (Phase4A9 Bugfix)
 *
 * - 修正：
 * - 1. レイヤー変形開始ロジックの修正:
 * -   `startLayerTransform`がキーボードショートカットからマウスイベント無しで
 * -   呼び出された場合に、安全に処理を継続できるように修正。
 * ===================================================================================
 */
import { TopBarManager, LayerUIManager } from './ui/ui-manager.js';
import { ShortcutManager } from './ui/shortcut-manager.js';
import { BucketTool } from './tools/toolset.js';
import { RenderingBridge } from './core/rendering/rendering-bridge.js';
import * as transformUtils from './core/utils/transform-utils.js';

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
        this.modelMatrix = transformUtils.create();
        this.gpuDirty = true;
    }
    clear() {
        this.imageData.data.fill(0);
        this.gpuDirty = true;
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
        this.originalLayerMatrix = null;
        this.transformStartX = 0; this.transformStartY = 0;
        
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

        this.gui = new dat.GUI();
        this.transformControls = { x: 0, y: 0, 'reset': () => this.resetActiveLayerTransform() };
        const transformFolder = this.gui.addFolder('Layer Transform');
        this.xController = transformFolder.add(this.transformControls, 'x', -this.width, this.width).name('Translate X').listen();
        this.yController = transformFolder.add(this.transformControls, 'y', -this.height, this.height).name('Translate Y').listen();
        transformFolder.add(this.transformControls, 'reset').name('Reset Transform');
        transformFolder.open();

        this.xController.onChange(() => this.updateLayerPositionFromGui());
        this.yController.onChange(() => this.updateLayerPositionFromGui());
        
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
        
        if (this.isVDown) {
            this.startLayerTransform(e);
            e.preventDefault(); return;
        }
        if (this.isSpaceDown) {
            this.dragStartX = e.clientX; this.dragStartY = e.clientY; this.isPanning = true;
            this.canvasStartX = this.viewTransform.left; this.canvasStartY = this.viewTransform.top;
            e.preventDefault(); return;
        }

        const worldCoords = this.getCanvasCoordinates(e);
        if (!worldCoords) return;
        
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer || !activeLayer.visible) return;

        const localCoords = this.getWorldToLocalCoords(worldCoords, activeLayer);
        if (!localCoords) return;

        this._resetDirtyRect();
        
        if (this.currentTool === 'bucket') {
            this.app.bucketTool.fill(activeLayer.imageData, Math.round(localCoords.x), Math.round(localCoords.y), hexToRgba(this.currentColor));
            activeLayer.gpuDirty = true;
            this.renderAllLayers();
            this.saveState();
            return;
        }

        this.isDrawing = true;
        this.pressureHistory = [e.pressure > 0 ? e.pressure : 0.5];
        this.lastPoint = { ...localCoords, pressure: this.pressureHistory[0] };
        
        const size = this.calculatePressureSize(this.currentSize, this.lastPoint.pressure);
        this._updateDirtyRectWithTransform(activeLayer, localCoords.x, localCoords.y, size);
        
        this.renderingBridge.drawCircle(
            localCoords.x, localCoords.y, size / 2, 
            hexToRgba(this.currentColor), this.currentTool === 'eraser',
            activeLayer
        );
        
        this._requestRender();
        document.documentElement.setPointerCapture(e.pointerId);
    }
    
    onPointerMove(e) {
        if (this.isLayerTransforming) {
            const dx = (e.clientX - this.transformStartX) / this.viewTransform.scale;
            const dy = (e.clientY - this.transformStartY) / this.viewTransform.scale;
            
            const newMatrix = transformUtils.clone(this.originalLayerMatrix);
            transformUtils.translate(newMatrix, dx, dy);
            this.transformTargetLayer.modelMatrix = newMatrix;

            this.updateGuiForLayer();
            this.renderAllLayers();
            return;
        }

        if (this.isPanning) {
            const dx = e.clientX - this.dragStartX; const dy = e.clientY - this.dragStartY;
            this.viewTransform.left = this.canvasStartX + dx; this.viewTransform.top = this.canvasStartY + dy;
            this.applyViewTransform(); return;
        }
        if (!this.isDrawing) return;

        const worldCoords = this.getCanvasCoordinates(e);
        if (!worldCoords) { this.lastPoint = null; return; }
        
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer || !activeLayer.visible) return;
        
        const localCoords = this.getWorldToLocalCoords(worldCoords, activeLayer);
        if(!localCoords) { this.lastPoint = null; return; }

        if (!this.lastPoint) { 
            this.pressureHistory = [e.pressure > 0 ? e.pressure : 0.5];
            this.lastPoint = { ...localCoords, pressure: e.pressure > 0 ? e.pressure : 0.5 }; 
            return;
        }

        const currentPressure = e.pressure > 0 ? e.pressure : 0.5;
        this.pressureHistory.push(currentPressure);
        if (this.pressureHistory.length > this.maxPressureHistory) {
            this.pressureHistory.shift();
        }
        
        const lastSize = this.calculatePressureSize(this.currentSize, this.lastPoint.pressure);
        const currentSize = this.calculatePressureSize(this.currentSize, currentPressure);
        
        this._updateDirtyRectWithTransform(activeLayer, this.lastPoint.x, this.lastPoint.y, lastSize);
        this._updateDirtyRectWithTransform(activeLayer, localCoords.x, localCoords.y, currentSize);

        this.renderingBridge.drawLine(
            this.lastPoint.x, this.lastPoint.y, localCoords.x, localCoords.y,
            this.currentSize, hexToRgba(this.currentColor), this.currentTool === 'eraser',
            this.lastPoint.pressure, currentPressure, 
            this.calculatePressureSize.bind(this),
            activeLayer
        );
        
        this.lastPoint = { ...localCoords, pressure: currentPressure };
        this._requestRender();
    }
    
    onPointerUp(e) {
        if (this.isLayerTransforming) { this.commitLayerTransform(); }
        
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
    
    _updateDirtyRectWithTransform(layer, localX, localY, radius) {
        const worldPos = [0, 0];
        transformUtils.transformVec2(worldPos, [localX, localY], layer.modelMatrix);
        this._updateDirtyRect(worldPos[0], worldPos[1], radius * 1.5); // 少しマージンを増やす
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

    getWorldToLocalCoords(worldCoords, layer) {
        const invMatrix = transformUtils.invert(transformUtils.create(), layer.modelMatrix);
        if (!invMatrix) return null;
        
        const out = [0, 0];
        transformUtils.transformVec2(out, [worldCoords.x, worldCoords.y], invMatrix);
        
        return { x: out[0], y: out[1] };
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
            return { x: x, y: y };
        } catch (error) {
            console.warn('Coordinate transformation error:', error);
            return null;
        }
    }

    // ★★★★★★★★★★★★★★★★★★★★
    // ★★★ 修正点：キーボードからの呼び出しでも安全なように修正 ★★★
    // ★★★★★★★★★★★★★★★★★★★★
    startLayerTransform(e = null) {
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer) return;

        // マウスイベントがある場合のみ、変形を開始/続行する
        if (e) {
            this.isLayerTransforming = true;
            this.transformTargetLayer = activeLayer;
            this.originalLayerMatrix = transformUtils.clone(activeLayer.modelMatrix);
            this.transformStartX = e.clientX;
            this.transformStartY = e.clientY;
        } else {
            // ショートカットキーで呼ばれた場合(e is null)は何もしない。
            // 実際の変形開始は onPointerDown で行われる。
            console.log("Move tool activated by key. Waiting for pointer down to start transform.");
        }
    }

    commitLayerTransform() {
        if (!this.isLayerTransforming) return;
        this.isLayerTransforming = false;
        this.transformTargetLayer = null;
        this.originalLayerMatrix = null;
        this.saveState();
    }

    saveState() {
        if(this.isLayerTransforming) return;
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
                modelMatrix: transformUtils.clone(layer.modelMatrix)
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
                layer.modelMatrix = transformUtils.clone(layerData.modelMatrix);
            }
            layer.gpuDirty = true;
            return layer;
        });
        this.app.layerManager.switchLayer(state.activeLayerIndex);
        this.renderAllLayers();
    }

    updateLayerPositionFromGui() {
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer || this.isLayerTransforming) return;
        transformUtils.resetToTranslation(activeLayer.modelMatrix, this.transformControls.x, this.transformControls.y);
        this.renderAllLayers();
    }

    updateGuiForLayer() {
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer) return;
        const translation = transformUtils.getTranslation(activeLayer.modelMatrix);
        this.transformControls.x = translation.x;
        this.transformControls.y = translation.y;
    }

    resetActiveLayerTransform() {
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer) return;
        transformUtils.reset(activeLayer.modelMatrix);
        this.updateGuiForLayer();
        this.renderAllLayers();
        this.saveState();
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
            if (this.app.layerManager.activeLayerIndex === 0) {
                activeLayer.fill('#f0e0d6');
            }
            this.renderAllLayers();
            this.saveState();
        }
    }
    exportMergedImage() {
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = this.width;
        exportCanvas.height = this.height;
        const exportCtx = exportCanvas.getContext('2d');
        const fullRect = { minX: 0, minY: 0, maxX: this.width, maxY: this.height };
        this.renderingBridge.compositeLayers(this.app.layerManager.layers, this.compositionData, fullRect);
        const gl = this.renderingBridge.engines['webgl']?.gl;
        if (gl && this.renderingBridge.currentEngineType === 'webgl') {
             const pixels = new Uint8Array(this.width * this.height * 4);
             this.renderingBridge.renderToDisplay(null, fullRect);
             gl.readPixels(0, 0, this.width, this.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
             const correctedPixels = new Uint8ClampedArray(this.width * this.height * 4);
             for (let y = 0; y < this.height; y++) {
                 const s = y * this.width * 4;
                 const d = (this.height - 1 - y) * this.width * 4;
                 correctedPixels.set(pixels.subarray(s, s + this.width * 4), d);
             }
             const finalImageData = new ImageData(correctedPixels, this.width, this.height);
             exportCtx.putImageData(finalImageData, 0, 0);
        } else {
            exportCtx.fillStyle = '#f0e0d6';
            exportCtx.fillRect(0,0,this.width, this.height);
            for(const layer of this.app.layerManager.layers) {
                if(!layer.visible) continue;
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = this.width;
                tempCanvas.height = this.height;
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx.putImageData(layer.imageData, 0, 0);
                exportCtx.save();
                exportCtx.globalAlpha = layer.opacity / 100;
                exportCtx.globalCompositeOperation = layer.blendMode;
                const m = layer.modelMatrix;
                exportCtx.transform(m[0], m[1], m[4], m[5], m[12], m[13]);
                exportCtx.drawImage(tempCanvas, 0, 0);
                exportCtx.restore();
            }
        }
        const dataURL = exportCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = 'merged_image.png';
        link.click();
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
    setupInitialLayers() { const bgLayer = new Layer('背景', this.width, this.height); bgLayer.fill('#f0e0d6'); this.layers.push(bgLayer); const drawingLayer = new Layer('レイヤー 1', this.width, this.height); this.layers.push(drawingLayer); this.switchLayer(1); this.app.canvasManager.renderAllLayers(); this.app.canvasManager.saveState(); } 
    addLayer() { if (this.layers.length >= 99) return; const insertIndex = this.activeLayerIndex + 1; const newLayer = new Layer(`レイヤー ${this.layers.length + 1}`, this.width, this.height); this.layers.splice(insertIndex, 0, newLayer); this.renameLayers(); this.switchLayer(insertIndex); this.app.canvasManager.saveState(); } 
    deleteActiveLayer() { if (this.activeLayerIndex === 0 || this.layers.length <= 1) return; this.layers.splice(this.activeLayerIndex, 1); const newActiveIndex = Math.min(this.layers.length - 1, this.activeLayerIndex); this.renameLayers(); this.switchLayer(newActiveIndex); this.app.canvasManager.renderAllLayers(); this.app.canvasManager.saveState(); } 
    renameLayers() { this.layers.forEach((layer, index) => { if (index > 0) layer.name = `レイヤー ${index}`; }); } 
    switchLayer(index) {
        if (index < 0 || index >= this.layers.length) return;
        this.activeLayerIndex = index;
        if (this.app.layerUIManager) {
            this.app.layerUIManager.renderLayers();
        }
        if (this.app.canvasManager) {
            this.app.canvasManager.updateGuiForLayer();
        }
    } 
    getCurrentLayer() { return this.layers[this.activeLayerIndex] || null; } 
    duplicateActiveLayer() { const activeLayer = this.getCurrentLayer(); if (!activeLayer) return; const newLayer = new Layer(`${activeLayer.name}のコピー`, this.width, this.height); newLayer.imageData.data.set(activeLayer.imageData.data); newLayer.visible = activeLayer.visible; newLayer.opacity = activeLayer.opacity; newLayer.blendMode = activeLayer.blendMode; newLayer.modelMatrix = transformUtils.clone(activeLayer.modelMatrix); newLayer.gpuDirty = true; const insertIndex = this.activeLayerIndex + 1; this.layers.splice(insertIndex, 0, newLayer); this.renameLayers(); this.switchLayer(insertIndex); this.app.canvasManager.saveState(); } 
    mergeDownActiveLayer() {
        if (this.activeLayerIndex <= 0) return;
        console.warn("Merge down will bake the transform into pixels.");
        const topLayer = this.layers[this.activeLayerIndex];
        const bottomLayer = this.layers[this.activeLayerIndex - 1];
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.width; tempCanvas.height = this.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.save();
        const bm = bottomLayer.modelMatrix;
        tempCtx.transform(bm[0], bm[1], bm[4], bm[5], bm[12], bm[13]);
        const bottomLayerCanvas = document.createElement('canvas');
        bottomLayerCanvas.width = this.width; bottomLayerCanvas.height = this.height;
        bottomLayerCanvas.getContext('2d').putImageData(bottomLayer.imageData, 0, 0);
        tempCtx.drawImage(bottomLayerCanvas, 0, 0);
        tempCtx.restore();
        tempCtx.save();
        tempCtx.globalAlpha = topLayer.opacity / 100;
        tempCtx.globalCompositeOperation = topLayer.blendMode;
        const tm = topLayer.modelMatrix;
        tempCtx.transform(tm[0], tm[1], tm[4], tm[5], tm[12], tm[13]);
        const topLayerCanvas = document.createElement('canvas');
        topLayerCanvas.width = this.width; topLayerCanvas.height = this.height;
        topLayerCanvas.getContext('2d').putImageData(topLayer.imageData, 0, 0);
        tempCtx.drawImage(topLayerCanvas, 0, 0);
        tempCtx.restore();
        bottomLayer.imageData = tempCtx.getImageData(0, 0, this.width, this.height);
        transformUtils.reset(bottomLayer.modelMatrix);
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
    constructor() {
        this.initManagers();
    }
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