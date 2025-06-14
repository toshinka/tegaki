// TopBarManager.js
class TopBarManager {
    constructor(app) {
        this.app = app;
        this.bindEvents();
    }

    bindEvents() {
        document.getElementById('undo-btn').addEventListener('click', () => this.app.canvasManager.undo());
        document.getElementById('redo-btn').addEventListener('click', () => this.app.canvasManager.redo());
        document.getElementById('clear-btn').addEventListener('click', () => this.app.canvasManager.clearCanvas());
        document.getElementById('close-btn').addEventListener('click', () => this.closeTool());
        
        document.getElementById('flip-h-btn').addEventListener('click', () => this.app.canvasManager.flipHorizontal());
        document.getElementById('flip-v-btn').addEventListener('click', () => this.app.canvasManager.flipVertical());
        document.getElementById('zoom-in-btn').addEventListener('click', () => this.app.canvasManager.zoom(1.2));
        document.getElementById('zoom-out-btn').addEventListener('click', () => this.app.canvasManager.zoom(1 / 1.2));
        document.getElementById('rotate-btn').addEventListener('click', () => this.app.canvasManager.rotate(15));
        document.getElementById('rotate-ccw-btn').addEventListener('click', () => this.app.canvasManager.rotate(-15));
        document.getElementById('reset-view-btn').addEventListener('click', () => this.app.canvasManager.resetView());
    }

    closeTool() {
        if (confirm('ウィンドウを閉じますか？')) {
            window.close();
        }
    }

    // 予告: セーブ＆ロード（HTML保存）
    // 難易度：高｜優先度：後
}
