/**
 * ============================================================================
 * ファイル名: ui/balloon-overlay.js
 * 責務: 本体・複数しっぽ・独立本文領域のSVG投影、輪郭点/二連/移動/拡縮ハンドルと局所grid
 * 依存: coordinate-system.js, system/event-bus.js, balloon-geometry.js, balloon-text-layout.js
 * 被依存: ui/balloon-popup.js
 * 公開API: BalloonOverlay
 * イベント受信: camera:transform-changed, canvas:resized
 * 設計: svg本体はpointer-events:none。ハンドルとCtrl中だけの本体hitがeventを受け、Space/global Vへ譲る。
 *   通常の内側は描画へ透過。表示専用で保存・Historyには関与しない。
 *   文字画像は3点(原点/+x/+y)の画面座標から行列を作って貼るので、キャンバスの回転・反転でも正しく見える。
 * 実装状態: ✅実装
 * ============================================================================
 */

import { coordinateSystem } from '../coordinate-system.js';
import { TegakiEventBus } from '../system/event-bus.js';
import { balloonHandles, buildBalloonParts } from '../system/balloon-geometry.js';
import { balloonTextFrameHandles } from '../system/balloon-text-layout.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function el(name, attrs = {}) {
    const node = document.createElementNS(SVG_NS, name);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    return node;
}

