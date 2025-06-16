// LayerManager-v1-3-rev6.js
// DOMにcanvasを追加するのではなく、メモリ上にcanvasを作成するように変更。
// 各レイヤーのtransform情報を元に変換マトリックスを返す機能を追加。
class LayerManager {
    constructor(app) {
        this.app = app;
        this.layers = [];
        this.activeLayerIndex = -1;
        
        // 全レイヤー共通のサイズ
        this.width = 344;
        this.height = 135;
    }

    getDefaultTransform() {
        return { x: 0, y: 0, scale: 1, rotation: 0, scaleX: 1, scaleY: 1 };
    }

    setupInitialLayers() {
        // 最初のレイヤーを追加
        this.addLayer();
        // 初期レイヤーを背景色で塗りつぶし
        const firstLayerCtx = this.layers[0].ctx;
        firstLayerCtx.fillStyle = '#f0e0d6';
        firstLayerCtx.fillRect(0, 0, this.width, this.height);
        this.switchLayer(0);
    }

    addLayer() {
        const newCanvas = document.createElement('canvas');
        newCanvas.width = this.width;
        newCanvas.height = this.height;
        const newCtx = newCanvas.getContext('2d');
        newCtx.lineCap = 'round';
        newCtx.lineJoin = 'round';

        const newLayer = {
            canvas: newCanvas,
            ctx: newCtx,
            transform: this.getDefaultTransform(),
            visible: true,
        };
        // 新しいレイヤーを現在のアクティブレイヤーの上に追加
        this.layers.splice(this.activeLayerIndex + 1, 0, newLayer);
        this.switchLayer(this.activeLayerIndex + 1);
        
        return newLayer;
    }

    switchLayer(index) {
        if (index < 0 || index >= this.layers.length) return;
        this.activeLayerIndex = index;
        const activeLayer = this.getCurrentLayer();
        if (activeLayer) {
            this.app.canvasManager.setActiveLayerContext(activeLayer.ctx);
        }
        const infoEl = document.getElementById('current-layer-info');
        if (infoEl) infoEl.textContent = `L: ${this.activeLayerIndex + 1}/${this.layers.length}`;
    }

    getCurrentLayer() {
        return this.layers[this.activeLayerIndex] || null;
    }

    /**
     * @brief アクティブレイヤーのtransformを元に変換マトリックスを生成して返す
     */
    getActiveLayerMatrix() {
        const layer = this.getCurrentLayer();
        if (!layer) return new DOMMatrix();
        
        const t = layer.transform;
        let m = new DOMMatrix();
        m = m.translate(t.x + this.width / 2, t.y + this.height / 2);
        m = m.rotate(t.rotation);
        m = m.scale(t.scale * t.scaleX, t.scale * t.scaleY);
        m = m.translate(-this.width / 2, -this.height / 2);
        return m;
    }
    
    clearAllLayers() {
        this.layers.forEach((layer, index) => {
            layer.ctx.clearRect(0, 0, this.width, this.height);
            if (index === 0) {
                layer.ctx.fillStyle = '#f0e0d6';
                layer.ctx.fillRect(0, 0, this.width, this.height);
            }
        });
    }

    // --- レイヤー操作メソッド ---
    moveActiveLayer(dx, dy) { const l = this.getCurrentLayer(); if(l){l.transform.x += dx; l.transform.y += dy;} }
    scaleActiveLayer(factor) { const l = this.getCurrentLayer(); if(l){l.transform.scale *= factor;} }
    rotateActiveLayer(degrees) { const l = this.getCurrentLayer(); if(l){l.transform.rotation = (l.transform.rotation + degrees) % 360;} }
    flipActiveLayerHorizontal() { const l = this.getCurrentLayer(); if(l){l.transform.scaleX *= -1;} }
    flipActiveLayerVertical() { const l = this.getCurrentLayer(); if(l){l.transform.scaleY *= -1;} }
}
