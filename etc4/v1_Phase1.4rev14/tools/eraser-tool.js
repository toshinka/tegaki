/**
 * 🧹 EraserTool - 消しゴム専門ツール
 * ✅ ERASING_AUTHORITY: 消去処理の主導権保持
 * 🔧 COORDINATE_CONTROL: 座標変換・消去範囲制御
 * 📋 RESPONSIBILITY: 「消しゴム」としての消去オブジェクト生成
 * 
 * 📏 DESIGN_PRINCIPLE: ユーザー入力 → 消去Graphics生成 → CanvasManagerに渡す
 * 🎯 ARCHITECTURE: AbstractTool継承・1ファイル1ツール設計
 * 
 * @version 1.0-Phase1.4-eraser-implementation
 * @author Tegaki Development Team
 * @extends AbstractTool
 * @since Phase1.4
 */

class EraserTool extends window.AbstractTool {
    constructor() {
        super('EraserTool');
        
        // 消しゴム固有プロパティ
        this.currentErase = null;
        this.erasePoints = [];
        this.isFirstPoint = true;
        
        // 消しゴム設定（AbstractToolの設定を拡張）
        this.settings = {
            ...this.settings,
            width: 10,
            opacity: 1.0,
            blendMode: 'destination-out' // 消去ブレンドモード
        };
        
        // 消去範囲表示用
        this.previewGraphics = null;
        this.showPreview = true;
        
        console.log('🧹 EraserTool 初期化完了 - v1.0-Phase1.4-eraser-implementation');
    }

    /**
     * 消去開始処理
     * @param {Event} event - ポインターイベント
     * @returns {boolean} 開始成功可否
     */
    onPointerDown(event) {
        try {
            console.log('🧹 EraserTool: 消去開始処理開始');

            // 座標抽出・検証
            const coords = this.extractAndValidateCoordinates(event);
            if (!coords) {
                console.warn('⚠️ EraserTool: 座標抽出失敗');
                return false;
            }

            // Graphics作成
            this.graphics = this.createGraphics();
            if (!this.graphics) {
                console.error('❌ EraserTool: Graphics作成失敗');
                return false;
            }

            // 消しゴムスタイル設定
            this.setupEraserStyle();

            // 消去開始点設定
            this.graphics.moveTo(coords.x, coords.y);

            // 状態更新
            this.isDrawing = true;
            this.isFirstPoint = true;
            this.lastPoint = { x: coords.x, y: coords.y };
            this.lastValidX = coords.x;
            this.lastValidY = coords.y;
            this.erasePoints = [{ x: coords.x, y: coords.y }];

            // レイヤーに配置
            if (!this.attachToLayer(this.graphics, 'main')) {
                console.error('❌ EraserTool: レイヤー配置失敗');
                return false;
            }

            // プレビュー表示
            if (this.showPreview) {
                this.showErasePreview(coords);
            }

            console.log(`🧹 EraserTool: 消去開始完了 (${coords.x}, ${coords.y})`);

            // イベント通知
            window.EventBus?.emit('eraser-stroke-start', {
                tool: 'eraser',
                point: coords,
                settings: this.settings
            });

            return true;

        } catch (error) {
            console.error('❌ EraserTool: 消去開始エラー:', error);
            window.ErrorManager?.showErrorMessage('消しゴム開始失敗', error.message);
            this.reset();
            return false;
        }
    }

    /**
     * 消去継続処理
     * @param {Event} event - ポインターイベント
     * @returns {boolean} 継続成功可否
     */
    onPointerMove(event) {
        if (!this.isDrawing || !this.graphics) {
            return false;
        }

        try {
            // 座標抽出・検証
            const coords = this.extractAndValidateCoordinates(event);
            if (!coords) {
                return false;
            }

            // 距離チェック（最適化：近すぎる点は無視）
            const distance = this.calculateDistance(this.lastPoint, coords);
            if (distance < 2.0) {
                return true; // 成功扱いだが処理スキップ
            }

            // 消去パス描画
            if (this.isFirstPoint) {
                // 最初の点は円形で消去
                this.graphics.beginFill(0xFFFFFF, 1.0);
                this.graphics.drawCircle(coords.x, coords.y, this.settings.width / 2);
                this.graphics.endFill();
                this.isFirstPoint = false;
            } else {
                // 線形消去
                this.graphics.lineStyle(this.settings.width, 0xFFFFFF, 1.0, 0.5, true);
                this.graphics.lineTo(coords.x, coords.y);
            }

            // 座標更新
            this.lastPoint = { x: coords.x, y: coords.y };
            this.lastValidX = coords.x;
            this.lastValidY = coords.y;
            this.erasePoints.push({ x: coords.x, y: coords.y });

            // プレビュー更新
            if (this.showPreview) {
                this.updateErasePreview(coords);
            }

            // デバッグログ（パフォーマンス考慮で間引き）
            if (this.erasePoints.length % 10 === 0) {
                console.log(`🧹 EraserTool: 消去継続 - ポイント数: ${this.erasePoints.length}`);
            }

            return true;

        } catch (error) {
            console.error('❌ EraserTool: 消去継続エラー:', error);
            return false;
        }
    }

