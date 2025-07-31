/**
 * ShortcutController.js - ショートカット専門 (Phase1 ショートカットファイル)
 * 標準ショートカット定義・キャンバス操作・カスタマイズUI・設定画面統合
 * v2.0 モダンキーボードAPI活用・プロ向け最適化・Adobe Fresco準拠
 */

import { throttle, debounce } from 'lodash-es';
import mitt from 'mitt';

// === 標準ショートカット定義（Ctrl+C/V/M/T等）（250-300行） ===

/**
 * 標準ショートカット定義システム - Adobe Creative Suite準拠
 * プロ向けショートカット体系・国際標準・カスタマイズ対応
 */
class StandardShortcutDefinitions {
    constructor() {
        // 標準ショートカットマップ（Adobe Fresco/Photoshop準拠）
        this.standardShortcuts = {
            // === ファイル操作 ===
            'ctrl+n': {
                action: 'file:new',
                description: '新規作成',
                category: 'file',
                priority: 1
            },
            'ctrl+o': {
                action: 'file:open',
                description: 'ファイルを開く',
                category: 'file',
                priority: 1
            },
            'ctrl+s': {
                action: 'file:save',
                description: '保存',
                category: 'file',
                priority: 1
            },
            'ctrl+shift+s': {
                action: 'file:save-as',
                description: '名前を付けて保存',
                category: 'file',
                priority: 1
            },
            'ctrl+shift+alt+s': {
                action: 'file:export',
                description: 'エクスポート',
                category: 'file',
                priority: 2
            },
            
            // === 編集操作 ===
            'ctrl+z': {
                action: 'edit:undo',
                description: '元に戻す',
                category: 'edit',
                priority: 1
            },
            'ctrl+y': {
                action: 'edit:redo',
                description: 'やり直し',
                category: 'edit',
                priority: 1
            },
            'ctrl+shift+z': {
                action: 'edit:redo',
                description: 'やり直し（代替）',
                category: 'edit',
                priority: 1
            },
            'ctrl+c': {
                action: 'edit:copy',
                description: 'コピー',
                category: 'edit',
                priority: 1
            },
            'ctrl+v': {
                action: 'edit:paste',
                description: '貼り付け',
                category: 'edit',
                priority: 1
            },
            'ctrl+x': {
                action: 'edit:cut',
                description: '切り取り',
                category: 'edit',
                priority: 1
            },
            'ctrl+a': {
                action: 'edit:select-all',
                description: '全選択',
                category: 'edit',
                priority: 1
            },
            'ctrl+d': {
                action: 'edit:deselect',
                description: '選択解除',
                category: 'edit',
                priority: 2
            },
            'delete': {
                action: 'edit:delete',
                description: '削除',
                category: 'edit',
                priority: 1
            },
            
            // === ツール選択 ===
            'b': {
                action: 'tool:brush',
                description: 'ブラシツール',
                category: 'tool',
                priority: 1
            },
            'p': {
                action: 'tool:pen',
                description: 'ペンツール',
                category: 'tool',
                priority: 1
            },
            'e': {
                action: 'tool:eraser',
                description: '消しゴムツール',
                category: 'tool',
                priority: 1
            },
            'i': {
                action: 'tool:eyedropper',
                description: 'スポイトツール',
                category: 'tool',
                priority: 1
            },
            'm': {
                action: 'tool:move',
                description: '移動ツール',
                category: 'tool',
                priority: 1
            },
            'v': {
                action: 'tool:select',
                description: '選択ツール',
                category: 'tool',
                priority: 1
            },
            't': {
                action: 'tool:text',
                description: 'テキストツール',
                category: 'tool',
                priority: 1
            },
            'u': {
                action: 'tool:shape',
                description: '図形ツール',
                category: 'tool',
                priority: 2
            },
            'g': {
                action: 'tool:gradient',
                description: 'グラデーションツール',
                category: 'tool',
                priority: 2
            },
            'k': {
                action: 'tool:bucket',
                description: '塗りつぶしツール',
                category: 'tool',
                priority: 2
            },
            
            // === レイヤー操作 ===
            'ctrl+shift+n': {
                action: 'layer:new',
                description: '新規レイヤー',
                category: 'layer',
                priority: 1
            },
            'ctrl+j': {
                action: 'layer:duplicate',
                description: 'レイヤー複製',
                category: 'layer',
                priority: 1
            },
            'ctrl+e': {
                action: 'layer:merge-down',
                description: '下のレイヤーと結合',
                category: 'layer',
                priority: 2
            },
            'ctrl+shift+e': {
                action: 'layer:flatten',
                description: '画像を統合',
                category: 'layer',
                priority: 2
            },
            'ctrl+g': {
                action: 'layer:group',
                description: 'レイヤーをグループ化',
                category: 'layer',
                priority: 2
            },
            'ctrl+shift+g': {
                action: 'layer:ungroup',
                description: 'グループ解除',
                category: 'layer',
                priority: 2
            },
            
            // === 表示操作 ===
            'ctrl+0': {
                action: 'view:fit-screen',
                description: '画面にフィット',
                category: 'view',
                priority: 1
            },
            'ctrl+1': {
                action: 'view:actual-size',
                description: '実際のサイズ',
                category: 'view',
                priority: 1
            },
            'ctrl++': {
                action: 'view:zoom-in',
                description: 'ズームイン',
                category: 'view',
                priority: 1
            },
            'ctrl+-': {
                action: 'view:zoom-out',
                description: 'ズームアウト',
                category: 'view',
                priority: 1
            },
            'ctrl+alt+0': {
                action: 'view:fit-width',
                description: '幅にフィット',
                category: 'view',
                priority: 2
            },
            
            // === キャンバス操作 ===
            'ctrl+t': {
                action: 'transform:free',
                description: '自由変形',
                category: 'transform',
                priority: 1
            },
            'ctrl+shift+t': {
                action: 'transform:repeat',
                description: '変形の再実行',
                category: 'transform',
                priority: 2
            },
            'ctrl+alt+t': {
                action: 'transform:copy',
                description: '変形の複製',
                category: 'transform',
                priority: 2
            },
            'ctrl+r': {
                action: 'canvas:rotate',
                description: 'カンバス回転',
                category: 'canvas',
                priority: 2
            },
            'ctrl+alt+r': {
                action: 'canvas:reset-rotation',
                description: 'カンバス回転をリセット',
                category: 'canvas',
                priority: 2
            },
            'ctrl+alt+c': {
                action: 'canvas:crop',
                description: 'カンバスサイズ調整',
                category: 'canvas',
                priority: 2
            }
        };
        
        // ショートカットカテゴリ設定
        this.categories = {
            'file': { name: 'ファイル', color: '#4CAF50', priority: 1 },
            'edit': { name: '編集', color: '#2196F3', priority: 2 },
            'tool': { name: 'ツール', color: '#FF9800', priority: 3 },
            'layer': { name: 'レイヤー', color: '#9C27B0', priority: 4 },
            'view': { name: '表示', color: '#607D8B', priority: 5 },
            'transform': { name: '変形', color: '#E91E63', priority: 6 },
            'canvas': { name: 'キャンバス', color: '#795548', priority: 7 }
        };
        
        // 修飾キー組み合わせ定義
        this.modifierKeys = {
            'ctrl': 'Control',
            'shift': 'Shift',
            'alt': 'Alt',
            'meta': 'Meta' // Mac: Cmd, Win: Win
        };
        
        // プラットフォーム別調整
        this.adjustForPlatform();
    }
    
