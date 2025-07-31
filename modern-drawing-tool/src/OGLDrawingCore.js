// OGLDrawingCore.js - OGL統一描画エンジン（Phase1基盤・500-600行）

import { Renderer, Camera, Transform, Mesh, Program, Geometry, Texture, Vec2, Vec3 } from 'ogl';

/**
 * 🔥 OGL統一描画エンジン
 * Canvas2D完全排除・OGL WebGL統一・ベクター至上主義
 */
export class OGLUnifiedEngine {
    constructor(canvasElement) {
        this.canvas = canvasElement;
        this.renderer = null;
        this.scene = null;
        this.camera = null;
        
        // 描画システム
        this.polylineSystem = null;
        this.currentStrokes = [];
        this.activeStroke = null;
        
        // ツール設定（Phase1.5で拡張）
        this.currentTool = 'pen';
        this.toolSettings = {
            pen: { width: 2, opacity: 1.0, color: [0.5, 0.0, 0.0] }, // ふたば色系
            eraser: { width: 10, opacity: 1.0 }
            // Phase2でエアスプレー・ボカシ等追加予定
        };
        
        // 入力状態
        this.isDrawing = false;
        this.currentPoints = [];
        this.pressure = 1.0;
        
        // レンダリング制御
        this.needsRender = true;
        this.animationId = null;
        
        // エラーハンドリング
        this.onError = null;
        
        // Phase2以降拡張予定
        // this.layerSystem = null;        // Phase3で追加
        // this.transformSystem = null;    // Phase3で追加
        // this.animationSystem = null;    // Phase4で追加
        // this.meshDeformSystem = null;   // Phase4でLIVE2D風変形追加
    }
    
    /**
     * 🚀 OGL統一エンジン初期化
     */
    initialize() {
        try {
            // OGLRenderer初期化（WebGL統一）
            this.renderer = new Renderer({
                canvas: this.canvas,
                width: this.canvas.width,
                height: this.canvas.height,
                dpr: Math.min(window.devicePixelRatio, 2),
                alpha: true,
                antialias: true,
                preserveDrawingBuffer: true // Phase3以降でスナップショット用
            });
            
            // カメラ設定（2D描画用正投影）
            this.camera = new Camera({
                left: -this.canvas.width / 2,
                right: this.canvas.width / 2,
                bottom: -this.canvas.height / 2,
                top: this.canvas.height / 2,
                near: 0.1,
                far: 100
            });
            this.camera.position.set(0, 0, 1);
            
            // シーン初期化
            this.scene = new Transform();
            
            // ポリラインシステム初期化
            this.initializePolylineSystem();
            
            // キャンバス背景設定（ふたば☆ちゃんねる色）
            this.renderer.gl.clearColor(0.941, 0.878, 0.839, 1.0); // #f0e0d6
            
            console.log('✅ OGL統一エンジン初期化完了');
            
        } catch (error) {
            this.handleError('OGL Engine Initialization Failed', error);
        }
    }
    
    /**
     * 🎨 ポリラインシステム初期化（OGL統一線描画）
     */
    initializePolylineSystem() {
        // カスタムライン描画シェーダー
        const vertexShader = `
            attribute vec2 position;
            attribute vec2 uv;
            attribute float pressure;
            
            uniform mat4 modelViewMatrix;
            uniform mat4 projectionMatrix;
            uniform float lineWidth;
            uniform float globalOpacity;
            
            varying vec2 vUv;
            varying float vPressure;
            varying float vOpacity;
            
            void main() {
                vUv = uv;
                vPressure = pressure;
                vOpacity = globalOpacity;
                
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 0.0, 1.0);
            }
        `;
        
        const fragmentShader = `
            precision mediump float;
            
            uniform vec3 color;
            uniform float opacity;
            
            varying vec2 vUv;
            varying float vPressure;
            varying float vOpacity;
            
            void main() {
                // 筆圧による線幅調整
                float alpha = 1.0 - length(vUv - 0.5) * 2.0;
                alpha *= vPressure * vOpacity * opacity;
                
                gl_FragColor = vec4(color, alpha);
            }
        `;
        
        this.lineProgram = new Program(this.renderer.gl, {
            vertex: vertexShader,
            fragment: fragmentShader,
            uniforms: {
                color: { value: [0.5, 0.0, 0.0] }, // ふたば色デフォルト
                opacity: { value: 1.0 },
                lineWidth: { value: 2.0 },
                globalOpacity: { value: 1.0 }
            },
            transparent: true,
            cullFace: null
        });
        
        this.polylineSystem = {
            program: this.lineProgram,
            strokes: []
        };
    }
    
