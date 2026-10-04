/**
 * ============================================================================
 * ファイル名: ui/manga-tabs.js
 * 責務: 漫画ツール群(コマ / 吹き出し / 集中線 …)を1つの窓のタブとして見せる切替。
 *   各ツールは別々のpopup(PopupManager登録)のまま、タブ切替で同じ位置に入れ替える。
 * 依存: ui/pill-tabs.js, window.coreEngine.popupManager
 * 被依存: ui/panel-layout-popup.js, ui/focus-lines-popup.js, ui/ui-panels.js(サイドバー)
 * 公開API: MANGA_TABS, mountMangaTabs, switchMangaTab, getLastMangaTab
 * 保存: 最後に使ったタブをlocalStorage(UI設定)に記録するだけ。
 * 実装状態: ✅実装
 * ============================================================================
 */

import { createPillTabs } from './pill-tabs.js';

/** 並び順がタブ順。popupNameはPopupManager登録名、popupIdはDOMのid。新しいツールはここへ1行足す。 */
export const MANGA_TABS = Object.freeze([
    { id: 'panelLayout', label: 'コマ', popupId: 'panel-layout-popup', title: 'コマ割り（Shift+K）' },
    { id: 'balloon', label: '吹き出し', popupId: 'balloon-popup', title: '吹き出し（Shift+B）' },
    { id: 'lettering', label: '文字', popupId: 'lettering-popup', title: '文字・曲線・変形' },
    { id: 'focusLines', label: '集中線', popupId: 'focus-lines-popup', title: '集中線（Shift+F）' }
]);

const STORAGE_KEY = 'tegaki-manga-last-tab-v1';
let switchingTo = null;

function popupManager() {
    return window.coreEngine?.popupManager || null;
}

/** 登録済み(使えるツール)のタブだけ返す。 */
function availableTabs() {
    const manager = popupManager();
    return MANGA_TABS.filter(tab => !manager || manager.popups?.has?.(tab.id));
}

export function getLastMangaTab() {
    try {
        const id = localStorage.getItem(STORAGE_KEY);
        if (availableTabs().some(tab => tab.id === id)) return id;
    } catch (error) {
        // localStorageが使えない場合は既定
    }
    return 'panelLayout';
}

function rememberTab(id) {
    try {
        localStorage.setItem(STORAGE_KEY, id);
    } catch (error) {
        // 記録できなくても動作は続ける
    }
}

/** 現在のタブを閉じて、同じ位置にtargetのpopupを出す。 */
export function switchMangaTab(targetId) {
    const manager = popupManager();
    const target = MANGA_TABS.find(tab => tab.id === targetId);
    if (!manager || !target) return false;
    const current = MANGA_TABS.map(tab => document.getElementById(tab.popupId)).find(el => el?.classList.contains('show'));
    // CSS entrance animations scale visual rectangles. Carry the layout
    // anchor so a fast consecutive tab switch cannot creep across the canvas.
    const anchor = current ? { left: parseFloat(current.style.left) || 6, top: parseFloat(current.style.top) || 6 } : null;
    switchingTo = targetId;
    let shown;
    try { shown = manager.show(targetId); }
    finally { switchingTo = null; }
    if (shown === false) return false;
    const next = document.getElementById(target.popupId);
    if (next && anchor) {
        next.style.left = `${Math.round(Math.max(6, Math.min(anchor.left, window.innerWidth - next.offsetWidth - 6)))}px`;
        next.style.top = `${Math.round(Math.max(6, Math.min(anchor.top, window.innerHeight - next.offsetHeight - 6)))}px`;
    }
    rememberTab(targetId);
    return true;
}

/** popup内の host 要素へタブバーを置く。currentIdが選択状態。 */
export function mountMangaTabs(host, currentId) {
    if (!host) return null;
    const tabs = createPillTabs({
        tabs: availableTabs(),
        active: currentId,
        ariaLabel: '漫画ツール',
        onSelect: (id) => {
            if (id !== currentId) switchMangaTab(id);
        }
    });
    host.replaceChildren(tabs);
    return tabs;
}

/** popupを開いた時に最後のタブを記録する(サイドバーが次回同じタブを開くため)。 */
export function noteMangaTabShown(id) {
    const tab = MANGA_TABS.find(item => item.id === id);
    const popup = tab && document.getElementById(tab.popupId);
    if (popup) popup.dataset.mangaTransition = switchingTo === id ? 'instant' : 'open';
    rememberTab(id);
}
