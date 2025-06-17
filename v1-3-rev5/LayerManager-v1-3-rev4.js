// LayerManager-v1-3-rev4.js
// 各レイヤーが個別のtransform情報（位置、回転、スケール、反転）を持つように改修。
// アクティブレイヤーを操作するメソッドを追加。
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
     * @brief レイヤーのtransformプロパティのデフォルト値を返す
     */
    getDefaultTransform() {
        return {
            x: 0,
            y: 0,
            scale: 1,    // 拡縮
            rotation: 0, // 回転
            scaleX: 1,   // 水平反転用 (1 or -1)
            scaleY: 1,   // 垂直反転用 (1 or -1)
        };
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
            transform: this.getDefaultTransform(), // transform情報を追加
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
            transform: this.getDefaultTransform(), // transform情報を追加
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
     * @brief 指定したレイヤーのtransformスタイルを更新する
     * @param {object} layer 更新対象のレイヤーオブジェクト
     */
    updateLayerTransform(layer) {
        if (!layer || !layer.transform) return;
        const t = layer.transform;
        const finalScaleX = t.scale * t.scaleX;
        const finalScaleY = t.scale * t.scaleY;
        layer.canvas.style.transform = `translate(${t.x}px, ${t.y}px) rotate(${t.rotation}deg) scale(${finalScaleX}, ${finalScaleY})`;
    }


    /**
     * 全てのレイヤーのz-indexを更新する。
     */
    updateAllLayerZIndexes() {
        this.layers.forEach((layer, index) => {
            layer.canvas.style.zIndex = index;
        });
    }

    // --- 以下、アクティブレイヤーのtransformを操作するメソッド群 ---

    moveActiveLayer(dx, dy) {
        const layer = this.getCurrentLayer();
        if (layer) {
            layer.transform.x += dx;
            layer.transform.y += dy;
            this.updateLayerTransform(layer);
        }
    }

    scaleActiveLayer(factor) {
        const layer = this.getCurrentLayer();
        if (layer) {
            layer.transform.scale *= factor;
            this.updateLayerTransform(layer);
        }
    }

    rotateActiveLayer(degrees) {
        const layer = this.getCurrentLayer();
        if (layer) {
            layer.transform.rotation = (layer.transform.rotation + degrees) % 360;
            this.updateLayerTransform(layer);
        }
    }

    flipActiveLayerHorizontal() {
        const layer = this.getCurrentLayer();
        if (layer) {
            layer.transform.scaleX *= -1;
            this.updateLayerTransform(layer);
        }
    }
    
    flipActiveLayerVertical() {
        const layer = this.getCurrentLayer();
        if (layer) {
            layer.transform.scaleY *= -1;
            this.updateLayerTransform(layer);
        }
    }
}
