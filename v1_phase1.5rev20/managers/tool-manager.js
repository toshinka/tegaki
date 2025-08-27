/**
 * 🔧 ToolManager Phase1.5 - ペン/消しゴムツール管理（架空メソッド完全修正版）
 * 📋 RESPONSIBILITY: ツール管理・切り替え・イベント委譲のみ
 * 🚫 PROHIBITION: 描画処理・Canvas管理・複雑な初期化・設定管理
 * ✅ PERMISSION: ツール作成・選択・イベント転送・状態管理
 * 
 * 📏 DESIGN_PRINCIPLE: ツール専任管理・責務分離・単純構造
 * 🔄 INTEGRATION: PenTool・EraserTool管理・EventBus通信・ErrorManager報告
 * 🔧 FIX: ErrorManagerインスタンス参照修正・架空メソッド削除・setCanvasManager削除
 * 
 * 📌 使用メソッド一覧:
 * ✅ window.Tegaki.PenTool(constructor) - ペンツール作成（pen-tool.js）
 * ✅ window.Tegaki.EraserTool(constructor) - 消しゴムツール作成（eraser-tool.js）  
 * ✅ window.Tegaki.ErrorManagerInstance.showError() - エラー表示（実在メソッド）
 * ✅ window.Tegaki.EventBusInstance.emit() - イベント発火（実在メソッド）
 * ✅ tool.activate() - ツール有効化（abstract-tool.js継承メソッド）
 * ✅ tool.deactivate() - ツール無効化（abstract-tool.js継承メソッド）
 * ❌ handleError() - 削除（架空メソッド）
 * ❌ setCanvasManager() - 削除（不要・コンストラクタで設定）
 * 
 * 📐 ツール管理フロー:
 * 開始 → ツール作成 → デフォルト選択 → ツール切り替え → イベント委譲 → 終了
 * 依存関係: PenTool・EraserTool(実装)・EventBusInstance(通信)・ErrorManagerInstance(報告)
 */

window.Tegaki = window.Tegaki || {};

/**
 * ToolManager - ツール管理専任（架空メソッド完全修正版）
 */
class ToolManager {
    constructor(canvasManager) {
        console.log('🔧 ToolManager Phase1.5 作成開始 - 架空メソッド完全修正版');
        
        this.canvasManager = canvasManager;
        this.tools = new Map();
        this.activeTool = null;
        this.isInitialized = false;
        
        // 🔧 修正: インスタンス参照（クラス参照ではなく）
        this.eventBus = window.Tegaki.EventBusInstance;
        this.errorManager = window.Tegaki.ErrorManagerInstance;
        
        // 初期化を自動実行（Promiseベース）
        this.initialize()
            .then(() => {
                console.log('✅ ToolManager 初期化完了');
            })
            .catch(error => {
                console.error('💀 ToolManager 初期化失敗:', error);
                
                // 🔧 修正: 実在メソッド使用（架空のhandleErrorではなく）
                if (this.errorManager && this.errorManager.showError) {
                    this.errorManager.showError('error', `ToolManager初期化失敗: ${error.message}`, {
                        context: 'ToolManager.constructor'
                    });
                }
            });
    }
    
    /**
     * ToolManager初期化（Promiseベース）
     */
    initialize() {
        return new Promise((resolve, reject) => {
            try {
                console.log('🔧 ToolManager 初期化開始...');
                
                // 必要なクラスの存在確認
                if (!window.Tegaki.PenTool) {
                    throw new Error('PenTool class not available');
                }
                if (!window.Tegaki.EraserTool) {
                    throw new Error('EraserTool class not available');
                }
                
                // CanvasManager確認
                if (!this.canvasManager) {
                    throw new Error('CanvasManager is required');
                }
                
                // ツールインスタンス作成
                this.createToolInstances();
                
                // イベントリスナー設定
                this.setupEventListeners();
                
                // デフォルトツール選択
                this.selectTool('pen');
                
                this.isInitialized = true;
                console.log('✅ ToolManager 初期化完了 - 利用可能ツール:', Array.from(this.tools.keys()));
                
                // イベント発火
                if (this.eventBus && this.eventBus.emit) {
                    this.eventBus.emit('toolManager:initialized', {
                        tools: Array.from(this.tools.keys()),
                        activeTool: this.activeTool ? this.activeTool.getName() : null
                    });
                }
                
                resolve();
                
            } catch (error) {
                console.error('💀 ToolManager 初期化失敗:', error);
                
                // 🔧 修正: 実在メソッド使用
                if (this.errorManager && this.errorManager.showError) {
                    this.errorManager.showError('error', `ToolManager初期化失敗: ${error.message}`, {
                        context: 'ToolManager.initialize'
                    });
                }
                
                reject(error);
            }
        });
    }
    
    /**
     * ツールインスタンス作成
     */
    createToolInstances() {
        console.log('🔧 ツールインスタンス作成開始...');
        
        try {
            // PenTool作成
            const penTool = new window.Tegaki.PenTool(this.canvasManager);
            this.tools.set('pen', penTool);
            console.log('✅ PenTool インスタンス作成完了');
            
            // EraserTool作成
            const eraserTool = new window.Tegaki.EraserTool(this.canvasManager);
            this.tools.set('eraser', eraserTool);
            console.log('✅ EraserTool インスタンス作成完了');
            
            console.log('✅ 全ツールインスタンス作成完了');
            
        } catch (error) {
            console.error('💀 ツールインスタンス作成失敗:', error);
            throw error;
        }
    }
    
