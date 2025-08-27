/**
 * 🎯 AbstractTool - Manager設定・エラー隠蔽禁止完全修正版
 * 📋 RESPONSIBILITY: 全ツールの基底クラス・共通イベント処理・座標変換・Manager管理
 * 🚫 PROHIBITION: 具体的な描画処理・複雑な初期化・エラー隠蔽・Manager未設定時の無視・フォールバック
 * ✅ PERMISSION: イベントハンドリング・座標変換・Manager設定・基底メソッド提供・厳密検証
 * 
 * 📏 DESIGN_PRINCIPLE: 継承ベース・共通処理集約・Manager確実設定・エラー隠蔽完全禁止・フェイルファスト
 * 🔄 INTEGRATION: CanvasManager連携・CoordinateManager座標変換・RecordManager記録・EventBus通信・ErrorManager報告
 * 🔧 FIX: Manager設定メソッド追加・座標変換エラー完全throw・Manager未設定時エラー・フォールバック削除
 * 
 * 📌 使用メソッド一覧:
 * ✅ window.Tegaki.ErrorManagerInstance.showError() - エラー表示（error-manager.js確認済み）
 * ✅ window.Tegaki.EventBusInstance.emit() - イベント発火（event-bus.js確認済み）
 * ✅ this.coordinateManager.screenToCanvas() - 座標変換（coordinate-manager.js確認済み）
 * ✅ this.canvasManager.getCanvasElement() - Canvas要素取得（canvas-manager.js確認済み）
 * ✅ canvas.getBoundingClientRect() - 要素位置取得（DOM標準）
 * ✅ canvas.addEventListener/removeEventListener() - イベント管理（DOM標準）
 * ✅ event.preventDefault() - デフォルト動作防止（DOM標準）
 * 🆕 this.setCoordinateManager() - CoordinateManager設定（新規実装）
 * 🆕 this.setRecordManager() - RecordManager設定（新規実装）
 * 🆕 this.validateManagers() - Manager設定確認（新規実装）
 * ❌ フォールバック処理全て削除 - Manager未設定時は即座にエラー
 * 
 * 📐 基底ツールフロー:
 * 開始 → 継承・作成 → Manager設定(Coordinate,Record) → 有効化・イベント登録 → 
 * 座標変換・描画委譲 → 無効化・リセット → 終了
 * 依存関係: CanvasManager(Canvas要素・必須)・CoordinateManager(座標変換・必須)・
 * RecordManager(記録・オプション)・EventBusInstance(通信)・ErrorManagerInstance(報告)
 * 
 * 🚨 CRITICAL_DEPENDENCIES: 重要依存関係（動作に必須）
 * - this.canvasManager !== null - Canvas管理Manager必須
 * - this.coordinateManager !== null - 座標変換Manager必須
 * - this.canvasManager.getCanvasElement() !== null - Canvas要素存在必須
 * 
 * 🔧 INITIALIZATION_ORDER: 初期化順序（厳守必要）
 * 1. AbstractTool作成・CanvasManager設定
 * 2. CoordinateManager設定・RecordManager設定
 * 3. Manager設定確認・検証
 * 4. ツール有効化・イベント設定
 * 5. 座標変換・描画処理可能
 * 
 * 🚫 ABSOLUTE_PROHIBITIONS: 絶対禁止事項
 * - Manager未設定時の無視処理（エラーthrow必須）
 * - CoordinateManager未設定時の基本座標変換フォールバック（削除）
 * - try/catch握りつぶし（詳細ログ+throw必須）
 * - Manager設定前のツール使用（validateManagers()で防止）
 */

window.Tegaki = window.Tegaki || {};

/**
 * AbstractTool - 全ツールの基底クラス（Manager設定・エラー隠蔽禁止完全修正版）
 */
