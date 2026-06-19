/**
 * ============================================================================
 * ファイル名: ui/ui-panels.js
 * 責務: UIパネル（サイドバー、レイヤーパネル等）のイベント制御と状態更新を担当する
 * 依存: DOMBuilder, SliderUtils, system/event-bus.js, system/popup-manager.js
 * 被依存: core-initializer.js
 * 公開API: UIController
 * イベント発火: ui:*, tool:select, layer:panel-update-requested等
 * イベント受信: tool:*, layer:*, camera:*, keyboard:*等
 * グローバル登録: window.TegakiUI.UIController, window.uiController
 * 実装状態: ✅完成/整備
 * ============================================================================
 */

import { DOMBuilder } from './dom-builder.js';
import { SliderUtils } from './slider-utils.js';
import { TegakiEventBus } from '../system/event-bus.js';

export class UIController {
    constructor(drawingEngine, layerManager, app, popupManager) {
        this.drawingEngine = drawingEngine;
        this.layerManager = layerManager;
        this.app = app;
        this.popupManager = popupManager;
        this.eventBus = TegakiEventBus;
        
        this.setupEventDelegation();
        this.setupEventBusListeners();
        this.setupCanvasResize();
        this.setupFlipButtons();
        this.initializeStatusPanel();
        this.setupPanelStyles();
        this.ensurePopupCloseButtons();
    }
    
    showPopup(name) {
        if (this.popupManager) {
            this.popupManager.show(name);
        }
    }
    
    hidePopup(name) {
        if (this.popupManager) {
            this.popupManager.hide(name);
        }
    }
    
    togglePopup(name) {
        if (this.popupManager) {
            this.popupManager.toggle(name);
        }
    }
    
    closeAllPopups(exceptName = null) {
        if (this.popupManager) {
            this.popupManager.hideAll(exceptName);
        }
    }
    
    initializeStatusPanel() {
        const statusPanel = document.querySelector('.status-panel');
        if (statusPanel) {
            const currentTool = window.brushSettings?.getMode?.() || window.CoreRuntime?.api?.tool?.get?.() || 'pen';
            this.updateToolUI(currentTool);
            this.updateHistoryUI();
        }
    }
    
    setupEventBusListeners() {
        if (!this.eventBus) return;
        
        this.eventBus.on('ui:toggle-settings', () => {
            this.togglePopup('settings');
        });
        
        this.eventBus.on('ui:show-settings', () => {
            this.showPopup('settings');
        });
        
        this.eventBus.on('ui:toggle-quick-access', () => {
            this.togglePopup('quickAccess');
        });
        
        this.eventBus.on('ui:toggle-album', () => {
            this.togglePopup('album');
        });
        
        this.eventBus.on('ui:toggle-export', () => {
            this.togglePopup('export');
        });
        
        this.eventBus.on('tool:select', ({ tool }) => {
            this.updateToolUI(tool);
        });
        
        this.eventBus.on('tool:changed', ({ tool }) => {
            this.updateToolUI(tool);
        });

        this.eventBus.on('ui:sidebar:sync-tool', ({ tool }) => {
            this.updateToolUI(tool);
        });

        this.eventBus.on('brush:mode-changed', (payload = {}) => {
            const tool = payload.tool || payload.mode || payload.data?.tool || payload.data?.mode;
            if (tool) {
                this.updateToolUI(tool);
            }
        });

        this.eventBus.on('brush:pressure-enabled-changed', () => {
            const currentTool = window.brushSettings?.getMode?.() || window.CoreRuntime?.api?.tool?.get?.() || 'pen';
            this.updateToolUI(currentTool);
        });

        this.eventBus.on('brush:eraser-pressure-enabled-changed', () => {
            const currentTool = window.brushSettings?.getMode?.() || window.CoreRuntime?.api?.tool?.get?.() || 'pen';
            this.updateToolUI(currentTool);
        });

        this.eventBus.on('layer:status-update-requested', (data) => {
            this.updateStatusDisplay(data);
        });

        this.eventBus.on('history:changed', (data) => {
            this.updateHistoryUI(data);
        });

        this.eventBus.on('popup:initialized', () => {
            this.ensurePopupCloseButtons();
        });
    }

    ensurePopupCloseButtons() {
        document.querySelectorAll('.popup-panel').forEach((popup) => {
            if (popup.id === 'quick-access-popup' && popup.querySelector('.quick-access-close-btn')) {
                return;
            }
            if (popup.querySelector('.popup-close-btn')) {
                return;
            }

            const button = DOMBuilder.createCloseButton(popup.id);
            popup.appendChild(button);
        });
    }
    
