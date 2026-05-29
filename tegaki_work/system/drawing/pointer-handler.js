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

class LazyBrush {
    constructor(radius = 8) {
        this.radius = radius;
        this.penX = null;
        this.penY = null;
    }

    reset(x, y) {
        this.penX = x;
        this.penY = y;
    }

    update(x, y) {
        if (this.penX === null) {
            this.reset(x, y);
            return { x, y, moved: true };
        }
        
        // 従来の「剛体的なデッドゾーン（半径によるクランプ）」から、
        // 描き始めの遅延（点のまま線が出ない現象）を解消するため、
        // 設定値に基づく減衰（Lerp/指数移動平均）方式へアップグレードします。
        // lazyRadius = 0 の場合は即時追従（damping = 1.0）
        const damping = this.radius <= 0 ? 1.0 : 1 / (1 + this.radius * 0.3);
        
        const dx = x - this.penX;
        const dy = y - this.penY;
        
        this.penX += dx * damping;
        this.penY += dy * damping;
        
        // わずかでも移動していれば描画イベントを発火し、遅延感を取り除きます
        const moved = Math.hypot(dx * damping, dy * damping) > 0.05;
        
        return { x: this.penX, y: this.penY, moved };
    }
}

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
        const lazyBrushes = new Map();

        /**
         * 筆圧軽減・カーブ適用
         * pressureCorrection: 補正係数 (0.1〜3.0)
         * pressureCurve: 'linear' | 'ease-in' | 'ease-out'
         */
        function applyPressureCurve(p, curve) {
            if (curve === 'ease-in')  return p * p;           // 軽め：弱押しで細く
            if (curve === 'ease-out') return 1 - (1 - p)**2; // 重め：強押しでないと太くならない
            return p; // linear
        }

        /**
         * 座標変換の分岐を統合
         */
        function normalizeEvent(e) {
            const sm = window.TegakiSettingsManager;
            const rawPressure = e.pressure ?? 0.5;
            const correction = sm ? (sm.get('pressureCorrection') ?? 1.0) : 1.0;
            const curve = sm ? (sm.get('pressureCurve') ?? 'linear') : 'linear';
            const corrected = Math.min(1.0, Math.max(0.0, rawPressure * correction));
            const pressure = applyPressureCurve(corrected, curve);

            return {
                pointerId: e.pointerId,
                pointerType: e.pointerType,
                clientX: e.clientX,
                clientY: e.clientY,
                pressure,
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
            if (window.TEGAKI_CONFIG?.debug) {
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
            }

            // 右クリック除外（ペン以外の場合のみ除外する）
            if (e.button === 2 && e.pointerType !== 'pen') return;

            const info = normalizeEvent(e);

            const lazyEnabled = window.TEGAKI_CONFIG?.pen?.lazyEnabled ?? true;
            if (lazyEnabled) {
                // 初期値は smoothing 中央値（0.5）→ radius=8 相当
                const sm = window.TegakiSettingsManager;
                const smoothing = sm ? (sm.get('smoothing') ?? 0.5) : 0.5;
                const brush = new LazyBrush(smoothing * 16);
                lazyBrushes.set(e.pointerId, brush);
                brush.reset(info.clientX, info.clientY);
            }

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
                
                let shouldTrigger = true;
                const lazyEnabled = window.TEGAKI_CONFIG?.pen?.lazyEnabled ?? true;
                if (lazyEnabled) {
                    let brush = lazyBrushes.get(e.pointerId);
                    if (!brush) {
                        const sm = window.TegakiSettingsManager;
                        const smoothing = sm ? (sm.get('smoothing') ?? 0.5) : 0.5;
                        brush = new LazyBrush(smoothing * 16);
                        lazyBrushes.set(e.pointerId, brush);
                        brush.reset(info.clientX, info.clientY);
                    }
                    // スライダー値をリアルタイム反映（0.5→radius8 、範囲0〜16）
                    const sm = window.TegakiSettingsManager;
                    const smoothing = sm ? (sm.get('smoothing') ?? 0.5) : 0.5;
                    brush.radius = smoothing * 16;

                    const res = brush.update(info.clientX, info.clientY);
                    info.clientX = res.x;
                    info.clientY = res.y;
                    shouldTrigger = res.moved;
                }

                activePointers.set(e.pointerId, info);
                
                if (shouldTrigger && handlers.move) {
                    handlers.move(info, coalescedEvent);
                }
            }

            if (preventDefault) {
                e.preventDefault();
            }
        }

        function onPointerUp(e) {
            const info = normalizeEvent(e);

            const lazyEnabled = window.TEGAKI_CONFIG?.pen?.lazyEnabled ?? true;
            if (lazyEnabled) {
                const brush = lazyBrushes.get(e.pointerId);
                if (brush && brush.penX !== null) {
                    info.clientX = brush.penX;
                    info.clientY = brush.penY;
                }
            }

            try {
                e.target.releasePointerCapture(e.pointerId);
            } catch (err) {
                console.warn('[PointerHandler] releasePointerCapture failed:', err);
            }

            if (handlers.up) {
                handlers.up(info, e);
            }

            activePointers.delete(e.pointerId);
            lazyBrushes.delete(e.pointerId);

            if (preventDefault) {
                e.preventDefault();
            }
        }

        function onPointerCancel(e) {
            const info = normalizeEvent(e);

            const lazyEnabled = window.TEGAKI_CONFIG?.pen?.lazyEnabled ?? true;
            if (lazyEnabled) {
                const brush = lazyBrushes.get(e.pointerId);
                if (brush && brush.penX !== null) {
                    info.clientX = brush.penX;
                    info.clientY = brush.penY;
                }
            }

            try {
                e.target.releasePointerCapture(e.pointerId);
            } catch (err) {}

            if (handlers.cancel) {
                handlers.cancel(info, e);
            }

            activePointers.delete(e.pointerId);
            lazyBrushes.delete(e.pointerId);

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
