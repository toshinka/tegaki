/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵かきツール v8rev7
 * ツール・UI統合ハブ (futaba_tools.js)
 * 描画ツール・UI管理・レイヤーシステム統合版
 */

// ==== LayerManager: Layer System with Drag Ordering ====
/**
 * 【目的】レイヤーシステム・ドラッグ機能・UI統合管理
 * 【入力】LayerBridge インスタンス
 * 【出力】レイヤー作成・削除・並び替え・表示制御
 * 【副作用】PIXI Container の追加・削除・並び替え、DOM の layer-list 更新
 */
class LayerManager {
    constructor(layerBridge) {
        this.bridge = layerBridge;
        this.layers = new Map();
        this.activeLayerId = null;
        this.nextLayerId = 1;
        this.ui = null;
        this.dragState = {
            dragging: false,
            dragItem: null,
            startY: 0,
            offset: 0
        };
    }
    
    initialize() {
        // Create background layer
        this.createLayer('背景', true);
        log('🎯 LayerManager: Background layer created');
    }
    
    createLayer(name = null, isBackground = false) {
        const layerId = isBackground ? 0 : this.nextLayerId++;
        const layerName = name || `レイヤー${layerId}`;
        
        const container = new PIXI.Container();
        container.name = layerName;
        container.visible = true;
        
        const layer = {
            id: layerId,
            name: layerName,
            container: container,
            visible: true,
            paths: []
        };
        
        this.layers.set(layerId, layer);
        
        // LayerBridge経由でPIXI Containerを追加
        this.bridge.addContainer(container);
        
        if (this.activeLayerId === null || isBackground) {
            this.activeLayerId = layerId;
        }
        
        this.updateLayerUI();
        log(`🎨 Layer created: ${layerName} (ID: ${layerId})`);
        return layer;
    }
    
    duplicateLayer(layerId) {
        const sourceLayer = this.layers.get(layerId);
        if (!sourceLayer) return null;
        
        const newLayer = this.createLayer(`${sourceLayer.name} コピー`);
        
        // Copy all paths from source layer
        sourceLayer.paths.forEach(path => {
            const newPath = this.clonePath(path);
            newLayer.container.addChild(newPath.graphics);
            newLayer.paths.push(newPath);
        });
        
        this.setActiveLayer(newLayer.id);
        log(`📋 Layer duplicated: ${sourceLayer.name} → ${newLayer.name}`);
        return newLayer;
    }
    
    clonePath(originalPath) {
        const clonedGraphics = new PIXI.Graphics();
        
        // Recreate path from points
        originalPath.points.forEach((point, index) => {
            clonedGraphics.circle(point.x, point.y, point.size / 2);
            clonedGraphics.fill({ 
                color: originalPath.color, 
                alpha: originalPath.opacity 
            });
        });
        
        return {
            id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            graphics: clonedGraphics,
            points: [...originalPath.points],
            color: originalPath.color,
            size: originalPath.size,
            opacity: originalPath.opacity,
            isComplete: originalPath.isComplete
        };
    }
    
    deleteLayer(layerId) {
        if (layerId === 0) return; // Cannot delete background layer
        if (this.layers.size <= 1) return; // Must have at least one layer
        
        const layer = this.layers.get(layerId);
        if (!layer) return;
        
        // Destroy all paths in layer
        layer.paths.forEach(path => {
            path.graphics.destroy();
        });
        
        // LayerBridge経由でPIXI Containerを削除
        this.bridge.removeContainer(layer.container);
        
        // Remove from layers map
        this.layers.delete(layerId);
        
        // Set new active layer if needed
        if (this.activeLayerId === layerId) {
            const remainingLayers = Array.from(this.layers.keys());
            this.activeLayerId = remainingLayers[remainingLayers.length - 1];
        }
        
        this.updateLayerUI();
        log(`🗑️ Layer deleted: ${layer.name} (ID: ${layerId})`);
    }
    
    setActiveLayer(layerId) {
        if (this.layers.has(layerId)) {
            this.activeLayerId = layerId;
            this.updateLayerUI();
            this.updateStatusDisplay();
            log(`👆 Active layer: ${this.layers.get(layerId).name}`);
        }
    }
    
    toggleLayerVisibility(layerId) {
        const layer = this.layers.get(layerId);
        if (!layer) return;
        
        layer.visible = !layer.visible;
        layer.container.visible = layer.visible;
        this.updateLayerUI();
        log(`👁️ Layer visibility: ${layer.name} → ${layer.visible}`);
    }
    
