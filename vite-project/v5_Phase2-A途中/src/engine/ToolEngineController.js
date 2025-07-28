// src/engine/ToolEngineController.js

export class ToolEngineController {
    constructor(serviceContainer) {
        this.serviceContainer = serviceContainer;
        
        // 専門エンジンの責務分離
        this.calculationEngine = null; // 計算専門
        this.renderingEngine = null;   // 描画専門
        
        this.currentTool = null;
        this.isDrawing = false;
        this.canvas = null;
        this.initializationPromise = null;
        this.isInitializing = false;
    }

    // ツール選択 = 協調エンジン起動（唯一のトリガー）
    async selectTool(toolName) {
        console.log(`Selecting tool: ${toolName}`);
        
        try {
            // 有効なツール名かチェック
            if (!this.isValidTool(toolName)) {
                throw new Error(`Invalid tool name: ${toolName}`);
            }

            // 既に初期化中の場合は待機
            if (this.isInitializing && this.initializationPromise) {
                console.log('Already initializing, waiting...');
                await this.initializationPromise;
            }

            // 同じツールが既に選択されている場合はスキップ
            if (this.currentTool === toolName && this.isReady()) {
                console.log(`Tool ${toolName} already selected and ready`);
                return;
            }

            // 既存エンジンを停止
            this.disposeCurrentEngines();

            // 初期化フラグを設定
            this.isInitializing = true;

            // 初期化を開始
            this.initializationPromise = this.initializeEngines(toolName);
            await this.initializationPromise;
            
            this.currentTool = toolName;
            this.isInitializing = false;
            
            console.log(`Tool selected successfully: ${toolName}`);
        } catch (error) {
            console.error('Failed to select tool:', error);
            this.isInitializing = false;
            this.disposeCurrentEngines();
            throw error;
        }
    }

    // エンジンの初期化
    async initializeEngines(toolName) {
        console.log(`Initializing engines for tool: ${toolName}`);
        
        try {
            // キャンバス要素を取得
            this.canvas = document.getElementById('vector-canvas');
            if (!this.canvas) {
                throw new Error('Canvas element not found');
            }

            console.log('Canvas element found');

            // DIコンテナから専門エンジンを新規取得
            console.log('Creating calculation engine...');
            const BezierCalculationEngine = this.serviceContainer.services.get('BezierCalculationEngine');
            if (!BezierCalculationEngine) {
                throw new Error('BezierCalculationEngine factory not found');
            }
            this.calculationEngine = BezierCalculationEngine();
            
            console.log('Creating rendering engine...');
            const OGLRenderingEngine = this.serviceContainer.services.get('OGLRenderingEngine');
            if (!OGLRenderingEngine) {
                throw new Error('OGLRenderingEngine factory not found');
            }
            this.renderingEngine = OGLRenderingEngine();

            if (!this.calculationEngine || !this.renderingEngine) {
                throw new Error('Failed to create engines');
            }

            console.log('Engines created successfully');

            // エンジン設定を取得
            const toolConfig = this.getToolConfig(toolName);
            
            console.log('Setting calculation engine config...');
            this.calculationEngine.setToolConfig(toolConfig.calculation);
            
            console.log('Initializing rendering engine...');
            this.renderingEngine.initialize(this.canvas, toolConfig.rendering);
            
            // 初期化完了を確認
            if (!this.renderingEngine.isInitialized()) {
                throw new Error('Rendering engine failed to initialize');
            }
            
            console.log('Engines initialized successfully');
            
            // 初期化完了後に少し待機（WebGLコンテキスト安定化のため）
            await new Promise(resolve => setTimeout(resolve, 50));
            
        } catch (error) {
            console.error('Failed to initialize engines:', error);
            throw error;
        }
    }

    // ツール設定の更新
    updateToolSettings() {
        if (!this.currentTool || !this.calculationEngine || !this.renderingEngine) {
            console.warn('Cannot update settings: engines not initialized');
            return;
        }
        
        try {
            const toolConfig = this.getToolConfigFromUI();
            this.calculationEngine.setToolConfig(toolConfig.calculation);
            this.renderingEngine.updateConfig(toolConfig.rendering);
            console.log('Tool settings updated');
        } catch (error) {
            console.error('Failed to update tool settings:', error);
        }
    }

