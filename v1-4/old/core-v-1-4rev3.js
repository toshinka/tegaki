// core-v1-4rev3.js
// ToshinkaTegakiTool レイヤー変換・座標修正・アンドゥ拡張対応

class CanvasManager {
    constructor(app) {
        this.app = app;
        this.canvas = null;
        this.ctx = null;
        this.canvasArea = document.getElementById('canvas-area');
        this.canvasContainer = document.getElementById('canvas-container');
        this.frameCanvas = null;
        this.isDrawing = false;
        this.isPanning = false;
        this.isMovingLayer = false;
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
        this.canvasStartX = 0;
        this.canvasStartY = 0;
        this.moveLayerStartX = 0;
        this.moveLayerStartY = 0;
        this.scale = 1;
        this.rotation = 0;
        this.transformState = { scaleX: 1, scaleY: 1 };
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
        const firstLayer = this.canvasContainer.querySelector('.main-canvas');
        this.canvasContainer.insertBefore(this.frameCanvas, firstLayer);
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
        this.canvas = canvas;
        this.ctx = ctx;
        this.updateCursor();
    }

    getCanvasCoordinates(e) {
        const containerRect = this.canvasContainer.getBoundingClientRect();
        const layer = this.app.layerManager.getCurrentLayer();
        if (!layer) return { x: 0, y: 0 };

        const transform = layer.transform;
        const centerX = containerRect.left + containerRect.width / 2;
        const centerY = containerRect.top + containerRect.height / 2;
        let mouseX = e.clientX - centerX - transform.x;
        let mouseY = e.clientY - centerY - transform.y;

        const totalRotation = -this.rotation - transform.rotation;
        const rad = totalRotation * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        let unrotatedX = mouseX * cos - mouseY * sin;
        let unrotatedY = mouseX * sin + mouseY * cos;

        const scaleX = this.scale * this.transformState.scaleX * transform.scale * transform.scaleX;
        const scaleY = this.scale * this.transformState.scaleY * transform.scale * transform.scaleY;

        const canvasX = unrotatedX / scaleX + this.canvas.width / 2;
        const canvasY = unrotatedY / scaleY + this.canvas.height / 2;

        return { x: canvasX, y: canvasY };
    }

    updateCursor() {
        if (!this.canvas) return;
        if (this.isSpaceDown) {
            this.canvasArea.style.cursor = 'grab';
            this.canvas.style.cursor = 'grab';
            return;
        } else {
            this.canvasArea.style.cursor = 'default';
        }
        switch (this.currentTool) {
            case 'move': this.canvas.style.cursor = 'move'; break;
            case 'pen':
            case 'eraser':
            case 'bucket':
            default: this.canvas.style.cursor = 'crosshair'; break;
        }
    }

    saveState() {
        if (!this.ctx) return;
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        const layerStates = this.app.layerManager.layers.map(layer => ({
            imageData: layer.ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height),
            transform: { ...layer.transform }
        }));
        this.history.push(layerStates);
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

    restoreState(layerStates) {
        const layers = this.app.layerManager.layers;
        for (let i = 0; i < layerStates.length && i < layers.length; i++) {
            const state = layerStates[i];
            const layer = layers[i];
            layer.ctx.putImageData(state.imageData, 0, 0);
            layer.transform = { ...state.transform };
            this.app.layerManager.updateLayerTransform(layer);
        }
    }

// 次メッセージで後半に続く


// （後半）core-v1-4rev3.js 続き

