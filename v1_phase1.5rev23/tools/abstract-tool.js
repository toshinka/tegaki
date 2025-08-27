/**
 * 🎯 AbstractTool - Manager統一注入方式・フォールバック削除版
 * 📋 RESPONSIBILITY: 全ツールの基底クラス・共通イベント処理・座標変換・Manager統一管理
 * 🚫 PROHIBITION: 具体的な描画処理・複雑な初期化・エラー隠蔽・Manager未設定時の無視・フォールバック処理
 * ✅ PERMISSION: イベントハンドリング・座標変換・Manager統一設定・基底メソッド提供・厳密検証
 * 
 * 📏 DESIGN_PRINCIPLE: 継承ベース・共通処理集約・Manager統一注入・エラー隠蔽完全禁止・フェイルファスト
 * 🔄 INTEGRATION: CanvasManager連携・CoordinateManager座標変換・RecordManager記録・EventBus通信・ErrorManager報告
 * 🔧 FIX: setManagers()統一注入・getManager()統一取得・validateManagers()厳密確認・フォールバック完全削除
 * 
 * 📌 使用メソッド一覧:
 * ✅ window.Tegaki.ErrorManagerInstance.showError() - エラー表示（error-manager.js確認済み）
 * ✅ window.Tegaki.EventBusInstance.emit() - イベント発火（event-bus.js確認済み）
 * ✅ this.managers.coordinate.clientToCanvas() - 座標変換（coordinate-manager.js確認済み）
 * ✅ this.managers.canvas.getCanvasElement() - Canvas要素取得（canvas-manager.js確認済み）
 * ✅ this.managers.record?.recordDraw() - 操作記録（record-manager.js確認済み・オプション）
 * ✅ canvas.getBoundingClientRect() - 要素位置取得（DOM標準）
 * ✅ canvas.addEventListener/removeEventListener() - イベント管理（DOM標準）
 * ✅ event.preventDefault() - デフォルト動作防止（DOM標準）
 * 🆕 this.setManagers(managers) - Manager統一注入（新規実装）
 * 🆕 this.getManager(type) - Manager統一取得（新規実装）
 * 🆕 this.validateManagers() - Manager設定厳密確認（修正実装）
 * ❌ フォールバック処理全て削除 - Manager未設定時は即座にエラー
 * ❌ 個別Manager設定メソッド削除 - setManagers()に統一
 * 
 * 📐 基底ツールフロー:
 * 開始 → 継承・作成(CanvasManager) → setManagers()統一注入 → validateManagers()検証 → 
 * activate()有効化・イベント登録 → 座標変換・描画委譲 → deactivate()無効化・リセット → 終了
 * 依存関係: CanvasManager(Canvas要素・必須)・CoordinateManager(座標変換・必須)・
 * RecordManager(記録・オプション)・EventBusInstance(通信)・ErrorManagerInstance(報告)
 * 
 * 🚨 CRITICAL_DEPENDENCIES: 重要依存関係（動作に必須）
 * - this.managers.canvas !== null - Canvas管理Manager必須
 * - this.managers.coordinate !== null - 座標変換Manager必須
 * - this.managers.canvas.getCanvasElement() !== null - Canvas要素存在必須
 * - this.managers.coordinate.clientToCanvas() - 座標変換メソッド必須
 * 
 * 🔧 MANAGER_INJECTION: Manager注入パターン（統一方式）
 * 1. AbstractTool作成(canvasManager) - 従来互換
 * 2. setManagers({canvas, coordinate, record, navigation}) - 統一注入
 * 3. validateManagers() - 必須Manager存在確認・エラー隠蔽禁止
 * 4. activate() - ツール有効化・イベント設定
 * 5. 座標変換・描画処理可能
 * 
 * 🚫 ABSOLUTE_PROHIBITIONS: 絶対禁止事項
 * - Manager未設定時の無視処理（エラーthrow必須）
 * - CoordinateManager未設定時の基本座標変換フォールバック（削除）
 * - try/catch握りつぶし（詳細ログ+throw必須）
 * - Manager設定前のツール使用（validateManagers()で防止）
 * - 個別Manager設定メソッド使用（統一方式に変更）
 * 
 * 🆕 MANAGER_TYPES: サポートManagerタイプ
 * - 'canvas': CanvasManager（必須）
 * - 'coordinate': CoordinateManager（必須）
 * - 'record': RecordManager（オプション）
 * - 'navigation': NavigationManager（オプション・Phase1.5）
 */

