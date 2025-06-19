class TopBarManager {
    constructor(app) {
        this.app = app;
        this.bindEvents();
    }
    bindEvents() {
        document.getElementById('undo-btn').addEventListener('click', () => this.app.canvasManager.undo());
        document.getElementById('redo-btn').addEventListener('click', () => this.app.canvasManager.redo());
        document.getElementById('close-btn').addEventListener('click', () => this.closeTool());
        const clearBtn = document.getElementById('clear-btn');
        if (clearBtn) {
            clearBtn.title = 'アクティブレイヤーを消去 (Delete)';
            clearBtn.addEventListener('click', () => this.app.canvasManager.clearCanvas());
            const clearAllBtn = document.createElement('button');
            clearAllBtn.id = 'clear-all-btn';
            clearAllBtn.style.fontSize = "16px";
            clearAllBtn.style.padding = "0 4px";
            clearAllBtn.className = 'tool-btn';
            clearAllBtn.innerHTML = '🗑️*';
            clearAllBtn.title = '全レイヤーを消去 (Shift+Delete)';
            clearBtn.parentNode.insertBefore(clearAllBtn, clearBtn.nextSibling);
            clearAllBtn.addEventListener('click', () => {
                if (confirm('すべてのレイヤーを消去しますか？\nこの操作は元に戻すのが難しい場合があります。')) {
                    this.app.canvasManager.clearAllLayers();
                }
            });
        }
        document.getElementById('flip-h-btn').addEventListener('click', () => this.app.canvasManager.flipHorizontal());
        document.getElementById('flip-v-btn').addEventListener('click', () => this.app.canvasManager.flipVertical());
        document.getElementById('zoom-in-btn').addEventListener('click', () => this.app.canvasManager.zoom(1.2));
        document.getElementById('zoom-out-btn').addEventListener('click', () => this.app.canvasManager.zoom(1 / 1.2));
        document.getElementById('rotate-btn').addEventListener('click', () => this.app.canvasManager.rotate(15));
        document.getElementById('rotate-ccw-btn').addEventListener('click', () => this.app.canvasManager.rotate(-15));
        document.getElementById('reset-view-btn').addEventListener('click', () => this.app.canvasManager.resetView());
    }
    closeTool() {
        if (confirm('ウィンドウを閉じますか？')) {
            window.close();
        }
    }
}
class ShortcutManager {
    constructor(app) {
        this.app = app;
    }
    initialize() {
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));
        document.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
    }
    handleKeyUp(e) {
        if (e.key === ' ') {
            this.app.canvasManager.isSpaceDown = false;
            this.app.canvasManager.updateCursor();
            e.preventDefault();
        }
    }
    handleKeyDown(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.repeat) return;
        if (e.key === ' ' && !this.app.canvasManager.isSpaceDown) {
            this.app.canvasManager.isSpaceDown = true;
            this.app.canvasManager.updateCursor();
            e.preventDefault();
        }
        if (this.app.canvasManager.isSpaceDown) {
            let handled = true;
            const moveAmount = 10;
            const style = this.app.canvasManager.canvasContainer.style;
            this.app.canvasManager.setAbsolutePosition();
            switch (e.key) {
                case 'ArrowUp': style.top = (parseFloat(style.top) - moveAmount) + 'px'; break;
                case 'ArrowDown': style.top = (parseFloat(style.top) + moveAmount) + 'px'; break;
                case 'ArrowLeft': style.left = (parseFloat(style.left) - moveAmount) + 'px'; break;
                case 'ArrowRight': style.left = (parseFloat(style.left) + moveAmount) + 'px'; break;
                default: handled = false;
            }
            if (handled) e.preventDefault();
            return;
        }
        let handled = false;
        if (this.app.toolManager.getCurrentTool() === 'move') {
            handled = this.handleLayerTransformKeys(e);
        }
        if (!handled) {
            handled = this.handleGlobalKeys(e);
        }
        if (handled) {
            e.preventDefault();
        }
    }
    handleLayerTransformKeys(e) {
        let handled = true;
        const moveAmount = 1;
        const rotateAmount = 1;
        const scaleFactor = 1.02;
        if (e.shiftKey) {
            switch (e.key.toLowerCase()) {
                case 'h': this.app.layerManager.flipActiveLayerVertical(); break;
                case 'arrowup': this.app.layerManager.scaleActiveLayer(scaleFactor); break;
                case 'arrowdown': this.app.layerManager.scaleActiveLayer(1 / scaleFactor); break;
                case 'arrowleft': this.app.layerManager.rotateActiveLayer(-rotateAmount); break;
                case 'arrowright': this.app.layerManager.rotateActiveLayer(rotateAmount); break;
                default: handled = false;
            }
        } else {
            switch (e.key.toLowerCase()) {
                case 'h': this.app.layerManager.flipActiveLayerHorizontal(); break;
                case 'arrowup': this.app.layerManager.moveActiveLayer(0, -moveAmount); break;
                case 'arrowdown': this.app.layerManager.moveActiveLayer(0, moveAmount); break;
                case 'arrowleft': this.app.layerManager.moveActiveLayer(-moveAmount, 0); break;
                case 'arrowright': this.app.layerManager.moveActiveLayer(moveAmount, 0); break;
                default: handled = false;
            }
        }
        return handled;
    }
    handleGlobalKeys(e) {
        let handled = true;
        if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 'z': this.app.canvasManager.undo(); break;
                case 'y': this.app.canvasManager.redo(); break;
                default: handled = false;
            }
        } else if (e.shiftKey) {
            switch (e.key) {
                case '}': case ']': this.app.colorManager.changeColor(true); break;
                case '{': case '[': this.app.colorManager.changeColor(false); break;
                default:
                    switch (e.key.toLowerCase()) {
                        case 'h': this.app.canvasManager.flipVertical(); break;
                        case 'arrowup': this.app.canvasManager.zoom(1.20); break;
                        case 'arrowdown': this.app.canvasManager.zoom(1 / 1.20); break;
                        case 'arrowleft': this.app.canvasManager.rotate(-15); break;
                        case 'arrowright': this.app.canvasManager.rotate(15); break;
                        default: handled = false;
                    }
            }
        } else {
            switch (e.key.toLowerCase()) {
                case '[': this.app.penSettingsManager.changeSize(false); break;
                case ']': this.app.penSettingsManager.changeSize(true); break;
                case 'x': this.app.colorManager.swapColors(); break;
                case 'd': this.app.colorManager.resetColors(); break;
                case 'p': this.app.toolManager.setTool('pen'); break;
                case 'e': this.app.toolManager.setTool('eraser'); break;
                case 'v': this.app.toolManager.setTool('move'); break;
                case 'g': this.app.toolManager.setTool('bucket'); break;
                case 'h': this.app.canvasManager.flipHorizontal(); break;
                case '1': this.app.canvasManager.resetView(); break;
                case 'arrowup': this.app.canvasManager.zoom(1.05); break;
                case 'arrowdown': this.app.canvasManager.zoom(1 / 1.05); break;
                case 'arrowleft': this.app.canvasManager.rotate(-5); break;
                case 'arrowright': this.app.canvasManager.rotate(5); break;
                default: handled = false;
            }
        }
        return handled;
    }
    handleWheel(e) {
        if (this.app.toolManager.getCurrentTool() !== 'move') {
            return false;
        }
        const delta = e.deltaY > 0 ? -1 : 1;
        let handled = true;
        if (e.shiftKey && e.ctrlKey) {
            this.app.layerManager.rotateActiveLayer(delta * 5);
        } else if (e.shiftKey) {
            const scaleFactor = delta > 0 ? 1.1 : 1 / 1.1;
            this.app.layerManager.scaleActiveLayer(scaleFactor);
        } else if (!e.shiftKey && !e.ctrlKey) {
            const scaleFactor = delta > 0 ? 1.05 : 1 / 1.05;
            this.app.layerManager.scaleActiveLayer(scaleFactor);
        } else {
            handled = false;
        }
        return handled;
    }
}
class ToshinkaTegakiTool {
    constructor() {
        this.colorManager = null;
        this.toolManager = null;
        this.canvasManager = null;
        this.topBarManager = null;
        this.penSettingsManager = null;
        this.layerManager = null;
        this.shortcutManager = null;
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
        this.toolManager.setTool('pen');
        this.penSettingsManager.setSize(1);
        this.colorManager.setColor(this.colorManager.mainColor);
        this.canvasManager.saveState();
    }
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
}
window.addEventListener('DOMContentLoaded', () => {
    if (!window.toshinkaTegakiInitialized) {
        window.toshinkaTegakiInitialized = true;
        window.toshinkaTegakiTool = new ToshinkaTegakiTool();
    }
});