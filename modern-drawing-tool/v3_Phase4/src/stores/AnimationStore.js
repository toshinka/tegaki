// ===== src/stores/AnimationStore.js =====
/**
 * AnimationStore - アニメーション状態管理
 */
export class AnimationStore {
    constructor() {
        this.cuts = new Map();
        this.currentCut = null;
    }
    
    exportState() {
        return {
            cuts: Array.from(this.cuts.entries()),
            currentCut: this.currentCut
        };
    }
}