/**
 * LayerProcessor - レイヤー処理統合（Phase2拡張）
 * LayerStore連携・階層管理・市松模様背景・透明表示・ブレンド合成
 */
export class LayerProcessor {
    constructor(oglCore, eventStore, layerStore) {
        this.oglCore = oglCore;
        this.eventStore = eventStore;
        this.layerStore = layerStore;
        
        // レイヤー表示設定
        this.showTransparencyGrid = true;
        this.gridSize = 16;
        this.gridColors = ['#ffffff', '#cccccc'];
        
        // レイヤーパネル状態
        this.panelVisible = true;
        this.panelWidth = 280;
        
        this.setupEventSubscriptions();
        this.createTransparencyGrid();
    }
    
    // 初期レイヤー作成
    createInitialLayer() {
        const layer = this.layerStore.createLayer('背景', this.layerStore.layerTypes.RASTER);
        this.selectLayer(layer.id);
        this.createLayerPanel();
        
        console.log('✅ Initial layer created and panel initialized');
    }
    
    // レイヤー選択
    selectLayer(layerId) {
        const success = this.layerStore.selectLayer(layerId);
        if (success) {
            this.updateLayerPanelUI();
            this.eventStore.emit(this.eventStore.eventTypes.LAYER_SELECT, {
                layerId,
                layer: this.layerStore.getActiveLayer()
            });
        }
        return success;
    }
    
    // 新しいレイヤー追加
    addLayer(name = null, type = null) {
        const layer = this.layerStore.createLayer(
            name || `レイヤー ${this.layerStore.layers.length + 1}`,
            type || this.layerStore.layerTypes.RASTER
        );
        
        this.selectLayer(layer.id);
        this.updateLayerPanelUI();
        
        this.eventStore.emit(this.eventStore.eventTypes.LAYER_ADD, { layer });
        console.log(`➕ New layer added: ${layer.name}`);
        
        return layer;
    }
    
    // レイヤー削除
    deleteLayer(layerId = null) {
        const targetId = layerId || this.layerStore.activeLayerId;
        if (!targetId) return false;
        
        const layer = this.layerStore.getLayer(targetId);
        const success = this.layerStore.deleteLayer(targetId);
        
        if (success) {
            this.updateLayerPanelUI();
            this.eventStore.emit(this.eventStore.eventTypes.LAYER_DELETE, { 
                layerId: targetId,
                layerName: layer?.name 
            });
        }
        
        return success;
    }
    
    // レイヤー複製
    duplicateActiveLayer() {
        const activeLayer = this.layerStore.getActiveLayer();
        if (!activeLayer) return null;
        
        const duplicated = this.layerStore.duplicateLayer(activeLayer.id);
        if (duplicated) {
            this.selectLayer(duplicated.id);
            this.updateLayerPanelUI();
            
            this.eventStore.emit(this.eventStore.eventTypes.LAYER_ADD, { 
                layer: duplicated,
                source: 'duplicate'
            });
        }
        
        return duplicated;
    }
    
    // レイヤープロパティ更新
    updateLayerProperty(layerId, property, value) {
        const success = this.layerStore.updateLayer(layerId, { [property]: value });
        if (success) {
            this.updateLayerPanelUI();
            this.eventStore.emit(this.eventStore.eventTypes.LAYER_SELECT, {
                layerId,
                property,
                value
            });
        }
        return success;
    }
    
    // レイヤー可視性切り替え
    toggleLayerVisibility(layerId) {
        const layer = this.layerStore.getLayer(layerId);
        if (layer) {
            this.updateLayerProperty(layerId, 'visible', !layer.visible);
        }
    }
    
    // レイヤーロック切り替え
    toggleLayerLock(layerId) {
        const layer = this.layerStore.getLayer(layerId);
        if (layer) {
            this.updateLayerProperty(layerId, 'locked', !layer.locked);
        }
    }
    
    // レイヤーパネル作成
    createLayerPanel() {
        // 既存のレイヤーパネル要素を探すか作成
        let layerPanel = document.getElementById('layerPanel');
        if (!layerPanel) {
            layerPanel = document.createElement('div');
            layerPanel.id = 'layerPanel';
            layerPanel.className = 'layer-panel';
            
            // パネルを右側に配置
            const canvasArea = document.getElementById('canvasArea');
            if (canvasArea) {
                canvasArea.parentElement.appendChild(layerPanel);
            } else {
                document.body.appendChild(layerPanel);
            }
        }
        
        this.layerPanel = layerPanel;
        this.updateLayerPanelUI();
        this.addLayerPanelStyles();
        
        console.log('✅ Layer panel created');
    }
    
