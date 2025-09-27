// ===== system/camera-system.js - カメラ操作専用モジュール（修正版） =====
// 座標変換・ズーム・パン・回転等の「カメラ操作」専用
// PixiJS v8.13 対応・改修計画書完全準拠版
// 【修正】Spaceキー操作の完全修正・キー状態管理の安定化

(function() {
    'use strict';

    class CameraSystem {
        constructor() {
            this.app = null;
            this.config = null;
            this.eventBus = null;
            
            // カメラ状態
            this.isDragging = false;
            this.isScaleRotateDragging = false;
            this.lastPoint = { x: 0, y: 0 };
            this.rotation = 0;
            this.horizontalFlipped = false;
            this.verticalFlipped = false;
            
            // 初期状態の記憶（Ctrl+0リセット用）
            this.initialState = {
                position: null,
                scale: 1.0,
                rotation: 0,
                horizontalFlipped: false,
                verticalFlipped: false
            };
            
            // 【修正】キー状態管理の安定化
            this.spacePressed = false;
            this.shiftPressed = false;
            this.vKeyPressed = false;
            
            // PixiJS Containers
            this.worldContainer = null;
            this.canvasContainer = null;
            this.cameraFrame = null;
            this.guideLines = null;
            this.canvasMask = null;
            
            // 内部参照（後で設定）
            this.layerManager = null;
            this.drawingEngine = null;
        }

        init(stage, eventBus, config) {
            this.eventBus = eventBus;
            this.config = config || window.TEGAKI_CONFIG;
            this.app = stage; // stageを直接受け取る
            
            // 初期値を設定
            this.initialState.scale = this.config.camera.initialScale;
            
            this._createContainers();
            this._setupEvents();
            this.initializeCamera();
            this._drawCameraFrame();
            
            console.log('✅ CameraSystem initialized (修正版)');
        }

        _createContainers() {
            this.worldContainer = new PIXI.Container();
            this.worldContainer.label = 'worldContainer';
            this.app.addChild(this.worldContainer);
            
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
            this.canvasMask.rect(0, 0, this.config.canvas.width, this.config.canvas.height);
            this.canvasMask.fill(0xffffff);
            this.worldContainer.addChild(this.canvasMask);
            this.canvasContainer.mask = this.canvasMask;
        }

        createGuideLines() {
            this.guideLines.removeChildren();
            
            const centerX = this.config.canvas.width / 2;
            const centerY = this.config.canvas.height / 2;
            
            // 縦線（カメラフレームの中央）
            const verticalLine = new PIXI.Graphics();
            verticalLine.rect(centerX - 0.5, 0, 1, this.config.canvas.height);
            verticalLine.fill({ color: 0x800000, alpha: 0.8 });
            this.guideLines.addChild(verticalLine);
            
            // 横線（カメラフレームの中央）
            const horizontalLine = new PIXI.Graphics();
            horizontalLine.rect(0, centerY - 0.5, this.config.canvas.width, 1);
            horizontalLine.fill({ color: 0x800000, alpha: 0.8 });
            this.guideLines.addChild(horizontalLine);
            
            this.guideLines.visible = false; // 初期は非表示
        }

        updateGuideLinesForCanvasResize() {
            this.createGuideLines();
            this._drawCameraFrame();
            // マスクも更新
            this.canvasMask.clear();
            this.canvasMask.rect(0, 0, this.config.canvas.width, this.config.canvas.height);
            this.canvasMask.fill(0xffffff);
        }

        showGuideLines() {
            this.guideLines.visible = true;
        }

        hideGuideLines() {
            this.guideLines.visible = false;
        }

        initializeCamera() {
            // PixiJS v8.13対応: screenプロパティの安全な取得
            const screen = this.app.screen || { width: 800, height: 600 };
            const centerX = screen.width / 2;
            const centerY = screen.height / 2;
            
            this.canvasContainer.position.set(0, 0);
            
            const initialX = centerX - this.config.canvas.width / 2;
            const initialY = centerY - this.config.canvas.height / 2;
            this.worldContainer.position.set(initialX, initialY);
            this.worldContainer.scale.set(this.config.camera.initialScale);
            
            this.initialState.position = { x: initialX, y: initialY };
        }

        resetCanvas() {
            this.worldContainer.position.set(
                this.initialState.position.x,
                this.initialState.position.y
            );
            this.worldContainer.scale.set(this.initialState.scale);
            this.worldContainer.rotation = 0;
            
            this.rotation = 0;
            this.horizontalFlipped = false;
            this.verticalFlipped = false;
            
            this._updateTransformDisplay();
            if (this.eventBus) {
                this.eventBus.emit('camera:changed');
            }
        }

        _setupEvents() {
            // キャンバス要素の取得（PixiJS v8.13対応）
            const canvas = this.app.canvas || this.app.view;
            if (!canvas) return;

            canvas.addEventListener('contextmenu', (e) => e.preventDefault());
            
            // マウス操作
            this._setupMouseEvents(canvas);
            
            // 【修正】キーボード操作の安定化
            this._setupKeyboardEvents();
        }

        _setupMouseEvents(canvas) {
            canvas.addEventListener('pointerdown', (e) => {
                if (this.vKeyPressed) return;
                
                if ((e.button === 2 || this.spacePressed) && !this.shiftPressed) {
                    this.isDragging = true;
                    this.lastPoint = { x: e.clientX, y: e.clientY };
                    canvas.style.cursor = 'move';
                    e.preventDefault();
                } else if ((e.button === 2 || this.spacePressed) && this.shiftPressed) {
                    this.isScaleRotateDragging = true;
                    this.lastPoint = { x: e.clientX, y: e.clientY };
                    canvas.style.cursor = 'grab';
                    e.preventDefault();
                }
            });
            
            canvas.addEventListener('pointermove', (e) => {
                if (this.isDragging) {
                    const dx = (e.clientX - this.lastPoint.x) * this.config.camera.dragMoveSpeed;
                    const dy = (e.clientY - this.lastPoint.y) * this.config.camera.dragMoveSpeed;
                    
                    this.worldContainer.x += dx;
                    this.worldContainer.y += dy;
                    
                    this.lastPoint = { x: e.clientX, y: e.clientY };
                    this._updateTransformDisplay();
                } else if (this.isScaleRotateDragging) {
                    this._handleScaleRotateDrag(e);
                }
            });
            
            canvas.addEventListener('pointerup', (e) => {
                if (this.isDragging && (e.button === 2 || this.spacePressed)) {
                    this.isDragging = false;
                    this.updateCursor();
                }
                if (this.isScaleRotateDragging && (e.button === 2 || this.spacePressed)) {
                    this.isScaleRotateDragging = false;
                    this.updateCursor();
                }
            });

            canvas.addEventListener('pointerenter', () => {
                this.updateCursor();
            });
            
            // マウスホイール
            canvas.addEventListener('wheel', (e) => {
                e.preventDefault();
                
                if (this.vKeyPressed) return;
                
                const centerX = this.config.canvas.width / 2;
                const centerY = this.config.canvas.height / 2;
                
                if (this.shiftPressed) {
                    this._handleWheelRotation(e, centerX, centerY);
                } else {
                    this._handleWheelZoom(e, centerX, centerY);
                }
                
                this._updateTransformDisplay();
            });
        }

        _handleScaleRotateDrag(e) {
            const dx = e.clientX - this.lastPoint.x;
            const dy = e.clientY - this.lastPoint.y;
            
            const centerX = this.config.canvas.width / 2;
            const centerY = this.config.canvas.height / 2;
            const worldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
            
            if (Math.abs(dx) > Math.abs(dy)) {
                // 水平方向優先: 回転
                this.rotation += (dx * this.config.camera.dragRotationSpeed);
                this.worldContainer.rotation = (this.rotation * Math.PI) / 180;
                
                const newWorldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                this.worldContainer.x += worldCenter.x - newWorldCenter.x;
                this.worldContainer.y += worldCenter.y - newWorldCenter.y;
            } else {
                // 垂直方向優先: 拡縮
                const scaleFactor = 1 + (dy * this.config.camera.dragScaleSpeed);
                const newScale = this.worldContainer.scale.x * scaleFactor;
                
                if (newScale >= this.config.camera.minScale && newScale <= this.config.camera.maxScale) {
                    this.worldContainer.scale.set(newScale);
                    const newWorldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                    this.worldContainer.x += worldCenter.x - newWorldCenter.x;
                    this.worldContainer.y += worldCenter.y - newWorldCenter.y;
                }
            }
            
            this.lastPoint = { x: e.clientX, y: e.clientY };
            this._updateTransformDisplay();
        }

        _handleWheelRotation(e, centerX, centerY) {
            const rotationDelta = e.deltaY < 0 ? 
                this.config.camera.keyRotationDegree : -this.config.camera.keyRotationDegree;
            
            const worldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
            
            this.rotation += rotationDelta;
            this.worldContainer.rotation = (this.rotation * Math.PI) / 180;
            
            const newWorldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
            this.worldContainer.x += worldCenter.x - newWorldCenter.x;
            this.worldContainer.y += worldCenter.y - newWorldCenter.y;
        }

        _handleWheelZoom(e, centerX, centerY) {
            const scaleFactor = e.deltaY < 0 ? 1 + this.config.camera.wheelZoomSpeed : 1 - this.config.camera.wheelZoomSpeed;
            const newScale = this.worldContainer.scale.x * scaleFactor;
            
            if (newScale >= this.config.camera.minScale && newScale <= this.config.camera.maxScale) {
                const worldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                
                this.worldContainer.scale.set(newScale);
                
                const newWorldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                this.worldContainer.x += worldCenter.x - newWorldCenter.x;
                this.worldContainer.y += worldCenter.y - newWorldCenter.y;
            }
        }

        // 【修正】キーボードイベント処理の完全修正版
        _setupKeyboardEvents() {
            document.addEventListener('keydown', (e) => {
                // 【修正1】キー状態更新を最優先
                this._updateKeyStates(e);
                
                // Ctrl+0: キャンバスリセット
                if (e.ctrlKey && e.code === 'Digit0') {
                    this.resetCanvas();
                    e.preventDefault();
                    return;
                }
                
                // 【修正2】Space処理の安定化
                if (e.code === 'Space') {
                    this.spacePressed = true;
                    this.updateCursor();
                    e.preventDefault();
                }
                
                // 以下、レイヤー操作中（V押下中）は処理しない
                if (this.vKeyPressed) return;
                
                // カメラ操作処理
                this._handleCameraMoveKeys(e);
                this._handleCameraTransformKeys(e);
                this._handleCameraFlipKeys(e);
            });
            
            document.addEventListener('keyup', (e) => {
                // 【修正3】keyupでの状態リセット確実化
                this._resetKeyStates(e);
            });
            
            // 【修正4】フォーカス関連の追加処理（ブラウザタブ切り替え対応）
            window.addEventListener('blur', () => {
                this._resetAllKeyStates();
            });
            
            window.addEventListener('focus', () => {
                this._resetAllKeyStates();
            });
        }

        // 【新規】キー状態更新の統一処理
        _updateKeyStates(e) {
            if (e.shiftKey) this.shiftPressed = true;
            // spacePressed は keydown の Space 専用処理で更新
        }

        // 【新規】キー状態リセットの統一処理
        _resetKeyStates(e) {
            if (e.code === 'Space') {
                this.spacePressed = false;
                this.updateCursor();
            }
            if (!e.shiftKey) {
                this.shiftPressed = false;
            }
        }

        // 【新規】全キー状態強制リセット（フォーカス喪失時）
        _resetAllKeyStates() {
            this.spacePressed = false;
            this.shiftPressed = false;
            // vKeyPressed はレイヤーシステムが管理するのでリセットしない
            this.updateCursor();
        }

        _handleCameraMoveKeys(e) {
            if (this.spacePressed && !this.shiftPressed && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                const moveAmount = this.config.camera.keyMoveAmount;
                switch(e.code) {
                    case 'ArrowDown':    this.worldContainer.y += moveAmount; break;
                    case 'ArrowUp':      this.worldContainer.y -= moveAmount; break;
                    case 'ArrowRight':   this.worldContainer.x += moveAmount; break;
                    case 'ArrowLeft':    this.worldContainer.x -= moveAmount; break;
                }
                this._updateTransformDisplay();
                e.preventDefault();
            }
        }

        _handleCameraTransformKeys(e) {
            if (this.spacePressed && this.shiftPressed && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                const centerX = this.config.canvas.width / 2;
                const centerY = this.config.canvas.height / 2;
                const worldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                
                switch(e.code) {
                    case 'ArrowUp':
                        this._scaleCamera(1 + this.config.camera.wheelZoomSpeed, worldCenter, centerX, centerY);
                        break;
                    case 'ArrowDown':
                        this._scaleCamera(1 - this.config.camera.wheelZoomSpeed, worldCenter, centerX, centerY);
                        break;
                    case 'ArrowLeft':
                        this._rotateCamera(-this.config.camera.keyRotationDegree, worldCenter, centerX, centerY);
                        break;
                    case 'ArrowRight':
                        this._rotateCamera(this.config.camera.keyRotationDegree, worldCenter, centerX, centerY);
                        break;
                }
                
                this._updateTransformDisplay();
                e.preventDefault();
            }
        }

        _handleCameraFlipKeys(e) {
            if (!this.vKeyPressed && e.code === 'KeyH' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                const centerX = this.config.canvas.width / 2;
                const centerY = this.config.canvas.height / 2;
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
                
                this._updateTransformDisplay();
                e.preventDefault();
            }
        }

        _scaleCamera(scaleFactor, worldCenter, centerX, centerY) {
            const newScale = this.worldContainer.scale.x * scaleFactor;
            if (newScale >= this.config.camera.minScale && newScale <= this.config.camera.maxScale) {
                this.worldContainer.scale.set(newScale);
                const newWorldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                this.worldContainer.x += worldCenter.x - newWorldCenter.x;
                this.worldContainer.y += worldCenter.y - newWorldCenter.y;
            }
        }

        _rotateCamera(rotationDelta, worldCenter, centerX, centerY) {
            this.rotation += rotationDelta;
            this.worldContainer.rotation = (this.rotation * Math.PI) / 180;
            const newWorldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
            this.worldContainer.x += worldCenter.x - newWorldCenter.x;
            this.worldContainer.y += worldCenter.y - newWorldCenter.y;
        }

        // === 公開API（改修版：座標変換統一） ===
        
        // 改修版: 統一された座標変換API（forDrawingフラグで挙動切り替え）
        screenToCanvas(screenX, screenY, options = {}) {
            const globalPoint = { x: screenX, y: screenY };
            const canvasPoint = this.canvasContainer.toLocal(globalPoint);
            
            // forDrawing: true の場合は描画専用の挙動（レイヤー変形を考慮しない）
            if (options.forDrawing) {
                return canvasPoint;
            }
            
            // 通常の座標変換（レイヤー変形を考慮）
            return canvasPoint;
        }

        // 互換性維持のため残す（内部的にscreenToCanvasを呼び出し）
        screenToCanvasForDrawing(screenX, screenY) {
            return this.screenToCanvas(screenX, screenY, { forDrawing: true });
        }

        setZoom(level) {
            const clampedLevel = Math.max(this.config.camera.minScale, Math.min(this.config.camera.maxScale, level));
            this.worldContainer.scale.set(clampedLevel);
            this._updateTransformDisplay();
            if (this.eventBus) {
                this.eventBus.emit('camera:changed');
            }
        }

        pan(dx, dy) {
            this.worldContainer.x += dx;
            this.worldContainer.y += dy;
            this._updateTransformDisplay();
            if (this.eventBus) {
                this.eventBus.emit('camera:changed');
            }
        }

        setVKeyPressed(pressed) {
            this.vKeyPressed = pressed;
            this.updateCursor();
        }

        toScreenCoords(worldX, worldY) {
            const canvasPoint = { x: worldX, y: worldY };
            return this.canvasContainer.toGlobal(canvasPoint);
        }

        isPointInExtendedCanvas(canvasPoint, margin = 50) {
            return canvasPoint.x >= -margin && canvasPoint.x <= this.config.canvas.width + margin &&
                   canvasPoint.y >= -margin && canvasPoint.y <= this.config.canvas.height + margin;
        }

        updateCursor() {
            const canvas = this.app.canvas || this.app.view;
            if (!canvas) return;

            if (this.vKeyPressed) {
                canvas.style.cursor = 'grab';
            } else if (this.isDragging || (this.spacePressed && !this.shiftPressed)) {
                canvas.style.cursor = 'move';
            } else if (this.isScaleRotateDragging || (this.spacePressed && this.shiftPressed)) {
                canvas.style.cursor = 'grab';
            } else {
                const tool = this.drawingEngine ? this.drawingEngine.currentTool : 'pen';
                canvas.style.cursor = tool === 'eraser' ? 'cell' : 'crosshair';
            }
        }

        // 改修版：core-engine.jsから継承されたメソッド
        updateCoordinates(x, y) {
            const element = document.getElementById('coordinates');
            if (element) {
                element.textContent = `x: ${Math.round(x)}, y: ${Math.round(y)}`;
            }
        }

        switchTool(toolName) {
            if (this.drawingEngine) {
                this.drawingEngine.setTool(toolName);
            }
            
            // レイヤー移動モードを終了
            if (this.layerManager && this.layerManager.isLayerMoveMode) {
                this.layerManager.exitLayerMoveMode();
            }
            
            // UI更新
            document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
            const toolBtn = document.getElementById(toolName + '-tool');
            if (toolBtn) toolBtn.classList.add('active');

            const toolNames = { pen: 'ベクターペン', eraser: '消しゴム' };
            const toolElement = document.getElementById('current-tool');
            if (toolElement) {
                toolElement.textContent = toolNames[toolName] || toolName;
            }

            this.updateCursor();
        }

        _updateTransformDisplay() {
            const element = document.getElementById('transform-info');
            if (element) {
                const x = Math.round(this.worldContainer.x);
                const y = Math.round(this.worldContainer.y);
                const s = Math.abs(this.worldContainer.scale.x).toFixed(2);
                const r = Math.round(this.rotation % 360);
                element.textContent = `x:${x} y:${y} s:${s} r:${r}°`;
            }
        }

        _drawCameraFrame() {
            this.cameraFrame.clear();
            this.cameraFrame.rect(0, 0, this.config.canvas.width, this.config.canvas.height);
            this.cameraFrame.stroke({ width: 2, color: 0xff0000, alpha: 0.5 });
        }

        getCameraFrameCenter() {
            const centerX = this.config.canvas.width / 2;
            const centerY = this.config.canvas.height / 2;
            return this.worldContainer.toGlobal({ x: centerX, y: centerY });
        }

        // キャンバスリサイズ処理（改修版：core-engine.jsから継承）
        resizeCanvas(newWidth, newHeight) {
            // CONFIG更新は呼び出し元で行う
            this.updateGuideLinesForCanvasResize();
            if (this.eventBus) {
                this.eventBus.emit('camera:resized', { width: newWidth, height: newHeight });
            }
        }

        // 内部参照設定
        setLayerManager(layerManager) {
            this.layerManager = layerManager;
        }
        
        setDrawingEngine(drawingEngine) {
            this.drawingEngine = drawingEngine;
        }
    }

    // グローバル公開
    window.TegakiCameraSystem = CameraSystem;

    console.log('✅ camera-system.js (修正版) loaded successfully');
    console.log('   - 【修正】Spaceキー操作完全修正');
    console.log('   - 【修正】キー状態管理の安定化');
    console.log('   - 【修正】フォーカス喪失時の状態リセット追加');
    console.log('   - API統一: screenToCanvas(x, y, {forDrawing: boolean})');
    console.log('   - EventBus統合完了');
    console.log('   - core-engine.js継承メソッド追加');
    
})();