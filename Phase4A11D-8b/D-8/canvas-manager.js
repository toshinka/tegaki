// src/core/canvas-manager.js

import { mat4 } from 'gl-matrix';
import { RenderingBridge } from './rendering/rendering-bridge.js';
import { isValidMatrix, transformWorldToLocal } from './utils/transform-utils.js';

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

function getCanvasCoordinates(e, canvas, viewTransform) {
    const rect = canvas.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    x *= scaleX;
    y *= scaleY;

    if (viewTransform) {
        if (viewTransform.flipX === -1) x = canvas.width - x;
        if (viewTransform.flipY === -1) y = canvas.height - y;
    }
    
    return { x, y };
}

// --- Core Logic Class ---
export class CanvasManager {
    constructor(app) {
        this.app = app;
        this.currentTool = null;
        this.currentLayer = null;
        this.currentColor = '#800000';
        this.brushSize = 10;

        this.displayCanvas = canvas; 
        
        this.canvasArea = document.getElementById('canvas-area');
        this.canvasContainer = document.getElementById('canvas-container');
        this.width = this.displayCanvas.width;
        this.height = this.displayCanvas.height;

        this.renderingBridge = new RenderingBridge(this.displayCanvas, app.twgl, app.glMatrix);

        this.isDrawing = false;
        this.isPanning = false;


        this.isDraggingLayer = false;
        this.isLayerTransforming = false;
        this.layerTransformPending = false;
        this.transformDragStarted = false;
        this.isShiftDown = false; // shortcut-managerが参照
        this.isSpaceDown = false; // shortcut-managerが参照
        this.isVDown = false;     // shortcut-managerが参照
        this.lastPoint = null;
        this.transformStartWorldX = 0;
        this.transformStartWorldY = 0;
        this.transformOriginalModelMatrix = null;
        this.pressureSettings = {
            sensitivity: 0.8, minPressure: 0.1, maxPressure: 1.0, curve: 0.7,
            minSizeRatio: 0.3, dynamicRange: true
        };
        this.pressureHistory = [];
        this.maxPressureHistory = 5;
        this.history = [];
        this.historyIndex = -1;
        this.dirtyRect = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
        this.animationFrameId = null;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.canvasStartX = 0;
        this.canvasStartY = 0;
        this.viewTransform = { scale: 1, rotation: 0, flipX: 1, flipY: 1, left: 0, top: 0 };
        this.onDrawEnd = null;
        
        this.bindEvents();
    }

    setCurrentTool(tool) {
        this.currentTool = tool;
        console.log("🛠️ ツールを設定:", tool?.name ?? tool);
    }

    setCurrentLayer(layer) {
        this.currentLayer = layer;
    }
    
    setCurrentColor(color) {
      this.currentColor = color;
    }

    setCurrentSize(size) {
      this.brushSize = size;
    }

    getCurrentLayer() {
        return this.currentLayer;
    }

    bindEvents() {
        this.canvasArea.addEventListener('pointerdown', this.onPointerDown.bind(this));
        document.addEventListener('pointermove', this.onPointerMove.bind(this));
        document.addEventListener('pointerup', this.onPointerUp.bind(this));
        // wheelイベントはshortcut-managerで処理
        document.addEventListener('contextmenu', e => e.preventDefault());
        document.getElementById('saveMergedButton')?.addEventListener('click', () => this.exportMergedImage());
    }

    _isPointOnLayer(worldCoords, layer) {
        if (!layer || !layer.visible) return false;
        const sourceImage = layer.transformStage || layer.imageData;
        const currentActiveLayer = this.app.layerManager.getCurrentLayer();
        if (!currentActiveLayer || !isValidMatrix(currentActiveLayer.modelMatrix)) return false;

        const SUPER_SAMPLING_FACTOR = this.renderingBridge.currentEngine?.SUPER_SAMPLING_FACTOR || 1.0;
        const superX = worldCoords.x * SUPER_SAMPLING_FACTOR;
        const superY = worldCoords.y * SUPER_SAMPLING_FACTOR;
        const local = transformWorldToLocal(superX, superY, layer.modelMatrix, mat4);
        const layerWidth = sourceImage.width * SUPER_SAMPLING_FACTOR;
        const layerHeight = sourceImage.height * SUPER_SAMPLING_FACTOR;
        return local.x >= 0 && local.x < layerWidth && local.y >= 0 && local.y < layerHeight;
    }

