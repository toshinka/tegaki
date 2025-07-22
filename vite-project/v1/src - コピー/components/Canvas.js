// src/components/Canvas.js - キャンバスの入出力処理

/**
 * キャンバスのUIイベントと描画エンジンを接続するクラス
 */
export class Canvas {
    /**
     * @param {HTMLCanvasElement} canvasElement - 操作対象のcanvas要素
     * @param {import('./App.js').App} app - アプリケーションのメインインスタンス
     */
    constructor(canvasElement, app) {
        if (!canvasElement || !app) {
            throw new Error("Canvas requires a canvas element and an app instance.");
        }
        this.canvas = canvasElement;
        this.app = app;
        this.engine = null; // エンジンは後から取得

        this.setupEventListeners();
        console.log('✅ Canvas initialized');
    }

    /**
     * Pointer Events APIを利用したイベントリスナーを設定
     */
    setupEventListeners() {
        this.canvas.style.touchAction = 'none'; // スマホでのブラウザ標準ジェスチャーを無効化
        this.canvas.addEventListener('pointerdown', this.onPointerDown.bind(this));
        this.canvas.addEventListener('pointermove', this.onPointerMove.bind(this));
        this.canvas.addEventListener('pointerup', this.onPointerUp.bind(this));
        this.canvas.addEventListener('pointerleave', this.onPointerUp.bind(this));
        this.canvas.addEventListener('pointercancel', this.onPointerUp.bind(this));
        this.canvas.addEventListener('contextmenu', e => e.preventDefault());
    }

    /**
     * 描画エンジンを遅延取得する
     * App.jsの初期化順序に対応するため、初回イベント時にエンジンを取得する
     * @returns {import('../engine/vector/BezierPenEngine.js').BezierPenEngine | null}
     */
    getEngine() {
        if (!this.engine) {
            this.engine = this.app.getEngine();
        }
        return this.engine;
    }

    /**
     * ポインター押下時の処理
     * @param {PointerEvent} e 
     */
    onPointerDown(e) {
        const engine = this.getEngine();
        // [修正] e.buttonによる判定を、より汎用的なe.isPrimaryに変更
        // これにより、マウスの左クリック、ペンの先端、最初のタッチ指を主入力として扱う
        if (!e.isPrimary || !engine) return;

        this.app.setDrawing(true);
        this.canvas.setPointerCapture(e.pointerId);
        const data = engine.getPointerData(e);
        engine.startStroke(data.x, data.y, data.pressure);
        e.preventDefault();
    }

    /**
     * ポインター移動時の処理
     * @param {PointerEvent} e 
     */
    onPointerMove(e) {
        // [修正] isPrimaryチェックを追加し、主入力でのドラッグのみを処理する
        if (!this.app.isCurrentlyDrawing() || !e.isPrimary) return;
        
        const engine = this.getEngine();
        if (!engine) return;

        const data = engine.getPointerData(e);
        engine.continueStroke(data.x, data.y, data.pressure);
        e.preventDefault();
    }

    /**
     * ポインター解放時の処理
     * @param {PointerEvent} e 
     */
    onPointerUp(e) {
        // [修正] isPrimaryチェックを追加し、主入力の解放時のみを処理する
        if (!this.app.isCurrentlyDrawing() || !e.isPrimary) return;

        const engine = this.getEngine();
        if (engine) {
             engine.endStroke();
        }
       
        this.app.setDrawing(false);
        if (this.canvas.hasPointerCapture(e.pointerId)) {
            this.canvas.releasePointerCapture(e.pointerId);
        }
        e.preventDefault();
    }
}
