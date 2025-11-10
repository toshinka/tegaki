/**
 * @file ui/ui-panels.js - v8.13.15 サイドバー軽量デザイン版
 * @description UIコントロールパネル統合管理
 * 
 * 【v8.13.15 改修内容】
 * 🎨 サイドバーアクティブ時の背景色反転を削除
 * ✨ オレンジ枠(#ff8c42)のみで選択を表示する軽い雰囲気に変更
 * 🎯 SVG色は常にvar(--futaba-maroon)を維持
 * 
 * 【v8.13.14 改修内容】
 * 🔗 サイドバーとクイックアクセスのツール選択完全連動
 * 🎨 アクティブボーダー統一 (#ff8c42)
 * 📡 tool:select イベント双方向同期
 * 
 * 【v8.13.13 改修内容】
 * 🎨 塗りつぶしツール追加
 * 🔧 fill-tool ボタン対応
 * ⌨️ Gキーショートカット対応
 * 
 * 【親ファイル (このファイルが依存)】
 * - core-runtime.js (API統一インターフェース)
 * - popup-manager.js (ポップアップ制御)
 * - event-bus.js (イベント通信)
 * - system/drawing/fill-tool.js (FillTool)
 * 
 * 【子ファイル (このファイルに依存)】
 * なし（UI層の最上位）
 */

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
        
        eventBus.on('tool:select', ({ tool }) => {
            this.updateToolUI(tool);
        });
        
        eventBus.on('tool:changed', ({ tool }) => {
            this.updateToolUI(tool);
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
                const result = window.CoreRuntime.api.layer.create();
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
                this.syncToolToQuickAccess('pen');
            },
            'eraser-tool': () => {
                if (!window.CoreRuntime.api.tool.set('eraser')) return;
                window.CoreRuntime.api.layer.exitMoveMode();
                this.closeAllPopups();
                this.updateToolUI('eraser');
                this.syncToolToQuickAccess('eraser');
            },
            'fill-tool': () => {
                if (!window.CoreRuntime.api.tool.set('fill')) return;
                window.CoreRuntime.api.layer.exitMoveMode();
                this.closeAllPopups();
                this.updateToolUI('fill');
                this.syncToolToQuickAccess('fill');
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

    syncToolToQuickAccess(tool) {
        if (window.TegakiEventBus) {
            window.TegakiEventBus.emit('ui:sidebar:sync-tool', { tool });
        }
    }

    updateToolUI(tool) {
        document.querySelectorAll('.tool-button').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const toolBtn = document.getElementById(tool + '-tool');
        if (toolBtn) {
            toolBtn.classList.add('active');
        }

        const toolNames = { 
            pen: 'ベクターペン', 
            eraser: '消しゴム',
            fill: '塗りつぶし',
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
                if (window.CoreRuntime?.api?.layer?.flipActiveLayer) {
                    window.CoreRuntime.api.layer.flipActiveLayer('horizontal', true);
                }
            });
        }
        
        if (flipVerticalBtn) {
            flipVerticalBtn.addEventListener('click', () => {
                if (window.CoreRuntime?.api?.layer?.flipActiveLayer) {
                    window.CoreRuntime.api.layer.flipActiveLayer('vertical', true);
                }
            });
        }
    }
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
        
        .flip-button.active {
            background-color: var(--futaba-light-maroon) !important;
            border-color: var(--futaba-maroon) !important;
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
        
        .tool-button.active {
            background-color: var(--futaba-background) !important;
            border: 3px solid #ff8c42 !important;
        }
        
        .tool-button.active svg {
            stroke: var(--futaba-maroon) !important;
        }
        
        .tool-button:hover:not(.active) {
            background-color: var(--futaba-light-medium) !important;
        }
    `;
    
    if (!document.querySelector('style[data-tegaki-panels]')) {
        style.setAttribute('data-tegaki-panels', 'true');
        document.head.appendChild(style);
    }
};

console.log('✅ ui-panels.js v8.13.15 loaded');
console.log('   🎨 サイドバー軽量デザイン: オレンジ枠のみ');
console.log('   🎯 SVG色統一: 常にvar(--futaba-maroon)');