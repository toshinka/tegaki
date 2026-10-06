/**
 * ROLE: Freehand closed-area eraser on the existing selection capture surface.
 * AUTHORITY: Runtime points only; closed-shape compositor owns Raster/History.
 * INVARIANTS: Pointer-up erases once. Cancel/tool switch/invalid path erases nothing.
 * Coordinates are layer-local Project pixels, matching PolygonShapeEditor.
 */
import { paintClosedShapeToLayer } from './closed-shape-paint.js';
import { showFeedbackToast } from '../ui/feedback-toast.js';

const MAX_POINTS = 16384;

export class LassoEraseEditor {
    constructor(areaTools) {
        this.areaTools = areaTools;
        this.drag = null;
        this.group = null;
        this.halo = null;
        this.path = null;
        this.subscriptions = ['layer:activated', 'layer:deleted', 'canvas:resized', 'history:changed'].map(name => {
            const handler = () => { if (this.drag) this.cancel(); };
            this.system.eventBus?.on(name, handler);
            return [name, handler];
        });
    }

    get system() { return this.areaTools.system; }
    hasActiveDrag() { return !!this.drag; }

    _point(event, layer) {
        const local = this.system.coordSystem?.screenClientToLocal?.(event.clientX, event.clientY, layer);
        return Number.isFinite(local?.localX) && Number.isFinite(local?.localY)
            ? { x: local.localX, y: local.localY } : null;
    }

    pointerDown(event, target) {
        const layer = target?.layer;
        const data = layer?.layerData;
        if (target?.kind !== 'layer' || !data?.renderTexture || data.isBackground || data.isAnimationWorkingLayer) {
            showFeedbackToast('通常のRaster Layerを選んでください');
            return false;
        }
        const point = this._point(event, layer);
        if (!point) return false;
        const value = Number(window.brushSettings?.getOpacity?.() ?? 1);
        const opacity = Number.isFinite(value) ? value : 1;
        this.drag = { layer, pointerId: event.pointerId, points: [point], opacity: Math.max(0, Math.min(1, opacity)) };
        try { this.system.canvas?.setPointerCapture?.(event.pointerId); } catch { /* optional */ }
        this.render();
        return true;
    }

    pointerMove(event) {
        const drag = this.drag;
        if (!drag || event.pointerId !== drag.pointerId) return false;
        const samples = event.getCoalescedEvents?.();
        for (const sample of samples?.length ? samples : [event]) {
            const point = this._point(sample, drag.layer);
            const last = drag.points[drag.points.length - 1];
            if (point && Math.hypot(point.x - last.x, point.y - last.y) >= .25) {
                if (drag.points.length >= MAX_POINTS) {
                    this.cancel();
                    showFeedbackToast('囲む範囲を小さくして描き直してください');
                    return true;
                }
                drag.points.push(point);
            }
        }
        this.render();
        return true;
    }

    pointerUp(event) {
        if (!this.drag || event.pointerId !== this.drag.pointerId) return false;
        this.pointerMove(event);
        const drag = this.drag;
        if (!drag) return true;
        try {
            if (drag.points.length >= 3) {
                const result = paintClosedShapeToLayer({
                    system: this.system, layerSystem: this.system.layerSystem, layer: drag.layer,
                    contours: [drag.points], strokePolygons: [],
                    paint: { fillRgb: [255, 255, 255], strokeRgb: null },
                    opacity: drag.opacity, blendMode: 'erase',
                    source: 'erase-lasso', historyName: 'erase-lasso',
                    meta: { kind: 'lasso', pointCount: drag.points.length }
                });
                if (!result.ok && !['empty-selection', 'outside-canvas'].includes(result.reason)) {
                    showFeedbackToast('このLayerでは領域を消せません');
                }
                this.system.layerSystem.flushFolderComposites?.();
                this.system.layerSystem.app?.render?.();
            }
        } finally { this.cancel(); }
        return true;
    }

    pointerCancel(event) {
        if (!this.drag || event.pointerId !== this.drag.pointerId) return false;
        this.cancel();
        return true;
    }

    cancel() {
        const pointerId = this.drag?.pointerId;
        this.drag = null;
        if (pointerId != null) {
            try { this.system.canvas?.releasePointerCapture?.(pointerId); } catch { /* optional */ }
        }
        this.render();
    }

    render() {
        const overlay = this.system.overlay;
        if (!overlay) return;
        if (!this.path) {
            this.group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            this.group.classList.add('lasso-erase-tool-overlay');
            this.halo = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            this.halo.classList.add('lasso-erase-tool-halo');
            this.path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            this.path.classList.add('lasso-erase-tool-guide');
            this.group.append(this.halo, this.path);
            overlay.appendChild(this.group);
        }
        this.group.style.display = this.drag ? '' : 'none';
        if (!this.drag) return;
        const points = this.drag.points.map(point => this.system._layerPointToScreen(this.drag.layer, point.x, point.y));
        const d = `M${points.map(point => `${point.clientX} ${point.clientY}`).join('L')}${points.length >= 3 ? 'Z' : ''}`;
        this.path.setAttribute('d', d); this.halo.setAttribute('d', d);
        const rgb = this.areaTools.getColors().background;
        const luminance = rgb.map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
        const light = luminance[0] * .2126 + luminance[1] * .7152 + luminance[2] * .0722;
        this.group.style.setProperty('--lasso-erase-guide-color', `rgb(${rgb.join(',')})`);
        // Two steady colors remain readable on either side of an artwork edge.
        // No per-move GPU readback, blinking, smoothing or opaque area preview.
        this.group.style.setProperty('--lasso-erase-guide-contrast', light > .26 ? '#800000' : '#ffffee');
        overlay.classList.add('is-visible');
    }

    destroy() {
        this.cancel(); this.group?.remove(); this.path = null; this.halo = null; this.group = null;
        this.subscriptions.forEach(([name, handler]) => this.system.eventBus?.off(name, handler));
        this.subscriptions = [];
    }
}
