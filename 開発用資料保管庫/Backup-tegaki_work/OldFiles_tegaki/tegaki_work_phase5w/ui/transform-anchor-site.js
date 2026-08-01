/** Canvas変形の回転・拡縮中心を共有操作するDOM site。 */
export class TransformAnchorSite {
    constructor() {
        this.element = null;
        this.owner = null;
        this.options = null;
        this.pointerId = null;
        this._frame = null;
    }

    activate(owner, options = {}) {
        if (!owner || !options.coordinateSystem) return false;
        this.deactivate();
        this.owner = owner;
        this.options = options;
        this._ensureElement();
        this.element.classList.toggle('is-clip-pivot', owner === 'clip-motion');
        this.element.hidden = false;
        this.setEditable(owner, options.editable === true);
        this._updatePosition();
        return true;
    }

    deactivate(owner = null) {
        if (owner && owner !== this.owner) return false;
        if (this._frame !== null) cancelAnimationFrame(this._frame);
        this._frame = null;
        this.pointerId = null;
        this.owner = null;
        this.options = null;
        if (this.element) {
            this.element.hidden = true;
            this.element.classList.remove('is-editable');
        }
        return true;
    }

    isActive(owner = null) {
        return !!this.owner && (!owner || owner === this.owner);
    }

    isEditable(owner = null) {
        return this.isActive(owner) && this.options?.editable === true;
    }

    setEditable(owner, editable) {
        if (!this.isActive(owner) || !this.options || !this.element) return false;
        this.options.editable = editable === true;
        this.element.classList.toggle('is-editable', this.options.editable);
        this.element.setAttribute('aria-hidden', this.options.editable ? 'false' : 'true');
        const hint = this.element.querySelector('.transform-anchor-hint');
        if (hint) hint.textContent = this.options.hint || '中心をドラッグ';
        return true;
    }

    _ensureElement() {
        if (this.element?.isConnected) return;
        this.element = document.createElement('div');
        this.element.className = 'transform-anchor-site';
        this.element.hidden = true;
        this.element.innerHTML = '<span></span><svg class="transform-anchor-bone" viewBox="0 0 24 42" aria-hidden="true"><circle class="transform-anchor-bone-head" cx="12" cy="8" r="5"/><path class="transform-anchor-bone-body" d="M12 13 19 20 14 37 12 41 10 37 5 20Z"/></svg><div class="transform-anchor-hint"></div>';
        document.body.appendChild(this.element);
        this.element.addEventListener('pointerdown', event => {
            if (!this.options || this.options.editable !== true || event.button !== 0) return;
            this.pointerId = event.pointerId;
            this.options.onDragStart?.();
            this.element.setPointerCapture?.(event.pointerId);
            event.preventDefault();
            event.stopImmediatePropagation();
        });
        this.element.addEventListener('pointermove', event => {
            if (this.pointerId !== event.pointerId || !this.options) return;
            const point = this.options.coordinateSystem.screenClientToWorld(event.clientX, event.clientY);
            const width = Math.max(1, this.options.width || 1);
            const height = Math.max(1, this.options.height || 1);
            const resolved = this.options.worldToAnchor?.(point) || {
                x: point.worldX / width,
                y: point.worldY / height
            };
            const anchor = { x: resolved.x, y: resolved.y };
            this.options.onChange?.(anchor);
            this._updatePosition();
            event.preventDefault();
            event.stopImmediatePropagation();
        });
        const finish = event => {
            if (this.pointerId !== event.pointerId) return;
            this.element.releasePointerCapture?.(event.pointerId);
            this.pointerId = null;
            this.options?.onCommit?.();
            event.preventDefault();
            event.stopImmediatePropagation();
        };
        this.element.addEventListener('pointerup', finish);
        this.element.addEventListener('pointercancel', finish);
    }

    _updatePosition() {
        if (!this.options || !this.element) return;
        const anchor = this.options.getAnchor?.() || { x: 0.5, y: 0.5 };
        const fallbackWorld = {
            x: (Number.isFinite(anchor.x) ? anchor.x : 0.5) * this.options.width,
            y: (Number.isFinite(anchor.y) ? anchor.y : 0.5) * this.options.height
        };
        const world = this.options.getWorldPosition?.(anchor) || fallbackWorld;
        const screen = this.options.coordinateSystem.worldToScreen(world.x, world.y);
        this.element.style.left = `${screen.clientX}px`;
        this.element.style.top = `${screen.clientY}px`;
        this.element.classList.toggle('hint-left', screen.clientX > window.innerWidth - 210);
        this.element.classList.toggle('hint-below', screen.clientY < 72);
        this._frame = requestAnimationFrame(() => this._updatePosition());
    }
}

export const transformAnchorSite = new TransformAnchorSite();
