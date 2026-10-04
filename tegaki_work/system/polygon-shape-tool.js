/**
 * ============================================================================
 * ファイル名: system/polygon-shape-tool.js
 * 責務: 選択入力経路上の一時多角形編集と、閉じた輪郭の確定
 * 依存: system/closed-shape-paint.js, system/pixel-selection-system.js(座標/overlay所有), ui/feedback-toast.js
 * 被依存: system/selection-area-tools.js
 * 公開API: PolygonShapeEditor
 * 保存: なし。編集点はruntime-only。確定時は通常Raster + History 1件。
 * 実装状態: ✅WP-030 多角形
 *
 * click=点追加、既存点drag=編集、始点click/Enter=閉じる、Backspace=末尾取消、
 * Escape=破棄、Shift=45度補助。Space/ global V の優先はPixelSelectionSystemの共通入口に従う。
 * ============================================================================
 */

import {
    normalizeClosedPoints,
    resolveClosedShapePaint,
    strokePolygonsForPoints,
    paintClosedShapeToLayer
} from './closed-shape-paint.js';
import { showFeedbackToast } from '../ui/feedback-toast.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const MAX_POINTS = 256;
const MIN_POINTS = 3;
const VERTEX_HIT = 12;
const CLOSE_DRAG_THRESHOLD = 5;
const MIN_POINT_DISTANCE = 0.25;

function finitePoint(point) {
    return Number.isFinite(Number(point?.x)) && Number.isFinite(Number(point?.y));
}

function clonePoints(points) {
    return points.map(point => ({ x: point.x, y: point.y }));
}

function snap45(origin, point) {
    const dx = point.x - origin.x;
    const dy = point.y - origin.y;
    const length = Math.hypot(dx, dy);
    if (!(length > 0)) return { ...origin };
    const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
    return { x: origin.x + Math.cos(angle) * length, y: origin.y + Math.sin(angle) * length };
}

export class PolygonShapeEditor {
    constructor(areaTools) {
        this.areaTools = areaTools;
        this.layer = null;
        this.points = [];
        this.drag = null;
        this.hoverPoint = null;
        this.hoverIndex = -1;
        this.parts = null;
        this._cursor = '';
        this._maxToastShown = false;
    }

    get system() {
        return this.areaTools.system;
    }

    hasActiveDrag() {
        return !!this.drag;
    }

    isEditing() {
        return !!this.drag || this.points.length > 0;
    }

    getPoints() {
        return clonePoints(this.points);
    }

    _toLocal(event, layer = this.layer) {
        const local = this.system.coordSystem?.screenClientToLocal?.(event.clientX, event.clientY, layer);
        if (!local || !Number.isFinite(local.localX) || !Number.isFinite(local.localY)) return null;
        return {
            // layer spriteのrasterBounds offsetを二重適用しない。shape-toolと同じ
            // project-local座標を保持し、確定時のcompositorがCanvas frameへclipする。
            x: local.localX,
            y: local.localY
        };
    }

    _toScreen(point, layer = this.layer) {
        const screen = this.system._layerPointToScreen(layer, point.x, point.y);
        return Number.isFinite(screen?.clientX) && Number.isFinite(screen?.clientY)
            ? { x: screen.clientX, y: screen.clientY }
            : null;
    }

    _screenPoints() {
        const screen = this.points.map(point => this._toScreen(point)).filter(Boolean);
        return screen.length === this.points.length ? screen : null;
    }

    _hitVertex(event) {
        const screen = this._screenPoints();
        if (!screen) return -1;
        let best = -1;
        let distance = Infinity;
        screen.forEach((point, index) => {
            const next = Math.hypot(event.clientX - point.x, event.clientY - point.y);
            if (next <= VERTEX_HIT && next < distance) {
                best = index;
                distance = next;
            }
        });
        return best;
    }

    _capture(event) {
        try { this.system.canvas?.setPointerCapture?.(event.pointerId); } catch (error) { /* 任意 */ }
    }

