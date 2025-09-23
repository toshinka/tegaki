// ===== ui/ui-core.js - Twin-Star Architecture =====
// 責任: UI全機能（パネル・ツール・メニュー・ショートカット・イベント）

(function() {
    'use strict';
    
    const CONFIG = window.TegakiConfig;
    
    class UICore {
        constructor(runtime) {
            this.runtime = runtime;
            
            // UI状態管理
            this.uiState = window.UIState;
            this.keyboardManager = new window.KeyboardManager(this.uiState);
            this.pointerManager = new window.PointerManager(this.uiState);
            
            // DOM要素
            this.container = document.querySelector('.main-layout');
            this.canvas = document.getElementById('main-canvas');
            
            // パネル参照
            this.panels = {
                layers: document.getElementById('layer-panel-container'),
                penSettings: document.getElementById('pen-settings'),
                resizeSettings: document.getElementById('resize-settings')
            };
            
            // 初期化
            this.initializeUI();
            this.setupEventListeners();
            this.setupPanels();
            this.createSliders();
        }
        
        initializeUI() {
            // ポインターイベントセットアップ
            if (this.canvas) {
                this.pointerManager.setupEventListeners(this.canvas);
            }
            
            // UI状態イベントリスナー
            this.setupUIStateListeners();
            
            console.log('✅ UICore initialized');
        }
        
        setupUIStateListeners() {
            // ツール変更
            window.addEventListener('ui:toolChange', (e) => {
                this.handleToolChange(e.detail.tool);
            });
            
            // モード変更
            window.addEventListener('ui:modeChange', (e) => {
                this.handleModeChange(e.detail.oldMode, e.detail.newMode);
            });
            
            // レイヤー移動モード変更
            window.addEventListener('ui:layerMoveModeChange', (e) => {
                this.handleLayerMoveModeChange(e.detail.active);
            });
            
            // ポップアップ変更
            window.addEventListener('ui:activePopupChange', (e) => {
                this.handleActivePopupChange(e.detail.popupId);
            });
        }
        
        setupEventListeners() {
            // ツールボタン
            document.addEventListener('click', (e) => {
                const toolButton = e.target.closest('.tool-button');
                if (toolButton) {
                    this.handleToolButtonClick(toolButton);
                    return;
                }
                
                // レイヤー追加ボタン
                const layerAddBtn = e.target.closest('#add-layer-btn');
                if (layerAddBtn) {
                    this.handleLayerAddClick();
                    return;
                }
                
                // 設定適用ボタン
                const applyResize = e.target.closest('#apply-resize');
                if (applyResize) {
                    this.handleCanvasResize();
                    return;
                }
                
                // ポップアップ外クリック
                if (!e.target.closest('.popup-panel') && 
                    !e.target.closest('.tool-button') &&
                    !e.target.closest('.layer-panel-container')) {
                    this.closeAllPopups();
                }
            });
            
            // アプリケーションイベント
            window.addEventListener('app:undo', () => this.runtime.api.undo());
            window.addEventListener('app:redo', () => this.runtime.api.redo());
            window.addEventListener('app:copy', () => this.runtime.api.copy());
            window.addEventListener('app:paste', () => this.runtime.api.paste());
            window.addEventListener('app:canvasReset', () => this.runtime.api.resetCamera());
            
            // ポインターイベント
            window.addEventListener('pointer:down', (e) => this.handlePointerDown(e.detail));
            window.addEventListener('pointer:move', (e) => this.handlePointerMove(e.detail));
            window.addEventListener('pointer:up', (e) => this.handlePointerUp(e.detail));
        }
        
        handleToolButtonClick(button) {
            const toolId = button.id;
            
            switch(toolId) {
                case 'pen-tool':
                    this.runtime.api.setTool('pen');
                    this.uiState.setTool('pen');
                    this.togglePopup('pen-settings');
                    break;
                    
                case 'eraser-tool':
                    this.runtime.api.setTool('eraser');
                    this.uiState.setTool('eraser');
                    this.closeAllPopups();
                    break;
                    
                case 'resize-tool':
                    this.togglePopup('resize-settings');
                    break;
            }
        }
        
        handleLayerAddClick() {
            const result = this.runtime.api.createLayer('新規レイヤー');
            if (result) {
                this.runtime.api.setActiveLayer(result.index);
                this.updateLayerPanel();
            }
        }
        
        handleCanvasResize() {
            const widthInput = document.getElementById('canvas-width');
            const heightInput = document.getElementById('canvas-height');
            
            if (widthInput && heightInput) {
                const newWidth = parseInt(widthInput.value);
                const newHeight = parseInt(heightInput.value);
                
                if (newWidth > 0 && newHeight > 0) {
                    this.runtime.api.resizeCanvas(newWidth, newHeight);
                    this.uiState.updateCanvas(newWidth, newHeight);
                    this.closeAllPopups();
                }
            }
        }
        
        handleToolChange(tool) {
            // ツールボタンの状態更新
            document.querySelectorAll('.tool-button').forEach(btn => {
                btn.classList.remove('active');
            });
            
            const toolBtn = document.getElementById(tool + '-tool');
            if (toolBtn) {
                toolBtn.classList.add('active');
            }
            
            // ステータス表示更新
            const toolNames = {
                pen: 'ベクターペン',
                eraser: '消しゴム'
            };
            
            const statusElement = document.getElementById('current-tool');
            if (statusElement) {
                statusElement.textContent = toolNames[tool] || tool;
            }
        }
        
        handleModeChange(oldMode, newMode) {
            console.log(`Mode changed: ${oldMode} -> ${newMode}`);
            
            // モード固有のUI更新
            switch(newMode) {
                case 'draw':
                    this.canvas.style.cursor = 'crosshair';
                    break;
                case 'transform':
                    this.canvas.style.cursor = 'move';
                    break;
                case 'select':
                    this.canvas.style.cursor = 'crosshair';
                    break;
            }
        }
        
        handleLayerMoveModeChange(active) {
            if (active) {
                this.canvas.style.cursor = 'grab';
                this.showTransformPanel();
            } else {
                this.canvas.style.cursor = 'crosshair';
                this.hideTransformPanel();
            }
        }
        
        handleActivePopupChange(popupId) {
            // 全ポップアップを非表示
            document.querySelectorAll('.popup-panel').forEach(panel => {
                panel.classList.remove('show');
            });
            
            // アクティブなポップアップを表示
            if (popupId) {
                const popup = document.getElementById(popupId);
                if (popup) {
                    popup.classList.add('show');
                }
            }
        }
        
        handlePointerDown(pointerData) {
            if (pointerData.button !== 0) return; // 左クリックのみ
            
            // 描画開始
            if (this.uiState.isInMode('draw')) {
                this.runtime.api.startDrawing(pointerData.x, pointerData.y);
            }
        }
        
        handlePointerMove(pointerData) {
            // 座標表示更新
            this.updateCoordinatesDisplay(pointerData.x, pointerData.y);
            
            // 描画継続
            if (this.uiState.isInMode('draw') && this.uiState.isMouseDown()) {
                this.runtime.api.continueDrawing(pointerData.x, pointerData.y, pointerData.pressure);
            }
        }
        
        handlePointerUp(pointerData) {
            // 描画終了
            if (this.uiState.isInMode('draw')) {
                this.runtime.api.endDrawing();
            }
        }
        
        setupPanels() {
            // レイヤーパネル初期化
            this.updateLayerPanel();
            
            // Sortable.js統合（もし利用可能なら）
            if (window.Sortable && this.panels.layers) {
                const layerList = document.getElementById('layer-list');
                if (layerList) {
                    window.Sortable.create(layerList, {
                        animation: 150,
                        ghostClass: 'sortable-ghost',
                        chosenClass: 'sortable-chosen',
                        onEnd: (evt) => {
                            this.handleLayerReorder(evt.oldIndex, evt.newIndex);
                        }
                    });
                }
            }
        }
        
        createSliders() {
            // ペンサイズスライダー
            this.createSlider('pen-size-slider', 0.1, 100, CONFIG.brush.defaultSize, (value) => {
                this.runtime.api.setBrushSize(value);
                return value.toFixed(1) + 'px';
            });
            
            // ペン不透明度スライダー
            this.createSlider('pen-opacity-slider', 0, 100, CONFIG.brush.defaultOpacity * 100, (value) => {
                this.runtime.api.setBrushOpacity(value / 100);
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

            let value = initial;
            let dragging = false;

            const update = (newValue) => {
                value = window.TegakiUtils.clamp(newValue, min, max);
                const percentage = ((value - min) / (max - min)) * 100;
                
                track.style.width = percentage + '%';
                handle.style.left = percentage + '%';
                valueDisplay.textContent = callback(value);
            };

            const getValue = (clientX) => {
                const rect = container.getBoundingClientRect();
                const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                return min + (percentage * (max - min));
            };

            container.addEventListener('mousedown', (e) => {
                dragging = true;
                update(getValue(e.clientX));
                e.preventDefault();
            });

            document.addEventListener('mousemove', (e) => {
                if (dragging) update(getValue(e.clientX));
            });

            document.addEventListener('mouseup', () => {
                dragging = false;
            });

            update(initial);
        }
        
        togglePopup(popupId) {
            const isCurrentlyActive = this.uiState.activePopup === popupId;
            
            if (isCurrentlyActive) {
                this.uiState.setActivePopup(null);
            } else {
                this.uiState.setActivePopup(popupId);
            }
        }
        
        closeAllPopups() {
            this.uiState.setActivePopup(null);
        }
        
        showTransformPanel() {
            const panel = document.getElementById('layer-transform-panel');
            if (panel) {
                panel.classList.add('show');
            }
        }
        
        hideTransformPanel() {
            const panel = document.getElementById('layer-transform-panel');
            if (panel) {
                panel.classList.remove('show');
            }
        }
        
        updateLayerPanel() {
            const layerList = document.getElementById('layer-list');
            if (!layerList) return;
            
            const layers = this.runtime.api.getAllLayers();
            if (!layers) return;
            
            layerList.innerHTML = '';
            
            layers.reverse().forEach((layer, index) => {
                const layerItem = this.createLayerItem(layer, index);
                layerList.appendChild(layerItem);
            });
        }
        
        createLayerItem(layer, index) {
            const item = document.createElement('div');
            item.className = `layer-item ${layer.isActive ? 'active' : ''}`;
            item.dataset.layerId = layer.id;
            item.dataset.layerIndex = index;
            
            item.innerHTML = `
                <div class="layer-visibility ${layer.visible ? '' : 'hidden'}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        ${layer.visible ? 
                            '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>' :
                            '<path d="m15 18-.722-3.25"/><path d="m2 2 20 20"/><path d="M6.71 6.71C3.4 8.27 2 12 2 12s3 7 10 7c1.59 0 2.84-.3 3.79-.73"/><path d="m8.5 10.5 7 7"/><path d="M9.677 4.677C10.495 4.06 11.608 4 12 4c7 0 10 7 10 7a13.16 13.16 0 0 1-.64.77"/>'}
                    </svg>
                </div>
                <div class="layer-name">${layer.name}</div>
                <div class="layer-thumbnail">
                    <div class="layer-thumbnail-placeholder"></div>
                </div>
            `;
            
            // イベントリスナー追加
            item.addEventListener('click', (e) => {
                const target = e.target.closest('[class*="layer-"]');
                if (target && target.className.includes('layer-visibility')) {
                    this.runtime.api.toggleLayerVisibility(index);
                    this.updateLayerPanel();
                } else {
                    this.runtime.api.setActiveLayer(index);
                    this.updateLayerPanel();
                }
            });
            
            return item;
        }
        
        handleLayerReorder(fromIndex, toIndex) {
            if (this.runtime.api.reorderLayers) {
                this.runtime.api.reorderLayers(fromIndex, toIndex);
                this.updateLayerPanel();
            }
        }
        
        updateCoordinatesDisplay(x, y) {
            const element = document.getElementById('coordinates');
            if (element) {
                element.textContent = `x: ${Math.round(x)}, y: ${Math.round(y)}`;
            }
        }
        
        updateCanvasInfo(width, height) {
            const element = document.getElementById('canvas-info');
            if (element) {
                element.textContent = `${width}×${height}px`;
            }
        }
        
        updateFPS(fps) {
            const element = document.getElementById('fps');
            if (element) {
                element.textContent = fps;
            }
        }
        
        updateHistoryInfo(current, max) {
            const element = document.getElementById('history-info');
            if (element) {
                element.textContent = `${current}/${max}`;
            }
        }
        
        // コールバック（CoreRuntimeから呼ばれる）
        onLayerSelected(layerId) {
            this.updateLayerPanel();
        }
        
        onCanvasResized(width, height) {
            this.updateCanvasInfo(width, height);
        }
        
        onToolChanged(tool) {
            this.handleToolChange(tool);
        }
        
        // FPS監視開始
        startFPSMonitor() {
            let frameCount = 0;
            let lastTime = performance.now();
            
            const updateFPS = () => {
                frameCount++;
                const currentTime = performance.now();
                
                if (currentTime - lastTime >= 1000) {
                    const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
                    this.updateFPS(fps);
                    
                    frameCount = 0;
                    lastTime = currentTime;
                }
                
                requestAnimationFrame(updateFPS);
            };
            
            updateFPS();
        }
        
        // クリーンアップ
        cleanup() {
            // イベントリスナー削除
            // (必要に応じて実装)
            
            console.log('UICore cleaned up');
        }
    }
    
    // === グローバル公開 ===
    window.UICore = UICore;
    
    console.log('✅ UICore loaded (Twin-Star Architecture)');
    
})();