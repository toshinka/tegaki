class CanvasManager {
    constructor(app) {
        this.app = app;
        this.canvasArea = document.getElementById('canvas-area');
        this.compositeCanvas = null;
        this.compositeCtx = null;
        this.frameCanvas = null;
        this.activeCanvas = null;
        this.activeCtx = null;
        this.isDrawing = false;
        this.isPanning = false;
        this.isMovingLayer = false;
        this.isSpaceDown = false;
        this.isRotatingWithSpace = false;
        this.rotateStartAngle = 0;
        this.initialRotation = 0;
        this.lastX = 0;
        this.lastY = 0;
        this.history = [];
        this.historyIndex = -1;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.viewTransform = { x: 0, y: 0, scale: 1, rotation: 0, scaleX: 1, scaleY: 1 };
        this.panStart = { x: 0, y: 0 };
        this.moveLayerStartX = 0;
        this.moveLayerStartY = 0;
    }
    initCanvases() {
        const baseWidth = 344;
        const baseHeight = 135;
        this.compositeCanvas = document.createElement('canvas');
        this.compositeCanvas.width = baseWidth;
        this.compositeCanvas.height = baseHeight;
        this.compositeCanvas.style.backgroundColor = '#ffffee';
        this.compositeCanvas.style.cursor = 'crosshair';
        this.compositeCtx = this.compositeCanvas.getContext('2d');
        this.canvasArea.appendChild(this.compositeCanvas);
        this.frameCanvas = document.createElement('canvas');
        this.frameCanvas.width = baseWidth + 20;
        this.frameCanvas.height = baseHeight + 10;
        this.frameCanvas.style.position = 'absolute';
        this.frameCanvas.style.top = '50%';
        this.frameCanvas.style.left = '50%';
        this.frameCanvas.style.transform = 'translate(-50%, -50%)';
        this.frameCanvas.style.pointerEvents = 'none';
        this.frameCanvas.style.zIndex = '1';
        this.canvasArea.insertBefore(this.frameCanvas, this.compositeCanvas);
        this.compositeCanvas.style.position = 'absolute';
        this.compositeCanvas.style.top = '50%';
        this.compositeCanvas.style.left = '50%';
        this.compositeCanvas.style.transform = 'translate(-50%, -50%)';
        this.bindEvents();
    }
    bindEvents() {
        this.canvasArea.addEventListener('pointerdown', this.onPointerDown.bind(this));
        document.addEventListener('pointermove', this.onPointerMove.bind(this));
        document.addEventListener('pointerup', this.onPointerUp.bind(this));
        this.canvasArea.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
    }
    drawComposite() {
        if (!this.compositeCtx || !this.app.layerManager.layers) return;
        this.compositeCtx.save();
        this.compositeCtx.fillStyle = getComputedStyle(document.body).backgroundColor;
        this.compositeCtx.fillRect(0, 0, this.compositeCanvas.width, this.compositeCanvas.height);
        this.compositeCtx.translate(this.compositeCanvas.width / 2, this.compositeCanvas.height / 2);
        this.compositeCtx.translate(this.viewTransform.x, this.viewTransform.y);
        this.compositeCtx.rotate(this.viewTransform.rotation * Math.PI / 180);
        this.compositeCtx.scale(this.viewTransform.scale, this.viewTransform.scale);
        this.compositeCtx.scale(this.viewTransform.scaleX, this.viewTransform.scaleY);
        this.app.layerManager.layers.forEach(layer => {
            if (!layer.canvas) return;
            this.compositeCtx.save();
            const t = layer.transform;
            this.compositeCtx.translate(t.x, t.y);
            this.compositeCtx.rotate(t.rotation * Math.PI / 180);
            this.compositeCtx.scale(t.scale * t.scaleX, t.scale * t.scaleY);
            this.compositeCtx.drawImage(layer.canvas, -layer.canvas.width / 2, -layer.canvas.height / 2);
            this.compositeCtx.restore();
        });
        this.compositeCtx.restore();
        this.drawFrame();
    }
    drawFrame() {
        const frameCtx = this.frameCanvas.getContext('2d');
        const w = this.frameCanvas.width;
        const h = this.frameCanvas.height;
        frameCtx.clearRect(0, 0, w, h);
        frameCtx.save();
        frameCtx.translate(w / 2, h / 2);
        const vt = this.viewTransform;
        frameCtx.translate(vt.x, vt.y);
        frameCtx.rotate(vt.rotation * Math.PI / 180);
        frameCtx.scale(vt.scale, vt.scale);
        frameCtx.fillStyle = '#ffffff';
        frameCtx.strokeStyle = '#cccccc';
        frameCtx.lineWidth = 1;
        frameCtx.beginPath();
        frameCtx.roundRect(-(this.compositeCanvas.width / 2) - 0.5, -(this.compositeCanvas.height / 2) - 0.5, this.compositeCanvas.width + 1, this.compositeCanvas.height + 1, 8);
        frameCtx.fill();
        frameCtx.stroke();
        frameCtx.restore();
    }
    setActiveLayerContext(canvas, ctx) {
        this.activeCanvas = canvas;
        this.activeCtx = ctx;
        this.updateCursor();
    }
    onPointerDown(e) {
        if (e.target !== this.compositeCanvas && !this.isSpaceDown) return;
        if (this.isSpaceDown) {
            const rect = this.compositeCanvas.getBoundingClientRect();
            const isInside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
            if (isInside) {
                this.isPanning = true;
                this.panStart.x = this.viewTransform.x;
                this.panStart.y = this.viewTransform.y;
                this.dragStartX = e.clientX;
                this.dragStartY = e.clientY;
            } else {
                this.isRotatingWithSpace = true;
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                this.rotateStartAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180 / Math.PI;
                this.initialRotation = this.viewTransform.rotation;
            }
            e.preventDefault();
            return;
        }
        const coords = this.getCanvasCoordinates(e);
        this.lastX = coords.x;
        this.lastY = coords.y;
        const currentTool = this.app.toolManager.getCurrentTool();
        if (currentTool === 'move') {
            this.isMovingLayer = true;
            this.moveLayerStartX = e.clientX;
            this.moveLayerStartY = e.clientY;
            this.app.layerManager.startMove();
        } else if (currentTool === 'bucket') {
            this.fill(Math.floor(this.lastX), Math.floor(this.lastY), this.app.colorManager.mainColor);
            this.saveState();
            this.drawComposite();
        } else {
            this.isDrawing = true;
            this.activeCtx.beginPath();
            this.activeCtx.moveTo(this.lastX, this.lastY);
        }
        try { document.documentElement.setPointerCapture(e.pointerId); } catch (err) {}
    }
    onPointerMove(e) {
        if (!e.buttons) return;
        if (this.isRotatingWithSpace) {
            const rect = this.compositeCanvas.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const currentAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180 / Math.PI;
            this.viewTransform.rotation = this.initialRotation + (currentAngle - this.rotateStartAngle);
            this.drawComposite();
        } else if (this.isPanning) {
            this.viewTransform.x = this.panStart.x + (e.clientX - this.dragStartX);
            this.viewTransform.y = this.panStart.y + (e.clientY - this.dragStartY);
            this.drawComposite();
        } else if (this.isMovingLayer) {
            const dx = (e.clientX - this.moveLayerStartX) / this.viewTransform.scale;
            const dy = (e.clientY - this.moveLayerStartY) / this.viewTransform.scale;
            this.app.layerManager.moveActiveLayer(dx, dy);
            this.moveLayerStartX = e.clientX;
            this.moveLayerStartY = e.clientY;
        } else if (this.isDrawing) {
            const coords = this.getCanvasCoordinates(e);
            const currentX = coords.x;
            const currentY = coords.y;
            const tool = this.app.toolManager.getCurrentTool();
            this.activeCtx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
            this.activeCtx.strokeStyle = this.app.colorManager.mainColor;
            this.activeCtx.lineWidth = this.app.penSettingsManager.currentSize;
            this.activeCtx.lineTo(currentX, currentY);
            this.activeCtx.stroke();
            this.lastX = currentX;
            this.lastY = currentY;
            this.drawComposite();
        }
    }
    onPointerUp(e) {
        try { if (document.documentElement.hasPointerCapture(e.pointerId)) { document.documentElement.releasePointerCapture(e.pointerId); } } catch (err) {}
        if (this.isDrawing) {
            this.isDrawing = false;
            this.activeCtx.closePath();
            this.saveState();
        }
        if (this.isPanning) this.isPanning = false;
        if (this.isRotatingWithSpace) this.isRotatingWithSpace = false;
        if (this.isMovingLayer) {
            this.isMovingLayer = false;
            this.app.layerManager.endMove();
        }
    }
    getCanvasCoordinates(e) {
        const layer = this.app.layerManager.getCurrentLayer();
        if (!layer) return { x: 0, y: 0 };
        const t = layer.transform;
        const rect = this.compositeCanvas.getBoundingClientRect();
        let mouseX = e.clientX - rect.left - this.compositeCanvas.width / 2;
        let mouseY = e.clientY - rect.top - this.compositeCanvas.height / 2;
        mouseX -= this.viewTransform.x;
        mouseY -= this.viewTransform.y;
        mouseX /= this.viewTransform.scale;
        mouseY /= this.viewTransform.scale;
        const viewRad = -this.viewTransform.rotation * Math.PI / 180;
        let worldX = mouseX * Math.cos(viewRad) - mouseY * Math.sin(viewRad);
        let worldY = mouseX * Math.sin(viewRad) + mouseY * Math.cos(viewRad);
        worldX /= this.viewTransform.scaleX;
        worldY /= this.viewTransform.scaleY;
        worldX -= t.x;
        worldY -= t.y;
        worldX /= (t.scale * t.scaleX);
        worldY /= (t.scale * t.scaleY);
        const layerRad = -t.rotation * Math.PI / 180;
        let localX = worldX * Math.cos(layerRad) - worldY * Math.sin(layerRad);
        let localY = worldX * Math.sin(layerRad) + worldY * Math.cos(layerRad);
        return { x: localX + layer.canvas.width / 2, y: localY + layer.canvas.height / 2 };
    }
    updateCursor() {
        if (!this.compositeCanvas) return;
        if (this.isSpaceDown) {
            this.canvasArea.style.cursor = 'grab';
            this.compositeCanvas.style.cursor = 'grab';
        } else {
            this.canvasArea.style.cursor = 'default';
            const tool = this.app.toolManager.getCurrentTool();
            switch (tool) {
                case 'move': this.compositeCanvas.style.cursor = 'move'; break;
                default: this.compositeCanvas.style.cursor = 'crosshair'; break;
            }
        }
    }
    saveState() {
        if (!this.activeCtx) return;
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        this.history.push(this.activeCtx.getImageData(0, 0, this.activeCanvas.width, this.activeCanvas.height));
        this.historyIndex++;
    }
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.activeCtx.putImageData(this.history[this.historyIndex], 0, 0);
            this.drawComposite();
        }
    }
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.activeCtx.putImageData(this.history[this.historyIndex], 0, 0);
            this.drawComposite();
        }
    }
    clearCanvas() {
        this.activeCtx.clearRect(0, 0, this.activeCanvas.width, this.activeCanvas.height);
        this.saveState();
        this.drawComposite();
    }
    clearAllLayers() {
        this.app.layerManager.layers.forEach((layer, index) => {
            layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
            if (index === 0) {
                layer.ctx.fillStyle = '#f0e0d6';
                layer.ctx.fillRect(0, 0, layer.canvas.width, layer.canvas.height);
            }
        });
        this.saveState();
        this.drawComposite();
    }
    flipViewHorizontal() { this.viewTransform.scaleX *= -1; this.drawComposite(); }
    flipViewVertical() { this.viewTransform.scaleY *= -1; this.drawComposite(); }
    zoomView(factor) { this.viewTransform.scale = Math.max(0.1, Math.min(this.viewTransform.scale * factor, 10)); this.drawComposite(); }
    rotateView(degrees) { this.viewTransform.rotation = (this.viewTransform.rotation + degrees) % 360; this.drawComposite(); }
    resetView() {
        this.viewTransform = { x: 0, y: 0, scale: 1, rotation: 0, scaleX: 1, scaleY: 1 };
        this.drawComposite();
    }
    handleWheel(e) {
        if (this.app.toolManager.getCurrentTool() === 'move') {
            if (this.app.shortcutManager.handleWheel(e)) {
                e.preventDefault(); return;
            }
        }
        e.preventDefault();
        const delta = e.deltaY > 0 ? -1 : 1;
        if (e.shiftKey) { this.rotateView(delta * 15); } else { this.zoomView(delta > 0 ? 1.1 : 1 / 1.1); }
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
    getPixelColor(imageData, x, y) {
        const i = (y * imageData.width + x) * 4;
        return [imageData.data[i], imageData.data[i+1], imageData.data[i+2], imageData.data[i+3]];
    }
    setPixelColor(imageData, x, y, color) {
        const i = (y * imageData.width + x) * 4;
        imageData.data.set(color, i);
    }
    fill(startX, startY, fillColor) {
        const ctx = this.activeCtx;
        const canvasWidth = this.activeCanvas.width;
        const canvasHeight = this.activeCanvas.height;
        const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
        const startColor = this.getPixelColor(imageData, startX, startY);
        const fillColorArr = this.hexToRgba(fillColor);
        if (this.colorsMatch(startColor, fillColorArr)) return;
        const queue = [[startX, startY]];
        while (queue.length > 0) {
            const [x, y] = queue.pop();
            if (x < 0 || x >= canvasWidth || y < 0 || y >= canvasHeight) continue;
            if (this.colorsMatch(this.getPixelColor(imageData, x, y), startColor)) {
                this.setPixelColor(imageData, x, y, fillColorArr);
                queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
            }
        }
        ctx.putImageData(imageData, 0, 0);
    }
}
class LayerManager {
    constructor(app) {
        this.app = app;
        this.layers = [];
        this.activeLayerIndex = -1;
        this.layerMoveStartTransform = null;
    }
    getDefaultTransform() { return { x: 0, y: 0, scale: 1, rotation: 0, scaleX: 1, scaleY: 1 }; }
    setupInitialLayers() {
        const newLayer = this.createLayer();
        this.layers.push(newLayer);
        const firstLayerCtx = newLayer.ctx;
        firstLayerCtx.fillStyle = '#f0e0d6';
        firstLayerCtx.fillRect(0, 0, newLayer.canvas.width, newLayer.canvas.height);
        this.switchLayer(0);
    }
    createLayer() {
        const canvas = document.createElement('canvas');
        canvas.width = 344;
        canvas.height = 135;
        const ctx = canvas.getContext('2d');
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        return { canvas, ctx, transform: this.getDefaultTransform() };
    }
    addLayer() {
        const newLayer = this.createLayer();
        this.layers.push(newLayer);
        this.switchLayer(this.layers.length - 1);
        this.app.canvasManager.saveState();
        this.app.canvasManager.drawComposite();
        return newLayer;
    }
    switchLayer(index) {
        if (index < 0 || index >= this.layers.length) return;
        this.activeLayerIndex = index;
        const activeLayer = this.getCurrentLayer();
        if (activeLayer) {
            this.app.canvasManager.setActiveLayerContext(activeLayer.canvas, activeLayer.ctx);
            const infoEl = document.getElementById('current-layer-info');
            if (infoEl) {
                infoEl.textContent = `L: ${this.activeLayerIndex + 1}/${this.layers.length}`;
            }
        }
    }
    getCurrentLayer() { return this.layers[this.activeLayerIndex] || null; }
    startMove() {
        const layer = this.getCurrentLayer();
        if (layer) this.layerMoveStartTransform = { ...layer.transform };
    }
    endMove() {
        this.layerMoveStartTransform = null;
    }
    moveActiveLayer(dx, dy) {
        const layer = this.getCurrentLayer();
        if (layer && this.layerMoveStartTransform) {
            layer.transform.x = this.layerMoveStartTransform.x + dx;
            layer.transform.y = this.layerMoveStartTransform.y + dy;
            this.app.canvasManager.drawComposite();
        }
    }
    scaleActiveLayer(factor) {
        const layer = this.getCurrentLayer();
        if (layer) { layer.transform.scale *= factor; this.app.canvasManager.drawComposite(); }
    }
    rotateActiveLayer(degrees) {
        const layer = this.getCurrentLayer();
        if (layer) { layer.transform.rotation = (layer.transform.rotation + degrees) % 360; this.app.canvasManager.drawComposite(); }
    }
    flipActiveLayerHorizontal() {
        const layer = this.getCurrentLayer();
        if (layer) { layer.transform.scaleX *= -1; this.app.canvasManager.drawComposite(); }
    }
    flipActiveLayerVertical() {
        const layer = this.getCurrentLayer();
        if (layer) { layer.transform.scaleY *= -1; this.app.canvasManager.drawComposite(); }
    }
}
class ToolManager {
    constructor(app) {
        this.app = app;
        this.currentTool = 'pen';
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
    getCurrentTool() { return this.currentTool; }
}
class PenSettingsManager {
    constructor(app) {
        this.app = app;
        this.currentSize = 1;
        this.sizes = Array.from(document.querySelectorAll('.size-btn')).map(btn => parseInt(btn.dataset.size));
        this.currentSizeIndex = this.sizes.indexOf(this.currentSize);
    }
    bindEvents() {
        document.querySelectorAll('.size-btn').forEach(btn => {
            btn.addEventListener('click', () => this.setSize(parseInt(btn.dataset.size)));
        });
        this.updateSizeButtonVisuals();
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
            if (sizeDot) {
                const dotSize = Math.min(size, 16);
                sizeDot.style.width = `${dotSize}px`;
                sizeDot.style.height = `${dotSize}px`;
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
    }
    bindEvents() {
        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.setColor(e.currentTarget.dataset.color));
        });
        document.querySelector('.color-mode-display').addEventListener('click', () => this.swapColors());
        this.updateColorDisplays();
        document.querySelector(`[data-color="${this.mainColor}"]`)?.classList.add('active');
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
        this.setColor(this.mainColor);
    }
    resetColors() {
        this.setColor('#800000');
        this.subColor = '#f0e0d6';
        this.updateColorDisplays();
    }
    changeColor(increase) {
        let newIndex = this.currentColorIndex + (increase ? 1 : -1);
        newIndex = (newIndex + this.colors.length) % this.colors.length;
        this.setColor(this.colors[newIndex]);
    }
}