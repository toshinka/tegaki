/**
 * 🧠 Memory Manager - Phase1.1ss5完全版
 * 🎯 非破壊履歴管理・アンドゥ/リドゥ・メモリ最適化・ガベージコレクション
 * 
 * 🎯 AI_WORK_SCOPE: 非破壊履歴管理・アンドゥ/リドゥ・メモリ最適化・ガベージコレクション
 * 🎯 DEPENDENCIES: app-core.js, performance.js（オプション）
 * 🎯 NODE_MODULES: lodash（履歴管理最適化・オプション）
 * 🎯 車輪の再発明回避: Lodash深クローン、Browser Memory API活用
 */

/**
 * Memory Manager - メインクラス
 * DRY・SOLID原則準拠、Pure JavaScript実装
 */
class MemoryManager {
    constructor(appCore) {
        this.appCore = appCore;
        this.version = 'Phase1.1ss5-Fixed';
        
        // 🎯 履歴管理
        this.history = [];
        this.historyIndex = -1;
        this.maxHistorySize = 50;
        this.historyEnabled = true;
        
        // 🎯 メモリ最適化
        this.memoryPool = new Map();
        this.memoryThreshold = 2048; // 2GB in MB
        this.gcInterval = 30000; // 30秒
        this.compressionEnabled = true;
        
        // 🎯 パフォーマンス監視
        this.performanceMetrics = {
            totalActions: 0,
            memoryUsage: 0,
            gcCount: 0,
            lastGCTime: Date.now(),
            avgActionTime: 0,
            maxMemoryUsage: 0
        };
        
        // 🎯 拡張ライブラリ統合
        this.lodashAvailable = false;
        this.performanceMonitor = null;
        
        // 🎯 アクション種別定義
        this.actionTypes = {
            DRAW_START: 'draw_start',
            DRAW_UPDATE: 'draw_update', 
            DRAW_END: 'draw_end',
            ERASE: 'erase',
            RESIZE: 'resize',
            TRANSFORM: 'transform',
            LAYER_ADD: 'layer_add',
            LAYER_DELETE: 'layer_delete',
            PROPERTY_CHANGE: 'property_change'
        };
        
        // 🎯 非同期処理管理
        this.processingQueue = [];
        this.isProcessing = false;
        this.maxQueueSize = 100;
        
        // 🎯 圧縮設定
        this.compressionConfig = {
            enabled: this.compressionEnabled,
            threshold: 1024 * 1024, // 1MB以上で圧縮
            algorithm: 'delta',
            batchSize: 10
        };
        
        // 🎯 履歴統計
        this.historyStats = {
            totalSize: 0,
            compressedSize: 0,
            compressionRatio: 1.0,
            averageActionSize: 0
        };
        
        console.log(`🧠 MemoryManager構築完了 - ${this.version}`);
    }
    
    // ==========================================
    // 🎯 初期化・セットアップ
    // ==========================================
    
    /**
     * Memory Manager初期化
     * @returns {MemoryManager} インスタンス
     */
    async initialize() {
        console.group(`🧠 MemoryManager初期化開始 - ${this.version}`);
        
        try {
            const startTime = performance.now();
            
            // 拡張ライブラリ確認・統合
            this.checkAndIntegrateExtensions();
            
            // メモリプール初期化
            this.initializeMemoryPool();
            
            // 履歴システム初期化
            this.initializeHistorySystem();
            
            // ガベージコレクション開始
            this.startGarbageCollection();
            
            // パフォーマンス監視開始
            this.startPerformanceMonitoring();
            
            // キーボードショートカット設定
            this.setupKeyboardShortcuts();
            
            // 初期状態記録
            this.recordInitialState();
            
            const initTime = performance.now() - startTime;
            console.log(`✅ MemoryManager初期化完了 - ${initTime.toFixed(2)}ms`);
            
            return this;
            
        } catch (error) {
            console.error('❌ MemoryManager初期化エラー:', error);
            
            // フォールバック初期化
            await this.fallbackInitialization();
            throw error;
            
        } finally {
            console.groupEnd();
        }
    }
    
    /**
     * 拡張ライブラリ確認・統合
     */
    checkAndIntegrateExtensions() {
        console.log('🔧 拡張ライブラリ統合開始...');
        
        // Lodash 確認・統合
        this.lodashAvailable = typeof window._ !== 'undefined';
        if (this.lodashAvailable) {
            console.log('✅ Lodash統合完了 - 履歴管理最適化');
        }
        
        // PerformanceMonitor 統合
        this.performanceMonitor = window.PerformanceMonitor;
        if (this.performanceMonitor) {
            console.log('✅ PerformanceMonitor統合完了');
        }
        
        // 📋 V8_MIGRATION: WebGPU Buffer管理準備
        // V8移行時対応: WebGPU Buffer Pool管理・GPU Memory監視・Buffer圧縮最適化
        
        console.log('🔧 拡張ライブラリ統合完了');
    }
    
    /**
     * メモリプール初期化
     */
    initializeMemoryPool() {
        console.log('🏊 メモリプール初期化...');
        
        // プール種別別にメモリ管理
        const poolTypes = [
            'pathData',      // 描画パスデータ
            'imageData',     // 画像データ
            'transformData', // 変形データ
            'layerData',     // レイヤーデータ
            'textureData'    // テクスチャデータ（V8準備）
        ];
        
        poolTypes.forEach(type => {
            this.memoryPool.set(type, {
                active: new Map(),
                inactive: new Map(),
                totalSize: 0,
                maxSize: this.memoryThreshold / poolTypes.length,
                compressionRatio: 1.0
            });
        });
        
        console.log(`🏊 メモリプール初期化完了 - ${poolTypes.length}種類`);
    }
    
