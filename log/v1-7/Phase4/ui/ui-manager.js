// ui/ui-manager.js

export class TopBarManager {
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

export class LayerUIManager {
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
            nameSpan.textContent = layer.name;
            item.appendChild(nameSpan);

            if (i === activeLayerIndex) {
                item.classList.add('active');
            }
            this.layerListContainer.appendChild(item);
        }
    }
}