    getActiveLayer() {
        return this.layers.get(this.activeLayerId);
    }
    
    addPathToActiveLayer(path) {
        const activeLayer = this.getActiveLayer();
        if (activeLayer) {
            activeLayer.paths.push(path);
            activeLayer.container.addChild(path.graphics);
        }
    }
    
    // レイヤー順序並び替え
    reorderLayers(fromIndex, toIndex) {
        const layerIds = Array.from(this.layers.keys()).reverse();
        
        if (fromIndex < 0 || fromIndex >= layerIds.length ||
            toIndex < 0 || toIndex >= layerIds.length ||
            fromIndex === toIndex) return;
        
        // 背景レイヤー（index 0）は移動不可
        const fromLayerId = layerIds[fromIndex];
        if (fromLayerId === 0) return;
        
        // 背景レイヤーとの入れ替えは禁止
        const toLayerId = layerIds[toIndex];
        if (toLayerId === 0) return;
        
        // LayerBridge経由でPIXI Container の順序を更新
        const fromLayer = this.layers.get(fromLayerId);
        this.bridge.reorderContainer(fromLayer.container, toIndex);
        
        this.updateLayerUI();
        log(`🔄 Layer reordered: ${fromIndex} → ${toIndex}`);
    }
    
    clearAllLayers() {
        this.layers.forEach(layer => {
            layer.paths = [];
            layer.container.removeChildren();
        });
    }
    
    updateLayerUI() {
        if (!this.ui) return;
        
        const layerList = document.getElementById('layer-list');
        if (!layerList) return;
        
        layerList.innerHTML = '';
        
        // Render layers in reverse order (top to bottom in UI)
        const layerIds = Array.from(this.layers.keys()).reverse();
        
        layerIds.forEach((layerId, index) => {
            const layer = this.layers.get(layerId);
            const layerItem = document.createElement('div');
            layerItem.className = `layer-item ${layerId === this.activeLayerId ? 'active' : ''}`;
            layerItem.dataset.layerId = layerId;
            layerItem.dataset.layerIndex = index;
            
            layerItem.innerHTML = `
                <div class="layer-visibility ${layer.visible ? '' : 'hidden'}" data-action="toggle-visibility">
                    ${layer.visible ? '👁️' : '⚫'}
                </div>
                <div class="layer-name">${layer.name}</div>
                ${layerId !== 0 ? '<div class="layer-delete" data-action="delete">×</div>' : ''}
            `;
            
            // Event handlers
            layerItem.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                if (action === 'toggle-visibility') {
                    this.toggleLayerVisibility(layerId);
                } else if (action === 'delete') {
                    this.deleteLayer(layerId);
                } else if (!this.dragState.dragging) {
                    this.setActiveLayer(layerId);
                }
            });
            
            // レイヤードラッグ機能（背景レイヤー以外）
            if (layerId !== 0) {
                this.setupLayerDrag(layerItem, index);
            }
            
            layerList.appendChild(layerItem);
        });
    }
    
    setupLayerDrag(layerItem, index) {
        const layerName = layerItem.querySelector('.layer-name');
        
        layerName.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return; // 左クリックのみ
            
            this.dragState.dragging = true;
            this.dragState.dragItem = layerItem;
            this.dragState.startY = e.clientY;
            this.dragState.offset = e.clientY - layerItem.getBoundingClientRect().top;
            
            layerItem.classList.add('dragging');
            
            const boundMouseMove = this.onLayerDrag.bind(this);
            const boundMouseUp = this.onLayerDragEnd.bind(this);
            
            document.addEventListener('mousemove', boundMouseMove);
            document.addEventListener('mouseup', boundMouseUp);
            
            // クリーンアップ用にイベントハンドラを保存
            this.dragState.boundMouseMove = boundMouseMove;
            this.dragState.boundMouseUp = boundMouseUp;
            
            e.preventDefault();
            e.stopPropagation();
        });
    }
    
    onLayerDrag(e) {
        if (!this.dragState.dragging || !this.dragState.dragItem) return;
        
        const layerList = document.getElementById('layer-list');
        const items = Array.from(layerList.children);
        
        // ドラッグ中のアイテムの視覚的移動
        const dragItem = this.dragState.dragItem;
        dragItem.style.position = 'absolute';
        dragItem.style.top = (e.clientY - this.dragState.offset) + 'px';
        dragItem.style.zIndex = '1000';
        
        // ドロップターゲットの検出
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
        const items = Array.from(layerList.children);
        const dragItem = this.dragState.dragItem;
        
        // ドロップターゲットの検出
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
        
        // イベントリスナー削除
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
        
        setTimeout(() => this.updateLayerUI(), 100); // UI再構築
    }
    
    updateStatusDisplay() {
        const activeLayer = this.getActiveLayer();
        const element = document.getElementById('current-layer');
        if (element && activeLayer) {
            element.textContent = activeLayer.name;
        }
    }
}

