/*
 * ===================================================================================
 * Toshinka Tegaki Tool - Core Engine
 * Version: 1.9 (Phase 3 Architecture)
 *
 * このファイルはアプリケーションの中核です。
 * 描画エンジン、UIモジュール、ツールを読み込み、全体を統括します。
 * ===================================================================================
 *
 * --- HTML依存リスト ---
 * このスクリプトが動作するために、HTML側に以下のidまたはclassを持つ要素が必要です。
 *
 * [Canvas/Area]
 * - drawingCanvas: メインの描画キャンバス
 * - canvas-area: キャンバスを内包する領域（ポインタイベント用）
 * - canvas-container: キャンバスの拡縮・回転用コンテナ
 * - center-crosshair: Vキー押下時に表示される十字線
 *
 * [Top Toolbar]
 * - saveMergedButton: PNG保存ボタン
 * - undo-btn: 元に戻すボタン
 * - redo-btn: やり直しボタン
 * - clear-btn: アクティブレイヤー消去ボタン
 * - flip-h-btn: 左右反転ボタン
 * - flip-v-btn: 上下反転ボタン
 * - zoom-in-btn: 拡大ボタン
 * - zoom-out-btn: 縮小ボタン
 * - rotate-btn: 時計回り回転ボタン
 * - rotate-ccw-btn: 反時計回り回転ボタン
 * - reset-view-btn: 表示リセットボタン
 * - close-btn: 閉じるボタン
 *
 * [Left Toolbar]
 * - main-color-display: メインカラー表示部
 * - sub-color-display: サブカラー表示部
 * - pen-tool: ペンツールボタン
 * - eraser-tool: 消しゴムツールボタン
 * - bucket-tool: 塗りつぶしツールボタン
 * - move-tool: レイヤー移動ツールボタン
 * - (class) color-btn: 各カラーボタン
 * - (class) color-mode-display: カラー切り替え表示エリア
 * - (class) size-btn: 各サイズボタン
 *
 * [Right Sidebar (Layers)]
 * - layer-list: レイヤー一覧を表示するコンテナ
 * - add-layer-btn: 新規レイヤー追加ボタン
 * - delete-layer-btn: レイヤー削除ボタン
 * - duplicate-layer-btn: レイヤー複製ボタン
 * - merge-layer-btn: レイヤー結合ボタン
 * - (class) layer-blend-mode-select: (Phase3追加) 各レイヤーのブレンドモード選択UI (例: <select>)
 *
 * ===================================================================================
 */

// --- Module Imports ---
import { TopBarManager, LayerUIManager } from './ui/ui-manager.js';
import { ShortcutManager } from './ui/shortcut-manager.js';
import { BucketTool } from './tools/toolset.js';
import { Canvas2DEngine } from './core/canvas2d-engine.js';


// --- Core Logic Classes ---

function hexToRgba(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16), a: 255
    } : { r: 0, g: 0, b: 0, a: 255 };
}

class Layer {
    constructor(name, width, height) {
        this.name = name;
        this.visible = true;
        this.blendMode = 'source-over'; // Phase3追加: ブレンドモード (normal)
        this.imageData = new ImageData(width, height);
        this.transform = { x: 0, y: 0, scale: 1, rotation: 0 };
        this.originalImageData = null;
    }
    clear(engine, hexColor) {
        if (hexColor) {
            engine.fillLayer(this, hexColor);
        } else {
            engine.clearLayer(this);
        }
    }
}

