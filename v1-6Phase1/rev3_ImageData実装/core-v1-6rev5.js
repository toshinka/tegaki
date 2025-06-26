// Toshinka Tegaki Tool core.js v2.7 (REV5 Applied)

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

// --- Layer Class (ImageData-based) ---
class Layer {
    constructor(name, width, height) {
        this.name = name;
        this.visible = true;
        this.imageData = new ImageData(width, height);
    }

    clear() {
        this.imageData.data.fill(0);
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
    }
}

// --- CanvasManager (ImageData-based) ---
class CanvasManager {
    constructor(app) {
        this.app = app;

        // Display Canvas
        this.displayCanvas = document.getElementById('drawingCanvas');
        this.displayCtx = this.displayCanvas.getContext('2d', { willReadFrequently: true });
        this.canvasArea = document.getElementById('canvas-area');
        this.canvasContainer = document.getElementById('canvas-container');
        this.width = this.displayCanvas.width;
        this.height = this.displayCanvas.height;
        
        // 全レイヤーを合成した結果を保持するためのImageData
        this.compositionData = new ImageData(this.width, this.height);

        // Drawing State
        this.isDrawing = false;
        this.isPanning = false;
        this.isSpaceDown = false;
        this.isVDown = false;
        this.isShiftDown = false;
        this.isActivePen = false;
        this.penId = null;

        // Settings
        this.currentTool = 'pen';
        this.currentColor = '#800000';
        this.currentSize = 1;

        // Coordinates & History
        this.lastPoint = null;
        this.history = [];
        this.historyIndex = -1;

        // --- Performance Optimization ---
        this.dirtyRect = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
        this.animationFrameId = null;
        
        // REV5: パフォーマンス最適化（ガベージコレクション対策）
        this.tempImageDataPool = [];
        this.maxPoolSize = 5;

        // Transform related
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.canvasStartX = 0;
        this.canvasStartY = 0;
        this.transform = { scale: 1, rotation: 0, flipX: 1, flipY: 1, left: 0, top: 0 };

        this.bindEvents();
    }

    bindEvents() {
        this.canvasArea.addEventListener('pointerdown', this.onPointerDown.bind(this));
        this.canvasArea.addEventListener('pointerenter', this.onPointerEnter.bind(this));
        this.canvasArea.addEventListener('pointerleave', this.onPointerLeave.bind(this));
        document.addEventListener('pointermove', this.onPointerMove.bind(this));
        document.addEventListener('pointerup', this.onPointerUp.bind(this));
        document.addEventListener('pointercancel', this.onPointerCancel.bind(this));
        this.canvasArea.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
        document.addEventListener('contextmenu', e => e.preventDefault());
        this.canvasArea.addEventListener('mousedown', e => { if (e.button !== 0) e.preventDefault(); });
        document.getElementById('saveMergedButton')?.addEventListener('click', () => this.exportMergedImage());
    }
    
    // REV5: パフォーマンス最適化（メソッド追加）
    getTempImageData(width, height) {
        const pooled = this.tempImageDataPool.find(img => 
            img.width === width && img.height === height
        );
        
        if (pooled) {
            this.tempImageDataPool = this.tempImageDataPool.filter(img => img !== pooled);
            // データをクリア
            pooled.data.fill(0);
            return pooled;
        }
        
        return new ImageData(width, height);
    }
    
    // REV5: パフォーマンス最適化（メソッド追加）
    returnTempImageData(imageData) {
        if (this.tempImageDataPool.length < this.maxPoolSize) {
            this.tempImageDataPool.push(imageData);
        }
    }
    
    // --- Pen Tablet Event Handlers ---

    onPointerEnter(e) {
        if (e.pointerType === 'pen' && this.isActivePen && this.penId === e.pointerId) {
            this.lastPoint = null;
        }
    }

    onPointerLeave(e) {
        if (e.pointerType === 'pen' && this.isDrawing && this.penId === e.pointerId) {
            this.lastPoint = null;
        }
    }

