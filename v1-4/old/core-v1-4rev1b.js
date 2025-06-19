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
        // ★修正: アンドゥ機能を拡張し、画像データとレイヤー変形情報の両方を保存するように変更
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
    setCurrentTool(tool) {
        this.currentTool = tool;
    }
    setCurrentColor(color) {
        this.currentColor = color;
    }
    setCurrentSize(size) {
        this.currentSize = size;
    }
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
             // ★修正: アクティブレイヤーのキャンバス以外での描画開始を防止
            const activeLayer = this.app.layerManager.getCurrentLayer();
            if (!this.canvas || !activeLayer || e.target !== activeLayer.canvas) return;

            const coords = this.getCanvasCoordinates(e);
            this.lastX = coords.x;
            this.lastY = coords.y;
            if (this.currentTool === 'move') {
                this.isMovingLayer = true;
                this.moveLayerStartX = e.clientX;
                this.moveLayerStartY = e.clientY;
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
            // イベントのターゲットがなんであれ、document全体でポインタをキャプチャする
            document.documentElement.setPointerCapture(e.pointerId);
        } catch (err) { }
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
            const dx = e.clientX - this.moveLayerStartX;
            const dy = e.clientY - this.moveLayerStartY;
             // ★修正: LayerManagerの移動メソッドを呼び出す（境界チェック機能付き）
            this.app.layerManager.moveActiveLayer(dx, dy, true);
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
        } catch (err) { }
        if (this.isDrawing) {
            this.isDrawing = false;
            this.ctx.closePath();
            this.saveState();
        }
        if (this.isPanning) this.isPanning = false;
        if (this.isRotatingWithSpace) this.isRotatingWithSpace = false;
        if (this.isMovingLayer) {
            this.isMovingLayer = false;
            // ★修正: レイヤー移動完了後に状態を保存
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
        } else {
            this.canvasStartX = parseFloat(this.canvasContainer.style.left || 0);
            this.canvasStartY = parseFloat(this.canvasContainer.style.top || 0);
        }
    }
    // ★最重要修正箇所: 座標計算の全面的な見直し
    // グローバルなビューポート変換（回転・拡縮）と、レイヤー個別の変換（移動・回転・拡縮）の両方を考慮して、
    // マウスポインターのスクリーン座標をアクティブレイヤーのローカル座標に正しく変換します。
    getCanvasCoordinates(e) {
        // === 1. グローバルなビューポートの逆変換 (マウスポインタ -> canvas-container の座標) ===
        const containerRect = this.canvasContainer.getBoundingClientRect();
        const viewCenterX = containerRect.left + containerRect.width / 2;
        const viewCenterY = containerRect.top + containerRect.height / 2;
        let mouseX = e.clientX - viewCenterX;
        let mouseY = e.clientY - viewCenterY;

        // 1a. ビューポートの回転の逆変換
        const viewRad = -this.rotation * Math.PI / 180;
        const viewCos = Math.cos(viewRad);
        const viewSin = Math.sin(viewRad);
        let viewUnrotatedX = mouseX * viewCos - mouseY * viewSin;
        let viewUnrotatedY = mouseX * viewSin + mouseY * viewCos;

        // 1b. ビューポートの拡縮の逆変換
        let viewUnscaledX = viewUnrotatedX / (this.scale * this.transformState.scaleX);
        let viewUnscaledY = viewUnrotatedY / (this.scale * this.transformState.scaleY);
        
        // === 2. アクティブレイヤーの個別変換の逆変換 (canvas-container の座標 -> レイヤーのローカル座標) ===
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer) return { x: 0, y: 0 }; 
        const t = activeLayer.transform;
        
        // CSS transform は scale -> rotate -> translate の順で適用されるため、逆変換はその逆順で行う
        let layerCoordX = viewUnscaledX;
        let layerCoordY = viewUnscaledY;

        // 2a. レイヤーの移動の逆変換
        layerCoordX -= t.x;
        layerCoordY -= t.y;

        // 2b. レイヤーの回転の逆変換
        const layerRad = -t.rotation * Math.PI / 180;
        const layerCos = Math.cos(layerRad);
        const layerSin = Math.sin(layerRad);
        let layerUnrotatedX = layerCoordX * layerCos - layerCoordY * layerSin;
        let layerUnrotatedY = layerCoordX * layerSin + layerCoordY * layerCos;
        
        // 2c. レイヤーの拡縮の逆変換
        const finalScaleX = t.scale * t.scaleX;
        const finalScaleY = t.scale * t.scaleY;
        let layerUnscaledX = layerUnrotatedX / finalScaleX;
        let layerUnscaledY = layerUnrotatedY / finalScaleY;
        
        // === 3. レイヤーローカル座標（中心が0,0）を、canvasの描画座標（左上が0,0）に変換 ===
        const canvasX = layerUnscaledX + this.canvas.width / 2;
        const canvasY = layerUnscaledY + this.canvas.height / 2;

        return { x: canvasX, y: canvasY };
    }
    updateCursor() {
        if (!this.canvas) return;
        const activeLayerCanvas = this.app.layerManager.getCurrentLayer()?.canvas;
        if (!activeLayerCanvas) return;

        if (this.isSpaceDown) {
            this.canvasArea.style.cursor = 'grab';
             this.app.layerManager.layers.forEach(l => l.canvas.style.cursor = 'grab');
            return;
        } else {
            this.canvasArea.style.cursor = 'default';
        }
        
        let cursorStyle = 'crosshair';
        switch (this.currentTool) {
            case 'move': cursorStyle = 'move'; break;
            case 'pen':
            case 'eraser':
            case 'bucket':
            default: cursorStyle = 'crosshair'; break;
        }
        // ★修正: すべてのレイヤーではなくアクティブレイヤーのカーソルを設定
        activeLayerCanvas.style.cursor = cursorStyle;
    }
    // ★修正: アンドゥ・リドゥシステムの拡張
    // ImageDataだけでなく、全レイヤーの変形情報とアクティブレイヤーのインデックスも保存します。
    saveState() {
        if (!this.app.layerManager || this.app.layerManager.layers.length === 0) return;

        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }

        const state = {
            layerStates: this.app.layerManager.layers.map(layer => ({
                imageData: layer.ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height),
                transform: JSON.parse(JSON.stringify(layer.transform)) // Deep copy
            })),
            activeLayerIndex: this.app.layerManager.activeLayerIndex
        };

        this.history.push(state);
        this.historyIndex++;
    }
    // ★修正: 拡張されたアンドゥ機能
    // 保存された状態（ImageDataと変形情報）を全レイヤーに復元します。
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.restoreState(this.history[this.historyIndex]);
        }
    }
    // ★修正: 拡張されたリドゥ機能
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.restoreState(this.history[this.historyIndex]);
        }
    }
    // ★新規: undo/redoで呼び出される共通の復元処理
    restoreState(state) {
        if (!state) return;
        
        state.layerStates.forEach((layerState, index) => {
            const layer = this.app.layerManager.layers[index];
            if (layer) {
                // ImageDataを復元
                layer.ctx.putImageData(layerState.imageData, 0, 0);
                // Transform情報を復元
                layer.transform = JSON.parse(JSON.stringify(layerState.transform));
                // CSSのtransformを更新
                this.app.layerManager.updateLayerTransform(layer);
            }
        });

        // アクティブレイヤーを復元
        this.app.layerManager.switchLayer(state.activeLayerIndex);
    }
    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.saveState();
    }
    clearAllLayers() {
        if (!this.app.layerManager || !this.app.layerManager.layers) return;
        this.app.layerManager.layers.forEach((layer, index) => {
            const lw = layer.canvas.width;
            const lh = layer.canvas.height;
            layer.ctx.clearRect(0, 0, lw, lh);
            if (index === 0) {
                layer.ctx.fillStyle = '#f0e0d6';
                layer.ctx.fillRect(0, 0, lw, lh);
            }
        });
        this.saveState();
    }
    flipHorizontal() {
        this.transformState.scaleX *= -1;
        this.updateCanvasTransform();
    }
    flipVertical() {
        this.transformState.scaleY *= -1;
        this.updateCanvasTransform();
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
        this.canvasContainer.style.position = '';
        this.canvasContainer.style.left = '';
        this.canvasContainer.style.top = '';
    }
    handleWheel(e) {
        if (this.app.shortcutManager && this.app.shortcutManager.handleWheel(e)) {
            e.preventDefault();
            return;
        }
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
        if (startX < 0 || startX >= canvasWidth || startY < 0 || startY >= canvasHeight) return;

        const imageData = this.ctx.getImageData(0, 0, canvasWidth, canvasHeight);
        const startColor = this.getPixelColor(imageData, startX, startY);
        const fillColorArr = this.hexToRgba(fillColor);
        if (this.colorsMatch(startColor, fillColorArr)) return;
        const queue = [[startX, startY]];
        while (queue.length > 0) {
            const [x, y] = queue.pop();
            if (x < 0 || x >= canvasWidth || y < 0 || y >= canvasHeight) continue;
            if (!this.colorsMatch(this.getPixelColor(imageData, x, y), startColor)) continue;
            this.setPixelColor(imageData, x, y, fillColorArr);
            queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }
        this.ctx.putImageData(imageData, 0, 0);
    }
    hexToRgba(hex) {
        const c = hex.replace('#', '');
        if (c.length === 3) {
            const r = parseInt(c[0] + c[0], 16);
            const g = parseInt(c[1] + c[1], 16);
            const b = parseInt(c[2] + c[2], 16);
            return [r, g, b, 255];
        } else if (c.length === 6) {
            const r = parseInt(c.substring(0, 2), 16);
            const g = parseInt(c.substring(2, 4), 16);
            const b = parseInt(c.substring(4, 6), 16);
            return [r, g, b, 255];
        }
        return [0, 0, 0, 255];
    }
}
class LayerManager {
    constructor(app) {
        this.app = app;
        this.layers = [];
        this.activeLayerIndex = -1;
        this.canvasContainer = document.getElementById('canvas-container');
    }
    getDefaultTransform() {
        return {
            x: 0,
            y: 0,
            scale: 1,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
        };
    }
    setupInitialLayers() {
        const initialCanvas = document.getElementById('drawingCanvas');
        if (!initialCanvas) {
            return;
        }
        this.layers.push({
            canvas: initialCanvas,
            ctx: initialCanvas.getContext('2d'),
            transform: this.getDefaultTransform(),
        });
        const firstLayerCtx = this.layers[0].ctx;
        firstLayerCtx.fillStyle = '#f0e0d6';
        firstLayerCtx.fillRect(0, 0, initialCanvas.width, initialCanvas.height);
        this.switchLayer(0);
        this.updateAllLayerZIndexes();
    }
    addLayer() {
        if (this.layers.length === 0) {
            return null;
        }
        const baseCanvas = this.layers[0].canvas;
        const newCanvas = document.createElement('canvas');
        newCanvas.width = baseCanvas.width;
        newCanvas.height = baseCanvas.height;
        newCanvas.className = 'main-canvas';
        this.canvasContainer.appendChild(newCanvas);
        const newLayer = {
            canvas: newCanvas,
            ctx: newCanvas.getContext('2d'),
            transform: this.getDefaultTransform(),
        };
        this.layers.push(newLayer);
        newLayer.ctx.lineCap = 'round';
        newLayer.ctx.lineJoin = 'round';
        this.updateAllLayerZIndexes();
        this.switchLayer(this.layers.length - 1);
        return newLayer;
    }
    switchLayer(index) {
        if (index < 0 || index >= this.layers.length) {
            return;
        }
        this.activeLayerIndex = index;
        const activeLayer = this.getCurrentLayer();
        if (activeLayer) {
            this.app.canvasManager.setActiveLayerContext(activeLayer.canvas, activeLayer.ctx);
            this.layers.forEach((layer, i) => {
                // ★修正: アクティブレイヤーのみポインタイベントを有効にする
                layer.canvas.style.pointerEvents = (i === index && this.app.toolManager.getCurrentTool() !== 'move') ? 'auto' : 'none';
                if(this.app.toolManager.getCurrentTool() === 'move'){
                     layer.canvas.style.pointerEvents = (i === index) ? 'auto' : 'none';
                }
            });
            const infoEl = document.getElementById('current-layer-info');
            if (infoEl) {
                infoEl.textContent = `L: ${this.activeLayerIndex + 1}/${this.layers.length}`;
            }
        }
    }
    getCurrentLayer() {
        if (this.activeLayerIndex >= 0 && this.activeLayerIndex < this.layers.length) {
            return this.layers[this.activeLayerIndex];
        }
        return null;
    }
    updateLayerTransform(layer) {
        if (!layer || !layer.transform) return;
        const t = layer.transform;
        const finalScaleX = t.scale * t.scaleX;
        const finalScaleY = t.scale * t.scaleY;
        layer.canvas.style.transform = `translate(${t.x}px, ${t.y}px) rotate(${t.rotation}deg) scale(${finalScaleX}, ${finalScaleY})`;
    }
    updateAllLayerZIndexes() {
        this.layers.forEach((layer, index) => {
            layer.canvas.style.zIndex = index;
        });
    }

