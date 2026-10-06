/**
 * ROLE: WP-038 の原PNG回転中心を編集する独立したブラウザcontroller。
 * AUTHORITY: 座標入力、配置marker、local draft、Apply/Discardのcallbackだけ。source、CLI、native、Historyは所有しない。
 * INVARIANTS: focus/mode選択はdraftを開始せず、raw入力は補修せず、Apply callbackは一回、markerはnative PNGへ混入しない。
 * RELATED: pivot-model.mjs、editor.js、editor.html、influence-map.js、WP-038 card。
 */
import { assertPivot, defaultPivot } from './pivot-model.mjs';

export const PIVOT_EDIT_PHASE = Object.freeze({ idle: 'idle', draft: 'draft', commit: 'commit' });
export const PIVOT_AXES = Object.freeze(['x', 'y']);

function copyPivot(value) {
    return value && Number.isFinite(Number(value.x)) && Number.isFinite(Number(value.y))
        ? { x: Number(value.x), y: Number(value.y) }
        : null;
}

function imageDimensions(value) {
    const width = Number(value?.width);
    const height = Number(value?.height);
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) return null;
    return { width, height };
}

function safePivot(value, dimensions) {
    if (!dimensions) return null;
    try {
        return assertPivot(value, dimensions.width, dimensions.height);
    } catch {
        return defaultPivot(dimensions.width, dimensions.height);
    }
}

function cloneDraft(draft) {
    if (!draft) return null;
    return {
        rawValues: { ...(draft.rawValues || {}) },
        fieldValidity: { ...(draft.fieldValidity || {}) },
        fieldErrors: { ...(draft.fieldErrors || {}) },
        value: copyPivot(draft.value),
        valid: draft.valid === true,
        editPhase: draft.editPhase || PIVOT_EDIT_PHASE.draft,
    };
}

function draftFromSnapshot(value) {
    if (!value || typeof value !== 'object') return null;
    return {
        rawValues: value.rawValues ? { ...value.rawValues } : {},
        fieldValidity: value.fieldValidity ? { ...value.fieldValidity } : {},
        fieldErrors: value.fieldErrors ? { ...value.fieldErrors } : {},
        value: copyPivot(value.value),
        valid: value.valid === true,
        editPhase: value.editPhase || PIVOT_EDIT_PHASE.draft,
    };
}

export function isCenteredPivot(pivot, width, height) {
    const dimensions = imageDimensions({ width, height });
    const value = safePivot(pivot, dimensions);
    return Boolean(value && value.x === dimensions.width / 2 && value.y === dimensions.height / 2);
}

/** Derive UI snapshot fields without creating a second persistence authority. */
export function derivePivotSnapshotFields(next = {}, previous = {}) {
    const dimensions = imageDimensions(next.image || previous.image);
    const requested = next.pivot !== undefined ? next.pivot : previous.pivot;
    const pivot = safePivot(requested, dimensions);
    const draft = next.pivotDraft !== undefined ? next.pivotDraft : previous.pivotDraft;
    return {
        pivot,
        centerAtRotationPivot: isCenteredPivot(pivot, dimensions?.width, dimensions?.height),
        pivotEditPhase: next.pivotEditPhase || previous.pivotEditPhase || PIVOT_EDIT_PHASE.idle,
        pivotDraft: draftFromSnapshot(draft),
        placementMode: next.placementMode === true || (next.placementMode === undefined && previous.placementMode === true),
    };
}

function roundedCoordinate(value) {
    return Number(Number(value).toFixed(3));
}

function percentText(value) {
    return Number(value).toFixed(3).replace(/\.000$/, '').replace(/(\.\d*?)0+$/, '$1');
}

function viewBoxValues(svg, width, height) {
    const raw = svg?.getAttribute?.('viewBox');
    const values = String(raw || '').trim().split(/[\s,]+/u).map(Number);
    if (values.length === 4 && values.every(Number.isFinite) && values[2] > 0 && values[3] > 0) return values;
    return [0, 0, width, height];
}

