// ===== layer-system.js - Phase2分離版：レイヤー管理システム単独化 =====
// core-engine.jsから分離・レイヤー変形処理特化・PixiJS v8.13完全対応

/*
=== Phase2分離版 レイヤー管理システム ===

【分離内容】
✅ core-engine.jsからLayerManager完全分離
✅ レイヤー変形処理の非破壊化完全実装
✅ サムネイル生成システム統合
✅ UI連携API明確化

【責務】
- レイヤー作成・削除・選択管理
- レイヤー変形（移動・回転・拡縮・反転）
- 変形確定処理（非破壊的パス座標変換）
- レイヤーパネルUI連携
- サムネイル生成・更新

【API境界】
- 入力: UI操作・キーボード操作
- 出力: レイヤー状態・UI更新イベント
- 連携: CameraSystem、CoordinateSystem、CoreRuntime

【非破壊変形システム】
- 変形データ分離保持（layerTransforms Map）
- パス座標の安全な変換処理
- Graphics再構築の完全性確保
*/

(function() {
    'use strict';
    
    // 依存関係確認
    const CONFIG = window.TEGAKI_CONFIG;
    if (!CONFIG) {
        throw new Error('layer-system.js: CONFIG dependency missing');
    }
    
    if (!window.CoordinateSystem) {
        throw new Error('layer-system.js: CoordinateSystem dependency missing');
    }
    
    // === レイヤー管理システム（Phase2分離版） ===
    class LayerManager {
        constructor(canvasContainer, app, cameraSystem) {
            this.canvasContainer = canvasContainer;
            this.app = app;
            this.cameraSystem = cameraSystem;
            this.layers = [];
            this.activeLayerIndex = -1;
            this.layerCounter = 0;
            this.thumbnailUpdateQueue = new Set();
            
            // レイヤーコンテナ（PixiJS v8.13対応）
            this.layersContainer = new PIXI.Container();
            this.layersContainer.label = 'layersContainer';
            this.layersContainer.eventMode = 'static';
            this.canvasContainer.addChild(this.layersContainer);
            
            // レイヤー移動モード関連
            this.vKeyPressed = false;
            this.isLayerMoveMode = false;
            this.isLayerDragging = false;
            this.layerDragLastPoint = { x: 0, y: 0 };
            
            // レイヤー変形データの保持（非破壊システム）
            this.layerTransforms = new Map(); // layerId -> { x, y, rotation, scaleX, scaleY }
            
            // UI要素参照
            this.layerTransformPanel = null;
            
            this.setupLayerOperations();
            this.setupLayerTransformPanel();
            
            console.log('✅ LayerManager initialized (Phase2 separated)');
        }
        
        // === レイヤー変形パネル設定 ===
        setupLayerTransformPanel() {
            this.layerTransformPanel = document.getElementById('layer-transform-panel');
            
            if (!this.layerTransformPanel) {
                console.warn('LayerManager: layer-transform-panel not found');
                return;
            }
            
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
        
        // === レイヤースライダー設定 ===
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
        
        // === レイヤー変形データ更新（カメラフレーム中央基準） ===
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
            const centerX = CONFIG.canvas.width / 2;
            const centerY = CONFIG.canvas.height / 2;
            
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
        
        // === レイヤー反転処理（カメラフレーム中央基準） ===
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
            const centerX = CONFIG.canvas.width / 2;
            const centerY = CONFIG.canvas.height / 2;
            
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
        
        // === 反転ボタン状態更新 ===
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
        
        // === 変形パネル値更新 ===
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
        
        // === レイヤー移動モード制御 ===
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
            
            // ガイドライン表示
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
            
            // ガイドライン非表示
            this.cameraSystem.hideGuideLines();
            
            this.updateCursor();
            
            // V解除時に自動確定（レイヤー変形をベイク）
            this.confirmLayerTransform();
        }
        
        // === 非破壊的レイヤー変形確定処理（完全版） ===
        confirmLayerTransform() {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;
            
            const layerId = activeLayer.layerData.id;
            const transform = this.layerTransforms.get(layerId);
            
            // レイヤーのtransformが初期状態でない場合、パスデータに変形を適用
            if (this.isTransformNonDefault(transform)) {
                try {
                    if (CONFIG.debug) {
                        console.log('=== Non-destructive layer transform confirmation started ===');
                        console.log('Layer ID:', layerId);
                        console.log('Transform:', transform);
                        console.log('Paths before:', activeLayer.layerData.paths?.length || 0);
                    }
                    
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
                        
                        if (CONFIG.debug) {
                            console.log('=== Non-destructive layer transform confirmed successfully ===');
                        }
                    } else {
                        console.warn('Transform confirmation failed - keeping transform state');
                    }
                    
                } catch (error) {
                    console.error('Critical error in confirmLayerTransform:', error);
                    // エラー時は変形状態を維持（安全対策）
                }
            } else {
                if (CONFIG.debug) {
                    console.log('No transform to confirm (already at default state)');
                }
            }
        }
        
        // === 安全なパス変形適用処理 ===
        safeApplyTransformToPaths(layer, transform) {
            if (!layer.layerData?.paths || layer.layerData.paths.length === 0) {
                if (CONFIG.debug) {
                    console.log('No paths to transform - operation successful');
                }
                return true;
            }
            
            try {
                if (CONFIG.debug) {
                    console.log('Starting safe transform application to', layer.layerData.paths.length, 'paths');
                }
                
                const centerX = CONFIG.canvas.width / 2;
                const centerY = CONFIG.canvas.height / 2;
                
                // 精密な変形行列作成
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
                
                if (CONFIG.debug) {
                    console.log(`Transformed ${successCount}/${layer.layerData.paths.length} paths successfully`);
                }
                
                if (successCount === 0) {
                    console.error('No paths could be transformed');
                    return false;
                }
                
                // レイヤー再構築（安全版）
                const rebuildSuccess = this.safeRebuildLayer(layer, transformedPaths);
                
                if (rebuildSuccess) {
                    if (CONFIG.debug) {
                        console.log('Layer rebuild completed successfully');
                    }
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
        
        // === 精密変形行列作成 ===
        createTransformMatrix(transform, centerX, centerY) {
            const matrix = new PIXI.Matrix();
            
            // 変形の順序: 移動 → 回転 → スケール → 移動戻し
            matrix.translate(centerX + transform.x, centerY + transform.y);
            matrix.rotate(transform.rotation);
            matrix.scale(transform.scaleX, transform.scaleY);
            matrix.translate(-centerX, -centerY);
            
            return matrix;
        }
        
        // === 安全な座標変形処理 ===
        safeTransformPoints(points, matrix) {
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
                    // 変形適用
                    const transformed = matrix.apply(point);
                    
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
        
        // === 安全なレイヤー再構築 ===
        safeRebuildLayer(layer, newPaths) {
            try {
                if (CONFIG.debug) {
                    console.log('Starting safe layer rebuild');
                }
                
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
                        console.warn('Failed to remove child:', removeError);
                    }
                });
                
                if (CONFIG.debug) {
                    console.log(`Removed ${childrenToRemove.length} existing graphics`);
                }
                
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
                
                if (CONFIG.debug) {
                    console.log(`Added ${addedCount}/${newPaths.length} paths to layer`);
                }
                
                // 成功判定
                const success = addedCount > 0 || newPaths.length === 0;
                
                if (success && CONFIG.debug) {
                    console.log('Safe layer rebuild completed successfully');
                } else if (!success) {
                    console.error('Safe layer rebuild failed - no paths added');
                }
                
                return success;
                
            } catch (error) {
                console.error('Critical error in safeRebuildLayer:', error);
                return false;
            }
        }
        
        // === パスGraphics再生成（安全版・PixiJS v8.13対応） ===
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
                
                // 新しいGraphics作成（PixiJS v8.13対応）
                path.graphics = new PIXI.Graphics();
                
                // パスの点から描画を再構築
                if (path.points && Array.isArray(path.points) && path.points.length > 0) {
                    for (let point of path.points) {
                        if (typeof point.x === 'number' && typeof point.y === 'number' &&
                            isFinite(point.x) && isFinite(point.y)) {
                            
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
        
        // === 変形が初期状態以外かチェック ===
        isTransformNonDefault(transform) {
            if (!transform) return false;
            return (transform.x !== 0 || transform.y !== 0 || 
                    transform.rotation !== 0 || Math.abs(transform.scaleX) !== 1 || Math.abs(transform.scaleY) !== 1);
        }
        
        // === レイヤー操作イベント設定 ===
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
                            // V + Shift + ドラッグの操作（直感的操作）
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
                            
                            // 位置を更新
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
        
        // === キーボードによる移動（座標累積） ===
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
            
            // 位置を更新
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
        
        // === キーボードによる変形（カメラフレーム中央基準） ===
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
            
            // カメラフレーム中央を動的に計算
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
        
        // === カーソル更新 ===
        updateCursor() {
            if (this.vKeyPressed) {
                this.app.canvas.style.cursor = 'grab';
            }
        }

        // === レイヤー作成 ===
        createLayer(name, isBackground = false) {
            const layer = new PIXI.Container();
            const layerId = `layer_${this.layerCounter++}`;
            
            layer.label = layerId;
            layer.eventMode = 'static';
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

        // === レイヤー選択 ===
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

        // === アクティブレイヤー取得 ===
        getActiveLayer() {
            return this.activeLayerIndex >= 0 ? this.layers[this.activeLayerIndex] : null;
        }

        // === レイヤーにパス追加 ===
        addPathToLayer(layerIndex, path) {
            if (layerIndex >= 0 && layerIndex < this.layers.length) {
                const layer = this.layers[layerIndex];
                layer.layerData.paths.push(path);
                layer.addChild(path.graphics);
                this.requestThumbnailUpdate(layerIndex);
            }
        }

        // === サムネイル更新要求 ===
        requestThumbnailUpdate(layerIndex) {
            this.thumbnailUpdateQueue.add(layerIndex);
        }

        // === サムネイル更新処理 ===
        processThumbnailUpdates() {
            if (!this.app?.renderer || this.thumbnailUpdateQueue.size === 0) return;

            this.thumbnailUpdateQueue.forEach(layerIndex => {
                this.updateThumbnail(layerIndex);
            });
            this.thumbnailUpdateQueue.clear();
        }

        // === サムネイル更新（レイヤー変形対応・完全アスペクト比対応） ===
        updateThumbnail(layerIndex) {
            if (!this.app?.renderer || layerIndex < 0 || layerIndex >= this.layers.length) return;

            const layer = this.layers[layerIndex];
            const layerItems = document.querySelectorAll('.layer-item');
            const panelIndex = this.layers.length - 1 - layerIndex;
            
            if (panelIndex < 0 || panelIndex >= layerItems.length) return;
            
            const thumbnail = layerItems[panelIndex].querySelector('.layer-thumbnail');
            if (!thumbnail) return;

            try {
                // 完全アスペクト比対応版（パネルはみ出し対策強化）
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
                        // 横長過ぎる場合は横幅制限を優先して縦を縮小
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
                
                if (CONFIG.debug) {
                    console.log(`Thumbnail updated: ${Math.round(thumbnailWidth)}x${Math.round(thumbnailHeight)} (aspect: ${canvasAspectRatio.toFixed(2)})`);
                }
                
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
                console.warn('Thumbnail update failed:', error);
            }
        }

        // === レイヤーパネルUI更新 ===
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

        // === レイヤー可視性切り替え ===
        toggleLayerVisibility(layerIndex) {
            if (layerIndex >= 0 && layerIndex < this.layers.length) {
                const layer = this.layers[layerIndex];
                layer.layerData.visible = !layer.layerData.visible;
                layer.visible = layer.layerData.visible;
                this.updateLayerPanelUI();
            }
        }

        // === レイヤー削除 ===
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

        // === ステータス表示更新 ===
        updateStatusDisplay() {
            const statusElement = document.getElementById('current-layer');
            if (statusElement && this.activeLayerIndex >= 0) {
                const layer = this.layers[this.activeLayerIndex];
                statusElement.textContent = layer.layerData.name;
            }
        }
    }
    
    // === グローバル公開 ===
    window.TegakiLayerSeparated = {
        LayerManager: LayerManager
    };
    
    console.log('✅ layer-system.js loaded (Phase2 separated)');