export class BalloonOverlay {
    /**
     * @param {{ onPointerDown: (target:{type:string}, event:PointerEvent)=>void,
     *   getState: ()=>({params:object, canvas:object, editor?:object, textImage:object|Array<object|null>|null})|null }} options
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
        const svg = el('svg', { class: 'balloon-overlay', 'aria-hidden': 'true' });
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
        const { params, canvas, editor } = state;
        const { body, tails } = buildBalloonParts(params, canvas);
        const previewParts = state.draftActive === false ? [] : [body, ...tails];

        // 本体+しっぽ(本体の縁を2×線幅 → 塗り の順は、popupのプレビュー/確定と同じ見え方になるよう半透明で重ねる)
        const lineWidthScreen = Math.max(1, params.lineWidth * this._scale());
        for (const poly of previewParts) {
            const pts = poly.map(p => this._toScreen(p));
            if (pts.some(p => !p)) continue;
            const d = `M${pts.map(p => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('L')}Z`;
            this.svg.appendChild(el('path', { d, class: 'bl-ov-line', style: `stroke:${params.lineColor}`, 'stroke-width': lineWidthScreen * 2 }));
        }
        for (const poly of previewParts) {
            const pts = poly.map(p => this._toScreen(p));
            if (pts.some(p => !p)) continue;
            this.svg.appendChild(el('path', { d: `M${pts.map(p => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('L')}Z`, class: 'bl-ov-fill', style: `fill:${params.fillColor}` }));
        }

        if (editor?.grid && editor.context === 'body') {
            const r = params.rect, step = Math.max(4, Number(editor.gridSize) || 16);
            // Integer multiples retain the same snap origin while bounding SVG work.
            const spacing = step * Math.max(1, Math.ceil(Math.max(r.w, r.h) / (step * 80)));
            let d = '';
            const segment = (a, b) => {
                a = this._toScreen(a); b = this._toScreen(b);
                if (a && b) d += `M${a.x} ${a.y}L${b.x} ${b.y}`;
            };
            for (let x = Math.ceil(r.x / spacing) * spacing; x <= r.x + r.w; x += spacing) segment({ x, y: r.y }, { x, y: r.y + r.h });
            for (let y = Math.ceil(r.y / spacing) * spacing; y <= r.y + r.h; y += spacing) segment({ x: r.x, y }, { x: r.x + r.w, y });
            this.svg.appendChild(el('path', { d, class: 'bl-ov-grid' }));
        }
        for (const textImage of (state.draftActive === false ? [] : Array.isArray(state.textImage) ? state.textImage : [state.textImage])) {
            if (!textImage?.url) continue;
            const o = this._toScreen({ x: textImage.x, y: textImage.y });
            const ex = this._toScreen({ x: textImage.x + 1, y: textImage.y });
            const ey = this._toScreen({ x: textImage.x, y: textImage.y + 1 });
            if (o && ex && ey) {
                const image = el('image', {
                    href: textImage.url,
                    width: textImage.width,
                    height: textImage.height,
                    transform: `matrix(${ex.x - o.x} ${ex.y - o.y} ${ey.x - o.x} ${ey.y - o.y} ${o.x} ${o.y})`,
                    class: 'bl-ov-text'
                });
                this.svg.appendChild(image);
            }
        }
        // Only Ctrl turns the body interior into a whole-object move surface.
        const bodyPoints = body.map(point => this._toScreen(point));
        if (bodyPoints.every(Boolean)) {
            const hit = el('polygon', { points: bodyPoints.map(p => `${p.x},${p.y}`).join(' '), class: 'bl-ov-body-hit', 'data-kind': 'body-move' });
            hit.addEventListener('pointerdown', event => this._down('body-move', event));
            this.svg.appendChild(hit);
        }
        const handles = balloonHandles(params, canvas);
        const add = (type, point, cls) => {
            const s = this._toScreen(point);
            if (!s) return;
            const handle = el('circle', { cx: s.x, cy: s.y, r: type === 'center' ? 8 : 6, class: `bl-ov-handle ${cls}`, 'data-kind': type });
            handle.addEventListener('pointerdown', event => this._down(type, event));
            this.svg.appendChild(handle);
        };
        if (editor?.context === 'text') {
            for (const [index, frame] of balloonTextFrameHandles(params, canvas).entries()) {
                const corners = Object.values(frame.corners).map(p => this._toScreen(p));
                if (corners.some(p => !p)) continue;
                const selected = index === (editor.textIndex || 0);
                const outline = el('path', { d: `M${corners.map(p => `${p.x} ${p.y}`).join('L')}Z`, class: `bl-ov-text-frame${selected ? ' is-selected' : ''}`, 'data-text-frame': index });
                this.svg.appendChild(outline);
                for (const [part, point] of Object.entries(frame.corners)) add(`text:${index}:${part}`, point, `is-text${selected ? ' is-selected' : ''}`);
                add(`text:${index}:center`, frame.center, `is-text${selected ? ' is-selected' : ''}`);
                const label = this._toScreen(frame.corners.tl);
                const badge = el('text', { x: label.x + 9, y: label.y - 6, class: 'bl-ov-text-label' });
                badge.textContent = index + 1; this.svg.appendChild(badge);
            }
        } else for (const key of ['tl', 'tr', 'br', 'bl']) add(key, handles.corners[key], 'is-corner');
        if (editor?.context === 'body') {
            (handles.contour || []).forEach((point, index) => add(`point:${index}`, point, `is-contour${editor.selectedPoint === index ? ' is-selected' : ''}`));
            if (handles.secondary) {
                for (const [key, point] of Object.entries(handles.secondary.corners)) add(`secondary:${key}`, point, 'is-secondary');
                add('secondary:center', handles.secondary.center, 'is-secondary');
            }
        }
        if (editor?.context !== 'text') {
            [handles.tip,...(handles.extraTips || [])].forEach((point,index)=>{
                if(!point)return;
                add(index?`tip:${index}`:'tip',point,`is-tip${editor?.context==='tail'&&index===(editor.tailIndex||0)?' is-selected':''}`);
                if(editor?.context==='tail'){const s=this._toScreen(point),label=el('text',{x:s.x+9,y:s.y-6,class:'bl-ov-text-label'});label.textContent=index+1;this.svg.appendChild(label);}
            });
            add('center', handles.center, 'is-center');
        }
    }

    _down(type, event) {
        if (this.svg.classList.contains('is-camera') || this.svg.classList.contains('is-transform')) return;
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        event.preventDefault(); event.stopPropagation();
        this.onPointerDown?.({ type }, event);
    }

    /** 文書1pxあたりの画面px(線幅の見た目用)。 */
    _scale() {
        const a = this._toScreen({ x: 0, y: 0 });
        const b = this._toScreen({ x: 100, y: 0 });
        return a && b ? Math.hypot(b.x - a.x, b.y - a.y) / 100 : 1;
    }

    destroy() {
        this._subscriptions.forEach(off => off());
        this._subscriptions = [];
        if (this._frame !== null) cancelAnimationFrame(this._frame);
        this.svg?.remove();
        this.svg = null;
    }
}
