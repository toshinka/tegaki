/**
 * @module   EnginePosition
 * @role     描画エンジン + 座標管理
 * @depends  MainController
 * @provides init(canvas), drawStroke(stroke), worldToScreen(point), screenToWorld(point), setCamera(x,y), createLayer(name)
 * @notes    Camera/World/Screen座標系を厳格に区別、循環参照禁止、cameraContainer方式でCamera反映
 * @flow     Stroke登録→World→Screen→Pixi描画→MainController通知、createLayer→cameraContainer追加
 * @memory   Camera位置、World座標履歴、描画ストローク履歴、LayerごとのContainer
 * @revision カメラコンテナ方式統合 - stage.position廃止、cameraContainer.position使用、レイヤー統合
 */

const EnginePosition = (() => {
    let app = null;
    let containers = { 
        camera: null,      // カメラコンテナ - 改修案の中核
        world: null, 
        ui: null 
    };
    let camera = { x: 0, y: 0, targetX: 0, targetY: 0 };
    let strokes = [];
    let canvasContainer = null;
    let currentDrawingPath = null;
    
    // Layer Container Management - 改修案対応（重要な修正点）
    const layerContainers = {}; // layerId -> PIXI.Container
    let activeLayerId = null;
    
    // Coordinate System Management - 座標系統一
    function worldToScreen(point) {
        return { 
            x: point.x - camera.x, 
            y: point.y - camera.y 
        };
    }
    
    function screenToWorld(point) {
        return { 
            x: point.x + camera.x, 
            y: point.y + camera.y 
        };
    }
    
    /**
     * Camera座標設定 - cameraContainer方式（改修案の重要な修正点）
     * stage.position ではなく cameraContainer.position を使用
     */
    function setCamera(x, y) {
        camera.targetX = x;
        camera.targetY = y;
        camera.x = Math.round(x);
        camera.y = Math.round(y);
        
        // cameraContainer方式でCamera反映（改修案対応）
        if (containers.camera) {
            containers.camera.x = -camera.x;
            containers.camera.y = -camera.y;
        }
        
        updateCameraDisplay();
        
        // 循環参照なしで通知
        window.MainController?.safeNotify('camera-moved', { 
            camera: { x: camera.x, y: camera.y } 
        });
    }
    
    /**
     * カメラ情報取得（MainControllerからアクセス用）
     */
    function getCamera() {
        return { x: camera.x, y: camera.y };
    }
    
    /**
     * レイヤー作成（改修案対応 - 必ずcameraContainerに追加）
     */
    function createLayer(layerName) {
        const layerId = Date.now() + Math.random(); // 安定ID生成
        
        if (!containers.camera) {
            console.error('[EnginePosition] cameraContainer not initialized');
            return null;
        }
        
        // レイヤーContainerを作成してcameraContainerに追加（改修案の重要な修正点）
        const layerContainer = new PIXI.Container();
        layerContainer.name = layerName || `Layer_${layerId}`;
        
        // cameraContainerに追加することでカメラ移動に追従
        containers.camera.addChild(layerContainer);
        layerContainers[layerId] = layerContainer;
        
        console.log(`[EnginePosition] Layer created and added to cameraContainer: ${layerName} (ID: ${layerId})`);
        
        // 循環参照なしで通知
        window.MainController?.safeNotify('layer-created', { 
            layerId: layerId,
            name: layerName || `Layer_${layerId}`,
            visible: true
        });
        
        return layerId;
    }
    
    /**
     * アクティブレイヤー設定（改修案対応）
     */
    function setActiveLayer(layerId) {
        if (layerContainers[layerId]) {
            activeLayerId = layerId;
            console.log(`[EnginePosition] Active layer set: ${layerId}`);
        } else {
            console.warn(`[EnginePosition] Layer not found: ${layerId}`);
        }
    }
    
    /**
     * アクティブレイヤー取得
     */
    function getActiveLayer() {
        return activeLayerId;
    }
    
    /**
     * レイヤーの表示/非表示切替
     */
    function setLayerVisibility(layerId, visible) {
        if (layerContainers[layerId]) {
            layerContainers[layerId].visible = visible;
            console.log(`[EnginePosition] Layer visibility: ${layerId} = ${visible}`);
        }
    }
    
    function updateCameraDisplay() {
        if (canvasContainer) {
            const viewportCenter = {
                x: (window.innerWidth - 310) / 2,
                y: window.innerHeight / 2
            };
            
            const offset = {
                x: viewportCenter.x,  // DOM要素のカメラ移動は別途調整
                y: viewportCenter.y
            };
            
            canvasContainer.style.transform = 
                `translate3d(${offset.x}px, ${offset.y}px, 0) translate(-50%, -50%)`;
            canvasContainer.style.left = '0px';
            canvasContainer.style.top = '0px';
        }
        
        updateStatusDisplay();
    }
    
    function resetCamera() {
        camera = { x: 0, y: 0, targetX: 0, targetY: 0 };
        
        // cameraContainer リセット（改修案対応）
        if (containers.camera) {
            containers.camera.x = 0;
            containers.camera.y = 0;
        }
        
        if (canvasContainer) {
            canvasContainer.style.transform = 'translate(-50%, -50%)';
            canvasContainer.style.left = '50%';
            canvasContainer.style.top = '50%';
        }
        
        updateStatusDisplay();
        window.MainController?.safeNotify('camera-reset', {});
    }
    
    // Drawing Engine
    async function init(canvasElement) {
        try {
            canvasContainer = document.getElementById('canvas-container');
            
            app = new PIXI.Application();
            await app.init({
                width: APP_CONFIG.canvas.width,
                height: APP_CONFIG.canvas.height,
                background: 0xf0e0d6,
                backgroundAlpha: 1,
                antialias: APP_CONFIG.rendering.antialias,
                resolution: APP_CONFIG.rendering.resolution,
                autoDensity: false
            });
            
            canvasElement.appendChild(app.canvas);
            
            setupContainers();
            
            // デフォルトレイヤー作成（改修案対応）
            const defaultLayerId = createLayer('背景');
            setActiveLayer(defaultLayerId);
            
            console.log('[EnginePosition] Initialized with cameraContainer system');
            return true;
            
        } catch (error) {
            console.error('[EnginePosition] Initialization failed:', error);
            window.MainController?.safeNotify('error-occurred', { 
                source: 'EnginePosition', 
                error: error.message 
            });
            return false;
        }
    }
    
    /**
     * Container構造設定（改修案対応 - cameraContainer中心）
     */
    function setupContainers() {
        // cameraContainer が中核（改修案の重要な修正点）
        containers.camera = new PIXI.Container();
        containers.world = new PIXI.Container();
        containers.ui = new PIXI.Container();
        
        // Create mask for canvas area
        const maskGraphics = new PIXI.Graphics();
        maskGraphics.rect(0, 0, APP_CONFIG.canvas.width, APP_CONFIG.canvas.height);
        maskGraphics.fill(0x000000);
        app.stage.addChild(maskGraphics);
        
        // cameraContainer階層構造（改修案対応）
        containers.camera.addChild(containers.world);
        containers.camera.mask = maskGraphics;
        
        // stageに追加
        app.stage.addChild(containers.camera);
        app.stage.addChild(containers.ui);
        
        containers.world.x = 0;
        containers.world.y = 0;
        containers.world.scale.set(1);
        
        console.log('[EnginePosition] cameraContainer system setup complete');
    }
    
    // Drawing Operations - アクティブレイヤー対応（改修案対応）
    function drawStroke(stroke) {
        if (!stroke || !activeLayerId) return;
        
        strokes.push(stroke);
        
        // アクティブレイヤーContainer取得
        const layerContainer = layerContainers[activeLayerId];
        if (!layerContainer) {
            console.error(`[EnginePosition] Active layer container not found: ${activeLayerId}`);
            return;
        }
        
        // World座標で描画（Screen座標変換不要 - cameraContainerが自動処理）
        const g = new PIXI.Graphics();
        g.lineStyle(stroke.size || 2, stroke.color || 0x000000, stroke.opacity || 1.0);
        
        if (stroke.points && stroke.points.length > 0) {
            g.moveTo(stroke.points[0].x, stroke.points[0].y);
            for (let i = 1; i < stroke.points.length; i++) {
                g.lineTo(stroke.points[i].x, stroke.points[i].y);
            }
        }
        
        // アクティブレイヤーに描画（改修案の重要な修正点）
        layerContainer.addChild(g);
        
        // 循環参照なしで通知
        window.MainController?.safeNotify('stroke-drawn', { 
            layerId: activeLayerId, 
            strokeId: stroke.id || 'unknown',
            pointsCount: stroke.points?.length || 0
        });
    }
    
    function createPath(x, y, size, color, opacity, layerId) {
        const targetLayerId = layerId || activeLayerId;
        const layerContainer = layerContainers[targetLayerId];
        
        if (!layerContainer) {
            console.error(`[EnginePosition] Layer container not found: ${targetLayerId}`);
            return null;
        }
        
        const path = {
            id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            graphics: new PIXI.Graphics(),
            points: [],
            color, size, opacity, layerId: targetLayerId,
            isComplete: false
        };
        
        // World座標で描画（改修案対応 - Screen座標変換不要）
        path.graphics.circle(x, y, size / 2);
        path.graphics.fill({ color: path.color, alpha: path.opacity });
        
        path.points.push({ x, y, size });
        strokes.push(path);
        currentDrawingPath = path;
        
        // アクティブレイヤーContainerに追加（改修案の重要な修正点）
        layerContainer.addChild(path.graphics);
        
        return path;
    }
    
    function extendPath(path, x, y) {
        if (!path || path.points.length === 0) return;
        
        const lastPoint = path.points[path.points.length - 1];
        const distance = Math.sqrt((x - lastPoint.x) ** 2 + (y - lastPoint.y) ** 2);
        
        if (distance < 1.5) return;
        
        const steps = Math.max(1, Math.ceil(distance / 1.5));
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const px = lastPoint.x + (x - lastPoint.x) * t;
            const py = lastPoint.y + (y - lastPoint.y) * t;
            
            // World座標で描画（改修案対応）
            path.graphics.circle(px, py, path.size / 2);
            path.graphics.fill({ color: path.color, alpha: path.opacity });
        }
        
        path.points.push({ x, y, size: path.size });
    }
    
    function completePath(path) {
        if (path) {
            path.isComplete = true;
            currentDrawingPath = null;
            
            // 循環参照なしでpath情報を通知
            window.MainController?.safeNotify('path-completed', {
                pathId: path.id,
                pointsCount: path.points.length,
                color: path.color,
                size: path.size,
                opacity: path.opacity,
                layerId: path.layerId
            });
        }
    }
    
    // Canvas Resize
    function resize(newWidth, newHeight) {
        APP_CONFIG.canvas.width = newWidth;
        APP_CONFIG.canvas.height = newHeight;
        
        if (app?.renderer) {
            app.renderer.resize(newWidth, newHeight);
        }
        
        if (containers.camera?.mask) {
            containers.camera.mask.clear();
            containers.camera.mask.rect(0, 0, newWidth, newHeight);
            containers.camera.mask.fill(0x000000);
        }
        
        window.MainController?.safeNotify('canvas-resized', { 
            width: newWidth, 
            height: newHeight 
        });
    }
    
    function updateStatusDisplay() {
        const element = document.getElementById('camera-position');
        if (element) {
            element.textContent = `x: ${Math.round(camera.x)}, y: ${Math.round(camera.y)}`;
        }
    }
    
    // Event Handler from MainController
    function onEvent(event) {
        switch (event.type) {
            case 'space-pressed':
            case 'space-released':
                // Handle space key state changes
                break;
                
            case 'camera-reset-requested':
                resetCamera();
                break;
                
            case 'canvas-resize-requested':
                if (event.payload?.width && event.payload?.height) {
                    resize(event.payload.width, event.payload.height);
                }
                break;
                
            case 'layer-created-external':
                if (event.payload?.name) {
                    createLayer(event.payload.name);
                }
                break;
                
            case 'active-layer-changed':
                if (event.payload?.layerId !== undefined) {
                    setActiveLayer(event.payload.layerId);
                }
                break;
                
            case 'layer-visibility-changed':
                if (event.payload?.layerId !== undefined && event.payload?.visible !== undefined) {
                    setLayerVisibility(event.payload.layerId, event.payload.visible);
                }
                break;
                
            case 'path-created':
                if (event.payload?.path && event.payload?.layerId) {
                    const { x, y, size, color, opacity } = event.payload.path;
                    const newPath = createPath(x, y, size, color, opacity, event.payload.layerId);
                    
                    if (newPath) {
                        // 循環参照なしでpath ready通知
                        window.MainController?.safeNotify('path-ready-for-layer', {
                            pathId: newPath.id,
                            points: newPath.points.map(p => ({ x: p.x, y: p.y })),
                            color: newPath.color,
                            size: newPath.size,
                            opacity: newPath.opacity,
                            layerId: newPath.layerId
                        });
                    }
                }
                break;
                
            case 'path-extend':
                if (currentDrawingPath && event.payload?.x !== undefined && event.payload?.y !== undefined) {
                    extendPath(currentDrawingPath, event.payload.x, event.payload.y);
                }
                break;
                
            case 'path-complete':
                if (currentDrawingPath) {
                    completePath(currentDrawingPath);
                }
                break;
        }
    }
    
    // Public API
    return {
        init,
        worldToScreen,
        screenToWorld,
        setCamera,
        getCamera,
        createLayer,
        setActiveLayer,
        getActiveLayer,
        setLayerVisibility,
        drawStroke,
        createPath,
        extendPath,
        completePath,
        resize,
        resetCamera,
        onEvent,
        
        // Getters for controlled access
        getApp: () => app,
        getContainers: () => containers,
        getCurrentPath: () => currentDrawingPath,
        getStrokes: () => [...strokes],
        getLayerContainers: () => ({ ...layerContainers })
    };
})();