// src/engine/OGLUnifiedEngine.js - OGL統一エンジン
// v5.2 OGL単一エンジン特化実装

import { Renderer, Camera, Transform, Polyline, Vec3, Color } from 'https://cdnjs.cloudflare.com/ajax/libs/ogl/1.0.6/ogl.mjs';

// ツール設定定数
const OGL_TOOL_CONFIG = {
    pen: {
        type: 'pen',
        polyline: {
            lineWidth: 3,
            color: [0, 0, 0, 1], // RGBA
            smooth: true,
            join: 'round',
            cap: 'round'
        },
        shader: 'pen',
        blend: 'normal'
    },
    eraser: {
        type: 'eraser',
        polyline: {
            lineWidth: 10,
            color: [1, 1, 1, 1], // 白色で消去
            smooth: true,
            join: 'round',
            cap: 'round'
        },
        shader: 'eraser',
        blend: 'multiply'
    }
};

export class OGLUnifiedEngine {
    constructor(canvas) {
        console.log('🎨 OGL統一エンジン構築開始...');
        
        this.canvas = canvas;
        this.renderer = null;
        this.scene = null;
        this.camera = null;
        
        // OGL統一システム
        this.polylineSystem = null;
        this.strokeHistory = [];
        this.activeStrokes = new Map();
        
        // ツール制御
        this.currentTool = 'pen';
        this.toolSettings = { ...OGL_TOOL_CONFIG.pen };
        
        // 状態管理
        this.isReady = false;
        this.frameId = null;
        this.strokeIdCounter = 0;
        
        console.log('📦 OGL統一エンジン構築完了');
    }

    async initialize() {
        try {
            console.log('🚀 OGL統一エンジン初期化開始...');

            // OGLレンダラー初期化
            this.renderer = new Renderer({
                canvas: this.canvas,
                width: this.canvas.width,
                height: this.canvas.height,
                alpha: true,
                antialias: true,
                preserveDrawingBuffer: true
            });

            // シーン・カメラ初期化
            this.scene = new Transform();
            this.camera = new Camera({
                left: 0,
                right: this.canvas.width,
                bottom: this.canvas.height,
                top: 0,
                near: 0.1,
                far: 100
            });
            this.camera.position.z = 1;

            // OGL統合システム初期化
            await this.initializePolylineSystem();
            
            // レンダリングループ開始
            this.startRenderLoop();

            this.isReady = true;
            console.log('✅ OGL統一エンジン初期化完了');

        } catch (error) {
            console.error('❌ OGL統一エンジン初期化失敗:', error);
            throw error;
        }
    }

    async initializePolylineSystem() {
        console.log('📐 OGLポリラインシステム初期化...');
        
        // ポリラインシステム設定
        this.polylineSystem = {
            strokes: [],
            currentConfig: null
        };

        console.log('✅ OGLポリラインシステム初期化完了');
    }

    // === ツール制御（OGL統一） ===
    async selectTool(toolName) {
        if (!OGL_TOOL_CONFIG[toolName]) {
            throw new Error(`未知のツール: ${toolName}`);
        }

        console.log(`🔧 OGLツール選択: ${toolName}`);

        this.currentTool = toolName;
        this.toolSettings = { ...OGL_TOOL_CONFIG[toolName] };
        
        // OGLポリラインシステム設定更新
        this.updatePolylineConfig();

        console.log(`✅ OGLツール選択完了: ${toolName}`);
    }

    updatePolylineConfig() {
        if (this.polylineSystem) {
            this.polylineSystem.currentConfig = this.toolSettings.polyline;
        }
    }

    updateToolProperty(property, value) {
        console.log(`🎛️ ツールプロパティ更新: ${property} = ${value}`);

        switch (property) {
            case 'size':
                this.toolSettings.polyline.lineWidth = value;
                break;
            case 'opacity':
                // RGBA の A 値を更新
                this.toolSettings.polyline.color[3] = value / 100;
                break;
            default:
                console.warn(`未知のプロパティ: ${property}`);
        }

        this.updatePolylineConfig();
    }

    // === ストローク処理（OGL統一描画） ===
    startStroke(x, y, pressure = 1.0) {
        const strokeId = this.generateStrokeId();
        
        console.log(`🖊️ OGLストローク開始: ID=${strokeId}, 座標=(${x.toFixed(1)}, ${y.toFixed(1)}), 筆圧=${pressure.toFixed(2)}`);

        // ストローク初期化
        const stroke = {
            id: strokeId,
            tool: this.currentTool,
            points: [{ x, y, pressure }],
            config: { ...this.toolSettings },
            polyline: null,
            isActive: true,
            created: Date.now()
        };

        // OGLポリライン作成
        this.createOGLPolyline(stroke);

        // 管理配列に追加
        this.activeStrokes.set(strokeId, stroke);

        return strokeId;
    }

    continueStroke(strokeId, x, y, pressure = 1.0) {
        const stroke = this.activeStrokes.get(strokeId);
        if (!stroke || !stroke.isActive) {
            console.warn(`⚠️ 無効なストローク: ${strokeId}`);
            return;
        }

        // ポイント追加
        stroke.points.push({ x, y, pressure });

        // OGLポリライン更新
        this.updateOGLPolyline(stroke);
    }

    endStroke(strokeId) {
        const stroke = this.activeStrokes.get(strokeId);
        if (!stroke) {
            console.warn(`⚠️ 存在しないストローク: ${strokeId}`);
            return;
        }

        console.log(`🖊️ OGLストローク終了: ID=${strokeId}, ポイント数=${stroke.points.length}`);

        // ストローク終了処理
        stroke.isActive = false;
        stroke.completed = Date.now();

        // 履歴に追加
        this.strokeHistory.push(stroke);

        // アクティブストロークから削除
        this.activeStrokes.delete(strokeId);

        console.log(`✅ ストローク完了: 履歴数=${this.strokeHistory.length}`);
    }

