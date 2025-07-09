/*
 * ===================================================================================
 * Toshinka Tegaki Tool - Core Engine
 * Version: 2.9.4 (Phase 4A11B - レイヤー移動累積誤差修正)
 *
 * - 修正 (Phase 4A11B-Fix):
 * - レイヤー移動時の座標累積誤差を修正
 * - 1. レイヤー移動開始時の初期座標を記録
 * - 2. 移動中は初期座標からの相対位置で計算
 * - 3. modelMatrix の累積計算を回避
 * ===================================================================================
 */

// --- glMatrix 定義 ---
const mat4 = window.glMatrix.mat4;
const vec4 = window.glMatrix.vec4;

// --- Module Imports ---
import { TopBarManager, LayerUIManager } from './ui/ui-manager.js';
import { ShortcutManager } from './ui/shortcut-manager.js';
import { BucketTool } from './tools/toolset.js';
import { RenderingBridge } from './core/rendering/rendering-bridge.js';
import { LayerManager } from './layer-manager/layer-manager.js';
import { PenSettingsManager } from './ui/pen-settings-manager.js';
import { ColorManager } from './ui/color-manager.js';
import { ToolManager } from './ui/tool-manager.js';

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

function isValidMatrix(m) {
    return m && m.length === 16 && Array.from(m).every(Number.isFinite);
}

function transformWorldToLocal(worldX, worldY, modelMatrix) {
    const invMatrix = mat4.create();
    if (!mat4.invert(invMatrix, modelMatrix)) {
        console.warn("⚠ transformWorldToLocal: inversion failed");
        return { x: worldX, y: worldY };
    }
    const worldPos = vec4.fromValues(worldX, worldY, 0, 1);
    const localPos = vec4.create();
    vec4.transformMat4(localPos, worldPos, invMatrix);
    return { x: localPos[0], y: localPos[1] };
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
        if (viewTransform.flipX === -1) {
            x = canvas.width - x;
        }
        if (viewTransform.flipY === -1) {
            y = canvas.height - y;
        }
    }
    
    return { x, y };
}

// --- Core Logic Classes ---
export class Layer {
    constructor(name, width, height) {
        this.name = name;
        this.visible = true;
        this.opacity = 100;
        this.blendMode = 'normal';
        this.imageData = new ImageData(width, height);
        this.modelMatrix = mat4.create();
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

        this.isDrawing = false; 
        this.isPanning = false; 
        this.isSpaceDown = false;
        this.isLayerMoving = false;
        
        this.isVDown = false; 
        
        this.lastPoint = null;
        
        // 🚀【修正点】レイヤー移動の累積誤差を防ぐための変数
        this.transformStartWorldX = 0;
        this.transformStartWorldY = 0;
        this.originalModelMatrix = null;
        
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
        
        this.bindEvents();
    }
    
    bindEvents() {
        this.canvasArea.addEventListener('pointerdown', this.onPointerDown.bind(this));
        document.addEventListener('pointermove', this.onPointerMove.bind(this));
        document.addEventListener('pointerup', this.onPointerUp.bind(this));
        this.canvasArea.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
        document.addEventListener('contextmenu', e => e.preventDefault());
        document.getElementById('saveMergedButton')?.addEventListener('click', () => this.exportMergedImage());
        
        document.addEventListener("keydown", (e) => {
            if (e.key === "v" || e.key === "V") this.isVDown = true;
            if (e.key === " ") this.isSpaceDown = true;
            this.updateCursor();
        });
        
        document.addEventListener("keyup", (e) => {
            if (e.key === "v" || e.key === "V") this.isVDown = false;
            if (e.key === " ") this.isSpaceDown = false;
            this.updateCursor();
        });
    }

    onPointerDown(e) {
        if (e.button !== 0) return;
        
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer) return;
        
        if (!isValidMatrix(activeLayer.modelMatrix)) {
            console.warn("⚠ onPointerDown: invalid modelMatrix detected, resetting");
            activeLayer.modelMatrix = mat4.create();
        }
        
