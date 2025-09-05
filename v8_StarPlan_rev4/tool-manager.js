/**
 * ファイル名: tool-manager.js
 * ToolManager衛星 - ツール登録/選択、描画フロー管理
 * 星型分離版 v8rev8 - 修正版
 */

window.ToolManager = class ToolManager {
    constructor(drawingEngine, layerManager) {
        this.engine = drawingEngine;
        this.layers = layerManager;
        this.currentTool = 'pen';
        this.brushSize = 16.0;
        this.brushColor = 0x800000;
        this.opacity = 0.85;
        this.drawing = { active: false, path: null, lastPoint: null };
        this.mainApi = null;
        this.tools = new Map();
        this.initialized = false;
    }
    
    async register(mainApi) {
        this.mainApi = mainApi;
    }
    
    async initialize() {
        try {
            this.registerBuiltinTools();
            this.log('ToolManager initialized successfully');
            this.initialized = true;
            
        } catch (error) {
            this.reportError('TOOL_INIT_ERROR', 'Failed to initialize tool manager', error);
            throw error;
        }
    }
    
    registerBuiltinTools() {
        // ペンツール
        this.tools.set('pen', {
            name: 'ベクターペン',
            cursor: 'crosshair',
            settings: {
                size: { min: 0.1, max: 100, default: 16.0 },
                opacity: { min: 0, max: 1, default: 0.85 },
                color: { default: 0x800000 }
            },
            start: (x, y, meta) => this.startPenDrawing(x, y, meta),
            move: (x, y, meta) => this.continuePenDrawing(x, y, meta),
            end: (x, y, meta) => this.endPenDrawing(x, y, meta),
            cancel: () => this.cancelDrawing()
        });
        
        // 消しゴムツール
        this.tools.set('eraser', {
            name: '消しゴム',
            cursor: 'cell',
            settings: {
                size: { min: 0.1, max: 100, default: 16.0 }
            },
            start: (x, y, meta) => this.startEraserDrawing(x, y, meta),
            move: (x, y, meta) => this.continueEraserDrawing(x, y, meta),
            end: (x, y, meta) => this.endEraserDrawing(x, y, meta),
            cancel: () => this.cancelDrawing()
        });
        
        this.log('Built-in tools registered');
    }
    
    setActiveTool(toolId) {
        if (!this.tools.has(toolId)) {
            this.log(`Tool ${toolId} not found`);
            return false;
        }
        
        // 現在の描画を中止
        if (this.drawing.active) {
            this.cancelDrawing();
        }
        
        const oldTool = this.currentTool;
        this.currentTool = toolId;
        
        // カーソル変更
        const tool = this.tools.get(toolId);
        const canvas = this.engine?.app?.canvas;
        if (canvas && tool.cursor) {
            canvas.style.cursor = tool.cursor;
        }
        
        this.log(`Tool changed from ${oldTool} to ${toolId}`);
        
        // ツール変更通知
        this.mainApi?.notify('tools', {
            type: 'tool-change',
            oldTool,
            newTool: toolId,
            toolName: tool.name
        });
        
        return true;
    }
    
    startDrawing(x, y, isPanning = false) {
        if (isPanning || this.drawing.active) {
            return false;
        }
        
        try {
            const tool = this.tools.get(this.currentTool);
            if (!tool || !tool.start) {
                this.log(`Tool ${this.currentTool} has no start method`);
                return false;
            }
            
            const meta = {
                tool: this.currentTool,
                size: this.brushSize,
                color: this.brushColor,
                opacity: this.opacity,
                timestamp: Date.now()
            };
            
            const result = tool.start(x, y, meta);
            this.log(`Drawing started with ${this.currentTool} at (${x.toFixed(1)}, ${y.toFixed(1)})`);
            
            return result;
            
        } catch (error) {
            this.reportError('START_DRAWING_ERROR', 'Failed to start drawing', error);
            return false;
        }
    }
    
    continueDrawing(x, y, isPanning = false) {
        if (isPanning || !this.drawing.active) {
            return;
        }
        
        try {
            const tool = this.tools.get(this.currentTool);
            if (!tool || !tool.move) {
                return;
            }
            
            const meta = {
                tool: this.currentTool,
                size: this.brushSize,
                color: this.brushColor,
                opacity: this.opacity,
                timestamp: Date.now()
            };
            
            tool.move(x, y, meta);
            
        } catch (error) {
            this.reportError('CONTINUE_DRAWING_ERROR', 'Failed to continue drawing', error);
        }
    }
    
    stopDrawing() {
        if (!this.drawing.active) {
            return;
        }
        
        try {
            const tool = this.tools.get(this.currentTool);
            if (tool && tool.end) {
                const meta = {
                    tool: this.currentTool,
                    timestamp: Date.now()
                };
                
                tool.end(0, 0, meta); // 座標は不要
            }
            
            this.log(`Drawing stopped with ${this.currentTool}`);
            
        } catch (error) {
            this.reportError('STOP_DRAWING_ERROR', 'Failed to stop drawing', error);
        } finally {
            this.drawing = { active: false, path: null, lastPoint: null };
        }
    }
    
    cancelDrawing() {
        if (!this.drawing.active) {
            return;
        }
        
        try {
            const tool = this.tools.get(this.currentTool);
            if (tool && tool.cancel) {
                tool.cancel();
            }
            
            // 未完成パスの削除
            if (this.drawing.path && this.drawing.path.graphics) {
                const activeLayer = this.layers?.getActiveLayer();
                if (activeLayer) {
                    activeLayer.container.removeChild(this.drawing.path.graphics);
                    this.drawing.path.graphics.destroy();
                    
                    // パス配列からも削除
                    const pathIndex = activeLayer.paths.indexOf(this.drawing.path);
                    if (pathIndex >= 0) {
                        activeLayer.paths.splice(pathIndex, 1);
                    }
                }
            }
            
            this.log(`Drawing cancelled with ${this.currentTool}`);
            
        } catch (error) {
            this.reportError('CANCEL_DRAWING_ERROR', 'Failed to cancel drawing', error);
        } finally {
            this.drawing = { active: false, path: null, lastPoint: null };
        }
    }
    
    // ペンツール実装
    startPenDrawing(x, y, meta) {
        this.drawing.active = true;
        this.drawing.lastPoint = { x, y };
        
        const color = this.brushColor;
        const alpha = this.opacity;
        
        // DrawingEngineのAPI使用に修正
        this.drawing.path = this.engine.getApi().createPath(x, y, this.brushSize, color, alpha);
        
        if (this.drawing.path) {
            // LayerManagerのAPI使用に修正
            this.layers.getApi().addPathToActiveLayer(this.drawing.path);
            return true;
        }
        
        return false;
    }
    
    continuePenDrawing(x, y, meta) {
        if (!this.drawing.path) return;
        
        // DrawingEngineのAPI使用に修正
        this.engine.getApi().extendPath(this.drawing.path, x, y);
        this.drawing.lastPoint = { x, y };
    }
    
    endPenDrawing(x, y, meta) {
        if (this.drawing.path) {
            this.drawing.path.isComplete = true;
        }
    }
    
    // 消しゴムツール実装
    startEraserDrawing(x, y, meta) {
        this.drawing.active = true;
        this.drawing.lastPoint = { x, y };
        
        // 消しゴムは背景色で描画
        const color = 0xf0e0d6; // futaba-cream
        const alpha = 1.0;
        
        // DrawingEngineのAPI使用に修正
        this.drawing.path = this.engine.getApi().createPath(x, y, this.brushSize, color, alpha);
        
        if (this.drawing.path) {
            // LayerManagerのAPI使用に修正
            this.layers.getApi().addPathToActiveLayer(this.drawing.path);
            return true;
        }
        
        return false;
    }
    
    continueEraserDrawing(x, y, meta) {
        if (!this.drawing.path) return;
        
        // DrawingEngineのAPI使用に修正
        this.engine.getApi().extendPath(this.drawing.path, x, y);
        this.drawing.lastPoint = { x, y };
    }
    
    endEraserDrawing(x, y, meta) {
        if (this.drawing.path) {
            this.drawing.path.isComplete = true;
        }
    }
    
    // ツール設定
    setBrushSize(size) {
        const tool = this.tools.get(this.currentTool);
        if (!tool || !tool.settings || !tool.settings.size) {
            return false;
        }
        
        const { min, max } = tool.settings.size;
        this.brushSize = Math.max(min, Math.min(max, Math.round(size * 10) / 10));
        
        this.log(`Brush size set to ${this.brushSize}`);
        return true;
    }
    
    setOpacity(opacity) {
        const tool = this.tools.get(this.currentTool);
        if (!tool || !tool.settings || !tool.settings.opacity) {
            return false;
        }
        
        const { min, max } = tool.settings.opacity;
        this.opacity = Math.max(min, Math.min(max, Math.round(opacity * 1000) / 1000));
        
        this.log(`Opacity set to ${this.opacity}`);
        return true;
    }
    
    setBrushColor(color) {
        this.brushColor = color;
        this.log(`Brush color set to 0x${color.toString(16).padStart(6, '0')}`);
    }
    
    // カスタムツール登録
    registerTool(toolId, toolDefinition) {
        if (this.tools.has(toolId)) {
            this.log(`Tool ${toolId} already exists, overwriting`);
        }
        
        // 必須プロパティチェック
        const required = ['name', 'start', 'move', 'end'];
        const missing = required.filter(prop => !toolDefinition[prop]);
        
        if (missing.length > 0) {
            this.reportError('INVALID_TOOL', `Tool ${toolId} missing required properties: ${missing.join(', ')}`);
            return false;
        }
        
        this.tools.set(toolId, {
            cursor: 'crosshair',
            settings: {},
            cancel: () => this.cancelDrawing(),
            ...toolDefinition
        });
        
        this.log(`Custom tool registered: ${toolId}`);
        return true;
    }
    
    unregisterTool(toolId) {
        if (toolId === 'pen' || toolId === 'eraser') {
            this.log('Cannot unregister built-in tools');
            return false;
        }
        
        if (this.currentTool === toolId) {
            this.setActiveTool('pen');
        }
        
        const result = this.tools.delete(toolId);
        if (result) {
            this.log(`Tool unregistered: ${toolId}`);
        }
        
        return result;
    }
    
    // ツール情報取得
    getToolInfo(toolId = null) {
        if (toolId) {
            const tool = this.tools.get(toolId);
            return tool ? { id: toolId, ...tool } : null;
        }
        
        const toolList = [];
        this.tools.forEach((tool, id) => {
            toolList.push({ id, name: tool.name, cursor: tool.cursor });
        });
        
        return toolList;
    }
    
    getCurrentTool() {
        return {
            id: this.currentTool,
            tool: this.tools.get(this.currentTool),
            settings: {
                brushSize: this.brushSize,
                brushColor: this.brushColor,
                opacity: this.opacity
            }
        };
    }
    
    // ツール統計情報
    getToolStats() {
        return {
            currentTool: this.currentTool,
            totalTools: this.tools.size,
            drawing: this.drawing.active,
            brushSize: this.brushSize,
            opacity: this.opacity,
            brushColor: '0x' + this.brushColor.toString(16).padStart(6, '0')
        };
    }
    
    // 設定のシリアライズ
    serialize() {
        return {
            version: '8.0.8',
            timestamp: Date.now(),
            currentTool: this.currentTool,
            settings: {
                brushSize: this.brushSize,
                brushColor: this.brushColor,
                opacity: this.opacity
            }
        };
    }
    
    // 設定の復元
    deserialize(data) {
        try {
            if (data.currentTool && this.tools.has(data.currentTool)) {
                this.setActiveTool(data.currentTool);
            }
            
            if (data.settings) {
                if (typeof data.settings.brushSize === 'number') {
                    this.setBrushSize(data.settings.brushSize);
                }
                if (typeof data.settings.brushColor === 'number') {
                    this.setBrushColor(data.settings.brushColor);
                }
                if (typeof data.settings.opacity === 'number') {
                    this.setOpacity(data.settings.opacity);
                }
            }
            
            this.log('Settings deserialized successfully');
            return true;
            
        } catch (error) {
            this.reportError('DESERIALIZE_ERROR', 'Failed to deserialize settings', error);
            return false;
        }
    }
    
    // ユーティリティメソッド
    log(message, ...args) {
        const config = this.mainApi?.getConfig();
        if (config?.debug) {
            console.log(`[ToolManager] ${message}`, ...args);
        }
    }
    
    reportError(code, message, error) {
        this.mainApi?.notify('tools', {
            type: 'error',
            code,
            message,
            error: error?.message || error,
            stack: error?.stack,
            timestamp: Date.now(),
            source: 'ToolManager'
        });
    }
    
    // Public API
    getApi() {
        return {
            setActiveTool: (toolId) => this.setActiveTool(toolId),
            startDrawing: (x, y, isPanning) => this.startDrawing(x, y, isPanning),
            continueDrawing: (x, y, isPanning) => this.continueDrawing(x, y, isPanning),
            stopDrawing: () => this.stopDrawing(),
            cancelDrawing: () => this.cancelDrawing(),
            setBrushSize: (size) => this.setBrushSize(size),
            setOpacity: (opacity) => this.setOpacity(opacity),
            setBrushColor: (color) => this.setBrushColor(color),
            registerTool: (toolId, definition) => this.registerTool(toolId, definition),
            unregisterTool: (toolId) => this.unregisterTool(toolId),
            getToolInfo: (toolId) => this.getToolInfo(toolId),
            getCurrentTool: () => this.getCurrentTool(),
            getStats: () => this.getToolStats(),
            serialize: () => this.serialize(),
            deserialize: (data) => this.deserialize(data)
        };
    }
};