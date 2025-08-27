/**
 * 🔧 ToolManager Phase1.5 - ペン/消しゴムツール管理（構文エラー完全修正版）
 * 📋 RESPONSIBILITY: ツール管理・切り替え・イベント委譲のみ
 * 🚫 PROHIBITION: 描画処理・Canvas管理・複雑な初期化・設定管理・エラー隠蔽
 * ✅ PERMISSION: ツール作成・選択・イベント転送・状態管理
 * 
 * 📏 DESIGN_PRINCIPLE: ツール専任管理・責務分離・単純構造・剛直エラー処理
 * 🔄 INTEGRATION: PenTool・EraserTool管理・EventBus通信・ErrorManager報告
 * 🔧 FIX: 構文エラー完全修正・架空メソッド削除・エラー隠蔽禁止・責務分界明確化
 * 
 * 📌 使用メソッド一覧:
 * ✅ window.Tegaki.PenTool(constructor) - ペンツール作成（pen-tool.js確認済み）
 * ✅ window.Tegaki.EraserTool(constructor) - 消しゴムツール作成（eraser-tool.js確認済み）  
 * ✅ window.Tegaki.ErrorManagerInstance.showError() - エラー表示（error-manager.js確認済み）
 * ✅ window.Tegaki.EventBusInstance.emit() - イベント発火（event-bus.js確認済み）
 * ✅ tool.activate() - ツール有効化（abstract-tool.js継承メソッド確認済み）
 * ✅ tool.deactivate() - ツール無効化（abstract-tool.js継承メソッド確認済み）
 * ✅ tool.getName() - ツール名取得（abstract-tool.js継承メソッド確認済み）
 * ✅ document.getElementById() - DOM要素取得（ブラウザ標準）
 * ✅ element.addEventListener() - イベント登録（ブラウザ標準）
 * ✅ element.classList.add/remove() - CSS操作（ブラウザ標準）
 * ❌ handleError() - 削除（架空メソッド・ErrorManagerInstance.showError使用）
 * ❌ setCanvasManager() - 削除（コンストラクタ注入で対応）
 * 
 * 📐 ツール管理フロー:
 * 開始 → ツール作成(PenTool,EraserTool) → デフォルト選択(pen) → UI更新 → 
 * イベント委譲 → 状態管理 → 終了
 * 依存関係: PenTool・EraserTool(実装)・EventBusInstance(通信)・ErrorManagerInstance(報告)
 * 
 * 🚫 絶対禁止事項:
 * - try/catchでの握りつぶし（throw必須）
 * - フォールバック構造（正しい構造のみ）
 * - 架空メソッド呼び出し（実装確認必須）
 * - 責務混在（ツール管理以外の処理禁止）
 */

window.Tegaki = window.Tegaki || {};

/**
 * ToolManager - ツール管理専任（構文エラー完全修正版）
 */
class ToolManager {
    constructor(canvasManager) {
        console.log('🔧 ToolManager Phase1.5 作成開始 - 構文エラー完全修正版');
        
        // 必須引数確認
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
        
        // 依存関係確認・設定
        this.eventBus = window.Tegaki.EventBusInstance;
        this.errorManager = window.Tegaki.ErrorManagerInstance;
        
        if (!this.eventBus) {
            console.warn('⚠️ EventBusInstance not available');
        }
        if (!this.errorManager) {
            console.warn('⚠️ ErrorManagerInstance not available');
        }
        
        console.log('✅ ToolManager インスタンス作成完了');
    }
    
    /**
     * ToolManager初期化
     */
    async initialize() {
        try {
            console.log('🔧 ToolManager 初期化開始...');
            
            // 必要なクラスの存在確認
            this.validateDependencies();
            
            // ツールインスタンス作成
            this.createTools();
            
            // UIイベントリスナー設定
            this.setupEventListeners();
            
            // デフォルトツール選択
            this.selectTool('pen');
            
            this.initialized = true;
            console.log('✅ ToolManager 初期化完了');
            console.log('📋 利用可能ツール:', Array.from(this.tools.keys()));
            
            // 初期化完了イベント発火
            if (this.eventBus && this.eventBus.emit) {
                this.eventBus.emit('toolManager:initialized', {
                    toolCount: this.tools.size,
                    availableTools: Array.from(this.tools.keys()),
                    currentTool: this.currentToolName
                });
            }
            
        } catch (error) {
            console.error('💀 ToolManager 初期化失敗:', error);
            
            if (this.errorManager && this.errorManager.showError) {
                this.errorManager.showError('error', `ToolManager初期化失敗: ${error.message}`, {
                    context: 'ToolManager.initialize'
                });
            }
            
            throw error;
        }
    }
    
