/**
 * ============================================================================
 * ファイル名: ui/panel-layout-overlay.js
 * 責務: コマ割りのSVG表示。通常は外周/頂点、分割mode・Ctrl対象操作は本体内も操作する
 * 依存: coordinate-system.js, system/event-bus.js
 * 被依存: ui/panel-layout-popup.js
 * 公開API: PanelLayoutOverlay
 * イベント受信: camera:transform-changed, canvas:resized
 * 設計: svg本体はpointer-events:none。操作要素(分割線 / コマ外周 / 頂点)だけがeventを受け、
 *   通常の連動コマ内側は描画へ透過。Space/global Vでは全hitをCamera/Transformへ譲る。
 *   保存・Historyには関与しない(表示専用)。
 * 実装状態: ✅実装（WP-010）
 * ============================================================================
 */

import { coordinateSystem } from '../coordinate-system.js';
import { TegakiEventBus } from '../system/event-bus.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function el(name, attrs = {}) {
    const node = document.createElementNS(SVG_NS, name);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    return node;
}

export class PanelLayoutOverlay {
    /**
     * @param {{ onPointerDown: (target: object, event: PointerEvent) => void, getState: () => object|null }} options
     */
    constructor({ onPointerDown, getState, eventBus = TegakiEventBus } = {}) {
        this.onPointerDown = onPointerDown;
        this.getState = getState;
        this.eventBus = eventBus;
        this.coordSystem = coordinateSystem;
        this.svg = null;
        this.visible = false;
        this._frame = null;
        this._subscriptions = [];
    }

    mount() {
        if (this.svg) return;
        const svg = el('svg', { class: 'panel-layout-overlay', 'aria-hidden': 'true' });
        (document.querySelector('.canvas-area') || document.body).appendChild(svg);
        this.svg = svg;
        for (const name of ['camera:transform-changed', 'canvas:resized']) {
            const handler = () => this.schedule();
            this.eventBus.on(name, handler);
            this._subscriptions.push(() => this.eventBus.off(name, handler));
        }
    }

    setVisible(visible) {
        this.visible = visible === true;
        this.mount();
        this.svg.classList.toggle('is-visible', this.visible);
        if (this.visible) this.render();
    }

    schedule() {
        if (!this.visible || this._frame !== null) return;
        this._frame = requestAnimationFrame(() => {
            this._frame = null;
            this.render();
        });
    }

    /** client座標 → プロジェクト(キャンバス)座標。範囲外もclampしない。 */
    clientToCanvas(clientX, clientY) {
        const world = this.coordSystem.screenClientToWorld(clientX, clientY);
        if (!world || !Number.isFinite(world.worldX) || !Number.isFinite(world.worldY)) return null;
        return { x: world.worldX, y: world.worldY };
    }

    /** 画面1pxがキャンバス何pxか(許容距離換算用)。 */
    canvasPerScreenPixel() {
        const a = this.clientToCanvas(0, 0);
        const b = this.clientToCanvas(100, 0);
        if (!a || !b) return 1;
        return Math.max(1e-6, Math.abs(b.x - a.x) / 100) || 1;
    }

    _toScreen(p) {
        const s = this.coordSystem.worldToScreen(p.x, p.y);
        return Number.isFinite(s?.clientX) ? { x: s.clientX, y: s.clientY } : null;
    }

    render() {
        if (!this.svg || !this.visible) return;
        const state = this.getState?.();
        this.svg.replaceChildren();
        if (!state?.resolved) return;
        const { resolved, selectedId, hoverSplitId, dragSplitId, cutPreview, splitMode } = state;
        this.svg.classList.toggle('is-splitting', splitMode === true);

        for (const panel of resolved.panels) {
            const pts = panel.quad.map(p => this._toScreen(p));
            if (pts.some(p => !p)) continue;
            const points = pts.map(p => `${p.x},${p.y}`).join(' ');
            const selected = panel.id === selectedId;
            const poly = el('polygon', { points, class: `pl-ov-panel${selected ? ' is-selected' : ''}${panel.deleted ? ' is-deleted' : ''}` });
            this.svg.appendChild(poly);
            if (panel.number) {
                const cx = pts.reduce((sum, p) => sum + p.x, 0) / 4;
                const cy = pts.reduce((sum, p) => sum + p.y, 0) / 4;
                const text = el('text', { x: cx, y: cy, class: 'pl-ov-number' });
                text.textContent = String(panel.number);
                this.svg.appendChild(text);
            }
            const hit = el('polygon', { points, class: `pl-ov-hit${selected && panel.free ? ' is-free-selected' : ''}`, 'data-kind': 'panel', 'data-panel-id': panel.id });
            hit.addEventListener('pointerdown', e => this._down({ type: 'panel', id: panel.id }, e));
            this.svg.appendChild(hit);
        }
        for (const split of resolved.splits) {
            const a = this._toScreen(split.cut[0]);
            const b = this._toScreen(split.cut[1]);
            if (!a || !b) continue;
            const active = split.id === hoverSplitId || split.id === dragSplitId;
            this.svg.appendChild(el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: `pl-ov-cut${active ? ' is-active' : ''}` }));
            const hit = el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: 'pl-ov-cut-hit', 'data-kind': 'split' });
            hit.addEventListener('pointerdown', e => this._down({ type: 'split', id: split.id }, e));
            this.svg.appendChild(hit);
        }
        const selectedPanel = resolved.panels.find(p => p.id === selectedId);
        if (selectedPanel) {
            selectedPanel.quad.forEach((q, index) => {
                const s = this._toScreen(q);
                if (!s) return;
                const handle = el('circle', { cx: s.x, cy: s.y, r: 6, class: 'pl-ov-handle', 'data-kind': 'corner' });
                handle.addEventListener('pointerdown', e => this._down({ type: 'corner', id: selectedPanel.id, index }, e));
                this.svg.appendChild(handle);
            });
        }
        if(cutPreview?.ok){const a=this._toScreen(cutPreview.cut[0]),b=this._toScreen(cutPreview.cut[1]);if(a&&b)this.svg.appendChild(el('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,class:'pl-ov-cut-preview'}));}
    }

    _down(target, event) {
        if(this.svg.classList.contains('is-camera')||this.svg.classList.contains('is-transform'))return;
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        this.onPointerDown?.(target, event);
    }

    destroy() {
        this._subscriptions.forEach(off => off());
        this._subscriptions = [];
        if (this._frame !== null) cancelAnimationFrame(this._frame);
        this.svg?.remove();
        this.svg = null;
    }
}