    onPointerDown(e) {
        if (e.button !== 0) return;
        const coords = getCanvasCoordinates(e, this.displayCanvas, this.viewTransform);
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer) return;
        if (this.isSpaceDown) {
            this.isPanning = true;
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
            this.canvasStartX = this.viewTransform.left;
            this.canvasStartY = this.viewTransform.top;
            return;
        }
        if (this.isLayerTransforming) {
            if (!activeLayer.visible) return;
            this.isDraggingLayer = true;
            this.transformStartWorldX = Math.round(coords.x);
            this.transformStartWorldY = Math.round(coords.y);
            return;
        }
        if (!activeLayer.visible || !this._isPointOnLayer(coords, activeLayer)) return;
        const SUPER_SAMPLING_FACTOR = this.renderingBridge.currentEngine?.SUPER_SAMPLING_FACTOR || 1.0;
        const superX = coords.x * SUPER_SAMPLING_FACTOR;
        const superY = coords.y * SUPER_SAMPLING_FACTOR;
        const local = transformWorldToLocal(superX, superY, activeLayer.modelMatrix, mat4);
        this._resetDirtyRect();

        const currentColor = this.app.colorManager?.currentColor ?? '#000000'; // color-managerから取得
        const currentSize = this.app.penSettingsManager?.currentSize ?? 10; // pen-settings-managerから取得

