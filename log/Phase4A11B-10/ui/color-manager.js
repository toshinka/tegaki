export class ColorManager {
    constructor(app) {
        this.app = app;
        this.mainColor = '#800000';
        this.subColor = '#f0e0d6';
        this.colors = Array.from(document.querySelectorAll('.color-btn')).map(btn => btn.dataset.color);
        this.currentColorIndex = this.colors.indexOf(this.mainColor);
        this.mainColorDisplay = document.getElementById('main-color-display');
        this.subColorDisplay = document.getElementById('sub-color-display');
        this.bindEvents();
        this.updateColorDisplays();
        document.querySelector(`[data-color="${this.mainColor}"]`)?.classList.add('active');
    }
    
    bindEvents() {
        document.querySelectorAll('.color-btn').forEach(btn => btn.addEventListener('click', (e) => this.setColor(e.currentTarget.dataset.color)));
        document.querySelector('.color-mode-display').addEventListener('click', () => this.swapColors());
    }
    
    setColor(color) {
        this.mainColor = color;
        this.currentColorIndex = this.colors.indexOf(this.mainColor);
        document.querySelectorAll('.color-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-color="${color}"]`)?.classList.add('active');
        this.updateColorDisplays();
        this.app.canvasManager.setCurrentColor(this.mainColor);
    }
    
    updateColorDisplays() {
        this.mainColorDisplay.style.backgroundColor = this.mainColor;
        this.subColorDisplay.style.backgroundColor = this.subColor;
    }
    
    swapColors() {
        [this.mainColor, this.subColor] = [this.subColor, this.mainColor];
        this.updateColorDisplays();
        this.setColor(this.mainColor);
    }
    
    resetColors() {
        this.setColor('#800000');
        this.subColor = '#f0e0d6';
        this.updateColorDisplays();
    }
    
    changeColor(increase) {
        let newIndex = this.currentColorIndex + (increase ? 1 : -1);
        newIndex = (newIndex + this.colors.length) % this.colors.length;
        this.setColor(this.colors[newIndex]);
    }
}