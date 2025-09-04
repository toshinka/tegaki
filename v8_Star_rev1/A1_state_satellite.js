/**
 * 🛰️ A1_state_satellite.js - 状態管理衛星
 * 
 * 【責務】: 全アプリケーション状態の一元管理
 * - レイヤー状態（layers, activeLayerId, layerOrder）
 * - ツール状態（currentTool, toolSettings）  
 * - 履歴管理（undoStack, redoStack）
 * - 特殊レイヤー（layer0 - 背景/用紙）
 * 
 * 【AI可読性】: 状態変更は全てこの衛星経由で行う
 * 【改修容易性】: 状態関連の変更はこのファイルのみで完結
 * 【肥大化対策】: 将来的にA1内部をさらに分割可能（A1a, A1b等）
 */

// ==== StateManager: 一元化された状態管理 ====
class StateManager {
    constructor() {
        // === レイヤー状態管理 ===
        this.layers = [];                    // レイヤーオブジェクト配列
        this.activeLayerId = null;           // 現在選択中レイヤーID
        this.layerOrder = [];               // 描画順序管理（下から上）
        this.nextLayerId = 1;               // 次に作成するレイヤーID
        
        // === レイヤー0（背景/用紙）特殊状態 ===
        this.layer0 = {
            visible: 'open',                // 'open' | 'closed' | 'disabled'
            opacity: 1.0,                   // 0.0 ~ 1.0
            color: 0xf0e0d6,               // 背景色
            isTransparent: false            // 透明フラグ
        };
        
        // === ツール状態管理 ===
        this.currentTool = 'pen';           // 'pen' | 'eraser' | 'layer' | 'resize'
        this.toolSettings = {
            pen: {
                size: 16.0,                 // ペンサイズ
                opacity: 0.85,              // ペン不透明度
                color: 0x800000             // ペン色（ふたば赤）
            },
            eraser: {
                size: 20.0,                 // 消しゴムサイズ
                mode: 'soft'                // 'soft' | 'hard'
            }
        };
        
        // === 履歴管理 ===
        this.undoStack = [];                // アンドゥ履歴スタック
        this.redoStack = [];                // リドゥ履歴スタック
        this.maxHistorySize = 50;           // 履歴保持最大数
        
        // === UI状態管理 ===
        this.uiState = {
            layerPanelVisible: true,        // レイヤーパネル表示状態
            checkerboardVisible: false,     // チェッカーボード表示状態
            spacePressed: false,            // スペースキー押下状態
            canvasPosition: { x: 0, y: 0 }  // キャンバス位置
        };
        
        // === イベント配信用 ===
        this.subscribers = new Map();       // イベント購読者管理
        this.initialized = false;
    }
    
    // ==== 初期化 ====
    initialize() {
        this.createBackgroundLayer();
        this.initialized = true;
        this.notifySubscribers('state.initialized', this.getState());
        console.log('🛰️ StateManager: Initialized with background layer');
        return true;
    }
    
    // ==== イベント購読管理 ====
    subscribe(event, callback) {
        if (!this.subscribers.has(event)) {
            this.subscribers.set(event, []);
        }
        this.subscribers.get(event).push(callback);
        console.log(`🛰️ StateManager: Subscribed to ${event}`);
    }
    
    unsubscribe(event, callback) {
        if (this.subscribers.has(event)) {
            const callbacks = this.subscribers.get(event);
            const index = callbacks.indexOf(callback);
            if (index !== -1) {
                callbacks.splice(index, 1);
            }
        }
    }
    
