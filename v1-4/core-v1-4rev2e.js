// 🚨 Toshinka Tegaki Tool v1-4系 transform/Undo/Redo/座標厳格運用版（命令書完全準拠・rev2eデバッグ追加）🚨

class CanvasManager {
    constructor(app) {
        this.app = app;
        // compositeCanvas: 合成表示用
        let composite = document.getElementById('composite-canvas');
        this.compositeCanvas = composite;
        this.compositeCtx = composite.getContext('2d');
        // frameCanvas: 額縁
        let frame = document.getElementById('frame-canvas');
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
        // rev2e: 強制デバッグ描画
        if (window.forceDebugDraw) window.forceDebugDraw();
        console.log("CanvasManager initialized");
    }
    bindEvents() {
        const area = this.compositeCanvas;
        area.addEventListener('pointerdown', this.onPointerDown.bind(this));
        document.addEventListener('pointermove', this.onPointerMove.bind(this));
        document.addEventListener('pointerup', this.onPointerUp.bind(this));
        area.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
    }
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
        // rev2e: debug
        // console.log('drawFrame called');
    }
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
        if (this.isSpaceDown) {
            e.preventDefault();
            if (e.shiftKey) {
                this.viewTransform.rotation += (e.deltaY > 0 ? 1 : -1) * Math.PI / 12;
            } else {
                const factor = e.deltaY < 0 ? 1.1 : 1/1.1;
                this.viewTransform.scale = Math.max(0.2, Math.min(this.viewTransform.scale * factor, 10));
            }
            this.app.layerManager.drawComposite();
            return;
        }
        this.app.shortcutManager.handleLayerWheel(e);
    }
    resetView() {
        this.viewTransform = { x:0, y:0, scale:1, rotation:0 };
        this.app.layerManager.drawComposite();
    }
    getLayerDrawCoord(rawX, rawY, layer) {
        const w = this.compositeCanvas.width, h = this.compositeCanvas.height;
        let x = rawX - this.compositeCanvas.getBoundingClientRect().left;
        let y = rawY - this.compositeCanvas.getBoundingClientRect().top;
        let cx = w / 2, cy = h / 2;
        x -= cx; y -= cy;
        let vt = this.viewTransform;
        x /= vt.scale; y /= vt.scale;
        const sinV = Math.sin(-vt.rotation), cosV = Math.cos(-vt.rotation);
        let x2 = x * cosV - y * sinV, y2 = x * sinV + y * cosV;
        x2 -= vt.x; y2 -= vt.y;
        const lt = layer.transform;
        if (!layer._isBaseLayer) {
            x2 /= lt.scale * lt.scaleX; y2 /= lt.scale * lt.scaleY;
            const sinL = Math.sin(-lt.rotation), cosL = Math.cos(-lt.rotation);
            let x3 = x2 * cosL - y2 * sinL, y3 = x2 * sinL + y2 * cosL;
            x3 -= lt.x; y3 -= lt.y;
            return { x: x3 + cx, y: y3 + cy };
        } else {
            return { x: x2 + cx, y: y2 + cy };
        }
    }
}

// LayerManager, ToolManager, PenSettingsManager, ColorManager remain mostly as original
// Add debug logs and strong visibility checks