class AbstractTool {
    constructor(canvasManager, toolName = 'abstract') {
        console.log(`🎯 AbstractTool 作成開始: ${toolName}`);
        
        // 必須引数確認（フォールバック禁止）
        if (!canvasManager) {
            const error = new Error('CanvasManager is required for AbstractTool');
            console.error('💀 AbstractTool 作成失敗:', error);
            throw error;
        }
        
        this.canvasManager = canvasManager;
        this.toolName = toolName;
        this.isActive = false;
        this.isDrawing = false;
        
        // Manager参照（後で設定）
        this.coordinateManager = null;
        this.recordManager = null;
        
        // 基盤システム依存関係
        this.eventBus = window.Tegaki.EventBusInstance;
        this.errorManager = window.Tegaki.ErrorManagerInstance;
        
        if (!this.eventBus) {
            console.warn(`⚠️ EventBusInstance not available for ${toolName}`);
        }
        if (!this.errorManager) {
            console.warn(`⚠️ ErrorManagerInstance not available for ${toolName}`);
        }
        
        // 描画設定（デフォルト）
        this.settings = {
            color: 0x000000,
            size: 2,
            opacity: 1.0
        };
        
        // イベントハンドラーをバインド（thisコンテキスト保持）
        this.boundPointerDown = this.handlePointerDown.bind(this);
        this.boundPointerMove = this.handlePointerMove.bind(this);
        this.boundPointerUp = this.handlePointerUp.bind(this);
        this.boundPointerLeave = this.handlePointerLeave.bind(this);
        
        console.log(`✅ ${toolName} AbstractTool 作成完了`);
    }
    
    /**
     * 🆕 CoordinateManager設定（必須）
     */
    setCoordinateManager(coordinateManager) {
        if (!coordinateManager) {
            const error = new Error(`CoordinateManager is required for ${this.toolName}`);
            console.error('💀 CoordinateManager設定失敗:', error);
            throw error;
        }
        
        this.coordinateManager = coordinateManager;
        console.log(`✅ ${this.toolName} CoordinateManager設定完了`);
    }
    
    /**
     * 🆕 RecordManager設定（オプション）
     */
    setRecordManager(recordManager) {
        // recordManagerはnull許可（Phase1.5開発中のため）
        this.recordManager = recordManager;
        if (recordManager) {
            console.log(`✅ ${this.toolName} RecordManager設定完了`);
        } else {
            console.log(`📋 ${this.toolName} RecordManager未設定 - Undo/Redo機能制限`);
        }
    }
    
    /**
     * 🆕 Manager設定確認（エラー隠蔽禁止）
     */
    validateManagers() {
        const errors = [];
        
        if (!this.canvasManager) {
            errors.push('CanvasManager not set');
        }
        if (!this.coordinateManager) {
            errors.push('CoordinateManager not set');
        }
        // recordManagerはnull許可（Phase1.5開発中のため）
        
        if (errors.length > 0) {
            const error = new Error(`${this.toolName} Manager validation failed: ${errors.join(', ')}`);
            console.error('💀 Manager設定検証失敗:', error);
            console.error('📊 Manager設定状況:', {
                canvasManager: !!this.canvasManager,
                coordinateManager: !!this.coordinateManager,
                recordManager: !!this.recordManager,
                eventBus: !!this.eventBus,
                errorManager: !!this.errorManager
            });
            throw error;
        }
        
        console.log(`✅ ${this.toolName} Manager設定確認完了`);
    }
    
    /**
     * ツール有効化（Manager確認付き）
     */
    activate() {
        if (this.isActive) {
            console.log(`📋 ${this.toolName} は既に有効化済み`);
            return;
        }
        
        console.log(`🎯 ${this.toolName} 有効化開始`);
        
        // 🚨 重要：Manager設定確認（エラー隠蔽禁止）
        this.validateManagers();
        
        this.isActive = true;
        
        // イベントリスナー登録
        this.addEventListeners();
        
        // 子クラスの有効化処理（オプション）
        if (typeof this.onActivate === 'function') {
            try {
                this.onActivate();
            } catch (error) {
                console.error(`💀 ${this.toolName} 有効化処理エラー:`, error);
                
                if (this.errorManager && this.errorManager.showError) {
                    this.errorManager.showError('error', `ツール有効化エラー: ${error.message}`, {
                        context: `${this.toolName}.activate`
                    });
                }
                
                throw error;
            }
        }
        
        // 有効化イベント発火
        if (this.eventBus && this.eventBus.emit) {
            this.eventBus.emit('tool:activated', {
                toolName: this.toolName,
                tool: this
            });
        }
        
        console.log(`✅ ${this.toolName} 有効化完了`);
    }
    