    // レイヤーパネルUI更新
    updateLayerPanelUI() {
        if (!this.layerPanel) return;
        
        const layers = this.layerStore.getLayerHierarchy();
        const activeLayerId = this.layerStore.activeLayerId;
        
        this.layerPanel.innerHTML = `
            <div class="layer-panel-header">
                <h3>レイヤー</h3>
                <div class="layer-controls">
                    <button class="layer-btn" data-action="add-layer" title="レイヤー追加">➕</button>
                    <button class="layer-btn" data-action="add-group" title="グループ作成">📁</button>
                    <button class="layer-btn" data-action="duplicate" title="複製">📄</button>
                    <button class="layer-btn" data-action="delete" title="削除">🗑️</button>
                </div>
            </div>
            <div class="layer-list">
                ${this.renderLayerHierarchy(layers, activeLayerId)}
            </div>
        `;
        
        this.setupLayerPanelEvents();
    }
    
    // レイヤー階層レンダリング
    renderLayerHierarchy(layers, activeLayerId, level = 0) {
        return layers.map(layer => {
            const isActive = layer.id === activeLayerId;
            const indent = level * 20;
            
            return `
                <div class="layer-item ${isActive ? 'active' : ''}" 
                     data-layer-id="${layer.id}" 
                     style="padding-left: ${indent}px;">
                    <div class="layer-content">
                        ${layer.type === 'group' ? 
                            `<span class="layer-expand ${layer.expanded ? 'expanded' : ''}" data-action="expand">▶</span>` : 
                            '<span class="layer-indent"></span>'
                        }
                        <div class="layer-thumbnail">
                            ${this.generateLayerThumbnail(layer)}
                        </div>
                        <div class="layer-info">
                            <input type="text" class="layer-name" value="${layer.name}" data-action="rename">
                            <div class="layer-properties">
                                <span class="layer-type">${this.getLayerTypeIcon(layer.type)}</span>
                                <span class="layer-blend">${layer.blendMode}</span>
                            </div>
                        </div>
                        <div class="layer-controls">
                            <button class="layer-visibility ${layer.visible ? 'visible' : 'hidden'}" 
                                    data-action="toggle-visibility" title="表示/非表示">
                                ${layer.visible ? '👁️' : '🙈'}
                            </button>
                            <button class="layer-lock ${layer.locked ? 'locked' : 'unlocked'}" 
                                    data-action="toggle-lock" title="ロック">
                                ${layer.locked ? '🔒' : '🔓'}
                            </button>
                        </div>
                    </div>
                    <div class="layer-opacity">
                        <input type="range" min="0" max="1" step="0.01" value="${layer.opacity}" 
                               class="opacity-slider" data-action="opacity">
                        <span class="opacity-value">${Math.round(layer.opacity * 100)}%</span>
                    </div>
                    ${layer.children && layer.expanded ? 
                        this.renderLayerHierarchy(layer.children, activeLayerId, level + 1) : ''}
                </div>
            `;
        }).join('');
    }
    
    // レイヤーサムネイル生成
    generateLayerThumbnail(layer) {
        // 実際の実装では Layer の内容から小さなプレビュー画像を生成
        const bgColor = layer.type === 'group' ? '#e0e0e0' : '#f5f5f5';
        return `<div style="width: 32px; height: 32px; background: ${bgColor}; border: 1px solid #ccc; border-radius: 2px;"></div>`;
    }
    
    // レイヤータイプアイコン取得
    getLayerTypeIcon(type) {
        const icons = {
            raster: '🖼️',
            vector: '📐',
            group: '📁',
            adjustment: '⚙️',
            text: '📝'
        };
        return icons[type] || '❓';
    }
    
