class PenSettingsManager {
    constructor(app) {
        this.app = app;
        this.penSettings = {
            color: '#222',
            size: 4
        };
        this.penSettingsDiv = document.getElementById('pen-settings');
        this.init();
    }

    init() {
        this.penSettingsDiv.innerHTML = `
            色 <input type="color" id="pen-color" value="${this.penSettings.color}">
            太さ <input type="range" id="pen-size" min="1" max="16" value="${this.penSettings.size}">
            <span id="pen-size-label">${this.penSettings.size}</span>
        `;
        document.getElementById('pen-color').addEventListener('input', (e) => {
            this.penSettings.color = e.target.value;
        });
        document.getElementById('pen-size').addEventListener('input', (e) => {
            this.penSettings.size = parseInt(e.target.value, 10);
            document.getElementById('pen-size-label').textContent = this.penSettings.size;
        });
    }

    getPenColor() {
        return this.penSettings.color;
    }
    getPenSize() {
        return this.penSettings.size;
    }
}