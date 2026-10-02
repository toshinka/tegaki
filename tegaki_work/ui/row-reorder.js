/**
 * ============================================================================
 * ファイル名: ui/row-reorder.js
 * 責務: 横並びのボタン列をポインタ(マウス/ペン/タッチ)のドラッグで並べ替える小さな部品
 * 依存: なし
 * 被依存: ui/quick-access-popup.js
 * 公開API: enableRowReorder
 * 実装状態: ✅実装
 *
 * 押した瞬間のクリック動作は呼び出し側のまま(この部品は止めない)。しきい値を超えて動かした時だけ並べ替えとして扱い、
 * ドラッグ中は列の中でボタンが入れ替わる様子をそのまま見せる(押しのけが分かる)。折り返す列は最も近い中心へ挿入。
 * ============================================================================
 */

const THRESHOLD = 6;

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
            let dragging = false;
            const initialOrder = items().map(idOf).join('|');

            const move = (e) => {
                if (e.pointerId !== pointerId) return;
                if (!dragging) {
                    if (Math.hypot(e.clientX - startX, e.clientY - startY) < THRESHOLD) return;
                    dragging = true;
                    item.classList.add('is-reordering');
                    container.classList.add('is-reordering');
                    onStart?.();
                }
                e.preventDefault();
                // ポインタに最も近い(自分以外の)ボタンの手前/後ろへ挿入する
                const others = items().filter(el => el !== item);
                if (!others.length) return;
                let nearest = null;
                let best = Infinity;
                for (const el of others) {
                    const r = el.getBoundingClientRect();
                    const d = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
                    if (d < best) { best = d; nearest = el; }
                }
                const r = nearest.getBoundingClientRect();
                const after = e.clientX > r.left + r.width / 2 && e.clientY >= r.top - 2;
                const reference = after ? nearest.nextElementSibling : nearest;
                if (reference !== item && item.nextElementSibling !== reference) {
                    container.insertBefore(item, reference);
                }
            };
            const finish = (e) => {
                if (e.pointerId !== pointerId) return;
                window.removeEventListener('pointermove', move);
                window.removeEventListener('pointerup', finish);
                window.removeEventListener('pointercancel', finish);
                if (!dragging) return;
                item.classList.remove('is-reordering');
                container.classList.remove('is-reordering');
                const nextOrder = items().map(idOf);
                if (nextOrder.join('|') !== initialOrder) onReorder?.(nextOrder);
                onEnd?.();
            };
            window.addEventListener('pointermove', move);
            window.addEventListener('pointerup', finish);
            window.addEventListener('pointercancel', finish);
        });
    });
}
