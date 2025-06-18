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
        const initialCanvas = document.getElementById('drawingCanvas');
        if (!initialCanvas) {
            console.error('Initial canvas #drawingCanvas not found!');
            return;
        }
        this.layers.push({
            canvas: initialCanvas,
            ctx: initialCanvas.getContext('2d'),
            transform: this.getDefaultTransform(),
        });
        this.switchLayer(0);
        this.updateAllLayerZIndexes();
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
        this.updateAllLayerZIndexes();
        this.switchLayer(this.layers.length - 1);
        return newLayer;
    }

    removeLayer(index) {
        if (this.layers.length <= 1 || index < 0 || index >= this.layers.length) return;
        const layer = this.layers[index];
        if (layer.canvas.parentNode === this.canvasContainer) {
            this.canvasContainer.removeChild(layer.canvas);
        }
        this.layers.splice(index, 1);
        if (this.activeLayerIndex >= this.layers.length) {
            this.activeLayerIndex = this.layers.length - 1;
        }
        this.switchLayer(this.activeLayerIndex);
        this.updateAllLayerZIndexes();
        if (this.app && this.app.canvasManager) this.app.canvasManager.requestRender();
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
            if (infoEl) infoEl.textContent = `L: ${this.activeLayerIndex + 1}/${this.layers.length}`;
        }
    }

    getCurrentLayer() {
        if (this.activeLayerIndex >= 0 && this.activeLayerIndex < this.layers.length) {
            return this.layers[this.activeLayerIndex];
        }
        return null;
    }

    updateAllLayerZIndexes() {
        this.layers.forEach((layer, index) => {
            layer.canvas.style.zIndex = index;
        });
    }

    updateLayerTransform(layer) {
        if (!layer || !layer.transform) return;
        if (this.app && this.app.canvasManager) {
            this.app.canvasManager.requestRender();
        }
    }
    moveActiveLayer(dx, dy) {
        const layer = this.getCurrentLayer();
        if (layer) {
            layer.transform.x += dx;
            this.updateLayerTransform(layer);
        }
    }
    scaleActiveLayer(factor) {
        const layer = this.getCurrentLayer();
        if (layer) {
            layer.transform.scale *= factor;
            this.updateLayerTransform(layer);
        }
    }
    rotateActiveLayer(degrees) {
        const layer = this.getCurrentLayer();
        if (layer) {
            layer.transform.rotation = (layer.transform.rotation + degrees) % 360;
            this.updateLayerTransform(layer);
        }
    }
    flipActiveLayerHorizontal() {
        const layer = this.getCurrentLayer();
        if (layer) {
            layer.transform.scaleX *= -1;
            this.updateLayerTransform(layer);
        }
    }
    flipActiveLayerVertical() {
        const layer = this.getCurrentLayer();
        if (layer) {
            layer.transform.scaleY *= -1;
            this.updateLayerTransform(layer);
        }
    }

    // 合成用
    drawAllLayersTo(ctx) {
        this.layers.forEach(layer => {
            const t = layer.transform;
            ctx.save();
            ctx.translate(
                layer.canvas.width / 2 + t.x,
                layer.canvas.height / 2 + t.y
            );
            ctx.rotate((t.rotation * Math.PI) / 180);
            ctx.scale(t.scale * t.scaleX, t.scale * t.scaleY);
            ctx.drawImage(
                layer.canvas,
                -layer.canvas.width / 2,
                -layer.canvas.height / 2
            );
            ctx.restore();
        });
    }
}