function clientToSvgPoint(svg, clientX, clientY, width, height) {
    const rect = svg?.getBoundingClientRect?.() || { left: 0, top: 0, width, height };
    const screenX = Number(clientX);
    const screenY = Number(clientY);
    const ctm = svg?.getScreenCTM?.();
    if (ctm?.inverse) {
        try {
            const inverse = ctm.inverse();
            const point = svg?.createSVGPoint?.();
            if (point?.matrixTransform) {
                point.x = screenX;
                point.y = screenY;
                const transformed = point.matrixTransform(inverse);
                if (Number.isFinite(transformed?.x) && Number.isFinite(transformed?.y)) {
                    return { x: transformed.x, y: transformed.y };
                }
            }
            if (typeof globalThis.DOMPoint === 'function') {
                const transformed = new globalThis.DOMPoint(screenX, screenY).matrixTransform(inverse);
                if (Number.isFinite(transformed?.x) && Number.isFinite(transformed?.y)) {
                    return { x: transformed.x, y: transformed.y };
                }
            }
        } catch {
            // Fall through to the deterministic meet/none mapping used by pure fixtures.
        }
    }
    const viewBox = viewBoxValues(svg, width, height);
    const viewWidth = viewBox[2];
    const viewHeight = viewBox[3];
    const rectWidth = Number(rect.width) > 0 ? Number(rect.width) : width;
    const rectHeight = Number(rect.height) > 0 ? Number(rect.height) : height;
    const preserve = String(svg?.getAttribute?.('preserveAspectRatio') || 'xMidYMid meet');
    if (/\bnone\b/u.test(preserve)) {
        return {
            x: (screenX - Number(rect.left || 0)) * viewWidth / rectWidth + viewBox[0],
            y: (screenY - Number(rect.top || 0)) * viewHeight / rectHeight + viewBox[1],
        };
    }
    const scale = Math.min(rectWidth / viewWidth, rectHeight / viewHeight);
    const renderedWidth = viewWidth * scale;
    const renderedHeight = viewHeight * scale;
    const offsetX = (rectWidth - renderedWidth) / 2;
    const offsetY = (rectHeight - renderedHeight) / 2;
    return {
        x: (screenX - Number(rect.left || 0) - offsetX) / scale + viewBox[0],
        y: (screenY - Number(rect.top || 0) - offsetY) / scale + viewBox[1],
    };
}

function setSvgHidden(node, hidden) {
    if (!node) return;
    const value = hidden === true;
    if (value) node.setAttribute?.('hidden', '');
    else node.removeAttribute?.('hidden');
    node.hidden = value;
}

function copyState(state) {
    const snapshot = state?.snapshot || state || {};
    return {
        snapshot,
        busy: state?.busy === true,
        imageUrl: state?.imageUrl || snapshot.imageUrl || null,
    };
}

/**
 * Browser-side pivot draft controller. All persistence/native effects are callbacks supplied by editor.js.
 * The SVG marker and placement surface are separate nodes so mode OFF leaves influence-map point selection alone.
 */
export class PivotEditorController {
    constructor(options = {}) {
        this.root = options.root || null;
        this.svg = options.svg || null;
        this.layer = options.layer || null;
        this.surface = options.surface || null;
        this.marker = options.marker || null;
        this.markerLabel = options.markerLabel || null;
        this.xInput = options.xInput || null;
        this.yInput = options.yInput || null;
        this.modeButton = options.modeButton || null;
        this.centerButton = options.centerButton || null;
        this.applyButton = options.applyButton || null;
        this.discardButton = options.discardButton || null;
        this.statusNode = options.statusNode || null;
        this.onDraftChanged = options.onDraftChanged;
        this.onApply = options.onApply;
        this.onDiscard = options.onDiscard;
        this.onPendingChanged = options.onPendingChanged;
        this.onModeChanged = options.onModeChanged;
        this.onMessage = options.onMessage;
        this.canBeginDraft = options.canBeginDraft || (() => true);
        this.confirmed = { x: 0, y: 0 };
        this.width = 320;
        this.height = 200;
        this.status = 'error';
        this.imageUrl = null;
        this.busy = false;
        this.draft = null;
        this.pending = false;
        this.placementMode = false;
        this.disposed = false;
        this.attached = false;
        this.listeners = [];
    }

