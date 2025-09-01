/**
 * 📄 FILE: js/utils/record-manager.js
 * 📌 RESPONSIBILITY: TPF形式ストローク記録・履歴管理・非破壊編集
 *
 * @provides
 *   - RecordManager
 *   - addStroke(strokeData)
 *   - startOperation(kind, seedPoints)
 *   - endOperation(meta)
 *   - undo() / redo()
 *   - getTPFHistory()
 *   - setManagers(managers)
 *   - init(): Promise<void>
 *   - isReady()
 *
 * @uses
 *   - managers.canvas.getDrawContainer()
 *   - managers.eventbus.emit()
 *   - PIXI.Graphics v8 API
 *
 * @initflow
 *   1. constructor → 2. setManagers → 3. init() → 4. addStroke利用可能
 *
 * @forbids
 *   💀 双方向依存禁止
 *   🚫 フォールバック禁止
 *   🚫 フェイルセーフ禁止
 *   🚫 v7/v8二重管理禁止
 *
 * @manager-key
 *   window.Tegaki.RecordManagerInstance
 *
 * @dependencies-strict
 *   REQUIRED: CanvasManager, EventBus
 *   OPTIONAL: ConfigManager, ErrorManager
 *   FORBIDDEN: Tool直接依存
 *
 * ChangeLog: 2025-09-01 init()メソッド追加・Manager完全初期化対応
 */

// 多重定義防止
if (!window.Tegaki) {
    window.Tegaki = {};
}

/**
 * RecordManager - TPF形式ストローク記録・履歴管理
 * addStrokeメソッド・init()メソッド実装版
 */
class RecordManager {
    constructor() {
        console.log('🚀 RecordManager v8初期化開始');
        
        // Manager統合（注入方式）
        this.managers = {
            canvas: null,
            eventbus: null,
            config: null,
            error: null
        };
        
        // TPF履歴管理
        this.tpfHistory = [];        // TPF記録履歴
        this.redoStack = [];         // Redo用スタック
        this.currentOperation = null; // 現在の操作
        
        // v8状態管理
        this.ready = false;
        this.v8Ready = false;
        this.managersReady = false;
        this.initialized = false;
        
        // 設定・統計
        this.maxHistorySize = 1000;  // 最大履歴数
        this.operationCount = 0;     // 操作カウント
        this.lastError = null;
        
        console.log('🔄 RecordManager v8対応版 作成完了');
    }
    
    /**
     * Manager統合注入
     */
    setManagers(managers) {
        console.log('🔧 RecordManager Manager統合注入開始');
        
        try {
            // Manager型確認・統一処理
            let managersObj;
            if (managers instanceof Map) {
                managersObj = Object.fromEntries(managers);
            } else if (typeof managers === 'object' && managers !== null) {
                managersObj = managers;
            } else {
                throw new Error(`Invalid managers type: ${typeof managers}`);
            }
            
            // 必須Manager確認・注入
            const requiredManagers = ['canvas', 'eventbus'];
            for (const key of requiredManagers) {
                if (!managersObj[key]) {
                    throw new Error(`Required manager missing: ${key}`);
                }
                this.managers[key] = managersObj[key];
            }
            
            // オプションManager注入
            const optionalManagers = ['config', 'error'];
            for (const key of optionalManagers) {
                if (managersObj[key]) {
                    this.managers[key] = managersObj[key];
                }
            }
            
            this.managersReady = true;
            
            console.log('✅ RecordManager Manager統合注入完了');
            return true;
            
        } catch (error) {
            this.lastError = error;
            console.error('❌ RecordManager Manager統合注入エラー:', error);
            return false;
        }
    }
    
    /**
     * 初期化処理（新規追加：AppCore統合用）
     */
    async init() {
        console.log('🔄 RecordManager init() 開始');
        
        try {
            if (this.initialized) {
                console.log('⚠️ RecordManager already initialized');
                return true;
            }
            
            if (!this.managersReady) {
                throw new Error('Managers not set - call setManagers() first');
            }
            
            // v8統合確認・準備完了チェック
            await this.validateV8Integration();
            
            // 初期化完了
            this.initialized = true;
            this.ready = true;
            this.v8Ready = true;
            
            console.log('✅ RecordManager init() 完了');
            return true;
            
        } catch (error) {
            this.lastError = error;
            console.error('❌ RecordManager init() エラー:', error);
            this.ready = false;
            this.v8Ready = false;
            throw error;
        }
    }
    
    /**
     * v8統合確認・準備完了チェック
     */
    async validateV8Integration() {
        try {
            // CanvasManager確認
            if (!this.managers.canvas || typeof this.managers.canvas.getDrawContainer !== 'function') {
                throw new Error('CanvasManager getDrawContainer method not available');
            }
            
            // DrawContainer取得確認
            const drawContainer = this.managers.canvas.getDrawContainer();
            if (!drawContainer || typeof drawContainer.addChild !== 'function') {
                throw new Error('DrawContainer not ready or invalid');
            }
            
            // CanvasManager v8準備確認
            if (typeof this.managers.canvas.isV8Ready === 'function') {
                if (!this.managers.canvas.isV8Ready()) {
                    throw new Error('CanvasManager not v8 ready');
                }
            }
            
            console.log('✅ RecordManager v8統合確認完了');
            
        } catch (error) {
            this.lastError = error;
            console.error('❌ RecordManager v8統合確認エラー:', error);
            throw error;
        }
    }
    
