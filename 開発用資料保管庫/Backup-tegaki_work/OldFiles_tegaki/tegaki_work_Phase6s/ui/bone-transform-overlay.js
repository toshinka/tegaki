/**
 * root Boneのdisplay-only Canvas overlay。
 * Bone pose / key / Historyは所有せず、呼出側の共通samplerが返す線分だけを表示する。
 */
export class BoneTransformOverlay {
    constructor() {
        this.element = null;
        this.body = null;
        this.root = null;
        this.tip = null;
        this.options = null;
        this.frameRequest = null;
    }

    activate(options = {}) {
        if (!options.coordinateSystem || typeof options.getWorldSegment !== 'function') return false;
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
        this.body = null;
        this.root = null;
        this.tip = null;
    }

    getScreenGeometry() {
        const segment = this.options?.getWorldSegment?.();
        if (!segment?.root || !segment?.tip) return null;
        const coordinateSystem = this.options.coordinateSystem;
        const toScreen = point => {
            const screen = coordinateSystem.worldToScreenImmediate?.(point.x, point.y)
                || coordinateSystem.worldToScreen?.(point.x, point.y);
            return screen && Number.isFinite(screen.clientX) && Number.isFinite(screen.clientY)
                ? { x: screen.clientX, y: screen.clientY }
                : null;
        };
        const root = toScreen(segment.root);
        const tip = toScreen(segment.tip);
        return root && tip ? { root, tip } : null;
    }

    _ensureElement() {
        if (this.element?.isConnected) return;
        document.querySelectorAll('.bone-transform-overlay').forEach(element => element.remove());
        const namespace = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(namespace, 'svg');
        svg.classList.add('bone-transform-overlay');
        svg.setAttribute('aria-hidden', 'true');

        this.body = document.createElementNS(namespace, 'line');
        this.body.classList.add('bone-transform-overlay__body');
        svg.appendChild(this.body);

        this.root = document.createElementNS(namespace, 'circle');
        this.root.classList.add('bone-transform-overlay__root');
        this.root.setAttribute('r', '5');
        svg.appendChild(this.root);

        this.tip = document.createElementNS(namespace, 'path');
        this.tip.classList.add('bone-transform-overlay__tip');
        this.tip.setAttribute('d', 'M 0 -9 L 6 5 L 0 10 L -6 5 Z');
        svg.appendChild(this.tip);

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
            this.body.setAttribute('x1', String(geometry.root.x));
            this.body.setAttribute('y1', String(geometry.root.y));
            this.body.setAttribute('x2', String(geometry.tip.x));
            this.body.setAttribute('y2', String(geometry.tip.y));
            this.root.setAttribute('cx', String(geometry.root.x));
            this.root.setAttribute('cy', String(geometry.root.y));
            const angle = Math.atan2(
                geometry.tip.y - geometry.root.y,
                geometry.tip.x - geometry.root.x
            ) * 180 / Math.PI + 90;
            this.tip.setAttribute(
                'transform',
                `translate(${geometry.tip.x} ${geometry.tip.y}) rotate(${angle})`
            );
        }
        this.frameRequest = requestAnimationFrame(() => this._update());
    }
}

if (typeof document !== 'undefined') {
    document.querySelectorAll('.bone-transform-overlay').forEach(element => element.remove());
}

export const boneTransformOverlay = new BoneTransformOverlay();
