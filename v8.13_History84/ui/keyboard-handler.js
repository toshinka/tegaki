// ===== ui/keyboard-handler.js - GPT5案修正完全版 =====
// 修正内容:
// 1. Delete/Backspaceで「アクティブレイヤーの描画削除」を実装（History統合）
// 2. 二重初期化防止フラグ追加
// 3. layer:clear-activeイベントの発火タイミングを明確化（Ctrl+Delete）

window.KeyboardHandler = (function() {
    'use strict';

    let isInitialized = false;
    let vKeyPressed = false;

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
        
        // Vキー状態を追跡
        if (e.code === 'KeyV' && !e.ctrlKey && !e.shiftKey && !e.altKey) {
            vKeyPressed = true;
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

    // KeyUpイベントでVキーをリリース
    function handleKeyUp(e) {
        if (e.code === 'KeyV') {
            vKeyPressed = false;
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
            
            // ★GPT5案修正: Delete/Backspaceでアクティブレイヤーの描画を削除
            case 'LAYER_DELETE_DRAWINGS':
                deleteActiveLayerDrawings();
                event.preventDefault();
                break;
            
            // ★GPT5案修正: Ctrl+DeleteでLayer全クリア（別処理として明確化）
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

    // ★GPT5案修正: アクティブレイヤーの描画を削除（History統合）
    // レイヤー自体は削除せず、中の絵（全パス）のみ削除
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

    // ★GPT5案修正: 初期化（二重初期化防止）
    function init() {
        if (isInitialized) {
            return;
        }

        document.addEventListener('keydown', handleKeyDown, { capture: true });
        document.addEventListener('keyup', handleKeyUp);
        
        // 二重初期化防止フラグ
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
            { action: 'TOOL_PEN', keys: ['P', 'B'], description: 'ペンツール' },
            { action: 'TOOL_ERASER', keys: ['E'], description: '消しゴム' },
            { action: 'SETTINGS_OPEN', keys: ['Ctrl+,'], description: '設定を開く' },
            { action: 'LAYER_MOVE_MODE_TOGGLE', keys: ['V'], description: 'レイヤー移動モード切替' }
        ];
    }

    // 公開API
    return {
        init,
        isInputFocused,
        getShortcutList,
        _isInitialized: false
    };
})();

console.log('✅ keyboard-handler.js (GPT5案修正完全版) loaded');