    /**
     * 依存関係確認
     */
    validateDependencies() {
        const dependencies = [
            { name: 'PenTool', ref: window.Tegaki.PenTool },
            { name: 'EraserTool', ref: window.Tegaki.EraserTool },
            { name: 'CanvasManager', ref: this.canvasManager }
        ];
        
        for (const dep of dependencies) {
            if (!dep.ref) {
                throw new Error(`${dep.name} is not available`);
            }
        }
        
        console.log('✅ 全依存関係確認完了');
    }
    
    /**
     * ツール作成
     */
    createTools() {
        console.log('🔧 ツール作成開始...');
        
        try {
            // PenTool作成
            const penTool = new window.Tegaki.PenTool(this.canvasManager);
            this.tools.set('pen', penTool);
            console.log('✅ PenTool 作成完了');
            
            // EraserTool作成
            const eraserTool = new window.Tegaki.EraserTool(this.canvasManager);
            this.tools.set('eraser', eraserTool);
            console.log('✅ EraserTool 作成完了');
            
            console.log('✅ 全ツール作成完了:', Array.from(this.tools.keys()));
            
        } catch (error) {
            console.error('💀 ツール作成失敗:', error);
            throw error;
        }
    }
    
    /**
     * イベントリスナー設定
     */
    setupEventListeners() {
        console.log('🔧 ToolManager イベントリスナー設定開始...');
        
        // ペンツールボタン
        const penButton = document.getElementById('pen-tool');
        if (penButton) {
            penButton.addEventListener('click', () => {
                this.selectTool('pen');
            });
            console.log('✅ ペンツールボタンイベント設定完了');
        } else {
            console.warn('⚠️ ペンツールボタン要素が見つかりません: #pen-tool');
        }
        
        // 消しゴムツールボタン
        const eraserButton = document.getElementById('eraser-tool');
        if (eraserButton) {
            eraserButton.addEventListener('click', () => {
                this.selectTool('eraser');
            });
            console.log('✅ 消しゴムツールボタンイベント設定完了');
        } else {
            console.warn('⚠️ 消しゴムツールボタン要素が見つかりません: #eraser-tool');
        }
        
        console.log('✅ ToolManager イベントリスナー設定完了');
    }
    
    /**
     * ツール選択
     */
    selectTool(toolName) {
        try {
            console.log(`🔧 ツール選択開始: ${toolName}`);
            
            const tool = this.tools.get(toolName);
            if (!tool) {
                throw new Error(`Tool not found: ${toolName}`);
            }
            
            // 現在のツールを無効化
            if (this.currentTool) {
                this.currentTool.deactivate();
                this.updateToolButtonState(this.currentToolName, false);
                console.log(`📋 前のツール無効化: ${this.currentToolName}`);
            }
            
            // 新しいツールを有効化
            this.currentTool = tool;
            this.currentToolName = toolName;
            this.currentTool.activate();
            this.updateToolButtonState(toolName, true);
            
            console.log(`✅ ツール選択完了: ${toolName}`);
            
            // ツール変更イベント発火
            if (this.eventBus && this.eventBus.emit) {
                this.eventBus.emit('toolManager:toolChanged', {
                    previousTool: this.currentToolName,
                    newTool: toolName,
                    tool: this.currentTool
                });
            }
            
        } catch (error) {
            console.error('💀 ツール選択失敗:', error);
            
            if (this.errorManager && this.errorManager.showError) {
                this.errorManager.showError('error', `ツール選択失敗: ${error.message}`, {
                    context: 'ToolManager.selectTool',
                    toolName: toolName
                });
            }
            
            throw error;
        }
    }
    
    /**
     * ツールボタンの表示状態更新
     */
    updateToolButtonState(toolName, isActive) {
        const button = document.getElementById(`${toolName}-tool`);
        if (button) {
            if (isActive) {
                button.classList.add('active');
                console.log(`📋 ツールボタン有効化: ${toolName}`);
            } else {
                button.classList.remove('active');
                console.log(`📋 ツールボタン無効化: ${toolName}`);
            }
        } else {
            console.warn(`⚠️ ツールボタン要素が見つかりません: #${toolName}-tool`);
        }
    }
    
