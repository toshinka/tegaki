/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v0.8
 * メイン統合スクリプト - main.js (オプション)
 * 
 * HTMLに直接記述する代わりに、このファイルを使用することも可能
 * 責務: アプリケーション全体の初期化と統合管理
 * 依存: app-core.js, drawing-tools.js, ui-manager.js
 */

// ==== アプリケーション統合クラス ====
class FutabaDrawingApplication {
    constructor() {
        this.app = null;
        this.toolsSystem = null;
        this.uiManager = null;
        
        this.isInitialized = false;
        this.initStartTime = null;
        this.version = '0.8';
    }
    
    // ==== メイン初期化 ====
    async init() {
        try {
            this.initStartTime = performance.now();
            
            console.log(`🚀 ふたば☆ちゃんねる風ベクターお絵描きツール v${this.version} 起動開始`);
            console.log('📋 Rulebook準拠版 - JavaScript + PixiJS v7');
            
            await this.validateDependencies();
            await this.initializeCore();
            await this.initializeTools();
            await this.initializeUI();
            await this.finalizeIntegration();
            
            this.isInitialized = true;
            
            const initTime = Math.round(performance.now() - this.initStartTime);
            console.log(`🎉 アプリケーション起動完了！ (${initTime}ms)`);
            
            this.showWelcomeMessage();
            
        } catch (error) {
            console.error('❌ アプリケーション起動エラー:', error);
            this.showError(error);
            throw error;
        }
    }
    
    // ==== 依存関係検証 ====
    async validateDependencies() {
        console.log('🔍 依存関係チェック中...');
        
        const requiredGlobals = [
            { name: 'PIXI', description: 'PIXI.js v7ライブラリ' },
            { name: 'PixiDrawingApp', description: 'アプリケーションコア (app-core.js)' },
            { name: 'DrawingToolsSystem', description: 'ツールシステム (drawing-tools.js)' },
            { name: 'UIManager', description: 'UI管理システム (ui-manager.js)' }
        ];
        
        const missing = [];
        
        for (const dep of requiredGlobals) {
            if (typeof window[dep.name] === 'undefined') {
                missing.push(dep);
            }
        }
        
        if (missing.length > 0) {
            const errorMsg = '以下の依存関係が不足しています:\n' + 
                missing.map(dep => `-