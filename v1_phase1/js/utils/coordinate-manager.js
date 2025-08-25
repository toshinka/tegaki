// ========================================
// js/utils/coordinate-manager.js - 最小限
// ========================================
class CoordinateManager {
    constructor() { console.log('📐 CoordinateManager Minimal'); }
    updateCanvasSize(w, h) { console.log(`Canvas size: ${w}x${h}`); }
}
window.Tegaki.CoordinateManager = CoordinateManager;
window.Tegaki.CoordinateManagerInstance = new CoordinateManager();