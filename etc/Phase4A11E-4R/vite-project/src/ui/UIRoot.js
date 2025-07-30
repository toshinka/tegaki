import { Toolbar } from './components/Toolbar.js';
import { LayerPanel } from './components/LayerPanel.js';
import { ColorPicker } from './components/ColorPicker.js';
import { PenSettingsPanel } from './components/PenSettingsPanel.js';

/**
 * [クラス責務] UIController.js
 * 目的：UI全体の同期・制御を行う。
 * (変更後クラス名: UIRoot)
 */
// 変更: UIController -> UIRoot
export class UIRoot {
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