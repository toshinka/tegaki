// ===== systems/camera-system.js - カメラ操作システム =====
// パン・ズーム・座標変換・ガイドライン表示を統合管理
// PixiJS v8.13準拠

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
            
            // コンテナ作成
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
            
            console.log('CameraSystem: Initialized successfully');
        },

        // ガイドライン作成
        createGuideLines: function() {
            this.guideLines.removeChildren();
            
            const centerX = this.CONFIG.canvas.width / 2;
            const centerY = this.CONFIG.canvas.height / 2;
            
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

        // パン操作
        panTo: function(x, y) {
            this.worldContainer.position.set(x, y);
            this.updateTransformDisplay();
        },

        // ズーム操作
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
        },

        // 座標変換：スクリーン→ワールド
        screenToWorld: function(screenPoint) {
            const bounds = this.app.canvas.getBoundingClientRect();
            const x = (screenPoint.x - bounds.left) * (this.app.canvas.width / bounds.width);
            const y = (screenPoint.y - bounds.top) * (this.app.canvas.height / bounds.height);
            
            // PixiJS v8.13: toLocal使用
            return this.app.stage.toLocal({ x, y }, this.app.renderer.events.rootBoundary);
        },

        // 座標変換：ワールド→スクリーン
        worldToScreen: function(worldPoint) {
            return this.app.stage.toGlobal(worldPoint);
        },

        // 描画用座標変換（レイヤー変形を考慮しない）
        screenToCanvasForDrawing: function(screenX, screenY) {
            const globalPoint = { x: screenX, y: screenY };
            return this.canvasContainer.toLocal(globalPoint);
        },

        // イベント設定
        setupEvents: function() {
            this.app.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
            
            // マウス操作
            this.app.canvas.addEventListener('pointerdown', (e) => {
                if (this.vKeyPressed) return;
                
                if ((e.button === 2 || this.spacePressed) && !this.shiftPressed) {
                    this.isDragging = true;
                    this.lastPoint = { x: e.clientX, y: e.clientY };
                    this.app.canvas.style.cursor = 'move';
                    e.preventDefault();
                } else if ((e.button === 2 || this.spacePressed) && this.shiftPressed) {
                    this.isScaleRotateDragging = true;
                    this.lastPoint = { x: e.clientX, y: e.clientY };
                    this.app.canvas.style.cursor = 'grab';
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
                } else if (this.isScaleRotateDragging) {
                    this.handleScaleRotateDrag(e);
                }
                
                this.updateCoordinates(e.clientX, e.clientY);
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
                
                if (e.button !== 0) return;
                if (this.drawingEngine) {
                    this.drawingEngine.stopDrawing();
                }
            });

            // キーボード操作
            this.setupKeyboardEvents();
            
            // ホイール操作
            this.app.canvas.addEventListener('wheel', (e) => {
                e.preventDefault();
                if (this.vKeyPressed) return;
                
                this.handleWheelZoom(e);
            });
        },

        // 拡縮・回転ドラッグ処理
        handleScaleRotateDrag: function(e) {
            const dx = e.clientX - this.lastPoint.x;
            const dy = e.clientY - this.lastPoint.y;
            
            const centerX = this.CONFIG.canvas.width / 2;
            const centerY = this.CONFIG.canvas.height / 2;
            const worldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
            
            if (Math.abs(dx) > Math.abs(dy)) {
                // 回転
                this.rotation += (dx * this.CONFIG.camera.dragRotationSpeed);
                this.worldContainer.rotation = (this.rotation * Math.PI) / 180;
                
                const newWorldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                this.worldContainer.x += worldCenter.x - newWorldCenter.x;
                this.worldContainer.y += worldCenter.y - newWorldCenter.y;
            } else {
                // 拡縮
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
                // 回転
                const rotationDelta = e.deltaY < 0 ? 
                    this.CONFIG.camera.keyRotationDegree : -this.CONFIG.camera.keyRotationDegree;
                
                const worldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                
                this.rotation += rotationDelta;
                this.worldContainer.rotation = (this.rotation * Math.PI) / 180;
                
                const newWorldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                this.worldContainer.x += worldCenter.x - newWorldCenter.x;
                this.worldContainer.y += worldCenter.y - newWorldCenter.y;
            } else {
                // 拡縮
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
                if (e.ctrlKey && e.code === 'Digit0') {
                    this.resetView();
                    e.preventDefault();
                    return;
                }
                
                if (e.code === 'Space') {
                    this.spacePressed = true;
                    this.updateCursor();
                    e.preventDefault();
                }
                if (e.shiftKey) this.shiftPressed = true;
                
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
            if (this.spacePressed && !this.shiftPressed && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                const moveAmount = this.CONFIG.camera.keyMoveAmount;
                switch(e.code) {
                    case 'ArrowDown': this.worldContainer.y += moveAmount; break;
                    case 'ArrowUp': this.worldContainer.y -= moveAmount; break;
                    case 'ArrowRight': this.worldContainer.x += moveAmount; break;
                    case 'ArrowLeft': this.worldContainer.x -= moveAmount; break;
                }
                this.updateTransformDisplay();
                e.preventDefault();
            }
            
            // キャンバス反転（H / Shift+H）
            if (e.code === 'KeyH' && !e.ctrlKey && !e.altKey && !e.metaKey) {
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
                this.verticalFlipped = !this.verticalFlipped;
                this.worldContainer.scale.y *= -1;
            } else {
                this.horizontalFlipped = !this.horizontalFlipped;
                this.worldContainer.scale.x *= -1;
            }
            
            const newWorldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
            this.worldContainer.x += worldCenter.x - newWorldCenter.x;
            this.worldContainer.y += worldCenter.y - newWorldCenter.y;
            
            this.updateTransformDisplay();
        },

        // カーソル更新
        updateCursor: function() {
            if (this.vKeyPressed) {
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
        },

        hideGuideLines: function() {
            this.guideLines.visible = false;
        },

        // キャンバスリサイズ対応
        resizeCanvas: function(newWidth, newHeight) {
            this.CONFIG.canvas.width = newWidth;
            this.CONFIG.canvas.height = newHeight;
            
            this.createGuideLines();
            this.drawCameraFrame();
            
            this.canvasMask.clear();
            this.canvasMask.rect(0, 0, newWidth, newHeight);
            this.canvasMask.fill(0xffffff);
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

        // 変形データ取得
        getTransform: function() {
            return {
                x: this.worldContainer.x,
                y: this.worldContainer.y,
                scale: this.worldContainer.scale.x,
                rotation: this.rotation
            };
        }
    };

    // グローバル登録
    window.TegakiSystems.Register('CameraSystem', CameraSystem);

})();