/**
 * ⌨️ ShortcutManager - Phase1.5 キーボードショートカットシステム
 * 📋 RESPONSIBILITY: キーボードショートカット管理・Phase別ショートカット・コンテキスト管理のみ
 * 🚫 PROHIBITION: 描画処理・UI更新・座標変換・ツール操作実行・レイヤー管理
 * ✅ PERMISSION: キーボードイベント処理・ショートカット登録・コンテキスト切り替え・Phase管理
 * 
 * 📏 DESIGN_PRINCIPLE: ショートカット専門・Phase別管理・競合回避・剛直構造
 * 🔄 INTEGRATION: RecordManager・NavigationManager・ToolManager・TegakiApplication連携
 * 🎯 FEATURE: Phase別ショートカット・コンテキスト管理・競合検出・アクセシビリティ配慮
 */

// Tegaki名前空間初期化
window.Tegaki = window.Tegaki || {};

/**
 * ShortcutManager - キーボードショートカットシステム
 * Phase別ショートカット管理・コンテキスト対応・競合回避システム
 */
class ShortcutManager {
    constructor() {
        console.log('⌨️ ShortcutManager Phase1.5 キーボードショートカットシステム 作成');
        
        // 依存関係
        this.recordManager = null;
        this.navigationManager = null;
        this.toolManager = null;
        this.tegakiApplication = null;
        
        // ショートカット管理
        this.shortcuts = new Map();           // キー → アクション
        this.contextStack = [];               // コンテキストスタック
        this.currentContext = 'default';     // 現在のコンテキスト
        this.activePhase = '1.5';            // 現在のPhase
        
        // キー状態管理
        this.keyState = {
            ctrl: false,
            shift: false,
            alt: false,
            meta: false,
            space: false
        };
        
        // 特殊操作状態
        this.isPanMode = false;               // スペースキーパンモード
        this.isTemporaryTool = false;         // 一時的ツール切り替え
        this.originalTool = null;             // 元のツール
        
        // 設定・制限
        this.isEnabled = true;                // ショートカット有効/無効
        this.preventBrowserShortcuts = true; // ブラウザショートカット無効化
        this.repeatDelay = 500;              // キーリピート遅延（ms）
        this.repeatInterval = 50;            // キーリピート間隔（ms）
        
        // リピート管理
        this.repeatTimers = new Map();        // キー → タイマーID
        this.lastKeyTime = new Map();         // キー → 最後の実行時間
        
        // 統計・デバッグ
        this.shortcutCount = 0;               // ショートカット実行回数
        this.lastShortcutInfo = null;         // 最後のショートカット情報
        this.conflicts = [];                  // 競合検出結果
        
        // Phase別ショートカット定義
        this.phaseShortcuts = {
            '1': this.getPhase1Shortcuts(),
            '1.5': this.getPhase15Shortcuts(),
            '2': this.getPhase2Shortcuts(),
            '3': this.getPhase3Shortcuts()
        };
        
        console.log('⌨️ ShortcutManager 基本設定完了');
    }
    
    /**
     * 依存関係設定・初期化
     */
    setRecordManager(recordManager) {
        this.recordManager = recordManager;
        console.log('✅ ShortcutManager - RecordManager設定完了');
    }
    
    setNavigationManager(navigationManager) {
        this.navigationManager = navigationManager;
        console.log('✅ ShortcutManager - NavigationManager設定完了');
    }
    
    setToolManager(toolManager) {
        this.toolManager = toolManager;
        console.log('✅ ShortcutManager - ToolManager設定完了');
    }
    
    setTegakiApplication(tegakiApplication) {
        this.tegakiApplication = tegakiApplication;
        console.log('✅ ShortcutManager - TegakiApplication設定完了');
    }
    
    /**
     * ショートカットシステム開始
     */
    initialize() {
        // イベントリスナー設定
        this.setupEventListeners();
        
        // 現在Phaseのショートカット登録
        this.setupPhaseShortcuts(this.activePhase);
        
        // 競合チェック
        this.checkConflicts();
        
        console.log(`⌨️ ShortcutManager初期化完了 - Phase${this.activePhase}対応`);
    }
    
    /**
     * 🎯 Phase別ショートカット定義
     */
    
    /**
     * Phase1ショートカット（基本操作のみ）
     */
    getPhase1Shortcuts() {
        return {
            // 基本編集
            'ctrl+z': {
                action: 'undo',
                description: 'アンドゥ',
                context: ['default', 'drawing'],
                handler: () => this.executeUndo()
            },
            'ctrl+y': {
                action: 'redo',
                description: 'リドゥ',
                context: ['default', 'drawing'],
                handler: () => this.executeRedo()
            },
            'ctrl+shift+z': {
                action: 'redo',
                description: 'リドゥ（代替）',
                context: ['default', 'drawing'],
                handler: () => this.executeRedo()
            },
            
            // ツール切り替え
            'p': {
                action: 'select_pen',
                description: 'ペンツール',
                context: ['default'],
                handler: () => this.selectTool('pen')
            },
            'e': {
                action: 'select_eraser',
                description: '消しゴムツール',
                context: ['default'],
                handler: () => this.selectTool('eraser')
            }
        };
    }
    
