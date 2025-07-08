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
        // テキスト入力中などはショートカットを無効化
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        // キーのリピートは無視
        if (e.repeat) return;

        // アクティブな要素のフォーカスを外す
        if (document.activeElement && typeof document.activeElement.blur === 'function') {
            document.activeElement.blur();
        }

        // --- 状態管理キー (Shift, Space, V) ---
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
            // Vキーが押されたら、レイヤー変形モードを開始する
            this.app.canvasManager.startLayerTransform();
            this.app.canvasManager.updateCursor();
            e.preventDefault();
            return;
        }
        
        // --- 変形モード中のキー操作 ---
        if (this.app.canvasManager.isLayerTransforming) {
            let handled = true;
            const moveAmount = e.shiftKey ? 10 : 2; // Shiftで高速移動
            const scaleAmount = 1.05;
            const rotateAmount = 5;

            switch (e.key.toLowerCase()) {
                // 移動
                case 'arrowup':
                    this.app.canvasManager.applyLayerTransform({ translation: [0, -moveAmount, 0] });
                    break;
                case 'arrowdown':
                    this.app.canvasManager.applyLayerTransform({ translation: [0, moveAmount, 0] });
                    break;
                case 'arrowleft':
                    this.app.canvasManager.applyLayerTransform({ translation: [-moveAmount, 0, 0] });
                    break;
                case 'arrowright':
                    this.app.canvasManager.applyLayerTransform({ translation: [moveAmount, 0, 0] });
                    break;
                
                // 拡縮・回転 (Shiftキー併用)
                case 's': // Scale
                    if(e.shiftKey) this.app.canvasManager.applyLayerTransform({ scale: 1 / scaleAmount });
                    else this.app.canvasManager.applyLayerTransform({ scale: scaleAmount });
                    break;
                case 'r': // Rotate
                    if(e.shiftKey) this.app.canvasManager.applyLayerTransform({ rotation: rotateAmount });
                    else this.app.canvasManager.applyLayerTransform({ rotation: -rotateAmount });
                    break;
                
                // 反転
                case 'h': // Horizontal Flip
                     this.app.canvasManager.applyLayerTransform({ flip: 'x' });
                     break;
                case 'f': // Vertical Flip (Flipping)
                     this.app.canvasManager.applyLayerTransform({ flip: 'y' });
                     break;
                     
                // キャンセル
                case 'escape':
                    this.app.canvasManager.cancelLayerTransform();
                    // isVDownもfalseにして、keyupを待たずにモードを抜ける
                    this.app.canvasManager.isVDown = false; 
                    break;
                    
                default:
                    handled = false;
            }

            if (handled) {
                e.preventDefault();
            }
            return; // 変形モード中は他のショートカットを無効化
        }

        // --- パンニング中のキー操作 ---
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

        let handled = false;
        // --- 通常のショートカット ---
        if ((e.ctrlKey || e.metaKey)) { // Ctrl / Cmd
            switch (e.key.toLowerCase()) {
                case 'z': this.app.canvasManager.undo(); handled = true; break;
                case 'y': this.app.canvasManager.redo(); handled = true; break;
                case '[': this.app.penSettingsManager.changeSize(false); handled = true; break;
                case ']': this.app.penSettingsManager.changeSize(true); handled = true; break;
            }
        } else { // 修飾キーなし
            switch (e.key.toLowerCase()) {
                case 'x': this.app.colorManager.swapColors(); handled = true; break;
                case 'd': this.app.colorManager.resetColors(); handled = true; break;
                case 'p': this.app.toolManager.setTool('pen'); handled = true; break;
                case 'e': this.app.toolManager.setTool('eraser'); handled = true; break;
                case 'g': this.app.toolManager.setTool('bucket'); handled = true; break;
                case 'h': this.app.canvasManager.flipHorizontal(); handled = true; break;
                case 'f': this.app.canvasManager.flipVertical(); handled = true; break; // Flip
                case 'home': case '0': this.app.canvasManager.resetView(); handled = true; break;
                case 'delete': case 'backspace': this.app.layerManager.clearActiveLayer(); handled = true; break;
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
            // Vキーが離されたら、レイヤー変形を確定する
            this.app.canvasManager.commitLayerTransform();
            this.app.canvasManager.isVDown = false;
            this.app.canvasManager.updateCursor();
            e.preventDefault();
        }
    }

    handleWheel(e) {
        const now = Date.now();
        if (now - this.lastWheelTime < this.wheelThrottle) {
            e.preventDefault();
            return;
        }
        this.lastWheelTime = now;

        // 変形モード中はホイール操作を無効化
        if (this.app.canvasManager.isLayerTransforming) {
            e.preventDefault();
            return;
        }

        this.app.canvasManager.handleWheel(e);
    }

    _movePan(dx, dy) {
        const t = this.app.canvasManager.viewTransform;
        t.left += dx;
        t.top += dy;
        this.app.canvasManager.applyViewTransform();
    }
}