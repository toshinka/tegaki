/**
 * ============================================================================
 * ファイル名: ui/tone-panel.js
 * 責務: QTPの「トーン」タブ。トーンparamsを編集し、確定で通常Raster Layerを1件のHistoryで追加/更新する。
 *   確定時、選択中のLayerへクリッピングして貼る(範囲Layerを非破壊に保つ)。
 * 依存: system/tone-geometry.js, system/tone-raster.js, system/history.js, ui/numeric-field.js, ui/feedback-toast.js
 * 被依存: ui/quick-access-popup.js
 * 公開API: TonePanel
 * イベント発火: layer:content-changed
 * 保存: 編集中のparams / プリセット6枠はlocalStorage(UI設定)。確定Layerは通常Raster Layerで、再編集用に
 *   layerData.tone(optional・sanitize済み)を持つ。画素は派生物で、更新で再生成する。
 * 見た目: 部品のclassはコマ割りpopupと共通(styles/components/panel-layout-popup.css)。
 * 実装状態: ✅実装（WP-014）
 * ============================================================================
 */

import { TegakiEventBus } from '../system/event-bus.js';
import { historyManager } from '../system/history.js';
import {
    TONE_LIMITS,
    TONE_SHAPES,
    defaultToneParams,
    normalizeToneParams,
    sanitizeToneData
} from '../system/tone-geometry.js';
import { rasterizeTone } from '../system/tone-raster.js';
import { attachNumericField } from './numeric-field.js';
import { showFeedbackToast } from './feedback-toast.js';

const STORAGE_KEY = 'tegaki-tone-v1';
const SLOTS_KEY = 'tegaki-tone-slots-v1';
const SLOT_COUNT = 6;
const PREVIEW = { width: 150, height: 96 };
const PERCENT = { toDisplay: v => Math.round(v * 100), fromDisplay: v => v / 100, wheelStep: 0.05, unit: '%' };

const FIELDS = Object.freeze([
    { key: 'pitch', label: '間隔', min: TONE_LIMITS.pitch.min, max: TONE_LIMITS.pitch.max, step: 0.5, unit: 'px' },
    { key: 'angle', label: '角度', min: 0, max: 359.5, step: 0.5, unit: '°' },
    { key: 'density', label: '濃度', min: 0, max: 1, step: 0.01, ...PERCENT },
    { key: 'density2', label: '濃度(終)', min: 0, max: 1, step: 0.01, grad: true, ...PERCENT },
    { key: 'gradAngle', label: '向き', min: 0, max: 359, step: 1, unit: '°', grad: true },
    { key: 'gradStart', label: '開始', min: 0, max: 1, step: 0.01, grad: true, ...PERCENT },
    { key: 'gradEnd', label: '終了', min: 0, max: 1, step: 0.01, grad: true, ...PERCENT }
]);

export class TonePanel {
    constructor(dependencies = {}) {
        this.layerSystem = dependencies.layerSystem || null;
        this.eventBus = dependencies.eventBus || TegakiEventBus;
        this.history = dependencies.history || historyManager;
        this.getMainColor = dependencies.getMainColor || null;
        this.root = null;
        this.elements = {};
        this.params = defaultToneParams();
        this.slots = Array.from({ length: SLOT_COUNT }, () => null);
        this.editing = null; // { layerId }
        this._layerListener = () => this._syncControls();
        this.eventBus?.on?.('layer:activated', this._layerListener);
        this._restore();
    }

    _restore() {
        try {
            const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
            if (data?.params) this.params = normalizeToneParams(data.params);
            const slots = JSON.parse(localStorage.getItem(SLOTS_KEY) || 'null');
            if (Array.isArray(slots)) {
                this.slots = Array.from({ length: SLOT_COUNT }, (_, i) => (slots[i] ? normalizeToneParams(slots[i]) : null));
            }
        } catch (error) {
            // 壊れた設定は既定へ戻す(Projectには無関係)
        }
    }

