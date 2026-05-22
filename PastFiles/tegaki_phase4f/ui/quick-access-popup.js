/**
 * ============================================================================
 * ファイル名: ui/quick-access-popup.js
 * 責務: ペン設定（サイズ、不透明度、色、ツール切替、ツール別プリセット）への素早いアクセスを提供するUI
 * 依存: system/event-bus.js, system/drawing/brush-settings.js, ui/ui-icons.js
 * 被依存: core-engine.js, system/popup-manager.js
 * 公開API: QuickAccessPopup
 * イベント発火: tool:changed, brush:color-changed, brush:size-changed, brush:opacity-changed, popup:*
 * イベント受信: ui:sidebar:sync-tool, tool:select
 * グローバル登録: window.QuickAccessPopup, window.TegakiUI.QuickAccessPopup
 * 実装状態: Phase 3b Rev.2 - カラースロット実装・レイアウト再構築・プリセットスロットUI改修
 * ============================================================================
 */

import { TegakiEventBus } from '../system/event-bus.js';
import { UI_ICONS } from './ui-icons.js';

const QA_STORAGE_KEYS = {
    position: 'quick-access-position',
    presets: 'tegaki-quick-access-tool-presets-v1',
    colorSlots: 'tegaki-quick-access-color-slots-v1',
    mainSubColors: 'tegaki-quick-access-main-sub-colors-v1'
};

const QA_PRESET_TOOLS = ['pen', 'eraser', 'airbrush'];
const QA_PRESET_SLOT_COUNT = 5;
const QA_COLOR_SLOT_COUNT = 5;
const QA_DEFAULT_MAIN_COLOR = 0x800000;
const QA_DEFAULT_SUB_COLOR = 0xf0e0d6;
const QA_LEGACY_SUB_COLOR = 0xffffff;

const QA_DEFAULT_PRESETS = {
    pen: [
        { size: 1.0, opacity: 100 },
        { size: 3.0, opacity: 100 },
        { size: 6.0, opacity: 100 },
        { size: 12.0, opacity: 90 },
        { size: 24.0, opacity: 80 }
    ],
    eraser: [
        { size: 3.0, opacity: 100 },
        { size: 8.0, opacity: 100 },
        { size: 16.0, opacity: 100 },
        { size: 32.0, opacity: 100 },
        { size: 50.0, opacity: 100 }
    ],
    airbrush: [
        { size: 8.0, opacity: 25 },
        { size: 14.0, opacity: 35 },
        { size: 24.0, opacity: 45 },
        { size: 36.0, opacity: 55 },
        { size: 50.0, opacity: 65 }
    ]
};

// カラースロット初期値 (各スロット12色: 上段6 + 下段6)
const QA_DEFAULT_COLOR_SLOTS = [
    // COLOR 1: ふたばカラー + グレースケール
    [0x800000, 0xaa5a56, 0xcf9c97, 0xe9c2ba, 0xf0e0d6, 0xffffee,
     0xffffff, 0xcccccc, 0x999999, 0x666666, 0x333333, 0x000000],
    // COLOR 2: 暖色系
    [0xff0000, 0xff4400, 0xff8800, 0xffaa00, 0xffcc44, 0xffee88,
     0xcc0000, 0xaa2200, 0x882200, 0x661100, 0xdd6644, 0xffccaa],
    // COLOR 3: 寒色系
    [0x0044ff, 0x2266ff, 0x4488ff, 0x66aaff, 0x88ccff, 0xaaddff,
     0x003388, 0x224466, 0x4488aa, 0x66aacc, 0x003366, 0x224488],
    // COLOR 4: 緑・自然系
    [0x006600, 0x228822, 0x44aa44, 0x66cc66, 0x88dd88, 0xaaffaa,
     0x224400, 0x446600, 0x668800, 0x88aa00, 0xaacc44, 0xccee88],
    // COLOR 5: パステル・カスタム用
    [0xff88aa, 0xffaacc, 0xffccee, 0xeeccff, 0xccaaff, 0xaa88ff,
     0x88aaff, 0x88ccff, 0x88eeff, 0x88ffee, 0x88ffcc, 0x88ffaa]
];

export class QuickAccessPopup {
    constructor(dependencies = {}) {
        this.config = dependencies.config || {};
        this.eventBus = TegakiEventBus;
        this.brushSettings = dependencies.brushSettings || window.brushSettings;

        this.panel = null;
        this.isVisible = false;
        this.initialized = false;

        this.isDraggingSize = false;
        this.isDraggingOpacity = false;
        this.isDraggingPanel = false;

        this.dragStartX = 0;
        this.dragStartY = 0;
        this.panelStartX = 0;
        this.panelStartY = 0;

        this.elements = {};

        this.sliderMoveHandler = null;
        this.sliderUpHandler = null;
        this.dragMoveHandler = null;
        this.dragUpHandler = null;

        this.activeSliderElement = null;
        this.activeSliderPointerId = null;
        this.activeDragPointerId = null;

        this.currentSize = 3;
        this.currentOpacity = 100;
        this.currentTool = 'pen';

        // カラースロット状態
        this.activeColorSlotIndex = 0; // 0〜4
        this.activeColorIndex = 0; // 各COLOR内の0〜11
        this.colorSlots = this._loadColorSlots();
        this.isColorSubPopupOpen = false;

        // メイン/サブカラー
        const savedColors = this._loadMainSubColors();
        this.mainColor = savedColors.main;
        this.subColor = savedColors.sub;

        this.MIN_SIZE = 0.5;
        this.MIN_OPACITY = 0;
        this.MAX_OPACITY = 100;

        this.toolPresets = this._loadPresets();
        this.activePresetSlots = this._loadActivePresetSlots();

        this._ensurePanelExists();
        this._injectStyles();
    }

    get MAX_SIZE() {
        return window.brushSettings ? window.brushSettings.getMaxSize() : 100;
    }

