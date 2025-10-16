// Tegaki Tool - Keyboard Handler Module
// DO NOT use ESM, only global namespace
// 🆕 設定ポップアップショートカット対応版

window.KeyboardHandler = (function() {
    'use strict';

    // ショートカット定義マップ（表示用）
    const shortcuts = {
        'UNDO': { keys: ['z'], ctrl: true, description: 'Undo (元に戻す)' },
        'REDO': { keys: ['y', 'Z'], ctrl: true, description: 'Redo (やり直し)' },
        'LAYER_CLEAR': { keys: ['Delete', 'Backspace'], ctrl: true, description: 'Clear Layer (レイヤークリア)' },
        'LAYER_CREATE': { keys: ['l'], ctrl: true, description: 'Create Layer (レイヤー追加)' },
        'GIF_CREATE_CUT': { keys: ['n'], ctrl: true, description: 'Create Cut (カット追加)' },
        'GIF_TOGGLE_TIMELINE': { keys: ['t'], ctrl: true, description: 'Toggle Timeline (タイムライン表示切替)' },
        'GIF_PLAY_PAUSE': { keys: [' '], description: 'Play/Pause Animation (再生/停止)' },
        'GIF_COPY_CUT': { keys: ['d'], ctrl: true, description: 'Duplicate Cut (カット複製)' },
        'TOOL_PEN': { keys: ['p', 'b'], description: 'Pen Tool (ペンツール)' },
        'TOOL_ERASER': { keys: ['e'], description: 'Eraser Tool (消しゴム)' },
        'UI_SETTINGS_TOGGLE': { keys: [','], ctrl: true, description: 'Settings Panel (設定パネル)' }
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
            
            // 🆕 設定ポップアップを開く
            case 'UI_SETTINGS_TOGGLE':
                eventBus.emit('ui:toggle-settings');
                event.preventDefault();
                break;
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