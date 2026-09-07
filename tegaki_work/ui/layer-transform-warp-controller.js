/**
 * Layer Transform内Simple 4x4 WARPのpointer adapter。
 *
 * このcontrollerはDOM gestureとLayerSystemのtransaction境界だけを接続する。
 * Project、History、ClipInstance、Rasterの保存正本は所有しない。
 */

import { showFeedbackToast } from './feedback-toast.js';
import { warpGridOverlay } from './warp-grid-overlay.js';

const POINT_COUNT = 16;

const REASON_MESSAGES = Object.freeze({
    'advanced-layer-warp-required': '既存WARPがSimple 4x4ではないため、高度なWARPが必要です',
    'selected-clip-working-layer-required': '選択中のCAF RasterだけをWARPできます',
    'layer-warp-target-unsupported': 'このRasterではLayer WARPを開始できません',
    'layer-warp-entry-blocked': '現在のLayer Transform状態ではWARPを開始できません',
    'layer-raster-bounds-required': '変形対象のRaster範囲を取得できません'
});

function clonePoints(points) {
    return Array.isArray(points)
        ? points.map(point => ({ x: Number(point?.x) || 0, y: Number(point?.y) || 0 }))
        : [];
}

export class LayerTransformWarpController {
    constructor({ layerSystem, coordinateSystem, overlay = warpGridOverlay } = {}) {
        this.layerSystem = layerSystem || null;
        this.coordinateSystem = coordinateSystem || null;
        this.overlay = overlay;
        this.modeActive = false;
        this.gesture = null;
    }

    begin() {
        if (this.modeActive) return true;
        const start = this.layerSystem?.beginLayerWarpEditSession?.();
        if (start?.ok !== true) {
            this._showBlockedReason(start?.reason);
            return false;
        }
        const session = this.layerSystem?.getLayerWarpEditSession?.();
        const bindBounds = session?.bindBounds || start.bindBounds || session?.transaction?.bindBounds;
        const points = session?.points || start.points || session?.transaction?.baselinePoints;
        if (!bindBounds || !Array.isArray(points) || points.length !== POINT_COUNT) {
            this.layerSystem?.finishLayerWarpEditSession?.({ cancelled: true });
            this._showBlockedReason('layer-warp-entry-blocked');
            return false;
        }
        this.modeActive = true;
        const activated = this.overlay?.activate?.({
            coordinateSystem: this.coordinateSystem,
            columns: 4,
            rows: 4,
            interactive: true,
            getWorldPoints: () => this._getWorldPoints(),
            getSelectedPointIndices: () => this.gesture ? [this.gesture.pointIndex] : [],
            // Keep the grid alive for the whole WARP transaction. The
            // animation bridge may briefly reproject the V session while a
            // point preview is being rendered; the transaction itself is the
            // authoritative lifetime until V/Esc closes it.
            shouldDisplay: () => this.modeActive && (
                !!this.layerSystem?.isLayerMoveMode
                || !!this.layerSystem?.getLayerWarpEditSession?.()
            ),
            onPointPointerDown: (pointIndex, event) => this._onPointerDown(pointIndex, event),
            onPointPointerMove: (pointIndex, event) => this._onPointerMove(pointIndex, event),
            onPointPointerUp: (pointIndex, event) => this._onPointerUp(pointIndex, event),
            onPointPointerCancel: (pointIndex, event) => this._onPointerCancel(pointIndex, event),
            onPointLostPointerCapture: (pointIndex, event) => this._onLostPointerCapture(pointIndex, event)
        });
        if (!activated) {
            this.modeActive = false;
            this.layerSystem?.finishLayerWarpEditSession?.({ cancelled: true });
            this._showBlockedReason('layer-warp-entry-blocked');
            return false;
        }
        return true;
    }

    deactivate() {
        this._releaseGesture({ rollback: false });
        this.modeActive = false;
        this.overlay?.deactivate?.();
    }

    reset() {
        if (!this.modeActive) return false;
        const result = this.layerSystem?.resetLayerWarpEditSession?.();
        if (result?.ok !== true) return false;
        this.overlay?._update?.();
        return true;
    }

