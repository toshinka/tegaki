/**
 * StrokeRecorder - ストローク座標記録専用クラス
 * Phase 2対応版: グローバル公開
 * 
 * 責務: ローカル座標のポイントを直接記録
 * 
 * 修正: drawing-engine.js (現BrushCore) から既にLocal座標で受け取るため、
 *      screenToLayer()を呼ばない（二重変換防止）
 */

(function() {
    'use strict';

    class StrokeRecorder {
        constructor(pressureHandler, cameraSystem) {
            this.pressureHandler = pressureHandler;
            this.cameraSystem = cameraSystem;
            this.points = [];
            this.isRecording = false;
        }

        /**
         * ストローク記録開始（ローカル座標版）
         * BrushCore から直接Local座標を受け取る
         * @param {number} localX - ローカル座標X
         * @param {number} localY - ローカル座標Y
         * @param {number} rawPressure - 生筆圧値
         */
        startStroke(localX, localY, rawPressure) {
            this.points = [];
            this.isRecording = true;
            
            // 圧力ハンドラー初期化
            if (this.pressureHandler && this.pressureHandler.startStroke) {
                this.pressureHandler.startStroke();
            }
            
            // 初回ポイント追加（ローカル座標で直接記録）
            this.addPoint(localX, localY, rawPressure);
        }

        /**
         * ポイント追加（ローカル座標版）
         * @param {number} localX - ローカル座標X
         * @param {number} localY - ローカル座標Y
         * @param {number} rawPressure - 生筆圧値
         */
        addPoint(localX, localY, rawPressure) {
            if (!this.isRecording) return;

            // 筆圧補正
            const pressure = this.pressureHandler && this.pressureHandler.getCalibratedPressure
                ? this.pressureHandler.getCalibratedPressure(rawPressure)
                : rawPressure;

            // tiltデータも取得（将来の高度な筆圧表現用）
            const tiltData = this.pressureHandler && this.pressureHandler.getTiltData
                ? this.pressureHandler.getTiltData()
                : { tiltX: 0, tiltY: 0, twist: 0 };

            // ローカル座標をそのまま記録（二重変換しない）
            this.points.push({
                x: localX,
                y: localY,
                pressure: pressure,
                time: performance.now(),
                tiltX: tiltData.tiltX || 0,
                tiltY: tiltData.tiltY || 0,
                twist: tiltData.twist || 0
            });
        }

        /**
         * PointerEventからポイント追加（レガシー互換・非推奨）
         * 新しいコードはBrushCore側で座標変換してaddPoint()を呼ぶこと
         * @param {PointerEvent} event - ポインターイベント
         * @param {number} rawPressure - 生筆圧値
         */
        addPointFromEvent(event, rawPressure) {
            if (!this.isRecording) return;

            // tilt/twistデータを更新
            if (this.pressureHandler && this.pressureHandler.updateTiltData) {
                this.pressureHandler.updateTiltData(event);
            }

            // 警告: screenToLayer()は古い実装。
            // BrushCore で座標変換してからaddPoint()を呼ぶこと
            if (this.cameraSystem && this.cameraSystem.screenToLayer) {
                const layerLocalPoint = this.cameraSystem.screenToLayer(event.clientX, event.clientY);
                this.addPoint(layerLocalPoint.x, layerLocalPoint.y, rawPressure);
            }
        }

        /**
         * ストローク記録終了
         * @returns {Object} strokeData - { points, isSingleDot }
         */
        endStroke() {
            this.isRecording = false;

            // 単独点判定（移動距離 < 2px, サンプル数 <= 2）
            const isSingleDot = this.points.length <= 2 && this.getTotalDistance() < 2;

            return {
                points: [...this.points],
                isSingleDot: isSingleDot
            };
        }

        /**
         * 現在記録中のポイント配列を取得（プレビュー用）
         */
        getCurrentPoints() {
            return [...this.points];
        }

        /**
         * ストローク総距離を計算
         * @returns {number} 総移動距離(px)
         */
        getTotalDistance() {
            if (this.points.length < 2) return 0;

            let totalDistance = 0;
            for (let i = 1; i < this.points.length; i++) {
                const dx = this.points[i].x - this.points[i - 1].x;
                const dy = this.points[i].y - this.points[i - 1].y;
                totalDistance += Math.sqrt(dx * dx + dy * dy);
            }
            return totalDistance;
        }

        /**
         * ポイント数を取得
         */
        getPointCount() {
            return this.points.length;
        }

        /**
         * 記録中かどうか
         */
        isActive() {
            return this.isRecording;
        }
    }

    // ★★★ Phase 2: グローバルクラス公開 ★★★
    window.StrokeRecorder = StrokeRecorder;

    console.log('✅ system/drawing/stroke-recorder.js (Phase 2対応版) loaded');
    console.log('   - window.StrokeRecorder (クラス)');

})();