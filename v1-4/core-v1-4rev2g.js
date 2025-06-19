class CanvasManager {
    constructor(app) {
        this.app = app;
        this.canvasArea = document.getElementById('canvas-area');
        this.canvasContainer = document.getElementById('canvas-container');

        // --- 新しい描画キャンバスと額縁のセットアップ ---
        this.compositeCanvas = document.createElement('canvas');
        this.compositeCanvas.id = 'composite-canvas';
        this.compositeCanvas.width = 344;
        this.compositeCanvas.height = 135;
        this.compositeCtx = this.compositeCanvas.getContext('2d');

        this.frameCanvas = document.createElement('canvas');
        this.frameCanvas.width = 364;
        this.frameCanvas.height = 145;
        this.frameCtx = this.frameCanvas.getContext('2d');
        
        // 元のキャンバスは非表示にし、新しいキャンバスをコンテナに追加
        const initialCanvas = document.getElementById('drawingCanvas');
        if (initialCanvas) initialCanvas.style.display = 'none';
        this.canvasContainer.innerHTML = ''; // コンテナをクリア
        this.canvasContainer.appendChild(this.frameCanvas);
        this.canvasContainer.appendChild(this.compositeCanvas);
        
        this.activeLayer = null;

        // --- 描画状態 ---
        this.isDrawing = false;
        this.isPanning = false;
        this.isRotatingWithSpace = false;
        this.isMovingLayer = false;
        this.isSpaceDown = false;
        
        this.lastX = 0;
        this.lastY = 0;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.rotateStartAngle = 0;

        // --- Transform管理 ---
        this.viewTransform = this.getDefaultViewTransform();
        
        this.drawFrame();
        this.bindEvents();
        this.updateViewTransform();
    }

    getDefaultViewTransform() {
        return { x: 0, y: 0, scale: 1, rotation: 0 };
    }

    drawFrame() {
        this.frameCtx.fillStyle = '#ffffff';
        this.frameCtx.strokeStyle = '#cccccc';
        this.frameCtx.lineWidth = 1;
        this.frameCtx.clearRect(0, 0, this.frameCanvas.width, this.frameCanvas.height);
        this.frameCtx.beginPath();
        this.frameCtx.roundRect(0.5, 0.5, this.frameCanvas.width - 1, this.frameCanvas.height - 1, 8);
        this.frameCtx.fill();
        this.frameCtx.stroke();
    }

    bindEvents() {
        this.canvasArea.addEventListener('pointerdown', this.onPointerDown.bind(this));
        document.addEventListener('pointermove', this.onPointerMove.bind(this));
        document.addEventListener('pointerup', this.onPointerUp.bind(this));
        this.canvasArea.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
    }

    setActiveLayer(layer) {
        this.activeLayer = layer;
        this.updateCursor();
    }
    
    // --- 描画と合成 ---
    drawComposite() {
        if (!this.app.layerManager) return;
        const ctx = this.compositeCtx;
        const width = this.compositeCanvas.width;
        const height = this.compositeCanvas.height;

        ctx.clearRect(0, 0, width, height);
        
        // 背景レイヤー（レイヤー0）を特別に描画
        const baseLayer = this.app.layerManager.layers[0];
        if(baseLayer) {
            ctx.drawImage(baseLayer.canvas, 0, 0);
        }

        // アクティブな描画レイヤーを合成
        this.app.layerManager.layers.slice(1).forEach(layer => {
            if (!layer || !layer.canvas) return;
            ctx.save();
            const t = layer.transform;
            const cx = width / 2;
            const cy = height / 2;

            ctx.translate(cx + t.x, cy + t.y);
            ctx.rotate(t.rotation * Math.PI / 180);
            ctx.scale(t.scale * t.scaleX, t.scale * t.scaleY);
            ctx.translate(-cx, -cy);
            
            ctx.drawImage(layer.canvas, 0, 0);
            ctx.restore();
        });
    }

    // --- イベントハンドラ ---
    onPointerDown(e) {
        if (this.isSpaceDown) {
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
            const rect = this.canvasContainer.getBoundingClientRect();
            this.isPanning = true;
            this.initialViewX = this.viewTransform.x;
            this.initialViewY = this.viewTransform.y;
            e.preventDefault();
        } else {
            if (!this.activeLayer || e.target !== this.compositeCanvas) return;
            const coords = this.getCanvasCoordinates(e);
            this.lastX = coords.x;
            this.lastY = coords.y;

            if (this.app.toolManager.getCurrentTool() === 'move') {
                this.isMovingLayer = true;
                this.dragStartX = e.clientX;
                this.dragStartY = e.clientY;
            } else if (this.app.toolManager.getCurrentTool() === 'bucket') {
                this.fill(Math.floor(this.lastX), Math.floor(this.lastY), this.app.colorManager.mainColor);
                this.app.layerManager.saveState();
            } else {
                this.isDrawing = true;
                this.activeLayer.ctx.beginPath();
                this.activeLayer.ctx.moveTo(this.lastX, this.lastY);
            }
        }
        try {
            document.documentElement.setPointerCapture(e.pointerId);
        } catch (err) {}
    }

    onPointerMove(e) {
        if (!e.buttons) return;
        if (this.isPanning) {
            const deltaX = e.clientX - this.dragStartX;
            const deltaY = e.clientY - this.dragStartY;
            this.viewTransform.x = this.initialViewX + deltaX;
            this.viewTransform.y = this.initialViewY + deltaY;
            this.updateViewTransform();
        } else if (this.isMovingLayer) {
            const dx = (e.clientX - this.dragStartX);
            const dy = (e.clientY - this.dragStartY);
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
             this.app.layerManager.moveActiveLayer(dx / this.viewTransform.scale, dy / this.viewTransform.scale);
        } else if (this.isDrawing) {
            const coords = this.getCanvasCoordinates(e);
            const currentX = coords.x;
            const currentY = coords.y;
            const ctx = this.activeLayer.ctx;
            ctx.globalCompositeOperation = this.app.toolManager.getCurrentTool() === 'eraser' ? 'destination-out' : 'source-over';
            ctx.strokeStyle = this.app.colorManager.mainColor;
            ctx.lineWidth = this.app.penSettingsManager.currentSize;
            ctx.lineTo(currentX, currentY);
            ctx.stroke();
            this.lastX = currentX;
            this.lastY = currentY;
            this.drawComposite();
        }
    }

    onPointerUp(e) {
        try {
            if (document.documentElement.hasPointerCapture(e.pointerId)) {
                document.documentElement.releasePointerCapture(e.pointerId);
            }
        } catch (err) {}
        if (this.isDrawing) {
            this.isDrawing = false;
            this.activeLayer.ctx.closePath();
            this.app.layerManager.saveState();
        }
        this.isPanning = false;
        this.isMovingLayer = false;
    }

    // --- 座標計算 ---
    getCanvasCoordinates(e) {
        const rect = this.compositeCanvas.getBoundingClientRect();
        const view = this.viewTransform;
        const layer = this.activeLayer;

        // 1. マウス座標 -> ビューポート座標
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;

        // 2. ビューポート座標 -> ワールド座標 (View Transformの逆変換)
        const- canvas_cx = this.compositeCanvas.width / 2;
        const- canvas_cy = this.compositeCanvas.height / 2;
        x -= canvas_cx;
        y -= canvas_cy;
        x /= view.scale;
        y /= view.scale;
        const rad_view = -view.rotation * Math.PI / 180;
        const cos_view = Math.cos(rad_view);
        const sin_view = Math.sin(rad_view);
        let worldX = x * cos_view - y * sin_view;
        let worldY = x * sin_view + y * cos_view;
        worldX += canvas_cx;
        worldY += canvas_cy;

        // 3. ワールド座標 -> レイヤーローカル座標 (Layer Transformの逆変換)
        if (layer && layer.transform) {
            const t = layer.transform;
            worldX -= (canvas_cx + t.x);
            worldY -= (canvas_cy + t.y);
            
            const finalScaleX = t.scale * t.scaleX;
            const finalScaleY = t.scale * t.scaleY;

            worldX /= finalScaleX;
            worldY /= finalScaleY;

            const rad_layer = -t.rotation * Math.PI / 180;
            const cos_layer = Math.cos(rad_layer);
            const sin_layer = Math.sin(rad_layer);
            let localX = worldX * cos_layer - worldY * sin_layer;
            let localY = worldX * sin_layer + worldY * cos_layer;

            return { x: localX + canvas_cx, y: localY + canvas_cy };
        }
        
        return { x: worldX, y: worldY };
    }
    
    // --- ビュー操作 ---
    updateViewTransform() {
        const transform = `translate(${this.viewTransform.x}px, ${this.viewTransform.y}px) rotate(${this.viewTransform.rotation}deg) scale(${this.viewTransform.scale})`;
        this.canvasContainer.style.transform = transform;
    }

    panView(dx, dy) {
        this.viewTransform.x += dx;
        this.viewTransform.y += dy;
        this.updateViewTransform();
    }

    zoomView(factor, pivotX, pivotY) {
        const newScale = Math.max(0.1, Math.min(this.viewTransform.scale * factor, 10));
        this.viewTransform.scale = newScale;
        this.updateViewTransform();
    }
    
    rotateView(degrees) {
        this.viewTransform.rotation = (this.viewTransform.rotation + degrees) % 360;
        this.updateViewTransform();
    }

    resetView() {
        this.viewTransform = this.getDefaultViewTransform();
        this.updateViewTransform();
    }

    // --- ツール実装 ---
    undo() { this.app.layerManager.undo(); }
    redo() { this.app.layerManager.redo(); }
    clearCanvas() { this.app.layerManager.clearActiveLayer(); }
    clearAllLayers() { this.app.layerManager.clearAllLayers(); }

    fill(startX, startY, fillColor) {
        if (!this.activeLayer) return;
        const ctx = this.activeLayer.ctx;
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;
        const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
        
        const startColor = this.getPixelColor(imageData, startX, startY);
        const fillColorArr = this.hexToRgba(fillColor);

        if (this.colorsMatch(startColor, fillColorArr)) return;
        if (startX < 0 || startX >= canvasWidth || startY < 0 || startY >= canvasHeight) return;

        const queue = [[startX, startY]];
        while (queue.length > 0) {
            const [x, y] = queue.shift();
            if (x < 0 || x >= canvasWidth || y < 0 || y >= canvasHeight) continue;
            if (!this.colorsMatch(this.getPixelColor(imageData, x, y), startColor)) continue;
            
            this.setPixelColor(imageData, x, y, fillColorArr);
            queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }
        ctx.putImageData(imageData, 0, 0);
        this.drawComposite();
    }

    hexToRgba(hex) {
        const c = hex.replace('#', '');
        const L = c.length;
        const r = parseInt(c.substring(0, L/3), 16);
        const g = parseInt(c.substring(L/3, 2*L/3), 16);
        const b = parseInt(c.substring(2*L/3, L), 16);
        return [r, g, b, 255];
    }
    colorsMatch(a, b) { return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3]; }
    getPixelColor(imageData, x, y) { const i = (y * imageData.width + x) * 4; return [imageData.data[i], imageData.data[i + 1], imageData.data[i + 2], imageData.data[i + 3]]; }
    setPixelColor(imageData, x, y, color) { const i = (y * imageData.width + x) * 4; imageData.data.set(color, i); }

    // --- その他 ---
    updateCursor() {
        const cursorStyle = this.isSpaceDown ? 'grab' : 
                            this.app.toolManager.getCurrentTool() === 'move' ? 'move' : 'crosshair';
        this.compositeCanvas.style.cursor = cursorStyle;
        this.canvasArea.style.cursor = this.isSpaceDown ? 'grab' : 'default';
    }

    handleWheel(e) {
        if (this.app.shortcutManager && this.app.shortcutManager.handleWheel(e)) {
            e.preventDefault(); return;
        }
        e.preventDefault();
        const delta = e.deltaY > 0 ? -1 : 1;
        const rect = this.canvasArea.getBoundingClientRect();
        const pivotX = e.clientX - rect.left - this.viewTransform.x;
        const pivotY = e.clientY - rect.top - this.viewTransform.y;
        if (e.shiftKey) {
            this.rotateView(delta * 5);
        } else {
            this.zoomView(delta > 0 ? 1.1 : 1 / 1.1, pivotX, pivotY);
        }
    }
}

