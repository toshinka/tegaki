/**
 * 📄 FILE: js/utils/record-manager.js
 * 📌 RESPONSIBILITY: TPF形式ストローク記録・履歴管理・非破壊編集・Manager初期化修正版
 *
 * @provides
 *   - RecordManager クラス
 *   - addStroke(strokeData): boolean
 *   - startOperation(kind, seedPoints): Object
 *   - endOperation(meta): Object
 *   - addPoint(pt): boolean
 *   - undo(): boolean
 *   - redo(): boolean
 *   - getTPFHistory(): Array
 *   - setManagers(managers): boolean
 *   - isReady(): boolean
 *   - clear(): boolean
 *   - getDebugInfo(): Object
 *
 * @uses
 *   - CanvasManager.getDrawContainer(): PIXI.Container
 *   - EventBus.emit(eventName, data): void
 *   - ErrorManager.showError(message, context): void
 *   - ConfigManager.get(key): any
 *
 * @initflow
 *   1. constructor → 2. setManagers(managers) → 3. validateV8Integration() → 4. ready=true → 5. addStroke利用可能
 *
 * @forbids
 *   💀 双方向依存禁止
 *   🚫 フォールバック禁止
 *   🚫 フェイルセーフ禁止
 *   🚫 v7/v8二重管理禁止
 *   🚫 Manager未注入状態でのaddStroke呼び出し禁止
 *   🚫 TPF形式違反禁止
 *
 * @manager-key
 *   window.Tegaki.RecordManagerInstance
 *
 * @dependencies-strict
 *   REQUIRED: CanvasManager（v8Ready）, EventBus
 *   OPTIONAL: ConfigManager, ErrorManager
 *   FORBIDDEN: Tool直接依存, 双方向参照
 *
 * @integration-flow
 *   AppCore.initializeV8Managers() → RecordManager.setManagers() → 
 *   validateV8Integration() → Tool.addStroke() → TPF記録
 *
 * @method-naming-rules
 *   記録系: addStroke(), startOperation(), endOperation()
 *   履歴系: undo(), redo(), getTPFHistory()
 *   管理系: setManagers(), isReady(), validateV8Integration()
 *   変換系: convertToTPF(), calculateBounds(), normalizeColor()
 *
 * @error-handling
 *   throw: Manager初期化失敗, TPF変換失敗
 *   false: 操作失敗, データ不正, 準備未完了
 *   warn: オプション機能失敗, データ警告
 *
 * @state-management
 *   - 直接プロパティ変更禁止
 *   - ready状態確認必須
 *   - Manager注入後のみ操作可能
 *   - TPF履歴の読み取り専用アクセス
 *
 * @performance-notes
 *   TPF記録最小限データ構造, メモリ効率重視
 *   履歴サイズ制限で長時間利用対応
 *   バウンディングボックス計算で部分描画準備
 *
 * @testing-hooks
 *   - getDebugInfo(): 詳細状態確認
 *   - isReady(): 準備状態確認
 *   - getHistoryStats(): 履歴統計
 *   - validateV8Integration(): v8統合確認
 */

// 多重定義防止
if (!window.Tegaki) {
    window.Tegaki = {};
}

/**
 * 📝 RecordManager v8対応版 - Manager初期化修正・addStroke実装版
 * 
 * 🔧 修正内容:
 * - Manager注入タイミング修正
 * - setManagers()呼び出し確認
 * - isReady()状態管理強化
 * - addStroke()初期化順序対応
 * 
 * 🚀 特徴:
 * - TPF v0.2準拠データ形式
 * - Manager依存注入パターン統一
 * - 初期化エラー完全対応
 */
class RecordManager {
    constructor() {
        console.log('🚀 RecordManager v8初期化開始');
        
        // Manager統合（注入方式・初期化修正）
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
        
        // 初期化状態管理（修正版）
        this.ready = false;          // 完全準備完了
        this.v8Ready = false;        // v8統合完了
        this.managersReady = false;  // Manager注入完了
        this.initialized = false;    // 基本初期化完了
        
        // 設定・統計
        this.maxHistorySize = 1000;  // 最大履歴数
        this.operationCount = 0;     // 操作カウント
        this.lastError = null;       // 最終エラー
        
        // 初期化完了フラグ設定
        this.initialized = true;
        
        console.log('🔄 RecordManager v8対応版 作成完了');
    }
    
