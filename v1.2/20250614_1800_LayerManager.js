// 20250614_1800_LayerManager.js
/**
 * LayerManager.js
 * レイヤー機能の管理を行うモジュール。
 * 今回は指示書に基づき、最低限の機能のみを実装。
 */
class LayerManager {
    /**
     * @param {ToshinkaTegakiTool} app メインアプリケーションのインスタンス
     */
    constructor(app) {
        this.app = app;
        this.layers = []; // canvas要素を格納する配列
        this.activeLayerIndex = -1; // 現在アクティブなレイヤーのインデックス
        this.canvasContainer = document.getElementById('canvas-container');
    }

    /**
     * 初期状態のレイヤーをセットアップする。
     * 既存の 'drawingCanvas' を最初のレイヤー（背景レイヤー）として利用する。
     */
    setupInitialLayers() {
        // HTMLに元からあるcanvasをレイヤー1として取得
        const initialCanvas = document.getElementById('drawingCanvas');
        if (!initialCanvas) {
            console.error('Initial canvas #drawingCanvas not found!');
            return;
        }

        // レイヤーオブジェクトとして情報を格納
        this.layers.push({
            canvas: initialCanvas,
            ctx: initialCanvas.getContext('2d'),
        });

        // 最初のレイヤーを背景として初期化
        const firstLayerCtx = this.layers[0].ctx;
        firstLayerCtx.fillStyle = '#f0e0d6';
        firstLayerCtx.fillRect(0, 0, initialCanvas.width, initialCanvas.height);

        // 最初のレイヤーをアクティブに設定
        this.switchLayer(0);

        // z-indexを更新
        this.updateAllLayerZIndexes();
    }

    /**
     * 新しい透明なレイヤーを追加する。
     * @returns {object | null} 作成されたレイヤーオブジェクト、または失敗した場合はnull
     */
    addLayer() {
        if (this.layers.length === 0) {
            console.error("Cannot add a new layer without an initial layer.");
            return null;
        }

        // 基準となる最初のキャンバスのサイズを取得
        const baseCanvas = this.layers[0].canvas;

        // 新しいcanvas要素を作成
        const newCanvas = document.createElement('canvas');
        newCanvas.width = baseCanvas.width;
        newCanvas.height = baseCanvas.height;
        newCanvas.className = 'main-canvas'; // 既存のcanvasと同じクラスを付与

        // 新しいcanvasをDOMに追加
        this.canvasContainer.appendChild(newCanvas);

        // 新しいレイヤーを配列に追加
        const newLayer = {
            canvas: newCanvas,
            ctx: newCanvas.getContext('2d'),
        };
        this.layers.push(newLayer);
        
        // 新しいレイヤーのコンテキストを初期化
        newLayer.ctx.lineCap = 'round';
        newLayer.ctx.lineJoin = 'round';

        // z-indexを更新
        this.updateAllLayerZIndexes();

        // 新しく作成したレイヤーをアクティブにする
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
        const layer = this.getCurrentLayer();
        
        if (layer) {
            // CanvasManagerに、現在アクティブなcanvasとcontextを教える
            this.app.canvasManager.setActiveLayerContext(layer.canvas, layer.ctx);
            console.log(`Switched to layer ${index}`);

            // テスト用UIの表示を更新
            const infoEl = document.getElementById('current-layer-info');
            if (infoEl) {
                infoEl.textContent = `L: ${this.activeLayerIndex + 1}/${this.layers.length}`;
            }
        }
    }

    /**
     * 現在アクティブなレイヤーのオブジェクトを返す。
     * @returns {object | null} 現在のレイヤーオブジェクト、または存在しない場合はnull
     */
    getCurrentLayer() {
        if (this.activeLayerIndex >= 0 && this.activeLayerIndex < this.layers.length) {
            return this.layers[this.activeLayerIndex];
        }
        return null;
    }

    /**
     * 全てのレイヤーのz-indexを、配列の順序に基づいて更新する。
     * 配列のインデックスが小さいほど下に配置される (z-indexが小さい)。
     */
    updateAllLayerZIndexes() {
        this.layers.forEach((layer, index) => {
            layer.canvas.style.zIndex = index;
        });
    }
}
