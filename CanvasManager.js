// CanvasManager.js (不具合修正版)
class CanvasManager {
    constructor(app) {
        this.app = app;
        this.canvasArea = document.getElementById('canvas-area');
        this.canvasContainer = document.getElementById('canvas-container');
        
        this.activeCanvas = document.getElementById('drawingCanvas');
        this.activeCtx = this.activeCanvas.getContext('2d');

        this.isDrawing = false;
        this.isPanning = false;
        // isMovingLayerはまだ使わないが、将来のために残しておく
        this.isMovingLayer = false; // レイヤー移動モードのフラグ
        this.isSpaceDown = false;

        this.currentTool = 'pen';
        this.currentColor = '#800000';
        this.currentSize = 1;

        this.lastX = 0; this.lastY = 0;
        this.history = []; this.historyIndex = -1;
        
        this.dragStartX = 0; this.dragStartY = 0;
        this.canvasStartX = 0; this.canvasStartY = 0;
        // レイヤー移動開始時のレイヤーの初期位置を記録
        this.layerMoveStartX = 0;
        this.layerMoveStartY = 0;

        this.scale = 1; this.rotation = 0;

        this.initCanvas();
        this.bindEvents();
    }
    
    initCanvas() {
        this.activeCtx.lineCap = 'round';
        this.activeCtx.lineJoin = 'round';
        this.activeCtx.fillStyle = '#f0e0d6';
        this.activeCtx.fillRect(0, 0, this.activeCanvas.width, this.activeCanvas.height);
        this.saveState();
    }

