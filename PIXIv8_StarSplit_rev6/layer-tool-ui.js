/**
 * 🛰️ layer-tool-ui.js - LayerManager+ToolManager+UIManager+DrawingEngine統合衛星
 * Version: 3.0.0 | Last Modified: 2025-09-07
 * 
 * [🎯 責務範囲]
 * - レイヤー管理（CRUD、並び替え、可視性、変形）
 * - ツール管理（ペン、消しゴム、ブラシ設定）
 * - UI制御（ポップアップ、パネル、ステータス、Lodash最適化）
 * - PixiJS描画エンジン（パス作成・延長・消去、ワールド座標対応）
 * 
 * [🔧 主要修正点]
 * - レイヤーパネル初期表示修正（mount機能追加）
 * - レイヤー分離強化（アクティブレイヤー制限）
 * - 背景レイヤー編集可能化
 * - undo/redo対応のパス管理
 * 
 * [🔧 主要メソッド - LayerManager]
 * createLayer(name) → layer               - レイヤー作成
 * deleteLayer(id)                         - レイヤー削除
 * setActiveLayer(id)                      - アクティブ設定
 * reorderLayers(from, to)                 - ドラッグ並び替え
 * toggleLayerVisibility(id)               - 表示切替
 * createEditableBackgroundLayer()         - 編集可能背景作成（新規）
 * 
 * [🔧 主要メソッド - ToolManager]
 * selectTool(toolName)                    - ツール選択
 * setBrushSize(size)                      - ブラシサイズ
 * setOpacity(opacity)                     - 不透明度
 * getCurrentToolSettings() → settings      - 現在設定取得
 * 
 * [🔧 主要メソッド - UIManager] 
 * mount(selector)                         - パネルマウント（新規）
 * updateLayerPanel()                      - レイヤーパネル更新（debounce）
 * forceUpdateLayerPanel()                 - 強制更新（新規）
 * showPopup(popupId)                      - ポップアップ表示
 * hidePopup(popupId)                      - ポップアップ非表示
 * updateStatusBar(data)                   - ステータス更新（throttle）
 * 
 * [🔧 主要メソッド - DrawingEngine]
 * createPath(worldX, worldY, settings) → path  - パス作成（ワールド座標）
 * extendPath(path, worldX, worldY)             - パス延長
 * finalizePath(path)                           - パス完成
 * restorePath(pathData)                        - パス復元（新規）
 * removePath(pathId)                           - パス削除（新規）
 * 
 * [📡 処理イベント（IN）]
 * - layer-*-request : レイヤー操作要求
 * - tool-*-request : ツール操作要求  
 * - draw-*-request : 描画操作要求
 * - path-restore-request / path-remove-request : undo/redo対応
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
            this.createEditableBackgroundLayer(); // ✅ 修正: 編集可能な背景レイヤー
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
        
        // ✅ 修正: 編集可能な背景レイヤー作成
        createEditableBackgroundLayer() {
            const layerId = 0;
            const layerName = '背景';
            
            const container = new PIXI.Container();
            container.name = layerName;
            container.visible = true;
            
            // ✅ 変更: 編集可能な背景パスを作成
            const backgroundPath = this.createDefaultBackgroundPath();
            container.addChild(backgroundPath.graphics);
            
            const layer = {
                id: layerId,
                name: layerName,
                container: container,
                visible: true,
                paths: [backgroundPath],  // ✅ 編集可能パスとして管理
                isBackground: true,
                editable: true  // ✅ 編集許可フラグ
            };
            
            this.layers.set(layerId, layer);
            this.engine.containers.world.addChild(container);
            this.activeLayerId = layerId;  // ✅ 背景から開始
            
            // 最初の透明レイヤー作成
            this.createLayer('レイヤー1');
            // ✅ 修正: 背景レイヤーをアクティブのまま維持
        }
        
        // ✅ 新規追加: デフォルト背景パス作成
        createDefaultBackgroundPath() {
            const canvasState = MainController.getState('canvas');
            const path = {
                id: 'background_fill',
                graphics: new PIXI.Graphics(),
                points: [
                    { x: 0, y: 0, size: canvasState.width },
                    { x: canvasState.width, y: canvasState.height, size: 1 }
                ],
                color: 0xf0e0d6,  // futaba-cream
                size: 1,
                opacity: 1,
                isComplete: true,
                isBackgroundFill: true
            };
            
            // 背景全体を塗りつぶし
            path.graphics.rect(0, 0, canvasState.width, canvasState.height);
            path.graphics.fill({ color: 0xf0e0d6, alpha: 1 });
            
            return path;
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
                isBackground: false,
                editable: true // すべてのレイヤーは編集可能
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
            if (activeLayer && path && activeLayer.editable) { // ✅ 編集可能チェック追加
                activeLayer.paths.push(path);
                activeLayer.container.addChild(path.graphics);
                return true;
            }
            return false;
        }
        
        // ✅ 修正: 背景サイズ更新（編集可能背景対応）
        updateBackgroundSize(width, height) {
            const backgroundLayer = this.layers.get(0);
            if (backgroundLayer && backgroundLayer.paths.length > 0) {
                const backgroundPath = backgroundLayer.paths[0];
                if (backgroundPath && backgroundPath.isBackgroundFill) {
                    backgroundPath.graphics.clear();
                    backgroundPath.graphics.rect(0, 0, width, height);
                    backgroundPath.graphics.fill({ color: 0xf0e0d6, alpha: 1 });
                    
                    // ポイント情報更新
                    backgroundPath.points = [
                        { x: 0, y: 0, size: width },
                        { x: width, y: height, size: 1 }
                    ];
                }
            }
        }
        
        // ✅ 新規追加: パスをレイヤーから削除
        removePathFromLayer(pathId, layerId = null) {
            const targetLayerId = layerId || this.activeLayerId;
            const layer = this.layers.get(targetLayerId);
            
            if (layer) {
                const pathIndex = layer.paths.findIndex(p => p.id === pathId);
                if (pathIndex >= 0) {
                    const path = layer.paths[pathIndex];
                    layer.container.removeChild(path.graphics);
                    path.graphics.destroy();
                    layer.paths.splice(pathIndex, 1);
                    return true;
                }
            }
            return false;
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
            this.setupToolButtons();
            
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
            MainController.on('opacity-change', (payload) => this.handleOpacityChange(payload));
        }
        
        setupToolButtons() {
            // ペンツールボタン
            const penButton = document.getElementById('pen-tool');
            if (penButton) {
                penButton.addEventListener('click', () => {
                    this.selectTool('pen');
                    window.UIManager?.showPopup('pen-settings');
                });
            }
            
            // 消しゴムツールボタン
            const eraserButton = document.getElementById('eraser-tool');
            if (eraserButton) {
                eraserButton.addEventListener('click', () => {
                    this.selectTool('eraser');
                    window.UIManager?.hideAllPopups();
                });
            }
            
            // リサイズツールボタン
            const resizeButton = document.getElementById('resize-tool');
            if (resizeButton) {
                resizeButton.addEventListener('click', () => {
                    this.selectTool('resize');
                    window.UIManager?.showPopup('resize-settings');
                });
            }
        }
        
        selectTool(toolName) {
            this.currentTool = toolName;
            this.updateToolButtonStates();
            
            MainController.emit('tool-selected', { 
                tool: toolName,
                settings: this.getCurrentToolSettings()
            });
        }
        
        updateToolButtonStates() {
            const buttons = document.querySelectorAll('.tool-button');
            buttons.forEach(button => {
                button.classList.remove('active');
            });
            
            const activeButton = document.getElementById(`${this.currentTool}-tool`);
            if (activeButton) {
                activeButton.classList.add('active');
            }
        }
        
        setBrushSize(size) {
            this.brushSize = Math.max(1, Math.min(100, size));
            MainController.emit('brush-settings-changed', {
                size: this.brushSize,
                opacity: this.opacity
            });
        }
        
        setOpacity(opacity) {
            this.opacity = Math.max(0.1, Math.min(1.0, opacity));
            MainController.emit('brush-settings-changed', {
                size: this.brushSize,
                opacity: this.opacity
            });
        }
        
        getCurrentToolSettings() {
            return {
                tool: this.currentTool,
                size: this.brushSize,
                color: this.brushColor,
                opacity: this.opacity
            };
        }
        
        startDrawing(worldX, worldY, spacePressed = false) {
            if (spacePressed || this.drawing.active) return;
            
            this.drawing.active = true;
            this.drawing.lastPoint = { x: worldX, y: worldY };
            
            MainController.emit('draw-start-request', {
                worldX: worldX,
                worldY: worldY,
                layerId: MainController.getState('activeLayerId'),
                tool: this.currentTool,
                settings: this.getCurrentToolSettings()
            });
        }
        
        continueDrawing(worldX, worldY, spacePressed = false) {
            if (spacePressed || !this.drawing.active) return;
            
            const lastPoint = this.drawing.lastPoint;
            if (lastPoint) {
                const distance = Math.sqrt((worldX - lastPoint.x) ** 2 + (worldY - lastPoint.y) ** 2);
                if (distance < 1) return; // 最小移動距離
            }
            
            this.drawing.lastPoint = { x: worldX, y: worldY };
            
            MainController.emit('draw-continue-request', {
                worldX: worldX,
                worldY: worldY,
                tool: this.currentTool
            });
        }
        
        stopDrawing(worldX = null, worldY = null) {
            if (!this.drawing.active) return;
            
            this.drawing.active = false;
            this.drawing.path = null;
            this.drawing.lastPoint = null;
            
            MainController.emit('draw-end-request', {
                worldX: worldX,
                worldY: worldY,
                tool: this.currentTool
            });
        }
        
        // === イベントハンドラー ===
        
        handleToolSelectRequest(payload) {
            this.selectTool(payload.tool);
        }
        
        handleBrushSizeChange(payload) {
            this.setBrushSize(payload.size);
        }
        
        handleOpacityChange(payload) {
            this.setOpacity(payload.opacity);
        }
    }
    
    // === UIManager - UI制御衛星 ===
    class UIManager {
        constructor() {
            this.popupStates = new Map();
            this.panelContainer = null; // ✅ 新規追加: パネルコンテナ
            this.mounted = false; // ✅ 新規追加: マウント状態
            
            // Lodash関数（存在確認付き）
            this.debouncedUpdateLayerPanel = null;
            this.throttledUpdateStatus = null;
        }
        
        initialize() {
            this.setupLodashFunctions();
            this.setupEventHandlers();
            this.setupSliders();
            this.setupButtons();
            
            MainController.emit('system-debug', {
                category: 'init',
                message: 'UIManager initialized',
                data: { 
                    lodashAvailable: !!window._,
                    mounted: this.mounted
                },
                timestamp: Date.now()
            });
        }
        
        // ✅ 新規追加: パネルマウント機能（GPT5改修案準拠）
        mount(selector) {
            const target = document.querySelector(selector);
            if (!target) {
                MainController.emit('system-error', { 
                    code: 'LAYER_PANEL_NOT_FOUND', 
                    details: { selector },
                    stack: new Error().stack
                });
                return false;
            }
            
            this.panelContainer = target;
            this.mounted = true;
            
            // 初期レイヤーパネルを即座に描画
            this.forceUpdateLayerPanel();
            
            MainController.emit('system-debug', {
                category: 'ui',
                message: 'UI panel mounted successfully',
                data: { selector, mounted: true },
                timestamp: Date.now()
            });
            
            return true;
        }
        
        setupLodashFunctions() {
            if (window._) {
                this.debouncedUpdateLayerPanel = _.debounce(() => this.updateLayerPanel(), 100);
                this.throttledUpdateStatus = _.throttle((data) => this.updateStatusBar(data), 50);
            } else {
                // フォールバック（Lodash未使用時）
                this.debouncedUpdateLayerPanel = () => this.updateLayerPanel();
                this.throttledUpdateStatus = (data) => this.updateStatusBar(data);
            }
        }
        
        setupEventHandlers() {
            MainController.on('layer-created', () => this.debouncedUpdateLayerPanel());
            MainController.on('layer-deleted', () => this.debouncedUpdateLayerPanel());
            MainController.on('layer-activated', () => this.debouncedUpdateLayerPanel());
            MainController.on('layer-visibility-changed', () => this.debouncedUpdateLayerPanel());
            MainController.on('layer-reordered', () => this.debouncedUpdateLayerPanel());
            
            MainController.on('brush-settings-changed', (payload) => this.updateBrushSettingsUI(payload));
            MainController.on('ui-coordinates-update', (payload) => this.throttledUpdateStatus(payload));
        }
        
        setupSliders() {
            this.setupPenSizeSlider();
            this.setupOpacitySlider();
        }
        
        setupPenSizeSlider() {
            const slider = document.getElementById('pen-size-slider');
            const handle = document.getElementById('pen-size-handle');
            const track = document.getElementById('pen-size-track');
            const value = document.getElementById('pen-size-value');
            
            if (!slider || !handle || !track || !value) return;
            
            let isDragging = false;
            let currentSize = 16.0;
            const minSize = 1.0;
            const maxSize = 100.0;
            
            const updateSlider = (size) => {
                currentSize = Math.max(minSize, Math.min(maxSize, size));
                const percent = ((currentSize - minSize) / (maxSize - minSize)) * 100;
                
                track.style.width = `${percent}%`;
                handle.style.left = `${percent}%`;
                value.textContent = `${currentSize.toFixed(1)}px`;
                
                window.ToolManager?.setBrushSize(currentSize);
            };
            
            const handleMouseMove = (e) => {
                if (!isDragging) return;
                
                const rect = slider.getBoundingClientRect();
                const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                const size = minSize + (percent / 100) * (maxSize - minSize);
                
                updateSlider(size);
                e.preventDefault();
            };
            
            const handleMouseUp = () => {
                isDragging = false;
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
            
            handle.addEventListener('mousedown', (e) => {
                isDragging = true;
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
                e.preventDefault();
            });
            
            slider.addEventListener('click', (e) => {
                if (e.target === handle) return;
                
                const rect = slider.getBoundingClientRect();
                const percent = ((e.clientX - rect.left) / rect.width) * 100;
                const size = minSize + (percent / 100) * (maxSize - minSize);
                
                updateSlider(size);
            });
            
            // 初期値設定
            updateSlider(currentSize);
        }
        
        setupOpacitySlider() {
            const slider = document.getElementById('pen-opacity-slider');
            const handle = document.getElementById('pen-opacity-handle');
            const track = document.getElementById('pen-opacity-track');
            const value = document.getElementById('pen-opacity-value');
            
            if (!slider || !handle || !track || !value) return;
            
            let isDragging = false;
            let currentOpacity = 0.85;
            
            const updateSlider = (opacity) => {
                currentOpacity = Math.max(0.1, Math.min(1.0, opacity));
                const percent = ((currentOpacity - 0.1) / 0.9) * 100;
                
                track.style.width = `${percent}%`;
                handle.style.left = `${percent}%`;
                value.textContent = `${(currentOpacity * 100).toFixed(1)}%`;
                
                window.ToolManager?.setOpacity(currentOpacity);
            };
            
            const handleMouseMove = (e) => {
                if (!isDragging) return;
                
                const rect = slider.getBoundingClientRect();
                const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                const opacity = 0.1 + (percent / 100) * 0.9;
                
                updateSlider(opacity);
                e.preventDefault();
            };
            
            const handleMouseUp = () => {
                isDragging = false;
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
            
            handle.addEventListener('mousedown', (e) => {
                isDragging = true;
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
                e.preventDefault();
            });
            
            slider.addEventListener('click', (e) => {
                if (e.target === handle) return;
                
                const rect = slider.getBoundingClientRect();
                const percent = ((e.clientX - rect.left) / rect.width) * 100;
                const opacity = 0.1 + (percent / 100) * 0.9;
                
                updateSlider(opacity);
            });
            
            // 初期値設定
            updateSlider(currentOpacity);
        }
        
        setupButtons() {
            // レイヤー追加ボタン
            const addLayerBtn = document.getElementById('add-layer-btn');
            if (addLayerBtn) {
                addLayerBtn.addEventListener('click', () => {
                    const layerCount = window.LayerManager?.layers.size || 0;
                    MainController.emit('layer-create-request', { 
                        name: `レイヤー${layerCount}` 
                    });
                });
            }
            
            // キャンバスリサイズボタン
            const applyResizeBtn = document.getElementById('apply-resize');
            if (applyResizeBtn) {
                applyResizeBtn.addEventListener('click', () => {
                    const widthInput = document.getElementById('canvas-width');
                    const heightInput = document.getElementById('canvas-height');
                    
                    if (widthInput && heightInput) {
                        const width = parseInt(widthInput.value) || 400;
                        const height = parseInt(heightInput.value) || 400;
                        
                        MainController.emit('system-resize-request', { width, height });
                        this.hidePopup('resize-settings');
                    }
                });
            }
        }
        
        // ✅ 新規追加: 強制レイヤーパネル更新
        forceUpdateLayerPanel() {
            if (!this.mounted || !this.panelContainer) return;
            
            const layerManager = window.LayerManager;
            if (!layerManager) return;
            
            // パネル内容をクリア
            this.panelContainer.innerHTML = '';
            
            // スタイル設定
            this.panelContainer.style.cssText = `
                position: fixed; right: 16px; top: 16px;
                width: 220px; max-height: 70vh; overflow: auto;
                background: #1e1e1e; color: #fff; border-radius: 12px; padding: 16px;
                z-index: 20; box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            `;
            
            // タイトル追加
            const title = document.createElement('div');
            title.textContent = 'レイヤー';
            title.style.cssText = `
                font-weight: bold; margin-bottom: 12px; color: #fff;
                font-size: 14px; text-align: center;
                border-bottom: 1px solid #444; padding-bottom: 8px;
            `;
            this.panelContainer.appendChild(title);
            
            // レイヤーリスト作成
            const layers = Array.from(layerManager.layers.values()).reverse();
            
            layers.forEach((layer, index) => {
                const layerItem = document.createElement('div');
                layerItem.className = 'layer-item-custom';
                layerItem.dataset.layerId = layer.id;
                
                const isActive = layerManager.activeLayerId === layer.id;
                
                layerItem.style.cssText = `
                    display: flex; align-items: center; justify-content: space-between;
                    padding: 8px 12px; margin-bottom: 4px; border-radius: 6px;
                    cursor: pointer; transition: all 0.2s ease;
                    background: ${isActive ? '#0d7377' : '#2d2d2d'};
                    border: 1px solid ${isActive ? '#14a085' : '#444'};
                `;
                
                // レイヤー名
                const nameSpan = document.createElement('span');
                nameSpan.textContent = layer.name;
                nameSpan.style.cssText = `
                    flex: 1; color: #fff; font-size: 12px; font-weight: 500;
                `;
                
                // 可視性ボタン
                const visibilityBtn = document.createElement('button');
                visibilityBtn.innerHTML = layer.visible ? '👁️' : '🚫';
                visibilityBtn.style.cssText = `
                    background: none; border: none; color: #fff; cursor: pointer;
                    padding: 2px 4px; border-radius: 3px; font-size: 12px;
                `;
                
                // イベントリスナー
                layerItem.addEventListener('click', (e) => {
                    if (e.target === visibilityBtn) return;
                    MainController.emit('layer-activate-request', { layerId: layer.id });
                });
                
                visibilityBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    MainController.emit('layer-visibility-toggle', { layerId: layer.id });
                });
                
                // 削除ボタン（背景以外）
                if (!layer.isBackground) {
                    const deleteBtn = document.createElement('button');
                    deleteBtn.innerHTML = '🗑️';
                    deleteBtn.style.cssText = `
                        background: none; border: none; color: #ff6b6b; cursor: pointer;
                        padding: 2px 4px; border-radius: 3px; font-size: 12px; margin-left: 4px;
                    `;
                    
                    deleteBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (confirm(`レイヤー「${layer.name}」を削除しますか？`)) {
                            MainController.emit('layer-delete-request', { layerId: layer.id });
                        }
                    });
                    
                    layerItem.appendChild(nameSpan);
                    layerItem.appendChild(visibilityBtn);
                    layerItem.appendChild(deleteBtn);
                } else {
                    layerItem.appendChild(nameSpan);
                    layerItem.appendChild(visibilityBtn);
                }
                
                this.panelContainer.appendChild(layerItem);
            });
            
            // レイヤー追加ボタン
            const addButton = document.createElement('button');
            addButton.textContent = '+ レイヤー追加';
            addButton.style.cssText = `
                width: 100%; padding: 8px; margin-top: 8px; border: none;
                background: #0d7377; color: #fff; border-radius: 6px;
                cursor: pointer; font-size: 12px; font-weight: 500;
                transition: background 0.2s ease;
            `;
            
            addButton.addEventListener('click', () => {
                const layerCount = layerManager.layers.size;
                MainController.emit('layer-create-request', { 
                    name: `レイヤー${layerCount}` 
                });
            });
            
            addButton.addEventListener('mouseenter', () => {
                addButton.style.background = '#14a085';
            });
            
            addButton.addEventListener('mouseleave', () => {
                addButton.style.background = '#0d7377';
            });
            
            this.panelContainer.appendChild(addButton);
            
            MainController.emit('system-debug', {
                category: 'ui',
                message: 'Layer panel force updated',
                data: { layerCount: layers.length, mounted: this.mounted },
                timestamp: Date.now()
            });
        }
        
        updateLayerPanel() {
            // 通常の更新はforceUpdateLayerPanelに委譲
            this.forceUpdateLayerPanel();
        }
        
        showPopup(popupId) {
            const popup = document.getElementById(popupId);
            if (popup) {
                this.hideAllPopups();
                popup.classList.add('show');
                popup.style.display = 'block';
                this.popupStates.set(popupId, true);
                
                MainController.emit('ui-popup-shown', { popupId });
            }
        }
        
        hidePopup(popupId) {
            const popup = document.getElementById(popupId);
            if (popup) {
                popup.classList.remove('show');
                popup.style.display = 'none';
                this.popupStates.set(popupId, false);
                
                MainController.emit('ui-popup-hidden', { popupId });
            }
        }
        
        hideAllPopups() {
            const popups = document.querySelectorAll('.popup-panel');
            popups.forEach(popup => {
                popup.classList.remove('show');
                popup.style.display = 'none';
                this.popupStates.set(popup.id, false);
            });
        }
        
        updateBrushSettingsUI(payload) {
            // ペンサイズ表示更新
            const sizeValue = document.getElementById('pen-size-value');
            if (sizeValue) {
                sizeValue.textContent = `${payload.size.toFixed(1)}px`;
            }
            
            // 不透明度表示更新
            const opacityValue = document.getElementById('pen-opacity-value');
            if (opacityValue) {
                opacityValue.textContent = `${(payload.opacity * 100).toFixed(1)}%`;
            }
        }
        
        updateStatusBar(data) {
            // 座標更新は既にMainControllerで処理済み
            // 追加のステータス情報があればここで処理
        }
        
        // ✅ 新規追加: UIManager公開メソッド（GPT5改修案で言及された問題対応）
        static mount(selector) {
            if (!window.UIManager) {
                console.warn('UIManager not initialized yet');
                return false;
            }
            return window.UIManager.mount(selector);
        }
    }
    
    // === DrawingEngine - PixiJS描画エンジン ===
    class DrawingEngine {
        constructor() {
            this.app = null;
            this.containers = { camera: null, world: null, ui: null };
            this.paths = [];
            this.currentPath = null;
            this.pathRegistry = new Map(); // ✅ 新規追加: パス管理用レジストリ
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
            
            // ✅ 新規追加: undo/redo対応イベント
            MainController.on('path-restore-request', (payload) => this.handlePathRestoreRequest(payload));
            MainController.on('path-remove-request', (payload) => this.handlePathRemoveRequest(payload));
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
                layerId: MainController.getState('activeLayerId') // ✅ 追加: レイヤーID記録
            };
            
            path.graphics.circle(worldX, worldY, settings.size / 2);
            path.graphics.fill({ color: settings.color, alpha: settings.opacity });
            
            path.points.push({ x: worldX, y: worldY, size: settings.size });
            
            // ✅ 修正: アクティブレイヤーへのパス追加とレジストリ登録
            if (window.LayerManager?.addPathToActiveLayer(path)) {
                this.paths.push(path);
                this.pathRegistry.set(path.id, path); // レジストリに登録
                this.currentPath = path;
                
                MainController.emit('path-created', { 
                    pathId: path.id, 
                    layerId: MainController.getState('activeLayerId'),
                    worldBounds: this.calculatePathBounds(path)
                });
                
                return path;
            }
            
            return null;
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
                
                // ✅ 修正: 完全なパスデータを記録
                MainController.recordAction('PATH_CREATE', {
                    pathId: path.id,
                    layerId: path.layerId,
                    points: path.points,
                    settings: {
                        color: path.color,
                        size: path.size,
                        opacity: path.opacity
                    },
                    bounds: this.calculatePathBounds(path)
                });
            }
        }
        
        // ✅ 新規追加: パス復元（undo/redo対応）
        restorePath(pathData) {
            const path = {
                id: pathData.pathId,
                graphics: new PIXI.Graphics(),
                points: pathData.points,
                color: pathData.settings.color,
                size: pathData.settings.size,
                opacity: pathData.settings.opacity,
                isComplete: true,
                layerId: pathData.layerId
            };
            
            // グラフィックス再描画
            pathData.points.forEach(point => {
                path.graphics.circle(point.x, point.y, point.size / 2);
                path.graphics.fill({ color: path.color, alpha: path.opacity });
            });
            
            // レイヤーに追加
            const layer = window.LayerManager?.layers.get(pathData.layerId);
            if (layer) {
                layer.paths.push(path);
                layer.container.addChild(path.graphics);
                this.paths.push(path);
                this.pathRegistry.set(path.id, path);
                
                MainController.emit('system-debug', {
                    category: 'undo',
                    message: 'Path restored',
                    data: { pathId: path.id, layerId: pathData.layerId },
                    timestamp: Date.now()
                });
            }
        }
        
        // ✅ 新規追加: パス削除（undo/redo対応）
        removePath(pathId) {
            const path = this.pathRegistry.get(pathId);
            if (!path) return false;
            
            // レイヤーから削除
            const layer = window.LayerManager?.layers.get(path.layerId);
            if (layer) {
                const pathIndex = layer.paths.findIndex(p => p.id === pathId);
                if (pathIndex >= 0) {
                    layer.paths.splice(pathIndex, 1);
                    layer.container.removeChild(path.graphics);
                }
            }
            
            // グローバルリストから削除
            const globalIndex = this.paths.findIndex(p => p.id === pathId);
            if (globalIndex >= 0) {
                this.paths.splice(globalIndex, 1);
            }
            
            // グラフィックス破棄
            path.graphics.destroy();
            this.pathRegistry.delete(pathId);
            
            MainController.emit('system-debug', {
                category: 'undo',
                message: 'Path removed',
                data: { pathId, layerId: path.layerId },
                timestamp: Date.now()
            });
            
            return true;
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
            this.pathRegistry.clear();
            this.currentPath = null;
            
            const layers = window.LayerManager?.getAllLayers() || [];
            layers.forEach(layer => {
                layer.paths = [];
                layer.container.removeChildren();
            });
        }
        
        // === イベントハンドラー ===
        
        handleDrawStartRequest(payload) {
            // ✅ 修正: アクティブレイヤー制限強化
            const activeLayer = window.LayerManager?.getActiveLayer();
            if (!activeLayer || activeLayer.id !== payload.layerId) {
                MainController.emit('system-debug', {
                    category: 'drawing',
                    message: 'Draw request rejected - inactive layer',
                    data: { 
                        requestedLayerId: payload.layerId, 
                        activeLayerId: activeLayer?.id 
                    },
                    timestamp: Date.now()
                });
                return; // 非アクティブレイヤーへの描画禁止
            }
            
            const toolSettings = window.ToolManager?.getCurrentToolSettings();
            if (!toolSettings) return;
            
            const settings = {
                color: toolSettings.tool === 'eraser' ? 0xf0e0d6 : toolSettings.color,
                size: toolSettings.size,
                opacity: toolSettings.tool === 'eraser' ? 1.0 : toolSettings.opacity
            };
            
            this.createPath(payload.worldX, payload.worldY, settings);
        }
        
        handleDrawContinueRequest(payload) {
            if (this.currentPath) {
                this.extendPath(this.currentPath, payload.worldX, payload.worldY);
            }
        }
        
        handleDrawEndRequest(payload) {
            if (this.currentPath) {
                this.finalizePath(this.currentPath);
            }
        }
        
        
        // ✅ 新規追加: undo/redo対応イベントハンドラー
        handlePathRestoreRequest(payload) {
            this.restorePath(payload);
        }
        
        handlePathRemoveRequest(payload) {
            this.removePath(payload.pathId);
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
    
    // ✅ 新規追加: LayerToolUI 公開インターフェース（GPT5改修案準拠）
    window.LayerToolUI = {
        mount: function(selector) {
            return uiManager.mount(selector);
        },
        
        forceUpdateLayerPanel: function() {
            return uiManager.forceUpdateLayerPanel();
        },
        
        getManager: function(type) {
            const managers = {
                'layer': layerManager,
                'tool': toolManager,
                'ui': uiManager,
                'drawing': drawingEngine,
                'monitor': systemMonitor
            };
            return managers[type] || null;
        },
        
        getStatus: function() {
            return {
                initialized: !!(layerManager && toolManager && uiManager && drawingEngine),
                mounted: uiManager.mounted,
                layerCount: layerManager.layers.size,
                activeTool: toolManager.currentTool,
                activeLayer: layerManager.activeLayerId
            };
        }
    };
    
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
                    message: 'layer-tool-ui.js satellite initialized',
                    data: { 
                        components: ['LayerManager', 'ToolManager', 'UIManager', 'DrawingEngine', 'SystemMonitor'],
                        pixiVersion: window.PIXI?.VERSION,
                        improvements: [
                            'Layer panel initial display fixed',
                            'Layer separation enforced',
                            'Editable background layer',
                            'Undo/Redo path management',
                            'Mount interface added'
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