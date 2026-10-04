/** ROLE: Visible Manga input target indicator. Runtime UI only; no Project/History or tool ownership.
 * Popup/its draft overlay is primary after interaction; Canvas/other UI clears it.
 * Space and the existing global V temporarily/explicitly yield to Camera/Transform.
 * Registered by manga-tabs. Singleton document listeners do not duplicate on tab mount.
 */
import { TegakiEventBus } from '../system/event-bus.js';

let installed = false;
let primaryId = null;
let camera = false;
const roots = () => [...document.querySelectorAll('[data-manga-input-root]')];
const visibleRoot = () => roots().find(root => root.classList.contains('show'));
const editable = target => target?.closest?.('input,textarea,select,[contenteditable="true"]');
const overlays = '.balloon-overlay,.panel-layout-overlay,.lettering-overlay,.focus-lines-overlay';
const fontWindow = '.pl-font-comparison[data-open="true"]';

function render() {
    for (const root of roots()) {
        const primary = !camera && root.classList.contains('show') && root.dataset.mangaInputRoot === primaryId;
        root.classList.toggle('is-manga-input-primary', primary);
        root.dataset.mangaInputPrimary = String(primary);
    }
}

export function setMangaInputPrimary(id = null) {
    primaryId = id;
    render();
}

export function isMangaInputPrimary(id) {
    return !camera && visibleRoot()?.dataset.mangaInputRoot === primaryId && (!id || id === primaryId);
}

export function registerMangaInputRoot(root, id) {
    if (!root) return;
    root.dataset.mangaInputRoot = id;
    if (installed) { render(); return; }
    installed = true;
    const mark = event => {
        const current = visibleRoot();
        if (!current) return;
        const inPopup = current.contains(event.target);
        const inDraft = event.target?.closest?.(overlays);
        const inFontWindow = event.target?.closest?.(fontWindow);
        setMangaInputPrimary(inPopup || inDraft || inFontWindow ? current.dataset.mangaInputRoot : null);
        // Canvas/SVG aren't focusable: do not leave a Manga control owning later shortcuts.
        if (event.type === 'pointerdown' && (inDraft || event.target?.matches?.('.canvas-area canvas'))
            && (current.contains(document.activeElement) || document.activeElement?.closest?.(fontWindow))) document.activeElement.blur();
    };
    document.addEventListener('pointerdown', mark, true);
    document.addEventListener('focusin', mark, true);
    document.addEventListener('wheel', event => {
        if (event.target?.matches?.('.canvas-area canvas') || event.target?.closest?.(overlays)) setMangaInputPrimary(null);
    });
    window.addEventListener('keydown', event => {
        if (visibleRoot() && event.code === 'Space' && !event.isComposing && !editable(event.target)) { camera = true; render(); }
    }, true);
    window.addEventListener('keyup', event => { if (event.code === 'Space') { camera = false; render(); } }, true);
    window.addEventListener('blur', () => { camera = false; setMangaInputPrimary(null); });
    TegakiEventBus.on('keyboard:vkey-state-changed', ({ pressed }) => { if (pressed) setMangaInputPrimary(null); });
}
