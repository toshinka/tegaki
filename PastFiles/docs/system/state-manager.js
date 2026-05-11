// system/state-manager.js
// ================================================================================
// Phase 2: 階層的State管理の導入 (Export Manager対応版)
// ================================================================================

(function() {
    'use strict';

    class StateManagerClass {
        constructor() {
            // 確実な初期化
            this._nextId = {
                frame: 1,
                layer: 1,
                stroke: 1
            };
            
            this.state = this._createInitialState();
        }

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

        getCurrentFrame() {
            if (!this.state || !this.state.timeline || !this.state.timeline.frames) {
                return null;
            }
            return this.state.timeline.frames.find(
                f => f.id === this.state.timeline.currentFrameId
            ) || null;
        }

        getCurrentLayer() {
            const frame = this.getCurrentFrame();
            if (!frame || !frame.layers) return null;
            return frame.layers[this.state.ui.activeLayerIndex] || null;
        }

        getLayerById(layerId) {
            if (!this.state || !this.state.timeline || !this.state.timeline.frames) {
                return null;
            }
            for (const frame of this.state.timeline.frames) {
                if (!frame.layers) continue;
                const layer = frame.layers.find(l => l.id === layerId);
                if (layer) return layer;
            }
            return null;
        }

        getStrokeById(strokeId) {
            if (!this.state || !this.state.timeline || !this.state.timeline.frames) {
                return null;
            }
            for (const frame of this.state.timeline.frames) {
                if (!frame.layers) continue;
                for (const layer of frame.layers) {
                    if (!layer.strokes) continue;
                    const stroke = layer.strokes.find(s => s.id === strokeId);
                    if (stroke) return stroke;
                }
            }
            return null;
        }

        addStroke(strokeData) {
            const layer = this.getCurrentLayer();
            if (!layer) {
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
                    if (window.TegakiEventBus) {
                        window.TegakiEventBus.emit('stroke:added', { layerId: layer.id, stroke });
                    }
                },
                undo: () => {
                    const index = layer.strokes.findIndex(s => s.id === strokeId);
                    if (index !== -1) {
                        layer.strokes.splice(index, 1);
                        if (window.TegakiEventBus) {
                            window.TegakiEventBus.emit('stroke:removed', { layerId: layer.id, strokeId });
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
                    if (window.TegakiEventBus) {
                        window.TegakiEventBus.emit('layer:created', { frameId: frame.id, layer });
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
                        if (window.TegakiEventBus) {
                            window.TegakiEventBus.emit('layer:removed', { frameId: frame.id, layerId });
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
                    if (window.TegakiEventBus) {
                        window.TegakiEventBus.emit('layer:removed', { frameId: frame.id, layerId });
                    }
                },
                undo: () => {
                    frame.layers.splice(layerIndex, 0, layerSnapshot);
                    this.state.ui.activeLayerIndex = layerIndex;
                    if (window.TegakiEventBus) {
                        window.TegakiEventBus.emit('layer:restored', { frameId: frame.id, layer: layerSnapshot });
                    }
                },
                meta: { type: 'layer-delete', layerId }
            };

            if (window.History) {
                window.History.push(command);
            }
            return true;
        }

        setUIProperty(key, value) {
            if (!this.state || !this.state.ui) return;
            this.state.ui[key] = value;
            if (window.TegakiEventBus) {
                window.TegakiEventBus.emit('ui:property-changed', { key, value });
            }
        }

        setActiveLayerIndex(index) {
            const frame = this.getCurrentFrame();
            if (!frame || index < 0 || index >= frame.layers.length) {
                return false;
            }
            this.state.ui.activeLayerIndex = index;
            if (window.TegakiEventBus) {
                window.TegakiEventBus.emit('layer:active-changed', { index });
            }
            return true;
        }

        getState() {
            return this.state;
        }

        setState(newState) {
            this.state = structuredClone(newState);
            if (window.TegakiEventBus) {
                window.TegakiEventBus.emit('state:replaced', this.state);
            }
        }

        _generateId(type) {
            // 安全性チェック
            if (!this._nextId) {
                this._nextId = {
                    frame: 1,
                    layer: 1,
                    stroke: 1
                };
            }
            
            if (!this._nextId[type]) {
                this._nextId[type] = 1;
            }
            
            const id = `${type}_${String(this._nextId[type]).padStart(3, '0')}`;
            this._nextId[type]++;
            return id;
        }

        debug() {
            console.log('[StateManager] State:', this.state);
            console.log('[StateManager] Current Frame:', this.getCurrentFrame());
            console.log('[StateManager] Current Layer:', this.getCurrentLayer());
            console.log('[StateManager] _nextId:', this._nextId);
        }
    }

    window.StateManager = new StateManagerClass();
    console.log('✅ state-manager.js (Export Manager対応版) loaded');

})();