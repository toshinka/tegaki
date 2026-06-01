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
                // 軽め：弱い押しで細くなる（二乗で感度を下げる）
                pressure = pressure * pressure;
            } else if (curve === 'ease-out') {
                // 重め：強く押さないと太くならない（逆二乗）
                pressure = 1 - (1 - pressure) * (1 - pressure);
            }
            // 'linear' はそのまま

            return pressure;
        }

        /**
         * PointerEvent を正規化して内部 info オブジェクトを作る。
         * clientX/Y は LazyBrush 適用後に上書きされるため、ここでは生値を使う。
         */
        function normalizeEvent(e) {
            return {
                pointerId: e.pointerId,
                pointerType: e.pointerType,
                clientX: e.clientX,
                clientY: e.clientY,
                pressure: applyPressureSettings(e.pressure, e.pointerType),
                tiltX: e.tiltX ?? 0,
                tiltY: e.tiltY ?? 0,
                twist: e.twist ?? 0,
                button: e.button,
                buttons: e.buttons,
                originalEvent: e
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

            // LazyBrush で座標をフィルタリング
            const filtered = brush
                ? brush.update(e.clientX, e.clientY)
                : { x: e.clientX, y: e.clientY };

            const info = normalizeEvent(e);
            // LazyBrush 補正済み座標で上書き
            info.clientX = filtered.x;
            info.clientY = filtered.y;

            activePointers.set(e.pointerId, info);

            if (handlers.move) {
                handlers.move(info, e);
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
