// 20250614_1730_CanvasManager.js
// v1.2 レイヤー機能対応
class CanvasManager {
    constructor(app) {
        this.app = app;
        // ★変更: 描画対象のcanvasとctxはLayerManagerから動的に設定される
        this.canvas = null;
        this.ctx = null;
        
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
        
        // ★変更なし: Undo/Redoは単一の共通履歴
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

        // ★変更: イベントリスナをcanvas本体ではなく、canvasContainerに設定
        this.bindEvents();
    }
    
    /**
     * ★新規: LayerManagerからアクティブなレイヤーの描画コンテキストを受け取る
     * @param {HTMLCanvasElement} canvas - アクティブなレイヤーのcanvas要素
     * @param {CanvasRenderingContext2D} ctx - アクティブなレイヤーのcontext
     */
    setActiveLayerContext(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
    }

    /**
     * ★変更: イベントリスナをcanvasからcanvasContainerに移譲
     * これにより、レイヤーが切り替わってもイベントを再設定する必要がなくなる
     */
    bindEvents() {
        this.canvasContainer.addEventListener('pointerdown', this.onPointerDown.bind(this));
        document.addEventListener('pointermove', this.onPointerMove.bind(this));
        document.addEventListener('pointerup', this.onPointerUp.bind(this));
        this.canvasArea.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
    }

    setCurrentTool(tool) { this.currentTool = tool; }
    setCurrentColor(color) { this.currentColor = color; }
    setCurrentSize(size) { this.currentSize = size; }

    onPointerDown(e) {
        // ★変更: イベントのターゲットが現在のアクティブなcanvasであるかを確認
        if (e.target !== this.canvas) return;
        
        const coords = this.getCanvasCoordinates(e);
        this.lastX = coords.x;
        this.lastY = coords.y;

        if (this.isSpaceDown) {
            this.isPanning = true;
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
            this.setAbsolutePosition();
            // ポインターキャプチャはコンテナではなく、イベントターゲット(canvas)に設定
            e.target.setPointerCapture(e.pointerId);
        } else if (this.currentTool === 'move') {
            this.isMovingLayer = true;
            this.moveLayerStartX = coords.x;
            this.moveLayerStartY = coords.y;
            this.moveLayerImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            e.target.setPointerCapture(e.pointerId);
        } else if (this.currentTool === 'bucket') {
            this.fill(Math.floor(this.lastX), Math.floor(this.lastY), this.currentColor);
            this.saveState();
        } else {
            this.isDrawing = true;
            this.ctx.beginPath();
            this.ctx.moveTo(this.lastX, this.lastY);
            e.target.setPointerCapture(e.pointerId);
        }
    }

    onPointerMove(e) {
        // isDrawingなどのフラグで管理されているため、ターゲットチェックは不要
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
            // v1.1では背景色で塗りつぶしていたが、レイヤーではclearRectを使う
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
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
        // hasPointerCaptureはイベントターゲットに紐づくため、
        // e.targetがポインタをキャプチャしているか確認する
        // try-catchでエラーを握りつぶすことで、意図しない解放エラーを防ぐ
        try {
          if (e.target && typeof e.target.hasPointerCapture === 'function' && e.target.hasPointerCapture(e.pointerId)) {
             e.target.releasePointerCapture(e.pointerId);
          }
        } catch (err) {
            // console.error("releasePointerCapture failed:", err);
        }

        if (this.isDrawing) {
            this.isDrawing = false;
            this.ctx.closePath();
            this.saveState();
        }
        if (this.isPanning) this.isPanning = false;
        if (this.isMovingLayer) {
            this.isMovingLayer = false;
            this.saveState();
        }
    }
    
    // 以下のメソッドは基本的にthis.canvasとthis.ctxを参照するため、
    // setActiveLayerContextで正しく設定されていれば、変更は不要。
    // v1.1からの互換性を維持。

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
    
    // ★互換性維持: 座標計算ロジックはv1.1と完全に同一
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
        const finalX = (rotatedX / this.scale) + this.canvas.width / 2;
        const finalY = (rotatedY / this.scale) + this.canvas.height / 2;
        return { x: finalX, y: finalY };
    }

    updateCursor() {
        // canvasが未設定の場合は何もしない
        if (!this.canvas) return;

         if (this.isSpaceDown) {
            this.canvas.style.cursor = 'grab';
            return;
        }
        switch(this.currentTool) {
            case 'move': this.canvas.style.cursor = 'move'; break;
            case 'pen':
            case 'eraser':
            case 'bucket':
            default: this.canvas.style.cursor = 'crosshair'; break;
        }
    }
    
    // ★互換性維持: 共通履歴の管理方法はv1.1と完全に同一
    saveState() {
        if (!this.ctx) return;
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        this.history.push(this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height));
        this.historyIndex++;
    }
    
    undo() {
        if (!this.ctx) return;
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.ctx.putImageData(this.history[this.historyIndex], 0, 0);
        }
    }
    
    redo() {
        if (!this.ctx) return;
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.ctx.putImageData(this.history[this.historyIndex], 0, 0);
        }
    }
    
    clearCanvas() {
        if (!this.ctx) return;
        // レイヤーでは背景色で塗りつぶすのではなく、透明にする
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.saveState();
    }
    
    flipHorizontal() {
        if (!this.ctx) return;
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
        if (!this.ctx) return;
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
        this.scale = Math.max(0.1, Math.min(this.scale * factor, 10));
        this.updateCanvasTransform();
    }
    
    rotate(degrees) {
        this.rotation = (this.rotation + degrees) % 360;
        this.updateCanvasTransform();
    }
    
    updateCanvasTransform() {
        this.canvasContainer.style.transform = `scale(${this.scale}) rotate(${this.rotation}deg)`;
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

    colorsMatch(a, b) {
        return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
    }
    getPixelColor(imageData, x, y) {
        const i = (y * imageData.width + x) * 4;
        return [imageData.data[i], imageData.data[i + 1], imageData.data[i + 2], imageData.data[i + 3]];
    }
    setPixelColor(imageData, x, y, color) {
        const i = (y * imageData.width + x) * 4;
        imageData.data[i] = color[0];
        imageData.data[i + 1] = color[1];
        imageData.data[i + 2] = color[2];
        imageData.data[i + 3] = color[3];
    }
    fill(startX, startY, fillColor) {
        if (!this.ctx) return;
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        const imageData = this.ctx.getImageData(0, 0, canvasWidth, canvasHeight);
        
        const startColor = this.getPixelColor(imageData, startX, startY);
        
        const tempCtx = document.createElement('canvas').getContext('2d');
        tempCtx.fillStyle = fillColor;
        tempCtx.fillRect(0, 0, 1, 1);
        const fillRGBA = tempCtx.getImageData(0, 0, 1, 1).data;
        const targetFillColor = [fillRGBA[0], fillRGBA[1], fillRGBA[2], fillRGBA[3]];

        if (this.colorsMatch(startColor, targetFillColor)) return;

        const stack = [[startX, startY]];
        while (stack.length > 0) {
            const [x, y] = stack.pop();
            if (x < 0 || x >= canvasWidth || y < 0 || y >= canvasHeight) continue;

            const currentColor = this.getPixelColor(imageData, x, y);
            if (this.colorsMatch(currentColor, startColor)) {
                this.setPixelColor(imageData, x, y, targetFillColor);
                stack.push([x + 1, y]);
                stack.push([x - 1, y]);
                stack.push([x, y + 1]);
                stack.push([x, y - 1]);
            }
        }
        this.ctx.putImageData(imageData, 0, 0);
    }
}
