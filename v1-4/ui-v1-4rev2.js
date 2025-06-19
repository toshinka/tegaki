// Toshinka Tegaki Tool v1-4 ui-v1-4rev2.js
// UI/イベント/初期化/ショートカット/トップバー/ボタンのみ。main initもここ

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
            clearBtn.addEventListener('click', () => this.app.canvasManager.clearActiveLayer());
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
        document.getElementById('flip-h-btn').addEventListener('click', () => this.app.canvasManager.viewFlipH());
        document.getElementById('flip-v-btn').addEventListener('click', () => this.app.canvasManager.viewFlipV());
        document.getElementById('zoom-in-btn').addEventListener('click', () => this.app.canvasManager.viewScale(1.2));
        document.getElementById('zoom-out-btn').addEventListener('click', () => this.app.canvasManager.viewScale(1 / 1.2));
        document.getElementById('rotate-btn').addEventListener('click', () => this.app.canvasManager.viewRotate(15));
        document.getElementById('rotate-ccw-btn').addEventListener('click', () => this.app.canvasManager.viewRotate(-15));
        document.getElementById('reset-view-btn').addEventListener('click', () => this.app.canvasManager.viewReset());
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
        document.getElementById('composite-canvas').addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
    }
    handleKeyUp(e) {
        // ... Space解除等 必要に応じて
    }
    handleKeyDown(e) {
        // Space+系 (ビュー操作)
        if (e.key === ' ' && !e.repeat) {
            // Space押下時はビュー操作モード (例: pan, zoom, rotate)
            // 必要に応じて
            return;
        }
        // v+系 (レイヤー操作)
        if (this.app.toolManager.getCurrentTool() === 'move') {
            // レイヤーtransform
            switch (e.key) {
                case 'ArrowLeft': this.app.canvasManager.moveActiveLayer(-1, 0); break;
                case 'ArrowRight': this.app.canvasManager.moveActiveLayer(1, 0); break;
                case 'ArrowUp': this.app.canvasManager.moveActiveLayer(0, -1); break;
                case 'ArrowDown': this.app.canvasManager.moveActiveLayer(0, 1); break;
                case 'h': if (e.shiftKey) this.app.canvasManager.flipActiveLayerV(); else this.app.canvasManager.flipActiveLayerH(); break;
                case '[': this.app.penSettingsManager.changeSize(false); break;
                case ']': this.app.penSettingsManager.changeSize(true); break;
                default: return;
            }
            e.preventDefault();
            return;
        }
        // その他ショートカット
        if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 'z': this.app.canvasManager.undo(); break;
                case 'y': this.app.canvasManager.redo(); break;
                default: return;
            }
            e.preventDefault();
            return;
        }
        switch (e.key) {
            case 'p': this.app.toolManager.setTool('pen'); break;
            case 'e': this.app.toolManager.setTool('eraser'); break;
            case 'v': this.app.toolManager.setTool('move'); break;
            case 'g': this.app.toolManager.setTool('bucket'); break;
            case 'x': this.app.colorManager.swapColors(); break;
            case 'd': this.app.colorManager.resetColors(); break;
            case '1': this.app.canvasManager.viewReset(); break;
            case 'ArrowLeft': this.app.canvasManager.viewRotate(-5); break;
            case 'ArrowRight': this.app.canvasManager.viewRotate(5); break;
            case 'ArrowUp': this.app.canvasManager.viewScale(1.05); break;
            case 'ArrowDown': this.app.canvasManager.viewScale(1 / 1.05); break;
            default: return;
        }
        e.preventDefault();
    }
    handleWheel(e) {
        // Space+ホイール: ビューズーム
        if (e.shiftKey) {
            const delta = e.deltaY > 0 ? 1 / 1.1 : 1.1;
            this.app.canvasManager.viewScale(delta);
            e.preventDefault();
        }
        // v+ホイール: レイヤー変形(例)
        if (this.app.toolManager.getCurrentTool() === 'move' && !e.shiftKey) {
            const delta = e.deltaY > 0 ? 1 / 1.05 : 1.05;
            this.app.canvasManager.scaleActiveLayer(delta);
            e.preventDefault();
        }
    }
}

class ToshinkaTegakiTool {
    constructor() {
        this.canvasManager = new CanvasManager(this);
        this.toolManager = new ToolManager(this);
        this.penSettingsManager = new PenSettingsManager(this);
        this.colorManager = new ColorManager(this);
        this.topBarManager = new TopBarManager(this);
        this.shortcutManager = new ShortcutManager(this);

        this.initUIEvents();
        this.shortcutManager.initialize();
    }

    initUIEvents() {
        // パレット
        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.colorManager.setColor(btn.dataset.color);
            });
        });
        document.querySelector('.color-mode-display').addEventListener('click', () => {
            this.colorManager.swapColors();
        });

        // ツール
        document.getElementById('pen-tool').addEventListener('click', () => this.toolManager.setTool('pen'));
        document.getElementById('eraser-tool').addEventListener('click', () => this.toolManager.setTool('eraser'));
        document.getElementById('move-tool').addEventListener('click', () => this.toolManager.setTool('move'));
        document.getElementById('bucket-tool').addEventListener('click', () => this.toolManager.setTool('bucket'));

        // ペンサイズ
        document.querySelectorAll('.size-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.penSettingsManager.setSize(parseInt(btn.dataset.size));
            });
        });

        // 合成canvas pointer
        const composite = document.getElementById('composite-canvas');
        composite.addEventListener('pointerdown', (e) => {
            if (this.toolManager.getCurrentTool() === 'pen' || this.toolManager.getCurrentTool() === 'eraser') {
                this.canvasManager.pointerDown(e);
            }
        });
        composite.addEventListener('pointermove', (e) => {
            if (this.toolManager.getCurrentTool() === 'pen' || this.toolManager.getCurrentTool() === 'eraser') {
                this.canvasManager.pointerMove(e);
            }
        });
        composite.addEventListener('pointerup', (e) => {
            if (this.toolManager.getCurrentTool() === 'pen' || this.toolManager.getCurrentTool() === 'eraser') {
                this.canvasManager.pointerUp(e);
            }
        });

        // テスト用レイヤー制御
        const addBtn = document.getElementById('add-layer-btn-test');
        const switchBtn = document.getElementById('switch-layer-btn-test');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                this.canvasManager.addNewLayer();
                this.updateLayerInfo();
            });
        }
        if (switchBtn) {
            switchBtn.addEventListener('click', () => {
                const n = this.canvasManager.getLayerCount();
                const now = this.canvasManager.activeLayerIndex;
                this.canvasManager.switchLayer((now + 1) % n);
                this.updateLayerInfo();
            });
        }
        this.updateLayerInfo();
    }

    updateLayerInfo() {
        const infoEl = document.getElementById('current-layer-info');
        if (infoEl) {
            infoEl.textContent = `L: ${this.canvasManager.activeLayerIndex + 1}/${this.canvasManager.getLayerCount()}`;
        }
    }
}

window.addEventListener('DOMContentLoaded', () => {
    if (!window.toshinkaTegakiInitialized) {
        window.toshinkaTegakiInitialized = true;
        window.toshinkaTegakiTool = new ToshinkaTegakiTool();
    }
});