// ToolManager-v2-0.js
class TegakiToolManager {
    constructor(app) {
        this.app = app;
        this.currentUser = 'toshinka';
        this.currentTimestamp = '2025-06-17 16:55:14';

        // ツール状態
        this.state = {
            activeTool: null,
            previousTool: null,
            tools: new Map(),
            isDrawing: false,
            pressure: 1.0,
            tilt: { x: 0, y: 0 },
            modifiers: {
                shift: false,
                ctrl: false,
                alt: false
            }
        };

        // ブラシ設定
        this.brushSettings = {
            size: 10,
            flow: 1.0,
            hardness: 0.8,
            spacing: 0.1,
            angle: 0,
            roundness: 1.0,
            scattering: 0,
            jitter: 0
        };

        // 消しゴム設定
        this.eraserSettings = {
            size: 20,
            hardness: 0.5,
            flow: 1.0,
            mode: 'normal' // normal, stroke, area
        };

        // スポイト設定
        this.eyedropperSettings = {
            sampleSize: 1, // 1x1, 3x3, 5x5
            sampleLayer: 'current', // current, visible, all
            includeAlpha: true
        };

        // 共通ツール設定
        this.commonSettings = {
            stabilization: 0.8,
            sizeStabilization: 0.5,
            pressureEnabled: true,
            tiltEnabled: true,
            rotationEnabled: true
        };

        this.initialize();
    }

    async initialize() {
        console.log(`Initializing Tool Manager at ${this.currentTimestamp}`);

        try {
            // 基本ツールの登録
            await this.registerBasicTools();

            // イベントリスナーの設定
            this.setupEventListeners();

            // デフォルトツールの設定
            this.setActiveTool('brush');

            console.log('Tool Manager initialization completed');

        } catch (error) {
            console.error('Tool Manager initialization failed:', error);
            throw error;
        }
    }

    async registerBasicTools() {
        // ブラシツール
        await this.registerTool('brush', {
            name: 'Brush',
            icon: '🖌️',
            shortcut: 'B',
            settings: this.brushSettings,
            handlers: {
                pointerDown: this.handleBrushDown.bind(this),
                pointerMove: this.handleBrushMove.bind(this),
                pointerUp: this.handleBrushUp.bind(this)
            }
        });

        // 消しゴムツール
        await this.registerTool('eraser', {
            name: 'Eraser',
            icon: '🧹',
            shortcut: 'E',
            settings: this.eraserSettings,
            handlers: {
                pointerDown: this.handleEraserDown.bind(this),
                pointerMove: this.handleEraserMove.bind(this),
                pointerUp: this.handleEraserUp.bind(this)
            }
        });

        // スポイトツール
        await this.registerTool('eyedropper', {
            name: 'Eyedropper',
            icon: '👁️',
            shortcut: 'I',
            settings: this.eyedropperSettings,
            handlers: {
                pointerDown: this.handleEyedropperDown.bind(this),
                pointerMove: this.handleEyedropperMove.bind(this),
                pointerUp: this.handleEyedropperUp.bind(this)
            }
        });
    }