    notifySubscribers(event, data) {
        if (this.subscribers.has(event)) {
            this.subscribers.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`🛰️ StateManager: Error in subscriber for ${event}:`, error);
                }
            });
        }
    }
    
    // ==== レイヤー状態管理 ====
    
    createBackgroundLayer() {
        const backgroundLayer = {
            id: 0,
            name: '背景',
            visible: 'open',
            opacity: 1.0,
            isBackground: true,
            paths: []
        };
        
        this.layers.push(backgroundLayer);
        this.layerOrder.push(0);
        this.activeLayerId = 0;
        
        this.updateCheckerboardVisibility();
        console.log('🛰️ StateManager: Background layer created');
    }
    
    createNewLayer(options = {}) {
        const {
            name = null,
            opacity = 1.0,
            insertAfterActive = true
        } = options;
        
        const layerId = this.nextLayerId++;
        const layerName = name || `レイヤー${layerId}`;
        
        const newLayer = {
            id: layerId,
            name: layerName,
            visible: 'open',
            opacity: opacity,
            isBackground: false,
            paths: []
        };
        
        // レイヤー配列に追加
        this.layers.push(newLayer);
        
        // 描画順序に追加
        if (insertAfterActive && this.activeLayerId !== null) {
            const activeIndex = this.layerOrder.indexOf(this.activeLayerId);
            this.layerOrder.splice(activeIndex + 1, 0, layerId);
        } else {
            this.layerOrder.push(layerId);
        }
        
        // 新しいレイヤーをアクティブにする
        this.setActiveLayer(layerId);
        
        // 履歴記録
        this.recordHistory({
            type: 'layer.created',
            layerId: layerId,
            layer: this.cloneLayer(newLayer)
        });
        
        this.notifySubscribers('layer.created', { layerId, layer: newLayer });
        console.log(`🛰️ StateManager: Layer created - ${layerName} (ID: ${layerId})`);
        
        return newLayer;
    }
    
    deleteLayer(layerId, recordUndo = true) {
        // 背景レイヤーは削除不可
        if (layerId === 0) {
            console.warn('🛰️ StateManager: Cannot delete background layer');
            return false;
        }
        
        // 最低1つのレイヤーが必要
        const nonBackgroundLayers = this.layers.filter(l => !l.isBackground);
        if (nonBackgroundLayers.length <= 1) {
            console.warn('🛰️ StateManager: Cannot delete last layer');
            return false;
        }
        
        const layer = this.getLayerById(layerId);
        if (!layer) {
            console.warn(`🛰️ StateManager: Layer ${layerId} not found`);
            return false;
        }
        
        // 履歴記録
        if (recordUndo) {
            this.recordHistory({
                type: 'layer.deleted',
                layerId: layerId,
                layer: this.cloneLayer(layer),
                orderIndex: this.layerOrder.indexOf(layerId)
            });
        }
        
        // レイヤー配列から削除
        this.layers = this.layers.filter(l => l.id !== layerId);
        
        // 描画順序から削除
        const orderIndex = this.layerOrder.indexOf(layerId);
        this.layerOrder.splice(orderIndex, 1);
        
        // アクティブレイヤーの調整
        if (this.activeLayerId === layerId) {
            const newActiveIndex = Math.max(0, orderIndex - 1);
            this.activeLayerId = this.layerOrder[newActiveIndex];
        }
        
        this.updateCheckerboardVisibility();
        this.notifySubscribers('layer.deleted', { layerId, layer });
        console.log(`🛰️ StateManager: Layer deleted - ${layer.name} (ID: ${layerId})`);
        
        return true;
    }
    
    setActiveLayer(layerId) {
        const layer = this.getLayerById(layerId);
        if (!layer) {
            console.warn(`🛰️ StateManager: Layer ${layerId} not found`);
            return false;
        }
        
        const oldActiveId = this.activeLayerId;
        this.activeLayerId = layerId;
        
        this.notifySubscribers('layer.activated', { 
            layerId, 
            oldActiveId, 
            layer 
        });
        console.log(`🛰️ StateManager: Active layer changed - ${layer.name} (ID: ${layerId})`);
        
        return true;
    }
    
    setLayerVisibility(layerId, visibility) {
        const layer = this.getLayerById(layerId);
        if (!layer) return false;
        
        const validStates = ['open', 'closed', 'disabled'];
        if (!validStates.includes(visibility)) {
            console.warn(`🛰️ StateManager: Invalid visibility state - ${visibility}`);
            return false;
        }
        
        const oldVisibility = layer.visible;
        layer.visible = visibility;
        
        // 背景レイヤーの場合、layer0状態も更新
        if (layerId === 0) {
            this.layer0.visible = visibility;
        }
        
        this.updateCheckerboardVisibility();
        this.notifySubscribers('layer.visibility.changed', {
            layerId,
            visibility,
            oldVisibility,
            layer
        });
        console.log(`🛰️ StateManager: Layer visibility - ${layer.name}: ${oldVisibility} → ${visibility}`);
        
        return true;
    }
    
    toggleLayerVisibility(layerId) {
        const layer = this.getLayerById(layerId);
        if (!layer) return false;
        
        const states = ['open', 'closed', 'disabled'];
        const currentIndex = states.indexOf(layer.visible);
        const nextIndex = (currentIndex + 1) % states.length;
        
        return this.setLayerVisibility(layerId, states[nextIndex]);
    }
    
    setLayerOpacity(layerId, opacity) {
        const layer = this.getLayerById(layerId);
        if (!layer) return false;
        
        const clampedOpacity = Math.max(0, Math.min(1, opacity));
        const oldOpacity = layer.opacity;
        layer.opacity = clampedOpacity;
        
        // 背景レイヤーの場合、layer0状態も更新
        if (layerId === 0) {
            this.layer0.opacity = clampedOpacity;
        }
        
        this.updateCheckerboardVisibility();
        this.notifySubscribers('layer.opacity.changed', {
            layerId,
            opacity: clampedOpacity,
            oldOpacity,
            layer
        });
        console.log(`🛰️ StateManager: Layer opacity - ${layer.name}: ${Math.round(oldOpacity * 100)}% → ${Math.round(clampedOpacity * 100)}%`);
        
        return true;
    }
    
    reorderLayers(fromIndex, toIndex) {
        // 境界チェック
        if (fromIndex < 0 || fromIndex >= this.layerOrder.length ||
            toIndex < 0 || toIndex >= this.layerOrder.length ||
            fromIndex === toIndex) {
            return false;
        }
        
        // 背景レイヤー（位置0）は移動不可
        const fromLayerId = this.layerOrder[fromIndex];
        if (fromLayerId === 0 || toIndex === 0) {
            console.warn('🛰️ StateManager: Cannot reorder background layer');
            return false;
        }
        
        // 順序配列を更新
        const layerId = this.layerOrder.splice(fromIndex, 1)[0];
        this.layerOrder.splice(toIndex, 0, layerId);
        
        this.notifySubscribers('layer.reordered', {
            layerId,
            fromIndex,
            toIndex,
            newOrder: [...this.layerOrder]
        });
        console.log(`🛰️ StateManager: Layer reordered - ${fromIndex} → ${toIndex}`);
        
        return true;
    }
    
    // チェッカーボード表示制御
    updateCheckerboardVisibility() {
        const backgroundLayer = this.getLayerById(0);
        const shouldShow = !backgroundLayer || 
                           backgroundLayer.visible !== 'open' || 
                           backgroundLayer.opacity < 1.0;
        
        if (shouldShow !== this.uiState.checkerboardVisible) {
            this.uiState.checkerboardVisible = shouldShow;
            this.notifySubscribers('ui.checkerboard.changed', {
                visible: shouldShow
            });
        }
    }
    
    // ==== ツール状態管理 ====
    
    setCurrentTool(tool) {
        const validTools = ['pen', 'eraser', 'layer', 'resize'];
        if (!validTools.includes(tool)) {
            console.warn(`🛰️ StateManager: Invalid tool - ${tool}`);
            return false;
        }
        
        const oldTool = this.currentTool;
        this.currentTool = tool;
        
        this.notifySubscribers('tool.changed', {
            tool,
            oldTool,
            settings: this.toolSettings[tool] || {}
        });
        console.log(`🛰️ StateManager: Tool changed - ${oldTool} → ${tool}`);
        
        return true;
    }
    
    updateToolSettings(tool, settings) {
        if (!this.toolSettings[tool]) {
            this.toolSettings[tool] = {};
        }
        
        const oldSettings = { ...this.toolSettings[tool] };
        Object.assign(this.toolSettings[tool], settings);
        
        this.notifySubscribers('tool.settings.changed', {
            tool,
            settings: this.toolSettings[tool],
            oldSettings
        });
        console.log(`🛰️ StateManager: Tool settings updated - ${tool}`, settings);
        
        return true;
    }
    
    // ==== 履歴管理 ====
    
    recordHistory(action) {
        // リドゥスタックをクリア
        this.redoStack = [];
        
        // アンドゥスタックに追加
        this.undoStack.push({
            ...action,
            timestamp: Date.now()
        });
        
        // 履歴サイズ制限
        if (this.undoStack.length > this.maxHistorySize) {
            this.undoStack.shift();
        }
        
        this.notifySubscribers('history.recorded', {
            action,
            undoAvailable: this.undoStack.length > 0,
            redoAvailable: this.redoStack.length > 0
        });
    }
    
    canUndo() {
        return this.undoStack.length > 0;
    }
    
    canRedo() {
        return this.redoStack.length > 0;
    }
    
    undo() {
        if (!this.canUndo()) return false;
        
        const action = this.undoStack.pop();
        this.redoStack.push(action);
        
        this.processUndoAction(action);
        
        this.notifySubscribers('history.undo', {
            action,
            undoAvailable: this.undoStack.length > 0,
            redoAvailable: this.redoStack.length > 0
        });
        
        return true;
    }
    
    redo() {
        if (!this.canRedo()) return false;
        
        const action = this.redoStack.pop();
        this.undoStack.push(action);
        
        this.processRedoAction(action);
        
        this.notifySubscribers('history.redo', {
            action,
            undoAvailable: this.undoStack.length > 0,
            redoAvailable: this.redoStack.length > 0
        });
        
        return true;
    }
    
    processUndoAction(action) {
        switch (action.type) {
            case 'layer.created':
                // レイヤー作成のアンドゥ → レイヤー削除
                this.deleteLayer(action.layerId, false);
                break;
                
            case 'layer.deleted':
                // レイヤー削除のアンドゥ → レイヤー復元
                this.restoreLayer(action.layer, action.orderIndex);
                break;
                
            case 'layer.visibility.changed':
                // 表示状態変更のアンドゥ
                this.setLayerVisibility(action.layerId, action.oldVisibility);
                break;
                
            case 'layer.opacity.changed':
                // 不透明度変更のアンドゥ
                this.setLayerOpacity(action.layerId, action.oldOpacity);
                break;
                
            default:
                console.warn(`🛰️ StateManager: Unknown undo action - ${action.type}`);
        }
    }
    
    processRedoAction(action) {
        switch (action.type) {
            case 'layer.created':
                // レイヤー作成のリドゥ → レイヤー再作成
                this.restoreLayer(action.layer, action.orderIndex);
                break;
                
            case 'layer.deleted':
                // レイヤー削除のリドゥ → レイヤー再削除
                this.deleteLayer(action.layerId, false);
                break;
                
            case 'layer.visibility.changed':
                // 表示状態変更のリドゥ
                this.setLayerVisibility(action.layerId, action.visibility);
                break;
                
            case 'layer.opacity.changed':
                // 不透明度変更のリドゥ
                this.setLayerOpacity(action.layerId, action.opacity);
                break;
                
            default:
                console.warn(`🛰️ StateManager: Unknown redo action - ${action.type}`);
        }
    }
    
    restoreLayer(layerData, orderIndex) {
        // レイヤーデータを復元
        const restoredLayer = this.cloneLayer(layerData);
        
        // レイヤー配列に追加
        this.layers.push(restoredLayer);
        
        // 描画順序の指定位置に挿入
        if (orderIndex !== undefined && orderIndex >= 0 && orderIndex <= this.layerOrder.length) {
            this.layerOrder.splice(orderIndex, 0, restoredLayer.id);
        } else {
            this.layerOrder.push(restoredLayer.id);
        }
        
        this.notifySubscribers('layer.restored', { 
            layerId: restoredLayer.id, 
            layer: restoredLayer 
        });
        console.log(`🛰️ StateManager: Layer restored - ${restoredLayer.name} (ID: ${restoredLayer.id})`);
        
        return restoredLayer;
    }
    
    // ==== UI状態管理 ====
    
    setSpacePressed(pressed) {
        if (this.uiState.spacePressed !== pressed) {
            this.uiState.spacePressed = pressed;
            this.notifySubscribers('ui.space.changed', { pressed });
        }
    }
    
    setCanvasPosition(x, y) {
        this.uiState.canvasPosition.x = x;
        this.uiState.canvasPosition.y = y;
        this.notifySubscribers('ui.canvas.moved', { x, y });
    }
    
    setLayerPanelVisible(visible) {
        if (this.uiState.layerPanelVisible !== visible) {
            this.uiState.layerPanelVisible = visible;
            this.notifySubscribers('ui.layerpanel.changed', { visible });
        }
    }
    
    // ==== ユーティリティメソッド ====
    
    getLayerById(layerId) {
        return this.layers.find(layer => layer.id === layerId);
    }
    
    getActiveLayer() {
        return this.getLayerById(this.activeLayerId);
    }
    
    getLayerByIndex(index) {
        if (index >= 0 && index < this.layerOrder.length) {
            const layerId = this.layerOrder[index];
            return this.getLayerById(layerId);
        }
        return null;
    }
    
    getLayerIndex(layerId) {
        return this.layerOrder.indexOf(layerId);
    }
    
    getAllLayers() {
        return this.layerOrder.map(id => this.getLayerById(id)).filter(Boolean);
    }
    
    getVisibleLayers() {
        return this.getAllLayers().filter(layer => layer.visible === 'open');
    }
    
    cloneLayer(layer) {
        return {
            id: layer.id,
            name: layer.name,
            visible: layer.visible,
            opacity: layer.opacity,
            isBackground: layer.isBackground,
            paths: [...layer.paths] // パスは浅いクローン
        };
    }
    
    // ==== 状態取得 ====
    
    getState() {
        return {
            // レイヤー状態
            layers: this.getAllLayers(),
            activeLayerId: this.activeLayerId,
            layerOrder: [...this.layerOrder],
            layer0: { ...this.layer0 },
            
            // ツール状態
            currentTool: this.currentTool,
            toolSettings: JSON.parse(JSON.stringify(this.toolSettings)),
            
            // 履歴状態
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            historyCount: this.undoStack.length,
            
            // UI状態
            uiState: { ...this.uiState },
            
            // メタ情報
            initialized: this.initialized,
            layerCount: this.layers.length,
            nextLayerId: this.nextLayerId
        };
    }
    
    // ==== デバッグ用 ====
    
    dumpState() {
        console.group('🛰️ StateManager: Current State');
        console.log('Layers:', this.layers);
        console.log('Layer Order:', this.layerOrder);
        console.log('Active Layer ID:', this.activeLayerId);
        console.log('Current Tool:', this.currentTool);
        console.log('Tool Settings:', this.toolSettings);
        console.log('Undo Stack:', this.undoStack.length);
        console.log('Redo Stack:', this.redoStack.length);
        console.log('UI State:', this.uiState);
        console.groupEnd();
    }
    
    // ==== バリデーション ====
    
    validateState() {
        const errors = [];
        
        // レイヤー整合性チェック
        if (this.layers.length === 0) {
            errors.push('No layers exist');
        }
        
        if (this.activeLayerId !== null && !this.getLayerById(this.activeLayerId)) {
            errors.push(`Active layer ${this.activeLayerId} does not exist`);
        }
        
        // 順序整合性チェック
        if (this.layerOrder.length !== this.layers.length) {
            errors.push('Layer order length mismatch');
        }
        
        for (const layerId of this.layerOrder) {
            if (!this.getLayerById(layerId)) {
                errors.push(`Layer ${layerId} in order but not in layers`);
            }
        }
        
        // 背景レイヤーチェック
        const backgroundLayer = this.getLayerById(0);
        if (!backgroundLayer) {
            errors.push('Background layer missing');
        } else if (!backgroundLayer.isBackground) {
            errors.push('Background layer flag incorrect');
        }
        
        if (errors.length > 0) {
            console.error('🛰️ StateManager: State validation failed:', errors);
            return false;
        }
        
        console.log('🛰️ StateManager: State validation passed');
        return true;
    }
}