    // === OGLポリライン描画（統一実装） ===
    createOGLPolyline(stroke) {
        try {
            // ポイント配列をOGL Vec3形式に変換
            const points = this.convertPointsToVec3(stroke.points);
            
            if (points.length < 2) {
                // 1点の場合は小さな線分として描画
                points.push(new Vec3(points[0].x + 0.1, points[0].y, 0));
            }

            // OGLポリライン作成
            const polyline = new Polyline({
                points: points,
                uniforms: {
                    uColor: { value: new Color(...stroke.config.polyline.color) },
                    uThickness: { value: stroke.config.polyline.lineWidth }
                }
            });

            // シーンに追加
            polyline.setParent(this.scene);
            stroke.polyline = polyline;

            console.log(`📐 OGLポリライン作成: 点数=${points.length}`);

        } catch (error) {
            console.error('❌ OGLポリライン作成エラー:', error);
        }
    }

    updateOGLPolyline(stroke) {
        if (!stroke.polyline) return;

        try {
            // ポイント配列更新
            const points = this.convertPointsToVec3(stroke.points);
            
            // OGLポリライン更新
            stroke.polyline.geometry.attributes.position.data = this.pointsToFloatArray(points);
            stroke.polyline.geometry.attributes.position.needsUpdate = true;

        } catch (error) {
            console.error('❌ OGLポリライン更新エラー:', error);
        }
    }

    convertPointsToVec3(points) {
        return points.map(point => new Vec3(point.x, point.y, 0));
    }

    pointsToFloatArray(vec3Points) {
        const array = new Float32Array(vec3Points.length * 3);
        vec3Points.forEach((point, i) => {
            array[i * 3] = point.x;
            array[i * 3 + 1] = point.y;
            array[i * 3 + 2] = point.z;
        });
        return array;
    }

    // === レンダリング制御 ===
    startRenderLoop() {
        const render = () => {
            this.renderer.render({ scene: this.scene, camera: this.camera });
            this.frameId = requestAnimationFrame(render);
        };
        render();
        console.log('🎬 OGLレンダリングループ開始');
    }

    stopRenderLoop() {
        if (this.frameId) {
            cancelAnimationFrame(this.frameId);
            this.frameId = null;
            console.log('⏹️ OGLレンダリングループ停止');
        }
    }

    // === キャンバス制御 ===
    clearCanvas() {
        console.log('🗑️ OGLキャンバスクリア開始...');

        try {
            // 全ストロークをシーンから削除
            [...this.activeStrokes.values(), ...this.strokeHistory].forEach(stroke => {
                if (stroke.polyline && stroke.polyline.parent) {
                    stroke.polyline.setParent(null);
                }
            });

            // データクリア
            this.activeStrokes.clear();
            this.strokeHistory.length = 0;

            console.log('✅ OGLキャンバスクリア完了');

        } catch (error) {
            console.error('❌ キャンバスクリアエラー:', error);
        }
    }

    undo() {
        if (this.strokeHistory.length === 0) {
            console.log('↶ 取り消し対象なし');
            return;
        }

        try {
            const lastStroke = this.strokeHistory.pop();
            
            // シーンから削除
            if (lastStroke.polyline && lastStroke.polyline.parent) {
                lastStroke.polyline.setParent(null);
            }

            console.log(`↶ 取り消し完了: 残り履歴数=${this.strokeHistory.length}`);

        } catch (error) {
            console.error('❌ 取り消しエラー:', error);
        }
    }

    // === ユーティリティ ===
    generateStrokeId() {
        return `stroke_${++this.strokeIdCounter}_${Date.now()}`;
    }

    getCurrentTool() {
        return this.currentTool;
    }

    getCurrentToolSettings() {
        return {
            tool: this.currentTool,
            size: this.toolSettings.polyline.lineWidth,
            opacity: Math.round(this.toolSettings.polyline.color[3] * 100),
            color: this.toolSettings.polyline.color
        };
    }

    isReady() {
        return this.isReady;
    }

    getStrokeCount() {
        return this.strokeHistory.length + this.activeStrokes.size;
    }

    // === 廃棄処理 ===
    dispose() {
        console.log('🧹 OGL統一エンジン廃棄開始...');

        try {
            // レンダリングループ停止
            this.stopRenderLoop();

            // キャンバスクリア
            this.clearCanvas();

            // OGLリソース廃棄
            if (this.renderer) {
                // WebGLコンテキスト廃棄
                const gl = this.renderer.gl;
                if (gl) {
                    gl.getExtension('WEBGL_lose_context')?.loseContext();
                }
            }

            // 参照クリア
            this.renderer = null;
            this.scene = null;
            this.camera = null;
            this.polylineSystem = null;

            this.isReady = false;

            console.log('✅ OGL統一エンジン廃棄完了');

        } catch (error) {
            console.error('❌ 廃棄処理エラー:', error);
        }
    }

    // === デバッグ用 ===
    getDebugInfo() {
        return {
            ready: this.isReady,
            currentTool: this.currentTool,
            activeStrokes: this.activeStrokes.size,
            strokeHistory: this.strokeHistory.length,
            totalStrokes: this.getStrokeCount(),
            canvasSize: {
                width: this.canvas.width,
                height: this.canvas.height
            },
            toolSettings: this.getCurrentToolSettings()
        };
    }

    logStatus() {
        console.log('📊 OGL統一エンジン状態:', this.getDebugInfo());
    }
}