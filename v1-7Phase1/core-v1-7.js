// Toshinka Tegaki Tool core.js v3.0 (Improved Drawing Engine)

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

// --- Layer Class ---
class Layer {
    constructor(name, width, height) {
        this.name = name;
        this.visible = true;
        this.imageData = new ImageData(width, height);
        this.transform = { x: 0, y: 0, scale: 1, rotation: 0 };
        this.originalImageData = null;
    }
    clear() { this.imageData.data.fill(0); }
    fill(hexColor) { const color = hexToRgba(hexColor); const data = this.imageData.data; for (let i = 0; i < data.length; i += 4) { data[i] = color.r; data[i + 1] = color.g; data[i + 2] = color.b; data[i + 3] = color.a; } }
}

// --- CanvasManager ---
class CanvasManager {
    constructor(app) {
        this.app = app;
        this.displayCanvas = document.getElementById('drawingCanvas');
        this.displayCtx = this.displayCanvas.getContext('2d', { willReadFrequently: true });
        this.canvasArea = document.getElementById('canvas-area');
        this.canvasContainer = document.getElementById('canvas-container');
        this.width = this.displayCanvas.width;
        this.height = this.displayCanvas.height;
        this.compositionData = new ImageData(this.width, this.height);
        this.isDrawing = false; this.isPanning = false; this.isSpaceDown = false;
        this.isVDown = false; this.isShiftDown = false; this.isActivePen = false;
        this.penId = null; this.isTransformingLayer = false; this.transformTargetLayer = null;
        this.transformMode = 'move'; this.transformStartX = 0; this.transformStartY = 0;
        this.originalLayerTransform = null; this.currentTool = 'pen';
        this.currentColor = '#800000'; this.currentSize = 1; this.lastPoint = null;
        this.history = []; this.historyIndex = -1;
        this.dirtyRect = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
        this.animationFrameId = null;
        this.dragStartX = 0; this.dragStartY = 0; this.canvasStartX = 0; this.canvasStartY = 0;
        this.viewTransform = { scale: 1, rotation: 0, flipX: 1, flipY: 1, left: 0, top: 0 };
        
        // --- ▼ここから改善された描画設定▼ ---

        // 圧力検知設定
        this.pressureSettings = {
            sensitivity: 0.8,      // 圧力感度 (0.0-1.0)
            minPressure: 0.1,      // 最小圧力閾値
            maxPressure: 1.0,      // 最大圧力閾値
            curve: 0.7,            // 圧力カーブ (0.1-2.0, 1.0が線形)
            minSizeRatio: 0.3,     // 最小サイズ比率
            dynamicRange: true     // 動的範囲調整
        };

        // 描画品質設定
        this.drawingQuality = {
            enableSubpixel: true,     // サブピクセル描画
            antialiasThreshold: 2.0,  // アンチエイリアス閾値
            minDrawSteps: 1,          // 最小描画ステップ
            maxDrawSteps: 100         // 最大描画ステップ
        };
        
        // 圧力履歴（スムージング用）
        this.pressureHistory = [];
        this.maxPressureHistory = 5;
        
        // --- ▲ここまで改善された描画設定▲ ---

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

    // --- ▼ここから改善された描画エンジン▼ ---

    /**
     * 改善された圧力補正計算
     */
    calculatePressureSize(baseSizeInput, pressure) {
        const baseSize = Math.max(0.1, baseSizeInput);
        // 圧力値の正規化と検証
        let normalizedPressure = Math.max(0, Math.min(1, pressure || 0));
        // 圧力が0の場合は最小値を使用
        if (normalizedPressure === 0) {
            normalizedPressure = this.pressureSettings.minPressure;
        }
        
        // 圧力履歴によるスムージング
        this.pressureHistory.push(normalizedPressure);
        if (this.pressureHistory.length > this.maxPressureHistory) {
            this.pressureHistory.shift();
        }
        
        const smoothedPressure = this.pressureHistory.reduce((sum, p) => sum + p, 0) / this.pressureHistory.length;
        // 動的範囲調整
        let adjustedPressure = smoothedPressure;
        if (this.pressureSettings.dynamicRange) {
            const minHist = Math.min(...this.pressureHistory);
            const maxHist = Math.max(...this.pressureHistory);
            const range = maxHist - minHist;
            if (range > 0.1) {
                adjustedPressure = (smoothedPressure - minHist) / range;
            }
        }
        
        // カスタム圧力カーブの適用
        const curve = this.pressureSettings.curve;
        const curvedPressure = Math.pow(adjustedPressure, curve);
        
        // サイズ計算
        const minSize = baseSize * this.pressureSettings.minSizeRatio;
        const maxSize = baseSize;
        const finalSize = minSize + (maxSize - minSize) * curvedPressure * this.pressureSettings.sensitivity;
        
        return Math.max(0.1, finalSize);
    }

    /**
     * 改善された円描画（品質重視）
     */
    _drawCircleImproved(imageData, centerX, centerY, radius, color, isEraser) {
        const quality = this.drawingQuality;
        const useSubpixel = quality.enableSubpixel && radius >= 0.5;
        
        // 極小サイズの場合は単一ピクセル描画
        if (radius < 0.8) {
            this._drawSinglePixel(imageData, centerX, centerY, color, isEraser, radius);
            return;
        }
        
        const rCeil = Math.ceil(radius + 1);
        this._updateDirtyRect(centerX, centerY, rCeil);
        
        for (let y = -rCeil; y <= rCeil; y++) {
            for (let x = -rCeil; x <= rCeil; x++) {
                const distance = Math.hypot(x, y);
                if (distance <= radius + 0.5) {
                    const finalX = centerX + x;
                    const finalY = centerY + y;
                    
                    let alpha = this._calculatePixelAlpha(distance, radius, useSubpixel);
                    if (alpha > 0.01) {
                        if (isEraser) {
                            this._erasePixel(imageData, finalX, finalY, alpha);
                        } else {
                            const finalColor = { ...color, a: Math.floor(color.a * alpha) };
                            this._blendPixel(imageData, finalX, finalY, finalColor);
                        }
                    }
                }
            }
        }
    }

    /**
     * 単一ピクセル描画（極小サイズ用）
     */
    _drawSinglePixel(imageData, x, y, color, isEraser, intensity = 1.0) {
        const alpha = Math.min(1.0, intensity);
        
        if (isEraser) {
            this._erasePixel(imageData, x, y, alpha);
        } else {
            const finalColor = { ...color, a: Math.floor(color.a * alpha) };
            this._blendPixel(imageData, x, y, finalColor);
        }
        
        this._updateDirtyRect(x, y, 1);
    }

    /**
     * ピクセルアルファ値計算の改善
     */
    _calculatePixelAlpha(distance, radius, useSubpixel) {
        if (distance <= radius - 0.5) {
            return 1.0;
        }
        
        if (!useSubpixel) {
            return distance <= radius ? 1.0 : 0.0;
        }
        
        // サブピクセル精度でのアンチエイリアシング
        if (distance <= radius) {
            const fadeStart = Math.max(0, radius - 1.0);
            const fadeRange = radius - fadeStart;
            
            if (fadeRange > 0) {
                const fadeRatio = (distance - fadeStart) / fadeRange;
                return Math.max(0, 1.0 - fadeRatio);
            }
            return 1.0;
        }
        
        // エッジのソフトエッジ効果
        if (distance <= radius + 0.5) {
            return Math.max(0, 1.0 - (distance - radius) * 2.0);
        }
        
        return 0.0;
    }

    /**
     * 改善された線描画
     */
    _drawLineImproved(imageData, x0, y0, x1, y1, size, color, isEraser, pressure0 = 1.0, pressure1 = 1.0) {
        if (!isFinite(x0) || !isFinite(y0) || !isFinite(x1) || !isFinite(y1)) return;
        const distance = Math.hypot(x1 - x0, y1 - y0);
        if (distance > Math.hypot(this.width, this.height) * 2) return;
        
        // 動的ステップ計算
        const quality = this.drawingQuality;
        const baseSteps = Math.max(quality.minDrawSteps, Math.ceil(distance / Math.max(0.5, size / 8)));
        const steps = Math.min(quality.maxDrawSteps, baseSteps);
        
        for (let i = 0; i <= steps; i++) {
            const t = steps > 0 ? i / steps : 0;
            const x = x0 + (x1 - x0) * t;
            const y = y0 + (y1 - y0) * t;
            
            // 圧力の補間
            const pressure = pressure0 + (pressure1 - pressure0) * t;
            const adjustedSize = this.calculatePressureSize(size, pressure);
            
            this._drawCircleImproved(imageData, x, y, adjustedSize / 2, color, isEraser);
        }
    }
    
    // --- ▲ここまで改善された描画エンジン▲ ---


    // --- ▼ここからイベントハンドラの更新▼ ---
    
    onPointerDown(e) {
        if (e.button !== 0) return;

        // (既存の変形・パン処理は変更なし)
        if (this.isVDown) { const activeLayer = this.app.layerManager.getCurrentLayer(); if (!activeLayer || this.app.layerManager.layers.indexOf(activeLayer) === 0) return; this.isTransformingLayer = true; this.transformTargetLayer = activeLayer; this.transformTargetLayer.originalImageData = new ImageData( new Uint8ClampedArray(this.transformTargetLayer.imageData.data), this.transformTargetLayer.imageData.width, this.transformTargetLayer.imageData.height ); this.originalLayerTransform = { ...this.transformTargetLayer.transform }; this.transformMode = this.isShiftDown ? 'rotate_scale' : 'move'; this.transformStartX = e.clientX; this.transformStartY = e.clientY; e.preventDefault(); return; }
        if (this.isSpaceDown) { this.dragStartX = e.clientX; this.dragStartY = e.clientY; this.isPanning = true; this.canvasStartX = this.viewTransform.left; this.canvasStartY = this.viewTransform.top; e.preventDefault(); return; }

        const coords = this.getCanvasCoordinates(e);
        if (!coords) return;
        
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer || !activeLayer.visible) return;
        
        this.isDrawing = true;
        this.lastPoint = { ...coords, pressure: e.pressure || 1.0 };
        
        // 圧力履歴リセット
        this.pressureHistory = [e.pressure || 1.0];
        
        // 改善された描画処理を呼び出す
        const size = this.calculatePressureSize(this.currentSize, e.pressure || 1.0);
        this._drawCircleImproved(activeLayer.imageData, coords.x, coords.y, size / 2, 
                                 hexToRgba(this.currentColor), this.currentTool === 'eraser');
        
        this._requestRender();
        document.documentElement.setPointerCapture(e.pointerId);
    }

