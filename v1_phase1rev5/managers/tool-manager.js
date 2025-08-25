/**
 * 🖊️ ToolManager Simple - シンプル版（剛直設計）
 * 📋 RESPONSIBILITY: ツール選択・イベント転送のみ
 * 🚫 PROHIBITION: 描画処理・座標変換・複雑な状態管理・設定管理
 * ✅ PERMISSION: ツール切り替え・PointerEvent転送・基本的なツール作成
 * 
 * 📏 DESIGN_PRINCIPLE: ツール管理専門・シンプル・直線的
 * 🔄 INTEGRATION: CanvasManager連携のみ（設定はPhase1.5）
 */

// if (!window.XXX) ガードで多重定義を防ぐ
if (!window.Tegaki) {
    window.Tegaki = {};
}

if (!window.Tegaki.ToolManager) {
    /**
     * ToolManager - シンプル版（Phase1剛直設計）
     * ツール切り替えとイベント転送のみに特化
     */
    class ToolManager {
        constructor() {
            console.log('🖊️ ToolManager シンプル版作成');
            
            this.canvasManager = null;
            this.currentTool = null;
            this.currentToolName = 'pen'; // デフォルトツール
            this.tools = new Map();
            
            this.initialized = false;
        }
        
        /**
         * CanvasManager設定
         */
        setCanvasManager(canvasManager) {
            if (!canvasManager) {
                throw new Error('CanvasManager is required');
            }
            
            this.canvasManager = canvasManager;
            console.log('🖊️ ToolManager - CanvasManager設定完了');
            
            // ツール作成（CanvasManagerが必要）
            this.createTools();
        }
        
        /**
         * ツール作成
         */
        createTools() {
            if (!this.canvasManager) {
                console.warn('⚠️ CanvasManager not set - tools creation postponed');
                return;
            }
            
            try {
                // PenTool作成
                if (window.Tegaki.PenTool) {
                    const penTool = new window.Tegaki.PenTool();
                    penTool.setCanvasManager(this.canvasManager);
                    this.tools.set('pen', penTool);
                    console.log('✅ PenTool 作成・設定完了');
                }
                
                // EraserTool作成
                if (window.Tegaki.EraserTool) {
                    const eraserTool = new window.Tegaki.EraserTool();
                    eraserTool.setCanvasManager(this.canvasManager);
                    this.tools.set('eraser', eraserTool);
                    console.log('✅ EraserTool 作成・設定完了');
                }
                
                // 初期ツール選択
                this.selectTool(this.currentToolName);
                
                this.initialized = true;
                console.log(`✅ ToolManager - 全ツール作成完了 (${this.tools.size}個)`);
                
            } catch (error) {
                console.error('❌ ツール作成エラー:', error);
                throw error;
            }
        }
        
        /**
         * ツール選択
         */
        selectTool(toolName) {
            if (!toolName) {
                console.warn('⚠️ ツール名が指定されていません');
                return false;
            }
            
            const tool = this.tools.get(toolName);
            if (!tool) {
                console.warn(`⚠️ 未知のツール: ${toolName}`);
                return false;
            }
            
            // 現在のツール変更
            this.currentTool = tool;
            this.currentToolName = toolName;
            
            // アクティブレイヤー設定（描画系ツールの場合）
            if (this.canvasManager && (toolName === 'pen' || toolName === 'eraser')) {
                this.canvasManager.setActiveLayer('layer1'); // 描画レイヤーをアクティブに
            }
            
            console.log(`✅ ツール選択: ${toolName} (アクティブレイヤー: ${this.canvasManager?.getActiveLayerId()})`);
            return true;
        }
        
        /**
         * 現在ツール取得
         */
        getCurrentTool() {
            return this.currentTool;
        }
        
        /**
         * 現在ツール名取得
         */
        getCurrentToolName() {
            return this.currentToolName;
        }
        
        /**
         * PointerDown イベント転送
         */
        handlePointerDown(x, y, event) {
            if (!this.currentTool) {
                console.warn('⚠️ アクティブツールがありません');
                return;
            }
            
            if (this.currentTool.onPointerDown) {
                try {
                    this.currentTool.onPointerDown(x, y, event);
                } catch (error) {
                    console.error(`❌ PointerDown処理エラー [${this.currentToolName}]:`, error);
                }
            }
        }
        
        /**
         * PointerMove イベント転送
         */
        handlePointerMove(x, y, event) {
            if (!this.currentTool) return;
            
            if (this.currentTool.onPointerMove) {
                try {
                    this.currentTool.onPointerMove(x, y, event);
                } catch (error) {
                    console.error(`❌ PointerMove処理エラー [${this.currentToolName}]:`, error);
                }
            }
        }
        
        /**
         * PointerUp イベント転送
         */
        handlePointerUp(x, y, event) {
            if (!this.currentTool) return;
            
            if (this.currentTool.onPointerUp) {
                try {
                    this.currentTool.onPointerUp(x, y, event);
                } catch (error) {
                    console.error(`❌ PointerUp処理エラー [${this.currentToolName}]:`, error);
                }
            }
        }
        
        /**
         * 利用可能ツール一覧取得
         */
        getAvailableTools() {
            return Array.from(this.tools.keys());
        }
        
        /**
         * ツール情報取得
         */
        getToolInfo(toolName) {
            const tool = this.tools.get(toolName);
            if (!tool) return null;
            
            return {
                name: toolName,
                available: true,
                active: toolName === this.currentToolName,
                debugInfo: tool.getDebugInfo ? tool.getDebugInfo() : null
            };
        }
        
        /**
         * 初期化状態確認
         */
        isReady() {
            return this.initialized && 
                   !!this.canvasManager && 
                   this.tools.size > 0;
        }
        
        /**
         * デバッグ情報取得
         */
        getDebugInfo() {
            return {
                initialized: this.initialized,
                canvasManagerSet: !!this.canvasManager,
                toolCount: this.tools.size,
                availableTools: this.getAvailableTools(),
                currentTool: this.currentToolName,
                activeLayer: this.canvasManager?.getActiveLayerId() || 'unknown'
            };
        }
    }
    
    // Tegaki名前空間に登録
    window.Tegaki.ToolManager = ToolManager;
    
    console.log('🖊️ ToolManager シンプル版 Loaded');
} else {
    console.log('⚠️ ToolManager already defined - skipping redefinition');
}

console.log('🖊️ tool-manager.js loaded - シンプルツール管理完了');