/*
 * ===================================================================================
 * Toshinka Tegaki Tool - Core Engine
 * Version: 2.9.3 (Phase 4A11 - Layer Transform FIX)
 *
 * - 修正 (v2.9.3):
 * - Phase4A11の作業を適用し、レイヤー移動時のバグを修正。
 * - Claudeさんのアドバイスに基づき、onPointerMoveでのレイヤー移動計算を修正。
 * - ビューポート座標(e.clientX/Y)をgetCanvasCoordinatesでキャンバス座標に変換し、
 * その差分を移動量として使うことで、「レイヤーが吹き飛ぶ」問題を根本的に解決。
 * - 回転・スケールモードは既存の操作感を維持。
 * - これにより、ズームや視点回転の状態に関わらず、直感的なレイヤー移動が可能になります。
 * ===================================================================================
 */

// --- Module Imports ---
import { TopBarManager, LayerUIManager } from './ui/ui-manager.js';
import { ShortcutManager } from './ui/shortcut-manager.js';
import { BucketTool } from './tools/toolset.js';
import { RenderingBridge } from './core/rendering/rendering-bridge.js';
import { reset, translate, rotate, scale, getTranslation, transformWorldToLocal } from './core/utils/transform-utils.js';

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
        this.modelMatrix = glMatrix.mat4.create(); // [cite: 6, 15, 47]
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

        this.isDrawing = false; this.isPanning = false; this.isSpaceDown = false;
        this.isVDown = false; this.isShiftDown = false;
        
        this.isLayerTransforming = false;
        this.transformTargetLayer = null;
        this.transformMode = 'move'; 
        this.transformStartX = 0; 
        this.transformStartY = 0;
        this.originalModelMatrix = null;
        
        this.currentTool = 'pen';
        this.currentColor = '#800000'; this.currentSize = 1; this.lastPoint = null;
        
        this.pressureSettings = { sensitivity: 0.8, minPressure: 0.1, maxPressure: 1.0, curve: 0.7, minSizeRatio: 0.3, dynamicRange: true };
        this.pressureHistory = [];
        this.maxPressureHistory = 5;

        this.history = []; this.historyIndex = -1;
        this.dirtyRect = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
        this.animationFrameId = null;

        this.dragStartX = 0; this.dragStartY = 0; this.canvasStartX = 0; this.canvasStartY = 0;
        this.viewTransform = { scale: 1, rotation: 0, flipX: 1, flipY: 1, left: 0, top: 0 };
        
        this.bindEvents();
        this.setupDebugGui();
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

        const coords = this.getCanvasCoordinates(e);
        if (!coords) return;
        
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer || !activeLayer.visible) return;

        // ワールド座標をアクティブレイヤーのローカル座標に変換 [cite: 21, 23]
        const localCoords = transformWorldToLocal(coords.x, coords.y, activeLayer.modelMatrix);

        this._resetDirtyRect();
        
        if (this.currentTool === 'bucket') {
            // ローカル座標で塗りつぶし
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
        
        this._updateDirtyRect(localCoords.x, localCoords.y, size);
        
        // ローカル座標で描画
        this.renderingBridge.drawCircle(
            localCoords.x, localCoords.y, size / 2, 
            hexToRgba(this.currentColor), this.currentTool === 'eraser',
            activeLayer
        );
        
        this._requestRender();
        document.documentElement.setPointerCapture(e.pointerId);
    }
    
    onPointerMove(e) {
        if (this.isLayerTransforming) { // [cite: 121]
            if (!this.transformTargetLayer) return; // [cite: 121]

            // 開始時の行列を常にコピーして、それに対して変換を適用する
            const newMatrix = glMatrix.mat4.clone(this.originalModelMatrix); // [cite: 124]

            if (this.transformMode === 'move') {
                // ★★★ バグ修正 ★★★
                // 「レイヤーが吹き飛ぶ」問題の原因は、マウスの移動量をキャンバスの座標系で
                // 計算していなかったためです。以下のように修正します。

                // 1. マウスの開始座標と現在座標を、ビューポート座標(clientX/Y)からキャンバス座標に変換 [cite: 122]
                const startCoords = this.getCanvasCoordinates({ clientX: this.transformStartX, clientY: this.transformStartY }); // [cite: 122]
                const currentCoords = this.getCanvasCoordinates(e); // [cite: 122]
                
                // 2. 座標がキャンバスの外などで取得できなかった場合は、処理を中断
                if (!startCoords || !currentCoords) return; 
                
                // 3. キャンバス座標系での移動差分(dx, dy)を計算 [cite: 123]
                const dx = currentCoords.x - startCoords.x; // [cite: 123]
                const dy = currentCoords.y - startCoords.y; // [cite: 123]
                
                // 4. 開始時の行列(newMatrix)に、計算した移動量を「追加」で適用 [cite: 125]
                // これにより、ビューのズームや回転状態に関わらず、見た目通りにレイヤーが移動します。
                translate(newMatrix, dx, dy); // [cite: 125]

            } else if (this.transformMode === 'rotate_scale') {
                // こちらのモードは既存の操作感を維持します。
                const dx = (e.clientX - this.transformStartX);
                const dy = (e.clientY - this.transformStartY);
                const viewScale = this.viewTransform.scale;
                
                const angle = (dx / viewScale) * 0.01; // [cite: 127]
                const scaleFactor = Math.max(0.1, 1 - (dy / viewScale) * 0.005); // [cite: 128]
                
                const centerX = this.width / 2; // [cite: 126]
                const centerY = this.height / 2; // [cite: 126]
                
                // 既存のロジック: 累積的に変換を適用
                translate(newMatrix, centerX, centerY);
                rotate(newMatrix, angle);
                scale(newMatrix, scaleFactor, scaleFactor);
                translate(newMatrix, -centerX, -centerY);
            }

            this.transformTargetLayer.modelMatrix = newMatrix;
            this.renderAllLayers(); // [cite: 129]
            return; // [cite: 129]
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

        const localCoords = transformWorldToLocal(coords.x, coords.y, activeLayer.modelMatrix); // [cite: 21, 23]

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
        this._updateDirtyRect(this.lastPoint.x, this.lastPoint.y, lastSize);
        this._updateDirtyRect(localCoords.x, localCoords.y, currentSize);

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
        if (this.isLayerTransforming) {
            this.isLayerTransforming = false;
            this.transformTargetLayer = null;
            this.originalModelMatrix = null;
            this.saveState();
        }
        
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
        this.renderingBridge.compositeLayers(this.app.layerManager.layers, rect);
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
        // ローカル座標での描画のため、安全にキャンバス全体を更新対象とする
        this.dirtyRect = { minX: 0, minY: 0, maxX: this.width, maxY: this.height }; // [cite: 158]
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

        if (this.isDrawing && this.pressureHistory.length <= this.maxPressureHistory) {
            const dampingFactor = this.pressureHistory.length / this.maxPressureHistory;
            finalPressure *= (0.2 + Math.pow(dampingFactor, 3) * 0.8);
        }

        if (this.pressureSettings.dynamicRange) {
            const minHist = Math.min(...tempHistory, finalPressure);
            const maxHist = Math.max(...tempHistory, finalPressure);
            const range = maxHist - minHist;
            if (range > 0.1) {
                finalPressure = (finalPressure - minHist) / range;
            }
        }
        
        const curvedPressure = Math.pow(finalPressure, this.pressureSettings.curve);
        const minSize = baseSize * this.pressureSettings.minSizeRatio;
        return minSize + (baseSize - minSize) * curvedPressure;
    }

    getCanvasCoordinates(e) {
        try {
            const rect = this.displayCanvas.getBoundingClientRect(); // [cite: 22]
            if (rect.width === 0 || rect.height === 0) return null;
            let x = (e.clientX - rect.left) * (this.width / rect.width); // [cite: 22]
            let y = (e.clientY - rect.top) * (this.height / rect.height); // [cite: 22]
            if (this.viewTransform.flipX === -1) { x = this.width - x; }
            if (this.viewTransform.flipY === -1) { y = this.height - y; }
            if (x < 0 || x >= this.width || y < 0 || y >= this.height) { return null; }
            return { x: x, y: y };
        } catch (error) {
            console.warn('座標変換エラー:', error);
            return null;
        }
    }

    startLayerTransform(e) {
        const activeLayer = this.app.layerManager.getCurrentLayer(); // [cite: 169]
        if (!activeLayer || this.app.layerManager.layers.indexOf(activeLayer) === 0) return; // [cite: 169]

        this.isLayerTransforming = true; // [cite: 171]
        this.transformTargetLayer = activeLayer; // [cite: 171]
        this.originalModelMatrix = glMatrix.mat4.clone(this.transformTargetLayer.modelMatrix); // [cite: 171]
        this.transformMode = this.isShiftDown ? 'rotate_scale' : 'move'; // [cite: 171]
        this.transformStartX = e.clientX; // [cite: 172]
        this.transformStartY = e.clientY; // [cite: 172]
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
                modelMatrix: Array.from(layer.modelMatrix) // Float32Arrayをプレーンな配列に変換
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
            
            if (layerData.modelMatrix && Array.isArray(layerData.modelMatrix)) {
                // 配列からmat4を復元
                layer.modelMatrix = glMatrix.mat4.fromValues(...layerData.modelMatrix);
            } else {
                glMatrix.mat4.identity(layer.modelMatrix);
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
        this.renderingBridge.compositeLayers(this.app.layerManager.layers, fullRect);

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
            console.warn("Export for Canvas2D fallback not implemented.");
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

    setupDebugGui() {
        const gui = new dat.GUI({ autoPlace: false, width: "100%" }); // [cite: 65, 130]
        const guiContainer = document.querySelector('.right-sidebar'); // [cite: 130]
        guiContainer.prepend(gui.domElement); // [cite: 130]
        gui.domElement.style.position = 'relative'; // [cite: 131]
        gui.domElement.style.width = '100%'; // [cite: 131]
        gui.domElement.style.maxWidth = '280px'; // [cite: 131]
        gui.domElement.style.margin = '10px 0'; // [cite: 131]
        gui.domElement.style.zIndex = '1000'; // [cite: 131]
        
        const transformSettings = {
            translateX: 0,
            translateY: 0,
            rotation: 0,
            scale: 1,
            _apply: () => {
                const activeLayer = this.app.layerManager.getCurrentLayer(); // [cite: 132]
                if (!activeLayer) return; // [cite: 132]

                reset(activeLayer.modelMatrix); // [cite: 9, 52, 133]
                
                const centerX = this.width / 2; // [cite: 135]
                const centerY = this.height / 2; // [cite: 135]
                
                // GUIの値を順番に適用
                translate(activeLayer.modelMatrix, transformSettings.translateX, transformSettings.translateY); // [cite: 134]
                translate(activeLayer.modelMatrix, centerX, centerY); // [cite: 138]
                rotate(activeLayer.modelMatrix, transformSettings.rotation * Math.PI / 180); // [cite: 136]
                scale(activeLayer.modelMatrix, transformSettings.scale, transformSettings.scale); // [cite: 137]
                translate(activeLayer.modelMatrix, -centerX, -centerY); // [cite: 138]

                this.renderAllLayers(); // [cite: 10, 139]
                this.saveState(); // [cite: 139]
            },
            _sync: () => {
                const activeLayer = this.app.layerManager.getCurrentLayer(); // [cite: 140]
                if (!activeLayer) return; // [cite: 140]

                // 行列から平行移動量を取得してGUIに反映
                const translation = getTranslation(activeLayer.modelMatrix); // [cite: 32, 67, 141]
                transformSettings.translateX = translation.x; // [cite: 32, 67, 141]
                transformSettings.translateY = translation.y; // [cite: 32, 67, 141]
                
                // 回転とスケールは複雑なため、レイヤー切り替え時はリセット
                transformSettings.rotation = 0; // [cite: 142]
                transformSettings.scale = 1; // [cite: 142]
                
                // GUIの表示を更新
                for (let i in gui.__controllers) { // [cite: 68, 143]
                    gui.__controllers[i].updateDisplay(); // [cite: 68, 143]
                }
            }
        };

        gui.add(transformSettings, 'translateX', -this.width, this.width).onChange(transformSettings._apply).listen(); // [cite: 144]
        gui.add(transformSettings, 'translateY', -this.height, this.height).onChange(transformSettings._apply).listen(); // [cite: 144]
        gui.add(transformSettings, 'rotation', -180, 180).onChange(transformSettings._apply).listen(); // [cite: 144]
        gui.add(transformSettings, 'scale', 0.1, 5).onChange(transformSettings._apply).listen(); // [cite: 144]
        
        this.app.transformSync = transformSettings._sync; // [cite: 145]
    }
}

class LayerManager { 
    constructor(app) { this.app = app; this.layers = []; this.activeLayerIndex = -1; this.width = 344; this.height = 135; } 
    setupInitialLayers() { const bgLayer = new Layer('背景', this.width, this.height); bgLayer.fill('#f0e0d6'); reset(bgLayer.modelMatrix); this.layers.push(bgLayer); const drawingLayer = new Layer('レイヤー 1', this.width, this.height); this.layers.push(drawingLayer); this.switchLayer(1); this.app.canvasManager.renderAllLayers(); this.app.canvasManager.saveState(); } 
    addLayer() { if (this.layers.length >= 99) return; const insertIndex = this.activeLayerIndex + 1; const newLayer = new Layer(`レイヤー ${this.layers.length + 1}`, this.width, this.height); this.layers.splice(insertIndex, 0, newLayer); this.renameLayers(); this.switchLayer(insertIndex); this.app.canvasManager.saveState(); } 
    deleteActiveLayer() { if (this.activeLayerIndex === 0 || this.layers.length <= 1) return; this.layers.splice(this.activeLayerIndex, 1); const newActiveIndex = Math.min(this.layers.length - 1, this.activeLayerIndex); this.renameLayers(); this.switchLayer(newActiveIndex); this.app.canvasManager.renderAllLayers(); this.app.canvasManager.saveState(); } 
    renameLayers() { this.layers.forEach((layer, index) => { if (index > 0) layer.name = `レイヤー ${index}`; }); } 
    switchLayer(index) { 
        if (index < 0 || index >= this.layers.length) return; 
        this.activeLayerIndex = index; 
        if (this.app.layerUIManager) { this.app.layerUIManager.renderLayers(); }
        // レイヤー切り替え時にGUIの値を同期する
        if (this.app.transformSync) {
            this.app.transformSync();
        }
    } 
    getCurrentLayer() { return this.layers[this.activeLayerIndex] || null; } 
    duplicateActiveLayer() { const activeLayer = this.getCurrentLayer(); if (!activeLayer) return; const newLayer = new Layer(`${activeLayer.name}のコピー`, this.width, this.height); newLayer.imageData.data.set(activeLayer.imageData.data); newLayer.visible = activeLayer.visible; newLayer.opacity = activeLayer.opacity; newLayer.blendMode = activeLayer.blendMode; newLayer.modelMatrix = glMatrix.mat4.clone(activeLayer.modelMatrix); newLayer.gpuDirty = true; const insertIndex = this.activeLayerIndex + 1; this.layers.splice(insertIndex, 0, newLayer); this.renameLayers(); this.switchLayer(insertIndex); this.app.canvasManager.saveState(); } 
    mergeDownActiveLayer() {
        if (this.activeLayerIndex <= 0) return;
        
        alert("レイヤー結合は現在、変形情報をリセットします。");

        const topLayer = this.layers[this.activeLayerIndex];
        const bottomLayer = this.layers[this.activeLayerIndex - 1];
        
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.width;
        tempCanvas.height = this.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        tempCtx.putImageData(bottomLayer.imageData, 0, 0);
        tempCtx.globalAlpha = topLayer.opacity / 100;
        
        const topLayerCanvas = document.createElement('canvas');
        topLayerCanvas.width = this.width;
        topLayerCanvas.height = this.height;
        topLayerCanvas.getContext('2d').putImageData(topLayer.imageData, 0, 0);
        
        const t = getTranslation(topLayer.modelMatrix);
        tempCtx.drawImage(topLayerCanvas, t.x, t.y);
        
        bottomLayer.imageData = tempCtx.getImageData(0, 0, this.width, this.height);
        reset(bottomLayer.modelMatrix);
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
        
        if (this.transformSync) {
            this.transformSync();
        }
    }
}

window.addEventListener('DOMContentLoaded', () => {
    if (!window.toshinkaTegakiInitialized) {
        window.toshinkaTegakiInitialized = true;
        window.toshinkaTegakiTool = new ToshinkaTegakiTool();
    }
});