/**
 * ============================================================================
 * ファイル名: system/drawing/pointer-handler.js
 * 責務: マウス・タッチ・ペンなどのポインターイベントを統一的に処理する
 * 依存: なし
 * 被依存: drawing-engine.js, layer-transform.js等
 * 公開API: PointerHandler
 * イベント発火: なし
 * イベント受信: なし
 * グローバル登録: window.PointerHandler
 * 実装状態: ♻️移植
 * ============================================================================
 */

export class PointerHandler {
    /**
     * 要素にPointerEventハンドラをアタッチ
     * @param {HTMLElement} element - 対象要素
     * @param {Object} handlers - イベントハンドラ群
     * @param {Function} handlers.down - pointerdown時
     * @param {Function} handlers.move - pointermove時
     * @param {Function} handlers.up - pointerup時
     * @param {Function} handlers.cancel - pointercancel時
     * @param {Object} options - オプション
     * @returns {Function} デタッチ関数
     */
    static attach(element, handlers, options = {}) {
        if (!element) {
            console.error('[PointerHandler] Element is null');
            return () => {};
        }

        const {
            preventDefault = true,
            capture = false
        } = options;

        const activePointers = new Map();

        /**
         * 座標変換の分岐を撤廃
         */
        function normalizeEvent(e) {
            return {
                pointerId: e.pointerId,
                pointerType: e.pointerType,
                clientX: e.clientX,
                clientY: e.clientY,
                pressure: e.pressure ?? 0.5,
                tiltX: e.tiltX ?? 0,
                tiltY: e.tiltY ?? 0,
                twist: e.twist ?? 0,
                button: e.button,
                buttons: e.buttons,
                originalEvent: e
            };
        }

        function onPointerDown(e) {
            // [指示書] タブレットペン入力の調査用ログを文字列化
            console.log('[PointerHandler] raw pointerdown', JSON.stringify({
                pointerType: e.pointerType,
                button: e.button,
                buttons: e.buttons,
                pressure: e.pressure,
                pointerId: e.pointerId,
                isPrimary: e.isPrimary,
                target: e.target?.tagName,
                id: e.target?.id,
                className: String(e.target?.className || '')
            }));

            // 右クリック除外（ペン以外の場合のみ除外する）
            if (e.button === 2 && e.pointerType !== 'pen') return;

            const info = normalizeEvent(e);
            activePointers.set(e.pointerId, info);
            window.lastPointerType = info.pointerType;

            try {
                e.target.setPointerCapture(e.pointerId);
            } catch (err) {
                console.warn('[PointerHandler] setPointerCapture failed:', err);
            }

            if (handlers.down) {
                handlers.down(info, e);
            }

            if (preventDefault) {
                e.preventDefault();
            }
        }

        function onPointerMove(e) {
            if (!activePointers.has(e.pointerId)) return;

            // getCoalescedEvents() で間引かれた中間点を全て処理
            const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
            
            for (const coalescedEvent of events) {
                const info = normalizeEvent(coalescedEvent);
                activePointers.set(e.pointerId, info);
                
                if (handlers.move) {
                    handlers.move(info, coalescedEvent);
                }
            }

            if (preventDefault) {
                e.preventDefault();
            }
        }

        function onPointerUp(e) {
            const info = normalizeEvent(e);

            try {
                e.target.releasePointerCapture(e.pointerId);
            } catch (err) {
                console.warn('[PointerHandler] releasePointerCapture failed:', err);
            }

            if (handlers.up) {
                handlers.up(info, e);
            }

            activePointers.delete(e.pointerId);

            if (preventDefault) {
                e.preventDefault();
            }
        }

        function onPointerCancel(e) {
            const info = normalizeEvent(e);

            try {
                e.target.releasePointerCapture(e.pointerId);
            } catch (err) {}

            if (handlers.cancel) {
                handlers.cancel(info, e);
            }

            activePointers.delete(e.pointerId);

            if (preventDefault) {
                e.preventDefault();
            }
        }

        element.addEventListener('pointerdown', onPointerDown, { capture, passive: false });
        element.addEventListener('pointermove', onPointerMove, { capture, passive: false });
        element.addEventListener('pointerup', onPointerUp, { capture, passive: false });
        element.addEventListener('pointercancel', onPointerCancel, { capture, passive: false });

        return () => {
            element.removeEventListener('pointerdown', onPointerDown, { capture });
            element.removeEventListener('pointermove', onPointerMove, { capture });
            element.removeEventListener('pointerup', onPointerUp, { capture });
            element.removeEventListener('pointercancel', onPointerCancel, { capture });
            activePointers.clear();
        };
    }

    /**
     * グローバルポインターハンドラ
     */
    static attachGlobal(handlers, options = {}) {
        return PointerHandler.attach(document, handlers, {
            ...options,
            capture: true
        });
    }
}

// 下位互換性のためにグローバルに登録
window.PointerHandler = PointerHandler;
