/**
 * Folder Partのdisplay-only Canvas overlay。
 * 座標とposeは呼出側の共通sampler / coordinate systemから受け取り、
 * Rig、key、History、pointer gestureの正本は所有しない。
 */
export class PartTransformOverlay {
    constructor() {
        this.element = null;
        this.polygon = null;
        this.rotationStem = null;
        this.rotationHandle = null;
        this.centerHandle = null;
        this.cornerHandles = [];
        this.options = null;
        this.frameRequest = null;
    }

    activate(options = {}) {
        if (!options.coordinateSystem || typeof options.getWorldCorners !== 'function') return false;
        this.options = options;
        this._ensureElement();
        this.element.hidden = false;
        if (this.frameRequest === null) this._update();
        return true;
    }

    deactivate() {
        if (this.frameRequest !== null) cancelAnimationFrame(this.frameRequest);
        this.frameRequest = null;
        this.options = null;
        this.element?.remove();
        this.element = null;
        this.polygon = null;
        this.rotationStem = null;
        this.rotationHandle = null;
        this.centerHandle = null;
        this.cornerHandles = [];
    }

    isActive() {
        return !!this.options;
    }

    getScreenGeometry() {
        const worldCorners = this.options?.getWorldCorners?.() || [];
        if (worldCorners.length !== 4) return null;
        const coordinateSystem = this.options.coordinateSystem;
        const corners = worldCorners.map(point => {
            const screen = coordinateSystem.worldToScreenImmediate?.(point.x, point.y)
                || coordinateSystem.worldToScreen?.(point.x, point.y);
            return screen && Number.isFinite(screen.clientX) && Number.isFinite(screen.clientY)
                ? { x: screen.clientX, y: screen.clientY }
                : null;
        });
        if (corners.some(point => !point)) return null;
        const center = {
            x: corners.reduce((sum, point) => sum + point.x, 0) / 4,
            y: corners.reduce((sum, point) => sum + point.y, 0) / 4
        };
        const topMid = {
            x: (corners[0].x + corners[1].x) / 2,
            y: (corners[0].y + corners[1].y) / 2
        };
        const distance = Math.hypot(topMid.x - center.x, topMid.y - center.y) || 1;
        const rotationHandle = {
            x: topMid.x + (topMid.x - center.x) / distance * 30,
            y: topMid.y + (topMid.y - center.y) / distance * 30
        };
        return { corners, center, topMid, rotationHandle };
    }

    _ensureElement() {
        if (this.element?.isConnected) return;
        document.querySelectorAll('.part-transform-overlay').forEach(element => element.remove());
        const namespace = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(namespace, 'svg');
        svg.classList.add('part-transform-overlay');
        svg.setAttribute('aria-hidden', 'true');

        const polygon = document.createElementNS(namespace, 'polygon');
        polygon.classList.add('part-transform-overlay__frame');
        svg.appendChild(polygon);
        this.polygon = polygon;

        const rotationStem = document.createElementNS(namespace, 'line');
        rotationStem.classList.add('part-transform-overlay__rotation-stem');
        svg.appendChild(rotationStem);
        this.rotationStem = rotationStem;

        for (let index = 0; index < 4; index++) {
            const handle = document.createElementNS(namespace, 'circle');
            handle.classList.add('part-transform-overlay__corner');
            handle.setAttribute('r', '7');
            svg.appendChild(handle);
            this.cornerHandles.push(handle);
        }

        const rotationHandle = document.createElementNS(namespace, 'circle');
        rotationHandle.classList.add('part-transform-overlay__rotation');
        rotationHandle.setAttribute('r', '7');
        svg.appendChild(rotationHandle);
        this.rotationHandle = rotationHandle;

        const centerHandle = document.createElementNS(namespace, 'circle');
        centerHandle.classList.add('part-transform-overlay__center');
        centerHandle.setAttribute('r', '3');
        svg.appendChild(centerHandle);
        this.centerHandle = centerHandle;

        document.body.appendChild(svg);
        this.element = svg;
    }

    _update() {
        if (!this.options || !this.element) return;
        if (this.options.shouldDisplay?.() === false) {
            this.deactivate();
            return;
        }
        const geometry = this.getScreenGeometry();
        this.element.hidden = !geometry;
        if (geometry) {
            this.polygon.setAttribute('points', geometry.corners.map(point => `${point.x},${point.y}`).join(' '));
            this.cornerHandles.forEach((handle, index) => {
                handle.setAttribute('cx', String(geometry.corners[index].x));
                handle.setAttribute('cy', String(geometry.corners[index].y));
            });
            this.rotationStem.setAttribute('x1', String(geometry.topMid.x));
            this.rotationStem.setAttribute('y1', String(geometry.topMid.y));
            this.rotationStem.setAttribute('x2', String(geometry.rotationHandle.x));
            this.rotationStem.setAttribute('y2', String(geometry.rotationHandle.y));
            this.rotationHandle.setAttribute('cx', String(geometry.rotationHandle.x));
            this.rotationHandle.setAttribute('cy', String(geometry.rotationHandle.y));
            this.centerHandle.setAttribute('cx', String(geometry.center.x));
            this.centerHandle.setAttribute('cy', String(geometry.center.y));
        }
        this.frameRequest = requestAnimationFrame(() => this._update());
    }
}

if (typeof document !== 'undefined') {
    document.querySelectorAll('.part-transform-overlay').forEach(element => element.remove());
}

export const partTransformOverlay = new PartTransformOverlay();
