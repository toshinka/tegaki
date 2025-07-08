/*
 * ===================================================================================
 * Toshinka Tegaki Tool - Core Engine
 * Version: 3.2.1 (Phase 4A11B-12 - Improved Caching & Transfer)
 *
 * - 変更点 (Phase 4A11B-12):
 * - 「📜 Phase 4A11B-12」指示書に基づき、画質劣化防止策を導入し、
 * IndexedDBの復元処理を安定化させました。
 *
 * - 1. 劣化防止の転写:
 * - レイヤー変形時(Vキー)のデータ転写を、従来の `drawImage` から
 * `ImageData` の直接操作に変更。これにより、転写を繰り返しても
 * 画質が一切劣化しなくなりました。 (transfer-utils.js)
 *
 * - 2. 安定したDB復元:
 * - IndexedDBからレイヤーを復元する際に、アンチエイリアスを無効化した
 * 安全な画像読み込み関数 (`loadImageWithoutSmoothing`) を使用することで、
 * 復元時の画質劣化も防止します。
 *
 * - 3. 依存関係の整理:
 * - 各マネージャーやユーティリティのインポート文を整理し、
 * 初期化処理の堅牢性を高めました。
 * ===================================================================================
 */

// --- glMatrix 定義 ---
const mat4 = window.glMatrix.mat4;

// --- Module Imports ---
import { TopBarManager, LayerUIManager } from './ui/ui-manager.js';
import { ShortcutManager } from './ui/shortcut-manager.js';
import { BucketTool } from './tools/toolset.js';
import { RenderingBridge } from './core/rendering/rendering-bridge.js';
import { LayerManager } from './layer-manager/layer-manager.js';
import { PenSettingsManager } from './ui/pen-settings-manager.js';
import { ColorManager } from './ui/color-manager.js';
import { ToolManager } from './ui/tool-manager.js';
import { isValidMatrix, transformWorldToLocal } from './core/utils/transform-utils.js';
// [改修] IndexedDBと画質劣化防止ユーティリティをインポート
import { saveLayerToIndexedDB, loadLayersFromIndexedDB } from './core/db/db-indexed.js';
import { transferToCell, transferFromCell, loadImageWithoutSmoothing } from './core/utils/transfer-utils.js';


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

