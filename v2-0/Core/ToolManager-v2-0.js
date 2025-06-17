// ToolManager-v2-0.js
class TegakiToolManager {
    constructor(app) {
        this.app = app;
        this.currentUser = 'toshinka';
        this.currentTimestamp = '2025-06-17 08:17:23';
        
        // ツール管理
        this.tools = new Map();
        this.activeTool = null;
        this.previousTool = null;

        // ツール設定
        this.settings = {
            brush: {
                size: 5,
                opacity: 1.0,
                flow: 1.0,
                hardness: 0.8,
                spacing: 0.1,
                angle: 0,
                roundness: 1.0,
                scattering: 0
            },
            eraser: {
                size: 20,
                opacity: 1.0,
                hardness: 0.5,
                mode: 'normal'
            },
            selection: {
                feather: 0,
                antiAlias: true,
                mode: 'new'
            }
        };

        // 入力状態の管理
        this.inputState = {
            isDrawing: false,
            pressure: 1.0,
            tilt: { x: 0, y: 0 },
            rotation: 0,
            lastPoint: null,
            points: []
        };

        // ショートカットキー
        this.shortcuts = new Map();

        this.initialize();
    }

    async initialize() {
        console.log(`Initializing Tool Manager at ${this.currentTimestamp}`);

        try {
            // 基本ツールの初期化
            await this.initializeTools();

            // ショートカットの設定
            this.setupShortcuts();

            // 入力デバイスの初期化
            await this.initializeInputDevices();

            console.log('Tool Manager initialization completed');

        } catch (error) {
            console.error('Tool Manager initialization failed:', error);
            throw error;
        }
    }

    async initializeTools() {
        // ブラシツール
        this.tools.set('brush', {
            name: 'Brush',
            icon: 'brush',
            type: 'drawing',
            handlers: {
                pointerDown: this.handleBrushDown.bind(this),
                pointerMove: this.handleBrushMove.bind(this),
                pointerUp: this.handleBrushUp.bind(this)
            },
            shortcut: 'b'
        });

        // 消しゴムツール
        this.tools.set('eraser', {
            name: 'Eraser',
            icon: 'eraser',
            type: 'drawing',
            handlers: {
                pointerDown: this.handleEraserDown.bind(this),
                pointerMove: this.handleEraserMove.bind(this),
                pointerUp: this.handleEraserUp.bind(this)
            },
            shortcut: 'e'
        });

        // 選択ツール
        this.tools.set('selection', {
            name: 'Selection',
            icon: 'selection',
            type: 'selection',
            handlers: {
                pointerDown: this.handleSelectionDown.bind(this),
                pointerMove: this.handleSelectionMove.bind(this),
                pointerUp: this.handleSelectionUp.bind(this)
            },
            shortcut: 'm'
        });

        // 移動ツール
        this.tools.set('move', {
            name: 'Move',
            icon: 'move',
            type: 'transform',
            handlers: {
                pointerDown: this.handleMoveDown.bind(this),
                pointerMove: this.handleMoveMove.bind(this),
                pointerUp: this.handleMoveUp.bind(this)
            },
            shortcut: 'v'
        });

        // スポイトツール
        this.tools.set('eyedropper', {
            name: 'Eyedropper',
            icon: 'eyedropper',
            type: 'color',
            handlers: {
                pointerDown: this.handleEyedropperDown.bind(this),
                pointerMove: this.handleEyedropperMove.bind(this),
                pointerUp: this.handleEyedropperUp.bind(this)
            },
            shortcut: 'i'
        });

        // 塗りつぶしツール
        this.tools.set('fill', {
            name: 'Fill',
            icon: 'fill',
            type: 'drawing',
            handlers: {
                pointerDown: this.handleFillDown.bind(this),
                pointerMove: this.handleFillMove.bind(this),
                pointerUp: this.handleFillUp.bind(this)
            },
            shortcut: 'g'
        });

        // デフォルトツールの設定
        await this.setActiveTool('brush');
    }