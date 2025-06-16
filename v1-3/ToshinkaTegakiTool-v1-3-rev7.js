// ToshinkaTegakiTool-v1-3-rev7.js
// 各Managerの初期化順序を統制、canvas描画方式に対応

class ToshinkaTegakiTool {
    constructor() {
        this.colorManager = null;
        this.toolManager = null;
        this.penSettingsManager = null;
        this.topBarManager = null;
        this.layerManager = null;
        this.shortcutManager = null;
        this.canvasManager = null;

        this.test_currentLayerIndex = 0;

        this.initManagers();
        this.bindTestButtons();
    }

    initManagers() {
        // 依存関係のないManagerを先に初期化
        this.colorManager = new ColorManager(this);
        this.toolManager = new ToolManager(this);
        this.penSettingsManager = new PenSettingsManager(this);
        this.topBarManager = new TopBarManager(this);

        // 描画用Manager群を初期化
        this.layerManager = new LayerManager(this);
        this.canvasManager = new CanvasManager(this); // LayerManagerに依存

        // イベント・操作Managerを初期化
        this.shortcutManager = new ShortcutManager(this);
        this.shortcutManager.initialize();

        // 初期状態の設定
        this.layerManager.setupInitialLayers();
        this.toolManager.setTool('pen');
        this.penSettingsManager.setSize(1);
        this.colorManager.setColor(this.colorManager.mainColor);
    }

    bindTestButtons() {
        const addBtn = document.getElementById('add-layer-btn-test');
        const switchBtn = document.getElementById('switch-layer-btn-test');
        if (addBtn) addBtn.addEventListener('click', () => this.layerManager.addLayer());
        if (switchBtn) {
            switchBtn.addEventListener('click', () => {
                let nextIndex = (this.layerManager.activeLayerIndex + 1) % this.layerManager.layers.length;
                this.layerManager.switchLayer(nextIndex);
            });
        }
    }
}

window.addEventListener('DOMContentLoaded', () => {
    if (!window.toshinkaTegakiInitialized) {
        window.toshinkaTegakiInitialized = true;
        window.toshinkaTegakiTool = new ToshinkaTegakiTool();
    }
});