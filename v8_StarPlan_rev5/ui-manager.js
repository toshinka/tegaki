/**
 * ファイル名: ui-manager.js
 * @provides UIManager, UI管理機能, イベントハンドリング
 * @requires ToolManager, DrawingEngine, LayerManager, MainController API
 * UIManager衛星 - DOM生成、ツール通知、ポップアップ操作
 * 星型分離版 v8rev8 - 修正版（type付きイベント対応）
 */

window.UIManager = class UIManager {
    constructor(toolManager, drawingEngine, layerManager) {
        this.tools = toolManager;
        this.engine = drawingEngine;
        this.layers = layerManager;
        this.mainApi = null;
        this.activePopup = null;
        this.sliders = new Map();
        this.dragState = { active: false, offset: { x: 0, y: 0 } };
        this.initialized = false;
    }
};
    
    async register(mainApi) {
        this.mainApi = mainApi;
    }
    
    async initialize() {
        try {
            this.setupToolButtons();
            this.setupPopups();
            this.setupSliders();
            this.setupResize();
            this.setupLayerControls();
            this.updateCanvasInfo();
            
            this.log('UIManager initialized successfully');
            this.initialized = true;
            
        } catch (error) {
            this.reportError('UI_INIT_ERROR', 'Failed to initialize UI manager', error);
            throw error;
        }
    }
    
    setupToolButtons() {
        document.querySelectorAll('.tool-button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (btn.classList.contains('disabled')) return;
                this.handleToolClick(e.currentTarget);
            });
        });
        
        this.log('Tool buttons setup completed');
    }
    
    handleToolClick(button) {
        try {
            const toolId = button.id;
            
            if (toolId === 'pen-tool') {
                this.tools?.setActiveTool('pen');
                this.togglePopup('pen-settings');
                this.activateToolButton('pen');
            } else if (toolId === 'eraser-tool') {
                this.tools?.setActiveTool('eraser');
                this.closeAllPopups();
                this.activateToolButton('eraser');
            } else if (toolId === 'resize-tool') {
                this.togglePopup('resize-settings');
            }
            
        } catch (error) {
            this.reportError('TOOL_CLICK_ERROR', 'Tool click handling failed', error);
        }
    }
    
    activateToolButton(tool) {
        document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
        const toolBtn = document.getElementById(tool + '-tool');
        if (toolBtn) toolBtn.classList.add('active');
    }
    
    setupLayerControls() {
        const addLayerBtn = document.getElementById('add-layer-btn');
        
        if (addLayerBtn) {
            addLayerBtn.addEventListener('click', () => {
                try {
                    this.mainApi?.dispatch({
                        type: 'create-layer',
                        name: null // 自動生成
                    });
                } catch (error) {
                    this.reportError('ADD_LAYER_ERROR', 'Failed to add layer', error);
                }
            });
        }
        
        this.log('Layer controls setup completed');
    }
    
    togglePopup(popupId) {
        try {
            const popup = document.getElementById(popupId);
            if (!popup) {
                this.log(`Popup ${popupId} not found`);
                return;
            }
            
            if (this.activePopup && this.activePopup !== popup) {
                this.activePopup.classList.remove('show');
            }
            
            const isVisible = popup.classList.contains('show');
            popup.classList.toggle('show', !isVisible);
            this.activePopup = isVisible ? null : popup;
            
            this.log(`Popup ${popupId} ${isVisible ? 'hidden' : 'shown'}`);
            
        } catch (error) {
            this.reportError('POPUP_ERROR', 'Popup toggle failed', error);
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
        
        this.log('Popups setup completed');
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
            this.tools?.setBrushSize(value);
            return value.toFixed(1) + 'px';
        });
        
        this.createSlider('pen-opacity-slider', 0, 100, 85.0, (value) => {
            this.tools?.setOpacity(value / 100);
            return value.toFixed(1) + '%';
        });
        
        this.log('Sliders setup completed');
    }
    
    createSlider(sliderId, min, max, initial, callback) {
        try {
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
            this.log(`Slider ${sliderId} created`);
            
        } catch (error) {
            this.reportError('SLIDER_ERROR', `Failed to create slider ${sliderId}`, error);
        }
    }
    
    setupResize() {
        const applyButton = document.getElementById('apply-resize');
        if (applyButton) {
            applyButton.addEventListener('click', () => this.applyResize());
        }
        
        this.log('Resize controls setup completed');
    }
    
    applyResize() {
        try {
            const widthInput = document.getElementById('canvas-width');
            const heightInput = document.getElementById('canvas-height');
            
            if (widthInput && heightInput) {
                const width = parseInt(widthInput.value);
                const height = parseInt(heightInput.value);
                
                if (width >= 100 && width <= 4096 && height >= 100 && height <= 4096) {
                    this.mainApi?.dispatch({
                        type: 'resize-canvas',
                        width: width,
                        height: height
                    });
                    
                    this.closeAllPopups();
                } else {
                    this.showNotification('リサイズエラー', 'サイズは100-4096pxの範囲で指定してください', 'error');
                }
            }
            
        } catch (error) {
            this.reportError('RESIZE_ERROR', 'Canvas resize failed', error);
        }
    }
    
    updateCanvasInfo() {
        const config = this.mainApi?.getConfig() || {};
        const element = document.getElementById('canvas-info');
        if (element) {
            const width = config.canvas?.width || 400;
            const height = config.canvas?.height || 400;
            element.textContent = `${width}×${height}px`;
        }
    }
    
    closeAllPopups() {
        document.querySelectorAll('.popup-panel').forEach(popup => {
            popup.classList.remove('show');
        });
        this.activePopup = null;
        this.log('All popups closed');
    }
    
    // イベントハンドラー
    handleToolChange(event) {
        try {
            this.activateToolButton(event.newTool);
            
            const toolElement = document.getElementById('current-tool');
            if (toolElement) {
                toolElement.textContent = event.toolName || event.newTool;
            }
            
            this.log(`UI updated for tool change: ${event.newTool}`);
            
        } catch (error) {
            this.reportError('TOOL_CHANGE_UI_ERROR', 'Tool change UI update failed', error);
        }
    }
    
    handleLayerChange(event) {
        try {
            if (event.activeLayer) {
                const element = document.getElementById('current-layer');
                if (element) {
                    element.textContent = event.activeLayer.name || 'Unknown';
                }
            }
            
            this.log('UI updated for layer change');
            
        } catch (error) {
            this.reportError('LAYER_CHANGE_UI_ERROR', 'Layer change UI update failed', error);
        }
    }
    
    handleCanvasChange(event) {
        try {
            if (event.width && event.height) {
                const element = document.getElementById('canvas-info');
                if (element) {
                    element.textContent = `${event.width}×${event.height}px`;
                }
                
                // リサイズ入力欄も更新
                const widthInput = document.getElementById('canvas-width');
                const heightInput = document.getElementById('canvas-height');
                if (widthInput) widthInput.value = event.width;
                if (heightInput) heightInput.value = event.height;
            }
            
            this.log('UI updated for canvas change');
            
        } catch (error) {
            this.reportError('CANVAS_CHANGE_UI_ERROR', 'Canvas change UI update failed', error);
        }
    }
    
    handleCoordinatesChange(event) {
        try {
            const element = document.getElementById('coordinates');
            if (element && typeof event.x === 'number' && typeof event.y === 'number') {
                element.textContent = `x: ${Math.round(event.x)}, y: ${Math.round(event.y)}`;
            }
            
        } catch (error) {
            // 座標更新エラーは頻発するためログのみ
            this.log('Coordinates update failed:', error.message);
        }
    }
    
    // 通知システム
    showNotification(title, message, type = 'info', duration = 3000) {
        try {
            // 既存の通知を削除
            const existing = document.querySelector('.notification');
            if (existing) {
                existing.remove();
            }
            
            const notification = document.createElement('div');
            notification.className = `notification notification-${type}`;
            notification.innerHTML = `
                <div class="notification-title">${title}</div>
                <div class="notification-message">${message}</div>
            `;
            
            // スタイル設定
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: var(--futaba-cream);
                border: 2px solid var(--futaba-maroon);
                border-radius: 8px;
                padding: 12px 16px;
                box-shadow: 0 4px 12px rgba(128, 0, 0, 0.2);
                z-index: 3000;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                font-size: 14px;
                max-width: 300px;
                animation: slideIn 0.3s ease-out;
            `;
            
            // タイプ別の色設定
            if (type === 'error') {
                notification.style.borderColor = '#dc3545';
                notification.style.color = '#dc3545';
            } else if (type === 'success') {
                notification.style.borderColor = '#28a745';
                notification.style.color = '#28a745';
            } else if (type === 'warning') {
                notification.style.borderColor = '#ffc107';
                notification.style.color = '#856404';
            }
            
            document.body.appendChild(notification);
            
            // 自動削除
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.style.animation = 'slideOut 0.3s ease-in';
                    setTimeout(() => notification.remove(), 300);
                }
            }, duration);
            
            this.log(`Notification shown: ${title} - ${message}`);
            
        } catch (error) {
            this.reportError('NOTIFICATION_ERROR', 'Failed to show notification', error);
        }
    }
    
    // ユーティリティメソッド
    log(message, ...args) {
        const config = this.mainApi?.getConfig();
        if (config?.debug) {
            console.log(`[UIManager] ${message}`, ...args);
        }
    }
    
    reportError(code, message, error) {
        this.mainApi?.notify({
            type: 'error',
            code,
            message,
            error: error?.message || error,
            stack: error?.stack,
            timestamp: Date.now(),
            source: 'UIManager'
        });
    }
    
    // Public API
    getApi() {
        return {
            showNotification: (title, message, type, duration) => this.showNotification(title, message, type, duration),
            closeAllPopups: () => this.closeAllPopups(),
            handleToolChange: (event) => this.handleToolChange(event),
            handleLayerChange: (event) => this.handleLayerChange(event),
            handleCanvasChange: (event) => this.handleCanvasChange(event),
            handleCoordinatesChange: (event) => this.handleCoordinatesChange(event)
        };
    }