    /**
     * ストローク追加（PenTool連携用メイン API）
     */
    addStroke(strokeData) {
        console.log('📝 RecordManager.addStroke() 開始:', strokeData?.id);
        
        if (!this.isReady()) {
            console.warn('⚠️ RecordManager not ready - call init() first');
            return false;
        }
        
        try {
            // ストロークデータ検証
            if (!strokeData || !strokeData.points || !Array.isArray(strokeData.points)) {
                throw new Error('Invalid stroke data format');
            }
            
            if (strokeData.points.length === 0) {
                console.warn('⚠️ Empty stroke data - ignoring');
                return false;
            }
            
            // TPF形式に変換
            const tpfStroke = this.convertToTPF(strokeData);
            
            // 履歴に追加
            this.tpfHistory.push(tpfStroke);
            this.operationCount++;
            
            // Redoスタッククリア（新操作により無効化）
            this.redoStack = [];
            
            // 履歴サイズ制限
            this.enforceHistoryLimit();
            
            // イベント通知
            this.notifyEvent('strokeAdded', {
                id: tpfStroke.id,
                points: tpfStroke.points.length,
                tool: tpfStroke.meta.tool
            });
            
            console.log('✅ RecordManager.addStroke() 完了:', tpfStroke.id);
            return true;
            
        } catch (error) {
            this.lastError = error;
            console.error('❌ RecordManager.addStroke() エラー:', error);
            this.notifyError(`Stroke記録失敗: ${error.message}`);
            return false;
        }
    }
    
    /**
     * ストロークデータをTPF形式に変換
     */
    convertToTPF(strokeData) {
        const tpfStroke = {
            id: strokeData.id || 'stroke_' + Date.now(),
            kind: strokeData.type || 'stroke',
            layer: 'default', // Phase1.5は単一レイヤー
            color: this.normalizeColor(strokeData.color),
            width: strokeData.width || 2.0,
            opacity: strokeData.opacity || 1.0,
            points: strokeData.points.map(pt => ({
                x: pt.x,
                y: pt.y,
                pressure: pt.pressure || 0.5,
                time: pt.time || 0
            })),
            bounds: this.calculateBounds(strokeData.points),
            meta: {
                created: strokeData.started || Date.now(),
                ended: strokeData.ended || Date.now(),
                duration: strokeData.duration || 0,
                tool: strokeData.tool || 'pen',
                engine: 'pixi-v8',
                version: 'Phase1.5'
            }
        };
        
        return tpfStroke;
    }
    
    /**
     * カラー正規化（16進数文字列に統一）
     */
    normalizeColor(color) {
        if (typeof color === 'number') {
            return '#' + color.toString(16).padStart(6, '0');
        }
        if (typeof color === 'string' && color.startsWith('#')) {
            return color;
        }
        return '#800000'; // デフォルト：ふたばマルーン
    }
    
