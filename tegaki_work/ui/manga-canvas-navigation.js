/** ROLE: Manga SVG hit surfaces yield camera Space gestures and wheel to the existing canvas listener.
 * No camera state/Transform/History ownership. Object wheel callbacks must explicitly claim their input.
 * Claimed object input marks the visible Manga root primary; forwarded Camera input clears that marker.
 */
import { TegakiEventBus } from '../system/event-bus.js';
import { setMangaInputPrimary } from './manga-input-focus.js';
export function attachMangaCanvasNavigation({ isVisible, getSvg, onSpace, onObjectWheel }) {
    let space = false;
    let objectControl = false;
    let transform = window.coreEngine?.cameraSystem?.vKeyPressed === true;
    const sync = () => {
        getSvg()?.classList.toggle('is-transform', transform);
        getSvg()?.classList.toggle('is-object-control', objectControl);
    };
    const vChange = ({pressed}) => { transform = pressed === true; sync(); if(transform)onSpace?.(space); };
    TegakiEventBus.on('keyboard:vkey-state-changed',vChange);
    const clear = () => { space = false; objectControl = false; getSvg()?.classList.remove('is-camera', 'is-object-control'); onSpace?.(false); };
    const down = event => {
        if (!isVisible() || event.isComposing) return;
        objectControl = !!onObjectWheel && event.ctrlKey; sync();
        if (event.target?.closest?.('input,textarea,select,[contenteditable="true"]')) return;
        if (event.code === 'Space') { space = true; getSvg()?.classList.add('is-camera'); onSpace?.(true); }
    };
    const up = event => {
        if (event.code === 'Space') clear();
        objectControl = isVisible() && !!onObjectWheel && event.ctrlKey; sync();
    };
    const wheel = event => {
        if (!isVisible() || space || transform || event.target?.closest?.('input,textarea,select,[contenteditable="true"]')) return;
        const svg = getSvg(), canvas = document.querySelector('.canvas-area canvas');
        const onSvg = svg?.contains(event.target);
        if (!onSvg && event.target !== canvas) return;
        if (onObjectWheel?.(event) === true) {
            setMangaInputPrimary(document.querySelector('[data-manga-input-root].show')?.dataset.mangaInputRoot);
            event.preventDefault(); event.stopImmediatePropagation(); return;
        }
        setMangaInputPrimary(null);
        if (!onSvg || !canvas) return;
        event.preventDefault(); event.stopImmediatePropagation();
        canvas.dispatchEvent(new WheelEvent('wheel', { deltaX: event.deltaX, deltaY: event.deltaY, deltaMode: event.deltaMode, clientX: event.clientX, clientY: event.clientY, shiftKey: event.shiftKey, ctrlKey: event.ctrlKey, altKey: event.altKey, metaKey: event.metaKey, bubbles: true, cancelable: true }));
    };
    window.addEventListener('keydown', down, true); window.addEventListener('keyup', up, true);
    window.addEventListener('blur', clear); window.addEventListener('wheel', wheel, { capture: true, passive: false });
    return { clear, sync, destroy() { clear(); TegakiEventBus.off('keyboard:vkey-state-changed',vChange); window.removeEventListener('keydown', down, true); window.removeEventListener('keyup', up, true); window.removeEventListener('blur', clear); window.removeEventListener('wheel', wheel, true); } };
}