class LayerManager {
    constructor(app) {
        this.app = app;
        this.layers = [];
        this.activeLayerIndex = -1;
    }

    getDefaultTransform() {
        return { x: 0, y: 0, scale: 1, rotation: 0, scaleX: 1, scaleY: 1 };
    }

    setupInitialLayers() {
        const initialCanvas = document.getElementById('drawingCanvas');
        if (!initialCanvas) return;

        // 背景レイヤー (レイヤー0)
        const baseLayer = this.addLayer(false); // Do not switch to it
        baseLayer.ctx.fillStyle = '#f0e0d6';
        baseLayer.ctx.fillRect(0, 0, baseLayer.canvas.width, baseLayer.canvas.height);
        this.saveState(baseLayer);

        // 最初の描画レイヤー (レイヤー1)
        const firstDrawingLayer = this.addLayer(true);
        this.switchLayer(1);
        
        this.app.canvasManager.drawComposite();
    }

    addLayer(switchTo = true) {
        const baseCanvas = this.app.canvasManager.compositeCanvas;
        const newCanvas = document.createElement('canvas');
        newCanvas.width = baseCanvas.width;
        newCanvas.height = baseCanvas.height;
        const newCtx = newCanvas.getContext('2d');
        newCtx.lineCap = 'round';
        newCtx.lineJoin = 'round';

        const newLayer = {
            canvas: newCanvas,
            ctx: newCtx,
            transform: this.getDefaultTransform(),
            history: [],
            historyIndex: -1
        };

        this.layers.push(newLayer);
        this.saveState(newLayer); // Save initial blank state

        if (switchTo) {
            this.switchLayer(this.layers.length - 1);
        }
        return newLayer;
    }

