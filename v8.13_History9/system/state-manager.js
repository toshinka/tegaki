// ================================================================================
// system/state-manager.js - History統合版
// ================================================================================
// GPT5案.txt準拠：commit() による変更の一元化
// - すべての状態変更は commit(action) を通す
// - action = { name, do, undo, meta } の形式
// - History.push() と自動連携

(function() {
    'use strict';
    
    class StateManager {
        constructor(config, eventBus) {
            this.config = config || window.TEGAKI_CONFIG;
            this.eventBus = eventBus || window.TegakiEventBus;
            
            // State (内部管理、外部からは getSnapshot() で取得)
            this.state = this.createDefaultState();
            
            // 変更リスナー
            this.listeners = new Set();
            
            // History 実行中フラグ（History の isApplying と連動）
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
        
        getSnapshot() {
            return structuredClone(this.state);
        }
        
        getStateReadonly() {
            return this.state;
        }
        
        getState() {
            return structuredClone(this.state);
        }
        
        // ===== commit() - 唯一の変更API =====
        
        commit(action) {
            // History 実行中は commit しない（undo/redo は直接 do/undo を呼ぶため）
            if (this.isRestoring) {
                return;
            }
            
            if (!action || typeof action.do !== 'function' || typeof action.undo !== 'function') {
                throw new Error('Invalid action: must have do() and undo() methods');
            }
            
            // History に push（push 内で action.do() が実行される）
            if (window.History && window.History.push) {
                window.History.push(action);
            } else {
                // History が利用できない場合は直接実行
                action.do();
            }
            
            this._notifyChange(action.name || 'unknown');
        }
        
        // ===== State 直接更新（History経由での使用を想定） =====
        
        applySnapshot(snapshot) {
            const oldState = this.state;
            this.state = structuredClone(snapshot);
            this._notifyChange('snapshot-restore');
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
        
        _notifyChange(source) {
            this.listeners.forEach(listener => {
                try {
                    listener({ state: this.state, source });
                } catch (error) {
                    // エラーは無視
                }
            });
            
            if (this.eventBus) {
                this.eventBus.emit('state:changed', {
                    source,
                    timestamp: Date.now()
                });
            }
        }
        
        // ===== History 実行フラグ制御 =====
        
        setRestoring(isRestoring) {
            this.isRestoring = isRestoring;
        }
        
        getRestoring() {
            return this.isRestoring;
        }
        
        // ===== Helper Methods（読み取り専用） =====
        
        getCurrentCut() {
            return this.state.cuts[this.state.currentCutIndex];
        }
        
        getCurrentCutIndex() {
            return this.state.currentCutIndex;
        }
        
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
    
})();