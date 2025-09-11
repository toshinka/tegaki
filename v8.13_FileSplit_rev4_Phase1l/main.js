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
            wheelZoomSpeed: 0.1
        },
        background: { color: 0xf0e0d6 },
        history: { maxSize: 10, autoSaveInterval: 500 },
        debug: false
    };
    
    // === カメラシステム（フレーム連動版・修正済み） ===
    class CameraSystem {
        constructor(app) {
            this.app = app;
            this.isDragging = false;
            this.lastPoint = { x: 0, y: 0 };
            this.panSpeed = 1.0;
            this.zoomSpeed = CONFIG.camera.wheelZoomSpeed;
            
            // ワールドコンテナ（カメラフレームとキャンバス内容が一緒に動く）
            this.worldContainer = new PIXI.Container();
            this.worldContainer.label = 'worldContainer';
            app.stage.addChild(this.worldContainer);
            
            // キャンバス領域コンテナ（実際の描画領域）
            this.canvasContainer = new PIXI.Container();
            this.canvasContainer.label = 'canvasContainer';
            this.worldContainer.addChild(this.canvasContainer);
            
            // カメラフレーム（キャンバスと一緒に移動）
            this.cameraFrame = new PIXI.Graphics();
            this.cameraFrame.label = 'cameraFrame';
            this.worldContainer.addChild(this.cameraFrame);
            
            this.setupEvents();
            this.initializeCamera();
            this.drawCameraFrame();
        }
        
        initializeCamera() {
            // ワールドを画面中央に配置
            const centerX = this.app.screen.width / 2;
            const centerY = this.app.screen.height / 2;
            
            // キャンバス領域を(0,0)から開始
            this.canvasContainer.position.set(0, 0);
            
            // ワールド全体を中央配置（カメラフレームが画面中央になるように）
            this.worldContainer.position.set(
                centerX - CONFIG.canvas.width / 2,
                centerY - CONFIG.canvas.height / 2
            );
            this.worldContainer.scale.set(CONFIG.camera.initialScale);
        }
        
        setupEvents() {
            // 右クリックドラッグでカメラ移動
            this.app.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
            
            this.app.canvas.addEventListener('pointerdown', (e) => {
                if (e.button === 2 || this.spacePressed) { // 右クリックまたはスペース
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
            
            // ズーム（カメラフレーム中央基準）
            this.app.canvas.addEventListener('wheel', (e) => {
                e.preventDefault();
                
                const scaleFactor = e.deltaY < 0 ? 1 + this.zoomSpeed : 1 - this.zoomSpeed;
                const newScale = this.worldContainer.scale.x * scaleFactor;
                
                if (newScale >= CONFIG.camera.minScale && newScale <= CONFIG.camera.maxScale) {
                    // カメラフレーム中央（ワールド座標のCANVAS中央）を基準にズーム
                    const centerX = CONFIG.canvas.width / 2;
                    const centerY = CONFIG.canvas.height / 2;
                    
                    // ワールド座標での中央点
                    const worldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                    
                    this.worldContainer.scale.set(newScale);
                    
                    // スケール後の位置調整
                    const newWorldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                    this.worldContainer.x += worldCenter.x - newWorldCenter.x;
                    this.worldContainer.y += worldCenter.y - newWorldCenter.y;
                    
                    this.updateTransformDisplay();
                }
            });
            
            // スペースキー監視
            this.spacePressed = false;
            document.addEventListener('keydown', (e) => {
                if (e.code === 'Space') {
                    this.spacePressed = true;
                    this.updateCursor();
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
        
        updateCursor() {
            if (this.spacePressed || this.isDragging) {
                this.app.canvas.style.cursor = 'move';
            } else {
                this.app.canvas.style.cursor = 'crosshair';
            }
        }
        
        // スクリーン座標をキャンバス座標に変換（修正版）
        screenToCanvas(screenX, screenY) {
            // まずスクリーン座標をグローバル座標に変換
            const rect = this.app.canvas.getBoundingClientRect();
            const globalPoint = { 
                x: screenX - rect.left, 
                y: screenY - rect.top 
            };
            
            // グローバル座標をキャンバス座標に変換
            return this.canvasContainer.toLocal(globalPoint);
        }
        
        // キャンバス座標をスクリーン座標に変換
        canvasToScreen(canvasX, canvasY) {
            const canvasPoint = { x: canvasX, y: canvasY };
            const globalPoint = this.canvasContainer.toGlobal(canvasPoint);
            const rect = this.app.canvas.getBoundingClientRect();
            return {
                x: globalPoint.x + rect.left,
                y: globalPoint.y + rect.top
            };
        }
        
        updateTransformDisplay() {
            const element = document.getElementById('transform-info');
            if (element) {
                // ワールドコンテナの変形情報を表示
                const x = Math.round(this.worldContainer.x);
                const y = Math.round(this.worldContainer.y);
                const s = this.worldContainer.scale.x.toFixed(2);
                element.textContent = `x:${x} y:${y} s:${s} r:0°`;
            }
        }
        
        drawCameraFrame() {
            // カメラフレームをワールド座標に描画（キャンバスと一体で移動）
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
            this.layerCounter = 1; // 1から開始に修正
            this.thumbnailUpdateQueue = new Set();
            
            // レイヤーコンテナ
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

            // レイヤー番号を適切にインクリメント
            if (!isBackground) {
                this.layerCounter++;
            }

            if (isBackground) {
                // レイヤー0（背景）は初期配置でfutaba-creamに塗られた透明なレイヤー
                const bg = new PIXI.Graphics();
                bg.rect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
                bg.fill(CONFIG.background.color);
                layer.addChild(bg);
                layer.layerData.backgroundGraphics = bg;
                
                // 背景レイヤーの名前を「レイヤー0」に設定
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

            // フレーム毎に1つのサムネイルのみ更新（負荷分散）
            const layerIndex = this.thumbnailUpdateQueue.values().next().value;
            this.thumbnailUpdateQueue.delete(layerIndex);
            this.updateThumbnail(layerIndex);
        }

        updateThumbnail(layerIndex) {
            if (!this.app?.renderer || layerIndex < 0 || layerIndex >= this.layers.length) return;

            const layer = this.layers[layerIndex];
            const layerItems = document.querySelectorAll('.layer-item');
            
            // パネル表示順序（逆順）
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
                        
                        // レイヤーを一時的にコピーしてサムネイル用に調整
                        const tempContainer = new PIXI.Container();
                        const scaleX = 48 / CONFIG.canvas.width;
                        const scaleY = 48 / CONFIG.canvas.height;
                        const scale = Math.min(scaleX, scaleY);
                        
                        // レイヤーの子要素を複製
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
                        
                        // Canvas要素として取得してDataURLに変換
                        const canvas = this.app.renderer.extract.canvas(renderTexture);
                        const dataURL = canvas.toDataURL();
                        
                        // 既存のimg要素を更新または新規作成
                        let img = thumbnail.querySelector('img');
                        if (!img) {
                            img = document.createElement('img');
                            thumbnail.innerHTML = ''; // placeholderを削除
                            thumbnail.appendChild(img);
                        }
                        img.src = dataURL;
                        
                        // リソース解放
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

            // 逆順で表示（最新レイヤーが上に）
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
                
                // 各レイヤーのサムネイル更新をリクエスト
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
            if (this.layers.length <= 1) return; // 最低1つは残す
            if (layerIndex < 0 || layerIndex >= this.layers.length) return;

            const layer = this.layers[layerIndex];
            
            // パス要素を破棄
            layer.layerData.paths.forEach(path => {
                if (path.graphics && path.graphics.destroy) {
                    path.graphics.destroy();
                }
            });

            this.layersContainer.removeChild(layer);
            layer.destroy();
            this.layers.splice(layerIndex, 1);

            // アクティブレイヤーインデックス調整
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
            this.clippingMask = null; // マスクオブジェクト
            this.initializeClippingMask();
        }
        
        initializeClippingMask() {
            // カメラフレーム内のみの描画を保証するマスク
            this.clippingMask = new PIXI.Graphics();
            this.clippingMask.rect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
            this.clippingMask.fill(0xffffff); // マスク色
            this.layerManager.layersContainer.mask = this.clippingMask;
            this.layerManager.canvasContainer.addChild(this.clippingMask);
        }

        startDrawing(screenX, screenY) {
            if (this.isDrawing || this.cameraSystem.spacePressed || this.cameraSystem.isDragging) return;

            // スクリーン座標をキャンバス座標に変換（修正版）
            const canvasPoint = this.cameraSystem.screenToCanvas(screenX, screenY);
            
            // 常に描画を開始（カメラフレーム外でも入力受け付け）
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

            // 最初のポイントを描画（マスクにより自動的にフレーム内のみ表示）
            this.currentPath.graphics.circle(canvasPoint.x, canvasPoint.y, this.brushSize / 2);
            this.currentPath.graphics.fill({ color: color, alpha: opacity });

            this.layerManager.addPathToLayer(this.layerManager.activeLayerIndex, this.currentPath);
        }

        continueDrawing(screenX, screenY) {
            if (!this.isDrawing || !this.currentPath || this.cameraSystem.spacePressed || this.cameraSystem.isDragging) return;

            const canvasPoint = this.cameraSystem.screenToCanvas(screenX, screenY);
            const lastPoint = this.lastPoint;
            
            const distance = Math.sqrt(
                Math.pow(canvasPoint.x - lastPoint.x, 2) + 
                Math.pow(canvasPoint.y - lastPoint.y, 2)
            );

            if (distance < 1) return;

            // 補間して滑らかな線を描画（マスクにより自動的にフレーム内のみ表示）
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
        constructor(app, drawingEngine, cameraSystem) {
            this.app = app;
            this.drawingEngine = drawingEngine;
            this.cameraSystem = cameraSystem;
            this.setupKeyboardEvents();
            this.setupCanvasEvents();
        }

        setupKeyboardEvents() {
            document.addEventListener('keydown', (e) => {
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
                if (e.button !== 0) return; // 左クリックのみ

                const x = e.clientX;
                const y = e.clientY;

                this.drawingEngine.startDrawing(x, y);
                e.preventDefault();
            });

            this.app.canvas.addEventListener('pointermove', (e) => {
                const x = e.clientX;
                const y = e.clientY;

                // 座標表示更新（スクリーン座標をキャンバス座標に変換して表示）
                const canvasPoint = this.cameraSystem.screenToCanvas(x, y);
                this.updateCoordinates(canvasPoint.x, canvasPoint.y);

                this.drawingEngine.continueDrawing(x, y);
            });

            this.app.canvas.addEventListener('pointerup', (e) => {
                if (e.button !== 0) return; // 左クリックのみ

                this.drawingEngine.stopDrawing();
            });

            // カーソル制御
            this.app.canvas.addEventListener('pointerenter', () => {
                this.updateCursor();
            });
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
            if (this.cameraSystem.spacePressed || this.cameraSystem.isDragging) {
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
        constructor(drawingEngine, layerManager, app, cameraSystem) {
            this.drawingEngine = drawingEngine;
            this.layerManager = layerManager;
            this.app = app;
            this.cameraSystem = cameraSystem;
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
                    // レイヤー番号を適切に管理
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
            // ツールボタンのアクティブ状態更新
            document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
            const toolBtn = document.getElementById(tool + '-tool');
            if (toolBtn) toolBtn.classList.add('active');

            // ステータス表示更新
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
            
            // カメラフレーム更新
            this.cameraSystem.drawCameraFrame();
            
            // クリッピングマスク更新
            if (this.drawingEngine.clippingMask) {
                this.drawingEngine.clippingMask.clear();
                this.drawingEngine.clippingMask.rect(0, 0, newWidth, newHeight);
                this.drawingEngine.clippingMask.fill(0xffffff);
            }
            
            // 背景レイヤーのサイズを更新
            this.layerManager.layers.forEach(layer => {
                if (layer.layerData.isBackground && layer.layerData.backgroundGraphics) {
                    layer.layerData.backgroundGraphics.clear();
                    layer.layerData.backgroundGraphics.rect(0, 0, newWidth, newHeight);
                    layer.layerData.backgroundGraphics.fill(CONFIG.background.color);
                }
            });
            
            // カメラを再初期化して新しいキャンバスサイズに合わせる
            this.cameraSystem.initializeCamera();
            
            // キャンバス情報更新
            const element = document.getElementById('canvas-info');
            if (element) {
                element.textContent = `${newWidth}×${newHeight}px`;
            }
            
            // 入力フィールド更新
            const widthInput = document.getElementById('canvas-width');
            const heightInput = document.getElementById('canvas-height');
            if (widthInput) widthInput.value = newWidth;
            if (heightInput) heightInput.value = newHeight;
            
            // 全レイヤーのサムネイル更新
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
                        // レイヤー順序を更新
                        const layer = layerManager.layers.splice(fromIndex, 1)[0];
                        layerManager.layers.splice(toIndex, 0, layer);
                        
                        // コンテナ内の順序も更新
                        layerManager.layersContainer.removeChild(layer);
                        layerManager.layersContainer.addChildAt(layer, toIndex);
                        
                        // アクティブレイヤーインデックス調整
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

            // PixiJS初期化（DPR対応・修正版）
            this.pixiApp = new PIXI.Application();
            
            const screenWidth = window.innerWidth - 50; // サイドバー分を除く
            const screenHeight = window.innerHeight;
            
            await this.pixiApp.init({
                width: screenWidth,
                height: screenHeight,
                backgroundAlpha: 0,
                resolution: 1, // DPRを1に固定してサイズ問題を回避
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

            // キャンバススタイルの明示的な設定
            this.pixiApp.canvas.style.width = `${screenWidth}px`;
            this.pixiApp.canvas.style.height = `${screenHeight}px`;

            // システム初期化
            this.cameraSystem = new CameraSystem(this.pixiApp);
            this.layerManager = new LayerManager(this.cameraSystem.canvasContainer, this.pixiApp);
            this.drawingEngine = new DrawingEngine(this.cameraSystem, this.layerManager);
            this.interactionManager = new InteractionManager(this.pixiApp, this.drawingEngine, this.cameraSystem);
            this.uiController = new UIController(this.drawingEngine, this.layerManager, this.pixiApp, this.cameraSystem);

            // 初期レイヤー作成（修正版）
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
                
                // カメラシステムを再初期化
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
            console.log('Initializing Fixed Drawing App...');
            
            const app = new DrawingApp();
            await app.initialize();
            
            // グローバルアクセス用
            window.drawingApp = app;

            console.log('🎨 Fixed Drawing App initialized successfully!');
            console.log('🔧 Fixed Issues:');
            console.log('  ✅ Pen drawing coordinate offset fixed');
            console.log('  ✅ Drawing limited to camera frame with mask');
            console.log('  ✅ Drawing input accepted from outside frame');
            console.log('  ✅ Layer numbering fixed (no skipping Layer 2)');
            console.log('  ✅ Thumbnail generation optimized for all layers');
            console.log('  ✅ Canvas resize now affects actual canvas size');
            console.log('  ✅ Background renamed to Layer 0 with futaba-cream color');
            console.log('📋 Enhanced Features:');
            console.log('  - Proper coordinate transformation (screenToCanvas)');
            console.log('  - Clipping mask for frame-constrained drawing');
            console.log('  - Optimized thumbnail updates (one per frame)');
            console.log('  - RuleBook v7 compliance improvements');

        } catch (error) {
            console.error('Failed to initialize Fixed Drawing App:', error);
        }
    });

})();