// 20250614_1435_LayerManager.js
/**
 * レイヤーの管理を行うクラス（最小限の実装）
 */
class LayerManager {
    /**
     * @param {ToshinkaTegakiTool} app メインアプリケーションインスタンス
     */
    constructor(app) {
        this.app = app;
        this.canvasContainer = document.getElementById('canvas-container');
        this.layers = [];
        this.activeLayerIndex = -1;
    }

    /**
     * @inheritdoc
     * 初期レイヤーをセットアップする
     */
    setupInitialLayers() {
        const initialCanvas = document.getElementById('drawingCanvas');
        if (!initialCanvas) {
            console.error('Initial canvas #drawingCanvas not found!');
            return;
        }

        const ctx = initialCanvas.getContext('2d');
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // 背景色で塗りつぶし
        ctx.fillStyle = '#f0e0d6';
        ctx.fillRect(0, 0, initialCanvas.width, initialCanvas.height);

        const initialLayer = {
            canvas: initialCanvas,
            ctx: ctx,
            name: '背景' // v1.1の動作を維持するため、最初のレイヤーは背景とする
        };

        this.layers.push(initialLayer);
        this.switchLayer(0); // 最初のレイヤーをアクティブにする
        this.updateAllLayerZIndexes();

        // 最初の描画用レイヤーを追加し、アクティブにする
        const firstLayer = this.addLayer();
        this.switchLayer(this.layers.length - 1);
    }

    /**
     * @inheritdoc
     * 新しいレイヤーを追加する
     * @returns {object} 作成された新しいレイヤーオブジェクト
     */
    addLayer() {
        const templateCanvas = this.layers[0].canvas; // 最初のレイヤーをテンプレートとする
        
        const newCanvas = document.createElement('canvas');
        newCanvas.width = templateCanvas.width;
        newCanvas.height = templateCanvas.height;
        newCanvas.className = 'main-canvas'; // 同じクラスを適用
        // CSSでposition:absoluteが設定されている前提

        const newCtx = newCanvas.getContext('2d');
        newCtx.lineCap = 'round';
        newCtx.lineJoin = 'round';

        const newLayer = {
            canvas: newCanvas,
            ctx: newCtx,
            name: `レイヤー ${this.layers.length}`
        };

        this.layers.push(newLayer);
        this.canvasContainer.appendChild(newCanvas);
        this.updateAllLayerZIndexes();
        
        return newLayer;
    }

    /**
     * @inheritdoc
     * 指定されたインデックスのレイヤーに切り替える
     * @param {number} index 切り替えたいレイヤーのインデックス
     */
    switchLayer(index) {
        if (index < 0 || index >= this.layers.length) {
            console.error(`Layer with index ${index} does not exist.`);
            return;
        }
        
        this.activeLayerIndex = index;
        const currentLayer = this.getCurrentLayer();
        
        // CanvasManagerの描画ターゲットを更新
        this.app.canvasManager.setActiveLayerContext(currentLayer.canvas, currentLayer.ctx);

        console.log(`Switched to layer: ${currentLayer.name}`);
    }

    /**
     * @inheritdoc
     * 現在アクティブなレイヤーを取得する
     * @returns {object|null} アクティブなレイヤーオブジェクト、またはnull
     */
    getCurrentLayer() {
        if (this.activeLayerIndex !== -1) {
            return this.layers[this.activeLayerIndex];
        }
        return null;
    }

    /**
     * @inheritdoc
     * 全てのレイヤーのz-indexを更新する
     */
    updateAllLayerZIndexes() {
        this.layers.forEach((layer, index) => {
            // 配列のインデックスが小さいほど奥になるようにz-indexを設定
            layer.canvas.style.zIndex = index;
        });
    }
}
