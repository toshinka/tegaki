// Toshinka Tegaki Tool core.js v1.6 rev6.2 (Hybrid Engine, Full-featured Hotfix)

// --- Color Utility ---
function hexToRgba(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b, a: 255 };
}

// --- Layer (Hybrid: ImageData + drawingCanvas) ---
class Layer {
    constructor(name, width, height) {
        this.name = name;
        this.visible = true;
        this.isDrawing = false; // For Hybrid Engine

        this.imageData = new ImageData(width, height);
        this.drawingCanvas = document.createElement('canvas');
        this.drawingCanvas.width = width;
        this.drawingCanvas.height = height;
        this.drawingCtx = this.drawingCanvas.getContext('2d', { willReadFrequently: true });
    }

    clear() {
        this.imageData.data.fill(0);
        this.drawingCtx.clearRect(0, 0, this.drawingCanvas.width, this.drawingCanvas.height);
    }

    fill(hexColor) {
        const color = hexToRgba(hexColor);
        const data = this.imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            data.set([color.r, color.g, color.b, color.a], i);
        }
        this.drawingCtx.putImageData(this.imageData, 0, 0);
    }
}

// --- CanvasManager ---
class CanvasManager {
    constructor(app) {
        this.app = app;
        this.displayCanvas = document.getElementById('drawingCanvas');
        this.displayCtx = this.displayCanvas.getContext('2d');
        this.displayCanvas.width = 344;
        this.displayCanvas.height = 135;
        this.canvasArea = document.getElementById('canvas-area');
        this.canvasContainer = document.getElementById('canvas-container');

        this.isDrawing = false; this.isPanning = false; this.isLayerTransforming = false;
        this.isSpaceDown = false; this.isVDown = false; this.isShiftDown = false;
        this.isScalingRotatingLayer = false; this.isScalingRotatingCanvas = false;

        this.currentTool = 'pen'; this.currentColor = '#800000'; this.currentSize = 1;
        this.points = [];
        this.dragStartX = 0; this.dragStartY = 0;

        this.transform = { scale: 1, rotation: 0, flipX: 1, flipY: 1, left: 0, top: 0 };
        this.originalCanvasTransform = {};
        this.layerTransform = { translateX: 0, translateY: 0, scale: 1, rotation: 0, flipX: 1, flipY: 1 };
        this.originalLayerTransform = {};
        this.transformTargetLayerOriginalData = null;
        this.transformBgCache = null;

        this.createAndDrawFrame();
        this.bindEvents();
    }

    createAndDrawFrame() {
        const frameCanvas = document.createElement('canvas');
        frameCanvas.width = 364; frameCanvas.height = 145;
        frameCanvas.style.cssText = "position:absolute;left:-10px;top:-5px;z-index:-1;pointer-events:none;";
        this.canvasContainer.insertBefore(frameCanvas, this.displayCanvas);
        const frameCtx = frameCanvas.getContext('2d');
        frameCtx.fillStyle = '#ffffff'; frameCtx.strokeStyle = '#cccccc'; frameCtx.lineWidth = 1;
        frameCtx.beginPath();
        if (frameCtx.roundRect) frameCtx.roundRect(0.5, 0.5, frameCanvas.width - 1, frameCanvas.height - 1, 8);
        else frameCtx.rect(0.5, 0.5, frameCanvas.width - 1, frameCanvas.height - 1);
        frameCtx.fill(); frameCtx.stroke();
    }

    renderAllLayers() {
        this.displayCtx.clearRect(0, 0, this.displayCanvas.width, this.displayCanvas.height);
        this.app.layerManager.layers.forEach(layer => {
            if (!layer.visible) return;
            const imageSource = layer.isDrawing ? layer.drawingCanvas : layer.imageData;
            
            if (imageSource instanceof ImageData) {
                 const tempCanvas = document.createElement('canvas');
                 tempCanvas.width = imageSource.width; tempCanvas.height = imageSource.height;
                 tempCanvas.getContext('2d').putImageData(imageSource, 0, 0);
                 this.displayCtx.drawImage(tempCanvas, 0, 0);
            } else {
                 this.displayCtx.drawImage(imageSource, 0, 0);
            }
        });
    }

