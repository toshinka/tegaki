/**
 * 📄 FILE: tools/abstract-tool.js
 * 📌 RESPONSIBILITY: Tool基盤クラス・Manager注入API統一・v8完全対応・参照問題修正版
 *
 * @provides
 *   - AbstractTool（基盤クラス）
 *   - setManagersObject(managers): boolean - 正規Manager注入メソッド
 *   - setManagers(managers): boolean - 後方互換エイリアス
 *   - activate(): Promise<void> - Tool有効化
 *   - deactivate(): Promise<void> - Tool無効化
 *   - isActive(): boolean - アクティブ状態確認
 *   - isReady(): boolean - 準備状態確認
 *   - getDebugInfo(): Object - デバッグ情報取得
 *
 * @uses
 *   - CanvasManager.getDrawContainer(): PIXI.Container
 *   - CanvasManager.isV8Ready(): boolean
 *   - CoordinateManager.toCanvasCoords(clientX, clientY): {x, y}
 *   - RecordManager.startOperation(kind, seedPoints): Object
 *   - EventBus.emit(eventName, data): void
 *
 * @initflow
 *   1. constructor(name) → 2. setManagersObject(managers) → 3. activate() → 4. Tool利用可能
 *
 * @forbids
 *   💀 双方向依存禁止
 *   🚫 直接Manager操作禁止
 *   🚫 未注入状態でのManager利用禁止
 *   🚫 v7/v8二重管理禁止
 *   🚫 未実装メソッド呼び出し禁止
 *   🚫 Manager参照キャッシュ無効状態許可禁止
 *
 * @manager-key
 *   継承クラス毎に個別キー（例: window.Tegaki.PenToolInstance）
 *
 * @dependencies-strict
 *   REQUIRED: CanvasManager（v8Ready）
 *   OPTIONAL: CoordinateManager, RecordManager, EventBus
 *   FORBIDDEN: 他Tool直接参照, 循環依存
 *
 * @integration-flow
 *   ToolManager → AbstractTool.setManagersObject() → Tool.activate() → 描画処理
 *
 * @method-naming-rules
 *   注入系: setManagersObject(), setManagers()
 *   状態系: activate(), deactivate(), isActive(), isReady()
 *   操作系: onPointerDown(), onPointerMove(), onPointerUp()
 *   取得系: getDrawContainer(), getDebugInfo()
 *
 * @error-handling
 *   throw: 必須Manager未注入, 重大な状態エラー
 *   false: 操作失敗, 準備未完了
 *   warn: オプション機能失敗, 一時的エラー
 *
 * @state-management
 *   - Manager参照は専用キャッシュ経由のみアクセス
 *   - 状態変更は必ずメソッド経由
 *   - アクティブ状態とManager準備状態を分離管理
 *
 * @performance-notes
 *   Manager参照キャッシュで高頻度アクセス最適化
 *   描画操作での不要なManager検証回避
 */

