// CanvasManager.js
class CanvasManager {
    constructor(app) {
        this.app = app;
        // イベントはコンテナ全体でリッスンする
        this.canvasArea = document.getElementById('canvas-area');
        this.canvasContainer = document.getElementById('canvas-container');
        
        this.isDrawing = false;
        this.isPanning = false;
        this.isMovingLayer = false;
        this.isSpaceDown = false;

        this.currentTool = 'pen';
        this.currentColor = '#800000';
        this.currentSize = 1;

        this.lastX = 0;
        this.lastY = 0;
        
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.canvasStartX = 0;
        this.canvasStartY = 0;
        this.moveLayerStartX = 0;
        this.moveLayerStartY = 0;
        this.moveLayerImageData = null;
        
        this.scale = 1;
        this.rotation = 0;

        this.bindEvents();
    }
    
    bindEvents() {
        // イベントリスナーを canvasArea に変更
        this.canvasArea.addEventListener('pointerdown', this.onPointerDown.bind(this));
        document.addEventListener('pointermove', this.onPointerMove.bind(this));
        document.addEventListener('pointerup', this.onPointerUp.bind(this));
        this.canvasArea.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
    }

    setCurrentTool(tool) { this.currentTool = tool; }
    setCurrentColor(color) { this.currentColor = color; }
    setCurrentSize(size) { this.currentSize = size; }
    
    // 現在操作対象のキャンバスとコンテキストを取得するヘルパー
    getActiveCanvasAndCtx() {
        const activeLayer = this.app.layerManager.activeLayer;
        if (!activeLayer || !activeLayer.isDrawable) return { canvas: null, ctx: null };
        return { canvas: activeLayer.canvas, ctx: activeLayer.ctx };
    }

    onPointerDown(e) {
        // クリック位置がキャンバスコンテナの外なら何もしない
        if (!e.target.closest('#canvas-container')) return;

        const { canvas, ctx } = this.getActiveCanvasAndCtx();
        if (!canvas) return;
        
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
            this.onPointerUp(e);
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
            ctx.clearRect(0, 0, canvas.width, canvas.height); // 透明にする
            ctx.putImageData(this.moveLayerImageData, dx, dy);
        } else if (this.isDrawing && canvas) {
            const coords = this.getCanvasCoordinates(e, canvas);
            const currentX = coords.x;
            const currentY = coords.y;
            ctx.globalCompositeOperation = this.currentTool === 'eraser' ? 'destination-out' : 'source-over';
            ctx.strokeStyle = this.currentColor;
            ctx.lineWidth = this.currentSize;
            ctx.lineTo(currentX, currentY);
            ctx.stroke();
            this.lastX = currentX;
            this.lastY = currentY;
        }
    }

    onPointerUp(e) {
        const { ctx } = this.getActiveCanvasAndCtx();
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
    
    getCanvasCoordinates(e, targetCanvas) {
        const rect = targetCanvas.getBoundingClientRect();
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
        const finalX = (rotatedX / this.scale) + targetCanvas.width / 2;
        const finalY = (rotatedY / this.scale) + targetCanvas.height / 2;
        return { x: finalX, y: finalY };
    }

    updateCursor() {
        const cursorStyle = this.isSpaceDown ? 'grab' : 
                            this.currentTool === 'move' ? 'move' : 'crosshair';
        // 全てのレイヤーキャンバスのカーソルを更新
        this.app.layerManager.layers.forEach(layer => {
            if (layer.canvas) layer.canvas.style.cursor = cursorStyle;
        });
    }
    
    // --- 履歴管理(LayerManagerへ中継) ---
    saveState() { this.app.layerManager.saveStateForActiveLayer(); }
    undo() { this.app.layerManager.undoForActiveLayer(); }
    redo() { this.app.layerManager.redoForActiveLayer(); }
    
    // --- 描画操作(アクティブレイヤーに対して実行) ---
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
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        tempCtx.translate(tempCanvas.width, 0);
        tempCtx.scale(-1, 1);
        tempCtx.drawImage(canvas, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(tempCanvas, 0, 0);
        this.saveState();
    }

    flipVertical() {
        const { canvas, ctx } = this.getActiveCanvasAndCtx();
        if (!canvas) return;
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        tempCtx.translate(0, tempCanvas.height);
        tempCtx.scale(1, -1);
        tempCtx.drawImage(canvas, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(tempCanvas, 0, 0);
        this.saveState();
    }
    
    // --- 表示操作(全体に影響) ---
    zoom(factor) { this.scale = Math.max(0.1, Math.min(this.scale * factor, 10)); this.updateCanvasTransform(); }
    rotate(degrees) { this.rotation = (this.rotation + degrees) % 360; this.updateCanvasTransform(); }
    updateCanvasTransform() { this.canvasContainer.style.transform = `scale(${this.scale}) rotate(${this.rotation}deg)`; }
    resetView() { this.scale = 1; this.rotation = 0; this.updateCanvasTransform(); this.canvasContainer.style.position = 'relative'; this.canvasContainer.style.left = 'auto'; this.canvasContainer.style.top = 'auto'; this.canvasContainer.style.zIndex = 'auto'; }
    handleWheel(e) { e.preventDefault(); const delta = e.deltaY > 0 ? -1 : 1; if (e.shiftKey) { this.rotate(delta * 15); } else { this.zoom(delta > 0 ? 1.1 : 1 / 1.1); } }

    // --- バケツツール ---
    fill(startX, startY, fillColor) {
        const { canvas, ctx } = this.getActiveCanvasAndCtx();
        if (!canvas) return;

        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
        
        const startColor = this.getPixelColor(imageData, startX, startY);
        
        const tempCtx = document.createElement('canvas').getContext('2d');
        tempCtx.fillStyle = fillColor;
        tempCtx.fillRect(0, 0, 1, 1);
        const fillRGBA = tempCtx.getImageData(0, 0, 1, 1).data;
        const targetFillColor = [fillRGBA[0], fillRGBA[1], fillRGBA[2], 255]; // Ensure alpha is 255 for fill

        if (this.colorsMatch(startColor, targetFillColor)) return;
        if (this.colorsMatch(startColor, [0,0,0,0]) && this.currentTool === 'eraser') return; // Don't fill transparent with eraser

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
        ctx.putImageData(imageData, 0, 0);
    }
    colorsMatch(a, b) { return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3]; }
    getPixelColor(imageData, x, y) { const i = (y * imageData.width + x) * 4; return [imageData.data[i], imageData.data[i + 1], imageData.data[i + 2], imageData.data[i + 3]]; }
    setPixelColor(imageData, x, y, color) { const i = (y * imageData.width + x) * 4; imageData.data[i] = color[0]; imageData.data[i+1] = color[1]; imageData.data[i+2] = color[2]; imageData.data[i+3] = color[3]; }
}