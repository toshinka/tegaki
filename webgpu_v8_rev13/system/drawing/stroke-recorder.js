/**
 * stroke-recorder.js - Phase 0完成版（初期化問題修正）
 * Stroke Point Recording System
 * 
 * 📁 親依存:
 *   - drawing-engine.js (Local座標取得元)
 *   - pressure-handler.js (筆圧データ) [オプション]
 *   - config.js (BRUSH_SETTINGS)
 * 
 * 📄 子依存:
 *   - brush-core.js (startStroke/updateStroke/endStroke呼び出し)
 *   - gpu-stroke-processor.js [Phase 1実装予定]
 * 
 * 🔀 イベント:
 *   発火: なし
 *   購読: なし
 * 
 * 責務:
 *   - Local座標ポイントの記録（座標変換は一切行わない）
 *   - pressure/tilt/twist データ保持
 *   - PerfectFreehand互換形式提供
 *   - GPU EdgeBuffer形式提供準備 [Phase 1]
 *   - Winding計算準備 [Phase 3]
 * 
 * ⚠️ 厳守事項:
 *   - 座標変換禁止（drawing-engineで完結済み）
 *   - PerfectFreehand実行禁止（StrokeRendererへ委譲）
 *   - 二重インスタンス作成禁止（グローバル単一インスタンス）
 */

