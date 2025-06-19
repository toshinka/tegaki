// 🚨 Toshinka Tegaki Tool v1-4系 transform/Undo/Redo/座標厳格運用版（命令書完全準拠）🚨

class CanvasManager {
    constructor(app) {
        this.app = app;
        // compositeCanvas: 合成表示用
        let composite = document.getElementById('composite-canvas');
        if (!composite) {
            composite = document.createElement('canvas');
            composite.id = 'composite-canvas';
            composite.width = 344;
            composite.height = 135;
            document.getElementById('canvas-container').appendChild(composite);
        }
        this.compositeCanvas = composite;
        this.compositeCtx = composite.getContext('2d');
        // frameCanvas: 額縁
        let frame = document.getElementById('frame-canvas');
        if (!frame) {
            frame = document.createElement('canvas');
            frame.id = 'frame-canvas';
            frame.width = 344;
            frame.height = 135;
            document.getElementById('canvas-container').appendChild(frame);
        }
        this.frameCanvas = frame;
        this.frameCtx = frame.getContext('2d');
        // ビュー変換（compositeCanvas, frameCanvas専用）
        this.viewTransform = { x: 0, y: 0, scale: 1, rotation: 0 };
        this.isSpaceDown = false;
        this.isPanning = false;
        this.isRotatingWithSpace = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.panStartX = 0;
        this.panStartY = 0;
        this.rotateStartAngle = 0;
        this.initialViewRotation = 0;
        this.bindEvents();
        this.drawFrame();
    }
    bindEvents() {
        const area = this.compositeCanvas;
        area.addEventListener('pointerdown', this.onPointerDown.bind(this));
        document.addEventListener('pointermove', this.onPointerMove.bind(this));
        document.addEventListener('pointerup', this.onPointerUp.bind(this));
        area.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
    }
    // 額縁描画
    drawFrame() {
        const ctx = this.frameCtx, w = this.frameCanvas.width, h = this.frameCanvas.height;
        ctx.clearRect(0, 0, w, h);
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#cccccc';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(0.5, 0.5, w - 1, h - 1, 8);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }
    // ビュー操作(pointer, Space系)
    onPointerDown(e) {
        if (this.isSpaceDown) {
            const rect = this.compositeCanvas.getBoundingClientRect();
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
            if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
                this.isPanning = true;
                this.panStartX = this.viewTransform.x;
                this.panStartY = this.viewTransform.y;
            } else {
                this.isRotatingWithSpace = true;
                const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
                this.rotateStartAngle = Math.atan2(e.clientY - cy, e.clientX - cx);
                this.initialViewRotation = this.viewTransform.rotation;
            }
            e.preventDefault();
            try { document.documentElement.setPointerCapture(e.pointerId); } catch (_){}
            return;
        }
        // ペン/レイヤー操作はShortcutManagerに委譲
        this.app.shortcutManager.handlePenPointerDown(e);
    }
    onPointerMove(e) {
        if (!e.buttons) return;
        if (this.isRotatingWithSpace) {
            const rect = this.compositeCanvas.getBoundingClientRect();
            const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
            const curAngle = Math.atan2(e.clientY - cy, e.clientX - cx);
            const delta = curAngle - this.rotateStartAngle;
            this.viewTransform.rotation = this.initialViewRotation + delta;
            this.app.layerManager.drawComposite();
        } else if (this.isPanning) {
            const dx = e.clientX - this.dragStartX, dy = e.clientY - this.dragStartY;
            this.viewTransform.x = this.panStartX + dx;
            this.viewTransform.y = this.panStartY + dy;
            this.app.layerManager.drawComposite();
        }
    }
    onPointerUp(e) {
        try { if (document.documentElement.hasPointerCapture(e.pointerId)) document.documentElement.releasePointerCapture(e.pointerId); } catch (_){}
        this.isPanning = false;
        this.isRotatingWithSpace = false;
    }
    handleWheel(e) {
        // Space+ホイール: view操作のみ
        if (this.isSpaceDown) {
            e.preventDefault();
            if (e.shiftKey) {
                // 回転
                this.viewTransform.rotation += (e.deltaY > 0 ? 1 : -1) * Math.PI / 12;
            } else {
                // 拡大縮小
                const factor = e.deltaY < 0 ? 1.1 : 1/1.1;
                this.viewTransform.scale = Math.max(0.2, Math.min(this.viewTransform.scale * factor, 10));
            }
            this.app.layerManager.drawComposite();
            return;
        }
        // v+系ショートカット委譲（レイヤーtransform専用）
        this.app.shortcutManager.handleLayerWheel(e);
    }
    resetView() {
        this.viewTransform = { x:0, y:0, scale:1, rotation:0 };
        this.app.layerManager.drawComposite();
    }
    // 描画時: 座標逆変換
    getLayerDrawCoord(rawX, rawY, layer) {
        // composite→viewTransform逆→layer.transform逆
        const w = this.compositeCanvas.width, h = this.compositeCanvas.height;
        let x = rawX - this.compositeCanvas.getBoundingClientRect().left;
        let y = rawY - this.compositeCanvas.getBoundingClientRect().top;
        let cx = w / 2, cy = h / 2;
        x -= cx; y -= cy;
        // viewTransform逆
        let vt = this.viewTransform;
        x /= vt.scale; y /= vt.scale;
        const sinV = Math.sin(-vt.rotation), cosV = Math.cos(-vt.rotation);
        let x2 = x * cosV - y * sinV, y2 = x * sinV + y * cosV;
        x2 -= vt.x; y2 -= vt.y;
        // layer.transform逆
        const lt = layer.transform;
        x2 /= lt.scale * lt.scaleX; y2 /= lt.scale * lt.scaleY;
        const sinL = Math.sin(-lt.rotation), cosL = Math.cos(-lt.rotation);
        let x3 = x2 * cosL - y2 * sinL, y3 = x2 * sinL + y2 * cosL;
        x3 -= lt.x; y3 -= lt.y;
        return { x: x3 + cx, y: y3 + cy };
    }
}

