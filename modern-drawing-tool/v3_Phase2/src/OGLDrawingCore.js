// OGLDrawingCore.js - OGL統一描画エンジン（Phase1封印対象）

import { 
    Renderer, 
    Transform, 
    Camera, 
    Texture, 
    Program, 
    Mesh, 
    Geometry, 
    Vec3, 
    Vec2,
    Polyline
} from 'ogl';

/**
 * 🔥 OGL統一描画エンジン（Phase1基盤・封印対象）
 * 責務: WebGL初期化、シェーダー管理、ストローク描画、筆圧・スムージング
 */
export class OGLUnifiedEngine {
    constructor(canvas) {
        this.canvas = canvas;
        this.renderer = null;
        this.scene = null;
        this.camera = null;
        
        // 描画状態管理
        this.activeStrokes = new Map();
        this.currentStroke = null;
        this.strokeIdCounter = 0;
        
        // ツール設定
        this.currentTool = 'pen';
        this.toolConfig = {
            pen: {
                width: 2,
                color: [0.5, 0.0, 0.0, 1.0], // ふたば色 #800000
                smooth: true,
                pressure: true
            },
            airspray: {
                width: 15,
                color: [0.5, 0.0, 0.0, 0.7],
                smooth: false,
                pressure: true,
                density: 0.6
            },
            blur: {
                width: 8,
                color: [0.0, 0.0, 0.0, 0.3],
                smooth: true,
                blurStrength: 0.5
            },
            eraser: {
                width: 10,
                color: [1.0, 1.0, 1.0, 1.0],
                smooth: true,
                blend: 'destination-out'
            }
        };
        
        // イベントコールバック
        this.onError = null;
        this.onStrokeComplete = null;
        
        // 描画フラグ
        this.isDrawing = false;
        this.needsRender = true;
    }
    
    /**
     * OGLエンジン初期化
     */
    initialize() {
        try {
            // OGL Renderer初期化
            this.renderer = new Renderer({
                canvas: this.canvas,
                alpha: true,
                antialias: true,
                powerPreference: 'high-performance'
            });
            
            this.renderer.setSize(this.canvas.width, this.canvas.height);
            this.renderer.gl.clearColor(0.941, 0.878, 0.839, 1.0); // ふたば背景色 #f0e0d6
            
            // シーン・カメラ初期化
            this.scene = new Transform();
            this.camera = new Camera();
            this.camera.position.set(0, 0, 1);
            
            // 基本シェーダープログラム初期化
            this.initializeShaders();
            
            console.log('✅ OGL統一エンジン初期化完了');
            return true;
            
        } catch (error) {
            console.error('🚨 OGL Engine初期化エラー:', error);
            if (this.onError) this.onError(error);
            return false;
        }
    }
    
    /**
     * 基本シェーダープログラム初期化
     */
    initializeShaders() {
        // 基本線描画シェーダー
        this.lineShader = new Program(this.renderer.gl, {
            vertex: `
                attribute vec3 position;
                attribute vec3 next;
                attribute vec3 prev;
                attribute vec2 uv;
                attribute float side;
                
                uniform mat4 modelViewMatrix;
                uniform mat4 projectionMatrix;
                uniform float uLineWidth;
                uniform vec2 uResolution;
                
                varying vec2 vUv;
                varying float vSide;
                
                void main() {
                    vUv = uv;
                    vSide = side;
                    
                    vec2 aspectVec = vec2(uResolution.x / uResolution.y, 1.0);
                    mat4 projViewModel = projectionMatrix * modelViewMatrix;
                    
                    vec4 currentProjected = projViewModel * vec4(position, 1.0);
                    vec4 nextProjected = projViewModel * vec4(next, 1.0);
                    vec4 prevProjected = projViewModel * vec4(prev, 1.0);
                    
                    vec2 currentScreen = currentProjected.xy / currentProjected.w * uResolution;
                    vec2 nextScreen = nextProjected.xy / nextProjected.w * uResolution;
                    vec2 prevScreen = prevProjected.xy / prevProjected.w * uResolution;
                    
                    vec2 dir1 = normalize(currentScreen - prevScreen);
                    vec2 dir2 = normalize(nextScreen - currentScreen);
                    vec2 dir = normalize(dir1 + dir2);
                    
                    vec2 normal = vec2(-dir.y, dir.x);
                    normal *= uLineWidth * 0.5 * side;
                    normal.x /= aspectVec.x;
                    
                    vec4 offset = vec4(normal / uResolution, 0.0, 0.0);
                    gl_Position = currentProjected + offset;
                }
            `,
            fragment: `
                precision highp float;
                
                uniform vec4 uColor;
                uniform float uOpacity;
                
                varying vec2 vUv;
                varying float vSide;
                
                void main() {
                    float alpha = 1.0 - abs(vSide);
                    alpha = smoothstep(0.0, 1.0, alpha);
                    
                    gl_FragColor = vec4(uColor.rgb, uColor.a * alpha * uOpacity);
                }
            `
        });
        
        // エアスプレー用パーティクルシェーダー
        this.airsprayShader = new Program(this.renderer.gl, {
            vertex: `
                attribute vec3 position;
                attribute float size;
                attribute float alpha;
                
                uniform mat4 modelViewMatrix;
                uniform mat4 projectionMatrix;
                uniform float uPointSize;
                
                varying float vAlpha;
                
                void main() {
                    vAlpha = alpha;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = uPointSize * size;
                }
            `,
            fragment: `
                precision highp float;
                
                uniform vec4 uColor;
                
                varying float vAlpha;
                
                void main() {
                    vec2 center = gl_PointCoord - 0.5;
                    float dist = length(center);
                    float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
                    
                    gl_FragColor = vec4(uColor.rgb, uColor.a * alpha * vAlpha);
                }
            `
        });
    }
    
