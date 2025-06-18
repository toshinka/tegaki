class CanvasManager {
    constructor(app) {
        this.app = app;
        this.canvasArea = document.getElementById('canvas-area');
        this.canvasContainer = document.getElementById('canvas-container');
        // 合成バッファ
        this.compositeCanvas = document.createElement('canvas');
        this.compositeCanvas.width = 344;
        this.compositeCanvas.height = 135;
        this.compositeCanvas.className = 'main-canvas';
        this.compositeCanvas.style.position = 'absolute';
        this.compositeCanvas.style.top = '0';
        this.compositeCanvas.style.left = '0';
        this.compositeCanvas.style.pointerEvents = 'none';
        this.compositeCanvas.style.zIndex = 100;
        this.canvasContainer.appendChild(this.compositeCanvas);

        this.frameCanvas = null;
        this.scale = 1;
        this.rotation = 0;
        this.transformState = { scaleX: 1, scaleY: 1 };
        this.createAndDrawFrame();
        this.bindEvents();
    }

    // 必要に応じてアクティブレイヤーのctxをセット
    setActiveLayerContext(canvas, ctx) {
        this.activeCanvas = canvas;
        this.activeCtx = ctx;
    }

    // 合成表示
    renderComposite() {
        const ctx = this.compositeCanvas.getContext('2d');
        ctx.clearRect(0, 0, this.compositeCanvas.width, this.compositeCanvas.height);
        this.app.layerManager.drawAllLayersTo(ctx);
    }
    requestRender() {
        this.renderComposite();
    }

    // 額縁（frameCanvas）の作成と描画
    createAndDrawFrame() {
        if (this.frameCanvas) return;
        this.frameCanvas = document.createElement('canvas');
        this.frameCanvas.width = 364;
        this.frameCanvas.height = 145;
        this.frameCanvas.style.position = 'absolute';
        this.frameCanvas.style.left = '-10px';
        this.frameCanvas.style.top = '-5px';
        this.frameCanvas.style.pointerEvents = 'none';
        this.frameCanvas.style.zIndex = 200;
        this.canvasContainer.appendChild(this.frameCanvas);

        const ctx = this.frameCanvas.getContext('2d');
        ctx.clearRect(0, 0, this.frameCanvas.width, this.frameCanvas.height);
        ctx.strokeStyle = "#b9845a";
        ctx.lineWidth = 5;
        ctx.strokeRect(2.5, 2.5, 359, 139);
    }

    // 額縁追従
    updateCanvasTransform() {
        const scaleX = this.scale * this.transformState.scaleX;
        const scaleY = this.scale * this.transformState.scaleY;
        this.canvasContainer.style.transform = `rotate(${this.rotation}deg) scale(${scaleX}, ${scaleY})`;
        if (this.frameCanvas) {
            const frameTransform = `rotate(${this.rotation}deg) scale(${scaleX}, ${scaleY})`;
            this.frameCanvas.style.transform = frameTransform;
            this.frameCanvas.style.left = this.canvasContainer.style.left || '-10px';
            this.frameCanvas.style.top = this.canvasContainer.style.top || '-5px';
        }
        this.requestRender();
    }
    resetView() {
        this.scale = 1; this.rotation = 0; this.transformState.scaleX = 1; this.transformState.scaleY = 1; this.updateCanvasTransform();
        this.canvasContainer.style.position = ''; this.canvasContainer.style.left = ''; this.canvasContainer.style.top = '';
        if (this.frameCanvas) {
            this.frameCanvas.style.left = '-10px';
            this.frameCanvas.style.top = '-5px';
            this.frameCanvas.style.transform = '';
        }
    }

    // 描画ポインタ逆変換
    getCanvasCoordinates(e) {
        const layer = this.app.layerManager.getCurrentLayer();
        if (!layer) return { x: 0, y: 0 };
        const t = layer.transform;
        const canvas = layer.canvas;
        const containerRect = this.canvasContainer.getBoundingClientRect();
        const centerX = containerRect.left + canvas.width / 2 + t.x;
        const centerY = containerRect.top + canvas.height / 2 + t.y;
        let dx = e.clientX - centerX;
        let dy = e.clientY - centerY;
        const scaleX = t.scale * t.scaleX;
        const scaleY = t.scale * t.scaleY;
        dx /= scaleX;
        dy /= scaleY;
        const theta = -t.rotation * Math.PI / 180;
        const cos = Math.cos(theta);
        const sin = Math.sin(theta);
        const rx = dx * cos - dy * sin;
        const ry = dx * sin + dy * cos;
        const canvasX = rx + canvas.width / 2;
        const canvasY = ry + canvas.height / 2;
        return { x: canvasX, y: canvasY };
    }

    // 必要に応じてイベントバインド（省略）
    bindEvents() {
        // ここでSpace+ドラッグや全体transformなどのイベントを設定
    }
}