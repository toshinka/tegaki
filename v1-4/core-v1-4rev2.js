class CanvasManager {
    constructor(app) {
        this.app = app;
        this.compositeCanvas = document.createElement('canvas');
        this.compositeCanvas.width = 344;
        this.compositeCanvas.height = 135;
        this.compositeCanvas.className = 'main-canvas';
        this.compositeCtx = this.compositeCanvas.getContext('2d');
        this.frameCanvas = document.createElement('canvas');
        this.frameCanvas.width = 364;
        this.frameCanvas.height = 145;
        this.frameCanvas.style.position = 'absolute';
        this.frameCanvas.style.left = '-10px';
        this.frameCanvas.style.top = '-5px';
        this.frameCanvas.style.zIndex = '-1';
        this.frameCanvas.style.pointerEvents = 'none';
        this.viewTransform = {
            x: 0,
            y: 0,
            scale: 1,
            rotation: 0
        };
        this.currentTool = 'pen';
        this.currentColor = '#800000';
        this.currentSize = 1;
        this.isDrawing = false;
        this.isSpaceDown = false;
        this.lastX = 0;
        this.lastY = 0;
        this.history = [];
        this.historyIndex = -1;
        this.initDOM();
        this.createAndDrawFrame();
        this.bindEvents();
    }
    initDOM() {
        const area = document.getElementById('canvas-area');
        const container = document.getElementById('canvas-container');
        container.innerHTML = '';
        container.appendChild(this.frameCanvas);
        container.appendChild(this.compositeCanvas);
        this.canvasArea = area;
        this.canvasContainer = container;
    }
    createAndDrawFrame() {
        const ctx = this.frameCanvas.getContext('2d');
        ctx.clearRect(0, 0, this.frameCanvas.width, this.frameCanvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#cccccc';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(0.5, 0.5, this.frameCanvas.width - 1, this.frameCanvas.height - 1, 8);
        ctx.fill();
        ctx.stroke();
    }
    bindEvents() {
        this.compositeCanvas.addEventListener('pointerdown', this.onPointerDown.bind(this));
        document.addEventListener('pointermove', this.onPointerMove.bind(this));
        document.addEventListener('pointerup', this.onPointerUp.bind(this));
        this.canvasArea.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
    }
    setCurrentTool(tool) {
        this.currentTool = tool;
        this.updateCursor();
    }
    setCurrentColor(color) {
        this.currentColor = color;
    }
    setCurrentSize(size) {
        this.currentSize = size;
    }
    setActiveLayer(layerObj) {
        this.activeLayer = layerObj;
        this.updateCursor();
    }
    updateCursor() {
        if (!this.compositeCanvas) return;
        if (this.isSpaceDown) {
            this.canvasArea.style.cursor = 'grab';
            this.compositeCanvas.style.cursor = 'grab';
            return;
        }
        this.canvasArea.style.cursor = 'default';
        switch (this.currentTool) {
            case 'move': this.compositeCanvas.style.cursor = 'move'; break;
            case 'pen':
            case 'eraser':
            case 'bucket':
            default: this.compositeCanvas.style.cursor = 'crosshair'; break;
        }
    }
    getCanvasCoordinates(e) {
        // 逆変換(view→layer→canvas)でcanvas座標を取得
        const rect = this.compositeCanvas.getBoundingClientRect();
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;

        // viewTransform逆変換
        const vt = this.viewTransform;
        const cx = this.compositeCanvas.width / 2;
        const cy = this.compositeCanvas.height / 2;
        x -= cx; y -= cy;
        let r = -vt.rotation * Math.PI / 180;
        let cos = Math.cos(r), sin = Math.sin(r);
        let tx = (x * cos - y * sin) / vt.scale - vt.x;
        let ty = (x * sin + y * cos) / vt.scale - vt.y;
        tx += cx; ty += cy;

        // layer.transform逆変換
        if (this.activeLayer) {
            const t = this.activeLayer.transform;
            let lx = tx - cx, ly = ty - cy;
            let r2 = -t.rotation * Math.PI / 180;
            let c2 = Math.cos(r2), s2 = Math.sin(r2);
            let fx = (lx * c2 - ly * s2) / (t.scale * t.scaleX) - t.x;
            let fy = (lx * s2 + ly * c2) / (t.scale * t.scaleY) - t.y;
            tx = fx + cx; ty = fy + cy;
        }
        return { x: tx, y: ty };
    }
    onPointerDown(e) {
        if (!this.activeLayer) return;
        if (this.isSpaceDown) { this.spaceDragStart = { x: e.clientX, y: e.clientY }; this.spaceViewStart = { ...this.viewTransform }; this.isPanning = true; e.preventDefault(); return; }
        if (this.currentTool === 'move') {
            this.moveLayerStart = { x: e.clientX, y: e.clientY };
            this.moveLayerOrig = { x: this.activeLayer.transform.x, y: this.activeLayer.transform.y };
            this.isMovingLayer = true;
        } else if (this.currentTool === 'bucket') {
            const coords = this.getCanvasCoordinates(e);
            this.fill(Math.floor(coords.x), Math.floor(coords.y), this.currentColor);
            this.saveState();
        } else if (this.currentTool === 'pen' || this.currentTool === 'eraser') {
            const coords = this.getCanvasCoordinates(e);
            this.lastX = coords.x;
            this.lastY = coords.y;
            this.isDrawing = true;
            const ctx = this.activeLayer.ctx;
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(this.lastX, this.lastY);
            ctx.restore();
        }
    }
    onPointerMove(e) {
        if (!e.buttons) { this.isDrawing = false; this.isMovingLayer = false; this.isPanning = false; return; }
        if (this.isPanning) {
            const dx = e.clientX - this.spaceDragStart.x;
            const dy = e.clientY - this.spaceDragStart.y;
            this.viewTransform.x = this.spaceViewStart.x + dx;
            this.viewTransform.y = this.spaceViewStart.y + dy;
        } else if (this.isMovingLayer) {
            const dx = e.clientX - this.moveLayerStart.x;
            const dy = e.clientY - this.moveLayerStart.y;
            this.activeLayer.transform.x = this.moveLayerOrig.x + dx;
            this.activeLayer.transform.y = this.moveLayerOrig.y + dy;
        } else if (this.isDrawing) {
            const coords = this.getCanvasCoordinates(e);
            const ctx = this.activeLayer.ctx;
            ctx.save();
            ctx.globalCompositeOperation = this.currentTool === 'eraser' ? 'destination-out' : 'source-over';
            ctx.strokeStyle = this.currentColor;
            ctx.lineWidth = this.currentSize;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.lineTo(coords.x, coords.y);
            ctx.stroke();
            ctx.moveTo(coords.x, coords.y);
            ctx.restore();
            this.lastX = coords.x;
            this.lastY = coords.y;
        }
    }
    onPointerUp(e) {
        this.isDrawing = false;
        this.isMovingLayer = false;
        this.isPanning = false;
        if (this.activeLayer && (this.currentTool === 'pen' || this.currentTool === 'eraser')) {
            this.activeLayer.ctx.closePath();
            this.saveState();
        }
    }
    saveState() {
        if (!this.activeLayer) return;
        if (!this.activeLayer.history) this.activeLayer.history = [];
        if (!this.activeLayer.historyIndex) this.activeLayer.historyIndex = -1;
        const ctx = this.activeLayer.ctx;
        if (this.activeLayer.historyIndex < this.activeLayer.history.length - 1) {
            this.activeLayer.history = this.activeLayer.history.slice(0, this.activeLayer.historyIndex + 1);
        }
        this.activeLayer.history.push(ctx.getImageData(0, 0, this.activeLayer.canvas.width, this.activeLayer.canvas.height));
        this.activeLayer.historyIndex++;
    }
    undo() {
        if (!this.activeLayer) return;
        if ((this.activeLayer.historyIndex ?? -1) > 0) {
            this.activeLayer.historyIndex--;
            this.activeLayer.ctx.putImageData(this.activeLayer.history[this.activeLayer.historyIndex], 0, 0);
        }
    }
    redo() {
        if (!this.activeLayer) return;
        if ((this.activeLayer.historyIndex ?? -1) < (this.activeLayer.history?.length ?? 0) - 1) {
            this.activeLayer.historyIndex++;
            this.activeLayer.ctx.putImageData(this.activeLayer.history[this.activeLayer.historyIndex], 0, 0);
        }
    }
    clearCanvas() {
        if (!this.activeLayer) return;
        this.activeLayer.ctx.clearRect(0, 0, this.activeLayer.canvas.width, this.activeLayer.canvas.height);
        this.saveState();
    }
    clearAllLayers() {
        if (!this.app.layerManager.layers) return;
        this.app.layerManager.layers.forEach((layer, idx) => {
            layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
            if (idx === 0) {
                layer.ctx.fillStyle = '#f0e0d6';
                layer.ctx.fillRect(0, 0, layer.canvas.width, layer.canvas.height);
            }
        });
        this.saveState();
    }
    flipHorizontal() {
        if (this.activeLayer) {
            this.activeLayer.transform.scaleX *= -1;
        }
    }
    flipVertical() {
        if (this.activeLayer) {
            this.activeLayer.transform.scaleY *= -1;
        }
    }
    zoom(factor) {
        this.viewTransform.scale = Math.max(0.1, Math.min(this.viewTransform.scale * factor, 10));
    }
    rotate(deg) {
        this.viewTransform.rotation = (this.viewTransform.rotation + deg) % 360;
    }
    resetViewAndLayer() {
        this.viewTransform = { x: 0, y: 0, scale: 1, rotation: 0 };
        this.app.layerManager.layers.forEach(l => {
            l.transform = this.app.layerManager.getDefaultTransform();
        });
    }
    drawComposite() {
        const ctx = this.compositeCtx;
        ctx.clearRect(0, 0, this.compositeCanvas.width, this.compositeCanvas.height);
        ctx.save();
        const vt = this.viewTransform;
        const cx = this.compositeCanvas.width / 2;
        const cy = this.compositeCanvas.height / 2;
        ctx.translate(cx + vt.x, cy + vt.y);
        ctx.rotate(vt.rotation * Math.PI / 180);
        ctx.scale(vt.scale, vt.scale);

        for (const layer of this.app.layerManager.layers) {
            ctx.save();
            const t = layer.transform;
            ctx.translate(t.x, t.y);
            ctx.rotate(t.rotation * Math.PI / 180);
            ctx.scale((t.scale ?? 1) * (t.scaleX ?? 1), (t.scale ?? 1) * (t.scaleY ?? 1));
            ctx.drawImage(layer.canvas, -cx, -cy);
            ctx.restore();
        }
        ctx.restore();
    }
    drawFrame() {
        const ctx = this.frameCanvas.getContext('2d');
        ctx.clearRect(0, 0, this.frameCanvas.width, this.frameCanvas.height);
        ctx.save();
        const vt = this.viewTransform;
        const cx = this.compositeCanvas.width / 2;
        const cy = this.compositeCanvas.height / 2;
        ctx.translate(cx + vt.x, cy + vt.y);
        ctx.rotate(vt.rotation * Math.PI / 180);
        ctx.scale(vt.scale, vt.scale);
        ctx.translate(-this.frameCanvas.width / 2, -this.frameCanvas.height / 2);
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#cccccc';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(0.5, 0.5, this.frameCanvas.width - 1, this.frameCanvas.height - 1, 8);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
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
        if (!this.activeLayer) return;
        const canvasWidth = this.activeLayer.canvas.width;
        const canvasHeight = this.activeLayer.canvas.height;
        const ctx = this.activeLayer.ctx;
        const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
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
        ctx.putImageData(imageData, 0, 0);
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
        const initial = document.createElement('canvas');
        initial.width = 344;
        initial.height = 135;
        initial.className = 'main-canvas';
        const ctx = initial.getContext('2d');
        ctx.fillStyle = '#f0e0d6';
        ctx.fillRect(0, 0, initial.width, initial.height);
        const layer = {
            canvas: initial,
            ctx: ctx,
            transform: this.getDefaultTransform()
        };
        this.layers.push(layer);
        this.switchLayer(0);
        this.updateAllLayerZIndexes();
    }
    addLayer() {
        if (this.layers.length === 0) return null;
        const base = this.layers[0].canvas;
        const newC = document.createElement('canvas');
        newC.width = base.width; newC.height = base.height;
        newC.className = 'main-canvas';
        const newL = {
            canvas: newC,
            ctx: newC.getContext('2d'),
            transform: this.getDefaultTransform()
        };
        this.layers.push(newL);
        this.updateAllLayerZIndexes();
        this.switchLayer(this.layers.length - 1);
        return newL;
    }
    switchLayer(index) {
        if (index < 0 || index >= this.layers.length) return;
        this.activeLayerIndex = index;
        const activeLayer = this.getCurrentLayer();
        if (activeLayer) {
            this.app.canvasManager.setActiveLayer(activeLayer);
            const infoEl = document.getElementById('current-layer-info');
            if (infoEl) infoEl.textContent = `L: ${this.activeLayerIndex + 1}/${this.layers.length}`;
        }
    }
    getCurrentLayer() {
        if (this.activeLayerIndex >= 0 && this.activeLayerIndex < this.layers.length) {
            return this.layers[this.activeLayerIndex];
        }
        return null;
    }
    updateAllLayerZIndexes() {}
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