/**
 * EraserTool - 消しゴムツール
 * 🚨 v12修正: AbstractTool継承エラー解消・初期化順序調整
 * 
 * 責務:
 * - 消しゴム固有の消去処理
 * - CanvasManagerとの連携による実際の消去
 * - 消去範囲の制御
 * 
 * 依存: AbstractTool, CanvasManager
 * 公開: Tegaki.EraserToolInstance
 */

// Tegaki名前空間初期化
window.Tegaki = window.Tegaki || {};

/**
 * 🚨 v12修正: AbstractTool継承エラーの解消
 * - window.AbstractTool の存在確認を追加
 * - 継承タイミングの調整
 * - エラーハンドリングの強化
 */
class EraserTool extends (window.AbstractTool || class {}) {
    constructor() {
        // 🚨 v12修正: AbstractTool未定義時のエラー回避
        if (!window.AbstractTool) {
            console.error('[EraserTool] AbstractTool is not available. EraserTool cannot be initialized.');
            return;
        }

        // デフォルト設定でAbstractToolを初期化
        super('eraser', {
            size: 10,
            opacity: 1.0,
            softness: 0.2,
            minSize: 2,
            maxSize: 100
        });

        // 消しゴム固有の設定
        this.eraserOptions = {
            erasureMode: 'pixel', // 'pixel' | 'object' | 'alpha'
            previewEnabled: true,
            previewOpacity: 0.3,
            continuousErase: true
        };

        // 消去バッファ
        this.erasureBuffer = [];
        this.bufferSize = 2; // 消しゴムは描画より少ないバッファでOK

        // CanvasManager参照
        this.canvasManager = null;
        
        console.log('[EraserTool] Constructor completed successfully');
    }

    /**
     * 🚨 v12追加: クラス検証メソッド
     */
    static validateClass() {
        if (!window.AbstractTool) {
            console.error('[EraserTool] AbstractTool base class is not available');
            return false;
        }
        return true;
    }

    /**
     * ストローク開始時の処理
     * @protected
     */
    _onStrokeStart(point) {
        try {
            // バッファをクリア
            this.erasureBuffer = [];
            
            // 開始点で消去実行
            if (this.canvasManager && this.eraserOptions.continuousErase) {
                this.canvasManager.erase([point], this.settings.size);
            }

            console.log(`[EraserTool] Erasure started at (${point.x.toFixed(2)}, ${point.y.toFixed(2)})`);
        } catch (error) {
            this._handleError(error, 'EraserTool._onStrokeStart');
        }
    }

    /**
     * 点追加時の処理
     * @protected
     */
    _onPointAdd(point) {
        try {
            // バッファに追加
            this.erasureBuffer.push(point);

            // 連続消去モードの場合は即座に消去
            if (this.eraserOptions.continuousErase) {
                this._performContinuousErase(point);
            }

            // バッファが溜まったら処理
            if (this.erasureBuffer.length >= this.bufferSize) {
                this._flushErasureBuffer();
            }
        } catch (error) {
            this._handleError(error, 'EraserTool._onPointAdd');
        }
    }

    /**
     * ストローク終了時の処理
     * @protected
     */
    _onStrokeEnd(point) {
        try {
            // 残りのバッファを処理
            this._flushErasureBuffer(true);

            console.log(`[EraserTool] Erasure ended with ${this.currentStroke.points.length} points`);
        } catch (error) {
            this._handleError(error, 'EraserTool._onStrokeEnd');
        }
    }

    /**
     * ツール有効化時の処理
     * @protected
     */
    _onActivate() {
        console.log('[EraserTool] Eraser tool activated with settings:', this.settings);
        
        // プレビューモードの設定
        if (this.eraserOptions.previewEnabled) {
            this._enableEraserPreview();
        }
    }

    /**
     * ツール無効化時の処理
     * @protected
     */
    _onDeactivate() {
        // バッファをクリア
        this.erasureBuffer = [];
        
        // プレビューを無効化
        this._disableEraserPreview();
        
        console.log('[EraserTool] Eraser tool deactivated');
    }

    /**
     * 設定更新時の処理
     * @protected
     */
    _onSettingsUpdate(newSettings, oldSettings) {
        // サイズ制限の適用
        if (newSettings.size !== undefined) {
            this.settings.size = Math.max(this.settings.minSize, 
                                Math.min(this.settings.maxSize, newSettings.size));
        }

        // 消去モードの変更をログ出力
        if (newSettings.softness !== oldSettings.softness) {
            console.log(`[EraserTool] Softness changed to ${newSettings.softness}`);
        }
    }