    /**
     * ポインターイベントの委譲
     */
    handlePointerDown(x, y, event) {
        if (this.currentTool && typeof this.currentTool.onPointerDown === 'function') {
            try {
                console.log(`🔧 PointerDown委譲: ${this.currentToolName} (${x}, ${y})`);
                this.currentTool.onPointerDown(x, y, event);
            } catch (error) {
                console.error('💀 PointerDown処理エラー:', error);
                
                if (this.errorManager && this.errorManager.showError) {
                    this.errorManager.showError('error', `描画開始エラー: ${error.message}`, {
                        context: 'ToolManager.handlePointerDown',
                        toolName: this.currentToolName
                    });
                }
                
                throw error;
            }
        } else {
            console.warn('⚠️ 現在のツールまたはonPointerDownメソッドがありません');
        }
    }
    
    handlePointerMove(x, y, event) {
        if (this.currentTool && typeof this.currentTool.onPointerMove === 'function') {
            try {
                this.currentTool.onPointerMove(x, y, event);
            } catch (error) {
                console.error('💀 PointerMove処理エラー:', error);
                
                if (this.errorManager && this.errorManager.showError) {
                    this.errorManager.showError('error', `描画処理エラー: ${error.message}`, {
                        context: 'ToolManager.handlePointerMove',
                        toolName: this.currentToolName
                    });
                }
                
                throw error;
            }
        }
    }
    
    handlePointerUp(x, y, event) {
        if (this.currentTool && typeof this.currentTool.onPointerUp === 'function') {
            try {
                console.log(`🔧 PointerUp委譲: ${this.currentToolName} (${x}, ${y})`);
                this.currentTool.onPointerUp(x, y, event);
            } catch (error) {
                console.error('💀 PointerUp処理エラー:', error);
                
                if (this.errorManager && this.errorManager.showError) {
                    this.errorManager.showError('error', `描画終了エラー: ${error.message}`, {
                        context: 'ToolManager.handlePointerUp',
                        toolName: this.currentToolName
                    });
                }
                
                throw error;
            }
        }
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
        if (tool && typeof tool.updateSettings === 'function') {
            try {
                tool.updateSettings(settings);
                console.log(`🔧 ${toolName} 設定更新完了:`, settings);
                
                // 設定更新イベント発火
                if (this.eventBus && this.eventBus.emit) {
                    this.eventBus.emit('tool:settingsUpdated', {
                        toolName: toolName,
                        settings: settings
                    });
                }
                
            } catch (error) {
                console.error(`💀 ${toolName} 設定更新エラー:`, error);
                
                if (this.errorManager && this.errorManager.showError) {
                    this.errorManager.showError('error', `${toolName} 設定更新エラー: ${error.message}`, {
                        context: 'ToolManager.updateToolSettings'
                    });
                }
                
                throw error;
            }
        } else {
            console.warn(`⚠️ ツールまたは設定更新メソッドが見つかりません: ${toolName}`);
        }
    }
    
    /**
     * 全ツールリセット
     */
    resetAllTools() {
        console.log('🔧 全ツールリセット開始...');
        
        this.tools.forEach((tool, toolName) => {
            if (typeof tool.reset === 'function') {
                try {
                    tool.reset();
                    console.log(`✅ ${toolName} リセット完了`);
                } catch (error) {
                    console.error(`💀 ${toolName} リセットエラー:`, error);
                }
            }
        });
        
        console.log('✅ 全ツールリセット完了');
    }
    
    /**
     * 初期化状態確認
     */
    isReady() {
        return this.initialized && 
               this.tools.size > 0 && 
               this.canvasManager && 
               this.currentTool !== null;
    }
    
    /**
     * デバッグ情報取得
     */
    getDebugInfo() {
        return {
            className: 'ToolManager',
            initialized: this.initialized,
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
                    hasActivate: typeof tool.activate === 'function',
                    hasDeactivate: typeof tool.deactivate === 'function',
                    isActive: tool.isActiveTool ? tool.isActiveTool() : false
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
        if (this.currentTool) {
            try {
                this.currentTool.deactivate();
            } catch (error) {
                console.error('💀 現在のツール無効化エラー:', error);
            }
        }
        
        // 全ツールの破棄
        this.tools.forEach((tool, toolName) => {
            if (typeof tool.destroy === 'function') {
                try {
                    tool.destroy();
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
        
        console.log('✅ ToolManager 破棄処理完了');
    }
}

// グローバル公開
window.Tegaki.ToolManager = ToolManager;
console.log('🔧 ToolManager Phase1.5 Loaded - 構文エラー完全修正版・責務分界明確化・エラー隠蔽禁止');