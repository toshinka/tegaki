// ===== ui/status-display-renderer.js - 完全版 =====
// ステータス表示レンダラー

window.TegakiUI = window.TegakiUI || {};

window.TegakiUI.StatusDisplayRenderer = class StatusDisplayRenderer {
    constructor(eventBus) {
        this.eventBus = eventBus || window.TegakiEventBus;
        this.elements = {
            currentTool: null,
            currentLayer: null,
            canvasInfo: null,
            coordinates: null
        };
        
        this.init();
    }
    
    init() {
        this.cacheElements();
        this.setupEventListeners();
    }
    
    cacheElements() {
        this.elements.currentTool = document.getElementById('current-tool');
        this.elements.currentLayer = document.getElementById('current-layer');
        this.elements.canvasInfo = document.getElementById('canvas-info');
        this.elements.coordinates = document.getElementById('coordinates');
    }
    
    setupEventListeners() {
        if (!this.eventBus) return;
        
        // ツール変更
        this.eventBus.on('tool:changed', ({ newTool }) => {
            this.updateTool(newTool);
        });
        
        // レイヤー変更
        this.eventBus.on('layer:activated', ({ layerIndex, layerId }) => {
            if (window.layerManager) {
                const layers = window.layerManager.getLayers();
                const layer = layers[layerIndex];
                if (layer && layer.layerData) {
                    this.updateLayer(layer.layerData.name);
                }
            }
        });
        
        // UI状態更新
        this.eventBus.on('ui:status-updated', (data) => {
            if (data.currentLayer) {
                this.updateLayer(data.currentLayer);
            }
        });
        
        // キャンバスリサイズ
        this.eventBus.on('canvas:resized', ({ width, height }) => {
            this.updateCanvasInfo(width, height);
        });
        
        // マウス座標
        this.eventBus.on('ui:mouse-move', ({ x, y }) => {
            this.updateCoordinates(x, y);
        });
    }
    
    updateTool(toolName) {
        if (!this.elements.currentTool) return;
        
        const toolNames = {
            'pen': 'ベクターペン',
            'eraser': '消しゴム',
            'move': 'レイヤー移動',
            'gif-animation': 'GIFアニメーション'
        };
        
        this.elements.currentTool.textContent = toolNames[toolName] || toolName;
    }
    
    updateLayer(layerName) {
        if (!this.elements.currentLayer) return;
        this.elements.currentLayer.textContent = layerName || 'なし';
    }
    
    updateCanvasInfo(width, height) {
        if (!this.elements.canvasInfo) return;
        this.elements.canvasInfo.textContent = `${width}×${height}px`;
    }
    
    updateCoordinates(x, y) {
        if (!this.elements.coordinates) return;
        this.elements.coordinates.textContent = `X: ${Math.round(x)}, Y: ${Math.round(y)}`;
    }
    
    setTool(tool) {
        this.updateTool(tool);
    }
    
    setLayer(layerName) {
        this.updateLayer(layerName);
    }
    
    setCanvasSize(width, height) {
        this.updateCanvasInfo(width, height);
    }
    
    destroy() {
        // EventBusリスナーのクリーンアップは必要に応じて実装
    }
};

console.log('✅ ui/status-display-renderer.js loaded');