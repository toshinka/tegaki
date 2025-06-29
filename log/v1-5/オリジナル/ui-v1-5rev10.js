// ui-v1-5rev10.js

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
            clearAllBtn.title = '全レイヤーを消去 (Ctrl+Shift+Delete)'; // ツールチップを更新
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
        if (confirm('あうぅ…閉じるけど平気…？')) {
            window.close();
        }
    }
}

class ShortcutManager {
    constructor(app) {
        this.app = app;
        this.lastWheelTime = 0;
        this.wheelThrottle = 50;
    }

    initialize() {
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));
        document.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
    }

    handleKeyDown(e) {
        if (document.activeElement && typeof document.activeElement.blur === 'function') {
            document.activeElement.blur();
        }

        // ▼▼▼ 修正 ▼▼▼
        // Shiftキーの状態を更新
        if (e.key === 'Shift') {
            this.app.canvasManager.isShiftDown = true;
            this.app.canvasManager.updateCursor();
        }
        // ▲▲▲ 修正 ▲▲▲

        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.repeat) return;

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
            e.preventDefault();
        }

        if (e.key === ' ' && !this.app.canvasManager.isSpaceDown) {
            this.app.canvasManager.isSpaceDown = true;
            this.app.canvasManager.updateCursor();
            e.preventDefault();
            return;
        }

        if (e.key.toLowerCase() === 'v' && !this.app.canvasManager.isVDown) {
            this.app.canvasManager.isVDown = true;
            this.app.canvasManager.updateCursor();
            const cross = document.getElementById('center-crosshair');
            if (cross) cross.style.display = 'block';
            e.preventDefault();
            return;
        }

        if (this.app.canvasManager.isSpaceDown) {
            let handled = true;
            const moveAmount = 10;
            switch (e.key) {
                case 'ArrowUp': this._movePan(0, -moveAmount); break;
                case 'ArrowDown': this._movePan(0, moveAmount); break;
                case 'ArrowLeft': this._movePan(-moveAmount, 0); break;
                case 'ArrowRight': this._movePan(moveAmount, 0); break;
                default: handled = false;
            }
            if (handled) e.preventDefault();
            return;
        }

        if (this.app.canvasManager.isVDown) {
            let handled = true;
            const moveAmount = 5;
            const scaleAmount = 1.05;
            const rotateAmount = 5;

            const startTransformIfNeeded = () => {
                if (!this.app.canvasManager.isLayerTransforming) {
                    this.app.canvasManager.startLayerTransform();
                }
            };

            if (e.shiftKey) {
                switch (e.key.toLowerCase()) {
                    case 'arrowup':
                        startTransformIfNeeded();
                        this.app.canvasManager.layerTransform.scale *= scaleAmount;
                        break;
                    case 'arrowdown':
                        startTransformIfNeeded();
                        this.app.canvasManager.layerTransform.scale /= scaleAmount;
                        break;
                    case 'arrowleft':
                        startTransformIfNeeded();
                        this.app.canvasManager.layerTransform.rotation -= (rotateAmount * Math.PI / 180);
                        break;
                    case 'arrowright':
                        startTransformIfNeeded();
                        this.app.canvasManager.layerTransform.rotation += (rotateAmount * Math.PI / 180);
                        break;
                    case 'h':
                        startTransformIfNeeded();
                        this.app.canvasManager.layerTransform.flipY *= -1;
                        break;
                    default:
                        handled = false;
                }
            } else {
                switch (e.key.toLowerCase()) {
                    case 'arrowup':
                        startTransformIfNeeded();
                        this.app.canvasManager.layerTransform.translateY -= moveAmount;
                        break;
                    case 'arrowdown':
                        startTransformIfNeeded();
                        this.app.canvasManager.layerTransform.translateY += moveAmount;
                        break;
                    case 'arrowleft':
                        startTransformIfNeeded();
                        this.app.canvasManager.layerTransform.translateX -= moveAmount;
                        break;
                    case 'arrowright':
                        startTransformIfNeeded();
                        this.app.canvasManager.layerTransform.translateX += moveAmount;
                        break;
                    case 'h':
                        startTransformIfNeeded();
                        this.app.canvasManager.layerTransform.flipX *= -1;
                        break;
                    default:
                        handled = false;
                }
            }

            if (handled) {
                this.app.canvasManager.applyLayerTransformPreview();
                e.preventDefault();
            }
            return;
        }

        let handled = false;

        if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
            switch (e.key.toLowerCase()) {
                case 'delete':
                    if (confirm('すべてのレイヤーを消去しますか？\nこの操作は元に戻すのが難しい場合があります。')) {
                        this.app.canvasManager.clearAllLayers();
                        handled = true;
                    }
                    break;
            }
        }
        else if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 'z': this.app.canvasManager.undo(); handled = true; break;
                case 'y': this.app.canvasManager.redo(); handled = true; break;
                case '[': this.app.colorManager.changeColor(false); handled = true; break;
                case ']': this.app.colorManager.changeColor(true); handled = true; break;
            }
        }
        else if (e.shiftKey) {
            switch (e.key.toLowerCase()) {
                case '}': case ']': this.app.layerManager.switchLayer(this.app.layerManager.activeLayerIndex - 1); handled = true; break;
                case '{': case '[': this.app.layerManager.switchLayer(this.app.layerManager.activeLayerIndex + 1); handled = true; break;
                case 'h': this.app.canvasManager.flipVertical(); handled = true; break;
                case 'arrowup': this.app.canvasManager.zoom(1.2); handled = true; break;
                case 'arrowdown': this.app.canvasManager.zoom(1 / 1.2); handled = true; break;
                case 'arrowleft': this.app.canvasManager.rotate(-45); handled = true; break;
                case 'arrowright': this.app.canvasManager.rotate(45); handled = true; break;
                // ▼▼▼ ショートカット変更 ▼▼▼
                case 'n': this.app.layerManager.addLayer(); handled = true; break;
                case 'd': this.app.layerManager.deleteActiveLayer(); handled = true; break;
                case 'c': this.app.layerManager.duplicateActiveLayer(); handled = true; break;
                case 'b': this.app.layerManager.mergeDownActiveLayer(); handled = true; break;
                // ▲▲▲ ショートカット変更 ▲▲▲
            }
        }
        else {
            switch (e.key.toLowerCase()) {
                case '[': this.app.penSettingsManager.changeSize(false); handled = true; break;
                case ']': this.app.penSettingsManager.changeSize(true); handled = true; break;
                case 'x': this.app.colorManager.swapColors(); handled = true; break;
                case 'd': this.app.colorManager.resetColors(); handled = true; break;
                case 'p': this.app.toolManager.setTool('pen'); handled = true; break;
                case 'e': this.app.toolManager.setTool('eraser'); handled = true; break;
                case 'g': this.app.toolManager.setTool('bucket'); handled = true; break;
                case 'h': this.app.canvasManager.flipHorizontal(); handled = true; break;
                case 'home': this.app.canvasManager.resetView(); handled = true; break;
                case 'arrowup': this.app.canvasManager.zoom(1.05); handled = true; break;
                case 'arrowdown': this.app.canvasManager.zoom(1 / 1.05); handled = true; break;
                case 'arrowleft': this.app.canvasManager.rotate(-5); handled = true; break;
                case 'arrowright': this.app.canvasManager.rotate(5); handled = true; break;
                case 'delete': this.app.canvasManager.clearCanvas(); handled = true; break;
            }
        }

        if (handled) e.preventDefault();
    }

    handleKeyUp(e) {
        // ▼▼▼ 修正 ▼▼▼
        if (e.key === 'Shift') {
            this.app.canvasManager.isShiftDown = false;
            this.app.canvasManager.updateCursor();
        }
        // ▲▲▲ 修正 ▲▲▲

        if (e.key === ' ') {
            this.app.canvasManager.isSpaceDown = false;
            this.app.canvasManager.updateCursor();
            e.preventDefault();
        }
        if (e.key.toLowerCase() === 'v') {
            this.app.canvasManager.isVDown = false;
            if (this.app.canvasManager.isLayerTransforming) {
                this.app.canvasManager.commitLayerTransform();
            }
            this.app.canvasManager.updateCursor();
            const cross = document.getElementById('center-crosshair');
            if (cross) cross.style.display = 'none';
            e.preventDefault();
        }
    }

    handleWheel(e) {
        const now = Date.now();
        if (now - this.lastWheelTime < this.wheelThrottle) {
            return;
        }
        this.lastWheelTime = now;
        this.app.canvasManager.handleWheel(e);
    }

    _movePan(dx, dy) {
        const t = this.app.canvasManager.transform;
        t.left += dx;
        t.top += dy;
        this.app.canvasManager.applyTransform();
    }
}

