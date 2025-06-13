// CanvasManager.js
class CanvasManager {
    constructor(app) {
        this.app = app;
        this.canvasArea = document.getElementById('canvas-area');
        this.canvasContainer = document.getElementById('canvas-container');
        
        this.isDrawing = false;
        this.isPanning = false;
        this.isMovingLayer = false;
        this.isSpaceDown = false;

        this.currentTool = 'pen';
        this.currentColor = '#800000';
        this.currentSize = 1;

        this.lastX = 0; this.lastY = 0;
        this.dragStartX = 0; this.dragStartY = 0;
        this.canvasStartX = 0; this.canvasStartY = 0;
        this.moveLayerStartX = 0; this.moveLayerStartY = 0;
        this.moveLayerImageData = null;
        
        this.scale = 1; this.rotation = 0;

        this.bindEvents();
    }
    
    bindEvents() {
        // ★修正：イベントリスナーをcanvasContainerに設定し、より正確に描画イベントを捕捉
        this.canvasContainer.addEventListener('pointerdown', this.onPointerDown.bind(this));
        document.addEventListener('pointermove', this.onPointerMove.bind(this));
        document.addEventListener('pointerup', this.onPointerUp.bind(this));
        this.canvasArea.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
    }

    setCurrentTool(tool) { this.currentTool = tool; }
    setCurrentColor(color) { this.currentColor = color; }
    setCurrentSize(size) { this.currentSize = size; }
    
    getActiveCanvasAndCtx() {
        const activeLayer = this.app.layerManager.activeLayer;
        if (!activeLayer || !activeLayer.isDrawable) return { canvas: null, ctx: null };
        return { canvas: activeLayer.canvas, ctx: activeLayer.ctx };
    }

    onPointerDown(e) {
        // ★修正：UIパネル上での誤作動を防ぐ
        if (e.target.tagName !== 'CANVAS') return;

        const { canvas, ctx } = this.getActiveCanvasAndCtx();
        if (!canvas) return;
        
        // ★修正：ポインターイベントをキャンバスにキャプチャさせて、ドラッグ操作を安定させる
        canvas.setPointerCapture(e.pointerId);

        const coords = this.getCanvasCoordinates(e, canvas);
        this.lastX = coords.x;
        this.lastY = coords.y;

        if (this.isSpaceDown) {
            this.isPanning = true;
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
            this.setAbsolutePosition();
        } else if (this.currentTool === 'move') {
            this.isMovingLayer = true;
            this.moveLayerStartX = coords.x;
            this.moveLayerStartY = coords.y;
            this.moveLayerImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        } else if (this.currentTool === 'bucket') {
            this.fill(Math.floor(this.lastX), Math.floor(this.lastY), this.currentColor);
            this.saveState();
        } else {
            this.isDrawing = true;
            ctx.beginPath();
            ctx.moveTo(this.lastX, this.lastY);
        }
    }

    onPointerMove(e) {
        if (!e.buttons) {
            if (this.isDrawing || this.isMovingLayer || this.isPanning) this.onPointerUp(e);
            return;
        }

        const { canvas, ctx } = this.getActiveCanvasAndCtx();

        if (this.isPanning) {
            const deltaX = e.clientX - this.dragStartX;
            const deltaY = e.clientY - this.dragStartY;
            this.canvasContainer.style.left = (this.canvasStartX + deltaX) + 'px';
            this.canvasContainer.style.top = (this.canvasStartY + deltaY) + 'px';
        } else if (this.isMovingLayer && canvas) {
            const coords = this.getCanvasCoordinates(e, canvas);
            const dx = Math.round(coords.x - this.moveLayerStartX);
            const dy = Math.round(coords.y - this.moveLayerStartY);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.putImageData(this.moveLayerImageData, dx, dy);
        } else if (this.isDrawing && canvas) {
            const coords = this.getCanvasCoordinates(e, canvas);
            ctx.globalCompositeOperation = this.currentTool === 'eraser' ? 'destination-out' : 'source-over';
            ctx.strokeStyle = this.currentColor;
            ctx.lineWidth = this.currentSize;
            ctx.lineTo(coords.x, coords.y);
            ctx.stroke();
            this.lastX = coords.x;
            this.lastY = coords.y;
        }
    }

