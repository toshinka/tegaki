// ToolManager.js
class ToolManager {
    constructor(app) {
        this.app = app;
        this.currentTool = 'pen';

        this.bindEvents();
    }

    bindEvents() {
        document.getElementById('pen-tool').addEventListener('click', () => this.setTool('pen'));
        document.getElementById('eraser-tool').addEventListener('click', () => this.setTool('eraser'));
        document.getElementById('move-tool').addEventListener('click', () => this.setTool('move'));
        document.getElementById('bucket-tool').addEventListener('click', () => this.setTool('bucket'));
    }

    setTool(tool) {
        this.currentTool = tool;
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        const toolButton = document.getElementById(tool + '-tool');
        if(toolButton) toolButton.classList.add('active');
        
        this.app.canvasManager.setCurrentTool(tool);
        this.app.canvasManager.updateCursor();
    }

    getCurrentTool() {
        return this.currentTool;
    }

    // 予告: 筆圧・補正（Smooth.js相当）
    // 難易度：高｜優先度：後

    // 予告: スポイト（I/SHIFT+I）
    // 難易度：中｜優先度：中
}
