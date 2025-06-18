class TopBarManager {
    constructor(app) {
        this.app = app;
        this.topBar = document.getElementById('top-bar');
        this.init();
    }

    init() {
        this.topBar.innerHTML = `
            <span class="logo">トシンカ手描きツール</span>
            <span id="current-tool-indicator"></span>
            <button id="add-layer-btn">レイヤー追加</button>
            <button id="remove-layer-btn">レイヤー削除</button>
            <button id="reset-view-btn">リセット</button>
        `;
        document.getElementById("add-layer-btn").onclick = () => this.app.layerManager.addLayer();
        document.getElementById("remove-layer-btn").onclick = () => this.app.layerManager.removeLayer(this.app.layerManager.activeLayerIndex);
        document.getElementById("reset-view-btn").onclick = () => this.app.canvasManager.resetView();
    }

    setToolName(name) {
        const indicator = document.getElementById('current-tool-indicator');
        if (indicator) indicator.textContent = `（${name}）`;
    }
}