/**
 * ============================================================================
 * ファイル名: ui/numeric-field.js
 * 責務: 数値入力に「ホイールで増減」「値のダブルクリックで直接入力」を付ける共通部品
 * 依存: なし
 * 被依存: ui/panel-layout-popup.js（ほか数値popup）
 * 公開API: attachNumericField
 * イベント発火: range へ bubbles な 'input' を送る（既存のinput handlerをそのまま使える）
 * 実装状態: ✅実装
 *
 * 操作
 *   - range、数値入力、または値表示の上でホイール: step分ずつ増減（Shift=10倍、Alt=1/10）。ページ/popupのscrollは奪う。
 *   - 値表示をダブルクリック: 数値入力欄へ。Enter / blurで確定、Escで取消。範囲外はclamp。
 *   - numberInput は range と組み合わせても、単体でも使える。range と組み合わせたときは既存rangeのinputだけを発火する。
 * ============================================================================
 */

function readBound(element, key, fallback) {
    const raw = element?.[key];
    if (raw === '' || raw === null || raw === undefined) return fallback;
    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
}

function readFiniteValue(value) {
    if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function readPositiveStep(element) {
    const value = Number(element?.step);
    return Number.isFinite(value) && value > 0 ? value : null;
}

function clampStep(value, min, max, step) {
    if (!Number.isFinite(value)) return null;
    const lower = Number.isFinite(min) ? min : -Infinity;
    const upper = Number.isFinite(max) ? max : Infinity;
    let v = Math.min(upper, Math.max(lower, value));
    if (Number.isFinite(step) && step > 0) {
        const origin = Number.isFinite(min) ? min : 0;
        v = origin + Math.round((v - origin) / step) * step;
        // 浮動小数誤差を抑える
        const decimals = (String(step).split('.')[1] || '').length;
        v = Number(v.toFixed(Math.min(6, decimals + 1)));
        v = Math.min(upper, Math.max(lower, v));
    }
    return v;
}

function inputEvent() {
    return typeof Event === 'function' ? new Event('input', { bubbles: true }) : { type: 'input', bubbles: true };
}

function isUnavailable(element) {
    if (!element) return false;
    return element.disabled === true
        || element.readOnly === true
        || element.getAttribute?.('aria-disabled') === 'true'
        || element.getAttribute?.('aria-readonly') === 'true';
}

function positiveNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : null;
}

/**
 * @param {{
 *   range?: HTMLInputElement,
 *   valueEl?: HTMLElement,
 *   numberInput?: HTMLInputElement,
 *   toDisplay?: (raw:number)=>number,      // rangeの値 → 入力欄に出す数値
 *   fromDisplay?: (shown:number)=>number,  // 入力欄の数値 → rangeの値
 *   wheelStep?: number                      // rangeの値単位の1ノッチ量(省略時はstep)
 * }} options
 * @returns {() => void} detach
 */
