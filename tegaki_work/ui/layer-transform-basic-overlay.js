/**
 * V Layer Transform BASICのDOM overlay。
 * LayerTransformから既存transform stateのworld四隅を受け取り、四隅、辺中点、rotation handleの
 * pointer入力をcallbackへ渡す。Pixi Container、transform正本、confirm、History、saveは所有しない。
 */

import { createTransformOverlayScreenGeometry } from '../system/transform-overlay-geometry.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

export class LayerTransformBasicOverlay {
    constructor() {
        this.element = null;
        this.frame = null;
        this.rotationStem = null;
        this.rotationHandle = null;
        this.rotationHitHandle = null;
        this.cornerHandles = [];
        this.cornerHitHandles = [];
        this.sideHandles = [];
        this.sideHitHandles = [];
        this.options = null;
        this.frameRequest = null;
        this.pointerGesture = null;
        this._documentPointerMove = event => {
            this._movePointerGesture(event);
        };
        this._documentPointerUp = event => {
            this._finishPointerGesture(event, false);
        };
        this._documentPointerCancel = event => {
            this._finishPointerGesture(event, true);
        };
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
        this._removePointerGestureListeners();
        this.pointerGesture = null;
        this.options = null;
        this.element?.remove();
        this.element = null;
        this.frame = null;
        this.rotationStem = null;
        this.rotationHandle = null;
        this.rotationHitHandle = null;
        this.cornerHandles = [];
        this.cornerHitHandles = [];
        this.sideHandles = [];
        this.sideHitHandles = [];
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

        for (let index = 0; index < 4; index++) {
            const hitHandle = document.createElementNS(SVG_NS, 'circle');
            hitHandle.classList.add('layer-transform-basic-overlay__corner-hit');
            hitHandle.dataset.cornerIndex = String(index);
            hitHandle.setAttribute('r', '14');
            hitHandle.addEventListener('pointerenter', () => {
                this.cornerHandles[index]?.classList.add('is-hovered');
            });
            hitHandle.addEventListener('pointerleave', () => {
                if (this.pointerGesture?.type !== 'uniform-scale'
                    || this.pointerGesture.cornerIndex !== index) {
                    this.cornerHandles[index]?.classList.remove('is-hovered');
                }
            });
            hitHandle.addEventListener('pointerdown', event => {
                this._startCornerGesture(event, index, hitHandle);
            });
            hitHandle.addEventListener('lostpointercapture', event => {
                this._finishCornerGesture(event, index, true, false);
            });
            svg.appendChild(hitHandle);
            this.cornerHitHandles.push(hitHandle);
        }

        for (let index = 0; index < 4; index++) {
            const handle = document.createElementNS(SVG_NS, 'circle');
            handle.classList.add('layer-transform-basic-overlay__side');
            handle.setAttribute('r', '5');
            svg.appendChild(handle);
            this.sideHandles.push(handle);
        }

        for (let index = 0; index < 4; index++) {
            const hitHandle = document.createElementNS(SVG_NS, 'circle');
            const axis = index % 2 === 0 ? 'y' : 'x';
            hitHandle.classList.add('layer-transform-basic-overlay__side-hit');
            hitHandle.dataset.sideIndex = String(index);
            hitHandle.dataset.axis = axis;
            hitHandle.setAttribute('r', '14');
            hitHandle.addEventListener('pointerenter', () => {
                this.sideHandles[index]?.classList.add('is-hovered');
            });
            hitHandle.addEventListener('pointerleave', () => {
                if (this.pointerGesture?.type !== 'axis-scale'
                    || this.pointerGesture.sideIndex !== index) {
                    this.sideHandles[index]?.classList.remove('is-hovered');
                }
            });
            hitHandle.addEventListener('pointerdown', event => {
                this._startAxisScaleGesture(event, index, axis, hitHandle);
            });
            hitHandle.addEventListener('lostpointercapture', event => {
                this._finishAxisScaleGesture(event, index, true, false);
            });
            svg.appendChild(hitHandle);
            this.sideHitHandles.push(hitHandle);
        }

        this.rotationHandle = document.createElementNS(SVG_NS, 'circle');
        this.rotationHandle.classList.add('layer-transform-basic-overlay__rotation');
        this.rotationHandle.setAttribute('r', '7');
        svg.appendChild(this.rotationHandle);

        this.rotationHitHandle = document.createElementNS(SVG_NS, 'circle');
        this.rotationHitHandle.classList.add('layer-transform-basic-overlay__rotation-hit');
        this.rotationHitHandle.setAttribute('r', '14');
        this.rotationHitHandle.addEventListener('pointerenter', () => {
            this.rotationHandle?.classList.add('is-hovered');
        });
        this.rotationHitHandle.addEventListener('pointerleave', () => {
            if (this.pointerGesture?.type !== 'rotate') {
                this.rotationHandle?.classList.remove('is-hovered');
            }
        });
        this.rotationHitHandle.addEventListener('pointerdown', event => {
            this._startRotationGesture(event, this.rotationHitHandle);
        });
        this.rotationHitHandle.addEventListener('lostpointercapture', event => {
            this._finishRotationGesture(event, true, false);
        });
        svg.appendChild(this.rotationHitHandle);

        document.body.appendChild(svg);
        this.element = svg;
    }