    /**
     * 🔧 Manager統合注入（初期化修正版）
     * 
     * @param {Object|Map} managers - Manager群
     * @returns {boolean} 注入成功フラグ
     */
    setManagers(managers) {
        console.log('🔧 RecordManager Manager統合注入開始');
        
        if (!this.initialized) {
            console.error('❌ RecordManager: 基本初期化未完了');
            return false;
        }
        
        try {
            // Manager型確認・統一処理（修正版）
            let managersObj;
            if (managers instanceof Map) {
                console.log('📦 Map形式Manager受信');
                managersObj = Object.fromEntries(managers);
            } else if (typeof managers === 'object' && managers !== null) {
                console.log('📦 Object形式Manager受信');
                managersObj = managers;
            } else {
                throw new Error(`Invalid managers type: ${typeof managers} - Object or Map required`);
            }
            
            // 必須Manager確認・注入（厳格チェック）
            const requiredManagers = ['canvas', 'eventbus'];
            const missingManagers = [];
            
            for (const key of requiredManagers) {
                if (!managersObj[key]) {
                    missingManagers.push(key);
                } else {
                    this.managers[key] = managersObj[key];
                    console.log(`✅ ${key}Manager注入成功`);
                }
            }
            
            if (missingManagers.length > 0) {
                throw new Error(`Required managers missing: ${missingManagers.join(', ')}`);
            }
            
            // オプションManager注入
            const optionalManagers = ['config', 'error'];
            for (const key of optionalManagers) {
                if (managersObj[key]) {
                    this.managers[key] = managersObj[key];
                    console.log(`✅ ${key}Manager注入成功 (オプション)`);
                }
            }
            
            // Manager注入完了フラグ
            this.managersReady = true;
            console.log('✅ Manager注入フェーズ完了');
            
            // v8統合確認実行
            this.validateV8Integration();
            
            console.log('✅ RecordManager Manager統合注入完了');
            return true;
            
        } catch (error) {
            this.lastError = error;
            console.error('❌ RecordManager Manager統合注入エラー:', error);
            
            // 失敗時状態リセット
            this.managersReady = false;
            this.ready = false;
            this.v8Ready = false;
            
            return false;
        }
    }
    
    /**
     * 🔍 v8統合確認・準備完了チェック（修正版）
     */
    validateV8Integration() {
        console.log('🔍 RecordManager v8統合確認開始');
        
        try {
            // Manager注入状態確認
            if (!this.managersReady) {
                throw new Error('Managers not injected - call setManagers() first');
            }
            
            // CanvasManager確認（v8準拠）
            if (!this.managers.canvas) {
                throw new Error('CanvasManager not injected');
            }
            
            if (typeof this.managers.canvas.getDrawContainer !== 'function') {
                throw new Error('CanvasManager getDrawContainer method not available');
            }
            
            // CanvasManager v8準備確認
            if (typeof this.managers.canvas.isV8Ready === 'function' && !this.managers.canvas.isV8Ready()) {
                throw new Error('CanvasManager v8 not ready');
            }
            
            // DrawContainer取得確認（実行テスト）
            let drawContainer;
            try {
                drawContainer = this.managers.canvas.getDrawContainer();
            } catch (error) {
                throw new Error(`DrawContainer取得失敗: ${error.message}`);
            }
            
            if (!drawContainer) {
                throw new Error('DrawContainer is null');
            }
            
            if (!drawContainer.addChild || typeof drawContainer.addChild !== 'function') {
                throw new Error('DrawContainer addChild method not available');
            }
            
            // EventBus確認
            if (!this.managers.eventbus || typeof this.managers.eventbus.emit !== 'function') {
                console.warn('⚠️ EventBus利用不可 - イベント通知無効');
            }
            
            // v8統合完了
            this.v8Ready = true;
            this.ready = true;
            
            console.log('✅ RecordManager v8統合確認完了');
            
        } catch (error) {
            this.lastError = error;
            console.error('❌ RecordManager v8統合確認エラー:', error);
            
            // 失敗時状態設定
            this.ready = false;
            this.v8Ready = false;
            
            throw error;
        }
    }
    
