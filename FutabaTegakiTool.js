// このコードはHTMLファイル内の<script>タグに記述されている想定です。

class FutabaTegakiTool {
    constructor() {
        this.canvas = document.getElementById('drawingCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvasArea = document.getElementById('canvas-area');
        this.canvasContainer = document.getElementById('canvas-container');
        
        this.isDrawing = false;
        this.isPanning = false;
        this.isMovingLayer = false;
        this.isSpaceDown = false;

        this.currentTool = 'pen';
        this.mainColor = '#800000'; // 初期メインカラー
        this.subColor = '#f0e0d6';  // 初期サブカラー
        this.currentColor = this.mainColor; // 現在の描画色をメインカラーに設定
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
        
        this.scale = 1;
        this.rotation = 0;

        this.sizes = Array.from(document.querySelectorAll('.size-btn')).map(btn => parseInt(btn.dataset.size));
        this.colors = Array.from(document.querySelectorAll('.color-btn')).map(btn => btn.dataset.color);
        this.currentSizeIndex = this.sizes.indexOf(this.currentSize);
        this.currentColorIndex = this.colors.indexOf(this.currentColor); // メインカラーのインデックスを設定

        this.mainColorDisplay = document.getElementById('main-color-display');
        this.subColorDisplay = document.getElementById('sub-color-display');
        
        this.initCanvas();
        this.bindEvents();
        this.saveState();
        this.updateColorDisplays(); // メイン/サブカラー表示を初期化
        // 初期のアクティブカラーボタンをメインカラーに設定
        document.querySelectorAll('.color-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-color="${this.mainColor}"]`)?.classList.add('active');
        this.updateSizeButtonVisuals(); // サイズボタンの初期表示を更新

        // ★ レイヤーマネージャーを初期化 (この行を追加)
        // LayerManager.jsがロードされていることが前提
        if (typeof LayerManager !== 'undefined') {
            this.layerManager = new LayerManager(this);
        } else {
            console.error('LayerManager is not defined. Make sure LayerManager.js is loaded.');
        }
    }
    
    initCanvas() {
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        // 初期化時の塗りつぶしはLayerManagerに任せるため、ここでは実行しないか、
        // もしLayerManagerがない場合のフォールバックとして残す。
        // LayerManager側で背景レイヤーを生成するため、この処理は実質的に不要になる。
        if (!this.layerManager) {
             this.ctx.fillStyle = '#f0e0d6';
             this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }
    
    bindEvents() {
        // ポインタイベント
        // canvasContainerでイベントをリッスンすることで、
        // どのレイヤー(canvas)上でもイベントを捕捉できるようにする
        this.canvasContainer.addEventListener('pointerdown', this.onPointerDown.bind(this));
        document.addEventListener('pointermove', this.onPointerMove.bind(this));
        document.addEventListener('pointerup', this.onPointerUp.bind(this));
        
        // キーボードとマウスホイール
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));
        this.canvasArea.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });

