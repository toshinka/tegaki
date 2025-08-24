// ========================================
// js/app-core.js - 最小限
// ========================================
class AppCore {
    constructor() { 
        console.log('🎯 AppCore Minimal');
        this.initialized = false;
        this.canvasManager = null;
        this.toolManager = null;
    }
    
    async initialize() {
        // 基本Manager作成
        if (window.Tegaki?.CanvasManager) {
            this.canvasManager = new window.Tegaki.CanvasManager();
            window.Tegaki.CanvasManagerInstance = this.canvasManager;
        }
        
        if (window.Tegaki?.ToolManager) {
            this.toolManager = new window.Tegaki.ToolManager();  
            window.Tegaki.ToolManagerInstance = this.toolManager;
        }
        
        this.initialized = true;
        console.log('✅ AppCore Minimal initialized');
        return true;
    }
}
window.Tegaki.AppCore = AppCore;

console.log('📦 All minimal dependencies loaded');