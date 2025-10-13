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
            return layer.layerData ? layer.layerData.toJSON() : null;
        }

        getAllLayers() {
            const layers = this.layerSystem.getLayers();
            return layers.map((layer, index) => ({
                index,
                ...layer.layerData.toJSON()
            }));
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
            
            layer.layerData[property] = value;
            
            // PIXI オブジェクトへ反映
            if (property === 'visible') layer.visible = value;
            if (property === 'opacity') layer.alpha = value;
            
            this.layerSystem.requestThumbnailUpdate(index);
            return true;
        }

        renameLayer(index, newName) {
            return this.setLayerProperty(index, 'name', newName);
        }

        batchUpdateLayers(updates) {
            // updates = [{ index: 0, property: 'opacity', value: 0.5 }, ...]
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
            // pattern = { search: 'Layer', replace: 'レイヤー' }
            const layers = this.layerSystem.getLayers();
            const results = [];
            
            layers.forEach((layer, index) => {
                if (!layer.layerData) return;
                
                const oldName = layer.layerData.name;
                const newName = oldName.replace(
                    new RegExp(pattern.search, 'g'), 
                    pattern.replace
                );
                
                if (newName !== oldName) {
                    layer.layerData.name = newName;
                    results.push({ index, oldName, newName });
                }
            });
            
            this.layerSystem.updateLayerPanelUI();
            return results;
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
            
            cut[property] = value;
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

    console.log('✅ batch-api.js loaded');
})();