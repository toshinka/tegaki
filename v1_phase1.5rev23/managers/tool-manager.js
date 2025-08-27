/**
 * 🔧 ToolManager Phase1.5 Manager統一注入版
 * 📋 RESPONSIBILITY: ツール管理・切り替え・イベント委譲・Manager統一注入処理
 * 🚫 PROHIBITION: 描画処理・Canvas管理・複雑な初期化・設定管理・エラー隠蔽・フォールバック構造・個別Manager設定
 * ✅ PERMISSION: ツール作成・選択・イベント転送・状態管理・Manager統一注入・initializeToolsWithManagers実装
 * 
 * 📏 DESIGN_PRINCIPLE: ツール専任管理・責務分離・Manager統一注入・エラー隠蔽禁止・Phase1.5完全対応
 * 🔄 INTEGRATION: PenTool・EraserTool管理・Manager統一注入・EventBus通信・ErrorManager報告
 * 🔧 FIX: initializeToolsWithManagers実装・collectRequiredManagers追加・Manager注入統一化・フォールバック完全削除
 * 
 * 📌 使用メソッド一覧:
 * ✅ window.Tegaki.PenTool(constructor) - ペンツール作成（pen-tool.js確認済み）
 * ✅ window.Tegaki.EraserTool(constructor) - 消しゴムツール作成（eraser-tool.js確認済み）  
 * ✅ window.Tegaki.ErrorManagerInstance.showError() - エラー表示（error-manager.js確認済み）
 * ✅ window.Tegaki.EventBusInstance.emit() - イベント発火（event-bus.js確認済み）
 * ✅ tool.setManagers() - Manager統一注入（abstract-tool.js新規実装確認済み）
 * ✅ tool.activate() - ツール有効化（abstract-tool.js継承メソッド確認済み）
 * ✅ tool.deactivate() - ツール無効化（abstract-tool.js継承メソッド確認済み）
 * ✅ tool.onPointerDown/Move/Up() - ポインターイベント処理（abstract-tool.js継承確認済み）
 * ✅ document.getElementById() - DOM要素取得（ブラウザ標準）
 * ✅ element.addEventListener() - イベント登録（ブラウザ標準）
 * ✅ element.classList.add/remove() - CSS操作（ブラウザ標準）
 * 🆕 this.initializeToolsWithManagers() - Manager注入処理（新規実装）
 * 🆕 this.collectRequiredManagers() - 必要Manager収集（新規実装）
 * 🔧 this.selectTool() - ツール選択（既存・Manager注入後呼び出し修正）
 * ❌ setPhase15Managers() - 削除（initializeToolsWithManagersに統合）
 * ❌ フォールバック処理全て削除 - 正しい構造でのみ動作
 * 
 * 📐 ツール管理フロー:
 * 開始 → 依存関係確認 → ツール作成(PenTool,EraserTool) → collectRequiredManagers → 
 * initializeToolsWithManagers → Manager統一注入 → selectTool(pen) → UI更新 → イベント委譲 → 状態管理 → 終了
 * 依存関係: PenTool・EraserTool(実装)・CanvasManager(注入)・CoordinateManager(注入)・
 * RecordManager(注入)・NavigationManager(注入・オプション)・EventBusInstance(通信)・ErrorManagerInstance(報告)
 * 
 * 🚨 CRITICAL_DEPENDENCIES: 重要依存関係（動作に必須）
 * - window.Tegaki.PenTool !== null - ペンツールクラス存在必須
 * - window.Tegaki.EraserTool !== null - 消しゴムツールクラス存在必須
 * - this.canvasManager !== null - Canvas管理Manager必須
 * - requiredManagers.coordinate !== null - 座標変換Manager必須
 * - requiredManagers.record !== null - 記録Manager必須
 * 
 * 🔧 INITIALIZATION_ORDER: 初期化順序（厳守必要）
 * 1. ToolManager作成・依存関係確認
 * 2. ツール作成（PenTool・EraserTool）
 * 3. collectRequiredManagers()でManager収集
 * 4. initializeToolsWithManagers()でManager統一注入
 * 5. selectTool('pen')でデフォルトツール選択
 * 6. 描画・イベント処理可能
 * 
 * 🚫 ABSOLUTE_PROHIBITIONS: 絶対禁止事項
 * - Manager未注入時のツール有効化（Manager注入後のみ許可）
 * - try/catch握りつぶし（詳細ログ+throw必須）
 * - 個別Manager設定メソッド使用（統一注入のみ）
 * - Manager設定前のselectTool()呼び出し（initializeToolsWithManagers後のみ）
 * - フォールバック・デフォルト値使用（正しい構造でのみ動作）
 */

