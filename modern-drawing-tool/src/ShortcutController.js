/**
 * ShortcutController - ショートカット専門（Phase1基盤）
 * 標準ショートカット・キャンバス操作ショートカット統合管理
 */
export class ShortcutController {
    constructor(oglCore, inputController, eventStore) {
        this.oglCore = oglCore;
        this.inputController = inputController;
        this.eventStore = eventStore;
        
        // ショートカット定義
        this.shortcuts = new Map();
        this.keyState = new Map();
        this.modifierState = {
            ctrl: false,
            shift: false,
            alt: false,
            meta: false
        };
        
        // 操作モード
        this.currentMode = 'draw'; // draw, canvas, layer
        this.isSpacePressed = false;
        this.isVPressed = false;
        
        // ヒント表示
        this.hintElement = null;
        this.hintTimer = null;
        
        this.initializeShortcuts();
        this.setupEventListeners();
        this.createHintUI();
    }
    
    // 標準ショートカット初期化
    initializeShortcuts() {
        // 🔧 基本操作（Phase1）
        this.registerShortcut('ctrl+z', () => this.executeUndo(), 'アンドゥ');
        this.registerShortcut('ctrl+y', () => this.executeRedo(), 'リドゥ');
        this.registerShortcut('ctrl+shift+z', () => this.executeRedo(), 'リドゥ（代替）');
        this.registerShortcut('delete', () => this.clearLayer(), 'レイヤー内消去');
        this.registerShortcut('ctrl+0', () => this.resetView(), 'ビューリセット');
        
        // 🎨 ツール切り替え（Phase1基盤）
        this.registerShortcut('p', () => this.switchTool('pen'), 'ペンツール');
        this.registerShortcut('e', () => this.switchTool('eraser'), '消しゴムツール');
        this.registerShortcut('a', () => this.switchTool('airspray'), 'エアスプレーツール');
        this.registerShortcut('s', () => this.switchTool('selection'), '選択ツール');
        this.registerShortcut('g', () => this.switchTool('fill'), '塗りつぶしツール');
        this.registerShortcut('i', () => this.switchTool('eyedropper'), 'スポイトツール');
        this.registerShortcut('t', () => this.switchTool('text'), 'テキストツール');
        
        // 🔄 キャンバス操作（Phase1基盤）
        this.registerShortcut('h', () => this.flipCanvas('horizontal'), 'キャンバス左右反転');
        this.registerShortcut('shift+h', () => this.flipCanvas('vertical'), 'キャンバス上下反転');
        
        // 📐 レイヤー内絵画操作（Phase1基盤）
        this.registerShortcut('v+h', () => this.flipLayer('horizontal'), 'レイヤー内絵画左右反転');
        this.registerShortcut('v+shift+h', () => this.flipLayer('vertical'), 'レイヤー内絵画上下反転');
        
        // 🎬 アニメーション（Phase4で拡張）
        this.registerShortcut('f', () => this.toggleFullscreen(), 'フルスクリーン切り替え');
        this.registerShortcut('tab', () => this.toggleUI(), 'UI表示切り替え');
        this.registerShortcut('escape', () => this.cancelOperation(), 'キャンセル');
        
        // 🚀 開発者用（Phase1デバッグ）
        if (process.env.NODE_ENV === 'development') {
            this.registerShortcut('ctrl+shift+d', () => this.showDebugInfo(), 'デバッグ情報表示');
            this.registerShortcut('ctrl+shift+r', () => this.resetAll(), '完全リセット');
        }
        
        console.log('✅ Shortcuts initialized:', this.shortcuts.size, 'shortcuts registered');
    }
    
    // ショートカット登録
    registerShortcut(combination, action, description = '') {
        const normalized = this.normalizeShortcut(combination);
        this.shortcuts.set(normalized, {
            action,
            description,
            combination: normalized
        });
    }
    
    // ショートカット正規化
    normalizeShortcut(combination) {
        return combination.toLowerCase()
            .replace(/\s+/g, '')
            .split('+')
            .sort((a, b) => {
                const order = ['ctrl', 'shift', 'alt', 'meta'];
                const aIndex = order.indexOf(a);
                const bIndex = order.indexOf(b);
                if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
                if (aIndex !== -1) return -1;
                if (bIndex !== -1) return 1;
                return a.localeCompare(b);
            })
            .join('+');
    }
    
    // イベントリスナー設定
    setupEventListeners() {
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
        
        // フォーカス管理
        document.addEventListener('blur', () => this.resetKeyState());
        window.addEventListener('blur', () => this.resetKeyState());
    }
    