    // ★新規: 境界チェック関連のヘルパーメソッド
    // レイヤーの変形後の四隅の座標（バウンディングボックス）を計算します
    getLayerBoundingBox(layer, transform) {
        const t = transform || layer.transform;
        const w = layer.canvas.width;
        const h = layer.canvas.height;
    
        const corners = [
            { x: -w / 2, y: -h / 2 }, { x: w / 2, y: -h / 2 },
            { x:  w / 2, y: h / 2 },  { x: -w / 2, y: h / 2 }
        ];
    
        const transformedCorners = corners.map(corner => {
            // 1. Scale
            let x = corner.x * t.scale * t.scaleX;
            let y = corner.y * t.scale * t.scaleY;
            // 2. Rotate
            const rad = t.rotation * Math.PI / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            let rotX = x * cos - y * sin;
            let rotY = x * sin + y * cos;
            // 3. Translate
            return { x: rotX + t.x, y: rotY + t.y };
        });
    
        return {
            minX: Math.min(...transformedCorners.map(c => c.x)),
            maxX: Math.max(...transformedCorners.map(c => c.x)),
            minY: Math.min(...transformedCorners.map(c => c.y)),
            maxY: Math.max(...transformedCorners.map(c => c.y)),
        };
    }
    // ★新規: 変形がフレーム内に収まるかチェックします
    isTransformWithinBounds(layer, newTransform) {
        const bbox = this.getLayerBoundingBox(layer, newTransform);
        const frameW = this.app.canvasManager.frameCanvas.width;
        const frameH = this.app.canvasManager.frameCanvas.height;
        const bounds = {
            left: -frameW / 2, right: frameW / 2,
            top: -frameH / 2, bottom: frameH / 2,
        };
        return bbox.minX >= bounds.left && bbox.maxX <= bounds.right &&
               bbox.minY >= bounds.top && bbox.maxY <= bounds.bottom;
    }
    