    /**
     * 🖌️ ツール選択（OGL専用機能起動トリガー）
     */
    selectTool(toolName) {
        if (!this.toolSettings[toolName]) {
            console.warn(`🚨 未知のツール: ${toolName}`);
            return;
        }
        
        this.currentTool = toolName;
        const settings = this.toolSettings[toolName];
        
        // OGL統一設定更新
        if (this.lineProgram) {
            this.lineProgram.uniforms.color.value = settings.color || [0.5, 0.0, 0.0];
            this.lineProgram.uniforms.opacity.value = settings.opacity || 1.0;
            this.lineProgram.uniforms.lineWidth.value = settings.width || 2.0;
        }
        
        console.log(`🎨 ツール切り替え: ${toolName}`, settings);
        this.needsRender = true;
    }
    
    /**
     * 🎯 ストローク開始
     */
    startStroke(x, y, pressure = 1.0) {
        this.isDrawing = true;
        this.pressure = pressure;
        this.currentPoints = [{ x, y, pressure }];
        this.activeStroke = {
            tool: this.currentTool,
            points: this.currentPoints,
            settings: { ...this.toolSettings[this.currentTool] }
        };
        
        console.log(`🎯 ストローク開始: (${x}, ${y}) 筆圧: ${pressure}`);
    }
    
    /**
     * ✏️ ストローク更新
     */
    updateStroke(x, y, pressure = 1.0) {
        if (!this.isDrawing || !this.activeStroke) return;
        
        this.pressure = pressure;
        this.currentPoints.push({ x, y, pressure });
        
        // スムージング処理（簡易版・Phase2で高度化）
        this.smoothCurrentStroke();
        
        // OGL統一描画更新
        this.updateActiveStrokeMesh();
        this.needsRender = true;
    }
    
    /**
     * ✅ ストローク終了
     */
    endStroke() {
        if (!this.isDrawing || !this.activeStroke) return;
        
        this.isDrawing = false;
        
        // 最終スムージング
        this.smoothCurrentStroke();
        
        // ストローク確定・履歴追加
        this.finalizeStroke();
        
        // リセット
        this.activeStroke = null;
        this.currentPoints = [];
        
        console.log('✅ ストローク終了・確定');
    }
    
    /**
     * 🌊 スムージング処理（Phase2で高度化予定）
     */
    smoothCurrentStroke() {
        if (this.currentPoints.length < 3) return;
        
        // 簡易スムージング（Phase2でベジエ曲線等に拡張）
        const smoothed = [];
        smoothed.push(this.currentPoints[0]);
        
        for (let i = 1; i < this.currentPoints.length - 1; i++) {
            const prev = this.currentPoints[i - 1];
            const curr = this.currentPoints[i];
            const next = this.currentPoints[i + 1];
            
            const smoothedPoint = {
                x: (prev.x + curr.x + next.x) / 3,
                y: (prev.y + curr.y + next.y) / 3,
                pressure: (prev.pressure + curr.pressure + next.pressure) / 3
            };
            smoothed.push(smoothedPoint);
        }
        
        smoothed.push(this.currentPoints[this.currentPoints.length - 1]);
        this.currentPoints = smoothed;
    }
    
    /**
     * 🎨 アクティブストロークメッシュ更新
     */
    updateActiveStrokeMesh() {
        if (!this.activeStroke || this.currentPoints.length < 2) return;
        
        try {
            // ポリライン用ジオメトリ生成
            const geometry = this.createPolylineGeometry(this.currentPoints);
            
            // 既存のアクティブメッシュ削除
            if (this.activeStroke.mesh) {
                this.scene.removeChild(this.activeStroke.mesh);
            }
            
            // 新規メッシュ作成
            this.activeStroke.mesh = new Mesh(this.renderer.gl, {
                geometry,
                program: this.lineProgram
            });
            
            this.scene.addChild(this.activeStroke.mesh);
            
        } catch (error) {
            this.handleError('Active Stroke Mesh Update Failed', error);
        }
    }
    
