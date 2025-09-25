// ===== systems/layer-system.js - 完全版：非破壊変形確定 =====
// GPT5案.txt準拠：confirmLayerTransform()の完全非破壊化とcanonical座標管理
// CONFIG定義整合性チェック済み、完全なLayerSystem実装

(function() {
    'use strict';

    const LayerSystem = {
        name: 'LayerSystem',
        
        init: function(opts) {
            console.log('LayerSystem: Initializing with non-destructive transforms...');
            
            this.app = opts.app;
            this.rootContainer = opts.rootContainer;
            this.CONFIG = window.TEGAKI_CONFIG;
            
            // 定義チェック：CONFIG必須項目の検証
            if (!this.CONFIG || !this.CONFIG.canvas || !this.CONFIG.layer || !this.CONFIG.thumbnail) {
                console.error('LayerSystem: Missing required CONFIG definitions');
                return;
            }
            
            this.layers = [];
            this.activeLayerIndex = -1;
            this.layerCounter = 0;
            this.thumbnailUpdateQueue = new Set();
            
            this.layersContainer = new PIXI.Container();
            this.layersContainer.label = 'layersContainer';
            this.rootContainer.addChild(this.layersContainer);
            
            // GPT5案準拠：レイヤー変形データ管理（canonical基準）
            this.layerTransforms = new Map(); // layerId -> { x, y, rotation, scaleX, scaleY }
            
            // レイヤー移動モード関連
            this.vKeyPressed = false;
            this.isLayerMoveMode = false;
            this.isLayerDragging = false;
            this.layerDragLastPoint = { x: 0, y: 0 };
            
            this.layerTransformPanel = null;
            
            // システム参照
            this.cameraSystem = null;
            
            this.setupLayerOperations();
            this.setupLayerTransformPanel();
            
            console.log('LayerSystem: Initialized with non-destructive transform system');
        },

        // === GPT5案準拠：非破壊的レイヤー変形確定処理（完全版） ===
        
        confirmLayerTransform: function() {
            /* 
            GPT5案：パスデータは常に「キャンバス固定座標（canonical canvas coordinates）」で保存。
            変形確定時はpath.pointsに逆変換をかけて（座標系を焼き込んで）Containerのtransformをリセット。
            */
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;
            
            const layerId = activeLayer.layerData.id;
            const transform = this.layerTransforms.get(layerId);
            
            if (!this.isTransformNonDefault(transform)) {
                console.log('LayerSystem: No transform to confirm (already at default state)');
                return;
            }
            
            try {
                console.log('=== Non-destructive layer transform confirmation started ===');
                console.log('Layer ID:', layerId);
                console.log('Transform to bake:', transform);
                console.log('Paths before confirmation:', activeLayer.layerData.paths?.length || 0);
                
                // 安全なパス変形適用
                const success = this.applyTransformToPoints(layerId, transform);
                
                if (success) {
                    // Container transformをリセット（視覚的変化なし）
                    activeLayer.position.set(0, 0);
                    activeLayer.rotation = 0;
                    activeLayer.scale.set(1, 1);
                    activeLayer.pivot.set(0, 0);
                    
                    // 変形データをリセット
                    this.layerTransforms.set(layerId, {
                        x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                    });
                    
                    // UI更新
                    this.updateFlipButtons();
                    this.requestThumbnailUpdate(this.activeLayerIndex);
                    
                    // EventBus通知
                    if (window.Tegaki && window.Tegaki.EventBus) {
                        window.Tegaki.EventBus.emit('layer:transform:confirmed', {
                            layerId: layerId,
                            layerIndex: this.activeLayerIndex
                        });
                    }
                    
                    console.log('=== Non-destructive layer transform confirmed successfully ===');
                } else {
                    console.warn('Transform confirmation failed - keeping transform state');
                }
                
            } catch (error) {
                console.error('Critical error in confirmLayerTransform:', error);
            }
        },

        // GPT5案準拠：LayerSystem.applyTransformToPoints()の安全実装
        applyTransformToPoints: function(layerId, transform) {
            /* 
            パス points に逆行列をかけ、layer transform をリセット
            GPT5案：build PIXI.Matrix for transform relative to canvas center
            */
            const layer = this.getLayerById(layerId);
            if (!layer || !layer.layerData?.paths || layer.layerData.paths.length === 0) {
                console.log('LayerSystem: No paths to transform - operation successful');
                return true;
            }
            
            try {
                console.log('LayerSystem: Applying transform to', layer.layerData.paths.length, 'paths');
                
                // GPT5案：キャンバス中心を基準にした変形行列作成
                const matrix = this.buildTransformMatrix(transform);
                
                // パスごとに安全処理
                const transformedPaths = [];
                let successCount = 0;
                
                for (let i = 0; i < layer.layerData.paths.length; i++) {
                    const path = layer.layerData.paths[i];
                    
                    try {
                        if (!path || !Array.isArray(path.points) || path.points.length === 0) {
                            console.warn(`LayerSystem: Skipping invalid path at index ${i}`);
                            continue;
                        }
                        
                        // GPT5案：座標変形（元データ保護）
                        const transformedPoints = this.safeTransformPoints(path.points, matrix);
                        
                        if (transformedPoints.length === 0) {
                            console.warn(`LayerSystem: Transform failed for path ${i} - skipping`);
                            continue;
                        }
                        
                        // 新しいパスオブジェクト作成（非破壊）
                        const transformedPath = {
                            id: path.id,
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
                        console.error(`LayerSystem: Error processing path ${i}:`, pathError);
                    }
                }
                
                console.log(`LayerSystem: Transformed ${successCount}/${layer.layerData.paths.length} paths successfully`);
                
                if (successCount === 0) {
                    console.error('LayerSystem: No paths could be transformed');
                    return false;
                }
                
                // レイヤー再構築
                const rebuildSuccess = this.safeRebuildLayer(layer, transformedPaths);
                
                if (rebuildSuccess) {
                    console.log('LayerSystem: Layer rebuild completed successfully');
                    
                    // EventBus通知
                    if (window.Tegaki && window.Tegaki.EventBus) {
                        window.Tegaki.EventBus.emit('layer:paths:changed', {
                            layerId: layerId
                        });
                    }
                    
                    return true;
                } else {
                    console.error('LayerSystem: Layer rebuild failed');
                    return false;
                }
                
            } catch (error) {
                console.error('LayerSystem: Critical error in applyTransformToPoints:', error);
                return false;
            }
        },

        // GPT5案準拠：変形行列作成（キャンバス中央基準）
        buildTransformMatrix: function(transform) {
            /* 
            GPT5案：build PIXI.Matrix for transform relative to canvas center
            anchor推奨：キャンバス中心で統一
            */
            const centerX = this.CONFIG.canvas.width / 2;
            const centerY = this.CONFIG.canvas.height / 2;
            
            const matrix = new PIXI.Matrix();
            
            // 変形の順序：中心移動 → 平行移動 → 回転 → スケール → 中心戻し
            matrix.translate(centerX + transform.x, centerY + transform.y);
            matrix.rotate(transform.rotation);
            matrix.scale(transform.scaleX, transform.scaleY);
            matrix.translate(-centerX, -centerY);
            
            return matrix;
        },

        // GPT5案準拠：安全な座標変形処理
        safeTransformPoints: function(points, matrix) {
            /* 
            GPT5案：for each path.points: p' = matrix.apply(p)
            座標検証とエラー処理を含む安全版
            */
            const transformedPoints = [];
            
            for (let i = 0; i < points.length; i++) {
                const point = points[i];
                
                // 座標検証
                if (typeof point.x !== 'number' || typeof point.y !== 'number' ||
                    !isFinite(point.x) || !isFinite(point.y)) {
                    console.warn(`LayerSystem: Invalid point at index ${i}:`, point);
                    continue;
                }
                
                try {
                    // Matrix変形適用
                    const transformed = matrix.apply(point);
                    
                    // 結果検証
                    if (typeof transformed.x === 'number' && typeof transformed.y === 'number' &&
                        isFinite(transformed.x) && isFinite(transformed.y)) {
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

        // GPT5案準拠：安全なレイヤー再構築
        safeRebuildLayer: function(layer, newPaths) {
            /* 
            GPT5案：update any visible Graphics by rebuildPathGraphics(path) using the new points
            背景グラフィックスは保護して、パスGraphicsのみ安全に再構築
            */
            try {
                console.log('LayerSystem: Starting safe layer rebuild');
                
                // 既存描画要素の安全削除（背景保護）
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
                        console.warn('LayerSystem: Failed to remove child:', removeError);
                    }
                });
                
                console.log(`LayerSystem: Removed ${childrenToRemove.length} existing graphics`);
                
                // 新しいパスデータ設定
                layer.layerData.paths = [];
                
                // パスごとにGraphics再生成・追加
                let addedCount = 0;
                for (let i = 0; i < newPaths.length; i++) {
                    const path = newPaths[i];
                    
                    try {
                        // GPT5案準拠：rebuildPathGraphics()でGraphics再生成
                        const rebuildSuccess = this.rebuildPathGraphics(path);
                        
                        if (rebuildSuccess && path.graphics) {
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
                return success;
                
            } catch (error) {
                console.error('LayerSystem: Critical error in safeRebuildLayer:', error);
                return false;
            }
        },

        // GPT5案準拠：パスGraphics再生成（安全版）
        rebuildPathGraphics: function(path) {
            /* 
            GPT5案：rebuildPathGraphics(path)は必ずpath.pointsをcanvas座標として受け取り、
            path.graphics.position = {0,0}のままdrawを行う
            */
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
                
                // canonical座標でGraphics描画
                if (path.points && Array.isArray(path.points) && path.points.length > 0) {
                    path.points.forEach(point => {
                        if (typeof point.x === 'number' && typeof point.y === 'number' &&
                            isFinite(point.x) && isFinite(point.y)) {
                            
                            // GPT5案：path.graphics.position = {0,0}のまま描画
                            path.graphics.circle(point.x, point.y, (path.size || 16) / 2);
                            path.graphics.fill({ 
                                color: path.color || 0x800000, 
                                alpha: path.opacity || 1.0 
                            });
                        }
                    });
                }
                
                return true;
                
            } catch (error) {
                console.error('LayerSystem: Error in rebuildPathGraphics:', error);
                path.graphics = null;
                return false;
            }
        },

        // レイヤー変形パネル設定
        setupLayerTransformPanel: function() {
            this.layerTransformPanel = document.getElementById('layer-transform-panel');
            
            if (!this.layerTransformPanel) {
                console.warn('LayerSystem: layer-transform-panel not found in DOM');
                return;
            }
            
            // スライダー設定（CONFIG定義と整合性チェック）
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

        // レイヤー操作設定
        setupLayerOperations: function() {
            document.addEventListener('keydown', (e) => {
                // Vキートグル方式
                if (e.code === 'KeyV' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    this.toggleLayerMoveMode();
                    e.preventDefault();
                }
                
                // V + 方向キー：レイヤー移動
                if (this.vKeyPressed && !e.shiftKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                    this.moveActiveLayer(e.code);
                    e.preventDefault();
                }
                
                // V + Shift + 方向キー：レイヤー変形
                if (this.vKeyPressed && e.shiftKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                    this.transformActiveLayer(e.code);
                    e.preventDefault();
                }
                
                // V + H / V + Shift + H：レイヤー反転
                if (this.vKeyPressed && e.code === 'KeyH' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    if (e.shiftKey) {
                        this.flipActiveLayer('vertical');
                    } else {
                        this.flipActiveLayer('horizontal');
                    }
                    e.preventDefault();
                }
            });
            
            // V + ドラッグ：レイヤー移動・変形
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
            
            const worldScale = this.cameraSystem ? this.cameraSystem.worldContainer.scale.x : 1.0;
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
                // Shift + ドラッグ：変形
                const centerX = this.CONFIG.canvas.width / 2;
                const centerY = this.CONFIG.canvas.height / 2;
                
                activeLayer.pivot.set(centerX, centerY);
                activeLayer.position.set(centerX + transform.x, centerY + transform.y);
                
                if (Math.abs(dy) > Math.abs(dx)) {
                    // 垂直ドラッグ：拡縮
                    const scaleFactor = 1 + (dy * -0.01);
                    const currentScale = Math.abs(transform.scaleX);
                    const newScale = Math.max(this.CONFIG.layer.minScale, Math.min(this.CONFIG.layer.maxScale, currentScale * scaleFactor));
                    
                    transform.scaleX = transform.scaleX < 0 ? -newScale : newScale;
                    transform.scaleY = transform.scaleY < 0 ? -newScale : newScale;
                    activeLayer.scale.set(transform.scaleX, transform.scaleY);
                    
                    // スライダー更新
                    const scaleSlider = document.getElementById('layer-scale-slider');
                    if (scaleSlider && scaleSlider.updateValue) {
                        scaleSlider.updateValue(newScale);
                    }
                } else {
                    // 水平ドラッグ：回転
                    transform.rotation += (dx * 0.02);
                    activeLayer.rotation = transform.rotation;
                    
                    // スライダー更新
                    const rotationSlider = document.getElementById('layer-rotation-slider');
                    if (rotationSlider && rotationSlider.updateValue) {
                        rotationSlider.updateValue(transform.rotation * 180 / Math.PI);
                    }
                }
            } else {
                // 通常ドラッグ：移動
                transform.x += adjustedDx;
                transform.y += adjustedDy;
                
                const centerX = this.CONFIG.canvas.width / 2;
                const centerY = this.CONFIG.canvas.height / 2;
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
        },

        // レイヤー移動モードのトグル
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
            
            if (this.cameraSystem) {
                this.cameraSystem.setVKeyPressed(true);
            }
            
            // パネルとガイドライン表示
            if (this.layerTransformPanel) {
                this.layerTransformPanel.classList.add('show');
                this.updateLayerTransformPanelValues();
            }
            
            if (this.cameraSystem) {
                this.cameraSystem.showGuideLines();
            }
            
            this.updateCursor();
        },
        
        // GPT5案準拠：V解除時に自動確定（非破壊変形ベイク）
        exitLayerMoveMode: function() {
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
            
            if (this.cameraSystem) {
                this.cameraSystem.hideGuideLines();
            }
            
            this.updateCursor();
            
            // GPT5案：V解除時に自動確定（レイヤー変形をベイク）
            this.confirmLayerTransform();
        },

        // レイヤー変形更新（累積）
        updateActiveLayerTransform: function(property, value) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;
            
            const layerId = activeLayer.layerData.id;
            
            if (!this.layerTransforms.has(layerId)) {
                this.layerTransforms.set(layerId, {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                });
            }
            
            const transform = this.layerTransforms.get(layerId);
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
        },

        // レイヤー反転
        flipActiveLayer: function(direction) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;
            
            const layerId = activeLayer.layerData.id;
            
            if (!this.layerTransforms.has(layerId)) {
                this.layerTransforms.set(layerId, {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                });
            }
            
            const transform = this.layerTransforms.get(layerId);
            const centerX = this.CONFIG.canvas.width / 2;
            const centerY = this.CONFIG.canvas.height / 2;
            
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
        },

        // 基本レイヤー操作
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
                paths: []
            };

            // 変形データ初期化
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
            return { layer, index: this.layers.length - 1 };
        },

        getActiveLayer: function() {
            return this.activeLayerIndex >= 0 ? this.layers[this.activeLayerIndex] : null;
        },

        getLayerById: function(layerId) {
            return this.layers.find(layer => layer.layerData.id === layerId);
        },

        setActiveLayer: function(index) {
            if (index >= 0 && index < this.layers.length) {
                this.activeLayerIndex = index;
                this.updateLayerPanelUI();
                this.updateStatusDisplay();
                
                if (this.isLayerMoveMode) {
                    this.updateLayerTransformPanelValues();
                }
            }
        },

        // 変形が初期状態以外かチェック
        isTransformNonDefault: function(transform) {
            if (!transform) return false;
            return (transform.x !== 0 || transform.y !== 0 || 
                    transform.rotation !== 0 || Math.abs(transform.scaleX) !== 1 || Math.abs(transform.scaleY) !== 1);
        },

        // サムネイル更新（CONFIG.thumbnailと整合性チェック）
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

        updateThumbnail: function(layerIndex) {
            if (!this.app?.renderer || layerIndex < 0 || layerIndex >= this.layers.length) return;

            const layer = this.layers[layerIndex];
            const layerItems = document.querySelectorAll('.layer-item');
            const panelIndex = this.layers.length - 1 - layerIndex;
            
            if (panelIndex < 0 || panelIndex >= layerItems.length) return;
            
            const thumbnail = layerItems[panelIndex].querySelector('.layer-thumbnail');
            if (!thumbnail) return;

            try {
                // CONFIG.thumbnailと整合性チェック
                if (!this.CONFIG.thumbnail) {
                    console.warn('LayerSystem: CONFIG.thumbnail not defined, using defaults');
                    this.CONFIG.thumbnail = { SIZE: 48, RENDER_SCALE: 3, QUALITY: 'high' };
                }

                // アスペクト比対応サムネイル生成
                const canvasAspectRatio = this.CONFIG.canvas.width / this.CONFIG.canvas.height;
                let thumbnailWidth, thumbnailHeight;
                const maxHeight = this.CONFIG.thumbnail.SIZE;
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
                
                // レンダリング（高解像度）
                const renderTexture = PIXI.RenderTexture.create({
                    width: this.CONFIG.canvas.width * this.CONFIG.thumbnail.RENDER_SCALE,
                    height: this.CONFIG.canvas.height * this.CONFIG.thumbnail.RENDER_SCALE,
                    resolution: this.CONFIG.thumbnail.RENDER_SCALE
                });
                
                // 変形状態を保存してサムネイル生成
                const layerId = layer.layerData.id;
                const transform = this.layerTransforms.get(layerId);
                
                const tempContainer = new PIXI.Container();
                
                const originalPos = { x: layer.position.x, y: layer.position.y };
                const originalScale = { x: layer.scale.x, y: layer.scale.y };
                const originalRotation = layer.rotation;
                const originalPivot = { x: layer.pivot.x, y: layer.pivot.y };
                
                // サムネイル用変形リセット
                layer.position.set(0, 0);
                layer.scale.set(1, 1);
                layer.rotation = 0;
                layer.pivot.set(0, 0);
                
                tempContainer.addChild(layer);
                tempContainer.scale.set(this.CONFIG.thumbnail.RENDER_SCALE);
                
                this.app.renderer.render(tempContainer, { renderTexture });
                
                // 変形状態復元
                layer.position.set(originalPos.x, originalPos.y);
                layer.scale.set(originalScale.x, originalScale.y);
                layer.rotation = originalRotation;
                layer.pivot.set(originalPivot.x, originalPivot.y);
                
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
                
                renderTexture.destroy();
                tempContainer.destroy();
                
            } catch (error) {
                console.warn('LayerSystem: Thumbnail update failed:', error);
            }
        },

        // UI更新
        updateLayerPanelUI: function() {
            const layerList = document.getElementById('layer-list');
            if (!layerList) {
                console.warn('LayerSystem: layer-list element not found in DOM');
                return;
            }

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
                    <div class="layer-opacity">${Math.round(layer.layerData.opacity * 100)}%</div>
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
            
            // サムネイル更新要求
            for (let i = 0; i < this.layers.length; i++) {
                this.requestThumbnailUpdate(i);
            }
        },

        updateStatusDisplay: function() {
            const statusElement = document.getElementById('current-layer');
            if (statusElement && this.activeLayerIndex >= 0) {
                const layer = this.layers[this.activeLayerIndex];
                statusElement.textContent = layer.layerData.name;
            }
        },

        // レイヤー操作
        toggleLayerVisibility: function(layerIndex) {
            if (layerIndex >= 0 && layerIndex < this.layers.length) {
                const layer = this.layers[layerIndex];
                layer.layerData.visible = !layer.layerData.visible;
                layer.visible = layer.layerData.visible;
                this.updateLayerPanelUI();
            }
        },

        deleteLayer: function(layerIndex) {
            if (this.layers.length <= 1) return;
            if (layerIndex < 0 || layerIndex >= this.layers.length) return;

            const layer = this.layers[layerIndex];
            const layerId = layer.layerData.id;
            
            // パスGraphics削除
            layer.layerData.paths.forEach(path => {
                if (path.graphics && path.graphics.destroy) {
                    path.graphics.destroy();
                }
            });

            // 変形データ削除
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
        },

        // ヘルパー関数
        setupLayerSlider: function(sliderId, min, max, initial, callback) {
            const container = document.getElementById(sliderId);
            if (!container) {
                console.warn(`LayerSystem: Slider element ${sliderId} not found`);
                return;
            }

            const track = container.querySelector('.slider-track');
            const handle = container.querySelector('.slider-handle');
            const valueDisplay = container.parentNode.querySelector('.slider-value');

            if (!track || !handle || !valueDisplay) {
                console.warn(`LayerSystem: Slider components missing for ${sliderId}`);
                return;
            }

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

            // 外部からの値更新用
            container.updateValue = (newValue) => {
                update(newValue);
            };

            update(initial);
        },

        updateLayerTransformPanelValues: function() {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;
            
            const layerId = activeLayer.layerData.id;
            const transform = this.layerTransforms.get(layerId) || {
                x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
            };
            
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
        },

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

        updateCursor: function() {
            if (this.vKeyPressed && this.app && this.app.canvas) {
                this.app.canvas.style.cursor = 'grab';
            }
        },

        // キーボード操作：レイヤー移動
        moveActiveLayer: function(keyCode) {
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
                case 'ArrowUp': transform.y -= moveAmount; break;
                case 'ArrowDown': transform.y += moveAmount; break;
                case 'ArrowLeft': transform.x -= moveAmount; break;
                case 'ArrowRight': transform.x += moveAmount; break;
            }
            
            const centerX = this.CONFIG.canvas.width / 2;
            const centerY = this.CONFIG.canvas.height / 2;
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
        },

        // キーボード操作：レイヤー変形
        transformActiveLayer: function(keyCode) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;
            
            const layerId = activeLayer.layerData.id;
            
            if (!this.layerTransforms.has(layerId)) {
                this.layerTransforms.set(layerId, {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                });
            }
            
            const transform = this.layerTransforms.get(layerId);
            const centerX = this.CONFIG.canvas.width / 2;
            const centerY = this.CONFIG.canvas.height / 2;
            
            activeLayer.pivot.set(centerX, centerY);
            activeLayer.position.set(centerX + transform.x, centerY + transform.y);
            
            switch(keyCode) {
                case 'ArrowUp': // 拡大
                    const newScaleUp = Math.min(this.CONFIG.layer.maxScale, Math.abs(transform.scaleX) * 1.1);
                    transform.scaleX = transform.scaleX < 0 ? -newScaleUp : newScaleUp;
                    transform.scaleY = transform.scaleY < 0 ? -newScaleUp : newScaleUp;
                    activeLayer.scale.set(transform.scaleX, transform.scaleY);
                    
                    const scaleSliderUp = document.getElementById('layer-scale-slider');
                    if (scaleSliderUp && scaleSliderUp.updateValue) {
                        scaleSliderUp.updateValue(newScaleUp);
                    }
                    break;
                    
                case 'ArrowDown': // 縮小
                    const newScaleDown = Math.max(this.CONFIG.layer.minScale, Math.abs(transform.scaleX) * 0.9);
                    transform.scaleX = transform.scaleX < 0 ? -newScaleDown : newScaleDown;
                    transform.scaleY = transform.scaleY < 0 ? -newScaleDown : newScaleDown;
                    activeLayer.scale.set(transform.scaleX, transform.scaleY);
                    
                    const scaleSliderDown = document.getElementById('layer-scale-slider');
                    if (scaleSliderDown && scaleSliderDown.updateValue) {
                        scaleSliderDown.updateValue(newScaleDown);
                    }
                    break;
                    
                case 'ArrowLeft': // 左回転
                    transform.rotation -= (15 * Math.PI) / 180;
                    activeLayer.rotation = transform.rotation;
                    
                    const rotationSliderLeft = document.getElementById('layer-rotation-slider');
                    if (rotationSliderLeft && rotationSliderLeft.updateValue) {
                        rotationSliderLeft.updateValue(transform.rotation * 180 / Math.PI);
                    }
                    break;
                    
                case 'ArrowRight': // 右回転
                    transform.rotation += (15 * Math.PI) / 180;
                    activeLayer.rotation = transform.rotation;
                    
                    const rotationSliderRight = document.getElementById('layer-rotation-slider');
                    if (rotationSliderRight && rotationSliderRight.updateValue) {
                        rotationSliderRight.updateValue(transform.rotation * 180 / Math.PI);
                    }
                    break;
            }
            
            this.requestThumbnailUpdate(this.activeLayerIndex);
        },

        // 外部システム参照設定
        setCameraSystem: function(cameraSystem) {
            this.cameraSystem = cameraSystem;
        },

        // GPT5案準拠：レイヤーCanonicalPaths取得
        getLayerCanonicalPaths: function(layerId) {
            /* GPT5案：常にcanvas座標の配列を返す */
            const layer = this.getLayerById(layerId);
            if (!layer || !layer.layerData.paths) {
                return [];
            }
            
            // パスはcanonical座標で保存されているのでそのまま返す
            return layer.layerData.paths.map(path => ({
                id: path.id,
                points: [...path.points], // コピーを返す
                color: path.color,
                size: path.size,
                opacity: path.opacity,
                isComplete: path.isComplete
            }));
        },

        // レイヤー階層移動（SortableJS連携用）
        moveLayer: function(fromIndex, toIndex) {
            if (fromIndex < 0 || fromIndex >= this.layers.length ||
                toIndex < 0 || toIndex >= this.layers.length) {
                return;
            }
            
            const layer = this.layers[fromIndex];
            
            // 配列から移動
            this.layers.splice(fromIndex, 1);
            this.layers.splice(toIndex, 0, layer);
            
            // PixiJSコンテナも移動
            this.layersContainer.removeChild(layer);
            this.layersContainer.addChildAt(layer, toIndex);
            
            // アクティブレイヤーインデックス調整
            if (this.activeLayerIndex === fromIndex) {
                this.activeLayerIndex = toIndex;
            } else if (fromIndex < this.activeLayerIndex && toIndex >= this.activeLayerIndex) {
                this.activeLayerIndex--;
            } else if (fromIndex > this.activeLayerIndex && toIndex <= this.activeLayerIndex) {
                this.activeLayerIndex++;
            }
            
            this.updateLayerPanelUI();
            this.updateStatusDisplay();
        },

        // パス追加（DrawingEngine用）
        addPathToLayer: function(layerIndex, path) {
            if (layerIndex >= 0 && layerIndex < this.layers.length) {
                const layer = this.layers[layerIndex];
                layer.layerData.paths.push(path);
                layer.addChild(path.graphics);
                this.requestThumbnailUpdate(layerIndex);
            }
        },

        // デバッグ用：変形データ取得
        getLayerTransform: function(layerId) {
            return this.layerTransforms.get(layerId) || { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
        },

        // デバッグ用：全レイヤー情報取得
        getLayersInfo: function() {
            return this.layers.map((layer, index) => ({
                index: index,
                id: layer.layerData.id,
                name: layer.layerData.name,
                pathCount: layer.layerData.paths.length,
                transform: this.layerTransforms.get(layer.layerData.id),
                isActive: index === this.activeLayerIndex
            }));
        }
    };

    // グローバル登録
    if (window.TegakiSystems) {
        window.TegakiSystems.Register('LayerSystem', LayerSystem);
    } else {
        console.error('LayerSystem: TegakiSystems not available for registration');
    }

})();