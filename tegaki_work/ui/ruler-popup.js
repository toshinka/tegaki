/**
 * ============================================================================
 * ファイル名: ui/ruler-popup.js
 * 責務: 定規のミニパネル(Alt+R)。種類・角度・中心・ガイド間隔/本数・Ctrl角度刻み・ガイド表示を数値で調整する
 * 依存: system/drawing/ruler-system.js(window.rulerSystem), system/ruler-geometry.js, ui/numeric-field.js,
 *   ui/popup-drag-helper.js, system/event-bus.js
 * 被依存: core-engine.js, system/popup-manager.js
 * 公開API: RulerPopup
 * イベント受信: ruler:changed（Shift+ドラッグ等の操作中も数値が追従する。rAFに合体）
 * 保存: 状態の正本はRulerSystem(localStorage)。popupは表示と入力の窓口で、保存・Historyを持たない。
 * 見た目: 部品のclassはコマ割りpopupと共通(styles/components/panel-layout-popup.css)。
 * 実装状態: ✅実装
 * ============================================================================
 */

import { TegakiEventBus } from '../system/event-bus.js';
import { RULER_OPTION_LIMITS, RULER_TYPE_LABELS, RULER_TYPES } from '../system/ruler-geometry.js';
import { attachNumericField } from './numeric-field.js';
import { attachPopupDrag, mountPopupAtOverlayRoot } from './popup-drag-helper.js';

const POPUP_ID = 'ruler-popup';
const TAU = Math.PI * 2;
const toDeg = (rad) => Math.round(((rad * 180) / Math.PI) * 10) / 10;
const toRad = (deg) => (deg * Math.PI) / 180;

export class RulerPopup {
    constructor(dependencies = {}) {
        this.eventBus = dependencies.eventBus || TegakiEventBus;
        this.getRuler = dependencies.getRuler || (() => window.rulerSystem);
        this.popup = null;
        this.isVisible = false;
        this.popupDragCleanup = null;
        this._frame = null;
        this._detachFields = [];
        this._onChanged = () => this._scheduleSync();
        this.eventBus?.on?.('ruler:changed', this._onChanged);
        this._ensurePopupElement();
    }

    _canvasSize() {
        const c = window.TEGAKI_CONFIG?.canvas || {};
        return { width: Math.max(1, Math.round(c.width || 800)), height: Math.max(1, Math.round(c.height || 800)) };
    }