    attach() {
        if (this.attached || this.disposed) return;
        this.attached = true;
        for (const [axis, input] of [['x', this.xInput], ['y', this.yInput]]) {
            if (!input) continue;
            const onFocus = () => {
                if (this.root) this.root.dataset.activeAxis = axis;
            };
            const onInput = () => this._input(axis);
            input.addEventListener?.('focus', onFocus);
            input.addEventListener?.('input', onInput);
            this.listeners.push([input, 'focus', onFocus], [input, 'input', onInput]);
        }
        if (this.modeButton) {
            const handler = event => {
                event.preventDefault?.();
                this.setPlacementMode(!this.placementMode);
            };
            this.modeButton.addEventListener?.('click', handler);
            this.listeners.push([this.modeButton, 'click', handler]);
        }
        if (this.centerButton) {
            const handler = event => {
                event.preventDefault?.();
                this.center();
            };
            this.centerButton.addEventListener?.('click', handler);
            this.listeners.push([this.centerButton, 'click', handler]);
        }
        if (this.applyButton) {
            const handler = event => {
                event.preventDefault?.();
                void this.apply();
            };
            this.applyButton.addEventListener?.('click', handler);
            this.listeners.push([this.applyButton, 'click', handler]);
        }
        if (this.discardButton) {
            const handler = event => {
                event.preventDefault?.();
                this.discard();
            };
            this.discardButton.addEventListener?.('click', handler);
            this.listeners.push([this.discardButton, 'click', handler]);
        }
        if (this.surface) {
            const handler = event => this._placeFromEvent(event);
            this.surface.addEventListener?.('click', handler);
            this.listeners.push([this.surface, 'click', handler]);
        }
        this._render();
    }

    _ready() {
        return !this.disposed && !this.busy && Boolean(this.imageUrl)
            && (this.status === 'ready' || Boolean(this.draft));
    }

    _currentValue() {
        return this.draft?.value && this.draft.valid ? this.draft.value : this.confirmed;
    }

    _beginDraft() {
        if (this.disposed || this.pending || this.draft || !this._ready() || !this.canBeginDraft()) return false;
        this.draft = {
            rawValues: { x: String(this.confirmed.x), y: String(this.confirmed.y) },
            fieldValidity: { x: true, y: true },
            fieldErrors: { x: null, y: null },
            value: { ...this.confirmed },
            valid: true,
            editPhase: PIVOT_EDIT_PHASE.draft,
        };
        this._render();
        this._notifyDraft();
        this.onMessage?.('回転中心を編集中です。適用または変更を戻すを選択してください。', 'draft');
        return true;
    }

    _validateDraft() {
        if (!this.draft) return false;
        const fieldValidity = {};
        const fieldErrors = {};
        let valid = true;
        for (const axis of PIVOT_AXES) {
            const raw = this.draft.rawValues?.[axis];
            const value = typeof raw === 'string' ? raw.trim() : String(raw ?? '').trim();
            const coordinate = Number(value);
            if (!value) {
                fieldValidity[axis] = false;
                fieldErrors[axis] = `${axis.toUpperCase()}を入力してください。`;
                valid = false;
            } else if (!Number.isFinite(coordinate) || coordinate < 0 || coordinate > (axis === 'x' ? this.width : this.height)) {
                fieldValidity[axis] = false;
                fieldErrors[axis] = `${axis.toUpperCase()}は画像範囲内の数値にしてください。`;
                valid = false;
            } else {
                fieldValidity[axis] = true;
                fieldErrors[axis] = null;
            }
        }
        this.draft.fieldValidity = fieldValidity;
        this.draft.fieldErrors = fieldErrors;
        this.draft.valid = valid;
        this.draft.value = valid
            ? assertPivot({ x: Number(this.draft.rawValues.x), y: Number(this.draft.rawValues.y) }, this.width, this.height)
            : null;
        return valid;
    }

