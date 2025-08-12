/**
 * EventManager - STEP 6最適化版: デバウンス機能追加・パフォーマンス向上・エラー分離完成
 * 
 * PenToolUI専用イベント処理システム
 * 責任: ペンツール専用キーボードショートカット・ホイール操作・プリセット選択
 */

class EventManager {
    constructor(penToolUI) {
        this.penToolUI = penToolUI;
        this.app = penToolUI.app;
        this.drawingToolsSystem = penToolUI.drawingToolsSystem;
        
        // イベント制御状態
        this.enabled = false;
        this.listening = false;
        this.isToolActive = false;
        
        // イベント処理統計
        this.stats = {
            keyboardEvents: 0,
            wheelEvents: 0,
            presetSelections: 0,
            adjustments: 0,
            errors: 0,
            lastEventTime: 0
        };
        
        // エラー制御
        this.errorCount = 0;
        this.maxErrors = 10;
        this.consecutiveErrors = 0;
        this.maxConsecutiveErrors = 3;
        
        // パフォーマンス設定
        this.throttleDelay = 100; // ms
        this.lastEvents = new Map();
        
        // STEP 6新規: デバウンス制御
        this.debounceDelay = 50; // ms
        this.debounceTimers = new Map();
        
        // STEP 6新規: パフォーマンス最適化設定
        this.performanceConfig = {
            maxEventRate: 60, // events/second
            eventRateWindow: 1000, // ms
            recentEvents: [],
            throttleEnabled: true,
            debounceEnabled: true
        };
        
        // イベントリスナー管理
        this.eventListeners = new Map();
        
        console.log('🎮 EventManager (STEP 6最適化版) 初期化');
    }
    
    /**
     * 初期化
     */
    async init() {
        try {
            console.log('🎮 EventManager STEP 6最適化版 初期化開始...');
            
            this.setupEventListeners();
            this.startPerformanceMonitoring();
            
            console.log('✅ EventManager STEP 6最適化版 初期化完了');
            return true;
            
        } catch (error) {
            console.error('❌ EventManager初期化失敗:', error);
            this.handleError(error, 'init');
            return false;
        }
    }
    
    /**
     * STEP 6新規: パフォーマンス監視開始
     */
    startPerformanceMonitoring() {
        // イベント処理レート監視
        setInterval(() => {
            this.cleanupRecentEvents();
            this.adjustPerformanceSettings();
        }, 5000); // 5秒ごと
        
        console.log('📊 EventManager パフォーマンス監視開始');
    }
    
    /**
     * STEP 6新規: 最近のイベントクリーンアップ
     */
    cleanupRecentEvents() {
        const now = Date.now();
        const window = this.performanceConfig.eventRateWindow;
        
        this.performanceConfig.recentEvents = this.performanceConfig.recentEvents.filter(
            eventTime => now - eventTime < window
        );
    }
    
    /**
     * STEP 6新規: パフォーマンス設定調整
     */
    adjustPerformanceSettings() {
        const eventRate = this.performanceConfig.recentEvents.length;
        
        // 高負荷時は制限を強化
        if (eventRate > this.performanceConfig.maxEventRate * 0.8) {
            this.throttleDelay = Math.min(this.throttleDelay * 1.2, 200);
            this.debounceDelay = Math.min(this.debounceDelay * 1.1, 100);
        }
        // 低負荷時は制限を緩和
        else if (eventRate < this.performanceConfig.maxEventRate * 0.3) {
            this.throttleDelay = Math.max(this.throttleDelay * 0.9, 50);
            this.debounceDelay = Math.max(this.debounceDelay * 0.95, 25);
        }
    }
    
    /**
     * イベントリスナー設定
     */
    setupEventListeners() {
        const keydownHandler = this.handleKeydown.bind(this);
        const wheelHandler = this.handleWheel.bind(this);
        
        this.eventListeners.set('keydown', keydownHandler);
        this.eventListeners.set('wheel', wheelHandler);
        
        document.addEventListener('keydown', keydownHandler);
        if (this.app && this.app.view) {
            this.app.view.addEventListener('wheel', wheelHandler, { passive: false });
        }
        
        console.log('🎮 EventManager イベントリスナー設定完了');
    }
    
