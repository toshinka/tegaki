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
         * 
         * @private
         * @returns {Object} - 初期State
         */
        _createInitialState() {
            // ========== Phase 2: 改修 START ==========
            
            const initialFrameId = this._generateId('frame');
            const initialLayerId = this._generateId('layer');
            
            return {
                timeline: {
                    // 現在表示中のフレームID
                    currentFrameId: initialFrameId,
                    
                    // フレーム配列
                    frames: [
                        {
                            id: initialFrameId,
                            name: 'Frame 1',
                            duration: 1,
                            
                            // レイヤー配列
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
                                    
                                    // ベクターストローク配列
                                    strokes: [],
                                    
                                    // ラスター用（将来実装）
                                    bitmap: null
                                }
                            ]
                        }
                    ]
                },
                
                // UI状態（履歴記録しない軽量な状態）
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
         * 
         * @returns {Object|null} - 現在のフレーム
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
         * 
         * @returns {Object|null} - 現在のレイヤー
         */
        getCurrentLayer() {
            // ========== Phase 2: 改修 START ==========
            const frame = this.getCurrentFrame();
            if (!frame) return null;
            
            const layerIndex = this.state.ui.activeLayerIndex;
            if (layerIndex < 0 || layerIndex >= frame.layers.length) {
                return null;
            }
            
            return frame.layers[layerIndex];
            // ========== Phase 2: 改修 END ==========
        }

        /**
         * IDでレイヤーを検索
         * 
         * @param {string} layerId - レイヤーID
         * @returns {Object|null} - レイヤーオブジェクト
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
         * 
         * @param {string} strokeId - ストロークID
         * @returns {Object|null} - ストロークオブジェクト
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
         * ストロークを追加（履歴記録付き）
         * 
         * @param {Object} strokeData - ストロークデータ
         * @returns {Object|null} - 追加されたストローク
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
                    // Stateにストローク追加
                    const targetLayer = this.getLayerById(layerId);
                    if (targetLayer) {
                        targetLayer.strokes.push(stroke);
                    }
                    
                    // イベント発火（PixiJS同期用）
                    this._emitEvent('stroke:added', { layerId, stroke });
                },
                undo: () => {
                    // Stateからストローク削除
                    const targetLayer = this.getLayerById(layerId);
                    if (targetLayer) {
                        const index = targetLayer.strokes.findIndex(s => s.id === strokeId);
                        if (index !== -1) {
                            targetLayer.strokes.splice(index, 1);
                        }
                    }
                    
                    // イベント発火（PixiJS同期用）
                    this._emitEvent('stroke:removed', { layerId, strokeId });
                },
                meta: { type: 'stroke', layerId, strokeId }
            };

            // Historyに記録（push内でcommand.do()が実行される）
            if (window.History) {
                window.History.push(command);
            } else {
                console.warn('[StateManager] History not available');
                command.do();
            }

            return stroke;
            
            // ========== Phase 2: 改修 END ==========
        }

        /**
         * レイヤーを追加（履歴記録付き）
         * 
         * @param {string|null} name - レイヤー名（nullの場合は自動生成）
         * @returns {Object|null} - 追加されたレイヤー
         */
        addLayer(name = null) {
            // ========== Phase 2: 改修 START ==========
            
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
                    // Stateにレイヤー追加
                    const targetFrame = this.state.timeline.frames.find(f => f.id === frameId);
                    if (targetFrame) {
                        targetFrame.layers.push(layer);
                        this.state.ui.activeLayerIndex = targetFrame.layers.length - 1;
                    }
                    
                    // イベント発火
                    this._emitEvent('layer:created', { frameId, layer });
                },
                undo: () => {
                    // Stateからレイヤー削除
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
                    
                    // イベント発火
                    this._emitEvent('layer:removed', { frameId, layerId });
                },
                meta: { type: 'layer', layerId }
            };

            // Historyに記録
            if (window.History) {
                window.History.push(command);
            } else {
                console.warn('[StateManager] History not available');
                command.do();
            }

            return layer;
            
            // ========== Phase 2: 改修 END ==========
        }

        /**
         * レイヤーを削除（履歴記録付き）
         * 
         * @param {string} layerId - 削除するレイヤーID
         * @returns {boolean} - 成功した場合true
         */
        removeLayer(layerId) {
            // ========== Phase 2: 改修 START ==========
            
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

            // レイヤーのスナップショット（復元用）
            const layerSnapshot = structuredClone(frame.layers[layerIndex]);
            const frameId = frame.id;

            const command = {
                name: 'delete-layer',
                do: () => {
                    // Stateからレイヤー削除
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
                    
                    // イベント発火
                    this._emitEvent('layer:removed', { frameId, layerId });
                },
                undo: () => {
                    // Stateにレイヤー復元
                    const targetFrame = this.state.timeline.frames.find(f => f.id === frameId);
                    if (targetFrame) {
                        targetFrame.layers.splice(layerIndex, 0, layerSnapshot);
                        this.state.ui.activeLayerIndex = layerIndex;
                    }
                    
                    // イベント発火
                    this._emitEvent('layer:restored', { frameId, layer: layerSnapshot });
                },
                meta: { type: 'layer-delete', layerId }
            };

            // Historyに記録
            if (window.History) {
                window.History.push(command);
            } else {
                console.warn('[StateManager] History not available');
                command.do();
            }

            return true;
            
            // ========== Phase 2: 改修 END ==========
        }

        /**
         * UIプロパティを更新（履歴記録なし）
         * 
         * @param {string} key - プロパティ名
         * @param {*} value - 値
         */
        setUIProperty(key, value) {
            // ========== Phase 2: 改修 START ==========
            
            if (key in this.state.ui) {
                this.state.ui[key] = value;
                this._emitEvent('ui:property-changed', { key, value });
            } else {
                console.warn('[StateManager] Unknown UI property:', key);
            }
            
            // ========== Phase 2: 改修 END ==========
        }

        /**
         * アクティブレイヤーを変更（履歴記録なし）
         * 
         * @param {number} index - レイヤーインデックス
         * @returns {boolean} - 成功した場合true
         */
        setActiveLayerIndex(index) {
            // ========== Phase 2: 改修 START ==========
            
            const frame = this.getCurrentFrame();
            if (!frame || index < 0 || index >= frame.layers.length) {
                return false;
            }
            
            this.state.ui.activeLayerIndex = index;
            this._emitEvent('layer:active-changed', { index });
            return true;
            
            // ========== Phase 2: 改修 END ==========
        }

        /**
         * State全体を取得（読み取り専用）
         * 
         * @returns {Object} - Stateのコピー
         */
        getState() {
            // ========== Phase 2: 改修 START ==========
            return structuredClone(this.state);
            // ========== Phase 2: 改修 END ==========
        }

        /**
         * State全体を置き換え（JSON読み込み用）
         * 
         * @param {Object} newState - 新しいState
         */
        setState(newState) {
            // ========== Phase 2: 改修 START ==========
            
            // State検証
            if (!this._validateState(newState)) {
                console.error('[StateManager] Invalid state structure');
                return;
            }
            
            this.state = structuredClone(newState);
            this._emitEvent('state:replaced', this.state);
            
            // ========== Phase 2: 改修 END ==========
        }

        /**
         * イベント発火
         * 
         * @private
         * @param {string} eventName - イベント名
         * @param {Object} data - イベントデータ
         */
        _emitEvent(eventName, data) {
            // ========== Phase 2: 改修 START ==========
            
            // EventBusが存在する場合のみ発火
            if (window.EventBus) {
                EventBus.emit(eventName, data);
            }
            
            // リスナーに通知
            this._listeners.forEach(listener => {
                try {
                    listener(eventName, data);
                } catch (error) {
                    console.error('[StateManager] Listener error:', error);
                }
            });
            
            // ========== Phase 2: 改修 END ==========
        }

        /**
         * リスナーを追加
         * 
         * @param {Function} callback - コールバック関数
         * @returns {Function} - リスナー解除関数
         */
        addListener(callback) {
            // ========== Phase 2: 改修 START ==========
            
            if (typeof callback !== 'function') {
                console.error('[StateManager] Listener must be a function');
                return () => {};
            }
            
            this._listeners.add(callback);
            return () => this.removeListener(callback);
            
            // ========== Phase 2: 改修 END ==========
        }

        /**
         * リスナーを削除
         * 
         * @param {Function} callback - コールバック関数
         */
        removeListener(callback) {
            // ========== Phase 2: 改修 START ==========
            this._listeners.delete(callback);
            // ========== Phase 2: 改修 END ==========
        }

        /**
         * ID生成
         * 
         * @private
         * @param {string} type - 'frame' | 'layer' | 'stroke'
         * @returns {string} - 生成されたID
         */
        _generateId(type) {
            // ========== Phase 2: 改修 START ==========
            const id = `${type}_${String(this._nextId[type]).padStart(3, '0')}`;
            this._nextId[type]++;
            return id;
            // ========== Phase 2: 改修 END ==========
        }

        /**
         * State構造の検証
         * 
         * @private
         * @param {Object} state - 検証対象のState
         * @returns {boolean} - 有効な場合true
         */
        _validateState(state) {
            // ========== Phase 2: 改修 START ==========
            
            if (!state || typeof state !== 'object') {
                return false;
            }
            
            if (!state.timeline || !Array.isArray(state.timeline.frames)) {
                return false;
            }
            
            if (state.timeline.frames.length === 0) {
                return false;
            }
            
            // 各フレームの検証
            for (const frame of state.timeline.frames) {
                if (!frame.id || !Array.isArray(frame.layers)) {
                    return false;
                }
                
                // 各レイヤーの検証
                for (const layer of frame.layers) {
                    if (!layer.id || !Array.isArray(layer.strokes)) {
                        return false;
                    }
                }
            }
            
            return true;
            
            // ========== Phase 2: 改修 END ==========
        }

        /**
         * デバッグ用: State情報表示
         */
        debug() {
            // ========== Phase 2: 改修 START ==========
            
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
            
            // ========== Phase 2: 改修 END ==========
        }
    }

    // ========== Phase 2: 改修 START ==========
    
    // グローバルインスタンス生成
    const StateManager = new StateManager();
    
    // グローバル公開
    window.StateManager = StateManager;
    
    // 開発環境でのデバッグ用
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        window.StateDebug = () => StateManager.debug();
    }
    
    console.log('✅ system/state-manager.js Phase 2 loaded');
    
    // ========== Phase 2: 改修 END ==========
    
})();