    /**
     * 📝 ストローク追加（PenTool連携用メインAPI・修正版）
     * 
     * @param {Object} strokeData - ストロークデータ
     * @returns {boolean} 追加成功フラグ
     */
    addStroke(strokeData) {
        console.log('📝 RecordManager.addStroke() 開始:', strokeData?.id);
        
        // 準備状態確認（厳格版）
        if (!this.isReady()) {
            const errorMsg = 'RecordManager not ready - call setManagers() first';
            console.warn(`⚠️ ${errorMsg}`);
            this.notifyError(errorMsg);
            return false;
        }
        
        try {
            // ストロークデータ検証（強化版）
            if (!strokeData) {
                throw new Error('strokeData is required');
            }
            
            if (!strokeData.points || !Array.isArray(strokeData.points)) {
                throw new Error('strokeData.points must be array');
            }
            
            if (strokeData.points.length === 0) {
                console.warn('⚠️ Empty stroke data - ignoring');
                return false;
            }
            
            // 座標データ検証
            for (let i = 0; i < strokeData.points.length; i++) {
                const pt = strokeData.points[i];
                if (typeof pt.x !== 'number' || typeof pt.y !== 'number') {
                    throw new Error(`Invalid point data at index ${i}: x=${pt.x}, y=${pt.y}`);
                }
            }
            
            // TPF形式に変換
            const tpfStroke = this.convertToTPF(strokeData);
            console.log(`🔄 TPF変換完了: ${tpfStroke.id} (${tpfStroke.points.length} points)`);
            
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
                tool: tpfStroke.meta.tool,
                layer: tpfStroke.layer
            });
            