// --- LayerUIManager は変更なし ---
// (コードの長さの都合上、変更のないクラスは省略します。お手元のファイルではそのままにしてください)
// ...
class LayerUIManager {
    constructor(app) {
        this.app = app;
        this.layerListContainer = document.getElementById('layer-list');
        this.addBtn = document.getElementById('add-layer-btn');
        this.deleteBtn = document.getElementById('delete-layer-btn');
        this.duplicateBtn = document.getElementById('duplicate-layer-btn'); // 追加
        this.mergeBtn = document.getElementById('merge-layer-btn');     // 追加
        this.bindEvents();
    }

    bindEvents() {
        this.addBtn.addEventListener('click', () => {
            this.app.layerManager.addLayer();
        });

        this.deleteBtn.addEventListener('click', () => {
            // ボタンからの削除もLayerManagerのメソッド経由で統一
            this.app.layerManager.deleteActiveLayer(); 
        });

        this.duplicateBtn.addEventListener('click', () => { // 追加
            this.app.layerManager.duplicateActiveLayer();
        });

        this.mergeBtn.addEventListener('click', () => { // 追加
            this.app.layerManager.mergeDownActiveLayer();
        });
        
        // イベント委任を使って、レイヤーリスト全体のクリックを監視
        this.layerListContainer.addEventListener('click', (e) => {
            const layerItem = e.target.closest('.layer-item');
            if (layerItem && layerItem.dataset.index) {
                const index = parseInt(layerItem.dataset.index, 10);
                if (index !== this.app.layerManager.activeLayerIndex) {
                    this.app.layerManager.switchLayer(index);
                }
            }
        });
    }

