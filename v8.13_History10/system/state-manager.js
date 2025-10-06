// ===== system/state-manager.js - Phase 2: 階層的State管理 =====
//
// ========== Phase 2: 改修内容 START ==========
// State構造の階層化: timeline → frames → layers → strokes
// 全stateを一元管理してデータ散在を防ぐ
// PixiJSオブジェクトとstateを完全分離
// ========== Phase 2: 改修内容 END ==========

(function() {
    'use strict';

    class StateManager {
        constructor() {
            this.state = this._createInitialState();
            this._nextId = {
                frame: 1,
                layer: 1,
                stroke: 1
            };
        }

        /**
         * 初期state生成
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
            );
        }

        /**
         * 現在のレイヤーを取得
         */
        getCurrentLayer() {
            const frame = this.getCurrentFrame();
            if (!frame) return null;
            return frame.layers[this.state.ui.activeLayerIndex];
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
                ...strokeData
            };

            const command = {
                name: 'draw-stroke',
                do: () => {
                    layer.strokes.push(stroke);
                    if (window.EventBus) {
                        window.EventBus.emit('stroke:added', { layerId: layer.id, stroke });
                    }
                },
                undo: () => {
                    const index = layer.strokes.findIndex(s => s.id === strokeId);
                    if (index !== -1) {
                        layer.strokes.splice(index, 1);
                        if (window.EventBus) {
                            window.EventBus.emit('stroke:removed', { layerId: layer.id, strokeId });
                        }
                    }
                },
                meta: { type: 'stroke', layerId: layer.id, strokeId }
            };

            if (window.History) {
                window.History.push(command);
            }
            return stroke;
        }

        /**
         * レイヤーを追加（履歴記録付き）
         */
        addLayer(name = null) {
            const frame = this.getCurrentFrame();
            if (!frame) return null;

            const layerId = this._generateId('layer');
            const layerName = name || `Layer ${this._nextId.layer}`;
            
            const layer = {
                id: layerId,
                name: layerName,
                type: 'vector',
                visible: true,
                opacity: 1.0,
                locked: false,
                transform: { x: 0, y: 0, scaleX: 1.0, scaleY: 1.0, rotation: 0 },
                strokes: [],
                bitmap: null
            };

            const command = {
                name: 'create-layer',
                do: () => {
                    frame.layers.push(layer);
                    this.state.ui.activeLayerIndex = frame.layers.length - 1;
                    if (window.EventBus) {
                        window.EventBus.emit('layer:created', { frameId: frame.id, layer });
                    }
                },
                undo: () => {
                    const index = frame.layers.findIndex(l => l.id === layerId);
                    if (index !== -1) {
                        frame.layers.splice(index, 1);
                        this.state.ui.activeLayerIndex = Math.min(
                            this.state.ui.activeLayerIndex,
                            frame.layers.length - 1
                        );
                        if (window.EventBus) {
                            window.EventBus.emit('layer:removed', { frameId: frame.id, layerId });
                        }
                    }
                },
                meta: { type: 'layer', layerId }
            };

            if (window.History) {
                window.History.push(command);
            }
            return layer;
        }

        /**
         * レイヤーを削除（履歴記録付き）
         */
        removeLayer(layerId) {
            const frame = this.getCurrentFrame();
            if (!frame || frame.layers.length <= 1) return false;

            const layerIndex = frame.layers.findIndex(l => l.id === layerId);
            if (layerIndex === -1) return false;

            const layerSnapshot = structuredClone(frame.layers[layerIndex]);

            const command = {
                name: 'delete-layer',
                do: () => {
                    frame.layers.splice(layerIndex, 1);
                    this.state.ui.activeLayerIndex = Math.min(
                        this.state.ui.activeLayerIndex,
                        frame.layers.length - 1
                    );
                    if (window.EventBus) {
                        window.EventBus.emit('layer:removed', { frameId: frame.id, layerId });
                    }
                },
                undo: () => {
                    frame.layers.splice(layerIndex, 0, layerSnapshot);
                    this.state.ui.activeLayerIndex = layerIndex;
                    if (window.EventBus) {
                        window.EventBus.emit('layer:restored', { frameId: frame.id, layer: layerSnapshot });
                    }
                },
                meta: { type: 'layer-delete', layerId }
            };

            if (window.History) {
                window.History.push(command);
            }
            return true;
        }

        /**
         * UIプロパティを更新（履歴記録なし）
         */
        setUIProperty(key, value) {
            this.state.ui[key] = value;
            if (window.EventBus) {
                window.EventBus.emit('ui:property-changed', { key, value });
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
            if (window.EventBus) {
                window.EventBus.emit('layer:active-changed', { index });
            }
            return true;
        }

        /**
         * State全体を取得（読み取り専用）
         */
        getState() {
            return this.state;
        }

        /**
         * State全体を置き換え（JSON読み込み用）
         */
        setState(newState) {
            this.state = structuredClone(newState);
            if (window.EventBus) {
                window.EventBus.emit('state:replaced', this.state);
            }
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
         * デバッグ用
         */
        debug() {
            console.log('[StateManager] State:', this.state);
            console.log('[StateManager] Current Frame:', this.getCurrentFrame());
            console.log('[StateManager] Current Layer:', this.getCurrentLayer());
        }
    }

    // ========== Phase 2: 修正 - インスタンス名を変更 ==========
    const stateManagerInstance = new StateManager();
    window.StateManager = stateManagerInstance;

})();