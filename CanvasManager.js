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
        // 履歴管理はLayerManagerに委譲するため、CanvasManagerからは削除
        // this.history = [];
        // this.historyIndex = -1;

        this.dragStartX = 0;
        this.dragStartY = 0;
        this.canvasStartX = 0;
        this.canvasStartY = 0;
        this.moveLayerStartX = 0;
        this.moveLayerStartY = 0;
        this.moveLayerImageData = null;

        this.scale = 1;
        this.rotation = 0;

        // 現在の操作対象レイヤー
        this.targetLayer = null; // LayerManagerから設定される

        this.initCanvas();
        this.bindEvents();
    }

    initCanvas() {
        // メインキャンバスの初期化（背景色塗りつぶしはLayerManagerの背景レイヤーで行う）
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        // this.ctx.fillStyle = '#f0e0d6'; // LayerManagerが背景レイヤーを管理するため削除
        // this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height); // LayerManagerが背景レイヤーを管理するため削除
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

    /**
     * 描画対象となるレイヤーのcanvasとctxを設定する
     * @param {object} layer - LayerManagerから渡されるレイヤーオブジェクト
     */
    setTargetLayer(layer) {
        if (!layer || !layer.canvas || !layer.ctx) {
            console.error('Invalid layer object provided to setTargetLayer:', layer);
            return;
        }
        this.targetLayer = layer;
        this.canvas = layer.canvas; // 描画イベントのターゲットとなるキャンバス
        this.ctx = layer.ctx;       // 描画コンテキスト

        // アクティブレイヤーの描画設定を適用
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.updateCursor(); // アクティブレイヤー切り替え時にカーソルを更新
    }

    onPointerDown(e) {
        // レイヤー移動ツール選択時でも、キャンバス外でのクリックは無視
        if (e.target !== this.canvas && this.currentTool !== 'move') return;

        // レイヤー移動ツール選択時で、かつcanvas要素自体を対象とする場合
        if (this.currentTool === 'move' && e.target === this.canvas && this.targetLayer) {
            this.isMovingLayer = true;
            // 移動開始時のレイヤーの内容をImageDataとして保持
            this.moveLayerImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            // 現在のポインター位置を基準として保存
            const coords = this.getCanvasCoordinates(e);
            this.moveLayerStartX = coords.x;
            this.moveLayerStartY = coords.y;
            e.target.setPointerCapture(e.pointerId);
            return; // 移動ツールの場合、これ以降の描画処理は不要
        }

        if (this.isSpaceDown) {
            this.isPanning = true;
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
            this.setAbsolutePosition();
            e.target.setPointerCapture(e.pointerId);
        } else if (this.currentTool === 'bucket' && this.targetLayer) { // バケツツールの場合
            const coords = this.getCanvasCoordinates(e);
            this.fill(Math.floor(coords.x), Math.floor(coords.y), this.currentColor);
            // バケツツールは単発操作なので、ここで履歴を保存
            this.app.layerManager.saveLayerState(this.targetLayer.id);
            e.target.releasePointerCapture(e.pointerId); // 塗りつぶしは一度のクリックで完結
        } else if (this.targetLayer) { // 通常の描画ツールの場合
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
        // ボタンが押されていない場合は何もしない（誤動作防止）
        if (!e.buttons) {
            if (this.isDrawing || this.isPanning || this.isMovingLayer) {
                this.onPointerUp(e); // 意図せずボタンが離れた場合も処理を終了
            }
            return;
        }

        if (this.isPanning) {
            const deltaX = e.clientX - this.dragStartX;
            const deltaY = e.clientY - this.dragStartY;
            this.canvasContainer.style.left = (this.canvasStartX + deltaX) + 'px';
            this.canvasContainer.style.top = (this.canvasStartY + deltaY) + 'px';
        } else if (this.isMovingLayer && this.targetLayer) {
            const coords = this.getCanvasCoordinates(e);
            const dx = Math.round(coords.x - this.moveLayerStartX);
            const dy = Math.round(coords.y - this.moveLayerStartY);

            // レイヤーのキャンバスをクリアして、ImageDataをオフセットして描画
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            if (this.moveLayerImageData) {
                this.ctx.putImageData(this.moveLayerImageData, dx, dy);
            }
        } else if (this.isDrawing && this.targetLayer) {
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
        if (e.target && !e.target.hasPointerCapture(e.pointerId)) {
            // イベントの発生源がポインタキャプチャを持っていない場合は無視
            return;
        }
        if (e.target) {
            e.target.releasePointerCapture(e.pointerId);
        }


        if (this.isDrawing) {
            this.isDrawing = false;
            this.ctx.closePath();
            // 描画終了時にレイヤーの履歴を保存
            if (this.targetLayer) {
                this.app.layerManager.saveLayerState(this.targetLayer.id);
            }
        }
        if (this.isPanning) {
            this.isPanning = false;
        }
        if (this.isMovingLayer) {
            this.isMovingLayer = false;
            // レイヤー移動終了時にレイヤーの履歴を保存
            if (this.targetLayer) {
                this.app.layerManager.saveLayerState(this.targetLayer.id);
            }
            this.moveLayerImageData = null; // ImageDataをクリア
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
        switch (this.currentTool) {
            case 'move':
                this.canvas.style.cursor = 'move';
                break;
            case 'pen':
            case 'eraser':
            case 'bucket':
            default:
                this.canvas.style.cursor = 'crosshair';
                break;
        }
    }

    // CanvasManagerのsaveState, undo, redoはLayerManagerに委譲
    // CanvasManagerではアクティブなレイヤーの履歴をLayerManager経由で操作する

    saveState() {
        if (this.app.layerManager && this.targetLayer) {
            this.app.layerManager.saveLayerState(this.targetLayer.id);
        }
    }

    undo() {
        if (this.app.layerManager && this.targetLayer) {
            this.app.layerManager.undoLayerState(this.targetLayer.id);
        }
    }

    redo() {
        if (this.app.layerManager && this.targetLayer) {
            this.app.layerManager.redoLayerState(this.targetLayer.id);
        }
    }

    clearCanvas() {
        if (this.targetLayer) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            // 背景レイヤー以外は透明に、背景レイヤーは初期の背景色に
            if (this.targetLayer.id === 'background-layer') {
                this.ctx.fillStyle = '#f0e0d6';
                this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            }
            this.app.layerManager.saveLayerState(this.targetLayer.id);
        }
    }

    flipHorizontal() {
        if (!this.targetLayer) return;
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
        this.app.layerManager.saveLayerState(this.targetLayer.id);
    }

    flipVertical() {
        if (!this.targetLayer) return;
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
        this.app.layerManager.saveLayerState(this.targetLayer.id);
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

    // ヘルパー関数: RGBA値を比較
    colorsMatch(a, b) {
        return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
    }

    // ヘルパー関数: ピクセルのRGBA値を取得
    getPixelColor(imageData, x, y) {
        const i = (y * imageData.width + x) * 4;
        return [imageData.data[i], imageData.data[i + 1], imageData.data[i + 2], imageData.data[i + 3]];
    }

    // ヘルパー関数: ピクセルにRGBA値を設定
    setPixelColor(imageData, x, y, color) {
        const i = (y * imageData.width + x) * 4;
        imageData.data[i] = color[0];
        imageData.data[i + 1] = color[1];
        imageData.data[i + 2] = color[2];
        imageData.data[i + 3] = color[3];
    }

    // バケツツール（塗りつぶし）の実装
    fill(startX, startY, fillColor) {
        if (!this.targetLayer) return;

        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        const imageData = this.ctx.getImageData(0, 0, canvasWidth, canvasHeight);
        const startColor = this.getPixelColor(imageData, startX, startY);

        // fillColorをRGBAに変換
        // tempCtxを使って色をRGBAに変換する、正確なpixeldataを得るため
        const tempCtx = document.createElement('canvas').getContext('2d');
        tempCtx.fillStyle = fillColor;
        tempCtx.fillRect(0, 0, 1, 1);
        const fillRGBA = tempCtx.getImageData(0, 0, 1, 1).data;
        const targetFillColor = [fillRGBA[0], fillRGBA[1], fillRGBA[2], fillRGBA[3]];

        // 塗りつぶし色が開始色と同じ場合は何もしない
        if (this.colorsMatch(startColor, targetFillColor)) {
            return;
        }

        const stack = [[startX, startY]];

        while (stack.length > 0) {
            const [x, y] = stack.pop();

            // 範囲チェック
            if (x < 0 || x >= canvasWidth || y < 0 || y >= canvasHeight) {
                continue;
            }

            const currentColor = this.getPixelColor(imageData, x, y);

            // 開始色と同じで、かつまだ塗りつぶされていないピクセルのみ処理
            if (this.colorsMatch(currentColor, startColor)) {
                this.setPixelColor(imageData, x, y, targetFillColor);

                // 4方向の隣接ピクセルをスタックに追加
                stack.push([x + 1, y]);
                stack.push([x - 1, y]);
                stack.push([x, y + 1]);
                stack.push([x, y - 1]);
            }
        }
        this.ctx.putImageData(imageData, 0, 0);
    }
}
