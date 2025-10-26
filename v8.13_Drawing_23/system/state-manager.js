/**
 * StateManager - アプリケーション状態の一元管理
 * Phase 3.1: Cuts対応版 + History統合完備 + Tool Size管理追加 + EventBus安全化
 */

class StateManager {
    constructor() {
        this.state = this._createInitialState();
        this._eventBus = null;
        this.history = null;
    }

    /**
     * EventBusの遅延取得（安全なアクセス）
     */
    get eventBus() {
        if (!this._eventBus) {
            this._eventBus = window.EventBus || window.TegakiEventBus;
        }
        return this._eventBus;
    }

    /**
     * EventBus emitの安全な呼び出し
     */
    _safeEmit(eventName, data) {
        if (this.eventBus && typeof this.eventBus.emit === 'function') {
            this.eventBus.emit(eventName, data);
        }
    }

    /**
     * 初期状態の作成（Cuts構造 + Tool Size）
     */
    _createInitialState() {
        const initialCutId = this._generateId('cut');
        const initialLayerId = this._generateId('layer');

        return {
            timeline: {
                currentCutId: initialCutId,
                cuts: [
                    {
                        id: initialCutId,
                        name: 'CUT1',
                        duration: 0.5,
                        layers: [
                            {
                                id: initialLayerId,
                                name: 'Layer 1',
                                visible: true,
                                locked: false,
                                opacity: 1.0,
                                strokes: []
                            }
                        ],
                        activeLayerIndex: 0
                    }
                ]
            },
            tool: {
                currentTool: 'pen',
                color: '#000000',
                lineWidth: 2,
                opacity: 1.0,
                // ツールサイズ管理
                penSize: 10,
                penOpacity: 0.85,
                eraserSize: 20,
                eraserOpacity: 1.0
            }
        };
    }

