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
        this.subscribers = []; // List of functions to call when state changes
    }

    // --- State Access ---
    getState() {
        return this.state;
    }

    // --- State Modification ---
    setState(newState) {
        this.state = { ...this.state, ...newState };
        this.notify();
    }

    // --- Subscription ---
    subscribe(callback) {
        this.subscribers.push(callback);
    }

    notify() {
        this.subscribers.forEach(callback => callback(this.state));
    }
}