    onPointerMove(e) {
        // (既存の変形・パン処理は変更なし)
        if (this.isTransformingLayer) { const dx = e.clientX - this.transformStartX; const dy = e.clientY - this.transformStartY; const t = this.transformTargetLayer.transform; const ot = this.originalLayerTransform; if (this.transformMode === 'move') { t.x = ot.x + dx; t.y = ot.y + dy; } else { t.rotation = ot.rotation + dx * 0.5; const scaleFactor = 1 - dy * 0.005; t.scale = Math.max(0.1, ot.scale * scaleFactor); } this._applyLiveTransform(); return; }
        if (this.isPanning) { const dx = e.clientX - this.dragStartX; const dy = e.clientY - this.dragStartY; this.viewTransform.left = this.canvasStartX + dx; this.viewTransform.top = this.canvasStartY + dy; this.applyViewTransform(); return; }
        
        if (!this.isDrawing) return;
        
        const coords = this.getCanvasCoordinates(e);
        if (!coords) {
            this.lastPoint = null;
            return;
        }
        
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer || !activeLayer.visible) return;
        
        if (!this.lastPoint) {
            this.lastPoint = { ...coords, pressure: e.pressure || 1.0 };
            return;
        }
        
        const currentPressure = e.pressure || 1.0;
        
