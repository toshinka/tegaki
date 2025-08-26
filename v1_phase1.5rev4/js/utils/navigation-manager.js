/**
 * 🧭 NavigationManager - キャンバス移動・変形システム（Phase1.5スタブ版）
 * 📋 RESPONSIBILITY: パン・ズーム・回転・キャンバス変形管理
 * 🚫 PROHIBITION: 描画処理・ツール管理・UI操作
 * ✅ PERMISSION: キャンバス変形・座標変換・ナビゲーション操作
 * 
 * 📏 DESIGN_PRINCIPLE: CoordinateManager連携・シンプル変形・段階的実装
 * 🔄 INTEGRATION: CoordinateManager必須依存・ツール・UI連携
 * 🎯 Phase1.5: 基本変形・パン/ズーム基盤（詳細実装は後続Phase1.5で完成）
 */

// Tegaki名前空間初期化
window.Tegaki = window.Tegaki || {};

/**
 * NavigationManager - キャンバス移動・変形システム（スタブ版）
 * Phase1.5で段階的に実装予定・現在はクラス定義のみ
 */
class NavigationManager {
    constructor() {
        console.log('🧭 NavigationManager Phase1.5 スタブ版 - 基本クラス定義のみ');
        
        // 基本状態
        this.isInitialized = false;
        this.coordinateManager = null;
        
        // パン状態
        this.isPanning = false;
        this.panStartX = 0;
        this.panStartY = 0;
        
        // ズーム状態
        this.currentZoom = 1.0;
        this.minZoom = 0.1;
        this.maxZoom = 10.0;
        
        // 変形履歴（Phase1.5で実装）
        this.transformHistory = [];
        
        console.log('🧭 NavigationManager スタブ作成完了 - Phase1.5で詳細実装予定');
    }
    
    /**
     * 回転操作（スタブ・Phase2で詳細実装）
     */
    rotateCanvas(angle, centerX = 0, centerY = 0) {
        if (!this.isInitialized) {
            console.warn('⚠️ NavigationManager not initialized');
            return false;
        }
        
        // CoordinateManagerに委譲
        if (this.coordinateManager) {
            this.coordinateManager.setRotation(angle);
        }
        
        console.log(`🧭 回転実行（スタブ）: ${(angle * 180 / Math.PI).toFixed(1)}度`);
        return true;
    }
    
    /**
     * キーボードナビゲーション（スタブ・Phase1.5詳細実装予定）
     */
    handleKeyboardNavigation(event) {
        if (!this.isInitialized) return false;
        
        console.log(`🧭 キーボードナビゲーション（スタブ）: ${event.key}`);
        
        // 基本的な方向キーのみ実装
        const panStep = 20; // 移動ステップ
        
        switch (event.key) {
            case 'ArrowUp':
                return this.panCanvas(0, -panStep);
            case 'ArrowDown':
                return this.panCanvas(0, panStep);
            case 'ArrowLeft':
                return this.panCanvas(-panStep, 0);
            case 'ArrowRight':
                return this.panCanvas(panStep, 0);
            default:
                return false;
        }
    }
    
    /**
     * マウスホイールズーム（スタブ・Phase1.5詳細実装予定）
     */
    handleMouseWheelZoom(event) {
        if (!this.isInitialized) return false;
        
        const zoomStep = 0.1;
        const zoomDirection = event.deltaY > 0 ? -1 : 1;
        const newZoom = this.currentZoom + (zoomStep * zoomDirection);
        
        return this.zoomCanvas(newZoom, event.clientX, event.clientY);
    }
    
    /**
     * 中ボタンパン（スタブ・Phase1.5詳細実装予定）
     */
    handleMiddleClickPan(event) {
        if (!this.isInitialized) return false;
        
        console.log('🧭 中ボタンパン（スタブ）');
        
        // 基本的な中ボタン判定のみ
        if (event.button === 1) { // 中ボタン
            return this.startPan(event.clientX, event.clientY);
        }
        
        return false;
    }
    
    /**
     * 変形状態保存（Phase1.5で実装予定）
     */
    saveTransformState() {
        const currentTransform = this.getCanvasTransform();
        this.transformHistory.push({
            transform: { ...currentTransform },
            timestamp: Date.now()
        });
        
        console.log('🧭 変形状態保存（スタブ）');
        return this.transformHistory.length - 1; // 保存ID
    }
    
    /**
     * 変形状態復元（Phase1.5で実装予定）
     */
    restoreTransformState(stateId) {
        if (stateId >= 0 && stateId < this.transformHistory.length) {
            const savedState = this.transformHistory[stateId];
            
            // CoordinateManagerに復元
            if (this.coordinateManager && savedState.transform) {
                this.coordinateManager.setTranslation(
                    savedState.transform.translateX, 
                    savedState.transform.translateY
                );
                this.coordinateManager.setScale(
                    savedState.transform.scaleX, 
                    savedState.transform.scaleY
                );
                this.coordinateManager.setRotation(savedState.transform.rotation);
            }
            
            console.log(`🧭 変形状態復元（スタブ）: ID ${stateId}`);
            return true;
        }
        
        console.warn(`⚠️ 無効な状態ID: ${stateId}`);
        return false;
    }
    
