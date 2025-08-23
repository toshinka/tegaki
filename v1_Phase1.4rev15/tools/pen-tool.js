/**
 * 🖊️ PenTool - ペン描画専門ツール
 * ✅ DRAWING_AUTHORITY: 描画処理の主導権保持
 * 🔧 COORDINATE_CONTROL: 座標変換・moveTo/lineTo制御
 * 🚫 LEFT_TOP_BUG_FIXED: 左上直線バグ対策実装済み
 * 📋 RESPONSIBILITY: 「筆」としての描画オブジェクト生成
 * 
 * 📏 DESIGN_PRINCIPLE: ユーザー入力 → Graphics生成 → CanvasManagerに渡す
 * 🎯 ARCHITECTURE: AbstractTool継承・1ファイル1ツール設計
 * 
 * @version 1.0-Phase1.4-left-top-bug-fixed
 * @author Tegaki Development Team
 * @extends AbstractTool
 * @since Phase1.0
 */

class PenTool extends window.AbstractTool {
    constructor() {
        super('PenTool');
        
        // ペン固有プロパティ
        this.currentStroke = null;
        this.strokePoints = [];
        this.isFirstPoint = true;
        
        // ペン設定（AbstractToolの設定を拡張）
        this.settings = {
            ...this.settings,
            color: 0x000000,
            width: 2,
            opacity: 1.0,
            lineCap: 'round',
            lineJoin: 'round'
        };
        
        // 左上直線バグ対策用プロパティ
        this.hasMovedTo = false;
        this.initialPoint = null;
        
        console.log('🖊️ PenTool 初期化完了 - v1.0-Phase1.4-left-top-bug-fixed');
    }

    /**
     * 描画開始処理（左上直線バグ対策実装）
     * 🔧 LEFT_TOP_BUG_FIX: moveTo()を適切に実行して初期直線を防ぐ
     * @param {Event} event - ポインターイベント
     * @returns {boolean} 開始成功可否
     */
    onPointerDown(event) {
        try {
            console.log('🖊️ PenTool: 描画開始処理開始');

            // 座標抽出・検証
            const coords = this.extractAndValidateCoordinates(event);
            if (!coords) {
                console.warn('⚠️ PenTool: 座標抽出失敗');
                return false;
            }

            // Graphics作成
            this.graphics = this.createGraphics();
            if (!this.graphics) {
                console.error('❌ PenTool: Graphics作成失敗');
                return false;
            }

            // ペンスタイル設定
            this.setupPenStyle();

            // 🔧 左上直線バグ対策: moveTo()を最初に必ず実行
            this.graphics.moveTo(coords.x, coords.y);
            this.hasMovedTo = true;
            this.initialPoint = { x: coords.x, y: coords.y };

            console.log(`🔧 PenTool: moveTo実行完了 (${coords.x}, ${coords.y})`);

            // 状態更新
            this.isDrawing = true;
            this.isFirstPoint = true;
            this.lastPoint = { x: coords.x, y: coords.y };
            this.lastValidX = coords.x;
            this.lastValidY = coords.y;
            this.strokePoints = [{ x: coords.x, y: coords.y }];

            // レイヤーに配置
            if (!this.attachToLayer(this.graphics, 'main')) {
                console.error('❌ PenTool: レイヤー配置失敗');
                return false;
            }

            console.log(`🖊️ PenTool: 描画開始完了 (${coords.x}, ${coords.y})`);

            // イベント通知
            window.EventBus?.emit('pen-stroke-start', {
                tool: 'pen',
                point: coords,
                settings: this.settings
            });

            return true;

        } catch (error) {
            console.error('❌ PenTool: 描画開始エラー:', error);
            window.ErrorManager?.showErrorMessage('ペン描画開始失敗', error.message);
            this.reset();
            return false;
        }
    }