        // 改善された描画処理を呼び出す
        this._drawLineImproved(
            activeLayer.imageData,
            this.lastPoint.x, this.lastPoint.y,
            coords.x, coords.y,
            this.currentSize,
            hexToRgba(this.currentColor),
            this.currentTool === 'eraser',
            this.lastPoint.pressure,
            currentPressure
        );
        
        this.lastPoint = { ...coords, pressure: currentPressure };
        this._requestRender();
    }

    onPointerUp(e) {
        // (既存のロジックは変更なし)
        if (this.isTransformingLayer) { this._bakeLayerTransform(); this.isTransformingLayer = false; this.transformTargetLayer = null; this.originalLayerTransform = null; this.saveState(); }
        if (this.isDrawing) {
            this.isDrawing = false;
            // 描画の最後に圧力履歴をクリアする（オプション）
            this.pressureHistory = [];
            
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

    // --- ▲ここまでイベントハンドラの更新▲ ---


    // --- (↓ここから下のコードは既存のまま変更ありません) ---

    // レンダリングエンジン (Partial Composite & Dirty Rect)
    _compositePartial(rect) { const finalData = this.compositionData.data; const layers = this.app.layerManager.layers; const width = this.width; const xStart = Math.max(0, Math.floor(rect.minX)); const yStart = Math.max(0, Math.floor(rect.minY)); const xEnd = Math.min(width, Math.ceil(rect.maxX)); const yEnd = Math.min(this.height, Math.ceil(rect.maxY)); for (let y = yStart; y < yEnd; y++) { for (let x = xStart; x < xEnd; x++) { const i = (y * width + x) * 4; let r = 0, g = 0, b = 0, a = 0; for (const layer of layers) { if (!layer.visible) continue; const layerData = layer.imageData.data; const srcR = layerData[i], srcG = layerData[i+1], srcB = layerData[i+2], srcA = layerData[i+3] / 255; if (srcA > 0) { const destR = r, destG = g, destB = b, destA = a; const outA = srcA + destA * (1 - srcA); if (outA > 0) { r = (srcR * srcA + destR * destA * (1 - srcA)) / outA; g = (srcG * srcA + destG * destA * (1 - srcA)) / outA; b = (srcB * srcA + destB * destA * (1 - srcA)) / outA; a = outA; } } } finalData[i] = r; finalData[i + 1] = g; finalData[i + 2] = b; finalData[i + 3] = a * 255; } } }
    _renderDirty() { const rect = this.dirtyRect; if (rect.minX > rect.maxX) return; this._compositePartial(rect); const dirtyX = Math.max(0, Math.floor(rect.minX)); const dirtyY = Math.max(0, Math.floor(rect.minY)); const dirtyW = Math.min(this.width, Math.ceil(rect.maxX)) - dirtyX; const dirtyH = Math.min(this.height, Math.ceil(rect.maxY)) - dirtyY; if (dirtyW > 0 && dirtyH > 0) { const tempCanvas = document.createElement('canvas'); tempCanvas.width = dirtyW; tempCanvas.height = dirtyH; const tempCtx = tempCanvas.getContext('2d'); const partialData = tempCtx.createImageData(dirtyW, dirtyH); const sourceData = this.compositionData.data; const destData = partialData.data; for (let y = 0; y < dirtyH; y++) { for (let x = 0; x < dirtyW; x++) { const sourceIndex = ((dirtyY + y) * this.width + (dirtyX + x)) * 4; const destIndex = (y * dirtyW + x) * 4; destData[destIndex] = sourceData[sourceIndex]; destData[destIndex + 1] = sourceData[sourceIndex + 1]; destData[destIndex + 2] = sourceData[sourceIndex + 2]; destData[destIndex + 3] = sourceData[sourceIndex + 3]; } } this.displayCtx.putImageData(partialData, dirtyX, dirtyY); } this._resetDirtyRect(); }
    renderAllLayers() { this._updateDirtyRect(this.width / 2, this.height / 2, Math.max(this.width, this.height)); this._requestRender(); }
    _requestRender() { if (!this.animationFrameId) { this.animationFrameId = requestAnimationFrame(() => { this._renderDirty(); this.animationFrameId = null; }); } }
    _updateDirtyRect(x, y, radius) { const margin = Math.ceil(radius) + 2; this.dirtyRect.minX = Math.min(this.dirtyRect.minX, x - margin); this.dirtyRect.minY = Math.min(this.dirtyRect.minY, y - margin); this.dirtyRect.maxX = Math.max(this.dirtyRect.maxX, x + margin); this.dirtyRect.maxY = Math.max(this.dirtyRect.maxY, y + margin); }
    _resetDirtyRect() { this.dirtyRect = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }; }
    _blendPixel(imageData, x, y, color) { try { x = Math.floor(x); y = Math.floor(y); if (x < 0 || x >= imageData.width || y < 0 || y >= imageData.height) return; if (!imageData.data || !color) return; const index = (y * imageData.width + x) * 4; const data = imageData.data; if (index < 0 || index >= data.length - 3) return; const topAlpha = color.a / 255; if (topAlpha <= 0) return; if (topAlpha >= 1) { data[index] = color.r; data[index + 1] = color.g; data[index + 2] = color.b; data[index + 3] = color.a; return; } const bottomAlpha = data[index + 3] / 255; const outAlpha = topAlpha + bottomAlpha * (1 - topAlpha); if (outAlpha > 0) { data[index] = (color.r * topAlpha + data[index] * bottomAlpha * (1 - topAlpha)) / outAlpha; data[index + 1] = (color.g * topAlpha + data[index + 1] * bottomAlpha * (1 - topAlpha)) / outAlpha; data[index + 2] = (color.b * topAlpha + data[index + 2] * bottomAlpha * (1 - topAlpha)) / outAlpha; data[index + 3] = outAlpha * 255; } } catch (error) { console.warn('ピクセル描画エラー:', {x, y, error}); } }
    _erasePixel(imageData, x, y, strength) { x = Math.floor(x); y = Math.floor(y); if (x < 0 || x >= imageData.width || y < 0 || y >= imageData.height) return; const index = (y * imageData.width + x) * 4; const currentAlpha = imageData.data[index + 3]; imageData.data[index + 3] = Math.max(0, currentAlpha * (1 - strength)); }

    getCanvasCoordinates(e) {
        try {
            const rect = this.displayCanvas.getBoundingClientRect();
            let x = e.clientX - rect.left;
            let y = e.clientY - rect.top;
            if (this.viewTransform.flipX === -1) { x = this.width - x; }
            if (this.viewTransform.flipY === -1) { y = this.height - y; }
            if (x < 0 || x >= this.width || y < 0 || y >= this.height) { return null; }
            return { x: Math.floor(x), y: Math.floor(y) };
        } catch (error) {
            console.warn('座標変換エラー:', error);
            return null;
        }
    }

    // Layer Transformation
    _applyLiveTransform() { if (!this.transformTargetLayer || !this.transformTargetLayer.originalImageData) return; const layer = this.transformTargetLayer; const transformedImageData = this._getTransformedImageData(layer.originalImageData, layer.transform); layer.imageData = transformedImageData; this.renderAllLayers(); }
    _bakeLayerTransform() { if (!this.transformTargetLayer) return; const layer = this.transformTargetLayer; layer.originalImageData = null; layer.transform = { x: 0, y: 0, scale: 1, rotation: 0 }; this.renderAllLayers(); }
    applyAndBakeTransform(transformDelta) { const layer = this.app.layerManager.getCurrentLayer(); if (!layer || this.app.layerManager.layers.indexOf(layer) === 0) return; const transformedImageData = this._getTransformedImageData(layer.imageData, transformDelta); layer.imageData = transformedImageData; this.renderAllLayers(); this.saveState(); }
    _getTransformedImageData(sourceImageData, transform) { const sw = sourceImageData.width; const sh = sourceImageData.height; const sdata = sourceImageData.data; const destImageData = new ImageData(sw, sh); const ddata = destImageData.data; const { x: tx, y: ty, scale, rotation } = transform; const rad = -rotation * Math.PI / 180; const cos = Math.cos(rad); const sin = Math.sin(rad); const cx = sw / 2; const cy = sh / 2; for (let y = 0; y < sh; y++) { for (let x = 0; x < sw; x++) { let curX = x - cx; let curY = y - cy; curX -= tx; curY -= ty; curX /= scale; curY /= scale; const rotatedX = curX * cos - curY * sin; const rotatedY = curX * sin + curY * cos; const sx = Math.round(rotatedX + cx); const sy = Math.round(rotatedY + cy); const destIndex = (y * sw + x) * 4; if (sx >= 0 && sx < sw && sy >= 0 && sy < sh) { const sourceIndex = (sy * sw + sx) * 4; ddata[destIndex] = sdata[sourceIndex]; ddata[destIndex + 1] = sdata[sourceIndex + 1]; ddata[destIndex + 2] = sdata[sourceIndex + 2]; ddata[destIndex + 3] = sdata[sourceIndex + 3]; } } } return destImageData; }
    applyAndBakeFlip(horizontal) { const layer = this.app.layerManager.getCurrentLayer(); if (!layer || this.app.layerManager.layers.indexOf(layer) === 0) return; const sourceImageData = layer.imageData; const sw = sourceImageData.width; const sh = sourceImageData.height; const sdata = sourceImageData.data; const destImageData = new ImageData(sw, sh); const ddata = destImageData.data; for (let y = 0; y < sh; y++) { for (let x = 0; x < sw; x++) { const destIndex = (y * sw + x) * 4; const sourceX = horizontal ? (sw - 1 - x) : x; const sourceY = horizontal ? y : (sh - 1 - y); const sourceIndex = (sourceY * sw + sourceX) * 4; ddata[destIndex] = sdata[sourceIndex]; ddata[destIndex + 1] = sdata[sourceIndex + 1]; ddata[destIndex + 2] = sdata[sourceIndex + 2]; ddata[destIndex + 3] = sdata[sourceIndex + 3]; } } layer.imageData = destImageData; this.renderAllLayers(); this.saveState(); }

    // History (Undo/Redo)
    saveState() { if(this.isTransformingLayer) return; const state = { layers: this.app.layerManager.layers.map(layer => ({ name: layer.name, visible: layer.visible, imageData: new ImageData( new Uint8ClampedArray(layer.imageData.data), layer.imageData.width, layer.imageData.height ) })), activeLayerIndex: this.app.layerManager.activeLayerIndex }; this.history = this.history.slice(0, this.historyIndex + 1); this.history.push(state); this.historyIndex++; }
    restoreState(state) { this.app.layerManager.layers = state.layers.map(layerData => { const layer = new Layer(layerData.name, layerData.imageData.width, layerData.imageData.height); layer.visible = layerData.visible; layer.imageData.data.set(layerData.imageData.data); return layer; }); this.app.layerManager.switchLayer(state.activeLayerIndex); this.renderAllLayers(); }
    undo() { if (this.historyIndex > 0) { this.historyIndex--; this.restoreState(this.history[this.historyIndex]); } }
    redo() { if (this.historyIndex < this.history.length - 1) { this.historyIndex++; this.restoreState(this.history[this.historyIndex]); } }

    // View & Others
    setCurrentTool(tool) { this.currentTool = tool; this.updateCursor(); }
    setCurrentColor(color) { this.currentColor = color; }
    setCurrentSize(size) { this.currentSize = size; }
    clearCanvas() { const activeLayer = this.app.layerManager.getCurrentLayer(); if (activeLayer) { activeLayer.clear(); if (this.app.layerManager.activeLayerIndex === 0) { activeLayer.fill('#f0e0d6'); } this.renderAllLayers(); this.saveState(); } }
    exportMergedImage() { const exportCanvas = document.createElement('canvas'); exportCanvas.width = this.width; exportCanvas.height = this.height; const exportCtx = exportCanvas.getContext('2d'); this._compositePartial({minX:0, minY:0, maxX:this.width, maxY:this.height}); exportCtx.putImageData(this.compositionData, 0, 0); const dataURL = exportCanvas.toDataURL('image/png'); const link = document.createElement('a'); link.href = dataURL; link.download = 'merged_image.png'; link.click(); }
    updateCursor() { let cursor = 'crosshair'; if (this.isVDown) cursor = 'move'; if (this.isSpaceDown) cursor = 'grab'; if (this.currentTool === 'eraser') cursor = 'cell'; this.canvasArea.style.cursor = cursor; }
    applyViewTransform() { const t = this.viewTransform; this.canvasContainer.style.transform = `translate(${t.left}px, ${t.top}px) scale(${t.scale * t.flipX}, ${t.scale * t.flipY}) rotate(${t.rotation}deg)`; }
    flipHorizontal() { this.viewTransform.flipX *= -1; this.applyViewTransform(); }
    flipVertical() { this.viewTransform.flipY *= -1; this.applyViewTransform(); }
    zoom(factor) { this.viewTransform.scale = Math.max(0.1, this.viewTransform.scale * factor); this.applyViewTransform(); }
    rotate(degrees) { this.viewTransform.rotation = (this.viewTransform.rotation + degrees) % 360; this.applyViewTransform(); }
    resetView() { this.viewTransform = { scale: 1, rotation: 0, flipX: 1, flipY: 1, left: 0, top: 0 }; this.applyViewTransform(); }
    handleWheel(e) { e.preventDefault(); if (e.shiftKey) { this.rotate(-e.deltaY * 0.2); } else { this.zoom(e.deltaY > 0 ? 1 / 1.05 : 1.05); } }

    /**
     * 新機能：圧力設定の動的調整メソッド
     */
    setPressureSensitivity(sensitivity) {
        this.pressureSettings.sensitivity = Math.max(0.1, Math.min(1.0, sensitivity));
    }
    setPressureCurve(curve) {
        this.pressureSettings.curve = Math.max(0.1, Math.min(2.0, curve));
    }
    setMinSizeRatio(ratio) {
        this.pressureSettings.minSizeRatio = Math.max(0.1, Math.min(1.0, ratio));
    }
    toggleDynamicRange() {
        this.pressureSettings.dynamicRange = !this.pressureSettings.dynamicRange;
    }
    toggleSubpixelDrawing() {
        this.drawingQuality.enableSubpixel = !this.drawingQuality.enableSubpixel;
    }
}

