/**
 * 🧠 MemoryManager - 非破壊アンドゥシステム
 * 責務:
 * - 履歴管理統括
 * - メモリ最適化
 * - 状態保存・復元
 * - 既存history-manager.js統括
 * 
 * 🎯 AI_WORK_SCOPE: メモリ管理専用ファイル
 * 🎯 DEPENDENCIES: app-core.js, history-manager.js
 * 📋 MEMORY_PLAN: 非破壊アンドゥシステム統括
 */

class MemoryManager {
    constructor(appCore) {
        this.appCore = appCore;
        this.extensions = appCore.extensions;
        this.historyManager = null;
        this.isInitialized = false;
        
        // メモリ監視
        this.memoryStats = {
            textureMemory: 0,
            drawingMemory: 0,
            historyMemory: 0,
            totalMemory: 0,
            lastUpdate: Date.now()
        };
        
        // パフォーマンス監視
        this.performanceMonitor = {
            fps: 60,
            frameTime: 16.67,
            lastFrame: performance.now()
        };
        
        // 設定
        this.settings = {
            maxHistorySteps: 50,
            memoryCheckInterval: 5000,
            autoCleanup: true,
            compressionEnabled: true
        };
    }
    
    async init() {
        console.log('🧠 MemoryManager 初期化開始...');
        
        try {
            await this.initializeHistoryManager();
            await this.setupShortcuts();
            await this.startMemoryMonitoring();
            await this.setupPerformanceMonitoring();
            
            this.isInitialized = true;
            console.log('✅ MemoryManager 初期化完了');
        } catch (error) {
            console.error('❌ MemoryManager 初期化失敗:', error);
            throw error;
        }
    }
    
    async initializeHistoryManager() {
        // 既存history-manager.js統括
        if (typeof HistoryManager !== 'undefined') {
            this.historyManager = new HistoryManager(this.appCore);
            
            // history-manager の設定を引き継ぎ
            if (this.historyManager.init) {
                await this.historyManager.init();
            }
            
            console.log('✅ 既存HistoryManager統括完了');
        } else {
            // フォールバック: 簡易履歴システム
            await this.createFallbackHistorySystem();
        }
    }
    
    async createFallbackHistorySystem() {
        console.log('⚠️ HistoryManager未検出: 簡易履歴システム作成');
        
        this.historyManager = {
            states: [],
            currentIndex: -1,
            maxStates: this.settings.maxHistorySteps,
            
            saveState: () => {
                console.log('💾 簡易履歴: 状態保存');
                // 簡易実装（実際の描画状態は保存しない）
                this.historyManager.states.push({
                    timestamp: Date.now(),
                    action: 'manual_save'
                });
                
                if (this.historyManager.states.length > this.historyManager.maxStates) {
                    this.historyManager.states.shift();
                } else {
                    this.historyManager.currentIndex++;
                }
            },
            
            undo: () => {
                console.log('↶ 簡易履歴: アンドゥ（機能制限版）');
                if (this.historyManager.currentIndex > 0) {
                    this.historyManager.currentIndex--;
                    return true;
                }
                return false;
            },
            
            redo: () => {
                console.log('↷ 簡易履歴: リドゥ（機能制限版）');
                if (this.historyManager.currentIndex < this.historyManager.states.length - 1) {
                    this.historyManager.currentIndex++;
                    return true;
                }
                return false;
            },
            
            clear: () => {
                this.historyManager.states = [];
                this.historyManager.currentIndex = -1;
                console.log('🗑️ 簡易履歴: クリア');
            },
            
            getStats: () => ({
                totalStates: this.historyManager.states.length,
                currentIndex: this.historyManager.currentIndex,
                memoryUsage: this.historyManager.states.length * 1024 // 概算
            })
        };
    }
    
