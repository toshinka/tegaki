/**
 * @module   EnginePosition
 * @role     描画エンジン + 座標管理
 * @depends  MainController
 * @provides init(canvas), drawStroke(stroke), worldToScreen(point), screenToWorld(point), setCamera(x,y)
 * @notes    Camera/World/Screen座標系を厳格に区別、循環参照禁止
 * @flow     Stroke登録→World→Screen→DrawingEngine→MainController通知
 * @memory   Camera位置、World座標履歴、描画ストローク履歴、PixiJS app instance
 */

const EnginePosition = (() => {
    let app = null;
    let containers = { camera: null, world: null, ui: null };
    let camera = { x: 0, y: 0, targetX: 0, targetY: 0 };
    let paths = [];
    let canvasContainer = null;
    let positionState = {
        panning: false,
        startX: 0,
        startY: 0,
        pointerId: null,
        pointerType: null
    };
    let handlers = { move: null, up: null, cancel: null };
    let updateScheduled = false;
    let currentDrawingPath = null;
    
    // Coordinate System Management
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
    
    function setCamera(x, y) {
        camera.targetX = x;
        camera.targetY = y;
        updateScheduled = true;
        updateCameraPosition();
        window.MainController?.notifyEvent('camera-moved', { 
            camera: { x: camera.targetX, y: camera.targetY } 
        });
    }
    
    function updateCameraPosition() {
        if (!updateScheduled || !canvasContainer) return;
        
        const { targetX, targetY } = camera;
        
        if (camera.x !== targetX || camera.y !== targetY) {
            camera.x = Math.round(targetX);
            camera.y = Math.round(targetY);
            
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
        
        updateScheduled = false;
        updateStatusDisplay();
    }
    
    function resetCamera() {
        camera = { x: 0, y: 0, targetX: 0, targetY: 0 };
        positionState.panning = false;
        stopPanning();
        
        if (canvasContainer) {
            canvasContainer.style.transform = 'translate(-50%, -50%)';
            canvasContainer.style.left = '50%';
            canvasContainer.style.top = '50%';
        }
        
        updateStatusDisplay();
        window.MainController?.notifyEvent('camera-reset', {});
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
        
        updateScheduled = true;
        updateCameraPosition();
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
            
            // Start position update loop
            if (app.ticker) {
                app.ticker.add(() => updateCameraPosition());
            }
            
            console.log('[EnginePosition] Initialized with PixiJS v8');
            return true;
            
        } catch (error) {
            console.error('[EnginePosition] Initialization failed:', error);
            window.MainController?.notifyEvent('error-occurred', { 
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
        
        // Apply immediately to prevent drift
        camera.x = camera.targetX;
        camera.y = camera.targetY;
        
        positionState.startX = e.clientX;
        positionState.startY = e.clientY;
        updateScheduled = true;
        
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
        
        window.MainController?.notifyEvent('stroke-start-requested', {
            x: event.global.x,
            y: event.global.y,
            pressure: originalEvent.pressure || 1.0,
            pointerType: originalEvent.pointerType || 'mouse'
        });
    }
    
    function onPointerMove(event) {
        const appState = window.MainController?.getAppState();
        const originalEvent = event.data.originalEvent;
        
        window.MainController?.notifyEvent('coordinates-changed', {
            x: event.global.x,
            y: event.global.y
        });
        
        if (appState?.spacePressed) return;
        
        if (originalEvent.pointerType === 'pen' && originalEvent.pressure === 0) {
            return;
        }
        
        window.MainController?.notifyEvent('stroke-continue-requested', {
            x: event.global.x,
            y: event.global.y,
            pressure: originalEvent.pressure || 1.0,
            pointerType: originalEvent.pointerType || 'mouse'
        });
    }
    
    function onPointerUp(event) {
        const appState = window.MainController?.getAppState();
        
        if (!appState?.spacePressed) {
            window.MainController?.notifyEvent('stroke-end-requested', {});
        }
    }
    
    // Drawing Operations
    function createPath(x, y, size, color, opacity) {
        const path = {
            id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            graphics: new PIXI.Graphics(),
            points: [],
            color, size, opacity,
            isComplete: false
        };
        
        path.graphics.circle(x, y, size / 2);
        path.graphics.fill({ color: path.color, alpha: path.opacity });
        
        path.points.push({ x, y, size });
        paths.push(path);
        currentDrawingPath = path;
        
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
        }
    }
    
    function addPathToLayer(path, layerContainer) {
        if (path && layerContainer) {
            layerContainer.addChild(path.graphics);
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
        
        window.MainController?.notifyEvent('canvas-resized', { 
            width: newWidth, 
            height: newHeight 
        });
    }
    
    function updateStatusDisplay() {
        const element = document.getElementById('camera-position');
        if (element) {
            element.textContent = `x: ${Math.round(camera.targetX)}, y: ${Math.round(camera.targetY)}`;
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
                
            case 'path-created':
                if (event.payload?.path) {
                    const { x, y, size, color, opacity } = event.payload.path;
                    currentDrawingPath = createPath(x, y, size, color, opacity);
                    
                    window.MainController?.notifyEvent('path-ready-for-layer', {
                        path: currentDrawingPath
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
                
            case 'layer-container-ready':
                if (currentDrawingPath && event.payload?.container) {
                    // Note: This will be handled by layer management
                    // addPathToLayer(currentDrawingPath, event.payload.container);
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
        createPath,
        extendPath,
        completePath,
        addPathToLayer,
        resize,
        onEvent,
        
        // Getters for controlled access
        getApp: () => app,
        getContainers: () => containers,
        getCurrentPath: () => currentDrawingPath,
        getPaths: () => [...paths]
    };
})();