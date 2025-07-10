export class ToolManager {
    constructor(app) {
        this.app = app;
        this.currentTool = 'pen';
        
        // Phase 4A11D-6 の指示に基づき、ペン描画の状態管理プロパティを追加
        this.isPenDrawing = false;   // Perfect Freehandでの描画中フラグ
        this.strokePoints = [];    // 描画中の点の座標を保持する配列

        this.bindEvents();
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

        // ツール切り替え時に描画状態をリセット
        this.isPenDrawing = false;
        this.strokePoints = [];
    }
}