    setupEventDelegation() {
        document.addEventListener('click', (e) => {
            const toolButton = e.target.closest('.tool-button');
            if (toolButton) {
                this.handleToolClick(toolButton);
                return;
            }

            const flipButton = e.target.closest('#flip-horizontal-btn, #flip-vertical-btn');
            if (flipButton) {
                const direction = flipButton.id === 'flip-horizontal-btn' ? 'horizontal' : 'vertical';
                this.eventBus.emit('layer:flip-requested', { direction, bypassVKeyCheck: true });
                return;
            }

            const layerAddBtn = e.target.closest('#add-layer-btn');
            if (layerAddBtn) {
                if (this.layerManager) {
                    const referenceLayer = this.layerManager.getActiveLayer?.();
                    const result = this.layerManager.createLayer();
                    if (result) {
                        if (referenceLayer && this.layerManager.placeCreatedLayerNearReference) {
                            result.index = this.layerManager.placeCreatedLayerNearReference(result.layer, referenceLayer);
                        }
                        this.layerManager.setActiveLayer(result.index);
                    }
                }
                return;
            }
            
            const folderAddBtn = e.target.closest('#add-folder-btn');
            if (folderAddBtn) {
                if (this.layerManager && this.layerManager.createFolder) {
                    const referenceLayer = this.layerManager.getActiveLayer?.();
                    const result = this.layerManager.createFolder();
                    if (result) {
                        if (referenceLayer && this.layerManager.placeCreatedLayerNearReference) {
                            result.index = this.layerManager.placeCreatedLayerNearReference(result.layer, referenceLayer);
                        }
                        this.layerManager.setActiveLayer(result.index);
                    }
                }
                return;
            }

            const layerAttributeBtn = e.target.closest('#layer-attribute-panel-btn');
            if (layerAttributeBtn) {
                this.eventBus?.emit('ui:layer-attribute-panel-requested', {
                    anchorElement: layerAttributeBtn
                });
                return;
            }

            const duplicateActiveBtn = e.target.closest('#duplicate-active-layer-btn');
            if (duplicateActiveBtn) {
                this.handleActiveLayerOperation('duplicate', duplicateActiveBtn);
                return;
            }

            const mergeActiveBtn = e.target.closest('#merge-active-layer-btn');
            if (mergeActiveBtn) {
                this.handleActiveLayerOperation('mergeDown', mergeActiveBtn);
                return;
            }

            const deleteActiveBtn = e.target.closest('#delete-active-layer-btn');
            if (deleteActiveBtn) {
                this.handleActiveLayerOperation('delete', deleteActiveBtn);
                return;
            }

            const closeBtn = e.target.closest('.popup-close-btn');
            if (closeBtn) {
                this.closeAllPopups();
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

    handleActiveLayerOperation(action, triggerEl = null) {
        if (!this.layerManager) return;

        const activeIndex = this.layerManager.getActiveLayerIndex?.() ?? this.layerManager.activeLayerIndex;
        if (activeIndex == null || activeIndex < 0) return;
        const layers = this.layerManager.getLayers?.() || [];
        const activeLayer = layers[activeIndex];
        const activeData = activeLayer?.layerData;
        const stop = () => {
            triggerEl?.blur?.();
            return;
        };

        if (!activeData || activeData.isBackground) return stop();

        if (action === 'duplicate') {
            this.layerManager.duplicateLayer?.(activeIndex);
            return stop();
        }

        if (action === 'mergeDown') {
            const bottomData = layers[activeIndex - 1]?.layerData;
            if (
                activeData.isFolder ||
                !activeData.renderTexture ||
                !bottomData ||
                bottomData.isFolder ||
                bottomData.isBackground ||
                !bottomData.renderTexture
            ) {
                return stop();
            }
            this.layerManager.mergeLayerDown?.(activeIndex);
            return stop();
        }

        if (action === 'delete') {
            this.layerManager.deleteLayer?.(activeIndex);
            return stop();
        }
    }
    
    handleToolClick(button) {
        const toolId = button.id;
        const toolMap = {
            'pen-tool': () => {
                if (window.CoreRuntime?.api?.tool?.set) {
                    window.CoreRuntime.api.tool.set('pen');
                    window.CoreRuntime.api.layer.exitMoveMode();
                } else if (this.drawingEngine?.brushCore) {
                    this.drawingEngine.brushCore.setMode('pen');
                }
                this.togglePopup('quickAccess');
                this.updateToolUI('pen');
            },
            'eraser-tool': () => {
                if (window.CoreRuntime?.api?.tool?.set) {
                    window.CoreRuntime.api.tool.set('eraser');
                    window.CoreRuntime.api.layer.exitMoveMode();
                } else if (this.drawingEngine?.brushCore) {
                    this.drawingEngine.brushCore.setMode('eraser');
                }
                this.closeAllPopups();
                this.updateToolUI('eraser');
            },
            'fill-tool': () => {
                if (window.CoreRuntime?.api?.tool?.set) {
                    window.CoreRuntime.api.tool.set('fill');
                    window.CoreRuntime.api.layer.exitMoveMode();
                } else if (this.drawingEngine?.brushCore) {
                    this.drawingEngine.brushCore.setMode('fill');
                }
                this.closeAllPopups();
                this.updateToolUI('fill');
            },
            'resize-tool': () => {
                this.togglePopup('resize');
            },
            'gif-animation-tool': () => {
                if (this.eventBus) {
                    this.eventBus.emit('ui:toggle-timeline');
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
        document.querySelectorAll('.tool-button').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const toolBtn = document.getElementById(tool + '-tool');
        if (toolBtn) {
            toolBtn.classList.add('active');
        }

        const toolNames = {
            pen: this.getPenStatusName(),
            eraser: this.getEraserStatusName(),
            fill: '塗りつぶし',
            'gif-animation': 'GIFアニメーション'
        };
        const toolElement = document.getElementById('current-tool');
        if (toolElement) {
            toolElement.textContent = toolNames[tool] || tool;
        }
    }

    getPenStatusName() {
        const pressureEnabled = window.brushSettings?.pressureEnabled === true;
        return pressureEnabled ? 'ペン（筆圧ON）' : 'ペン（固定幅）';
    }

    getEraserStatusName() {
        const pressureEnabled = window.brushSettings?.eraserPressureEnabled === true;
        return pressureEnabled ? '消しゴム（筆圧ON）' : '消しゴム（固定幅）';
    }

    updateStatusDisplay(data) {
        if (data.currentLayer) {
            const layerEl = document.getElementById('current-layer');
            if (layerEl) layerEl.textContent = data.currentLayer;
        }
    }

    updateHistoryUI(data = null) {
        const historyElement = document.getElementById('history-info');
        if (!historyElement) return;

        const history = window.History;
        const currentIndex = data?.currentIndex ?? history?.index ?? -1;
        const canUndo = data?.canUndo ?? history?.canUndo?.() ?? false;
        const displayIndex = canUndo ? currentIndex + 1 : 0;
        const maxSize = history?.maxSize || 500;

        historyElement.textContent = `${displayIndex}/${maxSize}`;
    }

    setupCanvasResize() {
        const applyBtn = document.getElementById('apply-resize');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                const widthDisplay = document.getElementById('canvas-width-display');
                const heightDisplay = document.getElementById('canvas-height-display');
                
                if (widthDisplay && heightDisplay) {
                    const newWidth = parseInt(widthDisplay.textContent);
                    const newHeight = parseInt(heightDisplay.textContent);
                    
                    if (newWidth > 0 && newHeight > 0) {
                        if (window.CoreRuntime?.api?.camera?.resize) {
                            window.CoreRuntime.api.camera.resize(newWidth, newHeight);
                        } else if (window.coreEngine?.cameraSystem?.resizeCanvas) {
                            window.coreEngine.cameraSystem.resizeCanvas(newWidth, newHeight);
                        }
                        this.closeAllPopups();
                    }
                }
            });
        }
    }

    setupFlipButtons() {
        const flipHorizontalBtn = document.getElementById('flip-horizontal-btn');
        const flipVerticalBtn = document.getElementById('flip-vertical-btn');
        flipHorizontalBtn?.removeAttribute('disabled');
        flipVerticalBtn?.removeAttribute('disabled');
    }

    setupPanelStyles() {
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
                cursor: pointer;
                background-color: var(--futaba-cream);
                border: 1px solid var(--futaba-medium);
            }
            
            .flip-button.active {
                background-color: var(--futaba-light-maroon) !important;
                border-color: var(--futaba-maroon) !important;
                color: white;
            }
            
            .tool-button.active {
                background-color: rgba(255, 255, 238, 0.9) !important;
                border: 3px solid #ff8c42 !important;
            }
            
            .tool-button.active svg {
                stroke: var(--futaba-maroon) !important;
            }
            
            .tool-button:hover:not(.active) {
                background-color: rgba(233, 194, 186, 0.72) !important;
            }
        `;
        
        if (!document.querySelector('style[data-tegaki-panels]')) {
            style.setAttribute('data-tegaki-panels', 'true');
            document.head.appendChild(style);
        }
    }
}

// 下位互換性のためにグローバルに登録
window.TegakiUI = window.TegakiUI || {};
window.TegakiUI.UIController = UIController;
