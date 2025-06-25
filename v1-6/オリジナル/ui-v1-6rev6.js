// ui-v1-6.js

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
        if (e.repeat) return;
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
                this.app.canvasManager.applyLayerTransformPreview(e);
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

class PenSettingsManager {
    constructor(app) {
        this.app = app;
        this.currentSize = 1;
        this.sizes = Array.from(document.querySelectorAll('.size-btn')).map(btn => parseInt(btn.dataset.size));
        this.currentSizeIndex = this.sizes.indexOf(this.currentSize);
        this.bindEvents();
        this.updateSizeButtonVisuals();
        this.app.canvasManager.setCurrentSize(this.currentSize);
    }
    bindEvents() {
        document.querySelectorAll('.size-btn').forEach(btn => {
            btn.addEventListener('click', () => this.setSize(parseInt(btn.dataset.size)));
        });
    }
    setSize(size) {
        this.currentSize = size;
        this.currentSizeIndex = this.sizes.indexOf(this.currentSize);
        document.querySelectorAll('.size-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-size="${size}"]`)?.classList.add('active');
        this.app.canvasManager.setCurrentSize(this.currentSize);
        this.updateSizeButtonVisuals();
    }
    changeSize(increase) {
        let newIndex = this.currentSizeIndex + (increase ? 1 : -1);
        newIndex = Math.max(0, Math.min(newIndex, this.sizes.length - 1));
        this.setSize(this.sizes[newIndex]);
    }
    updateSizeButtonVisuals() {
        document.querySelectorAll('.size-btn').forEach(btn => {
            const size = parseInt(btn.dataset.size);
            const sizeDot = btn.querySelector('.size-dot');
            const sizeNumber = btn.querySelector('.size-number');
            if (sizeDot) {
                const dotSize = Math.min(size, 16);
                sizeDot.style.width = `${dotSize}px`;
                sizeDot.style.height = `${dotSize}px`;
            }
            if (sizeNumber) {
                sizeNumber.textContent = size;
            }
        });
    }
}
class ColorManager {
    constructor(app) {
        this.app = app;
        this.mainColor = '#800000';
        this.subColor = '#f0e0d6';
        this.colors = Array.from(document.querySelectorAll('.color-btn')).map(btn => btn.dataset.color);
        this.currentColorIndex = this.colors.indexOf(this.mainColor);
        this.mainColorDisplay = document.getElementById('main-color-display');
        this.subColorDisplay = document.getElementById('sub-color-display');
        this.bindEvents();
        this.updateColorDisplays();
        document.querySelector(`[data-color="${this.mainColor}"]`)?.classList.add('active');
        this.app.canvasManager.setCurrentColor(this.mainColor);
    }
    bindEvents() {
        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.setColor(e.currentTarget.dataset.color));
        });
        document.querySelector('.color-mode-display').addEventListener('click', () => this.swapColors());
    }
    setColor(color) {
        this.mainColor = color;
        this.currentColorIndex = this.colors.indexOf(this.mainColor);
        document.querySelectorAll('.color-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-color="${color}"]`)?.classList.add('active');
        this.updateColorDisplays();
        this.app.canvasManager.setCurrentColor(this.mainColor);
    }
    updateColorDisplays() {
        this.mainColorDisplay.style.backgroundColor = this.mainColor;
        this.subColorDisplay.style.backgroundColor = this.subColor;
    }
    swapColors() {
        [this.mainColor, this.subColor] = [this.subColor, this.mainColor];
        this.updateColorDisplays();
        this.setColor(this.mainColor);
    }
    resetColors() {
        this.mainColor = '#800000';
        this.subColor = '#f0e0d6';
        this.updateColorDisplays();
        this.setColor(this.mainColor);
    }
    changeColor(increase) {
        let newIndex = this.currentColorIndex + (increase ? 1 : -1);
        newIndex = Math.max(0, Math.min(newIndex, this.colors.length - 1));
        this.setColor(this.colors[newIndex]);
    }
}
class ToolManager {
    constructor(app) {
        this.app = app;
        this.currentTool = 'pen';
        this.bindEvents();
        this.app.canvasManager.setCurrentTool(this.currentTool);
    }
    bindEvents() {
        document.getElementById('pen-tool').addEventListener('click', () => this.setTool('pen'));
        document.getElementById('eraser-tool').addEventListener('click', () => this.setTool('eraser'));
        document.getElementById('bucket-tool').addEventListener('click', () => this.setTool('bucket'));
    }
    setTool(tool) {
        this.currentTool = tool;
        document.querySelectorAll('.tools .tool-btn').forEach(btn => btn.classList.remove('active'));
        const toolButton = document.getElementById(tool + '-tool');
        if(toolButton) toolButton.classList.add('active');
        this.app.canvasManager.setCurrentTool(tool);
        this.app.canvasManager.updateCursor();
    }
    getCurrentTool() {
        return this.currentTool;
    }
}
// --- LayerUIManager は変更なし ---
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
        this.addBtn.addEventListener('click', () => { this.app.layerManager.addLayer(); });
        this.deleteBtn.addEventListener('click', () => { this.app.layerManager.deleteActiveLayer(); });
        this.duplicateBtn.addEventListener('click', () => { this.app.layerManager.duplicateActiveLayer(); });
        this.mergeBtn.addEventListener('click', () => { this.app.layerManager.mergeDownActiveLayer(); });
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


window.addEventListener('DOMContentLoaded', () => {
    if (window.toshinkaTegakiTool && !window.toshinkaUiInitialized) {
        window.toshinkaUiInitialized = true;
        const app = window.toshinkaTegakiTool;

        app.topBarManager = new TopBarManager(app);
        app.shortcutManager = new ShortcutManager(app);
        app.penSettingsManager = new PenSettingsManager(app);
        app.colorManager = new ColorManager(app);
        app.toolManager = new ToolManager(app);
        app.layerUIManager = new LayerUIManager(app);
        
        app.shortcutManager.initialize();
        
        // すべてのマネージャーが初期化された後に、本体の初期化を実行
        app.init();
    }
});