/**
 * ROLE: WP-034 の四隅と WP-035 の quad/grid3 weight/profile draft UI controller。
 * AUTHORITY: input/profile/preset の一時 draft だけ。source、CLI、native runtime、History は所有しない。
 * INVARIANTS: draft は Apply まで compile せず、Apply は一度だけ、Discard は確認済み profile/bytes を復元する。
 * RELATED: weight-model.mjs、mesh-profile.mjs、editor.js、editor.html、WP-035 card。
 */
import {
    VERTEX_NAMES,
    DEFAULT_END_WEIGHTS,
    byteToEndPercent,
    endPercentToByte,
} from './weight-model.mjs';
import {
    MESH_PROFILES,
    assertMeshProfile,
    assertMeshWeights,
    convertMeshWeights,
    getMeshProfileDefinition,
    gridWeightsFromQuad,
} from './mesh-profile.mjs';

export const WEIGHT_PRESETS = Object.freeze({
    initial: Object.freeze([0, 255, 255, 0]),
    root: Object.freeze([0, 0, 0, 0]),
    end: Object.freeze([255, 255, 255, 255]),
    even: Object.freeze([128, 128, 128, 128]),
});

export const PROFILE_WEIGHT_PRESETS = Object.freeze({
    quad: WEIGHT_PRESETS,
    grid3: Object.freeze({
        initial: Object.freeze([0, 128, 255, 255, 255, 128, 0, 0, 128]),
        root: Object.freeze(new Array(9).fill(0)),
        end: Object.freeze(new Array(9).fill(255)),
        even: Object.freeze(new Array(9).fill(128)),
    }),
});

const ALL_VERTEX_NAMES = Object.freeze([...new Set([
    ...getMeshProfileDefinition(MESH_PROFILES.quad).vertexNames,
    ...getMeshProfileDefinition(MESH_PROFILES.grid3).vertexNames,
])]);

function defaultWeights(profile) {
    return profile === MESH_PROFILES.grid3 ? gridWeightsFromQuad(DEFAULT_END_WEIGHTS) : DEFAULT_END_WEIGHTS;
}

function copyBytes(profile, value) {
    return assertMeshWeights(profile, value).slice();
}

function weightsToPercentages(profile, value) {
    return assertMeshWeights(profile, value).map(byteToEndPercent);
}

function copyDraft(draft) {
    if (!draft) return null;
    const profile = draft.profile || MESH_PROFILES.quad;
    return {
        profile,
        endWeights: draft.endWeights ? copyBytes(profile, draft.endWeights) : null,
        percentages: Array.isArray(draft.percentages) ? [...draft.percentages] : null,
        rawValues: draft.rawValues ? { ...draft.rawValues } : null,
        fieldValidity: draft.fieldValidity ? { ...draft.fieldValidity } : null,
        fieldErrors: draft.fieldErrors ? { ...draft.fieldErrors } : null,
        selectedVertex: draft.selectedVertex || null,
        valid: draft.valid === true,
        error: draft.error || null,
        profileChange: draft.profileChange ? { ...draft.profileChange } : null,
    };
}

