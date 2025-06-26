// ui-v1-8.js (Layer Transform & Flip Shortcuts Fixed & Added)

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
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
            return;
        }

        if (e.key === 'Shift') this.app.canvasManager.isShiftDown = true;
        if (e.key === ' ') { if (!this.app.canvasManager.isSpaceDown) { this.app.canvasManager.isSpaceDown = true; this.app.canvasManager.updateCursor(); } e.preventDefault(); return; }
        if (e.key.toLowerCase() === 'v') { if (!this.app.canvasManager.isVDown) { this.app.canvasManager.isVDown = true; this.app.canvasManager.updateCursor(); const cross = document.getElementById('center-crosshair'); if (cross) cross.style.display = 'block'; } }
        
        if (e.repeat) return;
        
        // Vキーが押されている時のレイヤー変形ショートカット
        if (this.app.canvasManager.isVDown) {
            let handled = true;
            let transformDelta = { x: 0, y: 0, scale: 1, rotation: 0 };
            
            const moveStep = 1;
            const scaleStep = 1.05;
            const rotStep = 5;

            // Shift + 方向キーでの回転・拡縮
            if (this.app.canvasManager.isShiftDown) {
                 switch (e.key.toLowerCase()) {
                    case 'arrowup': transformDelta.scale = 1 / scaleStep; break;
                    case 'arrowdown': transformDelta.scale = scaleStep; break;
                    case 'arrowleft': transformDelta.rotation = -rotStep; break;
                    case 'arrowright': transformDelta.rotation = rotStep; break;
                    // Hキーでの上下反転
                    case 'h': this.app.canvasManager.applyAndBakeFlip(false); break; 
                    default: handled = false;
                }
            } 
            // Shiftなしの時の移動・反転
            else {
                 switch (e.key.toLowerCase()) {
                    case 'arrowup': transformDelta.y = -moveStep; break;
                    case 'arrowdown': transformDelta.y = moveStep; break;
                    case 'arrowleft': transformDelta.x = -moveStep; break;
                    case 'arrowright': transformDelta.x = moveStep; break;
                    // Hキーでの左右反転
                    case 'h': this.app.canvasManager.applyAndBakeFlip(true); break; 
                    default: handled = false;
                }
            }

            if (handled) {
                e.preventDefault();
                // 移動・回転・拡縮の場合のみ適用
                if (transformDelta.x !== 0 || transformDelta.y !== 0 || transformDelta.scale !== 1 || transformDelta.rotation !== 0) {
                     this.app.canvasManager.applyAndBakeTransform(transformDelta);
                }
            }
            return; // Vキー押下時は他のショートカットを無効化
        }


        // --- Other Shortcuts ---
        let handled = false;
        if ((e.ctrlKey || e.metaKey)) {
             switch (e.key.toLowerCase()) {
                case 'z': (e.shiftKey ? this.app.canvasManager.redo() : this.app.canvasManager.undo()); handled = true; break;
                case 'y': this.app.canvasManager.redo(); handled = true; break;
                case 's': e.preventDefault(); this.app.canvasManager.exportMergedImage(); handled = true; break;
            }
        } else {
             switch (e.key.toLowerCase()) {
                case 'p': this.app.toolManager.setTool('pen'); handled = true; break;
                case 'e': this.app.toolManager.setTool('eraser'); handled = true; break;
                case 'g': this.app.toolManager.setTool('bucket'); handled = true; break;
                case 'h': this.app.canvasManager.flipHorizontal(); handled = true; break;
                // 他のショートカット
            }
        }
        if (handled) e.preventDefault();
    }

    handleKeyUp(e) {
        if (e.key === 'Shift') this.app.canvasManager.isShiftDown = false;
        if (e.key === ' ') { this.app.canvasManager.isSpaceDown = false; this.app.canvasManager.updateCursor(); e.preventDefault(); }
        if (e.key.toLowerCase() === 'v') { this.app.canvasManager.isVDown = false; this.app.canvasManager.updateCursor(); const cross = document.getElementById('center-crosshair'); if (cross) cross.style.display = 'none'; e.preventDefault(); }
    }
}


class LayerUIManager {
    constructor(app) { this.app = app; this.layerListContainer = document.getElementById('layer-list'); this.bindEvents(); }
    bindEvents() {
        document.getElementById('add-layer-btn').addEventListener('click', () => this.app.layerManager.addLayer());
        document.getElementById('delete-layer-btn').addEventListener('click', () => this.app.layerManager.deleteActiveLayer());
        document.getElementById('duplicate-layer-btn').addEventListener('click', () => this.app.layerManager.duplicateActiveLayer());
        document.getElementById('merge-layer-btn').addEventListener('click', () => this.app.layerManager.mergeDownActiveLayer());
        this.layerListContainer.addEventListener('click', (e) => { const layerItem = e.target.closest('.layer-item'); if (layerItem?.dataset.index) { const index = parseInt(layerItem.dataset.index, 10); if (index !== this.app.layerManager.activeLayerIndex) { this.app.layerManager.switchLayer(index); } } });
    }
    renderLayers() { if (!this.layerListContainer) return; this.layerListContainer.innerHTML = ''; const layers = this.app.layerManager.layers; const activeLayerIndex = this.app.layerManager.activeLayerIndex; for (let i = layers.length - 1; i >= 0; i--) { const layer = layers[i]; const item = document.createElement('div'); item.className = 'layer-item'; item.dataset.index = i; const nameSpan = document.createElement('span'); nameSpan.className = 'layer-name'; nameSpan.textContent = layer.name; item.appendChild(nameSpan); if (i === activeLayerIndex) item.classList.add('active'); this.layerListContainer.appendChild(item); } }
}

window.addEventListener('DOMContentLoaded', () => {
    if (window.toshinkaTegakiTool) {
        window.toshinkaTegakiTool.topBarManager = new TopBarManager(window.toshinkaTegakiTool);
        window.toshinkaTegakiTool.shortcutManager = new ShortcutManager(window.toshinkaTegakiTool);
        window.toshinkaTegakiTool.shortcutManager.initialize();
        if (!window.toshinkaTegakiTool.layerUIManager) {
            window.toshinkaTegakiTool.layerUIManager = new LayerUIManager(window.toshinkaTegakiTool);
        }
        window.toshinkaTegakiTool.layerUIManager.renderLayers();
    }
});