    switchLayer(index) {
        if (index < 0 || index >= this.layers.length || index === 0 /* cannot select base layer */) return;
        this.activeLayerIndex = index;
        const activeLayer = this.getCurrentLayer();
        if (activeLayer) {
            this.app.canvasManager.setActiveLayer(activeLayer);
        }
        const infoEl = document.getElementById('current-layer-info');
        if (infoEl) {
             infoEl.textContent = `L: ${this.activeLayerIndex}/${this.layers.length - 1}`;
        }
    }

    getCurrentLayer() {
        return this.layers[this.activeLayerIndex];
    }
    
    updateActiveLayerTransform() {
        this.app.canvasManager.drawComposite();
    }

    // --- Active Layer History ---
    saveState(layer = null) {
        const targetLayer = layer || this.getCurrentLayer();
        if (!targetLayer) return;
        if (targetLayer.historyIndex < targetLayer.history.length - 1) {
            targetLayer.history = targetLayer.history.slice(0, targetLayer.historyIndex + 1);
        }
        targetLayer.history.push(targetLayer.ctx.getImageData(0, 0, targetLayer.canvas.width, targetLayer.canvas.height));
        targetLayer.historyIndex++;
    }
    
    undo() {
        const layer = this.getCurrentLayer();
        if (layer && layer.historyIndex > 0) {
            layer.historyIndex--;
            layer.ctx.putImageData(layer.history[layer.historyIndex], 0, 0);
            this.app.canvasManager.drawComposite();
        }
    }
    
