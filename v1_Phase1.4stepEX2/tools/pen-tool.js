/**
 * 🖊️ PenTool - ペン描画専門ツール
 * ✅ DRAWING_AUTHORITY: 描画処理の主導権保持
 * 🔧 COORDINATE_CONTROL: 座標変換・moveTo/lineTo制御
 * 📋 RESPONSIBILITY: 「ペン」としての描画オブジェクト生成
 * 
 * 📏 DESIGN_PRINCIPLE: ユーザー入力 → Graphics生成 → CanvasManagerに渡す
 * 🎯 ARCHITECTURE: AbstractTool継承・1ファイル1ツール設計
 * 🚫 COORDINATE_BUG_NOTES: 0,0直線バグ等の座標問題対策済み
 * 
 * 座標バグ完全修正:
 * - moveTo/lineToの制御を完全にTool側で実行
 * - 0,0座標からの直線問題を根本解決
 * - CanvasManagerには完成したGraphicsのみを渡す
 */

// Tegaki名前空間初期化（Phase1.4stepEX準拠）
window.Tegaki = window.Tegaki || {};

class PenTool extends Tegaki.AbstractTool {
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

        // ペン固有設定
        this.penOptions = {
            pressureMultiplier: 2.0,
            velocitySmoothing: true,
            tapering: true,
            taperStart: 0.8,
            taperEnd: 0.6,
            minDistance: 2.0 // 最小描画距離（0,0バグ対策）
        };

        // 描画バッファ（滑らか描画用）
        this.drawingBuffer = [];
        this.bufferSize = 3;