    /**
     * 有効化/無効化制御
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        this.listening = enabled && this.isToolActive;
        
        console.log(`🎮 EventManager: ${enabled ? '有効' : '無効'}, リスニング: ${this.listening}`);
    }
    
    /**
     * ツールアクティブ状態設定
     */
    setToolActive(active) {
        this.isToolActive = active;
        this.listening = this.enabled && active;
        
        console.log(`🎮 EventManager ツールアクティブ: ${active}, リスニング: ${this.listening}`);
    }
    
    /**
     * キーボードイベント処理
     */
    handleKeydown(event) {
        if (!this.listening || this.isInputFocused(event.target)) {
            return false;
        }
        
        try {
            this.recordEventForPerformance();
            this.stats.keyboardEvents++;
            this.stats.lastEventTime = Date.now();
            this.consecutiveErrors = 0; // 成功時はリセット
            
            const key = event.key.toLowerCase();
            const handled = this.processKeyboardEvent(key, event);
            
            if (handled) {
                event.preventDefault();
                return true;
            }
            
            return false;
            
        } catch (error) {
            this.handleError(error, 'keyboard');
            return false;
        }
    }
    
    /**
     * STEP 6新規: パフォーマンス用イベント記録
     */
    recordEventForPerformance() {
        const now = Date.now();
        this.performanceConfig.recentEvents.push(now);
        
        // 古いイベントを削除
        const windowStart = now - this.performanceConfig.eventRateWindow;
        this.performanceConfig.recentEvents = this.performanceConfig.recentEvents.filter(
            eventTime => eventTime >= windowStart
        );
    }
    
    /**
     * キーボードイベント処理（具体的な処理）
     */
    processKeyboardEvent(key, event) {
        // P+数字シーケンス（プリセット選択）
        if (key === 'p' && !event.ctrlKey && !event.shiftKey) {
            this.startPresetSequence();
            return true;
        }
        
        // プリセットシーケンス中
        if (this.activeSequence === 'preset') {
            const presetIndex = parseInt(key) - 1;
            if (!isNaN(presetIndex) && presetIndex >= 0 && presetIndex < 6) {
                return this.debounce('preset-select', () => {
                    this.selectPreset(presetIndex);
                });
            } else if (key === '0') {
                return this.debounce('preset-reset-all', () => {
                    this.resetAllPreviews();
                });
            }
            this.clearActiveSequence();
            return false;
        }
        
        // R: プリセットリセット
        if (key === 'r' && !event.ctrlKey && !event.shiftKey) {
            return this.debounce('preset-reset', () => {
                this.resetActivePreset();
            });
        }
        
        // Shift+R: 全プレビューリセット
        if (key === 'r' && event.shiftKey && !event.ctrlKey) {
            return this.debounce('preview-reset-all', () => {
                this.resetAllPreviews();
            });
        }
        
        return false;
    }
    
    /**
     * STEP 6新規: デバウンス処理
     */
    debounce(key, fn, delay = this.debounceDelay) {
        if (!this.performanceConfig.debounceEnabled) {
            fn();
            return true;
        }
        
        if (this.debounceTimers.has(key)) {
            clearTimeout(this.debounceTimers.get(key));
        }
        
        const timer = setTimeout(() => {
            fn();
            this.debounceTimers.delete(key);
        }, delay);
        
        this.debounceTimers.set(key, timer);
        return true;
    }
    
    /**
     * プリセットシーケンス開始
     */
    startPresetSequence() {
        this.activeSequence = 'preset';
        this.sequenceStartTime = Date.now();
        
        // タイムアウト設定
        this.sequenceTimeout = setTimeout(() => {
            this.clearActiveSequence();
        }, 1500);
        
        console.log('🎨 プリセットシーケンス開始 (P+...)');
    }
    
