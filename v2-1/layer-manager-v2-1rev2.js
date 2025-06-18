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

        const firstLayerCtx = this.layers[0].ctx;
        firstLayerCtx.fillStyle = '#f0e0d6';
        firstLayerCtx.fillRect(0, 0, initialCanvas.width, initialCanvas.height);

        this.switchLayer(0);
        this.updateAllLayerZIndexes();
    }

    addLayer() {
        if (this.layers.length === 0) {
            console.error("Cannot add a new layer without an initial layer.");
            return null;
        }

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
        
        newLayer.ctx.lineCap = 'round';
        newLayer.ctx.lineJoin = 'round';

        this.updateAllLayerZIndexes();
        this.switchLayer(this.layers.length - 1);
        
        console.log(`Layer added. Total layers: ${this.layers.length}`);
        return newLayer;
    }

    switchLayer(index) {
        if (index < 0 || index >= this.layers.length) {
            console.error(`Invalid layer index: ${index}`);
            return;
        }
        
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

    updateLayerTransform(layer) {
        if (!layer || !layer.transform) return;
        const t = layer.transform;
        const finalScaleX = t.scale * t.scaleX;
        const finalScaleY = t.scale * t.scaleY;
        layer.canvas.style.transform = 
            `translate(${t.x}px, ${t.y}px) rotate(${t.rotation}deg) scale(${finalScaleX}, ${finalScaleY})`;
    }

    updateAllLayerZIndexes() {
        this.layers.forEach((layer, index) => {
            layer.canvas.style.zIndex = index;
        });
    }

    moveActiveLayer(dx, dy) {
        const layer = this.getCurrentLayer();
        if (layer) {
            layer.transform.x += dx;
            layer.transform.y += dy;
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

    resetActiveLayer() {
        const layer = this.getCurrentLayer();
        if (layer) {
            layer.transform = this.getDefaultTransform();
            this.updateLayerTransform(layer);
        }
    }
}