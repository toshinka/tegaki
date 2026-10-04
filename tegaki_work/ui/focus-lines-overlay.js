/**
 * ============================================================================
 * ファイル名: ui/focus-lines-overlay.js
 * 責務: 集中線/閉輪郭の仕上がりをCanvas上へSVGで半透明に重ね、編集ハンドルを出す
 * 依存: coordinate-system.js, system/event-bus.js, system/focus-lines.js
 * 被依存: ui/focus-lines-popup.js
 * 公開API: FocusLinesOverlay
 * イベント受信: camera:transform-changed, canvas:resized
 * 保存/History: 関与しない。表示専用のruntime projection。
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

function pathForContour(points, toScreen) {
    if (!Array.isArray(points) || points.length < 3) return '';
    const screen = points.map(toScreen);
    if (screen.some(point => !point)) return '';
    return `M${screen.map(point => `${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join('L')}Z`;
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
        this._clipId = `focus-lines-clip-${Math.random().toString(36).slice(2, 8)}`;
    }

    mount() {
        if (this.svg) return;
        const svg = el('svg', { class: 'focus-lines-overlay', 'aria-hidden': 'true' });
        // Coordinates are client pixels; a transformed canvas parent would
        // offset a fixed SVG viewport a second time.
        (document.body || document.documentElement).appendChild(svg);
        this.svg = svg;
        for (const name of ['camera:transform-changed', 'camera:resized', 'canvas:resize', 'canvas:resized']) {
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
        const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (fn) => setTimeout(fn, 0);
        this._frame = raf(() => {
            this._frame = null;
            this.render();
        });
    }

    clientToCanvas(clientX, clientY) {
        const world = this.coordSystem.screenClientToWorld(clientX, clientY);
        if (!world || !Number.isFinite(world.worldX) || !Number.isFinite(world.worldY)) return null;
        return { x: world.worldX, y: world.worldY };
    }

    _toScreen(point) {
        const screen = this.coordSystem.worldToScreenImmediate?.(point.x, point.y)
            || this.coordSystem.worldToScreen(point.x, point.y);
        return Number.isFinite(screen?.clientX) && Number.isFinite(screen?.clientY)
            ? { x: screen.clientX, y: screen.clientY }
            : null;
    }

    _canvasClip(state) {
        const canvas = state?.canvas;
        if (!canvas) return null;
        const corners = [
            this._toScreen({ x: 0, y: 0 }),
            this._toScreen({ x: canvas.width, y: 0 }),
            this._toScreen({ x: canvas.width, y: canvas.height }),
            this._toScreen({ x: 0, y: canvas.height })
        ];
        if (corners.some(point => !point)) return null;
        return { d: `M${corners.map(point => `${point.x} ${point.y}`).join('L')}Z` };
    }

    _screenScale() {
        const origin = this._toScreen({ x: 0, y: 0 });
        const axis = this._toScreen({ x: 1, y: 0 });
        return origin && axis ? Math.hypot(axis.x - origin.x, axis.y - origin.y) : 1;
    }

    render() {
        if (!this.svg || !this.visible) return;
        const state = this.getState?.();
        this.svg.replaceChildren();
        if (!state?.params) return;

        const defs = el('defs');
        const clip = this._canvasClip(state);
        if (clip) {
            const clipPath = el('clipPath', { id: this._clipId });
            clipPath.appendChild(el('path', clip));
            defs.appendChild(clipPath);
            this.svg.appendChild(defs);
        }
        const drawRoot = el('g', clip ? { 'clip-path': `url(#${this._clipId})` } : {});
        const color = /^#[0-9a-f]{6}$/i.test(state.params.color || '') ? state.params.color : '#800000';

        if (state.body?.outer) {
            const outer = pathForContour(state.body.outer, point => this._toScreen(point));
            const inner = pathForContour(state.body.inner, point => this._toScreen(point));
            if (outer) {
                const attrs = {
                    d: outer + inner,
                    class: 'fl-ov-body',
                    fill: state.body.fillColor || 'none',
                    'fill-rule': 'evenodd',
                    'clip-rule': 'evenodd',
                    stroke: color,
                    'stroke-width': state.body.lineWidth * this._screenScale(),
                    'stroke-linejoin': 'round',
                    'stroke-linecap': 'round'
                };
                drawRoot.appendChild(el('path', attrs));
            }
        } else if (state.polygons?.length) {
            const d = state.polygons.map(poly => pathForContour(poly, point => this._toScreen(point))).filter(Boolean).join('');
            if (d) drawRoot.appendChild(el('path', { d, class: 'fl-ov-lines', fill: color, stroke: 'none' }));
        }
        this.svg.appendChild(drawRoot);

        const handles = focusLinesHandles(state.params);
        const c = this._toScreen(handles.center);
        const rx = this._toScreen(handles.rx);
        const ry = this._toScreen(handles.ry);
        if (!c || !rx || !ry) return;

        // The ray recipe retains its old dashed inner opening. Body modes use
        // the generated contour/hole as the visible geometry instead.
        if (!state.body) {
            const ex = rx.x - c.x, ey = rx.y - c.y;
            const fx = ry.x - c.x, fy = ry.y - c.y;
            const steps = 48;
            let ellipse = '';
            for (let i = 0; i <= steps; i += 1) {
                const t = (i / steps) * Math.PI * 2;
                ellipse += `${i === 0 ? 'M' : 'L'}${(c.x + ex * Math.cos(t) + fx * Math.sin(t)).toFixed(1)} ${(c.y + ey * Math.cos(t) + fy * Math.sin(t)).toFixed(1)}`;
            }
            this.svg.appendChild(el('path', { d: `${ellipse}Z`, class: 'fl-ov-hole' }));
        }

        const addHandle = (point, type, cls) => {
            const handle = el('circle', { cx: point.x, cy: point.y, r: type === 'center' ? 8 : 6, class: `fl-ov-handle ${cls}`, 'data-kind': type });
            handle.addEventListener('pointerdown', (event) => {
                if (event.pointerType === 'mouse' && event.button !== 0) return;
                event.preventDefault();
                event.stopPropagation();
                this.onPointerDown?.({ type }, event);
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
        if (this._frame !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this._frame);
        this.svg?.remove();
        this.svg = null;
    }
}