window.Tegaki = window.Tegaki || {};

/**
 * ToolManager - ツール管理専任（Manager統一注入版・Phase1.5対応）
 */
class ToolManager {
    constructor(canvasManager) {
        console.log('🔧 ToolManager Phase1.5 作成開始 - Manager統一注入版');
        
        // 必須引数確認（フォールバック禁止・即座にthrow）
        if (!canvasManager) {
            const error = new Error('CanvasManager is required for ToolManager');
            console.error('💀 ToolManager 作成失敗:', error);
            throw error;
        }
        
        this.canvasManager = canvasManager;
        this.tools = new Map();
        this.currentTool = null;
        this.currentToolName = null;
        this.initialized = false;
        this.managersInitialized = false;
        
        // 依存関係確認・設定（フォールバック禁止）
        this.eventBus = window.Tegaki.EventBusInstance;
        this.errorManager = window.Tegaki.ErrorManagerInstance;
        
        if (!this.eventBus) {
            const error = new Error('EventBusInstance is required');
            console.error('💀 EventBusInstance not available:', error);
            throw error;
        }
        if (!this.errorManager) {
            const error = new Error('ErrorManagerInstance is required');
            console.error('💀 ErrorManagerInstance not available:', error);
            throw error;
        }
        
        // 依存関係確認（フォールバック禁止・即座にエラー）
        this.validateDependencies();
        
        // ツール作成（Manager注入は後で実行）
        this.createTools();
        
        this.initialized = true;
        console.log('✅ ToolManager コンストラクタ完了 - ツール作成完了・Manager注入待機中');
        console.log('📋 作成完了ツール:', Array.from(this.tools.keys()));
        console.log('⚠️ 注意: Manager注入前のためツール選択不可');
    }
    
    /**
     * 依存関係確認（フォールバック禁止・エラー即座にthrow）
     */
    validateDependencies() {
        const dependencies = [
            { name: 'PenTool', ref: window.Tegaki.PenTool },
            { name: 'EraserTool', ref: window.Tegaki.EraserTool },
            { name: 'CanvasManager', ref: this.canvasManager }
        ];
        
        for (const dep of dependencies) {
            if (!dep.ref) {
                const error = new Error(`${dep.name} is not available - required dependency missing`);
                console.error(`💀 依存関係エラー: ${dep.name}`, error);
                throw error;
            }
        }
        
        console.log('✅ 全依存関係確認完了 - PenTool・EraserTool・CanvasManager利用可能');
    }
    
    /**
     * ツール作成（フォールバック禁止・エラー即座にthrow）
     */
    createTools() {
        console.log('🔧 ツール作成開始...');
        
        // PenTool作成（フォールバック禁止）
        const penTool = new window.Tegaki.PenTool(this.canvasManager);
        if (!penTool) {
            const error = new Error('PenTool creation failed');
            console.error('💀 PenTool作成失敗:', error);
            throw error;
        }
        this.tools.set('pen', penTool);
        console.log('✅ PenTool 作成完了');
        
        // EraserTool作成（フォールバック禁止）
        const eraserTool = new window.Tegaki.EraserTool(this.canvasManager);
        if (!eraserTool) {
            const error = new Error('EraserTool creation failed');
            console.error('💀 EraserTool作成失敗:', error);
            throw error;
        }
        this.tools.set('eraser', eraserTool);
        console.log('✅ EraserTool 作成完了');
        
        console.log('✅ 全ツール作成完了:', Array.from(this.tools.keys()));
        console.log('📊 ツール数:', this.tools.size);
    }
    