    async setupShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+Z / Cmd+Z でアンドゥ
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                this.undo();
            }
            // Ctrl+Y / Cmd+Y / Ctrl+Shift+Z でリドゥ
            else if (
                ((e.ctrlKey || e.metaKey) && e.key === 'y') ||
                ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Z')
            ) {
                e.preventDefault();
                this.redo();
            }
            // Ctrl+Alt+C で履歴クリア（デバッグ用）
            else if (e.ctrlKey && e.altKey && e.key === 'c') {
                e.preventDefault();
                this.clearHistory();
            }
        });
        
        console.log('⌨️ メモリ管理ショートカット設定完了');
    }
    
    async startMemoryMonitoring() {
        // 定期的なメモリ監視
        setInterval(() => {
            this.updateMemoryStats();
        }, this.settings.memoryCheckInterval);
        
        // パフォーマンス情報取得（利用可能な場合）
        if ('memory' in performance) {
            setInterval(() => {
                this.updateBrowserMemoryStats();
            }, this.settings.memoryCheckInterval);
        }
    }
    
    async setupPerformanceMonitoring() {
        // FPS監視
        if (this.appCore.app && this.appCore.app.ticker) {
            this.appCore.app.ticker.add(() => {
                this.updatePerformanceStats();
            });
        }
    }
    
    updateMemoryStats() {
        // 履歴メモリ使用量
        if (this.historyManager && this.historyManager.getStats) {
            const historyStats = this.historyManager.getStats();
            this.memoryStats.historyMemory = historyStats.memoryUsage || 0;
        }
        
        // PIXI TextureCache 情報
        const textureCount = Object.keys(PIXI.utils.TextureCache).length;
        this.memoryStats.textureMemory = textureCount * 1024; // 概算
        
        // 総メモリ使用量更新
        this.memoryStats.totalMemory = 
            this.memoryStats.textureMemory + 
            this.memoryStats.historyMemory + 
            this.memoryStats.drawingMemory;
        
        this.memoryStats.lastUpdate = Date.now();
        
        // ステータスバー更新
        this.updateMemoryDisplay();
        
        // 自動クリーンアップ
        if (this.settings.autoCleanup) {
            this.performAutoCleanup();
        }
    }
    
    updateBrowserMemoryStats() {
        if ('memory' in performance) {
            const memory = performance.memory;
            this.memoryStats.browserMemory = {
                used: Math.round(memory.usedJSHeapSize / 1024 / 1024 * 10) / 10,
                total: Math.round(memory.totalJSHeapSize / 1024 / 1024 * 10) / 10,
                limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024 * 10) / 10
            };
        }
    }
    
    updatePerformanceStats() {
        const now = performance.now();
        const deltaTime = now - this.performanceMonitor.lastFrame;
        
        this.performanceMonitor.frameTime = deltaTime;
        this.performanceMonitor.fps = Math.round(1000 / deltaTime);
        this.performanceMonitor.lastFrame = now;
        
        // FPS表示更新
        const fpsElement = document.getElementById('fps');
        if (fpsElement) {
            fpsElement.textContent = this.performanceMonitor.fps;
        }
    }
    
    updateMemoryDisplay() {
        const memoryElement = document.getElementById('memory-usage');
        if (memoryElement) {
            const memoryMB = Math.round(this.memoryStats.totalMemory / 1024 / 1024 * 10) / 10;
            memoryElement.textContent = `${memoryMB}MB`;
        }
    }
    
    performAutoCleanup() {
        // メモリ使用量が一定を超えた場合の自動クリーンアップ
        const memoryLimitMB = 100; // 100MB制限
        const currentMemoryMB = this.memoryStats.totalMemory / 1024 / 1024;
        
        if (currentMemoryMB > memoryLimitMB) {
            console.log(`🧹 自動クリーンアップ開始 (${currentMemoryMB.toFixed(1)}MB > ${memoryLimitMB}MB)`);
            this.performCleanup();
        }
    }
    
    performCleanup() {
        // 古い履歴の削除
        if (this.historyManager && this.historyManager.states) {
            const beforeCount = this.historyManager.states.length;
            const keepCount = Math.floor(this.settings.maxHistorySteps * 0.7); // 70%を保持
            
            if (beforeCount > keepCount) {
                this.historyManager.states = this.historyManager.states.slice(-keepCount);
                this.historyManager.currentIndex = Math.min(
                    this.historyManager.currentIndex,
                    keepCount - 1
                );
                
                console.log(`🧹 履歴クリーンアップ: ${beforeCount} → ${keepCount}項目`);
            }
        }
        
        // テクスチャキャッシュクリーンアップ
        this.cleanupTextures();
    }
    
    cleanupTextures() {
        // 未使用テクスチャの検出と削除
        let cleanedCount = 0;
        
        for (const [key, texture] of Object.entries(PIXI.utils.TextureCache)) {
            // 参照カウントが1以下（キャッシュのみ）のテクスチャを削除
            if (texture && texture.baseTexture && texture.baseTexture.resource) {
                const refCount = texture.baseTexture._glTextures ? 
                    Object.keys(texture.baseTexture._glTextures).length : 0;
                    
                if (refCount <= 1) {
                    texture.destroy(true);
                    delete PIXI.utils.TextureCache[key];
                    cleanedCount++;
                }
            }
        }
        
        if (cleanedCount > 0) {
            console.log(`🧹 テクスチャクリーンアップ: ${cleanedCount}個削除`);
        }
    }
    
    // 公開API
    saveState() {
        if (this.historyManager && this.historyManager.saveState) {
            this.historyManager.saveState();
            console.log('💾 状態保存');
        }
    }
    
    undo() {
        if (this.historyManager && this.historyManager.undo) {
            const success = this.historyManager.undo();
            if (success) {
                console.log('↶ アンドゥ実行');
            } else {
                console.log('↶ アンドゥ: これ以上戻れません');
            }
            return success;
        }
        return false;
    }
    
    redo() {
        if (this.historyManager && this.historyManager.redo) {
            const success = this.historyManager.redo();
            if (success) {
                console.log('↷ リドゥ実行');
            } else {
                console.log('↷ リドゥ: これ以上進められません');
            }
            return success;
        }
        return false;
    }
    
    clearHistory() {
        if (this.historyManager && this.historyManager.clear) {
            this.historyManager.clear();
            console.log('🗑️ 履歴クリア');
        }
    }
    
    // 統計情報取得
    getMemoryStats() {
        return {
            ...this.memoryStats,
            browserMemory: this.memoryStats.browserMemory || null,
            historyStats: this.historyManager && this.historyManager.getStats ? 
                this.historyManager.getStats() : null
        };
    }
    
    getPerformanceStats() {
        return { ...this.performanceMonitor };
    }
    
    getHistoryStats() {
        if (this.historyManager && this.historyManager.getStats) {
            return this.historyManager.getStats();
        }
        return null;
    }
    
    // 設定変更
    setMaxHistorySteps(steps) {
        this.settings.maxHistorySteps = Math.max(1, Math.min(100, steps));
        console.log(`📝 最大履歴数変更: ${this.settings.maxHistorySteps}`);
    }
    
    setMemoryCheckInterval(intervalMs) {
        this.settings.memoryCheckInterval = Math.max(1000, intervalMs);
        console.log(`⏱️ メモリ監視間隔変更: ${this.settings.memoryCheckInterval}ms`);
    }
    
    setAutoCleanup(enabled) {
        this.settings.autoCleanup = enabled;
        console.log(`🧹 自動クリーンアップ: ${enabled ? '有効' : '無効'}`);
    }
    
    // イベントハンドラ（Manager間連携用）
    onEvent(eventName, data) {
        switch (eventName) {
            case 'draw-start':
            case 'draw-end':
                // 描画終了時に自動保存
                if (eventName === 'draw-end') {
                    setTimeout(() => this.saveState(), 100);
                }
                break;
                
            case 'tool-change':
                // ツール変更時に状態保存
                this.saveState();
                break;
                
            case 'canvas-resize':
                // キャンバスリサイズ時に状態保存
                this.saveState();
                break;
        }
    }
    
    // 開発用デバッグメソッド
    debugMemory() {
        const stats = this.getMemoryStats();
        const performance = this.getPerformanceStats();
        const history = this.getHistoryStats();
        
        console.group('🧠 MemoryManager Debug Info');
        console.log('Memory Stats:', stats);
        console.log('Performance Stats:', performance);
        console.log('History Stats:', history);
        console.log('Settings:', this.settings);
        console.groupEnd();
        
        return { stats, performance, history, settings: this.settings };
    }
    
    // 強制ガベージコレクション（利用可能な場合）
    forceGarbageCollection() {
        if (window.gc) {
            window.gc();
            console.log('🗑️ 強制ガベージコレクション実行');
        } else {
            console.warn('⚠️ ガベージコレクション未対応（--expose-gc フラグが必要）');
        }
    }
    
    // メモリダンプ（デバッグ用）
    dumpMemoryState() {
        const dump = {
            timestamp: new Date().toISOString(),
            memoryStats: this.getMemoryStats(),
            performanceStats: this.getPerformanceStats(),
            historyStats: this.getHistoryStats(),
            pixiCacheKeys: Object.keys(PIXI.utils.TextureCache),
            appStats: this.appCore.getStats ? this.appCore.getStats() : null
        };
        
        console.log('💾 Memory Dump:', dump);
        return dump;
    }
}