    /**
     * ツール設定変更
     */
    setTool(toolName, config = {}) {
        if (!this.toolConfig[toolName]) {
            console.warn(`🚨 未知のツール: ${toolName}`);
            return;
        }
        
        this.currentTool = toolName;
        this.toolConfig[toolName] = { ...this.toolConfig[toolName], ...config };
        
        console.log(`🔧 ツール変更: ${toolName}`, this.toolConfig[toolName]);
    }
    
    /**
     * ストローク開始
     */
    startStroke(point, pressure = 1.0) {
        const strokeId = `stroke_${this.strokeIdCounter++}`;
        const config = this.toolConfig[this.currentTool];
        
        this.currentStroke = {
            id: strokeId,
            tool: this.currentTool,
            points: [{ ...point, pressure }],
            config: { ...config },
            mesh: null,
            geometry: null
        };
        
        this.isDrawing = true;
        this.needsRender = true;
        
        console.log(`🖊️ ストローク開始: ${strokeId}`);
        return strokeId;
    }
    
    /**
     * ストローク追加
     */
    addStrokePoint(point, pressure = 1.0) {
        if (!this.currentStroke || !this.isDrawing) return;
        
        this.currentStroke.points.push({ ...point, pressure });
        this.updateStrokeGeometry();
        this.needsRender = true;
    }
    
    /**
     * ストローク終了
     */
    endStroke() {
        if (!this.currentStroke || !this.isDrawing) return;
        
        const stroke = this.currentStroke;
        this.activeStrokes.set(stroke.id, stroke);
        this.isDrawing = false;
        
        console.log(`✅ ストローク完了: ${stroke.id}`, stroke.points.length + '点');
        
        if (this.onStrokeComplete) {
            this.onStrokeComplete(stroke);
        }
        
        this.currentStroke = null;
        this.needsRender = true;
        
        return stroke.id;
    }
    
    /**
     * ストロークジオメトリ更新
     */
    updateStrokeGeometry() {
        if (!this.currentStroke) return;
        
        const stroke = this.currentStroke;
        const points = stroke.points;
        
        if (points.length < 2) return;
        
        // 既存メッシュを削除
        if (stroke.mesh) {
            this.scene.removeChild(stroke.mesh);
        }
        
        // ツール別ジオメトリ生成
        switch (stroke.tool) {
            case 'pen':
            case 'eraser':
                this.createLineGeometry(stroke);
                break;
            case 'airspray':
                this.createAirsprayGeometry(stroke);
                break;
            case 'blur':
                this.createBlurGeometry(stroke);
                break;
        }
    }
    
    /**
     * 線ジオメトリ生成（ペン・消しゴム）
     */
    createLineGeometry(stroke) {
        const points = stroke.points;
        const config = stroke.config;
        
        // スムージング処理
        const smoothedPoints = config.smooth ? 
            this.smoothPoints(points) : points;
        
        // Polyline生成
        const positions = smoothedPoints.map(p => [p.x, p.y, 0]);
        
        stroke.geometry = new Polyline(this.renderer.gl, {
            points: positions,
            vertex: this.lineShader.vertex,
            fragment: this.lineShader.fragment
        });
        
        stroke.mesh = new Mesh(this.renderer.gl, {
            geometry: stroke.geometry,
            program: this.lineShader
        });
        
        // ユニフォーム設定
        stroke.mesh.program.uniforms.uColor = { value: config.color };
        stroke.mesh.program.uniforms.uLineWidth = { value: config.width };
        stroke.mesh.program.uniforms.uOpacity = { value: config.color[3] };
        stroke.mesh.program.uniforms.uResolution = { 
            value: [this.canvas.width, this.canvas.height] 
        };
        
        this.scene.addChild(stroke.mesh);
    }
    
