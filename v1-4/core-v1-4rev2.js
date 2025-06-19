class CanvasManager {
    constructor(app) {
        this.app = app;
        this.compositeCanvas = null;
        this.compositeCtx = null;
        this.frameCanvas = null;
        this.frameCtx = null;
        this.canvasArea = document.getElementById('canvas-area');
        this.canvasContainer = document.getElementById('canvas-container');
        this.viewTransform = {
            x: 0,
            y: 0,
            scale: 1,
            rotation: 0
        };
        this.isDrawing = false;
        this.isPanning = false;
        this.isSpaceDown = false;
        this.isRotatingWithSpace = false;
        this.rotateStartAngle = 0;
        this.initialRotation = 0;
        this.currentTool = 'pen';
        this.currentColor = '#800000';
        this.currentSize = 1;
        this.lastX = 0;
        this.lastY = 0;
        this.history = [];
        this.historyIndex = -1;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.viewStartX = 0;
        this.viewStartY = 0;
        this.createCompositeAndFrame();
        this.bindEvents();
    }
    createCompositeAndFrame() {
        const width = 344, height = 135;
        this.compositeCanvas = document.createElement('canvas');
        this.compositeCanvas.width = width;
        this.compositeCanvas.height = height;
        this.compositeCanvas.className = 'main-canvas';
        this.compositeCanvas.style.position = 'absolute';
        this.compositeCanvas.style.top = '0';
        this.compositeCanvas.style.left = '0';
        this.canvasContainer.appendChild(this.compositeCanvas);
        this.compositeCtx = this.compositeCanvas.getContext('2d');
        this.frameCanvas = document.createElement('canvas');
        this.frameCanvas.width = width;
        this.frameCanvas.height = height;
        this.frameCanvas.style.position = 'absolute';
        this.frameCanvas.style.left = '0';
        this.frameCanvas.style.top = '0';
        this.frameCanvas.style.zIndex = '9999';
        this.frameCanvas.style.pointerEvents = 'none';
        this.canvasContainer.appendChild(this.frameCanvas);
        this.frameCtx = this.frameCanvas.getContext('2d');
    }
    bindEvents() {
        this.compositeCanvas.addEventListener('pointerdown', this.onPointerDown.bind(this));
        document.addEventListener('pointermove', this.onPointerMove.bind(this));
        document.addEventListener('pointerup', this.onPointerUp.bind(this));
        this.compositeCanvas.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
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
    getActiveLayer() {
        return this.app.layerManager.getCurrentLayer();
    }
    getPointerCanvasPos(e) {
        const width = this.compositeCanvas.width, height = this.compositeCanvas.height;
        const cx = width / 2, cy = height / 2;
        let x = e.offsetX, y = e.offsetY;
        let pt = [x - cx, y - cy];
        let rad = -this.viewTransform.rotation;
        let cos = Math.cos(rad), sin = Math.sin(rad);
        pt = [
            pt[0] - this.viewTransform.x,
            pt[1] - this.viewTransform.y
        ];
        let s = this.viewTransform.scale;
        pt = [
            pt[0] / s,
            pt[1] / s
        ];
        let t = [
            pt[0] * cos - pt[1] * sin,
            pt[0] * sin + pt[1] * cos
        ];
        return { x: t[0] + cx, y: t[1] + cy };
    }
    getPointerLayerPos(e) {
        const p = this.getPointerCanvasPos(e);
        const layer = this.getActiveLayer();
        if (!layer) return p;
        const cx = this.compositeCanvas.width / 2, cy = this.compositeCanvas.height / 2;
        let pt = [p.x - cx, p.y - cy];
        let t = layer.transform;
        let rad = -t.rotation;
        let cos = Math.cos(rad), sin = Math.sin(rad);
        pt = [
            pt[0] - t.x,
            pt[1] - t.y
        ];
        let s = t.scale;
        pt = [
            pt[0] / (s * t.scaleX),
            pt[1] / (s * t.scaleY)
        ];
        let t2 = [
            pt[0] * cos - pt[1] * sin,
            pt[0] * sin + pt[1] * cos
        ];
        return { x: t2[0] + cx, y: t2[1] + cy };
    }
    onPointerDown(e) {
        if (this.isSpaceDown) {
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
            this.viewStartX = this.viewTransform.x;
            this.viewStartY = this.viewTransform.y;
            const rect = this.compositeCanvas.getBoundingClientRect();
            const isInside = e.clientX >= rect.left && e.clientX <= rect.right &&
                e.clientY >= rect.top && e.clientY <= rect.bottom;
            if (isInside) {
                this.isPanning = true;
                this.isRotatingWithSpace = false;
            } else {
                this.isPanning = false;
                this.isRotatingWithSpace = true;
                const cx = rect.left + rect.width / 2;
                const cy = rect.top + rect.height / 2;
                this.rotateStartAngle = Math.atan2(e.clientY - cy, e.clientX - cx);
                this.initialRotation = this.viewTransform.rotation;
            }
            e.preventDefault();
        } else {
            if (e.target !== this.compositeCanvas) return;
            const layer = this.getActiveLayer();
            if (!layer) return;
            const coords = this.getPointerLayerPos(e);
            this.lastX = coords.x;
            this.lastY = coords.y;
            if (this.currentTool === 'move') {
                this.app.layerManager.moveStart(e, coords.x, coords.y);
            } else if (this.currentTool === 'bucket') {
                this.fill(Math.floor(this.lastX), Math.floor(this.lastY), this.currentColor);
                this.saveState();
                this.drawComposite();
            } else {
                this.isDrawing = true;
                layer.ctx.beginPath();
                layer.ctx.moveTo(this.lastX, this.lastY);
            }
        }
    }
    onPointerMove(e) {
        if (!e.buttons) return;
        if (this.isRotatingWithSpace) {
            const rect = this.compositeCanvas.getBoundingClientRect();
            const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
            const cur = Math.atan2(e.clientY - cy, e.clientX - cx);
            this.viewTransform.rotation = this.initialRotation + (cur - this.rotateStartAngle);
            this.drawComposite();
        } else if (this.isPanning) {
            const dx = e.clientX - this.dragStartX;
            const dy = e.clientY - this.dragStartY;
            this.viewTransform.x = this.viewStartX + dx;
            this.viewTransform.y = this.viewStartY + dy;
            this.drawComposite();
        } else if (this.currentTool === 'move' && this.app.layerManager.isMovingLayer) {
            const coords = this.getPointerLayerPos(e);
            this.app.layerManager.moveDrag(e, coords.x, coords.y);
            this.drawComposite();
        } else if (this.isDrawing) {
            const layer = this.getActiveLayer();
            if (!layer) return;
            const coords = this.getPointerLayerPos(e);
            layer.ctx.globalCompositeOperation = this.currentTool === 'eraser' ? 'destination-out' : 'source-over';
            layer.ctx.strokeStyle = this.currentColor;
            layer.ctx.lineWidth = this.currentSize;
            layer.ctx.lineTo(coords.x, coords.y);
            layer.ctx.stroke();
            this.lastX = coords.x;
            this.lastY = coords.y;
            this.drawComposite();
        }
    }
    onPointerUp(e) {
        if (this.isDrawing) {
            this.isDrawing = false;
            const layer = this.getActiveLayer();
            if (layer) layer.ctx.closePath();
            this.saveState();
            this.drawComposite();
        }
        if (this.isPanning) this.isPanning = false;
        if (this.isRotatingWithSpace) this.isRotatingWithSpace = false;
        if (this.currentTool === 'move' && this.app.layerManager.isMovingLayer) {
            this.app.layerManager.moveEnd(e);
        }
    }
    updateCursor() {
        if (this.isSpaceDown) {
            this.compositeCanvas.style.cursor = 'grab';
            return;
        }
        switch (this.currentTool) {
            case 'move': this.compositeCanvas.style.cursor = 'move'; break;
            case 'pen':
            case 'eraser':
            case 'bucket':
            default: this.compositeCanvas.style.cursor = 'crosshair'; break;
        }
    }
    saveState() {
        const layer = this.getActiveLayer();
        if (!layer) return;
        if (!layer._history) layer._history = [];
        if (!layer._historyIndex) layer._historyIndex = -1;
        const ctx = layer.ctx;
        if (layer._historyIndex < layer._history.length - 1) {
            layer._history = layer._history.slice(0, layer._historyIndex + 1);
        }
        layer._history.push(ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height));
        layer._historyIndex++;
    }
    undo() {
        const layer = this.getActiveLayer();
        if (!layer || !layer._history || layer._historyIndex <= 0) return;
        layer._historyIndex--;
        layer.ctx.putImageData(layer._history[layer._historyIndex], 0, 0);
        this.drawComposite();
    }
    redo() {
        const layer = this.getActiveLayer();
        if (!layer || !layer._history || layer._historyIndex >= layer._history.length - 1) return;
        layer._historyIndex++;
        layer.ctx.putImageData(layer._history[layer._historyIndex], 0, 0);
        this.drawComposite();
    }
    clearCanvas() {
        const layer = this.getActiveLayer();
        if (!layer) return;
        layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
        this.saveState();
        this.drawComposite();
    }
    clearAllLayers() {
        this.app.layerManager.layers.forEach((layer, idx) => {
            layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
            if (idx === 0) {
                layer.ctx.fillStyle = '#f0e0d6';
                layer.ctx.fillRect(0, 0, layer.canvas.width, layer.canvas.height);
            }
        });
        this.saveState();
        this.drawComposite();
    }
    flipHorizontal() {
        this.viewTransform.x *= -1;
        this.viewTransform.scale *= -1;
        this.drawComposite();
    }
    flipVertical() {
        this.viewTransform.y *= -1;
        this.viewTransform.scale *= -1;
        this.drawComposite();
    }
    zoom(factor) {
        this.viewTransform.scale = Math.max(0.1, Math.min(this.viewTransform.scale * factor, 10));
        this.drawComposite();
    }
    rotate(degrees) {
        this.viewTransform.rotation += degrees * Math.PI / 180;
        this.drawComposite();
    }
    resetView() {
        this.viewTransform.x = 0;
        this.viewTransform.y = 0;
        this.viewTransform.scale = 1;
        this.viewTransform.rotation = 0;
        this.drawComposite();
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
    drawComposite() {
        const width = this.compositeCanvas.width, height = this.compositeCanvas.height;
        const cx = width / 2, cy = height / 2;
        const ctx = this.compositeCtx;
        ctx.clearRect(0, 0, width, height);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.translate(this.viewTransform.x, this.viewTransform.y);
        ctx.rotate(this.viewTransform.rotation);
        ctx.scale(this.viewTransform.scale, this.viewTransform.scale);
        ctx.beginPath();
        ctx.rect(-width/2, -height/2, width, height);
        ctx.clip();
        for (const layer of this.app.layerManager.layers) {
            ctx.save();
            const t = layer.transform;
            ctx.translate(t.x, t.y);
            ctx.rotate(t.rotation);
            ctx.scale(t.scale * t.scaleX, t.scale * t.scaleY);
            ctx.drawImage(layer.canvas, -width/2, -height/2);
            ctx.restore();
        }
        ctx.restore();
        this.drawFrame();
    }
    drawFrame() {
        const width = this.frameCanvas.width, height = this.frameCanvas.height;
        const cx = width / 2, cy = height / 2;
        const ctx = this.frameCtx;
        ctx.clearRect(0, 0, width, height);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.translate(this.viewTransform.x, this.viewTransform.y);
        ctx.rotate(this.viewTransform.rotation);
        ctx.scale(this.viewTransform.scale, this.viewTransform.scale);
        ctx.beginPath();
        ctx.roundRect(-width/2+0.5, -height/2+0.5, width-1, height-1, 8);
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#cccccc';
        ctx.lineWidth = 1;
        ctx.fill();
        ctx.stroke();
        ctx.restore();
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
        const layer = this.getActiveLayer();
        if (!layer) return;
        const canvasWidth = layer.canvas.width;
        const canvasHeight = layer.canvas.height;
        const imageData = layer.ctx.getImageData(0, 0, canvasWidth, canvasHeight);
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
        layer.ctx.putImageData(imageData, 0, 0);
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
}
class LayerManager {
    constructor(app) {
        this.app = app;
        this.layers = [];
        this.activeLayerIndex = -1;
        this.isMovingLayer = false;
        this.moveStartX = 0;
        this.moveStartY = 0;
        this.moveBaseX = 0;
        this.moveBaseY = 0;
        this.canvasContainer = document.getElementById('canvas-container');
    }
    getDefaultTransform() {
        return {
            x: 0,
            y: 0,
            scale: 1,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
        };
    }
    setupInitialLayers() {
        const width = 344, height = 135;
        const initialCanvas = document.createElement('canvas');
        initialCanvas.width = width;
        initialCanvas.height = height;
        initialCanvas.className = 'main-canvas';
        this.canvasContainer.appendChild(initialCanvas);
        const ctx = initialCanvas.getContext('2d');
        ctx.fillStyle = '#f0e0d6';
        ctx.fillRect(0, 0, width, height);
        const baseLayer = {
            canvas: initialCanvas,
            ctx,
            transform: this.getDefaultTransform()
        };
        this.layers.push(baseLayer);
        this.switchLayer(0);
    }
    addLayer() {
        if (this.layers.length === 0) return null;
        const baseCanvas = this.layers[0].canvas;
        const newCanvas = document.createElement('canvas');
        newCanvas.width = baseCanvas.width;
        newCanvas.height = baseCanvas.height;
        newCanvas.className = 'main-canvas';
        this.canvasContainer.appendChild(newCanvas);
        const newLayer = {
            canvas: newCanvas,
            ctx: newCanvas.getContext('2d'),
            transform: this.getDefaultTransform(),
        };
        this.layers.push(newLayer);
        this.switchLayer(this.layers.length - 1);
        return newLayer;
    }
    switchLayer(index) {
        if (index < 0 || index >= this.layers.length) return;
        this.activeLayerIndex = index;
        const infoEl = document.getElementById('current-layer-info');
        if (infoEl) {
            infoEl.textContent = `L: ${this.activeLayerIndex + 1}/${this.layers.length}`;
        }
    }
    getCurrentLayer() {
        if (this.activeLayerIndex >= 0 && this.activeLayerIndex < this.layers.length) {
            return this.layers[this.activeLayerIndex];
        }
        return null;
    }
    moveStart(e, x, y) {
        this.isMovingLayer = true;
        this.moveStartX = e.clientX;
        this.moveStartY = e.clientY;
        const layer = this.getCurrentLayer();
        this.moveBaseX = layer.transform.x;
        this.moveBaseY = layer.transform.y;
    }
    moveDrag(e, x, y) {
        if (!this.isMovingLayer) return;
        const dx = e.clientX - this.moveStartX;
        const dy = e.clientY - this.moveStartY;
        const layer = this.getCurrentLayer();
        layer.transform.x = this.moveBaseX + dx;
        layer.transform.y = this.moveBaseY + dy;
    }
    moveEnd(e) {
        this.isMovingLayer = false;
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
            layer.transform.rotation += degrees * Math.PI / 180;
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