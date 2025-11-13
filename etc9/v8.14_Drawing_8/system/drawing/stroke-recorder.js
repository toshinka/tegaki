/**
 * ================================================================================
 * system/drawing/stroke-recorder.js - Phase 1完全版: 自動初期化
 * ================================================================================
 * 
 * 【Phase 1 改修内容】
 * ✅ PolygonGenerator自動接続（初期化不要）
 * ✅ endStroke()でポリゴン生成
 * ✅ 後方互換性維持（points形式保持）
 * 
 * 【依存Parents】
 * - polygon-generator.js (ポリゴン生成)
 * - pressure-handler.js (筆圧処理) ※オプション
 * 
 * 【依存Children】
 * - brush-core.js (startStroke/addPoint/endStroke呼出)
 * - stroke-renderer.js (strokeData受取)
 * 
 * 【責務】
 * - Local座標ポイント記録（座標変換なし）
 * - 筆圧処理統合
 * - ポリゴン生成要求
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
            
            // 自動初期化
            this._autoInitialize();
        }
        
        /**
         * 自動初期化（PolygonGenerator取得）
         * @private
         */
        _autoInitialize() {
            // PolygonGenerator待機（遅延読み込み対応）
            if (window.PolygonGenerator) {
                this._connectPolygonGenerator();
            } else {
                // DOMContentLoaded後に再試行
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', () => {
                        this._connectPolygonGenerator();
                    });
                } else {
                    // 既にロード済み、次のティックで再試行
                    setTimeout(() => this._connectPolygonGenerator(), 0);
                }
            }
        }
        
        /**
         * PolygonGenerator接続
         * @private
         */
        _connectPolygonGenerator() {
            if (this.polygonGenerator) {
                return; // 既に接続済み
            }
            
            if (!window.PolygonGenerator) {
                console.warn('[StrokeRecorder] PolygonGenerator not found - polygon generation disabled');
                return;
            }
            
            this.polygonGenerator = window.PolygonGenerator;
            
            if (this.polygonGenerator && typeof this.polygonGenerator.initialize === 'function') {
                this.polygonGenerator.initialize();
            }
            
            console.log('✅ [StrokeRecorder] PolygonGenerator connected');
        }
        
        /**
         * 手動初期化（後方互換用）
         */
        initialize() {
            this._connectPolygonGenerator();
        }
        
        /**
         * ストローク開始
         * @param {number} localX - Local座標X
         * @param {number} localY - Local座標Y
         * @param {number} rawPressure - 生筆圧値
         */
        startStroke(localX, localY, rawPressure) {
            // 初回呼び出し時にPolygonGenerator再確認
            if (!this.polygonGenerator) {
                this._connectPolygonGenerator();
            }
            
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
            
            // ポリゴン生成
            let polygon = [];
            if (this.polygonGenerator) {
                try {
                    polygon = this._generatePolygon();
                    
                    if (!polygon || polygon.length === 0) {
                        console.warn('[StrokeRecorder] Polygon generation returned empty array');
                    }
                } catch (error) {
                    console.error('[StrokeRecorder] Polygon generation failed:', error);
                    polygon = [];
                }
            } else {
                console.warn('[StrokeRecorder] PolygonGenerator not available');
            }
            
            const strokeData = {
                points: [...this.currentPoints],
                polygon: polygon,
                isSingleDot: isSingleDot,
                duration: Date.now() - this.startTime
            };
            
            console.log('[StrokeRecorder] endStroke', {
                pointsCount: strokeData.points.length,
                polygonLength: polygon.length,
                isSingleDot: isSingleDot
            });
            
            this.currentPoints = [];
            this.isRecording = false;
            this.startTime = 0;
            
            return strokeData;
        }
        
        /**
         * ポリゴン生成
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
            
            return polygon || [];
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

    // グローバルインスタンス作成（自動初期化）
    window.strokeRecorder = new StrokeRecorder(
        window.pressureHandler || null,
        window.cameraSystem || null
    );
    
    window.StrokeRecorder = StrokeRecorder;

    console.log('✅ stroke-recorder.js (Phase 1完全版) loaded');
    console.log('   ✅ PolygonGenerator自動接続');
    console.log('   ✅ 初期化不要');
    console.log('   ✅ デバッグログ強化');

})();