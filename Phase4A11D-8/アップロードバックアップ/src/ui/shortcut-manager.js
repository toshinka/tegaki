// src/ui/shortcut-manager.js
export class ShortcutManager {
    constructor(app) {
        this.app = app;
        this.lastWheelTime = 0;
        this.wheelThrottle = 50;
    }

    initialize() {
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));
        // wheelイベントはCanvasManager側で処理するため、ここではコメントアウト
        // document.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
    }

    handleKeyDown(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if (e.repeat) return;

        if (document.activeElement && typeof document.activeElement.blur === 'function') {
            document.activeElement.blur();
        }

        if (e.key === 'Shift') {
            this.app.canvasManager.isShiftDown = true;
            this.app.canvasManager.updateCursor();
        }
        if (e.key === ' ' && !this.app.canvasManager.isSpaceDown) {
            this.app.canvasManager.isSpaceDown = true;
            this.app.canvasManager.updateCursor();
            e.preventDefault();
            return;
        }
        if (e.key.toLowerCase() === 'v' && !this.app.canvasManager.isVDown) {
            this.app.canvasManager.isVDown = true;
            this.app.canvasManager.startLayerTransform();
            this.app.canvasManager.updateCursor();
            e.preventDefault();
            return;
        }
        
        if (this.app.canvasManager.isLayerTransforming) {
            let handled = true;
            const moveAmount = e.shiftKey ? 10 : 2;
            const scaleAmount = 1.05;
            const rotateAmount = 5;

            switch (e.key.toLowerCase()) {
                case 'arrowup': this.app.canvasManager.applyLayerTransform({ translation: [0, -moveAmount, 0] }); break;
                case 'arrowdown': this.app.canvasManager.applyLayerTransform({ translation: [0, moveAmount, 0] }); break;
                case 'arrowleft': this.app.canvasManager.applyLayerTransform({ translation: [-moveAmount, 0, 0] }); break;
                case 'arrowright': this.app.canvasManager.applyLayerTransform({ translation: [moveAmount, 0, 0] }); break;
                case 's': if(e.shiftKey) this.app.canvasManager.applyLayerTransform({ scale: 1 / scaleAmount }); else this.app.canvasManager.applyLayerTransform({ scale: scaleAmount }); break;
                case 'r': if(e.shiftKey) this.app.canvasManager.applyLayerTransform({ rotation: rotateAmount }); else this.app.canvasManager.applyLayerTransform({ rotation: -rotateAmount }); break;
                case 'h': this.app.canvasManager.applyLayerTransform({ flip: 'x' }); break;
                case 'f': this.app.canvasManager.applyLayerTransform({ flip: 'y' }); break;
                case 'escape': this.app.canvasManager.cancelLayerTransform(); this.app.canvasManager.isVDown = false; break;
                default: handled = false;
            }
            if (handled) e.preventDefault();
            return;
        }

        if (this.app.canvasManager.isSpaceDown) {
            return; // パン操作はCanvasManagerのpointermoveで処理
        }

        let handled = false;
        if ((e.ctrlKey || e.metaKey)) {
            switch (e.key.toLowerCase()) {
                case 'z': this.app.canvasManager.undo(); handled = true; break;
                case 'y': this.app.canvasManager.redo(); handled = true; break;
                case '[': this.app.penSettingsManager.changeSize(false); handled = true; break;
                case ']': this.app.penSettingsManager.changeSize(true); handled = true; break;
            }
        } else {
            switch (e.key.toLowerCase()) {
                case 'x': this.app.colorManager.swapColors(); handled = true; break;
                case 'd': this.app.colorManager.resetColors(); handled = true; break;
                case 'p': this.app.toolManager.setTool('pen'); handled = true; break;
                case 'e': this.app.toolManager.setTool('eraser'); handled = true; break;
                case 'g': this.app.toolManager.setTool('bucket'); handled = true; break;
                case 'h': this.app.canvasManager.flipHorizontal(); handled = true; break;
                case 'f': this.app.canvasManager.flipVertical(); handled = true; break;
                case 'home': case '0': this.app.canvasManager.resetView(); handled = true; break;
                case 'delete':
                case 'backspace':
                    const layer = this.app.canvasManager.getCurrentLayer();
                    if (layer) {
                        layer.clear();
                        this.app.canvasManager.renderAllLayers();
                        this.app.canvasManager.saveState();
                    }
                    handled = true;
                    break;
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
            this.app.canvasManager.commitLayerTransform();
            this.app.canvasManager.isVDown = false;
            this.app.canvasManager.updateCursor();
            e.preventDefault();
        }
    }
}