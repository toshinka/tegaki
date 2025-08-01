import { cloneDeep } from 'lodash-es';

/**
 * LayerStore - レイヤー状態管理（Phase2基盤）
 * Adobe Fresco風階層管理・フォルダサポート・ドラッグ&ドロップ対応
 */
export class LayerStore {
    constructor() {
        this.layers = [];
        this.activeLayerId = null;
        this.layerIdCounter = 1;
        this.maxLayers = 100;
        
        // レイヤー種別定義
        this.layerTypes = {
            RASTER: 'raster',
            VECTOR: 'vector', 
            GROUP: 'group',
            ADJUSTMENT: 'adjustment',
            TEXT: 'text'
        };
        
        // ブレンドモード定義
        this.blendModes = {
            NORMAL: 'normal',
            MULTIPLY: 'multiply',
            SCREEN: 'screen',
            OVERLAY: 'overlay',
            SOFT_LIGHT: 'soft-light',
            HARD_LIGHT: 'hard-light',
            COLOR_DODGE: 'color-dodge',
            COLOR_BURN: 'color-burn',
            DARKEN: 'darken',
            LIGHTEN: 'lighten',
            DIFFERENCE: 'difference',
            EXCLUSION: 'exclusion'
        };
        
        this.initializeDefaultLayer();
    }
    
    // デフォルトレイヤー初期化
    initializeDefaultLayer() {
        const defaultLayer = this.createLayer('背景', this.layerTypes.RASTER);
        this.activeLayerId = defaultLayer.id;
        console.log('✅ Default layer created:', defaultLayer.name);
    }
    
    // レイヤー作成
    createLayer(name, type = this.layerTypes.RASTER, parentId = null) {
        if (this.layers.length >= this.maxLayers) {
            throw new Error('Maximum layer limit reached');
        }
        
        const layer = {
            id: this.generateLayerId(),
            name: name || `レイヤー ${this.layerIdCounter}`,
            type: type,
            parentId: parentId,
            visible: true,
            locked: false,
            opacity: 1.0,
            blendMode: this.blendModes.NORMAL,
            
            // 位置・変形
            transform: {
                x: 0,
                y: 0,
                scaleX: 1,
                scaleY: 1,
                rotation: 0,
                skewX: 0,
                skewY: 0
            },
            
            // グループ用プロパティ
            children: type === this.layerTypes.GROUP ? [] : null,
            expanded: true,
            
            // 描画データ
            content: null,
            thumbnail: null,
            
            // メタデータ
            created: Date.now(),
            modified: Date.now()
        };
        
        // 階層構造に追加
        if (parentId) {
            const parent = this.getLayer(parentId);
            if (parent && parent.type === this.layerTypes.GROUP) {
                parent.children.push(layer.id);
            }
        }
        
        this.layers.push(layer);
        console.log(`➕ Layer created: ${layer.name} (${layer.id})`);
        
        return layer;
    }
    
    // レイヤー削除
    deleteLayer(layerId) {
        const layerIndex = this.layers.findIndex(l => l.id === layerId);
        if (layerIndex === -1) return false;
        
        const layer = this.layers[layerIndex];
        
        // 子レイヤーも削除（グループの場合）
        if (layer.children) {
            layer.children.forEach(childId => {
                this.deleteLayer(childId);
            });
        }
        
        // 親から削除
        if (layer.parentId) {
            const parent = this.getLayer(layer.parentId);
            if (parent && parent.children) {
                parent.children = parent.children.filter(id => id !== layerId);
            }
        }
        
        // レイヤー配列から削除
        this.layers.splice(layerIndex, 1);
        
        // アクティブレイヤーが削除された場合
        if (this.activeLayerId === layerId) {
            this.activeLayerId = this.layers.length > 0 ? this.layers[0].id : null;
        }
        
        console.log(`🗑️ Layer deleted: ${layer.name}`);
        return true;
    }
    
    // レイヤー取得
    getLayer(layerId) {
        return this.layers.find(l => l.id === layerId);
    }
    
    // アクティブレイヤー取得
    getActiveLayer() {
        return this.getLayer(this.activeLayerId);
    }
    
    // レイヤー選択
    selectLayer(layerId) {
        const layer = this.getLayer(layerId);
        if (!layer) return false;
        
        this.activeLayerId = layerId;
        console.log(`🎯 Layer selected: ${layer.name}`);
        return true;
    }
    
    // レイヤー階層構造取得（表示用）
    getLayerHierarchy() {
        const hierarchy = [];
        const rootLayers = this.layers.filter(l => !l.parentId);
        
        const buildHierarchy = (layers, level = 0) => {
            return layers.map(layer => ({
                ...layer,
                level,
                children: layer.children ? 
                    buildHierarchy(layer.children.map(id => this.getLayer(id)).filter(Boolean), level + 1) : 
                    []
            }));
        };
        
        return buildHierarchy(rootLayers);
    }
    