    /**
     * 描画継続処理
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
            if (distance < 1.0) {
                return true; // 成功扱いだが処理スキップ
            }

            // 🔧 左上直線バグ対策: moveTo確認
            if (!this.hasMovedTo && this.initialPoint) {
                console.warn('⚠️ PenTool: moveTo未実行を検出、緊急実行');
                this.graphics.moveTo(this.initialPoint.x, this.initialPoint.y);
                this.hasMovedTo = true;
            }

            // lineTo実行
            this.graphics.lineTo(coords.x, coords.y);

            // 座標更新
            this.lastPoint = { x: coords.x, y: coords.y };
            this.lastValidX = coords.x;
            this.lastValidY = coords.y;
            this.strokePoints.push({ x: coords.x, y: coords.y });
            this.isFirstPoint = false;

            // デバッグログ（パフォーマンス考慮で間引き）
            if (this.strokePoints.length % 10 === 0) {
                console.log(`🖊️ PenTool: 描画継続 - ポイント数: ${this.strokePoints.length}`);
            }

            return true;

        } catch (error) {
            console.error('❌ PenTool: 描画継続エラー:', error);
            return false;
        }
    }

    /**
     * 描画終了処理
     * @param {Event} event - ポインターイベント
     * @returns {boolean} 終了成功可否
     */
    onPointerUp(event) {
        if (!this.isDrawing) {
            return false;
        }

        try {
            console.log('🖊️ PenTool: 描画終了処理開始');

            // 最終座標処理（オプション）
            if (event) {
                const coords = this.extractAndValidateCoordinates(event);
                if (coords) {
                    this.graphics.lineTo(coords.x, coords.y);
                    this.strokePoints.push({ x: coords.x, y: coords.y });
                }
            }

            // 描画完了処理
            this.finalizeStroke();

            // 状態リセット
            this.isDrawing = false;
            this.isFirstPoint = true;
            this.hasMovedTo = false;
            this.initialPoint = null;
            this.currentStroke = null;
            this.graphics = null; // Graphics参照クリア（CanvasManagerが管理）

            console.log(`🖊️ PenTool: 描画終了完了 - 総ポイント数: ${this.strokePoints.length}`);

            // イベント通知
            window.EventBus?.emit('pen-stroke-end', {
                tool: 'pen',
                pointCount: this.strokePoints.length,
                settings: this.settings
            });

            // 次回描画用リセット
            this.strokePoints = [];

            return true;

        } catch (error) {
            console.error('❌ PenTool: 描画終了エラー:', error);
            window.ErrorManager?.showErrorMessage('ペン描画終了失敗', error.message);
            this.reset();
            return false;
        }
    }

    /**
     * ペンスタイル設定
     * @private
     */
    setupPenStyle() {
        try {
            if (!this.graphics) {
                throw new Error('Graphics未初期化');
            }

            // 線スタイル設定
            this.graphics.lineStyle({
                width: this.settings.width,
                color: this.settings.color,
                alpha: this.settings.opacity,
                cap: PIXI.LINE_CAP.ROUND,
                join: PIXI.LINE_JOIN.ROUND
            });

            console.log('🔧 PenTool: スタイル設定完了', {
                width: this.settings.width,
                color: this.settings.color.toString(16),
                opacity: this.settings.opacity
            });

        } catch (error) {
            console.error('❌ PenTool: スタイル設定エラー:', error);
            // フォールバック設定
            this.graphics?.lineStyle(2, 0x000000, 1.0);
        }
    }

