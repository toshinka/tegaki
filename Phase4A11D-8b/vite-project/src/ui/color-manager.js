// src/ui/color-manager.js

export class ColorManager {
    constructor(app) {
        this.app = app;
        this.mainColor = '#800000';
        this.subColor = '#f0e0d6';
        this.mainColorDisplay = document.getElementById('main-color-display');
        this.subColorDisplay = document.getElementById('sub-color-display');
        
        this.bindEvents();
        this.updateColorDisplays();
    }

    bindEvents() {
        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.addEventListener('click', () => this.setColor(btn.dataset.color));
        });
        
        this.mainColorDisplay.addEventListener('click', () => this.showColorPicker('main'));
        this.subColorDisplay.addEventListener('click', () => this.showColorPicker('sub'));
    }

    setColor(color, target = 'main') {
        if (target === 'main') {
            this.mainColor = color;
        } else {
            this.subColor = color;
        }
        this.updateColorDisplays();
    }

    swapColors() {
        [this.mainColor, this.subColor] = [this.subColor, this.mainColor];
        this.updateColorDisplays();
    }

    resetColors() {
        this.mainColor = '#800000';
        this.subColor = '#f0e0d6';
        this.updateColorDisplays();
    }

    updateColorDisplays() {
        this.mainColorDisplay.style.backgroundColor = this.mainColor;
        this.subColorDisplay.style.backgroundColor = this.subColor;
        this.app.canvasManager.setCurrentColor(this.mainColor);
    }
    
    showColorPicker(target) {
        const input = document.createElement('input');
        input.type = 'color';
        input.value = target === 'main' ? this.mainColor : this.subColor;
        input.addEventListener('input', (e) => this.setColor(e.target.value, target));
        input.click();
    }
    
    get currentColor() {
        return this.mainColor;
    }
}