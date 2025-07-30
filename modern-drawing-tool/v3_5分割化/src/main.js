// Phase1.5: OGL統一エンジン核心のみ（200行以内・5分割最適化対応）
import { Renderer, Camera, Transform, Mesh, Program, Geometry, Vec3 } from 'ogl';
import { UIController } from './UIController.js';
import { OGLQualityEnhancer } from './OGLQualityEnhancer.js';
import { OGLInteractionEnhancer } from './OGLInteractionEnhancer.js';
import { OGLProEnhancer } from './OGLProEnhancer.js';

class OGLUnifiedEngine {
    constructor(canvas) {
        this.canvas = canvas;
        
        // OGL統一基盤初期化
        this.renderer = new Renderer({
            canvas: canvas,
            alpha: true,
            antialias: true
        });
        
        this.gl = this.renderer.gl;
        this.camera = new Camera(this.gl);
        this.scene = new Transform();
        
        // カメラ設定（2D描画用正投影）
        this.camera.orthographic({
            left: -canvas.width / 2,
            right: canvas.width / 2,
            bottom: -canvas.height / 2,
            top: canvas.height / 2,
            near: 0.1,
            far: 100
        });
        this.camera.position.z = 1;
        
        // 基本描画システム
        this.strokes = [];
        this.currentStroke = null;
        this.isDrawing = false;
        
        // ペン基本設定
        this.penSize = 3;
        this.opacity = 1.0;
        this.pressureSensitivity = 0.5;
        this.smoothing = true;
        
        // パフォーマンス測定
        this.frameCount = 0;
        this.lastTime = performance.now();
        this.fps = 60;
        
        // 5分割拡張システム統合点
        this.uiController = null;
        this.qualityEnhancer = null;
        this.interactionEnhancer = null;
        this.proEnhancer = null;
        
        this.initEnhancers();
        this.setupBasicEventListeners();
        this.startRenderLoop();
    }
    
    // OGL統一拡張システム初期化
    initEnhancers() {
        this.uiController = new UIController(this);
        this.qualityEnhancer = new OGLQualityEnhancer(this);
        this.interactionEnhancer = new OGLInteractionEnhancer(this);
        this.proEnhancer = new OGLProEnhancer(this);
    }
    
    // 基本イベントリスナー（OGL統一核心のみ）
    setupBasicEventListeners() {
        this.canvas.addEventListener('pointerdown', this.startDrawing.bind(this));
        this.canvas.addEventListener('pointermove', this.draw.bind(this));
        this.canvas.addEventListener('pointerup', this.stopDrawing.bind(this));
        this.canvas.addEventListener('pointercancel', this.stopDrawing.bind(this));
        this.canvas.addEventListener('pointerleave', this.stopDrawing.bind(this));
        
        this.canvas.addEventListener('contextmenu', e => e.preventDefault());
        this.canvas.addEventListener('touchstart', e => e.preventDefault());
        this.canvas.addEventListener('touchmove', e => e.preventDefault());
    }
    
    // OGL統一座標変換
    getCanvasCoordinates(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left - this.canvas.width / 2;
        const y = -(event.clientY - rect.top - this.canvas.height / 2);
        const pressure = event.pressure || 0.5;
        return { x, y, pressure };
    }
    
    // OGL統一描画開始
    startDrawing(event) {
        this.isDrawing = true;
        const pos = this.getCanvasCoordinates(event);
        
        this.currentStroke = {
            points: [{ 
                x: pos.x, 
                y: pos.y, 
                pressure: pos.pressure,
                timestamp: performance.now()
            }],
            baseSize: this.penSize,
            opacity: this.opacity,
            mesh: null,
            vertices: [],
            indices: []
        };
        
        event.preventDefault();
    }
    
    // OGL統一描画処理
    draw(event) {
        if (!this.isDrawing || !this.currentStroke) return;
        
        const pos = this.getCanvasCoordinates(event);
        const points = this.currentStroke.points;
        const lastPoint = points[points.length - 1];
        
        const dx = pos.x - lastPoint.x;
        const dy = pos.y - lastPoint.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 1) return;
        
        const newPoint = {
            x: pos.x,
            y: pos.y,
            pressure: pos.pressure,
            timestamp: performance.now()
        };
        
