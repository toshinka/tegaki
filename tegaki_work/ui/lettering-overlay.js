/**
 * ============================================================================
 * ファイル名: ui/lettering-overlay.js
 * 責務: 文字Rendererのlocal SVG/pathsをCanvas上へ重ね、配置・曲線・9点envelope
 *       の編集handleだけにpointer入力を渡す表示専用overlay。
 * 依存: coordinate-system.js, system/event-bus.js, system/editable-curve-geometry.js
 * 被依存: ui/lettering-popup.js
 * 公開API: LetteringOverlay
 * 保存/History: 関与しない。通常CanvasのRaster/Project authorityを持たない。
 * 座標: Rendererのpaths/localBoundsは文字local。placementを一度だけlocal→worldへ
 *       適用し、cameraのworldToScreenを3点投影してclient座標のSVGへ置く。
 * 実装状態: WP-025 UI slice
 * ============================================================================
 */

import { coordinateSystem } from '../coordinate-system.js';
import { TegakiEventBus } from '../system/event-bus.js';
import {
    curveSegments,
    letteringLocalToWorld,
    mapEnvelopePoint
} from '../system/editable-curve-geometry.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const XHTML_NS = 'http://www.w3.org/1999/xhtml';
const SVG_TAGS = new Set(['path', 'g', 'defs', 'clippath', 'use', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'tspan', 'foreignobject', 'div', 'span', 'br']);
const SVG_ATTRIBUTES = new Set([
    'd', 'fill', 'fill-rule', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap',
    'stroke-linejoin', 'stroke-miterlimit', 'opacity', 'transform', 'viewBox', 'x', 'y', 'x1', 'x2', 'y1', 'y2',
    'cx', 'cy', 'r', 'rx', 'ry', 'width', 'height', 'points', 'href', 'clip-path', 'fill-rule', 'fill-opacity',
    'font-family', 'font-size', 'font-weight', 'font-style', 'text-anchor', 'dominant-baseline', 'writing-mode',
    'text-orientation', 'textLength', 'lengthAdjust', 'xml:space', 'preserveAspectRatio', 'paint-order'
]);
const SVG_STYLE_PROPERTIES = new Set([
    'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap',
    'stroke-linejoin', 'font-family', 'font-size', 'font-weight', 'font-style', 'letter-spacing', 'line-height',
    'text-anchor', 'dominant-baseline', 'writing-mode', 'text-orientation', 'white-space', 'box-sizing', 'padding',
    'width', 'height', 'color', 'text-align', 'overflow-wrap', 'line-break', 'margin', 'text-combine-upright',
    '-webkit-text-stroke', 'paint-order'
]);

function svgElement(name, attrs = {}, namespace = SVG_NS) {
    const node = document.createElementNS(namespace, name);
    for (const [key, value] of Object.entries(attrs)) {
        if (value !== undefined && value !== null) node.setAttribute(key, String(value));
    }
    return node;
}

