/**
 * CanvasStore - キャンバス状態管理
 */
export class CanvasStore {
    constructor() {
        this.canvas = {
            width: 1920,
            height: 1080,
            backgroundColor: '#f0e0d6',
            scale: 1.0,
            offsetX: 0,
            offsetY: 0,
            rotation: 0
        };
        
        this.viewTransform = {
            scale: 1.0,
            translateX: 0,
            translateY: 0,
            rotation: 0
        };
        
        this.history = [];
        this.historyIndex = -1;
    }
    
    // キャンバス設定更新
    updateCanvas(updates) {
        Object.assign(this.canvas, updates);
        this.recordState();
    }
    
    // ビュー変換更新
    updateViewTransform(transform) {
        Object.assign(this.viewTransform, transform);
    }
    
    // 状態記録
    recordState() {
        const state = {
            canvas: { ...this.canvas },
            viewTransform: { ...this.viewTransform },
            timestamp: Date.now()
        };
        
        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push(state);
        this.historyIndex = this.history.length - 1;
        
        if (this.history.length > 50) {
            this.history.shift();
            this.historyIndex--;
        }
    }
    
    // 状態復元
    restoreState(index) {
        if (index >= 0 && index < this.history.length) {
            const state = this.history[index];
            this.canvas = { ...state.canvas };
            this.viewTransform = { ...state.viewTransform };
            this.historyIndex = index;
            return true;
        }
        return false;
    }
    
    // リセット
    reset() {
        this.canvas = {
            width: 1920,
            height: 1080,
            backgroundColor: '#f0e0d6',
            scale: 1.0,
            offsetX: 0,
            offsetY: 0,
            rotation: 0
        };
        
        this.viewTransform = {
            scale: 1.0,
            translateX: 0,
            translateY: 0,
            rotation: 0
        };
        
        this.history = [];
        this.historyIndex = -1;
    }
    
    // 状態エクスポート
    exportState() {
        return {
            canvas: { ...this.canvas },
            viewTransform: { ...this.viewTransform },
            historyCount: this.history.length
        };
    }
    
    // デバッグ情報
    getDebugInfo() {
        return {
            canvas: this.canvas,
            viewTransform: this.viewTransform,
            historySize: this.history.length,
            currentIndex: this.historyIndex
        };
    }
}