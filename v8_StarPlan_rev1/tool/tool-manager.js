/**
 * tool-manager.js - ToolManager 衛星
 * ツール登録/選択、Toolインターフェース提供
 */

window.MyApp = window.MyApp || {};

window.MyApp.ToolManager = class ToolManager {
    constructor() {
        this.mainController = null;
        this.tools = new Map();
        this.activeTool = null;
        this.activeToolId = 'brush';
        this.drawing = {
            active: false,
            startPoint: null,
            currentStroke: null
        };
        this.debug = false;
    }

    // 主星との接続
    async register(mainController) {
        this.mainController = mainController;
        this.debug = window.MyApp.config?.debug || false;
        
        try {
            await this.initialize();
            if (this.debug) console.log('[ToolManager] Registered with MainController');
            return true;
        } catch (error) {
            this.reportError('TOOL_MANAGER_INIT_ERROR', 'Failed to initialize ToolManager', {
                error: error.message
            });
            throw error;
        }
    }

    // ツールマネージャー初期化
    async initialize() {
        // 利用可能なツールを登録
        await this.registerAvailableTools();
        
        // デフォルトツールを設定
        this.setActiveTool(this.activeToolId);
        
        // 描画イベントリスナー設定
        this.setupDrawingEvents();
    }

    // 利用可能ツールの登録
    async registerAvailableTools() {
        const toolClasses = [
            'BrushTool',
            'EraserTool',
            'TransformTool'
        ];
        
        for (const toolClassName of toolClasses) {
            const ToolClass = window.MyApp[toolClassName];
            if (ToolClass) {
                const tool = new ToolClass();
                if (tool.register) {
                    await tool.register(this.mainController);
                }
                this.registerTool(tool);
                
                if (this.debug) console.log(`[ToolManager] Registered tool: ${tool.id}`);
            } else {
                console.warn(`[ToolManager] Tool class ${toolClassName} not found`);
            }
        }
    }

    // ツール登録
    registerTool(tool) {
        if (!tool || !tool.id) {
            this.reportError('INVALID_TOOL', 'Invalid tool provided for registration', { tool });
            return false;
        }
        
        // 必須メソッドの存在確認
        const requiredMethods = ['start', 'move', 'end', 'cancel', 'serialize'];
        for (const method of requiredMethods) {
            if (typeof tool[method] !== 'function') {
                this.reportError('TOOL_MISSING_METHOD', `Tool ${tool.id} missing required method: ${method}`, {
                    toolId: tool.id, method
                });
                return false;
            }
        }
        
        this.tools.set(tool.id, tool);
        return true;
    }

    // アクティブツール設定
    setActiveTool(toolId) {
        const tool = this.tools.get(toolId);
        if (!tool) {
            this.reportError('TOOL_NOT_FOUND', `Tool ${toolId} not found`, { 
                toolId, 
                availableTools: Array.from(this.tools.keys()) 
            });
            return false;
        }
        
        // 現在の描画を中断
        if (this.drawing.active && this.activeTool) {
            this.cancelDrawing();
        }
        
        this.activeTool = tool;
        this.activeToolId = toolId;
        
        // MainController に通知
        this.mainController.notify({
            type: 'tool_changed',
            payload: {
                toolId: toolId,
                toolData: this.getActiveToolData(),
                recordHistory: false // ツール変更は履歴に記録しない
            }
        });
        
        if (this.debug) console.log(`[ToolManager] Active tool set to: ${toolId}`);
        return true;
    }

    // 描画イベント設定
    setupDrawingEvents() {
        // DrawingEngine からの描画イベントをリッスン
        // MainController が仲介するので、直接イベントは受け取らない
        
        // 代わりに MainController からの通知を処理する仕組みを作る
        // これは initialize 後に MainController が呼び出す
    }

    // 描画開始
    startDrawing(point, meta = {}) {
        if (this.drawing.active) {
            this.cancelDrawing();
        }
        
        if (!this.activeTool) {
            this.reportError('NO_ACTIVE_TOOL', 'No active tool for drawing', { point, meta });
            return false;
        }
        
        try {
            // レイヤーサービスからアクティブレイヤー取得
            const layerService = this.mainController.getSatellite('LayerService');
            if (!layerService) {
                throw new Error('LayerService not available');
            }
            
            const activeLayer = layerService.getActiveLayer();
            if (!activeLayer) {
                throw new Error('No active layer');
            }
            
            // ツール開始
            const result = this.activeTool.start(point, {
                ...meta,
                layerId: activeLayer.id,
                layerName: activeLayer.name
            });
            
            if (result !== false) {
                this.drawing.active = true;
                this.drawing.startPoint = point;
                this.drawing.currentStroke = result;
                
                if (this.debug) console.log(`[ToolManager] Drawing started with ${this.activeToolId}`);
            }
            
            return result;
            
        } catch (error) {
            this.reportError('DRAWING_START_ERROR', 'Failed to start drawing', {
                toolId: this.activeToolId, point, meta, error: error.message
            });
            return false;
        }
    }

    // 描画継続
    continueDrawing(point, meta = {}) {
        if (!this.drawing.active || !this.activeTool) {
            return false;
        }
        
        try {
            const result = this.activeTool.move(point, {
                ...meta,
                strokeData: this.drawing.currentStroke
            });
            
            return result;
            
        } catch (error) {
            this.reportError('DRAWING_CONTINUE_ERROR', 'Failed to continue drawing', {
                toolId: this.activeToolId, point, meta, error: error.message
            });
            this.cancelDrawing();
            return false;
        }
    }

    // 描画終了
    endDrawing(point, meta = {}) {
        if (!this.drawing.active || !this.activeTool) {
            return false;
        }
        
        try {
            const result = this.activeTool.end(point, {
                ...meta,
                strokeData: this.drawing.currentStroke
            });
            
            // 描画状態リセット
            const strokeData = this.drawing.currentStroke;
            this.drawing = {
                active: false,
                startPoint: null,
                currentStroke: null
            };
            
            // HistoryService用のストロークデータを MainController に通知
            if (result !== false && strokeData) {
                this.mainController.notify({
                    type: 'drawing_ended',
                    payload: {
                        event: 'drawing_ended',
                        point: point,
                        meta: {
                            strokeData: this.activeTool.serialize ? this.activeTool.serialize() : strokeData
                        }
                    }
                });
            }
            
            if (this.debug) console.log(`[ToolManager] Drawing ended with ${this.activeToolId}`);
            return result;
            
        } catch (error) {
            this.reportError('DRAWING_END_ERROR', 'Failed to end drawing', {
                toolId: this.activeToolId, point, meta, error: error.message
            });
            this.cancelDrawing();
            return false;
        }
    }

    // 描画キャンセル
    cancelDrawing() {
        if (!this.drawing.active || !this.activeTool) {
            return;
        }
        
        try {
            this.activeTool.cancel({
                strokeData: this.drawing.currentStroke
            });
            
            this.drawing = {
                active: false,
                startPoint: null,
                currentStroke: null
            };
            
            if (this.debug) console.log(`[ToolManager] Drawing cancelled with ${this.activeToolId}`);
            
        } catch (error) {
            this.reportError('DRAWING_CANCEL_ERROR', 'Failed to cancel drawing', {
                toolId: this.activeToolId, error: error.message
            });
            
            // 強制リセット
            this.drawing = {
                active: false,
                startPoint: null,
                currentStroke: null
            };
        }
    }

    // MainController からの描画イベント処理
    handleDrawingEvent(eventType, point, meta) {
        switch (eventType) {
            case 'drawing_started':
                return this.startDrawing(point, meta);
                
            case 'drawing_continued':
                return this.continueDrawing(point, meta);
                
            case 'drawing_ended':
                return this.endDrawing(point, meta);
                
            default:
                if (this.debug) console.warn(`[ToolManager] Unknown drawing event: ${eventType}`);
                return false;
        }
    }

    // アクティブツール取得
    getActiveTool() {
        return this.activeTool;
    }

    // アクティブツールID取得
    getActiveToolId() {
        return this.activeToolId;
    }

    // アクティブツールデータ取得
    getActiveToolData() {
        if (!this.activeTool) return null;
        
        return {
            id: this.activeTool.id,
            name: this.activeTool.name || this.activeTool.id,
            settings: this.activeTool.getSettings ? this.activeTool.getSettings() : {}
        };
    }

    // 全ツール取得
    getAllTools() {
        return Array.from(this.tools.values());
    }

    // ツール設定更新
    updateToolSettings(toolId, settings) {
        const tool = this.tools.get(toolId);
        if (!tool) {
            this.reportError('TOOL_NOT_FOUND', `Tool ${toolId} not found for settings update`, {
                toolId, settings
            });
            return false;
        }
        
        if (tool.updateSettings) {
            try {
                tool.updateSettings(settings);
                if (this.debug) console.log(`[ToolManager] Updated settings for ${toolId}:`, settings);
                return true;
            } catch (error) {
                this.reportError('TOOL_SETTINGS_ERROR', `Failed to update settings for ${toolId}`, {
                    toolId, settings, error: error.message
                });
                return false;
            }
        }
        
        return false;
    }

    // 描画状態取得
    getDrawingState() {
        return {
            active: this.drawing.active,
            toolId: this.activeToolId,
            startPoint: this.drawing.startPoint,
            hasCurrentStroke: !!this.drawing.currentStroke
        };
    }

    // 統計情報取得
    getStats() {
        return {
            totalTools: this.tools.size,
            activeToolId: this.activeToolId,
            drawingState: this.getDrawingState(),
            availableTools: Array.from(this.tools.keys())
        };
    }

    // エラー報告ヘルパー
    reportError(code, message, context) {
        if (this.mainController) {
            this.mainController.notify({
                type: 'error',
                payload: { code, message, context }
            });
        } else {
            console.error(`[ToolManager] ${code}: ${message}`, context);
        }
    }

    // 破棄処理
    destroy() {
        try {
            // 現在の描画をキャンセル
            if (this.drawing.active) {
                this.cancelDrawing();
            }
            
            // 各ツールの破棄処理
            this.tools.forEach(tool => {
                if (tool.destroy) {
                    tool.destroy();
                }
            });
            
            this.tools.clear();
            this.activeTool = null;
            this.activeToolId = null;
            this.drawing = {
                active: false,
                startPoint: null,
                currentStroke: null
            };
            
            if (this.debug) console.log('[ToolManager] Destroyed');
            
        } catch (error) {
            this.reportError('TOOL_MANAGER_DESTROY_ERROR', 'Failed to destroy tool manager', {
                error: error.message
            });
        }
    }
};