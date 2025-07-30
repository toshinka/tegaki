import { Renderer, Camera, Transform, Polyline, Vec3 } from 'https://cdn.jsdelivr.net/npm/ogl@1.0.11/dist/ogl.mjs';

/**
 * 🎨 OGL Unified Engine (Phase 1)
 * OGLによる統一描画エンジン。Canvas2Dの機能を完全に代替する。
 * 憲章v5.2に基づき、単一エンジンによる支配を確立する。
 */
class OGLUnifiedEngine {
    constructor(canvas) {
        // WebGL統一基盤 [cite: 4]
        this.canvas = canvas;
        this.renderer = new Renderer({ canvas, alpha: true, antialias: true }); [cite: 4]
        this.gl = this.renderer.gl;

        // 2D描画用の正射影カメラ [cite: 5]
        this.camera = new Camera({
            left: -this.canvas.width / 2,
            right: this.canvas.width / 2,
            top: this.canvas.height / 2,
            bottom: -this.canvas.height / 2,
        });

        // 描画要素の配列管理（OGL Polylineの正しい扱い方） [cite: 6]
        // scene.addChild(polyline)はエラーの原因となるため、配列で管理し個別にレンダリングする [cite: 2, 3]
        this.polylines = [];
    }

    /**
     * WebGLのビューポートとカメラをキャンバスサイズに合わせて更新する
     * @param {number} width - 新しい幅
     * @param {number} height - 新しい高さ
     */
    resize(width, height) {
        this.renderer.setSize(width, height);
        this.camera.left = -width / 2;
        this.camera.right = width / 2;
        this.camera.top = height / 2;
        this.camera.bottom = -height / 2;
        this.camera.updateMatrixWorld();
    }

    /**
     * 新しいポリラインを描画要素配列に追加する
     * @param {object} polyline - OGLのPolylineインスタンス
     */
    addPolyline(polyline) {
        this.polylines.push(polyline); [cite: 17]
    }

    /**
     * 最後の描画操作を取り消す（配列操作）
     */
    undo() {
        this.polylines.pop();
    }
    
    /**
     * キャンバスをクリアする（配列を空にする）
     */
    clear() {
        this.polylines = [];
    }

    /**
     * キャンバス座標をWebGL座標に変換する
     * @param {number} canvasX 
     * @param {number} canvasY 
     * @returns {Vec3} WebGL座標
     */
    canvasToWebGLCoords(canvasX, canvasY) {
        return new Vec3(
            canvasX - this.canvas.width / 2,
            -canvasY + this.canvas.height / 2,
            0
        ); [cite: 29]
    }

    /**
     * 全ての描画要素をレンダリングする
     * Canvas2DのclearRectと描画順序維持を代替する [cite: 9, 10]
     * @param {Polyline} [tempPolyline=null] - 描画中のリアルタイムプレビュー用ポリライン
     */
    render(tempPolyline = null) {
        // 背景クリア（空のシーンをレンダリングすることで実現） [cite: 11]
        this.renderer.render({ scene: new Transform(), camera: this.camera });

        // 確定したポリラインを順次レンダリング [cite: 10, 18]
        this.polylines.forEach(p => this.renderer.render({ scene: p, camera: this.camera }));

        // 描画中のポリラインがあれば、それもレンダリングする
        if (tempPolyline) {
            this.renderer.render({ scene: tempPolyline, camera: this.camera });
        }
    }
}


/**
 * 🎨 App Controller (Phase 1)
 * UI制御、入力処理、状態管理を統合したアプリケーションコントローラー
 */
class AppController {
    constructor() {
        this.dom = {
            canvas: document.getElementById('ogl-canvas'),
            penToolBtn: document.getElementById('pen-tool'),
            resizeToolBtn: document.getElementById('resize-tool'),
            penControls: document.getElementById('pen-controls'),
            resizeControls: document.getElementById('resize-controls'),
            penSizeSlider: document.getElementById('pen-size-slider'),
            penSizeNumber: document.getElementById('pen-size-number'),
            penOpacitySlider: document.getElementById('pen-opacity-slider'),
            penOpacityNumber: document.getElementById('pen-opacity-number'),
            canvasWidthSlider: document.getElementById('canvas-width-slider'),
            canvasWidthNumber: document.getElementById('canvas-width-number'),
            canvasHeightSlider: document.getElementById('canvas-height-slider'),
            canvasHeightNumber: document.getElementById('canvas-height-number'),
            clearBtn: document.getElementById('clear-button'),
            undoBtn: document.getElementById('undo-button'),
        };

        // 初期化
        this.initState();
        this.engine = new OGLUnifiedEngine(this.dom.canvas);
        this.initCanvas();
        this.bindEventListeners();
        this.updateTool('pen');
        this.engine.render();

        console.log("🎨 モダンお絵かきツール Phase 1 起動");
        console.log("🚫 Canvas2D完全排除・OGL統一エンジンで動作中");
    }
    
    /**
     * アプリケーションの状態を初期化
     */
    initState() {
        this.state = {
            tool: 'pen',
            pen: { size: 3, opacity: 1 },
            canvas: { width: 500, height: 300 },
            isDrawing: false,
            currentPoints: [],
        };
    }
    
    /**
     * キャンバスの初期サイズ設定
     */
    initCanvas() {
        this.dom.canvas.width = this.state.canvas.width;
        this.dom.canvas.height = this.state.canvas.height;
        this.engine.resize(this.state.canvas.width, this.state.canvas.height);
    }

