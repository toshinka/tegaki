/**
 * ============================================================================
 * ファイル名: system/drawing/ruler-system.js
 * 責務: 定規(平行線 / 放射線)の状態・ガイド表示・stroke座標の吸着・Shift+ドラッグでの定規編集。
 * 依存: Pixi Graphics、CameraSystem.worldContainer(文書座標)、CoordinateSystem
 * 被依存: brush-core.js(吸着)、drawing-engine.js(編集ドラッグの振り分け)、keyboard-handler.js(R / Shift+R)
 * 非所有: Layer raster、History、保存(定規状態はブラウザ毎の利便設定としてlocalStorageに置く)。
 *
 * 座標はすべて文書(world)座標。ガイドはworldContainerの子として描くため書き出しには含まれない。
 * 吸着は「描き始めの点を通り、定規の方向に沿う直線」へ以後の点を射影する(クリスタの特殊定規と同じ考え方)。
 *   平行線: 方向 = 定規の角度
 *   放射線: 方向 = 中心→描き始めの点(集中線)
 * ============================================================================
 */

import { Graphics } from 'pixi.js';

export const RULER_TYPES = ['parallel', 'radial'];
const RULER_TYPE_LABELS = { parallel: '平行線定規', radial: '放射線定規（集中線）' };
const STORAGE_KEY = 'tegaki-ruler-state-v1';
const CENTER_HANDLE_SCREEN_PX = 14;
const ROTATION_RING_SCREEN_PX = 70;
const ANGLE_SNAP_DEG = 15;

const clampAngle = (angle) => {
    const turn = Math.PI * 2;
    return ((angle % turn) + turn) % turn;
};

/**
 * 定規への吸着(純粋関数)。anchorを通り、定規が決める方向の直線へpointを射影する。
 * @returns {{x:number, y:number}}
 */
