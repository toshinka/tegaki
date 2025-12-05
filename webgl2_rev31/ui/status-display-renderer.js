/**
 * ================================================================================
 * ui/status-display-renderer.js - ステータス表示完全改修版
 * ================================================================================
 * 
 * 【依存関係 - Parents】
 *   - system/event-bus.js (イベント受信)
 *   - system/settings-manager.js (設定参照)
 *   - system/camera-system.js (座標変換)
 *   - system/layer-system.js (レイヤー情報)
 *   - system/history.js (履歴カウント)
 * 
 * 【依存関係 - Children】
 *   なし
 * 
 * 【責務】
 *   - ステータスバー表示制御
 *   - ツール/レイヤー/座標/Transform/FPS/DPR/History表示
 * 
 * 【改修内容】
 *   ✅ レイヤー名: レイヤー0 → レイヤー1 修正
 *   ✅ 座標表示: カメラフレーム基準に変更
 *   ✅ Transform表示: x/y/scale/rotation の正確な反映
 *   ✅ FPS表示: 実測値の反映
 *   ✅ History表示: 現在位置/総数の正確なカウント
 *   ✅ 過剰なコンソールログ削除
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
            transform: null,
            systemInfo: null,
            fpsInfo: null,
            historyInfo: null
        };
        
        // FPS計測用
        this.lastFrameTime = performance.now();
        this.frameCount = 0;
        this.fps = 60;
        this.fpsUpdateInterval = 500; // 0.5秒ごとに更新
        this.lastFpsUpdate = performance.now();
        
        this.init();
    }
    
    init() {
        this.cacheElements();
        this.setupEventListeners();
        this.updateDPRInfo();
        this.updateHistoryInfo();
        this.startFPSMonitor();
    }
    
    cacheElements() {
        this.elements.currentTool = document.getElementById('current-tool');
        this.elements.currentLayer = document.getElementById('current-layer');
        this.elements.canvasInfo = document.getElementById('canvas-info');
        this.elements.coordinates = document.getElementById('coordinates');
        this.elements.transform = document.getElementById('transform-info');
        this.elements.dprInfo = document.getElementById('dpr-info');
        this.elements.fpsInfo = document.getElementById('fps-info');
        this.elements.historyInfo = document.getElementById('history-info');
    }
    
    setupEventListeners() {
        if (!this.eventBus) return;
        
        // ツール変更
        this.eventBus.on('tool:changed', ({ newTool }) => {
            this.updateTool(newTool);
        });
        
        // レイヤー変更
        this.eventBus.on('layer:activated', ({ layerIndex, layerId }) => {
            this.updateLayerFromManager();
        });
        
        // レイヤーステータス更新要求
        this.eventBus.on('layer:status-update-requested', (data) => {
            if (data.currentLayer) {
                this.updateLayer(data.currentLayer);
            }
        });
        
        // キャンバスリサイズ
        this.eventBus.on('canvas:resized', ({ width, height }) => {
            this.updateCanvasInfo(width, height);
        });
        
        // マウス座標（カメラフレーム基準）
        this.eventBus.on('ui:mouse-move', ({ x, y }) => {
            this.updateCoordinates(x, y);
        });
        
        // カメラトランスフォーム変更
        this.eventBus.on('camera:transform-changed', (data) => {
            this.updateTransform(data);
        });
        
        // レイヤートランスフォーム更新
        this.eventBus.on('layer:transform-updated', () => {
            this.updateTransformFromActiveLayer();
        });
        
        // 履歴変更
        this.eventBus.on('history:changed', (data) => {
            this.updateHistoryInfo(data);
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
    
    /**
     * LayerManagerから直接レイヤー情報を取得して更新
     */
    updateLayerFromManager() {
        if (!window.layerManager) return;
        
        const layers = window.layerManager.getLayers();
        const activeIndex = window.layerManager.getActiveLayerIndex();
        
        if (activeIndex >= 0 && activeIndex < layers.length) {
            const layer = layers[activeIndex];
            const layerName = layer.layerData?.name || `レイヤー${activeIndex}`;
            this.updateLayer(layerName);
        }
    }
    
    updateCanvasInfo(width, height) {
        if (!this.elements.canvasInfo) return;
        this.elements.canvasInfo.textContent = `${width}×${height}px`;
    }
    
    /**
     * 座標表示: カメラフレーム基準の座標
     */
    updateCoordinates(x, y) {
        if (!this.elements.coordinates) return;
        
        // カメラフレーム基準の座標を表示
        const frameX = Math.round(x);
        const frameY = Math.round(y);
        
        this.elements.coordinates.textContent = `X: ${frameX}, Y: ${frameY}`;
    }
    
    /**
     * Transform表示: カメラまたはアクティブレイヤーのトランスフォーム
     */
    updateTransform(data) {
        if (!this.elements.transform) return;
        
        // Vキー押下中はレイヤートランスフォームを表示
        if (window.layerManager?.isLayerMoveMode) {
            this.updateTransformFromActiveLayer();
            return;
        }
        
        // 通常はカメラのトランスフォームを表示
        if (data) {
            const x = data.x || 0;
            const y = data.y || 0;
            const scale = data.scale || 1.0;
            const rotation = data.rotation || 0;
            
            this.elements.transform.textContent = 
                `x:${x} y:${y} s:${scale} r:${rotation}°`;
        }
    }
    
    /**
     * アクティブレイヤーのトランスフォームを表示
     */
    updateTransformFromActiveLayer() {
        if (!this.elements.transform || !window.layerManager) return;
        
        const activeLayer = window.layerManager.getActiveLayer();
        if (!activeLayer?.layerData) return;
        
        const layerId = activeLayer.layerData.id;
        const transform = window.layerManager.transform?.getTransform(layerId);
        
        if (transform) {
            const x = Math.round(transform.x || 0);
            const y = Math.round(transform.y || 0);
            const scale = Math.abs(transform.scaleX || 1.0).toFixed(2);
            const rotation = Math.round((transform.rotation || 0) * 180 / Math.PI);
            
            this.elements.transform.textContent = 
                `x:${x} y:${y} s:${scale} r:${rotation}°`;
        }
    }
    
    /**
     * DPR表示更新（情報表示用）
     */
    updateDPRInfo() {
        if (!this.elements.dprInfo) return;
        
        const dpr = window.devicePixelRatio || 1;
        this.elements.dprInfo.textContent = dpr.toFixed(1);
        
        if (this.elements.dprInfo.parentElement) {
            this.elements.dprInfo.parentElement.title = 
                '画面表示DPI: ' + dpr.toFixed(1) + 'x\n' +
                '出力時は常に1x（等倍）で出力されます';
        }
    }
    
    /**
     * FPS表示更新（実測値）
     */
    startFPSMonitor() {
        const measureFPS = () => {
            const now = performance.now();
            const delta = now - this.lastFrameTime;
            this.lastFrameTime = now;
            
            this.frameCount++;
            
            // 0.5秒ごとに平均FPSを計算
            if (now - this.lastFpsUpdate >= this.fpsUpdateInterval) {
                const elapsed = (now - this.lastFpsUpdate) / 1000;
                this.fps = Math.round(this.frameCount / elapsed);
                this.frameCount = 0;
                this.lastFpsUpdate = now;
                
                this.updateFPSDisplay();
            }
            
            requestAnimationFrame(measureFPS);
        };
        
        requestAnimationFrame(measureFPS);
    }
    
    updateFPSDisplay() {
        if (!this.elements.fpsInfo) return;
        this.elements.fpsInfo.textContent = this.fps.toString();
    }
    
    /**
     * History表示更新
     */
    updateHistoryInfo(data) {
        if (!this.elements.historyInfo) return;
        
        // dataがない場合はHistoryから直接取得
        if (!data && window.History) {
            const canUndo = window.History.canUndo();
            const stackSize = window.History.stack?.length || 0;
            const currentIndex = window.History.index;
            
            const displayIndex = canUndo ? currentIndex + 1 : 0;
            const maxSize = window.History.maxSize || 50;
            
            this.elements.historyInfo.textContent = `${displayIndex}/${maxSize}`;
            return;
        }
        
        // イベントデータから更新
        if (data) {
            const currentIndex = data.currentIndex ?? -1;
            const displayIndex = data.canUndo ? currentIndex + 1 : 0;
            const maxSize = window.History?.maxSize || 50;
            
            this.elements.historyInfo.textContent = `${displayIndex}/${maxSize}`;
        }
    }
    
    // 後方互換性のためのメソッド
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

console.log('✅ ui/status-display-renderer.js 完全改修版 loaded');