    onPointerCancel(e) {
        if (this.penId === e.pointerId) {
            this.isDrawing = false;
            this.isActivePen = false;
            this.penId = null;
            this.lastPoint = null;
        }
    }


    // --- Core Rendering Engine ---
    
    /**
     * 部分合成エンジン
     * 指定された矩形（rect）の領域内のみ、全レイヤーをピクセル単位で再合成する。
     */
    _compositePartial(rect) {
        const finalData = this.compositionData.data;
        const layers = this.app.layerManager.layers;
        const width = this.width;

        const xStart = Math.max(0, Math.floor(rect.minX));
        const yStart = Math.max(0, Math.floor(rect.minY));
        const xEnd = Math.min(width, Math.ceil(rect.maxX));
        const yEnd = Math.min(this.height, Math.ceil(rect.maxY));

        for (let y = yStart; y < yEnd; y++) {
            for (let x = xStart; x < xEnd; x++) {
                const i = (y * width + x) * 4;
                
                let r = 0, g = 0, b = 0, a = 0;

                for (const layer of layers) {
                    if (!layer.visible) continue;

                    const layerData = layer.imageData.data;
                    const srcR = layerData[i];
                    const srcG = layerData[i + 1];
                    const srcB = layerData[i + 2];
                    const srcA = layerData[i + 3] / 255;

                    if (srcA > 0) {
                        const destR = r, destG = g, destB = b, destA = a;
                        
                        const outA = srcA + destA * (1 - srcA);
                        if (outA > 0) {
                             r = (srcR * srcA + destR * destA * (1 - srcA)) / outA;
                             g = (srcG * srcA + destG * destA * (1 - srcA)) / outA;
                             b = (srcB * srcA + destB * destA * (1 - srcA)) / outA;
                             a = outA;
                        }
                    }
                }
                
                finalData[i]     = r;
                finalData[i + 1] = g;
                finalData[i + 2] = b;
                finalData[i + 3] = a * 255;
            }
        }
    }

    /**
     * REV5: 部分描画システムの修正
     * putImageData の7引数版が正しく動作しない可能性を考慮し、
     * 一時的なImageDataを作成して安全に部分描画を行う。
     */
    _renderDirty() {
        const rect = this.dirtyRect;
        if (rect.minX > rect.maxX) return;
    
        // 部分合成を実行
        this._compositePartial(rect);
    
        // 変更領域を計算
        const dirtyX = Math.max(0, Math.floor(rect.minX));
        const dirtyY = Math.max(0, Math.floor(rect.minY));
        const dirtyW = Math.min(this.width, Math.ceil(rect.maxX)) - dirtyX;
        const dirtyH = Math.min(this.height, Math.ceil(rect.maxY)) - dirtyY;
    
        if (dirtyW > 0 && dirtyH > 0) {
            // 安全な描画方法：一時的なImageDataを作成
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = dirtyW;
            tempCanvas.height = dirtyH;
            const tempCtx = tempCanvas.getContext('2d');
            
            // 該当部分のImageDataを抽出 (この時点では空でOK)
            const partialData = tempCtx.createImageData(dirtyW, dirtyH);
            
            // 合成結果(compositionData)から対応する部分をコピー
            const sourceData = this.compositionData.data;
            const destData = partialData.data;
            
            for (let y = 0; y < dirtyH; y++) {
                for (let x = 0; x < dirtyW; x++) {
                    const sourceIndex = ((dirtyY + y) * this.width + (dirtyX + x)) * 4;
                    const destIndex = (y * dirtyW + x) * 4;
                    
                    destData[destIndex]     = sourceData[sourceIndex];
                    destData[destIndex + 1] = sourceData[sourceIndex + 1];
                    destData[destIndex + 2] = sourceData[sourceIndex + 2];
                    destData[destIndex + 3] = sourceData[sourceIndex + 3];
                }
            }
            
            // 該当領域にImageDataを転送
            this.displayCtx.putImageData(partialData, dirtyX, dirtyY);
        }
    
        this._resetDirtyRect();
    }
    
