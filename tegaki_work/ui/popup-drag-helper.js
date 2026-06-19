/**
 * ============================================================================
 * ファイル名: ui/popup-drag-helper.js
 * 責務: popupパネル共通の余白ドラッグ移動を提供する
 * 依存: なし
 * 被依存: ui/resize-popup.js, ui/settings-popup.js, ui/export-popup.js
 * 公開API: attachPopupDrag
 * イベント発火: なし
 * イベント受信: なし
 * グローバル登録: なし
 * 実装状態: ✅実装
 * ============================================================================
 */

const DEFAULT_INTERACTIVE_SELECTOR = [
    'button',
    'input',
    'select',
    'textarea',
    'a',
    '[role="button"]',
    '.resize-slider',
    '.resize-slider-handle',
    '.slider',
    '.slider-handle',
    '.ui-close-button',
    '.popup-close-btn'
].join(',');

export function mountPopupAtOverlayRoot(popup) {
    if (!popup) return null;
    const overlayRoot = document.querySelector('.main-layout') || document.body;
    if (popup.parentElement !== overlayRoot) {
        overlayRoot.appendChild(popup);
    }
    return popup;
}

export function attachPopupDrag(popup, options = {}) {
    if (!popup) return () => {};

    const interactiveSelector = options.interactiveSelector || DEFAULT_INTERACTIVE_SELECTOR;
    const margin = options.margin ?? 4;

    let isDragging = false;
    let activePointerId = null;
    let dragStartX = 0;
    let dragStartY = 0;
    let popupStartX = 0;
    let popupStartY = 0;

    popup.style.touchAction = 'none';

    const onPointerDown = (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if (e.target?.closest?.(interactiveSelector)) return;

        const rect = popup.getBoundingClientRect();
        isDragging = true;
        activePointerId = e.pointerId;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        popupStartX = rect.left;
        popupStartY = rect.top;
        popup.classList.add('popup-panel--dragging');

        try {
            popup.setPointerCapture?.(e.pointerId);
        } catch (err) {}

        e.preventDefault();
        e.stopPropagation();
    };

    const onPointerMove = (e) => {
        if (!isDragging || activePointerId !== e.pointerId) return;

        e.preventDefault();
        e.stopPropagation();

        const rect = popup.getBoundingClientRect();
        const nextLeft = popupStartX + (e.clientX - dragStartX);
        const nextTop = popupStartY + (e.clientY - dragStartY);
        const left = Math.max(margin, Math.min(window.innerWidth - rect.width - margin, nextLeft));
        const top = Math.max(margin, Math.min(window.innerHeight - rect.height - margin, nextTop));

        popup.style.left = `${left}px`;
        popup.style.top = `${top}px`;
    };

    const onPointerUp = (e) => {
        if (!isDragging || activePointerId !== e.pointerId) return;

        try {
            popup.releasePointerCapture?.(e.pointerId);
        } catch (err) {}

        isDragging = false;
        activePointerId = null;
        popup.classList.remove('popup-panel--dragging');
        options.onDragEnd?.(popup);
    };

    popup.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('pointermove', onPointerMove, { passive: false, capture: true });
    document.addEventListener('pointerup', onPointerUp, { capture: true });
    document.addEventListener('pointercancel', onPointerUp, { capture: true });

    return () => {
        popup.removeEventListener('pointerdown', onPointerDown);
        document.removeEventListener('pointermove', onPointerMove, true);
        document.removeEventListener('pointerup', onPointerUp, true);
        document.removeEventListener('pointercancel', onPointerUp, true);
        popup.classList.remove('popup-panel--dragging');
    };
}