class CanvasManager {
    constructor(app, engine) {
        this.app = app;
        this.drawingEngine = engine; // 描画エンジンへの参照
        this.displayCanvas = document.getElementById('drawingCanvas');
        this.canvasArea = document.getElementById('canvas-area');
        this.canvasContainer = document.getElementById('canvas-container');
        this.width = this.displayCanvas.width;
        this.height = this.displayCanvas.height;

        this.isDrawing = false; this.isPanning = false; this.isSpaceDown = false;
        this.isVDown = false; this.isShiftDown = false;
        this.isLayerTransforming = false;
        this.transformTargetLayer = null; this.originalLayerTransform = null;
        this.transformMode = 'move'; this.transformStartX = 0; this.transformStartY = 0;
        
        this.currentTool = 'pen';
        this.currentColor = '#800000'; this.currentSize = 1;
        this.lastPoint = null;
        this.history = []; this.historyIndex = -1;
        this.dirtyRect = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
        this.animationFrameId = null;
        
        this.dragStartX = 0; this.dragStartY = 0; this.canvasStartX = 0; this.canvasStartY = 0;
        this.viewTransform = { scale: 1, rotation: 0, flipX: 1, flipY: 1, left: 0, top: 0 };
        
        this.pressureSettings = {
            sensitivity: 0.8, minPressure: 0.1, maxPressure: 1.0, curve: 0.7,
            minSizeRatio: 0.3, dynamicRange: true
        };
        this.drawingQuality = {
            enableSubpixel: true, antialiasThreshold: 2.0, minDrawSteps: 1, maxDrawSteps: 100
        };
        
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

        if (this.isVDown) { this.startLayerTransform(e); e.preventDefault(); return; }
        if (this.isSpaceDown) {
            this.dragStartX = e.clientX; this.dragStartY = e.clientY; this.isPanning = true;
            this.canvasStartX = this.viewTransform.left; this.canvasStartY = this.viewTransform.top;
            e.preventDefault(); return;
        }

        const coords = this.getCanvasCoordinates(e);
        if (!coords) return;
        
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer || !activeLayer.visible) return;
        
        if (this.currentTool === 'bucket') {
            // バケツツールの処理を描画エンジンに委譲
            this.drawingEngine.floodFill(activeLayer, coords.x, coords.y, hexToRgba(this.currentColor));
            this.renderAllLayers();
            this.saveState();
            return;
        }

        this.isDrawing = true;
        this.lastPoint = { ...coords, pressure: e.pressure || 1.0 };
        
        // 点の描画を描画エンジンに委譲
        const size = this.drawingEngine._calculatePressureSize(this.currentSize, e.pressure || 1.0, this.pressureSettings);
        this._updateDirtyRect(coords.x, coords.y, size/2);
        this.drawingEngine.drawCircle(activeLayer, coords.x, coords.y, size / 2, hexToRgba(this.currentColor), this.currentTool === 'eraser');
        
