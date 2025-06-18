class ToshinkaTegakiTool {
    constructor() {
        this.layerManager = new LayerManager(this);
        this.canvasManager = new CanvasManager(this);
        this.topBarManager = new TopBarManager(this);
        this.toolManager = new ToolManager(this);
        this.penSettingsManager = new PenSettingsManager(this);
        this.shortcutManager = new ShortcutManager(this);

        this.isDrawing = false;
        this.lastPos = null;
        this.transformMode = false; // Vキー押下時true

        this.layerManager.setupInitialLayers();
        this.canvasManager.requestRender();

        this.bindCanvasEvents();
    }

    bindCanvasEvents() {
        // 描画・消しゴム・移動・transform操作
        const container = this.canvasManager.canvasContainer;
        let dragging = false;
        let lastX = 0, lastY = 0;

        container.addEventListener('mousedown', (e) => {
            const tool = this.toolManager.getCurrentTool();
            const layer = this.layerManager.getCurrentLayer();
            if (!layer) return;

            if (this.transformMode) {
                // V+ドラッグ: レイヤーtransform
                dragging = true;
                lastX = e.clientX;
                lastY = e.clientY;
            } else if (tool === 'move') {
                // Space+ドラッグやCtrl+ドラッグはCanvasManagerで
            } else if (tool === 'pen' || tool === 'eraser') {
                this.isDrawing = true;
                this.lastPos = this.canvasManager.getCanvasCoordinates(e);
                const ctx = layer.ctx;
                ctx.globalCompositeOperation = (tool === 'eraser' ? 'destination-out' : 'source-over');
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.strokeStyle = (tool === 'eraser' ? 'rgba(0,0,0,1)' : this.penSettingsManager.getPenColor());
                ctx.lineWidth = this.penSettingsManager.getPenSize();
                ctx.beginPath();
                ctx.moveTo(this.lastPos.x, this.lastPos.y);
            }
        });

        container.addEventListener('mousemove', (e) => {
            const tool = this.toolManager.getCurrentTool();
            const layer = this.layerManager.getCurrentLayer();
            if (!layer) return;

            if (this.transformMode && dragging) {
                // V+ドラッグでレイヤーtransform（移動）
                const dx = e.clientX - lastX;
                const dy = e.clientY - lastY;
                lastX = e.clientX; lastY = e.clientY;
                this.layerManager.moveActiveLayer(dx, dy);
            } else if (this.isDrawing && (tool === 'pen' || tool === 'eraser')) {
                const pos = this.canvasManager.getCanvasCoordinates(e);
                const ctx = layer.ctx;
                ctx.lineTo(pos.x, pos.y);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(pos.x, pos.y);
                this.lastPos = pos;
                this.canvasManager.requestRender();
            }
        });

        document.addEventListener('mouseup', (e) => {
            // 全体でmouseupを監視
            if (this.isDrawing) {
                this.isDrawing = false;
                this.canvasManager.requestRender();
            }
            dragging = false;
        });

        // マウス外れた時も描画終了
        container.addEventListener('mouseleave', (e) => {
            if (this.isDrawing) {
                this.isDrawing = false;
                this.canvasManager.requestRender();
            }
        });

        // ショートカットでtransform系
        window.addEventListener('keydown', (e) => {
            // Vキー: transformモード
            if (e.key.toLowerCase() === 'v') {
                this.transformMode = true;
            }
            // Shift+V: 回転
            if (e.key.toLowerCase() === 'v' && e.shiftKey) {
                this.layerManager.rotateActiveLayer(15);
            }
            // Shift+H: 水平反転
            if (e.key.toLowerCase() === 'h' && e.shiftKey) {
                this.layerManager.flipActiveLayerHorizontal();
            }
            // Shift+V: 垂直反転
            if (e.key.toLowerCase() === 'v' && e.shiftKey) {
                this.layerManager.flipActiveLayerVertical();
            }
            // +/-で拡大縮小
            if (e.key === '+') {
                this.layerManager.scaleActiveLayer(1.1);
            }
            if (e.key === '-') {
                this.layerManager.scaleActiveLayer(0.9);
            }
        });
        window.addEventListener('keyup', (e) => {
            if (e.key.toLowerCase() === 'v') {
                this.transformMode = false;
            }
        });
    }
}
window.addEventListener('DOMContentLoaded', () => {
    window.toshinkaApp = new ToshinkaTegakiTool();
});