    redo() {
        const layer = this.getCurrentLayer();
        if (layer && layer.historyIndex < layer.history.length - 1) {
            layer.historyIndex++;
            layer.ctx.putImageData(layer.history[layer.historyIndex], 0, 0);
            this.app.canvasManager.drawComposite();
        }
    }

    clearActiveLayer() {
        const layer = this.getCurrentLayer();
        if (layer) {
            layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
            this.saveState();
            this.app.canvasManager.drawComposite();
        }
    }

    clearAllLayers() {
        this.layers.forEach((layer, index) => {
            if(index === 0) { // Base layer
                layer.ctx.fillStyle = '#f0e0d6';
                layer.ctx.fillRect(0, 0, layer.canvas.width, layer.canvas.height);
            } else { // Drawing layers
                layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
            }
            this.saveState(layer);
        });
        this.app.canvasManager.drawComposite();
    }

    // --- Active Layer Transform ---
    moveActiveLayer(dx, dy) {
        const layer = this.getCurrentLayer();
        if (layer) {
            layer.transform.x += dx;
            layer.transform.y += dy;
            this.updateActiveLayerTransform();
        }
    }

    scaleActiveLayer(factor) {
        const layer = this.getCurrentLayer();
        if (layer) {
            layer.transform.scale *= factor;
            this.updateActiveLayerTransform();
        }
    }

    rotateActiveLayer(degrees) {
        const layer = this.getCurrentLayer();
        if (layer) {
            layer.transform.rotation = (layer.transform.rotation + degrees) % 360;
            this.updateActiveLayerTransform();
        }
    }

    flipActiveLayerHorizontal() {
        const layer = this.getCurrentLayer();
        if (layer) {
            layer.transform.scaleX *= -1;
            this.updateActiveLayerTransform();
        }
    }

