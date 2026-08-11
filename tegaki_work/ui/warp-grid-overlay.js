import { createRectGridTopology } from '../system/animation/warp-grid-topology.js';

/** Rectangular Warp Grid のdisplay-only DOM overlay。Raster正本へは書き込まない。 */
export class WarpGridOverlay {
    constructor() {
        this.element = null;
        this.options = null;
        this._frame = null;
        this._lines = [];
        this._points = [];
        this._secondaryLines = [];
        this._secondaryPoints = [];
        this._brushWeightField = null;
        this._brushCursor = null;
        this._brushCenter = null;
        this._selectionMarquee = null;
        this._topology = null;
        this._frameHandles = [];
        this._edgeHandles = [];
        this._rotationHandle = null;
        this._rotationStem = null;
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
        this._secondaryLines = [];
        this._secondaryPoints = [];
        this._brushWeightField = null;
        this._brushCursor = null;
        this._brushCenter = null;
        this._selectionMarquee = null;
        this._topology = null;
        this._frameHandles = [];
        this._edgeHandles = [];
        this._rotationHandle = null;
        this._rotationStem = null;
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
        this.element.classList.toggle('is-bind-editing', this.options?.mode === 'bind');
        this.element.classList.toggle('is-lens-editing', this.options?.mode === 'lens');
        this.element.setAttribute('aria-hidden', 'true');
        this.element.hidden = true;
        document.body.appendChild(this.element);

        const defs = document.createElementNS(svgNamespace, 'defs');
        const gradient = document.createElementNS(svgNamespace, 'radialGradient');
        gradient.id = 'tegaki-warp-brush-weight-gradient';
        [
            ['0%', '0.28'],
            ['58%', '0.16'],
            ['84%', '0.07'],
            ['100%', '0']
        ].forEach(([offset, opacity]) => {
            const stop = document.createElementNS(svgNamespace, 'stop');
            stop.setAttribute('offset', offset);
            stop.setAttribute('stop-color', 'var(--futaba-maroon)');
            stop.setAttribute('stop-opacity', opacity);
            gradient.appendChild(stop);
        });
        defs.appendChild(gradient);
        this.element.appendChild(defs);

        const weightField = document.createElementNS(svgNamespace, 'circle');
        weightField.classList.add('warp-grid-overlay-brush-weight');
        weightField.setAttribute('fill', 'url(#tegaki-warp-brush-weight-gradient)');
        weightField.hidden = true;
        this.element.appendChild(weightField);
        this._brushWeightField = weightField;

        const selectionMarquee = document.createElementNS(svgNamespace, 'path');
        selectionMarquee.classList.add('warp-grid-overlay-selection-marquee');
        selectionMarquee.setAttribute('hidden', '');
        this.element.appendChild(selectionMarquee);
        this._selectionMarquee = selectionMarquee;

        if (typeof this.options?.getSecondaryWorldPoints === 'function') {
            this._topology.edges.forEach(([from, to]) => {
                const line = document.createElementNS(svgNamespace, 'line');
                line.classList.add('warp-grid-overlay-secondary-line');
                this.element.appendChild(line);
                this._secondaryLines.push({ element: line, from, to });
            });
            const secondaryPointRadius = this._topology.pointCount > 144
                ? 2
                : (this._topology.pointCount > 64 ? 2.5 : 3.25);
            for (let index = 0; index < this._topology.pointCount; index++) {
                const point = document.createElementNS(svgNamespace, 'circle');
                point.classList.add('warp-grid-overlay-secondary-point');
                point.setAttribute('r', String(secondaryPointRadius));
                this.element.appendChild(point);
                this._secondaryPoints.push(point);
            }
        }

        this._topology.edges.forEach(([from, to]) => {
            const line = document.createElementNS(svgNamespace, 'line');
            line.classList.add('warp-grid-overlay-line');
            this.element.appendChild(line);
            this._lines.push({ element: line, from, to });
        });
        const pointRadius = this._topology.pointCount > 144
            ? 2.5
            : (this._topology.pointCount > 64 ? 3.25 : 4);
        for (let index = 0; index < this._topology.pointCount; index++) {
            const point = document.createElementNS(svgNamespace, 'circle');
            point.classList.add('warp-grid-overlay-point');
            point.setAttribute('r', String(pointRadius));
            this.element.appendChild(point);
            this._points.push(point);
        }
        if (['bind', 'lens'].includes(this.options?.mode)
            && Number.isInteger(this.options.columns)
            && Number.isInteger(this.options.rows)) {
            const rotationStem = document.createElementNS(svgNamespace, 'line');
            rotationStem.classList.add('warp-grid-overlay-rotation-stem');
            this.element.appendChild(rotationStem);
            this._rotationStem = rotationStem;
            for (let index = 0; index < 4; index++) {
                const handle = document.createElementNS(svgNamespace, 'circle');
                handle.classList.add('warp-grid-overlay-frame-handle');
                handle.setAttribute('r', '7');
                this.element.appendChild(handle);
                this._frameHandles.push(handle);

                const edgeHandle = document.createElementNS(svgNamespace, 'circle');
                edgeHandle.classList.add('warp-grid-overlay-edge-handle');
                edgeHandle.setAttribute('r', '6');
                this.element.appendChild(edgeHandle);
                this._edgeHandles.push(edgeHandle);
            }
            const rotationHandle = document.createElementNS(svgNamespace, 'circle');
            rotationHandle.classList.add('warp-grid-overlay-rotation-handle');
            rotationHandle.setAttribute('r', '7');
            this.element.appendChild(rotationHandle);
            this._rotationHandle = rotationHandle;
        }
        const brushCursor = document.createElementNS(svgNamespace, 'circle');
        brushCursor.classList.add('warp-grid-overlay-brush');
        brushCursor.setAttribute('fill', 'none');
        brushCursor.hidden = true;
        this.element.appendChild(brushCursor);
        this._brushCursor = brushCursor;

        const brushCenter = document.createElementNS(svgNamespace, 'circle');
        brushCenter.classList.add('warp-grid-overlay-brush-center');
        brushCenter.setAttribute('r', '3');
        brushCenter.hidden = true;
        this.element.appendChild(brushCenter);
        this._brushCenter = brushCenter;
    }

