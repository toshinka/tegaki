/**
 * ROLE: WP-034 Slice A の四隅 weight draft UI controller。
 * AUTHORITY: input/preset の一時 draft だけ。source、CLI、native runtime、History は所有しない。
 * INVARIANTS: draft は Apply まで compile せず、Apply は一度だけ、Discard は確認済み bytes を復元する。
 * RELATED: weight-model.mjs、editor.js、editor.html、WP-034-rive-weights-playback.md。
 */
import {
    VERTEX_NAMES,
    DEFAULT_END_WEIGHTS,
    assertEndWeights,
    endPercentToByte,
    endWeightsToPercentages,
} from './weight-model.mjs';

export const WEIGHT_PRESETS = Object.freeze({
    initial: Object.freeze([0, 255, 255, 0]),
    root: Object.freeze([0, 0, 0, 0]),
    end: Object.freeze([255, 255, 255, 255]),
    even: Object.freeze([128, 128, 128, 128]),
});

function copyBytes(value) {
    return assertEndWeights(value).slice();
}

function copyDraft(draft) {
    if (!draft) return null;
    return {
        endWeights: draft.endWeights ? copyBytes(draft.endWeights) : null,
        percentages: Array.isArray(draft.percentages) ? [...draft.percentages] : null,
        rawValues: draft.rawValues ? { ...draft.rawValues } : null,
        fieldValidity: draft.fieldValidity ? { ...draft.fieldValidity } : null,
        fieldErrors: draft.fieldErrors ? { ...draft.fieldErrors } : null,
        selectedVertex: draft.selectedVertex || null,
        valid: draft.valid === true,
        error: draft.error || null,
    };
}

/**
 * Browser-side draft controller. All persistence/native effects are callbacks supplied by editor.js.
 */
export class WeightEditorController {
    constructor(options = {}) {
        this.inputs = new Map(VERTEX_NAMES.map(name => [name, options.inputs?.[name] || null]));
        this.root = options.root || null;
        this.rootOutputs = options.rootOutputs || {};
        this.applyButton = options.applyButton || null;
        this.discardButton = options.discardButton || null;
        this.presetButtons = options.presetButtons || {};
        this.onDraftChanged = options.onDraftChanged;
        this.onApply = options.onApply;
        this.onDiscard = options.onDiscard;
        this.onMessage = options.onMessage;
        this.onSelectionChanged = options.onSelectionChanged;
        this.onPendingChanged = options.onPendingChanged;
        this.canBeginDraft = options.canBeginDraft || (() => true);
        this.confirmed = copyBytes(options.initialWeights || DEFAULT_END_WEIGHTS);
        this.draft = null;
        this.pending = false;
        this.disposed = false;
        this.attached = false;
        this._listeners = [];
    }

    attach() {
        if (this.attached || this.disposed) return;
        this.attached = true;
        for (const [name, input] of this.inputs) {
            if (!input) continue;
            const onInput = () => this._input(name);
            const onFocus = () => {
                this._select(name);
            };
            input.addEventListener('input', onInput);
            input.addEventListener('focus', onFocus);
            this._listeners.push([input, 'input', onInput], [input, 'focus', onFocus]);
        }
        for (const [preset, button] of Object.entries(this.presetButtons)) {
            if (!button) continue;
            const handler = event => {
                event.preventDefault();
                this.setPreset(preset);
            };
            button.addEventListener('click', handler);
            this._listeners.push([button, 'click', handler]);
        }
        if (this.applyButton) {
            const handler = event => {
                event.preventDefault();
                void this.apply();
            };
            this.applyButton.addEventListener('click', handler);
            this._listeners.push([this.applyButton, 'click', handler]);
        }
        if (this.discardButton) {
            const handler = event => {
                event.preventDefault();
                this.discard();
            };
            this.discardButton.addEventListener('click', handler);
            this._listeners.push([this.discardButton, 'click', handler]);
        }
        this._renderConfirmed();
        this._renderControls();
    }

    _select(name) {
        if (!VERTEX_NAMES.includes(name)) return;
        if (this.root) this.root.dataset.selectedVertex = name;
        this.onSelectionChanged?.(name, Boolean(this.draft));
        if (this.draft) {
            this.draft.selectedVertex = name;
            this._notifyDraft();
        }
    }

