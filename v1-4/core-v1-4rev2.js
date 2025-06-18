// 2025/06 transform刷新対応

class CanvasManager {
    constructor(app) {
        this.app = app;
        this.canvasArea = document.getElementById('canvas-area');
        this.canvasContainer = document.getElementById('canvas-container');
        this.frameCanvas = null;
        this.currentTool = 'pen';
        this.currentColor = '#800000';
        this.currentSize = 1;
        this.isDrawing = false;
        this.isPanning = false;
        this.isMovingLayer = false;
        this.isSpaceDown = false;
        this.lastX = 0;
        this.lastY = 0;
        this.history = [];
        this.historyIndex = -1;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.moveLayerStartX = 0;
        this.moveLayerStartY = 0;
        this.scale = 1;
        this.rotation = 0;
        this.transformState = { scaleX: 1, scaleY: 1 };
        this.activeLayer = null;
        this.activeCtx = null;
        this.createAndDrawFrame();
        this.bindEvents();
    }

    createAndDrawFrame() {
        this.frameCanvas = document.createElement('canvas');
        this.frameCanvas.width = 364;
        this.frameCanvas.height = 145;
        this.frameCanvas.style.position = 'absolute';
        this.frameCanvas.style.left = '-10px';
        this.frameCanvas.style.top = '-5px';
        this.frameCanvas.style.zIndex = '-1';
        this.frameCanvas.style.pointerEvents = 'none';
        this.canvasContainer.insertBefore(this.frameCanvas, this.canvasContainer.firstChild);
        const frameCtx = this.frameCanvas.getContext('2d');
        frameCtx.fillStyle = '#ffffff';
        frameCtx.strokeStyle = '#cccccc';
        frameCtx.lineWidth = 1;
        frameCtx.beginPath();
        frameCtx.roundRect(0.5, 0.5, this.frameCanvas.width - 1, this.frameCanvas.height - 1, 8);
        frameCtx.fill();
        frameCtx.stroke();
    }

    bindEvents() {
        this.canvasArea.addEventListener('pointerdown', this.onPointerDown.bind(this));
        document.addEventListener('pointermove', this.onPointerMove.bind(this));
        document.addEventListener('pointerup', this.onPointerUp.bind(this));
        this.canvasArea.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
    }

    setActiveLayerContext(canvas, ctx) {
        this.activeLayer = canvas;
        this.activeCtx = ctx;
        this.updateCursor();
    }

    setCurrentTool(tool) {
        this.currentTool = tool;
    }

    setCurrentColor(color) {
        this.currentColor = color;
    }

    setCurrentSize(size) {
        this.currentSize = size;
    }

    onPointerDown(e) {
        if (!this.app.layerManager) return;
        if (!this.activeLayer || e.target !== this.activeLayer) return;
        const coords = this.getCanvasCoordinates(e, this.app.layerManager.activeLayerIndex);
        this.lastX = coords.x;
        this.lastY = coords.y;
        if (this.currentTool === 'move') {
            this.isMovingLayer = true;
            this.moveLayerStartX = e.clientX;
            this.moveLayerStartY = e.clientY;
        } else if (this.currentTool === 'bucket') {
            this.fill(Math.floor(this.lastX), Math.floor(this.lastY), this.currentColor);
            this.saveState();
        } else {
            this.isDrawing = true;
            this.activeCtx.beginPath();
            this.activeCtx.moveTo(this.lastX, this.lastY);
        }
        try { document.documentElement.setPointerCapture(e.pointerId); } catch (err) {}
    }

    onPointerMove(e) {
        if (!e.buttons) return;
        if (!this.app.layerManager) return;
        if (this.isMovingLayer) {
            const dx = e.clientX - this.moveLayerStartX;
            const dy = e.clientY - this.moveLayerStartY;
            this.app.layerManager.moveActiveLayer(dx, dy);
            this.moveLayerStartX = e.clientX;
            this.moveLayerStartY = e.clientY;
        } else if (this.isDrawing) {
            const coords = this.getCanvasCoordinates(e, this.app.layerManager.activeLayerIndex);
            const currentX = coords.x;
            const currentY = coords.y;
            this.activeCtx.globalCompositeOperation = this.currentTool === 'eraser' ? 'destination-out' : 'source-over';
            this.activeCtx.strokeStyle = this.currentColor;
            this.activeCtx.lineWidth = this.currentSize;
            this.activeCtx.lineTo(currentX, currentY);
            this.activeCtx.stroke();
            this.lastX = currentX;
            this.lastY = currentY;
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
            this.activeCtx.closePath();
            this.saveState();
        }
        if (this.isMovingLayer) this.isMovingLayer = false;
    }

