/**
 * Layer Transform内Simple 4x4 WARPのpointer adapter。
 *
 * このcontrollerはDOM gestureとLayerSystemのtransaction境界だけを接続する。
 * Project、History、ClipInstance、Rasterの保存正本は所有しない。
 */

import { showFeedbackToast } from './feedback-toast.js';
import { warpGridOverlay } from './warp-grid-overlay.js';
import {
    applyTransformMatrix,
    createCenteredTransformMatrix,
    invertTransformMatrixPoint
} from '../system/transform-math.js';
import {
    calculateWarpGridBrushWeights,
    inflateWarpGridBrushPoints,
    translateWarpGridBrushPoints
} from '../system/animation/warp-grid-brush.js';

const POINT_COUNT = 16;
const WARP_INTERACTION_TOOLS = Object.freeze({ POINT: 'point', BRUSH: 'brush' });
const WARP_BRUSH_TYPES = Object.freeze({ MOVE: 'move', INFLATE: 'inflate', PINCH: 'pinch' });
const DEFAULT_BRUSH_SETTINGS = Object.freeze({
    radius: 72,
    strength: 0.45,
    hardness: 0.55
});
const IDENTITY_MATRIX = Object.freeze({
    a: 1,
    b: 0,
    c: 0,
    d: 1,
    tx: 0,
    ty: 0
});

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

function isFiniteMatrix(matrix) {
    return !!matrix && [
        matrix.a,
        matrix.b,
        matrix.c,
        matrix.d,
        matrix.tx,
        matrix.ty
    ].every(Number.isFinite);
}

export class LayerTransformWarpController {
    constructor({ layerSystem, coordinateSystem, overlay = warpGridOverlay, onTrace = null } = {}) {
        this.layerSystem = layerSystem || null;
        this.coordinateSystem = coordinateSystem || null;
        this.overlay = overlay;
        // Diagnostic-only hook. Production does not pass it, so normal use has
        // no console output or retained event history.
        this.onTrace = typeof onTrace === 'function' ? onTrace : null;
        this.modeActive = false;
        this.gesture = null;
        this.brushGesture = null;
        this.interactionTool = WARP_INTERACTION_TOOLS.POINT;
        this.brushType = WARP_BRUSH_TYPES.MOVE;
        this.brushSettings = { ...DEFAULT_BRUSH_SETTINGS };
        this.brushCursor = null;
    }

    setInteractionTool(tool = WARP_INTERACTION_TOOLS.POINT) {
        const next = Object.values(WARP_INTERACTION_TOOLS).includes(tool)
            ? tool
            : WARP_INTERACTION_TOOLS.POINT;
        if (this.gesture || this.brushGesture) return false;
        this.interactionTool = next;
        if (next !== WARP_INTERACTION_TOOLS.BRUSH) this.brushCursor = null;
        this.overlay?._update?.();
        this.layerSystem?.transform?._updateCursor?.();
        return true;
    }

    getInteractionTool() {
        return this.interactionTool;
    }

    setBrushType(type = WARP_BRUSH_TYPES.MOVE) {
        const next = Object.values(WARP_BRUSH_TYPES).includes(type)
            ? type
            : WARP_BRUSH_TYPES.MOVE;
        if (this.gesture || this.brushGesture) return false;
        this.brushType = next;
        return true;
    }

    getBrushType() {
        return this.brushType;
    }

    setBrushSettings(settings = {}) {
        const next = { ...this.brushSettings };
        ['radius', 'strength', 'hardness'].forEach(key => {
            if (Number.isFinite(Number(settings[key]))) next[key] = Number(settings[key]);
        });
        next.radius = Math.max(12, Math.min(160, next.radius));
        next.strength = Math.max(0.05, Math.min(1, next.strength));
        next.hardness = Math.max(0, Math.min(1, next.hardness));
        this.brushSettings = next;
        this.brushCursor = this.brushCursor
            ? this._createBrushCursor(this.brushCursor.x, this.brushCursor.y)
            : null;
        this.overlay?._update?.();
        return { ...this.brushSettings };
    }

    getBrushSettings() {
        return { ...this.brushSettings };
    }

    getBrushPreview() {
        if (this.interactionTool !== WARP_INTERACTION_TOOLS.BRUSH || !this.brushCursor) {
            return null;
        }
        return {
            ...this.brushCursor,
            visible: this.modeActive === true
        };
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
            getBrushPreview: () => this.getBrushPreview(),
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
        this.brushCursor = null;
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
        const motionMatrix = this._getCurrentLayerMotionMatrix();
        if (!motionMatrix) return [];
        return points.map(point => ({
            ...applyTransformMatrix(
                motionMatrix,
                bounds.x + point.x * bounds.width,
                bounds.y + point.y * bounds.height
            )
        }));
    }

