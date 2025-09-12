(function() {
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
            keyboardMoveSpeed: 10,
            keyboardZoomSpeed: 0.05,
            keyboardRotateSpeed: 2
        },
        background: { color: 0xf0e0d6 },
        history: { maxSize: 10, autoSaveInterval: 500 },
        debug: false
    };
    
    // === キャンバス操作システム（Phase1.5完成版） ===
    class CanvasOperationSystem {
        constructor(app) {
            this.app = app;
            
            // ドラッグ状態
            this.isDragging = false;
            this.isRotateZoomMode = false;
            this.lastPoint = { x: 0, y: 0 };
            this.dragStartPoint = { x: 0, y: 0 };
            this.operationDirection = null; // 'horizontal' | 'vertical' | null
            
            // キーボード状態
            this.keys = {
                space: false,
                shift: false,
                ctrl: false
            };
            
            // ワールドコンテナ（すべてが一体で移動・変形）
            this.worldContainer = new PIXI.Container();
            this.worldContainer.label = 'worldContainer';
            app.stage.addChild(this.worldContainer);
            
            // キャンバス領域コンテナ
            this.canvasContainer = new PIXI.Container();
            this.canvasContainer.label = 'canvasContainer';
            this.worldContainer.addChild(this.canvasContainer);
            
            // カメラフレーム（キャンバスと一体で移動）
            this.cameraFrame = new PIXI.Graphics();
            this.cameraFrame.label = 'cameraFrame';
            this.worldContainer.addChild(this.cameraFrame);
            
            this.setupEvents();
            this.initializeTransform();
            this.drawCameraFrame();
        }
        
        initializeTransform() {
            // 画面中央にワールドを配置
            const centerX = this.app.screen.width / 2;
            const centerY = this.app.screen.height / 2;
            
            this.canvasContainer.position.set(0, 0);
            this.worldContainer.position.set(
                centerX - CONFIG.canvas.width / 2,
                centerY - CONFIG.canvas.height / 2
            );
            this.worldContainer.scale.set(CONFIG.camera.initialScale);
            this.worldContainer.rotation = 0;
        }
        
        setupEvents() {
            this.setupKeyboardEvents();
            this.setupCanvasEvents();
        }
        
        setupKeyboardEvents() {
            document.addEventListener('keydown', (e) => {
                if (e.code === 'Space') {
                    this.keys.space = true;
                    e.preventDefault();
                }
                if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
                    this.keys.shift = true;
                }
                if (e.code === 'ControlLeft' || e.code === 'ControlRight') {
                    this.keys.ctrl = true;
                }
                
                this.handleKeyboardOperation(e);
                this.updateCursor();
                this.updateOperationMode();
            });
            
            document.addEventListener('keyup', (e) => {
                if (e.code === 'Space') {
                    this.keys.space = false;
                }
                if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
                    this.keys.shift = false;
                }
                if (e.code === 'ControlLeft' || e.code === 'ControlRight') {
                    this.keys.ctrl = false;
                }
                
                this.updateCursor();
                this.updateOperationMode();
            });
        }
        
        handleKeyboardOperation(e) {
            // CTRL + 0 でリセット
            if (this.keys.ctrl && e.key === '0') {
                this.resetTransform();
                e.preventDefault();
                return;
            }
            
            // H で左右反転、Shift + H で上下反転
            if (e.key.toLowerCase() === 'h' && !this.keys.space) {
                this.flipCanvas(this.keys.shift ? 'vertical' : 'horizontal');
                e.preventDefault();
                return;
            }
            
            // Space + 方向キーでキャンバス操作
            if (this.keys.space && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                if (this.keys.shift) {
                    // Shift + Space + 方向キー = 拡縮・回転
                    this.handleKeyboardZoomRotate(e.code);
                } else {
                    // Space + 方向キー = 移動
                    this.handleKeyboardMove(e.code);
                }
                e.preventDefault();
                return;
            }
        }
        
        handleKeyboardMove(direction) {
            const speed = CONFIG.camera.keyboardMoveSpeed;
            let dx = 0, dy = 0;
            
            switch (direction) {
                case 'ArrowUp': dy = -speed; break;
                case 'ArrowDown': dy = speed; break;
                case 'ArrowLeft': dx = -speed; break;
                case 'ArrowRight': dx = speed; break;
            }
            
            this.worldContainer.x += dx;
            this.worldContainer.y += dy;
            this.updateTransformDisplay();
        }
        
        handleKeyboardZoomRotate(direction) {
            const centerX = CONFIG.canvas.width / 2;
            const centerY = CONFIG.canvas.height / 2;
            
            switch (direction) {
                case 'ArrowUp':
                    // 拡大
                    this.scaleAroundPoint(centerX, centerY, 1 + CONFIG.camera.keyboardZoomSpeed);
                    break;
                case 'ArrowDown':
                    // 縮小
                    this.scaleAroundPoint(centerX, centerY, 1 - CONFIG.camera.keyboardZoomSpeed);
                    break;
                case 'ArrowLeft':
                    // 左回転
                    this.rotateAroundPoint(centerX, centerY, -CONFIG.camera.keyboardRotateSpeed);
                    break;
                case 'ArrowRight':
                    // 右回転
                    this.rotateAroundPoint(centerX, centerY, CONFIG.camera.keyboardRotateSpeed);
                    break;
            }
        }
        
        setupCanvasEvents() {
            this.app.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
            
            this.app.canvas.addEventListener('pointerdown', (e) => {
                if (e.button === 2 || (e.button === 0 && this.keys.space)) {
                    this.startCanvasOperation(e);
                    e.preventDefault();
                }
            });
            
            this.app.canvas.addEventListener('pointermove', (e) => {
                if (this.isDragging) {
                    this.continueCanvasOperation(e);
                }
            });
            
            this.app.canvas.addEventListener('pointerup', (e) => {
                if (this.isDragging && (e.button === 2 || (e.button === 0 && this.keys.space))) {
                    this.endCanvasOperation();
                }
            });
            
            // ホイール操作
            this.app.canvas.addEventListener('wheel', (e) => {
                this.handleWheelOperation(e);
                e.preventDefault();
            });
        }
        
        startCanvasOperation(e) {
            this.isDragging = true;
            this.isRotateZoomMode = this.keys.shift;
            this.operationDirection = null;
            
            this.lastPoint = { x: e.clientX, y: e.clientY };
            this.dragStartPoint = { x: e.clientX, y: e.clientY };
            
            this.updateCursor();
            this.updateOperationMode();
        }
        
        continueCanvasOperation(e) {
            const currentPoint = { x: e.clientX, y: e.clientY };
            const dx = currentPoint.x - this.lastPoint.x;
            const dy = currentPoint.y - this.lastPoint.y;
            
            if (!this.isRotateZoomMode) {
                // 通常の移動
                this.worldContainer.x += dx;
                this.worldContainer.y += dy;
            } else {
                // 拡縮・回転モード
                this.handleRotateZoomDrag(e, dx, dy);
            }
            
            this.lastPoint = currentPoint;
            this.updateTransformDisplay();
        }
        
        handleRotateZoomDrag(e, dx, dy) {
            // 最初のドラッグ方向を判定
            if (this.operationDirection === null) {
                const startDx = e.clientX - this.dragStartPoint.x;
                const startDy = e.clientY - this.dragStartPoint.y;
                
                if (Math.abs(startDx) > Math.abs(startDy)) {
                    this.operationDirection = 'horizontal'; // 回転
                } else {
                    this.operationDirection = 'vertical'; // 拡縮
                }
            }
            
            const centerX = CONFIG.canvas.width / 2;
            const centerY = CONFIG.canvas.height / 2;
            
            if (this.operationDirection === 'vertical') {
                // 縦方向 = 拡縮
                const scaleFactor = dy < 0 ? 1.02 : 0.98;
                this.scaleAroundPoint(centerX, centerY, scaleFactor);
            } else {
                // 横方向 = 回転
                const rotationDelta = dx * 0.02; // 回転速度調整
                this.rotateAroundPoint(centerX, centerY, rotationDelta);
            }
        }
        
        endCanvasOperation() {
            this.isDragging = false;
            this.isRotateZoomMode = false;
            this.operationDirection = null;
            
            this.updateCursor();
            this.updateOperationMode();
        }
        
        handleWheelOperation(e) {
            const centerX = CONFIG.canvas.width / 2;
            const centerY = CONFIG.canvas.height / 2;
            
            if (this.keys.shift) {
                // Shift + ホイール = 回転
                const rotationDelta = e.deltaY > 0 ? 1 : -1;
                this.rotateAroundPoint(centerX, centerY, rotationDelta);
            } else {
                // ホイールのみ = 拡縮
                const scaleFactor = e.deltaY < 0 ? 1 + CONFIG.camera.wheelZoomSpeed : 1 - CONFIG.camera.wheelZoomSpeed;
                this.scaleAroundPoint(centerX, centerY, scaleFactor);
            }
        }
        
        scaleAroundPoint(pivotX, pivotY, scaleFactor) {
            const currentScale = this.worldContainer.scale.x;
            const newScale = currentScale * scaleFactor;
            
            if (newScale >= CONFIG.camera.minScale && newScale <= CONFIG.camera.maxScale) {
                const worldPivot = this.worldContainer.toGlobal({ x: pivotX, y: pivotY });
                
                this.worldContainer.scale.set(newScale);
                
                const newWorldPivot = this.worldContainer.toGlobal({ x: pivotX, y: pivotY });
                this.worldContainer.x += worldPivot.x - newWorldPivot.x;
                this.worldContainer.y += worldPivot.y - newWorldPivot.y;
                
                this.updateTransformDisplay();
            }
        }
        
        rotateAroundPoint(pivotX, pivotY, rotationDelta) {
            const worldPivot = this.worldContainer.toGlobal({ x: pivotX, y: pivotY });
            
            this.worldContainer.rotation += rotationDelta * Math.PI / 180;
            
            const newWorldPivot = this.worldContainer.toGlobal({ x: pivotX, y: pivotY });
            this.worldContainer.x += worldPivot.x - newWorldPivot.x;
            this.worldContainer.y += worldPivot.y - newWorldPivot.y;
            
            this.updateTransformDisplay();
        }
        
        flipCanvas(direction) {
            const centerX = CONFIG.canvas.width / 2;
            const centerY = CONFIG.canvas.height / 2;
            const worldPivot = this.worldContainer.toGlobal({ x: centerX, y: centerY });
            
            if (direction === 'horizontal') {
                this.worldContainer.scale.x *= -1;
            } else {
                this.worldContainer.scale.y *= -1;
            }
            
            const newWorldPivot = this.worldContainer.toGlobal({ x: centerX, y: centerY });
            this.worldContainer.x += worldPivot.x - newWorldPivot.x;
            this.worldContainer.y += worldPivot.y - newWorldPivot.y;
            
            this.updateTransformDisplay();
        }
        
        resetTransform() {
            this.initializeTransform();
            this.updateTransformDisplay();
        }
        
        updateCursor() {
            if (this.keys.space || this.isDragging) {
                if (this.isRotateZoomMode || this.keys.shift) {
                    this.app.canvas.style.cursor = 'grab';
                } else {
                    this.app.canvas.style.cursor = 'move';
                }
            } else {
                this.app.canvas.style.cursor = 'crosshair';
            }
        }
        
        updateOperationMode() {
            const modeDisplay = document.getElementById('operation-mode');
            if (modeDisplay) {
                let mode = '';
                
                if (this.keys.space) {
                    if (this.keys.shift) {
                        mode = 'キャンバス 拡縮・回転';
                    } else {
                        mode = 'キャンバス移動';
                    }
                } else if (this.isDragging) {
                    mode = 'キャンバス操作中';
                }
                
                if (mode) {
                    modeDisplay.textContent = mode;
                    modeDisplay.classList.add('show');
                } else {
                    modeDisplay.classList.remove('show');
                }
            }
        }
        
        screenToCanvas(screenX, screenY) {
            const rect = this.app.canvas.getBoundingClientRect();
            const globalPoint = { 
                x: screenX - rect.left, 
                y: screenY - rect.top 
            };
            return this.canvasContainer.toLocal(globalPoint);
        }
        
        updateTransformDisplay() {
            const element = document.getElementById('transform-info');
            if (element) {
                const x = Math.round(this.worldContainer.x);
                const y = Math.round(this.worldContainer.y);
                const s = Math.abs(this.worldContainer.scale.x).toFixed(2);
                const r = Math.round(this.worldContainer.rotation * 180 / Math.PI);
                element.textContent = `x:${x} y:${y} s:${s} r:${r}°`;
            }
        }
        
        drawCameraFrame() {
            this.cameraFrame.clear();
            this.cameraFrame.rect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
            this.cameraFrame.stroke({ width: 2, color: 0xff0000, alpha: 0.5 });
        }
    }
    
    // === レイヤー管理システム（修正版） ===
    class LayerManager {
        constructor(canvasContainer, app) {
            this.canvasContainer = canvasContainer;
            this.app = app;
            this.layers = [];
            this.activeLayerIndex = -1;
            this.layerCounter = 1;
            this.thumbnailUpdateQueue = new Set();
            
            this.layersContainer = new PIXI.Container();
            this.layersContainer.label = 'layersContainer';
            this.canvasContainer.addChild(this.layersContainer);
        }

        createLayer(name, isBackground = false) {
            const layer = new PIXI.Container();
            const layerId = `layer_${this.layerCounter}`;
            
            layer.label = layerId;
            layer.layerData = {
                id: layerId,
                name: name,
                visible: true,
                opacity: 1.0,
                isBackground: isBackground,
                paths: []
            };

            if (!isBackground) {
                this.layerCounter++;
            }

            if (isBackground) {
                const bg = new PIXI.Graphics();
                bg.rect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
                bg.fill(CONFIG.background.color);
                layer.addChild(bg);
                layer.layerData.backgroundGraphics = bg;
                layer.layerData.name = 'レイヤー0';
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
        
        // 方向キー上下でアクティブレイヤー移動
        moveActiveLayer(direction) {
            if (direction === 'up' && this.activeLayerIndex < this.layers.length - 1) {
                this.setActiveLayer(this.activeLayerIndex + 1);
            } else if (direction === 'down' && this.activeLayerIndex > 0) {
                this.setActiveLayer(this.activeLayerIndex - 1);
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

            const layerIndex = this.thumbnailUpdateQueue.values().next().value;
            this.thumbnailUpdateQueue.delete(layerIndex);
            this.updateThumbnail(layerIndex);
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
                        
                        layer.children.forEach(child => {
                            if (child instanceof PIXI.Graphics) {
                                const clone = child.clone();
                                clone.scale.set(scale);
                                tempContainer.addChild(clone);
                            }
                        });
                        
                        this.app.renderer.render({
                            container: tempContainer,
                            target: renderTexture
                        });
                        
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

    // === 描画エンジン（修正版） ===
    class DrawingEngine {
        constructor(canvasOperations, layerManager) {
            this.canvasOperations = canvasOperations;
            this.layerManager = layerManager;
            this.currentTool = 'pen';
            this.brushSize = CONFIG.pen.size;
            this.brushColor = CONFIG.pen.color;
            this.brushOpacity = CONFIG.pen.opacity;
            this.isDrawing = false;
            this.currentPath = null;
            this.lastPoint = null;
            this.clippingMask = null;
            this.initializeClippingMask();
        }
        
        initializeClippingMask() {
            this.clippingMask = new PIXI.Graphics();
            this.clippingMask.rect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
            this.clippingMask.fill(0xffffff);
            this.layerManager.layersContainer.mask = this.clippingMask;
            this.layerManager.canvasContainer.addChild(this.clippingMask);
        }

        startDrawing(screenX, screenY) {
            if (this.isDrawing || this.canvasOperations.keys.space || this.canvasOperations.isDragging) return;

            const canvasPoint = this.canvasOperations.screenToCanvas(screenX, screenY);
            
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
            if (!this.isDrawing || !this.currentPath || this.canvasOperations.keys.space || this.canvasOperations.isDragging) return;

            const canvasPoint = this.canvasOperations.screenToCanvas(screenX, screenY);
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

    // === インタラクション管理（修正版） ===
    class InteractionManager {
        constructor(app, drawingEngine, canvasOperations, layerManager) {
            this.app = app;
            this.drawingEngine = drawingEngine;
            this.canvasOperations = canvasOperations;
            this.layerManager = layerManager;
            this.setupKeyboardEvents();
            this.setupCanvasEvents();
        }

        setupKeyboardEvents() {
            document.addEventListener('keydown', (e) => {
                // ツール切り替え
                if (e.key.toLowerCase() === 'p' && !this.canvasOperations.keys.space) {
                    this.switchTool('pen');
                    e.preventDefault();
                }
                if (e.key.toLowerCase() === 'e' && !this.canvasOperations.keys.space) {
                    this.switchTool('eraser');
                    e.preventDefault();
                }
                
                // レイヤー移動（方向キー上下、Spaceが押されていない場合のみ）
                if (!this.canvasOperations.keys.space) {
                    if (e.code === 'ArrowUp') {
                        this.layerManager.moveActiveLayer('up');
                        e.preventDefault();
                    } else if (e.code === 'ArrowDown') {
                        this.layerManager.moveActiveLayer('down');
                        e.preventDefault();
                    }
                }
            });
        }

        setupCanvasEvents() {
            this.app.canvas.addEventListener('pointerdown', (e) => {
                if (e.button !== 0) return;

                const x = e.clientX;
                const y = e.clientY;

                this.drawingEngine.startDrawing(x, y);
                e.preventDefault();
            });

            this.app.canvas.addEventListener('pointermove', (e) => {
                const x = e.clientX;
                const y = e.clientY;

                const canvasPoint = this.canvasOperations.screenToCanvas(x, y);
                this.updateCoordinates(canvasPoint.x, canvasPoint.y);

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
            if (this.canvasOperations.keys.space || this.canvasOperations.isDragging) {
                this.app.canvas.style.cursor = 'move';
            } else {
                const tool = this.drawingEngine.currentTool;
                this.app.canvas.style.cursor = tool === 'eraser' ? 'cell' : 'crosshair';
            }
        }

        updateCoordinates(x, y) {
            const element = document.getElementById('coordinates');
            if (element) {
                element.textContent = `x: ${Math.round(x)}, y: ${Math.round(y)}`;
            }
        }
    }

    // === UI制御（修正版） ===
    class UIController {
        constructor(drawingEngine, layerManager, app, canvasOperations) {
            this.drawingEngine = drawingEngine;
            this.layerManager = layerManager;
            this.app = app;
            this.canvasOperations = canvasOperations;
            this.activePopup = null;
            this.setupEventDelegation();
            this.setupSliders();
            this.setupCanvasResize();
        }

        setupEventDelegation() {
            document.addEventListener('click', (e) => {
                const toolButton = e.target.closest('.tool-button');
                if (toolButton) {
                    this.handleToolClick(toolButton);
                    return;
                }

                const layerAddBtn = e.target.closest('#add-layer-btn');
                if (layerAddBtn) {
                    const layerName = `レイヤー${this.layerManager.layerCounter}`;
                    const { layer, index } = this.layerManager.createLayer(layerName);
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
                    this.togglePopup('pen-settings');
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
            const oldWidth = CONFIG.canvas.width;
            const oldHeight = CONFIG.canvas.height;
            
            CONFIG.canvas.width = newWidth;
            CONFIG.canvas.height = newHeight;
            
            this.canvasOperations.drawCameraFrame();
            
            if (this.drawingEngine.clippingMask) {
                this.drawingEngine.clippingMask.clear();
                this.drawingEngine.clippingMask.rect(0, 0, newWidth, newHeight);
                this.drawingEngine.clippingMask.fill(0xffffff);
            }
            
            this.layerManager.layers.forEach(layer => {
                if (layer.layerData.isBackground && layer.layerData.backgroundGraphics) {
                    layer.layerData.backgroundGraphics.clear();
                    layer.layerData.backgroundGraphics.rect(0, 0, newWidth, newHeight);
                    layer.layerData.backgroundGraphics.fill(CONFIG.background.color);
                }
            });
            
            this.canvasOperations.initializeTransform();
            
            const element = document.getElementById('canvas-info');
            if (element) {
                element.textContent = `${newWidth}×${newHeight}px`;
            }
            
            const widthInput = document.getElementById('canvas-width');
            const heightInput = document.getElementById('canvas-height');
            if (widthInput) widthInput.value = newWidth;
            if (heightInput) heightInput.value = newHeight;
            
            for (let i = 0; i < this.layerManager.layers.length; i++) {
                this.layerManager.requestThumbnailUpdate(i);
            }
        }
    }

    // === SortableJS統合（レイヤードラッグ対応） ===
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
            this.canvasOperations = null;
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

            // システム初期化
            this.canvasOperations = new CanvasOperationSystem(this.pixiApp);
            this.layerManager = new LayerManager(this.canvasOperations.canvasContainer, this.pixiApp);
            this.drawingEngine = new DrawingEngine(this.canvasOperations, this.layerManager);
            this.interactionManager = new InteractionManager(this.pixiApp, this.drawingEngine, this.canvasOperations, this.layerManager);
            this.uiController = new UIController(this.drawingEngine, this.layerManager, this.pixiApp, this.canvasOperations);

            // 初期レイヤー作成
            this.layerManager.createLayer('レイヤー0', true); // 背景レイヤー
            this.layerManager.createLayer('レイヤー1'); // 最初の描画レイヤー
            this.layerManager.setActiveLayer(1); // レイヤー1をアクティブに

            // UI初期化
            this.layerManager.updateLayerPanelUI();
            this.layerManager.updateStatusDisplay();

            // SortableJS初期化
            initializeSortable(this.layerManager);

            // アニメーションループ
            this.pixiApp.ticker.add(() => {
                this.layerManager.processThumbnailUpdates();
            });

            // ウィンドウリサイズ対応
            this.setupWindowResize();

            // 初期表示更新
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
                
                this.canvasOperations.initializeTransform();
                this.canvasOperations.drawCameraFrame();
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
            console.log('Initializing Phase1.5 Drawing App...');
            
            const app = new DrawingApp();
            await app.initialize();
            
            window.drawingApp = app;

            console.log('🎨 Phase1.5 Drawing App initialized successfully!');
            console.log('🚀 PixiJS v8.13最新機能活用状況:');
            console.log('  ✅ WebGPU自動選択 + WebGLフォールバック');
            console.log('  ✅ 改善されたメモリ管理・リーク防止');
            console.log('  ✅ Culling API活用で描画効率向上');
            console.log('  ✅ DPR自動対応で高解像度ディスプレイ最適化');
            console.log('  ✅ 最適化されたRenderTexture処理');
            console.log('  ✅ 警告制御でデバッグ効率向上');
            console.log('  🔄 Render Layers（UIレイヤー分離準備）');
            console.log('  🔄 テキストキャッシュ（将来のPixiJSテキスト移行時）');
            console.log('  🔄 GIFアニメサポート（Phase2アニメ機能準備）');
            console.log('✅ 完成したキャンバス操作機能:');
            console.log('  • Space + ドラッグ/方向キー = キャンバス移動');
            console.log('  • Shift + Space + ドラッグ/方向キー = 拡縮・回転（改善済み）');
            console.log('  • ホイール = 拡縮, Shift + ホイール = 回転');
            console.log('  • H = 左右反転, Shift + H = 上下反転');
            console.log('  • Ctrl + 0 = キャンバス位置リセット');
            console.log('✅ 修正されたレイヤー操作:');
            console.log('  • 方向キー上下 = アクティブレイヤー移動（階層変更ではない）');
            console.log('  • Sortable.jsによるドラッグでレイヤー順序変更');
            console.log('✅ 修正された座標変換:');
            console.log('  • キャンバス外からのペン描画復活');
            console.log('  • 正しい screenToCanvas 座標変換');
            console.log('  • カメラフレームとの連動修復');
            console.log('📋 操作ガイド:');
            console.log('  P = ペンツール, E = 消しゴムツール');
            console.log('  Space押下中に画面上部に操作モード表示');
            console.log('  カメラフレーム（赤枠）内が実際のキャンバス領域');

        } catch (error) {
            console.error('Failed to initialize Phase1.5 Drawing App:', error);
        }
    });

})();