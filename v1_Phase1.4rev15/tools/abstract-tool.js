/**
 * 🎨 AbstractTool - 全ツールの基底クラス
 * ✅ DRAWING_AUTHORITY: 描画処理の主導権保持
 * 🔄 TOOL_LIFECYCLE: onPointerDown/Move/Up統一インターフェース
 * 📋 RESPONSIBILITY: ツール共通インターフェース・座標統合・CanvasManager連携
 * 🚫 LAYER_PROHIBITION: レイヤー直接操作禁止（CanvasManager委譲）
 * 
 * 📏 DESIGN_PRINCIPLE: Template Method Pattern適用
 * 🎯 ARCHITECTURE: 責務分離・将来拡張対応設計
 * 
 * @version 1.0-Phase1.4-unified-control-enhanced
 * @author Tegaki Development Team
 * @since Phase1.4
 */

class AbstractTool {
    constructor(name) {
        this.name = name || 'AbstractTool';
        this.isDrawing = false;
        this.canvasManager = null;
        this.coordinateManager = null;
        this.graphics = null;
        this.lastPoint = { x: 0, y: 0 };
        this.lastValidX = 0;
        this.lastValidY = 0;
        
        // ツール設定
        this.settings = {
            color: 0x000000,
            width: 2,
            opacity: 1.0
        };
        
        console.log(`🎨 ${this.name} 初期化完了`);
    }

    /**
     * CanvasManager接続
     * @param {CanvasManager} canvasManager - キャンバス管理インスタンス
     */
    setCanvasManager(canvasManager) {
        if (!canvasManager) {
            console.warn(`⚠️ ${this.name}: CanvasManager が null です`);
            return false;
        }
        
        this.canvasManager = canvasManager;
        console.log(`🔗 ${this.name}: CanvasManager接続完了`);
        return true;
    }

    /**
     * CoordinateManager接続
     * @param {CoordinateManager} coordinateManager - 座標管理インスタンス
     */
    setCoordinateManager(coordinateManager) {
        if (!coordinateManager) {
            console.warn(`⚠️ ${this.name}: CoordinateManager が null です`);
            return false;
        }
        
        this.coordinateManager = coordinateManager;
        console.log(`🔗 ${this.name}: CoordinateManager接続完了`);
        return true;
    }

    /**
     * 共通座標抽出・検証処理
     * @param {Event} event - ポインターイベント
     * @returns {Object|null} 検証済み座標 {x, y} または null
     */
    extractAndValidateCoordinates(event) {
        try {
            // 必須コンポーネント確認
            if (!this.canvasManager) {
                console.warn(`⚠️ ${this.name}: CanvasManager未接続`);
                return null;
            }

            if (!this.coordinateManager) {
                console.warn(`⚠️ ${this.name}: CoordinateManager未接続`);
                return null;
            }

            // キャンバス境界取得
            const canvasRect = this.canvasManager.getCanvasBounds();
            if (!canvasRect) {
                console.warn(`⚠️ ${this.name}: キャンバス境界取得失敗`);
                return null;
            }

            // 座標抽出
            const coords = this.coordinateManager.extractCoordinates(event, canvasRect);
            if (!coords) {
                console.warn(`⚠️ ${this.name}: 座標抽出失敗`);
                return null;
            }

            // 座標範囲検証
            if (coords.x < 0 || coords.y < 0 || 
                coords.x > canvasRect.width || coords.y > canvasRect.height) {
                console.warn(`⚠️ ${this.name}: 座標範囲外 (${coords.x}, ${coords.y})`);
                return null;
            }

            return coords;

        } catch (error) {
            console.error(`❌ ${this.name}: 座標抽出・検証エラー:`, error);
            return null;
        }
    }

    /**
     * Graphics作成（CanvasManagerに委譲）
     * @returns {PIXI.Graphics|null} 作成されたGraphicsオブジェクト
     */
    createGraphics() {
        if (!this.canvasManager) {
            console.error(`❌ ${this.name}: CanvasManager未接続でGraphics作成不可`);
            return null;
        }

        try {
            const graphics = this.canvasManager.createGraphicsForTool(this.name);
            if (!graphics) {
                console.error(`❌ ${this.name}: Graphics作成失敗`);
                return null;
            }

            console.log(`🎨 ${this.name}: Graphics作成成功`);
            return graphics;

        } catch (error) {
            console.error(`❌ ${this.name}: Graphics作成エラー:`, error);
            return null;
        }
    }