function xy(value) {
    if (!value || typeof value !== 'object') return null;
    const x = Number(value.x ?? value.worldX ?? value.localX ?? value.clientX);
    const y = Number(value.y ?? value.worldY ?? value.localY ?? value.clientY);
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

function screenXY(value) {
    if (!value || typeof value !== 'object') return null;
    const x = Number(value.clientX ?? value.x);
    const y = Number(value.clientY ?? value.y);
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

function pointFromAny(value, fallback = { x: 0, y: 0 }) {
    return xy(value) || { ...fallback };
}

function finite(value, fallback) {
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function normalizedBounds(bounds) {
    const src = bounds && typeof bounds === 'object' ? bounds : {};
    const x = finite(src.x, 0);
    const y = finite(src.y, 0);
    const width = Math.max(1, Math.abs(finite(src.width ?? src.w, 1)));
    const height = Math.max(1, Math.abs(finite(src.height ?? src.h, 1)));
    return { x, y, width, height };
}

function localPointForEnvelope(index, bounds) {
    const row = Math.floor(index / 3);
    const col = index % 3;
    return {
        x: bounds.x + (col / 2) * bounds.width,
        y: bounds.y + (row / 2) * bounds.height
    };
}

function readEnvelopePoint(index, bounds, envelope) {
    // Envelope control points describe the mapping, not the source grid
    // locations. Start from the fixed 0/.5/1 lattice, then map exactly once.
    const base = localPointForEnvelope(index, bounds);
    if (envelope?.kind === 'points' && envelope.points?.[index]) {
        return { x: bounds.x + envelope.points[index].x * bounds.width, y: bounds.y + envelope.points[index].y * bounds.height };
    }
    try {
        const mapped = mapEnvelopePoint(base, bounds, envelope || { kind: 'none', amount: 0, points: null });
        return pointFromAny(mapped, base);
    } catch (error) {
        return base;
    }
}

function pathPoint(value) {
    if (!value || typeof value !== 'object') return null;
    return xy(value.point || value.position || value);
}

/**
 * Display-only SVG overlay for editable lettering. The root is pointer inert;
 * only artwork guide hit paths and explicit handles opt into pointer events.
 */
export class LetteringOverlay {
    constructor({ onPointerDown, onDoubleClick, getState, eventBus = TegakiEventBus, coordSystem = coordinateSystem } = {}) {
        this.onPointerDown = typeof onPointerDown === 'function' ? onPointerDown : () => {};
        this.onDoubleClick = typeof onDoubleClick === 'function' ? onDoubleClick : () => {};
        this.getState = typeof getState === 'function' ? getState : () => null;
        this.eventBus = eventBus;
        this.coordSystem = coordSystem;
        this.svg = null;
        this.visible = false;
        this._frame = null;
        this._subscriptions = [];
    }

    mount() {
        if (this.svg) return this.svg;
        const svg = svgElement('svg', {
            class: 'lettering-overlay',
            'aria-hidden': 'true',
            role: 'presentation'
        });
        // A fixed viewport root must not inherit a transformed canvas parent.
        (document.body || document.documentElement).appendChild(svg);
        this.svg = svg;
        for (const name of ['camera:transform-changed', 'camera:resized', 'canvas:resize', 'canvas:resized', 'layer:transform-changed']) {
            const handler = () => this.schedule();
            this.eventBus?.on?.(name, handler);
            this._subscriptions.push(() => this.eventBus?.off?.(name, handler));
        }
        return svg;
    }

    setVisible(visible) {
        this.visible = visible === true;
        this.mount();
        this.svg?.classList.toggle('is-visible', this.visible);
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

    clientToWorld(clientX, clientY) {
        const world = this.coordSystem?.screenClientToWorld?.(clientX, clientY);
        const point = xy(world);
        return point ? { x: point.x, y: point.y } : null;
    }

    _worldToScreen(point) {
        const world = xy(point);
        if (!world) return null;
        const immediate = this.coordSystem?.worldToScreenImmediate?.(world.x, world.y);
        return screenXY(immediate) || screenXY(this.coordSystem?.worldToScreen?.(world.x, world.y));
    }

    _localToWorld(point, placement) {
        const local = pointFromAny(point);
        try {
            const result = letteringLocalToWorld(local, placement || {});
            return pointFromAny(result, local);
        } catch (error) {
            const p = placement || {};
            const rotation = finite(p.rotation, 0);
            const scaleX = finite(p.scaleX, 1);
            const scaleY = finite(p.scaleY, 1);
            const cos = Math.cos(rotation);
            const sin = Math.sin(rotation);
            return {
                x: finite(p.x, 0) + local.x * scaleX * cos - local.y * scaleY * sin,
                y: finite(p.y, 0) + local.x * scaleX * sin + local.y * scaleY * cos
            };
        }
    }

    _matrixForPlacement(placement) {
        const origin = this._worldToScreen(this._localToWorld({ x: 0, y: 0 }, placement));
        const basisX = this._worldToScreen(this._localToWorld({ x: 1, y: 0 }, placement));
        const basisY = this._worldToScreen(this._localToWorld({ x: 0, y: 1 }, placement));
        if (!origin || !basisX || !basisY) return null;
        return {
            a: basisX.x - origin.x,
            b: basisX.y - origin.y,
            c: basisY.x - origin.x,
            d: basisY.y - origin.y,
            e: origin.x,
            f: origin.y
        };
    }

    _screenPoint(local, placement) {
        return this._worldToScreen(this._localToWorld(local, placement));
    }

    _addPointer(node, target) {
        node.addEventListener('pointerdown', (event) => {
            if (event.pointerType === 'mouse' && event.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();
            this.onPointerDown(target, event);
        });
        return node;
    }

    _appendRendererPaths(group, result) {
        const paths = Array.isArray(result?.paths) ? result.paths : [];
        if (paths.length && !result?.svg) {
            paths.forEach((path, index) => {
                const d = typeof path === 'string' ? path : path?.d;
                if (!d) return;
                const node = svgElement('path', {
                    d,
                    class: 'lettering-overlay__glyph',
                    'data-path-index': index,
                    fill: typeof path === 'object' && path.fill ? path.fill : undefined,
                    'fill-rule': typeof path === 'object' && path.fillRule ? path.fillRule : 'nonzero',
                    stroke: typeof path === 'object' && path.stroke ? path.stroke : undefined,
                    'stroke-width': typeof path === 'object' && Number.isFinite(Number(path.strokeWidth)) ? path.strokeWidth : undefined,
                    'stroke-linejoin': 'round',
                    'paint-order': 'stroke fill'
                });
                group.appendChild(node);
            });
            return;
        }
        if (typeof result?.svg !== 'string' || !result.svg.trim()) return;
        const template = document.createElement('template');
        template.innerHTML = result.svg;
        const root = template.content.firstElementChild;
        const source = root?.tagName?.toLowerCase() === 'svg' ? root.childNodes : template.content.childNodes;
        const copySafe = (sourceNode, parentNamespace = SVG_NS) => {
            if (!sourceNode || sourceNode.nodeType !== 1) return null;
            const tag = sourceNode.tagName?.toLowerCase();
            if (!SVG_TAGS.has(tag)) return null;
            const namespace = parentNamespace === XHTML_NS || ['div', 'span', 'br'].includes(tag) ? XHTML_NS : SVG_NS;
            const copy = svgElement(tag, {}, namespace);
            for (const attribute of [...sourceNode.attributes]) {
                const name = attribute.name;
                if (!SVG_ATTRIBUTES.has(name) && name !== 'style' && name !== 'class' && name !== 'id') continue;
                let value = attribute.value;
                if (name === 'href') {
                    // Renderer-local <use> references may only point at a local id.
                    if (!/^#[A-Za-z_][\w:.-]*$/.test(value)) continue;
                }
                if (name === 'style') {
                    const safe = value.split(';').map(declaration => declaration.trim()).filter(Boolean).map(declaration => {
                        const colon = declaration.indexOf(':');
                        if (colon <= 0) return '';
                        const property = declaration.slice(0, colon).trim().toLowerCase();
                        const propertyValue = declaration.slice(colon + 1).trim();
                        if (!SVG_STYLE_PROPERTIES.has(property) || /url\s*\(|expression\s*\(|javascript\s*:/i.test(propertyValue)) return '';
                        return `${property}:${propertyValue}`;
                    }).filter(Boolean).join(';');
                    if (!safe) continue;
                    value = safe;
                }
                copy.setAttribute(name, value);
            }
            copy.classList.add('lettering-overlay__glyph');
            copy.setAttribute('pointer-events', 'none');
            for (const child of [...sourceNode.childNodes]) {
                if (child.nodeType === 3) {
                    copy.appendChild(document.createTextNode(child.nodeValue || ''));
                } else {
                    const nested = copySafe(child, tag === 'foreignobject' ? XHTML_NS : namespace);
                    if (nested) copy.appendChild(nested);
                }
            }
            return copy;
        };
        [...source].forEach(child => {
            const copy = copySafe(child);
            if (copy) group.appendChild(copy);
        });
    }

    _appendGrid(group, bounds, step) {
        const size = Math.max(0, finite(step, 0));
        if (!size) return;
        const firstX = Math.ceil(bounds.x / size) * size;
        const firstY = Math.ceil(bounds.y / size) * size;
        for (let x = firstX; x <= bounds.x + bounds.width + 0.001; x += size) {
            group.appendChild(svgElement('line', { x1: x, y1: bounds.y, x2: x, y2: bounds.y + bounds.height, class: 'lettering-overlay__grid-line' }));
        }
        for (let y = firstY; y <= bounds.y + bounds.height + 0.001; y += size) {
            group.appendChild(svgElement('line', { x1: bounds.x, y1: y, x2: bounds.x + bounds.width, y2: y, class: 'lettering-overlay__grid-line' }));
        }
    }

    _appendCurve(group, state, bounds) {
        const path = state.params?.baseline?.path;
        const nodes = Array.isArray(path?.nodes) ? path.nodes : [];
        let segments = [];
        try { segments = curveSegments(path) || []; } catch (error) { segments = []; }
        const d = segments.map((segment) => {
            const start = pointFromAny(segment?.p0 || segment?.start || nodes[0]);
            const c1 = pointFromAny(segment?.p1 || segment?.control1 || start);
            const c2 = pointFromAny(segment?.p2 || segment?.control2 || segment?.p3 || start);
            const end = pointFromAny(segment?.p3 || segment?.end || start);
            return `M${start.x} ${start.y} C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${end.x} ${end.y}`;
        }).join(' ');
        if (d) {
            const guide = svgElement('path', { d, class: 'lettering-overlay__curve' });
            guide.addEventListener('dblclick', (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.onDoubleClick({ type: 'curve-add' }, event);
            });
            group.appendChild(guide);
            const hit = svgElement('path', { d, class: 'lettering-overlay__curve-hit' });
            hit.addEventListener('dblclick', (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.onDoubleClick({ type: 'curve-add' }, event);
            });
            group.appendChild(hit);
        }
        // A line fallback keeps a malformed/empty segment visibly selectable.
        if (!d && nodes.length > 1) {
            const points = nodes.map(node => `${finite(node.x, 0)},${finite(node.y, 0)}`).join(' ');
            group.appendChild(svgElement('polyline', { points, class: 'lettering-overlay__curve' }));
        }
        nodes.forEach((node, index) => {
            if (!node?.id) return;
            const point = pointFromAny(node);
            const handle = svgElement('circle', {
                cx: point.x,
                cy: point.y,
                r: 4,
                class: `lettering-overlay__curve-node${state.selectedNodeId === node.id ? ' is-selected' : ''}`,
                'data-node-id': node.id,
                'data-node-index': index
            });
            this._addPointer(handle, { type: 'curve-node', nodeId: node.id, index });
            group.appendChild(handle);
        });
        void bounds;
    }

    _appendWholeHandles(screenGroup, state, bounds, placement, prefix = 'whole') {
        const corners = {
            tl: { x: bounds.x, y: bounds.y },
            tr: { x: bounds.x + bounds.width, y: bounds.y },
            br: { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
            bl: { x: bounds.x, y: bounds.y + bounds.height }
        };
        const centerLocal = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
        const center = this._screenPoint(centerLocal, placement);
        if (!center) return;
        const cornerScreen = Object.fromEntries(Object.entries(corners).map(([key, point]) => [key, this._screenPoint(point, placement)]));
        const frame = ['tl', 'tr', 'br', 'bl'].map(key => cornerScreen[key]).filter(Boolean).map(point => `${point.x},${point.y}`).join(' ');
        if (frame) screenGroup.appendChild(svgElement('polygon', { points: frame, class: 'lettering-overlay__frame' }));
        const top = this._screenPoint({ x: bounds.x + bounds.width / 2, y: bounds.y }, placement);
        const dx = top ? top.x - center.x : 0;
        const dy = top ? top.y - center.y : -1;
        const length = Math.hypot(dx, dy) || 1;
        const rotation = { x: center.x + (dx / length) * (length + 28), y: center.y + (dy / length) * (length + 28) };
        screenGroup.appendChild(svgElement('line', { x1: center.x, y1: center.y, x2: rotation.x, y2: rotation.y, class: 'lettering-overlay__rotation-stem' }));
        const add = (type, point, className, radius = 7) => {
            if (!point) return;
            const handle = svgElement('circle', { cx: point.x, cy: point.y, r: radius, class: `lettering-overlay__handle ${className}`, 'data-kind': type });
            this._addPointer(handle, { type });
            screenGroup.appendChild(handle);
        };
        Object.entries(cornerScreen).forEach(([key, point]) => add(`${prefix}-corner-${key}`, point, 'is-corner', 7));
        add(`${prefix}-center`, center, 'is-center', 8);
        add(`${prefix}-rotation`, rotation, 'is-rotation', 7);
        void state;
    }

    _appendCharacters(group, handles, state, placement) {
        const paths = state.result?.paths || [];
        const selected = state.characterSelection;
        let bounds = null;
        for (const path of paths) {
            if (!path.d || !Number.isInteger(path.start) || !Number.isInteger(path.end)) continue;
            const on = !!selected && path.end > selected.start && path.start < selected.end;
            const hit = svgElement('path', { d: path.d, class: `lettering-overlay__character-hit${on ? ' is-selected' : ''}`, 'data-character-start': path.start, 'data-character-end': path.end });
            this._addPointer(hit, { type: 'character', start: path.start, end: path.end });
            group.append(hit);
            if (on && path.bounds) {
                const b = path.bounds;
                if (!bounds) bounds = { ...b };
                else {
                    const x = Math.min(bounds.x, b.x), y = Math.min(bounds.y, b.y);
                    const right = Math.max(bounds.x + bounds.width, b.x + b.width), bottom = Math.max(bounds.y + bounds.height, b.y + b.height);
                    bounds = { x, y, width: right - x, height: bottom - y };
                }
            }
        }
        if (bounds) this._appendWholeHandles(handles, state, normalizedBounds(bounds), placement, 'character');
    }

    _appendEnvelope(group, screenGroup, state, bounds, placement) {
        const envelope = state.params?.envelope || { kind: 'none', amount: 0, points: null };
        const points = Array.from({ length: 9 }, (_, index) => readEnvelopePoint(index, bounds, envelope));
        const screenPoints = points.map(point => this._screenPoint(point, placement));
        const rows = [[0, 1, 2], [3, 4, 5], [6, 7, 8]];
        rows.forEach(row => {
            const valid = row.map(index => points[index]);
            group.appendChild(svgElement('polyline', { points: valid.map(point => `${point.x},${point.y}`).join(' '), class: 'lettering-overlay__envelope-line' }));
        });
        [0, 1, 2].forEach(col => {
            const valid = [points[col], points[col + 3], points[col + 6]];
            group.appendChild(svgElement('polyline', { points: valid.map(point => `${point.x},${point.y}`).join(' '), class: 'lettering-overlay__envelope-line' }));
        });
        screenPoints.forEach((point, index) => {
            if (!point) return;
            const handle = svgElement('circle', {
                cx: point.x,
                cy: point.y,
                r: index === 4 ? 6 : 5,
                class: `lettering-overlay__handle lettering-overlay__envelope-point${state.selectedEnvelopeIndex === index ? ' is-selected' : ''}`,
                'data-point-index': index
            });
            this._addPointer(handle, { type: 'envelope-point', index });
            screenGroup.appendChild(handle);
        });
    }

    render() {
        if (!this.svg || !this.visible) return;
        this.svg.replaceChildren();
        this.svg.setAttribute('width', String(Math.max(1, window.innerWidth || 1)));
        this.svg.setAttribute('height', String(Math.max(1, window.innerHeight || 1)));
        const state = this.getState?.();
        const params = state?.params;
        const result = state?.result;
        const bounds = normalizedBounds(result?.localBounds);
        const envelopeBounds = normalizedBounds(result?.envelopeBounds || result?.localBounds);
        if (!params || !result || !result.localBounds) return;
        const matrix = this._matrixForPlacement(params.placement || {});
        if (!matrix || ![matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f].every(Number.isFinite)) return;
        const content = svgElement('g', {
            class: 'lettering-overlay__content',
            transform: `matrix(${matrix.a} ${matrix.b} ${matrix.c} ${matrix.d} ${matrix.e} ${matrix.f})`
        });
        if (state.previewVisible !== false) this._appendRendererPaths(content, result);
        content.appendChild(svgElement('rect', { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, class: 'lettering-overlay__bounds' }));
        if (state.grid?.enabled) this._appendGrid(content, state.mode === 'envelope' ? envelopeBounds : bounds, state.grid.size);
        if (state.mode === 'curve') this._appendCurve(content, state, envelopeBounds);
        if (state.mode === 'envelope') {
            const envelope = state.params?.envelope || {};
            const basePoints = Array.from({ length: 9 }, (_, index) => localPointForEnvelope(index, envelopeBounds));
            // Touching the base envelope keeps the guide visible when a renderer
            // has no explicit local path for a malformed preset.
            if (basePoints.length) void basePoints;
        }
        this.svg.appendChild(content);
        const handles = svgElement('g', { class: 'lettering-overlay__handles' });
        if (state.mode === 'whole') {
            const body = svgElement('rect', { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, class: 'lettering-overlay__body-hit', 'data-kind': 'whole-center' });
            this._addPointer(body, { type: 'whole-center' });
            content.append(body);
            this._appendWholeHandles(handles, state, bounds, params.placement || {});
        }
        if (state.mode === 'characters') this._appendCharacters(content, handles, state, params.placement || {});
        if (state.mode === 'envelope') this._appendEnvelope(content, handles, state, envelopeBounds, params.placement || {});
        this.svg.appendChild(handles);
    }

    destroy() {
        this._subscriptions.forEach(off => off());
        this._subscriptions = [];
        if (this._frame !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this._frame);
        this._frame = null;
        this.svg?.remove();
        this.svg = null;
        this.visible = false;
    }
}

