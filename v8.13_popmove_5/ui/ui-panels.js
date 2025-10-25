// ===== ui/ui-panels.js - 完全改修版 =====
// 改修1: quick-access-popup画面外クリック防止
// 改修5: Sortable初期化関数追加

window.TegakiUI = window.TegakiUI || {};

window.TegakiUI.UIController = class {
    constructor(drawingEngine, layerManager, app) {
        this.drawingEngine = drawingEngine;
        this.layerManager = layerManager;
        this.app = app;
        
        this.validateCoreRuntime();
        this.setupEventDelegation();
        this.setupEventBusListeners();
        this.setupSliders();
        this.setupCanvasResize();
        this.setupFlipButtons();
        this.initializeStatusPanel();
        window.TegakiUI.setupPanelStyles();
    }
    
    validateCoreRuntime() {
        if (!window.CoreRuntime?.api) {
            throw new Error('CoreRuntime dependency missing');
        }
    }
    
    getPopupManager() {
        return window.PopupManager;
    }
    
    showPopup(name) {
        const manager = this.getPopupManager();
        if (manager) {
            manager.show(name);
        }
    }
    
    hidePopup(name) {
        const manager = this.getPopupManager();
        if (manager) {
            manager.hide(name);
        }
    }
    
    togglePopup(name) {
        const manager = this.getPopupManager();
        if (manager) {
            manager.toggle(name);
        }
    }
    
    closeAllPopups(exceptName = null) {
        const manager = this.getPopupManager();
        if (manager) {
            manager.hideAll(exceptName);
        }
    }
    
    initializeStatusPanel() {
        const statusPanel = document.querySelector('.status-panel');
        if (statusPanel) {
            statusPanel.style.display = 'none';
        }
    }
    
    setupEventBusListeners() {
        const eventBus = window.TegakiEventBus;
        if (!eventBus) return;
        
        eventBus.on('ui:toggle-settings', () => {
            this.togglePopup('settings');
        });
        
        eventBus.on('ui:show-settings', () => {
            this.showPopup('settings');
        });
        
        eventBus.on('ui:toggle-quick-access', () => {
            this.togglePopup('quickAccess');
        });
        
        eventBus.on('ui:toggle-album', () => {
            this.togglePopup('album');
        });
        
        eventBus.on('ui:toggle-export', () => {
            this.togglePopup('export');
        });
    }
    
    setupEventDelegation() {
        document.addEventListener('click', (e) => {
            const toolButton = e.target.closest('.tool-button');
            if (toolButton) {
                this.handleToolClick(toolButton);
                return;
            }

            const layerAddBtn = e.target.closest('#add-layer-btn');
            if (layerAddBtn) {
                const layerCount = this.layerManager?.layers?.length || 1;
                const result = window.CoreRuntime.api.layer.create(`レイヤー${layerCount}`);
                if (result) {
                    window.CoreRuntime.api.layer.setActive(result.index);
                }
                return;
            }
            
            const folderAddBtn = e.target.closest('#add-folder-btn');
            if (folderAddBtn) {
                alert('フォルダ機能は準備中です');
                return;
            }

            // ✅改修1: quick-access-popup以外を閉じる（quick-accessは残す）
            if (!e.target.closest('.popup-panel') && 
                !e.target.closest('.album-overlay') &&
                !e.target.closest('.layer-transform-panel') &&
                !e.target.closest('.tool-button') &&
                !e.target.closest('.layer-panel-container')) {
                this.closeAllPopups('quickAccess');
            }
        });
    }
    
    handleToolClick(button) {
        const toolId = button.id;
        const toolMap = {
            'pen-tool': () => {
                if (!window.CoreRuntime.api.tool.set('pen')) return;
                window.CoreRuntime.api.layer.exitMoveMode();
                this.togglePopup('quickAccess');
                this.updateToolUI('pen');
            },
            'eraser-tool': () => {
                if (!window.CoreRuntime.api.tool.set('eraser')) return;
                window.CoreRuntime.api.layer.exitMoveMode();
                this.closeAllPopups();
                this.updateToolUI('eraser');
            },
            'resize-tool': () => {
                this.togglePopup('resize');
            },
            'gif-animation-tool': () => {
                if (window.TegakiEventBus) {
                    window.TegakiEventBus.emit('ui:toggle-timeline');
                }
                this.closeAllPopups();
                this.updateToolUI('gif-animation');
            },
            'library-tool': () => {
                this.togglePopup('album');
            },
            'export-tool': () => {
                this.togglePopup('export');
            },
            'settings-tool': () => {
                this.togglePopup('settings');
            }
        };
        
        const handler = toolMap[toolId];
        if (handler) handler();
    }

    updateToolUI(tool) {
        document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
        const toolBtn = document.getElementById(tool + '-tool');
        if (toolBtn) toolBtn.classList.add('active');

        const toolNames = { 
            pen: 'ベクターペン', 
            eraser: '消しゴム', 
            'gif-animation': 'GIFアニメーション'
        };
        const toolElement = document.getElementById('current-tool');
        if (toolElement) {
            toolElement.textContent = toolNames[tool] || tool;
        }
    }

    togglePopupById(popupId) {
        const popup = document.getElementById(popupId);
        if (!popup) return;
        
        const isVisible = popup.classList.contains('show');
        popup.classList.toggle('show', !isVisible);
    }
    
    setupSliders() {
        // quick-access-popup.js が qa-size-slider, qa-opacity-slider を管理
    }

    setupCanvasResize() {
        const applyBtn = document.getElementById('apply-resize');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                const widthInput = document.getElementById('canvas-width');
                const heightInput = document.getElementById('canvas-height');
                
                if (widthInput && heightInput) {
                    const newWidth = parseInt(widthInput.value);
                    const newHeight = parseInt(heightInput.value);
                    
                    if (newWidth > 0 && newHeight > 0) {
                        window.CoreRuntime.api.camera.resize(newWidth, newHeight);
                        this.closeAllPopups();
                    }
                }
            });
        }
    }

    setupFlipButtons() {
        const flipHorizontalBtn = document.getElementById('flip-horizontal-btn');
        const flipVerticalBtn = document.getElementById('flip-vertical-btn');
        
        if (flipHorizontalBtn) {
            flipHorizontalBtn.addEventListener('click', () => {
                if (this.layerManager?.flipActiveLayer) {
                    this.layerManager.flipActiveLayer('horizontal');
                }
            });
        }
        
        if (flipVerticalBtn) {
            flipVerticalBtn.addEventListener('click', () => {
                if (this.layerManager?.flipActiveLayer) {
                    this.layerManager.flipActiveLayer('vertical');
                }
            });
        }
    }
};