    _injectStyles() {
        if (document.querySelector('style[data-qa-popup-styles]')) return;

        const style = document.createElement('style');
        style.setAttribute('data-qa-popup-styles', 'true');
        style.textContent = `
            #quick-access-popup.qa-popup {
                position: fixed;
                z-index: 2600;
                width: 220px;
                max-width: calc(100vw - 24px);
                padding: 10px 10px 10px;
                border: 1px solid rgba(128, 0, 0, 0.28);
                border-radius: 14px;
                background:
                    linear-gradient(180deg, rgba(255, 255, 238, 0.74), rgba(240, 224, 214, 0.62)),
                    rgba(255, 255, 238, 0.52);
                box-shadow: 0 14px 34px rgba(80, 32, 24, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.55);
                backdrop-filter: blur(12px) saturate(1.12);
                -webkit-backdrop-filter: blur(12px) saturate(1.12);
                color: var(--futaba-maroon);
                user-select: none;
                touch-action: none;
                cursor: default;
            }

            #quick-access-popup.qa-popup.show {
                display: block;
            }

            #quick-access-popup.qa-popup:not(.show) {
                display: none;
            }

            .qa-close {
                position: absolute;
                top: 8px;
                right: 8px;
                z-index: 2;
                width: 24px;
                height: 24px;
                border-radius: 7px;
            }

            .qa-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                min-height: 26px;
                padding: 0 30px 8px 2px;
                border-bottom: 1px solid rgba(128, 0, 0, 0.14);
                cursor: grab;
            }

            .qa-header-title {
                display: inline-flex;
                flex-direction: column;
                gap: 1px;
                min-width: 0;
            }

            .qa-header-main {
                font-size: 13px;
                font-weight: 700;
                line-height: 1.1;
                color: var(--futaba-maroon);
                letter-spacing: 0.02em;
            }

            .qa-header-sub {
                font-size: 10px;
                line-height: 1.1;
                color: rgba(128, 0, 0, 0.58);
                white-space: nowrap;
            }

            .qa-section {
                margin-top: 6px;
            }

            .qa-section-label-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 4px;
            }

            .qa-section-label {
                font-size: 10px;
                font-weight: 700;
                color: rgba(128, 0, 0, 0.78);
                letter-spacing: 0.04em;
            }

            .qa-section-value {
                font-size: 9px;
                font-weight: 700;
                color: rgba(128, 0, 0, 0.58);
            }

            /* ─── カラーパレット ─── */
            .qa-palette-header-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 4px;
            }

            .qa-palette-header-left {
                display: flex;
                align-items: center;
                gap: 5px;
            }

            .qa-palette-header-right {
                display: flex;
                align-items: center;
                gap: 5px;
            }

            .qa-color-slot-btn {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 24px;
                height: 18px;
                border-radius: 6px;
                border: 1px solid rgba(128, 0, 0, 0.22);
                background: rgba(255, 255, 238, 0.64);
                color: var(--futaba-maroon);
                cursor: pointer;
                padding: 0;
                transition: background 0.14s ease, transform 0.12s ease, border-color 0.14s ease;
                position: relative;
            }

            .qa-color-slot-btn svg {
                width: 12px;
                height: 12px;
                stroke: currentColor !important;
                pointer-events: none;
            }

            .qa-color-slot-btn:hover {
                background: rgba(240, 224, 214, 0.84);
                border-color: rgba(128, 0, 0, 0.36);
                transform: translateY(-1px);
            }

            .qa-color-slot-btn.active {
                border-color: rgba(255, 140, 66, 0.9);
                background: rgba(255, 245, 222, 0.92);
            }

            .qa-eyedropper-btn {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 22px;
                height: 18px;
                border-radius: 6px;
                border: 1px solid rgba(128, 0, 0, 0.22);
                background: rgba(255, 255, 238, 0.64);
                color: var(--futaba-maroon);
                cursor: pointer;
                padding: 0;
                transition: background 0.14s ease, transform 0.12s ease, border-color 0.14s ease, box-shadow 0.14s ease;
            }

            .qa-eyedropper-btn svg {
                width: 12px;
                height: 12px;
                stroke: currentColor !important;
                pointer-events: none;
            }

            .qa-eyedropper-btn:hover {
                background: rgba(240, 224, 214, 0.84);
                border-color: rgba(128, 0, 0, 0.36);
                transform: translateY(-1px);
            }

            .qa-eyedropper-btn.active {
                border-color: rgba(255, 140, 66, 0.9);
                background: rgba(255, 245, 222, 0.92);
                box-shadow: 0 0 0 2px rgba(255, 140, 66, 0.18);
            }

            .qa-current-color-dot {
                width: 16px;
                height: 16px;
                border-radius: 50%;
                border: 1px solid rgba(128, 0, 0, 0.28);
                box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.42);
                background: #800000;
                flex: 0 0 auto;
                display: none; /* メイン/サブ表示に切り替えるため非表示 */
            }

            .qa-color-swatches {
                display: flex;
                align-items: center;
                position: relative;
                width: 24px;
                height: 20px;
                flex: 0 0 auto;
            }

            .qa-swatch {
                width: 14px;
                height: 14px;
                border: 1px solid rgba(128, 0, 0, 0.32);
                border-radius: 3px;
                position: absolute;
                box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.2);
                cursor: pointer;
                transition: transform 0.1s ease;
            }

            .qa-swatch:hover {
                transform: scale(1.1);
                z-index: 5 !important;
            }

            .qa-swatch-main {
                background: #800000;
                top: 0;
                left: 0;
                z-index: 2;
            }

            .qa-swatch-sub {
                background: #ffffee;
                bottom: 0;
                right: 0;
                z-index: 1;
            }

            .qa-color-circle-container {
                display: none;
                margin: 4px auto 8px;
                width: 132px;
                max-width: 72%;
                aspect-ratio: 1;
                background: rgba(128, 0, 0, 0.04);
                border-radius: 50%;
                border: 1px dashed rgba(128, 0, 0, 0.12);
                position: relative;
            }

            .qa-color-circle-container.expanded {
                display: block;
            }

            .qa-color-circle-container canvas {
                width: 100%;
                height: 100%;
                display: block;
            }

            .qa-palette-grid {
                display: grid;
                grid-template-columns: repeat(6, 1fr);
                gap: 3px;
            }

            .qa-color-button {
                width: 100%;
                aspect-ratio: 1;
                min-height: 18px;
                border-radius: 6px;
                border: 1px solid rgba(128, 0, 0, 0.22);
                cursor: pointer;
                padding: 0;
                transition: transform 0.12s ease, box-shadow 0.14s ease, border-color 0.14s ease;
                box-shadow: inset 0 0 0 1px rgba(255,255,255,0.32);
            }

            .qa-color-button:hover {
                transform: translateY(-1px);
                border-color: rgba(128, 0, 0, 0.44);
            }

            .qa-color-button.active {
                border-color: rgba(255, 140, 66, 0.95);
                box-shadow: 0 0 0 2px rgba(255, 140, 66, 0.24), inset 0 0 0 1px rgba(255,255,255,0.42);
            }

            .qa-color-button.editing:not(.active) {
                outline: 1px dashed rgba(128, 0, 0, 0.42);
                outline-offset: 1px;
            }

            /* ─── カラースロット サブポップアップ ─── */
            .qa-color-subpopup {
                position: absolute;
                top: calc(100% + 4px);
                left: 0;
                z-index: 100;
                background:
                    linear-gradient(180deg, rgba(255, 255, 238, 0.96), rgba(240, 224, 214, 0.92));
                border: 1px solid rgba(128, 0, 0, 0.28);
                border-radius: 10px;
                box-shadow: 0 8px 20px rgba(80, 32, 24, 0.22);
                padding: 8px;
                min-width: 120px;
                display: none;
            }

            .qa-color-subpopup.open {
                display: block;
            }

            .qa-color-subpopup-title {
                font-size: 9px;
                font-weight: 700;
                color: rgba(128, 0, 0, 0.54);
                letter-spacing: 0.06em;
                margin-bottom: 6px;
                text-align: center;
            }

            .qa-color-slot-item {
                display: flex;
                align-items: center;
                gap: 6px;
                width: 100%;
                padding: 4px 6px;
                border-radius: 7px;
                border: 1px solid transparent;
                background: transparent;
                cursor: pointer;
                text-align: left;
                font-size: 10px;
                font-weight: 700;
                color: var(--futaba-maroon);
                transition: background 0.12s ease, border-color 0.12s ease;
            }

            .qa-color-slot-item:hover {
                background: rgba(240, 224, 214, 0.78);
                border-color: rgba(128, 0, 0, 0.22);
            }

            .qa-color-slot-item.active {
                background: rgba(255, 245, 222, 0.92);
                border-color: rgba(255, 140, 66, 0.9);
            }

            .qa-color-slot-preview {
                display: flex;
                gap: 2px;
                flex-shrink: 0;
            }

            .qa-color-slot-preview-dot {
                width: 7px;
                height: 7px;
                border-radius: 2px;
                border: 1px solid rgba(128, 0, 0, 0.18);
            }

            .qa-color-slot-reset {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 100%;
                margin-top: 6px;
                padding: 4px 6px;
                border-radius: 7px;
                border: 1px solid rgba(128, 0, 0, 0.22);
                background: rgba(255, 255, 238, 0.64);
                cursor: pointer;
                font-size: 9px;
                font-weight: 700;
                color: rgba(128, 0, 0, 0.7);
                transition: background 0.12s ease, transform 0.12s ease;
            }

            .qa-color-slot-reset:hover {
                background: rgba(240, 224, 214, 0.84);
                transform: translateY(-1px);
            }

            /* ─── ツールボタン ─── */
            .qa-tool-grid {
                display: grid;
                grid-template-columns: repeat(5, 1fr);
                gap: 4px;
            }

            .qa-tool-button {
                width: 100%;
                height: 28px;
                border-radius: 8px;
                border: 1px solid rgba(128, 0, 0, 0.22);
                background: rgba(255, 255, 238, 0.62);
                cursor: pointer;
                transition: transform 0.12s ease, background 0.14s ease, border-color 0.14s ease, box-shadow 0.14s ease;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 0;
                color: var(--futaba-maroon);
            }

            .qa-tool-button svg {
                width: 16px;
                height: 16px;
                stroke: currentColor !important;
                pointer-events: none;
            }

            .qa-tool-button:hover {
                background: rgba(240, 224, 214, 0.84);
                border-color: rgba(128, 0, 0, 0.36);
                transform: translateY(-1px);
            }

            .qa-tool-button.active {
                border-color: rgba(255, 140, 66, 0.9);
                background: rgba(255, 245, 222, 0.92);
                box-shadow: 0 0 0 2px rgba(255, 140, 66, 0.22), inset 0 0 0 1px rgba(255, 255, 255, 0.62);
            }

            .qa-tool-button.erase-mode {
                border-style: dashed;
                background:
                    linear-gradient(135deg, rgba(255,255,255,0.62) 0 25%, rgba(184,112,107,0.2) 25% 50%, rgba(255,255,255,0.62) 50% 75%, rgba(184,112,107,0.2) 75% 100%);
                background-size: 10px 10px;
            }

            .qa-mini-toggle-btn {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 22px;
                height: 18px;
                padding: 0;
                border-radius: 4px;
                border: 1px solid rgba(128, 0, 0, 0.14);
                background: rgba(255, 255, 238, 0.42);
                color: var(--futaba-maroon);
                cursor: pointer;
                transition: all 0.14s ease;
                opacity: 0.6;
            }

            .qa-mini-toggle-btn svg {
                width: 12px;
                height: 12px;
                stroke-width: 1.8 !important;
            }

            .qa-mini-toggle-btn:hover {
                opacity: 1;
                background: rgba(240, 224, 214, 0.84);
                border-color: rgba(128, 0, 0, 0.28);
            }

            .qa-mini-toggle-btn.active {
                opacity: 1;
                background: rgba(255, 140, 66, 0.18);
                border-color: rgba(255, 140, 66, 0.6);
                color: #ff6600;
                box-shadow: 0 0 4px rgba(255, 140, 66, 0.2);
            }

            .qa-tool-text-icon {
                font-size: 13px;
                font-weight: 800;
                line-height: 1;
                color: currentColor;
                pointer-events: none;
            }

            /* ─── プリセットスロット ─── */
            .qa-preset-grid {
                display: grid;
                grid-template-columns: repeat(5, 1fr);
                gap: 4px;
                margin-top: 2px;
            }

            .qa-preset-slot {
                position: relative;
                height: 46px;
                border-radius: 8px;
                border: 1px solid rgba(128, 0, 0, 0.2);
                background: rgba(255, 255, 238, 0.54);
                cursor: pointer;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 2px;
                transition: transform 0.12s ease, border-color 0.14s ease, box-shadow 0.14s ease, background 0.14s ease;
                padding: 5px 2px 3px;
                overflow: hidden;
            }

            .qa-preset-slot:hover {
                transform: translateY(-1px);
                background: rgba(240, 224, 214, 0.78);
                border-color: rgba(128, 0, 0, 0.34);
            }

            .qa-preset-slot.active {
                border-color: rgba(255, 140, 66, 0.95);
                background: rgba(255, 245, 222, 0.92);
                box-shadow: 0 0 0 2px rgba(255, 140, 66, 0.2);
            }

            .qa-preset-ring {
                width: 20px;
                height: 20px;
                border-radius: 50%;
                border: 1.5px solid rgba(128, 0, 0, 0.44);
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(255, 255, 238, 0.54);
                flex-shrink: 0;
            }

            .qa-preset-dot {
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background: var(--futaba-maroon);
                opacity: 0.88;
                transform-origin: center;
                transition: width 0.16s ease, height 0.16s ease;
            }

            .qa-preset-values {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 0px;
                line-height: 1.1;
            }

            .qa-preset-size-val {
                font-size: 8.5px;
                font-weight: 700;
                color: rgba(128, 0, 0, 0.75);
                white-space: nowrap;
            }

            .qa-preset-opacity-val {
                font-size: 7.5px;
                font-weight: 600;
                color: rgba(128, 0, 0, 0.50);
                white-space: nowrap;
            }

            /* ─── スライダー ─── */
            .qa-slider-card {
                display: grid;
                gap: 4px;
                padding: 6px 8px;
                border-radius: 10px;
                border: 1px solid rgba(128, 0, 0, 0.14);
                background: rgba(255, 255, 238, 0.42);
            }

            .qa-slider-row {
                display: grid;
                grid-template-columns: 22px 1fr 22px;
                align-items: center;
                gap: 5px;
            }

            .qa-arrow-btn {
                width: 22px;
                height: 20px;
                border-radius: 7px;
                border: 1px solid rgba(128, 0, 0, 0.22);
                background: rgba(255, 255, 238, 0.64);
                color: var(--futaba-maroon);
                font-size: 10px;
                font-weight: 700;
                cursor: pointer;
                transition: background 0.14s ease, transform 0.12s ease;
                padding: 0;
            }

            .qa-arrow-btn:hover {
                background: rgba(240, 224, 214, 0.84);
                transform: translateY(-1px);
            }

            .qa-slider {
                position: relative;
                height: 12px;
                border-radius: 999px;
                background: rgba(128, 0, 0, 0.12);
                box-shadow: inset 0 1px 2px rgba(80, 32, 24, 0.14);
                cursor: pointer;
                touch-action: none;
            }

            .qa-slider-track {
                position: absolute;
                left: 0;
                top: 0;
                bottom: 0;
                width: 0%;
                border-radius: 999px;
                background: linear-gradient(90deg, rgba(207, 156, 151, 0.92), rgba(128, 0, 0, 0.72));
                pointer-events: none;
            }

            .qa-slider-handle {
                position: absolute;
                top: 50%;
                left: 0%;
                width: 13px;
                height: 13px;
                border-radius: 50%;
                transform: translate(-50%, -50%);
                border: 1px solid rgba(128, 0, 0, 0.48);
                background: rgba(255, 255, 238, 0.96);
                box-shadow: 0 2px 6px rgba(80, 32, 24, 0.22);
                cursor: grab;
                touch-action: none;
            }

            .qa-slider-handle:active {
                cursor: grabbing;
            }

            .qa-footer-hint {
                margin-top: 8px;
                font-size: 9px;
                line-height: 1.35;
                color: rgba(128, 0, 0, 0.5);
                text-align: center;
            }

            /* ─── カラースロットボタン親要素 (相対位置でサブポップアップを配置) ─── */
            .qa-color-slot-btn-wrapper {
                position: relative;
            }
        `;
        document.head.appendChild(style);
    }