    // 描画開始（協調フロー）
    startStroke(x, y, pressure = 1.0) {
        // 準備状態を確認（初期化中は待機）
        if (this.isInitializing) {
            console.warn('Still initializing, cannot start stroke');
            return;
        }
        
        if (!this.isReady()) {
            console.warn('Engines not ready for drawing:', {
                calculationEngine: !!this.calculationEngine,
                renderingEngine: !!this.renderingEngine,
                renderingInitialized: this.renderingEngine ? this.renderingEngine.isInitialized() : false,
                currentTool: this.currentTool
            });
            return;
        }
        
        if (this.isDrawing) {
            console.warn('Already drawing, ending previous stroke');
            this.endStroke();
        }
        
        try {
            console.log(`Starting stroke at (${x}, ${y}) with pressure ${pressure}`);
            this.isDrawing = true;
            
            // 計算エンジンに最初の点を追加
            const pathData = this.calculationEngine.addPoint(x, y, pressure);
            
            // まだ描画データがない場合でも初期点を描画
            if (!pathData) {
                // 初期点用の小さなセグメントを作成
                const initialSegment = {
                    points: [
                        { x, y, pressure },
                        { x: x + 0.1, y: y + 0.1, pressure }
                    ],
                    controlPoints: [],
                    widths: [this.calculateWidth(pressure), this.calculateWidth(pressure)],
                    timestamp: Date.now(),
                    toolType: 'initial'
                };
                this.renderingEngine.renderPath(initialSegment);
                console.log('Initial point rendered');
                return;
            }
            
            // 描画エンジンで初期描画
            this.renderingEngine.renderPath(pathData);
            console.log('Initial stroke rendered');
        } catch (error) {
            console.error('Failed to start stroke:', error);
            this.isDrawing = false;
        }
    }

    // 筆圧から線幅を計算するヘルパーメソッド
    calculateWidth(pressure) {
        const toolConfig = this.getToolConfig(this.currentTool);
        const basePressure = pressure || 1.0;
        const pressureEffect = Math.pow(basePressure, toolConfig.calculation.pressureSensitivity);
        return Math.max(0.5, pressureEffect * toolConfig.calculation.baseWidth);
    }

    // 描画継続（協調フロー）
    continueStroke(x, y, pressure = 1.0) {
        if (!this.isDrawing || !this.isReady() || this.isInitializing) {
            return;
        }
        
        try {
            // 1. 計算エンジンで軌跡セグメントを計算
            const pathData = this.calculationEngine.addPoint(x, y, pressure);
            
            if (!pathData) return;
            
            // 2. 描画エンジンで逐次描画
            this.renderingEngine.renderPath(pathData);
        } catch (error) {
            console.error('Failed to continue stroke:', error);
            this.endStroke();
        }
    }

    // 描画終了（協調フロー）
    endStroke() {
        if (!this.isDrawing || !this.isReady() || this.isInitializing) {
            this.isDrawing = false;
            return;
        }
        
        try {
            console.log('Ending stroke');
            this.isDrawing = false;
            
            // 最終的な軌跡を計算・描画
            const finalPath = this.calculationEngine.finalizePath();
            
            if (finalPath) {
                this.renderingEngine.renderPath(finalPath);
                console.log('Final stroke rendered');
            }
        } catch (error) {
            console.error('Failed to end stroke:', error);
        }
    }

    // キャンバスをクリア
    clearCanvas() {
        if (!this.renderingEngine || this.isInitializing) {
            console.warn('Rendering engine not available for clearing');
            return;
        }
        
        try {
            this.renderingEngine.clear();
            console.log('Canvas cleared');
        } catch (error) {
            console.error('Failed to clear canvas:', error);
        }
    }