    /**
     * エアスプレージオメトリ生成
     */
    createAirsprayGeometry(stroke) {
        const points = stroke.points;
        const config = stroke.config;
        
        // パーティクル生成
        const particles = [];
        const particleCount = Math.floor(config.width * config.density);
        
        points.forEach((point, index) => {
            for (let i = 0; i < particleCount; i++) {
                const angle = Math.random() * Math.PI * 2;
                const distance = Math.random() * config.width;
                const size = Math.random() * 0.5 + 0.5;
                const alpha = Math.random() * 0.8 + 0.2;
                
                particles.push({
                    position: [
                        point.x + Math.cos(angle) * distance,
                        point.y + Math.sin(angle) * distance,
                        0
                    ],
                    size,
                    alpha
                });
            }
        });
        
        // ジオメトリ作成
        const positions = new Float32Array(particles.length * 3);
        const sizes = new Float32Array(particles.length);
        const alphas = new Float32Array(particles.length);
        
        particles.forEach((particle, i) => {
            positions[i * 3] = particle.position[0];
            positions[i * 3 + 1] = particle.position[1];
            positions[i * 3 + 2] = particle.position[2];
            sizes[i] = particle.size;
            alphas[i] = particle.alpha;
        });
        
        stroke.geometry = new Geometry(this.renderer.gl, {
            position: { size: 3, data: positions },
            size: { size: 1, data: sizes },
            alpha: { size: 1, data: alphas }
        });
        
        stroke.mesh = new Mesh(this.renderer.gl, {
            geometry: stroke.geometry,
            program: this.airsprayShader,
            mode: this.renderer.gl.POINTS
        });
        
        // ユニフォーム設定
        stroke.mesh.program.uniforms.uColor = { value: config.color };
        stroke.mesh.program.uniforms.uPointSize = { value: 8.0 };
        
        this.scene.addChild(stroke.mesh);
    }
    
    /**
     * ボカシジオメトリ生成
     */
    createBlurGeometry(stroke) {
        // 基本的には線ジオメトリと同じだが、ブレンドモードが違う
        this.createLineGeometry(stroke);
        
        // ブレンドモード設定
        if (stroke.mesh) {
            const gl = this.renderer.gl;
            stroke.mesh.beforeRender = () => {
                gl.enable(gl.BLEND);
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            };
        }
    }
    
    /**
     * ポイントスムージング
     */
    smoothPoints(points, factor = 0.3) {
        if (points.length < 3) return points;
        
        const smoothed = [points[0]]; // 最初の点はそのまま
        
        for (let i = 1; i < points.length - 1; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            const next = points[i + 1];
            
            const smoothedPoint = {
                x: curr.x + (prev.x + next.x - 2 * curr.x) * factor,
                y: curr.y + (prev.y + next.y - 2 * curr.y) * factor,
                pressure: curr.pressure
            };
            
            smoothed.push(smoothedPoint);
        }
        
        smoothed.push(points[points.length - 1]); // 最後の点はそのまま
        return smoothed;
    }
    
    /**
     * レンダリングループ開始
     */
    startRenderLoop() {
        const render = () => {
            if (this.needsRender) {
                this.renderer.render({ scene: this.scene, camera: this.camera });
                this.needsRender = false;
            }
            requestAnimationFrame(render);
        };
        
        render();
        console.log('🚀 OGLレンダリングループ開始');
    }
    
    /**
     * キャンバスリサイズ
     */
    resize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.renderer.setSize(width, height);
        this.needsRender = true;
        
        console.log(`📏 キャンバスリサイズ: ${width}x${height}`);
    }
    
    /**
     * 全ストローククリア
     */
    clearAllStrokes() {
        this.activeStrokes.forEach(stroke => {
            if (stroke.mesh) {
                this.scene.removeChild(stroke.mesh);
            }
        });
        
        this.activeStrokes.clear();
        this.currentStroke = null;
        this.isDrawing = false;
        this.needsRender = true;
        
        console.log('🗑️ 全ストローククリア');
    }
    
    /**
     * ストローク削除
     */
    removeStroke(strokeId) {
        const stroke = this.activeStrokes.get(strokeId);
        if (stroke && stroke.mesh) {
            this.scene.removeChild(stroke.mesh);
            this.activeStrokes.delete(strokeId);
            this.needsRender = true;
            
            console.log(`🗑️ ストローク削除: ${strokeId}`);
        }
    }
    
    /**
     * エンジン状態取得
     */
    getEngineState() {
        return {
            isInitialized: !!this.renderer,
            isDrawing: this.isDrawing,
            currentTool: this.currentTool,
            activeStrokeCount: this.activeStrokes.size,
            canvasSize: {
                width: this.canvas.width,
                height: this.canvas.height
            }
        };
    }
}