// Toshinka Tegaki Tool v1-4 core-v1-4rev2.js
// transform刷新・ビュー/レイヤー分離・アクティブキャンバス仕様準拠

class CanvasManager {
    constructor(app) {
        this.app = app;
        // Layer管理
        this.layers = [];
        this.activeLayerIndex = 0;
        this.activeCanvas = null;
        this.activeCtx = null;

        // 合成・額縁キャンバス
        this.compositeCanvas = null;
        this.compositeCtx = null;
        this.frameCanvas = null;
        this.frameCtx = null;

        // ビューtransform (Space+系操作用)
        this.viewTransform = {
            x: 0,
            y: 0,
            scale: 1,
            rotation: 0
        };

        // 描画操作
        this.isDrawing = false;
        this.lastX = 0;
        this.lastY = 0;

        // レイヤー移動操作
        this.isLayerMoving = false;
        this.layerMoveStart = { x: 0, y: 0 };

        // Undo履歴
        this.history = [];
        this.historyIndex = -1;

        // 現在ツール
        this.currentTool = 'pen';
        this.currentColor = '#800000';
        this.currentSize = 1;

        this.initCanvases();
        this.initLayers();
    }

    // 初期化(HTML内canvasの差し替え)
    initCanvases() {
        // compositeCanvas
        this.compositeCanvas = document.createElement('canvas');
        this.compositeCanvas.id = 'composite-canvas';
        this.compositeCanvas.width = 344;
        this.compositeCanvas.height = 135;
        this.compositeCanvas.className = 'main-canvas';
        this.compositeCanvas.style.position = 'absolute';
        this.compositeCanvas.style.left = '0';
        this.compositeCanvas.style.top = '0';
        this.compositeCanvas.style.zIndex = '0';
        this.compositeCanvas.style.pointerEvents = 'auto';
        this.compositeCtx = this.compositeCanvas.getContext('2d');

        // frameCanvas
        this.frameCanvas = document.createElement('canvas');
        this.frameCanvas.id = 'frame-canvas';
        this.frameCanvas.width = 344;
        this.frameCanvas.height = 135;
        this.frameCanvas.style.position = 'absolute';
        this.frameCanvas.style.left = '0';
        this.frameCanvas.style.top = '0';
        this.frameCanvas.style.zIndex = '2';
        this.frameCanvas.style.pointerEvents = 'none';
        this.frameCtx = this.frameCanvas.getContext('2d');

        // canvas-containerへ全て追加
        const container = document.getElementById('canvas-container');
        // 既存canvas削除
        while (container.firstChild) container.removeChild(container.firstChild);
        container.appendChild(this.compositeCanvas);
        container.appendChild(this.frameCanvas);
    }

    // レイヤー初期化
    initLayers() {
        // 1枚目
        this.addLayer(true); // base layer
        this.setActiveLayer(0);
        this.refreshAll();
    }

