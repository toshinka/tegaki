/**
 * ROLE: WP-036 source-image influence map (editor-local derived view).
 * AUTHORITY: fixed source UV/profile/weight display and point selection only.
 * INVARIANTS: never evaluates skinning, changes native pose, starts a draft, or calls the server.
 * RELATED: mesh-profile.mjs、weight-editor.js、editor.js、WP-036。
 */
import {
    MESH_PROFILES,
    assertMeshProfile,
    getMeshProfileDefinition,
} from './mesh-profile.mjs';

export const INFLUENCE_SELECTION_SPACE = 'source-uv';

/**
 * Build the editor's runtime-only selection fields from the current controller
 * view. A live WeightEditorController view is authoritative over spread
 * snapshot values, including explicit null/false draft validity.
 */
export function deriveInfluenceSnapshotFields({ next = {}, previous = {}, selectionView = null } = {}) {
    if (selectionView) {
        return {
            selectedVertex: selectionView.selectedVertex || null,
            selectionSpace: INFLUENCE_SELECTION_SPACE,
            selectionProfile: selectionView.profile || next.meshProfile || previous.meshProfile || MESH_PROFILES.quad,
            selectedEndPercent: Object.hasOwn(selectionView, 'selectedEndPercent') ? selectionView.selectedEndPercent : null,
            selectedWeightValid: selectionView.selectedWeightValid === true,
            weightDraftActive: selectionView.weightDraftActive === true,
        };
    }
    const own = name => Object.hasOwn(next, name) ? next[name] : previous[name];
    return {
        selectedVertex: own('selectedVertex') || next.weightDraft?.selectedVertex || previous.selectedVertex || null,
        selectionSpace: own('selectionSpace') || INFLUENCE_SELECTION_SPACE,
        selectionProfile: own('selectionProfile') || next.weightDraft?.profile || next.meshProfile || previous.meshProfile || MESH_PROFILES.quad,
        selectedEndPercent: Object.hasOwn(next, 'selectedEndPercent')
            ? next.selectedEndPercent
            : Object.hasOwn(previous, 'selectedEndPercent') ? previous.selectedEndPercent : null,
        selectedWeightValid: Object.hasOwn(next, 'selectedWeightValid')
            ? next.selectedWeightValid === true
            : previous.selectedWeightValid === true,
        weightDraftActive: Object.hasOwn(next, 'weightDraftActive')
            ? next.weightDraftActive === true
            : Boolean(next.weightDraft) || previous.weightDraftActive === true,
    };
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';
const VISUAL_VERTEX_ORDER = Object.freeze([
    'TopLeft', 'TopCenter', 'TopRight',
    'MiddleLeft', 'Center', 'MiddleRight',
    'BottomLeft', 'BottomCenter', 'BottomRight',
]);

const POINT_LABELS = Object.freeze({
    TopLeft: '左上',
    TopCenter: '上中央',
    TopRight: '右上',
    MiddleLeft: '左中央',
    Center: '中央',
    MiddleRight: '右中央',
    BottomLeft: '左下',
    BottomCenter: '下中央',
    BottomRight: '右下',
});

function safeNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function clampPercent(value) {
    return Math.max(0, Math.min(100, safeNumber(value, 0)));
}

function percentText(value) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return '未確定';
    const numeric = Number(value);
    return `${Number(numeric.toFixed(2))}%`;
}

function rootPercent(value) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
    return 100 - Number(value);
}

function copyArray(value) {
    return Array.isArray(value) ? [...value] : null;
}

function sourcePointDefinitions(profile, width, height, weights, percentages, selectedVertex, validity) {
    const definition = getMeshProfileDefinition(profile);
    return definition.vertexNames.map((name, index) => {
        const [u, v] = definition.uvs[index];
        const valid = validity?.[name] !== false;
        const endPercent = valid && Number.isFinite(Number(percentages?.[index]))
            ? clampPercent(percentages[index])
            : null;
        return {
            name,
            label: POINT_LABELS[name] || name,
            sourceIndex: index,
            u,
            v,
            x: u * width,
            y: v * height,
            endWeight: Number.isInteger(weights?.[index]) ? weights[index] : null,
            endPercent,
            rootPercent: rootPercent(endPercent),
            valid,
            selected: name === selectedVertex,
        };
    });
}

