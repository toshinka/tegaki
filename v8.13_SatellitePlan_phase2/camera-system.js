// ===== camera-system.js - カメラシステム（Phase2分離版） =====
// core-engine.js から分離したカメラ・ビューポート制御システム
// Phase1.5改修: 冗長メソッド削除・座標変換統一・CoordinateSystem使用

/*
=== Phase2分離 + Phase1.5改修完了ヘッダー ===

【分離内容】
- CameraSystemクラス完全分離
- カメラ操作・座標変換・表示制御
- ガイドライン・フレーム描画
- キーボード・マウス操作制御

【Phase1.5改修完了】
✅ 冗長メソッド削除: screenToDrawingCanvas, screenToWorldCanvas, canvasToScreen
✅ 座標変換統一: window.CoordinateSystem使用に統一
✅ API境界明確化: CoordinateSystem経由のみの座標変換
✅ 分割準備コメント完備

【Dependencies】
- CONFIG: config.js のグローバル設定
- window.CoordinateSystem: coordinate-system.js 統一座標API
- PIXI: PixiJS v8.13

【呼び出し側】
- CoreRuntime: 公開API経由
- core-engine.js → 各分離Engine

=== Phase2分離 + Phase1.5改修完了ヘッダー終了 ===
*/

(function() {
    'use strict';
    
    // グローバル設定を取得
    const CONFIG = window.TEGAKI_CONFIG;
    
    const log = (...args) => {
        if (CONFIG.debug) console.log(...args);
    };

    // === カメラシステム（Phase2分離版・Phase1.5改修完了） ===
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
            
            this.worldContainer = new PIXI.Container();
            this.worldContainer.label = 'worldContainer';
            app.stage.addChild(this.worldContainer);
            
            this.canvasContainer = new PIXI.Container();
            this.canvasContainer.label = 'canvasContainer';
            this.worldContainer.addChild(this.canvasContainer);
            
            this.cameraFrame = new PIXI.Graphics();
            this.cameraFrame.label = 'cameraFrame';
            this.worldContainer.addChild(this.cameraFrame);
            
            // ガイドライン用コンテナ（キャンバスサイズ変更対応）
            this.guideLines = new PIXI.Container();
            this.guideLines.label = 'guideLines';
            this.worldContainer.addChild(this.guideLines);
            this.createGuideLines();
            
            this.canvasMask = new PIXI.Graphics();
            this.canvasMask.rect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
            this.canvasMask.fill(0xffffff);
            this.worldContainer.addChild(this.canvasMask);
            this.canvasContainer.mask = this.canvasMask;
            
            // キー状態管理
            this.spacePressed = false;
            this.shiftPressed = false;
            this.vKeyPressed = false;
            
            // 外部参照（分離後の依存注入）
            this.layerManager = null;
            this.drawingEngine = null;
            
            this.setupEvents();
            this.initializeCamera();
            this.drawCameraFrame();
        }
        
        // ガイドライン作成（キャンバスサイズ変更対応・完全修正版）
        createGuideLines() {
            this.guideLines.removeChildren();
            
            // 現在のキャンバスサイズを使用してガイドライン作成
            const centerX = CONFIG.canvas.width / 2;
            const centerY = CONFIG.canvas.height / 2;
            
            // 縦線（カメラフレームの中央）
            const verticalLine = new PIXI.Graphics();
            verticalLine.rect(centerX - 0.5, 0, 1, CONFIG.canvas.height);
            verticalLine.fill({ color: 0x800000, alpha: 0.8 });
            this.guideLines.addChild(verticalLine);
            
            // 横線（カメラフレームの中央）
            const horizontalLine = new PIXI.Graphics();
            horizontalLine.rect(0, centerY - 0.5, CONFIG.canvas.width, 1);
            horizontalLine.fill({ color: 0x800000, alpha: 0.8 });
            this.guideLines.addChild(horizontalLine);
            
            this.guideLines.visible = false; // 初期は非表示
        }
        
        // キャンバスサイズ変更時のガイドライン再作成（完全版）
        updateGuideLinesForCanvasResize() {
            this.createGuideLines();
            this.drawCameraFrame();
            // マスクも更新
            this.canvasMask.clear();
            this.canvasMask.rect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
            this.canvasMask.fill(0xffffff);
        }
        
        // 外部からのキャンバスリサイズ処理
        resizeCanvas(newWidth, newHeight) {
            CONFIG.canvas.width = newWidth;
            CONFIG.canvas.height = newHeight;
            this.updateGuideLinesForCanvasResize();
        }
        
        showGuideLines() {
            this.guideLines.visible = true;
        }
        
        hideGuideLines() {
            this.guideLines.visible = false;
        }
        
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
                    
                    // ✅ Phase1.5改修: window.CoordinateSystem統一使用
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
                    
                    // ✅ Phase1.5改修: window.CoordinateSystem統一使用
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
                        // ✅ Phase1.5改修: window.CoordinateSystem統一使用
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
                    
                    // ✅ Phase1.5改修: window.CoordinateSystem統一使用
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
                    
                    // ✅ Phase1.5改修: window.CoordinateSystem統一使用
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
        
        // レイヤー操作システムからの呼び出し用
        setVKeyPressed(pressed) {
            this.vKeyPressed = pressed;
        }

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
        
        // ✅ Phase1.5改修完了: ペン描画用の座標変換（CoordinateSystem統一）
        screenToCanvasForDrawing(screenX, screenY) {
            // window.CoordinateSystem 統一API使用
            return window.CoordinateSystem.globalToLocal(this.canvasContainer, { x: screenX, y: screenY });
        }
        
        // ✅ Phase1.5改修完了: 一般的な座標変換（CoordinateSystem統一）
        screenToCanvas(screenX, screenY) {
            return window.CoordinateSystem.globalToLocal(this.canvasContainer, { x: screenX, y: screenY });
        }
        
        canvasToScreen(canvasX, canvasY) {
            return window.CoordinateSystem.localToGlobal(this.canvasContainer, { x: canvasX, y: canvasY });
        }
        
        isPointInExtendedCanvas(canvasPoint, margin = 50) {
            return canvasPoint.x >= -margin && canvasPoint.x <= CONFIG.canvas.width + margin &&
                   canvasPoint.y >= -margin && canvasPoint.y <= CONFIG.canvas.height + margin;
        }

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
        
        drawCameraFrame() {
            this.cameraFrame.clear();
            this.cameraFrame.rect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
            this.cameraFrame.stroke({ width: 2, color: 0xff0000, alpha: 0.5 });
        }

        // カメラフレーム中央の絶対座標を取得
        getCameraFrameCenter() {
            const centerX = CONFIG.canvas.width / 2;
            const centerY = CONFIG.canvas.height / 2;
            return window.CoordinateSystem.localToGlobal(this.worldContainer, { x: centerX, y: centerY });
        }
        
        // 依存注入設定用（分離後のEngine間参照）
        setLayerManager(layerManager) {
            this.layerManager = layerManager;
        }
        
        setDrawingEngine(drawingEngine) {
            this.drawingEngine = drawingEngine;
        }
    }

    // === グローバル公開 ===
    window.TegakiCameraSystem = CameraSystem;
    
})();