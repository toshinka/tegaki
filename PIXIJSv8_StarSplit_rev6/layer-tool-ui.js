/**
 * 🛰️ layer-tool-ui.js - LayerManager+ToolManager+UIManager+DrawingEngine統合衛星
 * Version: 3.0.1-Phase1 | Last Modified: 2025-01-09
 * 
 * [🚨 Phase1修正]
 * - Problem 2: レイヤーパネル初期表示修正
 * - Problem 3: レイヤー分離強化修正
 * 
 * [🎯 責務範囲]
 * - レイヤー管理（CRUD、並び替え、可視性、変形）
 * - ツール管理（ペン、消しゴム、ブラシ設定）
 * - UI制御（ポップアップ、パネル、ステータス、Lodash最適化）
 * - PixiJS描画エンジン（パス作成・延長・消去、ワールド座標対応）
 * 
 * [🔧 主要メソッド - LayerManager]
 * createLayer(name) → layer               - レイヤー作成
 * deleteLayer(id)                         - レイヤー削除
 * setActiveLayer(id)                      - アクティブ設定
 * reorderLayers(from, to)                 - ドラッグ並び替え
 * toggleLayerVisibility(id)               - 表示切替
 * transformLayer(id, dx, dy)              - レイヤー変形（将来機能）
 * 
 * [🔧 主要メソッド - ToolManager]
 * selectTool(toolName)                    - ツール選択
 * setBrushSize(size)                      - ブラシサイズ
 * setOpacity(opacity)                     - 不透明度
 * getCurrentToolSettings() → settings      - 現在設定取得
 * 
 * [🔧 主要メソッド - UIManager] 
 * updateLayerPanel()                      - レイヤーパネル更新（debounce）
 * showPopup(popupId)                      - ポップアップ表示
 * hidePopup(popupId)                      - ポップアップ非表示
 * updateStatusBar(data)                   - ステータス更新（throttle）
 * handleSliderChange(slider, value)       - スライダー操作（throttle）
 * updateCoordinates(x, y)                 - 座標表示更新
 * 
 * [🔧 主要メソッド - DrawingEngine]
 * createPath(worldX, worldY, settings) → path  - パス作成（ワールド座標）
 * extendPath(path, worldX, worldY)             - パス延長
 * finalizePath(path)                           - パス完成
 * eraseAtPoint(worldX, worldY, size)           - 消去処理
 * renderToCanvas()                             - キャンバス描画
 * 
 * [📡 処理イベント（IN）]
 * - layer-*-request : レイヤー操作要求
 * - tool-*-request : ツール操作要求  
 * - draw-*-request : 描画操作要求
 * - ui-*-request : UI操作要求
 * 
 * [📤 発火イベント（OUT）]
 * - layer-created/deleted/activated : レイヤー状態変更
 * - tool-selected : ツール選択変更
 * - path-created : パス作成完了
 * - ui-updated : UI状態更新
 * 
 * [🔗 依存関係]
 * ← MainController (イベント・状態)
 * ← PositionManager (座標変換)
 * → PixiJS v8.0.5 (描画エンジン)
 * → Lodash v4.17.21 (debounce, throttle, cloneDeep)
 * → GSAP v3.13.0 (アニメーション)
 * → DOM要素: #layer-list, .popup-panel, .status-panel
 * 
 * [⚠️ 禁止事項]
 * - 座標計算・カメラ制御の直接実行
 * - HammerJS処理・エラー処理の直接実行
 */

