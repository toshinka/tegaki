// [座標変換再構築版] Toshinka Tegaki Tool v1-4 core (rev1-based)
// 命令書に従い「TransformManager」新設・Undo/Redo拡張・変換制約・UI/UX完全維持
// [!!] 既存のHTML/CSS/UI/操作感は一切変更しないこと

// --- TransformManager定義 ---
const TRANSFORM_LIMITS = {
    scale: { min: 0.1, max: 5.0 },
    rotation: { min: -Math.PI, max: Math.PI },
    position: {
        x: { min: -100, max: 100 },
        y: { min: -100, max: 100 }
    }
};

// 変換管理クラス（グローバル＋レイヤー）
class TransformManager {
    constructor() {
        // グローバル変換
        this.globalTransform = {
            x: 0, y: 0,
            scale: 1,
            rotation: 0 // [ラジアン]
        };
        // レイヤーごとの変換
        this.layerTransforms = new Map(); // layerId(string) → {x,y,scale,rotation}
    }

    setGlobalTransform(t) {
        this.globalTransform = this._clampTransform(t);
    }
    getGlobalTransform() {
        return { ...this.globalTransform };
    }

    setLayerTransform(layerId, t) {
        this.layerTransforms.set(layerId, this._clampTransform(t));
    }
    getLayerTransform(layerId) {
        return this.layerTransforms.has(layerId)
            ? { ...this.layerTransforms.get(layerId) }
            : { x: 0, y: 0, scale: 1, rotation: 0 };
    }

    // [重要] グローバル→レイヤーの順で合成
    transformCoordinates(x, y, layerId = null) {
        let [px, py] = this._applyTransform(x, y, this.globalTransform);
        if (layerId && this.layerTransforms.has(layerId)) {
            [px, py] = this._applyTransform(px, py, this.layerTransforms.get(layerId));
        }
        return this._validateCoordinates(px, py);
    }

    // --- 内部: 2D変換適用 ---
    _applyTransform(x, y, t) {
        // スケール・回転・平行移動
        const rad = t.rotation;
        const cos = Math.cos(rad), sin = Math.sin(rad);
        let nx = x * t.scale, ny = y * t.scale;
        // 回転
        let rx = nx * cos - ny * sin;
        let ry = nx * sin + ny * cos;
        return [rx + t.x, ry + t.y];
    }

    // --- 範囲クランプ ---
    _clampTransform(t) {
        return {
            x: Math.max(TRANSFORM_LIMITS.position.x.min, Math.min(t.x, TRANSFORM_LIMITS.position.x.max)),
            y: Math.max(TRANSFORM_LIMITS.position.y.min, Math.min(t.y, TRANSFORM_LIMITS.position.y.max)),
            scale: Math.max(TRANSFORM_LIMITS.scale.min, Math.min(t.scale, TRANSFORM_LIMITS.scale.max)),
            rotation: Math.max(TRANSFORM_LIMITS.rotation.min, Math.min(t.rotation, TRANSFORM_LIMITS.rotation.max))
        };
    }

    _validateCoordinates(x, y) {
        // 無限大・NaNは強制0
        if (!isFinite(x) || isNaN(x)) x = 0;
        if (!isFinite(y) || isNaN(y)) y = 0;
        // 画面外にはみ出させない（キャンバスの中心から±100px）
        x = Math.max(-100, Math.min(x, 344 + 100));
        y = Math.max(-100, Math.min(y, 135 + 100));
        return [x, y];
    }
}

// --- Undo/Redo用: 変換も保存 ---
class HistoryState {
    constructor(imageData, globalTransform, layerTransforms) {
        this.imageData = imageData;
        this.globalTransform = { ...globalTransform };
        // Map複製
        this.layerTransforms = new Map();
        for (let [k, v] of layerTransforms.entries()) {
            this.layerTransforms.set(k, { ...v });
        }
        this.timestamp = Date.now();
    }
}

// --- ここから従来のCanvasManagerを再構築 ---
class CanvasManager {
    constructor(app) {
        this.app = app;
        this.canvas = null;
        this.ctx = null;
        this.canvasArea = document.getElementById('canvas-area');
        this.canvasContainer = document.getElementById('canvas-container');
        this.frameCanvas = null;

        // --- 変換管理 ---
        this.transformManager = new TransformManager();

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

        // --- Undo/Redo拡張 ---
        this.history = [];
        this.historyIndex = -1;

        this.dragStartX = 0;
        this.dragStartY = 0;
        this.canvasStartX = 0;
        this.canvasStartY = 0;
        this.moveLayerStartX = 0;
        this.moveLayerStartY = 0;
        this.moveLayerImageData = null;

        // [廃止] scale/rotation/transformState
        //this.scale = 1;
        //this.rotation = 0;
        //this.transformState = { scaleX: 1, scaleY: 1 };

        this.createAndDrawFrame();
        this.bindEvents();
    }

