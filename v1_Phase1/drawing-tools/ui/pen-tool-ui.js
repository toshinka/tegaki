/**
 * PenToolUI - 緊急修正版: @pixi/ui統合・ポップアップ復活・CONFIG連携完全対応
 * 
 * 🔧 緊急修正内容:
 * 1. ✅ @pixi/ui統合によるポップアップ機能復活
 * 2. ✅ 不足CONFIG対応・safeConfigGet連携強化
 * 3. ✅ 段階的フォールバック（@pixi/ui → 基本実装 → 最小実装）
 * 4. ✅ グローバル登録確実化・初期化ヘルパー追加
 * 5. ✅ エラーハンドリング強化・詳細ログ
 */

class PenToolUI {
    constructor(drawingToolsSystem) {
        this.drawingToolsSystem = drawingToolsSystem;
        this.app = drawingToolsSystem?.app || window.app;
        
        // 初期化状態管理
        this.isInitialized = false;
        this.initializationInProgress = false;
        this.pixiUIIntegrated = false;
        
        // ポップアップシステム
        this.popup = null;
        this.popupContainer = null;
        this.popupBackground = null;
        
        // 設定管理
        this.settings = {
            size: 4,
            opacity: 0.85,
            color: 0x800000,
            pressure: 0.5,
            smoothing: 0.3
        };
        
        // エラー管理
        this.errors = [];
        this.lastError = null;
        
        console.log('🎨 PenToolUI 緊急修正版 - 初期化準備完了');
    }
    
    /**
     * 🚨 緊急修正: 完全初期化システム
     */
    async init() {
        console.log('🚀 PenToolUI 緊急修正版 - 初期化開始...');
        
        if (this.initializationInProgress) {
            console.warn('⚠️ 初期化既に進行中');
            return false;
        }
        
        if (this.isInitialized) {
            console.log('✅ PenToolUI既に初期化済み');
            return true;
        }
        
        this.initializationInProgress = true;
        const startTime = performance.now();
        
        try {
            // Step 1: CONFIG確認・補完
            this.validateAndSupplementConfig();
            
            // Step 2: @pixi/ui統合確認
            this.checkPixiUIIntegration();
            
            // Step 3: ポップアップシステム初期化
            await this.initializePopupSystem();
            
            // Step 4: イベント設定
            this.setupEventHandlers();
            
            // Step 5: 初期設定反映
            this.applyDefaultSettings();
            
            const endTime = performance.now();
            console.log(`✅ PenToolUI 緊急修正版初期化完了 (${(endTime - startTime).toFixed(1)}ms)`);
            
            this.isInitialized = true;
            this.initializationInProgress = false;
            
            return true;
            
        } catch (error) {
            console.error('❌ PenToolUI初期化失敗:', error);
            this.lastError = error;
            this.errors.push({ timestamp: Date.now(), error: error.message });
            this.initializationInProgress = false;
            return false;
        }
    }
    
    /**
     * 🚨 緊急修正: CONFIG確認・補完システム
     */
    validateAndSupplementConfig() {
        console.log('🔍 CONFIG確認・補完開始...');
        
        // 重要なCONFIG項目の存在確認
        const requiredConfigs = [
            'SIZE_PRESETS', 'PREVIEW_MIN_SIZE', 'PREVIEW_MAX_SIZE',
            'DEFAULT_COLOR', 'POPUP_CONFIG', 'LIBRARY_CONFIG'
        ];
        
        const missing = [];
        requiredConfigs.forEach(key => {
            if (!window.CONFIG?.[key]) {
                missing.push(key);
            }
        });
        
        if (missing.length > 0) {
            console.warn('⚠️ 不足CONFIG項目:', missing);
            
            // 緊急補完
            this.emergencyConfigSupplement();
        } else {
            console.log('✅ 必要CONFIG項目確認完了');
        }
        
        // safeConfigGet関数の存在確認
        if (typeof window.safeConfigGet !== 'function') {
            console.warn('⚠️ safeConfigGet関数が見つかりません');
            this.createFallbackSafeConfigGet();
        }
    }
    