    // レイヤー追加
    addLayer(isBase = false) {
        const canvas = document.createElement('canvas');
        canvas.width = 344;
        canvas.height = 135;
        canvas.className = 'main-canvas';
        canvas.style.position = 'absolute';
        canvas.style.left = '0';
        canvas.style.top = '0';
        canvas.style.zIndex = '1';
        canvas.style.pointerEvents = 'none'; // pointerはcompositeのみ反応
        const ctx = canvas.getContext('2d');
        // transform: レイヤー個別
        const layerTransform = {
            x: 0,
            y: 0,
            scale: 1,
            scaleX: 1,
            scaleY: 1,
            rotation: 0
        };
        if (isBase) {
            ctx.fillStyle = '#f0e0d6';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        this.layers.push({
            canvas,
            ctx,
            transform: layerTransform
        });
        return canvas;
    }

    // レイヤー切り替え
    setActiveLayer(idx) {
        if (idx < 0 || idx >= this.layers.length) return;
        this.activeLayerIndex = idx;
        this.activeCanvas = this.layers[idx].canvas;
        this.activeCtx = this.layers[idx].ctx;
    }

    // 合成描画
    drawComposite() {
        const w = this.compositeCanvas.width, h = this.compositeCanvas.height;
        const cx = w / 2, cy = h / 2;
        // クリア
        this.compositeCtx.clearRect(0, 0, w, h);

        // viewTransform適用
        this.compositeCtx.save();
        this.compositeCtx.translate(cx, cy);
        this.compositeCtx.translate(this.viewTransform.x, this.viewTransform.y);
        this.compositeCtx.rotate(this.viewTransform.rotation);
        this.compositeCtx.scale(this.viewTransform.scale, this.viewTransform.scale);

        // clip
        this.compositeCtx.beginPath();
        this.compositeCtx.rect(-cx, -cy, w, h);
        this.compositeCtx.clip();

        // 各レイヤー合成
        for (const layer of this.layers) {
            this.compositeCtx.save();
            const t = layer.transform;
            this.compositeCtx.translate(t.x, t.y);
            this.compositeCtx.rotate(t.rotation);
            this.compositeCtx.scale(t.scale * t.scaleX, t.scale * t.scaleY);
            this.compositeCtx.drawImage(layer.canvas, -cx, -cy);
            this.compositeCtx.restore();
        }
        this.compositeCtx.restore();
    }

    // 額縁描画
    drawFrame() {
        const w = this.frameCanvas.width, h = this.frameCanvas.height;
        const cx = w / 2, cy = h / 2;
        this.frameCtx.clearRect(0, 0, w, h);
        this.frameCtx.save();
        this.frameCtx.translate(cx, cy);
        this.frameCtx.translate(this.viewTransform.x, this.viewTransform.y);
        this.frameCtx.rotate(this.viewTransform.rotation);
        this.frameCtx.scale(this.viewTransform.scale, this.viewTransform.scale);
        // 額縁
        this.frameCtx.beginPath();
        this.frameCtx.roundRect(-cx + 0.5, -cy + 0.5, w - 1, h - 1, 8);
        this.frameCtx.fillStyle = '#fff';
        this.frameCtx.strokeStyle = '#cccccc';
        this.frameCtx.lineWidth = 1;
        this.frameCtx.fill();
        this.frameCtx.stroke();
        this.frameCtx.restore();
    }

    // 全リフレッシュ
    refreshAll() {
        this.drawComposite();
        this.drawFrame();
    }

    // activeCanvas描画座標逆変換
    getLayerDrawCoord(rawX, rawY) {
        // composite→viewTransform逆→layer.transform逆
        const w = this.compositeCanvas.width, h = this.compositeCanvas.height;
        let x = rawX - this.compositeCanvas.getBoundingClientRect().left;
        let y = rawY - this.compositeCanvas.getBoundingClientRect().top;
        // (1) canvas座標(cx, cy)基準
        let cx = w / 2, cy = h / 2;
        x -= cx;
        y -= cy;
        // (2) viewTransform逆
        let t = this.viewTransform;
        // scale, rotate, translate逆
        // (a) scale逆
        x /= t.scale;
        y /= t.scale;
        // (b) rotate逆
        const sinV = Math.sin(-t.rotation);
        const cosV = Math.cos(-t.rotation);
        let x2 = x * cosV - y * sinV;
        let y2 = x * sinV + y * cosV;
        // (c) translate逆
        x2 -= t.x;
        y2 -= t.y;

        // (3) layer.transform逆
        const lay = this.layers[this.activeLayerIndex];
        const l = lay.transform;
        // scale, rotate, translate逆
        // (a) scale逆
        x2 /= l.scale * l.scaleX;
        y2 /= l.scale * l.scaleY;
        // (b) rotate逆
        const sinL = Math.sin(-l.rotation);
        const cosL = Math.cos(-l.rotation);
        let x3 = x2 * cosL - y2 * sinL;
        let y3 = x2 * sinL + y2 * cosL;
        // (c) translate逆
        x3 -= l.x;
        y3 -= l.y;
        // (4) canvas原点化
        return {
            x: x3 + cx,
            y: y3 + cy
        };
    }

    // 描画開始
    pointerDown(e) {
        if (!this.activeCanvas) return;
        // pointer座標→逆変換
        const pt = this.getLayerDrawCoord(e.clientX, e.clientY);
        this.isDrawing = true;
        this.lastX = pt.x;
        this.lastY = pt.y;
        this.activeCtx.save();
        this.activeCtx.beginPath();
        this.activeCtx.moveTo(this.lastX, this.lastY);
        this.activeCtx.strokeStyle = this.currentColor;
        this.activeCtx.lineWidth = this.currentSize;
        this.activeCtx.lineCap = 'round';
        this.activeCtx.lineJoin = 'round';
    }

    // 描画中
    pointerMove(e) {
        if (!this.activeCanvas || !this.isDrawing) return;
        const pt = this.getLayerDrawCoord(e.clientX, e.clientY);
        this.activeCtx.lineTo(pt.x, pt.y);
        this.activeCtx.stroke();
        this.lastX = pt.x;
        this.lastY = pt.y;
        this.refreshAll();
    }

    // 描画終了
    pointerUp(e) {
        if (!this.activeCanvas || !this.isDrawing) return;
        this.isDrawing = false;
        this.activeCtx.closePath();
        this.activeCtx.restore();
        this.saveState();
        this.refreshAll();
    }

    // バケツ
    fillAtPointer(e) {
        // この例では省略: 必要に応じて実装
    }

    // Undo
    saveState() {
        // Undo履歴: アクティブレイヤーのみ
        if (!this.activeCtx) return;
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        this.history.push(this.activeCtx.getImageData(0, 0, this.activeCanvas.width, this.activeCanvas.height));
        this.historyIndex++;
    }
    undo() {
        if (!this.activeCtx) return;
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.activeCtx.putImageData(this.history[this.historyIndex], 0, 0);
            this.refreshAll();
        }
    }
    redo() {
        if (!this.activeCtx) return;
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.activeCtx.putImageData(this.history[this.historyIndex], 0, 0);
            this.refreshAll();
        }
    }

    // レイヤー操作（v+系）
    moveActiveLayer(dx, dy) {
        const layer = this.layers[this.activeLayerIndex];
        layer.transform.x += dx;
        this.refreshAll();
    }
    scaleActiveLayer(factor) {
        const layer = this.layers[this.activeLayerIndex];
        layer.transform.scale *= factor;
        this.refreshAll();
    }
    rotateActiveLayer(deg) {
        const layer = this.layers[this.activeLayerIndex];
        layer.transform.rotation += deg * Math.PI / 180;
        this.refreshAll();
    }
    flipActiveLayerH() {
        const layer = this.layers[this.activeLayerIndex];
        layer.transform.scaleX *= -1;
        this.refreshAll();
    }
    flipActiveLayerV() {
        const layer = this.layers[this.activeLayerIndex];
        layer.transform.scaleY *= -1;
        this.refreshAll();
    }

    // ビュー操作(Space+系)
    viewMove(dx, dy) {
        this.viewTransform.x += dx;
        this.refreshAll();
    }
    viewScale(factor) {
        this.viewTransform.scale *= factor;
        this.refreshAll();
    }
    viewRotate(deg) {
        this.viewTransform.rotation += deg * Math.PI / 180;
        this.refreshAll();
    }
    viewFlipH() {
        this.viewTransform.scale *= -1;
        this.refreshAll();
    }
    viewFlipV() {
        // 通常はscaleY未サポートだが仕様上必要なら追加
        this.viewTransform.scale *= -1;
        this.refreshAll();
    }
    viewReset() {
        this.viewTransform = { x: 0, y: 0, scale: 1, rotation: 0 };
        this.refreshAll();
    }

    // 全レイヤー消去
    clearAllLayers() {
        for (let i = 0; i < this.layers.length; ++i) {
            const ctx = this.layers[i].ctx;
            ctx.clearRect(0, 0, this.layers[i].canvas.width, this.layers[i].canvas.height);
            if (i === 0) {
                ctx.fillStyle = '#f0e0d6';
                ctx.fillRect(0, 0, this.layers[i].canvas.width, this.layers[i].canvas.height);
            }
        }
        this.saveState();
        this.refreshAll();
    }
    // アクティブレイヤー消去
    clearActiveLayer() {
        this.activeCtx.clearRect(0, 0, this.activeCanvas.width, this.activeCanvas.height);
        if (this.activeLayerIndex === 0) {
            this.activeCtx.fillStyle = '#f0e0d6';
            this.activeCtx.fillRect(0, 0, this.activeCanvas.width, this.activeCanvas.height);
        }
        this.saveState();
        this.refreshAll();
    }

    // --- UI接続 ---
    setCurrentTool(tool) {
        this.currentTool = tool;
    }
    setCurrentColor(color) {
        this.currentColor = color;
    }
    setCurrentSize(size) {
        this.currentSize = size;
    }
    getLayerCount() {
        return this.layers.length;
    }
    addNewLayer() {
        this.addLayer();
        this.setActiveLayer(this.layers.length - 1);
        this.refreshAll();
    }
    switchLayer(idx) {
        this.setActiveLayer(idx);
        this.refreshAll();
    }
}