    /**
     * Graphicsをレイヤーに配置
     * @param {PIXI.Graphics} graphics - 配置するGraphics
     * @param {string} layerId - レイヤーID
     * @returns {boolean} 配置成功可否
     */
    attachToLayer(graphics, layerId = 'main') {
        if (!this.canvasManager || !graphics) {
            console.error(`❌ ${this.name}: CanvasManager未接続またはGraphics無効`);
            return false;
        }

        try {
            const result = this.canvasManager.addGraphicsToLayer(graphics, layerId);
            if (result) {
                console.log(`🎨 ${this.name}: Graphics→${layerId}レイヤー配置完了`);
            }
            return result;

        } catch (error) {
            console.error(`❌ ${this.name}: Graphics配置エラー:`, error);
            return false;
        }
    }

    /**
     * ツール設定更新
     * @param {Object} settings - 新しい設定 {color?, width?, opacity?}
     */
    updateSettings(settings) {
        if (!settings || typeof settings !== 'object') {
            console.warn(`⚠️ ${this.name}: 無効な設定パラメータ`);
            return false;
        }

        // 設定マージ
        this.settings = { ...this.settings, ...settings };
        
        console.log(`🔧 ${this.name}: 設定更新完了`, this.settings);
        return true;
    }

    /**
     * 現在の描画状態取得
     * @returns {Object} 描画状態情報
     */
    getDrawingState() {
        return {
            name: this.name,
            isDrawing: this.isDrawing,
            hasGraphics: !!this.graphics,
            lastPoint: { ...this.lastPoint },
            settings: { ...this.settings },
            connected: {
                canvasManager: !!this.canvasManager,
                coordinateManager: !!this.coordinateManager
            }
        };
    }

    // === 子クラスでオーバーライド必須メソッド ===

    /**
     * ポインター押下開始処理
     * @param {Event} event - ポインターイベント
     * @returns {boolean} 処理成功可否
     */
    onPointerDown(event) {
        throw new Error(`${this.name}: onPointerDown() は子クラスで実装が必要です`);
    }

    /**
     * ポインター移動継続処理
     * @param {Event} event - ポインターイベント
     * @returns {boolean} 処理成功可否
     */
    onPointerMove(event) {
        throw new Error(`${this.name}: onPointerMove() は子クラスで実装が必要です`);
    }

    /**
     * ポインター離脱終了処理
     * @param {Event} event - ポインターイベント
     * @returns {boolean} 処理成功可否
     */
    onPointerUp(event) {
        throw new Error(`${this.name}: onPointerUp() は子クラスで実装が必要です`);
    }

    /**
     * ツール状態リセット
     * @returns {boolean} リセット成功可否
     */
    reset() {
        try {
            this.isDrawing = false;
            this.graphics = null;
            this.lastPoint = { x: 0, y: 0 };
            this.lastValidX = 0;
            this.lastValidY = 0;

            console.log(`🔄 ${this.name}: リセット完了`);
            return true;

        } catch (error) {
            console.error(`❌ ${this.name}: リセットエラー:`, error);
            return false;
        }
    }

    /**
     * ツール破棄処理
     */
    dispose() {
        try {
            this.reset();
            this.canvasManager = null;
            this.coordinateManager = null;
            
            console.log(`🗑️ ${this.name}: 破棄完了`);
            return true;

        } catch (error) {
            console.error(`❌ ${this.name}: 破棄エラー:`, error);
            return false;
        }
    }
}

// グローバル登録
if (typeof window !== 'undefined') {
    window.AbstractTool = AbstractTool;
    console.log('🎨 AbstractTool クラスをグローバルに登録完了');
} else {
    // Node.js環境対応
    module.exports = AbstractTool;
}

// 初期化完了通知
console.log('🎨 AbstractTool v1.0-Phase1.4-unified-control-enhanced 初期化完了');