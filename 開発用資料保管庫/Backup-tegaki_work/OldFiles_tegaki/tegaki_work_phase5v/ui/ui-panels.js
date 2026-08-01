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
        this.syncLayerPanelActionButtons();
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

    toggleSettingsPopup() {
        const settingsPopup = this.popupManager?.get?.('settings') || window.SettingsPopupInstance || window.SettingsPopup;
        if (settingsPopup?.toggle) {
            settingsPopup.toggle();
        } else if (this.eventBus) {
            this.eventBus.emit('ui:open-settings');
        }
    }

    toggleQuickAccessPopup() {
        const quickAccessPopup = this.popupManager?.get?.('quickAccess') || window.QuickAccessPopup;
        if (quickAccessPopup?.toggle) {
            quickAccessPopup.toggle();
        } else {
            this.togglePopup('quickAccess');
        }
    }
    
    closeAllPopups(exceptName = null) {
        if (this.popupManager) {
            const keepOpen = exceptName === null ? ['settings'] : exceptName;
            this.popupManager.hideAll(keepOpen);
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
            this.toggleSettingsPopup();
        });
        
        this.eventBus.on('ui:show-settings', () => {
            this.showPopup('settings');
        });
        
        this.eventBus.on('ui:toggle-quick-access', () => {
            this.toggleQuickAccessPopup();
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
            this.syncLayerPanelActionButtons();
        });

        this.eventBus.on('history:changed', (data) => {
            this.updateHistoryUI(data);
            this.syncLayerPanelActionButtons();
        });

        this.eventBus.on('layer:panel-update-requested', () => {
            this.syncLayerPanelActionButtons();
        });

        this.eventBus.on('layer:activated', () => {
            this.syncLayerPanelActionButtons();
        });

        this.eventBus.on('animation:frame-changed', () => {
            this.syncLayerPanelActionButtons();
        });

        this.eventBus.on('popup:initialized', () => {
            this.ensurePopupCloseButtons();
        });

        this.eventBus.on('camera:transform-changed', (payload) => {
            this.updateCameraFlipWarning(payload);
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

    updateCameraFlipWarning(payload = {}) {
        const container = document.getElementById('canvas-warning-container');
        if (!container) return;

        container.innerHTML = '';

        if (payload.horizontalFlipped) {
            const badge = document.createElement('div');
            badge.className = 'canvas-warning-badge';
            badge.textContent = '左右反転中';
            container.appendChild(badge);
        }

        if (payload.verticalFlipped) {
            const badge = document.createElement('div');
            badge.className = 'canvas-warning-badge';
            badge.textContent = '上下反転中';
            container.appendChild(badge);
        }
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
                if (this._isLayerPanelControlDisabled(flipButton)) {
                    flipButton.blur?.();
                    return;
                }
                const selectionApi = window.CoreRuntime?.api?.selection;
                if (selectionApi?.getState?.()?.transformSessionActive) {
                    const direction = flipButton.id === 'flip-horizontal-btn'
                        ? 'horizontal'
                        : 'vertical';
                    selectionApi.flipTransform?.(direction);
                    flipButton.blur?.();
                    return;
                }
                if (this._shouldBlockNormalLayerOperation({
                    blockAnimationContext: true,
                    allowAnimationWorkingLayerTransform: true
                })) {
                    flipButton.blur?.();
                    return;
                }
                const direction = flipButton.id === 'flip-horizontal-btn' ? 'horizontal' : 'vertical';
                this.eventBus.emit('layer:flip-requested', { direction, bypassVKeyCheck: true });
                return;
            }

            const resetButton = e.target.closest('#layer-transform-reset-btn');
            if (resetButton) {
                if (this._isLayerPanelControlDisabled(resetButton)) {
                    resetButton.blur?.();
                    return;
                }
                const selectionApi = window.CoreRuntime?.api?.selection;
                if (selectionApi?.getState?.()?.transformSessionActive) {
                    selectionApi.resetTransform?.();
                    resetButton.blur?.();
                    return;
                }
                if (this._shouldBlockNormalLayerOperation({
                    blockAnimationContext: true,
                    allowAnimationWorkingLayerTransform: true
                })) {
                    resetButton.blur?.();
                    return;
                }
                this.eventBus.emit('layer:reset-transform');
                return;
            }

            const layerAddBtn = e.target.closest('#add-layer-btn');
            if (layerAddBtn) {
                if (this._isLayerPanelControlDisabled(layerAddBtn)) {
                    layerAddBtn.blur?.();
                    return;
                }
                const animationContext = this._getAnimationLayerContext();
                if (animationContext.hasContext) {
                    if (animationContext.hasSelectedClip && typeof animationContext.table.addInternalLayer === 'function') {
                        animationContext.table.addInternalLayer();
                    }
                    layerAddBtn.blur?.();
                    return;
                }

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
                if (this._isLayerPanelControlDisabled(folderAddBtn)) {
                    folderAddBtn.blur?.();
                    return;
                }
                const animationContext = this._getAnimationLayerContext();
                if (animationContext.hasContext) {
                    if (animationContext.hasSelectedClip && typeof animationContext.table.addInternalFolder === 'function') {
                        animationContext.table.addInternalFolder();
                    }
                    folderAddBtn.blur?.();
                    return;
                }

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
                if (this._isLayerPanelControlDisabled(layerAttributeBtn)) {
                    layerAttributeBtn.blur?.();
                    return;
                }
                this.eventBus?.emit('ui:layer-attribute-panel-requested', {
                    anchorElement: layerAttributeBtn
                });
                return;
            }

            const duplicateActiveBtn = e.target.closest('#duplicate-active-layer-btn');
            if (duplicateActiveBtn) {
                if (this._isLayerPanelControlDisabled(duplicateActiveBtn)) {
                    duplicateActiveBtn.blur?.();
                    return;
                }
                this.handleActiveLayerOperation('duplicate', duplicateActiveBtn);
                return;
            }

            const mergeActiveBtn = e.target.closest('#merge-active-layer-btn');
            if (mergeActiveBtn) {
                if (this._isLayerPanelControlDisabled(mergeActiveBtn)) {
                    mergeActiveBtn.blur?.();
                    return;
                }
                this.handleActiveLayerOperation('mergeDown', mergeActiveBtn);
                return;
            }

            const deleteActiveBtn = e.target.closest('#delete-active-layer-btn');
            if (deleteActiveBtn) {
                if (this._isLayerPanelControlDisabled(deleteActiveBtn)) {
                    deleteActiveBtn.blur?.();
                    return;
                }
                this.handleActiveLayerOperation('delete', deleteActiveBtn);
                return;
            }

            const closeBtn = e.target.closest('.popup-close-btn');
            if (closeBtn) {
                const target = closeBtn.dataset.target;
                if (target === 'settings-popup') {
                    this.hidePopup('settings');
                } else if (target === 'quick-access-popup') {
                    this.hidePopup('quickAccess');
                } else if (target === 'resize-settings') {
                    this.hidePopup('resize');
                } else if (target === 'export-popup') {
                    this.hidePopup('export');
                } else {
                    this.closeAllPopups();
                }
                return;
            }

            if (!e.target.closest('.popup-panel') && 
                !e.target.closest('.album-overlay') &&
                !e.target.closest('.layer-transform-panel') &&
                !e.target.closest('.tool-button') &&
                !e.target.closest('.layer-panel-container')) {
                this.closeAllPopups(['quickAccess', 'settings', 'animationTable']);
            }
        });
    }

    handleActiveLayerOperation(action, triggerEl = null) {
        const animationContext = this._getAnimationLayerContext();
        if (animationContext.hasContext) {
            const animationTable = animationContext.table;
            if (!animationContext.hasSelectedClip) {
                triggerEl?.blur?.();
                return;
            }

            const selectedInternalLayerId = animationTable.selectedInternalLayerId || null;

            if (action === 'duplicate') {
                if (selectedInternalLayerId && typeof animationTable.duplicateInternalLayer === 'function') {
                    animationTable.duplicateInternalLayer(selectedInternalLayerId);
                }
                triggerEl?.blur?.();
                return;
            }

            if (action === 'mergeDown') {
                if (selectedInternalLayerId && typeof animationTable.mergeInternalLayerDown === 'function') {
                    animationTable.mergeInternalLayerDown(selectedInternalLayerId);
                }
                triggerEl?.blur?.();
                return;
            }

            if (action === 'delete') {
                if (selectedInternalLayerId && typeof animationTable.removeInternalLayer === 'function') {
                    animationTable.removeInternalLayer(selectedInternalLayerId);
                }
                triggerEl?.blur?.();
                return;
            }
        }

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
            if (activeData.isFolder) {
                if (this.layerManager.canMergeFolderToLayer?.(activeIndex)) {
                    this.layerManager.mergeLayerDown?.(activeIndex);
                }
                return stop();
            }
            const bottomData = layers[activeIndex - 1]?.layerData;
            if (
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
            const batchDeleteIndexes = this._getBatchDeleteLayerIndexes(activeIndex);
            if (batchDeleteIndexes.length > 1) {
                batchDeleteIndexes.forEach(index => {
                    this.layerManager.deleteLayer?.(index);
                });
                return stop();
            }
            this.layerManager.deleteLayer?.(activeIndex);
            return stop();
        }
    }

    _shouldBlockNormalLayerOperation(options = {}) {
        const animationContext = this._getAnimationLayerContext();
        if (
            options.allowAnimationWorkingLayerTransform === true
            && animationContext.hasContext
            && this.layerManager?.getActiveLayer?.()?.layerData?.isAnimationWorkingLayer === true
        ) {
            return false;
        }
        return !!(
            animationContext.hasContext &&
            (options.blockAnimationContext === true || !animationContext.hasSelectedClip)
        );
    }

    _getAnimationLayerContext() {
        const table = this.popupManager?.get?.('animationTable');
        const hasContext = !!(
            table?.model
            && (
                (table.model.tracks?.length || 0) > 0
                || (table.model.clipAssets?.length || 0) > 0
            )
        );
        return {
            table,
            hasContext,
            hasSelectedClip: !!(hasContext && table?.selectedCelId)
        };
    }

    _getAnimationSelectedInternalLayer() {
        const animationContext = this._getAnimationLayerContext();
        const table = animationContext.table;
        if (!animationContext.hasSelectedClip || !table?.selectedInternalLayerId) {
            return {
                table,
                asset: null,
                layer: null
            };
        }

        const entry = table.model?.findClipEntry?.(table.selectedCelId);
        const asset = entry?.clip?.assetId ? table.model.getClipAsset(entry.clip.assetId) : null;
        const layer = asset?.internalLayers?.find(item => item.id === table.selectedInternalLayerId) || null;
        return {
            table,
            asset,
            layer
        };
    }

    _isLayerPanelControlDisabled(control) {
        return !!(
            control?.disabled
            || control?.classList?.contains('is-disabled')
            || control?.getAttribute?.('aria-disabled') === 'true'
        );
    }

    _setLayerPanelControlDisabled(control, disabled) {
        if (!control) return;
        control.classList.toggle('is-disabled', disabled);
        control.setAttribute('aria-disabled', disabled ? 'true' : 'false');
        if ('disabled' in control) {
            control.disabled = disabled;
        }
    }

    syncLayerPanelActionButtons() {
        const controls = {
            addLayer: document.getElementById('add-layer-btn'),
            addFolder: document.getElementById('add-folder-btn'),
            attribute: document.getElementById('layer-attribute-panel-btn'),
            duplicate: document.getElementById('duplicate-active-layer-btn'),
            mergeDown: document.getElementById('merge-active-layer-btn'),
            delete: document.getElementById('delete-active-layer-btn'),
            flipHorizontal: document.getElementById('flip-horizontal-btn'),
            flipVertical: document.getElementById('flip-vertical-btn'),
            resetTransform: document.getElementById('layer-transform-reset-btn')
        };
        const animationContext = this._getAnimationLayerContext();

        if (!animationContext.hasContext) {
            Object.values(controls).forEach(control => this._setLayerPanelControlDisabled(control, false));
            return;
        }

        const { table, asset, layer } = this._getAnimationSelectedInternalLayer();
        const hasClip = animationContext.hasSelectedClip;
        const hasLayer = !!layer;
        const isFolder = layer?.type === 'folder' || layer?.isFolder === true;
        const canMergeInternalFolder = isFolder
            && table?.canMergeInternalFolderToLayer?.(layer?.id, asset) === true;

        this._setLayerPanelControlDisabled(controls.addLayer, !hasClip);
        this._setLayerPanelControlDisabled(controls.addFolder, !hasClip);
        this._setLayerPanelControlDisabled(controls.attribute, !hasLayer);
        this._setLayerPanelControlDisabled(controls.duplicate, !hasLayer);
        this._setLayerPanelControlDisabled(controls.delete, !hasLayer);
        this._setLayerPanelControlDisabled(controls.mergeDown, !hasLayer || (isFolder && !canMergeInternalFolder));
        const canTransformActiveWorkingLayer = this.layerManager?.getActiveLayer?.()?.layerData?.isAnimationWorkingLayer === true;
        this._setLayerPanelControlDisabled(controls.flipHorizontal, !canTransformActiveWorkingLayer);
        this._setLayerPanelControlDisabled(controls.flipVertical, !canTransformActiveWorkingLayer);
        this._setLayerPanelControlDisabled(controls.resetTransform, !canTransformActiveWorkingLayer);
    }

    _getBatchDeleteLayerIndexes(activeIndex) {
        const layers = this.layerManager?.getLayers?.() || [];
        const selectedIds = new Set(this.layerManager?.getSelectedLayerIds?.() || []);
        if (selectedIds.size <= 1) return [];

        const hasSelectedAncestor = (layer) => {
            let parentId = layer?.layerData?.parentId || null;
            const visited = new Set();
            while (parentId && !visited.has(parentId)) {
                visited.add(parentId);
                if (selectedIds.has(parentId)) return true;
                const parent = layers.find(candidate => candidate.layerData?.id === parentId);
                parentId = parent?.layerData?.parentId || null;
            }
            return false;
        };

        return layers
            .map((layer, index) => ({ layer, index }))
            .filter(({ layer }) => {
                const data = layer?.layerData;
                if (!data?.id || data.isBackground) return false;
                if (!selectedIds.has(data.id)) return false;
                return !hasSelectedAncestor(layer);
            })
            .map(({ index }) => index)
            .sort((a, b) => b - a);
    }

    _confirmActiveTransformsForToolSwitch(nextTool) {
        const selectionApi = window.CoreRuntime?.api?.selection || window.pixelSelectionSystem;
        if (nextTool !== 'selection' && selectionApi?.getState?.()?.transformSessionActive) {
            if (selectionApi.confirmTransform?.() !== true) return false;
        }

        const layerApi = window.CoreRuntime?.api?.layer;
        const layerManager = this.layerManager || window.layerManager || window.drawingApp?.layerManager;
        if (nextTool !== 'layer-move' && (layerManager?.isLayerMoveMode || layerManager?.vKeyPressed)) {
            const result = layerApi?.exitMoveMode
                ? layerApi.exitMoveMode()
                : layerManager?.exitLayerMoveMode?.();
            if (result === false) return false;
        }

        return true;
    }
    
    handleToolClick(button) {
        const toolId = button.id;
        const transformExitTool = {
            'pen-tool': 'pen',
            'eraser-tool': 'eraser',
            'fill-tool': 'fill',
            'selection-tool': 'selection',
            'airbrush-tool': 'airbrush'
        }[toolId];
        if (transformExitTool && !this._confirmActiveTransformsForToolSwitch(transformExitTool)) {
            return;
        }
        const toolMap = {
            'pen-tool': () => {
                if (window.CoreRuntime?.api?.tool?.set) {
                    window.CoreRuntime.api.tool.set('pen');
                    window.CoreRuntime.api.layer.exitMoveMode();
                } else if (this.drawingEngine?.brushCore) {
                    this.drawingEngine.brushCore.setMode('pen');
                }
                this.toggleQuickAccessPopup();
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
                const currentMode = window.brushSettings?.getMode();
                const nextMode = currentMode === 'fill' ? 'eraser-fill' : 'fill';

                if (window.CoreRuntime?.api?.tool?.set) {
                    window.CoreRuntime.api.tool.set(nextMode);
                    window.CoreRuntime.api.layer.exitMoveMode();
                } else if (this.drawingEngine?.brushCore) {
                    this.drawingEngine.brushCore.setMode(nextMode);
                }
                this.closeAllPopups();
                this.updateToolUI(nextMode);
            },
            'selection-tool': () => {
                window.CoreRuntime?.api?.selection?.setToolActive?.(true);
                window.CoreRuntime?.api?.layer?.exitMoveMode?.();
                const animationTable = this.popupManager?.get?.('animationTable');
                if (!animationTable?.isVisible) {
                    this.closeAllPopups();
                }
                this.updateToolUI('selection');
            },
            'airbrush-tool': () => {
                let currentMode = window.brushSettings?.getMode();
                let nextMode = currentMode === 'airbrush' ? 'airbrush-erase' : 'airbrush';
                
                if (window.CoreRuntime?.api?.tool?.set) {
                    window.CoreRuntime.api.tool.set(nextMode);
                    window.CoreRuntime.api.layer.exitMoveMode();
                } else if (this.drawingEngine?.brushCore) {
                    this.drawingEngine.brushCore.setMode(nextMode);
                }
                this.closeAllPopups();
                this.updateToolUI(nextMode);
            },
            'resize-tool': () => {
                this.togglePopup('resize');
            },
            'gif-animation-tool': () => {
                // 旧タイムラインが表示中なら閉じる
                const timelineUI = window.timelineUI;
                if (timelineUI?.isVisible) {
                    timelineUI.hide();
                }

                this.togglePopup('animationTable');
                
                // 表示状態に合わせてサイドバーの選択状態を更新
                const animTable = this.popupManager?.get('animationTable');
                if (animTable?.isVisible) {
                    this.updateToolUI('gif-animation');
                } else {
                    // 閉じた場合は、現在のブラシなどのツール表示に戻す
                    const currentTool = window.brushSettings?.getMode?.() || 'pen';
                    this.updateToolUI(currentTool);
                }
            },
            'library-tool': () => {
                this.togglePopup('album');
            },
            'image-import-tool': () => {
                window.imageImporter?.openFileDialog?.();
            },
            'export-tool': () => {
                this.togglePopup('export');
            },
            'settings-tool': () => {
                this.toggleSettingsPopup();
            }
        };
        
        const handler = toolMap[toolId];
        if (handler) handler();
    }

    updateToolUI(tool) {
        document.querySelectorAll('.tool-button').forEach(btn => {
            btn.classList.remove('active', 'erase-mode');
        });
        
        let baseTool = tool.startsWith('airbrush') ? 'airbrush' : tool;
        if (tool === 'eraser-fill') {
            baseTool = 'fill';
        }
        const toolBtn = document.getElementById(baseTool + '-tool');
        if (toolBtn) {
            toolBtn.classList.add('active');
            if (tool === 'airbrush-erase' || tool === 'eraser-fill') {
                toolBtn.classList.add('erase-mode');
            }
        }

        const toolNames = {
            pen: this.getPenStatusName(),
            eraser: this.getEraserStatusName(),
            fill: '塗りつぶし',
            'eraser-fill': '消しバケツ',
            airbrush: 'スプレー',
            'airbrush-erase': '透明スプレー',
            'eyedropper': 'スポイト',
            'gif-animation': 'アニメテーブル',
            selection: '矩形選択'
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
            if (layerEl) layerEl.textContent = this._getAnimationLayerStatusName() || data.currentLayer;
        }
    }

    _getAnimationLayerStatusName() {
        const animationContext = this._getAnimationLayerContext();
        const table = animationContext.table;
        if (!animationContext.hasContext) return null;
        if (!animationContext.hasSelectedClip) return 'NO FRAME';

        const entry = table.model?.findClipEntry?.(table.selectedCelId);
        const asset = entry?.clip?.assetId ? table.model.getClipAsset(entry.clip.assetId) : null;
        const selectedLayer = asset?.internalLayers?.find(layer => layer.id === table.selectedInternalLayerId) || null;
        if (selectedLayer?.name) return selectedLayer.name;
        if (asset?.name) return asset.name;
        return entry?.clip?.name || 'CAF';
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
            if (applyBtn.closest('#resize-settings')) {
                return;
            }
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
        const resetTransformBtn = document.getElementById('layer-transform-reset-btn');
        flipHorizontalBtn?.removeAttribute('disabled');
        flipVerticalBtn?.removeAttribute('disabled');
        resetTransformBtn?.removeAttribute('disabled');
    }

    setupPanelStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .flip-section {
                gap: 2px !important;
                height: 82px;
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

            .flip-button.is-disabled,
            .flip-button[aria-disabled="true"] {
                opacity: 0.32 !important;
                cursor: default !important;
                transform: none !important;
            }

            .flip-button.is-disabled:hover,
            .flip-button[aria-disabled="true"]:hover {
                background-color: var(--futaba-cream) !important;
                border-color: var(--futaba-medium) !important;
                transform: none !important;
            }
            
            .tool-button.active {
                background-color: rgba(255, 255, 238, 0.9) !important;
                border: 3px solid #ff8c42 !important;
            }
            
            .tool-button.active svg {
                stroke: var(--futaba-maroon) !important;
            }

            .tool-button.active.erase-mode {
                background-color: rgba(184, 112, 107, 0.22) !important;
                border: 3px solid #b8706b !important;
            }

            .tool-button.active.erase-mode svg {
                stroke: #8f3f3a !important;
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