    _release(event) {
        try { this.system.canvas?.releasePointerCapture?.(event.pointerId); } catch (error) { /* 任意 */ }
    }

    pointerDown(event, target) {
        if (target?.kind !== 'layer') {
            showFeedbackToast('フォルダでは使えません。Raster Layerを選んでください');
            return false;
        }
        if (this.layer && this.layer !== target.layer) {
            if (this.points.length >= MIN_POINTS) this.commit();
            else this.cancel();
        }
        this.layer = target.layer;
        const point = this._toLocal(event, this.layer);
        if (!point) return false;

        const hit = this.points.length ? this._hitVertex(event) : -1;
        if (hit === 0 && this.points.length >= MIN_POINTS) {
            this.drag = {
                type: 'maybe-close', pointerId: event.pointerId, start: point, current: point,
                base: clonePoints(this.points), index: 0
            };
        } else if (hit >= 0) {
            this.drag = {
                type: 'vertex', pointerId: event.pointerId, start: point, current: point,
                base: clonePoints(this.points), index: hit, shift: event.shiftKey === true
            };
        } else {
            this.drag = {
                type: 'append', pointerId: event.pointerId, start: point, current: point,
                shift: event.shiftKey === true
            };
        }
        this._capture(event);
        this.render();
        return true;
    }

    pointerMove(event) {
        const drag = this.drag;
        if (drag && event.pointerId !== drag.pointerId) return false;
        if (!drag) {
            if (!this.layer || !this.points.length) return false;
            const point = this._toLocal(event, this.layer);
            if (!point) return false;
            this.hoverPoint = point;
            this.hoverIndex = this._hitVertex(event);
            this.hover(event);
            return true;
        }
        const point = this._toLocal(event, this.layer);
        if (!point) return true;
        drag.shift = event.shiftKey === true;
        drag.current = point;
        if (drag.type === 'vertex') {
            this._moveVertex(drag, point);
        } else if (drag.type === 'maybe-close' && Math.hypot(point.x - drag.start.x, point.y - drag.start.y) > CLOSE_DRAG_THRESHOLD) {
            drag.type = 'vertex';
            this._moveVertex(drag, point);
        }
        this.render();
        return true;
    }

    _moveVertex(drag, point) {
        const next = { x: point.x, y: point.y };
        if (drag.shift) {
            const base = drag.base[drag.index];
            const origin = drag.index > 0 ? drag.base[drag.index - 1] : drag.base[(drag.index + drag.base.length - 1) % drag.base.length];
            const snapped = snap45(origin, next);
            next.x = base.x + (snapped.x - base.x);
            next.y = base.y + (snapped.y - base.y);
        }
        this.points = drag.base.map((entry, index) => index === drag.index ? next : { ...entry });
    }

    pointerUp(event) {
        const drag = this.drag;
        if (!drag || event.pointerId !== drag.pointerId) return false;
        this.drag = null;
        this._release(event);
        if (drag.type === 'append') {
            this._appendPoint(drag.current, drag.shift);
        } else if (drag.type === 'maybe-close') {
            if (Math.hypot(drag.current.x - drag.start.x, drag.current.y - drag.start.y) <= CLOSE_DRAG_THRESHOLD) {
                this.commit();
                return true;
            }
        }
        this.render();
        return true;
    }

    pointerCancel(event) {
        const drag = this.drag;
        if (!drag) return false;
        if (event?.pointerId !== undefined && event.pointerId !== drag.pointerId) return false;
        this.drag = null;
        this._release(event || { pointerId: drag.pointerId });
        this.render();
        return true;
    }

