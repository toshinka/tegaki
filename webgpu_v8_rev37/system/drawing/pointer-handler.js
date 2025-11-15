/**
 * ================================================================================
 * pointer-handler.js Phase 5完全版
 * ================================================================================
 * 
 * 📁 親ファイル依存: なし（独立モジュール）
 * 
 * 📄 子ファイル使用先:
 *   - system/drawing/drawing-engine.js
 * 
 * 【責務】
 * - PointerEvent統一ハンドラ（マウス・タッチ・ペン対応）
 * - pointerType自動補正（mouse+pressure→pen判定）
 * - ポインターキャプチャ管理
 * 
 * 【Phase 5改修内容】
 * ✅ pressure正規化修正（マウスは常に0、ペンのみe.pressure使用）
 * ✅ 過剰ログ削除
 * 
 * ================================================================================
 */

(function() {
    'use strict';

    class PointerHandler {
        /**
         * 要素にPointerEventハンドラをアタッチ
         * @param {HTMLElement} element - 対象要素
         * @param {Object} handlers - {down, move, up, cancel}
         * @param {Object} options - {preventDefault, capture}
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
             * Phase 5: pointerType補正 + pressure正規化
             */
            function normalizeEvent(e) {
                let pType = e.pointerType;
                
                // ヒューリスティック: mouseでも筆圧・傾きがあればペン
                if (pType === 'mouse') {
                    const hasPressure = typeof e.pressure === 'number' && e.pressure > 0.01;
                    const hasTilt = typeof e.tiltX === 'number' && 
                                   (e.tiltX !== 0 || e.tiltY !== 0);
                    
                    if (hasPressure || hasTilt) {
                        pType = 'pen';
                    }
                }
                
                // ✅ Phase 5: pressure正規化修正
                // マウス: 常に0
                // ペン: e.pressure ?? 0.5
                const pressure = (pType === 'pen') 
                    ? (e.pressure ?? 0.5) 
                    : 0;
                
                return {
                    pointerId: e.pointerId,
                    pointerType: pType,
                    clientX: e.clientX,
                    clientY: e.clientY,
                    pressure: pressure,
                    tiltX: e.tiltX ?? 0,
                    tiltY: e.tiltY ?? 0,
                    twist: e.twist ?? 0,
                    button: e.button,
                    buttons: e.buttons,
                    originalEvent: e
                };
            }

            function onPointerDown(e) {
                if (e.button === 2) return;

                const info = normalizeEvent(e);
                activePointers.set(e.pointerId, info);

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

        static attachGlobal(handlers, options = {}) {
            return PointerHandler.attach(document, handlers, {
                ...options,
                capture: true
            });
        }
    }

    window.PointerHandler = PointerHandler;

})();

console.log('✅ pointer-handler.js Phase 5 loaded');