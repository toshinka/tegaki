/**
 * ============================================================================
 * ファイル名: ui/keyboard-handler.js
 * 責務: キーボードショートカットの検知と各アクションへの振り分けを担当する
 * 依存: config.js, system/event-bus.js, system/history.js, layer-system.js
 * 被依存: core-initializer.js
 * 公開API: KeyboardHandler
 * イベント発火: keyboard:vkey-state-changed, ui:sidebar:sync-tool, layer:*, camera:*, frame:*, ui:*
 * イベント受信: なし
 * グローバル登録: window.KeyboardHandler
 * 実装状態: ✅完成/整備
 * ============================================================================
 */

import { TEGAKI_KEYMAP } from '../config.js';
import { TegakiEventBus } from '../system/event-bus.js';
import { historyManager } from '../system/history.js';
import { Container } from 'pixi.js';

export const KeyboardHandler = (function() {
    'use strict';

    let isInitialized = false;
    let vKeyPressed = false;

    function isInputFocused() {
        const activeElement = document.activeElement;
        if (!activeElement) return false;
        
        return (
            activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.isContentEditable
        );
    }

    function handleKeyDown(e) {
        const eventBus = TegakiEventBus;
        const keymap = TEGAKI_KEYMAP;
        
        if (!eventBus || !keymap) return;
        if (isInputFocused()) return;
        
        if (e.key === 'F5' || e.key === 'F11' || e.key === 'F12') return;
        if (e.key.startsWith('F') && e.key.length <= 3) {
            e.preventDefault();
            return;
        }

        if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
            const layerManager = window.layerManager || window.drawingApp?.layerManager;
            const activeLayer = layerManager?.getActiveLayer?.();
            if (activeLayer?.layerData?.isFolder && layerManager?.toggleFolderExpand) {
                layerManager.toggleFolderExpand(activeLayer.layerData.id);
                e.preventDefault();
                return;
            }
        }

        if (e.altKey && !e.ctrlKey && !e.shiftKey && !e.metaKey && (e.key === 'Delete' || e.key === 'Backspace')) {
            const animationTable = window.PopupManager?.get?.('animationTable')
                || window.coreEngine?.popupManager?.get?.('animationTable');
            if (animationTable?.isVisible && animationTable.deleteActiveSelection?.()) {
                e.preventDefault();
                e.stopImmediatePropagation();
                return;
            }
        }
        
        // Vキーのトグル処理
        if (e.code === 'KeyV' && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
            if (!e.repeat) {
                vKeyPressed = !vKeyPressed;
                eventBus.emit('keyboard:vkey-state-changed', { pressed: vKeyPressed });
            }
            e.preventDefault();
            return;
        }

        const quickPresetDelta = getQuickAccessPresetShortcutDelta(e);
        if (quickPresetDelta !== 0) {
            selectQuickAccessPresetSlot(quickPresetDelta);
            e.preventDefault();
            return;
        }

        const action = keymap.getAction(e, { vMode: vKeyPressed });

        // Shift+P: 筆圧のON/OFF切り替え
        if (e.code === 'KeyP' && e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
            if (window.brushSettings) {
                window.brushSettings.togglePressure();
                e.preventDefault();
                return;
            }
        }

        // Shift+E: 消しゴム筆圧のON/OFF切り替え
        if (e.code === 'KeyE' && e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
            if (window.brushSettings) {
                window.brushSettings.toggleEraserPressure();
                e.preventDefault();
                return;
            }
        }

        if (!action) return;
        
        handleAction(action, e, eventBus);
    }

    function handleKeyUp(e) {
        // Vキーはトグル式なので、keyupでは何もしない
    }

    function getQuickAccessPresetShortcutDelta(event) {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return 0;

        if (event.key === '[' || event.code === 'BracketLeft') return -1;
        if (event.key === ']' || event.code === 'BracketRight') return 1;

        return 0;
    }

    function handleAction(action, event, eventBus) {
        const api = window.CoreRuntime?.api;
        const history = window.History || historyManager;

        const syncToolUI = (tool) => {
            eventBus.emit('ui:sidebar:sync-tool', { tool });
            eventBus.emit('tool:changed', {
                component: 'keyboard',
                action: 'tool-changed',
                tool
            });
        };
        
        switch(action) {
            case 'UNDO':
                if (history?.canUndo()) {
                    history.undo();
                }
                event.preventDefault();
                break;
                
            case 'REDO':
                if (history?.canRedo()) {
                    history.redo();
                }
                event.preventDefault();
                break;
            
            case 'TOOL_PEN':
                if (api?.tool.set('pen')) {
                    syncToolUI('pen');
                } else if (window.coreEngine?.switchTool) {
                    window.coreEngine.switchTool('pen');
                    syncToolUI('pen');
                }
                event.preventDefault();
                break;
            
            case 'TOOL_ERASER':
                if (api?.tool.set('eraser')) {
                    syncToolUI('eraser');
                } else if (window.coreEngine?.switchTool) {
                    window.coreEngine.switchTool('eraser');
                    syncToolUI('eraser');
                }
                event.preventDefault();
                break;

            case 'TOOL_FILL':
                const currentMode = window.brushSettings?.getMode();
                let targetFillMode = 'fill';

                // fill <-> eraser-fill の循環
                if (currentMode === 'fill') {
                    targetFillMode = 'eraser-fill';
                } else if (currentMode === 'eraser-fill') {
                    targetFillMode = 'fill';
                }

                if (api?.tool.set(targetFillMode)) {
                    syncToolUI(targetFillMode);
                } else if (window.coreEngine?.switchTool) {
                    window.coreEngine.switchTool(targetFillMode);
                    syncToolUI(targetFillMode);
                }
                event.preventDefault();
                break;

            case 'TOOL_LASSO_FILL':
                if (api?.tool.set('lasso-fill')) {
                    syncToolUI('lasso-fill');
                } else if (window.coreEngine?.switchTool) {
                    window.coreEngine.switchTool('lasso-fill');
                    syncToolUI('lasso-fill');
                }
                event.preventDefault();
                break;

            case 'TOOL_EYEDROPPER':
                if (api?.tool.set('eyedropper')) {
                    syncToolUI('eyedropper');
                } else if (window.coreEngine?.switchTool) {
                    window.coreEngine.switchTool('eyedropper');
                    syncToolUI('eyedropper');
                }
                event.preventDefault();
                break;
            case 'TOOL_AIRBRUSH_BLUR_TOGGLE': {
                const currentTool = api?.tool.get() || window.coreEngine?.brushCore.getMode();
                let nextTool = currentTool === 'airbrush' ? 'airbrush-erase' : 'airbrush';
                
                if (api?.tool.set(nextTool)) {
                    syncToolUI(nextTool);
                } else if (window.coreEngine?.switchTool) {
                    window.coreEngine.switchTool(nextTool);
                    syncToolUI(nextTool);
                }
                event.preventDefault();
                break;
            }

            case 'COLOR_SWAP_MAIN_SUB':
                eventBus.emit('color:swap-main-sub');
                event.preventDefault();
                break;
            
            case 'LAYER_CREATE':
                if (handleAnimationTableLayerShortcut('create')) {
                    event.preventDefault();
                    break;
                }
                if (api?.layer.create) {
                    const result = api.layer.create();
                    if (result) {
                        api.layer.setActive(result.index);
                    }
                } else if (window.layerManager?.createLayer) {
                    window.layerManager.createLayer();
                }
                event.preventDefault();
                break;
            
            case 'LAYER_DELETE_DRAWINGS':
                if (handleAnimationTableLayerShortcut('clear')) {
                    event.stopImmediatePropagation();
                    event.preventDefault();
                    break;
                }
                deleteActiveLayerDrawings();
                event.preventDefault();
                break;
            
            case 'LAYER_DELETE':
                if (handleAnimationTableLayerShortcut('delete')) {
                    event.preventDefault();
                    break;
                }
                eventBus.emit('layer:delete-active');
                event.preventDefault();
                break;
            
            case 'LAYER_COPY':
                if (handleAnimationTableLayerShortcut('copy')) {
                    event.preventDefault();
                    break;
                }
                eventBus.emit('layer:copy-request');
                event.preventDefault();
                break;
            
            case 'LAYER_PASTE':
                if (handleAnimationTableLayerShortcut('paste')) {
                    event.preventDefault();
                    break;
                }
                eventBus.emit('layer:paste-request');
                event.preventDefault();
                break;
            
            case 'LAYER_CUT':
                if (handleAnimationTableLayerShortcut('cut')) {
                    event.preventDefault();
                    break;
                }
                eventBus.emit('layer:cut-request');
                event.preventDefault();
                break;
            
            case 'LAYER_RESET':
                eventBus.emit('layer:reset-transform');
                event.preventDefault();
                break;
            
            case 'LAYER_MOVE_UP':
                eventBus.emit('layer:move-by-key', { direction: 'ArrowUp' });
                event.preventDefault();
                break;
            
            case 'LAYER_MOVE_DOWN':
                eventBus.emit('layer:move-by-key', { direction: 'ArrowDown' });
                event.preventDefault();
                break;
            
            case 'LAYER_MOVE_LEFT':
                eventBus.emit('layer:move-by-key', { direction: 'ArrowLeft' });
                event.preventDefault();
                break;
            
            case 'LAYER_MOVE_RIGHT':
                eventBus.emit('layer:move-by-key', { direction: 'ArrowRight' });
                event.preventDefault();
                break;
            
            case 'LAYER_SCALE_UP':
                eventBus.emit('layer:scale-by-key', { direction: 'ArrowUp' });
                event.preventDefault();
                break;
            
            case 'LAYER_SCALE_DOWN':
                eventBus.emit('layer:scale-by-key', { direction: 'ArrowDown' });
                event.preventDefault();
                break;
            
            case 'LAYER_ROTATE_LEFT':
                eventBus.emit('layer:rotate-by-key', { direction: 'ArrowLeft' });
                event.preventDefault();
                break;
            
            case 'LAYER_ROTATE_RIGHT':
                eventBus.emit('layer:rotate-by-key', { direction: 'ArrowRight' });
                event.preventDefault();
                break;
            
            case 'LAYER_FLIP_HORIZONTAL':
                if (vKeyPressed) {
                    eventBus.emit('layer:flip-by-key', { direction: 'horizontal' });
                }
                event.preventDefault();
                break;
            
            case 'LAYER_FLIP_VERTICAL':
                if (vKeyPressed) {
                    eventBus.emit('layer:flip-by-key', { direction: 'vertical' });
                }
                event.preventDefault();
                break;
            
            case 'LAYER_HIERARCHY_UP':
                if (!vKeyPressed) {
                    eventBus.emit('layer:select-next');
                }
                event.preventDefault();
                break;
            
            case 'LAYER_HIERARCHY_DOWN':
                if (!vKeyPressed) {
                    eventBus.emit('layer:select-prev');
                }
                event.preventDefault();
                break;
            
            case 'LAYER_ORDER_UP':
                if (handleAnimationTableLayerShortcut('order-up')) {
                    event.preventDefault();
                    break;
                }
                eventBus.emit('layer:order-up');
                event.preventDefault();
                break;
            
            case 'LAYER_ORDER_DOWN':
                if (handleAnimationTableLayerShortcut('order-down')) {
                    event.preventDefault();
                    break;
                }
                eventBus.emit('layer:order-down');
                event.preventDefault();
                break;
            
            case 'CAMERA_FLIP_HORIZONTAL':
                if (!vKeyPressed) {
                    eventBus.emit('camera:flip-horizontal');
                }
                event.preventDefault();
                break;
            
            case 'CAMERA_FLIP_VERTICAL':
                if (!vKeyPressed) {
                    eventBus.emit('camera:flip-vertical');
                }
                event.preventDefault();
                break;
            
            case 'CAMERA_RESET':
                if (!vKeyPressed) {
                    eventBus.emit('camera:reset');
                }
                event.preventDefault();
                break;
            
            case 'FRAME_PREV':
                if (!vKeyPressed && window.timelineUI?.isVisible) {
                    window.timelineUI.goToPreviousFrameSafe();
                }
                event.preventDefault();
                break;
            
            case 'FRAME_NEXT':
                if (!vKeyPressed && window.timelineUI?.isVisible) {
                    window.timelineUI.goToNextFrameSafe();
                }
                event.preventDefault();
                break;
            
            case 'GIF_PLAY_PAUSE':
                if (window.timelineUI?.isVisible) {
                    window.timelineUI.togglePlayStop();
                }
                event.preventDefault();
                break;
            
            case 'GIF_TOGGLE_TIMELINE':
                eventBus.emit('ui:toggle-timeline');
                event.preventDefault();
                break;
            
            case 'GIF_CREATE_FRAME':
                if (window.animationSystem) {
                    window.animationSystem.createNewEmptyFrame();
                }
                event.preventDefault();
                break;
            
            case 'GIF_COPY_FRAME':
                eventBus.emit('frame:copy-current');
                setTimeout(() => {
                    eventBus.emit('frame:paste-right-adjacent');
                }, 10);
                event.preventDefault();
                break;
            
            case 'SETTINGS_OPEN':
                eventBus.emit('ui:open-settings');
                event.preventDefault();
                break;
            
            case 'EXPORT_TOGGLE':
                eventBus.emit('ui:toggle-export');
                event.preventDefault();
                break;

            case 'ALBUM_QUICK_SAVE': {
                event.preventDefault();
                const albumPopup = window.coreEngine?.popupManager?.get?.('album') || window.albumPopup;
                if (albumPopup?.saveCurrentSnapshot) {
                    albumPopup.saveCurrentSnapshot();
                } else if (albumPopup?._saveSnapshot) {
                    albumPopup._saveSnapshot();
                }
                break;
            }
            
            case 'QUICK_ACCESS_TOGGLE':
                if (window.coreEngine?.popupManager?.get) {
                    const quickAccess = window.coreEngine.popupManager.get('quickAccess');
                    if (quickAccess?.toggle) {
                        quickAccess.toggle();
                    } else {
                        eventBus.emit('ui:toggle-quick-access');
                    }
                } else {
                    eventBus.emit('ui:toggle-quick-access');
                }
                event.preventDefault();
                break;

            case 'QUICK_ACCESS_PRESET_PREV':
                selectQuickAccessPresetSlot(-1);
                event.preventDefault();
                break;

            case 'QUICK_ACCESS_PRESET_NEXT':
                selectQuickAccessPresetSlot(1);
                event.preventDefault();
                break;
        }
    }

    function handleAnimationTableLayerShortcut(action) {
        const animationTable = window.PopupManager?.get?.('animationTable')
            || window.coreEngine?.popupManager?.get?.('animationTable');
        if (!animationTable?.isVisible) return false;
        if (!animationTable.selectedCelId) {
            return [
                'create',
                'delete',
                'clear',
                'copy',
                'paste',
                'cut',
                'order-up',
                'order-down',
                'block'
            ].includes(action);
        }

        if (action === 'create') {
            animationTable.addInternalLayer?.();
            return true;
        }

        if (action === 'delete') {
            const selectedInternalLayerId = animationTable.selectedInternalLayerId || null;
            if (selectedInternalLayerId && animationTable.removeInternalLayer) {
                animationTable.removeInternalLayer(selectedInternalLayerId);
            }
            return true;
        }

        if (action === 'clear') {
            const selectedInternalLayerId = animationTable.selectedInternalLayerId || null;
            if (selectedInternalLayerId && animationTable.clearInternalLayerDrawing) {
                animationTable.clearInternalLayerDrawing(selectedInternalLayerId);
            }
            return true;
        }

        if (action === 'copy') {
            animationTable.copyInternalLayer?.();
            return true;
        }

        if (action === 'paste') {
            animationTable.pasteInternalLayer?.();
            return true;
        }

        if (action === 'cut') {
            animationTable.cutInternalLayer?.();
            return true;
        }

        if (action === 'order-up') {
            const selectedInternalLayerId = animationTable.selectedInternalLayerId || null;
            if (selectedInternalLayerId && animationTable.moveInternalLayer) {
                animationTable.moveInternalLayer(selectedInternalLayerId, 'up');
            }
            return true;
        }

        if (action === 'order-down') {
            const selectedInternalLayerId = animationTable.selectedInternalLayerId || null;
            if (selectedInternalLayerId && animationTable.moveInternalLayer) {
                animationTable.moveInternalLayer(selectedInternalLayerId, 'down');
            }
            return true;
        }

        return action === 'block';
    }

    function selectQuickAccessPresetSlot(delta) {
        const popupManager = window.coreEngine?.popupManager || window.PopupManager;
        const quickAccess = popupManager?.get?.('quickAccess');

        if (quickAccess?.selectAdjacentPresetSlot) {
            quickAccess.selectAdjacentPresetSlot(delta);
        }
    }

    function deleteActiveLayerDrawings() {
        const layerSystem = window.drawingApp?.layerManager || window.layerManager;
        
        if (!layerSystem) return;
        
        const activeLayer = layerSystem.getActiveLayer();
        
        if (!activeLayer?.layerData || activeLayer.layerData.isBackground || activeLayer.layerData.isFolder) return;
        
        const history = window.History || historyManager;
        const layerIndex = layerSystem.getLayerIndex(activeLayer);
        const layerId = activeLayer.layerData.id;
        const beforeSnapshot = layerSystem.createLayerRasterSnapshot?.(activeLayer) || null;

        clearLayerDrawings(layerSystem, activeLayer);

        if (history && !history.isApplying && beforeSnapshot && layerSystem.restoreLayerRasterSnapshot) {
            const afterSnapshot = layerSystem.createLayerRasterSnapshot?.(activeLayer) || null;
            if (!afterSnapshot) return;

            const entry = {
                name: 'layer-clear-raster',
                do: () => {
                    layerSystem.restoreLayerRasterSnapshot(afterSnapshot);
                },
                undo: () => {
                    layerSystem.restoreLayerRasterSnapshot(beforeSnapshot);
                },
                meta: { layerId, layerIndex }
            };
            
            if (typeof history.record === 'function') {
                history.record(entry);
            } else {
                history.stack?.splice?.(history.index + 1);
                history.stack?.push?.(entry);
                history.index++;
                history._notifyHistoryChanged?.();
            }
        }
    }

    function clearLayerDrawings(layerSystem, layer) {
        if (!layer?.layerData) return;

        const renderer = layerSystem.app?.renderer;
        const renderTexture = layer.layerData.renderTexture;

        if (renderer && renderTexture) {
            const empty = new Container();
            try {
                renderer.render({
                    container: empty,
                    target: renderTexture,
                    clear: true,
                    clearColor: [0, 0, 0, 0]
                });
            } finally {
                empty.destroy({ children: true });
            }
        }
        
        const childrenToRemove = [];
        for (let child of layer.children) {
            if (child !== layer.layerData.backgroundGraphics && 
                child !== layer.layerData.maskSprite &&
                child !== layer.layerData.layerSprite) {
                childrenToRemove.push(child);
            }
        }
        
        childrenToRemove.forEach((child) => {
            try {
                layer.removeChild(child);
            } catch (error) {}
        });
        
        layer.layerData.paths = [];
        layer.layerData.pathsData = [];
        
        const layerIndex = layerSystem.getLayerIndex(layer);
        layerSystem.requestThumbnailUpdate(layerIndex, true);
        
        if (TegakiEventBus) {
            TegakiEventBus.emit('layer:drawings-deleted', {
                layerId: layer.layerData.id,
                layerIndex: layerIndex
            });
        }
    }

    function restoreLayerDrawings(layerSystem, layer, pathsBackup, childrenBackup, layerIndex) {
        if (!layer?.layerData) return;
        
        const currentChildren = [];
        for (let child of layer.children) {
            if (child !== layer.layerData.backgroundGraphics && 
                child !== layer.layerData.maskSprite &&
                child !== layer.layerData.layerSprite) {
                currentChildren.push(child);
            }
        }
        
        currentChildren.forEach(child => {
            layer.removeChild(child);
        });
        
        layer.layerData.paths = structuredClone(pathsBackup);
        
        if (childrenBackup && childrenBackup.length > 0) {
            childrenBackup.sort((a, b) => a.index - b.index);
            childrenBackup.forEach(({ child, index }) => {
                try {
                    if (index >= 0 && index < layer.children.length) {
                        layer.addChildAt(child, index);
                    } else {
                        layer.addChild(child);
                    }
                } catch (error) {
                    layer.addChild(child);
                }
            });
        }
        
        layerSystem.requestThumbnailUpdate(layerIndex, true);
        
        if (TegakiEventBus) {
            TegakiEventBus.emit('layer:drawings-restored', {
                layerId: layer.layerData.id,
                layerIndex: layerIndex,
                childCount: childrenBackup?.length || 0
            });
        }
    }

    function init() {
        if (isInitialized) return;

        document.addEventListener('keydown', handleKeyDown, { capture: true });
        document.addEventListener('keyup', handleKeyUp);
        
        window.addEventListener('blur', () => {
            if (vKeyPressed) {
                vKeyPressed = false;
                if (TegakiEventBus) {
                    TegakiEventBus.emit('keyboard:vkey-state-changed', { pressed: false });
                }
            }
        });
        
        isInitialized = true;
    }

    function getShortcutList() {
        return TEGAKI_KEYMAP?.getShortcutList() || [];
    }
    
    function isVKeyPressed() {
        return vKeyPressed;
    }
    
    function setVKeyPressed(state) {
        if (vKeyPressed !== state) {
            vKeyPressed = state;
            if (TegakiEventBus) {
                TegakiEventBus.emit('keyboard:vkey-state-changed', { pressed: vKeyPressed });
            }
        }
    }

    return {
        init,
        isInputFocused,
        getShortcutList,
        isVKeyPressed,
        setVKeyPressed,
        deleteActiveLayerDrawings
    };
})();

// 下位互換性のためにグローバルに登録
window.KeyboardHandler = KeyboardHandler;