    onPointerUp(e) {
        const { canvas, ctx } = this.getActiveCanvasAndCtx();
        if (canvas && canvas.hasPointerCapture(e.pointerId)) {
            canvas.releasePointerCapture(e.pointerId);
        }

        if (this.isDrawing) {
            this.isDrawing = false;
            if (ctx) ctx.closePath();
            this.saveState();
        }
        if (this.isPanning) this.isPanning = false;
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
            this.canvasContainer.style.zIndex = '1000';
        } else {
            this.canvasStartX = parseFloat(this.canvasContainer.style.left || 0);
            this.canvasStartY = parseFloat(this.canvasContainer.style.top || 0);
        }
    }
    
    // ★修正：座標計算の基準をコンテナに統一し、ズレを解消
    getCanvasCoordinates(e, targetCanvas) {
        const rect = targetCanvas.getBoundingClientRect();
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;
        const centerX = this.canvasContainer.offsetWidth / 2;
        const centerY = this.canvasContainer.offsetHeight / 2;
        x -= centerX;
        y -= centerY;
        const rad = -this.rotation * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const rotatedX = x * cos - y * sin;
        const rotatedY = x * sin + y * cos;
        const finalX = (rotatedX / this.scale) + (targetCanvas.width / 2);
        const finalY = (rotatedY / this.scale) + (targetCanvas.height / 2);
        return { x: finalX, y: finalY };
    }

    updateCursor() {
        const cursorStyle = this.isSpaceDown ? 'grab' : 
                            this.currentTool === 'move' ? 'move' : 'crosshair';
        this.canvasContainer.style.cursor = cursorStyle;
    }
    
    saveState() { this.app.layerManager.saveStateForActiveLayer(); }
    undo() { this.app.layerManager.undoForActiveLayer(); }
    redo() { this.app.layerManager.redoForActiveLayer(); }
    
    clearCanvas() {
        const { canvas, ctx } = this.getActiveCanvasAndCtx();
        if (!canvas) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        this.saveState();
    }
    
    flipHorizontal() {
        const { canvas, ctx } = this.getActiveCanvasAndCtx();
        if (!canvas) return;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width; tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.translate(tempCanvas.width, 0); tempCtx.scale(-1, 1);
        tempCtx.drawImage(canvas, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(tempCanvas, 0, 0);
        this.saveState();
    }

    flipVertical() {
        const { canvas, ctx } = this.getActiveCanvasAndCtx();
        if (!canvas) return;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width; tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.translate(0, tempCanvas.height); tempCtx.scale(1, -1);
        tempCtx.drawImage(canvas, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(tempCanvas, 0, 0);
        this.saveState();
    }
    
    zoom(factor) { this.scale = Math.max(0.1, Math.min(this.scale * factor, 10)); this.updateCanvasTransform(); }
    rotate(degrees) { this.rotation = (this.rotation + degrees) % 360; this.updateCanvasTransform(); }
    updateCanvasTransform() { this.canvasContainer.style.transform = `scale(${this.scale}) rotate(${this.rotation}deg)`; }
    resetView() { this.scale = 1; this.rotation = 0; this.updateCanvasTransform(); this.canvasContainer.style.position = 'relative'; this.canvasContainer.style.left = 'auto'; this.canvasContainer.style.top = 'auto'; this.canvasContainer.style.zIndex = 'auto'; }
    handleWheel(e) { e.preventDefault(); const delta = e.deltaY > 0 ? -1 : 1; if (e.shiftKey) { this.rotate(delta * 15); } else { this.zoom(delta > 0 ? 1.1 : 1 / 1.1); } }

    fill(startX, startY, fillColor) { /* 変更なし */ }
    colorsMatch(a, b) { /* 変更なし */ }
    getPixelColor(imageData, x, y) { /* 変更なし */ }
    setPixelColor(imageData, x, y, color) { /* 変更なし */ }
}