    _getWorldPoints() {
        const session = this.layerSystem?.getLayerWarpEditSession?.();
        const bounds = session?.bindBounds || session?.transaction?.bindBounds;
        const points = session?.points || [];
        if (!bounds || points.length !== POINT_COUNT) return [];
        return points.map(point => ({
            x: bounds.x + point.x * bounds.width,
            y: bounds.y + point.y * bounds.height
        }));
    }

    _screenToNormalized(event) {
        const session = this.layerSystem?.getLayerWarpEditSession?.();
        const bounds = session?.bindBounds || session?.transaction?.bindBounds;
        if (!bounds || !this.coordinateSystem?.screenClientToWorld) return null;
        const world = this.coordinateSystem.screenClientToWorld(event.clientX, event.clientY);
        if (!Number.isFinite(world?.worldX) || !Number.isFinite(world?.worldY)) return null;
        return {
            x: (world.worldX - bounds.x) / bounds.width,
            y: (world.worldY - bounds.y) / bounds.height
        };
    }

    _onPointerDown(pointIndex, event) {
        if (!this.modeActive || this.gesture || !Number.isInteger(pointIndex)) return;
        if (event.button !== undefined && event.button !== 0) return;
        const session = this.layerSystem?.getLayerWarpEditSession?.();
        const points = session?.points;
        if (!Array.isArray(points) || points.length !== POINT_COUNT) return;
        this.gesture = {
            pointerId: event.pointerId,
            pointIndex,
            startPoints: clonePoints(points),
            target: event.currentTarget,
            ignoreLost: false
        };
        try {
            event.currentTarget?.setPointerCapture?.(event.pointerId);
        } catch {
            // Pointer capture is best effort; lost capture still follows rollback semantics.
        }
        event.preventDefault?.();
        event.stopPropagation?.();
    }

    _onPointerMove(pointIndex, event) {
        const gesture = this.gesture;
        if (!gesture || gesture.pointerId !== event.pointerId || gesture.pointIndex !== pointIndex) return;
        const point = this._screenToNormalized(event);
        if (!point) return;
        const nextPoints = clonePoints(gesture.startPoints);
        nextPoints[pointIndex] = point;
        const result = this.layerSystem?.previewLayerWarpEditSession?.(nextPoints);
        if (result?.ok !== true) {
            this._rollbackGesture();
            this._showBlockedReason(result?.reason);
            return;
        }
        event.preventDefault?.();
        event.stopPropagation?.();
    }

    _onPointerUp(pointIndex, event) {
        const gesture = this.gesture;
        if (!gesture || gesture.pointerId !== event.pointerId || gesture.pointIndex !== pointIndex) return;
        gesture.ignoreLost = true;
        try {
            gesture.target?.releasePointerCapture?.(gesture.pointerId);
        } catch {
            // The browser may release capture before pointerup.
        }
        this.gesture = null;
        event.preventDefault?.();
        event.stopPropagation?.();
    }

    _onPointerCancel(pointIndex, event) {
        const gesture = this.gesture;
        if (!gesture || gesture.pointerId !== event.pointerId || gesture.pointIndex !== pointIndex) return;
        this._rollbackGesture();
        event.preventDefault?.();
        event.stopPropagation?.();
    }

    _onLostPointerCapture(pointIndex, event) {
        const gesture = this.gesture;
        if (!gesture || gesture.pointerId !== event.pointerId || gesture.pointIndex !== pointIndex) return;
        if (!gesture.ignoreLost) this._rollbackGesture();
    }

    _rollbackGesture() {
        const gesture = this.gesture;
        if (!gesture) return false;
        this.layerSystem?.previewLayerWarpEditSession?.(gesture.startPoints);
        try {
            gesture.target?.releasePointerCapture?.(gesture.pointerId);
        } catch {
            // Ignore a capture that was already lost.
        }
        this.gesture = null;
        return true;
    }

    _releaseGesture({ rollback = true } = {}) {
        if (rollback) this._rollbackGesture();
        else this.gesture = null;
    }

    _showBlockedReason(reason) {
        const message = REASON_MESSAGES[reason] || 'このLayerではSimple 4x4 WARPを開始できません';
        showFeedbackToast(message, { duration: 2200 });
    }
}

export const LAYER_WARP_SIMPLE_POINT_COUNT = POINT_COUNT;
