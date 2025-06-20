// Toshinka Tegaki Tool core.js 最終安定版
// （transform-origin:center＋逆行列座標変換・Space+ドラッグ/回転/反転/拡縮/移動すべて対応）

// --- 2D行列の合成・逆行列・座標適用 ---
function multiplyMatrix(a, b) {
    return [
        a[0]*b[0] + a[2]*b[1],               // m00
        a[1]*b[0] + a[3]*b[1],               // m10
        a[0]*b[2] + a[2]*b[3],               // m01
        a[1]*b[2] + a[3]*b[3],               // m11
        a[0]*b[4] + a[2]*b[5] + a[4],        // m02
        a[1]*b[4] + a[3]*b[5] + a[5],        // m12
    ];
}
function invertMatrix(m) {
    const det = m[0] * m[3] - m[1] * m[2];
    if (det === 0) return null;
    const invDet = 1 / det;
    return [
        m[3]*invDet,
        -m[1]*invDet,
        -m[2]*invDet,
        m[0]*invDet,
        (m[2]*m[5] - m[3]*m[4])*invDet,
        (m[1]*m[4] - m[0]*m[5])*invDet
    ];
}
function applyMatrix(m, x, y) {
    return {
        x: m[0]*x + m[2]*y + m[4],
        y: m[1]*x + m[3]*y + m[5],
    };
}

