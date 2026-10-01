/**
 * ============================================================================
 * ファイル名: ui/focus-lines-overlay.js
 * 責務: 集中線の仕上がりをキャンバス上へSVGで半透明に重ね、中心と内側楕円の編集ハンドルを出す
 * 依存: coordinate-system.js, system/event-bus.js, system/focus-lines.js
 * 被依存: ui/focus-lines-popup.js
 * 公開API: FocusLinesOverlay
 * イベント受信: camera:transform-changed, canvas:resized
 * 設計: svg本体はpointer-events:none。ハンドル(中心/rx/ry)だけがeventを受け、描画入力を奪わない。
 *   表示専用で、保存・Historyには関与しない。
 * 実装状態: ✅実装
 * ============================================================================
 */

import { coordinateSystem } from '../coordinate-system.js';
import { TegakiEventBus } from '../system/event-bus.js';
import { focusLinesHandles } from '../system/focus-lines.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function el(name, attrs = {}) {
    const node = document.createElementNS(SVG_NS, name);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    return node;
}

export class FocusLinesOverlay {
    /** @param {{ onPointerDown: (target: {type:'center'|'rx'|'ry'}, event: PointerEvent) => void, getState: () => object|null }} options */
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
        const svg = el('svg', { class: 'focus-lines-overlay', 'aria-hidden': 'true' });
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

    clientToCanvas(clientX, clientY) {
        const world = this.coordSystem.screenClientToWorld(clientX, clientY);
        if (!world || !Number.isFinite(world.worldX) || !Number.isFinite(world.worldY)) return null;
        return { x: world.worldX, y: world.worldY };
    }

    _toScreen(p) {
        const s = this.coordSystem.worldToScreen(p.x, p.y);
        return Number.isFinite(s?.clientX) ? { x: s.clientX, y: s.clientY } : null;
    }

    render() {
        if (!this.svg || !this.visible) return;
        const state = this.getState?.();
        this.svg.replaceChildren();
        if (!state?.params) return;
        const { params, polygons, showLines } = state;

        if (showLines && polygons?.length) {
            let d = '';
            for (const poly of polygons) {
                const pts = poly.map(p => this._toScreen(p));
                if (pts.some(p => !p)) continue;
                d += `M${pts.map(p => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('L')}Z`;
            }
            this.svg.appendChild(el('path', { d, class: 'fl-ov-lines' }));
        }

        const handles = focusLinesHandles(params);
        const c = this._toScreen(handles.center);
        const rx = this._toScreen(handles.rx);
        const ry = this._toScreen(handles.ry);
        if (!c || !rx || !ry) return;

        // 内側の抜け(楕円)。軸は画面と平行とは限らない(回転/反転)ので、2軸の端点から描く。
        const ex = rx.x - c.x;
        const ey = rx.y - c.y;
        const fx = ry.x - c.x;
        const fy = ry.y - c.y;
        const steps = 48;
        let ellipse = '';
        for (let i = 0; i <= steps; i += 1) {
            const t = (i / steps) * Math.PI * 2;
            ellipse += `${i === 0 ? 'M' : 'L'}${(c.x + ex * Math.cos(t) + fx * Math.sin(t)).toFixed(1)} ${(c.y + ey * Math.cos(t) + fy * Math.sin(t)).toFixed(1)}`;
        }
        this.svg.appendChild(el('path', { d: `${ellipse}Z`, class: 'fl-ov-hole' }));

        const addHandle = (point, type, cls) => {
            const handle = el('circle', { cx: point.x, cy: point.y, r: type === 'center' ? 8 : 6, class: `fl-ov-handle ${cls}`, 'data-kind': type });
            handle.addEventListener('pointerdown', (e) => {
                if (e.pointerType === 'mouse' && e.button !== 0) return;
                e.preventDefault();
                e.stopPropagation();
                this.onPointerDown?.({ type }, e);
            });
            this.svg.appendChild(handle);
        };
        addHandle(rx, 'rx', 'is-axis');
        addHandle(ry, 'ry', 'is-axis');
        addHandle(c, 'center', 'is-center');
    }

    destroy() {
        this._subscriptions.forEach(off => off());
        this._subscriptions = [];
        if (this._frame !== null) cancelAnimationFrame(this._frame);
        this.svg?.remove();
        this.svg = null;
    }
}
