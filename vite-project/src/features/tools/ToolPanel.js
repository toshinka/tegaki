// src/features/tools/ToolPanel.js

export class ToolPanel {
    constructor(serviceContainer) {
        this.toolStore = serviceContainer.resolve('ToolStore');
        this.container = document.getElementById('app-container');
        this.render();
        this.setupEventListeners();
        this.toolStore.subscribe(() => this.updateActiveButton());
    }

    render() {
        const panel = document.createElement('div');
        panel.id = 'tool-panel';
        panel.style.cssText = `
            position: absolute;
            top: 10px;
            left: 10px;
            display: flex;
            flex-direction: column;
            gap: 5px;
            background: #fff;
            padding: 5px;
            border-radius: 4px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        `;

        panel.innerHTML = `
            <button class="tool-button" data-tool="pen">Pen</button>
            <button class="tool-button" data-tool="brush">Brush</button>
            <button class="tool-button" data-tool="eraser">Eraser</button>
        `;

        this.container.appendChild(panel);
        
        // スタイルを追加
        const style = document.createElement('style');
        style.textContent = `
            .tool-button {
                padding: 8px;
                border: 1px solid #ccc;
                background: #f9f9f9;
                cursor: pointer;
                border-radius: 2px;
            }
            .tool-button.active {
                background: #007bff;
                color: white;
                border-color: #007bff;
            }
        `;
        document.head.appendChild(style);
        this.updateActiveButton();
    }

    setupEventListeners() {
        const panel = document.getElementById('tool-panel');
        panel.addEventListener('click', (e) => {
            if (e.target.matches('.tool-button')) {
                const toolName = e.target.dataset.tool;
                this.toolStore.selectTool(toolName);
            }
        });
    }

    updateActiveButton() {
        const currentTool = this.toolStore.getCurrentTool();
        document.querySelectorAll('.tool-button').forEach(btn => {
            if (btn.dataset.tool === currentTool) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }
}