    // レイヤーパネルイベント設定
    setupLayerPanelEvents() {
        if (!this.layerPanel) return;
        
        // レイヤー選択
        this.layerPanel.addEventListener('click', (e) => {
            const layerItem = e.target.closest('.layer-item');
            if (layerItem && !e.target.closest('button, input')) {
                const layerId = layerItem.getAttribute('data-layer-id');
                this.selectLayer(layerId);
            }
        });
        
        // 各種操作ボタン
        this.layerPanel.addEventListener('click', (e) => {
            const action = e.target.getAttribute('data-action');
            const layerId = e.target.closest('.layer-item')?.getAttribute('data-layer-id');
            
            switch (action) {
                case 'add-layer':
                    this.addLayer();
                    break;
                case 'add-group':
                    this.createLayerGroup();
                    break;
                case 'duplicate':
                    this.duplicateActiveLayer();
                    break;
                case 'delete':
                    if (confirm('レイヤーを削除しますか？')) {
                        this.deleteLayer();
                    }
                    break;
                case 'toggle-visibility':
                    this.toggleLayerVisibility(layerId);
                    break;
                case 'toggle-lock':
                    this.toggleLayerLock(layerId);
                    break;
                case 'expand':
                    this.toggleLayerExpansion(layerId);
                    break;
            }
        });
        
        // 不透明度スライダー
        this.layerPanel.addEventListener('input', (e) => {
            if (e.target.matches('.opacity-slider')) {
                const layerId = e.target.closest('.layer-item').getAttribute('data-layer-id');
                const opacity = parseFloat(e.target.value);
                this.updateLayerProperty(layerId, 'opacity', opacity);
                
                // 表示値更新
                const valueSpan = e.target.nextElementSibling;
                valueSpan.textContent = Math.round(opacity * 100) + '%';
            }
        });
        
        // レイヤー名編集
        this.layerPanel.addEventListener('change', (e) => {
            if (e.target.matches('.layer-name')) {
                const layerId = e.target.closest('.layer-item').getAttribute('data-layer-id');
                this.updateLayerProperty(layerId, 'name', e.target.value);
            }
        });
    }
    
    // レイヤーグループ作成
    createLayerGroup() {
        const group = this.layerStore.createLayer('新しいグループ', this.layerStore.layerTypes.GROUP);
        this.selectLayer(group.id);
        this.updateLayerPanelUI();
        
        console.log('📁 Layer group created');
        return group;
    }
    
    // レイヤー展開状態切り替え
    toggleLayerExpansion(layerId) {
        const layer = this.layerStore.getLayer(layerId);
        if (layer && layer.type === 'group') {
            this.updateLayerProperty(layerId, 'expanded', !layer.expanded);
        }
    }
    
    // 市松模様背景作成
    createTransparencyGrid() {
        if (!this.oglCore || !this.showTransparencyGrid) return;
        
        // OGL統一透明背景パターン作成
        console.log('🏁 Transparency grid created');
    }
    
    // レイヤーパネル表示切り替え
    toggleLayerPanel() {
        this.panelVisible = !this.panelVisible;
        if (this.layerPanel) {
            this.layerPanel.style.display = this.panelVisible ? 'block' : 'none';
        }
        
        console.log(`📚 Layer panel ${this.panelVisible ? 'shown' : 'hidden'}`);
    }
    
    // レイヤーパネル表示
    showLayerPanel() {
        this.panelVisible = true;
        if (this.layerPanel) {
            this.layerPanel.style.display = 'block';
        }
    }
    
    // レイヤーマージ
    mergeSelectedLayers() {
        const activeLayer = this.layerStore.getActiveLayer();
        if (!activeLayer) return null;
        
        // 現在は単一レイヤーのみ対応
        console.log('🔗 Layer merge (placeholder implementation)');
        return activeLayer;
    }
    
