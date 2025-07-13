export class ToolManager {
    constructor(app) {
        this.app = app;
        this.currentTool = 'pen'; // 初期ツール
    }

    setTool(toolName) {
        this.currentTool = toolName;
        // CanvasManagerに現在のツールを通知する
        if (this.app.canvasManager) {
            this.app.canvasManager.setCurrentTool(toolName);
        }
        console.log(`🛠️ ツールが '${toolName}' に設定されました。`);
    }

    getTool() {
        return this.currentTool;
    }
}