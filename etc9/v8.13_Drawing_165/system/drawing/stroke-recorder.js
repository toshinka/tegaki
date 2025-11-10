/**
 * StrokeRecorder - ストロークポイント記録専用クラス（警告ログ削減版）
 * 
 * 🔧 修正内容:
 * - addPoint/endStroke の警告ログを削除（大量ログ防止）
 * - エラー発生時のみログ出力
 */

(function() {
    'use strict';

    class StrokeRecorder {
        constructor(pressureHandler = null, cameraSystem = null) {
            this.pressureHandler = pressureHandler;
            this.cameraSystem = cameraSystem;
            
            this.currentPoints = [];
            this.isRecording = false;
            this.startTime = 0;
        }
        
        startStroke(localX, localY, rawPressure) {
            this.currentPoints = [];
            this.isRecording = true;
            this.startTime = Date.now();
            
            this.addPoint(localX, localY, rawPressure);
        }
        
        addPoint(localX, localY, rawPressure) {
            // 🔧 修正: 記録中でない場合は静かに戻る
            if (!this.isRecording) {
                return;
            }
            
            let processedPressure = rawPressure;
            if (this.pressureHandler && this.pressureHandler.processPressure) {
                processedPressure = this.pressureHandler.processPressure(rawPressure);
            }
            
            const point = {
                x: localX,
                y: localY,
                pressure: processedPressure,
                time: Date.now() - this.startTime
            };
            
            this.currentPoints.push(point);
        }
        
        endStroke() {
            // 🔧 修正: 記録中でない場合は空データを返す
            if (!this.isRecording) {
                return { points: [], isSingleDot: false };
            }
            
            const strokeData = {
                points: [...this.currentPoints],
                isSingleDot: this.currentPoints.length === 1,
                duration: Date.now() - this.startTime
            };
            
            this.currentPoints = [];
            this.isRecording = false;
            this.startTime = 0;
            
            return strokeData;
        }
        
        getCurrentPoints() {
            return [...this.currentPoints];
        }
        
        isActive() {
            return this.isRecording;
        }
        
        cancel() {
            this.currentPoints = [];
            this.isRecording = false;
            this.startTime = 0;
        }
    }

    window.StrokeRecorder = StrokeRecorder;

    console.log('✅ stroke-recorder.js (警告ログ削減版) loaded');
    console.log('   ✓ 不要な警告ログを削除');
    console.log('   ✓ DRY原則準拠');

})();