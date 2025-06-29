// Toshinka Tegaki Tool core.js v1.5rev10
// 

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

        // 要素
        this.canvas = null;
        this.ctx = null;
        this.canvasArea = document.getElementById('canvas-area');
        this.canvasContainer = document.getElementById('canvas-container');
        this.frameCanvas = null;

        // 描画状態
        this.isDrawing = false;
        this.isPanning = false;
        this.isLayerTransforming = false;
        this.isSpaceDown = false;
        this.isVDown = false;
        this.isShiftDown = false; // ★ Shiftキーの状態
        this.isScalingRotatingLayer = false; // ★ 拡縮・回転モードのフラグ
        this.isScalingRotatingCanvas = false; // ▼▼▼ 追加 ▼▼▼ キャンバス拡縮・回転モードのフラグ

        // 設定
        this.currentTool = 'pen';
        this.currentColor = '#800000';
        this.currentSize = 1;

        // 筆圧・座標
        this.points = [];

        // 履歴・移動情報
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

        // ホイールイベント制御
        this.wheelTimeout = null;
        this.lastWheelTime = 0;
        this.wheelThrottle = 50;
        
        this.animationFrameId = null;
        this.lastRenderedPointIndex = 0;

        // レイヤー操作
        this.layerTransform = {
            translateX: 0,
            translateY: 0,
            scale: 1,
            rotation: 0,
            flipX: 1,
            flipY: 1
        };
        this.originalLayerTransform = {}; 

        // キャンバスの変形情報
        this.transform = {
            scale: 1,
            rotation: 0,
            flipX: 1,
            flipY: 1,
            left: 0,
            top: 0
        };
        this.originalCanvasTransform = {}; // ▼▼▼ 追加 ▼▼▼

        // フレームとイベントセットアップ
        this.createAndDrawFrame();
        this.bindEvents();
    }

    exportMergedImage() {
        const mergedCanvas = document.createElement('canvas');
        mergedCanvas.width = this.canvas.width;
        mergedCanvas.height = this.canvas.height;
        const mergedCtx = mergedCanvas.getContext('2d');

        this.app.layerManager.layers.forEach(layer => {
            mergedCtx.drawImage(layer.canvas, 0, 0);
        });

        const dataURL = mergedCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = 'merged_image.png';
        link.click();
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
        // 右クリックメニューを無効化
        document.addEventListener('contextmenu', e => e.preventDefault());
        this.canvasArea.addEventListener('mousedown', e => {
            if (e.button !== 0) e.preventDefault();
        });



        const saveBtn = document.getElementById('saveMergedButton');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.exportMergedImage();
            });
        } else {
            console.warn('保存ボタンが見つからないよ');
        }
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

