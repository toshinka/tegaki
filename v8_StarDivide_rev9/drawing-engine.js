/**
 * ==========================================================
 * @module DrawingEngine  
 * @role   PixiJS描画エンジン・EngineBridge提供・描画処理管理
 * @depends MainController (イベント経由)
 * @provides
 *   - getEngineBridge(): 描画用最小API提供
 *   - drawTemporaryStroke(layerId, strokePoints, style): 一時描画
 *   - commitStroke(layerId, strokeData): 描画確定
 *   - takeSnapshot(layerId): スナップショット取得
 * @notes
 *   - 衛星は主星(MainController)にのみ依存すること。
 *   - 直接的な描画はEngineBridge経由で行う。
 *   - consoleログは必要最低限に抑える。
 * ==========================================================
 */
window.MyApp = window.MyApp || {};
(function(){
    class DrawingEngine {
        constructor() {
            this.name = 'DrawingEngine';
            this.mainApi = null;
            this.app = null;
            this.containers = {
                world: null,
                ui: null
            };
            this._initialized = false;
            this._layers = {}; // layerId -> { container, graphicsList }
            this.engineBridge = null;
        }

        register(mainApi) {
            this.mainApi = mainApi;
            this._createPixiApp();
            return true;
        }

        _createPixiApp() {
            const container = document.getElementById('drawing-canvas');
            if(!container) {
                if(this.mainApi) {
                    this.mainApi.notify({
                        type: 'error.fatal',
                        payload: { code: 'NO_CANVAS_CONTAINER', msg: 'Canvas container not found' }
                    });
                }
                return;
            }

            try {
                this.app = new PIXI.Application({
                    width: 400,
                    height: 400,
                    backgroundColor: 0xf0e0d6,
                    backgroundAlpha: 1,
                    antialias: true,
                    resolution: 1
                });

                container.appendChild(this.app.view);
                this._setupContainers();
                this._createEngineBridge();
                this._initialized = true;

            } catch (error) {
                if(this.mainApi) {
                    this.mainApi.notify({
                        type: 'error.fatal',
                        payload: { code: 'PIXI_INIT_FAIL', msg: error.message }
                    });
                }
            }
        }

        _setupContainers() {
            this.containers.world = new PIXI.Container();
            this.containers.ui = new PIXI.Container();
            this.app.stage.addChild(this.containers.world);
            this.app.stage.addChild(this.containers.ui);
        }

        _createEngineBridge() {
            this.engineBridge = {
                app: this.app,
                drawTemporaryStroke: (layerId, strokePoints, style) => this._drawTempStroke(layerId, strokePoints, style),
                commitStroke: (layerId, strokeData) => this._commitStroke(layerId, strokeData),
                clearLayer: (layerId) => this._clearLayer(layerId),
                takeSnapshot: (layerId) => this._takeSnapshot(layerId)
            };

            // 安全に登録
            window.MyApp = window.MyApp || {};
            window.MyApp.DrawingEngine = DrawingEngine;
        }

        getEngineBridge() { 
            return this.engineBridge; 
        }

        ensureLayerContainer(layerId) {
            if(!this._layers[layerId]) {
                const container = new PIXI.Container();
                container.name = `layer-${layerId}`;
                this.containers.world.addChild(container);
                this._layers[layerId] = { 
                    container: container, 
                    graphicsList: [] 
                };
            }
            return this._layers[layerId].container;
        }

        _drawTempStroke(layerId, strokePoints, style = {}) {
            if(!this._initialized) return null;

            const container = this.ensureLayerContainer(layerId);
            const graphics = new PIXI.Graphics();

            const size = style.size || 4;
            const color = style.color ?? 0x800000;
            const alpha = style.alpha ?? 1;

            if(style.tool === 'eraser' && PIXI.BLEND_MODES.ERASE) {
                graphics.blendMode = PIXI.BLEND_MODES.ERASE;
            } else {
                graphics.blendMode = PIXI.BLEND_MODES.NORMAL;
            }

            if(strokePoints && strokePoints.length > 0) {
                graphics.moveTo(strokePoints[0].x, strokePoints[0].y);
                for(let i = 1; i < strokePoints.length; i++) {
                    graphics.lineTo(strokePoints[i].x, strokePoints[i].y);
                }
                graphics.stroke({ width: size, color: color, alpha: alpha });
            }

            container.addChild(graphics);
            this._layers[layerId].graphicsList.push(graphics);

            return graphics;
        }

        _commitStroke(layerId, strokeData) {
            if(!this._initialized) return false;

            const container = this.ensureLayerContainer(layerId);
            const graphics = new PIXI.Graphics();

            const style = strokeData.style || {};
            const size = style.size || 4;
            const color = style.color ?? 0x800000;
            const alpha = style.alpha ?? 1;

            if(style.tool === 'eraser' && PIXI.BLEND_MODES.ERASE) {
                graphics.blendMode = PIXI.BLEND_MODES.ERASE;
            } else {
                graphics.blendMode = PIXI.BLEND_MODES.NORMAL;
            }

            const points = strokeData.points || [];
            if(points.length > 0) {
                graphics.moveTo(points[0].x, points[0].y);
                for(let i = 1; i < points.length; i++) {
                    graphics.lineTo(points[i].x, points[i].y);
                }
                graphics.stroke({ width: size, color: color, alpha: alpha });
            }

            container.addChild(graphics);
            this._layers[layerId].graphicsList.push(graphics);

            return true;
        }

        _clearLayer(layerId) {
            const layerData = this._layers[layerId];
            if(layerData && layerData.container) {
                layerData.container.removeChildren();
                layerData.graphicsList = [];
            }
        }

        _takeSnapshot(layerId) {
            const layerData = this._layers[layerId];
            return { 
                layerId, 
                childCount: layerData && layerData.container ? layerData.container.children.length : 0, 
                timestamp: Date.now() 
            };
        }

        resize(width, height) {
            if(this.app && this._initialized) {
                try {
                    this.app.renderer.resize(width, height);
                    return true;
                } catch(error) {
                    if(this.mainApi) {
                        this.mainApi.notify({
                            type: 'error.recoverable',
                            payload: { code: 'RESIZE_FAIL', msg: error.message }
                        });
                    }
                    return false;
                }
            }
            return false;
        }

        destroy() {
            if(this.app) this.app.destroy(true);
            this.mainApi = null;
            this.app = null;
            this.containers = null;
            this._layers = {};
        }
    }

})();