// --- CanvasManager ---
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
        this.isLayerMoving = false;
        this.isSpaceDown = false;
        this.isVDown = false;
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

        this.wheelTimeout = null;
        this.lastWheelTime = 0;
        this.wheelThrottle = 50;

        // ★追加：レイヤーごとの変形情報を保存
        this.layerTransforms = new Map();

        // キャンバス全体の見た目transform値
        this.transform = {
            scale: 1,
            rotation: 0,
            flipX: 1,
            flipY: 1,
            left: 0,
            top: 0
        };
        // 強制transform初期化（デバッグ用・リセット防止）
        this.transform.scale = 1;
        this.transform.rotation = 0;
        this.transform.flipX = 1;
        this.transform.flipY = 1;
        this.transform.left = 0;
        this.transform.top = 0;

        this.createAndDrawFrame();
        this.bindEvents();
    }

    createAndDrawFrame() {
        // 額縁キャンバス
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
        if (frameCtx.roundRect) {
            frameCtx.roundRect(0.5, 0.5, this.frameCanvas.width - 1, this.frameCanvas.height - 1, 8);
        } else {
            frameCtx.rect(0.5, 0.5, this.frameCanvas.width - 1, this.frameCanvas.height - 1);
        }
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
    setCurrentTool(tool) { this.currentTool = tool; }
    setCurrentColor(color) { this.currentColor = color; }
    setCurrentSize(size) { this.currentSize = size; }

    onPointerDown(e) {
        if (this.isSpaceDown) {
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
            this.canvasStartX = this.transform.left;
            this.canvasStartY = this.transform.top;
            this.isPanning = true;
            e.preventDefault();
            return;
        }
        // ★修正：v+ドラッグ時の処理をCSS transformベースに変更
        if (this.isVDown && this.canvas && e.target === this.canvas) {
            const layer = this.app.layerManager.getCurrentLayer();
            if (!layer) return;
            const layerId = this.getLayerId(layer);
            const transform = this.layerTransforms.get(layerId) || { scale: 1, rotation: 0, translateX: 0, translateY: 0 };
            
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
            this.moveLayerStartX = transform.translateX;
            this.moveLayerStartY = transform.translateY;
            this.isLayerMoving = true;
            e.preventDefault();
            return;
        }

        if (!this.canvas || e.target !== this.canvas) return;
        const coords = this.getCanvasCoordinates(e);
        this.lastX = coords.x;
        this.lastY = coords.y;
        if (this.currentTool === 'bucket') {
            this.fill(Math.floor(this.lastX), Math.floor(this.lastY), this.currentColor);
            this.saveState();
        } else {
            this.isDrawing = true;
            this.ctx.beginPath();
            this.ctx.moveTo(this.lastX, this.lastY);
        }
        try { document.documentElement.setPointerCapture(e.pointerId); } catch (err) {}
    }

    onPointerMove(e) {
        if (!e.buttons) return;
        if (this.isPanning) {
            const dx = e.clientX - this.dragStartX;
            const dy = e.clientY - this.dragStartY;
            this.transform.left = this.canvasStartX + dx;
            this.transform.top = this.canvasStartY + dy;
            this.applyTransform();
        }
        // ★修正: レイヤー移動処理をputImageDataからCSS transformに変更
        else if (this.isLayerMoving) {
            const dx = e.clientX - this.dragStartX;
            const dy = e.clientY - this.dragStartY;
            
            const activeLayer = this.app.layerManager.getCurrentLayer();
            if (!activeLayer) return;
            
            const layerId = this.getLayerId(activeLayer);
            let transform = this.layerTransforms.get(layerId) || { scale: 1, rotation: 0, translateX: 0, translateY: 0 };
            
            transform.translateX = this.moveLayerStartX + dx;
            transform.translateY = this.moveLayerStartY + dy;
            
            this.layerTransforms.set(layerId, transform);
            this.applyLayerTransform(activeLayer, transform);
        }
        else if (this.isDrawing) {
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
        } catch (err) {}
        if (this.isDrawing) {
            this.isDrawing = false;
            this.ctx.closePath();
            this.saveState();
        }
        // ★修正：レイヤー移動完了時は何もしない（saveStateを呼ばない）
        if (this.isLayerMoving) {
            this.isLayerMoving = false;
        }
        if (this.isPanning) {
            this.isPanning = false;
        }
    }

    // --- 逆行列対応完全版 ---
    getCanvasCoordinates(e) {
        const containerRect = this.canvas.getBoundingClientRect();
        const centerX = containerRect.left + containerRect.width / 2;
        const centerY = containerRect.top + containerRect.height / 2;

        let mouseX = e.clientX - centerX;
        let mouseY = e.clientY - centerY;

        const rad = -this.transform.rotation * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        let unrotatedX = mouseX * cos - mouseY * sin;
        let unrotatedY = mouseX * sin + mouseY * cos;

        let scaleX = this.transform.scale * this.transform.flipX;
        let scaleY = this.transform.scale * this.transform.flipY;
        const unscaledX = unrotatedX / scaleX;
        const unscaledY = unrotatedY / scaleY;

        const canvasX = unscaledX + this.canvas.width / 2;
        const canvasY = unscaledY + this.canvas.height / 2;

        return { x: canvasX, y: canvasY };
    }

    updateCursor() {
        if (!this.canvas) return;
        if (this.isSpaceDown) {
            this.canvasArea.style.cursor = 'grab';
            this.canvas.style.cursor = 'grab';
            return;
        }
        if (this.isVDown) {
            this.canvas.style.cursor = 'move';
            this.canvasArea.style.cursor = 'default';
            return;
        }
        this.canvasArea.style.cursor = 'default';
        this.canvas.style.cursor = 'crosshair';
    }

    applyTransform() {
        this.canvasContainer.style.transformOrigin = "center";
        this.canvasContainer.style.transform =
            `translate(${this.transform.left}px, ${this.transform.top}px) ` +
            `scale(${this.transform.scale}, ${this.transform.scale}) ` +
            `rotate(${this.transform.rotation}deg) ` +
            `scale(${this.transform.flipX}, ${this.transform.flipY})`;
    }

    // ★以下、新規メソッド4つを追加
    
    getLayerId(layer) {
        return this.app.layerManager.layers.indexOf(layer);
    }

    scaleActiveLayer(factor) {
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer) return;
        
        const layerId = this.getLayerId(activeLayer);
        let transform = this.layerTransforms.get(layerId) || {
            scale: 1,
            rotation: 0,
            translateX: 0,
            translateY: 0
        };
        
        transform.scale = Math.max(0.1, Math.min(transform.scale * factor, 10)); // 最大倍率を10に設定
        this.layerTransforms.set(layerId, transform);
        this.applyLayerTransform(activeLayer, transform);
    }
    
    rotateActiveLayer(degrees) {
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer) return;
        
        const layerId = this.getLayerId(activeLayer);
        let transform = this.layerTransforms.get(layerId) || {
            scale: 1,
            rotation: 0,
            translateX: 0,
            translateY: 0
        };
        
        transform.rotation = (transform.rotation + degrees) % 360;
        this.layerTransforms.set(layerId, transform);
        this.applyLayerTransform(activeLayer, transform);
    }

    applyLayerTransform(layer, transform) {
        layer.canvas.style.transformOrigin = 'center';
        layer.canvas.style.transform = 
            `translate(${transform.translateX}px, ${transform.translateY}px) ` +
            `scale(${transform.scale}) ` +
            `rotate(${transform.rotation}deg)`;
    }


    saveState() {
        if (!this.ctx) return;
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

    clearCanvas() {
        // ★追加: アクティブレイヤーの変形もリセット
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (activeLayer) {
            const layerId = this.getLayerId(activeLayer);
            if (this.layerTransforms.has(layerId)) {
                this.layerTransforms.delete(layerId);
                this.applyLayerTransform(activeLayer, { scale: 1, rotation: 0, translateX: 0, translateY: 0 });
            }
        }
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.saveState();
    }

    clearAllLayers() {
        if (!this.app.layerManager || !this.app.layerManager.layers) return;
        // ★追加: 全レイヤーの変形情報をリセット
        this.layerTransforms.clear();
        this.app.layerManager.layers.forEach((layer, index) => {
            const lw = layer.canvas.width;
            const lh = layer.canvas.height;
            // ★追加: 各レイヤーのCSS transformをリセット
            this.applyLayerTransform(layer, { scale: 1, rotation: 0, translateX: 0, translateY: 0 });
            layer.ctx.clearRect(0, 0, lw, lh);
            if (index === 0) {
                layer.ctx.fillStyle = '#f0e0d6';
                layer.ctx.fillRect(0, 0, lw, lh);
            }
        });
        this.saveState();
    }

    flipHorizontal() {
        this.transform.flipX *= -1;
        this.normalizeTransform();
        this.applyTransform();
    }

    flipVertical() {
        this.transform.flipY *= -1;
        this.normalizeTransform();
        this.applyTransform();
    }

    zoom(factor) {
        this.transform.scale = Math.max(0.1, Math.min(this.transform.scale * factor, 10));
        this.applyTransform();
    }

    rotate(degrees) {
        this.transform.rotation = (this.transform.rotation + degrees) % 360;
        this.normalizeTransform();
        this.applyTransform();
    }

    normalizeTransform() {
        this.transform.rotation = ((this.transform.rotation % 360) + 360) % 360;

        this.transform.flipX = this.transform.flipX >= 0 ? 1 : -1;
        this.transform.flipY = this.transform.flipY >= 0 ? 1 : -1;

        if (this.transform.flipX === -1 && this.transform.flipY === -1) {
            this.transform.rotation = (this.transform.rotation + 180) % 360;
            this.transform.flipX = 1;
            this.transform.flipY = 1;
        }

        if (Math.abs(this.transform.rotation - 270) < 0.1 && this.transform.flipX === -1) {
            this.transform.rotation = 90;
            this.transform.flipX = 1;
            this.transform.flipY *= -1;
        }

        if (Math.abs(this.transform.rotation - 90) < 0.1 && this.transform.flipX === -1) {
            this.transform.rotation = 270;
            this.transform.flipX = 1;
            this.transform.flipY *= -1;
        }
    }

    resetView() {
        this.transform = { scale: 1, rotation: 0, flipX: 1, flipY: 1, left: 0, top: 0 };
        this.applyTransform();
    }

    // ★修正: handleWheelメソッド
    handleWheel(e) {
        e.preventDefault();

        const now = Date.now();
        if (now - this.lastWheelTime < this.wheelThrottle) {
            return;
        }
        this.lastWheelTime = now;

        let deltaY = e.deltaY;
        if (Math.abs(deltaY) > 100) {
            deltaY = deltaY > 0 ? 100 : -100;
        }
        deltaY = Math.max(-30, Math.min(30, deltaY));

        // ★追加: vモード時の処理を最初に判定
        if (this.isVDown) {
            if (e.shiftKey) {
                // レイヤー回転
                let degrees = deltaY > 0 ? -5 : 5;
                this.rotateActiveLayer(degrees);
            } else {
                // レイヤー拡大縮小
                let factor = deltaY > 0 ? 0.95 : 1.05;
                this.scaleActiveLayer(factor);
            }
            return; // ここで処理終了
        }

        // 既存のキャンバス全体の変形処理...
        if (e.shiftKey) {
            let degrees;
            if (Math.abs(deltaY) > 20) {
                degrees = deltaY > 0 ? -10 : 10;
            } else if (Math.abs(deltaY) > 10) {
                degrees = deltaY > 0 ? -5 : 5;
            } else {
                degrees = deltaY > 0 ? -2 : 2;
            }
            this.rotate(degrees);
        } else {
            let zoomFactor;
            if (Math.abs(deltaY) > 20) {
                zoomFactor = deltaY > 0 ? 1.05 : 1 / 1.05;
            } else {
                zoomFactor = deltaY > 0 ? 1.02 : 1 / 1.02;
            }
            this.zoom(zoomFactor);
        }

        if (this.wheelTimeout) {
            clearTimeout(this.wheelTimeout);
        }
        this.wheelTimeout = setTimeout(() => {
            this.lastWheelTime = 0;
        }, 200);
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
        const imageData = this.ctx.getImageData(0, 0, canvasWidth, canvasHeight);
        const startColor = this.getPixelColor(imageData, startX, startY);
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
        this.ctx.putImageData(imageData, 0, 0);
    }
}

