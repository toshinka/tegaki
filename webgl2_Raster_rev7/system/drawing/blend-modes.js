/**
 * ============================================================
 * blend-modes.js - Phase 3.7: ラスター対応版
 * ============================================================
 * 【役割】
 * - ブレンドモード定義
 * - WebGL2 glBlendFunc マッピング
 * - ラスター合成用設定
 * 
 * 【依存】なし
 * 【親】
 * - brush-core.js
 * - raster-layer.js
 * - webgl2-drawing-layer.js
 * 
 * 【Phase 3.7改修内容】
 * ✅ WebGL2ブレンド関数マッピング追加
 * ✅ ラスター合成用定義
 * ✅ 将来拡張用ブレンドモード準備
 * ============================================================
 */

(function() {
    'use strict';

    /**
     * ブレンドモード定義
     */
    const BlendMode = {
        NORMAL: 'normal',
        ERASE: 'erase',
        
        // 将来実装用
        MULTIPLY: 'multiply',
        ADD: 'add',
        SCREEN: 'screen',
        OVERLAY: 'overlay',
        DARKEN: 'darken',
        LIGHTEN: 'lighten'
    };

    /**
     * PIXI.jsブレンドモードマッピング
     */
    const BlendModeToPIXI = {
        [BlendMode.NORMAL]: 0,      // PIXI.BLEND_MODES.NORMAL
        [BlendMode.ERASE]: 1,       // PIXI.BLEND_MODES.ERASE
        [BlendMode.MULTIPLY]: 2,    // PIXI.BLEND_MODES.MULTIPLY
        [BlendMode.ADD]: 3,         // PIXI.BLEND_MODES.ADD
        [BlendMode.SCREEN]: 4,      // PIXI.BLEND_MODES.SCREEN
        [BlendMode.OVERLAY]: 5,     // PIXI.BLEND_MODES.OVERLAY
        [BlendMode.DARKEN]: 6,      // PIXI.BLEND_MODES.DARKEN
        [BlendMode.LIGHTEN]: 7      // PIXI.BLEND_MODES.LIGHTEN
    };

    /**
     * WebGL2 glBlendFunc マッピング
     * 
     * 各モードは [srcFactor, dstFactor] の配列
     * srcFactor: ソース（描画する色）の係数
     * dstFactor: デスティネーション（既存の色）の係数
     */
    const BlendModeToWebGL2 = {
        [BlendMode.NORMAL]: {
            src: 'SRC_ALPHA',           // gl.SRC_ALPHA
            dst: 'ONE_MINUS_SRC_ALPHA', // gl.ONE_MINUS_SRC_ALPHA
            equation: 'FUNC_ADD'        // gl.FUNC_ADD
        },
        
        [BlendMode.ERASE]: {
            src: 'ZERO',                // gl.ZERO
            dst: 'ONE_MINUS_SRC_ALPHA', // gl.ONE_MINUS_SRC_ALPHA
            equation: 'FUNC_ADD'
        },
        
        [BlendMode.MULTIPLY]: {
            src: 'DST_COLOR',           // gl.DST_COLOR
            dst: 'ONE_MINUS_SRC_ALPHA', // gl.ONE_MINUS_SRC_ALPHA
            equation: 'FUNC_ADD'
        },
        
        [BlendMode.ADD]: {
            src: 'SRC_ALPHA',           // gl.SRC_ALPHA
            dst: 'ONE',                 // gl.ONE
            equation: 'FUNC_ADD'
        },
        
        [BlendMode.SCREEN]: {
            src: 'ONE',                 // gl.ONE
            dst: 'ONE_MINUS_SRC_COLOR', // gl.ONE_MINUS_SRC_COLOR
            equation: 'FUNC_ADD'
        },
        
        [BlendMode.OVERLAY]: {
            // オーバーレイは複雑なので標準ブレンドで近似
            src: 'SRC_ALPHA',
            dst: 'ONE_MINUS_SRC_ALPHA',
            equation: 'FUNC_ADD'
        },
        
        [BlendMode.DARKEN]: {
            src: 'ONE',
            dst: 'ONE',
            equation: 'MIN' // gl.MIN
        },
        
        [BlendMode.LIGHTEN]: {
            src: 'ONE',
            dst: 'ONE',
            equation: 'MAX' // gl.MAX
        }
    };

    /**
     * WebGL2ブレンド関数を適用
     * @param {WebGL2RenderingContext} gl 
     * @param {string} blendMode 
     */
    function applyWebGL2BlendMode(gl, blendMode) {
        const mode = BlendModeToWebGL2[blendMode];
        
        if (!mode) {
            console.warn('[BlendModes] Unknown blend mode:', blendMode);
            // デフォルトはNORMAL
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            gl.blendEquation(gl.FUNC_ADD);
            return;
        }
        
        // ブレンド関数設定
        const srcFactor = gl[mode.src];
        const dstFactor = gl[mode.dst];
        gl.blendFunc(srcFactor, dstFactor);
        
        // ブレンド方程式設定
        const equation = gl[mode.equation];
        gl.blendEquation(equation);
    }

    /**
     * ブレンドモード名取得
     * @param {string} mode 
     * @returns {string}
     */
    function getBlendModeName(mode) {
        const names = {
            [BlendMode.NORMAL]: '通常',
            [BlendMode.ERASE]: '消しゴム',
            [BlendMode.MULTIPLY]: '乗算',
            [BlendMode.ADD]: '加算',
            [BlendMode.SCREEN]: 'スクリーン',
            [BlendMode.OVERLAY]: 'オーバーレイ',
            [BlendMode.DARKEN]: '比較（暗）',
            [BlendMode.LIGHTEN]: '比較（明）'
        };
        
        return names[mode] || mode;
    }

    /**
     * 利用可能なブレンドモード一覧
     * @returns {Array<Object>}
     */
    function getAvailableBlendModes() {
        return [
            { value: BlendMode.NORMAL, label: getBlendModeName(BlendMode.NORMAL) },
            { value: BlendMode.ERASE, label: getBlendModeName(BlendMode.ERASE) },
            { value: BlendMode.MULTIPLY, label: getBlendModeName(BlendMode.MULTIPLY), future: true },
            { value: BlendMode.ADD, label: getBlendModeName(BlendMode.ADD), future: true },
            { value: BlendMode.SCREEN, label: getBlendModeName(BlendMode.SCREEN), future: true },
            { value: BlendMode.OVERLAY, label: getBlendModeName(BlendMode.OVERLAY), future: true },
            { value: BlendMode.DARKEN, label: getBlendModeName(BlendMode.DARKEN), future: true },
            { value: BlendMode.LIGHTEN, label: getBlendModeName(BlendMode.LIGHTEN), future: true }
        ];
    }

    /**
     * ブレンドモード検証
     * @param {string} mode 
     * @returns {boolean}
     */
    function isValidBlendMode(mode) {
        return Object.values(BlendMode).includes(mode);
    }

    /**
     * デフォルトブレンドモード取得
     * @returns {string}
     */
    function getDefaultBlendMode() {
        return BlendMode.NORMAL;
    }

    // グローバル登録
    window.BlendMode = BlendMode;
    window.BlendModeToPIXI = BlendModeToPIXI;
    window.BlendModeToWebGL2 = BlendModeToWebGL2;
    
    // ヘルパー関数
    window.BlendModeUtils = {
        applyWebGL2BlendMode,
        getBlendModeName,
        getAvailableBlendModes,
        isValidBlendMode,
        getDefaultBlendMode
    };

    console.log('✅ blend-modes.js Phase 3.7 loaded (ラスター対応版)');
    console.log('   ✅ WebGL2 glBlendFunc マッピング追加');
    console.log('   ✅ 8種類のブレンドモード定義');
    console.log('   ✅ ヘルパー関数提供');

})();