function selectedName(value, names) {
    if (value && names.includes(value)) return value;
    if (names.includes('TopLeft')) return 'TopLeft';
    return names[0] || null;
}

function svgElement(tag) {
    return globalThis.document?.createElementNS?.(SVG_NS, tag) || null;
}

/**
 * Local source-image map. The controller receives derived weight data from the
 * editor and never reaches the server or native runtime itself.
 */
export class InfluenceMapController {
    constructor(options = {}) {
        this.root = options.root || null;
        this.svg = options.svg || null;
        this.imageNode = options.imageNode || null;
        this.pointLayer = options.pointLayer || null;
        this.buttonRoot = options.buttonRoot || null;
        this.selectionNode = options.selectionNode || null;
        this.statusNode = options.statusNode || null;
        this.getWeightView = options.getWeightView || (() => null);
        this.onSelectionChanged = options.onSelectionChanged;
        this.onFocusInput = options.onFocusInput;
        this.onMessage = options.onMessage;
        this.attached = false;
        this.disposed = false;
        this.interactive = false;
        this.ready = false;
        this.imageReady = false;
        this.imageLoadState = 'idle';
        this.imageLoadKey = null;
        this.imageToken = 0;
        this.imageListeners = [];
        this.listeners = [];
        this.pointListeners = [];
        this.points = new Map();
        this.buttons = new Map();
        this.profile = null;
        this.width = 0;
        this.height = 0;
        this.selectedVertex = null;
        this.currentViewState = null;
        this.view = {
            profile: MESH_PROFILES.quad,
            selectionSpace: INFLUENCE_SELECTION_SPACE,
            sourcePoints: [],
            visualPoints: [],
            selectedVertex: null,
            selectedEndPercent: null,
            selectedWeightValid: false,
            weightDraftValid: true,
            imageReady: false,
            interactive: false,
        };
    }