    _input(axis) {
        if (!PIVOT_AXES.includes(axis) || this.disposed || this.pending) return;
        const input = axis === 'x' ? this.xInput : this.yInput;
        const rawValue = String(input?.value ?? '');
        if (!this.draft && !this._beginDraft()) return;
        this.draft.rawValues[axis] = rawValue;
        this._validateDraft();
        this._render();
        this._notifyDraft();
        if (!this.draft.valid) this.onMessage?.(this.draft.fieldErrors[axis] || '回転中心の入力を確認してください。', 'error');
    }

    center() {
        if (this.disposed || this.pending) return false;
        if (!this.draft && !this._beginDraft()) return false;
        const center = defaultPivot(this.width, this.height);
        this.draft.rawValues = { x: String(center.x), y: String(center.y) };
        this._validateDraft();
        this._render();
        this._notifyDraft();
        this.onMessage?.('回転中心を画像中央へ戻す一時draftを作成しました。', 'draft');
        return true;
    }

    _eventToPivot(event) {
        const clientX = Number(event?.clientX ?? event?.offsetX ?? 0);
        const clientY = Number(event?.clientY ?? event?.offsetY ?? 0);
        const point = clientToSvgPoint(this.svg, clientX, clientY, this.width, this.height);
        return {
            x: Math.max(0, Math.min(this.width, roundedCoordinate(point.x))),
            y: Math.max(0, Math.min(this.height, roundedCoordinate(point.y))),
        };
    }

    _placeFromEvent(event) {
        if (!this.placementMode || this.pending || !this._ready()) return;
        event?.preventDefault?.();
        if (!this.draft && !this._beginDraft()) return;
        const value = this._eventToPivot(event);
        this.draft.rawValues = { x: String(value.x), y: String(value.y) };
        this._validateDraft();
        this._render();
        this._notifyDraft();
        this.onMessage?.(`回転中心をX ${percentText(value.x)} / Y ${percentText(value.y)}へ配置中です。`, 'draft');
    }

    setPlacementMode(value) {
        if (this.disposed || this.pending) return false;
        const next = value === true;
        if (next && (!this._ready() || !this.canBeginDraft())) return false;
        if (this.placementMode === next) return true;
        this.placementMode = next;
        this._render();
        this.onModeChanged?.(next);
        this.onMessage?.(next ? '素材上の配置モードです。画像上をクリックしてください。' : '素材上の配置モードを解除しました。', 'mode');
        return true;
    }

    async apply() {
        if (this.disposed || this.pending || !this.draft) return { ok: false, reason: 'no-draft' };
        this._validateDraft();
        this._render();
        this._notifyDraft();
        if (!this.draft.valid) {
            this.onMessage?.('回転中心のX/Yを確認してください。', 'error');
            return { ok: false, reason: 'draft-invalid' };
        }
        const draft = cloneDraft(this.draft);
        draft.editPhase = PIVOT_EDIT_PHASE.commit;
        this.pending = true;
        this._render();
        this.onPendingChanged?.(true);
        this._notifyDraft();
        this.onMessage?.('回転中心を公式CLIで一度だけ適用中…', 'commit');
        try {
            const result = await this.onApply?.(draft);
            if (this.disposed) return { ok: false, reason: 'pivot-commit-stale', suppressCancel: true };
            if (result?.ok === true) {
                if (result.acceptedByCallback !== true) this.commitAccepted(result.snapshot?.pivot || draft.value);
                return result;
            }
            this.pending = false;
            this._render();
            this.onPendingChanged?.(false);
            this._notifyDraft();
            this.onMessage?.(result?.reason || '回転中心の適用を取り消しました。', 'error');
            return result || { ok: false, reason: 'pivot-commit-rejected' };
        } catch (error) {
            if (this.disposed) return { ok: false, reason: 'pivot-commit-stale', suppressCancel: true };
            this.pending = false;
            this._render();
            this.onPendingChanged?.(false);
            this._notifyDraft();
            this.onMessage?.(error?.message || '回転中心の適用に失敗しました。', 'error');
            return { ok: false, reason: error?.message || 'pivot-commit-rejected' };
        }
    }

