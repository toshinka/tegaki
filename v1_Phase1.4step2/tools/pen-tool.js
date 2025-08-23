/**
 * PenTool - ペン描画ツール
 * 
 * 責務:
 * - ペン固有の描画処理
 * - 圧力感知対応
 * - CanvasManagerとの連携による実際の描画
 * 
 * 依存: AbstractTool, CanvasManager
 * 公開: window.PenTool
 */

class PenTool extends window.AbstractTool {
    constructor() {
        // デフォルト設定でAbstractToolを初期化
        super('pen', {
            size: 3,
            color: '#000000',
            opacity: 1.0,
            pressureSensitive: true,
            smoothing: 0.5,
            minSize: 1,
            maxSize: 50
        });

        // ペン固有の設定
        this.penOptions = {
            pressureMultiplier: 2.0,
            velocitySmoothing: true,
            tapering: true,
            taperStart: 0.8,
            taperEnd: 0.6
        };

        // 描画バッファ
        this.drawingBuffer = [];
        this.bufferSize = 3; // バッファリング用のポイント数

        // CanvasManager参照
        this.canvasManager = window.CanvasManager;
    }

    /**
     * ストローク開始時の処理
     * @protected
     */
    _onStrokeStart(point) {
        try {
            // バッファをクリア
            this.drawingBuffer = [];
            
            // 開始点のスタイルを計算
            const startStyle = this._calculatePointStyle(point, true);
            
            // CanvasManagerで点を描画
            if (this.canvasManager) {
                this.canvasManager.drawPoint(point, startStyle);
            }

            console.log(`[PenTool] Stroke started at (${point.x.toFixed(2)}, ${point.y.toFixed(2)})`);
        } catch (error) {
            window.ErrorManager?.handleError(error, 'PenTool._onStrokeStart');
        }
    }

    /**
     * 点追加時の処理
     * @protected
     */
    _onPointAdd(point) {
        try {
            // バッファに追加
            this.drawingBuffer.push(point);

            // バッファが溜まったら描画
            if (this.drawingBuffer.length >= this.bufferSize) {
                this._flushBuffer();
            }
        } catch (error) {
            window.ErrorManager?.handleError(error, 'PenTool._onPointAdd');
        }
    }

    /**
     * ストローク終了時の処理
     * @protected
     */
    _onStrokeEnd(point) {
        try {
            // 残りのバッファを描画
            this._flushBuffer(true);

            // テーパリング処理（末尾）
            if (this.penOptions.tapering && this.currentStroke.points.length > 2) {
                this._applyEndTapering();
            }

            console.log(`[PenTool] Stroke ended with ${this.currentStroke.points.length} points`);
        } catch (error) {
            window.ErrorManager?.handleError(error, 'PenTool._onStrokeEnd');
        }
    }

    /**
     * ツール有効化時の処理
     * @protected
     */
    _onActivate() {
        // ペンツール固有の初期化処理
        console.log('[PenTool] Pen tool activated with settings:', this.settings);
    }

    /**
     * ツール無効化時の処理
     * @protected
     */
    _onDeactivate() {
        // バッファをクリア
        this.drawingBuffer = [];
        console.log('[PenTool] Pen tool deactivated');
    }

    /**
     * 設定更新時の処理
     * @protected
     */
    _onSettingsUpdate(newSettings, oldSettings) {
        // 圧力感知設定の変更をログ出力
        if (newSettings.pressureSensitive !== oldSettings.pressureSensitive) {
            console.log(`[PenTool] Pressure sensitivity ${newSettings.pressureSensitive ? 'enabled' : 'disabled'}`);
        }

        // サイズ制限の適用
        if (newSettings.size !== undefined) {
            this.settings.size = Math.max(this.settings.minSize, 
                                Math.min(this.settings.maxSize, newSettings.size));
        }
    }

    /**
     * ペン固有オプションを設定
     * @param {object} options - ペンオプション
     */
    setPenOptions(options) {
        try {
            Object.assign(this.penOptions, options);
            console.log('[PenTool] Pen options updated:', this.penOptions);
        } catch (error) {
            window.ErrorManager?.handleError(error, 'PenTool.setPenOptions');
        }
    }

    /**
     * ペン固有オプションを取得
     * @returns {object} ペンオプション
     */
    getPenOptions() {
        return { ...this.penOptions };
    }

    /**
     * 現在のブラシプレビューを取得
     * @param {object} point - プレビュー用の点
     * @returns {object} プレビュー情報
     */
    getBrushPreview(point = {}) {
        const previewPoint = {
            x: 0,
            y: 0,
            pressure: 0.5,
            ...point
        };

        const style = this._calculatePointStyle(previewPoint);
        
        return {
            size: style.size,
            color: style.color,
            alpha: style.alpha
        };
    }

