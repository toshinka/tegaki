/**
 * [クラス責務] ToolStore.js
 * 目的：ツール（ペン、消しゴム等）、色、ブラシサイズなど、描画ツールに関する状態を一元管理する。
 * 旧tool-manager, color-manager, pen-settings-managerの責務を統合。
 */
export class ToolStore {
    constructor() {
        this.state = {
            tool: 'pen',
            mainColor: '#800000',
            subColor: '#f0e0d6',
            size: 10,
            pressureSettings: {
                curve: 0.7,
                minSizeRatio: 0.3,
            }
        };
        this.subscribers = [];
    }

    getState() {
        return this.state;
    }

    // 🎨 START: カラーピッカーバグ修正 (指示書[1]対応)
    /**
     * 描画エンジンが利用するための現在のツール設定を返す。
     * DrawingEngineが 'color' プロパティを期待しているため、
     * 内部的な 'mainColor' を 'color' としてマッピングする。
     * @returns {{tool: string, color: string, size: number, pressureSettings: object}}
     */
    getCurrentToolSettings() {
        const state = this.getState();
        return {
            tool: state.tool,
            color: state.mainColor,
            size: state.size,
            pressureSettings: state.pressureSettings
        };
    }
    // 🎨 END: カラーピッカーバグ修正

    setState(newState) {
        this.state = { ...this.state, ...newState };
        this.notify();
    }

    subscribe(callback) {
        this.subscribers.push(callback);
    }

    notify() {
        this.subscribers.forEach(callback => callback(this.state));
    }
}