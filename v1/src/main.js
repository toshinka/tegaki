// Phase1: OGL統一エンジン + 全機能統合版
import { Renderer, Camera, Transform, Mesh, Program, Geometry, Vec3 } from 'ogl';

class OGLUnifiedEngine {
    constructor(canvas) {
        this.canvas = canvas;
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
        
        // 描画用データ
        this.strokes = [];
        this.currentStroke = null;
        this.isDrawing = false;
        
        // ペン設定
        this.penSize = 3;
        this.opacity = 1.0;
        this.pressureSensitivity = 0.5;
        this.smoothing = true;
        
        // パフォーマンス測定
        this.frameCount = 0;
        this.lastTime = performance.now();
        this.fps = 60;
        
        this.setupEventListeners();
        this.startRenderLoop();
    }
    
    // 以下、既存のOGLペン描画コードをそのまま移植
    setupEventListeners() {
        this.canvas.addEventListener('pointerdown', this.startDrawing.bind(this));
        this.canvas.addEventListener('pointermove', this.draw.bind(this));
        this.canvas.addEventListener('pointerup', this.stopDrawing.bind(this));
        this.canvas.addEventListener('pointercancel', this.stopDrawing.bind(this));
        this.canvas.addEventListener('pointerleave', this.stopDrawing.bind(this));
        
        this.canvas.addEventListener('contextmenu', e => e.preventDefault());
        this.canvas.addEventListener('touchstart', e => e.preventDefault());
        this.canvas.addEventListener('touchmove', e => e.preventDefault());
    }
    
    getCanvasCoordinates(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left - this.canvas.width / 2;
        const y = -(event.clientY - rect.top - this.canvas.height / 2);
        const pressure = event.pressure || 0.5;
        return { x, y, pressure };
    }
    
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
        
        if (this.smoothing && points.length > 0) {
            const interpolatedPoints = this.interpolatePoints(lastPoint, newPoint);
            points.push(...interpolatedPoints);
        } else {
            points.push(newPoint);
        }
        
        this.updateCurrentStrokeOptimized();
        event.preventDefault();
    }
    
    stopDrawing(event) {
        if (!this.isDrawing || !this.currentStroke) return;
        
        this.isDrawing = false;
        
        if (this.currentStroke.points.length >= 1) {
            if (this.currentStroke.points.length === 1) {
                this.createSinglePointMesh();
            } else {
                this.finalizeStroke();
            }
            this.strokes.push(this.currentStroke);
        } else if (this.currentStroke.mesh) {
            this.currentStroke.mesh.setParent(null);
        }
        
        this.currentStroke = null;
        this.updateStatus();
        event.preventDefault();
    }
    
    // 補間・描画メソッドも既存コードから移植（省略：実際は全メソッド必要）
    interpolatePoints(p1, p2) {
        const points = [];
        const distance = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
        const steps = Math.max(2, Math.floor(distance / 2));
        
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const x = p1.x + (p2.x - p1.x) * t;
            const y = p1.y + (p2.y - p1.y) * t;
            const pressure = p1.pressure + (p2.pressure - p1.pressure) * t;
            const timestamp = p1.timestamp + (p2.timestamp - p1.timestamp) * t;
            
            points.push({ x, y, pressure, timestamp });
        }
        
        return points;
    }
    
    calculatePressureSize(pressure, baseSize) {
        const pressureEffect = this.pressureSensitivity;
        const minSize = baseSize * 0.3;
        const maxSize = baseSize * 1.5;
        
        return minSize + (maxSize - minSize) * (pressure * pressureEffect + (1 - pressureEffect));
    }
    
    updateCurrentStrokeOptimized() {
        const points = this.currentStroke.points;
        if (points.length < 2) return;
        
        const batchSize = Math.min(5, points.length - this.currentStroke.vertices.length / 3 / 4);
        for (let i = Math.max(1, points.length - batchSize); i < points.length; i++) {
            if (i > 0) {
                this.addLineSegmentWithPressure(points[i - 1], points[i], this.currentStroke);
            }
        }
        
        this.updateStrokeMesh(this.currentStroke);
    }
    
    addLineSegmentWithPressure(p1, p2, stroke) {
        const size1 = this.calculatePressureSize(p1.pressure, stroke.baseSize);
        const size2 = this.calculatePressureSize(p2.pressure, stroke.baseSize);
        
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length === 0) return;
        
        const perpX = (-dy / length);
        const perpY = (dx / length);
        
        const baseIndex = stroke.vertices.length / 3;
        
        stroke.vertices.push(
            p1.x + perpX * (size1 / 2), p1.y + perpY * (size1 / 2), 0,
            p1.x - perpX * (size1 / 2), p1.y - perpY * (size1 / 2), 0,
            p2.x + perpX * (size2 / 2), p2.y + perpY * (size2 / 2), 0,
            p2.x - perpX * (size2 / 2), p2.y - perpY * (size2 / 2), 0
        );
        
        stroke.indices.push(
            baseIndex, baseIndex + 1, baseIndex + 2,
            baseIndex + 1, baseIndex + 3, baseIndex + 2
        );
        
        if (baseIndex > 0) {
            const prevIndex = baseIndex - 4;
            stroke.indices.push(
                prevIndex + 2, prevIndex + 3, baseIndex,
                prevIndex + 3, baseIndex + 1, baseIndex
            );
        }
    }
    
    createSinglePointMesh() {
        const point = this.currentStroke.points[0];
        const size = this.calculatePressureSize(point.pressure, this.currentStroke.baseSize);
        const radius = size / 2;
        
        const vertices = [];
        const indices = [];
        const segments = 16;
        
        vertices.push(point.x, point.y, 0);
        
        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const x = point.x + Math.cos(angle) * radius;
            const y = point.y + Math.sin(angle) * radius;
            vertices.push(x, y, 0);
        }
        
        for (let i = 1; i <= segments; i++) {
            indices.push(0, i, i + 1 > segments ? 1 : i + 1);
        }
        
        this.createMeshFromGeometry(vertices, indices, this.currentStroke);
    }
    
    updateStrokeMesh(stroke) {
        if (stroke.vertices.length === 0) return;
        
        if (stroke.mesh) {
            stroke.mesh.setParent(null);
        }
        
        this.createMeshFromGeometry(stroke.vertices, stroke.indices, stroke);
    }
    
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
    
    finalizeStroke() {
        const points = this.currentStroke.points;
        if (points.length > 1) {
            const lastPoint = points[points.length - 1];
            const secondLastPoint = points[points.length - 2];
            this.addEndCap(lastPoint, secondLastPoint, this.currentStroke);
            this.updateStrokeMesh(this.currentStroke);
        }
    }
    
    addEndCap(endPoint, prevPoint, stroke) {
        const size = this.calculatePressureSize(endPoint.pressure, stroke.baseSize);
        const radius = size / 2;
        
        const dx = endPoint.x - prevPoint.x;
        const dy = endPoint.y - prevPoint.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length === 0) return;
        
        const dirX = dx / length;
        const dirY = dy / length;
        
        const segments = 8;
        const baseIndex = stroke.vertices.length / 3;
        
        stroke.vertices.push(endPoint.x, endPoint.y, 0);
        
        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI - Math.PI / 2;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            
            const x = endPoint.x + (cos * dirX - sin * (-dirY)) * radius;
            const y = endPoint.y + (cos * dirY + sin * dirX) * radius;
            
            stroke.vertices.push(x, y, 0);
        }
        
        for (let i = 1; i <= segments; i++) {
            stroke.indices.push(baseIndex, baseIndex + i, baseIndex + i + 1);
        }
    }
    
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
    
    render() {
        this.renderer.render({ scene: this.scene, camera: this.camera });
    }
    
    updateStatus() {
        const statusInfo = document.getElementById('statusInfo');
        if (statusInfo) {
            const totalPoints = this.strokes.reduce((sum, stroke) => sum + stroke.points.length, 0);
            statusInfo.textContent = `ストローク: ${this.strokes.length} | 点数: ${totalPoints} | FPS: ${this.fps}`;
        }
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
        
        this.updateStatus();
        this.render();
    }
    
    undo() {
        if (this.strokes.length === 0) return;
        
        const lastStroke = this.strokes.pop();
        if (lastStroke.mesh) {
            lastStroke.mesh.setParent(null);
        }
        
        this.updateStatus();
        this.render();
    }
    
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
}

