/**
 * ============================================================================
 * ファイル名: system/shape-tool.js
 * 責務: 線の図形ツール（四角/楕円）。ドラッグで作り、編集モードで4頂点・4辺・回転を動かし、確定でレイヤーへ線を焼く
 * 依存: system/shape-geometry.js, system/pixel-selection-system.js(所有者・入力経路とoverlay), system/raster-bounds.js,
 *       system/raster-snapshot-memory.js, ui/feedback-toast.js
 * 被依存: system/selection-area-tools.js
 * 公開API: ShapeEditor
 * 保存: なし。確定時にRaster画素へ線を書き、History 1件（途中の編集状態は保存しない）
 * 実装状態: ✅実装
 *
 * 操作: 空いた所をドラッグ=作成(Shiftで正方形/正円) / 頂点=ドラッグ / 辺=ドラッグ / 内側=移動 / 上の丸=回転 /
 *       Shift=頂点・辺の対称操作(shape-geometry.js参照) / Enter・確定ボタン=確定 / Esc=取消 / 外側クリック=確定して次を作成
 * ============================================================================
 */

import {
    createQuadFromDrag, moveVertex, moveEdge, translateQuad, rotateQuad, quadCenter,
    pointInQuad, distanceToSegment, squareFromQuad, strokePolygons, polygonsBounds
} from './shape-geometry.js';
import { normalizeRasterBounds } from './raster-bounds.js';
import { estimateRasterHistoryPairBytes } from './raster-snapshot-memory.js';
import { showFeedbackToast } from '../ui/feedback-toast.js';
import { createInlineNumberField } from '../ui/inline-number-field.js';
import { attachPopupDrag } from '../ui/popup-drag-helper.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const VERTEX_HIT = 11; // px(画面)
const EDGE_HIT = 8;
const ROTATE_HIT = 12;
const ROTATE_STEM = 30;
const MIN_CREATE_SIZE = 3; // layer px
const ROTATE_SNAP = (15 * Math.PI) / 180;

export class ShapeEditor {
    constructor(areaTools) {
        this.areaTools = areaTools;
        this.shape = null; // { kind, quad, layer }
        this.drag = null;
        this.parts = null;
        this.buttons = null;
    }

    get system() {
        return this.areaTools.system;
    }

    hasActiveDrag() {
        return !!this.drag;
    }

    isEditing() {
        return !!this.shape;
    }

    // ------------------------------------------------------------ 座標

    _toLocal(event, layer) {
        const local = this.system.coordSystem?.screenClientToLocal?.(event.clientX, event.clientY, layer);
        if (!local || !Number.isFinite(local.localX) || !Number.isFinite(local.localY)) return null;
        return { x: local.localX, y: local.localY };
    }

    _toScreen(layer, p) {
        const s = this.system._layerPointToScreen(layer, p.x, p.y);
        return Number.isFinite(s?.clientX) ? { x: s.clientX, y: s.clientY } : null;
    }

    _screenQuad() {
        const { layer, quad } = this.shape;
        const screen = quad.map(p => this._toScreen(layer, p));
        return screen.every(Boolean) ? screen : null;
    }

    /** 回転ハンドルの画面位置（上辺の中点から、図形の外側へ ROTATE_STEM px） */
    _rotateHandle(screen) {
        const mid = { x: (screen[0].x + screen[1].x) / 2, y: (screen[0].y + screen[1].y) / 2 };
        const center = { x: (screen[0].x + screen[1].x + screen[2].x + screen[3].x) / 4, y: (screen[0].y + screen[1].y + screen[2].y + screen[3].y) / 4 };
        let nx = mid.x - center.x;
        let ny = mid.y - center.y;
        const len = Math.hypot(nx, ny) || 1;
        nx /= len; ny /= len;
        return { mid, handle: { x: mid.x + nx * ROTATE_STEM, y: mid.y + ny * ROTATE_STEM } };
    }

    _hitTest(event) {
        const screen = this._screenQuad();
        if (!screen) return null;
        const p = { x: event.clientX, y: event.clientY };
        const { handle } = this._rotateHandle(screen);
        if (Math.hypot(p.x - handle.x, p.y - handle.y) <= ROTATE_HIT) return { type: 'rotate' };
        let best = null;
        screen.forEach((v, i) => {
            const d = Math.hypot(p.x - v.x, p.y - v.y);
            if (d <= VERTEX_HIT && (!best || d < best.d)) best = { type: 'vertex', index: i, d };
        });
        if (best) return best;
        for (let i = 0; i < 4; i += 1) {
            if (distanceToSegment(p, screen[i], screen[(i + 1) % 4]) <= EDGE_HIT) return { type: 'edge', index: i };
        }
        if (pointInQuad(p, screen)) return { type: 'body' };
        return null;
    }

