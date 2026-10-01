/**
 * ============================================================================
 * ファイル名: ui/pill-tabs.js
 * 責務: 長丸(カプセル)のタブ部品。LAYER / TRANSFORM / RIG と同じ見た目で、他のpopupのタブにも使う
 * 依存: なし（styles/components/pill-tabs.css）
 * 被依存: ui/manga-tabs.js
 * 公開API: createPillTabs
 * 実装状態: ✅実装
 *
 * 見た目の値は layer-panel-surface.css の .right-workspace-mode-switch / -segment と同じtoken。
 * 右ワークスペースのタブもこの部品へ寄せる(統一)のは別カード。ここでは編集状態を持たない。
 * ============================================================================
 */

/**
 * @param {{ tabs: Array<{id: string, label: string, title?: string}>, active: string, onSelect: (id: string) => void, ariaLabel?: string }} options
 * @returns {HTMLElement & { setActive: (id: string) => void }}
 */
export function createPillTabs({ tabs, active, onSelect, ariaLabel = 'タブ' }) {
    const root = document.createElement('div');
    root.className = 'pill-tabs';
    root.setAttribute('role', 'tablist');
    root.setAttribute('aria-label', ariaLabel);
    root.style.setProperty('--pill-tab-count', String(Math.max(1, tabs.length)));

    const buttons = new Map();
    for (const tab of tabs) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'pill-tab';
        button.setAttribute('role', 'tab');
        button.dataset.tab = tab.id;
        button.textContent = tab.label;
        if (tab.title) button.title = tab.title;
        button.addEventListener('click', () => onSelect?.(tab.id));
        buttons.set(tab.id, button);
        root.appendChild(button);
    }

    root.setActive = (id) => {
        for (const [tabId, button] of buttons) {
            const on = tabId === id;
            button.classList.toggle('is-selected', on);
            button.setAttribute('aria-selected', String(on));
            button.setAttribute('aria-pressed', String(on));
        }
    };
    root.setActive(active);
    return root;
}
