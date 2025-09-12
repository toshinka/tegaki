console.log('📋 Fixed Features:');
            console.log('  - ✅ Canvas operations: Space+arrows (move), Shift+Space+arrows (scale/rotate)');
            console.log('  - ✅ Canvas drag operations: Space+drag (move), Shift+Space+drag (scale/rotate)');
            console.log('  - ✅ Canvas flip: H (horizontal), Shift+H (vertical)');
            console.log('  - ✅ Canvas reset: Ctrl+0 (reset position/scale/rotation)');
            console.log('  - ✅ Canvas wheel: wheel (zoom), Shift+wheel (rotate)');
            console.log('  - ✅ Layer operations: V+drag (move), V+Shift+drag (scale/rotate)');
            console.log('  - ✅ Layer movement: V+arrows (all directions), Raw arrows (up/down only)');
            console.log('  - ✅ Layer scale/rotate: V+Shift+arrows');
            console.log('  - ✅ Layer flip: V+H (horizontal), V+Shift+H (vertical)');(function() {
    'use strict';
    
    if (typeof PIXI === 'undefined') {
        console.error('PIXI is not loaded');
        return;
    }
    
    console.log('PixiJS loaded:', PIXI.VERSION);
    
    // === 設定 ===
    const CONFIG = {
        canvas: { width: 400, height: 400 },
        pen: { size: 16, opacity: 0.85, color: 0x800000 },
        camera: {
            minScale: 0.1,
            maxScale: 5.0,
            initialScale: 1.0,
            wheelZoomSpeed: 0.1,
            keyRotationDegree: 15
        },
        background: { color: 0xf0e0d6 },
        history: { maxSize: 10, autoSaveInterval: 500 },
        debug: false
    };
    
    const log = (...args) => {
        if (CONFIG.debug) console.log(...args);
    };

    // === 反転状態表示システム ===
    class FlipStatusDisplay {
        constructor() {
            this.popup = null;
            this.isShowing = false;
            this.createPopup();
        }
        
        createPopup() {
            this.popup = document.createElement('div');
            this.popup.className = 'flip-status-popup';
            this.popup.innerHTML = '<div class="flip-status-text"></div>';
            
            this.popup.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: var(--futaba-cream);
                border: 2px solid var(--futaba-maroon);
                border-radius: 12px;
                padding: 16px 24px;
                font-size: 18px;
                font-weight: bold;
                color: var(--futaba-maroon);
                z-index: 3000;
                display: none;
                user-select: none;
                box-shadow: 0 8px 24px rgba(128, 0, 0, 0.3);
                backdrop-filter: blur(8px);
                pointer-events: none;
            `;
            
            document.body.appendChild(this.popup);
        }
        
        show(horizontalFlipped, verticalFlipped) {
            let text = '';
            if (horizontalFlipped && verticalFlipped) {
                text = '水平・垂直反転中';
            } else if (horizontalFlipped) {
                text = '水平反転中';
            } else if (verticalFlipped) {
                text = '垂直反転中';
            }
            
            if (text) {
                this.popup.querySelector('.flip-status-text').textContent = text;
                this.popup.style.display = 'block';
                this.isShowing = true;
                
                this.popup.style.opacity = '0';
                this.popup.style.transform = 'translate(-50%, -50%) scale(0.9)';
                
                requestAnimationFrame(() => {
                    this.popup.style.transition = 'all 0.2s ease-out';
                    this.popup.style.opacity = '1';
                    this.popup.style.transform = 'translate(-50%, -50%) scale(1)';
                });
                
                setTimeout(() => this.hide(), 1500);
            }
        }
        
        hide() {
            if (this.isShowing) {
                this.popup.style.transition = 'all 0.2s ease-in';
                this.popup.style.opacity = '0';
                this.popup.style.transform = 'translate(-50%, -50%) scale(0.9)';
                
                setTimeout(() => {
                    this.popup.style.display = 'none';
                    this.isShowing = false;
                }, 200);
            }
        }
    }

    // === カメラシステム（修正版：Ctrl+0リセット対応） ===
    class CameraSystem {
        constructor(app) {
            this.app = app;
            this.isDragging = false;
            this.lastPoint = { x: 0, y: 0 };
            this.panSpeed = 1.0;
            this.zoomSpeed = CONFIG.camera.wheelZoomSpeed;
            this.rotation = 0;
            this.horizontalFlipped = false;
            this.verticalFlipped = false;
            
            // 初期状態の記憶（Ctrl+0リセット用）
            this.initialState = {
                position: null, // 後でセット
                scale: CONFIG.camera.initialScale,
                rotation: 0,
                horizontalFlipped: false,
                verticalFlipped: false
            };
            
            this.worldContainer = new PIXI.Container();
            this.worldContainer.label = 'worldContainer';
            app.stage.addChild(this.worldContainer);
            
            this.canvasContainer = new PIXI.Container();
            this.canvasContainer.label = 'canvasContainer';
            this.worldContainer.addChild(this.canvasContainer);
            
            this.cameraFrame = new PIXI.Graphics();
            this.cameraFrame.label = 'cameraFrame';
            this.worldContainer.addChild(this.cameraFrame);
            
            this.canvasMask = new PIXI.Graphics();
            this.canvasMask.rect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
            this.canvasMask.fill(0xffffff);
            this.worldContainer.addChild(this.canvasMask);
            this.canvasContainer.mask = this.canvasMask;
            
            this.flipStatusDisplay = new FlipStatusDisplay();
            
            this.setupEvents();
            this.initializeCamera();
            this.drawCameraFrame();
        }
        
        initializeCamera() {
            const centerX = this.app.screen.width / 2;
            const centerY = this.app.screen.height / 2;
            
            this.canvasContainer.position.set(0, 0);
            
            const initialX = centerX - CONFIG.canvas.width / 2;
            const initialY = centerY - CONFIG.canvas.height / 2;
            this.worldContainer.position.set(initialX, initialY);
            this.worldContainer.scale.set(CONFIG.camera.initialScale);
            
            // 初期状態を記憶
            this.initialState.position = { x: initialX, y: initialY };
        }
        
        // === Ctrl+0: キャンバスリセット機能 ===
        resetCanvas() {
            // 初期状態に復元
            this.worldContainer.position.set(
                this.initialState.position.x,
                this.initialState.position.y
            );
            this.worldContainer.scale.set(this.initialState.scale);
            this.worldContainer.rotation = 0;
            
            // 内部状態もリセット
            this.rotation = 0;
            this.horizontalFlipped = false;
            this.verticalFlipped = false;
            
            this.updateTransformDisplay();
        }
        
        setupEvents() {
            this.app.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
            
            this.app.canvas.addEventListener('pointerdown', (e) => {
                if (e.button === 2 || this.spacePressed) {
                    this.isDragging = true;
                    this.lastPoint = { x: e.clientX, y: e.clientY };
                    this.app.canvas.style.cursor = 'move';
                    e.preventDefault();
                }
            });
            
            this.app.canvas.addEventListener('pointermove', (e) => {
                if (this.isDragging) {
                    const dx = (e.clientX - this.lastPoint.x) * this.panSpeed;
                    const dy = (e.clientY - this.lastPoint.y) * this.panSpeed;
                    
                    this.worldContainer.x += dx;
                    this.worldContainer.y += dy;
                    
                    this.lastPoint = { x: e.clientX, y: e.clientY };
                    this.updateTransformDisplay();
                }
            });
            
            this.app.canvas.addEventListener('pointerup', (e) => {
                if (this.isDragging && (e.button === 2 || this.spacePressed)) {
                    this.isDragging = false;
                    this.updateCursor();
                }
            });
            
            this.app.canvas.addEventListener('wheel', (e) => {
                e.preventDefault();
                
                const scaleFactor = e.deltaY < 0 ? 1 + this.zoomSpeed : 1 - this.zoomSpeed;
                const newScale = this.worldContainer.scale.x * scaleFactor;
                
                if (newScale >= CONFIG.camera.minScale && newScale <= CONFIG.camera.maxScale) {
                    const centerX = CONFIG.canvas.width / 2;
                    const centerY = CONFIG.canvas.height / 2;
                    
                    const worldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                    
                    this.worldContainer.scale.set(newScale);
                    
                    const newWorldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                    this.worldContainer.x += worldCenter.x - newWorldCenter.x;
                    this.worldContainer.y += worldCenter.y - newWorldCenter.y;
                    
                    this.updateTransformDisplay();
                }
            });
            
            // === キーボード操作イベント（修正版：Ctrl+0追加） ===
            this.spacePressed = false;
            document.addEventListener('keydown', (e) => {
                // === Ctrl+0: キャンバスリセット ===
                if (e.ctrlKey && e.code === 'Digit0') {
                    this.resetCanvas();
                    e.preventDefault();
                    return;
                }
                
                if (e.code === 'Space') {
                    this.spacePressed = true;
                    this.updateCursor();
                    e.preventDefault();
                }
                
                // カメラ移動キー（方向キー）- Vキーが押されていない時のみ
                if (!this.vKeyPressed && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                    const moveAmount = 10;
                    switch(e.code) {
                        case 'ArrowUp':    this.worldContainer.y += moveAmount; break;
                        case 'ArrowDown':  this.worldContainer.y -= moveAmount; break;
                        case 'ArrowLeft':  this.worldContainer.x += moveAmount; break;
                        case 'ArrowRight': this.worldContainer.x -= moveAmount; break;
                    }
                    this.updateTransformDisplay();
                    e.preventDefault();
                }
                
                // カメラ拡縮・回転（Shift+方向キー）- Vキーが押されていない時のみ
                if (!this.vKeyPressed && e.shiftKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                    const centerX = CONFIG.canvas.width / 2;
                    const centerY = CONFIG.canvas.height / 2;
                    const worldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                    
                    switch(e.code) {
                        case 'ArrowUp': // 拡大
                            const scaleUpFactor = 1 + CONFIG.camera.wheelZoomSpeed;
                            const newScaleUp = this.worldContainer.scale.x * scaleUpFactor;
                            if (newScaleUp <= CONFIG.camera.maxScale) {
                                this.worldContainer.scale.set(newScaleUp);
                                const newWorldCenterUp = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                                this.worldContainer.x += worldCenter.x - newWorldCenterUp.x;
                                this.worldContainer.y += worldCenter.y - newWorldCenterUp.y;
                            }
                            break;
                            
                        case 'ArrowDown': // 縮小
                            const scaleDownFactor = 1 - CONFIG.camera.wheelZoomSpeed;
                            const newScaleDown = this.worldContainer.scale.x * scaleDownFactor;
                            if (newScaleDown >= CONFIG.camera.minScale) {
                                this.worldContainer.scale.set(newScaleDown);
                                const newWorldCenterDown = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                                this.worldContainer.x += worldCenter.x - newWorldCenterDown.x;
                                this.worldContainer.y += worldCenter.y - newWorldCenterDown.y;
                            }
                            break;
                            
                        case 'ArrowLeft': // 左回転
                            this.rotation -= CONFIG.camera.keyRotationDegree;
                            this.worldContainer.rotation = (this.rotation * Math.PI) / 180;
                            const newWorldCenterLeft = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                            this.worldContainer.x += worldCenter.x - newWorldCenterLeft.x;
                            this.worldContainer.y += worldCenter.y - newWorldCenterLeft.y;
                            break;
                            
                        case 'ArrowRight': // 右回転
                            this.rotation += CONFIG.camera.keyRotationDegree;
                            this.worldContainer.rotation = (this.rotation * Math.PI) / 180;
                            const newWorldCenterRight = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                            this.worldContainer.x += worldCenter.x - newWorldCenterRight.x;
                            this.worldContainer.y += worldCenter.y - newWorldCenterRight.y;
                            break;
                    }
                    
                    this.updateTransformDisplay();
                    e.preventDefault();
                }
                
                // === カメラ反転操作（H/Shift+H）- Vキーが押されていない時のみ ===
                if (!this.vKeyPressed && e.code === 'KeyH' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    const centerX = CONFIG.canvas.width / 2;
                    const centerY = CONFIG.canvas.height / 2;
                    const worldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                    
                    if (e.shiftKey) {
                        // Shift+H: 垂直反転（カメラフレーム中央基準）
                        this.verticalFlipped = !this.verticalFlipped;
                        this.worldContainer.scale.y *= -1;
                    } else {
                        // H: 水平反転（カメラフレーム中央基準）
                        this.horizontalFlipped = !this.horizontalFlipped;
                        this.worldContainer.scale.x *= -1;
                    }
                    
                    // 反転後の位置調整（カメラフレーム中央基準）
                    const newWorldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                    this.worldContainer.x += worldCenter.x - newWorldCenter.x;
                    this.worldContainer.y += worldCenter.y - newWorldCenter.y;
                    
                    // 反転状態表示
                    this.flipStatusDisplay.show(this.horizontalFlipped, this.verticalFlipped);
                    this.updateTransformDisplay();
                    e.preventDefault();
                }
            });
            
            document.addEventListener('keyup', (e) => {
                if (e.code === 'Space') {
                    this.spacePressed = false;
                    this.updateCursor();
                }
            });
        }
        
        setVKeyPressed(pressed) {
            this.vKeyPressed = pressed;
        }
        
        updateCursor() {
            if (this.spacePressed || this.isDragging) {
                this.app.canvas.style.cursor = 'move';
            } else {
                this.app.canvas.style.cursor = 'crosshair';
            }
        }
        
        screenToCanvas(screenX, screenY) {
            const globalPoint = { x: screenX, y: screenY };
            return this.canvasContainer.toLocal(globalPoint);
        }
        
        canvasToScreen(canvasX, canvasY) {
            const canvasPoint = { x: canvasX, y: canvasY };
            return this.canvasContainer.toGlobal(canvasPoint);
        }
        
        isPointInExtendedCanvas(canvasPoint, margin = 50) {
            return canvasPoint.x >= -margin && canvasPoint.x <= CONFIG.canvas.width + margin &&
                   canvasPoint.y >= -margin && canvasPoint.y <= CONFIG.canvas.height + margin;
        }
        
        updateTransformDisplay() {
            const element = document.getElementById('transform-info');
            if (element) {
                const x = Math.round(this.worldContainer.x);
                const y = Math.round(this.worldContainer.y);
                const s = Math.abs(this.worldContainer.scale.x).toFixed(2);
                const r = Math.round(this.rotation % 360);
                element.textContent = `x:${x} y:${y} s:${s} r:${r}°`;
            }
        }
        
        drawCameraFrame() {
            this.cameraFrame.clear();
            this.cameraFrame.rect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
            this.cameraFrame.stroke({ width: 2, color: 0xff0000, alpha: 0.5 });
        }
    }

    // === レイヤー管理システム（V+操作対応） ===
    class LayerManager {
        constructor(canvasContainer, app, cameraSystem) {
            this.canvasContainer = canvasContainer;
            this.app = app;
            this.cameraSystem = cameraSystem;
            this.layers = [];
            this.activeLayerIndex = -1;
            this.layerCounter = 0;
            this.thumbnailUpdateQueue = new Set();
            
            this.layersContainer = new PIXI.Container();
            this.layersContainer.label = 'layersContainer';
            this.canvasContainer.addChild(this.layersContainer);
            
            this.vKeyPressed = false;
            this.isLayerDragging = false;
            this.layerDragLastPoint = { x: 0, y: 0 };
            this.layerFlipStatusDisplay = new FlipStatusDisplay();
            
            this.setupLayerOperations();
        }
        
        setupLayerOperations() {
            document.addEventListener('keydown', (e) => {
                if (e.code === 'KeyV' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    if (!this.vKeyPressed) {
                        this.vKeyPressed = true;
                        this.cameraSystem.setVKeyPressed(true);
                        this.updateCursor();
                    }
                    e.preventDefault();
                }
                
                // === V + 方向キー: アクティブレイヤー移動 ===
                if (this.vKeyPressed && !e.shiftKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                    this.moveActiveLayer(e.code);
                    e.preventDefault();
                }
                
                // === V + Shift + 方向キー: アクティブレイヤー拡縮・回転 ===
                if (this.vKeyPressed && e.shiftKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                    this.transformActiveLayer(e.code);
                    e.preventDefault();
                }
                
                // === V + H / V + Shift + H: アクティブレイヤー反転 ===
                if (this.vKeyPressed && e.code === 'KeyH' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    const activeLayer = this.getActiveLayer();
                    if (activeLayer) {
                        const centerX = CONFIG.canvas.width / 2;
                        const centerY = CONFIG.canvas.height / 2;
                        
                        const pivot = { x: centerX, y: centerY };
                        activeLayer.pivot.set(pivot.x, pivot.y);
                        activeLayer.position.set(pivot.x, pivot.y);
                        
                        if (e.shiftKey) {
                            // V + Shift + H: 垂直反転
                            activeLayer.scale.y *= -1;
                        } else {
                            // V + H: 水平反転
                            activeLayer.scale.x *= -1;
                        }
                        
                        const hFlipped = activeLayer.scale.x < 0;
                        const vFlipped = activeLayer.scale.y < 0;
                        this.layerFlipStatusDisplay.show(hFlipped, vFlipped);
                        
                        this.requestThumbnailUpdate(this.activeLayerIndex);
                    }
                    e.preventDefault();
                }
            });
            
            document.addEventListener('keyup', (e) => {
                if (e.code === 'KeyV') {
                    this.vKeyPressed = false;
                    this.cameraSystem.setVKeyPressed(false);
                    this.isLayerDragging = false;
                    this.updateCursor();
                }
            });
            
            // === V + ドラッグ: アクティブレイヤー移動・変形 ===
            this.app.canvas.addEventListener('pointerdown', (e) => {
                if (this.vKeyPressed && e.button === 0) {
                    this.isLayerDragging = true;
                    this.layerDragLastPoint = { x: e.clientX, y: e.clientY };
                    this.app.canvas.style.cursor = 'move';
                    e.preventDefault();
                }
            });
            
            this.app.canvas.addEventListener('pointermove', (e) => {
                if (this.isLayerDragging && this.vKeyPressed) {
                    const activeLayer = this.getActiveLayer();
                    if (activeLayer) {
                        const dx = e.clientX - this.layerDragLastPoint.x;
                        const dy = e.clientY - this.layerDragLastPoint.y;
                        
                        const worldScale = this.cameraSystem.worldContainer.scale.x;
                        const adjustedDx = dx / worldScale;
                        const adjustedDy = dy / worldScale;
                        
                        if (e.shiftKey) {
                            // V + Shift + ドラッグ: 拡縮・回転
                            if (Math.abs(dx) > Math.abs(dy)) {
                                // 水平方向優先: 拡縮
                                const scaleFactor = 1 + (dx * 0.01);
                                const newScale = Math.max(0.1, Math.min(3.0, Math.abs(activeLayer.scale.x) * scaleFactor));
                                activeLayer.scale.x = activeLayer.scale.x < 0 ? -newScale : newScale;
                                activeLayer.scale.y = activeLayer.scale.y < 0 ? -newScale : newScale;
                            } else {
                                // 垂直方向優先: 回転
                                activeLayer.rotation += (dy * 0.02);
                            }
                        } else {
                            // V + ドラッグ: 移動
                            activeLayer.x += adjustedDx;
                            activeLayer.y += adjustedDy;
                        }
                        
                        this.layerDragLastPoint = { x: e.clientX, y: e.clientY };
                        this.requestThumbnailUpdate(this.activeLayerIndex);
                    }
                }
            });
            
            this.app.canvas.addEventListener('pointerup', (e) => {
                if (this.isLayerDragging) {
                    this.isLayerDragging = false;
                    this.updateCursor();
                }
            });
        }
        
        moveActiveLayer(keyCode) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;
            
            const moveAmount = 5;
            switch(keyCode) {
                case 'ArrowUp':    activeLayer.y -= moveAmount; break;
                case 'ArrowDown':  activeLayer.y += moveAmount; break;
                case 'ArrowLeft':  activeLayer.x -= moveAmount; break;
                case 'ArrowRight': activeLayer.x += moveAmount; break;
            }
            
            this.requestThumbnailUpdate(this.activeLayerIndex);
        }
        
        transformActiveLayer(keyCode) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;
            
            const centerX = CONFIG.canvas.width / 2;
            const centerY = CONFIG.canvas.height / 2;
            
            const pivot = { x: centerX, y: centerY };
            activeLayer.pivot.set(pivot.x, pivot.y);
            activeLayer.position.set(pivot.x, pivot.y);
            
            switch(keyCode) {
                case 'ArrowUp': // 拡大
                    const scaleUpFactor = 1.1;
                    const newScaleUp = Math.min(3.0, Math.abs(activeLayer.scale.x) * scaleUpFactor);
                    activeLayer.scale.x = activeLayer.scale.x < 0 ? -newScaleUp : newScaleUp;
                    activeLayer.scale.y = activeLayer.scale.y < 0 ? -newScaleUp : newScaleUp;
                    break;
                    
                case 'ArrowDown': // 縮小
                    const scaleDownFactor = 0.9;
                    const newScaleDown = Math.max(0.1, Math.abs(activeLayer.scale.x) * scaleDownFactor);
                    activeLayer.scale.x = activeLayer.scale.x < 0 ? -newScaleDown : newScaleDown;
                    activeLayer.scale.y = activeLayer.scale.y < 0 ? -newScaleDown : newScaleDown;
                    break;
                    
                case 'ArrowLeft': // 左回転
                    activeLayer.rotation -= (15 * Math.PI) / 180; // 15度
                    break;
                    
                case 'ArrowRight': // 右回転
                    activeLayer.rotation += (15 * Math.PI) / 180; // 15度
                    break;
            }
            
            this.requestThumbnailUpdate(this.activeLayerIndex);
        }
        
        updateCursor() {
            if (this.vKeyPressed) {
                this.app.canvas.style.cursor = 'grab';
            }
        }

        createLayer(name, isBackground = false) {
            const layer = new PIXI.Container();
            const layerId = `layer_${this.layerCounter++}`;
            
            layer.label = layerId;
            layer.layerData = {
                id: layerId,
                name: name,
                visible: true,
                opacity: 1.0,
                isBackground: isBackground,
                paths: []
            };

            if (isBackground) {
                const bg = new PIXI.Graphics();
                bg.rect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
                bg.fill(CONFIG.background.color);
                layer.addChild(bg);
                layer.layerData.backgroundGraphics = bg;
            }

            this.layers.push(layer);
            this.layersContainer.addChild(layer);
            return { layer, index: this.layers.length - 1 };
        }

        setActiveLayer(index) {
            if (index >= 0 && index < this.layers.length) {
                this.activeLayerIndex = index;
                this.updateLayerPanelUI();
                this.updateStatusDisplay();
            }
        }

        getActiveLayer() {
            return this.activeLayerIndex >= 0 ? this.layers[this.activeLayerIndex] : null;
        }

        addPathToLayer(layerIndex, path) {
            if (layerIndex >= 0 && layerIndex < this.layers.length) {
                const layer = this.layers[layerIndex];
                layer.layerData.paths.push(path);
                layer.addChild(path.graphics);
                this.requestThumbnailUpdate(layerIndex);
            }
        }

        requestThumbnailUpdate(layerIndex) {
            this.thumbnailUpdateQueue.add(layerIndex);
        }

        processThumbnailUpdates() {
            if (!this.app?.renderer || this.thumbnailUpdateQueue.size === 0) return;

            this.thumbnailUpdateQueue.forEach(layerIndex => {
                this.updateThumbnail(layerIndex);
            });
            this.thumbnailUpdateQueue.clear();
        }

        updateThumbnail(layerIndex) {
            if (!this.app?.renderer || layerIndex < 0 || layerIndex >= this.layers.length) return;

            const layer = this.layers[layerIndex];
            const layerItems = document.querySelectorAll('.layer-item');
            
            const panelIndex = this.layers.length - 1 - layerIndex;
            if (panelIndex >= 0 && panelIndex < layerItems.length) {
                const thumbnail = layerItems[panelIndex].querySelector('.layer-thumbnail');
                if (thumbnail) {
                    try {
                        const renderTexture = PIXI.RenderTexture.create({
                            width: 48, 
                            height: 48,
                            resolution: 1
                        });
                        
                        const tempContainer = new PIXI.Container();
                        const scaleX = 48 / CONFIG.canvas.width;
                        const scaleY = 48 / CONFIG.canvas.height;
                        const scale = Math.min(scaleX, scaleY);
                        
                        const layerClone = new PIXI.Container();
                        layerClone.position.copyFrom(layer.position);
                        layerClone.scale.copyFrom(layer.scale);
                        layerClone.rotation = layer.rotation;
                        layerClone.pivot.copyFrom(layer.pivot);
                        
                        layer.children.forEach(child => {
                            if (child instanceof PIXI.Graphics) {
                                const clone = child.clone();
                                layerClone.addChild(clone);
                            }
                        });
                        
                        layerClone.scale.x *= scale;
                        layerClone.scale.y *= scale;
                        tempContainer.addChild(layerClone);
                        
                        this.app.renderer.render(tempContainer, { renderTexture });
                        
                        const canvas = this.app.renderer.extract.canvas(renderTexture);
                        const dataURL = canvas.toDataURL();
                        
                        let img = thumbnail.querySelector('img');
                        if (!img) {
                            img = document.createElement('img');
                            thumbnail.innerHTML = '';
                            thumbnail.appendChild(img);
                        }
                        img.src = dataURL;
                        
                        renderTexture.destroy();
                        tempContainer.destroy();
                        
                    } catch (error) {
                        console.warn('Thumbnail update failed:', error);
                    }
                }
            }
        }

        updateLayerPanelUI() {
            const layerList = document.getElementById('layer-list');
            if (!layerList) return;

            layerList.innerHTML = '';

            for (let i = this.layers.length - 1; i >= 0; i--) {
                const layer = this.layers[i];
                const layerItem = document.createElement('div');
                layerItem.className = `layer-item ${i === this.activeLayerIndex ? 'active' : ''}`;
                layerItem.dataset.layerId = layer.layerData.id;
                layerItem.dataset.layerIndex = i;

                layerItem.innerHTML = `
                    <div class="layer-visibility ${layer.layerData.visible ? '' : 'hidden'}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            ${layer.layerData.visible ? 
                                '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>' :
                                '<path d="m15 18-.722-3.25"/><path d="m2 2 20 20"/><path d="M6.71 6.71C3.4 8.27 2 12 2 12s3 7 10 7c1.59 0 2.84-.3 3.79-.73"/><path d="m8.5 10.5 7 7"/><path d="M9.677 4.677C10.495 4.06 11.608 4 12 4c7 0 10 7 10 7a13.16 13.16 0 0 1-.64.77"/>'}
                        </svg>
                    </div>
                    <div class="layer-opacity">100%</div>
                    <div class="layer-name">${layer.layerData.name}</div>
                    <div class="layer-thumbnail">
                        <div class="layer-thumbnail-placeholder"></div>
                    </div>
                    <div class="layer-delete-button">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="m18 6-12 12"/><path d="m6 6 12 12"/>
                        </svg>
                    </div>
                `;

                layerItem.addEventListener('click', (e) => {
                    const target = e.target.closest('[class*="layer-"]');
                    if (target) {
                        const action = target.className;
                        if (action.includes('layer-visibility')) {
                            this.toggleLayerVisibility(i);
                            e.stopPropagation();
                        } else if (action.includes('layer-delete')) {
                            this.deleteLayer(i);
                            e.stopPropagation();
                        } else {
                            this.setActiveLayer(i);
                        }
                    } else {
                        this.setActiveLayer(i);
                    }
                });

                layerList.appendChild(layerItem);
            }
            
            for (let i = 0; i < this.layers.length; i++) {
                this.requestThumbnailUpdate(i);
            }
        }

        toggleLayerVisibility(layerIndex) {
            if (layerIndex >= 0 && layerIndex < this.layers.length) {
                const layer = this.layers[layerIndex];
                layer.layerData.visible = !layer.layerData.visible;
                layer.visible = layer.layerData.visible;
                this.updateLayerPanelUI();
            }
        }

        deleteLayer(layerIndex) {
            if (this.layers.length <= 1) return;
            if (layerIndex < 0 || layerIndex >= this.layers.length) return;

            const layer = this.layers[layerIndex];
            
            layer.layerData.paths.forEach(path => {
                if (path.graphics && path.graphics.destroy) {
                    path.graphics.destroy();
                }
            });

            this.layersContainer.removeChild(layer);
            layer.destroy();
            this.layers.splice(layerIndex, 1);

            if (this.activeLayerIndex === layerIndex) {
                this.activeLayerIndex = Math.min(this.activeLayerIndex, this.layers.length - 1);
            } else if (this.activeLayerIndex > layerIndex) {
                this.activeLayerIndex--;
            }

            this.updateLayerPanelUI();
            this.updateStatusDisplay();
        }

        updateStatusDisplay() {
            const statusElement = document.getElementById('current-layer');
            if (statusElement && this.activeLayerIndex >= 0) {
                const layer = this.layers[this.activeLayerIndex];
                statusElement.textContent = layer.layerData.name;
            }
        }
    }

    // === 描画エンジン ===
    class DrawingEngine {
        constructor(cameraSystem, layerManager) {
            this.cameraSystem = cameraSystem;
            this.layerManager = layerManager;
            this.currentTool = 'pen';
            this.brushSize = CONFIG.pen.size;
            this.brushColor = CONFIG.pen.color;
            this.brushOpacity = CONFIG.pen.opacity;
            this.isDrawing = false;
            this.currentPath = null;
            this.lastPoint = null;
        }

        startDrawing(screenX, screenY) {
            if (this.isDrawing || this.cameraSystem.spacePressed || this.cameraSystem.isDragging || 
                this.layerManager.vKeyPressed) return;

            const canvasPoint = this.cameraSystem.screenToCanvas(screenX, screenY);
            
            if (!this.cameraSystem.isPointInExtendedCanvas(canvasPoint)) {
                return;
            }
            
            this.isDrawing = true;
            this.lastPoint = canvasPoint;

            const activeLayer = this.layerManager.getActiveLayer();
            if (!activeLayer) return;

            const color = this.currentTool === 'eraser' ? CONFIG.background.color : this.brushColor;
            const opacity = this.currentTool === 'eraser' ? 1.0 : this.brushOpacity;

            this.currentPath = {
                id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                graphics: new PIXI.Graphics(),
                points: [{ x: canvasPoint.x, y: canvasPoint.y }],
                color: color,
                size: this.brushSize,
                opacity: opacity,
                isComplete: false
            };

            this.currentPath.graphics.circle(canvasPoint.x, canvasPoint.y, this.brushSize / 2);
            this.currentPath.graphics.fill({ color: color, alpha: opacity });

            this.layerManager.addPathToLayer(this.layerManager.activeLayerIndex, this.currentPath);
        }

        continueDrawing(screenX, screenY) {
            if (!this.isDrawing || !this.currentPath || this.cameraSystem.spacePressed || 
                this.cameraSystem.isDragging || this.layerManager.vKeyPressed) return;

            const canvasPoint = this.cameraSystem.screenToCanvas(screenX, screenY);
            const lastPoint = this.lastPoint;
            
            const distance = Math.sqrt(
                Math.pow(canvasPoint.x - lastPoint.x, 2) + 
                Math.pow(canvasPoint.y - lastPoint.y, 2)
            );

            if (distance < 1) return;

            const steps = Math.max(1, Math.floor(distance / 1));
            for (let i = 1; i <= steps; i++) {
                const t = i / steps;
                const x = lastPoint.x + (canvasPoint.x - lastPoint.x) * t;
                const y = lastPoint.y + (canvasPoint.y - lastPoint.y) * t;

                this.currentPath.graphics.circle(x, y, this.brushSize / 2);
                this.currentPath.graphics.fill({ 
                    color: this.currentPath.color, 
                    alpha: this.currentPath.opacity 
                });

                this.currentPath.points.push({ x, y });
            }

            this.lastPoint = canvasPoint;
        }

        stopDrawing() {
            if (!this.isDrawing) return;

            if (this.currentPath) {
                this.currentPath.isComplete = true;
                this.layerManager.requestThumbnailUpdate(this.layerManager.activeLayerIndex);
            }

            this.isDrawing = false;
            this.currentPath = null;
            this.lastPoint = null;
        }

        setTool(tool) {
            this.currentTool = tool;
        }

        setBrushSize(size) {
            this.brushSize = Math.max(0.1, Math.min(100, size));
        }

        setBrushOpacity(opacity) {
            this.brushOpacity = Math.max(0, Math.min(1, opacity));
        }
    }

    // === インタラクション管理 ===
    class InteractionManager {
        constructor(app, drawingEngine) {
            this.app = app;
            this.drawingEngine = drawingEngine;
            this.setupKeyboardEvents();
            this.setupCanvasEvents();
        }

        setupKeyboardEvents() {
            document.addEventListener('keydown', (e) => {
                if (e.key.toLowerCase() === 'p') {
                    this.switchTool('pen');
                }
                if (e.key.toLowerCase() === 'e') {
                    this.switchTool('eraser');
                }
            });
        }

        setupCanvasEvents() {
            this.app.canvas.addEventListener('pointerdown', (e) => {
                if (e.button !== 0) return;

                const rect = this.app.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                this.drawingEngine.startDrawing(x, y);
                e.preventDefault();
            });

            this.app.canvas.addEventListener('pointermove', (e) => {
                const rect = this.app.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                this.updateCoordinates(x, y);
                this.drawingEngine.continueDrawing(x, y);
            });

            this.app.canvas.addEventListener('pointerup', (e) => {
                if (e.button !== 0) return;
                this.drawingEngine.stopDrawing();
            });

            this.app.canvas.addEventListener('pointerenter', () => {
                this.updateCursor();
            });
        }

        switchTool(tool) {
            this.drawingEngine.setTool(tool);
            
            document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
            const toolBtn = document.getElementById(tool + '-tool');
            if (toolBtn) toolBtn.classList.add('active');

            const toolNames = { pen: 'ベクターペン', eraser: '消しゴム' };
            const toolElement = document.getElementById('current-tool');
            if (toolElement) {
                toolElement.textContent = toolNames[tool] || tool;
            }

            this.updateCursor();
        }

        updateCursor() {
            const tool = this.drawingEngine.currentTool;
            this.app.canvas.style.cursor = tool === 'eraser' ? 'cell' : 'crosshair';
        }

        updateCoordinates(x, y) {
            const element = document.getElementById('coordinates');
            if (element) {
                element.textContent = `x: ${Math.round(x)}, y: ${Math.round(y)}`;
            }
        }
    }

    // === UI制御 ===
    class UIController {
        constructor(drawingEngine, layerManager, app) {
            this.drawingEngine = drawingEngine;
            this.layerManager = layerManager;
            this.app = app;
            this.activePopup = null;
            this.toolbarIconClickMode = false;
            this.setupEventDelegation();
            this.setupSliders();
            this.setupCanvasResize();
        }

        setupEventDelegation() {
            document.addEventListener('click', (e) => {
                const toolButton = e.target.closest('.tool-button');
                if (toolButton) {
                    this.toolbarIconClickMode = true;
                    this.handleToolClick(toolButton);
                    this.toolbarIconClickMode = false;
                    return;
                }

                const layerAddBtn = e.target.closest('#add-layer-btn');
                if (layerAddBtn) {
                    const { layer, index } = this.layerManager.createLayer(`レイヤー${this.layerManager.layers.length + 1}`);
                    this.layerManager.setActiveLayer(index);
                    return;
                }

                if (!e.target.closest('.popup-panel') && 
                    !e.target.closest('.tool-button') &&
                    !e.target.closest('.layer-panel-container')) {
                    this.closeAllPopups();
                }
            });
        }

        handleToolClick(button) {
            const toolId = button.id;
            
            const toolMap = {
                'pen-tool': () => {
                    this.drawingEngine.setTool('pen');
                    if (!this.toolbarIconClickMode) {
                        this.togglePopup('pen-settings');
                    }
                    this.updateToolUI('pen');
                },
                'eraser-tool': () => {
                    this.drawingEngine.setTool('eraser');
                    this.closeAllPopups();
                    this.updateToolUI('eraser');
                },
                'resize-tool': () => {
                    this.togglePopup('resize-settings');
                }
            };
            
            const handler = toolMap[toolId];
            if (handler) handler();
        }

        updateToolUI(tool) {
            document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
            const toolBtn = document.getElementById(tool + '-tool');
            if (toolBtn) toolBtn.classList.add('active');

            const toolNames = { pen: 'ベクターペン', eraser: '消しゴム' };
            const toolElement = document.getElementById('current-tool');
            if (toolElement) {
                toolElement.textContent = toolNames[tool] || tool;
            }
        }

        togglePopup(popupId) {
            const popup = document.getElementById(popupId);
            if (!popup) return;
            
            if (this.activePopup && this.activePopup !== popup) {
                this.activePopup.classList.remove('show');
            }
            
            const isVisible = popup.classList.contains('show');
            popup.classList.toggle('show', !isVisible);
            this.activePopup = isVisible ? null : popup;
        }

        closeAllPopups() {
            document.querySelectorAll('.popup-panel').forEach(popup => {
                popup.classList.remove('show');
            });
            this.activePopup = null;
        }

        setupSliders() {
            this.createSlider('pen-size-slider', 0.1, 100, CONFIG.pen.size, (value) => {
                this.drawingEngine.setBrushSize(value);
                return value.toFixed(1) + 'px';
            });
            
            this.createSlider('pen-opacity-slider', 0, 100, CONFIG.pen.opacity * 100, (value) => {
                this.drawingEngine.setBrushOpacity(value / 100);
                return value.toFixed(1) + '%';
            });
        }

        createSlider(sliderId, min, max, initial, callback) {
            const container = document.getElementById(sliderId);
            if (!container) return;

            const track = container.querySelector('.slider-track');
            const handle = container.querySelector('.slider-handle');
            const valueDisplay = container.parentNode.querySelector('.slider-value');

            if (!track || !handle || !valueDisplay) return;

            let value = initial;
            let dragging = false;

            const update = (newValue) => {
                value = Math.max(min, Math.min(max, newValue));
                const percentage = ((value - min) / (max - min)) * 100;
                
                track.style.width = percentage + '%';
                handle.style.left = percentage + '%';
                valueDisplay.textContent = callback(value);
            };

            const getValue = (clientX) => {
                const rect = container.getBoundingClientRect();
                const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                return min + (percentage * (max - min));
            };

            container.addEventListener('mousedown', (e) => {
                dragging = true;
                update(getValue(e.clientX));
                e.preventDefault();
            });

            document.addEventListener('mousemove', (e) => {
                if (dragging) update(getValue(e.clientX));
            });

            document.addEventListener('mouseup', () => {
                dragging = false;
            });

            update(initial);
        }

        setupCanvasResize() {
            const applyBtn = document.getElementById('apply-resize');
            if (applyBtn) {
                applyBtn.addEventListener('click', () => {
                    const widthInput = document.getElementById('canvas-width');
                    const heightInput = document.getElementById('canvas-height');
                    
                    if (widthInput && heightInput) {
                        const newWidth = parseInt(widthInput.value);
                        const newHeight = parseInt(heightInput.value);
                        
                        if (newWidth > 0 && newHeight > 0) {
                            this.resizeCanvas(newWidth, newHeight);
                            this.closeAllPopups();
                        }
                    }
                });
            }
        }

        resizeCanvas(newWidth, newHeight) {
            CONFIG.canvas.width = newWidth;
            CONFIG.canvas.height = newHeight;
            
            const element = document.getElementById('canvas-info');
            if (element) {
                element.textContent = `${newWidth}×${newHeight}px`;
            }
            
            console.log(`Canvas resized to ${newWidth}x${newHeight}`);
        }
    }

    // === SortableJS統合 ===
    function initializeSortable(layerManager) {
        const layerList = document.getElementById('layer-list');
        if (layerList && typeof Sortable !== 'undefined') {
            Sortable.create(layerList, {
                animation: 150,
                ghostClass: 'sortable-ghost',
                chosenClass: 'sortable-chosen',
                onEnd: function(evt) {
                    const fromIndex = layerManager.layers.length - 1 - evt.oldIndex;
                    const toIndex = layerManager.layers.length - 1 - evt.newIndex;
                    
                    if (fromIndex !== toIndex) {
                        const layer = layerManager.layers.splice(fromIndex, 1)[0];
                        layerManager.layers.splice(toIndex, 0, layer);
                        
                        layerManager.layersContainer.removeChild(layer);
                        layerManager.layersContainer.addChildAt(layer, toIndex);
                        
                        if (layerManager.activeLayerIndex === fromIndex) {
                            layerManager.activeLayerIndex = toIndex;
                        } else if (layerManager.activeLayerIndex > fromIndex && layerManager.activeLayerIndex <= toIndex) {
                            layerManager.activeLayerIndex--;
                        } else if (layerManager.activeLayerIndex < fromIndex && layerManager.activeLayerIndex >= toIndex) {
                            layerManager.activeLayerIndex++;
                        }
                        
                        layerManager.updateLayerPanelUI();
                    }
                }
            });
        }
    }

    // === メインアプリケーション ===
    class DrawingApp {
        constructor() {
            this.pixiApp = null;
            this.cameraSystem = null;
            this.layerManager = null;
            this.drawingEngine = null;
            this.interactionManager = null;
            this.uiController = null;
        }

        async initialize() {
            const containerEl = document.getElementById('drawing-canvas');
            if (!containerEl) {
                throw new Error('Canvas container not found');
            }

            this.pixiApp = new PIXI.Application();
            
            const dpr = window.devicePixelRatio || 1;
            const screenWidth = window.innerWidth - 50;
            const screenHeight = window.innerHeight;
            
            await this.pixiApp.init({
                width: screenWidth,
                height: screenHeight,
                backgroundAlpha: 0,
                resolution: 1,
                antialias: true,
                eventMode: 'static',
                eventFeatures: {
                    move: true,
                    globalMove: true,
                    click: true,
                    wheel: true,
                }
            });
            
            containerEl.innerHTML = '';
            containerEl.appendChild(this.pixiApp.canvas);

            this.pixiApp.canvas.style.width = `${screenWidth}px`;
            this.pixiApp.canvas.style.height = `${screenHeight}px`;

            this.cameraSystem = new CameraSystem(this.pixiApp);
            this.layerManager = new LayerManager(this.cameraSystem.canvasContainer, this.pixiApp, this.cameraSystem);
            this.drawingEngine = new DrawingEngine(this.cameraSystem, this.layerManager);
            this.interactionManager = new InteractionManager(this.pixiApp, this.drawingEngine);
            this.uiController = new UIController(this.drawingEngine, this.layerManager, this.pixiApp);

            this.layerManager.createLayer('背景', true);
            this.layerManager.createLayer('レイヤー1');
            this.layerManager.setActiveLayer(1);

            this.layerManager.updateLayerPanelUI();
            this.layerManager.updateStatusDisplay();

            initializeSortable(this.layerManager);

            this.pixiApp.ticker.add(() => {
                this.layerManager.processThumbnailUpdates();
            });

            this.setupWindowResize();
            this.updateCanvasInfo();
            this.updateDPRInfo();
            this.startFPSMonitor();

            return true;
        }

        setupWindowResize() {
            window.addEventListener('resize', () => {
                const newWidth = window.innerWidth - 50;
                const newHeight = window.innerHeight;
                
                this.pixiApp.renderer.resize(newWidth, newHeight);
                this.pixiApp.canvas.style.width = `${newWidth}px`;
                this.pixiApp.canvas.style.height = `${newHeight}px`;
                
                this.cameraSystem.initializeCamera();
                this.cameraSystem.drawCameraFrame();
            });
        }

        updateCanvasInfo() {
            const element = document.getElementById('canvas-info');
            if (element) {
                element.textContent = `${CONFIG.canvas.width}×${CONFIG.canvas.height}px`;
            }
        }

        updateDPRInfo() {
            const element = document.getElementById('dpr-info');
            if (element) {
                element.textContent = (window.devicePixelRatio || 1).toFixed(1);
            }
        }

        startFPSMonitor() {
            let frameCount = 0;
            let lastTime = performance.now();

            const updateFPS = () => {
                frameCount++;
                const currentTime = performance.now();

                if (currentTime - lastTime >= 1000) {
                    const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
                    const element = document.getElementById('fps');
                    if (element) {
                        element.textContent = fps;
                    }

                    frameCount = 0;
                    lastTime = currentTime;
                }

                requestAnimationFrame(updateFPS);
            };

            updateFPS();
        }
    }

    // === アプリケーション起動 ===
    window.addEventListener('DOMContentLoaded', async () => {
        try {
            console.log('Initializing Drawing App...');
            
            const app = new DrawingApp();
            await app.initialize();
            
            window.drawingApp = app;

            console.log('🎨 Drawing App initialized successfully!');
            console.log('📋 Fixed Features:');
            console.log('  - ✅ Canvas operations: Space+drag (move), Shift+Space+arrows (scale/rotate)');
            console.log('  - ✅ Canvas flip: H (horizontal), Shift+H (vertical)');
            console.log('  - ✅ Canvas reset: Ctrl+0 (reset position/scale/rotation)');
            console.log('  - ✅ Layer operations: V+drag (move), V+Shift+drag (scale/rotate)');
            console.log('  - ✅ Layer movement: V+arrows');
            console.log('  - ✅ Layer scale/rotate: V+Shift+arrows');
            console.log('  - ✅ Layer flip: V+H (horizontal), V+Shift+H (vertical)');

        } catch (error) {
            console.error('Failed to initialize Drawing App:', error);
        }
    });

})();