(function() {
    'use strict';

    /**
     * AbstractTool - Tool基盤クラス・Manager参照問題修正版
     * Manager注入API統一・参照キャッシュ問題解決・v8完全対応
     */
    class AbstractTool {
        constructor(toolName) {
            console.log(`🎯 AbstractTool 作成開始: ${toolName}`);
            
            // Tool基本情報
            this.name = toolName;
            this.active = false;
            this.ready = false;
            
            // Manager統合（Map形式・参照問題修正）
            this.managers = new Map();
            this.managerCache = new Map(); // 高速アクセス用キャッシュ
            this.managersReady = false;
            
            // 状態管理
            this.lastActivation = 0;
            this.lastError = null;
            
            console.log(`✅ ${toolName} AbstractTool 作成完了`);
        }
        
        // ========================================
        // Manager注入・統一API（修正版）
        // ========================================
        
        /**
         * Manager統一注入（正規メソッド・参照問題修正版）
         * 
         * @param {Object|Map} managers - Manager群
         * @returns {boolean} 注入成功フラグ
         */
        setManagersObject(managers) {
            console.log(`🔧 ${this.name} Manager統一注入開始（正規メソッド）`);
            
            try {
                // Manager型確認・統一処理
                if (managers instanceof Map) {
                    console.log(`📦 ${this.name} 受信Manager型: Map（直接使用）`);
                    this.managers = new Map(managers);
                } else if (typeof managers === 'object' && managers !== null) {
                    console.log(`📦 ${this.name} 受信Manager型: Object（直接使用）`);
                    // Objectの場合は直接プロパティアクセスも可能にする
                    this.managers = new Map(Object.entries(managers));
                    this.managersObject = managers; // Object形式も保持（後方互換性）
                } else {
                    throw new Error(`Invalid managers type: ${typeof managers} - Map or Object required`);
                }
                
                console.log(`✅ ${this.name}: Manager群をMap形式で保存完了`);
                console.log(`📋 ${this.name} 利用可能Manager キー:`, Array.from(this.managers.keys()));
                console.log(`📋 ${this.name} 利用可能Manager数: ${this.managers.size}`);
                
                // Manager詳細確認ログ
                for (const [key, manager] of this.managers.entries()) {
                    const type = manager ? manager.constructor.name : 'null';
                    console.log(`📦 ${this.name} Manager[${key}]: ${type}`);
                }
                
                // 必須Manager確認（厳格版）
                const requiredManagers = ['canvas', 'coordinate', 'record'];
                for (const key of requiredManagers) {
                    const exists = this.managers.has(key);
                    const hasValue = exists ? !!this.managers.get(key) : false;
                    console.log(`🔍 ${this.name} 必須Manager[${key}]: exists=${exists}, hasValue=${hasValue}`);
                    
                    if (!exists || !hasValue) {
                        throw new Error(`Required manager missing: ${key}`);
                    }
                }
                
                // Manager参照キャッシュ作成（高速アクセス用・参照問題修正）
                console.log(`📦 ${this.name}: Manager参照キャッシュ作成開始`);
                this.updateManagerCache();
                console.log(`✅ ${this.name}: Manager参照キャッシュ作成完了`);
                
                // 必須Manager再確認
                const missingManagers = requiredManagers.filter(key => !this.managerCache.has(key));
                console.log(`✅ ${this.name}: 必須Manager確認完了:`, requiredManagers.filter(key => this.managerCache.has(key)));
                
                if (missingManagers.length > 0) {
                    throw new Error(`Manager cache creation failed: ${missingManagers.join(', ')}`);
                }
                
                // 注入完了フラグ
                this.managersReady = true;
                this.ready = this.validateManagersReady();
                
                console.log(`✅ ${this.name}: Manager統一注入完了（正規メソッド）`);
                return true;
                
            } catch (error) {
                this.lastError = error;
                console.error(`❌ ${this.name} Manager統一注入エラー:`, error);
                
                // 失敗時状態リセット
                this.managersReady = false;
                this.ready = false;
                this.managerCache.clear();
                
                return false;
            }
        }
        
        /**
         * Manager参照キャッシュ更新（参照問題修正の核心）
         */
        updateManagerCache() {
            try {
                // 必須Manager高速参照キャッシュ
                const cacheTargets = ['canvas', 'coordinate', 'record', 'eventbus', 'config'];
                
                for (const key of cacheTargets) {
                    if (this.managers.has(key)) {
                        const manager = this.managers.get(key);
                        if (manager) {
                            this.managerCache.set(key, manager);
                            console.log(`✅ ${this.name}: ${key}Manager キャッシュ完了`);
                        }
                    }
                }
                
                // 特別な参照（よく使用される）
                const canvasManager = this.managerCache.get('canvas');
                if (canvasManager && typeof canvasManager.getDrawContainer === 'function') {
                    // DrawContainer取得テスト（参照確認）
                    try {
                        const container = canvasManager.getDrawContainer();
                        if (container) {
                            this.managerCache.set('drawContainer', container);
                        }
                    } catch (error) {
                        console.warn(`⚠️ ${this.name}: DrawContainer取得テスト失敗:`, error.message);
                    }
                }
                
            } catch (error) {
                console.error(`❌ ${this.name}: Manager参照キャッシュ更新エラー:`, error);
                throw error;
            }
        }
        
        /**
         * Manager準備状態確認（詳細版）
         * 
         * @returns {boolean} 準備完了状態
         */
        validateManagersReady() {
            try {
                // 基本確認
                if (!this.managersReady) {
                    return false;
                }
                
                // CanvasManager v8準備確認
                const canvasManager = this.managerCache.get('canvas');
                if (!canvasManager) {
                    console.warn(`⚠️ ${this.name}: CanvasManager not in cache`);
                    return false;
                }
                
                if (typeof canvasManager.isV8Ready === 'function' && !canvasManager.isV8Ready()) {
                    console.warn(`⚠️ ${this.name}: CanvasManager v8 not ready`);
                    return false;
                }
                
                // DrawContainer確認
                if (typeof canvasManager.getDrawContainer !== 'function') {
                    console.warn(`⚠️ ${this.name}: CanvasManager.getDrawContainer not available`);
                    return false;
                }
                
                return true;
                
            } catch (error) {
                console.warn(`⚠️ ${this.name}: Manager準備状態確認エラー:`, error.message);
                return false;
            }
        }
        
        /**
         * Manager統一注入（後方互換エイリアス）
         * 
         * @param {Object|Map} managers - Manager群
         * @returns {boolean} 注入成功フラグ
         */
        setManagers(managers) {
            console.log(`🔄 ${this.name}: Manager統一注入（エイリアス経由）`);
            return this.setManagersObject(managers);
        }
        
        // ========================================
        // Tool状態管理・アクティブ化（修正版）
        // ========================================
        
        /**
         * Tool有効化（Manager参照問題修正版）
         * 
         * @returns {Promise<void>}
         */
        async activate() {
            console.log(`🎯 ${this.name} Tool アクティブ化開始`);
            
            try {
                // 準備状態確認（厳格版）
                if (!this.managersReady) {
                    throw new Error('Managers not ready - call setManagersObject() first');
                }
                
                // Manager参照キャッシュ再確認
                const canvasManager = this.managerCache.get('canvas');
                if (!canvasManager) {
                    throw new Error('CanvasManager not in cache');
                }
                
                // CanvasManager v8準備確認（修正版）
                if (typeof canvasManager.isV8Ready === 'function' && !canvasManager.isV8Ready()) {
                    throw new Error('CanvasManager が未準備です');
                }
                
                // DrawContainer取得・確認（参照問題修正）
                let drawContainer;
                try {
                    drawContainer = canvasManager.getDrawContainer();
                    console.log(`📦 ${this.name}: DrawContainer取得完了`);
                } catch (error) {
                    throw new Error(`DrawContainer取得失敗: ${error.message}`);
                }
                
                if (!drawContainer) {
                    throw new Error('DrawContainer is null');
                }
                
                // アクティブ化完了
                this.active = true;
                this.lastActivation = Date.now();
                
                console.log(`✅ ${this.name} Tool アクティブ化完了`);
                
            } catch (error) {
                this.lastError = error;
                console.error(`💀 ${this.name} Tool アクティブ化エラー: ${error.message}`);
                throw error;
            }
        }
        
        /**
         * Tool無効化
         */
        async deactivate() {
            console.log(`🔄 ${this.name} Tool 無効化開始`);
            
            try {
                // 無効化処理
                this.active = false;
                
                // 継承クラス用フック
                if (typeof this.onDeactivate === 'function') {
                    await this.onDeactivate();
                }
                
                console.log(`✅ ${this.name} Tool 無効化完了`);
                
            } catch (error) {
                this.lastError = error;
                console.error(`❌ ${this.name} Tool 無効化エラー:`, error);
                throw error;
            }
        }
        
        /**
         * アクティブ状態確認
         * 
         * @returns {boolean} アクティブ状態
         */
        isActive() {
            return this.active && this.managersReady;
        }
        
        /**
         * 準備完了確認
         * 
         * @returns {boolean} 準備完了状態
         */
        isReady() {
            return this.ready && this.managersReady && this.managerCache.size > 0;
        }
        
        // ========================================
        // 高速Manager参照メソッド（参照問題修正版）
        // ========================================
        
        /**
         * DrawContainer取得（高速版・参照問題修正）
         * 
         * @returns {PIXI.Container|null} DrawContainer
         */
        getDrawContainer() {
            try {
                // キャッシュ優先
                if (this.managerCache.has('drawContainer')) {
                    return this.managerCache.get('drawContainer');
                }
                
                // CanvasManager経由取得
                const canvasManager = this.managerCache.get('canvas');
                if (canvasManager && typeof canvasManager.getDrawContainer === 'function') {
                    const container = canvasManager.getDrawContainer();
                    if (container) {
                        // キャッシュ更新
                        this.managerCache.set('drawContainer', container);
                    }
                    return container;
                }
                
                return null;
                
            } catch (error) {
                console.warn(`⚠️ ${this.name}: DrawContainer取得失敗:`, error.message);
                return null;
            }
        }
        
        /**
         * CoordinateManager取得（高速版）
         * 
         * @returns {CoordinateManager|null}
         */
        getCoordinateManager() {
            return this.managerCache.get('coordinate') || null;
        }
        
        /**
         * RecordManager取得（高速版）
         * 
         * @returns {RecordManager|null}
         */
        getRecordManager() {
            return this.managerCache.get('record') || null;
        }
        
        /**
         * EventBus取得（高速版）
         * 
         * @returns {EventBus|null}
         */
        getEventBus() {
            return this.managerCache.get('eventbus') || null;
        }
        
        // ========================================
        // イベント処理基盤（継承クラス用）
        // ========================================
        
        /**
         * ポインタダウン処理（継承クラスでオーバーライド）
         * 
         * @param {PointerEvent} event - ポインタイベント
         */
        onPointerDown(event) {
            // 基底クラスでは何もしない
        }
        
        /**
         * ポインタムーブ処理（継承クラスでオーバーライド）
         * 
         * @param {PointerEvent} event - ポインタイベント
         */
        onPointerMove(event) {
            // 基底クラスでは何もしない
        }
        
        /**
         * ポインタアップ処理（継承クラスでオーバーライド）
         * 
         * @param {PointerEvent} event - ポインタイベント
         */
        onPointerUp(event) {
            // 基底クラスでは何もしない
        }
        
        // ========================================
        // デバッグ・診断機能
        // ========================================
        
        /**
         * デバッグ情報取得
         * 
         * @returns {Object} 詳細デバッグ情報
         */
        getDebugInfo() {
            const canvasManager = this.managerCache.get('canvas');
            
            return {
                className: 'AbstractTool',
                version: 'v8-manager-reference-fix',
                toolName: this.name,
                state: {
                    active: this.active,
                    ready: this.ready,
                    managersReady: this.managersReady,
                    isReady: this.isReady(),
                    lastActivation: this.lastActivation
                },
                managers: {
                    totalCount: this.managers.size,
                    cacheCount: this.managerCache.size,
                    canvas: this.managerCache.has('canvas'),
                    canvasV8Ready: canvasManager?.isV8Ready?.() || false,
                    coordinate: this.managerCache.has('coordinate'),
                    record: this.managerCache.has('record'),
                    eventbus: this.managerCache.has('eventbus'),
                    config: this.managerCache.has('config'),
                    drawContainer: this.managerCache.has('drawContainer')
                },
                lastError: this.lastError?.message || null,
                methods: {
                    setManagersObject: typeof this.setManagersObject === 'function',
                    setManagers: typeof this.setManagers === 'function',
                    activate: typeof this.activate === 'function',
                    deactivate: typeof this.deactivate === 'function',
                    getDrawContainer: typeof this.getDrawContainer === 'function'
                }
            };
        }
    }

    // グローバル登録
    if (!window.Tegaki) {
        window.Tegaki = {};
    }
    window.Tegaki.AbstractTool = AbstractTool;

    console.log('🎯 AbstractTool Manager参照問題修正版 Loaded - Manager注入API統一・参照キャッシュ問題解決・v8完全対応');

})();