/**
 * CanvasManager - キャンバス描画制御システム
 * 
 * 責務:
 * - PIXI.Application管理
 * - 実際のGraphics描画処理
 * - ビュー操作（pan/zoom/resetView）
 * - Pointerイベント受け取り→ToolManagerへ転送
 * 
 * 依存: EventBus, StateManager, CoordinateManager
 * 公開: window.CanvasManager
 */

class CanvasManager {
    constructor() {
        this.app = null;
        this.stage = null;
        this.drawingLayer = null;
        this.backgroundLayer = null;
        
        this.container = null;
        this.isInitialized = false;
        
        // ビュー状態
        this.viewState = {
            zoom: 1.0,
            panX: 0,
            panY: 0,
            minZoom: 0.1,
            maxZoom: 5.0
        };
        
        // 描画設定
        this.drawingSettings = {
            antialias: true,
            backgroundColor: 0xffffff,
            resolution: window.devicePixelRatio || 1
        };
        
        // イベント参照
        this.eventBus = window.EventBus;
        this.stateManager = window.StateManager;
        this.coordinateManager = window.CoordinateManager;
        
        // PointerEvent処理用
        this.isPointerDown = false;
        this.activePointers = new Map();
    }

    /**
     * CanvasManagerを初期化
     * @param {HTMLElement} container - コンテナ要素
     * @param {object} options - 初期化オプション
     * @returns {boolean} 成功/失敗
     */
    initialize(container, options = {}) {
        try {
            if (this.isInitialized) {
                console.warn('[CanvasManager] Already initialized');
                return true;
            }

            this.container = container;
            
            // オプション適用
            this._applyOptions(options);
            
            // PIXI.Application作成
            this._createPixiApp();
            
            // レイヤー構築
            this._createLayers();
            
            // DOM追加
            container.appendChild(this.app.view);
            
            // CoordinateManagerにキャンバス要素を設定
            this.coordinateManager.setCanvasElement(this.app.view);
            
            // イベント設定
            this._setupEvents();
            
            // 状態初期化
            this._initializeState();
            
            this.isInitialized = true;
            console.log('[CanvasManager] Successfully initialized');
            
            this.eventBus?.emit('canvas:initialized', {
                width: this.app.screen.width,
                height: this.app.screen.height
            });
            
            return true;
        } catch (error) {
            window.ErrorManager?.handleError(error, 'CanvasManager.initialize', 'error', true);
            return false;
        }
    }

    /**
     * キャンバスをクリア
     */
    clear() {
        try {
            if (this.drawingLayer) {
                this.drawingLayer.clear();
                
                this.stateManager?.set('canvas.hasContent', false);
                this.stateManager?.set('canvas.isDirty', false);
                
                this.eventBus?.emit('canvas:cleared');
                console.log('[CanvasManager] Canvas cleared');
            }
        } catch (error) {
            window.ErrorManager?.handleError(error, 'CanvasManager.clear');
        }
    }

    /**
     * 線を描画
     * @param {Array} points - 座標配列 [{x, y, pressure?}, ...]
     * @param {object} style - 描画スタイル
     */
    drawLine(points, style = {}) {
        try {
            if (!this.drawingLayer || !points || points.length < 2) {
                return false;
            }

            const {
                color = 0x000000,
                width = 3,
                alpha = 1.0,
                cap = 'round',
                join = 'round'
            } = style;

            this.drawingLayer.lineStyle({
                width: width,
                color: color,
                alpha: alpha,
                cap: cap,
                join: join
            });

            // 開始点に移動
            this.drawingLayer.moveTo(points[0].x, points[0].y);

            // 線を描画
            for (let i = 1; i < points.length; i++) {
                this.drawingLayer.lineTo(points[i].x, points[i].y);
            }

            this._markCanvasAsDirty();
            
            this.eventBus?.emit('canvas:draw', {
                type: 'line',
                points: points.length,
                style
            });

            return true;
        } catch (error) {
            window.ErrorManager?.handleError(error, 'CanvasManager.drawLine');
            return false;
        }
    }

