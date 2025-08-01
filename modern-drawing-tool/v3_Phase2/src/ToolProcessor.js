// ToolProcessor.js - ツール処理統合（Phase2・封印解除時実装）

/**
 * 🎨 ツール処理統合（Phase2・封印解除時実装）
 * 責務: ペン・消しゴム・エアスプレー詳細実装、ボカシ・スポイト・塗りつぶし処理、基本範囲選択実装、ツール設定管理・切り替え
 */
export class ToolProcessor {
    constructor(oglEngine, eventStore) {
        this.engine = oglEngine;
        this.eventStore = eventStore;
        
        // ツール定義
        this.tools = new Map();
        this.currentTool = null;
        this.toolSettings = new Map();
        
        // ツール状態
        this.isToolActive = false;
        this.toolContext = null;
        
        // 初期化
        this.initializeTools();
        this.subscribeToEvents();
        
        console.log('✅ ToolProcessor初期化完了');
    }
    
    /**
     * ツール初期化
     */
    initializeTools() {
        // 🖌️ ペンツール
        this.registerTool('pen', {
            name: 'ペン',
            icon: '✏️',
            category: 'drawing',
            settings: {
                size: { value: 2, min: 1, max: 100, step: 1 },
                opacity: { value: 1.0, min: 0.1, max: 1.0, step: 0.1 },
                pressure: { value: true },
                smoothing: { value: 0.3, min: 0, max: 1.0, step: 0.1 }
            },
            onActivate: () => this.activatePenTool(),
            onDeactivate: () => this.deactivatePenTool(),
            onStrokeStart: (point, pressure) => this.handleEraserStrokeStart(point, pressure),
            onStrokeMove: (point, pressure) => this.handleEraserStrokeMove(point, pressure),
            onStrokeEnd: (point, pressure) => this.handleEraserStrokeEnd(point, pressure)
        });
        
        // 🖌️ エアスプレーツール
        this.registerTool('airspray', {
            name: 'エアスプレー',
            icon: '🖌️',
            category: 'drawing',
            settings: {
                size: { value: 20, min: 5, max: 200, step: 1 },
                opacity: { value: 0.7, min: 0.1, max: 1.0, step: 0.1 },
                density: { value: 0.6, min: 0.1, max: 1.0, step: 0.1 },
                flow: { value: 0.8, min: 0.1, max: 1.0, step: 0.1 },
                pressure: { value: true }
            },
            onActivate: () => this.activateAirsprayTool(),
            onDeactivate: () => this.deactivateAirsprayTool(),
            onStrokeStart: (point, pressure) => this.handleAirsprayStrokeStart(point, pressure),
            onStrokeMove: (point, pressure) => this.handleAirsprayStrokeMove(point, pressure),
            onStrokeEnd: (point, pressure) => this.handleAirsprayStrokeEnd(point, pressure)
        });
        
        // 🌫️ ボカシツール
        this.registerTool('blur', {
            name: 'ボカシ',
            icon: '🌫️',
            category: 'effect',
            settings: {
                size: { value: 15, min: 5, max: 100, step: 1 },
                strength: { value: 0.5, min: 0.1, max: 1.0, step: 0.1 },
                type: { value: 'gaussian', options: ['gaussian', 'motion', 'radial'] },
                edgeProtection: { value: false }
            },
            onActivate: () => this.activateBlurTool(),
            onDeactivate: () => this.deactivateBlurTool(),
            onStrokeStart: (point, pressure) => this.handleBlurStrokeStart(point, pressure),
            onStrokeMove: (point, pressure) => this.handleBlurStrokeMove(point, pressure),
            onStrokeEnd: (point, pressure) => this.handleBlurStrokeEnd(point, pressure)
        });
        
        // 💧 スポイトツール
        this.registerTool('eyedropper', {
            name: 'スポイト',
            icon: '💧',
            category: 'utility',
            settings: {
                sampleSize: { value: 1, min: 1, max: 11, step: 2 }, // 1x1, 3x3, 5x5...
                showPreview: { value: true },
                autoSwitch: { value: true } // 色取得後に前のツールに戻る
            },
            onActivate: () => this.activateEyedropperTool(),
            onDeactivate: () => this.deactivateEyedropperTool(),
            onClick: (point) => this.handleEyedropperClick(point)
        });
        
        // 🪣 塗りつぶしツール
        this.registerTool('bucketFill', {
            name: '塗りつぶし',
            icon: '🪣',
            category: 'utility',
            settings: {
                tolerance: { value: 10, min: 0, max: 255, step: 1 },
                opacity: { value: 1.0, min: 0.1, max: 1.0, step: 0.1 },
                antiAlias: { value: true },
                contiguous: { value: true } // 隣接領域のみ
            },
            onActivate: () => this.activateBucketFillTool(),
            onDeactivate: () => this.deactivateBucketFillTool(),
            onClick: (point) => this.handleBucketFillClick(point)
        });
        
        // ⬚ 範囲選択ツール（基本）
        this.registerTool('select', {
            name: '範囲選択',
            icon: '⬚',
            category: 'selection',
            settings: {
                type: { value: 'rectangle', options: ['rectangle', 'ellipse'] },
                feather: { value: 0, min: 0, max: 50, step: 1 },
                antiAlias: { value: true },
                addToSelection: { value: false }
            },
            onActivate: () => this.activateSelectTool(),
            onDeactivate: () => this.deactivateSelectTool(),
            onDragStart: (point) => this.handleSelectDragStart(point),
            onDragMove: (point) => this.handleSelectDragMove(point),
            onDragEnd: (point) => this.handleSelectDragEnd(point)
        });
        
        console.log(`🔧 ツール初期化完了: ${this.tools.size}個`);
    }
    
