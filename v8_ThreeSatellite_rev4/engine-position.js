/**
 * @module   EnginePosition
 * @role     描画エンジン + 座標管理
 * @depends  MainController
 * @provides init(canvas), drawStroke(stroke), worldToScreen(point), screenToWorld(point), setCamera(x,y)
 * @notes    Camera/World/Screen座標系を厳格に区別、循環参照禁止、Pixi stageでCamera反映
 * @flow     Stroke登録→World→Screen→Pixi描画→MainController通知
 * @memory   Camera位置、World座標履歴、描画ストローク履歴、LayerごとのContainer
 */

const EnginePosition = (() => {
    let app = null;
    let containers = { camera: null, world: null, ui: null };
    let camera = { x: 0, y: 0, targetX: 0, targetY: 0 };
    let strokes = [];
    let canvasContainer = null;
    let positionState = {
        panning: false,
        startX: 0,
        startY: 0,
        pointerId: null,
        pointerType: null
    };
    let handlers = { move: null, up: null, cancel: null };
    let currentDrawingPath = null;
    
    // Layer Container Management - 重要な修正点
    const layerContainers = {}; // layerId -> PIXI.Container
    
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
     * Camera座標設定 - Pixi stage に必ず反映（重要な修正点）
     */
    function setCamera(x, y) {
        camera.targetX = x;
        camera.targetY = y;
        camera.x = Math.round(x);
        camera.y = Math.round(y);
        
        // Pixi stage 位置更新 - 改修案に従った重要な修正
        if (app && app.stage) {
            app.stage.x = -camera.x;
            app.stage.y = -camera.y;
        }
        
        updateCameraDisplay();
        
        // 循環参照なしで通知
        window.MainController?.safeNotify('camera-moved', { 
            camera: { x: camera.x, y: camera.y } 
        });
    }
    
    /**
     * LayerごとのContainerを登録・管理（重要な修正点）
     */
    function registerLayerContainer(layerId) {
        if (!layerContainers[layerId]) {
            const container = new PIXI.Container();
            containers.world.addChild(container);
            layerContainers[layerId] = container;
            console.log(`[EnginePosition] Layer container created: ${layerId}`);
        }
        return layerContainers[layerId];
    }
    
    /**
     * レイヤーの表示/非表示切替
     */
    function setLayerVisibility(layerId, visible) {
        if (layerContainers[layerId]) {
            layerContainers[layerId].visible = visible;
        }
    }
    
    function updateCameraDisplay() {
        if (canvasContainer) {
            const viewportCenter = {
                x: (window.innerWidth - 310) / 2,
                y: window.innerHeight / 2
            };
            
            const offset = {
                x: viewportCenter.x + camera.x,
                y: viewportCenter.y + camera.y
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
        positionState.panning = false;
        stopPanning();
        
        // Pixi stage リセット（重要な修正点）
        if (app && app.stage) {
            app.stage.x = 0;
            app.stage.y = 0;
        }
        
        if (canvasContainer) {
            canvasContainer.style.transform = 'translate(-50%, -50%)';
            canvasContainer.style.left = '50%';
            canvasContainer.style.top = '50%';
        }
        
        updateStatusDisplay();
        window.MainController?.safeNotify('camera-reset', {});
    }
    
    function moveByArrows(dx, dy) {
        camera.targetX += dx;
        camera.targetY += dy;
        
        const maxOffset = {
            x: (window.innerWidth - 310) / 2,
            y: window.innerHeight / 2
        };
        
        camera.targetX = Math.max(-maxOffset.x * 2, Math.min(maxOffset.x * 2, camera.targetX));
        camera.targetY = Math.max(-maxOffset.y * 2, Math.min(maxOffset.y * 2, camera.targetY));
        
        setCamera(camera.targetX, camera.targetY);
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
            setupInteraction();
            setupPositionHandlers();
            
            console.log('[EnginePosition] Initialized with PixiJS v8');
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
    
    function setupContainers() {
        containers.camera = new PIXI.Container();
        containers.world = new PIXI.Container();
        containers.ui = new PIXI.Container();
        
        // Create mask for canvas area
        const maskGraphics = new PIXI.Graphics();
        maskGraphics.rect(0, 0, APP_CONFIG.canvas.width, APP_CONFIG.canvas.height);
        maskGraphics.fill(0x000000);
        app.stage.addChild(maskGraphics);
        containers.camera.mask = maskGraphics;
        
        containers.camera.addChild(containers.world);
        app.stage.addChild(containers.camera);
        app.stage.addChild(containers.ui);
        
        containers.world.x = 0;
        containers.world.y = 0;
        containers.world.scale.set(1);
    }
    
    function setupInteraction() {
        containers.camera.eventMode = "static";
        containers.camera.hitArea = new PIXI.Rectangle(0, 0, APP_CONFIG.canvas.width, APP_CONFIG.canvas.height);
        
        containers.camera.on('pointerdown', onPointerDown);
        containers.camera.on('pointermove', onPointerMove);
        containers.camera.on('pointerup', onPointerUp);
        containers.camera.on('pointerupoutside', onPointerUp);
        containers.camera.on('pointercancel', onPointerUp);
    }
    
    function setupPositionHandlers() {
        if (!canvasContainer) return;
        
        handlers.move = (e) => onPositionPointerMove(e);
        handlers.up = (e) => onPositionPointerUp(e);
        handlers.cancel = (e) => onPositionPointerCancel(e);
        
        canvasContainer.addEventListener('pointerdown', onPositionPointerDown);
    }
    
    // Position Management Event Handlers
    function onPositionPointerDown(e) {
        const appState = window.MainController?.getAppState();
        if (!appState?.spacePressed) return;
        
        if (e.pointerType === 'pen' && e.pressure === 0) return;
        
        positionState.panning = true;
        positionState.startX = e.clientX;
        positionState.startY = e.clientY;
        positionState.pointerId = e.pointerId;
        positionState.pointerType = e.pointerType;
        
        canvasContainer.setPointerCapture(e.pointerId);
        
        canvasContainer.addEventListener('pointermove', handlers.move);
        canvasContainer.addEventListener('pointerup', handlers.up);
        canvasContainer.addEventListener('pointercancel', handlers.cancel);
        
        e.preventDefault();
    }
    
    function onPositionPointerMove(e) {
        if (!positionState.panning || e.pointerId !== positionState.pointerId) return;
        
        const appState = window.MainController?.getAppState();
        if (!appState?.spacePressed) return;
        
        if (e.pointerType === 'pen' && e.pressure === 0) return;
        
        const dx = e.clientX - positionState.startX;
        const dy = e.clientY - positionState.startY;
        
        camera.targetX += dx;
        camera.targetY += dy;
        
        const maxOffset = {
            x: (window.innerWidth - 310) / 2,
            y: window.innerHeight / 2
        };
        
        camera.targetX = Math.max(-maxOffset.x * 2, Math.min(maxOffset.x * 2, camera.targetX));
        camera.targetY = Math.max(-maxOffset.y * 2, Math.min(maxOffset.y * 2, camera.targetY));
        
        setCamera(camera.targetX, camera.targetY);
        
        positionState.startX = e.clientX;
        positionState.startY = e.clientY;
        
        e.preventDefault();
    }
    
    function onPositionPointerUp(e) {
        if (e.pointerId !== positionState.pointerId) return;
        stopPanning();
    }
    
    function onPositionPointerCancel(e) {
        if (e.pointerId !== positionState.pointerId) return;
        stopPanning();
    }
    
    function stopPanning() {
        positionState.panning = false;
        
        if (positionState.pointerId && canvasContainer.hasPointerCapture(positionState.pointerId)) {
            canvasContainer.releasePointerCapture(positionState.pointerId);
        }
        
        canvasContainer.removeEventListener('pointermove', handlers.move);
        canvasContainer.removeEventListener('pointerup', handlers.up);
        canvasContainer.removeEventListener('pointercancel', handlers.cancel);
        
        positionState.pointerId = null;
        positionState.pointerType = null;
    }
    
    // Drawing Event Handlers
    function onPointerDown(event) {
        const appState = window.MainController?.getAppState();
        const originalEvent = event.data.originalEvent;
        
        if (appState?.spacePressed) {
            event.stopPropagation();
            return;
        }
        
        if (originalEvent.pointerType === 'pen' && originalEvent.pressure === 0) {
            return;
        }
        
        window.MainController?.safeNotify('stroke-start-requested', {
            x: event.global.x,
            y: event.global.y,
            pressure: originalEvent.pressure || 1.0,
            pointerType: originalEvent.pointerType || 'mouse'
        });
    }
    
    function onPointerMove(event) {
        const appState = window.MainController?.getAppState();
        const originalEvent = event.data.originalEvent;
        
        window.MainController?.safeNotify('coordinates-changed', {
            x: event.global.x,
            y: event.global.y
        });
        
        if (appState?.spacePressed) return;
        
        if (originalEvent.pointerType === 'pen' && originalEvent.pressure === 0) {
            return;
        }
        
        window.MainController?.safeNotify('stroke-continue-requested', {
            x: event.global.x,
            y: event.global.y,
            pressure: originalEvent.pressure || 1.0,
            pointerType: originalEvent.pointerType || 'mouse'
        });
    }
    
    function onPointerUp(event) {
        const appState = window.MainController?.getAppState();
        
        if (!appState?.spacePressed) {
            window.MainController?.safeNotify('stroke-end-requested', {});
        }
    }
    
    // Drawing Operations - レイヤーContainer対応（重要な修正点）
    function drawStroke(stroke) {
        if (!stroke || !stroke.layerId) return;
        
        strokes.push(stroke);
        
        // レイヤーContainer取得/作成
        const layerContainer = registerLayerContainer(stroke.layerId);
        
        // World座標からScreen座標に変換
        const pts = stroke.points.map(p => ({
            ...p, 
            screenX: p.x - camera.x, 
            screenY: p.y - camera.y
        }));
        
        const g = new PIXI.Graphics();
        g.lineStyle(2, stroke.color || 0x000000);
        
        if (pts.length > 0) {
            g.moveTo(pts[0].screenX, pts[0].screenY);
            for (let i = 1; i < pts.length; i++) {
                g.lineTo(pts[i].screenX, pts[i].screenY);
            }
        }
        
        // アクティブレイヤーのContainerに描画（重要な修正点）
        layerContainer.addChild(g);
        
        // 循環参照なしで通知
        window.MainController?.safeNotify('stroke-drawn', { 
            layerId: stroke.layerId, 
            points: pts 
        });
    }
    
    function createPath(x, y, size, color, opacity, layerId) {
        const path = {
            id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            graphics: new PIXI.Graphics(),
            points: [],
            color, size, opacity, layerId,
            isComplete: false
        };
        
        path.graphics.circle(x, y, size / 2);
        path.graphics.fill({ color: path.color, alpha: path.opacity });
        
        path.points.push({ x, y, size });
        strokes.push(path);
        currentDrawingPath = path;
        
        // レイヤーContainerに追加（重要な修正点）
        const layerContainer = registerLayerContainer(layerId);
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
        
        if (containers.camera) {
            containers.camera.hitArea = new PIXI.Rectangle(0, 0, newWidth, newHeight);
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
                
            case 'camera-arrow-move':
                if (event.payload?.dx !== undefined && event.payload?.dy !== undefined) {
                    moveByArrows(event.payload.dx, event.payload.dy);
                }
                break;
                
            case 'canvas-resize-requested':
                if (event.payload?.width && event.payload?.height) {
                    resize(event.payload.width, event.payload.height);
                }
                break;
                
            case 'layer-created':
                if (event.payload?.layerId) {
                    registerLayerContainer(event.payload.layerId);
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
        drawStroke,
        createPath,
        extendPath,
        completePath,
        resize,
        registerLayerContainer,
        setLayerVisibility,
        onEvent,
        
        // Getters for controlled access
        getApp: () => app,
        getContainers: () => containers,
        getCameraContainer: () => cameraContainer,
        getCurrentPath: () => currentDrawingPath,
        getStrokes: () => [...strokes],
        getLayerContainers: () => ({ ...layerContainers })
    };
})();