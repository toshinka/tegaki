/**
 * ================================================================================
 * system/drawing/stroke-recorder.js - Phase 1: PerfectFreehand統合版
 * ================================================================================
 * 
 * 【Phase 1 改修内容】
 * ✅ PolygonGenerator統合
 * ✅ endStroke()でポリゴン生成
 * ✅ 後方互換性維持（points形式保持）
 * 
 * 【依存関係 - Parents】
 *   - polygon-generator.js (ポリゴン生成)
 *   - pressure-handler.js (筆圧処理) ※オプション
 * 
 * 【依存関係 - Children】
 *   - brush-core.js (startStroke/addPoint/endStroke呼出)
 *   - stroke-renderer.js (strokeData受取)
 * 
 * 【責務】
 *   - Local座標ポイント記録（座標変換なし）
 *   - 筆圧処理統合
 *   - ポリゴン生成要求
 * ================================================================================
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
            
            this.polygonGenerator = null;
        }
        
        /**
         * 初期化（PolygonGenerator取得）
         */
        initialize() {
            if (!window.PolygonGenerator) {
                console.warn('[StrokeRecorder] PolygonGenerator not found - polygon generation disabled');
                return;
            }
            
            this.polygonGenerator = window.PolygonGenerator;
            
            if (this.polygonGenerator && typeof this.polygonGenerator.initialize === 'function') {
                this.polygonGenerator.initialize();
            }
            
            console.log('✅ [StrokeRecorder] Initialized with PolygonGenerator');
        }
        
        /**
         * ストローク開始
         * @param {number} localX - Local座標X
         * @param {number} localY - Local座標Y
         * @param {number} rawPressure - 生筆圧値
         */
        startStroke(localX, localY, rawPressure) {
            this.currentPoints = [];
            this.isRecording = true;
            this.startTime = Date.now();
            
            this.addPoint(localX, localY, rawPressure);
        }
        
        /**
         * ポイント追加
         * @param {number} localX - Local座標X
         * @param {number} localY - Local座標Y
         * @param {number} rawPressure - 生筆圧値
         */
        addPoint(localX, localY, rawPressure) {
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
        
        /**
         * ストローク終了（Phase 1: ポリゴン生成追加）
         * @returns {Object} strokeData - {points, polygon, isSingleDot, duration}
         */
        endStroke() {
            if (!this.isRecording) {
                return { 
                    points: [], 
                    polygon: [],
                    isSingleDot: false,
                    duration: 0
                };
            }
            
            const isSingleDot = this.currentPoints.length === 1;
            
            // ✅ Phase 1: ポリゴン生成
            let polygon = [];
            if (this.polygonGenerator) {
                try {
                    polygon = this._generatePolygon();
                } catch (error) {
                    console.warn('[StrokeRecorder] Polygon generation failed:', error);
                    polygon = [];
                }
            }
            
            const strokeData = {
                points: [...this.currentPoints],
                polygon: polygon,
                isSingleDot: isSingleDot,
                duration: Date.now() - this.startTime
            };
            
            this.currentPoints = [];
            this.isRecording = false;
            this.startTime = 0;
            
            return strokeData;
        }
        
        /**
         * ✅ Phase 1 新規: ポリゴン生成
         * @private
         */
        _generatePolygon() {
            if (!this.polygonGenerator) {
                return [];
            }
            
            if (this.currentPoints.length === 0) {
                return [];
            }
            
            // PolygonGenerator.generate() に委譲
            const polygon = this.polygonGenerator.generate(this.currentPoints);
            
            return polygon;
        }
        
        /**
         * 現在のポイント取得（プレビュー用）
         */
        getCurrentPoints() {
            return [...this.currentPoints];
        }
        
        /**
         * 記録中か判定
         */
        isActive() {
            return this.isRecording;
        }
        
        /**
         * ストロークキャンセル
         */
        cancel() {
            this.currentPoints = [];
            this.isRecording = false;
            this.startTime = 0;
        }
    }

    window.StrokeRecorder = StrokeRecorder;

    console.log('✅ stroke-recorder.js (Phase 1) loaded');
    console.log('   ✓ PerfectFreehand統合');
    console.log('   ✓ ポリゴン生成対応');
    console.log('   ✓ 後方互換性維持');

})();