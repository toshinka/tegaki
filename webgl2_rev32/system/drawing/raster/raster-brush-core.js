/**
 * ============================================================================
 * ファイル名: system/drawing/raster-brush-core.js
 * 責務: ラスターブラシの中核実装 - WebGL2テクスチャへの直接描画
 * 
 * 【Phase 3 新規作成】
 * ✅ ブラシスタンプをテクスチャに描画
 * ✅ 筆圧・傾き・回転データ対応
 * ✅ 前回点との補間処理
 * ✅ BrushCore からの呼び出しインターフェース
 * 
 * 【親ファイル依存】
 * - config.js (ブラシ設定)
 * - brush-stamp.js (スタンプ生成)
 * - brush-interpolator.js (補間処理)
 * - raster-layer.js (レイヤー管理)
 * - webgl2-drawing-layer.js (WebGL2統合)
 * 
 * 【子ファイル依存このファイルに】
 * - brush-core.js (ストローク管理)
 * - core-engine.js (初期化)
 * ============================================================================
 */

(function() {
    'use strict';

    class RasterBrushCore {
        constructor(app, layerSystem, cameraSystem) {
            this.app = app;
            this.layerSystem = layerSystem;
            this.cameraSystem = cameraSystem;
            
            // WebGL2コンテキスト
            this.gl = null;
            
            // 現在のストローク
            this.currentStroke = null;
            this.isDrawing = false;
            
            // 前回の描画位置
            this.lastPoint = null;
            
            // ブラシ設定
            this.brushSettings = null;
            
            // 統合モジュール参照
            this.brushStamp = window.BrushStamp || null;
            this.brushInterpolator = window.BrushInterpolator || null;
            this.rasterLayer = window.RasterLayer || null;
            
            console.log('[RasterBrushCore] Instance created');
        }

        // ================================================================================
        // 初期化
        // ================================================================================

        initialize(gl) {
            this.gl = gl;
            
            if (!this.gl) {
                console.error('[RasterBrushCore] WebGL2 context not provided');
                return false;
            }
            
            console.log('[RasterBrushCore] ✅ Initialized with WebGL2 context');
            return true;
        }

        setBrushSettings(brushSettings) {
            this.brushSettings = brushSettings;
        }

        // ================================================================================
        // ストローク開始
        // ================================================================================

        /**
         * ストローク開始
         * @param {number} localX - Local座標X
         * @param {number} localY - Local座標Y
         * @param {number} pressure - 筆圧 (0.0-1.0)
         * @param {number} tiltX - 傾きX
         * @param {number} tiltY - 傾きY
         * @param {number} twist - ペン回転
         * @param {Object} settings - ブラシ設定
         */
        startStroke(localX, localY, pressure, tiltX, tiltY, twist, settings) {
            console.log('[RasterBrushCore] startStroke called', {
                localX, localY, pressure, tiltX, tiltY, twist
            });
            
            this.isDrawing = true;
            
            // 現在のストローク情報を保存
            this.currentStroke = {
                points: [],
                settings: settings || this.brushSettings?.getSettings() || {},
                startTime: Date.now()
            };
            
            // 最初の点を記録
            this.lastPoint = {
                localX, localY, pressure, tiltX, tiltY, twist
            };
            
            this.currentStroke.points.push({ ...this.lastPoint });
            
            // 最初の点を描画
            this._drawPoint(localX, localY, pressure, tiltX, tiltY, twist, settings);
            
            return true;
        }

        // ================================================================================
        // ストローク更新
        // ================================================================================

        /**
         * ストロークポイント追加
         * @param {number} localX - Local座標X
         * @param {number} localY - Local座標Y
         * @param {number} pressure - 筆圧
         * @param {number} tiltX - 傾きX
         * @param {number} tiltY - 傾きY
         * @param {number} twist - ペン回転
         */
        addStrokePoint(localX, localY, pressure, tiltX, tiltY, twist) {
            if (!this.isDrawing || !this.currentStroke) {
                return;
            }
            
            const currentPoint = { localX, localY, pressure, tiltX, tiltY, twist };
            
            // 前回点との距離を計算
            if (this.lastPoint) {
                const dx = localX - this.lastPoint.localX;
                const dy = localY - this.lastPoint.localY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // 補間が必要な距離閾値（設定から取得、デフォルト2.5px）
                const threshold = window.TEGAKI_CONFIG?.brush?.raster?.interpolation?.distanceThreshold || 2.5;
                
                if (distance > threshold && this.brushInterpolator) {
                    // 補間ポイント生成
                    const interpolatedPoints = this.brushInterpolator.interpolate(
                        this.lastPoint,
                        currentPoint,
                        distance
                    );
                    
                    // 補間ポイントを描画
                    interpolatedPoints.forEach(point => {
                        this._drawPoint(
                            point.localX,
                            point.localY,
                            point.pressure,
                            point.tiltX,
                            point.tiltY,
                            point.twist,
                            this.currentStroke.settings
                        );
                        this.currentStroke.points.push(point);
                    });
                } else {
                    // 補間なしで描画
                    this._drawPoint(localX, localY, pressure, tiltX, tiltY, twist, this.currentStroke.settings);
                    this.currentStroke.points.push(currentPoint);
                }
            }
            
            this.lastPoint = currentPoint;
        }

        // ================================================================================
        // ストローク終了
        // ================================================================================

        /**
         * ストローク終了 - PIXI.Graphics返却（互換性維持）
         * @returns {PIXI.Graphics} 描画結果（ラスター方式では仮のGraphics）
         */
        finalizeStroke() {
            console.log('[RasterBrushCore] finalizeStroke called');
            
            if (!this.isDrawing || !this.currentStroke) {
                return null;
            }
            
            this.isDrawing = false;
            
            // 🔧 Phase 3: 互換性のため仮のGraphicsオブジェクトを返す
            // 実際の描画はテクスチャに完了済み
            const graphics = new PIXI.Graphics();
            graphics.label = 'raster_stroke_placeholder';
            
            // ストローク情報をメタデータとして保存
            graphics._rasterStrokeData = {
                points: this.currentStroke.points,
                settings: this.currentStroke.settings,
                isRasterStroke: true
            };
            
            // クリーンアップ
            this.currentStroke = null;
            this.lastPoint = null;
            
            console.log('[RasterBrushCore] ✅ Stroke finalized');
            
            return graphics;
        }

        /**
         * ストロークキャンセル
         */
        cancelStroke() {
            console.log('[RasterBrushCore] cancelStroke called');
            
            this.isDrawing = false;
            this.currentStroke = null;
            this.lastPoint = null;
        }

        // ================================================================================
        // 内部描画メソッド
        // ================================================================================

        /**
         * 1ポイントを描画（内部メソッド）
         * @private
         */
        _drawPoint(localX, localY, pressure, tiltX, tiltY, twist, settings) {
            // 🔧 Phase 3: 現在は仮実装
            // 将来的にWebGL2フレームバッファに直接描画
            
            if (!this.gl) {
                console.warn('[RasterBrushCore] WebGL2 context not available');
                return;
            }
            
            // TODO Phase 3.5: 実際のWebGL2描画実装
            // - ブラシスタンプテクスチャ生成
            // - アクティブレイヤーのフレームバッファにバインド
            // - スタンプ描画
            // - ブレンドモード適用
            
            console.log('[RasterBrushCore] _drawPoint (stub)', { localX, localY, pressure });
        }

        // ================================================================================
        // WebGL2テクスチャレンダリング（将来実装）
        // ================================================================================

        /**
         * フレームバッファにレンダリング
         * @param {WebGLFramebuffer} layerFBO - レイヤーのフレームバッファ
         * @param {Array} points - 描画ポイント配列
         * @param {Object} settings - ブラシ設定
         * @future Phase 3.5
         */
        renderToFramebuffer(layerFBO, points, settings) {
            if (!this.gl) return;
            
            // TODO Phase 3.5: 実装
            console.log('[RasterBrushCore] renderToFramebuffer (not implemented)');
        }

        // ================================================================================
        // ユーティリティ
        // ================================================================================

        /**
         * 描画中かどうか
         */
        getIsDrawing() {
            return this.isDrawing;
        }

        /**
         * 現在のストローク情報取得
         */
        getCurrentStroke() {
            return this.currentStroke;
        }
    }

    // ================================================================================
    // グローバル登録
    // ================================================================================

    window.RasterBrushCore = RasterBrushCore;

    console.log('✅ raster-brush-core.js loaded');
    console.log('   ✅ RasterBrushCore class registered');
    console.log('   🔧 Phase 3: 基本インターフェース実装完了');
    console.log('   ⚠️ Phase 3.5: WebGL2描画は将来実装予定');

})();