        points.push(newPoint);
        this.updateCurrentStroke();
        event.preventDefault();
    }
    
    // OGL統一描画終了
    stopDrawing(event) {
        if (!this.isDrawing || !this.currentStroke) return;
        
        this.isDrawing = false;
        
        if (this.currentStroke.points.length >= 1) {
            this.strokes.push(this.currentStroke);
        }
        
        this.currentStroke = null;
        this.updateStatus();
        event.preventDefault();
    }
    
    // OGL統一ストローク更新
    updateCurrentStroke() {
        const points = this.currentStroke.points;
        if (points.length < 2) return;
        
        // 最新セグメントのみ追加
        const p1 = points[points.length - 2];
        const p2 = points[points.length - 1];
        this.addLineSegment(p1, p2, this.currentStroke);
        this.updateStrokeMesh(this.currentStroke);
    }
    
    // OGL統一線分追加
    addLineSegment(p1, p2, stroke) {
        const size = stroke.baseSize;
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length === 0) return;
        
        const perpX = (-dy / length) * (size / 2);
        const perpY = (dx / length) * (size / 2);
        
        const baseIndex = stroke.vertices.length / 3;
        
        stroke.vertices.push(
            p1.x + perpX, p1.y + perpY, 0,
            p1.x - perpX, p1.y - perpY, 0,
            p2.x + perpX, p2.y + perpY, 0,
            p2.x - perpX, p2.y - perpY, 0
        );
        
        stroke.indices.push(
            baseIndex, baseIndex + 1, baseIndex + 2,
            baseIndex + 1, baseIndex + 3, baseIndex + 2
        );
    }
    
    // OGL統一メッシュ更新
    updateStrokeMesh(stroke) {
        if (stroke.vertices.length === 0) return;
        
        if (stroke.mesh) {
            stroke.mesh.setParent(null);
        }
        
        this.createMeshFromGeometry(stroke.vertices, stroke.indices, stroke);
    }
    
    // OGL統一ジオメトリからメッシュ作成
    createMeshFromGeometry(vertices, indices, stroke) {
        const geometry = new Geometry(this.gl, {
            position: { size: 3, data: new Float32Array(vertices) },
            index: { data: new Uint16Array(indices) }
        });
        
        const program = new Program(this.gl, {
            vertex: `
                attribute vec3 position;
                uniform mat4 modelViewMatrix;
                uniform mat4 projectionMatrix;
                
                void main() {
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragment: `
                precision mediump float;
                uniform float uOpacity;
                uniform vec3 uColor;
                
                void main() {
                    gl_FragColor = vec4(uColor, uOpacity);
                }
            `,
            uniforms: {
                uOpacity: { value: stroke.opacity },
                uColor: { value: [0.5, 0.0, 0.0] }
            }
        });
        
        stroke.mesh = new Mesh(this.gl, { geometry, program });
        stroke.mesh.setParent(this.scene);
    }
    
    // OGL統一レンダリングループ
    startRenderLoop() {
        const animate = (currentTime) => {
            this.frameCount++;
            if (currentTime - this.lastTime >= 1000) {
                this.fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastTime));
                this.frameCount = 0;
                this.lastTime = currentTime;
                this.updateStatus();
            }
            
            this.render();
            requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
    }
    
    // OGL統一レンダリング
    render() {
        this.renderer.render({ scene: this.scene, camera: this.camera });
    }
    
    // 基本制御メソッド（拡張システム用）
    resizeCanvas(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        
        this.camera.orthographic({
            left: -width / 2,
            right: width / 2,
            bottom: -height / 2,
            top: height / 2,
            near: 0.1,
            far: 100
        });
        
        this.render();
    }
    
    clear() {
        this.strokes.forEach(stroke => {
            if (stroke.mesh) {
                stroke.mesh.setParent(null);
            }
        });
        this.strokes = [];
        
        if (this.currentStroke && this.currentStroke.mesh) {
            this.currentStroke.mesh.setParent(null);
        }
        this.currentStroke = null;
        this.isDrawing = false;
        
        this.render();
    }
    
    undo() {
        if (this.strokes.length === 0) return;
        
        const lastStroke = this.strokes.pop();
        if (lastStroke.mesh) {
            lastStroke.mesh.setParent(null);
        }
        
        this.render();
    }
    
    // 基本設定メソッド
    setPenSize(size) {
        this.penSize = Math.max(1, Math.min(50, size));
    }
    
    setOpacity(opacity) {
        this.opacity = Math.max(0.01, Math.min(1, opacity / 100));
    }
    
    setPressureSensitivity(sensitivity) {
        this.pressureSensitivity = Math.max(0, Math.min(1, sensitivity / 100));
    }
    
    setSmoothing(enabled) {
        this.smoothing = enabled;
    }
    
    updateStatus() {
        if (this.uiController) {
            this.uiController.updateStatusDisplay(this.strokes.length, this.fps);
        }
    }
}

// アプリケーション初期化
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('drawingCanvas');
    const drawingApp = new OGLUnifiedEngine(canvas);
    
    // ウィンドウリサイズ対応
    window.addEventListener('resize', () => {
        if (!document.body.classList.contains('fullscreen-drawing')) {
            return;
        }
        drawingApp.resizeCanvas(window.innerWidth - 20, window.innerHeight - 20);
    });
});