    /**
     * プラットフォーム別ショートカット調整
     */
    adjustForPlatform() {
        const isMac = navigator.platform.toLowerCase().indexOf('mac') !== -1;
        
        if (isMac) {
            // Mac用調整: Ctrl → Cmd
            const macShortcuts = {};
            Object.entries(this.standardShortcuts).forEach(([key, value]) => {
                const macKey = key.replace(/ctrl\+/g, 'meta+');
                macShortcuts[macKey] = value;
            });
            this.standardShortcuts = macShortcuts;
            
            // Mac専用ショートカット追加
            this.standardShortcuts['cmd+q'] = {
                action: 'app:quit',
                description: 'アプリケーション終了',
                category: 'file',
                priority: 1
            };
        }
    }
    
    /**
     * ショートカットキー正規化
     */
    normalizeShortcutKey(event) {
        const parts = [];
        
        // 修飾キー順序統一
        if (event.ctrlKey || event.metaKey) parts.push(navigator.platform.toLowerCase().indexOf('mac') !== -1 ? 'meta' : 'ctrl');
        if (event.altKey) parts.push('alt');
        if (event.shiftKey) parts.push('shift');
        
        // メインキー追加
        const key = event.key.toLowerCase();
        if (key !== 'control' && key !== 'alt' && key !== 'shift' && key !== 'meta') {
            parts.push(key);
        }
        
        return parts.length > 0 ? parts.join('+') : '';
    }
    
