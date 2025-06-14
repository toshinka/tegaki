// 20250614_1435_ToshinkaTegakiTool.js
class ToshinkaTegakiTool {
    constructor() {
        this.colorManager = null;
        this.toolManager = null;
        this.canvasManager = null;
        this.topBarManager = null;
        this.penSettingsManager = null;
        this.layerManager = null; // LayerManagerを追加

        this.initManagers();
        this.bindGlobalEvents();
        this.bindTestControlEvents(); // テスト用ボタンのイベントを設定
    }

    initManagers() {
        // 依存関係を考慮して初期化順序を調整
        this.colorManager = new ColorManager(this);
        this.toolManager = new ToolManager(this);
        this.penSettingsManager = new PenSettingsManager(this);
        this.topBarManager = new TopBarManager(this);
        
        // CanvasManagerを先に初期化
        this.canvasManager = new CanvasManager(this);
        
        // 次にLayerManagerを初期化
        this.layerManager = new LayerManager(this);
        this.layerManager.setupInitialLayers(); // 初期レイヤーを作成し、アクティブレイヤーを設定

        // 初期設定の適用
        this.toolManager.setTool('pen');
        this.penSettingsManager.setSize(1);
        this.colorManager.setColor(this.colorManager.mainColor);
        
        // 全ての準備が整ってから、初期状態を履歴に保存
        this.canvasManager.saveState();
    }

    bindGlobalEvents() {
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));
    }

    /**
     * 将来的に削除されるテスト用コントロールのイベントを設定
     */
    bindTestControlEvents() {
        const addLayerBtn = document.getElementById('add-layer-btn-test');
        const switchLayerBtn = document.getElementById('switch-layer-btn-test');

        if (addLayerBtn) {
            addLayerBtn.addEventListener('click', () => {
                this.layerManager.addLayer();
                // 新しく追加した最後のレイヤーに切り替える
                const newLayerIndex = this.layerManager.layers.length - 1;
                this.layerManager.switchLayer(newLayerIndex);
                this.canvasManager.saveState(); // 新規レイヤー作成を履歴に保存
            });
        }

        if (switchLayerBtn) {
            switchLayerBtn.addEventListener('click', () => {
                let nextIndex = this.layerManager.activeLayerIndex + 1;
                // レイヤーを循環させる
                if (nextIndex >= this.layerManager.layers.length) {
                    nextIndex = 0;
                }
                this.layerManager.switchLayer(nextIndex);
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

// ツール初期化
window.addEventListener('DOMContentLoaded', () => {
    if (!window.toshinkaTegakiInitialized) {
        window.toshinkaTegakiInitialized = true;
        window.toshinkaTegakiTool = new ToshinkaTegakiTool();
    }
});
