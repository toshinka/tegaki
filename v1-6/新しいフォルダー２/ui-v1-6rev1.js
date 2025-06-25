// ui-v1-6rev0.js (ImageData-based compatible)

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
            clearAllBtn.title = '全レイヤーを消去 (Ctrl+Shift+Delete)';
            clearBtn.parentNode.insertBefore(clearAllBtn, clearBtn.nextSibling);
            clearAllBtn.addEventListener('click', () => {
                if (confirm('すべてのレイヤーを消去しますか？\nこの操作は元に戻せません。')) {
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
    }

    initialize() {
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));
    }

    handleKeyDown(e) {
        if (document.activeElement && typeof document.activeElement.blur === 'function') {
            document.activeElement.blur();
        }

        if (e.key === 'Shift') this.app.canvasManager.isShiftDown = true;
        
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
            const cross = document.getElementById('center-crosshair');
            if (cross) cross.style.display = 'block';
            e.preventDefault();
            return;
        }

        let handled = false;

        if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
            switch (e.key.toLowerCase()) {
                case 'delete':
                    if (confirm('すべてのレイヤーを消去しますか？\nこの操作は元に戻せません。')) {
                        this.app.canvasManager.clearAllLayers();
                        handled = true;
                    }
                    break;
                 case 'z': this.app.canvasManager.redo(); handled = true; break; // Shift+Ctrl+Z for redo
            }
        }
        else if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 'z': this.app.canvasManager.undo(); handled = true; break;
                case 'y': this.app.canvasManager.redo(); handled = true; break;
                case '[': this.app.colorManager.changeColor(false); handled = true; break;
                case ']': this.app.colorManager.changeColor(true); handled = true; break;
                case 's': e.preventDefault(); this.app.canvasManager.exportMergedImage(); handled = true; break;
            }
        }
        else if (e.shiftKey) {
            switch (e.key.toLowerCase()) {
                case ']': this.app.layerManager.switchLayer(this.app.layerManager.activeLayerIndex - 1); handled = true; break;
                case '[': this.app.layerManager.switchLayer(this.app.layerManager.activeLayerIndex + 1); handled = true; break;
                case 'h': this.app.canvasManager.flipVertical(); handled = true; break;
                case 'n': this.app.layerManager.addLayer(); handled = true; break;
                case 'd': this.app.layerManager.deleteActiveLayer(); handled = true; break;
                case 'c': this.app.layerManager.duplicateActiveLayer(); handled = true; break;
                case 'b': this.app.layerManager.mergeDownActiveLayer(); handled = true; break;
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
        if (e.key === 'Shift') this.app.canvasManager.isShiftDown = false;

        if (e.key === ' ') {
            this.app.canvasManager.isSpaceDown = false;
            this.app.canvasManager.updateCursor();
            e.preventDefault();
        }
        if (e.key.toLowerCase() === 'v') {
            this.app.canvasManager.isVDown = false;
            this.app.canvasManager.updateCursor();
            const cross = document.getElementById('center-crosshair');
            if (cross) cross.style.display = 'none';
            e.preventDefault();
        }
    }
}

class LayerUIManager {
    constructor(app) {
        this.app = app;
        this.layerListContainer = document.getElementById('layer-list');
        this.addBtn = document.getElementById('add-layer-btn');
        this.deleteBtn = document.getElementById('delete-layer-btn');
        this.duplicateBtn = document.getElementById('duplicate-layer-btn');
        this.mergeBtn = document.getElementById('merge-layer-btn');
        this.bindEvents();
    }

    bindEvents() {
        this.addBtn.addEventListener('click', () => this.app.layerManager.addLayer());
        this.deleteBtn.addEventListener('click', () => this.app.layerManager.deleteActiveLayer());
        this.duplicateBtn.addEventListener('click', () => this.app.layerManager.duplicateActiveLayer());
        this.mergeBtn.addEventListener('click', () => this.app.layerManager.mergeDownActiveLayer());
        
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
        this.layerListContainer.innerHTML = '';
        const layers = this.app.layerManager.layers;
        const activeLayerIndex = this.app.layerManager.activeLayerIndex;

        for (let i = layers.length - 1; i >= 0; i--) {
            const layer = layers[i];
            const item = document.createElement('div');
            item.className = 'layer-item';
            item.dataset.index = i;
            
            const nameSpan = document.createElement('span');
            nameSpan.className = 'layer-name';
            nameSpan.textContent = layer.name; // Use layer.name directly
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
        window.toshinkaTegakiTool.topBarManager = new TopBarManager(window.toshinkaTegakiTool);
        window.toshinkaTegakiTool.shortcutManager = new ShortcutManager(window.toshinkaTegakiTool);
        window.toshinkaTegakiTool.shortcutManager.initialize();
        window.toshinkaTegakiTool.layerUIManager = new LayerUIManager(window.toshinkaTegakiTool);
        
        // Initial render after all managers are set up
        window.toshinkaTegakiTool.layerUIManager.renderLayers();
    }
});