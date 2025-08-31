/**
 * 📄 FILE: tools/abstract-tool.js
 * 📌 RESPONSIBILITY: ツール基底クラス・Manager参照統一・setManagersObject正規化・v8完全対応
 * ChangeLog: 2025-08-31 setManagersObject()正規メソッド確立・setManagers()エイリアス追加・Manager参照キャッシュ問題解決
 *
 * @provides
 *   - AbstractTool（基底クラス）
 *   - setManagersObject(managers): boolean - Manager統一注入（正規メソッド）
 *   - setManagers(managers): boolean - Manager注入（後方互換エイリアス）
 *   - isReady(): boolean - 準備完了判定
 *   - isActive(): boolean - アクティブ判定
 *   - activate(): void - ツール有効化
 *   - deactivate(): void - ツール無効化
 *   - destroy(): void - ツール破棄
 *   - getCanvasManager(): CanvasManager - CanvasManager取得
 *   - getCoordinateManager(): CoordinateManager - CoordinateManager取得
 *   - getRecordManager(): RecordManager - RecordManager取得
 *   - getDrawContainer(): PIXI.Container - 描画コンテナ取得
 *
 * @uses
 *   - CanvasManager（Manager注入時に参照設定）
 *   - CoordinateManager（Manager注入時に参照設定）
 *   - RecordManager（Manager注入時に参照設定）
 *   - NavigationManager（オプション・Manager注入時に参照設定）
 *   - EventBus（オプション・Manager注入時に参照設定）
 *
 * @initflow
 *   1. new ConcreteToolClass() → 2. setManagersObject(managers) → 3. activate() → 4. ポインタイベント処理
 *
 * @forbids
 *   💀 双方向依存禁止
 *   🚫 Manager直接操作禁止（getter経由必須）
 *   🚫 未初期化状態でのManager使用禁止
 *   🚫 Manager参照の直接書き換え禁止
 *   🚫 循環依存・Tool間直接依存禁止
 *
 * @manager-key
 *   継承クラスで個別設定
 *
 * @dependencies-strict
 *   REQUIRED: なし（基底クラス）
 *   OPTIONAL: 全Manager（注入時に設定）
 *   FORBIDDEN: 特定Manager強制依存、循環参照
 *
 * @integration-flow
 *   ToolManager → AbstractTool.setManagersObject() → ConcreteToolClass実装
 *
 * @method-naming-rules
 *   Manager注入系: setManagersObject(), setManagers()
 *   状態管理系: isReady(), isActive(), activate(), deactivate()
 *   Manager取得系: getCanvasManager(), getCoordinateManager(), getRecordManager()
 *   ライフサイクル系: destroy()
 *
 * @error-handling
 *   throw: Manager注入失敗・必須パラメータ不正
 *   false: 状態不正・初期化失敗
 *   null: Manager取得失敗・未注入
 */

class AbstractTool {
    constructor(toolName) {
        console.log(`🎯 AbstractTool 基底クラス作成: ${toolName}`);
        
        // ツール基本情報
        this.name = toolName || 'unknown';
        this.active = false;
        
        // Manager参照（統一管理）
        this.managers = {
            canvas: null,
            coordinate: null,
            record: null,
            navigation: null,
            eventBus: null
        };
        
        // 準備状態管理
        this.managersReady = false;
        
        // 統計・デバッグ情報
        this.stats = {
            activations: 0,
            deactivations: 0,
            errors: 0,
            lastError: null,
            created: Date.now()
        };
    }
    
    // ================================
    // Manager注入（統一API）
    // ================================
    
    /**
     * Manager統一注入（正規メソッド）
     * @param {Object|Map} managers - Manager群
     * @returns {boolean} 注入成功フラグ
     */
    setManagersObject(managers) {
        console.log(`🎯 AbstractTool (${this.name}): Manager統一注入開始`);
        
        try {
            if (!managers) {
                throw new Error('Managers object is null or undefined');
            }
            
            // Map形式の場合は Object に変換
            let managersObj = managers;
            if (managers instanceof Map) {
                managersObj = {};
                for (const [key, value] of managers) {
                    managersObj[key] = value;
                }
            }
            
            // Manager参照設定
            this.setManagerReference('canvas', managersObj.canvasManager);
            this.setManagerReference('coordinate', managersObj.coordinateManager);
            this.setManagerReference('record', managersObj.recordManager);
            
            // オプションManager設定
            this.setManagerReference('navigation', managersObj.navigationManager, false);
            this.setManagerReference('eventBus', managersObj.eventBus, false);
            
            // 準備状態確認
            this.validateManagersReady();
            
            console.log(`✅ AbstractTool (${this.name}): Manager統一注入完了`);
            return true;
            
        } catch (error) {
            this.stats.lastError = error;
            this.stats.errors++;
            console.error(`❌ AbstractTool (${this.name}): Manager注入エラー:`, error);
            return false;
        }
    }
    
