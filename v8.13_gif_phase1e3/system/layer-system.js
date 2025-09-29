// キーバインディング処理（完全2次元マトリクス対応）
        _setupLayerOperations() {
            // keydownイベント処理
            document.addEventListener('keydown', (e) => {
                // キーコンフィグ管理クラス経由でアクション取得
                const keyConfig = window.TEGAKI_KEYCONFIG_MANAGER;
                if (!keyConfig) return;
                
                const action = keyConfig.getActionForKey(e.code, {
                    vPressed: this.vKeyPressed,
                    shiftPressed: e.shiftKey
                });
                
                if (!action) return;
                
                // アクション実行
                switch(action) {
                    case 'layerMode':
                        if (!e.ctrlKey && !e.altKey && !e.metaKey) {
                            if (!this.vKeyPressed) {
                                this.enterLayerMoveMode();
                            }
                            e.preventDefault();
                        }
                        break;
                        
                    // 【改修】AnimationSystem統合版：GIF CUT移動
                    case 'gifPrevFrame':
                        if (!this.vKeyPressed && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
                            if (this.animationSystem?.goToPreviousFrame) {
                                this.animationSystem.goToPreviousFrame();
                                console.log('🎞️ Previous CUT (from LayerSystem)');
                            }
                            if (this.eventBus) {
                                this.eventBus.emit('gif:prev-frame-requested');
                            }
                            e.preventDefault();
                        }
                        break;
                        
                    case 'gifNextFrame':
                        if (!this.vKeyPressed && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
                            if (this.animationSystem?.goToNextFrame) {
                                this.animationSystem.goToNextFrame();
                                console.log('🎞️ Next CUT (from LayerSystem)');
                            }
                            if (this.eventBus) {
                                this.eventBus.emit('gif:next-frame-requested');
                            }
                            e.preventDefault();
                        }
                        break;
                    
                    // 素の方向キー - レイヤー階層移動（アクティブが変わるだけ）
                    case 'layerUp':
                        if (!this.vKeyPressed && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
                            this.moveActiveLayerHierarchy('up');
                            e.preventDefault();
                        }
                        break;
                        
                    case 'layerDown':
                        if (!this.vKeyPressed && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
                            this.moveActiveLayerHierarchy('down');
                            e.preventDefault();
                        }
                        break;
                    
                    // ツール切り替え（レイヤー移動モード終了）
                    case 'pen':
                    case 'eraser':
                        if (!e.ctrlKey && !e.altKey && !e.metaKey) {
                            if (this.isLayerMoveMode) {
                                this.exitLayerMoveMode();
                            }
                            e.preventDefault();
                        }
                        break;
                    
                    // V + 方向キー: アクティブレイヤー移動
                    case 'layerMoveUp':
                        if (this.vKeyPressed && !e.shiftKey) {
                            this.moveActiveLayer('ArrowUp');
                            e.preventDefault();
                        }
                        break;
                        
                    case 'layerMoveDown':
                        if (this.vKeyPressed && !e.shiftKey) {
                            this.moveActiveLayer('ArrowDown');
                            e.preventDefault();
                        }
                        break;
                        
                    case 'layerMoveLeft':
                        if (this.vKeyPressed && !e.shiftKey) {
                            this.moveActiveLayer('ArrowLeft');
                            e.preventDefault();
                        }
                        break;
                        
                    case 'layerMoveRight':
                        if (this.vKeyPressed && !e.shiftKey) {
                            this.moveActiveLayer('ArrowRight');
                            e.preventDefault();
                        }
                        break;
                    
                    // V + Shift + 方向キー: アクティブレイヤー拡縮・回転
                    case 'layerScaleUp':
                        if (this.vKeyPressed && e.shiftKey) {
                            this.transformActiveLayer('ArrowUp');
                            e.preventDefault();
                        }
                        break;
                        
                    case 'layerScaleDown':
                        if (this.vKeyPressed && e.shiftKey) {
                            this.transformActiveLayer('ArrowDown');
                            e.preventDefault();
                        }
                        break;
                        
                    case 'layerRotateLeft':
                        if (this.vKeyPressed && e.shiftKey) {
                            this.transformActiveLayer('ArrowLeft');
                            e.preventDefault();
                        }
                        break;
                        
                    case 'layerRotateRight':
                        if (this.vKeyPressed && e.shiftKey) {
                            this.transformActiveLayer('ArrowRight');
                            e.preventDefault();
                        }
                        break;
                    
                    // V + H / V + Shift + H: アクティブレイヤー反転
                    case 'horizontalFlip':
                        if (this.vKeyPressed && !e.ctrlKey && !e.altKey && !e.metaKey) {
                            if (e.shiftKey) {
                                this.flipActiveLayer('vertical');
                            } else {
                                this.flipActiveLayer('horizontal');
                            }
                            e.preventDefault();
                        }
                        break;
                }
            });
            
            // keyupイベント処理（Vキー解除修正）
            document.addEventListener('keyup', (e) => {
                if (e.code === 'KeyV' && this.vKeyPressed) {
                    console.log('🔧 V key released, exiting layer move mode');
                    this.exitLayerMoveMode();
                    e.preventDefault();
                }
            });
            
            // フォーカス制御（キーリセット）
            window.addEventListener('blur', () => {
                if (this.vKeyPressed) {
                    console.log('🔧 Window blur, resetting V key state');
                    this.exitLayerMoveMode();
                }
            });
            
            // V + ドラッグ: アクティブレイヤー移動・変形
            this._setupLayerDragEvents();
            
            console.log('⌨️ Layer operations configured');
        }

        // レイヤー階層移動（アクティブレイヤーの変更のみ）
        moveActiveLayerHierarchy(direction) {
            if (this.layers.length <= 1) return;
            
            const currentIndex = this.activeLayerIndex;
            let newIndex;
            
            if (direction === 'up') {
                // 上の階層（配列の後ろ側）に移動
                newIndex = Math.min(currentIndex + 1, this.layers.length - 1);
            } else if (direction === 'down') {
                // 下の階層（配列の前側）に移動
                newIndex = Math.max(currentIndex - 1, 0);
            } else {
                return;
            }
            
            if (newIndex !== currentIndex) {
                this.setActiveLayer(newIndex);
                console.log(`🔄 Layer hierarchy moved: ${direction} (${currentIndex} → ${newIndex})`);
                
                if (this.eventBus) {
                    this.eventBus.emit('layer:hierarchy-moved', { 
                        direction, 
                        oldIndex: currentIndex, 
                        newIndex 
                    });
                }
            }
        }

        // 安全なドラッグイベント設定
        _setupLayerDragEvents() {
            const canvas = this._getSafeCanvas();
            if (!canvas) {
                console.warn('LayerSystem: Canvas not found for drag events');
                return;
            }
            
            canvas.addEventListener('pointerdown', (e) => {
                if (this.vKeyPressed && e.button === 0) {
                    this.isLayerDragging = true;
                    this.layerDragLastPoint = { x: e.clientX, y: e.clientY };
                    canvas.style.cursor = 'move';
                    e.preventDefault();
                }
            });
            
            canvas.addEventListener('pointermove', (e) => {
                if (this.isLayerDragging && this.vKeyPressed) {
                    this._handleLayerDrag(e);
                }
            });
            
            canvas.addEventListener('pointerup', (e) => {
                if (this.isLayerDragging) {
                    this.isLayerDragging = false;
                    this.updateCursor();
                }
            });
        }

        // 安全なCanvas要素取得
        _getSafeCanvas() {
            // app参照からcanvas要素を取得
            if (this.app?.canvas) {
                return this.app.canvas;
            }
            if (this.app?.view) {
                return this.app.view;
            }
            // フォールバック：DOM検索
            const canvasElements = document.querySelectorAll('canvas');
            if (canvasElements.length > 0) {
                return canvasElements[0];
            }
            return null;
        }

        _handleLayerDrag(e) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer?.layerData) return;

            const dx = e.clientX - this.layerDragLastPoint.x;
            const dy = e.clientY - this.layerDragLastPoint.y;
            
            // カメラスケール考慮
            const worldScale = this.cameraSystem ? this.cameraSystem.worldContainer.scale.x : 1;
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
                const centerX = this.config.canvas.width / 2;
                const centerY = this.config.canvas.height / 2;
                
                if (Math.abs(dy) > Math.abs(dx)) {
                    // 垂直方向優先: 拡縮
                    const scaleFactor = 1 + (dy * -0.01);
                    const currentScale = Math.abs(transform.scaleX);
                    const newScale = Math.max(this.config.layer.minScale, 
                        Math.min(this.config.layer.maxScale, currentScale * scaleFactor));
                    
                    transform.scaleX = transform.scaleX < 0 ? -newScale : newScale;
                    transform.scaleY = transform.scaleY < 0 ? -newScale : newScale;
                    
                    // スライダー更新
                    const scaleSlider = document.getElementById('layer-scale-slider');
                    if (scaleSlider?.updateValue) {
                        scaleSlider.updateValue(newScale);
                    }
                } else {
                    // 水平方向優先: 回転
                    transform.rotation += (dx * 0.02);
                    
                    const rotationSlider = document.getElementById('layer-rotation-slider');
                    if (rotationSlider?.updateValue) {
                        rotationSlider.updateValue(transform.rotation * 180 / Math.PI);
                    }
                }
                
                // 【統一】座標変換API適用
                if (this.coordAPI?.applyLayerTransform) {
                    this.coordAPI.applyLayerTransform(activeLayer, transform, centerX, centerY);
                } else {
                    this._applyTransformDirect(activeLayer, transform, centerX, centerY);
                }
            } else {
                // V + ドラッグ: 移動
                transform.x += adjustedDx;
                transform.y += adjustedDy;
                
                const centerX = this.config.canvas.width / 2;
                const centerY = this.config.canvas.height / 2;
                
                // 【統一】座標変換API適用
                if (this.coordAPI?.applyLayerTransform) {
                    this.coordAPI.applyLayerTransform(activeLayer, transform, centerX, centerY);
                } else {
                    activeLayer.position.set(centerX + transform.x, centerY + transform.y);
                }
                
                // スライダー更新
                const xSlider = document.getElementById('layer-x-slider');
                const ySlider = document.getElementById('layer-y-slider');
                if (xSlider?.updateValue) xSlider.updateValue(transform.x);
                if (ySlider?.updateValue) ySlider.updateValue(transform.y);
            }
            
            this.layerDragLastPoint = { x: e.clientX, y: e.clientY };
            this.requestThumbnailUpdate(this.activeLayerIndex);
            
            // 【重要】AnimationSystemにCUT内レイヤー更新を通知
            if (this.animationSystem?.updateCurrentCutLayer) {
                this.animationSystem.updateCurrentCutLayer(this.activeLayerIndex, {
                    transform: { ...transform }
                });
            }
            
            if (this.eventBus) {
                this.eventBus.emit('layer:updated', { layerId, transform });
            }
        }

        // レイヤー移動モード制御
        toggleLayerMoveMode() {
            if (this.vKeyPressed) {
                this.exitLayerMoveMode();
            } else {
                this.enterLayerMoveMode();
            }
        }
        
        enterLayerMoveMode() {
            if (this.isLayerMoveMode) return;
            
            console.log('🔧 Entering layer move mode');
            this.isLayerMoveMode = true;
            this.vKeyPressed = true;
            
            if (this.cameraSystem?.setVKeyPressed) {
                this.cameraSystem.setVKeyPressed(true);
                this.cameraSystem.showGuideLines();
            }
            
            if (this.layerTransformPanel) {
                this.layerTransformPanel.classList.add('show');
                this.updateLayerTransformPanelValues();
            }
            
            this.updateCursor();
            
            if (this.eventBus) {
                this.eventBus.emit('layer:move-mode-entered');
            }
        }
        
        exitLayerMoveMode() {
            if (!this.isLayerMoveMode) return;
            
            console.log('🔧 Exiting layer move mode');
            this.isLayerMoveMode = false;
            this.vKeyPressed = false;
            this.isLayerDragging = false;
            
            if (this.cameraSystem?.setVKeyPressed) {
                this.cameraSystem.setVKeyPressed(false);
                this.cameraSystem.hideGuideLines();
            }
            
            if (this.layerTransformPanel) {
                this.layerTransformPanel.classList.remove('show');
            }
            
            this.updateCursor();
            
            // V解除時に自動確定
            this.confirmLayerTransform();
            
            if (this.eventBus) {
                this.eventBus.emit('layer:move-mode-exited');
            }
        }

        moveActiveLayer(keyCode) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer?.layerData) return;
            
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
            
            const centerX = this.config.canvas.width / 2;
            const centerY = this.config.canvas.height / 2;
            
            // 【統一】座標変換API適用
            if (this.coordAPI?.applyLayerTransform) {
                this.coordAPI.applyLayerTransform(activeLayer, transform, centerX, centerY);
            } else {
                activeLayer.position.set(centerX + transform.x, centerY + transform.y);
            }
            
            // スライダー値更新
            const xSlider = document.getElementById('layer-x-slider');
            const ySlider = document.getElementById('layer-y-slider');
            if (xSlider?.updateValue) xSlider.updateValue(transform.x);
            if (ySlider?.updateValue) ySlider.updateValue(transform.y);
            
            this.requestThumbnailUpdate(this.activeLayerIndex);
            
            // 【重要】AnimationSystemにCUT内レイヤー更新を通知
            if (this.animationSystem?.updateCurrentCutLayer) {
                this.animationSystem.updateCurrentCutLayer(this.activeLayerIndex, {
                    transform: { ...transform }
                });
            }
            
            if (this.eventBus) {
                this.eventBus.emit('layer:updated', { layerId, transform });
            }
        }

        transformActiveLayer(keyCode) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer?.layerData) return;
            
            const layerId = activeLayer.layerData.id;
            
            if (!this.layerTransforms.has(layerId)) {
                this.layerTransforms.set(layerId, {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                });
            }
            
            const transform = this.layerTransforms.get(layerId);
            const centerX = this.config.canvas.width / 2;
            const centerY = this.config.canvas.height / 2;
            
            switch(keyCode) {
                case 'ArrowUp': // 拡大
                    const scaleUpFactor = 1.1;
                    const currentScaleUp = Math.abs(transform.scaleX);
                    const newScaleUp = Math.min(this.config.layer.maxScale, currentScaleUp * scaleUpFactor);
                    transform.scaleX = transform.scaleX < 0 ? -newScaleUp : newScaleUp;
                    transform.scaleY = transform.scaleY < 0 ? -newScaleUp : newScaleUp;
                    
                    const scaleSliderUp = document.getElementById('layer-scale-slider');
                    if (scaleSliderUp?.updateValue) {
                        scaleSliderUp.updateValue(newScaleUp);
                    }
                    break;
                    
                case 'ArrowDown': // 縮小
                    const scaleDownFactor = 0.9;
                    const currentScaleDown = Math.abs(transform.scaleX);
                    const newScaleDown = Math.max(this.config.layer.minScale, currentScaleDown * scaleDownFactor);
                    transform.scaleX = transform.scaleX < 0 ? -newScaleDown : newScaleDown;
                    transform.scaleY = transform.scaleY < 0 ? -newScaleDown : newScaleDown;
                    
                    const scaleSliderDown = document.getElementById('layer-scale-slider');
                    if (scaleSliderDown?.updateValue) {
                        scaleSliderDown.updateValue(newScaleDown);
                    }
                    break;
                    
                case 'ArrowLeft': // 左回転
                    transform.rotation -= (15 * Math.PI) / 180;
                    
                    const rotationSliderLeft = document.getElementById('layer-rotation-slider');
                    if (rotationSliderLeft?.updateValue) {
                        rotationSliderLeft.updateValue(transform.rotation * 180 / Math.PI);
                    }
                    break;
                    
                case 'ArrowRight': // 右回転
                    transform.rotation += (15 * Math.PI) / 180;
                    
                    const rotationSliderRight = document.getElementById('layer-rotation-slider');
                    if (rotationSliderRight?.updateValue) {
                        rotationSliderRight.updateValue(transform.rotation * 180 / Math.PI);
                    }
                    break;
            }
            
            // 【統一】座標変換API適用
            if (this.coordAPI?.applyLayerTransform) {
                this.coordAPI.applyLayerTransform(activeLayer, transform, centerX, centerY);
            } else {
                this._applyTransformDirect(activeLayer, transform, centerX, centerY);
            }
            
            this.requestThumbnailUpdate(this.activeLayerIndex);
            
            // 【重要】AnimationSystemにCUT内レイヤー更新を通知
            if (this.animationSystem?.updateCurrentCutLayer) {
                this.animationSystem.updateCurrentCutLayer(this.activeLayerIndex, {
                    transform: { ...transform }
                });
            }
            
            if (this.eventBus) {
                this.eventBus.emit('layer:updated', { layerId, transform });
            }
        }

        // === 非破壊的レイヤー変形確定処理 ===
        confirmLayerTransform() {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer?.layerData) return;
            
            const layerId = activeLayer.layerData.id;
            const transform = this.layerTransforms.get(layerId);
            
            if (this.isTransformNonDefault(transform)) {
                try {
                    const success = this.safeApplyTransformToPaths(activeLayer, transform);
                    
                    if (success) {
                        // 表示transformをリセット
                        activeLayer.position.set(0, 0);
                        activeLayer.rotation = 0;
                        activeLayer.scale.set(1, 1);
                        activeLayer.pivot.set(0, 0);
                        
                        // 変形データをクリア
                        this.layerTransforms.set(layerId, {
                            x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                        });
                        
                        this.updateFlipButtons();
                        this.requestThumbnailUpdate(this.activeLayerIndex);
                        
                        // 【重要】AnimationSystemにCUT状態完全保存
                        if (this.animationSystem?.saveCutLayerStates) {
                            this.animationSystem.saveCutLayerStates();
                        }
                        
                        if (this.eventBus) {
                            this.eventBus.emit('layer:transform-confirmed', { layerId });
                        }
                        
                        console.log('✅ Layer transform confirmed and applied to paths');
                    }
                    
                } catch (error) {
                    console.error('Transform confirmation failed:', error);
                }
            }
        }

        // 正確な変形行列順序による安全なパス変形適用処理
        safeApplyTransformToPaths(layer, transform) {
            if (!layer.layerData?.paths || layer.layerData.paths.length === 0) {
                return true;
            }
            
            try {
                const centerX = this.config.canvas.width / 2;
                const centerY = this.config.canvas.height / 2;
                
                const matrix = this.createTransformMatrix(transform, centerX, centerY);
                
                const transformedPaths = [];
                
                for (let i = 0; i < layer.layerData.paths.length; i++) {
                    const path = layer.layerData.paths[i];
                    
                    if (!path?.points || !Array.isArray(path.points) || path.points.length === 0) {
                        continue;
                    }
                    
                    const transformedPoints = this.safeTransformPoints(path.points, matrix);
                    
                    if (transformedPoints.length === 0) {
                        continue;
                    }
                    
                    const transformedPath = {
                        id: path.id,
                        points: transformedPoints,
                        color: path.color,
                        size: path.size,
                        opacity: path.opacity,
                        tool: path.tool,
                        isComplete: path.isComplete || true,
                        graphics: null
                    };
                    
                    transformedPaths.push(transformedPath);
                }
                
                const rebuildSuccess = this.safeRebuildLayer(layer, transformedPaths);
                return rebuildSuccess;
                
            } catch (error) {
                console.error('Error in safeApplyTransformToPaths:', error);
                return false;
            }
        }

        // 正しい変形行列順序でのマトリクス作成（PixiJS標準準拠）
        createTransformMatrix(transform, centerX, centerY) {
            const matrix = new PIXI.Matrix();
            
            // 正しい変形順序（PixiJS標準）
            matrix.translate(-centerX, -centerY);
            matrix.scale(transform.scaleX, transform.scaleY);
            matrix.rotate(transform.rotation);
            matrix.translate(centerX + transform.x, centerY + transform.y);
            
            return matrix;
        }

        safeTransformPoints(points, matrix) {
            const transformedPoints = [];
            
            for (let i = 0; i < points.length; i++) {
                const point = points[i];
                
                if (typeof point.x !== 'number' || typeof point.y !== 'number' ||
                    !isFinite(point.x) || !isFinite(point.y)) {
                    continue;
                }
                
                try {
                    const transformed = matrix.apply(point);
                    
                    if (typeof transformed.x === 'number' && typeof transformed.y === 'number' &&
                        isFinite(transformed.x) && isFinite(transformed.y)) {
                        transformedPoints.push({
                            x: transformed.x,
                            y: transformed.y
                        });
                    }
                    
                } catch (transformError) {
                    if (this.config.debug) {
                        console.warn(`Point transform failed for point ${i}:`, transformError);
                    }
                }
            }
            
            return transformedPoints;
        }

        safeRebuildLayer(layer, newPaths) {
            try {
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
                
                layer.layerData.paths = [];
                
                let addedCount = 0;
                for (let i = 0; i < newPaths.length; i++) {
                    const path = newPaths[i];
                    
                    try {
                        const rebuildSuccess = this.rebuildPathGraphics(path);
                        
                        if (rebuildSuccess && path.graphics) {
                            layer.layerData.paths.push(path);
                            layer.addChild(path.graphics);
                            addedCount++;
                        }
                        
                    } catch (pathError) {
                        console.error(`Error adding path ${i}:`, pathError);
                    }
                }
                
                return addedCount > 0 || newPaths.length === 0;
                
            } catch (error) {
                console.error('Error in safeRebuildLayer:', error);
                return false;
            }
        }

        // PixiJS v8.13対応パスGraphics再生成
        rebuildPathGraphics(path) {
            try {
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
                
                path.graphics = new PIXI.Graphics();
                
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

        isTransformNonDefault(transform) {
            if (!transform) return false;
            return (transform.x !== 0 || transform.y !== 0 || 
                    transform.rotation !== 0 || Math.abs(transform.scaleX) !== 1 || Math.abs(transform.scaleY) !== 1);
        }

        updateCursor() {
            const canvas = this._getSafeCanvas();
            if (!canvas) return;

            if (this.vKeyPressed) {
                canvas.style.cursor = 'grab';
            } else {
                canvas.style.cursor = 'default';
            }
        }

        // === 【改修】レイヤー管理API：AnimationSystem完全統合版 ===
        
        createLayer(name, isBackground = false) {
            const layer = new PIXI.Container();
            const layerId = `layer_${this.layerCounter++}`;
            
            layer.label = layerId;
            layer.layerData = {
                id: layerId,
                name: name || `レイヤー${this.layerCounter}`,
                visible: true,
                opacity: 1.0,
                isBackground: isBackground,
                paths: []
            };

            // 変形データを初期化
            this.layerTransforms.set(layerId, {
                x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
            });

            // 背景グラフィックス作成
            if (isBackground) {
                const bg = new PIXI.Graphics();
                bg.rect(0, 0, this.config.canvas.width, this.config.canvas.height);
                bg.fill(this.config.background.color);
                layer.addChild(bg);
                layer.layerData.backgroundGraphics = bg;
            }

            // レイヤーシステムに追加
            this.layers.push(layer);
            this.layersContainer.addChild(layer);
            
            // アクティブレイヤー設定
            this.setActiveLayer(this.layers.length - 1);
            
            // 【重要】AnimationSystemに新規レイヤー通知
            if (this.animationSystem?.addLayerToCurrentCut) {
                const layerData = {
                    id: layerId,
                    name: name || `レイヤー${this.layerCounter}`,
                    visible: true,
                    opacity: 1.0,
                    isBackground: isBackground,
                    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
                    paths: []
                };
                
                this.animationSystem.addLayerToCurrentCut(layerData);
                console.log(`🎬 Layer added to current CUT: ${layerData.name}`);
            }
            
            // EventBus通知
            if (this.eventBus) {
                this.eventBus.emit('layer:created', { layerId, name, isBackground });
            }
            
            // UI更新
            this.updateLayerPanelUI();
            this.updateStatusDisplay();
            
            console.log(`🎨 Layer created: ${name} (${layerId})`);
            return { layer, index: this.layers.length - 1 };
        }

        deleteLayer(layerIndex) {
            if (this.layers.length <= 1) {
                console.warn('Cannot delete last remaining layer');
                return false;
            }
            
            if (layerIndex < 0 || layerIndex >= this.layers.length) {
                console.warn(`Invalid layer index for deletion: ${layerIndex}`);
                return false;
            }

            const layer = this.layers[layerIndex];
            const layerId = layer.layerData.id;
            
            console.log(`🗑️ Layer deletion started: ${layer.layerData.name}`);
            
            // パスグラフィックスの破棄
            if (layer.layerData.paths) {
                layer.layerData.paths.forEach(path => {
                    if (path.graphics?.destroy) {
                        path.graphics.destroy();
                    }
                });
            }

            // 変形データも削除
            this.layerTransforms.delete(layerId);

            // コンテナから削除・破棄
            this.layersContainer.removeChild(layer);
            layer.destroy({ children: true, texture: false, baseTexture: false });
            this.layers.splice(layerIndex, 1);

            // アクティブレイヤーインデックス調整
            if (this.activeLayerIndex === layerIndex) {
                this.activeLayerIndex = Math.min(this.activeLayerIndex, this.layers.length - 1);
            } else if (this.activeLayerIndex > layerIndex) {
                this.activeLayerIndex--;
            }

            // 【重要】AnimationSystemにCUT状態保存指示
            if (this.animationSystem?.saveCutLayerStates) {
                this.animationSystem.saveCutLayerStates();
            }

            // UI更新
            this.updateLayerPanelUI();
            this.updateStatusDisplay();
            
            if (this.eventBus) {
                this.eventBus.emit('layer:deleted', { layerId, layerIndex });
            }
            
            console.log(`✅ Layer deleted: ${layer.layerData.name}`);
            return true;
        }

        setActiveLayer(index) {
            if (index >= 0 && index < this.layers.length) {
                const oldIndex = this.activeLayerIndex;
                this.activeLayerIndex = index;
                
                this.updateLayerPanelUI();
                this.updateStatusDisplay();
                
                if (this.isLayerMoveMode) {
                    this.updateLayerTransformPanelValues();
                }
                
                if (this.eventBus) {
                    this.eventBus.emit('layer:activated', { 
                        layerIndex: index, 
                        oldIndex: oldIndex,
                        layerId: this.layers[index]?.layerData?.id
                    });
                }
                
                console.log(`🎯 Active layer changed: ${index} (${this.layers[index]?.layerData?.name})`);
            }
        }

        getActiveLayer() {
            return this.activeLayerIndex >= 0 ? this.layers[this.activeLayerIndex] : null;
        }

        toggleLayerVisibility(layerIndex) {
            if (layerIndex >= 0 && layerIndex < this.layers.length) {
                const layer = this.layers[layerIndex];
                layer.layerData.visible = !layer.layerData.visible;
                layer.visible = layer.layerData.visible;
                
                // 【重要】AnimationSystemにCUT内レイヤー更新を通知
                if (this.animationSystem?.updateCurrentCutLayer) {
                    this.animationSystem.updateCurrentCutLayer(layerIndex, {
                        visible: layer.layerData.visible
                    });
                }
                
                this.updateLayerPanelUI();
                this.requestThumbnailUpdate(layerIndex);
                
                if (this.eventBus) {
                    this.eventBus.emit('layer:visibility-changed', { 
                        layerIndex, 
                        visible: layer.layerData.visible,
                        layerId: layer.layerData.id
                    });
                }
                
                console.log(`👁️ Layer visibility toggled: ${layer.layerData.name} -> ${layer.layerData.visible ? 'visible' : 'hidden'}`);
            }
        }

        // 【改修】AnimationSystem統合版：パス追加
        addPathToLayer(layerIndex, path) {
            if (layerIndex >= 0 && layerIndex < this.layers.length) {
                const layer = this.layers[layerIndex];
                
                // レイヤーのパス配列に追加
                layer.layerData.paths.push(path);
                layer.addChild(path.graphics);
                
                // サムネイル更新リクエスト
                this.requestThumbnailUpdate(layerIndex);
                
                // 【重要】AnimationSystemにCUT状態自動保存
                if (this.animationSystem?.saveCutLayerStates) {
                    // 少し遅延させて複数のパス追加を一括処理
                    setTimeout(() => {
                        this.animationSystem.saveCutLayerStates();
                    }, 50);
                }
                
                if (this.eventBus) {
                    this.eventBus.emit('layer:path-added', { 
                        layerIndex, 
                        pathId: path.id,
                        layerId: layer.layerData.id
                    });
                }
                
                console.log(`✏️ Path added to layer: ${layer.layerData.name} (${path.id})`);
            }
        }

        // 【改修】AnimationSystem統合版：アクティブレイヤーにパス追加
        addPathToActiveLayer(path) {
            if (this.activeLayerIndex >= 0) {
                this.addPathToLayer(this.activeLayerIndex, path);
            } else {
                console.warn('No active layer available for path addition');
            }
        }

        // クリップボード処理（互換性維持）
        insertClipboard(data) {
            if (this.eventBus) {
                this.eventBus.emit('layer:clipboard-inserted', data);
            }
        }

        // === サムネイル管理システム ===
        
        requestThumbnailUpdate(layerIndex) {
            if (layerIndex >= 0 && layerIndex < this.layers.length) {
                this.thumbnailUpdateQueue.add(layerIndex);
                
                // 即座に処理（throttle処理は削除してレスポンス向上）
                if (!this.thumbnailUpdateTimer) {
                    this.thumbnailUpdateTimer = setTimeout(() => {
                        this.processThumbnailUpdates();
                        this.thumbnailUpdateTimer = null;
                    }, 100);
                }
            }
        }

        _startThumbnailUpdateProcess() {
            // 定期的なサムネイル更新処理（低優先度）
            setInterval(() => {
                if (this.thumbnailUpdateQueue.size > 0) {
                    this.processThumbnailUpdates();
                }
            }, 500);
        }

        processThumbnailUpdates() {
            if (this.thumbnailUpdateQueue.size === 0) return;

            // 全てのキューを処理（パフォーマンス制限を緩和）
            const toUpdate = Array.from(this.thumbnailUpdateQueue);
            toUpdate.forEach(layerIndex => {
                this.updateThumbnail(layerIndex);
                this.thumbnailUpdateQueue.delete(layerIndex);
            });
        }

        // 【改修】アスペクト比対応・高品質サムネイル更新
        updateThumbnail(layerIndex) {
            if (!this.app?.renderer || layerIndex < 0 || layerIndex >= this.layers.length) {
                return;
            }

            const layer = this.layers[layerIndex];
            const layerItems = document.querySelectorAll('.layer-item');
            const panelIndex = this.layers.length - 1 - layerIndex;
            
            if (panelIndex < 0 || panelIndex >= layerItems.length) return;
            
            const thumbnail = layerItems[panelIndex].querySelector('.layer-thumbnail');
            if (!thumbnail) return;

            try {
                // 【重要】プロジェクトキャンバス比率対応
                const canvasAspectRatio = this.config.canvas.width / this.config.canvas.height;
                let thumbnailWidth, thumbnailHeight;
                const maxHeight = 48;
                const maxWidth = 72;

                // アスペクト比維持計算
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
                
                // 【重要】高品質レンダリング用テクスチャ作成
                const renderScale = this.config.thumbnail?.RENDER_SCALE || 2;
                const renderTexture = PIXI.RenderTexture.create({
                    width: this.config.canvas.width * renderScale,
                    height: this.config.canvas.height * renderScale,
                    resolution: renderScale
                });
                
                // レイヤーの現在の変形状態を保持してサムネイル生成
                const layerId = layer.layerData.id;
                const transform = this.layerTransforms.get(layerId);
                
                // 一時コンテナでサムネイル用レンダリング
                const tempContainer = new PIXI.Container();
                
                // レイヤーの現在の変形状態を保存
                const originalState = {
                    pos: { x: layer.position.x, y: layer.position.y },
                    scale: { x: layer.scale.x, y: layer.scale.y },
                    rotation: layer.rotation,
                    pivot: { x: layer.pivot.x, y: layer.pivot.y }
                };
                
                // サムネイル用の変形をリセット
                layer.position.set(0, 0);
                layer.scale.set(1, 1);
                layer.rotation = 0;
                layer.pivot.set(0, 0);
                
                tempContainer.addChild(layer);
                tempContainer.scale.set(renderScale);
                
                // レンダリング実行
                this.app.renderer.render({
                    container: tempContainer,
                    target: renderTexture
                });
                
                // レイヤーの変形状態を復元
                layer.position.set(originalState.pos.x, originalState.pos.y);
                layer.scale.set(originalState.scale.x, originalState.scale.y);
                layer.rotation = originalState.rotation;
                layer.pivot.set(originalState.pivot.x, originalState.pivot.y);
                
                // レイヤーを元のコンテナに戻す
                tempContainer.removeChild(layer);
                this.layersContainer.addChildAt(layer, layerIndex);
                
                // 【重要】Canvas APIで高品質ダウンスケール
                const sourceCanvas = this.app.renderer.extract.canvas(renderTexture);
                const targetCanvas = document.createElement('canvas');
                targetCanvas.width = Math.round(thumbnailWidth);
                targetCanvas.height = Math.round(thumbnailHeight);
                
                const ctx = targetCanvas.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = this.config.thumbnail?.QUALITY || 'high';
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
                console.warn(`Thumbnail update failed for layer ${layerIndex}:`, error);
            }
        }

        // === UI管理システム ===

        updateLayerPanelUI() {
            const layerList = document.getElementById('layer-list');
            if (!layerList) {
                console.warn('Layer panel UI not found');
                return;
            }

            layerList.innerHTML = '';

            // レイヤーを逆順で表示（上位レイヤーが上に表示）
            for (let i = this.layers.length - 1; i >= 0; i--) {
                const layer = this.layers[i];
                const isActive = (i === this.activeLayerIndex);
                
                const layerItem = document.createElement('div');
                layerItem.className = `layer-item ${isActive ? 'active' : ''}`;
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
                    <div class="layer-opacity">${Math.round((layer.layerData.opacity || 1.0) * 100)}%</div>
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

                // イベントリスナー設定
                layerItem.addEventListener('click', (e) => {
                    const target = e.target.closest('[class*="layer-"]');
                    if (target) {
                        const action = target.className;
                        if (action.includes('layer-visibility')) {
                            this.toggleLayerVisibility(i);
                            e.stopPropagation();
                        } else if (action.includes('layer-delete')) {
                            if (confirm(`レイヤー "${layer.layerData.name}" を削除しますか？`)) {
                                this.deleteLayer(i);
                            }
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
        }

        updateStatusDisplay() {
            const statusElement = document.getElementById('current-layer');
            if (statusElement && this.activeLayerIndex >= 0) {
                const layer = this.layers[this.activeLayerIndex];
                statusElement.textContent = layer.layerData.name;
            }
            
            if (this.eventBus) {
                this.eventBus.emit('ui:status-updated', {
                    currentLayer: this.activeLayerIndex >= 0 ? 
                        this.layers[this.activeLayerIndex].layerData.name : 'なし',
                    layerCount: this.layers.length,
                    activeIndex: this.activeLayerIndex
                });
            }
        }

        // === 【改修】AnimationSystem統合CUT管理 ===
        
        // CUT切り替え時の自動UI更新（AnimationSystemから呼び出される）
        setActiveCut(cutIndex) {
            if (!this.animationSystem) {
                console.warn('AnimationSystem not available for setActiveCut');
                return;
            }
            
            console.log(`🎬 LayerSystem: CUT切り替え UI更新 -> ${cutIndex}`);
            
            // UI更新
            setTimeout(() => {
                this.updateLayerPanelUI();
                this.updateStatusDisplay();
                
                // レイヤー変形パネル更新
                if (this.isLayerMoveMode) {
                    this.updateLayerTransformPanelValues();
                }
            }, 50);
        }

        // === システム連携 ===

        setCameraSystem(cameraSystem) {
            this.cameraSystem = cameraSystem;
            console.log('🔗 CameraSystem reference set');
        }

        setApp(app) {
            this.app = app;
            console.log('🔗 PixiJS App reference set');
        }

        // 【改修】AnimationSystem参照設定
        setAnimationSystem(animationSystem) {
            this.animationSystem = animationSystem;
            console.log('✅ AnimationSystem reference set');
            
            // 双方向参照確認
            if (animationSystem && animationSystem.layerSystem !== this) {
                animationSystem.layerSystem = this;
                console.log('🔗 Bidirectional AnimationSystem reference established');
            }
        }

        // === 診断・デバッグシステム ===
        
        checkAnimationSystemIntegration() {
            const integration = {
                hasAnimationSystem: !!this.animationSystem,
                currentCutIndex: this.animationSystem ? this.animationSystem.getCurrentCutIndex() : 'N/A',
                cutCount: this.animationSystem ? this.animationSystem.getCutCount() : 'N/A',
                layerCount: this.layers.length,
                activeLayerIndex: this.activeLayerIndex,
                layerTransformCount: this.layerTransforms.size,
                hasCoordAPI: !!this.coordAPI,
                hasEventBus: !!this.eventBus
            };
            
            const issues = [];
            if (!integration.hasAnimationSystem) issues.push('AnimationSystem reference missing');
            if (!integration.hasCoordAPI) issues.push('CoordinateSystem API missing');
            if (!integration.hasEventBus) issues.push('EventBus missing');
            if (integration.layerCount === 0) issues.push('No layers available');
            
            integration.issues = issues;
            integration.healthScore = Math.max(0, 100 - (issues.length * 25));
            
            return integration;
        }
        
        diagnoseSystem() {
            const diagnosis = {
                timestamp: new Date().toISOString(),
                layerSystem: {
                    initialized: !!(this.layers && this.layersContainer),
                    layerCount: this.layers.length,
                    activeLayerIndex: this.activeLayerIndex,
                    transformMapSize: this.layerTransforms.size,
                    thumbnailQueueSize: this.thumbnailUpdateQueue.size,
                    isLayerMoveMode: this.isLayerMoveMode,
                    vKeyPressed: this.vKeyPressed
                },
                integration: this.checkAnimationSystemIntegration(),
                pixiJS: {
                    hasApp: !!this.app,
                    hasRenderer: !!(this.app?.renderer),
                    hasLayersContainer: !!this.layersContainer,
                    layersContainerChildren: this.layersContainer ? this.layersContainer.children.length : 0
                },
                ui: {
                    hasTransformPanel: !!this.layerTransformPanel,
                    hasLayerList: !!document.getElementById('layer-list')
                }
            };
            
            // 問題検出
            const issues = [];
            if (!diagnosis.layerSystem.initialized) issues.push('LayerSystem not initialized');
            if (diagnosis.integration.issues.length > 0) issues.push(...diagnosis.integration.issues);
            if (!diagnosis.pixiJS.hasApp) issues.push('PixiJS App missing');
            if (!diagnosis.pixiJS.hasRenderer) issues.push('PixiJS Renderer missing');
            if (!diagnosis.ui.hasLayerList) issues.push('Layer panel UI missing');
            
            diagnosis.issues = issues;
            diagnosis.healthScore = Math.max(0, 100 - (issues.length * 15));
            
            return diagnosis;
        }
        
        logDebugInfo() {
            console.log('🔍 LayerSystem Debug Info:');
            console.log('=====================================');
            
            const diagnosis = this.diagnoseSystem();
            const integration = diagnosis.integration;
            
            console.log('📊 Basic Status:');
            console.log(`  - Initialized: ${diagnosis.layerSystem.initialized ? '✅' : '❌'}`);
            console.log(`  - Layer Count: ${diagnosis.layerSystem.layerCount}`);
            console.log(`  - Active Layer: ${diagnosis.layerSystem.activeLayerIndex + 1}/${diagnosis.layerSystem.layerCount}`);
            console.log(`  - Transform Map: ${diagnosis.layerSystem.transformMapSize}`);
            
            console.log('🎬 Animation Integration:');
            console.log(`  - Has AnimationSystem: ${integration.hasAnimationSystem ? '✅' : '❌'}`);
            console.log(`  - Current CUT: ${integration.currentCutIndex + 1}/${integration.cutCount}`);
            console.log(`  - Coord API: ${integration.hasCoordAPI ? '✅' : '❌'}`);
            console.log(`  - EventBus: ${integration.hasEventBus ? '✅' : '❌'}`);
            
            console.log('🎛️ Layer Move Mode:');
            console.log(`  - Is Layer Move Mode: ${diagnosis.layerSystem.isLayerMoveMode ? '✅' : '❌'}`);
            console.log(`  - V Key Pressed: ${diagnosis.layerSystem.vKeyPressed ? '✅' : '❌'}`);
            
            console.log('🏥 Health Check:');
            console.log(`  - Overall Health: ${diagnosis.healthScore}%`);
            console.log(`  - Integration Health: ${integration.healthScore}%`);
            if (diagnosis.issues.length > 0) {
                console.log('  - Issues:', diagnosis.issues);
            } else {
                console.log('  - Status: All systems operational ✅');
            }
            
            console.log('🎨 Layer Details:');
            this.layers.forEach((layer, index) => {
                const isActive = index === this.activeLayerIndex;
                const transform = this.layerTransforms.get(layer.layerData.id);
                const hasTransform = this.isTransformNonDefault(transform);
                console.log(`  - Layer${index + 1}: ${layer.layerData.name} ${isActive ? '(active)' : ''} ${hasTransform ? '(transformed)' : ''}`);
            });
            
            console.log('=====================================');
            
            return diagnosis;
        }
    }

    // グローバル公開
    window.TegakiLayerSystem = LayerSystem;

    console.log('✅ layer-system.js loaded (完全2次元マトリクス改修版)');
    console.log('🔧 改修完了項目:');
    console.log('  🆕 AnimationSystem完全統合・双方向参照');
    console.log('  🆕 _setupAnimationSystemIntegration(): CUT切り替え自動対応');
    console.log('  🆕 createLayer(): AnimationSystem自動通知');
    console.log('  🆕 addPathToLayer(): CUT状態自動保存');
    console.log('  🆕 toggleLayerVisibility(): CUT内レイヤー自動更新');
    console.log('  🆕 updateActiveLayerTransform(): 座標系API統合');
    console.log('  🆕 confirmLayerTransform(): 変形確定・CUT保存');
    console.log('  🆕 updateThumbnail(): アスペクト比対応・高品質レンダリング');
    console.log('  🆕 diagnoseSystem(): 統合システム診断');
    console.log('  🔧 GIF CUT移動: AnimationSystem連携 (方向キー)');
    console.log('  🔧 レイヤー操作: 完全EventBus統合');
    console.log('  🔧 座標変換API: CoordinateSystem統一');
    console.log('  🔧 サムネイル管理: レスポンス向上');
    console.log('  ✅ PixiJS v8.13 完全対応');
    console.log('  ✅ 2次元マトリクス構造実現');

})();// ===== system/layer-system.js - 完全2次元マトリクス改修版 =====
// 【最高優先改修】CUT×レイヤー 2次元マトリクス 完全対応
// 【根本解決】AnimationSystem完全統合・独立性保証
// 【座標系統一】CoordinateSystem API 統合・EventBus完全統合
// PixiJS v8.13 対応・計画書完全準拠版

(function() {
    'use strict';

    class LayerSystem {
        constructor() {
            this.app = null;
            this.config = null;
            this.eventBus = null;
            
            // レイヤー管理（現在表示中のレイヤー）
            this.layers = [];
            this.activeLayerIndex = -1;
            this.layerCounter = 0;
            
            // 【重要】レイヤー変形状態管理（現在表示中のレイヤーの状態）
            this.layerTransforms = new Map(); // layerId -> { x, y, rotation, scaleX, scaleY }
            
            // サムネイル更新管理
            this.thumbnailUpdateQueue = new Set();
            this.thumbnailUpdateTimer = null;
            
            // レイヤー操作モード
            this.vKeyPressed = false;
            this.isLayerMoveMode = false;
            this.isLayerDragging = false;
            this.layerDragLastPoint = { x: 0, y: 0 };
            
            // PixiJS Containers
            this.layersContainer = null;
            this.canvasContainer = null;
            this.layerTransformPanel = null;
            
            // システム連携
            this.cameraSystem = null;
            
            // 【重要】AnimationSystem統合参照
            this.animationSystem = null;
            
            // 【統一】座標変換API参照
            this.coordAPI = window.CoordinateSystem;
            if (!this.coordAPI) {
                console.warn('CoordinateSystem not available - fallback to basic transforms');
            }
        }

        init(canvasContainer, eventBus, config) {
            console.log('🎨 LayerSystem: 完全2次元マトリクス改修版 初期化開始...');
            
            this.eventBus = eventBus;
            this.config = config || window.TEGAKI_CONFIG;
            this.canvasContainer = canvasContainer;
            
            // 安全な参照確認
            if (!this.canvasContainer?.addChild) {
                console.error('LayerSystem: Invalid canvasContainer - must be PIXI.Container');
                throw new Error('Valid PIXI.Container required for LayerSystem');
            }
            
            if (!this.eventBus) {
                console.error('LayerSystem: EventBus is required');
                throw new Error('EventBus required for LayerSystem');
            }
            
            // コンテナ作成
            this._createContainers();
            
            // レイヤー操作設定
            this._setupLayerOperations();
            
            // UI設定
            this._setupLayerTransformPanel();
            
            // 【重要】AnimationSystem連携イベント設定
            this._setupAnimationSystemIntegration();
            
            // サムネイル更新処理開始
            this._startThumbnailUpdateProcess();
            
            console.log('✅ LayerSystem: 完全2次元マトリクス改修版 初期化完了');
        }

        _createContainers() {
            // メインレイヤーコンテナ作成
            this.layersContainer = new PIXI.Container();
            this.layersContainer.label = 'layersContainer';
            this.canvasContainer.addChild(this.layersContainer);
            
            console.log('📦 LayerSystem containers created');
        }
        
        // 【新規】AnimationSystem統合イベント設定
        _setupAnimationSystemIntegration() {
            if (!this.eventBus) return;
            
            // AnimationSystem準備完了時の自動連携設定
            this.eventBus.on('animation:system-ready', () => {
                this._establishAnimationSystemConnection();
            });
            
            // CUT切り替え時の自動UI更新
            this.eventBus.on('animation:cut-applied', (data) => {
                console.log(`🎬 CUT適用通知受信: ${data.cutIndex}`);
                setTimeout(() => {
                    this.updateLayerPanelUI();
                    this.updateStatusDisplay();
                    
                    if (this.isLayerMoveMode) {
                        this.updateLayerTransformPanelValues();
                    }
                }, 100);
            });
            
            // CUT作成・削除時のUI更新
            this.eventBus.on('animation:cut-created', () => {
                setTimeout(() => this.updateLayerPanelUI(), 100);
            });
            
            this.eventBus.on('animation:cut-deleted', () => {
                setTimeout(() => this.updateLayerPanelUI(), 100);
            });
            
            console.log('🔗 AnimationSystem integration events configured');
        }
        
        // AnimationSystem接続確立
        _establishAnimationSystemConnection() {
            // AnimationSystemの参照を取得
            if (window.TegakiAnimationSystem && !this.animationSystem) {
                // グローバルインスタンス検索
                const possibleInstances = [
                    window.animationSystem,
                    window.coreEngine?.animationSystem,
                    window.TegakiCoreEngine?.animationSystem
                ];
                
                for (let instance of possibleInstances) {
                    if (instance && typeof instance.getCurrentCut === 'function') {
                        this.animationSystem = instance;
                        break;
                    }
                }
                
                if (this.animationSystem) {
                    console.log('✅ AnimationSystem connection established');
                    
                    // 双方向参照確認
                    if (this.animationSystem.layerSystem !== this) {
                        this.animationSystem.layerSystem = this;
                        console.log('🔗 Bidirectional AnimationSystem reference set');
                    }
                } else {
                    console.warn('⚠️ AnimationSystem instance not found - some features may be limited');
                }
            }
        }

        _setupLayerTransformPanel() {
            this.layerTransformPanel = document.getElementById('layer-transform-panel');
            
            if (!this.layerTransformPanel) {
                console.warn('Layer transform panel not found in DOM');
                return;
            }
            
            // スライダー設定
            this._setupLayerSlider('layer-x-slider', this.config.layer.minX, this.config.layer.maxX, 0, (value) => {
                this.updateActiveLayerTransform('x', value);
                return Math.round(value) + 'px';
            });
            
            this._setupLayerSlider('layer-y-slider', this.config.layer.minY, this.config.layer.maxY, 0, (value) => {
                this.updateActiveLayerTransform('y', value);
                return Math.round(value) + 'px';
            });
            
            this._setupLayerSlider('layer-rotation-slider', this.config.layer.minRotation, this.config.layer.maxRotation, 0, (value) => {
                this.updateActiveLayerTransform('rotation', value * Math.PI / 180);
                return Math.round(value) + '°';
            });
            
            this._setupLayerSlider('layer-scale-slider', this.config.layer.minScale, this.config.layer.maxScale, 1.0, (value) => {
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
            
            console.log('🎛️ Layer transform panel configured');
        }

        _setupLayerSlider(sliderId, min, max, initial, callback) {
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
        }
        
        // 【改修】AnimationSystem統合版：レイヤー変形更新
        updateActiveLayerTransform(property, value) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer?.layerData) return;
            
            const layerId = activeLayer.layerData.id;
            
            // 変形データを取得または初期化
            if (!this.layerTransforms.has(layerId)) {
                this.layerTransforms.set(layerId, {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                });
            }
            
            const transform = this.layerTransforms.get(layerId);
            
            // 【統一】座標系API使用
            const centerX = this.config.canvas.width / 2;
            const centerY = this.config.canvas.height / 2;
            
            // 変形値更新
            switch(property) {
                case 'x':
                    transform.x = value;
                    break;
                case 'y':
                    transform.y = value;
                    break;
                case 'rotation':
                    transform.rotation = value;
                    break;
                case 'scale':
                    const hFlipped = transform.scaleX < 0;
                    const vFlipped = transform.scaleY < 0;
                    transform.scaleX = hFlipped ? -value : value;
                    transform.scaleY = vFlipped ? -value : value;
                    break;
            }
            
            // 【統一】座標変換API適用
            if (this.coordAPI?.applyLayerTransform) {
                this.coordAPI.applyLayerTransform(activeLayer, transform, centerX, centerY);
            } else {
                // フォールバック：直接適用
                this._applyTransformDirect(activeLayer, transform, centerX, centerY);
            }
            
            // サムネイル更新をリクエスト
            this.requestThumbnailUpdate(this.activeLayerIndex);
            
            // 【重要】AnimationSystemにCUT内レイヤー更新を通知
            if (this.animationSystem?.updateCurrentCutLayer) {
                this.animationSystem.updateCurrentCutLayer(this.activeLayerIndex, {
                    transform: { ...transform }
                });
            }
            
            // EventBus通知
            if (this.eventBus) {
                this.eventBus.emit('layer:updated', { layerId, transform });
            }
        }
        
        // 座標変換API フォールバック
        _applyTransformDirect(layer, transform, centerX, centerY) {
            if (transform.rotation !== 0 || Math.abs(transform.scaleX) !== 1 || 
                Math.abs(transform.scaleY) !== 1) {
                layer.pivot.set(centerX, centerY);
                layer.position.set(centerX + transform.x, centerY + transform.y);
                layer.rotation = transform.rotation;
                layer.scale.set(transform.scaleX, transform.scaleY);
            } else if (transform.x !== 0 || transform.y !== 0) {
                layer.pivot.set(0, 0);
                layer.position.set(transform.x, transform.y);
                layer.rotation = 0;
                layer.scale.set(1, 1);
            } else {
                layer.pivot.set(0, 0);
                layer.position.set(0, 0);
                layer.rotation = 0;
                layer.scale.set(1, 1);
            }
        }

        flipActiveLayer(direction) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer?.layerData) return;
            
            const layerId = activeLayer.layerData.id;
            
            if (!this.layerTransforms.has(layerId)) {
                this.layerTransforms.set(layerId, {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                });
            }
            
            const transform = this.layerTransforms.get(layerId);
            
            const centerX = this.config.canvas.width / 2;
            const centerY = this.config.canvas.height / 2;
            
            if (direction === 'horizontal') {
                transform.scaleX *= -1;
            } else if (direction === 'vertical') {
                transform.scaleY *= -1;
            }
            
            // 【統一】座標変換API適用
            if (this.coordAPI?.applyLayerTransform) {
                this.coordAPI.applyLayerTransform(activeLayer, transform, centerX, centerY);
            } else {
                this._applyTransformDirect(activeLayer, transform, centerX, centerY);
            }
            
            this.updateFlipButtons();
            this.requestThumbnailUpdate(this.activeLayerIndex);
            
            // 【重要】AnimationSystemにCUT内レイヤー更新を通知
            if (this.animationSystem?.updateCurrentCutLayer) {
                this.animationSystem.updateCurrentCutLayer(this.activeLayerIndex, {
                    transform: { ...transform }
                });
            }
            
            if (this.eventBus) {
                this.eventBus.emit('layer:updated', { layerId, transform });
            }
        }

        updateFlipButtons() {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;
            
            const flipHorizontalBtn = document.getElementById('flip-horizontal-btn');
            const flipVerticalBtn = document.getElementById('flip-vertical-btn');
            
            if (flipHorizontalBtn) {
                flipHorizontalBtn.classList.toggle('active', activeLayer.scale.x < 0);
            }
            
            if (flipVerticalBtn) {
                flipVerticalBtn.classList.toggle('active', activeLayer.scale.y < 0);
            }
        }

        updateLayerTransformPanelValues() {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer?.layerData) return;
            
            const layerId = activeLayer.layerData.id;
            const transform = this.layerTransforms.get(layerId) || {
                x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
            };
            
            // スライダー値更新
            ['x', 'y', 'rotation', 'scale'].forEach(prop => {
                const slider = document.getElementById(`layer-${prop}-slider`);
                if (slider?.updateValue) {
                    let value = transform[prop];
                    if (prop === 'rotation') value = value * 180 / Math.PI;
                    if (prop === 'scale') value = Math.abs(transform.scaleX);
                    slider.updateValue(value);
                }
            });
            
            this.updateFlipButtons();
        }

        // キ