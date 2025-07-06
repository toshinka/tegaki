/*
 * ===================================================================================
 * Toshinka Tegaki Tool - Core Engine
 * Version: 2.9.1 (Phase 4A11-Refactor)
 *
 * - 修正：
 * - 巨大化した core-engine.js の責務を分離するため、関連クラスを外部モジュールに分割。
 * - LayerManager -> layer-manager/layer-manager.js
 * - PenSettingsManager -> ui/pen-settings-manager.js
 * - ColorManager -> ui/color-manager.js
 * - ToolManager -> ui/tool-manager.js
 * - 上記モジュールをインポートして利用するように変更。
 * ===================================================================================
 */

// --- Module Imports ---
// 既存のインポート
import { TopBarManager, LayerUIManager } from './ui/ui-manager.js';
import { ShortcutManager } from './ui/shortcut-manager.js';
import { BucketTool } from './tools/toolset.js';
import { RenderingBridge } from './core/rendering/rendering-bridge.js';

// ✨分割したクラスを新しくインポートします
import { LayerManager } from './layer-manager/layer-manager.js';
import { PenSettingsManager } from './ui/pen-settings-manager.js';
import { ColorManager } from './ui/color-manager.js';
import { ToolManager } from './ui/tool-manager.js';


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

// 📌 2. modelMatrix が壊れていないかをチェックする関数を追加
function isValidMatrix(m) {
    return Array.isArray(m) && m.length === 16 && m.every(Number.isFinite);
}

// 📌 3. transformWorldToLocal 関数をこのファイル内に定義
function transformWorldToLocal(worldX, worldY, modelMatrix) {
    const invMatrix = mat4.create();
    mat4.invert(invMatrix, modelMatrix);
    const worldPos = vec4.fromValues(worldX, worldY, 0, 1);
    const localPos = vec4.create();
    vec4.transformMat4(localPos, worldPos, invMatrix);

    console.log('[座標変換] World:', worldX, worldY, '→ Local:', localPos[0], localPos[1]);
    return { x: localPos[0], y: localPos[1] };
}

// ✨Layerクラスは他のファイルから参照されるので「export」を追加します
export class Layer {
    constructor(name, width, height) {
        this.name = name;
        this.visible = true;
        this.opacity = 100;
        this.blendMode = 'normal';
        this.imageData = new ImageData(width, height);
        // 📌 1. レイヤーオブジェクトに modelMatrix を初期化する処理を追加
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

        this.compositionData = new ImageData(this.width, this.height);
        this.isDrawing = false; this.isPanning = false; this.isSpaceDown = false;
        
        // 📌 5. Vキーを押している間だけレイヤーが移動できるようにする
        this.isVDown = false; this.isShiftDown = false;
        
        // 📌 6. レイヤー移動処理用の変数を追加
        this.isLayerMoving = false;
        this.transformStartX = 0;
        this.transformStartY = 0;
        this.originalModelMatrix = null;
        
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
        this.bindKeyEvents();
    }
    
    bindEvents() {
        this.canvasArea.addEventListener('pointerdown', this.onPointerDown.bind(this));
        document.addEventListener('pointermove', this.onPointerMove.bind(this));
        document.addEventListener('pointerup', this.onPointerUp.bind(this));
        this.canvasArea.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
        document.addEventListener('contextmenu', e => e.preventDefault());
        document.getElementById('saveMergedButton')?.addEventListener('click', () => this.exportMergedImage());
    }

    // 📌 5. Vキーを押している間だけレイヤーが移動できるようにする
    bindKeyEvents() {
        document.addEventListener("keydown", (e) => {
            if (e.key === "v" || e.key === "V") this.isVDown = true;
        });
        document.addEventListener("keyup", (e) => {
            if (e.key === "v" || e.key === "V") this.isVDown = false;
        });
    }

    onPointerDown(e) {
        if (e.button !== 0) return;
        
        if (this.isSpaceDown) {
            this.dragStartX = e.clientX; this.dragStartY = e.clientY; this.isPanning = true;
            this.canvasStartX = this.viewTransform.left; this.canvasStartY = this.viewTransform.top;
            e.preventDefault(); return;
        }
        
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer || !activeLayer.visible) return;

        // 📌 2. modelMatrix が壊れていないかをチェック
        if (!isValidMatrix(activeLayer.modelMatrix)) {
            console.error('Invalid modelMatrix detected, reinitializing...');
            activeLayer.modelMatrix = mat4.create();
        }

        // 📌 6. レイヤー移動処理（V + ドラッグ）をマウスイベントに追加
        if (this.isVDown) {
            this.isLayerMoving = true;
            this.transformStartX = e.clientX;
            this.transformStartY = e.clientY;
            this.originalModelMatrix = mat4.clone(activeLayer.modelMatrix);
            e.preventDefault();
            return;
        }
        
        const coords = this.getCanvasCoordinates(e);
        if (!coords) return;
        
        // 📌 4. マウス描画処理では transformWorldToLocal を必ず通して描く
        const local = transformWorldToLocal(coords.x, coords.y, activeLayer.modelMatrix);
        console.log('[描画位置] World(' + coords.x + ', ' + coords.y + ') → Local(' + local.x + ', ' + local.y + ')');