    /**
     * ショートカット検索
     */
    findShortcut(keyString) {
        return this.standardShortcuts[keyString] || null;
    }
    
    /**
     * カテゴリ別ショートカット取得
     */
    getShortcutsByCategory(category) {
        return Object.entries(this.standardShortcuts)
            .filter(([key, shortcut]) => shortcut.category === category)
            .sort((a, b) => a[1].priority - b[1].priority);
    }
    
    /**
     * 全ショートカット取得（カテゴリ順）
     */
    getAllShortcuts() {
        const categorized = {};
        
        Object.entries(this.categories).forEach(([categoryId, category]) => {
            categorized[categoryId] = {
                ...category,
                shortcuts: this.getShortcutsByCategory(categoryId)
            };
        });
        
        return categorized;
    }
}

// === キャンバス操作ショートカット（Space/H等）（150-200行） ===

/**
 * キャンバス操作ショートカットシステム
 * Space+ドラッグ・H（Hand）・R（Rotate）等の専門操作
 */
class CanvasOperationShortcuts {
    constructor(eventBus, inputController) {
        this.eventBus = eventBus;
        this.inputController = inputController;
        
        // キャンバス操作状態
        this.isSpacePressed = false;
        this.isHandMode = false;
        this.isRotateMode = false;
        this.temporaryTool = null;
        this.originalTool = null;
        
        // 操作感度設定
        this.panSensitivity = 1.0;
        this.rotateSensitivity = 0.5;
        this.zoomSensitivity = 0.1;
        
        // 特殊ショートカット定義
        this.canvasShortcuts = {
            ' ': { // Space key
                action: 'canvas:pan-mode',
                description: 'パンモード（押している間）',
                type: 'hold',
                modifiers: []
            },
            'h': {
                action: 'canvas:hand-toggle',
                description: 'ハンドツール切り替え',
                type: 'toggle',
                modifiers: []
            },
            'r': {
                action: 'canvas:rotate-mode',
                description: 'カンバス回転モード',
                type: 'toggle',
                modifiers: []
            },
            'ctrl+space': {
                action: 'canvas:zoom-in-mode',
                description: 'ズームインモード',
                type: 'hold',
                modifiers: ['ctrl']
            },
            'alt+space': {
                action: 'canvas:zoom-out-mode',
                description: 'ズームアウトモード',
                type: 'hold',
                modifiers: ['alt']
            },
            'home': {
                action: 'canvas:reset-view',
                description: 'ビューリセット',
                type: 'press',
                modifiers: []
            },
            'f': {
                action: 'canvas:fullscreen',
                description: 'フルスクリーン切り替え',
                type: 'press',
                modifiers: []
            },
            'tab': {
                action: 'ui:toggle-panels',
                description: 'パネル表示切り替え',
                type: 'press',
                modifiers: []
            }
        };
        
        // 操作制御
        this.operationThrottle = throttle(this.handleCanvasOperation.bind(this), 16); // 60fps
        this.currentOperation = null;
        
        this.initializeCanvasShortcuts();
    }
    
    /**
     * キャンバスショートカット初期化
     */
    initializeCanvasShortcuts() {
        // キーイベント監視
        document.addEventListener('keydown', this.handleKeyDown.bind(this), true);
        document.addEventListener('keyup', this.handleKeyUp.bind(this), true);
        
        // マウス・ポインターイベント監視
        if (this.inputController) {
            const eventBus = this.inputController.getEventBus();
            
            eventBus.on('input:drawing-start', this.handlePointerStart.bind(this));
            eventBus.on('input:drawing-continue', this.handlePointerMove.bind(this));
            eventBus.on('input:drawing-end', this.handlePointerEnd.bind(this));
            eventBus.on('input:hover', this.handlePointerHover.bind(this));
        }
        
        console.log('🎮 キャンバス操作ショートカット初期化完了');
    }
    
    /**
     * キー押下処理
     */
    handleKeyDown(event) {
        const key = event.key.toLowerCase();
        const shortcut = this.canvasShortcuts[key] || this.canvasShortcuts[this.getModifiedKey(event)];
        
        if (!shortcut) return;
        
        // 修飾キーチェック
        if (!this.checkModifiers(event, shortcut.modifiers)) return;
        
        switch (shortcut.type) {
            case 'hold':
                this.startHoldOperation(shortcut, event);
                break;
            case 'toggle':
                this.toggleOperation(shortcut, event);
                break;
            case 'press':
                this.executeOperation(shortcut, event);
                break;
        }
    }
    