// ==== DrawingTools: Tool Management ====
/**
 * 【目的】描画ツール・ブラシ管理・描画状態制御
 * 【入力】描画パラメータ・ポインター座標
 * 【出力】描画開始・継続・終了の制御
 * 【副作用】DrawingEngine.createPath・extendPath の呼び出し
 */
class DrawingTools {
    constructor(drawingEngine, layerManager) {
        this.engine = drawingEngine;
        this.layers = layerManager;
        this.currentTool = 'pen';
        this.brushSize = 16.0;
        this.brushColor = 0x800000;
        this.opacity = 0.85;
        this.drawing = { active: false, path: null, lastPoint: null };
    }
    
    selectTool(tool) {
        this.currentTool = tool;
        log(`🔧 Tool selected: ${tool}`);
    }
    
    setBrushSize(size) {
        this.brushSize = Math.max(0.1, Math.min(100, Math.round(size * 10) / 10));
    }
    
    setOpacity(opacity) {
        this.opacity = Math.max(0, Math.min(1, Math.round(opacity * 1000) / 1000));
    }
    
    startDrawing(x, y, isPanning) {
        if (isPanning) return false;
        
        this.drawing.active = true;
        this.drawing.lastPoint = { x, y };
        
        const color = this.currentTool === 'eraser' ? 0xf0e0d6 : this.brushColor;
        const alpha = this.currentTool === 'eraser' ? 1.0 : this.opacity;
        
        this.drawing.path = this.engine.createPath(x, y, this.brushSize, color, alpha);
        log(`🎨 Drawing started at (${Math.round(x)}, ${Math.round(y)})`);
        return true;
    }
    
    continueDrawing(x, y, isPanning) {
        if (!this.drawing.active || !this.drawing.path || isPanning) return;
        
        this.engine.extendPath(this.drawing.path, x, y);
        this.drawing.lastPoint = { x, y };
    }
    
    stopDrawing() {
        if (this.drawing.path) {
            this.drawing.path.isComplete = true;
            log('🎨 Drawing completed');
        }
        this.drawing = { active: false, path: null, lastPoint: null };
    }
}

// ==== InterfaceManager: UI Control ====
/**
 * 【目的】UI管理・ポップアップ・スライダー・ユーザー操作統合
 * 【入力】ユーザーインタラクション（クリック・ドラッグ等）
 * 【出力】UI状態の更新・ツール設定の反映
 * 【副作用】DOM要素の表示・非表示・値更新、DrawingTools 設定変更
 */
class InterfaceManager {
    constructor(drawingTools, drawingEngine, layerManager) {
        this.tools = drawingTools;
        this.engine = drawingEngine;
        this.layers = layerManager;
        this.activePopup = null;
        this.sliders = new Map();
        this.dragState = { active: false, offset: { x: 0, y: 0 } };
    }
    
    initialize() {
        log('🚂 InterfaceManager: Initializing UI');
        this.layers.ui = this;
        this.setupToolButtons();
        this.setupPopups();
        this.setupSliders();
        this.setupResize();
        this.setupLayerControls();
        this.updateCanvasInfo();
    }
    