    // --- フレーム描画は従来通り ---
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

    // --- ポインタイベント ---
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
                this.initialRotation = this.transformManager.globalTransform.rotation;
            }
            e.preventDefault();
        } else {
            if (!this.canvas || e.target !== this.canvas) return;
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
        try { document.documentElement.setPointerCapture(e.pointerId); } catch (err) { }
    }

    onPointerMove(e) {
        if (!e.buttons) return;
        if (this.isRotatingWithSpace) {
            const rect = this.canvasContainer.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const currentAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
            const deltaAngle = (currentAngle - this.rotateStartAngle);
            // --- [重要] グローバル回転を制約付きで更新 ---
            let newRad = this.initialRotation + deltaAngle;
            newRad = Math.max(TRANSFORM_LIMITS.rotation.min, Math.min(newRad, TRANSFORM_LIMITS.rotation.max));
            this.transformManager.globalTransform.rotation = newRad;
            this.updateCanvasTransform();
        } else if (this.isPanning) {
            const deltaX = e.clientX - this.dragStartX;
            const deltaY = e.clientY - this.dragStartY;
            this.canvasContainer.style.left = (this.canvasStartX + deltaX) + 'px';
            this.canvasContainer.style.top = (this.canvasStartY + deltaY) + 'px';
        } else if (this.isMovingLayer) {
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

    // --- 座標変換: グローバル→レイヤー一元化 ---
    getCanvasCoordinates(e) {
        // 画面中心を原点とする
        const containerRect = this.canvasContainer.getBoundingClientRect();
        const centerX = containerRect.left + containerRect.width / 2;
        const centerY = containerRect.top + containerRect.height / 2;
        let mouseX = e.clientX - centerX;
        let mouseY = e.clientY - centerY;
        // [逆変換] グローバル→レイヤーの逆を順に
        let t_global = this.transformManager.globalTransform;
        let t_layer = this.app.layerManager.getCurrentLayerTransform();

        // --- 逆順で逆変換を適用 ---
        [mouseX, mouseY] = this.inverseApplyTransform(mouseX, mouseY, t_layer);
        [mouseX, mouseY] = this.inverseApplyTransform(mouseX, mouseY, t_global);

        const canvasX = mouseX + this.canvas.width / 2;
        const canvasY = mouseY + this.canvas.height / 2;
        return { x: canvasX, y: canvasY };
    }

    // 逆変換: 回転→スケール→平行移動
    inverseApplyTransform(x, y, t) {
        // 平行移動逆
        let nx = x - t.x, ny = y - t.y;
        // 回転逆
        const rad = -t.rotation;
        const cos = Math.cos(rad), sin = Math.sin(rad);
        let rx = nx * cos - ny * sin;
        let ry = nx * sin + ny * cos;
        // スケール逆
        if (t.scale !== 0) {
            rx /= t.scale;
            ry /= t.scale;
        }
        return [rx, ry];
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
        switch (this.currentTool) {
            case 'move': this.canvas.style.cursor = 'move'; break;
            case 'pen':
            case 'eraser':
            case 'bucket':
            default: this.canvas.style.cursor = 'crosshair'; break;
        }
    }

    // --- Undo/Redo: 変換状態も保存 ---
    saveState() {
        if (!this.ctx) return;
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const globalTransform = this.transformManager.getGlobalTransform();
        const layerTransforms = this.app.layerManager.getAllLayerTransforms();
        this.history.push(new HistoryState(imageData, globalTransform, layerTransforms));
        this.historyIndex++;
    }
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.restoreHistoryState(this.history[this.historyIndex]);
        }
    }
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.restoreHistoryState(this.history[this.historyIndex]);
        }
    }
    restoreHistoryState(state) {
        this.ctx.putImageData(state.imageData, 0, 0);
        this.transformManager.setGlobalTransform(state.globalTransform);
        this.app.layerManager.setAllLayerTransforms(state.layerTransforms);
        this.updateCanvasTransform();
        this.app.layerManager.updateAllLayerTransforms();
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

    // --- グローバル変換API ---
    flipHorizontal() {
        let t = this.transformManager.getGlobalTransform();
        t.scale *= -1;
        this.transformManager.setGlobalTransform(t);
        this.updateCanvasTransform();
    }
    flipVertical() {
        // flipYは未サポート（命令書通り変換制約）
        // 必要ならscaleY導入
        // 今回はグローバルY反転禁止
    }
    zoom(factor) {
        let t = this.transformManager.getGlobalTransform();
        t.scale *= factor;
        this.transformManager.setGlobalTransform(t);
        this.updateCanvasTransform();
    }
    rotate(degrees) {
        let t = this.transformManager.getGlobalTransform();
        t.rotation += degrees * Math.PI / 180;
        this.transformManager.setGlobalTransform(t);
        this.updateCanvasTransform();
    }
    updateCanvasTransform() {
        // [UI] グローバル変換のみcanvasContainerに反映
        const t = this.transformManager.getGlobalTransform();
        const deg = t.rotation * 180 / Math.PI;
        this.canvasContainer.style.transform =
            `rotate(${deg}deg) scale(${t.scale},${t.scale})`;
    }
    resetView() {
        this.transformManager.setGlobalTransform({ x: 0, y: 0, scale: 1, rotation: 0 });
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

    // --- 塗りつぶし系は従来通り ---
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

// --- LayerManager: 変換管理をTransformManagerに委譲 ---
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
            rotation: 0
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
            id: "layer0"
        });
        // TransformManagerに登録
        this.app.canvasManager.transformManager.setLayerTransform("layer0", this.getDefaultTransform());
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
            id: "layer" + this.layers.length
        };
        this.layers.push(newLayer);
        // TransformManager登録
        this.app.canvasManager.transformManager.setLayerTransform(newLayer.id, this.getDefaultTransform());
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
                layer.canvas.style.pointerEvents = (i === index) ? 'auto' : 'none';
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
    getCurrentLayerTransform() {
        const layer = this.getCurrentLayer();
        if (layer) {
            return this.app.canvasManager.transformManager.getLayerTransform(layer.id);
        }
        return this.getDefaultTransform();
    }
    updateLayerTransform(layer) {
        if (!layer) return;
        const t = this.app.canvasManager.transformManager.getLayerTransform(layer.id);
        // レイヤーのcanvasにのみ適用
        const deg = t.rotation * 180 / Math.PI;
        layer.canvas.style.transform =
            `translate(${t.x}px,${t.y}px) rotate(${deg}deg) scale(${t.scale},${t.scale})`;
    }
    updateAllLayerTransforms() {
        this.layers.forEach(layer => this.updateLayerTransform(layer));
    }
    updateAllLayerZIndexes() {
        this.layers.forEach((layer, index) => {
            layer.canvas.style.zIndex = index;
        });
    }
    // 変換API（制約付きでTransformManagerに反映）
    moveActiveLayer(dx, dy) {
        const layer = this.getCurrentLayer();
        if (layer) {
            let t = this.app.canvasManager.transformManager.getLayerTransform(layer.id);
            t.x += dx;
            this.app.canvasManager.transformManager.setLayerTransform(layer.id, t);
            this.updateLayerTransform(layer);
        }
    }
    scaleActiveLayer(factor) {
        const layer = this.getCurrentLayer();
        if (layer) {
            let t = this.app.canvasManager.transformManager.getLayerTransform(layer.id);
            t.scale *= factor;
            this.app.canvasManager.transformManager.setLayerTransform(layer.id, t);
            this.updateLayerTransform(layer);
        }
    }
    rotateActiveLayer(degrees) {
        const layer = this.getCurrentLayer();
        if (layer) {
            let t = this.app.canvasManager.transformManager.getLayerTransform(layer.id);
            t.rotation += degrees * Math.PI / 180;
            this.app.canvasManager.transformManager.setLayerTransform(layer.id, t);
            this.updateLayerTransform(layer);
        }
    }
    flipActiveLayerHorizontal() {
        // 水平反転 → scale *= -1
        const layer = this.getCurrentLayer();
        if (layer) {
            let t = this.app.canvasManager.transformManager.getLayerTransform(layer.id);
            t.scale *= -1;
            this.app.canvasManager.transformManager.setLayerTransform(layer.id, t);
            this.updateLayerTransform(layer);
        }
    }
    flipActiveLayerVertical() {
        // 垂直反転は未サポート（拡張時のみ）
    }
    // Undo/Redo用
    getAllLayerTransforms() {
        const map = new Map();
        for (let layer of this.layers) {
            map.set(layer.id, this.app.canvasManager.transformManager.getLayerTransform(layer.id));
        }
        return map;
    }
    setAllLayerTransforms(map) {
        for (let layer of this.layers) {
            if (map.has(layer.id)) {
                this.app.canvasManager.transformManager.setLayerTransform(layer.id, map.get(layer.id));
            }
        }
        this.updateAllLayerTransforms();
    }
}

// --- 以下はToolManager/PenSettingsManager/ColorManagerは変更不要（命令書どおり） ---
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