    // ========================================
    // 内部メソッド
    // ========================================

    /**
     * バッファを描画に反映
     * @private
     */
    _flushBuffer(isEnd = false) {
        try {
            if (this.drawingBuffer.length === 0) {
                return;
            }

            // 線分として描画
            if (this.drawingBuffer.length >= 2 || isEnd) {
                const style = this._calculateLineStyle();
                
                if (this.canvasManager) {
                    this.canvasManager.drawLine(this.drawingBuffer, style);
                }
            }

            // 最後の点を残してバッファをクリア（連続性を保つため）
            if (!isEnd && this.drawingBuffer.length > 0) {
                const lastPoint = this.drawingBuffer[this.drawingBuffer.length - 1];
                this.drawingBuffer = [lastPoint];
            } else {
                this.drawingBuffer = [];
            }
        } catch (error) {
            window.ErrorManager?.handleError(error, 'PenTool._flushBuffer');
        }
    }

    /**
     * 点のスタイルを計算
     * @private
     */
    _calculatePointStyle(point, isStart = false) {
        let size = this.settings.size;
        let alpha = this.settings.opacity;

        // 圧力感知
        if (this.settings.pressureSensitive && point.pressure !== undefined) {
            const pressure = Math.max(0.1, point.pressure); // 最小圧力を保証
            size *= pressure * this.penOptions.pressureMultiplier;
            size = Math.max(this.settings.minSize, Math.min(this.settings.maxSize, size));
        }

        // 開始時のテーパリング
        if (isStart && this.penOptions.tapering) {
            size *= this.penOptions.taperStart;
        }

        // 色の処理
        let color = this.settings.color;
        if (typeof color === 'string' && color.startsWith('#')) {
            color = parseInt(color.substring(1), 16);
        }

        return {
            size: size,
            color: color,
            alpha: alpha
        };
    }

    /**
     * 線のスタイルを計算
     * @private
     */
    _calculateLineStyle() {
        // 平均的な圧力を計算
        let avgPressure = 0.5;
        
        if (this.settings.pressureSensitive && this.drawingBuffer.length > 0) {
            const totalPressure = this.drawingBuffer.reduce((sum, point) => 
                sum + (point.pressure || 0.5), 0);
            avgPressure = totalPressure / this.drawingBuffer.length;
        }

        let width = this.settings.size;
        
        if (this.settings.pressureSensitive) {
            width *= avgPressure * this.penOptions.pressureMultiplier;
            width = Math.max(this.settings.minSize, Math.min(this.settings.maxSize, width));
        }

        // 色の処理
        let color = this.settings.color;
        if (typeof color === 'string' && color.startsWith('#')) {
            color = parseInt(color.substring(1), 16);
        }

        return {
            width: width,
            color: color,
            alpha: this.settings.opacity,
            cap: 'round',
            join: 'round'
        };
    }

    /**
     * 終了時のテーパリングを適用
     * @private
     */
    _applyEndTapering() {
        try {
            if (this.currentStroke.points.length < 3) {
                return;
            }

            // 最後の数点にテーパリング効果を適用
            const taperPoints = Math.min(3, this.currentStroke.points.length);
            const endPoints = this.currentStroke.points.slice(-taperPoints);

            const taperStyle = this._calculateLineStyle();
            taperStyle.width *= this.penOptions.taperEnd;

            if (this.canvasManager) {
                this.canvasManager.drawLine(endPoints, taperStyle);
            }
        } catch (error) {
            window.ErrorManager?.handleError(error, 'PenTool._applyEndTapering');
        }
    }

    /**
     * 速度ベースの線幅調整を計算
     * @private
     */
    _calculateVelocityAdjustment(currentPoint, previousPoint) {
        if (!previousPoint || !this.penOptions.velocitySmoothing) {
            return 1.0;
        }

        const distance = Math.sqrt(
            Math.pow(currentPoint.x - previousPoint.x, 2) + 
            Math.pow(currentPoint.y - previousPoint.y, 2)
        );

        const timeDelta = currentPoint.timestamp - previousPoint.timestamp;
        const velocity = timeDelta > 0 ? distance / timeDelta : 0;

        // 速度が速いほど線を細く（0.5〜1.5の範囲）
        const velocityFactor = Math.max(0.5, Math.min(1.5, 1.0 - velocity * 0.01));
        
        return velocityFactor;
    }
}

// グローバルインスタンスを作成・公開
window.PenTool = new PenTool();

console.log('[PenTool] Initialized and registered to window.PenTool');