    setupToolButtons() {
        document.querySelectorAll('.tool-button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (btn.classList.contains('disabled')) return;
                this.handleToolClick(e.currentTarget);
            });
        });
    }
    
    handleToolClick(button) {
        const toolId = button.id;
        
        if (toolId === 'pen-tool') {
            this.activateTool('pen');
            this.togglePopup('pen-settings');
        } else if (toolId === 'eraser-tool') {
            this.activateTool('eraser');
            this.closeAllPopups();
        } else if (toolId === 'resize-tool') {
            this.togglePopup('resize-settings');
        } else if (toolId === 'layer-tool') {
            this.toggleLayerPanel();
        }
    }
    
    activateTool(tool) {
        this.tools.selectTool(tool);
        
        document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
        const toolBtn = document.getElementById(tool + '-tool');
        if (toolBtn) toolBtn.classList.add('active');
        
        const toolNames = { pen: 'ベクターペン', eraser: '消しゴム' };
        const toolElement = document.getElementById('current-tool');
        if (toolElement) {
            toolElement.textContent = toolNames[tool] || tool;
        }
        
        const canvas = this.engine.app.canvas;
        canvas.style.cursor = tool === 'eraser' ? 'cell' : 'crosshair';
    }
    
    toggleLayerPanel() {
        const panel = document.getElementById('layer-panel');
        if (!panel) return;
        
        panel.classList.toggle('hidden');
        
        const button = document.getElementById('layer-tool');
        if (button) {
            button.classList.toggle('active', !panel.classList.contains('hidden'));
        }
        
        log(`🎯 Layer panel: ${panel.classList.contains('hidden') ? 'hidden' : 'visible'}`);
    }
    
    setupLayerControls() {
        const addLayerBtn = document.getElementById('add-layer-btn');
        const duplicateLayerBtn = document.getElementById('duplicate-layer-btn');
        
        if (addLayerBtn) {
            addLayerBtn.addEventListener('click', () => {
                const newLayer = this.layers.createLayer();
                this.layers.setActiveLayer(newLayer.id);
            });
        }
        
        if (duplicateLayerBtn) {
            duplicateLayerBtn.addEventListener('click', () => {
                if (this.layers.activeLayerId !== null) {
                    this.layers.duplicateLayer(this.layers.activeLayerId);
                }
            });
        }
    }
    
    togglePopup(popupId) {
        const popup = document.getElementById(popupId);
        if (!popup) return;
        
        if (this.activePopup && this.activePopup !== popup) {
            this.activePopup.classList.remove('show');
        }
        
        const isVisible = popup.classList.contains('show');
        popup.classList.toggle('show', !isVisible);
        this.activePopup = isVisible ? null : popup;
    }
    
    setupPopups() {
        document.querySelectorAll('.popup-panel').forEach(popup => {
            const title = popup.querySelector('.popup-title');
            if (title) {
                title.style.cursor = 'move';
                title.addEventListener('mousedown', (e) => this.startDrag(e, popup));
            }
        });
        
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.popup-panel') && 
                !e.target.closest('.tool-button') &&
                !e.target.closest('.layer-panel')) {
                this.closeAllPopups();
            }
        });
        
        document.addEventListener('mousemove', (e) => this.onDrag(e));
        document.addEventListener('mouseup', () => this.stopDrag());
    }
    
    startDrag(e, popup) {
        this.dragState.active = popup;
        const rect = popup.getBoundingClientRect();
        this.dragState.offset.x = e.clientX - rect.left;
        this.dragState.offset.y = e.clientY - rect.top;
        e.preventDefault();
    }
    
    onDrag(e) {
        if (!this.dragState.active) return;
        
        const x = Math.max(0, Math.min(e.clientX - this.dragState.offset.x, 
            window.innerWidth - this.dragState.active.offsetWidth));
        const y = Math.max(0, Math.min(e.clientY - this.dragState.offset.y, 
            window.innerHeight - this.dragState.active.offsetHeight));
        
        this.dragState.active.style.left = x + 'px';
        this.dragState.active.style.top = y + 'px';
    }
    
    stopDrag() {
        this.dragState.active = false;
    }
    
    setupSliders() {
        this.createSlider('pen-size-slider', 0.1, 100, 16.0, (value) => {
            this.tools.setBrushSize(value);
            return value.toFixed(1) + 'px';
        });
        
        this.createSlider('pen-opacity-slider', 0, 100, 85.0, (value) => {
            this.tools.setOpacity(value / 100);
            return value.toFixed(1) + '%';
        });
    }
    
    createSlider(sliderId, min, max, initial, callback) {
        const container = document.getElementById(sliderId);
        if (!container) return;
        
        const track = container.querySelector('.slider-track');
        const handle = container.querySelector('.slider-handle');
        const valueDisplay = container.parentNode.querySelector('.slider-value');
        
        if (!track || !handle || !valueDisplay) return;
        
        const slider = {
            value: initial, min, max, callback, track, handle, valueDisplay, dragging: false
        };
        
        this.sliders.set(sliderId, slider);
        
        const update = (value) => {
            slider.value = Math.max(min, Math.min(max, value));
            const percentage = ((slider.value - min) / (max - min)) * 100;
            
            track.style.width = percentage + '%';
            handle.style.left = percentage + '%';
            valueDisplay.textContent = callback(slider.value);
        };
        
        const getValue = (clientX) => {
            const rect = container.getBoundingClientRect();
            const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            return min + (percentage * (max - min));
        };
        
        container.addEventListener('mousedown', (e) => {
            slider.dragging = true;
            update(getValue(e.clientX));
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (slider.dragging) update(getValue(e.clientX));
        });
        
        document.addEventListener('mouseup', () => {
            slider.dragging = false;
        });
        
        update(initial);
    }
    
    setupResize() {
        const applyButton = document.getElementById('apply-resize');
        if (applyButton) {
            applyButton.addEventListener('click', () => this.applyResize());
        }
    }
    
    applyResize() {
        const widthInput = document.getElementById('canvas-width');
        const heightInput = document.getElementById('canvas-height');
        
        if (widthInput && heightInput) {
            const width = parseInt(widthInput.value);
            const height = parseInt(heightInput.value);
            
            if (width >= 100 && width <= 4096 && height >= 100 && height <= 4096) {
                this.engine.resize(width, height);
                this.updateCanvasInfo();
                this.closeAllPopups();
            }
        }
    }
    
    updateCanvasInfo() {
        const element = document.getElementById('canvas-info');
        if (element) {
            element.textContent = `${window.APP_CONFIG.canvas.width}×${window.APP_CONFIG.canvas.height}px`;
        }
    }
    
    updateCoordinates(x, y) {
        const element = document.getElementById('coordinates');
        if (element) {
            element.textContent = `x: ${Math.round(x)}, y: ${Math.round(y)}`;
        }
    }
    
    closeAllPopups() {
        document.querySelectorAll('.popup-panel').forEach(popup => {
            popup.classList.remove('show');
        });
        this.activePopup = null;
    }
}

