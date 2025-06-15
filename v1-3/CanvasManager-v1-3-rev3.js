// CanvasManager-v1-3-rev3.js
// 仮想transformによる表示反転・回転を実装。
// 描画座標も逆変換により補正。
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
        this.moveLayerImageData = null;
        
        // --- 仮想transform対応 ---
        // 表示用の変形状態
        this.scale = 1; // 表示倍率
        this.rotation = 0; // 表示回転
        this.transformState = { scaleX: 1, scaleY: 1 }; // 表示反転状態
        // --- ここまで ---
        
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
        this.canvasContainer.addEventListener('pointerdown', this.onPointerDown.bind(this));
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
        // アクティブレイヤー以外でのイベントは無視
        if (!this.canvas || e.target !== this.canvas) return;

        // --- 仮想transform対応 ---
        // 座標を逆変換して取得
        const coords = this.getCanvasCoordinates(e);
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
            this.moveLayerImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        } else if (this.currentTool === 'bucket') {
            this.fill(Math.floor(this.lastX), Math.floor(this.lastY), this.currentColor);
            this.saveState();
        } else {
            this.isDrawing = true;
            this.ctx.beginPath();
            this.ctx.moveTo(this.lastX, this.lastY);
        }
        try {
            // イベントをキャプチャして要素外での操作も検知
            document.documentElement.setPointerCapture(e.pointerId);
        } catch (err) {}
    }

    onPointerMove(e) {
        // ボタンが押されていないmoveイベントは無視
        if (!e.buttons) {
            return;
        }

        if (this.isPanning) {
            const deltaX = e.clientX - this.dragStartX;
            const deltaY = e.clientY - this.dragStartY;
            this.canvasContainer.style.left = (this.canvasStartX + deltaX) + 'px';
            this.canvasContainer.style.top = (this.canvasStartY + deltaY) + 'px';
        } else if (this.isMovingLayer) {
            // --- 仮想transform対応 ---
            const coords = this.getCanvasCoordinates(e);
            const dx = Math.round(coords.x - this.moveLayerStartX);
            const dy = Math.round(coords.y - this.moveLayerStartY);
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.putImageData(this.moveLayerImageData, dx, dy);
        } else if (this.isDrawing) {
            // --- 仮想transform対応 ---
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
            this.saveState(); // 描画内容が変わったので履歴に保存
        }
        if (this.isPanning) this.isPanning = false;
        if (this.isMovingLayer) {
            this.isMovingLayer = false;
            this.saveState(); // レイヤー移動が終わったので履歴に保存
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
    
    /**
     * @breif 画面上の座標を、仮想transformを逆算したキャンバス座標に変換する
     * @param {PointerEvent} e マウスイベント
     * @returns {{x: number, y: number}} キャンバス上の座標
     */
    getCanvasCoordinates(e) {
        // 1. canvas-containerの画面上の矩形と中心座標を取得
        const containerRect = this.canvasContainer.getBoundingClientRect();
        const centerX = containerRect.left + containerRect.width / 2;
        const centerY = containerRect.top + containerRect.height / 2;
        
        // 2. マウス座標を、コンテナ中心からの相対座標に変換
        let mouseX = e.clientX - centerX;
        let mouseY = e.clientY - centerY;
        
        // 3. Transformの逆変換を適用 (回転→スケールの順)
        // 3-1. 回転の逆変換
        const rad = -this.rotation * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        let unrotatedX = mouseX * cos - mouseY * sin;
        let unrotatedY = mouseX * sin + mouseY * cos;

        // 3-2. スケール(ズームと反転)の逆変換
        const unscaledX = unrotatedX / this.scale / this.transformState.scaleX;
        const unscaledY = unrotatedY / this.scale / this.transformState.scaleY;
        
        // 4. コンテナ中心からの相対座標を、キャンバスの左上基準の座標に変換
        const canvasX = unscaledX + this.canvas.width / 2;
        const canvasY = unscaledY + this.canvas.height / 2;
        
        return { x: canvasX, y: canvasY };
    }

    updateCursor() {
         if (!this.canvas) return;
         if (this.isSpaceDown) {
            this.canvasArea.style.cursor = 'grab';
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
        this.saveState();
    }
    
    // --- 仮想transform対応 ---
    // 左右反転（表示のみ）
    flipHorizontal() {
        this.transformState.scaleX *= -1;
        this.updateCanvasTransform();
        // 表示の変更はUndo履歴に含めない
    }

    // 上下反転（表示のみ）
    flipVertical() {
        this.transformState.scaleY *= -1;
        this.updateCanvasTransform();
        // 表示の変更はUndo履歴に含めない
    }
    
    zoom(factor) {
        this.scale = Math.max(0.1, Math.min(this.scale * factor, 10));
        this.updateCanvasTransform();
    }
    
    rotate(degrees) {
        this.rotation = (this.rotation + degrees) % 360;
        this.updateCanvasTransform();
    }
    
    // transformスタイルを更新する
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
        
        // 位置もリセット
        this.canvasContainer.style.position = '';
        this.canvasContainer.style.left = '';
        this.canvasContainer.style.top = '';
    }
    // --- ここまで ---

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
