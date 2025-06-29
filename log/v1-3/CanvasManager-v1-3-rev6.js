// CanvasManager-v1-3-rev6.js
// 描画方式をDOMのtransformから、単一の表示Canvasへのレンダリング方式に刷新。
// これにより、額縁の固定、はみ出し防止、将来的な拡張性を確保。
class CanvasManager {
    constructor(app) {
        this.app = app;
        
        // --- 新しい描画方式のプロパティ ---
        this.displayCanvas = document.getElementById('display-canvas');
        this.displayCtx = this.displayCanvas.getContext('2d');
        this.activeLayerCtx = null; // 現在描画対象のレイヤーのコンテキスト

        this.viewTransform = { // 視点操作用のtransform
            x: this.displayCanvas.width / 2,
            y: this.displayCanvas.height / 2,
            scale: 1,
            rotation: 0,
            scaleX: 1, // 仮想反転
            scaleY: 1, // 仮想反転
        };
        // --- ここまで ---

        this.isDrawing = false;
        this.isPanning = false;
        this.isSpaceDown = false;
        
        this.lastX = 0;
        this.lastY = 0;
        this.history = [];
        this.historyIndex = -1;
        
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.panStartX = 0;
        this.panStartY = 0;
        
        this.bindEvents();
        this.startRenderLoop(); // 描画ループを開始
    }
    
    bindEvents() {
        this.displayCanvas.addEventListener('pointerdown', this.onPointerDown.bind(this));
        document.addEventListener('pointermove', this.onPointerMove.bind(this));
        document.addEventListener('pointerup', this.onPointerUp.bind(this));
        this.displayCanvas.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
    }
    
    // 描画ループを開始
    startRenderLoop() {
        const render = () => {
            this.render();
            requestAnimationFrame(render);
        };
        render();
    }
    
    /**
     * @brief 全てのレイヤーとUIをdisplayCanvasに描画するメイン関数
     */
    render() {
        // 1. 描画コンテキストとキャンバスをクリア
        const canvas = this.displayCanvas;
        const ctx = this.displayCtx;
        ctx.setTransform(1, 0, 0, 1, 0, 0); // transformをリセット
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 2. 視点移動・拡縮・回転・反転を適用
        ctx.save();
        ctx.translate(this.viewTransform.x, this.viewTransform.y);
        ctx.rotate(this.viewTransform.rotation * Math.PI / 180);
        ctx.scale(this.viewTransform.scale * this.viewTransform.scaleX, this.viewTransform.scale * this.viewTransform.scaleY);
        ctx.translate(-this.app.layerManager.width / 2, -this.app.layerManager.height / 2);

        // 3. 全てのレイヤーを描画
        this.app.layerManager.layers.forEach(layer => {
            if (!layer.visible) return; // 非表示レイヤーはスキップ
            
            ctx.save();
            // レイヤーごとのtransformを適用
            const t = layer.transform;
            ctx.translate(t.x + this.app.layerManager.width / 2, t.y + this.app.layerManager.height / 2);
            ctx.rotate(t.rotation * Math.PI / 180);
            ctx.scale(t.scale * t.scaleX, t.scale * t.scaleY);
            ctx.translate(-this.app.layerManager.width / 2, -this.app.layerManager.height / 2);

            // レイヤーの画像を描画
            ctx.drawImage(layer.canvas, 0, 0);
            ctx.restore();
        });
        
        ctx.restore();
        
        // 4. 額縁を描画 (transformの影響を受けない)
        this.drawFrame();
    }
    
    /**
     * @brief 額縁を描画する
     */
    drawFrame() {
        const ctx = this.displayCtx;
        const w = this.displayCanvas.width;
        const h = this.displayCanvas.height;
        ctx.save();
        ctx.strokeStyle = '#cccccc';
        ctx.lineWidth = 10;
        ctx.fillStyle = '#ffffee';
        // 額縁の内側をクリアして背景色で塗りつぶし、枠線を描く
        ctx.clearRect(0, 0, 5, h); ctx.fillRect(0, 0, 5, h); // left
        ctx.clearRect(w - 5, 0, 5, h); ctx.fillRect(w - 5, 0, 5, h); // right
        ctx.clearRect(0, 0, w, 5); ctx.fillRect(0, 0, w, 5); // top
        ctx.clearRect(0, h - 5, w, 5); ctx.fillRect(0, h - 5, w, 5); // bottom
        ctx.strokeRect(5, 5, w - 10, h - 10);
        ctx.restore();
    }

