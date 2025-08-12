/**
 * ui-events.js - STEP 5クリーンアップ版
 * 
 * 変更内容:
 * ❌ 削除: ペンツール専用キーボードショートカット（P+数字、R/Shift+R）
 * ❌ 削除: ペンツール専用ホイールイベント処理（サイズ・透明度調整）
 * ❌ 削除: ペンツール状態判定（isActiveTool('pen')）
 * ✅ 維持: 汎用キーボード・ホイールイベント処理
 * ✅ 追加: 移譲済み機能の警告・案内
 */

class UIEventSystem {
    constructor(app) {
        this.app = app;
        this.isEnabled = true;
        this.eventStats = {
            keyboardEvents: 0,
            wheelEvents: 0,
            touchEvents: 0,
            errors: 0
        };
        
        // STEP 5: 移譲済み機能の警告制御
        this.migrationWarnings = {
            penKeyboardShortcuts: false,
            penWheelEvents: false
        };
        
        this.setupEventListeners();
        console.log('🎮 UIEventSystem初期化（汎用処理特化版）');
    }
    
    setupEventListeners() {
        // キーボードイベント（汎用のみ）
        document.addEventListener('keydown', (e) => this.handleGlobalKeyboard(e));
        
        // ホイールイベント（汎用のみ） 
        document.addEventListener('wheel', (e) => this.handleGlobalWheel(e), { passive: false });
        
        // タッチイベント（汎用）
        document.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        document.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        document.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });
        
        // ウィンドウイベント
        window.addEventListener('resize', (e) => this.handleWindowResize(e));
        window.addEventListener('beforeunload', (e) => this.handleBeforeUnload(e));
        
        console.log('✅ 汎用イベントリスナー設定完了');
    }
    
    /**
     * 汎用キーボードイベント処理（STEP 5クリーンアップ版）
     */
    handleGlobalKeyboard(event) {
        if (!this.isEnabled) return;
        
        try {
            this.eventStats.keyboardEvents++;
            const key = event.key.toLowerCase();
            const { ctrlKey, shiftKey, altKey, metaKey } = event;
            
            // システム全体ショートカット
            if (ctrlKey || metaKey) {
                this.handleSystemShortcuts(key, event);
                return;
            }
            
            // 汎用ショートカット
            switch (key) {
                case 'escape':
                    this.handleEscapeKey(event);
                    break;
                    
                case 'f1':
                    this.handleHelpKey(event);
                    break;
                    
                case 'f11':
                    this.handleFullscreenKey(event);
                    break;
                    
                // STEP 5削除: ペンツール専用ショートカット
                case 'p':
                    if (!ctrlKey && !altKey && !metaKey) {
                        this.showMigrationWarning('penKeyboardShortcuts', 
                            'P+数字のプリセット選択はペンツール専用システムに移行しました。' +
                            'ペンツールを選択してからご使用ください。');
                    }
                    break;
                    
                case 'r':
                    if (!ctrlKey && !altKey && !metaKey) {
                        this.showMigrationWarning('penKeyboardShortcuts',
                            'Rキーでのリセット機能はペンツール専用システムに移行しました。' +
                            'ペンツールを選択してからご使用ください。');
                    }
                    break;
            }
            
        } catch (error) {
            this.handleError('keyboard', error);
        }
    }
    
    /**
     * システム全体ショートカット処理
     */
    handleSystemShortcuts(key, event) {
        const { ctrlKey, metaKey } = event;
        const cmdCtrl = ctrlKey || metaKey;
        
        if (cmdCtrl) {
            switch (key) {
                case 'z':
                    this.handleUndo(event);
                    break;
                    
                case 'y':
                    this.handleRedo(event);
                    break;
                    
                case 's':
                    this.handleSave(event);
                    break;
                    
                case 'o':
                    this.handleOpen(event);
                    break;
                    
                case 'n':
                    this.handleNew(event);
                    break;
            }
        }
    }
    
    /**
     * 汎用ホイールイベント処理（STEP 5クリーンアップ版）
     */
    handleGlobalWheel(event) {
        if (!this.isEnabled) return;
        
        try {
            this.eventStats.wheelEvents++;
            const { deltaY, ctrlKey, shiftKey } = event;
            
            // キャンバス上でのホイールイベントのみ処理
            if (!this.isOverCanvas(event.target)) {
                return;
            }
            
            // Ctrlキー + ホイール: キャンバスズーム（汎用機能）
            if (ctrlKey && !shiftKey) {
                this.handleCanvasZoom(deltaY, event);
                return;
            }
            
            // Shiftキー + ホイール: 水平スクロール（汎用機能）
            if (shiftKey && !ctrlKey) {
                this.handleHorizontalScroll(deltaY, event);
                return;
            }
            
            // 修飾キーなし: 垂直スクロール（汎用機能）
            if (!ctrlKey && !shiftKey) {
                this.handleVerticalScroll(deltaY, event);
                return;
            }
            
            // STEP 5削除: ペンツール専用ホイールイベント
            // 以前はここでペンサイズ・透明度調整を処理していたが、
            // ペンツール専用システム（EventManager）に移行済み
            if (ctrlKey || shiftKey) {
                this.showMigrationWarning('penWheelEvents',
                    'ペンサイズ・透明度のホイール調整はペンツール専用システムに移行しました。' +
                    'ペンツールを選択してからCtrl+ホイール（サイズ）、Shift+ホイール（透明度）をご使用ください。');
            }
            
        } catch (error) {
            this.handleError('wheel', error);
        }
    }
    
    /**
     * キャンバス上判定
     */
    isOverCanvas(target) {
        return target.closest('#canvas-container') || 
               target.closest('canvas') ||
               target.id === 'canvas-container';
    }
    
    /**
     * キャンバスズーム処理（汎用）
     */
    handleCanvasZoom(deltaY, event) {
        const zoomFactor = deltaY > 0 ? 0.9 : 1.1;
        
        if (this.app && this.app.stage) {
            const currentScale = this.app.stage.scale.x;
            const newScale = Math.max(0.1, Math.min(5.0, currentScale * zoomFactor));
            
            this.app.stage.scale.set(newScale);
            
            console.log(`🔍 キャンバスズーム: ${(newScale * 100).toFixed(1)}%`);
        }
        
        event.preventDefault();
    }
    
    /**
     * 水平スクロール処理（汎用）
     */
    handleHorizontalScroll(deltaY, event) {
        if (this.app && this.app.stage) {
            this.app.stage.x += deltaY > 0 ? -20 : 20;
            console.log(`↔️  水平スクロール: x=${this.app.stage.x}`);
        }
        
        event.preventDefault();
    }
    
    /**
     * 垂直スクロール処理（汎用）
     */
    handleVerticalScroll(deltaY, event) {
        if (this.app && this.app.stage) {
            this.app.stage.y += deltaY > 0 ? -20 : 20;
            console.log(`↕️  垂直スクロール: y=${this.app.stage.y}`);
        }
        
        event.preventDefault();
    }
    
    /**
     * STEP 5新規: 移譲済み機能の警告表示
     */
    showMigrationWarning(warningType, message) {
        // 同じ警告は1回だけ表示
        if (this.migrationWarnings[warningType]) return;
        
        console.warn(`⚠️  機能移行: ${message}`);
        
        // UI通知（存在する場合）
        if (window.uiManager && window.uiManager.showNotification) {
            window.uiManager.showNotification(message, 'info', 5000);
        }
        
        this.migrationWarnings[warningType] = true;
    }
    
    // ==========================================
    // 汎用イベント処理メソッド
    // ==========================================
    
    /**
     * ESCキー処理
     */
    handleEscapeKey(event) {
        // モーダル・ポップアップを閉じる
        const modal = document.querySelector('.modal:not(.hidden)');
        if (modal) {
            modal.classList.add('hidden');
            event.preventDefault();
            return;
        }
        
        const popup = document.querySelector('.popup:not(.hidden)');
        if (popup) {
            popup.classList.add('hidden');
            event.preventDefault();
            return;
        }
        
        // フルスクリーン解除
        if (document.fullscreenElement) {
            document.exitFullscreen();
            event.preventDefault();
        }
    }
    
    /**
     * F1キー（ヘルプ）処理
     */
    handleHelpKey(event) {
        if (window.uiManager && window.uiManager.showHelp) {
            window.uiManager.showHelp();
            event.preventDefault();
        }
    }
    
    /**
     * F11キー（フルスクリーン）処理
     */
    handleFullscreenKey(event) {
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            document.documentElement.requestFullscreen();
        }
        event.preventDefault();
    }
    
    /**
     * Undo処理
     */
    handleUndo(event) {
        if (window.historyManager && window.historyManager.undo) {
            window.historyManager.undo();
            event.preventDefault();
            console.log('↶ Undo実行');
        }
    }
    
    /**
     * Redo処理
     */
    handleRedo(event) {
        if (window.historyManager && window.historyManager.redo) {
            window.historyManager.redo();
            event.preventDefault();
            console.log('↷ Redo実行');
        }
    }
    
    /**
     * 保存処理
     */
    handleSave(event) {
        if (window.uiManager && window.uiManager.saveCanvas) {
            window.uiManager.saveCanvas();
            event.preventDefault();
            console.log('💾 保存実行');
        }
    }
    
    /**
     * 開く処理
     */
    handleOpen(event) {
        if (window.uiManager && window.uiManager.openFile) {
            window.uiManager.openFile();
            event.preventDefault();
            console.log('📁 ファイル開く実行');
        }
    }
    
    /**
     * 新規作成処理
     */
    handleNew(event) {
        if (window.uiManager && window.uiManager.newCanvas) {
            window.uiManager.newCanvas();
            event.preventDefault();
            console.log('📄 新規作成実行');
        }
    }
    
    // ==========================================
    // タッチイベント処理（汎用）
    // ==========================================
    
    handleTouchStart(event) {
        this.eventStats.touchEvents++;
        // タッチ処理の実装（将来拡張）
    }
    
    handleTouchMove(event) {
        // タッチ移動処理（将来拡張）
    }
    
    handleTouchEnd(event) {
        // タッチ終了処理（将来拡張）
    }
    
    // ==========================================
    // ウィンドウイベント処理
    // ==========================================
    
    handleWindowResize(event) {
        if (this.app && this.app.renderer) {
            // キャンバスリサイズ
            const container = document.getElementById('canvas-container');
            if (container) {
                this.app.renderer.resize(container.clientWidth, container.clientHeight);
                console.log(`🔄 キャンバスリサイズ: ${container.clientWidth}x${container.clientHeight}`);
            }
        }
    }
    
    handleBeforeUnload(event) {
        // 未保存の変更がある場合の警告
        if (window.historyManager && window.historyManager.hasUnsavedChanges && 
            window.historyManager.hasUnsavedChanges()) {
            event.preventDefault();
            event.returnValue = '未保存の変更があります。本当にページを離れますか？';
        }
    }
    
    // ==========================================
    // ユーティリティ・デバッグ
    // ==========================================
    
    /**
     * エラーハンドリング
     */
    handleError(context, error) {
        this.eventStats.errors++;
        console.error(`UIEventSystem ${context} error:`, error);
        
        // 重大エラーの場合はシステム無効化
        if (this.eventStats.errors > 100) {
            console.warn('UIEventSystem: 大量エラー発生のため無効化します');
            this.isEnabled = false;
        }
    }
    
    /**
     * イベントシステム有効/無効制御
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
        console.log(`🎮 UIEventSystem ${enabled ? '有効' : '無効'}`);
    }
    
    /**
     * 統計情報取得
     */
    getEventStats() {
        return {
            ...this.eventStats,
            enabled: this.isEnabled,
            migrationWarnings: { ...this.migrationWarnings }
        };
    }
    
    /**
     * システム状況取得
     */
    getStatus() {
        return {
            enabled: this.isEnabled,
            stats: this.getEventStats(),
            features: {
                globalKeyboard: true,
                globalWheel: true,
                touchEvents: true,
                windowEvents: true,
                penSpecificEvents: false  // STEP 5で移譲済み
            },
            migration: {
                penKeyboardShortcuts: 'EventManager（ペンツール専用システム）',
                penWheelEvents: 'EventManager（ペンツール専用システム）'
            }
        };
    }
    
    /**
     * クリーンアップ
     */
    destroy() {
        this.isEnabled = false;
        console.log('🧹 UIEventSystem クリーンアップ完了（汎用イベント処理）');
    }
}

// グローバル公開（既存システムとの互換性）
if (typeof window !== 'undefined') {
    window.UIEventSystem = UIEventSystem;
}

export { UIEventSystem };