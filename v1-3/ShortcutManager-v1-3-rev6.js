// ShortcutManager-v1-3-rev6.js
// 内部ロジックはrev5から変更なし。新しい描画方式でも問題なく動作します。
// ファイル名のみrev6に更新。
class ShortcutManager {
    constructor(app) {
        this.app = app;
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
    }

    handleKeyDown(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.repeat) return;
        
        if (e.key === ' ' && !this.app.canvasManager.isSpaceDown) {
            this.app.canvasManager.isSpaceDown = true;
            this.app.canvasManager.updateCursor();
            e.preventDefault();
            return; // Space押下時は他のキー操作を無効化
        }
        if (this.app.canvasManager.isSpaceDown) {
            // Spaceキーを押しながらのパン操作はCanvasManagerのpointermoveで処理されるため、ここでは何もしない
            return;
        }

        let handled = false;

        if (this.app.toolManager.getCurrentTool() === 'move') {
            handled = this.handleLayerTransformKeys(e);
        }
        
        if (!handled) {
            handled = this.handleGlobalKeys(e);
        }
        
        if (handled) {
            e.preventDefault();
        }
    }
    
    handleLayerTransformKeys(e) {
        let handled = true;
        const moveAmount = 1;
        const rotateAmount = 1;
        const scaleFactor = 1.02;

        if (e.shiftKey) {
            switch (e.key.toLowerCase()) {
                case 'h': this.app.layerManager.flipActiveLayerVertical(); break;
                case 'arrowup': this.app.layerManager.scaleActiveLayer(scaleFactor); break;
                case 'arrowdown': this.app.layerManager.scaleActiveLayer(1 / scaleFactor); break;
                case 'arrowleft': this.app.layerManager.rotateActiveLayer(-rotateAmount); break;
                case 'arrowright': this.app.layerManager.rotateActiveLayer(rotateAmount); break;
                default: handled = false;
            }
        } else {
             switch (e.key.toLowerCase()) {
                case 'h': this.app.layerManager.flipActiveLayerHorizontal(); break;
                case 'arrowup': this.app.layerManager.moveActiveLayer(0, -moveAmount); break;
                case 'arrowdown': this.app.layerManager.moveActiveLayer(0, moveAmount); break;
                case 'arrowleft': this.app.layerManager.moveActiveLayer(-moveAmount, 0); break;
                case 'arrowright': this.app.layerManager.moveActiveLayer(moveAmount, 0); break;
                default: handled = false;
            }
        }
        return handled;
    }

    handleGlobalKeys(e) {
        let handled = true;
        if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 'z': this.app.canvasManager.undo(); break;
                case 'y': this.app.canvasManager.redo(); break;
                default: handled = false;
            }
        } else if (e.shiftKey) {
            switch (e.key) {
                case '}': case ']': this.app.colorManager.changeColor(true); break;
                case '{': case '[': this.app.colorManager.changeColor(false); break;
                default:
                    switch (e.key.toLowerCase()) {
                        case 'h': this.app.canvasManager.flipVertical(); break;
                        case 'arrowup': this.app.canvasManager.zoom(1.20); break;
                        case 'arrowdown': this.app.canvasManager.zoom(1 / 1.20); break;
                        case 'arrowleft': this.app.canvasManager.rotate(-15); break;
                        case 'arrowright': this.app.canvasManager.rotate(15); break;
                        default: handled = false;
                    }
            }
        } else {
             switch (e.key.toLowerCase()) {
                case '[': this.app.penSettingsManager.changeSize(false); break;
                case ']': this.app.penSettingsManager.changeSize(true); break;
                case 'x': this.app.colorManager.swapColors(); break;
                case 'd': this.app.colorManager.resetColors(); break;
                case 'p': this.app.toolManager.setTool('pen'); break;
                case 'e': this.app.toolManager.setTool('eraser'); break;
                case 'v': this.app.toolManager.setTool('move'); break;
                case 'g': this.app.toolManager.setTool('bucket'); break;
                case 'h': this.app.canvasManager.flipHorizontal(); break;
                case '1': this.app.canvasManager.resetView(); break;
                default: handled = false;
            }
        }
        return handled;
    }

    handleWheel(e) {
        if (this.app.toolManager.getCurrentTool() !== 'move') return false;
        const delta = e.deltaY > 0 ? -1 : 1;
        let handled = true;
        if (e.shiftKey && e.ctrlKey) {
             this.app.layerManager.rotateActiveLayer(delta * 5);
        } else if (e.shiftKey) {
            const scaleFactor = delta > 0 ? 1.1 : 1 / 1.1;
            this.app.layerManager.scaleActiveLayer(scaleFactor);
        } else if (!e.shiftKey && !e.ctrlKey) {
             const scaleFactor = delta > 0 ? 1.05 : 1 / 1.05;
             this.app.layerManager.scaleActiveLayer(scaleFactor);
        } else {
            handled = false;
        }
        return handled;
    }
}
