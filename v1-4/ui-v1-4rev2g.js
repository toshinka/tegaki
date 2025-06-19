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
        clearBtn.title = 'アクティブレイヤーを消去 (Delete)';
        clearBtn.addEventListener('click', () => this.app.canvasManager.clearCanvas());
        const clearAllBtn = document.createElement('button');
        clearAllBtn.id = 'clear-all-btn';
        clearAllBtn.className = 'tool-btn';
        clearAllBtn.innerHTML = '🗑️*';
        clearAllBtn.title = '全レイヤーを消去 (Shift+Delete)';
        clearBtn.parentNode.insertBefore(clearAllBtn, clearBtn.nextSibling);
        clearAllBtn.addEventListener('click', () => {
            if (confirm('すべてのレイヤーを消去しますか？')) {
                this.app.canvasManager.clearAllLayers();
            }
        });
        document.getElementById('flip-h-btn').addEventListener('click', () => this.app.canvasManager.flipViewHorizontal());
        document.getElementById('flip-v-btn').addEventListener('click', () => this.app.canvasManager.flipViewVertical());
        document.getElementById('zoom-in-btn').addEventListener('click', () => this.app.canvasManager.zoomView(1.2));
        document.getElementById('zoom-out-btn').addEventListener('click', () => this.app.canvasManager.zoomView(1 / 1.2));
        document.getElementById('rotate-btn').addEventListener('click', () => this.app.canvasManager.rotateView(15));
        document.getElementById('rotate-ccw-btn').addEventListener('click', () => this.app.canvasManager.rotateView(-15));
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
    }
    handleKeyUp(e) {
        if (e.key === ' ') {
            this.app.canvasManager.isSpaceDown = false;
            this.app.canvasManager.isPanning = false;
            this.app.canvasManager.isRotatingWithSpace = false;
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
            return;
        }
        if (this.app.canvasManager.isSpaceDown) return;
        let handled = false;
        if (this.app.toolManager.getCurrentTool() === 'move') {
            handled = this.handleLayerTransformKeys(e);
        }
        if (!handled) {
            handled = this.handleGlobalKeys(e);
        }
        if (handled) e.preventDefault();
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
                case 'arrowup': this.app.layerManager.moveActiveLayer(0, -moveAmount); this.app.layerManager.endMove(); break;
                case 'arrowdown': this.app.layerManager.moveActiveLayer(0, moveAmount); this.app.layerManager.endMove(); break;
                case 'arrowleft': this.app.layerManager.moveActiveLayer(-moveAmount, 0); this.app.layerManager.endMove(); break;
                case 'arrowright': this.app.layerManager.moveActiveLayer(moveAmount, 0); this.app.layerManager.endMove(); break;
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
                        case 'h': this.app.canvasManager.flipViewVertical(); break;
                        case 'arrowup': this.app.canvasManager.zoomView(1.20); break;
                        case 'arrowdown': this.app.canvasManager.zoomView(1 / 1.20); break;
                        case 'arrowleft': this.app.canvasManager.rotateView(-15); break;
                        case 'arrowright': this.app.canvasManager.rotateView(15); break;
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
                case 'h': this.app.canvasManager.flipViewHorizontal(); break;
                case '1': this.app.canvasManager.resetView(); break;
                case 'arrowup': this.app.canvasManager.zoomView(1.05); break;
                case 'arrowdown': this.app.canvasManager.zoomView(1 / 1.05); break;
                case 'arrowleft': this.app.canvasManager.rotateView(-5); break;
                case 'arrowright': this.app.canvasManager.rotateView(5); break;
                default: handled = false;
            }
        }
        return handled;
    }
    handleWheel(e) {
        const delta = e.deltaY > 0 ? -1 : 1;
        let handled = true;
        if (e.shiftKey && e.ctrlKey) {
            this.app.layerManager.rotateActiveLayer(delta * 5);
        } else if (e.shiftKey) {
            this.app.layerManager.scaleActiveLayer(delta > 0 ? 1.1 : 1 / 1.1);
        } else {
            handled = false;
        }
        return handled;
    }
}
class ToshinkaTegakiTool {
    constructor() {
        this.canvasManager = new CanvasManager(this);
        this.layerManager = new LayerManager(this);
        this.penSettingsManager = new PenSettingsManager(this);
        this.toolManager = new ToolManager(this);
        this.colorManager = new ColorManager(this);
        this.topBarManager = new TopBarManager(this);
        this.shortcutManager = new ShortcutManager(this);
        this.test_currentLayerIndex = 0;
        this.initialize();
    }
    initialize() {
        this.canvasManager.initCanvases();
        this.layerManager.setupInitialLayers();
        this.toolManager.bindEvents();
        this.penSettingsManager.bindEvents();
        this.colorManager.bindEvents();
        this.shortcutManager.initialize();
        this.toolManager.setTool('pen');
        this.penSettingsManager.setSize(1);
        this.colorManager.setColor(this.colorManager.mainColor);
        this.canvasManager.saveState();
        this.canvasManager.drawComposite();
        this.bindTestButtons();
    }
    bindTestButtons() {
        const addBtn = document.getElementById('add-layer-btn-test');
        const switchBtn = document.getElementById('switch-layer-btn-test');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                this.layerManager.addLayer();
            });
        }
        if (switchBtn) {
            switchBtn.addEventListener('click', () => {
                if (this.layerManager.layers.length > 1) {
                    const newIndex = (this.layerManager.activeLayerIndex + 1) % this.layerManager.layers.length;
                    this.layerManager.switchLayer(newIndex);
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