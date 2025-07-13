/**
 * [クラス責務] ShortcutHandler.js
 * 目的：キーボードショートカットに関するイベント処理を専門に担当する。
 * 旧shortcut-manager.jsの責務を引き継ぐ。
 */
export class ShortcutHandler {
    constructor({ historyStore, viewport, toolActions, layerActions, interaction }) {
        this.historyStore = historyStore;
        this.viewport = viewport;
        this.toolActions = toolActions;
        this.layerActions = layerActions;
        this.interaction = interaction;
        
        this.initialize();
    }

    initialize() {
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));
    }

    handleKeyDown(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
        if (e.repeat) return;

        // Modifier keys state
        if (e.key === 'Shift') this.interaction.isShiftDown = true;
        if (e.key === ' ') {
            if (!this.interaction.isSpaceDown) e.preventDefault();
            this.interaction.isSpaceDown = true;
        }

        // Layer Transform Shortcuts
        if (e.key.toLowerCase() === 'v') {
            if (!this.interaction.isVDown) this.interaction.startLayerTransform();
            this.interaction.isVDown = true;
            e.preventDefault();
            return;
        }
        if (this.interaction.isLayerTransforming) {
            this.handleTransformKeys(e);
            return;
        }

        if (e.ctrlKey || e.metaKey) {
            this.handleCtrlKeys(e);
        } else {
            this.handleNormalKeys(e);
        }
    }

    handleKeyUp(e) {
        if (e.key === 'Shift') this.interaction.isShiftDown = false;
        if (e.key === ' ') this.interaction.isSpaceDown = false;
        if (e.key.toLowerCase() === 'v') {
            this.interaction.commitLayerTransform();
            this.interaction.isVDown = false;
        }
    }

    handleTransformKeys(e) {
        let handled = true;
        switch (e.key.toLowerCase()) {
            case 'escape': this.interaction.cancelLayerTransform(); break;
            // Other transform keys (arrows, scale, rotate) would call this.interaction.applyLayerTransform()
            default: handled = false;
        }
        if (handled) e.preventDefault();
    }

    handleCtrlKeys(e) {
        let handled = true;
        switch (e.key.toLowerCase()) {
            case 'z': this.historyStore.undo(); break;
            case 'y': this.historyStore.redo(); break;
            case '[': this.toolActions.changeSize(false); break;
            case ']': this.toolActions.changeSize(true); break;
            default: handled = false;
        }
        if (handled) e.preventDefault();
    }

    handleNormalKeys(e) {
        let handled = true;
        switch (e.key.toLowerCase()) {
            case 'p': this.toolActions.setTool('pen'); break;
            case 'e': this.toolActions.setTool('eraser'); break;
            case 'g': this.toolActions.setTool('bucket'); break;
            case 'x': this.toolActions.swapColors(); break;
            case 'd': this.toolActions.resetColors(); break;
            case 'h': this.viewport.flipHorizontal(); break;
            case 'f': this.viewport.flipVertical(); break;
            case 'home': case '0': this.viewport.resetView(); break;
            case 'delete': case 'backspace': this.layerActions.clearActiveLayer(); break;
            default: handled = false;
        }
        if (handled) e.preventDefault();
    }
}