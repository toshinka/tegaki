/**
 * @file ui/keyboard-handler.js - Phase 6完成版
 * @description キーボードショートカット処理の中核システム
 * 
 * 【Phase 6 改修内容】
 * ✅ BS/DEL: children配列から直接削除（paths配列に依存しない）
 * ✅ Undo/Redo: childrenの参照を保持して復元
 * 🔧 反転処理: 画像消失問題解決
 * 🧹 デバッグログをクリーンアップ
 * 
 * 【親ファイル (このファイルが依存)】
 * - config.js (window.TEGAKI_KEYMAP)
 * - event-bus.js (window.TegakiEventBus)
 * - history.js (window.History)
 * - core-runtime.js (window.CoreRuntime.api)
 * - layer-system.js (window.layerManager)
 * - drawing-clipboard.js (window.drawingClipboard)
 * - system/drawing/fill-tool.js (FillTool)
 * - timeline-ui.js (window.timelineUI)
 * 
 * 【子ファイル (このファイルに依存)】
 * - core-initializer.js (初期化時にinit呼び出し)
 */

window.KeyboardHandler = (function() {
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
        const eventBus = window.TegakiEventBus;
        const keymap = window.TEGAKI_KEYMAP;
        
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
        
        switch(action) {
            case 'UNDO':
                if (window.History?.canUndo()) {
                    window.History.undo();
                }
                event.preventDefault();
                break;
                
            case 'REDO':
                if (window.History?.canRedo()) {
                    window.History.redo();
                }
                event.preventDefault();
                break;
            
            case 'TOOL_PEN':
                if (api?.tool.set('pen')) {
                    eventBus.emit('ui:sidebar:sync-tool', { tool: 'pen' });
                }
                event.preventDefault();
                break;
            
            case 'TOOL_ERASER':
                if (api?.tool.set('eraser')) {
                    eventBus.emit('ui:sidebar:sync-tool', { tool: 'eraser' });
                }
                event.preventDefault();
                break;
            
            case 'TOOL_FILL':
                if (api?.tool.set('fill')) {
                    eventBus.emit('ui:sidebar:sync-tool', { tool: 'fill' });
                }
                event.preventDefault();
                break;
            
            case 'LAYER_CREATE':
                if (api?.layer.create) {
                    const result = api.layer.create();
                    if (result) {
                        api.layer.setActive(result.index);
                    }
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
                if (isVKeyPressed()) {
                    eventBus.emit('layer:flip-by-key', { direction: 'horizontal' });
                }
                event.preventDefault();
                break;
            
            case 'LAYER_FLIP_VERTICAL':
                if (isVKeyPressed()) {
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

    /**
     * Phase 6完成版: アクティブレイヤーの描画削除
     * children配列から直接削除し、Undo/Redo対応
     */
    function deleteActiveLayerDrawings() {
        const layerSystem = window.drawingApp?.layerManager || window.layerManager;
        
        if (!layerSystem) return;
        
        const activeLayer = layerSystem.getActiveLayer();
        
        if (!activeLayer?.layerData || activeLayer.layerData.isBackground) return;
        
        // 削除対象を特定
        const childrenToRemove = [];
        for (let child of activeLayer.children) {
            if (child !== activeLayer.layerData.backgroundGraphics && 
                child !== activeLayer.layerData.maskSprite) {
                childrenToRemove.push(child);
            }
        }
        
        if (childrenToRemove.length === 0) return;
        
        // History登録（childrenの参照を保持）
        if (window.History && !window.History._manager?.isApplying) {
            const pathsBackup = structuredClone(activeLayer.layerData.paths);
            const childrenBackup = childrenToRemove.map(child => ({
                child: child,
                index: activeLayer.children.indexOf(child)
            }));
            const layerIndex = layerSystem.activeLayerIndex;
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
            
            window.History.push(entry);
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
        
        // 🔧 destroy()を呼ばずにremoveのみ（Undo/Redo用に保持）
        childrenToRemove.forEach((child) => {
            try {
                layer.removeChild(child);
            } catch (error) {}
        });
        
        layer.layerData.paths = [];
        
        layerSystem.requestThumbnailUpdate(layerSystem.activeLayerIndex);
        
        if (window.TegakiEventBus) {
            window.TegakiEventBus.emit('layer:drawings-deleted', {
                layerId: layer.layerData.id,
                layerIndex: layerSystem.activeLayerIndex
            });
        }
    }

    function restoreLayerDrawings(layerSystem, layer, pathsBackup, childrenBackup, layerIndex) {
        if (!layer?.layerData) return;
        
        // まず現在のchildrenをクリア（destroyはしない - 復元するため）
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
        
        // pathsを復元
        layer.layerData.paths = structuredClone(pathsBackup);
        
        // childrenを復元（インデックス順）
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
        
        if (window.TegakiEventBus) {
            window.TegakiEventBus.emit('layer:drawings-restored', {
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
        
        // window blur時にVキー状態をリセット
        window.addEventListener('blur', () => {
            if (vKeyPressed) {
                vKeyPressed = false;
                const eventBus = window.TegakiEventBus;
                if (eventBus) {
                    eventBus.emit('keyboard:vkey-state-changed', { pressed: false });
                }
            }
        });
        
        isInitialized = true;
    }

    function getShortcutList() {
        return window.TEGAKI_KEYMAP?.getShortcutList() || [];
    }
    
    function isVKeyPressed() {
        return vKeyPressed;
    }
    
    function setVKeyPressed(state) {
        if (vKeyPressed !== state) {
            vKeyPressed = state;
            const eventBus = window.TegakiEventBus;
            if (eventBus) {
                eventBus.emit('keyboard:vkey-state-changed', { pressed: vKeyPressed });
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

console.log('✅ keyboard-handler.js Phase 6完成版 loaded');
console.log('   ✅ BS/DEL: 描画削除が正常動作');
console.log('   ✅ Undo/Redo: children参照保持で完全復元');
console.log('   🔧 反転処理: 画像消失問題解決');