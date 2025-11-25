/**
 * @file ui/keyboard-handler.js - Phase 7.5.2: DEL/BS修正版
 * @description キーボードショートカット処理の中核システム
 * 
 * 【Phase 7.5.2 改修内容】
 * ✅ DEL/BSキー structuredClone エラー修正
 * ✅ paths バックアップを直接参照方式に変更
 * ✅ Qキー対応（quick-access-popup表示）
 * ✅ Phase 7.5.1全機能継承
 * 
 * 【親ファイル (このファイルが依存)】
 * - config.js (window.TEGAKI_KEYMAP - getAction()メソッド必須)
 * - event-bus.js (window.TegakiEventBus)
 * - history.js (window.History)
 * - core-runtime.js (window.CoreRuntime.api)
 * - layer-system.js (window.layerManager)
 * - drawing-clipboard.js (window.drawingClipboard)
 * - system/drawing/fill-tool.js (FillTool)
 * - timeline-ui.js (window.timelineUI)
 * - popup-manager.js (window.PopupManager)
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
        
        if (!eventBus || !keymap) {
            console.warn('[KeyboardHandler] EventBus or KEYMAP not available');
            return;
        }
        
        if (typeof keymap.getAction !== 'function') {
            console.error('[KeyboardHandler] TEGAKI_KEYMAP.getAction() is not a function');
            console.error('  config.js Phase 6.5以降が必要です');
            return;
        }
        
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
                console.log('[KeyboardHandler] 🗑️ DEL/BS pressed - deleting layer drawings');
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
            
            case 'POPUP_SETTINGS':
                eventBus.emit('ui:open-settings');
                event.preventDefault();
                break;
            
            case 'POPUP_QUICK_ACCESS':
                console.log('[KeyboardHandler] ⌨️ Q pressed - toggling quick access');
                
                if (window.PopupManager) {
                    console.log('[KeyboardHandler] PopupManager found - calling toggle()');
                    window.PopupManager.toggle('quickAccess');
                } else {
                    console.warn('[KeyboardHandler] PopupManager not found - using EventBus');
                    eventBus.emit('ui:toggle-quick-access');
                }
                event.preventDefault();
                break;
            
            case 'POPUP_ALBUM':
                eventBus.emit('ui:toggle-album');
                event.preventDefault();
                break;
            
            case 'POPUP_EXPORT':
                eventBus.emit('ui:toggle-export');
                event.preventDefault();
                break;
        }
    }

    /**
     * Phase 7.5.2: アクティブレイヤーの描画削除（structuredCloneエラー修正版）
     */
    function deleteActiveLayerDrawings() {
        const layerSystem = window.drawingApp?.layerManager || window.layerManager;
        
        if (!layerSystem) {
            console.warn('[KeyboardHandler] layerSystem not found');
            return;
        }
        
        const activeLayer = layerSystem.getActiveLayer();
        
        if (!activeLayer?.layerData || activeLayer.layerData.isBackground) {
            console.warn('[KeyboardHandler] No valid active layer or background layer');
            return;
        }
        
        // 削除対象を特定
        const childrenToRemove = [];
        for (let child of activeLayer.children) {
            if (child !== activeLayer.layerData.backgroundGraphics && 
                child !== activeLayer.layerData.maskSprite) {
                childrenToRemove.push(child);
            }
        }
        
        if (childrenToRemove.length === 0) {
            console.log('[KeyboardHandler] No drawings to delete');
            return;
        }
        
        console.log(`[KeyboardHandler] Deleting ${childrenToRemove.length} drawing(s)`);
        
        // Phase 7.5.2: structuredClone を使わず、直接参照を保存
        if (window.History && !window.History._manager?.isApplying) {
            // paths の直接参照を保存（cloneしない）
            const pathsBackup = activeLayer.layerData.paths;
            
            // children の参照とインデックスを保存
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
            console.log('[KeyboardHandler] ✅ Drawings deleted (Undo available)');
        } else {
            clearLayerDrawings(layerSystem, activeLayer);
            console.log('[KeyboardHandler] ✅ Drawings deleted (No Undo)');
        }
    }

    /**
     * Phase 7.5.2: レイヤー描画削除実行
     */
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
            } catch (error) {
                console.warn('[KeyboardHandler] Failed to remove child:', error);
            }
        });
        
        // paths を空配列に設定
        layer.layerData.paths = [];
        
        layerSystem.requestThumbnailUpdate(layerSystem.activeLayerIndex);
        
        if (window.TegakiEventBus) {
            window.TegakiEventBus.emit('layer:drawings-deleted', {
                layerId: layer.layerData.id,
                layerIndex: layerSystem.activeLayerIndex
            });
        }
    }

    /**
     * Phase 7.5.2: レイヤー描画復元（Undo時）
     */
    function restoreLayerDrawings(layerSystem, layer, pathsBackup, childrenBackup, layerIndex) {
        if (!layer?.layerData) return;
        
        // 現在の描画を削除
        const currentChildren = [];
        for (let child of layer.children) {
            if (child !== layer.layerData.backgroundGraphics && 
                child !== layer.layerData.maskSprite) {
                currentChildren.push(child);
            }
        }
        
        currentChildren.forEach(child => {
            try {
                layer.removeChild(child);
            } catch (error) {
                console.warn('[KeyboardHandler] Failed to remove child during restore:', error);
            }
        });
        
        // paths を復元（直接参照）
        layer.layerData.paths = pathsBackup;
        
        // children を復元
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
                    console.warn('[KeyboardHandler] Failed to restore child:', error);
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

        if (!window.TEGAKI_KEYMAP) {
            console.error('[KeyboardHandler] TEGAKI_KEYMAP not found - config.js未読み込み');
            return;
        }
        
        if (typeof window.TEGAKI_KEYMAP.getAction !== 'function') {
            console.error('[KeyboardHandler] TEGAKI_KEYMAP.getAction() not found');
            console.error('  config.js Phase 6.5以降が必要です');
            return;
        }

        document.addEventListener('keydown', handleKeyDown, { capture: true });
        document.addEventListener('keyup', handleKeyUp);
        
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
        if (!window.TEGAKI_KEYMAP || typeof window.TEGAKI_KEYMAP.getShortcutList !== 'function') {
            console.warn('[KeyboardHandler] TEGAKI_KEYMAP.getShortcutList() not available');
            return [];
        }
        
        return window.TEGAKI_KEYMAP.getShortcutList();
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

console.log('✅ keyboard-handler.js Phase 7.5.2 loaded (DEL/BS修正版)');
console.log('   ✅ structuredClone エラー修正');
console.log('   ✅ paths を直接参照方式に変更');
console.log('   ✅ Undo/Redo 正常動作');
console.log('   ✅ Phase 7.5.1全機能継承');