    /**
     * ツール登録
     */
    registerTool(toolId, toolConfig) {
        this.tools.set(toolId, toolConfig);
        this.toolSettings.set(toolId, { ...toolConfig.settings });
        
        console.log(`🔧 ツール登録: ${toolId} (${toolConfig.name})`);
    }
    
    /**
     * イベント購読
     */
    subscribeToEvents() {
        // ツール変更イベント
        this.eventStore.on(this.eventStore.eventTypes.TOOL_CHANGE, 
            this.handleToolChange.bind(this), 'tool-processor');
        
        // 入力イベント
        this.eventStore.on(this.eventStore.eventTypes.INPUT_START, 
            this.handleInputStart.bind(this), 'tool-processor');
        this.eventStore.on(this.eventStore.eventTypes.INPUT_MOVE, 
            this.handleInputMove.bind(this), 'tool-processor');
        this.eventStore.on(this.eventStore.eventTypes.INPUT_END, 
            this.handleInputEnd.bind(this), 'tool-processor');
        
        console.log('📝 ツールイベント購読開始');
    }
    
    /**
     * ツール変更処理
     */
    handleToolChange(eventData) {
        const newToolId = eventData.payload.tool;
        this.selectTool(newToolId);
    }
    
    /**
     * 入力開始処理
     */
    handleInputStart(eventData) {
        if (!this.currentTool) return;
        
        const tool = this.tools.get(this.currentTool);
        const point = eventData.payload.point;
        const pressure = eventData.payload.pressure;
        
        this.isToolActive = true;
        
        if (tool.onStrokeStart) {
            tool.onStrokeStart(point, pressure);
        } else if (tool.onClick) {
            tool.onClick(point);
        } else if (tool.onDragStart) {
            tool.onDragStart(point);
        }
    }
    
    /**
     * 入力移動処理
     */
    handleInputMove(eventData) {
        if (!this.currentTool || !this.isToolActive) return;
        
        const tool = this.tools.get(this.currentTool);
        const point = eventData.payload.point;
        const pressure = eventData.payload.pressure;
        
        if (tool.onStrokeMove) {
            tool.onStrokeMove(point, pressure);
        } else if (tool.onDragMove) {
            tool.onDragMove(point);
        }
    }
    