// --- Other managers and main app class (no changes) ---
class LayerManager { constructor(app) { this.app = app; this.layers = []; this.activeLayerIndex = -1; this.width = 344; this.height = 135; } setupInitialLayers() { const bgLayer = new Layer('背景', this.width, this.height); bgLayer.fill('#f0e0d6'); this.layers.push(bgLayer); const drawingLayer = new Layer('レイヤー 1', this.width, this.height); this.layers.push(drawingLayer); this.switchLayer(1); this.app.canvasManager.renderAllLayers(); this.app.canvasManager.saveState(); } addLayer() { if (this.layers.length >= 99) return; const insertIndex = this.activeLayerIndex + 1; const newLayer = new Layer(`レイヤー ${this.layers.length + 1}`, this.width, this.height); this.layers.splice(insertIndex, 0, newLayer); this.renameLayers(); this.switchLayer(insertIndex); this.app.canvasManager.saveState(); } deleteActiveLayer() { if (this.activeLayerIndex === 0 || this.layers.length <= 1) return; this.layers.splice(this.activeLayerIndex, 1); const newActiveIndex = Math.min(this.layers.length - 1, this.activeLayerIndex); this.renameLayers(); this.switchLayer(newActiveIndex); this.app.canvasManager.renderAllLayers(); this.app.canvasManager.saveState(); } renameLayers() { this.layers.forEach((layer, index) => { layer.name = index === 0 ? '背景' : `レイヤー ${index}`; }); } switchLayer(index) { if (index < 0 || index >= this.layers.length) return; this.activeLayerIndex = index; if (this.app.layerUIManager) { this.app.layerUIManager.renderLayers(); } } getCurrentLayer() { return this.layers[this.activeLayerIndex] || null; } duplicateActiveLayer() { const activeLayer = this.getCurrentLayer(); if (!activeLayer) return; const newLayer = new Layer(`${activeLayer.name}のコピー`, this.width, this.height); newLayer.imageData.data.set(activeLayer.imageData.data); newLayer.visible = activeLayer.visible; const insertIndex = this.activeLayerIndex + 1; this.layers.splice(insertIndex, 0, newLayer); this.renameLayers(); this.switchLayer(insertIndex); this.app.canvasManager.saveState(); } mergeDownActiveLayer() { if (this.activeLayerIndex <= 0) return; const topLayer = this.layers[this.activeLayerIndex]; const bottomLayer = this.layers[this.activeLayerIndex - 1]; const topData = topLayer.imageData.data; const bottomData = bottomLayer.imageData.data; for (let i = 0; i < topData.length; i += 4) { const topAlpha = topData[i + 3] / 255; if (topAlpha === 0) continue; const bottomAlpha = bottomData[i + 3] / 255; const outAlpha = topAlpha + bottomAlpha * (1 - topAlpha); if (outAlpha > 0) { bottomData[i] = (topData[i] * topAlpha + bottomData[i] * bottomAlpha * (1 - topAlpha)) / outAlpha; bottomData[i+1] = (topData[i+1] * topAlpha + bottomData[i+1] * bottomAlpha * (1 - topAlpha)) / outAlpha; bottomData[i+2] = (topData[i+2] * topAlpha + bottomData[i+2] * bottomAlpha * (1 - topAlpha)) / outAlpha; bottomData[i + 3] = outAlpha * 255; } } this.layers.splice(this.activeLayerIndex, 1); this.switchLayer(this.activeLayerIndex - 1); this.app.canvasManager.renderAllLayers(); this.app.canvasManager.saveState(); } }
class PenSettingsManager { constructor(app) { this.app = app; this.currentSize = 1; this.sizes = Array.from(document.querySelectorAll('.size-btn')).map(btn => parseInt(btn.dataset.size)); this.currentSizeIndex = this.sizes.indexOf(this.currentSize); this.bindEvents(); this.updateSizeButtonVisuals(); } bindEvents() { document.querySelectorAll('.size-btn').forEach(btn => btn.addEventListener('click', () => this.setSize(parseInt(btn.dataset.size)))); } setSize(size) { this.currentSize = size; this.currentSizeIndex = this.sizes.indexOf(this.currentSize); document.querySelectorAll('.size-btn').forEach(btn => btn.classList.remove('active')); document.querySelector(`[data-size="${size}"]`)?.classList.add('active'); this.app.canvasManager.setCurrentSize(this.currentSize); this.updateSizeButtonVisuals(); } changeSize(increase) { let newIndex = this.currentSizeIndex + (increase ? 1 : -1); newIndex = Math.max(0, Math.min(newIndex, this.sizes.length - 1)); this.setSize(this.sizes[newIndex]); } updateSizeButtonVisuals() { document.querySelectorAll('.size-btn').forEach(btn => { const size = parseInt(btn.dataset.size); btn.querySelector('.size-dot').style.width = `${Math.min(size, 16)}px`; btn.querySelector('.size-dot').style.height = `${Math.min(size, 16)}px`; btn.querySelector('.size-number').textContent = size; }); } }
class ColorManager { constructor(app) { this.app = app; this.mainColor = '#800000'; this.subColor = '#f0e0d6'; this.colors = Array.from(document.querySelectorAll('.color-btn')).map(btn => btn.dataset.color); this.currentColorIndex = this.colors.indexOf(this.mainColor); this.mainColorDisplay = document.getElementById('main-color-display'); this.subColorDisplay = document.getElementById('sub-color-display'); this.bindEvents(); this.updateColorDisplays(); document.querySelector(`[data-color="${this.mainColor}"]`)?.classList.add('active'); } bindEvents() { document.querySelectorAll('.color-btn').forEach(btn => btn.addEventListener('click', (e) => this.setColor(e.currentTarget.dataset.color))); document.querySelector('.color-mode-display').addEventListener('click', () => this.swapColors()); } setColor(color) { this.mainColor = color; this.currentColorIndex = this.colors.indexOf(this.mainColor); document.querySelectorAll('.color-btn').forEach(btn => btn.classList.remove('active')); document.querySelector(`[data-color="${color}"]`)?.classList.add('active'); this.updateColorDisplays(); this.app.canvasManager.setCurrentColor(this.mainColor); } updateColorDisplays() { this.mainColorDisplay.style.backgroundColor = this.mainColor; this.subColorDisplay.style.backgroundColor = this.subColor; } swapColors() { [this.mainColor, this.subColor] = [this.subColor, this.mainColor]; this.updateColorDisplays(); this.setColor(this.mainColor); } resetColors() { this.setColor('#800000'); this.subColor = '#f0e0d6'; this.updateColorDisplays(); } changeColor(increase) { let newIndex = this.currentColorIndex + (increase ? 1 : -1); newIndex = (newIndex + this.colors.length) % this.colors.length; this.setColor(this.colors[newIndex]); } }
class ToolManager { constructor(app) { this.app = app; this.currentTool = 'pen'; this.bindEvents(); } bindEvents() { document.getElementById('pen-tool').addEventListener('click', () => this.setTool('pen')); document.getElementById('eraser-tool').addEventListener('click', () => this.setTool('eraser')); document.getElementById('bucket-tool').addEventListener('click', () => this.setTool('bucket')); document.getElementById('move-tool').addEventListener('click', () => this.setTool('move')); } setTool(tool) { this.currentTool = tool; document.querySelectorAll('.left-toolbar .tool-btn').forEach(btn => btn.classList.remove('active')); document.getElementById(tool + '-tool')?.classList.add('active'); this.app.canvasManager.setCurrentTool(tool); this.app.canvasManager.updateCursor(); } }

