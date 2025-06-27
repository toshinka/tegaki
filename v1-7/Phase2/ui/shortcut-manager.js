// ui/shortcut-manager.js
export class ShortcutManager {
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

        if (e.key === 'Shift') {
            this.app.canvasManager.isShiftDown = true;
            this.app.canvasManager.updateCursor();
        }

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
        if (e.key === 'Shift') {
            this.app.canvasManager.isShiftDown = false;
            this.app.canvasManager.updateCursor();
        }

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
        const t = this.app.canvasManager.viewTransform;
        t.left += dx;
        t.top += dy;
        this.app.canvasManager.applyViewTransform();
    }
}