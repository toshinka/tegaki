// ========================================
// tools/abstract-tool.js - 最小限
// ========================================
class AbstractTool {
    constructor() { console.log('🔧 AbstractTool Minimal'); }
    setCanvasManager(cm) { this.canvasManager = cm; }
    onPointerDown() {}
    onPointerMove() {}  
    onPointerUp() {}
}
window.Tegaki.AbstractTool = AbstractTool;