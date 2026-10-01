/**
 * ============================================================================
 * ファイル名: ui/numeric-field.js
 * 責務: range入力とその値表示に「ホイールで増減」「値のダブルクリックで直接入力」を付ける共通部品
 * 依存: なし
 * 被依存: ui/panel-layout-popup.js（ほか数値popup）
 * 公開API: attachNumericField
 * イベント発火: range へ bubbles な 'input' を送る（既存のinput handlerをそのまま使える）
 * 実装状態: ✅実装
 *
 * 操作
 *   - range または値表示の上でホイール: step分ずつ増減（Shift=10倍、Alt=1/10）。ページ/popupのscrollは奪う。
 *   - 値表示をダブルクリック: 数値入力欄へ。Enter / blurで確定、Escで取消。範囲外はclamp。
 * ============================================================================
 */

function clampStep(value, min, max, step) {
    let v = Math.min(max, Math.max(min, value));
    if (step > 0) {
        v = min + Math.round((v - min) / step) * step;
        // 浮動小数誤差を抑える
        const decimals = (String(step).split('.')[1] || '').length;
        v = Number(v.toFixed(Math.min(6, decimals + 1)));
        v = Math.min(max, Math.max(min, v));
    }
    return v;
}

/**
 * @param {{
 *   range: HTMLInputElement,
 *   valueEl: HTMLElement,
 *   toDisplay?: (raw:number)=>number,      // rangeの値 → 入力欄に出す数値
 *   fromDisplay?: (shown:number)=>number,  // 入力欄の数値 → rangeの値
 *   wheelStep?: number                      // rangeの値単位の1ノッチ量(省略時はstep)
 * }} options
 * @returns {() => void} detach
 */
export function attachNumericField({ range, valueEl, toDisplay = v => v, fromDisplay = v => v, wheelStep = null }) {
    const min = () => Number(range.min);
    const max = () => Number(range.max);
    const step = () => Number(range.step) || 1;

    const setValue = (raw) => {
        const next = clampStep(raw, min(), max(), step());
        if (Number(range.value) === next) return;
        range.value = String(next);
        range.dispatchEvent(new Event('input', { bubbles: true }));
    };

    const onWheel = (event) => {
        if (event.deltaY === 0) return;
        event.preventDefault();
        event.stopPropagation();
        const unit = wheelStep ?? step();
        const factor = event.shiftKey ? 10 : event.altKey ? 0.1 : 1;
        const direction = event.deltaY < 0 ? 1 : -1;
        setValue(Number(range.value) + direction * unit * factor);
    };
    range.addEventListener('wheel', onWheel, { passive: false });
    valueEl.addEventListener('wheel', onWheel, { passive: false });

    const onDblClick = (event) => {
        event.preventDefault();
        if (valueEl.querySelector('input')) return;
        const original = valueEl.textContent;
        const input = document.createElement('input');
        input.type = 'text';
        input.inputMode = 'decimal';
        input.className = 'numeric-field-input';
        input.value = String(toDisplay(Number(range.value)));
        input.setAttribute('aria-label', '数値を入力');
        valueEl.textContent = '';
        valueEl.appendChild(input);
        valueEl.dataset.editing = 'true';
        input.focus();
        input.select();

        let done = false;
        const finish = (commit) => {
            if (done) return;
            done = true;
            const text = input.value.replace(/[０-９．－]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xfee0)).trim();
            const parsed = Number.parseFloat(text);
            delete valueEl.dataset.editing;
            input.remove();
            valueEl.textContent = original;
            if (commit && Number.isFinite(parsed)) setValue(fromDisplay(parsed));
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
    valueEl.addEventListener('dblclick', onDblClick);
    valueEl.title = valueEl.title || 'ダブルクリックで数値入力 / ホイールで増減（Shift=10倍）';

    return () => {
        range.removeEventListener('wheel', onWheel);
        valueEl.removeEventListener('wheel', onWheel);
        valueEl.removeEventListener('dblclick', onDblClick);
    };
}
