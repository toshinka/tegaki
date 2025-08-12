/**
 * EventManager - ペンツール専用イベント処理コンポーネント（STEP 5完成版）
 * 
 * 責務: ペンツール専用のキーボード・ホイールイベント処理
 * SOLID原則: 単一責任原則準拠（イベント処理のみ）
 * DRY原則: 重複コード排除・スロットリング共通化
 * 
 * 🎯 Phase: STEP 5（イベント処理移譲・統合完了）
 * 📦 統合先: drawing-tools/ui/components/event-manager.js
 */

class EventManager {
    constructor(penToolUI) {
        this.penToolUI = penToolUI;
        this.app = penToolUI.app;
        
        // イベント制御状態
        this.enabled = false;
        this.listening = false;
        
        // スロットリング制御（パフォーマンス最適化）
        this.throttleDelay = 100; // 100ms間隔
        this.lastWheelEvent = 0;
        this.lastKeyEvent = 0;
        
        // イベント統計・デバッグ情報
        this.stats = {
            keyboardEvents: 0,
            wheelEvents: 0,
            shortcuts: 0,
            throttledEvents: 0,
            errors: 0
        };
        
        // エラー制御
        this.maxErrors = 10;
        this.errorCount = 0;
        
        // イベントリスナー管理
        this.eventListeners = new Map();
        
        console.log('🎮 EventManager初期化準備完了');
    }
    
    /**
     * EventManagerコンポーネント初期化
     * SOLID原則: 単一責任（イベント処理のみ）
     */
    async init() {
        try {
            console.log('🎮 EventManager初期化開始...');
            
            this.setupKeyboardListeners();
            this.setupWheelListeners();
            
            this.listening = true;
            console.log('✅ EventManager初期化完了');
            
            return true;
        } catch (error) {
            console.error('❌ EventManager初期化失敗:', error);
            this.handleError('init', error);
            return false;
        }
    }
    
    /**
     * キーボードイベントリスナー設定
     * DRY原則: 共通イベント処理パターン統一
     */
    setupKeyboardListeners() {
        const keydownHandler = (event) => {
            if (this.shouldHandleEvent('keyboard', event)) {
                this.handleKeyboardEvent(event);
            }
        };
        
        document.addEventListener('keydown', keydownHandler);
        this.eventListeners.set('keydown', keydownHandler);
        
        console.log('⌨️  キーボードイベントリスナー設定完了');
    }
    
    /**
     * ホイールイベントリスナー設定
     * パフォーマンス最適化: passive: false でpreventDefault可能
     */
    setupWheelListeners() {
        const wheelHandler = (event) => {
            if (this.shouldHandleEvent('wheel', event)) {
                this.handleWheelEvent(event);
            }
        };
        
        document.addEventListener('wheel', wheelHandler, { passive: false });
        this.eventListeners.set('wheel', wheelHandler);
        
        console.log('🖱️  ホイールイベントリスナー設定完了');
    }
    
    /**
     * イベント処理判定（コンテキスト認識・スロットリング）
     * SOLID原則: 単一責任（判定ロジックの統一）
     */
    shouldHandleEvent(type, event) {
        // 基本制御
        if (!this.enabled) return false;
        if (!this.penToolUI.isToolActive()) return false;
        
        // UI要素フォーカス時の除外（入力フィールド等）
        const activeElement = document.activeElement;
        if (activeElement && (
            activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.contentEditable === 'true'
        )) {
            return false;
        }
        
        // スロットリングチェック（パフォーマンス最適化）
        const now = Date.now();
        if (type === 'wheel') {
            if (now - this.lastWheelEvent < this.throttleDelay) {
                this.stats.throttledEvents++;
                return false;
            }
            this.lastWheelEvent = now;
        }
        
        if (type === 'keyboard') {
            if (now - this.lastKeyEvent < this.throttleDelay) {
                this.stats.throttledEvents++;
                return false;
            }
            this.lastKeyEvent = now;
        }
        
        return true;
    }
    
    /**
     * キーボードイベント処理（ペンツール専用ショートカット）
     * 単一責任原則: ペンツール関連ショートカットのみ
     */
    handleKeyboardEvent(event) {
        try {
            this.stats.keyboardEvents++;
            
            // P+数字: プリセット選択シーケンス
            if (event.key.toLowerCase() === 'p' && !event.repeat) {
                this.handlePresetSequence(event);
                return true;
            }
            
            // R: リセット機能
            if (event.key.toLowerCase() === 'r' && !event.repeat) {
                if (event.shiftKey) {
                    // Shift+R: 全プリセットリセット
                    this.penToolUI.resetAllPreviews();
                } else {
                    // R: アクティブプリセットリセット
                    this.penToolUI.resetActivePreset();
                }
                this.stats.shortcuts++;
                event.preventDefault();
                return true;
            }
            
            return false;
        } catch (error) {
            this.handleError('keyboard', error);
            return false;
        }
    }
    