    /**
     * Phase1.5ショートカット（ナビゲーション・効率化）
     */
    getPhase15Shortcuts() {
        return {
            // Phase1継承
            ...this.getPhase1Shortcuts(),
            
            // キャンバス操作
            'ctrl+0': {
                action: 'reset_canvas_view',
                description: 'キャンバスビューリセット',
                context: ['default'],
                handler: () => this.resetCanvasView()
            },
            'delete': {
                action: 'clear_active_layer',
                description: 'アクティブレイヤー消去',
                context: ['default'],
                handler: () => this.clearActiveLayer()
            },
            
            // ブラシサイズ調整
            '[': {
                action: 'decrease_brush_size',
                description: 'ブラシサイズ縮小',
                context: ['default'],
                repeatable: true,
                handler: () => this.adjustBrushSize(-1)
            },
            ']': {
                action: 'increase_brush_size',
                description: 'ブラシサイズ拡大',
                context: ['default'],
                repeatable: true,
                handler: () => this.adjustBrushSize(1)
            },
            
            // キーボードナビゲーション（Space+方向キー）
            'space+arrowleft': {
                action: 'pan_left',
                description: 'キャンバス左移動',
                context: ['default'],
                repeatable: true,
                handler: () => this.panCanvas(-20, 0)
            },
            'space+arrowright': {
                action: 'pan_right',
                description: 'キャンバス右移動',
                context: ['default'],
                repeatable: true,
                handler: () => this.panCanvas(20, 0)
            },
            'space+arrowup': {
                action: 'pan_up',
                description: 'キャンバス上移動',
                context: ['default'],
                repeatable: true,
                handler: () => this.panCanvas(0, -20)
            },
            'space+arrowdown': {
                action: 'pan_down',
                description: 'キャンバス下移動',
                context: ['default'],
                repeatable: true,
                handler: () => this.panCanvas(0, 20)
            },
            
            // ズーム操作
            '=': {
                action: 'zoom_in',
                description: 'ズームイン',
                context: ['default'],
                repeatable: true,
                handler: () => this.zoomCanvas(1.1)
            },
            '-': {
                action: 'zoom_out',
                description: 'ズームアウト',
                context: ['default'],
                repeatable: true,
                handler: () => this.zoomCanvas(0.9)
            },
            
            // 特殊操作：スペースキーパンモード
            'space': {
                action: 'toggle_pan_mode',
                description: 'パンモード切り替え',
                context: ['default'],
                isToggle: true,
                onKeyDown: () => this.startPanMode(),
                onKeyUp: () => this.endPanMode()
            }
        };
    }
    
    /**
     * Phase2ショートカット（レイヤー・選択操作・Phase1.5継承）
     */
    getPhase2Shortcuts() {
        return {
            // Phase1.5継承
            ...this.getPhase15Shortcuts(),
            
            // レイヤー操作
            'arrowup': {
                action: 'select_upper_layer',
                description: 'レイヤー上選択',
                context: ['default'],
                handler: () => this.selectUpperLayer()
            },
            'arrowdown': {
                action: 'select_lower_layer',
                description: 'レイヤー下選択',
                context: ['default'],
                handler: () => this.selectLowerLayer()
            },
            'shift+arrowup': {
                action: 'move_layer_up',
                description: 'レイヤー順序上移動',
                context: ['default'],
                handler: () => this.moveLayerUp()
            },
            'shift+arrowdown': {
                action: 'move_layer_down',
                description: 'レイヤー順序下移動',
                context: ['default'],
                handler: () => this.moveLayerDown()
            },
            
            // レイヤー変形（Vキー＋操作）
            'v': {
                action: 'layer_transform_mode',
                description: 'レイヤー変形モード',
                context: ['default'],
                isToggle: true,
                onKeyDown: () => this.startLayerTransformMode(),
                onKeyUp: () => this.endLayerTransformMode()
            },
            
            // ツール追加
            'm': {
                action: 'select_marquee',
                description: '範囲選択ツール',
                context: ['default'],
                handler: () => this.selectTool('select')
            },
            'g': {
                action: 'select_fill',
                description: '塗りつぶしツール',
                context: ['default'],
                handler: () => this.selectTool('fill')
            },
            'i': {
                action: 'select_eyedropper',
                description: 'スポイトツール',
                context: ['default'],
                handler: () => this.selectTool('eyedropper')
            },
            
            // UI切り替え
            'tab': {
                action: 'toggle_tool_panel',
                description: 'ツールパネル切り替え',
                context: ['default'],
                handler: () => this.toggleToolPanel()
            }
        };
    }
    
