// ToolManager.js
/**
 * ToolManagerクラス
 * 描画ツールの選択と管理を担当します。
 */
class ToolManager {
    /**
     * @param {FutabaTegakiTool} app - メインアプリケーションのインスタンス
     */
    constructor(app) {
        this.app = app;
        this.currentTool = 'pen'; // 初期ツール

        this.bindEvents();
    }

    /**
     * ツールボタンのイベントリスナーをバインドします。
     */
    bindEvents() {
        document.getElementById('pen-tool').addEventListener('click', () => this.setTool('pen'));
        document.getElementById('eraser-tool').addEventListener('click', () => this.setTool('eraser'));
        document.getElementById('move-tool').addEventListener('click', () => this.setTool('move'));
        // バケツツールボタンのイベントリスナーを追加
        document.getElementById('bucket-tool').addEventListener('click', () => this.setTool('bucket')); 
    }

    /**
     * 現在のツールを設定します。
     * @param {string} tool - 設定するツールの名前
     */
    setTool(tool) {
        this.currentTool = tool;
        // 全てのツールボタンのアクティブ状態を解除
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        // 現在選択されたツールボタンにアクティブクラスを追加
        const toolButton = document.getElementById(tool + '-tool');
        if(toolButton) toolButton.classList.add('active');
        // CanvasManagerに現在のツールを通知
        this.app.canvasManager.setCurrentTool(tool); 
        // CanvasManagerにカーソル更新を依頼
        this.app.canvasManager.updateCursor(); 
    }

    /**
     * 現在のツール名を返します。
     * @returns {string} 現在のツール名
     */
    getCurrentTool() {
        return this.currentTool;
    }

    // 予告: 筆圧・補正（Smooth.js相当）
    // 難易度：高｜優先度：後

    // 予告: バケツ（Gキー） - キーボードショートカットはFutabaTegakiTool.jsで処理済み
    // 難易度：中｜優先度：中

    // 予告: スポイト（I/SHIFT+I）
    // 難易度：中｜優先度：中

    // 予告: エアブラシ（Bキー）
    // 難易度：低｜優先度：後

    // 予告: 文字ツール（縦横＋ドラッグ配置）
    // 難易度：中｜優先度：後

    // 予告: 定規/図形ツール
    // 難易度：高｜優先度：後

    // 予告: パスツール
    // 難易度：高｜優先度：後

    // 予告: ツールウィンドウ内アイコンのドラッグ入替機能
    // 難易度：中｜優先度：後｜現状：固定配置、実装予定あり
}