    /**
     * WARPの正本点はMotion前のProject座標へ保持し、表示時だけ現Frameの
     * Layer Motionを適用する。Motionの評価はLayerSystem側のproduction
     * boundaryから受け取り、このcontrollerで保存値を書き換えない。
     */
    _getCurrentLayerMotionMatrix() {
        const projection = this.layerSystem?.getLayerWarpAuthoringMotion?.();
        if (projection?.ok === false) return null;
        if (isFiniteMatrix(projection?.matrix)) return projection.matrix;
        return IDENTITY_MATRIX;
    }

    _screenToNormalized(event) {
        const session = this.layerSystem?.getLayerWarpEditSession?.();
        const bounds = session?.bindBounds || session?.transaction?.bindBounds;
        if (!bounds || !this.coordinateSystem?.screenClientToWorld) return null;
        const world = this.coordinateSystem.screenClientToWorld(event.clientX, event.clientY);
        if (!Number.isFinite(world?.worldX) || !Number.isFinite(world?.worldY)) return null;
        const motionMatrix = this._getCurrentLayerMotionMatrix();
        if (!motionMatrix) return null;
        const motionWorld = invertTransformMatrixPoint(
            motionMatrix,
            world.worldX,
            world.worldY
        );
        if (!motionWorld) return null;
        if (!Number.isFinite(bounds.width) || !Number.isFinite(bounds.height)
            || Math.abs(bounds.width) < 1e-8 || Math.abs(bounds.height) < 1e-8) {
            return null;
        }
        return {
            x: (motionWorld.x - bounds.x) / bounds.width,
            y: (motionWorld.y - bounds.y) / bounds.height
        };
    }

    _worldToScreen(point) {
        const screen = this.coordinateSystem?.worldToScreenImmediate?.(point.x, point.y)
            || this.coordinateSystem?.worldToScreen?.(point.x, point.y);
        return screen && Number.isFinite(screen.clientX) && Number.isFinite(screen.clientY)
            ? { x: screen.clientX, y: screen.clientY }
            : null;
    }

    _getScreenPoints(points = null) {
        const session = this.layerSystem?.getLayerWarpEditSession?.();
        const source = Array.isArray(points) ? points : session?.points;
        const bounds = session?.bindBounds || session?.transaction?.bindBounds;
        if (!Array.isArray(source) || source.length !== POINT_COUNT || !bounds) return null;
        const motionMatrix = this._getCurrentLayerMotionMatrix();
        if (!motionMatrix) return null;
        return source.map(point => this._worldToScreen(applyTransformMatrix(
            motionMatrix,
            bounds.x + point.x * bounds.width,
            bounds.y + point.y * bounds.height
        )));
    }

    _createBrushCursor(x, y) {
        const screenPoints = this._getScreenPoints();
        const weights = screenPoints
            ? calculateWarpGridBrushWeights(screenPoints, {
                center: { x, y },
                radius: this.brushSettings.radius,
                hardness: this.brushSettings.hardness
            })
            : [];
        return {
            x,
            y,
            radius: this.brushSettings.radius,
            strength: this.brushSettings.strength,
            weights: weights || []
        };
    }

    _updateBrushCursor(event) {
        if (this.interactionTool !== WARP_INTERACTION_TOOLS.BRUSH
            || !Number.isFinite(event?.clientX)
            || !Number.isFinite(event?.clientY)) {
            this.brushCursor = null;
            return null;
        }
        this.brushCursor = this._createBrushCursor(event.clientX, event.clientY);
        this.overlay?._update?.();
        return this.brushCursor;
    }

    _calculateBrushPoints(event) {
        const gesture = this.brushGesture;
        if (!gesture) return null;
        const center = { x: Number(event?.clientX), y: Number(event?.clientY) };
        if (!Number.isFinite(center.x) || !Number.isFinite(center.y)) return null;
        const weights = calculateWarpGridBrushWeights(gesture.startScreenPoints, {
            center,
            radius: this.brushSettings.radius,
            hardness: this.brushSettings.hardness
        });
        if (!weights) return null;

        let screenPoints = null;
        if (this.brushType === WARP_BRUSH_TYPES.MOVE) {
            screenPoints = translateWarpGridBrushPoints(
                gesture.startScreenPoints,
                weights,
                {
                    x: center.x - gesture.startClient.x,
                    y: center.y - gesture.startClient.y
                }
            );
        } else {
            const sign = this.brushType === WARP_BRUSH_TYPES.PINCH ? -1 : 1;
            screenPoints = inflateWarpGridBrushPoints(
                gesture.startScreenPoints,
                weights,
                {
                    pivot: center,
                    amount: sign * this.brushSettings.radius * this.brushSettings.strength * 0.45
                }
            );
        }
        if (!Array.isArray(screenPoints) || screenPoints.length !== POINT_COUNT) return null;
        return screenPoints.map(point => this._screenToNormalized({
            clientX: point.x,
            clientY: point.y
        }));
    }