    _ensurePanelExists() {
        this.panel = document.getElementById('quick-access-popup');

        if (!this.panel) {
            const popupRoot = document.body;
            if (!popupRoot) return;

            this.panel = document.createElement('div');
            this.panel.id = 'quick-access-popup';

            const savedPos = this._loadPosition();
            this.panel.style.left = `${savedPos.x}px`;
            this.panel.style.top = `${savedPos.y}px`;

            popupRoot.appendChild(this.panel);
        } else if (this.panel.parentElement !== document.body) {
            document.body.appendChild(this.panel);
        }

        this.panel.className = 'popup-panel popup-panel--translucent qa-popup';
        this.panel.style.touchAction = 'none';

        if (!this.panel.children.length) {
            this._populateContent();
        }
    }

    _populateContent() {
        if (!this.panel) return;

        // 現在のカラースロットの12色でパレットHTMLを生成
        const paletteHtml = this._buildPaletteHtml(this.activeColorSlotIndex);

        this.panel.innerHTML = `
            <button class="ui-close-button ui-close-button--medium qa-close quick-access-close-btn" id="quick-access-close-btn" title="閉じる" aria-label="閉じる" type="button">
                ${UI_ICONS.close}
            </button>

            <div class="qa-header" id="quick-access-drag-area">
                <div class="qa-header-title">
                    <span class="qa-header-main">Quick</span>
                    <span class="qa-header-sub">tool presets</span>
                </div>
            </div>

            <!-- 1. カラーパレット (カラースロット付き) -->
            <section class="qa-section" aria-label="色パレット">
                <div class="qa-palette-header-row">
                    <div class="qa-palette-header-left">
                        <div class="qa-section-label">COLOR</div>
                        <button class="qa-mini-toggle-btn" id="qa-color-circle-toggle-btn" title="カラーサークルを表示" type="button">
                            ${UI_ICONS.palette}
                        </button>
                        <button class="qa-eyedropper-btn" id="qa-eyedropper-btn" title="スポイト (I)" aria-label="スポイト" type="button">
                            ${UI_ICONS.eyedropper}
                        </button>
                        <div class="qa-color-swatches" id="qa-color-swatches" title="メイン/サブカラー (Xで入替)">
                            <div class="qa-swatch qa-swatch-sub" id="qa-swatch-sub"></div>
                            <div class="qa-swatch qa-swatch-main" id="qa-swatch-main"></div>
                        </div>
                        <span class="qa-current-color-dot" id="qa-current-color-dot" title="現在色" aria-label="現在色"></span>
                    </div>
                    <div class="qa-palette-header-right">
                        <div class="qa-color-slot-btn-wrapper">
                            <button class="qa-color-slot-btn" id="qa-color-slot-toggle-btn"
                                title="カラースロット切替" aria-label="カラースロット切替" type="button">
                                ${UI_ICONS.swatchBook || '<span style="font-size:11px;font-weight:700;">■</span>'}
                            </button>
                            <div class="qa-color-subpopup" id="qa-color-subpopup">
                                <div class="qa-color-subpopup-title">COLOR SLOTS</div>
                                ${Array.from({ length: QA_COLOR_SLOT_COUNT }, (_, i) => `
                                    <button class="qa-color-slot-item" data-slot-index="${i}" type="button">
                                        <span class="qa-color-slot-preview" id="qa-slot-preview-${i}"></span>
                                        <span>COLOR ${i + 1}</span>
                                    </button>
                                `).join('')}
                                <button class="qa-color-slot-reset" id="qa-color-slot-reset-btn" type="button">
                                    COLOR 1 を初期値に戻す
                                </button>
                            </div>
                        </div>
                        <div class="qa-section-value" id="qa-active-color-slot-label">COLOR 1</div>
                    </div>
                </div>
                <div id="qa-color-circle-container" class="qa-color-circle-container">
                    <canvas id="qa-color-circle-canvas" width="132" height="132"></canvas>
                </div>
                <div id="pen-color-palette" class="qa-palette-grid">
                    ${paletteHtml}
                </div>
            </section>

            <!-- 2. ツール選択 -->
            <section class="qa-section" aria-label="ツール">
                <div class="qa-section-label-row">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div class="qa-section-label">TOOL</div>
                        <button class="qa-mini-toggle-btn" id="qa-fill-ref-all-toggle" title="表示中レイヤーをすべて参照して塗りつぶす" type="button">
                            ${UI_ICONS.layers}
                        </button>
                    </div>
                    <div class="qa-section-value" id="qa-current-tool-label">pen</div>
                </div>
                <div class="qa-tool-grid">
                    <button class="qa-tool-button" id="qa-pen-tool" title="ペン" type="button" aria-label="ペン">
                        ${UI_ICONS.pen}
                    </button>
                    <button class="qa-tool-button" id="qa-eraser-tool" title="消しゴム" type="button" aria-label="消しゴム">
                        ${UI_ICONS.eraser}
                    </button>
                    <button class="qa-tool-button" id="qa-airbrush-tool" title="スプレー / 透明スプレー (B)" type="button" aria-label="スプレー / 透明スプレー">
                        ${UI_ICONS.airbrush || '<span class="qa-tool-text-icon">霧</span>'}
                    </button>
                    <button class="qa-tool-button" id="qa-fill-tool" title="塗りつぶし (G)" type="button" aria-label="塗りつぶし">
                        ${UI_ICONS.fill}
                    </button>
                    <button class="qa-tool-button" id="qa-lasso-fill-tool" title="投げ縄塗り (L)" type="button" aria-label="投げ縄塗り">
                        ${UI_ICONS.lasso || '<span class="qa-tool-text-icon">縄</span>'}
                    </button>
                </div>
            </section>

            <!-- 3. プリセットスロット -->
            <section class="qa-section" aria-label="プリセットスロット">
                <div class="qa-section-label-row">
                    <div class="qa-section-label">SLOTS</div>
                    <div class="qa-section-value" id="qa-preset-status">tool independent</div>
                </div>
                <div class="qa-preset-grid" id="qa-preset-grid">
                    ${Array.from({ length: QA_PRESET_SLOT_COUNT }, (_, index) => `
                        <button class="qa-preset-slot" data-slot="${index}" type="button" title="スロット${index + 1}">
                            <span class="qa-preset-ring">
                                <span class="qa-preset-dot"></span>
                            </span>
                            <span class="qa-preset-values">
                                <span class="qa-preset-size-val">-</span>
                                <span class="qa-preset-opacity-val">-</span>
                            </span>
                        </button>
                    `).join('')}
                </div>
            </section>

            <!-- 4. サイズ & 不透明度 スライダー -->
            <section class="qa-section qa-slider-card" aria-label="サイズ">
                <div class="qa-section-label-row">
                    <div class="qa-section-label">SIZE</div>
                    <div class="qa-section-value" id="pen-size-display">3.0px</div>
                </div>
                <div class="qa-slider-row">
                    <button class="qa-arrow-btn" id="pen-size-decrease" type="button" aria-label="サイズを小さく">◀</button>
                    <div class="qa-slider" id="pen-size-slider">
                        <div class="qa-slider-track" id="pen-size-track"></div>
                        <div class="qa-slider-handle" id="pen-size-handle"></div>
                    </div>
                    <button class="qa-arrow-btn" id="pen-size-increase" type="button" aria-label="サイズを大きく">▶</button>
                </div>
            </section>

            <section class="qa-section qa-slider-card" aria-label="不透明度">
                <div class="qa-section-label-row">
                    <div class="qa-section-label">OPACITY</div>
                    <div class="qa-section-value" id="pen-opacity-display">100%</div>
                </div>
                <div class="qa-slider-row">
                    <button class="qa-arrow-btn" id="pen-opacity-decrease" type="button" aria-label="不透明度を下げる">◀</button>
                    <div class="qa-slider" id="pen-opacity-slider">
                        <div class="qa-slider-track" id="pen-opacity-track"></div>
                        <div class="qa-slider-handle" id="pen-opacity-handle"></div>
                    </div>
                    <button class="qa-arrow-btn" id="pen-opacity-increase" type="button" aria-label="不透明度を上げる">▶</button>
                </div>
            </section>
        `;
    }

