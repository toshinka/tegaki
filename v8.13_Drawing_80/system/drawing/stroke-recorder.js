/**
 * StrokeRecorder - ストロークポイント記録専用クラス
 * 
 * 責務:
 * - Local座標のポイントを記録
 * - 座標変換は行わない（二重変換防止）
 * - 筆圧補正は受け取った値をそのまま記録
 * 
 * 依存:
 * - window.pressureHandler（オプション）
 * - cameraSystem（コンストラクタ引数）
 * 
 * 禁止:
 * - 座標変換の実装（coordinate-system.jsに分離済み）
 * - 描画処理（stroke-renderer.jsに分離済み）
 */

(function() {
    'use strict';

    class StrokeRecorder {
        constructor(pressureHandler = null, cameraSystem = null) {
            this.pressureHandler = pressureHandler;
            this.cameraSystem = cameraSystem;
            
            // 現在のストローク記録
            this.currentPoints = [];
            this.isRecording = false;
            this.startTime = 0;
        }
        
        /**
         * ストローク記録開始
         * @param {number} localX - Local座標X
         * @param {number} localY - Local座標Y
         * @param {number} rawPressure - 生筆圧値 (0.0-1.0)
         */
        startStroke(localX, localY, rawPressure) {
            this.currentPoints = [];
            this.isRecording = true;
            this.startTime = Date.now();
            
            // 初回ポイント追加
            this.addPoint(localX, localY, rawPressure);
        }
        
        /**
         * ポイント追加
         * @param {number} localX - Local座標X
         * @param {number} localY - Local座標Y
         * @param {number} rawPressure - 生筆圧値 (0.0-1.0)
         */
        addPoint(localX, localY, rawPressure) {
            if (!this.isRecording) {
                console.warn('[StrokeRecorder] addPoint called but not recording');
                return;
            }
            
            // 筆圧補正（pressureHandlerが利用可能な場合）
            let processedPressure = rawPressure;
            if (this.pressureHandler && this.pressureHandler.processPressure) {
                processedPressure = this.pressureHandler.processPressure(rawPressure);
            }
            
            // ポイント記録
            const point = {
                x: localX,
                y: localY,
                pressure: processedPressure,
                time: Date.now() - this.startTime
            };
            
            this.currentPoints.push(point);
        }
        
        /**
         * ストローク記録終了
         * @returns {Object} { points: Array, isSingleDot: boolean }
         */
        endStroke() {
            if (!this.isRecording) {
                console.warn('[StrokeRecorder] endStroke called but not recording');
                return { points: [], isSingleDot: false };
            }
            
            const strokeData = {
                points: [...this.currentPoints],
                isSingleDot: this.currentPoints.length === 1,
                duration: Date.now() - this.startTime
            };
            
            // リセット
            this.currentPoints = [];
            this.isRecording = false;
            this.startTime = 0;
            
            return strokeData;
        }
        
        /**
         * 現在のポイント取得（プレビュー用）
         * @returns {Array} ポイント配列のコピー
         */
        getCurrentPoints() {
            return [...this.currentPoints];
        }
        
        /**
         * 記録中かどうか
         * @returns {boolean}
         */
        isActive() {
            return this.isRecording;
        }
        
        /**
         * 記録キャンセル
         */
        cancel() {
            this.currentPoints = [];
            this.isRecording = false;
            this.startTime = 0;
        }
    }

    // グローバルにクラスを登録
    window.StrokeRecorder = StrokeRecorder;

    console.log('✅ stroke-recorder.js loaded');
    console.log('   ✓ Local座標専用記録');
    console.log('   ✓ 座標変換なし（二重変換防止）');
    console.log('   ✓ DRY原則準拠');

})();