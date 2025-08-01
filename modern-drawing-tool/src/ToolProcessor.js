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
        this.currentTool = 'pen';
        this.toolConfigs = new Map();
        
        // ツール状態
        this.isDrawing = false;
        this.currentStroke = null;
        
        console.log('✅ ToolProcessor初期化完了');
    }
    
    /**
     * ツール処理初期化
     */
    async initialize() {
        this.setupTools();
        this.setupToolConfigs();
        this.subscribeToEvents();
        
        console.log('🎨 ツール処理初期化完了');
    }
    
    /**
     * ツール定義セットアップ
     */
    setupTools() {
        this.tools.set('pen', {
            name: 'ペン',
            icon: '✏️',
            category: 'drawing',
            onStart: this.handlePenStart.bind(this),
            onMove: this.handlePenMove.bind(this),
            onEnd: this.handlePenEnd.bind(this)
        });
        
        this.tools.set('eraser', {
            name: '消しゴム',
            icon: '🗑️',
            category: 'effect',
            onStart: this.handleEraserStart.bind(this),
            onMove: this.handleEraserMove.bind(this),
            onEnd: this.handleEraserEnd.bind(this)
        });
        
        this.tools.set('airspray', {
            name: 'エアスプレー',
            icon: '🖌️',
            category: 'drawing',
            onStart: this.handleAirsprayStart.bind(this),
            onMove: this.handleAirsprayMove.bind(this),
            onEnd: this.handleAirsprayEnd.bind(this)
        });
        
        this.tools.set('blur', {
            name: 'ボカシ',
            icon: '🌫️',
            category: 'effect',
            onStart: this.handleBlurStart.bind(this),
            onMove: this.handleBlurMove.bind(this),
            onEnd: this.handleBlurEnd.bind(this)
        });
        
        this.tools.set('eyedropper', {
            name: 'スポイト',
            icon: '💧',
            category: 'utility',
            onClick: this.handleEyedropperClick.bind(this)
        });
        
        this.tools.set('fill', {
            name: '塗りつぶし',
            icon: '🪣',
            category: 'utility',
            onClick: this.handleFillClick.bind(this)
        });
        
        this.tools.set('select', {
            name: '範囲選択',
            icon: '⬚',
            category: 'selection',
            onStart: this.handleSelectStart.bind(this),
            onMove: this.handleSelectMove.bind(this),
            onEnd: this.handleSelectEnd.bind(this)
        });
        
        this.tools.set('transform', {
            name: '変形',
            icon: '✂️',
            category: 'selection',
            onStart: this.handleTransformStart.bind(this),
            onMove: this.handleTransformMove.bind(this),
            onEnd: this.handleTransformEnd.bind(this)
        });
    }
    
    /**
     * ツール設定セットアップ
     */
    setupToolConfigs() {
        this.toolConfigs.set('pen', {
            size: 5,
            opacity: 100,
            pressure: true
        });
        
        this.toolConfigs.set('eraser', {
            size: 10,
            strength: 100,
            soft: false
        });
        
        this.toolConfigs.set('airspray', {
            intensity: 50,
            density: 30,
            spread: 15
        });
        
        this.toolConfigs.set('blur', {
            strength: 3,
            type: 'ガウシアン',
            edgeProtect: false
        });
    }
    
    /**
     * イベント購読
     */
    subscribeToEvents() {
        this.eventStore.on('tool:change', this.handleToolChange.bind(this), 'tool-processor');
        this.eventStore.on('tool:config:update', this.handleToolConfigUpdate.bind(this), 'tool-processor');
        this.eventStore.on('input:start', this.handleInputStart.bind(this), 'tool-processor');
        this.eventStore.on('input:move', this.handleInputMove.bind(this), 'tool-processor');
        this.eventStore.on('input:end', this.handleInputEnd.bind(this), 'tool-processor');
    }
    
    /**
     * ツール変更処理
     */
    handleToolChange(eventData) {
        const { tool } = eventData.payload;
        
        if (this.tools.has(tool)) {
            this.currentTool = tool;
            console.log(`🎨 ツール変更: ${tool}`);
        }
    }
    
    /**
     * ツール設定更新処理
     */
    handleToolConfigUpdate(eventData) {
        const { tool, property, value } = eventData.payload;
        
        if (this.toolConfigs.has(tool)) {
            const config = this.toolConfigs.get(tool);
            config[property] = value;
            console.log(`🎨 ツール設定更新: ${tool}.${property} = ${value}`);
        }
    }
    
    /**
     * 入力開始処理
     */
    handleInputStart(eventData) {
        const tool = this.tools.get(this.currentTool);
        if (tool && tool.onStart) {
            tool.onStart(eventData.payload);
        } else if (tool && tool.onClick) {
            tool.onClick(eventData.payload);
        }
    }
    
    /**
     * 入力移動処理
     */
    handleInputMove(eventData) {
        const tool = this.tools.get(this.currentTool);
        if (tool && tool.onMove && this.isDrawing) {
            tool.onMove(eventData.payload);
        }
    }
    
    /**
     * 入力終了処理
     */
    handleInputEnd(eventData) {
        const tool = this.tools.get(this.currentTool);
        if (tool && tool.onEnd) {
            tool.onEnd(eventData.payload);
        }
        this.isDrawing = false;
        this.currentStroke = null;
    }
    
    /**
     * ペンツール開始
     */
    handlePenStart(inputData) {
        this.isDrawing = true;
        const config = this.toolConfigs.get('pen');
        
        this.currentStroke = {
            id: `pen_${Date.now()}`,
            tool: 'pen',
            points: [inputData.position],
            config: { ...config }
        };
        
        this.eventStore.emit('stroke:start', {
            strokeId: this.currentStroke.id,
            tool: 'pen',
            position: inputData.position
        });
        
        console.log('🖊️ ペン描画開始');
    }
    
    /**
     * ペンツール移動
     */
    handlePenMove(inputData) {
        if (!this.currentStroke) return;
        
        this.currentStroke.points.push(inputData.position);
        
        this.eventStore.emit('stroke:update', {
            strokeId: this.currentStroke.id,
            position: inputData.position,
            pressure: inputData.pressure || 1.0
        });
    }
    
    /**
     * ペンツール終了
     */
    handlePenEnd(inputData) {
        if (!this.currentStroke) return;
        
        this.eventStore.emit('stroke:complete', {
            strokeId: this.currentStroke.id,
            tool: 'pen',
            stroke: this.currentStroke
        });
        
        console.log('🖊️ ペン描画完了');
    }
    
    /**
     * 消しゴムツール開始
     */
    handleEraserStart(inputData) {
        this.isDrawing = true;
        console.log('🗑️ 消しゴム開始（未完全実装）');
    }
    
    /**
     * 消しゴムツール移動
     */
    handleEraserMove(inputData) {
        console.log('🗑️ 消しゴム移動（未完全実装）');
    }
    
    /**
     * 消しゴムツール終了
     */
    handleEraserEnd(inputData) {
        console.log('🗑️ 消しゴム終了（未完全実装）');
    }
    
    /**
     * エアスプレーツール開始
     */
    handleAirsprayStart(inputData) {
        this.isDrawing = true;
        console.log('🖌️ エアスプレー開始（未完全実装）');
    }
    
    /**
     * エアスプレーツール移動
     */
    handleAirsprayMove(inputData) {
        console.log('🖌️ エアスプレー移動（未完全実装）');
    }
    
    /**
     * エアスプレーツール終了
     */
    handleAirsprayEnd(inputData) {
        console.log('🖌️ エアスプレー終了（未完全実装）');
    }
    
    /**
     * ボカシツール開始
     */
    handleBlurStart(inputData) {
        this.isDrawing = true;
        console.log('🌫️ ボカシ開始（未完全実装）');
    }
    
    /**
     * ボカシツール移動
     */
    handleBlurMove(inputData) {
        console.log('🌫️ ボカシ移動（未完全実装）');
    }
    
    /**
     * ボカシツール終了
     */
    handleBlurEnd(inputData) {
        console.log('🌫️ ボカシ終了（未完全実装）');
    }
    
    /**
     * スポイトツールクリック
     */
    handleEyedropperClick(inputData) {
        console.log('💧 スポイト実行（未完全実装）');
        // カラーピック処理
        this.eventStore.emit('color:eyedropper:pick', {
            position: inputData.position,
            color: '#000000' // プレースホルダー
        });
    }
    
    /**
     * 塗りつぶしツールクリック
     */
    handleFillClick(inputData) {
        console.log('🪣 塗りつぶし実行（未完全実装）');
        // 塗りつぶし処理
    }
    
    /**
     * 範囲選択ツール開始
     */
    handleSelectStart(inputData) {
        this.isDrawing = true;
        console.log('⬚ 範囲選択開始（未完全実装）');
    }
    
    /**
     * 範囲選択ツール移動
     */
    handleSelectMove(inputData) {
        console.log('⬚ 範囲選択移動（未完全実装）');
    }
    
    /**
     * 範囲選択ツール終了
     */
    handleSelectEnd(inputData) {
        console.log('⬚ 範囲選択終了（未完全実装）');
    }
    
    /**
     * 変形ツール開始
     */
    handleTransformStart(inputData) {
        this.isDrawing = true;
        console.log('✂️ 変形開始（未完全実装）');
    }
    
    /**
     * 変形ツール移動
     */
    handleTransformMove(inputData) {
        console.log('✂️ 変形移動（未完全実装）');
    }
    
    /**
     * 変形ツール終了
     */
    handleTransformEnd(inputData) {
        console.log('✂️ 変形終了（未完全実装）');
    }
    
    /**
     * カテゴリ別ツール取得
     */
    getToolsByCategory() {
        const categories = {
            drawing: [],
            effect: [],
            utility: [],
            selection: []
        };
        
        this.tools.forEach((tool, id) => {
            if (categories[tool.category]) {
                categories[tool.category].push({
                    id: id,
                    name: tool.name,
                    icon: tool.icon,
                    action: () => this.eventStore.emit('tool:change', { tool: id })
                });
            }
        });
        
        return categories;
    }
    
    /**
     * 現在のツール取得
     */
    getCurrentTool() {
        return this.currentTool;
    }
    
    /**
     * ツール設定取得
     */
    getToolConfig(toolId) {
        return this.toolConfigs.get(toolId) || {};
    }
    
    /**
     * デバッグ情報取得
     */
    getDebugInfo() {
        return {
            currentTool: this.currentTool,
            isDrawing: this.isDrawing,
            toolsCount: this.tools.size,
            configsCount: this.toolConfigs.size,
            currentStroke: this.currentStroke ? this.currentStroke.id : null
        };
    }
}