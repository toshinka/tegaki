/**
 * 🎨 CanvasManager - レイヤー・ステージ管理専門
 * 🚫 DRAWING_PROHIBITION: 直接的な描画処理は禁止
 * ✅ LAYER_MANAGEMENT: レイヤー生成・管理・Graphics配置のみ
 * 🔄 TOOL_INTEGRATION: Toolが生成したオブジェクトの受け皿
 * 📋 RESPONSIBILITY: 「紙とレイヤー」の管理者
 * 
 * 📏 DESIGN_PRINCIPLE: Tool → Graphics生成, CanvasManager → レイヤー配置
 * 🎯 FUTURE_PROOF: レイヤーシステム・動画機能・Phase2対応設計
 * 
 * @version 1.0-Phase1.4-pure-layer-management
 * @author Tegaki Development Team
 * @since Phase1.0
 */

class CanvasManager {
    constructor() {
        this.app = null;
        this.stage = null;
        this.drawingContainer = null;
        this.backgroundContainer = null;
        this.overlayContainer = null;
        
        // レイヤー管理
        this.layers = new Map();
        this.currentLayerId = 'main';
        
        // キャンバス設定
        this.canvasConfig = {
            width: 800,
            height: 600,
            backgroundColor: 0xFFFFFF,
            antialias: true,
            resolution: window.devicePixelRatio || 1
        };
        
        console.log('🎨 CanvasManager 初期化開始 - v1.0-Phase1.4-pure-layer-management');
    }

    /**
     * CanvasManager初期化
     * @param {Object} config - キャンバス設定
     * @returns {Promise<boolean>} 初期化成功可否
     */
    async initialize(config = {}) {
        try {
            console.log('🎨 CanvasManager初期化開始');

            // 設定マージ
            this.canvasConfig = { ...this.canvasConfig, ...config };

            // PixiJS Application作成
            if (!this.createPixiApplication()) {
                throw new Error('PixiJS Application作成失敗');
            }

            // レイヤーシステム構築
            if (!this.createLayerSystem()) {
                throw new Error('レイヤーシステム構築失敗');
            }

            // DOM統合
            if (!this.attachToDOM()) {
                throw new Error('DOM統合失敗');
            }

            // 基本レイヤー作成
            this.createDefaultLayers();

            console.log('✅ CanvasManager初期化完了');
            console.log('📊 キャンバス情報:', {
                width: this.canvasConfig.width,
                height: this.canvasConfig.height,
                resolution: this.canvasConfig.resolution,
                layers: Array.from(this.layers.keys())
            });

            return true;

        } catch (error) {
            console.error('❌ CanvasManager初期化エラー:', error);
            window.ErrorManager?.showErrorMessage('キャンバス初期化失敗', error.message);
            return false;
        }
    }

    /**
     * PixiJS Application作成
     * @returns {boolean} 作成成功可否
     */
    createPixiApplication() {
        try {
            if (!window.PIXI) {
                throw new Error('PIXI ライブラリが読み込まれていません');
            }

            this.app = new PIXI.Application({
                width: this.canvasConfig.width,
                height: this.canvasConfig.height,
                backgroundColor: this.canvasConfig.backgroundColor,
                antialias: this.canvasConfig.antialias,
                resolution: this.canvasConfig.resolution,
                autoDensity: true
            });

            this.stage = this.app.stage;
            console.log('🎨 PixiJS Application作成完了');
            return true;

        } catch (error) {
            console.error('❌ PixiJS Application作成エラー:', error);
            return false;
        }
    }

    /**
     * レイヤーシステム構築
     * @returns {boolean} 構築成功可否
     */
    createLayerSystem() {
        try {
            // 背景コンテナ
            this.backgroundContainer = new PIXI.Container();
            this.backgroundContainer.name = 'background';
            this.stage.addChild(this.backgroundContainer);

            // 描画コンテナ（メインレイヤー）
            this.drawingContainer = new PIXI.Container();
            this.drawingContainer.name = 'drawing';
            this.stage.addChild(this.drawingContainer);

            // オーバーレイコンテナ
            this.overlayContainer = new PIXI.Container();
            this.overlayContainer.name = 'overlay';
            this.stage.addChild(this.overlayContainer);

            console.log('🎨 レイヤーシステム構築完了');
            return true;

        } catch (error) {
            console.error('❌ レイヤーシステム構築エラー:', error);
            return false;
        }
    }