    // --- イベントハンドラ ---
    
    onPointerDown(e) {
        if (this.isSpaceDown) {
            this.isPanning = true;
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
            this.panStartX = this.viewTransform.x;
            this.panStartY = this.viewTransform.y;
        } else {
            this.isDrawing = true;
            const coords = this.getLayerCoordinates(e);
            this.lastX = coords.x;
            this.lastY = coords.y;
            
            this.activeLayerCtx.beginPath();
            this.activeLayerCtx.moveTo(this.lastX, this.lastY);
        }
        try { document.documentElement.setPointerCapture(e.pointerId); } catch (err) {}
    }

    onPointerMove(e) {
        if (!e.buttons) return;
        if (this.isPanning) {
            this.viewTransform.x = this.panStartX + (e.clientX - this.dragStartX);
            this.viewTransform.y = this.panStartY + (e.clientY - this.dragStartY);
        } else if (this.isDrawing) {
            const coords = this.getLayerCoordinates(e);
            this.activeLayerCtx.globalCompositeOperation = this.app.toolManager.currentTool === 'eraser' ? 'destination-out' : 'source-over';
            this.activeLayerCtx.strokeStyle = this.app.colorManager.mainColor;
            this.activeLayerCtx.lineWidth = this.app.penSettingsManager.currentSize;
            this.activeLayerCtx.lineTo(coords.x, coords.y);
            this.activeLayerCtx.stroke();
            this.lastX = coords.x;
            this.lastY = coords.y;
        }
    }
    
    onPointerUp(e) {
        if (this.isDrawing) {
            this.isDrawing = false;
            this.activeLayerCtx.closePath();
            this.saveState();
        }
        if (this.isPanning) this.isPanning = false;
        try { if (document.documentElement.hasPointerCapture(e.pointerId)) { document.documentElement.releasePointerCapture(e.pointerId); } } catch (err) {}
    }
    
    handleWheel(e) {
        e.preventDefault();
        // ShortcutManagerに処理を試みさせ、処理されなかった場合のみ全体の拡縮を行う
        if (this.app.shortcutManager && this.app.shortcutManager.handleWheel(e)) {
            return;
        }
        const delta = e.deltaY > 0 ? -1 : 1;
        this.zoom(delta > 0 ? 1.1 : 1 / 1.1);
    }
    
    // --- 座標変換 ---
    
    /**
     * @brief スクリーン座標(マウス位置)を、現在アクティブなレイヤーのローカル座標に変換する
     * @param {PointerEvent} e 
     * @returns {{x: number, y: number}}
     */
    getLayerCoordinates(e) {
        const rect = this.displayCanvas.getBoundingClientRect();
        // マトリックスを使って逆変換を行う
        const view = this.getViewMatrix();
        const layer = this.app.layerManager.getActiveLayerMatrix();
        const totalMatrix = view.multiply(layer);
        const invMatrix = totalMatrix.invert();

        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        
        const localX = invMatrix.a * screenX + invMatrix.c * screenY + invMatrix.e;
        const localY = invMatrix.b * screenX + invMatrix.d * screenY + invMatrix.f;

        return { x: localX, y: localY };
    }
    
    // 視点移動用の変換マトリックスを取得
    getViewMatrix() {
        let m = new DOMMatrix();
        m = m.translate(this.viewTransform.x, this.viewTransform.y);
        m = m.rotate(this.viewTransform.rotation);
        m = m.scale(this.viewTransform.scale * this.viewTransform.scaleX, this.viewTransform.scale * this.viewTransform.scaleY);
        m = m.translate(-this.app.layerManager.width / 2, -this.app.layerManager.height / 2);
        return m;
    }
    
    // --- 操作用メソッド ---

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
    
    // 以下、Undo/Redo, Clear, Fillはアクティブレイヤーに対して行う
    saveState() { /* ... (実装は省略) ... */ }
    undo() { /* ... */ }
    redo() { /* ... */ }
    clearCanvas() { this.activeLayerCtx.clearRect(0, 0, this.app.layerManager.width, this.app.layerManager.height); }
    clearAllLayers() { this.app.layerManager.clearAllLayers(); }
    fill() { /* ... */ }
}
