// 20250614_1800_ToolManager.js
// このファイルはv1.1から変更ありませんが、ファイル名を統一するために提供します。
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
