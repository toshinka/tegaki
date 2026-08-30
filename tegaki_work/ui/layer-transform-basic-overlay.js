/**
 * V Layer Transform BASICのdisplay-only DOM overlay。
 * LayerTransformから既存transform stateのworld四隅を受け取って表示するだけで、
 * pointer gesture、Pixi Container、confirm、History、saveを所有しない。
 */

import { createTransformOverlayScreenGeometry } from '../system/transform-overlay-geometry.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

export class LayerTransformBasicOverlay {
    constructor() {
        this.element = null;
        this.frame = null;
        this.rotationStem = null;
        this.rotationHandle = null;
        this.cornerHandles = [];
        this.options = null;
        this.frameRequest = null;
    }

    activate(options = {}) {
        if (!options.coordinateSystem || typeof options.getWorldCorners !== 'function') {
            return false;
        }
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
        this.frame = null;
        this.rotationStem = null;
        this.rotationHandle = null;
        this.cornerHandles = [];
    }

    isActive() {
        return !!this.options;
    }

    getScreenGeometry() {
        const worldCorners = this.options?.getWorldCorners?.() || [];
        if (worldCorners.length !== 4) return null;
        const coordinateSystem = this.options.coordinateSystem;
        const screenCorners = worldCorners.map(point => {
            const screen = coordinateSystem.worldToScreenImmediate?.(point.x, point.y)
                || coordinateSystem.worldToScreen?.(point.x, point.y);
            return screen && Number.isFinite(screen.clientX) && Number.isFinite(screen.clientY)
                ? { x: screen.clientX, y: screen.clientY }
                : null;
        });
        if (screenCorners.some(point => !point)) return null;
        return createTransformOverlayScreenGeometry(screenCorners, 28);
    }

    _ensureElement() {
        if (this.element?.isConnected) return;
        document.querySelectorAll('.layer-transform-basic-overlay').forEach(element => element.remove());
        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.classList.add('layer-transform-basic-overlay');
        svg.dataset.transformMode = 'basic';
        svg.setAttribute('aria-hidden', 'true');

        this.frame = document.createElementNS(SVG_NS, 'polygon');
        this.frame.classList.add('layer-transform-basic-overlay__frame');
        svg.appendChild(this.frame);

        this.rotationStem = document.createElementNS(SVG_NS, 'line');
        this.rotationStem.classList.add('layer-transform-basic-overlay__rotation-stem');
        svg.appendChild(this.rotationStem);

        for (let index = 0; index < 4; index++) {
            const handle = document.createElementNS(SVG_NS, 'circle');
            handle.classList.add('layer-transform-basic-overlay__corner');
            handle.setAttribute('r', '6');
            svg.appendChild(handle);
            this.cornerHandles.push(handle);
        }

        this.rotationHandle = document.createElementNS(SVG_NS, 'circle');
        this.rotationHandle.classList.add('layer-transform-basic-overlay__rotation');
        this.rotationHandle.setAttribute('r', '7');
        svg.appendChild(this.rotationHandle);

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
            this.frame.setAttribute(
                'points',
                geometry.corners.map(point => `${point.x},${point.y}`).join(' ')
            );
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
        }
        this.frameRequest = requestAnimationFrame(() => this._update());
    }
}

if (typeof document !== 'undefined') {
    document.querySelectorAll('.layer-transform-basic-overlay').forEach(element => element.remove());
}

export const layerTransformBasicOverlay = new LayerTransformBasicOverlay();