// --- Core Logic Classes ---
export class Layer {
    static nextId = 0;
    constructor(name, width, height, id = null) {
        this.id = (id !== null) ? id : Layer.nextId++;
        this.name = name;
        this.visible = true;
        this.opacity = 100;
        this.blendMode = 'normal';
        this.imageData = new ImageData(width, height);
        this.modelMatrix = mat4.create();
        this.gpuDirty = true;
        
        if (this.id >= Layer.nextId) {
            Layer.nextId = this.id + 1;
        }
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
        this.isDraggingLayer = false;
        this.isLayerTransforming = false;
        this.cellBufferInitialized = false;
        this.isSpaceDown = false;
        this.isVDown = false;
        this.cellBuffer = null;
        this.lastPoint = null;
        this.transformStartWorldX = 0;
        this.transformStartWorldY = 0;
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

    bindEvents() {
        this.canvasArea.addEventListener('pointerdown', this.onPointerDown.bind(this));
        document.addEventListener('pointermove', this.onPointerMove.bind(this));
        document.addEventListener('pointerup', this.onPointerUp.bind(this));
        this.canvasArea.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
        document.addEventListener('contextmenu', e => e.preventDefault());
        document.getElementById('saveMergedButton')?.addEventListener('click', () => this.exportMergedImage());
    }

    // [追加] ToolManagerとの連携用メソッド (指示書 Phase 4A11B-11)
    setCurrentTool(tool) {
        // ToolManagerからツール変更の通知を受け取ります。
        // CanvasManagerは `this.app.toolManager.currentTool` で現在のツールを直接参照するため、
        // このメソッドは将来的な拡張性のために残されています。
    }
    
    _isPointOnLayer(worldCoords, layer) {
        if (!layer || !layer.visible) return false;
        const SUPER_SAMPLING_FACTOR = this.renderingBridge.currentEngine?.SUPER_SAMPLING_FACTOR || 1.0;
        const superX = worldCoords.x * SUPER_SAMPLING_FACTOR;
        const superY = worldCoords.y * SUPER_SAMPLING_FACTOR;
        const local = transformWorldToLocal(superX, superY, layer.modelMatrix);
        const layerWidth = this.width * SUPER_SAMPLING_FACTOR;
        const layerHeight = this.height * SUPER_SAMPLING_FACTOR;
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
            this.transformStartWorldX = coords.x;
            this.transformStartWorldY = coords.y;
            return;
        }
        if (!activeLayer.visible || !this._isPointOnLayer(coords, activeLayer)) return;
        const SUPER_SAMPLING_FACTOR = this.renderingBridge.currentEngine?.SUPER_SAMPLING_FACTOR || 1.0;
        const superX = coords.x * SUPER_SAMPLING_FACTOR;
        const superY = coords.y * SUPER_SAMPLING_FACTOR;
        const local = transformWorldToLocal(superX, superY, activeLayer.modelMatrix);
        this._resetDirtyRect();
        if (this.app.toolManager.currentTool === 'bucket') {
            this.app.bucketTool.fill(activeLayer.imageData, Math.round(local.x), Math.round(local.y), hexToRgba(this.app.colorManager.currentColor));
            activeLayer.gpuDirty = true;
            this.renderAllLayers();
            this.saveState();
            this.onDrawEnd?.(activeLayer);
            return;
        }
        this.isDrawing = true;
        this.pressureHistory = [e.pressure > 0 ? e.pressure : 0.5];
        this.lastPoint = { ...local, pressure: this.pressureHistory[0] };
        const size = this.calculatePressureSize(this.app.penSettingsManager.currentSize, this.lastPoint.pressure);
        this._updateDirtyRect(local.x, local.y, size);
        this.renderingBridge.drawCircle(local.x, local.y, size / 2, hexToRgba(this.app.colorManager.currentColor), this.app.toolManager.currentTool === 'eraser', activeLayer);
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
            const activeLayer = this.app.layerManager.getCurrentLayer();
            if (!activeLayer || !this.cellBufferInitialized) return;
            const dx = coords.x - this.transformStartWorldX;
            const dy = coords.y - this.transformStartWorldY;
            const SUPER_SAMPLING_FACTOR = this.renderingBridge.currentEngine?.SUPER_SAMPLING_FACTOR || 1.0;
            const adjustedDx = dx * SUPER_SAMPLING_FACTOR;
            const adjustedDy = dy * SUPER_SAMPLING_FACTOR;
            const translationMatrix = mat4.create();
            mat4.fromTranslation(translationMatrix, [adjustedDx, adjustedDy, 0]);
            const newMatrix = mat4.create();
            mat4.multiply(newMatrix, translationMatrix, this.cellBuffer.originalModelMatrix);
            activeLayer.modelMatrix = newMatrix;
            activeLayer.imageData.data.set(this.cellBuffer.imageData.data);
            activeLayer.gpuDirty = true;
            this.renderAllLayers();
            return;
        }
        if (this.isDrawing) {
            const activeLayer = this.app.layerManager.getCurrentLayer();
            if (!activeLayer) return;
            const SUPER_SAMPLING_FACTOR = this.renderingBridge.currentEngine?.SUPER_SAMPLING_FACTOR || 1.0;
            const superX = coords.x * SUPER_SAMPLING_FACTOR;
            const superY = coords.y * SUPER_SAMPLING_FACTOR;
            const local = transformWorldToLocal(superX, superY, activeLayer.modelMatrix);
            const currentPressure = e.pressure > 0 ? e.pressure : 0.5;
            this.pressureHistory.push(currentPressure);
            if (this.pressureHistory.length > this.maxPressureHistory) this.pressureHistory.shift();
            const lastSize = this.calculatePressureSize(this.app.penSettingsManager.currentSize, this.lastPoint.pressure);
            const currentSize = this.calculatePressureSize(this.app.penSettingsManager.currentSize, currentPressure);
            this._updateDirtyRect(this.lastPoint.x, this.lastPoint.y, lastSize);
            this._updateDirtyRect(local.x, local.y, currentSize);
            this.renderingBridge.drawLine(this.lastPoint.x, this.lastPoint.y, local.x, local.y, this.app.penSettingsManager.currentSize, hexToRgba(this.app.colorManager.currentColor), this.app.toolManager.currentTool === 'eraser', this.lastPoint.pressure, currentPressure, this.calculatePressureSize.bind(this), activeLayer);
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
                await this.onDrawEnd?.(activeLayer); // ★ IndexedDBに保存
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

    // [改修] 劣化防止転写を使用 (指示書 Step 4)
    startLayerTransform() {
        if (this.isLayerTransforming) return;
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer || !activeLayer.visible) return;
        this.isLayerTransforming = true;

        // 劣化防止関数でレイヤー内容をバッファにコピー
        this.cellBuffer = {};
        transferToCell(activeLayer, this.cellBuffer); // [cite: 24]
        this.cellBufferInitialized = true;
        
        // 元のレイヤーをクリア
        activeLayer.clear();
        this.renderAllLayers();
        
        // バッファの内容をレイヤーに戻して表示
        activeLayer.imageData.data.set(this.cellBuffer.imageData.data); // [cite: 25]
        activeLayer.gpuDirty = true;
        this.renderAllLayers();
    }

