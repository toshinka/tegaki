// Phase1.5: OGL統一エンジン核心のみ（200行以内・5分割最適化対応・最終版）
import { Renderer, Camera, Transform, Mesh, Program, Geometry, Vec3 } from 'ogl';
import { UIController } from './UIController.js';
import { OGLQualityEnhancer } from './quality/OGLQualityEnhancer.js';
import { OGLMathEnhancer } from './quality/OGLMathEnhancer.js';
import { OGLPressureEnhancer } from './quality/OGLPressureEnhancer.js';
import { OGLShaderEnhancer } from './quality/OGLShaderEnhancer.js';
import { OGLInteractionEnhancer } from './OGLInteractionEnhancer.js';
import { OGLProEnhancer } from './OGLProEnhancer.js';

class OGLUnifiedEngine {
    constructor(canvas) {
        this.canvas = canvas;
        
        // OGL統一基盤初期化
        this.renderer = new Renderer({
            canvas: canvas,
            alpha: true,
            antialias: true,
            powerPreference: 'high-performance'
        });
        
        this.gl = this.renderer.gl;
        this.camera = new Camera(this.gl);
        this.scene = new Transform();
        
        // カメラ設定（2D描画用正投影）
        this.setupCamera();
        
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
    
    // カメラ設定（独立メソッド化）
    setupCamera() {
        this.camera.orthographic({
            left: -this.canvas.width / 2,
            right: this.canvas.width / 2,
            bottom: -this.canvas.height / 2,
            top: this.canvas.height / 2,
            near: 0.1,
            far: 100
        });
        this.camera.position.z = 1;
    }
    
    // OGL統一拡張システム初期化（順序最適化・エラーハンドリング追加）
    initEnhancers() {
        try {
            // 品質エンハンサーを最初に初期化（描画品質に影響）
            this.qualityEnhancer = new OGLQualityEnhancer(this);
        } catch (error) {
            console.warn('OGLQualityEnhancer not available:', error.message);
            this.qualityEnhancer = null;
        }
        
        try {
            // インタラクション・プロ機能を続けて初期化
            this.interactionEnhancer = new OGLInteractionEnhancer(this);
        } catch (error) {
            console.warn('OGLInteractionEnhancer not available:', error.message);
            this.interactionEnhancer = null;
        }
        
        try {
            this.proEnhancer = new OGLProEnhancer(this);
        } catch (error) {
            console.warn('OGLProEnhancer not available:', error.message);
            this.proEnhancer = null;
        }
        
        try {
            // UIコントローラーを最後に初期化（他のエンハンサーに依存）
            this.uiController = new UIController(this);
        } catch (error) {
            console.warn('UIController not available:', error.message);
            this.uiController = null;
        }
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
    
    // OGL統一座標変換（品質エンハンサー連携追加・安全チェック）
    getCanvasCoordinates(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left - this.canvas.width / 2;
        const y = -(event.clientY - rect.top - this.canvas.height / 2);
        const pressure = event.pressure || 0.5;
        
        // 品質エンハンサーでの入力最適化（安全チェック追加）
        if (this.qualityEnhancer && typeof this.qualityEnhancer.optimizeInput === 'function') {
            return this.qualityEnhancer.optimizeInput({ x, y, pressure, event });
        }
        
        return { x, y, pressure };
    }
    
    // OGL統一描画開始（品質エンハンサー連携強化・安全チェック）
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
        
        // プロエンハンサーでのブラシ適用（安全チェック追加）
        if (this.proEnhancer && typeof this.proEnhancer.applyCurrentBrush === 'function') {
            this.currentStroke = this.proEnhancer.applyCurrentBrush(this.currentStroke);
        }
        
        event.preventDefault();
    }
    
    // OGL統一描画処理（品質エンハンサー統合・安全チェック）
    draw(event) {
        if (!this.isDrawing || !this.currentStroke) return;
        
        const pos = this.getCanvasCoordinates(event);
        const points = this.currentStroke.points;
        const lastPoint = points[points.length - 1];
        
        const dx = pos.x - lastPoint.x;
        const dy = pos.y - lastPoint.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // 最小移動距離チェック（品質エンハンサー設定適用・安全チェック）
        const minDistance = (this.qualityEnhancer && this.qualityEnhancer.minDistance) ? this.qualityEnhancer.minDistance : 1;
        if (distance < minDistance) return;
        
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
    
    // OGL統一描画終了（品質エンハンサー最終処理・安全チェック）
    stopDrawing(event) {
        if (!this.isDrawing || !this.currentStroke) return;
        
        this.isDrawing = false;
        
        if (this.currentStroke.points.length >= 1) {
            // 品質エンハンサーでの最終品質向上処理（安全チェック追加）
            if (this.qualityEnhancer && typeof this.qualityEnhancer.enhanceStrokeQuality === 'function') {
                this.currentStroke = this.qualityEnhancer.enhanceStrokeQuality(this.currentStroke);
            }
            
            this.strokes.push(this.currentStroke);
        }
        
        this.currentStroke = null;
        this.updateStatus();
        event.preventDefault();
    }
    
    // OGL統一ストローク更新（品質エンハンサー統合・安全チェック）
    updateCurrentStroke() {
        const points = this.currentStroke.points;
        if (points.length < 2) return;
        
        // 品質エンハンサーでのスムージング適用（安全チェック追加）
        if (this.qualityEnhancer && this.smoothing && typeof this.qualityEnhancer.applySmoothingToPoints === 'function') {
            this.currentStroke.points = this.qualityEnhancer.applySmoothingToPoints(points);
        }
        
        // 最新セグメントのみ追加
        const processedPoints = this.currentStroke.points;
        if (processedPoints.length >= 2) {
            const p1 = processedPoints[processedPoints.length - 2];
            const p2 = processedPoints[processedPoints.length - 1];
            this.addLineSegment(p1, p2, this.currentStroke);
            this.updateStrokeMesh(this.currentStroke);
        }
    }
    
    // OGL統一線分追加（筆圧対応強化・安全チェック）
    addLineSegment(p1, p2, stroke) {
        let size1 = stroke.baseSize;
        let size2 = stroke.baseSize;
        
        // 品質エンハンサーでの筆圧レスポンス強化（安全チェック追加）
        if (this.qualityEnhancer && typeof this.qualityEnhancer.enhancePressureResponse === 'function') {
            size1 = this.qualityEnhancer.enhancePressureResponse(p1.pressure, stroke.baseSize);
            size2 = this.qualityEnhancer.enhancePressureResponse(p2.pressure, stroke.baseSize);
        }
        
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length === 0) return;
        
        const perpX1 = (-dy / length) * (size1 / 2);
        const perpY1 = (dx / length) * (size1 / 2);
        const perpX2 = (-dy / length) * (size2 / 2);
        const perpY2 = (dx / length) * (size2 / 2);
        
        const baseIndex = stroke.vertices.length / 3;
        
        stroke.vertices.push(
            p1.x + perpX1, p1.y + perpY1, 0,
            p1.x - perpX1, p1.y - perpY1, 0,
            p2.x + perpX2, p2.y + perpY2, 0,
            p2.x - perpX2, p2.y - perpY2, 0
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
    
    // OGL統一ジオメトリからメッシュ作成（シェーダー強化）
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
    
    // 基本制御メソッド（拡張システム用・リサイズ最適化）
    resizeCanvas(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.renderer.setSize(width, height);
        this.setupCamera();
        this.render();
    }
    
    // クリア処理（メモリリーク対策強化）
    clear() {
        this.strokes.forEach(stroke => {
            if (stroke.mesh) {
                if (stroke.mesh.geometry) stroke.mesh.geometry.remove();
                if (stroke.mesh.program) stroke.mesh.program.remove();
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
        this.updateStatus();
    }
    
    // 取り消し処理（メモリリーク対策強化）
    undo() {
        if (this.strokes.length === 0) return;
        
        const lastStroke = this.strokes.pop();
        if (lastStroke.mesh) {
            if (lastStroke.mesh.geometry) lastStroke.mesh.geometry.remove();
            if (lastStroke.mesh.program) lastStroke.mesh.program.remove();
            lastStroke.mesh.setParent(null);
        }
        
        this.render();
        this.updateStatus();
    }
    
    // 基本設定メソッド（品質エンハンサー連携・安全チェック）
    setPenSize(size) {
        this.penSize = Math.max(1, Math.min(50, size));
    }
    
    setOpacity(opacity) {
        this.opacity = Math.max(0.01, Math.min(1, opacity / 100));
    }
    
    setPressureSensitivity(sensitivity) {
        this.pressureSensitivity = Math.max(0, Math.min(1, sensitivity / 100));
        if (this.qualityEnhancer && typeof this.qualityEnhancer.updatePressureSettings === 'function') {
            this.qualityEnhancer.updatePressureSettings(this.pressureSensitivity);
        }
    }
    
    setSmoothing(enabled) {
        this.smoothing = enabled;
    }
    
    // ステータス更新（安全チェック）
    updateStatus() {
        if (this.uiController && typeof this.uiController.updateStatusDisplay === 'function') {
            this.uiController.updateStatusDisplay(this.strokes.length, this.fps);
        }
    }
}

// アプリケーション初期化
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('drawingCanvas');
    if (!canvas) {
        console.error('Canvas element not found');
        return;
    }
    
    const drawingApp = new OGLUnifiedEngine(canvas);
    
    // グローバル参照（デバッグ用）
    window.drawingApp = drawingApp;
    
    // ウィンドウリサイズ対応
    window.addEventListener('resize', () => {
        if (!document.body.classList.contains('fullscreen-drawing')) {
            return;
        }
        drawingApp.resizeCanvas(window.innerWidth - 20, window.innerHeight - 20);
    });
});