    _buildPaletteHtml(slotIndex) {
        const colors = this.colorSlots[slotIndex] || QA_DEFAULT_COLOR_SLOTS[0];
        return colors.map((value, index) => {
            const hex = this._colorToCss(value);
            const hexStr = value.toString(16).padStart(6, '0');
            return `
                <button
                    class="qa-color-button color-button"
                    data-color="0x${hexStr}"
                    data-color-index="${index}"
                    style="background: ${hex};"
                    title="#${hexStr}"
                    type="button"
                    aria-label="#${hexStr}"
                ></button>
            `;
        }).join('');
    }

    _cacheElements() {
        this.elements = {
            closeBtn: document.getElementById('quick-access-close-btn'),
            dragArea: document.getElementById('quick-access-drag-area'),
            currentToolLabel: document.getElementById('qa-current-tool-label'),
            presetStatus: document.getElementById('qa-preset-status'),
            presetGrid: document.getElementById('qa-preset-grid'),
            presetSlots: Array.from(this.panel?.querySelectorAll('.qa-preset-slot') || []),
            penToolBtn: document.getElementById('qa-pen-tool'),
            airbrushToolBtn: document.getElementById('qa-airbrush-tool'),
            eraserToolBtn: document.getElementById('qa-eraser-tool'),
            fillToolBtn: document.getElementById('qa-fill-tool'),
            lassoFillToolBtn: document.getElementById('qa-lasso-fill-tool'),
            fillRefAllToggleBtn: document.getElementById('qa-fill-ref-all-toggle'),
            sizeSlider: document.getElementById('pen-size-slider'),
            sizeTrack: document.getElementById('pen-size-track'),
            sizeHandle: document.getElementById('pen-size-handle'),
            sizeDisplay: document.getElementById('pen-size-display'),
            sizeDecrease: document.getElementById('pen-size-decrease'),
            sizeIncrease: document.getElementById('pen-size-increase'),
            opacitySlider: document.getElementById('pen-opacity-slider'),
            opacityTrack: document.getElementById('pen-opacity-track'),
            opacityHandle: document.getElementById('pen-opacity-handle'),
            opacityDisplay: document.getElementById('pen-opacity-display'),
            opacityDecrease: document.getElementById('pen-opacity-decrease'),
            opacityIncrease: document.getElementById('pen-opacity-increase'),
            colorPalette: document.getElementById('pen-color-palette'),
            colorSlotToggleBtn: document.getElementById('qa-color-slot-toggle-btn'),
            colorSubPopup: document.getElementById('qa-color-subpopup'),
            colorSlotItems: Array.from(this.panel?.querySelectorAll('.qa-color-slot-item') || []),
            colorSlotResetBtn: document.getElementById('qa-color-slot-reset-btn'),
            activeColorSlotLabel: document.getElementById('qa-active-color-slot-label'),
            eyedropperBtn: document.getElementById('qa-eyedropper-btn'),
            currentColorDot: document.getElementById('qa-current-color-dot'),
            swatchMain: document.getElementById('qa-swatch-main'),
            swatchSub: document.getElementById('qa-swatch-sub'),
            colorCircleToggleBtn: document.getElementById('qa-color-circle-toggle-btn'),
            colorCircleContainer: document.getElementById('qa-color-circle-container'),
            colorCircleCanvas: document.getElementById('qa-color-circle-canvas')
        };
    }

    initialize() {
        if (this.initialized) return;

        this.brushSettings = this.brushSettings || window.brushSettings;
        if (!this.brushSettings) {
            console.error('❌ QuickAccessPopup: Cannot initialize without BrushSettings');
            return;
        }

        this._cacheElements();
        this._setupCloseButton();
        this._setupToolButtons();
        this._setupPresetSlots();
        this._setupColorButtons();
        this._setupColorSlotUI();
        this._setupSliders();
        this._setupColorCircleHandlers();
        this._setupPanelDragHandlers();
        this._setupEventListeners();
        this._setupOutsideClickHandler();
        this._syncFromBrushSettings();
        this._updateUI();
        this._updateColorSlotPreviews();

        this.initialized = true;
    }

    _setupCloseButton() {
        if (!this.elements.closeBtn) return;

        const handleClose = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.hide();
        };

