/**
 * ============================================================================
 * ファイル名: ui/lettering-popup.js
 * 責務: 漫画「文字」tabの編集session UI。文字/書体/装飾、配置線、9点envelopeと
 *       whole placementを編集し、previewをLetteringOverlayへ渡す。
 * 依存: lettering-model.js, lettering-vector-renderer.js, editable-curve-geometry.js,
 *   ui/lettering-overlay.js, ui/font-tree.js, ui/font-comparison.js,
 *   ui/popup-drag-helper.js, system/font-library.js, ui/manga-edit-actions.js, ui/lettering-size-slots.js
 * 被依存: core PopupManager / manga tab registration (lead-owned)
 * 公開API: LetteringPopup
 * 保存/History: layerAdapterへ委譲。Project/History/Raster実装を持たない。
 * GUI: 再編集/新規/取消/確定は固定上部。書式のサイズ6枠は既存UI prefsだけ。
 * グローバル登録: なし。mount時に新しいwindow APIを追加しない。
 * 実装状態: WP-025/027/028 UI slice
 * ============================================================================
 */

import { coordinateSystem } from '../coordinate-system.js';
import { cafMangaTarget, appendMangaRaster, restoreMangaTargetControls, syncMangaTargetControls } from './caf-manga-target.js';
import { MangaPanelTarget } from './manga-panel-target.js';
import { TegakiEventBus } from '../system/event-bus.js';
import {
    curveSegments,
    createCurvePreset,
    deleteCurveNode,
    letteringLocalToWorld,
    letteringWorldToLocal,
    nearestCurvePoint,
    moveCurveNode,
    snapEditorPoint,
    splitCurveAt
} from '../system/editable-curve-geometry.js';
import { defaultLetteringParams, normalizeLetteringParams } from '../system/lettering-model.js';
import { renderLettering as defaultRenderLettering } from '../system/lettering-vector-renderer.js';
import { FONT_SAMPLE_OPTIONS, fontLibrary, sortBundledFonts } from '../system/font-library.js';
import { FontComparison } from './font-comparison.js';
import { FontLibraryManagement } from './font-library-management.js';
import { FontTree } from './font-tree.js';
import { LetteringOverlay } from './lettering-overlay.js';
import { mountMangaTabs, noteMangaTabShown } from './manga-tabs.js';
import { mountMangaEditActions } from './manga-edit-actions.js';
import { LetteringSizeSlots } from './lettering-size-slots.js';
import { isMangaInputPrimary } from './manga-input-focus.js';
import { attachPopupDrag, mountPopupAtOverlayRoot } from './popup-drag-helper.js';
import { attachNumericField } from './numeric-field.js';
import { UI_ICONS } from './ui-icons.js';
import { segmentLetteringText, characterStyleAt, applyCharacterStyle, remapCharacterStyles } from '../system/lettering-character-styles.js';
import { resolveDirectionalTransformDragMode, applyDirectionalTransformDrag } from '../system/transform-math.js';

const POPUP_ID = 'lettering-popup';
const FONT_TREE_ID = 'lettering-font-tree';
const FONT_COMPARISON_ID = 'lettering-font-comparison';
const BUNDLED_PREFIX = 'letter-bundle:';
const IMPORTED_PREFIX = 'letter-imp:';
const MIN_SCALE = 0.05;
const MAX_SCALE = 20;
const DEFAULT_GRID = 16;
const UI_STORAGE_KEY = 'tegaki-lettering-ui-v1';
// Kept in sync with lettering-model.js MAX_NODES; the model remains the
// validation authority, while the UI explains this bounded edit failure.
const MAX_CURVE_NODES = 64;
const CURVE_KINDS = Object.freeze([
    ['none', 'なし'],
    ['straight', '直線'],
    ['arc', '半弧'],
    ['wave', '波'],
    ['ellipse', '楕円'],
    ['polyline', '折れ線'],
    ['free', '自由曲線']
]);
const ENVELOPE_KINDS = Object.freeze([
    ['none', 'なし'],
    ['skew', '平行四辺形'],
    ['perspective', '遠近'],
    ['arc', '弧'],
    ['wave', '波'],
    ['bulge', '膨らみ'],
    ['outward', '外へ膨らむ'],
    ['taper', '先細り'],
    ['points', '9点']
]);
const FIELD_SPECS = Object.freeze([
    { key: 'fontSize', label: '文字サイズ', min: 8, max: 512, step: 1, unit: 'px' },
    { key: 'endFontSize', label: '末尾サイズ', min: 0, max: 512, step: 1, unit: 'px' },
    { key: 'tracking', label: '字間', min: -64, max: 128, step: 1, unit: 'px' },
    { key: 'lineHeight', label: '行送り', min: 0.75, max: 3, step: 0.05, unit: '倍' },
    { key: 'strokeWidth', label: '第一フチ', min: 0, max: 32, step: 0.5, unit: 'px' },
    { key: 'outerStrokeWidth', label: '第二フチ', min: 0, max: 32, step: 0.5, unit: 'px' }
]);
const CHARACTER_FIELDS = Object.freeze([
    { key: 'size', label: 'サイズ', min: 0.125, max: 8, step: 0.025, unit: '倍' },
    { key: 'rotation', label: '回転', min: -360, max: 360, step: 1, unit: '°' },
    { key: 'offsetX', label: '線に沿う', min: -8192, max: 8192, step: 1, unit: 'px' },
    { key: 'offsetY', label: '線から離す', min: -8192, max: 8192, step: 1, unit: 'px' },
    { key: 'scaleX', label: '横拡縮', min: -20, max: 20, step: 0.05, unit: '倍' },
    { key: 'scaleY', label: '縦拡縮', min: -20, max: 20, step: 0.05, unit: '倍' }
]);
const CHARACTER_OUTLINES = Object.freeze([
    { label: '第一', width: 'strokeWidth', color: 'strokeColor' },
    { label: '第二', width: 'outerStrokeWidth', color: 'outerStrokeColor' }
]);
const PLACEMENT_FIELDS = Object.freeze([
    { key: 'x', label: 'X', min: -8192, max: 16384, step: 1, unit: 'px' },
    { key: 'y', label: 'Y', min: -8192, max: 16384, step: 1, unit: 'px' },
    { key: 'rotation', label: '回転', min: -360, max: 360, step: 1, unit: '°' },
    { key: 'scaleX', label: '横拡縮', min: -20, max: 20, step: 0.01, unit: '倍' },
    { key: 'scaleY', label: '縦拡縮', min: -20, max: 20, step: 0.01, unit: '倍' }
]);

function clone(value) {
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
}

