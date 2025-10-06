// ================================================================================
// system/state-manager.js - Phase 3: commit API完成版
// ================================================================================
// 🔥 改修方針:
// - commit() による状態変更の一元化（既存実装を維持）
// - EventBus 優先度対応（state:changed を高優先度で発火）
// - エラーハンドリング強化
// - Phase 1の History API と完全連携
//
// ✅ 既存機能維持:
// - getSnapshot() / applySnapshot()
// - リスナー管理
// - 状態検証
// ================================================================================

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
            
            // 🔥 改修: History 実行中フラグ（History.isApplying() と連動）
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
            // 🔥 改修: History.isApplying() でチェック
            if (window.History && window.History.isApplying && window.History.isApplying()) {
                // Undo/Redo 実行中は commit しない
                return;
            }
            
            // isRestoring フラグでもチェック（後方互換性）
            if (this.isRestoring) {
                return;
            }
            
            // アクション検証
            if (!action || typeof action.do !== 'function' || typeof action.undo !== 'function') {
                console.error('[StateManager] Invalid action:', action);
                throw new Error('Invalid action: must have do() and undo() methods');
            }
            
            // 🔥 改修: エラーハンドリング強化
            try {
                // History に push（push 内で action.do() が実行される）
                if (window.History && window.History.push) {
                    window.History.push(action);
                } else {
                    // History が利用できない場合は直接実行
                    console.warn('[StateManager] History not available, executing action directly');
                    action.do();
                }
                
                // 変更通知
                this._notifyChange(action.name || 'unknown');
                
            } catch (error) {
                console.error('[StateManager] Failed to commit action:', error);
                throw error;
            }
        }
        
        // ===== State 直接更新（History経由での使用を想定） =====
        
        applySnapshot(snapshot) {
            if (!snapshot) {
                console.error('[StateManager] Cannot apply null snapshot');
                return;
            }
            
            // 🔥 改修: 状態検証
            const validation = this.validateState(snapshot);
            if (!validation.valid) {
                console.error('[StateManager] Invalid snapshot:', validation.errors);
                throw new Error('Invalid snapshot: ' + validation.errors.join(', '));
            }
            
            const oldState = this.state;
            this.state = structuredClone(snapshot);
            this._notifyChange('snapshot-restore');
        }
        
        // ===== リスナー管理 =====
        
        addListener(callback) {
            if (typeof callback !== 'function') {
                console.error('[StateManager] Listener must be a function');
                return () => {};
            }
            
            this.listeners.add(callback);
            return () => this.removeListener(callback);
        }
        
        removeListener(callback) {
            this.listeners.delete(callback);
        }
        
        _notifyChange(source) {
            // リスナーに通知
            this.listeners.forEach(listener => {
                try {
                    listener({ state: this.state, source });
                } catch (error) {
                    console.error('[StateManager] Listener error:', error);
                }
            });
            
            // 🔥 改修: EventBus に高優先度で発火（priority: 100）
            if (this.eventBus) {
                this.eventBus.emit('state:changed', {
                    source,
                    timestamp: Date.now(),
                    internal: window.History && window.History.isApplying && window.History.isApplying()
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
        
        getCutsCount() {
            return this.state.cuts.length;
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
            
            if (state.cuts && (state.currentCutIndex < 0 || state.currentCutIndex >= state.cuts.length)) {
                errors.push('currentCutIndex out of range');
            }
            
            if (state.cuts) {
                state.cuts.forEach((cut, index) => {
                    if (!cut.id) errors.push(`Cut ${index} missing id`);
                    if (!cut.name) errors.push(`Cut ${index} missing name`);
                    if (!Array.isArray(cut.layers)) errors.push(`Cut ${index} layers must be array`);
                    
                    if (cut.layers) {
                        cut.layers.forEach((layer, layerIndex) => {
                            if (!layer.id) errors.push(`Cut ${index} Layer ${layerIndex} missing id`);
                            if (!layer.transform) errors.push(`Cut ${index} Layer ${layerIndex} missing transform`);
                            if (!Array.isArray(layer.paths)) errors.push(`Cut ${index} Layer ${layerIndex} paths must be array`);
                        });
                    }
                });
            }
            
            return {
                valid: errors.length === 0,
                errors
            };
        }
        
        // ===== 状態のクリーンアップ =====
        
        reset() {
            this.state = this.createDefaultState();
            this._notifyChange('reset');
        }
        
        // ===== デバッグ情報 =====
        
        getDebugInfo() {
            const stateJson = JSON.stringify(this.state);
            return {
                cutsCount: this.state.cuts.length,
                currentCutIndex: this.state.currentCutIndex,
                currentLayersCount: this.getCurrentLayers().length,
                listenersCount: this.listeners.size,
                isRestoring: this.isRestoring,
                stateSize: stateJson.length,
                stateSizeKB: (stateJson.length / 1024).toFixed(2),
                validation: this.validateState(this.state)
            };
        }
    }
    
    // ===== グローバル公開 =====
    window.TegakiStateManager = StateManager;
    
    // ===== シングルトンインスタンス作成（オプション） =====
    // 必要に応じてコメント解除
    // window.stateManager = new StateManager(window.TEGAKI_CONFIG, window.TegakiEventBus);
    
    console.log('✅ system/state-manager.js Phase 3: commit API完成版 loaded');
    
})();

// ===== 使用例（コメント） =====
// const stateManager = new TegakiStateManager(TEGAKI_CONFIG, TegakiEventBus);
//
// // 状態変更（履歴に記録される）
// stateManager.commit({
//     name: 'add-layer',
//     do: () => {
//         // レイヤー追加処理
//     },
//     undo: () => {
//         // レイヤー削除処理
//     }
// });
//
// // 状態取得（読み取り専用）
// const snapshot = stateManager.getSnapshot();
//
// // リスナー登録
// const unsubscribe = stateManager.addListener(({ state, source }) => {
//     console.log('State changed:', source);
// });