    _beginDraft(selectedVertex = null) {
        if (this.pending || this.draft || !this.canBeginDraft()) return false;
        this.draft = {
            endWeights: copyBytes(this.confirmed),
            percentages: endWeightsToPercentages(this.confirmed),
            rawValues: Object.fromEntries(VERTEX_NAMES.map((name, index) => [name, String(endWeightsToPercentages(this.confirmed)[index])])),
            fieldValidity: Object.fromEntries(VERTEX_NAMES.map(name => [name, true])),
            fieldErrors: Object.fromEntries(VERTEX_NAMES.map(name => [name, null])),
            selectedVertex: selectedVertex || null,
            valid: true,
        };
        this._renderControls();
        this.onMessage?.('四隅の骨への追従を編集中です。適用または変更を戻すを選択してください。', 'draft');
        return true;
    }

    _readPercent(value, name) {
        if (value === '' || value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) throw new Error(`${name}のEnd追従率を入力してください。`);
        const numeric = Number(value);
        if (!Number.isFinite(numeric) || numeric < 0 || numeric > 100) throw new Error(`${name}のEnd追従率は0〜100%です。`);
        return endPercentToByte(numeric);
    }

    _validateDraft() {
        if (!this.draft) return false;
        const endWeights = copyBytes(this.draft.endWeights || this.confirmed);
        const fieldValidity = {};
        const fieldErrors = {};
        let valid = true;
        for (const [index, name] of VERTEX_NAMES.entries()) {
            try {
                const byte = this._readPercent(this.draft.rawValues?.[name], name);
                endWeights[index] = byte;
                fieldValidity[name] = true;
                fieldErrors[name] = null;
            } catch (error) {
                valid = false;
                fieldValidity[name] = false;
                fieldErrors[name] = error.message;
            }
        }
        this.draft.endWeights = endWeights;
        this.draft.percentages = endWeightsToPercentages(endWeights);
        this.draft.fieldValidity = fieldValidity;
        this.draft.fieldErrors = fieldErrors;
        this.draft.valid = valid;
        this.draft.error = valid ? null : Object.values(fieldErrors).find(Boolean) || 'End追従率を確認してください。';
        return valid;
    }

    _input(name) {
        if (this.disposed || this.pending) return;
        const rawValue = String(this.inputs.get(name)?.value ?? '');
        if (!this.draft && !this._beginDraft(name)) return;
        this._select(name);
        this.draft.rawValues[name] = rawValue;
        const valid = this._validateDraft();
        this._renderControls();
        this._notifyDraft();
        if (!valid) this.onMessage?.(this.draft.error || 'End追従率を確認してください。', 'error');
    }

    setPreset(name) {
        if (this.disposed || this.pending || !WEIGHT_PRESETS[name]) return { ok: false, reason: 'preset-unavailable' };
        if (!this.draft && !this._beginDraft()) return { ok: false, reason: 'editor-not-ready' };
        this.draft.endWeights = copyBytes(WEIGHT_PRESETS[name]);
        this.draft.percentages = endWeightsToPercentages(this.draft.endWeights);
        this.draft.rawValues = Object.fromEntries(VERTEX_NAMES.map((vertex, index) => [vertex, String(this.draft.percentages[index])]));
        this.draft.fieldValidity = Object.fromEntries(VERTEX_NAMES.map(vertex => [vertex, true]));
        this.draft.fieldErrors = Object.fromEntries(VERTEX_NAMES.map(vertex => [vertex, null]));
        this.draft.error = null;
        this.draft.valid = true;
        this._renderControls();
        this._notifyDraft();
        this.onMessage?.(`プリセット「${name}」を編集中です。`, 'draft');
        return { ok: true, draft: copyDraft(this.draft) };
    }

