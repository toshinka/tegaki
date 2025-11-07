// ===== keyboard-handler.js - config.js完全整合版 =====

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
        
        // クイックアクセス (Q)
        if ((e.key === 'q' || e.key === 'Q') && !e.ctrlKey && !e.shiftKey && !e.altKey) {
            eventBus.emit('ui:toggle-quick-access');
            e.preventDefault();
            return;
        }
        
        // エクスポート (Ctrl+E)
        if ((e.key === 'e' || e.key === 'E') && e.ctrlKey && !e.shiftKey && !e.altKey) {
            eventBus.emit('ui:toggle-export');
            e.preventDefault();
            return;
        }
        
        // Vキー（レイヤー移動モード）
        if (e.code === 'KeyV' && !e.ctrlKey && !e.shiftKey && !e.altKey) {
            if (!vKeyPressed) {
                vKeyPressed = true;
                eventBus.emit('keyboard:vkey-pressed', { pressed: true });
            }
        }
        
        // ファンクションキー
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
            // ===== 基本操作 =====
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
            
            // ===== ツール切り替え =====
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
            
            // ===== レイヤー操作 =====
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
            
            case 'LAYER_COPY':
                eventBus.emit('layer:copy');
                event.preventDefault();
                break;
            
            case 'LAYER_PASTE':
                eventBus.emit('layer:paste');
                event.preventDefault();
                break;
            
            case 'LAYER_HIERARCHY_UP':
                if (window.drawingApp?.layerManager) {
                    const layerSystem = window.drawingApp.layerManager;
                    const currentIndex = layerSystem.activeLayerIndex;
                    if (currentIndex < layerSystem.getLayers().length - 1) {
                        layerSystem.setActiveLayer(currentIndex + 1);
                    }
                }
                event.preventDefault();
                break;
            
            case 'LAYER_HIERARCHY_DOWN':
                if (window.drawingApp?.layerManager) {
                    const layerSystem = window.drawingApp.layerManager;
                    const currentIndex = layerSystem.activeLayerIndex;
                    if (currentIndex > 0) {
                        layerSystem.setActiveLayer(currentIndex - 1);
                    }
                }
                event.preventDefault();
                break;
            
            // ===== レイヤー移動（Vモード） =====
            case 'LAYER_MOVE_UP':
                eventBus.emit('layer:move', { direction: 'up' });
                event.preventDefault();
                break;
            
            case 'LAYER_MOVE_DOWN':
                eventBus.emit('layer:move', { direction: 'down' });
                event.preventDefault();
                break;
            
            case 'LAYER_MOVE_LEFT':
                eventBus.emit('layer:move', { direction: 'left' });
                event.preventDefault();
                break;
            
            case 'LAYER_MOVE_RIGHT':
                eventBus.emit('layer:move', { direction: 'right' });
                event.preventDefault();
                break;
            
            // ===== レイヤー拡大縮小（V+Shiftモード） =====
            case 'LAYER_SCALE_UP':
                eventBus.emit('layer:scale', { direction: 'up' });
                event.preventDefault();
                break;
            
            case 'LAYER_SCALE_DOWN':
                eventBus.emit('layer:scale', { direction: 'down' });
                event.preventDefault();
                break;
            
            // ===== レイヤー回転（V+Shiftモード） =====
            case 'LAYER_ROTATE_LEFT':
                eventBus.emit('layer:rotate', { direction: 'left' });
                event.preventDefault();
                break;
            
            case 'LAYER_ROTATE_RIGHT':
                eventBus.emit('layer:rotate', { direction: 'right' });
                event.preventDefault();
                break;
            
            // ===== レイヤー反転（Vモード） =====
            case 'LAYER_FLIP_HORIZONTAL':
                eventBus.emit('layer:flip', { axis: 'horizontal' });
                event.preventDefault();
                break;
            
            case 'LAYER_FLIP_VERTICAL':
                eventBus.emit('layer:flip', { axis: 'vertical' });
                event.preventDefault();
                break;
            
            // ===== カメラ反転 =====
            case 'CAMERA_FLIP_HORIZONTAL':
                // camera-system.jsで既に実装済み
                event.preventDefault();
                break;
            
            case 'CAMERA_FLIP_VERTICAL':
                // camera-system.jsで既に実装済み
                event.preventDefault();
                break;
            
            // ===== アニメーション操作 =====
            case 'GIF_PREV_FRAME':
                if (window.timelineUI && window.timelineUI.isVisible) {
                    eventBus.emit('frame:navigate', { direction: 'prev' });
                }
                event.preventDefault();
                break;
            
            case 'GIF_NEXT_FRAME':
                if (window.timelineUI && window.timelineUI.isVisible) {
                    eventBus.emit('frame:navigate', { direction: 'next' });
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
            
            // ===== 設定 =====
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
        const keymap = window.TEGAKI_KEYMAP;
        if (!keymap || !keymap.actions) {
            return [];
        }

        const shortcuts = [];
        for (const [actionName, config] of Object.entries(keymap.actions)) {
            const configs = Array.isArray(config) ? config : [config];
            const keys = configs.map(cfg => {
                let keyStr = keymap.getKeyDisplayName(cfg.key);
                if (cfg.ctrl) keyStr = 'Ctrl+' + keyStr;
                if (cfg.shift) keyStr = 'Shift+' + keyStr;
                if (cfg.alt) keyStr = 'Alt+' + keyStr;
                if (cfg.vMode) keyStr = 'V+' + keyStr;
                return keyStr;
            });
            
            shortcuts.push({
                action: actionName,
                keys: keys,
                description: configs[0].description || actionName
            });
        }
        
        return shortcuts;
    }

    return {
        init,
        isInputFocused,
        getShortcutList
    };
})();

console.log('✅ keyboard-handler.js (config.js完全整合版) loaded');