/** Browser-side draft controller. Persistence/native effects are callbacks supplied by editor.js. */
export class WeightEditorController {
    constructor(options = {}) {
        this.confirmedProfile = assertMeshProfile(options.profile);
        this.vertexNames = getMeshProfileDefinition(this.confirmedProfile).vertexNames;
        this.inputs = new Map(ALL_VERTEX_NAMES.map(name => [name, options.inputs?.[name] || null]));
        this.root = options.root || null;
        this.profileSelect = options.profileSelect || null;
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
        this.centerAtRotationPivot = options.centerAtRotationPivot === true;
        this.confirmed = copyBytes(this.confirmedProfile, options.initialWeights || defaultWeights(this.confirmedProfile));
        this.draft = null;
        this.selectedVertex = null;
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
            const onFocus = () => this._select(name);
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
        if (this.profileSelect) {
            const handler = event => this.setProfile(event?.target?.value ?? this.profileSelect.value);
            this.profileSelect.addEventListener('change', handler);
            this._listeners.push([this.profileSelect, 'change', handler]);
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

    _currentProfile() {
        return this.draft?.profile || this.confirmedProfile;
    }

    _currentNames() {
        return getMeshProfileDefinition(this._currentProfile()).vertexNames;
    }

    _select(name, options = {}) {
        if (!this._currentNames().includes(name)) return;
        const changed = this.selectedVertex !== name;
        this.selectedVertex = name;
        if (this.root) this.root.dataset.selectedVertex = name;
        if (changed) this.onSelectionChanged?.(name, Boolean(this.draft));
        if (this.draft) {
            this.draft.selectedVertex = name;
            if (changed) this._notifyDraft();
        }
        if (options.focus === true) this.inputs.get(name)?.focus?.();
    }

    selectVertex(name, options = {}) {
        if (this.disposed || this.pending || !this._currentNames().includes(name)) return false;
        this._select(name, { focus: options.focus === true });
        return true;
    }

    _normalizeSelection(profile = this._currentProfile(), notify = true) {
        const names = getMeshProfileDefinition(profile).vertexNames;
        const next = this.selectedVertex && names.includes(this.selectedVertex)
            ? this.selectedVertex
            : names.includes('TopLeft') ? 'TopLeft' : names[0] || null;
        const changed = this.selectedVertex !== next;
        this.selectedVertex = next;
        if (next && this.root) this.root.dataset.selectedVertex = next;
        if (this.draft) this.draft.selectedVertex = next;
        if (changed && notify && next) this.onSelectionChanged?.(next, Boolean(this.draft));
        return next;
    }

    _beginDraft(selectedVertex = null) {
        return this._beginDraftForProfile(this.confirmedProfile, selectedVertex);
    }

    _beginDraftForProfile(profile, selectedVertex = null) {
        if (this.pending || this.draft || !this.canBeginDraft()) return false;
        const safeProfile = assertMeshProfile(profile);
        const initialWeights = safeProfile === this.confirmedProfile
            ? this.confirmed
            : convertMeshWeights(this.confirmed, this.confirmedProfile, safeProfile);
        const percentages = weightsToPercentages(safeProfile, initialWeights);
        const names = getMeshProfileDefinition(safeProfile).vertexNames;
        const requestedSelected = selectedVertex || this.selectedVertex;
        const normalizedSelected = requestedSelected && names.includes(requestedSelected)
            ? requestedSelected
            : names.includes('TopLeft') ? 'TopLeft' : names[0] || null;
        this.selectedVertex = normalizedSelected;
        this.draft = {
            profile: safeProfile,
            endWeights: copyBytes(safeProfile, initialWeights),
            percentages,
            rawValues: Object.fromEntries(names.map((name, index) => [name, String(percentages[index])])),
            fieldValidity: Object.fromEntries(names.map(name => [name, true])),
            fieldErrors: Object.fromEntries(names.map(name => [name, null])),
            selectedVertex: normalizedSelected,
            valid: true,
            profileChange: safeProfile === this.confirmedProfile ? null : {
                from: this.confirmedProfile,
                to: safeProfile,
                discardedInternalWeights: this.confirmedProfile === MESH_PROFILES.grid3 && safeProfile === MESH_PROFILES.quad,
            },
        };
        this._normalizeSelection(safeProfile);
        this._renderControls();
        this.onMessage?.(safeProfile === MESH_PROFILES.grid3
            ? '9点の骨への追従を編集中です。適用または変更を戻すを選択してください。'
            : '四隅の骨への追従を編集中です。適用または変更を戻すを選択してください。', 'draft');
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
        const profile = assertMeshProfile(this.draft.profile);
        const names = getMeshProfileDefinition(profile).vertexNames;
        const endWeights = copyBytes(profile, this.draft.endWeights || convertMeshWeights(this.confirmed, this.confirmedProfile, profile));
        const fieldValidity = {};
        const fieldErrors = {};
        let valid = true;
        for (const [index, name] of names.entries()) {
            try {
                endWeights[index] = this._readPercent(this.draft.rawValues?.[name], name);
                fieldValidity[name] = true;
                fieldErrors[name] = null;
            } catch (error) {
                valid = false;
                fieldValidity[name] = false;
                fieldErrors[name] = error.message;
            }
        }
        this.draft.endWeights = endWeights;
        this.draft.percentages = weightsToPercentages(profile, endWeights);
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

    setProfile(profile) {
        if (this.disposed || this.pending) return { ok: false, reason: 'profile-pending' };
        const safeProfile = assertMeshProfile(profile);
        if (safeProfile === this._currentProfile()) return { ok: true, profile: safeProfile, draft: copyDraft(this.draft) };
        if (this.draft && !this._validateDraft()) {
            this._renderControls();
            this.onMessage?.(this.draft.error || 'End追従率を確認してからメッシュを切り替えてください。', 'error');
            return { ok: false, reason: 'draft-invalid', profile: this.draft.profile, draft: copyDraft(this.draft) };
        }
        if (!this.draft && !this._beginDraftForProfile(safeProfile)) return { ok: false, reason: 'editor-not-ready' };
        const previousProfile = this.draft.profile;
        const converted = convertMeshWeights(this.draft.endWeights, previousProfile, safeProfile);
        const names = getMeshProfileDefinition(safeProfile).vertexNames;
        const percentages = weightsToPercentages(safeProfile, converted);
        this.draft.profile = safeProfile;
        this.draft.endWeights = converted;
        this.draft.percentages = percentages;
        this.draft.rawValues = Object.fromEntries(names.map((name, index) => [name, String(percentages[index])]));
        this.draft.fieldValidity = Object.fromEntries(names.map(name => [name, true]));
        this.draft.fieldErrors = Object.fromEntries(names.map(name => [name, null]));
        this.draft.valid = true;
        this.draft.error = null;
        this.draft.profileChange = safeProfile === this.confirmedProfile ? null : {
            from: this.confirmedProfile,
            to: safeProfile,
            discardedInternalWeights: this.confirmedProfile === MESH_PROFILES.grid3 && safeProfile === MESH_PROFILES.quad,
        };
        this._normalizeSelection(safeProfile);
        this._renderControls();
        this._notifyDraft();
        if (this.confirmedProfile === MESH_PROFILES.grid3 && safeProfile === MESH_PROFILES.quad) {
            this.onMessage?.('9点から四隅へ切り替えます。内部weightは適用時に破棄されます。', 'draft');
        } else {
            this.onMessage?.(safeProfile === MESH_PROFILES.grid3
                ? 'メッシュ: 9点を編集中です。適用または変更を戻すを選択してください。'
                : 'メッシュ: 四隅を編集中です。適用または変更を戻すを選択してください。', 'draft');
        }
        return { ok: true, profile: safeProfile, draft: copyDraft(this.draft) };
    }

    setPreset(name) {
        const profile = this._currentProfile();
        const presets = PROFILE_WEIGHT_PRESETS[profile];
        if (this.disposed || this.pending || !presets?.[name]) return { ok: false, reason: 'preset-unavailable' };
        if (!this.draft && !this._beginDraft()) return { ok: false, reason: 'editor-not-ready' };
        const names = getMeshProfileDefinition(this.draft.profile).vertexNames;
        this.draft.endWeights = copyBytes(this.draft.profile, presets[name]);
        this.draft.percentages = weightsToPercentages(this.draft.profile, this.draft.endWeights);
        this.draft.rawValues = Object.fromEntries(names.map((vertex, index) => [vertex, String(this.draft.percentages[index])]));
        this.draft.fieldValidity = Object.fromEntries(names.map(vertex => [vertex, true]));
        this.draft.fieldErrors = Object.fromEntries(names.map(vertex => [vertex, null]));
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
        this.onMessage?.(`${draft.profile === MESH_PROFILES.grid3 ? '9点' : '四隅'}の追従率を公式CLIで一度だけ適用中…`, 'commit');
        try {
            const result = await this.onApply?.(draft);
            if (result?.ok === true) {
                if (result.acceptedByCallback !== true) this.commitAccepted(result.snapshot?.meshProfile || draft.profile, result.snapshot?.meshWeights || draft.endWeights);
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

    commitAccepted(profileOrValue, maybeValue) {
        const profile = Array.isArray(profileOrValue) || profileOrValue instanceof Uint8Array ? this._currentProfile() : assertMeshProfile(profileOrValue);
        const value = maybeValue === undefined ? profileOrValue : maybeValue;
        this.confirmedProfile = profile;
        this.vertexNames = getMeshProfileDefinition(profile).vertexNames;
        this.confirmed = copyBytes(profile, value);
        this.draft = null;
        this._normalizeSelection(profile);
        this.pending = false;
        this.onPendingChanged?.(false);
        this._renderConfirmed();
        this._renderControls();
        this.onDraftChanged?.(null);
        this.onMessage?.(`${profile === MESH_PROFILES.grid3 ? '9点' : '四隅'}の追従率を適用しました。`, 'ready');
    }

    discard() {
        if (this.disposed || this.pending || !this.draft) return { ok: false, reason: 'no-draft' };
        const restored = copyBytes(this.confirmedProfile, this.confirmed);
        this.draft = null;
        this._normalizeSelection(this.confirmedProfile);
        this.onPendingChanged?.(false);
        this._renderConfirmed();
        this._renderControls();
        this.onDraftChanged?.(null);
        this.onDiscard?.({ profile: this.confirmedProfile, endWeights: restored });
        this.onMessage?.('メッシュと追従率の変更を戻しました。', 'ready');
        return { ok: true, profile: this.confirmedProfile, endWeights: restored };
    }

    loadCommitted(profileOrValue, maybeValue) {
        if (this.disposed || this.draft) return { ok: false, reason: 'draft-active' };
        const profile = maybeValue === undefined ? this.confirmedProfile : assertMeshProfile(profileOrValue);
        const value = maybeValue === undefined ? profileOrValue : maybeValue;
        this.confirmedProfile = profile;
        this.vertexNames = getMeshProfileDefinition(profile).vertexNames;
        this.confirmed = copyBytes(profile, value);
        this._normalizeSelection(profile);
        this._renderConfirmed();
        this._renderControls();
        return { ok: true, profile, endWeights: [...this.confirmed] };
    }

    _renderConfirmed() {
        const percentages = weightsToPercentages(this.confirmedProfile, this.confirmed);
        for (const [index, name] of getMeshProfileDefinition(this.confirmedProfile).vertexNames.entries()) {
            const input = this.inputs.get(name);
            if (input) input.value = String(percentages[index]);
            const rootOutput = this.rootOutputs[name];
            if (rootOutput) rootOutput.textContent = `End ${percentages[index]}% / Root ${(100 - percentages[index]).toFixed(2).replace(/\.00$/, '')}%`;
        }
    }

    _renderControls() {
        const active = Boolean(this.draft);
        const profile = this._currentProfile();
        const names = getMeshProfileDefinition(profile).vertexNames;
        for (const [name, input] of this.inputs) {
            if (!input) continue;
            input.disabled = this.pending || !names.includes(name);
            const wrapper = input.closest?.('[data-profile-vertex]');
            if (wrapper) wrapper.hidden = !names.includes(name);
        }
        for (const button of Object.values(this.presetButtons)) if (button) button.disabled = this.pending;
        if (this.profileSelect) {
            this.profileSelect.value = profile;
            this.profileSelect.disabled = this.pending;
        }
        if (this.applyButton) this.applyButton.disabled = !active || this.pending;
        if (this.discardButton) this.discardButton.disabled = !active || this.pending;
        if (this.root) {
            this.root.dataset.draft = String(active);
            this.root.dataset.pending = String(this.pending);
            this.root.dataset.profile = profile;
            for (const note of this.root.querySelectorAll?.('[data-grid3-only]') || []) {
                note.hidden = profile !== MESH_PROFILES.grid3 || !this.centerAtRotationPivot;
            }
        }
        if (this.draft) {
            const percentages = this.draft.percentages || [];
            for (const [index, name] of getMeshProfileDefinition(this.draft.profile).vertexNames.entries()) {
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

    isDraft() { return Boolean(this.draft); }

    getDraft() { return copyDraft(this.draft); }

    isPending() { return this.pending; }

    getProfile() { return this._currentProfile(); }

    setCenterAtRotationPivot(value) {
        this.centerAtRotationPivot = value === true;
        this._renderControls();
    }

    getSelectionView() {
        const profile = this._currentProfile();
        const definition = getMeshProfileDefinition(profile);
        const selected = this._normalizeSelection(profile, false);
        const endWeights = this.draft?.endWeights ? [...this.draft.endWeights] : [...this.confirmed];
        const percentages = this.draft?.percentages ? [...this.draft.percentages] : weightsToPercentages(profile, endWeights);
        const fieldValidity = this.draft?.fieldValidity ? { ...this.draft.fieldValidity } : null;
        const selectedIndex = selected ? definition.vertexNames.indexOf(selected) : -1;
        const selectedWeightValid = selectedIndex >= 0 && fieldValidity ? fieldValidity[selected] !== false : selectedIndex >= 0;
        return {
            profile,
            vertexNames: [...definition.vertexNames],
            uvs: definition.uvs.map(([u, v]) => [u, v]),
            endWeights,
            percentages,
            fieldValidity,
            selectedVertex: selected,
            selectedEndPercent: selectedWeightValid && selectedIndex >= 0 ? percentages[selectedIndex] : null,
            selectedWeightValid,
            weightDraftActive: Boolean(this.draft),
        };
    }

    dispose() {
        this.disposed = true;
        this.pending = false;
        this.onPendingChanged?.(false);
        for (const [node, event, handler] of this._listeners) node.removeEventListener(event, handler);
        this._listeners = [];
        this.draft = null;
        this.selectedVertex = null;
        this.attached = false;
    }
}