// アプリケーション初期化
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('drawingCanvas');
    const drawingApp = new OGLUnifiedEngine(canvas);
    
    // UI コントロール初期化
    const penSizeSlider = document.getElementById('penSizeSlider');
    const penSizeInput = document.getElementById('penSizeInput');
    const opacitySlider = document.getElementById('opacitySlider');
    const opacityInput = document.getElementById('opacityInput');
    const pressureSlider = document.getElementById('pressureSlider');
    const pressureInput = document.getElementById('pressureInput');
    const smoothingCheck = document.getElementById('smoothingCheck');
    
    // ペンサイズ制御
    penSizeSlider.addEventListener('input', (e) => {
        const value = e.target.value;
        penSizeInput.value = value;
        drawingApp.setPenSize(parseInt(value));
    });
    
    penSizeInput.addEventListener('input', (e) => {
        const value = e.target.value;
        penSizeSlider.value = value;
        drawingApp.setPenSize(parseInt(value));
    });
    
    // 不透明度制御
    opacitySlider.addEventListener('input', (e) => {
        const value = e.target.value;
        opacityInput.value = value;
        drawingApp.setOpacity(parseInt(value));
    });
    
    opacityInput.addEventListener('input', (e) => {
        const value = e.target.value;
        opacitySlider.value = value;
        drawingApp.setOpacity(parseInt(value));
    });
    
    // 筆圧感度制御
    pressureSlider.addEventListener('input', (e) => {
        const value = e.target.value;
        pressureInput.value = value;
        drawingApp.setPressureSensitivity(parseInt(value));
    });
    
    pressureInput.addEventListener('input', (e) => {
        const value = e.target.value;
        pressureSlider.value = value;
        drawingApp.setPressureSensitivity(parseInt(value));
    });
    
    // スムージング制御
    smoothingCheck.addEventListener('change', (e) => {
        drawingApp.setSmoothing(e.target.checked);
    });
    
    // アクションボタン
    document.getElementById('clearButton').addEventListener('click', () => {
        drawingApp.clear();
    });
    
    document.getElementById('undoButton').addEventListener('click', () => {
        drawingApp.undo();
    });
});