    /**
     * キー離脱処理
     */
    handleKeyUp(event) {
        const key = event.key.toLowerCase();
        const shortcut = this.canvasShortcuts[key] || this.canvasShortcuts[this.getModifiedKey(event)];
        
        if (shortcut && shortcut.type === 'hold') {
            this.endHoldOperation(shortcut, event);
        }
    }
    
    /**
     * ホールド操作開始
     */
    startHoldOperation(shortcut, event) {
        switch (shortcut.action) {
            case 'canvas:pan-mode':
                this.startPanMode(event);
                break;
            case 'canvas:zoom-in-mode':
                this.startZoomMode('in', event);
                break;
            case 'canvas:zoom-out-mode':
                this.startZoomMode('out', event);
                break;
        }
        
        event.preventDefault();
    }
    
    /**
     * ホールド操作終了
     */
    endHoldOperation(shortcut, event) {
        switch (shortcut.action) {
            case 'canvas:pan-mode':
                this.endPanMode(event);
                break;
            case 'canvas:zoom-in-mode':
            case 'canvas:zoom-out-mode':
                this.endZoomMode(event);
                break;
        }
    }
    
    /**
     * パンモード開始
     */
    startPanMode(event) {
        if (this.isSpacePressed) return;
        
        this.isSpacePressed = true;
        this.originalTool = this.getCurrentTool();
        
        // カーソル変更
        document.body.style.cursor = 'grab';
        
        // ツール一時切り替え
        this.eventBus.emit('tool:temporary-switch', {
            from: this.originalTool,
            to: 'pan',
            reason: 'space-key'
        });
        
        console.log('🖐️ パンモード開始');
    }
    
    /**
     * パンモード終了
     */
    endPanMode(event) {
        if (!this.isSpacePressed) return;
        
        this.isSpacePressed = false;
        
        // カーソル復元
        document.body.style.cursor = '';
        
        // ツール復元
        if (this.originalTool) {
            this.eventBus.emit('tool:restore', {
                tool: this.originalTool,
                reason: 'space-key-release'
            });
            this.originalTool = null;
        }
        
        console.log('🖐️ パンモード終了');
    }
    
    /**
     * ズームモード開始
     */
    startZoomMode(direction, event) {
        this.currentOperation = `zoom-${direction}`;
        document.body.style.cursor = direction === 'in' ? 'zoom-in' : 'zoom-out';
        
        this.eventBus.emit('canvas:zoom-mode-start', {
            direction: direction,
            sensitivity: this.zoomSensitivity
        });
    }
    
    /**
     * ズームモード終了
     */
    endZoomMode(event) {
        this.currentOperation = null;
        document.body.style.cursor = '';
        
        this.eventBus.emit('canvas:zoom-mode-end');
    }
    
    /**
     * ポインター開始処理
     */
    handlePointerStart(event) {
        if (this.isSpacePressed) {
            // パン操作開始
            this.eventBus.emit('canvas:pan-start', {
                point: event.point,
                pointerId: event.pointerId
            });
            event.handled = true;
        } else if (this.currentOperation && this.currentOperation.startsWith('zoom-')) {
            // ズーム操作開始
            this.eventBus.emit('canvas:zoom-start', {
                point: event.point,
                direction: this.currentOperation.split('-')[1]
            });
            event.handled = true;
        }
    }
    
    /**
     * ポインター移動処理
     */
    handlePointerMove(event) {
        if (this.isSpacePressed) {
            // パン操作継続
            this.eventBus.emit('canvas:pan-continue', {
                point: event.point,
                velocity: event.velocity,
                distance: event.distance
            });
            event.handled = true;
        } else if (this.currentOperation && this.currentOperation.startsWith('zoom-')) {
            // ズーム操作継続
            this.operationThrottle(event);
            event.handled = true;
        }
    }
    
    /**
     * ポインター終了処理
     */
    handlePointerEnd(event) {
        if (this.isSpacePressed) {
            // パン操作終了
            this.eventBus.emit('canvas:pan-end', {
                point: event.point,
                totalDistance: event.totalDistance,
                duration: event.duration
            });
            event.handled = true;
        } else if (this.currentOperation && this.currentOperation.startsWith('zoom-')) {
            // ズーム操作終了
            this.eventBus.emit('canvas:zoom-end', {
                point: event.point
            });
            event.handled = true;
        }
    }
    
