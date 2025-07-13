class ToolManager {
    constructor(toolState) {
        this.toolState = toolState; // ToolStateを保持
        this.tools = new Map();
        this.activeTool = null;

        // ToolStateの変更を監視する
        // Tweakpaneは直接 'activeTool' プロパティを書き換えるので、
        // 定期的にチェックするか、より高度な状態管理パターンが必要になる。
        // 今回はシンプルにするため、UIからの直接の切り替えに依存する。
        // （`toolState`の`addBinding`の`onChange`で`setActiveTool`を呼ぶのが本来は望ましい）
    }

    addTool(name, tool) {
        this.tools.set(name, tool);
    }

    setActiveTool(name) {
        if (this.tools.has(name)) {
            this.activeTool = this.tools.get(name);
        } else {
            console.error(`Tool "${name}" not found.`);
        }
    }

    // 描画イベントが来たときに、ToolStateから現在のツール名を取得し、
    // 自身の持つアクティブツールと一致しているか確認してから実行する
    // これにより、UIでの変更が即座に反映される
    getCurrentTool() {
        const toolName = this.toolState.getActiveTool();
        if (this.tools.has(toolName)) {
            return this.tools.get(toolName);
        }
        return null;
    }

    onDrawStart(pos) {
        const currentTool = this.getCurrentTool();
        if (currentTool) {
            currentTool.onDrawStart(pos);
        }
    }

    onDrawMove(pos) {
        const currentTool = this.getCurrentTool();
        if (currentTool) {
            currentTool.onDrawMove(pos);
        }
    }

    onDrawEnd(pos) {
        const currentTool = this.getCurrentTool();
        if (currentTool) {
            currentTool.onDrawEnd(pos);
        }
    }
}

export default ToolManager;