    _startCornerGesture(event, cornerIndex, captureTarget) {
        if (event.button !== 0 || event.isPrimary === false || this.pointerGesture) return;
        const accepted = this.options?.onUniformScaleStart?.({
            pointerId: event.pointerId,
            cornerIndex,
            clientX: event.clientX,
            clientY: event.clientY
        });
        if (accepted === false) return;

        this.pointerGesture = {
            type: 'uniform-scale',
            pointerId: event.pointerId,
            cornerIndex,
            captureTarget
        };
        this._raiseInteractiveHandle('corner', cornerIndex);
        document.addEventListener('pointermove', this._documentPointerMove, { capture: true, passive: false });
        document.addEventListener('pointerup', this._documentPointerUp, { capture: true, passive: false });
        document.addEventListener('pointercancel', this._documentPointerCancel, { capture: true, passive: false });
        this.cornerHandles[cornerIndex]?.classList.add('is-active');
        this.element?.classList.add('is-scaling');
        try {
            captureTarget.setPointerCapture?.(event.pointerId);
        } catch (error) {}
        event.preventDefault();
        event.stopPropagation();
    }

    _moveCornerGesture(event, cornerIndex) {
        const gesture = this.pointerGesture;
        if (!gesture
            || gesture.type !== 'uniform-scale'
            || gesture.pointerId !== event.pointerId
            || gesture.cornerIndex !== cornerIndex) return;
        this.options?.onUniformScaleMove?.({
            pointerId: event.pointerId,
            cornerIndex,
            clientX: event.clientX,
            clientY: event.clientY
        });
        event.preventDefault();
        event.stopPropagation();
    }

    _finishCornerGesture(event, cornerIndex, cancelled, releaseCapture = true) {
        const gesture = this.pointerGesture;
        if (!gesture
            || gesture.type !== 'uniform-scale'
            || gesture.pointerId !== event.pointerId
            || gesture.cornerIndex !== cornerIndex) return;
        this.pointerGesture = null;
        this._removePointerGestureListeners();
        this.cornerHandles[cornerIndex]?.classList.remove('is-active', 'is-hovered');
        this.element?.classList.remove('is-scaling');
        if (releaseCapture) {
            try {
                gesture.captureTarget.releasePointerCapture?.(event.pointerId);
            } catch (error) {}
        }
        this.options?.onUniformScaleEnd?.({
            pointerId: event.pointerId,
            cornerIndex,
            clientX: event.clientX,
            clientY: event.clientY,
            cancelled
        });
        event.preventDefault();
        event.stopPropagation();
    }

    _startRotationGesture(event, captureTarget) {
        if (event.button !== 0 || event.isPrimary === false || this.pointerGesture) return;
        const accepted = this.options?.onRotationStart?.({
            pointerId: event.pointerId,
            clientX: event.clientX,
            clientY: event.clientY
        });
        if (accepted === false) return;

        this.pointerGesture = { type: 'rotate', pointerId: event.pointerId, captureTarget };
        this._raiseInteractiveHandle('rotation');
        document.addEventListener('pointermove', this._documentPointerMove, { capture: true, passive: false });
        document.addEventListener('pointerup', this._documentPointerUp, { capture: true, passive: false });
        document.addEventListener('pointercancel', this._documentPointerCancel, { capture: true, passive: false });
        this.rotationHandle?.classList.add('is-active');
        this.element?.classList.add('is-rotating');
        try {
            captureTarget.setPointerCapture?.(event.pointerId);
        } catch (error) {}
        event.preventDefault();
        event.stopPropagation();
    }