        this._requestRender();
        document.documentElement.setPointerCapture(e.pointerId);
    }
    
    onPointerMove(e) {
        if (this.isLayerTransforming) {
            const dx = e.clientX - this.transformStartX; const dy = e.clientY - this.transformStartY;
            const t = this.transformTargetLayer.transform; const ot = this.originalLayerTransform;
            if (this.transformMode === 'move') { t.x = ot.x + dx; t.y = ot.y + dy; }
            else { t.rotation = ot.rotation + dx * 0.5; const scaleFactor = 1 - dy * 0.005; t.scale = Math.max(0.1, ot.scale * scaleFactor); }
            this._applyLiveTransform(); return;
        }
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
        if (!this.lastPoint) { this.lastPoint = { ...coords, pressure: e.pressure || 1.0 }; return; }

        // 線の描画を描画エンジンに委譲
        this._updateDirtyRect(this.lastPoint.x, this.lastPoint.y, this.currentSize);
        this._updateDirtyRect(coords.x, coords.y, this.currentSize);
        this.drawingEngine.drawLine(
            activeLayer, this.lastPoint, coords, this.currentSize, hexToRgba(this.currentColor),
            this.currentTool === 'eraser', this.pressureSettings, this.drawingQuality
        );

        this.lastPoint = { ...coords, pressure: e.pressure || 1.0 };
        this._requestRender();
    }

    onPointerUp(e) {
        if (this.isLayerTransforming) { this.commitLayerTransform(); }
        if (this.isDrawing) {
            this.isDrawing = false;
            this.drawingEngine.pressureHistory = []; // 筆圧履歴をリセット
            if (this.animationFrameId) { cancelAnimationFrame(this.animationFrameId); this.animationFrameId = null; }
            this._renderDirty();
            this.lastPoint = null;
            this.saveState();
        }
        this.isPanning = false;
        if (document.documentElement.hasPointerCapture(e.pointerId)) {
            document.documentElement.releasePointerCapture(e.pointerId);
        }
    }

    _renderDirty() {
        // ダーティレクトに基づいた再描画を描画エンジンに委譲
        this.drawingEngine.compositeAndRender(this.app.layerManager.layers, this.dirtyRect);
        this._resetDirtyRect();
    }

    renderAllLayers() {
        this._updateDirtyRect(this.width / 2, this.height / 2, Math.max(this.width, this.height));
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

    getCanvasCoordinates(e) {
        try {
            const rect = this.displayCanvas.getBoundingClientRect();
            let x = e.clientX - rect.left; let y = e.clientY - rect.top;
            if (this.viewTransform.flipX === -1) { x = this.width - x; }
            if (this.viewTransform.flipY === -1) { y = this.height - y; }
            if (x < 0 || x >= this.width || y < 0 || y >= this.height) return null;
            return { x: Math.floor(x), y: Math.floor(y) };
        } catch (error) { console.warn('座標変換エラー:', error); return null; }
    }

    startLayerTransform(e = null) {
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer || this.app.layerManager.layers.indexOf(activeLayer) === 0) return;
        this.isLayerTransforming = true;
        this.transformTargetLayer = activeLayer;
        this.transformTargetLayer.originalImageData = new ImageData( new Uint8ClampedArray(this.transformTargetLayer.imageData.data), this.transformTargetLayer.imageData.width, this.transformTargetLayer.imageData.height );
        this.originalLayerTransform = { ...this.transformTargetLayer.transform };
        if (e) {
            this.transformMode = this.isShiftDown ? 'rotate_scale' : 'move';
            this.transformStartX = e.clientX; this.transformStartY = e.clientY;
        }
    }

    _applyLiveTransform() {
        if (!this.transformTargetLayer || !this.transformTargetLayer.originalImageData) return;
        const layer = this.transformTargetLayer;
        // 変形処理を描画エンジンに委譲
        layer.imageData = this.drawingEngine.getTransformedImageData(layer.originalImageData, layer.transform);
        this.renderAllLayers();
    }
    
    commitLayerTransform() {
        if (!this.isLayerTransforming) return;
        this._applyLiveTransform(); // 最終状態を適用
        this.transformTargetLayer.originalImageData = null; // 元データを破棄
        this.transformTargetLayer.transform = { x: 0, y: 0, scale: 1, rotation: 0 }; // 変形情報をリセット
        this.isLayerTransforming = false;
        this.transformTargetLayer = null;
        this.originalLayerTransform = null;
        this.renderAllLayers();
        this.saveState();
    }

    saveState() {
        if (this.isLayerTransforming) return;
        const state = {
            layers: this.app.layerManager.layers.map(layer => ({
                name: layer.name,
                visible: layer.visible,
                blendMode: layer.blendMode, // blendModeも保存
                imageData: new ImageData(
                    new Uint8ClampedArray(layer.imageData.data),
                    layer.imageData.width, layer.imageData.height
                )
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
            layer.blendMode = layerData.blendMode || 'source-over'; // 復元
            layer.imageData.data.set(layerData.imageData.data);
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
            const isBg = this.app.layerManager.activeLayerIndex === 0;
            activeLayer.clear(this.drawingEngine, isBg ? '#f0e0d6' : null);
            this.renderAllLayers();
            this.saveState();
        }
    }

    exportMergedImage() {
        // エクスポート処理を描画エンジンに委譲
        const dataURL = this.drawingEngine.exportToDataURL(this.app.layerManager.layers);
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

    applyViewTransform() {
        const t = this.viewTransform;
        this.canvasContainer.style.transform = `translate(${t.left}px, ${t.top}px) scale(${t.scale * t.flipX}, ${t.scale * t.flipY}) rotate(${t.rotation}deg)`;
    }
    
    flipHorizontal() { this.viewTransform.flipX *= -1; this.applyViewTransform(); }
    flipVertical() { this.viewTransform.flipY *= -1; this.applyViewTransform(); }
    zoom(factor) { this.viewTransform.scale = Math.max(0.1, this.viewTransform.scale * factor); this.applyViewTransform(); }
    rotate(degrees) { this.viewTransform.rotation = (this.viewTransform.rotation + degrees) % 360; this.applyViewTransform(); }
    resetView() { this.viewTransform = { scale: 1, rotation: 0, flipX: 1, flipY: 1, left: 0, top: 0 }; this.applyViewTransform(); }
    handleWheel(e) { e.preventDefault(); if (e.shiftKey) { this.rotate(-e.deltaY * 0.2); } else { this.zoom(e.deltaY > 0 ? 1 / 1.05 : 1.05); } }
}

class LayerManager {
    constructor(app) {
        this.app = app;
        this.layers = [];
        this.activeLayerIndex = -1;
        this.width = 344; this.height = 135;
    }
    setupInitialLayers() {
        const bgLayer = new Layer('背景', this.width, this.height);
        bgLayer.clear(this.app.drawingEngine, '#f0e0d6'); // 描画エンジン経由でクリア
        this.layers.push(bgLayer);
        
        const drawingLayer = new Layer('レイヤー 1', this.width, this.height);
        this.layers.push(drawingLayer);
        
        this.switchLayer(1);
        this.app.canvasManager.renderAllLayers();
        this.app.canvasManager.saveState();
    }
    addLayer() {
        if (this.layers.length >= 99) return;
        const insertIndex = this.activeLayerIndex + 1;
        const newLayer = new Layer(`レイヤー ${this.layers.length + 1}`, this.width, this.height);
        this.layers.splice(insertIndex, 0, newLayer);
        this.renameLayers();
        this.switchLayer(insertIndex);
        this.app.canvasManager.saveState();
    }
    deleteActiveLayer() {
        if (this.activeLayerIndex === 0 || this.layers.length <= 1) return;
        this.layers.splice(this.activeLayerIndex, 1);
        const newActiveIndex = Math.min(this.layers.length - 1, this.activeLayerIndex);
        this.renameLayers();
        this.switchLayer(newActiveIndex);
        this.app.canvasManager.renderAllLayers();
        this.app.canvasManager.saveState();
    }
    renameLayers() { this.layers.forEach((layer, index) => { layer.name = index === 0 ? '背景' : `レイヤー ${index}`; }); }
    switchLayer(index) { if (index < 0 || index >= this.layers.length) return; this.activeLayerIndex = index; if (this.app.layerUIManager) { this.app.layerUIManager.renderLayers(); } }
    getCurrentLayer() { return this.layers[this.activeLayerIndex] || null; }
    duplicateActiveLayer() {
        const activeLayer = this.getCurrentLayer();
        if (!activeLayer) return;
        const newLayer = new Layer(`${activeLayer.name}のコピー`, this.width, this.height);
        newLayer.imageData.data.set(activeLayer.imageData.data);
        newLayer.visible = activeLayer.visible;
        newLayer.blendMode = activeLayer.blendMode; // blendModeもコピー
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

        // レイヤー結合を描画エンジンに委譲
        this.app.drawingEngine.mergeLayers(topLayer, bottomLayer);

        this.layers.splice(this.activeLayerIndex, 1);
        this.switchLayer(this.activeLayerIndex - 1);
        this.app.canvasManager.renderAllLayers();
        this.app.canvasManager.saveState();
    }
}

class PenSettingsManager { constructor(app) { this.app = app; this.currentSize = 1; this.sizes = Array.from(document.querySelectorAll('.size-btn')).map(btn => parseInt(btn.dataset.size)); this.currentSizeIndex = this.sizes.indexOf(this.currentSize); this.bindEvents(); this.updateSizeButtonVisuals(); } bindEvents() { document.querySelectorAll('.size-btn').forEach(btn => btn.addEventListener('click', () => this.setSize(parseInt(btn.dataset.size)))); } setSize(size) { this.currentSize = size; this.currentSizeIndex = this.sizes.indexOf(this.currentSize); document.querySelectorAll('.size-btn').forEach(btn => btn.classList.remove('active')); document.querySelector(`[data-size="${size}"]`)?.classList.add('active'); this.app.canvasManager.setCurrentSize(this.currentSize); this.updateSizeButtonVisuals(); } changeSize(increase) { let newIndex = this.currentSizeIndex + (increase ? 1 : -1); newIndex = Math.max(0, Math.min(newIndex, this.sizes.length - 1)); this.setSize(this.sizes[newIndex]); } updateSizeButtonVisuals() { document.querySelectorAll('.size-btn').forEach(btn => { const size = parseInt(btn.dataset.size); btn.querySelector('.size-dot').style.width = `${Math.min(size, 16)}px`; btn.querySelector('.size-dot').style.height = `${Math.min(size, 16)}px`; btn.querySelector('.size-number').textContent = size; }); } }
class ColorManager { constructor(app) { this.app = app; this.mainColor = '#800000'; this.subColor = '#f0e0d6'; this.colors = Array.from(document.querySelectorAll('.color-btn')).map(btn => btn.dataset.color); this.currentColorIndex = this.colors.indexOf(this.mainColor); this.mainColorDisplay = document.getElementById('main-color-display'); this.subColorDisplay = document.getElementById('sub-color-display'); this.bindEvents(); this.updateColorDisplays(); document.querySelector(`[data-color="${this.mainColor}"]`)?.classList.add('active'); } bindEvents() { document.querySelectorAll('.color-btn').forEach(btn => btn.addEventListener('click', (e) => this.setColor(e.currentTarget.dataset.color))); document.querySelector('.color-mode-display').addEventListener('click', () => this.swapColors()); } setColor(color) { this.mainColor = color; this.currentColorIndex = this.colors.indexOf(this.mainColor); document.querySelectorAll('.color-btn').forEach(btn => btn.classList.remove('active')); document.querySelector(`[data-color="${color}"]`)?.classList.add('active'); this.updateColorDisplays(); this.app.canvasManager.setCurrentColor(this.mainColor); } updateColorDisplays() { this.mainColorDisplay.style.backgroundColor = this.mainColor; this.subColorDisplay.style.backgroundColor = this.subColor; } swapColors() { [this.mainColor, this.subColor] = [this.subColor, this.mainColor]; this.updateColorDisplays(); this.setColor(this.mainColor); } resetColors() { this.setColor('#800000'); this.subColor = '#f0e0d6'; this.updateColorDisplays(); } changeColor(increase) { let newIndex = this.currentColorIndex + (increase ? 1 : -1); newIndex = (newIndex + this.colors.length) % this.colors.length; this.setColor(this.colors[newIndex]); } }
class ToolManager { constructor(app) { this.app = app; this.currentTool = 'pen'; this.bindEvents(); } bindEvents() { document.getElementById('pen-tool').addEventListener('click', () => this.setTool('pen')); document.getElementById('eraser-tool').addEventListener('click', () => this.setTool('eraser')); document.getElementById('bucket-tool').addEventListener('click', () => this.setTool('bucket')); document.getElementById('move-tool').addEventListener('click', () => this.setTool('move')); } setTool(tool) { this.currentTool = tool; document.querySelectorAll('.left-toolbar .tool-btn').forEach(btn => btn.classList.remove('active')); document.getElementById(tool + '-tool')?.classList.add('active'); this.app.canvasManager.setCurrentTool(tool); } }


// --- Main Application Class ---

class ToshinkaTegakiTool {
    constructor() {
        this.initManagers();
    }

    initManagers() {
        // Core Logic Managers
        const canvasEl = document.getElementById('drawingCanvas');
        this.drawingEngine = new Canvas2DEngine(canvasEl, canvasEl.width, canvasEl.height);
        this.canvasManager = new CanvasManager(this, this.drawingEngine);
        this.drawingEngine.app = this; // エンジンからAppへの逆参照を設定

        this.layerManager = new LayerManager(this);
        this.penSettingsManager = new PenSettingsManager(this);
        this.colorManager = new ColorManager(this);
        this.toolManager = new ToolManager(this);

        // UI Managers (Loaded from modules)
        this.topBarManager = new TopBarManager(this);
        this.shortcutManager = new ShortcutManager(this);
        this.layerUIManager = new LayerUIManager(this);

        // Tool Managers (Loaded from modules)
        this.bucketTool = new BucketTool(this);

        // Initialize System
        this.shortcutManager.initialize();
        this.layerManager.setupInitialLayers(); // この中で最初の描画とsaveStateが走る
        this.toolManager.setTool('pen');
        this.penSettingsManager.setSize(1);
        this.colorManager.setColor(this.colorManager.mainColor);
    }
}

// --- Application Entry Point ---

window.addEventListener('DOMContentLoaded', () => {
    if (!window.toshinkaTegakiInitialized) {
        window.toshinkaTegakiInitialized = true;
        window.toshinkaTegakiTool = new ToshinkaTegakiTool();
    }
});