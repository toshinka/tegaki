import { createRectGridTopology } from '../system/animation/warp-grid-topology.js';

/** Rectangular Warp Grid のdisplay-only DOM overlay。Raster正本へは書き込まない。 */
export class WarpGridOverlay {
    constructor() {
        this.element = null;
        this.options = null;
        this._frame = null;
        this._lines = [];
        this._points = [];
        this._topology = null;
    }

    activate(options = {}) {
        if (!options.coordinateSystem || typeof options.getWorldPoints !== 'function') return false;
        this.deactivate();
        this.options = options;
        this._topology = Array.isArray(options.edges) && Number.isInteger(options.pointCount)
            ? {
                edges: options.edges.map(edge => [...edge]),
                pointCount: options.pointCount
            }
            : createRectGridTopology({
                columns: options.columns ?? 4,
                rows: options.rows ?? 4
            });
        if (!this._topology) {
            this.options = null;
            return false;
        }
        this._ensureElement();
        this.element.hidden = false;
        this._update();
        return true;
    }

    deactivate() {
        if (this._frame !== null) cancelAnimationFrame(this._frame);
        this._frame = null;
        this.options = null;
        document.querySelectorAll('.warp-grid-overlay').forEach(element => element.remove());
        this.element = null;
        this._lines = [];
        this._points = [];
        this._topology = null;
    }

    isActive() {
        return !!this.options;
    }

    _ensureElement() {
        if (this.element?.isConnected) return;
        document.querySelectorAll('.warp-grid-overlay').forEach(element => element.remove());
        const svgNamespace = 'http://www.w3.org/2000/svg';
        this.element = document.createElementNS(svgNamespace, 'svg');
        this.element.classList.add('warp-grid-overlay');
        this.element.setAttribute('aria-hidden', 'true');
        this.element.hidden = true;
        document.body.appendChild(this.element);

        this._topology.edges.forEach(([from, to]) => {
            const line = document.createElementNS(svgNamespace, 'line');
            line.classList.add('warp-grid-overlay-line');
            this.element.appendChild(line);
            this._lines.push({ element: line, from, to });
        });
        for (let index = 0; index < this._topology.pointCount; index++) {
            const point = document.createElementNS(svgNamespace, 'circle');
            point.classList.add('warp-grid-overlay-point');
            point.setAttribute('r', '5');
            this.element.appendChild(point);
            this._points.push(point);
        }
    }

    _update() {
        if (!this.options || !this.element) return;
        if (typeof this.options.shouldDisplay === 'function' && !this.options.shouldDisplay()) {
            this.deactivate();
            return;
        }
        const worldPoints = this.options.getWorldPoints() || [];
        const screenPoints = worldPoints.map(point => {
            const coordinateSystem = this.options.coordinateSystem;
            const screen = coordinateSystem.worldToScreenImmediate?.(point.x, point.y)
                || coordinateSystem.worldToScreen(point.x, point.y);
            return { x: screen.clientX, y: screen.clientY };
        });
        this._lines.forEach(line => {
            const from = screenPoints[line.from];
            const to = screenPoints[line.to];
            line.element.hidden = !from || !to;
            if (!from || !to) return;
            line.element.setAttribute('x1', String(from.x));
            line.element.setAttribute('y1', String(from.y));
            line.element.setAttribute('x2', String(to.x));
            line.element.setAttribute('y2', String(to.y));
        });
        this._points.forEach((point, index) => {
            const screen = screenPoints[index];
            point.hidden = !screen;
            if (!screen) return;
            point.setAttribute('cx', String(screen.x));
            point.setAttribute('cy', String(screen.y));
        });
        this._frame = requestAnimationFrame(() => this._update());
    }
}

if (typeof document !== 'undefined') {
    document.querySelectorAll('.warp-grid-overlay').forEach(element => element.remove());
}

export const warpGridOverlay = new WarpGridOverlay();
