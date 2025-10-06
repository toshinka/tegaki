// system/state-manager.js
// ================================================================================
// Phase 2: 階層的State管理の導入
// ================================================================================
// 改修内容:
// - timeline → frames → layers → strokes の階層構造
// - PixiJSオブジェクトとstateの完全分離
// - 全操作を履歴記録可能に (History連携)
// - JSONシリアライズ可能な構造 (Source of Truth)
// ================================================================================

(function() {
    'use strict';

    class StateManagerClass {
        constructor() {
            // ========== Phase 2: 改修 START ==========
            this.state = this._createInitialState();
            this._nextId = {
                frame: 1,
                layer: 1,
                stroke: 1
            };
            // ========== Phase 2: 改修 END ==========
        }

        /**
         * 初期state生成
         * @private
         */
        _createInitialState() {
            // ========== Phase 2: 改修 START ==========
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
            // ========== Phase 2: 改修 END ==========
        }

        /**
         * 現在のフレームを取得
         * @returns {Object|null}
         */
        getCurrentFrame() {
            // ========== Phase 2: 改修 START ==========
            return this.state.timeline.frames.find(
                f => f.id === this.state.timeline.currentFrameId
            ) || null;
            // ========== Phase 2: 改修 END ==========
        }

        /**
         * 現在のレイヤーを取得
         * @returns {Object|null}
         */
        getCurrentLayer() {
            // ========== Phase 2: 改修 START ==========
            const frame = this.getCurrentFrame();
            if (!frame) return null;
            return frame.layers[this.state.ui.activeLayerIndex] || null;
            // ========== Phase 2: 改修 END ==========
        }

        /**
         * IDでレイヤーを検索
         * @param {string} layerId
         * @returns {Object|null}
         */
        getLayerById(layerId) {
            // ========== Phase 2: 改修 START ==========
            for (const frame of this.state.timeline.frames) {
                const layer = frame.layers.find(l => l.id === layerId);
                if (layer) return layer;
            }
            return null;
            // ========== Phase 2: 改修 END ==========
        }

        /**
         * IDでストロークを検索
         * @param {string} strokeId
         * @returns {Object|null}
         */
        getStrokeById(strokeId) {
            // ========== Phase 2: 改修 START ==========
            for (const frame of this.state.timeline.frames) {
                for (const layer of frame.layers) {
                    const stroke = layer.strokes.find(s => s.id === strokeId);
                    if (stroke) return stroke;
                }
            }
            return null;
            // ========== Phase 2: 改修 END ==========
        }

        /**
         * ストロークを追加 (履歴記録付き)
         * @param {Object} strokeData - { tool, color, width, opacity, points, isComplete }
         * @returns {Object|null} 追加されたストローク
         */
        addStroke(strokeData) {
            // ========== Phase 2: 改修 START ==========
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
                        EventBus.emit('stroke:added', { layerId: layer.id, stroke });
                    }
                },
                undo: () => {
                    const index = layer.strokes.findIndex(s => s.id === strokeId);
                    if (index !== -1) {
                        layer.strokes.splice(index, 1);
                        if (window.EventBus) {
                            EventBus.emit('stroke:removed', { layerId: layer.id, strokeId });
                        }
                    }
                },
                meta: { type: 'stroke', layerId: layer.id, strokeId }
            };

            if (window.History) {
                History.push(command);
            }
            return stroke;
            // ========== Phase 2: 改修 END ==========
        }

        /**
         * レイヤーを追加 (履歴記録付き)
         * @param {string|null} name - レイヤー名
         * @returns {Object|null}
         */
        addLayer(name = null) {
            // ========== Phase 2: 改修 START ==========
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
                        EventBus.emit('layer:created', { frameId: frame.id, layer });
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
                            EventBus.emit('layer:removed', { frameId: frame.id, layerId });
                        }
                    }
                },
                meta: { type: 'layer', layerId }
            };

            if (window.History) {
                History.push(command);
            }
            return layer;
            // ========== Phase 2: 改修 END ==========
        }

        /**
         * レイヤーを削除 (履歴記録付き)
         * @param {string} layerId
         * @returns {boolean}
         */
        removeLayer(layerId) {
            // ========== Phase 2: 改修 START ==========
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
                        EventBus.emit('layer:removed', { frameId: frame.id, layerId });
                    }
                },
                undo: () => {
                    frame.layers.splice(layerIndex, 0, layerSnapshot);
                    this.state.ui.activeLayerIndex = layerIndex;
                    if (window.EventBus) {
                        EventBus.emit('layer:restored', { frameId: frame.id, layer: layerSnapshot });
                    }
                },
                meta: { type: 'layer-delete', layerId }
            };

            if (window.History) {
                History.push(command);
            }
            return true;
            // ========== Phase 2: 改修 END ==========
        }

        /**
         * UIプロパティを更新 (履歴記録なし)
         * @param {string} key
         * @param {*} value
         */
        setUIProperty(key, value) {
            // ========== Phase 2: 改修 START ==========
            this.state.ui[key] = value;
            if (window.EventBus) {
                EventBus.emit('ui:property-changed', { key, value });
            }
            // ========== Phase 2: 改修 END ==========
        }

        /**
         * アクティブレイヤーを変更 (履歴記録なし)
         * @param {number} index
         * @returns {boolean}
         */
        setActiveLayerIndex(index) {
            // ========== Phase 2: 改修 START ==========
            const frame = this.getCurrentFrame();
            if (!frame || index < 0 || index >= frame.layers.length) {
                return false;
            }
            this.state.ui.activeLayerIndex = index;
            if (window.EventBus) {
                EventBus.emit('layer:active-changed', { index });
            }
            return true;
            // ========== Phase 2: 改修 END ==========
        }

        /**
         * State全体を取得 (読み取り専用)
         * @returns {Object}
         */
        getState() {
            // ========== Phase 2: 改修 START ==========
            return this.state;
            // ========== Phase 2: 改修 END ==========
        }

        /**
         * State全体を置き換え (JSON読み込み用)
         * @param {Object} newState
         */
        setState(newState) {
            // ========== Phase 2: 改修 START ==========
            this.state = structuredClone(newState);
            if (window.EventBus) {
                EventBus.emit('state:replaced', this.state);
            }
            // ========== Phase 2: 改修 END ==========
        }

        /**
         * ID生成
         * @private
         * @param {string} type - 'frame' | 'layer' | 'stroke'
         * @returns {string}
         */
        _generateId(type) {
            // ========== Phase 2: 改修 START ==========
            const id = `${type}_${String(this._nextId[type]).padStart(3, '0')}`;
            this._nextId[type]++;
            return id;
            // ========== Phase 2: 改修 END ==========
        }

        /**
         * デバッグ用
         */
        debug() {
            // ========== Phase 2: 改修 START ==========
            console.log('[StateManager] State:', this.state);
            console.log('[StateManager] Current Frame:', this.getCurrentFrame());
            console.log('[StateManager] Current Layer:', this.getCurrentLayer());
            // ========== Phase 2: 改修 END ==========
        }
    }

    // ========== Phase 2: 改修 START ==========
    // グローバルインスタンス生成
    window.StateManager = new StateManagerClass();
    // ========== Phase 2: 改修 END ==========

})();