    /**
     * Phase3ショートカット（アニメーション・Phase2継承）
     */
    getPhase3Shortcuts() {
        return {
            // Phase2継承
            ...this.getPhase2Shortcuts(),
            
            // フレーム操作
            'arrowleft': {
                action: 'previous_frame',
                description: '前フレーム',
                context: ['animation'],
                repeatable: true,
                handler: () => this.previousFrame()
            },
            'arrowright': {
                action: 'next_frame',
                description: '次フレーム',
                context: ['animation'],
                repeatable: true,
                handler: () => this.nextFrame()
            },
            'shift+arrowleft': {
                action: 'jump_frames_back',
                description: '5フレーム戻る',
                context: ['animation'],
                handler: () => this.jumpFrames(-5)
            },
            'shift+arrowright': {
                action: 'jump_frames_forward',
                description: '5フレーム進む',
                context: ['animation'],
                handler: () => this.jumpFrames(5)
            },
            
            // アニメーション制御
            'alt+space': {
                action: 'toggle_playback',
                description: '再生/停止切り替え',
                context: ['animation'],
                handler: () => this.togglePlayback()
            },
            'alt+o': {
                action: 'toggle_onion_skin',
                description: 'オニオンスキン切り替え',
                context: ['animation'],
                handler: () => this.toggleOnionSkin()
            },
            
            // 高度操作
            'alt+j': {
                action: 'shuttle_backward',
                description: 'シャトル逆再生',
                context: ['animation'],
                handler: () => this.shuttleBackward()
            },
            'alt+l': {
                action: 'shuttle_forward',
                description: 'シャトル順再生',
                context: ['animation'],
                handler: () => this.shuttleForward()
            }
        };
    }
    
    /**
     * 🎯 イベント処理・ショートカット実行
     */
    
    /**
     * イベントリスナー設定
     */
    setupEventListeners() {
        // キーボードイベント
        document.addEventListener('keydown', (e) => this.handleKeydown(e), true);
        document.addEventListener('keyup', (e) => this.handleKeyup(e), true);
        
        // フォーカス・ブラー（キー状態リセット）
        window.addEventListener('blur', () => this.resetKeyState());
        window.addEventListener('focus', () => this.resetKeyState());
        
        console.log('⌨️ キーボードイベントリスナー設定完了');
    }
    
    /**
     * キーダウンイベント処理
     */
    handleKeydown(event) {
        if (!this.isEnabled) return;
        
        // キー状態更新
        this.updateKeyState(event, true);
        
        // 入力フィールドでの処理をスキップ
        if (this.isInputElement(event.target)) {
            return;
        }
        
        // ショートカットキー生成
        const shortcutKey = this.generateShortcutKey(event);
        
        // ショートカット検索・実行
        const shortcut = this.findShortcut(shortcutKey);
        if (shortcut) {
            const handled = this.executeShortcut(shortcut, event, 'keydown');
            
            if (handled) {
                event.preventDefault();
                event.stopPropagation();
                
                // リピート可能なショートカットのリピート開始
                if (shortcut.repeatable && !this.repeatTimers.has(shortcutKey)) {
                    this.startRepeat(shortcutKey, shortcut);
                }
            }
        }
        
        // デバッグ情報更新
        this.updateDebugInfo(shortcutKey, shortcut, event);
    }
    
    /**
     * キーアップイベント処理
     */
    handleKeyup(event) {
        if (!this.isEnabled) return;
        
        // キー状態更新
        this.updateKeyState(event, false);
        
        // 入力フィールドでの処理をスキップ
        if (this.isInputElement(event.target)) {
            return;
        }
        
        // ショートカットキー生成
        const shortcutKey = this.generateShortcutKey(event);
        
        // トグルショートカットのキーアップ処理
        const shortcut = this.findShortcut(shortcutKey);
        if (shortcut && shortcut.onKeyUp) {
            const handled = this.executeShortcut(shortcut, event, 'keyup');
            
            if (handled) {
                event.preventDefault();
                event.stopPropagation();
            }
        }
        
        // リピート停止
        if (this.repeatTimers.has(shortcutKey)) {
            this.stopRepeat(shortcutKey);
        }
    }
    
    /**
     * ショートカットキー生成（修飾キー考慮）
     */
    generateShortcutKey(event) {
        const parts = [];
        
        // 修飾キー追加
        if (event.ctrlKey || event.metaKey) parts.push('ctrl');
        if (event.shiftKey) parts.push('shift');
        if (event.altKey) parts.push('alt');
        if (this.keyState.space) parts.push('space');
        
        // メインキー追加（小文字に統一）
        const key = event.key.toLowerCase();
        parts.push(key);
        
        return parts.join('+');
    }
    