        if (this.app.toolManager.currentTool === 'bucket') {
            this.app.bucketTool.fill(activeLayer.imageData, Math.round(local.x), Math.round(local.y), hexToRgba(currentColor));
            activeLayer.gpuDirty = true;
            this.renderAllLayers();
            this.saveState();
            this.onDrawEnd?.(activeLayer);
            return;
        }
        this.isDrawing = true;
        this.pressureHistory = [e.pressure > 0 ? e.pressure : 0.5];
        this.lastPoint = { ...local, pressure: this.pressureHistory[0] };
        const size = this.calculatePressureSize(currentSize, this.lastPoint.pressure);
        this._updateDirtyRect(local.x, local.y, size);
        this.renderingBridge.drawCircle(local.x, local.y, size / 2, hexToRgba(currentColor), this.app.toolManager.currentTool === 'eraser', activeLayer);
        this._requestRender();
        document.documentElement.setPointerCapture(e.pointerId);
    }

    onPointerMove(e) {
        const coords = getCanvasCoordinates(e, this.displayCanvas, this.viewTransform);
        if (this.isPanning) {
            const dx = e.clientX - this.dragStartX;
            const dy = e.clientY - this.dragStartY;
            this.viewTransform.left = this.canvasStartX + dx;
            this.viewTransform.top = this.canvasStartY + dy;
            this.applyViewTransform();
            return;
        }
        if (this.isDraggingLayer) {
            this.performDelayedLayerClear();

            const activeLayer = this.app.layerManager.getCurrentLayer();
            if (!activeLayer || !activeLayer.transformStage || !this.transformDragStarted) return;
            
            const dx = coords.x - this.transformStartWorldX;
            const dy = coords.y - this.transformStartWorldY;
            const SUPER_SAMPLING_FACTOR = this.renderingBridge.currentEngine?.SUPER_SAMPLING_FACTOR || 1.0;

            const adjustedDx = Math.round(dx * SUPER_SAMPLING_FACTOR);
            const adjustedDy = Math.round(dy * SUPER_SAMPLING_FACTOR);

            const translationMatrix = mat4.create();
            mat4.fromTranslation(translationMatrix, [adjustedDx, adjustedDy, 0]);
            const newMatrix = mat4.create();
            mat4.multiply(newMatrix, translationMatrix, this.transformOriginalModelMatrix);
            activeLayer.modelMatrix = newMatrix;
            this.renderAllLayers();
            return;
        }
        if (this.isDrawing) {
            const activeLayer = this.app.layerManager.getCurrentLayer();
            if (!activeLayer) return;
            
            const currentSize = this.app.penSettingsManager?.currentSize ?? 10;
            const currentColor = this.app.colorManager?.currentColor ?? '#000000';

            const SUPER_SAMPLING_FACTOR = this.renderingBridge.currentEngine?.SUPER_SAMPLING_FACTOR || 1.0;
            const superX = coords.x * SUPER_SAMPLING_FACTOR;
            const superY = coords.y * SUPER_SAMPLING_FACTOR;
            const local = transformWorldToLocal(superX, superY, activeLayer.modelMatrix, mat4);
            const currentPressure = e.pressure > 0 ? e.pressure : 0.5;
            this.pressureHistory.push(currentPressure);
            if (this.pressureHistory.length > this.maxPressureHistory) this.pressureHistory.shift();
            const lastSize = this.calculatePressureSize(currentSize, this.lastPoint.pressure);
            const size = this.calculatePressureSize(currentSize, currentPressure);
            this._updateDirtyRect(this.lastPoint.x, this.lastPoint.y, lastSize);
            this._updateDirtyRect(local.x, local.y, size);

            this.renderingBridge.drawLine(this.lastPoint.x, this.lastPoint.y, local.x, local.y, currentSize, hexToRgba(currentColor), this.app.toolManager.currentTool === 'eraser', this.lastPoint.pressure, currentPressure, this.calculatePressureSize.bind(this), activeLayer);

            this.lastPoint = { ...local, pressure: currentPressure };
            this._requestRender();
            return;
        }
        this.updateCursor(coords);
    }

    async onPointerUp(e) {
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
                await this.onDrawEnd?.(activeLayer);
            }
            this.lastPoint = null;
            this.saveState();
        }
        if (this.isDraggingLayer) this.isDraggingLayer = false;
        this.isPanning = false;
        if (document.documentElement.hasPointerCapture(e.pointerId)) {
            document.documentElement.releasePointerCapture(e.pointerId);
        }
    }

    performDelayedLayerClear() {
        if (!this.layerTransformPending || this.transformDragStarted) return;
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer) return;
        this.transformDragStarted = true;
    }

    startLayerTransform() {
        if (this.isLayerTransforming) return;
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer || !activeLayer.visible) return;

        this.isLayerTransforming = true;
        
        if (activeLayer.gpuDirty) {
            this.renderAllLayers();
        }

        const syncedImageData = this.renderingBridge.getTransformedImageData(activeLayer);

        if (syncedImageData) {
            activeLayer.transformStage = syncedImageData;
        } else {
            console.error("Failed to sync ImageData from GPU for transformStage. Aborting transform.");
            this.isLayerTransforming = false;
            return;
        }

        this.layerTransformPending = true;
        this.transformDragStarted = false;
        this.transformOriginalModelMatrix = mat4.clone(activeLayer.modelMatrix);
        this.updateCursor();
    }

    async commitLayerTransform() {
        if (!this.isLayerTransforming) return;
        const activeLayer = this.app.layerManager.getCurrentLayer();

        if (this.layerTransformPending && !this.transformDragStarted) {
            this.isLayerTransforming = false;
            this.layerTransformPending = false;
            if (activeLayer) activeLayer.transformStage = null;
            this.transformOriginalModelMatrix = null;
            this.updateCursor();
            return;
        }

        this.isLayerTransforming = false;
        if (!activeLayer || !this.transformOriginalModelMatrix) {
            this.layerTransformPending = false;
            this.transformDragStarted = false;
            this.updateCursor();
            return;
        }
        
        const finalMatrix = activeLayer.modelMatrix;
        finalMatrix[12] = Math.round(finalMatrix[12]);
        finalMatrix[13] = Math.round(finalMatrix[13]);
        
        const transformedImageData = this.renderingBridge.getTransformedImageData(activeLayer);
        
        if (!transformedImageData || transformedImageData.width === 0 || transformedImageData.height === 0) {
            console.warn("転写失敗: ImageDataが空のため、操作をキャンセルしてバックアップから復元します。");
            this.restoreLayerBackup();
        } else {
            activeLayer.imageData.data.set(transformedImageData.data);
            mat4.identity(activeLayer.modelMatrix);
            activeLayer.gpuDirty = true;
            await this.onDrawEnd?.(activeLayer);
        }
        
        activeLayer.transformStage = null;
        this.transformOriginalModelMatrix = null;
        this.layerTransformPending = false;
        this.transformDragStarted = false;

        this.setCurrentLayer(activeLayer);
        this.renderAllLayers();
        this.saveState();
        this.updateCursor();
    }

    cancelLayerTransform() {
        if (!this.isLayerTransforming) return;
        const activeLayer = this.app.layerManager.getCurrentLayer();

        if (this.layerTransformPending && !this.transformDragStarted) {
            this.isLayerTransforming = false;
            this.layerTransformPending = false;
            if (activeLayer) activeLayer.transformStage = null;
            this.transformOriginalModelMatrix = null;
            this.updateCursor();
            return;
        }
        
        this.isLayerTransforming = false;
        if (activeLayer && this.transformOriginalModelMatrix) {
            activeLayer.modelMatrix = mat4.clone(this.transformOriginalModelMatrix);
            activeLayer.gpuDirty = true;
            activeLayer.transformStage = null;
        }

        this.transformOriginalModelMatrix = null;
        this.layerTransformPending = false;
        this.transformDragStarted = false;
        
        this.renderAllLayers();
        this.updateCursor();
    }
    
    restoreLayerBackup() {
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!this.transformOriginalModelMatrix || !activeLayer) return;

        activeLayer.modelMatrix = mat4.clone(this.transformOriginalModelMatrix);
        activeLayer.gpuDirty = true;
        activeLayer.transformStage = null;
        this.transformOriginalModelMatrix = null;
        
        this.renderAllLayers();
    }

    applyLayerTransform({ translation = [0, 0, 0], scale = 1.0, rotation = 0, flip = null }) {
        if (!this.isLayerTransforming || !this.transformOriginalModelMatrix) return;
        this.performDelayedLayerClear();
        if (!this.transformDragStarted) {
             this.transformDragStarted = true;
        }

        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer) return;
        const SUPER_SAMPLING_FACTOR = this.renderingBridge.currentEngine?.SUPER_SAMPLING_FACTOR || 1.0;
        const adjustedTranslation = [translation[0] * SUPER_SAMPLING_FACTOR, translation[1] * SUPER_SAMPLING_FACTOR, translation[2]];
        const transformMatrix = mat4.create();
        const centerX = (activeLayer.imageData.width * SUPER_SAMPLING_FACTOR) / 2;
        const centerY = (activeLayer.imageData.height * SUPER_SAMPLING_FACTOR) / 2;
        mat4.translate(transformMatrix, transformMatrix, [centerX, centerY, 0]);
        mat4.rotateZ(transformMatrix, transformMatrix, rotation * (Math.PI / 180));
        let scaleVec = [scale, scale, 1];
        if (flip === 'x') scaleVec[0] *= -1;
        if (flip === 'y') scaleVec[1] *= -1;
        mat4.scale(transformMatrix, transformMatrix, scaleVec);
        mat4.translate(transformMatrix, transformMatrix, [-centerX, -centerY, 0]);
        mat4.translate(transformMatrix, transformMatrix, adjustedTranslation);
        mat4.multiply(activeLayer.modelMatrix, transformMatrix, activeLayer.modelMatrix);
        
        this.renderAllLayers();
    }

    _renderDirty() {
        const rect = this.dirtyRect;
        if (rect.minX > rect.maxX) return;
        this.renderingBridge.compositeLayers(this.app.layerManager.layers, null, rect);
        this.renderingBridge.renderToDisplay(null, rect);
    }

    renderAllLayers() {
        const SUPER_SAMPLING_FACTOR = this.renderingBridge.currentEngine?.SUPER_SAMPLING_FACTOR || 1.0;
        this.dirtyRect = { minX: 0, minY: 0, maxX: this.width * SUPER_SAMPLING_FACTOR, maxY: this.height * SUPER_SAMPLING_FACTOR };
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
            finalPressure *= (0.2 + Math.pow(dampingFactor, 3) * 0.8);
        }
        if (this.pressureSettings.dynamicRange) {
            const minHist = Math.min(...tempHistory, finalPressure);
            const maxHist = Math.max(...tempHistory, finalPressure);
            const range = maxHist - minHist;
            if (range > 0.1) finalPressure = (finalPressure - minHist) / range;
        }
        const curvedPressure = Math.pow(finalPressure, this.pressureSettings.curve);
        const SUPER_SAMPLING_FACTOR = this.renderingBridge.currentEngine?.SUPER_SAMPLING_FACTOR || 1.0;
        const superSamplingBaseSize = baseSize * SUPER_SAMPLING_FACTOR;
        const minSize = superSamplingBaseSize * this.pressureSettings.minSizeRatio;
        const maxSize = superSamplingBaseSize;
        const finalSize = minSize + (maxSize - minSize) * curvedPressure;
        return Math.max(0.1 * SUPER_SAMPLING_FACTOR, finalSize);
    }

    saveState() {
        const state = {
            layers: this.app.layerManager.layers.map(layer => {
                if (!isValidMatrix(layer.modelMatrix)) layer.modelMatrix = mat4.create();
                return {
                    id: layer.id, name: layer.name, visible: layer.visible, opacity: layer.opacity, blendMode: layer.blendMode,
                    imageData: new ImageData(new Uint8ClampedArray(layer.imageData.data), layer.imageData.width, layer.imageData.height),
                    modelMatrix: Array.from(layer.modelMatrix)
                };
            }),
            activeLayerIndex: this.app.layerManager.activeLayerIndex
        };
        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push(state);
        this.historyIndex++;
    }

    restoreState(state) {
        this.app.layerManager.layers = state.layers.map(layerData => {
            const layer = new this.app.Layer(layerData.name, layerData.imageData.width, layerData.imageData.height, layerData.id);
            layer.visible = layerData.visible;
            layer.opacity = layerData.opacity ?? 100;
            layer.blendMode = layerData.blendMode ?? 'normal';
            layer.imageData.data.set(layerData.imageData.data);
            if (layerData.modelMatrix && Array.isArray(layerData.modelMatrix) && layerData.modelMatrix.length === 16) {
                layer.modelMatrix = new Float32Array(layerData.modelMatrix);
            }
            layer.gpuDirty = true;
            return layer;
        });
        this.app.layerManager.switchLayer(state.activeLayerIndex);
        this.setCurrentLayer(this.app.layerManager.getCurrentLayer());
        this.app.layerUIManager.renderLayers?.();
        this.renderAllLayers();
    }

    undo() { if (this.historyIndex > 0) { this.historyIndex--; this.restoreState(this.history[this.historyIndex]); } }
    redo() { if (this.historyIndex < this.history.length - 1) { this.historyIndex++; this.restoreState(this.history[this.historyIndex]); } }

    updateCursor(coords) {
        if (this.isLayerTransforming) { this.canvasArea.style.cursor = 'move'; return; }
        if (this.isPanning) { this.canvasArea.style.cursor = 'grabbing'; return; }
        if (this.isSpaceDown) { this.canvasArea.style.cursor = 'grab'; return; }
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (activeLayer && coords && this._isPointOnLayer(coords, activeLayer)) {
            switch (this.app.toolManager.currentTool) {
                case 'pen': this.canvasArea.style.cursor = 'crosshair'; break;
                case 'eraser': this.canvasArea.style.cursor = 'cell'; break;
                case 'bucket': this.canvasArea.style.cursor = 'copy'; break;
                default: this.canvasArea.style.cursor = 'crosshair';
            }
        } else {
            this.canvasArea.style.cursor = 'not-allowed';
        }
    }

    applyViewTransform() { const t = this.viewTransform; this.canvasContainer.style.transform = `translate(${t.left}px, ${t.top}px) scale(${t.scale * t.flipX}, ${t.scale * t.flipY}) rotate(${t.rotation}deg)`; }
    flipHorizontal() { this.viewTransform.flipX *= -1; this.applyViewTransform(); }
    flipVertical() { this.viewTransform.flipY *= -1; this.applyViewTransform(); }
    zoom(factor) { this.viewTransform.scale = Math.max(0.1, this.viewTransform.scale * factor); this.applyViewTransform(); }
    rotate(degrees) { this.viewTransform.rotation = (this.viewTransform.rotation + degrees) % 360; this.applyViewTransform(); }
    resetView() { this.viewTransform = { scale: 1, rotation: 0, flipX: 1, flipY: 1, left: 0, top: 0 }; this.applyViewTransform(); }
    handleWheel(e) { e.preventDefault(); if (this.isLayerTransforming) { return; } if (e.shiftKey) { this.rotate(-e.deltaY * 0.2); } else { this.zoom(e.deltaY > 0 ? 1 / 1.05 : 1.05); } }
    exportMergedImage() { /* ... */ }
}