// ==== LayerManager: レイヤー操作の専門クラス ====
class LayerManager {
    constructor(stateManager) {
        this.state = stateManager;
        this.initialized = false;
    }
    
    initialize() {
        if (!this.state.initialized) {
            console.error('🛰️ LayerManager: StateManager not initialized');
            return false;
        }
        
        this.initialized = true;
        console.log('🛰️ LayerManager: Initialized');
        return true;
    }
    
    // 高レベルなレイヤー操作メソッド
    addLayer(name = null) {
        return this.state.createNewLayer({ name });
    }
    
    duplicateActiveLayer() {
        const activeLayer = this.state.getActiveLayer();
        if (!activeLayer) return null;
        
        const duplicated = this.state.createNewLayer({
            name: `${activeLayer.name} コピー`,
            opacity: activeLayer.opacity
        });
        
        // パスのコピーは描画衛星で処理される
        this.state.notifySubscribers('layer.duplicate.requested', {
            sourceLayerId: activeLayer.id,
            targetLayerId: duplicated.id
        });
        
        return duplicated;
    }
    
    mergeLayerDown(layerId = null) {
        const targetId = layerId || this.state.activeLayerId;
        const layer = this.state.getLayerById(targetId);
        
        if (!layer || layer.isBackground) {
            console.warn('🛰️ LayerManager: Cannot merge background layer');
            return false;
        }
        
        const layerIndex = this.state.getLayerIndex(targetId);
        if (layerIndex <= 0) {
            console.warn('🛰️ LayerManager: Cannot merge bottom layer');
            return false;
        }
        
        const belowLayerId = this.state.layerOrder[layerIndex - 1];
        const belowLayer = this.state.getLayerById(belowLayerId);
        
        if (!belowLayer) return false;
        
        // 描画衛星に結合処理を要求
        this.state.notifySubscribers('layer.merge.requested', {
            sourceLayerId: targetId,
            targetLayerId: belowLayerId,
            sourceName: layer.name,
            targetName: belowLayer.name
        });
        
        // 状態からレイヤーを削除
        this.state.deleteLayer(targetId);
        
        console.log(`🛰️ LayerManager: Layer merged - ${layer.name} → ${belowLayer.name}`);
        return true;
    }
    