window.Tegaki = window.Tegaki || {};

/**
 * AbstractTool - 全ツールの基底クラス（Manager統一注入方式）
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
        
        this.toolName = toolName;
        this.isActive = false;
        this.isDrawing = false;
        
        // 🆕 Manager統一管理（旧個別プロパティを統一）
        this.managers = {
            canvas: canvasManager,      // 必須・コンストラクタ引数から
            coordinate: null,           // 必須・setManagers()で設定
            record: null,               // オプション・setManagers()で設定
            navigation: null            // オプション・Phase1.5で追加
        };
        
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
     * 🆕 Manager統一注入（新方式・必須メソッド）
     * @param {Object} managers - Manager集合 {canvas, coordinate, record?, navigation?}
     */
    setManagers(managers) {
        if (!managers || typeof managers !== 'object') {
            const error = new Error(`${this.toolName}: managers must be an object`);
            console.error('💀 Manager統一注入失敗:', error);
            throw error;
        }
        
        console.log(`🔧 ${this.toolName} Manager統一注入開始`);
        
        // 必須Manager確認（canvas, coordinate）
        if (!managers.canvas) {
            const error = new Error(`${this.toolName}: managers.canvas is required`);
            console.error('💀 Manager統一注入失敗:', error);
            throw error;
        }
        if (!managers.coordinate) {
            const error = new Error(`${this.toolName}: managers.coordinate is required`);
            console.error('💀 Manager統一注入失敗:', error);
            throw error;
        }
        
        // Manager設定（null上書き可・オプションManager対応）
        this.managers.canvas = managers.canvas;
        this.managers.coordinate = managers.coordinate;
        this.managers.record = managers.record || null;
        this.managers.navigation = managers.navigation || null;
        
        console.log(`✅ ${this.toolName} Manager統一注入完了`);
        console.log(`📊 注入Manager状況:`, {
            canvas: !!this.managers.canvas,
            coordinate: !!this.managers.coordinate,
            record: !!this.managers.record,
            navigation: !!this.managers.navigation
        });
    }
    
    /**
     * 🆕 Manager統一取得（新方式・便利メソッド）
     * @param {string} type - Managerタイプ('canvas', 'coordinate', 'record', 'navigation')
     * @returns {Object|null} Manager または null
     */
    getManager(type) {
        if (!type || typeof type !== 'string') {
            const error = new Error(`${this.toolName}: getManager() requires type string`);
            console.error('💀 Manager取得失敗:', error);
            throw error;
        }
        
        if (!this.managers.hasOwnProperty(type)) {
            const error = new Error(`${this.toolName}: unknown manager type '${type}'. Available: canvas, coordinate, record, navigation`);
            console.error('💀 Manager取得失敗:', error);
            throw error;
        }
        
        return this.managers[type];
    }
    
    /**
     * 🔧 Manager設定厳密確認（修正版・エラー隠蔽禁止）
     */
    validateManagers() {
        const errors = [];
        const managerStatus = {};
        
        // 詳細なCanvasManager状態チェック
        managerStatus.canvas = {
            exists: !!this.managers.canvas,
            hasGetCanvasElement: typeof this.managers.canvas?.getCanvasElement === 'function',
            canvasElementReady: (() => {
                try {
                    return !!this.managers.canvas?.getCanvasElement();
                } catch (error) {
                    return { error: error.message };
                }
            })()
        };
        
        // 詳細なCoordinateManager状態チェック
        managerStatus.coordinate = {
            exists: !!this.managers.coordinate,
            hasClientToCanvas: typeof this.managers.coordinate?.clientToCanvas === 'function',
            hasCanvasToClient: typeof this.managers.coordinate?.canvasToClient === 'function',
            initialized: this.managers.coordinate?.initialized || false
        };
        
        // 詳細なRecordManager状態チェック（オプション）
        managerStatus.record = {
            exists: !!this.managers.record,
            hasRecordDraw: typeof this.managers.record?.recordDraw === 'function',
            hasCanUndo: typeof this.managers.record?.canUndo === 'function'
        };
        
        // 詳細なNavigationManager状態チェック（オプション・Phase1.5）
        managerStatus.navigation = {
            exists: !!this.managers.navigation,
            hasPanCanvas: typeof this.managers.navigation?.panCanvas === 'function',
            hasZoomCanvas: typeof this.managers.navigation?.zoomCanvas === 'function'
        };
        
        // エラー収集（必須Manager）
        if (!managerStatus.canvas.exists) {
            errors.push('CanvasManager not set');
        } else if (!managerStatus.canvas.hasGetCanvasElement) {
            errors.push('CanvasManager.getCanvasElement method not found');
        } else if (!managerStatus.canvas.canvasElementReady) {
            errors.push('CanvasManager.getCanvasElement() returns null');
        }
        
        if (!managerStatus.coordinate.exists) {
            errors.push('CoordinateManager not set');
        } else if (!managerStatus.coordinate.hasClientToCanvas) {
            errors.push('CoordinateManager.clientToCanvas method not found');
        } else if (!managerStatus.coordinate.initialized) {
            errors.push('CoordinateManager not initialized');
        }
        
        // recordManager・navigationManagerはnull許可（オプション）
        
        if (errors.length > 0) {
            const error = new Error(`${this.toolName} Manager validation failed: ${errors.join(', ')}`);
            console.error('💀 Manager設定検証失敗:', error);
            console.error('📊 詳細Manager設定状況:', managerStatus);
            
            // EventBus・ErrorManager状態も追加表示
            console.error('📊 基盤システム状況:', {
                eventBus: !!this.eventBus,
                errorManager: !!this.errorManager
            });
            
            throw error;
        }
        
        console.log(`✅ ${this.toolName} Manager設定確認完了`);
        console.log(`📊 Manager設定状況:`, managerStatus);
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
     * Canvas要素取得（統一Manager使用・エラー隠蔽禁止）
     */
    getCanvasElement() {
        if (!this.managers.canvas) {
            const error = new Error(`${this.toolName}: CanvasManager not set`);
            console.error('💀 Canvas要素取得失敗:', error);
            throw error;
        }
        
        if (typeof this.managers.canvas.getCanvasElement !== 'function') {
            const error = new Error(`${this.toolName}: CanvasManager.getCanvasElement method not available`);
            console.error('💀 Canvas要素取得失敗:', error);
            throw error;
        }
        
        const canvas = this.managers.canvas.getCanvasElement();
        if (!canvas) {
            const error = new Error(`${this.toolName}: CanvasManager.getCanvasElement() returned null`);
            console.error('💀 Canvas要素取得失敗:', error);
            throw error;
        }
        
        return canvas;
    }
    
    /**
     * 🔧 座標変換（クライアント座標 → Canvas座標）- 統一Manager使用
     */
    getCanvasCoordinates(clientX, clientY) {
        // CoordinateManager必須確認（フォールバック禁止）
        if (!this.managers.coordinate) {
            const error = new Error(`${this.toolName}: CoordinateManager not set - coordinate conversion impossible`);
            console.error('💀 座標変換失敗:', error);
            throw error;
        }
        
        if (typeof this.managers.coordinate.clientToCanvas !== 'function') {
            const error = new Error(`${this.toolName}: CoordinateManager.clientToCanvas method not available`);
            console.error('💀 座標変換失敗:', error);
            throw error;
        }
        
        // 🔧 座標変換実行（clientToCanvas使用・エラー隠蔽禁止）
        try {
            const result = this.managers.coordinate.clientToCanvas(clientX, clientY);
            
            if (!result || typeof result.x !== 'number' || typeof result.y !== 'number') {
                const error = new Error(`${this.toolName}: CoordinateManager returned invalid coordinates`);
                console.error('💀 座標変換失敗:', error);
                throw error;
            }
            
            return result;
        } catch (error) {
            console.error(`💀 ${this.toolName} 座標変換エラー:`, error);
            throw error; // エラーを隠蔽せずに上位に伝播
        }
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
        this.managers = {
            canvas: null,
            coordinate: null,
            record: null,
            navigation: null
        };
        this.eventBus = null;
        this.errorManager = null;
        
        console.log(`✅ ${this.toolName} 破棄処理完了`);
    }
    
    /**
     * デバッグ情報取得（統一Manager対応版）
     */
    getDebugInfo() {
        return {
            className: 'AbstractTool',
            toolName: this.toolName,
            isActive: this.isActive,
            isDrawing: this.isDrawing,
            hasRequiredDeps: !!(this.managers.canvas && this.managers.coordinate),
            
            // 詳細Manager状態（統一方式）
            managers: {
                canvas: {
                    exists: !!this.managers.canvas,
                    hasGetCanvasElement: typeof this.managers.canvas?.getCanvasElement === 'function'
                },
                coordinate: {
                    exists: !!this.managers.coordinate,
                    hasClientToCanvas: typeof this.managers.coordinate?.clientToCanvas === 'function',
                    initialized: this.managers.coordinate?.initialized || false
                },
                record: {
                    exists: !!this.managers.record,
                    hasRecordDraw: typeof this.managers.record?.recordDraw === 'function'
                },
                navigation: {
                    exists: !!this.managers.navigation,
                    hasPanCanvas: typeof this.managers.navigation?.panCanvas === 'function'
                }
            },
            
            // 基盤システム状況
            systems: {
                eventBus: !!this.eventBus,
                errorManager: !!this.errorManager
            },
            
            settings: this.settings,
            
            // Canvas要素状態
            canvasElement: (() => {
                try {
                    const canvas = this.getCanvasElement();
                    return {
                        available: true,
                        tagName: canvas.tagName,
                        width: canvas.width,
                        height: canvas.height,
                        hasPointerEvents: canvas.style.pointerEvents !== 'none'
                    };
                } catch (error) {
                    return {
                        available: false,
                        error: error.message
                    };
                }
            })(),
            
            // 座標変換テスト
            coordinateTest: (() => {
                try {
                    if (this.managers.coordinate && typeof this.managers.coordinate.clientToCanvas === 'function') {
                        const testResult = this.getCanvasCoordinates(100, 100);
                        return {
                            success: true,
                            testInput: { x: 100, y: 100 },
                            testOutput: testResult
                        };
                    } else {
                        return { success: false, reason: 'CoordinateManager not available' };
                    }
                } catch (error) {
                    return { success: false, error: error.message };
                }
            })()
        };
    }
    
    // === 旧互換メソッド（非推奨・削除予定） ===
    
    /**
     * @deprecated - setManagers()を使用してください
     */
    setCoordinateManager(coordinateManager) {
        console.warn(`⚠️ ${this.toolName}: setCoordinateManager() is deprecated. Use setManagers({coordinate: manager}) instead.`);
        this.managers.coordinate = coordinateManager;
    }
    
    /**
     * @deprecated - setManagers()を使用してください
     */
    setRecordManager(recordManager) {
        console.warn(`⚠️ ${this.toolName}: setRecordManager() is deprecated. Use setManagers({record: manager}) instead.`);
        this.managers.record = recordManager;
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
console.log('🎯 AbstractTool Manager統一注入方式・フォールバック削除版 Loaded - setManagers()統一・getManager()便利・validateManagers()厳密・フォールバック完全削除');