// ToshinkaTegakiTool.js
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
    }

    initManagers() {
        this.colorManager = new ColorManager(this);
        this.toolManager = new ToolManager(this);
        this.canvasManager = new CanvasManager(this);
        this.topBarManager = new TopBarManager(this);
        this.penSettingsManager = new PenSettingsManager(this);
        this.layerManager = new LayerManager(this); // LayerManagerを初期化

        // 初期設定
        this.toolManager.setTool('pen');
        this.penSettingsManager.setSize(1);
        this.colorManager.setColor(this.colorManager.mainColor);
        
        // 初期状態を履歴に保存
        this.canvasManager.saveState();
    }

    bindGlobalEvents() {
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));
    }

    handleKeyDown(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.repeat) return;
        
        let handled = true;
        if (e.key === ' ' && !this.canvasManager.isSpaceDown) {
            this.canvasManager.isSpaceDown = true;
            this.canvasManager.updateCursor();
            e.preventDefault(); // スペースキーによるスクロールを防止
        } else if (e.key === 'v' || e.key === 'V') { // Vキーが押されたらレイヤー移動モードに
            if (!this.canvasManager.isMovingLayer) {
                this.canvasManager.isMovingLayer = true;
                this.canvasManager.updateCursor();
            }
        } else if (e.ctrlKey) {
            switch (e.key) {
                case 'z': this.canvasManager.undo(); break;
                case 'y': this.canvasManager.redo(); break;
                default: handled = false;
            }
        } else {
            switch (e.key) {
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
        } else if (e.key === 'v' || e.key === 'V') { // Vキーが離されたらレイヤー移動モードを終了
            this.canvasManager.isMovingLayer = false;
            this.canvasManager.updateCursor();
            // レイヤー移動が終了したら、最後に状態を保存
            // this.canvasManager.saveState(); // mouseUpで保存されるため重複回避
        }
    }
}

window.addEventListener('DOMContentLoaded', () => {
    if (!window.toshinkaTegakiToolApp) {
        window.toshinkaTegakiToolApp = new ToshinkaTegakiTool();
    }
});