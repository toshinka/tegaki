/**
 * ファイル名: drawing-engine.js
 * DrawingEngine衛星 - PixiJS Application生成、描画フロー管理
 * 星型分離版 v8rev8 - 修正版
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
            
        } catch (error) {
            this.reportError('ENGINE_INIT_ERROR', 'Failed to initialize drawing engine', error);
            throw error;
        }
    }
    
    setupContainers() {
        this.containers.camera = new PIXI.Container();
        this.containers.world = new PIXI.Container();
        this.containers.ui = new PIXI.Container();
        
        // マスク設定
        const config = this.mainApi?.getConfig() || {};
        const maskGraphics = new PIXI.Graphics();
        maskGraphics.rect(0, 0, config.canvas?.width || 400, config.canvas?.height || 400);
        maskGraphics.fill(0x000000);
        
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
            
            // アクション送信（修正: typeを追加）
            this.mainApi?.dispatch('engine', {
                type: 'start-drawing',
                x: event.global.x,
                y: event.global.y,
                pressure: originalEvent.pressure || 1,
                pointerType: originalEvent.pointerType || 'mouse'
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
            
            // 座標情報を常に通知（修正: typeを追加）
            this.mainApi?.notify('engine', {
                type: 'coordinates-change',
                x: event.global.x,
                y: event.global.y
            });
            
            if (spacePressed) {
                return;
            }
            
            // ペン入力の圧力チェック
            if (originalEvent.pointerType === 'pen' && originalEvent.pressure === 0) {
                return;
            }
            
            // アクション送信（修正: typeを追加）
            this.mainApi?.dispatch('engine', {
                type: 'continue-drawing',
                x: event.global.x,
                y: event.global.y,
                pressure: originalEvent.pressure || 1,
                pointerType: originalEvent.pointerType || 'mouse'
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
                // アクション送信（修正: typeを追加）
                this.mainApi?.dispatch('engine', {
                    type: 'stop-drawing',
                    x: event.global.x,
                    y: event.global.y
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
            
            // 初期点を描画
            path.graphics.circle(x, y, size / 2);
            path.graphics.fill({ color: path.color, alpha: path.opacity });
            
            path.points.push({ x, y, size, timestamp: Date.now() });
            
            this.paths.push(path);
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
            
            // 補間描画
            const steps = Math.max(1, Math.ceil(distance / 1.5));
            for (let i = 1; i <= steps; i++) {
                const t = i / steps;
                const px = lastPoint.x + (x - lastPoint.x) * t;
                const py = lastPoint.y + (y - lastPoint.y) * t;
                
                path.graphics.circle(px, py, path.size / 2);
                path.graphics.fill({ color: path.color, alpha: path.opacity });
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
            
            // マスク更新
            if (this.containers.camera.mask) {
                this.containers.camera.mask.clear();
                this.containers.camera.mask.rect(0, 0, newWidth, newHeight);
                this.containers.camera.mask.fill(0x000000);
            }
            
            // ヒットエリア更新
            this.containers.camera.hitArea = new PIXI.Rectangle(0, 0, newWidth, newHeight);
            
            this.log(`Canvas resized to ${newWidth}x${newHeight}`);
            
            // リサイズ完了通知（修正: typeを追加）
            this.mainApi?.notify('engine', {
                type: 'canvas-change',
                width: newWidth,
                height: newHeight
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
            
            return dataURL;
            
        } catch (error) {
            this.reportError('SNAPSHOT_ERROR', 'Failed to take snapshot', error);
            return null;
        }
    }
    
    // パス統計情報
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
            console.log(`[DrawingEngine] ${message}`, ...args);
        }
    }
    
    reportError(code, message, error) {
        this.mainApi?.notify('engine', {
            type: 'error',
            code,
            message,
            error: error?.message || error,
            stack: error?.stack,
            timestamp: Date.now(),
            source: 'DrawingEngine'
        });
    }
    
    // Public API
    getApi() {
        return {
            createPath: (x, y, size, color, opacity) => this.createPath(x, y, size, color, opacity),
            extendPath: (path, x, y) => this.extendPath(path, x, y),
            resize: (width, height) => this.resize(width, height),
            clear: () => this.clear(),
            takeSnapshot: () => this.takeSnapshot(),
            getStats: () => this.getPathStats(),
            getContainers: () => this.containers,
            getApp: () => this.app
        };
    }
};