    // ★修正: レイヤー移動処理に境界チェックを追加
    moveActiveLayer(dx, dy, isDrag = false) {
        const layer = this.getCurrentLayer();
        if (!layer) return;

        const newTransform = JSON.parse(JSON.stringify(layer.transform));
        newTransform.x += dx;
        newTransform.y += dy;
        
        // ドラッグ中ははみ出てもよいが、最終的にはみ出ないように調整する
        if (!isDrag && !this.isTransformWithinBounds(layer, newTransform)) {
            // 現状では、はみ出す移動はキャンセルする（より良いUIは、境界で止めること）
            return; 
        }
        
        layer.transform.x += dx;
        layer.transform.y += dy;
        this.updateLayerTransform(layer);
    }
    
    // ★修正: レイヤー拡縮処理に境界チェックと倍率制限を追加
    scaleActiveLayer(factor) {
        const layer = this.getCurrentLayer();
        if (!layer) return;
        
        const originalScale = layer.transform.scale;
        const newTransform = JSON.parse(JSON.stringify(layer.transform));
        
        // スケール倍率を0.1倍から5倍の間に制限
        newTransform.scale = Math.max(0.1, Math.min(originalScale * factor, 5.0));

        if (this.isTransformWithinBounds(layer, newTransform)) {
            layer.transform.scale = newTransform.scale;
            this.updateLayerTransform(layer);
        }
    }
    