    /**
     * 🆕 必要Manager収集（tegaki-applicationから呼ばれる）
     */
    collectRequiredManagers(coordinateManager, recordManager, navigationManager, shortcutManager) {
        console.log('🔧 ToolManager 必要Manager収集開始...');
        
        // 必須Manager確認（フォールバック禁止）
        if (!coordinateManager) {
            const error = new Error('CoordinateManager is required for collectRequiredManagers');
            console.error('💀 CoordinateManager必須:', error);
            throw error;
        }
        
        if (!recordManager) {
            const error = new Error('RecordManager is required for collectRequiredManagers');
            console.error('💀 RecordManager必須:', error);
            throw error;
        }
        
        // Manager収集オブジェクト作成
        const requiredManagers = {
            canvas: this.canvasManager,      // コンストラクタで取得済み
            coordinate: coordinateManager,   // 必須
            record: recordManager,           // 必須
            navigation: navigationManager,   // オプション
            shortcut: shortcutManager        // オプション
        };
        
        console.log('✅ 必要Manager収集完了');
        console.log('📊 収集Manager状況:', {
            canvas: !!requiredManagers.canvas,
            coordinate: !!requiredManagers.coordinate,
            record: !!requiredManagers.record,
            navigation: !!requiredManagers.navigation,
            shortcut: !!requiredManagers.shortcut
        });
        
        return requiredManagers;
    }
    
    /**
     * 🆕 Manager統一注入処理（tegaki-applicationから呼ばれる）
     */
    initializeToolsWithManagers(coordinateManager, recordManager, navigationManager, shortcutManager) {
        console.log('🔧 ToolManager Manager統一注入処理開始...');
        
        // Manager収集
        const requiredManagers = this.collectRequiredManagers(
            coordinateManager, 
            recordManager, 
            navigationManager, 
            shortcutManager
        );
        
        // 🚨 重要：各ツールにManager統一注入
        this.tools.forEach((tool, toolName) => {
            console.log(`🔧 ${toolName} Manager統一注入開始...`);
            
            // setManagersメソッド確認
            if (typeof tool.setManagers !== 'function') {
                const error = new Error(`${toolName}: setManagers method not available`);
                console.error('💀 setManagers未実装:', error);
                throw error;
            }
            
            // Manager統一注入実行
            try {
                tool.setManagers(requiredManagers);
                console.log(`✅ ${toolName} Manager統一注入完了`);
            } catch (error) {
                console.error(`💀 ${toolName} Manager注入失敗:`, error);
                throw error;
            }
            
            // Manager設定後の検証
            if (typeof tool.validateManagers === 'function') {
                try {
                    tool.validateManagers();
                    console.log(`✅ ${toolName} Manager設定検証完了`);
                } catch (error) {
                    console.error(`💀 ${toolName} Manager設定検証失敗:`, error);
                    throw error;
                }
            }
        });
        
        this.managersInitialized = true;
        
        console.log('✅ ToolManager Manager統一注入処理完了');
        console.log('📊 注入完了状況:', {
            managersInitialized: this.managersInitialized,
            toolsConfigured: this.tools.size,
            readyForSelection: true
        });
        
        // 🚨 重要：Manager注入完了後にデフォルトツール選択
        this.selectTool('pen');
    }
    
    /**
     * ツール選択（Manager注入確認付き・フォールバック禁止・エラー即座にthrow）
     */
    selectTool(toolName) {
        console.log(`🔧 ツール選択開始: ${toolName}`);
        
        // Manager注入確認（フォールバック禁止）
        if (!this.managersInitialized) {
            const error = new Error('Managers not initialized - call initializeToolsWithManagers first');
            console.error('💀 Manager注入前選択エラー:', error);
            this.errorManager.showError('error', `Manager未初期化: initializeToolsWithManagersを先に実行してください`, {
                context: 'ToolManager.selectTool'
            });
            throw error;
        }
        
        // ツール存在確認（フォールバック禁止）
        const tool = this.tools.get(toolName);
        if (!tool) {
            const error = new Error(`Tool not found: ${toolName} - Available tools: ${Array.from(this.tools.keys()).join(', ')}`);
            console.error('💀 ツール選択失敗:', error);
            this.errorManager.showError('error', `ツール選択失敗: ${error.message}`, {
                context: 'ToolManager.selectTool'
            });
            throw error;
        }
        
        // 現在のツールを無効化
        if (this.currentTool && typeof this.currentTool.deactivate === 'function') {
            this.currentTool.deactivate();
            this.updateToolButtonState(this.currentToolName, false);
            console.log(`📋 前のツール無効化: ${this.currentToolName}`);
        }
        
        // 新しいツールを有効化
        this.currentTool = tool;
        this.currentToolName = toolName;
        
        if (typeof this.currentTool.activate === 'function') {
            try {
                this.currentTool.activate();
            } catch (error) {
                console.error(`💀 ${toolName} ツール有効化失敗:`, error);
                this.errorManager.showError('error', `ツール有効化失敗: ${error.message}`, {
                    context: `ToolManager.selectTool.${toolName}.activate`
                });
                throw error;
            }
        } else {
            const error = new Error(`Tool ${toolName} does not have activate method`);
            console.error('💀 ツール有効化失敗:', error);
            throw error;
        }
        
        this.updateToolButtonState(toolName, true);
        
        console.log(`✅ ツール選択完了: ${toolName}`);
        
        // ツール変更イベント発火
        this.eventBus.emit('toolManager:toolChanged', {
            previousTool: this.currentToolName,
            newTool: toolName,
            tool: this.currentTool
        });
    }
    
