// ===== src/stores/CanvasStore.js =====
/**
 * CanvasStore - キャンバス状態管理
 */
export class CanvasStore {
    constructor() {
        this.transform = {
            scale: 1.0,
            offsetX: 0,
            offsetY: 0,
            rotation: 0
        };
    }
    
    exportState() {
        return { transform: this.transform };
    }
