// ShortcutManager-v1-3-rev5.js
// ToshinkaTegakiToolから全てのショートカットキー処理を移管。
// Vキー（移動ツール）選択時のレイヤー操作ショートカットを実装。
class ShortcutManager {
    constructor(app) {
        this.app = app;
    }

    /**
     * アプリケーションの初期化時に呼び出され、全てのショートカットキーイベントリスナーを登録する。
     */
    initialize() {
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));
        document.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
    }

    /**
     * キーが離されたときのイベントを処理する。
     * @param {KeyboardEvent} e 
     */
    handleKeyUp(e) {
        // Spaceキーでの視点移動モードを解除
        if (e.key === ' ') {
            this.app.canvasManager.isSpaceDown = false;
            this.app.canvasManager.updateCursor();
            e.preventDefault();
        }
    }

    /**
     * キーが押されたときのイベントを処理する。
     * @param {KeyboardEvent} e 
     */
    handleKeyDown(e) {
        // 入力フィールドでの操作は無視
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.repeat) return;
        
        // --- Spaceキーによる視点操作 ---
        if (e.key === ' ' && !this.app.canvasManager.isSpaceDown) {
            this.app.canvasManager.isSpaceDown = true;
            this.app.canvasManager.updateCursor();
            e.preventDefault();
        }
        if (this.app.canvasManager.isSpaceDown) {
            // Space + 矢印キーでの視点移動
            let handled = true;
            const moveAmount = 10;
            const style = this.app.canvasManager.canvasContainer.style;
            this.app.canvasManager.setAbsolutePosition();
            switch(e.key) {
                case 'ArrowUp':    style.top = (parseFloat(style.top) - moveAmount) + 'px'; break;
                case 'ArrowDown':  style.top = (parseFloat(style.top) + moveAmount) + 'px'; break;
                case 'ArrowLeft':  style.left = (parseFloat(style.left) - moveAmount) + 'px'; break;
                case 'ArrowRight': style.left = (parseFloat(style.left) + moveAmount) + 'px'; break;
                default: handled = false;
            }
            if(handled) e.preventDefault();
            return;
        }

        let handled = false;

        // --- レイヤー操作ショートカット (移動ツール選択時) ---
        if (this.app.toolManager.getCurrentTool() === 'move') {
            handled = this.handleLayerTransformKeys(e);
        }
        
        // --- グローバルショートカット (レイヤー操作が実行されなかった場合) ---
        if (!handled) {
            handled = this.handleGlobalKeys(e);
        }
        
        if (handled) {
            e.preventDefault();
        }
    }
    
    /**
     * レイヤーの移動・変形に関するキーを処理する。
     * @param {KeyboardEvent} e 
     * @returns {boolean} 処理したかどうか
     */
    handleLayerTransformKeys(e) {
        let handled = true;
        const moveAmount = 1; // 1px
        const rotateAmount = 1; // 1deg
        const scaleFactor = 1.02; // 2%

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

    /**
     * アプリ全体のグローバルなキーを処理する。
     * @param {KeyboardEvent} e 
     * @returns {boolean} 処理したかどうか
     */
    handleGlobalKeys(e) {
        let handled = true;
        if (e.ctrlKey || e.metaKey) { // Undo/Redo
            switch (e.key.toLowerCase()) {
                case 'z': this.app.canvasManager.undo(); break;
                case 'y': this.app.canvasManager.redo(); break;
                default: handled = false;
            }
        } else if (e.shiftKey) { // 色・表示の操作 (Shift)
            switch (e.key) {
                case '}': case ']': this.app.colorManager.changeColor(true); break;
                case '{': case '[': this.app.colorManager.changeColor(false); break;
                default:
                    switch (e.key.toLowerCase()) {
                        case 'h': this.app.canvasManager.flipVertical(); break; // 全体上下反転
                        case 'arrowup': this.app.canvasManager.zoom(1.20); break;
                        case 'arrowdown': this.app.canvasManager.zoom(1 / 1.20); break;
                        case 'arrowleft': this.app.canvasManager.rotate(-15); break;
                        case 'arrowright': this.app.canvasManager.rotate(15); break;
                        default: handled = false;
                    }
            }
        } else { // ツール・ペンサイズ・表示の操作
             switch (e.key.toLowerCase()) {
                case '[': this.app.penSettingsManager.changeSize(false); break;
                case ']': this.app.penSettingsManager.changeSize(true); break;
                case 'x': this.app.colorManager.swapColors(); break;
                case 'd': this.app.colorManager.resetColors(); break;
                case 'p': this.app.toolManager.setTool('pen'); break;
                case 'e': this.app.toolManager.setTool('eraser'); break;
                case 'v': this.app.toolManager.setTool('move'); break;
                case 'g': this.app.toolManager.setTool('bucket'); break;
                case 'h': this.app.canvasManager.flipHorizontal(); break; // 全体左右反転
                case '1': this.app.canvasManager.resetView(); break;
                case 'arrowup': this.app.canvasManager.zoom(1.05); break;
                case 'arrowdown': this.app.canvasManager.zoom(1 / 1.05); break;
                case 'arrowleft': this.app.canvasManager.rotate(-5); break;
                case 'arrowright': this.app.canvasManager.rotate(5); break;
                default: handled = false;
            }
        }
        return handled;
    }

    /**
     * CanvasManagerからホイールイベントを受け取り、処理する。
     * @param {WheelEvent} e ホイールイベント
     * @returns {boolean} イベントを処理した場合はtrue、しなかった場合はfalse
     */
    handleWheel(e) {
        // 移動ツールが選択されていない場合は何もしない
        if (this.app.toolManager.getCurrentTool() !== 'move') {
            return false;
        }

        const delta = e.deltaY > 0 ? -1 : 1;
        let handled = true;

        if (e.shiftKey && e.ctrlKey) { // V + Shift + Ctrl + Wheel → レイヤー回転
             this.app.layerManager.rotateActiveLayer(delta * 5); // 5度ずつ
        } else if (e.shiftKey) { // V + Shift + Wheel → レイヤー拡縮
            const scaleFactor = delta > 0 ? 1.1 : 1 / 1.1;
            this.app.layerManager.scaleActiveLayer(scaleFactor);
        } else if (!e.shiftKey && !e.ctrlKey) { // V + Wheel → レイヤー拡縮（Shiftなしでも可）
             const scaleFactor = delta > 0 ? 1.05 : 1 / 1.05;
             this.app.layerManager.scaleActiveLayer(scaleFactor);
        } else {
            handled = false;
        }
        
        return handled;
    }
}
