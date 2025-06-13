// CanvasManager.js (レイヤー移動機能 改修版)
class CanvasManager {
    constructor(app) {
        this.app = app;
        this.canvasArea = document.getElementById('canvas-area');
        this.canvasContainer = document.getElementById('canvas-container');
        
        // LayerManagerによって動的に差し替えられる
        this.activeCanvas = document.getElementById('drawingCanvas');
        this.activeCtx = this.activeCanvas.getContext('2d');

        this.isDrawing = false;
        this.isPanning = false;
        this.isMovingLayer = false; // レイヤー移動フラグ
        this.isSpaceDown = false;

        this.currentTool = 'pen';
        this.currentColor = '#800000';
        this.currentSize = 1;

        this.lastX = 0; this.lastY = 0;
        this.history = []; this.historyIndex = -1;
        
        // ドラッグ開始時の座標
        this.dragStartX = 0; this.dragStartY = 0;
        
        // パン操作時のコンテナ開始位置
        this.canvasStartX = 0; this.canvasStartY = 0;
        
        // レイヤー移動時のレイヤー開始位置
        this.layerStartX = 0; this.layerStartY = 0;
        
        this.scale = 1; this.rotation = 0;

        this.initCanvas();
        this.bindEvents();
    }
    
    initCanvas() {
        // 初期化処理はLayerManager側で行うため、ここでは何もしない
        // もしToshinkaTegakiToolから直接呼ばれるなら残す
    }
    
    bindEvents() {
        // イベントリスナはコンテナやドキュメントに設定し、動的なキャンバスに対応
        this.canvasContainer.addEventListener('pointerdown', this.onPointerDown.bind(this));
        document.addEventListener('pointermove', this.onPointerMove.bind(this));
        document.addEventListener('pointerup', this.onPointerUp.bind(this));
        this.canvasArea.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
    }

    // LayerManagerから呼び出されることを想定
    setActiveCanvas(canvas) {
        this.activeCanvas = canvas;
        this.activeCtx = canvas.getContext('2d');
        // undo/redo履歴はレイヤーごとに管理する必要がある（将来的な課題）
        // 現状は全レイヤーで履歴を共有している
    }

    setCurrentTool(tool) { this.currentTool = tool; }
    setCurrentColor(color) { this.currentColor = color; }
    setCurrentSize(size) { this.currentSize = size; }

    onPointerDown(e) {
        // ターゲットがレイヤーキャンバスでなければ何もしない
        if (!e.target.classList.contains('layer-canvas')) return;

        // LayerManagerがアクティブキャンバスを更新しているので、それを信頼する
        this.activeCanvas = this.app.canvas;
        this.activeCtx = this.app.ctx;

        e.target.setPointerCapture(e.pointerId);
        
        const coords = this.getCanvasCoordinates(e);
        this.lastX = coords.x;
        this.lastY = coords.y;
        
        // ★改修点①: レイヤー移動ツールの処理を追加
        if (this.currentTool === 'move' && !this.isSpaceDown) {
            this.isMovingLayer = true;
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
            // styleが設定されていない場合も考慮して || 0 をつける
            this.layerStartX = parseFloat(this.activeCanvas.style.left) || 0;
            this.layerStartY = parseFloat(this.activeCanvas.style.top) || 0;
            return; // 他の処理は行わない
        }

        if (this.isSpaceDown) {
            this.isPanning = true;
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
            this.setAbsolutePosition();
        } else if (this.currentTool === 'bucket') {
            // 背景レイヤーでは塗りつぶしを無効にするなどの考慮が必要かもしれない
            this.fill(Math.floor(this.lastX), Math.floor(this.lastY), this.currentColor);
            this.saveState();
        } else if (this.currentTool === 'pen' || this.currentTool === 'eraser') {
            this.isDrawing = true;
            this.activeCtx.beginPath();
            this.activeCtx.moveTo(this.lastX, this.lastY);
        }
    }

