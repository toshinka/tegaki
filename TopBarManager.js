// TopBarManager.js
/**
 * TopBarManagerクラス
 * アプリケーション上部のツールバーの機能（Undo/Redo、クリア、表示操作など）を管理します。
 */
class TopBarManager {
    /**
     * @param {FutabaTegakiTool} app - メインアプリケーションのインスタンス
     */
    constructor(app) {
        this.app = app;
        this.bindEvents();
    }

    /**
     * トップバーの各ボタンのイベントリスナーをバインドします。
     */
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

    /**
     * ツールを閉じる処理です。
     * （現在はコンソール出力のみ。必要に応じてブラウザのタブを閉じるなどの処理を追加）
     */
    closeTool() {
        console.log('ツールを閉じます');
        // 必要に応じて、親ウィンドウやタブを閉じる処理を実装
        // window.close(); // ブラウザの設定による。多くのブラウザではスクリプトからのwindow.closeは制限されています。
    }

    // 予告: セーブ＆ロード（HTML保存）
    // 難易度：高｜優先度：後

    // 予告: キャンバス解像度変更（数値入力＋端ドラッグ）
    // 難易度：高｜優先度：中

    // 予告: レイヤーON/OFF切替 - LayerManagerで実装済み
    // 難易度：中｜優先度：中
}
