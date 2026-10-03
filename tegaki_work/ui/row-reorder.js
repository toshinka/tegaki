/**
 * ============================================================================
 * ファイル名: ui/row-reorder.js
 * 責務: 横並び / gridのボタン列をポインタ(マウス/ペン/タッチ)で並べ替える小さな部品
 * 依存: なし
 * 被依存: ui/quick-access-popup.js
 * 公開API: enableRowReorder
 * 実装状態: ✅実装
 *
 * しきい値を超えた時だけghostとplaceholderを作り、placeholderの順序で並べ替え先を示す。
 * drop時だけDOM順を確定し、pointercancel / window blurでは元の順序へ戻して一時表示を除去する。
 * ============================================================================
 */

const THRESHOLD = 7;
const GHOST_SCALE = 1.04;

function clearMotion(container) {
    [...container.children].forEach((element) => {
        element.style.transition = '';
        element.style.transform = '';
    });
}

function animatePlaceholderMove(container, placeholder, mutate) {
    const beforeElements = [...container.children];
    const visualPositions = new Map(beforeElements.map((element) => [element, element.getBoundingClientRect()]));

    // Sample in-flight positions, then clear prior FLIP transforms before measuring the new grid.
    beforeElements.forEach((element) => {
        element.style.transition = 'none';
        element.style.transform = 'none';
    });
    container.getBoundingClientRect();
    mutate();

    const afterElements = [...container.children];
    const inverse = [];
    afterElements.forEach((element) => {
        const before = visualPositions.get(element);
        if (!before) return;
        const after = element.getBoundingClientRect();
        const dx = before.left - after.left;
        const dy = before.top - after.top;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
        element.style.transition = 'none';
        element.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
        inverse.push(element);
    });

    if (inverse.length) container.getBoundingClientRect();
    requestAnimationFrame(() => {
        afterElements.forEach((element) => {
            element.style.transition = '';
            element.style.transform = '';
        });
    });
}

/**
 * @param {HTMLElement} container
 * @param {{ itemSelector: string, onReorder: (ids: string[]) => void, onStart?: () => void, onEnd?: () => void, idOf?: (el: HTMLElement) => string }} options
 *   呼び出しのたびに再描画される列でも、描画後に毎回呼べば各ボタンへ張り直す。
 */
export function enableRowReorder(container, options) {
    const { itemSelector, onReorder, onStart, onEnd } = options;
    const idOf = options.idOf || (el => el.dataset.memberId);
    const items = () => [...container.querySelectorAll(itemSelector)];

    items().forEach((item) => {
        item.addEventListener('pointerdown', (event) => {
            if (event.button !== 0) return;
            const startX = event.clientX;
            const startY = event.clientY;
            const pointerId = event.pointerId;
            const originalChildren = [...container.childNodes];
            const originalOrder = JSON.stringify(items().map(idOf));
            const itemRect = item.getBoundingClientRect();
            const pointerOffsetX = startX - itemRect.left;
            const pointerOffsetY = startY - itemRect.top;
            let dragging = false;
            let ghost = null;
            let placeholder = null;

            const cleanupListeners = () => {
                window.removeEventListener('pointermove', move);
                window.removeEventListener('pointerup', pointerUp);
                window.removeEventListener('pointercancel', pointerCancel);
                window.removeEventListener('blur', cancelOnBlur);
            };

            const updateGhost = (clientX, clientY) => {
                if (!ghost) return;
                const left = clientX - pointerOffsetX * GHOST_SCALE;
                const top = clientY - pointerOffsetY * GHOST_SCALE;
                ghost.style.transform = `translate3d(${left}px, ${top}px, 0) scale(${GHOST_SCALE})`;
            };

            const placePlaceholderAtPointer = (event) => {
                const candidates = items();
                if (!candidates.length || !placeholder) return;
                let nearest = null;
                let best = Infinity;
                for (const candidate of candidates) {
                    const rect = candidate.getBoundingClientRect();
                    const dx = (event.clientX - (rect.left + rect.width / 2)) / Math.max(1, rect.width);
                    const dy = (event.clientY - (rect.top + rect.height / 2)) / Math.max(1, rect.height);
                    const distance = dx * dx + dy * dy;
                    if (distance < best) {
                        best = distance;
                        nearest = candidate;
                    }
                }
                if (!nearest) return;
                const rect = nearest.getBoundingClientRect();
                const dx = (event.clientX - (rect.left + rect.width / 2)) / Math.max(1, rect.width);
                const dy = (event.clientY - (rect.top + rect.height / 2)) / Math.max(1, rect.height);
                const after = Math.abs(dx) >= Math.abs(dy) ? dx >= 0 : dy >= 0;
                const reference = after ? nearest.nextElementSibling : nearest;
                if (reference === placeholder || placeholder.nextElementSibling === reference) return;

                animatePlaceholderMove(container, placeholder, () => {
                    container.insertBefore(placeholder, reference);
                });
            };

            const move = (event) => {
                if (event.pointerId !== pointerId) return;
                if (!dragging) {
                    if (Math.hypot(event.clientX - startX, event.clientY - startY) < THRESHOLD) return;
                    dragging = true;
                    placeholder = document.createElement('div');
                    placeholder.className = 'qa-slot-placeholder';
                    placeholder.setAttribute('aria-hidden', 'true');
                    placeholder.style.width = `${itemRect.width}px`;
                    placeholder.style.height = `${itemRect.height}px`;

                    ghost = document.createElement('div');
                    ghost.className = 'qa-slot-drag-ghost';
                    ghost.dataset.tone = item.dataset.tone || 'normal';
                    if (item.dataset.erase === 'true') ghost.dataset.erase = 'true';
                    ghost.innerHTML = item.innerHTML;
                    ghost.setAttribute('aria-hidden', 'true');
                    ghost.tabIndex = -1;
                    ghost.style.width = `${itemRect.width}px`;
                    ghost.style.height = `${itemRect.height}px`;
                    ghost.style.transform = `translate3d(${itemRect.left}px, ${itemRect.top}px, 0) scale(${GHOST_SCALE})`;
                    document.body.appendChild(ghost);

                    container.replaceChild(placeholder, item);
                    container.classList.add('is-reordering');
                    onStart?.();
                }
                event.preventDefault();
                updateGhost(event.clientX, event.clientY);
                placePlaceholderAtPointer(event);
            };

            const finish = (cancelled) => {
                cleanupListeners();
                if (!dragging) return;

                let nextOrder = null;
                if (cancelled) {
                    clearMotion(container);
                    container.replaceChildren(...originalChildren);
                } else {
                    container.replaceChild(item, placeholder);
                    nextOrder = items().map(idOf);
                }

                ghost?.remove();
                placeholder?.remove();
                container.classList.remove('is-reordering');
                clearMotion(container);
                if (!cancelled && JSON.stringify(nextOrder) !== originalOrder) onReorder?.(nextOrder);
                onEnd?.();
            };

            const pointerUp = (event) => {
                if (event.pointerId !== pointerId) return;
                if (dragging) move(event);
                finish(false);
            };

            const pointerCancel = (event) => {
                if (event.pointerId === pointerId) finish(true);
            };

            const cancelOnBlur = () => finish(true);

            window.addEventListener('pointermove', move);
            window.addEventListener('pointerup', pointerUp);
            window.addEventListener('pointercancel', pointerCancel);
            window.addEventListener('blur', cancelOnBlur);
        });
    });
}
