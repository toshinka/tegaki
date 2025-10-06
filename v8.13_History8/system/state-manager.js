// ================================================================================
// system/state-manager.js - 改修版：所有権明確化 + Immutable State
// ================================================================================
// 改修内容：
// - structuredClone によるディープコピーの徹底
// - applyChange() による変更の一元化
// - 復元フラグ isRestoring による二重変更防止
// - State検証機能の強化

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
            
            // 復元中フラグ（History復元時の二重変更防止）
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
        
        // 完全なディープコピーを返す（History保存用）
        getSnapshot() {
            return structuredClone(this.state);
        }
        
        // 読み取り専用（パフォーマンス重視の参照）
        getStateReadonly() {
            return this.state;
        }
        
        // 軽量コピー（UI表示用）
        getState() {
            return structuredClone(this.state);
        }
        
        // ===== State 更新（唯一の書き換えAPI） =====
        
        applySnapshot(snapshot) {
            if (this.isRestoring) return;
            
            this.isRestoring = true;
            
            try {
                const oldState = this.state;
                // 完全にディープコピーして置換
                this.state = structuredClone(snapshot);
                
                this.notifyListeners({ oldState, newState: this.state, source: 'snapshot-restore' });
                
                if (this.eventBus) {
                    this.eventBus.emit('state:restored', {
                        timestamp: Date.now()
                    });
                }
            } finally {
                this.isRestoring = false;
            }
        }
        
        applyChange(change) {
            if (this.isRestoring) {
                return;
            }
            
            const oldState = this.state;
            
            // changeに応じてstateを更新
            switch (change.type) {
                case 'cut.create': {
                    const id = change.payload.id || `cut_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    const cut = {
                        id: id,
                        name: change.payload.name || `CUT${this.state.cuts.length + 1}`,
                        duration: change.payload.duration || 0.5,
                        layers: structuredClone(change.payload.layers || [])
                    };
                    this.state.cuts.push(cut);
                    this.state.currentCutIndex = this.state.cuts.length - 1;
                    break;
                }
                
                case 'cut.delete': {
                    const cutIndex = change.payload.cutIndex;
                    if (cutIndex >= 0 && cutIndex < this.state.cuts.length) {
                        this.state.cuts.splice(cutIndex, 1);
                        if (this.state.currentCutIndex >= cutIndex) {
                            this.state.currentCutIndex = Math.max(0, this.state.currentCutIndex - 1);
                        }
                    }
                    break;
                }
                
                case 'cut.switch': {
                    const cutIndex = change.payload.cutIndex;
                    if (cutIndex >= 0 && cutIndex < this.state.cuts.length) {
                        this.state.currentCutIndex = cutIndex;
                    }
                    break;
                }
                
                case 'layer.create': {
                    const cutIndex = change.payload.cutIndex ?? this.state.currentCutIndex;
                    if (cutIndex >= 0 && cutIndex < this.state.cuts.length) {
                        const layer = {
                            id: change.payload.id || `layer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                            name: change.payload.name || 'レイヤー',
                            visible: true,
                            opacity: 1.0,
                            isBackground: false,
                            transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
                            paths: []
                        };
                        this.state.cuts[cutIndex].layers.push(layer);
                    }
                    break;
                }
                
                case 'layer.update': {
                    const cutIndex = change.payload.cutIndex ?? this.state.currentCutIndex;
                    const layerIndex = change.payload.layerIndex;
                    if (cutIndex >= 0 && cutIndex < this.state.cuts.length) {
                        const cut = this.state.cuts[cutIndex];
                        if (layerIndex >= 0 && layerIndex < cut.layers.length) {
                            Object.assign(cut.layers[layerIndex], structuredClone(change.payload.updates));
                        }
                    }
                    break;
                }
                
                default:
                    break;
            }
            
            this.notifyListeners({ oldState, newState: this.state, source: change.type });
            
            if (this.eventBus) {
                this.eventBus.emit('state:changed', {
                    changeType: change.type,
                    timestamp: Date.now()
                });
            }
        }
        
        // レガシーAPI（互換性維持）
        setState(newState, source = 'unknown') {
            if (this.isRestoring) return;
            
            const oldState = this.state;
            this.state = structuredClone(newState);
            
            this.notifyListeners({ oldState, newState: this.state, source });
            
            if (this.eventBus) {
                this.eventBus.emit('state:changed', {
                    oldState: structuredClone(oldState),
                    newState: structuredClone(this.state),
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
            this.applyChange({
                type: 'cut.switch',
                payload: { cutIndex }
            });
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
        
        getRestoring() {
            return this.isRestoring;
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