    attach() {
        if (this.attached || this.disposed) return;
        this.attached = true;
        for (const button of this.buttonRoot?.querySelectorAll?.('[data-influence-point]') || []) {
            const name = button.dataset?.influencePoint;
            if (!name) continue;
            this.buttons.set(name, button);
            const onClick = event => {
                event.preventDefault?.();
                this.select(name, { focusInput: true });
            };
            const onKeyDown = event => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault?.();
                this.select(name, { focusInput: true });
            };
            button.addEventListener?.('click', onClick);
            button.addEventListener?.('keydown', onKeyDown);
            this.listeners.push([button, 'click', onClick], [button, 'keydown', onKeyDown]);
        }
        this._setInteractive(false);
        this._setStatus('画像を読み込むと変形前の素材上の点を表示します。');
    }

    _setStatus(message, kind = '') {
        if (this.statusNode) {
            this.statusNode.textContent = message;
            this.statusNode.dataset.status = kind;
        }
        if (message) this.onMessage?.(message, kind);
    }

    _setStatusForView(view) {
        if (view?.weightDraftActive) {
            if (view.weightDraftValid === false) {
                this._setStatus('未適用draftに未確定の入力があります。native previewは適用前の確認済み状態です。', 'error');
            } else {
                this._setStatus('未適用draftの追従率を表示中です。native previewは適用前の確認済み状態です。', 'draft');
            }
            return;
        }
        this._setStatus('確認済みの追従率を表示中です。native previewは選択だけでは変更されません。', 'ready');
    }

    _setInteractive(value) {
        this.interactive = value === true && !this.disposed && this.imageReady;
        if (this.root) {
            this.root.dataset.ready = String(this.imageReady);
            this.root.dataset.interactive = String(this.interactive);
            this.root.dataset.selectionSpace = INFLUENCE_SELECTION_SPACE;
        }
        if (this.pointLayer) this.pointLayer.hidden = !this.imageReady;
        for (const button of this.buttons.values()) button.disabled = !this.interactive;
        for (const point of this.points.values()) {
            point.group?.setAttribute?.('aria-disabled', String(!this.interactive));
            point.group?.setAttribute?.('tabindex', this.interactive ? '0' : '-1');
        }
        this.view = { ...this.view, imageReady: this.imageReady, interactive: this.interactive };
    }

    _removeImageListeners() {
        for (const [node, type, handler] of this.imageListeners) node.removeEventListener?.(type, handler);
        this.imageListeners = [];
    }

    _setImage(url, width, height, imageKey = null) {
        const token = ++this.imageToken;
        this._removeImageListeners();
        this.imageReady = false;
        this.imageLoadState = url ? 'loading' : 'idle';
        this.imageLoadKey = imageKey;
        this._setInteractive(false);
        if (!this.imageNode) return;
        this.imageNode.hidden = true;
        this.imageNode.removeAttribute?.('href');
        this.imageNode.removeAttributeNS?.(XLINK_NS, 'href');
        if (!url) return;
        const loaded = () => {
            if (this.disposed || token !== this.imageToken) return;
            this.imageReady = true;
            this.imageLoadState = 'ready';
            this.imageNode.hidden = false;
            this._setInteractive(this.ready);
            this._setStatusForView(this.currentViewState);
        };
        const failed = () => {
            if (this.disposed || token !== this.imageToken) return;
            this.imageReady = false;
            this.imageLoadState = 'error';
            this.imageNode.hidden = true;
            this._setInteractive(false);
            this._setStatus('素材画像を表示できません。', 'error');
        };
        this.imageNode.addEventListener?.('load', loaded);
        this.imageNode.addEventListener?.('error', failed);
        this.imageListeners.push([this.imageNode, 'load', loaded], [this.imageNode, 'error', failed]);
        this.imageNode.setAttribute?.('x', '0');
        this.imageNode.setAttribute?.('y', '0');
        this.imageNode.setAttribute?.('width', String(width));
        this.imageNode.setAttribute?.('height', String(height));
        this.imageNode.setAttribute?.('preserveAspectRatio', 'none');
        this.imageNode.setAttribute?.('href', url);
        this.imageNode.setAttributeNS?.(XLINK_NS, 'href', url);
        this.imageNode.hidden = false;
    }

    _pointRadius() {
        return Math.max(7, Math.min(18, Math.min(this.width, this.height) * 0.045));
    }

    _createPoint(point) {
        const group = svgElement('g');
        const circle = svgElement('circle');
        const label = svgElement('text');
        const value = svgElement('text');
        if (!group || !circle || !label || !value) return null;
        group.dataset.influencePoint = point.name;
        group.setAttribute('role', 'button');
        group.setAttribute('tabindex', this.interactive ? '0' : '-1');
        group.setAttribute('aria-label', `${point.label}（${point.name}）`);
        group.style.cursor = 'pointer';
        circle.setAttribute('r', String(this._pointRadius()));
        label.setAttribute('class', 'influence-map-point-label');
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('pointer-events', 'none');
        value.setAttribute('class', 'influence-map-point-value');
        value.setAttribute('text-anchor', 'middle');
        value.setAttribute('pointer-events', 'none');
        group.append(circle, label, value);
        const onClick = event => {
            event.preventDefault?.();
            this.select(point.name, { focusInput: true });
        };
        const onKeyDown = event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault?.();
            this.select(point.name, { focusInput: true });
        };
        group.addEventListener?.('click', onClick);
        group.addEventListener?.('keydown', onKeyDown);
        this.pointListeners.push([group, 'click', onClick], [group, 'keydown', onKeyDown]);
        this.pointLayer?.append?.(group);
        return { group, circle, label, value };
    }

    _removePointListeners() {
        for (const [node, type, handler] of this.pointListeners) node.removeEventListener?.(type, handler);
        this.pointListeners = [];
    }

    _renderProfile(profile, points) {
        this._removePointListeners();
        this.points.clear();
        this.pointLayer?.replaceChildren?.();
        if (!this.pointLayer) return;
        for (const point of points) {
            const nodes = this._createPoint(point);
            if (!nodes) continue;
            this.points.set(point.name, nodes);
        }
        this.profile = profile;
    }

    _updatePoint(point) {
        const nodes = this.points.get(point.name);
        if (!nodes) return;
        const selected = point.selected === true;
        const fill = selected ? '#fff0d8' : '#800000';
        const color = selected ? '#ff8c42' : '#800000';
        nodes.group.setAttribute('transform', `translate(${point.x} ${point.y})`);
        nodes.group.setAttribute('aria-label', `${point.label}（${point.name}）End ${percentText(point.endPercent)} / Root ${point.rootPercent === null ? '未確定' : percentText(point.rootPercent)}`);
        nodes.group.dataset.selected = String(selected);
        nodes.group.dataset.endPercent = point.endPercent === null ? '' : String(point.endPercent);
        nodes.group.dataset.rootPercent = point.rootPercent === null ? '' : String(point.rootPercent);
        nodes.circle.setAttribute('fill', fill);
        nodes.circle.setAttribute('stroke', color);
        nodes.circle.setAttribute('stroke-width', selected ? '3' : '2');
        const radius = this._pointRadius();
        const isLeftEdge = point.u === 0;
        const isRightEdge = point.u === 1;
        const isTopEdge = point.v === 0;
        const isBottomEdge = point.v === 1;
        nodes.label.setAttribute('x', String(isLeftEdge ? radius + 4 : isRightEdge ? -(radius + 4) : 0));
        nodes.label.setAttribute('y', String(isTopEdge ? radius + 8 : isBottomEdge ? -(radius + 8) : -radius - 4));
        nodes.label.setAttribute('text-anchor', isLeftEdge ? 'start' : isRightEdge ? 'end' : 'middle');
        nodes.label.textContent = point.label;
        nodes.value.setAttribute('aria-hidden', 'true');
        nodes.value.textContent = '';
    }

    _updateButtons(points) {
        const active = new Set(points.map(point => point.name));
        for (const [name, button] of this.buttons) {
            const point = points.find(entry => entry.name === name);
            button.hidden = !active.has(name);
            button.dataset.selected = String(point?.selected === true);
            button.dataset.endPercent = point?.endPercent === null || point?.endPercent === undefined ? '' : String(point.endPercent);
            button.dataset.rootPercent = point?.rootPercent === null || point?.rootPercent === undefined ? '' : String(point.rootPercent);
            const label = button.querySelector?.('[data-influence-label]');
            const value = button.querySelector?.('[data-influence-value]');
            if (label) label.textContent = point ? `${point.label} / ${point.name}` : name;
            const end = value?.querySelector?.('[data-influence-end]');
            const root = value?.querySelector?.('[data-influence-root]');
            if (end && root) {
                end.textContent = `End ${percentText(point?.endPercent)}`;
                root.textContent = `Root ${point?.rootPercent === null || point?.rootPercent === undefined ? '未確定' : percentText(point.rootPercent)}`;
            } else if (value) {
                value.textContent = point ? `End ${percentText(point.endPercent)} / Root ${point.rootPercent === null ? '未確定' : percentText(point.rootPercent)}` : '未確定';
            }
        }
    }

    _render(points) {
        if (!this.svg) return;
        const margin = Math.max(12, Math.ceil(this._pointRadius() + 8));
        this.displayMargin = margin;
        this.svg.setAttribute('viewBox', `${-margin} ${-margin} ${this.width + margin * 2} ${this.height + margin * 2}`);
        this.svg.setAttribute('data-source-viewBox', `0 0 ${this.width} ${this.height}`);
        this.svg.setAttribute('width', String(this.width));
        this.svg.setAttribute('height', String(this.height));
        this.svg.style.aspectRatio = `${this.width} / ${this.height}`;
        this._renderProfile(points.profile, points.sourcePoints);
        for (const point of points.sourcePoints) this._updatePoint(point);
        this._updateButtons(points.sourcePoints);
        if (this.selectionNode) {
            const selected = points.sourcePoints.find(point => point.name === points.selectedVertex);
            this.selectionNode.textContent = selected
                ? `${selected.label} / ${selected.name} — End ${percentText(selected.endPercent)} / Root ${selected.rootPercent === null ? '未確定' : percentText(selected.rootPercent)}`
                : '未選択';
            this.selectionNode.dataset.valid = String(selected?.valid === true);
        }
    }

    _derive(state = {}) {
        const snapshot = state.snapshot || state || {};
        const weightView = state.weightView || this.getWeightView?.() || {};
        const profile = assertMeshProfile(weightView.profile || snapshot.selectionProfile || snapshot.meshProfile || MESH_PROFILES.quad);
        const image = snapshot.image || state.image || {};
        const width = Math.max(1, Math.round(safeNumber(image.width, this.width || 320)));
        const height = Math.max(1, Math.round(safeNumber(image.height, this.height || 200)));
        const names = getMeshProfileDefinition(profile).vertexNames;
        const selected = selectedName(weightView.selectedVertex || snapshot.selectedVertex || this.selectedVertex, names);
        const weights = copyArray(weightView.endWeights)
            || copyArray(weightView.meshWeights)
            || copyArray(snapshot.weightDraft?.endWeights)
            || copyArray(snapshot.meshWeights)
            || [];
        const percentages = copyArray(weightView.percentages)
            || copyArray(snapshot.weightDraft?.percentages)
            || weights.map(value => Number.isInteger(value) ? (value / 255) * 100 : null);
        const validity = weightView.fieldValidity || snapshot.weightDraft?.fieldValidity || null;
        const sourcePoints = sourcePointDefinitions(profile, width, height, weights, percentages, selected, validity);
        const pointByName = new Map(sourcePoints.map(point => [point.name, point]));
        const visualPoints = VISUAL_VERTEX_ORDER.filter(name => pointByName.has(name)).map(name => pointByName.get(name));
        const imageUrl = state.imageUrl || snapshot.imageUrl || null;
        const status = snapshot.status || 'error';
        const phase = snapshot.weightEditPhase || 'idle';
        const blocked = state.busy === true
            || snapshot.pending === true
            || snapshot.weightPending === true
            || status === 'loading'
            || status === 'error'
            || (status === 'building' && phase !== 'draft' && phase !== 'idle');
        const ready = Boolean(imageUrl && width > 0 && height > 0 && !blocked);
        const selectedPoint = sourcePoints.find(point => point.name === selected) || null;
        const weightDraftActive = weightView.weightDraftActive === true
            || snapshot.weightDraftActive === true
            || Boolean(snapshot.weightDraft);
        const weightDraftValid = !weightDraftActive
            || (validity ? Object.values(validity).every(value => value !== false) : snapshot.weightDraft?.valid !== false);
        return {
            profile,
            width,
            height,
            imageUrl,
            imageKey: imageUrl ? `${imageUrl}|${width}x${height}` : null,
            sourcePoints,
            visualPoints,
            selectedVertex: selected,
            selectedEndPercent: selectedPoint?.endPercent ?? null,
            selectedWeightValid: selectedPoint?.valid === true,
            weightDraftActive,
            weightDraftValid,
            imageReady: this.imageReady,
            ready,
            interactive: ready && this.imageReady,
        };
    }

    sync(state = {}) {
        if (this.disposed) return this.getView();
        if (!this.attached) this.attach();
        const next = this._derive(state);
        const profileChanged = this.profile !== next.profile;
        const sizeChanged = this.width !== next.width || this.height !== next.height;
        const imageKey = this.view.imageKey || null;
        this.profile = next.profile;
        this.width = next.width;
        this.height = next.height;
        this.ready = next.ready;
        this.selectedVertex = next.selectedVertex;
        this.currentViewState = next;
        if (profileChanged || sizeChanged) this._render(next);
        else {
            for (const point of next.sourcePoints) this._updatePoint(point);
            this._updateButtons(next.sourcePoints);
            if (this.selectionNode) {
                const selected = next.sourcePoints.find(point => point.name === next.selectedVertex);
                this.selectionNode.textContent = selected
                    ? `${selected.label} / ${selected.name} — End ${percentText(selected.endPercent)} / Root ${selected.rootPercent === null ? '未確定' : percentText(selected.rootPercent)}`
                    : '未選択';
                this.selectionNode.dataset.valid = String(selected?.valid === true);
            }
        }
        if (imageKey !== next.imageKey) this._setImage(next.imageUrl, next.width, next.height, next.imageKey);
        if (!next.imageUrl) {
            this.imageReady = false;
            this._setInteractive(false);
            this._setStatus('画像を読み込むと変形前の素材上の点を表示します。');
        } else if (!this.imageReady) {
            if (this.imageLoadState === 'error' && this.imageLoadKey === next.imageKey) {
                this._setStatus('素材画像を表示できません。', 'error');
            } else {
                this._setStatus('素材画像を読み込み中です。');
            }
        } else {
            this._setInteractive(next.interactive);
            this._setStatusForView(next);
        }
        this.view = {
            profile: next.profile,
            selectionSpace: INFLUENCE_SELECTION_SPACE,
            sourcePoints: next.sourcePoints.map(point => ({ ...point })),
            visualPoints: next.visualPoints.map(point => ({ ...point })),
            selectedVertex: next.selectedVertex,
            selectedEndPercent: next.selectedEndPercent,
            selectedWeightValid: next.selectedWeightValid,
            weightDraftActive: next.weightDraftActive,
            weightDraftValid: next.weightDraftValid,
            imageUrl: next.imageUrl,
            imageKey: next.imageKey,
            width: next.width,
            height: next.height,
            imageReady: this.imageReady,
            interactive: this.interactive,
        };
        return this.getView();
    }

    select(name, options = {}) {
        if (this.disposed || !this.interactive) return false;
        const names = getMeshProfileDefinition(this.profile || MESH_PROFILES.quad).vertexNames;
        if (!names.includes(name)) return false;
        const changed = this.selectedVertex !== name;
        this.selectedVertex = name;
        if (changed) {
            this.onSelectionChanged?.(name, { selectionSpace: INFLUENCE_SELECTION_SPACE });
            const current = this.view.sourcePoints.find(point => point.name === name);
            if (current) {
                const sourcePoints = this.view.sourcePoints.map(point => ({ ...point, selected: point.name === name }));
                const pointByName = new Map(sourcePoints.map(point => [point.name, point]));
                const visualPoints = VISUAL_VERTEX_ORDER.filter(pointName => pointByName.has(pointName)).map(pointName => pointByName.get(pointName));
                for (const point of sourcePoints) this._updatePoint(point);
                this._updateButtons(sourcePoints);
                this.view = {
                    ...this.view,
                    sourcePoints,
                    visualPoints,
                    selectedVertex: name,
                    selectedEndPercent: current.endPercent,
                    selectedWeightValid: current.valid === true,
                };
                if (this.selectionNode) {
                    this.selectionNode.textContent = `${current.label} / ${current.name} — End ${percentText(current.endPercent)} / Root ${current.rootPercent === null ? '未確定' : percentText(current.rootPercent)}`;
                    this.selectionNode.dataset.valid = String(current.valid === true);
                }
            }
        }
        if (options.focusInput !== false) this.onFocusInput?.(name);
        return true;
    }

    getView() {
        return {
            ...this.view,
            sourcePoints: this.view.sourcePoints.map(point => ({ ...point })),
            visualPoints: this.view.visualPoints.map(point => ({ ...point })),
        };
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.imageToken += 1;
        this._removeImageListeners();
        this._removePointListeners();
        for (const [node, type, handler] of this.listeners) node.removeEventListener?.(type, handler);
        this.listeners = [];
        this.points.clear();
        this.buttons.clear();
        this._setInteractive(false);
        this.imageNode?.removeAttribute?.('href');
        this.imageNode?.removeAttributeNS?.(XLINK_NS, 'href');
        this.imageNode && (this.imageNode.hidden = true);
    }
}

export { POINT_LABELS, VISUAL_VERTEX_ORDER };