    /**
     * 📐 ポリラインジオメトリ生成（OGL統一）
     */
    createPolylineGeometry(points) {
        if (points.length < 2) return null;
        
        const positions = [];
        const uvs = [];
        const pressures = [];
        const indices = [];
        
        // ライン幅算出
        const width = this.toolSettings[this.currentTool]?.width || 2.0;
        
        for (let i = 0; i < points.length - 1; i++) {
            const curr = points[i];
            const next = points[i + 1];
            
            // 方向ベクトル
            const dx = next.x - curr.x;
            const dy = next.y - curr.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            
            if (length === 0) continue;
            
            // 法線ベクトル
            const nx = -dy / length;
            const ny = dx / length;
            
            // 筆圧考慮幅
            const currWidth = width * curr.pressure * 0.5;
            const nextWidth = width * next.pressure * 0.5;
            
            // 頂点生成
            const baseIndex = positions.length / 2;
            
            // 現在点の両端
            positions.push(curr.x + nx * currWidth, curr.y + ny * currWidth);
            positions.push(curr.x - nx * currWidth, curr.y - ny * currWidth);
            
            // 次点の両端
            positions.push(next.x + nx * nextWidth, next.y + ny * nextWidth);
            positions.push(next.x - nx * nextWidth, next.y - ny * nextWidth);
            
            // UV座標
            uvs.push(0, 0, 0, 1, 1, 0, 1, 1);
            
            // 筆圧
            pressures.push(curr.pressure, curr.pressure, next.pressure, next.pressure);
            
            // インデックス（三角形2つ）
            indices.push(
                baseIndex, baseIndex + 1, baseIndex + 2,
                baseIndex + 1, baseIndex + 3, baseIndex + 2
            );
        }
        
        return new Geometry(this.renderer.gl, {
            position: { size: 2, data: new Float32Array(positions) },
            uv: { size: 2, data: new Float32Array(uvs) },
            pressure: { size: 1, data: new Float32Array(pressures) },
            index: { data: new Uint16Array(indices) }
        });
    }
    
    /**
     * ✅ ストローク確定
     */
    finalizeStroke() {
        if (!this.activeStroke) return;
        
        try {
            // 最終ジオメトリ生成
            const geometry = this.createPolylineGeometry(this.currentPoints);
            
            // 確定ストローク作成
            const finalStroke = {
                id: Date.now() + Math.random(),
                tool: this.activeStroke.tool,
                points: [...this.currentPoints],
                settings: { ...this.activeStroke.settings },
                mesh: new Mesh(this.renderer.gl, {
                    geometry,
                    program: this.lineProgram
                })
            };
            
            // シーンに追加
            this.scene.addChild(finalStroke.mesh);
            this.currentStrokes.push(finalStroke);
            
            // アクティブストローク削除
            if (this.activeStroke.mesh) {
                this.scene.removeChild(this.activeStroke.mesh);
            }
            
            console.log(`✅ ストローク確定 ID: ${finalStroke.id}`);
            
        } catch (error) {
            this.handleError('Stroke Finalization Failed', error);
        }
    }
    
    /**
     * 🔄 レンダリングループ開始
     */
    startRenderLoop() {
        const render = () => {
            if (this.needsRender) {
                this.renderer.render({
                    scene: this.scene,
                    camera: this.camera
                });
                this.needsRender = false;
            }
            
            this.animationId = requestAnimationFrame(render);
        };
        
        render();
        console.log('🔄 OGL統一レンダリングループ開始');
    }
    
