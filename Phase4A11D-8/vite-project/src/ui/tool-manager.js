// ui/tool-manager.js

export class ToolManager {
    constructor(app) {
        this.app = app;
        this.currentTool = 'pen';
        this.bindEvents();

        // Tweakpane を使って新しい設定パネルを作成します
        const pane = new Tweakpane.Pane({
            title: 'ツール設定',
            expanded: true,
            // --- ⬇️ ここから変更 ⬇️ ---
            // パネルを表示させるHTML要素を指定します
            container: document.getElementById('tweakpane-container'),
            // --- ⬆️ ここまで変更 ⬆️ ---
        });

        // パネルに表示する設定項目（サイズと色）の初期値を決めます
        const params = {
          size: 5,
          color: '#800000',
        };

        // 「サイズ」を変更するためのスライダーを追加します
        pane.addInput(params, 'size', {
          label: 'サイズ',
          min: 1,
          max: 50,
          step: 1,
        }).on('change', (ev) => {
            // スライダーを動かしたら、その値をキャンバスに伝えます
            this.app.canvasManager.setCurrentSize(ev.value);
        });

        // 「色」を変更するためのカラーピッカーを追加します
        pane.addInput(params, 'color', {
            label: 'カラー'
        }).on('change', (ev) => {
            // 色を選んだら、その値をキャンバスに伝えます
            this.app.canvasManager.setCurrentColor(ev.value.toString());
        });

        // アプリケーション起動時に、初期値をキャンバスに設定しておきます
        this.app.canvasManager.setCurrentSize(params.size);
        this.app.canvasManager.setCurrentColor(params.color);
    }
    
    bindEvents() {
        document.getElementById('pen-tool').addEventListener('click', () => this.setTool('pen'));
        document.getElementById('eraser-tool').addEventListener('click', () => this.setTool('eraser'));
        document.getElementById('bucket-tool').addEventListener('click', () => this.setTool('bucket'));
        document.getElementById('move-tool').addEventListener('click', () => this.setTool('move'));
    }
    
    setTool(tool) {
        this.currentTool = tool;
        document.querySelectorAll('.left-toolbar .tool-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(tool + '-tool')?.classList.add('active');
        this.app.canvasManager.setCurrentTool(tool);
    }
}