    /**
     * 消しゴム固有オプションを設定
     * @param {object} options - 消しゴムオプション
     */
    setEraserOptions(options) {
        try {
            const oldOptions = { ...this.eraserOptions };
            Object.assign(this.eraserOptions, options);

            // プレビュー設定の変更処理
            if (options.previewEnabled !== undefined && options.previewEnabled !== oldOptions.previewEnabled) {
                if (options.previewEnabled && this.isActive) {
                    this._enableEraserPreview();
                } else {
                    this._disableEraserPreview();
                }
            }

            console.log('[EraserTool] Eraser options updated:', this.eraserOptions);
        } catch (error) {
            this._handleError(error, 'EraserTool.setEraserOptions');
        }
    }

    /**
     * 消しゴム固有オプションを取得
     * @returns {object} 消しゴムオプション
     */
    getEraserOptions() {
        return { ...this.eraserOptions };
    }

    /**
     * 消しゴムプレビューを取得
     * @param {object} point - プレビュー用の点
     * @returns {object} プレビュー情報
     */
    getEraserPreview(point = {}) {
        return {
            size: this.settings.size,
            opacity: this.eraserOptions.previewOpacity,
            softness: this.settings.softness,
            x: point.x || 0,
            y: point.y || 0
        };
    }

    /**
     * 指定範囲を即座に消去
     * @param {object} point - 消去中心点
     * @param {number} size - 消去サイズ（オプション）
     */
    eraseAtPoint(point, size = null) {
        try {
            const eraseSize = size || this.settings.size;
            
            if (this.canvasManager) {
                this.canvasManager.erase([point], eraseSize);
                
                // 統一システム経由でイベント発火
                this._emitEvent('eraser:point-erased', {
                    point,
                    size: eraseSize
                });
            }
        } catch (error) {
            this._handleError(error, 'EraserTool.eraseAtPoint');
        }
    }

    // ========================================
    // 内部メソッド
    // ========================================

    /**
     * 消去バッファを処理
     * @private
     */
    _flushErasureBuffer(isEnd = false) {
        try {
            if (this.erasureBuffer.length === 0) {
                return;
            }

            // 連続消去モードでない場合のみバッファ処理
            if (!this.eraserOptions.continuousErase) {
                if (this.canvasManager) {
                    this.canvasManager.erase(this.erasureBuffer, this.settings.size);
                }
            }

            // バッファをクリア
            if (isEnd) {
                this.erasureBuffer = [];
            } else {
                // 最後の点を残して連続性を保つ
                const lastPoint = this.erasureBuffer[this.erasureBuffer.length - 1];
                this.erasureBuffer = [lastPoint];
            }
        } catch (error) {
            this._handleError(error, 'EraserTool._flushErasureBuffer');
        }
    }

    /**
     * 連続消去を実行
     * @private
     */
    _performContinuousErase(point) {
        try {
            if (this.canvasManager) {
                // ソフトネスを考慮した消去サイズ
                const effectiveSize = this.settings.size * (1 + this.settings.softness);
                
                this.canvasManager.erase([point], effectiveSize);
            }
        } catch (error) {
            this._handleError(error, 'EraserTool._performContinuousErase');
        }
    }

    /**
     * 消しゴムプレビューを有効化
     * @private
     */
    _enableEraserPreview() {
        try {
            // プレビュー用のイベントリスナーを設定
            this._previewHandler = this._handlePreviewMove.bind(this);
            
            if (this.canvasManager && this.canvasManager.getPixiApp()) {
                const canvas = this.canvasManager.getPixiApp().view;
                canvas.addEventListener('pointermove', this._previewHandler);
            }

            console.log('[EraserTool] Preview enabled');
        } catch (error) {
            this._handleError(error, 'EraserTool._enableEraserPreview');
        }
    }

    /**
     * 消しゴムプレビューを無効化
     * @private
     */
    _disableEraserPreview() {
        try {
            if (this._previewHandler && this.canvasManager && this.canvasManager.getPixiApp()) {
                const canvas = this.canvasManager.getPixiApp().view;
                canvas.removeEventListener('pointermove', this._previewHandler);
                this._previewHandler = null;
            }

            // プレビューグラフィックスをクリア
            this._clearPreviewGraphics();

            console.log('[EraserTool] Preview disabled');
        } catch (error) {
            this._handleError(error, 'EraserTool._disableEraserPreview');
        }
    }