    hover(event) {
        if (!this.layer || this.drag) return;
        const point = this._toLocal(event, this.layer);
        if (!point) return;
        this.hoverPoint = point;
        this.hoverIndex = this._hitVertex(event);
        this.render();
        const canvas = this.system.canvas;
        let cursor = '';
        if (this.hoverIndex >= 0) cursor = this.hoverIndex === 0 && this.points.length >= MIN_POINTS ? 'pointer' : 'crosshair';
        else if (this.points.length) cursor = 'crosshair';
        if (canvas && cursor !== this._cursor) {
            this._cursor = cursor;
            canvas.style.cursor = cursor;
        }
    }

    clearHover() {
        this.hoverPoint = null;
        this.hoverIndex = -1;
        if (this._cursor) {
            this._cursor = '';
            if (this.system.canvas) this.system.canvas.style.cursor = '';
        }
    }

    _appendPoint(point, shift = false) {
        if (!finitePoint(point)) return false;
        if (this.points.length >= MAX_POINTS) {
            if (!this._maxToastShown) {
                showFeedbackToast(`多角形の点は${MAX_POINTS}個までです`);
                this._maxToastShown = true;
            }
            return false;
        }
        let next = { x: Number(point.x), y: Number(point.y) };
        const previous = this.points[this.points.length - 1];
        if (previous && shift) next = snap45(previous, next);
        if (previous && Math.hypot(next.x - previous.x, next.y - previous.y) < MIN_POINT_DISTANCE) return false;
        this.points.push(next);
        this._maxToastShown = false;
        this.hoverPoint = null;
        this.render();
        return true;
    }

    undoLastPoint() {
        if (this.drag) return false;
        if (!this.points.length) return false;
        this.points.pop();
        if (!this.points.length) this.layer = null;
        this.render();
        return true;
    }

    cancel() {
        this.drag = null;
        this.points = [];
        this.layer = null;
        this.clearHover();
        this.render();
        return true;
    }

    commit() {
        const normalized = normalizeClosedPoints(this.points, { min: MIN_POINTS, max: MAX_POINTS });
        if (!normalized.ok) {
            if (normalized.reason === 'too-few-points') showFeedbackToast('多角形は3点以上で確定できます');
            return false;
        }
        const layer = this.layer;
        const points = normalized.points;
        this.drag = null;
        this.points = [];
        this.layer = null;
        this.render();
        return this._bake(layer, points);
    }

    _paintOptions() {
        const options = this.areaTools.options.shape || {};
        const colors = this.areaTools.getColors();
        const widthValue = options.width ?? Number(window.brushSettings?.getSize?.());
        return {
            width: Number.isFinite(Number(widthValue)) && Number(widthValue) > 0 ? Number(widthValue) : 4,
            join: options.join === 'round' ? 'round' : 'miter',
            paint: resolveClosedShapePaint(options, colors, { legacyMode: 'same' }),
            opacity: Number.isFinite(Number(window.brushSettings?.getOpacity?.()))
                ? Math.max(0, Math.min(1, Number(window.brushSettings.getOpacity())))
                : 1
        };
    }

    _bake(layer, points) {
        if (!layer) return false;
        const options = this._paintOptions();
        const strokePolygons = strokePolygonsForPoints(points, { width: options.width, join: options.join });
        const result = paintClosedShapeToLayer({
            system: this.system,
            layerSystem: this.system.layerSystem,
            layer,
            contours: [points],
            strokePolygons,
            paint: options.paint,
            opacity: options.opacity,
            source: 'shape-polygon',
            historyName: 'shape-polygon',
            meta: { kind: 'polygon', pointCount: points.length, width: options.width, paint: options.paint.mode }
        });
        if (!result.ok) {
            if (result.reason === 'outside-canvas') showFeedbackToast('キャンバスの外です');
            else if (result.reason === 'bounds-limit') showFeedbackToast('描画範囲を広げられません（サイズ上限）');
            else if (result.reason === 'empty-selection') showFeedbackToast('描ける範囲がありません');
        }
        return result.ok;
    }

