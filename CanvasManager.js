// CanvasManager.js
/**
 * CanvasManagerクラス
 * 描画キャンバスの描画操作、変形、履歴管理を担当します。
 */
class CanvasManager {
    /**
     * @param {FutabaTegakiTool} app - メインアプリケーションのインスタンス
     */
    constructor(app) {
        this.app = app;
        // メインのcanvas要素はLayerManagerが管理するため、ここではテンプレートとして保持
        this.templateCanvas = document.getElementById('drawingCanvas'); 
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
        
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.canvasStartX = 0;
        this.canvasStartY = 0;
        this.moveLayerStartX = 0;
        this.moveLayerStartY = 0;
        this.moveLayerImageData = null;
        
        this.scale = 1;
        this.rotation = 0;

        // 初期描画ターゲットはFutabaTegakiToolのinitManagersで設定される
        this.targetLayerCanvas = null; // 現在の描画対象となるレイヤーのCanvas
        this.targetLayerCtx = null;    // 現在の描画対象となるレイヤーのContext

        this.bindEvents();
    }
    
    /**
     * イベントリスナーをバインドします。
     */
    bindEvents() {
        // キャンバスコンテナではなく、個々のレイヤーcanvasにイベントをバインドするように変更
        // LayerManagerが生成する各レイヤーcanvasに対してイベントを設定する
        // ただし、ポインタイベントはcanvas-container全体で監視し、イベント委任を活用する
        this.canvasContainer.addEventListener('pointerdown', this.onPointerDown.bind(this));
        document.addEventListener('pointermove', this.onPointerMove.bind(this));
        document.addEventListener('pointerup', this.onPointerUp.bind(this));
        this.canvasArea.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
    }

    /**
     * 現在の操作対象レイヤーを設定します。
     * 描画、消去、移動などの操作はこのレイヤーに対して行われます。
     * @param {object} layer - LayerManagerから渡されるアクティブなレイヤーオブジェクト
     */
    setTargetLayer(layer) {
        if (!layer || !layer.canvas || !layer.ctx) {
            console.error("Invalid layer object provided to setTargetLayer.");
            return;
        }
        this.targetLayerCanvas = layer.canvas;
        this.targetLayerCtx = layer.ctx;
        // console.log(`Active layer set to: ${layer.name}`); // デバッグ用
        // 描画ターゲットが変わった際、履歴を保存する（新レイヤーの初期状態）
        this.saveState();
    }

    /**
     * 現在のツールを設定します。
     * @param {string} tool - 設定するツールの名前 ('pen', 'eraser', 'move', 'bucket'など)
     */
    setCurrentTool(tool) {
        this.currentTool = tool;
    }

    /**
     * 現在の描画色を設定します。
     * @param {string} color - 設定する色 (例: '#RRGGBB')
     */
    setCurrentColor(color) {
        this.currentColor = color;
    }

    /**
     * 現在のペンサイズを設定します。
     * @param {number} size - 設定するペンサイズ (ピクセル単位)
     */
    setCurrentSize(size) {
        this.currentSize = size;
    }