    /**
     * デバッグ情報取得
     */
    getDebugInfo() {
        return {
            // 基本状態
            isInitialized: this.isInitialized,
            hasCoordinateManager: !!this.coordinateManager,
            
            // 操作状態
            isPanning: this.isPanning,
            currentZoom: this.currentZoom,
            zoomRange: { min: this.minZoom, max: this.maxZoom },
            
            // 変形情報
            transform: this.getCanvasTransform(),
            transformHistoryCount: this.transformHistory.length,
            
            // Phase情報
            phase: {
                current: '1.5',
                implementationStatus: 'stub', // スタブ実装
                features: {
                    basicPan: true,
                    basicZoom: true,
                    basicReset: true,
                    keyboardNav: 'stub',
                    mouseWheelZoom: 'stub',
                    middleClickPan: 'stub',
                    advancedTransform: false // Phase2で実装
                }
            }
        };
    }
    
    /**
     * Phase1.5準備完了判定
     */
    isReadyForPhase15() {
        return this.isInitialized && !!this.coordinateManager;
    }
    
    /**
     * Phase2準備機能（将来実装用プレースホルダー）
     */
    enableAdvancedTransform() {
        console.log('🧭 高度変形機能（Phase2で実装予定）');
        return false; // Phase2で実装
    }
    
    setTransformConstraints(constraints) {
        console.log('🧭 変形制約設定（Phase2で実装予定）');
        return false; // Phase2で実装
    }
    
    enableGestureSupport() {
        console.log('🧭 ジェスチャーサポート（Phase2で実装予定）');
        return false; // Phase2で実装
    }
}

// Tegaki名前空間に登録
window.Tegaki.NavigationManager = NavigationManager;

console.log('🧭 NavigationManager Phase1.5 Loaded - スタブ版・段階的実装準備完了');
console.log('🧭 navigation-manager.js loaded - Phase1.5基本クラス・CoordinateManager連携準備');
     * 初期化（CoordinateManager連携）
     */
    initialize(coordinateManager) {
        if (!coordinateManager) {
            console.warn('⚠️ NavigationManager: CoordinateManager required');
            return false;
        }
        
        this.coordinateManager = coordinateManager;
        this.isInitialized = true;
        
        console.log('🧭 NavigationManager 初期化完了（CoordinateManager連携）');
        return true;
    }
    
    /**
     * パン操作（基本スタブ）
     */
    panCanvas(deltaX, deltaY) {
        if (!this.isInitialized) {
            console.warn('⚠️ NavigationManager not initialized');
            return false;
        }
        
        // CoordinateManagerに委譲
        if (this.coordinateManager) {
            this.coordinateManager.setTranslation(deltaX, deltaY);
        }
        
        console.log(`🧭 パン実行（スタブ）: (${deltaX.toFixed(1)}, ${deltaY.toFixed(1)})`);
        return true;
    }
    
    /**
     * ズーム操作（基本スタブ）
     */
    zoomCanvas(scale, centerX = 0, centerY = 0) {
        if (!this.isInitialized) {
            console.warn('⚠️ NavigationManager not initialized');
            return false;
        }
        
        // 制限内にクランプ
        const clampedScale = Math.max(this.minZoom, Math.min(this.maxZoom, scale));
        this.currentZoom = clampedScale;
        
        // CoordinateManagerに委譲
        if (this.coordinateManager) {
            this.coordinateManager.setScale(clampedScale);
        }
        
        console.log(`🧭 ズーム実行（スタブ）: ${(clampedScale * 100).toFixed(0)}%`);
        return true;
    }
    
    /**
     * 変形リセット
     */
    resetCanvasTransform() {
        if (!this.isInitialized) {
            console.warn('⚠️ NavigationManager not initialized');
            return false;
        }
        
        this.currentZoom = 1.0;
        this.isPanning = false;
        
        // CoordinateManagerに委譲
        if (this.coordinateManager) {
            this.coordinateManager.resetTransform();
        }
        
        console.log('🧭 変形リセット（スタブ）');
        return true;
    }
    
    /**
     * 現在の変形状態取得
     */
    getCanvasTransform() {
        if (this.coordinateManager) {
            return this.coordinateManager.getCanvasTransform();
        }
        
        return {
            translateX: 0,
            translateY: 0,
            scaleX: this.currentZoom,
            scaleY: this.currentZoom,
            rotation: 0
        };
    }
    
    /**
     * パン開始（スタブ）
     */
    startPan(x, y) {
        this.isPanning = true;
        this.panStartX = x;
        this.panStartY = y;
        
        console.log(`🧭 パン開始（スタブ）: (${x.toFixed(1)}, ${y.toFixed(1)})`);
        return true;
    }
    
    /**
     * パン更新（スタブ）
     */
    updatePan(x, y) {
        if (!this.isPanning) return false;
        
        const deltaX = x - this.panStartX;
        const deltaY = y - this.panStartY;
        
        return this.panCanvas(deltaX, deltaY);
    }
    
    /**
     * パン終了（スタブ）
     */
    endPan() {
        this.isPanning = false;
        console.log('🧭 パン終了（スタブ）');
        return true;
    }
    
    /**