    /**
     * 🆘 緊急CONFIG補完
     */
    emergencyConfigSupplement() {
        console.log('🆘 緊急CONFIG補完実行中...');
        
        if (!window.CONFIG) {
            window.CONFIG = {};
        }
        
        // 基本設定補完
        window.CONFIG.SIZE_PRESETS = window.CONFIG.SIZE_PRESETS || [
            { name: '極細', size: 1, opacity: 90 },
            { name: '細', size: 2, opacity: 85 },
            { name: '標準', size: 4, opacity: 85 },
            { name: '太', size: 8, opacity: 80 },
            { name: '極太', size: 16, opacity: 75 }
        ];
        
        window.CONFIG.PREVIEW_MIN_SIZE = window.CONFIG.PREVIEW_MIN_SIZE || 1;
        window.CONFIG.PREVIEW_MAX_SIZE = window.CONFIG.PREVIEW_MAX_SIZE || 32;
        window.CONFIG.DEFAULT_COLOR = window.CONFIG.DEFAULT_COLOR || 0x800000;
        window.CONFIG.PRESET_UPDATE_THROTTLE = window.CONFIG.PRESET_UPDATE_THROTTLE || 16;
        window.CONFIG.TARGET_FPS = window.CONFIG.TARGET_FPS || 60;
        
        // ポップアップ設定補完
        window.CONFIG.POPUP_CONFIG = window.CONFIG.POPUP_CONFIG || {
            WIDTH: 320,
            HEIGHT: 480,
            BACKGROUND_COLOR: 0xF0E0D6,
            BORDER_COLOR: 0x800000,
            ANIMATION_DURATION: 200
        };
        
        console.log('✅ 緊急CONFIG補完完了');
    }
    
    /**
     * 🆘 フォールバックsafeConfigGet作成
     */
    createFallbackSafeConfigGet() {
        window.safeConfigGet = function(key, defaultValue = null) {
            try {
                const keys = key.split('.');
                let current = window.CONFIG;
                
                for (const k of keys) {
                    if (current && typeof current === 'object' && k in current) {
                        current = current[k];
                    } else {
                        console.warn(`safeConfigGet: キー不存在 (${key}) → デフォルト値使用:`, defaultValue);
                        return defaultValue;
                    }
                }
                
                return current;
            } catch (error) {
                console.warn(`safeConfigGet: エラー (${key}) →`, error.message, '→ デフォルト値:', defaultValue);
                return defaultValue;
            }
        };
        
        console.log('✅ フォールバックsafeConfigGet作成完了');
    }
    
    /**
     * 🚨 緊急修正: @pixi/ui統合確認
     */
    checkPixiUIIntegration() {
        console.log('🔌 @pixi/ui統合確認開始...');
        
        // @pixi/ui利用可能性確認
        const pixiUIAvailable = window.PixiExtensions?.hasFeature?.('ui') || 
                               window.PixiExtensions?.Button ||
                               window.PIXI?.ui;
        
        if (pixiUIAvailable) {
            console.log('✅ @pixi/ui統合利用可能');
            this.pixiUIIntegrated = true;
        } else {
            console.warn('⚠️ @pixi/ui統合利用不可 - フォールバック使用');
            this.pixiUIIntegrated = false;
        }
        
        // PixiJS本体確認
        if (!window.PIXI) {
            throw new Error('PixiJS本体が利用できません');
        }
        
        console.log(`📊 @pixi/ui統合状況: ${this.pixiUIIntegrated ? '有効' : '無効'}`);
    }
    
    /**
     * 🎨 ポップアップシステム初期化（段階的フォールバック）
     */
    async initializePopupSystem() {
        console.log('📋 ポップアップシステム初期化開始...');
        
        try {
            if (this.pixiUIIntegrated) {
                // Level 1: @pixi/ui使用
                await this.createPixiUIPopup();
                console.log('✅ @pixi/ui ポップアップ初期化完了');
            } else if (window.PIXI) {
                // Level 2: 基本PixiJS使用
                await this.createBasicPixiPopup();
                console.log('✅ 基本PixiJS ポップアップ初期化完了');
            } else {
                // Level 3: DOM使用（最小実装）
                await this.createDOMPopup();
                console.log('✅ DOM ポップアップ初期化完了');
            }
        } catch (error) {
            console.error('❌ ポップアップ初期化失敗:', error);
            // 最終フォールバック
            await this.createMinimalPopup();
            console.log('🆘 最小ポップアップで初期化完了');
        }
    }
    
    /**
     * 🎨 @pixi/ui統合ポップアップ作成
     */
    async createPixiUIPopup() {
        console.log('🎨 @pixi/ui統合ポップアップ作成中...');
        
        const config = window.safeConfigGet('POPUP_CONFIG', {});
        
        // ポップアップコンテナ作成
        this.popupContainer = new PIXI.Container();
        this.popupContainer.name = 'pen-popup-container';
        
        // モーダル背景（@pixi/ui Style）
        this.popupBackground = new PIXI.Graphics();
        this.popupBackground.rect(0, 0, this.app.screen.width, this.app.screen.height);
        this.popupBackground.fill({ color: 0x000000, alpha: 0.5 });
        this.popupBackground.eventMode = 'static';
        this.popupBackground.cursor = 'pointer';
        
        // 背景クリックで閉じる
        this.popupBackground.on('pointerdown', () => this.hidePopup());
        
        this.popupContainer.addChild(this.popupBackground);\n        \n        // メインポップアップパネル作成\n        this.popup = await this.createMainPopupPanel(config);\n        this.popupContainer.