class LayerManager {
    // LayerはCanvasManagerに集約
}

class ToolManager {
    constructor(app) {
        this.app = app;
        this.currentTool = 'pen';
    }
    setTool(tool) {
        this.currentTool = tool;
        this.app.canvasManager.setCurrentTool(tool);
    }
    getCurrentTool() {
        return this.currentTool;
    }
}

class PenSettingsManager {
    constructor(app) {
        this.app = app;
        this.currentSize = 1;
        this.sizes = [1, 3, 5, 10, 30];
    }
    setSize(size) {
        this.currentSize = size;
        this.app.canvasManager.setCurrentSize(size);
    }
    changeSize(increase) {
        let idx = this.sizes.indexOf(this.currentSize);
        idx = Math.max(0, Math.min(idx + (increase ? 1 : -1), this.sizes.length - 1));
        this.setSize(this.sizes[idx]);
    }
}

class ColorManager {
    constructor(app) {
        this.app = app;
        this.mainColor = '#800000';
        this.subColor = '#f0e0d6';
        this.palette = ['#800000', '#aa5a56', '#cf9c97', '#e9c2ba', '#f0e0d6'];
    }
    setColor(color) {
        this.mainColor = color;
        this.app.canvasManager.setCurrentColor(color);
    }
    swapColors() {
        [this.mainColor, this.subColor] = [this.subColor, this.mainColor];
        this.setColor(this.mainColor);
    }
    resetColors() {
        this.mainColor = '#800000';
        this.subColor = '#f0e0d6';
        this.setColor(this.mainColor);
    }
    changeColor(increase) {
        let idx = this.palette.indexOf(this.mainColor);
        idx = Math.max(0, Math.min(idx + (increase ? 1 : -1), this.palette.length - 1));
        this.setColor(this.palette[idx]);
    }
}