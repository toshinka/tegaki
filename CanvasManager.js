// CanvasManager.js
class CanvasManager {
    constructor(app) {
        this.app = app;
        this.canvas = document.getElementById('drawingCanvas');
        this.ctx = this.canvas.getContext('2d'); // 初期コンテキストはdrawingCanvasのもの
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
        // 初期状態のキャンバスを透明にする
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    bindEvents() {
        this.canvasContainer.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvasContainer.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvasContainer.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvasContainer.addEventListener('mouseleave', this.handleMouseUp.bind(this));
        this.canvasContainer.addEventListener('wheel', this.handleMouseWheel.bind(this));

        // Spaceキーが押されている間はパニングモード
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));
    }

    /**
     * CanvasManagerが描画に使用するコンテキストを設定する
     * LayerManagerから現在アクティブなレイヤーのコンテキストを受け取るために使用
     * @param {CanvasRenderingContext2D} newCtx 新しい描画コンテキスト
     */
    setContext(newCtx) {
        this.ctx = newCtx;
        // 新しいコンテキストに対しても描画スタイルを設定
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        // カーソルも更新しておく
        this.updateCursor();
    }

    setCurrentTool(tool) {
        this.currentTool = tool;
        this.updateCursor();
    }

    setCurrentColor(color) {
        this.currentColor = color;
    }

    setCurrentSize(size) {
        this.currentSize = size;
    }

    updateCursor() {
        if (this.isSpaceDown) {
            this.canvasContainer.style.cursor = 'grab';
        } else if (this.currentTool === 'pen') {
            this.canvasContainer.style.cursor = 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\'><circle cx=\'12\' cy=\'12\' r=\'${this.currentSize / this.scale / 2}\' fill=\'black\' stroke=\'white\' stroke-width=\'1\'/></svg>") ${12} ${12}, auto';
        } else if (this.currentTool === 'eraser') {
            this.canvasContainer.style.cursor = 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\'><rect x=\'${12 - this.currentSize / this.scale / 2}\' y=\'${12 - this.currentSize / this.scale / 2}\' width=\'${this.currentSize / this.scale}\' height=\'${this.currentSize / this.scale}\' fill=\'none\' stroke=\'black\' stroke-width=\'1\'/></svg>") ${12} ${12}, auto';
        } else if (this.currentTool === 'move') {
            this.canvasContainer.style.cursor = 'move';
        } else if (this.currentTool === 'bucket') {
            this.canvasContainer.style.cursor = 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\'><path d=\'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h2v-6h-2v6zm0-8h2V7h-2v2z\' fill=\'black\'/></svg>") ${12} ${12}, auto'; // 塗りつぶしアイコンの例
        } else {
            this.canvasContainer.style.cursor = 'auto';
        }
    }


    handleMouseDown(e) {
        const { offsetX, offsetY } = this.getTransformedCoords(e.offsetX, e.offsetY);
        this.lastX = offsetX;
        this.lastY = offsetY;

        if (this.isSpaceDown || e.button === 1) { // Middle mouse button for panning
            this.isPanning = true;
            this.canvasStartX = this.canvasContainer.offsetLeft;
            this.canvasStartY = this.canvasContainer.offsetTop;
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
            this.canvasContainer.style.cursor = 'grabbing';
            return;
        }

        if (this.currentTool === 'move') {
            this.isMovingLayer = true;
            // アクティブなレイヤーのImageDataを一時保存
            const activeLayer = this.app.layerManager.getCurrentLayer();
            if (activeLayer) {
                this.moveLayerImageData = activeLayer.ctx.getImageData(0, 0, activeLayer.canvas.width, activeLayer.canvas.height);
                this.moveLayerStartX = e.clientX;
                this.moveLayerStartY = e.clientY;
            }
            return;
        }

        this.isDrawing = true;
        if (this.currentTool === 'bucket') {
            const activeLayer = this.app.layerManager.getCurrentLayer();
            if (activeLayer) {
                this.fill(offsetX, offsetY, this.app.colorManager.getCurrentMainColor());
                this.saveState();
            }
        } else {
            // draw()内でctx.beginPath()とctx.moveTo()を呼び出すため、ここでは不要
        }
    }

    handleMouseMove(e) {
        const { offsetX, offsetY } = this.getTransformedCoords(e.offsetX, e.offsetY);

        if (this.isPanning) {
            const dx = e.clientX - this.dragStartX;
            const dy = e.clientY - this.dragStartY;
            // 親コンテナの位置を調整
            this.canvasContainer.style.left = `${this.canvasStartX + dx}px`;
            this.canvasContainer.style.top = `${this.canvasStartY + dy}px`;
            return;
        }

        if (this.isMovingLayer) {
            const activeLayer = this.app.layerManager.getCurrentLayer();
            if (activeLayer && this.moveLayerImageData) {
                const dx = e.clientX - this.moveLayerStartX;
                const dy = e.clientY - this.moveLayerStartY;

                // レイヤーのコンテキストをクリアしてから再描画
                activeLayer.ctx.clearRect(0, 0, activeLayer.canvas.width, activeLayer.canvas.height);
                activeLayer.ctx.putImageData(this.moveLayerImageData, dx, dy);
            }
            return;
        }

        if (!this.isDrawing) return;

        this.draw(offsetX, offsetY);
        this.lastX = offsetX;
        this.lastY = offsetY;
    }

    handleMouseUp(e) {
        if (this.isDrawing) {
            this.saveState();
        }
        if (this.isMovingLayer) {
            this.saveState(); // レイヤー移動後の状態も履歴に保存
            this.moveLayerImageData = null;
        }
        this.isDrawing = false;
        this.isPanning = false;
        this.isMovingLayer = false;
        this.canvasContainer.style.cursor = this.isSpaceDown ? 'grab' : 'auto'; // Spaceキーが押されていればgrabに戻す
        this.updateCursor(); // カーソルを更新
    }

    handleMouseWheel(e) {
        e.preventDefault(); // スクロールイベントをキャンセル

        const scaleAmount = e.deltaY > 0 ? 1 / 1.1 : 1.1; // ホイールの方向でズームイン/アウト
        this.zoom(scaleAmount, e.clientX, e.clientY);
    }

    handleKeyDown(e) {
        if (e.key === ' ') {
            if (!this.isSpaceDown) { // 既にSpaceが押されていなければ
                this.isSpaceDown = true;
                this.updateCursor();
                e.preventDefault(); // ページのスクロールを防ぐ
            }
        }
        // 他のショートカットはToshinkaTegakiTool.jsで管理
    }

    handleKeyUp(e) {
        if (e.key === ' ') {
            this.isSpaceDown = false;
            this.updateCursor();
            e.preventDefault();
        }
    }


    /**
     * 描画処理
     * 現在アクティブなレイヤーのコンテキストに対して描画を行う
     * @param {number} x 現在のマウスX座標
     * @param {number} y 現在のマウスY座標
     */
    draw(x, y) {
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer || !activeLayer.ctx) {
            console.warn('アクティブなレイヤーが見つからないか、コンテキストがありません。');
            return;
        }
        const ctxToDraw = activeLayer.ctx;

        ctxToDraw.beginPath();
        ctxToDraw.moveTo(this.lastX, this.lastY);
        ctxToDraw.lineTo(x, y);

        if (this.currentTool === 'pen') {
            ctxToDraw.strokeStyle = this.currentColor;
            ctxToDraw.lineWidth = this.currentSize;
            ctxToDraw.globalCompositeOperation = 'source-over'; // 通常描画
        } else if (this.currentTool === 'eraser') {
            ctxToDraw.strokeStyle = '#FFFFFF'; // 消しゴムは白で塗りつぶす（背景が透明の場合）
            ctxToDraw.lineWidth = this.currentSize;
            ctxToDraw.globalCompositeOperation = 'destination-out'; // 既存のピクセルを透明にする
        }
        ctxToDraw.stroke();
    }

    /**
     * バケツツール（塗りつぶし）の実装
     * @param {number} startX 開始X座標
     * @param {number} startY 開始Y座標
     * @param {string} fillColor 塗りつぶし色 (例: '#RRGGBB' または 'rgba(R,G,B,A)')
     */
    fill(startX, startY, fillColor) {
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer || !activeLayer.ctx) {
            console.warn('アクティブなレイヤーが見つからないか、コンテキストがありません。');
            return;
        }
        const canvas = activeLayer.canvas;
        const ctx = activeLayer.ctx;

        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
        
        const startColor = this.getPixelColor(imageData, startX, startY);
        
        // fillColorをRGBA配列に変換
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
        ctx.putImageData(imageData, 0, 0);
    }

    getPixelColor(imageData, x, y) {
        const index = (y * imageData.width + x) * 4;
        return [
            imageData.data[index],
            imageData.data[index + 1],
            imageData.data[index + 2],
            imageData.data[index + 3]
        ];
    }

    setPixelColor(imageData, x, y, color) {
        const index = (y * imageData.width + x) * 4;
        imageData.data[index] = color[0];
        imageData.data[index + 1] = color[1];
        imageData.data[index + 2] = color[2];
        imageData.data[index + 3] = color[3];
    }

    colorsMatch(color1, color2) {
        return color1[0] === color2[0] &&
               color1[1] === color2[1] &&
               color1[2] === color2[2] &&
               color1[3] === color2[3];
    }

    /**
     * 現在のキャンバスの状態を履歴に保存する
     * レイヤー対応のため、アクティブなレイヤーのImageDataを保存するように変更
     */
    saveState() {
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer) return;

        // 現在のhistoryIndex以降の履歴を削除（redoを無効にするため）
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        
        // アクティブレイヤーの現在のImageDataを保存
        activeLayer.imageData = activeLayer.ctx.getImageData(0, 0, activeLayer.canvas.width, activeLayer.canvas.height);
        this.history.push({
            layerId: activeLayer.id,
            imageData: activeLayer.imageData
        });
        this.historyIndex++;
        
        // 履歴が大きくなりすぎないように古いものを削除（任意）
        if (this.history.length > 20) {
            this.history.shift();
            this.historyIndex--;
        }
        console.log("履歴を保存しました。現在の履歴数:", this.history.length, "インデックス:", this.historyIndex);
    }

    /**
     * 1つ前の状態に戻す (Undo)
     * レイヤー対応のため、対象レイヤーのImageDataを復元するように変更
     */
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            const previousState = this.history[this.historyIndex];
            const targetLayer = this.app.layerManager.layers.find(l => l.id === previousState.layerId);
            if (targetLayer && previousState.imageData) {
                targetLayer.ctx.putImageData(previousState.imageData, 0, 0);
            } else {
                 console.warn("Undo: ターゲットレイヤーまたはイメージデータが見つかりません。");
            }
            this.renderAllLayers(); // 全レイヤーを再描画
            console.log("Undo実行。現在の履歴数:", this.history.length, "インデックス:", this.historyIndex);
        } else {
            console.log("これ以上Undoできません。");
        }
    }

    /**
     * 1つ先の状態に進む (Redo)
     * レイヤー対応のため、対象レイヤーのImageDataを復元するように変更
     */
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            const nextState = this.history[this.historyIndex];
            const targetLayer = this.app.layerManager.layers.find(l => l.id === nextState.layerId);
            if (targetLayer && nextState.imageData) {
                targetLayer.ctx.putImageData(nextState.imageData, 0, 0);
            } else {
                console.warn("Redo: ターゲットレイヤーまたはイメージデータが見つかりません。");
            }
            this.renderAllLayers(); // 全レイヤーを再描画
            console.log("Redo実行。現在の履歴数:", this.history.length, "インデックス:", this.historyIndex);
        } else {
            console.log("これ以上Redoできません。");
        }
    }

    clearCanvas() {
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (activeLayer) {
            activeLayer.ctx.clearRect(0, 0, activeLayer.canvas.width, activeLayer.canvas.height);
            this.saveState();
        }
    }

    flipHorizontal() {
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer) return;

        const { canvas, ctx } = activeLayer;
        ctx.save(); // 現在の状態を保存
        ctx.translate(canvas.width, 0); // x軸のオフセットをキャンバスの幅にする
        ctx.scale(-1, 1); // x軸を反転
        ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height); // キャンバス全体を描画
        ctx.restore(); // 保存した状態に戻す
        this.saveState();
    }

    flipVertical() {
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer) return;

        const { canvas, ctx } = activeLayer;
        ctx.save();
        ctx.translate(0, canvas.height); // y軸のオフセットをキャンバスの高さにする
        ctx.scale(1, -1); // y軸を反転
        ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height);
        ctx.restore();
        this.saveState();
    }

    zoom(scaleFactor, mouseX, mouseY) {
        const containerRect = this.canvasContainer.getBoundingClientRect();
        const containerX = containerRect.left;
        const containerY = containerRect.top;

        // マウス位置のキャンバス内座標
        const mouseCanvasX = (mouseX - containerX - this.canvasContainer.offsetLeft);
        const mouseCanvasY = (mouseY - containerY - this.canvasContainer.offsetTop);

        // ズーム前のスケールされた座標
        const oldScaledX = mouseCanvasX / this.scale;
        const oldScaledY = mouseCanvasY / this.scale;

        this.scale *= scaleFactor;
        
        // ズーム後のスケールされた座標
        const newScaledX = mouseCanvasX / this.scale;
        const newScaledY = mouseCanvasY / this.scale;

        // コンテナのオフセットを調整して、マウス位置を固定する
        this.canvasContainer.style.left = `${this.canvasContainer.offsetLeft - (oldScaledX - newScaledX) * this.scale}px`;
        this.canvasContainer.style.top = `${this.canvasContainer.offsetTop - (oldScaledY - newScaledY) * this.scale}px`;

        this.applyTransform();
    }

    rotate(angle) {
        this.rotation = (this.rotation + angle) % 360;
        this.applyTransform();
    }

    resetView() {
        this.scale = 1;
        this.rotation = 0;
        this.canvasContainer.style.left = '0px';
        this.canvasContainer.style.top = '0px';
        this.applyTransform();
    }

    applyTransform() {
        const transform = `scale(${this.scale}) rotate(${this.rotation}deg)`;
        this.canvasContainer.style.transform = transform;
        this.canvasContainer.style.transformOrigin = '0 0'; // 左上を原点にする
        this.updateCursor(); // スケールが変更されたらカーソルも更新
    }

    // マウスイベントの座標を現在のスケールと回転を考慮して変換
    getTransformedCoords(originalX, originalY) {
        // コンテナのスタイルから現在のオフセットを取得
        const containerLeft = parseFloat(this.canvasContainer.style.left || '0');
        const containerTop = parseFloat(this.canvasContainer.style.top || '0');

        // イベントのoffsetX/Yは、親要素からの相対座標なので、コンテナのオフセットを考慮
        // さらに、ズームと回転が適用されているため、逆変換を行う必要がある

        // まず、コンテナ内部でのクリック位置（ズーム・回転が適用された状態）
        const relativeX = originalX - containerLeft;
        const relativeY = originalY - containerTop;

        // 回転の逆変換
        const rad = -this.rotation * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        // 原点をキャンバスの中心に移動してから回転、その後元に戻す
        // 現状は transform-origin: 0 0; なので、原点移動は不要
        const rotatedX = relativeX * cos - relativeY * sin;
        const rotatedY = relativeX * sin + relativeY * cos;

        // スケールの逆変換
        const transformedX = rotatedX / this.scale;
        const transformedY = rotatedY / this.scale;
        
        return { offsetX: transformedX, offsetY: transformedY };
    }

    /**
     * 全てのレイヤーを再描画する
     * レイヤーの可視性や順序が変更された際に呼び出す
     */
    renderAllLayers() {
        // 各レイヤーのcanvas要素の表示状態を更新する
        // LayerManagerがz-indexとdisplayプロパティを管理しているので、ここでは明示的に描画はしない
        // 主にLayerManagerからの通知を受けてUIの更新を行うためのダミーメソッド
        // (将来的にCanvasManagerが全てのレイヤーの合成描画を行う場合に利用)
        console.log('全てのレイヤーの表示を更新しました。');
        this.app.layerManager.updateLayerUI(); // レイヤーUIのサムネイルなどを更新するため
    }
}