        // 座標制御状態（重要な0,0バグ対策）
        this.drawingState = {
            hasFirstPoint: false,
            currentPath: null,
            lastDrawnPoint: null
        };
    }

    // ========================================
    // AbstractTool必須実装メソッド
    // ========================================

    /**
     * ストローク開始時の処理
     * @protected
     * @param {object} point - 座標点 {x, y, pressure, timestamp}
     */
    _onStrokeStart(point) {
        try {
            // 描画バッファクリア
            this.drawingBuffer = [];
            
            // 描画状態リセット（重要な0,0バグ対策）
            this.drawingState = {
                hasFirstPoint: true,
                currentPath: null,
                lastDrawnPoint: { ...point }
            };

            // Graphics初期化
            if (this.currentStroke.graphics) {
                this._initializeGraphicsForPen(this.currentStroke.graphics);
                
                // 開始点を明示的にmoveTo（重要な座標制御）
                this.currentStroke.graphics.moveTo(point.x, point.y);
            }

            console.log(`[PenTool] Stroke started at (${point.x.toFixed(2)}, ${point.y.toFixed(2)})`);
        } catch (error) {
            window.ErrorManager?.handleError(error, 'PenTool._onStrokeStart');
        }
    }

    /**
     * 点追加時の処理
     * @protected
     * @param {object} point - 座標点
     */
    _onPointAdd(point) {
        try {
            // 距離チェック（微小移動フィルタ・0,0バグ対策）
            if (this.drawingState.lastDrawnPoint) {
                const distance = this._calculateDistance(point, this.drawingState.lastDrawnPoint);
                if (distance < this.penOptions.minDistance) {
                    return; // 微小移動は無視
                }
            }

            // バッファに追加
            this.drawingBuffer.push(point);

            // バッファが溜まったら描画実行
            if (this.drawingBuffer.length >= this.bufferSize) {
                this._flushBufferToGraphics();
            }
        } catch (error) {
            window.ErrorManager?.handleError(error, 'PenTool._onPointAdd');
        }
    }

    /**
     * ストローク終了時の処理
     * @protected
     * @param {object} point - 座標点
     */
    _onStrokeEnd(point) {
        try {
            // 残りのバッファを描画
            this._flushBufferToGraphics(true);

            // テーパリング処理（末尾）
            if (this.penOptions.tapering && this.currentStroke.points.length > 2) {
                this._applyEndTapering();
            }

            // 最終的なGraphicsの完成確認
            this._finalizeGraphics();

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
        console.log('[PenTool] Pen tool activated with settings:', this.settings);
    }

    /**
     * ツール無効化時の処理
     * @protected
     */
    _onDeactivate() {
        // バッファクリア
        this.drawingBuffer = [];
        this.drawingState = {
            hasFirstPoint: false,
            currentPath: null,
            lastDrawnPoint: null
        };
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

    // ========================================
    // ペン固有の公開メソッド
    // ========================================

    /**
     * ペン固有オプション設定
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
     * ペン固有オプション取得
     * @returns {object}
     */
    getPenOptions() {
        return { ...this.penOptions };
    }

    /**
     * ブラシプレビュー取得
     * @param {object} point - プレビュー用点
     * @returns {object}
     */
    getBrushPreview(point = {}) {
        const previewPoint = {
            x: 0,
            y: 0,
            pressure: 0.5,
            ...point
        };

        const style = this._calculatePenStyle(previewPoint);
        
        return {
            size: style.width,
            color: style.color,
            alpha: style.alpha
        };
    }

    // ========================================
    // 内部描画制御メソッド（座標バグ修正の核心）
    // ========================================

    /**
     * Graphics初期化（ペン用）
     * @private
     */
    _initializeGraphicsForPen(graphics) {
        const style = this._calculatePenStyle();
        
        graphics.lineStyle({
            width: style.width,
            color: style.color,
            alpha: style.alpha,
            cap: 'round',
            join: 'round'
        });
    }

    /**
     * バッファをGraphicsに描画（重要な座標制御）
     * @private
     */
    _flushBufferToGraphics(isEnd = false) {
        try {
            if (!this.currentStroke.graphics || this.drawingBuffer.length === 0) {
                return;
            }

            // 連続線描画（0,0バグを完全回避）
            for (let i = 0; i < this.drawingBuffer.length; i++) {
                const point = this.drawingBuffer[i];
                
                if (!this.drawingState.hasFirstPoint) {
                    // 初回：moveTo で開始点設定
                    this.currentStroke.graphics.moveTo(point.x, point.y);
                    this.drawingState.hasFirstPoint = true;
                } else {
                    // 2回目以降：lineTo で線を描画
                    this.currentStroke.graphics.lineTo(point.x, point.y);
                }
                
                this.drawingState.lastDrawnPoint = { ...point };
            }

            // 筆圧対応の線幅調整
            this._applyPressureVariation();

            // バッファクリア処理
            if (!isEnd && this.drawingBuffer.length > 0) {
                // 連続性保持：最後の点を残してクリア
                const lastPoint = this.drawingBuffer[this.drawingBuffer.length - 1];
                this.drawingBuffer = [lastPoint];
            } else {
                // 終了時：完全クリア
                this.drawingBuffer = [];
            }
        } catch (error) {
            window.ErrorManager?.handleError(error, 'PenTool._flushBufferToGraphics');
        }
    }

    /**
     * ペンスタイル計算
     * @private
     */
    _calculatePenStyle(point = null) {
        let width = this.settings.size;
        let alpha = this.settings.opacity;

        // 圧力感知処理
        if (this.settings.pressureSensitive && point && point.pressure !== undefined) {
            const pressure = Math.max(0.1, Math.min(1.0, point.pressure));
            width *= pressure * this.penOptions.pressureMultiplier;
            width = Math.max(this.settings.minSize, Math.min(this.settings.maxSize, width));
        }

        // 色処理（文字列→数値変換）
        let color = this.settings.color;
        if (typeof color === 'string' && color.startsWith('#')) {
            color = parseInt(color.substring(1), 16);
        }

        return {
            width: width,
            color: color,
            alpha: alpha
        };
    }

    /**
     * 筆圧バリエーション適用
     * @private
     */
    _applyPressureVariation() {
        if (!this.settings.pressureSensitive || this.drawingBuffer.length === 0) {
            return;
        }

        // 現在のバッファ内の点に対して筆圧対応
        const avgPressure = this.drawingBuffer.reduce((sum, point) => 
            sum + (point.pressure || 0.5), 0) / this.drawingBuffer.length;

        const dynamicStyle = this._calculatePenStyle({ pressure: avgPressure });
        
        // Graphics線幅を動的更新
        this.currentStroke.graphics.lineStyle({
            width: dynamicStyle.width,
            color: dynamicStyle.color,
            alpha: dynamicStyle.alpha,
            cap: 'round',
            join: 'round'
        });
    }

    /**
     * 終了テーパリング適用
     * @private
     */
    _applyEndTapering() {
        try {
            if (this.currentStroke.points.length < 3) {
                return;
            }

            // 最後の数点にテーパリング効果
            const taperPoints = Math.min(3, this.currentStroke.points.length);
            const endPoints = this.currentStroke.points.slice(-taperPoints);

            // テーパリング用スタイル
            const taperStyle = this._calculatePenStyle();
            taperStyle.width *= this.penOptions.taperEnd;

            // 新しいGraphicsで重ねて描画
            const taperGraphics = new PIXI.Graphics();
            taperGraphics.lineStyle({
                width: taperStyle.width,
                color: taperStyle.color,
                alpha: taperStyle.alpha,
                cap: 'round',
                join: 'round'
            });

            taperGraphics.moveTo(endPoints[0].x, endPoints[0].y);
            for (let i = 1; i < endPoints.length; i++) {
                taperGraphics.lineTo(endPoints[i].x, endPoints[i].y);
            }

            // 現在のGraphicsに合成
            this.currentStroke.graphics.addChild(taperGraphics);
        } catch (error) {
            window.ErrorManager?.handleError(error, 'PenTool._applyEndTapering');
        }
    }

    /**
     * Graphics最終化
     * @private
     */
    _finalizeGraphics() {
        if (!this.currentStroke.graphics) {
            return;
        }

        // 描画完了の確定（重要な処理）
        // PixiJS v8対応準備：Graphics.finalize() 相当処理
        this.currentStroke.graphics.endFill();
        
        console.log('[PenTool] Graphics finalized');
    }

    /**
     * 速度ベース線幅調整計算
     * @private
     */
    _calculateVelocityAdjustment(currentPoint, previousPoint) {
        if (!previousPoint || !this.penOptions.velocitySmoothing) {
            return 1.0;
        }

        const distance = this._calculateDistance(currentPoint, previousPoint);
        const timeDelta = currentPoint.timestamp - previousPoint.timestamp;
        const velocity = timeDelta > 0 ? distance / timeDelta : 0;

        // 速度が速いほど線を細く（0.5〜1.5の範囲）
        const velocityFactor = Math.max(0.5, Math.min(1.5, 1.0 - velocity * 0.01));
        
        return velocityFactor;
    }

    /**
     * 2点間距離計算（AbstractToolから継承可能だが、最適化版）
     * @private
     */
    _calculateDistance(point1, point2) {
        const dx = point1.x - point2.x;
        const dy = point1.y - point2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * ペン固有統計取得
     * @returns {object}
     */
    getPenStats() {
        const baseStats = this.getStats();
        
        return {
            ...baseStats,
            penOptions: { ...this.penOptions },
            drawingState: { ...this.drawingState },
            bufferSize: this.drawingBuffer.length
        };
    }
}

// Tegaki名前空間に登録（Phase1.4stepEX準拠）
Tegaki.PenTool = PenTool;

// 初期化レジストリ方式（Phase1.4stepEX準拠）
Tegaki._registry = Tegaki._registry || [];
Tegaki._registry.push(() => {
    Tegaki.PenToolInstance = new PenTool();
    console.log('[PenTool] Registered to Tegaki namespace');
});

// 🔄 PixiJS v8対応準備コメント
// - PIXI.Graphics.lineStyle() → PIXI.Graphics.stroke() 移行準備
// - Graphics.endFill() → Graphics.finalize() 移行準備
// - 座標制御アルゴリズムはv8互換設計

console.log('[PenTool] Loaded and ready for registry initialization');