// CanvasManager.js
class CanvasManager {
    constructor(app) {
        this.app = app;
        this.canvas = document.getElementById('drawingCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvasArea = document.getElementById('canvas-area');
        this.canvasContainer = document.getElementById('canvas-container');
        
        this.isDrawing = false;
        this.isPanning = false;
        this.isMovingLayer = false;
        this.isSpaceDown = false; // スペースキーの状態

        this.currentTool = 'pen'; // ToolManagerから設定される
        this.currentColor = '#800000'; // ColorManagerから設定される
        this.currentSize = 1; // PenSettingsManagerから設定される

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
        this.moveLayerImageData = null;
        
        this.scale = 1;
        this.rotation = 0;

        this.initCanvas();
        this.bindEvents();
    }
    
    initCanvas() {
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.fillStyle = '#f0e0d6';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    bindEvents() {
        this.canvas.addEventListener('pointerdown', this.onPointerDown.bind(this));
        document.addEventListener('pointermove', this.onPointerMove.bind(this));
        document.addEventListener('pointerup', this.onPointerUp.bind(this));
        this.canvasArea.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
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
        if (e.target !== this.canvas) return;
        
        if (this.isSpaceDown) {
            this.isPanning = true;
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
            this.setAbsolutePosition();
            e.target.setPointerCapture(e.pointerId);
        } else if (this.currentTool === 'move') {
            this.isMovingLayer = true;
            const coords = this.getCanvasCoordinates(e);
            this.moveLayerStartX = coords.x;
            this.moveLayerStartY = coords.y;
            this.moveLayerImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            e.target.setPointerCapture(e.pointerId);
        } else {
            this.isDrawing = true;
            const coords = this.getCanvasCoordinates(e);
            this.lastX = coords.x;
            this.lastY = coords.y;
            this.ctx.beginPath();
            this.ctx.moveTo(this.lastX, this.lastY);
            e.target.setPointerCapture(e.pointerId);
        }
    }

    onPointerMove(e) {
        if (!e.buttons) {
            this.onPointerUp(e);
            return;
        }

        if (this.isPanning) {
            const deltaX = e.clientX - this.dragStartX;
            const deltaY = e.clientY - this.dragStartY;
            this.canvasContainer.style.left = (this.canvasStartX + deltaX) + 'px';
            this.canvasContainer.style.top = (this.canvasStartY + deltaY) + 'px';
        } else if (this.isMovingLayer) {
            const coords = this.getCanvasCoordinates(e);
            const dx = Math.round(coords.x - this.moveLayerStartX);
            const dy = Math.round(coords.y - this.moveLayerStartY);
            this.ctx.fillStyle = '#f0e0d6'; // 背景色で塗りつぶし
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.putImageData(this.moveLayerImageData, dx, dy);
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
        if (!e.target.hasPointerCapture(e.pointerId)) return;
        e.target.releasePointerCapture(e.pointerId);
        
        if (this.isDrawing) {
            this.isDrawing = false;
            this.ctx.closePath();
            this.saveState();
        }
        if (this.isPanning) this.isPanning = false;
        if(this.isMovingLayer) {
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
    
    getCanvasCoordinates(e) {
        const rect = this.canvas.getBoundingClientRect();
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        x -= centerX;
        y -= centerY;
        const rad = -this.rotation * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const rotatedX = x * cos - y * sin;
        const rotatedY = x * sin + y * cos;
        const scaledX = rotatedX / this.scale;
        const scaledY = rotatedY / this.scale;
        const finalX = scaledX + this.canvas.width / 2;
        const finalY = scaledY + this.canvas.height / 2;
        return { x: finalX, y: finalY };
    }

    updateCursor() {
         if (this.isSpaceDown) {
            this.canvas.style.cursor = 'grab';
            return;
        }
        switch(this.currentTool) {
            case 'move': this.canvas.style.cursor = 'move'; break;
            case 'pen':
            case 'eraser':
            default: this.canvas.style.cursor = 'crosshair'; break;
        }
    }
    
    saveState() {
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        this.history.push(this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height));
        this.historyIndex++;
    }
    
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.ctx.putImageData(this.history[this.historyIndex], 0, 0);
        }
    }
    
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.ctx.putImageData(this.history[this.historyIndex], 0, 0);
        }
    }
    
    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = '#f0e0d6';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.saveState();
    }
    
    flipHorizontal() {
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = this.canvas.width;
        tempCanvas.height = this.canvas.height;

        tempCtx.translate(tempCanvas.width, 0);
        tempCtx.scale(-1, 1);
        tempCtx.drawImage(this.canvas, 0, 0);

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(tempCanvas, 0, 0);
        this.saveState();
    }

    flipVertical() {
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = this.canvas.width;
        tempCanvas.height = this.canvas.height;

        tempCtx.translate(0, tempCanvas.height);
        tempCtx.scale(1, -1);
        tempCtx.drawImage(this.canvas, 0, 0);
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(tempCanvas, 0, 0);
        this.saveState();
    }
    
    zoom(factor) {
        const newScale = this.scale * factor;
        this.scale = Math.max(0.1, Math.min(newScale, 10)); // 10%～1000%
        this.updateCanvasTransform();
    }
    
    rotate(degrees) {
        this.rotation = (this.rotation + degrees) % 360;
        this.updateCanvasTransform();
    }
    
    updateCanvasTransform() {
        this.canvasContainer.style.transform = `scale(${this.scale}) rotate(${this.rotation}deg)`;
        this.canvasContainer.style.transformOrigin = 'center center';
    }

    resetView() {
        this.scale = 1;
        this.rotation = 0;
        this.updateCanvasTransform();
        this.canvasContainer.style.position = 'relative';
        this.canvasContainer.style.left = 'auto';
        this.canvasContainer.style.top = 'auto';
        this.canvasContainer.style.zIndex = 'auto';
    }

    handleWheel(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -1 : 1;
        if (e.shiftKey) {
            this.rotate(delta * 15);
        } else {
            this.zoom(delta > 0 ? 1.1 : 1 / 1.1);
        }
    }

    // 予告: 解像度変更
    // 難易度：高｜優先度：中
}