    /**
     * 消去終了処理
     * @param {Event} event - ポインターイベント
     * @returns {boolean} 終了成功可否
     */
    onPointerUp(event) {
        if (!this.isDrawing) {
            return false;
        }

        try {
            console.log('🧹 EraserTool: 消去終了処理開始');

            // 最終座標処理（オプション）
            if (event) {
                const coords = this.extractAndValidateCoordinates(event);
                if (coords) {
                    this.graphics.lineTo(coords.x, coords.y);
                    this.erasePoints.push({ x: coords.x, y: coords.y });
                }
            }

            // 消去完了処理
            this.finalizeErase();

            // プレビュー非表示
            this.hideErasePreview();

            // 状態リセット
            this.isDrawing = false;
            this.isFirstPoint = true;
            this.currentErase = null;
            this.graphics = null; // Graphics参照クリア（CanvasManagerが管理）

            console.log(`🧹 EraserTool: 消去終了完了 - 総ポイント数: ${this.erasePoints.length}`);

            // イベント通知
            window.EventBus?.emit('eraser-stroke-end', {
                tool: 'eraser',
                pointCount: this.erasePoints.length,
                settings: this.settings
            });

            // 次回消去用リセット
            this.erasePoints = [];

            return true;

        } catch (error) {
            console.error('❌ EraserTool: 消去終了エラー:', error);
            window.ErrorManager?.showErrorMessage('消しゴム終了失敗', error.message);
            this.reset();
            return false;
        }
    }

    /**
     * 消しゴムスタイル設定
     * @private
     */
    setupEraserStyle() {
        try {
            if (!this.graphics) {
                throw new Error('Graphics未初期化');
            }

            // 消去用ブレンドモード設定（PixiJS）
            if (this.graphics.blendMode !== undefined) {
                // 実際の消去は destination-out で実装
                // ここでは白色で描画して後で処理
                this.graphics.blendMode = PIXI.BLEND_MODES.NORMAL;
            }

            console.log('🔧 EraserTool: スタイル設定完了', {
                width: this.settings.width,
                blendMode: this.settings.blendMode
            });

        } catch (error) {
            console.error('❌ EraserTool: スタイル設定エラー:', error);
        }
    }

    /**
     * 消去完了処理
     * @private
     */
    finalizeErase() {
        try {
            if (!this.graphics) {
                return;
            }

            // 消去ストローク情報保存（メモリ管理用）
            this.currentErase = {
                tool: 'eraser',
                points: [...this.erasePoints],
                settings: { ...this.settings },
                timestamp: Date.now()
            };

            // メモリ管理システムに通知（undo/redo用）
            if (window.MemoryManager) {
                window.MemoryManager.addDrawingAction(this.currentErase);
            }

            console.log('📝 EraserTool: 消去完了処理完了');

        } catch (error) {
            console.error('❌ EraserTool: 消去完了処理エラー:', error);
        }
    }

    /**
     * 消去プレビュー表示
     * @param {Object} coords - 座標 {x, y}
     * @private
     */
    showErasePreview(coords) {
        try {
            if (!this.canvasManager) {
                return;
            }

            // プレビューGraphics作成
            this.previewGraphics = this.canvasManager.createGraphicsForTool(`${this.name}_preview`);
            if (!this.previewGraphics) {
                return;
            }

            // プレビュー円描画
            this.previewGraphics.lineStyle(1, 0xFF0000, 0.5);
            this.previewGraphics.beginFill(0xFF0000, 0.1);
            this.previewGraphics.drawCircle(coords.x, coords.y, this.settings.width / 2);
            this.previewGraphics.endFill();

            // オーバーレイレイヤーに配置
            this.attachToLayer(this.previewGraphics, 'overlay');

        } catch (error) {
            console.error('❌ EraserTool: プレビュー表示エラー:', error);
        }
    }