    // レイヤー順序変更
    moveLayer(layerId, newIndex, newParentId = null) {
        const layer = this.getLayer(layerId);
        if (!layer) return false;
        
        // 現在の親から削除
        if (layer.parentId) {
            const currentParent = this.getLayer(layer.parentId);
            if (currentParent && currentParent.children) {
                currentParent.children = currentParent.children.filter(id => id !== layerId);
            }
        }
        
        // レイヤー配列内の位置変更
        const layerIndex = this.layers.findIndex(l => l.id === layerId);
        this.layers.splice(layerIndex, 1);
        this.layers.splice(newIndex, 0, layer);
        
        // 新しい親に追加
        if (newParentId) {
            const newParent = this.getLayer(newParentId);
            if (newParent && newParent.type === this.layerTypes.GROUP) {
                newParent.children.push(layerId);
                layer.parentId = newParentId;
            }
        } else {
            layer.parentId = null;
        }
        
        layer.modified = Date.now();
        console.log(`🔄 Layer moved: ${layer.name}`);
        return true;
    }
    
    // レイヤープロパティ更新
    updateLayer(layerId, properties) {
        const layer = this.getLayer(layerId);
        if (!layer) return false;
        
        Object.assign(layer, properties);
        layer.modified = Date.now();
        
        console.log(`⚙️ Layer updated: ${layer.name}`);
        return true;
    }
    
    // レイヤー複製
    duplicateLayer(layerId) {
        const layer = this.getLayer(layerId);
        if (!layer) return null;
        
        const duplicated = cloneDeep(layer);
        duplicated.id = this.generateLayerId();
        duplicated.name = `${layer.name} コピー`;
        duplicated.created = Date.now();
        duplicated.modified = Date.now();
        
        // 子レイヤーも複製（グループの場合）
        if (duplicated.children) {
            duplicated.children = duplicated.children.map(childId => {
                const childCopy = this.duplicateLayer(childId);
                return childCopy ? childCopy.id : null;
            }).filter(Boolean);
        }
        
        this.layers.push(duplicated);
        console.log(`📄 Layer duplicated: ${duplicated.name}`);
        return duplicated;
    }
    
    // レイヤーグループ作成
    createGroup(name, layerIds = []) {
        const group = this.createLayer(name, this.layerTypes.GROUP);
        
        // 指定されたレイヤーをグループに移動
        layerIds.forEach(layerId => {
            const layer = this.getLayer(layerId);
            if (layer) {
                layer.parentId = group.id;
                group.children.push(layerId);
            }
        });
        
        console.log(`📁 Group created: ${name} with ${layerIds.length} layers`);
        return group;
    }
    
    // レイヤーグループ解除
    ungroupLayers(groupId) {
        const group = this.getLayer(groupId);
        if (!group || group.type !== this.layerTypes.GROUP) return false;
        
        // 子レイヤーを親から解放
        group.children.forEach(childId => {
            const child = this.getLayer(childId);
            if (child) {
                child.parentId = group.parentId;
            }
        });
        
        // グループ削除
        this.deleteLayer(groupId);
        
        console.log(`📂 Group ungrouped: ${group.name}`);
        return true;
    }
    
    // レイヤー可視性一括制御
    setLayersVisibility(layerIds, visible) {
        layerIds.forEach(layerId => {
            this.updateLayer(layerId, { visible });
        });
        
        console.log(`👁️ ${layerIds.length} layers visibility: ${visible}`);
    }
    
    // レイヤー統合（マージ）
    mergeLayers(layerIds, newName = '統合レイヤー') {
        if (layerIds.length < 2) return null;
        
        // 新しい統合レイヤー作成
        const mergedLayer = this.createLayer(newName, this.layerTypes.RASTER);
        
        // 元のレイヤーから内容をマージ（実装は描画エンジン依存）
        // ここでは概念的な処理のみ
        
        // 元のレイヤー削除
        layerIds.forEach(layerId => {
            this.deleteLayer(layerId);
        });
        
        console.log(`🔗 ${layerIds.length} layers merged into: ${newName}`);
        return mergedLayer;
    }
    
    // レイヤー状態エクスポート
    exportState() {
        return {
            layers: cloneDeep(this.layers),
            activeLayerId: this.activeLayerId,
            layerIdCounter: this.layerIdCounter,
            timestamp: Date.now()
        };
    }
    
    // レイヤー状態インポート
    importState(state) {
        this.layers = state.layers || [];
        this.activeLayerId = state.activeLayerId;
        this.layerIdCounter = state.layerIdCounter || this.layers.length + 1;
        
        console.log(`📥 Layer state imported: ${this.layers.length} layers`);
    }
    
    // レイヤーID生成
    generateLayerId() {
        return `layer_${this.layerIdCounter++}`;
    }
    
    // レイヤー統計取得
    getStats() {
        const stats = {
            total: this.layers.length,
            visible: this.layers.filter(l => l.visible).length,
            locked: this.layers.filter(l => l.locked).length,
            groups: this.layers.filter(l => l.type === this.layerTypes.GROUP).length,
            types: {}
        };
        
        Object.values(this.layerTypes).forEach(type => {
            stats.types[type] = this.layers.filter(l => l.type === type).length;
        });
        
        return stats;
    }
    
    // 全レイヤー取得
    getLayers() {
        return [...this.layers];
    }
    
    // レイヤー検索
    findLayers(criteria) {
        return this.layers.filter(layer => {
            return Object.entries(criteria).every(([key, value]) => {
                if (key === 'name' && typeof value === 'string') {
                    return layer.name.toLowerCase().includes(value.toLowerCase());
                }
                return layer[key] === value;
            });
        });
    }
    
    // デバッグ情報
    getDebugInfo() {
        return {
            layerCount: this.layers.length,
            activeLayerId: this.activeLayerId,
            hierarchy: this.getLayerHierarchy().length,
            stats: this.getStats()
        };
    }
}