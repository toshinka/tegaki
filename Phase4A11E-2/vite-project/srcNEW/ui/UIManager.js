import { Pane } from 'tweakpane';

class UIManager {
    constructor(penState, colorState, toolState) {
        this.penState = penState;
        this.colorState = colorState;
        this.toolState = toolState;

        // Tweakpaneのインスタンスを作成
        this.pane = new Pane({
            title: '設定パネル',
            expanded: true,
        });

        this.setupToolPanel();
        this.setupPenPanel();
        this.setupColorPanel();
    }

    // ツール選択パネル
    setupToolPanel() {
        const toolFolder = this.pane.addFolder({ title: 'ツール' });
        toolFolder.addBinding(this.toolState, 'activeTool', {
            label: '種類',
            options: {
                'ペン': 'pen',
                '消しゴム': 'eraser',
            },
        });
    }

    // ペン設定パネル
    setupPenPanel() {
        const penFolder = this.pane.addFolder({ title: 'ペン設定' });
        penFolder.addBinding(this.penState, 'size', {
            label: '太さ',
            min: 1,
            max: 100,
            step: 1,
        });
    }

    // カラー設定パネル
    setupColorPanel() {
        const colorFolder = this.pane.addFolder({ title: 'カラー' });
        colorFolder.addBinding(this.colorState, 'color', {
            label: '描画色',
        });
    }
}

export default UIManager;