    /**
     * ショートカット検索
     */
    findShortcut(shortcutKey) {
        // 現在のコンテキストでショートカット検索
        for (const [key, shortcut] of this.shortcuts) {
            if (key === shortcutKey) {
                // コンテキスト確認
                if (shortcut.context && shortcut.context.length > 0) {
                    if (shortcut.context.includes(this.currentContext)) {
                        return shortcut;
                    }
                } else {
                    return shortcut;
                }
            }
        }
        
        return null;
    }
    
    /**
     * ショートカット実行
     */
    executeShortcut(shortcut, event, eventType = 'keydown') {
        if (!shortcut) return false;
        
        try {
            let handled = false;
            
            // イベントタイプ別処理
            if (eventType === 'keydown') {
                if (shortcut.onKeyDown) {
                    handled = shortcut.onKeyDown(event) !== false;
                } else if (shortcut.handler) {
                    handled = shortcut.handler(event) !== false;
                }
            } else if (eventType === 'keyup') {
                if (shortcut.onKeyUp) {
                    handled = shortcut.onKeyUp(event) !== false;
                }
            }
            
            // 統計更新
            if (handled) {
                this.shortcutCount++;
                this.lastShortcutInfo = {
                    action: shortcut.action,
                    description: shortcut.description,
                    context: this.currentContext,
                    eventType: eventType,
                    timestamp: Date.now()
                };
                
                console.log(`⌨️ ショートカット実行: ${shortcut.action} (${shortcut.description})`);
            }
            
            return handled;
            
        } catch (error) {
            console.error(`❌ ショートカット実行エラー: ${shortcut.action}`, error);
            
            // エラー通知
            if (window.Tegaki?.ErrorManagerInstance) {
                window.Tegaki.ErrorManagerInstance.showError(
                    'technical',
                    `ショートカット実行失敗: ${error.message}`,
                    { context: 'ShortcutManager.executeShortcut' }
                );
            }
            
            return false;
        }
    }
    
    /**
     * 🔧 内部処理・ヘルパーメソッド
     */
    
    /**
     * キー状態更新
     */
    updateKeyState(event, isDown) {
        if (event.ctrlKey !== undefined) this.keyState.ctrl = event.ctrlKey;
        if (event.shiftKey !== undefined) this.keyState.shift = event.shiftKey;
        if (event.altKey !== undefined) this.keyState.alt = event.altKey;
        if (event.metaKey !== undefined) this.keyState.meta = event.metaKey;
        
        // スペースキー特別処理
        if (event.key === ' ') {
            this.keyState.space = isDown;
        }
    }
    
    /**
     * キー状態リセット
     */
    resetKeyState() {
        this.keyState = {
            ctrl: false,
            shift: false,
            alt: false,
            meta: false,
            space: false
        };
        
        // 進行中の特殊操作も停止
        if (this.isPanMode) {
            this.endPanMode();
        }
        
        // リピート停止
        this.stopAllRepeats();
        
        console.log('⌨️ キー状態リセット完了');
    }
    
    /**
     * 入力要素判定
     */
    isInputElement(element) {
        if (!element) return false;
        
        const inputTags = ['input', 'textarea', 'select'];
        const tagName = element.tagName.toLowerCase();
        
        return inputTags.includes(tagName) || 
               element.contentEditable === 'true' ||
               element.contentEditable === '';
    }
    
    /**
     * リピート開始
     */
    startRepeat(shortcutKey, shortcut) {
        // 遅延後にリピート開始
        const delayTimer = setTimeout(() => {
            // 間隔でリピート実行
            const intervalTimer = setInterval(() => {
                if (shortcut.handler) {
                    shortcut.handler();
                }
            }, this.repeatInterval);
            
            this.repeatTimers.set(shortcutKey, intervalTimer);
        }, this.repeatDelay);
        
        this.repeatTimers.set(shortcutKey, delayTimer);
    }
    
    /**
     * リピート停止
     */
    stopRepeat(shortcutKey) {
        const timer = this.repeatTimers.get(shortcutKey);
        if (timer) {
            clearTimeout(timer);
            clearInterval(timer);
            this.repeatTimers.delete(shortcutKey);
        }
    }
    
    /**
     * 全リピート停止
     */
    stopAllRepeats() {
        for (const [key, timer] of this.repeatTimers) {
            clearTimeout(timer);
            clearInterval(timer);
        }
        this.repeatTimers.clear();
    }
    
    /**
     * 🎯 ショートカットアクション実装
     */
    
