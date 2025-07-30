// OGLCore.js - 線の歯抜け・筆圧感度修正版
import { Renderer, Camera, Transform, Mesh, Program, Geometry, Vec3 } from 'ogl';
import mitt from 'mitt';

export class OGLCore {
    constructor(canvas) {
        this.canvas = canvas;
        this.eventBus = mitt();
        this.setupOGLBase();
        
        // 描画状態管理
        this.strokes = [];
        this.currentStroke = null;
        this.isDrawing = false;
        
        // バッファプール（最適化）
        this.bufferPool = { vertices: [], indices: [] };
        this.activeBuffers = new Set();
        
        // FPS計測
        this.frameCount = 0;
        this.lastFPSTime = performance.now();
        this.fps = 60;
        
        // 描画パラメータ（筆圧感度修正）
        this.penSize = 3;
        this.opacity = 1.0;
        this.pressureSensitivity = 0.5;
        this.smoothing = true;
        
        // 筆圧処理強化
        this.pressureConfig = {
            minPressure: 0.1,
            maxPressure: 1.0,
            baseSize: 3,
            pressureMultiplier: 2.0  // 筆圧効果倍率
        };
        
        // 線品質向上設定
        this.strokeConfig = {
            minDistance: 0.5,  // 最小描画距離（歯抜け防止）
            maxDistance: 15,   // 最大補間距離
            segmentDensity: 2, // セグメント密度
            smoothingFactor: 0.3
        };
        
        this.sharedProgram = this.createSharedProgram();
        this.setupBasicEvents();
        this.startRenderLoop();
    }
    