    onPointerDown(e) {
        if (this.isSpaceDown) {
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
            const rect = this.canvasContainer.getBoundingClientRect();
            const isInside = e.clientX >= rect.left && e.clientX <= rect.right &&
                e.clientY >= rect.top && e.clientY <= rect.bottom;
            if (isInside) {
                this.isPanning = true;
                this.isRotatingWithSpace = false;
                this.setAbsolutePosition();
            } else {
                this.isPanning = false;
                this.isRotatingWithSpace = true;
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                this.rotateStartAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
                this.initialRotation = this.rotation;
            }
            e.preventDefault();
        } else {
            if (!this.canvas || e.target !== this.canvas) return;
            const coords = this.getCanvasCoordinates(e);
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
                this.ctx.beginPath();
                this.ctx.moveTo(this.lastX, this.lastY);
            }
        }
        try {
            document.documentElement.setPointerCapture(e.pointerId);
        } catch (err) { }
    }

    onPointerMove(e) {
        if (!e.buttons) return;
        if (this.isRotatingWithSpace) {
            const rect = this.canvasContainer.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const currentAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
            const deltaAngle = (currentAngle - this.rotateStartAngle) * 180 / Math.PI;
            this.rotation = this.initialRotation + deltaAngle;
            this.updateCanvasTransform();
        } else if (this.isPanning) {
            const deltaX = e.clientX - this.dragStartX;
            const deltaY = e.clientY - this.dragStartY;
            this.canvasContainer.style.left = (this.canvasStartX + deltaX) + 'px';
            this.canvasContainer.style.top = (this.canvasStartY + deltaY) + 'px';
        } else if (this.isMovingLayer) {
            const dx = e.clientX - this.moveLayerStartX;
            const dy = e.clientY - this.moveLayerStartY;
            this.app.layerManager.moveActiveLayer(dx, dy);
            this.moveLayerStartX = e.clientX;
            this.moveLayerStartY = e.clientY;
        } else if (this.isDrawing) {
            const coords = this.getCanvasCoordinates(e);
            const currentX = coords.x;
            const currentY = coords.y;
            this.ctx.globalCompositeOperation = this.currentTool === 'eraser' ? 'destination-out' : 'source-over';
            this.ctx.strokeStyle = this.currentColor;
            this.ctx.lineWidth = this.currentSize;
            this.ctx.lineTo(currentX, currentY);
            this.ctx.stroke();
            this.lastX = currentX;
            this.lastY = currentY;
        }
    }

    onPointerUp(e) {
        try {
            if (document.documentElement.hasPointerCapture(e.pointerId)) {
                document.documentElement.releasePointerCapture(e.pointerId);
            }
        } catch (err) { }
        if (this.isDrawing) {
            this.isDrawing = false;
            this.ctx.closePath();
            this.saveState();
        }
        if (this.isPanning) this.isPanning = false;
        if (this.isRotatingWithSpace) this.isRotatingWithSpace = false;
        if (this.isMovingLayer) {
            this.isMovingLayer = false;
            this.saveState();
        }
    }

    setAbsolutePosition() {
        if (this.canvasContainer.style.position !== 'absolute') {
            const rect = this.canvasContainer.getBoundingClientRect();
            const areaRect = this.canvasArea.getBoundingClientRect();
            this.canvasStartX = rect.left - areaRect.left;
            this.canvasStartY = rect.top - areaRect.top;
            this.canvasContainer.style.position = 'absolute';
            this.canvasContainer.style.left = this.canvasStartX + 'px';
            this.canvasContainer.style.top = this.canvasStartY + 'px';
        } else {
            this.canvasStartX = parseFloat(this.canvasContainer.style.left || 0);
            this.canvasStartY = parseFloat(this.canvasContainer.style.top || 0);
        }
    }

    zoom(factor) {
        this.scale = Math.max(0.1, Math.min(this.scale * factor, 10));
        this.updateCanvasTransform();
    }

    rotate(degrees) {
        this.rotation = (this.rotation + degrees) % 360;
        this.updateCanvasTransform();
    }

    updateCanvasTransform() {
        const scaleX = this.scale * this.transformState.scaleX;
        const scaleY = this.scale * this.transformState.scaleY;
        this.canvasContainer.style.transform = `rotate(${this.rotation}deg) scale(${scaleX}, ${scaleY})`;
    }

    resetView() {
        this.scale = 1;
        this.rotation = 0;
        this.transformState.scaleX = 1;
        this.transformState.scaleY = 1;
        this.updateCanvasTransform();
        this.canvasContainer.style.position = '';
        this.canvasContainer.style.left = '';
        this.canvasContainer.style.top = '';
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

    // ...その他 fill, colorsMatch 等は元のまま維持
}
