// ===== ui/keyboard-handler.js - Phase 6: マスククリア機能追加版 =====
// 改修: Ctrl+Shift+Delete で消しゴムマスクリセット機能追加

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
        
        // Qキーでクイックアクセスポップアップをトグル
        if ((e.key === 'q' || e.key === 'Q') && !e.ctrlKey && !e.shiftKey && !e.altKey) {
            eventBus.emit('ui:toggle-quick-access');
            e.preventDefault();
            return;
        }
        
        // ===== Phase 6: Ctrl+Shift+Delete でマスククリア =====
        if (e.key === 'Delete' && e.ctrlKey && e.shiftKey) {
            clearActiveLayerMask();
            e.preventDefault();
            return;
        }
        
        // Vキー押下をEventBusで通知
        if (e.code === 'KeyV' && !e.ctrlKey && !e.shiftKey && !e.altKey) {
            if (!vKeyPressed) {
                vKeyPressed = true;
                eventBus.emit('keyboard:vkey-pressed', { pressed: true });
            }
        }
        
        if (e.key === 'F5' || e.key === 'F11' || e.key === 'F12') return;
        if (e.key.startsWith('F') && e.key.length <= 3) {
            e.preventDefault();
            return;
        }
        
        const action = keymap.getAction(e, { vMode: vKeyPressed });
        
        if (!action) return;
        
        handleAction(action, e, eventBus);
    }

    function handleKeyUp(e) {
        // Vキー解放をEventBusで通知
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

    function handleAction(action, event, eventBus) {
        switch(action) {
            case 'UNDO':
                if (window.History && window.History.canUndo()) {
                    window.History.undo();
                }
                event.preventDefault();
                break;
                
            case 'REDO':
                if (window.History && window.History.canRedo()) {
                    window.History.redo();
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
            
            case 'LAYER_CREATE':
                if (window.drawingApp?.layerManager) {
                    const layerSystem = window.drawingApp.layerManager;
                    const newLayerIndex = layerSystem.getLayers().length + 1;
                    layerSystem.createLayer(`L${newLayerIndex}`, false);
                    eventBus.emit('layer:created-by-shortcut', { index: newLayerIndex });
                }
                event.preventDefault();
                break;
            
            case 'GIF_CREATE_CUT':
                const animationSystem = window.animationSystem;
                if (animationSystem) {
                    animationSystem.createNewEmptyCut();
                    eventBus.emit('cut:created-by-shortcut');
                }
                event.preventDefault();
                break;
            
            case 'GIF_TOGGLE_TIMELINE':
                eventBus.emit('ui:toggle-timeline');
                event.preventDefault();
                break;
            
            case 'GIF_PLAY_PAUSE':
                const timelineUI = window.timelineUI;
                if (timelineUI && timelineUI.isVisible) {
                    timelineUI.togglePlayStop();
                }
                event.preventDefault();
                break;
            
            case 'GIF_COPY_CUT':
                eventBus.emit('cut:copy-current');
                setTimeout(() => {
                    eventBus.emit('cut:paste-right-adjacent');
                }, 10);
                event.preventDefault();
                break;
            
            case 'TOOL_PEN':
                eventBus.emit('tool:select', { tool: 'pen' });
                event.preventDefault();
                break;
            
            case 'TOOL_ERASER':
                eventBus.emit('tool:select', { tool: 'eraser' });
                event.preventDefault();
                break;
            
            case 'SETTINGS_OPEN':
                if (window.TegakiUI?.uiController) {
                    window.TegakiUI.uiController.closeAllPopups();
                    if (window.TegakiUI.uiController.settingsPopup) {
                        window.TegakiUI.uiController.settingsPopup.show();
                    }
                } else if (window.TegakiUI?.SettingsPopup) {
                    const settingsBtn = document.getElementById('settings-tool');
                    if (settingsBtn) {
                        settingsBtn.click();
                    }
                }
                event.preventDefault();
                break;
        }
    }

    /**
     * ===== Phase 6: アクティブレイヤーのマスククリア =====
     * 消しゴムで消した部分を全復元
     */
    function clearActiveLayerMask() {
        const layerSystem = window.drawingApp?.layerManager;
        if (!layerSystem) return;
        
        const activeLayer = layerSystem.getActiveLayer();
        if (!activeLayer || !activeLayer.layerData) return;
        
        // 背景レイヤーはマスクなし
        if (activeLayer.layerData.isBackground) return;
        
        // マスク存在チェック
        if (!activeLayer.layerData.hasMask()) return;
        
        const config = window.TEGAKI_CONFIG;
        if (!config) return;
        
        const layerData = activeLayer.layerData;
        const eraserRenderer = window.drawingApp?.drawingEngine?.eraserRenderer;
        
        if (!eraserRenderer) return;
        
        // マスク状態のスナップショット取得（Undo用）
        const maskSnapshotBefore = eraserRenderer.captureMaskSnapshot(layerData);
        
        // マスククリア実行
        const success = eraserRenderer.clearMask(
            layerData,
            config.canvas.width,
            config.canvas.height
        );
        
        if (success && maskSnapshotBefore) {
            // マスククリア後のスナップショット取得（Redo用）
            const maskSnapshotAfter = eraserRenderer.captureMaskSnapshot(layerData);
            
            // History記録
            if (window.History && !window.History._manager.isApplying) {
                const entry = {
                    name: 'Clear Mask',
                    do: async () => {
                        await eraserRenderer.restoreMaskSnapshot(layerData, maskSnapshotAfter);
                        layerSystem.requestThumbnailUpdate(layerSystem.activeLayerIndex);
                        if (window.TegakiEventBus) {
                            window.TegakiEventBus.emit('layer:mask-cleared', {
                                layerId: layerData.id
                            });
                        }
                    },
                    undo: async () => {
                        await eraserRenderer.restoreMaskSnapshot(layerData, maskSnapshotBefore);
                        layerSystem.requestThumbnailUpdate(layerSystem.activeLayerIndex);
                        if (window.TegakiEventBus) {
                            window.TegakiEventBus.emit('layer:mask-restored', {
                                layerId: layerData.id
                            });
                        }
                    },
                    meta: {
                        type: 'mask-clear',
                        layerId: layerData.id
                    }
                };
                
                window.History.push(entry);
            }
            
            // サムネイル更新
            layerSystem.requestThumbnailUpdate(layerSystem.activeLayerIndex);
            
            // EventBus通知
            if (window.TegakiEventBus) {
                window.TegakiEventBus.emit('layer:mask-cleared', {
                    layerId: layerData.id
                });
            }
        }
    }

    function deleteActiveLayerDrawings() {
        const layerSystem = window.drawingApp?.layerManager;
        if (!layerSystem) return;
        
        const activeLayer = layerSystem.getActiveLayer();
        if (!activeLayer || !activeLayer.layerData) return;
        
        // 背景レイヤーは削除不可
        if (activeLayer.layerData.isBackground) return;
        
        const paths = activeLayer.layerData.paths;
        if (!paths || paths.length === 0) return;
        
        if (window.History && !window.History._manager.isApplying) {
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

    function clearLayerDrawings(layerSystem, layer) {
        if (!layer || !layer.layerData) return;
        
        const childrenToRemove = [];
        for (let child of layer.children) {
            if (child !== layer.layerData.backgroundGraphics && 
                child !== layer.layerData.maskSprite) { // Phase 6: マスクSprite除外
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

    function restoreLayerDrawings(layerSystem, layer, pathsBackup, layerIndex) {
        if (!layer || !layer.layerData || !pathsBackup) return;
        
        clearLayerDrawings(layerSystem, layer);
        
        layer.layerData.paths = [];
        
        for (let i = 0; i < pathsBackup.length; i++) {
            const pathData = pathsBackup[i];
            
            try {
                const rebuildSuccess = layerSystem.rebuildPathGraphics(pathData);
                
                if (rebuildSuccess && pathData.graphics) {
                    layer.layerData.paths.push(pathData);
                    layer.addChild(pathData.graphics);
                }
            } catch (error) {
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

    function init() {
        if (isInitialized) {
            return;
        }

        document.addEventListener('keydown', handleKeyDown, { capture: true });
        document.addEventListener('keyup', handleKeyUp);
        
        // ウィンドウフォーカス喪失時にVキー状態をリセット
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

    function getShortcutList() {
        return [
            { action: 'UNDO', keys: ['Ctrl+Z'], description: '元に戻す' },
            { action: 'REDO', keys: ['Ctrl+Y', 'Ctrl+Shift+Z'], description: 'やり直し' },
            { action: 'LAYER_DELETE_DRAWINGS', keys: ['Delete', 'Backspace'], description: 'レイヤーの絵を削除' },
            { action: 'LAYER_CLEAR', keys: ['Ctrl+Delete'], description: 'レイヤークリア' },
            { action: 'MASK_CLEAR', keys: ['Ctrl+Shift+Delete'], description: '消しゴムマスククリア' }, // Phase 6追加
            { action: 'LAYER_CREATE', keys: ['Ctrl+L'], description: 'レイヤー追加' },
            { action: 'GIF_CREATE_CUT', keys: ['Ctrl+N'], description: 'カット追加' },
            { action: 'GIF_TOGGLE_TIMELINE', keys: ['Ctrl+T'], description: 'タイムライン表示切替' },
            { action: 'GIF_PLAY_PAUSE', keys: ['Space'], description: '再生/停止' },
            { action: 'GIF_COPY_CUT', keys: ['Ctrl+D'], description: 'カット複製' },
            { action: 'TOOL_PEN', keys: ['P', 'B'], description: 'ペンツール' },
            { action: 'TOOL_ERASER', keys: ['E'], description: '消しゴム' },
            { action: 'SETTINGS_OPEN', keys: ['Ctrl+,'], description: '設定を開く' },
            { action: 'QUICK_ACCESS', keys: ['Q'], description: 'クイックアクセス' },
            { action: 'LAYER_MOVE_MODE', keys: ['V'], description: 'レイヤー移動モード' }
        ];
    }

    return {
        init,
        isInputFocused,
        getShortcutList
    };
})();