    // キー押下処理
    handleKeyDown(e) {
        // 入力要素での無効化
        if (this.isInputElement(e.target)) return;
        
        const key = e.key.toLowerCase();
        this.keyState.set(key, true);
        
        // モディファイアキー更新
        this.updateModifierState(e);
        
        // 特殊操作モード処理
        this.handleSpecialModes(key, e);
        
        // ショートカット実行
        const shortcut = this.buildCurrentShortcut(key);
        if (this.executeShortcut(shortcut, e)) {
            e.preventDefault();
            e.stopPropagation();
        }
    }
    
    // キー離し処理
    handleKeyUp(e) {
        const key = e.key.toLowerCase();
        this.keyState.set(key, false);
        
        // モディファイアキー更新
        this.updateModifierState(e);
        
        // 特殊モード解除
        this.handleSpecialModeRelease(key);
    }
    
    // モディファイアキー状態更新
    updateModifierState(e) {
        this.modifierState.ctrl = e.ctrlKey;
        this.modifierState.shift = e.shiftKey;
        this.modifierState.alt = e.altKey;
        this.modifierState.meta = e.metaKey;
    }
    
    // 特殊操作モード処理
    handleSpecialModes(key, e) {
        // Spaceキー: キャンバス移動モード
        if (key === ' ' && !this.isSpacePressed) {
            this.isSpacePressed = true;
            this.currentMode = 'canvas';
            this.setCursor('grab');
            this.showHint('キャンバス移動モード: ドラッグで移動');
            e.preventDefault();
        }
        
        // Vキー: レイヤー内絵画操作モード
        if (key === 'v' && !this.isVPressed) {
            this.isVPressed = true;
            this.currentMode = 'layer';
            this.setCursor('move');
            this.showHint('レイヤー内絵画移動モード');
            e.preventDefault();
        }
    }
    
    // 特殊モード解除
    handleSpecialModeRelease(key) {
        if (key === ' ' && this.isSpacePressed) {
            this.isSpacePressed = false;
            this.currentMode = 'draw';
            this.setCursor('crosshair');
            this.hideHint();
        }
        
        if (key === 'v' && this.isVPressed) {
            this.isVPressed = false;
            this.currentMode = 'draw';
            this.setCursor('crosshair');
            this.hideHint();
        }
    }
    
    // 現在のショートカット構築
    buildCurrentShortcut(key) {
        const parts = [];
        
        if (this.modifierState.ctrl) parts.push('ctrl');
        if (this.modifierState.shift) parts.push('shift');
        if (this.modifierState.alt) parts.push('alt');
        if (this.modifierState.meta) parts.push('meta');
        
        // 特殊キー処理
        if (this.isVPressed && key !== 'v') {
            parts.push('v');
        }
        
        parts.push(key);
        return parts.join('+');
    }
    
    // ショートカット実行
    executeShortcut(shortcut, event) {
        const shortcutData = this.shortcuts.get(shortcut);
        if (!shortcutData) return false;
        
        try {
            shortcutData.action(event);
            console.log(`🔥 Shortcut executed: ${shortcut} - ${shortcutData.description}`);
            this.showHint(`${shortcutData.description}`, 1000);
            return true;
        } catch (error) {
            console.error(`🚨 Shortcut execution failed: ${shortcut}`, error);
            this.eventStore.emit(this.eventStore.eventTypes.ENGINE_ERROR, { error, shortcut });
            return false;
        }
    }
    
    // ショートカット実行メソッド群
    executeUndo() {
        // Phase1: 基本アンドゥ（HistoryControllerで拡張）
        console.log('🔄 Undo executed');
        this.eventStore.emit(this.eventStore.eventTypes.HISTORY_CHANGE, { action: 'undo' });
    }
    
    executeRedo() {
        // Phase1: 基本リドゥ（HistoryControllerで拡張）
        console.log('🔄 Redo executed');
        this.eventStore.emit(this.eventStore.eventTypes.HISTORY_CHANGE, { action: 'redo' });
    }
    
    clearLayer() {
        // Phase1: 基本レイヤークリア（LayerProcessorで拡張）
        console.log('🗑️ Layer cleared');
        this.eventStore.emit(this.eventStore.eventTypes.LAYER_DELETE, { type: 'clear' });
    }
    
    resetView() {
        if (this.inputController) {
            this.inputController.resetCanvas();
            this.showHint('ビューをリセットしました');
        }
    }
    
    switchTool(toolName) {
        if (this.oglCore) {
            this.oglCore.setTool(toolName);
            this.showHint(`${toolName.toUpperCase()}ツールに切り替え`);
        }
    }
    
    flipCanvas(direction) {
        console.log(`🔄 Canvas flip: ${direction}`);
        this.eventStore.emit(this.eventStore.eventTypes.CANVAS_TRANSFORM, {
            type: 'flip',
            direction
        });
        this.showHint(`キャンバス${direction === 'horizontal' ? '左右' : '上下'}反転`);
    }
    