    /**
     * ⏹️ レンダリングループ停止
     */
    stopRenderLoop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        console.log('⏹️ レンダリングループ停止');
    }
    
    /**
     * 🖼️ キャンバスクリア
     */
    clearCanvas() {
        try {
            // 全ストローク削除
            this.currentStrokes.forEach(stroke => {
                if (stroke.mesh) {
                    this.scene.removeChild(stroke.mesh);
                }
            });
            this.currentStrokes = [];
            
            // アクティブストローク削除
            if (this.activeStroke?.mesh) {
                this.scene.removeChild(this.activeStroke.mesh);
            }
            this.activeStroke = null;
            this.currentPoints = [];
            this.isDrawing = false;
            
            this.needsRender = true;
            console.log('🖼️ キャンバスクリア完了');
            
        } catch (error) {
            this.handleError('Canvas Clear Failed', error);
        }
    }
    
    /**
     * 📏 キャンバスリサイズ
     */
    resizeCanvas(width, height) {
        try {
            this.canvas.width = width;
            this.canvas.height = height;
            
            this.renderer.setSize(width, height);
            
            // カメラ更新
            this.camera.left = -width / 2;
            this.camera.right = width / 2;
            this.camera.bottom = -height / 2;
            this.camera.top = height / 2;
            this.camera.updateProjectionMatrix();
            
            this.needsRender = true;
            console.log(`📏 キャンバスリサイズ: ${width}x${height}`);
            
        } catch (error) {
            this.handleError('Canvas Resize Failed', error);
        }
    }
    
    /**
     * 🎨 ツール設定更新
     */
    updateToolSettings(toolName, settings) {
        if (!this.toolSettings[toolName]) {
            this.toolSettings[toolName] = {};
        }
        
        Object.assign(this.toolSettings[toolName], settings);
        
        // 現在のツールの場合は即座に反映
        if (this.currentTool === toolName) {
            this.selectTool(toolName);
        }
        
        console.log(`🎨 ツール設定更新: ${toolName}`, settings);
    }
    
    /**
     * 📊 エンジン状態取得
     */
    getEngineState() {
        return {
            currentTool: this.currentTool,
            isDrawing: this.isDrawing,
            strokeCount: this.currentStrokes.length,
            canvasSize: {
                width: this.canvas.width,
                height: this.canvas.height
            },
            // Phase2以降で詳細状態追加
            toolSettings: { ...this.toolSettings }
        };
    }
    
    /**
     * 🔄 強制レンダリング
     */
    forceRender() {
        this.needsRender = true;
    }
    
    /**
     * 🚨 エラーハンドリング
     */
    handleError(message, error) {
        console.error(`🚨 OGL Engine Error: ${message}`, error);
        
        if (this.onError) {
            this.onError({ message, error, timestamp: Date.now() });
        }
        
        // Phase2以降でエラーリカバリー機能追加
    }
    
    /**
     * 🧹 リソース解放
     */
    dispose() {
        try {
            this.stopRenderLoop();
            
            // 全ストローク解放
            this.currentStrokes.forEach(stroke => {
                if (stroke.mesh) {
                    stroke.mesh.geometry?.dispose();
                    this.scene.removeChild(stroke.mesh);
                }
            });
            
            // アクティブストローク解放
            if (this.activeStroke?.mesh) {
                this.activeStroke.mesh.geometry?.dispose();
                this.scene.removeChild(this.activeStroke.mesh);
            }
            
            // プログラム解放
            this.lineProgram?.dispose();
            
            console.log('🧹 OGL Engine リソース解放完了');
            
        } catch (error) {
            this.handleError('Resource Disposal Failed', error);
        }
    }
    
    // Phase2以降で拡張予定の機能スタブ
    
    /**
     * Phase2: エアスプレー・ボカシツール追加予定
     */
    /*
    initializeAirbrushTool() {
        // Phase2で実装: パーティクルシステム + カスタムシェーダー
    }
    
    initializeBlurTool() {
        // Phase2で実装: ガウシアンブラー + ポストプロセシング
    }
    */
    
    /**
     * Phase3: レイヤーシステム統合予定
     */
    /*
    initializeLayerSystem() {
        // Phase3で実装: マルチレイヤー + ブレンドモード
        // this.layerSystem = new OGLLayerSystem(this.renderer);
    }
    
    addLayer(name, opacity = 1.0) {
        // Phase3で実装: 新規レイヤー追加
    }
    
    setActiveLayer(layerId) {
        // Phase3で実装: アクティブレイヤー切り替え
    }
    */
    
    /**
     * Phase4: LIVE2D風メッシュ変形予定
     */
    /*
    initializeMeshDeformation() {
        // Phase4で実装: LIVE2D風メッシュ変形システム
        // this.meshDeformSystem = new OGLMeshDeformSystem(this.renderer);
    }
    
    startMeshDeform(controlPoints) {
        // Phase4で実装: メッシュ変形開始
    }
    
    updateMeshDeform(controlPoints) {
        // Phase4で実装: リアルタイム変形更新
    }
    */
    
    /**
     * Phase4: アニメーションシステム予定
     */
    /*
    initializeAnimationSystem() {
        // Phase4で実装: Storyboarder風アニメーション
        // this.animationSystem = new OGLAnimationSystem(this.renderer);
    }
    
    createAnimationCut(name) {
        // Phase4で実装: アニメカット作成
    }
    
    switchAnimationCut(cutId) {
        // Phase4で実装: カット切り替え
    }
    */
}