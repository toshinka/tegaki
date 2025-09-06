/**
 * @module   LayerToolUI
 * @role     レイヤー管理・ツール管理・UI制御
 * @depends  MainController
 * @provides init(), createLayer(name), setActiveLayer(id), onUIButtonClick(event)
 * @notes    アクティブレイヤー制御強化、stroke独立性確保、レイヤー切替明確化
 * @flow     レイヤー作成 → MainController → EnginePosition → UI更新
 * @memory   レイヤー構造、アクティブレイヤーID、ツール状態、UI状態
 */

const LayerToolUI = (() => {
    // Layer Management - ID安定生成
    let layers = new Map();
    let activeLayerId = null;
    let nextLayerId = 1;
    
    // Tool Management
    let currentTool = 'pen';
    let brushSize = 16.0;
    let brushColor = 0x800000;
    let opacity = 0.85;
    let drawing = { active: false };
    
    // UI State
    let activePopup = null;
    let sliders = new Map();
    
    async function init() {
        try {
            setupToolButtons();
            setupPopups();
            setupSliders();
            setupResizeControls();
            setupLayerControls();
            
            // 初期レイヤー作成 - ID安定化
            createLayer('レイヤー1');
            setActiveLayer(1);
            
            updateCanvasInfo();
            updateToolDisplay();
            updateLayerUI();
            
            console.log('[LayerToolUI] Initialized');
            return true;
            
        } catch (error) {
            console.error('[LayerToolUI] Initialization failed:', error);
            window.MainController?.emit('error-occurred', {
                source: 'LayerToolUI',
                error: error.message
            });
            return false;
        }
    }
    
    // Layer Management Functions - アクティブレイヤー制御強化
    function createLayer(name = null) {
        const layerId = nextLayerId++;
        const layerName = name || `レイヤー${layerId}`;
        
        const layer = {
            id: layerId,
            name: layerName,
            visible: true,
            strokes: [], // レイヤー独立のstroke管理
            isBackground: false
        };
        
        layers.set(layerId, layer);
        updateLayerUI();
        
        // MainController経由で通知
        window.MainController?.emit('layer-created', { 
            layerId: layer.id,
            name: layer.name,
            visible: layer.visible,
            isBackground: layer.isBackground
        });
        
        return layer;
    }
    
    function deleteLayer(layerId) {
        if (layers.size <= 1) return; // 最低1つは保持
        
        const layer = layers.get(layerId);
        if (!layer) return;
        
        layers.delete(layerId);
        
        // アクティブレイヤー調整
        if (activeLayerId === layerId) {
            const remainingLayers = Array.from(layers.keys());
            activeLayerId = remainingLayers[remainingLayers.length - 1];
        }
        
        updateLayerUI();
        window.MainController?.emit('layer-deleted', { layerId });
    }
    
    function setActiveLayer(layerId) {
        if (layers.has(layerId)) {
            activeLayerId = layerId;
            updateLayerUI();
            updateStatusDisplay();
            
            // アクティブレイヤー変更を通知
            window.MainController?.emit('layer-active', { 
                layerId: layerId 
            });
        }
    }
    
    function toggleLayerVisibility(layerId) {
        const layer = layers.get(layerId);
        if (!layer) return;
        
        layer.visible = !layer.visible;
        updateLayerUI();
        
        window.MainController?.emit('layer-visibility-changed', { 
            layerId: layerId, 
            visible: layer.visible 
        });
    }
    
    function getActiveLayer() {
        return layers.get(activeLayerId);
    }
    
    // Drawing Operations - アクティブレイヤー制御
    function startDrawing(x, y) {
        const activeLayer = getActiveLayer();
        if (!activeLayer) return false;
        
        drawing.active = true;
        
        const color = currentTool === 'eraser' ? 0xf0e0d6 : brushColor;
        const alpha = currentTool === 'eraser' ? 1.0 : opacity;
        
        const strokeData = {
            x, y,
            size: brushSize,
            color,
            opacity: alpha
        };
        
        // アクティブレイヤーIDと共に描画開始を通知
        window.MainController?.emit('path-created', { 
            path: strokeData,
            layerId: activeLayer.id 
        });
        
        return true;
    }
    
    function continueDrawing(x, y) {
        if (!drawing.active) return;
        
        const activeLayer = getActiveLayer();
        if (!activeLayer) {
            stopDrawing();
            return;
        }
        
        window.MainController?.emit('path-extend', { x, y });
    }
    
    function stopDrawing() {
        if (drawing.active) {
            drawing.active = false;
            window.MainController?.emit('path-complete');
        }
    }
    
    // Tool Management
    function selectTool(tool) {
        currentTool = tool;
        updateToolDisplay();
        
        window.MainController?.emit('tool-selected', { tool });
    }
    
    function setBrushSize(size) {
        brushSize = Math.max(0.1, Math.min(100, Math.round(size * 10) / 10));
        window.MainController?.emit('brush-size-changed', { size: brushSize });
    }
    
    function setOpacity(opacityValue) {
        opacity = Math.max(0, Math.min(1, Math.round(opacityValue * 1000) / 1000));
        window.MainController?.emit('brush-opacity-changed', { opacity });
    }
    
    // UI Management Functions
    function setupToolButtons() {
        document.querySelectorAll('.tool-button').forEach(btn => {
            btn.addEventListener('click', (e) => {
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
    }
    
    function setupLayerControls() {
        const addLayerBtn = document.getElementById('add-layer-btn');
        
        if (addLayerBtn) {
            addLayerBtn.addEventListener('click', () => {
                const newLayer = createLayer();
                setActiveLayer(newLayer.id);
            });
        }
    }
    
    function updateLayerUI() {
        const layerList = document.getElementById('layer-list');
        if (!layerList) return;
        
        layerList.innerHTML = '';
        
        // レイヤーを逆順で表示（上から下）
        const layerIds = Array.from(layers.keys()).reverse();
        
        layerIds.forEach((layerId) => {
            const layer = layers.get(layerId);
            const layerItem = document.createElement('div');
            layerItem.className = `layer-item ${layerId === activeLayerId ? 'active' : ''}`;
            layerItem.dataset.layerId = layerId;
            
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
                } else {
                    setActiveLayer(layerId);
                }
            });
            
            layerList.appendChild(layerItem);
        });
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
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.popup-panel') && 
                !e.target.closest('.tool-button') &&
                !e.target.closest('.layer-panel-container')) {
                closeAllPopups();
            }
        });
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
                window.MainController?.emit('canvas-resize-requested', { 
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
                
            case 'draw-start':
                if (event.payload?.x !== undefined && event.payload?.y !== undefined) {
                    startDrawing(event.payload.x, event.payload.y);
                }
                break;
                
            case 'draw-move':
                if (event.payload?.x !== undefined && event.payload?.y !== undefined) {
                    continueDrawing(event.payload.x, event.payload.y);
                }
                break;
                
            case 'draw-end':
                stopDrawing();
                break;
                
            case 'stroke-completed':
                // stroke完了時の処理（必要に応じて）
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
        onEvent,
        
        // Getters for controlled access
        getLayers: () => new Map(layers),
        getActiveLayerId: () => activeLayerId,
        getCurrentTool: () => currentTool,
        getBrushSettings: () => ({ size: brushSize, color: brushColor, opacity })
    };
})();