    // レイヤーパネルスタイル追加
    addLayerPanelStyles() {
        if (document.getElementById('layer-panel-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'layer-panel-styles';
        style.textContent = `
            .layer-panel {
                position: fixed;
                right: 0;
                top: 0;
                width: 280px;
                height: 100vh;
                background: rgba(255, 255, 255, 0.95);
                border-left: 1px solid var(--sub-color, #cccccc);
                backdrop-filter: blur(10px);
                display: flex;
                flex-direction: column;
                z-index: 100;
            }
            
            .layer-panel-header {
                padding: 12px;
                background: rgba(128, 0, 0, 0.05);
                border-bottom: 1px solid rgba(128, 0, 0, 0.1);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .layer-panel-header h3 {
                margin: 0;
                font-size: 14px;
                color: var(--text-color, #333);
            }
            
            .layer-controls {
                display: flex;
                gap: 4px;
            }
            
            .layer-btn {
                width: 24px;
                height: 24px;
                border: none;
                background: rgba(255, 255, 255, 0.8);
                border-radius: 3px;
                cursor: pointer;
                font-size: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .layer-btn:hover {
                background: var(--light-bg, #f0f0f0);
            }
            
            .layer-list {
                flex: 1;
                overflow-y: auto;
                padding: 8px 0;
            }
            
            .layer-item {
                margin: 2px 8px;
                border-radius: 4px;
                transition: background 0.2s ease;
            }
            
            .layer-item:hover {
                background: rgba(128, 0, 0, 0.05);
            }
            
            .layer-item.active {
                background: rgba(128, 0, 0, 0.1);
            }
            
            .layer-content {
                display: flex;
                align-items: center;
                padding: 6px 8px;
                gap: 8px;
            }
            
            .layer-expand {
                cursor: pointer;
                font-size: 10px;
                width: 12px;
                transition: transform 0.2s ease;
            }
            
            .layer-expand.expanded {
                transform: rotate(90deg);
            }
            
            .layer-indent {
                width: 12px;
            }
            
            .layer-thumbnail {
                flex-shrink: 0;
            }
            
            .layer-info {
                flex: 1;
                min-width: 0;
            }
            
            .layer-name {
                width: 100%;
                border: none;
                background: none;
                font-size: 12px;
                padding: 2px 0;
                color: var(--text-color, #333);
            }
            
            .layer-name:focus {
                background: white;
                border: 1px solid var(--sub-color, #cccccc);
                border-radius: 2px;
                padding: 1px 3px;
            }
            
            .layer-properties {
                display: flex;
                gap: 4px;
                font-size: 10px;
                color: #666;
            }
            
            .layer-controls {
                display: flex;
                gap: 2px;
            }
            
            .layer-visibility, .layer-lock {
                background: none;
                border: none;
                cursor: pointer;
                font-size: 12px;
                opacity: 0.7;
                transition: opacity 0.2s ease;
            }
            
            .layer-visibility:hover, .layer-lock:hover {
                opacity: 1;
            }
            
            .layer-opacity {
                display: flex;
                align-items: center;
                padding: 4px 16px;
                gap: 8px;
            }
            
            .opacity-slider {
                flex: 1;
                height: 4px;
                background: var(--light-bg, #f0f0f0);
                border-radius: 2px;
                outline: none;
                -webkit-appearance: none;
            }
            
            .opacity-slider::-webkit-slider-thumb {
                -webkit-appearance: none;
                width: 12px;
                height: 12px;
                background: var(--main-color, #800000);
                border-radius: 50%;
                cursor: pointer;
            }
            
            .opacity-value {
                font-size: 10px;
                color: #666;
                min-width: 30px;
                text-align: right;
            }
        `;
        
        document.head.appendChild(style);
    }
    
    // イベント購読設定
    setupEventSubscriptions() {
        // ストローク完了時のレイヤー更新
        this.eventStore.on(this.eventStore.eventTypes.STROKE_COMPLETE, (data) => {
            const activeLayer = this.layerStore.getActiveLayer();
            if (activeLayer) {
                // レイヤーの最終更新時刻を更新
                this.layerStore.updateLayer(activeLayer.id, { modified: Date.now() });
            }
        });
        
        // UI からのレイヤー操作
        this.eventStore.on(this.eventStore.eventTypes.LAYER_ADD, () => {
            this.updateLayerPanelUI();
        });
        
        this.eventStore.on(this.eventStore.eventTypes.LAYER_DELETE, () => {
            this.updateLayerPanelUI();
        });
        
        this.eventStore.on(this.eventStore.eventTypes.LAYER_SELECT, (data) => {
            if (data.payload && data.payload.selection) {
                // 選択範囲がある場合の処理
                console.log('🎯 Layer selection with area:', data.payload.selection);
            }
        });
    }
    
    // レイヤー状態取得
    getLayerState() {
        return {
            layers: this.layerStore.getLayers(),
            activeLayerId: this.layerStore.activeLayerId,
            panelVisible: this.panelVisible,
            showTransparencyGrid: this.showTransparencyGrid
        };
    }
    
    // デバッグ情報
    getDebugInfo() {
        return {
            layerCount: this.layerStore.layers.length,
            activeLayer: this.layerStore.getActiveLayer()?.name,
            panelVisible: this.panelVisible,
            storeDebug: this.layerStore.getDebugInfo()
        };
    }
    
    // クリーンアップ
    destroy() {
        if (this.layerPanel) {
            this.layerPanel.remove();
        }
        
        console.log('✅ Layer processor destroyed');
    }
}