    /**
     * キャンバス操作処理（スロットル制御）
     */
    handleCanvasOperation(event) {
        if (this.currentOperation === 'zoom-in') {
            this.eventBus.emit('canvas:zoom-continue', {
                point: event.point,
                direction: 'in',
                factor: 1 + this.zoomSensitivity
            });
        } else if (this.currentOperation === 'zoom-out') {
            this.eventBus.emit('canvas:zoom-continue', {
                point: event.point,
                direction: 'out',
                factor: 1 - this.zoomSensitivity
            });
        }
    }
    
    /**
     * 修飾キー付きキー取得
     */
    getModifiedKey(event) {
        const parts = [];
        if (event.ctrlKey) parts.push('ctrl');
        if (event.altKey) parts.push('alt');
        if (event.shiftKey) parts.push('shift');
        parts.push(event.key.toLowerCase());
        return parts.join('+');
    }
    
    /**
     * 修飾キーチェック
     */
    checkModifiers(event, requiredModifiers) {
        const activeModifiers = [];
        if (event.ctrlKey) activeModifiers.push('ctrl');
        if (event.altKey) activeModifiers.push('alt');
        if (event.shiftKey) activeModifiers.push('shift');
        
        return requiredModifiers.length === activeModifiers.length &&
               requiredModifiers.every(mod => activeModifiers.includes(mod));
    }
    
    /**
     * 現在のツール取得
     */
    getCurrentTool() {
        // window.drawingAppから現在のツールを取得
        if (window.drawingApp && window.drawingApp.currentTool) {
            return window.drawingApp.currentTool;
        }
        return 'pen'; // デフォルト
    }
    
    /**
     * トグル操作実行
     */
    toggleOperation(shortcut, event) {
        switch (shortcut.action) {
            case 'canvas:hand-toggle':
                this.toggleHandMode(event);
                break;
            case 'canvas:rotate-mode':
                this.toggleRotateMode(event);
                break;
        }
        event.preventDefault();
    }
    
    /**
     * ハンドモード切り替え
     */
    toggleHandMode(event) {
        this.isHandMode = !this.isHandMode;
        
        if (this.isHandMode) {
            this.temporaryTool = this.getCurrentTool();
            document.body.style.cursor = 'grab';
            this.eventBus.emit('tool:switch', { tool: 'hand', temporary: true });
        } else {
            document.body.style.cursor = '';
            if (this.temporaryTool) {
                this.eventBus.emit('tool:switch', { tool: this.temporaryTool });
                this.temporaryTool = null;
            }
        }
        
        console.log(`🖐️ ハンドモード: ${this.isHandMode ? 'ON' : 'OFF'}`);
    }
    
    /**
     * 回転モード切り替え
     */
    toggleRotateMode(event) {
        this.isRotateMode = !this.isRotateMode;
        
        if (this.isRotateMode) {
            document.body.style.cursor = 'grab';
            this.eventBus.emit('canvas:rotate-mode-start', {
                sensitivity: this.rotateSensitivity
            });
        } else {
            document.body.style.cursor = '';
            this.eventBus.emit('canvas:rotate-mode-end');
        }
        
        console.log(`🔄 回転モード: ${this.isRotateMode ? 'ON' : 'OFF'}`);
    }
    
    /**
     * 実行操作
     */
    executeOperation(shortcut, event) {
        switch (shortcut.action) {
            case 'canvas:reset-view':
                this.resetCanvasView(event);
                break;
            case 'canvas:fullscreen':
                this.toggleFullscreen(event);
                break;
            case 'ui:toggle-panels':
                this.toggleUIPanels(event);
                break;
        }
        event.preventDefault();
    }
    
    /**
     * キャンバスビューリセット
     */
    resetCanvasView(event) {
        this.eventBus.emit('canvas:reset-view', {
            animated: true,
            duration: 300
        });
        console.log('🎯 キャンバスビューリセット');
    }
    
    /**
     * フルスクリーン切り替え
     */
    toggleFullscreen(event) {
        this.eventBus.emit('app:fullscreen-toggle');
        console.log('📺 フルスクリーン切り替え');
    }
    
    /**
     * UIパネル表示切り替え
     */
    toggleUIPanels(event) {
        this.eventBus.emit('ui:panels-toggle');
        console.log('🎛️ UIパネル表示切り替え');
    }
}

// === カスタマイズUI・設定画面（50行） ===

/**
 * ショートカットカスタマイズシステム
 * ユーザー設定・プリセット・エクスポート/インポート
 */
