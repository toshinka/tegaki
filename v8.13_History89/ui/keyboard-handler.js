// ===== ui/keyboard-handler.js - P/E+ドラッグ対応完全版 =====

window.KeyboardHandler = (function() {
    'use strict';

    let isInitialized = false;
    let vKeyPressed = false;
    
    // P/Eキードラッグモード用の状態管理
    const dragState = {
        pKeyPressed: false,
        eKeyPressed: false,
        isDragging: false,
        dragStartX: 0,
        dragStartY: 0,
        activeTool: null // 'pen' or 'eraser'
    };

    // 入力要素にフォーカスがあるかチェック
    function isInputFocused() {
        const activeElement = document.activeElement;
        if (!activeElement) return false;
        
        return (
            activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.isContentEditable
        );
    }

    // DrawingEngine取得（複数のパスを試行）
    function getDrawingEngine() {
        return window.drawingApp?.drawingEngine || 
               window.coreEngine?.drawingEngine || 
               window.CoreEngine?.drawingEngine ||
               null;
    }

    // BrushSettings取得
    function getBrushSettings() {
        const de = getDrawingEngine();
        if (!de) {
            console.error('❌ DrawingEngine not found');
            return null;
        }
        
        if (!de.settings) {
            console.error('❌ DrawingEngine.settings is undefined');
            return null;
        }
        
        return de.settings;
    }

    // キーボードイベントハンドラー
    function handleKeyDown(e) {
        const eventBus = window.TegakiEventBus;
        const keymap = window.TEGAKI_KEYMAP;
        
        if (!eventBus || !keymap) return;
        
        // 入力フィールド内では処理しない
        if (isInputFocused()) return;
        
        // Vキー状態を追跡
        if (e.code === 'KeyV' && !e.ctrlKey && !e.shiftKey && !e.altKey) {
            vKeyPressed = true;
        }
        
        // Pキー押しっぱなし検出（修飾キーなし）
        if (e.code === 'KeyP' && !e.ctrlKey && !e.shiftKey && !e.altKey) {
            if (!dragState.pKeyPressed) {
                dragState.pKeyPressed = true;
                dragState.activeTool = 'pen';
                
                // ツール切り替え（ドラッグ開始前）
                if (window.CoreRuntime?.api) {
                    window.CoreRuntime.api.setTool('pen');
                }
            }
            return;
        }
        
        // Eキー押しっぱなし検出（修飾キーなし）
        if (e.code === 'KeyE' && !e.ctrlKey && !e.shiftKey && !e.altKey) {
            if (!dragState.eKeyPressed) {
                dragState.eKeyPressed = true;
                dragState.activeTool = 'eraser';
                
                // ツール切り替え（ドラッグ開始前）
                if (window.CoreRuntime?.api) {
                    window.CoreRuntime.api.setTool('eraser');
                }
            }
            return;
        }
        
        // ブラウザデフォルト動作を防止（F5, F11, F12以外）
        if (e.key === 'F5' || e.key === 'F11' || e.key === 'F12') return;
        if (e.key.startsWith('F') && e.key.length <= 3) {
            e.preventDefault();
            return;
        }
        
        // config.jsのキーマップでアクション解決
        const action = keymap.getAction(e, { vMode: vKeyPressed });
        
        if (!action) return;
        
        // アクション処理
        handleAction(action, e, eventBus);
    }

    // KeyUpイベントでキーをリリース
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

    // マウスダウンイベント（ドラッグ開始）
    function handleMouseDown(e) {
        const isKeyPressed = dragState.pKeyPressed || dragState.eKeyPressed;
        
        if (!isKeyPressed) return;
        if (isInputFocused()) return;
        if (dragState.isDragging) return;
        
        // ドラッグ開始位置を記録
        dragState.dragStartX = e.clientX;
        dragState.dragStartY = e.clientY;
        
        // BrushSettings取得
        const brushSettings = getBrushSettings();
        
        if (!brushSettings) {
            return;
        }
        
        // 現在のサイズと透明度を取得
        let startSize, startOpacity;
        
        try {
            startSize = brushSettings.getBrushSize();
            startOpacity = brushSettings.getBrushOpacity();
        } catch (error) {
            console.error('❌ Failed to get brush settings:', error);
            return;
        }
        
        // ToolSizeManagerにドラッグ開始を通知
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

    // マウス移動イベント（ドラッグ中）
    function handleMouseMove(e) {
        if (!dragState.isDragging || !dragState.activeTool) return;
        
        const deltaX = e.clientX - dragState.dragStartX;
        const deltaY = e.clientY - dragState.dragStartY;
        
        // ToolSizeManagerにドラッグ更新を通知
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

    // マウスアップイベント（ドラッグ終了）
    function handleMouseUp(e) {
        if (dragState.isDragging) {
            dragState.isDragging = false;
            
            // ToolSizeManagerにドラッグ終了を通知
            if (window.TegakiEventBus) {
                window.TegakiEventBus.emit('tool:drag-size-end');
            }
            
            e.preventDefault();
            e.stopPropagation();
        }
    }

    // アクション処理
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

    // アクティブレイヤーの描画を削除（History統合）
    function deleteActiveLayerDrawings() {
        const layerSystem = window.drawingApp?.layerManager || window.coreEngine?.layerSystem;
        if (!layerSystem) return;
        
        const activeLayer = layerSystem.getActiveLayer();
        if (!activeLayer || !activeLayer.layerData) return;
        
        // 背景レイヤーは削除不可
        if (activeLayer.layerData.isBackground) return;
        
        const paths = activeLayer.layerData.paths;
        if (!paths || paths.length === 0) return;
        
        // History対応
        if (window.History && !window.History._manager.isApplying) {
            const pathsBackup = structuredClone(paths);
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

    // レイヤーの描画をクリア
    function clearLayerDrawings(layerSystem, layer, layerIndex) {
        if (!layer || !layer.layerData) return;
        
        // すべてのGraphicsを削除
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
        
        // pathsをクリア
        layer.layerData.paths = [];
        
        // サムネイル更新
        layerSystem.requestThumbnailUpdate(layerIndex);
        
        // カットサムネイル更新
        if (layerSystem.animationSystem?.generateCutThumbnailOptimized) {
            const cutIndex = layerSystem.animationSystem.getCurrentCutIndex();
            setTimeout(() => {
                layerSystem.animationSystem.generateCutThumbnailOptimized(cutIndex);
            }, 100);
        }
        
        // EventBus通知
        if (window.TegakiEventBus) {
            window.TegakiEventBus.emit('layer:drawings-deleted', {
                layerId: layer.layerData.id,
                layerIndex: layerIndex
            });
        }
    }

    // レイヤーの描画を復元
    function restoreLayerDrawings(layerSystem, layer, pathsBackup, layerIndex) {
        if (!layer || !layer.layerData || !pathsBackup) return;
        
        // 現在の描画を削除
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
        
        // pathsを復元
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
        
        // サムネイル更新
        layerSystem.requestThumbnailUpdate(layerIndex);
        
        // カットサムネイル更新
        if (layerSystem.animationSystem?.generateCutThumbnailOptimized) {
            const cutIndex = layerSystem.animationSystem.getCurrentCutIndex();
            setTimeout(() => {
                layerSystem.animationSystem.generateCutThumbnailOptimized(cutIndex);
            }, 100);
        }
        
        // EventBus通知
        if (window.TegakiEventBus) {
            window.TegakiEventBus.emit('layer:drawings-restored', {
                layerId: layer.layerData.id,
                layerIndex: layerIndex,
                pathCount: pathsBackup.length
            });
        }
    }

    // 初期化
    function init() {
        if (isInitialized) {
            console.warn('⚠️ KeyboardHandler already initialized');
            return;
        }

        document.addEventListener('keydown', handleKeyDown, { capture: true });
        document.addEventListener('keyup', handleKeyUp);
        
        // マウスイベントリスナー追加（capture: true で優先捕捉）
        document.addEventListener('mousedown', handleMouseDown, { capture: true });
        document.addEventListener('mousemove', handleMouseMove, { capture: true });
        document.addEventListener('mouseup', handleMouseUp, { capture: true });
        
        isInitialized = true;
        window.KeyboardHandler._isInitialized = true;
    }

    // ショートカット一覧取得（UI表示用）
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

    // デバッグ用：現在の状態を取得
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

    // 公開API
    return {
        init,
        isInputFocused,
        getShortcutList,
        getDebugState,
        _isInitialized: false
    };
})();