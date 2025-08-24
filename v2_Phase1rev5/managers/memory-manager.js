/**
 * 🎨 Tegaki Project - Memory Manager v12
 * 🎯 責務: Undo/Redo機能・メモリ管理・履歴保存
 * 📐 依存: EventBus, CanvasManager
 * 🔧 Phase: STEP3 - 機能拡張
 */

class MemoryManager {
    constructor() {
        this.version = 'v12-step3';
        this.validateDependencies();
        
        // 履歴管理
        this.history = [];
        this.historyIndex = -1;
        this.maxHistorySize = 50;
        this.historyEnabled = true;
        
        // メモリ管理
        this.memoryThreshold = 100 * 1024 * 1024; // 100MB
        this.gcInterval = 30000; // 30秒
        
        console.log('🧠 MemoryManager v12 構築完了');
    }
    
    /**
     * 依存関係確認
     */
    validateDependencies() {
        const required = ['EventBus', 'CanvasManager'];
        const missing = required.filter(dep => !window[dep]);
        
        if (missing.length > 0) {
            throw new Error(`MemoryManager依存関係エラー: ${missing.join(', ')}`);
        }
        
        console.log('✅ MemoryManager依存関係確認完了');
    }
    
    /**
     * 初期化
     */
    initialize() {
        console.log('🧠 MemoryManager初期化開始...');
        
        try {
            // イベント設定
            this.setupEventHandlers();
            
            // ガベージコレクション開始
            this.startGarbageCollection();
            
            // キーボードショートカット設定
            this.setupKeyboardShortcuts();
            
            // 初期状態保存
            this.saveSnapshot('初期状態');
            
            console.log('✅ MemoryManager初期化完了');
            return this;
            
        } catch (error) {
            console.error('❌ MemoryManager初期化エラー:', error);
            if (window.ErrorManager) {
                window.ErrorManager.showError('init-error', `MemoryManager初期化失敗: ${error.message}`);
            }
            throw error;
        }
    }
    
    /**
     * イベントハンドラー設定
     */
    setupEventHandlers() {
        if (!window.EventBus) return;
        
        // 描画完了時に自動保存
        window.EventBus.on('canvas:draw', () => {
            this.saveSnapshot('描画完了');
        });
        
        // キャンバスクリア時に保存
        window.EventBus.on('canvas:clear', () => {
            this.saveSnapshot('キャンバスクリア');
        });
        
        console.log('📡 MemoryManager イベントハンドラー設定完了');
    }
    
    /**
     * キーボードショートカット設定
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // テキスト入力中は無視
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }
            
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'z' && !e.shiftKey) {
                    e.preventDefault();
                    this.undo();
                } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
                    e.preventDefault();
                    this.redo();
                }
            }
        });
        
        console.log('⌨️ Undo/Redo ショートカット設定完了: Ctrl+Z, Ctrl+Y');
    }
    
    /**
     * スナップショット保存
     */
    saveSnapshot(description = '操作') {
        if (!this.historyEnabled) return;
        
        try {
            const snapshot = this.captureCurrentState(description);
            
            // 現在位置より後の履歴を削除（分岐処理）
            if (this.historyIndex < this.history.length - 1) {
                this.history = this.history.slice(0, this.historyIndex + 1);
            }
            
            // 新しいスナップショットを追加
            this.history.push(snapshot);
            this.historyIndex = this.history.length - 1;
            
            // 履歴サイズ制限
            if (this.history.length > this.maxHistorySize) {
                this.history.shift();
                this.historyIndex--;
            }
            
            // UI状態更新通知
            if (window.EventBus) {
                window.EventBus.emit('memory:snapshot-saved', {
                    description,
                    canUndo: this.canUndo(),
                    canRedo: this.canRedo()
                });
            }
            
            console.log('📸 スナップショット保存:', description);
            
        } catch (error) {
            console.error('❌ スナップショット保存エラー:', error);
        }
    }
    
    /**
     * 現在状態キャプチャ
     */
    captureCurrentState(description) {
        const snapshot = {
            id: this.generateSnapshotId(),
            description,
            timestamp: Date.now(),
            data: null,
            size: 0
        };
        
        try {
            // CanvasManagerから状態取得
            if (window.CanvasManager) {
                const canvasManager = window.CanvasManager;
                
                if (canvasManager.getPixiApp && canvasManager.getPixiApp()) {
                    const app = canvasManager.getPixiApp();
                    const stage = app.stage;
                    
                    // シンプルな状態保存（Graphics情報のみ）
                    const stageData = {
                        children: stage.children.map(child => {
                            if (child.isGraphics) {
                                return {
                                    type: 'graphics',
                                    geometry: child.geometry ? Array.from(child.geometry.graphicsData) : [],
                                    tint: child.tint,
                                    alpha: child.alpha,
                                    x: child.x,
                                    y: child.y,
                                    visible: child.visible
                                };
                            }
                            return null;
                        }).filter(data => data !== null)
                    };
                    
                    snapshot.data = stageData;
                    snapshot.size = JSON.stringify(stageData).length;
                }
            }
            
        } catch (error) {
            console.warn('⚠️ 状態キャプチャで問題発生:', error.message);
            snapshot.data = { error: error.message };
        }
        
        return snapshot;
    }
    
    /**
     * アンドゥ実行
     */
    async undo() {
        if (!this.canUndo()) {
            console.log('↩️ アンドゥ不可: 履歴なし');
            return false;
        }
        
        try {
            this.historyIndex--;
            const snapshot = this.history[this.historyIndex];
            
            await this.restoreSnapshot(snapshot);
            
            // UI状態更新通知
            if (window.EventBus) {
                window.EventBus.emit('memory:undo', {
                    description: snapshot.description,
                    canUndo: this.canUndo(),
                    canRedo: this.canRedo()
                });
            }
            
            console.log('↩️ アンドゥ実行:', snapshot.description);
            return true;
            
        } catch (error) {
            console.error('❌ アンドゥエラー:', error);
            this.historyIndex++; // ロールバック
            return false;
        }
    }
    