class ShortcutCustomizationSystem {
    constructor(standardDefinitions) {
        this.standardDefinitions = standardDefinitions;
        
        // カスタマイズ設定
        this.customShortcuts = {};
        this.disabledShortcuts = new Set();
        this.userPresets = {};
        
        // 設定保存キー
        this.storageKey = 'drawing-app-shortcuts';
        
        // 競合検出
        this.conflicts = new Map();
        
        this.loadCustomSettings();
    }
    
    /**
     * カスタム設定読み込み
     */
    loadCustomSettings() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                const settings = JSON.parse(saved);
                this.customShortcuts = settings.custom || {};
                this.disabledShortcuts = new Set(settings.disabled || []);
                this.userPresets = settings.presets || {};
                
                console.log('⚙️ カスタムショートカット設定読み込み完了');
            }
        } catch (error) {
            console.warn('⚠️ ショートカット設定読み込み失敗:', error);
        }
    }
    
    /**
     * カスタム設定保存
     */
    saveCustomSettings() {
        try {
            const settings = {
                custom: this.customShortcuts,
                disabled: Array.from(this.disabledShortcuts),
                presets: this.userPresets,
                version: '2.0',
                timestamp: Date.now()
            };
            
            localStorage.setItem(this.storageKey, JSON.stringify(settings));
            console.log('💾 カスタムショートカット設定保存完了');
        } catch (error) {
            console.error('❌ ショートカット設定保存失敗:', error);
        }
    }
    
    /**
     * ショートカット変更
     */
    changeShortcut(action, newKeyString) {
        // 競合チェック
        const conflict = this.findConflictingShortcut(newKeyString, action);
        if (conflict) {
            console.warn(`⚠️ ショートカット競合: ${newKeyString} は既に ${conflict.action} に割り当てられています`);
            return false;
        }
        
        // カスタムショートカット設定
        this.customShortcuts[newKeyString] = {
            action: action,
            description: this.getActionDescription(action),
            custom: true,
            timestamp: Date.now()
        };
        
        // 古いキーがあれば削除
        const oldKey = this.findKeyByAction(action);
        if (oldKey && oldKey !== newKeyString) {
            delete this.customShortcuts[oldKey];
        }
        
        this.saveCustomSettings();
        return true;
    }
    
    /**
     * ショートカット無効化
     */
    disableShortcut(keyString) {
        this.disabledShortcuts.add(keyString);
        this.saveCustomSettings();
    }
    
    /**
     * ショートカット有効化
     */
    enableShortcut(keyString) {
        this.disabledShortcuts.delete(keyString);
        this.saveCustomSettings();
    }
    
    /**
     * デフォルトに戻す
     */
    resetToDefault() {
        this.customShortcuts = {};
        this.disabledShortcuts.clear();
        this.saveCustomSettings();
        console.log('🔄 ショートカット設定をデフォルトにリセット');
    }
    
    /**
     * 競合するショートカット検索
     */
    findConflictingShortcut(keyString, excludeAction) {
        // 標準ショートカットとの競合
        const standardConflict = this.standardDefinitions.findShortcut(keyString);
        if (standardConflict && standardConflict.action !== excludeAction) {
            return standardConflict;
        }
        
        // カスタムショートカットとの競合
        const customConflict = this.customShortcuts[keyString];
        if (customConflict && customConflict.action !== excludeAction) {
            return customConflict;
        }
        
        return null;
    }
    
    /**
     * アクションによるキー検索
     */
    findKeyByAction(action) {
        // カスタムショートカットから検索
        for (const [key, shortcut] of Object.entries(this.customShortcuts)) {
            if (shortcut.action === action) return key;
        }
        
        // 標準ショートカットから検索
        for (const [key, shortcut] of Object.entries(this.standardDefinitions.standardShortcuts)) {
            if (shortcut.action === action) return key;
        }
        
        return null;
    }
    
    /**
     * アクション説明取得
     */
    getActionDescription(action) {
        // カスタムショートカットから検索
        for (const shortcut of Object.values(this.customShortcuts)) {
            if (shortcut.action === action) return shortcut.description;
        }
        
        // 標準ショートカットから検索
        for (const shortcut of Object.values(this.standardDefinitions.standardShortcuts)) {
            if (shortcut.action === action) return shortcut.description;
        }
        
        return action; // フォールバック
    }
}

// === OGLショートカットコントローラー統合エクスポート ===

/**
 * OGLショートカットコントローラー統合クラス
 */