    commitAccepted(value) {
        const next = safePivot(value, { width: this.width, height: this.height });
        if (!next) return { ok: false, reason: 'pivot-invalid' };
        this.confirmed = next;
        this.draft = null;
        this.pending = false;
        this.placementMode = false;
        this._render();
        this.onPendingChanged?.(false);
        this.onDraftChanged?.(null);
        this.onModeChanged?.(false);
        this.onMessage?.('回転中心を適用しました。', 'ready');
        return { ok: true, pivot: { ...next } };
    }

    discard() {
        if (this.disposed || this.pending || !this.draft) return { ok: false, reason: 'no-draft' };
        const restored = { ...this.confirmed };
        this.draft = null;
        this.placementMode = false;
        this._render();
        this.onDiscard?.({ pivot: restored });
        this.onDraftChanged?.(null);
        this.onModeChanged?.(false);
        this.onMessage?.('回転中心の変更を戻しました。', 'ready');
        return { ok: true, pivot: restored };
    }

    loadCommitted(value, dimensions = null) {
        if (this.disposed || this.draft || this.pending) return { ok: false, reason: 'draft-active' };
        if (dimensions) {
            this.width = Number(dimensions.width) || this.width;
            this.height = Number(dimensions.height) || this.height;
        }
        const next = safePivot(value, { width: this.width, height: this.height });
        if (!next) return { ok: false, reason: 'pivot-invalid' };
        this.confirmed = next;
        this.placementMode = false;
        this._render();
        return { ok: true, pivot: { ...next } };
    }

    sync(state = {}) {
        if (this.disposed) return this.getView();
        const { snapshot, busy, imageUrl } = copyState(state);
        const dimensions = imageDimensions(snapshot.image);
        if (dimensions) {
            this.width = dimensions.width;
            this.height = dimensions.height;
        }
        this.status = snapshot.status || 'error';
        this.busy = busy;
        this.imageUrl = imageUrl;
        if (!this.draft && !this.pending) {
            const fields = derivePivotSnapshotFields(snapshot, {});
            if (fields.pivot) this.confirmed = fields.pivot;
            this.placementMode = snapshot.placementMode === true;
        }
        this._render();
        return this.getView();
    }

    getSnapshotFields() {
        const pivot = { ...this.confirmed };
        const draft = cloneDraft(this.draft);
        return {
            pivot,
            centerAtRotationPivot: isCenteredPivot(pivot, this.width, this.height),
            pivotEditPhase: this.pending ? PIVOT_EDIT_PHASE.commit : draft ? PIVOT_EDIT_PHASE.draft : PIVOT_EDIT_PHASE.idle,
            pivotDraft: draft,
            placementMode: this.placementMode,
        };
    }

    getView() {
        const fields = this.getSnapshotFields();
        return {
            ...fields,
            width: this.width,
            height: this.height,
            status: this.status,
            imageUrl: this.imageUrl,
            ready: this._ready(),
            interactive: this._ready() && this.placementMode && !this.pending,
            confirmed: { ...this.confirmed },
            draft: cloneDraft(this.draft),
        };
    }

    _notifyDraft() {
        this.onDraftChanged?.(cloneDraft(this.draft));
    }