/*
// 参考：将来的に圧力設定をUIから変更するためのクラス例です。
// HTML側に設定用のスライダーなどを追加し、このクラスを有効化することで、
// リアルタイムに描き味を調整できるようになります。
class PressureSettingsUI {
    constructor(canvasManager) {
        this.canvasManager = canvasManager;
        // ここでUI要素を取得・作成します。
        // 例: const sensitivitySlider = document.getElementById('sensitivity-slider');
        // this.bindUIEvents();
    }

    bindUIEvents() {
        // 例:
        // const sensitivitySlider = document.getElementById('sensitivity-slider');
        // sensitivitySlider.addEventListener('input', (e) => {
        //     this.canvasManager.setPressureSensitivity(parseFloat(e.target.value));
        // });
        // 
        // const curveSlider = document.getElementById('curve-slider');
        // curveSlider.addEventListener('input', (e) => {
        //     this.canvasManager.setPressureCurve(parseFloat(e.target.value));
        // });
    }
}
*/

class ToshinkaTegakiTool { constructor() { this.initManagers(); } initManagers() { this.canvasManager = new CanvasManager(this); this.layerManager = new LayerManager(this); this.penSettingsManager = new PenSettingsManager(this); this.toolManager = new ToolManager(this); this.colorManager = new ColorManager(this); if (typeof LayerUIManager !== 'undefined') { this.layerUIManager = new LayerUIManager(this); } this.layerManager.setupInitialLayers(); this.toolManager.setTool('pen'); this.penSettingsManager.setSize(1); this.colorManager.setColor(this.colorManager.mainColor); /* // 圧力設定UIを有効にする場合は、以下のコメントを外します。 new PressureSettingsUI(this.canvasManager); */ } }
window.addEventListener('DOMContentLoaded', () => { if (!window.toshinkaTegakiInitialized) { window.toshinkaTegakiInitialized = true; window.toshinkaTegakiTool = new ToshinkaTegakiTool(); } });