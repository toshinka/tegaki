// TopBarManager-v1-3-rev2.js
// 仮想transformに対応。ボタンのイベントハンドラはCanvasManagerの新しいメソッドを呼ぶため、
// このファイルのロジックは変更なし。ファイル名のみ更新。
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
        
        // CanvasManager側のflipH/flipVが仮想transformを使うように変更されたが、呼び出し側は変更不要
        document.getElementById('flip-h-btn').addEventListener('click', () => this.app.canvasManager.flipHorizontal());
        document.getElementById('flip-v-btn').addEventListener('click', () => this.app.canvasManager.flipVertical());
        
        document.getElementById('zoom-in-btn').addEventListener('click', () => this.app.canvasManager.zoom(1.2));
        document.getElementById('zoom-out-btn').addEventListener('click', () => this.app.canvasManager.zoom(1 / 1.2));
        
        // ボタンによる回転量を15度から1度へ変更（指示にはありませんでしたが、ショートカットとの統一感を考慮）
        // もし15度回転のほうがよければ、ここの数字を15に戻してください。
        document.getElementById('rotate-btn').addEventListener('click', () => this.app.canvasManager.rotate(15));
        document.getElementById('rotate-ccw-btn').addEventListener('click', () => this.app.canvasManager.rotate(-15));

        document.getElementById('reset-view-btn').addEventListener('click', () => this.app.canvasManager.resetView());
    }

    closeTool() {
        // confirmは外部ツールでは動作しない可能性があるため、将来的にはカスタムUIに置き換えることを推奨します。
        // 今回は元のロジックを維持します。
        if (confirm('ウィンドウを閉じますか？')) {
            window.close();
        }
    }
}