    /**
     * ツールボタンの表示状態更新
     */
    updateToolButtonState(toolName, isActive) {
        const button = document.getElementById(`${toolName}-tool`);
        if (!button) {
            console.warn(`⚠️ ツールボタン要素が見つかりません: #${toolName}-tool`);
            return;
        }
        
        if (isActive) {
            button.classList.add('active');
            console.log(`📋 ツールボタン有効化: ${toolName}`);
        } else {
            button.classList.remove('active');
            console.log(`📋 ツールボタン無効化: ${toolName}`);
        }
    }
    
    /**
     * ポインターイベントの委譲（フォールバック禁止・エラー即座にthrow）
     */
    handlePointerDown(x, y, event) {
        if (!this.currentTool) {
            const error = new Error('No current tool selected for pointer down event');
            console.error('💀 PointerDown処理失敗:', error);
            this.errorManager.showError('error', 'ツールが選択されていません', {
                context: 'ToolManager.handlePointerDown'
            });
            throw error;
        }
        
        if (typeof this.currentTool.onPointerDown !== 'function') {
            const error = new Error(`Current tool ${this.currentToolName} does not have onPointerDown method`);
            console.error('💀 PointerDown処理失敗:', error);
            this.errorManager.showError('error', `ツール ${this.currentToolName} にonPointerDownメソッドがありません`, {
                context: 'ToolManager.handlePointerDown'
            });
            throw error;
        }
        
        console.log(`🔧 PointerDown委譲: ${this.currentToolName} (${x}, ${y})`);
        this.currentTool.onPointerDown(x, y, event);
    }
    
    handlePointerMove(x, y, event) {
        if (!this.currentTool) {
            console.warn('⚠️ No current tool for pointer move event');
            return;
        }
        
        if (typeof this.currentTool.onPointerMove !== 'function') {
            console.warn(`⚠️ Tool ${this.currentToolName} does not have onPointerMove method`);
            return;
        }
        
        this.currentTool.onPointerMove(x, y, event);
    }
    
    handlePointerUp(x, y, event) {
        if (!this.currentTool) {
            console.warn('⚠️ No current tool for pointer up event');
            return;
        }
        
        if (typeof this.currentTool.onPointerUp !== 'function') {
            console.warn(`⚠️ Tool ${this.currentToolName} does not have onPointerUp method`);
            return;
        }
        
        console.log(`🔧 PointerUp委譲: ${this.currentToolName} (${x}, ${y})`);
        this.currentTool.onPointerUp(x, y, event);
    }
    
    /**
     * 現在のツール取得
     */
    getCurrentTool() {
        return this.currentTool;
    }
    
    /**
     * 現在のツール名取得
     */
    getCurrentToolName() {
        return this.currentToolName;
    }
    
    /**
     * 利用可能ツール一覧取得
     */
    getAvailableTools() {
        return Array.from(this.tools.keys());
    }
    
    /**
     * ツール設定更新
     */
    updateToolSettings(toolName, settings) {
        const tool = this.tools.get(toolName);
        if (!tool) {
            const error = new Error(`Tool not found for settings update: ${toolName}`);
            console.error('💀 ツール設定更新失敗:', error);
            throw error;
        }
        
        if (typeof tool.onSettingsUpdate === 'function') {
            tool.onSettingsUpdate(settings);
            console.log(`🔧 ${toolName} 設定更新完了:`, settings);
            
            // 設定更新イベント発火
            this.eventBus.emit('tool:settingsUpdated', {
                toolName: toolName,
                settings: settings
            });
        } else {
            console.log(`📋 ${toolName} 設定更新スキップ - onSettingsUpdateメソッドなし`);
        }
    }
    
