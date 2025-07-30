// Phase1.5: OGL統一エンジン核心＋設定統合管理対応版（改良版）
import { Renderer, Camera, Transform, Mesh, Program, Geometry, Vec3 } from 'ogl';
import { UIController } from './UIController.js';
import { OGLQualityEnhancer } from './quality/OGLQualityEnhancer.js';
import { OGLMathEnhancer } from './quality/OGLMathEnhancer.js';
import { OGLPressureEnhancer } from './quality/OGLPressureEnhancer.js';
import { OGLShaderEnhancer } from './quality/OGLShaderEnhancer.js';
import { OGLInteractionEnhancer } from './OGLInteractionEnhancer.js';
import { OGLProEnhancer } from './OGLProEnhancer.js';
import { OGLSettingsManager } from './OGLSettingsManager.js';

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
        
        // ペン基本設定（設定管理システムで上書きされる）
        this.penSize = 3;
        this.opacity = 1.0;
        this.pressureSensitivity = 0.5;
        this.smoothing = true;
        
        // パフォーマンス測定
        this.frameCount = 0;
        this.lastTime = performance.now();
        this.fps = 60;
        
        // 拡張システム統合点
        this.settingsManager = null;
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
    
    // OGL統一拡張システム初期化（設定管理優先・効率化）
    initEnhancers() {
        // 設定管理システムを最初に初期化（最重要）
        this.settingsManager = this.safeInit(() => new OGLSettingsManager(this), 'OGLSettingsManager');
        
        // 設定統合処理を即座に設定
        if (this.settingsManager) {
            this.setupSettingsIntegration();
        }
        
        // エンハンサー初期化（設定システム依存順）
        this.qualityEnhancer = this.safeInit(() => new OGLQualityEnhancer(this), 'OGLQualityEnhancer');
        this.interactionEnhancer = this.safeInit(() => new OGLInteractionEnhancer(this), 'OGLInteractionEnhancer');
        this.proEnhancer = this.safeInit(() => new OGLProEnhancer(this), 'OGLProEnhancer');
        
        // UIコントローラーを最後に初期化（全システム依存）
        this.uiController = this.safeInit(() => new UIController(this), 'UIController');
    }
    
    // 安全な初期化ヘルパー（コード重複削減）
    safeInit(initFn, name) {
        try {
            return initFn();
        } catch (error) {
            console.warn(`${name} not available:`, error.message);
            return null;
        }
    }
    
    // 設定統合処理（統合強化・効率化）
    setupSettingsIntegration() {
        const settings = this.settingsManager;
        
        // 描画設定の統合監視（一括処理）
        settings.onChange('drawing', (drawingSettings) => {
            this.penSize = drawingSettings.penSize;
            this.opacity = drawingSettings.opacity / 100;
            this.pressureSensitivity = drawingSettings.pressureSensitivity / 100;
            this.smoothing = drawingSettings.smoothing;
            
            // UI同期（存在する場合のみ）
            this.uiController?.syncWithSettings?.(drawingSettings);
        });
        
        // 品質設定の統合監視（エンハンサー連携）
        settings.onChange('quality', (qualitySettings) => {
            this.qualityEnhancer?.updateQualitySettings?.(qualitySettings);
        });
        
        // インタラクション設定の統合監視
        settings.onChange('interaction', (interactionSettings) => {
            this.interactionEnhancer?.updateInteractionSettings?.(interactionSettings);
        });
        
        // プロ機能設定の統合監視
        settings.onChange('pro', (proSettings) => {
            this.proEnhancer?.updateProSettings?.(proSettings);
        });
        
        // 初期設定の一括適用（効率化）
        this.applyInitialSettings();
    }
    
    // 初期設定適用（新規追加・効率化）
    applyInitialSettings() {
        const drawing = this.settingsManager.get('drawing');
        if (drawing) {
            this.penSize = drawing.penSize;
            this.opacity = drawing.opacity / 100;
            this.pressureSensitivity = drawing.pressureSensitivity / 100;
            this.smoothing = drawing.smoothing;
        }
        
        // エンハンサーへの初期設定適用
        const quality = this.settingsManager.get('quality');
        if (quality && this.qualityEnhancer?.updateQualitySettings) {
            this.qualityEnhancer.updateQualitySettings(quality);
        }
        
        const interaction = this.settingsManager.get('interaction');
        if (interaction && this.interactionEnhancer?.updateInteractionSettings) {
            this.interactionEnhancer.updateInteractionSettings(interaction);
        }
    }
    
    // 基本イベントリスナー（OGL統一核心のみ）
    setupBasicEventListeners() {
        const events = [
            ['pointerdown', this.startDrawing],
            ['pointermove', this.draw],
            ['pointerup', this.stopDrawing],
            ['pointercancel', this.stopDrawing],
            ['pointerleave', this.stopDrawing]
        ];
        
        events.forEach(([event, handler]) => {
            this.canvas.addEventListener(event, handler.bind(this));
        });
        
        // コンテキスト防止
        this.canvas.addEventListener('contextmenu', e => e.preventDefault());
        this.canvas.addEventListener('touchstart', e => e.preventDefault());
        this.canvas.addEventListener('touchmove', e => e.preventDefault());
    }
    
    // OGL統一座標変換（品質エンハンサー連携・効率化）
    getCanvasCoordinates(event) {
        const rect = this.canvas.getBoundingClientRect();
        const coords = {
            x: event.clientX - rect.left - this.canvas.width / 2,
            y: -(event.clientY - rect.top - this.canvas.height / 2),
            pressure: event.pressure || 0.5
        };
        
        // 品質エンハンサーでの入力最適化（安全チェック・効率化）
        return this.qualityEnhancer?.optimizeInput?.(coords, event) || coords;
    }
    
    // OGL統一描画開始（品質エンハンサー連携強化・効率化）
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
        
        // プロエンハンサーでのブラシ適用（安全チェック・効率化）
        if (this.proEnhancer?.applyCurrentBrush) {
            this.currentStroke = this.proEnhancer.applyCurrentBrush(this.currentStroke);
        }
        
        event.preventDefault();
    }
    
    // OGL統一描画処理（品質エンハンサー統合・効率化）
    draw(event) {
        if (!this.isDrawing || !this.currentStroke) return;
        
        const pos = this.getCanvasCoordinates(event);
        const points = this.currentStroke.points;
        const lastPoint = points[points.length - 1];
        
        // 距離計算効率化
        const dx = pos.x - lastPoint.x;
        const dy = pos.y - lastPoint.y;
        const distanceSquared = dx * dx + dy * dy;
        
        // 最小移動距離チェック（効率化：平方根計算回避）
        const minDistance = this.settingsManager?.get('drawing.minDistance') || 1;
        const minDistanceSquared = minDistance * minDistance;
        if (distanceSquared < minDistanceSquared) return;
        
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
    
    // OGL統一描画終了（品質エンハンサー最終処理・効率化）
    stopDrawing(event) {
        if (!this.isDrawing || !this.currentStroke) return;
        
        this.isDrawing = false;
        
        if (this.currentStroke.points.length >= 1) {
            // 品質エンハンサーでの最終品質向上処理（安全チェック・効率化）
            if (this.qualityEnhancer?.enhanceStrokeQuality) {
                this.currentStroke = this.qualityEnhancer.enhanceStrokeQuality(this.currentStroke);
            }
            
            this.strokes.push(this.currentStroke);
        }
        
        this.currentStroke = null;
        this.updateStatus();
        event.preventDefault();
    }
    
    // OGL統一ストローク更新（品質エンハンサー統合・効率化）
    updateCurrentStroke() {
        const points = this.currentStroke.points;
        if (points.length < 2) return;
        
        // スムージング適用（条件チェック効率化）
        if (this.smoothing && this.qualityEnhancer?.applySmoothingToPoints) {
            this.currentStroke.points = this.qualityEnhancer.applySmoothingToPoints(points);
        }
        
        // 最新セグメントのみ追加（効率化）
        const processedPoints = this.currentStroke.points;
        if (processedPoints.length >= 2) {
            const segmentStart = Math.max(0, processedPoints.length - 2);
            const p1 = processedPoints[segmentStart];
            const p2 = processedPoints[segmentStart + 1];
            this.addLineSegment(p1, p2, this.currentStroke);
            this.updateStrokeMesh(this.currentStroke);
        }
    }
    
    // OGL統一線分追加（筆圧対応強化・効率化）
    addLineSegment(p1, p2, stroke) {
        // 筆圧レスポンス計算（品質エンハンサー連携・効率化）
        const size1 = this.qualityEnhancer?.enhancePressureResponse?.(p1.pressure, stroke.baseSize) || stroke.baseSize;
        const size2 = this.qualityEnhancer?.enhancePressureResponse?.(p2.pressure, stroke.baseSize) || stroke.baseSize;
        
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length === 0) return;
        
        // 正規化ベクトル計算効率化
        const invLength = 1 / length;
        const perpX1 = (-dy * invLength) * (size1 * 0.5);
        const perpY1 = (dx * invLength) * (size1 * 0.5);
        const perpX2 = (-dy * invLength) * (size2 * 0.5);
        const perpY2 = (dx * invLength) * (size2 * 0.5);
        
        const baseIndex = stroke.vertices.length / 3;
        
        // 頂点データ追加
        stroke.vertices.push(
            p1.x + perpX1, p1.y + perpY1, 0,
            p1.x - perpX1, p1.y - perpY1, 0,
            p2.x + perpX2, p2.y + perpY2, 0,
            p2.x - perpX2, p2.y - perpY2, 0
        );
        
        // インデックス追加
        stroke.indices.push(
            baseIndex, baseIndex + 1, baseIndex + 2,
            baseIndex + 1, baseIndex + 3, baseIndex + 2
        );
    }
    
    // OGL統一メッシュ更新（効率化）
    updateStrokeMesh(stroke) {
        if (stroke.vertices.length === 0) return;
        
        // 既存メッシュのクリーンアップ
        if (stroke.mesh) {
            stroke.mesh.setParent(null);
        }
        
        this.createMeshFromGeometry(stroke.vertices, stroke.indices, stroke);
    }
    
    // OGL統一ジオメトリからメッシュ作成（シェーダー強化・効率化）
    createMeshFromGeometry(vertices, indices, stroke) {
        const geometry = new Geometry(this.gl, {
            position: { size: 3, data: new Float32Array(vertices) },
            index: { data: new Uint16Array(indices) }
        });
        
        // シェーダープログラム（最適化）
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
    
    // OGL統一レンダリングループ（効率化）
    startRenderLoop() {
        const animate = (currentTime) => {
            this.frameCount++;
            
            // FPS計算効率化（1秒ごとのみ）
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
    
    // 基本制御メソッド（設定システム統合・効率化）
    resizeCanvas(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.renderer.setSize(width, height);
        this.setupCamera();
        this.render();
    }
    
    // クリア処理（メモリリーク対策強化・効率化）
    clear() {
        // バッチでリソース解放
        this.strokes.forEach(stroke => {
            if (stroke.mesh) {
                stroke.mesh.geometry?.remove();
                stroke.mesh.program?.remove();
                stroke.mesh.setParent(null);
            }
        });
        
        this.strokes.length = 0; // 配列クリア効率化
        
        if (this.currentStroke?.mesh) {
            this.currentStroke.mesh.setParent(null);
        }
        this.currentStroke = null;
        this.isDrawing = false;
        
        this.render();
        this.updateStatus();
    }
    
    // 取り消し処理（メモリリーク対策強化・効率化）
    undo() {
        if (this.strokes.length === 0) return;
        
        const lastStroke = this.strokes.pop();
        if (lastStroke.mesh) {
            lastStroke.mesh.geometry?.remove();
            lastStroke.mesh.program?.remove();
            lastStroke.mesh.setParent(null);
        }
        
        this.render();
        this.updateStatus();
    }
    
    // 設定メソッド群（設定システム統合・自動保存・効率化）
    setPenSize(size) {
        const newSize = Math.max(1, Math.min(50, size));
        this.penSize = newSize;
        this.settingsManager?.set('drawing.penSize', newSize);
    }
    
    setOpacity(opacity) {
        const newOpacity = Math.max(1, Math.min(100, opacity));
        this.opacity = newOpacity / 100;
        this.settingsManager?.set('drawing.opacity', newOpacity);
    }
    
    setPressureSensitivity(sensitivity) {
        const newSensitivity = Math.max(0, Math.min(100, sensitivity));
        this.pressureSensitivity = newSensitivity / 100;
        this.settingsManager?.set('drawing.pressureSensitivity', newSensitivity);
        
        // 品質エンハンサーへの即座反映
        this.qualityEnhancer?.updatePressureSettings?.(this.pressureSensitivity);
    }
    
    setSmoothing(enabled) {
        this.smoothing = enabled;
        this.settingsManager?.set('drawing.smoothing', enabled);
    }
    
    // ステータス更新（効率化）
    updateStatus() {
        this.uiController?.updateStatusDisplay?.(this.strokes.length, this.fps);
    }
}

// アプリケーション初期化（効率化）
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('drawingCanvas');
    if (!canvas) {
        console.error('Canvas element not found');
        return;
    }
    
    const drawingApp = new OGLUnifiedEngine(canvas);
    
    // グローバル参照（デバッグ用）
    window.drawingApp = drawingApp;
    
    // ウィンドウリサイズ対応（効率化）
    let resizeTimeout;
    window.addEventListener('resize', () => {
        if (!document.body.classList.contains('fullscreen-drawing')) return;
        
        // リサイズスロットリング
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            drawingApp.resizeCanvas(window.innerWidth - 20, window.innerHeight - 20);
        }, 100);
    });
});