    /**
     * P+数字プリセット選択シーケンス処理
     * DRY原則: シーケンス処理の共通化
     */
    handlePresetSequence(initialEvent) {
        const timeout = 1000; // 1秒のタイムアウト
        const startTime = Date.now();
        
        console.log('🔄 プリセット選択シーケンス開始 (P+数字)');
        
        const numberListener = (event) => {
            // タイムアウトチェック
            if (Date.now() - startTime > timeout) {
                document.removeEventListener('keydown', numberListener);
                return;
            }
            
            const num = parseInt(event.key);
            if (num >= 1 && num <= 5) {
                this.penToolUI.selectPreset(num - 1);
                this.stats.shortcuts++;
                event.preventDefault();
                document.removeEventListener('keydown', numberListener);
                console.log(`🎨 プリセット ${num} 選択完了`);
            }
        };
        
        document.addEventListener('keydown', numberListener);
        
        // タイムアウト処理（メモリリーク防止）
        setTimeout(() => {
            document.removeEventListener('keydown', numberListener);
        }, timeout);
        
        initialEvent.preventDefault();
    }
    
    /**
     * ホイールイベント処理（ペンツール専用調整）
     * 単一責任原則: ペンツール関連ホイール操作のみ
     */
    handleWheelEvent(event) {
        try {
            this.stats.wheelEvents++;
            
            // Ctrl+ホイール: サイズ調整
            if (event.ctrlKey) {
                const delta = event.deltaY > 0 ? -1 : 1;
                this.penToolUI.adjustSize(delta);
                event.preventDefault();
                console.log(`📏 ペンサイズホイール調整: ${delta > 0 ? '+' : ''}${delta}`);
                return true;
            }
            
            // Shift+ホイール: 透明度調整
            if (event.shiftKey) {
                const delta = event.deltaY > 0 ? -5 : 5;
                this.penToolUI.adjustOpacity(delta);
                event.preventDefault();
                console.log(`🌫️  透明度ホイール調整: ${delta > 0 ? '+' : ''}${delta}%`);
                return true;
            }
            
            return false;
        } catch (error) {
            this.handleError('wheel', error);
            return false;
        }
    }
    
    /**
     * EventManager有効/無効制御
     * SOLID原則: オープン・クローズ原則（状態制御の統一）
     */
    setEnabled(enabled) {
        const wasEnabled = this.enabled;
        this.enabled = enabled;
        
        if (wasEnabled !== enabled) {
            console.log(`🎮 EventManager: ${enabled ? '有効化' : '無効化'}`);
        }
    }
    
    /**
     * エラーハンドリング（安全な動作継続）
     * 単一責任原則: エラー処理の統一
     */
    handleError(context, error) {
        this.errorCount++;
        this.stats.errors++;
        console.error(`EventManager ${context} error:`, error);
        
        // エラー数制限による安全機能
        if (this.errorCount > this.maxErrors) {
            console.warn('EventManager: エラー数が上限に達しました。安全のため無効化します。');
            this.enabled = false;
        }
    }
    
    /**
     * EventManager統計・状況取得
     * デバッグ・監視用API
     */
    getStatus() {
        return {
            enabled: this.enabled,
            listening: this.listening,
            stats: { ...this.stats },
            errorCount: this.errorCount,
            maxErrors: this.maxErrors,
            throttleDelay: this.throttleDelay,
            isToolActive: this.penToolUI.isToolActive(),
            lastEvents: {
                wheel: this.lastWheelEvent,
                key: this.lastKeyEvent
            }
        };
    }
    
    /**
     * EventManagerクリーンアップ
     * メモリリーク防止・適切なリソース解放
     */
    async destroy() {
        try {
            console.log('🧹 EventManager クリーンアップ開始...');
            
            // イベントリスナー削除
            for (const [eventType, handler] of this.eventListeners) {
                document.removeEventListener(eventType, handler);
                console.log(`✅ ${eventType} リスナー削除完了`);
            }
            
            // 状態リセット
            this.enabled = false;
            this.listening = false;
            this.eventListeners.clear();
            
            // 統計リセット
            this.stats = {
                keyboardEvents: 0,
                wheelEvents: 0,
                shortcuts: 0,
                throttledEvents: 0,
                errors: 0
            };
            
            console.log('✅ EventManager クリーンアップ完了');
        } catch (error) {
            console.error('❌ EventManager クリーンアップ失敗:', error);
        }
    }
}

// グローバル公開（既存システムとの互換性）
if (typeof window !== 'undefined') {
    window.EventManager = EventManager;
    
    console.log('✅ EventManager コンポーネント読み込み完了');
    console.log('🎯 STEP 5: ペンツール専用イベント処理（SOLID・DRY原則準拠）');
    console.log('⌨️  対応ショートカット: P+1〜5（プリセット選択）、R/Shift+R（リセット）');
    console.log('🖱️  対応ホイール: Ctrl+ホイール（サイズ）、Shift+ホイール（透明度）');
    console.log('🔧 最適化機能: スロットリング、コンテキスト認識、エラー制御');
}