// ✅改修5: Sortable初期化関数
window.TegakiUI.initializeSortable = function(layerSystem) {
    const layerList = document.getElementById('layer-list');
    if (!layerList || !window.Sortable) {
        return;
    }
    
    // 既存のSortableインスタンスを削除
    if (layerList._sortable) {
        layerList._sortable.destroy();
    }
    
    layerList._sortable = new Sortable(layerList, {
        animation: 150,
        handle: '.layer-item',
        ghostClass: 'layer-ghost',
        chosenClass: 'layer-chosen',
        dragClass: 'layer-drag',
        onEnd: function(evt) {
            const fromIndex = evt.oldIndex;
            const toIndex = evt.newIndex;
            
            if (fromIndex !== toIndex) {
                // UIとデータの逆順に注意
                const layers = layerSystem.getLayers();
                const actualFromIndex = layers.length - 1 - fromIndex;
                const actualToIndex = layers.length - 1 - toIndex;
                
                layerSystem.reorderLayers(actualFromIndex, actualToIndex);
            }
        }
    });
};

window.TegakiUI.createSlider = function(sliderId, min, max, initial, callback) {
    const container = document.getElementById(sliderId);
    if (!container) return;

    if (sliderId.startsWith('qa-')) {
        return;
    }

    const track = container.querySelector('.slider-track');
    const handle = container.querySelector('.slider-handle');
    const valueDisplay = container.parentNode?.querySelector('.slider-value');

    if (!track || !handle || !valueDisplay) return;

    let value = initial;
    let dragging = false;

    const update = (newValue) => {
        value = Math.max(min, Math.min(max, newValue));
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
};

window.TegakiUI.setupPanelStyles = function() {
    const style = document.createElement('style');
    style.textContent = `
        .flip-section {
            gap: 2px !important;
            height: 56px;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
        }
        
        .flip-button {
            padding: 4px 8px !important;
            font-size: 10px !important;
            white-space: nowrap !important;
            height: 26px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
        }
        
        .slider {
            position: relative;
            width: 100%;
            height: 4px;
            background: #e0e0e0;
            border-radius: 2px;
            cursor: pointer;
        }
        
        .slider-track {
            position: absolute;
            height: 100%;
            background: linear-gradient(to right, #4a90e2, #357abd);
            border-radius: 2px;
            transition: width 0.05s;
        }
        
        .slider-handle {
            position: absolute;
            width: 16px;
            height: 16px;
            top: 50%;
            transform: translate(-50%, -50%);
            background: white;
            border: 2px solid #4a90e2;
            border-radius: 50%;
            cursor: grab;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            transition: left 0.05s;
        }
        
        .slider-handle:active {
            cursor: grabbing;
        }
        
        .layer-ghost {
            opacity: 0.4;
        }
        
        .layer-chosen {
            background-color: rgba(74, 144, 226, 0.2);
        }
        
        .layer-drag {
            opacity: 0.8;
        }
    `;
    
    if (!document.querySelector('style[data-tegaki-panels]')) {
        style.setAttribute('data-tegaki-panels', 'true');
        document.head.appendChild(style);
    }
};

console.log('✅ ui-panels.js (完全改修版) loaded');