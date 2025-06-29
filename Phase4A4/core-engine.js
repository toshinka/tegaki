/*
 * ===================================================================================
 * Toshinka Tegaki Tool - Core Engine
 * Version: 2.0.3 (Phase 4A-4 Debugging - getCanvasCoordinates focus)
 *
 * ・レイヤー結合時のエラーを修正
 * ・ビュー拡大縮小時のペン座標ズレを修正
 * ・★★getCanvasCoordinatesに詳細デバッグログを追加★★
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
        this.originalImageData = null;
    }
    clear() { this.imageData.data.fill(0); }
    fill(hexColor) { const color = hexToRgba(hexColor); const data = this.imageData.data; for (let i = 0; i < data.length; i += 4) { data[i] = color.r; data[i + 1] = color.g; data[i + 2] = color.b; data[i + 3] = color.a; } }
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
        console.log('CanvasManager.onPointerDown: Pointer Down Event Detected'); // ★デバッグログ
        if (e.button !== 0) return;
        
        const coords = this.getCanvasCoordinates(e);
        console.log('CanvasManager.onPointerDown: Canvas Coordinates:', coords); // ★デバッグログ
        
        if (this.isVDown) {
            this.startLayerTransform(e);
            e.preventDefault(); return;
        }
        if (this.isSpaceDown) {
            this.dragStartX = e.clientX; this.dragStartY = e.clientY; this.isPanning = true;
            this.canvasStartX = this.viewTransform.left; this.canvasStartY = this.viewTransform.top;
            e.preventDefault(); return;
        }

        if (!coords) {
            console.log('CanvasManager.onPointerDown: Coordinates are null. Skipping drawing.'); // ★デバッグログ
            return;
        }
        
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer || !activeLayer.visible) {
            console.log('CanvasManager.onPointerDown: No active layer or layer not visible. Skipping drawing.'); // ★デバッグログ
            return;
        }
        
        if (this.currentTool === 'bucket') {
            console.log('CanvasManager.onPointerDown: Tool is Bucket. Calling bucketTool.fill'); // ★デバッグログ
            this.app.bucketTool.fill(activeLayer.imageData, coords.x, coords.y, hexToRgba(this.currentColor));
            this.renderAllLayers();
            this.saveState();
            return;
        }

        this.isDrawing = true;
        this.lastPoint = { ...coords, pressure: e.pressure || 1.0 };
        this.pressureHistory = [e.pressure || 1.0];
        
        const size = this.calculatePressureSize(this.currentSize, e.pressure || 1.0);
        
        this._updateDirtyRect(coords.x, coords.y, size);
        console.log('CanvasManager.onPointerDown: Calling renderingBridge.drawCircle'); // ★デバッグログ
        this.renderingBridge.drawCircle(
            activeLayer.imageData, coords.x, coords.y, size / 2, 
            this.currentColor, this.currentTool === 'eraser' // WebGL EngineはhexColorを受け取る
        );
        
        this._requestRender();
        document.documentElement.setPointerCapture(e.pointerId);
    }
    
    onPointerMove(e) {
        // console.log('CanvasManager.onPointerMove: Pointer Move Event Detected'); // ★デバッグログ (量が多いのでコメントアウト)
        if (this.isLayerTransforming) {
            const dx = e.clientX - this.transformStartX; const dy = e.clientY - this.transformStartY;
            const t = this.transformTargetLayer.transform; const ot = this.originalLayerTransform;
            if (this.transformMode === 'move') {
                // ★★★ 座標ズレ修正: 移動量にもスケールを反映 ★★★
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
        
        const coords = this.getCanvasCoordinates(e);
        if (!coords) {
            this.lastPoint = null;
            console.log('CanvasManager.onPointerMove: Coordinates are null. Stopping drawing for this move.'); // ★デバッグログ
            return;
        }
        
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer || !activeLayer.visible) {
            console.log('CanvasManager.onPointerMove: No active layer or layer not visible. Skipping drawing.'); // ★デバッグログ
            return;
        }
        if (!this.lastPoint) { this.lastPoint = { ...coords, pressure: e.pressure || 1.0 }; return; }
        
        const currentPressure = e.pressure || 1.0;
        
        this._updateDirtyRect(this.lastPoint.x, this.lastPoint.y, this.currentSize * 2);
        this._updateDirtyRect(coords.x, coords.y, this.currentSize * 2);
        
        console.log('CanvasManager.onPointerMove: Calling renderingBridge.drawLine'); // ★デバッグログ
        this.renderingBridge.drawLine(
            activeLayer.imageData, this.lastPoint.x, this.lastPoint.y, coords.x, coords.y,
            this.currentSize, this.currentColor, this.currentTool === 'eraser', // WebGL EngineはhexColorを受け取る
            this.lastPoint.pressure, currentPressure, 
            this.calculatePressureSize.bind(this)
        );
        
        this.lastPoint = { ...coords, pressure: currentPressure };
        this._requestRender();
    }
    onPointerUp(e) {
        console.log('CanvasManager.onPointerUp: Pointer Up Event Detected'); // ★デバッグログ
        if (this.isLayerTransforming) { this.commitLayerTransform(); }
        if (this.isDrawing) {
            this.isDrawing = false; this.pressureHistory = [];
            if (this.animationFrameId) { cancelAnimationFrame(this.animationFrameId); this.animationFrameId = null; }
            this._renderDirty();
            this.lastPoint = null; this.saveState();
        }
        this.isPanning = false;
        if (document.documentElement.hasPointerCapture(e.pointerId)) {
            document.documentElement.releasePointerCapture(e.pointerId);
        }
    }

    _renderDirty() {
        console.log('CanvasManager._renderDirty: Rendering dirty rect.'); // ★デバッグログ
        const rect = this.dirtyRect;
        if (rect.minX > rect.maxX) return;

        this.renderingBridge.compositeLayers(this.app.layerManager.layers, this.compositionData, rect);
        
        this.renderingBridge.renderToDisplay(this.compositionData, rect);

        this._resetDirtyRect();
    }

    renderAllLayers() {
        console.log('CanvasManager.renderAllLayers: Rendering all layers.'); // ★デバッグログ
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

    calculatePressureSize(baseSizeInput, pressure) {
        const baseSize = Math.max(0.1, baseSizeInput);
        let normalizedPressure = Math.max(0, Math.min(1, pressure || 0));
        if (normalizedPressure === 0) {
            normalizedPressure = this.pressureSettings.minPressure;
        }
        this.pressureHistory.push(normalizedPressure);
        if (this.pressureHistory.length > this.maxPressureHistory) {
            this.pressureHistory.shift();
        }
        const smoothedPressure = this.pressureHistory.reduce((sum, p) => sum + p, 0) / this.pressureHistory.length;
        let adjustedPressure = smoothedPressure;
        if (this.pressureSettings.dynamicRange) {
            const minHist = Math.min(...this.pressureHistory);
            const maxHist = Math.max(...this.pressureHistory);
            const range = maxHist - minHist;
            if (range > 0.1) {
                adjustedPressure = (smoothedPressure - minHist) / range;
            }
        }
        const curve = this.pressureSettings.curve;
        const curvedPressure = Math.pow(adjustedPressure, curve);
        const minSize = baseSize * this.pressureSettings.minSizeRatio;
        const maxSize = baseSize;
        const finalSize = minSize + (maxSize - minSize) * curvedPressure * this.pressureSettings.sensitivity;
        return Math.max(0.1, finalSize);
    }

    // ★★★ 座標ズレ修正: getCanvasCoordinatesを修正 ★★★
    getCanvasCoordinates(e) {
        try {
            const rect = this.displayCanvas.getBoundingClientRect();
            console.log('getCanvasCoordinates: Bounding Rect:', rect.left, rect.top, rect.width, rect.height); // ★追加ログ

            // rect.widthが0になるのを防ぐ
            if (rect.width === 0 || rect.height === 0) {
                console.warn('getCanvasCoordinates: Bounding Rect has zero width or height.', rect); // ★追加ログ
                return null;
            }

            // ビューポート上のクリック位置から、canvas要素の左上隅までの相対座標を計算
            let x = e.clientX - rect.left;
            let y = e.clientY - rect.top;
            console.log('getCanvasCoordinates: Raw Relative Coords (after rect offset):', x, y); // ★追加ログ

            // 表示上のサイズ(rect.width)と、ImageDataの本来のサイズ(this.width)の比率を使って座標をスケールする
            // これにより、CSSによる拡大・縮小を逆算する
            // ※注意: この計算は回転がない場合には正確ですが、回転がかかるとズレが生じます。
            x = x * (this.width / rect.width);
            y = y * (this.height / rect.height);
            console.log('getCanvasCoordinates: Scaled Coords:', x, y); // ★追加ログ

            // ビューの反転を考慮 (これはImageDataに対する反転なので、スケール後に適用)
            if (this.viewTransform.flipX === -1) { x = this.width - x; }
            if (this.viewTransform.flipY === -1) { y = this.height - y; }
            console.log('getCanvasCoordinates: Flipped Coords:', x, y); // ★追加ログ

            // 座標がキャンバスの範囲外に出ていないかチェック
            if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
                console.warn('getCanvasCoordinates: Final Coords out of bounds:', x, y, 'Canvas size:', this.width, this.height); // ★追加ログ
                return null;
            }

            return { x: Math.floor(x), y: Math.floor(y) };
        } catch (error) {
            console.warn('CanvasManager.getCanvasCoordinates: 座標変換エラー:', error); // ★追加ログ
            return null;
        }
    }

    startLayerTransform(e = null) {
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer || this.app.layerManager.layers.indexOf(activeLayer) === 0) return;
        
        this.isLayerTransforming = true;
        this.transformTargetLayer = activeLayer;
        
        if (!this.transformTargetLayer.originalImageData) {
            this.transformTargetLayer.originalImageData = new ImageData(
                new Uint8ClampedArray(this.transformTargetLayer.imageData.data),
                this.transformTargetLayer.imageData.width,
                this.transformTargetLayer.imageData.height
            );
        }
        this.originalLayerTransform = { ...this.transformTargetLayer.transform };

        if (e) {
            this.transformMode = this.isShiftDown ? 'rotate_scale' : 'move';
            this.transformStartX = e.clientX;
            this.transformStartY = e.clientY;
        }
    }
    
    applyLayerTransformPreview() {
        if (!this.transformTargetLayer || !this.transformTargetLayer.originalImageData) return;
        const layer = this.transformTargetLayer;
        const transformedImageData = this.renderingBridge.getTransformedImageData(layer.originalImageData, layer.transform);
        layer.imageData = transformedImageData;
        this.renderAllLayers();
    }

    commitLayerTransform() {
        if (!this.isLayerTransforming) return;
        this.applyLayerTransformPreview();
        const layer = this.transformTargetLayer;
        layer.originalImageData = null;
        layer.transform = { x: 0, y: 0, scale: 1, rotation: 0, flipX: 1, flipY: 1 };
        
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
                name: layer.name,
                visible: layer.visible,
                opacity: layer.opacity,
                blendMode: layer.blendMode,
                imageData: new ImageData(
                    new Uint8ClampedArray(layer.imageData.data),
                    layer.imageData.width,
                    layer.imageData.height
                ),
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
            if (layerData.transform) {
                layer.transform = { ...layerData.transform };
            }
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
        
        exportCtx.putImageData(this.compositionData, 0, 0);
        
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
        this.width = 344; 
        this.height = 135;
        // ★★★ エラー修正: レイヤー結合で使う一時キャンバスを保持 ★★★
        this.mergeCanvas = document.createElement('canvas');
        this.mergeCanvas.width = this.width;
        this.mergeCanvas.height = this.height;
        this.mergeCtx = this.mergeCanvas.getContext('2d');
    } 
    setupInitialLayers() { const bgLayer = new Layer('背景', this.width, this.height); bgLayer.fill('#f0e0d6'); this.layers.push(bgLayer); const drawingLayer = new Layer('レイヤー 1', this.width, this.height); this.layers.push(drawingLayer); this.switchLayer(1); this.app.canvasManager.renderAllLayers(); this.app.canvasManager.saveState(); } 
    addLayer() { if (this.layers.length >= 99) return; const insertIndex = this.activeLayerIndex + 1; const newLayer = new Layer(`レイヤー ${this.layers.length + 1}`, this.width, this.height); this.layers.splice(insertIndex, 0, newLayer); this.renameLayers(); this.switchLayer(insertIndex); this.app.canvasManager.saveState(); } 
    deleteActiveLayer() { if (this.activeLayerIndex === 0 || this.layers.length <= 1) return; this.layers.splice(this.activeLayerIndex, 1); const newActiveIndex = Math.min(this.layers.length - 1, this.activeLayerIndex); this.renameLayers(); this.switchLayer(newActiveIndex); this.app.canvasManager.renderAllLayers(); this.app.canvasManager.saveState(); } 
    renameLayers() { this.layers.forEach((layer, index) => { layer.name = index === 0 ? '背景' : `レイヤー ${index}`; }); } 
    switchLayer(index) { if (index < 0 || index >= this.layers.length) return; this.activeLayerIndex = index; if (this.app.layerUIManager) { this.app.layerUIManager.renderLayers(); } } 
    getCurrentLayer() { return this.layers[this.activeLayerIndex] || null; } 
    duplicateActiveLayer() { const activeLayer = this.getCurrentLayer(); if (!activeLayer) return; const newLayer = new Layer(`${activeLayer.name}のコピー`, this.width, this.height); newLayer.imageData.data.set(activeLayer.imageData.data); newLayer.visible = activeLayer.visible; newLayer.opacity = activeLayer.opacity; newLayer.blendMode = activeLayer.blendMode; const insertIndex = this.activeLayerIndex + 1; this.layers.splice(insertIndex, 0, newLayer); this.renameLayers(); this.switchLayer(insertIndex); this.app.canvasManager.saveState(); } 
    // ★★★ エラー修正: レイヤー結合処理を修正 ★★★
    mergeDownActiveLayer() {
        if (this.activeLayerIndex <= 0) return;
        const topLayer = this.layers[this.activeLayerIndex];
        const bottomLayer = this.layers[this.activeLayerIndex - 1];

        const tempCtx = this.mergeCtx;
        
        // 1. 下のレイヤーを描画
        tempCtx.clearRect(0, 0, this.width, this.height);
        tempCtx.putImageData(bottomLayer.imageData, 0, 0);

        // 2. 上のレイヤーを合成
        tempCtx.globalAlpha = topLayer.opacity / 100;
        tempCtx.globalCompositeOperation = topLayer.blendMode;
        
        // 一時キャンバスにImageDataを描画してから合成
        const topLayerCanvas = document.createElement('canvas');
        topLayerCanvas.width = this.width;
        topLayerCanvas.height = this.height;
        const topLayerCtx = topLayerCanvas.getContext('2d');
        topLayerCtx.putImageData(topLayer.imageData, 0, 0);
        
        tempCtx.drawImage(topLayerCanvas, 0, 0);

        // 3. 合成結果を下のレイヤーのimageDataに書き戻す
        bottomLayer.imageData = tempCtx.getImageData(0, 0, this.width, this.height);

        // 4. 上のレイヤーを削除
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
        this.canvasManager = new CanvasManager(this);
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
        this.layerManager.setupInitialLayers();
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