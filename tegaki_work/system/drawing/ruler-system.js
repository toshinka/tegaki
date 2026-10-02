/**
 * ============================================================================
 * ファイル名: system/drawing/ruler-system.js
 * 責務: 定規(平行線 / 放射線)の状態・ガイド表示・stroke座標の吸着・Shift+ドラッグでの定規編集。
 * 依存: Pixi Graphics、CameraSystem.worldContainer(文書座標)、CoordinateSystem
 * 被依存: brush-core.js(吸着)、drawing-engine.js(編集ドラッグの振り分け)、keyboard-handler.js(R / Shift+R)
 * 非所有: Layer raster、History、保存(定規状態はブラウザ毎の利便設定としてlocalStorageに置く)。
 *
 * 純幾何(吸着の射影・つかみ判定・角度スナップ・保存値のsanitize・ガイド線分)は system/ruler-geometry.js。
 * ガイドはworldContainerの子として描くため書き出しには含まれない。色はふたば配色(styles/main.css のtoken値)。
 * ============================================================================
 */

import { Graphics } from 'pixi.js';
import {
    RULER_TYPES,
    RULER_TYPE_LABELS,
    RULER_ROTATION_RING_SCREEN_PX,
    applyRulerDrag,
    buildRulerGuideSegments,
    perspectiveHandleDistance,
    resolveRulerGrab,
    sanitizeRulerOptions,
    sanitizeRulerState,
    snapPointToRuler
} from '../ruler-geometry.js';

export { RULER_TYPES, snapPointToRuler };

const STORAGE_KEY = 'tegaki-ruler-state-v1';
// main.css: --futaba-maroon / --futaba-medium / --futaba-cream / --active-border
const GUIDE_COLOR = 0x800000;
const GUIDE_SUB_COLOR = 0xb8706b;
const HANDLE_FILL_COLOR = 0xf0e0d6;
const ROTATE_COLOR = 0xff8c42;

export class RulerSystem {
    constructor({ cameraSystem, coordinateSystem, eventBus = null, config = null } = {}) {
        this.cameraSystem = cameraSystem;
        this.coordinateSystem = coordinateSystem;
        this.eventBus = eventBus;
        this.config = config;
        const canvas = config?.canvas || window.TEGAKI_CONFIG?.canvas || { width: 400, height: 400 };
        this.state = {
            enabled: false,
            type: 'parallel',
            center: { x: canvas.width / 2, y: canvas.height / 2 },
            angle: 0,
            ...sanitizeRulerOptions(null)
        };
        this._loadState();
        this.anchor = null;
        this.shiftHeld = false;
        this.drag = null;
        this.overlay = null;
    }

    init() {
        const world = this.cameraSystem?.worldContainer;
        if (world && !this.overlay) {
            this.overlay = new Graphics();
            this.overlay.label = 'rulerGuide';
            this.overlay.eventMode = 'none';
            world.addChild(this.overlay);
        }
        if (typeof window !== 'undefined') {
            const setShiftHeld = (held) => {
                if (held !== this.shiftHeld) {
                    this.shiftHeld = held;
                    this.redraw();
                }
            };
            // Shift自体のkeyupはshiftKeyがtrueのまま届く環境があるため、keyで判定する。
            const onKey = (e) => setShiftHeld(e.key === 'Shift' ? e.type === 'keydown' : e.shiftKey === true);
            window.addEventListener('keydown', onKey, true);
            window.addEventListener('keyup', onKey, true);
            // 別窓でShiftを離すなどkeyupを取り逃した場合も、次のポインタ移動で表示を戻す。
            window.addEventListener('pointermove', (e) => setShiftHeld(e.shiftKey === true), { capture: true, passive: true });
            window.addEventListener('blur', () => {
                this.shiftHeld = false;
                this.redraw();
            });
        }
        // 表示倍率が変わったらガイドの線幅・ハンドル寸法を画面基準で描き直す。
        this.eventBus?.on?.('camera:transform-changed', () => this.redraw());
        this.eventBus?.on?.('camera:resized', ({ width, height } = {}) => {
            if (Number.isFinite(width) && Number.isFinite(height) && !this._hasStoredCenter) {
                this.state.center = { x: width / 2, y: height / 2 };
            }
            this.redraw();
        });
        this.redraw();
    }

    isEnabled() {
        return this.state.enabled === true;
    }

    toggle() {
        this.state.enabled = !this.state.enabled;
        this._saveState();
        this.redraw();
        this._announce(this.state.enabled ? `${RULER_TYPE_LABELS[this.state.type]} ON（Shift+ドラッグで移動・回転 / Alt+Rで設定）` : '定規 OFF');
        this.eventBus?.emit?.('ruler:changed', { ...this.getState() });
        return this.state.enabled;
    }