    setupOGLBase() {
        this.renderer = new Renderer({
            canvas: this.canvas,
            alpha: true,
            antialias: true,
            powerPreference: 'high-performance'
        });
        
        this.gl = this.renderer.gl;
        this.camera = new Camera(this.gl);
        this.scene = new Transform();
        this.setupCamera();
        
        // WebGLコンテキスト復旧
        this.canvas.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            console.warn('WebGLコンテキスト喪失');
        });
        
        this.canvas.addEventListener('webglcontextrestored', () => {
            console.log('WebGLコンテキスト復旧');
            this.setupOGLBase();
        });
    }
    
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
    
    // 筆圧対応シェーダー（修正版）
    createSharedProgram() {
        return new Program(this.gl, {
            vertex: `
                attribute vec3 position;
                attribute float aPressure;
                uniform mat4 modelViewMatrix;
                uniform mat4 projectionMatrix;
                uniform float uPenSize;
                uniform float uPressureSensitivity;
                varying float vPressure;
                void main() {
                    vPressure = aPressure;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = uPenSize * (0.5 + aPressure * uPressureSensitivity);
                }
            `,
            fragment: `
                precision mediump float;
                uniform float uOpacity;
                uniform vec3 uColor;
                varying float vPressure;
                void main() {
                    float alpha = uOpacity * (0.3 + vPressure * 0.7);
                    gl_FragColor = vec4(uColor, alpha);
                }
            `,
            uniforms: {
                uOpacity: { value: 1.0 },
                uColor: { value: [0.2, 0.2, 0.8] },
                uPenSize: { value: 3.0 },
                uPressureSensitivity: { value: 0.5 }
            }
        });
    }
    
    setupBasicEvents() {
        this.canvas.addEventListener('contextmenu', e => e.preventDefault());
        this.canvas.addEventListener('touchstart', e => e.preventDefault());
        this.canvas.addEventListener('touchmove', e => e.preventDefault());
        
        this.boundPointerDown = this.onPointerDown.bind(this);
        this.boundPointerMove = this.onPointerMove.bind(this);
        this.boundPointerUp = this.onPointerUp.bind(this);
        
        const events = [
            ['pointerdown', this.boundPointerDown],
            ['pointermove', this.boundPointerMove],
            ['pointerup', this.boundPointerUp],
            ['pointercancel', this.boundPointerUp],
            ['pointerleave', this.boundPointerUp]
        ];
        
        events.forEach(([event, handler]) => {
            this.canvas.addEventListener(event, handler);
        });
    }
    
    getCanvasCoordinates(event) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: event.clientX - rect.left - this.canvas.width / 2,
            y: -(event.clientY - rect.top - this.canvas.height / 2),
            pressure: event.pressure || 0.5,
            timestamp: performance.now()
        };
    }
    
    onPointerDown(event) {
        this.isDrawing = true;
        const pos = this.getCanvasCoordinates(event);
        
        this.currentStroke = {
            points: [pos],
            baseSize: this.penSize,
            opacity: this.opacity,
            mesh: null,
            geometry: null
        };
        
        // 即座に初期描画（単点でも表示）
        this.updateStrokeGeometry();
        
        this.eventBus.emit('drawing.start', {
            stroke: this.currentStroke,
            position: pos
        });
        
        event.preventDefault();
    }
    
    onPointerMove(event) {
        if (!this.isDrawing || !this.currentStroke) return;
        
        const pos = this.getCanvasCoordinates(event);
        const points = this.currentStroke.points;
        
        // 歯抜け防止：距離チェック改良
        if (points.length > 0) {
            const lastPoint = points[points.length - 1];
            const distance = this.calculateDistance(pos, lastPoint);
            
            // 距離が短すぎる場合はスキップ（ノイズ除去）
            if (distance < this.strokeConfig.minDistance) return;
            
            // 距離が長すぎる場合は補間点追加（歯抜け防止）
            if (distance > this.strokeConfig.maxDistance) {
                const interpolatedPoints = this.interpolatePoints(lastPoint, pos);
                points.push(...interpolatedPoints);
            } else {
                points.push(pos);
            }
        } else {
            points.push(pos);
        }
        
        this.updateStrokeGeometry();
        
        this.eventBus.emit('drawing.update', {
            stroke: this.currentStroke,
            newPoint: pos
        });
        
        event.preventDefault();
    }
    
    onPointerUp(event) {
        if (!this.isDrawing || !this.currentStroke) return;
        
        this.isDrawing = false;
        
        if (this.currentStroke.points.length >= 1) {
            // スムージング適用（品質向上）
            if (this.smoothing) {
                this.currentStroke.points = this.applySmoothingToPoints(this.currentStroke.points);
                this.updateStrokeGeometry(); // スムージング後再描画
            }
            
            this.strokes.push(this.currentStroke);
            this.eventBus.emit('drawing.complete', {
                stroke: this.currentStroke,
                totalStrokes: this.strokes.length
            });
        }
        
        this.currentStroke = null;
        event.preventDefault();
    }
    
    // 距離計算
    calculateDistance(p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    // 補間点生成（歯抜け防止の核心）
    interpolatePoints(p1, p2) {
        const distance = this.calculateDistance(p1, p2);
        const steps = Math.ceil(distance / this.strokeConfig.segmentDensity);
        const interpolated = [];
        
        for (let i = 1; i < steps; i++) {
            const t = i / steps;
            const interpolatedPoint = {
                x: p1.x + (p2.x - p1.x) * t,
                y: p1.y + (p2.y - p1.y) * t,
                pressure: p1.pressure + (p2.pressure - p1.pressure) * t,
                timestamp: p1.timestamp + (p2.timestamp - p1.timestamp) * t
            };
            interpolated.push(interpolatedPoint);
        }
        
        interpolated.push(p2);
        return interpolated;
    }
    
    // スムージング適用（品質向上）
    applySmoothingToPoints(points) {
        if (points.length < 3) return points;
        
        const smoothed = [points[0]]; // 最初の点保持
        
        for (let i = 1; i < points.length - 1; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            const next = points[i + 1];
            
            const factor = this.strokeConfig.smoothingFactor;
            const smoothedPoint = {
                x: curr.x * (1 - factor) + (prev.x + next.x) * factor * 0.5,
                y: curr.y * (1 - factor) + (prev.y + next.y) * factor * 0.5,
                pressure: curr.pressure,
                timestamp: curr.timestamp
            };
            
            smoothed.push(smoothedPoint);
        }
        
        if (points.length > 1) {
            smoothed.push(points[points.length - 1]); // 最後の点保持
        }
        
        return smoothed;
    }
    
    // 筆圧計算強化（感度修正）
    calculatePressureSize(pressure) {
        const config = this.pressureConfig;
        
        // 筆圧正規化
        const normalizedPressure = Math.max(config.minPressure, 
                                           Math.min(config.maxPressure, pressure));
        
        // 筆圧感度適用（強化版）
        const pressureEffect = normalizedPressure * this.pressureSensitivity * config.pressureMultiplier;
        
        // ベースサイズに筆圧効果を適用
        return config.baseSize * (0.3 + pressureEffect);
    }
    
    // ストロークジオメトリ更新（修正版）
    updateStrokeGeometry() {
        const points = this.currentStroke.points;
        if (points.length === 0) return;
        
        // 単点の場合の処理（円形描画）
        if (points.length === 1) {
            this.createSinglePointGeometry(points[0]);
            return;
        }
        
        const { vertices, indices, pressures } = this.generateStrokeData(points);
        if (vertices.length === 0) return;
        
        // 既存ジオメトリクリーンアップ
        if (this.currentStroke.geometry) {
            this.cleanupGeometry(this.currentStroke.geometry);
        }
        
        // 新しいジオメトリ作成
        this.currentStroke.geometry = new Geometry(this.gl);
        
        // 位置属性
        this.currentStroke.geometry.addAttribute('position', {
            size: 3,
            data: new Float32Array(vertices)
        });
        
        // 筆圧属性（修正）
        this.currentStroke.geometry.addAttribute('aPressure', {
            size: 1,
            data: new Float32Array(pressures)
        });
        
        // インデックス
        if (indices.length > 0) {
            this.currentStroke.geometry.addAttribute('index', {
                data: new Uint16Array(indices)
            });
        }
        
        this.updateStrokeMesh();
    }
    
    // 単点ジオメトリ作成
    createSinglePointGeometry(point) {
        const size = this.calculatePressureSize(point.pressure) * 0.5;
        
        // 四角形の単点
        const vertices = [
            point.x - size, point.y - size, 0,
            point.x + size, point.y - size, 0,
            point.x + size, point.y + size, 0,
            point.x - size, point.y + size, 0
        ];
        
        const indices = [0, 1, 2, 0, 2, 3];
        const pressures = [point.pressure, point.pressure, point.pressure, point.pressure];
        
        this.currentStroke.geometry = new Geometry(this.gl);
        
        this.currentStroke.geometry.addAttribute('position', {
            size: 3,
            data: new Float32Array(vertices)
        });
        
        this.currentStroke.geometry.addAttribute('aPressure', {
            size: 1,
            data: new Float32Array(pressures)
        });
        
        this.currentStroke.geometry.addAttribute('index', {
            data: new Uint16Array(indices)
        });
        
        this.updateStrokeMesh();
    }
    
    // ストロークデータ生成（筆圧対応改良版）
    generateStrokeData(points) {
        const vertices = [];
        const indices = [];
        const pressures = [];
        
        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];
            
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            
            if (length < 0.01) continue;
            
            // 筆圧対応サイズ計算
            const size1 = this.calculatePressureSize(p1.pressure) * 0.5;
            const size2 = this.calculatePressureSize(p2.pressure) * 0.5;
            
            const nx = -dy / length;
            const ny = dx / length;
            const baseIdx = vertices.length / 3;
            
            // クアッド頂点（筆圧対応）
            vertices.push(
                p1.x + nx * size1, p1.y + ny * size1, 0,
                p1.x - nx * size1, p1.y - ny * size1, 0,
                p2.x + nx * size2, p2.y + ny * size2, 0,
                p2.x - nx * size2, p2.y - ny * size2, 0
            );
            
            // 筆圧データ
            pressures.push(p1.pressure, p1.pressure, p2.pressure, p2.pressure);
            
            // インデックス
            indices.push(
                baseIdx, baseIdx + 1, baseIdx + 2,
                baseIdx + 1, baseIdx + 3, baseIdx + 2
            );
        }
        
        return { vertices, indices, pressures };
    }
    
    // メッシュ更新（筆圧対応）
    updateStrokeMesh() {
        if (!this.currentStroke.geometry) return;
        
        // 既存メッシュクリーンアップ
        if (this.currentStroke.mesh) {
            this.currentStroke.mesh.setParent(null);
        }
        
        // 筆圧感度をシェーダーに反映
        this.sharedProgram.uniforms.uPenSize.value = this.penSize;
        this.sharedProgram.uniforms.uPressureSensitivity.value = this.pressureSensitivity;
        this.sharedProgram.uniforms.uOpacity.value = this.currentStroke.opacity;
        
        // 新しいメッシュ作成
        this.currentStroke.mesh = new Mesh(this.gl, {
            geometry: this.currentStroke.geometry,
            program: this.sharedProgram
        });
        
        this.currentStroke.mesh.setParent(this.scene);
    }
    
    // ジオメトリクリーンアップ
    cleanupGeometry(geometry) {
        if (!geometry || !geometry.attributes) return;
        
        Object.values(geometry.attributes).forEach(attr => {
            if (attr.buffer && this.activeBuffers.has(attr.buffer)) {
                this.gl.deleteBuffer(attr.buffer);
                this.activeBuffers.delete(attr.buffer);
            }
        });
        
        if (geometry.VAO) {
            this.gl.deleteVertexArray(geometry.VAO);
        }
    }
    
    // レンダーループ
    startRenderLoop() {
        const animate = (currentTime) => {
            this.frameCount++;
            
            if (currentTime - this.lastFPSTime >= 1000) {
                this.fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastFPSTime));
                this.frameCount = 0;
                this.lastFPSTime = currentTime;
                this.eventBus.emit('fps.update', { fps: this.fps });
            }
            
            this.render();
            requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
    }
    
    render() {
        if (this.gl.isContextLost()) return;
        this.renderer.render({ scene: this.scene, camera: this.camera });
    }
    
    resizeCanvas(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.renderer.setSize(width, height);
        this.setupCamera();
        this.render();
    }
    
    clear() {
        this.strokes.forEach(stroke => {
            if (stroke.mesh) stroke.mesh.setParent(null);
            if (stroke.geometry) this.cleanupGeometry(stroke.geometry);
        });
        this.strokes.length = 0;
        
        if (this.currentStroke) {
            if (this.currentStroke.mesh) this.currentStroke.mesh.setParent(null);
            if (this.currentStroke.geometry) this.cleanupGeometry(this.currentStroke.geometry);
            this.currentStroke = null;
        }
        
        this.isDrawing = false;
        this.eventBus.emit('canvas.cleared', { strokeCount: 0 });
        this.render();
    }
    
    undo() {
        if (this.strokes.length === 0) return;
        
        const lastStroke = this.strokes.pop();
        if (lastStroke.mesh) lastStroke.mesh.setParent(null);
        if (lastStroke.geometry) this.cleanupGeometry(lastStroke.geometry);
        
        this.eventBus.emit('canvas.undone', { strokeCount: this.strokes.length });
        this.render();
    }
    
    // パラメータ更新（筆圧対応強化）
    updatePenSize(size) { 
        this.penSize = Math.max(1, Math.min(50, size)); 
        this.pressureConfig.baseSize = this.penSize;
    }
    
    updateOpacity(opacity) { 
        this.opacity = Math.max(0.01, Math.min(1.0, opacity)); 
    }
    
    updatePressureSensitivity(sensitivity) { 
        this.pressureSensitivity = Math.max(0, Math.min(2.0, sensitivity)); // 最大値を2.0に拡張
    }
    
    updateSmoothing(enabled) { 
        this.smoothing = enabled; 
    }
    
    // イベント管理
    on(event, handler) { this.eventBus.on(event, handler); }
    off(event, handler) { this.eventBus.off(event, handler); }
    emit(event, data) { this.eventBus.emit(event, data); }
    
    // クリーンアップ
    destroy() {
        ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'pointerleave'].forEach(event => {
            this.canvas.removeEventListener(event, this[`bound${event.charAt(0).toUpperCase() + event.slice(1)}`]);
        });
        
        this.clear();
        
        this.activeBuffers.forEach(buffer => {
            if (buffer) this.gl.deleteBuffer(buffer);
        });
        this.activeBuffers.clear();
        
        if (this.sharedProgram?.program) {
            this.gl.deleteProgram(this.sharedProgram.program);
        }
        
        this.eventBus.all.clear();
        this.renderer?.destroy?.();
        
        this.bufferPool = null;
        this.sharedProgram = null;
    }
}