    /**
     * アクティブシーケンスクリア
     */
    clearActiveSequence() {
        if (this.sequenceTimeout) {
            clearTimeout(this.sequenceTimeout);
            this.sequenceTimeout = null;
        }
        this.activeSequence = null;
        this.sequenceStartTime = null;
    }
    
    /**
     * ホイールイベント処理
     */
    handleWheel(event) {
        if (!this.listening || this.isInputFocused(event.target)) {
            return false;
        }
        
        try {
            this.recordEventForPerformance();
            this.stats.wheelEvents++;
            this.stats.lastEventTime = Date.now();
            this.consecutiveErrors = 0;
            
            const handled = this.processWheelEvent(event);
            
            if (handled) {
                event.preventDefault();
                return true;
            }
            
            return false;
            
        } catch (error) {
            this.handleError(error, 'wheel');
            return false;
        }
    }
    
    /**
     * ホイールイベント処理（具体的な処理）
     */
    processWheelEvent(event) {
        const delta = -event.deltaY;
        
        // スロットリング制御
        if (this.isThrottled('wheel')) {
            return true; // 処理済み扱い
        }
        
        // Ctrl+ホイール: ペンサイズ調整
        if (event.ctrlKey) {
            const step = event.shiftKey ? 5 : 1; // Shiftで大きなステップ
            const adjustment = delta > 0 ? step : -step;
            
            this.adjustSize(adjustment);
            return true;
        }
        
        // Shift+ホイール: 透明度調整
        if (event.shiftKey) {
            const step = event.ctrlKey ? 10 : 5; // Ctrlで大きなステップ
            const adjustment = delta > 0 ? step : -step;
            
            this.adjustOpacity(adjustment);
            return true;
        }
        
        return false;
    }
    
    /**
     * スロットリング制御
     */
    isThrottled(eventType) {
        if (!this.performanceConfig.throttleEnabled) {
            return false;
        }
        
        const now = Date.now();
        const lastTime = this.lastEvents.get(eventType) || 0;
        
        if (now - lastTime < this.throttleDelay) {
            return true;
        }
        
        this.lastEvents.set(eventType, now);
        return false;
    }
    
    /**
     * プリセット選択
     */
    selectPreset(index) {
        if (this.penToolUI && this.penToolUI.selectPreset) {
            const success = this.penToolUI.selectPreset(index);
            if (success) {
                this.stats.presetSelections++;
                console.log(`🎨 プリセット ${index + 1} 選択完了`);
            }
            return success;
        }
        return false;
    }
    
    /**
     * アクティブプリセットリセット
     */
    resetActivePreset() {
        if (this.penToolUI && this.penToolUI.resetActivePreset) {
            const success = this.penToolUI.resetActivePreset();
            if (success) {
                console.log('🔄 アクティブプリセット リセット完了');
            }
            return success;
        }
        return false;
    }
    
    /**
     * 全プレビューリセット
     */
    resetAllPreviews() {
        if (this.penToolUI && this.penToolUI.resetAllPreviews) {
            const success = this.penToolUI.resetAllPreviews();
            if (success) {
                console.log('🔄 全プレビュー リセット完了');
            }
            return success;
        }
        return false;
    }
    
    /**
     * ペンサイズ調整
     */
    adjustSize(delta) {
        if (this.penToolUI && this.penToolUI.adjustSize) {
            const success = this.penToolUI.adjustSize(delta);
            if (success) {
                this.stats.adjustments++;
                console.log(`📏 ペンサイズ調整: ${delta > 0 ? '+' : ''}${delta}`);
            }
            return success;
        }
        return false;
    }
    
    /**
     * 透明度調整
     */
    adjustOpacity(delta) {
        if (this.penToolUI && this.penToolUI.adjustOpacity) {
            const success = this.penToolUI.adjustOpacity(delta);
            if (success) {
                this.stats.adjustments++;
                console.log(`🌫️ 透明度調整: ${delta > 0 ? '+' : ''}${delta}%`);
            }
            return success;
        }
        return false;
    }
    
    /**
     * 入力フィールドフォーカス判定
     */
    isInputFocused(target) {
        return target && (
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.contentEditable === 'true'
        );
    }
    