    /**
     * 入力終了処理
     */
    handleInputEnd(eventData) {
        if (!this.currentTool || !this.isToolActive) return;
        
        const tool = this.tools.get(this.currentTool);
        const point = eventData.payload.point;
        const pressure = eventData.payload.pressure;
        
        this.isToolActive = false;
        
        if (tool.onStrokeEnd) {
            tool.onStrokeEnd(point, pressure);
        } else if (tool.onDragEnd) {
            tool.onDragEnd(point);
        }
    }
    
    /**
     * ツール選択
     */
    selectTool(toolId) {
        if (!this.tools.has(toolId)) {
            console.warn(`🚨 未知のツール: ${toolId}`);
            return false;
        }
        
        // 現在のツール非アクティブ化
        if (this.currentTool) {
            const currentTool = this.tools.get(this.currentTool);
            if (currentTool.onDeactivate) {
                currentTool.onDeactivate();
            }
        }
        
        // 新しいツールアクティブ化
        this.currentTool = toolId;
        const newTool = this.tools.get(toolId);
        
        if (newTool.onActivate) {
            newTool.onActivate();
        }
        
        // エンジンのツール設定更新
        this.updateEngineToolConfig();
        
        console.log(`🔧 ツール選択: ${toolId} (${newTool.name})`);
        return true;
    }
    
    /**
     * エンジンツール設定更新
     */
    updateEngineToolConfig() {
        if (!this.currentTool) return;
        
        const toolSettings = this.toolSettings.get(this.currentTool);
        const engineConfig = this.convertToEngineConfig(this.currentTool, toolSettings);
        
        this.engine.setTool(this.currentTool, engineConfig);
    }
    
    /**
     * エンジン設定変換
     */
    convertToEngineConfig(toolId, settings) {
        const config = {};
        
        // 共通設定変換
        if (settings.size) config.width = settings.size.value;
        if (settings.opacity) config.color = [...(config.color || [0.5, 0.0, 0.0]), settings.opacity.value];
        if (settings.smoothing) config.smooth = settings.smoothing.value > 0;
        if (settings.pressure) config.pressure = settings.pressure.value;
        
        // ツール固有設定
        switch (toolId) {
            case 'airspray':
                if (settings.density) config.density = settings.density.value;
                if (settings.flow) config.flow = settings.flow.value;
                break;
                
            case 'blur':
                if (settings.strength) config.blurStrength = settings.strength.value;
                if (settings.type) config.blurType = settings.type.value;
                break;
                
            case 'eraser':
                config.blend = 'destination-out';
                if (settings.hardness) config.hardness = settings.hardness.value;
                break;
        }
        
        return config;
    }
    
    // ============ ペンツール処理 ============
    
    activatePenTool() {
        console.log('🖊️ ペンツールアクティブ化');
    }
    
    deactivatePenTool() {
        console.log('🖊️ ペンツール非アクティブ化');
    }
    
    handlePenStrokeStart(point, pressure) {
        // OGLエンジンでストローク開始（既に実装済み）
        console.log('🖊️ ペンストローク開始:', point);
    }
    
    handlePenStrokeMove(point, pressure) {
        // OGLエンジンでストローク追加（既に実装済み）
        console.log('🖊️ ペンストローク移動:', point);
    }
    
    handlePenStrokeEnd(point, pressure) {
        // OGLエンジンでストローク終了（既に実装済み）
        console.log('🖊️ ペンストローク終了:', point);
    }
    
    // ============ 消しゴムツール処理 ============
    
    activateEraserTool() {
        console.log('🗑️ 消しゴムツールアクティブ化');
    }
    
    deactivateEraserTool() {
        console.log('🗑️ 消しゴムツール非アクティブ化');
    }
    
    handleEraserStrokeStart(point, pressure) {
        console.log('🗑️ 消しゴムストローク開始:', point);
    }
    
    handleEraserStrokeMove(point, pressure) {
        console.log('🗑️ 消しゴムストローク移動:', point);
    }
    
    handleEraserStrokeEnd(point, pressure) {
        console.log('🗑️ 消しゴムストローク終了:', point);
    }
    
    // ============ エアスプレーツール処理 ============
    
    activateAirsprayTool() {
        console.log('🖌️ エアスプレーツールアクティブ化');
    }
    
