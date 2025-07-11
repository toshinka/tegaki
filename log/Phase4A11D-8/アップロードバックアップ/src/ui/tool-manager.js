// src/ui/tool-manager.js

export class ToolManager {
    constructor(app) {
        this.app = app;
        this.currentTool = 'pen';
        this.bindEvents();
    }
    
    bindEvents() {
        document.getElementById('pen-tool')?.addEventListener('click', () => this.setTool('pen'));
        document.getElementById('eraser-tool')?.addEventListener('click', () => this.setTool('eraser'));
        document.getElementById('bucket-tool')?.addEventListener('click', () => this.setTool('bucket'));
        document.getElementById('move-tool')?.addEventListener('click', () => this.setTool('move'));
    }
    
    setTool(tool) {
        this.currentTool = tool;
        document.querySelectorAll('.left-toolbar .tool-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(tool + '-tool')?.classList.add('active');
        this.app.canvasManager.setCurrentTool(tool);
    }
}