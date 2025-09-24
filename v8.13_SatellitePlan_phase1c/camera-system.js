// ===== camera-system.js - Phase2分離版：カメラシステム単独化 =====
// core-engine.jsから分離・座標変換API統一・PixiJS v8.13完全対応

/*
=== Phase2分離版 カメラシステム ===

【分離内容】
✅ core-engine.jsからCameraSystem完全分離
✅ 依存関係の明確化（CoordinateSystem経由）
✅ PixiJS v8.13 API完全対応
✅ レイヤー操作との境界明確化

【責務】
- カメラ移動・拡縮・回転制御
- ビューポート管理
- キャンバスフレーム・ガイドライン表示
- マウス・キーボード操作処理
- 座標変換（描画用・レイヤー操作用）

【API境界】
- 入力: マウス・キーボードイベント
- 出力: 座標変換メソッド・カメラ状態
- 連携: CoordinateSystem、CoreRuntime

【PixiJS v8.13対応】
- PIXI.Application() → await app.init()
- Graphics API更新対応
- Container構造最適化
*/

(function() {
    'use strict';
    
    // 依存関係確認
    const CONFIG = window.TEGAKI_CONFIG;
    if (!CONFIG) {
        throw new Error('camera-system.js: CONFIG dependency missing');
    }
    
    if (!window.CoordinateSystem) {
        throw new Error('camera-system.js: CoordinateSystem dependency missing');
    }
    
    // === カメラシステム（Phase2分離版） ===
    class CameraSystem {
        constructor(app) {
            this.app = app;
            this.isDragging = false;
            this.isScaleRotateDragging = false;
            this.lastPoint = { x: 0, y: 0 };
            this.panSpeed = CONFIG.camera.dragMoveSpeed;
            this.zoomSpeed = CONFIG.camera.wheelZoomSpeed;
            this.rotation = 0;
            this.horizontalFlipped = false;
            this.verticalFlipped = false;
            
            // 初期状態の記憶（Ctrl+0リセット用）
            this.initialState = {
                position: null,
                scale: CONFIG.camera.initialScale,
                rotation: 0,
                horizontalFlipped: false,
                verticalFlipped: false
            };
            
            // PixiJS v8.13対応のコンテナ階層構築
            this.worldContainer = new PIXI.Container();
            this.worldContainer.label = 'worldContainer';
            this.worldContainer.eventMode = 'static';
            app.stage.addChild(this.worldContainer);
            
            this.canvasContainer = new PIXI.Container();
            this.canvasContainer.label = 'canvasContainer';
            this.canvasContainer.eventMode = 'static';
            this.worldContainer.addChild(this.canvasContainer);
            
            this.cameraFrame = new PIXI.Graphics();
            this.cameraFrame.label = 'cameraFrame';
            this.worldContainer.addChild(this.cameraFrame);
            
            // ガイドライン用コンテナ（レイヤー操作時表示）
            this.guideLines = new PIXI.Container();
            this.guideLines.label = 'guideLines';
            this.worldContainer.addChild(this.guideLines);
            this.createGuideLines();
            
            // キャンバスマスク（PixiJS v8.13対応）
            this.canvasMask = new PIXI.Graphics();
            this.canvasMask.rect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
            this.canvasMask.fill(0xffffff);
            this.worldContainer.addChild(this.canvasMask);
            this.canvasContainer.mask = this.canvasMask;
            
            // キー状態管理
            this.spacePressed = false;
            this.shiftPressed = false;
            this.vKeyPressed = false;
            
            // 外部システム参照（後で設定）
            this.layerManager = null;
            this.drawingEngine = null;
            
            this.setupEvents();
            this.initializeCamera();
            this.drawCameraFrame();
            
            console.log('✅ CameraSystem initialized (Phase2 separated)');
        }
        
        // === ガイドライン作成（キャンバスリサイズ対応） ===
        createGuideLines() {
            this.guideLines.removeChildren();
            
            const centerX = CONFIG.canvas.width / 2;
            const centerY = CONFIG.canvas.height / 2;
            
            // 縦線（カメラフレーム中央）
            const verticalLine = new PIXI.Graphics();
            verticalLine.rect(centerX - 0.5, 0, 1, CONFIG.canvas.height);
            verticalLine.fill({ color: 0x800000, alpha: 0.8 });
            this.guideLines.addChild(verticalLine);
            
            // 横線（カメラフレーム中央）
            const horizontalLine = new PIXI.Graphics();
            horizontalLine.rect(0, centerY - 0.5, CONFIG.canvas.width, 1);
            horizontalLine.fill({ color: 0x800000, alpha: 0.8 });
            this.guideLines.addChild(horizontalLine);
            
            this.guideLines.visible = false; // 初期は非表示
            
            if (CONFIG.debug) {
                console.log('Guide lines created for canvas:', CONFIG.canvas.width, 'x', CONFIG.canvas.height);
            }
        }
        
        // === キャンバスリサイズ時の更新処理 ===
        updateGuideLinesForCanvasResize() {
            this.createGuideLines();
            this.drawCameraFrame();
            
            // マスクも更新
            this.canvasMask.clear();
            this.canvasMask.rect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
            this.canvasMask.fill(0xffffff);
            
            if (CONFIG.debug) {
                console.log('CameraSystem: Guide lines updated for resize:', CONFIG.canvas.width, 'x', CONFIG.canvas.height);
            }
        }
        
        // === 外部からのキャンバスリサイズ処理（CoreRuntime用） ===
        resizeCanvas(newWidth, newHeight) {
            if (CONFIG.debug) {
                console.log('CameraSystem: Resizing canvas to', newWidth, 'x', newHeight);
            }
            
            // 設定更新は外部で実行済み
            CONFIG.canvas.width = newWidth;
            CONFIG.canvas.height = newHeight;
            
            // カメラフレーム、マスク、ガイドライン更新
            this.updateGuideLinesForCanvasResize();
        }
        
        // === ガイドライン表示制御 ===
        showGuideLines() {
            this.guideLines.visible = true;
            if (CONFIG.debug) {
                console.log('Guide lines shown');
            }
        }
        
        hideGuideLines() {
            this.guideLines.visible = false;
            if (CONFIG.debug) {
                console.log('Guide lines hidden');
            }
        }
        
        // === カメラ初期化 ===
        initializeCamera() {
            const centerX = this.app.screen.width / 2;
            const centerY = this.app.screen.height / 2;
            
            this.canvasContainer.position.set(0, 0);
            
            const initialX = centerX - CONFIG.canvas.width / 2;
            const initialY = centerY - CONFIG.canvas.height / 2;
            this.worldContainer.position.set(initialX, initialY);
            this.worldContainer.scale.set(CONFIG.camera.initialScale);
            
            this.initialState.position = { x: initialX, y: initialY };
        }
        
        // === カメラリセット（Ctrl+0） ===
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
            
            this.updateTransformDisplay();
        }
        
        // === イベント設定（マウス・キーボード操作） ===
        setupEvents() {
            this.app.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
            
            // === マウス操作 ===
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
                    // 移動
                    const dx = (e.clientX - this.lastPoint.x) * this.panSpeed;
                    const dy = (e.clientY - this.lastPoint.y) * this.panSpeed;
                    
                    this.worldContainer.x += dx;
                    this.worldContainer.y += dy;
                    
                    this.lastPoint = { x: e.clientX, y: e.clientY };
                    this.updateTransformDisplay();
                } else if (this.isScaleRotateDragging) {
                    // 拡縮・回転
                    const dx = e.clientX - this.lastPoint.x;
                    const dy = e.clientY - this.lastPoint.y;
                    
                    const centerX = CONFIG.canvas.width / 2;
                    const centerY = CONFIG.canvas.height / 2;
                    
                    // CoordinateSystem経由で中央座標取得
                    const worldCenter = window.CoordinateSystem.localToGlobal(
                        this.worldContainer, { x: centerX, y: centerY }
                    );
                    
                    if (Math.abs(dx) > Math.abs(dy)) {
                        // 水平方向優先: 回転
                        this.rotation += (dx * CONFIG.camera.dragRotationSpeed);
                        this.worldContainer.rotation = (this.rotation * Math.PI) / 180;
                        
                        const newWorldCenter = window.CoordinateSystem.localToGlobal(
                            this.worldContainer, { x: centerX, y: centerY }
                        );
                        this.worldContainer.x += worldCenter.x - newWorldCenter.x;
                        this.worldContainer.y += worldCenter.y - newWorldCenter.y;
                    } else {
                        // 垂直方向優先: 拡縮
                        const scaleFactor = 1 + (dy * CONFIG.camera.dragScaleSpeed);
                        const newScale = this.worldContainer.scale.x * scaleFactor;
                        
                        if (newScale >= CONFIG.camera.minScale && newScale <= CONFIG.camera.maxScale) {
                            this.worldContainer.scale.set(newScale);
                            const newWorldCenter = window.CoordinateSystem.localToGlobal(
                                this.worldContainer, { x: centerX, y: centerY }
                            );
                            this.worldContainer.x += worldCenter.x - newWorldCenter.x;
                            this.worldContainer.y += worldCenter.y - newWorldCenter.y;
                        }
                    }
                    
                    this.lastPoint = { x: e.clientX, y: e.clientY };
                    this.updateTransformDisplay();
                }
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

            this.app.canvas.addEventListener('pointerenter', () => {
                this.updateCursor();
            });
            
            // === マウスホイール操作 ===
            this.app.canvas.addEventListener('wheel', (e) => {
                e.preventDefault();
                
                if (this.vKeyPressed) return; // レイヤー操作中は無視
                
                const centerX = CONFIG.canvas.width / 2;
                const centerY = CONFIG.canvas.height / 2;
                
                if (this.shiftPressed) {
                    // Shift + ホイール: 回転
                    const rotationDelta = e.deltaY < 0 ? 
                        CONFIG.camera.keyRotationDegree : -CONFIG.camera.keyRotationDegree;
                    
                    const worldCenter = window.CoordinateSystem.localToGlobal(
                        this.worldContainer, { x: centerX, y: centerY }
                    );
                    
                    this.rotation += rotationDelta;
                    this.worldContainer.rotation = (this.rotation * Math.PI) / 180;
                    
                    const newWorldCenter = window.CoordinateSystem.localToGlobal(
                        this.worldContainer, { x: centerX, y: centerY }
                    );
                    this.worldContainer.x += worldCenter.x - newWorldCenter.x;
                    this.worldContainer.y += worldCenter.y - newWorldCenter.y;
                } else {
                    // ホイール: 拡縮
                    const scaleFactor = e.deltaY < 0 ? 1 + this.zoomSpeed : 1 - this.zoomSpeed;
                    const newScale = this.worldContainer.scale.x * scaleFactor;
                    
                    if (newScale >= CONFIG.camera.minScale && newScale <= CONFIG.camera.maxScale) {
                        const worldCenter = window.CoordinateSystem.localToGlobal(
                            this.worldContainer, { x: centerX, y: centerY }
                        );
                        
                        this.worldContainer.scale.set(newScale);
                        
                        const newWorldCenter = window.CoordinateSystem.localToGlobal(
                            this.worldContainer, { x: centerX, y: centerY }
                        );
                        this.worldContainer.x += worldCenter.x - newWorldCenter.x;
                        this.worldContainer.y += worldCenter.y - newWorldCenter.y;
                    }
                }
                
                this.updateTransformDisplay();
            });
            
            // === キーボード操作 ===
            document.addEventListener('keydown', (e) => {
                // Ctrl+0: キャンバスリセット
                if (e.ctrlKey && e.code === 'Digit0') {
                    this.resetCanvas();
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
                
                // 以下、レイヤー操作中（V押下中）は処理しない
                if (this.vKeyPressed) return;
                
                // === キャンバス移動: Space + 方向キー ===
                if (this.spacePressed && !this.shiftPressed && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                    const moveAmount = CONFIG.camera.keyMoveAmount;
                    switch(e.code) {
                        case 'ArrowDown':    this.worldContainer.y += moveAmount; break;
                        case 'ArrowUp':  this.worldContainer.y -= moveAmount; break;
                        case 'ArrowRight':  this.worldContainer.x += moveAmount; break;
                        case 'ArrowLeft': this.worldContainer.x -= moveAmount; break;
                    }
                    this.updateTransformDisplay();
                    e.preventDefault();
                }
                
                // === キャンバス拡縮・回転: Shift + Space + 方向キー ===
                if (this.spacePressed && this.shiftPressed && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                    const centerX = CONFIG.canvas.width / 2;
                    const centerY = CONFIG.canvas.height / 2;
                    const worldCenter = window.CoordinateSystem.localToGlobal(
                        this.worldContainer, { x: centerX, y: centerY }
                    );
                    
                    switch(e.code) {
                        case 'ArrowUp':
                            const scaleUpFactor = 1 + CONFIG.camera.wheelZoomSpeed;
                            const newScaleUp = this.worldContainer.scale.x * scaleUpFactor;
                            if (newScaleUp <= CONFIG.camera.maxScale) {
                                this.worldContainer.scale.set(newScaleUp);
                                const newWorldCenterUp = window.CoordinateSystem.localToGlobal(
                                    this.worldContainer, { x: centerX, y: centerY }
                                );
                                this.worldContainer.x += worldCenter.x - newWorldCenterUp.x;
                                this.worldContainer.y += worldCenter.y - newWorldCenterUp.y;
                            }
                            break;
                            
                        case 'ArrowDown':
                            const scaleDownFactor = 1 - CONFIG.camera.wheelZoomSpeed;
                            const newScaleDown = this.worldContainer.scale.x * scaleDownFactor;
                            if (newScaleDown >= CONFIG.camera.minScale) {
                                this.worldContainer.scale.set(newScaleDown);
                                const newWorldCenterDown = window.CoordinateSystem.localToGlobal(
                                    this.worldContainer, { x: centerX, y: centerY }
                                );
                                this.worldContainer.x += worldCenter.x - newWorldCenterDown.x;
                                this.worldContainer.y += worldCenter.y - newWorldCenterDown.y;
                            }
                            break;
                            
                        case 'ArrowLeft':
                            this.rotation -= CONFIG.camera.keyRotationDegree;
                            this.worldContainer.rotation = (this.rotation * Math.PI) / 180;
                            const newWorldCenterLeft = window.CoordinateSystem.localToGlobal(
                                this.worldContainer, { x: centerX, y: centerY }
                            );
                            this.worldContainer.x += worldCenter.x - newWorldCenterLeft.x;
                            this.worldContainer.y += worldCenter.y - newWorldCenterLeft.y;
                            break;
                            
                        case 'ArrowRight':
                            this.rotation += CONFIG.camera.keyRotationDegree;
                            this.worldContainer.rotation = (this.rotation * Math.PI) / 180;
                            const newWorldCenterRight = window.CoordinateSystem.localToGlobal(
                                this.worldContainer, { x: centerX, y: centerY }
                            );
                            this.worldContainer.x += worldCenter.x - newWorldCenterRight.x;
                            this.worldContainer.y += worldCenter.y - newWorldCenterRight.y;
                            break;
                    }
                    
                    this.updateTransformDisplay();
                    e.preventDefault();
                }
                
                // === キャンバス反転: H / Shift+H（レイヤー操作中以外） ===
                if (!this.vKeyPressed && e.code === 'KeyH' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    const centerX = CONFIG.canvas.width / 2;
                    const centerY = CONFIG.canvas.height / 2;
                    const worldCenter = window.CoordinateSystem.localToGlobal(
                        this.worldContainer, { x: centerX, y: centerY }
                    );
                    
                    if (e.shiftKey) {
                        // Shift+H: 垂直反転
                        this.verticalFlipped = !this.verticalFlipped;
                        this.worldContainer.scale.y *= -1;
                    } else {
                        // H: 水平反転
                        this.horizontalFlipped = !this.horizontalFlipped;
                        this.worldContainer.scale.x *= -1;
                    }
                    
                    const newWorldCenter = window.CoordinateSystem.localToGlobal(
                        this.worldContainer, { x: centerX, y: centerY }
                    );
                    this.worldContainer.x += worldCenter.x - newWorldCenter.x;
                    this.worldContainer.y += worldCenter.y - newWorldCenter.y;
                    
                    this.updateTransformDisplay();
                    e.preventDefault();
                }
            });
            
            document.addEventListener('keyup', (e) => {
                if (e.code === 'Space') {
                    this.spacePressed = false;
                    this.updateCursor();
                }
                if (!e.shiftKey) this.shiftPressed = false;
            });
        }
        
        // === 外部システムからの状態設定 ===
        setVKeyPressed(pressed) {
            this.vKeyPressed = pressed;
        }

        // === ツール切り替え ===
        switchTool(tool) {
            if (this.drawingEngine) {
                this.drawingEngine.setTool(tool);
            }
            
            // レイヤー移動モードを終了
            if (this.layerManager && this.layerManager.isLayerMoveMode) {
                this.layerManager.exitLayerMoveMode();
            }
            
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
        
        // === カーソル更新 ===
        updateCursor() {
            if (this.layerManager && this.layerManager.vKeyPressed) {
                // レイヤー操作中はLayerManagerが制御
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
        }
        
        // === 座標変換メソッド（CoordinateSystem統一API使用） ===
        
        // ペン描画用のキャンバス座標変換（レイヤー変形を考慮しない）
        screenToCanvasForDrawing(screenX, screenY) {
            return window.CoordinateSystem.screenToCanvas(this.app, screenX, screenY);
        }
        
        // レイヤー操作用の座標変換（レイヤー変形を考慮）
        screenToCanvas(screenX, screenY) {
            return window.CoordinateSystem.screenToCanvas(this.app, screenX, screenY);
        }
        
        canvasToScreen(canvasX, canvasY) {
            return window.CoordinateSystem.canvasToWorld(this.app, canvasX, canvasY);
        }
        
        // === 座標境界判定 ===
        isPointInExtendedCanvas(canvasPoint, margin = 50) {
            return window.CoordinateSystem.isPointInExtendedCanvas(canvasPoint, margin);
        }

        // === 座標・変形情報表示更新 ===
        updateCoordinates(x, y) {
            const element = document.getElementById('coordinates');
            if (element) {
                element.textContent = `x: ${Math.round(x)}, y: ${Math.round(y)}`;
            }
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
        
        // === カメラフレーム描画 ===
        drawCameraFrame() {
            this.cameraFrame.clear();
            this.cameraFrame.rect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
            this.cameraFrame.stroke({ width: 2, color: 0xff0000, alpha: 0.5 });
        }

        // === カメラフレーム中央の絶対座標取得 ===
        getCameraFrameCenter() {
            const centerX = CONFIG.canvas.width / 2;
            const centerY = CONFIG.canvas.height / 2;
            return window.CoordinateSystem.localToGlobal(this.worldContainer, { x: centerX, y: centerY });
        }
        
        // === 外部システム参照設定（依存注入） ===
        setLayerManager(layerManager) {
            this.layerManager = layerManager;
        }
        
        setDrawingEngine(drawingEngine) {
            this.drawingEngine = drawingEngine;
        }
    }
    
    // === グローバル公開 ===
    window.TegakiCameraSeparated = {
        CameraSystem: CameraSystem
    };
    
    console.log('✅ camera-system.js loaded (Phase2 separated)');
    console.log('   - PixiJS v8.13