    async apply() {
        if (this.disposed || this.pending) return { ok: false, reason: 'apply-pending' };
        if (!this.draft) return { ok: false, reason: 'no-draft' };
        this._validateDraft();
        this._renderControls();
        if (!this.draft?.valid) {
            this.onMessage?.('End追従率を確認してください。', 'error');
            this._notifyDraft();
            return { ok: false, reason: 'draft-invalid' };
        }
        const draft = copyDraft(this.draft);
        this.pending = true;
        this.onPendingChanged?.(true);
        this._renderControls();
        this.onMessage?.('四隅の追従率を公式CLIで一度だけ適用中…', 'commit');
        try {
            const result = await this.onApply?.(draft);
            if (result?.ok === true) {
                if (result.acceptedByCallback !== true) this.commitAccepted(result.snapshot?.meshWeights || draft.endWeights);
                return result;
            }
            this.pending = false;
            this.onPendingChanged?.(false);
            this._renderControls();
            this.onMessage?.(result?.reason || 'weight適用を取り消しました。', 'error');
            return result || { ok: false, reason: 'weight-commit-rejected' };
        } catch (error) {
            this.pending = false;
            this.onPendingChanged?.(false);
            this._renderControls();
            this.onMessage?.(error?.message || 'weight適用に失敗しました。', 'error');
            return { ok: false, reason: error?.message || 'weight-commit-rejected' };
        }
    }

    commitAccepted(value) {
        this.confirmed = copyBytes(value);
        this.draft = null;
        this.pending = false;
        this.onPendingChanged?.(false);
        this._renderConfirmed();
        this._renderControls();
        this.onDraftChanged?.(null);
        this.onMessage?.('四隅の追従率を適用しました。', 'ready');
    }

    discard() {
        if (this.disposed || this.pending || !this.draft) return { ok: false, reason: 'no-draft' };
        const restored = copyBytes(this.confirmed);
        this.draft = null;
        this.onPendingChanged?.(false);
        this._renderConfirmed();
        this._renderControls();
        this.onDraftChanged?.(null);
        this.onDiscard?.(restored);
        this.onMessage?.('四隅の追従率の変更を戻しました。', 'ready');
        return { ok: true, endWeights: restored };
    }

    loadCommitted(value) {
        if (this.disposed || this.draft) return { ok: false, reason: 'draft-active' };
        this.confirmed = copyBytes(value);
        this._renderConfirmed();
        this._renderControls();
        return { ok: true, endWeights: [...this.confirmed] };
    }

    _renderConfirmed() {
        const percentages = endWeightsToPercentages(this.confirmed);
        for (const [index, name] of VERTEX_NAMES.entries()) {
            const input = this.inputs.get(name);
            if (input) input.value = String(percentages[index]);
            const rootOutput = this.rootOutputs[name];
            if (rootOutput) rootOutput.textContent = `End ${percentages[index]}% / Root ${(100 - percentages[index]).toFixed(2).replace(/\.00$/, '')}%`;
        }
    }

    _renderControls() {
        const active = Boolean(this.draft);
        for (const input of this.inputs.values()) if (input) input.disabled = this.pending;
        for (const button of Object.values(this.presetButtons)) if (button) button.disabled = this.pending;
        if (this.applyButton) this.applyButton.disabled = !active || this.pending;
        if (this.discardButton) this.discardButton.disabled = !active || this.pending;
        if (this.root) {
            this.root.dataset.draft = String(active);
            this.root.dataset.pending = String(this.pending);
        }
        if (this.draft) {
            const percentages = this.draft.percentages || [];
            for (const [index, name] of VERTEX_NAMES.entries()) {
                const input = this.inputs.get(name);
                if (input && this.draft.rawValues && Object.hasOwn(this.draft.rawValues, name)) input.value = this.draft.rawValues[name];
                const rootOutput = this.rootOutputs[name];
                if (rootOutput) {
                    if (this.draft.fieldValidity?.[name] !== false && Number.isFinite(percentages[index])) rootOutput.textContent = `End ${percentages[index]}% / Root ${(100 - percentages[index]).toFixed(2).replace(/\.00$/, '')}%`;
                    else rootOutput.textContent = 'Root —';
                }
            }
        }
    }

    _notifyDraft(error = undefined) {
        if (!this.draft) {
            this.onDraftChanged?.(null);
            return;
        }
        const value = copyDraft(this.draft);
        if (error !== undefined) value.error = error?.message || null;
        this.onDraftChanged?.(value);
    }

    isDraft() {
        return Boolean(this.draft);
    }

    getDraft() {
        return copyDraft(this.draft);
    }

    isPending() {
        return this.pending;
    }

    dispose() {
        this.disposed = true;
        this.pending = false;
        this.onPendingChanged?.(false);
        for (const [node, event, handler] of this._listeners) node.removeEventListener(event, handler);
        this._listeners = [];
        this.draft = null;
        this.attached = false;
    }
}