    handleCanvasPointerDown(event) {
        if (!this.modeActive
            || this.interactionTool !== WARP_INTERACTION_TOOLS.BRUSH
            || this.brushGesture
            || this.gesture
            || (event?.button !== undefined && event.button !== 0)) {
            return false;
        }
        const session = this.layerSystem?.getLayerWarpEditSession?.();
        const points = session?.points;
        const startScreenPoints = this._getScreenPoints(points);
        if (!Array.isArray(points) || points.length !== POINT_COUNT
            || !Array.isArray(startScreenPoints) || startScreenPoints.some(point => !point)) {
            return false;
        }
        this.brushGesture = {
            pointerId: event.pointerId,
            startPoints: clonePoints(points),
            startScreenPoints,
            startClient: { x: event.clientX, y: event.clientY },
            target: event.currentTarget,
            ignoreLost: false
        };
        this._updateBrushCursor(event);
        let capture = 'unavailable';
        try {
            if (typeof event.currentTarget?.setPointerCapture === 'function') capture = 'success';
            event.currentTarget?.setPointerCapture?.(event.pointerId);
        } catch {
            capture = 'failure';
        }
        this._traceEvent('brush-pointerdown', event, { capture });
        event.preventDefault?.();
        event.stopPropagation?.();
        return true;
    }

    handleCanvasPointerMove(event) {
        if (!this.modeActive || this.interactionTool !== WARP_INTERACTION_TOOLS.BRUSH) return false;
        this._updateBrushCursor(event);
        const gesture = this.brushGesture;
        if (!gesture || gesture.pointerId !== event.pointerId) return false;
        const nextPoints = this._calculateBrushPoints(event);
        if (!nextPoints || nextPoints.some(point => !point)) return false;
        const result = this.layerSystem?.previewLayerWarpEditSession?.(nextPoints);
        this._traceEvent('brush-pointermove', event, { result });
        if (result?.ok !== true) {
            this._rollbackBrushGesture();
            this._showBlockedReason(result?.reason);
            return true;
        }
        event.preventDefault?.();
        event.stopPropagation?.();
        return true;
    }

    handleCanvasPointerUp(event) {
        const gesture = this.brushGesture;
        if (!gesture || gesture.pointerId !== event.pointerId) return false;
        gesture.ignoreLost = true;
        try {
            gesture.target?.releasePointerCapture?.(gesture.pointerId);
        } catch {}
        this.brushGesture = null;
        this._updateBrushCursor(event);
        this._traceEvent('brush-pointerup', event, { terminal: 'retained' });
        event.preventDefault?.();
        event.stopPropagation?.();
        return true;
    }

    handleCanvasPointerCancel(event) {
        const gesture = this.brushGesture;
        if (!gesture || gesture.pointerId !== event.pointerId) return false;
        this._rollbackBrushGesture();
        this._traceEvent('brush-pointercancel', event, { terminal: 'rollback' });
        event.preventDefault?.();
        event.stopPropagation?.();
        return true;
    }

    handleCanvasLostPointerCapture(event) {
        const gesture = this.brushGesture;
        if (!gesture || gesture.pointerId !== event.pointerId || gesture.ignoreLost) return false;
        this._rollbackBrushGesture();
        this._traceEvent('brush-lostpointercapture', event, { terminal: 'rollback' });
        return true;
    }

    _rollbackBrushGesture() {
        const gesture = this.brushGesture;
        if (!gesture) return false;
        this.layerSystem?.previewLayerWarpEditSession?.(gesture.startPoints);
        try {
            gesture.target?.releasePointerCapture?.(gesture.pointerId);
        } catch {}
        this.brushGesture = null;
        return true;
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
        let capture = 'unavailable';
        try {
            if (typeof event.currentTarget?.setPointerCapture === 'function') {
                capture = 'success';
            }
            event.currentTarget?.setPointerCapture?.(event.pointerId);
        } catch {
            capture = 'failure';
            // Pointer capture is best effort; lost capture still follows rollback semantics.
        }
        this._traceEvent('pointerdown', event, {
            pointIndex,
            capture,
            normalized: this.gesture.startPoints[pointIndex]
        });
        event.preventDefault?.();
        event.stopPropagation?.();
    }

