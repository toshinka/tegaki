/**
 * ============================================================================
 * ファイル名: ui/panel-layout-popup.js
 * 責務: 漫画コマ割りpopup。分割木を編集し、確定で枠線Raster Layerを1件のHistoryで追加する
 * 依存: system/panel-layout.js, system/panel-layout-raster.js, system/event-bus.js,
 *   ui/popup-drag-helper.js, ui/feedback-toast.js, ui/dom-builder.js(閉じるボタン)
 * 被依存: core-engine.js, system/popup-manager.js
 * 公開API: PanelLayoutPopup
 * イベント発火: popup:shown, popup:hidden, layer:content-changed
 * 保存: コマ割り木とparamsはlocalStorage(UI設定)のみ。Project/History/保存正本を新設しない。
 *   Projectへ入るのは確定時に作る通常Raster Layerだけ。
 * 実装状態: ✅実装（WP-010 Rough Product Pass / Owner受入待ち）
 * ============================================================================
 */

import { TegakiEventBus } from '../system/event-bus.js';
import {
    PANEL_LAYOUT_LIMITS,
    PANEL_PRESETS,
    buildPresetById,
    dragSplitRatio,
    findNode,
    findParent,
    hitTestPanel,
    hitTestSplit,
    normalizePanelLayoutParams,
    removePanel,
    resolvePanelLayout,
    setPanelBleed,
    splitPanel,
    updateSplit
} from '../system/panel-layout.js';
import { rasterizePanelFrames } from '../system/panel-layout-raster.js';
import { attachPopupDrag, mountPopupAtOverlayRoot } from './popup-drag-helper.js';
import { showFeedbackToast } from './feedback-toast.js';

const STORAGE_KEY = 'tegaki-panel-layout-v1';
const POPUP_ID = 'panel-layout-popup';
const PREVIEW_MAX = { width: 280, height: 330 };

const SLIDERS = Object.freeze([
    { key: 'margin', label: '余白', unit: 'px', step: 1, ...PANEL_LAYOUT_LIMITS.margin },
    { key: 'gap', label: 'コマ間隔', unit: 'px', step: 1, ...PANEL_LAYOUT_LIMITS.gap },
    { key: 'lineWidth', label: '線の太さ', unit: 'px', step: 0.5, ...PANEL_LAYOUT_LIMITS.lineWidth }
]);

const BLEED_SIDES = Object.freeze([
    { side: 'top', label: '上' },
    { side: 'right', label: '右' },
    { side: 'bottom', label: '下' },
    { side: 'left', label: '左' }
]);

export class PanelLayoutPopup {
    constructor(dependencies = {}) {
        this.layerSystem = dependencies.layerSystem || null;
        this.eventBus = dependencies.eventBus || TegakiEventBus;
        this.popup = null;
        this.isVisible = false;
        this.popupDragCleanup = null;
        this.elements = {};

        this.params = normalizePanelLayoutParams();
        this.color = '#000000';
        this.tree = buildPresetById('grid4');
        this.selectedId = null;
        this.drag = null; // { pointerId, splitId }
        this.hoverSplitId = null;
        this.resolved = null;
        this.scale = 1;

        this._restore();
        this._ensurePopupElement();
    }

    // ------------------------------------------------------------ 永続(UI設定のみ)