    /**
     * ID生成
     */
    _generateId(prefix) {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // ===== Tool Size API =====

    getCurrentTool() {
        return this.state.tool.currentTool;
    }

    setCurrentTool(tool) {
        this.state.tool.currentTool = tool;
        this._safeEmit('tool:change', { tool });
    }

    getPenSize() {
        return this.state.tool.penSize;
    }

    setPenSize(size) {
        this.state.tool.penSize = size;
        this._safeEmit('toolSize:change', { tool: 'pen', size });
    }

    getPenOpacity() {
        return this.state.tool.penOpacity;
    }

    setPenOpacity(opacity) {
        this.state.tool.penOpacity = opacity;
        this._safeEmit('toolOpacity:change', { tool: 'pen', opacity });
    }

    getEraserSize() {
        return this.state.tool.eraserSize;
    }

    setEraserSize(size) {
        this.state.tool.eraserSize = size;
        this._safeEmit('eraserSize:change', { tool: 'eraser', size });
    }

    getEraserOpacity() {
        return this.state.tool.eraserOpacity;
    }

    setEraserOpacity(opacity) {
        this.state.tool.eraserOpacity = opacity;
        this._safeEmit('eraserOpacity:change', { tool: 'eraser', opacity });
    }

    // ===== Cut Management =====

    /**
     * 現在のCutを取得
     */
    getCurrentCut() {
        const cut = this.state.timeline.cuts.find(
            c => c.id === this.state.timeline.currentCutId
        );
        if (!cut) {
            return this.state.timeline.cuts[0];
        }
        return cut;
    }

    /**
     * IDでCutを取得
     */
    getCutById(cutId) {
        return this.state.timeline.cuts.find(c => c.id === cutId);
    }

    /**
     * CutのIndexを取得
     */
    getCutIndex(cutId) {
        return this.state.timeline.cuts.findIndex(c => c.id === cutId);
    }

    /**
     * Cutの総数を取得
     */
    getCutCount() {
        return this.state.timeline.cuts.length;
    }

    /**
     * 全Cutを取得
     */
    getAllCuts() {
        return this.state.timeline.cuts;
    }

    /**
     * 現在のCutを設定
     */
    setCurrentCutId(cutId) {
        const cut = this.getCutById(cutId);
        if (!cut) {
            console.error('Cut not found:', cutId);
            return;
        }
        
        this.state.timeline.currentCutId = cutId;
        this._safeEmit('cut:selected', { cutId });
    }

    /**
     * 現在のCutをIndexで設定
     */
    setCurrentCutIndex(index) {
        if (index < 0 || index >= this.state.timeline.cuts.length) {
            console.error('Invalid cut index:', index);
            return;
        }
        
        const cutId = this.state.timeline.cuts[index].id;
        this.setCurrentCutId(cutId);
    }

    /**
     * Cut追加（History統合）
     */
    addCut(name) {
        if (!this.history) {
            this.history = window.History;
        }

        const cutId = this._generateId('cut');
        const layerId = this._generateId('layer');
        const index = this.state.timeline.cuts.length;

        const cut = {
            id: cutId,
            name: name || `CUT${index + 1}`,
            duration: 0.5,
            layers: [
                {
                    id: layerId,
                    name: 'Layer 1',
                    visible: true,
                    locked: false,
                    opacity: 1.0,
                    strokes: []
                }
            ],
            activeLayerIndex: 0
        };

        const command = {
            name: 'add-cut',
            do: () => {
                this.state.timeline.cuts.push(cut);
                this._safeEmit('cut:created', { cutId, cut, index });
            },
            undo: () => {
                const idx = this.getCutIndex(cutId);
                if (idx !== -1) {
                    this.state.timeline.cuts.splice(idx, 1);
                    this._safeEmit('cut:deleted', { cutId, index: idx });
                    
                    if (this.state.timeline.currentCutId === cutId) {
                        const newIndex = Math.max(0, idx - 1);
                        if (this.state.timeline.cuts[newIndex]) {
                            this.setCurrentCutIndex(newIndex);
                        }
                    }
                }
            },
            meta: { type: 'cut', cutId }
        };

        if (this.history) {
            this.history.push(command);
        } else {
            command.do();
        }
        return cut;
    }

    /**
     * Cut削除（History統合）
     */
    removeCut(cutId) {
        if (!this.history) {
            this.history = window.History;
        }

        const index = this.getCutIndex(cutId);
        if (index === -1) {
            console.error('Cut not found:', cutId);
            return;
        }

        if (this.state.timeline.cuts.length <= 1) {
            console.warn('Cannot delete the last cut');
            return;
        }

        const cut = { ...this.state.timeline.cuts[index] };
        const wasCurrentCut = this.state.timeline.currentCutId === cutId;

        const command = {
            name: 'remove-cut',
            do: () => {
                this.state.timeline.cuts.splice(index, 1);
                this._safeEmit('cut:deleted', { cutId, index });

                if (wasCurrentCut) {
                    const newIndex = Math.min(index, this.state.timeline.cuts.length - 1);
                    this.setCurrentCutIndex(newIndex);
                }
            },
            undo: () => {
                this.state.timeline.cuts.splice(index, 0, cut);
                this._safeEmit('cut:created', { cutId, cut, index });

                if (wasCurrentCut) {
                    this.setCurrentCutId(cutId);
                }
            },
            meta: { type: 'cut', cutId }
        };

        if (this.history) {
            this.history.push(command);
        } else {
            command.do();
        }
    }

    /**
     * Cut並び替え（History統合）
     */
    reorderCuts(fromIndex, toIndex) {
        if (!this.history) {
            this.history = window.History;
        }

        if (fromIndex === toIndex) return;
        if (fromIndex < 0 || fromIndex >= this.state.timeline.cuts.length) return;
        if (toIndex < 0 || toIndex >= this.state.timeline.cuts.length) return;

        const command = {
            name: 'reorder-cuts',
            do: () => {
                const [cut] = this.state.timeline.cuts.splice(fromIndex, 1);
                this.state.timeline.cuts.splice(toIndex, 0, cut);
                this._safeEmit('cuts:reordered', { fromIndex, toIndex });
            },
            undo: () => {
                const [cut] = this.state.timeline.cuts.splice(toIndex, 1);
                this.state.timeline.cuts.splice(fromIndex, 0, cut);
                this._safeEmit('cuts:reordered', { fromIndex: toIndex, toIndex: fromIndex });
            },
            meta: { type: 'cut-reorder' }
        };

        if (this.history) {
            this.history.push(command);
        } else {
            command.do();
        }
    }

    /**
     * Cut名前変更
     */
    updateCutName(cutId, name) {
        if (!this.history) {
            this.history = window.History;
        }

        const cut = this.getCutById(cutId);
        if (!cut) return;

        const oldName = cut.name;

        const command = {
            name: 'update-cut-name',
            do: () => {
                cut.name = name;
                this._safeEmit('cut:updated', { cutId, name });
            },
            undo: () => {
                cut.name = oldName;
                this._safeEmit('cut:updated', { cutId, name: oldName });
            },
            meta: { type: 'cut', cutId }
        };

        if (this.history) {
            this.history.push(command);
        } else {
            command.do();
        }
    }

    /**
     * Cut時間変更
     */
    updateCutDuration(cutId, duration) {
        if (!this.history) {
            this.history = window.History;
        }

        const cut = this.getCutById(cutId);
        if (!cut) return;

        const oldDuration = cut.duration;

        const command = {
            name: 'update-cut-duration',
            do: () => {
                cut.duration = duration;
                this._safeEmit('cut:updated', { cutId, duration });
            },
            undo: () => {
                cut.duration = oldDuration;
                this._safeEmit('cut:updated', { cutId, duration: oldDuration });
            },
            meta: { type: 'cut', cutId }
        };

        if (this.history) {
            this.history.push(command);
        } else {
            command.do();
        }
    }

    /**
     * Cutにレイヤー追加（History統合）
     */
    addLayerToCut(cutId, name) {
        if (!this.history) {
            this.history = window.History;
        }

        const cut = this.getCutById(cutId);
        if (!cut) {
            console.error('Cut not found:', cutId);
            return;
        }

        const layerId = this._generateId('layer');
        const index = cut.layers.length;

        const layer = {
            id: layerId,
            name: name || `Layer ${index + 1}`,
            visible: true,
            locked: false,
            opacity: 1.0,
            strokes: []
        };

        const command = {
            name: 'add-layer',
            do: () => {
                cut.layers.push(layer);
                cut.activeLayerIndex = cut.layers.length - 1;
                this._safeEmit('layer:added', { cutId, layer, index });
            },
            undo: () => {
                const idx = cut.layers.findIndex(l => l.id === layerId);
                if (idx !== -1) {
                    cut.layers.splice(idx, 1);
                    cut.activeLayerIndex = Math.min(cut.activeLayerIndex, cut.layers.length - 1);
                    this._safeEmit('layer:removed', { cutId, layerId, index: idx });
                }
            },
            meta: { type: 'layer', cutId, layerId }
        };

        if (this.history) {
            this.history.push(command);
        } else {
            command.do();
        }
        return layer;
    }

    /**
     * Cutからレイヤー削除（History統合）
     */
    removeLayerFromCut(cutId, layerId) {
        if (!this.history) {
            this.history = window.History;
        }

        const cut = this.getCutById(cutId);
        if (!cut) {
            console.error('Cut not found:', cutId);
            return;
        }

        const index = cut.layers.findIndex(l => l.id === layerId);
        if (index === -1) {
            console.error('Layer not found:', layerId);
            return;
        }

        if (cut.layers.length <= 1) {
            console.warn('Cannot delete the last layer');
            return;
        }

        const layer = { ...cut.layers[index] };
        const wasActiveLayer = cut.activeLayerIndex === index;

        const command = {
            name: 'remove-layer',
            do: () => {
                cut.layers.splice(index, 1);
                if (cut.activeLayerIndex >= cut.layers.length) {
                    cut.activeLayerIndex = cut.layers.length - 1;
                }
                this._safeEmit('layer:removed', { cutId, layerId, index });
            },
            undo: () => {
                cut.layers.splice(index, 0, layer);
                if (wasActiveLayer) {
                    cut.activeLayerIndex = index;
                }
                this._safeEmit('layer:added', { cutId, layer, index });
            },
            meta: { type: 'layer', cutId, layerId }
        };

        if (this.history) {
            this.history.push(command);
        } else {
            command.do();
        }
    }

    /**
     * ストローク追加（History統合）
     */
    addStroke(strokeData) {
        if (!this.history) {
            this.history = window.History;
        }

        const cut = this.getCurrentCut();
        const layer = cut.layers[cut.activeLayerIndex];
        
        if (!layer) {
            console.error('Active layer not found');
            return;
        }

        const strokeId = this._generateId('stroke');
        const stroke = { 
            id: strokeId, 
            ...strokeData,
            points: [...strokeData.points]
        };

        const command = {
            name: 'add-stroke',
            do: () => {
                layer.strokes.push(stroke);
                this._safeEmit('stroke:added', { 
                    cutId: cut.id, 
                    layerId: layer.id, 
                    stroke 
                });
            },
            undo: () => {
                const idx = layer.strokes.findIndex(s => s.id === strokeId);
                if (idx !== -1) {
                    layer.strokes.splice(idx, 1);
                    this._safeEmit('stroke:removed', { 
                        cutId: cut.id, 
                        layerId: layer.id, 
                        strokeId 
                    });
                }
            },
            meta: { type: 'stroke', cutId: cut.id, layerId: layer.id, strokeId }
        };

        if (this.history) {
            this.history.push(command);
        } else {
            command.do();
        }
        return stroke;
    }

    /**
     * ストローク削除（History統合）
     */
    removeStroke(strokeId) {
        if (!this.history) {
            this.history = window.History;
        }

        const cut = this.getCurrentCut();
        const layer = cut.layers[cut.activeLayerIndex];
        
        if (!layer) {
            console.error('Active layer not found');
            return;
        }

        const index = layer.strokes.findIndex(s => s.id === strokeId);
        if (index === -1) {
            console.error('Stroke not found:', strokeId);
            return;
        }

        const stroke = { ...layer.strokes[index] };

        const command = {
            name: 'remove-stroke',
            do: () => {
                layer.strokes.splice(index, 1);
                this._safeEmit('stroke:removed', { 
                    cutId: cut.id, 
                    layerId: layer.id, 
                    strokeId 
                });
            },
            undo: () => {
                layer.strokes.splice(index, 0, stroke);
                this._safeEmit('stroke:added', { 
                    cutId: cut.id, 
                    layerId: layer.id, 
                    stroke 
                });
            },
            meta: { type: 'stroke', cutId: cut.id, layerId: layer.id, strokeId }
        };

        if (this.history) {
            this.history.push(command);
        } else {
            command.do();
        }
    }

    /**
     * 現在のアクティブレイヤーを取得
     */
    getActiveLayer() {
        const cut = this.getCurrentCut();
        return cut.layers[cut.activeLayerIndex];
    }

    /**
     * アクティブレイヤーを設定
     */
    setActiveLayerIndex(index) {
        const cut = this.getCurrentCut();
        if (index < 0 || index >= cut.layers.length) {
            console.error('Invalid layer index:', index);
            return;
        }
        
        cut.activeLayerIndex = index;
        this._safeEmit('layer:selected', { 
            cutId: cut.id, 
            layerId: cut.layers[index].id, 
            index 
        });
    }

    /**
     * ツール設定取得
     */
    getToolSettings() {
        return this.state.tool;
    }

    /**
     * ツール設定更新
     */
    updateToolSettings(settings) {
        Object.assign(this.state.tool, settings);
        this._safeEmit('tool:updated', settings);
    }

    /**
     * 状態のシリアライズ（保存用）
     */
    serialize() {
        return JSON.stringify(this.state);
    }

    /**
     * 状態の復元（読み込み用）
     */
    deserialize(json) {
        try {
            this.state = JSON.parse(json);
            this._safeEmit('state:restored');
        } catch (error) {
            console.error('Failed to deserialize state:', error);
        }
    }

    /**
     * 状態のリセット
     */
    reset() {
        this.state = this._createInitialState();
        this._safeEmit('state:reset');
    }

    // ===== 後方互換性API（段階的移行用） =====
    
    /**
     * @deprecated getCurrentCut() を使用してください
     */
    getCurrentFrame() {
        console.warn('getCurrentFrame() is deprecated. Use getCurrentCut() instead.');
        return this.getCurrentCut();
    }

    /**
     * @deprecated getCutById() を使用してください
     */
    getFrameById(frameId) {
        console.warn('getFrameById() is deprecated. Use getCutById() instead.');
        return this.getCutById(frameId);
    }
}

// グローバルに公開
window.StateManager = new StateManager();