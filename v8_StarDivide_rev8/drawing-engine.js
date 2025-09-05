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
(function(global){
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
            this._isPanning = false;
            this._lastPan = null;
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
                // PixiJS v8に対応した初期化
                this.app = new PIXI.Application();
                this.app.init({
                    width: 400,
                    height: 400,
                    backgroundColor: 0xf0e0d6,
                    backgroundAlpha: 1,
                    antialias: true,
                    resolution: 1
                }).then(() => {
                    container.appendChild(this.app.canvas);
                    this._setupContainers();
                    this._createEngineBridge();
                    this._setupCanvasHandlers();
                    this._initialized = true;
                });

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

        _setupCanvasHandlers() {
            // ensure canvas receives pointer events and no default touch action
            this.app.canvas.style.touchAction = 'none';

            // helper: screen -> local canvas coords
            const getCanvasPos = (e) => {
                const rect = this.app.canvas.getBoundingClientRect();
                return { x: e.clientX - rect.left, y: e.clientY - rect.top };
            };

            // pointerdown
            this.app.canvas.addEventListener('pointerdown', (e) => {
                const pos = getCanvasPos(e);
                // if main says space pressed -> start panning
                const spaceState = this.mainApi && this.mainApi.getAppState ? this.mainApi.getAppState().spacePressed : false;
                if(spaceState) {
                    this._isPanning = true;
                    this._lastPan = { x: e.clientX, y: e.clientY };
                    this.app.canvas.setPointerCapture(e.pointerId);
                    return;
                }
                // otherwise forward to main as pointer.down
                if(this.mainApi && this.mainApi.notify) {
                    this.mainApi.notify({ 
                        type: 'pointer.down', 
                        payload: { 
                            x: pos.x, 
                            y: pos.y, 
                            pointerType: e.pointerType, 
                            pressure: e.pressure || 0.5 
                        } 
                    });
                }
            });

            // pointermove
            this.app.canvas.addEventListener('pointermove', (e) => {
                const pos = getCanvasPos(e);
                if(this._isPanning && this._lastPan) {
                    const dx = e.clientX - this._lastPan.x;
                    const dy = e.clientY - this._lastPan.y;
                    // move world container (UI container stays fixed)