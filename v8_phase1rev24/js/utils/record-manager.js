/**
 * 🔄 RecordManager - PixiJS v8対応版 記録管理システム（TPF形式・Undo/Redo・v8 Graphics統合版・修正版）
 * 📋 RESPONSIBILITY: TPF記録・Undo/Redo・非破壊編集・v8 Graphics統合・キャンバス外描画対応・Manager連携
 * 🚫 PROHIBITION: 直接描画・座標変換・UI操作・Manager作成・フォールバック・フェイルセーフ・v7 API混在
 * ✅ PERMISSION: TPF記録・履歴管理・非破壊編集・v8 Graphics連携・Manager利用・EventBus通信・v8 Container操作
 * 
 * 📏 DESIGN_PRINCIPLE: TPF中心・非破壊編集・v8 Graphics統合・高性能メモリ管理・Manager統合・EventBus通信
 * 🔄 INTEGRATION: v8 CanvasManager + TPF記録 + v8 Graphics + EventBus + Manager統合連携
 * 🚀 V8_MIGRATION: 完全v8対応・WebGPU最適化・Container階層対応・フォールバック削除・Manager統合強化
 * 
 * @provides
 *   - RecordManager クラス
 *   - startOperation(kind, seedPoints) - 操作開始・外部入力対応・TPF記録
 *   - addPoint(pt) - 座標追加・リアルタイム記録・高精度座標
 *   - endOperation(meta) - 操作終了・TPF確定・v8 Graphics確定
 *   - undo() - 元に戻す・TPF履歴・v8 Graphics再構築
 *   - redo() - やり直し・TPF履歴・v8 Graphics再構築
 *   - rebuild(fromHistory) - 再構築・TPF履歴適用・v8 Graphics再生成
 *   - getTPFHistory() - TPF履歴取得・保存用・デバッグ用
 *   - setManagers(managers) - Manager統合注入・v8対応
 *   - isReady() - 準備状況確認・Manager連携確認・v8対応確認
 *
 * @uses
 *   - this.managers.canvas.getDrawContainer() - v8描画Container取得（CanvasManager）
 *   - new PIXI.Graphics() - v8 Graphics作成（PixiJS v8.12.0）
 *   - graphics.stroke(options) - v8新API描画（PixiJS v8.12.0）
 *   - graphics.moveTo(x, y) - v8座標移動（PixiJS v8.12.0）
 *   - graphics.lineTo(x, y) - v8線描画（PixiJS v8.12.0）
 *   - container.addChild(graphics) - v8 Container追加（PixiJS v8.12.0）
 *   - container.removeChild(graphics) - v8 Container削除（PixiJS v8.12.0）
 *   - this.managers.eventbus.emit(event, data) - イベント通知（EventBus）
 *   - this.managers.config.getRecordSettings() - 設定取得（ConfigManager）
 *
 * @initflow
 *   開始 → Manager注入待機 → setManagers()受信・Manager保存 → 
 *   isReady()確認・Manager連携確認 → TPF履歴初期化 → 
 *   操作待機 → startOperation() → addPoint() → endOperation() → TPF記録・v8 Graphics確定
 *
 * @forbids
 *   💀 双方向依存禁止
 *   🚫 フォールバック禁止
 *   🚫 フェイルセーフ禁止
 *   🚫 v7/v8 両対応による二重管理禁止
 *
 * @manager-key
 *   window.Tegaki.RecordManagerInstance
 *
 * @dependencies-strict
 *   - 必須: CanvasManager.getDrawContainer(), EventBus.emit()
 *   - オプション: ConfigManager.getRecordSettings()
 *   - 禁止: 他RecordManager, UI直接操作, 座標変換
 *
 * @integration-flow
 *   AppCore → RecordManager作成 → setManagers(managers) → Manager統合 → Tool → startOperation() → TPF記録
 *
 * @method-naming-rules
 *   - startOperation()/endOperation() 形式統一
 *   - addPoint() - 座標追加
 *   - undo()/redo() - 履歴操作
 *
 * @error-handling
 *   - Manager未設定時は詳細エラー・操作拒否
 *   - v8 Graphics作成失敗時は詳細ログ・操作継続
 *   - ErrorManager連携でエラー通知
 *
 * @state-management
 *   - 直接プロパティ変更禁止・専用メソッド経由
 *   - TPF履歴は読み取り専用・getTPFHistory()経由
 *   - 操作状態は内部管理・外部から直接変更禁止
 *
 * @performance-notes
 *   - TPF記録は16ms以内目標・リアルタイム描画対応
 *   - v8 Graphics作成は必要最小限・メモリ効率重視
 *   - 大量履歴対応・メモリ使用量最適化
 */

