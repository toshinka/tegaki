/**
 * ROLE: WP-032 End bone の pointer/keyboard gesture と取消/commit state machine。
 * AUTHORITY: gesture phase と表示候補だけ。source、PNG、Project、Historyは所有しない。
 * INVARIANTS: ready時だけ開始、preview中はcompile 0、commit/cancelは一度だけ、遅延応答で取消状態を戻さない。
 * RELATED: bone-projection.mjs、editor.js、editor.html、WP-032。
 */
import { angleForScreenPoint, clampBoneAngle } from './bone-projection.mjs';

export const BONE_EDITOR_PHASE = Object.freeze({ idle: 'idle', preview: 'preview', commit: 'commit' });

function copySession(session) {
    if (!session) return null;
    return {
        id: session.id,
        phase: session.phase,
        selectedBone: session.selectedBone,
        originalAngle: session.originalAngle,
        originalProgress: session.originalProgress,
        originalDirty: session.originalDirty === true,
        originalStatus: session.originalStatus,
        candidateAngle: session.candidateAngle,
        pointerId: session.pointerId ?? null,
        commitPending: session.commitPending === true,
    };
}

/**
 * Pure gesture state machine. DOM/controller code calls these methods and owns runtime effects.
 * `onPreview`/`onCancel` are notifications only; no persistence is performed here.
 */
export function createBoneGestureMachine(options = {}) {
    const minAngle = Number.isFinite(Number(options.minAngle)) ? Number(options.minAngle) : -90;
    const maxAngle = Number.isFinite(Number(options.maxAngle)) ? Number(options.maxAngle) : 90;
    let session = null;
    let nextId = 0;
    let commitCount = 0;

    function begin(context = {}) {
        if (session) return { ok: false, reason: 'gesture-active' };
        if (context.status !== 'ready') return { ok: false, reason: 'editor-not-ready' };
        if (context.selectedBone && context.selectedBone !== 'End') return { ok: false, reason: 'bone-not-editable' };
        const originalAngle = clampBoneAngle(context.angle, minAngle, maxAngle);
        if (originalAngle === null) return { ok: false, reason: 'bone-angle-unavailable' };
        if (!context.projection) return { ok: false, reason: 'bone-projection-unavailable' };
        session = {
            id: ++nextId,
            phase: BONE_EDITOR_PHASE.preview,
            selectedBone: 'End',
            originalAngle,
            originalProgress: Number.isFinite(Number(context.progress)) ? Number(context.progress) : 0,
            originalDirty: context.dirty === true,
            originalStatus: context.status,
            candidateAngle: originalAngle,
            pointerId: context.pointerId ?? null,
            commitPending: false,
        };
        options.onBegin?.(copySession(session), context);
        options.onPreview?.(originalAngle, copySession(session), 'begin');
        return { ok: true, session: copySession(session) };
    }

    function previewAngle(value, reason = 'angle') {
        if (!session || session.commitPending) return { ok: false, reason: session ? 'commit-pending' : 'no-gesture' };
        const angle = clampBoneAngle(value, minAngle, maxAngle);
        if (angle === null) return { ok: false, reason: 'bone-angle-invalid' };
        session.candidateAngle = angle;
        options.onPreview?.(angle, copySession(session), reason);
        return { ok: true, angle, session: copySession(session) };
    }

    function previewPoint(point, projection) {
        const angle = angleForScreenPoint(projection, point);
        if (angle === null) return { ok: false, reason: 'pointer-projection-invalid' };
        return previewAngle(angle, 'pointer');
    }

    function nudge(delta) {
        if (!session) return { ok: false, reason: 'no-gesture' };
        const safeDelta = Number(delta);
        if (!Number.isFinite(safeDelta)) return { ok: false, reason: 'angle-delta-invalid' };
        return previewAngle(session.candidateAngle + safeDelta, 'keyboard');
    }

    function requestCommit() {
        if (!session) return { ok: false, reason: 'no-gesture' };
        if (session.commitPending) return { ok: false, reason: 'commit-pending' };
        session.commitPending = true;
        session.phase = BONE_EDITOR_PHASE.commit;
        commitCount += 1;
        const request = { ok: true, angle: session.candidateAngle, session: copySession(session), commitCount };
        options.onCommitRequested?.(request);
        return request;
    }

    function finishCommit(success, reason = success ? 'commit' : 'compile-rejected', finishOptions = {}) {
        if (!session || !session.commitPending) return { ok: false, reason: 'no-commit-pending' };
        const finished = copySession(session);
        session = null;
        if (success) {
            options.onCommitFinished?.(finished, true, reason);
            return { ok: true, session: finished };
        }
        if (finishOptions.restore !== false) options.onCancel?.(finished, reason);
        options.onCommitFinished?.(finished, false, reason);
        return { ok: false, session: finished, reason };
    }

    function cancel(reason = 'cancel') {
        if (!session) return { ok: false, reason: 'no-gesture' };
        if (session.commitPending) return { ok: false, reason: 'commit-pending' };
        const cancelled = copySession(session);
        session = null;
        options.onCancel?.(cancelled, reason);
        return { ok: true, session: cancelled, reason };
    }

    function abort(reason = 'abort') {
        if (!session) return { ok: false, reason: 'no-gesture' };
        const aborted = copySession(session);
        session = null;
        return { ok: true, session: aborted, reason };
    }

    return {
        begin,
        previewAngle,
        previewPoint,
        nudge,
        requestCommit,
        finishCommit,
        cancel,
        abort,
        dispose() { return session?.commitPending ? abort('teardown') : cancel('teardown'); },
        getState() { return copySession(session); },
        get commitCount() { return commitCount; },
    };
}