    /**
     * プレビューマウス移動処理
     * @private
     */
    _handlePreviewMove(event) {
        try {
            if (!this.isActive || this.isDrawing) {
                return;
            }

            // CoordinateManagerを使用した座標抽出
            let pointerInfo = null;
            if (window.Tegaki && window.Tegaki.CoordinateManagerInstance) {
                pointerInfo = window.Tegaki.CoordinateManagerInstance.extractPointerCoordinates(event);
            } else if (window.CoordinateManager) {
                pointerInfo = window.CoordinateManager.extractPointerInfo(event);
            }
            
            if (pointerInfo) {
                this._updatePreviewGraphics(pointerInfo);
            }
        } catch (error) {
            this._handleError(error, 'EraserTool._handlePreviewMove');
        }
    }

    /**
     * プレビューグラフィックスを更新
     * @private
     */
    _updatePreviewGraphics(point) {
        try {
            if (!this.canvasManager) {
                return;
            }

            // 既存のプレビューをクリア
            this._clearPreviewGraphics();

            // 新しいプレビューを作成
            const stage = this.canvasManager.getStage();
            if (stage) {
                this._previewGraphics = new PIXI.Graphics();
                
                // 円形のプレビューを描画
                this._previewGraphics.lineStyle({
                    width: 1,
                    color: 0x666666,
                    alpha: this.eraserOptions.previewOpacity
                });
                
                this._previewGraphics.drawCircle(point.x, point.y, this.settings.size / 2);
                
                // ソフトネスのプレビュー
                if (this.settings.softness > 0) {
                    this._previewGraphics.lineStyle({
                        width: 1,
                        color: 0x999999,
                        alpha: this.eraserOptions.previewOpacity * 0.5
                    });
                    
                    const softRadius = (this.settings.size / 2) * (1 + this.settings.softness);
                    this._previewGraphics.drawCircle(point.x, point.y, softRadius);
                }
                
                stage.addChild(this._previewGraphics);
            }
        } catch (error) {
            this._handleError(error, 'EraserTool._updatePreviewGraphics');
        }
    }

    /**
     * プレビューグラフィックスをクリア
     * @private
     */
    _clearPreviewGraphics() {
        try {
            if (this._previewGraphics && this.canvasManager) {
                const stage = this.canvasManager.getStage();
                if (stage && stage.children.includes(this._previewGraphics)) {
                    stage.removeChild(this._previewGraphics);
                }
                this._previewGraphics.destroy();
                this._previewGraphics = null;
            }
        } catch (error) {
            this._handleError(error, 'EraserTool._clearPreviewGraphics');
        }
    }

    /**
     * 消去効果の計算
     * @private
     */
    _calculateErasureEffect(point, distance) {
        const radius = this.settings.size / 2;
        
        if (distance > radius) {
            return 0; // 範囲外は消去なし
        }

        // ソフトネスを考慮した消去強度計算
        if (this.settings.softness > 0) {
            const softRadius = radius * (1 + this.settings.softness);
            const normalizedDistance = distance / softRadius;
            
            // ソフトな消去（距離に応じて強度減衰）
            return Math.max(0, 1 - normalizedDistance);
        } else {
            // ハードな消去（範囲内は完全消去）
            return distance <= radius ? 1 : 0;
        }
    }

    /**
     * 消去範囲の計算
     * @private
     */
    _calculateErasureBounds(point) {
        const radius = this.settings.size / 2;
        const softRadius = radius * (1 + this.settings.softness);
        const effectiveRadius = Math.max(radius, softRadius);

        return {
            minX: point.x - effectiveRadius,
            minY: point.y - effectiveRadius,
            maxX: point.x + effectiveRadius,
            maxY: point.y + effectiveRadius,
            radius: effectiveRadius
        };
    }

    /**
     * アルファベース消去の実行
     * @private
     */
    _performAlphaErase(points) {
        try {
            if (!this.canvasManager || this.eraserOptions.erasureMode !== 'alpha') {
                return;
            }

            // アルファチャンネルベースの消去処理
            // 実際の実装では、PIXIのブレンドモードやフィルターを使用
            for (const point of points) {
                const bounds = this._calculateErasureBounds(point);
                
                // TODO: より高度なアルファ消去処理
                this.canvasManager.erase([point], this.settings.size);
            }
        } catch (error) {
            this._handleError(error, 'EraserTool._performAlphaErase');
        }
    }

    /**
     * オブジェクトベース消去の実行
     * @private
     */
    _performObjectErase(points) {
        try {
            if (!this.canvasManager || this.eraserOptions.erasureMode !== 'object') {
                return;
            }

            // オブジェクト単位での消去処理
            // 将来のレイヤー実装時に活用
            
            console.log('[EraserTool] Object-based erasure not yet implemented');
        } catch (error) {
            this._handleError(error, 'EraserTool._performObjectErase');
        }
    }