    /**
     * 点を描画
     * @param {object} point - 座標 {x, y, pressure?}
     * @param {object} style - 描画スタイル
     */
    drawPoint(point, style = {}) {
        try {
            if (!this.drawingLayer || !point) {
                return false;
            }

            const {
                color = 0x000000,
                size = 3,
                alpha = 1.0
            } = style;

            this.drawingLayer.beginFill(color, alpha);
            this.drawingLayer.drawCircle(point.x, point.y, size / 2);
            this.drawingLayer.endFill();

            this._markCanvasAsDirty();

            this.eventBus?.emit('canvas:draw', {
                type: 'point',
                point,
                style
            });

            return true;
        } catch (error) {
            window.ErrorManager?.handleError(error, 'CanvasManager.drawPoint');
            return false;
        }
    }

    /**
     * 消去処理
     * @param {Array} points - 消去座標配列
     * @param {number} size - 消しゴムサイズ
     */
    erase(points, size = 10) {
        try {
            if (!this.drawingLayer || !points || points.length === 0) {
                return false;
            }

            // 消去用のマスクを作成
            const eraseMask = new PIXI.Graphics();
            eraseMask.beginFill(0xffffff);
            
            for (const point of points) {
                eraseMask.drawCircle(point.x, point.y, size / 2);
            }
            
            eraseMask.endFill();

            // ブレンドモードで消去効果を適用
            eraseMask.blendMode = PIXI.BLEND_MODES.ERASE;
            this.drawingLayer.addChild(eraseMask);

            this._markCanvasAsDirty();

            this.eventBus?.emit('canvas:erase', {
                points: points.length,
                size
            });

            return true;
        } catch (error) {
            window.ErrorManager?.handleError(error, 'CanvasManager.erase');
            return false;
        }
    }

    /**
     * パン操作
     * @param {number} dx - X方向移動量
     * @param {number} dy - Y方向移動量
     */
    pan(dx, dy) {
        try {
            this.viewState.panX += dx;
            this.viewState.panY += dy;
            
            this.stage.x = this.viewState.panX;
            this.stage.y = this.viewState.panY;
            
            // CoordinateManagerに変換パラメーターを通知
            this.coordinateManager.setTransform(
                this.viewState.zoom,
                this.viewState.panX,
                this.viewState.panY
            );
            
            this._updateViewState();
            
            this.eventBus?.emit('canvas:pan', {
                dx, dy,
                panX: this.viewState.panX,
                panY: this.viewState.panY
            });
        } catch (error) {
            window.ErrorManager?.handleError(error, 'CanvasManager.pan');
        }
    }

    /**
     * ズーム操作
     * @param {number} scale - スケール値
     * @param {object} center - ズーム中心点 {x, y}（オプション）
     */
    setZoom(scale, center = null) {
        try {
            // ズーム制限
            const newZoom = Math.max(this.viewState.minZoom, Math.min(this.viewState.maxZoom, scale));
            
            if (center) {
                // 中心点を基準にズーム
                const oldZoom = this.viewState.zoom;
                const zoomRatio = newZoom / oldZoom;
                
                const centerX = center.x;
                const centerY = center.y;
                
                this.viewState.panX = centerX - (centerX - this.viewState.panX) * zoomRatio;
                this.viewState.panY = centerY - (centerY - this.viewState.panY) * zoomRatio;
                
                this.stage.x = this.viewState.panX;
                this.stage.y = this.viewState.panY;
            }
            
            this.viewState.zoom = newZoom;
            this.stage.scale.set(newZoom);
            
            // CoordinateManagerに変換パラメーターを通知
            this.coordinateManager.setTransform(
                this.viewState.zoom,
                this.viewState.panX,
                this.viewState.panY
            );
            
            this._updateViewState();
            
            this.eventBus?.emit('canvas:zoom', {
                zoom: newZoom,
                center
            });
        } catch (error) {
            window.ErrorManager?.handleError(error, 'CanvasManager.setZoom');
        }
    }

