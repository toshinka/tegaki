// ===== src/CanvasController.js =====
/**
 * CanvasController - キャンバス操作統合（Phase2拡張）
 */
export class CanvasController {
    constructor(oglCore, inputController, eventStore, canvasStore) {
        this.oglCore = oglCore;
        this.inputController = inputController;
        this.eventStore = eventStore;
        this.canvasStore = canvasStore;
        
        this.setupCanvasOperations();
    }
    
    setupCanvasOperations() {
        console.log('✅ Canvas operations setup completed');
    }
    
    applyTransform(transform) {
        this.inputController.setCanvasTransform(transform);
    }
    
    resetToDefaultView() {
        this.inputController.resetCanvas();
    }
    
    destroy() {
        console.log('✅ Canvas controller destroyed');
    }
}