    cycleType() {
        const index = RULER_TYPES.indexOf(this.state.type);
        this.state.type = RULER_TYPES[(index + 1) % RULER_TYPES.length];
        if (!this.state.enabled) this.state.enabled = true;
        this._saveState();
        this.redraw();
        this._announce(`${RULER_TYPE_LABELS[this.state.type]}`);
        this.eventBus?.emit?.('ruler:changed', { ...this.getState() });
        return this.state.type;
    }

    getState() {
        return {
            enabled: this.state.enabled,
            type: this.state.type,
            center: { ...this.state.center },
            angle: this.state.angle,
            spacing: this.state.spacing,
            spokes: this.state.spokes,
            angleSnap: this.state.angleSnap,
            perspective: this.state.perspective,
            showGuides: this.state.showGuides
        };
    }

    /**
     * ミニパネルなど外部からの状態変更。値はsanitizeしてから反映し、保存・再描画・通知まで行う。
     * @param {{enabled?: boolean, type?: string, angle?: number, center?: {x:number,y:number}, spacing?: number, spokes?: number, angleSnap?: number, showGuides?: boolean}} patch
     */
    setState(patch = {}) {
        const canvas = window.TEGAKI_CONFIG?.canvas;
        if (typeof patch.enabled === 'boolean') this.state.enabled = patch.enabled;
        const base = sanitizeRulerState({
            type: patch.type ?? this.state.type,
            angle: patch.angle ?? this.state.angle,
            center: patch.center ?? this.state.center
        }, canvas);
        this.state.type = base.type;
        this.state.angle = base.angle;
        if (base.center) {
            this.state.center = base.center;
            if (patch.center) this._hasStoredCenter = true;
        }
        Object.assign(this.state, sanitizeRulerOptions({ ...this.state, ...patch }));
        this._saveState();
        this.redraw();
        this.eventBus?.emit?.('ruler:changed', { ...this.getState() });
        return this.getState();
    }

    // ---------------------------------------------------------------- 吸着

    /**
     * stroke座標(world)を定規へ吸着する。phase='start'で描き始めの点(anchor)を記録する。
     */
    snapWorld(worldX, worldY, phase = 'move') {
        if (!this.isEnabled()) {
            this.anchor = null;
            return { worldX, worldY };
        }
        if (phase === 'start' || !this.anchor) {
            this.anchor = { x: worldX, y: worldY };
            return { worldX, worldY };
        }
        const snapped = snapPointToRuler(this.state, this.anchor, { x: worldX, y: worldY }, window.TEGAKI_CONFIG?.canvas);
        return { worldX: snapped.x, worldY: snapped.y };
    }

    // ---------------------------------------------------------------- 編集(Shift+ドラッグ)

    /** Shift+押下を定規編集として受けたらtrue(描画は始めない)。 */
    handlePointerDown(info, event) {
        if (!this.isEnabled() || event?.shiftKey !== true) return false;
        // 定規の操作は線補正(LazyBrush)を通さない生のペン位置で追従させる。
        const world = this._clientToWorld(info.rawClientX ?? info.clientX, info.rawClientY ?? info.clientY);
        if (!world) return false;
        this.drag = resolveRulerGrab(this.state, world, this._getScreenScale());
        this.redraw();
        return true;
    }

    handlePointerMove(info, event) {
        if (!this.drag) return false;
        // 定規の操作は線補正(LazyBrush)を通さない生のペン位置で追従させる。
        const world = this._clientToWorld(info.rawClientX ?? info.clientX, info.rawClientY ?? info.clientY);
        if (!world) return true;
        const next = applyRulerDrag(this.state, this.drag, world, { snapAngle: event?.ctrlKey || event?.metaKey });
        this.state.center = next.center;
        this.state.angle = next.angle;
        if (this.drag.kind === 'perspective') this.state.perspective = next.perspective;
        if (this.drag.kind === 'move') this._hasStoredCenter = true;
        this.redraw();
        // ミニパネルの数値をドラッグ中も追従させる(popup側でrAFに合体される)
        this.eventBus?.emit?.('ruler:changed', { ...this.getState() });
        return true;
    }

    handlePointerUp() {
        if (!this.drag) return false;
        this.drag = null;
        this._saveState();
        this.redraw();
        this.eventBus?.emit?.('ruler:changed', { ...this.getState() });
        return true;
    }

    isDragging() {
        return this.drag !== null;
    }

    // ---------------------------------------------------------------- 表示