    _onPointerMove(pointIndex, event) {
        const gesture = this.gesture;
        if (!gesture || gesture.pointerId !== event.pointerId || gesture.pointIndex !== pointIndex) return;
        const point = this._screenToNormalized(event);
        if (!point) {
            this._traceEvent('pointermove', event, {
                pointIndex,
                normalized: null,
                result: { ok: false, reason: 'screen-to-normalized-failed' }
            });
            return;
        }
        const nextPoints = clonePoints(gesture.startPoints);
        nextPoints[pointIndex] = point;
        const result = this.layerSystem?.previewLayerWarpEditSession?.(nextPoints);
        this._traceEvent('pointermove', event, {
            pointIndex,
            normalized: point,
            result,
            sessionChanged: this.layerSystem?.getLayerWarpEditSession?.()?.changed === true
        });
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
        this._traceEvent('pointerup', event, { pointIndex, terminal: 'retained' });
        event.preventDefault?.();
        event.stopPropagation?.();
    }

    _onPointerCancel(pointIndex, event) {
        const gesture = this.gesture;
        if (!gesture || gesture.pointerId !== event.pointerId || gesture.pointIndex !== pointIndex) return;
        this._rollbackGesture();
        this._traceEvent('pointercancel', event, { pointIndex, terminal: 'rollback' });
        event.preventDefault?.();
        event.stopPropagation?.();
    }

    _onLostPointerCapture(pointIndex, event) {
        const gesture = this.gesture;
        if (!gesture || gesture.pointerId !== event.pointerId || gesture.pointIndex !== pointIndex) return;
        if (!gesture.ignoreLost) {
            this._rollbackGesture();
            this._traceEvent('lostpointercapture', event, { pointIndex, terminal: 'rollback' });
        }
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
        if (rollback) {
            this._rollbackGesture();
            this._rollbackBrushGesture();
            return;
        }
        const brushGesture = this.brushGesture;
        const pointGesture = this.gesture;
        this.brushGesture = null;
        this.gesture = null;
        [brushGesture, pointGesture].forEach(gesture => {
            if (!gesture) return;
            try {
                gesture.target?.releasePointerCapture?.(gesture.pointerId);
            } catch {
                // Ignore capture that the browser already released.
            }
        });
    }

    _traceEvent(type, event, extra = {}) {
        if (!this.onTrace) return;
        const activeGesture = this.gesture || this.brushGesture;
        const target = activeGesture?.target || event?.currentTarget || null;
        const session = this.layerSystem?.getLayerWarpEditSession?.() || null;
        const transaction = session?.transaction || this.layerSystem?._layerTransformSession?.transaction || null;
        let hasCapture = null;
        try {
            hasCapture = typeof target?.hasPointerCapture === 'function'
                ? target.hasPointerCapture(event?.pointerId)
                : null;
        } catch {
            hasCapture = false;
        }
        const point = Number.isInteger(extra.pointIndex) && Array.isArray(session?.points)
            ? session.points[extra.pointIndex]
            : null;
        try {
            this.onTrace({
                type,
                pointerId: event?.pointerId ?? null,
                pointerType: event?.pointerType || null,
                button: event?.button ?? null,
                buttons: event?.buttons ?? null,
                isPrimary: event?.isPrimary ?? null,
                targetConnected: target?.isConnected ?? null,
                hasPointerCapture: hasCapture,
                pointIndex: Number.isInteger(extra.pointIndex) ? extra.pointIndex : null,
                interactionTool: this.interactionTool,
                brushType: this.brushType,
                normalized: extra.normalized ? { ...extra.normalized } : null,
                preview: extra.result
                    ? { ok: extra.result.ok === true, reason: extra.result.reason || null }
                    : null,
                sessionChanged: extra.sessionChanged ?? session?.changed === true,
                sessionPoint: point ? { x: point.x, y: point.y } : null,
                capture: extra.capture || null,
                terminal: extra.terminal || null,
                overlayActive: this.overlay?.isActive?.() === true,
                modeActive: this.modeActive === true,
                transformSession: !!this.layerSystem?._layerTransformSession,
                currentFrame: transaction?.timelineFrame ?? null,
                internalLayerId: transaction?.internalLayerId ?? null
            });
        } catch {
            // Diagnostics must never change the pointer terminal outcome.
        }
    }

    _showBlockedReason(reason) {
        const message = REASON_MESSAGES[reason] || 'このLayerではSimple 4x4 WARPを開始できません';
        showFeedbackToast(message, { duration: 2200 });
    }
}

export const LAYER_WARP_SIMPLE_POINT_COUNT = POINT_COUNT;
export { WARP_INTERACTION_TOOLS, WARP_BRUSH_TYPES };
