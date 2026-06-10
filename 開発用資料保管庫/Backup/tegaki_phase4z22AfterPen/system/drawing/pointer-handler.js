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
        this.pressure = null; // 筆圧の平滑化用
    }

    reset(x, y, pressure = 0.5) {
        this.penX = x;
        this.penY = y;
        this.pressure = pressure;
    }

    /**
     * @param {number} x - 生のX座標
     * @param {number} y - 生のY座標
     * @param {number} rawPressure - 補正・カーブ適用後の筆圧
     * @returns {Object} 補正後の座標と筆圧
     */
    update(x, y, rawPressure) {
        if (this.penX === null) {
            this.reset(x, y, rawPressure);
            return { x, y, pressure: rawPressure, moved: true };
        }
        
        // --- 座標の平滑化 ---
        const dx = x - this.penX;
        const dy = y - this.penY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0.0001) {
            const damping = this.radius <= 0 ? 1.0 : Math.min(1.0, dist / (dist + this.radius));
            this.penX += dx * damping;
            this.penY += dy * damping;
        }

        // --- 筆圧の平滑化 (インク溜まり・スパイク防止) ---
        // 指数移動平均を適用。0.15 (非常に滑らか) 〜 1.0 (即時)
        // 手ブレ補正（radius）が強いほど、筆圧の変化も緩やかに追従させます
        const pDamping = this.radius <= 0 ? 1.0 : Math.max(0.15, 1.0 - (this.radius / 256));
        this.pressure += (rawPressure - this.pressure) * pDamping;
        
        return { 
            x: this.penX, 
            y: this.penY, 
            pressure: this.pressure, 
            moved: dist > 0.0001 
        };
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

        // [診断用] 液タブ等の入力トラブル解析用フラグ
        // 開発者コンソールで window.TegakiPointerDebug = true にすると詳細ログが出ます
        window.TegakiPointerDebug = false;

        function logDiagnostic(type, e, info, smoothed = null) {
            if (!window.TegakiPointerDebug) return;
            
            // [インク溜まり調査] 筆圧の急激な変化を検知
            const rawP = e.pressure ?? 0.5;
            const normP = info?.pressure ?? 0.5;
            const isSpike = (type === 'down' && rawP > 0.8) || (type === 'move' && Math.abs(rawP - (window._lastRawP || 0.5)) > 0.4);
            window._lastRawP = rawP;

            console.log(`[PointerDiag] ${type}${isSpike ? ' 🔥SPIKE' : ''}:`, {
                id: e.pointerId,
                type: e.pointerType,
                button: e.button,
                buttons: e.buttons,
                rawP: rawP.toFixed(3),
                normP: normP.toFixed(3),
                finalP: smoothed ? smoothed.pressure.toFixed(3) : normP.toFixed(3),
                rawX: Math.round(e.clientX),
                rawY: Math.round(e.clientY),
                smX: smoothed ? Math.round(smoothed.x) : null,
                smY: smoothed ? Math.round(smoothed.y) : null,
                isPrimary: e.isPrimary
            });
        }

        function applyPressureCurve(p, curve) {
            // [案3] より極端でメリハリのあるカーブにするため、累乗を 2 -> 3 へ引き上げます
            if (curve === 'ease-in')  return p * p * p;           // 重め：かなり強く押さないと太くならない
            if (curve === 'ease-out') return 1 - (1 - p)**3;     // 軽め：少しの力で一気に太くなる
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
            const info = normalizeEvent(e);
            
            // 右クリック除外（ペン以外の場合のみ除外する）
            if (e.button === 2 && e.pointerType !== 'pen') return;

            const lazyEnabled = window.TEGAKI_CONFIG?.pen?.lazyEnabled ?? true;
            let smoothed = null;
            if (lazyEnabled) {
                const sm = window.TegakiSettingsManager;
                const smoothing = sm ? (sm.get('smoothing') ?? 0.5) : 0.5;
                const brush = new LazyBrush(smoothing * 128);
                lazyBrushes.set(e.pointerId, brush);
                smoothed = brush.update(info.clientX, info.clientY, info.pressure);
                
                // 平滑化後の筆圧を適用
                info.pressure = smoothed.pressure;
            }

            logDiagnostic('down', e, info, smoothed);

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
                let smoothed = null;

                if (lazyEnabled) {
                    let brush = lazyBrushes.get(e.pointerId);
                    const sm = window.TegakiSettingsManager;
                    const smoothing = sm ? (sm.get('smoothing') ?? 0.5) : 0.5;
                    
                    if (!brush) {
                        brush = new LazyBrush(smoothing * 128);
                        lazyBrushes.set(e.pointerId, brush);
                        brush.reset(info.clientX, info.clientY, info.pressure);
                    }
                    
                    // スライダー値をリアルタイム反映（最大128）
                    brush.radius = smoothing * 128;

                    smoothed = brush.update(info.clientX, info.clientY, info.pressure);
                    info.clientX = smoothed.x;
                    info.clientY = smoothed.y;
                    info.pressure = smoothed.pressure;
                    shouldTrigger = smoothed.moved;
                }

                logDiagnostic('move', coalescedEvent, info, smoothed);

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
