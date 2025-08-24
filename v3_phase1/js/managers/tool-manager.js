/**
 * 🖊️ ToolManager Simple - シンプルツール管理
 * 📋 RESPONSIBILITY: ツール選択・ツールへのイベント配信のみ
 * 🚫 PROHIBITION: 描画処理・座標変換・複雑な状態管理
 * ✅ PERMISSION: ツール切り替え・イベント転送・ツール作成
 * 
 * 📏 DESIGN_PRINCIPLE: 単純・直線的・ツール配信専門
 * 🔄 INTEGRATION: 選択されたツールにイベントを転送
 */

// Tegaki名前空間初期化
window.Tegaki = window.Tegaki || {};

/**
 * ToolManager - シンプル版（30行以内）
 * ツール管理の専任
 */
class ToolManager {
    constructor() {
        console.log('🖊️ ToolManager Simple 作成');
        
        this.canvasManager = null;
        this.currentTool = null;
        this.currentToolName = 'pen';
        
        // 利用可能ツール
        this.tools = new Map();
        
        // ツール作成
        this.createTools();
    }
    
    /**
     * CanvasManager設定
     */
    setCanvasManager(canvasManager) {
        this.canvasManager = canvasManager;
        
        // 既存ツールにもCanvasManager設定
        this.tools.forEach(tool => {
            if (tool.setCanvasManager) {
                tool.setCanvasManager(canvasManager);
            }
        });
        
        console.log('✅ ToolManager - CanvasManager設定完了');
    }
    
    /**
     * ツール作成
     */
    createTools() {
        // ペンツール作成
        if (window.Tegaki?.PenTool) {
            this.tools.set('pen', new window.Tegaki.PenTool());
        }
        
        // 消しゴムツール作成
        if (window.Tegaki?.EraserTool) {
            this.tools.set('eraser', new window.Tegaki.EraserTool());
        }
        
        // デフォルトツール設定
        this.currentTool = this.tools.get('pen');
        
        console.log(`✅ ツール作成完了: ${this.tools.size}個`);
    }
    
    /**
     * ツール選択
     */
    selectTool(toolName) {
        const tool = this.tools.get(toolName);
        if (!tool) {
            throw new Error(`Tool ${toolName} not found`);
        }
        
        this.currentTool = tool;
        this.currentToolName = toolName;
        
        // CanvasManager設定
        if (this.canvasManager && tool.setCanvasManager) {
            tool.setCanvasManager(this.canvasManager);
        }
        
        console.log(`✅ ツール選択: ${toolName}`);
    }
    
    /**
     * ポインターイベント転送
     */
    handlePointerDown(x, y, event) {
        if (this.currentTool?.onPointerDown) {
            this.currentTool.onPointerDown(x, y, event);
        }
    }
    
    handlePointerMove(x, y, event) {
        if (this.currentTool?.onPointerMove) {
            this.currentTool.onPointerMove(x, y, event);
        }
    }
    
    handlePointerUp(x, y, event) {
        if (this.currentTool?.onPointerUp) {
            this.currentTool.onPointerUp(x, y, event);
        }
    }
    
    /**
     * 現在のツール取得
     */
    getCurrentTool() {
        return this.currentTool;
    }
    
    getCurrentToolName() {
        return this.currentToolName;
    }
}

// Tegaki名前空間に登録
window.Tegaki.ToolManager = ToolManager;

console.log('🖊️ ToolManager Simple Loaded - シンプルツール管理');