            console.log(`✅ RecordManager.addStroke() 完了: ${tpfStroke.id}`);
            return true;
            
        } catch (error) {
            this.lastError = error;
            console.error('❌ RecordManager.addStroke() エラー:', error);
            this.notifyError(`Stroke記録失敗: ${error.message}`, { strokeData });
            return false;
        }
    }
    
    /**
     * 🔄 ストロークデータをTPF v0.2形式に変換
     * 
     * @param {Object} strokeData - 元ストロークデータ
     * @returns {Object} TPF形式ストローク
     */
    convertToTPF(strokeData) {
        const tpfStroke = {
            id: strokeData.id || 'stroke_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
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
     * 🎨 カラー正規化（16進数文字列に統一）
     * 
     * @param {number|string} color - カラー値
     * @returns {string} 正規化カラー文字列
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
     * 📐 バウンディングボックス計算
     * 
     * @param {Array} points - 座標配列
     * @returns {Object|null} バウンディングボックス
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
     * ↩️ 元に戻す
     * 
     * @returns {boolean} Undo成功フラグ
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
                remainingHistory: this.tpfHistory.length,
                redoAvailable: this.redoStack.length > 0
            });
            
            console.log(`✅ RecordManager Undo完了: ${undoOperation.id}`);
            return true;
            
        } catch (error) {
            this.lastError = error;
            console.error('❌ RecordManager Undoエラー:', error);
            return false;
        }
    }
    
    /**
     * ↪️ やり直し
     * 
     * @returns {boolean} Redo成功フラグ
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
                historyLength: this.tpfHistory.length,
                redoAvailable: this.redoStack.length > 0
            });
            
            console.log(`✅ RecordManager Redo完了: ${redoOperation.id}`);
            return true;
            
        } catch (error) {
            this.lastError = error;
            console.error('❌ RecordManager Redoエラー:', error);
            return false;
        }
    }
    
    /**
     * 📊 履歴サイズ制限
     */
    enforceHistoryLimit() {
        while (this.tpfHistory.length > this.maxHistorySize) {
            const oldOperation = this.tpfHistory.shift();
            console.log('📤 古い履歴削除:', oldOperation.id);
        }
    }
    
    /**
     * 📢 イベント通知
     * 
     * @param {string} eventName - イベント名
     * @param {Object} data - イベントデータ
     */
    notifyEvent(eventName, data) {
        if (this.managers.eventbus?.emit) {
            try {
                this.managers.eventbus.emit(eventName, data);
            } catch (error) {
                console.warn('⚠️ イベント通知失敗:', error);
            }
        }
    }
    
    /**
     * 🚨 エラー通知
     * 
     * @param {string} message - エラーメッセージ
     * @param {Object} context - エラーコンテキスト
     */
    notifyError(message, context = {}) {
        if (this.managers.error?.showError) {
            try {
                this.managers.error.showError(`RecordManager: ${message}`, context);
            } catch (error) {
                console.error('❌ エラー通知失敗:', error);
            }
        } else {
            console.error(`❌ RecordManager: ${message}`, context);
        }
    }
    
    /**
     * ✅ 準備状況確認（修正版）
     * 
     * @returns {boolean} 準備完了状態
     */
    isReady() {
        return this.initialized &&
               this.managersReady && 
               this.ready && 
               this.v8Ready &&
               !!this.managers.canvas &&
               typeof this.managers.canvas.getDrawContainer === 'function';
    }
    
    /**
     * 📋 TPF履歴取得
     * 
     * @returns {Array} TPF履歴のコピー
     */
    getTPFHistory() {
        return [...this.tpfHistory]; // 読み取り専用コピー
    }
    
    /**
     * 📈 履歴統計取得
     * 
     * @returns {Object} 履歴統計情報
     */
    getHistoryStats() {
        return {
            totalOperations: this.operationCount,
            currentHistory: this.tpfHistory.length,
            redoStack: this.redoStack.length,
            maxHistorySize: this.maxHistorySize,
            lastOperation: this.tpfHistory.length > 0 ? this.tpfHistory[this.tpfHistory.length - 1].id : null,
            undoAvailable: this.tpfHistory.length > 0,
            redoAvailable: this.redoStack.length > 0
        };
    }
    
    /**
     * 🧹 全履歴クリア
     * 
     * @returns {boolean} クリア成功フラグ
     */
    clear() {
        console.log('🧹 RecordManager 全クリア開始');
        
        try {
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
            
        } catch (error) {
            this.lastError = error;
            console.error('❌ RecordManager クリアエラー:', error);
            return false;
        }
    }
    
    /**
     * 🧪 デバッグ情報取得
     * 
     * @returns {Object} 詳細デバッグ情報
     */
    getDebugInfo() {
        return {
            className: 'RecordManager',
            version: 'v8-initialization-fixed',
            readiness: {
                initialized: this.initialized,
                managersReady: this.managersReady,
                ready: this.ready,
                v8Ready: this.v8Ready,
                isReady: this.isReady()
            },
            managers: {
                canvas: !!this.managers.canvas,
                canvasV8Ready: this.managers.canvas?.isV8Ready?.() || false,
                eventbus: !!this.managers.eventbus,
                config: !!this.managers.config,
                error: !!this.managers.error
            },
            history: this.getHistoryStats(),
            lastError: this.lastError?.message || null,
            methods: {
                addStroke: typeof this.addStroke === 'function',
                undo: typeof this.undo === 'function',
                redo: typeof this.redo === 'function',
                setManagers: typeof this.setManagers === 'function',
                validateV8Integration: typeof this.validateV8Integration === 'function'
            }
        };
    }
    
    // ========================================
    // 互換性メソッド（Phase1.5統一API）
    // ========================================
    
    /**
     * 🚀 startOperation操作開始（互換性維持）
     * 
     * @param {string} kind - 操作種別
     * @param {Array} seedPoints - 初期座標
     * @returns {Object} 操作オブジェクト
     */
    startOperation(kind, seedPoints = []) {
        console.log(`🚀 RecordManager startOperation: ${kind}`);
        
        if (!this.isReady()) {
            throw new Error('RecordManager not ready - call setManagers() first');
        }
        
        // 現在の操作終了
        if (this.currentOperation) {
            console.log('⚠️ 前の操作を強制終了');
            this.endOperation();
        }
        
        // 新しい操作開始
        this.currentOperation = {
            id: 'op_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            kind: kind,
            points: [...seedPoints],
            startTime: Date.now(),
            endTime: null
        };
        
        console.log(`✅ Operation開始: ${this.currentOperation.id}`);
        return this.currentOperation;
    }
    
    /**
     * 🏁 endOperation操作終了（互換性維持）
     * 
     * @param {Object} meta - メタデータ
     * @returns {Object|null} 完了した操作
     */
    endOperation(meta = {}) {
        if (!this.currentOperation) {
            console.warn('⚠️ 操作未開始 - endOperation無効');
            return null;
        }
        
        console.log(`🏁 RecordManager endOperation: ${this.currentOperation.kind}`);
        
        try {
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
            const saveResult = this.addStroke(strokeData);
            
            const completedOperation = this.currentOperation;
            this.currentOperation = null;
            
            if (saveResult) {
                console.log(`✅ Operation完了: ${completedOperation.id}`);
            } else {
                console.warn(`⚠️ Operation保存失敗: ${completedOperation.id}`);
            }
            
            return completedOperation;
            
        } catch (error) {
            console.error('❌ endOperation エラー:', error);
            this.currentOperation = null;
            return null;
        }
    }
    
    /**
     * 📍 addPoint座標追加（互換性維持）
     * 
     * @param {Object} pt - 座標 {x, y, pressure?, time?}
     * @returns {boolean} 追加成功フラグ
     */
    addPoint(pt) {
        if (!this.currentOperation) {
            console.warn('⚠️ 操作未開始 - addPoint無効');
            return false;
        }
        
        try {
            this.currentOperation.points.push({
                x: pt.x,
                y: pt.y,
                pressure: pt.pressure || 0.5,
                time: Date.now() - this.currentOperation.startTime
            });
            
            return true;
            
        } catch (error) {
            console.error('❌ addPoint エラー:', error);
            return false;
        }
    }
}

// グローバル登録
window.Tegaki.RecordManager = RecordManager;
console.log('🔄 RecordManager v8対応版 Loaded - 初期化修正・Manager注入強化版');