export class ShortcutController {
    constructor(eventBus, inputController = null) {
        this.eventBus = eventBus;
        this.inputController = inputController;
        
        // コンポーネント初期化
        this.standardDefinitions = new StandardShortcutDefinitions();
        this.canvasOperations = new CanvasOperationShortcuts(eventBus, inputController);
        this.customizationSystem = new ShortcutCustomizationSystem(this.standardDefinitions);
        
        // ショートカット実行制御
        this.executionEnabled = true;
        this.executionStats = {
            totalExecutions: 0,
            byCategory: {},
            lastExecution: null
        };
        
        // ショートカット実行スロットル（連打防止）
        this.executeThrottle = throttle(this.executeShortcutAction.bind(this), 100);
        
        this.initializeShortcutController();
    }
    
    /**
     * ショートカットコントローラー初期化
     */
    initializeShortcutController() {
        // グローバルキーボードイベント監視
        document.addEventListener('keydown', this.handleGlobalKeyDown.bind(this), true);
        document.addEventListener('keyup', this.handleGlobalKeyUp.bind(this), true);
        
        // アプリケーションイベント統合
        this.setupAppEventIntegration();
        
        // ショートカットヘルプシステム
        this.setupShortcutHelp();
        
        console.log('⌨️ OGLショートカットコントローラー初期化完了');
    }
    
    /**
     * アプリケーションイベント統合
     */
    setupAppEventIntegration() {
        // ヒストリー統合
        this.eventBus.on('shortcut:undo', () => {
            this.eventBus.emit('history:undo');
        });
        
        this.eventBus.on('shortcut:redo', () => {
            this.eventBus.emit('history:redo');
        });
        
        // ツール切り替え統合
        this.eventBus.on('shortcut:tool-switch', (event) => {
            this.eventBus.emit('tool:switch', { tool: event.tool });
        });
        
        // ファイル操作統合
        this.eventBus.on('shortcut:file-operation', (event) => {
            this.eventBus.emit(`file:${event.operation}`, event.data);
        });
    }
    
    /**
     * ショートカットヘルプシステム設定
     */
    setupShortcutHelp() {
        // ヘルプ表示制御
        this.eventBus.on('shortcut:show-help', () => {
            this.showShortcutHelp();
        });
        
        // ヘルプ非表示制御
        this.eventBus.on('shortcut:hide-help', () => {
            this.hideShortcutHelp();
        });
        
        // F1キーでヘルプ表示
        document.addEventListener('keydown', (event) => {
            if (event.key === 'F1') {
                event.preventDefault();
                this.showShortcutHelp();
            }
        });
    }
    
    /**
     * グローバルキー押下処理
     */
    handleGlobalKeyDown(event) {
        if (!this.executionEnabled) return;
        
        // 入力フィールド内での実行を防ぐ
        if (this.isInputField(event.target)) return;
        
        // ショートカットキー正規化
        const keyString = this.standardDefinitions.normalizeShortcutKey(event);
        if (!keyString) return;
        
        // 無効化されたショートカットをスキップ
        if (this.customizationSystem.disabledShortcuts.has(keyString)) return;
        
        // ショートカット検索・実行
        const shortcut = this.findActiveShortcut(keyString);
        if (shortcut) {
            event.preventDefault();
            event.stopPropagation();
            
            this.executeThrottle(shortcut, event);
        }
    }
    
    /**
     * グローバルキー離脱処理
     */
    handleGlobalKeyUp(event) {
        // キャンバス操作システムに委譲
        // （Space key等のhold操作はCanvasOperationShortcutsで処理）
    }
    
    /**
     * アクティブショートカット検索
     */
    findActiveShortcut(keyString) {
        // カスタムショートカット優先
        const customShortcut = this.customizationSystem.customShortcuts[keyString];
        if (customShortcut) return customShortcut;
        
        // 標準ショートカット
        const standardShortcut = this.standardDefinitions.findShortcut(keyString);
        if (standardShortcut) return standardShortcut;
        
        return null;
    }
    