    renderLayers() {
        if (!this.layerListContainer) return;
        this.layerListContainer.innerHTML = ''; // リストを一旦空にする
        const layers = this.app.layerManager.layers;
        const activeLayerIndex = this.app.layerManager.activeLayerIndex;

        // レイヤーを逆順に表示（上にあるレイヤーほどリストの上に来るように）
        for (let i = layers.length - 1; i >= 0; i--) {
            const layer = layers[i];
            const item = document.createElement('div');
            item.className = 'layer-item';
            item.dataset.index = i; // インデックスは元の配列のものを保持
            
            const nameSpan = document.createElement('span');
            nameSpan.className = 'layer-name';
            nameSpan.textContent = layer.name;
            item.appendChild(nameSpan);

            if (i === activeLayerIndex) {
                item.classList.add('active');
            }
            this.layerListContainer.appendChild(item);
        }
    }
}


window.addEventListener('DOMContentLoaded', () => {
    if (window.toshinkaTegakiTool) {
        // 既存のマネージャーを初期化
        window.toshinkaTegakiTool.topBarManager = new TopBarManager(window.toshinkaTegakiTool);
        window.toshinkaTegakiTool.shortcutManager = new ShortcutManager(window.toshinkaTegakiTool);
        window.toshinkaTegakiTool.shortcutManager.initialize();

        // ★新しい LayerUIManager を初期化して、メインオブジェクトに登録
        window.toshinkaTegakiTool.layerUIManager = new LayerUIManager(window.toshinkaTegakiTool);
        
        // Coreの初期化処理から自動で呼ばれるため、ここでの呼び出しは不要
        window.toshinkaTegakiTool.layerUIManager.renderLayers();
        window.toshinkaTegakiTool.layerManager.switchLayer(window.toshinkaTegakiTool.layerManager.activeLayerIndex); 
        // ★テスト用のボタンに関する記述はすべて削除
        const testControls = document.getElementById('test-controls');
        if (testControls) {
            testControls.parentNode.removeChild(testControls);
        }
    }
});