(function() {
    'use strict';

    // 二重読み込み防止
    if (window.strokeRecorder && window.strokeRecorder.initialized) {
        console.warn('[StrokeRecorder] Already loaded and initialized - skipping');
        return;
    }

    class StrokeRecorder {
        constructor(pressureHandler = null, cameraSystem = null) {
            // 依存注入（オプション）
            this.pressureHandler = pressureHandler || null;
            this.cameraSystem = cameraSystem || null;

            // ストロークデータ
            this.points = [];
            this.isRecording = false;
            this.strokeStartTime = 0;
            this.lastPointTime = 0;

            // メタデータ
            this.currentMode = 'pen'; // 'pen' | 'eraser'
            this.currentColor = null;
            this.currentSize = null;

            // Winding計算用（Phase 3実装予定）
            this.windingData = null;

            // 統計情報
            this.totalPoints = 0;
            this.totalStrokes = 0;

            // 自動初期化（コンストラクタで完了）
            this.initialized = true;
        }

        /**
         * 明示的初期化（後方互換性のため残す）
         * コンストラクタで自動初期化されているため、実質的に不要
         */
        initialize() {
            if (this.initialized) {
                // 既に初期化済みなので何もしない
                return;
            }

            // 依存関係の遅延解決
            if (!this.pressureHandler && window.pressureHandler) {
                this.pressureHandler = window.pressureHandler;
            }

            if (!this.cameraSystem && window.cameraSystem) {
                this.cameraSystem = window.cameraSystem;
            }

            this.initialized = true;
        }

        /**
         * ストローク記録開始
         * @param {number} localX - Local座標X（drawing-engineで変換済み）
         * @param {number} localY - Local座標Y（drawing-engineで変換済み）
         * @param {number} pressure - 筆圧 (0.0-1.0)
         * @param {Object} options - オプション設定
         */
        startStroke(localX, localY, pressure = 0.5, options = {}) {
            // 初期化チェック不要（コンストラクタで自動初期化）
            
            // リセット
            this.points = [];
            this.isRecording = true;
            this.strokeStartTime = performance.now();
            this.lastPointTime = this.strokeStartTime;
            this.windingData = null;

            // メタデータ保存
            this.currentMode = options.mode || 'pen';
            this.currentColor = options.color || null;
            this.currentSize = options.size || null;

            // 初期ポイント追加
            this.addPoint(localX, localY, pressure, 0, 0);

            this.totalStrokes++;
        }

        /**
         * ポイント追加
         * ⚠️ 座標変換厳禁 - drawing-engineから変換済み座標を受け取る
         * 
         * @param {number} localX - Local座標X
         * @param {number} localY - Local座標Y
         * @param {number} pressure - 筆圧 (0.0-1.0)
         * @param {number} tiltX - ペン傾きX（度）
         * @param {number} tiltY - ペン傾きY（度）
         */
        addPoint(localX, localY, pressure = 0.5, tiltX = 0, tiltY = 0) {
            if (!this.isRecording) {
                return;
            }

            const now = performance.now();
            const timeDelta = now - this.lastPointTime;

            // PerfectFreehand互換 + 拡張データ
            const point = {
                // PerfectFreehand互換
                x: localX,
                y: localY,
                pressure: Math.max(0.01, Math.min(1.0, pressure)),

                // 拡張データ
                tiltX: tiltX,
                tiltY: tiltY,
                timestamp: now,
                timeDelta: timeDelta,

                // Phase 3用予約
                edgeId: this.points.length,
                channelId: this.points.length % 3 // R:0, G:1, B:2
            };

            this.points.push(point);
            this.lastPointTime = now;
            this.totalPoints++;
        }

        /**
         * ストローク記録終了
         * @returns {Object} ストロークデータ
         */
        endStroke() {
            if (!this.isRecording) {
                return null;
            }

            this.isRecording = false;

            // Phase 3実装予定: Winding計算
            // this.windingData = this.calculateWinding();

            const strokeData = {
                // 基本データ
                points: this.points,
                windingData: this.windingData,

                // メタデータ
                mode: this.currentMode,
                color: this.currentColor,
                size: this.currentSize,

                // 統計
                duration: performance.now() - this.strokeStartTime,
                pointCount: this.points.length,
                avgTimeDelta: this._calculateAvgTimeDelta()
            };

            return strokeData;
        }

        /**
         * 平均時間デルタ計算
         * @private
         */
        _calculateAvgTimeDelta() {
            if (this.points.length <= 1) return 0;

            const totalDelta = this.points.reduce((sum, p) => sum + (p.timeDelta || 0), 0);
            return totalDelta / (this.points.length - 1);
        }

        /**
         * PerfectFreehand互換配列取得
         * @returns {Array<Array<number>>} [[x,y,pressure], ...]
         */
        getPointsForPerfectFreehand() {
            return this.points.map(p => [p.x, p.y, p.pressure]);
        }

        /**
         * GPU用エッジバッファ形式取得（Phase 1実装予定）
         * @returns {Object} GPU転送用データ
         */
        getPointsForGPU() {
            // Phase 1実装: gpu-stroke-processor.createEdgeBuffer() へ渡す
            // 現在は基本データのみ返す
            return {
                points: this.points,
                mode: this.currentMode,
                windingData: this.windingData
            };
        }

        /**
         * 生ポイントデータ取得
         * @returns {Array<Object>} points配列
         */
        getRawPoints() {
            return this.points;
        }

        /**
         * Winding Number計算（Phase 3実装予定）
         * 符号判定用: エッジ内外を判定
         * 
         * アルゴリズム:
         *   - 閉ループストロークに対してWinding Number法を適用
         *   - 各エッジに対して insideFlag (-1 or +1) を計算
         *   - GPU Compute Shaderで参照可能な形式で返す
         * 
         * @returns {Object|null} {insideFlags: Float32Array}
         */
        calculateWinding() {
            // Phase 3実装予定

            // 暫定実装: 全エッジをinside扱い
            if (this.points.length < 3) {
                return null;
            }

            const edgeCount = this.points.length - 1;
            const insideFlags = new Float32Array(edgeCount);
            insideFlags.fill(1.0); // 全て内側

            return {
                insideFlags: insideFlags,
                edgeCount: edgeCount,
                isClosed: false // 閉ループ判定も将来実装
            };
        }

        /**
         * 現在のストローク情報取得
         */
        getStrokeInfo() {
            return {
                isRecording: this.isRecording,
                pointCount: this.points.length,
                duration: this.isRecording
                    ? (performance.now() - this.strokeStartTime)
                    : 0,
                mode: this.currentMode,
                totalStrokes: this.totalStrokes,
                totalPoints: this.totalPoints
            };
        }

        /**
         * 統計情報取得
         */
        getStats() {
            return {
                totalStrokes: this.totalStrokes,
                totalPoints: this.totalPoints,
                avgPointsPerStroke: this.totalStrokes > 0
                    ? Math.floor(this.totalPoints / this.totalStrokes)
                    : 0
            };
        }

        /**
         * リセット
         */
        reset() {
            this.points = [];
            this.isRecording = false;
            this.windingData = null;
            this.currentMode = 'pen';
            this.currentColor = null;
            this.currentSize = null;
        }

        /**
         * 完全リセット（統計も含む）
         */
        fullReset() {
            this.reset();
            this.totalPoints = 0;
            this.totalStrokes = 0;
        }

        /**
         * 破棄
         */
        destroy() {
            this.fullReset();
            this.initialized = false;
            this.pressureHandler = null;
            this.cameraSystem = null;
        }
    }

    // グローバル登録（クラス定義）
    window.StrokeRecorder = StrokeRecorder;

    // グローバルインスタンス作成（自動初期化）
    // ⚠️ core-engine.js で再作成されないよう事前作成
    if (!window.strokeRecorder) {
        window.strokeRecorder = new StrokeRecorder();
        // コンストラクタで自動初期化されているため initialize() 不要
    }

    console.log('✅ stroke-recorder.js Phase 0 loaded');
    console.log('   ✓ 自動初期化完了（initialize()不要）');
    console.log('   ✓ Local座標記録専用（座標変換なし）');
    console.log('   ✓ PerfectFreehand互換形式対応');

})();