    onPointerDown(e) {
        if (e.button !== 0) return;
        if (this.isLayerTransforming) { this.commitLayerTransform(); return; }

        const commonDragStart = () => { this.dragStartX = e.clientX; this.dragStartY = e.clientY; e.preventDefault(); };
        if (this.isVDown) { if (!this.isLayerTransforming) this.startLayerTransform(); commonDragStart(); this.isScalingRotatingLayer = this.isShiftDown; this.originalLayerTransform = { ...this.layerTransform }; return; }
        if (this.isSpaceDown) { commonDragStart(); this.isScalingRotatingCanvas = this.isShiftDown; this.isPanning = !this.isShiftDown; this.originalCanvasTransform = { ...this.transform }; return; }
        
        const coords = this.getCanvasCoordinates(e); if (!coords) return;
        const activeLayer = this.app.layerManager.getCurrentLayer(); if (!activeLayer) return;

        if (this.currentTool === 'bucket') {
            this.fill(Math.floor(coords.x), Math.floor(coords.y), this.currentColor);
            this.app.historyManager.saveState();
        } else {
            this.isDrawing = true;
            activeLayer.isDrawing = true;
            activeLayer.drawingCtx.clearRect(0, 0, activeLayer.drawingCanvas.width, activeLayer.drawingCanvas.height);
            activeLayer.drawingCtx.putImageData(activeLayer.imageData, 0, 0);

            activeLayer.drawingCtx.globalCompositeOperation = this.currentTool === 'eraser' ? 'destination-out' : 'source-over';
            activeLayer.drawingCtx.strokeStyle = this.currentColor;
            activeLayer.drawingCtx.lineWidth = this.currentSize;
            activeLayer.drawingCtx.lineCap = 'round';
            activeLayer.drawingCtx.lineJoin = 'round';
            
            this.points = [{ x: coords.x, y: coords.y, pressure: e.pressure === 0 ? 1.0 : e.pressure || 1.0 }];
            activeLayer.drawingCtx.beginPath();
            activeLayer.drawingCtx.moveTo(coords.x, coords.y);
            // 1点目から描画を開始
            activeLayer.drawingCtx.lineTo(coords.x + 0.01, coords.y);
            activeLayer.drawingCtx.stroke();
            activeLayer.drawingCtx.moveTo(coords.x, coords.y);
            this.renderAllLayers(); // 1点目をすぐに表示
        }
        try { document.documentElement.setPointerCapture(e.pointerId); } catch (err) {}
    }
    
    onPointerMove(e) {
        if (this.isDrawing) {
            const coords = this.getCanvasCoordinates(e); if (!coords) return;
            const activeLayer = this.app.layerManager.getCurrentLayer(); if (!activeLayer) return;
            
            activeLayer.drawingCtx.lineTo(coords.x, coords.y);
            activeLayer.drawingCtx.stroke();
            this.renderAllLayers();
            return;
        }

        if (!e.buttons) return;
        if (this.isLayerTransforming) { this.applyLayerTransformPreview(e); return; }
        if (this.isPanning || this.isScalingRotatingCanvas) {
            const dx = e.clientX - this.dragStartX, dy = e.clientY - this.dragStartY;
            if (this.isScalingRotatingCanvas) {
                this.transform.scale = Math.max(0.1, this.originalCanvasTransform.scale * (1 - dy * 0.005));
                this.transform.rotation = this.originalCanvasTransform.rotation + (dx * 0.5);
            } else {
                this.transform.left = this.originalCanvasTransform.left + dx;
                this.transform.top = this.originalCanvasTransform.top + dy;
            }
            this.applyTransform();
        }
    }