    /**
     * ビューをリセット
     */
    resetView() {
        try {
            this.viewState.zoom = 1.0;
            this.viewState.panX = 0;
            this.viewState.panY = 0;
            
            this.stage.scale.set(1.0);
            this.stage.x = 0;
            this.stage.y = 0;
            
            // CoordinateManagerに変換パラメーターを通知
            this.coordinateManager.setTransform(1.0, 0, 0);
            
            this._updateViewState();
            
            this.eventBus?.emit('canvas:reset');
            console.log('[CanvasManager] View reset to default');
        } catch (error) {
            window.ErrorManager?.handleError(error, 'CanvasManager.resetView');
        }
    }

    /**
     * PIXI.Applicationを取得
     * @returns {PIXI.Application|null}
     */
    getPixiApp() {
        return this.app;
    }

    /**
     * メインステージを取得
     * @returns {PIXI.Container|null}
     */
    getStage() {
        return this.stage;
    }

    /**
     * 描画レイヤーを取得
     * @returns {PIXI.Graphics|null}
     */
    getDrawingLayer() {
        return this.drawingLayer;
    }

    /**
     * 現在のビュー情報を取得
     * @returns {object} ビュー情報
     */
    getViewInfo() {
        return {
            zoom: this.viewState.zoom,
            panX: this.viewState.panX,
            panY: this.viewState.panY,
            canvasWidth: this.app?.screen.width || 0,
            canvasHeight: this.app?.screen.height || 0
        };
    }

    /**
     * リサイズ処理
     * @param {number} width - 新しい幅
     * @param {number} height - 新しい高さ
     */
    resize(width, height) {
        try {
            if (this.app) {
                this.app.renderer.resize(width, height);
                this.coordinateManager.setTransform(
                    this.viewState.zoom,
                    this.viewState.panX,
                    this.viewState.panY
                );
                
                this.eventBus?.emit('canvas:resize', { width, height });
                console.log(`[CanvasManager] Canvas resized to ${width}x${height}`);
            }
        } catch (error) {
            window.ErrorManager?.handleError(error, 'CanvasManager.resize');
        }
    }

    /**
     * PIXI.Applicationを作成
     * @private
     */
    _createPixiApp() {
        const config = window.ConfigManager?.getAll()?.canvas || {};
        
        this.app = new PIXI.Application({
            width: config.width || 1920,
            height: config.height || 1080,
            antialias: this.drawingSettings.antialias,
            backgroundColor: this.drawingSettings.backgroundColor,
            resolution: this.drawingSettings.resolution,
            autoDensity: true
        });

        this.stage = this.app.stage;
        console.log('[CanvasManager] PIXI.Application created');
    }

    /**
     * レイヤーを作成
     * @private
     */
    _createLayers() {
        // 背景レイヤー
        this.backgroundLayer = new PIXI.Graphics();
        this.backgroundLayer.name = 'background';
        this.stage.addChild(this.backgroundLayer);

        // 描画レイヤー
        this.drawingLayer = new PIXI.Graphics();
        this.drawingLayer.name = 'drawing';
        this.stage.addChild(this.drawingLayer);

        console.log('[CanvasManager] Layers created');
    }

    /**
     * イベントを設定
     * @private
     */
    _setupEvents() {
        const canvas = this.app.view;
        
        // Pointerイベント
        canvas.addEventListener('pointerdown', this._handlePointerDown.bind(this));
        canvas.addEventListener('pointermove', this._handlePointerMove.bind(this));
        canvas.addEventListener('pointerup', this._handlePointerUp.bind(this));
        canvas.addEventListener('pointercancel', this._handlePointerCancel.bind(this));

        // Wheelイベント（ズーム用）
        canvas.addEventListener('wheel', this._handleWheel.bind(this));

        // コンテキストメニューを無効化
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        console.log('[CanvasManager] Events setup complete');
    }

    /**
     * オプションを適用
     * @private
     */
    _applyOptions(options) {
        if (options.backgroundColor !== undefined) {
            this.drawingSettings.backgroundColor = options.backgroundColor;
        }
        if (options.antialias !== undefined) {
            this.drawingSettings.antialias = options.antialias;
        }
        if (options.resolution !== undefined) {
            this.drawingSettings.resolution = options.resolution;
        }
    }

