// ===== engine/layer-system.js - Twin-Star Architecture =====
// 責任: レイヤー管理（データ・変形・履歴・クリップボード・サムネイル）

(function() {
    'use strict';
    
    const CONFIG = window.TegakiConfig;
    
    class LayerSystem {
        constructor(app, coordinateSystem, drawingSystem) {
            this.app = app;
            this.coord = coordinateSystem;
            this.drawing = drawingSystem;
            
            // レイヤーデータ
            this.layers = [];
            this.activeLayerIndex = -1;
            this.layerCounter = 0;
            this.thumbnailUpdateQueue = new Set();
            
            // レイヤーコンテナ（CameraSystemから設定される）
            this.layersContainer = new PIXI.Container();
            this.layersContainer.label = 'layersContainer';
            
            // レイヤー移動モード関連
            this.vKeyPressed = false;
            this.isLayerMoveMode = false;
            this.isLayerDragging = false;
            this.layerDragLastPoint = { x: 0, y: 0 };
            
            // レイヤー変形データの保持
            this.layerTransforms = new Map(); // layerId -> { x, y, rotation, scaleX, scaleY }
            
            // 履歴管理
            this.history = [];
            this.historyIndex = -1;
            this.maxHistorySize = CONFIG.history.maxSize;
            
            // クリップボード
            this.clipboard = null;
            
            // 選択範囲
            this.selection = null;
            
            // UI要素
            this.layerTransformPanel = null;
            
            // 内部参照
            this.cameraSystem = null;
            
            this.setupLayerOperations();
            this.setupLayerTransformPanel();
        }
        
        // === レイヤー基本操作 ===
        
        create(name, isBackground = false) {
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
                bg.rect(0, 0, CONFIG.canvas.defaultWidth, CONFIG.canvas.defaultHeight);
                bg.fill(CONFIG.background.color);
                layer.addChild(bg);
                layer.layerData.backgroundGraphics = bg;
            }

            this.layers.push(layer);
            this.layersContainer.addChild(layer);
            
            const index = this.layers.length - 1;
            this.setActiveLayer(index);
            
            return { layer, index };
        }

        delete(layerIndex) {
            if (this.layers.length <= 1) return false;
            if (layerIndex < 0 || layerIndex >= this.layers.length) return false;

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
            
            return true;
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
        
        // === レイヤー変形システム ===
        
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
        
        // レイヤー変形データを保持して累積的に適用（カメラフレーム中央基準）
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
            
            // カメラフレーム中央を基準点として設定（動的計算）
            const centerX = CONFIG.canvas.defaultWidth / 2;
            const centerY = CONFIG.canvas.defaultHeight / 2;
            
            switch(property) {
                case 'x':
                    transform.x = value;
                    activeLayer.position.set(centerX + value, centerY + transform.y);
                    break;
                case 'y':
                    transform.y = value;
                    activeLayer.position.set(centerX + transform.x, centerY + value);
                    break;
                case 'rotation':
                    transform.rotation = value;
                    activeLayer.pivot.set(centerX, centerY);
                    activeLayer.position.set(centerX + transform.x, centerY + transform.y);
                    activeLayer.rotation = value;
                    break;
                case 'scale':
                    const hFlipped = transform.scaleX < 0;
                    const vFlipped = transform.scaleY < 0;
                    transform.scaleX = hFlipped ? -value : value;
                    transform.scaleY = vFlipped ? -value : value;
                    
                    activeLayer.pivot.set(centerX, centerY);
                    activeLayer.position.set(centerX + transform.x, centerY + transform.y);
                    activeLayer.scale.set(transform.scaleX, transform.scaleY);
                    break;
            }
            
            this.requestThumbnailUpdate(this.activeLayerIndex);
        }
        
        // 反転時もカメラフレーム中央基準で座標を維持
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
            
            // カメラフレーム中央を動的に計算して基準点に設定
            const centerX = CONFIG.canvas.defaultWidth / 2;
            const centerY = CONFIG.canvas.defaultHeight / 2;
            
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
        
        // 変形データから現在値を取得してスライダー更新
        updateLayerTransformPanelValues() {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;
            
            const layerId = activeLayer.layerData.id;
            const transform = this.layerTransforms.get(layerId) || {
                x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
            };
            
            // X位置スライダー更新
            const xSlider = document.getElementById('layer-x-slider');
            if (xSlider && xSlider.updateValue) {
                xSlider.updateValue(transform.x);
            }
            
            // Y位置スライダー更新
            const ySlider = document.getElementById('layer-y-slider');
            if (ySlider && ySlider.updateValue) {
                ySlider.updateValue(transform.y);
            }
            
            // 回転スライダー更新
            const rotationSlider = document.getElementById('layer-rotation-slider');
            if (rotationSlider && rotationSlider.updateValue) {
                rotationSlider.updateValue(transform.rotation * 180 / Math.PI);
            }
            
            // 拡縮スライダー更新
            const scaleSlider = document.getElementById('layer-scale-slider');
            if (scaleSlider && scaleSlider.updateValue) {
                scaleSlider.updateValue(Math.abs(transform.scaleX));
            }
            
            this.updateFlipButtons();
        }
        
        // === レイヤー移動モード ===
        
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
                        
                        const layerId = activeLayer.layerData.id;
                        
                        if (!this.layerTransforms.has(layerId)) {
                            this.layerTransforms.set(layerId, {
                                x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                            });
                        }
                        
                        const transform = this.layerTransforms.get(layerId);
                        
                        if (e.shiftKey) {
                            // V + Shift + ドラッグの操作方向（直感的操作）
                            const centerX = CONFIG.canvas.defaultWidth / 2;
                            const centerY = CONFIG.canvas.defaultHeight / 2;
                            
                            // 基準点をカメラ中央に設定
                            activeLayer.pivot.set(centerX, centerY);
                            activeLayer.position.set(centerX + transform.x, centerY + transform.y);
                            
                            if (Math.abs(dy) > Math.abs(dx)) {
                                // 垂直方向優先: 拡縮（上ドラッグ→拡大、下ドラッグ→縮小）
                                const scaleFactor = 1 + (dy * -0.01); // 方向を逆転（-0.01）
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
                                transform.rotation += (dx * 0.02); // dxを使用（正の方向）
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
                            
                            // 位置を更新
                            const centerX = CONFIG.canvas.defaultWidth / 2;
                            const centerY = CONFIG.canvas.defaultHeight / 2;
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
            if (this.cameraSystem) {
                this.cameraSystem.setVKeyPressed(true);
            }
            
            // パネルとガイドライン表示
            if (this.layerTransformPanel) {
                this.layerTransformPanel.classList.add('show');
                this.updateLayerTransformPanelValues();
            }
            
            // ガイドライン表示
            if (this.cameraSystem) {
                this.cameraSystem.showGuideLines();
            }
            
            this.updateCursor();
        }
        
        // V解除が確定（確定ボタン削除）
        exitLayerMoveMode() {
            if (!this.isLayerMoveMode) return;
            
            this.isLayerMoveMode = false;
            this.vKeyPressed = false;
            this.isLayerDragging = false;
            if (this.cameraSystem) {
                this.cameraSystem.setVKeyPressed(false);
            }
            
            // パネルとガイドライン非表示
            if (this.layerTransformPanel) {
                this.layerTransformPanel.classList.remove('show');
            }
            
            // ガイドライン非表示
            if (this.cameraSystem) {
                this.cameraSystem.hideGuideLines();
            }
            
            this.updateCursor();
            
            // V解除時に自動確定（レイヤー変形をベイク）
            this.confirmLayerTransform();
        }
        
        // === 非破壊的レイヤー変形確定処理 ===
        confirmLayerTransform() {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;
            
            const layerId = activeLayer.layerData.id;
            const transform = this.layerTransforms.get(layerId);
            
            // レイヤーのtransformが初期状態でない場合、パスデータに変形を適用
            if (this.isTransformNonDefault(transform)) {
                try {
                    console.log('=== Non-destructive layer transform confirmation started ===');
                    console.log('Layer ID:', layerId);
                    console.log('Transform:', transform);
                    console.log('Paths before:', activeLayer.layerData.paths?.length || 0);
                    
                    // パスデータに変形を安全に適用
                    const success = this.safeApplyTransformToPaths(activeLayer, transform);
                    
                    if (success) {
                        // 表示transformをリセット（視覚的変化なし）
                        activeLayer.position.set(0, 0);
                        activeLayer.rotation = 0;
                        activeLayer.scale.set(1, 1);
                        activeLayer.pivot.set(0, 0);
                        
                        // 変形データをクリア（確定完了）
                        this.layerTransforms.set(layerId, {
                            x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                        });
                        
                        // 反転ボタンもリセット
                        this.updateFlipButtons();
                        
                        // サムネイル更新
                        this.requestThumbnailUpdate(this.activeLayerIndex);
                        
                        console.log('=== Non-destructive layer transform confirmed successfully ===');
                    } else {
                        console.warn('Transform confirmation failed - keeping transform state');
                    }
                    
                } catch (error) {
                    console.error('Critical error in confirmLayerTransform:', error);
                    // エラー時は変形状態を維持（安全対策）
                }
            } else {
                console.log('No transform to confirm (already at default state)');
            }
        }
        
        // 安全なパス変形適用処理
        safeApplyTransformToPaths(layer, transform) {
            if (!layer.layerData?.paths || layer.layerData.paths.length === 0) {
                console.log('No paths to transform - operation successful');
                return true;
            }
            
            try {
                console.log('Starting safe transform application to', layer.layerData.paths.length, 'paths');
                
                const centerX = CONFIG.canvas.defaultWidth / 2;
                const centerY = CONFIG.canvas.defaultHeight / 2;
                
                // より精密な変形行列作成
                const matrix = this.createTransformMatrix(transform, centerX, centerY);
                
                // パスごとに安全に処理
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
                        
                        // 座標変形（元データは保護）
                        const transformedPoints = this.safeTransformPoints(path.points, matrix);
                        
                        if (transformedPoints.length === 0) {
                            console.warn(`Transform failed for path ${i} - skipping`);
                            continue;
                        }
                        
                        // 新しいパスオブジェクト作成（非破壊）
                        const transformedPath = {
                            id: path.id, // IDは維持
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
                        // 個別パスエラーは無視して続行
                    }
                }
                
                console.log(`Transformed ${successCount}/${layer.layerData.paths.length} paths successfully`);
                
                if (successCount === 0) {
                    console.error('No paths could be transformed');
                    return false;
                }
                
                // レイヤー再構築（安全版）
                const rebuildSuccess = this.safeRebuildLayer(layer, transformedPaths);
                
                if (rebuildSuccess) {
                    console.log('Layer rebuild completed successfully');
                    return true;
                } else {
                    console.error('Layer rebuild failed');
                    return false;
                }
                
            } catch (error) {
                console.error('Critical error in safeApplyTransformToPaths:', error);
                return false;
            }
        }
        
        // 精密変形行列作成
        createTransformMatrix(transform, centerX, centerY) {
            const matrix = new PIXI.Matrix();
            
            // 変形の順序: 移動 → 回転 → スケール → 移動戻し
            matrix.translate(centerX + transform.x, centerY + transform.y);
            matrix.rotate(transform.rotation);
            matrix.scale(transform.scale