/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v0.7
 * UI管理システム - ui-system.js
 */

class UIController {
    constructor(toolSystem) {
        this.toolSystem = toolSystem;
        this.activePopup = null;
        this.sliders = new Map();
    }
    
    init() {
        console.log('🎯 UIController初期化開始...');
        this.setupToolButtons();
        this.setupPopups();
        this.setupSliders();
        this.setupPresets();
        this.setupResize();
        this.setupCheckboxes();
        this.updateSizePresets();
        console.log('✅ UIController初期化完了');
    }
    
    setupToolButtons() {
        document.querySelectorAll('.tool-button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (btn.classList.contains('disabled')) return;
                this.handleToolClick(e.currentTarget);
            });
        });
    }
    
    handleToolClick(button) {
        const toolId = button.id;
        const popupId = button.getAttribute('data-popup');
        
        if (toolId === 'pen-tool') {
            this.setTool('pen');
        } else if (toolId === 'eraser-tool') {
            this.setTool('eraser');
        }
        
        if (popupId) {
            this.togglePopup(popupId);
        }
    }
    
    setTool(tool) {
        this.toolSystem.setTool(tool);
        
        document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
        const toolButton = document.getElementById(tool + '-tool');
        if (toolButton) {
            toolButton.classList.add('active');
        }
        
        const toolNames = { pen: 'ベクターペン', eraser: '消しゴム' };
        const toolDisplay = document.getElementById('current-tool');
        if (toolDisplay) {
            toolDisplay.textContent = toolNames[tool] || tool;
        }
    }
    
    togglePopup(popupId) {
        const popup = document.getElementById(popupId);
        if (!popup) return;
        
        if (this.activePopup && this.activePopup !== popup) {
            this.activePopup.classList.remove('show');
        }
        
        const isVisible = popup.classList.contains('show');
        popup.classList.toggle('show', !isVisible);
        this.activePopup = isVisible ? null : popup;
    }
    
    setupSliders() {
        this.createSlider('pen-size-slider', 0.1, 100, 16.0, (value) => {
            this.toolSystem.setBrushSize(value);
            this.updateSizePresets();
            return value.toFixed(1) + 'px';
        });
        
        this.createSlider('pen-opacity-slider', 0, 100, 85.0, (value) => {
            this.toolSystem.setOpacity(value / 100);
            this.updateSizePresets(); // 不透明度変更時も更新
            return value.toFixed(1) + '%';
        });
        
        this.createSlider('pen-pressure-slider', 0, 100, 50.0, (value) => {
            this.toolSystem.setPressure(value / 100);
            return value.toFixed(1) + '%';
        });
        
        this.createSlider('pen-smoothing-slider', 0, 100, 30.0, (value) => {
            this.toolSystem.setSmoothing(value / 100);
            return value.toFixed(1) + '%';
        });
        
        this.setupSliderButtons();
    }
    
    createSlider(sliderId, min, max, initial, callback) {
        const container = document.getElementById(sliderId);
        if (!container) {
            console.warn(`スライダー ${sliderId} が見つかりません`);
            return;
        }
        
        const track = container.querySelector('.slider-track');
        const handle = container.querySelector('.slider-handle');
        const valueDisplay = container.parentNode.querySelector('.slider-value');
        
        if (!track || !handle || !valueDisplay) {
            console.warn(`スライダー ${sliderId} の要素が不完全です`);
            return;
        }
        
        const sliderData = {
            value: initial,
            min, max, callback,
            track, handle, valueDisplay,
            isDragging: false
        };
        
        this.sliders.set(sliderId, sliderData);
        
        const updateSlider = (value) => {
            sliderData.value = Math.max(min, Math.min(max, value));
            const percentage = ((sliderData.value - min) / (max - min)) * 100;
            
            track.style.width = percentage + '%';
            handle.style.left = percentage + '%';
            valueDisplay.textContent = callback(sliderData.value);
        };
        
        const getValueFromPosition = (clientX) => {
            const rect = container.getBoundingClientRect();
            const percentage = (clientX - rect.left) / rect.width;
            return min + (percentage * (max - min));
        };
        
        container.addEventListener('mousedown', (e) => {
            sliderData.isDragging = true;
            updateSlider(getValueFromPosition(e.clientX));
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (sliderData.isDragging) updateSlider(getValueFromPosition(e.clientX));
        });
        
        document.addEventListener('mouseup', () => {
            sliderData.isDragging = false;
        });
        
        updateSlider(initial);
    }
    
    setupSliderButtons() {
        const adjustValue = (sliderId, delta) => {
            const slider = this.sliders.get(sliderId);
            if (slider) {
                const newValue = slider.value + delta;
                const clampedValue = Math.max(slider.min, Math.min(slider.max, newValue));
                slider.value = clampedValue;
                
                const percentage = ((clampedValue - slider.min) / (slider.max - slider.min)) * 100;
                slider.track.style.width = percentage + '%';
                slider.handle.style.left = percentage + '%';
                slider.valueDisplay.textContent = slider.callback(clampedValue);
            }
        };
        
        // ペンサイズ調整ボタン
        const sizeButtons = [
            ['pen-size-decrease-small', -0.1],
            ['pen-size-decrease', -1],
            ['pen-size-decrease-large', -10],
            ['pen-size-increase-small', 0.1],
            ['pen-size-increase', 1],
            ['pen-size-increase-large', 10]
        ];
        
        sizeButtons.forEach(([id, delta]) => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.addEventListener('click', () => {
                    adjustValue('pen-size-slider', delta);
                    this.updateSizePresets();
                });
            }
        });
        
        // 不透明度調整ボタン
        const opacityButtons = [
            ['pen-opacity-decrease-small', -0.1],
            ['pen-opacity-decrease', -1],
            ['pen-opacity-decrease-large', -10],
            ['pen-opacity-increase-small', 0.1],
            ['pen-opacity-increase', 1],
            ['pen-opacity-increase-large', 10]
        ];
        
        opacityButtons.forEach(([id, delta]) => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.addEventListener('click', () => {
                    adjustValue('pen-opacity-slider', delta);
                    this.updateSizePresets();
                });
            }
        });
        
        // 筆圧調整ボタン
        const pressureButtons = [
            ['pen-pressure-decrease-small', -0.1],
            ['pen-pressure-decrease', -1],
            ['pen-pressure-decrease-large', -10],
            ['pen-pressure-increase-small', 0.1],
            ['pen-pressure-increase', 1],
            ['pen-pressure-increase-large', 10]
        ];
        
        pressureButtons.forEach(([id, delta]) => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.addEventListener('click', () => {
                    adjustValue('pen-pressure-slider', delta);
                });
            }
        });
        
        // 線補正調整ボタン
        const smoothingButtons = [
            ['pen-smoothing-decrease-small', -0.1],
            ['pen-smoothing-decrease', -1],
            ['pen-smoothing-decrease-large', -10],
            ['pen-smoothing-increase-small', 0.1],
            ['pen-smoothing-increase', 1],
            ['pen-smoothing-increase-large', 10]
        ];
        
        smoothingButtons.forEach(([id, delta]) => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.addEventListener('click', () => {
                    adjustValue('pen-smoothing-slider', delta);
                });
            }
        });
    }
    
    setupPresets() {
        document.querySelectorAll('.size-preset-item').forEach(preset => {
            preset.addEventListener('click', () => {
                const size = parseFloat(preset.getAttribute('data-size'));
                this.toolSystem.setBrushSize(size);
                this.updateSliderValue('pen-size-slider', size);
                this.updateSizePresets();
            });
        });
    }
    
    setupResize() {
        document.querySelectorAll('.resize-button[data-size]').forEach(btn => {
            btn.addEventListener('click', () => {
                const [width, height] = btn.getAttribute('data-size').split(',').map(Number);
                const widthInput = document.getElementById('canvas-width');
                const heightInput = document.getElementById('canvas-height');
                if (widthInput) widthInput.value = width;
                if (heightInput) heightInput.value = height;
            });
        });
    }
    
    setupCheckboxes() {
        document.querySelectorAll('.checkbox').forEach(checkbox => {
            checkbox.addEventListener('click', () => {
                checkbox.classList.toggle('checked');
            });
        });
    }
    
    setupPopups() {
        document.querySelectorAll('.popup-panel.draggable').forEach(popup => {
            this.makeDraggable(popup);
        });
        
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.popup-panel') && !e.target.closest('.tool-button')) {
                this.closeAllPopups();
            }
        });
    }
    
    makeDraggable(popup) {
        let isDragging = false;
        let dragOffset = { x: 0, y: 0 };
        
        popup.addEventListener('mousedown', (e) => {
            if (e.target === popup || e.target.closest('.popup-title')) {
                isDragging = true;
                popup.classList.add('dragging');
                
                const rect = popup.getBoundingClientRect();
                dragOffset.x = e.clientX - rect.left;
                dragOffset.y = e.clientY - rect.top;
                e.preventDefault();
            }
        });
        
        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const x = Math.max(0, Math.min(e.clientX - dragOffset.x, window.innerWidth - popup.offsetWidth));
                const y = Math.max(0, Math.min(e.clientY - dragOffset.y, window.innerHeight - popup.offsetHeight));
                
                popup.style.left = x + 'px';
                popup.style.top = y + 'px';
            }
        });
        
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                popup.classList.remove('dragging');
            }
        });
    }
    
    updateSliderValue(sliderId, value) {
        const slider = this.sliders.get(sliderId);
        if (slider) {
            slider.value = value;
            const percentage = ((value - slider.min) / (slider.max - slider.min)) * 100;
            slider.track.style.width = percentage + '%';
            slider.handle.style.left = percentage + '%';
            slider.valueDisplay.textContent = slider.callback(value);
        }
    }
    
    updateSizePresets() {
        const currentSize = this.toolSystem.brushSize;
        const currentOpacity = Math.round(this.toolSystem.opacity * 100);
        
        document.querySelectorAll('.size-preset-item').forEach(preset => {
            const presetSize = parseFloat(preset.getAttribute('data-size'));
            const circle = preset.querySelector('.size-preview-circle');
            const label = preset.querySelector('.size-preview-label');
            const percent = preset.querySelector('.size-preview-percent');
            
            if (!circle || !label || !percent) return;
            
            // アクティブ状態の更新
            const isActive = Math.abs(presetSize - currentSize) < 0.1;
            preset.classList.toggle('active', isActive);
            
            // 円のサイズ更新（0.5-20pxの範囲で線形変換）
            let circleSize;
            if (isActive) {
                // アクティブなプリセットは現在のスライダー値を反映
                circleSize = Math.max(0.5, Math.min(20, (currentSize / 100) * 19.5 + 0.5));
            } else {
                // 非アクティブなプリセットは固定サイズ値を反映
                circleSize = Math.max(0.5, Math.min(20, (presetSize / 100) * 19.5 + 0.5));
            }
            
            circle.style.width = circleSize + 'px';
            circle.style.height = circleSize + 'px';
            
            // 不透明度の適用
            circle.style.opacity = this.toolSystem.opacity;
            
            // ラベルの更新
            if (isActive) {
                label.textContent = currentSize.toFixed(1);
            } else {
                label.textContent = presetSize.toString();
            }
            
            // パーセント表示の更新
            percent.textContent = currentOpacity + '%';
        });
    }
    
    closeAllPopups() {
        document.querySelectorAll('.popup-panel').forEach(popup => {
            popup.classList.remove('show');
        });
        this.activePopup = null;
    }
    
    // ステータス表示更新
    updateCanvasInfo(width, height) {
        const element = document.getElementById('canvas-info');
        if (element) {
            element.textContent = `${width}×${height}px`;
        }
    }
    
    updateCoordinates(x, y) {
        const element = document.getElementById('coordinates');
        if (element) {
            element.textContent = `x: ${Math.round(x)}, y: ${Math.round(y)}`;
        }
    }
    
    updatePressureMonitor(pressure) {
        const element = document.getElementById('pressure-monitor');
        if (element) {
            element.textContent = pressure.toFixed(1) + '%';
        }
    }
    
    resetPressureMonitor() {
        const element = document.getElementById('pressure-monitor');
        if (element) {
            element.textContent = '0.0%';
        }
    }
}

// グローバル公開
if (typeof window !== 'undefined') {
    window.UIController = UIController;
}