        this.elements.closeBtn.addEventListener('pointerdown', handleClose);
    }

    _setupToolButtons() {
        this._bindPointerAction(this.elements.penToolBtn, () => this._switchTool('pen'));
        this._bindPointerAction(this.elements.eraserToolBtn, () => this._switchTool('eraser'));

        this._bindPointerAction(this.elements.airbrushToolBtn, () => {
            const nextMode = this.currentTool === 'airbrush' ? 'airbrush-erase' : 'airbrush';
            this._switchTool(nextMode);
        });

        this._bindPointerAction(this.elements.fillToolBtn, () => {
            const nextMode = this.currentTool === 'fill' ? 'eraser-fill' : 'fill';
            this._switchTool(nextMode);
        });
        this._bindPointerAction(this.elements.lassoFillToolBtn, () => this._switchTool('lasso-fill'));
        this._bindPointerAction(this.elements.eyedropperBtn, () => this._switchTool('eyedropper'));

        this._bindPointerAction(this.elements.colorCircleToggleBtn, () => {
            this._toggleColorCircle();
        });

        this._bindPointerAction(this.elements.fillRefAllToggleBtn, () => {
            if (window.FillTool) {
                const nextValue = !window.FillTool.settings.referenceAllLayers;
                window.FillTool.settings.referenceAllLayers = nextValue;
                window.TegakiSettingsManager?.set?.('bucketReferenceAllLayers', nextValue);
                this._updateFillRefAllToggle();
            }
        });
    }

    _updateFillRefAllToggle() {
        if (!this.elements.fillRefAllToggleBtn || !window.FillTool) return;
        const isActive = window.FillTool.settings.referenceAllLayers;
        this.elements.fillRefAllToggleBtn.classList.toggle('active', isActive);
    }

    _toggleColorCircle() {
        if (!this.elements.colorCircleContainer || !this.elements.colorCircleToggleBtn) return;
        
        const isExpanded = this.elements.colorCircleContainer.classList.toggle('expanded');
        this.elements.colorCircleToggleBtn.classList.toggle('active', isExpanded);

        if (isExpanded) {
            this._drawColorCircle();
        }
    }

    _drawColorCircle() {
        const canvas = this.elements.colorCircleCanvas;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        const cx = w / 2;
        const cy = h / 2;
        const outerR = w / 2 - 2;
        const innerR = outerR - 12;

        ctx.clearRect(0, 0, w, h);

        // 1. Hue Ring
        for (let angle = 0; angle < 360; angle++) {
            const startAngle = (angle - 0.5) * Math.PI / 180;
            const endAngle = (angle + 1.5) * Math.PI / 180;
            ctx.beginPath();
            ctx.arc(cx, cy, (outerR + innerR) / 2, startAngle, endAngle);
            ctx.strokeStyle = `hsl(${angle}, 100%, 50%)`;
            ctx.lineWidth = outerR - innerR;
            ctx.stroke();
        }

        // 2. SV Area (Square)
        const currentHSV = this._rgbToHsv(this.brushSettings?.getColor() || 0);
        const hue = currentHSV.h;
        const side = (innerR - 2) * Math.sqrt(2);
        const x0 = cx - side / 2;
        const y0 = cy - side / 2;

        const imgData = ctx.createImageData(Math.floor(side), Math.floor(side));
        for (let y = 0; y < side; y++) {
            for (let x = 0; x < side; x++) {
                const s = x / side;
                const v = 1 - (y / side);
                const rgb = this._hsvToRgb(hue, s, v);
                const idx = (Math.floor(y) * Math.floor(side) + Math.floor(x)) * 4;
                imgData.data[idx] = rgb.r;
                imgData.data[idx + 1] = rgb.g;
                imgData.data[idx + 2] = rgb.b;
                imgData.data[idx + 3] = 255;
            }
        }
        ctx.putImageData(imgData, x0, y0);

        // 3. Indicators
        this._drawIndicators(ctx, cx, cy, outerR, innerR, side, currentHSV);
    }

    _drawIndicators(ctx, cx, cy, outerR, innerR, side, hsv) {
        // Hue indicator
        const angle = hsv.h * Math.PI / 180;
        const r = (outerR + innerR) / 2;
        const hx = cx + r * Math.cos(angle);
        const hy = cy + r * Math.sin(angle);

        ctx.beginPath();
        ctx.arc(hx, hy, 4, 0, Math.PI * 2);
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 1;
        ctx.stroke();

        // SV indicator
        const sx = cx - side / 2 + hsv.s * side;
        const sy = cy - side / 2 + (1 - hsv.v) * side;

        ctx.beginPath();
        ctx.arc(sx, sy, 4, 0, Math.PI * 2);
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    _setupColorCircleHandlers() {
        const canvas = this.elements.colorCircleCanvas;
        if (!canvas) return;

        const handlePointer = (e) => {
            if (e.buttons === 0 && e.type !== 'pointerdown') return;
            
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const w = canvas.width;
            const h = canvas.height;
            const cx = w / 2;
            const cy = h / 2;
            const outerR = w / 2 - 2;
            const innerR = outerR - 12;
            const side = (innerR - 2) * Math.sqrt(2);
            
            const dx = x - cx;
            const dy = y - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            const currentHSV = this._rgbToHsv(this.brushSettings?.getColor() || 0);
            
            // Hue Ring check
            if (dist >= innerR - 2 && dist <= outerR + 2) {
                let angle = Math.atan2(dy, dx) * 180 / Math.PI;
                if (angle < 0) angle += 360;
                const rgb = this._hsvToRgb(angle, currentHSV.s, currentHSV.v);
                const hex = (rgb.r << 16) | (rgb.g << 8) | rgb.b;
                this.brushSettings.setColor(hex);
            } 
            // SV Square check
            else {
                const x0 = cx - side / 2;
                const y0 = cy - side / 2;
                if (x >= x0 && x <= x0 + side && y >= y0 && y <= y0 + side) {
                    const s = Math.max(0, Math.min(1, (x - x0) / side));
                    const v = Math.max(0, Math.min(1, 1 - (y - y0) / side));
                    const rgb = this._hsvToRgb(currentHSV.h, s, v);
                    const hex = (rgb.r << 16) | (rgb.g << 8) | rgb.b;
                    this.brushSettings.setColor(hex);
                }
            }
        };

        canvas.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            canvas.setPointerCapture(e.pointerId);
            handlePointer(e);
        });

        canvas.addEventListener('pointermove', (e) => {
            if (canvas.hasPointerCapture(e.pointerId)) {
                e.preventDefault();
                e.stopPropagation();
                handlePointer(e);
            }
        });

        canvas.addEventListener('pointerup', (e) => {
            e.preventDefault();
            e.stopPropagation();
            canvas.releasePointerCapture(e.pointerId);
        });

        canvas.addEventListener('pointercancel', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (canvas.hasPointerCapture(e.pointerId)) {
                canvas.releasePointerCapture(e.pointerId);
            }
        });
    }

    _rgbToHsv(hex) {
        const r = ((hex >> 16) & 0xff) / 255;
        const g = ((hex >> 8) & 0xff) / 255;
        const b = (hex & 0xff) / 255;

        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, v = max;

        const d = max - min;
        s = max === 0 ? 0 : d / max;

        if (max === min) {
            h = 0;
        } else {
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }

        return { h: h * 360, s, v };
    }

    _hsvToRgb(h, s, v) {
        let r, g, b;
        const i = Math.floor(h / 60);
        const f = h / 60 - i;
        const p = v * (1 - s);
        const q = v * (1 - f * s);
        const t = v * (1 - (1 - f) * s);

        switch (i % 6) {
            case 0: r = v, g = t, b = p; break;
            case 1: r = q, g = v, b = p; break;
            case 2: r = p, g = v, b = t; break;
            case 3: r = p, g = q, b = v; break;
            case 4: r = t, g = p, b = v; break;
            case 5: r = v, g = p, b = q; break;
        }

        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255)
        };
    }

    _setupPresetSlots() {
        this.elements.presetSlots.forEach((slot) => {
            this._bindPointerAction(slot, () => {
                const index = Number(slot.dataset.slot);
                this._selectPresetSlot(index);
            });
        });
    }

    _setupColorButtons() {
        const colorButtons = this.panel?.querySelectorAll('.qa-color-button');
        if (!colorButtons) return;

        colorButtons.forEach((btn) => {
            this._bindPointerAction(btn, () => {
                const color = parseInt(btn.getAttribute('data-color'), 16);
                const colorIndex = Number(btn.getAttribute('data-color-index'));
                if (Number.isInteger(colorIndex)) {
                    this.activeColorIndex = Math.max(0, Math.min(11, colorIndex));
                }

                if (this.brushSettings?.setColor) {
                    this.brushSettings.setColor(color);
                }

                if (this.eventBus) {
                    this.eventBus.emit('brush:color-changed', { color });
                }

                this._updateColorButtons();
            });
        });

        this._bindPointerAction(this.elements.swatchSub, () => {
            this._swapMainSubColors();
        });
    }

    // ─── カラースロット UI ───────────────────────────────────────────
    _setupColorSlotUI() {
        const { colorSlotToggleBtn, colorSubPopup, colorSlotItems, colorSlotResetBtn } = this.elements;

        if (colorSlotToggleBtn) {
            colorSlotToggleBtn.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this._toggleColorSubPopup();
            });
        }

        colorSlotItems.forEach((item) => {
            item.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const idx = Number(item.getAttribute('data-slot-index'));
                this._switchColorSlot(idx);
                this._closeColorSubPopup();
            });
        });

        if (colorSlotResetBtn) {
            colorSlotResetBtn.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this._resetColorSlot1();
                this._closeColorSubPopup();
            });
        }

        this._updateColorSlotUI();
    }

    _toggleColorSubPopup() {
        if (this.isColorSubPopupOpen) {
            this._closeColorSubPopup();
        } else {
            this._openColorSubPopup();
        }
    }

    _openColorSubPopup() {
        this.isColorSubPopupOpen = true;
        if (this.elements.colorSubPopup) {
            this.elements.colorSubPopup.classList.add('open');
        }
        if (this.elements.colorSlotToggleBtn) {
            this.elements.colorSlotToggleBtn.classList.add('active');
        }
        this._updateColorSlotPreviews();
    }

    _closeColorSubPopup() {
        this.isColorSubPopupOpen = false;
        if (this.elements.colorSubPopup) {
            this.elements.colorSubPopup.classList.remove('open');
        }
        if (this.elements.colorSlotToggleBtn) {
            this.elements.colorSlotToggleBtn.classList.remove('active');
        }
    }

    _switchColorSlot(index) {
        const safeIndex = Math.max(0, Math.min(QA_COLOR_SLOT_COUNT - 1, index));
        this.activeColorSlotIndex = safeIndex;
        this._syncActiveColorIndexFromCurrentColor();

        // パレットを再描画
        if (this.elements.colorPalette) {
            this.elements.colorPalette.innerHTML = this._buildPaletteHtml(safeIndex);
            // 色ボタンのイベントを再バインド
            this._setupColorButtons();
        }

        this._updateColorSlotUI();
        this._updateColorButtons();
        this._saveColorSlots();
    }

    _resetColorSlot1() {
        this.colorSlots[0] = [...QA_DEFAULT_COLOR_SLOTS[0]];
        this._saveColorSlots();
        // COLOR 1 が現在選択中なら再描画
        if (this.activeColorSlotIndex === 0) {
            this._switchColorSlot(0);
        }
        this._updateColorSlotPreviews();
    }

    _updateColorSlotUI() {
        // アクティブスロットラベル更新
        if (this.elements.activeColorSlotLabel) {
            this.elements.activeColorSlotLabel.textContent = `COLOR ${this.activeColorSlotIndex + 1}`;
        }

        // サブポップアップ内のアクティブ状態更新
        this.elements.colorSlotItems.forEach((item, i) => {
            item.classList.toggle('active', i === this.activeColorSlotIndex);
        });
    }

    _updateColorSlotPreviews() {
        // サブポップアップ内の各スロットに小さいプレビューカラーを表示
        for (let i = 0; i < QA_COLOR_SLOT_COUNT; i++) {
            const previewEl = document.getElementById(`qa-slot-preview-${i}`);
            if (!previewEl) continue;

            const colors = this.colorSlots[i] || QA_DEFAULT_COLOR_SLOTS[i];
            // 先頭4色を表示
            previewEl.innerHTML = colors.slice(0, 4).map((c) => {
                const hex = this._colorToCss(c);
                return `<span class="qa-color-slot-preview-dot" style="background:${hex};"></span>`;
            }).join('');
        }
    }

    _setupOutsideClickHandler() {
        document.addEventListener('pointerdown', (e) => {
            if (!this.isColorSubPopupOpen) return;
            const subPopup = this.elements.colorSubPopup;
            const toggleBtn = this.elements.colorSlotToggleBtn;
            if (subPopup && !subPopup.contains(e.target) && toggleBtn && !toggleBtn.contains(e.target)) {
                this._closeColorSubPopup();
            }
        }, { capture: true, passive: true });
    }

    // ─── スライダー ───────────────────────────────────────────────────
    _setupSliders() {
        this.sliderMoveHandler = (e) => {
            if (this.isDraggingSize || this.isDraggingOpacity) {
                e.preventDefault();
                e.stopPropagation();
            }

            if (this.isDraggingSize) {
                const value = this._valueFromSliderEvent(e, this.elements.sizeSlider, this.MIN_SIZE, this.MAX_SIZE);
                this._updateSizeSlider(value, { persistPreset: true, emit: true });
            }

            if (this.isDraggingOpacity) {
                const value = this._valueFromSliderEvent(e, this.elements.opacitySlider, this.MIN_OPACITY, this.MAX_OPACITY);
                this._updateOpacitySlider(value, { persistPreset: true, emit: true });
            }
        };

        this.sliderUpHandler = (e) => {
            if (this.isDraggingSize || this.isDraggingOpacity) {
                if (this.activeSliderElement?.releasePointerCapture && this.activeSliderPointerId !== null) {
                    try {
                        this.activeSliderElement.releasePointerCapture(this.activeSliderPointerId);
                    } catch (err) {}
                }
            }

            this.isDraggingSize = false;
            this.isDraggingOpacity = false;
            this.activeSliderElement = null;
            this.activeSliderPointerId = null;
        };

        document.addEventListener('pointermove', this.sliderMoveHandler, { passive: false, capture: true });
        document.addEventListener('pointerup', this.sliderUpHandler, { capture: true });
        document.addEventListener('pointercancel', this.sliderUpHandler, { capture: true });

        this._bindSliderHandle(this.elements.sizeHandle, 'size');
        this._bindSliderHandle(this.elements.opacityHandle, 'opacity');

        this._bindPointerAction(this.elements.sizeSlider, (e) => {
            if (e.target === this.elements.sizeHandle) return;
            const value = this._valueFromSliderEvent(e, this.elements.sizeSlider, this.MIN_SIZE, this.MAX_SIZE);
            this._updateSizeSlider(value, { persistPreset: true, emit: true });
        });

        this._bindPointerAction(this.elements.opacitySlider, (e) => {
            if (e.target === this.elements.opacityHandle) return;
            const value = this._valueFromSliderEvent(e, this.elements.opacitySlider, this.MIN_OPACITY, this.MAX_OPACITY);
            this._updateOpacitySlider(value, { persistPreset: true, emit: true });
        });

        this._bindPointerAction(this.elements.sizeDecrease, () => {
            this._updateSizeSlider(this.currentSize - 0.5, { persistPreset: true, emit: true });
        });

        this._bindPointerAction(this.elements.sizeIncrease, () => {
            this._updateSizeSlider(this.currentSize + 0.5, { persistPreset: true, emit: true });
        });

        this._bindPointerAction(this.elements.opacityDecrease, () => {
            this._updateOpacitySlider(this.currentOpacity - 5, { persistPreset: true, emit: true });
        });

        this._bindPointerAction(this.elements.opacityIncrease, () => {
            this._updateOpacitySlider(this.currentOpacity + 5, { persistPreset: true, emit: true });
        });
    }

    _bindSliderHandle(handle, type) {
        if (!handle) return;

        handle.style.touchAction = 'none';
        handle.addEventListener('pointerdown', (e) => {
            if (type === 'size') {
                this.isDraggingSize = true;
            } else {
                this.isDraggingOpacity = true;
            }

            this.activeSliderElement = handle;
            this.activeSliderPointerId = e.pointerId;

            if (handle.setPointerCapture) {
                try {
                    handle.setPointerCapture(e.pointerId);
                } catch (err) {}
            }

            e.preventDefault();
            e.stopPropagation();
        });
    }

    _setupPanelDragHandlers() {
        if (!this.panel) return;

        this.panel.addEventListener('pointerdown', (e) => {
            const target = e.target;
            const isInteractive =
                target.closest('button') ||
                target.closest('.qa-slider') ||
                target.closest('.qa-preset-slot') ||
                target.closest('.qa-palette-grid') ||
                target.closest('.qa-color-circle-container');

            if (isInteractive) return;

            this.isDraggingPanel = true;
            this.activeDragPointerId = e.pointerId;

            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;

            const rect = this.panel.getBoundingClientRect();
            this.panelStartX = rect.left;
            this.panelStartY = rect.top;

            this.panel.style.cursor = 'grabbing';

            if (this.panel.setPointerCapture) {
                try {
                    this.panel.setPointerCapture(e.pointerId);
                } catch (err) {}
            }

            e.preventDefault();
        });

        this.dragMoveHandler = (e) => {
            if (!this.isDraggingPanel) return;

            e.preventDefault();
            e.stopPropagation();

            const deltaX = e.clientX - this.dragStartX;
            const deltaY = e.clientY - this.dragStartY;

            let newX = this.panelStartX + deltaX;
            let newY = this.panelStartY + deltaY;

            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const panelRect = this.panel.getBoundingClientRect();

            newX = Math.max(0, Math.min(newX, viewportWidth - panelRect.width));
            newY = Math.max(0, Math.min(newY, viewportHeight - panelRect.height));

            this.panel.style.left = `${newX}px`;
            this.panel.style.top = `${newY}px`;
        };

        this.dragUpHandler = () => {
            if (!this.isDraggingPanel) return;

            if (this.panel.releasePointerCapture && this.activeDragPointerId !== null) {
                try {
                    this.panel.releasePointerCapture(this.activeDragPointerId);
                } catch (err) {}
            }

            this.isDraggingPanel = false;
            this.activeDragPointerId = null;
            this.panel.style.cursor = 'default';

            const rect = this.panel.getBoundingClientRect();
            this._savePosition(rect.left, rect.top);
        };

        document.addEventListener('pointermove', this.dragMoveHandler, { passive: false, capture: true });
        document.addEventListener('pointerup', this.dragUpHandler, { capture: true });
        document.addEventListener('pointercancel', this.dragUpHandler, { capture: true });
    }

    _setupEventListeners() {
        if (!this.eventBus) return;

        this.eventBus.on('ui:sidebar:sync-tool', ({ tool }) => {
            this._setCurrentToolFromExternal(tool);
        });

        this.eventBus.on('tool:select', ({ tool }) => {
            this._setCurrentToolFromExternal(tool);
        });

        this.eventBus.on('brush:mode-changed', (payload = {}) => {
            const tool = payload.tool || payload.mode || payload.data?.tool || payload.data?.mode;
            if (tool) this._setCurrentToolFromExternal(tool);
        });

        this.eventBus.on('brush:size-changed', (payload = {}) => {
            const size = payload.size ?? payload.data?.size;
            if (typeof size !== 'number' || this.isDraggingSize) return;
            this._updateSizeSlider(size, { persistPreset: false, emit: false });
        });

        this.eventBus.on('brush:opacity-changed', (payload = {}) => {
            const opacity = payload.opacity ?? payload.data?.opacity;
            if (typeof opacity !== 'number' || this.isDraggingOpacity) return;
            this._updateOpacitySlider(opacity * 100, { persistPreset: false, emit: false });
        });

        this.eventBus.on('brush:color-changed', (event = {}) => {
            this._updateColorButtons();
            this._updateCurrentColorDot();
        });

        this.eventBus.on('color:swap-main-sub', () => {
            this._swapMainSubColors();
        });
    }

    _bindPointerAction(element, handler) {
        if (!element || typeof handler !== 'function') return;

        element.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handler(e);
        });
    }

    _switchTool(tool) {
        const normalizedTool = this._normalizeTool(tool);
        this.currentTool = normalizedTool;
        this._updateToolButtons();

        if (window.CoreRuntime?.api?.tool?.set) {
            window.CoreRuntime.api.tool.set(normalizedTool);
        }

        const presetKey = this._getPresetToolKey(normalizedTool);
        if (presetKey) {
            const slotIndex = this.activePresetSlots[presetKey] ?? 0;
            const preset = this.toolPresets[presetKey]?.[slotIndex];
            if (preset) {
                this._applyPreset(preset, { updateSlotIndex: slotIndex, emit: true });
            }
        }

        if (this.eventBus) {
            this.eventBus.emit('tool:changed', {
                tool: normalizedTool,
                component: 'quick-access',
                action: 'tool-changed'
            });
        }

        this._updateUI();
    }

    _setCurrentToolFromExternal(tool) {
        const normalizedTool = this._normalizeTool(tool);
        this.currentTool = normalizedTool;
        this._updateUI();
    }

    _normalizeTool(tool) {
        if (tool === 'airbrush-erase') return 'airbrush-erase';
        if (tool === 'airbrush' || tool === 'blur') return 'airbrush';
        if (tool === 'eraser') return 'eraser';
        if (tool === 'fill') return 'fill';
        if (tool === 'eraser-fill') return 'eraser-fill';
        if (tool === 'lasso-fill') return 'lasso-fill';
        if (tool === 'eyedropper') return 'eyedropper';
        return 'pen';
    }

    _getPresetToolKey(tool = this.currentTool) {
        if (tool === 'airbrush' || tool === 'airbrush-erase' || tool === 'blur') return 'airbrush';
        if (tool === 'pen') return 'pen';
        if (tool === 'eraser') return 'eraser';
        return null;
    }

    _selectPresetSlot(index) {
        if (!this.initialized) {
            this.initialize();
        }

        const presetKey = this._getPresetToolKey();
        if (!presetKey) return;

        const safeIndex = Math.max(0, Math.min(QA_PRESET_SLOT_COUNT - 1, Number(index) || 0));
        this.activePresetSlots[presetKey] = safeIndex;
        this._savePresets();

        const preset = this.toolPresets[presetKey][safeIndex];
        this._applyPreset(preset, { updateSlotIndex: safeIndex, emit: true });
        this._updatePresetSlots();
    }

    selectAdjacentPresetSlot(delta) {
        if (!this.initialized) {
            this.initialize();
        }

        const presetKey = this._getPresetToolKey();
        if (!presetKey) return false;

        const direction = Number(delta) < 0 ? -1 : 1;
        const currentIndex = this.activePresetSlots[presetKey] ?? 0;
        const nextIndex = (currentIndex + direction + QA_PRESET_SLOT_COUNT) % QA_PRESET_SLOT_COUNT;
        this._selectPresetSlot(nextIndex);
        return true;
    }

    _applyPreset(preset, options = {}) {
        if (!preset) return;

        if (typeof options.updateSlotIndex === 'number') {
            const presetKey = this._getPresetToolKey();
            if (presetKey) {
                this.activePresetSlots[presetKey] = options.updateSlotIndex;
            }
        }

        this._updateSizeSlider(preset.size, { persistPreset: false, emit: options.emit !== false });
        this._updateOpacitySlider(preset.opacity, { persistPreset: false, emit: options.emit !== false });
        this._savePresets();
    }

    _persistCurrentPreset() {
        const presetKey = this._getPresetToolKey();
        if (!presetKey) return;

        const slotIndex = this.activePresetSlots[presetKey] ?? 0;
        this.toolPresets[presetKey][slotIndex] = {
            size: this._roundSize(this.currentSize),
            opacity: Math.round(this.currentOpacity)
        };

        this._savePresets();
        this._updatePresetSlots();
    }

    _updateSizeSlider(value, options = {}) {
        const shouldEmit = options.emit !== false;
        const shouldPersistPreset = options.persistPreset === true;

        this.currentSize = this._clampSize(value);
        const percent = this._toPercent(this.currentSize, this.MIN_SIZE, this.MAX_SIZE);

        if (this.elements.sizeTrack) this.elements.sizeTrack.style.width = `${percent}%`;
        if (this.elements.sizeHandle) this.elements.sizeHandle.style.left = `${percent}%`;
        if (this.elements.sizeDisplay) this.elements.sizeDisplay.textContent = `${this.currentSize.toFixed(1)}px`;

        if (this.brushSettings?.setSize) {
            this.brushSettings.setSize(this.currentSize);
        }

        if (shouldEmit && this.eventBus) {
            this.eventBus.emit('brush:size-changed', { size: this.currentSize });
        }

        if (shouldPersistPreset) {
            this._persistCurrentPreset();
        }
    }

    _updateOpacitySlider(value, options = {}) {
        const shouldEmit = options.emit !== false;
        const shouldPersistPreset = options.persistPreset === true;

        this.currentOpacity = this._clampOpacity(value);
        const percent = this._toPercent(this.currentOpacity, this.MIN_OPACITY, this.MAX_OPACITY);

        if (this.elements.opacityTrack) this.elements.opacityTrack.style.width = `${percent}%`;
        if (this.elements.opacityHandle) this.elements.opacityHandle.style.left = `${percent}%`;
        if (this.elements.opacityDisplay) this.elements.opacityDisplay.textContent = `${Math.round(this.currentOpacity)}%`;

        if (this.brushSettings?.setOpacity) {
            this.brushSettings.setOpacity(this.currentOpacity / 100);
        }

        if (shouldEmit && this.eventBus) {
            this.eventBus.emit('brush:opacity-changed', { opacity: this.currentOpacity / 100 });
        }

        if (shouldPersistPreset) {
            this._persistCurrentPreset();
        }
    }

    _syncFromBrushSettings() {
        if (!this.brushSettings) return;

        if (this.brushSettings.getSize) {
            this.currentSize = this._clampSize(this.brushSettings.getSize());
        }

        if (this.brushSettings.getOpacity) {
            this.currentOpacity = this._clampOpacity(this.brushSettings.getOpacity() * 100);
        }

        if (this.brushSettings.getMode) {
            this.currentTool = this._normalizeTool(this.brushSettings.getMode());
        }
    }

    _updateUI() {
        if (!this.brushSettings) return;

        this._syncFromBrushSettings();

        this._updateSizeSlider(this.currentSize, { persistPreset: false, emit: false });
        this._updateOpacitySlider(this.currentOpacity, { persistPreset: false, emit: false });
        this._updateToolButtons();
        this._updatePresetSlots();
        this._updateColorButtons();
        this._updateCurrentColorDot();
        this._updateColorSlotUI();
        this._updateFillRefAllToggle();
    }

    _updateToolButtons() {
        const buttons = [
            this.elements.penToolBtn,
            this.elements.airbrushToolBtn,
            this.elements.eraserToolBtn,
            this.elements.fillToolBtn,
            this.elements.lassoFillToolBtn,
            this.elements.eyedropperBtn
        ];

        buttons.forEach((btn) => {
            if (!btn) return;
            btn.classList.remove('active', 'erase-mode');
        });

        const activeMap = {
            pen: this.elements.penToolBtn,
            airbrush: this.elements.airbrushToolBtn,
            'airbrush-erase': this.elements.airbrushToolBtn,
            eraser: this.elements.eraserToolBtn,
            fill: this.elements.fillToolBtn,
            'eraser-fill': this.elements.fillToolBtn,
            'lasso-fill': this.elements.lassoFillToolBtn,
            eyedropper: this.elements.eyedropperBtn
        };

        const activeBtn = activeMap[this.currentTool];
        if (activeBtn) {
            activeBtn.classList.add('active');
            if (this.currentTool === 'airbrush-erase' || this.currentTool === 'eraser-fill') {
                activeBtn.classList.add('erase-mode');
            }
        }

        if (this.elements.currentToolLabel) {
            const labels = {
                pen: 'pen',
                eraser: 'eraser',
                airbrush: 'airbrush',
                'airbrush-erase': 'airbrush erase',
                fill: 'fill',
                'eraser-fill': 'erase fill',
                'lasso-fill': 'lasso fill',
                eyedropper: 'eyedropper'
            };
            this.elements.currentToolLabel.textContent = labels[this.currentTool] || this.currentTool;
        }
    }

    _updatePresetSlots() {
        const presetKey = this._getPresetToolKey();
        const isPresetEnabled = Boolean(presetKey);
        const presetSlots = Array.isArray(this.elements?.presetSlots) ? this.elements.presetSlots : [];

        if (this.elements.presetStatus) {
            this.elements.presetStatus.textContent = isPresetEnabled ? `${presetKey} slots` : 'not used';
        }

        presetSlots.forEach((slot, index) => {
            slot.classList.toggle('active', isPresetEnabled && (this.activePresetSlots[presetKey] ?? 0) === index);
            slot.disabled = !isPresetEnabled;

            const dot = slot.querySelector('.qa-preset-dot');
            const sizeValEl = slot.querySelector('.qa-preset-size-val');
            const opacityValEl = slot.querySelector('.qa-preset-opacity-val');

            const preset = isPresetEnabled ? this.toolPresets[presetKey]?.[index] : null;
            const size = preset?.size ?? 0;
            const opacity = preset?.opacity ?? 100;
            const dotSize = this._dotSizeForBrushSize(size);

            // ドットサイズ更新 (色は常に --futaba-maroon / CSS側で固定済み)
            if (dot) {
                dot.style.width = `${dotSize}px`;
                dot.style.height = `${dotSize}px`;
                // 不透明度はスロットのdisabled状態のみ反映（描画色には連動しない）
                dot.style.opacity = isPresetEnabled ? '0.88' : '0.28';
            }

            // サイズ値と不透明度テキストを表示
            if (sizeValEl) {
                sizeValEl.textContent = preset ? `${this._roundSize(size)}` : '-';
            }
            if (opacityValEl) {
                opacityValEl.textContent = preset ? `${Math.round(opacity)}%` : '-';
            }

            if (preset) {
                slot.title = `スロット${index + 1}: ${this._roundSize(size)}px / ${Math.round(opacity)}%`;
            } else {
                slot.title = '塗りつぶしではサイズスロットを使用しません';
            }
        });
    }

    _updateColorButtons() {
        const colorButtons = this.panel?.querySelectorAll('.qa-color-button');
        if (!colorButtons || !this.brushSettings?.getColor) return;

        const currentColor = this.brushSettings.getColor();
        this._updateCurrentColorDot(currentColor);
        colorButtons.forEach((btn) => {
            const btnColor = parseInt(btn.getAttribute('data-color'), 16);
            const colorIndex = Number(btn.getAttribute('data-color-index'));
            const isCurrentColor = btnColor === currentColor;
            btn.classList.toggle('active', isCurrentColor);
            btn.classList.toggle('editing', colorIndex === this.activeColorIndex);
        });
    }

    _updateCurrentColorDot(color = null) {
        if (!this.elements?.currentColorDot || !this.brushSettings?.getColor) return;
        const currentColor = Number.isInteger(color) ? color : this.brushSettings.getColor();
        this.elements.currentColorDot.style.backgroundColor = `#${currentColor.toString(16).padStart(6, '0')}`;

        // メインカラーを同期
        this.mainColor = currentColor;
        if (this.elements.swatchMain) {
            this.elements.swatchMain.style.background = this._colorToCss(this.mainColor);
        }
        if (this.elements.swatchSub) {
            this.elements.swatchSub.style.background = this._colorToCss(this.subColor);
        }

        // カラーサークルが展開中なら再描画（インジケーター移動のため）
        if (this.elements.colorCircleContainer?.classList.contains('expanded')) {
            this._drawColorCircle();
        }
        
        this._saveMainSubColors();
    }

    _swapMainSubColors() {
        const oldMain = this.mainColor;
        this.mainColor = this.subColor;
        this.subColor = oldMain;

        if (this.brushSettings?.setColor) {
            this.brushSettings.setColor(this.mainColor);
        }

        this._updateUI();
        this._saveMainSubColors();

        if (this.eventBus) {
            this.eventBus.emit('brush:color-changed', { color: this.mainColor });
        }
    }

    _loadMainSubColors() {
        try {
            const saved = localStorage.getItem(QA_STORAGE_KEYS.mainSubColors);
            if (saved) {
                const parsed = JSON.parse(saved);
                return {
                    main: typeof parsed.main === 'number' ? parsed.main : QA_DEFAULT_MAIN_COLOR,
                    sub: typeof parsed.sub === 'number' && parsed.sub !== QA_LEGACY_SUB_COLOR
                        ? parsed.sub
                        : QA_DEFAULT_SUB_COLOR
                };
            }
        } catch (e) {}
        return { main: QA_DEFAULT_MAIN_COLOR, sub: QA_DEFAULT_SUB_COLOR };
    }

    _saveMainSubColors() {
        try {
            const data = { main: this.mainColor, sub: this.subColor };
            localStorage.setItem(QA_STORAGE_KEYS.mainSubColors, JSON.stringify(data));
        } catch (e) {}
    }

    _syncActiveColorIndexFromCurrentColor() {
        const colors = this.colorSlots[this.activeColorSlotIndex] || QA_DEFAULT_COLOR_SLOTS[0];
        const currentColor = this.brushSettings?.getColor?.();
        const foundIndex = colors.findIndex(color => color === currentColor);
        this.activeColorIndex = foundIndex >= 0 ? foundIndex : 0;
    }

    _storeColorInActivePalette(color) {
        if (!Number.isInteger(color)) return;

        const slotIndex = Math.max(0, Math.min(QA_COLOR_SLOT_COUNT - 1, this.activeColorSlotIndex));
        const colorIndex = Math.max(0, Math.min(11, this.activeColorIndex));
        const slots = this.colorSlots[slotIndex] || [...QA_DEFAULT_COLOR_SLOTS[slotIndex]];

        slots[colorIndex] = color & 0xffffff;
        this.colorSlots[slotIndex] = slots;
        this._saveColorSlots();

        if (this.elements.colorPalette) {
            this.elements.colorPalette.innerHTML = this._buildPaletteHtml(slotIndex);
            this._setupColorButtons();
        }

        this._updateColorButtons();
        this._updateColorSlotPreviews();
    }

    // ─── ユーティリティ ────────────────────────────────────────────────
    _valueFromSliderEvent(e, slider, min, max) {
        if (!slider) return min;
        const rect = slider.getBoundingClientRect();
        const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
        return min + ((max - min) * percent / 100);
    }

    _toPercent(value, min, max) {
        if (max <= min) return 0;
        return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
    }

    _dotSizeForBrushSize(size) {
        const clamped = Math.max(1, Math.min(50, Number(size) || 1));
        const normalized = Math.min(1, (clamped - 1) / 24);
        return Math.round(5 + normalized * 13);
    }

    _clampSize(value) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return this.MIN_SIZE;
        return Math.max(this.MIN_SIZE, Math.min(this.MAX_SIZE, numeric));
    }

    _clampOpacity(value) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return this.MAX_OPACITY;
        return Math.max(this.MIN_OPACITY, Math.min(this.MAX_OPACITY, numeric));
    }

    _roundSize(value) {
        return Math.round(Number(value) * 10) / 10;
    }

    _colorToCss(color) {
        return `#${Number(color).toString(16).padStart(6, '0')}`;
    }

    // ─── プリセット ロード/セーブ ──────────────────────────────────────
    _buildDefaultPresets() {
        const result = {};
        QA_PRESET_TOOLS.forEach((tool) => {
            result[tool] = QA_DEFAULT_PRESETS[tool].map((preset) => ({
                size: this._clampSize(preset.size),
                opacity: this._clampOpacity(preset.opacity)
            }));
        });
        return result;
    }

    _loadPresets() {
        const defaults = this._buildDefaultPresets();

        try {
            const saved = localStorage.getItem(QA_STORAGE_KEYS.presets);
            if (!saved) return defaults;

            const parsed = JSON.parse(saved);
            const result = this._buildDefaultPresets();

            QA_PRESET_TOOLS.forEach((tool) => {
                const savedSlots = Array.isArray(parsed?.presets?.[tool])
                    ? parsed.presets[tool]
                    : Array.isArray(parsed?.[tool])
                        ? parsed[tool]
                        : null;

                if (!savedSlots) return;

                for (let i = 0; i < QA_PRESET_SLOT_COUNT; i++) {
                    const slot = savedSlots[i];
                    if (!slot) continue;

                    result[tool][i] = {
                        size: this._clampSize(slot.size),
                        opacity: this._clampOpacity(slot.opacity)
                    };
                }
            });

            return result;
        } catch (error) {
            return defaults;
        }
    }

    _loadActivePresetSlots() {
        const fallback = { pen: 1, eraser: 0, airbrush: 0 };

        try {
            const saved = localStorage.getItem(QA_STORAGE_KEYS.presets);
            if (!saved) return fallback;

            const parsed = JSON.parse(saved);
            const slots = parsed?.activeSlots;
            if (!slots || typeof slots !== 'object') return fallback;

            return {
                pen: this._clampSlotIndex(slots.pen ?? fallback.pen),
                eraser: this._clampSlotIndex(slots.eraser ?? fallback.eraser),
                airbrush: this._clampSlotIndex(slots.airbrush ?? fallback.airbrush)
            };
        } catch (error) {
            return fallback;
        }
    }

    _savePresets() {
        try {
            localStorage.setItem(QA_STORAGE_KEYS.presets, JSON.stringify({
                version: 1,
                presets: this.toolPresets,
                activeSlots: this.activePresetSlots
            }));
        } catch (error) {}
    }

    _clampSlotIndex(index) {
        const numeric = Number(index);
        if (!Number.isFinite(numeric)) return 0;
        return Math.max(0, Math.min(QA_PRESET_SLOT_COUNT - 1, Math.round(numeric)));
    }

    // ─── カラースロット ロード/セーブ ─────────────────────────────────
    _loadColorSlots() {
        try {
            const saved = localStorage.getItem(QA_STORAGE_KEYS.colorSlots);
            if (!saved) return QA_DEFAULT_COLOR_SLOTS.map((s) => [...s]);

            const parsed = JSON.parse(saved);
            if (!Array.isArray(parsed) || parsed.length !== QA_COLOR_SLOT_COUNT) {
                return QA_DEFAULT_COLOR_SLOTS.map((s) => [...s]);
            }

            // 各スロットの色数を12に正規化
            return parsed.map((slot, i) => {
                if (!Array.isArray(slot) || slot.length !== 12) {
                    return [...QA_DEFAULT_COLOR_SLOTS[i]];
                }
                return slot.map((c) => Number(c) || 0);
            });
        } catch (error) {
            return QA_DEFAULT_COLOR_SLOTS.map((s) => [...s]);
        }
    }

    _saveColorSlots() {
        try {
            localStorage.setItem(QA_STORAGE_KEYS.colorSlots, JSON.stringify(this.colorSlots));
        } catch (error) {}
    }

    // ─── 位置 ロード/セーブ ────────────────────────────────────────────
    _savePosition(x, y) {
        try {
            localStorage.setItem(QA_STORAGE_KEYS.position, JSON.stringify({ x, y }));
        } catch (error) {}
    }

    _loadPosition() {
        try {
            const saved = localStorage.getItem(QA_STORAGE_KEYS.position);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Number.isFinite(parsed?.x) && Number.isFinite(parsed?.y)) {
                    return parsed;
                }
            }
        } catch (error) {}

        return { x: 70, y: 60 };
    }

    // ─── 公開API ──────────────────────────────────────────────────────
    show() {
        if (!this.panel) {
            this._ensurePanelExists();
        }

        if (!this.panel) return;

        this.panel.classList.add('show');
        this.isVisible = true;

        if (!this.initialized) {
            this.initialize();
        } else {
            this._updateUI();
        }

        if (this.eventBus) {
            this.eventBus.emit('popup:shown', { name: 'quickAccess' });
        }
    }

    hide() {
        if (!this.panel) return;

        this._closeColorSubPopup();
        this.panel.classList.remove('show');
        this.isVisible = false;

        if (this.eventBus) {
            this.eventBus.emit('popup:hidden', { name: 'quickAccess' });
        }
    }

    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    destroy() {
        if (this.sliderMoveHandler) {
            document.removeEventListener('pointermove', this.sliderMoveHandler);
            document.removeEventListener('pointerup', this.sliderUpHandler);
            document.removeEventListener('pointercancel', this.sliderUpHandler);
            this.sliderMoveHandler = null;
            this.sliderUpHandler = null;
        }

        if (this.dragMoveHandler) {
            document.removeEventListener('pointermove', this.dragMoveHandler);
            document.removeEventListener('pointerup', this.dragUpHandler);
            document.removeEventListener('pointercancel', this.dragUpHandler);
            this.dragMoveHandler = null;
            this.dragUpHandler = null;
        }

        this.elements = {};
        this.initialized = false;
        this.isDraggingSize = false;
        this.isDraggingOpacity = false;
        this.isDraggingPanel = false;
        this.isColorSubPopupOpen = false;
        this.activeSliderElement = null;
        this.activeSliderPointerId = null;
        this.activeDragPointerId = null;

        if (this.panel?.parentNode) {
            this.panel.parentNode.removeChild(this.panel);
        }

        this.panel = null;
        this.isVisible = false;
    }
}

// 下位互換性のためにグローバルに登録
window.QuickAccessPopup = QuickAccessPopup;
window.TegakiUI = window.TegakiUI || {};
window.TegakiUI.QuickAccessPopup = QuickAccessPopup;
