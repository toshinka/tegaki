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
 * 実装状態: ♻️移植
 * ============================================================================
 */

import { TEGAKI_KEYMAP } from '../config.js';
import { TegakiEventBus } from '../system/event-bus.js';
import { historyManager } from '../system/history.js';

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
        
        // Vキーのトグル処理
        if (e.code === 'KeyV' && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
            if (!e.repeat) {
                vKeyPressed = !vKeyPressed;
                eventBus.emit('keyboard:vkey-state-changed', { pressed: vKeyPressed });
            }
            e.preventDefault();
            return;
        }
        
        const action = keymap.getAction(e, { vMode: vKeyPressed });
        if (!action) return;
        
        handleAction(action, e, eventBus);
    }

    function handleKeyUp(e) {
        // Vキーはトグル式なので、keyupでは何もしない
    }

    function handleAction(action, event, eventBus) {
        const api = window.CoreRuntime?.api;
        const history = window.History || historyManager;
        
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
                    eventBus.emit('ui:sidebar:sync-tool', { tool: 'pen' });
                } else if (window.coreEngine?.switchTool) {
                    window.coreEngine.switchTool('pen');
                }
                event.preventDefault();
                break;
            
            case 'TOOL_ERASER':
                if (api?.tool.set('eraser')) {
                    eventBus.emit('ui:sidebar:sync-tool', { tool: 'eraser' });
                } else if (window.coreEngine?.switchTool) {
                    window.coreEngine.switchTool('eraser');
                }
                event.preventDefault();
                break;
            
            case 'TOOL_FILL':
                if (api?.tool.set('fill')) {
                    eventBus.emit('ui:sidebar:sync-tool', { tool: 'fill' });
                } else if (window.coreEngine?.switchTool) {
                    window.coreEngine.switchTool('fill');
                }
                event.preventDefault();
                break;
            
            case 'LAYER_CREATE':
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
                deleteActiveLayerDrawings();
                event.preventDefault();
                break;
            
            case 'LAYER_DELETE':
                eventBus.emit('layer:delete-active');
                event.preventDefault();
                break;
            
            case 'LAYER_COPY':
                eventBus.emit('layer:copy-request');
                event.preventDefault();
                break;
            
            case 'LAYER_PASTE':
                eventBus.emit('layer:paste-request');
                event.preventDefault();
                break;
            
            case 'LAYER_CUT':
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
                eventBus.emit('layer:order-up');
                event.preventDefault();
                break;
            
            case 'LAYER_ORDER_DOWN':
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
            
            case 'QUICK_ACCESS_TOGGLE':
                eventBus.emit('ui:toggle-quick-access');
                event.preventDefault();
                break;
        }
    }

    function deleteActiveLayerDrawings() {
        const layerSystem = window.drawingApp?.layerManager || window.layerManager;
        
        if (!layerSystem) return;
        
        const activeLayer = layerSystem.getActiveLayer();
        
        if (!activeLayer?.layerData || activeLayer.layerData.isBackground) return;
        
        const childrenToRemove = [];
        for (let child of activeLayer.children) {
            if (child !== activeLayer.layerData.backgroundGraphics && 
                child !== activeLayer.layerData.maskSprite) {
                childrenToRemove.push(child);
            }
        }
        
        if (childrenToRemove.length === 0) return;
        
        const history = window.History || historyManager;
        
        if (history && !history.isApplying) {
            const pathsBackup = structuredClone(activeLayer.layerData.paths);
            const childrenBackup = childrenToRemove.map(child => ({
                child: child,
                index: activeLayer.children.indexOf(child)
            }));
            const layerIndex = layerSystem.getLayerIndex(activeLayer);
            const layerId = activeLayer.layerData.id;
            
            const entry = {
                name: 'layer-delete-drawings',
                do: () => {
                    clearLayerDrawings(layerSystem, activeLayer);
                },
                undo: () => {
                    restoreLayerDrawings(layerSystem, activeLayer, pathsBackup, childrenBackup, layerIndex);
                },
                meta: { layerId, childCount: childrenToRemove.length }
            };
            
            history.push(entry);
        } else {
            clearLayerDrawings(layerSystem, activeLayer);
        }
    }

    function clearLayerDrawings(layerSystem, layer) {
        if (!layer?.layerData) return;
        
        const childrenToRemove = [];
        for (let child of layer.children) {
            if (child !== layer.layerData.backgroundGraphics && 
                child !== layer.layerData.maskSprite) {
                childrenToRemove.push(child);
            }
        }
        
        childrenToRemove.forEach((child) => {
            try {
                layer.removeChild(child);
            } catch (error) {}
        });
        
        layer.layerData.paths = [];
        
        const layerIndex = layerSystem.getLayerIndex(layer);
        layerSystem.requestThumbnailUpdate(layerIndex);
        
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
                child !== layer.layerData.maskSprite) {
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
        
        layerSystem.requestThumbnailUpdate(layerIndex);
        
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
