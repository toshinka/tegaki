/**
 * ============================================================================
 * ファイル名: ui/focus-lines-popup.js
 * 責務: 集中線 / ウニフラ / 閉輪郭のpopup。Canvas上のruntime previewを編集し、
 *       確定時だけ通常Raster Layerを1件のHistoryで追加/更新する。
 * 依存: system/focus-lines.js, system/focus-lines-raster.js, system/history.js,
 *   system/event-bus.js, ui/focus-lines-overlay.js, ui/manga-canvas-navigation.js,
 *   ui/manga-tabs.js, ui/numeric-field.js, ui/popup-drag-helper.js, ui/feedback-toast.js
 * 被依存: core-engine.js, system/popup-manager.js
 * 公開API: FocusLinesPopup
 * 保存: 編集中のparamsはlocalStorage(UI設定)。確定Layerは通常Raster Layerで、
 *   再編集用にlayerData.focusLines(optional・sanitize済み)を持つ。画素は派生物。
 * 境界: Canvas/Project/Historyの正本を持たず、本文や新Layer schemaを追加しない。
 * 検証入口: build/verify-focus-lines.mjs, build/verify-focus-lines-body.mjs
 * ============================================================================
 */

import { TegakiEventBus } from '../system/event-bus.js';
import { historyManager } from '../system/history.js';
import {
    FOCUS_BODY_LIMITS,
    FOCUS_LINES_LIMITS,
    FOCUS_LINES_STYLES,
    buildFocusLines,
    buildFocusLinesBody,
    defaultFocusLinesParams,
    focusLinesHandles,
    normalizeFocusLinesParams,
    sanitizeFocusLinesData
} from '../system/focus-lines.js';
import { rasterizeFocusLines } from '../system/focus-lines-raster.js';
import { FocusLinesOverlay } from './focus-lines-overlay.js';
import { attachMangaCanvasNavigation } from './manga-canvas-navigation.js';
import { mountMangaTabs, noteMangaTabShown } from './manga-tabs.js';
import { attachNumericField } from './numeric-field.js';
import { attachPopupDrag, mountPopupAtOverlayRoot } from './popup-drag-helper.js';
import { showFeedbackToast } from './feedback-toast.js';

const STORAGE_KEY = 'tegaki-focus-lines-v1';
const POPUP_ID = 'focus-lines-popup';
const L = FOCUS_LINES_LIMITS;

const CONTEXTS = Object.freeze([
    { id: 'shape', label: '形/線' },
    { id: 'layout', label: '配置' },
    { id: 'variance', label: 'ばらつき' }
]);