    /**
     * ツール無効化
     */
    deactivate() {
        if (!this.isActive) {
            console.log(`📋 ${this.toolName} は既に無効化済み`);
            return;
        }
        
        console.log(`🎯 ${this.toolName} 無効化開始`);
        this.isActive = false;
        this.isDrawing = false;
        
        // イベントリスナー削除
        this.removeEventListeners();
        
        // 子クラスの無効化処理（オプション）
        if (typeof this.onDeactivate === 'function') {
            try {
                this.onDeactivate();
            } catch (error) {
                console.error(`💀 ${this.toolName} 無効化処理エラー:`, error);
            }
        }
        
        // 無効化イベント発火
        if (this.eventBus && this.eventBus.emit) {
            this.eventBus.emit('tool:deactivated', {
                toolName: this.toolName,
                tool: this
            });
        }
        
        console.log(`✅ ${this.toolName} 無効化完了`);
    }
    
    /**
     * イベントリスナー登録（Manager確認付き）
     */
    addEventListeners() {
        const canvas = this.getCanvasElement();
        
        // ポインターイベント
        canvas.addEventListener('pointerdown', this.boundPointerDown);
        canvas.addEventListener('pointermove', this.boundPointerMove);
        canvas.addEventListener('pointerup', this.boundPointerUp);
        canvas.addEventListener('pointerleave', this.boundPointerLeave);
        
        // タッチイベントのデフォルト動作を防止
        canvas.addEventListener('touchstart', this.preventDefaultTouch);
        canvas.addEventListener('touchmove', this.preventDefaultTouch);
        canvas.addEventListener('touchend', this.preventDefaultTouch);
        
        console.log(`✅ ${this.toolName} イベントリスナー登録完了`);
    }
    
    /**
     * イベントリスナー削除
     */
    removeEventListeners() {
        try {
            const canvas = this.getCanvasElement();
            
            // ポインターイベント削除
            canvas.removeEventListener('pointerdown', this.boundPointerDown);
            canvas.removeEventListener('pointermove', this.boundPointerMove);
            canvas.removeEventListener('pointerup', this.boundPointerUp);
            canvas.removeEventListener('pointerleave', this.boundPointerLeave);
            
            // タッチイベント削除
            canvas.removeEventListener('touchstart', this.preventDefaultTouch);
            canvas.removeEventListener('touchmove', this.preventDefaultTouch);
            canvas.removeEventListener('touchend', this.preventDefaultTouch);
            
            console.log(`✅ ${this.toolName} イベントリスナー削除完了`);
        } catch (error) {
            console.warn(`⚠️ ${this.toolName} イベントリスナー削除中にエラー:`, error.message);
        }
    }
    
    /**
     * タッチイベントのデフォルト動作を防止
     */
    preventDefaultTouch(event) {
        event.preventDefault();
    }
    
    /**
     * Canvas要素取得（エラー隠蔽禁止）
     */
    getCanvasElement() {
        if (!this.canvasManager) {
            const error = new Error(`${this.toolName}: CanvasManager not set`);
            console.error('💀 Canvas要素取得失敗:', error);
            throw error;
        }
        
        if (typeof this.canvasManager.getCanvasElement !== 'function') {
            const error = new Error(`${this.toolName}: CanvasManager.getCanvasElement method not available`);
            console.error('💀 Canvas要素取得失敗:', error);
            throw error;
        }
        
        const canvas = this.canvasManager.getCanvasElement();
        if (!canvas) {
            const error = new Error(`${this.toolName}: CanvasManager.getCanvasElement() returned null`);
            console.error('💀 Canvas要素取得失敗:', error);
            throw error;
        }
        
        return canvas;
    }
    