    /**
     * 状態を初期化
     * @private
     */
    _initializeState() {
        this.stateManager?.set('canvas.zoom', this.viewState.zoom, false);
        this.stateManager?.set('canvas.panX', this.viewState.panX, false);
        this.stateManager?.set('canvas.panY', this.viewState.panY, false);
        this.stateManager?.set('canvas.hasContent', false, false);
        this.stateManager?.set('canvas.isDirty', false, false);
    }

    /**
     * ビュー状態を更新
     * @private
     */
    _updateViewState() {
        this.stateManager?.set('canvas.zoom', this.viewState.zoom);
        this.stateManager?.set('canvas.panX', this.viewState.panX);
        this.stateManager?.set('canvas.panY', this.viewState.panY);
    }

    /**
     * キャンバスを汚れた状態にマーク
     * @private
     */
    _markCanvasAsDirty() {
        this.stateManager?.set('canvas.hasContent', true);
        this.stateManager?.set('canvas.isDirty', true);
    }

    /**
     * PointerDownイベント処理
     * @private
     */
    _handlePointerDown(event) {
        try {
            const pointerInfo = this.coordinateManager.extractPointerInfo(event);
            
            this.isPointerDown = true;
            this.activePointers.set(event.pointerId, pointerInfo);
            
            this.stateManager?.set('interaction.pointerDown', true);
            this.stateManager?.set('interaction.pointerType', event.pointerType);
            
            // ToolManagerに転送
            this.eventBus?.emit('canvas:pointerdown', pointerInfo);
        } catch (error) {
            window.ErrorManager?.handleError(error, 'CanvasManager._handlePointerDown');
        }
    }

    /**
     * PointerMoveイベント処理
     * @private
     */
    _handlePointerMove(event) {
        try {
            const pointerInfo = this.coordinateManager.extractPointerInfo(event);
            
            if (this.activePointers.has(event.pointerId)) {
                this.activePointers.set(event.pointerId, pointerInfo);
            }
            
            // ToolManagerに転送
            this.eventBus?.emit('canvas:pointermove', pointerInfo);
        } catch (error) {
            window.ErrorManager?.handleError(error, 'CanvasManager._handlePointerMove');
        }
    }

    /**
     * PointerUpイベント処理
     * @private
     */
    _handlePointerUp(event) {
        try {
            const pointerInfo = this.coordinateManager.extractPointerInfo(event);
            
            this.isPointerDown = false;
            this.activePointers.delete(event.pointerId);
            
            this.stateManager?.set('interaction.pointerDown', false);
            
            // ToolManagerに転送
            this.eventBus?.emit('canvas:pointerup', pointerInfo);
        } catch (error) {
            window.ErrorManager?.handleError(error, 'CanvasManager._handlePointerUp');
        }
    }

    /**
     * PointerCancelイベント処理
     * @private
     */
    _handlePointerCancel(event) {
        try {
            this.isPointerDown = false;
            this.activePointers.delete(event.pointerId);
            
            this.stateManager?.set('interaction.pointerDown', false);
            
            this.eventBus?.emit('canvas:pointercancel', {
                pointerId: event.pointerId
            });
        } catch (error) {
            window.ErrorManager?.handleError(error, 'CanvasManager._handlePointerCancel');
        }
    }

    /**
     * Wheelイベント処理（ズーム）
     * @private
     */
    _handleWheel(event) {
        try {
            event.preventDefault();
            
            const zoomSpeed = window.ConfigManager?.get('interaction.zoomSpeed', 0.1);
            const delta = event.deltaY > 0 ? -zoomSpeed : zoomSpeed;
            const newZoom = this.viewState.zoom * (1 + delta);
            
            const center = {
                x: event.clientX,
                y: event.clientY
            };
            
            this.setZoom(newZoom, center);
        } catch (error) {
            window.ErrorManager?.handleError(error, 'CanvasManager._handleWheel');
        }
    }
}

// グローバルインスタンスを作成・公開
window.CanvasManager = new CanvasManager();

console.log('[CanvasManager] Initialized and registered to window.CanvasManager');