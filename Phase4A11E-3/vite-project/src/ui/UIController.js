import { Toolbar } from './components/Toolbar.js';
import { LayerPanel } from './components/LayerPanel.js';
import { ColorPicker } from './components/ColorPicker.js';
import { PenSettingsPanel } from './components/PenSettingsPanel.js';

/**
 * [クラス責務] UIController.js
 * 目的：UI全体の同期・制御を行う。
 * 責務：
 * - 各UIコンポーネント（Toolbar, LayerPanelなど）を初期化する。
 * - 各Store（状態管理）の変更を購読し、関連するUIコンポーネントに再描画を指示する。
 * - UIコンポーネントとActions（ユーザー操作）を接続する。
 *
 * 旧ui-manager.jsの役割を、より構造化された形で引き継ぐ。
 */
export class UIController {
    constructor({ toolStore, layerStore, historyStore, viewport, layerActions, toolActions }) {

        // Instantiate all UI components and pass them the modules they need
        const toolbar = new Toolbar({ historyStore, viewport });
        const layerPanel = new LayerPanel({ layerStore, layerActions });
        const colorPicker = new ColorPicker({ toolStore, toolActions });
        const penSettingsPanel = new PenSettingsPanel({ toolStore, toolActions });

        // Subscribe components to store updates so they can re-render themselves
        toolStore.subscribe(state => {
            colorPicker.render(state);
            penSettingsPanel.render(state);
        });

        layerStore.subscribe(state => {
            layerPanel.render(state);
        });
        
        historyStore.subscribe(state => {
            toolbar.render(state);
        });
    }
}