    _ensureParts() {
        const svg = this.system.overlay;
        if (!svg || this.parts || typeof svg.appendChild !== 'function') return !!this.parts;
        const make = (tag, cls) => {
            const element = document.createElementNS(SVG_NS, tag);
            element.classList.add(cls);
            element.style.display = 'none';
            return element;
        };
        const group = document.createElementNS(SVG_NS, 'g');
        group.classList.add('polygon-shape-tool-group');
        const fill = make('path', 'polygon-shape-tool-fill');
        fill.setAttribute('fill-rule', 'evenodd');
        const preview = make('path', 'polygon-shape-tool-preview');
        preview.classList.add('shape-tool-preview');
        const guide = make('path', 'polygon-shape-tool-guide');
        guide.classList.add('shape-tool-guide');
        const vertices = Array.from({ length: MAX_POINTS }, () => {
            const circle = make('circle', 'polygon-shape-tool-vertex');
            circle.classList.add('shape-tool-vertex');
            circle.setAttribute('r', '5');
            return circle;
        });
        const paint = document.createElementNS(SVG_NS, 'g');
        paint.classList.add('polygon-shape-tool-paint');
        paint.append(fill, preview);
        group.append(paint, guide, ...vertices);
        svg.appendChild(group);
        this.parts = { group, paint, fill, preview, guide, vertices };
        return true;
    }

    _setHidden(hidden) {
        if (!this.parts) return;
        this.parts.group.style.display = hidden ? 'none' : '';
    }

    _pathForPoints(points, close = true) {
        const screen = points.map(point => this._toScreen(point)).filter(Boolean);
        if (!screen.length) return '';
        return `M${screen.map(point => `${point.x} ${point.y}`).join('L')}${close && screen.length >= MIN_POINTS ? 'Z' : ''}`;
    }

    render() {
        if (!this._ensureParts()) return;
        if (!this.layer || !this.points.length) {
            this._setHidden(true);
            return;
        }
        const parts = this.parts;
        this._setHidden(false);
        const screen = this._screenPoints();
        if (!screen) {
            this._setHidden(true);
            return;
        }
        const options = this._paintOptions();
        const contourPath = this._pathForPoints(this.points, true);
        parts.fill.setAttribute('d', contourPath);
        parts.fill.style.display = options.paint.fillRgb && this.points.length >= MIN_POINTS ? '' : 'none';
        parts.fill.style.fill = options.paint.fillRgb ? `rgb(${options.paint.fillRgb.join(',')})` : 'none';
        parts.paint.style.opacity = String(options.opacity);
        parts.fill.style.fillOpacity = '1';

        const strokePolygons = strokePolygonsForPoints(this.points, { width: options.width, join: options.join });
        parts.preview.setAttribute('d', strokePolygons.map(polygon => this._pathForPoints(polygon, true)).join(''));
        parts.preview.style.fill = `rgb(${options.paint.strokeRgb.join(',')})`;
        parts.preview.style.fillOpacity = '1';

        const appendGuide = this.drag?.type === 'append' && this.points.length
            ? (this.drag.shift ? snap45(this.points[this.points.length - 1], this.drag.current) : this.drag.current)
            : null;
        const guidePoint = appendGuide || this.hoverPoint;
        const guidePoints = guidePoint && this.points.length
            ? [...this.points, guidePoint]
            : this.points;
        parts.guide.setAttribute('d', this._pathForPoints(guidePoints, false));
        screen.forEach((point, index) => {
            const circle = parts.vertices[index];
            circle.setAttribute('cx', String(point.x));
            circle.setAttribute('cy', String(point.y));
            circle.style.display = '';
            circle.classList.toggle('is-first', index === 0);
            circle.classList.toggle('is-hover', index === this.hoverIndex);
        });
        for (let i = screen.length; i < parts.vertices.length; i += 1) parts.vertices[i].style.display = 'none';
        this.system.overlay?.classList.add('is-visible');
    }

    destroy() {
        this.cancel();
        this.parts?.group?.remove?.();
        this.parts = null;
    }
}

