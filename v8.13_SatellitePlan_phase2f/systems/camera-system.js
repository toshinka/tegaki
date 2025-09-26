// ===== systems/camera-system.js - 改修版：GPT5案準拠座標変換API ===== 
// カメラ操作・座標変換・ガイドライン表示を統合管理
// PixiJS v8.13準拠・座標系の厳格定義・EventBus統合

(function() {
    'use strict';

    const CameraSystem = {
        name: 'CameraSystem',
        
        // 初期化
        init: function(opts) {
            console.log('CameraSystem: Initializing...');
            
            this.app = opts.app;
            this.CONFIG = window.TEGAKI_CONFIG;
            
            // 状態管理
            this.isDragging = false;
            this.isScaleRotateDragging = false;
            this.lastPoint = { x: 0, y: 0 };
            this.panSpeed = this.CONFIG.camera.dragMoveSpeed;
            this.zoomSpeed = this.CONFIG.camera.wheelZoomSpeed;
            this.rotation = 0;
            this.horizontalFlipped = false;
            this.verticalFlipped = false;
            
            // 初期状態の記憶（Ctrl+0リセット用）
            this.initialState = {
                position: null,
                scale: this.CONFIG.camera.initialScale,
                rotation: 0,
                horizontalFlipped: false,
                verticalFlipped: false
            };
            
            // コンテナ作成（GPT5案準拠の階層構造）
            this.worldContainer = new PIXI.Container();
            this.worldContainer.label = 'worldContainer';
            this.app.stage.addChild(this.worldContainer);
            
            this.canvasContainer = new PIXI.Container();
            this.canvasContainer.label = 'canvasContainer';
            this.worldContainer.addChild(this.canvasContainer);
            
            this.cameraFrame = new PIXI.Graphics();
            this.cameraFrame.label = 'cameraFrame';
            this.worldContainer.addChild(this.cameraFrame);
            
            this.guideLines = new PIXI.Container();
            this.guideLines.label = 'guideLines';
            this.worldContainer.addChild(this.guideLines);
            this.createGuideLines();
            
            this.canvasMask = new PIXI.Graphics();
            this.canvasMask.rect(0, 0, this.CONFIG.canvas.width, this.CONFIG.canvas.height);
            this.canvasMask.fill(0xffffff);
            this.worldContainer.addChild(this.canvasMask);
            this.canvasContainer.mask = this.canvasMask;
            
            // キー状態管理
            this.spacePressed = false;
            this.shiftPressed = false;
            this.vKeyPressed = false;
            
            // 依存システムの参照（後で設定）
            this.layerSystem = null;
            this.drawingEngine = null;
            
            this.setupEvents();
            this.initializeCamera();
            this.drawCameraFrame();
            
            // EventBusリスナー設定
            this.setupEventBusListeners();
            
            console.log('CameraSystem: Initialized successfully');
        },

        // EventBusリスナー設定
        setupEventBusListeners: function() {
            // カメラリサイズ要求の処理
            window.Tegaki.EventBus.on('camera:resize', (data) => {
                this.resizeCanvas(data.width, data.height);
            });
            
            // ツール変更時の処理
            window.Tegaki.EventBus.on('tool:changed', (data) => {
                this.switchTool(data.tool);
            });
        },

        // ガイドライン作成（キャンバスサイズ変更対応・完全版）
        createGuideLines: function() {
            this.guideLines.removeChildren();
            
            const centerX = this.CONFIG.canvas.width / 2;
            const centerY = this.CONFIG.canvas.height / 2;
            
            console.log('CameraSystem: Creating guide lines at center:', centerX, centerY);
            
            // 縦線（カメラフレーム中央）
            const verticalLine = new PIXI.Graphics();
            verticalLine.rect(centerX - 0.5, 0, 1, this.CONFIG.canvas.height);
            verticalLine.fill({ color: 0x800000, alpha: 0.8 });
            this.guideLines.addChild(verticalLine);
            
            // 横線（カメラフレーム中央）
            const horizontalLine = new PIXI.Graphics();
            horizontalLine.rect(0, centerY - 0.5, this.CONFIG.canvas.width, 1);
            horizontalLine.fill({ color: 0x800000, alpha: 0.8 });
            this.guideLines.addChild(horizontalLine);
            
            this.guideLines.visible = false;
        },

        // カメラ初期化
        initializeCamera: function() {
            const centerX = this.app.screen.width / 2;
            const centerY = this.app.screen.height / 2;
            
            this.canvasContainer.position.set(0, 0);
            
            const initialX = centerX - this.CONFIG.canvas.width / 2;
            const initialY = centerY - this.CONFIG.canvas.height / 2;
            this.worldContainer.position.set(initialX, initialY);
            this.worldContainer.scale.set(this.CONFIG.camera.initialScale);
            
            this.initialState.position = { x: initialX, y: initialY };
        },

        // === GPT5案準拠座標変換API（厳格実装） ===
        
        // スクリーン→ワールド変換（input: screen, returns: world）
        screenToWorld: function(screenPoint) {
            const bounds = this.app.canvas.getBoundingClientRect();
            const x = (screenPoint.x - bounds.left) * (this.app.canvas.width / bounds.width);
            const y = (screenPoint.y - bounds.top) * (this.app.canvas.height / bounds.height);
            
            // PixiJS v8.13: worldContainerのtoLocal使用
            return this.worldContainer.toLocal({ x, y }, this.app.stage);
        },

        // ワールド→キャンバス変換（input: world, returns: canvas）
        worldToCanvas: function(worldPoint) {
            // canvasContainerのローカル座標に変換
            return this.canvasContainer.toLocal(worldPoint, this.worldContainer);
        },

        // キャンバス→ワールド変換（input: canvas, returns: world）
        canvasToWorld: function(canvasPoint) {
            // canvasContainerからworldContainerへ変換
            return this.worldContainer.toLocal(canvasPoint, this.canvasContainer);
        },

        // ワールド→スクリーン変換（input: world, returns: screen）
        worldToScreen: function(worldPoint) {
            const global = this.worldContainer.toGlobal(worldPoint);
            const bounds = this.app.canvas.getBoundingClientRect();
            
            return {
                x: (global.x / this.app.canvas.width) * bounds.width + bounds.left,
                y: (global.y / this.app.canvas.height) * bounds.height + bounds.top
            };
        },

        // 描画用座標変換（レイヤー変形を考慮しない canonical座標）
        screenToCanvasForDrawing: function(screenX, screenY) {
            const globalPoint = { x: screenX, y: screenY };
            return this.canvasContainer.toLocal(globalPoint);
        },

        // レイヤー操作用座標変換
        screenToCanvas: function(screenX, screenY) {
            const globalPoint = { x: screenX, y: screenY };
            return this.canvasContainer.toLocal(globalPoint);
        },

        // キャンバス→スクリーン座標変換
        canvasToScreen: function(canvasX, canvasY) {
            const canvasPoint = { x: canvasX, y: canvasY };
            return this.canvasContainer.toGlobal(canvasPoint);
        },

        // 拡張キャンバス領域判定
        isPointInExtendedCanvas: function(canvasPoint, margin = 50) {
            return canvasPoint.x >= -margin && canvasPoint.x <= this.CONFIG.canvas.width + margin &&
                   canvasPoint.y >= -margin && canvasPoint.y <= this.CONFIG.canvas.height + margin;
        },

        // パン操作（プログラム制御用）
        panTo: function(x, y) {
            this.worldContainer.position.set(x, y);
            this.updateTransformDisplay();
            
            // EventBus通知
            window.Tegaki.EventBus.emit('camera:panned', { x, y });
        },

        // ズーム操作（プログラム制御用）
        zoomTo: function(scale, centerPoint) {
            if (scale < this.CONFIG.camera.minScale || scale > this.CONFIG.camera.maxScale) {
                return;
            }
            
            const center = centerPoint || { x: this.CONFIG.canvas.width / 2, y: this.CONFIG.canvas.height / 2 };
            const worldCenter = this.worldContainer.toGlobal(center);
            
            this.worldContainer.scale.set(scale);
            
            const newWorldCenter = this.worldContainer.toGlobal(center);
            this.worldContainer.x += worldCenter.x - newWorldCenter.x;
            this.worldContainer.y += worldCenter.y - newWorldCenter.y;
            
            this.updateTransformDisplay();
            
            // EventBus通知
            window.Tegaki.EventBus.emit('camera:zoomed', { scale, centerPoint: center });
        },

        // ビューリセット
        resetView: function() {
            this.worldContainer.position.set(
                this.initialState.position.x,
                this.initialState.position.y
            );
            this.worldContainer.scale.set(this.initialState.scale);
            this.worldContainer.rotation = 0;
            
            this.rotation = 0;
            this.horizontalFlipped = false;
            this.verticalFlipped = false;
            
            this.updateTransformDisplay();
            
            // EventBus通知
            window.Tegaki.EventBus.emit('camera:reset', {});
        },

        // ツール切り替え（phase1b4互換）
        switchTool: function(tool) {
            if (this.drawingEngine) {
                this.drawingEngine.setTool(tool);
            }
            
            // レイヤー移動モードを終了
            if (this.layerSystem && this.layerSystem.isLayerMoveMode) {
                this.layerSystem.exitLayerMoveMode();
            }
            
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
        },

        // イベント設定
        setupEvents: function() {
            this.app.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
            
            // マウス操作
            this.app.canvas.addEventListener('pointerdown', (e) => {
                if (this.vKeyPressed) return; // レイヤー操作中は無視
                
                if ((e.button === 2 || this.spacePressed) && !this.shiftPressed) {
                    // Space + ドラッグ: 移動
                    this.isDragging = true;
                    this.lastPoint = { x: e.clientX, y: e.clientY };
                    this.app.canvas.style.cursor = 'move';
                    e.preventDefault();
                } else if ((e.button === 2 || this.spacePressed) && this.shiftPressed) {
                    // Shift + Space + ドラッグ: 拡縮・回転
                    this.isScaleRotateDragging = true;
                    this.lastPoint = { x: e.clientX, y: e.clientY };
                    this.app.canvas.style.cursor = 'grab';
                    e.preventDefault();
                }
            });
            
            this.app.canvas.addEventListener('pointermove', (e) => {
                if (this.isDragging) {
                    this.handlePanDrag(e);
                } else if (this.isScaleRotateDragging) {
                    this.handleScaleRotateDrag(e);
                }
                
                // 座標表示更新（常に実行）
                const rect = this.app.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                this.updateCoordinates(x, y);
            });
            
            this.app.canvas.addEventListener('pointerup', (e) => {
                if (this.isDragging && (e.button === 2 || this.spacePressed)) {
                    this.isDragging = false;
                    this.updateCursor();
                }
                if (this.isScaleRotateDragging && (e.button === 2 || this.spacePressed)) {
                    this.isScaleRotateDragging = false;
                    this.updateCursor();
                }
                
                // 左クリック終了時：描画終了
                if (e.button === 0 && this.drawingEngine) {
                    this.drawingEngine.stopDrawing();
                }
            });

            this.app.canvas.addEventListener('pointerenter', () => {
                this.updateCursor();
            });

            // キーボード操作
            this.setupKeyboardEvents();
            
            // ホイール操作
            this.app.canvas.addEventListener('wheel', (e) => {
                e.preventDefault();
                if (this.vKeyPressed) return; // レイヤー操作中は無視
                
                this.handleWheelZoom(e);
            });
        },

        // パンドラッグ処理
        handlePanDrag: function(e) {
            const dx = (e.clientX - this.lastPoint.x) * this.panSpeed;
            const dy = (e.clientY - this.lastPoint.y) * this.panSpeed;
            
            this.worldContainer.x += dx;
            this.worldContainer.y += dy;
            
            this.lastPoint = { x: e.clientX, y: e.clientY };
            this.updateTransformDisplay();
        },

        // 拡縮・回転ドラッグ処理
        handleScaleRotateDrag: function(e) {
            const dx = e.clientX - this.lastPoint.x;
            const dy = e.clientY - this.lastPoint.y;
            
            const centerX = this.CONFIG.canvas.width / 2;
            const centerY = this.CONFIG.canvas.height / 2;
            const worldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
            
            if (Math.abs(dx) > Math.abs(dy)) {
                // 水平方向優先: 回転
                this.rotation += (dx * this.CONFIG.camera.dragRotationSpeed);
                this.worldContainer.rotation = (this.rotation * Math.PI) / 180;
                
                const newWorldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                this.worldContainer.x += worldCenter.x - newWorldCenter.x;
                this.worldContainer.y += worldCenter.y - newWorldCenter.y;
            } else {
                // 垂直方向優先: 拡縮
                const scaleFactor = 1 + (dy * this.CONFIG.camera.dragScaleSpeed);
                const newScale = this.worldContainer.scale.x * scaleFactor;
                
                if (newScale >= this.CONFIG.camera.minScale && newScale <= this.CONFIG.camera.maxScale) {
                    this.worldContainer.scale.set(newScale);
                    const newWorldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                    this.worldContainer.x += worldCenter.x - newWorldCenter.x;
                    this.worldContainer.y += worldCenter.y - newWorldCenter.y;
                }
            }
            
            this.lastPoint = { x: e.clientX, y: e.clientY };
            this.updateTransformDisplay();
        },

        // ホイールズーム処理
        handleWheelZoom: function(e) {
            const centerX = this.CONFIG.canvas.width / 2;
            const centerY = this.CONFIG.canvas.height / 2;
            
            if (this.shiftPressed) {
                // Shift + ホイール: 回転
                const rotationDelta = e.deltaY < 0 ? 
                    this.CONFIG.camera.keyRotationDegree : -this.CONFIG.camera.keyRotationDegree;
                
                const worldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                
                this.rotation += rotationDelta;
                this.worldContainer.rotation = (this.rotation * Math.PI) / 180;
                
                const newWorldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                this.worldContainer.x += worldCenter.x - newWorldCenter.x;
                this.worldContainer.y += worldCenter.y - newWorldCenter.y;
            } else {
                // ホイール: 拡縮
                const scaleFactor = e.deltaY < 0 ? 1 + this.zoomSpeed : 1 - this.zoomSpeed;
                const newScale = this.worldContainer.scale.x * scaleFactor;
                
                if (newScale >= this.CONFIG.camera.minScale && newScale <= this.CONFIG.camera.maxScale) {
                    const worldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                    
                    this.worldContainer.scale.set(newScale);
                    
                    const newWorldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                    this.worldContainer.x += worldCenter.x - newWorldCenter.x;
                    this.worldContainer.y += worldCenter.y - newWorldCenter.y;
                }
            }
            
            this.updateTransformDisplay();
        },

        // キーボードイベント
        setupKeyboardEvents: function() {
            document.addEventListener('keydown', (e) => {
                // Ctrl+0: キャンバスリセット
                if (e.ctrlKey && e.code === 'Digit0') {
                    this.resetView();
                    e.preventDefault();
                    return;
                }
                
                // キー状態更新
                if (e.code === 'Space') {
                    this.spacePressed = true;
                    this.updateCursor();
                    e.preventDefault();
                }
                if (e.shiftKey) this.shiftPressed = true;
                
                // レイヤー操作中は以下の処理をしない
                if (this.vKeyPressed) return;
                
                // カメラ操作キー（Space + 方向キー）
                this.handleCameraKeys(e);
            });
            
            document.addEventListener('keyup', (e) => {
                if (e.code === 'Space') {
                    this.spacePressed = false;
                    this.updateCursor();
                }
                if (!e.shiftKey) this.shiftPressed = false;
            });
        },

        // カメラ操作キー処理
        handleCameraKeys: function(e) {
            // === キャンバス移動: Space + 方向キー ===
            if (this.spacePressed && !this.shiftPressed && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                const moveAmount = this.CONFIG.camera.keyMoveAmount;
                switch(e.code) {
                    case 'ArrowDown':  this.worldContainer.y += moveAmount; break;
                    case 'ArrowUp':    this.worldContainer.y -= moveAmount; break;
                    case 'ArrowRight': this.worldContainer.x += moveAmount; break;
                    case 'ArrowLeft':  this.worldContainer.x -= moveAmount; break;
                }
                this.updateTransformDisplay();
                e.preventDefault();
            }
            
            // === キャンバス拡縮・回転: Shift + Space + 方向キー ===
            if (this.spacePressed && this.shiftPressed && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                const centerX = this.CONFIG.canvas.width / 2;
                const centerY = this.CONFIG.canvas.height / 2;
                const worldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                
                switch(e.code) {
                    case 'ArrowUp':
                        const scaleUpFactor = 1 + this.CONFIG.camera.wheelZoomSpeed;
                        const newScaleUp = this.worldContainer.scale.x * scaleUpFactor;
                        if (newScaleUp <= this.CONFIG.camera.maxScale) {
                            this.worldContainer.scale.set(newScaleUp);
                            const newWorldCenterUp = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                            this.worldContainer.x += worldCenter.x - newWorldCenterUp.x;
                            this.worldContainer.y += worldCenter.y - newWorldCenterUp.y;
                        }
                        break;
                        
                    case 'ArrowDown':
                        const scaleDownFactor = 1 - this.CONFIG.camera.wheelZoomSpeed;
                        const newScaleDown = this.worldContainer.scale.x * scaleDownFactor;
                        if (newScaleDown >= this.CONFIG.camera.minScale) {
                            this.worldContainer.scale.set(newScaleDown);
                            const newWorldCenterDown = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                            this.worldContainer.x += worldCenter.x - newWorldCenterDown.x;
                            this.worldContainer.y += worldCenter.y - newWorldCenterDown.y;
                        }
                        break;
                        
                    case 'ArrowLeft':
                        this.rotation -= this.CONFIG.camera.keyRotationDegree;
                        this.worldContainer.rotation = (this.rotation * Math.PI) / 180;
                        const newWorldCenterLeft = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                        this.worldContainer.x += worldCenter.x - newWorldCenterLeft.x;
                        this.worldContainer.y += worldCenter.y - newWorldCenterLeft.y;
                        break;
                        
                    case 'ArrowRight':
                        this.rotation += this.CONFIG.camera.keyRotationDegree;
                        this.worldContainer.rotation = (this.rotation * Math.PI) / 180;
                        const newWorldCenterRight = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                        this.worldContainer.x += worldCenter.x - newWorldCenterRight.x;
                        this.worldContainer.y += worldCenter.y - newWorldCenterRight.y;
                        break;
                }
                
                this.updateTransformDisplay();
                e.preventDefault();
            }
            
            // === キャンバス反転: H / Shift+H（レイヤー操作中以外） ===
            if (!this.vKeyPressed && e.code === 'KeyH' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                this.handleCanvasFlip(e);
                e.preventDefault();
            }
        },

        // キャンバス反転処理
        handleCanvasFlip: function(e) {
            const centerX = this.CONFIG.canvas.width / 2;
            const centerY = this.CONFIG.canvas.height / 2;
            const worldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
            
            if (e.shiftKey) {
                // Shift+H: 垂直反転
                this.verticalFlipped = !this.verticalFlipped;
                this.worldContainer.scale.y *= -1;
            } else {
                // H: 水平反転
                this.horizontalFlipped = !this.horizontalFlipped;
                this.worldContainer.scale.x *= -1;
            }
            
            const newWorldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
            this.worldContainer.x += worldCenter.x - newWorldCenter.x;
            this.worldContainer.y += worldCenter.y - newWorldCenter.y;
            
            this.updateTransformDisplay();
            
            // EventBus通知
            window.Tegaki.EventBus.emit('camera:flipped', {
                horizontal: this.horizontalFlipped,
                vertical: this.verticalFlipped
            });
        },

        // カーソル更新
        updateCursor: function() {
            if (this.layerSystem && this.layerSystem.vKeyPressed) {
                // レイヤー操作中はLayerSystemが制御
                return;
            }
            
            if (this.vKeyPressed) {
                // レイヤー操作中
                this.app.canvas.style.cursor = 'grab';
            } else if (this.isDragging || (this.spacePressed && !this.shiftPressed)) {
                this.app.canvas.style.cursor = 'move';
            } else if (this.isScaleRotateDragging || (this.spacePressed && this.shiftPressed)) {
                this.app.canvas.style.cursor = 'grab';
            } else {
                const tool = this.drawingEngine ? this.drawingEngine.currentTool : 'pen';
                this.app.canvas.style.cursor = tool === 'eraser' ? 'cell' : 'crosshair';
            }
        },

        // ガイドライン表示・非表示
        showGuideLines: function() {
            this.guideLines.visible = true;
            console.log('CameraSystem: Guide lines shown');
        },

        hideGuideLines: function() {
            this.guideLines.visible = false;
            console.log('CameraSystem: Guide lines hidden');
        },

        // キャンバスリサイズ対応（完全版）
        resizeCanvas: function(newWidth, newHeight) {
            console.log('CameraSystem: Resizing canvas from', this.CONFIG.canvas.width, 'x', this.CONFIG.canvas.height, 'to', newWidth, 'x', newHeight);
            
            // CONFIG更新
            this.CONFIG.canvas.width = newWidth;
            this.CONFIG.canvas.height = newHeight;
            
            // カメラフレーム、マスク、ガイドライン更新
            this.createGuideLines();
            this.drawCameraFrame();
            
            // マスク更新
            this.canvasMask.clear();
            this.canvasMask.rect(0, 0, newWidth, newHeight);
            this.canvasMask.fill(0xffffff);
            
            console.log('CameraSystem: Canvas resize completed');
        },

        // カメラフレーム描画
        drawCameraFrame: function() {
            this.cameraFrame.clear();
            this.cameraFrame.rect(0, 0, this.CONFIG.canvas.width, this.CONFIG.canvas.height);
            this.cameraFrame.stroke({ width: 2, color: 0xff0000, alpha: 0.5 });
        },

        // 座標・変形情報更新
        updateCoordinates: function(screenX, screenY) {
            const canvasPoint = this.screenToCanvasForDrawing(screenX, screenY);
            const element = document.getElementById('coordinates');
            if (element) {
                element.textContent = `x: ${Math.round(canvasPoint.x)}, y: ${Math.round(canvasPoint.y)}`;
            }
        },

        updateTransformDisplay: function() {
            const element = document.getElementById('transform-info');
            if (element) {
                const x = Math.round(this.worldContainer.x);
                const y = Math.round(this.worldContainer.y);
                const s = Math.abs(this.worldContainer.scale.x).toFixed(2);
                const r = Math.round(this.rotation % 360);
                element.textContent = `x:${x} y:${y} s:${s} r:${r}°`;
            }
        },

        // カメラフレーム中央の絶対座標を取得
        getCameraFrameCenter: function() {
            const centerX = this.CONFIG.canvas.width / 2;
            const centerY = this.CONFIG.canvas.height / 2;
            return this.worldContainer.toGlobal({ x: centerX, y: centerY });
        },

        // 外部システム参照設定
        setLayerSystem: function(layerSystem) {
            this.layerSystem = layerSystem;
        },

        setDrawingEngine: function(drawingEngine) {
            this.drawingEngine = drawingEngine;
        },

        setVKeyPressed: function(pressed) {
            this.vKeyPressed = pressed;
            this.updateCursor();
        },

        // 変形データ取得（デバッグ・外部アクセス用）
        getTransform: function() {
            return {
                x: this.worldContainer.x,
                y: this.worldContainer.y,
                scale: this.worldContainer.scale.x,
                rotation: this.rotation,
                horizontalFlipped: this.horizontalFlipped,
                verticalFlipped: this.verticalFlipped
            };
        },

        // ビューポート情報取得
        getViewport: function() {
            return {
                width: this.app.screen.width,
                height: this.app.screen.height,
                canvasWidth: this.CONFIG.canvas.width,
                canvasHeight: this.CONFIG.canvas.height,
                worldPosition: { x: this.worldContainer.x, y: this.worldContainer.y },
                worldScale: this.worldContainer.scale.x,
                worldRotation: this.worldContainer.rotation
            };
        }
    };

    // グローバル登録
    window.TegakiSystems.Register('CameraSystem', CameraSystem);

})();