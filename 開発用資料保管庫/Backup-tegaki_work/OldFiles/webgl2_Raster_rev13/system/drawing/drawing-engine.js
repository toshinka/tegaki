/**
 * ============================================================
 * drawing-engine.js - Phase 3.3: ラスター対応版
 * ============================================================
 * 
 * 【親依存】
 * - system/drawing/brush-core.js (BrushCore)
 * - system/drawing/pointer-handler.js (PointerHandler)
 * - coordinate-system.js (CoordinateSystem)
 * - system/camera-system.js (CameraSystem)
 * - system/layer-system.js (LayerSystem)
 * - system/event-bus.js (EventBus)
 * - system/drawing/raster/raster-brush-core.js (RasterBrushCore) ← 🆕
 * 
 * 【子依存】
 * - core-engine.js (初期化元)
 * - core-runtime.js (API経由)
 * - system/drawing/fill-tool.js (canvas:pointerdown イベント購読)
 * - core-initializer.js (rasterBrushCore参照)
 * 
 * 【Phase 3.3 改修内容】
 * 🔧 StrokeRenderer → RasterBrushCore への切り替え
 * 🔧 setRasterBrushCore() メソッド追加
 * 🔧 strokeRenderer プロパティを rasterBrushCore に変更
 * ✅ Phase B-2 全機能継承（傾き伝達）
 * ============================================================
 */

class DrawingEngine {
    // ============================================================
    // コンストラクタ - システム初期化
    // ============================================================
    
    constructor(app, layerSystem, cameraSystem, history) {
        this.app = app;
        this.layerSystem = layerSystem;
        this.cameraSystem = cameraSystem;
        this.history = history;
        this.config = window.TEGAKI_CONFIG;

        this.brushCore = window.BrushCore;
        
        if (!this.brushCore) {
            console.error('❌ [DrawingEngine] window.BrushCore not initialized');
            throw new Error('[DrawingEngine] window.BrushCore not initialized. Check core-engine.js initialization order.');
        }

        // 🔧 Phase 3.3: ラスターブラシコア参照
        this.brushSettings = null;
        this.rasterBrushCore = window.rasterBrushCore || null;
        
        this.pointerDetach = null;
        this.coordSystem = window.CoordinateSystem;
        this.eventBus = window.TegakiEventBus || window.eventBus;
        this.activePointers = new Map();
        
        this._initializeCanvas();
    }

    // ============================================================
    // キャンバス初期化 - PointerEvent統合
    // ============================================================
    
    _initializeCanvas() {
        const canvas = this.app.canvas || this.app.view;
        if (!canvas) {
            console.error('❌ [DrawingEngine] Canvas not found');
            return;
        }

        canvas.style.touchAction = 'none';

        if (!window.PointerHandler) {
            console.error('❌ [DrawingEngine] window.PointerHandler not available!');
            return;
        }

        this.pointerDetach = window.PointerHandler.attach(canvas, {
            down: this._handlePointerDown.bind(this),
            move: this._handlePointerMove.bind(this),
            up: this._handlePointerUp.bind(this),
            cancel: this._handlePointerCancel.bind(this)
        }, {
            preventDefault: true
        });
    }

    // ============================================================
    // PointerEvent ハンドラ - 描画開始
    // Phase B-2: 傾き伝達実装（tiltX/tiltY/twist）
    // ============================================================
    
    _handlePointerDown(info, e) {
        // カメラ移動モード判定
        if (this.cameraSystem?.isCanvasMoveMode()) {
            return;
        }

        // Vキー押下時（レイヤー移動モード）
        if (this.layerSystem?.vKeyPressed) {
            return;
        }

        // 右クリック無視
        if (info.button === 2) {
            return;
        }

        // Screen→Local座標変換
        const localCoords = this._screenToLocal(info.clientX, info.clientY);
        if (!localCoords) {
            return;
        }

        // 塗りつぶしモード処理
        const currentMode = this.brushCore.getMode();
        
        if (currentMode === 'fill') {
            if (this.eventBus) {
                this.eventBus.emit('canvas:pointerdown', {
                    localX: localCoords.localX,
                    localY: localCoords.localY,
                    clientX: info.clientX,
                    clientY: info.clientY,
                    pressure: info.pressure,
                    pointerType: info.pointerType
                });
            }
            return;
        }

        // アクティブポインタ登録
        this.activePointers.set(info.pointerId, {
            type: info.pointerType || 'unknown',
            isDrawing: true
        });

        // Phase B-2: 傾きパラメータ追加
        if (this.brushCore && this.brushCore.startStroke) {
            this.brushCore.startStroke(
                info.clientX,
                info.clientY,
                info.pressure,
                info.tiltX !== undefined ? info.tiltX : 0,
                info.tiltY !== undefined ? info.tiltY : 0,
                info.twist !== undefined ? info.twist : 0
            );
        }
    }

