// 20250614_2120_ToshinkaTegakiTool.js
// 額縁追従機能はCanvasManagerで完結するため、このファイルへの変更は不要です。
// 指示に基づき、プレフィックスのみ更新しました。
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
        this.bindGlobalEvents();
        this.bindTestButtons();
    }

    initManagers() {
        this.colorManager = new ColorManager(this);
        this.toolManager = new ToolManager(this);
        this.penSettingsManager = new PenSettingsManager(this);
        this.topBarManager = new TopBarManager(this);

        this.canvasManager = new CanvasManager(this);
        this.layerManager = new LayerManager(this);
        this.shortcutManager = new ShortcutManager(this);

        this.layerManager.setupInitialLayers();
        
        this.toolManager.setTool('pen');
        this.penSettingsManager.setSize(1);
        this.colorManager.setColor(this.colorManager.mainColor);
        
        this.canvasManager.saveState();
    }

    bindGlobalEvents() {
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));
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


    handleKeyDown(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.repeat) return;
        
        if (e.key === ' ' && !this.canvasManager.isSpaceDown) {
            this.canvasManager.isSpaceDown = true;
            this.canvasManager.updateCursor();
            e.preventDefault();
        }

        if (this.canvasManager.isSpaceDown) {
            let handled = true;
            const moveAmount = 10;
            const style = this.canvasManager.canvasContainer.style;
            this.canvasManager.setAbsolutePosition();
            switch(e.key) {
                case 'ArrowUp':    style.top = (parseFloat(style.top) - moveAmount) + 'px'; break;
                case 'ArrowDown':  style.top = (parseFloat(style.top) + moveAmount) + 'px'; break;
                case 'ArrowLeft':  style.left = (parseFloat(style.left) - moveAmount) + 'px'; break;
                case 'ArrowRight': style.left = (parseFloat(style.left) + moveAmount) + 'px'; break;
                default: handled = false;
            }
            if(handled) e.preventDefault();
            return;
        }

        let handled = true;
        if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 'z': this.canvasManager.undo(); break;
                case 'y': this.canvasManager.redo(); break;
                default: handled = false;
            }
        } else if (e.shiftKey) {
            switch (e.key) {
                case '}': case ']': this.colorManager.changeColor(true); break;
                case '{': case '[': this.colorManager.changeColor(false); break;
                default:
                    switch (e.key.toLowerCase()) {
                        case 'h': this.canvasManager.flipVertical(); break;
                        case 'arrowup': this.canvasManager.zoom(1.20); break;
                        case 'arrowdown': this.canvasManager.zoom(1 / 1.20); break;
                        case 'arrowleft': this.canvasManager.rotate(-15); break;
                        case 'arrowright': this.canvasManager.rotate(15); break;
                        default: handled = false;
                    }
            }
        } else {
             switch (e.key.toLowerCase()) {
                case '[': this.penSettingsManager.changeSize(false); break;
                case ']': this.penSettingsManager.changeSize(true); break;
                case 'x': this.colorManager.swapColors(); break;
                case 'd': this.colorManager.resetColors(); break;
                case 'p': this.toolManager.setTool('pen'); break;
                case 'e': this.toolManager.setTool('eraser'); break;
                case 'v': this.toolManager.setTool('move'); break;
                case 'g': this.toolManager.setTool('bucket'); break;
                case 'h': this.canvasManager.flipHorizontal(); break;
                case '1': this.canvasManager.resetView(); break;
                case 'arrowup': this.canvasManager.zoom(1.05); break;
                case 'arrowdown': this.canvasManager.zoom(1 / 1.05); break;
                case 'arrowleft': this.canvasManager.rotate(-5); break;
                case 'arrowright': this.canvasManager.rotate(5); break;
                default: handled = false;
            }
        }
        if (handled) e.preventDefault();
    }

    handleKeyUp(e) {
        if (e.key === ' ') {
            this.canvasManager.isSpaceDown = false;
            this.canvasManager.updateCursor();
            e.preventDefault();
        }
    }
}

window.addEventListener('DOMContentLoaded', () => {
    if (!window.toshinkaTegakiInitialized) {
        window.toshinkaTegakiInitialized = true;
        window.toshinkaTegakiTool = new ToshinkaTegakiTool();
    }
});