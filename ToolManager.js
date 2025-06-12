// ToolManager.js
class ToolManager {
    constructor(app) {
        this.app = app;
        this.currentTool = 'pen'; // 初期ツール

        this.bindEvents();
    }

    bindEvents() {
        document.getElementById('pen-tool').addEventListener('click', () => this.setTool('pen'));
        document.getElementById('eraser-tool').addEventListener('click', () => this.setTool('eraser'));
        document.getElementById('move-tool').addEventListener('click', () => this.setTool('move'));
    }

    setTool(tool) {
        this.currentTool = tool;
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        const toolButton = document.getElementById(tool + '-tool');
        if(toolButton) toolButton.classList.add('active');
        this.app.canvasManager.setCurrentTool(tool); // CanvasManagerにツールを通知
        this.app.canvasManager.updateCursor(); // カーソル更新をCanvasManagerに依頼
    }

    getCurrentTool() {
        return this.currentTool;
    }

    // 予告: 筆圧・補正（Smooth.js相当）
    // 難易度：高｜優先度：後

    // 予告: バケツ（Gキー）
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