// --- LayerManager ---
class LayerManager {
    constructor(app) {
        this.app = app;
        this.layers = [];
        this.activeLayerIndex = -1;
        this.canvasContainer = document.getElementById('canvas-container');
    }

    setupInitialLayers() {
        const initialCanvas = document.getElementById('drawingCanvas');
        if (!initialCanvas) return;
        this.layers.push({
            canvas: initialCanvas,
            ctx: initialCanvas.getContext('2d'),
        });
        const firstLayerCtx = this.layers[0].ctx;
        firstLayerCtx.fillStyle = '#f0e0d6';
        firstLayerCtx.fillRect(0, 0, initialCanvas.width, initialCanvas.height);
        this.switchLayer(0);
        this.updateAllLayerZIndexes();
    }

    addLayer() {
        if (this.layers.length === 0) return null;
        const baseCanvas = this.layers[0].canvas;
        const newCanvas = document.createElement('canvas');
        newCanvas.width = baseCanvas.width;
        newCanvas.height = baseCanvas.height;
        newCanvas.className = 'main-canvas';
        this.canvasContainer.appendChild(newCanvas);
        const newLayer = {
            canvas: newCanvas,
            ctx: newCanvas.getContext('2d'),
        };
        this.layers.push(newLayer);
        newLayer.ctx.lineCap = 'round';
        newLayer.ctx.lineJoin = 'round';
        this.updateAllLayerZIndexes();
        this.switchLayer(this.layers.length - 1);
        return newLayer;
    }

