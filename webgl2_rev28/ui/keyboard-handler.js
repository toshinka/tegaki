/**
 * @file ui/keyboard-handler.js - Phase C-2.1: Undo完全修正版
 * @description キーボードショートカット処理の中核システム
 * 
 * 【Phase C-2.1 改修内容】
 * ✅ アンドゥ2回分消える問題を完全修正
 * ✅ paths/children の状態を完全スナップショット化
 * ✅ History連携の参照問題を解消
 * ✅ PixiJSオブジェクトは参照保持、データはディープコピー
 * 
 * 【親ファイル (このファイルが依存)】
 * - config.js (window.TEGAKI_KEYMAP)
 * - event-bus.js (window.TegakiEventBus)
 * - history.js (window.History)
 * - core-runtime.js (window.CoreRuntime.api)
 * - layer-system.js (window.layerManager)
 * - drawing-clipboard.js (window.drawingClipboard)
 * - fill-tool.js (FillTool)
 * - timeline-ui.js (window.timelineUI)
 * - popup-manager.js (window.PopupManager)
 * - data-models.js (StrokeData.toJSON)
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
     * Phase C-2.1: 状態のディープコピー（PixiJS除く）
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
                    // toJSON()のみ使用（JSON.stringify回避）
                    return strokeData.toJSON();
                }
                // フォールバック: 手動でプロパティをコピー
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

        // children の参照とインデックスを保存（PixiJSオブジェクトは参照のみ）
        for (let i = 0; i < layer.children.length; i++) {
            const child = layer.children[i];
            if (child !== layer.layerData.backgroundGraphics && 
                child !== layer.layerData.maskSprite) {
                snapshot.children.push({
                    child: child,  // PixiJSオブジェクトは参照保持
                    index: i
                });
            }
        }

        return snapshot;
    }

    /**
     * Phase C-2.1: アクティブレイヤーの描画削除（完全修正版）
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
        
        const layerIndex = layerSystem.activeLayerIndex;
        const layerId = activeLayer.layerData.id;
        
        // Phase C-2.1: 状態の完全スナップショット作成（削除前）
        const beforeState = createLayerStateSnapshot(activeLayer);
        
        if (!beforeState) {
            console.error('[KeyboardHandler] Failed to create state snapshot');
            return;
        }
        
        // History登録（do()は実行しない、手動で削除してからpush）
        if (window.History && !window.History._manager?.isApplying) {
            // 先に削除を実行
            clearLayerDrawings(layerSystem, activeLayer, layerIndex);
            
            // 削除後の状態でHistory登録（do()は何もしない）
            const entry = {
                name: 'layer-delete-drawings',
                do: () => {
                    // 既に削除済みなので何もしない
                    // Redo時のために現在の状態を保存
                    const layer = layerSystem.getActiveLayer();
                    if (layer && layer.layerData.id === layerId) {
                        clearLayerDrawings(layerSystem, layer, layerIndex);
                    }
                },
                undo: () => {
                    const layer = layerSystem.getActiveLayer();
                    if (layer && layer.layerData.id === layerId && beforeState) {
                        restoreLayerState(layerSystem, layer, beforeState, layerIndex);
                    } else {
                        console.warn('[KeyboardHandler] Cannot restore: layer changed or not found');
                    }
                },
                meta: { 
                    layerId, 
                    layerIndex,
                    childCount: childrenToRemove.length,
                    pathCount: beforeState.paths?.length || 0
                }
            };
            
            // History.push()は内部でdo()を呼ぶが、既に削除済みなので問題なし
            window.History.push(entry);
        } else {
            clearLayerDrawings(layerSystem, activeLayer, layerIndex);
        }
    }

    /**
     * Phase C-2.1: レイヤーを安全に取得（削除版）
     */
    function getLayerByIdSafe(layerSystem, layerId, fallbackIndex) {
        // この関数は使用しないが、互換性のため残す
        return null;
    }

    /**
     * Phase C-2.1: レイヤー描画削除実行
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
        
        // paths を空配列に設定
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
     * Phase C-2.1: レイヤー状態復元（完全版）
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
        
        // paths を復元（StrokeDataインスタンス再構築）
        if (snapshot.paths && Array.isArray(snapshot.paths)) {
            const StrokeDataClass = window.StrokeData;
            
            if (StrokeDataClass && typeof StrokeDataClass.fromJSON === 'function') {
                // fromJSON を使用（推奨）
                layer.layerData.paths = snapshot.paths.map(pathData => {
                    try {
                        return StrokeDataClass.fromJSON(pathData);
                    } catch (error) {
                        console.error('[KeyboardHandler] Failed to restore stroke with fromJSON:', error);
                        // フォールバック: 新規インスタンス作成
                        const stroke = new StrokeDataClass();
                        Object.assign(stroke, pathData);
                        return stroke;
                    }
                });
            } else if (StrokeDataClass) {
                // fromJSON がない場合: 新規インスタンス作成
                layer.layerData.paths = snapshot.paths.map(pathData => {
                    try {
                        const stroke = new StrokeDataClass();
                        Object.assign(stroke, pathData);
                        return stroke;
                    } catch (error) {
                        console.error('[KeyboardHandler] Failed to create StrokeData:', error);
                        return pathData;  // 最終フォールバック
                    }
                });
            } else {
                // StrokeDataが無い場合: プレーンオブジェクトとして復元
                layer.layerData.paths = snapshot.paths.map(pathData => ({ ...pathData }));
            }
        } else {
            layer.layerData.paths = [];
        }
        
        // children を復元（PixiJSオブジェクト参照を使用）
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
                    console.warn('[KeyboardHandler] Failed to restore child:', error);
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

console.log('✅ keyboard-handler.js Phase C-2.1 loaded (Undo完全修正版)');
console.log('   ✅ DEL/BS実行タイミング修正（History.push前に削除）');
console.log('   ✅ レイヤーID参照問題解消');
console.log('   ✅ 2回分消える問題を完全修正');
console.log('   ✅ JSON.stringify 循環参照エラー解消');