        if (this.isSpaceDown) {
            this.isPanning = true;
            this.dragStartX = e.clientX; 
            this.dragStartY = e.clientY; 
            this.canvasStartX = this.viewTransform.left; 
            this.canvasStartY = this.viewTransform.top;
            return;
        }

        const coords = getCanvasCoordinates(e, this.displayCanvas, this.viewTransform);

        if (this.isVDown) {
            this.isLayerMoving = true;
            // 🚀【修正点】初期のワールド座標を記録
            this.transformStartWorldX = coords.x;
            this.transformStartWorldY = coords.y;
            this.originalModelMatrix = mat4.clone(activeLayer.modelMatrix);
            return;
        }
        
        const local = transformWorldToLocal(coords.x, coords.y, activeLayer.modelMatrix);
        console.log("📍 描画座標変換:", { world: coords, local: local });
        
        if (!activeLayer.visible) return;

        this._resetDirtyRect();
        
        if (this.app.toolManager.currentTool === 'bucket') {
            this.app.bucketTool.fill(activeLayer.imageData, local.x, local.y, hexToRgba(this.app.colorManager.currentColor));
            activeLayer.gpuDirty = true;
            this.renderAllLayers();
            this.saveState();
            return;
        }

        this.isDrawing = true;
        this.pressureHistory = [e.pressure > 0 ? e.pressure : 0.5];
        this.lastPoint = { ...local, pressure: this.pressureHistory[0] };
        
        const size = this.calculatePressureSize(this.app.penSettingsManager.currentSize, this.lastPoint.pressure);
        
        this._updateDirtyRect(local.x, local.y, size);
        
        this.renderingBridge.drawCircle(
            local.x, local.y, size / 2, 
            hexToRgba(this.app.colorManager.currentColor), this.app.toolManager.currentTool === 'eraser',
            activeLayer
        );
        
