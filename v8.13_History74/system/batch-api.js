(function() {
    'use strict';

    class BatchAPI {
        constructor(layerSystem, animationSystem) {
            this.layerSystem = layerSystem;
            this.animationSystem = animationSystem;
        }

        // ========== Layer 操作 ==========
        
        getLayer(index) {
            const layers = this.layerSystem.getLayers();
            if (index < 0 || index >= layers.length) return null;
            
            const layer = layers[index];
            if (!layer.layerData) return null;
            
            // toJSON() メソッドがあれば使用、なければプレーンオブジェクトとして扱う
            if (typeof layer.layerData.toJSON === 'function') {
                return layer.layerData.toJSON();
            } else {
                return {
                    id: layer.layerData.id,
                    name: layer.layerData.name,
                    visible: layer.layerData.visible,
                    opacity: layer.layerData.opacity,
                    isBackground: layer.layerData.isBackground,
                    clipping: layer.layerData.clipping,
                    blendMode: layer.layerData.blendMode,
                    locked: layer.layerData.locked
                };
            }
        }

        getAllLayers() {
            const layers = this.layerSystem.getLayers();
            return layers.map((layer, index) => {
                if (!layer.layerData) return null;
                
                // toJSON() メソッドがあれば使用、なければプレーンオブジェクトとして扱う
                let layerData;
                if (typeof layer.layerData.toJSON === 'function') {
                    layerData = layer.layerData.toJSON();
                } else {
                    layerData = {
                        id: layer.layerData.id,
                        name: layer.layerData.name,
                        visible: layer.layerData.visible,
                        opacity: layer.layerData.opacity,
                        isBackground: layer.layerData.isBackground,
                        clipping: layer.layerData.clipping,
                        blendMode: layer.layerData.blendMode,
                        locked: layer.layerData.locked
                    };
                }
                
                return {
                    index,
                    ...layerData
                };
            }).filter(layer => layer !== null);
        }

        setLayerProperty(index, property, value) {
            const layers = this.layerSystem.getLayers();
            if (index < 0 || index >= layers.length) return false;
            
            const layer = layers[index];
            if (!layer.layerData) return false;
            
            const schema = window.TegakiDataModels.LAYER_SCHEMA[property];
            if (!schema || !schema.editable) return false;
            
            // 型チェック
            if (schema.type === 'number') {
                if (typeof value !== 'number') return false;
                if (schema.min !== undefined && value < schema.min) return false;
                if (schema.max !== undefined && value > schema.max) return false;
            }
            
            // History 統合（Undo/Redo対応）
            if (window.History && !window.History.isApplying) {
                const oldValue = layer.layerData[property];
                
                const command = {
                    name: 'layer-property-change',
                    do: () => {
                        layer.layerData[property] = value;
                        if (property === 'visible') layer.visible = value;
                        if (property === 'opacity') layer.alpha = value;
                        this.layerSystem.requestThumbnailUpdate(index);
                    },
                    undo: () => {
                        layer.layerData[property] = oldValue;
                        if (property === 'visible') layer.visible = oldValue;
                        if (property === 'opacity') layer.alpha = oldValue;
                        this.layerSystem.requestThumbnailUpdate(index);
                    },
                    meta: { 
                        type: 'layer-prop', 
                        index, 
                        property, 
                        oldValue, 
                        newValue: value 
                    }
                };
                
                window.History.push(command);
            } else {
                // History が無効な場合は直接実行
                layer.layerData[property] = value;
                if (property === 'visible') layer.visible = value;
                if (property === 'opacity') layer.alpha = value;
                this.layerSystem.requestThumbnailUpdate(index);
            }
            
            return true;
        }

        renameLayer(index, newName) {
            return this.setLayerProperty(index, 'name', newName);
        }

        batchUpdateLayers(updates) {
            // Composite コマンドを使用（複数操作を1つの Undo/Redo で扱う）
            if (window.History && !window.History.isApplying) {
                const commands = [];
                
                for (const update of updates) {
                    const layers = this.layerSystem.getLayers();
                    const layer = layers[update.index];
                    if (!layer?.layerData) continue;
                    
                    const oldValue = layer.layerData[update.property];
                    
                    commands.push({
                        name: 'layer-prop-batch-item',
                        do: () => {
                            const currentLayers = this.layerSystem.getLayers();
                            const currentLayer = currentLayers[update.index];
                            if (!currentLayer?.layerData) return;
                            
                            currentLayer.layerData[update.property] = update.value;
                            if (update.property === 'visible') currentLayer.visible = update.value;
                            if (update.property === 'opacity') currentLayer.alpha = update.value;
                            this.layerSystem.requestThumbnailUpdate(update.index);
                        },
                        undo: () => {
                            const currentLayers = this.layerSystem.getLayers();
                            const currentLayer = currentLayers[update.index];
                            if (!currentLayer?.layerData) return;
                            
                            currentLayer.layerData[update.property] = oldValue;
                            if (update.property === 'visible') currentLayer.visible = oldValue;
                            if (update.property === 'opacity') currentLayer.alpha = oldValue;
                            this.layerSystem.requestThumbnailUpdate(update.index);
                        },
                        meta: { index: update.index, property: update.property }
                    });
                }
                
                if (commands.length > 0) {
                    // 複数のコマンドをまとめて1つの Undo/Redo にする
                    const composite = window.History.createComposite(
                        commands, 
                        'batch-layer-update'
                    );
                    window.History.push(composite);
                }
                
                return updates.map(u => ({ ...u, success: true }));
            }
            
            // History が無効な場合は通常実行
            const results = [];
            for (const update of updates) {
                const success = this.setLayerProperty(
                    update.index, 
                    update.property, 
                    update.value
                );
                results.push({ ...update, success });
            }
            return results;
        }

        batchRenameLayers(pattern) {
            const layers = this.layerSystem.getLayers();
            const changes = [];
            
            // 変更対象を事前に集計
            layers.forEach((layer, index) => {
                if (!layer.layerData) return;
                
                const oldName = layer.layerData.name;
                const newName = oldName.replace(
                    new RegExp(pattern.search, 'g'), 
                    pattern.replace
                );
                
                if (newName !== oldName) {
                    changes.push({ index, oldName, newName });
                }
            });
            
            // History 記録
            if (window.History && !window.History.isApplying) {
                const commands = changes.map(change => ({
                    name: 'layer-rename-batch-item',
                    do: () => {
                        const currentLayers = this.layerSystem.getLayers();
                        const layer = currentLayers[change.index];
                        if (layer?.layerData) {
                            layer.layerData.name = change.newName;
                        }
                    },
                    undo: () => {
                        const currentLayers = this.layerSystem.getLayers();
                        const layer = currentLayers[change.index];
                        if (layer?.layerData) {
                            layer.layerData.name = change.oldName;
                        }
                    },
                    meta: { index: change.index }
                }));
                
                if (commands.length > 0) {
                    const composite = window.History.createComposite(
                        commands, 
                        'batch-rename-layers'
                    );
                    window.History.push(composite);
                }
            } else {
                // History が無効な場合は直接実行
                changes.forEach(change => {
                    const layer = layers[change.index];
                    if (layer?.layerData) {
                        layer.layerData.name = change.newName;
                    }
                });
            }
            
            this.layerSystem.updateLayerPanelUI();
            return changes;
        }

        // ========== CUT 操作 ==========
        
        getCut(index) {
            const cut = this.animationSystem.animationData.cuts[index];
            if (!cut) return null;
            
            return {
                index,
                id: cut.id,
                name: cut.name,
                duration: cut.duration,
                layerCount: cut.getLayerCount ? cut.getLayerCount() : 0
            };
        }

        getAllCuts() {
            return this.animationSystem.animationData.cuts.map((cut, index) => ({
                index,
                id: cut.id,
                name: cut.name,
                duration: cut.duration,
                layerCount: cut.getLayerCount ? cut.getLayerCount() : 0
            }));
        }

        setCutProperty(index, property, value) {
            const cuts = this.animationSystem.animationData.cuts;
            if (index < 0 || index >= cuts.length) return false;
            
            const cut = cuts[index];
            const schema = window.TegakiDataModels.CUT_SCHEMA[property];
            if (!schema || !schema.editable) return false;
            
            // 型チェック + 範囲チェック
            if (schema.type === 'number') {
                if (typeof value !== 'number') return false;
                if (schema.min !== undefined && value < schema.min) return false;
                if (schema.max !== undefined && value > schema.max) return false;
            }
            
            // History 統合
            if (window.History && !window.History.isApplying) {
                const oldValue = cut[property];
                
                const command = {
                    name: 'cut-property-change',
                    do: () => {
                        cut[property] = value;
                    },
                    undo: () => {
                        cut[property] = oldValue;
                    },
                    meta: { type: 'cut-prop', index, property, oldValue, newValue: value }
                };
                
                window.History.push(command);
            } else {
                cut[property] = value;
            }
            
            return true;
        }

        renameCut(index, newName) {
            return this.setCutProperty(index, 'name', newName);
        }

        setAllCutsDuration(duration) {
            const cuts = this.animationSystem.animationData.cuts;
            let successCount = 0;
            
            cuts.forEach(cut => {
                if (duration >= 0.01 && duration <= 10) {
                    cut.duration = duration;
                    successCount++;
                }
            });
            
            return { total: cuts.length, success: successCount };
        }

        batchUpdateCuts(updates) {
            const results = [];
            
            for (const update of updates) {
                const success = this.setCutProperty(
                    update.index, 
                    update.property, 
                    update.value
                );
                results.push({ ...update, success });
            }
            
            return results;
        }

        // ========== スキーマ取得 ==========
        
        getLayerPropSchema() {
            return window.TegakiDataModels.LAYER_SCHEMA;
        }

        getCutPropSchema() {
            return window.TegakiDataModels.CUT_SCHEMA;
        }

        // ========== エクスポート用データ取得 ==========
        
        exportLayersAsTable() {
            const layers = this.getAllLayers();
            return layers.map(layer => ({
                '番号': layer.index + 1,
                '名前': layer.name,
                '表示': layer.visible ? '○' : '×',
                '不透明度': Math.round(layer.opacity * 100) + '%',
                'クリッピング': layer.clipping ? '○' : '×',
                'ロック': layer.locked ? '○' : '×'
            }));
        }

        exportCutsAsTable() {
            const cuts = this.getAllCuts();
            return cuts.map(cut => ({
                '番号': cut.index + 1,
                'CUT名': cut.name,
                '時間': cut.duration.toFixed(2) + 's',
                'レイヤー数': cut.layerCount
            }));
        }
    }

    window.TegakiBatchAPI = BatchAPI;

    console.log('✅ batch-api.js (Phase 6: History統合版) loaded');
})();