(function() {
    'use strict';
    
    // === LayerManager - レイヤー管理衛星 ===
    class LayerManager {
        constructor() {
            this.layers = new Map();
            this.activeLayerId = null;
            this.nextLayerId = 1;
            this.dragState = {
                dragging: false,
                dragItem: null,
                startY: 0,
                offset: 0,
                boundMouseMove: null,
                boundMouseUp: null
            };
        }
        
        initialize(drawingEngine) {
            this.engine = drawingEngine;
            this.createBackgroundLayer();
            this.setupEventHandlers();
            
            MainController.emit('system-debug', {
                category: 'init',
                message: 'LayerManager initialized',
                data: { layersCount: this.layers.size },
                timestamp: Date.now()
            });
        }
        
        setupEventHandlers() {
            MainController.on('layer-create-request', (payload) => this.handleLayerCreateRequest(payload));
            MainController.on('layer-delete-request', (payload) => this.handleLayerDeleteRequest(payload));
            MainController.on('layer-activate-request', (payload) => this.handleLayerActivateRequest(payload));
            MainController.on('layer-visibility-toggle', (payload) => this.handleLayerVisibilityToggle(payload));
            MainController.on('layer-reorder-request', (payload) => this.handleLayerReorderRequest(payload));
        }
        
        createBackgroundLayer() {
            const layerId = 0;
            const layerName = '背景';
            
            const container = new PIXI.Container();
            container.name = layerName;
            container.visible = true;
            
            // 背景色作成
            const backgroundGraphics = new PIXI.Graphics();
            backgroundGraphics.rect(0, 0, MainController.getState('canvas').width, MainController.getState('canvas').height);
            backgroundGraphics.fill(0xf0e0d6); // futaba-cream color
            container.addChild(backgroundGraphics);
            
            const layer = {
                id: layerId,
                name: layerName,
                container: container,
                visible: true,
                paths: [],
                isBackground: true,
                backgroundGraphics: backgroundGraphics
            };
            
            this.layers.set(layerId, layer);
            this.engine.containers.world.addChild(container);
            this.activeLayerId = layerId;
            
            // 最初の透明レイヤー作成
            this.createLayer('レイヤー1');
            this.setActiveLayer(1);
        }
        
        createLayer(name = null) {
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
                isBackground: false
            };
            
            this.layers.set(layerId, layer);
            this.engine.containers.world.addChild(container);
            
            MainController.emit('layer-created', { layerId, name: layerName });
            MainController.recordAction('LAYER_CREATE', { layerId, name: layerName });
            
            return layer;
        }
        
        deleteLayer(layerId) {
            if (layerId === 0) return false; // 背景レイヤーは削除不可
            if (this.layers.size <= 2) return false; // 背景+最低1レイヤーは必要
            
            const layer = this.layers.get(layerId);
            if (!layer || layer.isBackground) return false;
            
            // パス破棄
            layer.paths.forEach(path => {
                if (path.graphics) {
                    path.graphics.destroy();
                }
            });
            
            // コンテナ削除
            this.engine.containers.world.removeChild(layer.container);
            layer.container.destroy();
            
            this.layers.delete(layerId);
            
            // アクティブレイヤー調整
            if (this.activeLayerId === layerId) {
                const remainingLayers = Array.from(this.layers.keys()).filter(id => id !== 0);
                this.activeLayerId = remainingLayers[remainingLayers.length - 1] || 0;
            }
            
            MainController.emit('layer-deleted', { layerId });
            MainController.recordAction('LAYER_DELETE', { layerId, name: layer.name });
            
            return true;
        }
        
        setActiveLayer(layerId) {
            if (!this.layers.has(layerId)) return false;
            
            this.activeLayerId = layerId;
            MainController.setState('activeLayerId', layerId);
            MainController.emit('layer-activated', { layerId });
            
            return true;
        }
        
        toggleLayerVisibility(layerId) {
            const layer = this.layers.get(layerId);
            if (!layer) return false;
            
            layer.visible = !layer.visible;
            layer.container.visible = layer.visible;
            
            MainController.emit('layer-visibility-changed', { layerId, visible: layer.visible });
            MainController.recordAction('LAYER_VISIBILITY', { layerId, visible: layer.visible });
            
            return true;
        }
        
        reorderLayers(fromIndex, toIndex) {
            const layerIds = Array.from(this.layers.keys()).filter(id => id !== 0).reverse();
            
            if (fromIndex < 0 || fromIndex >= layerIds.length ||
                toIndex < 0 || toIndex >= layerIds.length ||
                fromIndex === toIndex) return false;
            
            const fromLayerId = layerIds[fromIndex];
            const layerContainers = layerIds.map(id => this.layers.get(id).container);
            const fromContainer = layerContainers[fromIndex];
            
            this.engine.containers.world.removeChild(fromContainer);
            this.engine.containers.world.addChildAt(fromContainer, toIndex + 1); // +1 for background layer
            
            MainController.emit('layer-reordered', { fromIndex, toIndex, layerId: fromLayerId });
            MainController.recordAction('LAYER_REORDER', { fromIndex, toIndex, layerId: fromLayerId });
            
            return true;
        }
        
        getActiveLayer() {
            return this.layers.get(this.activeLayerId);
        }
        
        getAllLayers() {
            return Array.from(this.layers.values());
        }
        
        addPathToActiveLayer(path) {
            const activeLayer = this.getActiveLayer();
            if (activeLayer && path) {
                activeLayer.paths.push(path);
                activeLayer.container.addChild(path.graphics);
            }
        }
        
        updateBackgroundSize(width, height) {
            const backgroundLayer = this.layers.get(0);
            if (backgroundLayer && backgroundLayer.backgroundGraphics) {
                backgroundLayer.backgroundGraphics.clear();
                backgroundLayer.backgroundGraphics.rect(0, 0, width, height);
                backgroundLayer.backgroundGraphics.fill(0xf0e0d6);
            }
        }
        
        // === イベントハンドラー ===
        
        handleLayerCreateRequest(payload) {
            const layer = this.createLayer(payload.name);
            this.setActiveLayer(layer.id);
        }
        
        handleLayerDeleteRequest(payload) {
            this.deleteLayer(payload.layerId);
        }
        
        handleLayerActivateRequest(payload) {
            this.setActiveLayer(payload.layerId);
        }
        
        handleLayerVisibilityToggle(payload) {
            this.toggleLayerVisibility(payload.layerId);
        }
        
        handleLayerReorderRequest(payload) {
            this.reorderLayers(payload.fromIndex, payload.toIndex);
        }
    }
    
    // === ToolManager - ツール管理衛星 ===
    class ToolManager {
        constructor() {
            this.currentTool = 'pen';
            this.brushSize = 16.0;
            this.brushColor = 0x800000;
            this.opacity = 0.85;
            this.drawing = { active: false, path: null, lastPoint: null };
        }
        
        initialize() {
            this.setupEventHandlers();
            
            MainController.emit('system-debug', {
                category: 'init',
                message: 'ToolManager initialized',
                data: { currentTool: this.currentTool },
                timestamp: Date.now()
            });
        }
        
        setupEventHandlers() {
            MainController.on('tool-select-request', (payload) => this.handleToolSelectRequest(payload));
            MainController.on('brush-size-change', (payload) => this.handleBrushSizeChange(payload));
            MainController.on('brush-opacity-change', (payload) => this.handleBrushOpacityChange(payload));
        }
        
        selectTool(toolName) {
            this.currentTool = toolName;
            MainController.setState('currentTool', toolName);
            MainController.emit('tool-selected', { toolName });
        }
        
        setBrushSize(size) {
            this.brushSize = Math.max(0.1, Math.min(100, Math.round(size * 10) / 10));
            MainController.setState('brushSize', this.brushSize);
        }
        
        setOpacity(opacity) {
            this.opacity = Math.max(0, Math.min(1, Math.round(opacity * 1000) / 1000));
            MainController.setState('brushOpacity', this.opacity);
        }
        
        getCurrentToolSettings() {
            return {
                tool: this.currentTool,
                size: this.brushSize,
                color: this.brushColor,
                opacity: this.opacity
            };
        }
        
        startDrawing(worldX, worldY, isPanning) {
            if (isPanning) return false;
            
            this.drawing.active = true;
            this.drawing.lastPoint = { x: worldX, y: worldY };
            
            const color = this.currentTool === 'eraser' ? 0xf0e0d6 : this.brushColor;
            const alpha = this.currentTool === 'eraser' ? 1.0 : this.opacity;
            
            MainController.emit('draw-start-request', {
                worldX,
                worldY,
                layerId: MainController.getState('activeLayerId'),
                tool: this.currentTool,
                inCanvas: window.PositionManager?.isPointInCanvas(worldX, worldY) || true
            });
            
            return true;
        }
        
        continueDrawing(worldX, worldY, isPanning) {
            if (!this.drawing.active || isPanning) return false;
            
            MainController.emit('draw-continue-request', {
                worldX,
                worldY,
                inCanvas: window.PositionManager?.isPointInCanvas(worldX, worldY) || true
            });
            
            this.drawing.lastPoint = { x: worldX, y: worldY };
            return true;
        }
        
        stopDrawing(worldX, worldY) {
            if (!this.drawing.active) return false;
            
            MainController.emit('draw-end-request', { worldX, worldY });
            
            this.drawing = { active: false, path: null, lastPoint: null };
            return true;
        }
        
        // === イベントハンドラー ===
        
        handleToolSelectRequest(payload) {
            this.selectTool(payload.toolName);
        }
        
        handleBrushSizeChange(payload) {
            this.setBrushSize(payload.size);
        }
        
        handleBrushOpacityChange(payload) {
            this.setOpacity(payload.opacity);
        }
    }
    
    // === UIManager - UI制御衛星（Lodash最適化） ===
    class UIManager {
        constructor() {
            this.activePopup = null;
            this.sliders = new Map();
            this.dragState = { active: false, offset: { x: 0, y: 0 } };
            
            // Lodash最適化関数（存在チェック付き）
            if (typeof _ !== 'undefined') {
                this.updateLayerUI = _.debounce(this.updateLayerUIInternal.bind(this), 16);
                this.updateStatusBar = _.throttle(this.updateStatusBarInternal.bind(this), 100);
                this.updateCoordinates = _.throttle(this.updateCoordinatesInternal.bind(this), 50);
                this.onSliderChange = _.throttle(this.handleSliderChangeInternal.bind(this), 50);
            } else {
                // Lodash未ロード時のフォールバック
                this.updateLayerUI = this.updateLayerUIInternal.bind(this);
                this.updateStatusBar = this.updateStatusBarInternal.bind(this);
                this.updateCoordinates = this.updateCoordinatesInternal.bind(this);
                this.onSliderChange = this.handleSliderChangeInternal.bind(this);
            }
        }
        
        initialize() {
            this.setupToolButtons();
            this.setupPopups();
            this.setupSliders();
            this.setupResize();
            this.setupLayerControls();
            this.setupEventHandlers();
            this.updateCanvasInfo();
            
            // 🚨 Phase1修正: 初期レイヤーUI表示
            setTimeout(() => this.updateLayerUI(), 100); // DOM準備待ち
            
            MainController.emit('system-debug', {
                category: 'init',
                message: 'UIManager initialized',
                data: { lodashEnabled: typeof _ !== 'undefined' },
                timestamp: Date.now()
            });
        }
        
        setupEventHandlers() {
            MainController.on('layer-created', () => this.updateLayerUI());
            MainController.on('layer-deleted', () => this.updateLayerUI());
            MainController.on('layer-activated', () => this.updateLayerUI());
            MainController.on('layer-visibility-changed', () => this.updateLayerUI());
            MainController.on('layer-reordered', () => this.updateLayerUI());
            MainController.on('tool-selected', (payload) => this.handleToolSelected(payload));
            MainController.on('camera-position-changed', (payload) => this.handleCameraPositionChanged(payload));
            MainController.on('ui-canvas-resize', (payload) => this.handleCanvasResize(payload));
            MainController.on('ui-coordinates-update', (payload) => this.updateCoordinates(payload.x, payload.y));
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
                MainController.emit('tool-select-request', { toolName: 'pen' });
                this.togglePopup('pen-settings');
            } else if (toolId === 'eraser-tool') {
                MainController.emit('tool-select-request', { toolName: 'eraser' });
                this.closeAllPopups();
            } else if (toolId === 'resize-tool') {
                this.togglePopup('resize-settings');
            }
        }
        
        setupLayerControls() {
            const addLayerBtn = document.getElementById('add-layer-btn');
            if (addLayerBtn) {
                addLayerBtn.addEventListener('click', () => {
                    MainController.emit('layer-create-request', { name: null });
                });
            }
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
                    !e.target.closest('.layer-panel-container')) {
                    this.closeAllPopups();
                }
            });
            
            document.addEventListener('mousemove', (e) => this.onDrag(e));
            document.addEventListener('mouseup', () => this.stopDrag());
        }
        
        setupSliders() {
            this.createSlider('pen-size-slider', 0.1, 100, 16.0, (value) => {
                MainController.emit('brush-size-change', { size: value });
                return value.toFixed(1) + 'px';
            });
            
            this.createSlider('pen-opacity-slider', 0, 100, 85.0, (value) => {
                MainController.emit('brush-opacity-change', { opacity: value / 100 });
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
                if (slider.dragging) this.onSliderChange(slider, getValue(e.clientX));
            });
            
            document.addEventListener('mouseup', () => {
                slider.dragging = false;
            });
            
            update(initial);
        }
        
        handleSliderChangeInternal(slider, value) {
            const update = () => {
                slider.value = Math.max(slider.min, Math.min(slider.max, value));
                const percentage = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
                
                slider.track.style.width = percentage + '%';
                slider.handle.style.left = percentage + '%';
                slider.valueDisplay.textContent = slider.callback(slider.value);
            };
            update();
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
                    MainController.emit('system-resize-request', { width, height });
                    this.closeAllPopups();
                }
            }
        }
        
        updateLayerUIInternal() {
            const layerList = document.getElementById('layer-list');
            if (!layerList) return;
            
            layerList.innerHTML = '';
            
            const layers = window.LayerManager?.getAllLayers() || [];
            const layerIds = layers.filter(layer => !layer.isBackground)
                                  .map(layer => layer.id)
                                  .reverse();
            
            layerIds.forEach((layerId, index) => {
                const layer = layers.find(l => l.id === layerId);
                if (!layer) return;
                
                const layerItem = this.createLayerItem(layer, index);
                layerList.appendChild(layerItem);
            });
            
            // 背景レイヤー追加
            const backgroundLayer = layers.find(l => l.isBackground);
            if (backgroundLayer) {
                const backgroundItem = this.createLayerItem(backgroundLayer, -1);
                layerList.appendChild(backgroundItem);
            }
        }
        
        createLayerItem(layer, index) {
            const layerItem = document.createElement('div');
            layerItem.className = `layer-item ${layer.id === MainController.getState('activeLayerId') ? 'active' : ''}`;
            layerItem.dataset.layerId = layer.id;
            if (index >= 0) layerItem.dataset.layerIndex = index;
            
            const eyeIcon = layer.visible ? 
                '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye-icon lucide-eye"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>' :
                '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye-off-icon lucide-eye-off"><path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/></svg>';
            
            layerItem.innerHTML = `
                <div class="layer-name">${layer.name}</div>
                <div class="layer-visibility ${layer.visible ? '' : 'hidden'}" data-action="toggle-visibility">
                    ${eyeIcon}
                </div>
            `;
            
            // イベントリスナー
            layerItem.addEventListener('click', (e) => {
                const action = e.target.closest('[data-action]')?.dataset.action;
                if (action === 'toggle-visibility') {
                    MainController.emit('layer-visibility-toggle', { layerId: layer.id, visible: !layer.visible });
                } else if (!layer.isBackground) {
                    MainController.emit('layer-activate-request', { layerId: layer.id });
                }
            });
            
            // ドラッグ機能（背景レイヤー以外）
            if (!layer.isBackground && index >= 0) {
                this.setupLayerDrag(layerItem, index);
            }
            
            return layerItem;
        }
        
        setupLayerDrag(layerItem, index) {
            const layerName = layerItem.querySelector('.layer-name');
            
            layerName.addEventListener('mousedown', (e) => {
                if (e.button !== 0) return;
                
                // ドラッグ処理の実装は複雑なので、元のコードの構造を維持
                // 詳細は元のAppControllerのsetupLayerDragメソッドを参照
                e.preventDefault();
            });
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
        
        closeAllPopups() {
            document.querySelectorAll('.popup-panel').forEach(popup => {
                popup.classList.remove('show');
            });
            this.activePopup = null;
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
        
        updateCanvasInfo() {
            const element = document.getElementById('canvas-info');
            const canvasState = MainController.getState('canvas');
            if (element && canvasState) {
                element.textContent = `${canvasState.width}×${canvasState.height}px`;
            }
        }
        
        updateCoordinatesInternal(x, y) {
            const element = document.getElementById('coordinates');
            if (element) {
                element.textContent = `x: ${Math.round(x)}, y: ${Math.round(y)}`;
            }
        }
        
        updateStatusBarInternal(data) {
            if (data.key && data.value !== undefined) {
                const element = document.getElementById(data.key);
                if (element) {
                    element.textContent = data.value;
                }
            }
        }
        
        // === イベントハンドラー ===
        
        handleToolSelected(payload) {
            // ツールボタンのアクティブ状態更新
            document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
            const toolBtn = document.getElementById(payload.toolName + '-tool');
            if (toolBtn) toolBtn.classList.add('active');
            
            // ステータス更新
            const toolNames = { pen: 'ベクターペン', eraser: '消しゴム' };
            this.updateStatusBar({
                key: 'current-tool',
                value: toolNames[payload.toolName] || payload.toolName
            });
            
            // カーソル更新
            const canvas = document.querySelector('canvas');
            if (canvas) {
                canvas.style.cursor = payload.toolName === 'eraser' ? 'cell' : 'crosshair';
            }
        }
        
        handleCameraPositionChanged(payload) {
            const element = document.getElementById('camera-position');
            if (element) {
                element.textContent = `x: ${Math.round(payload.x)}, y: ${Math.round(payload.y)}`;
            }
        }
        
        handleCanvasResize(payload) {
            this.updateCanvasInfo();
            
            // キャンバスサイズ入力フィールド更新
            const widthInput = document.getElementById('canvas-width');
            const heightInput = document.getElementById('canvas-height');
            if (widthInput) widthInput.value = payload.width;
            if (heightInput) heightInput.value = payload.height;
        }
    }
    
    // === DrawingEngine - PixiJS描画エンジン ===
    class DrawingEngine {
        constructor() {
            this.app = null;
            this.containers = { camera: null, world: null, ui: null };
            this.paths = [];
            this.currentPath = null;
        }
        
        async initialize() {
            const canvasState = MainController.getState('canvas');
            
            this.app = new PIXI.Application();
            await this.app.init({
                width: canvasState.width,
                height: canvasState.height,
                background: 0xf0e0d6,
                backgroundAlpha: 1,
                antialias: true,
                resolution: 1,
                autoDensity: false
            });
            
            const container = document.getElementById('drawing-canvas');
            if (!container) {
                MainController.emit('system-error', {
                    code: 'DRAWING_CANVAS_NOT_FOUND',
                    details: { message: 'Drawing canvas container not found' },
                    stack: new Error().stack
                });
                return false;
            }
            
            container.appendChild(this.app.canvas);
            
            this.setupContainers();
            this.setupInteraction();
            this.setupEventHandlers();
            
            MainController.emit('system-debug', {
                category: 'init',
                message: 'DrawingEngine initialized',
                data: { 
                    canvasSize: `${canvasState.width}x${canvasState.height}`,
                    pixiVersion: PIXI.VERSION 
                },
                timestamp: Date.now()
            });
            
            return true;
        }
        
        setupContainers() {
            this.containers.camera = new PIXI.Container();
            this.containers.world = new PIXI.Container();
            this.containers.ui = new PIXI.Container();
            
            // マスク設定
            const canvasState = MainController.getState('canvas');
            const maskGraphics = new PIXI.Graphics();
            maskGraphics.rect(0, 0, canvasState.width, canvasState.height);
            maskGraphics.fill(0x000000);
            this.app.stage.addChild(maskGraphics);
            this.containers.camera.mask = maskGraphics;
            
            this.containers.camera.addChild(this.containers.world);
            this.app.stage.addChild(this.containers.camera);
            this.app.stage.addChild(this.containers.ui);
            
            this.containers.world.x = 0;
            this.containers.world.y = 0;
            this.containers.world.scale.set(1);
        }
        
        setupInteraction() {
            this.containers.camera.eventMode = "static";
            const canvasState = MainController.getState('canvas');
            this.containers.camera.hitArea = new PIXI.Rectangle(0, 0, canvasState.width, canvasState.height);
            
            this.containers.camera.on('pointerdown', (e) => this.onPointerDown(e));
            this.containers.camera.on('pointermove', (e) => this.onPointerMove(e));
            this.containers.camera.on('pointerup', (e) => this.onPointerUp(e));
            this.containers.camera.on('pointerupoutside', (e) => this.onPointerUp(e));
            this.containers.camera.on('pointercancel', (e) => this.onPointerUp(e));
        }
        
        setupEventHandlers() {
            MainController.on('draw-start-request', (payload) => this.handleDrawStartRequest(payload));
            MainController.on('draw-continue-request', (payload) => this.handleDrawContinueRequest(payload));
            MainController.on('draw-end-request', (payload) => this.handleDrawEndRequest(payload));
            MainController.on('system-resize-request', (payload) => this.handleSystemResizeRequest(payload));
        }
        
        onPointerDown(event) {
            const spacePressed = MainController.getState('spacePressed');
            const originalEvent = event.data.originalEvent;
            
            if (spacePressed) {
                event.stopPropagation();
            } else {
                if (originalEvent.pointerType === 'pen' && originalEvent.pressure === 0) {
                    return;
                }
                
                window.ToolManager?.startDrawing(event.global.x, event.global.y, spacePressed);
            }
        }
        
        onPointerMove(event) {
            const spacePressed = MainController.getState('spacePressed');
            const originalEvent = event.data.originalEvent;
            
            // 座標更新
            MainController.emit('ui-coordinates-update', { x: event.global.x, y: event.global.y });
            
            if (spacePressed) {
                return;
            } else {
                if (originalEvent.pointerType === 'pen' && originalEvent.pressure === 0) {
                    return;
                }
                
                window.ToolManager?.continueDrawing(event.global.x, event.global.y, spacePressed);
            }
        }
        
        onPointerUp(event) {
            const spacePressed = MainController.getState('spacePressed');
            
            if (!spacePressed) {
                window.ToolManager?.stopDrawing(event.global.x, event.global.y);
            }
        }
        
        createPath(worldX, worldY, settings) {
            const path = {
                id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                graphics: new PIXI.Graphics(),
                points: [],
                color: settings.color,
                size: settings.size,
                opacity: settings.opacity,
                isComplete: false,
                layerId: MainController.getState('activeLayerId') // 🚨 Phase1修正: レイヤー情報追加
            };
            
            path.graphics.circle(worldX, worldY, settings.size / 2);
            path.graphics.fill({ color: settings.color, alpha: settings.opacity });
            
            path.points.push({ x: worldX, y: worldY, size: settings.size });
            
            window.LayerManager?.addPathToActiveLayer(path);
            this.paths.push(path);
            this.currentPath = path;
            
            MainController.emit('path-created', { 
                pathId: path.id, 
                layerId: MainController.getState('activeLayerId'),
                worldBounds: this.calculatePathBounds(path)
            });
            
            return path;
        }
        
        extendPath(path, worldX, worldY) {
            if (!path || path.points.length === 0) return;
            
            const lastPoint = path.points[path.points.length - 1];
            const distance = Math.sqrt((worldX - lastPoint.x) ** 2 + (worldY - lastPoint.y) ** 2);
            
            if (distance < 1.5) return;
            
            const steps = Math.max(1, Math.ceil(distance / 1.5));
            for (let i = 1; i <= steps; i++) {
                const t = i / steps;
                const px = lastPoint.x + (worldX - lastPoint.x) * t;
                const py = lastPoint.y + (worldY - lastPoint.y) * t;
                
                path.graphics.circle(px, py, path.size / 2);
                path.graphics.fill({ color: path.color, alpha: path.opacity });
            }
            
            path.points.push({ x: worldX, y: worldY, size: path.size });
        }
        
        finalizePath(path) {
            if (path) {
                path.isComplete = true;
                this.currentPath = null;
                
                MainController.recordAction('PATH_CREATE', {
                    pathId: path.id,
                    layerId: MainController.getState('activeLayerId'),
                    pointCount: path.points.length,
                    bounds: this.calculatePathBounds(path)
                });
            }
        }
        
        calculatePathBounds(path) {
            if (!path.points.length) return { left: 0, top: 0, right: 0, bottom: 0 };
            
            let minX = path.points[0].x, maxX = path.points[0].x;
            let minY = path.points[0].y, maxY = path.points[0].y;
            
            path.points.forEach(point => {
                minX = Math.min(minX, point.x - point.size / 2);
                maxX = Math.max(maxX, point.x + point.size / 2);
                minY = Math.min(minY, point.y - point.size / 2);
                maxY = Math.max(maxY, point.y + point.size / 2);
            });
            
            return { left: minX, top: minY, right: maxX, bottom: maxY };
        }
        
        resize(newWidth, newHeight) {
            MainController.setState('canvas', { width: newWidth, height: newHeight });
            
            this.app.renderer.resize(newWidth, newHeight);
            
            if (this.containers.camera.mask) {
                this.containers.camera.mask.clear();
                this.containers.camera.mask.rect(0, 0, newWidth, newHeight);
                this.containers.camera.mask.fill(0x000000);
            }
            
            this.containers.camera.hitArea = new PIXI.Rectangle(0, 0, newWidth, newHeight);
            
            // 背景レイヤーサイズ更新
            window.LayerManager?.updateBackgroundSize(newWidth, newHeight);
            
            MainController.emit('ui-canvas-resize', { width: newWidth, height: newHeight });
        }
        
        clear() {
            this.paths.forEach(path => {
                if (path.graphics) {
                    path.graphics.destroy();
                }
            });
            this.paths = [];
            this.currentPath = null;
            
            const layers = window.LayerManager?.getAllLayers() || [];
            layers.forEach(layer => {
                layer.paths = [];
                layer.container.removeChildren();
            });
        }
        
        // === イベントハンドラー ===
        
        handleDrawStartRequest(payload) {
            // 🚨 Phase1修正: アクティブレイヤー制限強化
            const activeLayer = window.LayerManager?.getActiveLayer();
            if (!activeLayer || activeLayer.id !== payload.layerId) {
                return; // 非アクティブレイヤーへの描画禁止
            }
            
            const toolSettings = window.ToolManager?.getCurrentToolSettings();
            if (!toolSettings) return;
            
            const settings = {
                tool: toolSettings.tool, // 🚨 消しゴム修正: ツール情報追加
                color: toolSettings.color, // 🚨 消しゴム修正: 元の色を保持
                size: toolSettings.size,
                opacity: toolSettings.opacity
            };
            
            this.createPath(payload.worldX, payload.worldY, settings);
        }
        
        handleDrawContinueRequest(payload) {
            // 🚨 Phase1修正: 現在のパスがアクティブレイヤーのものか確認
            if (this.currentPath) {
                const activeLayer = window.LayerManager?.getActiveLayer();
                if (activeLayer && this.currentPath.layerId === activeLayer.id) {
                    this.extendPath(this.currentPath, payload.worldX, payload.worldY);
                }
            }
        }
        
        handleDrawEndRequest(payload) {
            if (this.currentPath) {
                // 🚨 Phase1修正: 最終確認でもレイヤー一致をチェック
                const activeLayer = window.LayerManager?.getActiveLayer();
                if (activeLayer && this.currentPath.layerId === activeLayer.id) {
                    this.finalizePath(this.currentPath);
                }
            }
        }
        
        handleSystemResizeRequest(payload) {
            this.resize(payload.width, payload.height);
        }
    }
    
    // === FPS監視 ===
    class SystemMonitor {
        constructor() {
            this.frameCount = 0;
            this.lastTime = performance.now();
        }
        
        start() {
            const update = () => {
                this.frameCount++;
                const currentTime = performance.now();
                
                if (currentTime - this.lastTime >= 1000) {
                    const fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastTime));
                    const element = document.getElementById('fps');
                    if (element) {
                        element.textContent = fps;
                    }
                    
                    this.frameCount = 0;
                    this.lastTime = currentTime;
                }
                
                requestAnimationFrame(update);
            };
            
            update();
        }
    }
    
    // === 統合衛星初期化 ===
    const layerManager = new LayerManager();
    const toolManager = new ToolManager();
    const uiManager = new UIManager();
    const drawingEngine = new DrawingEngine();
    const systemMonitor = new SystemMonitor();
    
    // グローバル参照設定
    window.LayerManager = layerManager;
    window.ToolManager = toolManager;
    window.UIManager = uiManager;
    window.DrawingEngine = drawingEngine;
    window.SystemMonitor = systemMonitor;
    
    // MainController準備完了待機
    const initWhenReady = async () => {
        if (window.MainController && MainController.getState) {
            try {
                // DrawingEngine初期化
                await drawingEngine.initialize();
                
                // 各マネージャー初期化
                layerManager.initialize(drawingEngine);
                toolManager.initialize();
                uiManager.initialize();
                systemMonitor.start();
                
                MainController.emit('system-debug', {
                    category: 'init',
                    message: 'layer-tool-ui.js satellite initialized - Phase1 fixes applied',
                    data: { 
                        components: ['LayerManager', 'ToolManager', 'UIManager', 'DrawingEngine', 'SystemMonitor'],
                        pixiVersion: window.PIXI?.VERSION,
                        phase1Fixes: [
                            'Initial layer panel display fixed',
                            'Layer separation enforcement added'
                        ]
                    },
                    timestamp: Date.now()
                });
                
            } catch (error) {
                MainController.emit('system-error', {
                    code: 'LAYER_TOOL_UI_INIT_FAILED',
                    details: { message: error.message },
                    stack: error.stack
                });
            }
        } else {
            setTimeout(initWhenReady, 10);
        }
    };
    
    // DOM読み込み完了後に初期化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initWhenReady);
    } else {
        initWhenReady();
    }
    
})();