// NumericField remains the single wheel/double-click path for every numeric
// control.  body.* fields are mapped explicitly so body remains optional.
const FIELDS = Object.freeze([
    { key: 'count', path: ['count'], label: '本数', bodyLabel: 'とげ数', min: L.count.min, max: L.count.max, step: 1, unit: '本', context: 'variance' },
    { key: 'widthMin', path: ['widthMin'], label: '太さ(細)', min: L.width.min, max: L.width.max, step: 0.5, unit: 'px', context: 'variance', rayOnly: true },
    { key: 'widthMax', path: ['widthMax'], label: '太さ(太)', min: L.width.min, max: L.width.max, step: 0.5, unit: 'px', context: 'variance', rayOnly: true },
    { key: 'taper', path: ['taper'], label: '尖らせ', min: 0, max: 1, step: 0.01, unit: '%', toDisplay: value => Math.round(value * 100), fromDisplay: value => value / 100, wheelStep: 0.05, context: 'variance', rayOnly: true },
    { key: 'angleJitter', path: ['angleJitter'], label: '角度ばらつき', min: 0, max: 1, step: 0.01, unit: '%', toDisplay: value => Math.round(value * 100), fromDisplay: value => value / 100, wheelStep: 0.05, context: 'variance' },
    { key: 'lengthJitter', path: ['lengthJitter'], label: '長さばらつき', min: 0, max: 1, step: 0.01, unit: '%', toDisplay: value => Math.round(value * 100), fromDisplay: value => value / 100, wheelStep: 0.05, context: 'variance' },
    { key: 'innerRx', path: ['innerRx'], label: '抜け 横', bodyLabel: '内側 横半径', min: 0, max: 1200, step: 1, unit: 'px', context: 'layout' },
    { key: 'innerRy', path: ['innerRy'], label: '抜け 縦', bodyLabel: '内側 縦半径', min: 0, max: 1200, step: 1, unit: 'px', context: 'layout' },
    { key: 'outer', path: ['outer'], label: '外へ', bodyLabel: '先端半径', min: 0, max: 2400, step: 1, unit: 'px', zeroLabel: '端まで', context: 'layout' },
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
        this.params = defaultFocusLinesParams(this._canvasSize());
        this.context = 'shape';
        this.editing = null; // { layerId }
        this.drag = null;
        this.polygons = [];
        this.body = null;
        this._spacePressed = false;
        this._fieldDetachers = [];

        this.overlay = new FocusLinesOverlay({
            eventBus: this.eventBus,
            onPointerDown: (target, event) => this._onOverlayPointerDown(target, event),
            getState: () => this.isVisible ? {
                params: this.params,
                canvas: this._canvasSize(),
                polygons: this.polygons,
                body: this.body
            } : null
        });
        this._layerListener = () => this._syncControls();
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
            if (data?.params) this.params = normalizeFocusLinesParams(data.params, this._canvasSize());
            // Legacy showOverlay is deliberately ignored. Canvas is the primary
            // editor and the overlay must remain available after an old OFF save.
        } catch (error) {
            // 壊れた設定は既定へ戻す(Projectには無関係)
        }
    }

    _persist() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ params: this.params }));
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
        const modes = [
            ['rays', '放射線'],
            ['outline', '枠'],
            ['ring', '二重枠・中抜き']
        ].map(([id, label]) => `<button type="button" class="pl-chip pl-chip--wide" data-mode="${id}" aria-pressed="false">${label}</button>`).join('');
        const contexts = CONTEXTS.map(({ id, label }) => `<button type="button" class="pl-chip" role="tab" data-context="${id}" aria-selected="false">${label}</button>`).join('');
        const styles = FOCUS_LINES_STYLES.map(style => `<button type="button" class="pl-chip" data-style="${style.id}" aria-pressed="false">${style.label}</button>`).join('');
        this.popup.innerHTML = `
            ${closeBtn}
            <div class="manga-tabs-host" data-role="manga-tabs"></div>
            <div class="pl-title">集中線 <span class="pl-edit-status" data-role="edit-status"></span></div>
            <div class="focus-lines-context-tabs" role="tablist" aria-label="集中線の目的別設定">${contexts}</div>
            <div class="focus-lines-body-scroll ui-scrollbar">
                <section data-context-pane="shape" role="tabpanel" aria-label="形と線">
                    <div class="pl-row"><span class="pl-label">モード</span><span class="pl-chips">${modes}</span></div>
                    <div class="pl-chips" data-ray-controls role="group" aria-label="放射線のプリセット">${styles}</div>
                    <div class="pl-row" data-ray-controls><span class="pl-label">向き</span><span class="pl-chips"><button type="button" class="pl-chip" data-direction="in" aria-pressed="false">中心へ尖る</button><button type="button" class="pl-chip" data-direction="out" aria-pressed="false">外へ尖る</button></span></div>
                    <div class="pl-row"><span class="pl-label">線の色</span><input type="color" class="pl-color" data-role="color" value="${this.params.color}" aria-label="線の色"></div>
                    <label class="pl-row pl-check focus-lines-fill-toggle" data-role="fill-row">
                        <input type="checkbox" data-role="body-fill-toggle">
                        <span>内側を塗る</span>
                        <input type="color" class="pl-color" data-role="body-fill-color" aria-label="内側の色">
                    </label>
                    <div class="pl-hint focus-lines-canvas-hint">Canvas上の中心・抜けを操作。SpaceはCamera、VはTransformへ譲ります。</div>
                    ${FIELDS.filter(field => field.context === 'shape').map(field => `
                        <label class="pl-row focus-lines-field" data-row="${field.key}" data-context-row="shape" data-body-row="true">
                            <span class="pl-label" data-label-for="${field.key}">${field.label}</span>
                            <input type="range" class="pl-range" data-field="${field.key}" min="${field.min}" max="${field.max}" step="${field.step}">
                            <span class="pl-value" data-value-for="${field.key}"></span>
                        </label>`).join('')}
                </section>
                <section data-context-pane="layout" role="tabpanel" aria-label="配置" hidden>
                    <div class="pl-actions" role="group" aria-label="中心操作">
                        <button type="button" class="pl-btn" data-action="center-canvas" title="中心をキャンバスの真ん中へ">中心を中央へ</button>
                        <button type="button" class="pl-btn" data-action="center-ruler" data-role="ruler-btn" title="放射線定規の中心を使う">定規の中心</button>
                    </div>
                    ${FIELDS.filter(field => field.context === 'layout').map(field => `
                        <label class="pl-row focus-lines-field" data-row="${field.key}" data-context-row="layout">
                            <span class="pl-label" data-label-for="${field.key}">${field.label}</span>
                            <input type="range" class="pl-range" data-field="${field.key}" min="${field.min}" max="${field.max}" step="${field.step}">
                            <span class="pl-value" data-value-for="${field.key}"></span>
                        </label>`).join('')}
                    <div class="pl-hint">枠モードは有限の外半径を使い、Canvas外側は確定時にclipします。</div>
                </section>
                <section data-context-pane="variance" role="tabpanel" aria-label="ばらつき" hidden>
                    ${FIELDS.filter(field => field.context === 'variance').map(field => `
                        <label class="pl-row focus-lines-field" data-row="${field.key}" data-context-row="variance">
                            <span class="pl-label" data-label-for="${field.key}">${field.label}</span>
                            <input type="range" class="pl-range" data-field="${field.key}" min="${field.min}" max="${field.max}" step="${field.step}">
                            <span class="pl-value" data-value-for="${field.key}"></span>
                        </label>`).join('')}
                    <div class="pl-actions"><button type="button" class="pl-btn" data-action="reseed" title="線の配り方を引き直す">再抽選</button></div>
                </section>
            </div>
            <div class="focus-lines-fixed-footer fl-fixed-footer">
                <div class="pl-hint">セリフは「文字」タブで重ねられます。</div>
                <div class="pl-footer">
                    <button type="button" class="pl-btn" data-action="reset">リセット</button>
                    <button type="button" class="pl-btn" data-action="load-active" title="選択中の集中線Layerから読み込んで再編集">レイヤーから再編集</button>
                </div>
                <div class="pl-footer">
                    <button type="button" class="pl-btn pl-btn--primary" data-action="update" data-role="update-btn" title="再編集中のLayerを置き換え（Undo 1回で戻る）" hidden>既存の集中線を更新</button>
                    <button type="button" class="pl-btn pl-btn--primary" data-action="apply" title="新規Layerとして追加（Undo 1回で戻る）">新規レイヤーに適用</button>
                </div>
            </div>
        `;
        const q = selector => this.popup.querySelector(selector);
        this.elements = {
            editStatus: q('[data-role="edit-status"]'),
            updateBtn: q('[data-role="update-btn"]'),
            loadBtn: q('[data-action="load-active"]'),
            color: q('[data-role="color"]'),
            bodyFillToggle: q('[data-role="body-fill-toggle"]'),
            bodyFillColor: q('[data-role="body-fill-color"]'),
            fillRow: q('[data-role="fill-row"]'),
            rulerBtn: q('[data-role="ruler-btn"]')
        };
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
        root.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => this._setMode(button.dataset.mode)));
        root.querySelectorAll('[data-style]').forEach(button => button.addEventListener('click', () => {
            const style = FOCUS_LINES_STYLES.find(entry => entry.id === button.dataset.style);
            if (style) this._setParams({ ...this.params, ...style.patch });
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
                toDisplay: field?.toDisplay,
                fromDisplay: field?.fromDisplay,
                wheelStep: field?.wheelStep ?? null
            });
        });
    }

    _onAction(action) {
        if (action === 'reset') {
            this.editing = null;
            this._setParams(defaultFocusLinesParams(this._canvasSize()));
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
        if (mode === 'rays') {
            const next = { ...this.params };
            delete next.body;
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
        this._setParams({ ...this.params, body, direction: 'out', outer });
    }

    _setParams(next) {
        this.params = normalizeFocusLinesParams(next, this._canvasSize());
        this._persist();
        this._syncControls();
        this._redraw();
    }

    _activeFocusLines() {
        const data = this.layerSystem?.getActiveLayer?.()?.layerData?.focusLines;
        return data ? sanitizeFocusLinesData(data, this._canvasSize()) : null;
    }

    _syncControls() {
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
        this.popup.querySelectorAll('[data-ray-controls]').forEach(row => { row.hidden = bodyMode; });
        this.popup.querySelectorAll('[data-direction]').forEach(button => {
            const on = button.dataset.direction === this.params.direction;
            button.setAttribute('aria-pressed', String(on));
            button.classList.toggle('is-selected', on);
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
                    || (field.rayOnly && bodyMode);
            }
            if (label) label.textContent = bodyMode && field.bodyLabel ? field.bodyLabel : field.label;
            if (!input || !valueEl) continue;
            const raw = getPath(this.params, field.path);
            if (field.key === 'count') input.max = String(this.params.body ? FOCUS_BODY_LIMITS.count.max : L.count.max);
            if (Number.isFinite(Number(raw))) input.value = String(raw);
            if (!valueEl.dataset.editing) {
                const shown = field.toDisplay ? field.toDisplay(Number(raw)) : raw;
                valueEl.textContent = field.zeroLabel && Number(raw) === 0 ? field.zeroLabel : `${shown}${field.unit}`;
            }
            const min = Number(input.min), max = Number(input.max);
            const pct = max > min ? ((Number(input.value) - min) / (max - min)) * 100 : 0;
            input.style.setProperty('--pl-fill', `${Math.max(0, Math.min(100, pct))}%`);
        }
        this.elements.color.value = this.params.color;
        this.elements.editStatus.textContent = this.editing ? '— 再編集中' : '';
        this.elements.updateBtn.hidden = !this.editing;
        this.elements.loadBtn.disabled = !this._activeFocusLines();
        this.elements.rulerBtn.disabled = !window.rulerSystem?.getState;
    }

    // ------------------------------------------------------------ runtime Canvas navigation / drag

    _onOverlayPointerDown(target, event) {
        if (this._spacePressed || window.coreEngine?.cameraSystem?.vKeyPressed === true) return;
        this._beginDrag(target, event, (e) => this.overlay.clientToCanvas(e.clientX, e.clientY));
    }

    _beginDrag(target, event, toPoint) {
        this.endDrag();
        const start = toPoint(event);
        if (!start) return;
        const move = e => {
            if (!this.drag || e.pointerId !== this.drag.pointerId) return;
            const point = toPoint(e);
            if (point) this._applyDrag(point);
        };
        const up = e => {
            if (!this.drag || e.pointerId !== this.drag.pointerId) return;
            this.endDrag();
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
        window.addEventListener('pointercancel', up);
        this.drag = {
            ...target,
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
        if (type === 'center') this._setParams({ ...this.params, center: { x: point.x, y: point.y } });
        else if (type === 'rx') this._setParams({ ...this.params, innerRx: Math.abs(point.x - center.x) });
        else if (type === 'ry') this._setParams({ ...this.params, innerRy: Math.abs(point.y - center.y) });
    }

    // ------------------------------------------------------------ geometry / raster

    _redraw() {
        const size = this._canvasSize();
        if (this.params.body) {
            this.body = buildFocusLinesBody(this.params, size);
            this.polygons = [];
        } else {
            this.body = null;
            this.polygons = buildFocusLines(this.params, size);
        }
        this.overlay.schedule();
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
        const source = this.body || this.polygons;
        return rasterizeFocusLines(source, { ...size, color: this.params.color });
    }

    _meta() {
        return sanitizeFocusLinesData({ params: this.params }, this._canvasSize());
    }

    // ------------------------------------------------------------ 確定

    _guard() {
        if (!this.layerSystem?.createRasterLayerFromSnapshot) {
            showFeedbackToast('Raster Layerを作成できません');
            return false;
        }
        if (this.layerSystem.getActiveLayer?.()?.layerData?.isAnimationWorkingLayer === true) {
            showFeedbackToast('集中線は通常CanvasのRaster Layer専用です');
            return false;
        }
        return true;
    }

    apply() {
        if (!this._guard()) return { ok: false };
        const raster = this._raster();
        if (!raster.ok) {
            showFeedbackToast(raster.reason);
            return { ok: false };
        }
        let created = null;
        try {
            created = this.layerSystem.createRasterLayerFromSnapshot({
                width: raster.width,
                height: raster.height,
                pixels: raster.pixels,
                rasterBounds: raster.rasterBounds,
                paths: [],
                pathsData: []
            }, { name: '集中線', historyName: 'focus-lines-apply', source: 'focus-lines' });
        } catch (error) {
            created = null;
        }
        if (!created?.layer?.layerData) {
            showFeedbackToast('集中線レイヤーを作成できません');
            return { ok: false };
        }
        created.layer.layerData.focusLines = this._meta();
        this.eventBus?.emit('layer:content-changed', { layerId: created.layer.layerData.id, source: 'focus-lines' });
        this.editing = { layerId: created.layer.layerData.id };
        this._syncControls();
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
        showFeedbackToast('集中線を更新しました');
        return { ok: true, layerId };
    }

    loadFromActiveLayer() {
        const data = this._activeFocusLines();
        if (!data) {
            showFeedbackToast('選択中のレイヤーに集中線の情報がありません');
            return { ok: false };
        }
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
        this.endDrag();
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
        this.endDrag();
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
