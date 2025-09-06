/**
 * @module   LayerToolUI
 * @role     レイヤー管理 + ツール + UI
 * @depends  MainController
 * @provides init(), createLayer(name?), deleteLayer(id), setActiveLayer(id), onUIButtonClick(event)
 * @notes    Layer ID 安定生成、UIボタン重複禁止、循環参照禁止、EnginePosition統合
 * @flow     レイヤー作成 → EnginePosition → MainController → UI更新
 * @memory   レイヤー構造、アクティブレイヤーID、ツール選択状態、UI状態
 * @revision EnginePosition統合対応 - createLayer処理をEnginePositionに移管、ID統合管理
 */

const LayerToolUI = (() => {
    // Layer Management - EnginePositionとの統合（改修案対応）
    let layers = new Map();
    let activeLayerId = null;
    let nextLayerId = 1;
    
    // Tool Management  
    let currentTool = 'pen';
    let brushSize = 16.0;
    let brushColor = 0x800000;
    let opacity = 0.85;
    let drawing = { active: false, path: null };
    
    // UI State
    let activePopup = null;
    let sliders = new Map();
    let dragState = { active: false, offset: { x: 0, y: 0 } };
    let layerDragState = {
        dragging: false,
        dragItem: null,
        startY: 0,
        offset: 0
    };
    
    async function init() {
        try {
            setupToolButtons();
            setupPopups();
            setupSliders();
            setupResizeControls();
            setupLayerControls();
            
            // 初期レイヤー作成はEnginePositionに移管（改修案対応）
            // EnginePositionが背景レイヤーを作成済みなので、UI側は同期のみ
            
            updateCanvasInfo();
            updateToolDisplay();
            
            console.log('[LayerToolUI] Initialized with EnginePosition integration');
            return true;
            
        } catch (error) {
            console.error('[LayerToolUI] Initialization failed:', error);
            window.MainController?.safeNotify('error-occurred', {
                source: 'LayerToolUI',
                error: error.message
            });
            return false;
        }
    }
    
    // Layer Management Functions - EnginePosition統合（改修案の重要な修正点）
    /**
     * レイヤー作成 - EnginePositionに移管
     */
    function createLayer(name = null) {
        const layerName = name || `レイヤー${nextLayerId++}`;
        
        // EnginePositionでレイヤー作成要求（改修案対応）
        window.MainController?.safeNotify('layer-created-external', { 
            name: layerName
        });
        
        // UI側は後でenginePositionからの通知で同期
        console.log(`[LayerToolUI] Layer creation requested: ${layerName}`);
    }
    
    /**
     * レイヤー情報をEnginePositionから受信して同期（改修案対応）
     */
    function syncLayerFromEngine(layerData) {
        const layer = {
            id: layerData.layerId,
            name: layerData.name,
            visible: layerData.visible !== false,
            strokes: [],
            isBackground: layerData.isBackground || false
        };
        
        layers.set(layer.id, layer);
        
        // アクティブレイヤーが未設定の場合は設定
        if (activeLayerId === null) {
            activeLayerId = layer.id;
        }
        
        updateLayerUI();
        console.log(`[LayerToolUI] Layer synced from EnginePosition: ${layer.name} (ID: ${layer.id})`);
    }
    
    function deleteLayer(layerId) {
        if (layerId === 0) return; // Cannot delete background layer
        if (layers.size <= 2) return; // Must have background + at least one layer
        
        const layer = layers.get(layerId);
        if (!layer || layer.isBackground) return;
        
        layers.delete(layerId);
        
        if (activeLayerId === layerId) {
            const remainingLayers = Array.from(layers.keys()).filter(id => id !== 0);
            activeLayerId = remainingLayers[remainingLayers.length - 1] || 0;
            
            // EnginePositionにアクティブレイヤー変更通知（改修案対応）
            window.MainController?.safeNotify('active-layer-changed', { layerId: activeLayerId });
        }
        
        updateLayerUI();
        window.MainController?.safeNotify('layer-deleted', { layerId: layerId });
    }
    
    function setActiveLayer(layerId) {
        if (layers.has(layerId)) {
            activeLayerId = layerId;
            updateLayerUI();
            updateStatusDisplay();
            
            // EnginePositionにアクティブレイヤー変更通知（改修案対応）
            window.MainController?.safeNotify('active-layer-changed', { layerId: layerId });
        }
    }
    
    function toggleLayerVisibility(layerId) {
        const layer = layers.get(layerId);
        if (!layer) return;
        
        layer.visible = !layer.visible;
        updateLayerUI();
        
        // EnginePositionに表示状態変更通知（改修案対応）
        window.MainController?.safeNotify('layer-visibility-changed', { 
            layerId: layerId, 
            visible: layer.visible 
        });
    }
    
    function getActiveLayer() {
        return layers.get(activeLayerId);
    }
    
    function addStrokeToActiveLayer(strokeData) {
        const activeLayer = getActiveLayer();
        if (activeLayer && strokeData) {
            // strokeオブジェクトではなくIDと必要最小情報のみ保存
            activeLayer.strokes.push({
                strokeId: strokeData.strokeId || strokeData.pathId || 'unknown',
                pointsCount: strokeData.points?.length || strokeData.pointsCount || 0,
                color: strokeData.color,
                size: strokeData.size,
                opacity: strokeData.opacity
            });
            
            console.log(`[LayerToolUI] Stroke added to layer ${activeLayer.name}: ${strokeData.strokeId || strokeData.pathId}`);
        }
    }
    
    function reorderLayers(fromIndex, toIndex) {
        const layerIds = Array.from(layers.keys()).filter(id => id !== 0).reverse();
        
        if (fromIndex < 0 || fromIndex >= layerIds.length ||
            toIndex < 0 || toIndex >= layerIds.length ||
            fromIndex === toIndex) return;
        
        updateLayerUI();
        
        window.MainController?.safeNotify('layers-reordered', { 
            fromIndex, 
            toIndex 
        });
    }
    
    // Tool Management Functions
    function selectTool(tool) {
        currentTool = tool;
        updateToolDisplay();
        
        window.MainController?.safeNotify('tool-selected', { tool });
    }
    
    function setBrushSize(size) {
        brushSize = Math.max(0.1, Math.min(100, Math.round(size * 10) / 10));
        window.MainController?.safeNotify('brush-size-changed', { size: brushSize });
    }
    
    function setOpacity(opacityValue) {
        opacity = Math.max(0, Math.min(1, Math.round(opacityValue * 1000) / 1000));
        window.MainController?.safeNotify('brush-opacity-changed', { opacity });
    }
    
    // Drawing Operations - アクティブレイヤー制御強化（改修案対応）
    function startDrawing(x, y, isPanning) {
        if (isPanning) return false;
        
        const activeLayer = getActiveLayer();
        if (!activeLayer) {
            console.warn('[LayerToolUI] No active layer for drawing');
            return false;
        }
        
        drawing.active = true;
        
        const color = currentTool === 'eraser' ? 0xf0e0d6 : brushColor;
        const alpha = currentTool === 'eraser' ? 1.0 : opacity;
        
        // World座標でstroke作成データ作成、アクティブレイヤーID付与
        const strokeData = {
            x, y,
            size: brushSize,
            color,
            opacity: alpha
        };
        
        // アクティブレイヤーIDと共に通知（改修案の重要な修正点）
        window.MainController?.safeNotify('path-created', { 
            path: strokeData,
            layerId: activeLayer.id 
        });
        
        console.log(`[LayerToolUI] Drawing started on layer: ${activeLayer.name} (${activeLayer.id})`);
        return true;
    }
    
    function continueDrawing(x, y, isPanning) {
        if (!drawing.active || isPanning) return;
        
        // アクティブレイヤー確認（改修案対応）
        const activeLayer = getActiveLayer();
        if (!activeLayer) {
            console.warn('[LayerToolUI] No active layer for drawing continuation');
            stopDrawing();
            return;
        }
        
        // World座標のみ送信
        window.MainController?.safeNotify('path-extend', { x, y });
    }
    
    function stopDrawing() {
        if (drawing.active) {
            drawing.active = false;
            window.MainController?.safeNotify('path-complete', {});
            console.log('[LayerToolUI] Drawing completed');
        }
    }
    
    // Eraser Operations - アクティブレイヤー制御（改修案対応）
    function eraseStroke(stroke) {
        const activeLayer = getActiveLayer();
        if (!activeLayer || !stroke) return false;
        
        // アクティブレイヤーのstrokeのみ消去可能
        if (stroke.layerId !== activeLayer.id) {
            console.warn('[LayerToolUI] Cannot erase stroke from inactive layer');
            return false;
        }
        
        // 消去処理
        window.MainController?.safeNotify('stroke-erase-requested', {
            strokeId: stroke.id,
            layerId: activeLayer.id
        });
        return true;
    }
    
    // UI Management Functions
    function setupToolButtons() {
        document.querySelectorAll('.tool-button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (btn.classList.contains('disabled')) return;
                handleToolClick(e.currentTarget);
            });
        });
    }
    
    function handleToolClick(button) {
        const toolId = button.id;
        
        if (toolId === 'pen-tool') {
            selectTool('pen');
            togglePopup('pen-settings');
        } else if (toolId === 'eraser-tool') {
            selectTool('eraser');
            closeAllPopups();
        } else if (toolId === 'resize-tool') {
            togglePopup('resize-settings');
        }
    }
    
    function updateToolDisplay() {
        document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
        const toolBtn = document.getElementById(currentTool + '-tool');
        if (toolBtn) toolBtn.classList.add('active');
        
        const toolNames = { pen: 'ベクターペン', eraser: '消しゴム' };
        const toolElement = document.getElementById('current-tool');
        if (toolElement) {
            toolElement.textContent = toolNames[currentTool] || currentTool;
        }
        
        // Update cursor through EnginePosition
        const cursors = { pen: 'crosshair', eraser: 'cell' };
        const cursor = cursors[currentTool] || 'crosshair';
        
        const app = window.EnginePosition?.getApp?.();
        if (app?.canvas) {
            app.canvas.style.cursor = cursor;
        }
    }
    
    function setupLayerControls() {
        const addLayerBtn = document.getElementById('add-layer-btn');
        
        if (addLayerBtn) {
            addLayerBtn.addEventListener('click', () => {
                createLayer(); // EnginePositionに移管済み
            });
        }
    }
    
    function updateLayerUI() {
        const layerList = document.getElementById('layer-list');
        if (!layerList) return;
        
        layerList.innerHTML = '';
        
        // Render layers in reverse order (top to bottom in UI), exclude background
        const layerIds = Array.from(layers.keys()).filter(id => id !== 0).reverse();
        
        layerIds.forEach((layerId, index) => {
            const layer = layers.get(layerId);
            const layerItem = document.createElement('div');
            layerItem.className = `layer-item ${layerId === activeLayerId ? 'active' : ''}`;
            layerItem.dataset.layerId = layerId;
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
            
            // Event handlers
            layerItem.addEventListener('click', (e) => {
                const action = e.target.closest('[data-action]')?.dataset.action;
                if (action === 'toggle-visibility') {
                    toggleLayerVisibility(layerId);
                } else if (!layerDragState.dragging) {
                    setActiveLayer(layerId);
                }
            });
            
            // Layer drag functionality
            setupLayerDrag(layerItem, index);
            
            layerList.appendChild(layerItem);
        });
        
        // Add background layer at the bottom
        const backgroundLayer = layers.get(0);
        if (backgroundLayer) {
            const backgroundItem = document.createElement('div');
            backgroundItem.className = `layer-item ${0 === activeLayerId ? 'active' : ''}`;
            backgroundItem.dataset.layerId = 0;
            
            const eyeIcon = backgroundLayer.visible ? 
                '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye-icon lucide-eye"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>' :
                '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye-off-icon lucide-eye-off"><path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/></svg>';
            
            backgroundItem.innerHTML = `
                <div class="layer-name">${backgroundLayer.name}</div>
                <div class="layer-visibility ${backgroundLayer.visible ? '' : 'hidden'}" data-action="toggle-visibility">
                    ${eyeIcon}
                </div>
            `;
            
            backgroundItem.addEventListener('click', (e) => {
                const action = e.target.closest('[data-action]')?.dataset.action;
                if (action === 'toggle-visibility') {
                    toggleLayerVisibility(0);
                } else {
                    setActiveLayer(0);
                }
            });
            
            layerList.appendChild(backgroundItem);
        }
    }
    
    function setupLayerDrag(layerItem, index) {
        const layerName = layerItem.querySelector('.layer-name');
        
        layerName.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            
            layerDragState.dragging = true;
            layerDragState.dragItem = layerItem;
            layerDragState.startY = e.clientY;
            layerDragState.offset = e.clientY - layerItem.getBoundingClientRect().top;
            
            layerItem.classList.add('dragging');
            
            const boundMouseMove = onLayerDrag.bind(this);
            const boundMouseUp = onLayerDragEnd.bind(this);
            
            document.addEventListener('mousemove', boundMouseMove);
            document.addEventListener('mouseup', boundMouseUp);
            
            layerDragState.boundMouseMove = boundMouseMove;
            layerDragState.boundMouseUp = boundMouseUp;
            
            e.preventDefault();
            e.stopPropagation();
        });
    }
    
    function onLayerDrag(e) {
        if (!layerDragState.dragging || !layerDragState.dragItem) return;
        
        const layerList = document.getElementById('layer-list');
        const items = Array.from(layerList.children).filter(item => 
            !item.dataset.layerId || item.dataset.layerId !== '0'
        );
        
        const dragItem = layerDragState.dragItem;
        dragItem.style.position = 'absolute';
        dragItem.style.top = (e.clientY - layerDragState.offset) + 'px';
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
    
    function onLayerDragEnd(e) {
        if (!layerDragState.dragging || !layerDragState.dragItem) return;
        
        const layerList = document.getElementById('layer-list');
        const items = Array.from(layerList.children).filter(item => 
            !item.dataset.layerId || item.dataset.layerId !== '0'
        );
        const dragItem = layerDragState.dragItem;
        
        const dropTarget = items.find(item => 
            item !== dragItem && item.classList.contains('drop-target')
        );
        
        if (dropTarget) {
            const fromIndex = parseInt(dragItem.dataset.layerIndex);
            const toIndex = parseInt(dropTarget.dataset.layerIndex);
            reorderLayers(fromIndex, toIndex);
        }
        
        // Cleanup
        dragItem.classList.remove('dragging');
        dragItem.style.position = '';
        dragItem.style.top = '';
        dragItem.style.zIndex = '';
        
        items.forEach(item => item.classList.remove('drop-target'));
        
        if (layerDragState.boundMouseMove) {
            document.removeEventListener('mousemove', layerDragState.boundMouseMove);
        }
        if (layerDragState.boundMouseUp) {
            document.removeEventListener('mouseup', layerDragState.boundMouseUp);
        }
        
        layerDragState = {
            dragging: false,
            dragItem: null,
            startY: 0,
            offset: 0,
            boundMouseMove: null,
            boundMouseUp: null
        };
        
        setTimeout(() => updateLayerUI(), 100);
    }
    
    function updateStatusDisplay() {
        const activeLayer = getActiveLayer();
        const element = document.getElementById('current-layer');
        if (element && activeLayer) {
            element.textContent = activeLayer.name;
        }
    }
    
    // Popup Management
    function togglePopup(popupId) {
        const popup = document.getElementById(popupId);
        if (!popup) return;
        
        if (activePopup && activePopup !== popup) {
            activePopup.classList.remove('show');
        }
        
        const isVisible = popup.classList.contains('show');
        popup.classList.toggle('show', !isVisible);
        activePopup = isVisible ? null : popup;
    }
    
    function setupPopups() {
        document.querySelectorAll('.popup-panel').forEach(popup => {
            const title = popup.querySelector('.popup-title');
            if (title) {
                title.style.cursor = 'move';
                title.addEventListener('mousedown', (e) => startDrag(e, popup));
            }
        });
        
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.popup-panel') && 
                !e.target.closest('.tool-button') &&
                !e.target.closest('.layer-panel-container')) {
                closeAllPopups();
            }
        });
        
        document.addEventListener('mousemove', (e) => onDrag(e));
        document.addEventListener('mouseup', () => stopDrag());
    }
    
    function startDrag(e, popup) {
        dragState.active = popup;
        const rect = popup.getBoundingClientRect();
        dragState.offset.x = e.clientX - rect.left;
        dragState.offset.y = e.clientY - rect.top;
        e.preventDefault();
    }
    
    function onDrag(e) {
        if (!dragState.active) return;
        
        const x = Math.max(0, Math.min(e.clientX - dragState.offset.x, 
            window.innerWidth - dragState.active.offsetWidth));
        const y = Math.max(0, Math.min(e.clientY - dragState.offset.y, 
            window.innerHeight - dragState.active.offsetHeight));
        
        dragState.active.style.left = x + 'px';
        dragState.active.style.top = y + 'px';
    }
    
    function stopDrag() {
        dragState.active = false;
    }
    
    function closeAllPopups() {
        document.querySelectorAll('.popup-panel').forEach(popup => {
            popup.classList.remove('show');
        });
        activePopup = null;
    }
    
    // Slider Management
    function setupSliders() {
        createSlider('pen-size-slider', 0.1, 100, 16.0, (value) => {
            setBrushSize(value);
            return value.toFixed(1) + 'px';
        });
        
        createSlider('pen-opacity-slider', 0, 100, 85.0, (value) => {
            setOpacity(value / 100);
            return value.toFixed(1) + '%';
        });
    }
    
    function createSlider(sliderId, min, max, initial, callback) {
        const container = document.getElementById(sliderId);
        if (!container) return;
        
        const track = container.querySelector('.slider-track');
        const handle = container.querySelector('.slider-handle');
        const valueDisplay = container.parentNode.querySelector('.slider-value');
        
        if (!track || !handle || !valueDisplay) return;
        
        const slider = {
            value: initial, min, max, callback, track, handle, valueDisplay, dragging: false
        };
        
        sliders.set(sliderId, slider);
        
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
    
    // Resize Controls
    function setupResizeControls() {
        const applyButton = document.getElementById('apply-resize');
        if (applyButton) {
            applyButton.addEventListener('click', () => applyResize());
        }
    }
    
    function applyResize() {
        const widthInput = document.getElementById('canvas-width');
        const heightInput = document.getElementById('canvas-height');
        
        if (widthInput && heightInput) {
            const width = parseInt(widthInput.value);
            const height = parseInt(heightInput.value);
            
            if (width >= 100 && width <= 4096 && height >= 100 && height <= 4096) {
                window.MainController?.safeNotify('canvas-resize-requested', { 
                    width, height 
                });
                updateCanvasInfo();
                closeAllPopups();
            }
        }
    }
    
    function updateCanvasInfo() {
        const element = document.getElementById('canvas-info');
        if (element) {
            element.textContent = `${APP_CONFIG.canvas.width}×${APP_CONFIG.canvas.height}px`;
        }
    }
    
    function updateCoordinates(x, y) {
        const element = document.getElementById('coordinates');
        if (element) {
            element.textContent = `x: ${Math.round(x)}, y: ${Math.round(y)}`;
        }
    }
    
    // Event Handler from MainController
    function onEvent(event) {
        switch (event.type) {
            case 'coordinates-changed':
                if (event.payload?.x !== undefined && event.payload?.y !== undefined) {
                    updateCoordinates(event.payload.x, event.payload.y);
                }
                break;
                
            case 'stroke-start-requested':
                if (event.payload?.x !== undefined && event.payload?.y !== undefined) {
                    const appState = window.MainController?.getAppState();
                    startDrawing(event.payload.x, event.payload.y, appState?.spacePressed);
                }
                break;
                
            case 'stroke-continue-requested':
                if (event.payload?.x !== undefined && event.payload?.y !== undefined) {
                    const appState = window.MainController?.getAppState();
                    continueDrawing(event.payload.x, event.payload.y, appState?.spacePressed);
                }
                break;
                
            case 'stroke-end-requested':
                stopDrawing();
                break;
                
            case 'layer-created':
                // LayerToolUIからの通知を受信してEnginePositionで実際にレイヤーContainer作成（改修案対応）
                if (event.payload?.layerId !== undefined) {
                    registerLayerContainer(event.payload.layerId);
                    if (activeLayerId === null) {
                        setActiveLayer(event.payload.layerId);
                    }
                }
                break;
                
            case 'path-ready-for-layer':
                if (event.payload) {
                    // 循環参照なしのstrokeデータを受信
                    addStrokeToActiveLayer(event.payload);
                }
                break;
                
            case 'canvas-resized':
                updateCanvasInfo();
                break;
        }
    }
    
    // Public API
    return {
        init,
        createLayer,
        deleteLayer,
        setActiveLayer,
        toggleLayerVisibility,
        getActiveLayer,
        selectTool,
        setBrushSize,
        setOpacity,
        updateCoordinates,
        closeAllPopups,
        eraseStroke,
        syncLayerFromEngine,
        onEvent,
        
        // Getters for controlled access
        getLayers: () => new Map(layers),
        getActiveLayerId: () => activeLayerId,
        getCurrentTool: () => currentTool,
        getBrushSettings: () => ({ size: brushSize, color: brushColor, opacity })
    };
})();