// ================================================================================
// system/state-manager.js - Phase1: Single Source of Truth
// ================================================================================
// 🎯 アプリケーション状態を一元管理
// ✅ Immutable State + 変更通知

(function() {
    'use strict';
    
    class StateManager {
        constructor(config, eventBus) {
            this.config = config || window.TEGAKI_CONFIG;
            this.eventBus = eventBus || window.TegakiEventBus;
            
            // State (JSON シリアライズ可能)
            this.state = this.createDefaultState();
            
            // 変更リスナー
            this.listeners = new Set();
            
            // StateManager自体の状態
            this.isRestoring = false;
        }
        
        // ===== デフォルト状態作成 =====
        
        createDefaultState() {
            return {
                cuts: [
                    {
                        id: `cut_${Date.now()}`,
                        name: 'CUT1',
                        duration: 0.5,
                        layers: [
                            {
                                id: `layer_bg_${Date.now()}`,
                                name: '背景',
                                visible: true,
                                opacity: 1.0,
                                isBackground: true,
                                transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
                                paths: []
                            },
                            {
                                id: `layer_1_${Date.now()}_1`,
                                name: 'レイヤー1',
                                visible: true,
                                opacity: 1.0,
                                isBackground: false,
                                transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
                                paths: []
                            }
                        ]
                    }
                ],
                currentCutIndex: 0,
                settings: {
                    loop: true,
                    animationFPS: this.config?.animation?.defaultFPS || 24
                }
            };
        }
        
        // ===== State 取得（Immutable） =====
        
        getState() {
            // structuredClone で完全なコピーを返す
            return structuredClone(this.state);
        }
        
        getStateReadonly() {
            // Object.freeze で変更不可にして返す（軽量）
            return Object.freeze(this.state);
        }
        
        // ===== State 更新 =====
        
        setState(newState, source = 'unknown') {
            if (this.isRestoring) return;
            
            const oldState = this.state;
            this.state = newState;
            
            // リスナーに通知
            this.notifyListeners({ oldState, newState, source });
            
            // EventBus にも通知
            if (this.eventBus) {
                this.eventBus.emit('state:changed', {
                    oldState: structuredClone(oldState),
                    newState: structuredClone(newState),
                    source
                });
            }
        }
        
        // ===== リスナー管理 =====
        
        addListener(callback) {
            if (typeof callback === 'function') {
                this.listeners.add(callback);
            }
            return () => this.removeListener(callback);
        }
        
        removeListener(callback) {
            this.listeners.delete(callback);
        }
        
        notifyListeners(data) {
            this.listeners.forEach(listener => {
                try {
                    listener(data);
                } catch (error) {
                    console.error('Listener error:', error);
                }
            });
        }
        
        // ===== CUT 操作 =====
        
        getCurrentCut() {
            return this.state.cuts[this.state.currentCutIndex];
        }
        
        getCurrentCutIndex() {
            return this.state.currentCutIndex;
        }
        
        switchCut(cutIndex) {
            if (cutIndex >= 0 && cutIndex < this.state.cuts.length) {
                const newState = structuredClone(this.state);
                newState.currentCutIndex = cutIndex;
                this.setState(newState, 'cut:switch');
            }
        }
        
        // ===== Layer 操作 =====
        
        getCurrentLayers() {
            const cut = this.getCurrentCut();
            return cut ? cut.layers : [];
        }
        
        getLayer(cutIndex, layerIndex) {
            if (cutIndex >= 0 && cutIndex < this.state.cuts.length) {
                const cut = this.state.cuts[cutIndex];
                if (layerIndex >= 0 && layerIndex < cut.layers.length) {
                    return cut.layers[layerIndex];
                }
            }
            return null;
        }
        
        // ===== State 復元フラグ =====
        
        setRestoring(isRestoring) {
            this.isRestoring = isRestoring;
        }
        
        // ===== State 検証 =====
        
        validateState(state) {
            if (!state || typeof state !== 'object') {
                return { valid: false, errors: ['State must be an object'] };
            }
            
            const errors = [];
            
            if (!Array.isArray(state.cuts)) {
                errors.push('cuts must be an array');
            }
            
            if (typeof state.currentCutIndex !== 'number') {
                errors.push('currentCutIndex must be a number');
            }
            
            if (state.currentCutIndex < 0 || state.currentCutIndex >= state.cuts.length) {
                errors.push('currentCutIndex out of range');
            }
            
            state.cuts.forEach((cut, index) => {
                if (!cut.id) errors.push(`Cut ${index} missing id`);
                if (!Array.isArray(cut.layers)) errors.push(`Cut ${index} layers must be array`);
                
                cut.layers.forEach((layer, layerIndex) => {
                    if (!layer.id) errors.push(`Cut ${index} Layer ${layerIndex} missing id`);
                    if (!layer.transform) errors.push(`Cut ${index} Layer ${layerIndex} missing transform`);
                    if (!Array.isArray(layer.paths)) errors.push(`Cut ${index} Layer ${layerIndex} paths must be array`);
                });
            });
            
            return {
                valid: errors.length === 0,
                errors
            };
        }
        
        // ===== デバッグ情報 =====
        
        getDebugInfo() {
            return {
                cutsCount: this.state.cuts.length,
                currentCutIndex: this.state.currentCutIndex,
                currentLayersCount: this.getCurrentLayers().length,
                listenersCount: this.listeners.size,
                isRestoring: this.isRestoring,
                stateSize: JSON.stringify(this.state).length
            };
        }
    }
    
    // ===== グローバル公開 =====
    
    window.TegakiStateManager = StateManager;
    
    console.log('✅ state-manager.js loaded (Phase1)');
    
})();