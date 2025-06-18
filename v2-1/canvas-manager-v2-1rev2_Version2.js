class CanvasManager {
    constructor(app) {
        this.app = app;
        this.canvasArea = document.getElementById('canvas-area');
        this.canvasContainer = document.getElementById('canvas-container');
        this.compositeCanvas = document.createElement('canvas');
        this.compositeCanvas.width = 344;
        this.compositeCanvas.height = 135;
        this.compositeCanvas.className = 'main-canvas';
        this.compositeCanvas.style.position = 'absolute';
        this.compositeCanvas.style.top = '0';
        this.compositeCanvas.style.left = '0';
        this.compositeCanvas.style.pointerEvents = 'none';
        this.compositeCanvas.style.zIndex = 100;
        this.canvasContainer.appendChild(this.compositeCanvas);

        this.frameCanvas = null;
        this.scale = 1;
        this.rotation = 0;
        this.transformState = { scaleX: 1, scaleY: 1 };
        this.createAndDrawFrame();
        this.bindEvents();
    }

    setActiveLayerContext(canvas, ctx) {
        this.activeCanvas = canvas;
        this.activeCtx = ctx;
    }

    renderComposite() {
        const ctx = this.compositeCanvas.getContext('2d');
        ctx.clearRect(0, 0, this.compositeCanvas.width, this.compositeCanvas.height);
        this.app.layerManager.drawAllLayersTo(ctx);
    }
    requestRender() {
        this.renderComposite();
    }

    createAndDrawFrame() {
        if (this.frameCanvas) return;
        this.frameCanvas = document.createElement('canvas');
        this.frameCanvas.width = 364;
        this.frameCanvas.height = 145;
        this.frameCanvas.style.position = 'absolute';
        this.frameCanvas.style.left = '-10px';
        this.frameCanvas.style.top = '-5px';
        this.frameCanvas.style.pointerEvents = 'none';
        this.frameCanvas.style.zIndex = 200;
        this.canvasContainer.appendChild(this.frameCanvas);

        const ctx = this.frameCanvas.getContext('2d');
        ctx.clearRect(0, 0, this.frameCanvas.width, this.frameCanvas.height);
        ctx.strokeStyle = "#b9845a";
        ctx.lineWidth = 5;
        ctx.strokeRect(2.5, 2.5, 359, 139);
    }

    updateCanvasTransform() {
        const scaleX = this.scale * this.transformState.scaleX;
        const scaleY = this.scale * this.transformState.scaleY;
        this.canvasContainer.style.transform = `rotate(${this.rotation}deg) scale(${scaleX}, ${scaleY})`;
        if (this.frameCanvas) {
            const frameTransform = `rotate(${this.rotation}deg) scale(${scaleX}, ${scaleY})`;
            this.frameCanvas.style.transform = frameTransform;
            this.frameCanvas.style.left = this.canvasContainer.style.left || '-10px';
            this.frameCanvas.style.top = this.canvasContainer.style.top || '-5px';
        }
        this.requestRender();
    }
    resetView() {
        this.scale = 1; this.rotation = 0; this.transformState.scaleX = 1; this.transformState.scaleY = 1; this.updateCanvasTransform();
        this.canvasContainer.style.position = ''; this.canvasContainer.style.left = ''; this.canvasContainer.style.top = '';
        if (this.frameCanvas) {
            this.frameCanvas.style.left = '-10px';
            this.frameCanvas.style.top = '-5px';
            this.frameCanvas.style.transform = '';
        }
    }

    getCanvasCoordinates(e) {
        const layer = this.app.layerManager.getCurrentLayer();
        if (!layer) return { x: 0, y: 0 };
        const t = layer.transform;
        const canvas = layer.canvas;
        const containerRect = this.canvasContainer.getBoundingClientRect();
        const centerX = containerRect.left + canvas.width / 2 + t.x;
        const centerY = containerRect.top + canvas.height / 2 + t.y;
        let dx = e.clientX - centerX;
        let dy = e.clientY - centerY;
        const scaleX = t.scale * t.scaleX;
        const scaleY = t.scale * t.scaleY;
        dx /= scaleX;
        dy /= scaleY;
        const theta = -t.rotation * Math.PI / 180;
        const cos = Math.cos(theta);
        const sin = Math.sin(theta);
        const rx = dx * cos - dy * sin;
        const ry = dx * sin + dy * cos;
        const canvasX = rx + canvas.width / 2;
        const canvasY = ry + canvas.height / 2;
        return { x: canvasX, y: canvasY };
    }

    bindEvents() {
        // Space+ドラッグで全体移動
        let dragging = false;
        let lastX = 0, lastY = 0;
        let mode = null;
        this.canvasContainer.addEventListener('mousedown', (e) => {
            if (e.button === 0 && (e.ctrlKey || e.metaKey || this.app.toolManager.getCurrentTool() === "move" || e.spaceKey)) {
                dragging = true;
                lastX = e.clientX;
                lastY = e.clientY;
                mode = 'move';
                document.body.style.cursor = 'grab';
            }
        });
        document.addEventListener('mousemove', (e) => {
            if (dragging && mode === 'move') {
                const dx = e.clientX - lastX;
                const dy = e.clientY - lastY;
                lastX = e.clientX;
                lastY = e.clientY;
                const style = window.getComputedStyle(this.canvasContainer);
                let left = parseFloat(style.left || 0) || 0;
                let top = parseFloat(style.top || 0) || 0;
                left += dx;
                top += dy;
                this.canvasContainer.style.position = 'relative';
                this.canvasContainer.style.left = left + 'px';
                this.canvasContainer.style.top = top + 'px';
                if (this.frameCanvas) {
                    this.frameCanvas.style.left = left - 10 + 'px';
                    this.frameCanvas.style.top = top - 5 + 'px';
                }
            }
        });
        document.addEventListener('mouseup', (e) => {
            if (dragging) {
                dragging = false;
                document.body.style.cursor = '';
            }
        });
        // Vキーでレイヤーtransform mode
        window.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'v') {
                this.app.transformMode = true;
            }
        });
        window.addEventListener('keyup', (e) => {
            if (e.key.toLowerCase() === 'v') {
                this.app.transformMode = false;
            }
        });
    }
}