/**
 * 🖊️ ToolManager Simple - シンプル版（レイヤー存在確認強化版）
 * 📋 RESPONSIBILITY: ツール選択・イベント転送のみ
 * 🚫 PROHIBITION: 描画処理・座標変換・複雑な状態管理・設定管理
 * ✅ PERMISSION: ツール切り替え・PointerEvent転送・基本的なツール作成
 * 
 * 📏 DESIGN_PRINCIPLE: ツール管理専門・シンプル・直線的
 * 🔄 INTEGRATION: CanvasManager連携のみ（設定はPhase1.5）
 * 🔧 FIX: レイヤー存在確認の追加・エラーハンドリング強化
 */

// if (!window.XXX) ガードで多重定義を防ぐ
if (!window.Tegaki) {
    window.Tegaki = {};
}

if (!window.Tegaki.ToolManager) {
    /**
     * ToolManager - シンプル版（レイヤー確認強化版）
     * ツール切り替えとイベント転送のみに特化
     */
    class ToolManager {
        constructor() {
            console.log('🖊️ ToolManager シンプル版作成（レイヤー確認強化版）');
            
            this.canvasManager = null;
            this.currentTool = null;
            this.currentToolName = 'pen'; // デフォルトツール
            this.tools = new Map();
            
            this.initialized = false;
        }
        
        /**
         * CanvasManager設定（レイヤー確認付き）
         */
        setCanvasManager(canvasManager) {
            if (!canvasManager) {
                throw new Error('CanvasManager is required');
            }
            
            // CanvasManager準備状態確認
            if (!canvasManager.isReady()) {
                throw new Error('CanvasManager is not ready');
            }
            
            // 必要レイヤーの存在確認
            this.verifyRequiredLayers(canvasManager);
            
            this.canvasManager = canvasManager;
            console.log('🖊️ ToolManager - CanvasManager設定・レイヤー確認完了');
            
            // ツール作成（CanvasManagerが必要）
            this.createTools();
        }
        
        /**
         * 必要レイヤー確認（重要：ツール作成前に実行）
         */
        verifyRequiredLayers(canvasManager) {
            const layer0 = canvasManager.getLayer('layer0');
            const layer1 = canvasManager.getLayer('layer1');
            
            if (!layer0) {
                throw new Error('Background layer (layer0) not found - CanvasManager not properly initialized');
            }
            
            if (!layer1) {
                throw new Error('Drawing layer (layer1) not found - CanvasManager not properly initialized');
            }
            
            // レイヤーがStageに正しく配置されているか確認
            const pixiApp = canvasManager.getPixiApp();
            if (!pixiApp || !pixiApp.stage) {
                throw new Error('PixiJS Application or stage not available');
            }
            
            if (layer0.parent !== pixiApp.stage) {
                throw new Error('Background layer (layer0) not attached to stage');
            }
            
            if (layer1.parent !== pixiApp.stage) {
                throw new Error('Drawing layer (layer1) not attached to stage');
            }
            
            console.log('✅ 必要レイヤー確認完了:', {
                layer0Exists: !!layer0,
                layer1Exists: !!layer1,
                layer0InStage: layer0.parent === pixiApp.stage,
                layer1InStage: layer1.parent === pixiApp.stage
            });
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
                } else {
                    console.warn('⚠️ PenTool class not available');
                }
                
                // EraserTool作成
                if (window.Tegaki.EraserTool) {
                    const eraserTool = new window.Tegaki.EraserTool();
                    eraserTool.setCanvasManager(this.canvasManager);
                    this.tools.set('eraser', eraserTool);
                    console.log('✅ EraserTool 作成・設定完了');
                } else {
                    console.warn('⚠️ EraserTool class not available');
                }
                
                // ツール作成確認
                if (this.tools.size === 0) {
                    throw new Error('No tools were created - tool classes not available');
                }
                
                // 初期ツール選択
                const initialToolSelected = this.selectTool(this.currentToolName);
                if (!initialToolSelected) {
                    console.warn(`⚠️ 初期ツール選択失敗: ${this.currentToolName}`);
                }
                
                this.initialized = true;
                console.log(`✅ ToolManager - 全ツール作成完了 (${this.tools.size}個)`);
                
            } catch (error) {
                console.error('❌ ツール作成エラー:', error);
                throw error;
            }
        }
        
        /**
         * ツール選択（レイヤー存在確認強化版）
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
            
            // CanvasManager・レイヤー存在確認
            if (!this.canvasManager) {
                console.error('❌ CanvasManager not available - ツール選択を中断');
                return false;
            }
            
            // 描画ツールの場合はlayer1存在確認
            if (toolName === 'pen' || toolName === 'eraser') {
                const layer1 = this.canvasManager.getLayer('layer1');
                if (!layer1) {
                    console.error('❌ Drawing layer (layer1) が存在しません - ツール選択を中断');
                    return false;
                }
                
                if (!layer1.parent) {
                    console.error('❌ Drawing layer (layer1) がstageに接続されていません - ツール選択を中断');
                    return false;
                }
            }
            
            // 現在のツール変更
            this.currentTool = tool;
            this.currentToolName = toolName;
            
            // アクティブレイヤー設定（描画系ツールの場合）
            if (this.canvasManager && (toolName === 'pen' || toolName === 'eraser')) {
                try {
                    this.canvasManager.setActiveLayer('layer1'); // 描画レイヤーをアクティブに
                } catch (error) {
                    console.error('❌ アクティブレイヤー設定エラー:', error);
                    return false;
                }
            }
            
            console.log(`✅ ツール選択成功: ${toolName} (アクティブレイヤー: ${this.canvasManager?.getActiveLayerId()})`);
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
            } else {
                console.warn(`⚠️ ツール ${this.currentToolName} は onPointerDown をサポートしていません`);
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
         * 初期化状態確認（強化版）
         */
        isReady() {
            return this.initialized && 
                   !!this.canvasManager && 
                   this.canvasManager.isReady() &&
                   this.tools.size > 0 &&
                   !!this.currentTool;
        }
        
        /**
         * デバッグ情報取得
         */
        getDebugInfo() {
            return {
                initialized: this.initialized,
                canvasManagerSet: !!this.canvasManager,
                canvasManagerReady: this.canvasManager?.isReady() || false,
                toolCount: this.tools.size,
                availableTools: this.getAvailableTools(),
                currentTool: this.currentToolName,
                currentToolObject: !!this.currentTool,
                activeLayer: this.canvasManager?.getActiveLayerId() || 'unknown',
                layerStatus: {
                    layer0Exists: !!this.canvasManager?.getLayer('layer0'),
                    layer1Exists: !!this.canvasManager?.getLayer('layer1')
                }
            };
        }
    }
    
    // Tegaki名前空間に登録
    window.Tegaki.ToolManager = ToolManager;
    
    console.log('🖊️ ToolManager シンプル版（レイヤー確認強化版） Loaded');
} else {
    console.log('⚠️ ToolManager already defined - skipping redefinition');
}

console.log('🖊️ tool-manager.js loaded - シンプルツール管理完了（レイヤー確認強化版）');