    /**
     * STEP 6強化: エラーハンドリング
     */
    handleError(error, context) {
        this.errorCount++;
        this.consecutiveErrors++;
        this.stats.errors++;
        
        console.error(`EventManager エラー (${context}):`, error);
        
        // 連続エラー時は一時無効化
        if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
            console.warn(`EventManager: 連続エラー${this.consecutiveErrors}回 - 一時無効化`);
            this.enabled = false;
            
            // 30秒後に再有効化を試行
            setTimeout(() => {
                this.consecutiveErrors = 0;
                this.enabled = true;
                console.log('EventManager: 自動再有効化');
            }, 30000);
        }
        
        // 最大エラー数到達時は完全無効化
        if (this.errorCount >= this.maxErrors) {
            console.error(`EventManager: 最大エラー数${this.maxErrors}到達 - 完全無効化`);
            this.enabled = false;
            this.listening = false;
        }
    }
    
    /**
     * 状況取得
     */
    getStatus() {
        return {
            enabled: this.enabled,
            listening: this.listening,
            isToolActive: this.isToolActive,
            stats: { ...this.stats },
            errorCount: this.errorCount,
            maxErrors: this.maxErrors,
            consecutiveErrors: this.consecutiveErrors,
            throttleDelay: this.throttleDelay,
            debounceDelay: this.debounceDelay,
            lastEvents: Object.fromEntries(this.lastEvents),
            performanceConfig: {
                eventRate: this.performanceConfig.recentEvents.length,
                maxEventRate: this.performanceConfig.maxEventRate,
                throttleEnabled: this.performanceConfig.throttleEnabled,
                debounceEnabled: this.performanceConfig.debounceEnabled
            },
            activeSequence: this.activeSequence,
            sequenceElapsed: this.sequenceStartTime ? Date.now() - this.sequenceStartTime : null
        };
    }
    
    /**
     * STEP 6新規: パフォーマンス統計取得
     */
    getPerformanceStats() {
        const now = Date.now();
        const recentEventCount = this.performanceConfig.recentEvents.length;
        const eventRate = recentEventCount; // events per second in last window
        
        return {
            eventRate: eventRate,
            maxEventRate: this.performanceConfig.maxEventRate,
            throttleDelay: this.throttleDelay,
            debounceDelay: this.debounceDelay,
            recentEvents: recentEventCount,
            totalEvents: this.stats.keyboardEvents + this.stats.wheelEvents,
            errorRate: this.errorCount > 0 ? (this.stats.errors / (this.stats.keyboardEvents + this.stats.wheelEvents)) : 0,
            lastEventTime: this.stats.lastEventTime,
            uptime: now - (this.initTime || now)
        };
    }
    
    /**
     * クリーンアップ
     */
    async destroy() {
        try {
            console.log('🧹 EventManager STEP 6最適化版 クリーンアップ開始...');
            
            // アクティブシーケンスクリア
            this.clearActiveSequence();
            
            // デバウンスタイマークリア
            for (const timer of this.debounceTimers.values()) {
                clearTimeout(timer);
            }
            this.debounceTimers.clear();
            
            // イベントリスナー削除
            for (const [eventType, handler] of this.eventListeners) {
                if (eventType === 'keydown') {
                    document.removeEventListener(eventType, handler);
                } else if (eventType === 'wheel' && this.app && this.app.view) {
                    this.app.view.removeEventListener(eventType, handler);
                }
            }
            
            // 参照クリア
            this.penToolUI = null;
            this.app = null;
            this.drawingToolsSystem = null;
            this.eventListeners.clear();
            this.lastEvents.clear();
            
            console.log('✅ EventManager STEP 6最適化版 クリーンアップ完了');
            
        } catch (error) {
            console.error('EventManager クリーンアップエラー:', error);
        }
    }
}

// グローバル公開
if (typeof window !== 'undefined') {
    window.EventManager = EventManager;
    console.log('✅ EventManager (STEP 6最適化版) 読み込み完了');
}