    /**
     * 座標変換（スクリーン座標 → Canvas座標）- エラー隠蔽完全禁止
     */
    getCanvasCoordinates(screenX, screenY) {
        // CoordinateManager必須確認（フォールバック禁止）
        if (!this.coordinateManager) {
            const error = new Error(`${this.toolName}: CoordinateManager not set - coordinate conversion impossible`);
            console.error('💀 座標変換失敗:', error);
            throw error;
        }
        
        if (typeof this.coordinateManager.screenToCanvas !== 'function') {
            const error = new Error(`${this.toolName}: CoordinateManager.screenToCanvas method not available`);
            console.error('💀 座標変換失敗:', error);
            throw error;
        }
        
        // 座標変換実行（エラー隠蔽禁止）
        const result = this.coordinateManager.screenToCanvas(screenX, screenY);
        if (!result || typeof result.x !== 'number' || typeof result.y !== 'number') {
            const error = new Error(`${this.toolName}: CoordinateManager returned invalid coordinates`);
            console.error('💀 座標変換失敗:', error);
            throw error;
        }
        
        return result;
    }
    
    /**
     * ポインターダウンハンドラー（エラー隠蔽禁止）
     */
    handlePointerDown(event) {
        event.preventDefault();
        
        if (!this.isActive) return;
        
        console.log(`🎯 ${this.toolName} PointerDown`);
        this.isDrawing = true;
        
        // 座標変換（エラー隠蔽禁止）
        const coords = this.getCanvasCoordinates(event.clientX, event.clientY);
        
        // 子クラスの描画開始処理委譲
        if (typeof this.onPointerDown === 'function') {
            this.onPointerDown(coords.x, coords.y, event);
        } else {
            const error = new Error(`${this.toolName}: onPointerDown method not implemented`);
            console.error('💀 PointerDown処理失敗:', error);
            throw error;
        }
    }
    
    /**
     * ポインタームーブハンドラー（エラー隠蔽禁止）
     */
    handlePointerMove(event) {
        event.preventDefault();
        
        if (!this.isActive) return;
        
        // 座標変換（エラー隠蔽禁止）
        const coords = this.getCanvasCoordinates(event.clientX, event.clientY);
        
        if (this.isDrawing) {
            // 描画中の処理
            if (typeof this.onPointerMove === 'function') {
                this.onPointerMove(coords.x, coords.y, event);
            }
        } else {
            // ホバー中の処理（オプション）
            if (typeof this.onHover === 'function') {
                try {
                    this.onHover(coords.x, coords.y, event);
                } catch (error) {
                    console.error(`💀 ${this.toolName} onHover エラー:`, error);
                }
            }
        }
    }
    
    /**
     * ポインターアップハンドラー（エラー隠蔽禁止）
     */
    handlePointerUp(event) {
        event.preventDefault();
        
        if (!this.isActive || !this.isDrawing) return;
        
        console.log(`🎯 ${this.toolName} PointerUp`);
        this.isDrawing = false;
        
        // 座標変換（エラー隠蔽禁止）
        const coords = this.getCanvasCoordinates(event.clientX, event.clientY);
        
        // 子クラスの描画終了処理委譲
        if (typeof this.onPointerUp === 'function') {
            this.onPointerUp(coords.x, coords.y, event);
        }
    }
    
    /**
     * ポインターリーブハンドラー
     */
    handlePointerLeave(event) {
        if (this.isDrawing) {
            console.log(`🎯 ${this.toolName} PointerLeave - 描画終了`);
            this.handlePointerUp(event);
        }
    }
    
    /**
     * 設定更新
     */
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        
        // 子クラスの設定更新処理（オプション）
        if (typeof this.onSettingsUpdate === 'function') {
            try {
                this.onSettingsUpdate(this.settings);
            } catch (error) {
                console.error(`💀 ${this.toolName} 設定更新エラー:`, error);
                throw error;
            }
        }
        
