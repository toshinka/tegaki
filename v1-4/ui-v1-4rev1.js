// ui.js rev1
// レイヤーUIの制御とイベントハンドリングを追加

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
                if (confirm('すべてのレイヤーの内容を消去しますか？\n（背景は白で塗りつぶされます）')) {
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
        this.lastWheelTime = 0; // ★ canvasManagerから移動
        this.wheelThrottle = 50;  // ★ canvasManagerから移動
    }
    initialize() {
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));
    }

    handleKeyUp(e) {
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
        if (e.key.toLowerCase() === 'v' && !this.app.canvasManager.isVDown) {
            this.app.canvasManager.isVDown = true;
            this.app.canvasManager.updateCursor();
            e.preventDefault();
            return;
        }
        if (this.app.canvasManager.isSpaceDown) {
            return; // パン操作中は他のショートカットを無効
        }
        if (this.app.canvasManager.isVDown) {
            return; // Vキー押下中（変形モード）は他のショートカットを無効
        }

        let handled = false;
        if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 'z': this.app.canvasManager.undo(); handled = true; break;
                case 'y': this.app.canvasManager.redo(); handled = true; break;
            }
        } else if (e.shiftKey) {
            switch (e.key.toLowerCase()) {
                case '}': case ']': this.app.penSettingsManager.changeSize(true); handled = true; break;
                case '{': case '[': this.app.penSettingsManager.changeSize(false); handled = true; break;
                case '+': this.app.colorManager.changeColor(true); handled = true; break; // 色変更のキーを調整
                case '-': this.app.colorManager.changeColor(false); handled = true; break;
                case 'h': this.app.canvasManager.flipVertical(); handled = true; break;
                case 'arrowup': this.app.canvasManager.zoom(1.20); handled = true; break;
                case 'arrowdown': this.app.canvasManager.zoom(1/1.20); handled = true; break;
                case 'arrowleft': this.app.canvasManager.rotate(-15); handled = true; break;
                case 'arrowright': this.app.canvasManager.rotate(15); handled = true; break;
                case 'delete':
                    if (confirm('すべてのレイヤーの内容を消去しますか？')) {
                        this.app.canvasManager.clearAllLayers();
                    }
                    handled = true;
                    break;
            }
        } else {
            switch (e.key.toLowerCase()) {
                case ']': this.app.penSettingsManager.changeSize(true); handled = true; break;
                case '[': this.app.penSettingsManager.changeSize(false); handled = true; break;
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
                case 'delete':
                case 'backspace':
                    this.app.canvasManager.clearCanvas();
                    handled = true;
                    break;
            }
        }
        if (handled) e.preventDefault();
    }
}

// ★★★ 機能追加: レイヤーUI管理 ★★★
class LayerUIManager {
    constructor(app) {
        this.app = app;
        this.layerManager = app.layerManager;
        this.container = document.getElementById('layer-list-container');
        this.addBtn = document.getElementById('add-layer-btn');
        this.contextMenu = document.getElementById('layer-context-menu');
        this.deleteBtn = document.getElementById('delete-layer-btn');

        this.bindEvents();
    }
    
    bindEvents() {
        this.addBtn.addEventListener('click', () => {
            this.layerManager.addLayer();
        });
        
        // コンテキストメニューの外側をクリックしたら閉じる
        document.addEventListener('click', (e) => {
            if (!this.contextMenu.contains(e.target)) {
                this.hideContextMenu();
            }
        });
    }

    updateList() {
        this.container.innerHTML = ''; // リストをクリア
        
        // レイヤーを逆順（上が手前）に表示
        [...this.layerManager.layers].reverse().forEach((layer, i) => {
            const originalIndex = this.layerManager.layers.length - 1 - i;
            
            const item = document.createElement('div');
            item.className = 'layer-item';
            item.textContent = `レイヤー ${originalIndex}`;
            
            if (originalIndex === this.layerManager.activeLayerIndex) {
                item.classList.add('active');
            }
            
            // イベントリスナーを設定
            item.addEventListener('click', () => {
                this.layerManager.switchLayer(originalIndex);
            });
            
            item.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.showContextMenu(e, originalIndex);
            });
            
            this.container.appendChild(item);
        });
        
        const infoEl = document.getElementById('current-layer-info');
        if (infoEl) {
             infoEl.textContent = `L: ${this.layerManager.activeLayerIndex + 1}/${this.layerManager.layers.length}`;
        }
    }
    
    showContextMenu(event, index) {
        this.contextMenu.style.display = 'block';
        this.contextMenu.style.top = `${event.clientY}px`;
        this.contextMenu.style.left = `${event.clientX}px`;
        
        const canDelete = index > 0 && this.layerManager.layers.length > 1;
        this.deleteBtn.disabled = !canDelete;
        
        // 既存のリスナーを削除してから追加（重複防止）
        this.deleteBtn.replaceWith(this.deleteBtn.cloneNode(true));
        this.deleteBtn = document.getElementById('delete-layer-btn'); // 再取得
        
        if (canDelete) {
            this.deleteBtn.onclick = () => {
                if(confirm(`「レイヤー ${index}」を削除しますか？\nこの操作は元に戻せません。`)){
                    this.layerManager.deleteLayer(index);
                }
                this.hideContextMenu();
            };
        }
    }
    
    hideContextMenu() {
        this.contextMenu.style.display = 'none';
    }
}


window.addEventListener('DOMContentLoaded', () => {
    if (window.toshinkaTegakiTool) {
        const app = window.toshinkaTegakiTool;
        
        // マネージャーの初期化
        app.topBarManager = new TopBarManager(app);
        app.shortcutManager = new ShortcutManager(app);
        app.shortcutManager.initialize();
        app.layerUIManager = new LayerUIManager(app);
        
        // レイヤーUI更新のコールバックを設定
        app.onLayerUpdate = () => {
            app.layerUIManager.updateList();
        };

        // アプリケーションの初期化
        app.layerManager.setupInitialLayers();
        app.canvasManager.saveState(); // 初期状態を保存
    }
});