    // ------------------------------------------------------------ 入力

    pointerDown(event, target) {
        if (target.kind !== 'layer') {
            showFeedbackToast('フォルダでは使えません。Raster Layerを選んでください');
            return false;
        }
        const kind = this.system.toolMode === 'shape-ellipse' ? 'ellipse' : 'rect';
        if (this.shape) {
            if (this.shape.layer !== target.layer) this.commit();
            else {
                const hit = this._hitTest(event);
                if (hit) {
                    this._beginEdit(event, hit);
                    return true;
                }
                this.commit();
            }
        }
        const start = this._toLocal(event, target.layer);
        if (!start) return false;
        this.drag = { type: 'create', pointerId: event.pointerId, layer: target.layer, kind, start, current: start };
        const size = Number(window.brushSettings?.getSize?.());
        this.shape = {
            kind, quad: createQuadFromDrag(start, start), layer: target.layer, creating: true,
            width: this.areaTools.options.shape.width ?? (Number.isFinite(size) && size > 0 ? size : 4),
            join: this.areaTools.options.shape.join,
            strength: 0, // 遠近（-90..90 %）。向かう先へ細く(+)/太く(-)
            target: null
        };
        this._capture(event);
        this.render();
        return true;
    }

    _beginEdit(event, hit) {
        const layer = this.shape.layer;
        if (hit.type === 'vertex' || hit.type === 'edge') {
            // 触った頂点/辺が遠近の「向かう先」になる
            this.shape.target = { type: hit.type, index: hit.index };
        }
        const start = this._toLocal(event, layer);
        if (!start) return;
        this.drag = {
            type: hit.type, index: hit.index, pointerId: event.pointerId, layer,
            start, base: this.shape.quad.map(p => ({ ...p })),
            startAngle: Math.atan2(start.y - quadCenter(this.shape.quad).y, start.x - quadCenter(this.shape.quad).x),
            center: quadCenter(this.shape.quad)
        };
        this._capture(event);
    }

    _capture(event) {
        try { this.system.canvas?.setPointerCapture?.(event.pointerId); } catch (error) { /* 任意 */ }
    }

    /** ドラッグしていない間、触れる所に合わせてカーソルを変える（頂点=十字 / 辺=両矢印 / 内側=移動 / 回転点=掴む） */
    hover(event) {
        const canvas = this.system.canvas;
        if (!canvas) return;
        let cursor = '';
        if (this.shape && !this.drag && !this.shape.creating) {
            const hit = this._hitTest(event);
            if (hit?.type === 'rotate') cursor = 'grab';
            else if (hit?.type === 'vertex') cursor = 'crosshair';
            else if (hit?.type === 'body') cursor = 'move';
            else if (hit?.type === 'edge') cursor = this._edgeCursor(hit.index);
        }
        if (this._cursor !== cursor) {
            this._cursor = cursor;
            canvas.style.cursor = cursor;
        }
    }

