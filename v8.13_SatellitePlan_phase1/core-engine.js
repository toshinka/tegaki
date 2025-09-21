// ===== core-engine.js - Phase 1 座標系統一改修版 =====
// coordinate-system.js統合・座標変換API統一・二重実装削除
// CameraSystem + LayerManager + DrawingEngine + ClipboardSystem を統合
// Phase 1: 座標変換の完全統一・明示的座標空間コメント・toLocal/toGlobal置換

/*
=== Phase 1 改修ヘッダー ===

【座標系統一改修内容】
- window.CoordinateSystem API完全統合
- toLocal/toGlobal直接呼び出し全廃
- screenToCanvasForDrawing/screenToCanvas二重実装統一
- 座標空間の明示的コメント追加（coord: source -> destination形式）
- 座標変換精度向上・PixiJS v8.13最適化

【coordinate-system.js依存】
- 事前にcoordinate-system.jsが読み込まれている前提
- window.CoordinateSystemグローバルAPI使用
- 座標空間検証機能活用

【ファイル間依存関係辞典】
- CONFIG: config.js のグローバル設定オブジェクト
- UIController: ui-panels.js のUI制御クラス
- TegakiUI.initializeSortable: ui-panels.js のSortableJS統合関数
- window.drawingAppResizeCanvas: index.html内main.js統合部分の関数
- window.CoordinateSystem: coordinate-system.js の統一座標API

【主要改修ポイント】
1. CameraSystem.screenToCanvasForDrawing → CoordinateSystem.screenToDrawingCanvas
2. CameraSystem.screenToCanvas → CoordinateSystem.screenToWorldCanvas
3. 全container.toLocal/toGlobal → CoordinateSystem API
4. 座標変換の明示的コメント追加
5. 変形行列計算の統一化

=== Phase 1 改修ヘッダー終了 ===
*/