    getCanvasCoordinates(e, layerIndex) {
        // 2025/06 transform刷新: レイヤーごとのtransform情報を逆変換
        const layer = this.app.layerManager.layers[layerIndex];
        if (!layer) return { x: 0, y: 0 };
        const rect = this.activeLayer.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        let x = e.clientX - cx;
        let y = e.clientY - cy;
        // 逆transform
        const t = layer.transform;
        const rad = -t.rotation * Math.PI / 180;
        const cos = Math.cos(rad), sin = Math.sin(rad);
        let tx = x * cos - y * sin;
        let ty = x * sin + y * cos;
        tx = tx / t.scale / t.scaleX;
        ty = ty / t.scale / t.scaleY;
        return {
            x: tx + this.activeLayer.width / 2,
            y: ty + this.activeLayer.height / 2
        };
    }

    updateCursor() {
        if (!this.activeLayer) return;
        switch (this.currentTool) {
            case 'move': this.activeLayer.style.cursor = 'move'; break;
            case 'pen':
            case 'eraser':
            case 'bucket':
            default: this.activeLayer.style.cursor = 'crosshair'; break;
        }
    }

    saveState() {
        if (!this.activeCtx) return;
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        this.history.push(this.activeCtx.getImageData(0, 0, this.activeLayer.width, this.activeLayer.height));
        this.historyIndex++;
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.activeCtx.putImageData(this.history[this.historyIndex], 0, 0);
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.activeCtx.putImageData(this.history[this.historyIndex], 0, 0);
        }
    }

    clearCanvas() {
        this.activeCtx.clearRect(0, 0, this.activeLayer.width, this.activeLayer.height);
        this.saveState();
    }

    clearAllLayers() {
        if (!this.app.layerManager || !this.app.layerManager.layers) return;
        this.app.layerManager.layers.forEach((layer, index) => {
            const lw = layer.canvas.width;
            const lh = layer.canvas.height;
            layer.ctx.clearRect(0, 0, lw, lh);
            if (index === 0) {
                layer.ctx.fillStyle = '#f0e0d6';
                layer.ctx.fillRect(0, 0, lw, lh);
            }
        });
        this.saveState();
    }

    flipHorizontal() {
        this.app.layerManager.flipActiveLayerHorizontal();
    }

    flipVertical() {
        this.app.layerManager.flipActiveLayerVertical();
    }

    zoom(factor) {
        this.app.layerManager.scaleActiveLayer(factor);
    }

    rotate(degrees) {
        this.app.layerManager.rotateActiveLayer(degrees);
    }

    resetView() {
        this.app.layerManager.resetActiveLayerTransform();
    }

    handleWheel(e) {
        if (this.app.shortcutManager && this.app.shortcutManager.handleWheel(e)) {
            e.preventDefault();
            return;
        }
        e.preventDefault();
        const delta = e.deltaY > 0 ? -1 : 1;
        if (e.shiftKey) {
            this.rotate(delta * 15);
        } else {
            this.zoom(delta > 0 ? 1.1 : 1 / 1.1);
        }
    }

    colorsMatch(a, b) {
        return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
    }

    getPixelColor(imageData, x, y) {
        const i = (y * imageData.width + x) * 4;
        return [imageData.data[i], imageData.data[i + 1], imageData.data[i + 2], imageData.data[i + 3]];
    }

    setPixelColor(imageData, x, y, color) {
        const i = (y * imageData.width + x) * 4;
        imageData.data[i] = color[0];
        imageData.data[i + 1] = color[1];
        imageData.data[i + 2] = color[2];
        imageData.data[i + 3] = color[3];
    }

    fill(startX, startY, fillColor) {
        const canvasWidth = this.activeLayer.width;
        const canvasHeight = this.activeLayer.height;
        const imageData = this.activeCtx.getImageData(0, 0, canvasWidth, canvasHeight);
        const startColor = this.getPixelColor(imageData, startX, startY);
        const fillColorArr = this.hexToRgba(fillColor);
        if (this.colorsMatch(startColor, fillColorArr)) return;
        const queue = [[startX, startY]];
        while (queue.length > 0) {
            const [x, y] = queue.pop();
            if (x < 0 || x >= canvasWidth || y < 0 || y >= canvasHeight) continue;
            if (!this.colorsMatch(this.getPixelColor(imageData, x, y), startColor)) continue;
            this.setPixelColor(imageData, x, y, fillColorArr);
            queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }
        this.activeCtx.putImageData(imageData, 0, 0);
    }

    hexToRgba(hex) {
        const c = hex.replace('#', '');
        if (c.length === 3) {
            const r = parseInt(c[0] + c[0], 16);
            const g = parseInt(c[1] + c[1], 16);
            const b = parseInt(c[2] + c[2], 16);
            return [r, g, b, 255];
        } else if (c.length === 6) {
            const r = parseInt(c.substring(0, 2), 16);
            const g = parseInt(c.substring(2, 4), 16);
            const b = parseInt(c.substring(4, 6), 16);
            return [r, g, b, 255];
        }
        return [0, 0, 0, 255];
    }

    // 2025/06 transform刷新: 合成描画メソッド
    drawComposite(ctx, width, height) {
        if (!this.app.layerManager) return;
        ctx.clearRect(0, 0, width, height);
        this.app.layerManager.layers.forEach((layer, idx) => {
            if (!layer || !layer.canvas) return;
            ctx.save();
            const t = layer.transform;
            ctx.translate(width / 2 + t.x, height / 2 + t.y);
            ctx.rotate(t.rotation * Math.PI / 180);
            ctx.scale(t.scale * t.scaleX, t.scale * t.scaleY);
            ctx.beginPath();
            ctx.rect(-layer.canvas.width / 2, -layer.canvas.height / 2, layer.canvas.width, layer.canvas.height);
            ctx.clip();
            ctx.drawImage(layer.canvas, -layer.canvas.width / 2, -layer.canvas.height / 2);
            ctx.restore();
        });
    }
}

