// ToshinkaTegakiTool-v1-3-rev5.js
// キーボードイベント処理をすべてShortcutManagerへ移譲。
// このクラスは各Managerの初期化と管理に専念する。
class ToshinkaTegakiTool {
    constructor() {
        this.colorManager = null;
        this.toolManager = null;
        this.canvasManager = null;
        this.topBarManager = null;
        this.penSettingsManager = null;
        this.layerManager = null;
        this.shortcutManager = null;

        // テスト用変数
        this.test_currentLayerIndex = 0;

        this.initManagers();
        this.bindTestButtons();
    }

    initManagers() {

        this.canvasManager = new CanvasManager(this);
        this.layerManager = new LayerManager(this);
        this.layerManager.setupInitialLayers();
        this.penSettingsManager = new PenSettingsManager(this);
        this.toolManager = new ToolManager(this);
        this.colorManager = new ColorManager(this);
        this.topBarManager = new TopBarManager(this);
        this.shortcutManager = new ShortcutManager(this);
        this.shortcutManager.initialize();


        // 初期状態の設定
        this.layerManager.setupInitialLayers();
        this.toolManager.setTool('pen');
        this.penSettingsManager.setSize(1);
        this.colorManager.setColor(this.colorManager.mainColor);
        this.canvasManager.saveState();
    }

    /**
     * 将来的に削除されるテスト用ボタンのイベントリスナーを設定する
     */
    bindTestButtons() {
        const addBtn = document.getElementById('add-layer-btn-test');
        const switchBtn = document.getElementById('switch-layer-btn-test');

        if (addBtn) {
            addBtn.addEventListener('click', () => {
                const newLayer = this.layerManager.addLayer();
                if (newLayer) {
                    this.test_currentLayerIndex = this.layerManager.activeLayerIndex;
                }
            });
        }
        
        if (switchBtn) {
            switchBtn.addEventListener('click', () => {
                if (this.layerManager.layers.length > 1) {
                    this.test_currentLayerIndex = (this.test_currentLayerIndex + 1) % this.layerManager.layers.length;
                    this.layerManager.switchLayer(this.test_currentLayerIndex);
                }
            });
        }
    }

    // handleKeyDownとhandleKeyUpはShortcutManagerに移譲されたため削除
}

window.addEventListener('DOMContentLoaded', () => {
    if (!window.toshinkaTegakiInitialized) {
        window.toshinkaTegakiInitialized = true;
        window.toshinkaTegakiTool = new ToshinkaTegakiTool();
    }
});