class LayerManager {
    constructor(app) {
        this.app = app;
        this.layers = [];
        this.activeLayerIndex = -1;
    }
    getDefaultTransform() {
        return { x:0, y:0, scale:1, rotation:0, scaleX:1, scaleY:1 };
    }
    setupInitialLayers() {
        const baseCanvas = document.getElementById('drawing-layer0');
        if (!baseCanvas) return;
        this.layers = []; // ←明示的に初期化
        this.layers.push({
            canvas: baseCanvas,
            ctx: baseCanvas.getContext('2d'),
            transform: this.getDefaultTransform(),
            history: [],
            historyIndex: -1,
        });
        const ctx = this.layers[0].ctx;
        ctx.fillStyle = '#f0e0d6';
        ctx.fillRect(0, 0, baseCanvas.width, baseCanvas.height);
        this.switchLayer(0);
        this.drawComposite();
    }
    addLayer() {
        if (this.layers.length === 0) return null;
        const base = this.layers[0].canvas;
        const newCanvas = document.createElement('canvas');
        newCanvas.width = base.width;
        newCanvas.height = base.height;
        newCanvas.className = 'main-canvas';
        newCanvas.id = `drawing-layer${this.layers.length}`;
        document.getElementById('layer-stack')?.appendChild(newCanvas);
        // HTML構造は触らずappendだけ
        const newLayer = {
            canvas: newCanvas,
            ctx: newCanvas.getContext('2d'),
            transform: this.getDefaultTransform(),
            history: [],
            historyIndex: -1,
        };
        this.layers.push(newLayer);
        this.switchLayer(this.layers.length - 1);
        this.drawComposite();
        return newLayer;
    }
    switchLayer(index) {
        if (index < 0 || index >= this.layers.length) return;
        this.activeLayerIndex = index;
        if (document.getElementById('current-layer-info')) {
            document.getElementById('current-layer-info').textContent = `L: ${index+1}/${this.layers.length}`;
        }
    }
    getActiveLayer() {
        return this.layers[this.activeLayerIndex];
    }
    // 合成ループ
    drawComposite() {
        const composite = this.app.canvasManager.compositeCanvas;
        const ctx = this.app.canvasManager.compositeCtx;
        const w = composite.width, h = composite.height, cx = w/2, cy = h/2;
        ctx.clearRect(0,0,w,h);
        ctx.save();
        // viewTransform
        const vt = this.app.canvasManager.viewTransform;
        ctx.translate(cx, cy);
        ctx.translate(vt.x, vt.y);
        ctx.rotate(vt.rotation);
        ctx.scale(vt.scale, vt.scale);
        ctx.beginPath(); ctx.rect(-cx, -cy, w, h); ctx.clip();
        for (const layer of this.layers) {
            ctx.save();
            const t = layer.transform;
            ctx.translate(t.x, t.y);
            ctx.rotate(t.rotation);
            ctx.scale(t.scale * t.scaleX, t.scale * t.scaleY);
            ctx.drawImage(layer.canvas, -cx, -cy);
            ctx.restore();
        }
        ctx.restore();
        this.app.canvasManager.drawFrame();
    }
    // レイヤーtransform系（v+系のみ！）
    moveActiveLayer(dx, dy) {
        if (this.activeLayerIndex === 0) return; // drawing-layer0は移動禁止
        const l = this.getActiveLayer();
        l.transform.x += dx;
        this.saveState();
        this.drawComposite();
    }
    scaleActiveLayer(factor) {
        if (this.activeLayerIndex === 0) return; // drawing-layer0はスケール禁止
        const l = this.getActiveLayer();
        l.transform.scale *= factor;
        this.saveState();
        this.drawComposite();
    }
    rotateActiveLayer(deg) {
        if (this.activeLayerIndex === 0) return; // drawing-layer0は回転禁止
        const l = this.getActiveLayer();
        l.transform.rotation += deg * Math.PI / 180;
        this.saveState();
        this.drawComposite();
    }
    flipActiveLayerHorizontal() {
        if (this.activeLayerIndex === 0) return; // drawing-layer0は反転禁止
        const l = this.getActiveLayer();
        l.transform.scaleX *= -1;
        this.saveState();
        this.drawComposite();
    }
    flipActiveLayerVertical() {
        if (this.activeLayerIndex === 0) return; // drawing-layer0は反転禁止
        const l = this.getActiveLayer();
        l.transform.scaleY *= -1;
        this.saveState();
        this.drawComposite();
    }
    // Undo/Redo履歴
    saveState() {
        const l = this.getActiveLayer();
        const imageData = l.ctx.getImageData(0,0,l.canvas.width,l.canvas.height);
        const transformCopy = JSON.parse(JSON.stringify(l.transform));
        if (l.historyIndex < l.history.length - 1) {
            l.history = l.history.slice(0, l.historyIndex+1);
        }
        l.history.push({ imageData, transform: transformCopy });
        l.historyIndex++;
    }
    undo() {
        const l = this.getActiveLayer();
        if (l.historyIndex > 0) {
            l.historyIndex--;
            const hist = l.history[l.historyIndex];
            l.ctx.putImageData(hist.imageData, 0, 0);
            l.transform = JSON.parse(JSON.stringify(hist.transform));
            this.drawComposite();
        }
    }
    redo() {
        const l = this.getActiveLayer();
        if (l.historyIndex < l.history.length - 1) {
            l.historyIndex++;
            const hist = l.history[l.historyIndex];
            l.ctx.putImageData(hist.imageData, 0, 0);
            l.transform = JSON.parse(JSON.stringify(hist.transform));
            this.drawComposite();
        }
    }
    clearActiveLayer() {
        const l = this.getActiveLayer();
        l.ctx.clearRect(0,0,l.canvas.width,l.canvas.height);
        if (this.activeLayerIndex === 0) {
            // drawing-layer0のみ初期色で塗りつぶす
            l.ctx.fillStyle = '#f0e0d6';
            l.ctx.fillRect(0,0,l.canvas.width,l.canvas.height);
        }
        this.saveState();
        this.drawComposite();
    }
    clearAllLayers() {
        for (let i=0; i<this.layers.length; ++i) {
            const l = this.layers[i];
            l.ctx.clearRect(0,0,l.canvas.width,l.canvas.height);
            if (i===0) {
                l.ctx.fillStyle = '#f0e0d6';
                l.ctx.fillRect(0,0,l.canvas.width,l.canvas.height);
            }
            l.transform = this.getDefaultTransform();
            this.saveState();
        }
        this.drawComposite();
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
        const btn = document.getElementById(tool + '-tool');
        if (btn) btn.classList.add('active');
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
    getCurrentSize() {
        return this.currentSize;
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
    getColor() {
        return this.mainColor;
    }
}