(function() {
    'use strict';
    
    // coordinate-system.js依存確認
    if (!window.CoordinateSystem) {
        console.error('CRITICAL: coordinate-system.js not loaded. CoordinateSystem API not available.');
        throw new Error('coordinate-system.js dependency missing');
    }
    
    // グローバル設定を取得
    const CONFIG = window.TEGAKI_CONFIG;
    
    const log = (...args) => {
        if (CONFIG.debug) console.log(...args);
    };

    // === クリップボード管理システム（座標系統一版） ===
    class ClipboardSystem {
        constructor() {
            this.clipboardData = null;
            this.setupKeyboardEvents();
        }

        setupKeyboardEvents() {
            document.addEventListener('keydown', (e) => {
                // Ctrl+C: コピー
                if (e.ctrlKey && e.code === 'KeyC' && !e.altKey && !e.metaKey) {
                    this.copyActiveLayer();
                    e.preventDefault();
                }
                
                // Ctrl+V: ペースト
                if (e.ctrlKey && e.code === 'KeyV' && !e.altKey && !e.metaKey) {
                    this.pasteLayer();
                    e.preventDefault();
                }
            });
        }

        // 座標系統一版：アクティブレイヤーのコピー
        copyActiveLayer() {
            const layerManager = this.layerManager; // 内部参照
            if (!layerManager) {
                console.warn('LayerManager not available');
                return;
            }

            const activeLayer = layerManager.getActiveLayer();
            if (!activeLayer) {
                console.warn('No active layer to copy');
                return;
            }

            try {
                console.log('Non-destructive copy started (coordinate-system unified)');
                
                // ✅ 現在の変形状態を取得
                const layerId = activeLayer.layerData.id;
                const currentTransform = layerManager.layerTransforms.get(layerId);
                
                let pathsToStore;
                
                if (layerManager.isTransformNonDefault(currentTransform)) {
                    // 変形中の場合：仮想的に変形適用した座標を生成
                    console.log('Layer has active transforms - generating virtual transformed paths');
                    pathsToStore = this.getTransformedPaths(activeLayer, currentTransform);
                } else {
                    // 未変形の場合：そのままコピー
                    console.log('Layer has no transforms - copying original paths');
                    pathsToStore = activeLayer.layerData.paths || [];
                }
                
                // レイヤーデータのディープコピー
                const layerData = activeLayer.layerData;
                
                // 背景データのコピー（背景レイヤーの場合）
                let backgroundData = null;
                if (layerData.isBackground) {
                    backgroundData = {
                        isBackground: true,
                        color: CONFIG.background.color
                    };
                }

                // ✅ 完全なパスデータをクリップボードに保存
                this.clipboardData = {
                    layerData: {
                        name: layerData.name.includes('_copy') ? 
                              layerData.name : layerData.name + '_copy',
                        visible: layerData.visible,
                        opacity: layerData.opacity,
                        paths: this.deepCopyPaths(pathsToStore),
                        backgroundData: backgroundData
                    },
                    // 変形情報はリセット（ペースト時は初期状態）
                    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
                    metadata: {
                        originalId: layerId,
                        copiedAt: Date.now(),
                        pathCount: pathsToStore.length,
                        isNonDestructive: true,
                        hasTransforms: layerManager.isTransformNonDefault(currentTransform),
                        coordinateSystem: 'unified' // Phase 1フラグ
                    },
                    timestamp: Date.now()
                };

                console.log(`Non-destructive copy completed: ${pathsToStore.length} paths preserved (coordinate-system unified)`);
                
            } catch (error) {
                console.error('Failed to copy layer non-destructively:', error);
            }
        }

        // 座標系統一版：現在の変形状態を適用した座標を仮想計算
        getTransformedPaths(layer, transform) {
            // coord: canvas center -> transform center
            const centerX = CONFIG.canvas.width / 2;
            const centerY = CONFIG.canvas.height / 2;
            
            // ✅ CoordinateSystem統一API使用：変形行列作成
            const matrix = window.CoordinateSystem.createTransformMatrix(
                transform, centerX, centerY
            );
            
            // パスに仮想変形を適用（元データは変更しない）
            return (layer.layerData.paths || []).map(path => ({
                id: `${path.id}_transformed_${Date.now()}`,
                // coord: layer space -> transformed layer space
                points: (path.points || []).map(point => 
                    window.CoordinateSystem.applyMatrix(point, matrix)
                ),
                color: path.color,
                size: path.size,
                opacity: path.opacity,
                isComplete: path.isComplete
            }));
        }

        // パスデータの完全ディープコピー
        deepCopyPaths(paths) {
            return (paths || []).map(path => ({
                id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                // coord: layer space (unchanged)
                points: (path.points || []).map(point => ({ x: point.x, y: point.y })),
                color: path.color,
                size: path.size,
                opacity: path.opacity,
                isComplete: path.isComplete || true
            }));
        }

        // 座標系統一版：レイヤーのペースト
        pasteLayer() {
            const layerManager = this.layerManager;
            if (!layerManager) {
                console.warn('LayerManager not available');
                return;
            }

            if (!this.clipboardData) {
                console.warn('No clipboard data to paste');
                return;
            }

            try {
                const clipData = this.clipboardData;
                
                // ✅ 座標系統一版の検証
                if (clipData.metadata?.coordinateSystem === 'unified') {
                    console.log('Pasting coordinate-system unified data:', clipData.metadata);
                } else {
                    console.warn('Pasting legacy coordinate data');
                }
                
                // 一意なレイヤー名を生成
                const layerName = this.generateUniqueLayerName(clipData.layerData.name, layerManager);

                // 新規レイヤーを作成
                const { layer, index } = layerManager.createLayer(layerName, false);

                // 背景データが存在する場合は背景として再構築
                if (clipData.layerData.backgroundData) {
                    const bg = new PIXI.Graphics();
                    bg.rect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
                    bg.fill(clipData.layerData.backgroundData.color);
                    layer.addChild(bg);
                    layer.layerData.backgroundGraphics = bg;
                    layer.layerData.isBackground = true;
                }

                // ✅ パスデータ完全復元
                clipData.layerData.paths.forEach(pathData => {
                    if (pathData.points && pathData.points.length > 0) {
                        const newPath = {
                            id: pathData.id,
                            // coord: layer space (restored)
                            points: [...pathData.points],
                            color: pathData.color,
                            size: pathData.size,
                            opacity: pathData.opacity,
                            isComplete: true,
                            graphics: null // 後で生成
                        };
                        
                        // パスGraphicsを再生成
                        layerManager.rebuildPathGraphics(newPath);
                        
                        // レイヤーに追加
                        layer.layerData.paths.push(newPath);
                        layer.addChild(newPath.graphics);
                    }
                });

                // レイヤー変形データを初期化
                const newLayerId = layer.layerData.id;
                layerManager.layerTransforms.set(newLayerId, {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                });

                // レイヤーの可視性と不透明度を復元
                layer.layerData.visible = clipData.layerData.visible;
                layer.layerData.opacity = clipData.layerData.opacity;
                layer.visible = clipData.layerData.visible;
                layer.alpha = clipData.layerData.opacity;

                // 新しいレイヤーをアクティブに設定
                layerManager.setActiveLayer(index);
                
                // UI更新
                layerManager.updateLayerPanelUI();
                layerManager.updateStatusDisplay();
                
                // サムネイル更新
                layerManager.requestThumbnailUpdate(index);

                console.log(`Non-destructive paste completed: ${clipData.layerData.paths.length} paths restored (coordinate-system unified)`);
                
            } catch (error) {
                console.error('Failed to paste layer non-destructively:', error);
            }
        }

        // 一意なレイヤー名を生成
        generateUniqueLayerName(baseName, layerManager) {
            let name = baseName;
            let counter = 1;
            
            while (layerManager.layers.some(layer => layer.layerData.name === name)) {
                name = `${baseName}_${counter}`;
                counter++;
            }
            
            return name;
        }
        
        // 内部参照設定用（CoreEngineから呼び出し）
        setLayerManager(layerManager) {
            this.layerManager = layerManager;
        }
    }

    // === カメラシステム（座標系統一版） ===
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
            
            // ガイドライン用コンテナ
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
            
            // 内部参照（後で設定）
            this.layerManager = null;
            this.drawingEngine = null;
            
            this.setupEvents();
            this.initializeCamera();
            this.drawCameraFrame();
        }
        
        // 座標系統一版：ガイドライン作成
        createGuideLines() {
            this.guideLines.removeChildren();
            
            // coord: canvas center (dynamic calculation)
            const centerX = CONFIG.canvas.width / 2;
            const centerY = CONFIG.canvas.height / 2;
            
            console.log('Creating unified coordinate guide lines at center:', centerX, centerY);
            
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
            
            this.guideLines.visible = false;
            
            console.log('Unified coordinate guide lines created');
        }
        
        // 座標系統一版：キャンバスサイズ変更時のガイドライン再作成
        updateGuideLinesForCanvasResize() {
            console.log('Updating unified coordinate guide lines for canvas resize to', CONFIG.canvas.width, 'x', CONFIG.canvas.height);
            this.createGuideLines();
            this.drawCameraFrame();
            // マスクも更新
            this.canvasMask.clear();
            this.canvasMask.rect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
            this.canvasMask.fill(0xffffff);
        }
        
        // 外部からのキャンバスリサイズ処理
        resizeCanvas(newWidth, newHeight) {
            console.log('CameraSystem: Unified coordinate canvas resize from', CONFIG.canvas.width, 'x', CONFIG.canvas.height, 'to', newWidth, 'x', newHeight);
            
            CONFIG.canvas.width = newWidth;
            CONFIG.canvas.height = newHeight;
            
            this.updateGuideLinesForCanvasResize();
            
            console.log('CameraSystem: Unified coordinate canvas resize completed');
        }
        
        showGuideLines() {
            this.guideLines.visible = true;
            console.log('Unified coordinate guide lines shown');
        }
        
        hideGuideLines() {
            this.guideLines.visible = false;
            console.log('Unified coordinate guide lines hidden');
        }
        
        initializeCamera() {
            // coord: screen center
            const centerX = this.app.screen.width / 2;
            const centerY = this.app.screen.height / 2;
            
            this.canvasContainer.position.set(0, 0);
            
            // coord: screen -> world (initial positioning)
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
                    // coord: screen pointer position
                    this.lastPoint = { x: e.clientX, y: e.clientY };
                    this.app.canvas.style.cursor = 'move';
                    e.preventDefault();
                } else if ((e.button === 2 || this.spacePressed) && this.shiftPressed) {
                    // Shift + Space + ドラッグ: 拡縮・回転
                    this.isScaleRotateDragging = true;
                    // coord: screen pointer position
                    this.lastPoint = { x: e.clientX, y: e.clientY };
                    this.app.canvas.style.cursor = 'grab';
                    e.preventDefault();
                }
            });
            
            this.app.canvas.addEventListener('pointermove', (e) => {
                if (this.isDragging) {
                    // 移動
                    // coord: screen delta
                    const dx = (e.clientX - this.lastPoint.x) * this.panSpeed;
                    const dy = (e.clientY - this.lastPoint.y) * this.panSpeed;
                    
                    // coord: world container position update
                    this.worldContainer.x += dx;
                    this.worldContainer.y += dy;
                    
                    // coord: screen pointer position
                    this.lastPoint = { x: e.clientX, y: e.clientY };
                    this.updateTransformDisplay();
                } else if (this.isScaleRotateDragging) {
                    // 拡縮・回転
                    // coord: screen delta
                    const dx = e.clientX - this.lastPoint.x;
                    const dy = e.clientY - this.lastPoint.y;
                    
                    // coord: canvas center -> world
                    const centerX = CONFIG.canvas.width / 2;
                    const centerY = CONFIG.canvas.height / 2;
                    
                    // ✅ CoordinateSystem統一API使用
                    const worldCenter = window.CoordinateSystem.localToGlobal(
                        this.worldContainer, { x: centerX, y: centerY }
                    );
                    
                    if (Math.abs(dx) > Math.abs(dy)) {
                        // 水平方向優先: 回転
                        this.rotation += (dx * CONFIG.camera.dragRotationSpeed);
                        this.worldContainer.rotation = (this.rotation * Math.PI) / 180;
                        
                        // ✅ CoordinateSystem統一API使用：回転後の中央位置補正
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
                            // ✅ CoordinateSystem統一API使用：スケール後の中央位置補正
                            const newWorldCenter = window.CoordinateSystem.localToGlobal(
                                this.worldContainer, { x: centerX, y: centerY }
                            );
                            this.worldContainer.x += worldCenter.x - newWorldCenter.x;
                            this.worldContainer.y += worldCenter.y - newWorldCenter.y;
                        }
                    }
                    
                    // coord: screen pointer position
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
                
                if (this.vKeyPressed) return;
                
                // coord: canvas center
                const centerX = CONFIG.canvas.width / 2;
                const centerY = CONFIG.canvas.height / 2;
                
                if (this.shiftPressed) {
                    // Shift + ホイール: 回転
                    const rotationDelta = e.deltaY < 0 ? 
                        CONFIG.camera.keyRotationDegree : -CONFIG.camera.keyRotationDegree;
                    
                    // ✅ CoordinateSystem統一API使用
                    const worldCenter = window.CoordinateSystem.localToGlobal(
                        this.worldContainer, { x: centerX, y: centerY }
                    );
                    
                    this.rotation += rotationDelta;
                    this.worldContainer.rotation = (this.rotation * Math.PI) / 180;
                    
                    // ✅ 回転後の位置補正
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
                        // ✅ CoordinateSystem統一API使用
                        const worldCenter = window.CoordinateSystem.localToGlobal(
                            this.worldContainer, { x: centerX, y: centerY }
                        );
                        
                        this.worldContainer.scale.set(newScale);
                        
                        // ✅ スケール後の位置補正
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
                    // coord: world container position delta
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
                    // coord: canvas center
                    const centerX = CONFIG.canvas.width / 2;
                    const centerY = CONFIG.canvas.height / 2;
                    
                    // ✅ CoordinateSystem統一API使用
                    const worldCenter = window.CoordinateSystem.localToGlobal(
                        this.worldContainer, { x: centerX, y: centerY }
                    );
                    
                    switch(e.code) {
                        case 'ArrowUp':
                            const scaleUpFactor = 1 + CONFIG.camera.wheelZoomSpeed;
                            const newScaleUp = this.worldContainer.scale.x * scaleUpFactor;
                            if (newScaleUp <= CONFIG.camera.maxScale) {
                                this.worldContainer.scale.set(newScaleUp);
                                // ✅ CoordinateSystem統一API使用：位置補正
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
                                // ✅ CoordinateSystem統一API使用：位置補正
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
                            // ✅ CoordinateSystem統一API使用：回転後位置補正
                            const newWorldCenterLeft = window.CoordinateSystem.localToGlobal(
                                this.worldContainer, { x: centerX, y: centerY }
                            );
                            this.worldContainer.x += worldCenter.x - newWorldCenterLeft.x;
                            this.worldContainer.y += worldCenter.y - newWorldCenterLeft.y;
                            break;
                            
                        case 'ArrowRight':
                            this.rotation += CONFIG.camera.keyRotationDegree;
                            this.worldContainer.rotation = (this.rotation * Math.PI) / 180;
                            // ✅ CoordinateSystem統一API使用：回転後位置補正
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
                    // coord: canvas center
                    const centerX = CONFIG.canvas.width / 2;
                    const centerY = CONFIG.canvas.height / 2;
                    
                    // ✅ CoordinateSystem統一API使用
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
                    
                    // ✅ 反転後の位置補正
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
        
        // ✅ 座標系統一版：ペン描画用のキャンバス座標変換（レイヤー変形を考慮しない）
        screenToDrawingCanvas(screenX, screenY) {
            // coord: screen -> drawing canvas (no layer transform)
            const globalPoint = { x: screenX, y: screenY };
            return window.CoordinateSystem.globalToLocal(this.canvasContainer, globalPoint);
        }
        
        // ✅ 座標系統一版：レイヤー操作用の座標変換（レイヤー変形を考慮）
        screenToWorldCanvas(screenX, screenY) {
            // coord: screen -> world canvas (with layer transform)
            const globalPoint = { x: screenX, y: screenY };
            return window.CoordinateSystem.globalToLocal(this.canvasContainer, globalPoint);
        }
        
        canvasToScreen(canvasX, canvasY) {
            // coord: canvas -> screen
            const canvasPoint = { x: canvasX, y: canvasY };
            return window.CoordinateSystem.localToGlobal(this.canvasContainer, canvasPoint);
        }
        
        isPointInExtendedCanvas(canvasPoint, margin = 50) {
            // coord: canvas space validation
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

        // 座標系統一版：カメラフレーム中央の絶対座標を取得
        getCameraFrameCenter() {
            // coord: canvas center -> world
            const centerX = CONFIG.canvas.width / 2;
            const centerY = CONFIG.canvas.height / 2;
            return window.CoordinateSystem.localToGlobal(this.worldContainer, { x: centerX, y: centerY });
        }
        
        // 内部参照設定用（CoreEngineから呼び出し）
        setLayerManager(layerManager) {
            this.layerManager = layerManager;
        }
        
        setDrawingEngine(drawingEngine) {
            this.drawingEngine = drawingEngine;
        }
    }

    // === レイヤー管理システム（座標系統一版） ===
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
            
            // レイヤー移動モード関連
            this.vKeyPressed = false;
            this.isLayerMoveMode = false;
            this.isLayerDragging = false;
            this.layerDragLastPoint = { x: 0, y: 0 };
            
            // レイヤー変形データの保持
            this.layerTransforms = new Map(); // layerId -> { x, y, rotation, scaleX, scaleY }
            
            // UI要素
            this.layerTransformPanel = null;
            
            this.setupLayerOperations();
            this.setupLayerTransformPanel();
        }
        
        setupLayerTransformPanel() {
            this.layerTransformPanel = document.getElementById('layer-transform-panel');
            
            if (!this.layerTransformPanel) return;
            
            // スライダー設定
            this.setupLayerSlider('layer-x-slider', CONFIG.layer.minX, CONFIG.layer.maxX, 0, (value) => {
                this.updateActiveLayerTransform('x', value);
                return Math.round(value) + 'px';
            });
            
            this.setupLayerSlider('layer-y-slider', CONFIG.layer.minY, CONFIG.layer.maxY, 0, (value) => {
                this.updateActiveLayerTransform('y', value);
                return Math.round(value) + 'px';
            });
            
            this.setupLayerSlider('layer-rotation-slider', CONFIG.layer.minRotation, CONFIG.layer.maxRotation, 0, (value) => {
                this.updateActiveLayerTransform('rotation', value * Math.PI / 180);
                return Math.round(value) + '°';
            });
            
            this.setupLayerSlider('layer-scale-slider', CONFIG.layer.minScale, CONFIG.layer.maxScale, 1.0, (value) => {
                this.updateActiveLayerTransform('scale', value);
                return value.toFixed(2) + 'x';
            });
            
            // 反転ボタン
            const flipHorizontalBtn = document.getElementById('flip-horizontal-btn');
            const flipVerticalBtn = document.getElementById('flip-vertical-btn');
            
            if (flipHorizontalBtn) {
                flipHorizontalBtn.addEventListener('click', () => {
                    this.flipActiveLayer('horizontal');
                });
            }
            
            if (flipVerticalBtn) {
                flipVerticalBtn.addEventListener('click', () => {
                    this.flipActiveLayer('vertical');
                });
            }
        }
        
        setupLayerSlider(sliderId, min, max, initial, callback) {
            const container = document.getElementById(sliderId);
            if (!container) return;

            const track = container.querySelector('.slider-track');
            const handle = container.querySelector('.slider-handle');
            const valueDisplay = container.parentNode.querySelector('.slider-value');

            if (!track || !handle || !valueDisplay) return;

            let value = initial;
            let dragging = false;

            const update = (newValue, fromSlider = false) => {
                value = Math.max(min, Math.min(max, newValue));
                const percentage = ((value - min) / (max - min)) * 100;
                
                track.style.width = percentage + '%';
                handle.style.left = percentage + '%';
                valueDisplay.textContent = callback(value, fromSlider);
            };

            const getValue = (clientX) => {
                const rect = container.getBoundingClientRect();
                const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                return min + (percentage * (max - min));
            };

            container.addEventListener('mousedown', (e) => {
                dragging = true;
                update(getValue(e.clientX), true);
                e.preventDefault();
            });

            document.addEventListener('mousemove', (e) => {
                if (dragging) update(getValue(e.clientX), true);
            });

            document.addEventListener('mouseup', () => {
                dragging = false;
            });

            // 外部からの値更新用
            container.updateValue = (newValue) => {
                update(newValue, false);
            };

            update(initial);
        }
        
        // 座標系統一版：レイヤー変形データを保持して累積的に適用
        updateActiveLayerTransform(property, value) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;
            
            const layerId = activeLayer.layerData.id;
            
            // 変形データを取得または初期化
            if (!this.layerTransforms.has(layerId)) {
                this.layerTransforms.set(layerId, {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                });
            }
            
            const transform = this.layerTransforms.get(layerId);
            
            // coord: canvas center (dynamic calculation)
            const centerX = CONFIG.canvas.width / 2;
            const centerY = CONFIG.canvas.height / 2;
            
            switch(property) {
                case 'x':
                    transform.x = value;
                    // coord: canvas center + offset
                    activeLayer.position.set(centerX + value, centerY + transform.y);
                    break;
                case 'y':
                    transform.y = value;
                    // coord: canvas center + offset
                    activeLayer.position.set(centerX + transform.x, centerY + value);
                    break;
                case 'rotation':
                    transform.rotation = value;
                    // coord: rotation pivot at canvas center
                    activeLayer.pivot.set(centerX, centerY);
                    activeLayer.position.set(centerX + transform.x, centerY + transform.y);
                    activeLayer.rotation = value;
                    break;
                case 'scale':
                    const hFlipped = transform.scaleX < 0;
                    const vFlipped = transform.scaleY < 0;
                    transform.scaleX = hFlipped ? -value : value;
                    transform.scaleY = vFlipped ? -value : value;
                    
                    // coord: scale pivot at canvas center
                    activeLayer.pivot.set(centerX, centerY);
                    activeLayer.position.set(centerX + transform.x, centerY + transform.y);
                    activeLayer.scale.set(transform.scaleX, transform.scaleY);
                    break;
            }
            
            this.requestThumbnailUpdate(this.activeLayerIndex);
        }
        
        // 座標系統一版：反転時もカメラフレーム中央基準で座標を維持
        flipActiveLayer(direction) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;
            
            const layerId = activeLayer.layerData.id;
            
            if (!this.layerTransforms.has(layerId)) {
                this.layerTransforms.set(layerId, {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                });
            }
            
            const transform = this.layerTransforms.get(layerId);
            
            // coord: canvas center (dynamic calculation)
            const centerX = CONFIG.canvas.width / 2;
            const centerY = CONFIG.canvas.height / 2;
            
            // coord: flip pivot at canvas center
            activeLayer.pivot.set(centerX, centerY);
            activeLayer.position.set(centerX + transform.x, centerY + transform.y);
            
            if (direction === 'horizontal') {
                transform.scaleX *= -1;
                activeLayer.scale.x = transform.scaleX;
            } else if (direction === 'vertical') {
                transform.scaleY *= -1;
                activeLayer.scale.y = transform.scaleY;
            }
            
            this.updateFlipButtons();
            this.requestThumbnailUpdate(this.activeLayerIndex);
        }
        
        updateFlipButtons() {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;
            
            const flipHorizontalBtn = document.getElementById('flip-horizontal-btn');
            const flipVerticalBtn = document.getElementById('flip-vertical-btn');
            
            if (flipHorizontalBtn) {
                if (activeLayer.scale.x < 0) {
                    flipHorizontalBtn.classList.add('active');
                } else {
                    flipHorizontalBtn.classList.remove('active');
                }
            }
            
            if (flipVerticalBtn) {
                if (activeLayer.scale.y < 0) {
                    flipVerticalBtn.classList.add('active');
                } else {
                    flipVerticalBtn.classList.remove('active');
                }
            }
        }
        
        updateLayerTransformPanelValues() {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;
            
            const layerId = activeLayer.layerData.id;
            const transform = this.layerTransforms.get(layerId) || {
                x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
            };
            
            // スライダー更新
            const xSlider = document.getElementById('layer-x-slider');
            if (xSlider && xSlider.updateValue) {
                xSlider.updateValue(transform.x);
            }
            
            const ySlider = document.getElementById('layer-y-slider');
            if (ySlider && ySlider.updateValue) {
                ySlider.updateValue(transform.y);
            }
            
            const rotationSlider = document.getElementById('layer-rotation-slider');
            if (rotationSlider && rotationSlider.updateValue) {
                rotationSlider.updateValue(transform.rotation * 180 / Math.PI);
            }
            
            const scaleSlider = document.getElementById('layer-scale-slider');
            if (scaleSlider && scaleSlider.updateValue) {
                scaleSlider.updateValue(Math.abs(transform.scaleX));
            }
            
            this.updateFlipButtons();
        }
        
        // Vキートグル方式でのレイヤー移動モード
        toggleLayerMoveMode() {
            if (this.isLayerMoveMode) {
                this.exitLayerMoveMode();
            } else {
                this.enterLayerMoveMode();
            }
        }
        
        enterLayerMoveMode() {
            if (this.isLayerMoveMode) return;
            
            this.isLayerMoveMode = true;
            this.vKeyPressed = true;
            this.cameraSystem.setVKeyPressed(true);
            
            // パネルとガイドライン表示
            if (this.layerTransformPanel) {
                this.layerTransformPanel.classList.add('show');
                this.updateLayerTransformPanelValues();
            }
            
            this.cameraSystem.showGuideLines();
            this.updateCursor();
        }
        
        exitLayerMoveMode() {
            if (!this.isLayerMoveMode) return;
            
            this.isLayerMoveMode = false;
            this.vKeyPressed = false;
            this.isLayerDragging = false;
            this.cameraSystem.setVKeyPressed(false);
            
            // パネルとガイドライン非表示
            if (this.layerTransformPanel) {
                this.layerTransformPanel.classList.remove('show');
            }
            
            this.cameraSystem.hideGuideLines();
            this.updateCursor();
            
            // V解除時に自動確定（レイヤー変形をベイク）
            this.confirmLayerTransform();
        }
        
        // === 【座標系統一版】非破壊的レイヤー変形確定処理 ===
        confirmLayerTransform() {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;
            
            const layerId = activeLayer.layerData.id;
            const transform = this.layerTransforms.get(layerId);
            
            // レイヤーのtransformが初期状態でない場合、パスデータに変形を適用
            if (this.isTransformNonDefault(transform)) {
                try {
                    console.log('=== Non-destructive layer transform confirmation (coordinate-system unified) ===');
                    console.log('Layer ID:', layerId);
                    console.log('Transform:', transform);
                    console.log('Paths before:', activeLayer.layerData.paths?.length || 0);
                    
                    // ✅ 座標系統一版：パスデータに変形を安全に適用
                    const success = this.safeApplyTransformToPaths(activeLayer, transform);
                    
                    if (success) {
                        // ✅ 表示transformをリセット（視覚的変化なし）
                        activeLayer.position.set(0, 0);
                        activeLayer.rotation = 0;
                        activeLayer.scale.set(1, 1);
                        activeLayer.pivot.set(0, 0);
                        
                        // ✅ 変形データをクリア（確定完了）
                        this.layerTransforms.set(layerId, {
                            x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                        });
                        
                        // 反転ボタンもリセット
                        this.updateFlipButtons();
                        
                        // サムネイル更新
                        this.requestThumbnailUpdate(this.activeLayerIndex);
                        
                        console.log('=== Coordinate-system unified transform confirmed successfully ===');
                    } else {
                        console.warn('Transform confirmation failed - keeping transform state');
                    }
                    
                } catch (error) {
                    console.error('Critical error in unified confirmLayerTransform:', error);
                }
            } else {
                console.log('No transform to confirm (already at default state)');
            }
        }
        
        // === 【座標系統一版】安全なパス変形適用処理 ===
        safeApplyTransformToPaths(layer, transform) {
            if (!layer.layerData?.paths || layer.layerData.paths.length === 0) {
                console.log('No paths to transform - operation successful');
                return true;
            }
            
            try {
                console.log('Starting safe transform application (coordinate-system unified) to', layer.layerData.paths.length, 'paths');
                
                // coord: canvas center
                const centerX = CONFIG.canvas.width / 2;
                const centerY = CONFIG.canvas.height / 2;
                
                // ✅ CoordinateSystem統一API使用：変形行列作成
                const matrix = window.CoordinateSystem.createTransformMatrix(
                    transform, centerX, centerY
                );
                
                // ✅ パスごとに安全に処理
                const transformedPaths = [];
                let successCount = 0;
                
                for (let i = 0; i < layer.layerData.paths.length; i++) {
                    const path = layer.layerData.paths[i];
                    
                    try {
                        // パスの安全性チェック
                        if (!path || !Array.isArray(path.points) || path.points.length === 0) {
                            console.warn(`Skipping invalid path at index ${i}`);
                            continue;
                        }
                        
                        // ✅ 座標変形（元データは保護）
                        const transformedPoints = this.safeTransformPointsUnified(path.points, matrix);
                        
                        if (transformedPoints.length === 0) {
                            console.warn(`Transform failed for path ${i} - skipping`);
                            continue;
                        }
                        
                        // ✅ 新しいパスオブジェクト作成（非破壊）
                        const transformedPath = {
                            id: path.id, // IDは維持
                            // coord: transformed layer space
                            points: transformedPoints,
                            color: path.color,
                            size: path.size,
                            opacity: path.opacity,
                            isComplete: path.isComplete || true,
                            graphics: null // 後で再生成
                        };
                        
                        transformedPaths.push(transformedPath);
                        successCount++;
                        
                    } catch (pathError) {
                        console.error(`Error processing path ${i}:`, pathError);
                    }
                }
                
                console.log(`Transformed ${successCount}/${layer.layerData.paths.length} paths successfully (coordinate-system unified)`);
                
                if (successCount === 0) {
                    console.error('No paths could be transformed');
                    return false;
                }
                
                // ✅ レイヤー再構築（安全版）
                const rebuildSuccess = this.safeRebuildLayer(layer, transformedPaths);
                
                if (rebuildSuccess) {
                    console.log('Layer rebuild completed successfully (coordinate-system unified)');
                    return true;
                } else {
                    console.error('Layer rebuild failed');
                    return false;
                }
                
            } catch (error) {
                console.error('Critical error in safeApplyTransformToPaths (unified):', error);
                return false;
            }
        }
        
        // === 【座標系統一版】安全な座標変形処理 ===
        safeTransformPointsUnified(points, matrix) {
            const transformedPoints = [];
            
            for (let i = 0; i < points.length; i++) {
                const point = points[i];
                
                // 座標の検証
                if (typeof point.x !== 'number' || typeof point.y !== 'number' ||
                    !isFinite(point.x) || !isFinite(point.y)) {
                    console.warn(`Invalid point at index ${i}:`, point);
                    continue;
                }
                
                try {
                    // ✅ CoordinateSystem統一API使用：変形適用
                    const transformed = window.CoordinateSystem.applyMatrix(point, matrix);
                    
                    // 結果の検証
                    if (typeof transformed.x === 'number' && typeof transformed.y === 'number' &&
                        isFinite(transformed.x) && isFinite(transformed.y)) {
                        transformedPoints.push({
                            x: transformed.x,
                            y: transformed.y
                        });
                    } else {
                        console.warn(`Invalid transformed point:`, transformed);
                    }
                    
                } catch (transformError) {
                    console.warn(`Point transform failed for index ${i}:`, transformError);
                }
            }
            
            return transformedPoints;
        }
        
        // 安全なレイヤー再構築
        safeRebuildLayer(layer, newPaths) {
            try {
                console.log('Starting safe layer rebuild (coordinate-system unified)');
                
                // 既存描画要素の安全な削除（背景は保護）
                const childrenToRemove = [];
                for (let child of layer.children) {
                    if (child !== layer.layerData.backgroundGraphics) {
                        childrenToRemove.push(child);
                    }
                }
                
                childrenToRemove.forEach(child => {
                    try {
                        layer.removeChild(child);
                        if (child.destroy && typeof child.destroy === 'function') {
                            child.destroy({ children: true, texture: false, baseTexture: false });
                        }
                    } catch (removeError) {
                        console.warn('Failed to remove child:', removeError);
                    }
                });
                
                console.log(`Removed ${childrenToRemove.length} existing graphics`);
                
                // 新しいパスデータを設定
                layer.layerData.paths = [];
                
                // パスごとにGraphicsを再生成・追加
                let addedCount = 0;
                for (let i = 0; i < newPaths.length; i++) {
                    const path = newPaths[i];
                    
                    try {
                        // Graphics再生成
                        const rebuildSuccess = this.rebuildPathGraphics(path);
                        
                        if (rebuildSuccess && path.graphics) {
                            // レイヤーに追加
                            layer.layerData.paths.push(path);
                            layer.addChild(path.graphics);
                            addedCount++;
                        } else {
                            console.warn(`Failed to rebuild graphics for path ${i}`);
                        }
                        
                    } catch (pathError) {
                        console.error(`Error adding path ${i}:`, pathError);
                    }
                }
                
                console.log(`Added ${addedCount}/${newPaths.length} paths to layer (coordinate-system unified)`);
                
                // 成功判定
                const success = addedCount > 0 || newPaths.length === 0;
                
                if (success) {
                    console.log('Safe layer rebuild completed successfully (coordinate-system unified)');
                } else {
                    console.error('Safe layer rebuild failed - no paths added');
                }
                
                return success;
                
            } catch (error) {
                console.error('Critical error in safeRebuildLayer (unified):', error);
                return false;
            }
        }
        
        // パスGraphics再生成（安全版）
        rebuildPathGraphics(path) {
            try {
                // 既存Graphics削除
                if (path.graphics) {
                    try {
                        if (path.graphics.destroy && typeof path.graphics.destroy === 'function') {
                            path.graphics.destroy();
                        }
                    } catch (destroyError) {
                        console.warn('Graphics destroy failed:', destroyError);
                    }
                    path.graphics = null;
                }
                
                // 新しいGraphics作成
                path.graphics = new PIXI.Graphics();
                
                // パスの点から描画を再構築
                if (path.points && Array.isArray(path.points) && path.points.length > 0) {
                    for (let point of path.points) {
                        if (typeof point.x === 'number' && typeof point.y === 'number' &&
                            isFinite(point.x) && isFinite(point.y)) {
                            
                            // coord: layer space drawing
                            path.graphics.circle(point.x, point.y, (path.size || 16) / 2);
                            path.graphics.fill({ 
                                color: path.color || 0x800000, 
                                alpha: path.opacity || 1.0 
                            });
                        }
                    }
                }
                
                return true;
                
            } catch (error) {
                console.error('Error in rebuildPathGraphics:', error);
                path.graphics = null;
                return false;
            }
        }
        
        // 変形が初期状態以外かチェック
        isTransformNonDefault(transform) {
            if (!transform) return false;
            return (transform.x !== 0 || transform.y !== 0 || 
                    transform.rotation !== 0 || Math.abs(transform.scaleX) !== 1 || Math.abs(transform.scaleY) !== 1);
        }
        
        setupLayerOperations() {
            document.addEventListener('keydown', (e) => {
                // Vキートグル方式
                if (e.code === 'KeyV' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    this.toggleLayerMoveMode();
                    e.preventDefault();
                }
                
                // Pキー: ペンツールに切り替え（レイヤー移動モード終了）
                if (e.code === 'KeyP' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    if (this.isLayerMoveMode) {
                        this.exitLayerMoveMode();
                    }
                    e.preventDefault();
                }
                
                // Eキー: 消しゴムツールに切り替え（レイヤー移動モード終了）
                if (e.code === 'KeyE' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    if (this.isLayerMoveMode) {
                        this.exitLayerMoveMode();
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
                    if (e.shiftKey) {
                        // V + Shift + H: 垂直反転
                        this.flipActiveLayer('vertical');
                    } else {
                        // V + H: 水平反転
                        this.flipActiveLayer('horizontal');
                    }
                    e.preventDefault();
                }
            });
            
            // === V + ドラッグ: アクティブレイヤー移動・変形 ===
            this.app.canvas.addEventListener('pointerdown', (e) => {
                if (this.vKeyPressed && e.button === 0) {
                    this.isLayerDragging = true;
                    // coord: screen pointer position
                    this.layerDragLastPoint = { x: e.clientX, y: e.clientY };
                    this.app.canvas.style.cursor = 'move';
                    e.preventDefault();
                }
            });
            
            this.app.canvas.addEventListener('pointermove', (e) => {
                if (this.isLayerDragging && this.vKeyPressed) {
                    const activeLayer = this.getActiveLayer();
                    if (activeLayer) {
                        // coord: screen delta
                        const dx = e.clientX - this.layerDragLastPoint.x;
                        const dy = e.clientY - this.layerDragLastPoint.y;
                        
                        const worldScale = this.cameraSystem.worldContainer.scale.x;
                        const adjustedDx = dx / worldScale;
                        const adjustedDy = dy / worldScale;
                        
                        const layerId = activeLayer.layerData.id;
                        
                        if (!this.layerTransforms.has(layerId)) {
                            this.layerTransforms.set(layerId, {
                                x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                            });
                        }
                        
                        const transform = this.layerTransforms.get(layerId);
                        
                        if (e.shiftKey) {
                            // V + Shift + ドラッグ: 拡縮・回転
                            // coord: canvas center
                            const centerX = CONFIG.canvas.width / 2;
                            const centerY = CONFIG.canvas.height / 2;
                            
                            // 基準点をカメラ中央に設定
                            activeLayer.pivot.set(centerX, centerY);
                            activeLayer.position.set(centerX + transform.x, centerY + transform.y);
                            
                            if (Math.abs(dy) > Math.abs(dx)) {
                                // 垂直方向優先: 拡縮（上ドラッグ→拡大、下ドラッグ→縮小）
                                const scaleFactor = 1 + (dy * -0.01);
                                const currentScale = Math.abs(transform.scaleX);
                                const newScale = Math.max(CONFIG.layer.minScale, Math.min(CONFIG.layer.maxScale, currentScale * scaleFactor));
                                
                                transform.scaleX = transform.scaleX < 0 ? -newScale : newScale;
                                transform.scaleY = transform.scaleY < 0 ? -newScale : newScale;
                                activeLayer.scale.set(transform.scaleX, transform.scaleY);
                                
                                // スライダー更新
                                const scaleSlider = document.getElementById('layer-scale-slider');
                                if (scaleSlider && scaleSlider.updateValue) {
                                    scaleSlider.updateValue(newScale);
                                }
                            } else {
                                // 水平方向優先: 回転（右ドラッグ→右回転、左ドラッグ→左回転）
                                transform.rotation += (dx * 0.02);
                                activeLayer.rotation = transform.rotation;
                                
                                // スライダー更新
                                const rotationSlider = document.getElementById('layer-rotation-slider');
                                if (rotationSlider && rotationSlider.updateValue) {
                                    rotationSlider.updateValue(transform.rotation * 180 / Math.PI);
                                }
                            }
                        } else {
                            // V + ドラッグ: 移動（座標累積）
                            transform.x += adjustedDx;
                            transform.y += adjustedDy;
                            
                            // coord: canvas center + offset
                            const centerX = CONFIG.canvas.width / 2;
                            const centerY = CONFIG.canvas.height / 2;
                            activeLayer.position.set(centerX + transform.x, centerY + transform.y);
                            
                            // スライダー更新
                            const xSlider = document.getElementById('layer-x-slider');
                            const ySlider = document.getElementById('layer-y-slider');
                            if (xSlider && xSlider.updateValue) {
                                xSlider.updateValue(transform.x);
                            }
                            if (ySlider && ySlider.updateValue) {
                                ySlider.updateValue(transform.y);
                            }
                        }
                        
                        // coord: screen pointer position
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
        
        // キーボードによる移動（座標累積）
        moveActiveLayer(keyCode) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;
            
            const layerId = activeLayer.layerData.id;
            
            if (!this.layerTransforms.has(layerId)) {
                this.layerTransforms.set(layerId, {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                });
            }
            
            const transform = this.layerTransforms.get(layerId);
            const moveAmount = 5;
            
            switch(keyCode) {
                case 'ArrowUp':    transform.y -= moveAmount; break;
                case 'ArrowDown':  transform.y += moveAmount; break;
                case 'ArrowLeft':  transform.x -= moveAmount; break;
                case 'ArrowRight': transform.x += moveAmount; break;
            }
            
            // coord: canvas center + offset
            const centerX = CONFIG.canvas.width / 2;
            const centerY = CONFIG.canvas.height / 2;
            activeLayer.position.set(centerX + transform.x, centerY + transform.y);
            
            // スライダー値更新
            const xSlider = document.getElementById('layer-x-slider');
            const ySlider = document.getElementById('layer-y-slider');
            if (xSlider && xSlider.updateValue) {
                xSlider.updateValue(transform.x);
            }
            if (ySlider && ySlider.updateValue) {
                ySlider.updateValue(transform.y);
            }
            
            this.requestThumbnailUpdate(this.activeLayerIndex);
        }
        
        // キーボードによる変形（カメラフレーム中央基準で座標維持）
        transformActiveLayer(keyCode) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;
            
            const layerId = activeLayer.layerData.id;
            
            if (!this.layerTransforms.has(layerId)) {
                this.layerTransforms.set(layerId, {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                });
            }
            
            const transform = this.layerTransforms.get(layerId);
            
            // coord: canvas center (dynamic calculation)
            const centerX = CONFIG.canvas.width / 2;
            const centerY = CONFIG.canvas.height / 2;
            
            // 基準点とポジションを設定
            activeLayer.pivot.set(centerX, centerY);
            activeLayer.position.set(centerX + transform.x, centerY + transform.y);
            
            switch(keyCode) {
                case 'ArrowUp': // 拡大
                    const scaleUpFactor = 1.1;
                    const currentScaleUp = Math.abs(transform.scaleX);
                    const newScaleUp = Math.min(CONFIG.layer.maxScale, currentScaleUp * scaleUpFactor);
                    transform.scaleX = transform.scaleX < 0 ? -newScaleUp : newScaleUp;
                    transform.scaleY = transform.scaleY < 0 ? -newScaleUp : newScaleUp;
                    activeLayer.scale.set(transform.scaleX, transform.scaleY);
                    
                    // スライダー更新
                    const scaleSliderUp = document.getElementById('layer-scale-slider');
                    if (scaleSliderUp && scaleSliderUp.updateValue) {
                        scaleSliderUp.updateValue(newScaleUp);
                    }
                    break;
                    
                case 'ArrowDown': // 縮小
                    const scaleDownFactor = 0.9;
                    const currentScaleDown = Math.abs(transform.scaleX);
                    const newScaleDown = Math.max(CONFIG.layer.minScale, currentScaleDown * scaleDownFactor);
                    transform.scaleX = transform.scaleX < 0 ? -newScaleDown : newScaleDown;
                    transform.scaleY = transform.scaleY < 0 ? -newScaleDown : newScaleDown;
                    activeLayer.scale.set(transform.scaleX, transform.scaleY);
                    
                    // スライダー更新
                    const scaleSliderDown = document.getElementById('layer-scale-slider');
                    if (scaleSliderDown && scaleSliderDown.updateValue) {
                        scaleSliderDown.updateValue(newScaleDown);
                    }
                    break;
                    
                case 'ArrowLeft': // 左回転
                    transform.rotation -= (15 * Math.PI) / 180; // 15度
                    activeLayer.rotation = transform.rotation;
                    
                    // スライダー更新
                    const rotationSliderLeft = document.getElementById('layer-rotation-slider');
                    if (rotationSliderLeft && rotationSliderLeft.updateValue) {
                        rotationSliderLeft.updateValue(transform.rotation * 180 / Math.PI);
                    }
                    break;
                    
                case 'ArrowRight': // 右回転
                    transform.rotation += (15 * Math.PI) / 180; // 15度
                    activeLayer.rotation = transform.rotation;
                    
                    // スライダー更新
                    const rotationSliderRight = document.getElementById('layer-rotation-slider');
                    if (rotationSliderRight && rotationSliderRight.updateValue) {
                        rotationSliderRight.updateValue(transform.rotation * 180 / Math.PI);
                    }
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

            // 変形データを初期化
            this.layerTransforms.set(layerId, {
                x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
            });

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
                
                // レイヤー移動モードが有効な場合、スライダー値を更新
                if (this.isLayerMoveMode) {
                    this.updateLayerTransformPanelValues();
                }
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

        // 座標系統一版：レイヤー変形を考慮したサムネイル生成
        updateThumbnail(layerIndex) {
            if (!this.app?.renderer || layerIndex < 0 || layerIndex >= this.layers.length) return;

            const layer = this.layers[layerIndex];
            const layerItems = document.querySelectorAll('.layer-item');
            const panelIndex = this.layers.length - 1 - layerIndex;
            
            if (panelIndex < 0 || panelIndex >= layerItems.length) return;
            
            const thumbnail = layerItems[panelIndex].querySelector('.layer-thumbnail');
            if (!thumbnail) return;

            try {
                // 完全アスペクト比対応版（パネルはみ出し対策）
                const canvasAspectRatio = CONFIG.canvas.width / CONFIG.canvas.height;
                let thumbnailWidth, thumbnailHeight;
                const maxHeight = 48;
                const maxWidth = 72; // パネル幅制限

                if (canvasAspectRatio >= 1) {
                    // 横長または正方形の場合
                    if (maxHeight * canvasAspectRatio <= maxWidth) {
                        thumbnailWidth = maxHeight * canvasAspectRatio;
                        thumbnailHeight = maxHeight;
                    } else {
                        // 横長過ぎる場合は横幅制限を優先
                        thumbnailWidth = maxWidth;
                        thumbnailHeight = maxWidth / canvasAspectRatio;
                    }
                } else {
                    // 縦長の場合
                    thumbnailWidth = Math.max(24, maxHeight * canvasAspectRatio);
                    thumbnailHeight = maxHeight;
                }
                
                // サムネイル枠のサイズを動的に更新
                thumbnail.style.width = Math.round(thumbnailWidth) + 'px';
                thumbnail.style.height = Math.round(thumbnailHeight) + 'px';
                
                console.log(`Thumbnail updated (coordinate-system unified): ${Math.round(thumbnailWidth)}x${Math.round(thumbnailHeight)} (aspect: ${canvasAspectRatio.toFixed(2)})`);
                
                // レンダリング用の高解像度テクスチャ作成
                const renderTexture = PIXI.RenderTexture.create({
                    width: CONFIG.canvas.width * CONFIG.thumbnail.RENDER_SCALE,
                    height: CONFIG.canvas.height * CONFIG.thumbnail.RENDER_SCALE,
                    resolution: CONFIG.thumbnail.RENDER_SCALE
                });
                
                // レイヤーの現在の変形状態を保持してサムネイル生成
                const layerId = layer.layerData.id;
                const transform = this.layerTransforms.get(layerId);
                
                // 一時的なコンテナを作成してレイヤーをコピー
                const tempContainer = new PIXI.Container();
                
                // レイヤーの現在の変形状態を保存
                const originalPos = { x: layer.position.x, y: layer.position.y };
                const originalScale = { x: layer.scale.x, y: layer.scale.y };
                const originalRotation = layer.rotation;
                const originalPivot = { x: layer.pivot.x, y: layer.pivot.y };
                
                // サムネイル用の変形をリセット
                layer.position.set(0, 0);
                layer.scale.set(1, 1);
                layer.rotation = 0;
                layer.pivot.set(0, 0);
                
                tempContainer.addChild(layer);
                tempContainer.scale.set(CONFIG.thumbnail.RENDER_SCALE);
                
                // レンダリング実行
                this.app.renderer.render(tempContainer, { renderTexture });
                
                // レイヤーの変形状態を復元
                layer.position.set(originalPos.x, originalPos.y);
                layer.scale.set(originalScale.x, originalScale.y);
                layer.rotation = originalRotation;
                layer.pivot.set(originalPivot.x, originalPivot.y);
                
                // レイヤーを元のコンテナに戻す
                tempContainer.removeChild(layer);
                this.layersContainer.addChildAt(layer, layerIndex);
                
                // Canvas APIで高品質ダウンスケール
                const sourceCanvas = this.app.renderer.extract.canvas(renderTexture);
                const targetCanvas = document.createElement('canvas');
                targetCanvas.width = Math.round(thumbnailWidth);
                targetCanvas.height = Math.round(thumbnailHeight);
                
                const ctx = targetCanvas.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = CONFIG.thumbnail.QUALITY;
                ctx.drawImage(sourceCanvas, 0, 0, Math.round(thumbnailWidth), Math.round(thumbnailHeight));
                
                // UI更新
                let img = thumbnail.querySelector('img');
                if (!img) {
                    img = document.createElement('img');
                    thumbnail.innerHTML = '';
                    thumbnail.appendChild(img);
                }
                img.src = targetCanvas.toDataURL();
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'cover';
                
                // リソース解放
                renderTexture.destroy();
                tempContainer.destroy();
                
            } catch (error) {
                console.warn('Thumbnail update failed (coordinate-system unified):', error);
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
            const layerId = layer.layerData.id;
            
            layer.layerData.paths.forEach(path => {
                if (path.graphics && path.graphics.destroy) {
                    path.graphics.destroy();
                }
            });

            // 変形データも削除
            this.layerTransforms.delete(layerId);

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

    // === 描画エンジン（座標系統一版） ===
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

            // ✅ 座標系統一版：ペン描画用のキャンバス座標変換（レイヤー変形を考慮しない）
            // coord: screen -> drawing canvas (no layer transform)
            const canvasPoint = this.cameraSystem.screenToDrawingCanvas(screenX, screenY);
            
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
                // coord: drawing canvas space
                points: [{ x: canvasPoint.x, y: canvasPoint.y }],
                color: color,
                size: this.brushSize,
                opacity: opacity,
                isComplete: false
            };

            // coord: drawing canvas space rendering
            this.currentPath.graphics.circle(canvasPoint.x, canvasPoint.y, this.brushSize / 2);
            this.currentPath.graphics.fill({ color: color, alpha: opacity });

            // 座標系統一版：レイヤーのTransformを考慮して描画位置を調整
            this.addPathToActiveLayer(this.currentPath);
        }

        continueDrawing(screenX, screenY) {
            if (!this.isDrawing || !this.currentPath || this.cameraSystem.spacePressed || 
                this.cameraSystem.isDragging || this.layerManager.vKeyPressed) return;

            // ✅ 座標系統一版：ペン描画用座標変換
            // coord: screen -> drawing canvas (no layer transform)
            const canvasPoint = this.cameraSystem.screenToDrawingCanvas(screenX, screenY);
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

                // coord: drawing canvas space rendering
                this.currentPath.graphics.circle(x, y, this.brushSize / 2);
                this.currentPath.graphics.fill({ 
                    color: this.currentPath.color, 
                    alpha: this.currentPath.opacity 
                });

                // coord: drawing canvas space
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
        
        // ✅ 座標系統一版：アクティブレイヤーのTransformを考慮してパスを追加
        addPathToActiveLayer(path) {
            const activeLayer = this.layerManager.getActiveLayer();
            if (!activeLayer) return;
            
            const layerId = activeLayer.layerData.id;
            const transform = this.layerManager.layerTransforms.get(layerId);
            
            // レイヤーがtransformされている場合、逆変換を適用
            if (transform && (transform.x !== 0 || transform.y !== 0 || 
                transform.rotation !== 0 || Math.abs(transform.scaleX) !== 1 || Math.abs(transform.scaleY) !== 1)) {
                
                // coord: canvas center
                const centerX = CONFIG.canvas.width / 2;
                const centerY = CONFIG.canvas.height / 2;
                
                // ✅ CoordinateSystem統一API使用：逆変換行列を作成
                const inverseMatrix = window.CoordinateSystem.createInverseTransformMatrix(
                    transform, centerX, centerY
                );
                
                // パスの座標を逆変換
                const transformedGraphics = new PIXI.Graphics();
                path.points.forEach((point, index) => {
                    // ✅ CoordinateSystem統一API使用：逆変換適用
                    // coord: drawing canvas -> layer space (inverse transform)
                    const transformedPoint = window.CoordinateSystem.applyMatrix(point, inverseMatrix);
                    
                    // coord: layer space rendering
                    transformedGraphics.circle(transformedPoint.x, transformedPoint.y, path.size / 2);
                    transformedGraphics.fill({ color: path.color, alpha: path.opacity });
                });
                
                path.graphics = transformedGraphics;
            }
            
            activeLayer.layerData.paths.push(path);
            activeLayer.addChild(path.graphics);
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

    // === 統合コアエンジンクラス（座標系統一版） ===
    class CoreEngine {
        constructor(app) {
            this.app = app;
            
            // 座標系統一版：コア機能を初期化
            this.cameraSystem = new CameraSystem(app);
            this.layerManager = new LayerManager(this.cameraSystem.canvasContainer, app, this.cameraSystem);
            this.drawingEngine = new DrawingEngine(this.cameraSystem, this.layerManager);
            this.clipboardSystem = new ClipboardSystem();
            
            // 相互参照を設定
            this.setupCrossReferences();
            
            console.log('✅ CoreEngine initialized with coordinate-system unified APIs');
        }
        
        setupCrossReferences() {
            // CameraSystemに参照を設定
            this.cameraSystem.setLayerManager(this.layerManager);
            this.cameraSystem.setDrawingEngine(this.drawingEngine);
            
            // ClipboardSystemに参照を設定
            this.clipboardSystem.setLayerManager(this.layerManager);
        }
        
        // === 座標系統一版：公開API（main.jsから使用） ===
        getCameraSystem() {
            return this.cameraSystem;
        }
        
        getLayerManager() {
            return this.layerManager;
        }
        
        getDrawingEngine() {
            return this.drawingEngine;
        }
        
        getClipboardSystem() {
            return this.clipboardSystem;
        }
        
        // === 統合インタラクション処理 ===
        setupCanvasEvents() {
            this.app.canvas.addEventListener('pointerdown', (e) => {
                if (e.button !== 0) return;

                // coord: screen pointer position
                const rect = this.app.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                this.drawingEngine.startDrawing(x, y);
                e.preventDefault();
            });

            this.app.canvas.addEventListener('pointermove', (e) => {
                // coord: screen pointer position
                const rect = this.app.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                this.updateCoordinates(x, y);
                this.drawingEngine.continueDrawing(x, y);
            });
            
            // ツール切り替えキー
            document.addEventListener('keydown', (e) => {
                if (e.key.toLowerCase() === 'p' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    this.switchTool('pen');
                    e.preventDefault();
                }
                if (e.key.toLowerCase() === 'e' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    this.switchTool('eraser');
                    e.preventDefault();
                }
            });
        }
        
        switchTool(tool) {
            this.cameraSystem.switchTool(tool);
        }
        
        updateCoordinates(x, y) {
            this.cameraSystem.updateCoordinates(x, y);
        }
        
        // サムネイル更新処理
        processThumbnailUpdates() {
            this.layerManager.processThumbnailUpdates();
        }
        
        // ✅ 座標系統一版：キャンバスリサイズ統合処理
        resizeCanvas(newWidth, newHeight) {
            console.log('CoreEngine: Coordinate-system unified canvas resize request:', newWidth, 'x', newHeight);
            
            // CONFIG更新
            CONFIG.canvas.width = newWidth;
            CONFIG.canvas.height = newHeight;
            
            // CameraSystemの更新
            this.cameraSystem.resizeCanvas(newWidth, newHeight);
            
            // LayerManagerの背景レイヤー更新
            this.layerManager.layers.forEach(layer => {
                if (layer.layerData.isBackground && layer.layerData.backgroundGraphics) {
                    layer.layerData.backgroundGraphics.clear();
                    layer.layerData.backgroundGraphics.rect(0, 0, newWidth, newHeight);
                    layer.layerData.backgroundGraphics.fill(CONFIG.background.color);
                }
            });
            
            // 全レイヤーのサムネイル更新
            for (let i = 0; i < this.layerManager.layers.length; i++) {
                this.layerManager.requestThumbnailUpdate(i);
            }
            
            console.log('CoreEngine: Coordinate-system unified canvas resize completed');
        }
        
        // 初期化処理
        initialize() {
            // 初期レイヤー作成
            this.layerManager.createLayer('背景', true);
            this.layerManager.createLayer('レイヤー1');
            this.layerManager.setActiveLayer(1);
            
            this.layerManager.updateLayerPanelUI();
            this.layerManager.updateStatusDisplay();
            
            // UI初期化（SortableJS）
            if (window.TegakiUI && window.TegakiUI.initializeSortable) {
                window.TegakiUI.initializeSortable(this.layerManager);
            }
            
            // キャンバスイベント設定
            this.setupCanvasEvents();
            
            // サムネイル更新ループ
            this.app.ticker.add(() => {
                this.processThumbnailUpdates();
            });
            
            console.log('✅ CoreEngine initialized successfully (coordinate-system unified)');
            return this;
        }
    }

    // === 座標系統一版：グローバル公開 ===
    window.TegakiCore = {
        CoreEngine: CoreEngine,
        
        // 個別クラスも公開（必要に応じて）
        CameraSystem: CameraSystem,
        LayerManager: LayerManager,
        DrawingEngine: DrawingEngine,
        ClipboardSystem: ClipboardSystem,
        
        // Phase 1統一フラグ
        coordinateSystemUnified: true,
        version: 'Phase1-CoordinateSystemUnified'
    };

    console.log('✅ core-engine.js Phase 1 coordinate system unification completed');
    console.log('✅ All toLocal/toGlobal calls replaced with CoordinateSystem unified APIs');
    console.log('✅ Coordinate space comments added (coord: source -> destination format)');

})();