    // レイヤー情報の取得
    getLayerInfo(layerId) {
        const layer = this.state.getLayerById(layerId);
        if (!layer) return null;
        
        return {
            id: layer.id,
            name: layer.name,
            visible: layer.visible,
            opacity: layer.opacity,
            isBackground: layer.isBackground,
            isActive: layer.id === this.state.activeLayerId,
            index: this.state.getLayerIndex(layer.id),
            pathCount: layer.paths.length
        };
    }
    
    getLayerList() {
        return this.state.getAllLayers().map(layer => this.getLayerInfo(layer.id));
    }
}

// ==== ToolManager: ツール操作の専門クラス ====
class ToolManager {
    constructor(stateManager) {
        this.state = stateManager;
        this.initialized = false;
    }
    
    initialize() {
        if (!this.state.initialized) {
            console.error('🛰️ ToolManager: StateManager not initialized');
            return false;
        }
        
        this.initialized = true;
        console.log('🛰️ ToolManager: Initialized');
        return true;
    }
    
    selectTool(tool) {
        return this.state.setCurrentTool(tool);
    }
    
    getCurrentTool() {
        return this.state.currentTool;
    }
    
    getToolSettings(tool = null) {
        const targetTool = tool || this.state.currentTool;
        return this.state.toolSettings[targetTool] || {};
    }
    
