// 20250614_2100_ToolManager.js
// 今回の改修では変更の必要がないため、指示に基づきプレフィックスのみ更新しました。
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
}