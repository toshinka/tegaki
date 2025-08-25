/**
 * 🎨 CanvasManager Simple - 怪物撲滅・骨太版
 * 📋 RESPONSIBILITY: レイヤー管理とPixiJS Applicationの受け皿のみ
 * 🚫 PROHIBITION: 描画処理・座標変換・エラー処理・複雑な初期化
 * ✅ PERMISSION: レイヤー作成・Graphics受け取り・例外throw
 * 
 * 📏 DESIGN_PRINCIPLE: 単純・直線的・素人でも読める
 * 🔄 INTEGRATION: PixiJS Application受け取り専用
 */

// Tegaki名前空間初期化
window.Tegaki = window.Tegaki || {};

/**
 * CanvasManager - シンプル版（40行以内）
 * 「紙とレイヤー」の管理者
 */
class CanvasManager {
    constructor() {
        console.log('🎨 CanvasManager Simple 作成');
        
        this.pixiApp = null;          // PIXI Applicationの受け皿
        this.layers = new Map();      // レイヤー管理
        this.initialized = false;
    }
    
    /**
     * PixiJS Application設定（外部から受け取るだけ）
     */
    setPixiApp(pixiApp) {
        if (!pixiApp) {
            throw new Error('PixiJS Application is required');
        }
        
        this.pixiApp = pixiApp;
        this.initialized = true;
        
        // 基本レイヤー作成
        this.createLayer('main');
        
        console.log('✅ CanvasManager - PixiApp設定完了');
    }
    
    /**
     * レイヤー作成（主責務）
     */
    createLayer(layerId) {
        if (this.layers.has(layerId)) {
            throw new Error(`Layer ${layerId} already exists`);
        }
        
        const layer = new PIXI.Graphics();
        layer.name = layerId;
        
        this.pixiApp.stage.addChild(layer);
        this.layers.set(layerId, layer);
        
        console.log(`✅ Layer created: ${layerId}`);
        return layer;
    }
    
    /**
     * Graphicsをレイヤーに配置（主責務）
     */
    addGraphicsToLayer(graphics, layerId = 'main') {
        const layer = this.layers.get(layerId);
        if (!layer) {
            throw new Error(`Layer ${layerId} not found`);
        }
        
        layer.addChild(graphics);
    }
    
    /**
     * レイヤー取得
     */
    getLayer(layerId) {
        return this.layers.get(layerId);
    }
    
    /**
     * 全レイヤークリア
     */
    clear() {
        this.layers.forEach(layer => layer.clear());
        console.log('✅ All layers cleared');
    }
}

// Tegaki名前空間に登録
window.Tegaki.CanvasManager = CanvasManager;

console.log('🎨 CanvasManager Simple Loaded - 怪物撲滅・骨太構造');