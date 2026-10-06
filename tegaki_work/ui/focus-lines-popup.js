/**
 * ============================================================================
 * ファイル名: ui/focus-lines-popup.js
 * 責務: 集中線 / ウニフラ / 閉輪郭のpopup。Canvas上のruntime previewを編集し、
 *       確定時だけ通常Raster Layerを1件のHistoryで追加/更新する。
 * 依存: system/focus-lines.js, system/focus-lines-raster.js, system/history.js,
 *   system/event-bus.js, ui/focus-lines-overlay.js, ui/manga-canvas-navigation.js,
 *   ui/manga-tabs.js, ui/numeric-field.js, ui/popup-drag-helper.js, ui/feedback-toast.js, ui/manga-edit-actions.js
 * 被依存: core-engine.js, system/popup-manager.js
 * 公開API: FocusLinesPopup
 * 保存: 編集中のparamsはlocalStorage(UI設定)。確定Layerは通常Raster Layerで、
 *   再編集用にlayerData.focusLines(optional・sanitize済み)を持つ。画素は派生物。
 * 境界: Canvas/Project/Historyの正本を持たず、本文や新Layer schemaを追加しない。
 * 新規preset/pureウニ: focus-lines-presets.js / focus-flash-geometry.js。旧ray/bodyは分離。
 * 再編集の表示抑制: 既存capture-safe lettering-preview-display registryを共用。
 * 検証入口: verify-focus-lines*.mjs, verify-focus-flash.mjs, wp030-dense-flash-browser.html
 * ============================================================================
 */

import { TegakiEventBus } from '../system/event-bus.js';
import { historyManager } from '../system/history.js';
import { cafMangaTarget, appendMangaRaster, restoreMangaTargetControls, syncMangaTargetControls } from './caf-manga-target.js';
import {
    FOCUS_BODY_LIMITS,
    FOCUS_LINES_LIMITS,
    FOCUS_LINES_STYLES,
    buildFocusLines,
    buildFocusLinesBody,
    focusLinesHandles,
    normalizeFocusLinesParams,
    sanitizeFocusLinesData
} from '../system/focus-lines.js';
import { buildFocusFlash, FOCUS_FLASH_LIMITS } from '../system/focus-flash-geometry.js';
import { FOCUS_PRESETS, resolveFocusLinesPreset } from '../system/focus-lines-presets.js';
import { ghostMangaPreviewSource, restoreLetteringPreviewSource } from '../system/lettering-preview-display.js';
import { MangaPanelTarget } from './manga-panel-target.js';
import { rasterizeFocusLines } from '../system/focus-lines-raster.js';
import { FocusLinesOverlay } from './focus-lines-overlay.js';
import { attachMangaCanvasNavigation } from './manga-canvas-navigation.js';
import { mountMangaTabs, noteMangaTabShown } from './manga-tabs.js';
import { mountMangaEditActions } from './manga-edit-actions.js';
import { attachNumericField } from './numeric-field.js';
import { attachPopupDrag, mountPopupAtOverlayRoot } from './popup-drag-helper.js';
import { showFeedbackToast } from './feedback-toast.js';

const STORAGE_KEY = 'tegaki-focus-lines-v1';
const POPUP_ID = 'focus-lines-popup';
const L = FOCUS_LINES_LIMITS;

const CONTEXTS = Object.freeze([
    { id: 'shape', label: '基本' },
    { id: 'layout', label: '配置' },
    { id: 'variance', label: 'ばらつき' }
]);

// NumericField remains the single wheel/double-click path for every numeric
// control.  body.* fields are mapped explicitly so body remains optional.
const FIELDS = Object.freeze([
    { key: 'count', path: ['count'], label: '本数', bodyLabel: 'とげ数', min: L.count.min, max: L.count.max, step: 1, unit: '本', context: 'common' },
    { key: 'widthMin', path: ['widthMin'], label: '太さ(細)', min: L.width.min, max: L.width.max, step: 0.5, unit: 'px', context: 'common', rayOnly: true },
    { key: 'widthMax', path: ['widthMax'], label: '太さ(太)', min: L.width.min, max: L.width.max, step: 0.5, unit: 'px', context: 'common', rayOnly: true },
    { key: 'flashDepth', path: ['flash', 'depth'], label: '帯の深さ', min: FOCUS_FLASH_LIMITS.depth.min, max: FOCUS_FLASH_LIMITS.depth.max, step: .01, unit: '%', toDisplay: value => Math.round(value * 100), fromDisplay: value => value / 100, wheelStep: .05, context: 'common', flashOnly: true },
    { key: 'ellipseWidth', path: ['flash', 'ellipseWidth'], label: '楕円線幅', min: .5, max: 60, step: .5, unit: 'px', context: 'shape', flashOnly: true },
    { key: 'taper', path: ['taper'], label: '尖らせ', min: 0, max: 1, step: 0.01, unit: '%', toDisplay: value => Math.round(value * 100), fromDisplay: value => value / 100, wheelStep: 0.05, context: 'variance', rayOnly: true },
    { key: 'angleJitter', path: ['angleJitter'], label: '角度ばらつき', min: 0, max: 1, step: 0.01, unit: '%', toDisplay: value => Math.round(value * 100), fromDisplay: value => value / 100, wheelStep: 0.05, context: 'variance' },
    { key: 'lengthJitter', path: ['lengthJitter'], label: '長さばらつき', min: 0, max: 1, step: 0.01, unit: '%', toDisplay: value => Math.round(value * 100), fromDisplay: value => value / 100, wheelStep: 0.05, context: 'variance' },
    { key: 'innerRx', path: ['innerRx'], label: '抜け 横', bodyLabel: '内側 横半径', min: 0, max: L.inner.max, step: 1, unit: 'px', context: 'layout' },
    { key: 'innerRy', path: ['innerRy'], label: '抜け 縦', bodyLabel: '内側 縦半径', min: 0, max: L.inner.max, step: 1, unit: 'px', context: 'layout' },
    { key: 'outer', path: ['outer'], label: '外へ', bodyLabel: '先端半径', min: 0, max: L.outer.max, step: 1, unit: 'px', zeroLabel: '端まで', context: 'layout' },
    { key: 'bodyLineWidth', path: ['body', 'lineWidth'], label: '枠線の太さ', min: FOCUS_BODY_LIMITS.lineWidth.min, max: FOCUS_BODY_LIMITS.lineWidth.max, step: FOCUS_BODY_LIMITS.lineWidth.step, unit: 'px', context: 'shape', body: true },
    { key: 'bodyInset', path: ['body', 'inset'], label: '中抜き', min: FOCUS_BODY_LIMITS.inset.min, max: FOCUS_BODY_LIMITS.inset.max, step: FOCUS_BODY_LIMITS.inset.step, unit: '%', toDisplay: value => Math.round(value * 100), fromDisplay: value => value / 100, wheelStep: 0.05, context: 'shape', body: true }
]);