    /**
     * 全ツールリセット
     */
    resetAllTools() {
        console.log('🔧 全ツールリセット開始...');
        
        this.tools.forEach((tool, toolName) => {
            if (typeof tool.onReset === 'function') {
                try {
                    tool.onReset();
                    console.log(`✅ ${toolName} リセット完了`);
                } catch (error) {
                    console.error(`💀 ${toolName} リセットエラー:`, error);
                    this.errorManager.showError('error', `${toolName} リセットエラー: ${error.message}`, {
                        context: 'ToolManager.resetAllTools'
                    });
                    // 他のツールのリセットは継続
                }
            }
        });
        
        console.log('✅ 全ツールリセット完了');
    }
    
    /**
     * 初期化状態確認（Manager注入確認追加・フォールバック禁止・厳密確認）
     */
    isReady() {
        const ready = this.initialized && 
                     this.managersInitialized &&
                     this.tools.size > 0 && 
                     this.canvasManager && 
                     this.currentTool !== null &&
                     this.eventBus &&
                     this.errorManager;
        
        console.log('🔧 ToolManager準備状態:', {
            initialized: this.initialized,
            managersInitialized: this.managersInitialized,
            toolsCount: this.tools.size,
            hasCanvasManager: !!this.canvasManager,
            hasCurrentTool: !!this.currentTool,
            hasEventBus: !!this.eventBus,
            hasErrorManager: !!this.errorManager,
            overall: ready
        });
        
        return ready;
    }
    
    /**
     * デバッグ情報取得（強化版）
     */
    getDebugInfo() {
        return {
            className: 'ToolManager',
            initialized: this.initialized,
            managersInitialized: this.managersInitialized,
            hasRequiredDeps: !!(this.canvasManager && this.eventBus && this.errorManager),
            itemCount: this.tools.size,
            currentState: this.currentToolName || 'none',
            lastError: 'none',
            additionalInfo: {
                availableTools: Array.from(this.tools.keys()),
                currentTool: this.currentToolName,
                hasCanvasManager: !!this.canvasManager,
                hasEventBus: !!this.eventBus,
                hasErrorManager: !!this.errorManager,
                toolsReady: Array.from(this.tools.entries()).map(([name, tool]) => ({
                    name: name,
                    hasSetManagers: typeof tool.setManagers === 'function',
                    hasValidateManagers: typeof tool.validateManagers === 'function',
                    hasActivate: typeof tool.activate === 'function',
                    hasDeactivate: typeof tool.deactivate === 'function',
                    hasPointerMethods: {
                        onPointerDown: typeof tool.onPointerDown === 'function',
                        onPointerMove: typeof tool.onPointerMove === 'function',
                        onPointerUp: typeof tool.onPointerUp === 'function'
                    }
                }))
            }
        };
    }
    
    /**
     * 破棄処理
     */
    destroy() {
        console.log('🔧 ToolManager 破棄処理開始...');
        
        // 現在のツールを無効化
        if (this.currentTool && typeof this.currentTool.deactivate === 'function') {
            try {
                this.currentTool.deactivate();
            } catch (error) {
                console.error('💀 現在のツール無効化エラー:', error);
            }
        }
        
        // 全ツールの破棄
        this.tools.forEach((tool, toolName) => {
            if (typeof tool.onDestroy === 'function') {
                try {
                    tool.onDestroy();
                    console.log(`✅ ${toolName} 破棄完了`);
                } catch (error) {
                    console.error(`💀 ${toolName} 破棄エラー:`, error);
                }
            }
        });
        
        // 参照をクリア
        this.tools.clear();
        this.currentTool = null;
        this.currentToolName = null;
        this.canvasManager = null;
        this.eventBus = null;
        this.errorManager = null;
        this.initialized = false;
        this.managersInitialized = false;
        
        console.log('✅ ToolManager 破棄処理完了');
    }
}

// グローバル公開
window.Tegaki.ToolManager = ToolManager;
console.log('🔧 ToolManager Phase1.5 Manager統一注入版 Loaded - initializeToolsWithManagers実装・Manager注入統一・エラー隠蔽禁止・フォールバック完全削除');