// ===== keyboard-handler.js - P/Eサイドバー同期版 =====
// 🔥 改修: P/Eキーでのツール切り替え時、サイドバーのボタンも同期

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
        
        if ((e.key === 'q' || e.key === 'Q') && !e.ctrlKey && !e.shiftKey && !e.altKey) {
            eventBus.emit('ui:toggle-quick-access');
            e.preventDefault();
            return;
        }
        
        if ((e.key === 'e' || e.key === 'E') && e.ctrlKey && !e.shiftKey && !e.altKey) {
            eventBus.emit('ui:toggle-export');
            e.preventDefault();
            return;
        }
        
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
            
            case 'GIF_CREATE_FRAME':
                const animationSystem = window.animationSystem;
                if (animationSystem) {
                    animationSystem.createNewEmptyFrame();
                    eventBus.emit('frame:created-by-shortcut');
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
            
            case 'GIF_COPY_FRAME':
                eventBus.emit('frame:copy-current');
                setTimeout(() => {
                    eventBus.emit('frame:paste-right-adjacent');
                }, 10);
                event.preventDefault();
                break;
            
            // 🔥 改修: ペンツール切り替え時にサイドバー同期イベント発火
            case 'TOOL_PEN':
                eventBus.emit('tool:select', { tool: 'pen' });
                eventBus.emit('ui:sidebar:sync-tool', { tool: 'pen' });
                event.preventDefault();
                break;
            
            // 🔥 改修: 消しゴムツール切り替え時にサイドバー同期イベント発火
            case 'TOOL_ERASER':
                eventBus.emit('tool:select', { tool: 'eraser' });
                eventBus.emit('ui:sidebar:sync-tool', { tool: 'eraser' });
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

    function deleteActiveLayerDrawings() {
        const layerSystem = window.drawingApp?.layerManager;
        if (!layerSystem) return;
        
        const activeLayer = layerSystem.getActiveLayer();
        if (!activeLayer || !activeLayer.layerData) return;
        
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
            { action: 'LAYER_CREATE', keys: ['Ctrl+L'], description: 'レイヤー追加' },
            { action: 'GIF_CREATE_FRAME', keys: ['Ctrl+N'], description: 'フレーム追加' },
            { action: 'GIF_TOGGLE_TIMELINE', keys: ['Ctrl+T'], description: 'タイムライン表示切替' },
            { action: 'GIF_PLAY_PAUSE', keys: ['Space'], description: '再生/停止' },
            { action: 'GIF_COPY_FRAME', keys: ['Ctrl+D'], description: 'フレーム複製' },
            { action: 'TOOL_PEN', keys: ['P', 'B'], description: 'ペンツール' },
            { action: 'TOOL_ERASER', keys: ['E'], description: '消しゴム' },
            { action: 'EXPORT_TOGGLE', keys: ['Ctrl+E'], description: 'エクスポート' },
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

console.log('✅ keyboard-handler.js (P/Eサイドバー同期版) loaded');