    deactivateAirsprayTool() {
        console.log('🖌️ エアスプレーツール非アクティブ化');
    }
    
    handleAirsprayStrokeStart(point, pressure) {
        console.log('🖌️ エアスプレーストローク開始:', point);
    }
    
    handleAirsprayStrokeMove(point, pressure) {
        console.log('🖌️ エアスプレーストローク移動:', point);
    }
    
    handleAirsprayStrokeEnd(point, pressure) {
        console.log('🖌️ エアスプレーストローク終了:', point);
    }
    
    // ============ ボカシツール処理 ============
    
    activateBlurTool() {
        console.log('🌫️ ボカシツールアクティブ化');
    }
    
    deactivateBlurTool() {
        console.log('🌫️ ボカシツール非アクティブ化');
    }
    
    handleBlurStrokeStart(point, pressure) {
        console.log('🌫️ ボカシストローク開始:', point);
    }
    
    handleBlurStrokeMove(point, pressure) {
        console.log('🌫️ ボカシストローク移動:', point);
    }
    
    handleBlurStrokeEnd(point, pressure) {
        console.log('🌫️ ボカシストローク終了:', point);
    }
    
    // ============ スポイトツール処理 ============
    
    activateEyedropperTool() {
        // カーソル変更
        this.engine.canvas.style.cursor = 'crosshair';
        console.log('💧 スポイトツールアクティブ化');
    }
    
    deactivateEyedropperTool() {
        this.engine.canvas.style.cursor = 'default';
        console.log('💧 スポイトツール非アクティブ化');
    }
    
    handleEyedropperClick(point) {
        // 色サンプリング実装（Phase2で詳細実装）
        const sampledColor = this.sampleColorAtPoint(point);
        
        this.eventStore.emit('color:sampled', {
            color: sampledColor,
            point: point
        });
        
        console.log('💧 色サンプリング:', sampledColor, 'at', point);
    }
    
    sampleColorAtPoint(point) {
        // 簡易実装：実際はキャンバスからピクセル色を取得
        return [0.8, 0.2, 0.2, 1.0]; // 仮の色
    }
    
    // ============ 塗りつぶしツール処理 ============
    
    activateBucketFillTool() {
        this.engine.canvas.style.cursor = 'crosshair';
        console.log('🪣 塗りつぶしツールアクティブ化');
    }
    
    deactivateBucketFillTool() {
        this.engine.canvas.style.cursor = 'default';
        console.log('🪣 塗りつぶしツール非アクティブ化');
    }
    
    handleBucketFillClick(point) {
        // フラッドフィル実装（Phase2で詳細実装）
        const settings = this.toolSettings.get('bucketFill');
        
        this.performFloodFill(point, settings.tolerance.value);
        
        console.log('🪣 塗りつぶし実行:', point, 'tolerance:', settings.tolerance.value);
    }
    
    performFloodFill(point, tolerance) {
        // 簡易実装：実際はフラッドフィルアルゴリズム
        console.log('🪣 フラッドフィル実行（未完全実装）');
    }
    
    // ============ 選択ツール処理 ============
    
    activateSelectTool() {
        this.engine.canvas.style.cursor = 'crosshair';
        this.toolContext = { isSelecting: false, startPoint: null, currentRect: null };
        console.log('⬚ 選択ツールアクティブ化');
    }
    
    deactivateSelectTool() {
        this.engine.canvas.style.cursor = 'default';
        this.clearSelectionPreview();
        this.toolContext = null;
        console.log('⬚ 選択ツール非アクティブ化');
    }
    
    handleSelectDragStart(point) {
        this.toolContext.isSelecting = true;
        this.toolContext.startPoint = point;
        
        console.log('⬚ 選択開始:', point);
    }
    
    handleSelectDragMove(point) {
        if (!this.toolContext.isSelecting) return;
        
        const rect = {
            x: Math.min(this.toolContext.startPoint.x, point.x),
            y: Math.min(this.toolContext.startPoint.y, point.y),
            width: Math.abs(point.x - this.toolContext.startPoint.x),
            height: Math.abs(point.y - this.toolContext.startPoint.y)
        };
        
        this.toolContext.currentRect = rect;
        this.updateSelectionPreview(rect);
        
        console.log('⬚ 選択範囲更新:', rect);
    }
    