    _render() {
        if (this.root) {
            this.root.dataset.editPhase = this.pending ? PIVOT_EDIT_PHASE.commit : this.draft ? PIVOT_EDIT_PHASE.draft : PIVOT_EDIT_PHASE.idle;
            this.root.dataset.placementMode = String(this.placementMode);
            this.root.dataset.ready = String(this._ready());
        }
        if (this.statusNode) {
            this.statusNode.dataset.phase = this.pending ? PIVOT_EDIT_PHASE.commit : this.draft ? PIVOT_EDIT_PHASE.draft : PIVOT_EDIT_PHASE.idle;
            this.statusNode.textContent = this.pending
                ? '回転中心を適用中です。native previewは適用前の確認済み状態です。'
                : this.draft?.valid === false
                    ? '回転中心の入力を確認してください。'
                    : this.draft
                        ? '回転中心の未適用draftを表示中です。'
                        : '確認済みの回転中心を表示中です。';
        }
        const current = this.draft?.rawValues || { x: String(this.confirmed.x), y: String(this.confirmed.y) };
        for (const [axis, input] of [['x', this.xInput], ['y', this.yInput]]) {
            if (!input) continue;
            input.min = '0';
            input.max = String(axis === 'x' ? this.width : this.height);
            input.step = '0.001';
            input.disabled = this.pending || !this._ready();
            input.value = String(current[axis] ?? '');
            input.dataset.valid = this.draft ? String(this.draft.fieldValidity?.[axis] !== false) : 'true';
            input.setAttribute?.('aria-invalid', this.draft && this.draft.fieldValidity?.[axis] === false ? 'true' : 'false');
        }
        if (this.modeButton) {
            this.modeButton.disabled = this.pending || !this._ready();
            this.modeButton.textContent = this.placementMode ? '配置モード: ON' : '配置モード: OFF';
            this.modeButton.setAttribute?.('aria-pressed', String(this.placementMode));
        }
        if (this.centerButton) this.centerButton.disabled = this.pending || !this._ready();
        if (this.applyButton) this.applyButton.disabled = !this.draft || !this.draft.valid || this.pending;
        if (this.discardButton) this.discardButton.disabled = !this.draft || this.pending;
        if (this.surface) {
            this.surface.setAttribute?.('x', '0');
            this.surface.setAttribute?.('y', '0');
            this.surface.setAttribute?.('width', String(this.width));
            this.surface.setAttribute?.('height', String(this.height));
            this.surface.setAttribute?.('pointer-events', this.placementMode && this._ready() && !this.pending ? 'all' : 'none');
            this.surface.setAttribute?.('aria-hidden', this.placementMode ? 'false' : 'true');
        }
        const value = this._currentValue();
        if (this.marker) {
            this.marker.setAttribute?.('cx', String(value.x));
            this.marker.setAttribute?.('cy', String(value.y));
            this.marker.setAttribute?.('r', String(Math.max(6, Math.min(14, Math.min(this.width, this.height) * 0.035))));
            this.marker.dataset.draft = String(Boolean(this.draft));
            this.marker.dataset.placementMode = String(this.placementMode);
            setSvgHidden(this.marker, !this._ready());
        }
        if (this.markerLabel) {
            this.markerLabel.setAttribute?.('x', String(value.x));
            this.markerLabel.setAttribute?.('y', String(value.y - 10));
            this.markerLabel.textContent = '回転中心';
            setSvgHidden(this.markerLabel, !this._ready());
        }
        setSvgHidden(this.layer, !this._ready());
        if (this.layer) this.layer.dataset.placementMode = String(this.placementMode);
    }

    isDraft() { return Boolean(this.draft); }

    isPending() { return this.pending; }

    getDraft() { return cloneDraft(this.draft); }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.pending = false;
        this.draft = null;
        for (const [node, type, handler] of this.listeners) node.removeEventListener?.(type, handler);
        this.listeners = [];
        this.attached = false;
        this.placementMode = false;
    }
}

