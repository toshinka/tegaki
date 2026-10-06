/** ROLE: Six personal font-size slots in the lettering format tab.
 * STORAGE: Merges fontSizeSlots into existing UI preferences; never Project/recipe data.
 * EDIT: Only explicit font-size controls overwrite the active slot, not layer loading.
 */
export const DEFAULT_LETTERING_SIZE_SLOTS = Object.freeze([16, 24, 32, 48, 64, 96]);
export function normalizeLetteringSizeSlots(values) {
    return DEFAULT_LETTERING_SIZE_SLOTS.map((fallback, i) => {
        const v = values?.[i];
        return typeof v === 'number' && Number.isFinite(v) ? Math.max(8, Math.min(512, Math.round(v))) : fallback;
    });
}
export class LetteringSizeSlots {
    constructor({ host, storageKey, onSelect }) {
        this.host = host; this.storageKey = storageKey; this.onSelect = onSelect;
        this.active = -1;
        let stored;
        try { stored = JSON.parse(localStorage.getItem(storageKey) || '{}').fontSizeSlots; } catch {}
        this.values = normalizeLetteringSizeSlots(stored);
        host.innerHTML = `<div class="lettering-size-slots__title">登録サイズ <small>選択枠を上のサイズ調整で編集</small></div><div class="lettering-size-slots__row" role="group" aria-label="登録した文字サイズ">${this.values.map((_, i) => `<button type="button" class="pl-chip" data-size-slot="${i}"></button>`).join('')}</div>`;
        host.querySelectorAll('[data-size-slot]').forEach(button => button.addEventListener('click', () => {
            this.active = Number(button.dataset.sizeSlot);
            this.onSelect(this.values[this.active]);
            this.render();
        }));
        this.render();
    }
    updateFromControl(value) {
        if (this.active < 0 || !Number.isFinite(value)) return;
        this.values[this.active] = normalizeLetteringSizeSlots([value])[0];
        try {
            const prefs = JSON.parse(localStorage.getItem(this.storageKey) || '{}');
            localStorage.setItem(this.storageKey, JSON.stringify({ ...prefs, fontSizeSlots: this.values }));
        } catch {}
        this.render();
    }
    clearSelection() { this.active = -1; this.render(); }
    render() {
        this.host.querySelectorAll('[data-size-slot]').forEach(button => {
            const i = Number(button.dataset.sizeSlot), selected = i === this.active;
            button.textContent = String(this.values[i]);
            button.title = `${this.values[i]}px。選択後、上の文字サイズ調整でこの枠を上書き`;
            button.setAttribute('aria-label', `登録サイズ${i + 1}: ${this.values[i]}px`);
            button.setAttribute('aria-pressed', String(selected));
            button.classList.toggle('is-selected', selected);
        });
    }
}
