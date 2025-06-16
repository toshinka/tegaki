// CanvasManager-v1-3-rev7.js
// レイヤー・額縁のtransform描画を分離、clipによる描画範囲制御

class CanvasManager {
    constructor(app) {
        this.app = app;
        this.displayCanvas = document.getElementById('display-canvas');
        this.displayCtx = this.displayCanvas.getContext('2d');
        this.activeLayerCtx = null;

        // 仮想カメラ（全体反転や回転など）
        this.viewTransform = {
            x: this.displayCanvas.width / 2,
            y: this.displayCanvas.height / 2,
            scale: 1, rotation: 0, scaleX: 1, scaleY: 1
        };

        this.isDrawing = false;
        this.isPanning = false;
        this.isSpaceDown = false;

        this.lastX = 0;
        this.lastY = 0;

        this.bindEvents();
        this.startRenderLoop();
    }

    bindEvents() {
        this.displayCanvas.addEventListener('pointerdown', this.onPointerDown.bind(this));
        document.addEventListener('pointermove', this.onPointerMove.bind(this));
        document.addEventListener('pointerup', this.onPointerUp.bind(this));
        this.displayCanvas.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
    }

    startRenderLoop() {
        const render = () => {
            this.render();
            requestAnimationFrame(render);
        };
        render();
    }

    render() {
        const canvas = this.displayCanvas;
        const ctx = this.displayCtx;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 仮想カメラの変換開始
        ctx.save();
        ctx.translate(this.viewTransform.x, this.viewTransform.y);
        ctx.rotate(this.viewTransform.rotation * Math.PI / 180);
        ctx.scale(this.viewTransform.scale * this.viewTransform.scaleX, this.viewTransform.scale * this.viewTransform.scaleY);
        ctx.translate(-this.app.layerManager.width / 2, -this.app.layerManager.height / 2);

        // 描画範囲clip
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, this.app.layerManager.width, this.app.layerManager.height);
        ctx.clip();

        // 全レイヤーを描画
        this.app.layerManager.layers.forEach(layer => {
            if (!layer.visible) return;
            ctx.save();
            const t = layer.transform;
            ctx.translate(t.x + this.app.layerManager.width / 2, t.y + this.app.layerManager.height / 2);
            ctx.rotate(t.rotation * Math.PI / 180);
            ctx.scale(t.scale * t.scaleX, t.scale * t.scaleY);
            ctx.translate(-this.app.layerManager.width / 2, -this.app.layerManager.height / 2);
            ctx.drawImage(layer.canvas, 0, 0);
            ctx.restore();
        });

        ctx.restore(); // clip解除
        ctx.restore(); // 仮想カメラ解除

        // 額縁はtransformの影響を受けず常に中央固定
        this.drawFrame();
    }

    drawFrame() {
        const ctx = this.displayCtx;
        const w = this.displayCanvas.width;
        const h = this.displayCanvas.height;
        ctx.save();
        ctx.strokeStyle = '#cccccc';
        ctx.lineWidth = 10;
        ctx.fillStyle = '#ffffee';
        ctx.clearRect(0, 0, 5, h); ctx.fillRect(0, 0, 5, h);
        ctx.clearRect(w - 5, 0, 5, h); ctx.fillRect(w - 5, 0, 5, h);
        ctx.clearRect(0, 0, w, 5); ctx.fillRect(0, 0, w, 5);
        ctx.clearRect(0, h - 5, w, 5); ctx.fillRect(0, h - 5, w, 5);
        ctx.strokeRect(5, 5, w - 10, h - 10);
        ctx.restore();
    }

    // ↓ 以降はrev6相当の描画・イベント処理（略記）

    setActiveLayerContext(ctx) { this.activeLayerCtx = ctx; }
    updateCursor() { this.displayCanvas.style.cursor = this.isSpaceDown ? 'grab' : 'crosshair'; }
    flipHorizontal() { this.viewTransform.scaleX *= -1; }
    flipVertical() { this.viewTransform.scaleY *= -1; }
    zoom(factor) { this.viewTransform.scale = Math.max(0.1, Math.min(this.viewTransform.scale * factor, 10)); }
    rotate(degrees) { this.viewTransform.rotation = (this.viewTransform.rotation + degrees) % 360; }
    resetView() {
        this.viewTransform.x = this.displayCanvas.width / 2;
        this.viewTransform.y = this.displayCanvas.height / 2;
        this.viewTransform.scale = 1;
        this.viewTransform.rotation = 0;
        this.viewTransform.scaleX = 1;
        this.viewTransform.scaleY = 1;
    }
    // ...その他イベント処理・座標変換などはrev6と同等
}