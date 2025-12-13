/**
 * @file ui/keyboard-handler.js - Phase C-2.2: 二重登録完全修正版
 * @description キーボードショートカット処理の中核システム
 * 
 * 【Phase C-2.2 改修内容】
 * ✅ アンドゥ2回分消える問題を完全修正
 * ✅ History.push()の二重実行を解消
 * ✅ window.historyManager.register()を使用（do実行なし）
 * 
 * 【親ファイル (このファイルが依存)】
 * - config.js (window.TEGAKI_KEYMAP)
 * - event-bus.js (window.TegakiEventBus)
 * - history.js (window.historyManager)
 * - core-runtime.js (window.CoreRuntime.api)
 * - layer-system.js (window.layerManager)
 * - drawing-clipboard.js (window.drawingClipboard)
 * - data-models.js (StrokeData.toJSON/fromJSON)
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
        
        if (typeof keymap.getAction !== 'function') {
            console.error('[KeyboardHandler] TEGAKI_KEYMAP.getAction() not found');
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
                if (window.historyManager?.canUndo()) {
                    window.historyManager.undo();
                }
                event.preventDefault();
                break;
                
            case 'REDO':
                if (window.historyManager?.canRedo()) {
                    window.historyManager.redo();
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
            
            case 'POPUP_SETTINGS':
                eventBus.emit('ui:open-settings');
                event.preventDefault();
                break;
            
            case 'POPUP_QUICK_ACCESS':
                if (window.PopupManager) {
                    window.PopupManager.toggle('quickAccess');
                } else {
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
     * Phase C-2.2: 状態のディープコピー（PixiJS除く）
     */
    function createLayerStateSnapshot(layer) {
        if (!layer?.layerData) return null;

        const snapshot = {
            layerId: layer.layerData.id,
            paths: null,
            children: []
        };

        // paths のディープコピー（StrokeData.toJSON利用）
        if (layer.layerData.paths && Array.isArray(layer.layerData.paths)) {
            snapshot.paths = layer.layerData.paths.map(strokeData => {
                if (strokeData && typeof strokeData.toJSON === 'function') {
                    return strokeData.toJSON();
                }
                return {
                    id: strokeData.id,
                    points: strokeData.points ? [...strokeData.points] : [],
                    color: strokeData.color,
                    size: strokeData.size,
                    opacity: strokeData.opacity,
                    blendMode: strokeData.blendMode,
                    timestamp: strokeData.timestamp
                };
            });
        } else {
            snapshot.paths = [];
        }

        // children の参照とインデックスを保存
        for (let i = 0; i < layer.children.length; i++) {
            const child = layer.children[i];
            if (child !== layer.layerData.backgroundGraphics && 
                child !== layer.layerData.maskSprite) {
                snapshot.children.push({
                    child: child,
                    index: i
                });
            }
        }

        return snapshot;
    }

    /**
     * 🚨 Phase C-2.2: 二重登録完全修正版
     * アクティブレイヤーの描画削除
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
        
        const childrenToRemove = [];
        for (let child of activeLayer.children) {
            if (child !== activeLayer.layerData.backgroundGraphics && 
                child !== activeLayer.layerData.maskSprite) {
                childrenToRemove.push(child);
            }
        }
        
        if (childrenToRemove.length === 0) {
            return;
        }
        
        const layerIndex = layerSystem.activeLayerIndex;
        const layerId = activeLayer.layerData.id;
        
        // 削除前の状態をスナップショット
        const beforeState = createLayerStateSnapshot(activeLayer);
        
        if (!beforeState) {
            console.error('[KeyboardHandler] Failed to create state snapshot');
            return;
        }
        
        // 🚨 Phase C-2.2修正: window.historyManager?.isApplying チェック
        const historyManager = window.historyManager || window.History;
        
        if (historyManager && !historyManager.isApplying) {
            // History登録（do実行なし）
            const entry = {
                name: 'layer-delete-drawings',
                do: () => {
                    const layer = layerSystem.getActiveLayer();
                    if (layer && layer.layerData.id === layerId) {
                        clearLayerDrawings(layerSystem, layer, layerIndex);
                    }
                },
                undo: () => {
                    const layer = layerSystem.getActiveLayer();
                    if (layer && layer.layerData.id === layerId && beforeState) {
                        restoreLayerState(layerSystem, layer, beforeState, layerIndex);
                    }
                },
                meta: { 
                    layerId, 
                    layerIndex,
                    childCount: childrenToRemove.length,
                    pathCount: beforeState.paths?.length || 0
                }
            };
            
            // 🚨 Phase C-2.2修正: register() でdo()を実行せずに登録
            if (typeof historyManager.register === 'function') {
                historyManager.register(entry);
                // register後に手動でdo()を実行
                entry.do();
            } else {
                // フォールバック: 従来の push() を使用
                // 先に削除を実行してから push
                clearLayerDrawings(layerSystem, activeLayer, layerIndex);
                historyManager.push(entry);
            }
        } else {
            // History無効時は直接削除
            clearLayerDrawings(layerSystem, activeLayer, layerIndex);
        }
    }

    /**
     * Phase C-2.2: レイヤー描画削除実行
     */
    function clearLayerDrawings(layerSystem, layer, layerIndex) {
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
        
        layer.layerData.paths = [];
        
        layerSystem.requestThumbnailUpdate(layerIndex);
        
        if (window.TegakiEventBus) {
            window.TegakiEventBus.emit('layer:drawings-deleted', {
                layerId: layer.layerData.id,
                layerIndex: layerIndex
            });
        }
    }

    /**
     * Phase C-2.2: レイヤー状態復元
     */
    function restoreLayerState(layerSystem, layer, snapshot, layerIndex) {
        if (!layer?.layerData || !snapshot) {
            console.error('[KeyboardHandler] Invalid layer or snapshot for restore');
            return;
        }
        
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
        
        // paths を復元
        if (snapshot.paths && Array.isArray(snapshot.paths)) {
            const StrokeDataClass = window.StrokeData;
            
            if (StrokeDataClass && typeof StrokeDataClass.fromJSON === 'function') {
                layer.layerData.paths = snapshot.paths.map(pathData => {
                    try {
                        return StrokeDataClass.fromJSON(pathData);
                    } catch (error) {
                        const stroke = new StrokeDataClass();
                        Object.assign(stroke, pathData);
                        return stroke;
                    }
                });
            } else if (StrokeDataClass) {
                layer.layerData.paths = snapshot.paths.map(pathData => {
                    try {
                        const stroke = new StrokeDataClass();
                        Object.assign(stroke, pathData);
                        return stroke;
                    } catch (error) {
                        return pathData;
                    }
                });
            } else {
                layer.layerData.paths = snapshot.paths.map(pathData => ({ ...pathData }));
            }
        } else {
            layer.layerData.paths = [];
        }
        
        // children を復元
        if (snapshot.children && snapshot.children.length > 0) {
            snapshot.children.sort((a, b) => a.index - b.index);
            snapshot.children.forEach(({ child, index }) => {
                try {
                    if (index >= 0 && index < layer.children.length) {
                        layer.addChildAt(child, index);
                    } else {
                        layer.addChild(child);
                    }
                } catch (error) {
                    try {
                        layer.addChild(child);
                    } catch (e) {
                        console.error('[KeyboardHandler] Completely failed to restore child:', e);
                    }
                }
            });
        }
        
        layerSystem.requestThumbnailUpdate(layerIndex);
        
        if (window.TegakiEventBus) {
            window.TegakiEventBus.emit('layer:drawings-restored', {
                layerId: layer.layerData.id,
                layerIndex: layerIndex,
                childCount: snapshot.children?.length || 0,
                pathCount: snapshot.paths?.length || 0
            });
        }
    }

    function init() {
        if (isInitialized) return;

        if (!window.TEGAKI_KEYMAP) {
            console.error('[KeyboardHandler] TEGAKI_KEYMAP not found');
            return;
        }
        
        if (typeof window.TEGAKI_KEYMAP.getAction !== 'function') {
            console.error('[KeyboardHandler] TEGAKI_KEYMAP.getAction() not found');
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

console.log('✅ keyboard-handler.js Phase C-2.2 loaded');
console.log('   🔧 二重登録完全修正: historyManager.register() 使用');