        this._resetDirtyRect();
        
        if (this.currentTool === 'bucket') {
            this.app.bucketTool.fill(activeLayer.imageData, local.x, local.y, hexToRgba(this.currentColor));
            activeLayer.gpuDirty = true;
            this.renderAllLayers();
            this.saveState();
            return;
        }

        this.isDrawing = true;
        this.pressureHistory = [e.pressure > 0 ? e.pressure : 0.5];
        this.lastPoint = { x: local.x, y: local.y, pressure: this.pressureHistory[0] };
        
        const size = this.calculatePressureSize(this.currentSize, this.lastPoint.pressure);
        
        this._updateDirtyRect(local.x, local.y, size);
        
        this.renderingBridge.drawCircle(
            local.x, local.y, size / 2, 
            hexToRgba(this.currentColor), this.currentTool === 'eraser',
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

        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer || !activeLayer.visible) return;

        // 📌 2. modelMatrix が壊れていないかをチェック
        if (!isValidMatrix(activeLayer.modelMatrix)) {
            console.error('Invalid modelMatrix detected, reinitializing...');
            activeLayer.modelMatrix = mat4.create();
        }

        // 📌 6. レイヤー移動処理（V + ドラッグ）
        if (this.isLayerMoving) {
            const dx = e.clientX - this.transformStartX;
            const dy = e.clientY - this.transformStartY;
            if (!isFinite(dx) || !isFinite(dy)) return;

            const newMatrix = mat4.clone(this.originalModelMatrix);
            mat4.translate(newMatrix, newMatrix, [dx, dy, 0]);
            activeLayer.modelMatrix = newMatrix;
            activeLayer.gpuDirty = true;
            this.renderAllLayers();
            return;
        }

        if (!this.isDrawing) return;
        const coords = this.getCanvasCoordinates(e);
        if (!coords) { this.lastPoint = null; return; }

        // 📌 4. マウス描画処理では transformWorldToLocal を必ず通して描く
        const local = transformWorldToLocal(coords.x, coords.y, activeLayer.modelMatrix);
        console.log('[描画位置] World(' + coords.x + ', ' + coords.y + ') → Local(' + local.x + ', ' + local.y + ')');

        if (!this.lastPoint) { 
            this.pressureHistory = [e.pressure > 0 ? e.pressure : 0.5];
            this.lastPoint = { x: local.x, y: local.y, pressure: e.pressure > 0 ? e.pressure : 0.5 }; 
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
        this._updateDirtyRect(local.x, local.y, currentSize);

        this.renderingBridge.drawLine(
            this.lastPoint.x, this.lastPoint.y, local.x, local.y,
            this.currentSize, hexToRgba(this.currentColor), this.currentTool === 'eraser',
            this.lastPoint.pressure, currentPressure, 
            this.calculatePressureSize.bind(this),
            activeLayer
        );
        
        this.lastPoint = { x: local.x, y: local.y, pressure: currentPressure };
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

        // 📌 6. レイヤー移動処理終了
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
                layer.modelMatrix.set(layerData.modelMatrix);
            } else {
                // 📌 1. レイヤー読み込み時もmodelMatrixを初期化
                layer.modelMatrix = mat4.create();
            }
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

        const gl = this.renderingBridge.currentEngine?.gl;
        if (gl) {
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
            console.error("WebGL context not available for export.");
        }
        
        const dataURL = exportCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = 'merged_image.png';
        link.click();
    }
    updateCursor() { 
        let cursor = 'crosshair'; 
        if (this.isVDown) cursor = 'move'; 
        if (this.isSpaceDown) cursor = 'grab'; 
        if (this.currentTool === 'eraser') cursor = 'cell'; 
        if (this.currentTool === 'bucket') cursor = 'copy'; 
        this.canvasArea.style.cursor = cursor; 
    }
    applyViewTransform() { const t = this.viewTransform; this.canvasContainer.style.transform = `translate(${t.left}px, ${t.top}px) scale(${t.scale * t.flipX}, ${t.scale * t.flipY}) rotate(${t.rotation}deg)`; }
    flipHorizontal() { this.viewTransform.flipX *= -1; this.applyViewTransform(); }
    flipVertical() { this.viewTransform.flipY *= -1; this.applyViewTransform(); }
    zoom(factor) { this.viewTransform.scale = Math.max(0.1, this.viewTransform.scale * factor); this.applyViewTransform(); }
    rotate(degrees) { this.viewTransform.rotation = (this.viewTransform.rotation + degrees) % 360; this.applyViewTransform(); }
    resetView() { this.viewTransform = { scale: 1, rotation: 0, flipX: 1, flipY: 1, left: 0, top: 0 }; this.applyViewTransform(); }
    handleWheel(e) { e.preventDefault(); if (e.shiftKey) { this.rotate(-e.deltaY * 0.2); } else { this.zoom(e.deltaY > 0 ? 1 / 1.05 : 1.05); } }
}

// ✨ LayerManager, PenSettingsManager, ColorManager, ToolManager のクラス定義はここからゴッソリ削除されました。

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