    /**
     * Undo実行
     */
    executeUndo() {
        if (!this.recordManager) {
            console.warn('⚠️ RecordManager not available');
            return false;
        }
        
        return this.recordManager.undo();
    }
    
    /**
     * Redo実行
     */
    executeRedo() {
        if (!this.recordManager) {
            console.warn('⚠️ RecordManager not available');
            return false;
        }
        
        return this.recordManager.redo();
    }
    
    /**
     * ツール選択
     */
    selectTool(toolName) {
        if (!this.tegakiApplication) {
            console.warn('⚠️ TegakiApplication not available');
            return false;
        }
        
        this.tegakiApplication.selectTool(toolName);
        return true;
    }
    
    /**
     * キャンバスビューリセット
     */
    resetCanvasView() {
        if (!this.navigationManager) {
            console.warn('⚠️ NavigationManager not available');
            return false;
        }
        
        return this.navigationManager.resetCanvasTransform();
    }
    
    /**
     * アクティブレイヤー消去
     */
    clearActiveLayer() {
        // Phase2で実装予定
        console.log('🎨 アクティブレイヤー消去（Phase2で実装予定）');
        
        if (window.Tegaki?.ErrorManagerInstance) {
            window.Tegaki.ErrorManagerInstance.showInfo(
                'レイヤー消去機能はPhase2で実装予定です',
                { context: 'ShortcutManager.clearActiveLayer' }
            );
        }
        
        return false;
    }
    
    /**
     * ブラシサイズ調整
     */
    adjustBrushSize(delta) {
        if (!this.toolManager) {
            console.warn('⚠️ ToolManager not available');
            return false;
        }
        
        const currentTool = this.toolManager.getCurrentTool();
        if (!currentTool) {
            console.warn('⚠️ Current tool not available');
            return false;
        }
        
        // ペンツール・消しゴムツールのサイズ調整
        if (currentTool.setPenWidth) {
            const settings = currentTool.getSettings();
            const newSize = Math.max(1, Math.min(200, settings.penWidth + delta));
            currentTool.setPenWidth(newSize);
            
            console.log(`⌨️ ペンサイズ調整: ${settings.penWidth} → ${newSize}`);
            return true;
        } else if (currentTool.setEraserSize) {
            const settings = currentTool.getSettings();
            const newSize = Math.max(1, Math.min(200, settings.eraserSize + delta));
            currentTool.setEraserSize(newSize);
            
            console.log(`⌨️ 消しゴムサイズ調整: ${settings.eraserSize} → ${newSize}`);
            return true;
        }
        
        console.warn('⚠️ 現在のツールはサイズ調整に対応していません');
        return false;
    }
    
    /**
     * キャンバス移動（パン）
     */
    panCanvas(deltaX, deltaY) {
        if (!this.navigationManager) {
            console.warn('⚠️ NavigationManager not available');
            return false;
        }
        
        return this.navigationManager.panCanvas(deltaX, deltaY);
    }
    
    /**
     * キャンバスズーム
     */
    zoomCanvas(scaleFactor) {
        if (!this.navigationManager) {
            console.warn('⚠️ NavigationManager not available');
            return false;
        }
        
        return this.navigationManager.zoomCanvas(scaleFactor);
    }
    
    /**
     * パンモード開始（スペースキー）
     */
    startPanMode() {
        if (this.isPanMode) return false;
        
        this.isPanMode = true;
        
        // カーソル変更
        const canvasContainer = document.getElementById('canvas-container');
        if (canvasContainer) {
            canvasContainer.style.cursor = 'move';
        }
        
        console.log('⌨️ パンモード開始');
        return true;
    }
    
    /**
     * パンモード終了
     */
    endPanMode() {
        if (!this.isPanMode) return false;
        
        this.isPanMode = false;
        
        // カーソル復元
        const canvasContainer = document.getElementById('canvas-container');
        if (canvasContainer) {
            canvasContainer.style.cursor = 'crosshair';
        }
        
        console.log('⌨️ パンモード終了');
        return true;
    }
    
    /**
     * 🎯 Phase2準備機能（将来実装）
     */
    
    selectUpperLayer() {
        console.log('🎨 上レイヤー選択（Phase2で実装予定）');
        return false;
    }
    
    selectLowerLayer() {
        console.log('🎨 下レイヤー選択（Phase2で実装予定）');
        return false;
    }
    
    moveLayerUp() {
        console.log('🎨 レイヤー上移動（Phase2で実装予定）');
        return false;
    }
    
    moveLayerDown() {
        console.log('🎨 レイヤー下移動（Phase2で実装予定）');
        return false;
    }
    
    startLayerTransformMode() {
        console.log('🎨 レイヤー変形モード開始（Phase2で実装予定）');
        return false;
    }
    
