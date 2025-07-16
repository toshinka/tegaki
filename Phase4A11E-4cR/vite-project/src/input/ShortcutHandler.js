class ShortcutHandler {
    constructor(historyStore, layerActions) {
        this.historyStore = historyStore;
        this.layerActions = layerActions;
        this.initListeners();
    }

    initListeners() {
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
    }

    handleKeyDown(event) {
        // CtrlキーまたはCmdキー（Macの場合）が押されているかを確認
        if (event.ctrlKey || event.metaKey) {
            switch (event.key.toLowerCase()) {
                case 'z':
                    event.preventDefault();
                    if (event.shiftKey) {
                        this.historyStore.redo(); // Ctrl+Shift+Z でリドゥ
                    } else {
                        this.historyStore.undo(); // Ctrl+Z でアンドゥ
                    }
                    break;
                case 'y':
                    event.preventDefault();
                    this.historyStore.redo(); // Ctrl+Y でリドゥ
                    break;
                 case 's':
                    event.preventDefault();
                    // LayerActions の save メソッドを呼び出す
                    this.layerActions.saveLayers();
                    break;
            }
        }
    }
}

export default ShortcutHandler;