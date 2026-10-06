/**
 * ROLE: WP-039 の chain authoring UI。関節、45点 warp、weights の local draft と
 * SVG marker を所有する。
 * AUTHORITY: ここはsource/nativeの評価器ではなく、Applyされたchainをglueへ渡す
 * authoring controller。画像の変形、Rive操作、保存は行わない。
 * INVARIANTS: focus/selectionだけではdraftを作らない。raw文字列はそのまま保持し、
 * Applyまで確定chainと良好native sceneを変更しない。dragはSVG目標位置だけを動かす。
 */

import { createChainWeights as createAuthoringChainWeights } from './chain-model.mjs';

export const CHAIN_GRID_COLUMNS = 9;
export const CHAIN_GRID_ROWS = 5;
export const CHAIN_POINT_COUNT = CHAIN_GRID_COLUMNS * CHAIN_GRID_ROWS;
export const CHAIN_MIN_BONES = 2;
export const CHAIN_MAX_BONES = 8;

export const CHAIN_PRESETS = Object.freeze({
    arm3: Object.freeze({ id: 'arm3', label: '腕3関節', count: 3, angles: [0, 45, -35] }),
    snake6: Object.freeze({ id: 'snake6', label: 'ヘビ6関節', count: 6, angles: [15, -35, 35, -35, 35, -20] }),
});

const EPSILON = 0.000001;