    /**
     * DOM統合
     * @returns {boolean} 統合成功可否
     */
    attachToDOM() {
        try {
            const canvasContainer = document.getElementById('canvas-container');
            if (!canvasContainer) {
                throw new Error('canvas-container 要素が見つかりません');
            }

            // 既存キャンバス削除
            while (canvasContainer.firstChild) {
                canvasContainer.removeChild(canvasContainer.firstChild);
            }

            // 新しいキャンバス追加
            canvasContainer.appendChild(this.app.view);
            
            console.log('🎨 DOM統合完了');
            return true;

        } catch (error) {
            console.error('❌ DOM統合エラー:', error);
            return false;
        }
    }

    /**
     * デフォルトレイヤー作成
     */
    createDefaultLayers() {
        try {
            // メインレイヤー登録
            this.layers.set('background', this.backgroundContainer);
            this.layers.set('main', this.drawingContainer);
            this.layers.set('overlay', this.overlayContainer);

            console.log('🎨 デフォルトレイヤー作成完了:', Array.from(this.layers.keys()));

        } catch (error) {
            console.error('❌ デフォルトレイヤー作成エラー:', error);
        }
    }

    /**
     * ツール用Graphics作成
     * 🎯 RESPONSIBILITY: Toolの要求に応じてGraphicsインスタンスを提供
     * @param {string} toolName - ツール名
     * @returns {PIXI.Graphics|null} 作成されたGraphics
     */
    createGraphicsForTool(toolName) {
        try {
            if (!window.PIXI) {
                throw new Error('PIXI ライブラリ未初期化');
            }

            const graphics = new PIXI.Graphics();
            graphics.name = `${toolName}_${Date.now()}`;
            
            console.log(`🎨 CanvasManager: ${toolName}用Graphics作成完了 (${graphics.name})`);
            return graphics;

        } catch (error) {
            console.error(`❌ CanvasManager: ${toolName}用Graphics作成エラー:`, error);
            return null;
        }
    }

    /**
     * GraphicsをレイヤーID配置
     * 🎯 RESPONSIBILITY: Tool作成のGraphicsを適切なレイヤーに配置
     * @param {PIXI.Graphics} graphics - 配置するGraphics
     * @param {string} layerId - レイヤーID
     * @returns {boolean} 配置成功可否
     */
    addGraphicsToLayer(graphics, layerId = 'main') {
        try {
            if (!graphics) {
                console.error('❌ CanvasManager: Graphics が null または undefined です');
                return false;
            }

            const layer = this.layers.get(layerId);
            if (!layer) {
                console.warn(`⚠️ CanvasManager: レイヤー '${layerId}' が見つかりません。mainレイヤーに配置します`);
                const mainLayer = this.layers.get('main');
                if (mainLayer) {
                    mainLayer.addChild(graphics);
                    console.log(`🎨 CanvasManager: Graphics→mainレイヤー配置完了`);
                    return true;
                }
                return false;
            }

            layer.addChild(graphics);
            console.log(`🎨 CanvasManager: Graphics→${layerId}レイヤー配置完了`);
            return true;

        } catch (error) {
            console.error(`❌ CanvasManager: Graphics配置エラー:`, error);
            return false;
        }
    }

    /**
     * レイヤーからGraphics削除
     * @param {PIXI.Graphics} graphics - 削除するGraphics
     * @param {string} layerId - レイヤーID
     * @returns {boolean} 削除成功可否
     */
    removeGraphicsFromLayer(graphics, layerId = 'main') {
        try {
            if (!graphics) {
                console.error('❌ CanvasManager: Graphics が null または undefined です');
                return false;
            }

            const layer = this.layers.get(layerId);
            if (!layer) {
                console.warn(`⚠️ CanvasManager: レイヤー '${layerId}' が見つかりません`);
                return false;
            }

            layer.removeChild(graphics);
            console.log(`🗑️ CanvasManager: Graphics→${layerId}レイヤーから削除完了`);
            return true;

        } catch (error) {
            console.error(`❌ CanvasManager: Graphics削除エラー:`, error);
            return false;
        }
    }

    /**
     * 新しいレイヤー作成
     * @param {string} layerId - レイヤーID
     * @param {string} type - レイヤータイプ
     * @param {Object} options - レイヤーオプション
     * @returns {boolean} 作成成功可否
     */
    createNewLayer(layerId, type = 'drawing', options = {}) {
        try {
            if (this.layers.has(layerId)) {
                console.warn(`⚠️ CanvasManager: レイヤー '${layerId}' は既に存在します`);
                return false;
            }

            const container = new PIXI.Container();
            container.name = layerId;

            // オプション適用
            if (options.alpha !== undefined) container.alpha = options.alpha;
            if (options.visible !== undefined) container.visible = options.visible;

            // レイヤータイプに応じた配置
            switch (type) {
                case 'background':
                    this.backgroundContainer.addChild(container);
                    break;
                case 'overlay':
                    this.overlayContainer.addChild(container);
                    break;
                default:
                    this.drawingContainer.addChild(container);
                    break;
            }

            this.layers.set(layerId, container);
            console.log(`🎨 CanvasManager: 新しいレイヤー '${layerId}' 作成完了`);
            return true;

        } catch (error) {
            console.error(`❌ CanvasManager: レイヤー '${layerId}' 作成エラー:`, error);
            return false;
        }
    }