// ==== Tools Integration and Initialization ====
/**
 * 【目的】ツール・UIシステムの初期化・futaba_main.html との連携
 * 【入力】window.futabaApp (AppController インスタンス)
 * 【出力】統合されたツール・レイヤー・UIシステム
 * 【副作用】LayerBridge接続・システム統合完了
 */
function initializeToolsSystem() {
    if (!window.futabaApp) {
        console.error('❌ futaba_main.html not loaded');
        return;
    }
    
    const app = window.futabaApp;
    const engine = app.engine;
    
    if (!engine.layerBridge) {
        console.error('❌ LayerBridge not found');
        return;
    }
    
    // システム初期化
    const layerManager = new LayerManager(engine.layerBridge);
    const drawingTools = new DrawingTools(engine, layerManager);
    const interfaceManager = new InterfaceManager(drawingTools, engine, layerManager);
    
    // LayerManager初期化
    layerManager.initialize();
    
    // InterfaceManager初期化
    interfaceManager.initialize();
    
    // AppController に接続
    app.setTools(drawingTools, interfaceManager, layerManager);
    
    log('🎨 Tools system initialized successfully');
    
    console.log('🎨 Futaba Drawing Tool v8rev7 - Split Architecture Complete!');
    console.log('📋 Tools System Summary:');
    console.log('  ✅ LayerManager - Layer system with drag ordering');
    console.log('  🔧 DrawingTools - Pen/Eraser tools with pressure support');
    console.log('  🎛️ InterfaceManager - UI controls and popups');
    console.log('  🌉 LayerBridge - Loose coupling with drawing engine');
    console.log('  🎯 Layer panel with visibility toggle');
    console.log('  📋 Layer creation, duplication, deletion');
    console.log('  🗃️ Background layer protection');
    console.log('  🎨 Active layer drawing system');
    console.log('  📊 Status display with current layer');
    console.log('  🎪 Adobe Fresco-style right panel UI');
    console.log('  🖊️ Pen pressure support for canvas panning');
    console.log('  🔄 Layer drag-and-drop reordering');
    
    // ショートカット表示
    console.log('🎮 Controls:');
    console.log('  📱 Space + Drag: Canvas movement');
    console.log('  ⌨️  Space + Arrow Keys: Fine movement (±10px)');
    console.log('  🏠  Home: Reset position');
    console.log('  🎯 Layer Tool: Toggle layer panel');
}

// ==== Auto-initialization ====
// DOM準備完了後に自動初期化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeToolsSystem);
} else {
    // すでにDOMが読み込まれている場合は即座に実行
    setTimeout(initializeToolsSystem, 10);
}

// ==== Global Access ====
// デバッグ用にグローバルスコープに公開（安全に）
if (typeof window !== 'undefined') {
    window.FutabaTools = {
        LayerManager,
        DrawingTools,
        InterfaceManager,
        initializeToolsSystem,
        version: '8.0.7-split-arch'
    };
}

// ==== Utility Functions ====
const log = (message, ...args) => {
    if (window.APP_CONFIG && window.APP_CONFIG.debug) {
        console.log(message, ...args);
    }
};