    // ★修正: レイヤー回転処理に境界チェックを追加
    rotateActiveLayer(degrees) {
        const layer = this.getCurrentLayer();
        if (!layer) return;
        
        const newTransform = JSON.parse(JSON.stringify(layer.transform));
        newTransform.rotation = (newTransform.rotation + degrees) % 360;

        if (this.isTransformWithinBounds(layer, newTransform)) {
            layer.transform.rotation = newTransform.rotation;
            this.updateLayerTransform(layer);
        }
    }
    
    flipActiveLayerHorizontal() {
        const layer = this.getCurrentLayer();
        if (layer) {
            layer.transform.scaleX *= -1;
            this.updateLayerTransform(layer);
        }
    }
    flipActiveLayerVertical() {
        const layer = this.getCurrentLayer();
        if (layer) {
            layer.transform.scaleY *= -1;
            this.updateLayerTransform(layer);
        }
    }
}
class ToolManager {
    constructor(app) {
        this.app = app;
        this.currentTool = 'pen';
        this.bindEvents();
    }
    bindEvents() {
        document.getElementById('pen-tool').addEventListener('click', () => this.setTool('pen'));
        document.getElementById('eraser-tool').addEventListener('click', () => this.setTool('eraser'));
        document.getElementById('move-tool').addEventListener('click', () => this.setTool('move'));
        document.getElementById('bucket-tool').addEventListener('click', () => this.setTool('bucket'));
    }
    setTool(tool) {
        this.currentTool = tool;
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        const toolButton = document.getElementById(tool + '-tool');
        if (toolButton) toolButton.classList.add('active');
        this.app.canvasManager.setCurrentTool(tool);
        this.app.canvasManager.updateCursor();
        // ★修正: moveツール選択時に全レイヤーのポインタイベントを切り替える
        this.app.layerManager.switchLayer(this.app.layerManager.activeLayerIndex);
    }
    getCurrentTool() {
        return this.currentTool;
    }
}
class PenSettingsManager {
    constructor(app) {
        this.app = app;
        this.currentSize = 1;
        this.sizes = Array.from(document.querySelectorAll('.size-btn')).map(btn => parseInt(btn.dataset.size));
        this.currentSizeIndex = this.sizes.indexOf(this.currentSize);
        this.bindEvents();
        this.updateSizeButtonVisuals();
    }
    bindEvents() {
        document.querySelectorAll('.size-btn').forEach(btn => {
            btn.addEventListener('click', () => this.setSize(parseInt(btn.dataset.size)));
        });
    }
    setSize(size) {
        this.currentSize = size;
        this.currentSizeIndex = this.sizes.indexOf(this.currentSize);
        document.querySelectorAll('.size-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-size="${size}"]`)?.classList.add('active');
        this.app.canvasManager.setCurrentSize(this.currentSize);
        this.updateSizeButtonVisuals();
    }
    changeSize(increase) {
        let newIndex = this.currentSizeIndex + (increase ? 1 : -1);
        newIndex = Math.max(0, Math.min(newIndex, this.sizes.length - 1));
        this.setSize(this.sizes[newIndex]);
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
}
class ColorManager {
    constructor(app) {
        this.app = app;
        this.mainColor = '#800000';
        this.subColor = '#f0e0d6';
        this.colors = Array.from(document.querySelectorAll('.color-btn')).map(btn => btn.dataset.color);
        this.currentColorIndex = this.colors.indexOf(this.mainColor);
        this.mainColorDisplay = document.getElementById('main-color-display');
        this.subColorDisplay = document.getElementById('sub-color-display');
        this.bindEvents();
        this.updateColorDisplays();
        document.querySelector(`[data-color="${this.mainColor}"]`)?.classList.add('active');
    }
    bindEvents() {
        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.setColor(e.currentTarget.dataset.color));
        });
        document.querySelector('.color-mode-display').addEventListener('click', () => this.swapColors());
    }
    setColor(color) {
        this.mainColor = color;
        this.currentColorIndex = this.colors.indexOf(this.mainColor);
        document.querySelectorAll('.color-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-color="${color}"]`)?.classList.add('active');
        this.updateColorDisplays();
        this.app.canvasManager.setCurrentColor(this.mainColor);
    }
    updateColorDisplays() {
        this.mainColorDisplay.style.backgroundColor = this.mainColor;
        this.subColorDisplay.style.backgroundColor = this.subColor;
    }
    swapColors() {
        [this.mainColor, this.subColor] = [this.subColor, this.mainColor];
        this.updateColorDisplays();
        this.setColor(this.mainColor);
    }
    resetColors() {
        this.mainColor = '#800000';
        this.subColor = '#f0e0d6';
        this.updateColorDisplays();
        this.setColor(this.mainColor);
    }
    changeColor(increase) {
        let newIndex = this.currentColorIndex + (increase ? 1 : -1);
        newIndex = Math.max(0, Math.min(newIndex, this.colors.length - 1));
        this.setColor(this.colors[newIndex]);
    }
}