export function attachNumericField({
    range = null,
    valueEl = null,
    numberInput = null,
    toDisplay = v => v,
    fromDisplay = v => v,
    wheelStep = null
} = {}) {
    const listeners = [];
    const listen = (element, type, handler, options) => {
        if (!element?.addEventListener) return;
        element.addEventListener(type, handler, options);
        listeners.push(() => element.removeEventListener?.(type, handler, options));
    };

    const rangeMin = () => readBound(range, 'min', -Infinity);
    const rangeMax = () => readBound(range, 'max', Infinity);
    const rangeStep = () => readPositiveStep(range) ?? 1;
    const configuredWheelStep = () => positiveNumber(wheelStep);

    const displayValue = (raw) => {
        if (raw === null || raw === undefined || !Number.isFinite(Number(raw))) return null;
        const value = Number(toDisplay(raw));
        return Number.isFinite(value) ? value : null;
    };

    const displayRangeBound = (raw, fallback) => {
        if (!Number.isFinite(raw)) return fallback;
        return displayValue(raw) ?? fallback;
    };

    const numberInputStep = () => readPositiveStep(numberInput);
    const numberInputMin = () => readBound(numberInput, 'min', displayRangeBound(rangeMin(), -Infinity));
    const numberInputMax = () => readBound(numberInput, 'max', displayRangeBound(rangeMax(), Infinity));

    const displayStep = () => {
        const explicit = numberInputStep();
        if (explicit !== null) return explicit;
        const configured = configuredWheelStep();
        if (configured !== null) return configured;
        if (!range) return 1;
        const raw = readFiniteValue(range?.value);
        const origin = raw !== null ? raw : (Number.isFinite(rangeMin()) ? rangeMin() : 0);
        const first = displayValue(origin);
        const second = displayValue(origin + rangeStep());
        const derived = first === null || second === null ? null : Math.abs(second - first);
        return positiveNumber(derived) ?? rangeStep();
    };

    const displaySpec = () => ({
        min: numberInputMin(),
        max: numberInputMax(),
        step: displayStep()
    });

    const syncNumberInput = () => {
        if (!range || !numberInput) return;
        const raw = readFiniteValue(range.value);
        const shown = displayValue(raw);
        if (shown !== null) numberInput.value = String(shown === 0 ? 0 : shown);
    };

    const setRangeValue = (raw) => {
        if (!range?.dispatchEvent) return false;
        const next = clampStep(Number(raw), rangeMin(), rangeMax(), rangeStep());
        if (next === null) return false;
        const current = readFiniteValue(range.value);
        if (current !== null && current === next) {
            syncNumberInput();
            return false;
        }
        range.value = String(next === 0 ? 0 : next);
        range.dispatchEvent(inputEvent());
        return true;
    };

    const setStandaloneNumberValue = (raw, dispatch = true) => {
        if (!numberInput?.dispatchEvent) return false;
        const next = clampStep(Number(raw), numberInputMin(), numberInputMax(), numberInputStep() ?? 1);
        if (next === null) return false;
        const current = readFiniteValue(numberInput.value);
        if (current !== null && current === next) return false;
        numberInput.value = String(next === 0 ? 0 : next);
        if (dispatch) numberInput.dispatchEvent(inputEvent());
        return true;
    };

    const setFromDisplay = (shown, normalize = false) => {
        const parsed = readFiniteValue(shown);
        if (parsed === null) return false;
        const display = normalize ? clampStep(parsed, numberInputMin(), numberInputMax(), displayStep()) : parsed;
        if (display === null) return false;
        if (range) {
            const raw = Number(fromDisplay(display));
            return setRangeValue(raw);
        }
        if (numberInput) return setStandaloneNumberValue(display);
        return false;
    };

    const wheelRange = (event) => {
        const current = readFiniteValue(range.value);
        if (current === null) return null;
        const unit = configuredWheelStep() ?? rangeStep();
        const factor = event.shiftKey ? 10 : event.altKey ? 0.1 : 1;
        const direction = event.deltaY < 0 ? 1 : -1;
        const next = current + direction * unit * factor;
        if (!Number.isFinite(next)) return null;
        return setRangeValue(next);
    };

    const wheelNumberInput = (event) => {
        const current = readFiniteValue(numberInput.value);
        if (current === null) return null;
        const spec = displaySpec();
        const unit = spec.step;
        const factor = event.shiftKey ? 10 : event.altKey ? 0.1 : 1;
        const direction = event.deltaY < 0 ? 1 : -1;
        const next = clampStep(current + direction * unit * factor, spec.min, spec.max, spec.step);
        if (next === null) return null;
        if (range) return setFromDisplay(next, false);
        return setStandaloneNumberValue(next);
    };

    const onWheel = (event) => {
        const target = event.currentTarget || event.target;
        const deltaY = Number(event.deltaY);
        if (!Number.isFinite(deltaY) || deltaY === 0) return;
        if (isUnavailable(target) || (range && isUnavailable(range))) return;

        let handled = null;
        if (target === numberInput && target !== range) handled = wheelNumberInput(event);
        else if (range && (target === range || target === valueEl)) handled = wheelRange(event);
        if (handled === null) return;

        event.preventDefault?.();
        event.stopPropagation?.();
    };

    const onNumberInput = () => {
        if (!numberInput || isUnavailable(numberInput)) return;
        const shown = readFiniteValue(numberInput.value);
        if (shown === null) return;
        // 単体numberInputは親のinput handlerがmodelを正規化する。ここではclampして再書込みしない。
        if (!range) return;
        const spec = displaySpec();
        const normalized = clampStep(shown, spec.min, spec.max, spec.step);
        if (normalized !== null) setFromDisplay(normalized, false);
    };

    const onDblClick = (event) => {
        if (!range && !numberInput) return;
        event.preventDefault();
        if (valueEl.querySelector?.('input')) return;
        if (typeof document === 'undefined') return;
        const original = valueEl.textContent;
        const input = document.createElement('input');
        input.type = 'text';
        input.inputMode = 'decimal';
        input.className = 'numeric-field-input';
        const current = range ? Number(range.value) : Number(numberInput.value);
        input.value = String(toDisplay(current));
        input.setAttribute('aria-label', '数値を入力');
        valueEl.textContent = '';
        valueEl.appendChild(input);
        if (valueEl.dataset) valueEl.dataset.editing = 'true';
        input.focus();
        input.select();

        let done = false;
        const finish = (commit) => {
            if (done) return;
            done = true;
            const text = input.value.replace(/[０-９．－]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xfee0)).trim();
            const parsed = Number.parseFloat(text);
            if (valueEl.dataset) delete valueEl.dataset.editing;
            input.remove?.();
            valueEl.textContent = original;
            if (commit && Number.isFinite(parsed)) setFromDisplay(parsed);
        };
        input.addEventListener('keydown', (e) => {
            e.stopPropagation(); // 数字・Backspace等がキャンバスのショートカットへ漏れない
            if (e.key === 'Enter') { e.preventDefault(); finish(true); }
            else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
        });
        input.addEventListener('keyup', e => e.stopPropagation());
        input.addEventListener('blur', () => finish(true));
        input.addEventListener('pointerdown', e => e.stopPropagation());
        input.addEventListener('wheel', e => e.stopPropagation());
    };

    listen(range, 'wheel', onWheel, { passive: false });
    listen(valueEl, 'wheel', onWheel, { passive: false });
    listen(numberInput, 'wheel', onWheel, { passive: false });
    listen(numberInput, 'input', onNumberInput);
    listen(numberInput, 'change', onNumberInput);
    if (range && numberInput) listen(range, 'input', syncNumberInput);
    listen(valueEl, 'dblclick', onDblClick);
    if (valueEl) valueEl.title = valueEl.title || 'ダブルクリックで数値入力 / ホイールで増減（Shift=10倍）';
    syncNumberInput();

    return () => {
        while (listeners.length) listeners.pop()();
    };
}
