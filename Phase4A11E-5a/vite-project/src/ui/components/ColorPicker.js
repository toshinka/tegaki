/**
 * [クラス責務] ColorPicker.js
 * 目的：カラーピッカーとカラーパレットUIの表示とイベント処理を担当する。
 * 旧ColorManagerのUI関連の責務を引き継ぐ。
 */
export class ColorPicker {
    constructor({ toolStore, toolActions }) {
        this.toolActions = toolActions;

        this.mainColorDisplay = document.getElementById('main-color-display');
        this.subColorDisplay = document.getElementById('sub-color-display');
        this.colorButtons = document.querySelectorAll('.color-btn');
        
        this.bindEvents();
    }

    bindEvents() {
        this.colorButtons.forEach(btn => {
            btn.addEventListener('click', () => this.toolActions.setColor(btn.dataset.color));
        });
        
        this.mainColorDisplay.addEventListener('click', () => this.showColorPicker('main'));
        this.subColorDisplay.addEventListener('click', () => this.showColorPicker('sub'));

        // You could add buttons for swap and reset that call toolActions
        // document.getElementById('swap-colors-btn')?.addEventListener('click', () => this.toolActions.swapColors());
    }

    showColorPicker(target) {
        const input = document.createElement('input');
        input.type = 'color';
        input.addEventListener('input', (e) => this.toolActions.setColor(e.target.value, target));
        input.click();
    }

    render(toolState) {
        // 🎨 START: カラーピッカーバグ修正
        // Update the UI when the color changes in the store
        // 'mainColor' を 'color' に変更
        this.mainColorDisplay.style.backgroundColor = toolState.color;
        // 🎨 END: カラーピッカーバグ修正
        this.subColorDisplay.style.backgroundColor = toolState.subColor;
    }
}