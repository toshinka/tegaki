/**
 * ============================================================================
 * ファイル名: ui/focus-lines-popup.js
 * 責務: 集中線 / ウニフラ popup。パラメータを編集し、確定で通常Raster Layerを1件のHistoryで追加/更新する
 * 依存: system/focus-lines.js, system/focus-lines-raster.js, system/history.js, system/event-bus.js,
 *   ui/focus-lines-overlay.js, ui/numeric-field.js, ui/popup-drag-helper.js, ui/feedback-toast.js
 * 被依存: core-engine.js, system/popup-manager.js
 * 公開API: FocusLinesPopup
 * イベント発火: popup:shown, popup:hidden, layer:content-changed
 * 保存: 編集中のparamsはlocalStorage(UI設定)。確定Layerは通常Raster Layerで、再編集用に
 *   layerData.focusLines(optional・sanitize済み)を持つ。画素は派生物で、更新で再生成する。
 * 見た目: 部品のclassはコマ割りpopupと共通(styles/components/panel-layout-popup.css)。
 * 実装状態: ✅実装（WP-011）
 * ============================================================================
 */

import { TegakiEventBus } from '../system/event-bus.js';
import { historyManager } from '../system/history.js';
import {
    FOCUS_LINES_LIMITS,
    FOCUS_LINES_STYLES,
    buildFocusLines,
    defaultFocusLinesParams,
    focusLinesHandles,
    normalizeFocusLinesParams,
    sanitizeFocusLinesData
} from '../system/focus-lines.js';
import { rasterizeFocusLines } from '../system/focus-lines-raster.js';
import { FocusLinesOverlay } from './focus-lines-overlay.js';
import { attachNumericField } from './numeric-field.js';
import { attachPopupDrag, mountPopupAtOverlayRoot } from './popup-drag-helper.js';
import { showFeedbackToast } from './feedback-toast.js';

const STORAGE_KEY = 'tegaki-focus-lines-v1';
const POPUP_ID = 'focus-lines-popup';
const PREVIEW_MAX = { width: 280, height: 280 };
const L = FOCUS_LINES_LIMITS;

