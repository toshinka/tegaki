/**
 * ================================================================================
 * ui/status-display-renderer.js - DPR表示維持版【v8.14.0】
 * ================================================================================
 * 
 * 【依存関係 - Parents】
 *   - system/event-bus.js (イベント受信)
 *   - system/settings-manager.js (設定参照)
 * 
 * 【依存関係 - Children】
 *   なし
 * 
 * 【責務】
 *   - ステータスバー表示制御
 *   - ツール/レイヤー/座標/FPS/DPR表示
 * 
 * 【v8.14.0 改修内容】
 *   ✅ DPR表示を維持（情報表示用）
 *   ✅ 出力時は常に1xであることを明示する説明追加
 * ================================================================================
 */

window.TegakiUI = window.TegakiUI || {};

window.TegakiUI.StatusDisplayRenderer = class StatusDisplayRenderer {
    constructor(eventBus, settingsManager) {
        this.eventBus = eventBus || window.TegakiEventBus;
        this.settingsManager = settingsManager;
        this.elements = {
            currentTool: null,
            currentLayer: null,
            canvasInfo: null,
            coordinates: null,
            dprInfo: null
        };
        
        this.init();
    }
    
    init() {
        this.cacheElements();
        this.setupEventListeners();
        this.updateDPRInfo();
    }
    
    cacheElements() {
        this.elements.currentTool = document.getElementById('current-tool');
        this.elements.currentLayer = document.getElementById('current-layer');
        this.elements.canvasInfo = document.getElementById('canvas-info');
        this.elements.coordinates = document.getElementById('coordinates');
        this.elements.dprInfo = document.getElementById('dpr-info');
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
            'fill': '塗りつぶし',
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
    
    /**
     * DPR表示更新
     * 
     * 🔧 v8.14.0 注記:
     *   - 画面DPRを表示（情報提供用）
     *   - 出力時は常に1xであることをツールチップで明示
     */
    updateDPRInfo() {
        if (!this.elements.dprInfo) return;
        
        const dpr = window.devicePixelRatio || 1;
        this.elements.dprInfo.textContent = dpr.toFixed(1);
        
        // ツールチップで出力時の動作を説明
        if (this.elements.dprInfo.parentElement) {
            this.elements.dprInfo.parentElement.title = 
                '画面表示DPI: ' + dpr.toFixed(1) + 'x\n' +
                '出力時は常に1x（等倍）で出力されます';
        }
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

console.log('✅ ui/status-display-renderer.js v8.14.0 loaded (DPR表示維持)');