    /**
     * Manager注入（後方互換エイリアス）
     * @param {Object|Map} managers - Manager群
     * @returns {boolean} 注入成功フラグ
     */
    setManagers(managers) {
        console.log(`🎯 AbstractTool (${this.name}): setManagers() - エイリアス経由`);
        return this.setManagersObject(managers);
    }
    
    /**
     * Manager参照設定（内部用）
     * @param {string} key - Manager種別キー
     * @param {Object} manager - Managerインスタンス
     * @param {boolean} required - 必須フラグ（デフォルト true）
     */
    setManagerReference(key, manager, required = true) {
        if (manager && typeof manager === 'object') {
            this.managers[key] = manager;
            console.log(`✅ Manager参照設定: ${key}`);
        } else if (required) {
            throw new Error(`Required manager missing or invalid: ${key}`);
        } else {
            console.log(`⚠️ Optional manager not set: ${key}`);
        }
    }
    
    /**
     * Manager準備状態確認
     */
    validateManagersReady() {
        const requiredManagers = ['canvas', 'coordinate', 'record'];
        
        for (const key of requiredManagers) {
            if (!this.managers[key]) {
                throw new Error(`Required manager not ready: ${key}`);
            }
        }
        
        this.managersReady = true;
        console.log(`✅ AbstractTool (${this.name}): 必須Manager準備完了`);
    }
    
    // ================================
    // Manager取得（安全なgetter）
    // ================================
    
    /**
     * CanvasManager取得
     * @returns {CanvasManager|null}
     */
    getCanvasManager() {
        return this.managers.canvas;
    }
    
    /**
     * CoordinateManager取得
     * @returns {CoordinateManager|null}
     */
    getCoordinateManager() {
        return this.managers.coordinate;
    }
    
    /**
     * RecordManager取得
     * @returns {RecordManager|null}
     */
    getRecordManager() {
        return this.managers.record;
    }
    
    /**
     * NavigationManager取得
     * @returns {NavigationManager|null}
     */
    getNavigationManager() {
        return this.managers.navigation;
    }
    
    /**
     * EventBus取得
     * @returns {EventBus|null}
     */
    getEventBus() {
        return this.managers.eventBus;
    }
    
    /**
     * 描画コンテナ取得（便利メソッド）
     * @returns {PIXI.Container|null}
     */
    getDrawContainer() {
        const canvasManager = this.getCanvasManager();
        if (canvasManager && typeof canvasManager.getDrawContainer === 'function') {
            return canvasManager.getDrawContainer();
        }
        return null;
    }
    
    // ================================
    // 状態管理・ライフサイクル
    // ================================
    
    /**
     * 準備完了判定
     * @returns {boolean} 準備完了状態
     */
    isReady() {
        return this.managersReady && 
               !!this.managers.canvas && 
               !!this.managers.coordinate && 
               !!this.managers.record;
    }
    
    /**
     * アクティブ判定
     * @returns {boolean} アクティブ状態
     */
    isActive() {
        return this.active;
    }
    
    /**
     * ツール有効化
     */
    activate() {
        console.log(`🎯 AbstractTool (${this.name}): 有効化`);
        
        if (!this.isReady()) {
            console.warn(`⚠️ AbstractTool (${this.name}): 未準備状態で有効化`);
        }
        
        this.active = true;
        this.stats.activations++;
    }
    
    /**
     * ツール無効化
     */
    deactivate() {
        console.log(`🎯 AbstractTool (${this.name}): 無効化`);
        
        this.active = false;
        this.stats.deactivations++;
    }
    