function setAttributeIf(node, name, value) {
    if (node && value !== undefined && value !== null) node.setAttribute(name, String(value));
}

function setOverlayHidden(node, hidden) {
    if (!node) return;
    if (hidden) {
        node.hidden = true;
        node.setAttribute('hidden', '');
    } else {
        node.hidden = false;
        node.removeAttribute('hidden');
    }
}

/** Browser controller that keeps SVG overlay separate from the native canvas pixels. */
export class BoneEditorController {
    constructor(options = {}) {
        this.canvas = options.canvas;
        this.overlay = options.overlay;
        this.line = options.line;
        this.handle = options.handle;
        this.getContext = options.getContext;
        this.onPreview = options.onPreview;
        this.onBegin = options.onBegin;
        this.onCommit = options.onCommit;
        this.onCancel = options.onCancel;
        this.onBusy = options.onBusy;
        this.onMessage = options.onMessage;
        this.projection = null;
        this.pointerId = null;
        this.selfReleasedPointerId = null;
        this.keyboardActive = false;
        this.disposed = false;
        this.attached = false;
        this.machine = createBoneGestureMachine({
            onBegin: session => {
                this.onBegin?.(session);
                this.onBusy?.(true);
                this.onMessage?.('骨を動かす：終点角をpreview中…', 'preview', session);
            },
            onPreview: (angle, session, reason) => {
                this.onPreview?.(angle, session, reason);
                this.refresh();
            },
            onCancel: (session, reason) => {
                this.onCancel?.(session, reason);
                this.onBusy?.(false);
                this.onMessage?.(reason === 'teardown' ? '' : '骨のpreviewを取り消しました。', 'cancel', session);
                this.refresh();
            },
            onCommitRequested: request => {
                this.onMessage?.('骨の角度を一度だけコンパイル中…', 'commit', request.session);
            },
        });
        this._onPointerDown = event => this._pointerDown(event);
        this._onPointerMove = event => this._pointerMove(event);
        this._onPointerUp = event => this._pointerUp(event);
        this._onPointerCancel = event => this._pointerCancel(event);
        this._onLostCapture = event => this._lostPointerCapture(event);
        this._onKeyDown = event => this._keyDown(event);
        this._onFocusOut = event => this._focusOut(event);
        this._onBlur = () => {
            this.pointerId = null;
            this.keyboardActive = false;
            this.machine.cancel('blur');
            this.refresh();
        };
        this._onResize = () => this.refresh();
    }

    attach() {
        if (this.attached || !this.handle) return;
        this.disposed = false;
        this.attached = true;
        this.handle.addEventListener('pointerdown', this._onPointerDown);
        this.handle.addEventListener('pointermove', this._onPointerMove);
        this.handle.addEventListener('pointerup', this._onPointerUp);
        this.handle.addEventListener('pointercancel', this._onPointerCancel);
        this.handle.addEventListener('lostpointercapture', this._onLostCapture);
        this.handle.addEventListener('keydown', this._onKeyDown);
        this.handle.addEventListener('focusout', this._onFocusOut);
        window.addEventListener('blur', this._onBlur);
        window.addEventListener('resize', this._onResize);
        this.refresh();
    }

    _context(pointerId = null) {
        const context = this.getContext?.() || {};
        return { ...context, pointerId };
    }

    _begin(pointerId = null) {
        const result = this.machine.begin(this._context(pointerId));
        if (!result.ok) this.onMessage?.('骨を直接編集できません。', 'error', result);
        return result;
    }

    _pointerDown(event) {
        if (event.button !== 0 || this.machine.getState()) return;
        event.preventDefault();
        this.keyboardActive = false;
        this.selfReleasedPointerId = null;
        const result = this._begin(event.pointerId);
        if (!result.ok) return;
        this.pointerId = event.pointerId;
        try { this.handle.setPointerCapture(event.pointerId); } catch {}
        this._pointerMove(event);
    }

    _pointerMove(event) {
        if (this.pointerId === null || event.pointerId !== this.pointerId) return;
        event.preventDefault();
        const projection = this.projection || this.getContext?.()?.projection;
        this.machine.previewPoint({ x: event.clientX, y: event.clientY }, projection);
    }

