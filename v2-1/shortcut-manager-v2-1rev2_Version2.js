class ShortcutManager {
    constructor(app) {
        this.app = app;
        this.bindShortcuts();
    }

    bindShortcuts() {
        window.addEventListener('keydown', (e) => {
            // Ctrl+Zでアンドゥ(未実装)
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                alert('アンドゥ（未実装）');
            }
            // レイヤー切り替え: [ / ]
            if (e.key === '[') {
                this.app.layerManager.switchLayer(Math.max(0, this.app.layerManager.activeLayerIndex - 1));
            }
            if (e.key === ']') {
                this.app.layerManager.switchLayer(Math.min(this.app.layerManager.layers.length - 1, this.app.layerManager.activeLayerIndex + 1));
            }
            // Vキーでtransform mode（CanvasManagerで処理）
            // SpaceキーはCanvasManagerで処理
        });
    }
}