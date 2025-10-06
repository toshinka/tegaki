/**
 * ============================================================================
 * State Manager - Hierarchical State Management
 * ============================================================================
 * Phase 2: 階層的State構造 + History連携
 * 
 * 【State構造】
 * timeline → frames → layers → strokes
 * 
 * 【設計原則】
 * - State = Source of Truth（全てのデータの正）
 * - PixiJSオブジェクトはStateから再構築可能
 * - StateにPixiJS参照を含めない（JSONシリアライズ可能）
 * - 履歴記録はHistory.push()経由で自動化
 * 
 * ============================================================================
 */

(function() {
    'use strict';
    
    // 既存のインスタンスがある場合は再利用（二重宣言防止）
    if (window.StateManager && window.StateManager.state) {
        console.log('✅ system/state-manager.js already loaded');
        return;
    }
    
    class StateManager {
        constructor() {
            // ========== Phase 2: 改修 START ==========
            
            /**
             * 階層的State構造
             * timeline → frames → layers → strokes
             */
            this.state = this._createInitialState();
            
            /**
             * ID生成カウンター
             */
            this._nextId = {
                frame: 1,
                layer: 1,
                stroke: 1
            };
            
            /**
             * 変更リスナー（オプション機能）
             */
            this._listeners = new Set();
            
            // ========== Phase 2: 改修 END ==========
        }

        /**
         * 初期State生成
         * @private
         */
        _createInitialState() {
            const initialFrameId = this._generateId('frame');
            const initialLayerId = this._generateId('layer');
            
            return {
                timeline: {
                    currentFrameId: initialFrameId,
                    frames: [
                        {
                            id: initialFrameId,
                            name: 'Frame 1',
                            duration: 1,
                            layers: [
                                {
                                    id: initialLayerId,
                                    name: 'Layer 1',
                                    type: 'vector',
                                    visible: true,
                                    opacity: 1.0,
                                    locked: false,
                                    transform: {
                                        x: 0,
                                        y: 0,
                                        scaleX: 1.0,
                                        scaleY: 1.0,
                                        rotation: 0
                                    },
                                    strokes: [],
                                    bitmap: null
                                }
                            ]
                        }
                    ]
                },
                ui: {
                    activeLayerIndex: 0,
                    selectedTool: 'pen',
                    brushSize: 2,
                    brushColor: '#000000',
                    brushOpacity: 1.0
                }
            };
        }

        /**
         * 現在のフレームを取得
         */
        getCurrentFrame() {
            return this.state.timeline.frames.find(
                f => f.id === this.state.timeline.currentFrameId
            ) || null;
        }

        /**
         * 現在のレイヤーを取得
         */
        getCurrentLayer() {
            const frame = this.getCurrentFrame();
            if (!frame) return null;
            
            const layerIndex = this.state.ui.activeLayerIndex;
            if (layerIndex < 0 || layerIndex >= frame.layers.length) {
                return null;
            }
            
            return frame.layers[layerIndex];
        }

        /**
         * IDでレイヤーを検索
         */
        getLayerById(layerId) {
            for (const frame of this.state.timeline.frames) {
                const layer = frame.layers.find(l => l.id === layerId);
                if (layer) return layer;
            }
            return null;
        }

        /**
         * IDでストロークを検索
         */
        getStrokeById(strokeId) {
            for (const frame of this.state.timeline.frames) {
                for (const layer of frame.layers) {
                    const stroke = layer.strokes.find(s => s.id === strokeId);
                    if (stroke) return stroke;
                }
            }
            return null;
        }

        /**
         * ストロークを追加（履歴記録付き）
         */
        addStroke(strokeData) {
            const layer = this.getCurrentLayer();
            if (!layer) {
                console.error('[StateManager] No active layer');
                return null;
            }

            const strokeId = this._generateId('stroke');
            const stroke = {
                id: strokeId,
                tool: strokeData.tool || 'pen',
                color: strokeData.color || '#000000',
                width: strokeData.width || 2,
                opacity: strokeData.opacity || 1.0,
                points: strokeData.points || [],
                isComplete: strokeData.isComplete || false,
                ...strokeData
            };

            const layerId = layer.id;

            const command = {
                name: 'draw-stroke',
                do: () => {
                    const targetLayer = this.getLayerById(layerId);
                    if (targetLayer) {
                        targetLayer.strokes.push(stroke);
                    }
                    this._emitEvent('stroke:added', { layerId, stroke });
                },
                undo: () => {
                    const targetLayer = this.getLayerById(layerId);
                    if (targetLayer) {
                        const index = targetLayer.strokes.findIndex(s => s.id === strokeId);
                        if (index !== -1) {
                            targetLayer.strokes.splice(index, 1);
                        }
                    }
                    this._emitEvent('stroke:removed', { layerId, strokeId });
                },
                meta: { type: 'stroke', layerId, strokeId }
            };

            if (window.History) {
                window.History.push(command);
            } else {
                console.warn('[StateManager] History not available');
                command.do();
            }

            return stroke;
        }

        /**
         * レイヤーを追加（履歴記録付き）
         */
        addLayer(name = null) {
            const frame = this.getCurrentFrame();
            if (!frame) {
                console.error('[StateManager] No current frame');
                return null;
            }

            const layerId = this._generateId('layer');
            const layerName = name || `Layer ${this._nextId.layer}`;
            
            const layer = {
                id: layerId,
                name: layerName,
                type: 'vector',
                visible: true,
                opacity: 1.0,
                locked: false,
                transform: {
                    x: 0,
                    y: 0,
                    scaleX: 1.0,
                    scaleY: 1.0,
                    rotation: 0
                },
                strokes: [],
                bitmap: null
            };

            const frameId = frame.id;

            const command = {
                name: 'create-layer',
                do: () => {
                    const targetFrame = this.state.timeline.frames.find(f => f.id === frameId);
                    if (targetFrame) {
                        targetFrame.layers.push(layer);
                        this.state.ui.activeLayerIndex = targetFrame.layers.length - 1;
                    }
                    this._emitEvent('layer:created', { frameId, layer });
                },
                undo: () => {
                    const targetFrame = this.state.timeline.frames.find(f => f.id === frameId);
                    if (targetFrame) {
                        const index = targetFrame.layers.findIndex(l => l.id === layerId);
                        if (index !== -1) {
                            targetFrame.layers.splice(index, 1);
                            this.state.ui.activeLayerIndex = Math.min(
                                this.state.ui.activeLayerIndex,
                                targetFrame.layers.length - 1
                            );
                        }
                    }
                    this._emitEvent('layer:removed', { frameId, layerId });
                },
                meta: { type: 'layer', layerId }
            };

            if (window.History) {
                window.History.push(command);
            } else {
                console.warn('[StateManager] History not available');
                command.do();
            }

            return layer;
        }

        /**
         * レイヤーを削除（履歴記録付き）
         */
        removeLayer(layerId) {
            const frame = this.getCurrentFrame();
            if (!frame || frame.layers.length <= 1) {
                console.warn('[StateManager] Cannot remove last layer');
                return false;
            }

            const layerIndex = frame.layers.findIndex(l => l.id === layerId);
            if (layerIndex === -1) {
                console.error('[StateManager] Layer not found:', layerId);
                return false;
            }

            const layerSnapshot = structuredClone(frame.layers[layerIndex]);
            const frameId = frame.id;

            const command = {
                name: 'delete-layer',
                do: () => {
                    const targetFrame = this.state.timeline.frames.find(f => f.id === frameId);
                    if (targetFrame) {
                        const index = targetFrame.layers.findIndex(l => l.id === layerId);
                        if (index !== -1) {
                            targetFrame.layers.splice(index, 1);
                            this.state.ui.activeLayerIndex = Math.min(
                                this.state.ui.activeLayerIndex,
                                targetFrame.layers.length - 1
                            );
                        }
                    }
                    this._emitEvent('layer:removed', { frameId, layerId });
                },
                undo: () => {
                    const targetFrame = this.state.timeline.frames.find(f => f.id === frameId);
                    if (targetFrame) {
                        targetFrame.layers.splice(layerIndex, 0, layerSnapshot);
                        this.state.ui.activeLayerIndex = layerIndex;
                    }
                    this._emitEvent('layer:restored', { frameId, layer: layerSnapshot });
                },
                meta: { type: 'layer-delete', layerId }
            };

            if (window.History) {
                window.History.push(command);
            } else {
                console.warn('[StateManager] History not available');
                command.do();
            }

            return true;
        }

        /**
         * UIプロパティを更新（履歴記録なし）
         */
        setUIProperty(key, value) {
            if (key in this.state.ui) {
                this.state.ui[key] = value;
                this._emitEvent('ui:property-changed', { key, value });
            } else {
                console.warn('[StateManager] Unknown UI property:', key);
            }
        }

        /**
         * アクティブレイヤーを変更（履歴記録なし）
         */
        setActiveLayerIndex(index) {
            const frame = this.getCurrentFrame();
            if (!frame || index < 0 || index >= frame.layers.length) {
                return false;
            }
            
            this.state.ui.activeLayerIndex = index;
            this._emitEvent('layer:active-changed', { index });
            return true;
        }

        /**
         * State全体を取得（読み取り専用）
         */
        getState() {
            return structuredClone(this.state);
        }

        /**
         * State全体を置き換え（JSON読み込み用）
         */
        setState(newState) {
            if (!this._validateState(newState)) {
                console.error('[StateManager] Invalid state structure');
                return;
            }
            
            this.state = structuredClone(newState);
            this._emitEvent('state:replaced', this.state);
        }

        /**
         * イベント発火
         * @private
         */
        _emitEvent(eventName, data) {
            if (window.EventBus || window.TegakiEventBus) {
                const eventBus = window.EventBus || window.TegakiEventBus;
                eventBus.emit(eventName, data);
            }
            
            this._listeners.forEach(listener => {
                try {
                    listener(eventName, data);
                } catch (error) {
                    console.error('[StateManager] Listener error:', error);
                }
            });
        }

        /**
         * リスナーを追加
         */
        addListener(callback) {
            if (typeof callback !== 'function') {
                console.error('[StateManager] Listener must be a function');
                return () => {};
            }
            
            this._listeners.add(callback);
            return () => this.removeListener(callback);
        }

        /**
         * リスナーを削除
         */
        removeListener(callback) {
            this._listeners.delete(callback);
        }

        /**
         * ID生成
         * @private
         */
        _generateId(type) {
            const id = `${type}_${String(this._nextId[type]).padStart(3, '0')}`;
            this._nextId[type]++;
            return id;
        }

        /**
         * State構造の検証
         * @private
         */
        _validateState(state) {
            if (!state || typeof state !== 'object') {
                return false;
            }
            
            if (!state.timeline || !Array.isArray(state.timeline.frames)) {
                return false;
            }
            
            if (state.timeline.frames.length === 0) {
                return false;
            }
            
            for (const frame of state.timeline.frames) {
                if (!frame.id || !Array.isArray(frame.layers)) {
                    return false;
                }
                
                for (const layer of frame.layers) {
                    if (!layer.id || !Array.isArray(layer.strokes)) {
                        return false;
                    }
                }
            }
            
            return true;
        }

        /**
         * デバッグ用: State情報表示
         */
        debug() {
            console.group('[StateManager] Debug Info');
            console.log('State:', this.state);
            console.log('Current Frame:', this.getCurrentFrame());
            console.log('Current Layer:', this.getCurrentLayer());
            console.log('Active Layer Index:', this.state.ui.activeLayerIndex);
            console.log('Listeners Count:', this._listeners.size);
            
            const stateJson = JSON.stringify(this.state);
            console.log('State Size:', stateJson.length, 'bytes');
            console.log('State Size:', (stateJson.length / 1024).toFixed(2), 'KB');
            
            console.groupEnd();
        }
    }

    // ========== Phase 2: 改修 START ==========
    
    // グローバルインスタンス生成（二重宣言を回避）
    window.StateManager = new StateManager();
    
    // 開発環境でのデバッグ用
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        window.StateDebug = () => window.StateManager.debug();
    }
    
    console.log('✅ system/state-manager.js Phase 2 loaded');
    
    // ========== Phase 2: 改修 END ==========
    
})();