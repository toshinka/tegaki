// CanvasManager-v1-3-rev4.js
// ホイールイベントの一部をShortcutManagerに移譲するように変更。
// これにより、Vキー（移動ツール）+ホイールでのレイヤー操作が可能になる。
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
        
        // isMovingLayerが有効な時のマウスドラッグによる移動は残すため、
        // 以下のプロパティはそのまま使用する。
        this.moveLayerStartX = 0;
        this.moveLayerStartY = 0;
        this.moveLayerImageData = null;
        
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

    setCurrentTool(tool) { this.currentTool = tool; }
    setCurrentColor(color) { this.currentColor = color; }
    setCurrentSize(size) { this.currentSize = size; }

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
                // レイヤーのドラッグ移動開始点を記録
                this.moveLayerStartX = e.clientX;
                this.moveLayerStartY = e.clientY;
                // 移動前のレイヤーの状態を保存しないように変更（ショートカットでの移動と挙動を合わせるため）
                // this.moveLayerImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
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
        } catch (err) {}
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
            // マウスドラッグでのレイヤー移動
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
        } catch (err) {}

        if (this.isDrawing) {
            this.isDrawing = false;
            this.ctx.closePath();
            this.saveState();
        }
        if (this.isPanning) this.isPanning = false;
        if (this.isRotatingWithSpace) this.isRotatingWithSpace = false;
        if (this.isMovingLayer) {
            this.isMovingLayer = false;
            // ここでUndo履歴に記録すると、ドラッグ中の細かい移動が全て記録されてしまう。
            // 今回はUndo/Redoの対象外とする指示のため、記録しない。
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
    
    getCanvasCoordinates(e) {
        // レイヤーごとのtransformは描画座標の計算に影響しないため、この関数のロジックは変更なし
        const containerRect = this.canvasContainer.getBoundingClientRect();
        const centerX = containerRect.left + containerRect.width / 2;
        const centerY = containerRect.top + containerRect.height / 2;
        let mouseX = e.clientX - centerX;
        let mouseY = e.clientY - centerY;
        const rad = -this.rotation * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        let unrotatedX = mouseX * cos - mouseY * sin;
        let unrotatedY = mouseX * sin + mouseY * cos;
        const unscaledX = unrotatedX / this.scale / this.transformState.scaleX;
        const unscaledY = unrotatedY / this.scale / this.transformState.scaleY;
        const canvasX = unscaledX + this.canvas.width / 2;
        const canvasY = unscaledY + this.canvas.height / 2;
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
        
        switch(this.currentTool) {
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
        this.history.push(this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height));
        this.historyIndex++;
    }
    
    undo() { if (this.historyIndex > 0) { this.historyIndex--; this.ctx.putImageData(this.history[this.historyIndex], 0, 0); } }
    redo() { if (this.historyIndex < this.history.length - 1) { this.historyIndex++; this.ctx.putImageData(this.history[this.historyIndex], 0, 0); } }
    clearCanvas() { this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); this.saveState(); }
    clearAllLayers() { if (!this.app.layerManager || !this.app.layerManager.layers) return; this.app.layerManager.layers.forEach((layer, index) => { const lw = layer.canvas.width; const lh = layer.canvas.height; layer.ctx.clearRect(0, 0, lw, lh); if (index === 0) { layer.ctx.fillStyle = '#f0e0d6'; layer.ctx.fillRect(0, 0, lw, lh); } }); this.saveState(); }
    flipHorizontal() { this.transformState.scaleX *= -1; this.updateCanvasTransform(); }
    flipVertical() { this.transformState.scaleY *= -1; this.updateCanvasTransform(); }
    zoom(factor) { this.scale = Math.max(0.1, Math.min(this.scale * factor, 10)); this.updateCanvasTransform(); }
    rotate(degrees) { this.rotation = (this.rotation + degrees) % 360; this.updateCanvasTransform(); }
    
    updateCanvasTransform() {
        const scaleX = this.scale * this.transformState.scaleX;
        const scaleY = this.scale * this.transformState.scaleY;
        this.canvasContainer.style.transform = `rotate(${this.rotation}deg) scale(${scaleX}, ${scaleY})`;
    }

    resetView() {
        this.scale = 1; this.rotation = 0; this.transformState.scaleX = 1; this.transformState.scaleY = 1; this.updateCanvasTransform();
        this.canvasContainer.style.position = ''; this.canvasContainer.style.left = ''; this.canvasContainer.style.top = '';
    }

    handleWheel(e) {
        // --- ショートカット処理をShortcutManagerに移譲 ---
        // ShortcutManagerがイベントを処理した場合、この先の処理は行わない
        if (this.app.shortcutManager && this.app.shortcutManager.handleWheel(e)) {
            e.preventDefault();
            return;
        }
        // --- ここまで ---

        e.preventDefault();
        const delta = e.deltaY > 0 ? -1 : 1;
        if (e.shiftKey) { // 全体回転
            this.rotate(delta * 15);
        } else { // 全体ズーム
            this.zoom(delta > 0 ? 1.1 : 1 / 1.1);
        }
    }

    colorsMatch(a, b) { return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3]; }
    getPixelColor(imageData, x, y) { const i = (y * imageData.width + x) * 4; return [imageData.data[i], imageData.data[i + 1], imageData.data[i + 2], imageData.data[i + 3]]; }
    setPixelColor(imageData, x, y, color) { const i = (y * imageData.width + x) * 4; imageData.data[i] = color[0]; imageData.data[i + 1] = color[1]; imageData.data[i + 2] = color[2]; imageData.data[i + 3] = color[3]; }
    fill(startX, startY, fillColor) { const canvasWidth = this.canvas.width; const canvasHeight = this.canvas.height; const imageData = this.ctx.getImageData(0, 0, canvasWidth, canvasHeight); const startColor = this.getPixelColor(imageData, startX, startY); const tempCtx = document.createElement('canvas').getContext('2d'); tempCtx.fillStyle = fillColor; tempCtx.fillRect(0, 0, 1, 1); const fillRGBA = tempCtx.getImageData(0, 0, 1, 1).data; const targetFillColor = [fillRGBA[0], fillRGBA[1], fillRGBA[2], fillRGBA[3]]; if (this.colorsMatch(startColor, targetFillColor)) return; const stack = [[startX, startY]]; while (stack.length > 0) { const [x, y] = stack.pop(); if (x < 0 || x >= canvasWidth || y < 0 || y >= canvasHeight) continue; const currentColor = this.getPixelColor(imageData, x, y); if (this.colorsMatch(currentColor, startColor)) { this.setPixelColor(imageData, x, y, targetFillColor); stack.push([x + 1, y]); stack.push([x - 1, y]); stack.push([x, y + 1]); stack.push([x, y - 1]); } } this.ctx.putImageData(imageData, 0, 0); }
}
