/**
 * blend-modes.js
 * BlendMode定義（透明化ペン対応）
 * 
 * Dependencies: None
 * Parent: brush-core.js, msdf-pipeline-manager.js
 */

const BlendMode = {
    NORMAL: 'normal',
    ERASE: 'erase'
};

// PIXIマッピング
const BlendModeToPIXI = {
    [BlendMode.NORMAL]: 0, // PIXI.BLEND_MODES.NORMAL
    [BlendMode.ERASE]: 1   // PIXI.BLEND_MODES.ERASE
};

// グローバル登録
window.BlendMode = BlendMode;
window.BlendModeToPIXI = BlendModeToPIXI;

console.log('✅ BlendMode definitions loaded');