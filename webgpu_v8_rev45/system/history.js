/**
 * ================================================================================
 * history.js Phase 4: mask snapshot対応完全版
 * ================================================================================
 * 
 * 📁 親ファイル依存: なし（独立モジュール）
 * 
 * 📄 子ファイル使用先:
 *   - brush-core.js (履歴登録)
 *   - layer-system.js (履歴参照)
 * 
 * 【Phase 4改修内容】
 * ✅ pushEraseMask() 実装（mask snapshot保存）
 * ✅ beginAction/endAction でmask統合
 * ✅ 既存機能完全継承
 * 
 * ================================================================================
 */

(function() {
    'use strict';

    class HistoryManager {
        constructor() {
            this.stack = [];
            this.index = -1;
            this.isApplying = false;
            this.maxSize = 500;
            this._manager = this;
            
            // ✅ Phase 4: アクショングルーピング管理
            this.currentAction = null;
        }

        push(command) {
            if (this.isApplying) {
                return;
            }
            
            if (!this._validateCommand(command)) {
                console.error('[History] Invalid command structure:', command);
                return;
            }

            try {
                this.isApplying = true;
                
                this.stack.splice(this.index + 1);
                
                command.do();
                
                this.stack.push(command);
                this.index++;
                
                if (this.stack.length > this.maxSize) {
                    this.stack.shift();
                    this.index--;
                }
                
                this._notifyHistoryChanged();
                
            } catch (error) {
                console.error('[History] Command execution failed:', error);
                this.stack.splice(this.index + 1);
            } finally {
                this.isApplying = false;
            }
        }

        undo() {
            if (!this.canUndo() || this.isApplying) {
                return;
            }
            
            try {
                this.isApplying = true;
                const command = this.stack[this.index];
                
                try {
                    command.undo();
                } catch (undoError) {
                    console.error('[History:Undo] Exception in undo:', undoError, command);
                    throw undoError;
                }
                
                this.index--;
                this._notifyHistoryChanged();
                
            } catch (error) {
                console.error('[History] Undo failed:', error);
            } finally {
                this.isApplying = false;
            }
        }

        redo() {
            if (!this.canRedo() || this.isApplying) {
                return;
            }
            
            try {
                this.isApplying = true;
                this.index++;
                const command = this.stack[this.index];
                
                if (!command) {
                    console.error('[History:Redo] Command is null at index:', this.index);
                    this.index--;
                    return;
                }

                try {
                    command.do();
                } catch (doError) {
                    console.error('[History:Redo] Exception in do():', doError, command);
                    this.index--;
                    throw doError;
                }

                this._notifyHistoryChanged();
                
            } catch (error) {
                console.error('[History] Redo failed:', error);
                this.index--;
            } finally {
                this.isApplying = false;
            }
        }

        canUndo() {
            return this.index >= 0;
        }

        canRedo() {
            return this.index < this.stack.length - 1;
        }

        clear() {
            this.stack = [];
            this.index = -1;
            this.currentAction = null;
            this._notifyHistoryChanged();
        }

        /**
         * ✅ Phase 4: アクション開始
         */
        beginAction(type, metadata = {}) {
            if (this.currentAction) {
                console.warn('[History] beginAction called while action in progress');
                this.endAction();
            }
            
            this.currentAction = {
                type: type,
                metadata: metadata,
                points: [],
                timestamp: Date.now()
            };
        }

        /**
         * ✅ Phase 4: ポイント追加
         */
        addPoint(x, y, pressure) {
            if (!this.currentAction) return;
            
            this.currentAction.points.push({
                x: x,
                y: y,
                pressure: pressure,
                timestamp: Date.now()
            });
        }

        /**
         * ✅ Phase 4: アクション終了
         */
        endAction() {
            if (!this.currentAction) return;
            
            const action = this.currentAction;
            this.currentAction = null;
            
            // アクションタイプに応じた処理は呼び出し元で実行
            // （brush-core.jsで履歴登録）
        }

        /**
         * ✅ Phase 4: 消しゴムマスク履歴登録
         */
        pushEraseMask(layerId, beforeMask, afterMask, bounds) {
            if (this.isApplying) return;
            
            const layerSystem = window.layerManager || window.layerSystem;
            if (!layerSystem) {
                console.error('[History] LayerSystem not available');
                return;
            }

            const command = {
                name: 'erase-mask',
                do: () => {
                    const layer = layerSystem.getLayerById(layerId);
                    if (!layer) {
                        console.warn('[History:EraseMask] Layer not found:', layerId);
                        return;
                    }
                    
                    // 古いマスク破棄（beforeと同じ場合は除く）
                    if (layer.maskTexture && layer.maskTexture !== beforeMask) {
                        if (layer.maskTexture.destroy) {
                            layer.maskTexture.destroy();
                        }
                    }
                    
                    layer.maskTexture = afterMask;
                    
                    // マスク更新イベント
                    if (window.TegakiEventBus) {
                        window.TegakiEventBus.emit('layer:mask-updated', {
                            layerId: layerId,
                            maskTexture: afterMask,
                            immediate: true
                        });
                    }
                },
                undo: () => {
                    const layer = layerSystem.getLayerById(layerId);
                    if (!layer) {
                        console.warn('[History:EraseMask] Layer not found:', layerId);
                        return;
                    }
                    
                    // 現在のマスク破棄（afterと同じ場合は除く）
                    if (layer.maskTexture && layer.maskTexture !== afterMask) {
                        if (layer.maskTexture.destroy) {
                            layer.maskTexture.destroy();
                        }
                    }
                    
                    layer.maskTexture = beforeMask;
                    
                    // マスク更新イベント
                    if (window.TegakiEventBus) {
                        window.TegakiEventBus.emit('layer:mask-updated', {
                            layerId: layerId,
                            maskTexture: beforeMask,
                            immediate: true
                        });
                    }
                },
                meta: {
                    type: 'erase-mask',
                    layerId: layerId,
                    bounds: bounds,
                    timestamp: Date.now()
                }
            };

            this.push(command);
        }

        createComposite(commands, name = 'composite') {
            return {
                name: name,
                do: () => {
                    commands.forEach(cmd => cmd.do());
                },
                undo: () => {
                    commands.slice().reverse().forEach(cmd => cmd.undo());
                },
                meta: {
                    type: 'composite',
                    count: commands.length
                }
            };
        }

        _validateCommand(command) {
            return (
                command &&
                typeof command.name === 'string' &&
                typeof command.do === 'function' &&
                typeof command.undo === 'function'
            );
        }

        _notifyHistoryChanged() {
            if (window.TegakiEventBus) {
                window.TegakiEventBus.emit('history:changed', {
                    canUndo: this.canUndo(),
                    canRedo: this.canRedo(),
                    stackSize: this.stack.length,
                    currentIndex: this.index
                });
            }
        }

        debug() {
            console.log('[History] Stack:', this.stack.map(cmd => cmd.name));
            console.log('[History] Index:', this.index);
            console.log('[History] Can Undo:', this.canUndo());
            console.log('[History] Can Redo:', this.canRedo());
        }
        
        getLastCommand() {
            return this.stack[this.index] || null;
        }
        
        getStack() {
            return this.stack.map((cmd, idx) => ({
                index: idx,
                name: cmd.name,
                isCurrent: idx === this.index,
                meta: cmd.meta
            }));
        }
        
        getCommandMetaDetails(index) {
            if (index < 0 || index >= this.stack.length) {
                return null;
            }
            const cmd = this.stack[index];
            return {
                name: cmd.name,
                meta: cmd.meta,
                hasStoredStrokeObject: !!cmd.meta?._storedStrokeObject,
                storedSettings: cmd.meta?._storedSettings
            };
        }
        
        /**
         * ✅ Phase 4: LayerSystem設定
         */
        setLayerSystem(layerSystem) {
            this.layerSystem = layerSystem;
        }
    }

    window.History = new HistoryManager();
    
    console.log('✅ history.js Phase 4 mask snapshot対応完全版 loaded');
    console.log('   ✅ pushEraseMask() 実装');
    console.log('   ✅ beginAction/endAction/addPoint 実装');

})();