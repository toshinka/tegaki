/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 🎯 メインエントリーポイント（座標統合対応・Manager統合強化・初期化順序修正版）
 * 🔄 COORDINATE_INTEGRATION: CoordinateManager統合・Manager連携強化・canvasElement依存関係修正
 * 🔧 SYNTAX_FIX: ES5互換・構文エラー修正版
 */

(function(global) {
    'use strict';

    /**
     * メインアプリケーション初期化（座標統合対応・Manager統合強化・初期化順序修正版・構文修正版）
     */
    function initialize() {
        console.log('🚀 メインアプリケーション初期化開始（座標統合対応・Manager統合強化・初期化順序修正版）');
        
        return new Promise(function(resolve, reject) {
            // 統一システム初期化
            initializeUnifiedSystems()
                .then(function() {
                    console.log('🔧 統一システム初期化完了');
                    
                    // AppCore初期化
                    return initializeAppCore();
                })
                .then(function() {
                    console.log('🎨 AppCore初期化完了');
                    
                    // Manager統合初期化（座標統合対応・canvasElement修正版）
                    return initializeManagersWithCoordinateIntegration();
                })
                .then(function() {
                    console.log('🔄 Manager統合初期化完了');
                    
                    // 最終検証・診断
                    performFinalVerification();
                    
                    console.log('✅ メインアプリケーション初期化完了（座標統合対応・Manager統合強化・初期化順序修正版）');
                    resolve();
                })
                .catch(function(error) {
                    console.error('❌ メインアプリケーション初期化失敗:', error);
                    
                    // エラーハンドリング
                    if (window.ErrorManager) {
                        window.ErrorManager.showError('error', 'アプリケーション初期化失敗: ' + error.message, {
                            additionalInfo: 'メインアプリケーション初期化エラー',
                            showReload: true
                        });
                    }
                    
                    reject(error);
                });
        });
    }

    /**
     * 統一システム初期化（修正版）
     */
    function initializeUnifiedSystems() {
        return new Promise(function(resolve, reject) {
            try {
                console.log('🔧 統一システム初期化中...');
                
                // 必要なシステムの確認
                var requiredSystems = ['ConfigManager', 'ErrorManager', 'StateManager', 'EventBus'];
                var missing = [];
                
                for (var i = 0; i < requiredSystems.length; i++) {
                    if (!window[requiredSystems[i]]) {
                        missing.push(requiredSystems[i]);
                    }
                }
                
                if (missing.length > 0) {
                    throw new Error('統一システム依存性エラー: ' + missing.join(', ') + ' が見つかりません');
                }
                
                // CoordinateManager確認（オプショナル）
                if (window.CoordinateManager) {
                    console.log('✅ CoordinateManager利用可能');
                } else {
                    console.warn('⚠️ CoordinateManager利用不可（座標統合機能制限）');
                }
                
                console.log('✅ 統一システム確認完了');
                resolve();
                
            } catch (error) {
                console.error('❌ 統一システム初期化失敗:', error);
                reject(error);
            }
        });
    }

    /**
     * AppCore初期化（座標統合対応・初期化順序修正版）
     */
    function initializeAppCore() {