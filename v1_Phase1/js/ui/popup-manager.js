// ========================================  
// js/ui/popup-manager.js - 最小限
// ========================================
class PopupManager {
    constructor() { console.log('💬 PopupManager Minimal'); }
    showPopup(data) { console.log('Popup:', data.message); }
}
window.Tegaki.PopupManager = PopupManager;
window.Tegaki.PopupManagerInstance = new PopupManager();