    switchLayer(index) {
        if (index < 0 || index >= this.layers.length) return;
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

    updateAllLayerZIndexes() {
        this.layers.forEach((layer, index) => {
            layer.canvas.style.zIndex = index;
        });
    }
}

// --- PenSettingsManager, ColorManager, ToolManager, ToshinkaTegakiTool（省略、前と同じ） ---
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
class ToolManager {
    constructor(app) {
        this.app = app;
        this.currentTool = 'pen';
        this.bindEvents();
    }
    bindEvents() {
        document.getElementById('pen-tool').addEventListener('click', () => this.setTool('pen'));
        document.getElementById('eraser-tool').addEventListener('click', () => this.setTool('eraser'));
        document.getElementById('bucket-tool').addEventListener('click', () => this.setTool('bucket'));
    }
    setTool(tool) {
        this.currentTool = tool;
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        const toolButton = document.getElementById(tool + '-tool');
        if(toolButton) toolButton.classList.add('active');
        this.app.canvasManager.setCurrentTool(tool);
        this.app.canvasManager.updateCursor();
    }
    getCurrentTool() {
        return this.currentTool;
    }
}
class ToshinkaTegakiTool {
    constructor() {
        this.colorManager = null;
        this.toolManager = null;
        this.canvasManager = null;
        this.penSettingsManager = null;
        this.layerManager = null;
        this.initManagers();
    }
    initManagers() {
        this.canvasManager = new CanvasManager(this);
        this.layerManager = new LayerManager(this);
        this.layerManager.setupInitialLayers();
        this.penSettingsManager = new PenSettingsManager(this);
        this.toolManager = new ToolManager(this);
        this.colorManager = new ColorManager(this);
        this.toolManager.setTool('pen');
        this.penSettingsManager.setSize(1);
        this.colorManager.setColor(this.colorManager.mainColor);
        this.canvasManager.saveState();
    }
}
window.addEventListener('DOMContentLoaded', () => {
    if (!window.toshinkaTegakiInitialized) {
        window.toshinkaTegakiInitialized = true;
        window.toshinkaTegakiTool = new ToshinkaTegakiTool();
    }
});