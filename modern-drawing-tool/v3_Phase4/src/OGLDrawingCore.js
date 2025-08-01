import { Renderer, Camera, Transform, Geometry, Program, Mesh, Vec2, Vec3 } from 'ogl';

/**
 * OGLDrawingCore - OGL統一描画エンジン（Phase1基盤）
 * Canvas2D完全禁止・OGL WebGL統一による高品質描画
 */
export class OGLDrawingCore {
    constructor(canvas, eventStore) {
        this.canvas = canvas;
        this.eventStore = eventStore;
        
        // OGL基盤初期化
        this.renderer = null;
        this.scene = null;
        this.camera = null;
        
        // 描画システム
        this.currentTool = 'pen';
        this.isDrawing = false;
        this.currentStroke = null;
        this.strokes = [];
        this.currentLayer = null;
        
        // 描画設定
        this.drawingConfig = {
            pen: {
                size: 3,
                opacity: 1.0,
                color: [0.5, 0.0, 0.0], // ふたば色マルーン
                pressure: true,
                smoothing: 0.5
            },
            eraser: {
                size: 10,
                opacity: 1.0,
                hardness: 0.8
            },
            airspray: {
                size: 20,
                opacity: 0.3,
                density: 0.6,
                scatter: 1.0
            }
        };
        
        // パフォーマンス最適化
        this.renderQueue = [];
        this.needsRedraw = true;
        this.frameCount = 0;
        
        this.setupEventListeners();
    }
    
    // OGL WebGL初期化
    async initialize() {
        try {
            // OGL Renderer初期化（Canvas2D完全禁止）
            this.renderer = new Renderer({
                canvas: this.canvas,
                alpha: true,
                antialias: true,
                powerPreference: 'high-performance'
            });
            
            // シーン・カメラ設定
            this.scene = new Transform();
            this.camera = new Camera({
                fov: 45,
                aspect: this.canvas.width / this.canvas.height,
                near: 0.1,
                far: 1000
            });
            
            // カメラ位置調整
            this.camera.position.set(0, 0, 10);
            
            // シェーダー初期化
            await this.initializeShaders();
            
            // レンダーループ開始
            this.startRenderLoop();
            
            // 初期レイヤー作成
            this.createInitialLayer();
            
            console.log('✅ OGL Drawing Engine initialized');
            this.eventStore.emit(this.eventStore.eventTypes.ENGINE_READY);
            
        } catch (error) {
            console.error('🚨 OGL Engine initialization failed:', error);
            this.eventStore.emit(this.eventStore.eventTypes.ENGINE_ERROR, { error });
            throw error;
        }
    }
    
    // シェーダー初期化
    async initializeShaders() {
        // ペンシェーダー
        this.penProgram = new Program(this.renderer.gl, {
            vertex: this.getVertexShader(),
            fragment: this.getPenFragmentShader(),
            uniforms: {
                uTime: { value: 0 },
                uColor: { value: [0.5, 0.0, 0.0] },
                uOpacity: { value: 1.0 },
                uSize: { value: 3.0 }
            }
        });
        
        // エアスプレーシェーダー
        this.airsprayProgram = new Program(this.renderer.gl, {
            vertex: this.getVertexShader(),
            fragment: this.getAirsprayFragmentShader(),
            uniforms: {
                uTime: { value: 0 },
                uColor: { value: [0.5, 0.0, 0.0] },
                uOpacity: { value: 0.3 },
                uSize: { value: 20.0 },
                uDensity: { value: 0.6 }
            }
        });
        
        // 消しゴムシェーダー
        this.eraserProgram = new Program(this.renderer.gl, {
            vertex: this.getVertexShader(),
            fragment: this.getEraserFragmentShader(),
            uniforms: {
                uSize: { value: 10.0 },
                uHardness: { value: 0.8 }
            }
        });
    }
    
    // ストローク開始
    startStroke(point, pressure = 1.0) {
        if (this.isDrawing) return;
        
        this.isDrawing = true;
        this.currentStroke = {
            id: this.generateStrokeId(),
            tool: this.currentTool,
            points: [{ ...point, pressure }],
            config: { ...this.drawingConfig[this.currentTool] },
            geometry: null,
            mesh: null,
            timestamp: Date.now()
        };
        
        this.eventStore.emit(this.eventStore.eventTypes.STROKE_START, {
            strokeId: this.currentStroke.id,
            tool: this.currentTool,
            point
        });
        
        this.createStrokeGeometry();
    }
    
