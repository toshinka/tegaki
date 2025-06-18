class ToshinkaTegakiTool {
    constructor() {
        this.layerManager = new LayerManager(this);
        this.canvasManager = new CanvasManager(this);
        this.topBarManager = new TopBarManager(this);
        this.toolManager = new ToolManager(this);
        this.penSettingsManager = new PenSettingsManager(this);
        this.shortcutManager = new ShortcutManager(this);

        // 初期レイヤーセットアップ
        this.layerManager.setupInitialLayers();
        this.canvasManager.requestRender();
    }
}
window.addEventListener('DOMContentLoaded', () => {
    window.toshinkaApp = new ToshinkaTegakiTool();
});