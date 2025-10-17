// Tegaki Tool - Keyboard Handler Module
// DO NOT use ESM, only global namespace

window.KeyboardHandler = (function() {
    'use strict';

    // ショートカット定義マップ
    const shortcuts = {
        'UNDO': { keys: ['z'], ctrl: true, description: 'Undo (元に戻す)' },
        'REDO': { keys: ['y', 'Z'], ctrl: true, description: 'Redo (やり直し)' },
        'LAYER_DELETE_DRAWINGS': { keys: ['Delete', 'Backspace'], ctrl: false, description: 'Delete Layer Drawings (レイヤーの絵を削除)' },
        'LAYER_CLEAR': { keys: ['Delete'], ctrl: true, description: 'Clear Layer (レイヤークリア)' },
        'LAYER_CREATE': { keys: ['l'], ctrl: true, description: 'Create Layer (レイヤー追加)' },
        'GIF_CREATE_CUT': { keys: ['n'], ctrl: true, description: 'Create Cut (カット追加)' },
        'GIF_TOGGLE_TIMELINE': { keys: ['t'], ctrl: true, description: 'Toggle Timeline (タイムライン表示切替)' },
        'GIF_PLAY_PAUSE': { keys: [' '], description: 'Play/Pause Animation (再生/停止)' },
        'GIF_COPY_CUT': { keys: ['d'], ctrl: true, description: 'Duplicate Cut (カット複製)' },
        'TOOL_PEN': { keys: ['p', 'b'], description: 'Pen Tool (ペンツール)' },
        'TOOL_ERASER': { keys: ['e'], description: 'Eraser Tool (消しゴム)' },
        'SETTINGS_OPEN': { keys: [','], ctrl: true, description: 'Open Settings (設定を開く)' }
    };

    let isInitialized = false;

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

    // キーボードイベントハンドラー
    function handleKeyDown(e) {
        const eventBus = window.TegakiEventBus;
        const keymap = window.TEGAKI_KEYMAP;
        
        if (!eventBus || !keymap) return;
        
        // 入力フィールド内では処理しない
        if (isInputFocused()) return;
        
        // ブラウザデフォルト動作を防止（F5, F11, F12以外）
        if (e.key === 'F5' || e.key === 'F11' || e.key === 'F12') return;
        if (e.key.startsWith('F') && e.key.length <= 3) {
            e.preventDefault();
            return;
        }
        
        // config.jsのキーマップでアクション解決
        const action = keymap.getAction(e, { vMode: false });
        
        if (!action) return;
        
        // アクション処理
        handleAction(action, e, eventBus);
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
                // 🆕 DEL/Backspaceでアクティブレイヤーの絵を削除
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
                // 設定ポップアップを開く（他のポップアップと同じ仕組み）
                if (window.TegakiUI?.uiController) {
                    // UIControllerを経由して開く
                    window.TegakiUI.uiController.closeAllPopups();
                    if (window.TegakiUI.uiController.settingsPopup) {
                        window.TegakiUI.uiController.settingsPopup.show();
                    }
                } else if (window.TegakiUI?.SettingsPopup) {
                    // フォールバック: 直接インスタンスにアクセス
                    const settingsBtn = document.getElementById('settings-tool');
                    if (settingsBtn) {
                        settingsBtn.click();
                    }
                }
                event.preventDefault();
                break;
        }
    }

    // 🆕 アクティブレイヤーの絵を削除（履歴対応）
    function deleteActiveLayerDrawings() {
        const layerSystem = window.drawingApp?.layerManager;
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

    // レイヤーの絵をクリア
    function clearLayerDrawings(layerSystem, layer) {
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
                // エラーは無視
            }
        });
        
        // pathsをクリア
        layer.layerData.paths = [];
        
        // サムネイル更新
        layerSystem.requestThumbnailUpdate(layerSystem.activeLayerIndex);
        
        // EventBus通知
        if (window.TegakiEventBus) {
            window.TegakiEventBus.emit('layer:drawings-deleted', {
                layerId: layer.layerData.id,
                layerIndex: layerSystem.activeLayerIndex
            });
        }
    }

    // レイヤーの絵を復元
    function restoreLayerDrawings(layerSystem, layer, pathsBackup, layerIndex) {
        if (!layer || !layer.layerData || !pathsBackup) return;
        
        // 現在の描画を削除
        clearLayerDrawings(layerSystem, layer);
        
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
                // エラーは無視
            }
        }
        
        // サムネイル更新
        layerSystem.requestThumbnailUpdate(layerIndex);
        
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
            return;
        }

        document.addEventListener('keydown', handleKeyDown);
        isInitialized = true;
    }

    // ショートカット一覧取得（UI表示用）
    function getShortcutList() {
        return Object.entries(shortcuts).map(([action, config]) => ({
            action,
            keys: config.keys,
            ctrl: config.ctrl || false,
            shift: config.shift || false,
            alt: config.alt || false,
            description: config.description
        }));
    }

    // 公開API
    return {
        init,
        isInputFocused,
        getShortcutList,
        shortcuts
    };
})();