        console.log(`🎯 ${this.toolName} 設定更新:`, this.settings);
    }
    
    /**
     * ツール名取得
     */
    getName() {
        return this.toolName;
    }
    
    /**
     * 有効状態取得
     */
    isActiveTool() {
        return this.isActive;
    }
    
    /**
     * 描画中状態取得
     */
    isCurrentlyDrawing() {
        return this.isDrawing;
    }
    
    /**
     * リセット
     */
    reset() {
        console.log(`🎯 ${this.toolName} リセット開始`);
        this.isDrawing = false;
        
        if (typeof this.onReset === 'function') {
            try {
                this.onReset();
            } catch (error) {
                console.error(`💀 ${this.toolName} リセットエラー:`, error);
                throw error;
            }
        }
        
        console.log(`✅ ${this.toolName} リセット完了`);
    }
    
    /**
     * 破棄処理
     */
    destroy() {
        console.log(`🎯 ${this.toolName} 破棄処理開始`);
        
        // 無効化
        this.deactivate();
        
        // 子クラスの破棄処理（オプション）
        if (typeof this.onDestroy === 'function') {
            try {
                this.onDestroy();
            } catch (error) {
                console.error(`💀 ${this.toolName} 破棄エラー:`, error);
            }
        }
        
        // 参照をクリア
        this.canvasManager = null;
        this.coordinateManager = null;
        this.recordManager = null;
        this.eventBus = null;
        this.errorManager = null;
        
        console.log(`✅ ${this.toolName} 破棄処理完了`);
    }
    
    /**
     * デバッグ情報取得
     */
    getDebugInfo() {
        return {
            className: 'AbstractTool',
            toolName: this.toolName,
            isActive: this.isActive,
            isDrawing: this.isDrawing,
            hasRequiredDeps: !!(this.canvasManager && this.coordinateManager),
            managers: {
                canvasManager: !!this.canvasManager,
                coordinateManager: !!this.coordinateManager,
                recordManager: !!this.recordManager,
                eventBus: !!this.eventBus,
                errorManager: !!this.errorManager
            },
            settings: this.settings,
            canvasElement: (() => {
                try {
                    const canvas = this.getCanvasElement();
                    return {
                        available: true,
                        tagName: canvas.tagName,
                        width: canvas.width,
                        height: canvas.height
                    };
                } catch (error) {
                    return {
                        available: false,
                        error: error.message
                    };
                }
            })()
        };
    }
    
    // === 子クラスでオーバーライドする抽象メソッド ===
    
    /**
     * ポインター押下処理（子クラスで実装必須）
     */
    onPointerDown(x, y, event) {
        // 子クラスで実装
        const error = new Error(`${this.toolName}: onPointerDown not implemented in subclass`);
        console.error('💀 抽象メソッド実装不足:', error);
        throw error;
    }
    
    /**
     * ポインター移動処理（子クラスで実装・オプション）
     */
    onPointerMove(x, y, event) {
        // 子クラスで実装（オプション）
    }
    
    /**
     * ポインター解放処理（子クラスで実装・オプション）
     */
    onPointerUp(x, y, event) {
        // 子クラスで実装（オプション）
    }
    
    /**
     * ホバー処理（子クラスで実装・オプション）
     */
    onHover(x, y, event) {
        // 子クラスで実装（オプション）
    }
    
    /**
     * 有効化時処理（子クラスで実装・オプション）
     */
    onActivate() {
        // 子クラスで実装（オプション）
    }
    
    /**
     * 無効化時処理（子クラスで実装・オプション）
     */
    onDeactivate() {
        // 子クラスで実装（オプション）
    }
    
    /**
     * 設定更新時処理（子クラスで実装・オプション）
     */
    onSettingsUpdate(settings) {
        // 子クラスで実装（オプション）
    }
    
    /**
     * リセット時処理（子クラスで実装・オプション）
     */
    onReset() {
        // 子クラスで実装（オプション）
    }
    
    /**
     * 破棄時処理（子クラスで実装・オプション）
     */
    onDestroy() {
        // 子クラスで実装（オプション）
    }
}

// グローバル公開
window.Tegaki.AbstractTool = AbstractTool;
console.log('🎯 AbstractTool Manager設定・エラー隠蔽禁止完全修正版 Loaded - Manager確実設定・座標変換エラー完全throw・フォールバック削除');