    updatePenSettings(settings) {
        return this.state.updateToolSettings('pen', settings);
    }
    
    updateEraserSettings(settings) {
        return this.state.updateToolSettings('eraser', settings);
    }
    
    // 便利メソッド
    setPenSize(size) {
        return this.updatePenSettings({ size });
    }
    
    setPenOpacity(opacity) {
        return this.updatePenSettings({ opacity });
    }
    
    setPenColor(color) {
        return this.updatePenSettings({ color });
    }
    
    setEraserSize(size) {
        return this.updateEraserSettings({ size });
    }
}

// ==== HistoryManager: 履歴操作の専門クラス ====
class HistoryManager {
    constructor(stateManager) {
        this.state = stateManager;
        this.initialized = false;
    }
    
    initialize() {
        if (!this.state.initialized) {
            console.error('🛰️ HistoryManager: StateManager not initialized');
            return false;
        }
        
        this.initialized = true;
        console.log('🛰️ HistoryManager: Initialized');
        return true;
    }
    
    undo() {
        return this.state.undo();
    }
    
    redo() {
        return this.state.redo();
    }
    
    canUndo() {
        return this.state.canUndo();
    }
    
    canRedo() {
        return this.state.canRedo();
    }
    
    clearHistory() {
        this.state.undoStack = [];
        this.state.redoStack = [];
        this.state.notifySubscribers('history.cleared', {});
        console.log('🛰️ HistoryManager: History cleared');
    }
    