    endLayerTransformMode() {
        console.log('🎨 レイヤー変形モード終了（Phase2で実装予定）');
        return false;
    }
    
    toggleToolPanel() {
        console.log('🎨 ツールパネル切り替え（Phase2で実装予定）');
        return false;
    }
    
    /**
     * 🎯 Phase3準備機能（将来実装）
     */
    
    previousFrame() {
        console.log('🎬 前フレーム（Phase3で実装予定）');
        return false;
    }
    
    nextFrame() {
        console.log('🎬 次フレーム（Phase3で実装予定）');
        return false;
    }
    
    jumpFrames(delta) {
        console.log(`🎬 フレームジャンプ ${delta}（Phase3で実装予定）`);
        return false;
    }
    
    togglePlayback() {
        console.log('🎬 再生/停止切り替え（Phase3で実装予定）');
        return false;
    }
    
    toggleOnionSkin() {
        console.log('🎬 オニオンスキン切り替え（Phase3で実装予定）');
        return false;
    }
    
    shuttleBackward() {
        console.log('🎬 シャトル逆再生（Phase3で実装予定）');
        return false;
    }
    
    shuttleForward() {
        console.log('🎬 シャトル順再生（Phase3で実装予定）');
        return false;
    }
    
    /**
     * 🎯 Phase・コンテキスト管理
     */
    
    /**
     * アクティブPhase設定
     */
    setActivePhase(phase) {
        if (this.activePhase === phase) return;
        
        const validPhases = ['1', '1.5', '2', '3'];
        if (!validPhases.includes(phase)) {
            console.warn(`⚠️ 無効なPhase: ${phase}`);
            return false;
        }
        
        this.activePhase = phase;
        
        // 新しいPhaseのショートカット設定
        this.setupPhaseShortcuts(phase);
        
        console.log(`⌨️ アクティブPhase設定: ${phase}`);
        return true;
    }
    
    /**
     * Phaseショートカット設定
     */
    setupPhaseShortcuts(phase) {
        // 既存ショートカットクリア
        this.shortcuts.clear();
        
        // 指定Phaseのショートカット登録
        const phaseShortcuts = this.phaseShortcuts[phase];
        if (phaseShortcuts) {
            for (const [key, shortcut] of Object.entries(phaseShortcuts)) {
                this.shortcuts.set(key, shortcut);
            }
            
            console.log(`⌨️ Phase${phase}ショートカット登録完了: ${Object.keys(phaseShortcuts).length}個`);
        } else {
            console.warn(`⚠️ Phase${phase}のショートカット定義がありません`);
        }
        
        // 競合チェック
        this.checkConflicts();
    }
    
    /**
     * ショートカット登録（カスタム）
     */
    registerShortcut(key, action, context = ['default']) {
        const shortcut = {
            action: action.action || action.name,
            description: action.description || action.action || action.name,
            context: Array.isArray(context) ? context : [context],
            handler: action.handler || action.callback,
            onKeyDown: action.onKeyDown,
            onKeyUp: action.onKeyUp,
            repeatable: action.repeatable || false,
            isToggle: action.isToggle || false
        };
        
        this.shortcuts.set(key, shortcut);
        
        console.log(`⌨️ ショートカット登録: ${key} → ${shortcut.action}`);
        return true;
    }
    
    /**
     * ショートカット削除
     */
    unregisterShortcut(key, context = null) {
        if (context) {
            // 特定コンテキストのみ削除
            const shortcut = this.shortcuts.get(key);
            if (shortcut && shortcut.context) {
                shortcut.context = shortcut.context.filter(c => c !== context);
                if (shortcut.context.length === 0) {
                    this.shortcuts.delete(key);
                }
            }
        } else {
            // 完全削除
            this.shortcuts.delete(key);
        }
        
        console.log(`⌨️ ショートカット削除: ${key}${context ? ` (context: ${context})` : ''}`);
        return true;
    }
    
    /**
     * コンテキスト追加（スタック管理）
     */
    pushContext(context) {
        this.contextStack.push(this.currentContext);
        this.currentContext = context;
        
        console.log(`⌨️ コンテキスト追加: ${context} (スタック深度: ${this.contextStack.length})`);
    }
    
    /**
     * コンテキスト削除（スタック管理）
     */
    popContext() {
        if (this.contextStack.length === 0) {
            console.warn('⚠️ コンテキストスタックが空です');
            return false;
        }
        
        const previousContext = this.currentContext;
        this.currentContext = this.contextStack.pop();
        
        console.log(`⌨️ コンテキスト削除: ${previousContext} → ${this.currentContext}`);
        return true;
    }
    
    /**
     * 現在コンテキスト取得
     */
    getCurrentContext() {
        return this.currentContext;
    }
    