    redraw() {
        const g = this.overlay;
        if (!g) return;
        g.clear();
        if (!this.isEnabled()) return;

        const scale = this._getScreenScale();
        const px = (value) => value / scale;
        const canvas = window.TEGAKI_CONFIG?.canvas || { width: 400, height: 400 };
        const { x: cx, y: cy } = this.state.center;
        // ガイド線は非表示にできる(吸着は有効のまま)。中心点とShift中のハンドルは常に出す。
        if (this.state.showGuides !== false) {
            const { lines, main } = buildRulerGuideSegments(this.state, canvas, scale);
            for (const [x1, y1, x2, y2] of lines) {
                g.moveTo(x1, y1);
                g.lineTo(x2, y2);
            }
            g.stroke({ width: px(1), color: main ? GUIDE_SUB_COLOR : GUIDE_COLOR, alpha: main ? 0.4 : 0.3 });
            if (main) {
                g.moveTo(main[0], main[1]);
                g.lineTo(main[2], main[3]);
                g.stroke({ width: px(1.5), color: GUIDE_COLOR, alpha: 0.6 });
            }
        }

        // 中心点(常時)と、Shift中は操作ハンドル(中心=移動、外周リング=回転)。
        const editing = this.shiftHeld || this.drag;
        g.circle(cx, cy, px(editing ? 7 : 4));
        g.fill({ color: HANDLE_FILL_COLOR, alpha: 0.9 });
        g.stroke({ width: px(1.5), color: GUIDE_COLOR, alpha: 1 });
        if (editing) {
            g.moveTo(cx - px(11), cy);
            g.lineTo(cx + px(11), cy);
            g.moveTo(cx, cy - px(11));
            g.lineTo(cx, cy + px(11));
            g.stroke({ width: px(1.5), color: GUIDE_COLOR, alpha: 1 });
            if (this.state.type === 'parallel') {
                g.circle(cx, cy, px(RULER_ROTATION_RING_SCREEN_PX));
                g.stroke({ width: px(2), color: ROTATE_COLOR, alpha: 0.85 });
                // 回転方向の目印(定規の向き)
                const hx = cx + Math.cos(this.state.angle) * px(RULER_ROTATION_RING_SCREEN_PX);
                const hy = cy + Math.sin(this.state.angle) * px(RULER_ROTATION_RING_SCREEN_PX);
                g.circle(hx, hy, px(6));
                g.fill({ color: ROTATE_COLOR, alpha: 1 });
                // 遠近ハンドル（反対側の中心線上）と、リング上の吸着位置の目印
                const ux = -Math.cos(this.state.angle);
                const uy = -Math.sin(this.state.angle);
                const R = px(RULER_ROTATION_RING_SCREEN_PX);
                g.circle(cx + ux * R, cy + uy * R, px(3));
                g.stroke({ width: px(1.5), color: GUIDE_COLOR, alpha: 0.7 });
                const hd = px(perspectiveHandleDistance(this.state.perspective));
                g.circle(cx + ux * hd, cy + uy * hd, px(6));
                g.fill({ color: GUIDE_SUB_COLOR, alpha: 1 });
                g.stroke({ width: px(1.5), color: GUIDE_COLOR, alpha: 1 });
            }
        }
    }

    // ---------------------------------------------------------------- 内部

    _getScreenScale() {
        const scale = this.cameraSystem?.worldContainer?.scale;
        const value = Math.abs(Number(scale?.x ?? 1));
        return Number.isFinite(value) && value > 0 ? value : 1;
    }

    _clientToWorld(clientX, clientY) {
        const cs = this.coordinateSystem;
        if (!cs || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;
        const { canvasX, canvasY } = cs.screenClientToCanvas(clientX, clientY);
        const { worldX, worldY } = cs.canvasToWorld(canvasX, canvasY);
        return { x: worldX, y: worldY };
    }

    _announce(message) {
        import('../../ui/feedback-toast.js')
            .then(({ showFeedbackToast }) => showFeedbackToast?.(message))
            .catch(() => {});
    }

    _loadState() {
        try {
            const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
            if (!raw) return;
            // 起動直後に吸着が効いていると驚くため、ON/OFFは保存しない(常にOFFで起動)。
            const saved = sanitizeRulerState(raw, window.TEGAKI_CONFIG?.canvas);
            this.state.type = saved.type;
            this.state.angle = saved.angle;
            Object.assign(this.state, sanitizeRulerOptions(raw));
            if (saved.center) {
                this.state.center = saved.center;
                this._hasStoredCenter = true;
            }
        } catch (_error) {
            // localStorageが使えない・壊れた値の場合は既定値のまま
        }
    }

    _saveState() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                type: this.state.type,
                angle: this.state.angle,
                center: this.state.center,
                spacing: this.state.spacing,
                spokes: this.state.spokes,
                angleSnap: this.state.angleSnap,
                perspective: this.state.perspective,
                showGuides: this.state.showGuides
            }));
        } catch (_error) {
            // 保存できなくても動作は継続
        }
    }
}