export function snapPointToRuler(state, anchor, point) {
    if (!state?.enabled || !anchor || !point) return point;
    let dirX;
    let dirY;
    if (state.type === 'radial') {
        dirX = anchor.x - state.center.x;
        dirY = anchor.y - state.center.y;
        const length = Math.hypot(dirX, dirY);
        // 中心そのものから描き始めた場合は方向が決まらないため吸着しない。
        if (!(length > 1e-6)) return point;
        dirX /= length;
        dirY /= length;
    } else {
        dirX = Math.cos(state.angle);
        dirY = Math.sin(state.angle);
    }
    const t = (point.x - anchor.x) * dirX + (point.y - anchor.y) * dirY;
    return { x: anchor.x + dirX * t, y: anchor.y + dirY * t };
}

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
            angle: 0
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
            const onKey = (e) => {
                const held = e.shiftKey === true;
                if (held !== this.shiftHeld) {
                    this.shiftHeld = held;
                    this.redraw();
                }
            };
            window.addEventListener('keydown', onKey, true);
            window.addEventListener('keyup', onKey, true);
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
        this._announce(this.state.enabled ? `${RULER_TYPE_LABELS[this.state.type]} ON（Shift+ドラッグで移動・回転）` : '定規 OFF');
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
            angle: this.state.angle
        };
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
        const snapped = snapPointToRuler(this.state, this.anchor, { x: worldX, y: worldY });
        return { worldX: snapped.x, worldY: snapped.y };
    }

    // ---------------------------------------------------------------- 編集(Shift+ドラッグ)

    /** Shift+押下を定規編集として受けたらtrue(描画は始めない)。 */
    handlePointerDown(info, event) {
        if (!this.isEnabled() || event?.shiftKey !== true) return false;
        // 定規の操作は線補正(LazyBrush)を通さない生のペン位置で追従させる。
        const world = this._clientToWorld(info.rawClientX ?? info.clientX, info.rawClientY ?? info.clientY);
        if (!world) return false;
        const scale = this._getScreenScale();
        const distancePx = Math.hypot(world.x - this.state.center.x, world.y - this.state.center.y) * scale;
        if (distancePx <= CENTER_HANDLE_SCREEN_PX || this.state.type === 'radial') {
            this.drag = {
                kind: 'move',
                offsetX: this.state.center.x - world.x,
                offsetY: this.state.center.y - world.y
            };
        } else {
            const grabAngle = Math.atan2(world.y - this.state.center.y, world.x - this.state.center.x);
            this.drag = { kind: 'rotate', grabOffset: this.state.angle - grabAngle };
        }
        this.redraw();
        return true;
    }

    handlePointerMove(info, event) {
        if (!this.drag) return false;
        // 定規の操作は線補正(LazyBrush)を通さない生のペン位置で追従させる。
        const world = this._clientToWorld(info.rawClientX ?? info.clientX, info.rawClientY ?? info.clientY);
        if (!world) return true;
        if (this.drag.kind === 'move') {
            this.state.center = { x: world.x + this.drag.offsetX, y: world.y + this.drag.offsetY };
            this._hasStoredCenter = true;
        } else {
            let angle = Math.atan2(world.y - this.state.center.y, world.x - this.state.center.x) + this.drag.grabOffset;
            if (event?.ctrlKey || event?.metaKey) {
                const step = (ANGLE_SNAP_DEG * Math.PI) / 180;
                angle = Math.round(angle / step) * step;
            }
            this.state.angle = clampAngle(angle);
        }
        this.redraw();
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
        const reach = Math.hypot(canvas.width, canvas.height) + Math.hypot(this.state.center.x, this.state.center.y);
        const { x: cx, y: cy } = this.state.center;
        const guideColor = 0x3d8fd1;

        if (this.state.type === 'radial') {
            const spokes = 48;
            for (let i = 0; i < spokes; i++) {
                const a = (i / spokes) * Math.PI * 2;
                g.moveTo(cx, cy);
                g.lineTo(cx + Math.cos(a) * reach, cy + Math.sin(a) * reach);
            }
            g.stroke({ width: px(1), color: guideColor, alpha: 0.28 });
        } else {
            const dirX = Math.cos(this.state.angle);
            const dirY = Math.sin(this.state.angle);
            const normalX = -dirY;
            const normalY = dirX;
            const spacing = px(48);
            const count = Math.ceil(reach / spacing);
            for (let i = -count; i <= count; i++) {
                const ox = cx + normalX * spacing * i;
                const oy = cy + normalY * spacing * i;
                g.moveTo(ox - dirX * reach, oy - dirY * reach);
                g.lineTo(ox + dirX * reach, oy + dirY * reach);
            }
            g.stroke({ width: px(1), color: guideColor, alpha: 0.22 });
            g.moveTo(cx - dirX * reach, cy - dirY * reach);
            g.lineTo(cx + dirX * reach, cy + dirY * reach);
            g.stroke({ width: px(1.5), color: guideColor, alpha: 0.55 });
        }

        // 中心点(常時)と、Shift中は操作ハンドル(中心=移動、外周リング=回転)。
        const editing = this.shiftHeld || this.drag;
        g.circle(cx, cy, px(editing ? 7 : 4));
        g.fill({ color: 0xffffff, alpha: 0.9 });
        g.stroke({ width: px(1.5), color: guideColor, alpha: 1 });
        if (editing) {
            g.moveTo(cx - px(11), cy);
            g.lineTo(cx + px(11), cy);
            g.moveTo(cx, cy - px(11));
            g.lineTo(cx, cy + px(11));
            g.stroke({ width: px(1.5), color: guideColor, alpha: 1 });
            if (this.state.type === 'parallel') {
                g.circle(cx, cy, px(ROTATION_RING_SCREEN_PX));
                g.stroke({ width: px(2), color: 0xff8c42, alpha: 0.85 });
                // 回転方向の目印(定規の向き)
                const hx = cx + Math.cos(this.state.angle) * px(ROTATION_RING_SCREEN_PX);
                const hy = cy + Math.sin(this.state.angle) * px(ROTATION_RING_SCREEN_PX);
                g.circle(hx, hy, px(6));
                g.fill({ color: 0xff8c42, alpha: 1 });
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
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
            if (!saved) return;
            if (RULER_TYPES.includes(saved.type)) this.state.type = saved.type;
            if (Number.isFinite(saved.angle)) this.state.angle = clampAngle(saved.angle);
            if (Number.isFinite(saved.center?.x) && Number.isFinite(saved.center?.y)) {
                this.state.center = { x: saved.center.x, y: saved.center.y };
                this._hasStoredCenter = true;
            }
            // 起動直後に吸着が効いていると驚くため、ON/OFFは保存しない(常にOFFで起動)。
        } catch (_error) {
            // localStorageが使えない環境では既定値のまま
        }
    }

    _saveState() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                type: this.state.type,
                angle: this.state.angle,
                center: this.state.center
            }));
        } catch (_error) {
            // 保存できなくても動作は継続
        }
    }
}
