/**
 * [クラス責務] PenSettingsPanel.js
 * 目的：ペン設定（ブラシサイズなど）UIの表示とイベント処理を担当する。
 * 旧PenSettingsManagerのUI関連の責務を引き継ぐ。
 */
export class PenSettingsPanel {
    constructor({ toolStore, toolActions }) {
        this.toolActions = toolActions;
        this.sizeButtons = document.querySelectorAll('.size-btn');
        this.bindEvents();
    }

    bindEvents() {
        this.sizeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const size = parseInt(btn.dataset.size, 10);
                this.toolActions.setSize(size);
            });
        });
    }

    render(toolState) {
        // Update the active state of the buttons when size changes
        this.sizeButtons.forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.size, 10) === toolState.size);
        });
    }
}