    /**
     * ツール破棄
     */
    destroy() {
        console.log(`🎯 AbstractTool (${this.name}): 破棄`);
        
        // 無効化
        this.deactivate();
        
        // Manager参照クリア
        this.managers = {
            canvas: null,
            coordinate: null,
            record: null,
            navigation: null,
            eventBus: null
        };
        
        this.managersReady = false;
    }
    
    // ================================
    // 仮想メソッド（継承クラスで実装）
    // ================================
    
    /**
     * ポインタダウン処理（仮想メソッド）
     * @param {PointerEvent} event - ポインタイベント
     */
    onPointerDown(event) {
        // 継承クラスで実装
        console.log(`🎯 AbstractTool (${this.name}): onPointerDown() - 未実装`);
    }
    
    /**
     * ポインタムーブ処理（仮想メソッド）
     * @param {PointerEvent} event - ポインタイベント
     */
    onPointerMove(event) {
        // 継承クラスで実装
        console.log(`🎯 AbstractTool (${this.name}): onPointerMove() - 未実装`);
    }
    
    /**
     * ポインタアップ処理（仮想メソッド）
     * @param {PointerEvent} event - ポインタイベント
     */
    onPointerUp(event) {
        // 継承クラスで実装
        console.log(`🎯 AbstractTool (${this.name}): onPointerUp() - 未実装`);
    }
    
    /**
     * ポインタリーブ処理（仮想メソッド・継続描画修正対応）
     * @param {PointerEvent} event - ポインタイベント
     */
    onPointerLeave(event) {
        // 継承クラスで実装
        console.log(`🎯 AbstractTool (${this.name}): onPointerLeave() - 未実装`);
    }
    
    /**
     * ポインタキャンセル処理（仮想メソッド・継続描画修正対応）
     * @param {PointerEvent} event - ポインタイベント
     */
    onPointerCancel(event) {
        // 継承クラスで実装
        console.log(`🎯 AbstractTool (${this.name}): onPointerCancel() - 未実装`);
    }
    
    /**
     * 強制描画終了（仮想メソッド・継続描画修正対応）
     */
    forceEndDrawing() {
        // 継承クラスで実装
        console.log(`🎯 AbstractTool (${this.name}): forceEndDrawing() - 未実装`);
    }
    
    // ================================
    // デバッグ・診断
    // ================================
    
    /**
     * ツール状態取得
     * @returns {Object} 現在状態
     */
    getState() {
        return {
            toolName: this.name,
            active: this.active,
            managersReady: this.managersReady,
            managers: {
                canvas: !!this.managers.canvas,
                coordinate: !!this.managers.coordinate,
                record: !!this.managers.record,
                navigation: !!this.managers.navigation,
                eventBus: !!this.managers.eventBus
            },
            stats: { ...this.stats },
            ready: this.isReady()
        };
    }
    
    /**
     * デバッグ情報取得
     * @returns {Object} デバッグ情報
     */
    getDebugInfo() {
        return {
            className: 'AbstractTool',
            toolName: this.name,
            version: 'v8-setManagersObject-unified',
            state: this.getState(),
            capabilities: {
                setManagersObject: typeof this.setManagersObject === 'function',
                setManagers: typeof this.setManagers === 'function',
                isReady: typeof this.isReady === 'function',
                isActive: typeof this.isActive === 'function',
                activate: typeof this.activate === 'function',
                deactivate: typeof this.deactivate === 'function',
                destroy: typeof this.destroy === 'function',
                forceEndDrawing: typeof this.forceEndDrawing === 'function'
            },
            managerGetters: {
                getCanvasManager: typeof this.getCanvasManager === 'function',
                getCoordinateManager: typeof this.getCoordinateManager === 'function',
                getRecordManager: typeof this.getRecordManager === 'function',
                getNavigationManager: typeof this.getNavigationManager === 'function',
                getEventBus: typeof this.getEventBus === 'function',
                getDrawContainer: typeof this.getDrawContainer === 'function'
            },
            timestamp: Date.now()
        };
    }
}

// グローバル名前空間に登録
if (!window.Tegaki) window.Tegaki = {};
window.Tegaki.AbstractTool = AbstractTool;

console.log('🎯 AbstractTool Manager参照統一・setManagersObject正規化版 Loaded');
console.log('🚀 特徴: setManagersObject()正規メソッド・setManagers()エイリアス・Manager参照キャッシュ問題解決・v8完全対応');