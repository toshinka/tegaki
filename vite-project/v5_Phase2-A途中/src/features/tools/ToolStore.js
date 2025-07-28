// src/features/tools/ToolStore.js

export class ToolStore {
    constructor(serviceContainer) {
        this.serviceContainer = serviceContainer;
        this.currentTool = 'pen';
        this.listeners = [];
        // ToolEngineControllerは遅延解決する
        this._toolEngineController = null;
    }

    // ToolEngineControllerの遅延取得
    get toolEngineController() {
        if (!this._toolEngineController) {
            this._toolEngineController = this.serviceContainer.resolve('ToolEngineController');
        }
        return this._toolEngineController;
    }

    selectTool(toolName) {
        if (this.currentTool === toolName) return;
        
        const previousTool = this.currentTool;
        this.currentTool = toolName;
        
        try {
            // 協調エンジンの起動を指示
            this.toolEngineController.selectTool(toolName);
            
            // 状態変更を通知
            this.listeners.forEach(listener => {
                try {
                    listener(this.currentTool);
                } catch (error) {
                    console.error('Error in tool change listener:', error);
                }
            });
            
            console.log(`Tool changed from ${previousTool} to ${toolName}`);
        } catch (error) {
            console.error('Failed to select tool:', error);
            // エラーが発生した場合は前のツールに戻す
            this.currentTool = previousTool;
            throw error;
        }
    }

    getCurrentTool() {
        return this.currentTool;
    }

    subscribe(listener) {
        if (typeof listener !== 'function') {
            throw new Error('Listener must be a function');
        }
        
        this.listeners.push(listener);
        
        // アンサブスクライブ関数を返す
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    // 全てのリスナーをクリア
    clearListeners() {
        this.listeners = [];
    }

    // ツールの有効性をチェック
    isValidTool(toolName) {
        const validTools = ['pen', 'brush', 'eraser'];
        return validTools.includes(toolName);
    }
}