function getPath(object, path) {
    return path.reduce((value, key) => value?.[key], object);
}

function setPath(object, path, value) {
    const next = structuredClone(object);
    let cursor = next;
    path.slice(0, -1).forEach(key => {
        if (!cursor[key] || typeof cursor[key] !== 'object') cursor[key] = {};
        cursor = cursor[key];
    });
    cursor[path[path.length - 1]] = value;
    return next;
}

function numberToHex(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return '#f0e0d6';
    return `#${(Math.max(0, Math.min(0xffffff, Math.trunc(number))) >>> 0).toString(16).padStart(6, '0')}`;
}

export class FocusLinesPopup {
    constructor(dependencies = {}) {
        this.layerSystem = dependencies.layerSystem || null;
        this.eventBus = dependencies.eventBus || TegakiEventBus;
        this.history = dependencies.history || historyManager;
        this.popup = null;
        this.isVisible = false;
        this.popupDragCleanup = null;
        this.elements = {};
        this.params = normalizeFocusLinesParams(resolveFocusLinesPreset('focus', this._canvasSize()), this._canvasSize());
        this.context = 'shape';
        this.editing = null; // { layerId }
        this.drag = null;
        this.polygons = [];
        this.body = null;
        this.flash = null;
        this.draftActive = true;
        this.placeMode = false;
        this.previewSource = null;
        this.paperColor = this._backgroundColorHex();
        this._spacePressed = false;
        this._fieldDetachers = [];

        this.overlay = new FocusLinesOverlay({
            eventBus: this.eventBus,
            onPointerDown: (target, event) => this._onOverlayPointerDown(target, event),
            getState: () => this.isVisible && this.draftActive ? {
                params: this.params,
                canvas: this._canvasSize(),
                polygons: this.polygons,
                body: this.body,
                flash: this.flash,
                placeMode: this.placeMode
            } : null
        });
        this._layerListener = () => this._syncControls();
        this._contentListener = payload => {
            if (payload?.layerId === this.editing?.layerId && !String(payload?.source || '').startsWith('focus-lines')) {
                this._endPreview(); this.draftActive = false; this.editing = null;
                this._syncControls(); this.overlay.schedule();
            }
        };
        this.eventBus?.on?.('layer:content-changed', this._contentListener);
        this._historyListener = payload => {
            if (!['undo','redo','clear'].includes(payload?.action) || !this.editing) return;
            this._endPreview(); this.draftActive = false; this.placeMode = false; this.endDrag();
            const layer = this.layerSystem?.getLayers?.().find(item=>item.layerData?.id===this.editing.layerId);
            const recipe = sanitizeFocusLinesData(layer?.layerData?.focusLines, this._canvasSize());
            if (recipe) this.params = recipe.params; else this.editing = null;
            this._syncControls(); this._redraw();
        };
        this.eventBus?.on?.('history:changed',this._historyListener);
        this._escapeListener = event => {
            if (!this.isVisible || !this.placeMode || event.key !== 'Escape' || event.isComposing) return;
            const before = this.drag?.type === 'place' ? this.drag.baseline : null;
            this.endDrag(); this.placeMode = false; if (before) this._setParams(before);
            this._syncControls(); this.overlay.schedule();
            event.preventDefault();
        };
        window.addEventListener('keydown', this._escapeListener);
        this.eventBus?.on?.('layer:activated', this._layerListener);
        this._navigation = attachMangaCanvasNavigation({
            isVisible: () => this.isVisible,
            getSvg: () => this.overlay.svg,
            onSpace: pressed => {
                this._spacePressed = pressed === true;
                if (this._spacePressed) this.endDrag();
                this.overlay.schedule();
            }
        });
        this._resizeListener = () => { if (this.isVisible) this._fitViewport(); };
        window.addEventListener('resize', this._resizeListener);

        this._restore();
        this._ensurePopupElement();
    }

    // ------------------------------------------------------------ UI設定