class LayerManager {
    constructor(app) {
        this.app = app;
        this.layers = [];
        this.activeLayerIndex = -1;
    }
    getDefaultTransform(isBaseLayer = false) {
        return isBaseLayer ?
            { x:0, y:0, scale:1, rotation:0, scaleX:1, scaleY:1 }
            : { x:0, y:0, scale:1, rotation:0, scaleX:1, scaleY:1 };
    }
    setupInitialLayers() {
        const baseCanvas = document.getElementById('drawing-layer0');
        if (!baseCanvas) return;
        this.layers = [];
        this.layers.push({
            canvas: baseCanvas,
            ctx: baseCanvas.getContext('2d'),
            transform: this.getDefaultTransform(true),
            history: [],
            historyIndex: -1,
            _isBaseLayer: true
        });
        const ctx = this.layers[0].ctx;
        ctx.fillStyle = '#f0e0d6';
        ctx.fillRect(0, 0, baseCanvas.width, baseCanvas.height);
        this.switchLayer(0);
        this.drawComposite();
        console.log("LayerManager.setupInitialLayers called, drawing-layer0 filled");
        // rev2e: 強制デバッグ描画
        if (window.forceDebugDraw) window.forceDebugDraw();
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
        const newLayer = {
            canvas: newCanvas,
            ctx: newCanvas.getContext('2d'),
            transform: this.getDefaultTransform(false),
            history: [],
            historyIndex: -1,
            _isBaseLayer: false
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
    drawComposite() {
        const composite = this.app.canvasManager.compositeCanvas;
        const ctx = this.app.canvasManager.compositeCtx;
        const w = composite.width, h = composite.height, cx = w/2, cy = h/2;
        ctx.clearRect(0,0,w,h);
        ctx.save();
        const vt = this.app.canvasManager.viewTransform;
        ctx.translate(cx, cy);
        ctx.translate(vt.x, vt.y);
        ctx.rotate(vt.rotation);
        ctx.scale(vt.scale, vt.scale);
        ctx.beginPath(); ctx.rect(-cx, -cy, w, h); ctx.clip();
        for (const [i, layer] of this.layers.entries()) {
            ctx.save();
            if (!layer._isBaseLayer) {
                const t = layer.transform;
                ctx.translate(t.x, t.y);
                ctx.rotate(t.rotation);
                ctx.scale(t.scale * t.scaleX, t.scale * t.scaleY);
            }
            ctx.drawImage(layer.canvas, -cx, -cy);
            ctx.restore();
            // rev2e: 描画ログ
            console.log(`drawComposite: drew layer ${i} (${layer.canvas.id})`);
        }
        ctx.restore();
        this.app.canvasManager.drawFrame();
        // rev2e: 強制デバッグ描画呼び出し
        if (window.forceDebugDraw) window.forceDebugDraw();
        console.log("drawComposite called");
    }
    moveActiveLayer(dx, dy) {
        const l = this.getActiveLayer();
        if (l._isBaseLayer) return;
        l.transform.x += dx;
        this.saveState();
        this.drawComposite();
    }
    scaleActiveLayer(factor) {
        const l = this.getActiveLayer();
        if (l._isBaseLayer) return;
        l.transform.scale *= factor;
        this.saveState();
        this.drawComposite();
    }
    rotateActiveLayer(deg) {
        const l = this.getActiveLayer();
        if (l._isBaseLayer) return;
        l.transform.rotation += deg * Math.PI / 180;
        this.saveState();
        this.drawComposite();
    }
    flipActiveLayerHorizontal() {
        const l = this.getActiveLayer();
        if (l._isBaseLayer) return;
        l.transform.scaleX *= -1;
        this.saveState();
        this.drawComposite();
    }
    flipActiveLayerVertical() {
        const l = this.getActiveLayer();
        if (l._isBaseLayer) return;
        l.transform.scaleY *= -1;
        this.saveState();
        this.drawComposite();
    }
    saveState() {
        const l = this.getActiveLayer();
        const imageData = l.ctx.getImageData(0,0,l.canvas.width,l.canvas.height);
        const transformCopy = l._isBaseLayer
            ? this.getDefaultTransform(true)
            : JSON.parse(JSON.stringify(l.transform));
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
            if (l._isBaseLayer) {
                l.transform = this.getDefaultTransform(true);
            } else {
                l.transform = JSON.parse(JSON.stringify(hist.transform));
            }
            this.drawComposite();
        }
    }
    redo() {
        const l = this.getActiveLayer();
        if (l.historyIndex < l.history.length - 1) {
            l.historyIndex++;
            const hist = l.history[l.historyIndex];
            l.ctx.putImageData(hist.imageData, 0, 0);
            if (l._isBaseLayer) {
                l.transform = this.getDefaultTransform(true);
            } else {
                l.transform = JSON.parse(JSON.stringify(hist.transform));
            }
            this.drawComposite();
        }
    }
    clearActiveLayer() {
        const l = this.getActiveLayer();
        l.ctx.clearRect(0,0,l.canvas.width,l.canvas.height);
        if (l._isBaseLayer) {
            l.ctx.fillStyle = '#f0e0d6';
            l.ctx.fillRect(0,0,l.canvas.width,l.canvas.height);
        }
        if (l._isBaseLayer) {
            l.transform = this.getDefaultTransform(true);
        }
        this.saveState();
        this.drawComposite();
    }
    clearAllLayers() {
        for (let i=0; i<this.layers.length; ++i) {
            const l = this.layers[i];
            l.ctx.clearRect(0,0,l.canvas.width,l.canvas.height);
            if (l._isBaseLayer) {
                l.ctx.fillStyle = '#f0e0d6';
                l.ctx.fillRect(0,0,l.canvas.width,l.canvas.height);
                l.transform = this.getDefaultTransform(true);
            } else {
                l.transform = this.getDefaultTransform(false);
            }
            this.saveState();
        }
        this.drawComposite();
    }
}

// ToolManager, PenSettingsManager, ColorManager: (no change from rev2d, omitted for brevity; no class redefinition allowed)
// See ui-v1-4rev2e.js for input event debugging