    // ツール設定の取得（修正版）
    getToolConfig(toolName) {
        const configs = {
            'pen': {
                calculation: { 
                    smoothing: 0.5, 
                    minDistance: 1, // より小さい値に変更
                    baseWidth: 2,
                    pressureSensitivity: 1.2 // 筆圧感度を上げる
                },
                rendering: { 
                    lineWidth: 2, 
                    alpha: 1.0, 
                    color: [128/255, 0, 0], // #800000 に修正
                    blendMode: 'normal'
                }
            },
            'brush': {
                calculation: { 
                    smoothing: 0.7, 
                    minDistance: 1,
                    baseWidth: 8,
                    pressureSensitivity: 1.5
                },
                rendering: { 
                    lineWidth: 8, 
                    alpha: 0.8, 
                    color: [128/255, 0, 0],
                    blendMode: 'normal'
                }
            },
            'eraser': {
                calculation: { 
                    smoothing: 0.3, 
                    minDistance: 2,
                    baseWidth: 10,
                    pressureSensitivity: 0.8
                },
                rendering: { 
                    lineWidth: 10, 
                    alpha: 1.0, 
                    color: [1, 1, 1],
                    blendMode: 'destination-out'
                }
            }
        };
        
        return configs[toolName] || configs['pen'];
    }

    // UIから動的に設定を取得
    getToolConfigFromUI() {
        const baseConfig = this.getToolConfig(this.currentTool);
        
        // ペンサイズの取得
        const penSizeSlider = document.getElementById('penSizeSlider');
        const penSize = penSizeSlider ? parseFloat(penSizeSlider.value) : baseConfig.calculation.baseWidth;
        
        // 透明度の取得
        const penOpacitySlider = document.getElementById('penOpacitySlider');
        const opacity = penOpacitySlider ? parseFloat(penOpacitySlider.value) / 100 : baseConfig.rendering.alpha;
        
        return {
            calculation: {
                ...baseConfig.calculation,
                baseWidth: penSize
            },
            rendering: {
                ...baseConfig.rendering,
                lineWidth: penSize,
                alpha: opacity
            }
        };
    }

    // 現在のエンジンを完全停止
    disposeCurrentEngines() {
        try {
            console.log('Disposing current engines...');
            
            // 描画を強制終了
            this.isDrawing = false;
            
            if (this.renderingEngine) {
                this.renderingEngine.dispose();
                this.renderingEngine = null;
            }
            
            if (this.calculationEngine) {
                this.calculationEngine.reset();
                this.calculationEngine = null;
            }
            
            this.currentTool = null;
            this.initializationPromise = null;
            
            console.log('Engines disposed');
        } catch (error) {
            console.error('Failed to dispose engines:', error);
        }
    }

    // 現在のツール名を取得
    getCurrentTool() {
        return this.currentTool;
    }

    // 描画状態を取得
    isCurrentlyDrawing() {
        return this.isDrawing;
    }

    // エンジンの準備状態を確認
    isReady() {
        const ready = !this.isInitializing &&
                     this.calculationEngine && 
                     this.renderingEngine && 
                     this.renderingEngine.isInitialized() && 
                     this.currentTool;
        
        if (!ready) {
            console.log('Engine readiness check failed:', {
                isInitializing: this.isInitializing,
                hasCalculationEngine: !!this.calculationEngine,
                hasRenderingEngine: !!this.renderingEngine,
                renderingEngineInitialized: this.renderingEngine ? this.renderingEngine.isInitialized() : false,
                hasCurrentTool: !!this.currentTool
            });
        }
        
        return ready;
    }

    // 有効なツール名かチェック
    isValidTool(toolName) {
        const validTools = ['pen', 'brush', 'eraser'];
        return validTools.includes(toolName);
    }

    // 初期化状態を取得
    isInitialized() {
        return this.isReady();
    }

    // 統計情報を取得
    getStats() {
        return {
            currentTool: this.currentTool,
            isDrawing: this.isDrawing,
            isInitializing: this.isInitializing,
            isReady: this.isReady(),
            calculationEngine: this.calculationEngine ? this.calculationEngine.getCurrentStrokeInfo() : null,
            renderingEngine: this.renderingEngine ? this.renderingEngine.getStats() : null
        };
    }
}