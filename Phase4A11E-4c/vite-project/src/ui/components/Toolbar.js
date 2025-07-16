/**
 * [クラス責務] Toolbar.js
 * 目的：トップバーのUI（Undo/Redo、視点操作ボタンなど）の表示とイベント処理を担当する。
 * 旧TopBarManagerの責務を引き継ぐ。
 */
export class Toolbar {
    constructor({ historyStore, viewport }) {
        this.historyStore = historyStore;
        this.viewport = viewport;

        this.undoBtn = document.getElementById('undo-btn');
        this.redoBtn = document.getElementById('redo-btn');
        
        this.bindEvents();
    }

    bindEvents() {
        this.undoBtn?.addEventListener('click', () => this.historyStore.undo());
        this.redoBtn?.addEventListener('click', () => this.historyStore.redo());
        
        document.getElementById('close-btn')?.addEventListener('click', () => {
             if (confirm('あうぅ…閉じるけど平気…？')) window.close();
        });
        
        // Viewport controls
        document.getElementById('flip-h-btn')?.addEventListener('click', () => this.viewport.flipHorizontal());
        document.getElementById('flip-v-btn')?.addEventListener('click', () => this.viewport.flipVertical());
        document.getElementById('zoom-in-btn')?.addEventListener('click', () => this.viewport.zoom(1.2));
        document.getElementById('zoom-out-btn')?.addEventListener('click', () => this.viewport.zoom(1 / 1.2));
        document.getElementById('rotate-btn')?.addEventListener('click', () => this.viewport.rotate(15));
        document.getElementById('rotate-ccw-btn')?.addEventListener('click', () => this.viewport.rotate(-15));
        document.getElementById('reset-view-btn')?.addEventListener('click', () => this.viewport.resetView());
    }

    render(historyState) {
        // Update button states based on whether undo/redo is possible
        if (this.undoBtn) this.undoBtn.disabled = !historyState.canUndo;
        if (this.redoBtn) this.redoBtn.disabled = !historyState.canRedo;
    }
}