    _startAxisScaleGesture(event, sideIndex, axis, captureTarget) {
        if (event.button !== 0 || event.isPrimary === false || this.pointerGesture) return;
        const accepted = this.options?.onAxisScaleStart?.({
            pointerId: event.pointerId,
            sideIndex,
            axis,
            clientX: event.clientX,
            clientY: event.clientY
        });
        if (accepted === false) return;

        this.pointerGesture = {
            type: 'axis-scale',
            pointerId: event.pointerId,
            sideIndex,
            axis,
            captureTarget
        };
        this._raiseInteractiveHandle('side', sideIndex);
        document.addEventListener('pointermove', this._documentPointerMove, { capture: true, passive: false });
        document.addEventListener('pointerup', this._documentPointerUp, { capture: true, passive: false });
        document.addEventListener('pointercancel', this._documentPointerCancel, { capture: true, passive: false });
        this.sideHandles[sideIndex]?.classList.add('is-active');
        this.element?.classList.add('is-axis-scaling');
        try {
            captureTarget.setPointerCapture?.(event.pointerId);
        } catch (error) {}
        event.preventDefault();
        event.stopPropagation();
    }

    _moveAxisScaleGesture(event) {
        const gesture = this.pointerGesture;
        if (!gesture || gesture.type !== 'axis-scale' || gesture.pointerId !== event.pointerId) return;
        this.options?.onAxisScaleMove?.({
            pointerId: event.pointerId,
            sideIndex: gesture.sideIndex,
            axis: gesture.axis,
            clientX: event.clientX,
            clientY: event.clientY
        });
        event.preventDefault();
        event.stopPropagation();
    }

    _finishAxisScaleGesture(event, sideIndex, cancelled, releaseCapture = true) {
        const gesture = this.pointerGesture;
        if (!gesture
            || gesture.type !== 'axis-scale'
            || gesture.pointerId !== event.pointerId
            || gesture.sideIndex !== sideIndex) return;
        this.pointerGesture = null;
        this._removePointerGestureListeners();
        this.sideHandles[sideIndex]?.classList.remove('is-active', 'is-hovered');
        this.element?.classList.remove('is-axis-scaling');
        if (releaseCapture) {
            try {
                gesture.captureTarget.releasePointerCapture?.(event.pointerId);
            } catch (error) {}
        }
        this.options?.onAxisScaleEnd?.({
            pointerId: event.pointerId,
            sideIndex,
            axis: gesture.axis,
            clientX: event.clientX,
            clientY: event.clientY,
            cancelled
        });
        event.preventDefault();
        event.stopPropagation();
    }

    _moveRotationGesture(event) {
        const gesture = this.pointerGesture;
        if (!gesture || gesture.type !== 'rotate' || gesture.pointerId !== event.pointerId) return;
        this.options?.onRotationMove?.({
            pointerId: event.pointerId,
            clientX: event.clientX,
            clientY: event.clientY
        });
        event.preventDefault();
        event.stopPropagation();
    }

    _finishRotationGesture(event, cancelled, releaseCapture = true) {
        const gesture = this.pointerGesture;
        if (!gesture || gesture.type !== 'rotate' || gesture.pointerId !== event.pointerId) return;
        this.pointerGesture = null;
        this._removePointerGestureListeners();
        this.rotationHandle?.classList.remove('is-active', 'is-hovered');
        this.element?.classList.remove('is-rotating');
        if (releaseCapture) {
            try {
                gesture.captureTarget.releasePointerCapture?.(event.pointerId);
            } catch (error) {}
        }
        this.options?.onRotationEnd?.({
            pointerId: event.pointerId,
            clientX: event.clientX,
            clientY: event.clientY,
            cancelled
        });
        event.preventDefault();
        event.stopPropagation();
    }

    _movePointerGesture(event) {
        if (this.pointerGesture?.type === 'rotate') {
            this._moveRotationGesture(event);
            return;
        }
        if (this.pointerGesture?.type === 'axis-scale') {
            this._moveAxisScaleGesture(event);
            return;
        }
        this._moveCornerGesture(event, this.pointerGesture?.cornerIndex);
    }

