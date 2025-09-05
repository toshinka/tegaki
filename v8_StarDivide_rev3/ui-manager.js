/**
 * UI Manager Satellite
 * ツールパネル・レイヤーパネル・ポップアップ・ステータス表示の責務を担う衛星モジュール
 */

window.FutabaUIManager = (function() {
    'use strict';
    
    class LayerPanelUI {
        constructor(mainAPI) {
            this.mainAPI = mainAPI;
            this.dragState = {
                dragging: false,
                dragItem: null,
                startY: 0,
                offset: 0
            };
            this.container = null;
            this.initialize();
        }
        
        initialize() {
            this.createLayerPanel();
            this.setupEventHandlers();
        }
        
        createLayerPanel() {
            const container = document.createElement('div');
            container.id = 'layer-panel-container';
            container.className = 'layer-panel-container';
            container.style.cssText = `
                position: fixed;
                right: 20px;
                top: 50%;
                transform: translateY(-50%);
                z-index: 1000;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 8px;
                pointer-events: none;
            `;
            
            const addButton = document.createElement('div');
            addButton.id = 'add-layer-btn';
            addButton.className = 'layer-add-button';
            addButton.title = 'レイヤー追加';
            addButton.style.cssText = `
                width: 36px;
                height: 36px;
                background: var(--futaba-cream);
                border: 2px solid var(--futaba-light-medium);
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: all 0.2s ease;
                box-shadow: 0 2px 8px rgba(128, 0, 0, 0.1);
                pointer-events: all;
            `;
            addButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="15" x2="15" y1="12" y2="18"/>
                    <line x1="12" x2="18" y1="15" y2="15"/>
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                </svg>
            `;
            
            const layerList = document.createElement('div');
            layerList.id = 'layer-list';
            layerList.className = 'layer-panel-items';
            layerList.style.cssText = `
                display: flex;
                flex-direction: column;
                gap: 4px;
                background: transparent;
                border-radius: 8px;
                padding: 8px;
                pointer-events: all;
            `;
            
            container.appendChild(addButton);
            container.appendChild(layerList);
            document.body.appendChild(container);
            
            this.container = container;
        }
        
        setupEventHandlers() {
            const addButton = document.getElementById('add-layer-btn');
            if (addButton) {
                addButton.addEventListener('click', () => {
                    this.mainAPI.notify('layers.createRequest', { name: null });
                });
            }
        }
        
        updateLayerPanel(layerData) {
            const layerList = document.getElementById('layer-list');
            if (!layerList) return;
            
            layerList.innerHTML = '';
            
            const { layers, activeLayerId } = layerData;
            
            const normalLayers = layers.filter(layer => !layer.isBackground).reverse();
            
            normalLayers.forEach((layer, index) => {
                const layerItem = this.createLayerItem(layer, activeLayerId, index);
                layerList.appendChild(layerItem);
            });
            
            const backgroundLayer = layers.find(layer => layer.isBackground);
            if (backgroundLayer) {
                const backgroundItem = this.createLayerItem(backgroundLayer, activeLayerId, -1);
                layerList.appendChild(backgroundItem);
            }
        }
        
        createLayerItem(layer, activeLayerId, index) {
            const layerItem = document.createElement('div');
            layerItem.className = `layer-item ${layer.id === activeLayerId ? 'active' : ''}`;
            layerItem.dataset.layerId = layer.id;
            layerItem.dataset.layerIndex = index;
            
            layerItem.style.cssText = `
                width: 140px;
                height: 48px;
                background: var(--futaba-cream);
                border: 2px solid var(--futaba-light-medium);
                border-radius: 8px;
                padding: 8px 12px;
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: space-between;
                user-select: none;
                position: relative;
                box-shadow: 0 2px 4px rgba(128, 0, 0, 0.1);
            `;
            
            if (layer.id === activeLayerId) {
                layerItem.style.borderColor = 'var(--futaba-maroon)';
                layerItem.style.background = 'var(--futaba-light-medium)';
                layerItem.style.boxShadow = '0 2px 8px rgba(128, 0, 0, 0.2)';
            }
            
            const eyeIcon = layer.visible ? 
                `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/>
                    <circle cx="12" cy="12" r="3"/>
                </svg>` :
                `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/>
                    <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/>
                    <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/>
                    <path d="m2 2 20 20"/>
                </svg>`;
            
            layerItem.innerHTML = `
                <div class="layer-name" style="flex: 1; font-size: 12px; color: var(--text-primary); font-weight: 500; margin-right: 8px;">
                    ${layer.name}
                </div>
                <div class="layer-visibility ${layer.visible ? '' : 'hidden'}" data-action="toggle-visibility" style="
                    width: 20px; height: 20px; display: flex; align-items: center; justify-content: center;
                    cursor: pointer; border-radius: 4px; transition: all 0.2s ease;
                ">
                    ${eyeIcon}
                </div>
            `;
            
            layerItem.addEventListener('click', (e) => {
                const action = e.target.closest('[data-action]')?.dataset.action;
                if (action === 'toggle-visibility') {
                    this.mainAPI.notify('layers.visibilityToggle', { layerId: layer.id });
                } else if (!this.dragState.dragging) {
                    this.mainAPI.notify('layers.setActive', { layerId: layer.id });
                }
            });
            
            return layerItem;
        }
    }
    
    class ToolPanelUI {
        constructor(mainAPI) {
            this.mainAPI = mainAPI;
            this.currentTool = 'pen';
            this.initialize();
        }
        
        initialize() {
            this.setupToolButtons();
        }
        
        setupToolButtons() {
            document.querySelectorAll('.tool-button').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    this.handleToolClick(e.currentTarget);
                });
            });
        }
        
        handleToolClick(button) {
            const toolId = button.id;
            
            if (toolId === 'pen-tool') {
                this.activateTool('pen');
                this.mainAPI.notify('popup.show', { popupId: 'pen-settings' });
            } else if (toolId === 'eraser-tool') {
                this.activateTool('eraser');
                this.mainAPI.notify('popup.hideAll');
            } else if (toolId === 'resize-tool') {
                this.mainAPI.notify('popup.show', { popupId: 'resize-settings' });
            }
        }
        
        activateTool(tool) {
            this.currentTool = tool;
            
            document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
            const toolBtn = document.getElementById(tool + '-tool');
            if (toolBtn) toolBtn.classList.add('active');
            
            this.mainAPI.notify('tools.select', { tool });
            
            const canvas = document.querySelector('canvas');
            if (canvas) {
                canvas.style.cursor = tool === 'eraser' ? 'cell' : 'crosshair';
            }
        }
    }
    
    class PopupUI {
        constructor(mainAPI) {
            this.mainAPI = mainAPI;
            this.activePopup = null;
            this.sliders = new Map();
            this.dragState = { active: false, offset: { x: 0, y: 0 } };
            this.initialize();
        }
        
        initialize() {
            this.createPopups();
            this.setupPopupHandlers();
            this.setupSliders();
        }
        
        createPopups() {
            this.createPenPopup();
            this.createResizePopup();
        }
        
        createPenPopup() {
            const popup = document.createElement('div');
            popup.id = 'pen-settings';
            popup.className = 'popup-panel';
            popup.style.cssText = `
                position: fixed;
                left: 60px;
                top: 100px;
                background: var(--futaba-cream);
                border: 2px solid var(--futaba-maroon);
                border-radius: 16px;
                box-shadow: 0 12px 32px rgba(128, 0, 0, 0.3);
                padding: 20px;
                z-index: 2000;
                backdrop-filter: blur(12px);
                display: none;
                user-select: none;
                min-width: 280px;
            `;
            
            popup.innerHTML = `
                <div class="popup-title" style="font-size: 16px; font-weight: 600; color: var(--futaba-maroon); margin-bottom: 16px; text-align: center; border-bottom: 2px solid var(--futaba-light-medium); padding-bottom: 8px; cursor: move;">
                    ベクターペンツール設定
                </div>
                
                <div class="setting-group" style="margin-bottom: 16px;">
                    <div class="setting-label" style="font-size: 14px; color: var(--text-primary); margin-bottom: 8px; font-weight: 500;">サイズ</div>
                    <div class="slider-container" style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                        <div class="slider" id="pen-size-slider" style="flex: 1; height: 6px; background: var(--futaba-light-medium); border-radius: 3px; position: relative; cursor: pointer;">
                            <div class="slider-track" style="height: 100%; background: var(--futaba-maroon); border-radius: 3px; transition: width 0.1s ease; width: 16%;"></div>
                            <div class="slider-handle" style="width: 16px; height: 16px; background: var(--futaba-maroon); border: 2px solid var(--futaba-background); border-radius: 50%; position: absolute; top: 50%; transform: translate(-50%, -50%); cursor: grab; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2); left: 16%;"></div>
                        </div>
                        <div class="slider-value" style="font-size: 12px; color: var(--text-secondary); font-family: monospace; min-width: 50px; text-align: right;">16.0px</div>
                    </div>
                </div>
                
                <div class="setting-group" style="margin-bottom: 16px;">
                    <div class="setting-label" style="font-size: 14px; color: var(--text-primary); margin-bottom: 8px; font-weight: 500;">不透明度</div>
                    <div class="slider-container" style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                        <div class="slider" id="pen-opacity-slider" style="flex: 1; height: 6px; background: var(--futaba-light-medium); border-radius: 3px; position: relative; cursor: pointer;">
                            <div class="slider-track" style="height: 100%; background: var(--futaba-maroon); border-radius: 3px; transition: width 0.1s ease; width: 85%;"></div>
                            <div class="slider-handle" style="width: 16px; height: 16px; background: var(--futaba-maroon); border: 2px solid var(--futaba-background); border-radius: 50%; position: absolute; top: 50%; transform: translate(-50%, -50%); cursor: grab; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2); left: 85%;"></div>
                        </div>
                        <div class="slider-value" style="font-size: 12px; color: var(--text-secondary); font-family: monospace; min-width: 50px; text-align: right;">85.0%</div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(popup);
        }
        
        createResizePopup() {
            const popup = document.createElement('div');
            popup.id = 'resize-settings';
            popup.className = 'popup-panel';
            popup.style.cssText = `
                position: fixed;
                left: 60px;
                top: 150px;
                background: var(--futaba-cream);
                border: 2px solid var(--futaba-maroon);
                border-radius: 16px;
                box-shadow: 0 12px 32px rgba(128, 0, 0, 0.3);
                padding: 20px;
                z-index: 2000;
                backdrop-filter: blur(12px);
                display: none;
                user-select: none;
                min-width: 280px;
            `;
            
            popup.innerHTML = `
                <div class="popup-title" style="font-size: 16px; font-weight: 600; color: var(--futaba-maroon); margin-bottom: 16px; text-align: center; border-bottom: 2px solid var(--futaba-light-medium); padding-bottom: 8px; cursor: move;">
                    キャンバスリサイズ
                </div>
                
                <div class="setting-group" style="margin-bottom: 16px;">
                    <div class="setting-label" style="font-size: 14px; color: var(--text-primary); margin-bottom: 8px; font-weight: 500;">キャンバスサイズ</div>
                    <div class="size-input-group" style="display: flex; gap: 10px; align-items: center; margin-bottom: 16px;">
                        <input type="number" class="size-input" id="canvas-width" min="100" max="4096" value="400" style="flex: 1; padding: 8px 12px; border: 2px solid var(--futaba-light-medium); border-radius: 6px; background: var(--futaba-background); font-family: monospace; font-size: 14px; text-align: center;">
                        <div class="size-multiply" style="color: var(--futaba-maroon); font-weight: bold; font-size: 16px;">×</div>
                        <input type="number" class="size-input" id="canvas-height" min="100" max="4096" value="400" style="flex: 1; padding: 8px 12px; border: 2px solid var(--futaba-light-medium); border-radius: 6px; background: var(--futaba-background); font-family: monospace; font-size: 14px; text-align: center;">
                    </div>
                </div>
                
                <div class="setting-group">
                    <div class="action-button" id="apply-resize" style="padding: 10px 16px; border: 2px solid var(--futaba-maroon); border-radius: 8px; background: var(--futaba-background); color: var(--futaba-maroon); font-weight: 600; cursor: pointer; transition: all 0.2s ease; text-align: center;">適用</div>
                </div>
            `;
            
            document.body.appendChild(popup);
        }
        
        setupPopupHandlers() {
            document.querySelectorAll('.popup-panel').forEach(popup => {
                const title = popup.querySelector('.popup-title');
                if (title) {
                    title.addEventListener('mousedown', (e) => this.startDrag(e, popup));
                }
            });
            
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.popup-panel') && 
                    !e.target.closest('.tool-button') &&
                    !e.target.closest('.layer-panel-container')) {
                    this.hideAllPopups();
                }
            });
            
            document.addEventListener('mousemove', (e) => this.onDrag(e));
            document.addEventListener('mouseup', () => this.stopDrag());
            
            const applyButton = document.getElementById('apply-resize');
            if (applyButton) {
                applyButton.addEventListener('click', () => this.applyResize());
            }
        }
        
        setupSliders() {
            this.createSlider('pen-size-slider', 0.1, 100, 16.0, (value) => {
                this.mainAPI.notify('tools.updateSettings', { tool: 'pen', settings: { size: value } });
                return value.toFixed(1) + 'px';
            });
            
            this.createSlider('pen-opacity-slider', 0, 100, 85.0, (value) => {
                this.mainAPI.notify('tools.updateSettings', { tool: 'pen', settings: { opacity: value / 100 } });
                return value.toFixed(1) + '%';
            });
            
            this.createSlider('eraser-size-slider', 1, 200, 16.0, (value) => {
                this.mainAPI.notify('tools.updateSettings', { tool: 'eraser', settings: { size: value } });
                return value.toFixed(1) + 'px';
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
                if (slider.dragging) {
                    slider.dragging = false;
                }
            });
            
            update(initial);
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
        
        showPopup(popupId) {
            const popup = document.getElementById(popupId);
            if (!popup) return;
            
            if (this.activePopup && this.activePopup !== popup) {
                this.activePopup.style.display = 'none';
            }
            
            popup.style.display = 'block';
            this.activePopup = popup;
        }
        
        hideAllPopups() {
            document.querySelectorAll('.popup-panel').forEach(popup => {
                popup.style.display = 'none';
            });
            this.activePopup = null;
        }
        
        applyResize() {
            const widthInput = document.getElementById('canvas-width');
            const heightInput = document.getElementById('canvas-height');
            
            if (widthInput && heightInput) {
                const width = parseInt(widthInput.value);
                const height = parseInt(heightInput.value);
                
                if (width >= 100 && width <= 4096 && height >= 100 && height <= 4096) {
                    this.mainAPI.notify('canvas.resize', { width, height });
                    this.hideAllPopups();
                }
            }
        }
    }
    
    class StatusUI {
        constructor(mainAPI) {
            this.mainAPI = mainAPI;
            this.frameCount = 0;
            this.lastTime = performance.now();
            this.initialize();
        }
        
        initialize() {
            this.createStatusPanel();
            this.startFPSMonitor();
        }
        
        createStatusPanel() {
            const statusPanel = document.createElement('div');
            statusPanel.id = 'status-panel';
            statusPanel.className = 'status-panel';
            statusPanel.style.cssText = `
                position: fixed;
                bottom: 20px;
                left: 70px;
                right: 20px;
                background: var(--futaba-cream);
                border: 2px solid var(--futaba-medium);
                border-radius: 12px;
                padding: 8px 16px;
                font-family: monospace;
                font-size: 11px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                box-shadow: 0 4px 16px rgba(128, 0, 0, 0.1);
                z-index: 50;
            `;
            
            statusPanel.innerHTML = `
                <div class="status-group" style="display: flex; align-items: center; gap: 16px;">
                    <div class="status-item" style="display: flex; align-items: center; gap: 4px;">Canvas: <span id="canvas-info">400×400px</span></div>
                    <div class="status-item" style="display: flex; align-items: center; gap: 4px;">Tool: <span id="current-tool">ベクターペン</span></div>
                    <div class="status-item" style="display: flex; align-items: center; gap: 4px;">Layer: <span id="current-layer">背景</span></div>
                    <div class="status-item" style="display: flex; align-items: center; gap: 4px;">座標: <span id="coordinates">x: 0, y: 0</span></div>
                    <div class="status-item" style="display: flex; align-items: center; gap: 4px;">Camera: <span id="camera-position">x: 0, y: 0</span></div>
                </div>
                
                <div class="status-group" style="display: flex; align-items: center;">
                    <div class="status-item" style="display: flex; align-items: center; gap: 4px;">FPS: <span id="fps">60</span></div>
                </div>
            `;
            
            document.body.appendChild(statusPanel);
        }
        
        startFPSMonitor() {
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
        
        updateCanvasInfo(width, height) {
            const element = document.getElementById('canvas-info');
            if (element) {
                element.textContent = `${width}×${height}px`;
            }
        }
        
        updateCurrentTool(tool) {
            const toolNames = { pen: 'ベクターペン', eraser: '消しゴム' };
            const element = document.getElementById('current-tool');
            if (element) {
                element.textContent = toolNames[tool] || tool;
            }
        }
        
        updateCurrentLayer(layerName) {
            const element = document.getElementById('current-layer');
            if (element) {
                element.textContent = layerName || '不明';
            }
        }
        
        updateCoordinates(x, y) {
            const element = document.getElementById('coordinates');
            if (element) {
                element.textContent = `x: ${Math.round(x)}, y: ${Math.round(y)}`;
            }
        }
        
        updateCameraPosition(x, y) {
            const element = document.getElementById('camera-position');
            if (element) {
                element.textContent = `x: ${Math.round(x)}, y: ${Math.round(y)}`;
            }
        }
    }
    
    class UIManager {
        constructor() {
            this.mainAPI = null;
            this.layerPanelUI = null;
            this.toolPanelUI = null;
            this.popupUI = null;
            this.statusUI = null;
        }
        
        async register(mainAPI) {
            this.mainAPI = mainAPI;
            
            try {
                this.layerPanelUI = new LayerPanelUI(mainAPI);
                this.toolPanelUI = new ToolPanelUI(mainAPI);
                this.popupUI = new PopupUI(mainAPI);
                this.statusUI = new StatusUI(mainAPI);
                
                this.setupEventListeners();
                
                this.mainAPI.notify('ui.ready');
                return true;
                
            } catch (error) {
                this.mainAPI.notifyError('ERR_UI_INIT_FAILED', 'UI manager initialization failed', error);
                throw error;
            }
        }
        
        setupEventListeners() {
            // Event handling setup
        }
        
        updateLayerPanel(layerData) {
            if (this.layerPanelUI) {
                this.layerPanelUI.updateLayerPanel(layerData);
            }
        }
        
        updateCanvasInfo(width, height) {
            if (this.statusUI) {
                this.statusUI.updateCanvasInfo(width, height);
            }
        }
        
        updateCurrentTool(tool) {
            if (this.statusUI) {
                this.statusUI.updateCurrentTool(tool);
            }
        }
        
        updateCurrentLayer(layerName) {
            if (this.statusUI) {
                this.statusUI.updateCurrentLayer(layerName);
            }
        }
        
        updateCoordinates(x, y) {
            if (this.statusUI) {
                this.statusUI.updateCoordinates(x, y);
            }
        }
        
        updateCameraPosition(position) {
            if (this.statusUI) {
                this.statusUI.updateCameraPosition(position.x, position.y);
            }
        }
        
        showPopup(popupId) {
            if (this.popupUI) {
                this.popupUI.showPopup(popupId);
            }
        }
        
        hideAllPopups() {
            if (this.popupUI) {
                this.popupUI.hideAllPopups();
            }
        }
        
        // Event handlers called by main
        handleToolSelectConfirm(payload) {
            this.updateCurrentTool(payload.tool);
        }
        
        handleCanvasResizeConfirm(payload) {
            this.updateCanvasInfo(payload.width, payload.height);
        }
        
        handleCoordinatesUpdate(payload) {
            this.updateCoordinates(payload.point.x, payload.point.y);
        }
        
        // Missing method that history service expects
        updateHistoryState(state) {
            // History state update - could show undo/redo buttons state in future
        }
        
        // Cleanup
        destroy() {
            this.mainAPI = null;
            this.layerPanelUI = null;
            this.toolPanelUI = null;
            this.popupUI = null;
            this.statusUI = null;
        }
    }
    
    return UIManager;
})();