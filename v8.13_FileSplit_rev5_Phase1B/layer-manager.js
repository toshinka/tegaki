// ===== layer-manager.js - レイヤー管理システム =====

window.TegakiModules = window.TegakiModules || {};

// === レイヤー管理システム（修正版：サムネイル座標修正・アスペクト比対応） ===
window.TegakiModules.LayerManager = class LayerManager {
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
        
        // レイヤー移動モード関連（修正版）
        this.vKeyPressed = false;
        this.isLayerMoveMode = false;
        this.isLayerDragging = false;
        this.layerDragLastPoint = { x: 0, y: 0 };
        
        // 修正：レイヤー変形データの保持
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
        this.setupLayerSlider('layer-rotation-slider', window.TEGAKI_CONFIG.layer.minRotation, window.TEGAKI_CONFIG.layer.maxRotation, 0, (value) => {
            this.updateActiveLayerTransform('rotation', value * Math.PI / 180);
            return Math.round(value) + '°';
        });
        
        this.setupLayerSlider('layer-scale-slider', window.TEGAKI_CONFIG.layer.minScale, window.TEGAKI_CONFIG.layer.maxScale, 1.0, (value) => {
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
    
    // 修正3: レイヤー変形データを保持して累積的に適用（カメラフレーム中央基準完全対応）
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
        
        // 修正3: カメラフレーム中央を基準点として設定（動的計算）
        const centerX = window.TEGAKI_CONFIG.canvas.width / 2;
        const centerY = window.TEGAKI_CONFIG.canvas.height / 2;
        
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
    
    // 修正3: 反転時もカメラフレーム中央基準で座標を維持
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
        
        // 修正3: カメラフレーム中央を動的に計算して基準点に設定
        const centerX = window.TEGAKI_CONFIG.canvas.width / 2;
        const centerY = window.TEGAKI_CONFIG.canvas.height / 2;
        
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
    
    // 修正版：変形データから現在値を取得してスライダー更新
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
    
    // 改修版：Vキートグル方式でのレイヤー移動モード
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
        
        // 修正版：ガイドライン表示
        this.cameraSystem.showGuideLines();
        
        this.updateCursor();
    }
    
    // 改修版：V解除が確定（確定ボタン削除）
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
        
        // 修正版：ガイドライン非表示
        this.cameraSystem.hideGuideLines();
        
        this.updateCursor();
        
        // 改修版：V解除時に自動確定（レイヤー変形をベイク）
        this.confirmLayerTransform();
    }
    
    // 非破壊版：レイヤー変形の確定処理（パスデータ完全保持）
    confirmLayerTransform() {
        const activeLayer = this.getActiveLayer();
        if (!activeLayer) return;
        
        const layerId = activeLayer.layerData.id;
        const transform = this.layerTransforms.get(layerId);
        
        // レイヤーのtransformが初期状態でない場合、パスデータに変形を適用
        if (this.isTransformNonDefault(transform)) {
            try {
                console.log('Non-destructive layer transform confirmation started');
                
                // ✅ パスデータに変形を直接適用（非破壊的）
                this.applyTransformToPaths(activeLayer, transform);
                
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
                
                console.log('Non-destructive layer transform confirmed - paths preserved');
                
            } catch (error) {
                console.error('Failed to confirm layer transform non-destructively:', error);
                // フォールバック：何もしない（変形状態を維持）
            }
        }
    }
    
    // 変形が初期状態以外かチェック
    isTransformNonDefault(transform) {
        if (!transform) return false;
        return (transform.x !== 0 || transform.y !== 0 || 
                transform.rotation !== 0 || Math.abs(transform.scaleX) !== 1 || Math.abs(transform.scaleY) !== 1);
    }
    
    // パスの座標に直接transformを適用
    applyTransformToPaths(layer, transform) {
        if (!layer.layerData?.paths || layer.layerData.paths.length === 0) {
            console.log('No paths to transform');
            return;
        }
        
        const centerX = window.TEGAKI_CONFIG.canvas.width / 2;
        const centerY = window.TEGAKI_CONFIG.canvas.height / 2;
        
        // 変形行列を作成
        const matrix = new PIXI.Matrix();
        matrix.translate(centerX + transform.x, centerY + transform.y);
        matrix.rotate(transform.rotation);
        matrix.scale(transform.scaleX, transform.scaleY);
        matrix.translate(-centerX, -centerY);
        
        // 各パスの座標点に変形を適用
        layer.layerData.paths.forEach((path, pathIndex) => {
            if (path.points && path.points.length > 0) {
                // 座標点を変形
                path.points = path.points.map(point => {
                    return matrix.apply(point);
                });
                
                // Graphicsを再生成
                this.rebuildPathGraphics(path);
                
                console.log(`Path ${pathIndex}: ${path.points.length} points transformed`);
            }
        });
        
        // レイヤーを再構築
        this.rebuildLayerFromPaths(layer);
        
        console.log(`Applied transform to ${layer.layerData.paths.length} paths`);
    }
    
    // パスからGraphicsを再生成
    rebuildPathGraphics(path) {
        if (path.graphics) {
            path.graphics.destroy();
        }
        
        path.graphics = new PIXI.Graphics();
        
        // パスの点から描画を再構築
        if (path.points && path.points.length > 0) {
            path.points.forEach(point => {
                path.graphics.circle(point.x, point.y, path.size / 2);
                path.graphics.fill({ color: path.color, alpha: path.opacity });
            });
        }
    }
    
    // レイヤー全体をパスから再構築
    rebuildLayerFromPaths(layer) {
        // 既存の描画要素をクリア（背景以外）
        const children = [...layer.children];
        children.forEach(child => {
            if (child !== layer.layerData.backgroundGraphics) {
                layer.removeChild(child);
                if (child.destroy) child.destroy();
            }
        });
        
        // パスから再構築
        layer.layerData.paths.forEach(path => {
            if (path.graphics) {
                layer.addChild(path.graphics);
            }
        });
        
        console.log(`Layer rebuilt from ${layer.layerData.paths.length} paths`);
    }
    
    setupLayerOperations() {
        document.addEventListener('keydown', (e) => {
            // 改修版：Vキートグル方式
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
                        // 修正4: V + Shift + ドラッグの操作方向修正（直感的に変更）
                        const centerX = window.TEGAKI_CONFIG.canvas.width / 2;
                        const centerY = window.TEGAKI_CONFIG.canvas.height / 2;
                        
                        // 基準点をカメラ中央に設定
                        activeLayer.pivot.set(centerX, centerY);
                        activeLayer.position.set(centerX + transform.x, centerY + transform.y);
                        
                        if (Math.abs(dy) > Math.abs(dx)) {
                            // 垂直方向優先: 拡縮（修正4: 上ドラッグ→拡大、下ドラッグ→縮小）
                            const scaleFactor = 1 + (dy * -0.01); // 修正4: 方向を逆転（-0.01）
                            const currentScale = Math.abs(transform.scaleX);
                            const newScale = Math.max(window.TEGAKI_CONFIG.layer.minScale, Math.min(window.TEGAKI_CONFIG.layer.maxScale, currentScale * scaleFactor));
                            
                            transform.scaleX = transform.scaleX < 0 ? -newScale : newScale;
                            transform.scaleY = transform.scaleY < 0 ? -newScale : newScale;
                            activeLayer.scale.set(transform.scaleX, transform.scaleY);
                            
                            // スライダー更新
                            const scaleSlider = document.getElementById('layer-scale-slider');
                            if (scaleSlider && scaleSlider.updateValue) {
                                scaleSlider.updateValue(newScale);
                            }
                        } else {
                            // 水平方向優先: 回転（修正4: 右ドラッグ→右回転、左ドラッグ→左回転）
                            transform.rotation += (dx * 0.02); // 修正4: dxを使用（正の方向）
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
                        const centerX = window.TEGAKI_CONFIG.canvas.width / 2;
                        const centerY = window.TEGAKI_CONFIG.canvas.height / 2;
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
    
    // 修正版：キーボードによる移動（座標累積）
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
        const centerX = window.TEGAKI_CONFIG.canvas.width / 2;
        const centerY = window.TEGAKI_CONFIG.canvas.height / 2;
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
    
    // 修正3: キーボードによる変形（カメラフレーム中央基準で座標維持）
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
        
        // 修正3: カメラフレーム中央を動的に計算
        const centerX = window.TEGAKI_CONFIG.canvas.width / 2;
        const centerY = window.TEGAKI_CONFIG.canvas.height / 2;
        
        // 基準点とポジションを設定
        activeLayer.pivot.set(centerX, centerY);
        activeLayer.position.set(centerX + transform.x, centerY + transform.y);
        
        switch(keyCode) {
            case 'ArrowUp': // 拡大
                const scaleUpFactor = 1.1;
                const currentScaleUp = Math.abs(transform.scaleX);
                const newScaleUp = Math.min(window.TEGAKI_CONFIG.layer.maxScale, currentScaleUp * scaleUpFactor);
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
                const newScaleDown = Math.max(window.TEGAKI_CONFIG.layer.minScale, currentScaleDown * scaleDownFactor);
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
            bg.rect(0, 0, window.TEGAKI_CONFIG.canvas.width, window.TEGAKI_CONFIG.canvas.height);
            bg.fill(window.TEGAKI_CONFIG.background.color);
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

    // 修正1: レイヤー変形を考慮したサムネイル生成・完全アスペクト比対応・パネルはみ出し対策
    updateThumbnail(layerIndex) {
        if (!this.app?.renderer || layerIndex < 0 || layerIndex >= this.layers.length) return;

        const layer = this.layers[layerIndex];
        const layerItems = document.querySelectorAll('.layer-item');
        const panelIndex = this.layers.length - 1 - layerIndex;
        
        if (panelIndex < 0 || panelIndex >= layerItems.length) return;
        
        const thumbnail = layerItems[panelIndex].querySelector('.layer-thumbnail');
        if (!thumbnail) return;

        try {
            // 修正1: 完全アスペクト比対応版（パネルはみ出し対策強化）
            const canvasAspectRatio = window.TEGAKI_CONFIG.canvas.width / window.TEGAKI_CONFIG.canvas.height;
            let thumbnailWidth, thumbnailHeight;
            const maxHeight = 48;
            const maxWidth = 72; // パネル幅制限

            if (canvasAspectRatio >= 1) {
                // 横長または正方形の場合
                // 横幅制限を優先し、縦を比例縮小
                if (maxHeight * canvasAspectRatio <= maxWidth) {
                    thumbnailWidth = maxHeight * canvasAspectRatio;
                    thumbnailHeight = maxHeight;
                } else {
                    // 修正1: 横長過ぎる場合は横幅制限を優先して縦を縮小
                    thumbnailWidth = maxWidth;
                    thumbnailHeight = maxWidth / canvasAspectRatio;
                }
            } else {
                // 縦長の場合
                thumbnailWidth = Math.max(24, maxHeight * canvasAspectRatio);
                thumbnailHeight = maxHeight;
            }
            
            // 修正1: サムネイル枠のサイズを動的に更新
            thumbnail.style.width = Math.round(thumbnailWidth) + 'px';
            thumbnail.style.height = Math.round(thumbnailHeight) + 'px';
            
            console.log(`Thumbnail updated: ${Math.round(thumbnailWidth)}x${Math.round(thumbnailHeight)} (aspect: ${canvasAspectRatio.toFixed(2)})`);
            
            // レンダリング用の高解像度テクスチャ作成
            const renderTexture = PIXI.RenderTexture.create({
                width: window.TEGAKI_CONFIG.canvas.width * window.TEGAKI_CONFIG.thumbnail.RENDER_SCALE,
                height: window.TEGAKI_CONFIG.canvas.height * window.TEGAKI_CONFIG.thumbnail.RENDER_SCALE,
                resolution: window.TEGAKI_CONFIG.thumbnail.RENDER_SCALE
            });
            
            // 修正版：レイヤーの現在の変形状態を保持してサムネイル生成
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
            tempContainer.scale.set(window.TEGAKI_CONFIG.thumbnail.RENDER_SCALE);
            
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
            ctx.imageSmoothingQuality = window.TEGAKI_CONFIG.thumbnail.QUALITY;
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
};-x-slider', window.TEGAKI_CONFIG.layer.minX, window.TEGAKI_CONFIG.layer.maxX, 0, (value) => {
            this.updateActiveLayerTransform('x', value);
            return Math.round(value) + 'px';
        });
        
        this.setupLayerSlider('layer-y-slider', window.TEGAKI_CONFIG.layer.minY, window.TEGAKI_CONFIG.layer.maxY, 0, (value) => {
            this.updateActiveLayerTransform('y', value);
            return Math.round(value) + 'px';
        });
        
        this.setupLayerSlider('layer