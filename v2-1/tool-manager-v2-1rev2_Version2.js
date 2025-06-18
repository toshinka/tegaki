class ToolManager {
    constructor(app) {
        this.app = app;
        this.toolBar = document.getElementById('tool-bar');
        this.currentTool = 'pen';
        this.init();
    }

    init() {
        this.toolBar.innerHTML = `
            <button id="tool-pen" class="tool-btn">ペン</button>
            <button id="tool-eraser" class="tool-btn">消しゴム</button>
            <button id="tool-move" class="tool-btn">移動</button>
        `;
        this.bindEvents();
        this.setTool('pen');
    }

    bindEvents() {
        const penBtn = document.getElementById('tool-pen');
        const eraserBtn = document.getElementById('tool-eraser');
        const moveBtn = document.getElementById('tool-move');
        penBtn.addEventListener('click', () => this.setTool('pen'));
        eraserBtn.addEventListener('click', () => this.setTool('eraser'));
        moveBtn.addEventListener('click', () => this.setTool('move'));
    }

    setTool(toolName) {
        this.currentTool = toolName;
        this.app.topBarManager.setToolName({
            pen: 'ペン',
            eraser: '消しゴム',
            move: '移動'
        }[toolName] || toolName);
    }

    getCurrentTool() {
        return this.currentTool;
    }
}