    _restore() {
        try {
            const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
            if (/^#[0-9a-f]{6}$/i.test(data?.paperColor || '')) this.paperColor = data.paperColor;
            if (data?.params) this.params = normalizeFocusLinesParams(data.params, this._canvasSize());
            // Legacy showOverlay is deliberately ignored. Canvas is the primary
            // editor and the overlay must remain available after an old OFF save.
        } catch (error) {
            // 壊れた設定は既定へ戻す(Projectには無関係)
        }
    }

    _persist() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ params: this.params, paperColor: this.params.flash?.paperColor || this.paperColor }));
        } catch (error) {
            // localStorage不可でも動作は続ける
        }
    }

    // ------------------------------------------------------------ DOM

    _canvasSize() {
        const c = this.layerSystem?.config?.canvas || window.TEGAKI_CONFIG?.canvas || {};
        return { width: Math.max(1, Math.round(c.width || 800)), height: Math.max(1, Math.round(c.height || 800)) };
    }

    _ensurePopupElement() {
        let popup = document.getElementById(POPUP_ID);
        if (!popup) {
            popup = document.createElement('div');
            popup.id = POPUP_ID;
            popup.className = 'popup-panel popup-panel--translucent focus-lines-popup';
            popup.style.top = '60px';
            popup.style.left = '60px';
            (document.querySelector('.main-layout') || document.body).appendChild(popup);
        } else {
            mountPopupAtOverlayRoot(popup);
        }
        this.popup = popup;
        this._build();
        this.popupDragCleanup = attachPopupDrag(popup, {
            interactiveSelector: 'button, input, select, textarea, a, summary, .pl-value, .popup-close-btn, .ui-close-button'
        });
    }

    _build() {
        const closeBtn = window.DOMBuilder
            ? window.DOMBuilder.createCloseButton(POPUP_ID).outerHTML
            : `<button class="ui-close-button ui-close-button--medium popup-close-btn" data-action="close-popup" data-target="${POPUP_ID}" type="button">${window.UI_ICONS?.close || '×'}</button>`;
        const modes = [['rays', '従来の放射'], ['outline', 'ギザ枠'], ['ring', '二重枠']]
            .map(([id,label]) => `<button type="button" class="pl-chip" data-mode="${id}">${label}</button>`).join('');
        const contexts = CONTEXTS.map(({id,label}) => `<button type="button" class="pl-chip" role="tab" data-context="${id}">${label}</button>`).join('');
        const fields = context => FIELDS.filter(field => field.context === context).map(field => `
            <label class="pl-row focus-lines-field" data-row="${field.key}" data-context-row="${context}">
                <span class="pl-label" data-label-for="${field.key}">${field.label}</span>
                <input type="range" class="pl-range" data-field="${field.key}" min="${field.min}" max="${field.max}" step="${field.unit === 'px' ? .001 : field.step}">
                <span class="pl-value" data-value-for="${field.key}"></span>
            </label>`).join('');
        const presets = FOCUS_PRESETS.map(preset => `<button type="button" class="pl-chip fl-preset" data-preset="${preset.id}" aria-pressed="false"><svg viewBox="0 0 100 70" aria-hidden="true"></svg><span>${preset.label}</span></button>`).join('');
        const styles = FOCUS_LINES_STYLES.map(style => `<button type="button" class="pl-chip" data-style="${style.id}">${style.label}</button>`).join('');
        this.popup.innerHTML = `
            ${closeBtn}<div class="manga-tabs-host" data-role="manga-tabs"></div>
            <div class="pl-title">集中線・フラッシュ <span class="pl-edit-status" data-role="edit-status"></span></div>
            <div class="fl-presets" role="group" aria-label="完成形から選ぶ">${presets}</div>
            <div class="pl-actions fl-place-actions"><button type="button" class="pl-btn" data-action="place" aria-pressed="false">範囲を描く</button><button type="button" class="pl-btn" data-action="guide" title="範囲配置を解除し、現在の形のGuideを再表示。確定画素は変更しません">Guideを戻す</button><button type="button" class="pl-btn" data-action="reseed">別の形</button></div>
            <div class="pl-hint focus-lines-canvas-hint" data-role="canvas-hint"></div>
            <div class="focus-lines-body-scroll ui-scrollbar">
                <div class="fl-common">${fields('common')}</div>
                <div class="focus-lines-context-tabs" role="tablist" aria-label="集中線の設定">${contexts}</div>
                <section data-context-pane="shape" role="tabpanel" aria-label="色と塗り">
                    <div class="pl-row fl-colors"><span class="pl-label">線 / 下地</span><input type="color" class="pl-color" data-role="color" aria-label="線の色"><input type="color" class="pl-color" data-role="paper-color" aria-label="下地の色"><button type="button" class="pl-chip" data-action="swap-colors" title="線と下地の色を交換">反転</button><button type="button" class="pl-chip" data-action="canvas-color" title="下地の色を作品のCanvas背景色へ戻す">Canvas色</button></div>
                    <div data-flash-controls>
                        <div class="pl-row"><span class="pl-label">ベタ</span><span class="pl-chips">${[['none','なし'],['inside','中ベタ'],['outside','外ベタ']].map(([id,label])=>`<button type="button" class="pl-chip" data-fill="${id}" title="${id==='outside'?'Canvas全面の外側を線色で塗る':label}">${label}</button>`).join('')}</span></div>
                        <div class="pl-hint fl-scope-hint" data-role="scope-hint" hidden>外ベタはCanvas全面。コマへのclipはLayer側で設定。</div>
                        <label class="pl-row"><span class="pl-label">追加楕円</span><select class="pl-select" data-role="ellipse" aria-label="追加楕円"><option value="none">なし</option><option value="fill">下地色で塗る</option><option value="outline">輪郭線を置く</option></select></label>
                    </div>
                    <label class="pl-row pl-check focus-lines-fill-toggle" data-role="fill-row"><input type="checkbox" data-role="body-fill-toggle"><span>内側を塗る</span><input type="color" class="pl-color" data-role="body-fill-color" aria-label="内側の色"></label>
                    ${fields('shape')}
                </section>
                <section data-context-pane="layout" role="tabpanel" aria-label="配置" hidden>
                    <div class="pl-actions"><button type="button" class="pl-btn" data-action="center-canvas">中心を中央へ</button><button type="button" class="pl-btn" data-action="center-ruler" data-role="ruler-btn">定規の中心</button></div>
                    ${fields('layout')}
                </section>
                <section data-context-pane="variance" role="tabpanel" aria-label="ばらつきと詳細" hidden>
                    ${fields('variance')}
                    <div class="pl-row" data-ray-controls><span class="pl-label">線の向き</span><span class="pl-chips"><button type="button" class="pl-chip" data-direction="in">中心へ尖る</button><button type="button" class="pl-chip" data-direction="out">外へ尖る</button></span></div>
                    <details class="fl-legacy"><summary>従来の形・プリセット</summary><div class="pl-chips">${modes}</div><div class="pl-chips" data-ray-controls>${styles}</div></details>
                </section>
            </div>
            <div class="focus-lines-fixed-footer fl-fixed-footer">
                <div class="pl-footer"><button type="button" class="pl-btn" data-action="reset" title="編集中の設定を標準の新規形状へ戻す。確定レイヤーは変更しません">初期化</button><button type="button" class="pl-btn" data-action="load-active">レイヤーから再編集</button></div>
                <div class="pl-footer"><button type="button" class="pl-btn pl-btn--primary" data-action="update" data-role="update-btn" hidden>編集中のレイヤーを更新</button><button type="button" class="pl-btn pl-btn--primary" data-action="apply">新規レイヤーに適用</button></div>
            </div>`;
        mountMangaEditActions(this.popup, { before: this.popup.querySelector('.pl-title') });
        this.panelTarget = new MangaPanelTarget({ root: this.popup, layerSystem: this.layerSystem, history: this.history });
        const q = selector => this.popup.querySelector(selector);
        this.elements = {
            editStatus: q('[data-role="edit-status"]'),
            updateBtn: q('[data-role="update-btn"]'),
            loadBtn: q('[data-action="load-active"]'),
            color: q('[data-role="color"]'),
            paperColor: q('[data-role="paper-color"]'),
            ellipse: q('[data-role="ellipse"]'),
            bodyFillToggle: q('[data-role="body-fill-toggle"]'),
            bodyFillColor: q('[data-role="body-fill-color"]'),
            fillRow: q('[data-role="fill-row"]'),
            rulerBtn: q('[data-role="ruler-btn"]')
        };
        this._renderPresetSamples();
        this._bind();
        this._syncControls();
        this._redraw();
    }

    // ------------------------------------------------------------ 操作

    _bind() {
        const root = this.popup;
        root.querySelectorAll('[data-context]').forEach(button => button.addEventListener('click', () => {
            this.context = button.dataset.context;
            this._syncControls();
        }));
        root.querySelectorAll('[data-preset]').forEach(button => button.addEventListener('click', () => {
            this.context = 'shape';
            this._setParams(resolveFocusLinesPreset(button.dataset.preset, this._canvasSize(), this.params));
            if (this.params.flash) this._setParams(setPath(this.params, ['flash','paperColor'], this._backgroundColorHex()));
            this.placeMode = true; this._syncControls(); this.overlay.schedule();
        }));
        root.querySelectorAll('[data-fill]').forEach(button => button.addEventListener('click', () => this._setParams(setPath(this.params, ['flash','fill'], button.dataset.fill))));
        this.elements.paperColor.addEventListener('input', event => {
            this.paperColor = event.target.value;
            this._setParams(this.params.flash ? setPath(this.params, ['flash','paperColor'], event.target.value) : this.params);
        });
        this.elements.ellipse.addEventListener('change', event => this._setParams(setPath(this.params, ['flash','ellipse'], event.target.value)));
        root.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => this._setMode(button.dataset.mode)));
        root.querySelectorAll('[data-style]').forEach(button => button.addEventListener('click', () => {
            const style = FOCUS_LINES_STYLES.find(entry => entry.id === button.dataset.style);
            if (style) { const next = { ...this.params, ...style.patch }; delete next.flash; this._setParams(next); }
        }));
        root.querySelectorAll('[data-direction]').forEach(button => button.addEventListener('click', () => this._setParams({ ...this.params, direction: button.dataset.direction })));
        root.querySelectorAll('input[data-field]').forEach(input => input.addEventListener('input', () => {
            const field = FIELDS.find(item => item.key === input.dataset.field);
            if (!field) return;
            // range.value is already in model units. NumericField alone maps
            // the compact percentage text used by double-click editing.
            this._setParams(setPath(this.params, field.path, Number(input.value)));
        }));
        this.elements.color.addEventListener('input', event => this._setParams({ ...this.params, color: event.target.value }));
        this.elements.bodyFillToggle.addEventListener('change', event => {
            if (!this.params.body) return;
            const fillColor = event.target.checked ? this._backgroundColorHex() : null;
            this._setParams(setPath(this.params, ['body', 'fillColor'], fillColor));
        });
        this.elements.bodyFillColor.addEventListener('input', event => {
            if (this.params.body && this.elements.bodyFillToggle.checked) this._setParams(setPath(this.params, ['body', 'fillColor'], event.target.value));
        });
        root.querySelectorAll('[data-action]').forEach(button => {
            if (button.dataset.action === 'close-popup') return;
            button.addEventListener('click', () => this._onAction(button.dataset.action));
        });
        this._fieldDetachers = Array.from(root.querySelectorAll('input[data-field]')).map(input => {
            const field = FIELDS.find(item => item.key === input.dataset.field);
            return attachNumericField({
                range: input,
                valueEl: root.querySelector(`[data-value-for="${input.dataset.field}"]`),
                toDisplay: field?.toDisplay || (value => Math.round(value * 100) / 100),
                fromDisplay: field?.fromDisplay,
                wheelStep: field?.wheelStep ?? field?.step ?? null
            });
        });
    }

    _onAction(action) {
        if (action === 'reset') {
            this._endPreview(); this.editing = null; this.context = 'shape'; this.placeMode = false;
            const next = resolveFocusLinesPreset(this.params.flash ? 'uni' : 'focus', this._canvasSize());
            this.paperColor = this._backgroundColorHex();
            if (next.flash) next.flash.paperColor = this.paperColor;
            this._setParams(next);
        } else if (action === 'guide') {
            this.endDrag(); this.placeMode = false;
            const size = this._canvasSize(), center = this.params.center;
            const visible = center.x >= 0 && center.x <= size.width && center.y >= 0 && center.y <= size.height;
            this._setParams(visible ? this.params : { ...this.params, center: { x: size.width / 2, y: size.height / 2 } });
        } else if (action === 'place') {
            this.placeMode = !this.placeMode; this.draftActive = true; this._syncControls(); this._redraw();
        } else if (action === 'swap-colors') {
            const paper = this.params.flash?.paperColor || this.paperColor; this.paperColor = this.params.color;
            const next = {...this.params,color:paper}; if(next.flash) next.flash={...next.flash,paperColor:this.paperColor};
            this._setParams(next);
        } else if (action === 'canvas-color') {
            this.paperColor = this._backgroundColorHex();
            this._setParams(this.params.flash ? setPath(this.params,['flash','paperColor'],this.paperColor) : this.params);
        } else if (action === 'reseed') {
            this._setParams({ ...this.params, seed: Math.floor(Math.random() * 0x7fffffff) });
        } else if (action === 'center-canvas') {
            const size = this._canvasSize();
            this._setParams({ ...this.params, center: { x: size.width / 2, y: size.height / 2 } });
        } else if (action === 'center-ruler') {
            const ruler = window.rulerSystem?.getState?.();
            if (!ruler?.center) return showFeedbackToast('定規の中心が取得できません');
            this._setParams({ ...this.params, center: { ...ruler.center } });
        } else if (action === 'apply') {
            this.apply();
        } else if (action === 'update') {
            this.update();
        } else if (action === 'load-active') {
            this.loadFromActiveLayer();
        }
    }

    _setMode(mode) {
        this.context = 'shape'; this.placeMode = false;
        if (mode === 'rays') {
            const next = { ...this.params };
            delete next.body; delete next.flash;
            this._setParams(next);
            return;
        }
        const size = this._canvasSize();
        const previous = this.params.body;
        const body = {
            kind: mode === 'ring' ? 'ring' : 'outline',
            lineWidth: previous?.lineWidth ?? 3,
            fillColor: previous?.fillColor ?? this._backgroundColorHex(),
            inset: previous?.inset ?? 0.25
        };
        const outer = this.params.outer > 0 ? this.params.outer : this._bodyOuter(size);
        const next = { ...this.params, body, direction: 'out', outer }; delete next.flash;
        this._setParams(next);
    }

    _setParams(next) {
        this.draftActive = true;
        this.params = normalizeFocusLinesParams(next, this._canvasSize());
        if (this.params.flash) this.paperColor = this.params.flash.paperColor;
        this._persist();
        this._syncControls();
        this._redraw();
    }

    _activeFocusLines() {
        const data = this.layerSystem?.getActiveLayer?.()?.layerData?.focusLines;
        return data ? sanitizeFocusLinesData(data, this._canvasSize()) : null;
    }

    _syncControls() {
        restoreMangaTargetControls(this.popup);
        if (!this.popup) return;
        const mode = this.params.body?.kind || 'rays';
        this.popup.querySelectorAll('[data-context]').forEach(button => {
            const on = button.dataset.context === this.context;
            button.setAttribute('aria-selected', String(on));
            button.setAttribute('aria-pressed', String(on));
            button.classList.toggle('is-selected', on);
        });
        this.popup.querySelectorAll('[data-context-pane]').forEach(pane => { pane.hidden = pane.dataset.contextPane !== this.context; });
        this.popup.querySelectorAll('[data-mode]').forEach(button => {
            const on = button.dataset.mode === mode;
            button.setAttribute('aria-pressed', String(on));
            button.classList.toggle('is-selected', on);
        });
        const bodyMode = !!this.params.body;
        const bodyKind = this.params.body?.kind;
        const flashMode = !!this.params.flash;
        this.popup.querySelectorAll('[data-ray-controls]').forEach(row => { row.hidden = bodyMode || flashMode; });
        this.popup.querySelectorAll('[data-flash-controls]').forEach(row => { row.hidden = !flashMode; });
        this.elements.paperColor.hidden = false;
        this.elements.paperColor.value = this.params.flash?.paperColor || this.paperColor;
        this.elements.ellipse.value = this.params.flash?.ellipse || 'none';

        this.popup.querySelectorAll('[data-fill]').forEach(button => { const on = button.dataset.fill === this.params.flash?.fill; button.classList.toggle('is-selected', on); button.setAttribute('aria-pressed',String(on)); });
        this.popup.querySelector('[data-role="scope-hint"]').hidden = this.params.flash?.fill !== 'outside';
        this.popup.querySelector('[data-action="place"]').setAttribute('aria-pressed',String(this.placeMode));
        this.popup.querySelector('[data-role="canvas-hint"]').textContent = this.placeMode ? '範囲をドラッグ / 点で位置・縦横を調整 / Escで解除' : '中心と縦横の点をドラッグ / SpaceはCamera';
        this.popup.querySelectorAll('[data-direction]').forEach(button => {
            const on = button.dataset.direction === this.params.direction;
            button.setAttribute('aria-pressed', String(on));
            button.classList.toggle('is-selected', on);
        });
        this.popup.querySelectorAll('[data-preset]').forEach(button => {
            const id = flashMode ? (this.params.lengthJitter > .5 ? 'rough' : 'uni') : (!bodyMode && this.params.direction === 'in' && this.params.outer === 0 ? 'focus' : '');
            button.setAttribute('aria-pressed', String(button.dataset.preset === id));
        });
        this.popup.querySelectorAll('[data-style]').forEach(button => {
            const style = FOCUS_LINES_STYLES.find(entry => entry.id === button.dataset.style);
            const on = !bodyMode && style && Object.entries(style.patch).every(([key, value]) => this.params[key] === value);
            button.setAttribute('aria-pressed', String(!!on));
            button.classList.toggle('is-selected', !!on);
        });
        this.elements.fillRow.hidden = !this.params.body;
        this.elements.bodyFillToggle.checked = this.params.body?.fillColor !== null && this.params.body?.fillColor !== undefined;
        this.elements.bodyFillColor.disabled = !this.params.body || !this.elements.bodyFillToggle.checked;
        this.elements.bodyFillColor.value = this.params.body?.fillColor || this._backgroundColorHex();
        for (const field of FIELDS) {
            const input = this.popup.querySelector(`input[data-field="${field.key}"]`);
            const valueEl = this.popup.querySelector(`[data-value-for="${field.key}"]`);
            const row = this.popup.querySelector(`[data-row="${field.key}"]`);
            const label = this.popup.querySelector(`[data-label-for="${field.key}"]`);
            if (row) {
                row.hidden = (field.body && (!bodyMode || (field.key === 'bodyInset' && bodyKind !== 'ring')))
                    || (field.rayOnly && bodyMode) || (field.flashOnly && !flashMode)
                    || (field.key === 'ellipseWidth' && this.params.flash?.ellipse !== 'outline')
                    || (field.key === 'taper' && flashMode) || (field.key === 'outer' && flashMode);
            }
            if (label) label.textContent = bodyMode && field.bodyLabel ? field.bodyLabel : field.label;
            if (!input || !valueEl) continue;
            const raw = getPath(this.params, field.path);
            if (field.key === 'count') input.max = String(this.params.body ? FOCUS_BODY_LIMITS.count.max : L.count.max);
            if (Number.isFinite(Number(raw))) input.value = String(raw);
            if (!valueEl.dataset.editing) {
                const shown = field.toDisplay ? field.toDisplay(Number(raw)) : Math.round(Number(raw) * 100) / 100;
                valueEl.textContent = field.zeroLabel && Number(raw) === 0 ? field.zeroLabel : `${shown}${field.unit}`;
            }
            const min = Number(input.min), max = Number(input.max);
            const pct = max > min ? ((Number(input.value) - min) / (max - min)) * 100 : 0;
            input.style.setProperty('--pl-fill', `${Math.max(0, Math.min(100, pct))}%`);
        }
        this.elements.color.value = this.params.color;
        this.elements.editStatus.textContent = this.draftActive ? (this.editing ? '— 再編集中' : '— 配置中') : '— 確定済み';
        this.elements.updateBtn.hidden = !this.editing;
        this.elements.updateBtn.disabled = !this.draftActive;
        this.elements.loadBtn.disabled = !this._activeFocusLines();
        this.elements.rulerBtn.disabled = !window.rulerSystem?.getState;
        syncMangaTargetControls(this.popup, this.layerSystem, 'focus-lines');
        this.panelTarget?.sync();
    }

    // ------------------------------------------------------------ runtime Canvas navigation / drag

    _onOverlayPointerDown(target, event) {
        if (this._spacePressed || window.coreEngine?.cameraSystem?.vKeyPressed === true) return;
        this._beginDrag(target, event, (e) => this.overlay.clientToCanvas(e.clientX, e.clientY));
    }

    _beginDrag(target, event, toPoint) {
        this.endDrag();
        // Direct handle editing exits placement, so the full Canvas hit area
        // never traps the user after moving an existing guide.
        if (target.type !== 'place' && this.placeMode) {
            this.placeMode = false; this._syncControls(); this.overlay.schedule();
        }
        const start = toPoint(event);
        if (!start) return;
        const move = e => {
            if (!this.drag || e.pointerId !== this.drag.pointerId) return;
            const point = toPoint(e);
            if (point) this._applyDrag(point);
        };
        const up = e => {
            if (!this.drag || e.pointerId !== this.drag.pointerId) return;
            if (this.drag.type === 'place') {
                if (e.type === 'pointercancel') this._setParams(this.drag.baseline);
                this.placeMode = false; this._syncControls(); this.overlay.schedule();
            }
            this.endDrag();
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
        window.addEventListener('pointercancel', up);
        this.drag = {
            ...target, start, baseline: structuredClone(this.params),
            pointerId: event.pointerId,
            cleanup: () => {
                window.removeEventListener('pointermove', move);
                window.removeEventListener('pointerup', up);
                window.removeEventListener('pointercancel', up);
            }
        };
    }

    endDrag() {
        if (!this.drag) return;
        this.drag.cleanup?.();
        this.drag = null;
    }

    _applyDrag(point) {
        const type = this.drag?.type;
        const center = this.params.center;
        if (type === 'place') {
            const start = this.drag.start, w = Math.abs(point.x-start.x), h = Math.abs(point.y-start.y);
            if (w < 2 || h < 2) return;
            const k = this.params.flash ? 1 + this.params.flash.depth : 1;
            const base = Math.min(this.drag.baseline.innerRx, this.drag.baseline.innerRy) || 1;
            const ratio = Math.min(w,h)/(2*k*base);
            this._setParams({ ...this.params, center: {x:(point.x+start.x)/2,y:(point.y+start.y)/2}, innerRx:w/(2*k), innerRy:h/(2*k), widthMin:this.drag.baseline.widthMin*ratio,widthMax:this.drag.baseline.widthMax*ratio });
        } else if (type === 'center') this._setParams({ ...this.params, center: { x: point.x, y: point.y } });
        else if (type === 'rx') this._setParams({ ...this.params, innerRx: Math.abs(point.x - center.x) });
        else if (type === 'ry') this._setParams({ ...this.params, innerRy: Math.abs(point.y - center.y) });
    }

    // ------------------------------------------------------------ geometry / raster

    _redraw() {
        const size = this._canvasSize();
        this.flash = this.params.flash ? buildFocusFlash(this.params, size) : null;
        if (this.flash) { this.body = null; this.polygons = this.flash.polygons; }
        else if (this.params.body) {
            this.body = buildFocusLinesBody(this.params, size);
            this.polygons = [];
        } else {
            this.body = null;
            this.polygons = buildFocusLines(this.params, size);
        }
        this._syncPreviewSource();
        this.overlay.schedule();
    }

    _endPreview() {
        if (this.previewSource) restoreLetteringPreviewSource(this.previewSource);
        this.previewSource = null;
    }

    _syncPreviewSource() {
        const layer = this.layerSystem?.getLayers?.().find(item=>item.layerData?.id===this.editing?.layerId);
        const untransformed = layer && !(layer.position?.x || layer.position?.y || layer.rotation || layer.pivot?.x || layer.pivot?.y)
            && (layer.scale?.x ?? 1) === 1 && (layer.scale?.y ?? 1) === 1;
        if (!this.isVisible || !this.draftActive || !untransformed) return this._endPreview();
        if (this.previewSource !== layer) this._endPreview();
        if (ghostMangaPreviewSource(layer,()=>this.layerSystem._folderCompositor?.markDirty?.())) this.previewSource = layer;
    }

    _renderPresetSamples() {
        for (const button of this.popup.querySelectorAll('[data-preset]')) {
            const canvas = {width:100,height:70};
            const params = normalizeFocusLinesParams(resolveFocusLinesPreset(button.dataset.preset,canvas),canvas);
            const polygons = params.flash ? buildFocusFlash(params,canvas).polygons : buildFocusLines(params,canvas);
            const svg = button.querySelector('svg');
            const path = document.createElementNS('http://www.w3.org/2000/svg','path');
            path.setAttribute('d',polygons.map(poly=>`M${poly.map(p=>`${p.x.toFixed(3)} ${p.y.toFixed(3)}`).join('L')}Z`).join(''));
            path.setAttribute('fill','currentColor'); svg.appendChild(path);
        }
    }

    _bodyOuter(size) {
        return Math.max(1, Math.round(Math.min(size.width, size.height) * 0.42));
    }

    _backgroundHex() {
        const backgroundLayer = this.layerSystem?.getLayers?.().find(layer => layer?.layerData?.isBackground === true);
        const layerColor = backgroundLayer?.layerData?.backgroundColor;
        if (layerColor !== undefined && layerColor !== null && Number.isFinite(Number(layerColor))) return numberToHex(layerColor);
        const canvasColor = this.layerSystem?.config?.canvas?.backgroundColor;
        if (canvasColor !== undefined && canvasColor !== null && Number.isFinite(Number(canvasColor))) return numberToHex(canvasColor);
        const configColor = this.layerSystem?.config?.background?.color ?? window.TEGAKI_CONFIG?.background?.color;
        if (configColor !== undefined && configColor !== null && Number.isFinite(Number(configColor))) return numberToHex(configColor);
        const rendererColor = window.TEGAKI_CONFIG?.renderer?.backgroundColor;
        if (rendererColor !== undefined && rendererColor !== null && Number.isFinite(Number(rendererColor))) return numberToHex(rendererColor);
        return '#000000';
    }

    _backgroundColorHex() {
        return this._backgroundHex();
    }

    _raster() {
        const size = this._canvasSize();
        const source = this.flash || this.body || this.polygons;
        return rasterizeFocusLines(source, { ...size, color: this.params.color });
    }

    _meta() {
        return sanitizeFocusLinesData({ params: this.params }, this._canvasSize());
    }

    // ------------------------------------------------------------ 確定

    _guard(allowCaf = false) {
        if (this.history?.isApplying || this.history?.isRecordingSuppressed?.()) {
            showFeedbackToast('履歴処理が終わってから適用してください'); return false;
        }
        if (!this.layerSystem?.createRasterLayerFromSnapshot) {
            showFeedbackToast('Raster Layerを作成できません');
            return false;
        }
        if (this.layerSystem.getActiveLayer?.()?.layerData?.isAnimationWorkingLayer === true && !allowCaf) {
            showFeedbackToast('集中線は通常CanvasのRaster Layer専用です');
            return false;
        }
        return true;
    }

    apply() {
        const caf = cafMangaTarget(this.layerSystem);
        if (!this._guard(!!caf)) return { ok: false };
        const raster = this._raster();
        if (!raster.ok) {
            showFeedbackToast(raster.reason);
            return { ok: false };
        }
        if (caf) {
            const result = appendMangaRaster(this.layerSystem, raster, '集中線', 'focus-lines', caf);
            if (result.ok) { this._endPreview(); this.draftActive = false; this.placeMode = false; this.editing = null; }
            this._syncControls(); this.overlay.schedule();
            showFeedbackToast(result.ok ? 'CAFへ集中線を追加しました' : result.reason);
            return result;
        }
        let created = null;
        try {
            created = this.panelTarget.create({
                width: raster.width,
                height: raster.height,
                pixels: raster.pixels,
                rasterBounds: raster.rasterBounds,
                paths: [],
                pathsData: []
            }, { name: '集中線', historyName: 'focus-lines-apply', source: 'focus-lines' }, 'focus-lines');
        } catch (error) {
            created = null;
        }
        if (!created?.layer?.layerData) {
            showFeedbackToast(created?.reason || '集中線レイヤーを作成できません');
            return { ok: false };
        }
        created.layer.layerData.focusLines = this._meta();
        this.eventBus?.emit('layer:content-changed', { layerId: created.layer.layerData.id, source: 'focus-lines' });
        this._endPreview(); this.draftActive = false; this.placeMode = false;
        this.editing = { layerId: created.layer.layerData.id };
        this._syncControls(); this.overlay.schedule();
        showFeedbackToast(`集中線を追加しました（${this.params.body ? this.params.body.kind === 'ring' ? '二重枠' : '枠' : `${this.params.count}本`}）`);
        return { ok: true, layerId: created.layer.layerData.id };
    }

    update() {
        if (!this.editing || !this._guard()) return { ok: false };
        const layer = this.layerSystem.getLayers().find(item => item.layerData?.id === this.editing.layerId);
        if (!layer) {
            showFeedbackToast('再編集中の集中線Layerが見つかりません');
            this.editing = null;
            this._syncControls();
            return { ok: false };
        }
        const raster = this._raster();
        if (!raster.ok) {
            showFeedbackToast(raster.reason);
            return { ok: false };
        }
        const before = this.layerSystem.createLayerRasterSnapshot(layer);
        const after = { ...before, width: raster.width, height: raster.height, pixels: raster.pixels, rasterBounds: raster.rasterBounds, paths: [], pathsData: [] };
        const metaBefore = layer.layerData.focusLines;
        const metaAfter = this._meta();
        const layerId = layer.layerData.id;
        const apply = useAfter => {
            this.layerSystem.restoreLayerRasterSnapshot(useAfter ? after : before);
            layer.layerData.focusLines = useAfter ? metaAfter : metaBefore;
            this.eventBus?.emit('layer:content-changed', { layerId, source: 'focus-lines-update' });
        };
        apply(true);
        this.history.record({
            name: 'focus-lines-update',
            do: () => apply(true),
            undo: () => apply(false),
            byteSize: (before.pixels?.byteLength || 0) + (after.pixels?.byteLength || 0),
            meta: { type: 'focus-lines-update', layerId }
        });
        this._endPreview(); this.draftActive = false; this.placeMode = false;
        this._syncControls(); this.overlay.schedule();
        showFeedbackToast('集中線を更新しました');
        return { ok: true, layerId };
    }

    loadFromActiveLayer() {
        if (!this._guard()) return { ok: false };
        const source = this.layerSystem?.getActiveLayer?.();
        if (source && (source.position?.x || source.position?.y || source.rotation || source.pivot?.x || source.pivot?.y || (source.scale?.x ?? 1) !== 1 || (source.scale?.y ?? 1) !== 1)) {
            showFeedbackToast('Layerの変形を確定してから再編集してください'); return {ok:false};
        }
        const data = this._activeFocusLines();
        if (!data) {
            showFeedbackToast('選択中のレイヤーに集中線の情報がありません');
            return { ok: false };
        }
        this._endPreview(); this.placeMode = false;
        this.editing = { layerId: this.layerSystem.getActiveLayer().layerData.id };
        this._setParams(data.params);
        showFeedbackToast('集中線を読み込みました。編集して「更新」できます');
        return { ok: true };
    }

    // ------------------------------------------------------------ popup protocol

    show() {
        const wasVisible = this.isVisible === true;
        if (!this.popup) this._ensurePopupElement();
        if (!this.popup) return;
        this.popup.classList.add('show');
        this.isVisible = true;
        mountMangaTabs(this.popup.querySelector('[data-role="manga-tabs"]'), 'focusLines');
        noteMangaTabShown('focusLines');
        this._syncControls();
        this._redraw();
        this.overlay.setVisible(true);
        this._fitViewport();
        this._navigation.sync();
        if (!wasVisible) this.eventBus.emit('popup:shown', { name: 'focusLines' });
    }

    _fitViewport() {
        if (!this.popup) return;
        const rect = this.popup.getBoundingClientRect();
        const style = getComputedStyle(this.popup);
        const left = Number.parseFloat(style.left), top = Number.parseFloat(style.top);
        this.popup.style.left = `${Math.max(4, Math.min(Number.isFinite(left) ? left : rect.left, innerWidth - this.popup.offsetWidth - 4))}px`;
        this.popup.style.top = `${Math.max(4, Math.min(Number.isFinite(top) ? top : rect.top, innerHeight - this.popup.offsetHeight - 4))}px`;
    }

    hide() {
        if (!this.popup) return;
        const wasVisible = this.isVisible === true;
        this.popup.classList.remove('show');
        this.isVisible = false;
        this.endDrag(); this.placeMode = false; this._endPreview();
        this._navigation.clear();
        this.overlay.setVisible(false);
        if (wasVisible) this.eventBus.emit('popup:hidden', { name: 'focusLines' });
    }

    toggle() {
        if (this.isVisible) this.hide();
        else this.show();
    }

    isReady() {
        return !!this.popup;
    }

    destroy() {
        this.endDrag(); this._endPreview();
        this.eventBus?.off?.('layer:content-changed',this._contentListener);
        this.eventBus?.off?.('history:changed',this._historyListener);
        window.removeEventListener('keydown',this._escapeListener);
        this.popupDragCleanup?.();
        this.popupDragCleanup = null;
        this._fieldDetachers.forEach(detach => detach?.());
        this._fieldDetachers = [];
        this.eventBus?.off?.('layer:activated', this._layerListener);
        this.overlay.destroy();
        this._navigation.destroy();
        window.removeEventListener('resize', this._resizeListener);
    }
}

window.FocusLinesPopup = FocusLinesPopup;
