// Tegaki Tool - Resize Slider Module (Direction Control Enhanced)
// DO NOT use ESM, only global namespace

window.ResizeSlider = (function() {
    'use strict';

    const MIN_SIZE = 100;
    const MAX_SIZE = 2000;
    
    let currentWidth = 0;
    let currentHeight = 0;
    let isDraggingWidth = false;
    let isDraggingHeight = false;
    let horizontalAlign = 'center'; // left, center, right
    let verticalAlign = 'center';   // top, center, bottom

    // スライダー要素の取得
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

    // 幅スライダー更新
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

    // 高さスライダー更新
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

    // アライメントボタンの選択状態更新
    function updateAlignmentButtons(elements) {
        // 水平方向
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

        // 垂直方向
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

    // ドラッグハンドラー
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

    // クリックハンドラー
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

    // ステップボタンハンドラー
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

    // 数値入力ハンドラー
    function setupInputHandlers(elements) {
        if (elements.widthInput) {
            elements.widthInput.addEventListener('input', (e) => {
                const value = parseInt(e.target.value, 10);
                if (!isNaN(value)) {
                    updateWidthSlider(value, elements);
                }
            });
            
            elements.widthInput.addEventListener('blur', (e) => {
                if (e.target.value === '' || isNaN(parseInt(e.target.value, 10))) {
                    elements.widthInput.value = currentWidth;
                }
            });
        }

        if (elements.heightInput) {
            elements.heightInput.addEventListener('input', (e) => {
                const value = parseInt(e.target.value, 10);
                if (!isNaN(value)) {
                    updateHeightSlider(value, elements);
                }
            });
            
            elements.heightInput.addEventListener('blur', (e) => {
                if (e.target.value === '' || isNaN(parseInt(e.target.value, 10))) {
                    elements.heightInput.value = currentHeight;
                }
            });
        }
    }

    // アライメントボタンハンドラー
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

    // リサイズ実行ハンドラー
    function setupApplyButton(elements) {
        elements.applyBtn.addEventListener('click', () => {
            if (window.coreEngine && currentWidth > 0 && currentHeight > 0) {
                window.coreEngine.resizeCanvas(currentWidth, currentHeight, {
                    horizontalAlign,
                    verticalAlign
                });
            }
        });
    }

    // 初期化
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

    // 公開API
    return {
        init,
        getAlignment: () => ({ horizontalAlign, verticalAlign })
    };
})();