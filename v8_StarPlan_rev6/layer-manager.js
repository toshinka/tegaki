/**
 * ファイル名: layer-manager.js
 * @provides LayerManager, レイヤー管理機能, UI更新
 * @requires DrawingEngine, PIXI.js, MainController API
 * LayerManager衛星 - レイヤー生成/削除/移動、Stage管理
 * 星型分離版 v8rev8 - 修正版（循環参照解決・type付きイベント対応）
 */

window.LayerManager = class LayerManager {
    constructor(drawingEngine) {
        this.engine = drawingEngine;
        this.layers = new Map();
        this.activeLayerId = null;
        this.nextLayerId = 1;
        this.ui = null;
        this.mainApi = null;
        this.dragState = {
            dragging: false,
            dragItem: null,
            startY: 0,
            offset: 0
        };
    }
    
    async register(mainApi) {
        this.mainApi = mainApi;
    }
    
    async initialize() {
        try {
            // 背景レイヤーを作成
            this.createBackgroundLayer();
            this.log('LayerManager initialized successfully');
            
        } catch (error) {
            this.reportError('LAYER_INIT_ERROR', 'Failed to initialize layer manager', error);
            throw error;
        }
    }
    
    createBackgroundLayer() {
        const layerId = 0;
        const layerName = '背景';
        
        const container = new PIXI.Container();
        container.name = layerName;
        container.visible = true;
        
        // 背景塗りつぶし作成（修正: beginFill/drawRect/endFillに変更）
        const config = this.mainApi?.getConfig() || {};
        const backgroundGraphics = new PIXI.Graphics();
        backgroundGraphics.beginFill(0xf0e0d6, 1); // futaba-cream color
        backgroundGraphics.drawRect(0, 0, config.canvas?.width || 400, config.canvas?.height || 400);
        backgroundGraphics.endFill();
        container.addChild(backgroundGraphics);
        
        const layer = {
            id: layerId,
            name: layerName,
            container: container,
            visible: true,
            paths: [],
            isBackground: true,
            backgroundGraphics: backgroundGraphics,
            timestamp: Date.now()
        };
        
        this.layers.set(layerId, layer);
        this.engine.containers.world.addChild(container);
        this.activeLayerId = layerId;
        
        // 最初の透明レイヤーを作成
        this.createLayer('レイヤー1');
        this.setActiveLayer(1);
        
        this.updateLayerUI();
        this.log('Background layer created');
    }
    
    createLayer(name = null) {
        try {
            const layerId = this.nextLayerId++;
            const layerName = name || `レイヤー${layerId}`;
            
            const container = new PIXI.Container();
            container.name = layerName;
            container.visible = true;
            
            const layer = {
                id: layerId,
                name: layerName,
                container: container,
                visible: true,
                paths: [],
                isBackground: false,
                timestamp: Date.now()
            };
            
            this.layers.set(layerId, layer);
            this.engine.containers.world.addChild(container);
            
            this.updateLayerUI();
            this.log(`Created layer: ${layerName} (ID: ${layerId})`);
            
            return layer;
            
        } catch (error) {
            this.reportError('CREATE_LAYER_ERROR', 'Failed to create layer', error);
            return null;
        }
    }
    
    deleteLayer(layerId) {
        if (layerId === 0) {
            this.log('Cannot delete background layer');
            return false;
        }
        
        if (this.layers.size <= 2) {
            this.log('Must have at least one layer besides background');
            return false;
        }
        
        try {
            const layer = this.layers.get(layerId);
            if (!layer || layer.isBackground) {
                this.log(`Layer ${layerId} not found or is background`);
                return false;
            }
            
            // パスを削除
            layer.paths.forEach(path => {
                if (path.graphics && path.graphics.destroy) {
                    path.graphics.destroy();
                }
            });
            
            // コンテナを削除
            this.engine.containers.world.removeChild(layer.container);
            layer.container.destroy();
            
            this.layers.delete(layerId);
            
            // アクティブレイヤーの調整
            if (this.activeLayerId === layerId) {
                const remainingLayers = Array.from(this.layers.keys()).filter(id => id !== 0);
                this.activeLayerId = remainingLayers[remainingLayers.length - 1] || 0;
            }
            
            this.updateLayerUI();
            this.log(`Deleted layer: ${layerId}`);
            
            // 削除完了通知（修正: typeを必ず追加、循環参照を完全に避ける）
            const activeLayer = this.getActiveLayer();
            this.mainApi?.notify({
                type: 'layer-deleted',
                deletedLayerId: layerId,
                activeLayer: {
                    id: activeLayer?.id,
                    name: activeLayer?.name,
                    visible: activeLayer?.visible
                }
            });
            
            return true;
            
        } catch (error) {
            this.reportError('DELETE_LAYER_ERROR', 'Failed to delete layer', error);
            return false;
        }
    }
    
    setActiveLayer(layerId) {
        if (this.layers.has(layerId)) {
            this.activeLayerId = layerId;
            this.updateLayerUI();
            this.updateStatusDisplay();
            
            this.log(`Active layer changed to: ${layerId}`);
            
            // レイヤー変更通知（修正: typeを必ず追加、軽量化したデータのみ）
            const activeLayer = this.getActiveLayer();
            this.mainApi?.notify({
                type: 'layer-activated',
                layerId: layerId,
                layerName: activeLayer?.name,
                layerVisible: activeLayer?.visible,
                timestamp: Date.now()
            });
        }
    }
    
    toggleLayerVisibility(layerId) {
        const layer = this.layers.get(layerId);
        if (!layer) return;
        
        layer.visible = !layer.visible;
        layer.container.visible = layer.visible;
        this.updateLayerUI();
        
        // 表示切り替え通知（修正: typeを必ず追加、軽量化）
        this.mainApi?.notify({
            type: 'layer-visibility-changed',
            layerId: layerId,
            visible: layer.visible,
            layerName: layer.name
        });
        
        this.log(`Layer ${layerId} visibility: ${layer.visible}`);
    }
    
    getActiveLayer() {
        return this.layers.get(this.activeLayerId);
    }
    
    addPathToActiveLayer(path) {
        const activeLayer = this.getActiveLayer();
        if (activeLayer && path) {
            activeLayer.paths.push(path);
            activeLayer.container.addChild(path.graphics);
            this.log(`Added path to layer ${activeLayer.id}`);
        }
    }
    
    reorderLayers(fromIndex, toIndex) {
        try {
            const layerIds = Array.from(this.layers.keys()).filter(id => id !== 0).reverse();
            
            if (fromIndex < 0 || fromIndex >= layerIds.length ||
                toIndex < 0 || toIndex >= layerIds.length ||
                fromIndex === toIndex) {
                this.log('Invalid reorder parameters');
                return;
            }
            
            const fromLayerId = layerIds[fromIndex];
            const layerContainers = layerIds.map(id => this.layers.get(id).container);
            const fromContainer = layerContainers[fromIndex];
            
            this.engine.containers.world.removeChild(fromContainer);
            this.engine.containers.world.addChildAt(fromContainer, toIndex + 1); // +1 for background layer
            
            this.updateLayerUI();
            
            // レイヤー順序変更通知（修正: typeを必ず追加、軽量化）
            this.mainApi?.notify({
                type: 'layer-reordered',
                fromIndex: fromIndex,
                toIndex: toIndex,
                layerId: fromLayerId
            });
            
            this.log(`Reordered layer from ${fromIndex} to ${toIndex}`);
            
        } catch (error) {
            this.reportError('REORDER_LAYER_ERROR', 'Failed to reorder layers', error);
        }
    }
    
    updateBackgroundSize(width, height) {
        try {
            const backgroundLayer = this.layers.get(0);
            if (backgroundLayer && backgroundLayer.backgroundGraphics) {
                backgroundLayer.backgroundGraphics.clear();
                backgroundLayer.backgroundGraphics.beginFill(0xf0e0d6, 1);
                backgroundLayer.backgroundGraphics.drawRect(0, 0, width, height);
                backgroundLayer.backgroundGraphics.endFill();
                this.log(`Background size updated to ${width}x${height}`);
            }
        } catch (error) {
            this.reportError('UPDATE_BACKGROUND_ERROR', 'Failed to update background size', error);
        }
    }
    
    updateLayerUI() {
        try {
            const layerList = document.getElementById('layer-list');
            if (!layerList) {
                this.log('Layer list element not found');
                return;
            }
            
            layerList.innerHTML = '';
            
            // レイヤーを逆順で表示（UIでは上から下の順）
            const layerIds = Array.from(this.layers.keys()).filter(id => id !== 0).reverse();
            
            layerIds.forEach((layerId, index) => {
                const layer = this.layers.get(layerId);
                const layerItem = this.createLayerItem(layer, index);
                layerList.appendChild(layerItem);
            });
            
            // 背景レイヤーを最下部に追加
            const backgroundLayer = this.layers.get(0);
            if (backgroundLayer) {
                const backgroundItem = this.createBackgroundLayerItem(backgroundLayer);
                layerList.appendChild(backgroundItem);
            }
            
            this.log(`Layer UI updated: ${layerIds.length + 1} layers`);
            
        } catch (error) {
            this.reportError('UPDATE_UI_ERROR', 'Failed to update layer UI', error);
        }
    }
    
    createLayerItem(layer, index) {
        const layerItem = document.createElement('div');
        layerItem.className = `layer-item ${layer.id === this.activeLayerId ? 'active' : ''}`;
        layerItem.dataset.layerId = layer.id;
        layerItem.dataset.layerIndex = index;
        
        const eyeIcon = layer.visible ? 
            '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye-icon lucide-eye"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>' :
            '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye-off-icon lucide-eye-off"><path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/></svg>';
        
        layerItem.innerHTML = `
            <div class="layer-name">${layer.name}</div>
            <div class="layer-visibility ${layer.visible ? '' : 'hidden'}" data-action="toggle-visibility">
                ${eyeIcon}
            </div>
        `;
        
        // イベントハンドラー
        layerItem.addEventListener('click', (e) => {
            const action = e.target.closest('[data-action]')?.dataset.action;
            if (action === 'toggle-visibility') {
                this.toggleLayerVisibility(layer.id);
            } else if (!this.dragState.dragging) {
                this.setActiveLayer(layer.id);
            }
        });
        
        // ドラッグ機能設定
        this.setupLayerDrag(layerItem, index);
        
        return layerItem;
    }
    
    createBackgroundLayerItem(backgroundLayer) {
        const backgroundItem = document.createElement('div');
        backgroundItem.className = `layer-item ${0 === this.activeLayerId ? 'active' : ''}`;
        backgroundItem.dataset.layerId = 0;
        
        const eyeIcon = backgroundLayer.visible ? 
            '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye-icon lucide-eye"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>' :
            '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye-off-icon lucide-eye-off"><path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0 .696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/></svg>';
        
        backgroundItem.innerHTML = `
            <div class="layer-name">${backgroundLayer.name}</div>
            <div class="layer-visibility ${backgroundLayer.visible ? '' : 'hidden'}" data-action="toggle-visibility">
                ${eyeIcon}
            </div>
        `;
        
        backgroundItem.addEventListener('click', (e) => {
            const action = e.target.closest('[data-action]')?.dataset.action;
            if (action === 'toggle-visibility') {
                this.toggleLayerVisibility(0);
            } else {
                this.setActiveLayer(0);
            }
        });
        
        return backgroundItem;
    }
    
    setupLayerDrag(layerItem, index) {
        const layerName = layerItem.querySelector('.layer-name');
        
        layerName.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            
            this.dragState.dragging = true;
            this.dragState.dragItem = layerItem;
            this.dragState.startY = e.clientY;
            this.dragState.offset = e.clientY - layerItem.getBoundingClientRect().top;
            
            layerItem.classList.add('dragging');
            
            const boundMouseMove = this.onLayerDrag.bind(this);
            const boundMouseUp = this.onLayerDragEnd.bind(this);
            
            document.addEventListener('mousemove', boundMouseMove);
            document.addEventListener('mouseup', boundMouseUp);
            
            this.dragState.boundMouseMove = boundMouseMove;
            this.dragState.boundMouseUp = boundMouseUp;
            
            e.preventDefault();
            e.stopPropagation();
        });
    }
    
    onLayerDrag(e) {
        if (!this.dragState.dragging || !this.dragState.dragItem) return;
        
        const layerList = document.getElementById('layer-list');
        const items = Array.from(layerList.children).filter(item => 
            !item.dataset.layerId || item.dataset.layerId !== '0'
        );
        
        const dragItem = this.dragState.dragItem;
        dragItem.style.position = 'absolute';
        dragItem.style.top = (e.clientY - this.dragState.offset) + 'px';
        dragItem.style.zIndex = '1000';
        
        items.forEach(item => {
            item.classList.remove('drop-target');
            if (item !== dragItem) {
                const rect = item.getBoundingClientRect();
                if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
                    item.classList.add('drop-target');
                }
            }
        });
        
        e.preventDefault();
    }
    
    onLayerDragEnd(e) {
        if (!this.dragState.dragging || !this.dragState.dragItem) return;
        
        const layerList = document.getElementById('layer-list');
        const items = Array.from(layerList.children).filter(item => 
            !item.dataset.layerId || item.dataset.layerId !== '0'
        );
        const dragItem = this.dragState.dragItem;
        
        const dropTarget = items.find(item => 
            item !== dragItem && item.classList.contains('drop-target')
        );
        
        if (dropTarget) {
            const fromIndex = parseInt(dragItem.dataset.layerIndex);
            const toIndex = parseInt(dropTarget.dataset.layerIndex);
            this.reorderLayers(fromIndex, toIndex);
        }
        
        // クリーンアップ
        dragItem.classList.remove('dragging');
        dragItem.style.position = '';
        dragItem.style.top = '';
        dragItem.style.zIndex = '';
        
        items.forEach(item => item.classList.remove('drop-target'));
        
        if (this.dragState.boundMouseMove) {
            document.removeEventListener('mousemove', this.dragState.boundMouseMove);
        }
        if (this.dragState.boundMouseUp) {
            document.removeEventListener('mouseup', this.dragState.boundMouseUp);
        }
        
        this.dragState = {
            dragging: false,
            dragItem: null,
            startY: 0,
            offset: 0,
            boundMouseMove: null,
            boundMouseUp: null
        };
        
        setTimeout(() => this.updateLayerUI(), 100);
    }
    
    updateStatusDisplay() {
        const activeLayer = this.getActiveLayer();
        const element = document.getElementById('current-layer');
        if (element && activeLayer) {
            element.textContent = activeLayer.name;
        }
    }
    
    // レイヤー統計情報
    getLayerStats() {
        const totalLayers = this.layers.size;
        const visibleLayers = Array.from(this.layers.values()).filter(l => l.visible).length;
        const totalPaths = Array.from(this.layers.values()).reduce((sum, layer) => sum + layer.paths.length, 0);
        
        return {
            totalLayers,
            visibleLayers,
            hiddenLayers: totalLayers - visibleLayers,
            totalPaths,
            activeLayerId: this.activeLayerId
        };
    }
    
    // レイヤーデータのシリアライズ（修正: 軽量化、循環参照回避）
    serialize() {
        const data = {
            version: '8.0.8',
            timestamp: Date.now(),
            activeLayerId: this.activeLayerId,
            nextLayerId: this.nextLayerId,
            layers: {}
        };
        
        this.layers.forEach((layer, id) => {
            data.layers[id] = {
                id: layer.id,
                name: layer.name,
                visible: layer.visible,
                isBackground: layer.isBackground,
                timestamp: layer.timestamp,
                pathCount: layer.paths.length
                // container や graphics オブジェクトは除外
            };
        });
        
        return data;
    }
    
    // ユーティリティメソッド
    log(message, ...args) {
        const config = this.mainApi?.getConfig();
        if (config?.debug) {
            console.log(`[LayerManager] ${message}`, ...args);
        }
    }
    
    reportError(code, message, error) {
        // 修正: typeを必ず追加
        this.mainApi?.notify({
            type: 'error',
            code,
            message,
            error: error?.message || error,
            stack: error?.stack,
            timestamp: Date.now(),
            source: 'LayerManager'
        });
    }
    
    // Public API（修正: 軽量化されたレスポンス）
    getApi() {
        return {
            createLayer: (name) => this.createLayer(name),
            deleteLayer: (layerId) => this.deleteLayer(layerId),
            setActiveLayer: (layerId) => this.setActiveLayer(layerId),
            toggleLayerVisibility: (layerId) => this.toggleLayerVisibility(layerId),
            getActiveLayer: () => {
                // 軽量化されたアクティブレイヤー情報のみ返す
                const layer = this.getActiveLayer();
                return layer ? {
                    id: layer.id,
                    name: layer.name,
                    visible: layer.visible,
                    isBackground: layer.isBackground,
                    pathCount: layer.paths.length
                } : null;
            },
            addPathToActiveLayer: (path) => this.addPathToActiveLayer(path),
            reorderLayers: (fromIndex, toIndex) => this.reorderLayers(fromIndex, toIndex),
            updateBackgroundSize: (width, height) => this.updateBackgroundSize(width, height),
            getStats: () => this.getLayerStats(),
            serialize: () => this.serialize(),
            getLayers: () => {
                // 軽量化されたレイヤー情報のMapを返す
                const lightweightLayers = new Map();
                this.layers.forEach((layer, id) => {
                    lightweightLayers.set(id, {
                        id: layer.id,
                        name: layer.name,
                        visible: layer.visible,
                        isBackground: layer.isBackground,
                        pathCount: layer.paths.length,
                        timestamp: layer.timestamp
                    });
                });
                return lightweightLayers;
            }
        };
    }
};