    flipActiveLayerVertical() {
        const layer = this.getCurrentLayer();
        if (layer) {
            layer.transform.scaleY *= -1;
            this.updateActiveLayerTransform();
        }
    }
}

class ToolManager {
    constructor(app) {
        this.app = app;
        this.currentTool = 'pen';
        this.bindEvents();
    }
    bindEvents() {
        document.getElementById('pen-tool').addEventListener('click', () => this.setTool('pen'));
        document.getElementById('eraser-tool').addEventListener('click', () => this.setTool('eraser'));
        document.getElementById('move-tool').addEventListener('click', () => this.setTool('move'));
        document.getElementById('bucket-tool').addEventListener('click', () => this.setTool('bucket'));
    }
    setTool(tool) {
        this.currentTool = tool;
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        const toolButton = document.getElementById(tool + '-tool');
        if (toolButton) toolButton.classList.add('active');
        this.app.canvasManager.updateCursor();
    }
    getCurrentTool() {
        return this.currentTool;
    }
}

class PenSettingsManager {
    constructor(app) {
        this.app = app;
        this.currentSize = 1;
        this.sizes = Array.from(document.querySelectorAll('.size-btn')).map(btn => parseInt(btn.dataset.size));
        this.currentSizeIndex = this.sizes.indexOf(this.currentSize);
        this.bindEvents();
        this.updateSizeButtonVisuals();
    }
    bindEvents() {
        document.querySelectorAll('.size-btn').forEach(btn => {
            btn.addEventListener('click', () => this.setSize(parseInt(btn.dataset.size)));
        });
    }
    setSize(size) {
        this.currentSize = size;
        this.currentSizeIndex = this.sizes.indexOf(this.currentSize);
        document.querySelectorAll('.size-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-size="${size}"]`)?.classList.add('active');
        this.updateSizeButtonVisuals();
    }
    changeSize(increase) {
        let newIndex = this.currentSizeIndex + (increase ? 1 : -1);
        newIndex = Math.max(0, Math.min(newIndex, this.sizes.length - 1));
        this.setSize(this.sizes[newIndex]);
    }
    updateSizeButtonVisuals() {
        document.querySelectorAll('.size-btn').forEach(btn => {
            const size = parseInt(btn.dataset.size);
            const sizeDot = btn.querySelector('.size-dot');
            const sizeNumber = btn.querySelector('.size-number');
            if (sizeDot) {
                const dotSize = Math.min(size, 16);
                sizeDot.style.width = `${dotSize}px`;
                sizeDot.style.height = `${dotSize}px`;
            }
            if (sizeNumber) {
                sizeNumber.textContent = size;
            }
        });
    }
}

class ColorManager {
    constructor(app) {
        this.app = app;
        this.mainColor = '#800000';
        this.subColor = '#f0e0d6';
        this.colors = Array.from(document.querySelectorAll('.color-btn')).map(btn => btn.dataset.color);
        this.currentColorIndex = this.colors.indexOf(this.mainColor);
        this.mainColorDisplay = document.getElementById('main-color-display');
        this.subColorDisplay = document.getElementById('sub-color-display');
        this.bindEvents();
        this.updateColorDisplays();
        document.querySelector(`[data-color="${this.mainColor}"]`)?.classList.add('active');
    }
    bindEvents() {
        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.setColor(e.currentTarget.dataset.color));
        });
        document.querySelector('.color-mode-display').addEventListener('click', () => this.swapColors());
    }
    setColor(color) {
        this.mainColor = color;
        this.currentColorIndex = this.colors.indexOf(this.mainColor);
        document.querySelectorAll('.color-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-color="${color}"]`)?.classList.add('active');
        this.updateColorDisplays();
    }
    updateColorDisplays() {
        this.mainColorDisplay.style.backgroundColor = this.mainColor;
        this.subColorDisplay.style.backgroundColor = this.subColor;
    }
    swapColors() {
        [this.mainColor, this.subColor] = [this.subColor, this.mainColor];
        this.updateColorDisplays();
        this.setColor(this.mainColor);
    }
    resetColors() {
        this.mainColor = '#800000';
        this.subColor = '#f0e0d6';
        this.updateColorDisplays();
        this.setColor(this.mainColor);
    }
    changeColor(increase) {
        let newIndex = this.currentColorIndex + (increase ? 1 : -1);
        newIndex = Math.max(0, Math.min(newIndex, this.colors.length - 1));
        this.setColor(this.colors[newIndex]);
    }
}