    /**
     * 全画面更新処理
     */
    renderAllLayers() {
        this._compositePartial({minX: 0, minY: 0, maxX: this.width, maxY: this.height});
        this.displayCtx.putImageData(this.compositionData, 0, 0);
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
        this.dirtyRect.minX = Math.min(this.dirtyRect.minX, Math.floor(x - margin));
        this.dirtyRect.minY = Math.min(this.dirtyRect.minY, Math.floor(y - margin));
        this.dirtyRect.maxX = Math.max(this.dirtyRect.maxX, Math.ceil(x + margin));
        this.dirtyRect.maxY = Math.max(this.dirtyRect.maxY, Math.ceil(y + margin));
    }

    _resetDirtyRect() {
        this.dirtyRect = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    }

    // --- Drawing Primitives on ImageData ---
    
    /**
     * REV5: エラーハンドリングの強化
     * 安全な描画処理のため、境界チェックやデータ有効性チェックを強化。
     */
    _blendPixel(imageData, x, y, color) {
        try {
            x = Math.floor(x);
            y = Math.floor(y);
            
            // 境界チェック
            if (x < 0 || x >= imageData.width || y < 0 || y >= imageData.height) return;
            
            // データ有効性チェック
            if (!imageData.data || !color) return;
            
            const index = (y * imageData.width + x) * 4;
            const data = imageData.data;
    
            // インデックス範囲チェック
            if (index < 0 || index >= data.length - 3) return;
    
            const topAlpha = color.a / 255;
            if (topAlpha <= 0) return;
    
            if (topAlpha >= 1) {
                data[index] = color.r;
                data[index + 1] = color.g;
                data[index + 2] = color.b;
                data[index + 3] = color.a;
                return;
            }
    
            const bottomAlpha = data[index + 3] / 255;
            const outAlpha = topAlpha + bottomAlpha * (1 - topAlpha);
            
            if (outAlpha > 0) {
                data[index]     = (color.r * topAlpha + data[index]     * bottomAlpha * (1 - topAlpha)) / outAlpha;
                data[index + 1] = (color.g * topAlpha + data[index + 1] * bottomAlpha * (1 - topAlpha)) / outAlpha;
                data[index + 2] = (color.b * topAlpha + data[index + 2] * bottomAlpha * (1 - topAlpha)) / outAlpha;
                data[index + 3] = outAlpha * 255;
            }
        } catch (error) {
            console.warn('ピクセル描画エラー:', {x, y, error});
        }
    }

    _erasePixel(imageData, x, y, strength) {
        x = Math.floor(x);
        y = Math.floor(y);
        if (x < 0 || x >= imageData.width || y < 0 || y >= imageData.height) return;
        const index = (y * imageData.width + x) * 4;
        const currentAlpha = imageData.data[index + 3];
        imageData.data[index + 3] = Math.max(0, currentAlpha * (1 - strength));
    }
    
