/**
 * StrokeRecorder - ストローク座標記録（統合座標版）
 * 
 * 責務: ポインターイベントから座標・筆圧・時刻を記録
 *       + tiltX/Y, twistデータの取得と記録
 * 
 * 改修: レイヤー変形中でも正確なレイヤーローカル座標を取得
 *      CoordinateUnificationと連携し、常に正確な座標を記録
 * 
 * 座標系: レイヤーローカル座標
 * 取得API: CameraSystem.screenToLayer() → CoordinateUnification.screenToLayerLocal()
 */

class StrokeRecorder {
    constructor(pressureHandler, cameraSystem) {
        this.pressureHandler = pressureHandler;
        this.cameraSystem = cameraSystem;
        this.coordinateUnification = null; // CoordinateUnification（オプション統合）
        
        this.points = [];
        this.isRecording = false;
        this.activeLayer = null;
    }

    /**
     * CoordinateUnificationを設定（オプション）
     * 設定されている場合、より正確な座標変換を使用
     */
    setCoordinateUnification(coordUnification) {
        this.coordinateUnification = coordUnification;
    }

    /**
     * ストローク記録開始（PointerEvent対応）
     * @param {PointerEvent} event - ポインターイベント
     * @param {Object} activeLayer - アクティブレイヤー（座標変換用）
     */
    startStrokeFromEvent(event, activeLayer = null) {
        this.points = [];
        this.isRecording = true;
        this.activeLayer = activeLayer;
        
        // tilt/twistデータを更新
        this.pressureHandler.updateTiltData(event);
        
        // 圧力ハンドラー初期化
        this.pressureHandler.startStroke();
        
        // 初回ポイント追加
        const pressure = event.pressure || 0.5;
        this.addPointFromEvent(event, pressure, activeLayer);
    }

    /**
     * ストローク記録開始（レガシー互換）
     * @param {number} screenX - スクリーン座標X
     * @param {number} screenY - スクリーン座標Y
     * @param {number} rawPressure - 生筆圧値
     * @param {Object} activeLayer - アクティブレイヤー（座標変換用）
     */
    startStroke(screenX, screenY, rawPressure, activeLayer = null) {
        this.points = [];
        this.isRecording = true;
        this.activeLayer = activeLayer;
        
        // 圧力ハンドラー初期化
        this.pressureHandler.startStroke();
        
        // 初回ポイント追加
        this.addPoint(screenX, screenY, rawPressure, activeLayer);
    }

    /**
     * PointerEventからポイント追加
     * @param {PointerEvent} event - ポインターイベント
     * @param {number} rawPressure - 生筆圧値
     * @param {Object} activeLayer - アクティブレイヤー（座標変換用）
     */
    addPointFromEvent(event, rawPressure, activeLayer = null) {
        if (!this.isRecording) return;

        // tilt/twistデータを更新
        this.pressureHandler.updateTiltData(event);

        // スクリーン座標 → レイヤーローカル座標
        const layerLocalPoint = this._getLayerLocalCoordinate(
            event.clientX,
            event.clientY,
            activeLayer
        );
        
        // 筆圧補正
        const pressure = this.pressureHandler.getCalibratedPressure(rawPressure);

        // tiltデータも記録（将来の高度な筆圧表現用）
        const tiltData = this.pressureHandler.getTiltData();

        this.points.push({
            x: layerLocalPoint.x,
            y: layerLocalPoint.y,
            pressure: pressure,
            time: performance.now(),
            tiltX: tiltData.tiltX,
            tiltY: tiltData.tiltY,
            twist: tiltData.twist
        });
    }

    /**
     * ポイント追加（レガシー互換）
     * @param {number} screenX - スクリーン座標X
     * @param {number} screenY - スクリーン座標Y
     * @param {number} rawPressure - 生筆圧値
     * @param {Object} activeLayer - アクティブレイヤー（座標変換用）
     */
    addPoint(screenX, screenY, rawPressure, activeLayer = null) {
        if (!this.isRecording) return;

        // スクリーン座標 → レイヤーローカル座標
        const layerLocalPoint = this._getLayerLocalCoordinate(
            screenX,
            screenY,
            activeLayer
        );
        
        // 筆圧補正
        const pressure = this.pressureHandler.getCalibratedPressure(rawPressure);

        this.points.push({
            x: layerLocalPoint.x,
            y: layerLocalPoint.y,
            pressure: pressure,
            time: performance.now(),
            tiltX: 0,
            tiltY: 0,
            twist: 0
        });
    }

    /**
     * ストローク記録終了
     * @returns {Object} strokeData - { points, isSingleDot }
     */
    endStroke() {
        this.isRecording = false;
        this.activeLayer = null;

        // 単独点判定（移動距離 < 2px, サンプル数 <= 2）
        const isSingleDot = this.points.length <= 2 && this._getTotalDistance() < 2;

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
        return this._getTotalDistance();
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

    // ===== 内部処理 =====

    /**
     * スクリーン座標をレイヤーローカル座標に変換
     * CoordinateUnificationがあれば優先使用（より正確）
     * なければCameraSystemを直接使用
     */
    _getLayerLocalCoordinate(screenX, screenY, activeLayer) {
        // CoordinateUnificationがあれば優先
        if (this.coordinateUnification && activeLayer) {
            return this.coordinateUnification.screenToLayerLocal(
                screenX,
                screenY,
                activeLayer
            );
        }

        // CameraSystemから直接取得
        if (this.cameraSystem?.screenToLayer) {
            return this.cameraSystem.screenToLayer(screenX, screenY);
        }

        // フォールバック
        return { x: screenX, y: screenY };
    }

    /**
     * ストローク総距離を計算
     * @private
     */
    _getTotalDistance() {
        if (this.points.length < 2) return 0;

        let totalDistance = 0;
        for (let i = 1; i < this.points.length; i++) {
            const dx = this.points[i].x - this.points[i - 1].x;
            const dy = this.points[i].y - this.points[i - 1].y;
            totalDistance += Math.sqrt(dx * dx + dy * dy);
        }
        return totalDistance;
    }
}