    onPointerMove(e) {
        if (!e.buttons) {
            if (this.isDrawing || this.isPanning || this.isMovingLayer) this.onPointerUp(e);
            return;
        }

        // ★改修点②: レイヤー移動中の処理を追加
        if (this.isMovingLayer) {
            const deltaX = e.clientX - this.dragStartX;
            const deltaY = e.clientY - this.dragStartY;
            this.activeCanvas.style.left = (this.layerStartX + deltaX) + 'px';
            this.activeCanvas.style.top = (this.layerStartY + deltaY) + 'px';
            return; // 他の処理は行わない
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
        
        // ★改修点③: レイヤー移動終了の処理を追加
        if (this.isMovingLayer) {
            this.isMovingLayer = false;
        }

        if (this.isDrawing) {
            this.isDrawing = false;
            this.activeCtx.closePath();
            // LayerManager側でUndo/Redoが実装されるまでは、ここで保存する
            // this.app.historyManager.saveState(this.activeCanvas);
            this.saveState(); // 現状の仮実装
        }
        if (this.isPanning) this.isPanning = false;
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
        const rect = this.activeCanvas.getBoundingClientRect();
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;

        // ズーム・回転の中心はキャンバス自身の中心
        const centerX = this.activeCanvas.width / 2;
        const centerY = this.activeCanvas.height / 2;
        
        // 座標を中心に移動
        x -= centerX;
        y -= centerY;

        // 逆回転
        const rad = -this.rotation * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const rotatedX = x * cos - y * sin;
        const rotatedY = x * sin + y * cos;
        
        // 逆スケーリングして元の座標系に戻す
        const finalX = (rotatedX / this.scale) + centerX;
        const finalY = (rotatedY / this.scale) + centerY;

        return { x: finalX, y: finalY };
    }

    updateCursor() {
        // ★改修点④: カーソルの見た目をツールに応じて変更
        let cursor = 'crosshair'; // デフォルトはペン
        if (this.isSpaceDown) {
            cursor = 'grab';
        } else {
            switch(this.currentTool) {
                case 'move':
                    cursor = 'move';
                    break;
                case 'bucket':
                    cursor = 'pointer'; // バケツはポインターの方が分かりやすいかも
                    break;
                case 'pen':
                case 'eraser':
                default:
                    cursor = 'crosshair';
                    break;
            }
        }
        // 全てのレイヤーキャンバスにカーソルを適用
        document.querySelectorAll('.layer-canvas').forEach(canvas => {
            canvas.style.cursor = cursor;
        });
    }
    
    // このあたりの履歴管理や描画操作は、LayerManager実装後は
    // アクティブなレイヤーに対して行われるように修正が必要
    saveState() {
        // 警告: 現在の履歴管理は単一キャンバス用です。
        // LayerManagerの履歴管理機能が実装されるまでの暫定的な動作です。
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
        // 現在のアクティブレイヤーのみをクリアする
        this.activeCtx.clearRect(0, 0, this.activeCanvas.width, this.activeCanvas.height);
        this.saveState();
    }
    
    flipHorizontal() {
        const tempCanvas = document.createElement('canvas'); const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = this.activeCanvas.width; tempCanvas.height = this.activeCanvas.height;
        tempCtx.translate(tempCanvas.width, 0); tempCtx.scale(-1, 1);
        tempCtx.drawImage(this.activeCanvas, 0, 0);
        this.activeCtx.clearRect(0, 0, this.activeCanvas.width, this.activeCanvas.height);
        this.activeCtx.drawImage(tempCanvas, 0, 0); this.saveState();
    }
    
    flipVertical() {
        const tempCanvas = document.createElement('canvas'); const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = this.activeCanvas.width; tempCanvas.height = this.activeCanvas.height;
        tempCtx.translate(0, tempCanvas.height); tempCtx.scale(1, -1);
        tempCtx.drawImage(this.activeCanvas, 0, 0);
        this.activeCtx.clearRect(0, 0, this.activeCanvas.width, this.activeCanvas.height);
        this.activeCtx.drawImage(tempCanvas, 0, 0); this.saveState();
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
        // この処理はコンテナ全体に適用される
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
            this.rotate(delta * 5); // 少し感度を落としました
        } else {
            this.zoom(delta > 0 ? 1.1 : 1 / 1.1);
        }
    }
    
    // バケツツールのロジック（変更なし）
    fill(startX, startY, fillColor) {
        // (略: このメソッドの中身は変更ありません)
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
    }
    colorsMatch(a, b) { return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3]; }
    getPixelColor(imageData, x, y) { const i = (y * imageData.width + x) * 4; return [imageData.data[i], imageData.data[i + 1], imageData.data[i + 2], imageData.data[i + 3]]; }
    setPixelColor(imageData, x, y, color) { const i = (y * imageData.width + x) * 4; imageData.data[i] = color[0]; imageData.data[i+1] = color[1]; imageData.data[i+2] = color[2]; imageData.data[i+3] = color[3]; }
}