function finite(value, fallback) {
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function point(value, fallback = { x: 0, y: 0 }) {
    if (!value || typeof value !== 'object') return { ...fallback };
    const x = Number(value.x ?? value.worldX ?? value.localX);
    const y = Number(value.y ?? value.worldY ?? value.localY);
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : { ...fallback };
}

function escapeText(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function sameValue(a, b) {
    try { return JSON.stringify(a) === JSON.stringify(b); } catch (error) { return false; }
}

function defaultNinePoints() {
    return Array.from({ length: 9 }, (_, index) => ({
        x: (index % 3) / 2,
        y: Math.floor(index / 3) / 2
    }));
}

export class LetteringPopup {
    constructor(dependencies = {}) {
        this.layerSystem = dependencies.layerSystem || null;
        this.layerAdapter = dependencies.layerAdapter || {};
        this.layerAdapter.cafTarget = () => cafMangaTarget(this.layerSystem);
        this.layerAdapter.cafAppend = (raster, name, token) => appendMangaRaster(this.layerSystem, raster, name, 'lettering', token);
        this.layerAdapter.normalTarget = () => this.panelTarget?.token();
        this.layerAdapter.normalAppend = (raster, options, token) => this.panelTarget.create(raster, options, 'lettering', token);
        this.eventBus = dependencies.eventBus || TegakiEventBus;
        this.fonts = dependencies.fontLibrary || fontLibrary;
        this.coordSystem = dependencies.coordinateSystem || coordinateSystem;
        this.renderLettering = dependencies.renderLettering || defaultRenderLettering;
        this.popup = null;
        this.elements = {};
        this.isVisible = false;
        this.popupDragCleanup = null;
        this.params = normalizeLetteringParams(defaultLetteringParams(this._canvasSize()), this._canvasSize());
        this.mode = 'whole';
        this.activeTab = 'whole';
        this.placementTarget = 'curve';
        this.characterSelection = null;
        this._fontTarget = 'whole';
        this._informationFontValue = '';
        this._transformInput = false;
        this._curveEntryInitialized = false;
        this._characterOutlineView = false;
        this._spacePressed = false;
        this.grid = { enabled: false, size: DEFAULT_GRID };
        this.snap = true;
        this.selectedNodeId = '';
        this.selectedEnvelopeIndex = -1;
        this.editing = null;
        this._sessionBaseline = clone(this.params);
        this._sessionUndo = [];
        this._paramsTouched = false;
        this._primaryApplied = false;
        this._fontData = { folders: [], fonts: [], bundled: [], organization: { folders: [], placements: {}, orders: {}, favoriteFirst: false } };
        this._fontTreeWarmTimer = null;
        this._fontTreeWarmToken = 0;
        this._fontRefreshToken = 0;
        this._fontPreviewToken = 0;
        this._fontPreviewTimer = null;
        this._fontPreviewRenderedId = '';
        this._fontPreviewRenderedSampleId = '';
        this._fontWheelRemainder = 0;
        this._previewTimer = null;
        this._previewGeneration = 0;
        this._paramsRevision = 0;
        this._previewSuspended = false;
        this._lastValid = null;
        this.drag = null;
        this._numericCleanups = [];
        this._commitBusy = false;
        this._resizeListener = () => this._fitViewport();
        window.addEventListener('resize', this._resizeListener);
        this._modifierDown = event => {
            if (event.code === 'Space' && !event.target?.closest?.('input,textarea,select,[contenteditable="true"]')) {
                this._spacePressed = true;
                this._endDrag({ cancel: true });
                this.overlay?.svg?.classList.add('is-camera');
            }
        };
        this._modifierUp = event => {
            if (event.code === 'Space') { this._spacePressed = false; this.overlay?.svg?.classList.remove('is-camera'); }
        };
        this._blurInput = () => { this._spacePressed = false; this._transformInput = false; this._endDrag({ cancel: true }); this.overlay?.svg?.classList.remove('is-camera'); };
        this._canvasWheel = event => {
            if (!this.isVisible || !isMangaInputPrimary('lettering') || !this._transformInput || this._spacePressed || event.ctrlKey || event.metaKey || event.altKey) return;
            if (!event.target?.closest?.('canvas,.lettering-overlay')) return;
            if (!Number.isFinite(event.deltaY) || !event.deltaY) return;
            event.preventDefault(); event.stopImmediatePropagation();
            this._transformDraft(event.shiftKey ? { rotation: Math.sign(event.deltaY) * 0.05 } : { scale: event.deltaY < 0 ? 1.05 : 0.95 });
        };
        window.addEventListener('keydown', this._modifierDown, true);
        window.addEventListener('keyup', this._modifierUp, true);
        window.addEventListener('blur', this._blurInput);
        window.addEventListener('wheel', this._canvasWheel, { capture: true, passive: false });

        this.overlay = new LetteringOverlay({
            eventBus: this.eventBus,
            coordSystem: this.coordSystem,
            onPointerDown: (target, event) => this._beginDrag(target, event),
            onDoubleClick: (target, event) => this._addCurvePointFromEvent(target, event),
            getState: () => {
                this._syncPreviewSource();
                return this.isVisible ? {
                params: this.params,
                result: this._lastValid?.result || null,
                previewVisible: !this._previewSuspended && (!this.editing?.layerId || this._paramsTouched),
                mode: this.mode,
                characterSelection: this.characterSelection,
                spacePressed: this._spacePressed,
                grid: this.grid,
                snap: this.snap,
                selectedNodeId: this.selectedNodeId,
                selectedEnvelopeIndex: this.selectedEnvelopeIndex
                } : null;
            }
        });

        this._layerListener = () => {
            if (this.isVisible) this._syncControls();
        };
        this.eventBus?.on?.('layer:activated', this._layerListener);
        this._sourceChanged = payload => {
            if (this.editing?.layerId && payload?.layerId === this.editing.layerId && !String(payload.source || '').startsWith('lettering-')) {
                this._paramsTouched = false;
                this.layerAdapter.endPreview();
            }
        };
        this._sourceHistory = payload => {
            if (['undo', 'redo', 'clear'].includes(payload?.action)) {
                this._paramsTouched = false;
                this.layerAdapter.endPreview();
            }
        };
        this.eventBus?.on?.('layer:content-changed', this._sourceChanged);
        this.eventBus?.on?.('history:changed', this._sourceHistory);
        this._offFonts = typeof this.fonts?.onChange === 'function'
            ? this.fonts.onChange(() => { void this._refreshFontData(); })
            : null;

        this._ensurePopupElement();
        void this._refreshFontData();
    }

    _canvasSize() {
        const canvas = this.layerSystem?.config?.canvas || globalThis.TEGAKI_CONFIG?.canvas || {};
        return {
            width: Math.max(1, Math.round(finite(canvas.width, 800))),
            height: Math.max(1, Math.round(finite(canvas.height, 800)))
        };
    }

    _ensurePopupElement() {
        let popup = document.getElementById(POPUP_ID);
        if (!popup) {
            popup = document.createElement('div');
            popup.id = POPUP_ID;
            popup.className = 'popup-panel popup-panel--translucent ui-scrollbar lettering-popup';
            popup.style.left = '72px';
            popup.style.top = '72px';
            popup.tabIndex = -1;
            (document.querySelector('.main-layout') || document.body).appendChild(popup);
        } else {
            mountPopupAtOverlayRoot(popup);
            popup.classList.add('lettering-popup');
            popup.tabIndex = -1;
        }
        this.popup = popup;
        this._build();
        this.popupDragCleanup = attachPopupDrag(popup, {
            interactiveSelector: 'button, input, select, textarea, a, canvas, summary, .pl-value, .pl-font-tree, .pl-font-comparison, .popup-close-btn, .ui-close-button',
            onDragEnd: () => this.overlay.schedule()
        });
    }

    _build() {
        const curveOptions = CURVE_KINDS.map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
        const envelopeOptions = ENVELOPE_KINDS.map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
        const field = (spec) => `
            <label class="lettering-popup__field" data-field-row="${spec.key}">
                <span class="pl-label">${spec.label}</span>
                <input type="range" class="pl-range" data-field="${spec.key}" min="${spec.min}" max="${spec.max}" step="${spec.step}">
                <input type="number" class="pl-text lettering-popup__field-number" data-field-number="${spec.key}" min="${spec.min}" max="${spec.max}" step="${spec.step}" aria-label="${spec.label}">
                <span class="pl-unit">${spec.unit}</span>
            </label>`;
        const placement = (spec) => `
            <label class="lettering-popup__placement-field">
                <span>${spec.label}</span>
                <input type="number" class="pl-text" data-placement="${spec.key}" min="${spec.min}" max="${spec.max}" step="${spec.step}" aria-label="配置 ${spec.label}">
                <small>${spec.unit}</small>
            </label>`;
        const close = `<button class="ui-close-button ui-close-button--medium popup-close-btn" data-action="close" type="button" aria-label="文字popupを閉じる">×</button>`;
        this.popup.innerHTML = `
            ${close}
            <div class="manga-tabs-host" data-role="manga-tabs"></div>
            <div class="pl-title"><span class="pl-edit-status" data-role="edit-status"></span></div>
            <div class="lettering-popup__mode" role="group" aria-label="文字の編集対象">
                <button type="button" class="pl-chip pl-chip--wide is-selected" data-mode="whole" aria-pressed="true">書式</button>
                <button type="button" class="pl-chip pl-chip--wide" data-mode="curve" aria-pressed="false">配置</button>
                <button type="button" class="pl-chip pl-chip--wide" data-mode="envelope" aria-pressed="false">変形</button>
                <button type="button" class="pl-chip pl-chip--wide" data-mode="characters" aria-pressed="false">文字別</button>
            </div>
            <textarea class="pl-textarea lettering-popup__text" data-role="text" rows="2" maxlength="2000" placeholder="タイトル / 擬音" aria-label="文字"></textarea>
            <div class="pl-row">
                <span class="pl-label">書き方</span>
                <span class="pl-chips">
                    <button type="button" class="pl-chip pl-chip--wide" data-vertical="false" aria-pressed="true">横書き</button>
                    <button type="button" class="pl-chip pl-chip--wide" data-vertical="true" aria-pressed="false">縦書き</button>
                    <button type="button" class="pl-chip" data-role="bold" aria-pressed="false" title="太字">B</button>
                </span>
            </div>
            <div class="pl-row pl-font-picker-row">
                <span class="pl-label">フォント</span>
                <div class="pl-font-picker lettering-popup__font-picker">
                    <select class="pl-select pl-font-select-native" data-role="font-select" aria-hidden="true" tabindex="-1"></select>
                    <button type="button" class="pl-select pl-font-trigger" data-role="font-trigger" aria-haspopup="tree" aria-expanded="false" aria-controls="${FONT_TREE_ID}">フォントを選ぶ</button>
                    <div class="pl-font-tree" id="${FONT_TREE_ID}" data-role="font-tree" hidden></div>
                </div>
                <button type="button" class="pl-btn pl-btn--small pl-font-compare-toggle" data-role="font-comparison-toggle" aria-expanded="false" aria-controls="${FONT_COMPARISON_ID}" aria-label="書体の比較・情報・整理を開く" title="書体の比較・情報・整理を開く">書体</button>
            </div>
            <section class="pl-font-comparison" id="${FONT_COMPARISON_ID}" data-role="font-comparison" hidden></section>
            <details class="pl-details pl-font-card" data-role="font-card">
                <summary>フォント情報・整理</summary>
                <div class="pl-fm">
                    <div class="pl-font-card__heading"><strong data-role="font-title"></strong><span data-role="font-category"></span></div>
                    <div class="pl-font-card__comment" data-role="font-comment-text"></div>
                    <div class="pl-font-card__meta" data-role="font-meta"></div>
                    <div class="pl-font-card__sample">
                        <label class="pl-label" for="lettering-font-sample">見本</label>
                        <select id="lettering-font-sample" class="pl-select pl-select--small" data-role="font-sample" aria-label="フォント見本"></select>
                        <span class="pl-font-load-status" data-role="font-load-status" aria-live="polite"></span>
                        <div class="pl-font-sample" data-role="font-sample-preview" aria-live="polite"></div>
                    </div>
                    <label class="pl-row pl-check"><input type="checkbox" data-role="font-favorite"><span>お気に入り</span></label>
                    <button type="button" class="pl-btn pl-font-primary" data-action="font-primary">Primaryにする</button>
                    <div class="pl-row pl-font-placement"><span class="pl-label">収納先</span><select class="pl-select" data-role="font-storage" aria-label="表示分類の収納先"></select></div>
                    <div class="pl-row"><button type="button" class="pl-btn" data-action="font-up">↑</button><button type="button" class="pl-btn" data-action="font-down">↓</button><label class="pl-check"><input type="checkbox" data-role="font-favorite-first">お気に入りを上へ</label></div>
                    <label class="pl-row"><span>自分用メモ</span><input class="pl-text" data-role="font-note" maxlength="240" placeholder="短いメモ"></label>
                    <div class="pl-row" data-role="font-links"></div>
                </div>
            </details>
            <div class="pl-sep"></div>
            <div class="lettering-popup__field-grid">${FIELD_SPECS.map(field).join('')}</div>
            <div class="pl-row">
                <span class="pl-label">文字色 / 縁</span>
                <input type="color" class="pl-color" data-color="color" title="文字の色" aria-label="文字の色">
                <input type="color" class="pl-color" data-color="strokeColor" title="縁取りの色" aria-label="縁取りの色">
                <input type="color" class="pl-color" data-color="outerStrokeColor" title="第二フチ取りの色" aria-label="第二フチ取りの色">
            </div>
            <details class="pl-details lettering-popup__placement-details" data-role="placement-details">
                <summary>配置・回転・拡縮</summary>
                <div class="lettering-popup__placement-grid">${PLACEMENT_FIELDS.map(placement).join('')}</div>
            </details>
            <details class="pl-details" data-role="curve-details">
                <summary>配置線</summary>
                <div class="pl-row"><span class="pl-label">形</span><select class="pl-select" data-role="curve-preset" aria-label="配置線プリセット">${curveOptions}</select></div>
                <div class="pl-actions lettering-popup__curve-actions"><button type="button" class="pl-btn" data-action="curve-add">点を追加</button><button type="button" class="pl-btn" data-action="curve-delete">選択点を削除</button><button type="button" class="pl-btn" data-action="curve-smooth">角 / なめらか</button></div>
            </details>
            <details class="pl-details" data-role="envelope-details">
                <summary>少点変形</summary>
                <div class="pl-row"><span class="pl-label">形</span><select class="pl-select" data-role="envelope-preset" aria-label="文字変形プリセット">${envelopeOptions}</select></div>
                <label class="lettering-popup__field" data-role="envelope-strength"><span class="pl-label">強さ</span><input type="range" class="pl-range" data-envelope-amount min="-1" max="1" step="0.01"><input type="number" class="pl-text lettering-popup__field-number" data-envelope-amount-number min="-1" max="1" step="0.01" aria-label="変形の強さ"></label>
                <div class="pl-hint" data-role="envelope-hint">キャンバスの点を動かして調整できます</div>
            </details>
            <div class="lettering-popup__editor-options">
                <label class="pl-check"><input type="checkbox" data-role="grid-enabled"><span>局所grid</span></label>
                <label class="lettering-popup__grid-size"><span>間隔</span><input type="number" class="pl-text" data-role="grid-size" min="1" max="512" step="1" value="${DEFAULT_GRID}">px</label>
                <label class="pl-check"><input type="checkbox" data-role="snap" checked><span>点snap</span></label>
            </div>
            <div class="lettering-popup__status" data-role="error-status" data-state="idle" aria-live="polite"></div>
            <div class="pl-footer">
                <button type="button" class="pl-btn" data-action="load-active" title="選択中の文字レイヤーの文章・書体・配置線・変形を再編集">選択レイヤーを編集</button>
                <button type="button" class="pl-btn" data-action="new">新規</button>
                <button type="button" class="pl-btn" data-action="cancel">取消</button>
            </div>
            <div class="pl-footer">
                <button type="button" class="pl-btn pl-btn--primary" data-action="apply">追加</button>
                <button type="button" class="pl-btn pl-btn--primary" data-action="update" hidden>更新</button>
            </div>
            <p class="pl-hint lettering-popup__shortcut">Ctrl+Enter: 確定して閉じる / Ctrl+Z: 編集を戻す</p>`;

        // Reuse the existing controls and selectors, while making scrolling a
        // property of the contextual body, never of the commit controls.
        const root = this.popup;
        const common = document.createElement('div');
        common.className = 'lettering-popup__common';
        const fontRow = root.querySelector('.pl-font-picker-row');
        const writingRow = root.querySelector('[data-vertical]').closest('.pl-row');
        const colorRow = root.querySelector('[data-color]').closest('.pl-row');
        common.append(root.querySelector('[data-role="text"]'), fontRow,
            root.querySelector('[data-field-row="fontSize"]'), writingRow);
        const fillColor = root.querySelector('[data-color="color"]');
        fillColor.title = '文字色';
        writingRow.append(fillColor);
        colorRow.querySelector('.pl-label').textContent = '縁の色';
        const mode = root.querySelector('.lettering-popup__mode');
        root.insertBefore(common, mode);

        const body = document.createElement('div');
        body.className = 'lettering-popup__body ui-scrollbar';
        const panels = ['whole', 'curve', 'envelope', 'characters'].map(id => {
            const panel = document.createElement('section');
            panel.dataset.modePanel = id;
            panel.className = 'lettering-popup__context';
            panel.setAttribute('aria-label', { whole: '書式の設定', curve: '配置の設定', envelope: '変形の設定', characters: '文字別の設定' }[id]);
            body.append(panel);
            return panel;
        });
        panels[0].append(root.querySelector('.lettering-popup__field-grid'), colorRow);
        const sizeSlotsHost = document.createElement('div');
        sizeSlotsHost.className = 'lettering-size-slots';
        panels[0].prepend(sizeSlotsHost);
        this.sizeSlots = new LetteringSizeSlots({ host: sizeSlotsHost, storageKey: UI_STORAGE_KEY,
            onSelect: fontSize => this._setParams({ ...this.params, fontSize }) });
        colorRow.querySelector('.pl-label').textContent = '第一 / 第二フチの色';
        const placementTarget = document.createElement('div');
        placementTarget.className = 'pl-row lettering-popup__placement-targets';
        placementTarget.setAttribute('role', 'group');
        placementTarget.setAttribute('aria-label', '配置の操作対象と配置線の形');
        placementTarget.innerHTML = '<button type="button" class="pl-chip" data-placement-target="whole" title="文字全体の配置・回転・拡縮">全体</button><button type="button" class="pl-chip" data-placement-target="curve" title="配置線の点を編集">配置線</button><label class="lettering-popup__curve-shape"><span>形</span></label>';
        placementTarget.querySelector('label').append(root.querySelector('[data-role="curve-preset"]'));
        const curveActions = root.querySelector('.lettering-popup__curve-actions');
        const iconButton = (action, icon, title) => `<button type="button" class="pl-btn lettering-popup__icon-button" data-action="${action}" title="${title}" aria-label="${title}">${UI_ICONS[icon]}</button>`;
        curveActions.innerHTML = `<span class="pl-label">選択点</span>${iconButton('curve-add', 'plus', '配置線に点を追加')}${iconButton('curve-delete', 'trash', '選択点を削除')}${iconButton('curve-smooth', 'curveSmooth', '選択点を滑らかにする')}`;
        const spacing = document.createElement('div');
        spacing.className = 'lettering-popup__spacing-grid';
        for (const key of ['tracking', 'lineHeight']) {
            const row = panels[0].querySelector(`[data-field-row="${key}"]`);
            // Retain range as the existing numeric adapter's canonical input,
            // but expose the small wheel-enabled number instead of a slider.
            row.querySelector('input[type="range"]').hidden = true;
            spacing.append(row);
        }
        panels[1].append(placementTarget, curveActions, spacing, root.querySelector('[data-role="placement-details"]'));
        root.querySelector('[data-role="curve-details"]').remove();
        const unwrapDetails = (role, panel) => {
            const details = root.querySelector(`[data-role="${role}"]`);
            details.querySelector('summary').remove();
            while (details.firstChild) panel.append(details.firstChild);
            details.remove();
        };
        unwrapDetails('envelope-details', panels[2]);
        const sizeTitle = document.createElement('div');
        sizeTitle.className = 'lettering-popup__section-title';
        sizeTitle.textContent = 'サイズ変化';
        panels[2].append(sizeTitle, panels[0].querySelector('[data-field-row="endFontSize"]'));
        const sizeHint = document.createElement('p');
        sizeHint.className = 'pl-hint';
        sizeHint.textContent = '先頭は基本サイズ → 末尾。0で均一に戻します。';
        panels[2].append(sizeHint);
        const profile = document.createElement('div');
        profile.innerHTML = `<label class="pl-row"><span class="pl-label">変化</span><select class="pl-select" data-role="size-profile"><option value="legacy">従来の末尾サイズ</option><option value="uniform">均一</option><option value="ends">先頭 → 末尾</option><option value="three">先頭 → 中央 → 末尾</option></select></label><div class="lettering-popup__profile-values">${[['start','先頭'],['mid','中央'],['end','末尾']].map(([key,label]) => `<label class="pl-row" data-profile-row="${key}"><span>${label}</span><input type="number" class="pl-text" data-profile="${key}" min="0.125" max="8" step="0.025" aria-label="${label}サイズ倍率"><span>倍</span><output data-profile-px="${key}"></output></label>`).join('')}</div>`;
        panels[2].append(profile);
        sizeHint.dataset.role = 'legacy-size-hint';
        panels[3].innerHTML = `
            <div class="lettering-popup__character-selection" data-role="character-status" aria-live="polite">キャンバスか下の文字を選択</div>
            <div class="lettering-popup__character-strip" data-role="character-strip" role="group" aria-label="文字の選択"></div>
            <div data-role="character-inspector">
                <div class="pl-row lettering-popup__character-appearance">
                    <span class="pl-label">書体</span><button type="button" class="pl-btn" data-action="character-font" title="選択文字の書体を比較・変更">標準を継承</button>
                    ${iconButton('character-font-clear', 'rotateCcw', '選択文字の書体指定を解除')}
                    <input type="color" class="pl-color" data-role="character-color" title="選択文字の色" aria-label="選択文字の色">
                    ${iconButton('character-color-clear', 'rotateCcw', '選択文字の色を標準に戻す')}
                    <button type="button" class="pl-chip" data-action="character-outlines" aria-pressed="false" aria-controls="lettering-character-outlines" title="数値領域を第一・第二フチの設定に切り替え">フチ</button>
                </div>
                <div class="lettering-popup__character-grid">${CHARACTER_FIELDS.map(spec => `<label class="lettering-popup__character-field"><span title="${spec.label}">${spec.label}</span><input type="number" class="pl-text" data-character="${spec.key}" min="${spec.min}" max="${spec.max}" step="${spec.step}" aria-label="選択文字 ${spec.label}"><span>${spec.unit}</span></label>`).join('')}</div>
                <div class="pl-row lettering-popup__character-warp"><span class="pl-label">局所変形</span><select class="pl-select" data-role="character-envelope" aria-label="選択文字の局所変形">${envelopeOptions.replace('<option value="outward">外へ膨らむ</option>','').replace('<option value="points">9点</option>','')}</select><input type="number" class="pl-text" data-role="character-envelope-amount" min="-1" max="1" step="0.01" title="選択文字の変形の強さ" aria-label="選択文字の変形の強さ"></div>
                <div class="pl-actions lettering-popup__character-actions">${iconButton('character-reset', 'rotateCcw', '個別指定を全て解除')}${iconButton('character-flip-horizontal', 'flipHorizontal', '選択文字を水平反転')}${iconButton('character-flip-vertical', 'flipVertical', '選択文字を垂直反転')}</div>
            </div>`;
        const selectionTools = document.createElement('div');
        selectionTools.className = 'lettering-popup__character-selection-tools';
        const strip = panels[3].querySelector('[data-role="character-strip"]');
        strip.before(selectionTools);
        selectionTools.append(strip, panels[3].querySelector('.lettering-popup__character-actions'));
        const geometry = document.createElement('div');
        geometry.dataset.role = 'character-geometry';
        const characterGrid = panels[3].querySelector('.lettering-popup__character-grid');
        characterGrid.before(geometry);
        geometry.append(characterGrid, panels[3].querySelector('.lettering-popup__character-warp'));
        const outlines = document.createElement('div');
        outlines.id = 'lettering-character-outlines';
        outlines.dataset.role = 'character-outlines';
        outlines.hidden = true;
        outlines.setAttribute('role', 'group');
        outlines.setAttribute('aria-label', '選択文字のフチ');
        outlines.innerHTML = CHARACTER_OUTLINES.map(spec => `<div class="lettering-popup__character-outline-row"><span>${spec.label}</span><select class="pl-select" data-character-outline-mode="${spec.width}" aria-label="選択文字 ${spec.label}フチの設定"><option value="inherit">標準</option><option value="off">なし</option><option value="custom">個別</option></select><input type="number" class="pl-text" data-character-outline-width="${spec.width}" min="0" max="64" step="0.5" aria-label="選択文字 ${spec.label}フチの${spec.width === 'strokeWidth' ? '太さ' : '追加厚さ'}" title="${spec.label}フチの${spec.width === 'strokeWidth' ? '太さ' : '外側に追加する厚さ'}"><span class="pl-unit">px</span><input type="color" class="pl-color" data-character-outline-color="${spec.color}" aria-label="選択文字 ${spec.label}フチの色" title="${spec.label}フチの色"></div>`).join('') + '<p class="pl-hint lettering-popup__outline-hint">標準を継承／なし／個別の太さ・色。<br>第二は第一の外側に追加する厚さです。</p>';
        geometry.after(outlines);
        body.append(root.querySelector('.lettering-popup__editor-options'));
        mode.after(body);
        root.querySelectorAll(':scope > .pl-sep').forEach(el => el.remove());
        const footer = document.createElement('div');
        footer.className = 'lettering-popup__commit';
        footer.append(root.querySelector('[data-role="error-status"]'));
        root.querySelectorAll(':scope > .pl-footer, :scope > .lettering-popup__shortcut').forEach(el => footer.append(el));
        root.append(footer);

        this.actions = mountMangaEditActions(root, { before: common, resetAction: 'new', error: root.querySelector('[data-role="error-status"]') });
        this.panelTarget = new MangaPanelTarget({ root, layerSystem: this.layerSystem, history: this.layerAdapter.history });
        this.actions.classList.add('lettering-popup__commit');

        const q = (selector) => this.popup.querySelector(selector);
        this.elements = {
            editStatus: q('[data-role="edit-status"]'),
            text: q('[data-role="text"]'),
            fontSelect: q('[data-role="font-select"]'),
            fontTrigger: q('[data-role="font-trigger"]'),
            fontTree: q('[data-role="font-tree"]'),
            fontComparisonToggle: q('[data-role="font-comparison-toggle"]'),
            fontComparison: q('[data-role="font-comparison"]'),
            fontCard: q('[data-role="font-card"]'),
            fontTitle: q('[data-role="font-title"]'),
            fontCategory: q('[data-role="font-category"]'),
            fontCommentText: q('[data-role="font-comment-text"]'),
            fontMeta: q('[data-role="font-meta"]'),
            fontSample: q('[data-role="font-sample"]'),
            fontLoadStatus: q('[data-role="font-load-status"]'),
            fontSamplePreview: q('[data-role="font-sample-preview"]'),
            fontFavorite: q('[data-role="font-favorite"]'),
            fontPrimary: q('[data-action="font-primary"]'),
            fontStorage: q('[data-role="font-storage"]'),
            fontNote: q('[data-role="font-note"]'),
            fontFavoriteFirst: q('[data-role="font-favorite-first"]'),
            fontLinks: q('[data-role="font-links"]'),
            errorStatus: q('[data-role="error-status"]'),
            curvePreset: q('[data-role="curve-preset"]'),
            envelopePreset: q('[data-role="envelope-preset"]'),
            envelopeAmount: q('[data-envelope-amount]'),
            envelopeAmountNumber: q('[data-envelope-amount-number]'),
            gridEnabled: q('[data-role="grid-enabled"]'),
            gridSize: q('[data-role="grid-size"]'),
            snap: q('[data-role="snap"]'),
            placementDetails: q('[data-role="placement-details"]')
        };

        try { this.elements.fontCard.open = JSON.parse(localStorage.getItem(UI_STORAGE_KEY) || '{}').fontDetailsOpen === true; }
        catch (error) { this.elements.fontCard.open = false; }
        this.fontTree = new FontTree({
            container: this.elements.fontTree,
            getLoadedFont: (id) => this._getLoadedFont(id),
            onSelect: (node, options) => this._onTreeFontSelected(node, options),
            onEscape: () => this._toggleFontTree(false),
            onMove: (placement) => this._moveOrganizationNode(placement)
        });
        this.fontComparison = new FontComparison({
            container: this.elements.fontComparison,
            getLoadedFont: (id) => this._getLoadedFont(id),
            warmFonts: (ids, options) => this.fonts.warmFonts?.(ids, options),
            onMove: placement => this._moveOrganizationNode(placement),
            onCommit: (row) => this._onComparisonFontCommitted(row),
            onClose: () => {
                this.elements.fontComparisonToggle?.setAttribute('aria-expanded', 'false');
                this.elements.fontComparisonToggle?.setAttribute('aria-label', '書体の比較・情報・整理を開く');
                this.elements.fontComparisonToggle?.setAttribute('title', '書体の比較・情報・整理を開く');
                this.elements.fontComparisonToggle?.focus?.();
            }
        });
        // FontComparison currently discovers its anchor before mounting the
        // fixed page. Rebind it to this host without changing the shared widget.
        this.fontComparison.anchor = this.popup;
        this._bind();
        this.fontComparison.attachInformation?.(this.elements.fontCard);
        this.fontManagement = new FontLibraryManagement({ library: this.fonts, host: this.fontComparison.refs.informationHost });
        this._renderFontOptions();
        this._renderFontTree();
        this._renderFontComparison();
        this._syncControls();
    }

    _bind() {
        const root = this.popup;
        const stopEditorKey = (event) => {
            const key = String(event.key || '').toLowerCase();
            // Let the popup-owning handler consume session Escape/Ctrl+Z while
            // keeping ordinary text-entry keys away from the global canvas.
            if (event.key === 'Escape' || ((event.ctrlKey || event.metaKey) && !event.shiftKey && (key === 'z' || key === 'enter'))) return;
            event.stopPropagation();
        };
        root.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => this._setMode(button.dataset.mode)));
        root.querySelectorAll('[data-vertical]').forEach(button => button.addEventListener('click', () => this._setParams({ ...this.params, vertical: button.dataset.vertical === 'true' })));
        root.querySelector('[data-role="bold"]')?.addEventListener('click', () => this._setParams({ ...this.params, bold: !this.params.bold }));
        this.elements.text.addEventListener('beforeinput', () => {
            if (!this._compositionEdit) this._textEdit = { start: this.elements.text.selectionStart, end: this.elements.text.selectionEnd };
        });
        this.elements.text.addEventListener('compositionstart', () => {
            this._compositionEdit = { text: this.params.text, styles: clone(this.params.characterStyles || []), start: this.elements.text.selectionStart, end: this.elements.text.selectionEnd };
        });
        this.elements.text.addEventListener('compositionend', () => { this._compositionEdit = null; this._textEdit = null; });
        this.elements.text.addEventListener('input', event => {
            const composition = this._compositionEdit;
            const styles = remapCharacterStyles(composition?.text ?? this.params.text, event.target.value,
                composition?.styles ?? this.params.characterStyles ?? [], composition || this._textEdit);
            this.characterSelection = null;
            this._setParams({ ...this.params, text: event.target.value, characterStyles: styles });
            this._textEdit = null;
        });
        this.elements.text.addEventListener('select', () => {
            if (this.activeTab === 'characters' && !this._compositionEdit && this.elements.text.selectionEnd > this.elements.text.selectionStart)
                this._selectCharacters(this.elements.text.selectionStart, this.elements.text.selectionEnd);
        });
        ['keydown', 'keyup'].forEach(type => this.elements.text.addEventListener(type, stopEditorKey));

        root.querySelectorAll('[data-field]').forEach(input => input.addEventListener('input', () => this._setField(input.dataset.field, input.value)));
        root.querySelectorAll('[data-field-number]').forEach(input => {
            ['keydown', 'keyup'].forEach(type => input.addEventListener(type, stopEditorKey));
            this._numericCleanups.push(attachNumericField({ range: root.querySelector(`[data-field="${input.dataset.fieldNumber}"]`), numberInput: input }));
        });
        root.querySelectorAll('[data-color]').forEach(input => input.addEventListener('input', (event) => this._setParams({ ...this.params, [event.target.dataset.color]: event.target.value })));
        root.querySelectorAll('[data-character-outline-mode]').forEach(input => input.addEventListener('change', () => this._setCharacterOutlineMode(input.dataset.characterOutlineMode, input.value)));
        root.querySelectorAll('[data-character-outline-width]').forEach(input => {
            input.addEventListener('input', () => {
                if (input.value === '' || !Number.isFinite(input.valueAsNumber)) return;
                this._patchCharacters({ [input.dataset.characterOutlineWidth]: input.valueAsNumber });
            });
            ['keydown', 'keyup'].forEach(type => input.addEventListener(type, stopEditorKey));
            this._numericCleanups.push(attachNumericField({ numberInput: input }));
        });
        root.querySelectorAll('[data-character-outline-color]').forEach(input => input.addEventListener('input', () => this._patchCharacters({ [input.dataset.characterOutlineColor]: input.value })));
        root.querySelectorAll('[data-placement]').forEach(input => {
            input.addEventListener('input', () => {
                if (input.value === '' || !Number.isFinite(input.valueAsNumber)) return;
                const raw = input.dataset.placement === 'rotation' ? Number(input.value) * Math.PI / 180 : input.value;
                this._setPlacementField(input.dataset.placement, raw);
            });
            ['keydown', 'keyup'].forEach(type => input.addEventListener(type, stopEditorKey));
            this._numericCleanups.push(attachNumericField({ numberInput: input }));
        });
        this.elements.curvePreset.addEventListener('change', () => {
            this._setCurvePreset(this.elements.curvePreset.value);
            this.placementTarget = 'curve'; this._setMode('curve');
        });
        this.elements.envelopePreset.addEventListener('change', () => this._setEnvelopePreset(this.elements.envelopePreset.value));
        this.elements.envelopeAmount.addEventListener('input', () => this._setEnvelopeAmount(this.elements.envelopeAmount.value));
        this._numericCleanups.push(attachNumericField({ range: this.elements.envelopeAmount, numberInput: this.elements.envelopeAmountNumber }));
        this._numericCleanups.push(attachNumericField({ numberInput: this.elements.gridSize }));
        this.elements.gridEnabled.addEventListener('change', () => { this.grid.enabled = this.elements.gridEnabled.checked; this.overlay.schedule(); });
        this.elements.gridSize.addEventListener('input', () => {
            if (this.elements.gridSize.value === '') return;
            this.grid.size = clamp(finite(this.elements.gridSize.value, DEFAULT_GRID), 1, 512); this.overlay.schedule();
        });
        this.elements.snap.addEventListener('change', () => { this.snap = this.elements.snap.checked; this.overlay.schedule(); });
        root.querySelectorAll('[data-placement-target]').forEach(button => button.addEventListener('click', () => {
            this.placementTarget = button.dataset.placementTarget;
            this._setMode('curve');
        }));
        root.querySelector('[data-role="size-profile"]').addEventListener('change', event => {
            const mode = event.target.value;
            this._profileChoice = mode;
            if (mode === 'legacy') { this._setParams({ ...this.params, sizeProfile: null }); this._syncControls(); return; }
            if (mode === 'uniform') return this._setParams({ ...this.params, sizeProfile: null, endFontSize: null });
            const existing = this.params.sizeProfile;
            const end = existing?.end ?? ((this.params.endFontSize ?? this.params.fontSize) / this.params.fontSize);
            this._setParams({ ...this.params, sizeProfile: { mode, start: existing?.start ?? 1, mid: existing?.mid ?? (1 + end) / 2, end } });
        });
        root.querySelectorAll('[data-profile]').forEach(input => {
            input.addEventListener('input', () => {
                if (input.value === '' || !Number.isFinite(input.valueAsNumber) || !this.params.sizeProfile) return;
                this._setParams({ ...this.params, sizeProfile: { ...this.params.sizeProfile, [input.dataset.profile]: input.valueAsNumber } });
            });
            this._numericCleanups.push(attachNumericField({ numberInput: input }));
        });
        root.querySelectorAll('[data-character]').forEach(input => {
            input.addEventListener('input', () => {
                if (input.value === '' || !Number.isFinite(input.valueAsNumber)) return;
                this._patchCharacters({ [input.dataset.character]: input.dataset.character === 'rotation' ? input.valueAsNumber * Math.PI / 180 : input.valueAsNumber });
            });
            this._numericCleanups.push(attachNumericField({ numberInput: input }));
        });
        root.querySelector('[data-role="character-color"]').addEventListener('input', event => this._patchCharacters({ color: event.target.value }));
        const updateCharacterEnvelope = () => {
            this._patchCharacters({ envelope: { kind: root.querySelector('[data-role="character-envelope"]').value,
                amount: Number(root.querySelector('[data-role="character-envelope-amount"]').value), points: null } });
        };
        root.querySelector('[data-role="character-envelope"]').addEventListener('change', updateCharacterEnvelope);
        root.querySelector('[data-role="character-envelope-amount"]').addEventListener('input', updateCharacterEnvelope);
        this._numericCleanups.push(attachNumericField({ numberInput: root.querySelector('[data-role="character-envelope-amount"]') }));

        this.elements.fontSelect.addEventListener('change', event => this._onFontSelected(event.target.value));
        this.elements.fontTrigger.addEventListener('click', () => this._toggleFontTree());
        this.elements.fontTrigger.addEventListener('wheel', event => this._onFontWheel(event), { passive: false });
        this.elements.fontTree.addEventListener('scroll', () => this._warmFontTreeVisible(), { passive: true });
        this.elements.fontTree.addEventListener('click', () => this._warmFontTreeVisible());
        this.elements.fontComparisonToggle.addEventListener('click', () => this._toggleFontComparison());
        this.elements.fontSample.addEventListener('change', event => {
            this.fonts.setSample?.(event.target.value);
            this._renderFontDetails();
        });
        this.elements.fontCard.addEventListener('toggle', () => {
            try { const prefs = JSON.parse(localStorage.getItem(UI_STORAGE_KEY) || '{}'); localStorage.setItem(UI_STORAGE_KEY, JSON.stringify({ ...prefs, fontDetailsOpen: this.elements.fontCard.open })); } catch (error) {}
            this._renderFontDetails();
        });
        this.elements.fontFavorite.addEventListener('change', async event => {
            const id = this._selectedFontId();
            if (id) await this.fonts.setFavorite?.(id, event.target.checked);
        });
        this.elements.fontPrimary.addEventListener('click', async () => {
            const id = this._selectedFontId();
            if (id) await this.fonts.setPrimary?.(this.fonts.getPreferences?.()?.primaryId === id ? null : id);
        });
        this.elements.fontStorage.addEventListener('change', async event => {
            const id = this._selectedFontId();
            if (id) {
                await this.fonts.setFontFolder?.(id, event.target.value || null);
                await this._refreshFontData();
            }
        });
        this.elements.fontNote.addEventListener('input', event => {
            const id = this._selectedFontId();
            if (id) void this.fonts.setUserComment?.(id, event.target.value);
        });
        this.elements.fontFavoriteFirst.addEventListener('change', event => { void this.fonts.setFavoriteFirst?.(event.target.checked); });
        ['font-up', 'font-down'].forEach(action => root.querySelector(`[data-action="${action}"]`).addEventListener('click', () => {
            const id = this._selectedFontId();
            const row = this._fontRowsForTree().find(font => font.id === id && !font.system);
            const placement = row && this.fontTree?.moveRelative?.(row.key, action === 'font-up' ? -1 : 1);
            if (placement) void this._moveOrganizationNode(placement);
        }));
        const summaryNodes = root.querySelectorAll('details > summary');
        summaryNodes.forEach(summary => ['keydown', 'keyup'].forEach(type => summary.addEventListener(type, stopEditorKey)));
        root.querySelectorAll('input, select').forEach(input => ['keydown', 'keyup'].forEach(type => input.addEventListener(type, stopEditorKey)));
        root.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => this._onAction(button.dataset.action)));
        root.addEventListener('keydown', event => this._onPopupKeyDown(event));
        root.addEventListener('keyup', event => {
            if (event.key === 'Control' || event.key === 'Meta') return;
            if (event.target?.matches?.('input,textarea,select')) event.stopPropagation();
        });
    }

    _onPopupKeyDown(event) {
        if (!this.isVisible) return;
        if (event.isComposing || event.keyCode === 229) return;
        if (this.handleCanvasShortcut(event)) return;
        if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key === 'Enter') {
            event.preventDefault();
            event.stopPropagation();
            if (!event.repeat) void this.commitAndClose();
            return;
        }
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            if (!this.elements.fontTree.hidden) return this._toggleFontTree(false);
            if (this.fontComparison?.isOpen?.()) return this._toggleFontComparison(false);
            if (this.drag) return this._endDrag({ cancel: true });
            if (this.mode !== 'whole') return this._setMode('whole');
            void this.cancel();
            return;
        }
        const key = String(event.key || '').toLowerCase();
        if ((event.ctrlKey || event.metaKey) && !event.shiftKey && key === 'z' && this.popup.contains(event.target)) {
            event.preventDefault();
            event.stopPropagation();
            this._sessionUndoOnce();
        }
    }

    _onAction(action) {
        if (this._commitBusy && ['new', 'cancel', 'apply', 'update', 'load-active'].includes(action)) return;
        if (action === 'close') return this.hide();
        if (action === 'new') return this.newSession();
        if (action === 'cancel') return this.cancel();
        if (action === 'apply') return void this._commit(false);
        if (action === 'update') return void this._commit(true);
        if (action === 'load-active') return void this.loadFromActiveLayer();
        if (action === 'curve-add') return this._addCurvePointFromSelection();
        if (action === 'curve-delete') return this._deleteSelectedCurveNode();
        if (action === 'curve-smooth') return this._toggleSelectedCurveNodeSmooth();
        if (action === 'font-primary') return;
        if (action === 'character-font') return this._openCharacterFonts();
        if (action === 'character-font-clear') return this._patchCharacters({ fontId: null });
        if (action === 'character-color-clear') return this._patchCharacters({ color: null });
        if (action === 'character-outlines') {
            this._characterOutlineView = !this._characterOutlineView;
            this._syncCharacterControls();
            return;
        }
        if (action === 'character-reset') {
            return this._patchCharacters(Object.fromEntries(['fontId', 'color', 'size', 'rotation', 'scaleX', 'scaleY', 'offsetX', 'offsetY', 'envelope', 'strokeWidth', 'strokeColor', 'outerStrokeWidth', 'outerStrokeColor'].map(key => [key, null])));
        }
        if (action === 'flip-horizontal' || action === 'flip-vertical') return this._transformDraft({ flip: action.endsWith('horizontal') ? 'x' : 'y' }, 'whole');
        if (action === 'character-flip-horizontal' || action === 'character-flip-vertical') return this._transformDraft({ flip: action.endsWith('horizontal') ? 'x' : 'y' }, 'characters');
    }

    _setMode(mode) {
        if (mode === 'curve' && this.placementTarget === 'curve' && !this._curveEntryInitialized) {
            this._curveEntryInitialized = true;
            if (!this.editing && this.params.fontKind !== 'system' && this.params.baseline?.kind === 'none') this._setCurvePreset('straight');
        }
        if (!['whole', 'curve', 'envelope', 'characters'].includes(mode)) return;
        if (mode !== this.activeTab) this.popup.querySelector('.lettering-popup__body').scrollTop = 0;
        this.activeTab = mode;
        this.mode = mode === 'curve' ? this.placementTarget : mode;
        if (mode !== 'curve') this.selectedNodeId = '';
        if (mode !== 'envelope') this.selectedEnvelopeIndex = -1;
        this._syncControls();
        this.overlay.schedule();
    }

    _setParams(next, { recordUndo = true, schedule = true, normalize = true } = {}) {
        const value = normalize ? normalizeLetteringParams(next, this._canvasSize()) : clone(next);
        if (sameValue(value, this.params)) return;
        // A real edit explicitly resumes preview after cancel() suspended the
        // old result to avoid briefly duplicating the committed raster.
        this._previewSuspended = false;
        if (recordUndo) {
            this._sessionUndo.push(clone(this.params));
            if (this._sessionUndo.length > 80) this._sessionUndo.shift();
        }
        this.params = value;
        this._paramsTouched = true;
        this._paramsRevision += 1;
        this._syncControls();
        this.overlay.schedule();
        if (schedule) this._schedulePreview();
    }

    _setField(key, raw) {
        const value = finite(raw, key === 'endFontSize' ? 0 : 0);
        if (key === 'endFontSize') this._setParams({ ...this.params, endFontSize: value > 0 ? value : null });
        else if (key in this.params) this._setParams({ ...this.params, [key]: value });
        if (key === 'fontSize') this.sizeSlots?.updateFromControl(this.params.fontSize);
    }

    _setPlacementField(key, raw) {
        if (!this.params.placement || !(key in this.params.placement)) return;
        const current = this.params.placement;
        let value = finite(raw, current[key]);
        if (key === 'scaleX' || key === 'scaleY') value = clamp(value, -MAX_SCALE, MAX_SCALE) || (value < 0 ? -MIN_SCALE : MIN_SCALE);
        this._setParams({ ...this.params, placement: { ...current, [key]: value } });
    }

    _setEnvelopeAmount(raw) {
        const amount = clamp(finite(raw, 0), -1, 1);
        if (this._outwardPreset) return this._setOutwardEnvelope(amount);
        this._setParams({ ...this.params, envelope: { ...this.params.envelope, amount } });
    }

    _setCurvePreset(kind) {
        if (!CURVE_KINDS.some(item => item[0] === kind)) return;
        this._curveEntryInitialized = true;
        const current = this.params.baseline || { kind: 'none', path: { closed: false, nodes: [] } };
        const result = this._activeResult();
        const size = result?.envelopeBounds || result?.localBounds || { width: 240, height: 80 };
        const width = Math.max(1, finite(size.width ?? size.w, 240));
        const height = Math.max(1, finite(size.height ?? size.h, 80));
        let path = { closed: false, nodes: [] };
        if (kind !== 'none') {
            try {
                path = createCurvePreset(kind, width, height);
                // Geometry presets are intentionally authored in the positive
                // 0..width / 0..height range. Lettering local space is centered
                // at the placement origin, so shift only anchors here; handles
                // remain node-relative.
                path.nodes = path.nodes.map(node => ({
                    ...node,
                    x: finite(node.x, 0) - width / 2,
                    y: finite(node.y, 0) - height / 2
                }));
            } catch (error) { path = current.path; }
        }
        this.selectedNodeId = path?.nodes?.[0]?.id || '';
        this._setParams({ ...this.params, baseline: { ...current, kind, path } });
    }

    _setEnvelopePreset(kind) {
        if (!ENVELOPE_KINDS.some(item => item[0] === kind)) return;
        this._outwardPreset = kind === 'outward';
        if (kind === 'outward') return this._setOutwardEnvelope(0.4);
        const current = this.params.envelope || { kind: 'none', amount: 0, points: null };
        this.selectedEnvelopeIndex = kind === 'points' ? 4 : -1;
        this._setParams({
            ...this.params,
            envelope: { ...current, kind, points: kind === 'points' ? (current.points || defaultNinePoints()) : null }
        });
    }

    _setOutwardEnvelope(amount) {
        const points = defaultNinePoints();
        points[1].y = -amount; points[7].y = 1 + amount;
        points[3].x = -amount; points[5].x = 1 + amount;
        this._setParams({ ...this.params, envelope: { kind: 'points', amount, points } });
    }

    _selectCharacters(start, end, extend = false) {
        const units = segmentLetteringText(this.params.text).filter(unit => unit.end > start && unit.start < end && unit.text !== '\n');
        if (!units.length) return;
        let range = { start: units[0].start, end: units[units.length - 1].end };
        // A shaped ligature/combining cluster is one rotatable object. Expand
        // the user's visible selection to that cluster without persisting it.
        for (const path of this._activeResult()?.paths || []) {
            if (path.end > range.start && path.start < range.end) range = { start: Math.min(range.start, path.start), end: Math.max(range.end, path.end) };
        }
        if (extend && this.characterSelection) range = { start: Math.min(range.start, this.characterSelection.start), end: Math.max(range.end, this.characterSelection.end) };
        this.characterSelection = range;
        this._syncCharacterControls();
        this.overlay.schedule();
    }

    _patchCharacters(patch, { base = this.params, recordUndo = true } = {}) {
        const range = this.characterSelection;
        if (!range) return this._setStatus('変更する文字を選択してください', 'error');
        const styles = applyCharacterStyle(base.text, base.characterStyles || [], range.start, range.end, patch);
        this._setParams({ ...base, characterStyles: styles }, { recordUndo });
    }

    _setCharacterOutlineMode(widthKey, mode) {
        const spec = CHARACTER_OUTLINES.find(item => item.width === widthKey);
        if (!spec || !this.characterSelection || !['inherit', 'off', 'custom'].includes(mode)) return;
        const style = characterStyleAt(this.params.characterStyles || [], this.characterSelection.start) || {};
        if (mode === 'inherit') return this._patchCharacters({ [spec.width]: null, [spec.color]: null });
        if (mode === 'off') return this._patchCharacters({ [spec.width]: 0, [spec.color]: null });
        this._patchCharacters({ [spec.width]: style[spec.width] > 0 ? style[spec.width] : this.params[spec.width] > 0 ? this.params[spec.width] : 3,
            [spec.color]: style[spec.color] || this.params[spec.color] });
    }

    _syncCharacterControls() {
        this.popup.querySelector('[data-role="character-geometry"]').hidden = this._characterOutlineView;
        this.popup.querySelector('[data-role="character-outlines"]').hidden = !this._characterOutlineView;
        this._press(this.popup.querySelector('[data-action="character-outlines"]'), this._characterOutlineView);
        const strip = this.popup.querySelector('[data-role="character-strip"]');
        const range = this.characterSelection;
        if (this._characterStripText !== this.params.text) {
            this._characterStripText = this.params.text;
            strip.replaceChildren();
            for (const unit of segmentLetteringText(this.params.text)) {
                if (unit.text === '\n') { strip.append(document.createElement('br')); continue; }
                const button = document.createElement('button');
                button.type = 'button'; button.className = 'pl-chip'; button.textContent = /^\s+$/.test(unit.text) ? '␣' : unit.text;
                button.dataset.characterStart = unit.start; button.dataset.characterEnd = unit.end;
                button.setAttribute('aria-label', `${unit.index + 1}文字目 ${unit.text}`);
                button.addEventListener('click', event => this._selectCharacters(unit.start, unit.end, event.shiftKey));
                strip.append(button);
            }
        }
        strip.querySelectorAll('button').forEach(button => this._press(button, !!range && Number(button.dataset.characterEnd) > range.start && Number(button.dataset.characterStart) < range.end));
        const status = this.popup.querySelector('[data-role="character-status"]');
        const label = range ? this.params.text.slice(range.start, range.end).replace(/\n/g, ' / ') : '';
        status.textContent = range ? `選択:「${label.slice(0, 40)}」` : 'キャンバスか下の文字を選択（Shiftで複数）';
        status.title = range ? `選択:「${label}」` : status.textContent;
        this.popup.querySelectorAll('.lettering-popup__character-actions button').forEach(button => { button.disabled = !range; });
        const inspector = this.popup.querySelector('[data-role="character-inspector"]');
        inspector.querySelectorAll('input,select,button').forEach(input => { input.disabled = !range; });
        if (!range) return;
        const style = characterStyleAt(this.params.characterStyles || [], range.start) || {};
        const set = (selector, value) => {
            const input = inspector.querySelector(selector);
            if (input && document.activeElement !== input) input.value = value;
        };
        for (const spec of CHARACTER_FIELDS) {
            const value = style[spec.key] ?? (['size', 'scaleX', 'scaleY'].includes(spec.key) ? 1 : 0);
            set(`[data-character="${spec.key}"]`, spec.key === 'rotation' ? Number((value * 180 / Math.PI).toFixed(2)) : value);
        }
        for (const spec of CHARACTER_OUTLINES) {
            const mode = !Object.hasOwn(style, spec.width) && !Object.hasOwn(style, spec.color) ? 'inherit' : style[spec.width] === 0 ? 'off' : 'custom';
            set(`[data-character-outline-mode="${spec.width}"]`, mode);
            set(`[data-character-outline-width="${spec.width}"]`, style[spec.width] ?? this.params[spec.width] ?? 0);
            set(`[data-character-outline-color="${spec.color}"]`, style[spec.color] || this.params[spec.color]);
            inspector.querySelector(`[data-character-outline-width="${spec.width}"]`).disabled = mode !== 'custom';
            inspector.querySelector(`[data-character-outline-color="${spec.color}"]`).disabled = mode !== 'custom';
        }
        set('[data-role="character-color"]', style.color || this.params.color);
        set('[data-role="character-envelope"]', style.envelope?.kind || 'none');
        set('[data-role="character-envelope-amount"]', style.envelope?.amount || 0);
        inspector.querySelector('[data-role="character-envelope-amount"]').disabled = !style.envelope || style.envelope.kind === 'none';
        const font = this._fontRowsForTree().find(row => row.id === style.fontId && !row.system);
        inspector.querySelector('[data-action="character-font"]').textContent = style.fontId ? (font?.label || style.fontId) : '標準を継承';
        if (this._fontTarget === 'characters' && this.fontComparison?.isOpen?.()) this.fontComparison?.setTargetLabel?.(`選択「${label.slice(0, 20)}」`);
    }

    _openCharacterFonts() {
        if (!this.characterSelection) return;
        this._fontTarget = 'characters';
        const style = characterStyleAt(this.params.characterStyles || [], this.characterSelection.start) || {};
        const row = this._fontRowsForTree().find(item => item.id === (style.fontId || this.params.fontId) && !item.system);
        this._informationFontValue = row?.selectValue || '';
        this.fontComparison.setMode?.('samples');
        this.fontComparison.setTargetLabel?.(`選択「${this.params.text.slice(this.characterSelection.start, this.characterSelection.end).slice(0, 20)}」`);
        this.fontComparison.setCommittedKey(row?.key || '');
        this.fontComparison.setOpen(true);
        this.elements.fontComparisonToggle.setAttribute('aria-expanded', 'true');
        this._renderFontDetails();
    }

    _selectedCharacterGroups(result = this._activeResult()) {
        const selection = this.characterSelection;
        if (!selection) return [];
        const groups = new Map();
        for (const path of result?.paths || []) {
            if (!Number.isInteger(path.start) || !Number.isInteger(path.end) || path.end <= selection.start || path.start >= selection.end || !path.bounds) continue;
            const key = `${path.start}:${path.end}`;
            const old = groups.get(key);
            if (!old) groups.set(key, { ...path, bounds: { ...path.bounds } });
            else {
                const minX = Math.min(old.bounds.x, path.bounds.x), minY = Math.min(old.bounds.y, path.bounds.y);
                const maxX = Math.max(old.bounds.x + old.bounds.width, path.bounds.x + path.bounds.width), maxY = Math.max(old.bounds.y + old.bounds.height, path.bounds.y + path.bounds.height);
                old.bounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
            }
        }
        return [...groups.values()];
    }

    _characterTransformParams(change, base = this.params, result = this._activeResult()) {
        const groups = this._selectedCharacterGroups(result);
        if (!groups.length) return base;
        const minX = Math.min(...groups.map(g => g.bounds.x)), maxX = Math.max(...groups.map(g => g.bounds.x + g.bounds.width));
        const minY = Math.min(...groups.map(g => g.bounds.y)), maxY = Math.max(...groups.map(g => g.bounds.y + g.bounds.height));
        const pivot = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
        let styles = base.characterStyles || [];
        const angle = change.rotation || 0, cos = Math.cos(angle), sin = Math.sin(angle), factor = change.scale || 1;
        for (const group of groups) {
            const old = characterStyleAt(base.characterStyles || [], group.start) || {};
            const anchor = group.anchor || { x: group.bounds.x + group.bounds.width / 2, y: group.bounds.y + group.bounds.height / 2 };
            const tangent = group.tangent || { x: base.vertical ? 0 : 1, y: base.vertical ? 1 : 0 };
            const length = Math.hypot(tangent.x, tangent.y) || 1, tx = tangent.x / length, ty = tangent.y / length;
            const dx = anchor.x - pivot.x, dy = anchor.y - pivot.y;
            const nx = change.flip === 'x' ? -dx : (dx * cos - dy * sin) * factor;
            const ny = change.flip === 'y' ? -dy : (dx * sin + dy * cos) * factor;
            const delta = { x: nx - dx + (change.x || 0), y: ny - dy + (change.y || 0) };
            const basis = group.offsetBasis || { x: { x: tx, y: ty }, y: { x: -ty, y: tx } };
            const determinant = basis.x.x * basis.y.y - basis.x.y * basis.y.x;
            const offsetX = Math.abs(determinant) > 1e-6 ? (delta.x * basis.y.y - delta.y * basis.y.x) / determinant : delta.x * tx + delta.y * ty;
            const offsetY = Math.abs(determinant) > 1e-6 ? (basis.x.x * delta.y - basis.x.y * delta.x) / determinant : -delta.x * ty + delta.y * tx;
            const patch = { offsetX: (old.offsetX || 0) + offsetX, offsetY: (old.offsetY || 0) + offsetY };
            if (angle) patch.rotation = (old.rotation || 0) + angle;
            if (change.scale) { patch.scaleX = (old.scaleX ?? 1) * factor; patch.scaleY = (old.scaleY ?? 1) * factor; }
            if (change.flip) patch[change.flip === 'x' ? 'scaleX' : 'scaleY'] = -(old[change.flip === 'x' ? 'scaleX' : 'scaleY'] ?? 1);
            styles = applyCharacterStyle(base.text, styles, group.start, group.end, patch);
        }
        return { ...base, characterStyles: styles };
    }

    _placementAroundCenter(nextPlacement, before = this.params.placement, bounds = this._bounds()) {
        const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
        const fixed = this._localToWorld(center, before);
        const next = this._localToWorld(center, { ...nextPlacement, x: 0, y: 0 });
        return { ...nextPlacement, x: fixed.x - next.x, y: fixed.y - next.y };
    }

    _transformDraft(change, target = this.activeTab === 'characters' ? 'characters' : 'whole') {
        if (target === 'characters') {
            if (!this.characterSelection) return this._setStatus('操作する文字を選択してください', 'error');
            return this._setParams(this._characterTransformParams(change));
        }
        const before = this.params.placement;
        const next = { ...before };
        if (change.rotation) next.rotation += change.rotation;
        if (change.scale) {
            const scale = v => Math.sign(v) * clamp(Math.abs(v) * change.scale, MIN_SCALE, MAX_SCALE);
            next.scaleX = scale(before.scaleX); next.scaleY = scale(before.scaleY);
        }
        if (change.flip) next[change.flip === 'x' ? 'scaleX' : 'scaleY'] *= -1;
        const placement = this._placementAroundCenter(next, before);
        placement.x += change.x || 0; placement.y += change.y || 0;
        this._setParams({ ...this.params, placement });
    }

    handleCanvasShortcut(event) {
        if (!this.isVisible || event.isComposing || event.keyCode === 229) return false;
        if (event.target?.closest?.('input,textarea,select,[contenteditable="true"],#lettering-font-comparison')) return false;
        const key = event.key?.toLowerCase();
        if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && key === 'enter') {
            event.preventDefault(); event.stopImmediatePropagation();
            if (!event.repeat) void this.commitAndClose();
            return true;
        }
        if (event.ctrlKey || event.metaKey || event.altKey || this._spacePressed || !isMangaInputPrimary('lettering')) return false;
        if (key === 'v') {
            if (event.repeat) return true;
            this._transformInput = !this._transformInput;
            this._setStatus(this._transformInput ? '文字操作 ON: wheel拡縮 / Shift回転 / H反転' : '文字操作 OFF', 'idle');
        } else if (this._transformInput && key === 'h') {
            this._transformDraft({ flip: event.shiftKey ? 'y' : 'x' });
        } else if (this._transformInput && /^Arrow/.test(event.key)) {
            if (event.shiftKey) this._transformDraft(event.key === 'ArrowUp' || event.key === 'ArrowDown'
                ? { scale: event.key === 'ArrowUp' ? 1.1 : 0.9 }
                : { rotation: (event.key === 'ArrowLeft' ? -1 : 1) * Math.PI / 12 });
            else this._transformDraft({ x: event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0, y: event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0 });
        } else if (this._transformInput && event.key === 'Escape') {
            this._transformInput = false; this._setStatus('文字操作 OFF', 'idle');
        } else return false;
        event.preventDefault(); event.stopImmediatePropagation(); return true;
    }

    _sessionUndoOnce() {
        const previous = this._sessionUndo.pop();
        if (!previous) return;
        this._setParams(previous, { recordUndo: false });
    }

    _activeResult() {
        return this._lastValid?.result || null;
    }

    _syncPreviewSource() {
        if (this.isVisible && this._paramsTouched && this.editing?.layerId && this._lastValid?.result?.ok) {
            this.layerAdapter.beginPreview?.(this.editing.layerId);
        } else this.layerAdapter.endPreview?.();
    }

    _renderOptions(snapshot) {
        const options = { fontLibrary: this.fonts };
        // Imported/bundled fonts share the outline renderer. The popup preview
        // may flatten the cached outline; the adapter performs the canonical
        // bake when apply/update commits it.
        if (snapshot?.fontKind === 'imported') options.previewOnly = true;
        return options;
    }

    _schedulePreview() {
        if (this._previewSuspended) return;
        ++this._previewGeneration;
        if (this._previewTimer !== null) return;
        this._setStatus('プレビューを更新中…', 'loading');
        // Coalesce into the newest input at a bounded cadence. Restarting a
        // debounce on every move would freeze the glyphs during a long drag.
        this._previewTimer = setTimeout(() => {
            this._previewTimer = null;
            void this._renderPreview(this._previewGeneration, this._paramsRevision, clone(this.params));
        }, 32);
    }

    async _renderPreview(generation, revision, snapshot) {
        let result;
        try {
            result = await this.renderLettering(snapshot, this._renderOptions(snapshot));
        } catch (error) {
            result = { ok: false, reason: error?.message || '文字のプレビューに失敗しました' };
        }
        if (this._previewSuspended || generation !== this._previewGeneration || revision !== this._paramsRevision) return null;
        if (result?.ok) {
            this._lastValid = { result, params: snapshot, revision };
            this._setStatus('', 'idle');
            this.overlay.schedule();
            return result;
        }
        this._setStatus(result?.reason || '文字のプレビューを作成できません', 'error');
        this.overlay.schedule();
        return null;
    }

    async _flushCurrent() {
        clearTimeout(this._previewTimer);
        this._previewTimer = null;
        if (this._previewSuspended) {
            this._setStatus('入力を変更するか「新規」でプレビューを再開してください', 'error');
            return null;
        }
        for (let attempt = 0; attempt < 5; attempt += 1) {
            const revision = this._paramsRevision;
            const generation = ++this._previewGeneration;
            const snapshot = clone(this.params);
            let result;
            try {
                result = await this.renderLettering(snapshot, this._renderOptions(snapshot));
            } catch (error) {
                result = { ok: false, reason: error?.message || '文字を描画できません' };
            }
            if (revision !== this._paramsRevision || generation !== this._previewGeneration) continue;
            if (!result?.ok) {
                this._setStatus(result?.reason || '文字を描画できません', 'error');
                return null;
            }
            this._lastValid = { result, params: snapshot, revision };
            this._setStatus('', 'idle');
            this.overlay.schedule();
            return result;
        }
        this._setStatus('入力が続いているため確定できません。少し待ってから再試行してください', 'error');
        return null;
    }

    _setStatus(message, state = 'idle') {
        if (!this.elements.errorStatus) return;
        this.elements.errorStatus.textContent = String(message || '');
        this.elements.errorStatus.dataset.state = state;
    }

    _syncControls() {
        restoreMangaTargetControls(this.popup);
        if (!this.popup) return;
        const p = this.params;
        const setValue = (selector, value) => {
            const input = this.popup.querySelector(selector);
            if (input && document.activeElement !== input) input.value = String(value);
        };
        setValue('[data-role="text"]', p.text || '');
        for (const spec of FIELD_SPECS) {
            const raw = spec.key === 'endFontSize' ? (p.endFontSize ?? 0) : p[spec.key];
            setValue(`[data-field="${spec.key}"]`, raw);
            setValue(`[data-field-number="${spec.key}"]`, raw);
            const range = this.popup.querySelector(`[data-field="${spec.key}"]`);
            if (range) {
                const pct = ((Number(raw) - Number(range.min)) / (Number(range.max) - Number(range.min))) * 100;
                range.style.setProperty('--pl-fill', `${clamp(pct, 0, 100)}%`);
            }
        }
        for (const spec of PLACEMENT_FIELDS) {
            const raw = p.placement?.[spec.key] ?? 0;
            setValue(`[data-placement="${spec.key}"]`, spec.key === 'rotation' ? Number((raw * 180 / Math.PI).toFixed(2)) : raw);
        }
        this.popup.querySelectorAll('[data-color]').forEach(input => {
            const value = p[input.dataset.color];
            if (value && input.value !== value) input.value = value;
        });
        this.popup.querySelectorAll('[data-vertical]').forEach(button => this._press(button, (button.dataset.vertical === 'true') === p.vertical));
        this._press(this.popup.querySelector('[data-role="bold"]'), p.bold === true);
        this.popup.querySelectorAll('[data-mode]').forEach(button => this._press(button, button.dataset.mode === this.activeTab));
        this.popup.querySelectorAll('[data-mode-panel]').forEach(panel => { panel.hidden = panel.dataset.modePanel !== this.activeTab; });
        this.popup.querySelectorAll('[data-placement-target]').forEach(button => this._press(button, button.dataset.placementTarget === this.placementTarget));
        this.elements.placementDetails.hidden = this.placementTarget !== 'whole';
        if (this.placementTarget === 'whole') this.elements.placementDetails.open = true;
        this.popup.querySelector('.lettering-popup__curve-actions').hidden = this.placementTarget !== 'curve';
        this.popup.querySelector('[data-mode="curve"]').classList.toggle('has-effect', p.baseline?.kind !== 'none');
        this.popup.querySelector('[data-mode="envelope"]').classList.toggle('has-effect', p.envelope?.kind !== 'none' || p.endFontSize != null || !!p.sizeProfile);
        this.popup.querySelector('[data-mode="characters"]').classList.toggle('has-effect', !!p.characterStyles?.length);
        const pointMode = p.envelope?.kind === 'points' && !this._outwardPreset;
        this.popup.querySelector('[data-role="envelope-hint"]').textContent = pointMode
            ? 'キャンバスの9点を動かして形を調整します。'
            : '形と強さを選択。キャンバスで文字全体も移動できます。';
        this.popup.querySelector('[data-role="envelope-strength"]').hidden = pointMode || p.envelope?.kind === 'none';
        this.elements.envelopeAmount.disabled = pointMode || p.envelope?.kind === 'none';
        this.elements.envelopeAmountNumber.disabled = this.elements.envelopeAmount.disabled;
        this.popup.querySelector('.lettering-popup__editor-options').hidden = this.activeTab === 'whole';
        const curveEnabled = p.baseline?.kind !== 'none';
        this.popup.querySelector('[data-action="curve-add"]').disabled = !curveEnabled;
        for (const action of ['curve-delete', 'curve-smooth']) this.popup.querySelector(`[data-action="${action}"]`).disabled = !curveEnabled || !this.selectedNodeId;
        const selectedNode = p.baseline?.path?.nodes?.find(node => node.id === this.selectedNodeId);
        const smooth = this.popup.querySelector('[data-action="curve-smooth"]');
        const smoothLabel = selectedNode?.smooth ? '選択点を角にする' : '選択点を滑らかにする';
        smooth.innerHTML = selectedNode?.smooth ? UI_ICONS.curveCorner : UI_ICONS.curveSmooth;
        smooth.title = smoothLabel; smooth.setAttribute('aria-label', smoothLabel);
        setValue('[data-role="curve-preset"]', p.baseline?.kind || 'none');
        setValue('[data-role="envelope-preset"]', this._outwardPreset ? 'outward' : p.envelope?.kind || 'none');
        const amount = finite(p.envelope?.amount, 0);
        setValue('[data-envelope-amount]', amount);
        setValue('[data-envelope-amount-number]', amount);
        this.elements.gridEnabled.checked = this.grid.enabled;
        setValue('[data-role="grid-size"]', this.grid.size);
        this.elements.snap.checked = this.snap;
        this.elements.editStatus.textContent = this.editing ? '— 再編集中' : '';
        const apply = this.popup.querySelector('[data-action="apply"]');
        const update = this.popup.querySelector('[data-action="update"]');
        apply.textContent = this.editing ? '別レイヤーに追加' : '新規レイヤーに追加';
        apply.classList.toggle('pl-btn--primary', !this.editing);
        update.hidden = !this.editing;
        this.popup.querySelectorAll('.lettering-popup__commit [data-action]').forEach(button => { button.disabled = this._commitBusy; });
        this._syncFontPicker();
        this._renderFontDetails();
        const profile = p.sizeProfile;
        const profileChoice = profile?.mode || (p.endFontSize != null || this._profileChoice === 'legacy' ? 'legacy' : 'uniform');
        setValue('[data-role="size-profile"]', profileChoice);
        this.popup.querySelector('[data-field-row="endFontSize"]').hidden = profileChoice !== 'legacy';
        this.popup.querySelector('[data-role="legacy-size-hint"]').hidden = profileChoice !== 'legacy';
        this.popup.querySelectorAll('[data-profile-row]').forEach(row => {
            const key = row.dataset.profileRow;
            row.hidden = !profile || (key === 'mid' && profile.mode !== 'three');
            setValue(`[data-profile="${key}"]`, profile?.[key] ?? 1);
            row.querySelector('output').textContent = `${Number((p.fontSize * (profile?.[key] ?? 1)).toFixed(1))}px`;
        });
        this._syncCharacterControls();
        syncMangaTargetControls(this.popup, this.layerSystem, 'lettering');
        this.panelTarget?.sync();
    }

    _press(button, on) {
        if (!button) return;
        button.setAttribute('aria-pressed', String(on));
        button.classList.toggle('is-selected', on);
    }

    _localToWorld(local, placement) {
        try { return point(letteringLocalToWorld(point(local), placement || {})); } catch (error) {
            const p = placement || {};
            const angle = finite(p.rotation, 0);
            const sx = finite(p.scaleX, 1);
            const sy = finite(p.scaleY, 1);
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const x = point(local).x;
            const y = point(local).y;
            return { x: finite(p.x, 0) + x * sx * cos - y * sy * sin, y: finite(p.y, 0) + x * sx * sin + y * sy * cos };
        }
    }

    _worldToLocal(world, placement) {
        try { return point(letteringWorldToLocal(point(world), placement || {})); } catch (error) {
            const p = placement || {};
            const dx = point(world).x - finite(p.x, 0);
            const dy = point(world).y - finite(p.y, 0);
            const angle = finite(p.rotation, 0);
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            return { x: (dx * cos + dy * sin) / (finite(p.scaleX, 1) || 1), y: (-dx * sin + dy * cos) / (finite(p.scaleY, 1) || 1) };
        }
    }

    _bounds() {
        const src = this._activeResult()?.localBounds || { x: 0, y: 0, width: 240, height: 80 };
        return { x: finite(src.x, 0), y: finite(src.y, 0), width: Math.max(1, finite(src.width ?? src.w, 240)), height: Math.max(1, finite(src.height ?? src.h, 80)) };
    }

    _envelopeBounds() {
        const result = this._activeResult();
        const src = result?.envelopeBounds || result?.localBounds || { x: 0, y: 0, width: 240, height: 80 };
        return { x: finite(src.x, 0), y: finite(src.y, 0), width: Math.max(1, finite(src.width ?? src.w, 240)), height: Math.max(1, finite(src.height ?? src.h, 80)) };
    }

    _snapLocal(local, excludeId = '') {
        if (!this.snap) return local;
        const nodes = Array.isArray(this.params.baseline?.path?.nodes) ? this.params.baseline.path.nodes : [];
        const candidates = nodes.filter(node => node?.id && node.id !== excludeId).map(node => ({ x: node.x, y: node.y }));
        const b = this._envelopeBounds();
        candidates.push({ x: b.x, y: local.y }, { x: b.x + b.width, y: local.y }, { x: local.x, y: b.y }, { x: local.x, y: b.y + b.height });
        try {
            const result = snapEditorPoint(local, { grid: this.grid.enabled ? this.grid.size : 0, candidates, threshold: 6 });
            return point(result?.point || result, local);
        } catch (error) {
            return local;
        }
    }

    _beginDrag(target, event) {
        if (!target || !event || this._spacePressed) return;
        this._endDrag({ cancel: true });
        const startWorld = this.overlay.clientToWorld(event.clientX, event.clientY);
        if (!startWorld) return;
        if (target.type === 'character') {
            const selected = this.characterSelection;
            if (!selected || target.start < selected.start || target.end > selected.end || event.shiftKey)
                this._selectCharacters(target.start, target.end, event.shiftKey);
            target = { ...target, type: 'character-center' };
        }
        if (target.type === 'curve-node') {
            this.selectedNodeId = target.nodeId || '';
            this._syncControls();
        }
        if (target.type === 'envelope-point') {
            this._outwardPreset = false;
            this.selectedEnvelopeIndex = Number(target.index);
            this._syncControls();
        }
        this.popup?.focus?.({ preventScroll: true });
        const startParams = clone(this.params);
        this._sessionUndo.push(clone(startParams));
        if (this._sessionUndo.length > 80) this._sessionUndo.shift();
        const pointerId = event.pointerId;
        const move = (nextEvent) => {
            if (!this.drag || nextEvent.pointerId !== pointerId) return;
            const world = this.overlay.clientToWorld(nextEvent.clientX, nextEvent.clientY);
            if (world) this._applyDrag(world, nextEvent);
        };
        const up = (nextEvent) => {
            if (!this.drag || nextEvent.pointerId !== pointerId) return;
            this._endDrag({ cancel: false });
        };
        const cancel = (nextEvent) => {
            if (!this.drag || nextEvent.pointerId !== pointerId) return;
            this._endDrag({ cancel: true });
        };
        window.addEventListener('pointermove', move, { capture: true });
        window.addEventListener('pointerup', up, { capture: true });
        window.addEventListener('pointercancel', cancel, { capture: true });
        this.drag = {
            ...target,
            pointerId,
            startWorld,
            startClient: { x: event.clientX, y: event.clientY },
            startParams,
            startBounds: this._bounds(),
            envelopeBounds: this._envelopeBounds(),
            startResult: this._activeResult(),
            cleanup: () => {
                window.removeEventListener('pointermove', move, true);
                window.removeEventListener('pointerup', up, true);
                window.removeEventListener('pointercancel', cancel, true);
            }
        };
        try { event.currentTarget?.setPointerCapture?.(pointerId); } catch (error) {}
    }

    _applyDrag(world, event = {}) {
        const drag = this.drag;
        if (!drag) return;
        const start = drag.startParams;
        const placement = start.placement || { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
        const localStart = this._worldToLocal(drag.startWorld, placement);
        const localNow = this._worldToLocal(world, placement);
        let next = clone(start);
        if ((drag.type === 'whole-center' || drag.type === 'character-center') && event.shiftKey) {
            const currentClient = Number.isFinite(event.clientX) ? { x: event.clientX, y: event.clientY } : world;
            const dx = currentClient.x - drag.startClient.x, dy = currentClient.y - drag.startClient.y;
            drag.directionalMode ||= resolveDirectionalTransformDragMode(drag.startClient, currentClient);
            const transformed = applyDirectionalTransformDrag({ rotation: 0, scaleX: 1, scaleY: 1 }, dx, dy, drag.directionalMode,
                { minScale: MIN_SCALE, maxScale: MAX_SCALE });
            if (drag.type === 'character-center') next = this._characterTransformParams({ rotation: transformed.rotation, scale: transformed.scaleX }, start, drag.startResult);
            else {
                const placementNext = applyDirectionalTransformDrag(placement, dx, dy, drag.directionalMode, { minScale: MIN_SCALE, maxScale: MAX_SCALE });
                next.placement = this._placementAroundCenter(placementNext, placement, drag.startBounds);
            }
        } else if (drag.type === 'character-center') {
            const delta = { x: localNow.x - localStart.x, y: localNow.y - localStart.y };
            next = this._characterTransformParams(delta, start, drag.startResult);
        } else if (drag.type === 'character-rotation' || drag.type?.startsWith('character-corner-')) {
            const groups = this._selectedCharacterGroups(drag.startResult);
            if (!groups.length) return;
            const minX = Math.min(...groups.map(g => g.bounds.x)), maxX = Math.max(...groups.map(g => g.bounds.x + g.bounds.width));
            const minY = Math.min(...groups.map(g => g.bounds.y)), maxY = Math.max(...groups.map(g => g.bounds.y + g.bounds.height));
            const center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
            if (drag.type === 'character-rotation') next = this._characterTransformParams({ rotation: Math.atan2(localNow.y-center.y, localNow.x-center.x) - Math.atan2(localStart.y-center.y, localStart.x-center.x) }, start, drag.startResult);
            else next = this._characterTransformParams({ scale: clamp(Math.hypot(localNow.x-center.x, localNow.y-center.y) / Math.max(1, Math.hypot(localStart.x-center.x, localStart.y-center.y)), MIN_SCALE, MAX_SCALE) }, start, drag.startResult);
        } else if (drag.type === 'whole-center') {
            next.placement = { ...placement, x: placement.x + (world.x - drag.startWorld.x), y: placement.y + (world.y - drag.startWorld.y) };
        } else if (drag.type === 'whole-rotation') {
            const b = drag.startBounds;
            const localCenter = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
            const center = this._localToWorld(localCenter, placement);
            const firstAngle = Math.atan2(drag.startWorld.y - center.y, drag.startWorld.x - center.x);
            const nextAngle = Math.atan2(world.y - center.y, world.x - center.x);
            const rotation = placement.rotation + nextAngle - firstAngle;
            const rotatedCenter = this._localToWorld(localCenter, { ...placement, x: 0, y: 0, rotation });
            // The rotation handle surrounds the visible frame, whose center
            // can differ from local origin after baseline/envelope editing.
            next.placement = { ...placement, rotation, x: center.x - rotatedCenter.x, y: center.y - rotatedCenter.y };
        } else if (drag.type?.startsWith('whole-corner-')) {
            const key = drag.type.slice('whole-corner-'.length);
            const b = drag.startBounds;
            const corners = {
                tl: { x: b.x, y: b.y },
                tr: { x: b.x + b.width, y: b.y },
                br: { x: b.x + b.width, y: b.y + b.height },
                bl: { x: b.x, y: b.y + b.height }
            };
            const opposite = { tl: 'br', tr: 'bl', br: 'tl', bl: 'tr' }[key];
            const fixed = corners[opposite];
            if (fixed) {
                const sx0 = localStart.x - fixed.x;
                const sy0 = localStart.y - fixed.y;
                const sx = Math.abs(sx0) > 0.001 ? clamp(Math.abs((localNow.x - fixed.x) / sx0) * Math.abs(placement.scaleX), MIN_SCALE, MAX_SCALE) : Math.abs(placement.scaleX);
                const sy = Math.abs(sy0) > 0.001 ? clamp(Math.abs((localNow.y - fixed.y) / sy0) * Math.abs(placement.scaleY), MIN_SCALE, MAX_SCALE) : Math.abs(placement.scaleY);
                const fixedWorld = this._localToWorld(fixed, placement);
                const base = this._localToWorld(fixed, { ...placement, x: 0, y: 0, scaleX: placement.scaleX < 0 ? -sx : sx, scaleY: placement.scaleY < 0 ? -sy : sy });
                next.placement = {
                    ...placement,
                    // fixedWorld already contains the original translation;
                    // adding placement.x/y again would make a corner drag
                    // drift twice as far whenever the text is off origin.
                    x: fixedWorld.x - base.x,
                    y: fixedWorld.y - base.y,
                    scaleX: placement.scaleX < 0 ? -sx : sx,
                    scaleY: placement.scaleY < 0 ? -sy : sy
                };
            }
        } else if (drag.type === 'curve-node') {
            const local = this._snapLocal(this._worldToLocal(world, placement), drag.nodeId);
            try {
                const path = moveCurveNode(start.baseline?.path, drag.nodeId, local);
                next.baseline = { ...start.baseline, path };
            } catch (error) {
                this._setStatus(error?.message || '配置線の点を移動できません', 'error');
                return;
            }
        } else if (drag.type === 'envelope-point') {
            const b = drag.envelopeBounds;
            const local = this._worldToLocal(world, placement);
            const points = Array.isArray(start.envelope?.points) ? clone(start.envelope.points) : defaultNinePoints();
            points[drag.index] = { x: clamp((local.x - b.x) / b.width, -4, 4), y: clamp((local.y - b.y) / b.height, -4, 4) };
            next.envelope = { ...start.envelope, kind: 'points', points };
        }
        this._setParams(next, { recordUndo: false });
    }

    _endDrag({ cancel = false } = {}) {
        if (!this.drag) return;
        const drag = this.drag;
        this.drag = null;
        drag.cleanup?.();
        if (cancel) this._setParams(drag.startParams, { recordUndo: false });
        this.overlay.schedule();
    }

    _addCurvePointFromEvent(target, event) {
        if (!target || target.type !== 'curve-add' || this.mode !== 'curve') return;
        const world = this.overlay.clientToWorld(event.clientX, event.clientY);
        if (!world) return;
        const local = this._snapLocal(this._worldToLocal(world, this.params.placement), '');
        const path = this.params.baseline?.path;
        if (!path?.nodes?.length) return this._setCurvePreset('free');
        if (path.nodes.length >= MAX_CURVE_NODES) return this._setStatus('配置線の点は64個までです', 'error');
        let nearest;
        try { nearest = nearestCurvePoint(path, local); } catch (error) { nearest = null; }
        if (!nearest) return;
        try {
            const nextPath = splitCurveAt(path, nearest.segmentIndex, nearest.t);
            this.selectedNodeId = nextPath?.nodes?.find(node => Math.hypot(node.x - nearest.point.x, node.y - nearest.point.y) < 0.5)?.id || '';
            this._setParams({ ...this.params, baseline: { ...this.params.baseline, path: nextPath } });
        } catch (error) {
            this._setStatus(error?.message || '配置線へ点を追加できません', 'error');
        }
    }

    _addCurvePointFromSelection() {
        const path = this.params.baseline?.path;
        const nodes = Array.isArray(path?.nodes) ? path.nodes : [];
        if (nodes.length < 2) return this._setCurvePreset('free');
        if (nodes.length >= MAX_CURVE_NODES) {
            this._setStatus(`配置線の点は${MAX_CURVE_NODES}点までです`, 'error');
            return;
        }
        const segments = curveSegments(path) || [];
        if (!segments.length) {
            this._setStatus('配置線へ点を追加できる区間がありません', 'error');
            return;
        }
        // Add at the midpoint of the selected node's outgoing segment. This
        // is deliberately independent of grid snapping: splitting a Bezier
        // at t=.5 preserves its shape exactly and never collapses to t=0/1.
        const selected = this.selectedNodeId
            ? segments.find(segment => String(segment.startId) === String(this.selectedNodeId))
            : null;
        const segment = selected || segments[0];
        const previousIds = new Set(nodes.map(node => String(node.id)));
        try {
            const nextPath = splitCurveAt(path, segment.segmentIndex, 0.5);
            const inserted = nextPath?.nodes?.find(node => !previousIds.has(String(node.id)));
            if (!inserted) {
                this._setStatus('配置線へ点を追加できませんでした', 'error');
                return;
            }
            this.selectedNodeId = inserted.id;
            this._setParams({ ...this.params, baseline: { ...this.params.baseline, path: nextPath } });
        } catch (error) {
            this._setStatus(error?.message || '配置線へ点を追加できません', 'error');
        }
    }

    _deleteSelectedCurveNode() {
        if (!this.selectedNodeId) return this._setStatus('Canvas上の点を選んでください', 'error');
        try {
            const path = deleteCurveNode(this.params.baseline?.path, this.selectedNodeId);
            this.selectedNodeId = path?.nodes?.[0]?.id || '';
            this._setParams({ ...this.params, baseline: { ...this.params.baseline, path } });
        } catch (error) {
            this._setStatus(error?.message || '配置線の点を削除できません', 'error');
        }
    }

    _toggleSelectedCurveNodeSmooth() {
        const nodes = Array.isArray(this.params.baseline?.path?.nodes) ? this.params.baseline.path.nodes : [];
        const index = nodes.findIndex(node => node?.id === this.selectedNodeId);
        if (index < 0) return this._setStatus('Canvas上の点を選んでください', 'error');
        const path = clone(this.params.baseline.path);
        const node = path.nodes[index];
        if (node.smooth === true) {
            // A corner has no tangent handles. Keeping this explicit also
            // clears handles inherited from a previously smooth preset.
            node.smooth = false;
            node.in = { x: 0, y: 0 };
            node.out = { x: 0, y: 0 };
        } else {
            const count = path.nodes.length;
            const previousIndex = index > 0 ? index - 1 : path.closed && count > 1 ? count - 1 : -1;
            const nextIndex = index < count - 1 ? index + 1 : path.closed && count > 1 ? 0 : -1;
            const previous = previousIndex >= 0 ? path.nodes[previousIndex] : null;
            const next = nextIndex >= 0 ? path.nodes[nextIndex] : null;
            const tangent = previous && next
                ? { x: finite(next.x, 0) - finite(previous.x, 0), y: finite(next.y, 0) - finite(previous.y, 0) }
                : next
                    ? { x: finite(next.x, 0) - finite(node.x, 0), y: finite(next.y, 0) - finite(node.y, 0) }
                    : previous
                        ? { x: finite(node.x, 0) - finite(previous.x, 0), y: finite(node.y, 0) - finite(previous.y, 0) }
                        : { x: 0, y: 0 };
            const tangentLength = Math.hypot(tangent.x, tangent.y);
            const previousLength = previous ? Math.hypot(finite(node.x, 0) - finite(previous.x, 0), finite(node.y, 0) - finite(previous.y, 0)) : 0;
            const nextLength = next ? Math.hypot(finite(next.x, 0) - finite(node.x, 0), finite(next.y, 0) - finite(node.y, 0)) : 0;
            if (tangentLength <= 1e-6) {
                node.in = { x: 0, y: 0 };
                node.out = { x: 0, y: 0 };
            } else {
                const tx = tangent.x / tangentLength;
                const ty = tangent.y / tangentLength;
                node.in = { x: -tx * previousLength / 3, y: -ty * previousLength / 3 };
                node.out = { x: tx * nextLength / 3, y: ty * nextLength / 3 };
            }
            node.smooth = true;
        }
        this._setParams({ ...this.params, baseline: { ...this.params.baseline, path } });
    }

    // ---------------------------------------------------------------------
    // Font tree/comparison adapter. Rows remain the existing font library's
    // unified system/bundled/imported view; no lettering-specific font store.

    _getLoadedFont(id) {
        try { return this.fonts.getLoadedFont?.(id) || null; } catch (error) { return null; }
    }

    _fontRowsForTree() {
        const rows = [];
        const seen = new Set();
        const add = row => {
            if (!row || seen.has(row.selectValue)) return;
            seen.add(row.selectValue);
            rows.push(row);
        };
        const systems = typeof this.fonts.listSystemFonts === 'function' ? this.fonts.listSystemFonts() : [];
        (systems.length ? systems : ['sans-serif', 'serif']).forEach(family => add({
            id: family,
            key: `letter-system:${family}`,
            label: family === 'sans-serif' ? 'ゴシック（標準）' : family === 'serif' ? '明朝（標準）' : family,
            selectValue: `sys:${family}`,
            family,
            system: true,
            canMove: false,
            parentId: null
        }));
        this._fontData.bundled.forEach(font => add({
            ...font,
            id: font.id,
            key: `letter-font:${font.id}`,
            label: `${font.primary ? '★ ' : ''}${font.category ? `［${font.category}］` : ''}${font.label || font.id}`,
            selectValue: `${BUNDLED_PREFIX}${font.id}`,
            system: false
        }));
        this._fontData.fonts.forEach(font => add({
            ...font,
            id: font.id,
            key: `letter-font:${font.id}`,
            label: font.label || font.id,
            selectValue: `${IMPORTED_PREFIX}${font.id}`,
            system: false
        }));
        return rows;
    }

    _selectedFontId() {
        const value = this._informationFontValue || this.elements.fontSelect?.value || '';
        if (value.startsWith(BUNDLED_PREFIX)) return value.slice(BUNDLED_PREFIX.length);
        if (value.startsWith(IMPORTED_PREFIX)) return value.slice(IMPORTED_PREFIX.length);
        return '';
    }

    _fontOptionValue(params = this.params) {
        if (params.fontKind === 'imported') {
            const bundled = this._fontData.bundled.some(font => font.id === params.fontId);
            return `${bundled ? BUNDLED_PREFIX : IMPORTED_PREFIX}${params.fontId || ''}`;
        }
        return `sys:${params.fontFamily || 'sans-serif'}`;
    }

    _renderFontOptions() {
        const select = this.elements.fontSelect;
        if (!select) return;
        const rows = this._fontRowsForTree();
        const groups = new Map();
        rows.forEach(row => {
            const label = row.system ? '端末 / 標準' : row.selectValue.startsWith(BUNDLED_PREFIX) ? '選定フォント' : '取り込みフォント';
            if (!groups.has(label)) groups.set(label, []);
            groups.get(label).push(row);
        });
        select.innerHTML = [...groups.entries()].map(([label, items]) => `<optgroup label="${escapeText(label)}">${items.map(row => `<option value="${escapeText(row.selectValue)}">${escapeText(row.label)}</option>`).join('')}</optgroup>`).join('');
        const value = this._fontOptionValue();
        if ([...select.options].some(option => option.value === value)) select.value = value;
    }

    _selectedTreeKey() {
        const selected = this._fontRowsForTree().find(row => row.selectValue === this.elements.fontSelect?.value);
        return selected?.key || '';
    }

    _syncFontPicker() {
        const value = this._fontOptionValue();
        if (this.elements.fontSelect && [...this.elements.fontSelect.options].some(option => option.value === value)) this.elements.fontSelect.value = value;
        const row = this._fontRowsForTree().find(item => item.selectValue === value);
        if (this.elements.fontTrigger) {
            this.elements.fontTrigger.textContent = row?.label || 'フォントを選ぶ';
            this.elements.fontTrigger.title = `${row?.label || 'フォントを選ぶ'} — ホイールで前後の書体、クリックで分類ツリー`;
            this.elements.fontTrigger.setAttribute('aria-expanded', String(!this.elements.fontTree.hidden));
        }
        const key = this._selectedTreeKey();
        if (key !== this._syncedFontKey) {
            this._syncedFontKey = key;
            this.fontTree?.setSelected(key);
            if (this._fontTarget !== 'characters') this.fontComparison?.setCommittedKey(key);
        }
    }

    _toggleFontTree(force = null) {
        const open = force === null ? this.elements.fontTree.hidden : force === true;
        this.elements.fontTree.hidden = !open;
        this.elements.fontTrigger.setAttribute('aria-expanded', String(open));
        if (open) {
            this.fontTree?.setSelected(this._selectedTreeKey(), { focus: true });
            this._warmFontTreeVisible();
        } else {
            this._fontTreeWarmToken += 1;
            clearTimeout(this._fontTreeWarmTimer);
            this.elements.fontTrigger.focus?.();
        }
    }

    _onFontSelected(value) {
        const row = this._fontRowsForTree().find(item => item.selectValue === value);
        if (!row) return;
        this._fontTarget = 'whole';
        this._informationFontValue = value;
        this.fontComparison?.setTargetLabel?.('文字全体の標準書体');
        const next = row.system
            ? { ...this.params, fontKind: 'system', fontId: '', fontFamily: row.family || row.id }
            : { ...this.params, fontKind: 'imported', fontId: row.id, fontFamily: row.family || this.params.fontFamily };
        this._setParams(next);
        this.fontTree?.setSelected(row.key);
        this._toggleFontTree(false);
    }

    _onTreeFontSelected(node, options = {}) {
        if (!node?.selectValue || options.previewOnly) return;
        this._onFontSelected(node.selectValue);
    }

    _onComparisonFontCommitted(row) {
        if (!row?.selectValue) return;
        if (this._fontTarget === 'characters') {
            if (row.system) {
                const previous = this._fontRowsForTree().find(item => item.selectValue === this._informationFontValue);
                this.fontComparison.setCommittedKey(previous?.key || '');
                return this._setStatus('文字別の書体には取り込みフォントを選んでください', 'error');
            }
            this._informationFontValue = row.selectValue;
            this._patchCharacters({ fontId: row.id });
            this._renderFontDetails();
        } else this._onFontSelected(row.selectValue);
    }

    _toggleFontComparison(force = null) {
        const open = force === null ? !this.fontComparison?.isOpen?.() : force === true;
        if (open) {
            this._fontTarget = 'whole';
            this._informationFontValue = this.elements.fontSelect.value;
            this.fontComparison?.setTargetLabel?.('文字全体の標準書体');
            this.fontComparison?.setCommittedKey(this._selectedTreeKey());
            this._renderFontDetails();
        }
        this.fontComparison?.setOpen(open);
        this.elements.fontComparisonToggle.setAttribute('aria-expanded', String(open));
        this.elements.fontComparisonToggle.setAttribute('aria-label', open ? '書体の比較・情報・整理を閉じる' : '書体の比較・情報・整理を開く');
        this.elements.fontComparisonToggle.setAttribute('title', open ? '書体の比較・情報・整理を閉じる' : '書体の比較・情報・整理を開く');
    }

    _renderFontTree() {
        const org = this._fontData.organization || {};
        this.fontTree?.setModel({
            folders: Array.isArray(org.folders) ? org.folders : [],
            fonts: this._fontRowsForTree(),
            placements: org.placements || {},
            orders: org.orders || {},
            favoriteFirst: org.favoriteFirst === true
        });
        this._syncFontPicker();
    }

    _renderFontComparison() {
        const org = this._fontData.organization || {};
        this.fontComparison?.setData({
            folders: Array.isArray(org.folders) ? org.folders : [],
            rows: this._fontRowsForTree(),
            placements: org.placements || {},
            orders: org.orders || {},
            favoriteFirst: org.favoriteFirst === true
        });
        const selected = this._fontTarget === 'characters' ? this._fontRowsForTree().find(row => row.selectValue === this._informationFontValue)?.key : this._selectedTreeKey();
        this.fontComparison?.setCommittedKey(selected || '');
    }

    _onFontWheel(event) {
        if (event.ctrlKey || !this.elements.fontTree.hidden) return;
        const delta = Number(event.deltaY);
        if (!Number.isFinite(delta) || delta === 0) return;
        this._fontWheelRemainder += delta;
        if (Math.abs(this._fontWheelRemainder) < 40) {
            event.preventDefault();
            return;
        }
        const direction = this._fontWheelRemainder > 0 ? 1 : -1;
        this._fontWheelRemainder = 0;
        const values = this.fontTree?.getOrderedFontNodes?.().map(node => node.selectValue).filter(Boolean) || this._fontRowsForTree().map(row => row.selectValue);
        const current = values.indexOf(this.elements.fontSelect.value);
        const next = current + direction;
        if (current < 0 || next < 0 || next >= values.length) {
            event.preventDefault();
            return;
        }
        event.preventDefault();
        this._warmFontNeighbors(values, current);
        this._onFontSelected(values[next]);
    }

    _warmFontNeighbors(values, current) {
        if (typeof this.fonts.warmFonts !== 'function') return;
        const ids = values.slice(Math.max(0, current - 2), current + 3).map(value => this._fontIdFromSelectValue(value)).filter(Boolean);
        if (ids.length) void this.fonts.warmFonts([...new Set(ids)], { concurrency: 2, shouldContinue: () => this.isVisible });
    }

    _fontIdFromSelectValue(value) {
        if (String(value).startsWith(BUNDLED_PREFIX)) return String(value).slice(BUNDLED_PREFIX.length);
        if (String(value).startsWith(IMPORTED_PREFIX)) return String(value).slice(IMPORTED_PREFIX.length);
        return '';
    }

    _warmFontTreeVisible() {
        clearTimeout(this._fontTreeWarmTimer);
        const token = ++this._fontTreeWarmToken;
        if (this.elements.fontTree.hidden || typeof this.fonts.warmFonts !== 'function') return;
        this.fontTree?.updateFontPreviews?.();
        this._fontTreeWarmTimer = setTimeout(() => {
            if (token !== this._fontTreeWarmToken || this.elements.fontTree.hidden) return;
            const bounds = this.elements.fontTree.getBoundingClientRect();
            const ids = [...this.elements.fontTree.querySelectorAll('[data-node-type="font"]')]
                .filter(row => { const rect = row.getBoundingClientRect(); return rect.bottom > bounds.top && rect.top < bounds.bottom; })
                .map(row => this.fontTree.getNode(row.dataset.nodeKey))
                .filter(row => row && !row.system)
                .map(row => row.id)
                .slice(0, 8);
            void this.fonts.warmFonts(ids, { shouldContinue: () => token === this._fontTreeWarmToken && !this.elements.fontTree.hidden })
                .then(() => { if (token === this._fontTreeWarmToken) this.fontTree?.updateFontPreviews?.(); })
                .catch(() => {});
        }, 32);
    }

    _renderFontDetails() {
        const token = ++this._fontPreviewToken;
        clearTimeout(this._fontPreviewTimer);
        const row = this._fontRowsForTree().find(item => item.selectValue === (this._informationFontValue || this.elements.fontSelect?.value));
        const imported = !!row && !row.system;
        [this.elements.fontFavorite, this.elements.fontStorage, this.elements.fontNote].forEach(el => { el.disabled = !imported; });
        if (!row || row.system) {
            this.elements.fontTitle.textContent = row?.label || '';
            this.elements.fontCategory.textContent = row?.system ? '端末のフォント' : '';
            this.elements.fontCommentText.textContent = '';
            this.elements.fontMeta.textContent = '';
            this.elements.fontPrimary.hidden = true;
            this.elements.fontLoadStatus.textContent = '';
            this.elements.fontSamplePreview.textContent = 'Aあ1 あいうえお カキクケコ ABC123';
            this.elements.fontSamplePreview.style.fontFamily = row?.family || 'sans-serif';
            this.elements.fontLinks.replaceChildren();
            this.elements.fontNote.value = '';
            return;
        }
        const preferences = this.fonts.getPreferences?.() || {};
        const sample = FONT_SAMPLE_OPTIONS?.find(item => item.id === preferences.sampleId) || FONT_SAMPLE_OPTIONS?.[0] || { id: 'default', label: 'Aあ1', text: 'Aあ1 漫画' };
        this.elements.fontTitle.textContent = row.label || row.id;
        this.elements.fontCategory.textContent = row.category || (row.selectValue.startsWith(BUNDLED_PREFIX) ? '選定フォント' : '取り込みフォント');
        this.elements.fontCommentText.textContent = row.comment || (row.selectValue.startsWith(IMPORTED_PREFIX) ? 'このブラウザに取り込んだフォントです。' : '');
        this.elements.fontMeta.textContent = [row.coverage && `対応: ${row.coverage}`, row.tags?.length ? `用途: ${row.tags.slice(0, 4).join(' / ')}` : '', row.dakuten && `濁点: ${row.dakuten}`].filter(Boolean).join('　');
        this.elements.fontSample.innerHTML = (FONT_SAMPLE_OPTIONS || [sample]).map(item => `<option value="${escapeText(item.id)}">${escapeText(item.label)}</option>`).join('');
        this.elements.fontSample.value = sample.id;
        this.elements.fontFavorite.checked = preferences.favorites?.includes(row.id) === true;
        if (document.activeElement !== this.elements.fontNote) this.elements.fontNote.value = preferences.comments?.[row.id] || '';
        this.elements.fontFavoriteFirst.checked = this._fontData.organization?.favoriteFirst === true;
        this.elements.fontLinks.replaceChildren();
        for (const [label, url] of [['作者・公式', row.sourceUrl], ['ライセンス', row.licenseUrl]]) {
            if (!url || !/^https?:\/\//i.test(url)) continue;
            const link = document.createElement('a'); link.href = url; link.textContent = label; link.target = '_blank'; link.rel = 'noopener noreferrer';
            this.elements.fontLinks.append(link);
        }
        this.elements.fontPrimary.hidden = !row.selectValue.startsWith(BUNDLED_PREFIX);
        this.elements.fontPrimary.textContent = preferences.primaryId === row.id ? 'Primaryを解除' : 'Primaryにする';
        const loaded = this._getLoadedFont(row.id);
        if (loaded) this._applyFontPreview(loaded, sample, token, row.id);
        else {
            this.elements.fontLoadStatus.textContent = '見本を準備中…';
            this.elements.fontLoadStatus.dataset.state = 'loading';
            this.elements.fontSamplePreview.textContent = '選択を反映しています…';
            this.elements.fontSamplePreview.dataset.state = 'loading';
            this._fontPreviewTimer = setTimeout(() => { void this._loadFontPreview(row.id, sample, token); }, 32);
        }
        const organization = this._fontData.organization || {};
        const folderId = organization.placements?.[row.id] || '';
        this.elements.fontStorage.innerHTML = `<option value="">直下（ルート）</option>${(organization.folders || []).map(folder => `<option value="${escapeText(folder.id)}">${escapeText(folder.label || folder.name || folder.id)}</option>`).join('')}`;
        this.elements.fontStorage.value = folderId;
    }

    _applyFontPreview(entry, sample, token, id) {
        if (token !== this._fontPreviewToken || !entry) return;
        this.elements.fontLoadStatus.textContent = '見本を読み込みました';
        this.elements.fontLoadStatus.dataset.state = 'loaded';
        this.elements.fontSamplePreview.textContent = sample.text;
        this.elements.fontSamplePreview.dataset.state = 'loaded';
        this.elements.fontSamplePreview.style.fontFamily = `'${String(entry.family || '').replace(/["'\\]/g, '')}'`;
        this._fontPreviewRenderedId = id;
        this._fontPreviewRenderedSampleId = sample.id;
    }

    async _loadFontPreview(id, sample, token) {
        if (token !== this._fontPreviewToken) return;
        let entry = this._getLoadedFont(id);
        try { if (!entry) entry = await this.fonts.ensureLoaded?.(id); } catch (error) { entry = null; }
        if (token !== this._fontPreviewToken) return;
        if (!entry) {
            this.elements.fontLoadStatus.textContent = 'フォントを読み込めませんでした';
            this.elements.fontLoadStatus.dataset.state = 'error';
            this.elements.fontSamplePreview.textContent = '保存済み画素は維持されます。保管先を確認してください';
            this.elements.fontSamplePreview.dataset.state = 'error';
            return;
        }
        this._applyFontPreview(entry, sample, token, id);
    }

    async _moveOrganizationNode(placement) {
        if (!placement || typeof this.fonts.moveOrganizationNode !== 'function') return;
        try {
            await this.fonts.moveOrganizationNode(placement.nodeKey, placement.parentId || null, placement.beforeKey || null);
            await this._refreshFontData();
        } catch (error) {
            this._setStatus('フォント分類を変更できませんでした', 'error');
        }
    }

    async _refreshFontData() {
        const token = ++this._fontRefreshToken;
        const previous = this._fontData;
        const read = async (method, fallback) => {
            try { return typeof method === 'function' ? await method() : fallback; } catch (error) { return fallback; }
        };
        const [folders, fonts, bundled] = await Promise.all([
            read(() => this.fonts.listFolders?.(), previous.folders),
            read(() => this.fonts.listFonts?.(), previous.fonts),
            read(() => this.fonts.listBundledFonts?.(), previous.bundled)
        ]);
        if (token !== this._fontRefreshToken) return;
        const list = [...(Array.isArray(bundled) ? bundled : []), ...(Array.isArray(fonts) ? fonts : [])].map(item => item.id).filter(Boolean);
        let organization = previous.organization;
        try {
            await this.fonts.initializeOrganization?.(list);
            organization = await this.fonts.getOrganization?.(list) || organization;
        } catch (error) {}
        if (token !== this._fontRefreshToken) return;
        this._fontData = {
            folders: Array.isArray(folders) ? folders : previous.folders,
            fonts: Array.isArray(fonts) ? fonts : previous.fonts,
            bundled: sortBundledFonts(Array.isArray(bundled) ? bundled : previous.bundled, this.fonts.getPreferences?.() || {}),
            organization: organization || previous.organization
        };
        this._applyCatalogPrimary();
        this._renderFontOptions();
        this._renderFontTree();
        this._renderFontComparison();
        this._syncControls();
    }

    _applyCatalogPrimary() {
        if (this._paramsTouched || this._primaryApplied || this.params.fontId) return;
        const primary = this.fonts.getPreferences?.()?.primaryId || this._fontData.bundled.find(font => font.primary)?.id;
        if (!primary || !this._fontData.bundled.some(font => font.id === primary)) return;
        this._primaryApplied = true;
        this._setParams({ ...this.params, fontKind: 'imported', fontId: primary }, { recordUndo: false });
    }

    // ---------------------------------------------------------------------
    // Adapter boundary and popup protocol.

    async _commit(updating, close = false) {
        if (this._commitBusy) return { ok: false, reason: 'busy' };
        // Reopening an unchanged editable layer should not add another History
        // entry simply to finish the inspection session.
        if (close && updating && sameValue(this.params, this._sessionBaseline)) {
            this.hide();
            return { ok: true, unchanged: true };
        }
        this._commitBusy = true;
        this._syncControls();
        const revision = this._paramsRevision;
        try {
            const result = await (updating ? this.update() : this.apply());
            if (result?.ok && close && revision === this._paramsRevision) this.hide();
            return result;
        } catch (error) {
            this._setStatus(error?.message || '文字を確定できませんでした', 'error');
            return { ok: false, reason: error?.message };
        } finally {
            this._commitBusy = false;
            this._syncControls();
        }
    }

    commitAndClose() { return this._commit(!!this.editing?.layerId, true); }

    async apply() {
        const target = this.panelTarget.token();
        const rendered = await this._flushCurrent();
        if (!rendered) return { ok: false, reason: this.elements.errorStatus?.textContent || '文字を描画できません' };
        const committedRevision = this._paramsRevision;
        const params = clone(this.params);
        const result = await this.layerAdapter?.apply?.(params, target);
        if (!result?.ok) {
            this._setStatus(result?.reason || '文字を追加できませんでした', 'error');
            return result || { ok: false };
        }
        this.editing = result.caf ? null : { layerId: result.layerId || null };
        this._curveEntryInitialized = true;
        const changedDuringCommit = committedRevision !== this._paramsRevision;
        this._sessionBaseline = clone(params);
        if (!changedDuringCommit) this._sessionUndo = [];
        this._paramsTouched = changedDuringCommit;
        if (result.caf && !changedDuringCommit) { this._previewSuspended = true; this.layerAdapter.endPreview?.(); }
        this._setStatus(changedDuringCommit
            ? '追加済みです。適用中に変えた入力は「更新」で反映してください'
            : '文字を追加しました', changedDuringCommit ? 'error' : 'success');
        this._syncControls();
        this.overlay.schedule();
        return result;
    }

    async update() {
        if (!this.editing?.layerId) {
            this._setStatus('「選択レイヤーを編集」で更新する文字を選んでください', 'error');
            return { ok: false, reason: 'no-editing-layer' };
        }
        const rendered = await this._flushCurrent();
        if (!rendered) return { ok: false, reason: this.elements.errorStatus?.textContent || '文字を描画できません' };
        const committedRevision = this._paramsRevision;
        const params = clone(this.params);
        const result = await this.layerAdapter?.update?.(this.editing.layerId, params);
        if (!result?.ok) {
            this._setStatus(result?.reason || '文字Layerを更新できませんでした', 'error');
            return result || { ok: false };
        }
        const changedDuringCommit = committedRevision !== this._paramsRevision;
        this._sessionBaseline = clone(params);
        if (!changedDuringCommit) this._sessionUndo = [];
        this._paramsTouched = changedDuringCommit;
        if (!changedDuringCommit) this.layerAdapter.endPreview?.();
        this._setStatus(changedDuringCommit
            ? '更新済みです。適用中に変えた入力はもう一度「更新」してください'
            : '文字Layerを更新しました', changedDuringCommit ? 'error' : 'success');
        this.overlay.schedule();
        return result;
    }

    async loadFromActiveLayer() {
        this.layerAdapter.endPreview?.();
        const result = await this.layerAdapter?.loadActive?.();
        if (!result?.ok || !result.params) {
            this._setStatus(result?.reason || '選択中のLayerに再編集できる文字情報がありません', 'error');
            return result || { ok: false };
        }
        this._endDrag({ cancel: true });
        this.sizeSlots?.clearSelection();
        this.activeTab = 'whole'; this.mode = 'whole'; this.characterSelection = null;
        this._informationFontValue = ''; this._fontTarget = 'whole'; this._profileChoice = null; this._outwardPreset = false;
        this.params = normalizeLetteringParams(result.params, this._canvasSize());
        this._sessionBaseline = clone(this.params);
        this._sessionUndo = [];
        this._paramsTouched = true;
        this.editing = { layerId: result.layerId || null };
        this._previewSuspended = false;
        this._lastValid = null;
        this._paramsRevision += 1;
        this._syncControls();
        this._schedulePreview();
        if (result.intact === false) {
            this._setStatus(result.reason || '画素が変更されています。「追加」で別の文字レイヤーを作成してください', 'error');
        } else {
            this._setStatus('文字を読み込みました。編集して「更新」できます', 'success');
        }
        return result;
    }

    newSession() {
        this.sizeSlots?.clearSelection();
        this.layerAdapter.endPreview?.();
        this._endDrag({ cancel: true });
        const previousFont = this.params || {};
        const retainedFont = {
            fontKind: previousFont.fontKind === 'system' ? 'system' : 'imported',
            fontId: String(previousFont.fontId || ''),
            fontFamily: String(previousFont.fontFamily || 'sans-serif')
        };
        let primaryId = retainedFont.fontId;
        if (!primaryId && retainedFont.fontKind !== 'system') {
            try {
                primaryId = this.fonts.getPreferences?.()?.primaryId
                    || this._fontData.bundled.find(font => font.primary)?.id
                    || '';
            } catch (error) { primaryId = ''; }
        }
        this.editing = null;
        this.mode = 'whole';
        this.activeTab = 'whole'; this.characterSelection = null;
        this._curveEntryInitialized = false;
        this._informationFontValue = ''; this._fontTarget = 'whole'; this._profileChoice = null; this._outwardPreset = false;
        this._characterOutlineView = false;
        this.placementTarget = 'curve';
        this.selectedNodeId = '';
        this.selectedEnvelopeIndex = -1;
        this._sessionUndo = [];
        const next = defaultLetteringParams(this._canvasSize());
        if (retainedFont.fontKind === 'system') Object.assign(next, retainedFont);
        else if (primaryId) Object.assign(next, { ...retainedFont, fontId: primaryId });
        this.params = normalizeLetteringParams(next, this._canvasSize());
        if (!this.params.text) this.params.text = 'タイトル';
        this._sessionBaseline = clone(this.params);
        this._paramsTouched = false;
        this._primaryApplied = this.params.fontKind === 'imported' && !!this.params.fontId;
        this._previewSuspended = false;
        this._lastValid = null;
        this._paramsRevision += 1;
        this._syncControls();
        this._schedulePreview();
        this._setStatus('新しい文字を編集中', 'success');
        return { ok: true, params: clone(this.params) };
    }

    async cancel() {
        this.sizeSlots?.clearSelection();
        this.layerAdapter.endPreview?.();
        this._endDrag({ cancel: true });
        clearTimeout(this._previewTimer);
        this._previewTimer = null;
        // Invalidate in-flight work before awaiting the adapter so an old
        // preview cannot reappear while the committed layer is being restored.
        this._previewGeneration += 1;
        this._previewSuspended = true;
        this._lastValid = null;
        if (this.editing?.layerId && typeof this.layerAdapter?.cancel === 'function') {
            try { await this.layerAdapter.cancel(this.editing.layerId); } catch (error) {}
        }
        this.params = clone(this._sessionBaseline || defaultLetteringParams(this._canvasSize()));
        this.editing = null;
        this.mode = 'whole';
        this.activeTab = 'whole'; this.characterSelection = null; this._transformInput = false;
        this._informationFontValue = ''; this._fontTarget = 'whole'; this._profileChoice = null; this._outwardPreset = false;
        this._sessionUndo = [];
        // Keep the overlay empty until an explicit new input/session/load/show
        // resumes preview; cancel never schedules a replacement ghost.
        this._paramsRevision += 1;
        this._syncControls();
        this.overlay.schedule();
        this._setStatus('編集を取り消しました', 'success');
        return { ok: true };
    }

    show() {
        const wasVisible = this.isVisible === true;
        if (!this.popup) this._ensurePopupElement();
        if (!this.popup) return;
        this.popup.classList.add('show');
        this.isVisible = true;
        this._previewSuspended = false;
        mountMangaTabs(this.popup.querySelector('[data-role="manga-tabs"]'), 'lettering');
        noteMangaTabShown('lettering');
        this._renderFontOptions();
        this._syncControls();
        this.overlay.setVisible(true);
        if (!this._lastValid) this._schedulePreview();
        if (!this._fontData.bundled.length && !this._fontData.fonts.length) void this._refreshFontData();
        if (!wasVisible) this.eventBus?.emit?.('popup:shown', { name: 'lettering' });
        this._fitViewport();
    }

    _fitViewport() {
        if (!this.isVisible || !this.popup) return;
        // Popup fade-in scales its visual bounds. Layout dimensions avoid
        // treating that temporary shrink as extra room in the viewport.
        const width = this.popup.offsetWidth;
        const height = this.popup.offsetHeight;
        const margin = 6;
        this.popup.style.left = `${Math.max(margin, Math.min(parseFloat(this.popup.style.left) || margin, window.innerWidth - width - margin))}px`;
        this.popup.style.top = `${Math.max(margin, Math.min(parseFloat(this.popup.style.top) || margin, window.innerHeight - height - margin))}px`;
        this.fontComparison?.reposition?.();
    }

    hide() {
        this.layerAdapter.endPreview?.();
        if (!this.popup) return;
        const wasVisible = this.isVisible === true;
        this.popup.classList.remove('show');
        this.isVisible = false;
        this._transformInput = false;
        this._endDrag({ cancel: true });
        this._toggleFontTree(false);
        this._toggleFontComparison(false);
        this.overlay.setVisible(false);
        if (wasVisible) this.eventBus?.emit?.('popup:hidden', { name: 'lettering' });
    }

    toggle() {
        if (this.isVisible) this.hide();
        else this.show();
    }

    isReady() {
        return !!this.popup;
    }

    destroy() {
        window.removeEventListener('resize', this._resizeListener);
        window.removeEventListener('keydown', this._modifierDown, true);
        window.removeEventListener('keyup', this._modifierUp, true);
        window.removeEventListener('blur', this._blurInput);
        window.removeEventListener('wheel', this._canvasWheel, true);
        this._numericCleanups.forEach(detach => detach());
        this._numericCleanups = [];
        this.layerAdapter.destroy?.();
        this._endDrag({ cancel: true });
        clearTimeout(this._previewTimer);
        clearTimeout(this._fontTreeWarmTimer);
        clearTimeout(this._fontPreviewTimer);
        this.popupDragCleanup?.();
        this.popupDragCleanup = null;
        this._offFonts?.();
        this.eventBus?.off?.('layer:activated', this._layerListener);
        this.eventBus?.off?.('layer:content-changed', this._sourceChanged);
        this.eventBus?.off?.('history:changed', this._sourceHistory);
        this.fontManagement?.destroy();
        this.fontComparison?.destroy?.();
        // FontComparison mounts its fixed host beside the popup; remove that
        // host explicitly because it is no longer a child of this.popup.
        this.elements.fontComparison?.remove?.();
        this.overlay.destroy();
        this.popup?.remove();
        this.popup = null;
    }
}