    /**
     * ショートカットアクション実行
     */
    executeShortcutAction(shortcut, event) {
        const actionParts = shortcut.action.split(':');
        const category = actionParts[0];
        const operation = actionParts[1];
        
        // 統計更新
        this.updateExecutionStats(shortcut);
        
        try {
            switch (category) {
                case 'edit':
                    this.executeEditAction(operation, event);
                    break;
                case 'tool':
                    this.executeToolAction(operation, event);
                    break;
                case 'file':
                    this.executeFileAction(operation, event);
                    break;
                case 'layer':
                    this.executeLayerAction(operation, event);
                    break;
                case 'view':
                    this.executeViewAction(operation, event);
                    break;
                case 'transform':
                    this.executeTransformAction(operation, event);
                    break;
                case 'canvas':
                    this.executeCanvasAction(operation, event);
                    break;
                default:
                    console.warn(`⚠️ 未対応ショートカットカテゴリ: ${category}`);
            }
            
            console.log(`⌨️ ショートカット実行: ${shortcut.description}`);
            
        } catch (error) {
            console.error(`❌ ショートカット実行エラー: ${shortcut.action}`, error);
        }
    }
    
    /**
     * 編集アクション実行
     */
    executeEditAction(operation, event) {
        switch (operation) {
            case 'undo':
                this.eventBus.emit('shortcut:undo');
                break;
            case 'redo':
                this.eventBus.emit('shortcut:redo');
                break;
            case 'copy':
                this.eventBus.emit('edit:copy');
                break;
            case 'paste':
                this.eventBus.emit('edit:paste');
                break;
            case 'cut':
                this.eventBus.emit('edit:cut');
                break;
            case 'select-all':
                this.eventBus.emit('edit:select-all');
                break;
            case 'deselect':
                this.eventBus.emit('edit:deselect');
                break;
            case 'delete':
                this.eventBus.emit('edit:delete');
                break;
        }
    }
    
    /**
     * ツールアクション実行
     */
    executeToolAction(operation, event) {
        this.eventBus.emit('shortcut:tool-switch', { tool: operation });
    }
    
    /**
     * ファイルアクション実行
     */
    executeFileAction(operation, event) {
        this.eventBus.emit('shortcut:file-operation', { operation: operation });
    }
    
    /**
     * レイヤーアクション実行
     */
    executeLayerAction(operation, event) {
        this.eventBus.emit(`layer:${operation}`);
    }
    
    /**
     * ビューアクション実行
     */
    executeViewAction(operation, event) {
        this.eventBus.emit(`view:${operation}`);
    }
    
    /**
     * 変形アクション実行
     */
    executeTransformAction(operation, event) {
        this.eventBus.emit(`transform:${operation}`);
    }
    
    /**
     * キャンバスアクション実行
     */
    executeCanvasAction(operation, event) {
        this.eventBus.emit(`canvas:${operation}`);
    }
    
    /**
     * 入力フィールド判定
     */
    isInputField(element) {
        const inputTypes = ['input', 'textarea', 'select'];
        return inputTypes.includes(element.tagName.toLowerCase()) ||
               element.contentEditable === 'true';
    }
    
    /**
     * 実行統計更新
     */
    updateExecutionStats(shortcut) {
        this.executionStats.totalExecutions++;
        this.executionStats.lastExecution = {
            action: shortcut.action,
            timestamp: performance.now()
        };
        
        const category = shortcut.action.split(':')[0];
        this.executionStats.byCategory[category] = (this.executionStats.byCategory[category] || 0) + 1;
    }
    
    /**
     * ショートカットヘルプ表示
     */
    showShortcutHelp() {
        const helpData = this.standardDefinitions.getAllShortcuts();
        this.eventBus.emit('ui:show-shortcut-help', { shortcuts: helpData });
    }
    
    /**
     * ショートカットヘルプ非表示
     */
    hideShortcutHelp() {
        this.eventBus.emit('ui:hide-shortcut-help');
    }
    
    /**
     * ショートカット実行状態制御
     */
    setExecutionEnabled(enabled) {
        this.executionEnabled = enabled;
        console.log(`⌨️ ショートカット実行: ${enabled ? '有効' : '無効'}`);
    }
    
    /**
     * ショートカット統計取得
     */
    getExecutionStats() {
        return { ...this.executionStats };
    }
    
    /**
     * カスタマイズシステム取得
     */
    getCustomizationSystem() {
        return this.customizationSystem;
    }
    
    /**
     * リソース解放
     */
    destroy() {
        // イベントリスナー削除
        document.removeEventListener('keydown', this.handleGlobalKeyDown);
        document.removeEventListener('keyup', this.handleGlobalKeyUp);
        
        // 統計リセット
        this.executionStats = {
            totalExecutions: 0,
            byCategory: {},
            lastExecution: null
        };
        
        console.log('🗑️ OGLショートカットコントローラー解放完了');
    }
}

// モジュールエクスポート
export { 
    StandardShortcutDefinitions, 
    CanvasOperationShortcuts, 
    ShortcutCustomizationSystem 
};