// 数値欄の定義。display/fromは「%」表示などの換算用。
const FIELDS = Object.freeze([
    { key: 'count', label: '本数', min: L.count.min, max: L.count.max, step: 1, unit: '本' },
    { key: 'widthMin', label: '太さ(細)', min: L.width.min, max: L.width.max, step: 0.5, unit: 'px' },
    { key: 'widthMax', label: '太さ(太)', min: L.width.min, max: L.width.max, step: 0.5, unit: 'px' },
    { key: 'taper', label: '尖らせ', min: 0, max: 1, step: 0.01, unit: '%', toDisplay: v => Math.round(v * 100), fromDisplay: v => v / 100, wheelStep: 0.05 },
    { key: 'innerRx', label: '抜け 横', min: 0, max: 1200, step: 1, unit: 'px' },
    { key: 'innerRy', label: '抜け 縦', min: 0, max: 1200, step: 1, unit: 'px' },
    { key: 'outer', label: '長さ', min: 0, max: 2400, step: 1, unit: 'px', zeroLabel: '端まで' },
    { key: 'angleJitter', label: '角度ばらつき', min: 0, max: 1, step: 0.01, unit: '%', toDisplay: v => Math.round(v * 100), fromDisplay: v => v / 100, wheelStep: 0.05 },
    { key: 'lengthJitter', label: '長さばらつき', min: 0, max: 1, step: 0.01, unit: '%', toDisplay: v => Math.round(v * 100), fromDisplay: v => v / 100, wheelStep: 0.05 }
]);

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
        this.showOverlay = true;
        this.editing = null; // { layerId }
        this.drag = null;
        this.polygons = [];
        this.scale = 1;

        this.overlay = new FocusLinesOverlay({
            eventBus: this.eventBus,
            onPointerDown: (target, event) => this._beginDrag(target, event, (e) => this.overlay.clientToCanvas(e.clientX, e.clientY)),
            getState: () => this.isVisible ? { params: this.params, polygons: this.polygons, showLines: this.showOverlay } : null
        });
        this._layerListener = () => this._syncControls();
        this.eventBus?.on?.('layer:activated', this._layerListener);

        this._restore();
        this._ensurePopupElement();
    }

    // ------------------------------------------------------------ 永続(UI設定のみ)

    _restore() {
        try {
            const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
            if (data?.params) this.params = normalizeFocusLinesParams(data.params, this._canvasSize());
            if (typeof data?.showOverlay === 'boolean') this.showOverlay = data.showOverlay;
        } catch (error) {
            // 壊れた設定は既定へ戻す(Projectには無関係)
        }
    }

    _persist() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ params: this.params, showOverlay: this.showOverlay }));
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
            popup.className = 'popup-panel popup-panel--translucent ui-scrollbar focus-lines-popup';
            popup.style.top = '60px';
            popup.style.left = '60px';
            (document.querySelector('.main-layout') || document.body).appendChild(popup);
        } else {
            mountPopupAtOverlayRoot(popup);
        }
        this.popup = popup;
        this._build();
        this.popupDragCleanup = attachPopupDrag(popup, {
            interactiveSelector: 'button, input, select, textarea, a, canvas, .pl-value, .popup-close-btn, .ui-close-button'
        });
    }

    _build() {
        const closeBtn = window.DOMBuilder
            ? window.DOMBuilder.createCloseButton(POPUP_ID).outerHTML
            : `<button class="ui-close-button ui-close-button--medium popup-close-btn" data-action="close-popup" data-target="${POPUP_ID}" type="button">${window.UI_ICONS?.close || '×'}</button>`;
        const styles = FOCUS_LINES_STYLES.map(s =>
            `<button type="button" class="pl-chip pl-chip--wide" data-style="${s.id}">${s.label}</button>`
        ).join('');
        const rows = FIELDS.map(f => `
            <label class="pl-row">
                <span class="pl-label">${f.label}</span>
                <input type="range" class="pl-range" data-field="${f.key}" min="${f.min}" max="${f.max}" step="${f.step}">
                <span class="pl-value" data-value-for="${f.key}"></span>
            </label>`).join('');

        this.popup.innerHTML = `
            ${closeBtn}
            <div class="pl-title">集中線 <span class="pl-edit-status" data-role="edit-status"></span></div>
            <div class="pl-presets" role="group" aria-label="種類">${styles}</div>
            <canvas class="pl-preview" width="${PREVIEW_MAX.width}" height="${PREVIEW_MAX.height}" aria-label="集中線プレビュー"></canvas>
            <div class="pl-hint">中心・抜けの端をドラッグ。プレビューをクリックで中心を移動</div>
            <label class="pl-row pl-check">
                <input type="checkbox" data-role="overlay-toggle">
                <span>キャンバス上に重ねて表示・操作する</span>
            </label>
            <div class="pl-row">
                <span class="pl-label">向き</span>
                <span class="pl-chips">
                    <button type="button" class="pl-chip pl-chip--wide" data-direction="in" title="外が太く、中心側が尖る（集中線）">中心へ尖る</button>
                    <button type="button" class="pl-chip pl-chip--wide" data-direction="out" title="抜けの縁が太く、外へ尖る（ウニフラ）">外へ尖る</button>
                </span>
            </div>
            <div class="pl-actions" role="group" aria-label="中心">
                <button type="button" class="pl-btn" data-action="center-canvas" title="中心をキャンバスの真ん中へ">中心を中央へ</button>
                <button type="button" class="pl-btn" data-action="center-ruler" data-role="ruler-btn" title="放射線定規の中心を使う">定規の中心</button>
                <button type="button" class="pl-btn" data-action="reseed" title="線の配り方を引き直す">再抽選</button>
            </div>
            <div class="pl-sep"></div>
            ${rows}
            <div class="pl-row">
                <span class="pl-label">線の色</span>
                <input type="color" class="pl-color" data-role="color" value="${this.params.color}">
            </div>
            <div class="pl-footer">
                <button type="button" class="pl-btn" data-action="reset">リセット</button>
                <button type="button" class="pl-btn" data-action="load-active" title="選択中の集中線Layerから読み込んで再編集">レイヤーから再編集</button>
            </div>
            <div class="pl-footer">
                <button type="button" class="pl-btn pl-btn--primary" data-action="update" data-role="update-btn" title="再編集中のLayerを置き換え（Undo 1回で戻る）" hidden>既存の集中線を更新</button>
                <button type="button" class="pl-btn pl-btn--primary" data-action="apply" title="新規Layerとして追加（Undo 1回で戻る）">新規レイヤーに適用</button>
            </div>
        `;

        const q = (sel) => this.popup.querySelector(sel);
        this.elements = {
            canvas: q('.pl-preview'),
            editStatus: q('[data-role="edit-status"]'),
            updateBtn: q('[data-role="update-btn"]'),
            loadBtn: q('[data-action="load-active"]'),
            overlayToggle: q('[data-role="overlay-toggle"]'),
            color: q('[data-role="color"]'),
            rulerBtn: q('[data-role="ruler-btn"]')
        };
        this._bind();
        this._syncControls();
        this._redraw();
    }

    // ------------------------------------------------------------ 操作

    _bind() {
        const root = this.popup;
        root.querySelectorAll('[data-style]').forEach(btn => btn.addEventListener('click', () => {
            const style = FOCUS_LINES_STYLES.find(s => s.id === btn.dataset.style);
            if (!style) return;
            this._setParams({ ...this.params, ...style.patch });
        }));
        root.querySelectorAll('[data-direction]').forEach(btn => btn.addEventListener('click', () => {
            this._setParams({ ...this.params, direction: btn.dataset.direction });
        }));
        root.querySelectorAll('input[data-field]').forEach(input => input.addEventListener('input', () => {
            this._setParams({ ...this.params, [input.dataset.field]: Number(input.value) });
        }));
        this.elements.color.addEventListener('input', (e) => this._setParams({ ...this.params, color: e.target.value }));
        this.elements.overlayToggle.addEventListener('change', (e) => {
            this.showOverlay = e.target.checked;
            this._persist();
            this._syncOverlayVisibility();
        });
        root.querySelectorAll('[data-action]').forEach(btn => {
            if (btn.dataset.action === 'close-popup') return;
            btn.addEventListener('click', () => this._onAction(btn.dataset.action));
        });

        this._fieldDetachers = FIELDS.map(f => attachNumericField({
            range: root.querySelector(`input[data-field="${f.key}"]`),
            valueEl: root.querySelector(`[data-value-for="${f.key}"]`),
            toDisplay: f.toDisplay,
            fromDisplay: f.fromDisplay,
            wheelStep: f.wheelStep ?? null
        }));

        const canvas = this.elements.canvas;
        canvas.addEventListener('pointerdown', (e) => this._onPreviewPointerDown(e));
        canvas.addEventListener('pointermove', (e) => {
            if (this.drag) return;
            canvas.style.cursor = this._hitHandle(this._toCanvasPoint(e)) ? 'move' : 'crosshair';
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
        if (!this.popup || !this.elements.canvas) return;
        for (const f of FIELDS) {
            const input = this.popup.querySelector(`input[data-field="${f.key}"]`);
            if (input && Number(input.value) !== this.params[f.key]) input.value = String(this.params[f.key]);
            const out = this.popup.querySelector(`[data-value-for="${f.key}"]`);
            if (out && !out.dataset.editing) {
                const raw = this.params[f.key];
                out.textContent = f.zeroLabel && raw === 0 ? f.zeroLabel : `${f.toDisplay ? f.toDisplay(raw) : raw}${f.unit}`;
            }
        }
        this.popup.querySelectorAll('[data-direction]').forEach(btn => {
            const on = btn.dataset.direction === this.params.direction;
            btn.setAttribute('aria-pressed', String(on));
            btn.classList.toggle('is-selected', on);
        });
        this.elements.color.value = this.params.color;
        this.elements.overlayToggle.checked = this.showOverlay;
        this.elements.editStatus.textContent = this.editing ? '— 再編集中' : '';
        this.elements.updateBtn.hidden = !this.editing;
        this.elements.loadBtn.disabled = !this._activeFocusLines();
        this.elements.rulerBtn.disabled = !window.rulerSystem?.getState;
        this.popup.querySelectorAll('.pl-range').forEach((input) => {
            const min = Number(input.min);
            const max = Number(input.max);
            const pct = max > min ? ((Number(input.value) - min) / (max - min)) * 100 : 0;
            input.style.setProperty('--pl-fill', `${Math.max(0, Math.min(100, pct))}%`);
        });
    }

    _syncOverlayVisibility() {
        this.overlay.setVisible(this.isVisible && this.showOverlay);
    }

    // ------------------------------------------------------------ ドラッグ(プレビュー/キャンバス上)

    _beginDrag(target, event, toPoint) {
        this.endDrag();
        const move = (e) => {
            if (!this.drag || e.pointerId !== this.drag.pointerId) return;
            const pt = toPoint(e);
            if (pt) this._applyDrag(pt);
        };
        const up = (e) => {
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

    _applyDrag(pt) {
        const type = this.drag?.type;
        const { center } = this.params;
        if (type === 'center') this._setParams({ ...this.params, center: { x: pt.x, y: pt.y } });
        else if (type === 'rx') this._setParams({ ...this.params, innerRx: Math.abs(pt.x - center.x) });
        else if (type === 'ry') this._setParams({ ...this.params, innerRy: Math.abs(pt.y - center.y) });
    }

    _toCanvasPoint(e) {
        const rect = this.elements.canvas.getBoundingClientRect();
        const px = (e.clientX - rect.left) * (this.elements.canvas.width / rect.width);
        const py = (e.clientY - rect.top) * (this.elements.canvas.height / rect.height);
        return { x: px / this.scale, y: py / this.scale };
    }

    _hitHandle(pt) {
        const tol = 9 / this.scale;
        const h = focusLinesHandles(this.params);
        for (const type of ['center', 'rx', 'ry']) {
            if (Math.hypot(pt.x - h[type].x, pt.y - h[type].y) <= tol) return type;
        }
        return null;
    }

    _onPreviewPointerDown(e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        const pt = this._toCanvasPoint(e);
        const type = this._hitHandle(pt);
        if (type) {
            this._beginDrag({ type }, e, (ev) => this._toCanvasPoint(ev));
        } else {
            // 何もない所をクリック/ドラッグ: 中心をそこへ移して、そのまま中心ドラッグへ
            this._setParams({ ...this.params, center: { x: pt.x, y: pt.y } });
            this._beginDrag({ type: 'center' }, e, (ev) => this._toCanvasPoint(ev));
        }
        e.preventDefault();
    }

    // ------------------------------------------------------------ 描画

    _redraw() {
        const el = this.elements.canvas;
        if (!el) return;
        const size = this._canvasSize();
        this.scale = Math.min(PREVIEW_MAX.width / size.width, PREVIEW_MAX.height / size.height);
        el.width = Math.max(1, Math.round(size.width * this.scale));
        el.height = Math.max(1, Math.round(size.height * this.scale));
        this.polygons = buildFocusLines(this.params, size);

        const ctx = el.getContext('2d');
        const s = this.scale;
        ctx.clearRect(0, 0, el.width, el.height);
        ctx.fillStyle = '#f0e0d6'; // futaba-cream(キャンバス地の目安)
        ctx.fillRect(0, 0, el.width, el.height);
        ctx.fillStyle = this.params.color;
        for (const poly of this.polygons) {
            ctx.beginPath();
            poly.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x * s, p.y * s) : ctx.lineTo(p.x * s, p.y * s)));
            ctx.closePath();
            ctx.fill();
        }
        const { center, innerRx, innerRy } = this.params;
        ctx.strokeStyle = '#ff8c42';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.ellipse(center.x * s, center.y * s, Math.max(0.5, innerRx * s), Math.max(0.5, innerRy * s), 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        const h = focusLinesHandles(this.params);
        ctx.fillStyle = '#ffffee';
        for (const type of ['rx', 'ry', 'center']) {
            ctx.beginPath();
            ctx.arc(h[type].x * s, h[type].y * s, type === 'center' ? 6 : 4.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }
        this.overlay.schedule();
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

    _raster() {
        const size = this._canvasSize();
        return rasterizeFocusLines(buildFocusLines(this.params, size), { ...size, color: this.params.color });
    }

    _meta() {
        return sanitizeFocusLinesData({ params: this.params }, this._canvasSize());
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
        showFeedbackToast(`集中線を追加しました（${this.params.count}本）`);
        return { ok: true, layerId: created.layer.layerData.id };
    }

    update() {
        if (!this.editing || !this._guard()) return { ok: false };
        const layer = this.layerSystem.getLayers().find(l => l.layerData?.id === this.editing.layerId);
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
        const apply = (useAfter) => {
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
        this._syncControls();
        this._redraw();
        this._syncOverlayVisibility();
        if (!wasVisible) this.eventBus.emit('popup:shown', { name: 'focusLines' });
    }

    hide() {
        if (!this.popup) return;
        const wasVisible = this.isVisible === true;
        this.popup.classList.remove('show');
        this.isVisible = false;
        this.endDrag();
        this._syncOverlayVisibility();
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
        this._fieldDetachers?.forEach(off => off());
        this.eventBus?.off?.('layer:activated', this._layerListener);
        this.overlay.destroy();
    }
}

window.FocusLinesPopup = FocusLinesPopup;