    onPointerUp(e) {
        if (e.button !== 0) return;
        try { if (document.documentElement.hasPointerCapture(e.pointerId)) document.documentElement.releasePointerCapture(e.pointerId); } catch (err) {}
        
        if (this.isDrawing) {
            const activeLayer = this.app.layerManager.getCurrentLayer();
            if (activeLayer) {
                activeLayer.imageData = activeLayer.drawingCtx.getImageData(0, 0, activeLayer.drawingCanvas.width, activeLayer.drawingCanvas.height);
                activeLayer.isDrawing = false;
            }
            this.isDrawing = false;
            this.app.historyManager.saveState();
            this.renderAllLayers();
            this.points = [];
        }
        this.isPanning = false; this.isScalingRotatingCanvas = false; this.isScalingRotatingLayer = false;
    }
    
    startLayerTransform() {
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (this.isLayerTransforming || !activeLayer || this.app.layerManager.activeLayerIndex === 0) return;
        this.isLayerTransforming = true;
        this.transformTargetLayerOriginalData = new ImageData(new Uint8ClampedArray(activeLayer.imageData.data), activeLayer.imageData.width, activeLayer.imageData.height);
        this.originalLayerTransform = { ...this.layerTransform }; // ここで保存
        this.layerTransform = { translateX: 0, translateY: 0, scale: 1, rotation: 0, flipX: 1, flipY: 1 };
        
        this.transformBgCache = document.createElement('canvas');
        this.transformBgCache.width = this.displayCanvas.width; this.transformBgCache.height = this.displayCanvas.height;
        const bgCtx = this.transformBgCache.getContext('2d');
        this.app.layerManager.layers.forEach((layer, index) => {
            if (layer.visible && index !== this.app.layerManager.activeLayerIndex) {
                 const tempCanvas = document.createElement('canvas'); tempCanvas.width = layer.imageData.width; tempCanvas.height = layer.imageData.height;
                 tempCanvas.getContext('2d').putImageData(layer.imageData, 0, 0);
                 bgCtx.drawImage(tempCanvas, 0, 0);
            }
        });
        this.displayCtx.drawImage(this.transformBgCache, 0, 0);
    }
    
    applyLayerTransformPreview(e) {
        if (!this.isLayerTransforming) return;
        const dx = e.clientX - this.dragStartX; const dy = e.clientY - this.dragStartY;
        if (this.isScalingRotatingLayer) {
            this.layerTransform.scale = Math.max(0.01, this.originalLayerTransform.scale * (1 - dy * 0.005));
            this.layerTransform.rotation = this.originalLayerTransform.rotation + (dx * 0.5 * Math.PI / 180);
        } else {
            this.layerTransform.translateX = this.originalLayerTransform.translateX + dx / this.transform.scale;
            this.layerTransform.translateY = this.originalLayerTransform.translateY + dy / this.transform.scale;
        }
        
        this.displayCtx.drawImage(this.transformBgCache, 0, 0);
        const tempCanvas = document.createElement('canvas'); tempCanvas.width = this.displayCanvas.width; tempCanvas.height = this.displayCanvas.height;
        const tempCtx = tempCanvas.getContext('2d'); tempCtx.putImageData(this.transformTargetLayerOriginalData, 0, 0);
        
        this.displayCtx.save();
        this.displayCtx.translate(this.displayCanvas.width/2, this.displayCanvas.height/2);
        this.displayCtx.translate(this.layerTransform.translateX, this.layerTransform.translateY);
        this.displayCtx.rotate(this.layerTransform.rotation);
        this.displayCtx.scale(this.layerTransform.scale * this.layerTransform.flipX, this.layerTransform.scale * this.layerTransform.flipY);
        this.displayCtx.translate(-this.displayCanvas.width/2, -this.displayCanvas.height/2);
        this.displayCtx.drawImage(tempCanvas, 0, 0);
        this.displayCtx.restore();
    }

    commitLayerTransform() {
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!this.isLayerTransforming || !this.transformTargetLayerOriginalData || !activeLayer) return;
        