    setupEventListeners() {
        // キーボードイベント
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));

        // ツール変更イベント
        this.app.config.container.addEventListener('tegaki-tool-change', (event) => {
            const { tool, settings } = event.detail;
            this.handleToolChange(tool, settings);
        });
    }

    registerTool(id, tool) {
        if (this.state.tools.has(id)) {
            console.warn(`Tool '${id}' is already registered`);
            return false;
        }

        this.state.tools.set(id, {
            id,
            ...tool,
            settings: { ...tool.settings },
            state: {
                active: false,
                lastPoint: null,
                points: [],
                stabilizer: new TegakiStabilizer(this.commonSettings.stabilization)
            }
        });

        return true;
    }

    setActiveTool(toolId) {
        const tool = this.state.tools.get(toolId);
        if (!tool) return false;

        if (this.state.activeTool) {
            this.state.previousTool = this.state.activeTool.id;
            this.state.tools.get(this.state.activeTool.id).state.active = false;
        }

        this.state.activeTool = tool;
        tool.state.active = true;

        this.notifyToolChange();
        return true;
    }

    getActiveTool() {
        return this.state.activeTool;
    }

    updateToolSettings(toolId, settings) {
        const tool = this.state.tools.get(toolId);
        if (!tool) return false;

        tool.settings = {
            ...tool.settings,
            ...settings
        };

        this.notifyToolChange();
        return true;
    }

    // ブラシツールハンドラ
    handleBrushDown(event) {
        const tool = this.state.tools.get('brush');
        const layer = this.app.getManager('layer').getCurrentLayer();
        
        if (!tool || !layer || layer.locked) return;

        this.state.isDrawing = true;
        tool.state.points = [];
        tool.state.stabilizer.reset();

        const point = {
            x: event.x,
            y: event.y,
            pressure: this.commonSettings.pressureEnabled ? event.pressure : 1.0,
            tilt: this.commonSettings.tiltEnabled ? event.tilt : { x: 0, y: 0 },
            timestamp: event.timestamp
        };

        tool.state.points.push(point);
        tool.state.lastPoint = point;

        this.startStroke(tool, layer, point);
    }

    handleBrushMove(event) {
        const tool = this.state.tools.get('brush');
        const layer = this.app.getManager('layer').getCurrentLayer();
        
        if (!this.state.isDrawing || !tool || !layer || layer.locked) return;

        const point = {
            x: event.x,
            y: event.y,
            pressure: this.commonSettings.pressureEnabled ? event.pressure : 1.0,
            tilt: this.commonSettings.tiltEnabled ? event.tilt : { x: 0, y: 0 },
            timestamp: event.timestamp
        };

        tool.state.points.push(point);
        
        const stabilized = tool.state.stabilizer.update(point);
        this.continueStroke(tool, layer, stabilized);
        
        tool.state.lastPoint = stabilized;
    }

    handleBrushUp(event) {
        const tool = this.state.tools.get('brush');
        const layer = this.app.getManager('layer').getCurrentLayer();
        
        if (!this.state.isDrawing || !tool || !layer || layer.locked) return;

        const point = {
            x: event.x,
            y: event.y,
            pressure: this.commonSettings.pressureEnabled ? event.pressure : 1.0,
            tilt: this.commonSettings.tiltEnabled ? event.tilt : { x: 0, y: 0 },
            timestamp: event.timestamp
        };

        tool.state.points.push(point);
        
        const stabilized = tool.state.stabilizer.end(point);
        this.endStroke(tool, layer, stabilized);

        this.state.isDrawing = false;
        tool.state.points = [];
        tool.state.lastPoint = null;
    }

    // 消しゴムツールハンドラ
    handleEraserDown(event) {
        const tool = this.state.tools.get('eraser');
        const layer = this.app.getManager('layer').getCurrentLayer();
        
        if (!tool || !layer || layer.locked) return;

        this.state.isDrawing = true;
        tool.state.points = [];
        tool.state.stabilizer.reset();

        const point = {
            x: event.x,
            y: event.y,
            pressure: this.commonSettings.pressureEnabled ? event.pressure : 1.0,
            tilt: this.commonSettings.tiltEnabled ? event.tilt : { x: 0, y: 0 },
            timestamp: event.timestamp
        };

        tool.state.points.push(point);
        tool.state.lastPoint = point;

        this.startErase(tool, layer, point);
    }

    handleEraserMove(event) {
        const tool = this.state.tools.get('eraser');
        const layer = this.app.getManager('layer').getCurrentLayer();
        
        if (!this.state.isDrawing || !tool || !layer || layer.locked) return;

        const point = {
            x: event.x,
            y: event.y,
            pressure: this.commonSettings.pressureEnabled ? event.pressure : 1.0,
            tilt: this.commonSettings.tiltEnabled ? event.tilt : { x: 0, y: 0 },
            timestamp: event.timestamp
        };

        tool.state.points.push(point);
        
        const stabilized = tool.state.stabilizer.update(point);
        this.continueErase(tool, layer, stabilized);
        
        tool.state.lastPoint = stabilized;
    }

    handleEraserUp(event) {
        const tool = this.state.tools.get('eraser');
        const layer = this.app.getManager('layer').getCurrentLayer();
        
        if (!this.state.isDrawing || !tool || !layer || layer.locked) return;

        const point = {
            x: event.x,
            y: event.y,
            pressure: this.commonSettings.pressureEnabled ? event.pressure : 1.0,
            tilt: this.commonSettings.tiltEnabled ? event.tilt : { x: 0, y: 0 },
            timestamp: event.timestamp
        };

        tool.state.points.push(point);
        
        const stabilized = tool.state.stabilizer.end(point);
        this.endErase(tool, layer, stabilized);

        this.state.isDrawing = false;
        tool.state.points = [];
        tool.state.lastPoint = null;
    }

    // スポイトツールハンドラ
    handleEyedropperDown(event) {
        const tool = this.state.tools.get('eyedropper');
        if (!tool) return;

        const color = this.sampleColor(event.x, event.y);
        if (color) {
            this.app.getManager('color').setPrimaryColor(color);
        }
    }

    handleEyedropperMove(event) {
        if (!this.state.isDrawing) return;
        
        const color = this.sampleColor(event.x, event.y);
        if (color) {
            this.app.getManager('color').setPrimaryColor(color);
        }
    }

    handleEyedropperUp() {
        const previousTool = this.state.previousTool || 'brush';
        this.setActiveTool(previousTool);
    }

    // ストローク処理
    startStroke(tool, layer, point) {
        const brushEngine = this.app.getExtension('brushEngine');
        if (!brushEngine) return;

        brushEngine.startStroke({
            context: layer.context,
            color: this.app.getManager('color').state.primary,
            size: tool.settings.size,
            flow: tool.settings.flow,
            hardness: tool.settings.hardness,
            spacing: tool.settings.spacing,
            angle: tool.settings.angle,
            roundness: tool.settings.roundness,
            scattering: tool.settings.scattering,
            jitter: tool.settings.jitter,
            point: point
        });
    }

    continueStroke(tool, layer, point) {
        const brushEngine = this.app.getExtension('brushEngine');
        if (!brushEngine) return;

        brushEngine.continueStroke({
            context: layer.context,
            point: point
        });
    }

    endStroke(tool, layer, point) {
        const brushEngine = this.app.getExtension('brushEngine');
        if (!brushEngine) return;

        brushEngine.endStroke({
            context: layer.context,
            point: point
        });

        // レイヤーの更新を通知
        this.app.getManager('layer').notifyLayerChange('content', layer.id);
    }

    // 消しゴム処理
    startErase(tool, layer, point) {
        const brushEngine = this.app.getExtension('brushEngine');
        if (!brushEngine) return;

        layer.context.globalCompositeOperation = 'destination-out';
        
        brushEngine.startStroke({
            context: layer.context,
            color: '#ffffff',
            size: tool.settings.size,
            flow: tool.settings.flow,
            hardness: tool.settings.hardness,
            point: point
        });
    }

    continueErase(tool, layer, point) {
        const brushEngine = this.app.getExtension('brushEngine');
        if (!brushEngine) return;

        brushEngine.continueStroke({
            context: layer.context,
            point: point
        });
    }

    endErase(tool, layer, point) {
        const brushEngine = this.app.getExtension('brushEngine');
        if (!brushEngine) return;

        brushEngine.endStroke({
            context: layer.context,
            point: point
        });

        layer.context.globalCompositeOperation = 'source-over';

        // レイヤーの更新を通知
        this.app.getManager('layer').notifyLayerChange('content', layer.id);
    }

    // カラーサンプリング
    sampleColor(x, y) {
        const tool = this.state.tools.get('eyedropper');
        if (!tool) return null;

        const size = tool.settings.sampleSize;
        const halfSize = Math.floor(size / 2);
        
        const layerManager = this.app.getManager('layer');
        const canvasManager = this.app.getManager('canvas');
        
        let r = 0, g = 0, b = 0, a = 0;
        let count = 0;

        const samplePixels = (context, x, y) => {
            const imageData = context.getImageData(
                x - halfSize,
                y - halfSize,
                size,
                size
            );

            for (let i = 0; i < imageData.data.length; i += 4) {
                if (imageData.data[i + 3] > 0) {
                    r += imageData.data[i];
                    g += imageData.data[i + 1];
                    b += imageData.data[i + 2];
                    a += imageData.data[i + 3];
                    count++;
                }
            }
        };

        switch (tool.settings.sampleLayer) {
            case 'current':
                const currentLayer = layerManager.getCurrentLayer();
                if (currentLayer) {
                    samplePixels(currentLayer.context, x, y);
                }
                break;

            case 'visible':
                const visibleLayers = layerManager.state.layers.filter(l => l.visible);
                for (const layer of visibleLayers) {
                    samplePixels(layer.context, x, y);
                }
                break;

            case 'all':
                const compositeContext = canvasManager.getContext('main');
                samplePixels(compositeContext, x, y);
                break;
        }

        if (count > 0) {
            r = Math.round(r / count);
            g = Math.round(g / count);
            b = Math.round(b / count);
            a = Math.round(a / count) / 255;

            return tool.settings.includeAlpha ?
                `rgba(${r}, ${g}, ${b}, ${a})` :
                `rgb(${r}, ${g}, ${b})`;
        }

        return null;
    }

    // キーボードイベントハンドラ
    handleKeyDown(event) {
        // モディファイアキーの状態を更新
        this.state.modifiers = {
            shift: event.shiftKey,
            ctrl: event.ctrlKey,
            alt: event.altKey
        };

        // ツールのショートカットキー
        for (const [id, tool] of this.state.tools) {
            if (tool.shortcut && event.key.toUpperCase() === tool.shortcut) {
                event.preventDefault();
                this.setActiveTool(id);
                break;
            }
        }
    }

    handleKeyUp(event) {
        // モディファイアキーの状態を更新
        this.state.modifiers = {
            shift: event.shiftKey,
            ctrl: event.ctrlKey,
            alt: event.altKey
        };
    }

    // イベント通知
    notifyToolChange() {
        this.app.config.container.dispatchEvent(new CustomEvent('tegaki-tool-changed', {
            detail: {
                tool: this.state.activeTool,
                previousTool: this.state.previousTool,
                settings: this.state.activeTool.settings
            }
        }));
    }

    // 状態管理
    getState() {
        return {
            activeTool: this.state.activeTool?.id,
            previousTool: this.state.previousTool,
            tools: Array.from(this.state.tools.entries()).map(([id, tool]) => ({
                id,
                name: tool.name,
                settings: { ...tool.settings }
            })),
            modifiers: { ...this.state.modifiers }
        };
    }

    setState(state) {
        if (!state) return;

        if (state.activeTool) {
            this.setActiveTool(state.activeTool);
        }

        if (state.tools) {
            for (const toolState of state.tools) {
                this.updateToolSettings(toolState.id, toolState.settings);
            }
        }
    }

    // リソース解放
    dispose() {
        // イベントリスナーの解除
        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('keyup', this.handleKeyUp);

        // ツールの状態をリセット
        for (const tool of this.state.tools.values()) {
            if (tool.state.stabilizer?.dispose) {
                tool.state.stabilizer.dispose();
            }
            tool.state = null;
        }

        // 状態のリセット
        this.state = null;
    }
}