    _persist() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ params: this.params }));
            localStorage.setItem(SLOTS_KEY, JSON.stringify(this.slots));
        } catch (error) {
            // localStorage不可でも動作は続ける
        }
    }

    _canvasSize() {
        const c = this.layerSystem?.config?.canvas || window.TEGAKI_CONFIG?.canvas || {};
        return { width: Math.max(1, Math.round(c.width || 800)), height: Math.max(1, Math.round(c.height || 800)) };
    }

    // ------------------------------------------------------------ DOM

    mount(container) {
        this.root = container;
        container.classList.add('qa-tone-view');
        const shapes = TONE_SHAPES.map(s => `<button type="button" class="pl-chip" data-shape="${s.id}">${s.label}</button>`).join('');
        const rows = FIELDS.map(f => `
            <label class="pl-row${f.grad ? ' qa-tone-grad-row' : ''}">
                <span class="pl-label">${f.label}</span>
                <input type="range" class="pl-range" data-field="${f.key}" min="${f.min}" max="${f.max}" step="${f.step}">
                <span class="pl-value" data-value-for="${f.key}"></span>
            </label>`).join('');
        const slots = this.slots.map((_, i) =>
            `<button type="button" class="pl-chip qa-tone-slot" data-tone-slot="${i}" title="スロット${i + 1}（空=現在値を保存 / 登録済=呼び出し / Shift+クリック=上書き保存）">${i + 1}</button>`
        ).join('');
        container.innerHTML = `
            <div class="pl-title">トーン <span class="pl-edit-status" data-role="edit-status"></span></div>
            <div class="pl-chips qa-tone-slots" role="group" aria-label="プリセット">${slots}</div>
            <div class="pl-chips" role="group" aria-label="形">${shapes}</div>
            <canvas class="pl-preview qa-tone-preview" width="${PREVIEW.width}" height="${PREVIEW.height}" aria-label="トーンプレビュー"></canvas>
            ${rows}
            <label class="pl-row pl-check"><input type="checkbox" data-opt="gradient"><span>グラデーション</span></label>
            <label class="pl-row pl-check"><input type="checkbox" data-opt="crisp"><span>くっきり(二値)</span></label>
            <label class="pl-row pl-check"><input type="checkbox" data-opt="clipToLayer"><span>選択レイヤーにクリップ</span></label>
            <label class="pl-row pl-check"><input type="checkbox" data-opt="fitArea"><span>範囲に合わせる</span></label>
            <div class="pl-row">
                <span class="pl-label">色</span>
                <input type="color" class="pl-color" data-role="color" value="${this.params.color}">
                <button type="button" class="pl-btn pl-btn--small" data-action="main-color" title="メインカラーを使う">メイン色</button>
            </div>
            <div class="pl-footer">
                <button type="button" class="pl-btn" data-action="reset">リセット</button>
                <button type="button" class="pl-btn" data-action="load-active" title="選択中のトーンLayerから読み込んで再編集">再編集</button>
            </div>
            <div class="pl-footer">
                <button type="button" class="pl-btn pl-btn--primary" data-action="update" data-role="update-btn" title="再編集中のLayerを置き換え（Undo 1回で戻る）" hidden>更新</button>
                <button type="button" class="pl-btn pl-btn--primary" data-action="apply" title="新規Layerとして追加（Undo 1回で戻る）">適用</button>
            </div>
        `;
        const q = (sel) => container.querySelector(sel);
        this.elements = {
            canvas: q('.qa-tone-preview'),
            color: q('[data-role="color"]'),
            editStatus: q('[data-role="edit-status"]'),
            updateBtn: q('[data-role="update-btn"]'),
            loadBtn: q('[data-action="load-active"]')
        };
        this._bind();
        this._syncControls();
        this._redraw();
    }

    _bind() {
        const root = this.root;
        root.querySelectorAll('[data-shape]').forEach(btn => btn.addEventListener('click', () => {
            this._setParams({ ...this.params, shape: btn.dataset.shape });
        }));
        root.querySelectorAll('input[data-field]').forEach(input => input.addEventListener('input', () => {
            this._setParams({ ...this.params, [input.dataset.field]: Number(input.value) });
        }));
        root.querySelectorAll('input[data-opt]').forEach(input => input.addEventListener('change', () => {
            this._setParams({ ...this.params, [input.dataset.opt]: input.checked });
        }));
        this.elements.color.addEventListener('input', (e) => this._setParams({ ...this.params, color: e.target.value }));
        root.querySelectorAll('[data-tone-slot]').forEach(btn => btn.addEventListener('click', (e) => this._onSlot(Number(btn.dataset.toneSlot), e.shiftKey)));
        root.querySelectorAll('[data-action]').forEach(btn => btn.addEventListener('click', () => this._onAction(btn.dataset.action)));
        this._detachers = FIELDS.map(f => attachNumericField({
            range: root.querySelector(`input[data-field="${f.key}"]`),
            valueEl: root.querySelector(`[data-value-for="${f.key}"]`),
            toDisplay: f.toDisplay,
            fromDisplay: f.fromDisplay,
            wheelStep: f.wheelStep ?? null
        }));
    }

    _onSlot(index, overwrite) {
        if (!this.slots[index] || overwrite) {
            this.slots[index] = normalizeToneParams(this.params);
            this._persist();
            this._syncControls();
            showFeedbackToast(`スロット${index + 1}に保存しました`);
        } else {
            this._setParams(this.slots[index]);
        }
    }

    _onAction(action) {
        if (action === 'reset') {
            this.editing = null;
            this._setParams(defaultToneParams());
        } else if (action === 'main-color') {
            const color = this.getMainColor?.() || window.brushSettings?.getColor?.();
            const hex = typeof color === 'number' ? `#${color.toString(16).padStart(6, '0')}` : color;
            if (/^#[0-9a-f]{6}$/i.test(hex || '')) this._setParams({ ...this.params, color: hex });
        } else if (action === 'apply') {
            this.apply();
        } else if (action === 'update') {
            this.update();
        } else if (action === 'load-active') {
            this.loadFromActiveLayer();
        }
    }

    _setParams(next) {
        this.params = normalizeToneParams(next);
        this._persist();
        this._syncControls();
        this._redraw();
    }

    _syncControls() {
        if (!this.root || !this.elements.canvas) return;
        for (const f of FIELDS) {
            const input = this.root.querySelector(`input[data-field="${f.key}"]`);
            if (input && Number(input.value) !== this.params[f.key]) input.value = String(this.params[f.key]);
            const out = this.root.querySelector(`[data-value-for="${f.key}"]`);
            if (out && !out.dataset.editing) {
                const raw = this.params[f.key];
                out.textContent = `${f.toDisplay ? f.toDisplay(raw) : raw}${f.unit}`;
            }
            const row = input?.closest('.pl-row');
            if (row && f.grad) row.hidden = !this.params.gradient;
            input?.style.setProperty('--pl-fill', `${((Number(input.value) - f.min) / (f.max - f.min)) * 100}%`);
        }
        this.root.querySelectorAll('[data-shape]').forEach(btn => {
            const on = btn.dataset.shape === this.params.shape;
            btn.setAttribute('aria-pressed', String(on));
            btn.classList.toggle('is-selected', on);
        });
        this.root.querySelectorAll('input[data-opt]').forEach(input => { input.checked = this.params[input.dataset.opt] === true; });
        this.root.querySelectorAll('[data-tone-slot]').forEach(btn => {
            const filled = !!this.slots[Number(btn.dataset.toneSlot)];
            btn.classList.toggle('is-filled', filled);
            btn.style.opacity = filled ? '1' : '0.55';
        });
        this.elements.color.value = this.params.color;
        this.elements.editStatus.textContent = this.editing ? '— 再編集中' : '';
        this.elements.updateBtn.hidden = !this.editing;
        this.elements.loadBtn.disabled = !this._activeTone();
    }

    _redraw() {
        const canvas = this.elements.canvas;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const fill = { x: 0, y: 0, w: canvas.width, h: canvas.height };
        const raster = rasterizeTone(this.params, { width: canvas.width, height: canvas.height, fill, ref: fill });
        if (!raster.ok) return;
        ctx.putImageData(new ImageData(new Uint8ClampedArray(raster.pixels), raster.width, raster.height), 0, 0);
    }

    // ------------------------------------------------------------ 確定

    _activeTone() {
        const data = this.layerSystem?.getActiveLayer?.()?.layerData?.tone;
        return data ? sanitizeToneData(data) : null;
    }

    _guard() {
        if (!this.layerSystem?.createRasterLayerFromSnapshot) {
            showFeedbackToast('Raster Layerを作成できません');
            return false;
        }
        const active = this.layerSystem.getActiveLayer?.();
        if (active?.layerData?.isAnimationWorkingLayer === true) {
            showFeedbackToast('トーンは通常CanvasのRaster Layer専用です');
            return false;
        }
        return true;
    }

    /** 範囲Layerの不透明画素のbbox(キャンバス座標)。取れなければnull。 */
    _areaBounds(layer) {
        if (!layer || layer.layerData?.isFolder) return null;
        const snap = this.layerSystem.createLayerRasterSnapshot?.(layer);
        if (!snap?.pixels || !snap.width || !snap.height) return null;
        const ox = snap.rasterBounds?.x || 0;
        const oy = snap.rasterBounds?.y || 0;
        let x0 = snap.width; let y0 = snap.height; let x1 = -1; let y1 = -1;
        const px = snap.pixels;
        for (let y = 0; y < snap.height; y += 1) {
            for (let x = 0; x < snap.width; x += 1) {
                if (px[(y * snap.width + x) * 4 + 3] > 8) {
                    if (x < x0) x0 = x;
                    if (x > x1) x1 = x;
                    if (y < y0) y0 = y;
                    if (y > y1) y1 = y;
                }
            }
        }
        if (x1 < x0) return null;
        return { x: ox + x0, y: oy + y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
    }

    _raster(areaLayer) {
        const size = this._canvasSize();
        const whole = { x: 0, y: 0, w: size.width, h: size.height };
        const bounds = this.params.clipToLayer ? this._areaBounds(areaLayer) : null;
        const fill = bounds || whole;
        const ref = this.params.fitArea ? fill : whole;
        return rasterizeTone(this.params, { ...size, fill, ref });
    }

    _meta() {
        return sanitizeToneData({ params: this.params });
    }

    apply() {
        if (!this._guard()) return { ok: false };
        const area = this.layerSystem.getActiveLayer?.() || null;
        const clip = this.params.clipToLayer === true && !!area && !area.layerData?.isBackground && !area.layerData?.isFolder;
        const raster = this._raster(clip ? area : null);
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
            }, { name: 'トーン', historyName: 'tone-apply', source: 'tone' });
        } catch (error) {
            created = null;
        }
        if (!created?.layer?.layerData) {
            showFeedbackToast('トーンレイヤーを作成できません');
            return { ok: false };
        }
        const layerId = created.layer.layerData.id;
        created.layer.layerData.tone = this._meta();
        if (clip) {
            const index = this.layerSystem.getLayers().findIndex(l => l.layerData?.id === layerId);
            if (index >= 0) this.layerSystem.setLayerClippingMode(index, 'normal', { recordHistory: false });
        }
        this.eventBus?.emit('layer:content-changed', { layerId, source: 'tone' });
        this.editing = { layerId };
        this._syncControls();
        showFeedbackToast(clip ? 'トーンを選択レイヤーにクリップして追加しました' : 'トーンを追加しました');
        return { ok: true, layerId };
    }

    _clipOwner(layer) {
        const layers = this.layerSystem.getLayers();
        const index = layers.indexOf(layer);
        if (index <= 0 || !(layer.layerData?.clippingMode && layer.layerData.clippingMode !== 'none')) return null;
        for (let i = index - 1; i >= 0; i -= 1) {
            const candidate = layers[i];
            if (!candidate?.layerData) continue;
            const mode = candidate.layerData.clippingMode;
            if (!mode || mode === 'none') return candidate;
        }
        return null;
    }

    update() {
        if (!this.editing || !this._guard()) return { ok: false };
        const layer = this.layerSystem.getLayers().find(l => l.layerData?.id === this.editing.layerId);
        if (!layer) {
            showFeedbackToast('再編集中のトーンLayerが見つかりません');
            this.editing = null;
            this._syncControls();
            return { ok: false };
        }
        const raster = this._raster(this._clipOwner(layer));
        if (!raster.ok) {
            showFeedbackToast(raster.reason);
            return { ok: false };
        }
        const before = this.layerSystem.createLayerRasterSnapshot(layer);
        const after = { ...before, width: raster.width, height: raster.height, pixels: raster.pixels, rasterBounds: raster.rasterBounds, paths: [], pathsData: [] };
        const metaBefore = layer.layerData.tone;
        const metaAfter = this._meta();
        const layerId = layer.layerData.id;
        const apply = (useAfter) => {
            this.layerSystem.restoreLayerRasterSnapshot(useAfter ? after : before);
            layer.layerData.tone = useAfter ? metaAfter : metaBefore;
            this.layerSystem.refreshClippingMasks?.();
            this.eventBus?.emit('layer:content-changed', { layerId, source: 'tone-update' });
        };
        apply(true);
        this.history.record({
            name: 'tone-update',
            do: () => apply(true),
            undo: () => apply(false),
            byteSize: (before.pixels?.byteLength || 0) + (after.pixels?.byteLength || 0),
            meta: { type: 'tone-update', layerId }
        });
        showFeedbackToast('トーンを更新しました');
        return { ok: true, layerId };
    }

    loadFromActiveLayer() {
        const data = this._activeTone();
        if (!data) {
            showFeedbackToast('選択中のレイヤーにトーンの情報がありません');
            return { ok: false };
        }
        this.editing = { layerId: this.layerSystem.getActiveLayer().layerData.id };
        this._setParams(data.params);
        showFeedbackToast('トーンを読み込みました。編集して「更新」できます');
        return { ok: true };
    }

    refresh() {
        this._syncControls();
        this._redraw();
    }

    destroy() {
        this.eventBus?.off?.('layer:activated', this._layerListener);
        this._detachers?.forEach(fn => fn?.());
    }
}