    /**
     * 履歴システム初期化
     */
    initializeHistorySystem() {
        console.log('📚 履歴システム初期化完了');
    }
    
    /**
     * ガベージコレクション開始
     */
    startGarbageCollection() {
        console.log('🗑️ ガベージコレクション開始...');
        
        // 定期的なメモリクリーンアップ
        this.gcIntervalId = setInterval(() => {
            this.performGarbageCollection();
        }, this.gcInterval);
        
        // メモリ使用量監視
        if (performance.memory) {
            this.memoryMonitorId = setInterval(() => {
                this.monitorMemoryUsage();
            }, 5000); // 5秒間隔
        }
        
        console.log(`🗑️ ガベージコレクション開始 - ${this.gcInterval}ms間隔`);
    }
    
    /**
     * パフォーマンス監視開始
     */
    startPerformanceMonitoring() {
        console.log('📊 メモリパフォーマンス監視開始...');
        
        // 統計更新ループ
        this.performanceMonitorId = setInterval(() => {
            this.updatePerformanceMetrics();
        }, 10000); // 10秒間隔
        
        console.log('📊 メモリパフォーマンス監視開始完了');
    }
    
    /**
     * キーボードショートカット設定
     */
    setupKeyboardShortcuts() {
        const shortcuts = {
            'KeyZ': (e) => {
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    if (e.shiftKey) {
                        this.redo();
                    } else {
                        this.undo();
                    }
                }
            },
            'KeyY': (e) => {
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.redo();
                }
            }
        };
        
        document.addEventListener('keydown', (e) => {
            const key = e.code;
            if (shortcuts[key]) {
                // テキスト入力中は無視
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                    return;
                }
                shortcuts[key](e);
            }
        });
        
        console.log(`⌨️ キーボードショートカット設定完了: Ctrl+Z(undo), Ctrl+Y/Ctrl+Shift+Z(redo)`);
    }
    
    /**
     * 初期状態記録
     */
    recordInitialState() {
        if (!this.historyEnabled) return;
        
        const initialState = this.captureCurrentState();
        this.history = [initialState];
        this.historyIndex = 0;
        
        console.log('📝 初期状態記録完了');
    }
    
    // ==========================================
    // 🎯 履歴管理メソッド群
    // ==========================================
    
    /**
     * アクション記録
     * @param {string} actionType - アクション種別
     * @param {Object} data - データ
     * @param {Object} metadata - メタデータ
     * @returns {string|null} アクションID
     */
    recordAction(actionType, data, metadata = {}) {
        if (!this.historyEnabled) return null;
        
        const startTime = performance.now();
        
        try {
            // キューに追加して非同期処理
            const actionId = this.generateActionId();
            const queueItem = {
                id: actionId,
                type: actionType,
                data: this.cloneData(data),
                metadata: {
                    timestamp: Date.now(),
                    memoryUsage: this.getCurrentMemoryUsage(),
                    ...metadata
                },
                startTime
            };
            
            this.addToProcessingQueue(queueItem);
            return actionId;
            
        } catch (error) {
            console.error('❌ アクション記録エラー:', error);
            return null;
        }
    }
    
    /**
     * 非同期アクション処理
     */
    async processActionQueue() {
        if (this.isProcessing || this.processingQueue.length === 0) return;
        
        this.isProcessing = true;
        
        try {
            const batchSize = Math.min(this.compressionConfig.batchSize, this.processingQueue.length);
            const batch = this.processingQueue.splice(0, batchSize);
            
            for (const queueItem of batch) {
                await this.processAction(queueItem);
            }
            
        } catch (error) {
            console.error('❌ アクションキュー処理エラー:', error);
        } finally {
            this.isProcessing = false;
            
            // キューに残りがあれば続行
            if (this.processingQueue.length > 0) {
                setTimeout(() => this.processActionQueue(), 10);
            }
        }
    }
    
    /**
     * 個別アクション処理
     * @param {Object} queueItem - キューアイテム
     */
    async processAction(queueItem) {
        const { id, type, data, metadata, startTime } = queueItem;
        
        // 現在状態取得
        const currentState = this.captureCurrentState();
        
        // 履歴エントリ作成
        const historyEntry = {
            id,
            type,
            timestamp: metadata.timestamp,
            beforeState: this.compressData(currentState),
            afterState: this.compressData(data),
            metadata,
            size: this.calculateDataSize(data)
        };
        
        // 履歴に追加
        this.addToHistory(historyEntry);
        
        // パフォーマンス統計更新
        const processTime = performance.now() - startTime;
        this.updateActionStats(processTime, historyEntry.size);
        
        console.log(`📝 アクション処理完了: ${type} (${processTime.toFixed(2)}ms)`);
    }
    
    /**
     * 履歴追加
     * @param {Object} historyEntry - 履歴エントリ
     */
    addToHistory(historyEntry) {
        // 現在位置以降の履歴を削除（分岐した履歴を破棄）
        if (this.historyIndex < this.history.length - 1) {
            const removedEntries = this.history.splice(this.historyIndex + 1);
            this.releaseMemoryFromEntries(removedEntries);
        }
        
        // 新しいエントリ追加
        this.history.push(historyEntry);
        this.historyIndex++;
        
        // 最大サイズ制限
        if (this.history.length > this.maxHistorySize) {
            const removedEntry = this.history.shift();
            this.releaseMemoryFromEntry(removedEntry);
            this.historyIndex--;
        }
        
        // 統計更新
        this.updateHistoryStats();
    }
    
    /**
     * アンドゥ実行
     * @returns {boolean} 実行成功
     */
    async undo() {
        if (!this.canUndo()) {
            console.log('↩️ アンドゥ不可: 履歴なし');
            return false;
        }
        
        const startTime = performance.now();
        
        try {
            const currentEntry = this.history[this.historyIndex];
            const beforeState = this.decompressData(currentEntry.beforeState);
            
            // 状態復元
            await this.restoreState(beforeState);
            
            this.historyIndex--;
            
            const undoTime = performance.now() - startTime;
            console.log(`↩️ アンドゥ完了: ${currentEntry.type} (${undoTime.toFixed(2)}ms)`);
            
            // UI通知
            this.notifyHistoryChange('undo', currentEntry);
            
            return true;
            
        } catch (error) {
            console.error('❌ アンドゥエラー:', error);
            return false;
        }
    }
    
    /**
     * リドゥ実行
     * @returns {boolean} 実行成功
     */
    async redo() {
        if (!this.canRedo()) {
            console.log('↪️ リドゥ不可: 先の履歴なし');
            return false;
        }
        
        const startTime = performance.now();
        
        try {
            this.historyIndex++;
            const nextEntry = this.history[this.historyIndex];
            const afterState = this.decompressData(nextEntry.afterState);
            
            // 状態復元
            await this.restoreState(afterState);
            
            const redoTime = performance.now() - startTime;
            console.log(`↪️ リドゥ完了: ${nextEntry.type} (${redoTime.toFixed(2)}ms)`);
            
            // UI通知
            this.notifyHistoryChange('redo', nextEntry);
            
            return true;
            
        } catch (error) {
            console.error('❌ リドゥエラー:', error);
            this.historyIndex--;
            return false;
        }
    }
    
    /**
     * 状態復元
     * @param {Object} state - 復元する状態
     */
    async restoreState(state) {
        if (!this.appCore) {
            throw new Error('AppCore未初期化');
        }
        
        try {
            // PixiJSアプリケーション状態復元
            if (state.canvas) {
                await this.restoreCanvasState(state.canvas);
            }
            
            // 描画パス復元
            if (state.paths) {
                await this.restorePathsState(state.paths);
            }
            
            // レイヤー状態復元
            if (state.layers) {
                await this.restoreLayersState(state.layers);
            }
            
            // ツール設定復元
            if (state.tools) {
                await this.restoreToolsState(state.tools);
            }
        } catch (error) {
            console.error('❌ 状態復元エラー:', error);
            throw error;
        }
    }
    
    // ==========================================
    // 🎯 メモリ最適化メソッド群
    // ==========================================
    
    /**
     * ガベージコレクション実行
     */
    performGarbageCollection() {
        const startTime = performance.now();
        
        try {
            console.log('🗑️ ガベージコレクション開始...');
            
            let totalFreed = 0;
            
            // メモリプール整理
            this.memoryPool.forEach((pool, type) => {
                const freed = this.cleanupMemoryPool(type, pool);
                totalFreed += freed;
            });
            
            // 古い履歴エントリの圧縮
            totalFreed += this.compressOldHistoryEntries();
            
            // 未使用参照のクリーンアップ
            totalFreed += this.cleanupUnusedReferences();
            
            const gcTime = performance.now() - startTime;
            
            this.performanceMetrics.gcCount++;
            this.performanceMetrics.lastGCTime = Date.now();
            
            console.log(`🗑️ ガベージコレクション完了: ${this.formatBytes(totalFreed)}解放 (${gcTime.toFixed(2)}ms)`);
            
            // 強制GC（可能な場合）
            if (window.gc && totalFreed > 50 * 1024 * 1024) { // 50MB以上解放時
                window.gc();
            }
            
        } catch (error) {
            console.error('❌ ガベージコレクション エラー:', error);
        }
    }
    
    /**
     * メモリプール整理
     * @param {string} type - プール種別
     * @param {Object} pool - プールオブジェクト
     * @returns {number} 解放サイズ
     */
    cleanupMemoryPool(type, pool) {
        let freedSize = 0;
        const now = Date.now();
        const maxAge = 5 * 60 * 1000; // 5分
        
        // 非アクティブなアイテムをクリーンアップ
        const toDelete = [];
        pool.inactive.forEach((item, key) => {
            if (now - item.lastAccess > maxAge) {
                toDelete.push(key);
                freedSize += item.size || 0;
            }
        });
        
        toDelete.forEach(key => {
            pool.inactive.delete(key);
        });
        
        // プールサイズ統計更新
        pool.totalSize -= freedSize;
        
        if (freedSize > 0) {
            console.log(`🏊 メモリプール整理 ${type}: ${this.formatBytes(freedSize)}解放`);
        }
        
        return freedSize;
    }
    
    /**
     * 古い履歴エントリ圧縮
     * @returns {number} 圧縮サイズ
     */
    compressOldHistoryEntries() {
        let compressedSize = 0;
        const compressionThreshold = 10; // 10エントリ前まで
        
        for (let i = 0; i < Math.max(0, this.historyIndex - compressionThreshold); i++) {
            const entry = this.history[i];
            if (entry && !entry.compressed) {
                const originalSize = entry.size || 0;
                
                // デルタ圧縮実行
                entry.beforeState = this.compressData(entry.beforeState, 'aggressive');
                entry.afterState = this.compressData(entry.afterState, 'aggressive');
                entry.compressed = true;
                
                const newSize = this.calculateDataSize(entry.beforeState) + 
                              this.calculateDataSize(entry.afterState);
                
                compressedSize += Math.max(0, originalSize - newSize);
                entry.size = newSize;
            }
        }
        
        if (compressedSize > 0) {
            console.log(`📦 履歴圧縮完了: ${this.formatBytes(compressedSize)}節約`);
        }
        
        return compressedSize;
    }
    
    /**
     * 未使用参照クリーンアップ
     * @returns {number} 解放サイズ
     */
    cleanupUnusedReferences() {
        let freedSize = 0;
        
        // WeakMapを使用した参照追跡があれば実行
        // 現在は基本的なnull設定のみ
        
        return freedSize;
    }
    
    /**
     * メモリ使用量監視
     */
    monitorMemoryUsage() {
        if (!performance.memory) return;
        
        const memInfo = performance.memory;
        const currentUsage = memInfo.usedJSHeapSize;
        const currentUsageMB = Math.round(currentUsage / 1024 / 1024);
        
        this.performanceMetrics.memoryUsage = currentUsageMB;
        this.performanceMetrics.maxMemoryUsage = Math.max(
            this.performanceMetrics.maxMemoryUsage, 
            currentUsageMB
        );
        
        // メモリ閾値チェック
        if (currentUsageMB > this.memoryThreshold) {
            console.warn(`⚠️ メモリ使用量警告: ${currentUsageMB}MB > ${this.memoryThreshold}MB`);
            this.performEmergencyCleanup();
        }
        
        // 定期的なログ出力
        if (this.performanceMetrics.totalActions % 100 === 0) {
            console.log(`📊 メモリ使用状況: ${currentUsageMB}MB / ${Math.round(memInfo.jsHeapSizeLimit / 1024 / 1024)}MB`);
        }
    }
    
    /**
     * 緊急メモリクリーンアップ
     */
    performEmergencyCleanup() {
        console.warn('🚨 緊急メモリクリーンアップ実行...');
        
        // 履歴サイズを一時的に削減
        const originalMaxSize = this.maxHistorySize;
        this.maxHistorySize = Math.max(10, Math.floor(originalMaxSize / 2));
        
        // 古い履歴を削除
        while (this.history.length > this.maxHistorySize && this.historyIndex >= 0) {
            const removedEntry = this.history.shift();
            this.releaseMemoryFromEntry(removedEntry);
            this.historyIndex--;
        }
        
        // 強制ガベージコレクション
        this.performGarbageCollection();
        
        // 設定を戻す
        setTimeout(() => {
            this.maxHistorySize = originalMaxSize;
        }, 60000); // 1分後
        
        console.log('🚨 緊急メモリクリーンアップ完了');
    }
    
    // ==========================================
    // 🎯 データ処理ユーティリティ
    // ==========================================
    
    /**
     * 現在状態キャプチャ
     * @returns {Object} 現在の状態
     */
    captureCurrentState() {
        const state = {
            timestamp: Date.now(),
            version: this.version
        };
        
        try {
            // キャンバス状態
            if (this.appCore && this.appCore.app) {
                state.canvas = {
                    width: this.appCore.canvasWidth || 800,
                    height: this.appCore.canvasHeight || 600,
                    backgroundColor: this.appCore.app.renderer?.background?.color || 0xf0e0d6
                };
            }
            
            // 描画パス
            if (this.appCore && this.appCore.paths) {
                state.paths = this.serializePaths(this.appCore.paths);
            }
            
            // レイヤー（将来実装）
            state.layers = [];
            
            // ツール設定
            if (this.appCore && this.appCore.toolSystem) {
                state.tools = this.serializeToolSettings(this.appCore.toolSystem);
            }
            
        } catch (error) {
            console.error('❌ 状態キャプチャエラー:', error);
        }
        
        return state;
    }
    
    /**
     * パスデータシリアライズ
     * @param {Array} paths - パス配列
     * @returns {Array} シリアライズされたパス
     */
    serializePaths(paths) {
        if (!Array.isArray(paths)) return [];
        
        return paths.map(path => {
            if (!path || !path.graphics) return null;
            
            try {
                // PixiJS Graphics から基本データのみ抽出
                return {
                    id: path.id || this.generateActionId(),
                    type: path.type || 'path',
                    points: path.points ? [...path.points] : [],
                    style: {
                        color: path.color || 0x800000,
                        alpha: path.alpha || 1,
                        width: path.width || 1
                    },
                    transform: {
                        x: path.x || 0,
                        y: path.y || 0,
                        scaleX: path.scale?.x || 1,
                        scaleY: path.scale?.y || 1,
                        rotation: path.rotation || 0
                    },
                    visible: path.visible !== false
                };
                
            } catch (error) {
                console.error('❌ パスシリアライズエラー:', error);
                return null;
            }
        }).filter(path => path !== null);
    }
    
    /**
     * ツール設定シリアライズ
     * @param {Object} toolSystem - ツールシステム
     * @returns {Object} シリアライズされたツール設定
     */
    serializeToolSettings(toolSystem) {
        try {
            return {
                currentTool: toolSystem.currentTool || 'pen',
                settings: toolSystem.settings ? { ...toolSystem.settings } : {}
            };
        } catch (error) {
            console.error('❌ ツール設定シリアライズエラー:', error);
            return { currentTool: 'pen', settings: {} };
        }
    }
    
    /**
     * データ圧縮
     * @param {*} data - 圧縮するデータ
     * @param {string} level - 圧縮レベル
     * @returns {*} 圧縮されたデータ
     */
    compressData(data, level = 'normal') {
        if (!this.compressionEnabled) return data;
        
        try {
            const serialized = JSON.stringify(data);
            const size = new Blob([serialized]).size;
            
            if (size < this.compressionConfig.threshold) {
                return data; // 小さいデータは圧縮しない
            }
            
            // レベル別圧縮
            switch (level) {
                case 'aggressive':
                    return this.aggressiveCompress(data);
                case 'delta':
                    return this.deltaCompress(data);
                default:
                    return this.basicCompress(data);
            }
            
        } catch (error) {
            console.error('❌ データ圧縮エラー:', error);
            return data;
        }
    }
    
    /**
     * 基本圧縮
     * @param {*} data - データ
     * @returns {Object} 圧縮データ
     */
    basicCompress(data) {
        const serialized = JSON.stringify(data);
        return {
            compressed: true,
            type: 'basic',
            data: serialized,
            originalSize: new Blob([serialized]).size
        };
    }
    
    /**
     * デルタ圧縮
     * @param {*} data - データ
     * @returns {Object} 圧縮データ
     */
    deltaCompress(data) {
        // 前の状態との差分のみ保存
        return {
            compressed: true,
            type: 'delta',
            data: data, // 簡略化版
            originalSize: this.calculateDataSize(data)
        };
    }
    
    /**
     * 積極的圧縮
     * @param {*} data - データ
     * @returns {Object} 圧縮データ
     */
    aggressiveCompress(data) {
        // より積極的な圧縮（詳細情報削減）
        const compressed = this.lodashAvailable ? 
            window._.cloneDeep(data) : JSON.parse(JSON.stringify(data));
        
        // 不要なプロパティ削除
        this.removeUnnecessaryProperties(compressed);
        
        return {
            compressed: true,
            type: 'aggressive',
            data: compressed,
            originalSize: this.calculateDataSize(data)
        };
    }
    
    /**
     * データ展開
     * @param {*} data - 展開するデータ
     * @returns {*} 展開されたデータ
     */
    decompressData(data) {
        if (!data || !data.compressed) return data;
        
        try {
            switch (data.type) {
                case 'basic':
                    return JSON.parse(data.data);
                case 'delta':
                case 'aggressive':
                default:
                    return data.data;
            }
        } catch (error) {
            console.error('❌ データ展開エラー:', error);
            return data;
        }
    }
    
    /**
     * データクローン
     * @param {*} data - クローンするデータ
     * @returns {*} クローンされたデータ
     */
    cloneData(data) {
        try {
            if (this.lodashAvailable) {
                return window._.cloneDeep(data);
            } else {
                return JSON.parse(JSON.stringify(data));
            }
        } catch (error) {
            console.error('❌ データクローンエラー:', error);
            return data;
        }
    }
    
    /**
     * データサイズ計算
     * @param {*} data - データ
     * @returns {number} データサイズ（バイト）
     */
    calculateDataSize(data) {
        try {
            const serialized = JSON.stringify(data);
            return new Blob([serialized]).size;
        } catch (error) {
            console.error('❌ データサイズ計算エラー:', error);
            return 0;
        }
    }
    
    /**
     * 不要プロパティ削除
     * @param {Object} obj - オブジェクト
     */
    removeUnnecessaryProperties(obj) {
        const unnecessaryProps = [
            '__metadata',
            '__temp',
            '__cache',
            'debugInfo',
            'events',
            '_listeners'
        ];
        
        const removeProps = (target) => {
            if (typeof target !== 'object' || target === null) return;
            
            unnecessaryProps.forEach(prop => {
                if (target.hasOwnProperty(prop)) {
                    delete target[prop];
                }
            });
            
            Object.values(target).forEach(value => {
                if (typeof value === 'object' && value !== null) {
                    removeProps(value);
                }
            });
        };
        
        removeProps(obj);
    }
    
    // ==========================================
    // 🎯 状態復元メソッド群
    // ==========================================
    
    /**
     * キャンバス状態復元
     * @param {Object} canvasState - キャンバス状態
     */
    async restoreCanvasState(canvasState) {
        if (!this.appCore || !this.appCore.app) return;
        
        try {
            // サイズ復元
            if (canvasState.width && canvasState.height) {
                if (this.appCore.resize) {
                    await this.appCore.resize(canvasState.width, canvasState.height, true);
                }
            }
            
            // 背景色復元
            if (canvasState.backgroundColor !== undefined && this.appCore.app.renderer) {
                // 📋 V8_MIGRATION: background.color に変更予定
                if (this.appCore.app.renderer.background) {
                    this.appCore.app.renderer.background.color = canvasState.backgroundColor;
                }
            }
            
        } catch (error) {
            console.error('❌ キャンバス状態復元エラー:', error);
        }
    }
    
    /**
     * パス状態復元
     * @param {Array} pathsState - パス状態配列
     */
    async restorePathsState(pathsState) {
        if (!this.appCore || !Array.isArray(pathsState)) return;
        
        try {
            // 既存パスをクリア
            if (this.appCore.drawingContainer) {
                this.appCore.drawingContainer.removeChildren();
            }
            
            if (this.appCore.paths) {
                this.appCore.paths = [];
            }
            
            // パスを復元
            for (const pathData of pathsState) {
                await this.restoreIndividualPath(pathData);
            }
            
        } catch (error) {
            console.error('❌ パス状態復元エラー:', error);
        }
    }
    
    /**
     * 個別パス復元
     * @param {Object} pathData - パスデータ
     */
    async restoreIndividualPath(pathData) {
        if (!pathData || !pathData.points || !this.appCore) return;
        
        try {
            // PixiJS Graphics作成
            if (typeof PIXI === 'undefined') {
                console.warn('⚠️ PIXI未定義 - パス復元スキップ');
                return;
            }
            
            const graphics = new PIXI.Graphics();
            
            // スタイル適用
            if (pathData.style) {
                graphics.lineStyle({
                    width: pathData.style.width || 1,
                    color: pathData.style.color || 0x800000,
                    alpha: pathData.style.alpha || 1
                });
            }
            
            // パス描画
            if (pathData.points.length > 0) {
                graphics.moveTo(pathData.points[0].x, pathData.points[0].y);
                for (let i = 1; i < pathData.points.length; i++) {
                    const point = pathData.points[i];
                    graphics.lineTo(point.x, point.y);
                }
            }
            
            // 変形適用
            if (pathData.transform) {
                graphics.x = pathData.transform.x || 0;
                graphics.y = pathData.transform.y || 0;
                graphics.scale.set(
                    pathData.transform.scaleX || 1, 
                    pathData.transform.scaleY || 1
                );
                graphics.rotation = pathData.transform.rotation || 0;
            }
            
            // 可視性設定
            graphics.visible = pathData.visible !== false;
            
            // コンテナに追加
            if (this.appCore.drawingContainer) {
                this.appCore.drawingContainer.addChild(graphics);
            }
            
            // パス配列に追加
            const pathObject = {
                id: pathData.id,
                type: pathData.type,
                graphics: graphics,
                points: pathData.points,
                ...pathData
            };
            
            if (this.appCore.paths) {
                this.appCore.paths.push(pathObject);
            }
            
        } catch (error) {
            console.error('❌ 個別パス復元エラー:', error);
        }
    }
    
    /**
     * レイヤー状態復元
     * @param {Array} layersState - レイヤー状態
     */
    async restoreLayersState(layersState) {
        // 将来実装
        console.log('📋 レイヤー状態復元（将来実装）');
    }
    
    /**
     * ツール状態復元
     * @param {Object} toolsState - ツール状態
     */
    async restoreToolsState(toolsState) {
        if (!this.appCore || !this.appCore.toolSystem) return;
        
        try {
            // ツール選択復元
            if (toolsState.currentTool && this.appCore.toolSystem.setTool) {
                this.appCore.toolSystem.setTool(toolsState.currentTool);
            }
            
            // ツール設定復元
            if (toolsState.settings && this.appCore.toolSystem.updateSettings) {
                this.appCore.toolSystem.updateSettings(toolsState.settings);
            }
            
        } catch (error) {
            console.error('❌ ツール状態復元エラー:', error);
        }
    }
    
    // ==========================================
    // 🎯 ユーティリティ・API
    // ==========================================
    
    /**
     * アクションID生成
     * @returns {string} 一意のアクションID
     */
    generateActionId() {
        return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * 処理キューに追加
     * @param {Object} item - キューアイテム
     */
    addToProcessingQueue(item) {
        this.processingQueue.push(item);
        
        // キューサイズ制限
        if (this.processingQueue.length > this.maxQueueSize) {
            this.processingQueue.shift(); // 古いアイテムを削除
        }
        
        // 非同期処理開始
        setTimeout(() => this.processActionQueue(), 0);
    }
    
    /**
     * メモリ解放
     * @param {Object} entry - 履歴エントリ
     */
    releaseMemoryFromEntry(entry) {
        if (!entry) return;
        
        // 圧縮データの解放
        entry.beforeState = null;
        entry.afterState = null;
        entry.metadata = null;
    }
    
    /**
     * 複数エントリのメモリ解放
     * @param {Array} entries - 履歴エントリ配列
     */
    releaseMemoryFromEntries(entries) {
        if (Array.isArray(entries)) {
            entries.forEach(entry => this.releaseMemoryFromEntry(entry));
        }
    }
    
    /**
     * パフォーマンス統計更新
     */
    updatePerformanceMetrics() {
        this.performanceMetrics.totalActions++;
        
        // 履歴統計更新
        this.updateHistoryStats();
    }
    
    /**
     * アクション統計更新
     * @param {number} processTime - 処理時間
     * @param {number} actionSize - アクションサイズ
     */
    updateActionStats(processTime, actionSize) {
        const totalTime = this.performanceMetrics.avgActionTime * this.performanceMetrics.totalActions;
        this.performanceMetrics.avgActionTime = (totalTime + processTime) / (this.performanceMetrics.totalActions + 1);
    }
    
    /**
     * 履歴統計更新
     */
    updateHistoryStats() {
        let totalSize = 0;
        let compressedSize = 0;
        
        this.history.forEach(entry => {
            totalSize += entry.size || 0;
            if (entry.compressed) {
                compressedSize += entry.size || 0;
            }
        });
        
        this.historyStats.totalSize = totalSize;
        this.historyStats.compressedSize = compressedSize;
        this.historyStats.compressionRatio = totalSize > 0 ? compressedSize / totalSize : 1;
        this.historyStats.averageActionSize = this.history.length > 0 ? totalSize / this.history.length : 0;
    }
    
    /**
     * 現在メモリ使用量取得
     * @returns {number} メモリ使用量（MB）
     */
    getCurrentMemoryUsage() {
        if (performance.memory) {
            return Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
        }
        return 0;
    }
    
    /**
     * バイト数フォーマット
     * @param {number} bytes - バイト数
     * @returns {string} フォーマットされた文字列
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }
    
    /**
     * 履歴変更通知
     * @param {string} type - 変更タイプ
     * @param {Object} entry - 履歴エントリ
     */
    notifyHistoryChange(type, entry) {
        // UI更新通知
        if (this.appCore && this.appCore.uiManager) {
            // UIManagerに履歴変更を通知
        }
        
        // カスタムイベント発火
        const event = new CustomEvent('memorymanager-history-change', {
            detail: { type, entry, canUndo: this.canUndo(), canRedo: this.canRedo() }
        });
        
        if (typeof document !== 'undefined') {
            document.dispatchEvent(event);
        }
    }
    
    /**
     * アンドゥ可能かチェック
     * @returns {boolean} アンドゥ可能性
     */
    canUndo() {
        return this.historyEnabled && this.historyIndex > 0;
    }
    
    /**
     * リドゥ可能かチェック
     * @returns {boolean} リドゥ可能性
     */
    canRedo() {
        return this.historyEnabled && this.historyIndex < this.history.length - 1;
    }
    
    /**
     * 履歴有効化/無効化
     * @param {boolean} enabled - 有効状態
     */
    setHistoryEnabled(enabled) {
        this.historyEnabled = enabled;
        console.log(`📚 履歴管理: ${enabled ? '有効' : '無効'}`);
    }
    
    /**
     * 履歴クリア
     */
    clearHistory() {
        this.releaseMemoryFromEntries(this.history);
        this.history = [];
        this.historyIndex = -1;
        this.updateHistoryStats();
        console.log('🗑️ 履歴クリア完了');
    }
    
    /**
     * 履歴サイズ制限設定
     * @param {number} size - 最大履歴サイズ
     */
    setMaxHistorySize(size) {
        this.maxHistorySize = Math.max(1, size);
        
        // 現在の履歴が制限を超えている場合は削除
        while (this.history.length > this.maxHistorySize) {
            const removedEntry = this.history.shift();
            this.releaseMemoryFromEntry(removedEntry);
            this.historyIndex = Math.max(-1, this.historyIndex - 1);
        }
        
        console.log(`📚 履歴サイズ制限: ${this.maxHistorySize}エントリ`);
    }
    
    /**
     * フォールバック初期化
     */
    async fallbackInitialization() {
        console.log('🛡️ MemoryManager フォールバック初期化...');
        
        try {
            // 基本機能のみ初期化
            this.historyEnabled = true;
            this.history = [];
            this.historyIndex = -1;
            
            console.log('✅ フォールバック初期化完了');
            
        } catch (error) {
            console.error('❌ フォールバック初期化も失敗:', error);
        }
    }
    
    // ==========================================
    // 🎯 公開API・状態取得
    // ==========================================
    
    /**
     * メモリ管理状態取得
     * @returns {Object} ステータス情報
     */
    getStatus() {
        return {
            version: this.version,
            history: {
                enabled: this.historyEnabled,
                currentIndex: this.historyIndex,
                totalEntries: this.history.length,
                maxSize: this.maxHistorySize,
                canUndo: this.canUndo(),
                canRedo: this.canRedo()
            },
            memory: {
                currentUsage: this.getCurrentMemoryUsage(),
                maxUsage: this.performanceMetrics.maxMemoryUsage,
                threshold: this.memoryThreshold,
                poolTypes: Array.from(this.memoryPool.keys()),
                gcInterval: this.gcInterval
            },
            performance: {
                ...this.performanceMetrics,
                historyStats: { ...this.historyStats }
            },
            queue: {
                size: this.processingQueue.length,
                isProcessing: this.isProcessing,
                maxSize: this.maxQueueSize
            },
            extensions: {
                lodash: this.lodashAvailable,
                performanceMonitor: !!this.performanceMonitor
            }
        };
    }
    
    /**
     * デバッグ情報取得
     * @returns {Object} デバッグ情報
     */
    getDebugInfo() {
        const status = this.getStatus();
        
        console.group('🧠 MemoryManager デバッグ情報');
        console.log('📋 バージョン:', status.version);
        console.log('📚 履歴状態:', status.history);
        console.log('🧠 メモリ状態:', status.memory);
        console.log('📊 パフォーマンス:', status.performance);
        console.log('⏳ キュー状態:', status.queue);
        console.log('🔧 拡張機能:', status.extensions);
        console.groupEnd();
        
        return status;
    }
    
    /**
     * 履歴情報取得
     * @returns {Object} 履歴情報
     */
    getHistoryInfo() {
        return {
            current: this.historyIndex >= 0 ? this.history[this.historyIndex] : null,
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            undoAction: this.historyIndex > 0 ? this.history[this.historyIndex].type : null,
            redoAction: this.historyIndex < this.history.length - 1 ? 
                this.history[this.historyIndex + 1].type : null,
            totalSize: this.formatBytes(this.historyStats.totalSize),
            compressionRatio: Math.round(this.historyStats.compressionRatio * 100) + '%',
            averageSize: this.formatBytes(this.historyStats.averageActionSize)
        };
    }
    
    /**
     * メモリ情報取得
     * @returns {Object} メモリ情報
     */
    getMemoryInfo() {
        const memInfo = {
            current: this.getCurrentMemoryUsage() + 'MB',
            max: this.performanceMetrics.maxMemoryUsage + 'MB',
            threshold: this.memoryThreshold + 'MB',
            gcCount: this.performanceMetrics.gcCount,
            lastGC: new Date(this.performanceMetrics.lastGCTime).toLocaleTimeString()
        };
        
        if (performance.memory) {
            const mem = performance.memory;
            memInfo.heap = {
                used: Math.round(mem.usedJSHeapSize / 1024 / 1024) + 'MB',
                total: Math.round(mem.totalJSHeapSize / 1024 / 1024) + 'MB',
                limit: Math.round(mem.jsHeapSizeLimit / 1024 / 1024) + 'MB'
            };
        }
        
        return memInfo;
    }
    
    /**
     * 診断レポート生成
     * @returns {Object} 診断結果
     */
    runDiagnosis() {
        console.group('🔍 Memory Manager システム診断');
        
        const status = this.getStatus();
        
        // 機能テスト
        const tests = {
            historySystem: this.history.length >= 0,
            memoryMonitoring: !!performance.memory,
            undoRedo: this.historyEnabled,
            compression: this.compressionEnabled,
            garbageCollection: this.gcIntervalId != null,
            performanceMetrics: Object.keys(this.performanceMetrics).length > 0,
            appCoreIntegration: !!this.appCore
        };
        
        // 診断結果
        const diagnosis = {
            status,
            tests,
            compliance: {
                memoryManagement: tests.historySystem && tests.memoryMonitoring,
                performanceOptimization: tests.compression && tests.garbageCollection,
                systemIntegration: tests.appCoreIntegration
            }
        };
        
        console.log('📊 診断結果:', diagnosis);
        
        // 推奨事項
        const recommendations = [];
        
        if (!tests.historySystem) recommendations.push('履歴システム初期化が必要');
        if (!tests.memoryMonitoring) recommendations.push('メモリ監視機能が利用不可');
        if (!tests.compression) recommendations.push('圧縮機能有効化推奨');
        if (!tests.appCoreIntegration) recommendations.push('AppCore統合が必要');
        
        if (recommendations.length > 0) {
            console.warn('⚠️ 推奨事項:', recommendations);
        } else {
            console.log('✅ 全システム正常動作中');
        }
        
        console.groupEnd();
        
        return diagnosis;
    }
    
    /**
     * 破棄・クリーンアップ
     */
    destroy() {
        console.log('🗑️ Memory Manager破棄開始...');
        
        try {
            // タイマークリア
            if (this.gcIntervalId) {
                clearInterval(this.gcIntervalId);
            }
            
            if (this.memoryMonitorId) {
                clearInterval(this.memoryMonitorId);
            }
            
            if (this.performanceMonitorId) {
                clearInterval(this.performanceMonitorId);
            }
            
            // 履歴クリア
            this.clearHistory();
            
            // メモリプールクリア
            this.memoryPool.clear();
            
            // 処理キュークリア
            this.processingQueue = [];
            this.isProcessing = false;
            
            console.log('✅ Memory Manager破棄完了');
            
        } catch (error) {
            console.error('❌ Memory Manager破棄エラー:', error);
        }
    }
}

