// Tegaki Tool - Resize Slider Module (History対応・入力改善版)
// DO NOT use ESM, only global namespace

window.ResizeSlider = (function() {
    'use strict';

    const MIN_SIZE = 100;
    const MAX_SIZE = 2000;
    
    let currentWidth = 0;
    let currentHeight = 0;
    let isDraggingWidth = false;
    let isDraggingHeight = false;
    let horizontalAlign = 'center';
    let verticalAlign = 'center';

    function getElements() {
        return {
            widthSlider: document.getElementById('canvas-width-slider'),
            widthTrack: document.getElementById('canvas-width-track'),
            widthHandle: document.getElementById('canvas-width-handle'),
            widthDisplay: document.getElementById('canvas-width-display'),
            widthDecrease: document.getElementById('width-decrease'),
            widthIncrease: document.getElementById('width-increase'),
            widthInput: document.getElementById('canvas-width-input'),
            horizontalAlignLeft: document.getElementById('horizontal-align-left'),
            horizontalAlignCenter: document.getElementById('horizontal-align-center'),
            horizontalAlignRight: document.getElementById('horizontal-align-right'),
            
            heightSlider: document.getElementById('canvas-height-slider'),
            heightTrack: document.getElementById('canvas-height-track'),
            heightHandle: document.getElementById('canvas-height-handle'),
            heightDisplay: document.getElementById('canvas-height-display'),
            heightDecrease: document.getElementById('height-decrease'),
            heightIncrease: document.getElementById('height-increase'),
            heightInput: document.getElementById('canvas-height-input'),
            verticalAlignTop: document.getElementById('vertical-align-top'),
            verticalAlignCenter: document.getElementById('vertical-align-center'),
            verticalAlignBottom: document.getElementById('vertical-align-bottom'),
            
            applyBtn: document.getElementById('apply-resize')
        };
    }

    function updateWidthSlider(value, elements) {
        currentWidth = Math.max(MIN_SIZE, Math.min(MAX_SIZE, value));
        const percent = ((currentWidth - MIN_SIZE) / (MAX_SIZE - MIN_SIZE)) * 100;
        elements.widthTrack.style.width = percent + '%';
        elements.widthHandle.style.left = percent + '%';
        elements.widthDisplay.textContent = currentWidth + 'px';
        if (elements.widthInput) {
            elements.widthInput.value = currentWidth;
        }
    }

    function updateHeightSlider(value, elements) {
        currentHeight = Math.max(MIN_SIZE, Math.min(MAX_SIZE, value));
        const percent = ((currentHeight - MIN_SIZE) / (MAX_SIZE - MIN_SIZE)) * 100;
        elements.heightTrack.style.width = percent + '%';
        elements.heightHandle.style.left = percent + '%';
        elements.heightDisplay.textContent = currentHeight + 'px';
        if (elements.heightInput) {
            elements.heightInput.value = currentHeight;
        }
    }

    function updateAlignmentButtons(elements) {
        [elements.horizontalAlignLeft, elements.horizontalAlignCenter, elements.horizontalAlignRight].forEach(btn => {
            if (btn) btn.classList.remove('active');
        });
        if (horizontalAlign === 'left' && elements.horizontalAlignLeft) {
            elements.horizontalAlignLeft.classList.add('active');
        } else if (horizontalAlign === 'center' && elements.horizontalAlignCenter) {
            elements.horizontalAlignCenter.classList.add('active');
        } else if (horizontalAlign === 'right' && elements.horizontalAlignRight) {
            elements.horizontalAlignRight.classList.add('active');
        }

        [elements.verticalAlignTop, elements.verticalAlignCenter, elements.verticalAlignBottom].forEach(btn => {
            if (btn) btn.classList.remove('active');
        });
        if (verticalAlign === 'top' && elements.verticalAlignTop) {
            elements.verticalAlignTop.classList.add('active');
        } else if (verticalAlign === 'center' && elements.verticalAlignCenter) {
            elements.verticalAlignCenter.classList.add('active');
        } else if (verticalAlign === 'bottom' && elements.verticalAlignBottom) {
            elements.verticalAlignBottom.classList.add('active');
        }
    }

    function setupDragHandlers(elements) {
        const handleMouseMove = (e) => {
            if (isDraggingWidth) {
                const rect = elements.widthSlider.getBoundingClientRect();
                const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                const value = MIN_SIZE + ((MAX_SIZE - MIN_SIZE) * percent / 100);
                updateWidthSlider(Math.round(value), elements);
            }
            if (isDraggingHeight) {
                const rect = elements.heightSlider.getBoundingClientRect();
                const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                const value = MIN_SIZE + ((MAX_SIZE - MIN_SIZE) * percent / 100);
                updateHeightSlider(Math.round(value), elements);
            }
        };
        
        const handleMouseUp = () => {
            isDraggingWidth = false;
            isDraggingHeight = false;
        };
        
        elements.widthHandle.addEventListener('mousedown', (e) => {
            isDraggingWidth = true;
            e.preventDefault();
        });
        
        elements.heightHandle.addEventListener('mousedown', (e) => {
            isDraggingHeight = true;
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }

    function setupClickHandlers(elements) {
        elements.widthSlider.addEventListener('click', (e) => {
            if (e.target === elements.widthHandle) return;
            const rect = elements.widthSlider.getBoundingClientRect();
            const percent = ((e.clientX - rect.left) / rect.width) * 100;
            const value = MIN_SIZE + ((MAX_SIZE - MIN_SIZE) * percent / 100);
            updateWidthSlider(Math.round(value), elements);
        });
        
        elements.heightSlider.addEventListener('click', (e) => {
            if (e.target === elements.heightHandle) return;
            const rect = elements.heightSlider.getBoundingClientRect();
            const percent = ((e.clientX - rect.left) / rect.width) * 100;
            const value = MIN_SIZE + ((MAX_SIZE - MIN_SIZE) * percent / 100);
            updateHeightSlider(Math.round(value), elements);
        });
    }

    function setupStepButtons(elements) {
        elements.widthDecrease.addEventListener('click', () => {
            updateWidthSlider(currentWidth - 1, elements);
        });
        
        elements.widthIncrease.addEventListener('click', () => {
            updateWidthSlider(currentWidth + 1, elements);
        });
        
        elements.heightDecrease.addEventListener('click', () => {
            updateHeightSlider(currentHeight - 1, elements);
        });
        
        elements.heightIncrease.addEventListener('click', () => {
            updateHeightSlider(currentHeight + 1, elements);
        });
    }

    function setupInputHandlers(elements) {
        if (elements.widthInput) {
            // フォーカス時：全選択して入力しやすく
            elements.widthInput.addEventListener('focus', (e) => {
                e.target.select();
                e.target.style.borderColor = 'var(--futaba-maroon)';
            });
            
            // 入力中：リアルタイムでスライダー更新（範囲内のみ）
            elements.widthInput.addEventListener('input', (e) => {
                const value = parseInt(e.target.value, 10);
                
                // 範囲外の視覚フィードバック
                if (isNaN(value) || value < MIN_SIZE || value > MAX_SIZE) {
                    e.target.style.borderColor = '#d32f2f';
                    e.target.style.color = '#d32f2f';
                } else {
                    e.target.style.borderColor = 'var(--futaba-maroon)';
                    e.target.style.color = 'var(--futaba-maroon)';
                    updateWidthSlider(value, elements);
                }
            });
            
            // Enter確定
            elements.widthInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.target.blur();
                }
            });
            
            // 確定時：範囲補正して反映
            elements.widthInput.addEventListener('blur', (e) => {
                let value = parseInt(e.target.value, 10);
                
                if (isNaN(value)) {
                    value = currentWidth;
                } else if (value < MIN_SIZE) {
                    value = MIN_SIZE;
                } else if (value > MAX_SIZE) {
                    value = MAX_SIZE;
                }
                
                updateWidthSlider(value, elements);
                e.target.style.borderColor = '';
                e.target.style.color = '';
            });
        }

        if (elements.heightInput) {
            elements.heightInput.addEventListener('focus', (e) => {
                e.target.select();
                e.target.style.borderColor = 'var(--futaba-maroon)';
            });
            
            elements.heightInput.addEventListener('input', (e) => {
                const value = parseInt(e.target.value, 10);
                
                if (isNaN(value) || value < MIN_SIZE || value > MAX_SIZE) {
                    e.target.style.borderColor = '#d32f2f';
                    e.target.style.color = '#d32f2f';
                } else {
                    e.target.style.borderColor = 'var(--futaba-maroon)';
                    e.target.style.color = 'var(--futaba-maroon)';
                    updateHeightSlider(value, elements);
                }
            });
            
            elements.heightInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.target.blur();
                }
            });
            
            elements.heightInput.addEventListener('blur', (e) => {
                let value = parseInt(e.target.value, 10);
                
                if (isNaN(value)) {
                    value = currentHeight;
                } else if (value < MIN_SIZE) {
                    value = MIN_SIZE;
                } else if (value > MAX_SIZE) {
                    value = MAX_SIZE;
                }
                
                updateHeightSlider(value, elements);
                e.target.style.borderColor = '';
                e.target.style.color = '';
            });
        }
    }

    function setupAlignmentButtons(elements) {
        if (elements.horizontalAlignLeft) {
            elements.horizontalAlignLeft.addEventListener('click', () => {
                horizontalAlign = 'left';
                updateAlignmentButtons(elements);
            });
        }
        if (elements.horizontalAlignCenter) {
            elements.horizontalAlignCenter.addEventListener('click', () => {
                horizontalAlign = 'center';
                updateAlignmentButtons(elements);
            });
        }
        if (elements.horizontalAlignRight) {
            elements.horizontalAlignRight.addEventListener('click', () => {
                horizontalAlign = 'right';
                updateAlignmentButtons(elements);
            });
        }

        if (elements.verticalAlignTop) {
            elements.verticalAlignTop.addEventListener('click', () => {
                verticalAlign = 'top';
                updateAlignmentButtons(elements);
            });
        }
        if (elements.verticalAlignCenter) {
            elements.verticalAlignCenter.addEventListener('click', () => {
                verticalAlign = 'center';
                updateAlignmentButtons(elements);
            });
        }
        if (elements.verticalAlignBottom) {
            elements.verticalAlignBottom.addEventListener('click', () => {
                verticalAlign = 'bottom';
                updateAlignmentButtons(elements);
            });
        }
    }

    function serializePathForSnapshot(path) {
        return {
            id: path.id,
            points: path.points ? path.points.map(p => ({ x: p.x, y: p.y, pressure: p.pressure })) : [],
            color: path.color,
            size: path.size,
            opacity: path.opacity,
            tool: path.tool,
            isComplete: path.isComplete
        };
    }

    function setupApplyButton(elements) {
        elements.applyBtn.addEventListener('click', () => {
            if (!window.coreEngine || !window.History) return;
            if (currentWidth <= 0 || currentHeight <= 0) return;
            
            const newWidth = currentWidth;
            const newHeight = currentHeight;
            
            const alignOptions = {
                horizontalAlign: horizontalAlign === 'left' ? 'right' : 
                                 horizontalAlign === 'right' ? 'left' : 'center',
                verticalAlign: verticalAlign === 'top' ? 'bottom' : 
                               verticalAlign === 'bottom' ? 'top' : 'center'
            };
            
            const oldWidth = window.TEGAKI_CONFIG.canvas.width;
            const oldHeight = window.TEGAKI_CONFIG.canvas.height;
            const layerManager = window.coreEngine.getLayerManager();
            const layers = layerManager.getLayers();
            
            const layerSnapshots = layers.map(layer => ({
                id: layer.layerData.id,
                paths: layer.layerData.paths.map(serializePathForSnapshot),
                isBackground: layer.layerData.isBackground
            }));
            
            const command = {
                name: 'resize-canvas',
                do: () => {
                    window.coreEngine.resizeCanvas(newWidth, newHeight, alignOptions);
                },
                undo: () => {
                    window.TEGAKI_CONFIG.canvas.width = oldWidth;
                    window.TEGAKI_CONFIG.canvas.height = oldHeight;
                    window.coreEngine.getCameraSystem().resizeCanvas(oldWidth, oldHeight);
                    
                    const currentLayers = layerManager.getLayers();
                    
                    layerSnapshots.forEach(snapshot => {
                        const layer = currentLayers.find(l => l.layerData.id === snapshot.id);
                        if (!layer) return;
                        
                        layer.layerData.paths.forEach(path => {
                            if (path.graphics) {
                                layer.removeChild(path.graphics);
                                path.graphics.destroy();
                            }
                        });
                        
                        if (snapshot.isBackground && layer.layerData.backgroundGraphics) {
                            layer.layerData.backgroundGraphics.clear();
                            layer.layerData.backgroundGraphics.rect(0, 0, oldWidth, oldHeight);
                            layer.layerData.backgroundGraphics.fill(window.TEGAKI_CONFIG.background.color);
                        }
                        
                        layer.layerData.paths = snapshot.paths.map(pathData => {
                            const restoredPath = {
                                id: pathData.id,
                                points: pathData.points.map(p => ({ x: p.x, y: p.y, pressure: p.pressure })),
                                color: pathData.color,
                                size: pathData.size,
                                opacity: pathData.opacity,
                                tool: pathData.tool,
                                isComplete: pathData.isComplete,
                                graphics: null
                            };
                            
                            if (layerManager.rebuildPathGraphics) {
                                layerManager.rebuildPathGraphics(restoredPath);
                                if (restoredPath.graphics) {
                                    layer.addChild(restoredPath.graphics);
                                }
                            }
                            
                            return restoredPath;
                        });
                    });
                    
                    for (let i = 0; i < currentLayers.length; i++) {
                        layerManager.requestThumbnailUpdate(i);
                    }
                    
                    const animSys = window.coreEngine.getAnimationSystem();
                    if (animSys) {
                        setTimeout(() => {
                            const animData = animSys.getAnimationData();
                            if (animData && animData.cuts) {
                                for (let i = 0; i < animData.cuts.length; i++) {
                                    if (animSys.generateCutThumbnailOptimized) {
                                        animSys.generateCutThumbnailOptimized(i);
                                    }
                                }
                            }
                        }, 500);
                    }
                    
                    const canvasInfoElement = document.getElementById('canvas-info');
                    if (canvasInfoElement) {
                        canvasInfoElement.textContent = `${oldWidth}×${oldHeight}px`;
                    }
                },
                meta: { 
                    type: 'resize-canvas', 
                    from: { width: oldWidth, height: oldHeight },
                    to: { width: newWidth, height: newHeight },
                    align: alignOptions
                }
            };
            
            window.History.push(command);
            
            const resizeSettings = document.getElementById('resize-settings');
            if (resizeSettings) {
                resizeSettings.classList.remove('show');
            }
        });
    }

    function init() {
        const elements = getElements();
        
        if (!elements.widthSlider || !elements.heightSlider) {
            return false;
        }
        
        currentWidth = window.TEGAKI_CONFIG?.canvas?.width || 344;
        currentHeight = window.TEGAKI_CONFIG?.canvas?.height || 135;
        
        updateWidthSlider(currentWidth, elements);
        updateHeightSlider(currentHeight, elements);
        updateAlignmentButtons(elements);
        
        setupDragHandlers(elements);
        setupClickHandlers(elements);
        setupStepButtons(elements);
        setupInputHandlers(elements);
        setupAlignmentButtons(elements);
        setupApplyButton(elements);
        
        return true;
    }

    return {
        init,
        getAlignment: () => ({ horizontalAlign, verticalAlign })
    };
})();

console.log('✅ resize-slider.js (History対応・入力改善版) loaded');