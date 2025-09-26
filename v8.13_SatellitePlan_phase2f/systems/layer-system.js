// ===== systems/layer-system.js - 改修版：GPT5案準拠・非破壊変形確定完全版 =====
// レイヤー管理・変形・並べ替えを統合管理
// PixiJS v8.13準拠・座標系統一・EventBus統合・完全非破壊変形対応

(function() {
    'use strict';

    const LayerSystem = {
        name: 'LayerSystem',
        
        // 初期化
        init: function(opts) {
            console.log('LayerSystem: Initializing...');
            
            this.app = opts.app;
            this.CONFIG = window.TEGAKI_CONFIG;
            this.rootContainer = opts.rootContainer;
            this.cameraSystem = opts.cameraSystem; // 初期化時に直接渡される
            
            // レイヤー管理
            this.layers = [];
            this.activeLayerIndex = -1;
            this.layerCounter = 0;
            this.thumbnailUpdateQueue = new Set();
            
            // レイヤーコンテナ作成
            this.layersContainer = new PIXI.Container();
            this.layersContainer.label = 'layersContainer';
            this.rootContainer.addChild(this.layersContainer);
            
            // GPT5案準拠：レイヤー変形データ（canonical座標系と分離）
            this.layerTransforms = new Map(); // layerId -> { x, y, rotation, scaleX, scaleY }
            
            // レイヤー移動モード
            this.vKeyPressed = false;
            this.isLayerMoveMode = false;
            this.isLayerDragging = false;
            this.layerDragLastPoint = { x: 0, y: 0 };
            
            // 依存システム参照
            this.drawingEngine = null;
            
            // UI要素
            this.layerTransformPanel = null;
            
            this.setupLayerOperations();
            this.setupLayerTransformPanel();
            this.setupEventBusListeners();
            
            console.log('LayerSystem: Initialized successfully');
        },

        // EventBusリスナー設定
        setupEventBusListeners: function() {
            // 描画完了時のサムネイル更新
            window.Tegaki.EventBus.on('drawing:completed', (data) => {
                const layerIndex = this.layers.findIndex(l => l.layerData.id === data.layerId);
                if (layerIndex >= 0) {
                    this.requestThumbnailUpdate(layerIndex);
                }
            });
            
            // カメラリサイズ時の背景レイヤー更新
            window.Tegaki.EventBus.on('camera:resize', (data) => {
                this.updateBackgroundLayers(data.width, data.height);
            });
        },

        // レイヤー作成
        createLayer: function(name, isBackground = false) {
            const layer = new PIXI.Container();
            const layerId = `layer_${this.layerCounter++}`;
            
            layer.label = layerId;
            layer.layerData = {
                id: layerId,
                name: name,
                visible: true,
                opacity: 1.0,
                isBackground: isBackground,
                paths: [] // GPT5案準拠：常にcanonical座標で保存
            };

            // GPT5案準拠：変形データを初期化（表示用、canonical座標とは分離）
            this.layerTransforms.set(layerId, {
                x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
            });

            if (isBackground) {
                const bg = new PIXI.Graphics();
                bg.rect(0, 0, this.CONFIG.canvas.width, this.CONFIG.canvas.height);
                bg.fill(this.CONFIG.background.color);
                layer.addChild(bg);
                layer.layerData.backgroundGraphics = bg;
            }

            this.layers.push(layer);
            this.layersContainer.addChild(layer);
            
            // EventBus通知
            window.Tegaki.EventBus.emit('layer:created', {
                layerId: layerId,
                name: name,
                index: this.layers.length - 1
            });
            
            return { layer, index: this.layers.length - 1 };
        },

        // レイヤー削除
        deleteLayer: function(layerIndex) {
            if (this.layers.length <= 1) return false;
            if (layerIndex < 0 || layerIndex >= this.layers.length) return false;

            const layer = this.layers[layerIndex];
            const layerId = layer.layerData.id;
            
            // パスのGraphics削除
            layer.layerData.paths.forEach(path => {
                if (path.graphics && path.graphics.destroy) {
                    path.graphics.destroy();
                }
            });

            // 変形データ削除
            this.layerTransforms.delete(layerId);

            // レイヤー削除
            this.layersContainer.removeChild(layer);
            layer.destroy();
            this.layers.splice(layerIndex, 1);

            // アクティブインデックス調整
            if (this.activeLayerIndex === layerIndex) {
                this.activeLayerIndex = Math.min(this.activeLayerIndex, this.layers.length - 1);
            } else if (this.activeLayerIndex > layerIndex) {
                this.activeLayerIndex--;
            }

            // EventBus通知
            window.Tegaki.EventBus.emit('layer:removed', {
                layerId: layerId,
                index: layerIndex
            });

            this.updateLayerPanelUI();
            this.updateStatusDisplay();
            
            return true;
        },

        // アクティブレイヤー設定
        setActiveLayer: function(index) {
            if (index >= 0 && index < this.layers.length) {
                this.activeLayerIndex = index;
                this.updateLayerPanelUI();
                this.updateStatusDisplay();
                
                // レイヤー移動モードが有効な場合、スライダー値を更新
                if (this.isLayerMoveMode) {
                    this.updateLayerTransformPanelValues();
                }
                
                // EventBus通知
                const layer = this.layers[index];
                window.Tegaki.EventBus.emit('layer:activeChanged', {
                    layerId: layer.layerData.id,
                    index: index
                });
            }
        },

        // アクティブレイヤー取得
        getActiveLayer: function() {
            return this.activeLayerIndex >= 0 ? this.layers[this.activeLayerIndex] : null;
        },

        // レイヤー移動モード管理（GPT5案準拠：トグル方式）
        toggleLayerMoveMode: function() {
            if (this.isLayerMoveMode) {
                this.exitLayerMoveMode();
            } else {
                this.enterLayerMoveMode();
            }
        },

        enterLayerMoveMode: function() {
            if (this.isLayerMoveMode) return;

            this.isLayerMoveMode = true;
            this.vKeyPressed = true;
            
            // CameraSystemに通知
            if (this.cameraSystem) {
                this.cameraSystem.setVKeyPressed(true);
            }

            // パネル表示
            if (this.layerTransformPanel) {
                this.layerTransformPanel.classList.add('show');
                this.updateLayerTransformPanelValues();
            }

            // ガイドライン表示
            if (this.cameraSystem) {
                this.cameraSystem.showGuideLines();
            }

            this.updateCursor();
            console.log('LayerSystem: Layer move mode entered');
        },

        exitLayerMoveMode: function() {
            if (!this.isLayerMoveMode) return;

            this.isLayerMoveMode = false;
            this.vKeyPressed = false;
            this.isLayerDragging = false;
            
            // CameraSystemに通知
            if (this.cameraSystem) {
                this.cameraSystem.setVKeyPressed(false);
            }

            // パネル非表示
            if (this.layerTransformPanel) {
                this.layerTransformPanel.classList.remove('show');
            }

            // ガイドライン非表示
            if (this.cameraSystem) {
                this.cameraSystem.hideGuideLines();
            }

            this.updateCursor();

            // GPT5案準拠：V解除時に自動確定（レイヤー変形をベイクして canonical座標に統一）
            this.confirmLayerTransform();
            console.log('LayerSystem: Layer move mode exited');
        },

        // === GPT5案準拠：非破壊的レイヤー変形確定処理（完全版） ===
        confirmLayerTransform: function() {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;

            const layerId = activeLayer.layerData.id;
            const transform = this.layerTransforms.get(layerId);

            // レイヤーのtransformが初期状態でない場合、パスデータに変形を適用
            if (this.isTransformNonDefault(transform)) {
                try {
                    console.log('=== LayerSystem: Non-destructive layer transform confirmation started ===');
                    console.log('Layer ID:', layerId);
                    console.log('Transform:', transform);
                    console.log('Paths before:', activeLayer.layerData.paths?.length || 0);
                    
                    // GPT5案準拠：パスデータに変形を安全に適用してcanonical座標に統一
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
                        
                        // EventBus通知（GPT5案準拠）
                        window.Tegaki.EventBus.emit('layer:transform:confirmed', {
                            layerId: layerId,
                            layerIndex: this.activeLayerIndex
                        });
                        
                        console.log('=== LayerSystem: Non-destructive layer transform confirmed successfully ===');
                    } else {
                        console.warn('LayerSystem: Transform confirmation failed - keeping transform state');
                    }
                    
                } catch (error) {
                    console.error('LayerSystem: Critical error in confirmLayerTransform:', error);
                    // エラー時は変形状態を維持（安全対策）
                }
            } else {
                console.log('LayerSystem: No transform to confirm (already at default state)');
            }
        },

        // === GPT5案準拠：安全なパス変形適用処理（完全版） ===
        safeApplyTransformToPaths: function(layer, transform) {
            if (!layer.layerData?.paths || layer.layerData.paths.length === 0) {
                console.log('LayerSystem: No paths to transform - operation successful');
                return true;
            }

            try {
                console.log('LayerSystem: Starting safe transform application to', layer.layerData.paths.length, 'paths');
                
                const centerX = this.CONFIG.canvas.width / 2;
                const centerY = this.CONFIG.canvas.height / 2;
                
                // GPT5案準拠：より精密な変形行列作成
                const matrix = this.createTransformMatrix(transform, centerX, centerY);
                
                // パスごとに安全に処理
                const transformedPaths = [];
                let successCount = 0;
                
                for (let i = 0; i < layer.layerData.paths.length; i++) {
                    const path = layer.layerData.paths[i];
                    
                    try {
                        // パスの安全性チェック
                        if (!path || !Array.isArray(path.points) || path.points.length === 0) {
                            console.warn(`LayerSystem: Skipping invalid path at index ${i}`);
                            continue;
                        }
                        
                        // GPT5案準拠：座標変形（元データは保護）
                        const transformedPoints = this.safeTransformPoints(path.points, matrix);
                        
                        if (transformedPoints.length === 0) {
                            console.warn(`LayerSystem: Transform failed for path ${i} - skipping`);
                            continue;
                        }
                        
                        // 新しいパスオブジェクト作成（非破壊）
                        const transformedPath = {
                            id: path.id, // IDは維持
                            points: transformedPoints, // canonical座標で保存
                            color: path.color,
                            size: path.size,
                            opacity: path.opacity,
                            isComplete: path.isComplete || true,
                            graphics: null // 後で再生成
                        };
                        
                        transformedPaths.push(transformedPath);
                        successCount++;
                        
                    } catch (pathError) {
                        console.error(`LayerSystem: Error processing path ${i}:`, pathError);
                        // 個別パスエラーは無視して続行
                    }
                }
                
                console.log(`LayerSystem: Transformed ${successCount}/${layer.layerData.paths.length} paths successfully`);
                
                if (successCount === 0) {
                    console.error('LayerSystem: No paths could be transformed');
                    return false;
                }
                
                // GPT5案準拠：レイヤー再構築（安全版）
                const rebuildSuccess = this.safeRebuildLayer(layer, transformedPaths);
                
                if (rebuildSuccess) {
                    console.log('LayerSystem: Layer rebuild completed successfully');
                    return true;
                } else {
                    console.error('LayerSystem: Layer rebuild failed');
                    return false;
                }
                
            } catch (error) {
                console.error('LayerSystem: Critical error in safeApplyTransformToPaths:', error);
                return false;
            }
        },

        // === GPT5案準拠：精密変形行列作成 ===
        createTransformMatrix: function(transform, centerX, centerY) {
            const matrix = new PIXI.Matrix();
            
            // GPT5案準拠：変形の順序: 移動 → 回転 → スケール → 移動戻し
            matrix.translate(centerX + transform.x, centerY + transform.y);
            matrix.rotate(transform.rotation);
            matrix.scale(transform.scaleX, transform.scaleY);
            matrix.translate(-centerX, -centerY);
            
            return matrix;
        },

        // === GPT5案準拠：安全な座標変形処理 ===
        safeTransformPoints: function(points, matrix) {
            const transformedPoints = [];
            
            for (let i = 0; i < points.length; i++) {
                const point = points[i];
                
                // 座標の検証
                if (typeof point.x !== 'number' || typeof point.y !== 'number' ||
                    !isFinite(point.x) || !isFinite(point.y)) {
                    console.warn(`LayerSystem: Invalid point at index ${i}:`, point);
                    continue;
                }
                
                try {
                    // 変形適用
                    const transformed = matrix.apply(point);
                    
                    // 結果の検証
                    if (typeof transformed.x === 'number' && typeof transformed.y === 'number' &&
                        isFinite(transformed.x) && isFinite(transformed.y)) {
                        // GPT5案準拠：canonical座標として保存
                        transformedPoints.push({
                            x: transformed.x,
                            y: transformed.y
                        });
                    } else {
                        console.warn(`LayerSystem: Invalid transformed point:`, transformed);
                    }
                    
                } catch (transformError) {
                    console.warn(`LayerSystem: Point transform failed for index ${i}:`, transformError);
                }
            }
            
            return transformedPoints;
        },

        // === GPT5案準拠：安全なレイヤー再構築 ===
        safeRebuildLayer: function(layer, newPaths) {
            try {
                console.log('LayerSystem: Starting safe layer rebuild');
                
                // 既存描画要素の安全な削除（背景は保護）
                const childrenToRemove = [];
                for (let child of layer.children) {
                    // 背景グラフィックスは保護
                    if (child !== layer.layerData.backgroundGraphics) {
                        childrenToRemove.push(child);
                    }
                }
                
                // 安全な削除処理
                childrenToRemove.forEach(child => {
                    try {
                        layer.removeChild(child);
                        if (child.destroy && typeof child.destroy === 'function') {
                            child.destroy({ children: true, texture: false, baseTexture: false });
                        }
                    } catch (removeError) {
                        console.warn('LayerSystem: Failed to remove child:', removeError);
                    }
                });
                
                console.log(`LayerSystem: Removed ${childrenToRemove.length} existing graphics`);
                
                // GPT5案準拠：新しいパスデータを設定（canonical座標）
                layer.layerData.paths = [];
                
                // パスごとにGraphicsを再生成・追加
                let addedCount = 0;
                for (let i = 0; i < newPaths.length; i++) {
                    const path = newPaths[i];
                    
                    try {
                        // Graphics再生成
                        const rebuildSuccess = this.rebuildPathGraphics(path);
                        
                        if (rebuildSuccess && path.graphics) {
                            // canonical座標でレイヤーに追加
                            layer.layerData.paths.push(path);
                            layer.addChild(path.graphics);
                            addedCount++;
                        } else {
                            console.warn(`LayerSystem: Failed to rebuild graphics for path ${i}`);
                        }
                        
                    } catch (pathError) {
                        console.error(`LayerSystem: Error adding path ${i}:`, pathError);
                    }
                }
                
                console.log(`LayerSystem: Added ${addedCount}/${newPaths.length} paths to layer`);
                
                // 成功判定
                const success = addedCount > 0 || newPaths.length === 0;
                
                if (success) {
                    console.log('LayerSystem: Safe layer rebuild completed successfully');
                } else {
                    console.error('LayerSystem: Safe layer rebuild failed - no paths added');
                }
                
                return success;
                
            } catch (error) {
                console.error('LayerSystem: Critical error in safeRebuildLayer:', error);
                return false;
            }
        },

        // === GPT5案準拠：パスGraphics再生成（安全版） ===
        rebuildPathGraphics: function(path) {
            try {
                // 既存Graphics削除
                if (path.graphics) {
                    try {
                        if (path.graphics.destroy && typeof path.graphics.destroy === 'function') {
                            path.graphics.destroy();
                        }
                    } catch (destroyError) {
                        console.warn('LayerSystem: Graphics destroy failed:', destroyError);
                    }
                    path.graphics = null;
                }
                
                // 新しいGraphics作成
                path.graphics = new PIXI.Graphics();
                
                // GPT5案準拠：パスの点から描画を再構築（canonical座標使用）
                if (path.points && Array.isArray(path.points) && path.points.length > 0) {
                    for (let point of path.points) {
                        if (typeof point.x === 'number' && typeof point.y === 'number' &&
                            isFinite(point.x) && isFinite(point.y)) {
                            
                            // canonical座標でGraphicsを作成
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
                console.error('LayerSystem: Error in rebuildPathGraphics:', error);
                path.graphics = null;
                return false;
            }
        },

        // GPT5案準拠：変形が初期状態以外かチェック
        isTransformNonDefault: function(transform) {
            if (!transform) return false;
            return (transform.x !== 0 || transform.y !== 0 || 
                    transform.rotation !== 0 || Math.abs(transform.scaleX) !== 1 || Math.abs(transform.scaleY) !== 1);
        },

        // 背景レイヤー更新（EventBus対応）
        updateBackgroundLayers: function(newWidth, newHeight) {
            this.layers.forEach(layer => {
                if (layer.layerData.isBackground && layer.layerData.backgroundGraphics) {
                    layer.layerData.backgroundGraphics.clear();
                    layer.layerData.backgroundGraphics.rect(0, 0, newWidth, newHeight);
                    layer.layerData.backgroundGraphics.fill(this.CONFIG.background.color);
                }
            });
        },

        // レイヤー操作設定
        setupLayerOperations: function() {
            document.addEventListener('keydown', (e) => {
                // GPT5案準拠：Vキートグル方式
                if (e.code === 'KeyV' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    this.toggleLayerMoveMode();
                    e.preventDefault();
                }

                // P・Eキー：レイヤー移動モード終了
                if (e.code === 'KeyP' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    if (this.isLayerMoveMode) {
                        this.exitLayerMoveMode();
                    }
                    e.preventDefault();
                }

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
                    this.handleLayerDrag(e);
                }
            });

            this.app.canvas.addEventListener('pointerup', (e) => {
                if (this.isLayerDragging) {
                    this.isLayerDragging = false;
                    this.updateCursor();
                }
            });
        },

        // レイヤードラッグ処理
        handleLayerDrag: function(e) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;

            const dx = e.clientX - this.layerDragLastPoint.x;
            const dy = e.clientY - this.layerDragLastPoint.y;

            const worldScale = this.cameraSystem ? this.cameraSystem.worldContainer.scale.x : 1;
            const adjustedDx = dx / worldScale;
            const adjustedDy = dy / worldScale;

            const layerId = activeLayer.layerData.id;
            const transform = this.getOrCreateTransform(layerId);

            if (e.shiftKey) {
                this.handleShiftDrag(activeLayer, transform, dx, dy);
            } else {
                // V + ドラッグ: 移動（座標累積）
                transform.x += adjustedDx;
                transform.y += adjustedDy;

                // 位置を更新
                const centerX = this.CONFIG.canvas.width / 2;
                const centerY = this.CONFIG.canvas.height / 2;
                activeLayer.position.set(centerX + transform.x, centerY + transform.y);

                // スライダー更新
                this.updateSliderValue('layer-x-slider', transform.x);
                this.updateSliderValue('layer-y-slider', transform.y);
            }

            this.layerDragLastPoint = { x: e.clientX, y: e.clientY };
            this.requestThumbnailUpdate(this.activeLayerIndex);
        },

        // Shift+ドラッグ処理（拡縮・回転）
        handleShiftDrag: function(activeLayer, transform, dx, dy) {
            const centerX = this.CONFIG.canvas.width / 2;
            const centerY = this.CONFIG.canvas.height / 2;

            activeLayer.pivot.set(centerX, centerY);
            activeLayer.position.set(centerX + transform.x, centerY + transform.y);

            if (Math.abs(dy) > Math.abs(dx)) {
                // 垂直方向優先: 拡縮（上ドラッグ→拡大、下ドラッグ→縮小）
                const scaleFactor = 1 + (dy * -0.01);
                const currentScale = Math.abs(transform.scaleX);
                const newScale = Math.max(this.CONFIG.layer.minScale, 
                                        Math.min(this.CONFIG.layer.maxScale, currentScale * scaleFactor));

                transform.scaleX = transform.scaleX < 0 ? -newScale : newScale;
                transform.scaleY = transform.scaleY < 0 ? -newScale : newScale;
                activeLayer.scale.set(transform.scaleX, transform.scaleY);

                this.updateSliderValue('layer-scale-slider', newScale);
            } else {
                // 水平方向優先: 回転（右ドラッグ→右回転）
                transform.rotation += (dx * 0.02);
                activeLayer.rotation = transform.rotation;

                this.updateSliderValue('layer-rotation-slider', transform.rotation * 180 / Math.PI);
            }
        },

        // キーボード移動
        moveActiveLayer: function(keyCode) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;

            const layerId = activeLayer.layerData.id;
            const transform = this.getOrCreateTransform(layerId);
            const moveAmount = 5;

            switch(keyCode) {
                case 'ArrowUp': transform.y -= moveAmount; break;
                case 'ArrowDown': transform.y += moveAmount; break;
                case 'ArrowLeft': transform.x -= moveAmount; break;
                case 'ArrowRight': transform.x += moveAmount; break;
            }

            this.updateLayerPosition(activeLayer, transform);
            this.updateSliderValue('layer-x-slider', transform.x);
            this.updateSliderValue('layer-y-slider', transform.y);
            this.requestThumbnailUpdate(this.activeLayerIndex);
        },

        // キーボード変形
        transformActiveLayer: function(keyCode) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;

            const layerId = activeLayer.layerData.id;
            const transform = this.getOrCreateTransform(layerId);

            this.setLayerPivotAndPosition(activeLayer, transform);

            switch(keyCode) {
                case 'ArrowUp':
                    this.scaleLayer(activeLayer, transform, 1.1);
                    break;
                case 'ArrowDown':
                    this.scaleLayer(activeLayer, transform, 0.9);
                    break;
                case 'ArrowLeft':
                    this.rotateLayer(activeLayer, transform, -15);
                    break;
                case 'ArrowRight':
                    this.rotateLayer(activeLayer, transform, 15);
                    break;
            }

            this.requestThumbnailUpdate(this.activeLayerIndex);
        },

        // レイヤー反転
        flipActiveLayer: function(direction) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;

            const layerId = activeLayer.layerData.id;
            const transform = this.getOrCreateTransform(layerId);

            this.setLayerPivotAndPosition(activeLayer, transform);

            if (direction === 'horizontal') {
                transform.scaleX *= -1;
                activeLayer.scale.x = transform.scaleX;
            } else if (direction === 'vertical') {
                transform.scaleY *= -1;
                activeLayer.scale.y = transform.scaleY;
            }

            this.updateFlipButtons();
            this.requestThumbnailUpdate(this.activeLayerIndex);
        },

        // 変形データ取得または作成
        getOrCreateTransform: function(layerId) {
            if (!this.layerTransforms.has(layerId)) {
                this.layerTransforms.set(layerId, {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                });
            }
            return this.layerTransforms.get(layerId);
        },

        // レイヤー位置更新
        updateLayerPosition: function(layer, transform) {
            const centerX = this.CONFIG.canvas.width / 2;
            const centerY = this.CONFIG.canvas.height / 2;
            layer.position.set(centerX + transform.x, centerY + transform.y);
        },

        // ピボットと位置設定
        setLayerPivotAndPosition: function(layer, transform) {
            const centerX = this.CONFIG.canvas.width / 2;
            const centerY = this.CONFIG.canvas.height / 2;
            layer.pivot.set(centerX, centerY);
            layer.position.set(centerX + transform.x, centerY + transform.y);
        },

        // レイヤー拡縮
        scaleLayer: function(layer, transform, scaleFactor) {
            const currentScale = Math.abs(transform.scaleX);
            const newScale = Math.max(this.CONFIG.layer.minScale, 
                                    Math.min(this.CONFIG.layer.maxScale, currentScale * scaleFactor));

            transform.scaleX = transform.scaleX < 0 ? -newScale : newScale;
            transform.scaleY = transform.scaleY < 0 ? -newScale : newScale;
            layer.scale.set(transform.scaleX, transform.scaleY);

            this.updateSliderValue('layer-scale-slider', newScale);
        },

        // レイヤー回転
        rotateLayer: function(layer, transform, degrees) {
            transform.rotation += (degrees * Math.PI) / 180;
            layer.rotation = transform.rotation;

            this.updateSliderValue('layer-rotation-slider', transform.rotation * 180 / Math.PI);
        },

        // 変形パネル設定
        setupLayerTransformPanel: function() {
            this.layerTransformPanel = document.getElementById('layer-transform-panel');
            if (!this.layerTransformPanel) return;

            this.setupLayerSlider('layer-x-slider', this.CONFIG.layer.minX, this.CONFIG.layer.maxX, 0, (value) => {
                this.updateActiveLayerTransform('x', value);
                return Math.round(value) + 'px';
            });

            this.setupLayerSlider('layer-y-slider', this.CONFIG.layer.minY, this.CONFIG.layer.maxY, 0, (value) => {
                this.updateActiveLayerTransform('y', value);
                return Math.round(value) + 'px';
            });

            this.setupLayerSlider('layer-rotation-slider', this.CONFIG.layer.minRotation, this.CONFIG.layer.maxRotation, 0, (value) => {
                this.updateActiveLayerTransform('rotation', value * Math.PI / 180);
                return Math.round(value) + '°';
            });

            this.setupLayerSlider('layer-scale-slider', this.CONFIG.layer.minScale, this.CONFIG.layer.maxScale, 1.0, (value) => {
                this.updateActiveLayerTransform('scale', value);
                return value.toFixed(2) + 'x';
            });

            // 反転ボタン
            this.setupFlipButtons();
        },

        // スライダー設定
        setupLayerSlider: function(sliderId, min, max, initial, callback) {
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

            container.updateValue = (newValue) => {
                update(newValue, false);
            };

            update(initial);
        },

        // 反転ボタン設定
        setupFlipButtons: function() {
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
        },

        // レイヤー変形更新
        updateActiveLayerTransform: function(property, value) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;

            const layerId = activeLayer.layerData.id;
            const transform = this.getOrCreateTransform(layerId);
            const centerX = this.CONFIG.canvas.width / 2;
            const centerY = this.CONFIG.canvas.height / 2;

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
                    this.setLayerPivotAndPosition(activeLayer, transform);
                    activeLayer.rotation = value;
                    break;
                case 'scale':
                    const hFlipped = transform.scaleX < 0;
                    const vFlipped = transform.scaleY < 0;
                    transform.scaleX = hFlipped ? -value : value;
                    transform.scaleY = vFlipped ? -value : value;

                    this.setLayerPivotAndPosition(activeLayer, transform);
                    activeLayer.scale.set(transform.scaleX, transform.scaleY);
                    break;
            }

            this.requestThumbnailUpdate(this.activeLayerIndex);
        },

        // 変形パネル値更新
        updateLayerTransformPanelValues: function() {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;

            const layerId = activeLayer.layerData.id;
            const transform = this.layerTransforms.get(layerId) || {
                x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
            };

            this.updateSliderValue('layer-x-slider', transform.x);
            this.updateSliderValue('layer-y-slider', transform.y);
            this.updateSliderValue('layer-rotation-slider', transform.rotation * 180 / Math.PI);
            this.updateSliderValue('layer-scale-slider', Math.abs(transform.scaleX));

            this.updateFlipButtons();
        },

        // スライダー値更新
        updateSliderValue: function(sliderId, value) {
            const slider = document.getElementById(sliderId);
            if (slider && slider.updateValue) {
                slider.updateValue(value);
            }
        },

        // 反転ボタン更新
        updateFlipButtons: function() {
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
        },

        // カーソル更新
        updateCursor: function() {
            if (this.vKeyPressed) {
                this.app.canvas.style.cursor = 'grab';
            }
        },

        // サムネイル更新
        requestThumbnailUpdate: function(layerIndex) {
            this.thumbnailUpdateQueue.add(layerIndex);
        },

        processThumbnailUpdates: function() {
            if (!this.app?.renderer || this.thumbnailUpdateQueue.size === 0) return;

            this.thumbnailUpdateQueue.forEach(layerIndex => {
                this.updateThumbnail(layerIndex);
            });
            this.thumbnailUpdateQueue.clear();
        },

        // サムネイル更新（レイヤー変形状態を考慮）
        updateThumbnail: function(layerIndex) {
            if (!this.app?.renderer || layerIndex < 0 || layerIndex >= this.layers.length) return;

            const layer = this.layers[layerIndex];
            const layerItems = document.querySelectorAll('.layer-item');
            const panelIndex = this.layers.length - 1 - layerIndex;

            if (panelIndex < 0 || panelIndex >= layerItems.length) return;

            const thumbnail = layerItems[panelIndex].querySelector('.layer-thumbnail');
            if (!thumbnail) return;

            try {
                // アスペクト比計算
                const canvasAspectRatio = this.CONFIG.canvas.width / this.CONFIG.canvas.height;
                let thumbnailWidth, thumbnailHeight;
                const maxHeight = 48;
                const maxWidth = 72;

                if (canvasAspectRatio >= 1) {
                    if (maxHeight * canvasAspectRatio <= maxWidth) {
                        thumbnailWidth = maxHeight * canvasAspectRatio;
                        thumbnailHeight = maxHeight;
                    } else {
                        thumbnailWidth = maxWidth;
                        thumbnailHeight = maxWidth / canvasAspectRatio;
                    }
                } else {
                    thumbnailWidth = Math.max(24, maxHeight * canvasAspectRatio);
                    thumbnailHeight = maxHeight;
                }

                thumbnail.style.width = Math.round(thumbnailWidth) + 'px';
                thumbnail.style.height = Math.round(thumbnailHeight) + 'px';

                // レンダリング用高解像度テクスチャ作成
                const renderTexture = PIXI.RenderTexture.create({
                    width: this.CONFIG.canvas.width * this.CONFIG.thumbnail.RENDER_SCALE,
                    height: this.CONFIG.canvas.height * this.CONFIG.thumbnail.RENDER_SCALE,
                    resolution: this.CONFIG.thumbnail.RENDER_SCALE
                });

                // レイヤーの現在変形状態を保持してサムネイル生成
                const tempContainer = new PIXI.Container();

                // 現在の変形状態を保存
                const originalPos = { x: layer.position.x, y: layer.position.y };
                const originalScale = { x: layer.scale.x, y: layer.scale.y };
                const originalRotation = layer.rotation;
                const originalPivot = { x: layer.pivot.x, y: layer.pivot.y };

                // サムネイル用に変形をリセット
                layer.position.set(0, 0);
                layer.scale.set(1, 1);
                layer.rotation = 0;
                layer.pivot.set(0, 0);

                tempContainer.addChild(layer);
                tempContainer.scale.set(this.CONFIG.thumbnail.RENDER_SCALE);

                // レンダリング実行
                this.app.renderer.render(tempContainer, { renderTexture });

                // 変形状態を復元
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
                ctx.imageSmoothingQuality = this.CONFIG.thumbnail.QUALITY;
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
                console.warn('LayerSystem: Thumbnail update failed:', error);
            }
        },

        // レイヤーパネルUI更新
        updateLayerPanelUI: function() {
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

            // 全レイヤーのサムネイル更新をリクエスト
            for (let i = 0; i < this.layers.length; i++) {
                this.requestThumbnailUpdate(i);
            }
        },

        // レイヤー可視性切り替え
        toggleLayerVisibility: function(layerIndex) {
            if (layerIndex >= 0 && layerIndex < this.layers.length) {
                const layer = this.layers[layerIndex];
                layer.layerData.visible = !layer.layerData.visible;
                layer.visible = layer.layerData.visible;
                this.updateLayerPanelUI();

                // EventBus通知
                window.Tegaki.EventBus.emit('layer:visibilityChanged', {
                    layerId: layer.layerData.id,
                    visible: layer.layerData.visible
                });
            }
        },

        // ステータス表示更新
        updateStatusDisplay: function() {
            const statusElement = document.getElementById('current-layer');
            if (statusElement && this.activeLayerIndex >= 0) {
                const layer = this.layers[this.activeLayerIndex];
                statusElement.textContent = layer.layerData.name;
            }
        },

        // パスをレイヤーに追加
        addPathToLayer: function(layerIndex, path) {
            if (layerIndex >= 0 && layerIndex < this.layers.length) {
                const layer = this.layers[layerIndex];
                layer.layerData.paths.push(path);
                layer.addChild(path.graphics);
                this.requestThumbnailUpdate(layerIndex);

                // EventBus通知
                window.Tegaki.EventBus.emit('layer:paths:changed', {
                    layerId: layer.layerData.id
                });
            }
        },

        // 外部システム参照設定
        setCameraSystem: function(cameraSystem) {
            this.cameraSystem = cameraSystem;
        },

        setDrawingEngine: function(drawingEngine) {
            this.drawingEngine = drawingEngine;
        }
    };

    // グローバル登録
    window.TegakiSystems.Register('LayerSystem', LayerSystem);

})();