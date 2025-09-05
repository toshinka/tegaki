/**
 * drawing-engine.js - DrawingEngine 衛星
 * PixiJS Application生成、EngineBridge 提供
 */

window.MyApp = window.MyApp || {};

window.MyApp.DrawingEngine = class DrawingEngine {
    constructor() {
        this.mainController = null;
        this.app = null;
        this.containers = {
            camera: null,
            world: null,
            ui: null,
            mask: null
        };
        this.debug = false;
        this.initialized = false;
    }

    // 主星との接続
    async register(mainController) {
        this.mainController = mainController;
        this.debug = window.MyApp.config?.debug || false;
        
        try {
            await this.initialize();
            if (this.debug) console.log('[DrawingEngine] Registered with MainController');
            return true;
        } catch (error) {
            this.reportError('DRAWING_ENGINE_INIT_ERROR', 'Failed to initialize DrawingEngine', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    // 描画エンジン初期化
    async initialize() {
        if (this.initialized) return;

        try {
            // PixiJS アプリケーション作成
            this.app = new PIXI.Application();
            
            await this.app.init({
                width: window.MyApp.config.canvas.width,
                height: window.MyApp.config.canvas.height,
                background: 0xf0e0d6, // futaba-cream
                backgroundAlpha: 1,
                antialias: window.MyApp.config.rendering.antialias,
                resolution: window.MyApp.config.rendering.resolution,
                autoDensity: false
            });

            // キャンバスをDOMに追加
            const container = document.getElementById('drawing-canvas');
            if (!container) {
                throw new Error('Canvas container not found');
            }
            container.appendChild(this.app.canvas);

            // コンテナ階層構築
            this.setupContainers();
            
            // インタラクション設定
            this.setupInteraction();
            
            this.initialized = true;
            
        } catch (error) {
            this.reportError('PIXI_INITIALIZATION_FAILED', 'PixiJS initialization failed', {
                error: error.message,
                config: window.MyApp.config
            });
            throw error;
        }
    }

    // コンテナ階層構築
    setupContainers() {
        // カメラコンテナ（マスク・変形の基点）
        this.containers.camera = new PIXI.Container();
        
        // ワールドコンテナ（実際の描画内容）
        this.containers.world = new PIXI.Container();
        
        // UIコンテナ（マスクの影響を受けないUI要素）
        this.containers.ui = new PIXI.Container();
        
        // マスクグラフィック（キャンバス境界）
        this.containers.mask = new PIXI.Graphics();
        this.containers.mask.rect(0, 0, window.MyApp.config.canvas.width, window.MyApp.config.canvas.height);
        this.containers.mask.fill(0x000000);
        
        // 階層構築
        this.app.stage.addChild(this.containers.mask);
        this.containers.camera.mask = this.containers.mask;
        this.containers.camera.addChild(this.containers.world);
        
        this.app.stage.addChild(this.containers.camera);
        this.app.stage.addChild(this.containers.ui);
        
        // 初期位置設定
        this.containers.world.x = 0;
        this.containers.world.y = 0;
        this.containers.world.scale.set(1);
    }

    // インタラクション設定
    setupInteraction() {
        this.containers.camera.eventMode = "static";
        this.containers.camera.hitArea = new PIXI.Rectangle(
            0, 0, 
            window.MyApp.config.canvas.width, 
            window.MyApp.config.canvas.height
        );

        // ポインターイベント
        this.containers.camera.on('pointerdown', (e) => this.onPointerDown(e));
        this.containers.camera.on('pointermove', (e) => this.onPointerMove(e));
        this.containers.camera.on('pointerup', (e) => this.onPointerUp(e));
        this.containers.camera.on('pointerupoutside', (e) => this.onPointerUp(e));
        this.containers.camera.on('pointercancel', (e) => this.onPointerUp(e));
    }

    // ポインターダウンイベント
    onPointerDown(event) {
        if (!this.mainController) return;
        
        const spacePressed = this.mainController.spacePressed;
        const originalEvent = event.data.originalEvent;
        
        if (spacePressed) {
            // パンモード - PositionServiceに移譲
            event.stopPropagation();
        } else {
            // 描画モード - ペン圧力チェック
            if (originalEvent.pointerType === 'pen' && originalEvent.pressure === 0) {
                return; // ペンがキャンバスに触れていない
            }
            
            // ToolManagerに描画開始を通知
            this.mainController.notify({
                type: 'drawing_started',
                payload: {
                    event: 'drawing_started',
                    point: { x: event.global.x, y: event.global.y },
                    meta: {
                        pointerType: originalEvent.pointerType,
                        pressure: originalEvent.pressure
                    }
                }
            });
        }
    }

    // ポインタームーブイベント
    onPointerMove(event) {
        if (!this.mainController) return;
        
        const spacePressed = this.mainController.spacePressed;
        const originalEvent = event.data.originalEvent;
        
        if (spacePressed) {
            // パンモード - 座標更新のみ
            this.mainController.notify({
                type: 'ui_update',
                payload: {
                    type: 'coordinates',
                    data: { x: event.global.x, y: event.global.y }
                }
            });
        } else {
            // 描画モード
            if (originalEvent.pointerType === 'pen' && originalEvent.pressure === 0) {
                return; // ペンがキャンバスに触れていない
            }
            
            // ToolManagerに描画継続を通知
            this.mainController.notify({
                type: 'drawing_continued',
                payload: {
                    event: 'drawing_continued',
                    point: { x: event.global.x, y: event.global.y },
                    meta: {
                        pointerType: originalEvent.pointerType,
                        pressure: originalEvent.pressure
                    }
                }
            });
            
            // 座標更新
            this.mainController.notify({
                type: 'ui_update',
                payload: {
                    type: 'coordinates',
                    data: { x: event.global.x, y: event.global.y }
                }
            });
        }
    }

    // ポインターアップイベント
    onPointerUp(event) {
        if (!this.mainController) return;
        
        const spacePressed = this.mainController.spacePressed;
        
        if (!spacePressed) {
            // ToolManagerに描画終了を通知
            this.mainController.notify({
                type: 'drawing_ended',
                payload: {
                    event: 'drawing_ended',
                    point: { x: event.global.x, y: event.global.y },
                    meta: {}
                }
            });
        }
    }

    // 一時描画（ドラッグ中の描画）
    drawTemporaryStroke(layerId, points, color = 0x000000, width = 2, alpha = 1.0) {
        try {
            const layerService = this.mainController.getSatellite('LayerService');
            if (!layerService) {
                throw new Error('LayerService not available');
            }

            const layer = layerService.getLayer(layerId);
            if (!layer || !layer.tempGraphics) {
                throw new Error(`Layer ${layerId} or temp graphics not found`);
            }

            // 一時描画用グラフィックをクリア
            layer.tempGraphics.clear();
            
            if (points.length < 1) return;
            
            // 単一点の場合は円を描画
            if (points.length === 1) {
                layer.tempGraphics.circle(points[0].x, points[0].y, width / 2);
                layer.tempGraphics.fill({ color: color, alpha: alpha });
            } else {
                // 連続した点で滑らかな線を描画
                this.drawSmoothLine(layer.tempGraphics, points, width, color, alpha);
            }
            
        } catch (error) {
            this.reportError('TEMP_STROKE_ERROR', 'Failed to draw temporary stroke', {
                layerId, pointsCount: points?.length, error: error.message
            });
        }
    }

    // ストローク確定
    commitStroke(layerId, points, color = 0x000000, width = 2, alpha = 1.0) {
        try {
            const layerService = this.mainController.getSatellite('LayerService');
            if (!layerService) {
                throw new Error('LayerService not available');
            }

            const layer = layerService.getLayer(layerId);
            if (!layer) {
                throw new Error(`Layer ${layerId} not found`);
            }

            // 新しいストローク用グラフィック作成
            const strokeGraphics = new PIXI.Graphics();
            const strokeId = `stroke_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            if (points.length < 1) return null;
            
            // ストロークデータ作成
            const strokeData = {
                id: strokeId,
                layerId: layerId,
                points: [...points],
                color: color,
                width: width,
                alpha: alpha,
                timestamp: Date.now()
            };
            
            // グラフィック描画
            if (points.length === 1) {
                strokeGraphics.circle(points[0].x, points[0].y, width / 2);
                strokeGraphics.fill({ color: color, alpha: alpha });
            } else {
                this.drawSmoothLine(strokeGraphics, points, width, color, alpha);
            }
            
            // レイヤーサービスにストローク追加を通知
            layerService.addStroke(layerId, {
                ...strokeData,
                graphics: strokeGraphics
            });
            
            // 一時描画クリア
            if (layer.tempGraphics) {
                layer.tempGraphics.clear();
            }
            
            return strokeData;
            
        } catch (error) {
            this.reportError('COMMIT_STROKE_ERROR', 'Failed to commit stroke', {
                layerId, pointsCount: points?.length, error: error.message
            });
            return null;
        }
    }

    // 滑らかな線の描画
    drawSmoothLine(graphics, points, width, color, alpha) {
        if (points.length < 2) return;
        
        // 線の設定
        graphics.moveTo(points[0].x, points[0].y);
        
        // 点間の距離に基づいて補間点を生成
        for (let i = 1; i < points.length; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            const distance = Math.sqrt((curr.x - prev.x) ** 2 + (curr.y - prev.y) ** 2);
            
            if (distance < 1.5) continue;
            
            // 距離に応じて補間点を生成
            const steps = Math.max(1, Math.ceil(distance / 1.5));
            for (let j = 1; j <= steps; j++) {
                const t = j / steps;
                const x = prev.x + (curr.x - prev.x) * t;
                const y = prev.y + (curr.y - prev.y) * t;
                
                // 各点を円で描画（ベクターペン効果）
                graphics.circle(x, y, width / 2);
                graphics.fill({ color: color, alpha: alpha });
            }
        }
    }

    // レイヤークリア
    clearLayer(layerId) {
        try {
            const layerService = this.mainController.getSatellite('LayerService');
            if (!layerService) {
                throw new Error('LayerService not available');
            }
            
            layerService.clearLayer(layerId);
            
        } catch (error) {
            this.reportError('CLEAR_LAYER_ERROR', 'Failed to clear layer', {
                layerId, error: error.message
            });
        }
    }

    // レイヤースナップショット取得
    takeSnapshot(layerId) {
        try {
            const layerService = this.mainController.getSatellite('LayerService');
            if (!layerService) {
                throw new Error('LayerService not available');
            }
            
            const layer = layerService.getLayer(layerId);
            if (!layer) {
                throw new Error(`Layer ${layerId} not found`);
            }
            
            // レイヤーの現在の状態をキャプチャ
            const snapshot = {
                layerId: layerId,
                timestamp: Date.now(),
                strokes: layer.strokes.map(stroke => ({
                    id: stroke.id,
                    points: [...stroke.points],
                    color: stroke.color,
                    width: stroke.width,
                    alpha: stroke.alpha
                }))
            };
            
            return snapshot;
            
        } catch (error) {
            this.reportError('SNAPSHOT_ERROR', 'Failed to take layer snapshot', {
                layerId, error: error.message
            });
            return null;
        }
    }

    // キャンバスリサイズ
    resize(newWidth, newHeight) {
        try {
            // 設定更新
            window.MyApp.config.canvas.width = newWidth;
            window.MyApp.config.canvas.height = newHeight;
            
            // PixiJSレンダラーリサイズ
            this.app.renderer.resize(newWidth, newHeight);
            
            // マスク更新
            if (this.containers.mask) {
                this.containers.mask.clear();
                this.containers.mask.rect(0, 0, newWidth, newHeight);
                this.containers.mask.fill(0x000000);
            }
            
            // ヒットエリア更新
            if (this.containers.camera) {
                this.containers.camera.hitArea = new PIXI.Rectangle(0, 0, newWidth, newHeight);
            }
            
            if (this.debug) {
                console.log(`[DrawingEngine] Resized to ${newWidth}x${newHeight}`);
            }
            
        } catch (error) {
            this.reportError('RESIZE_ERROR', 'Failed to resize canvas', {
                newWidth, newHeight, error: error.message
            });
        }
    }

    // エラー報告ヘルパー
    reportError(code, message, context) {
        if (this.mainController) {
            this.mainController.notify({
                type: 'error',
                payload: { code, message, context }
            });
        } else {
            console.error(`[DrawingEngine] ${code}: ${message}`, context);
        }
    }

    // 描画エンジンの状態取得
    getState() {
        return {
            initialized: this.initialized,
            canvasSize: {
                width: window.MyApp.config.canvas.width,
                height: window.MyApp.config.canvas.height
            },
            containersReady: !!(this.containers.camera && this.containers.world && this.containers.ui)
        };
    }

    // 描画統計取得（デバッグ用）
    getStats() {
        if (!this.app) return null;
        
        return {
            fps: this.app.ticker.FPS,
            stage: {
                children: this.app.stage.children.length,
                width: this.app.stage.width,
                height: this.app.stage.height
            },
            renderer: {
                type: this.app.renderer.type,
                resolution: this.app.renderer.resolution
            }
        };
    }

    // 破棄処理
    destroy() {
        try {
            if (this.app) {
                this.app.destroy(true, true);
                this.app = null;
            }
            
            this.containers = {
                camera: null,
                world: null,
                ui: null,
                mask: null
            };
            
            this.initialized = false;
            
            if (this.debug) {
                console.log('[DrawingEngine] Destroyed');
            }
            
        } catch (error) {
            this.reportError('DESTROY_ERROR', 'Failed to destroy drawing engine', {
                error: error.message
            });
        }
    }
};