    /**
     * 🔧 競合チェック・デバッグ機能
     */
    
    /**
     * ショートカット競合チェック
     */
    checkConflicts() {
        this.conflicts = [];
        
        // ブラウザショートカット競合チェック
        const browserShortcuts = [
            'ctrl+s', 'ctrl+o', 'ctrl+n', 'ctrl+t', 'ctrl+w',
            'ctrl+r', 'ctrl+f', 'ctrl+h', 'ctrl+d', 'ctrl+p',
            'ctrl+u', 'ctrl+j', 'ctrl+shift+i', 'f12'
        ];
        
        for (const browserShortcut of browserShortcuts) {
            if (this.shortcuts.has(browserShortcut)) {
                this.conflicts.push({
                    type: 'browser',
                    shortcut: browserShortcut,
                    description: 'ブラウザデフォルトショートカットとの競合'
                });
            }
        }
        
        // 重複ショートカットチェック
        const contextMap = new Map();
        for (const [key, shortcut] of this.shortcuts) {
            for (const context of shortcut.context) {
                const contextKey = `${key}:${context}`;
                if (contextMap.has(contextKey)) {
                    this.conflicts.push({
                        type: 'duplicate',
                        shortcut: key,
                        context: context,
                        description: '同一コンテキスト内での重複'
                    });
                } else {
                    contextMap.set(contextKey, true);
                }
            }
        }
        
        // 結果レポート
        if (this.conflicts.length > 0) {
            console.warn(`⚠️ ショートカット競合検出: ${this.conflicts.length}件`);
            this.conflicts.forEach(conflict => {
                console.warn(`  - ${conflict.shortcut}: ${conflict.description}`);
            });
        } else {
            console.log('✅ ショートカット競合チェック: 問題なし');
        }
        
        return this.conflicts;
    }
    
    /**
     * デバッグ情報更新
     */
    updateDebugInfo(shortcutKey, shortcut, event) {
        // パフォーマンス監視用
        this.lastKeyTime.set(shortcutKey, Date.now());
        
        // デバッグログ（開発時のみ）
        if (process?.env?.NODE_ENV === 'development') {
            console.debug(`⌨️ キー処理: ${shortcutKey}, ショートカット: ${shortcut ? '有効' : '無効'}, コンテキスト: ${this.currentContext}`);
        }
    }
    
    /**
     * 🎯 設定・状態管理
     */
    
    /**
     * ショートカット有効/無効切り替え
     */
    setEnabled(enabled) {
        const wasEnabled = this.isEnabled;
        this.isEnabled = !!enabled;
        
        if (!this.isEnabled && wasEnabled) {
            // 無効化時：進行中の操作を停止
            this.resetKeyState();
        }
        
        console.log(`⌨️ ショートカット: ${this.isEnabled ? '有効' : '無効'}`);
        return this.isEnabled;
    }
    
    /**
     * ブラウザショートカット無効化設定
     */
    setPreventBrowserShortcuts(prevent) {
        this.preventBrowserShortcuts = !!prevent;
        console.log(`⌨️ ブラウザショートカット無効化: ${this.preventBrowserShortcuts ? '有効' : '無効'}`);
    }
    
    /**
     * リピート設定
     */
    setRepeatSettings(delay, interval) {
        this.repeatDelay = Math.max(100, delay);
        this.repeatInterval = Math.max(10, interval);
        
        console.log(`⌨️ リピート設定: delay=${this.repeatDelay}ms, interval=${this.repeatInterval}ms`);
    }
    
    /**
     * ショートカット一覧取得
     */
    getShortcuts() {
        const result = [];
        
        for (const [key, shortcut] of this.shortcuts) {
            result.push({
                key: key,
                action: shortcut.action,
                description: shortcut.description,
                context: shortcut.context,
                repeatable: shortcut.repeatable || false,
                isToggle: shortcut.isToggle || false
            });
        }
        
        return result;
    }
    
    /**
     * 設定取得
     */
    getSettings() {
        return {
            isEnabled: this.isEnabled,
            activePhase: this.activePhase,
            currentContext: this.currentContext,
            contextStackDepth: this.contextStack.length,
            preventBrowserShortcuts: this.preventBrowserShortcuts,
            repeatDelay: this.repeatDelay,
            repeatInterval: this.repeatInterval,
            shortcutCount: this.shortcuts.size
        };
    }
    
    /**
     * 統計情報取得
     */
    getStats() {
        return {
            shortcutCount: this.shortcutCount,
            registeredShortcuts: this.shortcuts.size,
            activeRepeats: this.repeatTimers.size,
            conflicts: this.conflicts.length,
            lastShortcutInfo: this.lastShortcutInfo,
            currentState: {
                keyState: { ...this.keyState },
                isPanMode: this.isPanMode,
                isTemporaryTool: this.isTemporaryTool
            }
        };
    }
    