    /**
     * ポインタ（マウス、ペン、タッチ）が押された時の処理です。
     * @param {PointerEvent} e - ポインタイベントオブジェクト
     */
    onPointerDown(e) {
        // 現在アクティブなレイヤーが設定されていない場合は処理しない
        if (!this.targetLayerCanvas || !this.targetLayerCtx) return;

        // イベントが現在アクティブなレイヤーのCanvas上で発生したか、またはcanvasContainer上で発生したかを確認
        // isDrawing, isMovingLayer の場合は、対象がtargetLayerCanvasである必要がある
        // isPanning の場合は、対象がcanvasContainer全体で良い
        if (!e.target.closest('.canvas-container')) return; // canvasContainerの外で押された場合は無視

        const coords = this.getCanvasCoordinates(e);
        this.lastX = coords.x;
        this.lastY = coords.y;

        if (this.isSpaceDown) {
            // スペースキーが押されている場合（パンニング）
            this.isPanning = true;
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
            this.setAbsolutePosition(); // パニングのためにcanvasContainerの位置を絶対位置に設定
            e.target.setPointerCapture(e.pointerId); // ポインタキャプチャでドラッグ範囲を広げる
        } else if (this.currentTool === 'move') {
            // レイヤー移動ツールの場合
            if (e.target !== this.targetLayerCanvas) return; // アクティブレイヤー上でなければ処理しない
            this.isMovingLayer = true;
            this.moveLayerStartX = coords.x;
            this.moveLayerStartY = coords.y;
            // 移動開始時のレイヤーのImageDataを保持
            this.moveLayerImageData = this.targetLayerCtx.getImageData(0, 0, this.targetLayerCanvas.width, this.targetLayerCanvas.height);
            e.target.setPointerCapture(e.pointerId);
        } else if (this.currentTool === 'bucket') {
            // バケツツールの場合
            if (e.target !== this.targetLayerCanvas) return; // アクティブレイヤー上でなければ処理しない
            this.fill(Math.floor(this.lastX), Math.floor(this.lastY), this.currentColor);
            this.saveState(); // 塗りつぶし後に履歴を保存
            e.target.releasePointerCapture(e.pointerId); // 塗りつぶしは一度のクリックで完結
        } else {
            // ペンや消しゴムツールの場合（描画開始）
            if (e.target !== this.targetLayerCanvas) return; // アクティブレイヤー上でなければ処理しない
            this.isDrawing = true;
            this.targetLayerCtx.beginPath();
            this.targetLayerCtx.moveTo(this.lastX, this.lastY);
            e.target.setPointerCapture(e.pointerId);
        }
    }

    /**
     * ポインタが移動した時の処理です。
     * @param {PointerEvent} e - ポインタイベントオブジェクト
     */
    onPointerMove(e) {
        // ポインタが押されていない（ドラッグ中でない）場合は何もしない
        if (!e.buttons) { 
            this.onPointerUp(e); // ボタンが離れたとみなし、onPointerUpを呼び出す
            return;
        }
        // アクティブなレイヤーが設定されていない場合は処理しない
        if (!this.targetLayerCanvas || !this.targetLayerCtx) return;

        if (this.isPanning) {
            // パンニング中
            const deltaX = e.clientX - this.dragStartX;
            const deltaY = e.clientY - this.dragStartY;
            this.canvasContainer.style.left = (this.canvasStartX + deltaX) + 'px';
            this.canvasContainer.style.top = (this.canvasStartY + deltaY) + 'px';
        } else if (this.isMovingLayer) {
            // レイヤー移動中
            const coords = this.getCanvasCoordinates(e);
            const dx = Math.round(coords.x - this.moveLayerStartX);
            const dy = Math.round(coords.y - this.moveLayerStartY);
            
            // 移動中のレイヤーをクリアし、元のImageDataをオフセットして再描画
            this.targetLayerCtx.clearRect(0, 0, this.targetLayerCanvas.width, this.targetLayerCanvas.height);
            this.targetLayerCtx.putImageData(this.moveLayerImageData, dx, dy);
        } else if (this.isDrawing) {
            // 描画中
            const coords = this.getCanvasCoordinates(e);
            const currentX = coords.x;
            const currentY = coords.y;
            
            // 描画モードに応じてglobalCompositeOperationを設定（消しゴムの場合は'destination-out'）
            this.targetLayerCtx.globalCompositeOperation = this.currentTool === 'eraser' ? 'destination-out' : 'source-over';
            this.targetLayerCtx.strokeStyle = this.currentColor;
            this.targetLayerCtx.lineWidth = this.currentSize;
            this.targetLayerCtx.lineTo(currentX, currentY);
            this.targetLayerCtx.stroke();
            this.lastX = currentX;
            this.lastY = currentY;
        }
    }