    /**
     * イベントリスナー設定
     */
    setupEventListeners() {
        console.log('🔧 ToolManager イベントリスナー設定開始...');
        
        // ツールボタンクリックイベント
        const penButton = document.getElementById('pen-tool');
        const eraserButton = document.getElementById('eraser-tool');
        
        if (penButton) {
            penButton.addEventListener('click', () => {
                this.selectTool('pen');
            });
        }
        
        if (eraserButton) {
            eraserButton.addEventListener('click', () => {
                this.selectTool('eraser');
            });
        }
        
        console.log('✅ ToolManager イベントリスナー設定完了');
    }
    
    /**
     * ツール選択
     */
    selectTool(toolName) {
        try {
            console.log(`🔧 ツール選択: ${toolName}`);
            
            const tool = this.tools.get(toolName);
            if (!tool) {
                throw new Error(`Tool not found: ${toolName}`);
            }
            
            // 前のツールを無効化
            if (this.activeTool) {
                this.activeTool.deactivate();
                this.updateToolButtonState(this.activeTool.getName(), false);
            }
            
            // 新しいツールを有効化
            this.activeTool = tool;
            this.activeTool.activate();
            this.updateToolButtonState(toolName, true);
            
            console.log(`✅ ツール選択完了: ${toolName}`);
            
            // イベント発火
            if (this.eventBus && this.eventBus.emit) {
                this.eventBus.emit('toolManager:toolChanged', {
                    toolName: toolName,
                    tool: this.activeTool
                });
            }
            
        } catch (error) {
            console.error('💀 ツール選択失敗:', error);
            
            // 🔧 修正: 実在メソッド使用（架空のhandleErrorではなく）
            if (this.errorManager && this.errorManager.showError) {
                this.errorManager.showError('error', `ツール選択失敗: ${error.message}`, {
                    context: 'ToolManager.selectTool'
                });
            }
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
            } else {
                button.classList.remove('active');
            }
        }
    }
    
    /**
     * アクティブツール取得
     */
    getActiveTool() {
        return this.activeTool;
    }
    
    /**
     * 利用可能ツール一覧取得
     */
    getAvailableTools() {
        return Array.from(this.tools.keys());
    }
    
    /**
     * マウス/タッチイベントの委譲
     */
    handlePointerDown(event) {
        if (this.activeTool && this.activeTool.handlePointerDown) {
            try {
                this.activeTool.handlePointerDown(event);
            } catch (error) {
                console.error('💀 PointerDown処理エラー:', error);
                
                // 🔧 修正: 実在メソッド使用
                if (this.errorManager && this.errorManager.showError) {
                    this.errorManager.showError('error', `PointerDown処理エラー: ${error.message}`, {
                        context: 'ToolManager.handlePointerDown'
                    });
                }
            }
        }
    }
    
    handlePointerMove(event) {
        if (this.activeTool && this.activeTool.handlePointerMove) {
            try {
                this.activeTool.handlePointerMove(event);
            } catch (error) {
                console.error('💀 PointerMove処理エラー:', error);
            }
        }
    }
    
    handlePointerUp(event) {
        if (this.activeTool && this.activeTool.handlePointerUp) {
            try {
                this.activeTool.handlePointerUp(event);
            } catch (error) {
                console.error('💀 PointerUp処理エラー:', error);
                
                // 🔧 修正: 実在メソッド使用
                if (this.errorManager && this.errorManager.showError) {
                    this.errorManager.showError('error', `PointerUp処理エラー: ${error.message}`, {
                        context: 'ToolManager.handlePointerUp'
                    });
                }
            }
        }
    }
    
    /**
     * ツール設定変更
     */
    updateToolSettings(toolName, settings) {
        const tool = this.tools.get(toolName);
        if (tool && tool.updateSettings) {
            try {
                tool.updateSettings(settings);
                console.log(`🔧 ${toolName} 設定更新完了:`, settings);
            } catch (error) {
                console.error(`💀 ${toolName} 設定更新エラー:`, error);
                
                // 🔧 修正: 実在メソッド使用
                if (this.errorManager && this.errorManager.showError) {
                    this.errorManager.showError('error', `${toolName} 設定更新エラー: ${error.message}`, {
                        context: 'ToolManager.updateToolSettings'
                    });
                }
            }
        }
    }
    
    /**
     * 全ツールリセット
     */
    resetAllTools() {
        this.tools.forEach((tool, toolName) => {
            if (tool.reset) {
                try {
                    tool.reset();
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
        return this.isInitialized && this.tools.size > 0 && this.canvasManager;
    }
    
    /**
     * デバッグ情報取得
     */
    getDebugInfo() {
        return {
            initialized: this.isInitialized,
            toolCount: this.tools.size,
            availableTools: Array.from(this.tools.keys()),
            activeTool: this.activeTool ? this.activeTool.getName() : null,
            hasCanvasManager: !!this.canvasManager,
            hasEventBus: !!this.eventBus,
            hasErrorManager: !!this.errorManager
        };
    }
    
    /**
     * 破棄処理
     */
    destroy() {
        console.log('🔧 ToolManager 破棄処理開始...');
        
        // 全ツールの破棄
        this.tools.forEach(tool => {
            if (tool.destroy) {
                try {
                    tool.destroy();
                } catch (error) {
                    console.error('💀 ツール破棄エラー:', error);
                }
            }
        });
        
        this.tools.clear();
        this.activeTool = null;
        this.isInitialized = false;
        
}

// グローバル公開
window.Tegaki.ToolManager = ToolManager;
console.log('🔧 ToolManager Phase1.5 Loaded - 架空メソッド完全修正版');