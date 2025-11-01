// ===== system/drawing/pointer-handler.js =====
// PointerEvent統一ハンドラ（マウス・タッチ・ペン対応）
// DRY原則：全UIコンポーネントでこのハンドラを使用

(function() {
    'use strict';

    /**
     * PointerEvent統一ハンドラ
     * マウス・タッチ・タブレットペンを単一インターフェースで扱う
     */
    class PointerHandler {
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

            // ポインター状態管理
            const activePointers = new Map();

            function normalizeEvent(e) {
                return {
                    pointerId: e.pointerId,
                    pointerType: e.pointerType, // 'pen' | 'touch' | 'mouse'
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
                // 右クリックは無視
                if (e.button === 2) return;

                const info = normalizeEvent(e);
                activePointers.set(e.pointerId, info);

                // ポインターキャプチャ
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
                const info = normalizeEvent(e);
                
                // アクティブなポインターのみ処理
                if (activePointers.has(e.pointerId)) {
                    activePointers.set(e.pointerId, info);
                    
                    if (handlers.move) {
                        handlers.move(info, e);
                    }
                }

                if (preventDefault) {
                    e.preventDefault();
                }
            }

            function onPointerUp(e) {
                const info = normalizeEvent(e);

                // ポインターキャプチャ解放
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

            // イベント登録
            element.addEventListener('pointerdown', onPointerDown, { capture, passive: false });
            element.addEventListener('pointermove', onPointerMove, { capture, passive: false });
            element.addEventListener('pointerup', onPointerUp, { capture, passive: false });
            element.addEventListener('pointercancel', onPointerCancel, { capture, passive: false });

            // デタッチ関数を返す
            return () => {
                element.removeEventListener('pointerdown', onPointerDown, { capture });
                element.removeEventListener('pointermove', onPointerMove, { capture });
                element.removeEventListener('pointerup', onPointerUp, { capture });
                element.removeEventListener('pointercancel', onPointerCancel, { capture });
                activePointers.clear();
            };
        }

        /**
         * グローバルポインターハンドラ（document全体で捕捉）
         */
        static attachGlobal(handlers, options = {}) {
            return PointerHandler.attach(document, handlers, {
                ...options,
                capture: true
            });
        }
    }

    // グローバル公開
    window.PointerHandler = PointerHandler;

    console.log('✅ pointer-handler.js loaded');
})();