function finite(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function round3(value) {
    const number = finite(value);
    return number === null ? NaN : Number(number.toFixed(3));
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function positiveDimension(value, fallback = 1) {
    const number = finite(value);
    return number !== null && number > 0 ? number : fallback;
}

function copyPoint(point) {
    return { x: round3(point?.x), y: round3(point?.y) };
}

function copyWeight(weight) {
    return {
        a: Number.isInteger(Number(weight?.a)) ? Number(weight.a) : NaN,
        b: Number.isInteger(Number(weight?.b)) ? Number(weight.b) : NaN,
        mix: Number.isInteger(Number(weight?.mix)) ? Number(weight.mix) : NaN,
    };
}

export function cloneChain(chain) {
    if (!chain || typeof chain !== 'object') return null;
    return {
        joints: Array.isArray(chain.joints) ? chain.joints.map(copyPoint) : [],
        angles: Array.isArray(chain.angles) ? chain.angles.map(round3) : [],
        warp: Array.isArray(chain.warp) ? chain.warp.map(copyPoint) : [],
        weights: Array.isArray(chain.weights) ? chain.weights.map(copyWeight) : [],
    };
}

function restJoints(width, height, boneCount) {
    const safeWidth = positiveDimension(width);
    const safeHeight = positiveDimension(height);
    const count = clamp(Math.round(Number(boneCount) || 3), CHAIN_MIN_BONES, CHAIN_MAX_BONES);
    const available = Math.max(1, safeWidth * 0.76);
    const step = Math.max(1, available / count);
    const rootX = clamp(safeWidth * 0.1, 0, Math.max(0, safeWidth - 1));
    const rootY = safeHeight * 0.5;
    return Array.from({ length: count + 1 }, (_, index) => ({
        x: round3(clamp(rootX + step * index, 0, safeWidth)),
        y: round3(clamp(rootY + Math.sin(index * 0.8) * safeHeight * 0.08, 0, safeHeight)),
    }));
}

/**
 * Small authoring initialiser. The backend remains the strict source of truth;
 * this function only gives the editor a valid local payload to show before Apply.
 */
export function createDefaultChain(width, height, boneCount = 3) {
    const count = clamp(Math.round(Number(boneCount) || 3), CHAIN_MIN_BONES, CHAIN_MAX_BONES);
    const joints = restJoints(width, height, count);
    return {
        joints,
        angles: Array.from({ length: count }, () => 0),
        warp: Array.from({ length: CHAIN_POINT_COUNT }, () => ({ x: 0, y: 0 })),
        weights: createAuthoringChainWeights(joints, Math.max(1, Math.round(positiveDimension(width))), Math.max(1, Math.round(positiveDimension(height)))),
    };
}

export const defaultChain = createDefaultChain;

export function createChainPreset(name, width, height) {
    const preset = CHAIN_PRESETS[name] || CHAIN_PRESETS.arm3;
    const chain = createDefaultChain(width, height, preset.count);
    chain.angles = preset.angles.map(round3);
    return chain;
}

export function resizeChain(chain, oldWidth, oldHeight, newWidth, newHeight) {
    const source = cloneChain(chain);
    if (!source) return null;
    const oldW = positiveDimension(oldWidth);
    const oldH = positiveDimension(oldHeight);
    const newW = positiveDimension(newWidth);
    const newH = positiveDimension(newHeight);
    const xScale = newW / oldW;
    const yScale = newH / oldH;
    return {
        joints: source.joints.map(point => ({ x: round3(point.x * xScale), y: round3(point.y * yScale) })),
        angles: source.angles.map(round3),
        warp: source.warp.map(point => ({ x: round3(point.x * xScale), y: round3(point.y * yScale) })),
        weights: source.weights.map(copyWeight),
    };
}

function fieldNumber(chain, field) {
    const match = /^(joints|angles|warp|weights)\.(\d+)(?:\.(x|y|a|b|mix))?$/u.exec(field);
    if (!match) return null;
    const [, group, rawIndex, key] = match;
    const index = Number(rawIndex);
    const value = chain?.[group]?.[index];
    if (group === 'angles') return finite(value);
    return finite(value?.[key]);
}

function fieldLimit(field, width, height, boneCount) {
    const match = /^(joints|angles|warp|weights)\.(\d+)(?:\.(x|y|a|b|mix))?$/u.exec(field);
    if (!match) return null;
    const [, group, , key] = match;
    if ((group === 'joints' || group === 'warp') && key === 'x') return { min: group === 'warp' ? -width : 0, max: group === 'warp' ? width : width, integer: false };
    if ((group === 'joints' || group === 'warp') && key === 'y') return { min: group === 'warp' ? -height : 0, max: group === 'warp' ? height : height, integer: false };
    if (group === 'angles') return { min: -90, max: 90, integer: false };
    if (group === 'weights' && (key === 'a' || key === 'b')) return { min: 0, max: boneCount - 1, integer: true };
    if (group === 'weights' && key === 'mix') return { min: 0, max: 255, integer: true };
    return null;
}

function decimalPlaces(value) {
    const text = String(value).trim().toLowerCase();
    if (!text || text.includes('e')) return null;
    const dot = text.indexOf('.');
    return dot < 0 ? 0 : text.length - dot - 1;
}

function validateFieldRaw(raw, field, width, height, boneCount) {
    const text = String(raw ?? '');
    if (text.trim() === '') return { ok: false, error: '値を入力してください。' };
    const number = finite(text);
    if (number === null) return { ok: false, error: '有限値を入力してください。' };
    const limit = fieldLimit(field, width, height, boneCount);
    if (limit && (number < limit.min - EPSILON || number > limit.max + EPSILON)) return { ok: false, error: '許容範囲外です。' };
    if (limit?.integer && !Number.isInteger(number)) return { ok: false, error: '整数を入力してください。' };
    if (decimalPlaces(text) > 3) return { ok: false, error: '小数3桁までです。' };
    return { ok: true, value: limit?.integer ? Math.round(number) : round3(number) };
}

function allFields(chain) {
    const fields = [];
    for (let index = 0; index < (chain?.joints?.length || 0); index += 1) {
        fields.push(`joints.${index}.x`, `joints.${index}.y`);
    }
    for (let index = 0; index < (chain?.angles?.length || 0); index += 1) fields.push(`angles.${index}`);
    for (let index = 0; index < (chain?.warp?.length || 0); index += 1) fields.push(`warp.${index}.x`, `warp.${index}.y`);
    for (let index = 0; index < (chain?.weights?.length || 0); index += 1) {
        fields.push(`weights.${index}.a`, `weights.${index}.b`, `weights.${index}.mix`);
    }
    return fields;
}

export function validateChain(chain, width, height) {
    const safeWidth = positiveDimension(width);
    const safeHeight = positiveDimension(height);
    const errors = [];
    const value = cloneChain(chain);
    if (!value) return { ok: false, errors: ['chain object is required'], value: null };
    const count = value.angles.length;
    if (count < CHAIN_MIN_BONES || count > CHAIN_MAX_BONES) errors.push('骨数は2〜8です。');
    if (value.joints.length !== count + 1) errors.push('関節数は骨数+1です。');
    if (value.warp.length !== CHAIN_POINT_COUNT) errors.push('warpは45点です。');
    if (value.weights.length !== CHAIN_POINT_COUNT) errors.push('weightsは45点です。');
    for (const [index, point] of value.joints.entries()) {
        if (finite(point.x) === null || finite(point.y) === null || point.x < 0 || point.x > safeWidth || point.y < 0 || point.y > safeHeight) {
            errors.push(`joints.${index}が範囲外です。`);
        }
        if (index > 0 && Math.hypot(point.x - value.joints[index - 1].x, point.y - value.joints[index - 1].y) < 1 - EPSILON) errors.push(`joints.${index - 1}→${index}が短すぎます。`);
    }
    value.angles.forEach((angle, index) => {
        if (finite(angle) === null || angle < -90 || angle > 90) errors.push(`angles.${index}が範囲外です。`);
    });
    value.warp.forEach((point, index) => {
        if (finite(point.x) === null || finite(point.y) === null || Math.abs(point.x) > safeWidth || Math.abs(point.y) > safeHeight) errors.push(`warp.${index}が範囲外です。`);
    });
    value.weights.forEach((weight, index) => {
        if (!Number.isInteger(weight.a) || weight.a < 0 || weight.a >= count) errors.push(`weights.${index}.aが範囲外です。`);
        if (!Number.isInteger(weight.b) || weight.b < 0 || weight.b >= count) errors.push(`weights.${index}.bが範囲外です。`);
        if (!Number.isInteger(weight.mix) || weight.mix < 0 || weight.mix > 255) errors.push(`weights.${index}.mixが範囲外です。`);
    });
    return { ok: errors.length === 0, errors, value };
}

export function assertChain(chain, width, height) {
    const result = validateChain(chain, width, height);
    if (!result.ok) throw new Error(result.errors[0] || 'chain is invalid');
    return result.value;
}

function rawValuesForChain(chain) {
    const raw = {};
    for (const field of allFields(chain)) {
        const value = fieldNumber(chain, field);
        raw[field] = value === null ? '' : String(value);
    }
    return raw;
}

function viewBox(svg) {
    const raw = svg?.getAttribute?.('viewBox') || '0 0 1 1';
    const values = raw.trim().split(/[ ,]+/u).map(Number);
    return values.length === 4 && values.every(Number.isFinite) && values[2] > 0 && values[3] > 0
        ? { x: values[0], y: values[1], width: values[2], height: values[3] }
        : { x: 0, y: 0, width: 1, height: 1 };
}

function svgElement(documentRef, name, attributes = {}) {
    const node = documentRef?.createElementNS?.('http://www.w3.org/2000/svg', name);
    if (!node) return null;
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
    return node;
}

function setSvgVisible(node, visible) {
    if (!node) return;
    if (visible) {
        node.removeAttribute?.('hidden');
        node.setAttribute?.('aria-hidden', 'false');
        if (node.style) node.style.display = '';
    } else {
        node.setAttribute?.('hidden', '');
        node.setAttribute?.('aria-hidden', 'true');
        if (node.style) node.style.display = 'none';
    }
}

function eventPoint(event, svg) {
    const clientX = finite(event?.clientX);
    const clientY = finite(event?.clientY);
    if (clientX === null || clientY === null) return null;
    const box = viewBox(svg);
    try {
        const ctm = svg?.getScreenCTM?.();
        if (ctm?.inverse) {
            const ownerWindow = svg?.ownerDocument?.defaultView || globalThis;
            const Point = ownerWindow.DOMPoint || globalThis.DOMPoint;
            if (Point) {
                const point = new Point(clientX, clientY).matrixTransform(ctm.inverse());
                if (Number.isFinite(point.x) && Number.isFinite(point.y)) return { x: point.x, y: point.y };
            }
            if (svg?.ownerDocument?.createSVGPoint) {
                const point = svg.ownerDocument.createSVGPoint();
                point.x = clientX;
                point.y = clientY;
                const mapped = point.matrixTransform(ctm.inverse());
                if (Number.isFinite(mapped.x) && Number.isFinite(mapped.y)) return { x: mapped.x, y: mapped.y };
            }
        }
    } catch {
        // The explicit preserveAspectRatio fallback below is the test/fake-DOM path.
    }
    const rect = svg?.getBoundingClientRect?.();
    if (!rect || !(rect.width > 0) || !(rect.height > 0)) return null;
    const scale = Math.min(rect.width / box.width, rect.height / box.height);
    const offsetX = (rect.width - box.width * scale) / 2;
    const offsetY = (rect.height - box.height * scale) / 2;
    return {
        x: box.x + (clientX - rect.left - offsetX) / scale,
        y: box.y + (clientY - rect.top - offsetY) / scale,
    };
}

function targetForWarp(index, chain, width, height) {
    const column = index % CHAIN_GRID_COLUMNS;
    const row = Math.floor(index / CHAIN_GRID_COLUMNS);
    const base = { x: width * column / (CHAIN_GRID_COLUMNS - 1), y: height * row / (CHAIN_GRID_ROWS - 1) };
    const delta = chain?.warp?.[index] || { x: 0, y: 0 };
    return { x: base.x + Number(delta.x || 0), y: base.y + Number(delta.y || 0), base };
}

export class ChainEditorController {
    constructor(options = {}) {
        this.root = options.root || null;
        this.svg = options.svg || null;
        this.imageNode = options.imageNode || null;
        this.jointLayer = options.jointLayer || null;
        this.warpLayer = options.warpLayer || null;
        this.jointList = options.jointList || null;
        this.pointList = options.pointList || null;
        this.inputs = options.inputs || {};
        this.applyButton = options.applyButton || null;
        this.discardButton = options.discardButton || null;
        this.placementButton = options.placementButton || null;
        this.presetButtons = options.presetButtons || {};
        this.onDraftChanged = typeof options.onDraftChanged === 'function' ? options.onDraftChanged : () => {};
        this.onSelectionChanged = typeof options.onSelectionChanged === 'function' ? options.onSelectionChanged : () => {};
        this.onPendingChanged = typeof options.onPendingChanged === 'function' ? options.onPendingChanged : () => {};
        this.onApply = typeof options.onApply === 'function' ? options.onApply : async () => ({ ok: false, reason: 'apply-handler-missing' });
        this.onDiscard = typeof options.onDiscard === 'function' ? options.onDiscard : () => {};
        this.canBeginDraft = typeof options.canBeginDraft === 'function' ? options.canBeginDraft : () => true;
        this.onMessage = typeof options.onMessage === 'function' ? options.onMessage : () => {};
        this.width = positiveDimension(options.width);
        this.height = positiveDimension(options.height);
        this.confirmedChain = cloneChain(options.initialChain);
        this.draft = null;
        this.rawValues = {};
        this.fieldValidity = {};
        this.fieldErrors = {};
        this.selectedJoint = 0;
        this.selectedPoint = 0;
        this.placementMode = false;
        this.busy = false;
        this.pending = false;
        this.disposed = false;
        this.generation = 0;
        this.drag = null;
        this.listeners = [];
    }

    attach() {
        if (this.disposed || this.listeners.length) return this;
        const listen = (node, type, handler) => {
            if (!node?.addEventListener) return;
            node.addEventListener(type, handler);
            this.listeners.push(() => node.removeEventListener?.(type, handler));
        };
        const bindInput = (node, field) => listen(node, 'input', () => this._handleInput(field, node.value));
        bindInput(this.inputs.jointX, 'joint-x');
        bindInput(this.inputs.jointY, 'joint-y');
        bindInput(this.inputs.angle, 'angle');
        bindInput(this.inputs.warpX, 'warp-x');
        bindInput(this.inputs.warpY, 'warp-y');
        bindInput(this.inputs.weightA, 'weight-a');
        bindInput(this.inputs.weightB, 'weight-b');
        bindInput(this.inputs.weightMix, 'weight-mix');
        listen(this.applyButton, 'click', () => void this.apply());
        listen(this.discardButton, 'click', () => this.discard());
        listen(this.placementButton, 'click', () => this.setPlacementMode(!this.placementMode));
        for (const [name, button] of Object.entries(this.presetButtons)) listen(button, 'click', () => this.setPreset(name));
        listen(this.jointList, 'click', event => {
            const target = event.target?.closest?.('[data-chain-joint-index]');
            if (target) this.selectJoint(Number(target.dataset.chainJointIndex));
        });
        listen(this.pointList, 'click', event => {
            const target = event.target?.closest?.('[data-chain-point-index]');
            if (target) this.selectPoint(Number(target.dataset.chainPointIndex));
        });
        listen(this.jointLayer, 'pointerdown', event => this._pointerDown(event, 'joint'));
        listen(this.warpLayer, 'pointerdown', event => this._pointerDown(event, 'warp'));
        listen(this.svg, 'pointermove', event => this._pointerMove(event));
        listen(this.svg, 'pointerup', event => this._pointerUp(event));
        listen(this.svg, 'pointercancel', event => this._pointerUp(event));
        this._render();
        this._syncInputs();
        return this;
    }

    setBusy(value) {
        this.busy = value === true;
        this._syncControls();
    }

    sync({ snapshot = null, imageUrl = null, busy = this.busy } = {}) {
        if (this.disposed) return;
        this.busy = busy === true;
        const image = snapshot?.image;
        const nextWidth = finite(image?.width);
        const nextHeight = finite(image?.height);
        if (nextWidth > 0) this.width = nextWidth;
        if (nextHeight > 0) this.height = nextHeight;
        if (!this.draft && !this.pending && snapshot?.chain) {
            const nextChain = cloneChain(snapshot.chain);
            if (nextChain) this.confirmedChain = nextChain;
        }
        if (this.imageNode && imageUrl) {
            this.imageNode.setAttribute?.('href', imageUrl);
            this.imageNode.setAttribute?.('xlink:href', imageUrl);
        }
        if (this.svg) this.svg.setAttribute?.('viewBox', `0 0 ${this.width} ${this.height}`);
        this._render();
        this._syncInputs();
        this._syncControls();
    }

    isDraft() { return Boolean(this.draft); }
    isPending() { return this.pending; }
    getConfirmed() { return cloneChain(this.confirmedChain); }
    getDraft() { return this.draft ? this._draftView() : null; }

    getSnapshotFields() {
        const chain = this.getConfirmed();
        return {
            rigMode: chain ? 'chain' : 'legacy',
            chain,
            chainDraft: this.getDraft(),
            chainEditPhase: this.pending ? 'commit' : this.draft ? 'draft' : 'idle',
            selectedJoint: this.selectedJoint,
            selectedPoint: this.selectedPoint,
            selectedWeight: this.selectedPoint,
            placementMode: this.placementMode,
        };
    }

    selectJoint(index, options = {}) {
        const count = this._activeChain()?.angles?.length || CHAIN_PRESETS.arm3.count;
        const next = clamp(Math.round(Number(index) || 0), 0, Math.max(0, count));
        this.selectedJoint = next;
        this._render();
        this._syncInputs();
        this.onSelectionChanged({ selectedJoint: next, selectedPoint: this.selectedPoint, focus: options.focus === true });
    }

    selectPoint(index, options = {}) {
        const next = clamp(Math.round(Number(index) || 0), 0, CHAIN_POINT_COUNT - 1);
        this.selectedPoint = next;
        this._render();
        this._syncInputs();
        this.onSelectionChanged({ selectedJoint: this.selectedJoint, selectedPoint: next, focus: options.focus === true });
    }

    setPlacementMode(value) {
        this.placementMode = value === true;
        this._syncControls();
        if (this.placementButton) {
            this.placementButton.textContent = this.placementMode ? '配置モードをOFF' : '配置モードをON';
            this.placementButton.setAttribute?.('aria-pressed', String(this.placementMode));
        }
        this._render();
        this.onMessage(this.placementMode ? '配置モード：markerをドラッグできます。' : '配置モードをOFFにしました。', 'mode');
        this.onSelectionChanged({ selectedJoint: this.selectedJoint, selectedPoint: this.selectedPoint, placementMode: this.placementMode });
    }

    setPreset(name) {
        if (this.disposed || this.pending || this.busy) return false;
        const preset = CHAIN_PRESETS[name];
        if (!preset) return false;
        if (!this._beginDraft(`preset-${name}`)) return false;
        this.draft.chain = createChainPreset(name, this.width, this.height);
        this.rawValues = rawValuesForChain(this.draft.chain);
        this.fieldValidity = {};
        this.fieldErrors = {};
        this.selectedJoint = 0;
        this.selectedPoint = 0;
        this._refreshDraftValidity();
        this._changed('draft');
        this.onMessage(`${preset.label}のlocal draftを作成しました。Applyでnativeへ反映します。`, 'draft');
        return true;
    }

    setCount(count) {
        const value = clamp(Math.round(Number(count) || 3), CHAIN_MIN_BONES, CHAIN_MAX_BONES);
        if (!this._beginDraft(`count-${value}`)) return false;
        this.draft.chain = createDefaultChain(this.width, this.height, value);
        this.rawValues = rawValuesForChain(this.draft.chain);
        this.fieldValidity = {};
        this.fieldErrors = {};
        this.selectedJoint = 0;
        this.selectedPoint = 0;
        this._refreshDraftValidity();
        this._changed('draft');
        return true;
    }

    _activeChain() { return this.draft?.chain || this.confirmedChain || null; }

    _beginDraft(reason) {
        if (this.disposed || this.pending || this.busy) return false;
        if (this.draft) return true;
        if (!this.canBeginDraft()) {
            this.onMessage('現在の操作中はchain draftを開始できません。', 'error');
            return false;
        }
        const base = this.confirmedChain || createDefaultChain(this.width, this.height, 3);
        this.draft = { chain: cloneChain(base), reason, phase: 'draft' };
        this.rawValues = rawValuesForChain(this.draft.chain);
        this.fieldValidity = {};
        this.fieldErrors = {};
        this._refreshDraftValidity();
        this.onDraftChanged(this._draftView());
        this.onPendingChanged();
        return true;
    }

    _fieldName(kind) {
        if (kind === 'joint-x') return `joints.${this.selectedJoint}.x`;
        if (kind === 'joint-y') return `joints.${this.selectedJoint}.y`;
        if (kind === 'angle') return `angles.${Math.min(this.selectedJoint, Math.max(0, (this._activeChain()?.angles?.length || 1) - 1))}`;
        if (kind === 'warp-x') return `warp.${this.selectedPoint}.x`;
        if (kind === 'warp-y') return `warp.${this.selectedPoint}.y`;
        if (kind === 'weight-a') return `weights.${this.selectedPoint}.a`;
        if (kind === 'weight-b') return `weights.${this.selectedPoint}.b`;
        if (kind === 'weight-mix') return `weights.${this.selectedPoint}.mix`;
        return null;
    }

    _handleInput(kind, raw) {
        if (!this._beginDraft(`input-${kind}`)) return;
        const field = this._fieldName(kind);
        if (!field) return;
        this.rawValues[field] = String(raw ?? '');
        const check = validateFieldRaw(this.rawValues[field], field, this.width, this.height, this.draft.chain.angles.length);
        this.fieldValidity[field] = check.ok;
        this.fieldErrors[field] = check.ok ? null : check.error;
        if (check.ok) this._setChainField(field, check.value);
        this._refreshDraftValidity();
        this._changed('draft');
    }

    _setChainField(field, value) {
        const match = /^(joints|angles|warp|weights)\.(\d+)(?:\.(x|y|a|b|mix))?$/u.exec(field);
        if (!match || !this.draft) return;
        const [, group, rawIndex, key] = match;
        const index = Number(rawIndex);
        if (group === 'angles') this.draft.chain.angles[index] = value;
        else if (this.draft.chain[group]?.[index]) this.draft.chain[group][index][key] = value;
    }

    _refreshDraftValidity() {
        if (!this.draft) return;
        const candidate = cloneChain(this.draft.chain);
        for (const field of allFields(candidate)) {
            const raw = this.rawValues[field];
            if (raw === undefined) continue;
            const check = validateFieldRaw(raw, field, this.width, this.height, candidate.angles.length);
            this.fieldValidity[field] = check.ok;
            this.fieldErrors[field] = check.ok ? null : check.error;
            if (check.ok) this._setCandidateField(candidate, field, check.value);
            else this._setCandidateField(candidate, field, NaN);
        }
        const result = validateChain(candidate, this.width, this.height);
        this.draft.chain = candidate;
        this.draft.valid = result.ok;
        this.draft.error = result.errors[0] || null;
    }

    _setCandidateField(candidate, field, value) {
        const match = /^(joints|angles|warp|weights)\.(\d+)(?:\.(x|y|a|b|mix))?$/u.exec(field);
        if (!match) return;
        const [, group, rawIndex, key] = match;
        const index = Number(rawIndex);
        if (group === 'angles') candidate.angles[index] = value;
        else if (candidate[group]?.[index]) candidate[group][index][key] = value;
    }

    _changed(phase = 'draft') {
        if (!this.draft) return;
        this.draft.phase = phase;
        this.onDraftChanged(this._draftView());
        this._render();
        this._syncInputs();
        this._syncControls();
        this.onPendingChanged();
    }

    _draftView() {
        if (!this.draft) return null;
        return {
            chain: cloneChain(this.draft.chain),
            value: cloneChain(this.draft.chain),
            rawValues: { ...this.rawValues },
            fieldValidity: { ...this.fieldValidity },
            fieldErrors: { ...this.fieldErrors },
            selectedJoint: this.selectedJoint,
            selectedPoint: this.selectedPoint,
            valid: this.draft.valid === true,
            error: this.draft.error || null,
            editPhase: this.pending ? 'commit' : this.draft.phase || 'draft',
            reason: this.draft.reason || null,
        };
    }

    async apply() {
        if (this.disposed || this.pending || !this.draft) return { ok: false, reason: 'no-draft' };
        this._refreshDraftValidity();
        if (!this.draft.valid) {
            this._changed('draft');
            this.onMessage(this.draft.error || 'chainの入力を確認してください。', 'error');
            return { ok: false, reason: 'invalid-draft' };
        }
        const token = ++this.generation;
        const draft = this._draftView();
        this.pending = true;
        this._changed('commit');
        this.onPendingChanged();
        try {
            const result = await this.onApply(draft);
            if (this.disposed || token !== this.generation) return { ok: false, reason: 'stale', suppressCancel: true };
            if (result?.ok === false) {
                this.pending = false;
                this._changed('draft');
                this.onPendingChanged();
                return result;
            }
            if (!result?.acceptedByCallback) this.commitAccepted(result?.chain || draft.chain);
            return { ok: true, acceptedByCallback: true, chain: this.confirmedChain };
        } catch (error) {
            if (!this.disposed && token === this.generation) {
                this.pending = false;
                this._changed('draft');
                this.onPendingChanged();
                this.onMessage(error?.message || 'chainを適用できませんでした。', 'error');
            }
            return { ok: false, reason: this.disposed || token !== this.generation ? 'stale' : (error?.message || 'apply-rejected') };
        }
    }

    commitAccepted(chain) {
        if (this.disposed) return false;
        const result = validateChain(chain, this.width, this.height);
        if (!result.ok) return false;
        this.confirmedChain = cloneChain(result.value);
        this.pending = false;
        this.draft = null;
        this.rawValues = {};
        this.fieldValidity = {};
        this.fieldErrors = {};
        this._render();
        this._syncInputs();
        this._syncControls();
        this.onDraftChanged(null);
        this.onPendingChanged();
        this.onMessage('chainをnativeへ適用しました。', 'ready');
        return true;
    }

    discard() {
        if (this.disposed || this.pending || !this.draft) return false;
        this.generation += 1;
        this.draft = null;
        this.rawValues = {};
        this.fieldValidity = {};
        this.fieldErrors = {};
        this._render();
        this._syncInputs();
        this._syncControls();
        this.onDraftChanged(null);
        this.onDiscard();
        this.onPendingChanged();
        this.onMessage('chainの変更を取り消しました。', 'ready');
        return true;
    }

    _pointerDown(event, kind) {
        const target = event.target?.closest?.(`[data-chain-${kind}-index]`);
        if (!target) return;
        const index = Number(target.dataset[`chain${kind[0].toUpperCase()}${kind.slice(1)}Index`]);
        if (!Number.isInteger(index)) return;
        if (kind === 'joint') this.selectJoint(index);
        else this.selectPoint(index);
        if (!this.placementMode || this.pending || this.busy) return;
        if (!this._beginDraft(`drag-${kind}`)) return;
        this.drag = { kind, index, pointerId: event.pointerId, token: this.generation };
        target.setPointerCapture?.(event.pointerId);
        event.preventDefault?.();
    }

    _pointerMove(event) {
        const drag = this.drag;
        if (!drag || drag.pointerId !== event.pointerId || this.disposed || !this.draft) return;
        const point = eventPoint(event, this.svg);
        if (!point) return;
        if (drag.kind === 'joint') {
            const x = round3(clamp(point.x, 0, this.width));
            const y = round3(clamp(point.y, 0, this.height));
            this._setChainField(`joints.${drag.index}.x`, x);
            this._setChainField(`joints.${drag.index}.y`, y);
            this.rawValues[`joints.${drag.index}.x`] = String(x);
            this.rawValues[`joints.${drag.index}.y`] = String(y);
        } else {
            const target = targetForWarp(drag.index, this.draft.chain, this.width, this.height);
            const x = round3(clamp(point.x - target.base.x, -this.width, this.width));
            const y = round3(clamp(point.y - target.base.y, -this.height, this.height));
            this._setChainField(`warp.${drag.index}.x`, x);
            this._setChainField(`warp.${drag.index}.y`, y);
            this.rawValues[`warp.${drag.index}.x`] = String(x);
            this.rawValues[`warp.${drag.index}.y`] = String(y);
        }
        this._refreshDraftValidity();
        this._changed('draft');
        event.preventDefault?.();
    }

    _pointerUp(event) {
        if (!this.drag || (event?.pointerId !== undefined && this.drag.pointerId !== event.pointerId)) return;
        this.drag = null;
        event?.preventDefault?.();
    }

    _syncInputs() {
        const chain = this._activeChain();
        if (!chain) return;
        const values = {
            jointX: this._valueFor('joint-x', chain),
            jointY: this._valueFor('joint-y', chain),
            angle: this._valueFor('angle', chain),
            warpX: this._valueFor('warp-x', chain),
            warpY: this._valueFor('warp-y', chain),
            weightA: this._valueFor('weight-a', chain),
            weightB: this._valueFor('weight-b', chain),
            weightMix: this._valueFor('weight-mix', chain),
        };
        for (const [name, input] of Object.entries(this.inputs)) {
            if (!input) continue;
            const value = values[name];
            const ownerDocument = input.ownerDocument || null;
            if (value !== undefined && (this.draft || input !== ownerDocument?.activeElement)) input.value = value;
            input.disabled = this.busy || this.pending;
        }
    }

    _valueFor(kind, chain) {
        const field = this._fieldName(kind);
        if (!field) return '';
        if (this.draft && Object.prototype.hasOwnProperty.call(this.rawValues, field)) return this.rawValues[field];
        const value = fieldNumber(chain, field);
        return value === null ? '' : String(value);
    }

    _syncControls() {
        if (this.applyButton) this.applyButton.disabled = this.busy || this.pending || !this.draft || this.draft.valid !== true;
        if (this.discardButton) this.discardButton.disabled = this.busy || this.pending || !this.draft;
        if (this.placementButton) this.placementButton.disabled = this.busy || this.pending;
        for (const button of Object.values(this.presetButtons)) if (button) button.disabled = this.busy || this.pending;
        if (this.root) {
            this.root.dataset.chainDraft = String(Boolean(this.draft));
            this.root.dataset.chainPending = String(this.pending);
            this.root.dataset.chainPlacementMode = String(this.placementMode);
        }
    }

    _render() {
        if (this.disposed) return;
        const chain = this._activeChain();
        if (!chain) {
            setSvgVisible(this.jointLayer, false);
            setSvgVisible(this.warpLayer, false);
            if (this.imageNode) {
                this.imageNode.style.opacity = this.placementMode ? '1' : '0';
                this.imageNode.setAttribute?.('aria-hidden', String(!this.placementMode));
            }
            return;
        }
        // The authoring image and markers are an explicit placement view. Keep
        // the native canvas unobstructed while placement mode is OFF.
        setSvgVisible(this.jointLayer, this.placementMode);
        setSvgVisible(this.warpLayer, this.placementMode);
        if (this.imageNode) {
            this.imageNode.style.opacity = this.placementMode ? '1' : '0';
            this.imageNode.setAttribute?.('aria-hidden', String(!this.placementMode));
        }
        if (this.svg) this.svg.setAttribute?.('viewBox', `0 0 ${this.width} ${this.height}`);
        const documentRef = this.svg?.ownerDocument || globalThis.document;
        if (this.jointLayer?.replaceChildren) {
            const children = [];
            chain.joints.forEach((point, index) => {
                if (index < chain.joints.length - 1) {
                    const next = chain.joints[index + 1];
                    children.push(svgElement(documentRef, 'line', {
                        x1: point.x, y1: point.y, x2: next.x, y2: next.y, class: 'chain-bone-line', 'data-chain-joint-index': index,
                    }));
                }
                children.push(svgElement(documentRef, 'circle', {
                    cx: point.x, cy: point.y, r: index === this.selectedJoint ? 6 : 4,
                    class: index === this.selectedJoint ? 'chain-joint selected' : 'chain-joint',
                    'data-chain-joint-index': index, tabindex: 0,
                }));
                const label = svgElement(documentRef, 'text', { x: point.x + 7, y: point.y - 7, class: 'chain-joint-label', 'pointer-events': 'none' });
                if (label) label.textContent = index === 0 ? 'Root' : `J${index}`;
                children.push(label);
            });
            this.jointLayer.replaceChildren(...children.filter(Boolean));
        }
        if (this.warpLayer?.replaceChildren) {
            const children = [];
            for (let index = 0; index < CHAIN_POINT_COUNT; index += 1) {
                const target = targetForWarp(index, chain, this.width, this.height);
                children.push(svgElement(documentRef, 'circle', {
                    cx: target.x, cy: target.y, r: index === this.selectedPoint ? 5 : 2.5,
                    class: index === this.selectedPoint ? 'chain-warp selected' : 'chain-warp',
                    'data-chain-warp-index': index, tabindex: 0,
                }));
            }
            this.warpLayer.replaceChildren(...children.filter(Boolean));
        }
        if (this.jointList?.replaceChildren) {
            const children = chain.joints.map((_, index) => {
                const button = documentRef?.createElement?.('button');
                if (!button) return null;
                button.type = 'button';
                button.dataset.chainJointIndex = String(index);
                button.textContent = index === 0 ? 'Root' : `関節${index}`;
                button.className = index === this.selectedJoint ? 'selected' : '';
                return button;
            });
            this.jointList.replaceChildren(...children.filter(Boolean));
        }
        if (this.pointList?.replaceChildren) {
            const children = Array.from({ length: CHAIN_POINT_COUNT }, (_, index) => {
                const button = documentRef?.createElement?.('button');
                if (!button) return null;
                button.type = 'button';
                button.dataset.chainPointIndex = String(index);
                button.textContent = String(index + 1);
                button.title = `warp点 ${index + 1}`;
                button.className = index === this.selectedPoint ? 'selected' : '';
                return button;
            });
            this.pointList.replaceChildren(...children.filter(Boolean));
        }
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.generation += 1;
        this.drag = null;
        for (const remove of this.listeners.splice(0)) {
            try { remove(); } catch {}
        }
        this.pending = false;
        this.draft = null;
    }
}

export { eventPoint as mapEventToSvgPoint };