        this._requestRender();
        document.documentElement.setPointerCapture(e.pointerId);
    }
    
    onPointerMove(e) {
        if (this.isPanning) {
            const dx = e.clientX - this.dragStartX; 
            const dy = e.clientY - this.dragStartY;
            this.viewTransform.left = this.canvasStartX + dx; 
            this.viewTransform.top = this.canvasStartY + dy;
            this.applyViewTransform(); 
            return;
        }
        
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer) return;

        const coords = getCanvasCoordinates(e, this.displayCanvas, this.viewTransform);

        if (this.isLayerMoving) {
            // 🚀【修正点】初期位置からの相対移動量を計算
            const dx = coords.x - this.transformStartWorldX;
            const dy = coords.y - this.transformStartWorldY;
            
            const SUPER_SAMPLING_FACTOR = this.renderingBridge.currentEngine?.SUPER_SAMPLING_FACTOR || 1.0;
            const adjustedDx = dx * SUPER_SAMPLING_FACTOR;
            const adjustedDy = dy * SUPER_SAMPLING_FACTOR;

            // 🚀【修正点】元の行列をクローンして、そこに変換を適用
            const newMatrix = mat4.clone(this.originalModelMatrix);
            mat4.translate(newMatrix, newMatrix, [adjustedDx, adjustedDy, 0]);
            activeLayer.modelMatrix = newMatrix;
            
            this.renderAllLayers();
            return;
        }

        if (!this.isDrawing) return;
        
        const local = transformWorldToLocal(coords.x, coords.y, activeLayer.modelMatrix);
        
        const currentPressure = e.pressure > 0 ? e.pressure : 0.5;
        this.pressureHistory.push(currentPressure);
        if (this.pressureHistory.length > this.maxPressureHistory) {
            this.pressureHistory.shift();
        }
        
        const lastSize = this.calculatePressureSize(this.app.penSettingsManager.currentSize, this.lastPoint.pressure);
        const currentSize = this.calculatePressureSize(this.app.penSettingsManager.currentSize, currentPressure);
        this._updateDirtyRect(this.lastPoint.x, this.lastPoint.y, lastSize);
        this._updateDirtyRect(local.x, local.y, currentSize);

        this.renderingBridge.drawLine(
            this.lastPoint.x, this.lastPoint.y, local.x, local.y,
            this.app.penSettingsManager.currentSize, hexToRgba(this.app.colorManager.currentColor), this.app.toolManager.currentTool === 'eraser',
            this.lastPoint.pressure, currentPressure, 
            this.calculatePressureSize.bind(this),
            activeLayer
        );
        
        this.lastPoint = { ...local, pressure: currentPressure };
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
        
        if (this.isLayerMoving) {
            this.isLayerMoving = false;
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
        this.renderingBridge.compositeLayers(this.app.layerManager.layers, null, rect);
        this.renderingBridge.renderToDisplay(null, rect);
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

    saveState() {
        const state = {
            layers: this.app.layerManager.layers.map(layer => {
                if (!isValidMatrix(layer.modelMatrix)) {
                    console.warn("⚠ saveState: invalid modelMatrix detected, resetting");
                    layer.modelMatrix = mat4.create();
                }
                const savedModelMatrix = Array.from(layer.modelMatrix);
                return {
                    name: layer.name,
                    visible: layer.visible,
                    opacity: layer.opacity,
                    blendMode: layer.blendMode,
                    imageData: new ImageData(
                        new Uint8ClampedArray(layer.imageData.data),
                        layer.imageData.width,
                        layer.imageData.height
                    ),
                    modelMatrix: savedModelMatrix
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
            const layer = new Layer(layerData.name, layerData.imageData.width, layerData.imageData.height);
            layer.visible = layerData.visible;
            layer.opacity = layerData.opacity ?? 100;
            layer.blendMode = layerData.blendMode ?? 'normal';
            layer.imageData.data.set(layerData.imageData.data);
            
            layer.modelMatrix = mat4.create();
            if (layerData.modelMatrix && Array.isArray(layerData.modelMatrix) && layerData.modelMatrix.length === 16) {
                layer.modelMatrix = new Float32Array(layerData.modelMatrix);
            } else {
                console.warn("⚠ restoreState: invalid saved modelMatrix, using identity");
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
    
    updateCursor() { 
        let cursor = 'crosshair'; 
        if (this.isVDown) cursor = 'move'; 
        if (this.isSpaceDown) cursor = 'grab'; 
        if (this.app.toolManager.currentTool === 'eraser') cursor = 'cell'; 
        if (this.app.toolManager.currentTool === 'bucket') cursor = 'copy'; 
        this.canvasArea.style.cursor = cursor; 
    }
    
    applyViewTransform() { 
        const t = this.viewTransform; 
        this.canvasContainer.style.transform = `translate(${t.left}px, ${t.top}px) scale(${t.scale * t.flipX}, ${t.scale * t.flipY}) rotate(${t.rotation}deg)`; 
    }
    
    flipHorizontal() { 
        this.viewTransform.flipX *= -1; 
        this.applyViewTransform(); 
    }
    
    flipVertical() { 
        this.viewTransform.flipY *= -1; 
        this.applyViewTransform(); 
    }
    
    zoom(factor) { 
        this.viewTransform.scale = Math.max(0.1, this.viewTransform.scale * factor); 
        this.applyViewTransform(); 
    }
    
    rotate(degrees) { 
        this.viewTransform.rotation = (this.viewTransform.rotation + degrees) % 360; 
        this.applyViewTransform(); 
    }
    
    resetView() { 
        this.viewTransform = { scale: 1, rotation: 0, flipX: 1, flipY: 1, left: 0, top: 0 }; 
        this.applyViewTransform(); 
    }
    
    handleWheel(e) { 
        e.preventDefault(); 
        if (e.shiftKey) { 
            this.rotate(-e.deltaY * 0.2); 
        } else { 
            this.zoom(e.deltaY > 0 ? 1 / 1.05 : 1.05); 
        } 
    }
}

class ToshinkaTegakiTool {
    constructor() {
        this.layerManager = new LayerManager(this);
        this.canvasManager = new CanvasManager(this);
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
    }
}

window.addEventListener('DOMContentLoaded', () => {
    if (!window.toshinkaTegakiInitialized) {
        window.toshinkaTegakiInitialized = true;
        window.toshinkaTegakiTool = new ToshinkaTegakiTool();
    }
});