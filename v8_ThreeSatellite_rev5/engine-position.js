/**
 * @module   EnginePosition
 * @role     座標管理・カメラ制御・描画エンジン
 * @depends  MainController
 * @provides init(canvas), setCamera(dx,dy), screenToWorld(x,y), worldToScreen(x,y)
 * @notes    cameraContainer一元管理、全レイヤー追従、座標系統一、循環参照排除
 * @flow     camera-move → setCamera → cameraContainer更新 → 全レイヤー追従
 * @memory   Camera位置、cameraContainer、レイヤーContainer管理、描画履歴
 */

const EnginePosition = (() => {
    let app = null;
    let cameraContainer = null;
    let camera = { x: 0, y: 0 };
    let layerContainers = new Map();
    let currentDrawingPath = null;
    let strokes = [];
    
    // Coordinate conversion - 改修案に沿った統一実装
    function screenToWorld(sx, sy) {
        return {
            x: sx - cameraContainer.x,
            y: sy - cameraContainer.y
        };
    }
    
    function worldToScreen(wx, wy) {
        return {
            x: wx + cameraContainer.x,
            y: wy + cameraContainer.y
        };
    }
    
    // Camera management - 改修案の重要な修正点
    function setCamera(dx, dy) {
        camera.x += dx;
        camera.y += dy;
        
        // cameraContainerの位置のみを更新 → 全レイヤー自動追従
        if (cameraContainer) {
            cameraContainer.x = camera.x;
            cameraContainer.y = camera.y;
        }
        
        updateCameraDisplay();
        
        // MainController経由で通知
        window.MainController?.emit('camera-moved', { 
            x: camera.x, 
            y: camera.y 
        });
    }
    
    function resetCamera() {
        camera.x = 0;
        camera.y = 0;
        
        if (cameraContainer) {
            cameraContainer.x = 0;
            cameraContainer.y = 0;
        }
        
        updateCameraDisplay();
        window.MainController?.emit('camera-reset-complete');
    }
    
    function updateCameraDisplay() {
        const element = document.getElementById('camera-position');
        if (element) {
            element.textContent = `x: ${Math.round(camera.x)}, y: ${Math.round(camera.y)}`;
        }
    }
    
    // Layer container management - 改修案の重要な修正点
    function getOrCreateLayerContainer(layerId) {
        if (!layerContainers.has(layerId)) {
            const container = new PIXI.Container();
            // 必ずcameraContainerの子供にする → カメラ移動と連動
            cameraContainer.addChild(container);
            layerContainers.set(layerId, container);
            console.log(`[EnginePosition] Layer container created for layer ${layerId}`);
        }
        return layerContainers.get(layerId);
    }
    
    function setLayerVisibility(layerId, visible) {
        const container = layerContainers.get(layerId);
        if (container) {
            container.visible = visible;
        }
    }
    
    // Drawing operations - レイヤー独立化
    function createPath(x, y, size, color, opacity, layerId) {
        const path = {
            id: `stroke_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            graphics: new PIXI.Graphics(),
            points: [{ x, y }],
            color, size, opacity, layerId,
            isComplete: false
        };
        
        // World座標で描画開始点を記録
        path.graphics.circle(x, y, size / 2);
        path.graphics.fill({ color, alpha: opacity });
        
        // アクティブレイヤーのコンテナに追加
        const layerContainer = getOrCreateLayerContainer(layerId);
        layerContainer.addChild(path.graphics);
        
        strokes.push(path);
        currentDrawingPath = path;
        
        console.log(`[EnginePosition] Path created in layer ${layerId}`);
        return path;
    }
    
    function extendPath(path, x, y) {
        if (!path || path.points.length === 0) return;
        
        const lastPoint = path.points[path.points.length - 1];
        const distance = Math.sqrt((x - lastPoint.x) ** 2 + (y - lastPoint.y) ** 2);
        
        if (distance < 1.5) return;
        
        // World座標でstrokeを延長
        const steps = Math.max(1, Math.ceil(distance / 1.5));
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const px = lastPoint.x + (x - lastPoint.x) * t;
            const py = lastPoint.y + (y - lastPoint.y) * t;
            
            path.graphics.circle(px, py, path.size / 2);
            path.graphics.fill({ color: path.color, alpha: path.opacity });
            
            path.points.push({ x: px, y: py });
        }
    }
    
    function completePath(path) {
        if (path) {
            path.isComplete = true;
            currentDrawingPath = null;
            
            // 循環参照なしで完了通知
            window.MainController?.emit('stroke-completed', {
                strokeId: path.id,
                layerId: path.layerId,
                pointCount: path.points.length
            });
        }
    }
    
    // Canvas resize
    function resizeCanvas(width, height) {
        APP_CONFIG.canvas.width = width;
        APP_CONFIG.canvas.height = height;
        
        if (app && app.renderer) {
            app.renderer.resize(width, height);
        }
        
        window.MainController?.emit('canvas-resized', { width, height });
    }
    
    // Main initialization
    async function init(canvasElement) {
        try {
            app = new PIXI.Application();
            await app.init({
                width: APP_CONFIG.canvas.width,
                height: APP_CONFIG.canvas.height,
                background: 0xf0e0d6,
                backgroundAlpha: 1,
                antialias: APP_CONFIG.rendering.antialias,
                resolution: APP_CONFIG.rendering.resolution
            });
            
            canvasElement.appendChild(app.canvas);
            
            // cameraContainer作成 - 改修案の重要な修正点
            cameraContainer = new PIXI.Container();
            app.stage.addChild(cameraContainer);
            
            setupInteraction();
            console.log('[EnginePosition] Initialized');
            return true;
            
        } catch (error) {
            console.error('[EnginePosition] Initialization failed:', error);
            window.MainController?.emit('error-occurred', {
                source: 'EnginePosition',
                error: error.message
            });
            return false;
        }
    }
    
    function setupInteraction() {
        // Set up interactive area
        const interactiveArea = new PIXI.Graphics();
        interactiveArea.rect(0, 0, APP_CONFIG.canvas.width, APP_CONFIG.canvas.height);
        interactiveArea.fill(0x000000, 0); // Transparent but interactive
        interactiveArea.eventMode = 'static';
        app.stage.addChild(interactiveArea);
        
        interactiveArea.on('pointerdown', onPointerDown);
        interactiveArea.on('pointermove', onPointerMove);
        interactiveArea.on('pointerup', onPointerUp);
        interactiveArea.on('pointerupoutside', onPointerUp);
    }
    
    function onPointerDown(event) {
        const appState = window.MainController?.getAppState();
        if (appState?.spacePressed) return; // Camera mode
        
        const pos = screenToWorld(event.global.x, event.global.y);
        window.MainController?.emit('draw-start', pos);
    }
    
    function onPointerMove(event) {
        const appState = window.MainController?.getAppState();
        
        // Always update coordinates
        const pos = screenToWorld(event.global.x, event.global.y);
        window.MainController?.emit('coordinates-changed', pos);
        
        if (appState?.spacePressed) return; // Camera mode
        
        window.MainController?.emit('draw-move', pos);
    }
    
    function onPointerUp(event) {
        const appState = window.MainController?.getAppState();
        if (!appState?.spacePressed) {
            window.MainController?.emit('draw-end');
        }
    }
    
    // Event handler from MainController
    function onEvent(event) {
        switch (event.type) {
            case 'camera-move':
                if (event.payload?.dx !== undefined && event.payload?.dy !== undefined) {
                    setCamera(event.payload.dx, event.payload.dy);
                }
                break;
                
            case 'camera-reset':
                resetCamera();
                break;
                
            case 'layer-created':
                if (event.payload?.layerId !== undefined) {
                    getOrCreateLayerContainer(event.payload.layerId);
                }
                break;
                
            case 'layer-visibility-changed':
                if (event.payload?.layerId !== undefined && event.payload?.visible !== undefined) {
                    setLayerVisibility(event.payload.layerId, event.payload.visible);
                }
                break;
                
            case 'path-created':
                if (event.payload?.path && event.payload?.layerId !== undefined) {
                    const { x, y, size, color, opacity } = event.payload.path;
                    const path = createPath(x, y, size, color, opacity, event.payload.layerId);
                    
                    // 循環参照なしで通知
                    window.MainController?.emit('path-ready', {
                        strokeId: path.id,
                        layerId: path.layerId
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
                
            case 'canvas-resize-requested':
                if (event.payload?.width && event.payload?.height) {
                    resizeCanvas(event.payload.width, event.payload.height);
                }
                break;
        }
    }
    
    // Public API
    return {
        init,
        setCamera,
        screenToWorld,
        worldToScreen,
        getOrCreateLayerContainer,
        setLayerVisibility,
        createPath,
        extendPath,
        completePath,
        resizeCanvas,
        onEvent,
        
        // Getters for controlled access
        getApp: () => app,
        getCameraContainer: () => cameraContainer,
        getCurrentPath: () => currentDrawingPath,
        getStrokes: () => [...strokes],
        getCamera: () => ({ ...camera })
    };
})();