    _finishPointerGesture(event, cancelled) {
        if (this.pointerGesture?.type === 'rotate') {
            this._finishRotationGesture(event, cancelled);
            return;
        }
        if (this.pointerGesture?.type === 'axis-scale') {
            this._finishAxisScaleGesture(event, this.pointerGesture.sideIndex, cancelled);
            return;
        }
        this._finishCornerGesture(event, this.pointerGesture?.cornerIndex, cancelled);
    }

    _removePointerGestureListeners() {
        document.removeEventListener('pointermove', this._documentPointerMove, true);
        document.removeEventListener('pointerup', this._documentPointerUp, true);
        document.removeEventListener('pointercancel', this._documentPointerCancel, true);
    }

    /** 重なったhandleは最後に触れたvisual + hit pairをSVG末尾へ移し、次の入力でも最前面に保つ。 */
    _raiseInteractiveHandle(type, index = 0) {
        if (!this.element) return;
        let visual = null;
        let hit = null;
        if (type === 'corner') {
            visual = this.cornerHandles[index];
            hit = this.cornerHitHandles[index];
        } else if (type === 'side') {
            visual = this.sideHandles[index];
            hit = this.sideHitHandles[index];
        } else if (type === 'rotation') {
            visual = this.rotationHandle;
            hit = this.rotationHitHandle;
        }
        if (!visual || !hit) return;
        this.element.appendChild(visual);
        this.element.appendChild(hit);
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
            this.cornerHitHandles.forEach((handle, index) => {
                const point = geometry.corners[index];
                handle.setAttribute('cx', String(point.x));
                handle.setAttribute('cy', String(point.y));
                const dx = point.x - geometry.center.x;
                const dy = point.y - geometry.center.y;
                handle.classList.toggle('is-diagonal-main', dx * dy >= 0);
                handle.classList.toggle('is-diagonal-cross', dx * dy < 0);
            });
            this.sideHandles.forEach((handle, index) => {
                handle.setAttribute('cx', String(geometry.sideMidpoints[index].x));
                handle.setAttribute('cy', String(geometry.sideMidpoints[index].y));
            });
            this.sideHitHandles.forEach((handle, index) => {
                const point = geometry.sideMidpoints[index];
                const axis = index % 2 === 0
                    ? {
                        x: geometry.corners[3].x - geometry.corners[0].x,
                        y: geometry.corners[3].y - geometry.corners[0].y
                    }
                    : {
                        x: geometry.corners[1].x - geometry.corners[0].x,
                        y: geometry.corners[1].y - geometry.corners[0].y
                    };
                const diagonal = Math.abs(axis.x) > Math.abs(axis.y) * 0.42
                    && Math.abs(axis.y) > Math.abs(axis.x) * 0.42;
                handle.setAttribute('cx', String(point.x));
                handle.setAttribute('cy', String(point.y));
                handle.classList.toggle('is-horizontal-axis', !diagonal && Math.abs(axis.x) >= Math.abs(axis.y));
                handle.classList.toggle('is-vertical-axis', !diagonal && Math.abs(axis.x) < Math.abs(axis.y));
                handle.classList.toggle('is-diagonal-main', diagonal && axis.x * axis.y >= 0);
                handle.classList.toggle('is-diagonal-cross', diagonal && axis.x * axis.y < 0);
            });
            this.rotationStem.setAttribute('x1', String(geometry.topMid.x));
            this.rotationStem.setAttribute('y1', String(geometry.topMid.y));
            this.rotationStem.setAttribute('x2', String(geometry.rotationHandle.x));
            this.rotationStem.setAttribute('y2', String(geometry.rotationHandle.y));
            this.rotationHandle.setAttribute('cx', String(geometry.rotationHandle.x));
            this.rotationHandle.setAttribute('cy', String(geometry.rotationHandle.y));
            this.rotationHitHandle.setAttribute('cx', String(geometry.rotationHandle.x));
            this.rotationHitHandle.setAttribute('cy', String(geometry.rotationHandle.y));
        }
        this.frameRequest = requestAnimationFrame(() => this._update());
    }
}

if (typeof document !== 'undefined') {
    document.querySelectorAll('.layer-transform-basic-overlay').forEach(element => element.remove());
}

export const layerTransformBasicOverlay = new LayerTransformBasicOverlay();