    /**
     * ポインタが離された時の処理です。
     * @param {PointerEvent} e - ポインタイベントオブジェクト
     */
    onPointerUp(e) {
        // ポインタがキャプチャされていない場合は処理しない
        if (!e.target.hasPointerCapture(e.pointerId)) return;
        e.target.releasePointerCapture(e.pointerId); // ポインタキャプチャを解放
        
        if (this.isDrawing) {
            this.isDrawing = false;
            this.targetLayerCtx.closePath();
            this.saveState(); // 描画終了後に履歴を保存
        }
        if (this.isPanning) {
            this.isPanning = false;
            // パニング終了後、canvasContainerのz-indexを元に戻す
            this.canvasContainer.style.zIndex = 'auto'; 
        }
        if(this.isMovingLayer) {
            this.isMovingLayer = false;
            this.saveState(); // レイヤー移動終了後に履歴を保存
        }
    }
    
    /**
     * キャンバスコンテナのCSS位置を絶対位置に設定し、現在のオフセットを保存します。
     * パニング操作のために呼び出されます。
     */
    setAbsolutePosition() {
        if (this.canvasContainer.style.position !== 'absolute') {
            // 相対位置から絶対位置への変換
            const rect = this.canvasContainer.getBoundingClientRect();
            const areaRect = this.canvasArea.getBoundingClientRect();
            this.canvasStartX = rect.left - areaRect.left;
            this.canvasStartY = rect.top - areaRect.top;
            this.canvasContainer.style.position = 'absolute';
            this.canvasContainer.style.left = this.canvasStartX + 'px';
            this.canvasContainer.style.top = this.canvasStartY + 'px';
            this.canvasContainer.style.zIndex = '1000'; // パニング中は前面に表示
        } else {
            // 既に絶対位置の場合は現在の値を更新
            this.canvasStartX = parseFloat(this.canvasContainer.style.left || 0);
            this.canvasStartY = parseFloat(this.canvasContainer.style.top || 0);
        }
    }
    
    /**
     * イベント座標をキャンバス内の座標に変換します。
     * スケール、回転、パンニングを考慮します。
     * @param {PointerEvent} e - ポインタイベントオブジェクト
     * @returns {object} キャンバス内のx, y座標
     */
    getCanvasCoordinates(e) {
        // アクティブなレイヤーcanvasを基準に座標を計算
        const rect = this.targetLayerCanvas.getBoundingClientRect();
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;

        // 回転とスケールを考慮するために、中心を基準に変換
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        x -= centerX;
        y -= centerY;

        // 回転の逆変換
        const rad = -this.rotation * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const rotatedX = x * cos - y * sin;
        const rotatedY = x * sin + y * cos;

        // スケールの逆変換
        const scaledX = rotatedX / this.scale;
        const scaledY = rotatedY / this.scale;

        // 再び左上を基準に戻す
        const finalX = scaledX + this.targetLayerCanvas.width / 2;
        const finalY = scaledY + this.targetLayerCanvas.height / 2;
        
        return { x: finalX, y: finalY };
    }

    /**
     * カーソルの表示を現在のツールと状態に合わせて更新します。
     */
    updateCursor() {
         if (this.isSpaceDown) {
            this.canvasContainer.style.cursor = 'grab'; // パンニング中は'grab'
            return;
        }
        switch(this.currentTool) {
            case 'move': this.canvasContainer.style.cursor = 'move'; break;
            case 'pen':
            case 'eraser':
            case 'bucket':
            default: this.canvasContainer.style.cursor = 'crosshair'; break;
        }
    }
    
    /**
     * 現在のアクティブレイヤーの状態を履歴に保存します。
     * LayerManagerが管理する各レイヤーの履歴スタックに保存します。
     */
    saveState() {
        if (!this.targetLayerCanvas || !this.targetLayerCtx) return;
        this.app.layerManager.saveLayerState(this.targetLayerCanvas.id);
    }
    
    /**
     * 現在のアクティブレイヤーの変更を元に戻します（Undo）。
     */
    undo() {
        if (!this.targetLayerCanvas || !this.targetLayerCtx) return;
        this.app.layerManager.undoLayerState(this.targetLayerCanvas.id);
    }
    