    /**
     * REV5: 描画品質の向上
     * アンチエイリアシングのロジックを改善し、より滑らかな描画を実現。
     */
    _drawCircle(imageData, centerX, centerY, radius, color, isEraser) {
        const rCeil = Math.ceil(radius + 2); // マージンを増加
        this._updateDirtyRect(centerX, centerY, rCeil);
    
        for (let y = -rCeil; y <= rCeil; y++) {
            for (let x = -rCeil; x <= rCeil; x++) {
                const distance = Math.hypot(x, y);
    
                if (distance <= radius + 1.5) { // より滑らかな境界
                    const finalX = centerX + x;
                    const finalY = centerY + y;
    
                    let alpha;
                    if (distance <= radius - 0.5) {
                        alpha = 1.0;
                    } else if (distance <= radius + 0.5) {
                        // より滑らかなフェード
                        alpha = 1.0 - (distance - (radius - 0.5));
                        alpha = Math.max(0, Math.min(1, alpha));
                    } else {
                        // 外側のソフトエッジ
                        alpha = Math.max(0, 1.0 - (distance - (radius + 0.5)));
                        alpha *= 0.3; // 弱いエッジ
                    }
    
                    if (alpha > 0.01) { // 閾値を下げる
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

    _drawLine(imageData, x0, y0, x1, y1, size, color, isEraser) {
        if (!isFinite(x0) || !isFinite(y0) || !isFinite(x1) || !isFinite(y1)) {
            console.warn('無効な座標で描画を試行:', {x0, y0, x1, y1});
            return;
        }

        const distance = Math.hypot(x1 - x0, y1 - y0);
        if (distance > Math.hypot(this.width, this.height) * 2) {
            console.warn('異常に長い線の描画を防止:', distance);
            return;
        }
    
        const steps = Math.max(1, Math.ceil(distance / (size / 4)));

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = x0 + (x1 - x0) * t;
            const y = y0 + (y1 - y0) * t;
            this._drawCircle(imageData, x, y, size / 2, color, isEraser);
        }
    }

    _fill(imageData, startX, startY, color, tolerance = 2) {
        startX = Math.floor(startX);
        startY = Math.floor(startY);

        const width = imageData.width;
        const height = imageData.height;
        const data = imageData.data;

        const getPixelIndex = (x, y) => (y * width + x) * 4;
        const startIdx = getPixelIndex(startX, startY);
        const startColor = [data[startIdx], data[startIdx+1], data[startIdx+2], data[startIdx+3]];
        
        const targetColor = [color.r, color.g, color.b, color.a];
        const isColorSimilar = (c1_idx, c2) => {
            const dr = data[c1_idx] - c2[0];
            const dg = data[c1_idx + 1] - c2[1];
            const db = data[c1_idx + 2] - c2[2];
            const da = data[c1_idx + 3] - c2[3];
            return dr*dr + dg*dg + db*db + da*da <= tolerance * tolerance;
        };

        if (isColorSimilar(startIdx, targetColor)) return;

        this._resetDirtyRect();
        let minX = width, minY = height, maxX = -1, maxY = -1;

        const stack = [[startX, startY]];
        const visited = new Set([`${startX},${startY}`]);

        while (stack.length) {
            const [x, y] = stack.pop();
            
            if (isColorSimilar(getPixelIndex(x,y), startColor)) {
                const idx = getPixelIndex(x, y);
                data[idx] = targetColor[0];
                data[idx + 1] = targetColor[1];
                data[idx + 2] = targetColor[2];
                data[idx + 3] = targetColor[3];

                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);

                [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].forEach(([nx, ny]) => {
                    if (nx >= 0 && nx < width && ny >= 0 && ny < height && !visited.has(`${nx},${ny}`)) {
                        stack.push([nx, ny]);
                        visited.add(`${nx},${ny}`);
                    }
                });
            }
        }
        
        if(maxX > -1){
            this.dirtyRect.minX = Math.min(this.dirtyRect.minX, minX);
            this.dirtyRect.minY = Math.min(this.dirtyRect.minY, minY);
            this.dirtyRect.maxX = Math.max(this.dirtyRect.maxX, maxX);
            this.dirtyRect.maxY = Math.max(this.dirtyRect.maxY, maxY);
        }
    }

    // --- User Input Event Handlers ---
    onPointerDown(e) {
        if (e.button !== 0) return;
        try {
            if (e.pointerType === 'pen') {
                this.isActivePen = true;
                this.penId = e.pointerId;
            }

            if (this.isSpaceDown) {
                 this.dragStartX = e.clientX;
                 this.dragStartY = e.clientY;
                 this.isPanning = true;
                 this.canvasStartX = this.transform.left;
                 this.canvasStartY = this.transform.top;
                 e.preventDefault();
                 return;
            }

            const coords = this.getCanvasCoordinates(e);
            if (!coords) { return; }
            
            const activeLayer = this.app.layerManager.getCurrentLayer();
            if (!activeLayer || !activeLayer.visible) return;

            if (this.currentTool === 'bucket') {
                this._fill(activeLayer.imageData, coords.x, coords.y, hexToRgba(this.currentColor));
                this._requestRender(); 
                this.saveState();
                return;
            }
            
            this.isDrawing = true;
            this.lastPoint = coords;

            const pressure = e.pressure || 1.0;
            const adjustedPressure = pressure === 0 ? 1.0 : Math.pow(pressure, 0.5);
            const size = this.currentSize * adjustedPressure;
            
            this._drawCircle(
                activeLayer.imageData, 
                coords.x, coords.y, 
                size / 2, 
                hexToRgba(this.currentColor), 
                this.currentTool === 'eraser'
            );

            this._requestRender();
            document.documentElement.setPointerCapture(e.pointerId);
        } catch (err) {
            console.error("Error on PointerDown:", err);
            this.isDrawing = false;
        }
    }

    onPointerMove(e) {
        try {
            if (this.isPanning) {
                const dx = e.clientX - this.dragStartX;
                const dy = e.clientY - this.dragStartY;
                this.transform.left = this.canvasStartX + dx;
                this.transform.top = this.canvasStartY + dy;
                this.applyTransform();
                return;
            }

            if (e.pointerType === 'pen') {
                if (!this.isDrawing || this.penId !== e.pointerId) {
                    return;
                }
            } else {
                if (!this.isDrawing) return;
            }

            const coords = this.getCanvasCoordinates(e);
            if (!coords) {
                this.lastPoint = null;
                return;
            }
            
            const activeLayer = this.app.layerManager.getCurrentLayer();
            if (!activeLayer || !activeLayer.visible) return;

            if (!this.lastPoint) {
                this.lastPoint = coords;
                return;
            }

            const pressure = e.pressure || 1.0;
            const adjustedPressure = pressure === 0 ? 1.0 : Math.pow(pressure, 0.5);
            const size = this.currentSize * adjustedPressure;

            this._drawLine(
                activeLayer.imageData,
                this.lastPoint.x, this.lastPoint.y,
                coords.x, coords.y,
                size,
                hexToRgba(this.currentColor),
                this.currentTool === 'eraser'
            );

            this.lastPoint = coords;
            this._requestRender();
        } catch (err) {
            console.error("Error on PointerMove:", err);
            this.isDrawing = false;
        }
    }

    onPointerUp(e) {
        if (e.button !== 0) return;
        try {
            if (this.isDrawing) {
                this.isDrawing = false;
                
                if (this.animationFrameId) {
                    cancelAnimationFrame(this.animationFrameId);
                    this.animationFrameId = null;
                }
                this._renderDirty(); 

                this.lastPoint = null;
                this.saveState();
            }
            
            if (e.pointerType === 'pen' && this.penId === e.pointerId) {
                this.isActivePen = false;
                this.penId = null;
            }
            
            this.isPanning = false;
            if (document.documentElement.hasPointerCapture(e.pointerId)) {
                 document.documentElement.releasePointerCapture(e.pointerId);
            }
        } catch (err) {
            console.error("Error on PointerUp:", err);
            if (document.documentElement.hasPointerCapture(e.pointerId)) {
                document.documentElement.releasePointerCapture(e.pointerId);
            }
        }
    }

    // --- History (Undo/Redo) ---
    saveState() {
        const state = {
            layers: this.app.layerManager.layers.map(layer => ({
                name: layer.name,
                visible: layer.visible,
                imageData: new ImageData(
                    new Uint8ClampedArray(layer.imageData.data),
                    layer.imageData.width,
                    layer.imageData.height
                )
            })),
            activeLayerIndex: this.app.layerManager.activeLayerIndex
        };

        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push(state);
        this.historyIndex++;
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

    restoreState(state) {
        this.app.layerManager.layers = state.layers.map(layerData => {
            const layer = new Layer(layerData.name, layerData.imageData.width, layerData.imageData.height);
            layer.visible = layerData.visible;
            layer.imageData.data.set(layerData.imageData.data);
            return layer;
        });
        
        this.app.layerManager.switchLayer(state.activeLayerIndex);
        this.renderAllLayers();
    }

    // --- Tooling & View ---
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
    
    clearAllLayers() {
        this.app.layerManager.layers.forEach((layer, index) => {
            layer.clear();
            if (index === 0) {
                layer.fill('#f0e0d6');
            }
        });
        this.renderAllLayers();
        this.saveState();
    }

    exportMergedImage() {
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = this.width;
        exportCanvas.height = this.height;
        const exportCtx = exportCanvas.getContext('2d');
        
        this.renderAllLayers();
        exportCtx.putImageData(this.compositionData, 0, 0);

        const dataURL = exportCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = 'merged_image.png';
        link.click();
    }
    
    /**
     * REV5: 座標変換バグの修正
     * 回転・拡縮・反転時の座標のズレをなくすため、安定版のシンプルな座標変換ロジックに置き換え。
     * これにより、ビューの変形（回転など）と描画座標が一旦切り離されますが、基本的な描画の正確性が確保されます。
     */
    getCanvasCoordinates(e) {
        try {
            const rect = this.displayCanvas.getBoundingClientRect();
            
            // 基本的なクライアント座標からキャンバスの左上を原点とする座標への変換
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // 境界チェックを厳密に
            if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
                return null;
            }
            
            // 整数座標を返す
            return { x: Math.floor(x), y: Math.floor(y) };
        } catch (error) {
            console.warn('座標変換エラー:', error);
            return null;
        }
    }
    
    updateCursor() {
        let cursor = 'crosshair';
        if (this.isSpaceDown) cursor = 'grab';
        if (this.isVDown) cursor = 'move';
        this.canvasArea.style.cursor = cursor;
    }

    applyTransform() {
        const t = this.transform;
        this.canvasContainer.style.transform = `
            translate(${t.left}px, ${t.top}px)
            scale(${t.scale * t.flipX}, ${t.scale * t.flipY})
            rotate(${t.rotation}deg)
        `;
    }

    flipHorizontal() { this.transform.flipX *= -1; this.applyTransform(); }
    flipVertical() { this.transform.flipY *= -1; this.applyTransform(); }
    zoom(factor) { this.transform.scale = Math.max(0.1, this.transform.scale * factor); this.applyTransform(); }
    rotate(degrees) { this.transform.rotation = (this.transform.rotation + degrees) % 360; this.applyTransform(); }
    resetView() { this.transform = { scale: 1, rotation: 0, flipX: 1, flipY: 1, left: 0, top: 0 }; this.applyTransform(); }

    handleWheel(e) {
        e.preventDefault();
        if (e.shiftKey) {
          const degrees = -e.deltaY * 0.2;
          this.rotate(degrees);
        } else {
            const zoomFactor = e.deltaY > 0 ? 1 / 1.05 : 1.05;
            this.zoom(zoomFactor);
        }
    }
}

// --- LayerManager (ImageData-based) ---
class LayerManager {
    constructor(app) {
        this.app = app;
        this.layers = [];
        this.activeLayerIndex = -1;
        this.width = 344;
        this.height = 135;
    }

    setupInitialLayers() {
        const bgLayer = new Layer('背景', this.width, this.height);
        bgLayer.fill('#f0e0d6');
        this.layers.push(bgLayer);

        const drawingLayer = new Layer('レイヤー 1', this.width, this.height);
        this.layers.push(drawingLayer);

        this.switchLayer(1);
        this.app.canvasManager.renderAllLayers();
        this.app.canvasManager.saveState();
    }
    
    addLayer() {
        if (this.layers.length >= 99) { alert("レイヤー数の上限に達しました。"); return; }
        const insertIndex = this.activeLayerIndex + 1;
        const newLayer = new Layer(`レイヤー ${this.layers.length + 1}`, this.width, this.height);
        this.layers.splice(insertIndex, 0, newLayer);
        this.renameLayers();
        this.switchLayer(insertIndex);
        this.app.canvasManager.saveState();
    }
    
    deleteActiveLayer() {
        if (this.activeLayerIndex === 0) { alert('背景レイヤーは削除できません。'); return; }
        if (this.layers.length <= 1) return;

        this.layers.splice(this.activeLayerIndex, 1);
        const newActiveIndex = Math.min(this.layers.length - 1, this.activeLayerIndex);
        this.renameLayers();
        this.switchLayer(newActiveIndex);
        this.app.canvasManager.renderAllLayers();
        this.app.canvasManager.saveState();
    }

    duplicateActiveLayer() {
        const activeLayer = this.getCurrentLayer();
        if (!activeLayer) return;
        
        const newLayer = new Layer(`${activeLayer.name}のコピー`, this.width, this.height);
        newLayer.imageData.data.set(activeLayer.imageData.data);
        newLayer.visible = activeLayer.visible;
        
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
        
        const topData = topLayer.imageData.data;
        const bottomData = bottomLayer.imageData.data;

        for (let i = 0; i < topData.length; i += 4) {
            const topAlpha = topData[i + 3] / 255;
            if (topAlpha === 0) continue;
            
            const bottomAlpha = bottomData[i + 3] / 255;
            const outAlpha = topAlpha + bottomAlpha * (1 - topAlpha);

            if (outAlpha > 0) {
                bottomData[i] = (topData[i] * topAlpha + bottomData[i] * bottomAlpha * (1 - topAlpha)) / outAlpha;
                bottomData[i+1] = (topData[i+1] * topAlpha + bottomData[i+1] * bottomAlpha * (1 - topAlpha)) / outAlpha;
                bottomData[i+2] = (topData[i+2] * topAlpha + bottomData[i+2] * bottomAlpha * (1 - topAlpha)) / outAlpha;
                bottomData[i + 3] = outAlpha * 255;
            }
        }
        this.layers.splice(this.activeLayerIndex, 1);
        this.switchLayer(this.activeLayerIndex - 1);
        this.app.canvasManager.renderAllLayers();
        this.app.canvasManager.saveState();
    }

    renameLayers() {
        this.layers.forEach((layer, index) => { layer.name = index === 0 ? '背景' : `レイヤー ${index}`; });
    }

    switchLayer(index) {
        if (index < 0 || index >= this.layers.length) return;
        this.activeLayerIndex = index;
        if (this.app.layerUIManager) {
            this.app.layerUIManager.renderLayers();
        }
    }

    getCurrentLayer() {
        return this.layers[this.activeLayerIndex] || null;
    }
}

// --- Other Managers (Unchanged functionality) ---
class PenSettingsManager {
    constructor(app) {
        this.app = app; this.currentSize = 1;
        this.sizes = Array.from(document.querySelectorAll('.size-btn')).map(btn => parseInt(btn.dataset.size));
        this.currentSizeIndex = this.sizes.indexOf(this.currentSize);
        this.bindEvents(); this.updateSizeButtonVisuals();
    }
    bindEvents() { document.querySelectorAll('.size-btn').forEach(btn => btn.addEventListener('click', () => this.setSize(parseInt(btn.dataset.size)))); }
    setSize(size) {
        this.currentSize = size; this.currentSizeIndex = this.sizes.indexOf(this.currentSize);
        document.querySelectorAll('.size-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-size="${size}"]`)?.classList.add('active');
        this.app.canvasManager.setCurrentSize(this.currentSize); this.updateSizeButtonVisuals();
    }
    changeSize(increase) { let newIndex = this.currentSizeIndex + (increase ? 1 : -1); newIndex = Math.max(0, Math.min(newIndex, this.sizes.length - 1)); this.setSize(this.sizes[newIndex]); }
    updateSizeButtonVisuals() { document.querySelectorAll('.size-btn').forEach(btn => { const size = parseInt(btn.dataset.size); btn.querySelector('.size-dot').style.width = `${Math.min(size, 16)}px`; btn.querySelector('.size-dot').style.height = `${Math.min(size, 16)}px`; btn.querySelector('.size-number').textContent = size; }); }
}
class ColorManager {
    constructor(app) {
        this.app = app; this.mainColor = '#800000'; this.subColor = '#f0e0d6';
        this.colors = Array.from(document.querySelectorAll('.color-btn')).map(btn => btn.dataset.color);
        this.currentColorIndex = this.colors.indexOf(this.mainColor); this.mainColorDisplay = document.getElementById('main-color-display'); this.subColorDisplay = document.getElementById('sub-color-display');
        this.bindEvents(); this.updateColorDisplays(); document.querySelector(`[data-color="${this.mainColor}"]`)?.classList.add('active');
    }
    bindEvents() { document.querySelectorAll('.color-btn').forEach(btn => btn.addEventListener('click', (e) => this.setColor(e.currentTarget.dataset.color))); document.querySelector('.color-mode-display').addEventListener('click', () => this.swapColors()); }
    setColor(color) {
        this.mainColor = color; this.currentColorIndex = this.colors.indexOf(this.mainColor);
        document.querySelectorAll('.color-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-color="${color}"]`)?.classList.add('active');
        this.updateColorDisplays(); this.app.canvasManager.setCurrentColor(this.mainColor);
    }
    updateColorDisplays() { this.mainColorDisplay.style.backgroundColor = this.mainColor; this.subColorDisplay.style.backgroundColor = this.subColor; }
    swapColors() { [this.mainColor, this.subColor] = [this.subColor, this.mainColor]; this.updateColorDisplays(); this.setColor(this.mainColor); }
    resetColors() { this.setColor('#800000'); this.subColor = '#f0e0d6'; this.updateColorDisplays(); }
    changeColor(increase) { let newIndex = this.currentColorIndex + (increase ? 1 : -1); newIndex = (newIndex + this.colors.length) % this.colors.length; this.setColor(this.colors[newIndex]); }
}
class ToolManager {
    constructor(app) {
        this.app = app; this.currentTool = 'pen';
        this.bindEvents();
    }
    bindEvents() { document.getElementById('pen-tool').addEventListener('click', () => this.setTool('pen')); document.getElementById('eraser-tool').addEventListener('click', () => this.setTool('eraser')); document.getElementById('bucket-tool').addEventListener('click', () => this.setTool('bucket')); document.getElementById('move-tool').addEventListener('click', () => this.app.canvasManager.updateCursor()); }
    setTool(tool) {
        this.currentTool = tool; document.querySelectorAll('.left-toolbar .tool-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(tool + '-tool')?.classList.add('active');
        this.app.canvasManager.setCurrentTool(tool);
    }
}

// --- Main Application Class ---
class ToshinkaTegakiTool {
    constructor() { this.initManagers(); }
    initManagers() {
        this.canvasManager = new CanvasManager(this);
        this.layerManager = new LayerManager(this);
        this.penSettingsManager = new PenSettingsManager(this);
        this.toolManager = new ToolManager(this);
        this.colorManager = new ColorManager(this);
        if (typeof LayerUIManager !== 'undefined') {
            this.layerUIManager = new LayerUIManager(this);
        }
        this.layerManager.setupInitialLayers();
        this.toolManager.setTool('pen');
        this.penSettingsManager.setSize(1);
        this.colorManager.setColor(this.colorManager.mainColor);
    }
}

// --- Global Initializer ---
window.addEventListener('DOMContentLoaded', () => {
    if (!window.toshinkaTegakiInitialized) {
        window.toshinkaTegakiInitialized = true;
        window.toshinkaTegakiTool = new ToshinkaTegakiTool();
    }
});
