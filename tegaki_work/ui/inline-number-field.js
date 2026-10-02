/**
 * ============================================================================
 * ファイル名: ui/inline-number-field.js
 * 責務: 小さな数値入力欄（ホイールで増減 / ダブルクリックで全選択 / Enterで確定して離れる）。図形・フチの操作盤が共有する
 * 依存: なし（DOMのみ）
 * 被依存: system/shape-tool.js, system/border-tool.js
 * 公開API: createInlineNumberField
 * 保存: なし
 * ============================================================================
 */

export function createInlineNumberField(label, title, { min, max, step, unit }, onInput) {
    const field = document.createElement('label');
    field.className = 'shape-tool-field';
    field.title = title;
    const caption = document.createElement('span');
    caption.textContent = label;
    const input = document.createElement('input');
    input.type = 'number';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.addEventListener('input', () => {
        const v = Number(input.value);
        if (Number.isFinite(v)) onInput(Math.max(min, Math.min(max, v)));
    });
    input.addEventListener('wheel', event => {
        event.preventDefault();
        const v = Number(input.value) || 0;
        const next = Math.max(min, Math.min(max, v + (event.deltaY < 0 ? step : -step)));
        input.value = String(Math.round(next * 100) / 100);
        onInput(next);
    }, { passive: false });
    input.addEventListener('dblclick', () => input.select());
    input.addEventListener('keydown', event => { if (event.key === 'Enter') input.blur(); });
    field.append(caption, input);
    if (unit) {
        const u = document.createElement('span');
        u.textContent = unit;
        field.append(u);
    }
    return { field, input };
}
