// 20250614_1730_LayerManager.js
// 新規作成
class LayerManager {
    constructor(app) {
        this.app = app;
        this.layers = [];
        this.activeLayerIndex = -1;

        this.canvasContainer = document.getElementById('canvas-container');
        // HTMLにある最初のcanvasをサイズと設定のテンプレートとして使用
        const templateCanvas = document.getElementById('drawingCanvas');
        this.canvasWidth = templateCanvas.width;
        this.canvasHeight = templateCanvas.height;
    }

    /**
     * ★必須要件: アプリケーション開始時に最初のレイヤーを作成し、アクティブにする
     */
    setupInitialLayers() {
        this.addLayer(); // 最初のレイヤーを追加
        this.switchLayer(0); // そのレイヤーをアクティブにする
    }

    /**
     * ★必須要件: 新しいレイヤー（canvas）を作成して管理リストに追加する
     */
    addLayer() {
        const newCanvas = document.createElement('canvas');
        newCanvas.width = this.canvasWidth;
        newCanvas.height = this.canvasHeight;
        
        // 指示通り、display:noneは使用しない
        // HTML側で追加した.layer-canvas classを付与
        newCanvas.className = 'main-canvas layer-canvas'; 

        const newCtx = newCanvas.getContext('2d');
        newCtx.lineCap = 'round';
        newCtx.lineJoin = 'round';

        // 最初のレイヤーのみ、識別のために背景色を塗る
        // （v1.1の挙動を模倣するが、以降のレイヤーは透明）
        if (this.layers.length === 0) {
            newCtx.fillStyle = '#f0e0d6';
            newCtx.fillRect(0, 0, newCanvas.width, newCanvas.height);
        }
        
        const layerObject = {
            canvas: newCanvas,
            ctx: newCtx,
        };

        this.layers.push(layerObject);
        this.canvasContainer.appendChild(newCanvas);
        this.updateAllLayerZIndexes();
        
        console.log(`レイヤーを追加しました。合計: ${this.layers.length}枚`);
        return this.layers.length - 1; // 追加されたレイヤーのインデックスを返す
    }

    /**
     * ★必須要件: 指定されたインデックスのレイヤーに切り替える
     * @param {number} index - 切り替えたいレイヤーのインデックス
     */
    switchLayer(index) {
        if (index < 0 || index >= this.layers.length) {
            console.error("無効なレイヤーインデックスです:", index);
            return;
        }

        this.activeLayerIndex = index;
        const activeLayer = this.getCurrentLayer();
        
        // CanvasManagerに、描画対象のcanvasとcontextを通知する
        this.app.canvasManager.setActiveLayerContext(activeLayer.canvas, activeLayer.ctx);
        // カーソル表示を更新
        this.app.canvasManager.updateCursor();
        
        console.log(`${index + 1}番目のレイヤーに切り替えました。`);
    }

    /**
     * ★必須要件: 現在アクティブなレイヤーオブジェクトを返す
     * @returns {object|null} アクティブなレイヤーのオブジェクト、またはnull
     */
    getCurrentLayer() {
        if (this.activeLayerIndex >= 0 && this.activeLayerIndex < this.layers.length) {
            return this.layers[this.activeLayerIndex];
        }
        return null;
    }

    /**
     * ★必須要件: すべてのレイヤーの重ね順（z-index）を更新する
     * 配列のインデックスが小さいほど下になるように設定
     */
    updateAllLayerZIndexes() {
        this.layers.forEach((layer, index) => {
            // position: absoluteが効いているので、z-indexで重ね順を制御できる
            layer.canvas.style.zIndex = index;
        });
    }
}