        this.bindButtonEvents();
    }

    bindButtonEvents() {
        // ボタンのイベントは 'click' で統一
        document.getElementById('pen-tool').addEventListener('click', () => this.setTool('pen'));
        document.getElementById('eraser-tool').addEventListener('click', () => this.setTool('eraser'));
        document.getElementById('bucket-tool').addEventListener('click', () => this.setTool('bucket'));
        document.getElementById('move-tool').addEventListener('click', () => this.setTool('move'));
        document.querySelectorAll('.size-btn').forEach(btn => btn.addEventListener('click', () => this.setSize(parseInt(btn.dataset.size))));
        document.querySelectorAll('.color-btn').forEach(btn => btn.addEventListener('click', (e) => this.setColor(e.currentTarget.dataset.color)));
        document.getElementById('undo-btn').addEventListener('click', () => this.undo());
        document.getElementById('redo-btn').addEventListener('click', () => this.redo());
        document.getElementById('clear-btn').addEventListener('click', () => this.clearCanvas());
        document.getElementById('close-btn').addEventListener('click', () => this.closeTool());
        document.getElementById('flip-h-btn').addEventListener('click', () => this.flipHorizontal());
        document.getElementById('flip-v-btn').addEventListener('click', () => this.flipVertical());
        document.getElementById('zoom-in-btn').addEventListener('click', () => this.zoom(1.2));
        document.getElementById('zoom-out-btn').addEventListener('click', () => this.zoom(1 / 1.2));
        document.getElementById('rotate-btn').addEventListener('click', () => this.rotate(15));
        document.getElementById('rotate-ccw-btn').addEventListener('click', () => this.rotate(-15));
        document.getElementById('reset-view-btn').addEventListener('click', () => this.resetView());
        document.querySelector('.color-mode-display').addEventListener('click', () => this.swapColors());
    }

    onPointerDown(e) {
        // イベントのターゲットがレイヤーのキャンバスであることを確認
        if (!e.target.classList.contains('layer-canvas')) return;
        
        // LayerManagerがアクティブなキャンバスとコンテキストを管理しているため、
        // this.canvasとthis.ctxは常に正しいものを指している
        const coords = this.getCanvasCoordinates(e);
        this.lastX = coords.x;
        this.lastY = coords.y;

        if (this.isSpaceDown) {
            this.isPanning = true;
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
            this.setAbsolutePosition();
            // ポインタキャプチャのターゲットはイベントが発生した具体的なcanvas要素
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
            // 塗りつぶしは一度のクリックで完結するため、キャプチャは不要
        }
        else {
            this.isDrawing = true;
            this.ctx.beginPath();
            this.ctx.moveTo(this.lastX, this.lastY);
            e.target.setPointerCapture(e.pointerId);
        }
    }

    onPointerMove(e) {
        if (!e.buttons) {
            // isDrawingなどのフラグがtrueのままになるのを防ぐ
            if(this.isDrawing || this.isPanning || this.isMovingLayer) {
                this.onPointerUp(e);
            }
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
            // レイヤー移動時の背景色は、LayerManagerで管理されている背景レイヤーの色に依存する
            // ここでは元のコードの動作を維持
            const bgColor = this.layerManager?.layers.find(l => l.name === '背景')?.ctx.fillStyle || '#f0e0d6';
            this.ctx.fillStyle = bgColor;
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
        // hasPointerCaptureはdocumentに対しては使えないため、フラグで管理
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
        // ポインタキャプチャを解放する（念のため）
        // document.releasePointerCapture(e.pointerId); はエラーになることがあるので注意
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
        // this.canvasはアクティブレイヤーのcanvasを指す
        const rect = this.canvas.getBoundingClientRect();
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;

        // 回転・拡縮を考慮した座標計算
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
    
    setTool(tool) {
        this.currentTool = tool;
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        const toolButton = document.getElementById(tool + '-tool');
        if(toolButton) toolButton.classList.add('active');
        this.updateCursor();
    }

    updateCursor() {
        // spaceキーが押されている場合はgrabカーソルを優先
        if (this.isSpaceDown) {
            this.canvasContainer.style.cursor = 'grab';
            return;
        }
        let cursorStyle = 'crosshair';
        switch(this.currentTool) {
            case 'move': cursorStyle = 'move'; break;
            case 'pen':
            case 'eraser':
            case 'bucket':
            default: cursorStyle = 'crosshair'; break;
        }
        // canvasContainerにカーソルを設定することで、
        // 下のレイヤーにマウスカーソルが乗ってもカーソルが変わらないようにする
        this.canvasContainer.style.cursor = cursorStyle;
    }
    
    setSize(size) {
        this.currentSize = size;
        this.currentSizeIndex = this.sizes.indexOf(this.currentSize);
        document.querySelectorAll('.size-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-size="${size}"]`)?.classList.add('active');
        this.updateSizeButtonVisuals();
    }

    updateSizeButtonVisuals() {
        document.querySelectorAll('.size-btn').forEach(btn => {
            const size = parseInt(btn.dataset.size);
            const sizeDot = btn.querySelector('.size-dot');
            const sizeNumber = btn.querySelector('.size-number');
            
            if (sizeDot) {
                const dotSize = Math.min(size, 16); 
                sizeDot.style.width = `${dotSize}px`;
                sizeDot.style.height = `${dotSize}px`;
            }
            if (sizeNumber) {
                sizeNumber.textContent = size;
            }
        });
    }
    
    setColor(color) {
        this.mainColor = color;
        this.currentColor = this.mainColor;
        this.currentColorIndex = this.colors.indexOf(this.mainColor);
        document.querySelectorAll('.color-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-color="${color}"]`)?.classList.add('active');
        this.updateColorDisplays();
    }

    updateColorDisplays() {
        this.mainColorDisplay.style.backgroundColor = this.mainColor;
        this.subColorDisplay.style.backgroundColor = this.subColor;
    }

    swapColors() {
        [this.mainColor, this.subColor] = [this.subColor, this.mainColor];
        this.currentColor = this.mainColor;
        this.updateColorDisplays();
        document.querySelectorAll('.color-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-color="${this.mainColor}"]`)?.classList.add('active');
    }

    resetColors() {
        this.mainColor = '#800000';
        this.subColor = '#f0e0d6';
        this.currentColor = this.mainColor;
        this.updateColorDisplays();
        document.querySelectorAll('.color-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-color="${this.mainColor}"]`)?.classList.add('active');
    }
    
    // undo/redoとsaveStateはアクティブレイヤーに対してのみ機能する
    // TODO: レイヤーに対応したヒストリー管理
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
    
    // clearCanvasはアクティブレイヤーのみを消去する
    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.saveState();
    }
    
    // flip/rotateもアクティブレイヤーに対してのみ機能する
    flipHorizontal() {
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
    
    // zoom/rotateはcanvasContainer全体に適用される
    zoom(factor) {
        const newScale = this.scale * factor;
        this.scale = Math.max(0.1, Math.min(newScale, 10));
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
    
    closeTool() { 
        // 閉じる処理 (実装は省略)
    }

    // ヘルパー関数 (元のコードから流用)
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

        if (this.colorsMatch(startColor, targetFillColor)) {
            return;
        }

        const stack = [[startX, startY]];

        while (stack.length > 0) {
            const [x, y] = stack.pop();

            if (x < 0 || x >= canvasWidth || y < 0 || y >= canvasHeight) {
                continue;
            }

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
    
    // キーボードイベントハンドラ (元のコードから流用)
    handleKeyDown(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.repeat) return;
        
        if (e.key === ' ' && !this.isSpaceDown) {
            this.isSpaceDown = true;
            this.updateCursor();
            e.preventDefault();
        }

        if (this.isSpaceDown) {
            let handled = true;
            const moveAmount = 10;
            switch(e.key) {
                case 'ArrowUp': this.setAbsolutePosition(); this.canvasContainer.style.top = (parseFloat(this.canvasContainer.style.top) - moveAmount) + 'px'; break;
                case 'ArrowDown': this.setAbsolutePosition(); this.canvasContainer.style.top = (parseFloat(this.canvasContainer.style.top) + moveAmount) + 'px'; break;
                case 'ArrowLeft': this.setAbsolutePosition(); this.canvasContainer.style.left = (parseFloat(this.canvasContainer.style.left) - moveAmount) + 'px'; break;
                case 'ArrowRight': this.setAbsolutePosition(); this.canvasContainer.style.left = (parseFloat(this.canvasContainer.style.left) + moveAmount) + 'px'; break;
                default: handled = false;
            }
            if(handled) e.preventDefault();
            return;
        }
        
        let handled = true;
        if (e.ctrlKey) {
            switch (e.key.toLowerCase()) {
                case 'z': this.undo(); break;
                case 'y': this.redo(); break;
                default: handled = false;
            }
        } else if (e.shiftKey) {
            switch (e.key) {
                case '}': this.changeColor(true); break;
                case '{': this.changeColor(false); break;
                default:
                    switch (e.key.toLowerCase()) {
                        case 'h': this.flipVertical(); break;
                        case 'arrowup': this.zoom(1.20); break;
                        case 'arrowdown': this.zoom(1 / 1.20); break;
                        case 'arrowleft': this.rotate(-15); break;
                        case 'arrowright': this.rotate(15); break;
                        default: handled = false;
                    }
            }
        } else {
             switch (e.key.toLowerCase()) {
                case '[': this.changeSize(false); break;
                case ']': this.changeSize(true); break;
                case 'x': this.swapColors(); break;
                case 'd': this.resetColors(); break;
                case 'g': this.setTool('bucket'); break;
                default:
                    switch (e.key.toLowerCase()) {
                        case 'p': this.setTool('pen'); break;
                        case 'e': this.setTool('eraser'); break;
                        case 'v': this.setTool('move'); break;
                        case 'h': this.flipHorizontal(); break;
                        case '1': this.resetView(); break;
                        case 'arrowup': this.zoom(1.05); break;
                        case 'arrowdown': this.zoom(1 / 1.05); break;
                        case 'arrowleft': this.rotate(-5); break;
                        case 'arrowright': this.rotate(5); break;
                        default: handled = false;
                    }
            }
        }
        if (handled) e.preventDefault();
    }

    handleKeyUp(e) {
        if (e.key === ' ') {
            this.isSpaceDown = false;
            this.updateCursor();
            e.preventDefault();
        }
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

    changeSize(increase) {
        let newIndex = this.currentSizeIndex + (increase ? 1 : -1);
        newIndex = Math.max(0, Math.min(newIndex, this.sizes.length - 1));
        this.setSize(this.sizes[newIndex]);
    }

    changeColor(increase) {
         let newIndex = this.currentColorIndex + (increase ? 1 : -1);
         newIndex = Math.max(0, Math.min(newIndex, this.colors.length - 1));
         this.setColor(this.colors[newIndex]);
    }
}