    /**
     * レイヤー表示切り替え
     * @param {string} layerId - レイヤーID
     * @param {boolean} visible - 表示可否
     * @returns {boolean} 切り替え成功可否
     */
    setLayerVisibility(layerId, visible) {
        try {
            const layer = this.layers.get(layerId);
            if (!layer) {
                console.warn(`⚠️ CanvasManager: レイヤー '${layerId}' が見つかりません`);
                return false;
            }

            layer.visible = visible;
            console.log(`👁️ CanvasManager: レイヤー '${layerId}' 表示切り替え: ${visible}`);
            return true;

        } catch (error) {
            console.error(`❌ CanvasManager: レイヤー表示切り替えエラー:`, error);
            return false;
        }
    }

    /**
     * ツール用レイヤー取得
     * @param {string} toolName - ツール名
     * @returns {string} レイヤーID
     */
    getLayerForTool(toolName) {
        // 将来の拡張: ツールごとの専用レイヤー割り当て
        switch (toolName) {
            case 'PenTool':
            case 'EraserTool':
                return 'main';
            case 'BackgroundTool':
                return 'background';
            case 'OverlayTool':
                return 'overlay';
            default:
                return 'main';
        }
    }

    /**
     * キャンバス境界情報取得
     * @returns {Object} 境界情報 {x, y, width, height}
     */
    getCanvasBounds() {
        if (!this.app || !this.app.view) {
            console.warn('⚠️ CanvasManager: app.view未初期化 - デフォルト値を返します');
            return {
                x: 0,
                y: 0,
                width: this.canvasConfig.width,
                height: this.canvasConfig.height
            };
        }

        return {
            x: 0,
            y: 0,
            width: this.app.view.width,
            height: this.app.view.height
        };
    }

    /**
     * キャンバス要素取得
     * @returns {HTMLCanvasElement|null} キャンバス要素
     */
    getCanvasElement() {
        if (!this.app || !this.app.view) {
            console.warn('⚠️ CanvasManager: app.view未初期化');
            return null;
        }
        return this.app.view;
    }

    /**
     * 現在のレイヤー情報取得
     * @returns {Object} レイヤー情報
     */
    getLayerInfo() {
        const layerInfo = {};
        this.layers.forEach((container, id) => {
            layerInfo[id] = {
                name: container.name,
                visible: container.visible,
                alpha: container.alpha,
                children: container.children.length
            };
        });
        return layerInfo;
    }

    /**
     * キャンバスクリア
     * @param {string} layerId - クリアするレイヤーID（省略時は全レイヤー）
     * @returns {boolean} クリア成功可否
     */
    clearCanvas(layerId = null) {
        try {
            if (layerId) {
                const layer = this.layers.get(layerId);
                if (layer) {
                    layer.removeChildren();
                    console.log(`🧹 CanvasManager: レイヤー '${layerId}' クリア完了`);
                }
            } else {
                this.layers.forEach((container, id) => {
                    if (id !== 'background') { // 背景は保持
                        container.removeChildren();
                    }
                });
                console.log('🧹 CanvasManager: 全レイヤー（背景除く）クリア完了');
            }
            return true;

        } catch (error) {
            console.error('❌ CanvasManager: キャンバスクリアエラー:', error);
            return false;
        }
    }

    /**
     * CanvasManager破棄
     */
    dispose() {
        try {
            if (this.app) {
                this.app.destroy(true);
                this.app = null;
            }

            this.layers.clear();
            this.stage = null;
            this.drawingContainer = null;
            this.backgroundContainer = null;
            this.overlayContainer = null;

            console.log('🗑️ CanvasManager破棄完了');

        } catch (error) {
            console.error('❌ CanvasManager破棄エラー:', error);
        }
    }
}

// グローバル登録
if (typeof window !== 'undefined') {
    window.CanvasManager = CanvasManager;
    console.log('🎨 CanvasManager クラスをグローバルに登録完了');
} else {
    // Node.js環境対応
    module.exports = CanvasManager;
}

// 初期化完了通知
console.log('🎨 CanvasManager v1.0-Phase1.4-pure-layer-management 初期化完了');