    _restore() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const data = JSON.parse(raw);
            if (data?.params) this.params = normalizePanelLayoutParams(data.params);
            if (typeof data?.color === 'string') this.color = data.color;
            if (data?.tree && this._isValidTree(data.tree)) this.tree = data.tree;
        } catch (error) {
            // 壊れた設定は黙って既定へ戻す(Projectには無関係)
        }
    }

    _persist() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ params: this.params, color: this.color, tree: this.tree }));
        } catch (error) {
            // localStorage不可でも動作は続ける
        }
    }

    _isValidTree(node, depth = 0) {
        if (!node || depth > 12 || typeof node.id !== 'string') return false;
        if (node.kind === 'panel') return true;
        return node.kind === 'split'
            && (node.dir === 'h' || node.dir === 'v')
            && Number.isFinite(node.ratio)
            && this._isValidTree(node.a, depth + 1)
            && this._isValidTree(node.b, depth + 1);
    }

    // ------------------------------------------------------------ DOM

    _canvasSize() {
        const c = this.layerSystem?.config?.canvas || window.TEGAKI_CONFIG?.canvas || {};
        return { width: Math.max(1, Math.round(c.width || 800)), height: Math.max(1, Math.round(c.height || 1000)) };
    }

    _ensurePopupElement() {
        let popup = document.getElementById(POPUP_ID);
        if (!popup) {
            popup = document.createElement('div');
            popup.id = POPUP_ID;
            popup.className = 'popup-panel popup-panel--translucent panel-layout-popup';
            popup.style.top = '60px';
            popup.style.left = '60px';
            (document.querySelector('.main-layout') || document.body).appendChild(popup);
        } else {
            mountPopupAtOverlayRoot(popup);
        }
        this.popup = popup;
        this._build();
        // プレビューcanvasとrangeはpopup移動ではなく自前のpointer操作を優先する。
        this.popupDragCleanup = attachPopupDrag(popup, {
            interactiveSelector: 'button, input, select, textarea, a, canvas, .popup-close-btn, .ui-close-button'
        });
    }

    _build() {
        const closeBtn = window.DOMBuilder
            ? window.DOMBuilder.createCloseButton(POPUP_ID).outerHTML
            : `<button class="ui-close-button ui-close-button--medium popup-close-btn" data-action="close-popup" data-target="${POPUP_ID}" type="button">${window.UI_ICONS?.close || '×'}</button>`;

        const presetButtons = PANEL_PRESETS.map(p =>
            `<button type="button" class="pl-preset" data-preset="${p.id}" title="${p.label}" aria-label="${p.label}">${this._presetThumb(p.id)}</button>`
        ).join('');
        const sliders = SLIDERS.map(s => `
            <label class="pl-row">
                <span class="pl-label">${s.label}</span>
                <input type="range" class="pl-range" data-param="${s.key}" min="${s.min}" max="${s.max}" step="${s.step}">
                <span class="pl-value" data-value-for="${s.key}"></span>
            </label>`).join('');
        const bleeds = BLEED_SIDES.map(b =>
            `<button type="button" class="pl-chip" data-bleed="${b.side}" aria-pressed="false">${b.label}</button>`
        ).join('');

        this.popup.innerHTML = `
            ${closeBtn}
            <div class="pl-title">コマ割り</div>
            <div class="pl-presets" role="group" aria-label="プリセット">${presetButtons}</div>
            <canvas class="pl-preview" width="${PREVIEW_MAX.width}" height="${PREVIEW_MAX.height}" aria-label="コマ割りプレビュー"></canvas>
            <div class="pl-hint">コマをクリックで選択 / 間の線をドラッグで位置調整</div>
            <div class="pl-actions" role="group" aria-label="選択コマの操作">
                <button type="button" class="pl-btn" data-action="split-h" title="選択コマを上下に分割">上下に分割</button>
                <button type="button" class="pl-btn" data-action="split-v" title="選択コマを左右に分割">左右に分割</button>
                <button type="button" class="pl-btn" data-action="remove" title="選択コマを削除し隣のコマが広がる">結合</button>
            </div>
            <div class="pl-split-group" data-role="split-group">
                <label class="pl-row">
                    <span class="pl-label">傾き</span>
                    <input type="range" class="pl-range" data-split="slant" min="${PANEL_LAYOUT_LIMITS.slant.min}" max="${PANEL_LAYOUT_LIMITS.slant.max}" step="0.005">
                    <span class="pl-value" data-value-for="slant"></span>
                </label>
                <label class="pl-row">
                    <span class="pl-label">この線の間隔</span>
                    <input type="range" class="pl-range" data-split="gap" min="${PANEL_LAYOUT_LIMITS.gap.min}" max="${PANEL_LAYOUT_LIMITS.gap.max}" step="1">
                    <span class="pl-value" data-value-for="splitGap"></span>
                </label>
                <button type="button" class="pl-btn pl-btn--small" data-action="reset-split-gap">全体の間隔に戻す</button>
            </div>
            <div class="pl-row pl-bleed-row" data-role="bleed-group">
                <span class="pl-label">裁ち落とし</span>
                <span class="pl-chips">${bleeds}</span>
            </div>
            <div class="pl-sep"></div>
            ${sliders}
            <label class="pl-row">
                <span class="pl-label">線の色</span>
                <input type="color" class="pl-color" value="${this.color}">
            </label>
            <div class="pl-footer">
                <button type="button" class="pl-btn" data-action="reset">リセット</button>
                <button type="button" class="pl-btn pl-btn--primary" data-action="apply" title="枠線を新規Raster Layerとして追加（Undo 1回で戻る）">枠線を新規レイヤーに適用</button>
            </div>
            <div class="pl-warning" data-role="warning" hidden>間隔や余白が大きすぎて潰れたコマがあります</div>
        `;

        const q = (sel) => this.popup.querySelector(sel);
        this.elements = {
            canvas: q('.pl-preview'),
            warning: q('[data-role="warning"]'),
            splitGroup: q('[data-role="split-group"]'),
            bleedGroup: q('[data-role="bleed-group"]'),
            color: q('.pl-color')
        };
        this._bind();
        this._syncControls();
        this._redraw();
    }

    _presetThumb(id) {
        const tree = buildPresetById(id);
        const r = resolvePanelLayout(tree, { width: 100, height: 130 }, { margin: 6, gap: 5 });
        const polys = r.panels.map(p =>
            `<polygon points="${p.quad.map(pt => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ')}"/>`
        ).join('');
        return `<svg viewBox="0 0 100 130" width="22" height="28" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round" aria-hidden="true">${polys}</svg>`;
    }

    // ------------------------------------------------------------ 操作

    _bind() {
        const root = this.popup;
        root.querySelectorAll('[data-preset]').forEach(btn => btn.addEventListener('click', () => {
            this.tree = buildPresetById(btn.dataset.preset);
            this.selectedId = null;
            this._changed();
        }));
        root.querySelectorAll('input[data-param]').forEach(input => input.addEventListener('input', () => {
            this.params = normalizePanelLayoutParams({ ...this.params, [input.dataset.param]: Number(input.value) });
            this._changed();
        }));
        root.querySelector('[data-split="slant"]').addEventListener('input', (e) => this._patchSelectedSplit({ slant: Number(e.target.value) }));
        root.querySelector('[data-split="gap"]').addEventListener('input', (e) => this._patchSelectedSplit({ gap: Number(e.target.value) }));
        this.elements.color.addEventListener('input', (e) => {
            this.color = e.target.value;
            this._persist();
            this._redraw();
        });
        root.querySelectorAll('[data-bleed]').forEach(btn => btn.addEventListener('click', () => {
            const node = this.selectedId && findNode(this.tree, this.selectedId);
            if (!node || node.kind !== 'panel') return;
            const bleed = { ...(node.bleed || {}) };
            bleed[btn.dataset.bleed] = !bleed[btn.dataset.bleed];
            this.tree = setPanelBleed(this.tree, node.id, bleed);
            this._changed();
        }));
        root.querySelectorAll('[data-action]').forEach(btn => {
            if (btn.dataset.action === 'close-popup') return;
            btn.addEventListener('click', () => this._onAction(btn.dataset.action));
        });

        const canvas = this.elements.canvas;
        canvas.addEventListener('pointerdown', (e) => this._onPointerDown(e));
        canvas.addEventListener('pointermove', (e) => this._onPointerMove(e));
        canvas.addEventListener('pointerup', (e) => this._onPointerUp(e));
        canvas.addEventListener('pointercancel', (e) => this._onPointerUp(e));
        canvas.addEventListener('pointerleave', () => {
            if (this.drag) return;
            this.hoverSplitId = null;
            this._redraw();
        });
    }

    _onAction(action) {
        if (action === 'reset') {
            this.tree = buildPresetById('single');
            this.selectedId = null;
            this._changed();
        } else if (action === 'apply') {
            this.apply();
        } else if (action === 'split-h' || action === 'split-v') {
            const target = this._selectedPanelId();
            if (!target) return showFeedbackToast('分割するコマを選択してください');
            this.tree = splitPanel(this.tree, target, action === 'split-h' ? 'h' : 'v', 0.5);
            this._changed();
        } else if (action === 'remove') {
            const target = this._selectedPanelId();
            if (!target) return showFeedbackToast('結合するコマを選択してください');
            this.tree = removePanel(this.tree, target);
            this.selectedId = null;
            this._changed();
        } else if (action === 'reset-split-gap') {
            const split = this._selectedParentSplit();
            if (split) this._patchSelectedSplit({ gap: null });
        }
    }

    _selectedPanelId() {
        const node = this.selectedId && findNode(this.tree, this.selectedId);
        return node && node.kind === 'panel' ? node.id : null;
    }

    _selectedParentSplit() {
        const id = this._selectedPanelId();
        return id ? findParent(this.tree, id) : null;
    }

    _patchSelectedSplit(patch) {
        const split = this._selectedParentSplit();
        if (!split) return;
        this.tree = updateSplit(this.tree, split.id, patch);
        this._changed();
    }

    _changed() {
        this._persist();
        this._syncControls();
        this._redraw();
    }

    _syncControls() {
        if (!this.popup) return;
        for (const s of SLIDERS) {
            const input = this.popup.querySelector(`input[data-param="${s.key}"]`);
            if (input && Number(input.value) !== this.params[s.key]) input.value = String(this.params[s.key]);
            const out = this.popup.querySelector(`[data-value-for="${s.key}"]`);
            if (out) out.textContent = `${this.params[s.key]}${s.unit}`;
        }
        const panel = this._selectedPanelId() ? findNode(this.tree, this._selectedPanelId()) : null;
        const split = this._selectedParentSplit();
        this.elements.splitGroup.hidden = !split;
        this.elements.bleedGroup.hidden = !panel;
        if (split) {
            const slant = this.popup.querySelector('[data-split="slant"]');
            const gap = this.popup.querySelector('[data-split="gap"]');
            slant.value = String(split.slant || 0);
            gap.value = String(split.gap ?? this.params.gap);
            this.popup.querySelector('[data-value-for="slant"]').textContent = `${Math.round((split.slant || 0) * 100)}%`;
            this.popup.querySelector('[data-value-for="splitGap"]').textContent = split.gap == null ? '全体' : `${split.gap}px`;
        }
        this.popup.querySelectorAll('[data-bleed]').forEach(btn => {
            const on = panel?.bleed?.[btn.dataset.bleed] === true;
            btn.setAttribute('aria-pressed', String(on));
            btn.classList.toggle('is-selected', on);
        });
    }

    // ------------------------------------------------------------ プレビュー

    _toCanvasPoint(e) {
        const rect = this.elements.canvas.getBoundingClientRect();
        const px = (e.clientX - rect.left) * (this.elements.canvas.width / rect.width);
        const py = (e.clientY - rect.top) * (this.elements.canvas.height / rect.height);
        return { x: px / this.scale, y: py / this.scale };
    }

    _onPointerDown(e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        const pt = this._toCanvasPoint(e);
        const tol = 8 / this.scale;
        const splitId = hitTestSplit(this.resolved, pt, tol);
        if (splitId) {
            this.drag = { pointerId: e.pointerId, splitId };
            this.elements.canvas.setPointerCapture?.(e.pointerId);
        } else {
            this.selectedId = hitTestPanel(this.resolved, pt);
            this._syncControls();
            this._redraw();
        }
        e.preventDefault();
    }

    _onPointerMove(e) {
        const pt = this._toCanvasPoint(e);
        if (this.drag && e.pointerId === this.drag.pointerId) {
            const ratio = dragSplitRatio(this.resolved, this.drag.splitId, pt);
            if (ratio !== null) {
                this.tree = updateSplit(this.tree, this.drag.splitId, { ratio });
                this._persist();
                this._redraw();
            }
            return;
        }
        const hover = hitTestSplit(this.resolved, pt, 8 / this.scale);
        if (hover !== this.hoverSplitId) {
            this.hoverSplitId = hover;
            this.elements.canvas.style.cursor = hover ? 'grab' : 'default';
            this._redraw();
        }
    }

    _onPointerUp(e) {
        if (!this.drag || e.pointerId !== this.drag.pointerId) return;
        this.elements.canvas.releasePointerCapture?.(e.pointerId);
        this.drag = null;
    }

    _redraw() {
        const canvasEl = this.elements.canvas;
        if (!canvasEl) return;
        const size = this._canvasSize();
        this.scale = Math.min(PREVIEW_MAX.width / size.width, PREVIEW_MAX.height / size.height);
        canvasEl.width = Math.max(1, Math.round(size.width * this.scale));
        canvasEl.height = Math.max(1, Math.round(size.height * this.scale));
        this.resolved = resolvePanelLayout(this.tree, size, this.params);
        this.elements.warning.hidden = this.resolved.valid;

        const ctx = canvasEl.getContext('2d');
        const s = this.scale;
        ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
        ctx.fillStyle = '#ffffee';
        ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);

        const trace = (quad) => {
            ctx.beginPath();
            quad.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x * s, p.y * s) : ctx.lineTo(p.x * s, p.y * s)));
            ctx.closePath();
        };
        for (const panel of this.resolved.panels) {
            trace(panel.quad);
            ctx.fillStyle = panel.id === this.selectedId ? 'rgba(255, 140, 66, 0.22)' : 'rgba(212, 168, 160, 0.28)';
            ctx.fill();
            ctx.strokeStyle = this.color;
            ctx.lineWidth = Math.max(1, this.params.lineWidth * s);
            ctx.lineJoin = 'miter';
            ctx.stroke();
            if (panel.id === this.selectedId) {
                ctx.strokeStyle = '#ff8c42';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        }
        if (this.hoverSplitId || this.drag) {
            const split = this.resolved.splits.find(sp => sp.id === (this.drag?.splitId || this.hoverSplitId));
            if (split) {
                ctx.strokeStyle = '#ff8c42';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 4]);
                ctx.beginPath();
                ctx.moveTo(split.cut[0].x * s, split.cut[0].y * s);
                ctx.lineTo(split.cut[1].x * s, split.cut[1].y * s);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }
    }

    // ------------------------------------------------------------ 確定

    apply() {
        const layerSystem = this.layerSystem;
        if (!layerSystem?.createRasterLayerFromSnapshot) {
            showFeedbackToast('Raster Layerを作成できません');
            return { ok: false };
        }
        if (layerSystem.getActiveLayer?.()?.layerData?.isAnimationWorkingLayer === true) {
            showFeedbackToast('コマ割りは通常CanvasのRaster Layer専用です');
            return { ok: false };
        }
        const size = this._canvasSize();
        const resolved = resolvePanelLayout(this.tree, size, this.params);
        const raster = rasterizePanelFrames(resolved, { ...size, lineWidth: this.params.lineWidth, color: this.color });
        if (!raster.ok) {
            showFeedbackToast(raster.reason);
            return { ok: false };
        }
        let created = null;
        try {
            created = layerSystem.createRasterLayerFromSnapshot({
                width: raster.width,
                height: raster.height,
                pixels: raster.pixels,
                rasterBounds: raster.rasterBounds,
                paths: [],
                pathsData: []
            }, { name: 'コマ枠', historyName: 'panel-layout-apply', source: 'panel-layout' });
        } catch (error) {
            created = null;
        }
        if (!created?.layer?.layerData) {
            showFeedbackToast('コマ枠レイヤーを作成できません');
            return { ok: false };
        }
        this.eventBus?.emit('layer:content-changed', { layerId: created.layer.layerData.id, source: 'panel-layout' });
        showFeedbackToast(`コマ枠を追加しました（${resolved.panels.length}コマ）`);
        return { ok: true, layerId: created.layer.layerData.id, panelCount: resolved.panels.length };
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
        if (!wasVisible) this.eventBus.emit('popup:shown', { name: 'panelLayout' });
    }

    hide() {
        if (!this.popup) return;
        const wasVisible = this.isVisible === true;
        this.popup.classList.remove('show');
        this.isVisible = false;
        this.drag = null;
        if (wasVisible) this.eventBus.emit('popup:hidden', { name: 'panelLayout' });
    }

    toggle() {
        if (this.isVisible) this.hide();
        else this.show();
    }

    isReady() {
        return !!this.popup;
    }

    destroy() {
        this.popupDragCleanup?.();
        this.popupDragCleanup = null;
    }
}

window.PanelLayoutPopup = PanelLayoutPopup;