    bindEvents() {
        this.canvasContainer.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvasContainer.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvasContainer.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvasContainer.addEventListener('mouseout', this.handleMouseUp.bind(this)); // ドラッグ中にキャンバス外に出た場合
        this.canvasContainer.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });

        // `canvas-area` のイベントリスナーは、パン操作のときだけ利用
        this.canvasArea.addEventListener('mousedown', this.handleAreaMouseDown.bind(this));
        this.canvasArea.addEventListener('mousemove', this.handleAreaMouseMove.bind(this));
        this.canvasArea.addEventListener('mouseup', this.handleAreaMouseUp.bind(this));
        this.canvasArea.addEventListener('mouseout', this.handleAreaMouseUp.bind(this));
    }

    // 各Managerから呼び出されるセッター
    setCurrentTool(tool) {
        this.currentTool = tool;
    }

    setCurrentColor(color) {
        this.currentColor = color;
    }

    setCurrentSize(size) {
        this.currentSize = size;
    }

    // マウスイベントハンドラ (描画、パン、レイヤー移動)
    handleMouseDown(e) {
        // Vキーでのレイヤー移動中であれば、他のツール動作を停止
        if (this.isMovingLayer) {
            this.isDrawing = false;
            this.isPanning = false;

            // レイヤー移動開始時のアクティブレイヤーの初期位置を保存
            if (this.app.layerManager.activeLayer) {
                this.layerMoveStartX = e.clientX - this.app.layerManager.activeLayer.canvas.offsetLeft;
                this.layerMoveStartY = e.clientY - this.app.layerManager.activeLayer.canvas.offsetTop;
            }
            return;
        }

        // パン操作中でなければ、描画を開始
        if (!this.isSpaceDown && !this.isPanning) {
            this.isDrawing = true;
            [this.lastX, this.lastY] = this.getCanvasCoordinates(e.clientX, e.clientY);

            if (this.currentTool === 'bucket') {
                this.fillColor(e.clientX, e.clientY, this.currentColor);
                this.saveState();
                this.updateCanvasDisplay(); // バケツツール後も表示を更新
                this.isDrawing = false; // バケツはクリックで完了
            } else if (this.currentTool === 'move') {
                // 'move' ツールが選択されている場合は、キャンバス全体のパン操作として処理
                this.isPanning = true;
                this.dragStartX = e.clientX;
                this.dragStartY = e.clientY;
                this.canvasStartX = this.canvasContainer.offsetLeft;
                this.canvasStartY = this.canvasContainer.offsetTop;
            } else {
                this.draw(e.clientX, e.clientY); // クリック開始地点の点を描画
            }
        }
    }

    handleMouseMove(e) {
        if (this.isMovingLayer && this.app.layerManager.activeLayer) {
            // Vキーでのレイヤー移動中
            const currentX = e.clientX;
            const currentY = e.clientY;

            // レイヤーの新しい位置を計算 (ドラッグ開始位置からの相対移動)
            const newLeft = currentX - this.layerMoveStartX;
            const newTop = currentY - this.layerMoveStartY;

            this.app.layerManager.activeLayer.canvas.style.left = `${newLeft}px`;
            this.app.layerManager.activeLayer.canvas.style.top = `${newTop}px`;

            // レイヤーUIも移動させる（もし必要なら。今はキャンバスのみ）
            // this.app.layerManager.activeLayer.uiElement.style.left = `${newLeft}px`;
            // this.app.layerManager.activeLayer.uiElement.style.top = `${newTop}px`;

            // レイヤー移動中のカーソルを移動ツールアイコンに
            this.canvasContainer.style.cursor = 'move';
            return; // レイヤー移動中は他の処理を行わない
        }

        if (this.isDrawing) {
            if (this.currentTool === 'pen' || this.currentTool === 'eraser') {
                this.draw(e.clientX, e.clientY);
            }
        } else if (this.isPanning) {
            // パン操作
            const dx = e.clientX - this.dragStartX;
            const dy = e.clientY - this.dragStartY;
            this.canvasContainer.style.left = `${this.canvasStartX + dx}px`;
            this.canvasContainer.style.top = `${this.canvasStartY + dy}px`;
        }
        this.updateCursor(e); // カーソル更新
    }

    handleMouseUp(e) {
        if (this.isDrawing) {
            this.isDrawing = false;
            this.saveState();
        }
        if (this.isPanning) {
            this.isPanning = false;
        }
        if (this.isMovingLayer && this.app.layerManager.activeLayer) {
            // レイヤー移動が完了したら、その位置を履歴に保存
            // レイヤーごとの位置を管理するプロパティがあればここに更新
            const activeLayer = this.app.layerManager.activeLayer;
            // レイヤーの実際の描画内容を移動させる処理
            this.moveLayerContent(activeLayer, activeLayer.canvas.offsetLeft, activeLayer.canvas.offsetTop);
            this.saveState(); // レイヤー移動も履歴として保存
        }
        this.updateCursor(e); // カーソル更新
    }

    // CanvasAreaに対するイベントハンドラ (パン操作用)
    handleAreaMouseDown(e) {
        // スペースキーが押されている、または移動ツールが選択されている場合にパンを開始
        if (this.isSpaceDown || this.currentTool === 'move') {
            this.isPanning = true;
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
            this.canvasStartX = this.canvasContainer.offsetLeft;
            this.canvasStartY = this.canvasContainer.offsetTop;
            this.canvasContainer.style.cursor = 'grabbing';
            e.preventDefault(); // ドラッグによる意図しない選択を防ぐ
        }
    }

    handleAreaMouseMove(e) {
        if (this.isPanning) {
            const dx = e.clientX - this.dragStartX;
            const dy = e.clientY - this.dragStartY;
            this.canvasContainer.style.left = `${this.canvasStartX + dx}px`;
            this.canvasContainer.style.top = `${this.canvasStartY + dy}px`;
            this.canvasContainer.style.cursor = 'grabbing';
        } else {
            this.updateCursor(e); // カーソル更新
        }
    }

    handleAreaMouseUp(e) {
        if (this.isPanning) {
            this.isPanning = false;
            this.canvasContainer.style.cursor = 'grab';
        }
        this.updateCursor(e); // カーソル更新
    }

    // レイヤーの内容を実際に移動させる関数
    // レイヤーの移動は、CSSのleft/topプロパティを変更するだけでは履歴管理や描画内容に反映されないため、
    // 描画内容を新しい位置に再描画し、元の位置をクリアする必要があります。
    // ただし、このアプリケーションの既存のレイヤー管理は、各レイヤーが独立したCanvas要素としてDOMに配置されており、
    // それらの`left`や`top`をCSSで変更しているようです。
    // そのため、ここではCSSの位置を更新するだけに留め、履歴管理は`saveState()`で全体の状態を保存する形にします。
    // もしレイヤーの描画内容自体を移動させる必要がある場合は、別途ImageDataの操作が必要になります。
    moveLayerContent(layer, newLeft, newTop) {
        // 現在の実装では、レイヤーのCanvas要素のCSS positionを直接操作して移動しているため、
        // 描画内容の移動は不要です。履歴は `saveState` で対応します。
        // layer.canvas.style.left = `${newLeft}px`;
        // layer.canvas.style.top = `${newTop}px`;

        // ただし、もし描画内容を移動させたい場合は、以下のような処理が必要になります。
        // 例:
        // const tempCanvas = document.createElement('canvas');
        // tempCanvas.width = layer.canvas.width;
        // tempCanvas.height = layer.canvas.height;
        // const tempCtx = tempCanvas.getContext('2d');
        // tempCtx.drawImage(layer.canvas, 0, 0); // 現在の描画内容を一時キャンバスにコピー
        //
        // layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height); // 元のレイヤーをクリア
        // layer.ctx.drawImage(tempCanvas, newLeft - layer.canvas.offsetLeft, newTop - layer.canvas.offsetTop); // 新しい位置に描画
        // layer.canvas.style.left = `${newLeft}px`; // CSSの位置も更新
        // layer.canvas.style.top = `${newTop}px`;
    }

    getCanvasCoordinates(clientX, clientY) {
        const bbox = this.activeCanvas.getBoundingClientRect();
        const x = (clientX - bbox.left) / this.scale;
        const y = (clientY - bbox.top) / this.scale;
        return [x, y];
    }

    draw(clientX, clientY) {
        const [x, y] = this.getCanvasCoordinates(clientX, clientY);

        this.app.layerManager.activeCtx.lineWidth = this.currentSize;
        this.app.layerManager.activeCtx.strokeStyle = this.currentColor;
        this.app.layerManager.activeCtx.globalCompositeOperation = (this.currentTool === 'eraser') ? 'destination-out' : 'source-over';

        this.app.layerManager.activeCtx.beginPath();
        this.app.layerManager.activeCtx.moveTo(this.lastX, this.lastY);
        this.app.layerManager.activeCtx.lineTo(x, y);
        this.app.layerManager.activeCtx.stroke();

        this.lastX = x;
        this.lastY = y;
    }

    fillColor(clientX, clientY, fillColor) {
        const [startX, startY] = this.getCanvasCoordinates(clientX, clientY);
        const activeLayer = this.app.layerManager.activeLayer;

        if (!activeLayer) return;

        const canvasWidth = activeLayer.canvas.width;
        const canvasHeight = activeLayer.canvas.height;
        const imageData = activeLayer.ctx.getImageData(0, 0, canvasWidth, canvasHeight);
        const startColor = this.getPixelColor(imageData, startX, startY);

        const tempCtx = document.createElement('canvas').getContext('2d');
        tempCtx.fillStyle = fillColor; tempCtx.fillRect(0, 0, 1, 1);
        const fillRGBA = tempCtx.getImageData(0, 0, 1, 1).data;
        const targetFillColor = [fillRGBA[0], fillRGBA[1], fillRGBA[2], 255]; // バケツツールはRGBAで処理

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
        activeLayer.ctx.putImageData(imageData, 0, 0); // アクティブなレイヤーに反映
    }

    getPixelColor(imageData, x, y) {
        const index = (y * imageData.width + x) * 4;
        return [imageData.data[index], imageData.data[index + 1], imageData.data[index + 2], imageData.data[index + 3]];
    }

    setPixelColor(imageData, x, y, color) {
        const index = (y * imageData.width + x) * 4;
        imageData.data[index] = color[0];
        imageData.data[index + 1] = color[1];
        imageData.data[index + 2] = color[2];
        imageData.data[index + 3] = color[3];
    }

    colorsMatch(a, b) { return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3]; }

    updateCursor(e) {
        if (this.isSpaceDown || this.currentTool === 'move') {
            this.canvasContainer.style.cursor = this.isPanning ? 'grabbing' : 'grab';
        } else if (this.isMovingLayer) { // レイヤー移動モードの場合のカーソル
            this.canvasContainer.style.cursor = 'move';
        } else {
            this.canvasContainer.style.cursor = 'crosshair'; // 描画ツールのデフォルト
        }
    }
    
    // 履歴管理
    saveState() {
        // 現在の状態から未来の履歴を削除
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        
        // 全てのレイヤーの状態を保存
        const allLayerData = this.app.layerManager.layers.map(layer => {
            const imageData = layer.ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height);
            // レイヤーの位置情報も保存
            const layerPosition = {
                left: layer.canvas.style.left,
                top: layer.canvas.style.top
            };
            return {
                id: layer.id,
                imageData: imageData,
                position: layerPosition,
                visible: layer.visible,
                locked: layer.locked
            };
        });
        this.history.push(allLayerData);
        this.historyIndex++;
        
        // 履歴の最大数を管理 (例: 50)
        const MAX_HISTORY = 50;
        if (this.history.length > MAX_HISTORY) {
            this.history.shift(); // 最も古い履歴を削除
            this.historyIndex--;
        }
        // console.log(`Saved state. History length: ${this.history.length}, Index: ${this.historyIndex}`);
        this.updateTopBarButtons();
    }

    loadState(index) {
        if (index >= 0 && index < this.history.length) {
            const savedAllLayerData = this.history[index];
            // 全てのレイヤーの状態を復元
            this.app.layerManager.layers.forEach(currentLayer => {
                const savedLayer = savedAllLayerData.find(s => s.id === currentLayer.id);
                if (savedLayer) {
                    currentLayer.ctx.clearRect(0, 0, currentLayer.canvas.width, currentLayer.canvas.height);
                    currentLayer.ctx.putImageData(savedLayer.imageData, 0, 0);
                    // レイヤーの位置も復元
                    currentLayer.canvas.style.left = savedLayer.position.left;
                    currentLayer.canvas.style.top = savedLayer.position.top;
                    currentLayer.visible = savedLayer.visible;
                    currentLayer.locked = savedLayer.locked;
                    currentLayer.canvas.style.display = savedLayer.visible ? 'block' : 'none';
                    currentLayer.uiElement.querySelector('.layer-toggle-visibility').textContent = savedLayer.visible ? '👁️' : '🚫';
                    currentLayer.uiElement.querySelector('.layer-toggle-lock').textContent = savedLayer.locked ? '🔒' : '🔓';
                }
            });
            this.historyIndex = index;
            // console.log(`Loaded state ${index}. History length: ${this.history.length}, Index: ${this.historyIndex}`);
            this.updateTopBarButtons();
            this.updateCanvasDisplay(); // 復元後にキャンバス表示を更新
        }
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.loadState(this.historyIndex);
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.loadState(this.historyIndex);
        }
    }

    updateTopBarButtons() {
        const undoBtn = document.getElementById('undo-btn');
        const redoBtn = document.getElementById('redo-btn');
        if (undoBtn) undoBtn.disabled = this.historyIndex <= 0;
        if (redoBtn) redoBtn.disabled = this.historyIndex >= this.history.length - 1;
    }

    // キャンバス表示の更新（ズーム、回転、パン）
    updateCanvasDisplay() {
        // LayerManagerのlayers配列の順序に基づき、z-indexを設定
        this.app.layerManager.layers.forEach((layer, index) => {
            layer.canvas.style.zIndex = index; // レイヤーの描画順序をDOMのz-indexで制御
        });

        const container = this.canvasContainer;
        // transformOriginは、スケールと回転の中心を設定
        container.style.transformOrigin = '0 0';
        // スケール、回転、パンを同時に適用する変換行列
        // CSS transformの順序は、translate -> rotate -> scale が一般的
        // ここでは、回転とスケールを先に適用し、その結果を考慮して最終的な位置を調整するために、
        // translateを最後に適用する形にする (あるいは、中心を考慮してtranslateを調整)

        // 現在のCSS位置を取得 (panによって設定されている可能性)
        const currentLeft = parseFloat(container.style.left || 0);
        const currentTop = parseFloat(container.style.top || 0);

        // 中心点を考慮した変換
        // このアプリケーションではcanvasContainerのleft/topでパンを実装しているため、
        // transformのtranslateZ(0)は不要
        container.style.transform = `scale(${this.scale}) rotate(${this.rotation}deg)`;
    }
    
    // その他のキャンバス操作
    clearCanvas() {
        if (this.app.layerManager.activeLayer) {
            const activeLayer = this.app.layerManager.activeLayer;
            activeLayer.ctx.clearRect(0, 0, activeLayer.canvas.width, activeLayer.canvas.height);
            this.saveState();
        }
    }

    flipHorizontal() {
        if (!this.app.layerManager.activeLayer || this.app.layerManager.activeLayer.locked) return;
        const activeLayer = this.app.layerManager.activeLayer;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = activeLayer.canvas.width;
        tempCanvas.height = activeLayer.canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.translate(tempCanvas.width, 0);
        tempCtx.scale(-1, 1);
        tempCtx.drawImage(activeLayer.canvas, 0, 0);
        activeLayer.ctx.clearRect(0, 0, activeLayer.canvas.width, activeLayer.canvas.height);
        activeLayer.ctx.drawImage(tempCanvas, 0, 0);
        this.saveState();
    }

    flipVertical() {
        if (!this.app.layerManager.activeLayer || this.app.layerManager.activeLayer.locked) return;
        const activeLayer = this.app.layerManager.activeLayer;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = activeLayer.canvas.width;
        tempCanvas.height = activeLayer.canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.translate(0, tempCanvas.height);
        tempCtx.scale(1, -1);
        tempCtx.drawImage(activeLayer.canvas, 0, 0);
        activeLayer.ctx.clearRect(0, 0, activeLayer.canvas.width, activeLayer.canvas.height);
        activeLayer.ctx.drawImage(tempCanvas, 0, 0);
        this.saveState();
    }

    zoom(factor) {
        this.scale *= factor;
        this.updateCanvasDisplay();
    }

    rotate(degrees) {
        this.rotation += degrees;
        this.updateCanvasDisplay();
    }

    resetView() {
        this.scale = 1;
        this.rotation = 0;
        this.canvasContainer.style.left = '0px';
        this.canvasContainer.style.top = '0px';
        this.updateCanvasDisplay();
    }

    handleWheel(e) {
        e.preventDefault(); // ページのスクロールを防止
        if (e.ctrlKey) { // Ctrlキーを押しながらホイールでズーム
            const zoomFactor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
            this.zoom(zoomFactor);
        } else if (e.shiftKey) { // Shiftキーを押しながらホイールで左右移動
            const currentLeft = parseFloat(this.canvasContainer.style.left || 0);
            this.canvasContainer.style.left = `${currentLeft - e.deltaY}px`;
        } else { // 通常のホイールで上下移動
            const currentTop = parseFloat(this.canvasContainer.style.top || 0);
            this.canvasContainer.style.top = `${currentTop - e.deltaY}px`;
        }
    }
}