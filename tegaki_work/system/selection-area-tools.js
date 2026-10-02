/**
 * ============================================================================
 * ファイル名: system/selection-area-tools.js
 * 責務: 選択ツールの「自動選択」「グラデーション」モード。クリックで領域をマスク選択し、ドラッグでグラデーションを塗る
 * 依存: system/auto-select.js, system/gradient-fill.js, system/pixel-selection-system.js(所有者), ui/feedback-toast.js
 * 被依存: system/pixel-selection-system.js
 * 公開API: AreaToolController, SELECTION_TOOL_MODES, toolNameToSelectionMode
 * 保存: UI設定のみ(localStorage 'tegaki-area-tools-v1')。選択は一時状態、グラデーションは通常のRaster画素 + History 1件。
 * 実装状態: ✅実装
 *
 * 位置づけ: 選択ツールの入力経路(canvasのcaptureでの入力横取り、描画エンジンの停止、tool切替での解除)をそのまま使う。
 *   新しい描画モードをペン系パイプラインへ足さず、確定時に画素を一度だけ書く。
 * ============================================================================
 */

import { floodSelectRegion, traceMaskOutline, AUTO_SELECT_LIMITS } from './auto-select.js';
import { applyGradientToPixels } from './gradient-fill.js';
import { normalizeRasterBounds } from './raster-bounds.js';
import { estimateRasterHistoryPairBytes } from './raster-snapshot-memory.js';
import { showFeedbackToast } from '../ui/feedback-toast.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const STORAGE_KEY = 'tegaki-area-tools-v1';

export const SELECTION_TOOL_MODES = Object.freeze(['rect', 'auto', 'gradient']);

const TOOL_TO_MODE = Object.freeze({ selection: 'rect', 'auto-select': 'auto', gradient: 'gradient' });
export function toolNameToSelectionMode(tool) {
    return TOOL_TO_MODE[tool] || null;
}