        const srcData = this.transformTargetLayerOriginalData;
        const destImageData = new ImageData(srcData.width, srcData.height);
        const m = new DOMMatrix().translate(srcData.width/2, srcData.height/2).translate(this.layerTransform.translateX, this.layerTransform.translateY).rotate(this.layerTransform.rotation * 180 / Math.PI).scale(this.layerTransform.scale * this.layerTransform.flipX, this.layerTransform.scale * this.layerTransform.flipY).translate(-srcData.width/2, -srcData.height/2);
        const invM = m.inverse();

        for (let y = 0; y < destImageData.height; y++) {
            for (let x = 0; x < destImageData.width; x++) {
                const srcP = new DOMPoint(x, y).matrixTransform(invM);
                const sx = Math.round(srcP.x), sy = Math.round(srcP.y);
                if (sx >= 0 && sx < srcData.width && sy >= 0 && sy < srcData.height) {
                    const srcI = (sy * srcData.width + sx) * 4, destI = (y * destImageData.width + x) * 4;
                    destImageData.data.set(srcData.data.subarray(srcI, srcI + 4), destI);
                }
            }
        }
        activeLayer.imageData = destImageData;
        activeLayer.drawingCtx.putImageData(destImageData, 0, 0);

        this.isLayerTransforming = false; this.transformBgCache = null; this.transformTargetLayerOriginalData = null;
        this.renderAllLayers(); this.app.historyManager.saveState();
    }
    
    fill(startX, startY, fillColor) {
        const activeLayer = this.app.layerManager.getCurrentLayer(); if (!activeLayer) return;
        const imageData = activeLayer.imageData, {width, height, data} = imageData, targetColor = hexToRgba(fillColor);
        const stack = [[startX, startY]];
        const getPixel = (x, y) => { const i = (y*width+x)*4; return [data[i],data[i+1],data[i+2],data[i+3]]; };
        const startColor = getPixel(startX, startY);
        if (startColor.every((v, i) => v === [targetColor.r,targetColor.g,targetColor.b,targetColor.a][i])) return;
        const visited = new Uint8Array(width*height);
        while (stack.length > 0) {
            const [x,y] = stack.pop(); if (x<0||x>=width||y<0||y>=height) continue;
            const pos = y*width+x; if (visited[pos]) continue;
            if (getPixel(x,y).every((v, i) => v === startColor[i])) {
                data.set([targetColor.r,targetColor.g,targetColor.b,targetColor.a], pos*4);
                visited[pos] = 1;
                stack.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);
            }
        }
        activeLayer.drawingCtx.putImageData(imageData, 0, 0);
        this.renderAllLayers();
    }
    
    getCanvasCoordinates(e) {
        const rect = this.canvasContainer.getBoundingClientRect(); if (rect.width === 0) return null;
        const t = this.transform; let x = e.clientX-(rect.left+rect.width/2), y = e.clientY-(rect.top+rect.height/2);
        const rad = -t.rotation*Math.PI/180, cos = Math.cos(rad), sin = Math.sin(rad);
        const rotatedX = x*cos-y*sin, rotatedY = x*sin+y*cos;
        return { x: (rotatedX/(t.scale*t.flipX))+this.displayCanvas.width/2, y: (rotatedY/(t.scale*t.flipY))+this.displayCanvas.height/2 };
    }

    // --- メソッド復活ゾーン ---
    applyTransform() { const t = this.transform; this.canvasContainer.style.transform = `translate(${t.left}px, ${t.top}px) scale(${t.scale*t.flipX},${t.scale*t.flipY}) rotate(${t.rotation}deg)`; }
    updateCursor() { this.canvasArea.style.cursor = (this.isSpaceDown || (this.isVDown && !this.isShiftDown)) ? 'grab' : (this.isVDown && this.isShiftDown ? 'move' : 'crosshair'); }
    flipHorizontal() { this.transform.flipX *= -1; this.applyTransform(); }
    flipVertical() { this.transform.flipY *= -1; this.applyTransform(); }
    zoom(factor) { this.transform.scale = Math.max(0.1, Math.min(this.transform.scale * factor, 10)); this.applyTransform(); }
    rotate(degrees) { this.transform.rotation = (this.transform.rotation + degrees) % 360; this.applyTransform(); }
    resetView() { this.transform = { scale: 1, rotation: 0, flipX: 1, flipY: 1, left: 0, top: 0 }; this.applyTransform(); }
    handleWheel(e) { if (this.isVDown) { if (!this.isLayerTransforming) this.startLayerTransform(); if (e.shiftKey) { this.layerTransform.rotation += (e.deltaY > 0 ? -5:5)*Math.PI/180; } else { this.layerTransform.scale *= e.deltaY > 0 ? 0.95:1.05; } this.applyLayerTransformPreview(e); } else { if (e.shiftKey) { this.rotate(-e.deltaY*0.2); } else { this.zoom(e.deltaY > 0 ? 1/1.05:1.05); } } }
    
    bindEvents() { this.canvasArea.addEventListener('pointerdown',this.onPointerDown.bind(this)); document.addEventListener('pointermove',this.onPointerMove.bind(this)); document.addEventListener('pointerup',this.onPointerUp.bind(this)); document.addEventListener('contextmenu',e=>e.preventDefault()); document.getElementById('saveMergedButton').addEventListener('click',()=>this.exportMergedImage()); }
    setCurrentTool(tool) { this.currentTool = tool; }
    setCurrentColor(color) { this.currentColor = color; }
    setCurrentSize(size) { this.currentSize = size; }
    undo() { this.app.historyManager.undo(); }
    redo() { this.app.historyManager.redo(); }
    clearCanvas() { const layer = this.app.layerManager.getCurrentLayer(); if (layer) { layer.clear(); if (this.app.layerManager.activeLayerIndex === 0) layer.fill('#f0e0d6'); this.renderAllLayers(); this.app.historyManager.saveState(); } }
    clearAllLayers() { this.app.layerManager.layers.forEach((layer, index) => { layer.clear(); if (index === 0) layer.fill('#f0e0d6'); }); this.renderAllLayers(); this.app.historyManager.saveState(); }
    exportMergedImage() { const mC = document.createElement('canvas'); mC.width = this.displayCanvas.width; mC.height = this.displayCanvas.height; const mX = mC.getContext('2d'); this.app.layerManager.layers.forEach(l => { if (l.visible && l.imageData) { const tC = document.createElement('canvas'); tC.width=l.imageData.width; tC.height=l.imageData.height; tC.getContext('2d').putImageData(l.imageData,0,0); mX.drawImage(tC,0,0); } }); const dU=mC.toDataURL('image/png'); const a=document.createElement('a'); a.href=dU; a.download='TegakiImage.png'; a.click(); }
}

