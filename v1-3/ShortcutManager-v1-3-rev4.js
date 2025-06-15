// ShortcutManager-v1-3-rev4.js
// Vキー（移動ツール）選択時のホイール操作によるレイヤーの拡縮・回転ショートカットを実装。
// キーボードショートカットはToshinkaTegakiTool.jsの改修が必要なため、このファイルでは未実装。
class ShortcutManager {
    constructor(app) {
        this.app = app;
        // KeydownイベントはToshinkaTegakiTool.jsで一括管理されているため、
        // ここで新たに追加すると競合のリスクがある。
        // そのため、ホイールイベントのみCanvasManagerから移譲してもらう形にする。
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
        let handled = false;

        // V + Shift + Ctrl + Wheel → レイヤー回転
        if (e.shiftKey && e.ctrlKey) {
            this.app.layerManager.rotateActiveLayer(delta * 5); // 5度ずつ回転
            handled = true;
        }
        // V + Shift + Wheel → レイヤー拡縮
        else if (e.shiftKey) {
            const scaleFactor = delta > 0 ? 1.1 : 1 / 1.1;
            this.app.layerManager.scaleActiveLayer(scaleFactor);
            handled = true;
        }
        
        return handled;
    }
    
    // 将来ToshinkaTegakiTool.jsを改修する際に、以下の様なkeydownハンドラを実装し、
    // 呼び出すことで、キーボードショートカットを有効化できる。
    /*
    handleKeyDown(e) {
        if (this.app.toolManager.getCurrentTool() !== 'move') return false;

        let handled = true;
        const moveAmount = 10;

        if (e.shiftKey) {
            switch(e.key.toLowerCase()) {
                case 'h': this.app.layerManager.flipActiveLayerVertical(); break;
                // ... 他のShiftキー組み合わせ
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
    */
}
