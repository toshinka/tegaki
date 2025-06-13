// CanvasManager.js (レイヤー化への下準備版)
class CanvasManager {
    constructor(app) {
        this.app = app;
        this.canvasArea = document.getElementById('canvas-area');
        this.canvasContainer = document.getElementById('canvas-container');
        
        // --- ★下準備：特定のcanvasに依存しないように変更 ---
        this.activeCanvas = document.getElementById('drawingCanvas'); // 今は固定で指定
        this.activeCtx = this.activeCanvas.getContext('2d');
        // --- ここまで ---

        this.isDrawing = false;
        this.isPanning = false;
        this.isMovingLayer = false;
        this.isSpaceDown = false;

        this.currentTool = 'pen';
        this.currentColor = '#800000';
        this.currentSize = 1;

        this.lastX = 0; this.lastY = 0;
        this.history = []; this.historyIndex = -1;
        
        this.dragStartX = 0; this.dragStartY = 0;
        this.canvasStartX = 0; this.canvasStartY = 0;
        
        this.scale = 1; this.rotation = 0;

        this.initCanvas();
        this.bindEvents();
    }
    
    initCanvas() {
        this.activeCtx.lineCap = 'round';
        this.activeCtx.lineJoin = 'round';
        this.activeCtx.fillStyle = '#f0e0d6';
        this.activeCtx.fillRect(0, 0, this.activeCanvas.width, this.activeCanvas.height);
    }
    
    bindEvents() {
        this.activeCanvas.addEventListener('pointerdown', this.onPointerDown.bind(this));
        document.addEventListener('pointermove', this.onPointerMove.bind(this));
        document.addEventListener('pointerup', this.onPointerUp.bind(this));
        this.canvasArea.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
    }

    setCurrentTool(tool) { this.currentTool = tool; }
    setCurrentColor(color) { this.currentColor = color; }
    setCurrentSize(size) { this.currentSize = size; }

    onPointerDown(e) {
        if (e.target.tagName !== 'CANVAS') return;

        e.target.setPointerCapture(e.pointerId);
        
        const coords = this.getCanvasCoordinates(e);
        this.lastX = coords.x;
        this.lastY = coords.y;

        if (this.isSpaceDown) {
            this.isPanning = true;
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
            this.setAbsolutePosition();
        } else if (this.currentTool === 'bucket') {
            this.fill(Math.floor(this.lastX), Math.floor(this.lastY), this.currentColor);
            this.saveState();
        } else {
            this.isDrawing = true;
            this.activeCtx.beginPath();
            this.activeCtx.moveTo(this.lastX, this.lastY);
        }
    }

    onPointerMove(e) {
        if (!e.buttons) {
            if (this.isDrawing || this.isPanning) this.onPointerUp(e);
            return;
        }

        if (this.isPanning) {
            const deltaX = e.clientX - this.dragStartX;
            const deltaY = e.clientY - this.dragStartY;
            this.canvasContainer.style.left = (this.canvasStartX + deltaX) + 'px';
            this.canvasContainer.style.top = (this.canvasStartY + deltaY) + 'px';
        } else if (this.isDrawing) {
            const coords = this.getCanvasCoordinates(e);
            this.activeCtx.globalCompositeOperation = this.currentTool === 'eraser' ? 'destination-out' : 'source-over';
            this.activeCtx.strokeStyle = this.currentColor;
            this.activeCtx.lineWidth = this.currentSize;
            this.activeCtx.lineTo(coords.x, coords.y);
            this.activeCtx.stroke();
            this.lastX = coords.x;
            this.lastY = coords.y;
        }
    }

    onPointerUp(e) {
        if (e.target.hasPointerCapture(e.pointerId)) {
            e.target.releasePointerCapture(e.pointerId);
        }
        if (this.isDrawing) {
            this.isDrawing = false;
            this.activeCtx.closePath();
            this.saveState();
        }
        if (this.isPanning) this.isPanning = false;
    }
    
    setAbsolutePosition() { /* 変更なし */ }
    
