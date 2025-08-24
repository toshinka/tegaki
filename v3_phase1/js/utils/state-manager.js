// ========================================
// js/utils/state-manager.js - 最小限
// ========================================
window.Tegaki = window.Tegaki || {};
class StateManager {
    constructor() { this.state = {}; }
    updateComponentState(component, key, value) { 
        console.log(`State: ${component}.${key} = ${value}`);
    }
}
window.Tegaki.StateManager = StateManager;
window.Tegaki.StateManagerInstance = new StateManager();
console.log('📊 StateManager Minimal Loaded');