    getHistoryInfo() {
        return {
            undoCount: this.state.undoStack.length,
            redoCount: this.state.redoStack.length,
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            maxSize: this.state.maxHistorySize
        };
    }
}

// ==== A1衛星の統合クラス ====
class A1StateSatellite {
    constructor() {
        this.stateManager = new StateManager();
        this.layerManager = new LayerManager(this.stateManager);
        this.toolManager = new ToolManager(this.stateManager);
        this.historyManager = new HistoryManager(this.stateManager);
        this.initialized = false;
    }
    
    async initialize() {
        try {
            // StateManagerを初期化
            if (!this.stateManager.initialize()) {
                throw new Error('StateManager initialization failed');
            }
            
            // 各Managerを初期化
            if (!this.layerManager.initialize()) {
                throw new Error('LayerManager initialization failed');
            }
            
            if (!this.toolManager.initialize()) {
                throw new Error('ToolManager initialization failed');
            }
            
            if (!this.historyManager.initialize()) {
                throw new Error('HistoryManager initialization failed');
            }
            
            this.initialized = true;
            console.log('🛰️ A1StateSatellite: All managers initialized successfully');
            return true;
            
        } catch (error) {
            console.error('🛰️ A1StateSatellite: Initialization failed:', error);
            return false;
        }
    }
    
    // 主星Hubからアクセスするための統合API
    getManagers() {
        return {
            state: this.stateManager,
            layer: this.layerManager,
            tool: this.toolManager,
            history: this.historyManager
        };
    }
    
    // デバッグ用
    dumpAllState() {
        console.group('🛰️ A1StateSatellite: Complete State Dump');
        this.stateManager.dumpState();
        console.log('Layer Manager Info:', this.layerManager.getLayerList());
        console.log('Tool Manager Info:', {
            current: this.toolManager.getCurrentTool(),
            settings: this.toolManager.getToolSettings()
        });
        console.log('History Manager Info:', this.historyManager.getHistoryInfo());
        console.groupEnd();
    }
    
    validateAllState() {
        return this.stateManager.validateState();
    }
}

// ==== グローバルエクスポート ====
if (typeof window !== 'undefined') {
    window.A1StateSatellite = A1StateSatellite;
    window.StateManager = StateManager;
    window.LayerManager = LayerManager;
    window.ToolManager = ToolManager;
    window.HistoryManager = HistoryManager;
    
    console.log('🛰️ A1StateSatellite: Classes exported to global scope');
}