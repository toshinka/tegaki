// ui/tool-manager.js

export class ToolManager {
    constructor(app) {
        this.app = app;
        this.canvasManager = null; // 🚀【追加】CanvasManagerを保持するプロパティ
        this.currentTool = 'pen';
        this.toolButtons = {
            pen: document.getElementById('pen-tool'),
            eraser: document.getElementById('eraser-tool'),
            bucket: document.getElementById('bucket-tool'),
            move: document.getElementById('move-tool')
        };
        this.bindEvents();
    }

    // 🚀【追加】CanvasManagerを受け取るメソッド
    setCanvasManager(canvasManager) {
        this.canvasManager = canvasManager;
    }

    bindEvents() {
        Object.entries(this.toolButtons).forEach(([tool, button]) => {
            if (button) {
                button.addEventListener('click', () => {
                    // 🚀【修正】「移動ツール」が押された時の特別処理
                    if (tool === 'move') {
                        if (this.canvasManager) {
                            this.canvasManager.bakeActiveLayerTransform();
                        }
                        // 移動ツールはアクティブ状態にせず、他のツールの状態を維持する
                        return; 
                    }
                    this.setTool(tool);
                });
            }
        });
    }

    setTool(tool) {
        if (this.currentTool === tool) return;
        this.currentTool = tool;

        Object.entries(this.toolButtons).forEach(([toolName, button]) => {
            if(button) {
                button.classList.toggle('active', toolName === tool);
            }
        });
        
        // CanvasManagerのプロパティを更新
        if (this.app.canvasManager) {
            // この行は不要になりました。CanvasManagerは直接ToolManagerを参照します
            // this.app.canvasManager.setCurrentTool(tool);
        }
    }
}