    // ストローク更新
    updateStroke(point, pressure = 1.0) {
        if (!this.isDrawing || !this.currentStroke) return;
        
        // スムージング適用
        const smoothedPoint = this.applySmoothingFilter(point);
        this.currentStroke.points.push({ ...smoothedPoint, pressure });
        
        // ジオメトリ更新
        this.updateStrokeGeometry();
        
        this.eventStore.emit(this.eventStore.eventTypes.STROKE_UPDATE, {
            strokeId: this.currentStroke.id,
            point: smoothedPoint,
            pointCount: this.currentStroke.points.length
        });
        
        this.needsRedraw = true;
    }
    
    // ストローク終了
    endStroke() {
        if (!this.isDrawing || !this.currentStroke) return;
        
        this.isDrawing = false;
        
        // ストローク確定
        this.finalizeStroke();
        this.strokes.push(this.currentStroke);
        
        this.eventStore.emit(this.eventStore.eventTypes.STROKE_COMPLETE, {
            strokeId: this.currentStroke.id,
            pointCount: this.currentStroke.points.length,
            tool: this.currentTool
        });
        
        this.currentStroke = null;
        this.needsRedraw = true;
    }
    
    // ストロークジオメトリ作成
    createStrokeGeometry() {
        if (!this.currentStroke) return;
        
        const points = this.currentStroke.points;
        if (points.length < 1) return;
        
        // OGL Geometry作成（Canvas2D禁止・WebGL統一）
        const vertices = [];
        const indices = [];
        
        points.forEach((point, index) => {
            vertices.push(point.x, point.y, 0);
            if (index > 0) {
                indices.push(index - 1, index);
            }
        });
        
        this.currentStroke.geometry = new Geometry(this.renderer.gl, {
            position: { size: 3, data: new Float32Array(vertices) },
            index: { data: new Uint16Array(indices) }
        });
        
        // メッシュ作成
        const program = this.getToolProgram(this.currentTool);
        this.currentStroke.mesh = new Mesh(this.renderer.gl, {
            geometry: this.currentStroke.geometry,
            program: program
        });
        
        if (this.currentLayer) {
            this.currentStroke.mesh.setParent(this.currentLayer);
        }
    }
    
    // ストロークジオメトリ更新
    updateStrokeGeometry() {
        if (!this.currentStroke || !this.currentStroke.geometry) return;
        
        const points = this.currentStroke.points;
        const vertices = [];
        const indices = [];
        
        points.forEach((point, index) => {
            vertices.push(point.x, point.y, 0);
            if (index > 0) {
                indices.push(index - 1, index);
            }
        });
        
        // OGL Geometry更新
        this.currentStroke.geometry.attributes.position.data = new Float32Array(vertices);
        this.currentStroke.geometry.attributes.index.data = new Uint16Array(indices);
        this.currentStroke.geometry.attributes.position.needsUpdate = true;
        this.currentStroke.geometry.attributes.index.needsUpdate = true;
    }
    
    // スムージングフィルター
    applySmoothingFilter(point) {
        if (!this.currentStroke || this.currentStroke.points.length < 2) {
            return point;
        }
        
        const smoothing = this.currentStroke.config.smoothing || 0.5;
        const lastPoint = this.currentStroke.points[this.currentStroke.points.length - 1];
        
        return {
            x: lastPoint.x + (point.x - lastPoint.x) * (1 - smoothing),
            y: lastPoint.y + (point.y - lastPoint.y) * (1 - smoothing)
        };
    }
    
    // ツール変更
    setTool(toolName) {
        if (this.isDrawing) {
            this.endStroke();
        }
        
        this.currentTool = toolName;
        this.eventStore.emit(this.eventStore.eventTypes.TOOL_CHANGE, { tool: toolName });
    }
    
    // ツール設定更新
    updateToolConfig(toolName, config) {
        this.drawingConfig[toolName] = { ...this.drawingConfig[toolName], ...config };
        
        this.eventStore.emit(this.eventStore.eventTypes.TOOL_CONFIG_CHANGE, {
            tool: toolName,
            config: this.drawingConfig[toolName]
        });
    }
    
    // レンダーループ
    startRenderLoop() {
        const render = (time) => {
            if (this.needsRedraw) {
                // シェーダー時間更新
                if (this.penProgram) {
                    this.penProgram.uniforms.uTime.value = time * 0.001;
                }
                if (this.airsprayProgram) {
                    this.airsprayProgram.uniforms.uTime.value = time * 0.001;
                }
                
                // レンダー実行
                this.renderer.render({ scene: this.scene, camera: this.camera });
                this.needsRedraw = false;
            }
            
            this.frameCount++;
            requestAnimationFrame(render);
        };
        
        requestAnimationFrame(render);
    }
    
    // 初期レイヤー作成
    createInitialLayer() {
        this.currentLayer = new Transform();
        this.currentLayer.setParent(this.scene);
        console.log('✅ Initial layer created');
    }
    
