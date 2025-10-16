// Tegaki Tool - Resize Slider Module
// DO NOT use ESM, only global namespace

window.ResizeSlider = (function() {
    'use strict';

    const MIN_SIZE = 100;
    const MAX_SIZE = 2000;
    
    let currentWidth = 0;
    let currentHeight = 0;
    let isDraggingWidth = false;
    let isDraggingHeight = false;

    // スライダー要素の取得
    function getElements() {
        return {
            widthSlider: document.getElementById('canvas-width-slider'),
            widthTrack: document.getElementById('canvas-width-track'),
            widthHandle: document.getElementById('canvas-width-handle'),
            widthDisplay: document.getElementById('canvas-width-display'),
            widthDecrease: document.getElementById('width-decrease'),
            widthIncrease: document.getElementById('width-increase'),
            
            heightSlider: document.getElementById('canvas-height-slider'),
            heightTrack: document.getElementById('canvas-height-track'),
            heightHandle: document.getElementById('canvas-height-handle'),
            heightDisplay: document.getElementById('canvas-height-display'),
            heightDecrease: document.getElementById('height-decrease'),
            heightIncrease: document.getElementById('height-increase'),
            
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
    }

    // 高さスライダー更新
    function updateHeightSlider(value, elements) {
        currentHeight = Math.max(MIN_SIZE, Math.min(MAX_SIZE, value));
        const percent = ((currentHeight - MIN_SIZE) / (MAX_SIZE - MIN_SIZE)) * 100;
        elements.heightTrack.style.width = percent + '%';
        elements.heightHandle.style.left = percent + '%';
        elements.heightDisplay.textContent = currentHeight + 'px';
    }

    // ドラッグハンドラー
    function setupDragHandlers(elements) {
        elements.widthHandle.addEventListener('mousedown', (e) => {
            isDraggingWidth = true;
            e.preventDefault();
        });
        
        elements.heightHandle.addEventListener('mousedown', (e) => {
            isDraggingHeight = true;
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
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
        });
        
        document.addEventListener('mouseup', () => {
            isDraggingWidth = false;
            isDraggingHeight = false;
        });
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

    // リサイズ実行ハンドラー
    function setupApplyButton(elements) {
        elements.applyBtn.addEventListener('click', () => {
            if (window.coreEngine && currentWidth > 0 && currentHeight > 0) {
                window.coreEngine.resizeCanvas(currentWidth, currentHeight);
            } else if (window.drawingAppResizeCanvas) {
                window.drawingAppResizeCanvas(currentWidth, currentHeight);
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
        
        setupDragHandlers(elements);
        setupClickHandlers(elements);
        setupStepButtons(elements);
        setupApplyButton(elements);
        
        return true;
    }

    // 公開API
    return {
        init
    };
})();