    /**
     * バウンディングボックス計算
     */
    calculateBounds(points) {
        if (!points || points.length === 0) return null;
        
        let minX = points[0].x, maxX = points[0].x;
        let minY = points[0].y, maxY = points[0].y;
        
        for (const pt of points) {
            minX = Math.min(minX, pt.x);
            maxX = Math.max(maxX, pt.x);
            minY = Math.min(minY, pt.y);
            maxY = Math.max(maxY, pt.y);
        }
        
        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
        };
    }
    
    /**
     * 元に戻す
     */
    undo() {
        if (this.tpfHistory.length === 0) {
            console.log('⚠️ Undo: 履歴なし');
            return false;
        }
        
        console.log('🔄 RecordManager Undo実行');
        
        try {
            // 最新操作をRedoスタックに移動
            const undoOperation = this.tpfHistory.pop();
            this.redoStack.push(undoOperation);
            
            // Undo通知
            this.notifyEvent('undoExecuted', {
                operationId: undoOperation.id,
                remainingHistory: this.tpfHistory.length
            });
            
            console.log('✅ RecordManager Undo完了');
            return true;
            
        } catch (error) {
            this.lastError = error;
            console.error('❌ RecordManager Undoエラー:', error);
            return false;
        }
    }
    
    /**
     * やり直し
     */
    redo() {
        if (this.redoStack.length === 0) {
            console.log('⚠️ Redo: Redoスタック空');
            return false;
        }
        
        console.log('🔄 RecordManager Redo実行');
        
        try {
            // RedoスタックからTPF履歴に復元
            const redoOperation = this.redoStack.pop();
            this.tpfHistory.push(redoOperation);
            
            // Redo通知
            this.notifyEvent('redoExecuted', {
                operationId: redoOperation.id,
                historyLength: this.tpfHistory.length
            });
            
            console.log('✅ RecordManager Redo完了');
            return true;
            
        } catch (error) {
            this.lastError = error;
            console.error('❌ RecordManager Redoエラー:', error);
            return false;
        }
    }
    
    /**
     * 履歴サイズ制限
     */
    enforceHistoryLimit() {
        while (this.tpfHistory.length > this.maxHistorySize) {
            const oldOperation = this.tpfHistory.shift();
            console.log('📤 古い履歴削除:', oldOperation.id);
        }
    }
    
    /**
     * イベント通知
     */
    notifyEvent(eventName, data) {
        if (this.managers.eventbus?.emit) {
            this.managers.eventbus.emit(eventName, data);
        }
    }
    
    /**
     * エラー通知
     */
    notifyError(message, context = {}) {
        if (this.managers.error?.showError) {
            this.managers.error.showError(`RecordManager: ${message}`, context);
        } else {
            console.error(`❌ RecordManager: ${message}`, context);
        }
    }
    
    /**
     * 準備状況確認
     */
    isReady() {
        return this.ready && 
               this.managersReady && 
               this.v8Ready &&
               this.initialized &&
               !!this.managers.canvas &&
               typeof this.managers.canvas.getDrawContainer === 'function';
    }
    
    /**
     * TPF履歴取得
     */
    getTPFHistory() {
        return [...this.tpfHistory]; // 読み取り専用コピー
    }
    
    /**
     * 履歴統計取得
     */
    getHistoryStats() {
        return {
            totalOperations: this.operationCount,
            currentHistory: this.tpfHistory.length,
            redoStack: this.redoStack.length,
            lastOperation: this.tpfHistory.length > 0 ? this.tpfHistory[this.tpfHistory.length - 1].id : null
        };
    }
    
    /**
     * 全履歴クリア
     */
    clear() {
        console.log('🧹 RecordManager 全クリア開始');
        
        // 履歴クリア
        this.tpfHistory = [];
        this.redoStack = [];
        this.currentOperation = null;
        
        // カウンタリセット
        this.operationCount = 0;
        this.lastError = null;
        
        // クリア通知
        this.notifyEvent('recordManagerCleared', {
            timestamp: Date.now()
        });
        
        console.log('✅ RecordManager 全クリア完了');
        return true;
    }
    
    /**
     * デバッグ情報取得
     */
    getDebugInfo() {
        return {
            className: 'RecordManager',
            ready: this.isReady(),
            v8Ready: this.v8Ready,
            managersReady: this.managersReady,
            initialized: this.initialized,
            managers: {
                canvas: !!this.managers.canvas,
                eventbus: !!this.managers.eventbus,
                config: !!this.managers.config,
                error: !!this.managers.error
            },
            history: this.getHistoryStats(),
            lastError: this.lastError?.message || null
        };
    }
    
    /**
     * startOperation操作開始（互換性維持）
     */
    startOperation(kind, seedPoints = []) {
        console.log(`🚀 RecordManager startOperation: ${kind}`);
        
        if (!this.isReady()) {
            throw new Error('RecordManager not ready');
        }
        
        // 現在の操作終了
        if (this.currentOperation) {
            this.endOperation();
        }
        
        // 新しい操作開始
        this.currentOperation = {
            id: 'op_' + Date.now(),
            kind: kind,
            points: [...seedPoints],
            startTime: Date.now(),
            endTime: null
        };
        
        return this.currentOperation;
    }
    
    /**
     * endOperation操作終了（互換性維持）
     */
    endOperation(meta = {}) {
        if (!this.currentOperation) {
            console.warn('⚠️ 操作未開始 - endOperation無効');
            return null;
        }
        
        console.log(`🏁 RecordManager endOperation: ${this.currentOperation.kind}`);
        
        // 操作確定・TPF形式で保存
        const strokeData = {
            id: this.currentOperation.id,
            type: 'stroke',
            tool: 'pen',
            points: this.currentOperation.points,
            started: this.currentOperation.startTime,
            ended: Date.now(),
            duration: Date.now() - this.currentOperation.startTime,
            ...meta
        };
        
        // addStroke経由で保存
        this.addStroke(strokeData);
        
        const completedOperation = this.currentOperation;
        this.currentOperation = null;
        
        return completedOperation;
    }
    
    /**
     * addPoint座標追加（互換性維持）
     */
    addPoint(pt) {
        if (!this.currentOperation) {
            console.warn('⚠️ 操作未開始 - addPoint無効');
            return false;
        }
        
        this.currentOperation.points.push({
            x: pt.x,
            y: pt.y,
            pressure: pt.pressure || 0.5,
            time: Date.now() - this.currentOperation.startTime
        });
        
        return true;
    }
}

// グローバル登録
window.Tegaki.RecordManager = RecordManager;
console.log('🔄 RecordManager v8対応版 Loaded - addStrokeメソッド・init()メソッド実装版');