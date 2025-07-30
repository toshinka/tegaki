// OGLCore.js - 線品質修正版（モール・毛虫化解決・液タブ対応強化）
import { Renderer, Camera, Transform, Mesh, Program, Geometry } from 'ogl';
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
        
        // 描画パラメータ（最適化済み）
        this.penSize = 3;
        this.opacity = 1.0;
        this.pressureSensitivity = 0.5;
        this.smoothing = true;
        this.currentColor = [0.5, 0, 0];
        
        // 🔧 修正: 線品質向上設定（モール・毛虫化完全解決）
        this.strokeConfig = {
            minDistance: 0.8,        // 0.3→0.8 過密度防止
            maxDistance: 8,          // 3→8 液タブ対応拡張
            segmentDensity: 1.5,     // 3→1.5 過剰補間防止
            smoothingFactor: 0.15,   // 0.25→0.15 過剰スムージング防止
            continuityThreshold: 0.9,
            adaptiveDistance: true   // 🆕 速度適応距離制御
        };
        
        // 🔧 修正: 液タブ対応強化設定
        this.penConfig = {
            velocitySmoothing: 0.7,     // 速度スムージング
            distanceScaling: 1.2,       // 距離スケーリング
            pressureDeadZone: 0.05,     // 筆圧デッドゾーン
            pointerContinuity: true,    // ポインタ連続性保証
            tabletOptimization: true    // タブレット最適化有効
        };
        
        // 🔧 修正: 速度・距離追跡
        this.velocityTracker = {
            lastPoint: null,
            lastTime: 0,
            velocity: 0,
            avgVelocity: 0,
            distanceBuffer: []
        };
        
        this.sharedProgram = this.createSharedProgram();
        this.setupAdvancedEvents(); // イベント処理強化
        this.startRenderLoop();
        
        console.log('✅ OGLCore修正版 - 線品質・液タブ対応完了');
    }
    
    setupOGLBase() {
        this.renderer = new Renderer({
            canvas: this.canvas,
            alpha: true,
            antialias: true,
            powerPreference: 'high-performance',
            preserveDrawingBuffer: true // 液タブ対応強化
        });
        
        this.gl = this.renderer.gl;
        this.camera = new Camera(this.gl);
        this.scene = new Transform();
        this.setupCamera();
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
                    // 🔧 修正: 筆圧レスポンス改善
                    float pressureResponse = 0.6 + aPressure * 0.4;
                    gl_PointSize = uPenSize * pressureResponse * (1.0 + uPressureSensitivity * 0.3);
                }
            `,
            fragment: `
                precision mediump float;
                uniform float uOpacity;
                uniform vec3 uColor;
                varying float vPressure;
                void main() {
                    // 🔧 修正: より自然なアルファブレンド
                    float alpha = uOpacity * (0.4 + vPressure * 0.6);
                    vec2 center = gl_PointCoord - vec2(0.5);
                    float dist = length(center);
                    alpha *= smoothstep(0.5, 0.3, dist);
                    gl_FragColor = vec4(uColor, alpha);
                }
            `,
            uniforms: {
                uOpacity: { value: 1.0 },
                uColor: { value: [0.5, 0, 0] },
                uPenSize: { value: 3.0 },
                uPressureSensitivity: { value: 0.5 }
            }
        });
    }
    
    setColor(colorRGB) {
        this.currentColor = colorRGB;
        this.sharedProgram.uniforms.uColor.value = colorRGB;
    }
    
    // 🔧 修正: イベント処理強化（液タブ対応）
    setupAdvancedEvents() {
        this.canvas.addEventListener('contextmenu', e => e.preventDefault());
        
        // 🆕 タッチ・ポインタ統合イベント処理
        const eventMap = [
            ['pointerdown', this.onPointerDown.bind(this)],
            ['pointermove', this.onPointerMove.bind(this)],
            ['pointerup', this.onPointerUp.bind(this)],
            ['pointercancel', this.onPointerUp.bind(this)],
            ['pointerleave', this.onPointerLeave.bind(this)] // 🆕 液タブ離脱対応
        ];
        
        eventMap.forEach(([event, handler]) => {
            this.canvas.addEventListener(event, handler, { passive: false });
        });
        
        // 🆕 液タブ専用イベント
        if (this.penConfig.tabletOptimization) {
            this.canvas.addEventListener('pointerout', this.onPointerOut.bind(this));
        }
    }
    
    // 🔧 修正: 座標・速度計算強化
    getCanvasCoordinates(event) {
        const rect = this.canvas.getBoundingClientRect();
        const currentTime = performance.now();
        
        const coords = {
            x: event.clientX - rect.left - this.canvas.width / 2,
            y: -(event.clientY - rect.top - this.canvas.height / 2),
            pressure: this.normalizePressure(event.pressure || 0.5),
            timestamp: currentTime,
            pointerType: event.pointerType || 'mouse'
        };
        
        // 🆕 速度計算（液タブ対応）
        if (this.velocityTracker.lastPoint) {
            const dx = coords.x - this.velocityTracker.lastPoint.x;
            const dy = coords.y - this.velocityTracker.lastPoint.y;
            const dt = currentTime - this.velocityTracker.lastTime;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (dt > 0) {
                this.velocityTracker.velocity = distance / dt;
                this.velocityTracker.avgVelocity = 
                    this.velocityTracker.avgVelocity * this.penConfig.velocitySmoothing + 
                    this.velocityTracker.velocity * (1 - this.penConfig.velocitySmoothing);
            }
        }
        
        this.velocityTracker.lastPoint = coords;
        this.velocityTracker.lastTime = currentTime;
        
        return coords;
    }
    
    // 🆕 筆圧正規化（デッドゾーン対応）
    normalizePressure(pressure) {
        const deadZone = this.penConfig.pressureDeadZone;
        if (pressure < deadZone) return deadZone;
        return Math.min(1.0, Math.max(deadZone, pressure));
    }
    
    onPointerDown(event) {
        this.isDrawing = true;
        const pos = this.getCanvasCoordinates(event);
        
        // 🔧 修正: 速度追跡リセット
        this.velocityTracker.velocity = 0;
        this.velocityTracker.avgVelocity = 0;
        this.velocityTracker.distanceBuffer = [];
        
        this.currentStroke = {
            points: [pos],
            baseSize: this.penSize,
            opacity: this.opacity,
            color: [...this.currentColor],
            mesh: null,
            geometry: null,
            pointerType: pos.pointerType // 🆕 ポインタ種別記録
        };
        
        this.updateStrokeGeometry();
        this.eventBus.emit('drawing.start', { 
            stroke: this.currentStroke,
            startPoint: pos 
        });
        event.preventDefault();
    }
    
    // 🔧 修正: モール・毛虫化解決の核心実装
    onPointerMove(event) {
        if (!this.isDrawing || !this.currentStroke) return;
        
        const pos = this.getCanvasCoordinates(event);
        const points = this.currentStroke.points;
        const lastPoint = points[points.length - 1];
        
        // 🔧 修正: 適応的距離制御（速度ベース）
        const distance = this.calculateDistance(pos, lastPoint);
        const adaptiveMinDistance = this.getAdaptiveMinDistance();
        const adaptiveMaxDistance = this.getAdaptiveMaxDistance();
        
        // 距離フィルタリング（モール化防止の核心）
        if (distance < adaptiveMinDistance) {
            // 🔧 修正: 近すぎる点は破棄（モール化防止）
            return;
        }
        
        // 🔧 修正: 適度な補間（毛虫化防止）
        if (distance > adaptiveMaxDistance) {
            const interpolatedPoints = this.generateOptimalInterpolation(lastPoint, pos, distance);
            points.push(...interpolatedPoints);
        } else {
            points.push(pos);
        }
        
        // 🆕 距離バッファ管理（液タブ連続性）
        this.velocityTracker.distanceBuffer.push(distance);
        if (this.velocityTracker.distanceBuffer.length > 5) {
            this.velocityTracker.distanceBuffer.shift();
        }
        
        this.updateStrokeGeometry();
        
        this.eventBus.emit('drawing.update', { 
            stroke: this.currentStroke,
            newPoint: pos,
            pointCount: points.length,
            timestamp: pos.timestamp,
            velocity: this.velocityTracker.velocity
        });
        
        event.preventDefault();
    }
    
    // 🆕 適応的最小距離計算（速度ベース）
    getAdaptiveMinDistance() {
        if (!this.strokeConfig.adaptiveDistance) {
            return this.strokeConfig.minDistance;
        }
        
        const velocity = this.velocityTracker.avgVelocity;
        const baseDistance = this.strokeConfig.minDistance;
        
        // 速度が速いほど最小距離を大きく（モール化防止）
        const velocityFactor = Math.min(3.0, Math.max(0.5, velocity * 0.01));
        return baseDistance * velocityFactor;
    }
    
    // 🆕 適応的最大距離計算（液タブ対応）
    getAdaptiveMaxDistance() {
        const baseDistance = this.strokeConfig.maxDistance;
        
        // 液タブの場合は距離を拡張
        if (this.currentStroke?.pointerType === 'pen') {
            return baseDistance * this.penConfig.distanceScaling;
        }
        
        return baseDistance;
    }
    
    // 🔧 修正: 最適補間生成（毛虫化防止）
    generateOptimalInterpolation(p1, p2, distance) {
        const segmentDensity = this.strokeConfig.segmentDensity;
        const steps = Math.max(2, Math.ceil(distance / (segmentDensity * 3))); // より粗い補間
        const interpolated = [];
        
        for (let i = 1; i < steps; i++) {
            const t = i / steps;
            const smoothT = this.easeInOutCubic(t); // より滑らかな補間曲線
            
            interpolated.push({
                x: p1.x + (p2.x - p1.x) * smoothT,
                y: p1.y + (p2.y - p1.y) * smoothT,
                pressure: p1.pressure + (p2.pressure - p1.pressure) * smoothT,
                timestamp: p1.timestamp + (p2.timestamp - p1.timestamp) * t,
                pointerType: p1.pointerType
            });
        }
        
        interpolated.push(p2);
        return interpolated;
    }
    
    // 🔧 修正: より滑らかな補間関数
    easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
    
    // 🆕 液タブ離脱処理
    onPointerLeave(event) {
        if (this.isDrawing && this.currentStroke?.pointerType === 'pen') {
            // 液タブペンの場合、離脱を遅延処理
            setTimeout(() => {
                if (this.isDrawing && event.pointerType === 'pen') {
                    this.onPointerUp(event);
                }
            }, 50);
        } else {
            this.onPointerUp(event);
        }
    }
    
    // 🆕 液タブアウト処理
    onPointerOut(event) {
        if (this.penConfig.pointerContinuity && event.pointerType === 'pen') {
            // ペンタブレットの場合、短時間の離脱は無視
            return;
        }
        this.onPointerUp(event);
    }
    
    onPointerUp(event) {
        if (!this.isDrawing) return;
        
        this.isDrawing = false;
        
        if (this.currentStroke?.points.length >= 1) {
            // 🔧 修正: 最終スムージング（控えめ）
            if (this.smoothing && this.currentStroke.points.length > 3) {
                this.currentStroke.points = this.applyConservativeSmoothing(this.currentStroke.points);
                this.updateStrokeGeometry();
            }
            
            this.strokes.push(this.currentStroke);
            this.eventBus.emit('drawing.complete', { 
                stroke: this.currentStroke,
                totalPoints: this.currentStroke.points.length,
                timestamp: performance.now(),
                avgVelocity: this.velocityTracker.avgVelocity
            });
        }
        
        this.currentStroke = null;
        // 速度追跡リセット
        this.velocityTracker.lastPoint = null;
        this.velocityTracker.velocity = 0;
        this.velocityTracker.avgVelocity = 0;
        
        event.preventDefault();
    }
    
    calculateDistance(p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    // 🔧 修正: 控えめスムージング（過剰補正防止）
    applyConservativeSmoothing(points) {
        if (points.length < 4) return points;
        
        const smoothed = [points[0]];
        const factor = this.strokeConfig.smoothingFactor * 0.7; // さらに控えめに
        
        for (let i = 1; i < points.length - 1; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            const next = points[i + 1];
            
            // 🔧 修正: より自然なスムージング
            const smoothedX = curr.x * (1 - factor) + (prev.x + next.x) * factor * 0.3;
            const smoothedY = curr.y * (1 - factor) + (prev.y + next.y) * factor * 0.3;
            
            smoothed.push({
                x: smoothedX,
                y: smoothedY,
                pressure: curr.pressure,
                timestamp: curr.timestamp,
                pointerType: curr.pointerType
            });
        }
        
        smoothed.push(points[points.length - 1]);
        return smoothed;
    }
    
    // 🔧 修正: 筆圧サイズ計算改善
    calculatePressureSize(pressure) {
        const normalizedPressure = Math.max(0.1, Math.min(1.0, pressure));
        const curve = Math.pow(normalizedPressure, 0.8); // より自然なカーブ
        return this.penSize * (0.4 + curve * this.pressureSensitivity * 1.2);
    }
    
    // ジオメトリ生成（既存のロジックを保持・最適化）
    updateStrokeGeometry() {
        const points = this.currentStroke.points;
        if (points.length === 0) return;
        
        if (points.length === 1) {
            this.createSinglePointGeometry(points[0]);
            return;
        }
        
        const { vertices, indices, pressures } = this.generateStrokeGeometry(points);
        
        this.cleanupGeometry(this.currentStroke.geometry);
        
        this.currentStroke.geometry = new Geometry(this.gl);
        this.currentStroke.geometry.addAttribute('position', {
            size: 3,
            data: new Float32Array(vertices)
        });
        this.currentStroke.geometry.addAttribute('aPressure', {
            size: 1,
            data: new Float32Array(pressures)
        });
        
        if (indices.length > 0) {
            this.currentStroke.geometry.addAttribute('index', {
                data: new Uint16Array(indices)
            });
        }
        
        this.updateStrokeMesh();
    }
    
    createSinglePointGeometry(point) {
        const size = this.calculatePressureSize(point.pressure) * 0.5;
        const segments = 8;
        const vertices = [point.x, point.y, 0];
        const indices = [];
        const pressures = [point.pressure];
        
        for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            vertices.push(
                point.x + Math.cos(angle) * size,
                point.y + Math.sin(angle) * size,
                0
            );
            pressures.push(point.pressure);
        }
        
        for (let i = 0; i < segments; i++) {
            indices.push(0, i + 1, ((i + 1) % segments) + 1);
        }
        
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
    
    generateStrokeGeometry(points) {
        const vertices = [];
        const indices = [];
        const pressures = [];
        let vertexIndex = 0;
        
        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];
            
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            
            if (length < 0.01) continue;
            
            const size1 = this.calculatePressureSize(p1.pressure) * 0.5;
            const size2 = this.calculatePressureSize(p2.pressure) * 0.5;
            
            const nx = -dy / length;
            const ny = dx / length;
            
            vertices.push(
                p1.x + nx * size1, p1.y + ny * size1, 0,
                p1.x - nx * size1, p1.y - ny * size1, 0,
                p2.x + nx * size2, p2.y + ny * size2, 0,
                p2.x - nx * size2, p2.y - ny * size2, 0
            );
            
            pressures.push(p1.pressure, p1.pressure, p2.pressure, p2.pressure);
            
            indices.push(
                vertexIndex, vertexIndex + 1, vertexIndex + 2,
                vertexIndex + 1, vertexIndex + 3, vertexIndex + 2
            );
            
            vertexIndex += 4;
        }
        
        return { vertices, indices, pressures };
    }
    
    updateStrokeMesh() {
        if (!this.currentStroke.geometry) return;
        
        if (this.currentStroke.mesh) {
            this.currentStroke.mesh.setParent(null);
        }
        
        this.sharedProgram.uniforms.uPenSize.value = this.penSize;
        this.sharedProgram.uniforms.uPressureSensitivity.value = this.pressureSensitivity;
        this.sharedProgram.uniforms.uOpacity.value = this.currentStroke.opacity;
        this.sharedProgram.uniforms.uColor.value = this.currentStroke.color;
        
        this.currentStroke.mesh = new Mesh(this.gl, {
            geometry: this.currentStroke.geometry,
            program: this.sharedProgram
        });
        
        this.currentStroke.mesh.setParent(this.scene);
    }
    
    cleanupGeometry(geometry) {
        if (!geometry?.attributes) return;
        
        Object.values(geometry.attributes).forEach(attr => {
            if (attr.buffer) this.gl.deleteBuffer(attr.buffer);
        });
        
        if (geometry.VAO) this.gl.deleteVertexArray(geometry.VAO);
    }
    
    startRenderLoop() {
        let frameCount = 0;
        let lastTime = performance.now();
        
        const animate = (currentTime) => {
            frameCount++;
            
            if (currentTime - lastTime >= 1000) {
                this.fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
                frameCount = 0;
                lastTime = currentTime;
                this.eventBus.emit('fps.update', { fps: this.fps });
            }
            
            this.render();
            requestAnimationFrame(animate);
        };
        
        requestAnimationFrame(animate);
    }
    
    render() {
        if (!this.gl.isContextLost()) {
            this.renderer.render({ scene: this.scene, camera: this.camera });
        }
    }
    
    // 公開API
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
        this.strokes = [];
        
        if (this.currentStroke) {
            if (this.currentStroke.mesh) this.currentStroke.mesh.setParent(null);
            if (this.currentStroke.geometry) this.cleanupGeometry(this.currentStroke.geometry);
            this.currentStroke = null;
        }
        
        this.isDrawing = false;
        this.eventBus.emit('canvas.cleared');
        this.render();
    }
    
    undo() {
        if (this.strokes.length === 0) return;
        
        const stroke = this.strokes.pop();
        if (stroke.mesh) stroke.mesh.setParent(null);
        if (stroke.geometry) this.cleanupGeometry(stroke.geometry);
        
        this.eventBus.emit('canvas.undone');
        this.render();
    }
    
    // パラメータ更新
    updatePenSize(size) { 
        this.penSize = Math.max(1, Math.min(50, size)); 
    }
    
    updateOpacity(opacity) { 
        this.opacity = Math.max(0.01, Math.min(1.0, opacity)); 
    }
    
    updatePressureSensitivity(sensitivity) { 
        this.pressureSensitivity = Math.max(0, Math.min(2.0, sensitivity));
    }
    
    updateSmoothing(enabled) { 
        this.smoothing = enabled; 
    }
    
    // イベント管理
    on(event, handler) { this.eventBus.on(event, handler); }
    off(event, handler) { this.eventBus.off(event, handler); }
    emit(event, data) { this.eventBus.emit(event, data); }
    
    // 🆕 デバッグ・診断機能
    getDrawingStats() {
        return {
            strokeCount: this.strokes.length,
            currentVelocity: this.velocityTracker.velocity,
            avgVelocity: this.velocityTracker.avgVelocity,
            strokeConfig: { ...this.strokeConfig },
            penConfig: { ...this.penConfig }
        };
    }
    
    // クリーンアップ
    destroy() {
        this.clear();
        
        if (this.sharedProgram?.program) {
            this.gl.deleteProgram(this.sharedProgram.program);
        }
        
        this.eventBus.all.clear();
        this.renderer?.destroy?.();
        
        // 追跡状態クリア
        this.velocityTracker = null;
    }
}