    flipLayer(direction) {
        console.log(`🔄 Layer flip: ${direction}`);
        this.eventStore.emit(this.eventStore.eventTypes.LAYER_SELECT, {
            type: 'flip',
            direction
        });
        this.showHint(`レイヤー内絵画${direction === 'horizontal' ? '左右' : '上下'}反転`);
    }
    
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            document.body.classList.add('fullscreen-drawing');
            this.showHint('フルスクリーンモード');
        } else {
            document.exitFullscreen();
            document.body.classList.remove('fullscreen-drawing');
            this.showHint('フルスクリーン解除');
        }
    }
    
    toggleUI() {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.toggle('collapsed');
            this.showHint(sidebar.classList.contains('collapsed') ? 'UI非表示' : 'UI表示');
        }
    }
    
    cancelOperation() {
        // 現在の操作をキャンセル
        if (this.oglCore.isDrawing) {
            this.oglCore.endStroke();
        }
        
        // ポップアップを閉じる
        this.eventStore.emit(this.eventStore.eventTypes.UI_POPUP_CLOSE, { all: true });
        this.showHint('操作をキャンセル');
    }
    
    // 開発者用メソッド
    showDebugInfo() {
        const debugInfo = {
            shortcuts: this.shortcuts.size,
            keyState: Object.fromEntries(
                Array.from(this.keyState.entries()).filter(([k, v]) => v)
            ),
            modifierState: this.modifierState,
            currentMode: this.currentMode,
            oglCore: this.oglCore?.getDebugInfo(),
            inputController: this.inputController?.getDebugInfo()
        };
        
        console.log('🔧 Debug Info:', debugInfo);
        alert(JSON.stringify(debugInfo, null, 2));
    }
    
    resetAll() {
        if (confirm('全てをリセットしますか？')) {
            location.reload();
        }
    }
    
    // ヒントUI作成
    createHintUI() {
        this.hintElement = document.getElementById('shortcutHint');
        if (!this.hintElement) {
            this.hintElement = document.createElement('div');
            this.hintElement.id = 'shortcutHint';
            this.hintElement.className = 'shortcut-hint';
            this.hintElement.textContent = 'Tab: レイヤー | P: ツール | F: フルスクリーン | Esc: 閉じる';
            document.body.appendChild(this.hintElement);
        }
    }
    
    // ヒント表示
    showHint(message, duration = 2000) {
        if (!this.hintElement) return;
        
        clearTimeout(this.hintTimer);
        this.hintElement.textContent = message;
        this.hintElement.classList.add('visible');
        
        this.hintTimer = setTimeout(() => {
            this.hideHint();
        }, duration);
    }
    
    // ヒント非表示
    hideHint() {
        if (this.hintElement) {
            this.hintElement.classList.remove('visible');
        }
        clearTimeout(this.hintTimer);
    }
    
    // カーソル設定
    setCursor(cursorType) {
        const canvas = this.oglCore?.canvas;
        if (canvas) {
            canvas.style.cursor = cursorType;
        }
    }
    
    // 入力要素判定
    isInputElement(element) {
        const inputTypes = ['input', 'textarea', 'select', 'option'];
        return inputTypes.includes(element.tagName.toLowerCase()) ||
               element.contentEditable === 'true';
    }
    
    // キー状態リセット
    resetKeyState() {
        this.keyState.clear();
        this.modifierState = {
            ctrl: false,
            shift: false,
            alt: false,
            meta: false
        };
        this.isSpacePressed = false;
        this.isVPressed = false;
        this.currentMode = 'draw';
        this.setCursor('crosshair');
    }
    
    // ショートカット一覧取得
    getShortcutList() {
        return Array.from(this.shortcuts.entries()).map(([combination, data]) => ({
            combination,
            description: data.description
        }));
    }
    
    // ショートカット削除
    removeShortcut(combination) {
        const normalized = this.normalizeShortcut(combination);
        return this.shortcuts.delete(normalized);
    }
    
    // 全ショートカット無効化
    disableAllShortcuts() {
        const originalSize = this.shortcuts.size;
        this.shortcuts.clear();
        console.log(`🚫 All shortcuts disabled (${originalSize} shortcuts)`);
    }
    
    // ショートカット有効/無効切り替え
    setShortcutEnabled(combination, enabled = true) {
        const normalized = this.normalizeShortcut(combination);
        const shortcut = this.shortcuts.get(normalized);
        
        if (shortcut) {
            shortcut.enabled = enabled;
            console.log(`${enabled ? '✅' : '🚫'} Shortcut ${combination}: ${enabled ? 'enabled' : 'disabled'}`);
        }
    }
    
    // カスタムショートカット追加（Phase2で拡張）
    addCustomShortcut(combination, action, description = 'Custom shortcut') {
        this.registerShortcut(combination, action, description);
        console.log(`➕ Custom shortcut added: ${combination}`);
    }
    
    // コンテキスト別ショートカット（Phase2で拡張）
    setContext(context) {
        this.currentContext = context;
        console.log(`🎯 Context changed: ${context}`);
        
        // コンテキスト別ヒント表示
        this.updateContextHints(context);
    }
    
    // コンテキスト別ヒント更新
    updateContextHints(context) {
        let hintText = '';
        
        switch (context) {
            case 'drawing':
                hintText = 'P: ペン | E: 消しゴム | Space: 移動 | H: 反転';
                break;
            case 'selection':
                hintText = 'Ctrl+C: コピー | Ctrl+V: 貼り付け | Del: 削除';
                break;
            case 'animation':
                hintText = 'Space: 再生/停止 | ←→: フレーム移動 | F: フルスクリーン';
                break;
            default:
                hintText = 'Tab: UI切り替え | F: フルスクリーン | Esc: キャンセル';
        }
        
        if (this.hintElement) {
            this.hintElement.textContent = hintText;
        }
    }
    
    // イベント購読（Phase1基盤連携）
    setupEventSubscriptions() {
        // ツール変更時のヒント更新
        this.eventStore.on(this.eventStore.eventTypes.TOOL_CHANGE, (data) => {
            this.updateToolHints(data.payload.tool);
        });
        
        // UI状態変更時のショートカット有効性更新
        this.eventStore.on(this.eventStore.eventTypes.UI_POPUP_OPEN, (data) => {
            this.setShortcutContext('popup');
        });
        
        this.eventStore.on(this.eventStore.eventTypes.UI_POPUP_CLOSE, (data) => {
            this.setShortcutContext('drawing');
        });
    }
    
    // ツール別ヒント更新
    updateToolHints(tool) {
        const toolHints = {
            pen: '筆圧: サポート | サイズ: [ ] | 不透明度: Shift+[ ]',
            eraser: 'サイズ: [ ] | 硬さ: Shift+[ ] | 完全消去: Shift+E',
            airspray: '密度: [ ] | 拡散: Shift+[ ] | 強度: Ctrl+[ ]',
            selection: '追加: Shift | 減算: Alt | 移動: ドラッグ',
            fill: '許容値: [ ] | 隣接: Shift+クリック | 全域: Ctrl+クリック'
        };
        
        const hint = toolHints[tool] || '';
        if (hint) {
            this.showHint(`${tool.toUpperCase()}: ${hint}`, 3000);
        }
    }
    
    // ショートカットコンテキスト設定
    setShortcutContext(context) {
        this.currentContext = context;
        
        // コンテキスト別ショートカット有効性制御
        switch (context) {
            case 'popup':
                // ポップアップ表示中は一部ショートカット無効化
                this.setShortcutEnabled('p', false);
                this.setShortcutEnabled('e', false);
                this.setShortcutEnabled('a', false);
                break;
            case 'drawing':
            default:
                // 描画モードでは全ショートカット有効
                this.setShortcutEnabled('p', true);
                this.setShortcutEnabled('e', true);
                this.setShortcutEnabled('a', true);
                break;
        }
    }
    
    // パフォーマンス最適化
    optimizeShortcutHandling() {
        // 使用頻度の低いショートカットを遅延評価
        const infrequentShortcuts = ['ctrl+shift+d', 'ctrl+shift+r'];
        
        infrequentShortcuts.forEach(shortcut => {
            const shortcutData = this.shortcuts.get(shortcut);
            if (shortcutData) {
                shortcutData.lazy = true;
            }
        });
    }
    
    // デバッグ用ショートカット統計
    getShortcutStats() {
        const stats = {
            total: this.shortcuts.size,
            enabled: 0,
            disabled: 0,
            contexts: {},
            mostUsed: null // Phase2で使用統計追加
        };
        
        this.shortcuts.forEach((shortcut, combination) => {
            if (shortcut.enabled !== false) {
                stats.enabled++;
            } else {
                stats.disabled++;
            }
        });
        
        return stats;
    }
    
    // クリーンアップ
    destroy() {
        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('keyup', this.handleKeyUp);
        document.removeEventListener('blur', this.resetKeyState);
        window.removeEventListener('blur', this.resetKeyState);
        
        if (this.hintElement) {
            this.hintElement.remove();
        }
        
        clearTimeout(this.hintTimer);
        this.shortcuts.clear();
        this.keyState.clear();
        
        console.log('✅ Shortcut controller destroyed');
    }
}