    handleSelectDragEnd(point) {
        if (!this.toolContext.isSelecting) return;
        
        this.toolContext.isSelecting = false;
        
        if (this.toolContext.currentRect) {
            this.createSelection(this.toolContext.currentRect);
        }
        
        console.log('⬚ 選択完了:', this.toolContext.currentRect);
    }
    
    updateSelectionPreview(rect) {
        // 選択範囲プレビュー表示（Phase2で詳細実装）
        console.log('⬚ 選択プレビュー更新:', rect);
    }
    
    clearSelectionPreview() {
        // プレビュークリア
        console.log('⬚ 選択プレビュークリア');
    }
    
    createSelection(rect) {
        // 選択範囲作成
        this.eventStore.emit('selection:create', {
            type: 'rectangle',
            rect: rect
        });
        
        console.log('⬚ 選択範囲作成:', rect);
    }
    
    // ============ ツール設定管理 ============
    
    /**
     * ツール設定取得
     */
    getToolSetting(toolId, settingName) {
        const settings = this.toolSettings.get(toolId);
        return settings?.[settingName]?.value;
    }
    
    /**
     * ツール設定更新
     */
    setToolSetting(toolId, settingName, value) {
        if (!this.tools.has(toolId)) return false;
        
        const settings = this.toolSettings.get(toolId);
        if (!settings?.[settingName]) return false;
        
        // 値の範囲チェック
        const setting = settings[settingName];
        if (typeof setting.min === 'number' && value < setting.min) value = setting.min;
        if (typeof setting.max === 'number' && value > setting.max) value = setting.max;
        
        settings[settingName].value = value;
        
        // 現在のツールの設定が変更された場合、エンジンに反映
        if (toolId === this.currentTool) {
            this.updateEngineToolConfig();
        }
        
        this.eventStore.emit('tool:setting:changed', {
            toolId,
            settingName,
            value
        });
        
        console.log(`🔧 ツール設定更新: ${toolId}.${settingName} = ${value}`);
        return true;
    }
    
    /**
     * 全ツール情報取得
     */
    getAllTools() {
        const tools = [];
        
        this.tools.forEach((tool, toolId) => {
            tools.push({
                id: toolId,
                name: tool.name,
                icon: tool.icon,
                category: tool.category,
                active: toolId === this.currentTool,
                settings: this.toolSettings.get(toolId)
            });
        });
        
        return tools;
    }
    
    /**
     * カテゴリ別ツール取得
     */
    getToolsByCategory() {
        const categories = {};
        
        this.tools.forEach((tool, toolId) => {
            const category = tool.category || 'other';
            
            if (!categories[category]) {
                categories[category] = [];
            }
            
            categories[category].push({
                id: toolId,
                name: tool.name,
                icon: tool.icon,
                active: toolId === this.currentTool
            });
        });
        
        return categories;
    }
    
    /**
     * ツール状態取得
     */
    getToolState() {
        return {
            currentTool: this.currentTool,
            isToolActive: this.isToolActive,
            toolCount: this.tools.size,
            availableTools: Array.from(this.tools.keys())
        };
    }
} pressure) => this.handlePenStrokeStart(point, pressure),
            onStrokeMove: (point, pressure) => this.handlePenStrokeMove(point, pressure),
            onStrokeEnd: (point, pressure) => this.handlePenStrokeEnd(point, pressure)
        });
        
        // 🗑️ 消しゴムツール
        this.registerTool('eraser', {
            name: '消しゴム',
            icon: '🗑️',
            category: 'drawing',
            settings: {
                size: { value: 10, min: 1, max: 100, step: 1 },
                opacity: { value: 1.0, min: 0.1, max: 1.0, step: 0.1 },
                pressure: { value: true },
                hardness: { value: 0.8, min: 0, max: 1.0, step: 0.1 }
            },
            onActivate: () => this.activateEraserTool(),
            onDeactivate: () => this.deactivateEraserTool(),
            onStrokeStart: (point,