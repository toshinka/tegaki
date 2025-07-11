// src/ui/pen-settings-manager.js

export class PenSettingsManager {
    constructor(app) {
        this.app = app;
        this.currentSize = 10;
        this.sizes = [1, 3, 5, 10, 20, 50]; // 例
        
        this.bindEvents();
        this.updateSizeUI();
    }

    bindEvents() {
        // HTMLに .size-btn がある場合
        document.querySelectorAll('.size-btn').forEach(btn => {
            btn.addEventListener('click', () => this.setSize(parseInt(btn.dataset.size, 10)));
        });
    }

    setSize(size) {
        this.currentSize = size;
        this.app.canvasManager.setCurrentSize(size);
        this.updateSizeUI();
        console.log(`ブラシサイズを ${size} に変更`);
    }

    changeSize(increase) {
        const step = (this.currentSize < 10) ? 1 : (this.currentSize < 50) ? 2 : 5;
        let newSize;
        if (increase) {
            newSize = Math.min(200, this.currentSize + step);
        } else {
            newSize = Math.max(1, this.currentSize - step);
        }
        this.setSize(newSize);
    }
    
    updateSizeUI() {
        document.querySelectorAll('.size-btn').forEach(btn => {
            if (parseInt(btn.dataset.size, 10) === this.currentSize) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }
}