    /**
     * 現在のアクティブレイヤーの変更をやり直します（Redo）。
     */
    redo() {
        if (!this.targetLayerCanvas || !this.targetLayerCtx) return;
        this.app.layerManager.redoLayerState(this.targetLayerCanvas.id);
    }
    
    /**
     * 現在のアクティブレイヤーの内容をクリアします。
     */
    clearCanvas() {
        if (!this.targetLayerCanvas || !this.targetLayerCtx) return;
        this.targetLayerCtx.clearRect(0, 0, this.targetLayerCanvas.width, this.targetLayerCanvas.height);
        // 背景レイヤーの場合のみ背景色で塗りつぶす (LayerManagerが管理する)
        const activeLayer = this.app.layerManager.getActiveLayer();
        if (activeLayer && activeLayer.name === '背景') { // 名前で判別するのはあまり良くないが、今回はこれで対応
            this.targetLayerCtx.fillStyle = '#f0e0d6';
            this.targetLayerCtx.fillRect(0, 0, this.targetLayerCanvas.width, this.targetLayerCanvas.height);
        }
        this.saveState();
    }
    
    /**
     * 現在のアクティブレイヤーを水平方向に反転します。
     */
    flipHorizontal() {
        if (!this.targetLayerCanvas || !this.targetLayerCtx) return;
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = this.targetLayerCanvas.width;
        tempCanvas.height = this.targetLayerCanvas.height;

        // 現在のレイヤー内容を一時キャンバスにコピー
        tempCtx.drawImage(this.targetLayerCanvas, 0, 0);

        // アクティブレイヤーをクリアし、水平反転して描画
        this.targetLayerCtx.clearRect(0, 0, this.targetLayerCanvas.width, this.targetLayerCanvas.height);
        this.targetLayerCtx.save();
        this.targetLayerCtx.translate(this.targetLayerCanvas.width, 0);
        this.targetLayerCtx.scale(-1, 1);
        this.targetLayerCtx.drawImage(tempCanvas, 0, 0);
        this.targetLayerCtx.restore();
        this.saveState();
    }

    /**
     * 現在のアクティブレイヤーを垂直方向に反転します。
     */
    flipVertical() {
        if (!this.targetLayerCanvas || !this.targetLayerCtx) return;
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = this.targetLayerCanvas.width;
        tempCanvas.height = this.targetLayerCanvas.height;

        // 現在のレイヤー内容を一時キャンバスにコピー
        tempCtx.drawImage(this.targetLayerCanvas, 0, 0);
        
        // アクティブレイヤーをクリアし、垂直反転して描画
        this.targetLayerCtx.clearRect(0, 0, this.targetLayerCanvas.width, this.targetLayerCanvas.height);
        this.targetLayerCtx.save();
        this.targetLayerCtx.translate(0, this.targetLayerCanvas.height);
        this.targetLayerCtx.scale(1, -1);
        this.targetLayerCtx.drawImage(tempCanvas, 0, 0);
        this.targetLayerCtx.restore();
        this.saveState();
    }
    
    /**
     * キャンバス表示をズームします。
     * @param {number} factor - ズーム倍率 (例: 1.2で1.2倍に拡大, 1/1.2で1.2倍に縮小)
     */
    zoom(factor) {
        const newScale = this.scale * factor;
        this.scale = Math.max(0.1, Math.min(newScale, 10)); // 10%～1000%の範囲に制限
        this.updateCanvasTransform();
    }
    
    /**
     * キャンバス表示を回転します。
     * @param {number} degrees - 回転角度 (度数法)
     */
    rotate(degrees) {
        this.rotation = (this.rotation + degrees) % 360;
        this.updateCanvasTransform();
    }
    
    /**
     * キャンバスコンテナのtransformスタイルを更新し、ズームと回転を適用します。
     */
    updateCanvasTransform() {
        this.canvasContainer.style.transform = `scale(${this.scale}) rotate(${this.rotation}deg)`;
        // transformOriginはCSSで設定済みなので不要だが、念のため
        this.canvasContainer.style.transformOrigin = 'center center'; 
    }

