// src/features/tools/ToolStore.js

export class ToolStore {
    constructor(serviceContainer) {
        this.serviceContainer = serviceContainer;
        this.toolEngineController = this.serviceContainer.resolve('ToolEngineController');
        this.currentTool = 'pen';
        this.listeners = [];
    }

    selectTool(toolName) {
        if (this.currentTool === toolName) return;
        this.currentTool = toolName;
        
        // 協調エンジンの起動を指示
        this.toolEngineController.selectTool(toolName);
        
        // 状態変更を通知
        this.listeners.forEach(listener => listener(this.currentTool));
    }

    getCurrentTool() {
        return this.currentTool;
    }

    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }
}