console.log("tool:", this.currentTool, "isLayerTransforming:", this.isLayerTransforming);

        // 右クリック・中クリックは無効化
        if (e.button !== 0) return;
        // もし変形プレビュー中ならここで強制終了
        if (this.isLayerTransforming) {
            this.commitLayerTransform();
        }

        if (this.isVDown && this.canvas && e.target === this.canvas) {
            // Vキーモード中のドラッグ開始
            if (!this.isLayerTransforming) {
                this.startLayerTransform();
            }
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;

            if (this.isShiftDown) {
                // 拡縮・回転モード
                this.isScalingRotatingLayer = true;
                // 現在のプレビュー状態を開始値として保存
                this.originalLayerTransform = { ...this.layerTransform };
            } else {
                // 通常の移動モード
                this.isScalingRotatingLayer = false;
                const coords = this.getCanvasCoordinates(e);
                // 現在のプレビューからの相対位置を計算して開始点とする
                this.moveLayerStartX = coords.x - this.layerTransform.translateX;
                this.moveLayerStartY = coords.y - this.layerTransform.translateY;
            }
            e.preventDefault();
            return;
        }

        // ▼▼▼ 修正 ▼▼▼
        if (this.isSpaceDown) {
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;

            if (this.isShiftDown) {
                // Shiftキーが押されている場合はキャンバスの拡縮・回転モード
                this.isScalingRotatingCanvas = true;
                this.originalCanvasTransform = { ...this.transform }; // 現在の変形状態を保存
            } else {
                // Shiftキーが押されていない場合はパンニングモード（既存の処理）
                this.canvasStartX = this.transform.left;
                this.canvasStartY = this.transform.top;
                this.isPanning = true;
            }
            e.preventDefault();
            return;
        }
        // ▲▲▲ 修正 ▲▲▲
        
        if (!this.canvas || e.target !== this.canvas) return;

        const coords = this.getCanvasCoordinates(e);

        if (this.currentTool === 'bucket') {
            this.fill(Math.floor(coords.x), Math.floor(coords.y), this.currentColor);
            this.saveState();
        } else {
            this.isDrawing = true;
            this.points = [];
            this.lastRenderedPointIndex = 0;
            this.points.push({ x: coords.x, y: coords.y, pressure: e.pressure === 0 ? 1.0 : e.pressure || 1.0 });
            this.startSmoothDrawing();
        }
        
        try { document.documentElement.setPointerCapture(e.pointerId); } catch (err) {}
    }

    onPointerMove(e) {
        if (!e.buttons) return;
    
        // ▼▼▼ 追加 ▼▼▼
        if (this.isScalingRotatingCanvas) {
            const dx = e.clientX - this.dragStartX;
            const dy = e.clientY - this.dragStartY;

            // 上下ドラッグで拡縮 (感度調整)
            const scaleFactor = 1 - dy * 0.005;
            this.transform.scale = Math.max(0.1, this.originalCanvasTransform.scale * scaleFactor);

            // 左右ドラッグで回転 (感度調整)
            const rotationAmount = dx * 0.5; // 度
            this.transform.rotation = this.originalCanvasTransform.rotation + rotationAmount;
            
            this.applyTransform();
            return;
        }
        // ▲▲▲ 追加 ▲▲▲

        if (this.isPanning) {
            const dx = e.clientX - this.dragStartX;
            const dy = e.clientY - this.dragStartY;
            this.transform.left = this.canvasStartX + dx;
            this.transform.top = this.canvasStartY + dy;
            this.applyTransform();
            return;
        }

        if (this.isLayerTransforming) {
            if (this.isScalingRotatingLayer) {
                // 拡縮・回転の処理
                const dx = e.clientX - this.dragStartX;
                const dy = e.clientY - this.dragStartY;

                // 上下ドラッグで拡縮 (感度調整)
                const scaleFactor = 1 - dy * 0.005;
                this.layerTransform.scale = Math.max(0.01, this.originalLayerTransform.scale * scaleFactor);

                // 左右ドラッグで回転 (感度調整)
                const rotationAmount = dx * 0.5; // 度
                this.layerTransform.rotation = this.originalLayerTransform.rotation + (rotationAmount * Math.PI / 180);

            } else {
                // 通常の移動の処理
                const coords = this.getCanvasCoordinates(e);
                this.layerTransform.translateX = Math.round(coords.x - this.moveLayerStartX);
                this.layerTransform.translateY = Math.round(coords.y - this.moveLayerStartY);
            }
            this.applyLayerTransformPreview();
            return;
        }
      
        if (this.isDrawing) {
            const currentCoords = this.getCanvasCoordinates(e);
            const currentPressure = e.pressure === 0 ? 1.0 : e.pressure || 1.0;

            if (this.points.length > 0) {
                const lastPoint = this.points[this.points.length - 1];
                const dist = Math.sqrt(Math.pow(currentCoords.x - lastPoint.x, 2) + Math.pow(currentCoords.y - lastPoint.y, 2));
                const interpolationThreshold = 0.5;

                if (dist > interpolationThreshold) {
                    const steps = Math.ceil(dist / interpolationThreshold);
                    for (let i = 1; i < steps; i++) {
                        const t = i / steps;
                        const interpolatedX = lastPoint.x + (currentCoords.x - lastPoint.x) * t;
                        const interpolatedY = lastPoint.y + (currentCoords.y - lastPoint.y) * t;
                        const interpolatedPressure = lastPoint.pressure + (currentPressure - lastPoint.pressure) * t;
                        this.points.push({ x: interpolatedX, y: interpolatedY, pressure: interpolatedPressure });
                    }
                }
            }
            this.points.push({ x: currentCoords.x, y: currentCoords.y, pressure: currentPressure });
        }
    }

    onPointerUp(e) {
        if (e.button !== 0) return;
        try {
            if (document.documentElement.hasPointerCapture(e.pointerId)) {
                document.documentElement.releasePointerCapture(e.pointerId);
            }
        } catch (err) {}
    
        if (this.isDrawing) {
            this.isDrawing = false;
            this.stopSmoothDrawing();
            this.renderSmoothedLine(true);
            this.saveState();
            this.points = [];
        }

        if (this.isScalingRotatingLayer) {
            this.isScalingRotatingLayer = false;
        }
        
        // ▼▼▼ 修正 ▼▼▼
        if (this.isScalingRotatingCanvas) {
            this.isScalingRotatingCanvas = false;
        }
        if (this.isPanning) {
            this.isPanning = false;
        }
        // ▲▲▲ 修正 ▲▲▲
    }

    startSmoothDrawing() {
        this.lastRenderedPointIndex = 0;
        if (!this.animationFrameId) {
            this.animationFrameId = requestAnimationFrame(this.smoothDrawLoop.bind(this));
        }
    }

    stopSmoothDrawing() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    smoothDrawLoop() {
        if (this.isDrawing) {
            this.renderSmoothedLine(false);
            this.animationFrameId = requestAnimationFrame(this.smoothDrawLoop.bind(this));
        }
    }
    
    renderSmoothedLine(isFinal) {
        if (!this.ctx || !this.points) return;
        const points = this.points;
        const pointsCount = points.length;

        if (pointsCount < 2) {
             if (isFinal && pointsCount === 1) {
                const p = points[0];
                this.ctx.globalCompositeOperation = this.currentTool === 'eraser' ? 'destination-out' : 'source-over';
                this.ctx.fillStyle = this.currentColor;
                const radius = (this.currentSize * p.pressure) / 2;
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, Math.max(0.1, radius), 0, Math.PI * 2, true);
                this.ctx.fill();
             }
             return;
        }

        this.ctx.globalCompositeOperation = this.currentTool === 'eraser' ? 'destination-out' : 'source-over';
        this.ctx.strokeStyle = this.currentColor;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        const limit = isFinal ? pointsCount : pointsCount - 1;

        while (this.lastRenderedPointIndex < limit - 1) {
            const i = this.lastRenderedPointIndex;
            
            if (i === 0) {
                const p0 = points[0];
                const p1 = points[1];
                this.ctx.lineWidth = Math.max(0.1, this.currentSize * ((p0.pressure + p1.pressure) / 2));
                this.ctx.beginPath();
                this.ctx.moveTo(p0.x, p0.y);
                this.ctx.lineTo(p1.x, p1.y);
                this.ctx.stroke();
            }
            else {
                const p0 = points[i - 1];
                const p1 = points[i];
                const p2 = points[i + 1];

                const midPoint1 = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
                const midPoint2 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

                this.ctx.lineWidth = Math.max(0.1, this.currentSize * p1.pressure);
                this.ctx.beginPath();
                this.ctx.moveTo(midPoint1.x, midPoint1.y);
                this.ctx.quadraticCurveTo(p1.x, p1.y, midPoint2.x, midPoint2.y);
                this.ctx.stroke();
            }
            this.lastRenderedPointIndex++;
        }
    }

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
            if (this.isShiftDown) {
                // ここでカーソルを変えても良いが、grabのままでも良いだろう
                this.canvas.style.cursor = 'move'; 
            }
            return;
        }
        if (this.isVDown) {
            if (this.isShiftDown) {
                this.canvas.style.cursor = 'move';
            } else {
                this.canvas.style.cursor = 'move';
            }
            this.canvasArea.style.cursor = 'default';
            return;
        }
        this.canvasArea.style.cursor = 'crosshair';
        this.canvas.style.cursor = 'crosshair';
    }

    applyTransform() {
        const container = this.canvasContainer;
        const t = this.transform;
        container.style.transform = `
            translate(${t.left}px, ${t.top}px)
            scale(${t.scale * t.flipX}, ${t.scale * t.flipY})
            rotate(${t.rotation}deg)
        `;
    }

    startLayerTransform() {
        if (this.isLayerTransforming || !this.ctx) return;
        this.isLayerTransforming = true;
        this.moveLayerImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        this.layerTransform = { translateX: 0, translateY: 0, scale: 1, rotation: 0, flipX: 1, flipY: 1 };
        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    applyLayerTransformPreview() {
        if (!this.isLayerTransforming || !this.moveLayerImageData) return;
        const ctx = this.ctx;
        const canvas = this.canvas;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        tempCanvas.getContext('2d').putImageData(this.moveLayerImageData, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.translate(this.layerTransform.translateX, this.layerTransform.translateY);
        ctx.rotate(this.layerTransform.rotation);
        ctx.scale(this.layerTransform.scale * this.layerTransform.flipX, this.layerTransform.scale * this.layerTransform.flipY);
        ctx.translate(-canvas.width / 2, -canvas.height / 2);
        ctx.drawImage(tempCanvas, 0, 0);
        ctx.restore();
    }

    commitLayerTransform() {
        if (!this.isLayerTransforming) return;
        this.isLayerTransforming = false;
        this.moveLayerImageData = null;
        this.saveState();
    }

    saveState() {
        const snapshot = this.app.layerManager.layers.map(layer => ({
            name: layer.name,
            width: layer.canvas.width,
            height: layer.canvas.height,
            imageData: layer.ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height)
        }));
        const state = {
            layers: snapshot,
            activeLayerIndex: this.app.layerManager.activeLayerIndex
        };
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        this.history.push(state);
        this.historyIndex++;
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.restoreState(this.history[this.historyIndex]);
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.restoreState(this.history[this.historyIndex]);
        }
    }

    restoreState(state) {
        this.app.layerManager.clearAllLayersHard();
        for (const layerData of state.layers) {
            this.app.layerManager.addLayerFromData(layerData);
        }

    }

    clearCanvas() {
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            if (this.app.layerManager.activeLayerIndex === 0) {
                this.ctx.fillStyle = '#f0e0d6';
                this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            }
            this.app.layerManager.switchLayer(state.activeLayerIndex);
            this.saveState();
        }
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
    }

    resetView() {
        this.transform = { scale: 1, rotation: 0, flipX: 1, flipY: 1, left: 0, top: 0 };
        this.applyTransform();
    }

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
        if (this.isVDown) {
            if (!this.isLayerTransforming) {
                this.startLayerTransform();
            }
            if (e.shiftKey) {
                const degrees = deltaY > 0 ? -5 : 5;
                this.layerTransform.rotation += degrees * Math.PI / 180;
            } else {
                const factor = deltaY > 0 ? 0.95 : 1.05;
                this.layerTransform.scale = Math.max(0.1, Math.min(this.layerTransform.scale * factor, 10));
            }
            this.applyLayerTransformPreview();
        } else {
        if (e.shiftKey) {
          const degrees = -deltaY * 0.2;
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

// (以下、LayerManagerや他のクラスは変更ありません)
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
        const bgLayer = {
            canvas: initialCanvas,
            ctx: initialCanvas.getContext('2d'),
            name: '背景',
            transform: { left: 0, top: 0, scale: 1, rotation: 0, flipX: 1, flipY: 1 }
        };
        this.layers.push(bgLayer);
        bgLayer.ctx.fillStyle = '#f0e0d6';
        bgLayer.ctx.fillRect(0, 0, initialCanvas.width, initialCanvas.height);

        const newCanvas = document.createElement('canvas');
        newCanvas.width = initialCanvas.width;
        newCanvas.height = initialCanvas.height;
        newCanvas.className = 'main-canvas';
        this.canvasContainer.insertBefore(newCanvas, bgLayer.canvas.nextSibling);

        const newLayer = {
            canvas: newCanvas,
            ctx: newCanvas.getContext('2d'),
            name: 'レイヤー 1',
            transform: { left: 0, top: 0, scale: 1, rotation: 0, flipX: 1, flipY: 1 }
        };
        this.layers.push(newLayer);
        newLayer.ctx.lineCap = 'round';
        newLayer.ctx.lineJoin = 'round';
        this.updateAllLayerZIndexes();
        this.renameLayers();
        this.switchLayer(1);
        this.app.canvasManager.saveState();
    }

    addLayer() {
        if (this.layers.length >= 99) {
            alert("レイヤー数の上限に達しました。");
            return null;
        }
        const baseCanvas = this.layers[0].canvas;
        const newCanvas = document.createElement('canvas');
        newCanvas.width = baseCanvas.width;
        newCanvas.height = baseCanvas.height;
        newCanvas.className = 'main-canvas';
        const insertIndex = this.activeLayerIndex + 1;
        this.canvasContainer.insertBefore(newCanvas, this.layers[insertIndex]?.canvas || null);

        const newLayer = {
            canvas: newCanvas,
            ctx: newCanvas.getContext('2d'),
            name: `レイヤー ${this.layers.length}`,
            transform: { left: 0, top: 0, scale: 1, rotation: 0, flipX: 1, flipY: 1 }
        };
        this.layers.splice(insertIndex, 0, newLayer);
        newLayer.ctx.lineCap = 'round';
        newLayer.ctx.lineJoin = 'round';
        this.updateAllLayerZIndexes();
        this.renameLayers();
        this.switchLayer(insertIndex);
        this.app.canvasManager.saveState();
        return newLayer;
    }

    deleteActiveLayer() {
        const indexToDelete = this.activeLayerIndex;
        if (indexToDelete === 0) {
            alert('背景レイヤーは削除できません。');
            return;
        }
        if (indexToDelete < 0 || indexToDelete >= this.layers.length) return;
        const layerToRemove = this.layers[indexToDelete];
        this.canvasContainer.removeChild(layerToRemove.canvas);
        this.layers.splice(indexToDelete, 1);
        this.renameLayers();
        let newActiveIndex = Math.max(1, indexToDelete - 1);
        this.updateAllLayerZIndexes();
        this.switchLayer(newActiveIndex);
        this.app.canvasManager.saveState();
    }

    duplicateActiveLayer() {
        const activeLayer = this.getCurrentLayer();
        if (!activeLayer) return;
        const baseCanvas = this.layers[0].canvas;
        const newCanvas = document.createElement('canvas');
        newCanvas.width = baseCanvas.width;
        newCanvas.height = baseCanvas.height;
        newCanvas.className = 'main-canvas';
        const insertIndex = this.activeLayerIndex + 1;
        this.canvasContainer.insertBefore(newCanvas, this.layers[insertIndex]?.canvas || null);

        const newLayer = {
            canvas: newCanvas,
            ctx: newCanvas.getContext('2d'),
            name: `レイヤー ${this.layers.length}`,
            transform: { ...activeLayer.transform }
        };
        this.layers.splice(insertIndex, 0, newLayer);
        newLayer.ctx.drawImage(activeLayer.canvas, 0, 0);
        newLayer.ctx.lineCap = 'round';
        newLayer.ctx.lineJoin = 'round';
        this.updateAllLayerZIndexes();
        this.renameLayers();
        this.switchLayer(insertIndex);
        this.app.canvasManager.saveState();
    }

    mergeDownActiveLayer() {
        const activeIndex = this.activeLayerIndex;
        if (activeIndex <= 0 || this.layers.length <= 1) {
            alert('背景レイヤーは合成できません。または、合成できるレイヤーがありません。');
            return;
        }
        const activeLayer = this.layers[activeIndex];
        const targetLayer = this.layers[activeIndex - 1];
        if (!activeLayer || !targetLayer) return;
        targetLayer.ctx.drawImage(activeLayer.canvas, 0, 0);
        this.deleteActiveLayer();
    }

    renameLayers() {
        this.layers.forEach((layer, index) => {
            layer.name = index === 0 ? '背景' : `レイヤー ${index}`;
        });
    }

    switchLayer(index) {
        if (index < 0 || index >= this.layers.length) return;
        this.activeLayerIndex = index;
        const activeLayer = this.getCurrentLayer();
        if (activeLayer) {
            this.app.canvasManager.setActiveLayerContext(activeLayer.canvas, activeLayer.ctx);
            this.layers.forEach((layer, i) => {
                layer.canvas.style.pointerEvents = (i === index) ? 'auto' : 'none';
                this.applyLayerTransform(layer);
            });
            if (this.app.layerUIManager) {
                this.app.layerUIManager.renderLayers();
            }
        }
    }

    getCurrentLayer() {
        if (this.activeLayerIndex >= 0 && this.activeLayerIndex < this.layers.length) {
            return this.layers[this.activeLayerIndex];
        }
        return null;
    }

    applyLayerTransform(layer) {
        const t = layer.transform;
        layer.canvas.style.transformOrigin = 'center';
        layer.canvas.style.transform = `
            translate(${t.left}px, ${t.top}px)
            scale(${t.scale})
            rotate(${t.rotation}deg)
            scale(${t.flipX}, ${t.flipY})
        `;
    }

    moveActiveLayer(dx, dy) {
        const layer = this.getCurrentLayer();
        if (!layer) return;
        const t = layer.transform;
        t.left += dx;
        t.top += dy;
        this.applyLayerTransform(layer);
    }

    scaleActiveLayer(factor) {
        const layer = this.getCurrentLayer();
        if (!layer) return;
        const t = layer.transform;
        t.scale *= factor;
        this.applyLayerTransform(layer);
    }

    rotateActiveLayer(degrees) {
        const layer = this.getCurrentLayer();
        if (!layer) return;
        const t = layer.transform;
        t.rotation = (t.rotation + degrees) % 360;
        this.applyLayerTransform(layer);
    }

    flipActiveLayerHorizontal() {
        const layer = this.getCurrentLayer();
        if (!layer) return;
        layer.transform.flipX *= -1;
        this.applyLayerTransform(layer);
    }

    flipActiveLayerVertical() {
        const layer = this.getCurrentLayer();
        if (!layer) return;
        layer.transform.flipY *= -1;
        this.applyLayerTransform(layer);
    }

    updateAllLayerZIndexes() {
        this.layers.forEach((layer, index) => {
            layer.canvas.style.zIndex = index;
        });
    }

    clearAllLayersHard() {
        for (const layer of this.layers) {
            this.canvasContainer.removeChild(layer.canvas);
        }
        this.layers = [];
        this.activeLayerIndex = -1;
    }

    addLayerFromData(data) {
        const newCanvas = document.createElement('canvas');
        newCanvas.width = data.width;
        newCanvas.height = data.height;
        newCanvas.className = 'main-canvas';
        const ctx = newCanvas.getContext('2d');
        ctx.putImageData(data.imageData, 0, 0);
        this.canvasContainer.appendChild(newCanvas);
        const newLayer = {
            canvas: newCanvas,
            ctx: ctx,
            name: data.name,
            transform: { left: 0, top: 0, scale: 1, rotation: 0, flipX: 1, flipY: 1 }
        };
        this.layers.push(newLayer);
        this.renameLayers();
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
        this.layerUIManager = null;
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
    }
}
window.addEventListener('DOMContentLoaded', () => {
    if (!window.toshinkaTegakiInitialized) {
        window.toshinkaTegakiInitialized = true;
        window.toshinkaTegakiTool = new ToshinkaTegakiTool();
        window.toshinkaTegakiTool.canvasManager.saveState();
    }
});