    // [改修] 劣化防止転写をコミット (指示書 Step 4)
    async commitLayerTransform() {
        if (!this.isLayerTransforming) return;
        this.isLayerTransforming = false;
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!this.cellBufferInitialized || !activeLayer) {
            this.cellBuffer = null;
            this.cellBufferInitialized = false;
            this.updateCursor();
            return;
        }

        // 変形後のImageDataを取得
        const transformedImageData = this.renderingBridge.getTransformedImageData(activeLayer);

        if (transformedImageData) {
            // 成功した場合、変形後のデータでレイヤーを更新
            activeLayer.imageData.data.set(transformedImageData.data);
            mat4.identity(activeLayer.modelMatrix);
        } else {
            // 失敗した場合、劣化防止関数で元の状態に復元
            transferFromCell(this.cellBuffer, activeLayer); // [cite: 28]
        }
        
        activeLayer.gpuDirty = true;
        await this.onDrawEnd?.(activeLayer); // ★ IndexedDBに保存 [cite: 29]
        
        this.cellBuffer = null;
        this.cellBufferInitialized = false;
        this.renderAllLayers();
        this.saveState();
    }
    
    // [改修] 劣化防止でキャンセル処理
    cancelLayerTransform() {
        if (!this.isLayerTransforming) return;
        this.isLayerTransforming = false;
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!this.cellBufferInitialized || !activeLayer) {
            this.cellBuffer = null;
            this.cellBufferInitialized = false;
            return;
        }
        // 劣化防止関数で元の状態に復元
        transferFromCell(this.cellBuffer, activeLayer);
        
        this.cellBuffer = null;
        this.cellBufferInitialized = false;
        this.renderAllLayers();
    }

    // [改修] 劣化防止でバックアップ復元
    restoreLayerBackup() {
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!this.cellBufferInitialized || !activeLayer) return;
        // 劣化防止関数で元の状態に復元
        transferFromCell(this.cellBuffer, activeLayer);
    }

    applyLayerTransform({ translation = [0, 0, 0], scale = 1.0, rotation = 0, flip = null }) {
        if (!this.isLayerTransforming || !this.cellBufferInitialized) return;
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer) return;
        const SUPER_SAMPLING_FACTOR = this.renderingBridge.currentEngine?.SUPER_SAMPLING_FACTOR || 1.0;
        const adjustedTranslation = [translation[0] * SUPER_SAMPLING_FACTOR, translation[1] * SUPER_SAMPLING_FACTOR, translation[2] * SUPER_SAMPLING_FACTOR];
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
        activeLayer.imageData.data.set(this.cellBuffer.imageData.data);
        activeLayer.gpuDirty = true;
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
            const layer = new Layer(layerData.name, layerData.imageData.width, layerData.imageData.height, layerData.id);
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
        if (activeLayer && this._isPointOnLayer(coords, activeLayer)) {
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
    handleWheel(e) { e.preventDefault(); if (e.shiftKey) { this.rotate(-e.deltaY * 0.2); } else { this.zoom(e.deltaY > 0 ? 1 / 1.05 : 1.05); } }
    exportMergedImage() { /* ... */ }
}