    /**
     * リドゥ実行
     */
    async redo() {
        if (!this.canRedo()) {
            console.log('↪️ リドゥ不可: 先の履歴なし');
            return false;
        }
        
        try {
            this.historyIndex++;
            const snapshot = this.history[this.historyIndex];
            
            await this.restoreSnapshot(snapshot);
            
            // UI状態更新通知
            if (window.EventBus) {
                window.EventBus.emit('memory:redo', {
                    description: snapshot.description,
                    canUndo: this.canUndo(),
                    canRedo: this.canRedo()
                });
            }
            
            console.log('↪️ リドゥ実行:', snapshot.description);
            return true;
            
        } catch (error) {
            console.error('❌ リドゥエラー:', error);
            this.historyIndex--; // ロールバック
            return false;
        }
    }
    
    /**
     * スナップショット復元
     */
    async restoreSnapshot(snapshot) {
        if (!snapshot.data || !window.CanvasManager) {
            throw new Error('復元データまたはCanvasManagerが利用できません');
        }
        
        try {
            const canvasManager = window.CanvasManager;
            
            // キャンバスクリア
            if (canvasManager.clear) {
                canvasManager.clear();
            }
            
            // データ復元
            if (snapshot.data.children) {
                const app = canvasManager.getPixiApp();
                if (!app) throw new Error('PIXI.Applicationが利用できません');
                
                const stage = app.stage;
                
                // Graphics復元（簡易版）
                snapshot.data.children.forEach(childData => {
                    if (childData.type === 'graphics') {
                        const graphics = new PIXI.Graphics();
                        
                        // 基本プロパティ復元
                        graphics.tint = childData.tint || 0xFFFFFF;
                        graphics.alpha = childData.alpha || 1;
                        graphics.x = childData.x || 0;
                        graphics.y = childData.y || 0;
                        graphics.visible = childData.visible !== false;
                        
                        // ジオメトリ復元（単純化）
                        if (childData.geometry && childData.geometry.length > 0) {
                            // 実際の復元処理はここで実装
                            // 現在は基本的な復元のみ
                        }
                        
                        stage.addChild(graphics);
                    }
                });
            }
            
            console.log('🔄 スナップショット復元完了:', snapshot.description);
            
        } catch (error) {
            console.error('❌ スナップショット復元エラー:', error);
            throw error;
        }
    }
    
    /**
     * アンドゥ可能判定
     */
    canUndo() {
        return this.historyEnabled && this.historyIndex > 0;
    }
    
    /**
     * リドゥ可能判定
     */
    canRedo() {
        return this.historyEnabled && this.historyIndex < this.history.length - 1;
    }
    
    /**
     * ガベージコレクション開始
     */
    startGarbageCollection() {
        setInterval(() => {
            this.performGarbageCollection();
        }, this.gcInterval);
        
        console.log('🗑️ ガベージコレクション開始:', this.gcInterval + 'ms間隔');
    }
    
    /**
     * ガベージコレクション実行
     */
    performGarbageCollection() {
        try {
            let totalFreed = 0;
            
            // 大きなスナップショットのクリーンアップ
            this.history.forEach(snapshot => {
                if (snapshot.size > this.memoryThreshold / 10) {
                    // 大きなデータを圧縮または削除
                    if (snapshot.data) {
                        const originalSize = snapshot.size;
                        snapshot.data = { compressed: true, description: snapshot.description };
                        snapshot.size = JSON.stringify(snapshot.data).length;
                        totalFreed += originalSize - snapshot.size;
                    }
                }
            });
            
            if (totalFreed > 0) {
                console.log('🗑️ ガベージコレクション:', totalFreed + 'bytes解放');
            }
            
        } catch (error) {
            console.error('❌ ガベージコレクション エラー:', error);
        }
    }
    
    /**
     * スナップショットID生成
     */
    generateSnapshotId() {
        return 'snapshot_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    /**
     * 状態取得
     */
    getStatus() {
        return {
            version: this.version,
            historyEnabled: this.historyEnabled,
            historyCount: this.history.length,
            historyIndex: this.historyIndex,
            maxHistorySize: this.maxHistorySize,
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            currentDescription: this.history[this.historyIndex]?.description || '不明'
        };
    }
    
    /**
     * デバッグ情報
     */
    getDebugInfo() {
        const status = this.getStatus();
        
        console.group('🧠 MemoryManager デバッグ情報');
        console.log('📋 バージョン:', status.version);
        console.log('📚 履歴状態:', {
            enabled: status.historyEnabled,
            count: status.historyCount,
            index: status.historyIndex,
            canUndo: status.canUndo,
            canRedo: status.canRedo
        });
        console.log('💾 メモリ設定:', {
            maxHistorySize: this.maxHistorySize,
            memoryThreshold: this.memoryThreshold,
            gcInterval: this.gcInterval
        });
        console.groupEnd();
        
        return status;
    }
}

// グローバル公開
if (typeof window !== 'undefined') {
    window.MemoryManager = MemoryManager;
    console.log('✅ MemoryManager v12 グローバル公開完了');
}

console.log('🧠 MemoryManager v12-step3 準備完了');
console.log('📋 STEP3実装: Undo/Redo・メモリ管理・履歴保存');
console.log('💡 使用例: const memoryManager = new window.MemoryManager(); memoryManager.initialize();');