    // ============================================================
    // PointerEvent ハンドラ - 描画更新
    // Phase B-2: 傾き伝達実装
    // ============================================================
    
    _handlePointerMove(info, e) {
        const pointerInfo = this.activePointers.get(info.pointerId);
        if (!pointerInfo || !pointerInfo.isDrawing) {
            return;
        }

        if (!this.brushCore || !this.brushCore.isActive || !this.brushCore.isActive()) {
            return;
        }

        // Phase B-2: 傾きパラメータ追加
        if (this.brushCore.updateStroke) {
            this.brushCore.updateStroke(
                info.clientX,
                info.clientY,
                info.pressure,
                info.tiltX !== undefined ? info.tiltX : 0,
                info.tiltY !== undefined ? info.tiltY : 0,
                info.twist !== undefined ? info.twist : 0
            );
        }
    }

    // ============================================================
    // PointerEvent ハンドラ - 描画終了
    // ============================================================
    
    _handlePointerUp(info, e) {
        const pointerInfo = this.activePointers.get(info.pointerId);
        if (!pointerInfo) {
            return;
        }

        if (this.brushCore && this.brushCore.isActive && this.brushCore.isActive()) {
            if (this.brushCore.finalizeStroke) {
                this.brushCore.finalizeStroke();
            }
        }

        this.activePointers.delete(info.pointerId);
    }

    // ============================================================
    // PointerEvent ハンドラ - キャンセル
    // ============================================================
    
    _handlePointerCancel(info, e) {
        const pointerInfo = this.activePointers.get(info.pointerId);
        if (!pointerInfo) {
            return;
        }

        if (this.brushCore && this.brushCore.cancelStroke) {
            this.brushCore.cancelStroke();
        }

        this.activePointers.delete(info.pointerId);
    }

    // ============================================================
    // 座標変換パイプライン: Screen → Canvas → World → Local
    // ============================================================
    
    /**
     * Screen座標をLocal座標に変換
     * CoordinateSystemを使用した単一責務実装
     */
    _screenToLocal(clientX, clientY) {
        if (!this.coordSystem) {
            return null;
        }

        const activeLayer = this.layerSystem.getActiveLayer();
        if (!activeLayer) {
            return null;
        }

        // Screen → Canvas
        const canvasCoords = this.coordSystem.screenClientToCanvas(clientX, clientY);
        if (!canvasCoords || canvasCoords.canvasX === undefined) {
            return null;
        }

        // Canvas → World
        const worldCoords = this.coordSystem.canvasToWorld(canvasCoords.canvasX, canvasCoords.canvasY);
        if (!worldCoords || worldCoords.worldX === undefined) {
            return null;
        }

        // World → Local
        const localCoords = this.coordSystem.worldToLocal(
            worldCoords.worldX,
            worldCoords.worldY,
            activeLayer
        );
        
        if (!localCoords || localCoords.localX === undefined || localCoords.localY === undefined) {
            return null;
        }

        if (isNaN(localCoords.localX) || isNaN(localCoords.localY)) {
            return null;
        }

        return {
            localX: localCoords.localX,
            localY: localCoords.localY
        };
    }

    // ============================================================
    // 設定メソッド - 外部システム統合
    // ============================================================
    
    /**
     * ブラシ設定を設定
     */
    setBrushSettings(settings) {
        this.brushSettings = settings;
    }

    /**
     * 🔧 Phase 3.3: RasterBrushCore設定メソッド追加
     */
    setRasterBrushCore(rasterBrushCore) {
        this.rasterBrushCore = rasterBrushCore;
        console.log('✅ [DrawingEngine] RasterBrushCore set successfully');
    }

    /**
     * 後方互換: setStrokeRenderer() は setRasterBrushCore() のエイリアス
     * @deprecated Phase 3.3で非推奨
     */
    setStrokeRenderer(renderer) {
        console.warn('⚠️ [DrawingEngine] setStrokeRenderer() is deprecated. Use setRasterBrushCore() instead.');
        this.setRasterBrushCore(renderer);
    }

    // ============================================================
    // Getter メソッド
    // ============================================================
    
    /**
     * 描画中判定
     */
    get isDrawing() {
        return this.brushCore && this.brushCore.isActive ? this.brushCore.isActive() : false;
    }

    // ============================================================
    // クリーンアップ
    // ============================================================
    
    destroy() {
        if (this.pointerDetach) {
            this.pointerDetach();
            this.pointerDetach = null;
        }
        this.activePointers.clear();
    }
}

// ============================================================
// グローバル登録
// ============================================================

window.DrawingEngine = DrawingEngine;

console.log('✅ drawing-engine.js Phase 3.3 loaded (ラスター対応版)');
console.log('   🔧 StrokeRenderer → RasterBrushCore 切り替え');
console.log('   🔧 setRasterBrushCore() メソッド追加');
console.log('   ✅ Phase B-2 全機能継承（傾き伝達）');