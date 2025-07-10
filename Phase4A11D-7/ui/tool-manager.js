// ui/tool-manager.js

export class ToolManager {
    constructor(app) {
        this.app = app;
        this.currentTool = 'pen';
        this.bindEvents();

        // --- ⬇️ ここから追加したコードです ⬇️ ---

        // Tweakpane を使って新しい設定パネルを作成します 
        const pane = new Tweakpane.Pane({
            title: 'ツール設定',
            expanded: true,
        });

        // パネルに表示する設定項目（サイズと色）の初期値を決めます 
        const params = {
          size: 5,
          color: '#800000',
        };

        // 「サイズ」を変更するためのスライダーを追加します [cite: 3]

        pane.addInput(params, 'size', {
          min: 1,
          max: 50,
          step: 1
        }).on('change', (ev) => {
          app.canvasManager.setCurrentSize(ev.value);
        });
            // スライダーを動かしたら、その値をキャンバスに伝えます
            this.app.canvasManager.setCurrentSize(ev.value); [cite: 3]
        });

        // 「色」を変更するためのカラーピッカーを追加します [cite: 4]
        pane.addInput(params, 'color').on('change', (ev) => {
          app.canvasManager.setCurrentColor(ev.value);
        });
            // 色を選んだら、その値をキャンバスに伝えます
            this.app.canvasManager.setCurrentColor(ev.value.toString()); // ev.valueを文字列に変換
        });

        // アプリケーション起動時に、初期値をキャンバスに設定しておきます
        this.app.canvasManager.setCurrentSize(params.size);
        this.app.canvasManager.setCurrentColor(params.color);

        // --- ⬆️ ここまでが追加したコードです ⬆️ ---
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