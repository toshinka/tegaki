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
        
            setupShortcuts() {
        // ツールのショートカット
        for (const [id, tool] of this.tools) {
            if (tool.shortcut) {
                this.shortcuts.set(tool.shortcut, () => this.setActiveTool(id));
            }
        }

        // その他のショートカット
        this.shortcuts.set('[', () => this.decreaseToolSize());
        this.shortcuts.set(']', () => this.increaseToolSize());
        this.shortcuts.set('x', () => this.swapColors());
        this.shortcuts.set('d', () => this.resetColors());
    }

    async initializeInputDevices() {
        // ペンタブレットのサポート
        if (navigator.pentablet) {
            await this.initializePenTablet();
        }

        // タッチデバイスのサポート
        if ('ontouchstart' in window) {
            this.initializeTouchInput();
        }

        // ポインターイベントの初期設定
        this.initializePointerEvents();
    }

    async initializePenTablet() {
        try {
            const tablet = await navigator.pentablet.connect();
            tablet.addEventListener('pressure', this.handlePressureChange.bind(this));
            tablet.addEventListener('tilt', this.handleTiltChange.bind(this));
            console.log('Pen tablet initialized');
        } catch (error) {
            console.warn('Pen tablet initialization failed:', error);
        }
    }

    initializeTouchInput() {
        const options = {
            passive: false,
            capture: true
        };

        document.addEventListener('touchstart', this.handleTouchStart.bind(this), options);
        document.addEventListener('touchmove', this.handleTouchMove.bind(this), options);
        document.addEventListener('touchend', this.handleTouchEnd.bind(this), options);
    }

    initializePointerEvents() {
        const canvas = this.app.getManager('canvas').getCanvas('display');
        const options = {
            passive: false,
            capture: true
        };

        canvas.addEventListener('pointerdown', this.handlePointerDown.bind(this), options);
        canvas.addEventListener('pointermove', this.handlePointerMove.bind(this), options);
        canvas.addEventListener('pointerup', this.handlePointerUp.bind(this), options);
        canvas.addEventListener('pointercancel', this.handlePointerCancel.bind(this), options);
    }

    async setActiveTool(toolId) {
        const tool = this.tools.get(toolId);
        if (!tool) return false;

        this.previousTool = this.activeTool;
        this.activeTool = tool;

        // ツール変更イベントの発火
        this.notifyToolChange('active', {
            previous: this.previousTool?.name,
            current: tool.name
        });

        return true;
    }


    // デフォルトツールの設定
    await this.setActiveTool('brush');
}

setupShortcuts() {
    // ツールのショートカット
    for (const [id, tool] of this.tools) {
        if (tool.shortcut) {
            this.shortcuts.set(tool.shortcut, () => this.setActiveTool(id));
        }
    }

    // その他のショートカット
    this.shortcuts.set('[', () => this.decreaseToolSize());
    this.shortcuts.set(']', () => this.increaseToolSize());
    this.shortcuts.set('x', () => this.swapColors());
    this.shortcuts.set('d', () => this.resetColors());
}

    // ユーティリティメソッド
    getPointerPosition(event) {
        const canvas = this.app.getManager('canvas').getCanvas('display');
        const rect = canvas.getBoundingClientRect();
        
        return {
            x: (event.clientX - rect.left) / this.app.getManager('canvas').state.scale,
            y: (event.clientY - rect.top) / this.app.getManager('canvas').state.scale,
            pressure: event.pressure || 1.0,
            tilt: {
                x: event.tiltX || 0,
                y: event.tiltY || 0
            },
            timestamp: Date.now()
        };
    }

    smoothPoints(points) {
        if (points.length < 2) return points[0];

        let x = 0;
        let y = 0;
        let pressure = 0;
        let tiltX = 0;
        let tiltY = 0;

        const weights = points.map((_, i) => 
            Math.pow(0.5, points.length - i - 1));
        const totalWeight = weights.reduce((a, b) => a + b, 0);

        points.forEach((point, i) => {
            const weight = weights[i] / totalWeight;
            x += point.x * weight;
            y += point.y * weight;
            pressure += point.pressure * weight;
            tiltX += point.tilt.x * weight;
            tiltY += point.tilt.y * weight;
        });

        return {
            x,
            y,
            pressure,
            tilt: { x: tiltX, y: tiltY },
            timestamp: Date.now()
        };
    }

    resetInputState() {
        this.inputState = {
            isDrawing: false,
            pressure: 1.0,
            tilt: { x: 0, y: 0 },
            rotation: 0,
            lastPoint: null,
            points: []
        };
    }

    // ツール操作メソッド
    increaseToolSize() {
        if (!this.activeTool) return;
        
        const toolType = this.activeTool.name.toLowerCase();
        if (this.settings[toolType]?.size !== undefined) {
            this.settings[toolType].size = Math.min(
                this.settings[toolType].size * 1.2,
                1000
            );
            this.notifyToolChange('size');
        }
    }

    decreaseToolSize() {
        if (!this.activeTool) return;
        
        const toolType = this.activeTool.name.toLowerCase();
        if (this.settings[toolType]?.size !== undefined) {
            this.settings[toolType].size = Math.max(
                this.settings[toolType].size / 1.2,
                1
            );
            this.notifyToolChange('size');
        }
    }

    swapColors() {
        const colorManager = this.app.getManager('color');
        const primary = colorManager.state.primaryColor;
        const secondary = colorManager.state.secondaryColor;

        colorManager.setPrimaryColor(secondary);
        colorManager.setSecondaryColor(primary);
    }

    resetColors() {
        const colorManager = this.app.getManager('color');
        colorManager.setPrimaryColor('#000000');
        colorManager.setSecondaryColor('#ffffff');
    }

    notifyToolChange(type, data = {}) {
        this.app.config.container.dispatchEvent(new CustomEvent('tool-change', {
            detail: {
                type,
                data,
                state: this.getState()
            }
        }));
    }

    getState() {
        return {
            activeTool: this.activeTool?.name,
            previousTool: this.previousTool?.name,
            settings: { ...this.settings },
            inputState: { ...this.inputState }
        };
    }

    setState(state) {
        if (!state) return;

        if (state.activeTool) {
            this.setActiveTool(state.activeTool);
        }

        if (state.settings) {
            this.settings = { ...this.settings, ...state.settings };
        }

        this.notifyToolChange('state');
    }
}