    // シェーダー取得
    getToolProgram(toolName) {
        switch (toolName) {
            case 'pen': return this.penProgram;
            case 'airspray': return this.airsprayProgram;
            case 'eraser': return this.eraserProgram;
            default: return this.penProgram;
        }
    }
    
    // 頂点シェーダー
    getVertexShader() {
        return `
            attribute vec3 position;
            uniform mat4 modelViewMatrix;
            uniform mat4 projectionMatrix;
            
            void main() {
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = 10.0;
            }
        `;
    }
    
    // ペンフラグメントシェーダー
    getPenFragmentShader() {
        return `
            precision mediump float;
            uniform vec3 uColor;
            uniform float uOpacity;
            uniform float uTime;
            
            void main() {
                vec2 center = gl_PointCoord - 0.5;
                float dist = length(center);
                float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
                gl_FragColor = vec4(uColor, alpha * uOpacity);
            }
        `;
    }
    
    // エアスプレーフラグメントシェーダー
    getAirsprayFragmentShader() {
        return `
            precision mediump float;
            uniform vec3 uColor;
            uniform float uOpacity;
            uniform float uDensity;
            uniform float uTime;
            
            void main() {
                vec2 center = gl_PointCoord - 0.5;
                float dist = length(center);
                float noise = sin(uTime + gl_FragCoord.x * 0.1) * sin(uTime + gl_FragCoord.y * 0.1);
                float alpha = (1.0 - smoothstep(0.0, 0.5, dist)) * uDensity * (0.5 + noise * 0.3);
                gl_FragColor = vec4(uColor, alpha * uOpacity);
            }
        `;
    }
    
    // 消しゴムフラグメントシェーダー
    getEraserFragmentShader() {
        return `
            precision mediump float;
            uniform float uHardness;
            
            void main() {
                vec2 center = gl_PointCoord - 0.5;
                float dist = length(center);
                float alpha = 1.0 - smoothstep(0.0, 0.5 * uHardness, dist);
                gl_FragColor = vec4(0.0, 0.0, 0.0, alpha);
            }
        `;
    }
    
    // ストロークID生成
    generateStrokeId() {
        return `stroke_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // ストローク確定
    finalizeStroke() {
        if (!this.currentStroke) return;
        
        // 最適化処理
        this.optimizeStrokeGeometry();
    }
    
    // ジオメトリ最適化
    optimizeStrokeGeometry() {
        // 点の間引き・最適化処理
        if (!this.currentStroke || this.currentStroke.points.length < 3) return;
        
        const threshold = 2.0; // 最小距離閾値
        const optimizedPoints = [this.currentStroke.points[0]];
        
        for (let i = 1; i < this.currentStroke.points.length - 1; i++) {
            const prevPoint = optimizedPoints[optimizedPoints.length - 1];
            const currentPoint = this.currentStroke.points[i];
            const distance = Math.sqrt(
                Math.pow(currentPoint.x - prevPoint.x, 2) +
                Math.pow(currentPoint.y - prevPoint.y, 2)
            );
            
            if (distance >= threshold) {
                optimizedPoints.push(currentPoint);
            }
        }
        
        // 最後の点は必ず追加
        optimizedPoints.push(this.currentStroke.points[this.currentStroke.points.length - 1]);
        
        this.currentStroke.points = optimizedPoints;
        this.updateStrokeGeometry();
    }
    
    // イベントリスナー設定
    setupEventListeners() {
        // ウィンドウリサイズ対応
        window.addEventListener('resize', () => {
            this.handleResize();
        });
    }
    
    // リサイズ処理
    handleResize() {
        const { clientWidth, clientHeight } = this.canvas.parentElement;
        this.canvas.width = clientWidth;
        this.canvas.height = clientHeight;
        
        if (this.renderer) {
            this.renderer.setSize(clientWidth, clientHeight);
        }
        
        if (this.camera) {
            this.camera.aspect = clientWidth / clientHeight;
            this.camera.updateProjectionMatrix();
        }
        
        this.needsRedraw = true;
    }
    
    // Canvas2D使用禁止チェック
    preventCanvas2D() {
        const originalGetContext = this.canvas.getContext;
        this.canvas.getContext = (contextType, ...args) => {
            if (contextType === '2d') {
                throw new Error('🚨 Canvas2D is prohibited! Use OGL WebGL only.');
            }
            return originalGetContext.call(this.canvas, contextType, ...args);
        };
    }
    
    // デバッグ情報
    getDebugInfo() {
        return {
            strokeCount: this.strokes.length,
            isDrawing: this.isDrawing,
            currentTool: this.currentTool,
            frameCount: this.frameCount,
            rendererInfo: this.renderer ? {
                drawingBufferWidth: this.renderer.gl.drawingBufferWidth,
                drawingBufferHeight: this.renderer.gl.drawingBufferHeight
            } : null
        };
    }
}