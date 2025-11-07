// ===== keyboard-handler.js - 統合版 v2 (DRY/SOLID準拠・二重実装排除) =====

window.KeyboardHandler = (function() {
    'use strict';

    let isInitialized = false;
    let vKeyPressed = false;

    /**
     * 入力フォーカス状態をチェック
     */
    function isInputFocused() {
        const activeElement = document.activeElement;
        if (!activeElement) return false;
        
        return (
            activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.isContentEditable
        );
    }

    /**
     * キーダウンイベントハンドラ
     */
    function handleKeyDown(e) {
        const eventBus = window.TegakiEventBus;
        const keymap = window.TEGAKI_KEYMAP;
        
        if (!eventBus || !keymap) return;
        if (isInputFocused()) return;
        
        // ファンクションキーはブラウザ機能を優先
        if (e.key === 'F5' || e.key === 'F11' || e.key === 'F12') return;
        if (e.key.startsWith('F') && e.key.length <= 3) {
            e.preventDefault();
            return;
        }
        
        // Vキー押下状態の管理
        if (e.code === 'KeyV' && !e.ctrlKey && !e.shiftKey && !e.altKey) {
            if (!vKeyPressed) {
                vKeyPressed = true;
                eventBus.emit('keyboard:vkey-pressed', { pressed: true });
            }
        }
        
        // キーマップからアクション取得
        const action = keymap.getAction(e, { vMode: vKeyPressed });
        if (!action) return;
        
        // ✅ Undo/Redoはcore-engine.jsで処理（二重実装排除）
        if (action === 'UNDO' || action === 'REDO') {
            return; // core-engine.jsに委譲
        }
        
        // アクションを実行
        handleAction(action, e, eventBus);
    }

    /**
     * キーアップイベントハンドラ
     */
    function handleKeyUp(e) {
        if (e.code === 'KeyV') {
            if (vKeyPressed) {
                vKeyPressed = false;
                const eventBus = window.TegakiEventBus;
                if (eventBus) {
                    eventBus.emit('keyboard:vkey-released', { pressed: false });
                }
            }
        }
    }

    /**
     * アクション実行
     */
    function handleAction(action, event, eventBus) {
        switch(action) {
            // === ツール切り替え ===
            case 'TOOL_PEN':
                eventBus.emit('tool:select', { tool: 'pen' });
                eventBus.emit('ui:sidebar:sync-tool', { tool: 'pen' });
                event.preventDefault();
                break;
            
            case 'TOOL_ERASER':
                eventBus.emit('tool:select', { tool: 'eraser' });
                eventBus.emit('ui:sidebar:sync-tool', { tool: 'eraser' });
                event.preventDefault();
                break;
            
            // === レイヤー操作 ===
            case 'LAYER_CREATE':
                if (window.drawingApp?.layerManager) {
                    const layerSystem = window.drawingApp.layerManager;
                    const newLayerIndex = layerSystem.getLayers().length + 1;
                    layerSystem.createLayer(`L${newLayerIndex}`, false);
                    eventBus.emit('layer:created-by-shortcut', { index: newLayerIndex });
                }
                event.preventDefault();
                break;
            
            case 'LAYER_DELETE_DRAWINGS':
                deleteActiveLayerDrawings();
                event.preventDefault();
                break;
            
            case 'LAYER_CLEAR':
                eventBus.emit('layer:clear-active');
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
            
            // === レイヤー移動モード ===
            case 'LAYER_MOVE_MODE_TOGGLE':
                eventBus.emit('layer:toggle-move-mode');
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
                eventBus.emit('layer:flip-by-key', { direction: 'horizontal' });
                event.preventDefault();
                break;
            
            case 'LAYER_FLIP_VERTICAL':
                eventBus.emit('layer:flip-by-key', { direction: 'vertical' });
                event.preventDefault();
                break;
            
            // === レイヤー階層操作 ===
            case 'LAYER_HIERARCHY_UP':
                eventBus.emit('layer:select-next');
                event.preventDefault();
                break;
            
            case 'LAYER_HIERARCHY_DOWN':
                eventBus.emit('layer:select-prev');
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
            
            // === カメラ操作 ===
            case 'CAMERA_FLIP_HORIZONTAL':
                eventBus.emit('camera:flip-horizontal');
                event.preventDefault();
                break;
            
            case 'CAMERA_FLIP_VERTICAL':
                eventBus.emit('camera:flip-vertical');
                event.preventDefault();
                break;
            
            case 'CAMERA_RESET':
                eventBus.emit('camera:reset');
                event.preventDefault();
                break;
            
            // === アニメーション操作 ===
            case 'GIF_PREV_FRAME':
                if (window.timelineUI?.isVisible) {
                    window.timelineUI.goToPreviousCutSafe();
                }
                event.preventDefault();
                break;
            
            case 'GIF_NEXT_FRAME':
                if (window.timelineUI?.isVisible) {
                    window.timelineUI.goToNextCutSafe();
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
                    eventBus.emit('frame:created-by-shortcut');
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
            
            // === UI操作 ===
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
     * アクティブレイヤーの絵を削除
     */
    function deleteActiveLayerDrawings() {
        const layerSystem = window.drawingApp?.layerManager;
        if (!layerSystem) return;
        
        const activeLayer = layerSystem.getActiveLayer();
        if (!activeLayer?.layerData) return;
        if (activeLayer.layerData.isBackground) return;
        
        const paths = activeLayer.layerData.paths;
        if (!paths || paths.length === 0) return;
        
        if (window.History && !window.History._manager?.isApplying) {
            const pathsBackup = structuredClone(paths);
            const layerIndex = layerSystem.activeLayerIndex;
            
            const entry = {
                name: 'layer-delete-drawings',
                do: () => {
                    clearLayerDrawings(layerSystem, activeLayer);
                },
                undo: () => {
                    restoreLayerDrawings(layerSystem, activeLayer, pathsBackup, layerIndex);
                },
                meta: { 
                    layerId: activeLayer.layerData.id,
                    pathCount: pathsBackup.length
                }
            };
            
            window.History.push(entry);
        } else {
            clearLayerDrawings(layerSystem, activeLayer);
        }
    }

    /**
     * レイヤーの絵をクリア
     */
    function clearLayerDrawings(layerSystem, layer) {
        if (!layer?.layerData) return;
        
        const childrenToRemove = [];
        for (let child of layer.children) {
            if (child !== layer.layerData.backgroundGraphics) {
                childrenToRemove.push(child);
            }
        }
        
        childrenToRemove.forEach(child => {
            try {
                layer.removeChild(child);
                if (child.destroy && typeof child.destroy === 'function') {
                    child.destroy({ children: true, texture: false, baseTexture: false });
                }
            } catch (error) {
                // エラーは無視
            }
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

    /**
     * レイヤーの絵を復元
     */
    function restoreLayerDrawings(layerSystem, layer, pathsBackup, layerIndex) {
        if (!layer?.layerData || !pathsBackup) return;
        
        clearLayerDrawings(layerSystem, layer);
        layer.layerData.paths = [];
        
        for (let pathData of pathsBackup) {
            try {
                const rebuildSuccess = layerSystem.rebuildPathGraphics(pathData);
                
                if (rebuildSuccess && pathData.graphics) {
                    layer.layerData.paths.push(pathData);
                    layer.addChild(pathData.graphics);
                }
            } catch (error) {
                // エラーは無視
            }
        }
        
        layerSystem.requestThumbnailUpdate(layerIndex);
        
        if (window.TegakiEventBus) {
            window.TegakiEventBus.emit('layer:drawings-restored', {
                layerId: layer.layerData.id,
                layerIndex: layerIndex,
                pathCount: pathsBackup.length
            });
        }
    }

    /**
     * 初期化
     */
    function init() {
        if (isInitialized) return;

        document.addEventListener('keydown', handleKeyDown, { capture: true });
        document.addEventListener('keyup', handleKeyUp);
        
        window.addEventListener('blur', () => {
            if (vKeyPressed) {
                vKeyPressed = false;
                const eventBus = window.TegakiEventBus;
                if (eventBus) {
                    eventBus.emit('keyboard:vkey-released', { pressed: false });
                }
            }
        });
        
        isInitialized = true;
    }

    /**
     * ショートカットリストを取得
     */
    function getShortcutList() {
        return window.TEGAKI_KEYMAP?.getShortcutList() || [];
    }

    return {
        init,
        isInputFocused,
        getShortcutList
    };
})();

console.log('✅ keyboard-handler.js v2 (二重実装排除・DRY/SOLID準拠) loaded');