    /**
     * 全てのイベントリスナーを設定
     */
    bindEventListeners() {
        // ツール切替
        this.dom.penToolBtn.addEventListener('click', () => this.updateTool('pen'));
        this.dom.resizeToolBtn.addEventListener('click', () => this.updateTool('resize'));

        // アクションボタン
        this.dom.clearBtn.addEventListener('click', () => this.handleClear());
        this.dom.undoBtn.addEventListener('click', () => this.handleUndo());

        // ペン設定
        this.dom.penSizeSlider.addEventListener('input', (e) => this.handlePenSettings(e, 'size', this.dom.penSizeNumber));
        this.dom.penSizeNumber.addEventListener('input', (e) => this.handlePenSettings(e, 'size', this.dom.penSizeSlider));
        this.dom.penOpacitySlider.addEventListener('input', (e) => this.handlePenSettings(e, 'opacity', this.dom.penOpacityNumber));
        this.dom.penOpacityNumber.addEventListener('input', (e) => this.handlePenSettings(e, 'opacity', this.dom.penOpacitySlider));
        
        // キャンバスリサイズ設定
        this.dom.canvasWidthSlider.addEventListener('input', (e) => this.handleResizeSettings(e, 'width', this.dom.canvasWidthNumber));
        this.dom.canvasWidthNumber.addEventListener('input', (e) => this.handleResizeSettings(e, 'width', this.dom.canvasWidthSlider));
        this.dom.canvasHeightSlider.addEventListener('input', (e) => this.handleResizeSettings(e, 'height', this.dom.canvasHeightNumber));
        this.dom.canvasHeightNumber.addEventListener('input', (e) => this.handleResizeSettings(e, 'height', this.dom.canvasHeightSlider));
        
        // 描画イベント（Pointer Eventsでマウスとタッチを統合）
        this.dom.canvas.addEventListener('pointerdown', (e) => this.handlePointerDown(e));
        this.dom.canvas.addEventListener('pointermove', (e) => this.handlePointerMove(e));
        this.dom.canvas.addEventListener('pointerup', () => this.handlePointerUp());
        this.dom.canvas.addEventListener('pointerleave', () => this.handlePointerUp());
    }

    /**
     * ツールの切り替え処理
     * @param {string} toolName - 'pen' または 'resize'
     */
    updateTool(toolName) {
        this.state.tool = toolName;
        
        this.dom.penToolBtn.classList.toggle('active', toolName === 'pen');
        this.dom.resizeToolBtn.classList.toggle('active', toolName === 'resize');
        
        this.dom.penControls.classList.toggle('active', toolName === 'pen');
        this.dom.resizeControls.classList.toggle('active', toolName === 'resize');
    }

    handlePenSettings(event, property, targetElement) {
        const value = event.target.value;
        targetElement.value = value;
        this.state.pen[property] = property === 'opacity' ? value / 100 : Number(value);
    }
    
    handleResizeSettings(event, dimension, targetElement) {
        const value = Number(event.target.value);
        targetElement.value = value;
        this.state.canvas[dimension] = value;
        
        this.dom.canvas.width = this.state.canvas.width;
        this.dom.canvas.height = this.state.canvas.height;
        this.engine.resize(this.state.canvas.width, this.state.canvas.height);
        this.engine.render();
    }
    
    handleClear() {
        this.engine.clear();
        this.engine.render();
    }

    handleUndo() {
        this.engine.undo();
        this.engine.render();
    }
    
    // --- OGL描画イベントハンドラ ---

    handlePointerDown(event) {
        if (this.state.tool !== 'pen') return;
        this.state.isDrawing = true;
        this.state.currentPoints = [this.engine.canvasToWebGLCoords(event.offsetX, event.offsetY)];
    }

    handlePointerMove(event) {
        if (!this.state.isDrawing || this.state.tool !== 'pen') return;
        
        this.state.currentPoints.push(this.engine.canvasToWebGLCoords(event.offsetX, event.offsetY));
        
        // リアルタイム描画のためのプレビュー
        if (this.state.currentPoints.length < 2) return;
        const tempPolyline = new Polyline(this.gl, {
            points: this.state.currentPoints,
            uniforms: {
                uColor: [0, 0, 0], // Note: OGL color is 0-1 range. This is black.
                uThickness: this.state.pen.size,
                uAlpha: this.state.pen.opacity,
            },
        });
        this.engine.render(tempPolyline);
    }

    handlePointerUp() {
        if (!this.state.isDrawing || this.state.tool !== 'pen') return;
        this.state.isDrawing = false;
        
        if (this.state.currentPoints.length < 2) {
            this.state.currentPoints = [];
            this.engine.render(); // Clear any preview
            return;
        }

        // 描画を確定して配列に追加
        const finalPolyline = new Polyline(this.gl, {
            points: this.state.currentPoints,
            uniforms: {
                uColor: [0, 0, 0],
                uThickness: this.state.pen.size,
                uAlpha: this.state.pen.opacity,
            },
        });
        this.engine.addPolyline(finalPolyline);
        
        this.state.currentPoints = [];
        this.engine.render();
    }
}

// アプリケーションの起動
document.addEventListener('DOMContentLoaded', () => {
    new AppController();
});