    /**
     * 🚨 v12追加: 統一エラーハンドリング
     * @private
     */
    _handleError(error, context) {
        if (window.Tegaki && window.Tegaki.ErrorManagerInstance) {
            window.Tegaki.ErrorManagerInstance.handle(error, context);
        } else if (window.ErrorManager) {
            window.ErrorManager.handleError(error, context);
        } else {
            console.error(`[EraserTool] Error in ${context}:`, error);
        }
    }

    /**
     * 🚨 v12追加: 統一イベント発火
     * @private
     */
    _emitEvent(eventType, data) {
        try {
            if (window.Tegaki && window.Tegaki.EventBusInstance) {
                window.Tegaki.EventBusInstance.emit(eventType, data);
            } else if (window.EventBus) {
                window.EventBus.emit(eventType, data);
            }
        } catch (error) {
            console.warn('[EraserTool] Event emission failed:', error);
        }
    }

    /**
     * 🚨 v12追加: ツール健全性チェック
     */
    healthCheck() {
        const report = {
            toolName: 'eraser',
            isHealthy: true,
            issues: [],
            recommendations: []
        };

        try {
            // 基底クラス確認
            if (!window.AbstractTool) {
                report.isHealthy = false;
                report.issues.push('AbstractTool base class not available');
                report.recommendations.push('Ensure AbstractTool is loaded before EraserTool');
            }

            // 基本状態チェック
            if (this.isDrawing && !this.currentStroke.graphics) {
                report.isHealthy = false;
                report.issues.push('Drawing state inconsistent');
            }

            // 統合チェック
            if (!this.canvasManager) {
                report.issues.push('CanvasManager not connected');
                report.recommendations.push('Call attachToCanvas() method');
            }

            // 設定チェック
            if (this.settings.size <= 0) {
                report.issues.push('Invalid tool size');
                report.recommendations.push('Set positive size value');
            }

            if (report.issues.length > 0 && report.isHealthy) {
                report.isHealthy = false;
            }

        } catch (error) {
            report.isHealthy = false;
            report.issues.push(`Health check failed: ${error.message}`);
        }

        return report;
    }
}

/**
 * 🚨 v12修正: 安全なインスタンス生成関数
 */
function createEraserToolInstance() {
    try {
        // AbstractTool の存在確認
        if (!window.AbstractTool) {
            console.error('[EraserTool] Cannot create instance: AbstractTool not available');
            return null;
        }

        // EraserTool クラス検証
        if (!EraserTool.validateClass()) {
            console.error('[EraserTool] Class validation failed');
            return null;
        }

        const instance = new EraserTool();
        console.log('[EraserTool] Instance created successfully');
        return instance;

    } catch (error) {
        console.error('[EraserTool] Instance creation failed:', error);
        return null;
    }
}

// Tegaki名前空間に登録（Phase1.4stepEX準拠）
Tegaki.EraserTool = EraserTool;
Tegaki.createEraserToolInstance = createEraserToolInstance;

/**
 * 🚨 v12修正: レジストリ方式の安全な初期化
 * AbstractTool の読み込み待機を追加
 */
Tegaki._registry = Tegaki._registry || [];
Tegaki._registry.push(() => {
    try {
        // AbstractTool の存在確認（重要な修正点）
        if (!window.AbstractTool) {
            console.warn('[EraserTool] AbstractTool not yet loaded, deferring initialization');
            
            // AbstractTool読み込み待機
            const checkAbstractTool = () => {
                if (window.AbstractTool) {
                    console.log('[EraserTool] AbstractTool detected, proceeding with initialization');
                    const instance = createEraserToolInstance();
                    if (instance) {
                        Tegaki.EraserToolInstance = instance;
                        console.log('[EraserTool] ✅ Tegaki.EraserToolInstance 初期化完了');
                    }
                } else {
                    // 再試行（最大10回、1秒間隔）
                    if ((checkAbstractTool.attempts || 0) < 10) {
                        checkAbstractTool.attempts = (checkAbstractTool.attempts || 0) + 1;
                        setTimeout(checkAbstractTool, 100);
                    } else {
                        console.error('[EraserTool] AbstractTool loading timeout - EraserTool disabled');
                    }
                }
            };
            checkAbstractTool();
            return;
        }

        // 即座にインスタンス生成
        const instance = createEraserToolInstance();
        if (instance) {
            Tegaki.EraserToolInstance = instance;
            console.log('[EraserTool] ✅ Tegaki.EraserToolInstance 初期化完了');
        } else {
            console.error('[EraserTool] Instance creation failed during registry initialization');
        }

    } catch (error) {
        console.error('[EraserTool] Registry initialization failed:', error);
    }
});

console.log('[EraserTool] ✅ Loaded with enhanced error handling and inheritance safety (v12)');