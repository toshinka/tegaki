// src/engine/ToolEngineController.js

export class ToolEngineController {
    constructor(serviceContainer) {
        this.serviceContainer = serviceContainer; [cite: 66]
        this.calculationEngine = null; [cite: 67]
        this.renderingEngine = null; [cite: 68]
        this.currentTool = null; [cite: 69]
        this.isDrawing = false; [cite: 69]
    }

    // ツール選択 = 協調エンジン起動（唯一のトリガー） [cite: 70]
    selectTool(toolName) {
        this.disposeCurrentEngines(); [cite: 70]

        this.calculationEngine = this.serviceContainer.resolve('BezierCalculationEngine'); [cite: 71]
        this.renderingEngine = this.serviceContainer.resolve('OGLRenderingEngine'); [cite: 71]

        const canvas = document.getElementById('vector-canvas');
        const toolConfig = this.getToolConfig(toolName);

        this.calculationEngine.setToolConfig(toolConfig.calculation); [cite: 72]
        this.renderingEngine.initialize(canvas, toolConfig.rendering); [cite: 72]
        this.currentTool = toolName;
    }

    startStroke(x, y, pressure = 1.0) {
        if (!this.calculationEngine || !this.renderingEngine) return; [cite: 73]
        this.isDrawing = true; [cite: 73]
        
        // ストローク開始をエンジンに通知
        this.renderingEngine.startStroke();
        
        const pathData = this.calculationEngine.addPoint(x, y, pressure); [cite: 74]
        if (pathData) {
            this.renderingEngine.renderPath(pathData); [cite: 76]
        }
    }

    continueStroke(x, y, pressure = 1.0) {
        if (!this.isDrawing || !this.calculationEngine || !this.renderingEngine) return; [cite: 77]
        
        // 1. 計算エンジンで軌跡セグメントを計算 [cite: 78]
        const pathData = this.calculationEngine.addPoint(x, y, pressure);
        if (!pathData) return;
        
        // 2. 描画エンジンで逐次描画 [cite: 79]
        this.renderingEngine.renderPath(pathData); [cite: 79]
    }

    endStroke() {
        if (!this.isDrawing || !this.calculationEngine || !this.renderingEngine) return; [cite: 80]
        this.isDrawing = false;

        const finalPath = this.calculationEngine.finalizePath(); [cite: 81]
        if (finalPath) {
            this.renderingEngine.renderPath(finalPath); [cite: 82]
        }
        this.renderingEngine.endStroke();
    }
    
    // ツールごとの設定 [cite: 90]
    getToolConfig(toolName) {
        const configs = {
            'pen': {
                calculation: { smoothing: 0.5, baseWidth: 2 }, [cite: 83]
                rendering: { color: [0, 0, 0], alpha: 1.0 } [cite: 84]
            },
            'brush': {
                calculation: { smoothing: 0.7, baseWidth: 15 }, [cite: 85]
                rendering: { color: [0.1, 0.1, 0.1], alpha: 0.5 } [cite: 86]
            },
            'eraser': {
                calculation: { smoothing: 0.3, baseWidth: 20 }, [cite: 87]
                // OGLで消しゴムを実装するには、ブレンドモードを変更するか、
                // フレームバッファに描き込む必要がありますが、ここでは背景色で上書きする簡易実装とします。
                rendering: { color: [1, 1, 1], alpha: 1.0 } [cite: 88, 89]
            }
        };
        return configs[toolName] || configs['pen'];
    }

    disposeCurrentEngines() {
        if (this.renderingEngine) {
            this.renderingEngine.dispose(); [cite: 91]
            this.renderingEngine = null;
        }
        if (this.calculationEngine) {
            this.calculationEngine.finalizePath(); // reset stroke
        }
        this.calculationEngine = null; [cite: 92]
        this.currentTool = null;
        this.isDrawing = false;
    }
}