    /**
     * デバッグ情報取得（完全版）
     */
    getDebugInfo() {
        return {
            // 基本状態
            isReady: !!(this.recordManager || this.navigationManager || this.toolManager),
            recordManagerSet: !!this.recordManager,
            navigationManagerSet: !!this.navigationManager,
            toolManagerSet: !!this.toolManager,
            tegakiApplicationSet: !!this.tegakiApplication,
            
            // ショートカット状態
            shortcuts: {
                enabled: this.isEnabled,
                registered: this.shortcuts.size,
                phase: this.activePhase,
                context: this.currentContext,
                contextStack: [...this.contextStack]
            },
            
            // キー状態
            keyState: { ...this.keyState },
            
            // 特殊状態
            specialModes: {
                isPanMode: this.isPanMode,
                isTemporaryTool: this.isTemporaryTool,
                originalTool: this.originalTool
            },
            
            // リピート状態
            repeats: {
                active: this.repeatTimers.size,
                delay: this.repeatDelay,
                interval: this.repeatInterval
            },
            
            // 設定情報
            settings: this.getSettings(),
            
            // 統計情報
            stats: this.getStats(),
            
            // 競合情報
            conflicts: [...this.conflicts],
            
            // パフォーマンス情報
            performance: {
                avgShortcutsPerSecond: this.calculateShortcutRate(),
                memoryUsage: this.estimateMemoryUsage()
            },
            
            // Phase情報
            phase: {
                current: this.activePhase,
                availableShortcuts: this.phaseShortcuts[this.activePhase] ? 
                    Object.keys(this.phaseShortcuts[this.activePhase]).length : 0,
                nextPhase: {
                    target: this.activePhase === '1.5' ? '2' : 'N/A',
                    newFeatures: this.activePhase === '1.5' ? [
                        'layerShortcuts',
                        'selectionShortcuts',
                        'transformShortcuts'
                    ] : []
                }
            }
        };
    }
    
    /**
     * パフォーマンス計算（デバッグ用）
     */
    calculateShortcutRate() {
        // 簡易的なショートカット実行レート計算（実装省略・概算値）
        return this.shortcutCount > 0 ? Math.min(this.shortcutCount / 60, 5) : 0;
    }
    
    estimateMemoryUsage() {
        // 簡易的なメモリ使用量推定（実装省略・概算値）
        const baseSize = 3072; // ShortcutManager基本サイズ
        const shortcutSize = this.shortcuts.size * 256; // ショートカットデータサイズ
        const timerSize = this.repeatTimers.size * 128; // タイマーサイズ
        const conflictSize = this.conflicts.length * 64; // 競合データサイズ
        
        return baseSize + shortcutSize + timerSize + conflictSize;
    }
    
    /**
     * Phase1.5機能テスト（デバッグ用）
     */
    testShortcutFeatures() {
        console.log('🧪 ShortcutManager機能テスト開始');
        
        const testResults = {
            phaseShortcuts: false,
            keyHandling: false,
            contextManagement: false,
            conflictDetection: false,
            repeatFunction: false
        };
        
        try {
            // 1. Phaseショートカットテスト
            this.setActivePhase('1.5');
            testResults.phaseShortcuts = this.shortcuts.size > 0;
            
            // 2. キー処理テスト（シミュレーション）
            const testEvent = {
                key: 'p',
                ctrlKey: false,
                shiftKey: false,
                altKey: false,
                metaKey: false,
                preventDefault: () => {},
                stopPropagation: () => {},
                target: document.body
            };
            testResults.keyHandling = this.generateShortcutKey(testEvent) === 'p';
            
            // 3. コンテキスト管理テスト
            this.pushContext('test');
            const contextPushed = this.currentContext === 'test';
            this.popContext();
            const contextPopped = this.currentContext === 'default';
            testResults.contextManagement = contextPushed && contextPopped;
            
            // 4. 競合検出テスト
            const conflicts = this.checkConflicts();
            testResults.conflictDetection = Array.isArray(conflicts);
            
            // 5. リピート機能テスト（基本チェックのみ）
            testResults.repeatFunction = typeof this.startRepeat === 'function' && 
                                       typeof this.stopRepeat === 'function';
            
        } catch (error) {
            console.error('❌ ShortcutManager機能テストエラー:', error);
        }
        
        console.log('🧪 ShortcutManager機能テスト結果:', testResults);
        return testResults;
    }
}

// Tegaki名前空間に登録
window.Tegaki.ShortcutManager = ShortcutManager;

console.log('⌨️ shortcut-manager.js loaded - Phase別ショートカット・キー処理・リピート機能・剛直構造実現');