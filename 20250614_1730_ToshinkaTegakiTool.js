// 20250614_1730_ToshinkaTegakiTool.js
// v1.2 レイヤー機能対応
class ToshinkaTegakiTool {
    constructor() {
        this.colorManager = null;
        this.toolManager = null;
        this.canvasManager = null;
        this.topBarManager = null;
        this.penSettingsManager = null;
        // ★変更: LayerManagerを有効化
        this.layerManager = null;
        // this.shortcutManager = null; // 未使用

        this.initManagers();
        this.bindGlobalEvents();
        // ★追加: テスト用のイベントバインド
        this.bindTestLayerControls(); 
    }

    initManagers() {
        // ★変更: 指示通りの初期化順序
        // 1. CanvasManager (レイヤーからの描画命令を受け取る準備)
        this.canvasManager = new CanvasManager(this);
        // 2. LayerManager (キャンバスを生成し、CanvasManagerに渡す)
        this.layerManager = new LayerManager(this);
        
        // その他のManager
        this.colorManager = new ColorManager(this);
        this.toolManager = new ToolManager(this);
        this.topBarManager = new TopBarManager(this);
        this.penSettingsManager = new PenSettingsManager(this);
        
        // ★変更: LayerManagerが初期レイヤーを設定する
        this.layerManager.setupInitialLayers();

        // 初期設定の適用
        this.toolManager.setTool('pen');
        this.penSettingsManager.setSize(1);
        this.colorManager.setColor(this.colorManager.mainColor);
        
        // ★変更: 初期レイヤー設定後に、その状態を履歴の最初として保存
        this.canvasManager.saveState();
    }

    bindGlobalEvents() {
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));
    }
    
    /**
     * ★追加: テスト用レイヤー操作ボタンのイベントを設定
     * このメソッドは将来的にUIパネルが実装されたら削除されます。
     */
    bindTestLayerControls() {
        const addLayerBtn = document.getElementById('add-layer-btn-test');
        const nextLayerBtn = document.getElementById('next-layer-btn-test');
        
        addLayerBtn.addEventListener('click', () => {
            const newIndex = this.layerManager.addLayer();
            this.layerManager.switchLayer(newIndex);
            this.updateLayerInfo();
        });

        nextLayerBtn.addEventListener('click', () => {
            let nextIndex = this.layerManager.activeLayerIndex + 1;
            if (nextIndex >= this.layerManager.layers.length) {
                nextIndex = 0; // 最後までいったら最初に戻る
            }
            this.layerManager.switchLayer(nextIndex);
            this.updateLayerInfo();
        });

        // 初期表示
        this.updateLayerInfo();
    }
    
    /**
     * ★追加: テスト用UIに現在のレイヤー情報を表示
     */
    updateLayerInfo() {
        const infoSpan = document.getElementById('layer-info-test');
        if (infoSpan) {
            const total = this.layerManager.layers.length;
            const current = this.layerManager.activeLayerIndex + 1;
            infoSpan.textContent = `レイヤー: ${current} / ${total}`;
        }
    }

    // handleKeyDown, handleKeyUp は v1.1から変更なし
    // 既存機能の互換性を維持
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
                case '}': case ']':
                    this.colorManager.changeColor(true); break;
                case '{': case '[':
                    this.colorManager.changeColor(false); break;
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