    /**
     * ストローク完了処理
     * @private
     */
    finalizeStroke() {
        try {
            if (!this.graphics) {
                return;
            }

            // ストローク情報保存（メモリ管理用）
            this.currentStroke = {
                tool: 'pen',
                points: [...this.strokePoints],
                settings: { ...this.settings },
                timestamp: Date.now()
            };

            // メモリ管理システムに通知（undo/redo用）
            if (window.MemoryManager) {
                window.MemoryManager.addDrawingAction(this.currentStroke);
            }

            console.log('📝 PenTool: ストローク完了処理完了');

        } catch (error) {
            console.error('❌ PenTool: ストローク完了処理エラー:', error);
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
     * ペン設定更新（AbstractTool継承版）
     * @param {Object} settings - 新しい設定
     * @returns {boolean} 更新成功可否
     */
    updateSettings(settings) {
        try {
            if (!settings || typeof settings !== 'object') {
                console.warn('⚠️ PenTool: 無効な設定パラメータ');
                return false;
            }

            // 基底クラスの設定更新
            if (!super.updateSettings(settings)) {
                return false;
            }

            // ペン固有設定検証・適用
            if (settings.color !== undefined) {
                if (typeof settings.color === 'number' && settings.color >= 0) {
                    this.settings.color = settings.color;
                }
            }

            if (settings.width !== undefined) {
                if (typeof settings.width === 'number' && settings.width > 0) {
                    this.settings.width = Math.min(settings.width, 50); // 最大50px
                }
            }

            if (settings.opacity !== undefined) {
                if (typeof settings.opacity === 'number' && settings.opacity >= 0 && settings.opacity <= 1) {
                    this.settings.opacity = settings.opacity;
                }
            }

            console.log('🔧 PenTool: 設定更新完了', this.settings);
            return true;

        } catch (error) {
            console.error('❌ PenTool: 設定更新エラー:', error);
            return false;
        }
    }

    /**
     * ペンツール状態取得
     * @returns {Object} 詳細状態情報
     */
    getDrawingState() {
        const baseState = super.getDrawingState();
        
        return {
            ...baseState,
            penSpecific: {
                strokePointCount: this.strokePoints.length,
                isFirstPoint: this.isFirstPoint,
                hasMovedTo: this.hasMovedTo,
                hasInitialPoint: !!this.initialPoint,
                currentStrokeId: this.currentStroke?.timestamp || null
            }
        };
    }

    /**
     * ペンツール特殊リセット
     * @returns {boolean} リセット成功可否
     */
    reset() {
        try {
            // 基底クラスリセット
            if (!super.reset()) {
                return false;
            }

            // ペン固有状態リセット
            this.currentStroke = null;
            this.strokePoints = [];
            this.isFirstPoint = true;
            this.hasMovedTo = false;
            this.initialPoint = null;

            console.log('🔄 PenTool: 特殊リセット完了');
            return true;

        } catch (error) {
            console.error('❌ PenTool: 特殊リセットエラー:', error);
            return false;
        }
    }

    /**
     * 緊急座標修正（左上直線バグ対策用）
     * @param {number} x - 修正X座標
     * @param {number} y - 修正Y座標
     * @returns {boolean} 修正成功可否
     */
    emergencyCoordinateFix(x, y) {
        try {
            if (!this.isDrawing || !this.graphics) {
                console.warn('⚠️ PenTool: 描画中でないため座標修正をスキップ');
                return false;
            }

            // 緊急moveTo実行
            this.graphics.moveTo(x, y);
            this.hasMovedTo = true;
            this.initialPoint = { x, y };
            this.lastPoint = { x, y };
            this.lastValidX = x;
            this.lastValidY = y;

            console.log(`🚨 PenTool: 緊急座標修正実行 (${x}, ${y})`);
            return true;

        } catch (error) {
            console.error('❌ PenTool: 緊急座標修正エラー:', error);
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
            version: '1.0-Phase1.4-left-top-bug-fixed',
            state: this.getDrawingState(),
            settings: { ...this.settings },
            currentStroke: this.currentStroke ? {
                pointCount: this.currentStroke.points.length,
                timestamp: this.currentStroke.timestamp
            } : null,
            bugFixes: {
                leftTopLineBug: 'FIXED',
                moveToImplementation: 'ACTIVE',
                coordinateValidation: 'ACTIVE'
            }
        };
    }
}

// グローバル登録
if (typeof window !== 'undefined') {
    window.PenTool = PenTool;
    console.log('🖊️ PenTool クラスをグローバルに登録完了');
} else {
    // Node.js環境対応
    module.exports = PenTool;
}

// 初期化完了通知
console.log('🖊️ PenTool v1.0-Phase1.4-left-top-bug-fixed 初期化完了');