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
        viewport: {
            worldWidth: 2000,
            worldHeight: 2000,
            minScale: 0.1,
            maxScale: 5.0,
            wheelPercent: 0.1,
            moveSpeed: 10,
            rotateSpeed: 0.05,
            scaleSpeed: 0.02
        },
        history: { maxSize: 10, autoSaveInterval: 500 },
        debug: false
    };
    
    const log = (...args) => {
        if (CONFIG.debug) console.log(...args);
    };

    // === PixiJS + Viewport初期化 ===
    async function createApp(containerEl) {
        const app = new PIXI.Application();
        
        await app.init({
            width: CONFIG.canvas.width,
            height: CONFIG.canvas.height,
            backgroundAlpha: 0,
            resolution: window.devicePixelRatio || 1,
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
        containerEl.appendChild(app.canvas);
        
        app.canvas.style.width = `${CONFIG.canvas.width}px`;
        app.canvas.style.height = `${CONFIG.canvas.height}px`;
        
        // @pixi/viewportでカメラシステム構築
        const viewport = new PIXI.Viewport({
            screenWidth: CONFIG.canvas.width,
            screenHeight: CONFIG.canvas.height,
            worldWidth: CONFIG.viewport.worldWidth,
            worldHeight: CONFIG.viewport.worldHeight,
            events: app.renderer.events
        });
        
        app.stage.addChild(viewport);
        
        // viewport設定 - 右クリックドラッグは無効化（ペン操作と競合防止）
        viewport
            .drag({ mouseButtons: 'middle' }) // 中クリックでドラッグ
            .pinch()
            .wheel({ percent: CONFIG.viewport.wheelPercent })
            .decelerate()
            .clampZoom({
                minScale: CONFIG.viewport.minScale,
                maxScale: CONFIG.viewport.maxScale
            });
        
        // 無限キャンバス対応 - clampは設定しない
        
        // 中央にフォーカス（キャンバスエリア）
        const centerX = CONFIG.viewport.worldWidth / 2;
        const centerY = CONFIG.viewport.worldHeight / 2;
        viewport.moveCenter(centerX, centerY);
        
        // キャンバス背景
        const canvasBackground = new PIXI.Graphics();
        canvasBackground.label = 'canvasBackground';
        canvasBackground.rect(centerX - CONFIG.canvas.width / 2, centerY - CONFIG.canvas.height / 2, CONFIG.canvas.width, CONFIG.canvas.height);
        canvasBackground.fill(0xffffff);
        canvasBackground.stroke({ width: 1, color: 0xcccccc });
        viewport.addChild(canvasBackground);
        
        // レイヤーコンテナ
        const layersContainer = new PIXI.Container();
        layersContainer.label = 'layersContainer';
        viewport.addChild(layersContainer);
        
        // カメラフレーム（UI層、固定位置）
        const uiContainer = new PIXI.Container();
        uiContainer.label = 'uiContainer';
        app.stage.addChild(uiContainer);
        
        const cameraFrame = new PIXI.Graphics();
        cameraFrame.label = 'cameraFrame';
        uiContainer.addChild(cameraFrame);
        
        function drawCameraFrame() {
            cameraFrame.clear();
            const x = (app.screen.width - CONFIG.canvas.width) / 2;
            const y = (app.screen.height - CONFIG.canvas.height) / 2;
            cameraFrame.position.set(x, y);
            cameraFrame.rect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
            cameraFrame.stroke({ width: 2, color: 0xff0000, alpha: 0.3 });
        }
        
        drawCameraFrame();
        
        return { app, viewport, layersContainer, uiContainer, cameraFrame, drawCameraFrame, canvasBackground };
    }

    // === キャンバス操作システム ===
    class CanvasOperationManager {
        constructor(viewport, app) {
            this.viewport = viewport;
            this.app = app;
            this.isSpacePressed = false;
            this.isShiftPressed = false;
            this.isDragging = false;
            this.lastPointer = { x: 0, y: 0 };
            this.dragStartDirection = null; // 'horizontal' | 'vertical'
            this.operationMode = null; // 'move' | 'scale' | 'rotate'
            this.setupKeyboardEvents();
        }

        setupKeyboardEvents() {
            document.addEventListener('keydown', (e) => {
                const wasSpacePressed = this.isSpacePressed;
                
                if (e.code === 'Space') {
                    this.isSpacePressed = true;
                    e.preventDefault();
                }
                
                if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
                    this.isShiftPressed = true;
                }

                // 操作モード表示更新
                if (this.isSpacePressed && !wasSpacePressed) {
                    this.showOperationMode();
                }

                // キャンバスリセット
                if (e.ctrlKey && e.code === 'Digit0') {
                    this.resetCanvas();
                    e.preventDefault();
                }

                // 反転操作
                if (e.code === 'KeyH') {
                    if (e.shiftKey) {
                        this.flipCanvas('vertical');
                    } else {
                        this.flipCanvas('horizontal');
                    }
                    e.preventDefault();
                }

                // 方向キーでの移動
                if (this.isSpacePressed && !this.isShiftPressed) {
                    this.handleArrowKeys(e);
                }

                // 方向キーでの拡縮・回転
                if (this.isSpacePressed && this.isShiftPressed) {
                    this.handleShiftArrowKeys(e);
                }
            });

            document.addEventListener('keyup', (e) => {
                if (e.code === 'Space') {
                    this.isSpacePressed = false;
                    this.hideOperationMode();
                    this.resetOperation();
                }
                
                if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
                    this.isShiftPressed = false;
                }
            });
        }

        handleArrowKeys(e) {
            const speed = CONFIG.viewport.moveSpeed;
            let moved = false;

            switch(e.code) {
                case 'ArrowUp':
                    this.viewport.y += speed;
                    moved = true;
                    break;
                case 'ArrowDown':
                    this.viewport.y -= speed;
                    moved = true;
                    break;
                case 'ArrowLeft':
                    this.viewport.x += speed;
                    moved = true;
                    break;
                case 'ArrowRight':
                    this.viewport.x -= speed;
                    moved = true;
                    break;
            }

            if (moved) {
                e.preventDefault();
                this.setOperationMode('move');
            }
        }

        handleShiftArrowKeys(e) {
            const scaleSpeed = CONFIG.viewport.scaleSpeed;
            const rotateSpeed = CONFIG.viewport.rotateSpeed;
            let operated = false;

            switch(e.code) {
                case 'ArrowUp':
                    // 拡大
                    this.viewport.scale.x *= (1 + scaleSpeed);
                    this.viewport.scale.y *= (1 + scaleSpeed);
                    this.setOperationMode('scale');
                    operated = true;
                    break;
                case 'ArrowDown':
                    // 縮小
                    this.viewport.scale.x *= (1 - scaleSpeed);
                    this.viewport.scale.y *= (1 - scaleSpeed);
                    this.setOperationMode('scale');
                    operated = true;
                    break;
                case 'ArrowLeft':
                    // 左回転
                    this.viewport.rotation -= rotateSpeed;
                    this.setOperationMode('rotate');
                    operated = true;
                    break;
                case 'ArrowRight':
                    // 右回転
                    this.viewport.rotation += rotateSpeed;
                    this.setOperationMode('rotate');
                    operated = true;
                    break;
            }

            if (operated) {
                e.preventDefault();
            }
        }

        setupPointerEvents() {
            this.app.canvas.addEventListener('pointerdown', (e) => this.handlePointerDown(e));
            this.app.canvas.addEventListener('pointermove', (e) => this.handlePointerMove(e));
            this.app.canvas.addEventListener('pointerup', (e) => this.handlePointerUp(e));
            this.app.canvas.addEventListener('wheel', (e) => this.handleWheel(e));
        }

        handlePointerDown(e) {
            if (!this.isSpacePressed) return;
            
            this.isDragging = true;
            this.lastPointer = { x: e.clientX, y: e.clientY };
            this.dragStartDirection = null;
            e.preventDefault();
        }

        handlePointerMove(e) {
            if (!this.isSpacePressed || !this.isDragging) return;

            const deltaX = e.clientX - this.lastPointer.x;
            const deltaY = e.clientY - this.lastPointer.y;

            // 最初の動き方向を検出（ドラッグ操作分岐用）
            if (!this.dragStartDirection && (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3)) {
                this.dragStartDirection = Math.abs(deltaX) > Math.abs(deltaY) ? 'horizontal' : 'vertical';
            }

            if (this.isShiftPressed && this.dragStartDirection) {
                // Shift + Space: 拡縮・回転操作
                if (this.dragStartDirection === 'vertical') {
                    // 縦方向 = 拡縮
                    const scaleDelta = -deltaY * 0.005;
                    const newScale = Math.max(CONFIG.viewport.minScale, 
                                            Math.min(CONFIG.viewport.maxScale, this.viewport.scale.x * (1 + scaleDelta)));
                    this.viewport.scale.set(newScale);
                    this.setOperationMode('scale');
                } else {
                    // 横方向 = 回転
                    this.viewport.rotation += deltaX * 0.01;
                    this.setOperationMode('rotate');
                }
            } else {
                // Space only: 移動操作
                this.viewport.x += deltaX;
                this.viewport.y += deltaY;
                this.setOperationMode('move');
            }

            this.lastPointer = { x: e.clientX, y: e.clientY };
            e.preventDefault();
        }

        handlePointerUp(e) {
            if (this.isDragging) {
                this.isDragging = false;
                this.dragStartDirection = null;
                e.preventDefault();
            }
        }

        handleWheel(e) {
            if (!this.isSpacePressed) return;

            if (e.shiftKey) {
                // Shift + ホイール = 回転
                const rotationDelta = e.deltaY * 0.002;
                this.viewport.rotation += rotationDelta;
                this.setOperationMode('rotate');
            } else {
                // ホイールのみ = 拡縮 (viewportの標準処理を利用)
                this.setOperationMode('scale');
            }
            
            e.preventDefault();
        }

        resetCanvas() {
            const centerX = CONFIG.viewport.worldWidth / 2;
            const centerY = CONFIG.viewport.worldHeight / 2;
            
            this.viewport.position.set(0, 0);
            this.viewport.scale.set(1, 1);
            this.viewport.rotation = 0;
            this.viewport.moveCenter(centerX, centerY);
            
            this.setOperationMode('reset');
            setTimeout(() => this.resetOperation(), 500);
        }

        flipCanvas(direction) {
            if (direction === 'horizontal') {
                this.viewport.scale.x *= -1;
            } else {
                this.viewport.scale.y *= -1;
            }
            this.setOperationMode(`flip-${direction}`);
            setTimeout(() => this.resetOperation(), 500);
        }

        setOperationMode(mode) {
            this.operationMode = mode;
            this.updateOperationDisplay();
        }

        resetOperation() {
            this.operationMode = null;
            this.updateOperationDisplay();
        }

        showOperationMode() {
            const modeEl = document.getElementById('operation-mode');
            if (modeEl) {
                modeEl.classList.add('show');
            }
        }

        hideOperationMode() {
            const modeEl = document.getElementById('operation-mode');
            if (modeEl) {
                modeEl.classList.remove('show');
            }
        }

        updateOperationDisplay() {
            const modeEl = document.getElementById('operation-mode');
            if (!modeEl) return;

            const modeTexts = {
                'move': 'キャンバス移動モード',
                'scale': 'キャンバス拡縮モード', 
                'rotate': 'キャンバス回転モード',
                'reset': 'キャンバスリセット',
                'flip-horizontal': '左右反転',
                'flip-vertical': '上下反転'
            };

            if (this.isSpacePressed && this.isShiftPressed) {
                modeEl.textContent = 'キャンバス拡縮・回転モード';
            } else if (this.isSpacePressed) {
                modeEl.textContent = modeTexts[this.operationMode] || 'キャンバス移動モード';
            }
        }

        getCameraInfo() {
            const scale = this.viewport.scale.x;
            const rotation = (this.viewport.rotation * 180 / Math.PI).toFixed(0);
            return `x:${Math.round(this.viewport.x)} y:${Math.round(this.viewport.y)} s:${scale.toFixed(1)} r:${rotation}°`;
        }
    }

    // === レイヤー管理システム ===
    class LayerManager {
        constructor(layersContainer) {
            this.layersContainer = layersContainer;
            this.layers = [];
            this.activeLayerIndex = -1;
            this.layerCounter = 0;
            this.thumbnailUpdateQueue = new Set();
            this.setupLayerKeyboardEvents();
        }

        setupLayerKeyboardEvents() {
            document.addEventListener('keydown', (e) => {
                // レイヤー移動（Space押下時は無効）
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
                if (e.code === 'Space') return; // キャンバス操作優先

                if (e.code === 'ArrowUp' && !e.shiftKey && !e.ctrlKey) {
                    this.moveActiveLayer(-1); // 上のレイヤーへ
                    e.preventDefault();
                } else if (e.code === 'ArrowDown' && !e.shiftKey && !e.ctrlKey) {
                    this.moveActiveLayer(1); // 下のレイヤーへ
                    e.preventDefault();
                }
            });
        }

        moveActiveLayer(direction) {
            const newIndex = this.activeLayerIndex + direction;
            if (newIndex >= 0 && newIndex < this.layers.length) {
                this.setActiveLayer(newIndex);
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
                // 背景はワールド座標の中心に配置
                const centerX = CONFIG.viewport.worldWidth / 2;
                const centerY = CONFIG.viewport.worldHeight / 2;
                const bg = new PIXI.Graphics();
                bg.rect(centerX - CONFIG.canvas.width / 2, centerY - CONFIG.canvas.height / 2, CONFIG.canvas.width, CONFIG.canvas.height);
                bg.fill(0xf0e0d6);
                layer.addChild(bg);
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

        processThumbnailUpdates(app) {
            if (!app?.renderer || this.thumbnailUpdateQueue.size === 0) return;

            this.thumbnailUpdateQueue.forEach(layerIndex => {
                this.updateThumbnail(layerIndex, app);
            });
            this.thumbnailUpdateQueue.clear();
        }

        updateThumbnail(layerIndex, app) {
            if (!app?.renderer || layerIndex < 0 || layerIndex >= this.layers.length) return;

            const layer = this.layers[layerIndex];
            const layerItems = document.querySelectorAll('.layer-item');
            
            const panelIndex = this.layers.length - 1 - layerIndex;
            if (panelIndex < layerItems.length) {
                const thumbnail = layerItems[panelIndex].querySelector('.layer-thumbnail');
                if (thumbnail) {
                    try {
                        const renderTexture = PIXI.RenderTexture.create({
                            width: 48, height: 48,
                            resolution: 1
                        });
                        
                        app.renderer.render(layer, { renderTexture });
                        
                        const canvas = app.renderer.extract.canvas(renderTexture);
                        const dataURL = canvas.toDataURL();
                        
                        let img = thumbnail.querySelector('img');
                        if (!img) {
                            img = document.createElement('img');
                            thumbnail.appendChild(img);
                        }
                        img.src = dataURL;
                        
                        renderTexture.destroy();
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

            // Sortable初期化のための一時的な配列
            const sortableItems = [];

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
                    const action = e.target.closest('[class*="layer-"]')?.className;
                    if (action && action.includes('layer-visibility')) {
                        this.toggleLayerVisibility(i);
                        e.stopPropagation();
                    } else if (action && action.includes('layer-delete')) {
                        this.deleteLayer(i);
                        e.stopPropagation();
                    } else {
                        this.setActiveLayer(i);
                    }
                });

                layerList.appendChild(layerItem);
                sortableItems.push(layerItem);
            }

            // Sortable.js初期化
            if (window.Sortable && !layerList._sortable) {
                layerList._sortable = Sortable.create(layerList, {
                    animation: 200,
                    ghostClass: 'sortable-ghost',
                    chosenClass: 'sortable-chosen',
                    onEnd: (evt) => {
                        this.handleLayerReorder(evt.oldIndex, evt.newIndex);
                    }
                });
            }
        }

        handleLayerReorder(oldIndex, newIndex) {
            if (oldIndex === newIndex) return;

            // UI上の並び順（逆順）を実際のレイヤー順に変換
            const fromIndex = this.layers.length - 1 - oldIndex;
            const toIndex = this.layers.length - 1 - newIndex;

            // レイヤー配列とコンテナ内での並び替え
            const [movedLayer] = this.layers.splice(fromIndex, 1);
            this.layers.splice(toIndex, 0, movedLayer);

            this.layersContainer.removeChild(movedLayer);
            this.layersContainer.addChildAt(movedLayer, toIndex);

            // アクティブレイヤーインデックスの調整
            if (this.activeLayerIndex === fromIndex) {
                this.activeLayerIndex = toIndex;
            } else if (fromIndex < this.activeLayerIndex && toIndex >= this.activeLayerIndex) {
                this.activeLayerIndex--;
            } else if (fromIndex > this.activeLayerIndex && toIndex <= this.activeLayerIndex) {
                this.activeLayerIndex++;
            }

            this.updateStatusDisplay();
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
        constructor(viewport, layerManager) {
            this.viewport = viewport;
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
            if (this.isDrawing) return;

            // スクリーン座標をワールド座標に変換 - キャンバス外描画を可能に
            const worldPoint = this.viewport.toWorld({ x: screenX, y: screenY });
            
            this.isDrawing = true;
            this.lastPoint = worldPoint;

            const activeLayer = this.layerManager.getActiveLayer();
            if (!activeLayer) return;

            const color = this.currentTool === 'eraser' ? 0xf0e0d6 : this.brushColor;
            const opacity = this.currentTool === 'eraser' ? 1.0 : this.brushOpacity;

            this.currentPath = {
                id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                graphics: new PIXI.Graphics(),
                points: [{ x: worldPoint.x, y: worldPoint.y }],
                color: color,
                size: this.brushSize,
                opacity: opacity,
                isComplete: false
            };

            // 最初のポイントを描画
            this.currentPath.graphics.circle(worldPoint.x, worldPoint.y, this.brushSize / 2);
            this.currentPath.graphics.fill({ color: color, alpha: opacity });

            this.layerManager.addPathToLayer(this.layerManager.activeLayerIndex, this.currentPath);
        }

        continueDrawing(screenX, screenY) {
            if (!this.isDrawing || !this.currentPath) return;

            const worldPoint = this.viewport.toWorld({ x: screenX, y: screenY });
            const lastPoint = this.lastPoint;
            
            const distance = Math.sqrt(
                Math.pow(worldPoint.x - lastPoint.x, 2) + 
                Math.pow(worldPoint.y - lastPoint.y, 2)
            );

            if (distance < 2) return;

            // 補間して滑らかな線を描画
            const steps = Math.max(1, Math.floor(distance / 2));
            for (let i = 1; i <= steps; i++) {
                const t = i / steps;
                const x = lastPoint.x + (worldPoint.x - lastPoint.x) * t;
                const y = lastPoint.y + (worldPoint.y - lastPoint.y) * t;

                this.currentPath.graphics.circle(x, y, this.brushSize / 2);
                this.currentPath.graphics.fill({ 
                    color: this.currentPath.color, 
                    alpha: this.currentPath.opacity 
                });

                this.currentPath.points.push({ x, y });
            }

            this.lastPoint = worldPoint;
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
        constructor(app, drawingEngine, canvasOperationManager) {
            this.app = app;
            this.drawingEngine = drawingEngine;
            this.canvasOperationManager = canvasOperationManager;
            this.setupKeyboardEvents();
            this.setupCanvasEvents();
        }

        setupKeyboardEvents() {
            document.addEventListener('keydown', (e) => {
                // 入力フィールドでは無効
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

                // ツール切り替え
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
                if (this.canvasOperationManager.isSpacePressed) return; // スペース押下時は描画しない

                const rect = this.app.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                this.drawingEngine.startDrawing(x, y);
            });

            this.app.canvas.addEventListener('pointermove', (e) => {
                const rect = this.app.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                // 座標表示更新
                this.updateCoordinates(x, y);

                if (!this.canvasOperationManager.isSpacePressed) {
                    this.drawingEngine.continueDrawing(x, y);
                }
            });

            this.app.canvas.addEventListener('pointerup', () => {
                if (!this.canvasOperationManager.isSpacePressed) {
                    this.drawingEngine.stopDrawing();
                }
            });

            // カーソル制御
            this.app.canvas.addEventListener('pointerenter', () => {
                this.updateCursor();
            });

            // キャンバス操作のポインターイベント設定
            this.canvasOperationManager.setupPointerEvents();
        }

        switchTool(tool) {
            this.drawingEngine.setTool(tool);
            
            // UI更新
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
            if (this.canvasOperationManager.isSpacePressed) {
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

    // === UI制御 ===
    class UIController {
        constructor(drawingEngine, layerManager, canvasOperationManager) {
            this.drawingEngine = drawingEngine;
            this.layerManager = layerManager;
            this.canvasOperationManager = canvasOperationManager;
            this.activePopup = null;
            this.setupEventDelegation();
            this.setupSliders();
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
                    this.togglePopup('pen-settings');
                },
                'eraser-tool': () => {
                    this.drawingEngine.setTool('eraser');
                    this.closeAllPopups();
                },
                'resize-tool': () => {
                    this.togglePopup('resize-settings');
                }
            };
            
            const handler = toolMap[toolId];
            if (handler) handler();
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

        updateCameraInfo() {
            const element = document.getElementById('camera-info');
            if (element) {
                element.textContent = this.canvasOperationManager.getCameraInfo();
            }
        }
    }

    // === メインアプリケーション ===
    class DrawingApp {
        constructor() {
            this.pixiApp = null;
            this.viewport = null;
            this.layerManager = null;
            this.drawingEngine = null;
            this.canvasOperationManager = null;
            this.interactionManager = null;
            this.uiController = null;
        }

        async initialize() {
            const containerEl = document.getElementById('drawing-canvas');
            if (!containerEl) {
                throw new Error('Canvas container not found');
            }

            // PixiJS + Viewport初期化
            const { app, viewport, layersContainer, uiContainer, cameraFrame, drawCameraFrame, canvasBackground } = await createApp(containerEl);
            this.pixiApp = app;
            this.viewport = viewport;

            // システム初期化
            this.layerManager = new LayerManager(layersContainer);
            this.drawingEngine = new DrawingEngine(viewport, this.layerManager);
            this.canvasOperationManager = new CanvasOperationManager(viewport, app);
            this.interactionManager = new InteractionManager(app, this.drawingEngine, this.canvasOperationManager);
            this.uiController = new UIController(this.drawingEngine, this.layerManager, this.canvasOperationManager);

            // 初期レイヤー作成
            this.layerManager.createLayer('背景', true);
            this.layerManager.createLayer('レイヤー1');
            this.layerManager.setActiveLayer(1); // レイヤー1をアクティブに

            // UI初期化
            this.layerManager.updateLayerPanelUI();
            this.layerManager.updateStatusDisplay();

            // アニメーションループ
            app.ticker.add(() => {
                this.layerManager.processThumbnailUpdates(app);
                this.uiController.updateCameraInfo();
            });

            // キャンバス情報表示更新
            this.updateCanvasInfo();

            // FPS監視
            this.startFPSMonitor();

            // DPR表示
            this.updateDPRInfo();

            return true;
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
            // 必要なライブラリチェック
            if (!window.PIXI || !window.PIXI.Viewport) {
                throw new Error('PixiJS or @pixi/viewport not loaded');
            }

            console.log('Initializing Drawing App...');
            
            const app = new DrawingApp();
            await app.initialize();
            
            // グローバルアクセス用
            window.drawingApp = app;

            console.log('🎨 Drawing App initialized successfully!');
            console.log('📋 キャンバス操作ガイド:');
            console.log('  🖱️  Space + ドラッグ = キャンバス移動');
            console.log('  ⌨️  Space + 方向キー = キャンバス移動');
            console.log('  🔄 Shift + Space + 縦ドラッグ = 拡縮');
            console.log('  🔄 Shift + Space + 横ドラッグ = 回転');
            console.log('  🔄 Shift + Space + 方向キー = 拡縮・回転');
            console.log('  🖱️  ホイール = 拡縮');
            console.log('  🔄 Shift + ホイール = 回転');
            console.log('  🔄 H = 左右反転 | Shift + H = 上下反転');
            console.log('  ↩️  Ctrl + 0 = キャンバスリセット');
            console.log('  📑 ↑↓ = レイヤー移動');
            console.log('  🖊️  P = ペン | E = 消しゴム');
            console.log('');
            console.log('🔧 システム特徴:');
            console.log('  - 自前Viewportによる軽量カメラシステム');
            console.log('  - キャンバス外からのペン描画対応');
            console.log('  - 無限キャンバス対応');
            console.log('  - 正確な座標変換システム');
            console.log('  - レイヤー階層管理とサムネイル更新');

        } catch (error) {
            console.error('Failed to initialize Drawing App:', error);
        }
    });

})();