class LayerManager {
    constructor(app) { this.app = app; this.layers = []; this.activeLayerIndex = -1; this.width = 344; this.height = 135; }
    setupInitialLayers() { const bgLayer = new Layer('背景', this.width, this.height); bgLayer.fill('#f0e0d6'); this.layers.push(bgLayer); this.layers.push(new Layer('レイヤー 1', this.width, this.height)); this.switchLayer(1); }
    addLayer() { if (this.layers.length >= 99) return; const index = this.activeLayerIndex + 1; this.layers.splice(index, 0, new Layer(`レイヤー ${this.layers.length}`, this.width, this.height)); this.renameLayers(); this.switchLayer(index); this.app.historyManager.saveState(); }
    deleteActiveLayer() { if (this.activeLayerIndex <= 0) return; const index = this.activeLayerIndex; this.layers.splice(index, 1); this.renameLayers(); this.switchLayer(Math.max(0, index - 1)); this.app.historyManager.saveState(); }
    duplicateActiveLayer() { const activeLayer = this.getCurrentLayer(); if (!activeLayer) return; const index = this.activeLayerIndex + 1; const newLayer = new Layer(`複製`, this.width, this.height); newLayer.imageData.data.set(activeLayer.imageData.data); newLayer.drawingCtx.putImageData(newLayer.imageData, 0, 0); this.layers.splice(index, 0, newLayer); this.renameLayers(); this.switchLayer(index); this.app.historyManager.saveState(); }
    mergeDownActiveLayer() { if (this.activeLayerIndex <= 0) return; const topLayer = this.layers[this.activeLayerIndex], bottomLayer = this.layers[this.activeLayerIndex-1]; const topData = topLayer.imageData.data, bottomData = bottomLayer.imageData.data; for (let i = 0; i < topData.length; i += 4) { const srcA = topData[i+3]/255; if (srcA === 0) continue; const destA = bottomData[i+3]/255, outA = srcA + destA*(1-srcA); if (outA === 0) continue; bottomData[i] = (topData[i]*srcA + bottomData[i]*destA*(1-srcA))/outA; bottomData[i+1] = (topData[i+1]*srcA + bottomData[i+1]*destA*(1-srcA))/outA; bottomData[i+2] = (topData[i+2]*srcA + bottomData[i+2]*destA*(1-srcA))/outA; bottomData[i+3] = outA*255; } bottomLayer.drawingCtx.putImageData(bottomLayer.imageData,0,0); this.layers.splice(this.activeLayerIndex,1); this.renameLayers(); this.switchLayer(this.activeLayerIndex-1); this.app.historyManager.saveState(); }
    switchLayer(index) { if (index < 0 || index >= this.layers.length) return; this.activeLayerIndex = index; if (this.app.layerUIManager) this.app.layerUIManager.renderLayers(); }
    renameLayers() { this.layers.forEach((l, i) => l.name = i === 0 ? '背景' : `レイヤー ${i}`); }
    getCurrentLayer() { return this.layers[this.activeLayerIndex]; }
}

