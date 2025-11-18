/**
 * ================================================================================
 * pointer-handler.js Phase 1改修版 (EventEmitter風API対応)
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
 * - EventEmitter風APIによるイベント管理
 * 
 * 【Phase 1改修内容】
 * 🔧 pressure正規化修正（マウス=0, ペン=e.pressure）
 * 🔧 EventEmitter風API実装（.on() / .off() / .emit()）
 * 🔧 インスタンスクラス化（new PointerHandler(element)）
 * 
 * ================================================================================
 */

(function() {
    'use strict';

    class PointerHandler {
        /**
         * @param {HTMLElement} element - 対象Canvas要素
         * @param {Object} options - {preventDefault, capture}
         */
        constructor(element, options = {}) {
            if (!element) {
                throw new Error('[PointerHandler] Element is required');
            }

            this.element = element;
            this.options = {
                preventDefault: options.preventDefault !== false, // default: true
                capture: options.capture || false
            };

            this.activePointers = new Map();
            this.eventHandlers = new Map(); // イベント名 -> Set<callback>
            this.boundListeners = null; // cleanup用
            this.attached = false;

            this._attach();
        }

        /**
         * イベントリスナー登録（EventEmitter風API）
         * @param {string} eventName - 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel'
         * @param {Function} callback - (normalizedEvent) => void
         */
        on(eventName, callback) {
            if (!this.eventHandlers.has(eventName)) {
                this.eventHandlers.set(eventName, new Set());
            }
            this.eventHandlers.get(eventName).add(callback);
        }

        /**
         * イベントリスナー削除
         */
        off(eventName, callback) {
            if (!this.eventHandlers.has(eventName)) return;
            this.eventHandlers.get(eventName).delete(callback);
        }

        /**
         * イベント発火（内部用）
         */
        _emit(eventName, ...args) {
            if (!this.eventHandlers.has(eventName)) return;
            this.eventHandlers.get(eventName).forEach(callback => {
                try {
                    callback(...args);
                } catch (err) {
                    console.error(`[PointerHandler] Event handler error (${eventName}):`, err);
                }
            });
        }

        /**
         * PointerEvent正規化
         * 🔧 Phase 1改修: pressure正規化（マウス=0, ペン=e.pressure）
         */
        _normalizeEvent(e) {
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
            
            // 🔧 Phase 1改修: pressure正規化
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
                timeStamp: e.timeStamp,
                originalEvent: e
            };
        }

        /**
         * PointerEventハンドラアタッチ
         */
        _attach() {
            if (this.attached) {
                console.warn('[PointerHandler] Already attached');
                return;
            }

            const onPointerDown = (e) => {
                if (e.button === 2) return; // 右クリック無視

                const info = this._normalizeEvent(e);
                this.activePointers.set(e.pointerId, info);

                try {
                    e.target.setPointerCapture(e.pointerId);
                } catch (err) {
                    console.warn('[PointerHandler] setPointerCapture failed:', err);
                }

                this._emit('pointerdown', info);

                if (this.options.preventDefault) {
                    e.preventDefault();
                }
            };

            const onPointerMove = (e) => {
                const info = this._normalizeEvent(e);
                
                if (this.activePointers.has(e.pointerId)) {
                    this.activePointers.set(e.pointerId, info);
                    this._emit('pointermove', info);
                }

                if (this.options.preventDefault) {
                    e.preventDefault();
                }
            };

            const onPointerUp = (e) => {
                const info = this._normalizeEvent(e);

                try {
                    e.target.releasePointerCapture(e.pointerId);
                } catch (err) {
                    console.warn('[PointerHandler] releasePointerCapture failed:', err);
                }

                this._emit('pointerup', info);
                this.activePointers.delete(e.pointerId);

                if (this.options.preventDefault) {
                    e.preventDefault();
                }
            };

            const onPointerCancel = (e) => {
                const info = this._normalizeEvent(e);

                try {
                    e.target.releasePointerCapture(e.pointerId);
                } catch (err) {}

                this._emit('pointercancel', info);
                this.activePointers.delete(e.pointerId);

                if (this.options.preventDefault) {
                    e.preventDefault();
                }
            };

            this.boundListeners = {
                down: onPointerDown,
                move: onPointerMove,
                up: onPointerUp,
                cancel: onPointerCancel
            };

            const capture = this.options.capture;

            this.element.addEventListener('pointerdown', onPointerDown, { capture, passive: false });
            this.element.addEventListener('pointermove', onPointerMove, { capture, passive: false });
            this.element.addEventListener('pointerup', onPointerUp, { capture, passive: false });
            this.element.addEventListener('pointercancel', onPointerCancel, { capture, passive: false });

            this.attached = true;
        }

        /**
         * PointerEventハンドラデタッチ
         */
        detach() {
            if (!this.attached || !this.boundListeners) return;

            const capture = this.options.capture;

            this.element.removeEventListener('pointerdown', this.boundListeners.down, { capture });
            this.element.removeEventListener('pointermove', this.boundListeners.move, { capture });
            this.element.removeEventListener('pointerup', this.boundListeners.up, { capture });
            this.element.removeEventListener('pointercancel', this.boundListeners.cancel, { capture });

            this.activePointers.clear();
            this.eventHandlers.clear();
            this.boundListeners = null;
            this.attached = false;
        }

        /**
         * アクティブなポインター情報取得
         */
        getActivePointers() {
            return Array.from(this.activePointers.values());
        }

        /**
         * 特定ポインター情報取得
         */
        getPointer(pointerId) {
            return this.activePointers.get(pointerId) || null;
        }
    }

    // グローバル登録
    window.PointerHandler = PointerHandler;

    console.log('✅ pointer-handler.js Phase 1 loaded');
    console.log('   🔧 pressure正規化修正（マウス=0, ペン=e.pressure）');
    console.log('   🔧 EventEmitter風API実装（.on / .off）');

})();