    _update() {
        if (!this.options || !this.element) return;
        if (typeof this.options.shouldDisplay === 'function' && !this.options.shouldDisplay()) {
            this.deactivate();
            return;
        }
        const toScreenPoints = worldPoints => (worldPoints || []).map(point => {
            const coordinateSystem = this.options.coordinateSystem;
            const screen = coordinateSystem.worldToScreenImmediate?.(point.x, point.y)
                || coordinateSystem.worldToScreen(point.x, point.y);
            return { x: screen.clientX, y: screen.clientY };
        });
        const screenPoints = toScreenPoints(this.options.getWorldPoints());
        const secondaryScreenPoints = typeof this.options.getSecondaryWorldPoints === 'function'
            ? toScreenPoints(this.options.getSecondaryWorldPoints())
            : [];
        this._secondaryLines.forEach(line => {
            const from = secondaryScreenPoints[line.from];
            const to = secondaryScreenPoints[line.to];
            line.element.hidden = !from || !to;
            if (!from || !to) return;
            line.element.setAttribute('x1', String(from.x));
            line.element.setAttribute('y1', String(from.y));
            line.element.setAttribute('x2', String(to.x));
            line.element.setAttribute('y2', String(to.y));
        });
        this._secondaryPoints.forEach((point, index) => {
            const screen = secondaryScreenPoints[index];
            point.hidden = !screen;
            if (!screen) return;
            point.setAttribute('cx', String(screen.x));
            point.setAttribute('cy', String(screen.y));
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
        const selectedIndices = this.options.getSelectedPointIndices?.() || [];
        const selectedSet = new Set(selectedIndices);
        this._points.forEach((point, index) => {
            const screen = screenPoints[index];
            point.hidden = !screen;
            if (!screen) return;
            point.setAttribute('cx', String(screen.x));
            point.setAttribute('cy', String(screen.y));
            point.classList.toggle('is-selected', selectedSet.has(index));
        });
        if (this._selectionMarquee) {
            const marquee = this.options.getSelectionMarquee?.();
            let path = '';
            if (marquee?.type === 'circle'
                && Number.isFinite(marquee.cx)
                && Number.isFinite(marquee.cy)
                && Number.isFinite(marquee.radius)) {
                const left = marquee.cx - marquee.radius;
                const right = marquee.cx + marquee.radius;
                path = `M ${left} ${marquee.cy} A ${marquee.radius} ${marquee.radius} 0 1 0 ${right} ${marquee.cy} A ${marquee.radius} ${marquee.radius} 0 1 0 ${left} ${marquee.cy}`;
            } else if (marquee?.type === 'polyline' && Array.isArray(marquee.points)) {
                const points = marquee.points.filter(point => Number.isFinite(point?.x) && Number.isFinite(point?.y));
                if (points.length >= 2) {
                    path = `M ${points.map(point => `${point.x} ${point.y}`).join(' L ')} Z`;
                }
            } else if (marquee
                && Number.isFinite(marquee.x)
                && Number.isFinite(marquee.y)
                && Number.isFinite(marquee.width)
                && Number.isFinite(marquee.height)) {
                const right = marquee.x + marquee.width;
                const bottom = marquee.y + marquee.height;
                path = `M ${marquee.x} ${marquee.y} H ${right} V ${bottom} H ${marquee.x} Z`;
            }
            const visible = path.length > 0;
            this._selectionMarquee.toggleAttribute('hidden', !visible);
            if (visible) this._selectionMarquee.setAttribute('d', path);
        }
        if (this._frameHandles.length === 4
            && this._edgeHandles.length === 4
            && this._rotationHandle
            && this._rotationStem) {
            const columns = this.options.columns;
            const rows = this.options.rows;
            const corners = [
                screenPoints[0],
                screenPoints[columns - 1],
                screenPoints[rows * columns - 1],
                screenPoints[(rows - 1) * columns]
            ];
            const valid = corners.every(Boolean);
            const handleMode = this.options.getFrameHandleMode?.() || 'frame';
            const showCorners = valid && ['frame', 'corner'].includes(handleMode);
            const showEdges = valid && handleMode === 'edge';
            const showRotation = valid && handleMode === 'frame';
            this._frameHandles.forEach((handle, index) => {
                handle.toggleAttribute('hidden', !showCorners);
                if (!showCorners) return;
                handle.setAttribute('cx', String(corners[index].x));
                handle.setAttribute('cy', String(corners[index].y));
            });
            this._edgeHandles.forEach((handle, index) => {
                const from = corners[index];
                const to = corners[(index + 1) % corners.length];
                handle.toggleAttribute('hidden', !showEdges);
                if (!showEdges) return;
                handle.setAttribute('cx', String((from.x + to.x) / 2));
                handle.setAttribute('cy', String((from.y + to.y) / 2));
            });
            this._rotationHandle.toggleAttribute('hidden', !showRotation);
            this._rotationStem.toggleAttribute('hidden', !showRotation);
            if (valid) {
                const topMid = {
                    x: (corners[0].x + corners[1].x) / 2,
                    y: (corners[0].y + corners[1].y) / 2
                };
                const center = {
                    x: corners.reduce((sum, point) => sum + point.x, 0) / 4,
                    y: corners.reduce((sum, point) => sum + point.y, 0) / 4
                };
                const length = Math.hypot(topMid.x - center.x, topMid.y - center.y) || 1;
                const rotation = {
                    x: topMid.x + (topMid.x - center.x) / length * 34,
                    y: topMid.y + (topMid.y - center.y) / length * 34
                };
                this._rotationStem.setAttribute('x1', String(topMid.x));
                this._rotationStem.setAttribute('y1', String(topMid.y));
                this._rotationStem.setAttribute('x2', String(rotation.x));
                this._rotationStem.setAttribute('y2', String(rotation.y));
                this._rotationHandle.setAttribute('cx', String(rotation.x));
                this._rotationHandle.setAttribute('cy', String(rotation.y));
            }
        }
        if (this._brushCursor && this._brushCenter && this._brushWeightField) {
            const preview = this.options.getBrushPreview?.();
            const visible = !!preview?.visible
                && Number.isFinite(preview.x)
                && Number.isFinite(preview.y)
                && Number.isFinite(preview.radius)
                && preview.radius > 0;
            this._brushCursor.hidden = !visible;
            this._brushCenter.hidden = !visible;
            this._brushWeightField.hidden = !visible;
            if (visible) {
                this._brushCursor.setAttribute('cx', String(preview.x));
                this._brushCursor.setAttribute('cy', String(preview.y));
                this._brushCursor.setAttribute('r', String(preview.radius));
                this._brushCenter.setAttribute('cx', String(preview.x));
                this._brushCenter.setAttribute('cy', String(preview.y));
                this._brushWeightField.setAttribute('cx', String(preview.x));
                this._brushWeightField.setAttribute('cy', String(preview.y));
                this._brushWeightField.setAttribute('r', String(preview.radius));
                this._brushWeightField.setAttribute(
                    'opacity',
                    String(0.55 + Math.max(0, Math.min(1, Number(preview.strength) || 0.5)) * 0.45)
                );
            }
            const weights = Array.isArray(preview?.weights) ? preview.weights : [];
            this._points.forEach((point, index) => {
                const weight = Math.max(0, Math.min(1, Number(weights[index]) || 0));
                const influenced = visible && weight > 0;
                point.classList.toggle('is-brush-influenced', influenced);
                if (influenced) {
                    point.setAttribute('fill-opacity', String(0.32 + weight * 0.58));
                } else {
                    point.removeAttribute('fill-opacity');
                }
            });
        }
        this._frame = requestAnimationFrame(() => this._update());
    }
}

if (typeof document !== 'undefined') {
    document.querySelectorAll('.warp-grid-overlay').forEach(element => element.remove());
}

export const warpGridOverlay = new WarpGridOverlay();