function hexToRgb(value) {
    const n = Number(value);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export class AreaToolController {
    constructor(system) {
        this.system = system;
        this.options = {
            auto: { tolerance: AUTO_SELECT_LIMITS.tolerance.default, referenceAll: false, contiguous: true },
            gradient: { kind: 'linear', fade: 'sub' } // fade: 'sub'=メイン→サブ色 / 'transparent'=メイン→透明
        };
        this.gradientDrag = null;
        this.maskImage = null;
        this.guideLine = null;
        this._restore();
    }

    _restore() {
        try {
            const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
            if (!data) return;
            const t = Number(data.auto?.tolerance);
            if (Number.isFinite(t)) this.options.auto.tolerance = Math.max(0, Math.min(AUTO_SELECT_LIMITS.tolerance.max, Math.round(t)));
            if (typeof data.auto?.referenceAll === 'boolean') this.options.auto.referenceAll = data.auto.referenceAll;
            if (typeof data.auto?.contiguous === 'boolean') this.options.auto.contiguous = data.auto.contiguous;
            if (['linear', 'radial'].includes(data.gradient?.kind)) this.options.gradient.kind = data.gradient.kind;
            if (['sub', 'transparent'].includes(data.gradient?.fade)) this.options.gradient.fade = data.gradient.fade;
        } catch (error) {
            // 壊れた設定は既定へ
        }
    }

    _persist() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.options));
        } catch (error) {
            // 保存不可でも動作は続ける
        }
    }

    setOptions(patch = {}) {
        if (patch.auto) Object.assign(this.options.auto, patch.auto);
        if (patch.gradient) Object.assign(this.options.gradient, patch.gradient);
        this._persist();
        this.system.eventBus?.emit('selection:area-options-changed', JSON.parse(JSON.stringify(this.options)));
    }

    getOptions() {
        return JSON.parse(JSON.stringify(this.options));
    }

    // ------------------------------------------------------------ 色

    getColors() {
        const qa = window.coreEngine?.popupManager?.get?.('quickAccess');
        const main = Number.isFinite(qa?.mainColor) ? qa.mainColor : (window.brushSettings?.getColor?.() ?? 0x800000);
        const sub = Number.isFinite(qa?.subColor) ? qa.subColor : 0xf0e0d6;
        return { main: hexToRgb(main), sub: hexToRgb(sub) };
    }

    // ------------------------------------------------------------ 入力(selection systemから呼ばれる)

    pointerDown(event, target, point) {
        const mode = this.system.toolMode;
        if (target.kind !== 'layer') {
            showFeedbackToast('フォルダでは使えません。Raster Layerを選んでください');
            return false;
        }
        if (mode === 'auto') {
            this.autoSelect(event, target, point);
            return true;
        }
        if (mode === 'gradient') {
            this.gradientDrag = { pointerId: event.pointerId, layer: target.layer, start: point, current: point };
            try { this.system.canvas?.setPointerCapture?.(event.pointerId); } catch (error) { /* 任意 */ }
            this.renderOverlay();
            return true;
        }
        return false;
    }

    pointerMove(event) {
        const drag = this.gradientDrag;
        if (!drag || event.pointerId !== drag.pointerId) return false;
        const point = this.system._clientToLayerPoint(event.clientX, event.clientY, drag.layer);
        if (point) drag.current = point;
        this.renderOverlay();
        return true;
    }

    pointerUp(event) {
        const drag = this.gradientDrag;
        if (!drag || event.pointerId !== drag.pointerId) return false;
        this.gradientDrag = null;
        try { this.system.canvas?.releasePointerCapture?.(event.pointerId); } catch (error) { /* 任意 */ }
        this.renderOverlay();
        if (Math.hypot(drag.current.x - drag.start.x, drag.current.y - drag.start.y) >= 3) {
            this.applyGradient(drag.layer, drag.start, drag.current);
        }
        return true;
    }

    pointerCancel(event) {
        const drag = this.gradientDrag;
        if (!drag || event.pointerId !== drag.pointerId) return false;
        this.gradientDrag = null;
        this.renderOverlay();
        return true;
    }

    // ------------------------------------------------------------ 自動選択

    async autoSelect(event, target, point) {
        const system = this.system;
        const layer = target.layer;
        const opts = this.options.auto;
        let source = null;
        let originX = 0;
        let originY = 0;
        if (opts.referenceAll && system.layerSystem?.createCompositeDrawingSnapshot) {
            source = await system.layerSystem.createCompositeDrawingSnapshot();
        } else {
            source = system.layerSystem?.createLayerRasterSnapshot?.(layer);
            if (source) {
                const rb = normalizeRasterBounds(source.rasterBounds, { width: source.width, height: source.height });
                originX = rb.x;
                originY = rb.y;
            }
        }
        if (!source?.pixels) {
            showFeedbackToast('自動選択に使う画像を取得できません');
            return false;
        }
        const result = floodSelectRegion({
            pixels: source.pixels,
            width: source.width,
            height: source.height,
            seedX: point.x,
            seedY: point.y,
            originX,
            originY,
            tolerance: opts.tolerance,
            contiguous: opts.contiguous
        });
        if (!result.ok) {
            showFeedbackToast(result.reason === 'seed-outside'
                ? 'レイヤーの描画範囲の外です（「全レイヤー参照」で背景も対象にできます）'
                : '選択できる領域がありません');
            return false;
        }
        system.setMaskSelection(layer.layerData.id, result.bounds, result.mask);
        return true;
    }

    // ------------------------------------------------------------ グラデーション

    applyGradient(layer, start, end) {
        const system = this.system;
        const layerSystem = system.layerSystem;
        const layerData = layer?.layerData;
        if (!layerData?.renderTexture || layerData.isAnimationWorkingLayer === true) {
            showFeedbackToast('このレイヤーにはグラデーションを塗れません');
            return false;
        }
        // 範囲: このレイヤーの選択(矩形/マスク)があればその中、なければレイヤー全面(キャンバス)
        const hasSel = system.hasSelection() && system.state.layerId === layerData.id && system.state.scope?.kind !== 'folder';
        const canvasCfg = layerSystem?.config?.canvas || window.TEGAKI_CONFIG?.canvas || {};
        const region = hasSel
            ? { bounds: { ...system.state.bounds }, mask: system.state.mask || null }
            : { bounds: { x: 0, y: 0, width: Math.round(canvasCfg.width || 0), height: Math.round(canvasCfg.height || 0) }, mask: null };
        if (!(region.bounds.width > 0 && region.bounds.height > 0)) return false;

        // 描く範囲までRasterを広げてからsnapshot(履歴のbeforeは広げた後)
        const expanded = layerSystem.ensureLayerRasterBoundsForRect?.(layer, region.bounds, { padding: 0 });
        if (expanded?.ok === false) {
            showFeedbackToast('描画範囲を広げられません（サイズ上限）');
            return false;
        }
        const before = layerSystem.createLayerRasterSnapshot(layer);
        if (!before?.pixels) return false;
        const after = { ...before, pixels: new Uint8ClampedArray(before.pixels), paths: [], pathsData: [] };
        const rb = normalizeRasterBounds(before.rasterBounds, { width: before.width, height: before.height });

        const colors = this.getColors();
        const fadeToTransparent = this.options.gradient.fade === 'transparent';
        const colorA = [...colors.main, 255];
        const colorB = fadeToTransparent ? [...colors.main, 0] : [...colors.sub, 255];
        const changed = applyGradientToPixels(
            { pixels: after.pixels, width: after.width, height: after.height, originX: rb.x, originY: rb.y },
            { kind: this.options.gradient.kind, start, end, colorA, colorB },
            region
        );
        if (changed === 0) {
            showFeedbackToast('塗る範囲がありません');
            return false;
        }
        if (!layerSystem.restoreLayerRasterSnapshot(after)) return false;

        const layerId = layerData.id;
        const retainedMemory = estimateRasterHistoryPairBytes(before, after);
        const restore = snapshot => {
            layerSystem.restoreLayerRasterSnapshot(snapshot);
            layerSystem.refreshClippingMasks?.();
            system.eventBus?.emit('layer:content-changed', { layerId, source: 'gradient-fill' });
        };
        system.history.record({
            name: 'gradient-fill',
            do: () => restore(after),
            undo: () => restore(before),
            byteSize: retainedMemory.estimatedBytes,
            meta: { type: 'gradient-fill', layerId, kind: this.options.gradient.kind, retainedMemory }
        });
        layerSystem.refreshClippingMasks?.();
        system.eventBus?.emit('layer:content-changed', { layerId, source: 'gradient-fill' });
        return true;
    }

    // ------------------------------------------------------------ 重ね表示(マスクの色付き表示 / グラデーションのガイド線)

    _ensureOverlayParts() {
        const svg = this.system.overlay;
        if (!svg || this.maskImage || typeof svg.insertBefore !== 'function') return;
        const image = document.createElementNS(SVG_NS, 'image');
        image.classList.add('pixel-selection-mask');
        image.setAttribute('preserveAspectRatio', 'none');
        image.style.display = 'none';
        svg.insertBefore(image, svg.firstChild);
        const line = document.createElementNS(SVG_NS, 'line');
        line.classList.add('pixel-selection-gradient-guide');
        line.style.display = 'none';
        svg.appendChild(line);
        const outline = document.createElementNS(SVG_NS, 'path');
        outline.classList.add('pixel-selection-ants');
        outline.style.display = 'none';
        svg.appendChild(outline);
        this.maskImage = image;
        this.guideLine = line;
        this.outlinePath = outline;
    }

    /** 選択マスクを半透明の色で重ねる。layer-local座標の3点をscreenへ写してmatrixにする。 */
    renderMask(context) {
        this._ensureOverlayParts();
        const image = this.maskImage;
        if (!image) return;
        const state = this.system.state;
        if (!state?.mask || !context) {
            image.style.display = 'none';
            if (this.outlinePath) this.outlinePath.style.display = 'none';
            return;
        }
        const b = state.bounds;
        if (this._maskUrlFor !== state.mask) {
            const canvas = document.createElement('canvas');
            canvas.width = b.width;
            canvas.height = b.height;
            const ctx = canvas.getContext('2d');
            const data = ctx.createImageData(b.width, b.height);
            for (let i = 0; i < state.mask.length; i += 1) {
                if (state.mask[i] === 1) { data.data[i * 4] = 255; data.data[i * 4 + 1] = 140; data.data[i * 4 + 2] = 66; data.data[i * 4 + 3] = 56; }
            }
            ctx.putImageData(data, 0, 0);
            this._maskUrl = canvas.toDataURL('image/png');
            this._maskUrlFor = state.mask;
        }
        const toScreen = ({ x, y }) => this.system._layerPointToScreen(context.layer, x, y);
        const p0 = toScreen({ x: b.x, y: b.y });
        const p1 = toScreen({ x: b.x + b.width, y: b.y });
        const p2 = toScreen({ x: b.x, y: b.y + b.height });
        if (![p0, p1, p2].every(p => Number.isFinite(p?.clientX) && Number.isFinite(p?.clientY))) {
            image.style.display = 'none';
            return;
        }
        const a = (p1.clientX - p0.clientX) / b.width;
        const bb = (p1.clientY - p0.clientY) / b.width;
        const c = (p2.clientX - p0.clientX) / b.height;
        const d = (p2.clientY - p0.clientY) / b.height;
        const matrix = `matrix(${a} ${bb} ${c} ${d} ${p0.clientX} ${p0.clientY})`;
        image.setAttribute('href', this._maskUrl);
        image.setAttribute('width', String(b.width));
        image.setAttribute('height', String(b.height));
        image.setAttribute('transform', matrix);
        image.style.display = '';

        // 形に沿った選択線(蟻の行列)。輪郭は選択ごとに一度だけ求め、カメラ移動ではmatrixだけ更新する。
        if (this._outlineFor !== state.mask) {
            const traced = traceMaskOutline(state.mask, b.width, b.height);
            this._outlineD = traced.ok
                ? traced.loops.map(loop => `M${loop.map(([x, y]) => `${x} ${y}`).join('L')}Z`).join('')
                : `M0 0H${b.width}V${b.height}H0Z`; // 複雑すぎるときは外接矩形
            this._outlineFor = state.mask;
        }
        const path = this.outlinePath;
        path.setAttribute('d', this._outlineD);
        path.setAttribute('transform', matrix);
        path.style.display = '';
    }

    renderOverlay() {
        this._ensureOverlayParts();
        const line = this.guideLine;
        if (!line) return;
        const drag = this.gradientDrag;
        if (!drag) {
            line.style.display = 'none';
            return;
        }
        const s = this.system._layerPointToScreen(drag.layer, drag.start.x, drag.start.y);
        const e = this.system._layerPointToScreen(drag.layer, drag.current.x, drag.current.y);
        if (![s, e].every(p => Number.isFinite(p?.clientX) && Number.isFinite(p?.clientY))) {
            line.style.display = 'none';
            return;
        }
        line.setAttribute('x1', String(s.clientX));
        line.setAttribute('y1', String(s.clientY));
        line.setAttribute('x2', String(e.clientX));
        line.setAttribute('y2', String(e.clientY));
        line.style.display = '';
        this.system.overlay?.classList.add('is-visible');
    }
}
