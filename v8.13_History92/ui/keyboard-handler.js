// ui/keyboard-handler.js - 完全版
// 修正: getBrushSettings()の堅牢化（複数経路探索）

window.KeyboardHandler = (function() {
    'use strict';

    let isInitialized = false;
    let vKeyPressed = false;
    
    const dragState = {
        pKeyPressed: false,
        eKeyPressed: false,
        isDragging: false,
        dragStartX: 0,
        dragStartY: 0,
        activeTool: null
    };

    function serializePathsForHistory(paths) {
        return (paths || []).map(p => {
            return {
                id: p.id ?? null,
                type: p.type ?? 'stroke',
                points: (p.points || []).map(pt => ({ 
                    x: pt.x, 
                    y: pt.y, 
                    pressure: pt.pressure ?? 1 
                })),
                size: p.size ?? null,
                brushSize: p.brushSize ?? null,
                color: p.color ?? null,
                opacity: p.opacity ?? null,
                strokeOptions: p.strokeOptions ? {
                    size: p.strokeOptions.size,
                    thinning: p.strokeOptions.thinning,
                    smoothing: p.strokeOptions.smoothing,
                    streamline: p.strokeOptions.streamline
                } : null,
                transform: p.transform ?? null,
                meta: p.meta ?? {}
            };
        });
    }

    function isInputFocused() {
        const activeElement = document.activeElement;
        if (!activeElement) return false;
        
        return (
            activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.isContentEditable
        );
    }

    function getDrawingEngine() {
        return window.drawingApp?.drawingEngine || 
               window.coreEngine?.drawingEngine || 
               window.CoreEngine?.drawingEngine ||
               null;
    }

    function getBrushSettings() {
        const candidates = [
            window.drawingApp?.drawingEngine,
            window.coreEngine?.drawingEngine,
            window.CoreEngine?.drawingEngine,
            window.drawingEngine
        ];
        
        for (const c of candidates) {
            if (!c) continue;
            if (c.settings) return c.settings;
            if (c.getBrushSettings && typeof c.getBrushSettings === 'function') {
                const s = c.getBrushSettings();
                if (s) return s;
            }
        }
        
        if (window.coreEngine && typeof window.coreEngine.getDrawingEngine === 'function') {
            try {
                const de = window.coreEngine.getDrawingEngine();
                if (de?.settings) return de.settings;
            } catch (e) {}
        }
        
        if (window.CoreRuntime?.api) {
            const s = window.CoreRuntime.api.getBrushSettings?.();
            if (s) return s;
        }
        
        return null;
    }

    function handleKeyDown(e) {
        const eventBus = window.TegakiEventBus;
        const keymap = window.TEGAKI_KEYMAP;
        
        if (!eventBus || !keymap) return;
        
        if (isInputFocused()) return;
        
        if (e.code === 'KeyV' && !e.ctrlKey && !e.shiftKey && !e.altKey) {
            vKeyPressed = true;
        }
        
        if (e.code === 'KeyP' && !e.ctrlKey && !e.shiftKey && !e.altKey) {
            if (!dragState.pKeyPressed) {
                dragState.pKeyPressed = true;
                dragState.activeTool = 'pen';
                
                if (window.CoreRuntime?.api) {
                    window.CoreRuntime.api.setTool('pen');
                }
            }
            return;
        }
        
        if (e.code === 'KeyE' && !e.ctrlKey && !e.shiftKey && !e.altKey) {
            if (!dragState.eKeyPressed) {
                dragState.eKeyPressed = true;
                dragState.activeTool = 'eraser';
                
                if (window.CoreRuntime?.api) {
                    window.CoreRuntime.api.setTool('eraser');
                }
            }
            return;
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
            vKeyPressed = false;
        }
        
        if (e.code === 'KeyP') {
            dragState.pKeyPressed = false;
            if (dragState.activeTool === 'pen') {
                dragState.activeTool = null;
            }
        }
        
        if (e.code === 'KeyE') {
            dragState.eKeyPressed = false;
            if (dragState.activeTool === 'eraser') {
                dragState.activeTool = null;
            }
        }
    }

    function handleMouseDown(e) {
        const isKeyPressed = dragState.pKeyPressed || dragState.eKeyPressed;
        
        if (!isKeyPressed) return;
        if (isInputFocused()) return;
        if (dragState.isDragging) return;
        
        dragState.dragStartX = e.clientX;
        dragState.dragStartY = e.clientY;
        
        const brushSettings = getBrushSettings();
        
        if (!brushSettings) {
            return;
        }
        
        let startSize, startOpacity;
        
        try {
            startSize = brushSettings.getBrushSize();
            startOpacity = brushSettings.getBrushOpacity();
        } catch (error) {
            return;
        }
        
        if (window.TegakiEventBus) {
            window.TegakiEventBus.emit('tool:drag-size-start', {
                tool: dragState.activeTool,
                startSize,
                startOpacity
            });
        }
        
        dragState.isDragging = true;
        
        e.preventDefault();
        e.stopPropagation();
    }

    function handleMouseMove(e) {
        if (!dragState.isDragging || !dragState.activeTool) return;
        
        const deltaX = e.clientX - dragState.dragStartX;
        const deltaY = e.clientY - dragState.dragStartY;
        
        if (window.TegakiEventBus) {
            window.TegakiEventBus.emit('tool:drag-size-update', {
                tool: dragState.activeTool,
                deltaX,
                deltaY
            });
        }
        
        e.preventDefault();
        e.stopPropagation();
    }

    function handleMouseUp(e) {
        if (dragState.isDragging) {
            dragState.isDragging = false;
            
            if (window.TegakiEventBus) {
                window.TegakiEventBus.emit('tool:drag-size-end');
            }
            
            e.preventDefault();
            e.stopPropagation();
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
                if (window.CoreRuntime?.api) {
                    window.CoreRuntime.api.setTool('pen');
                }
                event.preventDefault();
                break;
            
            case 'TOOL_ERASER':
                if (window.CoreRuntime?.api) {
                    window.CoreRuntime.api.setTool('eraser');
                }
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
        const layerSystem = window.drawingApp?.layerManager || window.coreEngine?.layerSystem;
        if (!layerSystem) return;
        
        const activeLayer = layerSystem.getActiveLayer();
        if (!activeLayer || !activeLayer.layerData) return;
        
        if (activeLayer.layerData.isBackground) return;
        
        const paths = activeLayer.layerData.paths;
        if (!paths || paths.length === 0) return;
        
        if (window.History && !window.History._manager.isApplying) {
            const pathsBackup = serializePathsForHistory(paths);
            const layerIndex = layerSystem.activeLayerIndex;
            
            const entry = {
                name: 'delete-layer-drawings',
                do: () => {
                    clearLayerDrawings(layerSystem, activeLayer, layerIndex);
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
            clearLayerDrawings(layerSystem, activeLayer, layerSystem.activeLayerIndex);
        }
    }

    function clearLayerDrawings(layerSystem, layer, layerIndex) {
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
        
        layerSystem.requestThumbnailUpdate(layerIndex);
        
        if (layerSystem.animationSystem?.generateCutThumbnailOptimized) {
            const cutIndex = layerSystem.animationSystem.getCurrentCutIndex();
            setTimeout(() => {
                layerSystem.animationSystem.generateCutThumbnailOptimized(cutIndex);
            }, 100);
        }
        
        if (window.TegakiEventBus) {
            window.TegakiEventBus.emit('layer:drawings-deleted', {
                layerId: layer.layerData.id,
                layerIndex: layerIndex
            });
        }
    }

    function restoreLayerDrawings(layerSystem, layer, pathsBackup, layerIndex) {
        if (!layer || !layer.layerData || !pathsBackup) return;
        
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
        
        for (let i = 0; i < pathsBackup.length; i++) {
            const serializedPath = pathsBackup[i];
            
            try {
                const pathData = {
                    id: serializedPath.id,
                    type: serializedPath.type,
                    points: serializedPath.points,
                    size: serializedPath.size,
                    brushSize: serializedPath.brushSize,
                    color: serializedPath.color,
                    opacity: serializedPath.opacity,
                    strokeOptions: serializedPath.strokeOptions,
                    transform: serializedPath.transform,
                    meta: serializedPath.meta
                };
                
                const rebuildSuccess = layerSystem.rebuildPathGraphics(pathData);
                
                if (rebuildSuccess && pathData.graphics) {
                    layer.layerData.paths.push(pathData);
                    layer.addChild(pathData.graphics);
                }
            } catch (error) {
            }
        }
        
        layerSystem.requestThumbnailUpdate(layerIndex);
        
        if (layerSystem.animationSystem?.generateCutThumbnailOptimized) {
            const cutIndex = layerSystem.animationSystem.getCurrentCutIndex();
            setTimeout(() => {
                layerSystem.animationSystem.generateCutThumbnailOptimized(cutIndex);
            }, 100);
        }
        
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
        
        document.addEventListener('mousedown', handleMouseDown, { capture: true });
        document.addEventListener('mousemove', handleMouseMove, { capture: true });
        document.addEventListener('mouseup', handleMouseUp, { capture: true });
        
        isInitialized = true;
        window.KeyboardHandler._isInitialized = true;
    }

    function getShortcutList() {
        return [
            { action: 'UNDO', keys: ['Ctrl+Z'], description: '元に戻す' },
            { action: 'REDO', keys: ['Ctrl+Y', 'Ctrl+Shift+Z'], description: 'やり直し' },
            { action: 'LAYER_DELETE_DRAWINGS', keys: ['Delete', 'Backspace'], description: 'アクティブレイヤーの描画削除' },
            { action: 'LAYER_CLEAR', keys: ['Ctrl+Delete'], description: 'アクティブレイヤークリア' },
            { action: 'LAYER_CREATE', keys: ['Ctrl+L'], description: 'レイヤー追加' },
            { action: 'GIF_CREATE_CUT', keys: ['Ctrl+N'], description: 'カット追加' },
            { action: 'GIF_TOGGLE_TIMELINE', keys: ['Ctrl+T'], description: 'タイムライン表示切替' },
            { action: 'GIF_PLAY_PAUSE', keys: ['Space'], description: '再生/停止（タイムライン表示時）' },
            { action: 'GIF_COPY_CUT', keys: ['Ctrl+D'], description: 'カット複製' },
            { action: 'TOOL_PEN', keys: ['P'], description: 'ペンツール' },
            { action: 'TOOL_ERASER', keys: ['E'], description: '消しゴム' },
            { action: 'PEN_SIZE_OPACITY', keys: ['P+ドラッグ'], description: 'ペンサイズ/透明度調整（左右:サイズ、上下:透明度）' },
            { action: 'ERASER_SIZE_OPACITY', keys: ['E+ドラッグ'], description: '消しゴムサイズ/透明度調整（左右:サイズ、上下:透明度）' },
            { action: 'SETTINGS_OPEN', keys: ['Ctrl+,'], description: '設定を開く' },
            { action: 'LAYER_MOVE_MODE_TOGGLE', keys: ['V'], description: 'レイヤー移動モード切替' }
        ];
    }

    function getDebugState() {
        return {
            pKeyPressed: dragState.pKeyPressed,
            eKeyPressed: dragState.eKeyPressed,
            isDragging: dragState.isDragging,
            activeTool: dragState.activeTool,
            isInitialized: isInitialized,
            drawingEngine: getDrawingEngine(),
            brushSettings: getBrushSettings()
        };
    }

    return {
        init,
        isInputFocused,
        getShortcutList,
        getDebugState,
        _isInitialized: false
    };
})();