    _ensurePopupElement() {
        let popup = document.getElementById(POPUP_ID);
        if (!popup) {
            popup = document.createElement('div');
            popup.id = POPUP_ID;
            popup.className = 'popup-panel popup-panel--translucent ui-scrollbar ruler-popup';
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
        const size = this._canvasSize();
        const L = RULER_OPTION_LIMITS;
        const closeBtn = window.DOMBuilder
            ? window.DOMBuilder.createCloseButton(POPUP_ID).outerHTML
            : `<button class="ui-close-button ui-close-button--medium popup-close-btn" data-action="close-popup" data-target="${POPUP_ID}" type="button">${window.UI_ICONS?.close || '×'}</button>`;
        const types = RULER_TYPES.map(t =>
            `<button type="button" class="pl-chip pl-chip--wide" data-type="${t}">${t === 'parallel' ? '平行線' : '放射線'}</button>`
        ).join('');
        const row = (key, label, min, max, step, hint = '') => `
            <label class="pl-row" data-row="${key}"${hint ? ` title="${hint}"` : ''}>
                <span class="pl-label">${label}</span>
                <input type="range" class="pl-range" data-field="${key}" min="${min}" max="${max}" step="${step}">
                <span class="pl-value" data-value-for="${key}"></span>
            </label>`;

        this.popup.innerHTML = `
            ${closeBtn}
            <div class="pl-title">定規</div>
            <div class="pl-row">
                <span class="pl-label">定規</span>
                <span class="pl-chips">
                    <button type="button" class="pl-chip pl-chip--wide" data-role="enabled" aria-pressed="false" title="定規 ON/OFF（R）">ON</button>
                    ${types}
                </span>
            </div>
            <div data-role="parallel-only">
                ${row('angle', '角度', 0, 359.5, 0.5, 'Shift+ドラッグでも回せます')}
                <div class="pl-actions" role="group" aria-label="角度のクイック設定">
                    <button type="button" class="pl-btn" data-angle="0">0°</button>
                    <button type="button" class="pl-btn" data-angle="45">45°</button>
                    <button type="button" class="pl-btn" data-angle="90">90°</button>
                    <button type="button" class="pl-btn" data-angle="135">135°</button>
                </div>
                ${row('spacing', 'ガイド間隔', L.spacing.min, L.spacing.max, 1, '画面上の間隔(px)。拡大しても一定')}
                ${row('angleSnap', '角度刻み', L.angleSnap.min, L.angleSnap.max, 1, 'Ctrl+Shift+ドラッグの刻み(度)')}
            </div>
            <div data-role="radial-only">
                ${row('spokes', 'ガイド本数', L.spokes.min, L.spokes.max, 1, '表示のみ。吸着は常に中心→始点の方向')}
            </div>
            ${row('cx', '中心 X', -size.width, size.width * 2, 1)}
            ${row('cy', '中心 Y', -size.height, size.height * 2, 1)}
            <div class="pl-actions" role="group" aria-label="中心">
                <button type="button" class="pl-btn" data-action="center-canvas">中心を中央へ</button>
            </div>
            <label class="pl-row pl-check">
                <input type="checkbox" data-role="show-guides">
                <span>ガイド線を表示（吸着は有効のまま）</span>
            </label>
        `;

        const q = (sel) => this.popup.querySelector(sel);
        const fields = [
            { key: 'angle', unit: '°' },
            { key: 'spacing', unit: 'px' },
            { key: 'angleSnap', unit: '°' },
            { key: 'spokes', unit: '本' },
            { key: 'cx', unit: 'px' },
            { key: 'cy', unit: 'px' }
        ];
        this._fields = fields;
        this._detachFields = fields.map(f => attachNumericField({
            range: q(`input[data-field="${f.key}"]`),
            valueEl: q(`[data-value-for="${f.key}"]`)
        }));

        this.popup.querySelectorAll('input[data-field]').forEach(input => input.addEventListener('input', () => this._applyField(input)));
        this.popup.querySelectorAll('[data-type]').forEach(btn => btn.addEventListener('click', () => this._ruler()?.setState({ type: btn.dataset.type, enabled: true })));
        q('[data-role="enabled"]').addEventListener('click', () => {
            const ruler = this._ruler();
            if (ruler) ruler.setState({ enabled: !ruler.isEnabled() });
        });
        this.popup.querySelectorAll('[data-angle]').forEach(btn => btn.addEventListener('click', () => this._ruler()?.setState({ angle: toRad(Number(btn.dataset.angle)) })));
        q('[data-action="center-canvas"]').addEventListener('click', () => {
            const s = this._canvasSize();
            this._ruler()?.setState({ center: { x: s.width / 2, y: s.height / 2 } });
        });
        q('[data-role="show-guides"]').addEventListener('change', (e) => this._ruler()?.setState({ showGuides: e.target.checked }));
        this._sync();
    }

    _ruler() {
        const ruler = this.getRuler();
        return ruler?.setState ? ruler : null;
    }

    _applyField(input) {
        const ruler = this._ruler();
        if (!ruler) return;
        const value = Number(input.value);
        const state = ruler.getState();
        switch (input.dataset.field) {
            case 'angle': ruler.setState({ angle: toRad(value) % TAU }); break;
            case 'spacing': ruler.setState({ spacing: value }); break;
            case 'angleSnap': ruler.setState({ angleSnap: value }); break;
            case 'spokes': ruler.setState({ spokes: value }); break;
            case 'cx': ruler.setState({ center: { x: value, y: state.center.y } }); break;
            case 'cy': ruler.setState({ center: { x: state.center.x, y: value } }); break;
            default: break;
        }
    }

    _scheduleSync() {
        if (!this.isVisible || this._frame !== null) return;
        this._frame = requestAnimationFrame(() => {
            this._frame = null;
            this._sync();
        });
    }

    /** RulerSystemの状態を入力欄へ反映(直接入力中の値表示は壊さない)。 */
    _sync() {
        const ruler = this._ruler();
        if (!ruler || !this.popup) return;
        const state = ruler.getState();
        const values = {
            angle: toDeg(state.angle),
            spacing: state.spacing,
            angleSnap: state.angleSnap,
            spokes: state.spokes,
            cx: Math.round(state.center.x * 10) / 10,
            cy: Math.round(state.center.y * 10) / 10
        };
        for (const f of this._fields) {
            const input = this.popup.querySelector(`input[data-field="${f.key}"]`);
            if (input && Number(input.value) !== values[f.key]) input.value = String(values[f.key]);
            const out = this.popup.querySelector(`[data-value-for="${f.key}"]`);
            if (out && !out.dataset.editing) out.textContent = `${values[f.key]}${f.unit}`;
            if (input) {
                const min = Number(input.min);
                const max = Number(input.max);
                const pct = max > min ? ((Number(input.value) - min) / (max - min)) * 100 : 0;
                input.style.setProperty('--pl-fill', `${Math.max(0, Math.min(100, pct))}%`);
            }
        }
        const enabledBtn = this.popup.querySelector('[data-role="enabled"]');
        enabledBtn.setAttribute('aria-pressed', String(state.enabled));
        enabledBtn.classList.toggle('is-selected', state.enabled);
        enabledBtn.textContent = state.enabled ? 'ON' : 'OFF';
        this.popup.querySelectorAll('[data-type]').forEach(btn => {
            const on = btn.dataset.type === state.type;
            btn.setAttribute('aria-pressed', String(on));
            btn.classList.toggle('is-selected', on);
            btn.title = RULER_TYPE_LABELS[btn.dataset.type] || '';
        });
        this.popup.querySelector('[data-role="parallel-only"]').hidden = state.type !== 'parallel';
        this.popup.querySelector('[data-role="radial-only"]').hidden = state.type !== 'radial';
        this.popup.querySelector('[data-role="show-guides"]').checked = state.showGuides !== false;
    }

    // ------------------------------------------------------------ popup protocol

    show() {
        const wasVisible = this.isVisible === true;
        if (!this.popup) this._ensurePopupElement();
        if (!this.popup) return;
        this.popup.classList.add('show');
        this.isVisible = true;
        this._sync();
        if (!wasVisible) this.eventBus.emit('popup:shown', { name: 'ruler' });
    }

    hide() {
        if (!this.popup) return;
        const wasVisible = this.isVisible === true;
        this.popup.classList.remove('show');
        this.isVisible = false;
        if (wasVisible) this.eventBus.emit('popup:hidden', { name: 'ruler' });
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
        this._detachFields.forEach(off => off());
        this.eventBus?.off?.('ruler:changed', this._onChanged);
        if (this._frame !== null) cancelAnimationFrame(this._frame);
    }
}

window.RulerPopup = RulerPopup;
