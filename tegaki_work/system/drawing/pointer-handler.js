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
 * 実装状態: ♻️移植 + STEP1/1.5実装済み
 * ============================================================================
 */

/**
 * 手ブレ補正クラス（Lerp方式・デッドゾーンなし）
 * スクリーン座標空間で動作するため、ズーム倍率に依存しない。
 * ポインターIDごとにインスタンスを生成して使う。
 */
class LazyBrush {
    constructor() {
        this.radius = 8;   // 補正半径（スクリーンpx）。0 = 補正なし
        this.penX = null;
        this.penY = null;
    }

    /** ストローク開始時に呼ぶ。初期座標をセットする */
    reset(x, y) {
        this.penX = x;
        this.penY = y;
    }

    /**
     * 新しいポインター座標を与え、補正後の座標を返す。
     * @param {number} x - スクリーン座標X
     * @param {number} y - スクリーン座標Y
     * @returns {{ x: number, y: number }}
     */
    update(x, y) {
        if (this.penX === null) {
            this.reset(x, y);
            return { x, y };
        }
        const dx = x - this.penX;
        const dy = y - this.penY;
        const dist = Math.hypot(dx, dy);

        if (dist <= 0) return { x: this.penX, y: this.penY };

        // radius=0 なら即時追従、大きいほど遅延する指数減衰
        const damping = this.radius <= 0
            ? 1.0
            : Math.min(1.0, dist / (dist + this.radius));

        this.penX += dx * damping;
        this.penY += dy * damping;

        return { x: this.penX, y: this.penY };
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
        const lazyBrushes = new Map(); // ポインターIDごとの LazyBrush インスタンス

        /**
         * SettingsManager から筆圧補正・カーブを読み、補正済み pressure を返す。
         * SettingsManager が未初期化の場合はデフォルト値で動作する。
         */
        function applyPressureSettings(rawPressure, pointerType) {
            const mgr = window.TegakiSettingsManager;

            // マウスは筆圧を返さないブラウザが多いため 0.5 固定にする
            // （0.0 のままだと calculateWidth のフォールバック変更で極細になる）
            const effectiveRaw = (pointerType === 'mouse' && (rawPressure === 0 || rawPressure == null))
                ? 0.5
                : rawPressure;

            // 筆圧補正係数（1.0 = 補正なし、値が大きいほど筆圧を増幅）
            const correction = mgr?.get?.('pressureCorrection') ?? 1.0;
            let pressure = Math.min(1.0, Math.max(0.0, (effectiveRaw ?? 0.0) * correction));

            // 筆圧カーブ
            const curve = mgr?.get?.('pressureCurve') ?? 'linear';
            if (curve === 'ease-in') {
                // 軽め：弱い押しでも反応しやすくする
                pressure = 1 - (1 - pressure) * (1 - pressure);
            } else if (curve === 'ease-out') {
                // 重め：強く押さないと太くならない
                pressure = pressure * pressure;
            }
            // 'linear' はそのまま

            return pressure;
        }

        /**
         * PointerEvent を正規化して内部 info オブジェクトを作る。
         * clientX/Y は LazyBrush 適用後に上書きされるため、ここでは生値を使う。
         */
        function normalizeEvent(e, options = {}) {
            const baseEvent = options.baseEvent || e;
            const profileEvent = options.profileEvent === undefined ? e : options.profileEvent;
            const pointerType = e.pointerType || baseEvent.pointerType || 'unknown';
            const rawPressure = e.pressure ?? baseEvent.pressure;
            return {
                pointerId: e.pointerId ?? baseEvent.pointerId,
                pointerType,
                eventType: e.type || baseEvent.type,
                clientX: e.clientX ?? baseEvent.clientX,
                clientY: e.clientY ?? baseEvent.clientY,
                rawClientX: e.clientX,
                rawClientY: e.clientY,
                rawPressure,
                pressure: applyPressureSettings(rawPressure, pointerType),
                tiltX: e.tiltX ?? baseEvent.tiltX ?? 0,
                tiltY: e.tiltY ?? baseEvent.tiltY ?? 0,
                twist: e.twist ?? baseEvent.twist ?? 0,
                button: e.button ?? baseEvent.button,
                buttons: e.buttons ?? baseEvent.buttons,
                timeStamp: e.timeStamp ?? baseEvent.timeStamp,
                inputProfile: window.TEGAKI_CONFIG?.debug && profileEvent
                    ? createInputProfile(profileEvent)
                    : null,
                originalEvent: baseEvent
            };
        }

        function getCoalescedMoveEvents(e) {
            let events = [];
            if (typeof e.getCoalescedEvents === 'function') {
                try {
                    events = e.getCoalescedEvents() || [];
                } catch (err) {
                    events = [];
                }
            }

            if (!Array.isArray(events) || events.length === 0) {
                return [e];
            }

            const samePointerEvents = events.filter(item => (item.pointerId ?? e.pointerId) === e.pointerId);
            const result = samePointerEvents.length > 0 ? [...samePointerEvents] : [...events];
            const last = result[result.length - 1];
            const lastMatchesCurrent = last
                && last.clientX === e.clientX
                && last.clientY === e.clientY
                && last.pressure === e.pressure
                && last.timeStamp === e.timeStamp;

            if (!lastMatchesCurrent) {
                result.push(e);
            }
            return result;
        }

        function summarizeNumbers(values) {
            const numeric = values
                .map(value => Number(value))
                .filter(value => Number.isFinite(value));

            if (numeric.length === 0) {
                return { min: null, max: null, delta: null };
            }

            const min = Math.min(...numeric);
            const max = Math.max(...numeric);
            return {
                min: Number(min.toFixed(4)),
                max: Number(max.toFixed(4)),
                delta: Number((max - min).toFixed(4))
            };
        }

        function createInputProfile(e) {
            const coalescedSupported = typeof e.getCoalescedEvents === 'function';
            let coalesced = [];
            if (coalescedSupported) {
                try {
                    coalesced = e.getCoalescedEvents() || [];
                } catch (err) {
                    coalesced = [];
                }
            }

            const coalescedPoints = coalesced.map(item => ({
                clientX: Number(item.clientX?.toFixed?.(3) ?? item.clientX),
                clientY: Number(item.clientY?.toFixed?.(3) ?? item.clientY),
                pressure: Number(item.pressure?.toFixed?.(4) ?? item.pressure),
                timeStamp: Number(item.timeStamp?.toFixed?.(3) ?? item.timeStamp)
            }));

            return {
                eventType: e.type,
                pointerId: e.pointerId,
                pointerType: e.pointerType || 'unknown',
                button: e.button,
                buttons: e.buttons,
                client: {
                    x: Number(e.clientX.toFixed(3)),
                    y: Number(e.clientY.toFixed(3))
                },
                pressure: {
                    raw: e.pressure,
                    adjusted: applyPressureSettings(e.pressure, e.pointerType),
                    correction: window.TegakiSettingsManager?.get?.('pressureCorrection') ?? 1.0,
                    curve: window.TegakiSettingsManager?.get?.('pressureCurve') ?? 'linear'
                },
                timeStamp: Number(e.timeStamp?.toFixed?.(3) ?? e.timeStamp),
                coalesced: {
                    supported: coalescedSupported,
                    count: coalesced.length,
                    clientX: summarizeNumbers(coalesced.map(item => item.clientX)),
                    clientY: summarizeNumbers(coalesced.map(item => item.clientY)),
                    pressure: summarizeNumbers(coalesced.map(item => item.pressure)),
                    samples: coalescedPoints.length <= 4
                        ? coalescedPoints
                        : [
                            coalescedPoints[0],
                            coalescedPoints[1],
                            coalescedPoints[coalescedPoints.length - 2],
                            coalescedPoints[coalescedPoints.length - 1]
                        ]
                }
            };
        }

        function onPointerDown(e) {
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

            // 右クリック除外（ペン以外の場合のみ。ペンの button===2 は副ボタン/消しゴム側）
            if (e.button === 2 && e.pointerType !== 'pen') return;

            const info = normalizeEvent(e);
            activePointers.set(e.pointerId, info);
            window.lastPointerType = info.pointerType;

            // LazyBrush を初期化してポインターIDと紐づける
            const brush = new LazyBrush();
            const mgr = window.TegakiSettingsManager;
            const smoothing = mgr?.get?.('smoothing') ?? 0.5;
            brush.radius = smoothing * 16; // smoothing 0.5 → radius 8（旧デフォルト相当）
            brush.reset(e.clientX, e.clientY);
            lazyBrushes.set(e.pointerId, brush);

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
            if (!activePointers.has(e.pointerId)) {
                if (preventDefault) e.preventDefault();
                return;
            }

            // smoothing 値をリアルタイムで反映（設定変更が即座に効く）
            const brush = lazyBrushes.get(e.pointerId);
            if (brush) {
                const mgr = window.TegakiSettingsManager;
                const smoothing = mgr?.get?.('smoothing') ?? 0.5;
                brush.radius = smoothing * 16;
            }

            const moveEvents = getCoalescedMoveEvents(e);
            const moveInfos = [];

            for (let index = 0; index < moveEvents.length; index++) {
                const sourceEvent = moveEvents[index];
                const isLast = index === moveEvents.length - 1;
                const rawClientX = sourceEvent.clientX ?? e.clientX;
                const rawClientY = sourceEvent.clientY ?? e.clientY;

                // LazyBrush で座標をフィルタリング。coalesced点も古い順に通す。
                const filtered = brush
                    ? brush.update(rawClientX, rawClientY)
                    : { x: rawClientX, y: rawClientY };

                const info = normalizeEvent(sourceEvent, {
                    baseEvent: e,
                    profileEvent: isLast ? e : null
                });
                // LazyBrush 補正済み座標で上書き
                info.clientX = filtered.x;
                info.clientY = filtered.y;
                info.rawClientX = rawClientX;
                info.rawClientY = rawClientY;

                if (info.inputProfile) {
                    info.inputProfile.lazyClient = {
                        x: Number(filtered.x.toFixed(3)),
                        y: Number(filtered.y.toFixed(3)),
                        offsetX: Number((filtered.x - rawClientX).toFixed(3)),
                        offsetY: Number((filtered.y - rawClientY).toFixed(3))
                    };
                }

                activePointers.set(e.pointerId, info);
                moveInfos.push(info);
            }

            if (moveInfos.length > 1 && handlers.moveBatch) {
                handlers.moveBatch(moveInfos, e);
            } else if (handlers.move) {
                moveInfos.forEach(info => handlers.move(info, e));
            }

            if (preventDefault) {
                e.preventDefault();
            }
        }

        function onPointerUp(e) {
            const info = normalizeEvent(e);
            const brush = lazyBrushes.get(e.pointerId);
            const rawClientX = e.clientX;
            const rawClientY = e.clientY;
            const filtered = brush
                ? brush.update(rawClientX, rawClientY)
                : { x: rawClientX, y: rawClientY };

            info.clientX = filtered.x;
            info.clientY = filtered.y;
            info.rawClientX = rawClientX;
            info.rawClientY = rawClientY;

            if (info.inputProfile) {
                info.inputProfile.lazyClient = {
                    x: Number(filtered.x.toFixed(3)),
                    y: Number(filtered.y.toFixed(3)),
                    offsetX: Number((filtered.x - rawClientX).toFixed(3)),
                    offsetY: Number((filtered.y - rawClientY).toFixed(3))
                };
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
            lazyBrushes.delete(e.pointerId); // LazyBrush を破棄
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
            lazyBrushes.delete(e.pointerId); // LazyBrush を破棄
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
            lazyBrushes.clear(); // デタッチ時に全 LazyBrush を破棄
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
