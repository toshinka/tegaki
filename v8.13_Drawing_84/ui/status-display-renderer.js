// ===== resizeCanvas() 改善版 - core-engine.js 内の該当メソッドを置換 =====
// Phase 2改善: チェッカーパターンと背景のリサイズ対応強化

resizeCanvas(newWidth, newHeight, options = {}) {
    const oldWidth = CONFIG.canvas.width;
    const oldHeight = CONFIG.canvas.height;
    
    const horizontalAlign = options.horizontalAlign || 'center';
    const verticalAlign = options.verticalAlign || 'center';
    
    let offsetX = 0;
    let offsetY = 0;
    
    const widthDiff = newWidth - oldWidth;
    const heightDiff = newHeight - oldHeight;
    
    if (horizontalAlign === 'left') {
        offsetX = 0;
    } else if (horizontalAlign === 'center') {
        offsetX = widthDiff / 2;
    } else if (horizontalAlign === 'right') {
        offsetX = widthDiff;
    }
    
    if (verticalAlign === 'top') {
        offsetY = 0;
    } else if (verticalAlign === 'center') {
        offsetY = heightDiff / 2;
    } else if (verticalAlign === 'bottom') {
        offsetY = heightDiff;
    }
    
    CONFIG.canvas.width = newWidth;
    CONFIG.canvas.height = newHeight;
    
    this.cameraSystem.resizeCanvas(newWidth, newHeight);
    
    // Phase 2改善: チェッカーパターンも再生成してリサイズ対応
    if (this.layerSystem.checkerPattern) {
        const oldChecker = this.layerSystem.checkerPattern;
        const wasVisible = oldChecker.visible;
        const parentContainer = oldChecker.parent;
        
        if (parentContainer) {
            parentContainer.removeChild(oldChecker);
        }
        oldChecker.destroy();
        
        // window.checkerUtils または layer-system の生成メソッドを使用
        if (window.checkerUtils) {
            this.layerSystem.checkerPattern = window.checkerUtils.createCheckerPattern(newWidth, newHeight);
        } else {
            this.layerSystem.checkerPattern = this.layerSystem._createCheckerPatternBackground(newWidth, newHeight);
        }
        
        this.layerSystem.checkerPattern.visible = wasVisible;
        
        // 再配置
        if (parentContainer) {
            parentContainer.addChildAt(this.layerSystem.checkerPattern, 0);
        } else if (this.cameraSystem.canvasContainer) {
            this.cameraSystem.canvasContainer.addChildAt(this.layerSystem.checkerPattern, 0);
        }
    }
    
    // 既存のパス座標をオフセット
    const frames = this.animationSystem?.animationData?.frames || [];
    frames.forEach(frame => {
        const layers = frame.getLayers();
        layers.forEach(layer => {
            if (layer.layerData?.isBackground) return;
            
            if (layer.layerData?.paths) {
                layer.layerData.paths.forEach(path => {
                    if (path.points) {
                        path.points.forEach(point => {
                            point.x += offsetX;
                            point.y += offsetY;
                        });
                    }
                    
                    if (path.graphics) {
                        path.graphics.clear();
                        path.points.forEach(p => {
                            path.graphics.circle(p.x, p.y, path.size / 2);
                            path.graphics.fill({
                                color: path.color,
                                alpha: path.opacity
                            });
                        });
                    }
                });
            }
        });
    });
    
    // Phase 2改善: 背景レイヤーの背景グラフィックスを新サイズで再生成
    const layers = this.layerSystem.getLayers();
    layers.forEach(layer => {
        if (layer.layerData.isBackground && layer.layerData.backgroundGraphics) {
            const bg = layer.layerData.backgroundGraphics;
            
            // 現在の色を保持
            let currentColor = CONFIG.background.color;
            
            // 既存の色を抽出（可能な場合）
            if (bg.geometry && bg.geometry.graphicsData && bg.geometry.graphicsData.length > 0) {
                const fillData = bg.geometry.graphicsData[0];
                if (fillData && fillData.fillStyle && fillData.fillStyle.color !== undefined) {
                    currentColor = fillData.fillStyle.color;
                }
            }
            
            // 再生成
            bg.clear();
            bg.rect(0, 0, newWidth, newHeight);
            bg.fill({ color: currentColor });
        }
    });
    
    // サムネイル更新
    for (let i = 0; i < layers.length; i++) {
        this.layerSystem.requestThumbnailUpdate(i);
    }
    
    // アニメーションフレームサムネイル更新
    if (this.animationSystem) {
        setTimeout(() => {
            const animData = this.animationSystem.getAnimationData();
            if (animData && animData.cuts) {
                for (let i = 0; i < animData.cuts.length; i++) {
                    if (this.animationSystem.generateCutThumbnail) {
                        this.animationSystem.generateCutThumbnail(i);
                    } else if (this.animationSystem.generateCutThumbnailOptimized) {
                        this.animationSystem.generateCutThumbnailOptimized(i);
                    }
                }
            }
        }, 500);
    }
    
    // UI更新
    const canvasInfoElement = document.getElementById('canvas-info');
    if (canvasInfoElement) {
        canvasInfoElement.textContent = `${newWidth}×${newHeight}px`;
    }
    
    const resizeSettings = document.getElementById('resize-settings');
    if (resizeSettings) resizeSettings.classList.remove('show');
    
    // イベント発火
    this.eventBus.emit('canvas:resized', { 
        width: newWidth, 
        height: newHeight,
        oldWidth,
        oldHeight,
        offsetX,
        offsetY,
        horizontalAlign,
        verticalAlign
    });
}

// 使用方法:
// core-engine.js の CoreEngine クラス内の resizeCanvas() メソッドを
// 上記のコードで置換してください。