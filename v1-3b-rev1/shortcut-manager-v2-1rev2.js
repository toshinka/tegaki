class ShortcutManager {
    constructor(app) {
        this.app = app;
        this.bindShortcuts();
    }

    bindShortcuts() {
        window.addEventListener('keydown', (e) => {
            // 例: Ctrl+Zでアンドゥ(未実装)
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                alert('アンドゥ（未実装）');
            }
        });
    }
}