class HistoryManager {
    constructor(app) { this.app = app; this.history = []; this.historyIndex = -1; }
    saveState() { const state = { layers: this.app.layerManager.layers.map(l => new ImageData(new Uint8ClampedArray(l.imageData.data), l.imageData.width, l.imageData.height)), activeLayerIndex: this.app.layerManager.activeLayerIndex }; this.history = this.history.slice(0, this.historyIndex + 1); this.history.push(state); this.historyIndex++; }
    undo() { if (this.historyIndex <= 0) return; this.historyIndex--; this.restoreState(this.history[this.historyIndex]); }
    redo() { if (this.historyIndex < this.history.length - 1) { this.historyIndex++; this.restoreState(this.history[this.historyIndex]); } }
    restoreState(state) { this.app.layerManager.layers.forEach((layer, index) => { if(state.layers[index]) { layer.imageData.data.set(state.layers[index].data); layer.drawingCtx.putImageData(layer.imageData, 0, 0); } }); this.app.layerManager.activeLayerIndex = state.activeLayerIndex; this.app.layerManager.switchLayer(state.activeLayerIndex); this.app.canvasManager.renderAllLayers(); }
}

class ToshinkaTegakiTool {
    constructor() {
        this.canvasManager = new CanvasManager(this);
        this.layerManager = new LayerManager(this);
        this.historyManager = new HistoryManager(this);
        this.layerUIManager = null; this.shortcutManager = null; this.topBarManager = null;
        this.penSettingsManager = null; this.colorManager = null; this.toolManager = null;
    }
    init() {
        this.layerManager.setupInitialLayers();
        this.historyManager.saveState();
        this.canvasManager.renderAllLayers();
    }
}

window.addEventListener('DOMContentLoaded', () => {
    if (!window.toshinkaTegakiInitialized) {
        window.toshinkaTegakiInitialized = true;
        window.toshinkaTegakiTool = new ToshinkaTegakiTool();
        
        // ui.js側で各種UIマネージャーが初期化された後、app.init()を叩く想定
        // ui.js側でのToshinkaTegakiToolの存在を確認してからUIマネージャを初期化する
        // そのため、ここではapp.init()を呼ばない。ui.jsのDOMContentLoadedの最後に任せる。
    }
});