    /**
     * キャンバス表示を初期状態にリセットします（ズーム、回転、パンニングを元に戻す）。
     */
    resetView() {
        this.scale = 1;
        this.rotation = 0;
        this.updateCanvasTransform();
        this.canvasContainer.style.position = 'relative'; // 初期位置に戻す
        this.canvasContainer.style.left = 'auto';
        this.canvasContainer.style.top = 'auto';
        this.canvasContainer.style.zIndex = 'auto';
    }

    /**
     * マウスホイールイベントを処理し、ズームまたは回転を実行します。
     * @param {WheelEvent} e - ホイールイベントオブジェクト
     */
    handleWheel(e) {
        e.preventDefault(); // デフォルトのスクロール動作を抑制
        const delta = e.deltaY > 0 ? -1 : 1; // ホイールの向きを判定
        if (e.shiftKey) {
            this.rotate(delta * 15); // Shiftキーが押されていれば回転
        } else {
            this.zoom(delta > 0 ? 1.1 : 1 / 1.1); // 通常はズーム
        }
    }

    // ヘルパー関数: RGBA値を比較
    colorsMatch(a, b) {
        return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
    }

    // ヘルパー関数: ピクセルのRGBA値を取得
    getPixelColor(imageData, x, y) {
        if (x < 0 || x >= imageData.width || y < 0 || y >= imageData.height) {
            return [-1, -1, -1, -1]; // 範囲外の色として無効な値を返す
        }
        const i = (y * imageData.width + x) * 4;
        return [imageData.data[i], imageData.data[i + 1], imageData.data[i + 2], imageData.data[i + 3]];
    }

    // ヘルパー関数: ピクセルにRGBA値を設定
    setPixelColor(imageData, x, y, color) {
        if (x < 0 || x >= imageData.width || y < 0 || y >= imageData.height) {
            return; // 範囲外の場合は何もしない
        }
        const i = (y * imageData.width + x) * 4;
        imageData.data[i] = color[0];
        imageData.data[i + 1] = color[1];
        imageData.data[i + 2] = color[2];
        imageData.data[i + 3] = color[3];
    }

    /**
     * バケツツール（塗りつぶし）の実装です。
     * @param {number} startX - 塗りつぶし開始点のX座標
     * @param {number} startY - 塗りつぶし開始点のY座標
     * @param {string} fillColor - 塗りつぶし色 (CSSカラー文字列)
     */
    fill(startX, startY, fillColor) {
        if (!this.targetLayerCanvas || !this.targetLayerCtx) return;

        const canvasWidth = this.targetLayerCanvas.width;
        const canvasHeight = this.targetLayerCanvas.height;
        const imageData = this.targetLayerCtx.getImageData(0, 0, canvasWidth, canvasHeight);
        
        // 開始点のピクセル色を取得
        const startColor = this.getPixelColor(imageData, startX, startY);
        
        // fillColorをRGBAに変換するための一時的なContextを作成
        const tempCtx = document.createElement('canvas').getContext('2d');
        tempCtx.fillStyle = fillColor;
        tempCtx.fillRect(0, 0, 1, 1);
        const fillRGBA = tempCtx.getImageData(0, 0, 1, 1).data;
        const targetFillColor = [fillRGBA[0], fillRGBA[1], fillRGBA[2], fillRGBA[3]];

        // 塗りつぶし色が開始色と同じ場合は何もしない
        if (this.colorsMatch(startColor, targetFillColor)) {
            return;
        }

        // スタックベースのFlood Fillアルゴリズム
        const stack = [[startX, startY]];

        while (stack.length > 0) {
            const [x, y] = stack.pop();

            // 範囲チェックと現在ピクセルの色確認
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
        // 変更されたImageDataをキャンバスに反映
        this.targetLayerCtx.putImageData(imageData, 0, 0);
    }
}