class LayerManager {
    constructor(app) {
        this.app = app;
        this.layers = [];
        this.activeLayerIndex = -1;
        this.canvasContainer = document.getElementById('canvas-container');
    }

    getDefaultTransform() {
        return {
            x: 0, y: 0, scale: 1, rotation: 0, scaleX: 1, scaleY: 1,
        };
    }

    setupInitialLayers() {
        const initialCanvas = document.getElementById('drawingCanvas');
        if (!initialCanvas) return;
        this.layers.push({
            canvas: initialCanvas,
            ctx: initialCanvas.getContext('2d'),
            transform: this.getDefaultTransform(),
        });
        const firstLayerCtx = this.layers[0].ctx;
        firstLayerCtx.fillStyle = '#f0e0d6';
        firstLayerCtx.fillRect(0, 0, initialCanvas.width, initialCanvas.height);
        this.switchLayer(0);
    }

    addLayer() {
        if (this.layers.length === 0) return null;
        const baseCanvas = this.layers[0].canvas;
        const newCanvas = document.createElement('canvas');
        newCanvas.width = baseCanvas.width;
        newCanvas.height = baseCanvas.height;
        newCanvas.className = 'main-canvas';
        newCanvas.style.position = 'absolute';
        newCanvas.style.top = '0';
        newCanvas.style.left = '0';
        this.canvasContainer.appendChild(newCanvas);
        const newLayer = {
            canvas: newCanvas,
            ctx: newCanvas.getContext('2d'),
            transform: this.getDefaultTransform(),
        };
        this.layers.push(newLayer);
        newLayer.ctx.lineCap = 'round';
        newLayer.ctx.lineJoin = 'round';
        this.switchLayer(this.layers.length - 1);
        return newLayer;
    }

    switchLayer(index) {
        if (index < 0 || index >= this.layers.length) return;
        this.activeLayerIndex = index;
        const activeLayer = this.getCurrentLayer();
        if (activeLayer) {
            this.app.canvasManager.setActiveLayerContext(activeLayer.canvas, activeLayer.ctx);
            this.layers.forEach((layer, i) => {
                layer.canvas.style.pointerEvents = (i === index) ? 'auto' : 'none';
            });
            const infoEl = document.getElementById('current-layer-info');
            if (infoEl) {
                infoEl.textContent = `L: ${this.activeLayerIndex + 1}/${this.layers.length}`;
            }
        }
    }

    getCurrentLayer() {
        if (this.activeLayerIndex >= 0 && this.activeLayerIndex < this.layers.length) {
            return this.layers[this.activeLayerIndex];
        }
        return null;
    }

    moveActiveLayer(dx, dy) {
        const layer = this.getCurrentLayer();
        if (layer) {
            layer.transform.x += dx;
        layer.transform.y += dy;
        }
    }

    scaleActiveLayer(factor) {
        const layer = this.getCurrentLayer();
        if (layer) {
            layer.transform.scale *= factor;
        }
    }

    rotateActiveLayer(degrees) {
        const layer = this.getCurrentLayer();
        if (layer) {
            layer.transform.rotation = (layer.transform.rotation + degrees) % 360;
        }
    }

    flipActiveLayerHorizontal() {
        const layer = this.getCurrentLayer();
        if (layer) {
            layer.transform.scaleX *= -1;
        }
    }

    flipActiveLayerVertical() {
        const layer = this.getCurrentLayer();
        if (layer) {
            layer.transform.scaleY *= -1;
        }
    }

    resetActiveLayerTransform() {
        const layer = this.getCurrentLayer();
        if (layer) {
            layer.transform = this.getDefaultTransform();
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
        this.app.canvasManager.setCurrentTool(tool);
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
        this.app.canvasManager.setCurrentSize(this.currentSize);
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
        this.app.canvasManager.setCurrentColor(this.mainColor);
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