// 多重定義防止
if (!window.Tegaki) {
    window.Tegaki = {};
}

if (!window.Tegaki.RecordManager) {
    /**
     * RecordManager - TPF形式記録・非破壊編集・v8 Graphics統合・Manager統合版
     */
    class RecordManager {
        constructor(appCore = null) {
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
            
            // v8 Graphics管理
            this.v8GraphicsMap = new Map(); // TPF ID → v8 Graphics
            this.activeGraphics = null;     // 現在描画中のGraphics
            
            // v8状態管理
            this.v8Ready = false;
            this.managersReady = false;
            this.drawContainerReady = false;
            
            // 設定・統計
            this.maxHistorySize = 1000;  // 最大履歴数
            this.operationCount = 0;     // 操作カウント
            this.lastError = null;
            
            // AppCore連携（オプション）
            if (appCore) {
                this.appCore = appCore;
            }
            
            console.log('🔄 RecordManager v8対応版 作成開始 - TPF形式・Undo/Redo・v8 Graphics統合版');
            console.log('✅ v8準備完了: setManagersでManager統合後に利用可能');
            console.log('🔄 RecordManager v8対応版 作成完了');
        }
        
        /**
         * Manager統合注入（v8対応・修正版）
         */
        setManagers(managers) {
            console.log('🔧 RecordManager Manager統合注入開始');
            
            try {
                // Manager型確認・統一処理
                let managersObj;
                if (managers instanceof Map) {
                    // Map → Object変換
                    managersObj = Object.fromEntries(managers);
                    console.log('📦 Map形式で受信 - Object変換完了');
                } else if (typeof managers === 'object' && managers !== null) {
                    // Object形式
                    managersObj = managers;
                    console.log('📦 Object形式で受信');
                } else {
                    throw new Error(`Invalid managers type: ${typeof managers}. Expected Map or Object.`);
                }
                
                // 必須Manager確認・注入
                const requiredManagers = ['canvas', 'eventbus'];
                for (const key of requiredManagers) {
                    if (!managersObj[key]) {
                        throw new Error(`Required manager missing: ${key}`);
                    }
                    this.managers[key] = managersObj[key];
                    console.log(`✅ ${key}Manager注入完了`);
                }
                
                // オプションManager注入
                const optionalManagers = ['config', 'error'];
                for (const key of optionalManagers) {
                    if (managersObj[key]) {
                        this.managers[key] = managersObj[key];
                        console.log(`✅ ${key}Manager注入完了`);
                    } else {
                        console.log(`⚠️ ${key}Manager未提供（オプション）`);
                    }
                }
                
                this.managersReady = true;
                this.validateV8Integration();
                
                console.log('✅ RecordManager Manager統合注入完了');
                return true;
                
            } catch (error) {
                this.lastError = error;
                console.error('❌ RecordManager Manager統合注入エラー:', error);
                this.notifyError(`RecordManager Manager注入失敗: ${error.message}`);
                return false;
            }
        }
        
        /**
         * v8統合確認・DrawContainer準備確認
         */
        validateV8Integration() {
            console.log('🔍 RecordManager v8統合確認開始');
            
            try {
                // CanvasManager確認
                if (!this.managers.canvas) {
                    throw new Error('CanvasManager not injected');
                }
                
                // getDrawContainer確認
                if (typeof this.managers.canvas.getDrawContainer !== 'function') {
                    throw new Error('CanvasManager.getDrawContainer() method not available');
                }
                
                // DrawContainer取得・確認
                let drawContainer;
                try {
                    drawContainer = this.managers.canvas.getDrawContainer();
                } catch (error) {
                    throw new Error(`getDrawContainer() execution failed: ${error.message}`);
                }
                
                if (!drawContainer) {
                    throw new Error('getDrawContainer() returned null - DrawContainer not ready');
                }
                
                // Container型確認
                if (typeof drawContainer.addChild !== 'function') {
                    throw new Error('Invalid DrawContainer - missing addChild method');
                }
                
                this.drawContainerReady = true;
                this.v8Ready = true;
                
                console.log('✅ RecordManager v8統合確認完了');
                
                // 準備完了通知
                this.notifyEvent('recordManagerReady', {
                    v8Ready: this.v8Ready,
                    managersReady: this.managersReady,
                    drawContainerReady: this.drawContainerReady
                });
                
            } catch (error) {
                this.lastError = error;
                console.error('❌ RecordManager v8統合確認エラー:', error);
                this.v8Ready = false;
                throw error;
            }
        }
        
        /**
         * 操作開始・外部入力対応・TPF記録（修正版）
         */
        startOperation(kind, seedPoints = []) {
            console.log(`🚀 RecordManager 操作開始: ${kind}`);
            
            try {
                // 準備状況確認
                if (!this.isReady()) {
                    throw new Error('RecordManager not ready - call setManagers() first');
                }
                
                // 現在の操作終了
                if (this.currentOperation) {
                    console.warn('⚠️ 前回操作未終了 - 自動終了実行');
                    this.endOperation();
                }
                
                // TPF操作作成
                this.currentOperation = this.createTPFOperation(kind, seedPoints);
                
                // v8 Graphics作成・初期化
                if (kind === 'stroke') {
                    this.activeGraphics = this.createV8StrokeGraphics();
                    
                    // 初期座標設定（seedPoints対応）
                    if (seedPoints.length > 0) {
                        this.activeGraphics.moveTo(seedPoints[0].x, seedPoints[0].y);
                        
                        // 複数点の場合は線を引く
                        for (let i = 1; i < seedPoints.length; i++) {
                            this.activeGraphics.lineTo(seedPoints[i].x, seedPoints[i].y);
                        }
                    }
                    
                    // DrawContainerに追加
                    const drawContainer = this.managers.canvas.getDrawContainer();
                    drawContainer.addChild(this.activeGraphics);
                    
                    console.log('✅ v8ストローク描画開始');
                }
                
                // 操作開始通知
                this.notifyEvent('operationStarted', {
                    kind: kind,
                    id: this.currentOperation.id,
                    seedPointsCount: seedPoints.length
                });
                
                console.log(`✅ RecordManager 操作開始完了: ${kind}`);
                return this.currentOperation;
                
            } catch (error) {
                this.lastError = error;
                console.error('❌ RecordManager 操作開始エラー:', error);
                this.notifyError(`操作開始失敗: ${error.message}`);
                throw error;
            }
        }
        
        /**
         * 座標追加・リアルタイム記録・高精度座標
         */
        addPoint(pt) {
            if (!this.currentOperation) {
                console.warn('⚠️ 操作未開始 - addPoint無効');
                return false;
            }
            
            try {
                // TPFに座標追加
                this.currentOperation.points.push({
                    x: pt.x,
                    y: pt.y,
                    pressure: pt.pressure || 0.5,
                    time: Date.now() - this.currentOperation.startTime
                });
                
                // v8 Graphics更新（リアルタイム描画）
                if (this.activeGraphics && this.currentOperation.kind === 'stroke') {
                    this.activeGraphics.lineTo(pt.x, pt.y);
                }
                
                return true;
                
            } catch (error) {
                console.error('❌ RecordManager 座標追加エラー:', error);
                return false;
            }
        }
        
        /**
         * 操作終了・TPF確定・v8 Graphics確定
         */
        endOperation(meta = {}) {
            if (!this.currentOperation) {
                console.warn('⚠️ 操作未開始 - endOperation無効');
                return null;
            }
            
            console.log(`🏁 RecordManager 操作終了: ${this.currentOperation.kind}`);
            
            try {
                // TPF確定・メタデータ追加
                this.currentOperation.endTime = Date.now();
                this.currentOperation.bounds = this.calculateBounds(this.currentOperation.points);
                
                // カスタムメタデータ追加
                Object.assign(this.currentOperation.meta, meta);
                
                // v8 Graphics確定
                if (this.activeGraphics) {
                    this.v8GraphicsMap.set(this.currentOperation.id, this.activeGraphics);
                    this.activeGraphics = null;
                }
                
                // TPF履歴追加
                this.tpfHistory.push(this.currentOperation);
                this.operationCount++;
                
                // Redoスタッククリア（新操作により無効化）
                this.redoStack = [];
                
                // 履歴サイズ制限
                this.enforceHistoryLimit();
                
                // 操作終了通知
                this.notifyEvent('operationEnded', {
                    id: this.currentOperation.id,
                    kind: this.currentOperation.kind,
                    pointsCount: this.currentOperation.points.length,
                    bounds: this.currentOperation.bounds
                });
                
                const completedOperation = this.currentOperation;
                this.currentOperation = null;
                
                console.log(`✅ RecordManager 操作終了完了: ${completedOperation.kind}`);
                return completedOperation;
                
            } catch (error) {
                this.lastError = error;
                console.error('❌ RecordManager 操作終了エラー:', error);
                this.notifyError(`操作終了失敗: ${error.message}`);
                this.currentOperation = null;
                return null;
            }
        }
        
        /**
         * 元に戻す・TPF履歴・v8 Graphics再構築
         */
        undo() {
            if (this.tpfHistory.length === 0) {
                console.log('⚠️ Undo: 履歴なし');
                return false;
            }
            
            console.log('🔄 RecordManager Undo実行');
            
            try {
                // 現在の操作強制終了
                if (this.currentOperation) {
                    this.endOperation();
                }
                
                // 最新操作をRedoスタックに移動
                const undoOperation = this.tpfHistory.pop();
                this.redoStack.push(undoOperation);
                
                // v8 Graphics削除
                this.removeV8Graphics(undoOperation.id);
                
                // 画面再構築
                this.rebuild();
                
                // Undo通知
                this.notifyEvent('undoExecuted', {
                    operationId: undoOperation.id,
                    operationKind: undoOperation.kind,
                    remainingHistory: this.tpfHistory.length
                });
                
                console.log('✅ RecordManager Undo完了');
                return true;
                
            } catch (error) {
                this.lastError = error;
                console.error('❌ RecordManager Undoエラー:', error);
                this.notifyError(`Undo失敗: ${error.message}`);
                return false;
            }
        }
        
        /**
         * やり直し・TPF履歴・v8 Graphics再構築
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
                
                // 画面再構築
                this.rebuild();
                
                // Redo通知
                this.notifyEvent('redoExecuted', {
                    operationId: redoOperation.id,
                    operationKind: redoOperation.kind,
                    historyLength: this.tpfHistory.length
                });
                
                console.log('✅ RecordManager Redo完了');
                return true;
                
            } catch (error) {
                this.lastError = error;
                console.error('❌ RecordManager Redoエラー:', error);
                this.notifyError(`Redo失敗: ${error.message}`);
                return false;
            }
        }
        
        /**
         * 再構築・TPF履歴適用・v8 Graphics再生成
         */
        rebuild(fromHistory = null) {
            console.log('🔨 RecordManager 再構築開始');
            
            try {
                if (!this.isReady()) {
                    throw new Error('RecordManager not ready for rebuild');
                }
                
                // DrawContainer取得・全Graphics削除
                const drawContainer = this.managers.canvas.getDrawContainer();
                drawContainer.removeChildren();
                
                // v8 Graphics Map クリア
                this.v8GraphicsMap.clear();
                
                // 使用する履歴決定
                const history = fromHistory || this.tpfHistory;
                
                // TPF履歴を順次適用
                for (const operation of history) {
                    this.applyTPFOperation(operation);
                }
                
                // 再構築通知
                this.notifyEvent('rebuildCompleted', {
                    appliedOperations: history.length,
                    totalGraphics: this.v8GraphicsMap.size
                });
                
                console.log(`✅ RecordManager 再構築完了: ${history.length}操作適用`);
                return true;
                
            } catch (error) {
                this.lastError = error;
                console.error('❌ RecordManager 再構築エラー:', error);
                this.notifyError(`再構築失敗: ${error.message}`);
                return false;
            }
        }
        
        /**
         * TPF操作適用・v8 Graphics生成
         */
        applyTPFOperation(operation) {
            try {
                if (operation.kind === 'stroke') {
                    // v8ストロークGraphics作成
                    const graphics = this.createV8StrokeGraphics(operation);
                    
                    // 座標適用
                    if (operation.points.length > 0) {
                        graphics.moveTo(operation.points[0].x, operation.points[0].y);
                        
                        for (let i = 1; i < operation.points.length; i++) {
                            graphics.lineTo(operation.points[i].x, operation.points[i].y);
                        }
                    }
                    
                    // DrawContainerに追加
                    const drawContainer = this.managers.canvas.getDrawContainer();
                    drawContainer.addChild(graphics);
                    
                    // Graphics Map登録
                    this.v8GraphicsMap.set(operation.id, graphics);
                }
                
            } catch (error) {
                console.error(`❌ TPF操作適用エラー (${operation.id}):`, error);
                throw error;
            }
        }
        
        /**
         * v8ストロークGraphics作成
         */
        createV8StrokeGraphics(operation = null) {
            const graphics = new PIXI.Graphics();
            
            // 描画設定適用
            const color = operation?.color || '#800000';  // ふたばマルーン
            const width = operation?.width || 2;
            const opacity = operation?.opacity || 1.0;
            
            // v8新API使用
            graphics.stroke({
                width: width,
                color: color,
                alpha: opacity,
                cap: 'round',
                join: 'round'
            });
            
            return graphics;
        }
        
        /**
         * v8 Graphics削除
         */
        removeV8Graphics(operationId) {
            const graphics = this.v8GraphicsMap.get(operationId);
            if (graphics) {
                // DrawContainerから削除
                if (graphics.parent) {
                    graphics.parent.removeChild(graphics);
                }
                
                // Graphics破棄
                graphics.destroy();
                
                // Map削除
                this.v8GraphicsMap.delete(operationId);
            }
        }
        
        /**
         * TPF操作作成
         */
        createTPFOperation(kind, seedPoints = []) {
            const operationId = `tpf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            return {
                id: operationId,
                kind: kind,  // 'stroke' | 'erase' | 'transform'
                layer: 'default',  // Phase1.5は単一レイヤー
                color: '#800000',  // ふたばマルーン
                width: 2.0,
                opacity: 1.0,
                points: [...seedPoints.map(pt => ({
                    x: pt.x,
                    y: pt.y,
                    pressure: pt.pressure || 0.5,
                    time: 0
                }))],
                bounds: null,      // endOperationで計算
                startTime: Date.now(),
                endTime: null,
                meta: {
                    tool: kind === 'stroke' ? 'pen' : 'eraser',
                    engine: 'pixi',
                    version: 'v8'
                }
            };
        }
        
        /**
         * バウンディングボックス計算
         */
        calculateBounds(points) {
            if (points.length === 0) return null;
            
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
                w: maxX - minX,
                h: maxY - minY
            };
        }
        
        /**
         * 履歴サイズ制限
         */
        enforceHistoryLimit() {
            while (this.tpfHistory.length > this.maxHistorySize) {
                const oldOperation = this.tpfHistory.shift();
                this.removeV8Graphics(oldOperation.id);
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
         * 準備状況確認・Manager連携確認・v8対応確認
         */
        isReady() {
            return this.v8Ready && 
                   this.managersReady && 
                   this.drawContainerReady &&
                   !!this.managers.canvas &&
                   typeof this.managers.canvas.getDrawContainer === 'function' &&
                   !!this.managers.eventbus;
        }
        
        /**
         * TPF履歴取得・保存用・デバッグ用
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
                graphicsCount: this.v8GraphicsMap.size,
                memoryUsage: this.estimateMemoryUsage()
            };
        }
        
        /**
         * メモリ使用量推定
         */
        estimateMemoryUsage() {
            let totalPoints = 0;
            for (const operation of this.tpfHistory) {
                totalPoints += operation.points.length;
            }
            
            return {
                totalPoints: totalPoints,
                estimatedBytes: totalPoints * 32, // 座標・メタデータ推定
                graphicsObjects: this.v8GraphicsMap.size
            };
        }
        
        /**
         * デバッグ情報取得
         */
        getDebugInfo() {
            return {
                // 基本状態
                ready: this.isReady(),
                v8Ready: this.v8Ready,
                managersReady: this.managersReady,
                drawContainerReady: this.drawContainerReady,
                
                // Manager連携状況
                managers: {
                    canvas: !!this.managers.canvas,
                    eventbus: !!this.managers.eventbus,
                    config: !!this.managers.config,
                    error: !!this.managers.error,
                    getDrawContainer: this.managers.canvas && typeof this.managers.canvas.getDrawContainer === 'function'
                },
                
                // 履歴状況
                history: this.getHistoryStats(),
                
                // 現在の操作
                currentOperation: this.currentOperation ? {
                    id: this.currentOperation.id,
                    kind: this.currentOperation.kind,
                    pointsCount: this.currentOperation.points.length
                } : null,
                
                // エラー状況
                lastError: this.lastError?.message || null,
                
                // v8 Graphics状況
                v8Graphics: {
                    activeGraphics: !!this.activeGraphics,
                    graphicsMapSize: this.v8GraphicsMap.size,
                    memoryUsage: this.estimateMemoryUsage()
                }
            };
        }
        
        /**
         * 全クリア・リセット
         */
        clear() {
            console.log('🧹 RecordManager 全クリア開始');
            
            try {
                // 現在の操作終了
                if (this.currentOperation) {
                    this.currentOperation = null;
                }
                
                // v8 Graphics全削除
                if (this.isReady()) {
                    const drawContainer = this.managers.canvas.getDrawContainer();
                    drawContainer.removeChildren();
                }
                
                // Graphics Map クリア
                for (const graphics of this.v8GraphicsMap.values()) {
                    graphics.destroy();
                }
                this.v8GraphicsMap.clear();
                
                // 履歴クリア
                this.tpfHistory = [];
                this.redoStack = [];
                this.activeGraphics = null;
                
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
                console.error('❌ RecordManager 全クリアエラー:', error);
                this.notifyError(`全クリア失敗: ${error.message}`);
                return false;
            }
        }
        
        /**
         * 設定更新
         */
        updateSettings(settings = {}) {
            if (settings.maxHistorySize && settings.maxHistorySize > 0) {
                this.maxHistorySize = settings.maxHistorySize;
                this.enforceHistoryLimit(); // 即座に適用
            }
            
            console.log('✅ RecordManager 設定更新:', settings);
        }
        
        /**
         * TPF保存データ取得
         */
        getTPFSaveData() {
            return {
                version: '0.2',
                created: new Date().toISOString(),
                operations: this.getTPFHistory(),
                meta: {
                    totalOperations: this.operationCount,
                    engine: 'pixi-v8',
                    tegakiVersion: 'Phase1.5'
                }
            };
        }
        
        /**
         * TPF読み込み・履歴復元
         */
        loadTPFData(tpfData) {
            console.log('📂 RecordManager TPF読み込み開始');
            
            try {
                // データ検証
                if (!tpfData || !tpfData.operations || !Array.isArray(tpfData.operations)) {
                    throw new Error('Invalid TPF data format');
                }
                
                // 現在の状態クリア
                this.clear();
                
                // TPF履歴復元
                this.tpfHistory = [...tpfData.operations];
                
                // メタデータ復元
                if (tpfData.meta?.totalOperations) {
                    this.operationCount = tpfData.meta.totalOperations;
                }
                
                // 画面再構築
                this.rebuild();
                
                // 読み込み通知
                this.notifyEvent('tpfDataLoaded', {
                    version: tpfData.version,
                    operationsCount: this.tpfHistory.length,
                    created: tpfData.created
                });
                
                console.log('✅ RecordManager TPF読み込み完了:', this.tpfHistory.length, '操作');
                return true;
                
            } catch (error) {
                this.lastError = error;
                console.error('❌ RecordManager TPF読み込みエラー:', error);
                this.notifyError(`TPF読み込み失敗: ${error.message}`);
                return false;
            }
        }
    }
    
    // Tegaki名前空間に登録
    window.Tegaki.RecordManager = RecordManager;
    
    console.log('🔄 RecordManager v8対応版 Loaded - TPF形式・非破壊編集・v8 Graphics・Undo/Redo完全対応完了');
} else {
    console.log('⚠️ RecordManager already defined - skipping redefinition');
}

console.log('🔄 RecordManager v8対応版 Loaded - TPF形式・非破壊編集・v8 Graphics・Undo/Redo完全対応完了');