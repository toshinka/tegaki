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
        this.setupToolButtons();
        this.setupPopups();
        this.setupSliders();
        this.setupPresets();
        this.setupResize();
        this.setupCheckboxes();
        this.updateSizePresets();
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
        document.getElementById(tool + '-tool').classList.add('active');
        
        const toolNames = { pen: 'ベクターペン', eraser: '消しゴム' };
        document.getElementById('current-tool').textContent = toolNames[tool] || tool;
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
        const track = container.querySelector('.slider-track');
        const handle = container.querySelector('.slider-handle');
        const valueDisplay = container.parentNode.querySelector('.slider-value');
        
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
        document.getElementById('pen-size-decrease-small')?.addEventListener('click', () => {
            adjustValue('pen-size-slider', -0.1);
            this.updateSizePresets();
        });
        document.getElementById('pen-size-decrease')?.addEventListener('click', () => {
            adjustValue('pen-size-slider', -1);
            this.updateSizePresets();
        });
        document.getElementById('pen-size-decrease-large')?.addEventListener('click', () => {
            adjustValue('pen-size-slider', -10);
            this.updateSizePresets();
        });
        document.getElementById('pen-size-increase-small')?.addEventListener('click', () => {
            adjustValue('pen-size-slider', 0.1);
            this.updateSizePresets();
        });
        document.getElementById('pen-size-increase')?.addEventListener('click', () => {
            adjustValue('pen-size-slider', 1);
            this.updateSizePresets();
        });
        document.getElementById('pen-size-increase-large')?.addEventListener('click', () => {
            adjustValue('pen-size-slider', 10);
            this.updateSizePresets();
        });
        
        // 不透明度調整ボタン
        document.getElementById('pen-opacity-decrease-small')?.addEventListener('click', () => {
            adjustValue('pen-opacity-slider', -0.1);
            this.updateSizePresets();
        });
        document.getElementById('pen-opacity-decrease')?.addEventListener('click', () => {
            adjustValue('pen-opacity-slider', -1);
            this.updateSizePresets();
        });
        document.getElementById('pen-opacity-decrease-large')?.addEventListener('click', () => {
            adjustValue('pen-opacity-slider', -10);
            this.updateSizePresets();
        });
        document.getElementById('pen-opacity-increase-small')?.addEventListener('click', () => {
            adjustValue('pen-opacity-slider', 0.1);
            this.updateSizePresets();
        });
        document.getElementById('pen-opacity-increase')?.addEventListener('click', () => {
            adjustValue('pen-opacity-slider', 1);
            this.updateSizePresets();
        });
        document.getElementById('pen-opacity-increase-large')?.addEventListener('click', () => {
            adjustValue('pen-opacity-slider', 10);
            this.updateSizePresets();
        });
        
        // 筆圧調整ボタン
        document.getElementById('pen-pressure-decrease-small')?.addEventListener('click', () => {
            adjustValue('pen-pressure-slider', -0.1);
        });
        document.getElementById('pen-pressure-decrease')?.addEventListener('click', () => {
            adjustValue('pen-pressure-slider', -1);
        });
        document.getElementById('pen-pressure-decrease-large')?.addEventListener('click', () => {
            adjustValue('pen-pressure-slider', -10);
        });
        document.getElementById('pen-pressure-increase-small')?.addEventListener('click', () => {
            adjustValue('pen-pressure-slider', 0.1);
        });
        document.getElementById('pen-pressure-increase')?.addEventListener('click', () => {
            adjustValue('pen-pressure-slider', 1);
        });
        document.getElementById('pen-pressure-increase-large')?.addEventListener('click', () => {
            adjustValue('pen-pressure-slider', 10);
        });
        
        // 線補正調整ボタン
        document.getElementById('pen-smoothing-decrease-small')?.addEventListener('click', () => {
            adjustValue('pen-smoothing-slider', -0.1);
        });
        document.getElementById('pen-smoothing-decrease')?.addEventListener('click', () => {
            adjustValue('pen-smoothing-slider', -1);
        });
        document.getElementById('pen-smoothing-decrease-large')?.addEventListener('click', () => {
            adjustValue('pen-smoothing-slider', -10);
        });
        document.getElementById('pen-smoothing-increase-small')?.addEventListener('click', () => {
            adjustValue('pen-smoothing-slider', 0.1);
        });
        document.getElementById('pen-smoothing-increase')?.addEventListener('click