    /**
     * 消去プレビュー更新
     * @param {Object} coords - 座標 {x, y}
     * @private
     */
    updateErasePreview(coords) {
        try {
            if (!this.previewGraphics) {
                return;
            }

            // プレビュー位置更新
            this.previewGraphics.clear();
            this.previewGraphics.lineStyle(1, 0xFF0000, 0.5);
            this.previewGraphics.beginFill(0xFF0000, 0.1);
            this.previewGraphics.drawCircle(coords.x, coords.y, this.settings.width / 2);
            this.previewGraphics.endFill();

        } catch (error) {
            console.error('❌ EraserTool: プレビュー更新エラー:', error);
        }
    }

    /**
     * 消去プレビュー非表示
     * @private
     */
    hideErasePreview() {
        try {
            if (this.previewGraphics && this.canvasManager) {
                this.canvasManager.removeGraphicsFromLayer(this.previewGraphics, 'overlay');
                this.previewGraphics = null;
            }

        } catch (error) {
            console.error('❌ EraserTool: プレビュー非表示エラー:', error);
        }
    }

    /**
     * 2点間距離計算
     * @param {Object} p1 - 点1 {x, y}
     * @param {Object} p2 - 点2 {x, y}
     * @returns {number} 距離
     * @private
     */
    calculateDistance(p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * 消しゴム設定更新（AbstractTool継承版）
     * @param {Object} settings - 新しい設定
     * @returns {boolean} 更新成功可否
     */
    updateSettings(settings) {
        try {
            if (!settings || typeof settings !== 'object') {
                console.warn('⚠️ EraserTool: 無効な設定パラメータ');
                return false;
            }

            // 基底クラスの設定更新
            if (!super.updateSettings(settings)) {
                return false;
            }

            // 消しゴム固有設定検証・適用
            if (settings.width !== undefined) {
                if (typeof settings.width === 'number' && settings.width > 0) {
                    this.settings.width = Math.min(settings.width, 100); // 最大100px
                }
            }

            if (settings.showPreview !== undefined) {
                this.showPreview = !!settings.showPreview;
            }

            console.log('🔧 EraserTool: 設定更新完了', this.settings);
            return true;

        } catch (error) {
            console.error('❌ EraserTool: 設定更新エラー:', error);
            return false;
        }
    }

    /**
     * 消しゴムツール状態取得
     * @returns {Object} 詳細状態情報
     */
    getDrawingState() {
        const baseState = super.getDrawingState();
        
        return {
            ...baseState,
            eraserSpecific: {
                erasePointCount: this.erasePoints.length,
                isFirstPoint: this.isFirstPoint,
                hasPreview: !!this.previewGraphics,
                showPreview: this.showPreview,
                currentEraseId: this.currentErase?.timestamp || null
            }
        };
    }

    /**
     * 消しゴムツール特殊リセット
     * @returns {boolean} リセット成功可否
     */
    reset() {
        try {
            // 基底クラスリセット
            if (!super.reset()) {
                return false;
            }

            // 消しゴム固有状態リセット
            this.currentErase = null;
            this.erasePoints = [];
            this.isFirstPoint = true;
            
            // プレビュー非表示
            this.hideErasePreview();

            console.log('🔄 EraserTool: 特殊リセット完了');
            return true;

        } catch (error) {
            console.error('❌ EraserTool: 特殊リセットエラー:', error);
            return false;
        }
    }

    /**
     * デバッグ情報出力
     * @returns {Object} デバッグ情報
     */
    getDebugInfo() {
        return {
            name: this.name,
            version: '1.0-Phase1.4-eraser-implementation',
            state: this.getDrawingState(),
            settings: { ...this.settings },
            currentErase: this.currentErase ? {
                pointCount: this.currentErase.points.length,
                timestamp: this.currentErase.timestamp
            } : null,
            features: {
                preview: 'ACTIVE',
                blendMode: this.settings.blendMode,
                coordinateValidation: 'ACTIVE'
            }
        };
    }
}

// グローバル登録
if (typeof window !== 'undefined') {
    window.EraserTool = EraserTool;
    console.log('🧹 EraserTool クラスをグローバルに登録完了');
} else {
    // Node.js環境対応
    module.exports = EraserTool;
}

// 初期化完了通知
console.log('🧹 EraserTool v1.0-Phase1.4-eraser-implementation 初期化完了');