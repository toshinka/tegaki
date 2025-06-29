// LayerManager-v1-3-rev1.js
// 額縁はレイヤー管理の対象外であり、このファイルに影響はありません。
// 指示に基づき、プレフィックスのみ更新しました。
class LayerManager {
    /**
     * @param {ToshinkaTegakiTool} app メインアプリケーションのインスタンス
     */
    constructor(app) {
        this.app = app;
        this.layers = [];
        this.activeLayerIndex = -1;
        this.canvasContainer = document.getElementById('canvas-container');
    }

    /**
     * 初期状態のレイヤーをセットアップする。
     */
    setupInitialLayers() {
        const initialCanvas = document.getElementById('drawingCanvas');
        if (!initialCanvas) {
            console.error('Initial canvas #drawingCanvas not found!');
            return;
        }

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

    /**
     * 新しい透明なレイヤーを追加する。
     */
    addLayer() {
        if (this.layers.length === 0) {
            console.error("Cannot add a new layer without an initial layer.");
            return null;
        }

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
        
        console.log(`Layer added. Total layers: ${this.layers.length}`);
        return newLayer;
    }

    /**
     * 指定されたインデックスのレイヤーに描画対象を切り替える。
     * @param {number} index 切り替えたいレイヤーのインデックス
     */
    switchLayer(index) {
        if (index < 0 || index >= this.layers.length) {
            console.error(`Invalid layer index: ${index}`);
            return;
        }
        
        this.activeLayerIndex = index;
        const activeLayer = this.getCurrentLayer();
        
        if (activeLayer) {
            // CanvasManagerに、現在アクティブなcanvasとcontextを教える
            this.app.canvasManager.setActiveLayerContext(activeLayer.canvas, activeLayer.ctx);

            this.layers.forEach((layer, i) => {
                if (i === index) {
                    layer.canvas.style.pointerEvents = 'auto';
                } else {
                    layer.canvas.style.pointerEvents = 'none';
                }
            });

            console.log(`Switched to layer ${index}. Events enabled.`);

            const infoEl = document.getElementById('current-layer-info');
            if (infoEl) {
                infoEl.textContent = `L: ${this.activeLayerIndex + 1}/${this.layers.length}`;
            }
        }
    }

    /**
     * 現在アクティブなレイヤーのオブジェクトを返す。
     */
    getCurrentLayer() {
        if (this.activeLayerIndex >= 0 && this.activeLayerIndex < this.layers.length) {
            return this.layers[this.activeLayerIndex];
        }
        return null;
    }

    /**
     * 全てのレイヤーのz-indexを更新する。
     */
    updateAllLayerZIndexes() {
        this.layers.forEach((layer, index) => {
            layer.canvas.style.zIndex = index;
        });
    }
}