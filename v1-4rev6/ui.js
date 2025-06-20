// ui.js
// v+ドラッグはv押下中のみレイヤー移動モード
// それ以外は全てキャンバス全体transform操作
// Shift+Hで上下反転も対応

class TopBarManager {
    constructor(app) {
        this.app = app;
        this.bindEvents();
        this.lastWheelTime = 0;
        this.wheelThrottle = 50;

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
        document.getElementById('zoom-out-btn').addEventListener('click', () => this.app.canvasManager.zoom(1/1.2));
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
        // ★注意：wheelイベントのリスナーはcore.jsのCanvasManagerで一元管理するため、ここからは削除
    }

    handleKeyUp(e) {
        if (e.key === ' ') {
            this.app.canvasManager.isSpaceDown = false;
            this.app.canvasManager.updateCursor();
            e.preventDefault();
        }
        if (e.key.toLowerCase() === 'v') {
            this.app.canvasManager.isVDown = false;
            this.app.canvasManager.updateCursor();
            e.preventDefault();
        }
    }

    handleKeyDown(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.repeat) return;

        // Spaceキーによるパン
        if (e.key === ' ' && !this.app.canvasManager.isSpaceDown) {
            this.app.canvasManager.isSpaceDown = true;
            this.app.canvasManager.updateCursor();
            e.preventDefault();
            return;
        }
        // vキーによるレイヤー移動モード
        if (e.key.toLowerCase() === 'v' && !this.app.canvasManager.isVDown) {
            this.app.canvasManager.isVDown = true;
            this.app.canvasManager.updateCursor();
            e.preventDefault();
            return;
        }
        // パン中
        if (this.app.canvasManager.isSpaceDown) {
            let handled = true;
            const moveAmount = 10;
            switch (e.key) {
                case 'ArrowUp':    this._movePan(0, -moveAmount); break;
                case 'ArrowDown':  this._movePan(0, moveAmount); break;
                case 'ArrowLeft':  this._movePan(-moveAmount, 0); break;
                case 'ArrowRight': this._movePan(moveAmount, 0); break;
                default: handled = false;
            }
            if (handled) e.preventDefault();
            return;
        }
        
        // ★修正：vモード時の処理を追加
        if (this.app.canvasManager.isVDown) {
            if (e.shiftKey) {
                let handled = true;
                switch (e.key) {
                    case 'ArrowUp': this.app.canvasManager.scaleActiveLayer(1.1); break;
                    case 'ArrowDown': this.app.canvasManager.scaleActiveLayer(1/1.1); break; // 0.9より逆数の方が挙動が良い
                    case 'ArrowLeft': this.app.canvasManager.rotateActiveLayer(-10); break;
                    case 'ArrowRight': this.app.canvasManager.rotateActiveLayer(10); break;
                    default: handled = false;
                }
                if (handled) {
                    e.preventDefault();
                    return;
                }
            }
            // v単体の場合はドラッグ移動に任せるので、キー操作は何もしない
            return;
        }

        let handled = false;
        if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 'z': this.app.canvasManager.undo(); handled = true; break;
                case 'y': this.app.canvasManager.redo(); handled = true; break;
            }
        } else if (e.shiftKey) {
            switch (e.key.toLowerCase()) {
                case '}': case ']': this.app.colorManager.changeColor(true); handled = true; break;
                case '{': case '[': this.app.colorManager.changeColor(false); handled = true; break;
                case 'h': this.app.canvasManager.flipVertical(); handled = true; break; // Shift+Hで上下反転
                case 'arrowup': this.app.canvasManager.zoom(1.20); handled = true; break;
                case 'arrowdown': this.app.canvasManager.zoom(1/1.20); handled = true; break;
                case 'arrowleft': this.app.canvasManager.rotate(-15); handled = true; break;
                case 'arrowright': this.app.canvasManager.rotate(15); handled = true; break;
                default: handled = false;
            }
        } else {
            switch (e.key.toLowerCase()) {
                case '[': this.app.penSettingsManager.changeSize(false); handled = true; break;
                case ']': this.app.penSettingsManager.changeSize(true); handled = true; break;
                case 'x': this.app.colorManager.swapColors(); handled = true; break;
                case 'd': this.app.colorManager.resetColors(); handled = true; break;
                case 'p': this.app.toolManager.setTool('pen'); handled = true; break;
                case 'e': this.app.toolManager.setTool('eraser'); handled = true; break;
                case 'g': this.app.toolManager.setTool('bucket'); handled = true; break;
                case 'h': this.app.canvasManager.flipHorizontal(); handled = true; break;
                case '1': this.app.canvasManager.resetView(); handled = true; break;
                case 'arrowup': this.app.canvasManager.zoom(1.05); handled = true; break;
                case 'arrowdown': this.app.canvasManager.zoom(1/1.05); handled = true; break;
                case 'arrowleft': this.app.canvasManager.rotate(-5); handled = true; break;
                case 'arrowright': this.app.canvasManager.rotate(5); handled = true; break;
                default: handled = false;
            }
        }
        if (handled) e.preventDefault();
    }

    // ★削除：wheelイベントのハンドラはcore.jsに移行したため不要
    
    _movePan(dx, dy) {
        const t = this.app.canvasManager.transform;
        t.left += dx;
        t.top += dy;
        this.app.canvasManager.applyTransform();
    }
}

window.addEventListener('DOMContentLoaded', () => {
    if (window.toshinkaTegakiTool) {
        window.toshinkaTegakiTool.topBarManager = new TopBarManager(window.toshinkaTegakiTool);
        window.toshinkaTegakiTool.shortcutManager = new ShortcutManager(window.toshinkaTegakiTool);
        window.toshinkaTegakiTool.shortcutManager.initialize();

        // テスト用ボタンUI
        const addBtn = document.getElementById('add-layer-btn-test');
        const switchBtn = document.getElementById('switch-layer-btn-test');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                const newLayer = window.toshinkaTegakiTool.layerManager.addLayer();
                if (newLayer) {
                    window.toshinkaTegakiTool.test_currentLayerIndex = window.toshinkaTegakiTool.layerManager.activeLayerIndex;
                }
            });
        }
        if (switchBtn) {
            window.toshinkaTegakiTool.test_currentLayerIndex = 0;
            switchBtn.addEventListener('click', () => {
                if (window.toshinkaTegakiTool.layerManager.layers.length > 1) {
                    window.toshinkaTegakiTool.test_currentLayerIndex = (window.toshinkaTegakiTool.test_currentLayerIndex + 1) % window.toshinkaTegakiTool.layerManager.layers.length;
                    window.toshinkaTegakiTool.layerManager.switchLayer(window.toshinkaTegakiTool.test_currentLayerIndex);
                }
            });
        }
    }
});