    getCanvasCoordinates(e) {
        const rect = this.activeCanvas.getBoundingClientRect();
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;
        const centerX = this.canvasContainer.offsetWidth / 2;
        const centerY = this.canvasContainer.offsetHeight / 2;
        x -= centerX; y -= centerY;
        const rad = -this.rotation * Math.PI / 180;
        const cos = Math.cos(rad); const sin = Math.sin(rad);
        const rotatedX = x * cos - y * sin;
        const rotatedY = x * sin + y * cos;
        const finalX = (rotatedX / this.scale) + (this.activeCanvas.width / 2);
        const finalY = (rotatedY / this.scale) + (this.activeCanvas.height / 2);
        return { x: finalX, y: finalY };
    }

    updateCursor() {
        this.activeCanvas.style.cursor = this.isSpaceDown ? 'grab' : 'crosshair';
    }
    
    saveState() {
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
        }
    }
    
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.activeCtx.putImageData(this.history[this.historyIndex], 0, 0);
        }
    }
    
    clearCanvas() {
        this.activeCtx.fillStyle = '#f0e0d6';
        this.activeCtx.fillRect(0, 0, this.activeCanvas.width, this.activeCanvas.height);
        this.saveState();
    }
    
    flipHorizontal() { /* 安定版のロジックをactiveCanvas/Ctxで実行 */ }
    flipVertical() { /* 安定版のロジックをactiveCanvas/Ctxで実行 */ }
    zoom(factor) { /* 変更なし */ }
    rotate(degrees) { /* 変更なし */ }
    updateCanvasTransform() { /* 変更なし */ }
    resetView() { /* 変更なし */ }
    handleWheel(e) { /* 変更なし */ }
    fill(startX, startY, fillColor) { /* 安定版のロジックをactiveCanvas/Ctxで実行 */ }
    colorsMatch(a, b) { /* 変更なし */ }
    getPixelColor(imageData, x, y) { /* 変更なし */ }
    setPixelColor(imageData, x, y, color) { /* 変更なし */ }
}

// 安定版と同じロジックをactiveCanvas/Ctxで実行するように修正
CanvasManager.prototype.flipHorizontal = function() {
    const tempCanvas = document.createElement('canvas'); const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = this.activeCanvas.width; tempCanvas.height = this.activeCanvas.height;
    tempCtx.translate(tempCanvas.width, 0); tempCtx.scale(-1, 1);
    tempCtx.drawImage(this.activeCanvas, 0, 0);
    this.activeCtx.clearRect(0, 0, this.activeCanvas.width, this.activeCanvas.height);
    this.activeCtx.drawImage(tempCanvas, 0, 0); this.saveState();
};
CanvasManager.prototype.flipVertical = function() {
    const tempCanvas = document.createElement('canvas'); const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = this.activeCanvas.width; tempCanvas.height = this.activeCanvas.height;
    tempCtx.translate(0, tempCanvas.height); tempCtx.scale(1, -1);
    tempCtx.drawImage(this.activeCanvas, 0, 0);
    this.activeCtx.clearRect(0, 0, this.activeCanvas.width, this.activeCanvas.height);
    this.activeCtx.drawImage(tempCanvas, 0, 0); this.saveState();
};
CanvasManager.prototype.fill = function(startX, startY, fillColor) {
    const canvasWidth = this.activeCanvas.width; const canvasHeight = this.activeCanvas.height;
    const imageData = this.activeCtx.getImageData(0, 0, canvasWidth, canvasHeight);
    const startColor = this.getPixelColor(imageData, startX, startY);
    const tempCtx = document.createElement('canvas').getContext('2d');
    tempCtx.fillStyle = fillColor; tempCtx.fillRect(0, 0, 1, 1);
    const fillRGBA = tempCtx.getImageData(0, 0, 1, 1).data;
    const targetFillColor = [fillRGBA[0], fillRGBA[1], fillRGBA[2], 255];
    if (this.colorsMatch(startColor, targetFillColor)) return;
    const stack = [[startX, startY]];
    while (stack.length > 0) {
        const [x, y] = stack.pop();
        if (x < 0 || x >= canvasWidth || y < 0 || y >= canvasHeight) continue;
        const currentColor = this.getPixelColor(imageData, x, y);
        if (this.colorsMatch(currentColor, startColor)) {
            this.setPixelColor(imageData, x, y, targetFillColor);
            stack.push([x + 1, y]); stack.push([x - 1, y]);
            stack.push([x, y + 1]); stack.push([x, y - 1]);
        }
    }
    this.activeCtx.putImageData(imageData, 0, 0);
};