    _pointerUp(event) {
        if (this.pointerId === null || event.pointerId !== this.pointerId) return;
        event.preventDefault();
        this._pointerMove(event);
        const pointerId = event.pointerId;
        this.pointerId = null;
        this.selfReleasedPointerId = pointerId;
        try { this.handle.releasePointerCapture(pointerId); } catch {}
        void this._commit().finally(() => {
            if (this.selfReleasedPointerId === pointerId) this.selfReleasedPointerId = null;
        });
    }

    _pointerCancel(event) {
        if (this.pointerId !== null && event.pointerId !== this.pointerId) return;
        event.preventDefault();
        this.pointerId = null;
        this.selfReleasedPointerId = null;
        this.keyboardActive = false;
        this.machine.cancel('pointercancel');
    }

    _lostPointerCapture(event) {
        if (this.selfReleasedPointerId !== null
            && (event?.pointerId === undefined || event.pointerId === this.selfReleasedPointerId)) {
            this.selfReleasedPointerId = null;
            return;
        }
        if (this.pointerId !== null) {
            this.pointerId = null;
            this.keyboardActive = false;
            this.machine.cancel('lostpointercapture');
            return;
        }
        const state = this.machine.getState();
        if (state?.phase === BONE_EDITOR_PHASE.preview) this.machine.cancel('lostpointercapture');
    }

    _keyDown(event) {
        const key = event.key;
        if (!['ArrowLeft', 'ArrowRight', 'Enter', 'Escape'].includes(key)) return;
        event.preventDefault();
        if (key === 'Escape') {
            this.keyboardActive = false;
            this.machine.cancel('escape');
            return;
        }
        if (!this.machine.getState()) {
            const result = this._begin(null);
            if (!result.ok) return;
        }
        if (key === 'Enter') {
            this.keyboardActive = false;
            void this._commit();
            return;
        }
        this.keyboardActive = true;
        const delta = (key === 'ArrowRight' ? 1 : -1) * (event.shiftKey ? 5 : 1);
        this.machine.nudge(delta);
    }

    _focusOut(event) {
        if (!this.keyboardActive || event.relatedTarget === this.handle) return;
        this.keyboardActive = false;
        this.machine.cancel('focusout');
    }

    async _commit() {
        const request = this.machine.requestCommit();
        if (!request.ok) return request;
        try {
            const result = await this.onCommit?.(request);
            if (this.disposed) return { ok: false, reason: 'teardown', suppressCancel: true };
            this.machine.finishCommit(
                result?.ok === true,
                result?.reason || (result?.ok ? 'commit' : 'compile-rejected'),
                { restore: result?.suppressCancel !== true },
            );
        } catch (error) {
            if (!this.disposed) this.machine.finishCommit(false, error?.message || 'compile-rejected');
        } finally {
            if (!this.disposed) {
                this.pointerId = null;
                this.refresh();
            }
        }
        return request;
    }

    refresh() {
        const context = this.getContext?.() || {};
        this.projection = context.projection || null;
        const state = this.machine.getState();
        const visible = Boolean(this.projection && (context.status === 'ready' || state) && this.canvas && this.overlay);
        setOverlayHidden(this.overlay, !visible);
        if (!visible) return;
        const rect = this.canvas.getBoundingClientRect();
        setAttributeIf(this.overlay, 'viewBox', `0 0 ${Math.max(1, rect.width)} ${Math.max(1, rect.height)}`);
        const angle = state?.candidateAngle ?? this.projection.angle;
        const pivot = this.projection.pivotScreen;
        const tip = this.projection.tipScreen;
        const left = rect.left;
        const top = rect.top;
        setAttributeIf(this.line, 'x1', pivot.x - left);
        setAttributeIf(this.line, 'y1', pivot.y - top);
        setAttributeIf(this.line, 'x2', tip.x - left);
        setAttributeIf(this.line, 'y2', tip.y - top);
        setAttributeIf(this.handle, 'cx', tip.x - left);
        setAttributeIf(this.handle, 'cy', tip.y - top);
        setAttributeIf(this.handle, 'aria-valuenow', angle);
        setAttributeIf(this.handle, 'data-angle', angle);
    }

    dispose() {
        this.disposed = true;
        this.pointerId = null;
        this.selfReleasedPointerId = null;
        this.keyboardActive = false;
        this.machine.dispose();
        if (!this.attached || !this.handle) return;
        this.handle.removeEventListener('pointerdown', this._onPointerDown);
        this.handle.removeEventListener('pointermove', this._onPointerMove);
        this.handle.removeEventListener('pointerup', this._onPointerUp);
        this.handle.removeEventListener('pointercancel', this._onPointerCancel);
        this.handle.removeEventListener('lostpointercapture', this._onLostCapture);
        this.handle.removeEventListener('keydown', this._onKeyDown);
        this.handle.removeEventListener('focusout', this._onFocusOut);
        window.removeEventListener('blur', this._onBlur);
        window.removeEventListener('resize', this._onResize);
        this.attached = false;
    }
}