// --- Application Initialization ---
window.addEventListener('load', async () => {
    if (window.toshinkaTegakiInitialized) return;
    window.toshinkaTegakiInitialized = true;

    console.log("🛠️ アプリケーションの初期化を開始します...");

    const app = {};
    app.canvasManager = new CanvasManager(app);
    app.layerManager = new LayerManager(app);
    app.toolManager = new ToolManager(app);
    app.layerUIManager = new LayerUIManager(app);
    app.penSettingsManager = new PenSettingsManager(app);
    app.colorManager = new ColorManager(app);
    app.topBarManager = new TopBarManager(app);
    app.shortcutManager = new ShortcutManager(app);
    app.bucketTool = new BucketTool(app);
    window.toshinkaTegakiTool = app;

    app.canvasManager.onDrawEnd = async (layer) => {
        if (!layer) return;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = layer.imageData.width;
        tempCanvas.height = layer.imageData.height;
        // putImageDataで劣化なくピクセルをコピー
        tempCanvas.getContext('2d').putImageData(layer.imageData, 0, 0);
        const dataURL = tempCanvas.toDataURL();
        await saveLayerToIndexedDB(layer.id, layer.name, dataURL);
    };

    console.log("💾 IndexedDBからレイヤーデータの復元を試みます...");
    const storedLayers = await loadLayersFromIndexedDB();

    if (storedLayers && storedLayers.length > 0) {
        let maxId = 0;
        storedLayers.forEach(layerData => {
            app.layerManager.createLayer(layerData.id, layerData.name);
            if (layerData.id > maxId) maxId = layerData.id;
        });
        Layer.nextId = maxId + 1;
        
        // [改修] 劣化防止関数を使ってレイヤー画像を読み込む (指示書 Step 4)
        const loadPromises = storedLayers.map(layerData => {
           return new Promise(async (resolve, reject) => {
                const layer = app.layerManager.getLayerById(layerData.id);
                if (!layer) return reject(new Error(`Layer ID ${layerData.id} not found.`));
                
                try {
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = layer.imageData.width;
                    tempCanvas.height = layer.imageData.height;
                    
                    // 劣化防止読み込み関数を呼び出す [cite: 32]
                    await loadImageWithoutSmoothing(layerData.imageData, tempCanvas);
                    
                    const tempCtx = tempCanvas.getContext('2d');
                    layer.imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
                    layer.gpuDirty = true;
                    resolve();
                } catch (error) {
                    console.error(`❌ Layer ID ${layerData.id} の読み込みに失敗:`, error);
                    reject(error);
                }
            });
        });
        
        await Promise.all(loadPromises);
        
        const lastLayer = storedLayers.at(-1);
        if (lastLayer) {
            app.layerManager.switchLayerById(lastLayer.id);
        }
        console.log(`✅ ${storedLayers.length}件のレイヤーを劣化なしで復元しました。`);
    } else {
        console.log("DBにデータがないため、初期レイヤーを作成します。");
        app.layerManager.setupInitialLayers();
    }

    app.shortcutManager.initialize();
    app.layerUIManager.renderLayers?.();
    app.canvasManager.renderAllLayers();
    // [必須] 初期ツールを設定して起動時のエラーを防止 (指示書) 
    app.toolManager.setTool('pen'); 

    console.log("✅ アプリケーションの初期化が完了しました。");
});