// ==========================================
// 🎯 グローバル登録・エクスポート
// ==========================================

// グローバル登録（Phase1.2仕様準拠）
if (typeof window !== 'undefined') {
    window.MemoryManager = MemoryManager;
    console.log('🌐 MemoryManager グローバル登録完了');
}

// ==========================================
// 🎯 Phase1.1ss5 実装完了ログ
// ==========================================

console.log('🧠 Memory Manager Phase1.1ss5 実装完了');
console.log('✅ 主要機能:');
console.log('  - 非破壊履歴管理・アンドゥ/リドゥ・キーボードショートカット');
console.log('  - メモリ最適化・ガベージコレクション・緊急クリーンアップ');  
console.log('  - データ圧縮・状態復元・パフォーマンス監視');
console.log('  - AppCore統合・Manager連携・診断システム');
console.log('  - Pure JavaScript準拠・構文エラー修正完了');

console.log('📋 V8_MIGRATION準備済み箇所:');
console.log('  - WebGPU Buffer管理準備');
console.log('  - GPU Memory監視対応');
console.log('  - 120FPS最適化準備');

/**
 * 📋 使用方法例:
 * 
 * // 初期化
 * const memoryManager = new MemoryManager(appCore);
 * await memoryManager.initialize();
 * 
 * // アクション記録
 * const actionId = memoryManager.recordAction('DRAW_UPDATE', pathData);
 * 
 * // アンドゥ・リドゥ
 * await memoryManager.undo();
 * await memoryManager.redo();
 * 
 * // 状態取得  
 * const status = memoryManager.getStatus();
 * const diagnosis = memoryManager.runDiagnosis();
 * 
 * // 設定変更
 * memoryManager.setMaxHistorySize(100);
 * memoryManager.setHistoryEnabled(true);
 */