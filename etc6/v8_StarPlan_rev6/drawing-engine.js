/**
 * ファイル名: drawing-engine.js
 * @provides DrawingEngine, PIXI描画機能, 座標系管理
 * @requires PIXI.js, MainController API
 * DrawingEngine衛星 - PixiJS Application生成、描画フロー管理
 * 星型分離版 v8rev8 - 修正版（type付きイベント徹底対応・軽量化）
 */

window.DrawingEngine = class DrawingEngine {
    constructor() {
        this.app = null;
        this.containers = { camera: null, world: null, ui: null };
        this.paths = [];
        this.mainApi = null;
        this.initialized = false;
    }
    
    async register(mainApi) {
        this.mainApi = mainApi;
    }
    
    async initialize() {
        try {
            const config = this.mainApi?.getConfig() || {};
            
            this.app = new PIXI.Application();
            await this.app.init({
                width: config.canvas?.width || 400,
                height: config.canvas?.height || 400,
                background: 0xf0e0d6,
                backgroundAlpha: 1,
                antialias: config.rendering?.antialias || true,
                resolution: config.rendering?.resolution || 1,
                autoDensity: false
            });
            
            const container = document.getElementById('drawing-canvas');
            if (!container) {
                throw new Error('Drawing canvas container not found');
            }
            
            container.appendChild(this.app.canvas);
            
            this.setupContainers();
            this.setupInteraction();
            
            this.initialized = true;
            this.log('DrawingEngine initialized successfully');
            
            // 初期化完了通知（修正: typeを必ず追加）
            this.mainApi?.notify({
                type: 'drawing-engine-initialized',
                canvasSize: { 
                    width: config.canvas?.width || 400, 
                    height: config.canvas?.height || 400 
                },
                timestamp: Date.now()
            });
            
        } catch (error) {
            this.reportError('ENGINE_INIT_ERROR', 'Failed to initialize drawing engine', error);
            throw error;
        }
    }
    
    setupContainers() {
        this.containers.camera = new PIXI.Container();
        this.containers.world = new PIXI.Container();
        this.containers.ui = new PIXI.Container();
        
        // マスク設定（修正: beginFill/drawRect/endFillに変更）
        const config = this.mainApi?.getConfig() || {};
        const maskGraphics = new PIXI.Graphics();
        maskGraphics.beginFill(0x000000, 1);
        maskGraphics.drawRect(0, 0, config.canvas?.width || 400, config.canvas?.height || 400);
        maskGraphics.endFill();
        
        this.app.stage.addChild(maskGraphics);
        this.containers.camera.mask = maskGraphics;
        
        this.containers.camera.addChild(this.containers.world);
        this.app.stage.addChild(this.containers.camera);
        this.app.stage.addChild(this.containers.ui);
        
        // 初期位置設定
        this.containers.world.x = 0;
        this.containers.world.y = 0;
        this.containers.world.scale.set(1);
        
        this.log('Containers setup completed');
    }
    
    setupInteraction() {
        this.containers.camera.eventMode = "static";
        
        const config = this.mainApi?.getConfig() || {};
        this.containers.camera.hitArea = new PIXI.Rectangle(
            0, 0, 
            config.canvas?.width || 400, 
            config.canvas?.height || 400
        );
        
        // イベントリスナー設定
        this.containers.camera.on('pointerdown', (e) => this.onPointerDown(e));
        this.containers.camera.on('pointermove', (e) => this.onPointerMove(e));
        this.containers.camera.on('pointerup', (e) => this.onPointerUp(e));
        this.containers.camera.on('pointerupoutside', (e) => this.onPointerUp(e));
        this.containers.camera.on('pointercancel', (e) => this.onPointerUp(e));
        
        this.log('Interaction setup completed');
    }
    
    onPointerDown(event) {
        try {
            // MainController への参照修正
            const spacePressed = window.futabaApp?.getSpacePressed?.() || false;
            const originalEvent = event.data.originalEvent;
            
            if (spacePressed) {
                event.stopPropagation();
                return;
            }
            
            // ペン入力の圧力チェック
            if (originalEvent.pointerType === 'pen' && originalEvent.pressure === 0) {
                return;
            }
            
            // アクション送信（修正: typeを必ず追加）
            this.mainApi?.dispatch({
                type: 'start-drawing',
                x: event.global.x,
                y: event.global.y,
                pressure: originalEvent.pressure || 1,
                pointerType: originalEvent.pointerType || 'mouse',
                timestamp: Date.now()
            });
            
        } catch (error) {
            this.reportError('POINTER_DOWN_ERROR', 'Pointer down handling failed', error);
        }
    }
    
    onPointerMove(event) {
        try {
            // MainController への参照修正
            const spacePressed = window.futabaApp?.getSpacePressed?.() || false;
            const originalEvent = event.data.originalEvent;
            
            // 座標情報を常に通知（修正: typeを必ず追加）
            this.mainApi?.notify({
                type: 'coordinates-changed',
                x: event.global.x,
                y: event.global.y,
                timestamp: Date.now()
            });
            
            if (spacePressed) {
                return;
            }
            
            // ペン入力の圧力チェック
            if (originalEvent.pointerType === 'pen' && originalEvent.pressure === 0) {
                return;
            }
            
            // アクション送信（修正: typeを必ず追加）
            this.mainApi?.dispatch({
                type: 'continue-drawing',
                x: event.global.x,
                y: event.global.y,
                pressure: originalEvent.pressure || 1,
                pointerType: originalEvent.pointerType || 'mouse',
                timestamp: Date.now()
            });
            
        } catch (error) {
            this.reportError('POINTER_MOVE_ERROR', 'Pointer move handling failed', error);
        }
    }
    
    onPointerUp(event) {
        try {
            // MainController への参照修正
            const spacePressed = window.futabaApp?.getSpacePressed?.() || false;
            
            if (!spacePressed) {
                // アクション送信（修正: typeを必ず追加）
                this.mainApi?.dispatch({
                    type: 'stop-drawing',
                    x: event.global.x,
                    y: event.global.y,
                    timestamp: Date.now()
                });
            }
            
        } catch (error) {
            this.reportError('POINTER_UP_ERROR', 'Pointer up handling failed', error);
        }
    }
    
    // 描画メソッド
    createPath(x, y, size, color, opacity) {
        try {
            const path = {
                id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                graphics: new PIXI.Graphics(),
                points: [],
                color, size, opacity,
                isComplete: false,
                timestamp: Date.now()
            };
            
            // 初期点を描画（修正: beginFill/drawCircle/endFillに変更）
            path.graphics.beginFill(path.color, path.opacity);
            path.graphics.drawCircle(x, y, size / 2);
            path.graphics.endFill();
            
            path.points.push({ x, y, size, timestamp: Date.now() });
            
            this.paths.push(path);
            
            // パス作成通知（修正: typeを必ず追加、軽量化）
            this.mainApi?.notify({
                type: 'path-created',
                pathId: path.id,
                startPoint: { x, y },
                settings: { size, color, opacity },
                timestamp: path.timestamp
            });
            
            this.log(`Created path: ${path.id}`);
            
            return path;
            
        } catch (error) {
            this.reportError('CREATE_PATH_ERROR', 'Failed to create path', error);
            return null;
        }
    }
    
    extendPath(path, x, y) {
        if (!path || path.points.length === 0) return;
        
        try {
            const lastPoint = path.points[path.points.length - 1];
            const distance = Math.sqrt((x - lastPoint.x) ** 2 + (y - lastPoint.y) ** 2);
            
            // 最小距離チェック
            if (distance < 1.5) return;
            
            // 補間描画（修正: beginFill/drawCircle/endFillに変更）
            const steps = Math.max(1, Math.ceil(distance / 1.5));
            for (let i = 1; i <= steps; i++) {
                const t = i / steps;
                const px = lastPoint.x + (x - lastPoint.x) * t;
                const py = lastPoint.y + (y - lastPoint.y) * t;
                
                path.graphics.beginFill(path.color, path.opacity);
                path.graphics.drawCircle(px, py, path.size / 2);
                path.graphics.endFill();
            }
            
            path.points.push({ x, y, size: path.size, timestamp: Date.now() });
            
        } catch (error) {
            this.reportError('EXTEND_PATH_ERROR', 'Failed to extend path', error);
        }
    }
    
    // キャンバスリサイズ
    resize(newWidth, newHeight) {
        try {
            const config = this.mainApi?.getConfig();
            if (config) {
                config.canvas.width = newWidth;
                config.canvas.height = newHeight;
            }
            
            this.app.renderer.resize(newWidth, newHeight);
            
            // マスク更新（修正: beginFill/drawRect/endFillに変更）
            if (this.containers.camera.mask) {
                this.containers.camera.mask.clear();
                this.containers.camera.mask.beginFill(0x000000, 1);
                this.containers.camera.mask.drawRect(0, 0, newWidth, newHeight);
                this.containers.camera.mask.endFill();
            }
            
            // ヒットエリア更新
            this.containers.camera.hitArea = new PIXI.Rectangle(0, 0, newWidth, newHeight);
            
            this.log(`Canvas resized to ${newWidth}x${newHeight}`);
            
            // リサイズ完了通知（修正: typeを必ず追加）
            this.mainApi?.notify({
                type: 'canvas-resized',
                width: newWidth,
                height: newHeight,
                timestamp: Date.now()
            });
            
        } catch (error) {
            this.reportError('RESIZE_ERROR', 'Canvas resize failed', error);
        }
    }
    
    // クリア
    clear() {
        try {
            this.paths.forEach(path => {
                if (path.graphics && path.graphics.destroy) {
                    path.graphics.destroy();
                }
            });
            
            this.paths = [];
            
            // キャンバスクリア通知（修正: typeを必ず追加）
            this.mainApi?.notify({
                type: 'canvas-cleared',
                timestamp: Date.now()
            });
            
            this.log('Canvas cleared');
            
        } catch (error) {
            this.reportError('CLEAR_ERROR', 'Canvas clear failed', error);
        }
    }
    
    // スナップショット取得
    takeSnapshot() {
        try {
            const renderTexture = PIXI.RenderTexture.create({
                width: this.app.screen.width,
                height: this.app.screen.height
            });
            
            this.app.renderer.render(this.containers.world, { renderTexture });
            
            const canvas = this.app.renderer.extract.canvas(renderTexture);
            const dataURL = canvas.toDataURL('image/png');
            
            renderTexture.destroy();
            
            // スナップショット取得通知（修正: typeを必ず追加、dataURLは含めない）
            this.mainApi?.notify({
                type: 'snapshot-taken',
                size: dataURL.length,
                timestamp: Date.now()
            });
            
            return dataURL;
            
        } catch (error) {
            this.reportError('SNAPSHOT_ERROR', 'Failed to take snapshot', error);
            return null;
        }
    }
    
    // パス統計情報（軽量化）
    getPathStats() {
        const totalPaths = this.paths.length;
        const completePaths = this.paths.filter(p => p.isComplete).length;
        const totalPoints = this.paths.reduce((sum, p) => sum + p.points.length, 0);
        
        return {
            totalPaths,
            completePaths,
            incompletePaths: totalPaths - completePaths,
            totalPoints,
            avgPointsPerPath: totalPaths > 0 ? Math.round(totalPoints / totalPaths) : 0
        };
    }
    
    // ユーティリティメソッド
    log(message, ...args) {
        const config = this.mainApi?.getConfig();
        if (config?.debug) {
            // 軽量化：PIXIオブジェクトを直接ログに出力しない
            const logArgs = args.map(arg => {
                if (arg && typeof arg === 'object' && arg.constructor && arg.constructor.name) {
                    // PIXIオブジェクトの場合は軽量化
                    if (arg.constructor.name.startsWith('PIXI') || arg.constructor.name === 'Container' || arg.constructor.name === 'Graphics') {
                        return `[${arg.constructor.name}]`;
                    }
                }
                return arg;
            });
            console.log(`[DrawingEngine] ${message}`, ...logArgs);
        }
    }
    
    reportError(code, message, error) {
        // 修正: typeを必ず追加
        this.mainApi?.notify({
            type: 'error',
            code,
            message,
            error: error?.message || error,
            stack: error?.stack,
            timestamp: Date.now(),
            source: 'DrawingEngine'
        });
    }
    
    // Public API（軽量化、循環参照回避）
    getApi() {
        return {
            createPath: (x, y, size, color, opacity) => this.createPath(x, y, size, color, opacity),
            extendPath: (path, x, y) => this.extendPath(path, x, y),
            resize: (width, height) => this.resize(width, height),
            clear: () => this.clear(),
            takeSnapshot: () => this.takeSnapshot(),
            getStats: () => this.getPathStats(),
            getContainers: () => {
                // 直接のPIXIオブジェクトではなく、軽量化された情報を返す
                return {
                    camera: this.containers.camera,
                    world: this.containers.world,
                    ui: this.containers.ui,
                    // 統計情報も含める
                    containerInfo: {
                        cameraChildren: this.containers.camera?.children?.length || 0,
                        worldChildren: this.containers.world?.children?.length || 0,
                        uiChildren: this.containers.ui?.children?.length || 0
                    }
                };
            },
            getApp: () => this.app,
            // 追加：軽量化された情報取得メソッド
            getCanvasInfo: () => ({
                width: this.app?.screen?.width || 0,
                height: this.app?.screen?.height || 0,
                initialized: this.initialized,
                pathCount: this.paths.length
            })
        };
    }
};