    _edgeCursor(index) {
        const screen = this._screenQuad();
        if (!screen) return 'move';
        const a = screen[index];
        const b = screen[(index + 1) % 4];
        // 辺の法線方向に合わせた両矢印
        const angle = ((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI + 90 + 360) % 180;
        if (angle < 22.5 || angle >= 157.5) return 'ew-resize';
        if (angle < 67.5) return 'nwse-resize';
        if (angle < 112.5) return 'ns-resize';
        return 'nesw-resize';
    }

    clearHover() {
        if (this._cursor) {
            this._cursor = '';
            if (this.system.canvas) this.system.canvas.style.cursor = '';
        }
    }

    pointerMove(event) {
        const drag = this.drag;
        if (!drag || event.pointerId !== drag.pointerId) return false;
        const point = this._toLocal(event, drag.layer);
        if (!point) return true;
        const shape = this.shape;
        const delta = { x: point.x - drag.start.x, y: point.y - drag.start.y };
        const shift = event.shiftKey === true;
        if (drag.type === 'create') {
            drag.current = point;
            shape.quad = createQuadFromDrag(drag.start, point, { square: shift });
        } else if (drag.type === 'vertex') {
            shape.quad = moveVertex(drag.base, drag.index, delta, { shift });
        } else if (drag.type === 'edge') {
            shape.quad = moveEdge(drag.base, drag.index, delta, { shift });
        } else if (drag.type === 'body') {
            shape.quad = translateQuad(drag.base, delta);
        } else if (drag.type === 'rotate') {
            let angle = Math.atan2(point.y - drag.center.y, point.x - drag.center.x) - drag.startAngle;
            if (shift) angle = Math.round(angle / ROTATE_SNAP) * ROTATE_SNAP;
            shape.quad = rotateQuad(drag.base, angle, drag.center);
        }
        this.render();
        return true;
    }

    pointerUp(event) {
        const drag = this.drag;
        if (!drag || event.pointerId !== drag.pointerId) return false;
        this.drag = null;
        try { this.system.canvas?.releasePointerCapture?.(event.pointerId); } catch (error) { /* 任意 */ }
        if (drag.type === 'create') {
            const q = this.shape.quad;
            if (Math.hypot(q[2].x - q[0].x, q[2].y - q[0].y) < MIN_CREATE_SIZE) {
                this.shape = null;
            } else {
                this.shape.creating = false;
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
        if (drag.type === 'create') this.shape = null;
        else if (drag.base) this.shape.quad = drag.base;
        this.render();
        return true;
    }

    // ------------------------------------------------------------ 確定 / 取消

    cancel() {
        this.drag = null;
        this.shape = null;
        this.render();
    }

    /** 編集中の図形をレイヤーへ焼く。図形が無ければ何もしない(true)。 */
    commit() {
        const shape = this.shape;
        if (!shape || shape.creating) {
            this.cancel();
            return true;
        }
        this.shape = null;
        this.drag = null;
        this.render();
        return this._bake(shape);
    }

    _getStroke(shape = this.shape) {
        const colors = this.areaTools.getColors();
        const opacity = Number(window.brushSettings?.getOpacity?.());
        return {
            rgb: colors.main,
            width: shape?.width ?? 4,
            alpha: Number.isFinite(opacity) ? Math.max(0, Math.min(1, opacity)) : 1
        };
    }

    _polygons(shape) {
        return strokePolygons(shape.kind, shape.quad, {
            width: shape.width, join: shape.join, strength: shape.strength / 100, target: shape.target
        });
    }

    _bake(shape) {
        const system = this.system;
        const layerSystem = system.layerSystem;
        const layer = shape.layer;
        const layerData = layer?.layerData;
        if (!layerData?.renderTexture || layerData.isAnimationWorkingLayer === true) {
            showFeedbackToast('このレイヤーには図形を描けません');
            return false;
        }
        const stroke = this._getStroke(shape);
        const polys = this._polygons(shape);
        const pb = polygonsBounds(polys);
        const rect = {
            x: Math.floor(pb.x0) - 2,
            y: Math.floor(pb.y0) - 2,
            width: Math.ceil(pb.x1 - pb.x0) + 4,
            height: Math.ceil(pb.y1 - pb.y0) + 4
        };
        const canvasCfg = layerSystem?.config?.canvas || window.TEGAKI_CONFIG?.canvas || {};
        // 書く範囲はキャンバス内に限る（キャンバス外へはみ出した分は捨てる）
        const clipped = { x: Math.max(0, rect.x), y: Math.max(0, rect.y), width: 0, height: 0 };
        clipped.width = Math.min(Math.round(canvasCfg.width || 0), rect.x + rect.width) - clipped.x;
        clipped.height = Math.min(Math.round(canvasCfg.height || 0), rect.y + rect.height) - clipped.y;
        if (!(clipped.width > 0 && clipped.height > 0)) {
            showFeedbackToast('キャンバスの外です');
            return false;
        }

        const canvas = document.createElement('canvas');
        canvas.width = clipped.width;
        canvas.height = clipped.height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = `rgb(${stroke.rgb[0]},${stroke.rgb[1]},${stroke.rgb[2]})`;
        // 全多角形を1つのパスにして一度に塗る（同じ向きなのでnonzeroで継ぎ目なく1枚の線になる）
        ctx.beginPath();
        for (const poly of polys) {
            poly.forEach((p, i) => {
                const x = p.x - clipped.x;
                const y = p.y - clipped.y;
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            });
            ctx.closePath();
        }
        ctx.fill('nonzero');
        const drawn = ctx.getImageData(0, 0, clipped.width, clipped.height).data;

        // 選択があればその中だけ（グラデーションと同じ扱い）
        const hasSel = system.hasSelection() && system.state.layerId === layerData.id && system.state.scope?.kind !== 'folder';
        const sel = hasSel ? { bounds: { ...system.state.bounds }, mask: system.state.mask || null } : null;

        const expanded = layerSystem.ensureLayerRasterBoundsForRect?.(layer, clipped, { padding: 0 });
        if (expanded?.ok === false) {
            showFeedbackToast('描画範囲を広げられません（サイズ上限）');
            return false;
        }
        const before = layerSystem.createLayerRasterSnapshot(layer);
        if (!before?.pixels) return false;
        const after = { ...before, pixels: new Uint8ClampedArray(before.pixels), paths: [], pathsData: [] };
        const rb = normalizeRasterBounds(before.rasterBounds, { width: before.width, height: before.height });

        let changed = 0;
        for (let y = 0; y < clipped.height; y += 1) {
            const py = clipped.y + y;
            for (let x = 0; x < clipped.width; x += 1) {
                const srcA = (drawn[(y * clipped.width + x) * 4 + 3] / 255) * stroke.alpha;
                if (srcA <= 0.002) continue;
                const px = clipped.x + x;
                if (sel) {
                    const b = sel.bounds;
                    if (px < b.x || py < b.y || px >= b.x + b.width || py >= b.y + b.height) continue;
                    if (sel.mask && sel.mask[(py - Math.floor(b.y)) * b.width + (px - Math.floor(b.x))] !== 1) continue;
                }
                const i = ((py - rb.y) * after.width + (px - rb.x)) * 4;
                if (i < 0 || i + 3 >= after.pixels.length) continue;
                const dstA = after.pixels[i + 3] / 255;
                const outA = srcA + dstA * (1 - srcA);
                if (outA <= 0) continue;
                after.pixels[i] = Math.round((stroke.rgb[0] * srcA + after.pixels[i] * dstA * (1 - srcA)) / outA);
                after.pixels[i + 1] = Math.round((stroke.rgb[1] * srcA + after.pixels[i + 1] * dstA * (1 - srcA)) / outA);
                after.pixels[i + 2] = Math.round((stroke.rgb[2] * srcA + after.pixels[i + 2] * dstA * (1 - srcA)) / outA);
                after.pixels[i + 3] = Math.round(outA * 255);
                changed += 1;
            }
        }
        if (changed === 0) {
            showFeedbackToast('描ける範囲がありません');
            return false;
        }
        if (!layerSystem.restoreLayerRasterSnapshot(after)) return false;

        const layerId = layerData.id;
        const retainedMemory = estimateRasterHistoryPairBytes(before, after);
        const restore = snapshot => {
            layerSystem.restoreLayerRasterSnapshot(snapshot);
            layerSystem.refreshClippingMasks?.();
            system.eventBus?.emit('layer:content-changed', { layerId, source: 'shape-line' });
        };
        system.history.record({
            name: 'shape-line',
            do: () => restore(after),
            undo: () => restore(before),
            byteSize: retainedMemory.estimatedBytes,
            meta: { type: 'shape-line', layerId, kind: shape.kind, retainedMemory }
        });
        layerSystem.refreshClippingMasks?.();
        system.eventBus?.emit('layer:content-changed', { layerId, source: 'shape-line' });
        return true;
    }

    // ------------------------------------------------------------ 表示

    _ensureParts() {
        const svg = this.system.overlay;
        if (!svg || this.parts || typeof svg.appendChild !== 'function') return !!this.parts;
        const make = (tag, cls) => {
            const el = document.createElementNS(SVG_NS, tag);
            el.classList.add(cls);
            el.style.display = 'none';
            return el;
        };
        const g = document.createElementNS(SVG_NS, 'g');
        g.classList.add('shape-tool-group');
        const preview = make('path', 'shape-tool-preview');
        const guide = make('path', 'shape-tool-guide');
        const stem = make('line', 'shape-tool-stem');
        const rotate = make('circle', 'shape-tool-rotate');
        rotate.setAttribute('r', '7');
        const vertices = [0, 1, 2, 3].map(() => {
            const c = make('circle', 'shape-tool-vertex');
            c.setAttribute('r', '6');
            return c;
        });
        const edges = [0, 1, 2, 3].map(() => {
            const r = make('rect', 'shape-tool-edge');
            r.setAttribute('width', '12');
            r.setAttribute('height', '8');
            r.setAttribute('rx', '3');
            return r;
        });
        [preview, guide, stem, ...edges, ...vertices, rotate].forEach(el => g.appendChild(el));
        svg.appendChild(g);
        this.parts = { g, preview, guide, stem, rotate, vertices, edges };
        return true;
    }

    _ensureButtons() {
        if (this.buttons) return this.buttons;
        const host = document.querySelector('.canvas-area') || document.body;
        if (!host) return null;
        const wrap = document.createElement('div');
        wrap.className = 'shape-tool-actions';
        wrap.style.display = 'none';
        const stop = event => event.stopPropagation();
        wrap.addEventListener('pointerdown', stop);
        // 余白をつかんで動かせる(動かしたら自動配置はやめる)
        this.detachDrag = attachPopupDrag(wrap, {
            interactiveSelector: 'button, input, label, select',
            onDragEnd: () => { wrap.dataset.moved = '1'; }
        });

        const button = (cls, text, title, onClick) => {
            const el = document.createElement('button');
            el.type = 'button';
            el.className = cls;
            el.textContent = text;
            el.title = title;
            el.addEventListener('click', onClick);
            return el;
        };
        const numberField = createInlineNumberField;

        const row1 = document.createElement('div');
        row1.className = 'shape-tool-row';
        const ok = button('shape-tool-confirm', '確定', '図形を確定 (Enter)', () => this.commit());
        const cancel = button('shape-tool-cancel', '×', '取り消し (Esc)', () => this.cancel());
        const reset = button('shape-tool-reset', '', '正方形/正円にそろえる', () => {
            if (!this.shape) return;
            this.shape.quad = squareFromQuad(this.shape.quad);
            this.render();
        });
        row1.append(ok, cancel, reset);

        const row2 = document.createElement('div');
        row2.className = 'shape-tool-row shape-tool-options';
        const width = numberField('太さ', '線の太さ(px)。ホイールで増減', { min: 1, max: 400, step: 1, unit: 'px' }, v => {
            if (this.shape) { this.shape.width = v; this.areaTools.setOptions({ shape: { width: v } }); this.render(); }
        });
        const joinMiter = button('shape-tool-chip', '尖', '四角の角を尖らせる', () => this._setJoin('miter'));
        const joinRound = button('shape-tool-chip', '丸', '四角の角を丸くする', () => this._setJoin('round'));
        const joinGroup = document.createElement('span');
        joinGroup.className = 'shape-tool-joins';
        joinGroup.append(joinMiter, joinRound);
        const perspective = numberField('遠近', '最後に触った頂点/辺に向かって線が細く(+)/太く(-)なる。ホイールで増減', { min: -90, max: 90, step: 5, unit: '%' }, v => {
            if (this.shape) { this.shape.strength = v; this.render(); }
        });
        row2.append(width.field, joinGroup, perspective.field);

        wrap.append(row1, row2);
        host.appendChild(wrap);
        this.buttons = { wrap, ok, cancel, reset, width, joinMiter, joinRound, joinGroup, perspective };
        return this.buttons;
    }

    _setJoin(join) {
        if (!this.shape) return;
        this.shape.join = join;
        this.areaTools.setOptions({ shape: { join } });
        this.render();
    }

    _syncPanel(shape) {
        const b = this.buttons;
        if (!b) return;
        b.reset.textContent = shape.kind === 'ellipse' ? '正円' : '正方形';
        const setValue = (field, value) => {
            if (document.activeElement !== field.input) field.input.value = String(Math.round(value * 100) / 100);
        };
        setValue(b.width, shape.width);
        setValue(b.perspective, shape.strength);
        b.joinGroup.style.display = shape.kind === 'rect' ? '' : 'none';
        b.joinMiter.classList.toggle('is-active', shape.join === 'miter');
        b.joinRound.classList.toggle('is-active', shape.join === 'round');
    }

    _setHidden(hidden) {
        if (this.parts) {
            Object.values(this.parts).flat().forEach(el => { if (el?.style) el.style.display = hidden ? 'none' : ''; });
            this.parts.g.style.display = hidden ? 'none' : '';
        }
        if (this.buttons) this.buttons.wrap.style.display = hidden ? 'none' : '';
    }

    render() {
        if (!this._ensureParts()) return;
        const shape = this.shape;
        const screen = shape ? this._screenQuad() : null;
        if (!shape || !screen) {
            this._setHidden(true);
            return;
        }
        const { layer, kind } = shape;
        const parts = this.parts;
        this._setHidden(false);
        // 実際の線の見た目（色・太さ・不透明度・遠近）をそのまま重ねて見せる
        const stroke = this._getStroke(shape);
        const d = this._polygons(shape).map(poly => {
            const pts = poly.map(p => this._toScreen(layer, p)).filter(Boolean);
            return pts.length >= 3 ? `M${pts.map(p => `${p.x} ${p.y}`).join('L')}Z` : '';
        }).join('');
        parts.preview.setAttribute('d', d);
        parts.preview.style.fill = `rgb(${stroke.rgb.join(',')})`;
        parts.preview.style.fillOpacity = String(stroke.alpha);
        parts.guide.setAttribute('d', `M${screen.map(p => `${p.x} ${p.y}`).join('L')}Z`);

        const editing = !shape.creating;
        screen.forEach((v, i) => {
            const c = parts.vertices[i];
            c.setAttribute('cx', String(v.x));
            c.setAttribute('cy', String(v.y));
            c.style.display = editing ? '' : 'none';
            c.classList.toggle('is-target', shape.strength !== 0 && shape.target?.type === 'vertex' && shape.target.index === i);
            const next = screen[(i + 1) % 4];
            const e = parts.edges[i];
            e.setAttribute('x', String((v.x + next.x) / 2 - 6));
            e.setAttribute('y', String((v.y + next.y) / 2 - 4));
            e.setAttribute('transform', `rotate(${(Math.atan2(next.y - v.y, next.x - v.x) * 180) / Math.PI} ${(v.x + next.x) / 2} ${(v.y + next.y) / 2})`);
            e.style.display = editing ? '' : 'none';
            e.classList.toggle('is-target', shape.strength !== 0 && (shape.target?.type === 'edge' ? shape.target.index === i : (!shape.target && i === 0)));
        });
        const { mid, handle } = this._rotateHandle(screen);
        parts.stem.setAttribute('x1', String(mid.x));
        parts.stem.setAttribute('y1', String(mid.y));
        parts.stem.setAttribute('x2', String(handle.x));
        parts.stem.setAttribute('y2', String(handle.y));
        parts.rotate.setAttribute('cx', String(handle.x));
        parts.rotate.setAttribute('cy', String(handle.y));
        parts.stem.style.display = editing ? '' : 'none';
        parts.rotate.style.display = editing ? '' : 'none';
        this.system.overlay?.classList.add('is-visible');

        this._placeButtons(screen, editing);
    }

    /** 確定ボタンは図形の外側(右下)に置き、画面の端で隠れるなら反対側へ回り込ませる */
    _placeButtons(screen, editing) {
        const buttons = this._ensureButtons();
        if (!buttons) return;
        buttons.wrap.style.display = editing ? 'flex' : 'none';
        if (!editing) return;
        this._syncPanel(this.shape);
        const host = buttons.wrap.parentElement;
        const area = host?.getBoundingClientRect?.() || { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
        const minX = Math.min(...screen.map(p => p.x));
        const maxX = Math.max(...screen.map(p => p.x));
        const minY = Math.min(...screen.map(p => p.y));
        const maxY = Math.max(...screen.map(p => p.y));
        const width = buttons.wrap.offsetWidth || 96;
        const height = buttons.wrap.offsetHeight || 34;
        const gap = 16;
        let x = maxX + gap;
        let y = maxY + gap;
        if (x + width > area.right - 4) x = minX - gap - width;
        if (y + height > area.bottom - 4) y = minY - gap - height;
        x = Math.max(area.left + 4, Math.min(area.right - width - 4, x));
        y = Math.max(area.top + 4, Math.min(area.bottom - height - 4, y));
        if (buttons.wrap.dataset.moved === '1') return;
        buttons.wrap.style.left = `${x}px`;
        buttons.wrap.style.top = `${y}px`;
    }

    destroy() {
        this.parts?.g?.remove?.();
        this.detachDrag?.();
        this.buttons?.wrap?.remove?.();
        this.parts = null;
        this.buttons = null;
    }
}
